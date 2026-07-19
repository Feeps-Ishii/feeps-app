// ==========================================================================
// AI Lesson Designer（Learning管理画面「AI Lesson Designer」タブの本体）
// 目的: 「AIが教材を完成させる」のではなく「AIが講師の設計アシスタントとして
// コース設計・Lesson構成・講師メモまでを提案する」体験。
// ワークフローは3段階: STEP1 コース設計 → STEP2 Lesson単位のslides生成(このファイルが対応) →
// STEP3 ページ単位の部分再生成(将来実装)。
// STEP1では、コース情報を入力→AI生成（Bedrock実接続）→Lesson一覧表示（タイトル・
// 概要・学習目標・講師メモ・想定時間・難易度）→「このコースを保存する」で下書きコースとして
// 保存、まで動作する。保存は既存のcreateCourseAwaitingApi/createLessonAwaitingApi
// （useLearningAdmin.js）をそのまま呼ぶだけで、新しい保存の仕組み・本格編集UIは作らない。
// 保存後もpublished:falseの下書きのままで、公開は既存の管理画面（LessonManager.jsx等）で行う運用。
// 各Lessonカードの「このLessonを生成」ボタン（STEP2）は、concept/diagram/table/summary/
// quiz(選択式)の5kindのみをBedrockで生成する(ADR 0005)。生成結果はコース保存前の
// result.lessons[i].slidesに保持され、まだDBには保存されない。「このコースを保存する」を
// 押した時に、STEP1の他フィールドと一緒にまとめて保存される（useAiLessonDesigner.js参照）。
// image/video/pdf_page(将来)はAIが実素材を生成できないため対象外、管理画面での手動追加のみ。
// 到達経路: LearningAdminProduct.jsx の「AI Lesson Designer」タブ。
// ==========================================================================
import React, { useEffect, useState } from "react";
import {
  Sparkles, Loader2, AlertCircle, Save, CheckCircle2, Lightbulb, Clock, Wand2, Eye, Layers3, ArrowRight,
} from "lucide-react";
import { T, NOVA, PRODUCT_ACCENT, Field, fieldStyle, Seg, EmptyState } from "../../../../components/common";
import { useAiLessonDesigner } from "./useAiLessonDesigner.js";
import { useLearningAdmin } from "../useLearningAdmin.js";

const ACCENT = PRODUCT_ACCENT.learning.accent;
const C = {
  ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border,
};

const STUDIO_STEPS = ["設計条件", "AI構成案", "Lesson生成", "人が確認", "公開準備"];

