// ==========================================================================
// AIコーススタジオ（Learning管理画面「Learning Studio」タブの本体）
// 目的: 「AIが教材を完成させる」のではなく「AIが講師の設計アシスタントとして
// コース設計・Lesson構成・演習・総合テスト・講師メモまでを提案する」体験。
//
// 2026-08-19 UI再設計（承認モック: mock/course-studio）:
//   旧UIは5ステップのチップ（設計条件→AI構成案→Lesson生成→人が確認→公開準備）を常時
//   出していたが、実際には画面が切り替わらないため表示と操作が対応していなかった。
//   またLessonを1件ずつ手動ボタンで生成させており、4本なら4回押す必要があった。
//   新UIは「作っているコースそのものが画面」になる構成へ変更:
//     ・ステップ表示を廃止し、残りの仕事は左レールの「公開までにやること」で示す
//     ・構成案ができたら全Lessonを自動で順に生成し、進捗を各行に出す
//     ・条件は左レールに常設（案Aの粒度）し、「変更」でフォームを開く
//     ・入口で「つくり方」を選ぶ。将来のAI相談モードもここへ足す（切替はヘッダー）
//
// 生成の内訳（変更なし）: STEP1 コース構成 → STEP2 Lessonごとのスライド → STEP3 総合テスト。
// いずれも非同期ジョブ経由（ADR 0018）。保存は既存の
// createCourseAwaitingApi/createLessonAwaitingApi をそのまま呼ぶだけで、
// 保存後もpublished:falseの下書き。公開はコース管理の「公開する」で行う運用。
// 到達経路: LearningAdminProduct.jsx の「Learning Studio」タブ。
// ==========================================================================
import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle, Eye, FileText, Loader2, PlayCircle, Save, Sparkles,
} from "lucide-react";
import { T, NOVA, Field, fieldStyle, Seg, Btn } from "../../../../components/common";
import { useAiLessonDesigner } from "./useAiLessonDesigner.js";
import { useLearningAdmin } from "../useLearningAdmin.js";
import CourseWalkthroughPreview from "../CourseWalkthroughPreview.jsx";
import {
  ACCENT, C, StartChooser, ConditionCard, TodoCard, SummaryCard,
  LessonRow, FinalTestSection, SavedPanel, courseTotals,
} from "./studioParts.jsx";

// AI相談モードは次のデプロイで追加する（会話→条件抽出のAPIが要るため）。
// フラグだけ先に置き、入口とヘッダーの切替はこの1箇所で有効化できるようにしておく。
const CHAT_MODE_ENABLED = false;

// ---- 条件フォーム（「変更」で開く。初回は最初から開いている） ----
function BriefForm({ brief, setBriefField, onGenerate, genState, canGenerate, onCancel }) {
  const set = key => e => setBriefField(key, e.target.value);
  return (
    <div className="rounded-2xl" style={{ background: NOVA.card, border: `1px solid ${C.line}`, boxShadow: NOVA.shadowSm, padding: 22 }}>
      <div className="mb-4">
        <h3 className="text-[15px] font-bold" style={{ color: C.ink }}>つくる条件</h3>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>目的・対象・時間・素材をAIへ渡します。</p>
      </div>
      <div className="space-y-3.5">
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
          <Seg value={brief.difficulty} onChange={v => setBriefField("difficulty", v)} options={["初級", "中級", "上級"]} activeFg={T.accent} />
        </Field>
        <Field label="素材・扱う技術">
          <input style={fieldStyle} value={brief.techs} onChange={set("techs")} placeholder="例: EC2, S3, IAM" />
        </Field>
        <label className="flex items-start gap-2 rounded-xl p-3 text-xs" style={{ background: T.bgBase, color: C.body }}>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={brief.exercisesEnabled !== false}
            onChange={e => setBriefField("exercisesEnabled", e.target.checked)}
          />
          <span>
            <span className="font-bold" style={{ color: C.ink }}>演習・実技を含めて生成する</span>
            <br />疑似端末・選択課題・並び替え・穴埋めなどの演習をLessonごとに一緒に生成します。
          </span>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {onCancel && <Btn kind="ghost" size="sm" onClick={onCancel}>キャンセル</Btn>}
        <Btn kind="ai" icon={genState === "loading" ? Loader2 : Sparkles} disabled={genState === "loading" || !canGenerate} onClick={onGenerate}>
          {genState === "loading" ? "設計中…" : "コースを設計する"}
        </Btn>
      </div>
      {!canGenerate && (
        <p className="mt-2 text-right text-[11px]" style={{ color: C.muted }}>目的・到達点を入力すると設計できます。</p>
      )}
    </div>
  );
}

