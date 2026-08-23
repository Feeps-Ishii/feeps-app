import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play, Sparkles, StickyNote } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { T } from "../../components/common";
import { fetchSpeech, playSpeech, stopSpeech } from "./lectureAudio.js";
import { SpeechMarked, useSpeechCue } from "./speechHighlight.jsx";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

// 2026-08-21: スライドの下に置く2つの読み物。
//   要約(caption) = AIが書く短い説明。スライドの補足。
//   ノート(note)  = 管理者が書く詳しい説明。Markdown。空なら出さない。
// どちらにも読み上げボタンを付ける。音声はBackendでS3にキャッシュされるので、
// 同じ教材を何度読ませても費用がかかるのは最初の1回だけ。
//
// 2026-08-24: 読み上げ中は**その文にマーカーを引く**（どこを説明しているかを示す）。
// 光らせる場所は lectureAudio が配る「いま読んでいる文」。判定は speechHighlight.jsx。

// 再生中の音声は画面で1つだけ（講義プレイヤーとも共有する）。管理は lectureAudio.js。

function SpeakButton({ text }) {
  const [state, setState] = useState("idle"); // idle | loading | playing
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; stopSpeech(); };
  }, []);
  // 別のページへ移ったら状態を戻す（音声は lectureAudio 側で止まる）
  useEffect(() => { setState("idle"); }, [text]);

  async function handleClick() {
    if (state === "playing" || state === "loading") { stopSpeech(); setState("idle"); return; }
    setState("loading");
    try {
      const speech = await fetchSpeech(text);
      if (!aliveRef.current) return;
      if (!speech.chunks.length) { setState("idle"); return; }
      setState("playing");
      await playSpeech(speech, { sourceText: String(text || "") });
      if (aliveRef.current) setState("idle");
    } catch (e) {
      if (aliveRef.current) setState("idle");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={state === "playing" ? "読み上げを止める" : "読み上げる"}
      className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition hover:bg-black/[.04]"
      style={{ border: `1px solid ${C.line}`, color: C.muted, background: "#fff" }}
    >
      {state === "loading" ? <Loader2 size={12} className="animate-spin" /> : state === "playing" ? <Pause size={12} /> : <Play size={12} />}
      {state === "loading" ? "準備中" : state === "playing" ? "停止" : "読み上げ"}
    </button>
  );
}

// 読み上げ中のカードだけ枠を強調する（どのブロックを説明中か、ひと目で分かるように）。
function speakingFrame(active, baseBorder) {
  if (!active) return { border: `1px solid ${baseBorder}` };
  return { border: `1px solid ${T.accent}`, boxShadow: `0 0 0 3px ${T.accentSubtle}` };
}

export function SlideNarration({ text }) {
  const cue = useSpeechCue(text || "");
  if (!text) return null;
  return (
    <div
      className="mt-4 rounded-2xl p-4 sm:p-[18px]"
      style={{ background: T.bgBase, ...speakingFrame(Boolean(cue), "rgba(26,28,31,.07)") }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <Sparkles size={13} style={{ color: C.muted }} />
          <span className="text-[12px] font-bold" style={{ color: C.muted, letterSpacing: "0.04em" }}>解説</span>
        </span>
        <SpeakButton text={text} />
      </div>
      <p className="text-sm leading-[1.9]" style={{ color: C.body, maxWidth: "68ch" }}>
        <SpeechMarked sentence={cue?.sentence}>{text}</SpeechMarked>
      </p>
    </div>
  );
}

export function SlideNote({ note }) {
  const cue = useSpeechCue(note || "");
  const sentence = cue?.sentence || "";
  // Markdownの各ブロックの中から、読み上げ中の文を探してマーカーを引く。
  // 記号（**や#）は描画時に消えているので、そのまま文字列で照合できる。
  const components = useMemo(() => {
    if (!sentence) return undefined;
    const wrap = Tag => ({ node, children, ...props }) => (
      <Tag {...props}><SpeechMarked sentence={sentence}>{children}</SpeechMarked></Tag>
    );
    return { p: wrap("p"), li: wrap("li"), h1: wrap("h1"), h2: wrap("h2"), h3: wrap("h3"), td: wrap("td"), blockquote: wrap("blockquote") };
  }, [sentence]);

  if (!note || !String(note).trim()) return null;
  return (
    <div
      className="mt-3 rounded-2xl p-4 sm:p-[18px]"
      style={{ background: "#fff", ...speakingFrame(Boolean(cue), C.line) }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <StickyNote size={13} style={{ color: T.accent }} />
          <span className="text-[12px] font-bold" style={{ color: T.accent, letterSpacing: "0.04em" }}>ノート</span>
        </span>
        <SpeakButton text={note} />
      </div>
      <div className="feeps-lesson-md text-[14.5px] leading-[1.9]" style={{ color: C.body, maxWidth: "68ch" }}>
        <ReactMarkdown components={components}>{note}</ReactMarkdown>
      </div>
    </div>
  );
}
