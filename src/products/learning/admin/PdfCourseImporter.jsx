import React, { useEffect, useRef, useState } from "react";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { AlertCircle, BadgeCheck, CheckCircle2, FileUp, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Btn, Field, fieldStyle, T } from "../../../components/common";
import AdminModal from "./AdminModal.jsx";
import { requestMaterialUploadUrl, uploadMaterialFile } from "./useLearningAdmin.js";
import { EMPTY_COURSE_FORM, EMPTY_MATERIAL_FORM } from "./LearningAdminCatalog.js";
import { extractPptxNotesByPage } from "./pptxNotes.js";
import { apiGet, apiPost } from "../../../api.js";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

// 2026-08-21: 自社に既にある研修PDFから、今のEラーニングと同じ形（ページ＋解説＋演習）を起こす。
//
// **テキスト抽出だけでは足りない。** 実物のIT基礎PDF(72ページ)は本文が4,772文字しかなく
// (平均66文字/ページ、10ページは1文字も取れない)、情報の大半が図の中にある。
// そこで各ページを画像にしてS3へ上げ、Claudeに読ませる。
//
// この画面の仕事は「ページ画像を作って上げる」まで。**そこから先はサーバー側で走る**ので、
// 取り込み開始後はタブを閉じてよい（進み具合は GET /pdf-import/{id} で追える）。
// ページ画像化だけはブラウザでしかできないため、その間だけ開いたままにしてもらう。
//
// 既存の SlideDeckImporter と同じ経路(署名URL→S3→教材→imageスライド)を使い、
// 新しい保存の仕組みは作らない。
const PAGE_SCALE = 1.6;          // 1024px前後。読ませるのに十分で、アップロードが重くなりすぎない
const UPLOAD_CONCURRENCY = 3;
const MAX_PAGES = 120;
const POLL_MS = 5000;

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("PNG変換に失敗しました。"))), "image/png");
  });
}

function StepRow({ done, active, label, detail }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: done ? T.successSubtle : active ? T.accentSubtle : C.canvas }}>
        {done ? <CheckCircle2 size={13} style={{ color: T.success }} />
          : active ? <Loader2 size={12} className="animate-spin" style={{ color: T.accent }} />
            : <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.line }} />}
      </span>
      <div className="min-w-0">
        <div className="text-xs font-bold" style={{ color: done || active ? C.ink : C.muted }}>{label}</div>
        {detail && <div className="mt-0.5 text-[11px]" style={{ color: C.muted }}>{detail}</div>}
      </div>
    </div>
  );
}

