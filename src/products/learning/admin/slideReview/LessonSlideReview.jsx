import React, { useEffect, useState } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, Plus, Save, Sparkles, X } from "lucide-react";
import { Btn, T } from "../../../../components/common";
import AdminModal from "../AdminModal.jsx";
import { lessonToForm } from "../useLearningAdmin.js";
import AdminSlidePreview from "./AdminSlidePreview.jsx";
import { REVISABLE_KINDS, useAiSlideReview } from "./useAiSlideReview.js";

// AI Lesson Studio Phase2「スライド確認」画面。既存の「スライド編集」(LessonSlideEditor.jsx)とは
// 別の、教材をレビューする専用画面。AIへの自然文修正依頼・追加スライド生成→差分プレビュー→
// 適用/破棄という一連の流れをここで完結させる。DB保存は行わず、適用結果はこの画面内のローカル
// slides stateにのみ反映する。最終的な永続化は既存の「保存する」ボタン(updateLesson、
// LessonSlideEditorと同一の保存経路)でのみ行う — 勝手な自動保存は行わない。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

let idSeq = 0;
function nextSlideId() {
  idSeq += 1;
  return `slide-review-${Date.now()}-${idSeq}`;
}

const HISTORY_STATUS_LABEL = { applied: "適用済", discarded: "破棄" };

