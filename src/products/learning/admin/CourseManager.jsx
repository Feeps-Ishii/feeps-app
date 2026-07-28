import React, { useMemo, useState } from "react";
import { BookOpen, Clock, Eye, EyeOff, History, ListChecks, Loader2, Pencil, Plus, PlayCircle, Save, Search, Sparkles, Tag, Trash2, X } from "lucide-react";
import { Badge, Btn, Card, EmptyState, Field, SectionHead, SkeletonRows, Stat, fieldStyle, T, PRODUCT_ACCENT } from "../../../components/common";
import { COURSE_CATEGORY_OPTIONS, COURSE_COLOR_OPTIONS, COURSE_LEVEL_OPTIONS, COURSE_VISIBILITY_SCOPE_OPTIONS, EMPTY_COURSE_FORM } from "./LearningAdminCatalog.js";
import { useLearningAdmin } from "./useLearningAdmin.js";
import AdminModal from "./AdminModal.jsx";
import CourseWalkthroughPreview from "./CourseWalkthroughPreview.jsx";
import { useCompanyDirectory, companyNameResolver } from "./useCompanyDirectory.js";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase, green: PRODUCT_ACCENT.learning.accent, greenW: PRODUCT_ACCENT.learning.subtle, red: T.danger };

// コース一覧・コース詳細(設定タブ)の両方から使う公開範囲バッジ。
// 2026-07-21 コース中心構造への再編で共通コンポーネント化。
export function VisibilityBadges({ course, companies, companiesError }) {
  const scope = course.visibilityScope || "all";
  if (scope !== "companies") return <Badge tone="green">全体公開</Badge>;
  const ids = Array.isArray(course.targetCompanyIds) ? course.targetCompanyIds : [];
  if (!ids.length) return <Badge tone="amber">対象企業未設定</Badge>;
  const nameFor = companyNameResolver(companies, companiesError);
  const shown = ids.slice(0, 3);
  const extra = ids.length - shown.length;
  return (
    <>
      {shown.map(id => <Badge key={id} tone="cyan">{nameFor(id)}</Badge>)}
      {extra > 0 && <Badge tone="muted">+{extra}社</Badge>}
    </>
  );
}

