import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import {
  DEFAULT_FINAL_TEST_SETTINGS,
  EMPTY_COURSE_FORM,
  EMPTY_LESSON_FORM,
  EMPTY_MATERIAL_FORM,
  EMPTY_QUIZ_FORM,
  EMPTY_REVIEW_FORM,
  LEARNING_ADMIN_ENROLLMENTS_STORAGE_KEY,
  LEARNING_ADMIN_LESSONS_STORAGE_KEY,
  LEARNING_ADMIN_MATERIALS_STORAGE_KEY,
  LEARNING_ADMIN_QUIZZES_STORAGE_KEY,
  LEARNING_FINAL_TEST_SETTINGS_STORAGE_KEY,
  LEARNING_LESSON_REVIEW_STORAGE_KEY,
  LEARNING_ADMIN_DELETED_COURSES_STORAGE_KEY,
  LEARNING_ADMIN_STORAGE_KEY,
} from "./LearningAdminCatalog.js";

function normalizeCourse(course) {
  return {
    id: course.id || course.courseId,
    title: course.title || "",
    category: course.category || "プログラミング",
    color: course.color || "#14A3B8",
    skills: Array.isArray(course.skills) ? course.skills : [],
    lessons: Number(course.lessons || 0),
    duration: String(course.duration || ""),
    level: course.level || "入門",
    desc: course.desc || "",
    published: course.status ? course.status === "published" : course.published !== false,
    deleted: course.deleted === true || course.status === "deleted",
    // 版固定公開(フェーズ③): 0/未設定は「まだ一度も新しい公開フローを通っていない」を意味する。
    publishedVersion: Number(course.publishedVersion || 0) || 0,
    updatedAt: course.updatedAt || null,
  };
}

// Backend APIを正本とする。localStorageはAPI応答が届くまでの一時キャッシュとしてのみ使う
// （キャッシュが無ければ空配列を返し、API失敗時にモックへフォールバックすることはない）。
function readCourses() {
  try {
    const raw = window.localStorage.getItem(LEARNING_ADMIN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCourse);
  } catch (e) {
    return [];
  }
}

function saveCourses(courses) {
  try {
    window.localStorage.setItem(LEARNING_ADMIN_STORAGE_KEY, JSON.stringify(courses));
  } catch (e) {
    // localStorage が使えない環境では画面内 state のみで維持する。
  }
}

function readDeletedCourseIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEARNING_ADMIN_DELETED_COURSES_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveDeletedCourseIds(courseIds) {
  try {
    window.localStorage.setItem(LEARNING_ADMIN_DELETED_COURSES_STORAGE_KEY, JSON.stringify([...new Set(courseIds)]));
  } catch (e) {
    // localStorage unavailable: keep in-memory course state only.
  }
}

function makeId() {
  if (window.crypto?.randomUUID) return `el-admin-${window.crypto.randomUUID()}`;
  return `el-admin-${Date.now()}`;
}

function toCoursePayload(form) {
  return {
    title: form.title.trim(),
    category: form.category,
    color: form.color,
    skills: form.skillsText.split(",").map(s => s.trim()).filter(Boolean),
    lessons: Number(form.lessons || 0),
    duration: String(form.duration || ""),
    level: form.level,
    desc: form.desc.trim(),
    published: Boolean(form.published),
    updatedAt: new Date().toISOString(),
  };
}

function toCourseApiPayload(course) {
  return {
    id: course.id,
    courseId: course.id,
    title: course.title,
    category: course.category,
    level: course.level,
    duration: course.duration,
    desc: course.desc,
    skills: course.skills || [],
    color: course.color,
    lessons: Number(course.lessons || 0),
    status: course.published === false ? "draft" : "published",
    published: course.published !== false,
    deleted: course.deleted === true,
  };
}

export function courseToForm(course) {
  if (!course) return { ...EMPTY_COURSE_FORM };
  return {
    title: course.title || "",
    category: course.category || "プログラミング",
    level: course.level || "入門",
    duration: String(course.duration || ""),
    desc: course.desc || "",
    skillsText: (course.skills || []).join(", "),
    color: course.color || "#14A3B8",
    published: course.published !== false,
    lessons: Number(course.lessons || 0),
  };
}

function normalizeQuestion(question, index = 0) {
  return {
    id: question.id || `q${index + 1}`,
    q: question.q || "",
    options: Array.isArray(question.options) && question.options.length ? question.options : ["", "", "", ""],
    answer: Number.isFinite(Number(question.answer)) ? Number(question.answer) : 0,
  };
}

function normalizeLesson(lesson, index = 0) {
  return {
    id: lesson.id || lesson.lessonId,
    title: lesson.title || "",
    type: lesson.type || "video",
    duration: lesson.duration || "10分",
    summary: lesson.summary || "",
    points: Array.isArray(lesson.points) ? lesson.points : [],
    body: lesson.body || "",
    questions: Array.isArray(lesson.questions) ? lesson.questions.map(normalizeQuestion) : [],
    slides: Array.isArray(lesson.slides) ? lesson.slides : [],
    goal: lesson.goal || "",
    teacherMemo: lesson.teacherMemo || "",
    published: lesson.status ? lesson.status === "published" : lesson.published !== false,
    deleted: lesson.deleted === true || lesson.status === "deleted",
    order: Number.isFinite(Number(lesson.order)) ? Number(lesson.order) : index,
    updatedAt: lesson.updatedAt || null,
  };
}

function readLessons() {
  try {
    const raw = window.localStorage.getItem(LEARNING_ADMIN_LESSONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([courseId, lessons]) => [
        courseId,
        Array.isArray(lessons) ? lessons.map(normalizeLesson).sort((a, b) => a.order - b.order) : [],
      ])
    );
  } catch (e) {
    return {};
  }
}

function saveLessons(lessonsByCourse) {
  try {
    window.localStorage.setItem(LEARNING_ADMIN_LESSONS_STORAGE_KEY, JSON.stringify(lessonsByCourse));
  } catch (e) {
    // localStorage が使えない環境では画面内 state のみで維持する。
  }
}

function parseQuestions(text) {
  return String(text || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("|").map(part => part.trim());
      const answerRaw = Number(parts[5]);
      return normalizeQuestion({
        id: `q${index + 1}`,
        q: parts[0] || "",
        options: [parts[1] || "", parts[2] || "", parts[3] || "", parts[4] || ""],
        answer: Number.isFinite(answerRaw) ? Math.max(0, Math.min(3, answerRaw - 1)) : 0,
      }, index);
    });
}

