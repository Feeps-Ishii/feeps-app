import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, FileCode2, Globe, Monitor, RotateCcw, Smartphone, Sparkles } from "lucide-react";
import { T } from "../../components/common";
import { SlideEyebrowText } from "./SlideLayouts.jsx";
import WebEditor from "./WebEditor.jsx";
import CodeQuestionBox from "./CodeQuestionBox.jsx";
import { previewDocument, runWebChecks } from "./webChecks.js";
import { Breadcrumb, StatusBar } from "./ExerciseChrome.jsx";
import useExerciseWindow from "./useExerciseWindow.js";
import DetachBar, { DetachButton, DetachError } from "./DetachBar.jsx";

// 2026-08-27: HTML/CSSを書いて、その場で表示を確かめる演習。
// 承認モック: mock/html-editor/index.html
//
// Javaと違い**サーバーは要らない**。ブラウザ自身が実行環境なので、書いたそばから
// 反映される。だから「実行する」ボタンは置かず、打つたびに描き直す。
//
// 合否は書いた文字ではなく、できあがった表示を測って決める（webChecks.js）。
// 同じ見た目にたどり着く書き方は一通りではないため。
//
// プレビューは sandbox="allow-same-origin" だけ。**allow-scripts は付けない**。
// 中身を測るために同一オリジンで読む必要があり、そこへスクリプト実行を許すと
// この画面のCookieやDOMへ触れてしまう。HTML/CSSの演習に <script> は要らない。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const NARROW_W = 390;

const KEYS = [
  ["<", "打つとタグの候補が出ます"],
  [">", "閉じタグを自動で足します"],
  ["</", "開いているタグを閉じます"],
  ["Tab / Enter", "候補を確定"],
  ["Esc", "候補を閉じる"],
];
const HELP_SEEN_KEY = "feeps.webRun.helpSeen";

