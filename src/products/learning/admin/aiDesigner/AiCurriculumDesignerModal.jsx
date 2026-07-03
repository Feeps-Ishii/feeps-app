import React, { useState } from "react";
import { Save, Sparkles } from "lucide-react";
import { Btn, Field, fieldStyle, T, PRODUCT_ACCENT, SuccessCheck } from "../../../../components/common";
import AdminModal from "../AdminModal.jsx";
import { COURSE_CATEGORY_OPTIONS, COURSE_LEVEL_OPTIONS } from "../LearningAdminCatalog.js";
import { useLearningAdmin } from "../useLearningAdmin.js";
import { AUDIENCE_LEVEL_OPTIONS, MAX_LESSON_COUNT_HINT } from "./aiCurriculumDesignerCatalog.js";
import { useAiCurriculumDesigner } from "./useAiCurriculumDesigner.js";
import AiCurriculumDesignerTree from "./AiCurriculumDesignerTree.jsx";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase, amber: T.warning };

// Entry point for "AI研修デザイナー": a brief-input form -> Bedrock draft generation ->
// editable tree preview -> save into the existing CourseManager/LessonManager/
// MaterialManager/QuizManager data via useLearningAdmin. Rendered from
// LearningAdminProduct.jsx as a top-level modal (not tied to a specific tab), so it can
// grow into more steps later (e.g. material body generation) without touching the tabs.
export default function AiCurriculumDesignerModal({ open, onClose }) {
  const learningAdmin = useLearningAdmin();
  const designer = useAiCurriculumDesigner();
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [saveOk, setSaveOk] = useState(false);

  function handleClose() {
    setSaveNotice("");
    setSaveOk(false);
    onClose && onClose();
  }

  function handleSave() {
    setSaving(true);
    setSaveNotice("");
    setSaveOk(false);
    const result = designer.saveToLearningAdmin(learningAdmin);
    setSaving(false);
    if (result.ok) {
      designer.reset();
      setSaveOk(true);
      setSaveNotice("既存の管理画面（コース・レッスン・教材・問題）へ反映しました。各マネージャ画面で内容を確認できます。");
    } else {
      setSaveNotice(`保存に失敗しました：${result.error || ""}（生成内容は残っています。再試行してください。）`);
    }
  }

  return (
    <AdminModal open={open} onClose={handleClose} title="AI研修デザイナー" desc="入力内容をもとにAIがコースの叩き台を作成します。保存前に必ず内容を確認・編集してください。" width={880}>
      {saveNotice && (
        <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: saveOk ? T.successSubtle : "#fff", color: saveOk ? T.success : C.amber, border: saveOk ? "none" : `1px solid ${C.line}` }}>
          {saveOk && <SuccessCheck size={22} />}
          {saveNotice}
        </div>
      )}
      {!designer.tree && (
        <div className="space-y-3">
          <Field label="コースタイトル"><input style={fieldStyle} value={designer.brief.courseTitle} onChange={e => designer.setBriefField("courseTitle", e.target.value)} placeholder="例: AWS SAP試験対策 / Java新人研修 / Spring Boot基礎" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="対象者"><input style={fieldStyle} value={designer.brief.targetAudience} onChange={e => designer.setBriefField("targetAudience", e.target.value)} placeholder="例: エンジニア新入社員" /></Field>
            <Field label="受講対象">
              <select style={fieldStyle} value={designer.brief.audienceLevel} onChange={e => designer.setBriefField("audienceLevel", e.target.value)}>
                {AUDIENCE_LEVEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </Field>
            <Field label="難易度">
              <select style={fieldStyle} value={designer.brief.level} onChange={e => designer.setBriefField("level", e.target.value)}>
                {COURSE_LEVEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </Field>
            <Field label="カテゴリ">
              <select style={fieldStyle} value={designer.brief.category} onChange={e => designer.setBriefField("category", e.target.value)}>
                {COURSE_CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </Field>
            <Field label="想定学習時間（レッスン数の目安）">
              <input style={fieldStyle} type="number" min="1" max={MAX_LESSON_COUNT_HINT} value={designer.brief.estimatedHours} onChange={e => designer.setBriefField("estimatedHours", e.target.value)} placeholder={`1〜${MAX_LESSON_COUNT_HINT}`} />
            </Field>
            <Field label="取得したいスキル"><input style={fieldStyle} value={designer.brief.desiredSkills} onChange={e => designer.setBriefField("desiredSkills", e.target.value)} placeholder="カンマ区切り可" /></Field>
          </div>
          <Field label="目的"><textarea style={{ ...fieldStyle, resize: "vertical" }} rows={2} value={designer.brief.purpose} onChange={e => designer.setBriefField("purpose", e.target.value)} placeholder="このコースで何を達成したいか" /></Field>
          <Field label="補足"><textarea style={{ ...fieldStyle, resize: "vertical" }} rows={2} value={designer.brief.notes} onChange={e => designer.setBriefField("notes", e.target.value)} placeholder="重点にしたい観点、避けたい内容など" /></Field>
          <div className="rounded-xl px-3 py-2 text-[11px] leading-relaxed" style={{ background: C.canvas, color: C.muted, border: `1px solid ${C.line}` }}>
            内容量の都合により、レッスン数が多い・教材や問題が多いコースほど、生成内容が一部のみになる場合があります。生成後に不足分を手動で追加・編集できます。
          </div>
          <div className="flex items-center gap-2">
            <Btn kind="ai" size="sm" icon={Sparkles} onClick={designer.generate} disabled={designer.generating}>{designer.generating ? "生成中..." : "AIで叩き台を作成"}</Btn>
          </div>
          {designer.generating && <div className="feeps-shimmer h-1.5 w-full rounded-full" />}
          {designer.notice && <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "#fff", color: C.amber, border: `1px solid ${C.line}` }}>{designer.notice}</div>}
        </div>
      )}

      {designer.tree && (
        <div className="space-y-3">
          {designer.notice && <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "#fff", color: C.amber, border: `1px solid ${C.line}` }}>{designer.notice}</div>}
          <AiCurriculumDesignerTree tree={designer.tree} actions={designer} />
          <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: C.line }}>
            <Btn size="sm" icon={Save} onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "既存の管理画面へ保存"}</Btn>
            <Btn size="sm" kind="ghost" onClick={designer.reset}>作り直す</Btn>
          </div>
        </div>
      )}
    </AdminModal>
  );
}