function toLessonPayload(form) {
  return {
    title: form.title.trim(),
    type: form.type || "video",
    duration: form.duration || "10分",
    summary: form.summary.trim(),
    points: String(form.pointsText || "").split("\n").map(s => s.trim()).filter(Boolean),
    body: form.body || "",
    questions: parseQuestions(form.questionsText),
    slides: Array.isArray(form.slides) ? form.slides : [],
    goal: form.goal || "",
    teacherMemo: form.teacherMemo || "",
    published: Boolean(form.published),
    updatedAt: new Date().toISOString(),
  };
}

function toLessonApiPayload(lesson) {
  return {
    id: lesson.id,
    lessonId: lesson.id,
    title: lesson.title,
    type: lesson.type,
    summary: lesson.summary,
    duration: lesson.duration,
    order: Number(lesson.order || 0),
    status: lesson.published === false ? "draft" : "published",
    published: lesson.published !== false,
    deleted: lesson.deleted === true,
    points: lesson.points || [],
    body: lesson.body || "",
    questions: lesson.questions || [],
    goal: lesson.goal || "",
    teacherMemo: lesson.teacherMemo || "",
    slides: lesson.slides || [],
  };
}

export function lessonToForm(lesson) {
  if (!lesson) return { ...EMPTY_LESSON_FORM };
  return {
    title: lesson.title || "",
    type: lesson.type || "video",
    summary: lesson.summary || "",
    duration: lesson.duration || "10分",
    pointsText: (lesson.points || []).join("\n"),
    body: lesson.body || "",
    questionsText: (lesson.questions || []).map(q => [
      q.q || "",
      ...(q.options || ["", "", "", ""]).slice(0, 4),
      Number(q.answer || 0) + 1,
    ].join(" | ")).join("\n"),
    goal: lesson.goal || "",
    teacherMemo: lesson.teacherMemo || "",
    slides: Array.isArray(lesson.slides) ? lesson.slides : [],
    published: lesson.published !== false,
  };
}

function normalizeMaterial(material, index = 0) {
  const now = new Date().toISOString();
  return {
    id: material.id || material.materialId || `mat_${Date.now()}_${index}`,
    courseId: material.courseId || "",
    lessonId: material.lessonId || "",
    type: material.type || "pdf",
    title: material.title || "",
    description: material.description || "",
    url: material.url || "",
    duration: Number.isFinite(Number(material.duration)) ? Number(material.duration) : 0,
    order: Number.isFinite(Number(material.order)) ? Number(material.order) : index + 1,
    tags: Array.isArray(material.tags) ? material.tags : [],
    status: material.status === "published" ? "published" : "draft",
    memo: material.memo || "",
    deleted: material.deleted === true || material.status === "deleted",
    // s3key があればS3実ファイル教材、無ければ従来どおり url の外部リンク教材。
    s3key: material.s3key || "",
    originalFilename: material.originalFilename || "",
    contentType: material.contentType || "",
    fileSize: Number.isFinite(Number(material.fileSize)) ? Number(material.fileSize) : 0,
    uploadMode: material.uploadMode === "download" ? "download" : "view",
    uploadedAt: material.uploadedAt || null,
    uploadedBy: material.uploadedBy || null,
    createdAt: material.createdAt || now,
    updatedAt: material.updatedAt || now,
  };
}

function readMaterials() {
  try {
    const raw = window.localStorage.getItem(LEARNING_ADMIN_MATERIALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeMaterial).sort((a, b) => a.order - b.order);
  } catch (e) {
    return [];
  }
}

function saveMaterials(materials) {
  try {
    window.localStorage.setItem(LEARNING_ADMIN_MATERIALS_STORAGE_KEY, JSON.stringify(materials));
  } catch (e) {
    // localStorage が使えない環境では画面内 state のみで維持する。
  }
}

function toMaterialPayload(form) {
  return {
    courseId: form.courseId || "",
    lessonId: form.lessonId || "",
    type: form.type || "pdf",
    title: form.title.trim(),
    description: form.description.trim(),
    url: form.url.trim(),
    duration: Number(form.duration || 0),
    order: Number(form.order || 1),
    tags: String(form.tagsText || "").split(",").map(tag => tag.trim()).filter(Boolean),
    status: form.status === "published" ? "published" : "draft",
    memo: form.memo || "",
    // S3実ファイル教材の項目。既存のURL教材フォームにはこれらのキーが無いため、
    // その場合は空文字/0/"view"のデフォルトになるだけで挙動は変わらない。
    s3key: form.s3key || "",
    originalFilename: form.originalFilename || "",
    contentType: form.contentType || "",
    fileSize: Number(form.fileSize || 0),
    uploadMode: form.uploadMode === "download" ? "download" : "view",
    updatedAt: new Date().toISOString(),
  };
}

function toMaterialApiPayload(material) {
  return {
    id: material.id,
    materialId: material.id,
    courseId: material.courseId,
    lessonId: material.lessonId,
    type: material.type,
    title: material.title,
    description: material.description,
    url: material.url,
    duration: Number(material.duration || 0),
    order: Number(material.order || 0),
    tags: material.tags || [],
    status: material.status === "published" ? "published" : "draft",
    memo: material.memo || "",
    deleted: material.deleted === true,
    s3key: material.s3key || "",
    originalFilename: material.originalFilename || "",
    contentType: material.contentType || "",
    fileSize: Number(material.fileSize || 0),
    uploadMode: material.uploadMode === "download" ? "download" : "view",
  };
}

// POST /learning/admin/materials/upload-url を呼び、S3への署名付きPUT URLを取得する。
// フックの状態に依存しないため materialToForm と同様にモジュールレベルでexportする。
export async function requestMaterialUploadUrl({ courseId, filename, contentType }) {
  return apiPost("/learning/admin/materials/upload-url", { courseId, filename, contentType });
}

// 発行された署名付きURLへ実ファイルを直接PUTする。S3への直PUTのため認証ヘッダ・JSON化を
// 行う api.js の apiPut は使わず、素の fetch で実装する。
export async function uploadMaterialFile(uploadUrl, file) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
  return true;
}

