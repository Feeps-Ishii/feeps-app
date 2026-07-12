import React, { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, FileQuestion, Pencil, Plus, Save, Search, Settings, Tag, Trash2, X } from "lucide-react";
import { Badge, Btn, Card, EmptyState, Field, SectionHead, Stat, fieldStyle, T, PRODUCT_ACCENT } from "../../../components/common";
import {
  EMPTY_QUIZ_FORM,
  EMPTY_REVIEW_FORM,
  QUIZ_DIFFICULTY_OPTIONS,
  QUIZ_TYPE_OPTIONS,
} from "./LearningAdminCatalog.js";
import { quizToForm, reviewToForm, useLearningAdmin } from "./useLearningAdmin.js";
import AdminModal from "./AdminModal.jsx";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase, green: PRODUCT_ACCENT.learning.accent, red: T.danger };

const typeLabel = {
  lesson: "確認問題",
  review: "復習問題",
  final: "総合問題",
  ai_final: "AI総合",
};

const reviewStatusLabel = {
  understood: "理解できた",
  uncertain: "少し不安",
  review_later: "後で復習したい",
};

function QuizForm({ mode, form, courses, lessons, onChange, onSubmit, onCancel }) {
  function set(key, value) {
    const next = { ...form, [key]: value };
    if (key === "courseId") next.lessonId = "";
    onChange(next);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold" style={{ color: C.ink }}>{mode === "edit" ? "問題編集" : "問題新規作成"}</h3>
          <p className="text-xs" style={{ color: C.muted }}>確認テスト、復習問題、総合問題を登録します。</p>
        </div>
        {mode === "edit" && <Btn kind="ghost" size="sm" icon={X} onClick={onCancel}>閉じる</Btn>}
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="コース">
            <select style={fieldStyle} value={form.courseId} onChange={e => set("courseId", e.target.value)}>
              <option value="">選択してください</option>
              {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </Field>
          <Field label="Lesson">
            <select style={fieldStyle} value={form.lessonId} onChange={e => set("lessonId", e.target.value)}>
              <option value="">選択してください</option>
              {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="問題タイプ">
            <select style={fieldStyle} value={form.type} onChange={e => set("type", e.target.value)}>
              {QUIZ_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="難易度">
            <select style={fieldStyle} value={form.difficulty} onChange={e => set("difficulty", e.target.value)}>
              {QUIZ_DIFFICULTY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
        </div>
        <Field label="問題文">
          <textarea style={{ ...fieldStyle, minHeight: 82 }} value={form.question} onChange={e => set("question", e.target.value)} placeholder="問題文を入力" />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map(n => (
            <Field key={n} label={`選択肢${n}`}>
              <input style={fieldStyle} value={form[`choice${n}`]} onChange={e => set(`choice${n}`, e.target.value)} />
            </Field>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="正解">
            <select style={fieldStyle} value={form.answer} onChange={e => set("answer", e.target.value)}>
              {[1, 2, 3, 4].map(n => <option key={n} value={String(n)}>選択肢{n}</option>)}
            </select>
          </Field>
          <Field label="配点">
            <input style={fieldStyle} value={form.points} onChange={e => set("points", e.target.value)} placeholder="10" />
          </Field>
        </div>
        <Field label="解説">
          <textarea style={{ ...fieldStyle, minHeight: 82 }} value={form.explanation} onChange={e => set("explanation", e.target.value)} placeholder="正解の理由や復習ポイント" />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="タグ（カンマ区切り）">
            <input style={fieldStyle} value={form.tagsText} onChange={e => set("tagsText", e.target.value)} placeholder="Java, 基礎" />
          </Field>
          <Field label="対象スキル">
            <input style={fieldStyle} value={form.skill} onChange={e => set("skill", e.target.value)} placeholder="Java" />
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="対象ページ">
            <input style={fieldStyle} value={form.pageId} onChange={e => set("pageId", e.target.value)} placeholder="page-1" />
          </Field>
          <Field label="対象チャプター">
            <input style={fieldStyle} value={form.chapterId} onChange={e => set("chapterId", e.target.value)} placeholder="chapter-1" />
          </Field>
        </div>
        <label className="flex items-center gap-2 rounded-xl p-3 text-sm font-semibold" style={{ background: C.canvas, color: C.ink }}>
          <input type="checkbox" checked={form.published} onChange={e => set("published", e.target.checked)} />
          公開する
        </label>
        <div className="flex flex-wrap gap-2 pt-1">
          <Btn icon={Save} onClick={onSubmit} disabled={!form.question.trim() || !form.courseId}>{mode === "edit" ? "保存" : "作成"}</Btn>
          <Btn kind="ghost" onClick={onCancel}>キャンセル</Btn>
        </div>
      </div>
    </div>
  );
}

function QuizRow({ item, courseName, lessonName, onEdit, onTogglePublish, onDeleteRequest }) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold" style={{ color: C.ink }}>{item.question}</h3>
            <Badge tone="cyan">{typeLabel[item.type]}</Badge>
            <Badge tone={item.published ? "green" : "muted"}>{item.published ? "公開中" : "非公開"}</Badge>
            <Badge tone="muted">{item.difficulty}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs" style={{ color: C.muted }}>
            <span>{courseName}</span>
            <span>{lessonName}</span>
            <span>{item.points}点</span>
            {item.skill && <span>{item.skill}</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(item.tags || []).map(tag => <Badge key={tag} tone="muted">{tag}</Badge>)}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Btn kind="ghost" size="sm" icon={Pencil} onClick={() => onEdit(item)}>編集</Btn>
          <Btn kind="ghost" size="sm" icon={item.published ? EyeOff : Eye} onClick={() => onTogglePublish(item.id)}>
            {item.published ? "非公開" : "公開"}
          </Btn>
          <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => onDeleteRequest(item)}>削除</Btn>
        </div>
      </div>
    </Card>
  );
}

function ReviewPanel({ lessons, reviewFlags, onSave, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_REVIEW_FORM, lessonId: lessons[0]?.id || "" });

  function startEdit(item) {
    setEditing(item);
    setForm(reviewToForm(item));
  }

  function submit() {
    onSave(form, editing?.id || null);
    setEditing(null);
    setForm({ ...EMPTY_REVIEW_FORM, lessonId: lessons[0]?.id || "" });
  }

  function set(key, value) {
    const next = { ...form, [key]: value };
    if (key === "status") {
      next.understood = value === "understood";
      next.reviewLater = value === "review_later";
    }
    setForm(next);
  }

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-base font-bold" style={{ color: C.ink }}>復習フラグ管理</h3>
        <p className="text-xs" style={{ color: C.muted }}>Lesson / page単位で理解状態と復習予定を管理します。</p>
      </div>
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Lesson">
            <select style={fieldStyle} value={form.lessonId} onChange={e => set("lessonId", e.target.value)}>
              {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
            </select>
          </Field>
          <Field label="ページID">
            <input style={fieldStyle} value={form.pageId} onChange={e => set("pageId", e.target.value)} />
          </Field>
        </div>
        <Field label="理解状態">
          <select style={fieldStyle} value={form.status} onChange={e => set("status", e.target.value)}>
            <option value="understood">理解できた</option>
            <option value="uncertain">少し不安</option>
            <option value="review_later">後で復習したい</option>
          </select>
        </Field>
        <div className="grid gap-2 md:grid-cols-3">
          {[
            ["understood", "理解できた"],
            ["reviewLater", "後で復習"],
            ["reviewed", "復習済み"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-xl p-3 text-xs font-semibold" style={{ background: C.canvas, color: C.ink }}>
              <input type="checkbox" checked={form[key] === true} onChange={e => setForm({ ...form, [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
        <Btn size="sm" icon={Save} onClick={submit}>{editing ? "更新" : "追加"}</Btn>
        <div className="space-y-2 pt-2">
          {reviewFlags.length ? reviewFlags.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border p-3" style={{ borderColor: C.line }}>
              <div className="min-w-0">
                <div className="text-xs font-bold" style={{ color: C.ink }}>{lessons.find(lesson => lesson.id === item.lessonId)?.title || item.lessonId}</div>
                <div className="text-xs" style={{ color: C.muted }}>{item.pageId} / {reviewStatusLabel[item.status] || item.status}</div>
              </div>
              <div className="flex gap-2">
                <Btn kind="ghost" size="sm" icon={Pencil} onClick={() => startEdit(item)}>編集</Btn>
                <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => onDelete(item.id)}>削除</Btn>
              </div>
            </div>
          )) : <EmptyState title="復習フラグがありません" desc="Lessonごとの理解状態を追加してください。" />}
        </div>
      </div>
    </Card>
  );
}

function FinalSettingsPanel({ settings, onSave }) {
  const [draft, setDraft] = useState(settings);
  React.useEffect(() => setDraft(settings), [settings]);
  const set = (key, value) => setDraft({ ...draft, [key]: value });
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl p-2" style={{ background: "#E6F6EE", color: C.green }}><Settings size={18} /></div>
        <div>
          <h3 className="text-base font-bold" style={{ color: C.ink }}>総合テスト設計</h3>
          <p className="text-xs" style={{ color: C.muted }}>AI生成はまだ行わず、将来の生成条件だけ保存します。</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="苦手重視率（%）"><input style={fieldStyle} value={draft.weakFocusRate} onChange={e => set("weakFocusRate", e.target.value)} /></Field>
        <Field label="全体確認率（%）"><input style={fieldStyle} value={draft.coverageRate} onChange={e => set("coverageRate", e.target.value)} /></Field>
        <Field label="出題数"><input style={fieldStyle} value={draft.questionCount} onChange={e => set("questionCount", e.target.value)} /></Field>
        <Field label="最低出題Lesson数"><input style={fieldStyle} value={draft.minLessonCount} onChange={e => set("minLessonCount", e.target.value)} /></Field>
      </div>
      <label className="mt-3 flex items-center gap-2 rounded-xl p-3 text-sm font-semibold" style={{ background: C.canvas, color: C.ink }}>
        <input type="checkbox" checked={draft.aiFinalEnabled === true} onChange={e => set("aiFinalEnabled", e.target.checked)} />
        AI総合問題を将来利用する
      </label>
      <div className="mt-3"><Btn size="sm" icon={Save} onClick={() => onSave(draft)}>設定保存</Btn></div>
    </Card>
  );
}

export default function QuizManager() {
  const {
    courses,
    lessonsForCourse,
    quizQuestions,
    quizQuestionsError,
    quizStats,
    createQuizQuestion,
    updateQuizQuestion,
    deleteQuizQuestion,
    toggleQuizPublish,
    reviewFlags,
    reviewFlagsError,
    upsertReviewFlag,
    deleteReviewFlag,
    finalTestSettings,
    finalTestSettingsError,
    updateFinalTestSettings,
    actionError,
    clearActionError,
  } = useLearningAdmin();
  const initialCourseId = courses[0]?.id || "";
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [publishedFilter, setPublishedFilter] = useState("");
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_QUIZ_FORM, courseId: initialCourseId, lessonId: initialCourseId ? lessonsForCourse(initialCourseId)[0]?.id || "" : "" });
  const [formOpen, setFormOpen] = useState(false);

  const lessonsForForm = form.courseId ? lessonsForCourse(form.courseId) : [];
  const allLessons = useMemo(() => courses.flatMap(course => lessonsForCourse(course.id)), [courses, lessonsForCourse]);
  const courseName = (courseId) => courses.find(course => course.id === courseId)?.title || "未選択";
  const lessonName = (courseId, lessonId) => lessonsForCourse(courseId).find(lesson => lesson.id === lessonId)?.title || lessonId || "未選択";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quizQuestions.filter(item => {
      if (courseFilter && item.courseId !== courseFilter) return false;
      if (typeFilter && item.type !== typeFilter) return false;
      if (difficultyFilter && item.difficulty !== difficultyFilter) return false;
      if (publishedFilter === "published" && !item.published) return false;
      if (publishedFilter === "draft" && item.published) return false;
      if (!q) return true;
      return [
        item.question,
        item.explanation,
        item.skill,
        item.pageId,
        item.chapterId,
        courseName(item.courseId),
        lessonName(item.courseId, item.lessonId),
        ...(item.tags || []),
      ].some(value => String(value || "").toLowerCase().includes(q));
    });
  }, [quizQuestions, query, courseFilter, typeFilter, difficultyFilter, publishedFilter]);

  function startNew() {
    const courseId = courseFilter || initialCourseId;
    setEditingQuestion(null);
    setDeleteTarget(null);
    setForm({ ...EMPTY_QUIZ_FORM, courseId, lessonId: courseId ? lessonsForCourse(courseId)[0]?.id || "" : "" });
    setFormOpen(true);
  }

  function startEdit(item) {
    setEditingQuestion(item);
    setDeleteTarget(null);
    setForm(quizToForm(item));
    setFormOpen(true);
  }

  function closeForm() {
    const courseId = courseFilter || initialCourseId;
    setEditingQuestion(null);
    setForm({ ...EMPTY_QUIZ_FORM, courseId, lessonId: courseId ? lessonsForCourse(courseId)[0]?.id || "" : "" });
    setFormOpen(false);
  }

  function submit() {
    if (editingQuestion) {
      updateQuizQuestion(editingQuestion.id, form);
    } else {
      createQuizQuestion(form);
    }
    closeForm();
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteQuizQuestion(deleteTarget.id);
    if (editingQuestion?.id === deleteTarget.id) closeForm();
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-5">
      <SectionHead title="理解度・問題管理" desc="確認問題、復習問題、総合問題、復習フラグを管理します。" />

      {(quizQuestionsError || reviewFlagsError || finalTestSettingsError) && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>
          {[quizQuestionsError, reviewFlagsError, finalTestSettingsError].filter(Boolean).join(" / ")}
        </div>
      )}
      {actionError && (
        <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>
          <span>{actionError}</span>
          <button type="button" onClick={clearActionError} className="shrink-0 font-bold underline">閉じる</button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Stat icon={FileQuestion} label="問題数" value={quizStats.total} sub="登録済み" tone="green" />
        <Stat icon={Eye} label="公開中" value={quizStats.published} sub="受講者向け" tone="cyan" />
        <Stat icon={Tag} label="復習問題" value={quizStats.review} sub="review" tone="amber" />
        <Stat icon={CheckCircle2} label="総合問題" value={quizStats.final} sub="final / ai_final" tone="muted" />
      </div>

      <div className="grid gap-5">
        <div className="space-y-3">
          <Card className="p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_150px_140px_130px]">
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: C.line }}>
                <Search size={16} style={{ color: C.muted }} />
                <input className="w-full bg-transparent text-sm outline-none" value={query} onChange={e => setQuery(e.target.value)} placeholder="問題文・タグ・スキルで検索" style={{ color: C.ink }} />
              </div>
              <select style={fieldStyle} value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
                <option value="">全コース</option>
                {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
              <select style={fieldStyle} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="">全タイプ</option>
                {QUIZ_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select style={fieldStyle} value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)}>
                <option value="">全難易度</option>
                {QUIZ_DIFFICULTY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
              <select style={fieldStyle} value={publishedFilter} onChange={e => setPublishedFilter(e.target.value)}>
                <option value="">公開状態</option>
                <option value="published">公開</option>
                <option value="draft">非公開</option>
              </select>
            </div>
            <div className="mt-3"><Btn size="sm" icon={Plus} onClick={startNew}>新規問題</Btn></div>
          </Card>

          {filtered.length ? (
            <div className="space-y-3">
              {filtered.map(item => (
                <QuizRow
                  key={item.id}
                  item={item}
                  courseName={courseName(item.courseId)}
                  lessonName={lessonName(item.courseId, item.lessonId)}
                  onEdit={startEdit}
                  onTogglePublish={toggleQuizPublish}
                  onDeleteRequest={setDeleteTarget}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="問題がありません" desc="検索条件を変更するか、新規問題を作成してください。" />
          )}
        </div>

        <div className="hidden">
          {deleteTarget && (
            <Card className="p-4" style={{ borderColor: "#FCA5A5" }}>
              <div className="text-sm font-bold" style={{ color: C.ink }}>削除確認</div>
              <p className="mt-1 text-xs" style={{ color: C.body }}>この問題を削除します。localStorage上の管理データから削除されます。</p>
              <div className="mt-3 flex gap-2">
                <Btn kind="ghost" size="sm" onClick={() => setDeleteTarget(null)}>キャンセル</Btn>
                <Btn kind="ghost" size="sm" icon={Trash2} onClick={confirmDelete}>削除する</Btn>
              </div>
            </Card>
          )}
          <QuizForm
            mode={editingQuestion ? "edit" : "new"}
            form={form}
            courses={courses}
            lessons={lessonsForForm}
            onChange={setForm}
            onSubmit={submit}
            onCancel={startNew}
          />
        </div>
      </div>

      <AdminModal
        open={formOpen}
        title={editingQuestion ? "Question edit" : "New question"}
        desc="Question bank data is saved to localStorage for this frontend phase."
        onClose={closeForm}
        width={820}
      >
        <QuizForm
          mode={editingQuestion ? "edit" : "new"}
          form={form}
          courses={courses}
          lessons={lessonsForForm}
          onChange={setForm}
          onSubmit={submit}
          onCancel={closeForm}
        />
      </AdminModal>

      <AdminModal
        open={Boolean(deleteTarget)}
        title="Delete question"
        desc="Delete this question from localStorage admin data."
        onClose={() => setDeleteTarget(null)}
        danger
        width={520}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "#FEE2E2", color: C.red }}>
            <Trash2 size={18} />
            <div className="text-sm font-bold">This question will be removed from the question bank.</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn kind="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Btn>
            <Btn kind="ghost" icon={Trash2} onClick={confirmDelete}>Delete</Btn>
          </div>
        </div>
      </AdminModal>

      <div className="grid gap-5 xl:grid-cols-2">
        <ReviewPanel lessons={allLessons} reviewFlags={reviewFlags} onSave={upsertReviewFlag} onDelete={deleteReviewFlag} />
        <FinalSettingsPanel settings={finalTestSettings} onSave={updateFinalTestSettings} />
      </div>
    </div>
  );
}