function StudioWorkflow({ activeStep }) {
  return (
    <ol className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" aria-label="Learning Studioの制作フロー">
      {STUDIO_STEPS.map((label, index) => {
        const step = index + 1;
        const active = step === activeStep;
        const passed = step < activeStep;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex min-w-0 items-center gap-2 rounded-xl px-3 py-2.5"
            style={{
              background: active ? PRODUCT_ACCENT.learning.subtle : passed ? NOVA.soft : NOVA.card,
              border: `1px solid ${active ? ACCENT : NOVA.line}`,
            }}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: active ? ACCENT : passed ? PRODUCT_ACCENT.learning.deep : T.bgBase, color: active || passed ? NOVA.onDark : C.muted }}
            >
              {passed ? "✓" : step}
            </span>
            <span className="truncate text-xs font-bold" style={{ color: active ? PRODUCT_ACCENT.learning.deep : C.ink }}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Banner() {
  return (
    <div className="mx-auto mb-4 max-w-[1200px] text-xs" style={{ color: C.muted }}>
      AIは構成案とLessonを下書きします。講師が生成内容を確認して保存し、コース管理で公開します。
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="mb-2.5 text-xs font-bold uppercase" style={{ color: C.muted, letterSpacing: "0.08em" }}>{children}</div>;
}

// ---- 左: コース情報フォーム。この内容がAIに渡す設計条件 ----
function LeftForm({ brief, setBriefField }) {
  const set = key => e => setBriefField(key, e.target.value);
  return (
    <div className="w-full space-y-4 rounded-2xl p-6 lg:w-[320px] lg:shrink-0" style={{ background: NOVA.card, border: `1px solid ${C.line}` }}>
      <div>
        <div className="text-xs font-bold uppercase" style={{ color: ACCENT, letterSpacing: "0.08em" }}>1. 設計条件</div>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>目的・対象・時間・素材をAIへ渡す設計ブリーフです。</p>
      </div>
      <Field label="目的・到達点">
        <textarea style={{ ...fieldStyle, resize: "none" }} rows={3} value={brief.goals} onChange={set("goals")} placeholder="例: AWSの基本サービスを理解し、自分で触って試せるようになる" />
      </Field>
      <Field label="対象者">
        <input style={fieldStyle} value={brief.audience} onChange={set("audience")} placeholder="例: AWSを学び始める新卒エンジニア" />
      </Field>
      <Field label="学習時間">
        <input style={fieldStyle} value={brief.duration} onChange={set("duration")} placeholder="例: 1回30分 × 全4回" />
      </Field>
      <Field label="難易度">
        <Seg value={brief.difficulty} onChange={v => setBriefField("difficulty", v)} options={["初級", "中級", "上級"]} activeFg={ACCENT} />
      </Field>
      <Field label="素材・扱う技術">
        <input style={fieldStyle} value={brief.techs} onChange={set("techs")} placeholder="例: EC2, S3, IAM" />
      </Field>
    </div>
  );
}

// Lesson一覧の1枚。「このLessonを生成」(STEP2)はconcept/diagram/table/summary/quiz(選択式)
// の5kindのみをBedrockで生成する(ADR 0005)。生成結果はlesson.slidesに保持され、まだDBには
// 保存されない(「このコースを保存する」を押した時に一緒に保存される)。
function slideOutline(slide = {}) {
  const content = slide.content || {};
  const text = slide.caption
    || content.body
    || slide.interaction?.question
    || content.question
    || (Array.isArray(content.points) ? content.points.join(" / ") : "");
  return String(text || "内容は保存後のLesson Studioで確認できます。").slice(0, 140);
}

function LessonCard({ index, lesson, slideGen, onGenerateSlides, reviewed, onToggleReview }) {
  const status = slideGen?.status || "idle";
  const slideCount = (lesson.slides || []).length;
  return (
    <div className="rounded-2xl p-4" style={{ background: NOVA.card, border: `1px solid ${reviewed ? ACCENT : C.line}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: ACCENT, color: NOVA.onDark }}>{index + 1}</span>
            <span className="text-sm font-bold" style={{ color: C.ink }}>{lesson.title}</span>
          </div>
          {lesson.summary && <p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>{lesson.summary}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {lesson.difficulty && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: T.bgBase, color: C.muted }}>{lesson.difficulty}</span>
          )}
          {lesson.estimatedMinutes > 0 && (
            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: T.bgBase, color: C.muted }}>
              <Clock size={10} />{lesson.estimatedMinutes}分
            </span>
          )}
        </div>
      </div>

      {lesson.goal && (
        <div className="mt-3 rounded-xl p-3" style={{ background: T.bgBase }}>
          <div className="mb-1 text-[11px] font-bold" style={{ color: C.muted }}>学習目標</div>
          <p className="text-xs leading-relaxed" style={{ color: C.body }}>{lesson.goal}</p>
        </div>
      )}

      {lesson.teacherMemo && (
        <div className="mt-2 rounded-xl p-3" style={{ background: T.aiSubtle, border: `1px solid ${T.aiAccent}30` }}>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: T.aiAccentDeep }}>
            <Lightbulb size={12} />講師メモ
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed" style={{ color: C.body }}>{lesson.teacherMemo}</p>
        </div>
      )}

      {status === "error" && (
        <div className="mt-3 rounded-xl p-3" style={{ background: T.dangerSubtle, border: `1px solid ${T.danger}30` }}>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: T.danger }}>
            <AlertCircle size={12} />スライド生成に失敗しました
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed" style={{ color: C.body }}>{slideGen.notice}</p>
        </div>
      )}

      {slideCount > 0 && (
        <details className="mt-3 rounded-xl p-3" style={{ background: T.bgBase, border: `1px solid ${C.line}` }}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold" style={{ color: C.ink }}>
            <Eye size={13} style={{ color: ACCENT }} />生成した{slideCount}ページを確認
          </summary>
          <div className="mt-3 space-y-2">
            {lesson.slides.map((slide, slideIndex) => (
              <div key={slide.id || slideIndex} className="rounded-lg p-2.5" style={{ background: NOVA.card, border: `1px solid ${NOVA.line}` }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold" style={{ color: ACCENT }}>{slideIndex + 1}. {slide.kind || "concept"}</span>
                  <span className="truncate text-xs font-bold" style={{ color: C.ink }}>{slide.title || slide.navLabel || "無題のページ"}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed" style={{ color: C.muted }}>{slideOutline(slide)}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {slideCount > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: PRODUCT_ACCENT.learning.subtle, color: PRODUCT_ACCENT.learning.accent }}>
            {slideCount}枚のスライドを生成済み
          </span>
        )}
        <button
          type="button"
          onClick={() => onGenerateSlides(lesson.id)}
          disabled={status === "loading"}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-60"
          style={{ border: `1px solid ${C.line}`, color: C.muted }}
        >
          {status === "loading" ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          {status === "loading" ? "生成しています..." : slideCount > 0 ? "このLessonを再生成" : "このLessonを生成"}
        </button>
        <button
          type="button"
          onClick={() => onToggleReview(lesson.id)}
          disabled={slideCount === 0 || status === "loading"}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-40"
          style={{ background: reviewed ? ACCENT : NOVA.card, border: `1px solid ${reviewed ? ACCENT : C.line}`, color: reviewed ? NOVA.onDark : C.body }}
        >
          <CheckCircle2 size={12} />{reviewed ? "確認済み" : "内容を確認した"}
        </button>
      </div>
    </div>
  );
}

// ---- 右: 生成ボタン＋結果。idle→loading→done/errorの4状態 ----
function RightGenerationPanel({
  genState, onGenerate, generatedFor, notice, result, saveState, saveNotice, onSave,
  slideGenByLessonId, onGenerateSlides, onGenerateAll, generatingAll,
  reviewedLessonIds, onToggleReview, canSave, onOpenCourseManager,
}) {
  return (
    <div className="min-w-0 flex-1 space-y-5">
      <div className="rounded-2xl p-6" style={{ background: T.aiSubtle, border: `1px solid ${T.aiAccent}30` }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: T.aiAccentDeep }}>
            <Sparkles size={18} color={NOVA.onDark} />
          </span>
          <div>
            <div className="text-sm font-bold" style={{ color: T.textPrimary }}>AI生成プレビュー</div>
            <div className="text-xs" style={{ color: T.textSecondary }}>AIがコース構成とLessonを設計します</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={genState === "loading"}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: T.aiAccentDeep }}
        >
          {genState === "loading" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {genState === "loading" ? "設計中..." : "コースを設計する"}
        </button>
      </div>

      {genState === "idle" && (
        <div className="rounded-2xl" style={{ background: NOVA.card, border: `1px solid ${C.line}` }}>
          <EmptyState icon={Sparkles} title="まだコースは設計されていません" desc="左の情報を入力し、「コースを設計する」を押してください。" />
        </div>
      )}

      {genState === "loading" && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl py-14" style={{ background: NOVA.card, border: `1px solid ${C.line}` }}>
          <Loader2 size={28} className="animate-spin" style={{ color: T.aiAccentDeep }} />
          <div className="text-sm font-semibold" style={{ color: C.body }}>AIがコース構成を設計しています...</div>
        </div>
      )}

      {genState === "error" && (
        <div className="rounded-2xl p-5" style={{ background: T.dangerSubtle, border: `1px solid ${T.danger}30` }}>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: T.danger }}>
            <AlertCircle size={15} />生成に失敗しました
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed" style={{ color: C.body }}>{notice}</p>
        </div>
      )}

      {genState === "done" && result && (
        <div className="space-y-4">
          {generatedFor && (
            <div className="rounded-xl p-3 text-xs leading-relaxed" style={{ background: T.bgBase, color: C.muted }}>
              <span className="font-bold" style={{ color: C.body }}>この条件で設計しました：</span>
              {" "}対象者「{generatedFor.audience || "未指定"}」・学習時間「{generatedFor.duration || "未指定"}」・難易度「{generatedFor.difficulty}」・技術「{generatedFor.techs || "未指定"}」
            </div>
          )}
          <div className="rounded-2xl p-6" style={{ background: NOVA.card, border: `1px solid ${C.line}` }}>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-lg font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{result.course.title}</h2>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: T.aiSubtle, color: T.aiAccentDeep }}>AIが設計</span>
            </div>
            <p className="text-xs" style={{ color: C.muted }}>全{result.lessons.length}Lesson構成</p>
          </div>
          <div>
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <SectionLabel>Lesson生成と確認</SectionLabel>
              <button
                type="button"
                onClick={onGenerateAll}
                disabled={generatingAll}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition hover:opacity-80 disabled:opacity-50"
                style={{ background: T.aiSubtle, border: `1px solid ${T.aiAccent}30`, color: T.aiAccentDeep }}
              >
                {generatingAll ? <Loader2 size={12} className="animate-spin" /> : <Layers3 size={12} />}
                {generatingAll ? "Lessonを順に生成中..." : "全Lessonを生成"}
              </button>
            </div>
            <div className="space-y-3">
              {result.lessons.map((lesson, i) => (
                <LessonCard
                  key={lesson.id}
                  index={i}
                  lesson={lesson}
                  slideGen={slideGenByLessonId[lesson.id]}
                  onGenerateSlides={onGenerateSlides}
                  reviewed={reviewedLessonIds.includes(lesson.id)}
                  onToggleReview={onToggleReview}
                />
              ))}
            </div>
          </div>

          {saveState === "done" ? (
            <div className="rounded-2xl p-4" style={{ background: PRODUCT_ACCENT.learning.subtle, border: `1px solid ${PRODUCT_ACCENT.learning.accent}30` }}>
              <div className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: PRODUCT_ACCENT.learning.accent }}>
                <CheckCircle2 size={15} />保存しました
              </div>
              <p className="text-xs leading-relaxed" style={{ color: C.body }}>{saveNotice}</p>
              <button
                type="button"
                onClick={onOpenCourseManager}
                className="mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition hover:opacity-80"
                style={{ background: ACCENT, color: NOVA.onDark }}
              >
                コース管理で公開準備へ<ArrowRight size={12} />
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={onSave}
                disabled={saveState === "saving" || !canSave}
                className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                style={{ background: ACCENT }}
              >
                {saveState === "saving" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {saveState === "saving" ? "保存しています..." : "確認済みの内容を下書き保存"}
              </button>
              {!canSave && (
                <p className="mt-2 text-center text-[11px]" style={{ color: C.muted }}>
                  全Lessonを生成し、各カードの「内容を確認した」を押すと保存できます。
                </p>
              )}
            </div>
          )}
          {saveState === "error" && (
            <div className="rounded-2xl p-4" style={{ background: T.dangerSubtle, border: `1px solid ${T.danger}30` }}>
              <div className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: T.danger }}>
                <AlertCircle size={15} />保存に失敗しました
              </div>
              <p className="text-xs leading-relaxed" style={{ color: C.body }}>{saveNotice}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AiLessonDesigner({ onOpenCourseManager }) {
  const {
    brief, setBriefField, genState, notice, result, generatedFor, generate, saveState, saveNotice, saveGenerated,
    slideGenByLessonId, generateLessonSlides,
  } = useAiLessonDesigner();
  const learningAdmin = useLearningAdmin();
  const [reviewedLessonIds, setReviewedLessonIds] = useState([]);
  const [generatingAll, setGeneratingAll] = useState(false);
  const allGenerated = !!result?.lessons?.length && result.lessons.every(lesson => (lesson.slides || []).length > 0);
  const allReviewed = allGenerated && result.lessons.every(lesson => reviewedLessonIds.includes(lesson.id));
  const activeStep = saveState === "done" || allReviewed ? 5 : allGenerated ? 4 : result ? 3 : genState === "loading" ? 2 : 1;

  useEffect(() => {
    setReviewedLessonIds([]);
    setGeneratingAll(false);
  }, [generatedFor]);

  async function handleGenerateSlides(lessonId) {
    setReviewedLessonIds(prev => prev.filter(id => id !== lessonId));
    return generateLessonSlides(lessonId);
  }

  async function handleGenerateAll() {
    if (!result?.lessons?.length || generatingAll) return;
    setGeneratingAll(true);
    try {
      for (const lesson of result.lessons) {
        await handleGenerateSlides(lesson.id);
      }
    } finally {
      setGeneratingAll(false);
    }
  }

  function toggleReviewed(lessonId) {
    const lesson = result?.lessons?.find(item => item.id === lessonId);
    if (!(lesson?.slides || []).length) return;
    setReviewedLessonIds(prev => prev.includes(lessonId) ? prev.filter(id => id !== lessonId) : [...prev, lessonId]);
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: T.aiAccentDeep }}>
          <Sparkles size={17} color={NOVA.onDark} />
        </span>
        <div>
          <h3 className="text-base font-bold" style={{ color: C.ink }}>Learning Studio</h3>
          <p className="text-xs" style={{ color: C.muted }}>目的からAI構成案を作り、Lesson生成、人の確認、公開準備までを一つの流れで進めます。</p>
        </div>
      </div>
      <Banner />
      <StudioWorkflow activeStep={activeStep} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <LeftForm brief={brief} setBriefField={setBriefField} />
        <RightGenerationPanel
          genState={genState}
          onGenerate={generate}
          generatedFor={generatedFor}
          notice={notice}
          result={result}
          saveState={saveState}
          saveNotice={saveNotice}
          onSave={() => saveGenerated(learningAdmin)}
          slideGenByLessonId={slideGenByLessonId}
          onGenerateSlides={handleGenerateSlides}
          onGenerateAll={handleGenerateAll}
          generatingAll={generatingAll}
          reviewedLessonIds={reviewedLessonIds}
          onToggleReview={toggleReviewed}
          canSave={allReviewed}
          onOpenCourseManager={onOpenCourseManager}
        />
      </div>
    </div>
  );
}
