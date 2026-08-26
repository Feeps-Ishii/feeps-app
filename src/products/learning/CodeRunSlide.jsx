import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, FileCode2, Loader2, Play, RotateCcw, Sparkles } from "lucide-react";
import { T } from "../../components/common";
import { apiPost } from "../../api.js";
import { SlideEyebrowText } from "./SlideLayouts.jsx";
import { stopSpeech } from "./lectureAudio.js";
import JavaEditor from "./JavaEditor.jsx";
import { parseJavacError } from "./javaEditorSupport.js";
import CodeQuestionBox from "./CodeQuestionBox.jsx";

// 2026-08-25: 受講者がコードを書いて、**本当にコンパイル・実行する**演習。
// 承認モック: mock/lecture-devenv, mock/code-editor
//
// これまでの演習は入力文字列の一致で、出力は固定文だった。ここはLambdaで
// javac/java が動き、エラーメッセージも行番号も列も本物が返る。
//
// 判定は expect と出力の**完全一致のみ**。部分一致は取らない
// （「たまたま含まれていた」を正解にしない）。記録は既存のsubmitに寄せる。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FOCUS = "#E8542F";

// 使い方は「初回だけ出す」。2回目からは下の折りたたみで見られる。
const HELP_SEEN_KEY = "feeps.codeRun.helpSeen";
const KEYS = [
  ["Tab / Enter", "候補を確定"],
  ["Ctrl + Space", "候補を出す"],
  ["Ctrl + Enter", "実行"],
  ["Esc", "候補を閉じる"],
];

