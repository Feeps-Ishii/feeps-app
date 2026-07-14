import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Clock,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Layers,
  Pencil,
  PlayCircle,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Badge, Btn, Card, EmptyState, Field, SectionHead, Stat, fieldStyle, T, PRODUCT_ACCENT } from "../../../components/common";
import { EMPTY_LESSON_FORM, LESSON_TYPE_OPTIONS } from "./LearningAdminCatalog.js";
import { lessonToForm, useLearningAdmin } from "./useLearningAdmin.js";
import AdminModal from "./AdminModal.jsx";
import LessonSlideStudio from "./slideEditor/LessonSlideStudio.jsx";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase, green: PRODUCT_ACCENT.learning.accent, red: T.danger };

const typeIcon = {
  video: PlayCircle,
  text: FileText,
  quiz: HelpCircle,
};

function LessonForm({ mode, form, onChange, onSubmit, onCancel }) {
  function set(key, value) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold" style={{ color: C.ink }}>{mode === "edit" ? "レッスン編集" : "レッスン新規作成"}</h3>
          <p className="text-xs" style={{ color: C.muted }}>タイトル、種別、本文、クイズ設問を管理します。</p>
        </div>
        {mode === "edit" && <Btn kind="ghost" size="sm" icon={X} onClick={onCancel}>閉じる</Btn>}
      </div>

      <div className="space-y-3">
        <Field label="レッスンタイトル">
          <input style={fieldStyle} value={form.title} onChange={e => set("title", e.target.value)} placeholder="例: IAMの基本" />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="レッスン種別">
            <select style={fieldStyle} value={form.type} onChange={e => set("type", e.target.value)}>
              {LESSON_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="所要時間">
            <input style={fieldStyle} value={form.duration} onChange={e => set("duration", e.target.value)} placeholder="例: 15分" />
          </Field>
        </div>
        <Field label="概要">
          <textarea style={{ ...fieldStyle, minHeight: 72 }} value={form.summary} onChange={e => set("summary", e.target.value)} placeholder="レッスンの概要を入力" />
        </Field>
        <Field label="学習ポイント（1行に1つ）">
          <textarea style={{ ...fieldStyle, minHeight: 88 }} value={form.pointsText} onChange={e => set("pointsText", e.target.value)} placeholder={"IAMユーザーの役割\n最小権限の原則"} />
        </Field>
        {form.type === "text" && (
          <Field label="テキスト本文">
            <textarea style={{ ...fieldStyle, minHeight: 140 }} value={form.body} onChange={e => set("body", e.target.value)} placeholder="本文を入力" />
          </Field>
        )}
        {form.type === "quiz" && (
          <Field label="クイズ設問（質問 | 選択肢1 | 選択肢2 | 選択肢3 | 選択肢4 | 正解番号）">
            <textarea
              style={{ ...fieldStyle, minHeight: 140 }}
              value={form.questionsText}
              onChange={e => set("questionsText", e.target.value)}
              placeholder={"IAMの役割は？ | 権限管理 | 画像編集 | 課金管理 | DNS管理 | 1"}
            />
          </Field>
        )}
        <label className="flex items-center gap-2 rounded-xl p-3 text-sm font-semibold" style={{ background: C.canvas, color: C.ink }}>
          <input type="checkbox" checked={form.published} onChange={e => set("published", e.target.checked)} />
          公開する
        </label>
        <div className="flex flex-wrap gap-2 pt-1">
          <Btn icon={Save} onClick={onSubmit} disabled={!form.title.trim()}>{mode === "edit" ? "保存" : "作成"}</Btn>
          <Btn kind="ghost" onClick={onCancel}>キャンセル</Btn>
        </div>
      </div>

    </div>
  );
}

