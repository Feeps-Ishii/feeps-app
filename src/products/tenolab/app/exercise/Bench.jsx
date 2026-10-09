import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiPost } from "../../../../api.js";
import JavaEditor from "../../../learning/JavaEditor.jsx";
import WebEditor from "../../../learning/WebEditor.jsx";
import { parseJavacError } from "../../../learning/javaEditorSupport.js";
import { previewDocument, runWebChecks } from "../../../learning/webChecks.js";
import "./bench.css";

/* 演習の作業台（モック tenolab-exercise.html、2026-10-09）。
   言語ごとに作業台を変える：Java＝エディタ＋コンソール＋期待する出力との比べ／HTML・CSS＝ファイルのタブ＋その場で変わるプレビュー（PC／スマホ）。
   コードについて聞くのは右のAIチャット（LessonView）にまとめた。ここは onContext で「いまのコードと結果」を渡し、
   エラーの「AIに聞く」は onAsk で右のチャットに質問を送る。
   実行・採点・記録は今までと同じ（/learning/exercises/java/run・webChecks・lrn.submitExercise）。
   編集部品（JavaEditor・WebEditor）は LMS と共通のものをそのまま使う。 */

export const BENCH_KINDS = new Set(["code_run", "web_run"]);
const LANG = { code_run: { name: "Java 21", key: "java" }, web_run: { name: "HTML / CSS", key: "web" } };
const NARROW_W = 390;

export default function ExerciseBench(props) {
  return props.slide.kind === "web_run" ? <WebBench {...props} /> : <JavaBench {...props} />;
}

function TaskCard({ slide, content, lang, checks }) {
  return (
    <section className={`xb-task ${lang.key}`}>
      <div className="tt"><span className="lang"><i />{lang.name}</span><h1>{slide.title}</h1>{content.minutes ? <span className="chip">約{content.minutes}分</span> : null}</div>
      {(content.task || content.intro) && <p>{content.task || content.intro}</p>}
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
function JavaBench({ slide, lrn, course, lesson, onContext, onAsk }) {
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
      <TaskCard slide={slide} content={content} lang={lang} checks={checks} />
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
function WebBench({ slide, lrn, course, lesson, onContext, onAsk }) {
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
      <TaskCard slide={slide} content={content} lang={lang} checks={results.map(r => ({ t: r.label, st: r.ok ? "ok" : touched ? "ng" : "" }))} />
      <section className="xb-ws web">
        <div className="xb-wbar">
          {names.map(n => <button key={n} type="button" className={`ftab ${n.endsWith(".css") ? "css" : "html"}`} aria-selected={openFile === n} onClick={() => setOpenFile(n)}><i />{n}</button>)}
          <span className="sp" />
          <button type="button" className="xb-btn sub" onClick={() => { setFiles(start); setTouched(false); sent.current = false; }}>最初に戻す</button>
          {touched && !done && results.length > 0 && <button type="button" className="xb-btn sub" onClick={() => onAsk?.("思ったとおりに見えないのはなぜ？")}>AIに聞く ↗</button>}
        </div>
        <div className="xb-split">
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