export function CourseForm({ mode, form, onChange, onSubmit, onCancel, canEditVisibility, companies, companiesError }) {
  function set(key, value) {
    onChange({ ...form, [key]: value });
  }

  function toggleTargetCompany(companyId) {
    const current = Array.isArray(form.targetCompanyIds) ? form.targetCompanyIds : [];
    const next = current.includes(companyId) ? current.filter(id => id !== companyId) : [...current, companyId];
    set("targetCompanyIds", next);
  }

  const companyName = (id) => companies.find(c => c.companyId === id)?.name || "（企業情報なし）";

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
        <Field label="公開範囲">
          {canEditVisibility ? (
            <div className="space-y-2">
              <select
                style={fieldStyle}
                value={form.visibilityScope || "all"}
                onChange={e => set("visibilityScope", e.target.value)}
              >
                {COURSE_VISIBILITY_SCOPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {form.visibilityScope === "companies" && (
                <div className="rounded-xl border p-3" style={{ borderColor: C.line }}>
                  {companiesError ? (
                    <p className="text-xs" style={{ color: C.red }}>{companiesError}</p>
                  ) : companies.length === 0 ? (
                    <p className="text-xs" style={{ color: C.muted }}>企業一覧を取得中、または登録企業がありません。</p>
                  ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {companies.map(company => (
                        <label key={company.companyId} className="flex items-center gap-2 text-xs" style={{ color: C.ink }}>
                          <input
                            type="checkbox"
                            checked={(form.targetCompanyIds || []).includes(company.companyId)}
                            onChange={() => toggleTargetCompany(company.companyId)}
                          />
                          {company.name || company.companyId}
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[11px]" style={{ color: C.muted }}>
                    選択した企業に所属する受講生のみがこのコースを閲覧できます（管理者・講師には影響しません）。
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl p-3 text-xs" style={{ background: C.canvas, color: C.body }}>
              {form.visibilityScope === "companies" ? (
                <>特定企業のみ公開（{(form.targetCompanyIds || []).length}社: {(form.targetCompanyIds || []).map(companyName).join("、") || "未設定"}）</>
              ) : (
                <>全体公開</>
              )}
              <p className="mt-1 text-[11px]" style={{ color: C.muted }}>公開範囲の変更は管理者のみ行えます。</p>
            </div>
          )}
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

function CourseRow({ course, onEdit, onOpenLessons, onSelectCourse, onTogglePublish, onPublish, onDeleteRequest, onPreview, onShowVersions, publishing, companies, companiesError }) {
  const published = course.published !== false;
  const versioned = Number(course.publishedVersion || 0) > 0;
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex min-w-0 cursor-pointer gap-3"
          role="button"
          tabIndex={0}
          onClick={() => onSelectCourse(course)}
          onKeyDown={e => { if (e.key === "Enter") onSelectCourse(course); }}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: course.color || C.green }}>
            <BookOpen size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-bold" style={{ color: C.ink }}>{course.title}</h3>
              <Badge tone={published ? "green" : "muted"}>{published ? "公開中" : "非公開"}</Badge>
              {versioned && <Badge tone="cyan">v{course.publishedVersion}</Badge>}
              <VisibilityBadges course={course} companies={companies} companiesError={companiesError} />
            </div>
            <p className="mt-1 line-clamp-2 text-xs" style={{ color: C.body }}>{course.desc}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: C.muted }}>
              <span className="inline-flex items-center gap-1"><Tag size={13} />{course.category}</span>
              <span className="inline-flex items-center gap-1"><Clock size={13} />{course.duration}時間</span>
              <span>{course.level}</span>
              <span>レッスン {course.lessons || 0}件</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {(course.skills || []).slice(0, 5).map(skill => <Badge key={skill} tone="cyan">{skill}</Badge>)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Btn kind="ghost" size="sm" icon={PlayCircle} onClick={() => onPreview(course)}>プレビュー</Btn>
          <Btn kind="ghost" size="sm" icon={ListChecks} onClick={() => onOpenLessons(course)}>レッスン管理</Btn>
          <Btn kind="ghost" size="sm" icon={Pencil} onClick={() => onEdit(course)}>編集</Btn>
          {versioned && <Btn kind="ghost" size="sm" icon={History} onClick={() => onShowVersions(course)}>版履歴</Btn>}
          <Btn
            kind="ghost"
            size="sm"
            icon={publishing ? Loader2 : published ? EyeOff : Eye}
            disabled={publishing}
            onClick={() => (published ? onTogglePublish(course.id) : onPublish(course.id))}
          >
            {publishing ? "公開中..." : published ? "非公開にする" : "公開する"}
          </Btn>
          <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => onDeleteRequest(course)}>削除</Btn>
        </div>
      </div>
    </Card>
  );
}

export default function CourseManager({ onOpenLessons = () => {}, onSelectCourse = () => {}, onOpenStudio = () => {}, role }) {
  const {
    courses, coursesLoading, coursesError, stats,
    createCourse, togglePublish, publishCourse, getCourseVersions, deleteCourse,
    lessonsForCourse, quizQuestions,
    actionError, clearActionError,
  } = useLearningAdmin();
  const canEditVisibility = role === "admin";
  // 可視範囲制御（企業単位、2026-07-21追加）: 企業一覧は既存の /companies を再利用する（新規API追加禁止）。
  // GET /companies は admin・instructor どちらも呼び出せる（isInstructorはadminを含む判定）。
  const { companies, companiesError } = useCompanyDirectory();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ ...EMPTY_COURSE_FORM });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  // 「＋コース追加」の入口選択（自分で作る／AIに任せる、2026-07-21コース中心構造再編）。
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [previewCourse, setPreviewCourse] = useState(null);
  const [versionsCourse, setVersionsCourse] = useState(null);
  const [versionsList, setVersionsList] = useState(null); // null=未取得 | []=取得済み0件 | [...]

  async function handlePublish(courseId) {
    setPublishingId(courseId);
    await publishCourse(courseId);
    setPublishingId(null);
  }

  async function handleShowVersions(course) {
    setVersionsCourse(course);
    setVersionsList(null);
    const versions = await getCourseVersions(course.id);
    setVersionsList(versions);
  }

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

  function openAddChoice() {
    setAddChoiceOpen(true);
  }

  function startNew() {
    setAddChoiceOpen(false);
    setForm({ ...EMPTY_COURSE_FORM });
    setDeleteTarget(null);
    setFormOpen(true);
  }

  function startStudio() {
    setAddChoiceOpen(false);
    onOpenStudio();
  }

  function closeForm() {
    setForm({ ...EMPTY_COURSE_FORM });
    setFormOpen(false);
  }

  function submit() {
    createCourse(form);
    closeForm();
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteCourse(deleteTarget.id);
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
          <Btn icon={Plus} onClick={openAddChoice}>＋コース追加</Btn>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat icon={BookOpen} label="総コース" value={stats.total} sub="管理対象" tone="green" />
        <Stat icon={Eye} label="公開中" value={stats.published} sub="受講者に表示" tone="cyan" />
        <Stat icon={EyeOff} label="非公開" value={stats.privateCount} sub="公開前" tone="amber" />
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
                  onEdit={onSelectCourse}
                  onOpenLessons={onOpenLessons}
                  onSelectCourse={onSelectCourse}
                  onTogglePublish={togglePublish}
                  onPublish={handlePublish}
                  onDeleteRequest={setDeleteTarget}
                  onPreview={setPreviewCourse}
                  onShowVersions={handleShowVersions}
                  publishing={publishingId === course.id}
                  companies={companies}
                  companiesError={companiesError}
                />
              ))}
            </div>
          ) : coursesLoading ? (
            <Card className="p-4"><SkeletonRows rows={4} /></Card>
          ) : (
            <EmptyState
              title={courses.length ? "該当するコースがありません" : "コースがまだ登録されていません"}
              desc={courses.length ? "検索条件を変更するか、新規コースを作成してください。" : "「＋コース追加」からEラーニングコースを作成してください。"}
            />
          )}
        </div>

      </div>

      <AdminModal
        open={addChoiceOpen}
        title="コースを追加"
        desc="コースの作り方を選んでください。"
        onClose={() => setAddChoiceOpen(false)}
        width={520}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={startNew}
            className="rounded-2xl border p-4 text-left transition hover:shadow-md"
            style={{ borderColor: C.line }}
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: C.green }}>
              <Pencil size={16} />
            </div>
            <div className="text-sm font-bold" style={{ color: C.ink }}>自分で作る</div>
            <p className="mt-1 text-xs" style={{ color: C.body }}>コース情報を手入力し、レッスン・教材・問題をあとから追加します。</p>
          </button>
          <button
            type="button"
            onClick={startStudio}
            className="rounded-2xl border p-4 text-left transition hover:shadow-md"
            style={{ borderColor: C.line }}
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: PRODUCT_ACCENT.learning.deep }}>
              <Sparkles size={16} />
            </div>
            <div className="text-sm font-bold" style={{ color: C.ink }}>AIに任せる</div>
            <p className="mt-1 text-xs" style={{ color: C.body }}>Learning Studioで目的からAI構成案・Lesson・総合テストを作成します。</p>
          </button>
        </div>
      </AdminModal>

      <AdminModal
        open={formOpen}
        title="コース新規作成"
        desc="受講者向けのコース情報を登録し、Learning管理APIへ保存します。"
        onClose={closeForm}
      >
        <CourseForm
          mode="new"
          form={form}
          onChange={setForm}
          onSubmit={submit}
          onCancel={closeForm}
          canEditVisibility={canEditVisibility}
          companies={companies}
          companiesError={companiesError}
        />
      </AdminModal>

      <AdminModal
        open={Boolean(deleteTarget)}
        title="コースを削除"
        desc={deleteTarget ? `「${deleteTarget.title}」を受講者のコース一覧から削除します。` : ""}
        onClose={() => setDeleteTarget(null)}
        danger
        width={520}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: T.dangerSubtle, color: C.red }}>
            <Trash2 size={18} />
            <div className="text-sm font-bold">削除すると受講者のコース一覧に表示されなくなります。</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn kind="ghost" onClick={() => setDeleteTarget(null)}>キャンセル</Btn>
            <Btn kind="ghost" icon={Trash2} onClick={confirmDelete}>削除する</Btn>
          </div>
        </div>
      </AdminModal>

      {previewCourse && (
        <CourseWalkthroughPreview
          open={Boolean(previewCourse)}
          onClose={() => setPreviewCourse(null)}
          course={previewCourse}
          lessons={lessonsForCourse(previewCourse.id)}
          finalTestQuestions={quizQuestions
            .filter(q => q.courseId === previewCourse.id && q.type === "final" && !q.deleted)
            .map(q => ({ question: q.question, choices: q.choices, answerIndex: q.answer, explanation: q.explanation }))}
        />
      )}

      <AdminModal
        open={Boolean(versionsCourse)}
        title="公開履歴"
        desc={versionsCourse ? `「${versionsCourse.title}」の公開バージョン一覧です。` : ""}
        onClose={() => { setVersionsCourse(null); setVersionsList(null); }}
        width={620}
      >
        {versionsList === null ? (
          <SkeletonRows rows={3} />
        ) : versionsList.length === 0 ? (
          <p className="text-sm" style={{ color: C.muted }}>公開履歴がありません。</p>
        ) : (
          <div className="space-y-2">
            {versionsList.map(v => (
              <div key={v.version} className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: C.canvas, border: `1px solid ${C.line}` }}>
                <div>
                  <div className="text-sm font-bold" style={{ color: C.ink }}>v{v.version}</div>
                  <div className="text-xs" style={{ color: C.muted }}>
                    {v.publishedAt ? new Date(v.publishedAt).toLocaleString("ja-JP") : "日時不明"}
                    {v.publishedByRole ? `・${v.publishedByRole}が公開` : ""}
                  </div>
                </div>
                <div className="text-xs" style={{ color: C.muted }}>レッスン{v.lessonCount}件・総合テスト{v.finalTestQuestionCount}問</div>
              </div>
            ))}
          </div>
        )}
      </AdminModal>
    </div>
  );
}
