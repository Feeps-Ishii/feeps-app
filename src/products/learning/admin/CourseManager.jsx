import React, { useMemo, useState } from "react";
import { BookOpen, Clock, Eye, EyeOff, ListChecks, Pencil, Plus, Save, Search, Tag, Trash2, X } from "lucide-react";
import { Badge, Btn, Card, EmptyState, Field, SectionHead, Stat, fieldStyle, T, PRODUCT_ACCENT } from "../../../components/common";
import { COURSE_CATEGORY_OPTIONS, COURSE_COLOR_OPTIONS, COURSE_LEVEL_OPTIONS, EMPTY_COURSE_FORM } from "./LearningAdminCatalog.js";
import { courseToForm, useLearningAdmin } from "./useLearningAdmin.js";
import AdminModal from "./AdminModal.jsx";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase, green: PRODUCT_ACCENT.learning.accent, greenW: PRODUCT_ACCENT.learning.subtle, red: T.danger };

function CourseForm({ mode, form, onChange, onSubmit, onCancel }) {
  function set(key, value) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold" style={{ color: C.ink }}>{mode === "edit" ? "コース編集" : "コース新規作成"}</h3>
          <p className="text-xs" style={{ color: C.muted }}>受講者向けに表示するコース情報を管理します。</p>
        </div>
        {mode === "edit" && <Btn kind="ghost" size="sm" icon={X} onClick={onCancel}>閉じる</Btn>}
      </div>

      <div className="space-y-3">
        <Field label="コース名">
          <input style={fieldStyle} value={form.title} onChange={e => set("title", e.target.value)} placeholder="例: AWS実践入門" />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="カテゴリ">
            <select style={fieldStyle} value={form.category} onChange={e => set("category", e.target.value)}>
              {COURSE_CATEGORY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="難易度">
            <select style={fieldStyle} value={form.level} onChange={e => set("level", e.target.value)}>
              {COURSE_LEVEL_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="想定学習時間">
            <input style={fieldStyle} value={form.duration} onChange={e => set("duration", e.target.value)} placeholder="例: 4" />
          </Field>
          <Field label="サムネイル色">
            <div className="flex flex-wrap gap-2 rounded-xl border p-2" style={{ borderColor: C.line }}>
              {COURSE_COLOR_OPTIONS.map(color => (
                <button
                  key={color}
                  type="button"
                  className="h-7 w-7 rounded-full"
                  onClick={() => set("color", color)}
                  style={{ background: color, outline: form.color === color ? `3px solid ${C.greenW}` : "none", border: "2px solid #fff" }}
                  aria-label={color}
                />
              ))}
            </div>
          </Field>
        </div>
        <Field label="説明">
          <textarea style={{ ...fieldStyle, minHeight: 92 }} value={form.desc} onChange={e => set("desc", e.target.value)} placeholder="コースで学ぶ内容を入力" />
        </Field>
        <Field label="取得スキル（カンマ区切り）">
          <input style={fieldStyle} value={form.skillsText} onChange={e => set("skillsText", e.target.value)} placeholder="AWS, IAM, S3" />
        </Field>
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

function CourseRow({ course, onEdit, onOpenLessons, onTogglePublish, onDeleteRequest }) {
  const published = course.published !== false;
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: course.color || C.green }}>
            <BookOpen size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-bold" style={{ color: C.ink }}>{course.title}</h3>
              <Badge tone={published ? "green" : "muted"}>{published ? "公開中" : "非公開"}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs" style={{ color: C.body }}>{course.desc}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: C.muted }}>
              <span className="inline-flex items-center gap-1"><Tag size={13} />{course.category}</span>
              <span className="inline-flex items-center gap-1"><Clock size={13} />{course.duration}時間</span>
              <span>{course.level}</span>
              <span>{course.lessons || 0} Lessons</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {(course.skills || []).slice(0, 5).map(skill => <Badge key={skill} tone="cyan">{skill}</Badge>)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Btn kind="ghost" size="sm" icon={ListChecks} onClick={() => onOpenLessons(course)}>レッスン管理</Btn>
          <Btn kind="ghost" size="sm" icon={Pencil} onClick={() => onEdit(course)}>編集</Btn>
          <Btn kind="ghost" size="sm" icon={published ? EyeOff : Eye} onClick={() => onTogglePublish(course.id)}>
            {published ? "非公開" : "公開"}
          </Btn>
          <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => onDeleteRequest(course)}>削除</Btn>
        </div>
      </div>
    </Card>
  );
}

