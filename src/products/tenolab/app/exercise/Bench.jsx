import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiPost } from "../../../../api.js";
import JavaEditor from "../../../learning/JavaEditor.jsx";
import WebEditor from "../../../learning/WebEditor.jsx";
import { parseJavacError } from "../../../learning/javaEditorSupport.js";
import { previewDocument, runWebChecks } from "../../../learning/webChecks.js";
import { buildJsDocument, runJsPage, userLineOffset } from "./jsRunner.js";
import { querySet, runSqlChecks, sqlWords } from "./sqlRunner.js";
import { SqlGrid, SqlTables, useSqlTables } from "./SqlParts.jsx";
import JsTraceSample from "./Trace.jsx";
import "./bench.css";

/* 演習の作業台（モック tenolab-exercise.html、2026-10-09）。
   言語ごとに作業台を変える：Java＝エディタ＋コンソール＋期待する出力との比べ／HTML・CSS＝ファイルのタブ＋その場で変わるプレビュー（PC／スマホ）。
   コードについて聞くのは右のAIチャット（LessonView）にまとめた。ここは onContext で「いまのコードと結果」を渡し、
   エラーの「AIに聞く」は onAsk で右のチャットに質問を送る。
   実行・採点・記録は今までと同じ（/learning/exercises/java/run・webChecks・lrn.submitExercise）。
   編集部品（JavaEditor・WebEditor）は LMS と共通のものをそのまま使う。 */

export const BENCH_KINDS = new Set(["code_run", "web_run", "js_run", "sql_run"]);
const LANG = { code_run: { name: "Java 21", key: "java" }, web_run: { name: "HTML / CSS", key: "web" }, js_run: { name: "JavaScript", key: "js" }, sql_run: { name: "SQL", key: "sql" } };
const NARROW_W = 390;

// 集中モード（focus）のときは、課題の文と右の表示をたたんで書く場所を広くする（2026-10-13）
function useSide(focus) {
  const [side, setSide] = useState(!focus);
  useEffect(() => { setSide(!focus); }, [focus]);
  return [side, setSide];
}
function SideToggle({ side, setSide, label }) {
  return <button type="button" className="xb-btn sub" aria-pressed={side} onClick={() => setSide(v => !v)}>{side ? `${label}をたたむ` : `${label}を開く`}</button>;
}

// サンプル（navLabel「サンプル」・題が「サンプル」で始まる）は、まず1行ずつの動きを見せる（2026-10-15）。content.trace === false で今までどおり
export const isSampleSlide = s => !!s && (s.navLabel === "サンプル" || /^サンプル/.test(String(s.title || "")));
function JsSample(props) {
  const [mode, setMode] = useState(props.slide.content?.trace === false ? "edit" : "trace");
  if (mode === "edit") return <JsBench {...props} />;
  return <JsTraceSample slide={props.slide} onEdit={() => setMode("edit")} onFail={() => setMode("edit")} />;
}

export default function ExerciseBench(props) {
  if (props.slide.kind === "js_run") return isSampleSlide(props.slide) ? <JsSample {...props} /> : <JsBench {...props} />;
  if (props.slide.kind === "sql_run") return <SqlBench {...props} />;
  return props.slide.kind === "web_run" ? <WebBench {...props} /> : <JavaBench {...props} />;
}

function TaskCard({ slide, content, lang, checks, focus }) {
  const [open, setOpen] = useState(!focus);
  useEffect(() => { setOpen(!focus); }, [focus]);
  const text = content.task || content.intro;
  return (
    <section className={`xb-task ${lang.key} ${open ? "" : "min"}`}>
      <div className="tt"><span className="lang"><i />{lang.name}</span><h1>{slide.title}</h1>{content.minutes ? <span className="chip">約{content.minutes}分</span> : null}
        {text && <button type="button" className="xb-more" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? "課題をたたむ" : "課題を見る"}</button>}</div>
      {text && open && <p>{text}</p>}
      {checks.length > 0 && (
        <div className="xb-checks" aria-label="確かめること">
          {checks.map((c, k) => <span key={k} className={c.st || ""}><i>{c.st === "ok" ? "✓" : c.st === "ng" ? "!" : ""}</i>{c.t}</span>)}
        </div>
      )}
    </section>
  );
}

