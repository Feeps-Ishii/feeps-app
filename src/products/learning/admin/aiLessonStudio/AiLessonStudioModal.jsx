import React from "react";
import { AlertCircle, CheckCircle2, FileText, HelpCircle, Loader2, Scale, Sparkles } from "lucide-react";
import { Btn, T } from "../../../../components/common";
import AdminModal from "../AdminModal.jsx";
import { useAiLessonStudio } from "./useAiLessonStudio.js";

// AI Lesson Studio Phase1のモーダル。docs/design/ai-lesson-studio-wireframe.md §2-4準拠。
// 左: 生成設定 / 右: 生成予定プレビュー → 生成後は右側が生成結果一覧(採用/除外)に切り替わる。
// 生成対象kindはconcept/compare/quiz/summaryの4種のみ(Phase1)。図解/AI画像/疑似環境の
// トグルはこのPhaseでは生成内容に影響しない(次Phase以降で対応、UIのみ先行実装)。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

const LEVEL_OPTIONS = [
  { value: "beginner", label: "初学者" },
  { value: "practical", label: "実務向け" },
  { value: "certification", label: "資格試験向け" },
  { value: "manager", label: "管理者向け" },
  { value: "custom", label: "カスタム" },
];

const STYLE_OPTIONS = [
  { value: "balanced", label: "バランス" },
  { value: "explanation", label: "説明重視" },
  { value: "diagram", label: "図解重視" },
  { value: "exercise", label: "演習重視" },
  { value: "quiz", label: "クイズ重視" },
];

const EXERCISE_VOLUME_OPTIONS = [
  { value: "none", label: "なし" },
  { value: "light", label: "少なめ" },
  { value: "standard", label: "標準" },
  { value: "heavy", label: "多め" },
];

const KIND_ICON = { concept: FileText, compare: Scale, quiz: HelpCircle, summary: CheckCircle2 };
const KIND_LABEL = { concept: "説明", compare: "比較", quiz: "クイズ", summary: "まとめ" };

