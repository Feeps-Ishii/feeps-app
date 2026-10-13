import { runSqlChecks } from "./exercise/sqlRunner.js";
import { apiPost } from "../../../api.js";
import { runJsPage } from "./exercise/jsRunner.js";

/* 演習・案件体験のコードを動かして、テスト（受け入れ条件）を判定する。
   結果は { out: string[], error: string, results: [{ name, ok }] }。
   テストの式は講師が書く教材（受講生の入力ではない）。受講生のコードはそれぞれの仕組みの中で動かす：
   - js   : Web Worker（画面とは別の場所）。止まらないコードは時間で打ち切る
   - web  : スクリプトを動かさない iframe に HTML/CSS を描いて、doc（その document）で確かめる
   - sql  : sql.js（ブラウザの中の SQLite）。sqlSetup でテーブルを作ってから流す
   - java : 既存の実行 API（隔離した Lambda）。標準出力を expect と比べる
   - check: 自分で確かめて付けるチェック */

const JS_TIMEOUT = 3000;

// 上の階層に書いた function / const / let / var の名前（テストの env に入れる）
function topNames(code) {
  const names = new Set();
  const re = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(code))) names.add(m[1] || m[2]);
  return [...names];
}

const WORKER_SRC = `
self.onmessage = (e) => {
  const { code, names, tests } = e.data;
  const out = [];
  const fmt = (x) => typeof x === "string" ? x : (() => { try { return JSON.stringify(x); } catch (_) { return String(x); } })();
  const fakeConsole = { log: (...a) => out.push(a.map(fmt).join(" ")), error: (...a) => out.push(a.map(fmt).join(" ")), warn: (...a) => out.push(a.map(fmt).join(" ")) };
  let env = {}, error = "";
  try {
    const ret = names.map(n => JSON.stringify(n) + ": typeof " + n + " === 'undefined' ? undefined : " + n).join(", ");
    env = new Function("console", code + "\\n;return { " + ret + " };")(fakeConsole);
  } catch (err) { error = String(err && err.message || err); }
  const results = tests.map(t => {
    if (error) return { name: t.name, ok: false };
    try { return { name: t.name, ok: !!new Function("env", "return (" + t.expr + ");")(env) }; }
    catch (err) { return { name: t.name, ok: false, error: String(err && err.message || err) }; }
  });
  self.postMessage({ out: out.slice(0, 200), error, results });
};`;

export function runJs(code, tests = []) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
    const w = new Worker(url);
    const done = r => { clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); resolve(r); };
    const timer = setTimeout(() => done({ out: [], error: "時間がかかりすぎています。終わらないくり返しになっていないか確かめてください。", results: tests.map(t => ({ name: t.name, ok: false })) }), JS_TIMEOUT);
    w.onmessage = e => done(e.data);
    w.onerror = e => { e.preventDefault(); done({ out: [], error: e.message || "実行できませんでした", results: tests.map(t => ({ name: t.name, ok: false })) }); };
    w.postMessage({ code, names: topNames(code), tests: tests.map(t => ({ name: t.name, expr: t.expr })) });
  });
}

// HTML/CSS を描く。iframe はスクリプトを動かさない（sandbox に allow-scripts を付けない）
export function runWeb(code, tests = [], frame) {
  return new Promise(resolve => {
    const iframe = frame;
    const finish = () => {
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      const results = tests.map(t => {
        try { return { name: t.name, ok: !!new Function("doc", "win", "return (" + t.expr + ");")(doc, win) }; }
        catch (err) { return { name: t.name, ok: false, error: String(err?.message || err) }; }
      });
      resolve({ out: [], error: "", results });
    };
    iframe.onload = () => setTimeout(finish, 60);   // スタイルが当たるのを待つ
    iframe.srcdoc = code;
  });
}

