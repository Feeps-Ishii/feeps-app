import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Clock,
  Eye,
  EyeOff,
  File,
  FileText,
  Link,
  Loader2,
  Paperclip,
  Pencil,
  PlayCircle,
  Plus,
  Presentation,
  Save,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge, Btn, Card, EmptyState, Field, SectionHead, SkeletonRows, Stat, fieldStyle, T, PRODUCT_ACCENT } from "../../../components/common";
import { EMPTY_MATERIAL_FORM, MATERIAL_TYPE_OPTIONS } from "./LearningAdminCatalog.js";
import { materialToForm, requestMaterialUploadUrl, uploadMaterialFile, useLearningAdmin } from "./useLearningAdmin.js";
import AdminModal from "./AdminModal.jsx";

// Backendの MATERIAL_ALLOWED_CONTENT_TYPES と同じ許可リスト（クライアント側の選択肢を絞るためのみに使用）。
const MATERIAL_UPLOAD_ACCEPT = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4",
  "image/png",
  "image/jpeg",
].join(",");

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase, green: PRODUCT_ACCENT.learning.accent, red: T.danger };

const typeIcon = {
  video: PlayCircle,
  pdf: FileText,
  slide: Presentation,
  text: BookOpen,
  link: Link,
  file: File,
};

function MaterialForm({ mode, form, courses, lessons, onChange, onSubmit, onCancel }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  function set(key, value) {
    const next = { ...form, [key]: value };
    if (key === "courseId") next.lessonId = "";
    onChange(next);
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じファイルを選び直せるようにリセット
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const { uploadUrl, s3key } = await requestMaterialUploadUrl({
        courseId: form.courseId,
        filename: file.name,
        contentType: file.type,
      });
      await uploadMaterialFile(uploadUrl, file);
      onChange({
        ...form,
        s3key,
        originalFilename: file.name,
        contentType: file.type,
        fileSize: file.size,
      });
    } catch (err) {
      setUploadError("アップロードに失敗しました。もう一度お試しください。");
    } finally {
      setUploading(false);
    }
  }

  function clearUpload() {
    onChange({ ...form, s3key: "", originalFilename: "", contentType: "", fileSize: 0 });
    setUploadError("");
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold" style={{ color: C.ink }}>{mode === "edit" ? "教材編集" : "教材新規作成"}</h3>
          <p className="text-xs" style={{ color: C.muted }}>外部URLの登録、またはファイルをアップロードして教材を登録できます。</p>
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
          <Field label="レッスン">
            <select style={fieldStyle} value={form.lessonId} onChange={e => set("lessonId", e.target.value)}>
              <option value="">選択してください</option>
              {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="教材種別">
            <select style={fieldStyle} value={form.type} onChange={e => set("type", e.target.value)}>
              {MATERIAL_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="公開状態">
            <select style={fieldStyle} value={form.status} onChange={e => set("status", e.target.value)}>
              <option value="published">公開</option>
              <option value="draft">非公開</option>
            </select>
          </Field>
        </div>
        <Field label="教材タイトル">
          <input style={fieldStyle} value={form.title} onChange={e => set("title", e.target.value)} placeholder="例: AWS基礎資料" />
        </Field>
        <Field label="説明">
          <textarea style={{ ...fieldStyle, minHeight: 72 }} value={form.description} onChange={e => set("description", e.target.value)} placeholder="教材の説明を入力" />
        </Field>
        <Field label="教材URL">
          <input style={fieldStyle} value={form.url} onChange={e => set("url", e.target.value)} placeholder="https://example.com/material.pdf" />
        </Field>
        <Field label="教材ファイル（アップロード）">
          <div className="space-y-2">
            {form.s3key ? (
              <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: C.canvas }}>
                <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs" style={{ color: C.ink }}>
                  <Paperclip size={13} />{form.originalFilename || "アップロード済みファイル"}
                </span>
                <Btn kind="ghost" size="sm" icon={X} onClick={clearUpload}>解除</Btn>
              </div>
            ) : (
              <label
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{ borderColor: C.line, color: form.courseId ? C.body : C.muted, cursor: form.courseId ? "pointer" : "not-allowed" }}
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? "アップロード中..." : "ファイルを選択（PDF / PPTX / DOCX / MP4 / PNG / JPG）"}
                <input
                  type="file"
                  accept={MATERIAL_UPLOAD_ACCEPT}
                  onChange={handleFileChange}
                  disabled={!form.courseId || uploading}
                  className="hidden"
                />
              </label>
            )}
            {!form.courseId && <p className="text-[11px]" style={{ color: C.muted }}>コースを選択するとファイルをアップロードできます。</p>}
            {uploadError && (
              <p className="flex items-center gap-1 text-[11px]" style={{ color: C.red }}><AlertCircle size={12} />{uploadError}</p>
            )}
            {form.s3key && (
              <Field label="表示方法">
                <select style={fieldStyle} value={form.uploadMode} onChange={e => set("uploadMode", e.target.value)}>
                  <option value="view">プレビュー表示</option>
                  <option value="download">ダウンロードのみ</option>
                </select>
              </Field>
            )}
          </div>
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="想定学習時間（分）">
            <input style={fieldStyle} value={form.duration} onChange={e => set("duration", e.target.value)} placeholder="10" />
          </Field>
          <Field label="表示順">
            <input style={fieldStyle} value={form.order} onChange={e => set("order", e.target.value)} placeholder="1" />
          </Field>
        </div>
        <Field label="タグ（カンマ区切り）">
          <input style={fieldStyle} value={form.tagsText} onChange={e => set("tagsText", e.target.value)} placeholder="AWS, 基礎" />
        </Field>
        <Field label="管理メモ">
          <textarea style={{ ...fieldStyle, minHeight: 84 }} value={form.memo} onChange={e => set("memo", e.target.value)} placeholder="社内研修用、差し替え予定など" />
        </Field>
        <div className="flex flex-wrap gap-2 pt-1">
          <Btn icon={Save} onClick={onSubmit} disabled={!form.title.trim() || !form.courseId || !form.lessonId}>{mode === "edit" ? "保存" : "作成"}</Btn>
          <Btn kind="ghost" onClick={onCancel}>キャンセル</Btn>
        </div>
      </div>
    </div>
  );
}

