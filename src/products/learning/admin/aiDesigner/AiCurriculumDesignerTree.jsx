import React, { useState } from "react";
import { ChevronDown, ChevronRight, FileQuestion, Layers, Plus, Trash2 } from "lucide-react";
import { Badge, Btn, Card, Field, fieldStyle, T, PRODUCT_ACCENT } from "../../../../components/common";
import { COURSE_CATEGORY_OPTIONS, COURSE_LEVEL_OPTIONS, MATERIAL_TYPE_OPTIONS } from "../LearningAdminCatalog.js";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase, green: PRODUCT_ACCENT.learning.accent, greenW: PRODUCT_ACCENT.learning.subtle };

function QuestionEditor({ question, onChange, onChangeChoice, onDelete }) {
  return (
    <div className="rounded-xl p-3" style={{ border: `1px solid ${C.line}`, background: C.canvas }}>
      <div className="flex items-start gap-2">
        <input style={fieldStyle} value={question.question} onChange={e => onChange("question", e.target.value)} placeholder="設問文" />
        <button onClick={onDelete} className="shrink-0 rounded-lg p-2" style={{ color: C.muted }}><Trash2 size={14} /></button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {question.choices.map((choice, i) => (
          <label key={i} className="flex items-center gap-2">
            <input type="radio" checked={question.correctIndex === i} onChange={() => onChange("correctIndex", i)} />
            <input style={fieldStyle} value={choice} onChange={e => onChangeChoice(i, e.target.value)} placeholder={`選択肢${i + 1}${question.correctIndex === i ? "（正解）" : ""}`} />
          </label>
        ))}
      </div>
      <input className="mt-2" style={fieldStyle} value={question.explanation} onChange={e => onChange("explanation", e.target.value)} placeholder="解説" />
    </div>
  );
}