export default function CourseManager({ onOpenLessons = () => {} }) {
  const {
    courses, coursesLoading, coursesError, stats,
    createCourse, updateCourse, togglePublish, deleteCourse,
    actionError, clearActionError,
  } = useLearningAdmin();
  const [query, setQuery] = useState("");
  const [editingCourse, setEditingCourse] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_COURSE_FORM });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(course => [
      course.title,
      course.category,
      course.level,
      course.desc,
      ...(course.skills || []),
    ].some(value => String(value || "").toLowerCase().includes(q)));
  }, [courses, query]);

  function startNew() {
    setEditingCourse(null);
    setForm({ ...EMPTY_COURSE_FORM });
    setDeleteTarget(null);
    setFormOpen(true);
  }

  function startEdit(course) {
    setEditingCourse(course);
    setForm(courseToForm(course));
    setDeleteTarget(null);
    setFormOpen(true);
  }

  function closeForm() {
    setEditingCourse(null);
    setForm({ ...EMPTY_COURSE_FORM });
    setFormOpen(false);
  }

  function submit() {
    if (editingCourse) {
      updateCourse(editingCourse.id, form);
    } else {
      createCourse(form);
    }
    closeForm();
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteCourse(deleteTarget.id);
    if (editingCourse?.id === deleteTarget.id) closeForm();
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-5">
      <SectionHead title="コース管理" desc="Eラーニングコースの作成・編集・公開状態を管理します。" />

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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-bold" style={{ color: C.ink }}>管理者向けコース運用</div>
            <p className="mt-1 text-xs" style={{ color: C.body }}>
              コース情報はBackend APIに保存され、受講生・講師画面にも即時反映されます。
            </p>
          </div>
          <Btn icon={Plus} onClick={startNew}>新規コース</Btn>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat icon={BookOpen} label="総コース" value={stats.total} sub="管理対象" tone="green" />
        <Stat icon={Eye} label="公開中" value={stats.published} sub="受講者に表示" tone="cyan" />
        <Stat icon={EyeOff} label="非公開" value={stats.privateCount} sub="準備中" tone="amber" />
        <Stat icon={Tag} label="取得スキル" value={stats.skillCount} sub="ユニーク数" tone="muted" />
      </div>

      <div className="grid gap-5">
        <div className="space-y-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: C.line, background: "#fff" }}>
              <Search size={16} style={{ color: C.muted }} />
              <input
                className="w-full bg-transparent text-sm outline-none"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="コース名・カテゴリ・スキルで検索"
                style={{ color: C.ink }}
              />
            </div>
          </Card>

          {filtered.length ? (
            <div className="space-y-3">
              {filtered.map(course => (
                <CourseRow
                  key={course.id}
                  course={course}
                  onEdit={startEdit}
                  onOpenLessons={onOpenLessons}
                  onTogglePublish={togglePublish}
                  onDeleteRequest={setDeleteTarget}
                />
              ))}
            </div>
          ) : coursesLoading ? (
            <EmptyState title="読み込み中..." desc="コース一覧を取得しています。" />
          ) : (
            <EmptyState
              title={courses.length ? "該当するコースがありません" : "コースがまだ登録されていません"}
              desc={courses.length ? "検索条件を変更するか、新規コースを作成してください。" : "「新規コース」からEラーニングコースを作成してください。"}
            />
          )}
        </div>

        <div className="hidden">
          {deleteTarget && (
            <Card className="p-4" style={{ borderColor: "#FCA5A5" }}>
              <div className="flex items-start gap-3">
                <div className="rounded-xl p-2" style={{ background: "#FEE2E2", color: C.red }}><Trash2 size={18} /></div>
                <div>
                  <div className="text-sm font-bold" style={{ color: C.ink }}>削除確認</div>
                  <p className="mt-1 text-xs" style={{ color: C.body }}>
                    「{deleteTarget.title}」を削除する確認UIです。今回はAPI未接続のため、実削除は行いません。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn kind="ghost" size="sm" onClick={() => setDeleteTarget(null)}>キャンセル</Btn>
                    <Btn kind="ghost" size="sm" disabled>削除API化時に接続</Btn>
                  </div>
                </div>
              </div>
            </Card>
          )}
          <CourseForm
            mode={editingCourse ? "edit" : "new"}
            form={form}
            onChange={setForm}
            onSubmit={submit}
            onCancel={startNew}
          />
        </div>
      </div>

      <AdminModal
        open={formOpen}
        title={editingCourse ? "Course edit" : "New course"}
        desc="Course information is saved via the Learning admin API."
        onClose={closeForm}
      >
        <CourseForm
          mode={editingCourse ? "edit" : "new"}
          form={form}
          onChange={setForm}
          onSubmit={submit}
          onCancel={closeForm}
        />
      </AdminModal>

      <AdminModal
        open={Boolean(deleteTarget)}
        title="Delete course"
        desc={deleteTarget ? `Delete "${deleteTarget.title}" from learner course lists.` : ""}
        onClose={() => setDeleteTarget(null)}
        danger
        width={520}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "#FEE2E2", color: C.red }}>
            <Trash2 size={18} />
            <div className="text-sm font-bold">This action hides the course from learners.</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn kind="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Btn>
            <Btn kind="ghost" icon={Trash2} onClick={confirmDelete}>Delete</Btn>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
