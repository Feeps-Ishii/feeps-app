// ==========================================================================
// AI Lesson Designer（Learning管理画面「AI Lesson Designer」タブの本体）
// 目的: 「AIが教材を完成させる」のではなく「AIが講師の設計アシスタントとして
// コース設計・Lesson構成・講師メモまでを提案する」体験。
// ワークフローは3段階: STEP1 コース設計(このファイルが対応) → STEP2 Lesson単位の
// slides/動画/terminal/quiz生成(将来実装) → STEP3 ページ単位の部分再生成(将来実装)。
// このSTEP1では、コース情報を入力→AI生成（Bedrock実接続）→Lesson一覧表示（タイトル・
// 概要・学習目標・講師メモ・想定時間・難易度）→「このコースを保存する」で下書きコースとして
// 保存、まで動作する。保存は既存のcreateCourse/createLesson（useLearningAdmin.js）をそのまま
// 呼ぶだけで、新しい保存の仕組み・本格編集UIは作らない。保存するLessonにslidesは持たせない
// （このSTEPではslides/動画/terminal/quizを一切生成しない）。保存後もpublished:falseの
// 下書きのままで、公開は既存の管理画面（LessonManager.jsx等、今回は触らない）で行う運用。
// 各Lessonカードの「このLessonを生成」ボタンは、将来のSTEP2（Lesson単位でのslides生成）
// のための導線プレースホルダーで、押しても何も起きない（Coming Soon）。
// 到達経路: LearningAdminProduct.jsx の「AI Lesson Designer」タブ。
// ==========================================================================
import React from "react";
import {
  Sparkles, Loader2, AlertCircle, Save, CheckCircle2, Lightbulb, Clock, Wand2,
} from "lucide-react";
import { T, PRODUCT_ACCENT, Field, fieldStyle, Seg, EmptyState } from "../../../../components/common";
import { useAiLessonDesigner } from "./useAiLessonDesigner.js";
import { useLearningAdmin } from "../useLearningAdmin.js";

const ACCENT = PRODUCT_ACCENT.learning.accent;
const C = {
  ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, page: "#FAFAF9",
};

function Banner() {
  return (
    <div className="mx-auto mb-4 max-w-[1200px] text-xs" style={{ color: C.muted }}>
      保存すると下書きコースとして作成されます。内容の確認・公開は「コース管理」「レッスン管理」タブから行ってください。
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
    <div className="w-full space-y-4 rounded-2xl p-6 lg:w-[320px] lg:shrink-0" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
      <div>
        <div className="text-xs font-bold uppercase" style={{ color: ACCENT, letterSpacing: "0.08em" }}>コース情報</div>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>この条件をもとに、AIがコース構成とLessonを設計します。</p>
      </div>
      <Field label="対象者">
        <input style={fieldStyle} value={brief.audience} onChange={set("audience")} placeholder="例: AWSを学び始める新卒エンジニア" />
      </Field>
      <Field label="学習時間">
        <input style={fieldStyle} value={brief.duration} onChange={set("duration")} placeholder="例: 1回30分 × 全4回" />
      </Field>
      <Field label="難易度">
        <Seg value={brief.difficulty} onChange={v => setBriefField("difficulty", v)} options={["初級", "中級", "上級"]} activeFg={ACCENT} />
      </Field>
      <Field label="学習ゴール">
        <textarea style={{ ...fieldStyle, resize: "none" }} rows={3} value={brief.goals} onChange={set("goals")} placeholder="例: AWSの基本サービスを理解し、自分で触って試せるようになる" />
      </Field>
      <Field label="扱う技術">
        <input style={fieldStyle} value={brief.techs} onChange={set("techs")} placeholder="例: EC2, S3, IAM" />
      </Field>
    </div>
  );
}

// Lesson一覧の1枚。slides等は持たない(STEP1はコース設計まで)。「このLessonを生成」は
// 将来のLesson単位生成(STEP2)への導線プレースホルダーで、押しても何も起きない。
function LessonCard({ index, lesson }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: ACCENT, color: "#fff" }}>{index + 1}</span>
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

      <div className="mt-3 flex items-center justify-end">
        <button
          type="button"
          onClick={() => {}}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
          style={{ border: `1px solid ${C.line}`, color: C.muted }}
        >
          <Wand2 size={12} />このLessonを生成
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: T.bgBase, color: C.muted }}>Coming Soon</span>
        </button>
      </div>
    </div>
  );
}

// ---- 右: 生成ボタン＋結果。idle→loading→done/errorの4状態 ----
function RightGenerationPanel({ genState, onGenerate, generatedFor, notice, result, saveState, saveNotice, onSave }) {
  return (
    <div className="min-w-0 flex-1 space-y-5">
      <div className="rounded-2xl p-6" style={{ background: T.aiSubtle, border: `1px solid ${T.aiAccent}30` }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: T.aiAccentDeep }}>
            <Sparkles size={18} color="#fff" />
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
        <div className="rounded-2xl" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          <EmptyState icon={Sparkles} title="まだコースは設計されていません" desc="左の情報を入力し、「コースを設計する」を押してください。" />
        </div>
      )}

      {genState === "loading" && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl py-14" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
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
          <div className="rounded-2xl p-6" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-lg font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{result.course.title}</h2>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: T.aiSubtle, color: T.aiAccentDeep }}>AIが設計</span>
            </div>
            <p className="text-xs" style={{ color: C.muted }}>全{result.lessons.length}Lesson構成</p>
          </div>
          <div>
            <SectionLabel>Lesson一覧</SectionLabel>
            <div className="space-y-3">
              {result.lessons.map((lesson, i) => (
                <LessonCard key={lesson.id} index={i} lesson={lesson} />
              ))}
            </div>
          </div>

          {saveState === "done" ? (
            <div className="rounded-2xl p-4" style={{ background: PRODUCT_ACCENT.learning.subtle, border: `1px solid ${PRODUCT_ACCENT.learning.accent}30` }}>
              <div className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: PRODUCT_ACCENT.learning.accent }}>
                <CheckCircle2 size={15} />保存しました
              </div>
              <p className="text-xs leading-relaxed" style={{ color: C.body }}>{saveNotice}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSave}
              disabled={saveState === "saving"}
              className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: ACCENT }}
            >
              {saveState === "saving" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saveState === "saving" ? "保存しています..." : "このコースを保存する"}
            </button>
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

export default function AiLessonDesigner() {
  const { brief, setBriefField, genState, notice, result, generatedFor, generate, saveState, saveNotice, saveGenerated } = useAiLessonDesigner();
  const learningAdmin = useLearningAdmin();

  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: T.aiAccentDeep }}>
          <Sparkles size={17} color="#fff" />
        </span>
        <div>
          <h3 className="text-base font-bold" style={{ color: C.ink }}>AI Lesson Designer</h3>
          <p className="text-xs" style={{ color: C.muted }}>条件を入力すると、AIがコース設計・Lesson構成・講師メモを提案します。</p>
        </div>
      </div>
      <Banner />

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
        />
      </div>
    </div>
  );
}
