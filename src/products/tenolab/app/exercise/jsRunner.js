/* HTML と JavaScript を、画面から切り離した枠（iframe sandbox="allow-scripts"。allow-same-origin は付けない）で動かす（2026-10-13）。
   - 受講生のコードは別の起源で動くので、画面（ログイン・記録）には触れない
   - console.log・console.error・alert・エラーを postMessage で受け取って、画面のコンソールに出す
   - 確かめる式（checks / tests）は枠の中で動かし、結果だけを受け取る（ボタンを押して結果を見る、なども枠の中でできる）
   - 終わらないくり返しで画面が固まらないよう、for・while の中に回数の見張りを入れる */

let seq = 0;
const LOOP_LIMIT = 200000;

// for (...) { / while (...) { / do { の直後に見張りを入れる（字句をきちんと読むほどではない、教材の範囲の書き方向け）
export function guardLoops(js) {
  return String(js || "")
    .replace(/\b(for|while)\s*\(((?:[^()]|\([^()]*\))*)\)\s*\{/g, (m) => `${m} if (++__djsLoop > ${LOOP_LIMIT}) throw new Error("くり返しが終わりません（終わる条件を確かめてください）");`)
    .replace(/\bdo\s*\{/g, (m) => `${m} if (++__djsLoop > ${LOOP_LIMIT}) throw new Error("くり返しが終わりません（終わる条件を確かめてください）");`);
}

const prelude = (token) => `<script>
(function(){
  var T = ${JSON.stringify(token)};
  window.__djsLoop = 0;
  window.__logs = []; window.__alerts = [];
  function send(t, d){ try { parent.postMessage({ __djs: T, t: t, d: d }, "*"); } catch (e) {} }
  function fmt(x){ if (typeof x === "string") return x; try { return JSON.stringify(x); } catch (e) { return String(x); } }
  ["log","info","warn","error"].forEach(function(k){
    console[k] = function(){ var s = Array.prototype.map.call(arguments, fmt).join(" "); window.__logs.push(s); send(k === "error" ? "error" : "log", s); };
  });
  window.alert = function(m){ var s = String(m); window.__alerts.push(s); send("alert", s); };
  window.confirm = function(m){ send("alert", String(m)); return true; };
  window.prompt = function(m, d){ send("alert", String(m)); return d == null ? "" : String(d); };
  window.addEventListener("error", function(e){ send("error", { msg: e.message, line: e.lineno }); });
  document.addEventListener("submit", function(e){ e.preventDefault(); }, true);
})();
</script>`;

const checker = (token, exprs) => `<script>
window.addEventListener("load", function(){
  setTimeout(function(){
    var T = ${JSON.stringify(token)};
    var list = ${JSON.stringify(exprs)};
    var out = list.map(function(src){
      // value は式の値の写し（コードのクイズで「→ 300 になりました」と出すため。2026-10-15）
      try { var v = (new Function("return (" + src + ");"))(); var w; try { w = v === undefined ? "undefined" : JSON.stringify(v); } catch (e2) { w = String(v); } return { ok: !!v, value: w }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    });
    parent.postMessage({ __djs: T, t: "done", d: out }, "*");
  }, 60);
});
</script>`;

// 1つの文書にまとめる。html は全体（<html> を含む）でも、body の中身だけでもよい
export function buildJsDocument({ html = "", js = "", token = "", checks = null }) {
  const userScript = js ? `<script>\n${guardLoops(js)}\n</script>` : "";
  const tail = `${userScript}${checks ? checker(token, checks) : ""}`;
  let src = String(html || "");
  // ページの中の <script> にも見張りを入れる（演習一覧・案件体験は HTML の中に JavaScript を書く）
  src = src.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, body, c) => (/\bsrc\s*=/.test(a) ? m : `${a}${guardLoops(body)}${c}`));
  if (/<html[\s>]/i.test(src)) {
    src = /<head[^>]*>/i.test(src) ? src.replace(/<head[^>]*>/i, m => `${m}${prelude(token)}`) : src.replace(/<html[^>]*>/i, m => `${m}<head>${prelude(token)}</head>`);
    src = /<\/body>/i.test(src) ? src.replace(/<\/body>/i, `${tail}</body>`) : `${src}${tail}`;
    return src;
  }
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">${prelude(token)}<style>body{font-family:"Yu Gothic UI",Meiryo,sans-serif;padding:12px;color:#222}</style></head><body>\n${src}\n${tail}</body></html>`;
}

// 受講生のコードの行番号：script.js だけを書く形では、エラーの行から前置きの行数を引く
export function userLineOffset(html, js) {
  const doc = buildJsDocument({ html, js: "\u0000MARK\u0000", token: "x" });
  const at = doc.indexOf("\u0000MARK\u0000");
  return at < 0 ? 0 : doc.slice(0, at).split("\n").length - 1;
}

/* 動かす。frame を渡すとその枠（見える枠）で、渡さなければ隠れた枠を作って動かす。
   checks は式の文字列の配列（枠の中で評価）。返す形：{ logs: [{ t, s, line }], results: [{ ok, error }] | null, timedOut }
   確かめる式は1つずつ新しい枠で動かす（前の式で押したボタンの結果が、次の式に残らないように） */
export async function runJsPage({ html = "", js = "", checks = null, frame = null, timeoutMs = 4000 }) {
  if (!checks || checks.length <= 1 || frame) return runOnce({ html, js, checks, frame, timeoutMs });
  const runs = await Promise.all(checks.map(c => runOnce({ html, js, checks: [c], timeoutMs })));
  return { logs: runs[0].logs, results: runs.map(r => r.results?.[0] || { ok: false }), timedOut: runs.some(r => r.timedOut) };
}

function runOnce({ html, js, checks, frame, timeoutMs }) {
  return new Promise(resolve => {
    const token = `djs-${Date.now()}-${++seq}`;
    const own = !frame;
    const f = frame || document.createElement("iframe");
    if (own) {
      f.setAttribute("aria-hidden", "true");
      f.tabIndex = -1;
      f.style.cssText = "position:fixed;left:-10000px;top:0;width:1024px;height:768px;border:0;opacity:0;pointer-events:none";
      document.body.appendChild(f);
    }
    f.setAttribute("sandbox", "allow-scripts allow-modals allow-forms");
    const logs = [];
    let done = false;
    const finish = (results, timedOut = false) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMsg);
      clearTimeout(timer);
      if (own) setTimeout(() => f.remove(), 0);
      resolve({ logs, results, timedOut });
    };
    const onMsg = e => {
      const m = e.data;
      if (!m || m.__djs !== token || e.source !== f.contentWindow) return;
      if (m.t === "done") finish(m.d);
      else if (m.t === "error" && m.d && typeof m.d === "object") logs.push({ t: "error", s: m.d.msg, line: m.d.line || 0 });
      else logs.push({ t: m.t, s: String(m.d) });
      if (!checks && logs.length > 500) finish(null);
    };
    window.addEventListener("message", onMsg);
    // 確かめる式が無いとき（見るだけ）は、読み込みが終わって少ししたら返す
    if (!checks) f.onload = () => setTimeout(() => finish(null), 400);
    const timer = setTimeout(() => finish(checks ? checks.map(() => ({ ok: false, error: "時間がかかりすぎています" })) : null, true), timeoutMs);
    f.srcdoc = buildJsDocument({ html, js, token, checks });
  });
}