export default function CodeRunSlide({ slide, content = {}, lrn, courseId, lessonId }) {
  const mainName = content.filename || "Main.java";
  // 参考ファイル（読むだけ）。単元2では構成を見せるだけで、編集するのは1つ。
  const extraFiles = useMemo(
    () => (Array.isArray(content.files) ? content.files.filter(f => f?.name && f.name !== mainName) : []),
    [content.files, mainName],
  );

  const [source, setSource] = useState(content.source || "");
  const [openFile, setOpenFile] = useState(mainName);
  const [state, setState] = useState("idle"); // idle | running | done
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [helpDismissed, setHelpDismissed] = useState(true);
  const aliveRef = useRef(true);

  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);
  useEffect(() => {
    try { setHelpDismissed(localStorage.getItem(HELP_SEEN_KEY) === "1"); } catch (e) { setHelpDismissed(false); }
  }, []);
  // 別のページへ移ったら書きかけを引きずらない
  useEffect(() => {
    setSource(content.source || "");
    setOpenFile(mainName);
    setResult(null);
    setState("idle");
    setErrorMsg("");
  }, [slide.id]);

  const diagnostic = useMemo(
    () => (result && !result.compiled ? parseJavacError(result.compileError) : null),
    [result],
  );
  // エラーが参考ファイル側で起きたら、そのファイルを開いて見せる
  useEffect(() => {
    if (diagnostic?.file && diagnostic.file !== openFile) setOpenFile(diagnostic.file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic]);

  const editing = openFile === mainName;
  const openContent = editing ? source : (extraFiles.find(f => f.name === openFile)?.content || "");

  const passed = Boolean(
    result?.compiled
    && !result.timedOut
    && result.exitCode === 0
    && (!content.expect || String(result.stdout || "").trim() === String(content.expect).trim()),
  );

  function dismissHelp() {
    setHelpDismissed(true);
    try { localStorage.setItem(HELP_SEEN_KEY, "1"); } catch (e) { /* 保存できなくても動作は変わらない */ }
  }

  async function run() {
    if (state === "running") return;
    stopSpeech();                 // 実行中に読み上げが重なると聞き取れない
    setState("running");
    setErrorMsg("");
    setResult(null);
    const payload = {
      files: [{ name: mainName, content: source }, ...extraFiles.map(f => ({ name: f.name, content: f.content }))],
      entry: mainName,
      stdin: content.stdin || "",
    };
    try {
      let res = await apiPost("/learning/exercises/java/run", payload);
      // コンテナが冷えているときだけ初回が時間切れになる。黙って一度だけやり直す。
      if (res?.timedOut && res?.retryable) res = await apiPost("/learning/exercises/java/run", payload);
      if (!aliveRef.current) return;
      setResult(res);
      setState("done");

      const ok = Boolean(res?.compiled && !res.timedOut && res.exitCode === 0
        && (!content.expect || String(res.stdout || "").trim() === String(content.expect).trim()));
      if (lrn?.submitExercise && courseId && lessonId) {
        lrn.submitExercise({
          courseId, lessonId, slideId: slide.id, kind: "code_run",
          submittedAnswer: source, isCorrect: ok,
        }).catch(() => {});
      }
    } catch (e) {
      if (!aliveRef.current) return;
      setErrorMsg(e?.errorMessage || "コードを実行できませんでした。時間をおいてお試しください。");
      setState("idle");
    }
  }

  function reset() {
    setSource(content.source || "");
    setOpenFile(mainName);
    setResult(null);
    setState("idle");
    setErrorMsg("");
  }

  const outTone = !result ? "idle" : passed ? "ok" : "err";
  const OUT_STYLE = {
    idle: { dot: C.muted, fg: C.muted, label: "まだ実行していません" },
    ok: { dot: T.success, fg: T.success, label: "実行できました" },
    err: { dot: FOCUS, fg: FOCUS, label: result?.compiled ? "動かしてみたところ、うまくいきませんでした" : "コンパイルできませんでした" },
  }[outTone];

  const allFiles = [{ name: mainName, editable: true }, ...extraFiles.map(f => ({ name: f.name, editable: false }))];

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
        {/* はじめて開いた人にだけキー操作を出す。閉じたら以後は下の「使い方」から。 */}
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
          <span className="text-[12px] font-semibold" style={{ fontFamily: MONO, color: C.body }}>{openFile}</span>
          <span className="text-[10.5px] font-bold" style={{ color: C.muted, letterSpacing: "0.06em" }}>JAVA 21</span>
          {!editing && <span className="text-[10.5px] font-bold" style={{ color: C.muted }}>参考（編集できません）</span>}
          <span className="ml-auto flex items-center gap-2">
            <button type="button" onClick={reset}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition hover:bg-black/[.04]"
              style={{ border: `1px solid ${C.line}`, color: C.muted }}>
              <RotateCcw size={12} />最初に戻す
            </button>
            <button type="button" onClick={run} disabled={state === "running"}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: T.accent }}>
              {state === "running" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {state === "running" ? "実行中…" : "実行する"}
            </button>
          </span>
        </div>

        <div className="grid" style={{ gridTemplateColumns: allFiles.length > 1 ? "184px minmax(0,1fr)" : "minmax(0,1fr)" }}>
          {allFiles.length > 1 && (
            <aside className="p-2.5" style={{ background: C.canvas, borderRight: `1px solid ${C.line}` }}>
              <div className="px-1.5 pb-2 text-[10px] font-extrabold" style={{ color: C.muted, letterSpacing: "0.08em" }}>プロジェクト</div>
              <div className="px-1.5 text-[11.5px]" style={{ fontFamily: MONO, color: C.muted }}>{content.projectName || "java-basics"}/</div>
              <div className="pl-3 pt-0.5 text-[11.5px]" style={{ fontFamily: MONO, color: C.muted }}>src/</div>
              <ul className="m-0 list-none p-0 pl-3">
                {allFiles.map(f => (
                  <li key={f.name}>
                    <button
                      type="button"
                      onClick={() => setOpenFile(f.name)}
                      aria-current={openFile === f.name}
                      className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[11.5px] transition hover:bg-black/[.05]"
                      style={{
                        fontFamily: MONO,
                        color: openFile === f.name ? T.accentHover : C.body,
                        background: openFile === f.name ? T.accentSubtle : "transparent",
                        fontWeight: openFile === f.name ? 700 : 400,
                      }}
                    >
                      <FileCode2 size={11} className="shrink-0" />{f.name}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <JavaEditor
            key={`${slide.id}-${openFile}`}
            value={openContent}
            onChange={editing ? setSource : () => {}}
            readOnly={!editing}
            diagnostic={diagnostic && diagnostic.file === openFile ? diagnostic : null}
            level={content.completionLevel || 1}
            onRun={run}
          />
        </div>

        <div style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-[11.5px] font-extrabold"
            style={{ background: C.canvas, borderBottom: `1px solid ${C.line}`, color: OUT_STYLE.fg, letterSpacing: "0.05em" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: OUT_STYLE.dot }} />
            {OUT_STYLE.label}
            {passed && <CheckCircle2 size={14} />}
          </div>
          <pre className="m-0 overflow-x-auto px-4 py-3.5 text-[12px] leading-[1.8]"
            style={{ fontFamily: MONO, color: C.body, minHeight: 72, whiteSpace: "pre" }}>
            {!result && "実行するとここに結果が出ます。"}
            {result && !result.compiled && (result.compileError || "")}
            {result && result.compiled && (result.stdout || "")}
            {result && result.compiled && result.stderr ? `\n${result.stderr}` : ""}
            {result?.message ? `\n${result.message}` : ""}
          </pre>
          {result && (
            <div className="flex gap-3.5 px-4 pb-3 text-[10.5px]" style={{ color: C.muted }}>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>実行 {((result.durationMs || 0) / 1000).toFixed(2)} 秒</span>
              {result.outputTruncated && <span>出力が長いため途中までを表示しています</span>}
            </div>
          )}
        </div>

        <details open={showHelp} onToggle={e => setShowHelp(e.target.open)} style={{ borderTop: `1px solid ${C.line}` }}>
          <summary className="cursor-pointer list-none px-4 py-3 text-[12px] font-bold" style={{ color: C.body }}>
            {showHelp ? "－ " : "＋ "}使い方
          </summary>
          <table className="w-full border-collapse text-[12.5px]">
            <tbody>
              <tr><td className="w-[168px] whitespace-nowrap px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}`, color: C.body }}>Tab / Enter</td>
                <td className="px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}`, color: C.body }}>候補を確定します。候補が出ているときに改行したい場合は、先に Esc で閉じてください。候補が出ていないときの Tab は字下げです。</td></tr>
              <tr><td className="px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}`, color: C.body }}>Ctrl + Space</td>
                <td className="px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}`, color: C.body }}>候補を手動で出します。何を書けるか分からないときに。</td></tr>
              <tr><td className="px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}`, color: C.body }}>Shift + Tab</td>
                <td className="px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}`, color: C.body }}>字下げを1段戻します。複数行を選べばまとめて動きます。</td></tr>
              <tr><td className="px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}`, color: C.body }}>import の自動挿入</td>
                <td className="px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}`, color: C.body }}>Scanner のように宣言が必要なものを候補から選ぶと、上に import を自動で足します。</td></tr>
              <tr><td className="px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}`, color: C.body }}>赤い波線</td>
                <td className="px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}`, color: C.body }}>コンパイルできなかった場所です。javac が示した行と列に出ます。</td></tr>
            </tbody>
          </table>
        </details>
      </div>

      {errorMsg && <div className="mt-2 text-xs font-semibold" style={{ color: T.danger }}>{errorMsg}</div>}

      {/* いま書いているコードと実行結果について質問できる。
          答えのコードは返さない（Backendのプロンプト側で担保）。 */}
      <CodeQuestionBox
        courseId={courseId}
        lessonId={lessonId}
        slideId={slide.id}
        source={source}
        output={result ? (result.compiled ? [result.stdout, result.stderr].filter(Boolean).join("\n") : result.compileError) : ""}
        compiled={Boolean(result?.compiled)}
        hasResult={Boolean(result)}
      />

      {/* 結果に応じた解説。教材が用意した文言を出す（AIには投げない）。 */}
      {result && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl p-4" style={{ background: passed ? T.successSubtle : T.aiSubtle }}>
          <Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: passed ? T.success : T.aiAccentDeep }} />
          <div className="min-w-0">
            <div className="mb-1 text-[11.5px] font-extrabold" style={{ color: passed ? T.success : T.aiAccentDeep, letterSpacing: "0.04em" }}>
              {passed ? "できました" : "解説"}
            </div>
            <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-[1.85]" style={{ color: C.ink }}>
              {passed
                ? (content.successNote || "通りました。javac が翻訳して .class を作り、java がそれを実行しました。")
                : (result.compiled
                  ? (content.runtimeNote || "翻訳は通ったので、書き方は合っています。出力をよく見てください。")
                  : (content.compileNote || "エラーの行番号と ^ の位置が、直す場所をそのまま指しています。"))}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