function LessonRow({ lesson, index, total, onEdit, onEditSlides, onTogglePublish, onMove, onDeleteRequest }) {
  const published = lesson.published !== false;
  const Icon = typeIcon[lesson.type] || BookOpen;
  const slideCount = (lesson.slides || []).length;
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: C.green }}>
            <Icon size={21} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold" style={{ color: C.muted }}>#{index + 1}</span>
              <h3 className="truncate text-sm font-bold" style={{ color: C.ink }}>{lesson.title}</h3>
              <Badge tone="cyan">{lesson.type}</Badge>
              <Badge tone={published ? "green" : "muted"}>{published ? "公開中" : "非公開"}</Badge>
              {slideCount > 0 && <Badge tone="muted">{slideCount} slides</Badge>}
            </div>
            <p className="mt-1 line-clamp-2 text-xs" style={{ color: C.body }}>{lesson.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: C.muted }}>
              <span className="inline-flex items-center gap-1"><Clock size={13} />{lesson.duration}</span>
              <span>{(lesson.points || []).length} points</span>
              {lesson.type === "quiz" && <span>{(lesson.questions || []).length} questions</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Btn kind="ghost" size="sm" icon={ArrowUp} onClick={() => onMove(lesson.id, -1)} disabled={index === 0}>上へ</Btn>
          <Btn kind="ghost" size="sm" icon={ArrowDown} onClick={() => onMove(lesson.id, 1)} disabled={index === total - 1}>下へ</Btn>
          <Btn kind="ghost" size="sm" icon={Pencil} onClick={() => onEdit(lesson)}>編集</Btn>
          <Btn kind="ghost" size="sm" icon={Layers} onClick={() => onEditSlides(lesson)}>スライド管理</Btn>
          <Btn kind="ghost" size="sm" icon={published ? EyeOff : Eye} onClick={() => onTogglePublish(lesson.id)}>
            {published ? "非公開" : "公開"}
          </Btn>
          <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => onDeleteRequest(lesson)}>削除</Btn>
        </div>
      </div>
    </Card>
  );
}