function LessonNode({ lesson, index, actions }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="p-4">
      <div className="flex items-start gap-2">
        <button onClick={() => setOpen(o => !o)} className="mt-2 shrink-0" style={{ color: C.muted }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Badge tone="cyan">Lesson {index + 1}</Badge>
            <input style={fieldStyle} value={lesson.title} onChange={e => actions.updateLessonField(lesson._id, "title", e.target.value)} placeholder="レッスンタイトル" />
            <input style={{ ...fieldStyle, width: 90 }} type="number" min="5" value={lesson.estimatedMinutes} onChange={e => actions.updateLessonField(lesson._id, "estimatedMinutes", Number(e.target.value) || 0)} />
            <span className="shrink-0 text-xs" style={{ color: C.muted }}>分</span>
            <button onClick={() => actions.deleteLesson(lesson._id)} className="shrink-0 rounded-lg p-2" style={{ color: C.muted }}><Trash2 size={16} /></button>
          </div>
          {open && (
            <>
              <textarea style={{ ...fieldStyle, resize: "vertical" }} rows={2} value={lesson.summary} onChange={e => actions.updateLessonField(lesson._id, "summary", e.target.value)} placeholder="レッスン概要" />
              {lesson.learningGoals.length > 0 && (
                <div className="text-xs" style={{ color: C.body }}>学習目標: {lesson.learningGoals.join(" / ")}</div>
              )}

              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-xs font-semibold" style={{ color: C.body }}>教材候補（{lesson.materials.length}）</div>
                  <Btn kind="ghost" size="sm" icon={Plus} onClick={() => actions.addMaterial(lesson._id)}>教材を追加</Btn>
                </div>
                <div className="space-y-2">
                  {lesson.materials.map(material => (
                    <div key={material._id} className="flex items-center gap-2 rounded-xl p-2" style={{ border: `1px solid ${C.line}` }}>
                      <select style={{ ...fieldStyle, width: 100 }} value={material.type} onChange={e => actions.updateMaterial(lesson._id, material._id, "type", e.target.value)}>
                        {MATERIAL_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <input style={fieldStyle} value={material.title} onChange={e => actions.updateMaterial(lesson._id, material._id, "title", e.target.value)} placeholder="教材タイトル" />
                      <input style={fieldStyle} value={material.url} onChange={e => actions.updateMaterial(lesson._id, material._id, "url", e.target.value)} placeholder="参考URL（任意）" />
                      <button onClick={() => actions.deleteMaterial(lesson._id, material._id)} className="shrink-0 rounded-lg p-2" style={{ color: C.muted }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {lesson.materials.length === 0 && <div className="text-xs" style={{ color: C.muted }}>教材候補はまだありません。</div>}
                </div>
              </div>

              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-xs font-semibold" style={{ color: C.body }}>確認問題（{lesson.questions.length}）</div>
                  <Btn kind="ghost" size="sm" icon={Plus} onClick={() => actions.addLessonQuestion(lesson._id)}>問題を追加</Btn>
                </div>
                <div className="space-y-2">
                  {lesson.questions.map(question => (
                    <QuestionEditor
                      key={question._id}
                      question={question}
                      onChange={(key, value) => actions.updateLessonQuestion(lesson._id, question._id, key, value)}
                      onChangeChoice={(i, value) => actions.updateLessonQuestionChoice(lesson._id, question._id, i, value)}
                      onDelete={() => actions.deleteLessonQuestion(lesson._id, question._id)}
                    />
                  ))}
                  {lesson.questions.length === 0 && <div className="text-xs" style={{ color: C.muted }}>確認問題はまだありません。</div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// Tree-style preview/edit surface for the AI-drafted curriculum: course -> lessons ->
// materials/questions -> final test. Every node is editable/addable/deletable before
// save, per the "AI only makes a draft" requirement. Kept as a dumb view over the
// `tree` state + action callbacks owned by useAiCurriculumDesigner, so future node
// types (e.g. slide/body-text generation) can be added without restructuring this file.
export default function AiCurriculumDesignerTree({ tree, actions }) {
  if (!tree) return null;
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Layers size={16} style={{ color: C.green }} />
          <span className="text-sm font-bold" style={{ color: C.ink }}>コース概要</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="コース名"><input style={fieldStyle} value={tree.course.title} onChange={e => actions.updateCourseField("title", e.target.value)} /></Field>
          <Field label="カテゴリ">
            <select style={fieldStyle} value={tree.course.category} onChange={e => actions.updateCourseField("category", e.target.value)}>
              {COURSE_CATEGORY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </Field>
          <Field label="難易度">
            <select style={fieldStyle} value={tree.course.level} onChange={e => actions.updateCourseField("level", e.target.value)}>
              {COURSE_LEVEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </Field>
          <Field label="想定学習時間"><input style={fieldStyle} value={tree.course.duration} onChange={e => actions.updateCourseField("duration", e.target.value)} /></Field>
        </div>
        <div className="mt-2"><Field label="コース概要文"><textarea style={{ ...fieldStyle, resize: "vertical" }} rows={2} value={tree.course.desc} onChange={e => actions.updateCourseField("desc", e.target.value)} /></Field></div>
        {tree.course.skills.length > 0 && <div className="mt-2 text-xs" style={{ color: C.body }}>取得スキル候補: {tree.course.skills.join(" / ")}</div>}
      </Card>

      {tree.lessons.map((lesson, i) => (
        <LessonNode key={lesson._id} lesson={lesson} index={i} actions={actions} />
      ))}

      <Btn kind="ghost" size="sm" icon={Plus} onClick={actions.addLesson}>レッスンを追加</Btn>

      <Card className="p-4" style={{ background: C.greenW, border: `1px solid ${C.line}` }}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileQuestion size={16} style={{ color: C.green }} />
            <span className="text-sm font-bold" style={{ color: C.ink }}>総合テスト候補（{tree.finalTest.questions.length}）</span>
          </div>
          <Btn kind="ghost" size="sm" icon={Plus} onClick={actions.addFinalQuestion}>問題を追加</Btn>
        </div>
        <div className="space-y-2">
          {tree.finalTest.questions.map(question => (
            <QuestionEditor
              key={question._id}
              question={question}
              onChange={(key, value) => actions.updateFinalQuestion(question._id, key, value)}
              onChangeChoice={(i, value) => actions.updateFinalQuestionChoice(question._id, i, value)}
              onDelete={() => actions.deleteFinalQuestion(question._id)}
            />
          ))}
          {tree.finalTest.questions.length === 0 && <div className="text-xs" style={{ color: C.muted }}>総合テスト候補はまだありません。</div>}
        </div>
      </Card>
    </div>
  );
}
