import React, { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Sparkles, StickyNote } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { T } from "../../components/common";
import { apiPost } from "../../api.js";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

// 2026-08-21: スライドの下に置く2つの読み物。
//   要約(caption) = AIが書く短い説明。スライドの補足。
//   ノート(note)  = 管理者が書く詳しい説明。Markdown。空なら出さない。
// どちらにも読み上げボタンを付ける。音声はBackendでS3にキャッシュされるので、
// 同じ教材を何度読ませても費用がかかるのは最初の1回だけ。

// 読み上げは1つの画面で同時に鳴らない方がよいので、再生中のaudioを1つだけ持つ。
let currentAudio = null;
function stopCurrent() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

function SpeakButton({ text }) {
  const [state, setState] = useState("idle"); // idle | loading | playing
  const urlsRef = useRef(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; stopCurrent(); };
  }, []);
  // テキストが変わったら（＝別のページへ移ったら）音声を作り直す
  useEffect(() => { urlsRef.current = null; setState("idle"); stopCurrent(); }, [text]);

  // 長いノートは複数の音声に分かれて返るので、順番に再生する。
  function playFrom(urls, index) {
    if (index >= urls.length) { setState("idle"); return; }
    const audio = new Audio(urls[index]);
    currentAudio = audio;
    audio.onended = () => { if (aliveRef.current) playFrom(urls, index + 1); };
    audio.onerror = () => { if (aliveRef.current) setState("idle"); };
    audio.play().catch(() => { if (aliveRef.current) setState("idle"); });
  }

  async function handleClick() {
    if (state === "playing") { stopCurrent(); setState("idle"); return; }
    stopCurrent();
    if (urlsRef.current) { setState("playing"); playFrom(urlsRef.current, 0); return; }
    setState("loading");
    try {
      const res = await apiPost("/learning/tts", { text });
      if (!aliveRef.current) return;
      urlsRef.current = res.urls || [];
      if (!urlsRef.current.length) { setState("idle"); return; }
      setState("playing");
      playFrom(urlsRef.current, 0);
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

export function SlideNarration({ text }) {
  if (!text) return null;
  return (
    <div className="mt-4 rounded-2xl p-4 sm:p-[18px]" style={{ background: T.bgBase, border: "1px solid rgba(26,28,31,.07)" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <Sparkles size={13} style={{ color: C.muted }} />
          <span className="text-[12px] font-bold" style={{ color: C.muted, letterSpacing: "0.04em" }}>解説</span>
        </span>
        <SpeakButton text={text} />
      </div>
      <p className="text-sm leading-[1.9]" style={{ color: C.body, maxWidth: "68ch" }}>{text}</p>
    </div>
  );
}

export function SlideNote({ note }) {
  if (!note || !String(note).trim()) return null;
  return (
    <div className="mt-3 rounded-2xl p-4 sm:p-[18px]" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <StickyNote size={13} style={{ color: T.accent }} />
          <span className="text-[12px] font-bold" style={{ color: T.accent, letterSpacing: "0.04em" }}>ノート</span>
        </span>
        <SpeakButton text={note} />
      </div>
      <div className="feeps-lesson-md text-[14.5px] leading-[1.9]" style={{ color: C.body, maxWidth: "68ch" }}>
        <ReactMarkdown>{note}</ReactMarkdown>
      </div>
    </div>
  );
}
