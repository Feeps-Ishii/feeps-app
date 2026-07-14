import { useState } from "react";
import { apiPost } from "../../../../api.js";

// AI Lesson Studio Phase2で追加したAI修正/追加依頼用Hook。既存スライドへの自然文修正依頼、および
// 追加スライド生成の呼び出しと、適用前の差分プレビュー状態・履歴(Lesson保存前のみ、DB保存なし)
// を管理する。保存(Lessonへの反映)は行わない — 呼び出し側(2026-07-15〜 LessonSlideStudio、
// 旧LessonSlideReview画面から移設)が適用時に自身のslides配列stateを更新し、最終的な永続化は
// 既存の「保存する」ボタン経由で行う。

// AI修正の対象外kind(実素材依存。ADR0005/0006参照): image/video/terminal
// 2026-07-14 Phase3: selection_task/ordering_puzzle/fill_blank/interactive_form(操作できる
// 教材)を追加。Backend側のREVISABLE_KINDS(services/bedrock.mjs)と一致させること。
export const REVISABLE_KINDS = ["concept", "diagram", "table", "compare", "quiz", "summary", "selection_task", "ordering_puzzle", "fill_blank", "interactive_form"];

let idSeq = 0;
function nextId(prefix) {
  idSeq += 1;
  return `${prefix}-${Date.now()}-${idSeq}`;
}

export function useAiSlideReview() {
  const [requestText, setRequestText] = useState("");
  const [state, setState] = useState("idle"); // idle | loading | error
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(null); // { type: "revise", original, revised } | { type: "add", slides }
  const [history, setHistory] = useState([]); // [{ id, text, type, status: "applied" | "discarded" }]

  function reset() {
    setRequestText("");
    setState("idle");
    setNotice("");
    setPending(null);
    setHistory([]);
  }

  async function reviseCurrent({ course, lesson, currentSlide }) {
    const instruction = requestText.trim();
    if (!instruction || state === "loading" || !lesson || !currentSlide) return;
    setState("loading");
    setNotice("");
    try {
      const data = await apiPost(`/learning/admin/ai-lesson-studio/lessons/${lesson.id}/slides/revise`, {
        slide: currentSlide,
        instruction,
      });
      if (!data?.slide) throw new Error("修正結果が返りませんでした。");
      setPending({ type: "revise", original: currentSlide, revised: { ...currentSlide, ...data.slide }, instruction });
      setState("idle");
    } catch (e) {
      const debug = [e?.errorCode, e?.errorMessage, e?.hint].filter(Boolean).join("\n");
      setNotice(debug || e?.message || "AI修正に失敗しました。依頼内容を調整して再試行してください。");
      setState("error");
    }
  }

  async function addSlides({ course, lesson, existingSlidesOutline }) {
    const instruction = requestText.trim();
    if (!instruction || state === "loading" || !lesson) return;
    setState("loading");
    setNotice("");
    try {
      const data = await apiPost(`/learning/admin/ai-lesson-studio/lessons/${lesson.id}/slides/add`, {
        instruction,
        existingSlidesOutline,
      });
      const slides = Array.isArray(data?.slides) ? data.slides : [];
      if (!slides.length) throw new Error("追加スライドが返りませんでした。");
      setPending({ type: "add", slides, instruction });
      setState("idle");
    } catch (e) {
      const debug = [e?.errorCode, e?.errorMessage, e?.hint].filter(Boolean).join("\n");
      setNotice(debug || e?.message || "AI生成に失敗しました。依頼内容を調整して再試行してください。");
      setState("error");
    }
  }

  function applyPending() {
    if (!pending) return null;
    setHistory(prev => [{ id: nextId("hist"), text: pending.instruction, type: pending.type, status: "applied" }, ...prev]);
    const applied = pending;
    setPending(null);
    setRequestText("");
    return applied;
  }

  function discardPending() {
    if (!pending) return;
    setHistory(prev => [{ id: nextId("hist"), text: pending.instruction, type: pending.type, status: "discarded" }, ...prev]);
    setPending(null);
  }

  return {
    requestText, setRequestText,
    state, notice, pending, history,
    reviseCurrent, addSlides, applyPending, discardPending, reset,
  };
}