export function materialToForm(material, fallback = {}) {
  if (!material) return { ...EMPTY_MATERIAL_FORM, ...fallback };
  return {
    courseId: material.courseId || fallback.courseId || "",
    lessonId: material.lessonId || fallback.lessonId || "",
    type: material.type || "pdf",
    title: material.title || "",
    description: material.description || "",
    url: material.url || "",
    duration: String(material.duration || ""),
    order: String(material.order || 1),
    tagsText: (material.tags || []).join(", "),
    status: material.status === "published" ? "published" : "draft",
    memo: material.memo || "",
    s3key: material.s3key || "",
    originalFilename: material.originalFilename || "",
    contentType: material.contentType || "",
    fileSize: String(material.fileSize || ""),
    uploadMode: material.uploadMode === "download" ? "download" : "view",
  };
}

function normalizeEnrollment(enrollment, index = 0, courseLookup = {}) {
  const course = courseLookup[enrollment.courseId] || {};
  const totalLessons = Number(enrollment.totalLessons || course.lessons || 0);
  const progress = Math.max(0, Math.min(100, Number(enrollment.progress || 0)));
  const completedLessons = Number.isFinite(Number(enrollment.completedLessons))
    ? Number(enrollment.completedLessons)
    : Math.round((progress / 100) * totalLessons);
  const status = enrollment.status === "completed"
    ? "completed"
    : enrollment.status === "not_started"
      ? "not_started"
      : "in_progress";
  return {
    id: enrollment.id || `enr_${Date.now()}_${index}`,
    traineeId: enrollment.traineeId || "",
    traineeName: enrollment.traineeName || "",
    companyName: enrollment.companyName || "",
    courseId: enrollment.courseId || "",
    courseTitle: enrollment.courseTitle || course.title || "",
    status,
    progress,
    completedLessons: Math.min(completedLessons, totalLessons),
    totalLessons,
    lastStudiedAt: enrollment.lastStudiedAt || "",
    completedAt: status === "completed" ? (enrollment.completedAt || enrollment.lastStudiedAt || "") : null,
    skills: Array.isArray(enrollment.skills) ? enrollment.skills : (course.skills || []),
    learningMinutes: Number(enrollment.learningMinutes || 0),
    recentHistory: Array.isArray(enrollment.recentHistory) ? enrollment.recentHistory : [],
    lessonCompletion: enrollment.lessonCompletion || {},
    memo: enrollment.memo || "",
  };
}

function readEnrollments() {
  try {
    const raw = window.localStorage.getItem(LEARNING_ADMIN_ENROLLMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, index) => normalizeEnrollment(item, index));
  } catch (e) {
    return [];
  }
}

function saveEnrollments(enrollments) {
  try {
    window.localStorage.setItem(LEARNING_ADMIN_ENROLLMENTS_STORAGE_KEY, JSON.stringify(enrollments));
  } catch (e) {
    // localStorage が使えない環境では画面内 state のみで維持する。
  }
}

