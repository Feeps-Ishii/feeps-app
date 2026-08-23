import React, { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, Radio, SkipForward } from "lucide-react";
import { T } from "../../components/common";
import { fetchSpeech, playSpeech, stopSpeech, subscribeSpeech } from "./lectureAudio.js";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border };

// 2026-08-24: 講義プレイヤー。
//
// PDFから作ったコース（ページ画像＋解説＋ノート）を、**カンペを読み上げながら自動で送る**。
// 動画(mp4)を作らずにこの形にしたのは、途中で止めて質問でき、演習を挟め、教材を直したら
// その場で反映されるから。音声はBackendでS3にキャッシュ済みなので、2回目以降は費用0。
//
// 止まる条件は3つだけ:
//   1. 演習ページに来たとき（解いてから自分で再開する）
//   2. 質問を開いたとき（onPauseRequestで外から止める）
//   3. 最後のページを読み終わったとき
const EXERCISE_KINDS = new Set(["quiz", "terminal", "selection_task", "ordering_puzzle", "fill_blank", "interactive_form"]);

// 読み上げる原稿。**ノートがあればノート、無ければ解説**。
// 表紙と中扉はそのページの言葉をそのまま読む（無音で飛ばすと、進んだことが分からない）。
export function lectureScriptFor(slide, lesson) {
  if (!slide) return "";
  if (slide.kind === "_cover") {
    return [lesson?.title, lesson?.goal].filter(Boolean).join("。");
  }
  if (slide.kind === "_divider") return "";
  const note = String(slide.note || "").trim();
  if (note) return note;
  return String(slide.caption || slide.content?.caption || "").trim();
}

export default function LecturePlayer({ slides, index, setIndex, lesson, paused, onPausedChange }) {
  const [state, setState] = useState("idle"); // idle | loading | playing | stopped_exercise | done
  const [rate, setRate] = useState(1);
  // いま読み上げている文（字幕）。本文のマーカーと同じ情報。
  const [caption, setCaption] = useState("");
  const aliveRef = useRef(true);
  const runIdRef = useRef(0);

  useEffect(() => subscribeSpeech(next => {
    setCaption(next.speaking ? (next.sentence || "") : "");
  }), []);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; stopSpeech(); };
  }, []);

  // 外から一時停止を頼まれたとき（質問を開いた等）
  useEffect(() => {
    if (paused && (state === "playing" || state === "loading")) {
      runIdRef.current += 1;
      stopSpeech();
      setState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const slide = slides[index];
  const isExercise = slide && EXERCISE_KINDS.has(slide.kind);
  const isLast = index >= slides.length - 1;

  function stop() {
    runIdRef.current += 1;
    stopSpeech();
    setState("idle");
  }

  // 1ページ読んで、終わったら次へ。ページ送りはこの関数の中だけで起きる。
  async function playFrom(startIndex) {
    const runId = ++runIdRef.current;
    let cursor = startIndex;

    while (aliveRef.current && runId === runIdRef.current) {
      const target = slides[cursor];
      if (!target) { setState("done"); return; }

      if (cursor !== index) setIndex(cursor);
      if (onPausedChange) onPausedChange(false);

      const script = lectureScriptFor(target, lesson);
      if (script) {
        setState("loading");
        let speech = { urls: [], chunks: [] };
        try {
          speech = await fetchSpeech(script);
        } catch (e) {
          // 音声が作れなくても講義は続ける（読むものは画面に出ている）。
          speech = { urls: [], chunks: [] };
        }
        if (runId !== runIdRef.current || !aliveRef.current) return;
        setState("playing");
        // sourceText を渡すと、解説・ノート側が「自分が読まれている」と分かり、
        // その文にマーカーが引かれる。
        const finished = await playSpeech(speech, { rate, sourceText: script });
        if (runId !== runIdRef.current || !aliveRef.current) return;
        if (!finished && speech.chunks.length) return; // 手動で止められた
      }

      // 演習ページは読み上げたところで止める。解いてから自分で再開してもらう。
      if (EXERCISE_KINDS.has(target.kind)) { setState("stopped_exercise"); return; }

      if (cursor >= slides.length - 1) { setState("done"); return; }
      cursor += 1;
    }
  }

  const playing = state === "playing" || state === "loading";

  return (
    <div className="mt-3 rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
      <button
        type="button"
        onClick={() => (playing ? stop() : playFrom(index))}
        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90"
        style={{ background: T.accent }}
      >
        {state === "loading" ? <Loader2 size={15} className="animate-spin" /> : playing ? <Pause size={15} /> : <Play size={15} />}
        {state === "loading" ? "準備中" : playing ? "一時停止" : state === "done" ? "もう一度再生" : index > 0 ? "ここから再生" : "講義を再生"}
      </button>

      {state === "stopped_exercise" && !isLast && (
        <button
          type="button"
          onClick={() => playFrom(index + 1)}
          className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[12.5px] font-bold transition hover:bg-black/[.04]"
          style={{ border: `1px solid ${C.line}`, color: C.ink }}
        >
          <SkipForward size={14} />解いたので続ける
        </button>
      )}

      <span className="text-[11.5px]" style={{ color: C.muted }}>
        {state === "stopped_exercise"
          ? "演習です。解いてから続きを再生してください。"
          : state === "done"
            ? "このレッスンの読み上げは終わりです。"
            : playing
              ? "読み上げ中は、質問を開くと一時停止します。"
              : isExercise
                ? "このページは演習です。"
                : "カンペ（ノート・解説）を読み上げながら、自動でページを送ります。"}
      </span>

      <label className="ml-auto flex items-center gap-1.5 text-[11.5px]" style={{ color: C.muted }}>
        速さ
        <select
          value={rate}
          onChange={e => setRate(Number(e.target.value))}
          className="rounded-lg px-2 py-1 text-[11.5px] outline-none"
          style={{ border: `1px solid ${C.line}`, color: C.ink, background: "#fff" }}
        >
          <option value={0.9}>0.9x</option>
          <option value={1}>1.0x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
        </select>
      </label>
      </div>

      {/* 字幕。読み上げている文をそのまま出す。本文側の同じ文にもマーカーが引かれる。 */}
      {caption && (
        <div
          className="flex items-start gap-2 rounded-b-2xl px-4 py-3"
          style={{ background: T.accentSubtle, borderTop: `1px solid ${C.line}` }}
        >
          <Radio size={14} className="mt-0.5 shrink-0" style={{ color: T.accent }} />
          <p className="text-[13.5px] font-semibold leading-[1.75]" style={{ color: C.ink }}>{caption}</p>
        </div>
      )}
    </div>
  );
}