export default function WebRunSlide({ slide, content = {}, lrn, courseId, lessonId }) {
  const startFiles = useMemo(() => ({
    "index.html": content.html || "",
    "style.css": content.css || "",
  }), [content.html, content.css]);

  const [files, setFiles] = useState(startFiles);
  const [openFile, setOpenFile] = useState("index.html");
  const [results, setResults] = useState([]);
  const [helpDismissed, setHelpDismissed] = useState(true);
  const [touched, setTouched] = useState(false);
  // <title> は画面のどこにも出ないので、書いても効いたか分からない。
  // 偽のブラウザタブを1本出して、そこに映す（2026-08-27にユーザー指摘）。
  const [docTitle, setDocTitle] = useState("");
  const [caret, setCaret] = useState({ line: 1, col: 1 });

  const frameRef = useRef(null);
  const narrowRef = useRef(null);
  const submittedRef = useRef(false);
  // 別ウィンドウ側で測った確認の結果。切り離している間はこちらに iframe が無い。
  const [remoteChecks, setRemoteChecks] = useState(null);

  // CSSをまだ扱わない単元では index.html だけを見せる。使わないタブを出すと
  // 「そこにも書かないといけないのか」と迷わせる。
  const fileNames = useMemo(
    () => (content.showCss === false ? ["index.html"] : ["index.html", "style.css"]),
    [content.showCss],
  );
  const checks = useMemo(() => (Array.isArray(content.checks) ? content.checks : []), [content.checks]);
  const needsNarrow = useMemo(() => checks.some(c => c.at === "narrow"), [checks]);

  useEffect(() => {
    try { setHelpDismissed(localStorage.getItem(HELP_SEEN_KEY) === "1"); } catch (e) { setHelpDismissed(false); }
  }, []);

  // 別のページへ移ったら書きかけを引きずらない
  useEffect(() => {
    setFiles(startFiles);
    setOpenFile("index.html");
    setResults([]);
    setTouched(false);
    submittedRef.current = false;
  }, [slide.id, startFiles]);

  const srcDoc = useMemo(() => previewDocument(files), [files]);

  // 打つたびに描き直す。描き終わってから測る（load を待つ）。
  function evaluate() {
    const doc = frameRef.current?.contentDocument || null;
    const narrowDoc = needsNarrow ? (narrowRef.current?.contentDocument || null) : doc;
    if (!doc) return;
    setDocTitle(String(doc.title || ""));
    const next = runWebChecks(checks, { doc, narrowDoc, files });
    setResults(next);

    const ok = next.length > 0 && next.every(r => r.ok);
    if (ok && !submittedRef.current && lrn?.submitExercise && courseId && lessonId) {
      submittedRef.current = true;
      lrn.submitExercise({
        courseId, lessonId, slideId: slide.id, kind: "web_run",
        submittedAnswer: `${files["index.html"]}\n\n/* style.css */\n${files["style.css"]}`,
        isCorrect: true,
      }).catch(() => {});
    }
  }

  // srcDoc を差し替えると load が来る。狭い方も同じ文書なので、両方の load を待つ。
  useEffect(() => {
    const id = setTimeout(evaluate, 240);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcDoc, checks]);

  function update(name, value) {
    setTouched(true);
    setFiles(prev => ({ ...prev, [name]: value }));
  }

  // ---- 別ウィンドウ（ADR 0021）----
  // 状態はここが持ち続ける。閉じても書きかけは残る。
  const winState = useMemo(() => ({
    kind: "web_run",
    title: slide.title,
    task: content.task || "",
    files,
    fileNames,
    activeFile: openFile,
    checks,
    completionLevel: content.completionLevel || 1,
    canReset: true,
  }), [slide.title, content.task, content.completionLevel, files, fileNames, openFile, checks]);

  const exWin = useExerciseWindow({
    state: winState,
    onEdit: (p) => {
      if (!p) return;
      if (p.reset) { reset(); return; }
      if (p.activeFile) setOpenFile(p.activeFile);
      if (p.files) { setTouched(true); setFiles(prev => ({ ...prev, ...p.files })); }
      // 合否の記録は**主が持つ**。別窓は測った結果を渡すだけ。
      if (p.checks) { setRemoteChecks(p.checks); recordIfPassed(p.checks); }
    },
  });

  function recordIfPassed(list) {
    const ok = list.length > 0 && list.every(r => r.ok);
    if (!ok || submittedRef.current || !lrn?.submitExercise || !courseId || !lessonId) return;
    submittedRef.current = true;
    lrn.submitExercise({
      courseId, lessonId, slideId: slide.id, kind: "web_run",
      submittedAnswer: `${files["index.html"]}\n\n/* style.css */\n${files["style.css"]}`,
      isCorrect: true,
    }).catch(() => {});
  }

  function reset() {
    setFiles(startFiles);
    setOpenFile("index.html");
    setTouched(false);
  }

  function dismissHelp() {
    setHelpDismissed(true);
    try { localStorage.setItem(HELP_SEEN_KEY, "1"); } catch (e) { /* 保存できなくても動作は変わらない */ }
  }

  const shown = exWin.detached && remoteChecks ? remoteChecks : results;
  const passedCount = shown.filter(r => r.ok).length;
  const done = shown.length > 0 && passedCount === shown.length;
  const mode = openFile === "style.css" ? "css" : "html";

  return (
    <div>
      <SlideEyebrowText chapter={content.chapter} chapterTitle={content.chapterTitle} />
      <h3 className="mb-4 text-[24px] font-extrabold leading-[1.4]" style={{ color: C.ink, letterSpacing: "-0.025em" }}>{slide.title}</h3>
      {content.intro && <p className="mb-4 text-[14.5px] leading-[1.95]" style={{ color: C.body }}>{content.intro}</p>}

      {content.task && (
        <div data-focus="run-task" className="mb-4 rounded-xl p-4" style={{ background: C.canvas, border: `1px solid ${C.line}`, borderLeft: `3px solid ${T.accent}` }}>
          <div className="mb-1.5 text-[10.5px] font-extrabold" style={{ color: T.accent, letterSpacing: "0.1em" }}>やること</div>
          <p className="m-0 text-[14.5px] font-bold leading-[1.75]" style={{ color: C.ink }}>{content.task}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.line}` }}>
        {!helpDismissed && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3" style={{ background: T.aiSubtle, borderBottom: `1px solid ${C.line}` }}>
            <span className="w-full text-[11.5px] font-extrabold" style={{ color: T.aiAccentDeep, letterSpacing: "0.05em" }}>はじめて使う方へ</span>
            {KEYS.map(([k, v]) => (
              <span key={k} className="flex items-center gap-2 text-[12px]" style={{ color: C.body }}>
                <kbd className="rounded-md px-1.5 py-[2px] text-[10.5px] font-semibold" style={{ fontFamily: MONO, background: "#fff", border: `1px solid ${C.line}`, borderBottomWidth: 2, color: C.ink }}>{k}</kbd>
                {v}
              </span>
            ))}
            <button type="button" onClick={dismissHelp} className="ml-auto text-[11.5px] font-bold" style={{ color: T.aiAccentDeep }}>
              閉じる（次から出しません）
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5" style={{ background: C.canvas, borderBottom: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-1">
            {fileNames.map(name => (
              <button key={name} type="button" onClick={() => setOpenFile(name)} aria-current={openFile === name}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] transition hover:bg-black/[.04]"
                style={{
                  fontFamily: MONO,
                  color: openFile === name ? T.accentHover : C.body,
                  background: openFile === name ? T.accentSubtle : "transparent",
                  fontWeight: openFile === name ? 700 : 400,
                }}>
                <FileCode2 size={11} className="shrink-0" />{name}
              </button>
            ))}
          </div>
          <span className="text-[10.5px] font-bold" style={{ color: C.muted, letterSpacing: "0.06em" }}>
            {mode === "css" ? "CSS" : "HTML"}
          </span>
          <span className="ml-auto text-[10.5px]" style={{ color: C.muted }}>
            {fileNames.length > 1 ? "書いたそばから右に反映されます" : "書いたそばから右に反映されます（CSSはこの単元では使いません）"}
          </span>
          <button type="button" onClick={reset}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition hover:bg-black/[.04]"
            style={{ border: `1px solid ${C.line}`, color: C.muted }}>
            <RotateCcw size={12} />最初に戻す
          </button>
          {!exWin.detached && <DetachButton onClick={exWin.detach} />}
        </div>
        <DetachError message={exWin.error} onDismiss={exWin.clearError} />

        {exWin.detached ? (
          <DetachBar onReattach={exWin.reattach} note="コードとプレビューは、あちらの窓に出しています。" />
        ) : (
        <>
        <Breadcrumb parts={[content.projectName || "web-basics", openFile]} />

        <div className="grid lg:grid-cols-2">
          <div style={{ borderRight: `1px solid ${C.line}` }}>
            <WebEditor
              key={`${slide.id}-${openFile}`}
              mode={mode}
              value={files[openFile]}
              onChange={v => update(openFile, v)}
              level={content.completionLevel || 1}
              onCaret={setCaret}
            />
          </div>

          <div className="min-w-0">
            <div className="px-3.5 py-2 text-[10.5px] font-extrabold" style={{ background: C.canvas, borderBottom: `1px solid ${C.line}`, color: C.muted, letterSpacing: "0.08em" }}>
              ブラウザでの見え方
            </div>

            {/* 偽のブラウザタブ。<title> の中身がここに出る。
                本物のタブは見せられないので、書いた結果が見える場所を作る。 */}
            <div className="flex items-end gap-2 px-3 pt-2.5" style={{ background: C.canvas }}>
              <div
                className="flex min-w-0 max-w-[240px] items-center gap-1.5 rounded-t-lg px-3 py-1.5"
                style={{ background: "#fff", border: `1px solid ${C.line}`, borderBottom: "none" }}
              >
                <Globe size={11} className="shrink-0" style={{ color: C.muted }} />
                <span className="truncate text-[11.5px] font-semibold" style={{ color: docTitle ? C.ink : C.muted }}>
                  {docTitle || "（タイトルなし）"}
                </span>
              </div>
              {!docTitle && (
                <span className="pb-1 text-[10.5px]" style={{ color: C.muted }}>
                  ← &lt;title&gt; を書くとここに出ます
                </span>
              )}
            </div>
            <iframe
              ref={frameRef}
              title="書いたページの表示"
              srcDoc={srcDoc}
              onLoad={evaluate}
              sandbox="allow-same-origin"
              className="block w-full border-0"
              style={{ height: content.previewHeight || 320, background: "#fff" }}
            />
            {needsNarrow && (
              <>
                <div className="flex items-center gap-1.5 px-3.5 py-2 text-[10.5px] font-extrabold" style={{ background: C.canvas, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, color: C.muted, letterSpacing: "0.08em" }}>
                  <Smartphone size={11} />スマホの幅（{NARROW_W}px）
                </div>
                <div className="overflow-x-auto p-3" style={{ background: C.canvas }}>
                  <iframe
                    ref={narrowRef}
                    title="スマホの幅での表示"
                    srcDoc={srcDoc}
                    onLoad={evaluate}
                    sandbox="allow-same-origin"
                    className="block border-0"
                    style={{ width: NARROW_W, height: content.narrowHeight || 300, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10 }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        </>
        )}

        <div style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-extrabold"
            style={{ background: C.canvas, borderBottom: `1px solid ${C.line}`, color: done ? T.success : C.body, letterSpacing: "0.05em" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: done ? T.success : C.muted }} />
            {done ? `できました（${passedCount} / ${shown.length}）` : `表示の確認（${passedCount} / ${shown.length}）`}
            {done && <CheckCircle2 size={14} />}
          </div>
          <ul className="m-0 list-none p-3.5">
            {shown.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 py-1.5">
                <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold"
                  style={{ background: r.ok ? T.successSubtle : "transparent", border: r.ok ? "none" : `1px solid ${C.line}`, color: T.success }}>
                  {r.ok ? "✓" : ""}
                </span>
                <span className="min-w-0">
                  <span className="text-[13px] font-bold" style={{ color: r.ok ? C.ink : C.body }}>{r.label}</span>
                  {r.why && <span className="ml-2 text-[11.5px]" style={{ fontFamily: MONO, color: C.muted }}>{r.why}</span>}
                </span>
              </li>
            ))}
            {shown.length === 0 && (
              <li className="text-[12.5px]" style={{ color: C.muted }}>この演習には自動の確認がありません。見た目を確かめてから次へ進んでください。</li>
            )}
          </ul>
        </div>

        {/* ここに出すのは**すべて本当の値**。それっぽい表示は入れない。 */}
        <StatusBar
          left={[
            { text: mode === "css" ? "CSS" : "HTML" },
            shown.length ? { text: `確認 ${passedCount} / ${shown.length}`, tone: done ? "ok" : "warn" } : null,
          ]}
          right={[
            { text: `行 ${caret.line}、列 ${caret.col}` },
            { text: "スペース: 2", minor: true },
            { text: "UTF-8", minor: true },
            { text: "LF", minor: true },
          ]}
        />
      </div>

      {/* いま書いているコードについて質問できる。答えのコードは返さない
          （Backendのプロンプト側で担保）。 */}
      <CodeQuestionBox
        courseId={courseId}
        lessonId={lessonId}
        slideId={slide.id}
        language="web"
        files={[
          { name: "index.html", content: files["index.html"] },
          { name: "style.css", content: files["style.css"] },
        ]}
        // 未達の確認は**先頭の1つだけ**渡す。全部渡すと、AIがそれを
        // やることリストとして書き下してしまい、考える余地が残らない
        // （2026-08-27に本番で実測。4つ全部の値を並べた回答が返った）。
        output={results.filter(r => !r.ok).slice(0, 1).map(r => `未達: ${r.label}`).join("\n")}
        compiled={done}
        hasResult={touched && shown.length > 0}
      />

      {done && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl p-4" style={{ background: T.successSubtle }}>
          <Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: T.success }} />
          <div className="min-w-0">
            <div className="mb-1 text-[11.5px] font-extrabold" style={{ color: T.success, letterSpacing: "0.04em" }}>できました</div>
            <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-[1.85]" style={{ color: C.ink }}>
              {content.successNote || "書いたとおりにブラウザが描きました。HTMLが「何であるか」、CSSが「どう見せるか」を決めています。"}
            </p>
          </div>
        </div>
      )}
      {!done && touched && shown.length > 0 && content.hintNote && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl p-4" style={{ background: T.aiSubtle }}>
          <Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: T.aiAccentDeep }} />
          <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-[1.85]" style={{ color: C.ink }}>{content.hintNote}</p>
        </div>
      )}
      <div className="mt-2 text-[10.5px]" style={{ color: C.muted }}>
        このプレビューでは &lt;script&gt; は動きません（HTML/CSSの演習のため）。
      </div>
    </div>
  );
}