function normalizeQuizQuestion(item, index = 0) {
  const now = new Date().toISOString();
  return {
    id: item.id || `quiz_${Date.now()}_${index}`,
    courseId: item.courseId || "",
    lessonId: item.lessonId || "",
    type: item.type || "lesson",
    question: item.question || "",
    choices: Array.isArray(item.choices) && item.choices.length ? item.choices.slice(0, 4) : ["", "", "", ""],
    answer: Number.isFinite(Number(item.answer)) ? Number(item.answer) : 0,
    explanation: item.explanation || "",
    difficulty: item.difficulty || "標準",
    tags: Array.isArray(item.tags) ? item.tags : [],
    skill: item.skill || "",
    pageId: item.pageId || "",
    chapterId: item.chapterId || "",
    points: Number.isFinite(Number(item.points)) ? Number(item.points) : 10,
    published: item.published === true,
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
}

// quizQuestions: Backend API (/learning/admin/quiz-questions) を正本とする。
// localStorageはAPI応答が届くまでの一時キャッシュとしてのみ使う（Phase7-2 P1でAPI化）。
function readQuizQuestions() {
  try {
    const raw = window.localStorage.getItem(LEARNING_ADMIN_QUIZZES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeQuizQuestion);
  } catch (e) {
    return [];
  }
}

function saveQuizQuestions(items) {
  try {
    window.localStorage.setItem(LEARNING_ADMIN_QUIZZES_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    // localStorage が使えない環境では画面内 state のみで維持する。
  }
}

function toQuizPayload(form) {
  return {
    courseId: form.courseId || "",
    lessonId: form.lessonId || "",
    type: form.type || "lesson",
    question: form.question.trim(),
    choices: [form.choice1, form.choice2, form.choice3, form.choice4].map(choice => String(choice || "").trim()),
    answer: Math.max(0, Math.min(3, Number(form.answer || 1) - 1)),
    explanation: form.explanation.trim(),
    difficulty: form.difficulty || "標準",
    tags: String(form.tagsText || "").split(",").map(tag => tag.trim()).filter(Boolean),
    skill: form.skill.trim(),
    pageId: form.pageId.trim(),
    chapterId: form.chapterId.trim(),
    points: Number(form.points || 10),
    published: Boolean(form.published),
    updatedAt: new Date().toISOString(),
  };
}

function toQuizApiPayload(item) {
  return {
    quizId: item.id,
    courseId: item.courseId || "",
    lessonId: item.lessonId || "",
    type: item.type || "lesson",
    question: item.question || "",
    choices: item.choices || [],
    answer: Number(item.answer || 0),
    explanation: item.explanation || "",
    difficulty: item.difficulty || "標準",
    tags: item.tags || [],
    skill: item.skill || "",
    pageId: item.pageId || "",
    chapterId: item.chapterId || "",
    points: Number(item.points || 10),
    published: item.published === true,
    deleted: item.deleted === true,
  };
}

export function quizToForm(item, fallback = {}) {
  if (!item) return { ...EMPTY_QUIZ_FORM, ...fallback };
  const choices = item.choices || [];
  return {
    courseId: item.courseId || fallback.courseId || "",
    lessonId: item.lessonId || fallback.lessonId || "",
    type: item.type || "lesson",
    question: item.question || "",
    choice1: choices[0] || "",
    choice2: choices[1] || "",
    choice3: choices[2] || "",
    choice4: choices[3] || "",
    answer: String(Number(item.answer || 0) + 1),
    explanation: item.explanation || "",
    difficulty: item.difficulty || "標準",
    tagsText: (item.tags || []).join(", "),
    skill: item.skill || "",
    pageId: item.pageId || "",
    chapterId: item.chapterId || "",
    points: String(item.points || 10),
    published: item.published === true,
  };
}

function normalizeReviewFlag(item, index = 0) {
  return {
    id: item.id || `review_${Date.now()}_${index}`,
    lessonId: item.lessonId || "",
    pageId: item.pageId || "page-1",
    status: item.status || "understood",
    understood: item.understood === true,
    reviewLater: item.reviewLater === true,
    reviewed: item.reviewed === true,
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

// reviewFlags: Backend API (/learning/admin/review-flags) を正本とする。
// localStorageはAPI応答が届くまでの一時キャッシュとしてのみ使う（Phase7-2 P1でAPI化）。
function readReviewFlags() {
  try {
    const raw = window.localStorage.getItem(LEARNING_LESSON_REVIEW_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeReviewFlag);
  } catch (e) {
    return [];
  }
}

function saveReviewFlags(items) {
  try {
    window.localStorage.setItem(LEARNING_LESSON_REVIEW_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    // localStorage が使えない環境では画面内 state のみで維持する。
  }
}

function toReviewPayload(form) {
  return {
    lessonId: form.lessonId || "",
    pageId: form.pageId || "page-1",
    status: form.status || "understood",
    understood: form.understood === true,
    reviewLater: form.reviewLater === true,
    reviewed: form.reviewed === true,
    updatedAt: new Date().toISOString(),
  };
}

export function reviewToForm(item, fallback = {}) {
  if (!item) return { ...EMPTY_REVIEW_FORM, ...fallback };
  return {
    lessonId: item.lessonId || fallback.lessonId || "",
    pageId: item.pageId || "page-1",
    status: item.status || "understood",
    understood: item.understood === true,
    reviewLater: item.reviewLater === true,
    reviewed: item.reviewed === true,
  };
}

// finalTestSettings: Backend API (/learning/admin/final-test-settings) を正本とする。
// localStorageはAPI応答が届くまでの一時キャッシュとしてのみ使う（Phase7-2 P1でAPI化）。
function readFinalTestSettings() {
  try {
    const raw = window.localStorage.getItem(LEARNING_FINAL_TEST_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FINAL_TEST_SETTINGS };
    return { ...DEFAULT_FINAL_TEST_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_FINAL_TEST_SETTINGS };
  }
}

function saveFinalTestSettings(settings) {
  try {
    window.localStorage.setItem(LEARNING_FINAL_TEST_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    // localStorage が使えない環境では画面内 state のみで維持する。
  }
}

function apiErrorMessage(e, fallback) {
  if (e?.status === 403) return "この操作を行う権限がありません。";
  return e?.errorMessage || e?.message || fallback;
}

export function useLearningAdmin() {
  const [courses, setCourses] = useState(readCourses);
  const [lessonsByCourse, setLessonsByCourse] = useState(readLessons);
  const [materials, setMaterials] = useState(readMaterials);
  const [enrollments, setEnrollments] = useState(readEnrollments);
  const [quizQuestions, setQuizQuestions] = useState(readQuizQuestions);
  const [reviewFlags, setReviewFlags] = useState(readReviewFlags);
  const [finalTestSettings, setFinalTestSettings] = useState(readFinalTestSettings);

  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState("");
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState("");
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(true);
  const [enrollmentsError, setEnrollmentsError] = useState("");
  const [quizQuestionsLoading, setQuizQuestionsLoading] = useState(true);
  const [quizQuestionsError, setQuizQuestionsError] = useState("");
  const [reviewFlagsLoading, setReviewFlagsLoading] = useState(true);
  const [reviewFlagsError, setReviewFlagsError] = useState("");
  const [finalTestSettingsLoading, setFinalTestSettingsLoading] = useState(true);
  const [finalTestSettingsError, setFinalTestSettingsError] = useState("");
  // 作成/更新/削除など書き込み系操作の失敗を通知するための共通エラー。
  // 楽観的にローカル状態を更新した後、サーバー側が失敗した場合にユーザーへ知らせる。
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let alive = true;
    apiGet("/learning/admin/courses")
      .then(items => {
        if (!alive || !Array.isArray(items)) return;
        const normalized = items.map(normalizeCourse).filter(course => course.id && course.deleted !== true);
        setCourses(normalized);
        saveCourses(normalized);
        setCoursesError("");
      })
      .catch(e => { if (alive) setCoursesError(apiErrorMessage(e, "コース一覧の取得に失敗しました。")); })
      .finally(() => { if (alive) setCoursesLoading(false); });
    return () => { alive = false; };
  }, []);

  const courseIds = useMemo(() => courses.map(course => course.id).filter(Boolean).join("|"), [courses]);

  useEffect(() => {
    let alive = true;
    courses.forEach(course => {
      if (!course.id) return;
      apiGet(`/learning/admin/courses/${encodeURIComponent(course.id)}/lessons`)
        .then(items => {
          if (!alive || !Array.isArray(items)) return;
          const normalized = items.map(normalizeLesson).filter(lesson => lesson.id && lesson.deleted !== true).sort((a, b) => a.order - b.order);
          setLessonsByCourse(prev => {
            const next = { ...prev, [course.id]: normalized };
            saveLessons(next);
            return next;
          });
        })
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [courseIds]);

  useEffect(() => {
    let alive = true;
    apiGet("/learning/admin/materials")
      .then(items => {
        if (!alive || !Array.isArray(items)) return;
        const normalized = items.map(normalizeMaterial).filter(material => material.id && material.deleted !== true);
        setMaterials(normalized);
        saveMaterials(normalized);
        setMaterialsError("");
      })
      .catch(e => { if (alive) setMaterialsError(apiErrorMessage(e, "教材一覧の取得に失敗しました。")); })
      .finally(() => { if (alive) setMaterialsLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiGet("/learning/admin/enrollments"),
      apiGet("/admin/users").catch(() => null),
    ]).then(([enrollmentItems, userItems]) => {
      if (!alive || !Array.isArray(enrollmentItems)) return;
      // /admin/users の正確なフィールド名は未確認のため、想定される候補を防御的に試す。
      // 一致しなければ traineeName/companyName は空のまま（normalizeEnrollment側でフォールバック済み）。
      const usersById = new Map();
      (Array.isArray(userItems) ? userItems : []).forEach(user => {
        const key = user?.userId || user?.id || user?.sub;
        if (key) usersById.set(key, user);
      });
      const courseLookup = Object.fromEntries(courses.map(course => [course.id, course]));
      const normalized = enrollmentItems.map((item, index) => {
        const user = usersById.get(item.traineeId);
        return normalizeEnrollment({
          ...item,
          id: `enr_${item.traineeId}_${item.courseId}`, // 再取得のたびにIDが変わらないよう固定
          traineeName: user?.name || item.traineeName || "",
          companyName: user?.companyName || user?.company || item.companyName || "",
        }, index, courseLookup);
      });
      setEnrollments(normalized);
      saveEnrollments(normalized);
      setEnrollmentsError("");
    })
      .catch(e => { if (alive) setEnrollmentsError(apiErrorMessage(e, "受講状況の取得に失敗しました。")); })
      .finally(() => { if (alive) setEnrollmentsLoading(false); });
    return () => { alive = false; };
  }, [courseIds]);

  useEffect(() => {
    let alive = true;
    apiGet("/learning/admin/quiz-questions")
      .then(items => {
        if (!alive || !Array.isArray(items)) return;
        const normalized = items.map(normalizeQuizQuestion).filter(item => item.id && item.deleted !== true);
        setQuizQuestions(normalized);
        saveQuizQuestions(normalized);
        setQuizQuestionsError("");
      })
      .catch(e => { if (alive) setQuizQuestionsError(apiErrorMessage(e, "問題一覧の取得に失敗しました。")); })
      .finally(() => { if (alive) setQuizQuestionsLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    apiGet("/learning/admin/review-flags")
      .then(items => {
        if (!alive || !Array.isArray(items)) return;
        const normalized = items.map(normalizeReviewFlag).filter(item => item.id);
        setReviewFlags(normalized);
        saveReviewFlags(normalized);
        setReviewFlagsError("");
      })
      .catch(e => { if (alive) setReviewFlagsError(apiErrorMessage(e, "復習フラグの取得に失敗しました。")); })
      .finally(() => { if (alive) setReviewFlagsLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    apiGet("/learning/admin/final-test-settings")
      .then(settings => {
        if (!alive || !settings) return;
        const next = { ...DEFAULT_FINAL_TEST_SETTINGS, ...settings };
        setFinalTestSettings(next);
        saveFinalTestSettings(next);
        setFinalTestSettingsError("");
      })
      .catch(e => { if (alive) setFinalTestSettingsError(apiErrorMessage(e, "総合テスト設定の取得に失敗しました。")); })
      .finally(() => { if (alive) setFinalTestSettingsLoading(false); });
    return () => { alive = false; };
  }, []);

  function commit(next) {
    setCourses(next);
    saveCourses(next);
  }

  function createCourse(form) {
    const course = normalizeCourse({ ...toCoursePayload(form), id: makeId() });
    commit([course, ...courses]);
    apiPost("/learning/admin/courses", toCourseApiPayload(course))
      .then(res => {
        const saved = res?.course ? normalizeCourse(res.course) : null;
        if (!saved?.id) return;
        commit([saved, ...courses.filter(item => item.id !== course.id && item.id !== saved.id)]);
      })
      .catch(e => setActionError(apiErrorMessage(e, "コースの作成に失敗しました。")));
    return course;
  }

  // AI Lesson Designer保存専用: createCourseと同じ正規化・楽観的ローカル反映を行うが、
  // API呼び出しの結果をawaitし失敗時は例外を呼び出し元に伝える(黙殺しない)。
  // createCourse自体・他の呼び出し元の挙動は変更しない。
  async function createCourseAwaitingApi(form) {
    const course = normalizeCourse({ ...toCoursePayload(form), id: makeId() });
    commit([course, ...courses]);
    const res = await apiPost("/learning/admin/courses", toCourseApiPayload(course));
    const saved = res?.course ? normalizeCourse(res.course) : course;
    commit([saved, ...courses.filter(item => item.id !== course.id && item.id !== saved.id)]);
    return saved;
  }

  function updateCourse(courseId, form) {
    let updated = null;
    const next = courses.map(course => (
      course.id === courseId ? (updated = normalizeCourse({ ...course, ...toCoursePayload(form) })) : course
    ));
    commit(next);
    if (updated) {
      apiPut(`/learning/admin/courses/${encodeURIComponent(courseId)}`, toCourseApiPayload(updated))
        .then(res => {
          const saved = res?.course ? normalizeCourse(res.course) : null;
          if (!saved?.id) return;
          commit(next.map(course => (course.id === courseId ? saved : course)));
        })
        .catch(e => setActionError(apiErrorMessage(e, "コースの更新に失敗しました。")));
    }
  }

  function togglePublish(courseId) {
    let updated = null;
    const next = courses.map(course => (
      course.id === courseId
        ? (updated = normalizeCourse({ ...course, published: course.published === false, updatedAt: new Date().toISOString() }))
        : course
    ));
    commit(next);
    if (updated) {
      apiPut(`/learning/admin/courses/${encodeURIComponent(courseId)}`, toCourseApiPayload(updated))
        .then(res => {
          const saved = res?.course ? normalizeCourse(res.course) : null;
          if (!saved?.id) return;
          commit(next.map(course => (course.id === courseId ? saved : course)));
        })
        .catch(e => setActionError(apiErrorMessage(e, "コースの更新に失敗しました。")));
    }
  }

  // 版固定公開(フェーズ③): 従来のtogglePublish(単純なPUT published:true/false切替)とは別に、
  // 「公開する」を新しいバージョンとして固定するための専用アクション。POST .../publishは
  // Backend側でスナップショットを作成しpublishedVersionを進める。非公開化(hide)は既存の
  // togglePublishのまま(バージョンは進めない、最後に固定したスナップショットは維持される)。
  async function publishCourse(courseId) {
    setActionError("");
    try {
      const res = await apiPost(`/learning/admin/courses/${encodeURIComponent(courseId)}/publish`, {});
      const saved = res?.course ? normalizeCourse(res.course) : null;
      if (saved) commit(courses.map(course => (course.id === courseId ? saved : course)));
      return { ok: true, version: res?.version };
    } catch (e) {
      setActionError(apiErrorMessage(e, "コースの公開に失敗しました。"));
      return { ok: false, error: e };
    }
  }

  // 版固定公開(フェーズ③): 公開履歴(いつ誰が公開したか)を取得する。一覧には出さず、
  // 「版履歴」ボタンを押した時だけ呼ぶ(常時ロードのAPI呼び出しを増やさないため)。
  async function getCourseVersions(courseId) {
    try {
      const versions = await apiGet(`/learning/admin/courses/${encodeURIComponent(courseId)}/versions`);
      return Array.isArray(versions) ? versions : [];
    } catch (e) {
      return [];
    }
  }

  function deleteCourse(courseId) {
    const deletedIds = readDeletedCourseIds();
    saveDeletedCourseIds([...deletedIds, courseId]);
    commit(courses.filter(course => course.id !== courseId));
    apiDelete(`/learning/admin/courses/${encodeURIComponent(courseId)}`)
      .catch(e => setActionError(apiErrorMessage(e, "コースの削除に失敗しました。")));
  }

  function commitLessons(next) {
    setLessonsByCourse(next);
    saveLessons(next);
  }

  function lessonsForCourse(courseId) {
    return (lessonsByCourse[courseId] || []).slice().sort((a, b) => a.order - b.order);
  }

  function createLesson(courseId, form) {
    const current = lessonsForCourse(courseId);
    const lesson = normalizeLesson({ ...toLessonPayload(form), id: `${courseId}-admin-${Date.now()}`, order: current.length }, current.length);
    const nextLocal = { ...lessonsByCourse, [courseId]: [...current, lesson] };
    commitLessons(nextLocal);
    apiPost(`/learning/admin/courses/${encodeURIComponent(courseId)}/lessons`, toLessonApiPayload(lesson))
      .then(res => {
        const saved = res?.lesson ? normalizeLesson(res.lesson) : null;
        if (!saved?.id) return;
        const synced = (nextLocal[courseId] || []).map(item => (item.id === lesson.id ? saved : item));
        commitLessons({ ...nextLocal, [courseId]: synced.sort((a, b) => a.order - b.order) });
      })
      .catch(e => setActionError(apiErrorMessage(e, "レッスンの作成に失敗しました。")));
    return lesson;
  }

  // AI Lesson Designer保存専用: createLessonと同じ正規化・楽観的ローカル反映を行うが、
  // API呼び出しの結果をawaitし失敗時は例外を呼び出し元に伝える(黙殺しない)。
  // createLesson自体・他の呼び出し元の挙動は変更しない。
  async function createLessonAwaitingApi(courseId, form) {
    const current = lessonsForCourse(courseId);
    const lesson = normalizeLesson({ ...toLessonPayload(form), id: `${courseId}-admin-${Date.now()}`, order: current.length }, current.length);
    const nextLocal = { ...lessonsByCourse, [courseId]: [...current, lesson] };
    commitLessons(nextLocal);
    const res = await apiPost(`/learning/admin/courses/${encodeURIComponent(courseId)}/lessons`, toLessonApiPayload(lesson));
    const saved = res?.lesson ? normalizeLesson(res.lesson) : lesson;
    const synced = (nextLocal[courseId] || []).map(item => (item.id === lesson.id ? saved : item));
    commitLessons({ ...nextLocal, [courseId]: synced.sort((a, b) => a.order - b.order) });
    return saved;
  }

  function updateLesson(courseId, lessonId, form) {
    const current = lessonsForCourse(courseId);
    let updated = null;
    const nextLessons = current.map(lesson => (
      lesson.id === lessonId ? (updated = normalizeLesson({ ...lesson, ...toLessonPayload(form) }, lesson.order)) : lesson
    ));
    const nextLocal = { ...lessonsByCourse, [courseId]: nextLessons };
    commitLessons(nextLocal);
    if (updated) {
      apiPut(`/learning/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`, toLessonApiPayload(updated))
        .then(res => {
          const saved = res?.lesson ? normalizeLesson(res.lesson) : null;
          if (!saved?.id) return;
          commitLessons({ ...nextLocal, [courseId]: nextLessons.map(lesson => (lesson.id === lessonId ? saved : lesson)) });
        })
        .catch(e => setActionError(apiErrorMessage(e, "レッスンの更新に失敗しました。")));
    }
  }

  function deleteLesson(courseId, lessonId) {
    const nextLessons = lessonsForCourse(courseId)
      .filter(lesson => lesson.id !== lessonId)
      .map((lesson, index) => normalizeLesson({ ...lesson, order: index }, index));
    commitLessons({ ...lessonsByCourse, [courseId]: nextLessons });
    apiDelete(`/learning/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`)
      .catch(e => setActionError(apiErrorMessage(e, "レッスンの削除に失敗しました。")));
  }

  function toggleLessonPublish(courseId, lessonId) {
    let updated = null;
    const nextLessons = lessonsForCourse(courseId).map(lesson => (
      lesson.id === lessonId
        ? (updated = normalizeLesson({ ...lesson, published: lesson.published === false, updatedAt: new Date().toISOString() }, lesson.order))
        : lesson
    ));
    const nextLocal = { ...lessonsByCourse, [courseId]: nextLessons };
    commitLessons(nextLocal);
    if (updated) {
      apiPut(`/learning/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`, toLessonApiPayload(updated))
        .then(res => {
          const saved = res?.lesson ? normalizeLesson(res.lesson) : null;
          if (!saved?.id) return;
          commitLessons({ ...nextLocal, [courseId]: nextLessons.map(lesson => (lesson.id === lessonId ? saved : lesson)) });
        })
        .catch(e => setActionError(apiErrorMessage(e, "レッスンの更新に失敗しました。")));
    }
  }

  function moveLesson(courseId, lessonId, direction) {
    const current = lessonsForCourse(courseId);
    const index = current.findIndex(lesson => lesson.id === lessonId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return;
    const nextLessons = current.slice();
    const [lesson] = nextLessons.splice(index, 1);
    nextLessons.splice(nextIndex, 0, lesson);
    const normalized = nextLessons.map((item, order) => normalizeLesson({ ...item, order }, order));
    const nextLocal = { ...lessonsByCourse, [courseId]: normalized };
    commitLessons(nextLocal);
    normalized.forEach(lesson => {
      apiPut(`/learning/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lesson.id)}`, toLessonApiPayload(lesson))
        .catch(e => setActionError(apiErrorMessage(e, "並び替えの保存に失敗しました。")));
    });
  }

  function commitMaterials(next) {
    const normalized = next.map(normalizeMaterial).sort((a, b) => a.order - b.order);
    setMaterials(normalized);
    saveMaterials(normalized);
  }

  // (f) PDFインポート等、materialIdが確定してから使う呼び出し元向け: createMaterialと同じ
  // 正規化・楽観的ローカル反映を行うが、API呼び出しの結果をawaitし失敗時は例外を呼び出し元に
  // 伝える(黙殺しない)。createMaterial自体・他の呼び出し元の挙動は変更しない。
  async function createMaterialAwaitingApi(form) {
    const material = normalizeMaterial({
      ...toMaterialPayload(form),
      id: `mat_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }, materials.length);
    const nextLocal = [...materials, material];
    commitMaterials(nextLocal);
    const res = await apiPost("/learning/admin/materials", toMaterialApiPayload(material));
    const saved = res?.material ? normalizeMaterial(res.material) : material;
    commitMaterials(nextLocal.map(item => (item.id === material.id ? saved : item)));
    return saved;
  }

  function createMaterial(form) {
    const material = normalizeMaterial({
      ...toMaterialPayload(form),
      id: `mat_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }, materials.length);
    const nextLocal = [...materials, material];
    commitMaterials(nextLocal);
    apiPost("/learning/admin/materials", toMaterialApiPayload(material))
      .then(res => {
        const saved = res?.material ? normalizeMaterial(res.material) : null;
        if (!saved?.id) return;
        commitMaterials(nextLocal.map(item => (item.id === material.id ? saved : item)));
      })
      .catch(e => setActionError(apiErrorMessage(e, "教材の作成に失敗しました。")));
    return material;
  }

  function updateMaterial(materialId, form) {
    let updated = null;
    const next = materials.map(material => (
      material.id === materialId
        ? (updated = normalizeMaterial({ ...material, ...toMaterialPayload(form), id: material.id, createdAt: material.createdAt }))
        : material
    ));
    commitMaterials(next);
    if (updated) {
      apiPut(`/learning/admin/materials/${encodeURIComponent(materialId)}`, toMaterialApiPayload(updated))
        .then(res => {
          const saved = res?.material ? normalizeMaterial(res.material) : null;
          if (!saved?.id) return;
          commitMaterials(next.map(material => (material.id === materialId ? saved : material)));
        })
        .catch(e => setActionError(apiErrorMessage(e, "教材の更新に失敗しました。")));
    }
  }

  function deleteMaterial(materialId) {
    commitMaterials(materials.filter(material => material.id !== materialId));
    apiDelete(`/learning/admin/materials/${encodeURIComponent(materialId)}`)
      .catch(e => setActionError(apiErrorMessage(e, "教材の削除に失敗しました。")));
  }

  function toggleMaterialPublish(materialId) {
    let updated = null;
    const next = materials.map(material => (
      material.id === materialId
        ? (updated = normalizeMaterial({
            ...material,
            status: material.status === "published" ? "draft" : "published",
            updatedAt: new Date().toISOString(),
          }))
        : material
    ));
    commitMaterials(next);
    if (updated) {
      apiPut(`/learning/admin/materials/${encodeURIComponent(materialId)}`, toMaterialApiPayload(updated))
        .then(res => {
          const saved = res?.material ? normalizeMaterial(res.material) : null;
          if (!saved?.id) return;
          commitMaterials(next.map(material => (material.id === materialId ? saved : material)));
        })
        .catch(e => setActionError(apiErrorMessage(e, "教材の更新に失敗しました。")));
    }
  }

  function commitEnrollments(next) {
    const normalized = next.map(normalizeEnrollment);
    setEnrollments(normalized);
    saveEnrollments(normalized);
  }

  function updateEnrollmentMemo(enrollmentId, memo) {
    let target = null;
    commitEnrollments(enrollments.map(enrollment => {
      if (enrollment.id !== enrollmentId) return enrollment;
      target = { ...enrollment, memo };
      return target;
    }));
    if (target?.traineeId && target?.courseId) {
      apiPut(`/learning/admin/enrollments/${encodeURIComponent(target.traineeId)}/${encodeURIComponent(target.courseId)}/memo`, { memo })
        .catch(e => setActionError(apiErrorMessage(e, "メモの保存に失敗しました。")));
    }
  }

  function commitQuizQuestions(next) {
    const normalized = next.map(normalizeQuizQuestion);
    setQuizQuestions(normalized);
    saveQuizQuestions(normalized);
  }

  function createQuizQuestion(form) {
    const item = normalizeQuizQuestion({
      ...toQuizPayload(form),
      id: `quiz_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }, quizQuestions.length);
    commitQuizQuestions([...quizQuestions, item]);
    apiPost("/learning/admin/quiz-questions", toQuizPayload(form))
      .then(res => {
        const saved = res?.quiz ? normalizeQuizQuestion(res.quiz) : null;
        if (!saved?.id) return;
        commitQuizQuestions([...quizQuestions.filter(q => q.id !== item.id), saved]);
      })
      .catch(e => setActionError(apiErrorMessage(e, "問題の作成に失敗しました。")));
    return item;
  }

  function updateQuizQuestion(questionId, form) {
    let updated = null;
    const next = quizQuestions.map(item => (
      item.id === questionId
        ? (updated = normalizeQuizQuestion({ ...item, ...toQuizPayload(form), id: item.id, createdAt: item.createdAt }))
        : item
    ));
    commitQuizQuestions(next);
    if (updated) {
      apiPut(`/learning/admin/quiz-questions/${encodeURIComponent(questionId)}`, toQuizApiPayload(updated))
        .then(res => {
          const saved = res?.quiz ? normalizeQuizQuestion(res.quiz) : null;
          if (!saved?.id) return;
          commitQuizQuestions(next.map(item => (item.id === questionId ? saved : item)));
        })
        .catch(e => setActionError(apiErrorMessage(e, "問題の更新に失敗しました。")));
    }
  }

  function deleteQuizQuestion(questionId) {
    commitQuizQuestions(quizQuestions.filter(item => item.id !== questionId));
    apiDelete(`/learning/admin/quiz-questions/${encodeURIComponent(questionId)}`)
      .catch(e => setActionError(apiErrorMessage(e, "問題の削除に失敗しました。")));
  }

  function toggleQuizPublish(questionId) {
    let updated = null;
    const next = quizQuestions.map(item => (
      item.id === questionId
        ? (updated = normalizeQuizQuestion({ ...item, published: item.published !== true, updatedAt: new Date().toISOString() }))
        : item
    ));
    commitQuizQuestions(next);
    if (updated) {
      apiPut(`/learning/admin/quiz-questions/${encodeURIComponent(questionId)}`, toQuizApiPayload(updated))
        .then(res => {
          const saved = res?.quiz ? normalizeQuizQuestion(res.quiz) : null;
          if (!saved?.id) return;
          commitQuizQuestions(next.map(item => (item.id === questionId ? saved : item)));
        })
        .catch(e => setActionError(apiErrorMessage(e, "公開状態の更新に失敗しました。")));
    }
  }

  function commitReviewFlags(next) {
    const normalized = next.map(normalizeReviewFlag);
    setReviewFlags(normalized);
    saveReviewFlags(normalized);
  }

  function upsertReviewFlag(form, reviewId = null) {
    if (reviewId) {
      let updated = null;
      const next = reviewFlags.map(item => (
        item.id === reviewId ? (updated = normalizeReviewFlag({ ...item, ...toReviewPayload(form), id: item.id })) : item
      ));
      commitReviewFlags(next);
      apiPut(`/learning/admin/review-flags/${encodeURIComponent(reviewId)}`, toReviewPayload(form))
        .then(res => {
          const saved = res?.review ? normalizeReviewFlag(res.review) : null;
          if (!saved?.id) return;
          commitReviewFlags(next.map(item => (item.id === reviewId ? saved : item)));
        })
        .catch(e => setActionError(apiErrorMessage(e, "復習フラグの更新に失敗しました。")));
      return;
    }
    const item = normalizeReviewFlag({ ...toReviewPayload(form), id: `review_${Date.now()}` }, reviewFlags.length);
    commitReviewFlags([...reviewFlags, item]);
    apiPost("/learning/admin/review-flags", toReviewPayload(form))
      .then(res => {
        const saved = res?.review ? normalizeReviewFlag(res.review) : null;
        if (!saved?.id) return;
        commitReviewFlags([...reviewFlags.filter(r => r.id !== item.id), saved]);
      })
      .catch(e => setActionError(apiErrorMessage(e, "復習フラグの作成に失敗しました。")));
  }

  function deleteReviewFlag(reviewId) {
    commitReviewFlags(reviewFlags.filter(item => item.id !== reviewId));
    apiDelete(`/learning/admin/review-flags/${encodeURIComponent(reviewId)}`)
      .catch(e => setActionError(apiErrorMessage(e, "復習フラグの削除に失敗しました。")));
  }

  function updateFinalTestSettings(nextSettings) {
    const next = {
      weakFocusRate: Number(nextSettings.weakFocusRate || 0),
      coverageRate: Number(nextSettings.coverageRate || 0),
      questionCount: Number(nextSettings.questionCount || 0),
      minLessonCount: Number(nextSettings.minLessonCount || 0),
      aiFinalEnabled: nextSettings.aiFinalEnabled === true,
    };
    setFinalTestSettings(next);
    saveFinalTestSettings(next);
    apiPut("/learning/admin/final-test-settings", next)
      .catch(e => setActionError(apiErrorMessage(e, "総合テスト設定の保存に失敗しました。")));
  }

  const stats = useMemo(() => {
    const total = courses.length;
    const published = courses.filter(c => c.published !== false).length;
    const privateCount = total - published;
    const skillCount = new Set(courses.flatMap(c => c.skills || [])).size;
    return { total, published, privateCount, skillCount };
  }, [courses]);

  const materialStats = useMemo(() => {
    const total = materials.length;
    const published = materials.filter(material => material.status === "published").length;
    const draft = total - published;
    const linkedLessons = new Set(materials.map(material => material.lessonId).filter(Boolean)).size;
    return { total, published, draft, linkedLessons };
  }, [materials]);

  const enrollmentStats = useMemo(() => {
    const traineeIds = new Set(enrollments.map(enrollment => enrollment.traineeId));
    const totalTrainees = traineeIds.size;
    const inProgressTrainees = new Set(enrollments.filter(e => e.status === "in_progress").map(e => e.traineeId)).size;
    const completedTrainees = new Set(enrollments.filter(e => e.status === "completed").map(e => e.traineeId)).size;
    const notStartedTrainees = Math.max(0, totalTrainees - new Set(enrollments.filter(e => e.status !== "not_started").map(e => e.traineeId)).size);
    const averageProgress = enrollments.length
      ? Math.round(enrollments.reduce((sum, enrollment) => sum + Number(enrollment.progress || 0), 0) / enrollments.length)
      : 0;
    return { totalTrainees, inProgressTrainees, completedTrainees, notStartedTrainees, averageProgress };
  }, [enrollments]);

  const quizStats = useMemo(() => {
    const total = quizQuestions.length;
    const published = quizQuestions.filter(item => item.published).length;
    const review = quizQuestions.filter(item => item.type === "review").length;
    const final = quizQuestions.filter(item => item.type === "final" || item.type === "ai_final").length;
    return { total, published, review, final };
  }, [quizQuestions]);

  return {
    courses,
    coursesLoading,
    coursesError,
    stats,
    createCourse,
    createCourseAwaitingApi,
    updateCourse,
    togglePublish,
    deleteCourse,
    lessonsByCourse,
    lessonsForCourse,
    createLesson,
    createLessonAwaitingApi,
    updateLesson,
    deleteLesson,
    toggleLessonPublish,
    moveLesson,
    materials,
    materialsLoading,
    materialsError,
    materialStats,
    createMaterial,
    createMaterialAwaitingApi,
    updateMaterial,
    deleteMaterial,
    toggleMaterialPublish,
    enrollments,
    enrollmentsLoading,
    enrollmentsError,
    enrollmentStats,
    updateEnrollmentMemo,
    actionError,
    clearActionError: () => setActionError(""),
    quizQuestions,
    quizQuestionsLoading,
    quizQuestionsError,
    quizStats,
    createQuizQuestion,
    updateQuizQuestion,
    deleteQuizQuestion,
    toggleQuizPublish,
    reviewFlags,
    reviewFlagsLoading,
    reviewFlagsError,
    upsertReviewFlag,
    deleteReviewFlag,
    finalTestSettings,
    finalTestSettingsLoading,
    finalTestSettingsError,
    updateFinalTestSettings,
  };
}