function SegmentGroup({ options, value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          style={value === opt.value
            ? { background: T.accent, color: "#fff" }
            : { background: "#fff", color: T.textSecondary, border: `1px solid ${T.border}` }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({ label, note, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: C.canvas }}>
      <div className="min-w-0">
        <div className="text-xs font-semibold" style={{ color: C.ink }}>{label}</div>
        {note && <div className="mt-0.5 text-[11px] leading-relaxed" style={{ color: C.muted }}>{note}</div>}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button type="button" onClick={() => onChange(true)} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
          style={value ? { background: T.accent, color: "#fff" } : { background: "#fff", color: T.textSecondary, border: `1px solid ${T.border}` }}>ON</button>
        <button type="button" onClick={() => onChange(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
          style={!value ? { background: T.accent, color: "#fff" } : { background: "#fff", color: T.textSecondary, border: `1px solid ${T.border}` }}>OFF</button>
      </div>
    </div>
  );
}

function buildPreviewRows(counts) {
  const rows = [];
  if (counts.concept >= 1) rows.push({ label: "タイトル", count: 1 });
  if (counts.concept >= 2) rows.push({ label: "概要", count: 1 });
  if (counts.concept > 2) rows.push({ label: "説明", count: counts.concept - 2 });
  if (counts.compare > 0) rows.push({ label: "比較", count: counts.compare });
  if (counts.quiz > 0) rows.push({ label: "クイズ", count: counts.quiz });
  if (counts.summary > 0) rows.push({ label: "まとめ", count: counts.summary });
  return rows;
}

export default function AiLessonStudioModal({ open, course, lesson, existingSlideCount = 0, onClose, onImported }) {
  const studio = useAiLessonStudio();
  const { settings, setField, counts, estimatedMinutes, genState, notice, slides, generate, reset, toggleSlideSelected, selectAll } = studio;

  React.useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson?.id]);

  if (!open || !lesson) return null;

  const previewRows = buildPreviewRows(counts);
  const selectedCount = slides.filter(s => s.selected).length;

  function handleClose() {
    onClose();
  }

  function handleImport() {
    const picked = slides.filter(s => s.selected).map(({ selected, ...s }, i) => ({ ...s, order: existingSlideCount + i }));
    onImported(picked);
    onClose();
  }

  return (
    <AdminModal open={open} title="AIでスライド作成" desc={`Lesson: ${lesson.title}`} onClose={handleClose} width={960}>
      <div className="space-y-4">
        {genState === "done" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold" style={{ color: C.ink }}>生成結果（{slides.length}枚）</div>
              <div className="flex gap-2">
                <Btn kind="ghost" size="sm" onClick={() => selectAll(true)}>すべて選択</Btn>
                <Btn kind="ghost" size="sm" onClick={() => selectAll(false)}>すべて解除</Btn>
              </div>
            </div>
            <div className="space-y-2">
              {slides.map(slide => {
                const Icon = KIND_ICON[slide.kind] || FileText;
                return (
                  <label key={slide.id} className="flex cursor-pointer items-start gap-3 rounded-xl p-3" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
                    <input type="checkbox" checked={slide.selected} onChange={() => toggleSlideSelected(slide.id)} className="mt-1 h-4 w-4 shrink-0" />
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: C.canvas, color: C.muted }}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold" style={{ color: C.ink }}>{slide.title || "(無題)"}</div>
                      <div className="text-xs" style={{ color: C.muted }}>{KIND_LABEL[slide.kind] || slide.kind}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: C.line }}>
              <Btn kind="ghost" onClick={reset}>作り直す</Btn>
              <Btn kind="ai" icon={Sparkles} onClick={handleImport} disabled={selectedCount === 0}>
                選択した{selectedCount}枚を取り込む
              </Btn>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              {/* 左: 生成設定 */}
              <div className="space-y-4">
                <div className="text-sm font-bold" style={{ color: C.ink }}>生成設定</div>

                <div>
                  <div className="mb-1.5 text-xs font-semibold" style={{ color: C.body }}>教材レベル</div>
                  <SegmentGroup options={LEVEL_OPTIONS} value={settings.level} onChange={v => setField("level", v)} disabled={genState === "loading"} />
                  {settings.level === "custom" && (
                    <input
                      className="mt-2 w-full rounded-xl px-3 py-2 text-sm"
                      style={{ border: `1px solid ${T.border}` }}
                      placeholder="例: 未経験からの転職者向け、Java実務3年目向け 等"
                      value={settings.customLevelText}
                      onChange={e => setField("customLevelText", e.target.value)}
                      disabled={genState === "loading"}
                    />
                  )}
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-semibold" style={{ color: C.body }}>教材スタイル</div>
                  <SegmentGroup options={STYLE_OPTIONS} value={settings.style} onChange={v => setField("style", v)} disabled={genState === "loading"} />
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-semibold" style={{ color: C.body }}>演習量（クイズの枚数）</div>
                  <SegmentGroup options={EXERCISE_VOLUME_OPTIONS} value={settings.exerciseVolume} onChange={v => setField("exerciseVolume", v)} disabled={genState === "loading"} />
                </div>

                <ToggleRow label="図解" note="次Phase以降で対応予定です。今回は生成内容に反映されません。" value={settings.diagramEnabled} onChange={v => setField("diagramEnabled", v)} />
                <ToggleRow label="AI画像" note="有効化すると画像1枚ごとにAI生成コストが発生します（次Phaseで対応予定。今回は生成されません）。" value={settings.aiImageEnabled} onChange={v => setField("aiImageEnabled", v)} />
                <ToggleRow label="疑似環境" note="AWS/Linux等の疑似操作・CLI体験スライドを含めます（次Phaseで対応予定。今回は生成されません）。" value={settings.simulatedEnvEnabled} onChange={v => setField("simulatedEnvEnabled", v)} />
              </div>

              {/* 右: 生成予定プレビュー */}
              <div className="space-y-3">
                <div className="text-sm font-bold" style={{ color: C.ink }}>生成予定</div>
                <div className="rounded-xl p-4" style={{ background: C.canvas }}>
                  <div className="text-sm font-bold" style={{ color: C.ink }}>{lesson.title || "(無題のLesson)"}</div>
                  <div className="mt-1 text-xs" style={{ color: C.muted }}>
                    {LEVEL_OPTIONS.find(o => o.value === settings.level)?.label}
                    {" ・ "}
                    {STYLE_OPTIONS.find(o => o.value === settings.style)?.label}
                  </div>
                  <div className="mt-3 flex gap-4">
                    <div>
                      <div className="text-2xl font-bold tabular-nums" style={{ color: T.accent }}>{counts.total}<span className="text-sm font-semibold">枚</span></div>
                      <div className="text-[11px]" style={{ color: C.muted }}>推定スライド数</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold tabular-nums" style={{ color: T.accent }}>{estimatedMinutes}<span className="text-sm font-semibold">分</span></div>
                      <div className="text-[11px]" style={{ color: C.muted }}>推定学習時間</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {previewRows.map((row, i) => (
                    <div key={row.label} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
                      <span style={{ color: C.ink }}>{`①②③④⑤⑥⑦⑧⑨⑩`[i] || `${i + 1}.`} {row.label}</span>
                      <span className="font-semibold tabular-nums" style={{ color: C.muted }}>{row.count}枚</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: C.muted }}>
                  実際の生成枚数はAIの判断により多少前後する場合があります。生成後にスライドを個別に確認し、不要なものは取り込まずに除外できます。
                </p>
              </div>
            </div>

            {genState === "loading" && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl p-8" style={{ background: C.canvas }}>
                <Loader2 size={22} className="animate-spin" style={{ color: T.accent }} />
                <div className="text-sm font-semibold" style={{ color: C.ink }}>教材を生成しています…</div>
                <div className="text-xs" style={{ color: C.muted }}>通常30秒〜1分程度かかります</div>
              </div>
            )}

            {genState === "error" && notice && (
              <div className="flex items-start gap-2 rounded-xl p-3 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <div className="whitespace-pre-wrap">{notice}</div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: C.line }}>
              <Btn kind="ghost" onClick={handleClose} disabled={genState === "loading"}>キャンセル</Btn>
              <Btn kind="ai" icon={Sparkles} onClick={() => generate({ course, lesson })} disabled={genState === "loading"}>
                {genState === "loading" ? "生成中…" : "生成する"}
              </Btn>
            </div>
          </>
        )}
      </div>
    </AdminModal>
  );
}
