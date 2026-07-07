import React, { useState } from "react";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { AlertCircle, FileText, FileUp, Loader2 } from "lucide-react";
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
// PPTX取り込み(g)はPDFエクスポート版を同じPDFパイプラインで画像化し、元PPTXから
// notesSlides/notesSlideN.xmlを抽出してページ番号でcaptionへ流し込む。

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

function readUint32(view, offset) {
  return view.getUint32(offset, true);
}

function readUint16(view, offset) {
  return view.getUint16(offset, true);
}

function decodeText(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

async function inflateRaw(bytes) {
  if (!("DecompressionStream" in window)) {
    throw new Error("このブラウザはPPTX内の圧縮XML展開に対応していません。Chrome/Edgeでお試しください。");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntries(file, wantedPattern) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (readUint32(view, i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("PPTXのZIP構造を読み取れませんでした。");

  const entryCount = readUint16(view, eocdOffset + 10);
  let centralOffset = readUint32(view, eocdOffset + 16);
  const found = [];
  for (let i = 0; i < entryCount; i += 1) {
    if (readUint32(view, centralOffset) !== 0x02014b50) throw new Error("PPTXの中央ディレクトリを読み取れませんでした。");
    const method = readUint16(view, centralOffset + 10);
    const compressedSize = readUint32(view, centralOffset + 20);
    const nameLength = readUint16(view, centralOffset + 28);
    const extraLength = readUint16(view, centralOffset + 30);
    const commentLength = readUint16(view, centralOffset + 32);
    const localOffset = readUint32(view, centralOffset + 42);
    const name = decodeText(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength));
    if (wantedPattern.test(name)) found.push({ name, method, compressedSize, localOffset });
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  const entries = [];
  for (const entry of found) {
    if (readUint32(view, entry.localOffset) !== 0x04034b50) throw new Error(`${entry.name}を読み取れませんでした。`);
    const localNameLength = readUint16(view, entry.localOffset + 26);
    const localExtraLength = readUint16(view, entry.localOffset + 28);
    const dataStart = entry.localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);
    const data = entry.method === 0 ? compressed : entry.method === 8 ? await inflateRaw(compressed) : null;
    if (!data) throw new Error(`${entry.name}の圧縮形式に対応していません。`);
    entries.push({ name: entry.name, text: decodeText(data) });
  }
  return entries;
}

function extractNoteText(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) return "";
  return [...doc.getElementsByTagName("a:t")]
    .map(node => node.textContent.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPptxNotesByPage(file) {
  const entries = await readZipEntries(file, /^ppt\/notesSlides\/notesSlide\d+\.xml$/);
  const notes = new Map();
  for (const entry of entries) {
    const match = entry.name.match(/notesSlide(\d+)\.xml$/);
    const pageNum = match ? Number(match[1]) : 0;
    const text = extractNoteText(entry.text);
    if (pageNum && text) notes.set(pageNum, text);
  }
  return notes;
}

export default function SlideDeckImporter({ open, course, lesson, createMaterialAwaitingApi, existingSlideCount, onImported, onClose }) {
  const [mode, setMode] = useState("pdf");
  const [file, setFile] = useState(null);
  const [pptxFile, setPptxFile] = useState(null);
  const [state, setState] = useState("idle"); // idle | processing | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");

  function reset() {
    setMode("pdf");
    setFile(null);
    setPptxFile(null);
    setState("idle");
    setProgress({ current: 0, total: 0 });
    setErrorMsg("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function importPdfPages(pdfFile, captionByPage = new Map()) {
    const baseName = pdfFile.name.replace(/\.pdf$/i, "");
    const imported = [];
    let total = 0;
    let currentPage = 0;
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
    const data = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    total = pdf.numPages;
    setProgress({ current: 0, total });

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      currentPage = pageNum;
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
      const caption = captionByPage.get(pageNum) || "";

      imported.push({
        id: nextSlideId(),
        order: existingSlideCount + imported.length,
        kind: "image",
        title: `${baseName} p.${pageNum}`,
        navLabel: `p.${pageNum}`,
        caption,
        content: { materialId: material.id, caption },
      });
      setProgress({ current: pageNum, total });
    }
    return { imported, total, currentPage };
  }

  async function handleImport() {
    if (!file || state === "processing" || (mode === "pptx" && !pptxFile)) return;
    setState("processing");
    setErrorMsg("");
    let imported = [];
    let total = 0;
    let currentPage = 0;
    try {
      const notesByPage = mode === "pptx" ? await extractPptxNotesByPage(pptxFile) : new Map();
      const result = await importPdfPages(file, notesByPage);
      imported = result.imported;
      total = result.total;
      currentPage = result.currentPage;

      onImported(imported);
      setState("done");
    } catch (e) {
      if (imported.length) onImported(imported);
      setErrorMsg(
        `${currentPage || progress.current + 1}/${total || "?"}ページ目の処理に失敗しました（${e?.message || "不明なエラー"}）。` +
        (imported.length ? `${imported.length}ページ分は取り込み済みです。` : "")
      );
      setState("error");
    }
  }

  return (
    <AdminModal open={open} title="スライド資料をインポート" desc={`Lesson: ${lesson?.title || ""}`} onClose={handleClose} width={560}>
      <div className="space-y-4">
        <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
          PDFの各ページを画像化し、このLessonのスライド末尾に追加します。PPTXモードでは元PPTXの発表者ノートを抽出し、同じページ番号のcaptionとして表示します。
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn kind={mode === "pdf" ? "primary" : "ghost"} size="sm" icon={FileText} onClick={() => { setMode("pdf"); setPptxFile(null); setState("idle"); setErrorMsg(""); }}>
            PDFのみ
          </Btn>
          <Btn kind={mode === "pptx" ? "primary" : "ghost"} size="sm" icon={FileUp} onClick={() => { setMode("pptx"); setState("idle"); setErrorMsg(""); }}>
            PPTX+PDF
          </Btn>
        </div>
        <Field label="PDFファイル">
          <input
            type="file"
            accept="application/pdf"
            disabled={state === "processing"}
            onChange={e => { setFile(e.target.files?.[0] || null); setState("idle"); setErrorMsg(""); }}
            style={fieldStyle}
          />
        </Field>
        {mode === "pptx" && (
          <Field label="元PPTXファイル（発表者ノート抽出用）">
            <input
              type="file"
              accept="application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
              disabled={state === "processing"}
              onChange={e => { setPptxFile(e.target.files?.[0] || null); setState("idle"); setErrorMsg(""); }}
              style={fieldStyle}
            />
          </Field>
        )}

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
            <Btn icon={FileUp} onClick={handleImport} disabled={!file || (mode === "pptx" && !pptxFile) || state === "processing"}>
              {state === "processing" ? "取り込んでいます..." : "取り込む"}
            </Btn>
          )}
        </div>
      </div>
    </AdminModal>
  );
}