export default function PdfCourseImporter({
  open, onClose, onCreated, canMarkOfficial,
  createCourseAwaitingApi, createMaterialAwaitingApi,
}) {
  const [file, setFile] = useState(null);
  // パワポの発表者ノート（任意）。**スライドは見た目、ノートは説明**なので、分けて渡す
  const [pptxFile, setPptxFile] = useState(null);
  const [notesCount, setNotesCount] = useState(null);
  const [courseHint, setCourseHint] = useState("");
  const [note, setNote] = useState("");
  const [official, setOfficial] = useState(Boolean(canMarkOfficial));
  const [exerciseCount, setExerciseCount] = useState(3);
  // idle | render | upload | running | done | error
  // ブラウザが要るのは render / upload まで。running から先はサーバー側。
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [importId, setImportId] = useState("");
  const [importState, setImportState] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdCourse, setCreatedCourse] = useState(null);
  const inputRef = useRef(null);
  // 閉じられないのはブラウザが要る間だけ。
  const blocking = phase === "render" || phase === "upload";

  // 開いている間は進み具合を見に行く。閉じても取り込み自体は続く。
  useEffect(() => {
    if (!importId || !open) return undefined;
    if (["done", "error"].includes(importState?.status)) return undefined;
    let alive = true;
    const timer = setInterval(async () => {
      try {
        const state = await apiGet(`/learning/admin/pdf-import/${encodeURIComponent(importId)}`);
        if (!alive) return;
        setImportState(state);
        if (state.status === "done") setPhase("done");
        if (state.status === "error") { setPhase("error"); setErrorMsg(state.error || "取り込みに失敗しました。"); }
      } catch (e) {
        // 一時的な失敗で進行表示を壊さない。次の周期で取り直す。
      }
    }, POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [importId, open, importState?.status]);

  function handleClose() {
    if (blocking) return;
    setFile(null); setCourseHint(""); setNote(""); setPhase("idle"); setErrorMsg("");
    setProgress({ current: 0, total: 0 }); setImportId(""); setImportState(null); setCreatedCourse(null);
    onClose();
  }

  // ページをPNG化してS3へ。アップロードは3本ずつ並列にする（72ページを直列で回すと待ち時間が長い）。
  async function renderAndUpload(courseId, pdfFile) {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
    const pdf = await pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() }).promise;
    const total = Math.min(pdf.numPages, MAX_PAGES);
    setProgress({ current: 0, total });
    const baseName = pdfFile.name.replace(/\.pdf$/i, "");

    const rendered = [];
    for (let pageNum = 1; pageNum <= total; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: PAGE_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const blob = await canvasToPngBlob(canvas);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(i => i.str).join("").replace(/\s+/g, " ").trim();
      rendered.push({ page: pageNum, blob, text });
      setProgress({ current: pageNum, total });
    }

    setPhase("upload");
    setProgress({ current: 0, total });
    const uploaded = new Array(rendered.length);
    let done = 0;
    let cursor = 0;
    async function worker() {
      while (cursor < rendered.length) {
        const index = cursor;
        cursor += 1;
        const item = rendered[index];
        const filename = `${baseName}-p${item.page}.png`;
        const { uploadUrl, s3key } = await requestMaterialUploadUrl({ courseId, filename, contentType: "image/png" });
        await uploadMaterialFile(uploadUrl, item.blob);
        const material = await createMaterialAwaitingApi({
          ...EMPTY_MATERIAL_FORM,
          courseId,
          lessonId: "",
          type: "image",
          title: `${baseName} p.${item.page}`,
          status: "published",
          s3key,
          originalFilename: filename,
          contentType: "image/png",
          fileSize: item.blob.size,
          uploadMode: "view",
        });
        uploaded[index] = { page: item.page, materialId: material.id, text: item.text };
        done += 1;
        setProgress({ current: done, total });
      }
    }
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, rendered.length) }, worker));
    return uploaded.filter(Boolean);
  }

  async function handleImport() {
    if (!file || blocking) return;
    setErrorMsg("");
    setPhase("render");
    let course = null;
    try {
      // 受け皿のコースを先に作る。教材はコースにぶら下がるため、順序を逆にできない。
      // タイトル・説明はサーバー側がAIの結果で上書きする。
      course = await createCourseAwaitingApi({
        ...EMPTY_COURSE_FORM,
        title: courseHint.trim() || file.name.replace(/\.pdf$/i, ""),
        desc: "",
        published: false,
        official: Boolean(official && canMarkOfficial),
      });
      setCreatedCourse(course);

      const pages = await renderAndUpload(course.id, file);
      if (!pages.length) throw new Error("ページを1枚も取り込めませんでした。");

      // パワポが添えられていれば、発表者ノートをページ番号で突き合わせる。
      // **PDFのページ順とスライド順が同じ前提**（PDFはこのパワポの書き出し）。
      let notesByPage = new Map();
      if (pptxFile) {
        try {
          notesByPage = await extractPptxNotesByPage(pptxFile);
          setNotesCount(notesByPage.size);
        } catch (e) {
          // ノートが読めなくても、スライドからのコース生成は続ける
          console.warn("pptx notes failed", e);
          setNotesCount(0);
        }
      }

      // ここから先はサーバー側で走る。**この画面を閉じてよい。**
      const started = await apiPost("/learning/admin/pdf-import/start", {
        courseId: course.id,
        pages: pages.map(p => ({ page: p.page, materialId: p.materialId, text: p.text, notes: notesByPage.get(p.page) || "" })),
        filename: file.name,
        courseHint: courseHint.trim(),
        note: note.trim(),
        exerciseCount,
      });
      setImportId(started.importId);
      setImportState({ status: "queued", lessonsTotal: 0, lessonsDone: 0 });
      setPhase("running");
    } catch (e) {
      setErrorMsg(
        (e?.message || "取り込みに失敗しました。") +
        (course ? "\n途中まで作成されたコースは残っています。コース管理から続きを編集するか、不要なら削除してください。" : "")
      );
      setPhase("error");
    }
  }

  const st = importState || {};
  const serverStarted = ["running", "done"].includes(phase);
  const stepDone = {
    render: ["upload", "running", "done"].includes(phase),
    upload: serverStarted,
    plan: serverStarted && ["generating", "done"].includes(st.status),
    lessons: phase === "done",
  };

  return (
    <AdminModal
      open={open}
      title="資料からコースを作る"
      desc="既存の研修資料（PDF）を、ページ・解説・演習つきのEラーニングコースに変換します。パワポを添えると、発表者ノートを説明に使います。"
      onClose={handleClose}
      width={640}
    >
      <div className="space-y-4">
        {phase === "idle" || (phase === "error" && !importId) ? (
          <>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type === "application/pdf") { setFile(f); setErrorMsg(""); } }}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl px-4 py-7 text-center"
              style={{ border: `1.5px dashed ${C.line}`, background: C.canvas }}
            >
              {file ? (
                <>
                  <FileUp size={20} style={{ color: T.accent }} />
                  <span className="text-sm font-bold" style={{ color: C.ink }}>{file.name}</span>
                  <span className="text-[11px]" style={{ color: C.muted }}>クリックで選び直す</span>
                </>
              ) : (
                <>
                  <Upload size={20} style={{ color: C.muted }} />
                  <span className="text-sm font-semibold" style={{ color: C.ink }}>PDFをドラッグ＆ドロップ</span>
                  <span className="text-[11px]" style={{ color: C.muted }}>クリックして選ぶこともできます ・ {MAX_PAGES}ページまで</span>
                </>
              )}
              <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={e => { setFile(e.target.files?.[0] || null); setErrorMsg(""); e.target.value = ""; }} />
            </div>

            <Field label="パワポ（任意・発表者ノートを説明に使います）">
              <div className="flex flex-wrap items-center gap-2">
                <input type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={e => { setPptxFile(e.target.files?.[0] || null); setNotesCount(null); }} className="text-xs" />
                {pptxFile && <span className="text-[11px]" style={{ color: C.muted }}>{pptxFile.name}</span>}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed" style={{ color: C.muted }}>
                同じ資料のPDFとパワポを両方入れると、<b>スライドは見た目、発表者ノートは説明</b>として分けて使います。
                ページの並びはPDFと同じ前提です（PDFはこのパワポの書き出し）。
              </div>
            </Field>

            <Field label="コース名（任意・空ならAIが資料から決めます）">
              <input style={fieldStyle} value={courseHint} onChange={e => setCourseHint(e.target.value)} placeholder="例: IT基礎" />
            </Field>
            <Field label="AIへの補足（任意）">
              <input style={fieldStyle} value={note} onChange={e => setNote(e.target.value)} placeholder="例: 新卒向け。Lesson単位は資料の章立てに合わせて" />
            </Field>
            <Field label="レッスンごとの演習数">
              <select style={fieldStyle} value={exerciseCount} onChange={e => setExerciseCount(Number(e.target.value))}>
                <option value={0}>入れない</option>
                <option value={2}>2問</option>
                <option value={3}>3問（おすすめ）</option>
                <option value={5}>5問</option>
              </select>
            </Field>
            {canMarkOfficial && (
              <label className="flex items-start gap-2 rounded-xl p-3 text-sm font-semibold" style={{ background: T.accentSubtle, color: C.ink }}>
                <input type="checkbox" className="mt-0.5" checked={official} onChange={e => setOfficial(e.target.checked)} />
                <span>
                  <span className="inline-flex items-center gap-1.5"><BadgeCheck size={14} style={{ color: T.accent }} />Feeps公式コースとして登録する</span>
                  <span className="mt-0.5 block text-[11px] font-normal" style={{ color: C.muted }}>受講者のコース一覧で「Feeps公式」として表示されます。</span>
                </span>
              </label>
            )}
            <p className="rounded-xl p-3 text-[11px] leading-relaxed" style={{ background: C.canvas, color: C.muted }}>
              資料のページはそのままスライドとして残り、その下にAIが書いた解説が付きます。レッスンの最後には演習とまとめが入ります。
              <b style={{ color: C.body }}>ページの読み込みが終わるまで（72ページで2〜3分）はこの画面を開いたままにしてください。</b>
              そのあとの生成はサーバー側で進むので、閉じても大丈夫です。
            </p>
          </>
        ) : (
          <div className="space-y-3 rounded-2xl p-4" style={{ background: C.canvas }}>
            <StepRow done={stepDone.render} active={phase === "render"} label="ページを画像にしています（この画面を開いたまま）"
              detail={phase === "render" ? `${progress.current} / ${progress.total}ページ` : stepDone.render ? `${progress.total}ページ` : ""} />
            <StepRow done={stepDone.upload} active={phase === "upload"} label="ページを保存しています（この画面を開いたまま）"
              detail={phase === "upload" ? `${progress.current} / ${progress.total}ページ` : ""} />
            <StepRow done={stepDone.plan} active={serverStarted && ["queued", "planning"].includes(st.status)} label="AIが資料を読んでレッスンに分けています"
              detail={st.lessonsTotal ? `${st.lessonsTotal}レッスンに分割しました` : "1〜3分ほどかかります"} />
            <StepRow done={stepDone.lessons} active={st.status === "generating"} label="レッスンごとに解説と演習を作っています"
              detail={st.lessonsTotal ? `${st.lessonsDone} / ${st.lessonsTotal}レッスン` : ""} />
          </div>
        )}

        {phase === "running" && (
          <div className="flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed" style={{ background: T.accentSubtle, color: T.accentHover }}>
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
            <span>
              <b>ここから先はサーバー側で進みます。この画面を閉じても大丈夫です。</b>
              できあがるとコース管理の一覧に反映されます（数分かかります）。
            </span>
          </div>
        )}

        {phase === "done" && (
          <div className="flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed" style={{ background: T.successSubtle, color: T.success }}>
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
            <span>
              「{st.courseTitle || createdCourse?.title}」を作成しました（{st.lessonsTotal || 0}レッスン）。
              <b>下書きのままなので、内容を確認してから公開してください。</b>
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2 whitespace-pre-line rounded-xl p-3 text-xs leading-relaxed" style={{ background: T.warningSubtle, color: T.warning }}>
            <AlertCircle size={15} className="mt-0.5 shrink-0" />{errorMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {phase === "done" ? (
            <Btn icon={CheckCircle2} onClick={() => { const c = createdCourse; handleClose(); if (c && onCreated) onCreated(c); }}>コースを開く</Btn>
          ) : (
            <>
              <Btn kind="ghost" icon={X} onClick={handleClose} disabled={blocking}>
                {blocking ? "ページの読み込み中は閉じられません" : phase === "running" ? "閉じる（作成は続きます）" : "キャンセル"}
              </Btn>
              {phase !== "running" && (
                <Btn kind="ai" icon={blocking ? Loader2 : Sparkles} onClick={handleImport} disabled={!file || blocking}>
                  {blocking ? "取り込み中…" : "取り込みを始める"}
                </Btn>
              )}
            </>
          )}
        </div>
      </div>
    </AdminModal>
  );
}