function HistoryList({ history }) {
  if (!history.length) return null;
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold" style={{ color: C.muted }}>AIレビュー履歴</div>
      <div className="space-y-1.5">
        {history.map((h, i) => (
          <div key={h.id}>
            <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: C.canvas }}>
              <span className="min-w-0 flex-1 truncate" style={{ color: C.ink }}>{h.text}</span>
              <span className="shrink-0 font-semibold" style={{ color: h.status === "applied" ? "#15803d" : C.muted }}>
                {HISTORY_STATUS_LABEL[h.status] || h.status}
              </span>
            </div>
            {i < history.length - 1 && <div className="my-1 border-t" style={{ borderColor: C.line }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingDiff({ pending, onApply, onDiscard }) {
  if (!pending) return null;
  return (
    <div className="space-y-3 rounded-2xl p-4" style={{ background: C.canvas, border: `1px solid ${C.line}` }}>
      <div className="text-sm font-bold" style={{ color: C.ink }}>
        {pending.type === "revise" ? "AIによる修正案" : `AIによる追加スライド案（${pending.slides.length}枚）`}
      </div>
      <div className="text-xs" style={{ color: C.muted }}>依頼内容: {pending.instruction}</div>

      {pending.type === "revise" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl p-3" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
            <div className="mb-2 text-[11px] font-bold uppercase" style={{ color: C.muted }}>変更前</div>
            <AdminSlidePreview slide={pending.original} />
          </div>
          <div className="rounded-xl p-3" style={{ background: "#fff", border: `1.5px solid ${T.accent}` }}>
            <div className="mb-2 text-[11px] font-bold uppercase" style={{ color: T.accent }}>変更後</div>
            <AdminSlidePreview slide={pending.revised} />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.slides.map((s, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: "#fff", border: `1.5px solid ${T.accent}` }}>
              <AdminSlidePreview slide={s} />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Btn kind="ghost" size="sm" icon={X} onClick={onDiscard}>破棄</Btn>
        <Btn kind="ai" size="sm" icon={Check} onClick={onApply}>適用</Btn>
      </div>
    </div>
  );
}

export default function LessonSlideReview({ open, course, lesson, updateLesson, onClose }) {
  const [slides, setSlides] = useState(() => lesson?.slides || []);
  const [index, setIndex] = useState(0);
  const ai = useAiSlideReview();

  useEffect(() => {
    if (open) {
      setSlides(lesson?.slides || []);
      setIndex(0);
      ai.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson]);

  if (!open || !lesson) return null;

  const currentSlide = slides[index] || null;
  const canRevise = currentSlide && REVISABLE_KINDS.includes(currentSlide.kind);

  function handleRevise() {
    ai.reviseCurrent({ course, lesson, currentSlide });
  }

  function handleAddSlides() {
    ai.addSlides({
      course,
      lesson,
      existingSlidesOutline: slides.map(s => ({ kind: s.kind, title: s.title })),
    });
  }

  function handleApply() {
    const applied = ai.applyPending();
    if (!applied) return;
    if (applied.type === "revise") {
      setSlides(prev => prev.map((s, i) => (i === index ? applied.revised : s)));
    } else {
      const newSlides = applied.slides.map(s => ({ ...s, id: nextSlideId() }));
      setSlides(prev => {
        const next = [...prev];
        next.splice(index + 1, 0, ...newSlides);
        return next.map((s, i) => ({ ...s, order: i }));
      });
      setIndex(i => i + 1);
    }
  }

  function handleSave() {
    updateLesson(course.id, lesson.id, { ...lessonToForm(lesson), slides });
    onClose();
  }

  return (
    <AdminModal open={open} title="スライド確認" desc={`Lesson: ${lesson.title}（教材をレビューする画面です）`} onClose={onClose} width={1000}>
      <div className="space-y-4">
        {slides.length ? (
          <>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setIndex(i => Math.max(0, i - 1))}
                disabled={index <= 0}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-black/5 disabled:opacity-25"
                style={{ color: C.ink }}
              >
                <ChevronLeft size={14} />前へ
              </button>
              <span className="text-xs font-semibold tabular-nums" style={{ color: C.body }}>{index + 1} / {slides.length}</span>
              <button
                type="button"
                onClick={() => setIndex(i => Math.min(slides.length - 1, i + 1))}
                disabled={index >= slides.length - 1}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:bg-black/5 disabled:opacity-25"
                style={{ color: C.ink }}
              >
                次へ<ChevronRight size={14} />
              </button>
            </div>

            <div className="rounded-2xl p-5" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
              <AdminSlidePreview slide={currentSlide} />
            </div>

            {ai.pending ? (
              <PendingDiff pending={ai.pending} onApply={handleApply} onDiscard={ai.discardPending} />
            ) : (
              <div className="space-y-2.5 rounded-2xl p-4" style={{ background: C.canvas }}>
                <div className="text-sm font-bold" style={{ color: C.ink }}>AIへ依頼</div>
                <p className="text-[11px] leading-relaxed" style={{ color: C.muted }}>
                  例: 「もっと初心者向けにして」「AWSとの違いを追加」「図を追加」「クイズを増やして」「説明を短く」など。このスライドの内容を修正するか、新しいスライドを追加するかを下のボタンで選べます。
                </p>
                <textarea
                  value={ai.requestText}
                  onChange={e => ai.setRequestText(e.target.value)}
                  disabled={ai.state === "loading"}
                  rows={3}
                  placeholder="修正・追加してほしい内容を自然文で入力してください"
                  className="w-full resize-y rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-70"
                  style={{ border: `1px solid ${C.line}`, color: C.ink, background: "#fff" }}
                />
                {!canRevise && (
                  <p className="text-[11px]" style={{ color: C.muted }}>
                    このスライド種別（画像・動画・ターミナル）はAI修正の対象外です。「スライドを追加」のみ利用できます。
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Btn
                    kind="ai" size="sm" icon={ai.state === "loading" ? Loader2 : Sparkles}
                    onClick={handleRevise}
                    disabled={ai.state === "loading" || !ai.requestText.trim() || !canRevise}
                  >
                    {ai.state === "loading" ? "処理中…" : "このスライドを修正する"}
                  </Btn>
                  <Btn
                    kind="ai" size="sm" icon={ai.state === "loading" ? Loader2 : Plus}
                    onClick={handleAddSlides}
                    disabled={ai.state === "loading" || !ai.requestText.trim()}
                  >
                    {ai.state === "loading" ? "処理中…" : "スライドを追加する"}
                  </Btn>
                </div>
                {ai.state === "error" && ai.notice && (
                  <div className="flex items-start gap-2 rounded-xl p-3 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    <div className="whitespace-pre-wrap">{ai.notice}</div>
                  </div>
                )}
              </div>
            )}

            <HistoryList history={ai.history} />
          </>
        ) : (
          <div className="rounded-xl p-4 text-center text-xs" style={{ background: C.canvas, color: C.muted }}>
            まだスライドがありません。先に「スライド編集」からスライドを追加してください。
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: C.line }}>
          <Btn kind="ghost" icon={X} onClick={onClose}>キャンセル</Btn>
          <Btn icon={Save} onClick={handleSave} disabled={!slides.length}>保存する</Btn>
        </div>
      </div>
    </AdminModal>
  );
}