function StatusBar({ lang, left, caret }) {
  return (
    <div className={`xb-sbar ${lang.key}`}>
      <span className="st">{lang.name}</span>{left && <span>{left}</span>}
      <span className="sp" /><span>行 {caret.line}、列 {caret.col}</span><span>スペース: 2</span><span>UTF-8</span>
    </div>
  );
}

/* ---------- Java ---------- */
function JavaBench({ slide, lrn, course, lesson, onContext, onAsk, focus }) {
  const content = slide.content || {};
  const lang = LANG.code_run;
  const mainName = content.filename || "Main.java";
  const extra = useMemo(() => (Array.isArray(content.files) ? content.files.filter(f => f?.name && f.name !== mainName) : []), [content.files, mainName]);
  const [source, setSource] = useState(content.source || "");
  const [openFile, setOpenFile] = useState(mainName);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("out");
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const diagnostic = useMemo(() => (result && !result.compiled ? parseJavacError(result.compileError) : null), [result]);
  useEffect(() => { if (diagnostic?.file && diagnostic.file !== openFile) setOpenFile(diagnostic.file); }, [diagnostic]); // eslint-disable-line react-hooks/exhaustive-deps
  const expect = String(content.expect || "").trim();
  const stdout = String(result?.stdout || "").trim();
  const passed = Boolean(result?.compiled && !result.timedOut && result.exitCode === 0 && (!expect || stdout === expect));
  const output = result ? (result.compiled ? [result.stdout, result.stderr].filter(Boolean).join("\n") : result.compileError || "") : "";

  // 右のAIチャットに「いまのコードと結果」を渡す
  useEffect(() => {
    onContext?.({ language: "java", source, output, compiled: Boolean(result?.compiled), hasResult: Boolean(result), error: diagnostic ? `${diagnostic.line}行目` : "" });
  }, [source, output, result, diagnostic]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    if (running) return;
    setRunning(true); setErr(""); setResult(null);
    const payload = { files: [{ name: mainName, content: source }, ...extra.map(f => ({ name: f.name, content: f.content }))], entry: mainName, stdin: content.stdin || "" };
    try {
      let res = await apiPost("/learning/exercises/java/run", payload);
      if (res?.timedOut && res?.retryable) res = await apiPost("/learning/exercises/java/run", payload);
      if (!alive.current) return;
      setResult(res); setTab("out");
      const ok = Boolean(res?.compiled && !res.timedOut && res.exitCode === 0 && (!expect || String(res.stdout || "").trim() === expect));
      if (lrn?.submitExercise) lrn.submitExercise({ courseId: course.id, lessonId: lesson.id, slideId: slide.id, kind: "code_run", submittedAnswer: source, isCorrect: ok }).catch(() => {});
    } catch (e) {
      if (alive.current) setErr(e?.errorMessage || "コードを実行できませんでした。時間をおいてお試しください。");
    } finally { if (alive.current) setRunning(false); }
  }
  function reset() { setSource(content.source || ""); setOpenFile(mainName); setResult(null); setErr(""); }

  const checks = [
    { t: "コンパイルできる", st: !result ? "" : result.compiled ? "ok" : "ng" },
    ...(expect ? [{ t: "出力が期待どおり", st: !result ? "" : passed ? "ok" : "ng" }] : [{ t: "最後まで動く", st: !result ? "" : passed ? "ok" : "ng" }]),
  ];
  const editing = openFile === mainName;
  const fileText = editing ? source : extra.find(f => f.name === openFile)?.content || "";
  const expLines = expect.split("\n"), gotLines = stdout.split("\n");

  return (
    <div className="xb">
      <TaskCard focus={focus} slide={slide} content={content} lang={lang} checks={checks} />
      <section className="xb-ws java">
        <div className="xb-wbar">
          {[mainName, ...extra.map(f => f.name)].map(n => (
            <button key={n} type="button" className="ftab" aria-selected={openFile === n} onClick={() => setOpenFile(n)}><i />{n}{n !== mainName && <small>参考</small>}</button>
          ))}
          <span className="sp" />
          <button type="button" className="xb-btn sub" onClick={reset}>最初に戻す</button>
          <button type="button" className="xb-btn go" onClick={run} disabled={running}>{running ? "実行中…" : "▶ 実行"} <kbd>Ctrl+Enter</kbd></button>
        </div>
        <div className="xb-ed">
          <JavaEditor key={`${slide.id}-${openFile}`} value={fileText} onChange={editing ? setSource : () => {}} readOnly={!editing}
            diagnostic={diagnostic && diagnostic.file === openFile ? diagnostic : null} level={content.completionLevel || 1} onRun={run} onCaret={setCaret} />
        </div>
        <div className="xb-out">
          <div className="otabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "out"} onClick={() => setTab("out")}>出力</button>
            {content.stdin ? <button type="button" role="tab" aria-selected={tab === "in"} onClick={() => setTab("in")}>入力</button> : null}
            {expect ? <button type="button" role="tab" aria-selected={tab === "cmp"} onClick={() => setTab("cmp")}>期待する出力と比べる</button> : null}
            <span className="meta">{running ? "実行中…" : result ? (result.compiled ? `実行 ${((result.durationMs || 0) / 1000).toFixed(2)} 秒` : "コンパイルエラー") : "まだ動かしていません"}</span>
          </div>
          {tab === "in" ? <pre className="term">{content.stdin}</pre>
            : tab === "cmp" && expect ? (
              <div className="xb-diff">
                <div><h4>期待する出力</h4><pre>{expLines.map((l, k) => <span key={k} className="good">{l || " "}</span>)}</pre></div>
                <div><h4>あなたの出力</h4><pre>{result ? gotLines.map((l, k) => <span key={k} className={l === expLines[k] ? "good" : "bad"}>{l || " "}</span>) : <span className="pr">まだ動かしていません</span>}</pre></div>
              </div>
            ) : (
              <div className="term">
                {!result && !err && <span className="pr">$ java {mainName}{"\n"}▶ 実行 で動かします</span>}
                {err && <span className="e">{err}</span>}
                {result && !result.compiled && <><span className="pr">$ javac {mainName}{"\n"}</span><span className="e">{result.compileError}</span></>}
                {result?.compiled && <><span className="pr">$ java {mainName}{"\n"}</span><span className={passed ? "g" : ""}>{result.stdout}</span>{result.stderr ? <span className="e">{"\n"}{result.stderr}</span> : null}{result.message ? `\n${result.message}` : ""}</>}
                {result && !passed && (
                  <div><button type="button" className="xb-askai" onClick={() => onAsk?.(result.compiled ? "出力が期待どおりにならない理由は？" : `${diagnostic?.line ? `${diagnostic.line}行目の` : ""}エラーの意味は？`)}>AIに聞く ↗</button></div>
                )}
              </div>
            )}
        </div>
        <StatusBar lang={lang} caret={caret} left={diagnostic ? `⊗ ${diagnostic.line}行目` : result ? (passed ? "✓ 実行できました" : "出力を確認") : ""} />
      </section>
    </div>
  );
}