function MaterialRow({ material, courseName, lessonName, onEdit, onTogglePublish, onDeleteRequest }) {
  const published = material.status === "published";
  const Icon = typeIcon[material.type] || File;
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: C.green }}>
            <Icon size={21} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-bold" style={{ color: C.ink }}>{material.title}</h3>
              <Badge tone="cyan">{material.type}</Badge>
              <Badge tone={published ? "green" : "muted"}>{published ? "公開中" : "非公開"}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs" style={{ color: C.body }}>{material.description}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: C.muted }}>
              <span>{courseName}</span>
              <span>{lessonName}</span>
              <span className="inline-flex items-center gap-1"><Clock size={13} />{material.duration}分</span>
              <span>#{material.order}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {(material.tags || []).slice(0, 5).map(tag => <Badge key={tag} tone="muted">{tag}</Badge>)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Btn kind="ghost" size="sm" icon={Pencil} onClick={() => onEdit(material)}>編集</Btn>
          <Btn kind="ghost" size="sm" icon={published ? EyeOff : Eye} onClick={() => onTogglePublish(material.id)}>
            {published ? "非公開" : "公開"}
          </Btn>
          <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => onDeleteRequest(material)}>削除</Btn>
        </div>
      </div>
    </Card>
  );
}

export default function MaterialManager() {
  const {
    courses,
    lessonsForCourse,
    materials,
    materialsLoading,
    materialsError,
    materialStats,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    toggleMaterialPublish,
    actionError,
    clearActionError,
  } = useLearningAdmin();
  const initialCourseId = courses[0]?.id || "";
  const initialLessonId = initialCourseId ? lessonsForCourse(initialCourseId)[0]?.id || "" : "";
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_MATERIAL_FORM, courseId: initialCourseId, lessonId: initialLessonId });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const lessonsForForm = form.courseId ? lessonsForCourse(form.courseId) : [];
  const courseName = (courseId) => courses.find(course => course.id === courseId)?.title || "未選択";
  const lessonName = (courseId, lessonId) => lessonsForCourse(courseId).find(lesson => lesson.id === lessonId)?.title || "未選択";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter(material => {
      if (courseFilter && material.courseId !== courseFilter) return false;
      if (!q) return true;
      return [
        material.title,
        material.type,
        material.description,
        material.url,
        material.memo,
        courseName(material.courseId),
        lessonName(material.courseId, material.lessonId),
        ...(material.tags || []),
      ].some(value => String(value || "").toLowerCase().includes(q));
    });
  }, [materials, query, courseFilter]);

  function startNew() {
    const courseId = courseFilter || initialCourseId;
    const lessonId = courseId ? lessonsForCourse(courseId)[0]?.id || "" : "";
    setEditingMaterial(null);
    setForm({ ...EMPTY_MATERIAL_FORM, courseId, lessonId });
    setDeleteTarget(null);
    setFormOpen(true);
  }

  function startEdit(material) {
    setEditingMaterial(material);
    setForm(materialToForm(material));
    setDeleteTarget(null);
    setFormOpen(true);
  }

  function closeForm() {
    const courseId = courseFilter || initialCourseId;
    const lessonId = courseId ? lessonsForCourse(courseId)[0]?.id || "" : "";
    setEditingMaterial(null);
    setForm({ ...EMPTY_MATERIAL_FORM, courseId, lessonId });
    setFormOpen(false);
  }

  function submit() {
    if (editingMaterial) {
      updateMaterial(editingMaterial.id, form);
      setEditingMaterial(null);
    } else {
      createMaterial(form);
    }
    closeForm();
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMaterial(deleteTarget.id);
    if (editingMaterial?.id === deleteTarget.id) closeForm();
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-5">
      <SectionHead title="教材管理" desc="コース・レッスンに紐づく教材メタデータを管理します。" />

      {materialsError && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{materialsError}</div>
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
            <div className="text-sm font-bold" style={{ color: C.ink }}>管理者向け教材メタデータ</div>
            <p className="mt-1 text-xs" style={{ color: C.body }}>
              URLリンク教材、またはファイルアップロード（PDF / PPTX / DOCX / MP4 / PNG / JPG）を登録できます。
            </p>
          </div>
          <Btn icon={Plus} onClick={startNew}>新規教材</Btn>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat icon={File} label="教材数" value={materialStats.total} sub="管理対象" tone="green" />
        <Stat icon={Eye} label="公開中" value={materialStats.published} sub="受講者に表示" tone="cyan" />
        <Stat icon={EyeOff} label="非公開" value={materialStats.draft} sub="公開前" tone="amber" />
        <Stat icon={Tag} label="紐づきLesson" value={materialStats.linkedLessons} sub="利用中" tone="muted" />
      </div>

      <div className="grid gap-5">
        <div className="space-y-3">
          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: C.line, background: "#fff" }}>
                <Search size={16} style={{ color: C.muted }} />
                <input
                  className="w-full bg-transparent text-sm outline-none"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="教材名・URL・タグで検索"
                  style={{ color: C.ink }}
                />
              </div>
              <select style={fieldStyle} value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
                <option value="">全コース</option>
                {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </div>
          </Card>

          {filtered.length ? (
            <div className="space-y-3">
              {filtered.map(material => (
                <MaterialRow
                  key={material.id}
                  material={material}
                  courseName={courseName(material.courseId)}
                  lessonName={lessonName(material.courseId, material.lessonId)}
                  onEdit={startEdit}
                  onTogglePublish={toggleMaterialPublish}
                  onDeleteRequest={setDeleteTarget}
                />
              ))}
            </div>
          ) : materialsLoading ? (
            <Card className="p-4"><SkeletonRows rows={4} /></Card>
          ) : (
            <EmptyState
              title={materials.length ? "教材がありません" : "教材がまだ登録されていません"}
              desc={materials.length ? "検索条件を変更するか、新規教材を作成してください。" : "「新規教材」からURLまたはファイルを登録してください。"}
            />
          )}
        </div>
      </div>

      <AdminModal
        open={formOpen}
        title={editingMaterial ? "教材編集" : "教材新規作成"}
        desc="URLリンク教材、またはファイルアップロード（PDF / PPTX / DOCX / MP4 / PNG / JPG）を登録できます。"
        onClose={closeForm}
      >
        <MaterialForm
          mode={editingMaterial ? "edit" : "new"}
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
        title="教材の削除"
        desc={deleteTarget ? `「${deleteTarget.title}」を削除します。` : ""}
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
    </div>
  );
}
