// ==========================================================================
// コース詳細ビュー（2026-07-21 コース中心構造への再編）
// コース一覧から選択した1コースに固定し、設定・レッスン管理・教材管理・理解度と問題・
// 受講状況をサブタブで切り替える。コース選択IDはここで一元管理し、各Managerへ
// fixedCourseId propとして渡す（各Manager内のコース選択セレクトはprop固定時は非表示）。
// ==========================================================================
import React, { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, History, Loader2, PlayCircle, Trash2 } from "lucide-react";
import { Badge, Btn, Card, SectionHead, SkeletonRows, Seg, T, PRODUCT_ACCENT } from "../../../components/common";
import { courseToForm, useLearningAdmin } from "./useLearningAdmin.js";
import { CourseForm, VisibilityBadges } from "./CourseManager.jsx";
import { useCompanyDirectory } from "./useCompanyDirectory.js";
import AdminModal from "./AdminModal.jsx";
import CourseWalkthroughPreview from "./CourseWalkthroughPreview.jsx";
import LessonManager from "./LessonManager.jsx";
import MaterialManager from "./MaterialManager.jsx";
import QuizManager from "./QuizManager.jsx";
import EnrollmentManager from "./EnrollmentManager.jsx";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase, green: PRODUCT_ACCENT.learning.accent, red: T.danger };

const DETAIL_TABS = [
  { value: "settings", label: "設定" },
  { value: "lessons", label: "レッスン管理" },
  { value: "materials", label: "教材管理" },
  { value: "quizzes", label: "理解度・問題" },
  { value: "enrollments", label: "受講状況" },
];

function CourseSettingsTab({ course, role, onDeleted }) {
  const {
    updateCourse, togglePublish, publishCourse, getCourseVersions, deleteCourse,
    lessonsForCourse, quizQuestions,
  } = useLearningAdmin();
  const { companies, companiesError } = useCompanyDirectory();
  const canEditVisibility = role === "admin";
  const [form, setForm] = useState(() => courseToForm(course));
  useEffect(() => { setForm(courseToForm(course)); }, [course.id]);
  const [publishing, setPublishing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsList, setVersionsList] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const published = course.published !== false;
  const versioned = Number(course.publishedVersion || 0) > 0;

  async function handlePublishToggle() {
    setPublishing(true);
    if (published) {
      await togglePublish(course.id);
    } else {
      await publishCourse(course.id);
    }
    setPublishing(false);
  }

  async function openVersions() {
    setVersionsOpen(true);
    setVersionsList(null);
    const versions = await getCourseVersions(course.id);
    setVersionsList(versions);
  }

  function confirmDelete() {
    deleteCourse(course.id);
    setDeleteOpen(false);
    onDeleted();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Btn kind="ghost" size="sm" icon={PlayCircle} onClick={() => setPreviewOpen(true)}>プレビュー</Btn>
          {versioned && <Btn kind="ghost" size="sm" icon={History} onClick={openVersions}>版履歴</Btn>}
          <Btn
            kind="ghost"
            size="sm"
            icon={publishing ? Loader2 : published ? EyeOff : Eye}
            disabled={publishing}
            onClick={handlePublishToggle}
          >
            {publishing ? "処理中..." : published ? "非公開にする" : "公開する"}
          </Btn>
          <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => setDeleteOpen(true)}>削除</Btn>
        </div>
      </Card>

      <Card className="p-5">
        <CourseForm
          mode="edit"
          form={form}
          onChange={setForm}
          onSubmit={() => updateCourse(course.id, form)}
          onCancel={() => setForm(courseToForm(course))}
          canEditVisibility={canEditVisibility}
          companies={companies}
          companiesError={companiesError}
        />
      </Card>

      {previewOpen && (
        <CourseWalkthroughPreview
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          course={course}
          lessons={lessonsForCourse(course.id)}
          finalTestQuestions={quizQuestions
            .filter(q => q.courseId === course.id && q.type === "final" && !q.deleted)
            .map(q => ({ question: q.question, choices: q.choices, answerIndex: q.answer, explanation: q.explanation }))}
        />
      )}

      <AdminModal
        open={versionsOpen}
        title="公開履歴"
        desc={`「${course.title}」の公開バージョン一覧です。`}
        onClose={() => { setVersionsOpen(false); setVersionsList(null); }}
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

      <AdminModal
        open={deleteOpen}
        title="コースを削除"
        desc={`「${course.title}」を受講者のコース一覧から削除します。`}
        onClose={() => setDeleteOpen(false)}
        danger
        width={520}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: T.dangerSubtle, color: C.red }}>
            <Trash2 size={18} />
            <div className="text-sm font-bold">削除すると受講者のコース一覧に表示されなくなります。</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn kind="ghost" onClick={() => setDeleteOpen(false)}>キャンセル</Btn>
            <Btn kind="ghost" icon={Trash2} onClick={confirmDelete}>削除する</Btn>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

export default function CourseDetailView({ courseId, role, activeTab, onTabChange, onBack }) {
  const { courses, coursesLoading } = useLearningAdmin();
  const { companies, companiesError } = useCompanyDirectory();
  const course = courses.find(c => c.id === courseId);

  if (!course) {
    return (
      <div className="space-y-4">
        <Btn kind="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>一覧へ戻る</Btn>
        {coursesLoading ? <Card className="p-4"><SkeletonRows rows={4} /></Card> : (
          <Card className="p-5 text-sm" style={{ color: C.muted }}>このコースは見つかりませんでした。削除された可能性があります。</Card>
        )}
      </div>
    );
  }

  const published = course.published !== false;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Btn kind="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>一覧へ戻る</Btn>
      </div>

      <SectionHead
        title={course.title}
        desc={course.desc}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={published ? "green" : "muted"}>{published ? "公開中" : "非公開"}</Badge>
            <VisibilityBadges course={course} companies={companies} companiesError={companiesError} />
          </div>
        )}
      />

      <Seg value={activeTab} onChange={onTabChange} options={DETAIL_TABS} activeFg={PRODUCT_ACCENT.learning.deep} />

      {activeTab === "settings" && <CourseSettingsTab course={course} role={role} onDeleted={onBack} />}
      {activeTab === "lessons" && <LessonManager fixedCourseId={course.id} />}
      {activeTab === "materials" && <MaterialManager fixedCourseId={course.id} />}
      {activeTab === "quizzes" && <QuizManager fixedCourseId={course.id} />}
      {activeTab === "enrollments" && <EnrollmentManager fixedCourseId={course.id} />}
    </div>
  );
}