/* ---------- HTML / CSS ---------- */
function WebBench({ slide, lrn, course, lesson, onContext, onAsk, focus }) {
  const [side, setSide] = useSide(focus);
  const content = slide.content || {};
  const lang = LANG.web_run;
  const start = useMemo(() => ({ "index.html": content.html || "", "style.css": content.css || "" }), [content.html, content.css]);
  const names = content.showCss === false ? ["index.html"] : ["index.html", "style.css"];
  const [files, setFiles] = useState(start);
  const [openFile, setOpenFile] = useState(content.css && !content.html ? "style.css" : "index.html");
  const [results, setResults] = useState([]);
  const [touched, setTouched] = useState(false);
  const [phone, setPhone] = useState(false);
  const [title, setTitle] = useState("");
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const frame = useRef(null), narrow = useRef(null), sent = useRef(false);
  const checks = useMemo(() => (Array.isArray(content.checks) ? content.checks : []), [content.checks]);
  const needsNarrow = checks.some(c => c.at === "narrow");
  const srcDoc = useMemo(() => previewDocument(files), [files]);

  function evaluate() {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    setTitle(String(doc.title || ""));
    const next = runWebChecks(checks, { doc, narrowDoc: needsNarrow ? narrow.current?.contentDocument : doc, files });
    setResults(next);
    if (next.length && next.every(r => r.ok) && !sent.current && lrn?.submitExercise) {
      sent.current = true;
      lrn.submitExercise({ courseId: course.id, lessonId: lesson.id, slideId: slide.id, kind: "web_run", submittedAnswer: `${files["index.html"]}\n\n/* style.css */\n${files["style.css"]}`, isCorrect: true }).catch(() => {});
    }
  }
  useEffect(() => { const id = setTimeout(evaluate, 240); return () => clearTimeout(id); }, [srcDoc, checks]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = results.length > 0 && results.every(r => r.ok);
  // 未達は先頭の1つだけ渡す（全部渡すと、AIがやることを書き並べてしまう）
  const missing = results.filter(r => !r.ok).slice(0, 1).map(r => `未達: ${r.label}`).join("\n");
  useEffect(() => {
    onContext?.({ language: "web", files: names.map(n => ({ name: n, content: files[n] })), output: missing, compiled: done, hasResult: touched && results.length > 0 });
  }, [files, missing, done, touched]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = v => { setTouched(true); setFiles(p => ({ ...p, [openFile]: v })); };
  return (
    <div className="xb">
      <TaskCard focus={focus} slide={slide} content={content} lang={lang} checks={results.map(r => ({ t: r.label, st: r.ok ? "ok" : touched ? "ng" : "" }))} />
      <section className="xb-ws web">
        <div className="xb-wbar">
          {names.map(n => <button key={n} type="button" className={`ftab ${n.endsWith(".css") ? "css" : "html"}`} aria-selected={openFile === n} onClick={() => setOpenFile(n)}><i />{n}</button>)}
          <span className="sp" />
          <SideToggle side={side} setSide={setSide} label="表示" />
          <button type="button" className="xb-btn sub" onClick={() => { setFiles(start); setTouched(false); sent.current = false; }}>最初に戻す</button>
          {touched && !done && results.length > 0 && <button type="button" className="xb-btn sub" onClick={() => onAsk?.("思ったとおりに見えないのはなぜ？")}>AIに聞く ↗</button>}
        </div>
        <div className={`xb-split ${side ? "" : "solo"}`}>
          <div className="xb-ed">
            <WebEditor key={`${slide.id}-${openFile}`} mode={openFile.endsWith(".css") ? "css" : "html"} value={files[openFile]} onChange={update} level={content.completionLevel || 1} onCaret={setCaret} />
          </div>
          <div className={`xb-pv ${phone ? "phone" : ""}`}>
            <div className="chrome"><span className="dots"><i /><i /><i /></span><span className="url">{title || "index.html"}</span>
              <span className="dev" role="group" aria-label="画面の幅"><button type="button" aria-pressed={!phone} onClick={() => setPhone(false)}>PC</button><button type="button" aria-pressed={phone} onClick={() => setPhone(true)}>スマホ</button></span></div>
            <div className="stagep">
              <iframe ref={frame} title="書いたページの表示" srcDoc={srcDoc} onLoad={evaluate} sandbox="allow-same-origin" style={{ height: content.previewHeight || 340 }} />
            </div>
            {needsNarrow && <iframe ref={narrow} className="xb-narrow" title="スマホの幅での確認" aria-hidden="true" tabIndex={-1} srcDoc={srcDoc} onLoad={evaluate} sandbox="allow-same-origin" style={{ width: NARROW_W }} />}
          </div>
        </div>
        <StatusBar lang={lang} caret={caret} left={results.length ? `確認 ${results.filter(r => r.ok).length} / ${results.length}` : "書くとすぐ反映"} />
      </section>
    </div>
  );
}

/* ---------- JavaScript（2026-10-13） ----------
   script.js（と、あれば index.html）を書いて ▶ 実行。右に表示、下にコンソール（console.log・alert・エラー）。
   確かめること（checks: [{ label, expr }]）は、隠れた枠でもう一度動かして確かめる（ボタンを押した結果なども枠の中で見られる）。
   受講生のコードは別の起源の枠で動く（exercise/jsRunner.js） */
function JsBench({ slide, lrn, course, lesson, onContext, onAsk, focus }) {
  const [side, setSide] = useSide(focus);
  const content = slide.content || {};
  const lang = LANG.js_run;
  const hasHtml = !!String(content.html || "").trim();
  const names = hasHtml ? ["script.js", "index.html"] : ["script.js"];
  const [files, setFiles] = useState({ "script.js": content.js || "", "index.html": content.html || "" });
  const [openFile, setOpenFile] = useState("script.js");
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const frame = useRef(null), token = useRef(""), sent = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const checks = useMemo(() => (Array.isArray(content.checks) ? content.checks.filter(c => c?.expr) : []), [content.checks]);
  const offset = useMemo(() => userLineOffset(files["index.html"], ""), [files]);

  // 見える枠からの console・alert・エラー
  useEffect(() => {
    const on = e => {
      const m = e.data;
      if (!m || m.__djs !== token.current || e.source !== frame.current?.contentWindow || m.t === "done") return;
      const item = m.t === "error" && m.d && typeof m.d === "object" ? { t: "error", s: m.d.msg, line: m.d.line ? Math.max(1, m.d.line - offset) : 0 } : { t: m.t, s: String(m.d) };
      setLogs(l => [...l, item].slice(-300));
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [offset]);

  async function run() {
    if (running) return;
    setRunning(true); setLogs([]);
    token.current = `pv-${Date.now()}`;
    if (frame.current) frame.current.srcdoc = buildJsDocument({ html: files["index.html"], js: files["script.js"], token: token.current });
    try {
      const r = checks.length ? await runJsPage({ html: files["index.html"], js: files["script.js"], checks: checks.map(c => c.expr) }) : null;
      if (!alive.current) return;
      const res = checks.map((c, k) => ({ label: c.label, ok: !!r?.results?.[k]?.ok }));
      setResults(res); setRan(true);
      const ok = res.length > 0 && res.every(x => x.ok);
      if (ok && !sent.current && lrn?.submitExercise) {
        sent.current = true;
        lrn.submitExercise({ courseId: course.id, lessonId: lesson.id, slideId: slide.id, kind: "js_run", submittedAnswer: files["script.js"], isCorrect: true }).catch(() => {});
      }
    } finally { if (alive.current) setRunning(false); }
  }
  // 開いたら一度動かす（サンプルはそのまま結果が見える）
  useEffect(() => { const t = setTimeout(run, 200); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const done = results.length > 0 && results.every(r => r.ok);
  const errLog = logs.find(l => l.t === "error");
  const output = logs.map(l => (l.t === "alert" ? `[alert] ${l.s}` : l.t === "error" ? `エラー: ${l.s}${l.line ? `（${l.line}行目）` : ""}` : l.s)).join("\n");
  useEffect(() => {
    onContext?.({ language: "js", source: files["script.js"], files: names.map(n => ({ name: n, content: files[n] })), output, compiled: !errLog, hasResult: ran });
  }, [files, output, ran]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = v => setFiles(p => ({ ...p, [openFile]: v }));
  const reset = () => { setFiles({ "script.js": content.js || "", "index.html": content.html || "" }); setResults([]); setRan(false); sent.current = false; };
  return (
    <div className="xb">
      <TaskCard focus={focus} slide={slide} content={content} lang={lang} checks={(results.length ? results : checks.map(c => ({ label: c.label }))).map(r => ({ t: r.label, st: !ran ? "" : r.ok ? "ok" : "ng" }))} />
      <section className="xb-ws web js">
        <div className="xb-wbar">
          {names.map(n => <button key={n} type="button" className={`ftab ${n.endsWith(".html") ? "html" : "js"}`} aria-selected={openFile === n} onClick={() => setOpenFile(n)}><i />{n}</button>)}
          <span className="sp" />
          <SideToggle side={side} setSide={setSide} label="表示" />
          <button type="button" className="xb-btn sub" onClick={reset}>最初に戻す</button>
          <button type="button" className="xb-btn go" onClick={run} disabled={running}>{running ? "実行中…" : "▶ 実行"} <kbd>Ctrl+Enter</kbd></button>
        </div>
        <div className={`xb-split ${side ? "" : "solo"}`}>
          <div className="xb-ed">
            {openFile === "index.html"
              ? <WebEditor key={`${slide.id}-html`} mode="html" value={files["index.html"]} onChange={update} level={1} onCaret={setCaret} />
              : <JavaEditor key={`${slide.id}-js`} value={files["script.js"]} onChange={update} level={0} onRun={run} onCaret={setCaret}
                  diagnostic={errLog?.line ? { file: "script.js", line: errLog.line, col: 0 } : null} />}
          </div>
          <div className="xb-pv">
            <div className="chrome"><span className="dots"><i /><i /><i /></span><span className="url">index.html</span></div>
            <div className="stagep"><iframe ref={frame} title="動かした結果" sandbox="allow-scripts allow-modals allow-forms" style={{ height: content.previewHeight || 260 }} /></div>
          </div>
        </div>
        <div className="xb-out">
          <div className="otabs"><button type="button" role="tab" aria-selected="true">コンソール</button><span className="meta">{running ? "実行中…" : ran ? `${logs.length}件` : "まだ動かしていません"}</span></div>
          <div className="term">
            {!logs.length && <span className="pr">{ran ? "（出力なし）" : "▶ 実行 で動かします"}</span>}
            {logs.map((l, k) => <div key={k} className={l.t === "error" ? "e" : l.t === "alert" ? "a" : ""}>{l.t === "alert" ? "⚠ alert: " : l.t === "error" ? "✕ " : "› "}{l.s}{l.line ? `（${l.line}行目）` : ""}</div>)}
            {ran && !done && checks.length > 0 && (
              <div><button type="button" className="xb-askai" onClick={() => onAsk?.(errLog ? `${errLog.line ? `${errLog.line}行目の` : ""}エラーの意味は？` : "思ったとおりに動かないのはなぜ？")}>AIに聞く ↗</button></div>
            )}
          </div>
        </div>
        <StatusBar lang={lang} caret={caret} left={results.length ? `確認 ${results.filter(r => r.ok).length} / ${results.length}` : ""} />
      </section>
    </div>
  );
}

/* ---------- SQL（2026-10-13） ----------
   query.sql を書いて ▶ 実行。右にテーブルの中身（実行したあとの中身）、下に結果の表。
   確かめること（checks: [{ label, query?, columns? }]）は answerSql の結果と比べる（exercise/sqlRunner.js）。
   テーブルは content.setup（無ければ教材の emp・dept・loc・sal_grades） */
function SqlBench({ slide, lrn, course, lesson, onContext, onAsk, focus }) {
  const [side, setSide] = useSide(focus);
  const content = slide.content || {};
  const lang = LANG.sql_run;
  const setup = content.setup || "";
  const [code, setCode] = useState(content.sql || "");
  const [res, setRes] = useState(null);
  const [expected, setExpected] = useState(null);
  const [tab, setTab] = useState("out");
  const [running, setRunning] = useState(false);
  const [stamp, setStamp] = useState(0);
  const [ranCode, setRanCode] = useState("");
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const sent = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const checks = useMemo(() => {
    const list = Array.isArray(content.checks) ? content.checks.filter(c => c?.label) : [];
    return list.length ? list : content.answerSql ? [{ label: "結果が正しい" }] : [];
  }, [content.checks, content.answerSql]);
  const tables = useSqlTables(setup, ranCode, stamp);
  const words = useMemo(() => sqlWords(tables), [tables]);

  async function run() {
    if (running) return;
    setRunning(true);
    try {
      const r = await runSqlChecks({ setup, code, answer: content.answerSql || "", checks });
      if (!alive.current) return;
      setRes(r); setTab("out"); setRanCode(code); setStamp(x => x + 1);
      const ok = checks.length > 0 && r.results.every(x => x.ok);
      if (ok && !sent.current && lrn?.submitExercise) {
        sent.current = true;
        lrn.submitExercise({ courseId: course.id, lessonId: lesson.id, slideId: slide.id, kind: "sql_run", submittedAnswer: code, isCorrect: true }).catch(() => {});
      }
    } finally { if (alive.current) setRunning(false); }
  }
  // サンプル（はじめのSQLがそのまま答え）は開いたら一度動かす。穴あきの演習はエラーになるので動かさない
  useEffect(() => {
    if (String(content.sql || "").trim() !== String(content.answerSql || content.sql || "").trim()) return undefined;
    const t = setTimeout(run, 150);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!content.answerSql || checks[0]?.query) return;
    querySet(setup, content.answerSql).then(r => { if (alive.current) setExpected(r.set); }).catch(() => {});
  }, [content.answerSql, setup]); // eslint-disable-line react-hooks/exhaustive-deps

  const ran = !!res;
  const done = ran && checks.length > 0 && res.results.every(r => r.ok);
  const rows = res?.set ? res.set.values.length : 0;
  const output = !res ? "" : res.error ? `エラー: ${res.error}` : res.set ? [res.set.columns.join(" | "), ...res.set.values.slice(0, 20).map(r => r.map(v => (v === null ? "NULL" : v)).join(" | "))].join("\n") : "（結果を返さない文だけを実行しました）";
  useEffect(() => {
    onContext?.({ language: "sql", source: code, output, compiled: !res?.error, hasResult: ran });
  }, [code, output, ran]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { setCode(content.sql || ""); setRes(null); setRanCode(""); setStamp(x => x + 1); sent.current = false; };

  return (
    <div className="xb">
      <TaskCard focus={focus} slide={slide} content={content} lang={lang} checks={checks.map((c, k) => ({ t: c.label, st: !ran ? "" : res.results[k]?.ok ? "ok" : "ng" }))} />
      <section className="xb-ws sql">
        <div className="xb-wbar">
          <button type="button" className="ftab sql" aria-selected="true"><i />query.sql</button>
          <span className="sp" />
          <SideToggle side={side} setSide={setSide} label="テーブル" />
          <button type="button" className="xb-btn sub" onClick={reset}>最初に戻す</button>
          <button type="button" className="xb-btn go" onClick={run} disabled={running}>{running ? "実行中…" : "▶ 実行"} <kbd>Ctrl+Enter</kbd></button>
        </div>
        <div className={`xb-split ${side ? "" : "solo"}`}>
          <div className="xb-ed"><JavaEditor key={`${slide.id}-sql`} lang="sql" words={words} value={code} onChange={setCode} onRun={run} onCaret={setCaret} /></div>
          <SqlTables tables={tables} code={`${ranCode} ${content.sql || ""} ${content.answerSql || ""}`} after={!!ranCode && /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(ranCode)} />
        </div>
        <div className="xb-out">
          <div className="otabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "out"} onClick={() => setTab("out")}>結果</button>
            {expected ? <button type="button" role="tab" aria-selected={tab === "exp"} onClick={() => setTab("exp")}>期待する結果</button> : null}
            <span className="meta">{running ? "実行中…" : !ran ? "まだ動かしていません" : res.error ? "エラー" : res.set ? `${rows}行` : "実行しました"}</span>
          </div>
          {tab === "exp" && expected ? <SqlGrid set={expected} /> : (
            <div className="term">
              {!ran && <span className="pr">▶ 実行 で動かします</span>}
              {res?.error && <div className="e">✕ {res.error}</div>}
              {ran && !res.error && !res.set && <span className="pr">（結果を返さない文だけを実行しました。右のテーブルで中身を見られます）</span>}
              {ran && !res.error && res.set && !res.set.values.length && <span className="pr">（0行）</span>}
              {ran && !done && checks.length > 0 && (
                <div><button type="button" className="xb-askai" onClick={() => onAsk?.(res.error ? "このエラーの意味は？" : "期待する結果にならない理由は？")}>AIに聞く ↗</button></div>
              )}
            </div>
          )}
          {tab === "out" && res?.set?.columns.length ? <SqlGrid set={res.set} /> : null}
        </div>
        <StatusBar lang={lang} caret={caret} left={checks.length && ran ? `確認 ${res.results.filter(r => r.ok).length} / ${checks.length}` : ""} />
      </section>
    </div>
  );
}
