import React, { useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Btn, Field, fieldStyle, T } from "../../../../components/common";
import AdminModal from "../AdminModal.jsx";
import { describeSlideImage, requestMaterialUploadUrl, uploadMaterialFile } from "../useLearningAdmin.js";
import { EMPTY_MATERIAL_FORM } from "../LearningAdminCatalog.js";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

// 2026-08-21: 手元の画像（AWSの構成図など）をそのままスライドへ差し込む。
// 新しい仕組みは作らず、PDF取り込み(SlideDeckImporter)と同じ経路を通す:
//   署名URL発行 → S3へ直PUT → 教材レコード作成 → content.materialId を持つ image スライド
// 受講画面(ElSlideLessonView.jsxのImageSlideBody)が materialId を署名URLへ解決して表示する。
// **本文Markdownへの直接埋め込みはしない**。署名URLには期限があり、本文に書き込むと後で切れる。
const ACCEPTED = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;

let idSeq = 0;
function nextSlideId() {
  idSeq += 1;
  return `slide-img-${Date.now()}-${idSeq}`;
}

function humanSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export default function SlideImageAdder({ open, course, lesson, createMaterialAwaitingApi, onClose, onAdded }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [instruction, setInstruction] = useState("");
  const [url, setUrl] = useState("");
  const [useAi, setUseAi] = useState(true);
  const [state, setState] = useState("idle"); // idle | uploading | describing
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const busy = state !== "idle";

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setInstruction("");
    setUrl("");
    setState("idle");
    setErrorMsg("");
    setDragging(false);
  }

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  function pickFile(next) {
    if (!next) return;
    if (!ACCEPTED.includes(next.type)) {
      setErrorMsg("PNG・JPEG・GIF・WebPの画像を選んでください。");
      return;
    }
    if (next.size > MAX_BYTES) {
      setErrorMsg(`画像が大きすぎます（${humanSize(next.size)}）。4MBまでに縮小してから追加してください。`);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setErrorMsg("");
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  async function handleAdd() {
    if (busy) return;
    // 外部URLの画像はアップロードもAI解析もせず、そのままURLスライドとして追加する。
    if (!file) {
      const trimmed = url.trim();
      if (!trimmed) return;
      onAdded({
        id: nextSlideId(), kind: "image", title: "", navLabel: "", caption: "",
        content: { url: trimmed, alt: "" },
      });
      reset();
      onClose();
      return;
    }
    setErrorMsg("");
    setState("uploading");
    try {
      const { uploadUrl, s3key } = await requestMaterialUploadUrl({
        courseId: course.id, filename: file.name, contentType: file.type,
      });
      await uploadMaterialFile(uploadUrl, file);
      const material = await createMaterialAwaitingApi({
        ...EMPTY_MATERIAL_FORM,
        courseId: course.id,
        lessonId: lesson.id,
        type: "image",
        title: file.name.replace(/\.[^.]+$/, ""),
        status: "published",
        s3key,
        originalFilename: file.name,
        contentType: file.type,
        fileSize: file.size,
        uploadMode: "view",
      });

      // AIの下書きは「あれば嬉しい」もの。失敗しても画像の差し込みは成立させる。
      let draft = { title: "", navLabel: "", alt: "", caption: "" };
      if (useAi) {
        setState("describing");
        try {
          draft = await describeSlideImage({
            materialId: material.id,
            courseTitle: course.title,
            lessonTitle: lesson.title,
            lessonGoal: lesson.goal || "",
            instruction: instruction.trim(),
          });
        } catch (e) {
          setErrorMsg("画像は追加できましたが、AIの説明生成に失敗しました。タイトルと説明は手で入力してください。");
        }
      }

      const fallbackTitle = file.name.replace(/\.[^.]+$/, "");
      onAdded({
        id: nextSlideId(),
        kind: "image",
        title: draft.title || fallbackTitle,
        navLabel: draft.navLabel || "",
        caption: draft.caption || "",
        content: { materialId: material.id, alt: draft.alt || "", caption: draft.caption || "" },
      });
      reset();
      onClose();
    } catch (e) {
      setState("idle");
      setErrorMsg(e?.message || "画像の追加に失敗しました。");
    }
  }

  return (
    <AdminModal
      open={open}
      title="画像をスライドに追加"
      desc="手元の画像（構成図・スクリーンショットなど）を1枚のスライドとして差し込みます。"
      onClose={handleClose}
      width={640}
    >
      <div className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={e => { if (!busy && (e.key === "Enter" || e.key === " ")) inputRef.current?.click(); }}
          onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) pickFile(e.dataTransfer.files?.[0]); }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl px-4 py-8 text-center transition"
          style={{
            border: `1.5px dashed ${dragging ? T.accent : C.line}`,
            background: dragging ? T.accentSubtle : C.canvas,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {previewUrl ? (
            <>
              <img src={previewUrl} alt="" className="max-h-[220px] w-auto rounded-xl object-contain" />
              <span className="text-[11px]" style={{ color: C.muted }}>{file?.name}（{humanSize(file?.size || 0)}）・クリックで選び直す</span>
            </>
          ) : (
            <>
              <Upload size={22} style={{ color: C.muted }} />
              <span className="text-sm font-semibold" style={{ color: C.ink }}>画像をドラッグ＆ドロップ</span>
              <span className="text-[11px]" style={{ color: C.muted }}>クリックしてファイルを選ぶこともできます ・ PNG / JPEG / GIF / WebP ・ 4MBまで</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>

        <Field label="または画像URLを指定（外部の画像を参照する場合）">
          <input
            style={fieldStyle}
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
            disabled={busy || Boolean(file)}
          />
        </Field>

        <label className="flex items-start gap-2 rounded-xl p-3 text-sm font-semibold" style={{ background: T.aiSubtle, color: C.ink }}>
          <input type="checkbox" className="mt-0.5" checked={useAi} onChange={e => setUseAi(e.target.checked)} disabled={busy} />
          <span>
            <span className="inline-flex items-center gap-1.5"><Sparkles size={14} style={{ color: T.aiAccentDeep }} />AIに画像を読ませて、タイトルと説明を下書きする</span>
            <span className="mt-0.5 block text-[11px] font-normal" style={{ color: C.muted }}>
              追加したあとに手で直せます。オフにするとアップロードだけ行います。
            </span>
          </span>
        </label>

        {useAi && !url.trim() && (
          <Field label="AIへの補足（任意）">
            <input
              style={fieldStyle}
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder="例: この図でセキュリティグループの位置を説明したい"
              disabled={busy}
            />
          </Field>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-xl p-3 text-xs" style={{ background: T.warningSubtle, color: T.warning }}>
            <AlertCircle size={14} className="mt-0.5 shrink-0" />{errorMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Btn kind="ghost" icon={X} onClick={handleClose} disabled={busy}>キャンセル</Btn>
          <Btn icon={busy ? Loader2 : ImagePlus} onClick={handleAdd} disabled={(!file && !url.trim()) || busy}>
            {state === "uploading" ? "アップロード中…" : state === "describing" ? "AIが画像を読んでいます…" : "スライドに追加する"}
          </Btn>
        </div>
      </div>
    </AdminModal>
  );
}