export default function AiLessonDesigner({ onOpenCourseManager }) {
  const {
    brief, setBriefField, genState, notice, result, generatedFor, generate, saveState, saveNotice, saveGenerated,
    slideGenByLessonId, generateLessonSlides,
    finalTestState, finalTestNotice, finalTestQuestions, generateFinalTest,
  } = useAiLessonDesigner();
  const learningAdmin = useLearningAdmin();

  // null = まだ「つくり方」を選んでいない（入口の選択を出す）
  const [mode, setMode] = useState(null);
  const [briefOpen, setBriefOpen] = useState(true);
  const [reviewedLessonIds, setReviewedLessonIds] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detailLessonId, setDetailLessonId] = useState("");
  // 構成案ができたら全Lessonを1回だけ自動生成する。同じ結果に対して二重に走らせないため
  // generatedForをキーにして記録する（旧UIは1件ずつ手動でボタンを押す必要があった）。
  const autoRunRef = useRef(null);
  // 自動生成ループは依存を最小にしたいので、最新のresultはrefから読む
  const resultRef = useRef(null);

  const lessons = result?.lessons || [];
  resultRef.current = result;
  const allGenerated = lessons.length > 0 && lessons.every(l => (l.slides || []).length > 0);
  const reviewedCount = lessons.filter(l => reviewedLessonIds.includes(l.id)).length;
  const allReviewed = lessons.length > 0 && reviewedCount === lessons.length;
  const totals = courseTotals(lessons);
  const anyGenerating = Object.values(slideGenByLessonId || {}).some(s => s?.status === "loading");

  useEffect(() => {
    setReviewedLessonIds([]);
    setDetailLessonId("");
    if (generatedFor) setBriefOpen(false);
  }, [generatedFor]);

  // 構成案ができた直後に、全Lessonを順に生成する。
  //
  // 依存の選び方に2つ罠がある（どちらも実機で踏んだ）:
  //  1. generatedForは「生成を開始した時点」で設定される（resultより先）。generatedForだけを
  //     依存にすると、resultがまだ無い状態で空振りして二度と走らない
  //  2. resultを依存に入れると、Lessonを1件生成するたびにresultが変わってcleanupが走り、
  //     ループが中断される（実際に2件目で止まった）
  // そこで「Lessonの本数」という、スライド生成中は変化しない値をキーにする。
  const lessonCount = lessons.length;
  useEffect(() => {
    if (!generatedFor || lessonCount === 0) return;
    if (autoRunRef.current === generatedFor) return;
    autoRunRef.current = generatedFor;
    let cancelled = false;
    const targets = (resultRef.current?.lessons || []).filter(l => !(l.slides || []).length).map(l => l.id);
    (async () => {
      for (const lessonId of targets) {
        if (cancelled) return;
        await generateLessonSlides(lessonId);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedFor, lessonCount]);

  async function handleRegenerate(lessonId) {
    setReviewedLessonIds(prev => prev.filter(id => id !== lessonId));
    return generateLessonSlides(lessonId);
  }

  function toggleReviewed(lessonId) {
    const lesson = lessons.find(item => item.id === lessonId);
    if (!(lesson?.slides || []).length) return;
    setReviewedLessonIds(prev => prev.includes(lessonId) ? prev.filter(id => id !== lessonId) : [...prev, lessonId]);
  }

  // ---- 入口: つくり方を選ぶ ----
  if (mode === null && !result) {
    return (
      <div className="py-6">
        <StartChooser
          chatEnabled={CHAT_MODE_ENABLED}
          onPickForm={() => { setMode("form"); setBriefOpen(true); }}
          onPickChat={() => { setMode("chat"); setBriefOpen(true); }}
          onSelfBuild={onOpenCourseManager}
        />
      </div>
    );
  }

  const detailLesson = lessons.find(l => l.id === detailLessonId) || null;

  return (
    <div>
      {/* ---- ヘッダー: 作っているコースが主役 ---- */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: T.aiSubtle, color: T.aiAccentDeep }}>下書き</span>
            {saveState === "done" && <span className="text-[11.5px]" style={{ color: C.muted }}>保存済み</span>}
          </div>
          <h2 className="text-[22px] font-bold leading-tight" style={{ color: C.ink, letterSpacing: "-0.02em" }}>
            {result?.course?.title || "新しいコース"}
          </h2>
          {!result && <p className="mt-1 text-xs" style={{ color: C.muted }}>条件を入れると、AIが構成案とLessonを下書きします。</p>}
        </div>
        {result && (
          <div className="flex flex-wrap items-center gap-2">
            <Btn kind="ghost" size="sm" icon={Eye} onClick={() => setPreviewOpen(true)}>受講生の見え方</Btn>
            {saveState !== "done" && (
              <Btn
                size="sm"
                icon={saveState === "saving" ? Loader2 : Save}
                disabled={saveState === "saving" || !allReviewed}
                onClick={() => saveGenerated(learningAdmin)}
              >
                {saveState === "saving" ? "保存しています…" : "下書きを保存"}
              </Btn>
            )}
          </div>
        )}
      </div>

      {genState === "error" && (
        <div className="mb-4 rounded-2xl p-4" style={{ background: T.dangerSubtle, border: `1px solid ${T.danger}30` }}>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: T.danger }}>
            <AlertCircle size={15} />生成に失敗しました
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed" style={{ color: C.body }}>{notice}</p>
        </div>
      )}
      {genState === "loading" && notice && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl p-4" style={{ background: T.aiSubtle, border: `1px solid ${T.aiAccent}30` }}>
          <Loader2 size={15} className="animate-spin" style={{ color: T.aiAccentDeep }} />
          <span className="text-xs font-semibold" style={{ color: T.aiAccentDeep }}>{notice}</span>
        </div>
      )}
      {saveState === "error" && (
        <div className="mb-4 rounded-2xl p-4" style={{ background: T.dangerSubtle, border: `1px solid ${T.danger}30` }}>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: T.danger }}>
            <AlertCircle size={15} />保存に失敗しました
          </div>
          <p className="text-xs leading-relaxed" style={{ color: C.body }}>{saveNotice}</p>
        </div>
      )}

      {/* 条件フォームは、まだ生成していないか「変更」を押したときだけ開く */}
      {briefOpen ? (
        <div className="mx-auto max-w-[620px]">
          <BriefForm
            brief={brief}
            setBriefField={setBriefField}
            onGenerate={generate}
            genState={genState}
            canGenerate={!!brief.goals.trim()}
            onCancel={result ? () => setBriefOpen(false) : null}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* ---- 左レール ---- */}
          <div className="flex w-full flex-col gap-3 lg:w-[300px] lg:shrink-0">
            <ConditionCard brief={brief} onEdit={() => setBriefOpen(true)} />
            <TodoCard
              hasBrief={!!generatedFor}
              lessonsTotal={lessons.length}
              lessonsReviewed={reviewedCount}
              hasFinalTest={finalTestQuestions.length > 0}
              saved={saveState === "done"}
            />
            <SummaryCard totals={totals} />
          </div>

          {/* ---- 本体: できあがっていくコース ---- */}
          <div className="min-w-0 flex-1 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[15px] font-bold" style={{ color: C.ink }}>{lessons.length}つのLesson</h2>
              <span className="h-px flex-1" style={{ background: C.line }} />
              <span className="text-xs" style={{ color: C.muted }}>
                {anyGenerating ? "作成中…" : `${reviewedCount}件を確認しました`}
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl" style={{ background: NOVA.card, border: `1px solid ${C.line}`, boxShadow: NOVA.shadowSm }}>
              {lessons.map((lesson, i) => (
                <LessonRow
                  key={lesson.id}
                  index={i}
                  lesson={lesson}
                  slideGen={slideGenByLessonId[lesson.id]}
                  reviewed={reviewedLessonIds.includes(lesson.id)}
                  onToggleReview={toggleReviewed}
                  onRegenerate={handleRegenerate}
                  onOpenDetail={setDetailLessonId}
                  last={i === lessons.length - 1}
                />
              ))}
            </div>

            {!allReviewed && allGenerated && (
              <p className="text-center text-[11.5px]" style={{ color: C.muted }}>
                各Lessonの「開く」で中身を確かめ、チェックを付けると保存できます。
              </p>
            )}

            <FinalTestSection
              state={finalTestState}
              notice={finalTestNotice}
              questions={finalTestQuestions}
              canGenerate={allGenerated}
              onGenerate={generateFinalTest}
            />

            {saveState === "done" && <SavedPanel saveNotice={saveNotice} onOpenCourseManager={onOpenCourseManager} />}
          </div>
        </div>
      )}

      {/* ---- Lessonの中身（「開く」） ---- */}
      {detailLesson && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" style={{ background: "rgba(21,26,44,.42)" }} onClick={() => setDetailLessonId("")}>
          <div className="w-full max-w-[720px] rounded-2xl" style={{ background: NOVA.card, boxShadow: NOVA.shadowMd }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b p-5" style={{ borderColor: C.line }}>
              <div className="min-w-0">
                <h3 className="text-base font-bold" style={{ color: C.ink }}>{detailLesson.title}</h3>
                {detailLesson.goal && <p className="mt-1 text-xs leading-relaxed" style={{ color: C.body }}>{detailLesson.goal}</p>}
              </div>
              <Btn kind="ghost" size="sm" onClick={() => setDetailLessonId("")}>閉じる</Btn>
            </div>
            <div className="max-h-[62vh] space-y-2 overflow-y-auto p-5">
              {detailLesson.teacherMemo && (
                <div className="mb-3 rounded-xl p-3" style={{ background: T.aiSubtle, border: `1px solid ${T.aiAccent}30` }}>
                  <div className="mb-1 text-[11px] font-bold" style={{ color: T.aiAccentDeep }}>講師メモ</div>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed" style={{ color: C.body }}>{detailLesson.teacherMemo}</p>
                </div>
              )}
              {(detailLesson.slides || []).map((slide, i) => (
                <div key={slide.id || i} className="rounded-xl p-3" style={{ background: T.bgBase, border: `1px solid ${C.line}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold" style={{ color: T.accent }}>{i + 1}. {slide.kind || "concept"}</span>
                    <span className="truncate text-xs font-bold" style={{ color: C.ink }}>{slide.title || slide.navLabel || "無題のページ"}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: C.body }}>
                    {slide.content?.body || slide.interaction?.question || slide.content?.question
                      || (Array.isArray(slide.content?.points) ? slide.content.points.join(" / ") : "")}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: C.line }}>
              <Btn kind="ghost" size="sm" icon={PlayCircle} onClick={() => { setDetailLessonId(""); setPreviewOpen(true); }}>受講生の見え方で確認</Btn>
              <Btn
                size="sm"
                onClick={() => { toggleReviewed(detailLesson.id); setDetailLessonId(""); }}
              >
                {reviewedLessonIds.includes(detailLesson.id) ? "確認済みを解除" : "確認した"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {result && (
        <CourseWalkthroughPreview
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          course={{ id: "preview-course", title: result.course.title, desc: result.course.desc, color: ACCENT }}
          lessons={result.lessons}
          finalTestQuestions={finalTestQuestions}
        />
      )}
    </div>
  );
}

export { FileText };
