import React from "react";
import { NOVA, PRODUCT_ACCENT, T } from "../../components/common";

export const LEARNING_EXPERIENCE_STAGES = [
  { key: "explanation", label: "短い説明", detail: "要点を小さくつかむ" },
  { key: "example", label: "例", detail: "図や比較で具体化" },
  { key: "practice", label: "操作・演習", detail: "自分で選ぶ・動かす" },
  { key: "feedback", label: "即時フィードバック", detail: "その場で理解を修正" },
  { key: "review", label: "復習", detail: "不安な箇所へ戻る" },
  { key: "final", label: "総合テスト", detail: "サーバー採点で確認" },
];

const PRACTICE_KINDS = new Set([
  "terminal", "quiz", "selection_task", "ordering_puzzle", "fill_blank", "interactive_form",
]);
const EXAMPLE_KINDS = new Set(["image", "diagram", "table", "video", "compare", "pdf_page"]);

export function learningStageForSlide(slide, index = 0) {
  const kind = String(slide?.kind || "").toLowerCase();
  if (kind === "summary") return "review";
  if (PRACTICE_KINDS.has(kind)) return "practice";
  if (EXAMPLE_KINDS.has(kind)) return "example";
  return index === 0 ? "explanation" : "example";
}

export default function LearningExperienceFlow({ activeKey = "", compact = false, className = "" }) {
  const activeIndex = LEARNING_EXPERIENCE_STAGES.findIndex(stage => stage.key === activeKey);
  return (
    <section
      className={`rounded-2xl p-4 ${className}`}
      aria-label="学習体験の流れ"
      style={{ background: NOVA.card, border: `1px solid ${NOVA.line}`, boxShadow: NOVA.shadowSm }}
    >
      {!compact && (
        <div className="mb-3">
          <div className="text-sm font-bold" style={{ color: T.textPrimary }}>読むだけで終わらない学習フロー</div>
          <p className="mt-0.5 text-xs" style={{ color: T.textMuted }}>理解して、試して、すぐ直し、最後に総合テストで確かめます。</p>
        </div>
      )}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {LEARNING_EXPERIENCE_STAGES.map((stage, index) => {
          const active = stage.key === activeKey;
          const passed = activeIndex >= 0 && index < activeIndex;
          return (
            <li
              key={stage.key}
              aria-current={active ? "step" : undefined}
              className="min-w-0 rounded-xl p-2.5"
              style={{
                background: active ? PRODUCT_ACCENT.learning.subtle : passed ? NOVA.soft : T.bgBase,
                border: `1px solid ${active ? PRODUCT_ACCENT.learning.accent : NOVA.line}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: active ? PRODUCT_ACCENT.learning.accent : passed ? PRODUCT_ACCENT.learning.deep : NOVA.card,
                    color: active || passed ? NOVA.onDark : T.textMuted,
                  }}
                >
                  {index + 1}
                </span>
                <span className="truncate text-[11px] font-bold" style={{ color: active ? PRODUCT_ACCENT.learning.deep : T.textPrimary }}>
                  {stage.label}
                </span>
              </div>
              {!compact && <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: T.textMuted }}>{stage.detail}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
