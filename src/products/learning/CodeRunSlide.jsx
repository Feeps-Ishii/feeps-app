import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Play, RotateCcw, Sparkles } from "lucide-react";
import { T } from "../../components/common";
import { apiPost } from "../../api.js";
import { SlideEyebrowText } from "./SlideLayouts.jsx";
import { stopSpeech } from "./lectureAudio.js";

// 2026-08-25: 受講者がコードを書いて、**本当にコンパイル・実行する**演習。
// 承認モック: mock/lecture-devenv/index.html
//
// これまでの演習は入力文字列の一致で、出力は固定文だった。ここはLambdaで
// javac/java が動き、エラーメッセージも行番号も本物が返る。だから
// 「エラーの読み方」を教材にできる。
//
// 判定は expect と出力を突き合わせるだけ。**採点の正典は増やさない**
// （記録は既存の /learning/exercises/submit に寄せる）。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const LINE_HEIGHT = 23;
const PAD_TOP = 14;

// javacのエラー文から行番号を取る（例: Hello.java:3: error: ';' expected）
function errorLine(text) {
  const m = String(text || "").match(/^[^\s:]+\.java:(\d+):/m);
  return m ? Number(m[1]) : 0;
}

export default function CodeRunSlide({ slide, content = {}, lrn, courseId, lessonId }) {
  const initial = content.source || "";
  const [source, setSource] = useState(initial);
  const [state, setState] = useState("idle"); // idle | running | done
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const aliveRef = useRef(true);
  const taRef = useRef(null);
  const gutterRef = useRef(null);

  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);
  // 別のページへ移ったら書きかけを引きずらない
  useEffect(() => { setSource(content.source || ""); setResult(null); setState("idle"); setErrorMsg(""); }, [slide.id]);

  const lines = useMemo(() => source.split("\n"), [source]);
  const hitLine = result && !result.compiled ? errorLine(result.compileError) : 0;

  // 期待する出力と一致したか。**判定はここだけ**で、部分一致は取らない
  // （「たまたま含まれていた」を正解にしない）。
  const passed = Boolean(
    result?.compiled
    && !result.timedOut
    && result.exitCode === 0
    && (!content.expect || String(result.stdout || "").trim() === String(content.expect).trim()),
  );

  async function run() {
    if (state === "running") return;
    stopSpeech();                 // 実行中に読み上げが重なると聞き取れない
    setState("running");
    setErrorMsg("");
    setResult(null);
    try {
      let res = await apiPost("/learning/exercises/java/run", {
        source,
        stdin: content.stdin || "",
        filename: content.filename || "",
      });
      // コンテナが冷えているときだけ初回が時間切れになる。黙って一度だけやり直す。
      if (res?.timedOut && res?.retryable) {
        res = await apiPost("/learning/exercises/java/run", {
          source, stdin: content.stdin || "", filename: content.filename || "",
        });
      }
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
    setResult(null);
    setState("idle");
    setErrorMsg("");
  }

  // 別ウィンドウ表示（承認モックの「別ウィンドウ」）は、書きかけのコードを
  // 両画面で同期させる必要があるため次段階で実装する。中身の無いボタンは置かない。

  const outTone = !result ? "idle" : passed ? "ok" : "err";
  const OUT_STYLE = {
    idle: { dot: C.muted, fg: C.muted, label: "まだ実行していません" },
    ok: { dot: T.success, fg: T.success, label: "実行できました" },
    err: { dot: "#E8542F", fg: "#E8542F", label: result?.compiled ? "動かしてみたところ、うまくいきませんでした" : "コンパイルできませんでした" },
  }[outTone];

  return (
    <div>
      <SlideEyebrowText chapter={content.chapter} chapterTitle={content.chapterTitle} />
      <h3 className="mb-4 text-[24px] font-extrabold leading-[1.4]" style={{ color: C.ink, letterSpacing: "-0.025em" }}>{slide.title}</h3>
      {content.intro && <p className="mb-4 text-[14.5px] leading-[1.95]" style={{ color: C.body, maxWidth: "64ch" }}>{content.intro}</p>}

      {content.task && (
        <div data-focus="run-task" className="mb-4 rounded-xl p-4" style={{ background: C.canvas, border: `1px solid ${C.line}`, borderLeft: `3px solid ${T.accent}` }}>
          <div className="mb-1.5 text-[10.5px] font-extrabold" style={{ color: T.accent, letterSpacing: "0.1em" }}>やること</div>
          <p className="m-0 text-[14.5px] font-bold leading-[1.75]" style={{ color: C.ink }}>{content.task}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.line}` }}>
        <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5" style={{ background: C.canvas, borderBottom: `1px solid ${C.line}` }}>
          <span className="text-[12px] font-semibold" style={{ fontFamily: MONO, color: C.body }}>{content.filename || "Main.java"}</span>
          <span className="text-[10.5px] font-bold" style={{ color: C.muted, letterSpacing: "0.06em" }}>JAVA 21</span>
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

        <div className="grid" style={{ gridTemplateColumns: "44px minmax(0,1fr)", background: "#0F141C" }}>
          <div ref={gutterRef} className="overflow-hidden py-[14px] text-right">
            {lines.map((_, i) => (
              <span key={i} className="block pr-2.5"
                style={{
                  fontFamily: MONO, fontSize: 12.5, lineHeight: `${LINE_HEIGHT}px`,
                  color: hitLine === i + 1 ? "#fff" : "#5B6779",
                  background: hitLine === i + 1 ? "#E8542F" : "transparent",
                  fontWeight: hitLine === i + 1 ? 700 : 400,
                  borderRadius: hitLine === i + 1 ? "4px 0 0 4px" : 0,
                }}
              >{i + 1}</span>
            ))}
          </div>
          <div className="relative">
            {hitLine > 0 && (
              <div className="pointer-events-none absolute left-0 right-0"
                style={{ top: PAD_TOP + (hitLine - 1) * LINE_HEIGHT, height: LINE_HEIGHT, background: "rgba(232,84,47,.14)", borderLeft: "2px solid #E8542F" }} />
            )}
            <textarea
              ref={taRef}
              value={source}
              onChange={e => setSource(e.target.value)}
              onScroll={e => { if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop; }}
              spellCheck={false}
              aria-label="Javaのコード"
              className="block w-full resize-y border-0 bg-transparent outline-none"
              style={{
                fontFamily: MONO, fontSize: 12.5, lineHeight: `${LINE_HEIGHT}px`, color: "#DCE3EE",
                minHeight: 170, padding: `${PAD_TOP}px 14px ${PAD_TOP}px 4px`, whiteSpace: "pre", overflowX: "auto",
              }}
            />
          </div>
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
      </div>

      {errorMsg && <div className="mt-2 text-xs font-semibold" style={{ color: T.danger }}>{errorMsg}</div>}

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
