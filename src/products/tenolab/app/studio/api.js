/* 教材づくり（チャットで作る）が使うAPI。コースまわりは既存の /learning/admin/* をそのまま使う。 */
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../../api.js";

const PAGE_SCALE = 1.6;
const UPLOAD_CONCURRENCY = 3;
export const MAX_PAGES = 120;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// PDFのページを画像にする（プレビュー用の URL と、上げる用の Blob と、ページの文字）
export async function renderPdf(file, onProgress) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const total = Math.min(pdf.numPages, MAX_PAGES);
  const pages = [];
  for (let n = 1; n <= total; n += 1) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: PAGE_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const blob = await new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("画像にできませんでした。"))), "image/png"));
    const tc = await page.getTextContent();
    pages.push({ page: n, blob, url: URL.createObjectURL(blob), text: tc.items.map(i => i.str).join("").replace(/\s+/g, " ").trim() });
    onProgress?.(n, total);
  }
  return { pages, numPages: pdf.numPages };
}

export async function createDraftCourse(title) {
  const res = await apiPost("/learning/admin/courses", {
    title, category: "プログラミング", level: "入門", duration: "", desc: "", skills: [], color: "#16A34A", lessons: 0,
    status: "draft", published: false, deleted: false, visibilityScope: "all", targetCompanyIds: [], official: false,
    finalTestEnabled: true, topic: "", thumb: null, premiumOwn: false,
  });
  return res.course;
}

// ページ画像を上げて、教材にする（3本ずつ並べて）
export async function uploadPages(courseId, baseName, pages, onProgress) {
  const out = new Array(pages.length);
  let cursor = 0, done = 0;
  async function worker() {
    while (cursor < pages.length) {
      const i = cursor++;
      const p = pages[i];
      const filename = `${baseName}-p${p.page}.png`;
      const { uploadUrl, s3key } = await apiPost("/learning/admin/materials/upload-url", { courseId, filename, contentType: "image/png" });
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: p.blob });
      if (!put.ok) throw new Error("ページ画像を上げられませんでした。");
      const res = await apiPost("/learning/admin/materials", {
        courseId, lessonId: "", type: "image", title: `${baseName} p.${p.page}`, description: "", url: "", duration: 0, order: 0, tags: [],
        status: "published", memo: "", deleted: false, s3key, originalFilename: filename, contentType: "image/png", fileSize: p.blob.size, uploadMode: "view",
      });
      out[i] = { page: p.page, materialId: res.material.id };
      done += 1;
      onProgress?.(done, pages.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, pages.length) }, worker));
  return out;
}

export const startImport = body => apiPost("/learning/admin/pdf-import/start", body);
export const getImport = id => apiGet(`/learning/admin/pdf-import/${encodeURIComponent(id)}`);
export const replan = (id, body) => apiPost(`/learning/admin/pdf-import/${encodeURIComponent(id)}/replan`, body);
export const continueImport = (id, body) => apiPost(`/learning/admin/pdf-import/${encodeURIComponent(id)}/continue`, body);

// 取り込みが want のどれかになるまで待つ
export async function waitImport(id, want, onTick, timeoutMs = 15 * 60 * 1000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const st = await getImport(id).catch(() => null);
    if (st) {
      onTick?.(st);
      if (st.status === "error") { const e = new Error(st.error || "取り込みに失敗しました。"); e.errorMessage = e.message; throw e; }
      if (want.includes(st.status)) return st;
    }
    await sleep(4000);
  }
  throw new Error("時間がかかっています。少し待ってから開き直してください。");
}

export const listCourses = () => apiGet("/learning/admin/courses");
export const getLessons = courseId => apiGet(`/learning/admin/courses/${encodeURIComponent(courseId)}/lessons`);
export const publishCourse = courseId => apiPost(`/learning/admin/courses/${encodeURIComponent(courseId)}/publish`, {});
export const saveCourse = course => apiPut(`/learning/admin/courses/${encodeURIComponent(course.id)}`, {
  id: course.id, courseId: course.id, title: course.title, category: course.category, level: course.level, duration: course.duration,
  desc: course.desc, skills: course.skills || [], color: course.color, lessons: Number(course.lessons || 0),
  status: course.published ? "published" : "draft", published: !!course.published, deleted: false,
  visibilityScope: course.visibilityScope === "companies" ? "companies" : "all", targetCompanyIds: course.targetCompanyIds || [],
  official: course.official === true, finalTestEnabled: course.finalTestEnabled !== false, topic: course.topic || "", thumb: course.thumb || null, premiumOwn: course.premiumOwn === true,
});
export const saveLesson = (courseId, l) => apiPut(`/learning/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(l.id)}`, {
  id: l.id, lessonId: l.id, title: l.title, type: l.type, summary: l.summary, duration: l.duration, order: Number(l.order || 0),
  status: l.published === false ? "draft" : "published", published: l.published !== false, deleted: false,
  points: l.points || [], body: l.body || "", questions: l.questions || [], goal: l.goal || "", teacherMemo: l.teacherMemo || "", slides: l.slides || [],
});
export const finalQuestions = () => apiGet("/learning/admin/quiz-questions");
export const viewUrl = materialId => apiGet(`/learning/materials/view?materialId=${encodeURIComponent(materialId)}`);

// AIの生成（非同期ジョブ）。202 { jobId } を受けて、終わるまで待つ
export async function runJob(path, body, timeoutMs = 330000) {
  const started = await apiPost(path, body);
  if (!started?.jobId) return started;
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    await sleep(2500);
    const job = await apiGet(`/learning/admin/ai-jobs/${encodeURIComponent(started.jobId)}`);
    if (job?.status === "done") return job.result || {};
    if (job?.status === "error") { const e = new Error(job.error || "AIが作れませんでした。"); e.errorMessage = e.message; throw e; }
  }
  throw new Error("AIの生成が時間内に終わりませんでした。もう一度お試しください。");
}
export const studioJob = body => runJob("/tenolab/studio/jobs", body);
export const finalTestJob = body => runJob("/learning/admin/ai-lesson-designer/final-test/generate", body);
export const saveQuestion = q => apiPost("/learning/admin/quiz-questions", q);

// 作ったあとのレッスンの組み替え（スライドは作り直さない）
export const restructure = body => apiPost("/tenolab/studio/restructure", body);
export const createLesson = (courseId, l) => apiPost(`/learning/admin/courses/${encodeURIComponent(courseId)}/lessons`, {
  title: l.title, type: l.type || "text", summary: l.summary || "", duration: l.duration || "", order: Number(l.order || 0),
  status: "published", published: true, deleted: false, points: [], body: "", questions: [], goal: l.goal || "", teacherMemo: "", slides: l.slides || [],
});
export const deleteLesson = (courseId, lessonId) => apiDelete(`/learning/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`);