export default function LessonManager({ initialCourseId }) {
  const {
    courses,
    coursesLoading,
    coursesError,
    lessonsForCourse,
    createLesson,
    updateLesson,
    deleteLesson,
    toggleLessonPublish,
    moveLesson,
    createMaterialAwaitingApi,
    actionError,
    clearActionError,
  } = useLearningAdmin();
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId || courses[0]?.id || "");
  const [query, setQuery] = useState("");
  const [editingLesson, setEditingLesson] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_LESSON_FORM });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [slideEditingLesson, setSlideEditingLesson] = useState(null);

  const selectedCourse = courses.find(course => course.id === selectedCourseId) || courses[0];
  const lessons = selectedCourse ? lessonsForCourse(selectedCourse.id) : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lessons;
    return lessons.filter(lesson => [
      lesson.title,
      lesson.type,
      lesson.summary,
      lesson.duration,
      ...(lesson.points || []),
    ].some(value => String(value || "").toLowerCase().includes(q)));
  }, [lessons, query]);
  const publishedCount = lessons.filter(lesson => lesson.published !== false).length;
  const quizCount = lessons.filter(lesson => lesson.type === "quiz").length;

  function startNew() {
    setEditingLesson(null);
    setForm({ ...EMPTY_LESSON_FORM });
    setDeleteTarget(null);
    setFormOpen(true);
  }

  function startEdit(lesson) {
    setEditingLesson(lesson);
    setForm(lessonToForm(lesson));
    setDeleteTarget(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingLesson(null);
    setForm({ ...EMPTY_LESSON_FORM });
    setFormOpen(false);
  }

  function submit() {
    if (!selectedCourse) return;
    if (editingLesson) {
      updateLesson(selectedCourse.id, editingLesson.id, form);
    } else {
      createLesson(selectedCourse.id, form);
    }
    closeForm();
  }

  function confirmDelete() {
    if (!selectedCourse || !deleteTarget) return;
    deleteLesson(selectedCourse.id, deleteTarget.id);
    setDeleteTarget(null);
    if (editingLesson?.id === deleteTarget.id) closeForm();
  }

  function changeCourse(courseId) {
    setSelectedCourseId(courseId);
    closeForm();
    setQuery("");
  }

  return (
    <div className="space-y-5">
      <SectionHead title="レッスン管理" desc="コースごとにレッスンの作成・編集・公開状態・並び順を管理します。" />

      {coursesError && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{coursesError}</div>
      )}
      {actionError && (
        <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>
          <span>{actionError}</span>
          <button type="button" onClick={clearActionError} className="shrink-0 font-bold underline">閉じる</button>
        </div>
      )}

      <Card className="p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div>
            <div className="text-sm font-bold" style={{ color: C.ink }}>対象コース</div>
            <p className="mt-1 text-xs" style={{ color: C.body }}>レッスンを管理するコースを選択してください。</p>
          </div>
          <select style={fieldStyle} value={selectedCourse?.id || ""} onChange={e => changeCourse(e.target.value)}>
            {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat icon={BookOpen} label="レッスン数" value={lessons.length} sub="選択コース" tone="green" />
        <Stat icon={Eye} label="公開中" value={publishedCount} sub="受講者に表示" tone="cyan" />
        <Stat icon={EyeOff} label="非公開" value={lessons.length - publishedCount} sub="準備中" tone="amber" />
        <Stat icon={HelpCircle} label="Quiz" value={quizCount} sub="確認テスト" tone="muted" />
      </div>

      <div className="grid gap-5">
        <div className="space-y-3">
          <Card className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: C.line, background: "#fff" }}>
                <Search size={16} style={{ color: C.muted }} />
                <input
                  className="w-full bg-transparent text-sm outline-none"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="レッスン名・種別・ポイントで検索"
                  style={{ color: C.ink }}
                />
              </div>
              <Btn icon={Plus} onClick={startNew}>新規レッスン</Btn>
            </div>
          </Card>

          {filtered.length ? (
            <div className="space-y-3">
              {filtered.map((lesson, index) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  index={lessons.findIndex(item => item.id === lesson.id)}
                  total={lessons.length}
                  onEdit={startEdit}
                  onEditSlides={setSlideEditingLesson}
                  onTogglePublish={(lessonId) => selectedCourse && toggleLessonPublish(selectedCourse.id, lessonId)}
                  onMove={(lessonId, direction) => selectedCourse && moveLesson(selectedCourse.id, lessonId, direction)}
                  onDeleteRequest={setDeleteTarget}
                />
              ))}
            </div>
          ) : coursesLoading ? (
            <EmptyState title="読み込み中..." desc="コース一覧を取得しています。" />
          ) : (
            <EmptyState
              title={lessons.length ? "レッスンがありません" : "このコースにはまだレッスンがありません"}
              desc={lessons.length ? "検索条件を変更するか、新規レッスンを作成してください。" : "「新規レッスン」からレッスンを作成してください。"}
            />
          )}
        </div>
      </div>

      <AdminModal
        open={formOpen}
        title={editingLesson ? "レッスン編集" : "レッスン新規作成"}
        desc={selectedCourse ? `対象コース: ${selectedCourse.title}` : ""}
        onClose={closeForm}
      >
        <LessonForm
          mode={editingLesson ? "edit" : "new"}
          form={form}
          onChange={setForm}
          onSubmit={submit}
          onCancel={closeForm}
        />
      </AdminModal>

      <AdminModal
        open={Boolean(deleteTarget)}
        title="レッスンの削除"
        desc={deleteTarget ? `「${deleteTarget.title}」をこのコースから削除します。` : ""}
        onClose={() => setDeleteTarget(null)}
        danger
        width={520}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "#FEE2E2", color: C.red }}>
            <Trash2 size={18} />
            <div className="text-sm font-bold">この操作は取り消せません。</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn kind="ghost" onClick={() => setDeleteTarget(null)}>キャンセル</Btn>
            <Btn kind="ghost" icon={Trash2} onClick={confirmDelete}>削除する</Btn>
          </div>
        </div>
      </AdminModal>

      <LessonSlideStudio
        open={Boolean(slideEditingLesson)}
        course={selectedCourse}
        lesson={slideEditingLesson}
        updateLesson={updateLesson}
        createMaterialAwaitingApi={createMaterialAwaitingApi}
        onClose={() => setSlideEditingLesson(null)}
      />
    </div>
  );
}