const tableText = set => {
  if (!set) return [];
  return [set.columns.join(" | "), ...set.values.slice(0, 50).map(r => r.map(v => (v === null ? "NULL" : String(v))).join(" | "))];
};
// 答え合わせ：t.query（答えのSQL）の結果と比べる。t.expect があれば、両方を流したあとに t.expect を流した結果で比べる（INSERT・UPDATE など）
export async function runSql(code, tests = [], setup = "") {
  const r = await runSqlChecks({ setup, code, checks: tests.map(t => ({ answer: t.query, query: t.expect || "" })) });
  return { out: tableText(r.set), set: r.set, error: r.error, results: tests.map((t, k) => ({ name: t.name, ok: !!r.results[k]?.ok, ...(r.results[k]?.error ? { error: r.results[k].error } : {}) })) };
}

export async function runJava(code, tests = []) {
  const fileName = (code.match(/public\s+class\s+([A-Za-z_]\w*)/) || [])[1] || "Main";
  const runOnce = async stdin => {
    const payload = { files: [{ name: `${fileName}.java`, content: code }], entry: `${fileName}.java`, stdin: stdin || "" };
    let res = await apiPost("/learning/exercises/java/run", payload);
    if (res?.timedOut && res?.retryable) res = await apiPost("/learning/exercises/java/run", payload);
    return res;
  };
  const list = tests.length ? tests : [{ name: "実行できる", stdin: "", expect: null }];
  let first = null;
  const results = [];
  try {
    for (const t of list) {
      const res = await runOnce(t.stdin);
      if (!first) first = res;
      const ran = res?.compiled && !res.timedOut && res.exitCode === 0;
      results.push({ name: t.name, ok: !!ran && (t.expect == null || String(res.stdout || "").trim() === String(t.expect).trim()) });
      if (!res?.compiled) break;
    }
  } catch (e) {
    return { out: [], error: e?.message || "コードを実行できませんでした。時間をおいてお試しください。", results: list.map(t => ({ name: t.name, ok: false })) };
  }
  const err = !first?.compiled ? (first?.compileError || first?.stderr || first?.message || "コンパイルできませんでした") : first?.timedOut ? "時間がかかりすぎています。終わらないくり返しになっていないか確かめてください。" : first?.exitCode ? (first?.stderr || "実行中にエラーが出ました") : "";
  while (results.length < list.length) results.push({ name: list[results.length].name, ok: false });
  return { out: String(first?.stdout || "").split("\n").slice(0, 200), error: err, results };
}

// HTML＋JavaScript：画面から切り離した枠で動かし、式は枠の中で確かめる（exercise/jsRunner.js）
export async function runJsWeb(code, tests = []) {
  const r = await runJsPage({ html: code, js: "", checks: tests.length ? tests.map(t => t.expr) : null });
  const err = r.logs.find(l => l.t === "error");
  return {
    out: r.logs.map(l => (l.t === "alert" ? `[alert] ${l.s}` : l.t === "error" ? `エラー: ${l.s}${l.line ? `（${l.line}行目）` : ""}` : l.s)).slice(0, 200),
    error: err ? `${err.s}${err.line ? `（${err.line}行目）` : ""}` : r.timedOut && tests.length ? "時間がかかりすぎています。終わらないくり返しになっていないか確かめてください。" : "",
    results: tests.map((t, k) => ({ name: t.name, ok: !!r.results?.[k]?.ok, ...(r.results?.[k]?.error ? { error: r.results[k].error } : {}) })),
  };
}

export async function runCode(runtime, code, tests, { frame, sqlSetup } = {}) {
  if (runtime === "js") return runJs(code, tests);
  if (runtime === "jsweb") return runJsWeb(code, tests);
  if (runtime === "web") return runWeb(code, tests, frame);
  if (runtime === "sql") return runSql(code, tests, sqlSetup);
  if (runtime === "java") return runJava(code, tests);
  return { out: [], error: "", results: [] };
}

export const FILE_NAME = { js: "main.js", web: "index.html", jsweb: "index.html", sql: "query.sql", java: "Main.java" };
