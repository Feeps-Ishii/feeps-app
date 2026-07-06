import React, { useState } from "react";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { AlertCircle, FileUp, Loader2 } from "lucide-react";
import { Btn, Field, fieldStyle, T } from "../../../../components/common";
import AdminModal from "../AdminModal.jsx";
import { requestMaterialUploadUrl, uploadMaterialFile } from "../useLearningAdmin.js";
import { EMPTY_MATERIAL_FORM } from "../LearningAdminCatalog.js";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

// (f) PDFページ画像化: クライアント側でpdf.jsを使い各ページをcanvas→PNG化し、既存の教材
// アップロード署名URLフロー(requestMaterialUploadUrl/uploadMaterialFile)でS3へ格納する。
// pdfjs-dist本体(~370KB)は動的import()で実際にPDFを取り込む時だけ読み込む
// (Learning admin画面全体の初期バンドルを肥大化させないため)。
// 新kindは作らず、生成した画像は既存のimage kindスライドとして扱う(content.materialIdを
// ElSlideLessonView.jsxのImageSlideBodyがlrn.getMaterialViewUrlで解決する)。
// PPTX取り込み・発表者ノート抽出は(g)で対応(今回はPDFのみ、notesは持たせない)。

let idSeq = 0;
function nextSlideId() {
  idSeq += 1;
  return `slide-pdf-${Date.now()}-${idSeq}`;
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("PNG変換に失敗しました。"))), "image/png");
  });
}

export default function SlideDeckImporter({ open, course, lesson, createMaterialAwaitingApi, existingSlideCount, onImported, onClose }) {
  const [file, setFile] = useState(null);
  const [state, setState] = useState("idle"); // idle | processing | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");

  function reset() {
    setFile(null);
    setState("idle");
    setProgress({ current: 0, total: 0 });
    setErrorMsg("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleImport() {
    if (!file || state === "processing") return;
    setState("processing");
    setErrorMsg("");
    const baseName = file.name.replace(/\.pdf$/i, "");
    const imported = [];
    let total = 0;
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
      const data = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      total = pdf.numPages;
      setProgress({ current: 0, total });

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        const blob = await canvasToPngBlob(canvas);

        const filename = `${baseName}-p${pageNum}.png`;
        const { uploadUrl, s3key } = await requestMaterialUploadUrl({ courseId: course.id, filename, contentType: "image/png" });
        await uploadMaterialFile(uploadUrl, blob);
        const material = await createMaterialAwaitingApi({
          ...EMPTY_MATERIAL_FORM,
          courseId: course.id,
          lessonId: lesson.id,
          type: "image",
          title: `${baseName} p.${pageNum}`,
          status: "published",
          s3key,
          originalFilename: filename,
          contentType: "image/png",
          fileSize: blob.size,
          uploadMode: "view",
        });

        imported.push({
          id: nextSlideId(),
          order: existingSlideCount + imported.length,
          kind: "image",
          title: `${baseName} p.${pageNum}`,
          navLabel: `p.${pageNum}`,
          content: { materialId: material.id },
        });
        setProgress({ current: pageNum, total });
      }

      onImported(imported);
      setState("done");
    } catch (e) {
      if (imported.length) onImported(imported);
      setErrorMsg(
        `${progress.current + 1}/${total || "?"}ページ目の処理に失敗しました（${e?.message || "不明なエラー"}）。` +
        (imported.length ? `${imported.length}ページ分は取り込み済みです。` : "")
      );
      setState("error");
    }
  }

  return (
    <AdminModal open={open} title="PDFからスライドをインポート" desc={`Lesson: ${lesson?.title || ""}`} onClose={handleClose} width={560}>
      <div className="space-y-4">
        <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
          PDFの各ページを画像化し、このLessonのスライド末尾に追加します（既存のimage kindとして追加、ページ数分の教材が「教材管理」タブにも登録されます）。
        </p>
        <Field label="PDFファイル">
          <input
            type="file"
            accept="application/pdf"
            disabled={state === "processing"}
            onChange={e => { setFile(e.target.files?.[0] || null); setState("idle"); setErrorMsg(""); }}
            style={fieldStyle}
          />
        </Field>

        {state === "processing" && (
          <div className="flex items-center gap-2 rounded-xl p-3 text-sm" style={{ background: C.canvas, color: C.body }}>
            <Loader2 size={15} className="animate-spin" />
            {progress.total ? `${progress.current}/${progress.total}ページ処理中...` : "PDFを読み込んでいます..."}
          </div>
        )}
        {state === "error" && (
          <div className="rounded-xl p-3" style={{ background: T.dangerSubtle, border: `1px solid ${T.danger}30` }}>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-bold" style={{ color: T.danger }}>
              <AlertCircle size={13} />取り込みに失敗しました
            </div>
            <p className="text-xs leading-relaxed" style={{ color: C.body }}>{errorMsg}</p>
          </div>
        )}
        {state === "done" && (
          <div className="rounded-xl p-3 text-xs font-semibold" style={{ background: T.bgBase, color: C.body }}>
            {progress.total}ページを取り込みました。スライド一覧に反映されています。
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: C.line }}>
          <Btn kind="ghost" onClick={handleClose}>{state === "done" ? "閉じる" : "キャンセル"}</Btn>
          {state !== "done" && (
            <Btn icon={FileUp} onClick={handleImport} disabled={!file || state === "processing"}>
              {state === "processing" ? "取り込んでいます..." : "取り込む"}
            </Btn>
          )}
        </div>
      </div>
    </AdminModal>
  );
}
