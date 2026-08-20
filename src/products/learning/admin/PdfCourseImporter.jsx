import React, { useRef, useState } from "react";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { AlertCircle, BadgeCheck, CheckCircle2, FileUp, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Btn, Field, fieldStyle, T } from "../../../components/common";
import AdminModal from "./AdminModal.jsx";
import { requestMaterialUploadUrl, uploadMaterialFile } from "./useLearningAdmin.js";
import { EMPTY_COURSE_FORM, EMPTY_LESSON_FORM, EMPTY_MATERIAL_FORM } from "./LearningAdminCatalog.js";
import { runAiJob } from "./aiJobPolling.js";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

// 2026-08-21: 自社に既にある研修PDFから、今のEラーニングと同じ形（ページ＋解説＋演習）を起こす。
//
// **テキスト抽出だけでは足りない。** 実物のIT基礎PDF(72ページ)は本文が4,772文字しかなく
// (平均66文字/ページ、10ページは1文字も取れない)、情報の大半が図の中にある。
// そこで各ページを画像にしてS3へ上げ、Claudeに読ませる。
//
// 既存の SlideDeckImporter と同じ経路(署名URL→S3→教材→imageスライド)を使い、
// 新しい保存の仕組みは作らない。違いは「レッスン単位」ではなく「コース単位」であることと、
// AIがレッスン分割・解説・演習を作るところ。
//
// 手順:
//   1. ページをPNG化 + テキスト抽出（ブラウザ内、pdf.js）
//   2. 受け皿のコースを1つ作り、ページ画像をその教材としてアップロード
//   3. ジョブ「plan」: 全ページの要点 → レッスン分割
//   4. レッスンごとにジョブ「lesson-slides」: ページの解説 + 演習 + まとめ
// 3と4を分けているのは、1本にまとめると72ページでワーカーの300秒を超えるため。
const PAGE_SCALE = 1.6;          // 1024px前後。読ませるのに十分で、アップロードが重くなりすぎない
const UPLOAD_CONCURRENCY = 3;
const MAX_PAGES = 120;

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("PNG変換に失敗しました。"))), "image/png");
  });
}

