import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiPut } from "../../../../api.js";
import JavaEditor from "../../../learning/JavaEditor.jsx";
import { parseJavacError, tokenizeLine } from "../../../learning/javaEditorSupport.js";
import { Back } from "../ui.jsx";
import { Editor } from "../Workbench.jsx";
import { FILE_NAME, runCode, runSql } from "../runtime.js";
import { acceptCase, runCaseServlet, sendCaseChat, skipCase, submitCase } from "../data.js";
import { diffStat, hunks, lineDiff } from "./diff.js";
import WebEditor from "../../../learning/WebEditor.jsx";
import { buildJsDocument } from "../exercise/jsRunner.js";
import { SqlGrid, SqlTables, useSqlTables } from "../exercise/SqlParts.jsx";
import { sqlWords } from "../exercise/sqlRunner.js";
import "./case.css";

/* 案件体験（2026-10-13、モック docs/design/mockups/devhub-learning-2026-10/devhub-case.html）。
   実際の案件と同じ流れ：アサイン → チケット → 仕様 → 実装 → 動作確認 → テスト → プルリク → レビュー → 完了。
   右のチャットは PM・リーダー・お客さま（AI が演じる。POST /tenolab/cases/{id}/chat）。
   Servlet の案件は、実行・テストともサーバーで本物の Java を動かす（POST …/run）。それ以外は今までどおり画面の中で動かす。
   レビューは提出（POST …/submit）で AI が行い、行ごとのコメントと採点の基準の結果が返る。
   期限は管理者が割り当てたときだけ出す（自分で始めた案件は期限なし）。 */

const KIND = { feat: ["機能追加", "feat"], bug: ["不具合", "bug"], mod: ["改修", "mod"] };
const RUNTIME_LABEL = { servlet: "Java / Servlet", java: "Java", js: "JavaScript", jsweb: "HTML＋JavaScript", web: "HTML / CSS", sql: "SQL" };
const PEOPLE = {
  pm: { n: "PM", av: "PM", c: "#2457E6" },
  lead: { n: "リーダー", av: "L", c: "#11966F" },
  client: { n: "お客さま", av: "客", c: "#8A5CD0" },
  me: { n: "あなた", av: "A", c: "#B98F00" },
};
const TPL = "【やりたいこと】\n【やったこと】\n【困っていること】\n【自分の考え】";
const VERDICT = { approved: "承認（Approve）", returned: "修正依頼（Request changes）", skipped: "先に進みました", submitted: "レビューできませんでした" };

const dueLabel = d => {
  if (!d) return "";
  const t = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(t.getTime())) return d;
  return `${t.getMonth() + 1}/${t.getDate()}（${"日月火水木金土"[t.getDay()]}）${d.length > 10 ? ` ${d.slice(11, 16)}` : ""}`;
};
const hm = iso => { const t = new Date(iso || ""); return Number.isNaN(t.getTime()) ? "" : `${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`; };
const paramsLabel = qs => {
  const p = new URLSearchParams(qs || "");
  const parts = [];
  for (const [k, v] of p) parts.push(`${k}=${v === "" ? "空" : v}`);
  return parts.join(", ") || "（入力なし）";
};

// AI の文の `…` をコードとして出す
function Rich({ text }) {
  return <>{String(text || "").split(/(`[^`\n]+`)/).map((s, k) => (/^`[^`\n]+`$/.test(s) ? <code key={k}>{s.slice(1, -1)}</code> : <React.Fragment key={k}>{s}</React.Fragment>))}</>;
}

function Av({ who, small }) {
  const p = PEOPLE[who] || PEOPLE.lead;
  return <span className={`cf-av ${small ? "sm" : ""}`} style={{ "--c": p.c }}>{p.av}</span>;
}

function JavaLine({ s }) {
  return <>{tokenizeLine(s).map((t, k) => (t.type ? <span key={k} className={`hl-${t.type}`}>{t.text}</span> : <React.Fragment key={k}>{t.text}</React.Fragment>))}</>;
}