let slideSeq = 0;
function nextSlideId(prefix = "slide-pdfc") {
  slideSeq += 1;
  return `${prefix}-${Date.now()}-${slideSeq}`;
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
  createCourseAwaitingApi, createLessonAwaitingApi, updateLessonAwaitingApi, updateCourse, createMaterialAwaitingApi,
}) {
  const [file, setFile] = useState(null);
  const [courseHint, setCourseHint] = useState("");
  const [note, setNote] = useState("");
  const [official, setOfficial] = useState(Boolean(canMarkOfficial));
  const [exerciseCount, setExerciseCount] = useState(3);
  const [phase, setPhase] = useState("idle"); // idle | render | upload | plan | lessons | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [planned, setPlanned] = useState(null);
  const [lessonProgress, setLessonProgress] = useState({ current: 0, total: 0, title: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const [createdCourse, setCreatedCourse] = useState(null);
  const inputRef = useRef(null);
  const busy = !["idle", "done", "error"].includes(phase);

  function handleClose() {
    if (busy) return;
    setFile(null); setCourseHint(""); setNote(""); setPhase("idle"); setErrorMsg("");
    setProgress({ current: 0, total: 0 }); setPlanned(null); setCreatedCourse(null);
    setLessonProgress({ current: 0, total: 0, title: "" });
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

  // AIの結果を、受講画面がそのまま描けるスライド配列へ組み立てる。
  // ページ画像は content.materialId で持つ（署名URLは期限付きなので保存しない）。
  function buildSlides(result, pageByNumber) {
    const slides = [];
    (result.pageSlides || []).forEach(p => {
      const source = pageByNumber.get(p.sourcePage);
      if (!source) return;
      slides.push({
        id: nextSlideId(),
        kind: "image",
        title: p.title || `p.${p.sourcePage}`,
        navLabel: p.navLabel || "",
        caption: p.caption || "",
        content: { materialId: source.materialId, alt: p.title || "", caption: p.caption || "" },
        status: "published",
      });
    });
    (result.exercises || []).forEach(e => {
      slides.push({
        id: nextSlideId("slide-pdfex"),
        kind: e.kind,
        title: e.title || "演習",
        navLabel: e.navLabel || "演習",
        caption: e.caption || "",
        content: e.content || {},
        interaction: e.interaction || {},
        status: "published",
      });
    });
    if (result.summary) {
      slides.push({
        id: nextSlideId("slide-pdfsum"),
        kind: "summary",
        title: result.summary.title || "まとめ",
        navLabel: result.summary.navLabel || "まとめ",
        caption: "",
        content: { points: result.summary.points || [] },
        status: "published",
      });
    }
    return slides.map((s, i) => ({ ...s, order: i, updatedAt: new Date().toISOString() }));
  }

  async function handleImport() {
    if (!file || busy) return;
    setErrorMsg("");
    setPhase("render");
    let course = null;
    try {
      // 受け皿のコースを先に作る。教材はコースにぶら下がるため、順序を逆にできない。
      // タイトルはAIの結果が出たあとで上書きする。
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
      const pageByNumber = new Map(pages.map(p => [p.page, p]));

      setPhase("plan");
      const plan = await runAiJob("/learning/admin/pdf-import/plan", {
        pages: pages.map(p => ({ page: p.page, materialId: p.materialId, text: p.text })),
        filename: file.name,
        courseHint: courseHint.trim(),
        note: note.trim(),
      });
      setPlanned(plan);

      updateCourse(course.id, {
        ...EMPTY_COURSE_FORM,
        title: plan.course?.title || course.title,
        desc: plan.course?.desc || "",
        level: plan.course?.level || "入門",
        duration: plan.course?.estimatedMinutes ? String(Math.max(1, Math.round(plan.course.estimatedMinutes / 60))) : "",
        published: false,
        official: Boolean(official && canMarkOfficial),
      });

      setPhase("lessons");
      const lessons = plan.lessons || [];
      for (let i = 0; i < lessons.length; i += 1) {
        const l = lessons[i];
        setLessonProgress({ current: i + 1, total: lessons.length, title: l.title });
        const savedLesson = await createLessonAwaitingApi(course.id, {
          ...EMPTY_LESSON_FORM,
          title: l.title,
          type: "text",
          summary: l.summary || "",
          goal: l.goal || "",
          published: true,
        });
        const lessonPages = l.pages.map(n => pageByNumber.get(n)).filter(Boolean);
        if (!lessonPages.length) continue;
        const generated = await runAiJob("/learning/admin/pdf-import/lesson-slides", {
          pages: lessonPages.map(p => ({ page: p.page, materialId: p.materialId, text: p.text })),
          courseTitle: plan.course?.title || course.title,
          lessonTitle: l.title,
          lessonGoal: l.goal || "",
          exerciseCount,
        });
        await updateLessonAwaitingApi(course.id, savedLesson.id, {
          ...EMPTY_LESSON_FORM,
          title: l.title,
          type: "text",
          summary: l.summary || "",
          goal: l.goal || "",
          published: true,
          slides: buildSlides(generated, pageByNumber),
        });
      }

      setPhase("done");
    } catch (e) {
      setErrorMsg(
        (e?.message || "取り込みに失敗しました。") +
        (course ? "\n途中まで作成されたコースは残っています。コース管理から続きを編集するか、不要なら削除してください。" : "")
      );
      setPhase("error");
    }
  }

  const stepDone = {
    render: ["upload", "plan", "lessons", "done"].includes(phase),
    upload: ["plan", "lessons", "done"].includes(phase),
    plan: ["lessons", "done"].includes(phase),
    lessons: phase === "done",
  };

  return (
    <AdminModal
      open={open}
      title="PDFからコースを作る"
      desc="既存の研修資料（PDF）を、ページ・解説・演習つきのEラーニングコースに変換します。"
      onClose={handleClose}
      width={640}
    >
      <div className="space-y-4">
        {phase === "idle" || phase === "error" ? (
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
              72ページで5〜8分ほどかかります。<b style={{ color: C.body }}>この画面を閉じずにお待ちください。</b>
            </p>
          </>
        ) : (
          <div className="space-y-3 rounded-2xl p-4" style={{ background: C.canvas }}>
            <StepRow done={stepDone.render} active={phase === "render"} label="ページを画像にしています"
              detail={phase === "render" ? `${progress.current} / ${progress.total}ページ` : stepDone.render ? `${progress.total}ページ` : ""} />
            <StepRow done={stepDone.upload} active={phase === "upload"} label="ページを保存しています"
              detail={phase === "upload" ? `${progress.current} / ${progress.total}ページ` : ""} />
            <StepRow done={stepDone.plan} active={phase === "plan"} label="AIが資料を読んでレッスンに分けています"
              detail={planned ? `${planned.lessons?.length || 0}レッスンに分割しました` : "1〜3分ほどかかります"} />
            <StepRow done={stepDone.lessons} active={phase === "lessons"} label="レッスンごとに解説と演習を作っています"
              detail={lessonProgress.total ? `${lessonProgress.current} / ${lessonProgress.total}：${lessonProgress.title}` : ""} />
          </div>
        )}

        {phase === "done" && (
          <div className="flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed" style={{ background: T.successSubtle, color: T.success }}>
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
            <span>
              「{planned?.course?.title || createdCourse?.title}」を作成しました（{planned?.lessons?.length || 0}レッスン）。
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
              <Btn kind="ghost" icon={X} onClick={handleClose} disabled={busy}>{busy ? "処理中は閉じられません" : "キャンセル"}</Btn>
              <Btn kind="ai" icon={busy ? Loader2 : Sparkles} onClick={handleImport} disabled={!file || busy}>
                {busy ? "取り込み中…" : "取り込みを始める"}
              </Btn>
            </>
          )}
        </div>
      </div>
    </AdminModal>
  );
}