/* ---------- 差分（プルリク・レビュー） ---------- */
function DiffView({ before, after, fileName, comments = [], fixed, onFix }) {
  const rows = useMemo(() => lineDiff(before, after), [before, after]);
  const st = diffStat(rows);
  const byLine = useMemo(() => {
    const m = new Map();
    for (const c of comments) m.set(c.line, [...(m.get(c.line) || []), c]);
    return m;
  }, [comments]);
  const shown = hunks(rows, 2, comments.map(c => c.line));
  if (!st.add && !st.del) return <div className="cf-diff"><div className="fh"><span>{fileName}</span><span className="muted">変更なし</span></div></div>;
  return (
    <div className="cf-diff">
      <div className="fh"><span>{fileName}</span><span className="ad">+{st.add}</span><span className="rm">-{st.del}</span></div>
      {shown.map((r, k) => r.t === "gap" ? <div key={k} className="dl gap"><span className="no">⋯</span><span /><span className="code" /></div> : (
        <React.Fragment key={k}>
          <div className={`dl ${r.t}`}><span className="no">{r.t === "del" ? r.a : r.b}</span><span>{r.t === "add" ? "+" : r.t === "del" ? "-" : ""}</span><span className="code"><JavaLine s={r.s} /></span></div>
          {r.t !== "del" && (byLine.get(r.b) || []).map((c, j) => (
            <div key={j} className={`cf-rc ${fixed ? "done" : ""}`}>
              <div className="who"><Av who="lead" small />リーダー{c.must ? <span className="chip ng">必須</span> : <span className="chip">提案</span>}<small>{r.b}行目</small></div>
              <p><Rich text={c.text} /></p>
              {onFix && !fixed && <div className="rf"><button type="button" className="btn ghost" onClick={() => onFix(c)}>コードを直す</button></div>}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------- 本体 ---------- */
export default function CaseFlow({ item, premium, back, progress, onReload }) {
  const rec = item.progress || {};
  const t = item.ticket || {};
  const isServlet = item.runtime === "servlet";
  const sv = item.servlet || {};
  const tests = item.tests || [];
  const status = rec.status || "";
  const approved = status === "approved";
  const reviewed = status === "returned" || status === "submitted" || status === "skipped" || approved;
  const hasSpec = (item.spec?.rules || []).length > 0 || (item.spec?.fields || []).length > 0 || (isServlet && sv.pageHtml);
  const fileName = isServlet ? `${(String(rec.code || item.starterCode || "").match(/public\s+(?:final\s+)?class\s+(\w+)/) || [])[1] || "Main"}.java` : FILE_NAME[item.runtime] || "main";

  const STEPS = useMemo(() => [
    ["assign", "アサイン"], ["ticket", "チケット"], ...(hasSpec ? [["spec", "仕様"]] : []), ["code", "実装"],
    ...(isServlet || item.runtime === "web" || item.runtime === "jsweb" || item.runtime === "sql" ? [["check", "動作確認"]] : []), ["test", "テスト"], ["pr", "プルリク"], ["review", "レビュー"], ["done", "完了"],
  ], [hasSpec, isServlet, item.runtime]);
  const idx = id => STEPS.findIndex(s => s[0] === id);

  const [accepted, setAccepted] = useState(!!rec.acceptedAt);
  const [step, setStep] = useState(() => idx(!rec.acceptedAt ? "assign" : approved ? "done" : reviewed ? "review" : "code"));
  const [code, setCode] = useState(rec.code ?? item.starterCode ?? "");
  const [file, setFile] = useState("main");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [compile, setCompile] = useState(null);       // { error, diag }
  const [check, setCheck] = useState(null);           // 動作確認：{ html, status, error, errorLine }
  const [tlog, setTlog] = useState([]);
  const [testRun, setTestRun] = useState(null);       // { code, results: [{ name, ok, got }] }
  const [pr, setPr] = useState(() => rec.pr || { title: `${t.id ? `${t.id} ` : ""}${item.title}`, body: `## 対応したチケット\n${t.id || item.title}\n\n## 変更内容\n- \n\n## 確認したこと\n- テスト仕様書 すべて ○\n\n## 見てほしいところ\n- ` });
  const [chat, setChat] = useState(rec.chat || []);
  // HTML＋JavaScript の動作確認（見える枠からの console・alert・エラー）
  // SQL：動作確認で流した結果と、流したあとのテーブルの中身
  const [sqlRun, setSqlRun] = useState(null);
  const sqlTables = useSqlTables(item.runtime === "sql" ? item.sqlSetup || "" : null, sqlRun?.ran || "", sqlRun?.at || 0);
  const sqlWordList = useMemo(() => sqlWords(sqlTables), [sqlTables]);
  async function runSqlCheck() {
    const r = await runSql(code, [], item.sqlSetup || "");
    if (!alive.current) return;
    setSqlRun({ ...r, ran: code, at: Date.now() });
    setCheck({ status: r.error ? "ERROR" : "OK", sql: true });
  }
  const [jsRun, setJsRun] = useState(() => ({ at: Date.now(), token: `cf-${Date.now()}` }));
  const [jsLogs, setJsLogs] = useState([]);
  useEffect(() => {
    if (item.runtime !== "jsweb") return undefined;
    const on = e => {
      const m = e.data;
      if (!m || m.__djs !== jsRun.token || m.t === "done") return;
      setJsLogs(l => [...l, m.t === "error" && m.d && typeof m.d === "object" ? { t: "error", s: m.d.msg, line: m.d.line || 0 } : { t: m.t, s: String(m.d) }].slice(-200));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [jsRun.token, item.runtime]);
  const [to, setTo] = useState(rec.acceptedAt ? "lead" : "pm");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatErr, setChatErr] = useState("");
  const [chatOpen, setChatOpen] = useState(() => typeof window === "undefined" || !window.matchMedia("(max-width: 820px)").matches);
  const frame = useRef(null);
  const resFrame = useRef(null);
  const logRef = useRef(null);
  const askRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [chat, sending]);
  // 工程を変えたら上に戻し、横に流れる工程の帯は今の工程が見える位置へ
  const stepsRef = useRef(null);
  useEffect(() => {
    const bar = stepsRef.current, cur = bar?.querySelector('[aria-current="step"]');
    if (bar && cur) bar.scrollTo({ left: Math.max(0, cur.offsetLeft - bar.clientWidth / 2 + cur.offsetWidth / 2) });
    window.scrollTo({ top: 0 });
  }, [step]);

  const testsOk = !!testRun && testRun.code === code && testRun.results.length > 0 && testRun.results.every(r => r.ok);
  const changed = code !== (item.starterCode || "");
  const stepOf = id => {
    if (id === "assign") return accepted ? "done" : "wait";
    if (!accepted) return "";
    if (id === "ticket" || id === "spec") return "done";
    if (id === "code") return changed ? "done" : "";
    if (id === "check") return check ? "done" : "";
    if (id === "test") return testsOk || reviewed ? "done" : testRun ? "wait" : "";
    if (id === "pr") return rec.submittedAt ? "done" : "";
    if (id === "review") return approved ? "done" : reviewed ? "wait" : "";
    if (id === "done") return approved ? "done" : "";
    return "";
  };
  const cur = STEPS[step]?.[0] || "assign";

  // 書きかけのコードを残す（失敗しても作業は続けられる）
  const saveDraft = c => { if (!approved) apiPut(`/tenolab/progress/case/${encodeURIComponent(item.id)}`, { status: "doing", code: c }).then(r => progress?.upsert?.(r?.item)).catch(() => {}); };

  async function accept() {
    if (busy) return;
    setBusy("accept"); setErr("");
    try {
      await acceptCase(item.id);
      setAccepted(true); setTo("lead");
      setStep(idx("ticket"));
      progress?.reload?.();
      onReload();
    } catch (e) { setErr(e?.errorMessage || "引き受けられませんでした。もう一度お試しください。"); }
    finally { setBusy(""); }
  }

  async function runServletOnce({ checks = [], withTests = false }) {
    const r = await runCaseServlet(item.id, { code, checks, tests: withTests });
    if (!r.compiled) {
      const diag = parseJavacError(r.compileError);
      setCompile({ error: r.compileError, diag });
      setTlog(l => [...l, { k: "e", s: "コンパイルエラー" }]);
      return null;
    }
    setCompile(null);
    return r;
  }

  // 動作確認：フォームの送信を受けて Servlet を動かし、結果の HTML を出す
  async function submitForm(qs) {
    if (busy) return;
    setBusy("check"); setErr("");
    setTlog(l => [...l, { k: "", s: `${(sv.method || "post").toUpperCase()} ${sv.path || "/"}  ${paramsLabel(qs)}` }]);
    try {
      const r = await runServletOnce({ checks: [qs] });
      if (!alive.current || !r) return;
      const x = r.checks?.[0] || {};
      setCheck({ ...x });
      setTlog(l => [...l, x.status === "ERROR" ? { k: "e", s: `重大: ${x.error}${x.errorLine ? `\n\tat ${fileName}:${x.errorLine}` : ""}` } : { k: "g", s: `→ ${x.status === "302" ? `302 ${x.redirect}` : x.status}` }]);
      saveDraft(code);
    } catch (e) { setErr(e?.errorMessage || "動かせませんでした。時間をおいてお試しください。"); }
    finally { if (alive.current) setBusy(""); }
  }
  // フォームの送信は、画面の中の iframe（スクリプトなし）からここで受ける
  function bindForm() {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll("form").forEach(f => f.addEventListener("submit", e => {
      e.preventDefault();
      const fd = new FormData(f, e.submitter || undefined);
      submitForm(new URLSearchParams(fd).toString());
    }));
  }

  async function runTests() {
    if (busy) return;
    setBusy("test"); setErr("");
    try {
      if (isServlet) {
        const r = await runServletOnce({ withTests: true });
        if (!alive.current) return;
        setTestRun({ code, results: r ? r.tests || [] : tests.map(x => ({ name: x.name, ok: false, got: "コンパイルエラー" })) });
      } else {
        const r = await runCode(item.runtime, code, tests, { frame: frame.current, sqlSetup: item.sqlSetup });
        if (!alive.current) return;
        setTestRun({ code, results: r.results.map(x => ({ ...x, got: r.error || "" })) });
      }
      saveDraft(code);
    } catch (e) { setErr(e?.errorMessage || "テストを実行できませんでした。時間をおいてお試しください。"); }
    finally { if (alive.current) setBusy(""); }
  }

  async function openPr() {
    if (busy || !testsOk) return;
    setBusy("pr"); setErr("");
    try {
      await submitCase(item.id, { code, testResults: testRun.results.map(r => ({ name: r.name, ok: r.ok })), pr });
      progress?.reload?.();
      await onReload();
      if (alive.current) setStep(idx("review"));
    } catch (e) {
      setErr(e?.status === 409 ? "この案件体験はもう承認されています。画面を読み込み直してください。" : e?.errorMessage || "プルリクを出せませんでした。通信状況を確かめて、もう一度お試しください。");
    } finally { if (alive.current) setBusy(""); }
  }
  async function skip() {
    if (busy || !window.confirm("承認を待たずに、先に進みます。あとからもう一度プルリクを出して承認をもらうこともできます。")) return;
    setBusy("skip");
    try { await skipCase(item.id); progress?.reload?.(); await onReload(); }
    catch (e) { setErr(e?.errorMessage || "先に進めませんでした。もう一度お試しください。"); }
    finally { if (alive.current) setBusy(""); }
  }

  async function send(message, dest = to) {
    const v = String(message || "").trim();
    if (!v || sending) return;
    setSending(true); setChatErr(""); setText("");
    const optimistic = { who: "me", to: dest, text: v, at: new Date().toISOString(), pending: true };
    setChat(c => [...c, optimistic]);
    try {
      const last = check?.error ? `${check.error}${check.errorLine ? `（${check.errorLine}行目）` : ""}` : compile?.error ? compile.error.slice(0, 800) : "";
      const r = await sendCaseChat(item.id, { to: dest, message: v, step: STEPS[step]?.[1], code: dest === "client" ? "" : code, tests: (testRun?.results || []).map(x => ({ name: x.name, ok: x.ok })), run: last });
      setChat(c => [...c.filter(x => x !== optimistic), ...(r?.messages || [])]);
    } catch (e) {
      setChat(c => c.filter(x => x !== optimistic));
      setText(v);
      setChatErr(e?.errorMessage || "送れませんでした。もう一度送ってください。");
    } finally { setSending(false); }
  }
  const openChat = (dest, draft) => { setTo(dest); setChatOpen(true); if (draft != null) setText(draft); setTimeout(() => askRef.current?.focus(), 0); };

  const grade = rec.grade || {};
  const comments = grade.comments || [];
  const rounds = (rec.reviews || []).length || rec.attempts || 0;
  const dueChip = rec.dueAt ? <span className="chip warn">期限 {dueLabel(rec.dueAt)}・管理者から</span> : rec.assignedAt ? <span className="chip warn">管理者から</span> : null;

  // ---- 右のチャット ----
  const seed = [
    { who: "pm", text: `@あなた ${item.title} をお願いしたいです。${rec.dueAt ? `期限は ${dueLabel(rec.dueAt)} です。` : "空いた時間に進めてください。"}` },
    ...(accepted ? [{ who: "lead", text: "わからないところは早めに聞いてください。宛先を選んで送れます。" }] : []),
  ];
  const SUGG = {
    assign: [["pm", "どれくらいの作業量を想定していますか？"], ["pm", "レビューはどなたですか？"]],
    ticket: [["client", "この内容で決まっていないところを確認したいです"], ["lead", "どのファイルを触ればいいですか？"]],
    spec: [["client", "空の入力はどう扱いますか？"], ["lead", "どのファイルを触ればいいですか？"]],
    code: [["lead", "どこから手を付ければいいですか？"], ["pm", "進捗：実装中です"]],
    check: [["lead", "このエラーの意味を教えてください"], ["pm", "進捗：動作確認中です"]],
    test: [["lead", "境界値はどこを見ればいいですか？"], ["pm", "進捗：テスト中です"]],
    pr: [["lead", "プルリクの説明はこれで足りていますか？"], ["pm", "進捗：プルリクを出します"]],
    review: [["lead", "レビューのコメントの意味を確認したいです"], ["pm", "進捗：レビュー対応中です"]],
    done: [["pm", "完了しました。ありがとうございました"]],
  };
  const chatPanel = (
    <aside className={`cf-chat ${chatOpen ? "" : "closed"}`} aria-label="チャット">
      <div className="ch"><b># {t.id ? t.id.replace(/^#/, "").toLowerCase() : "案件"}</b><span className="aitag">AI</span>
        <span className="members">{["pm", "lead", "client"].map(w => <Av key={w} who={w} small />)}</span>
        <button type="button" className="x" onClick={() => setChatOpen(false)} aria-label="閉じる">×</button></div>
      <div className="log" ref={logRef} aria-live="polite">
        {[...seed, ...chat].map((m, k) => (
          <div key={k} className={`m ${m.who === "me" ? "me" : ""}`}>
            <Av who={m.who} />
            <div>
              <div className="who">{m.who === "client" ? `お客さま${t.client ? `（${t.client}）` : ""}` : PEOPLE[m.who]?.n}{m.who !== "me" && <span className="aitag">AI</span>}<small>{hm(m.at)}</small></div>
              <div className="tx">{m.who === "me" && m.to ? <b className="at">@{PEOPLE[m.to]?.n} </b> : null}<Rich text={m.text} /></div>
            </div>
          </div>
        ))}
        {sending && <div className="m"><Av who={to} /><div><div className="who">{PEOPLE[to]?.n}</div><div className="typing"><i /><i /><i /></div></div></div>}
      </div>
      <div className="sugg">
        <button type="button" className="tpl" onClick={() => { setText(TPL); askRef.current?.focus(); }}>質問テンプレ</button>
        {(SUGG[cur] || []).map(([w, s]) => <button key={s} type="button" disabled={sending} onClick={() => { setTo(w); send(s, w); }}>@{PEOPLE[w].n} {s}</button>)}
      </div>
      <div className="to" role="group" aria-label="宛先">宛先 {["lead", "pm", "client"].map(w => <button key={w} type="button" aria-pressed={to === w} onClick={() => setTo(w)}>@{PEOPLE[w].n}</button>)}</div>
      {chatErr && <div className="cerr" role="alert">{chatErr}</div>}
      <form className="compose" onSubmit={e => { e.preventDefault(); send(text); }}>
        <textarea ref={askRef} rows={2} value={text} placeholder={`@${PEOPLE[to].n} へ送る`} aria-label="メッセージ" onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); } }} />
        <button className="btn" type="submit" disabled={sending || !text.trim()}>送る</button>
      </form>
    </aside>
  );

  // ---- 各工程 ----
  const props = (
    <dl className="cf-props">
      {t.id && <div><dt>チケット</dt><dd className="mono">{t.id}</dd></div>}
      {t.client && <div><dt>お客さま</dt><dd>{t.client}</dd></div>}
      <div><dt>担当</dt><dd>あなた</dd></div>
      <div><dt>レビュー</dt><dd>リーダー</dd></div>
      {rec.dueAt && <div><dt>期限</dt><dd className="due">{dueLabel(rec.dueAt)}</dd></div>}
      {item.hours ? <div><dt>目安</dt><dd>{item.hours}時間</dd></div> : null}
      <div><dt>技術</dt><dd>{RUNTIME_LABEL[item.runtime] || item.runtime}</dd></div>
    </dl>
  );

  let view = null;
  if (cur === "assign") {
    view = (
      <section className="cf-panel">
        <div className="ph"><span className={`kind ${KIND[t.kind]?.[1] || "feat"}`}>{KIND[t.kind]?.[0] || "機能追加"}</span>{t.id && <span className="chip">{t.id}</span>}<span className="sp" />
          {accepted ? <span className="chip ok">アサイン済み</span> : <span className="chip warn">{rec.assignedAt ? "管理者から割り当て" : "依頼が来ています"}</span>}</div>
        <div className="cf-kick">
          <div className="cf-col">
            <div className="cf-cm"><Av who="pm" /><div><div className="who">PM<span className="aitag">AI</span></div><p>{item.summary || item.title}</p></div></div>
            <div className="ph">
              {accepted ? <><span className="sp" /><button type="button" className="btn" onClick={() => setStep(idx("ticket"))}>チケットへ</button></>
                : <><button type="button" className="btn ghost" onClick={() => openChat("pm")}>PMに質問</button><span className="sp" /><button type="button" className="btn dark" onClick={accept} disabled={!!busy}>{busy === "accept" ? "引き受けています…" : "引き受ける"}</button></>}
            </div>
          </div>
          {props}
        </div>
      </section>
    );
  } else if (cur === "ticket") {
    view = (
      <section className="cf-panel">
        <div className="cf-tk">
          <div className="cf-col">
            <div className="ph"><span className={`kind ${KIND[t.kind]?.[1] || "feat"}`}>{KIND[t.kind]?.[0] || "機能追加"}</span>{reviewed ? <span className={`chip ${approved ? "ok" : ""}`}>{approved ? "完了" : "対応中"}</span> : <span className="chip">対応中</span>}</div>
            <h2>{item.title}</h2>
            {t.background && <div><div className="eyebrow">背景</div><p className="pre">{t.background}</p></div>}
            {(t.scope || []).length > 0 && <div><div className="eyebrow">やること</div><ul>{t.scope.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
            {(t.done || []).length > 0 && <div><div className="eyebrow">完了条件</div><ul className="cf-ac">{t.done.map((s, i) => <li key={i} className={approved ? "ok" : ""}>{s}</li>)}</ul></div>}
            {t.notes && <div><div className="eyebrow">参考</div><p className="pre">{t.notes}</p></div>}
            {(t.comments || []).length > 0 && (
              <div className="cf-cmts">{t.comments.map((c, i) => (
                <div key={i} className="cf-cm"><Av who={c.who} /><div><div className="who">{c.who === "client" ? `お客さま${t.client ? `（${t.client}）` : ""}` : PEOPLE[c.who]?.n}<span className="aitag">AI</span></div><p className="pre">{c.text}</p></div></div>
              ))}</div>
            )}
          </div>
          {props}
        </div>
      </section>
    );
  } else if (cur === "spec") {
    const sp = item.spec || {};
    view = (
      <section className="cf-panel">
        <div className="ph"><h2>仕様書</h2>{isServlet && sv.pageName && <span className="chip mono">{sv.pageName}</span>}</div>
        <div className="cf-spec">
          {isServlet && sv.pageHtml && <div className="cf-browser mini"><div className="chrome"><span className="dots"><i /><i /><i /></span><span className="url">画面イメージ</span></div>
            <iframe title="画面イメージ" srcDoc={sv.pageHtml} sandbox="" /></div>}
          {(sp.rules || []).length > 0 && <div className="cf-col sm"><div className="eyebrow">ルール</div><ul className="cf-rules">{sp.rules.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
        </div>
        {(sp.fields || []).length > 0 && (
          <div className="cf-scroll"><table className="cf-tbl">
            <thead><tr><th>項目</th><th>name</th><th>型</th><th>空のとき</th></tr></thead>
            <tbody>{sp.fields.map((f, i) => <tr key={i}><td>{f.label}</td><td>{f.name ? <code>{f.name}</code> : "－"}</td><td>{f.type || "－"}</td><td>{f.empty || "－"}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    );
  } else if (cur === "code") {
    const diag = compile?.diag;
    view = (
      <section className="cf-ws">
        <div className="wbar">
          <button type="button" className="ftab java" aria-selected={file === "main"} onClick={() => setFile("main")}><i />{fileName}</button>
          {isServlet && sv.pageHtml && <button type="button" className="ftab html" aria-selected={file === "page"} onClick={() => setFile("page")}><i />{sv.pageName || "index.html"}<small>参考</small></button>}
          <span className="sp" />
          <button type="button" className="xbtn sub" onClick={() => { if (window.confirm("はじめのコードに戻します。よろしいですか？")) { setCode(item.starterCode || ""); setCompile(null); } }} disabled={approved}>最初に戻す</button>
          {(isServlet || item.runtime === "web" || item.runtime === "jsweb" || item.runtime === "sql") && <button type="button" className="xbtn go" onClick={() => { setStep(idx("check")); if (item.runtime === "sql") runSqlCheck(); }}>{isServlet ? "サーバーで実行" : item.runtime === "jsweb" || item.runtime === "sql" ? "動かして確かめる" : "表示を確かめる"}</button>}
          {!isServlet && item.runtime !== "web" && item.runtime !== "jsweb" && item.runtime !== "sql" && <button type="button" className="xbtn go" onClick={() => setStep(idx("test"))}>テストへ</button>}
        </div>
        {isServlet && sv.filePath && <div className="cf-path mono">{file === "main" ? sv.filePath : "src/main/webapp/"}</div>}
        <div className="cf-ed">
          {file === "page" ? <pre className="cf-ro">{sv.pageHtml}</pre>
            : (isServlet || item.runtime === "java")
              ? <JavaEditor key={`${item.id}-main`} value={code} onChange={approved ? () => {} : setCode} readOnly={approved} diagnostic={diag && diag.file === fileName ? diag : null} level={1} />
              : item.runtime === "sql"
                ? <JavaEditor key={`${item.id}-sql`} lang="sql" words={sqlWordList} value={code} onChange={approved ? () => {} : setCode} readOnly={approved} />
              : item.runtime === "web" || item.runtime === "jsweb"
                ? <WebEditor key={`${item.id}-html`} mode="html" value={code} onChange={approved ? () => {} : setCode} readOnly={approved} level={1} />
                : <div className="cf-plain"><Editor value={code} onChange={approved ? () => {} : setCode} label={fileName} readOnly={approved} minHeight={360} /></div>}
        </div>
        {compile && <pre className="cf-term e">{compile.error}</pre>}
        <div className="cf-sbar"><span>{RUNTIME_LABEL[item.runtime]}</span><span>{changed ? "● 変更あり" : "変更なし"}</span><span className="sp" /><span>TODO {(code.match(/TODO/g) || []).length}</span></div>
      </section>
    );
  } else if (cur === "check" && item.runtime === "sql") {
    view = (
      <>
        <section className="cf-panel">
          <div className="ph"><span className="eyebrow">実行結果</span><span className="sp" />
            {sqlRun && !sqlRun.error && <span className="chip">{sqlRun.set ? `${sqlRun.set.values.length}行` : "実行しました"}</span>}
            <button type="button" className="btn" onClick={runSqlCheck}>▶ 実行</button></div>
          {!sqlRun && <p className="muted" style={{ margin: 0 }}>▶ 実行 で、書いたSQLを流します</p>}
          {sqlRun?.error && <pre className="cf-log"><span className="e">✕ {sqlRun.error}</span></pre>}
          {sqlRun && !sqlRun.error && sqlRun.set && <SqlGrid set={sqlRun.set} light />}
          {sqlRun && !sqlRun.error && sqlRun.set && !sqlRun.set.values.length && <p className="muted" style={{ margin: 0 }}>（0行）</p>}
          {sqlRun && !sqlRun.error && !sqlRun.set && <p className="muted" style={{ margin: 0 }}>結果を返さない文だけを実行しました。下のテーブルで中身を見られます</p>}
          {sqlRun?.error && <button type="button" className="btn ghost" style={{ justifySelf: "start" }} onClick={() => openChat("lead", `【やりたいこと】動作確認\n【困っていること】${sqlRun.error}\n【自分の考え】`)}>リーダーに聞く</button>}
        </section>
        <section className="cf-panel tight cf-db">
          <SqlTables tables={sqlTables} code={`${sqlRun?.ran || ""} ${item.starterCode || ""}`} after={!!sqlRun?.ran && /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(sqlRun.ran)} />
        </section>
      </>
    );
  } else if (cur === "check") {
    const url = `http://localhost:8080${sv.path ? "" : ""}/${(sv.pageName || "index.html")}`;
    view = (
      <>
        <div className="cf-browser">
          <div className="chrome"><span className="dots"><i /><i /><i /></span>
            {check && isServlet ? <button type="button" className="nav" onClick={() => setCheck(null)} aria-label="戻る">←</button> : null}
            <span className="url">{check && isServlet ? `http://localhost:8080${sv.path}` : url}</span>
            {busy === "check" && <span className="muted" style={{ fontSize: 12 }}>送信中…</span>}</div>
          {isServlet ? (
            <>
              <iframe ref={frame} title="画面" srcDoc={sv.pageHtml} sandbox="allow-same-origin allow-forms" onLoad={bindForm} style={check ? { display: "none" } : undefined} />
              {check && (check.status === "ERROR"
                ? <div className="cf-500"><h3>HTTPステータス 500 – Internal Server Error</h3><p className="mono">{check.error}</p>{check.errorLine ? <p className="mono">at {fileName}:{check.errorLine}</p> : null}</div>
                : <iframe ref={resFrame} title="結果" srcDoc={`<!doctype html><meta charset="utf-8"><body style="font-family:'Yu Gothic UI',Meiryo,sans-serif;padding:16px">${check.html || ""}</body>`} sandbox="" />)}
            </>
          ) : item.runtime === "jsweb" ? (
            <iframe key={jsRun.at} title="表示" srcDoc={buildJsDocument({ html: code, token: jsRun.token })} sandbox="allow-scripts allow-modals allow-forms" />
          ) : (
            <iframe ref={frame} title="表示" srcDoc={code} sandbox="allow-same-origin" />
          )}
        </div>
        {item.runtime === "jsweb" && (
          <section className="cf-panel tight">
            <div className="ph"><span className="eyebrow">コンソール</span><span className="sp" /><button type="button" className="btn ghost" onClick={() => { setJsLogs([]); setJsRun({ at: Date.now(), token: `cf-${Date.now()}` }); }}>読み込み直す</button></div>
            <pre className="cf-log">{jsLogs.length ? jsLogs.map((l, k) => <span key={k} className={l.t === "error" ? "e" : ""}>{l.t === "alert" ? "⚠ alert: " : l.t === "error" ? "✕ " : "› "}{l.s}{l.line ? `（${l.line}行目）` : ""}{"\n"}</span>) : "（出力なし）"}</pre>
            {jsLogs.some(l => l.t === "error") && <button type="button" className="btn ghost" style={{ justifySelf: "start" }} onClick={() => openChat("lead", `【やりたいこと】動作確認\n【困っていること】${jsLogs.find(l => l.t === "error").s}\n【自分の考え】`)}>リーダーに聞く</button>}
          </section>
        )}
        {isServlet && (
          <section className="cf-panel tight">
            <div className="ph"><span className="eyebrow">Tomcat ログ</span><span className="sp" />{compile ? <span className="chip ng">コンパイルエラー</span> : tlog.length ? <span className="chip ok">起動中</span> : <span className="chip">フォームから送信</span>}
              {compile && <button type="button" className="btn ghost" onClick={() => setStep(idx("code"))}>コードへ</button>}</div>
            <pre className="cf-log">{compile ? compile.error : tlog.length ? tlog.map((l, k) => <span key={k} className={l.k}>{l.s}{"\n"}</span>) : `${(sv.method || "post").toUpperCase()} ${sv.path || "/"} を待っています`}</pre>
            {(check?.status === "ERROR" || compile) && <button type="button" className="btn ghost" style={{ justifySelf: "start" }} onClick={() => openChat("lead", `【やりたいこと】動作確認\n【困っていること】${compile ? "コンパイルエラーが出ます" : `${check.error}${check.errorLine ? `（${check.errorLine}行目）` : ""}`}\n【自分の考え】`)}>リーダーに聞く</button>}
          </section>
        )}
      </>
    );
  } else if (cur === "test") {
    const res = testRun?.results;
    const stale = testRun && testRun.code !== code;
    const okN = res ? res.filter(r => r.ok).length : 0;
    view = (
      <section className="cf-panel">
        <div className="ph"><h2>テスト仕様書</h2>{t.id && <span className="chip">{t.id}</span>}<span className="sp" />
          {res && !stale && <><b className={`cf-big ${okN === tests.length ? "ok" : "ng"}`}>{okN} / {tests.length}</b><span className={`chip ${okN === tests.length ? "ok" : "ng"}`}>{okN === tests.length ? "すべて ○" : `× ${tests.length - okN}件`}</span></>}
          {stale && <span className="chip warn">コードが変わりました</span>}
          <button type="button" className="btn" onClick={runTests} disabled={!!busy || approved}>{busy === "test" ? "実行しています…" : "テストを実行"}</button>
          {reviewed && !approved && testsOk && <button type="button" className="btn ghost" onClick={() => setStep(idx("pr"))}>プルリクへ</button>}</div>
        {!isServlet && item.runtime === "web" && <iframe ref={frame} title="表示" sandbox="allow-same-origin" className="cf-hidden" />}
        <div className="cf-scroll"><table className="cf-tbl">
          <thead><tr><th>No</th><th>観点</th>{isServlet && <th>入力</th>}{isServlet && <th>期待する結果</th>}<th>実際</th><th>結果</th></tr></thead>
          <tbody>{tests.map((x, i) => {
            const r = !stale ? res?.[i] : null;
            return (
              <tr key={i} className={r && !r.ok ? "x" : ""}>
                <td className="c mono">{i + 1}</td><td>{x.name}</td>
                {isServlet && <td className="mono sm">{paramsLabel(x.params)}</td>}
                {isServlet && <td className="mono sm">{String(x.expect || "").split("\n").filter(Boolean).join(" / ")}</td>}
                <td className={`mono sm ${r && !r.ok ? "ngt" : ""}`}>{r ? (r.got || (r.ok ? "期待どおり" : "－")).split("\n").join(" / ") : "－"}</td>
                <td className={`c res ${r ? (r.ok ? "o" : "x") : ""}`}>{r ? (r.ok ? "○" : "×") : ""}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
        {compile && <pre className="cf-term e">{compile.error}</pre>}
      </section>
    );
  } else if (cur === "pr") {
    const done = !!rec.submittedAt && !reviewed;
    const again = reviewed && !approved;
    view = (
      <section className="cf-panel">
        <div className="ph"><h2>プルリクエスト</h2>{rec.submittedAt ? <span className="chip ok">作成済み</span> : <span className="chip">下書き</span>}</div>
        <div className="cf-to"><span className="mono">feature/{(t.id || item.id).replace(/^#/, "")}</span>→<span className="mono">develop</span><span className="sp" />レビュー <span className="chip">リーダー</span></div>
        <label className="eyebrow" htmlFor="cf-prt">タイトル</label>
        <input id="cf-prt" className="cf-in" value={pr.title} onChange={e => setPr({ ...pr, title: e.target.value })} disabled={approved} />
        <label className="eyebrow" htmlFor="cf-prb">説明</label>
        <textarea id="cf-prb" className="cf-in mono" rows={10} value={pr.body} onChange={e => setPr({ ...pr, body: e.target.value })} disabled={approved} />
        <DiffView before={item.starterCode || ""} after={code} fileName={fileName} />
        <div className="ph"><span className="sp" />
          {!testsOk && !approved && <><span className="chip warn">テスト仕様書 すべて ○ → 依頼できる</span><button type="button" className="btn ghost" onClick={() => setStep(idx("test"))}>テストへ</button></>}
          {!approved && <button type="button" className="btn dark" onClick={openPr} disabled={!testsOk || !!busy || done}>{busy === "pr" ? "レビュー中…" : again ? "修正を push して再レビューを依頼" : "レビューを依頼"}</button>}
        </div>
      </section>
    );
  } else if (cur === "review") {
    if (!rec.submittedAt) {
      view = <section className="cf-panel"><div className="cf-state wait">プルリク → レビュー依頼 → ここに結果</div><div className="ph"><span className="sp" /><button type="button" className="btn ghost" onClick={() => setStep(idx("pr"))}>プルリクへ</button></div></section>;
    } else {
      const must = comments.filter(c => c.must).length;
      view = (
        <section className="cf-panel">
          <div className="ph"><h2>{pr.title || item.title}</h2><span className="chip">レビュー {rounds}回目</span></div>
          <div className={`cf-state ${approved ? "ok" : status === "returned" ? "req" : "wait"}`}>
            {approved ? "✓ " : ""}{VERDICT[status] || "レビュー中"}{status === "returned" ? `　${comments.length}件${must ? `（必須 ${must}）` : ""}` : ""}<span className="sp" /><Av who="lead" small />リーダー
          </div>
          {rec.aiReview && <div className="cf-cm"><Av who="lead" /><div><div className="who">リーダー<span className="aitag">AI</span><small>{hm(rec.submittedAt)}</small></div><p className="pre"><Rich text={rec.aiReview} /></p></div></div>}
          <DiffView before={item.starterCode || ""} after={rec.code || ""} fileName={fileName} comments={comments} fixed={approved}
            onFix={status === "returned" ? () => { setStep(idx("code")); } : null} />
          {(grade.results || []).length > 0 && (
            <div className="cf-col sm"><div className="eyebrow">レビューで見たところ</div>
              <ul className="cf-ac">{grade.results.map((r, i) => <li key={i} className={r.met ? "ok" : "ng"}>{r.text}{r.must && <span className="chip ng" style={{ marginLeft: 6 }}>必須</span>}{r.note && <small><Rich text={r.note} /></small>}</li>)}</ul></div>
          )}
          {rec.review?.comment && <div className="cf-cm"><Av who="pm" /><div><div className="who">管理者</div><p className="pre">{rec.review.comment}</p></div></div>}
          <div className="ph"><span className="sp" />
            {status === "returned" && <><button type="button" className="btn ghost" onClick={() => openChat("lead", "")}>リーダーに返信</button><button type="button" className="btn" onClick={() => setStep(idx("code"))}>コードを直す</button></>}
            {status === "submitted" && <button type="button" className="btn" onClick={() => setStep(idx("pr"))}>もう一度レビューを依頼</button>}
            {rec.canSkip && <button type="button" className="btn ghost" onClick={skip} disabled={!!busy}>先に進む</button>}
            {approved && <button type="button" className="btn dark" onClick={() => setStep(idx("done"))}>マージ</button>}
          </div>
        </section>
      );
    }
  } else if (cur === "done") {
    const mins = rec.acceptedAt && rec.submittedAt ? Math.max(1, Math.round((Date.parse(rec.submittedAt) - Date.parse(rec.acceptedAt)) / 60000)) : 0;
    const asks = chat.filter(m => m.who === "me").length;
    view = !approved ? <section className="cf-panel"><div className="cf-state wait">レビューで承認 → マージ → 完了</div></section> : (
      <section className="cf-panel">
        <div className="cf-hero"><div className="cf-stamp">完了</div><div className="cf-col sm"><h2>{item.title}</h2>
          <div className="ph"><span className="chip ok">マージ済み</span>{rec.estimate && <span className="chip">見積もり {rec.estimate}</span>}{mins ? <span className="chip">アサインから {mins >= 60 ? `${Math.floor(mins / 60)}時間${mins % 60}分` : `${mins}分`}</span> : null}<span className="chip">レビュー {rounds}回</span><span className="chip">質問 {asks}回</span></div></div></div>
        {(grade.results || []).length > 0 && <div className="cf-score">{grade.results.map((r, i) => <div key={i} className={r.met ? "ok" : ""}><b>{r.met ? "✓ " : ""}{r.text}</b>{r.note && <small><Rich text={r.note} /></small>}</div>)}</div>}
        {rec.aiReview && <div className="cf-cm"><Av who="lead" /><div><div className="who">リーダー<span className="aitag">AI</span></div><p className="pre"><Rich text={rec.aiReview} /></p></div></div>}
        <div className="ph"><span className="sp" /><button type="button" className="btn ghost" onClick={() => back("#/cases")}>案件体験へ</button></div>
      </section>
    );
  }

  const locked = !accepted;
  return (
    <div className="cf">
      <Back onClick={() => back("#/cases")} />
      <div className="cf-head">
        {t.id && <span className="tid">{t.id}</span>}<h1>{item.title}</h1>
        <div className="meta"><span className={`kind ${KIND[t.kind]?.[1] || "feat"}`}>{KIND[t.kind]?.[0] || "機能追加"}</span><span className="chip"><i className="dot" />{RUNTIME_LABEL[item.runtime] || item.runtime}</span>{dueChip}{accepted && <span className="branch">feature/{(t.id || item.id).replace(/^#/, "")}</span>}</div>
      </div>
      <nav className="cf-steps" aria-label="案件の流れ" ref={stepsRef}>
        {STEPS.map(([id, label], i) => {
          const st = stepOf(id);
          const dis = locked && i > idx(hasSpec ? "spec" : "ticket");
          return (
            <React.Fragment key={id}>
              {i > 0 && <span className="ar" aria-hidden="true">→</span>}
              <button type="button" className={st} aria-current={i === step ? "step" : undefined} disabled={dis} onClick={() => setStep(i)}><i>{st === "done" ? "✓" : st === "wait" ? "!" : i + 1}</i>{label}</button>
            </React.Fragment>
          );
        })}
      </nav>
      <div className={`cf-layout ${chatOpen ? "" : "no-chat"}`}>
        <main className="cf-main">
          {view}
          {err && <div className="verdict ng" role="alert">{err}</div>}
        </main>
        {chatPanel}
      </div>
      <div className="cf-dock" role="toolbar" aria-label="案件の操作">
        <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>◀ <span className="lbl">前へ</span></button>
        <span className="pos">{step + 1} / {STEPS.length}　{STEPS[step]?.[1]}</span>
        <button type="button" className="next" onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1 || (locked && step >= idx(hasSpec ? "spec" : "ticket"))}><span className="lbl">次へ</span> ▶</button>
        <span className="sep" />
        <button type="button" aria-pressed={chatOpen} onClick={() => setChatOpen(v => !v)}>チャット</button>
      </div>
    </div>
  );
}
