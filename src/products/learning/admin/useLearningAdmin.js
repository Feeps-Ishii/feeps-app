import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { LearningCatalog, LESSON_CATALOG } from "../LearningCatalog.js";
import {
  DEFAULT_FINAL_TEST_SETTINGS,
  ENROLLMENT_SEED_TRAINEES,
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
    updatedAt: course.updatedAt || null,
  };
}

function seedCourses() {
  return LearningCatalog.map(normalizeCourse);
}

function readCourses() {
  try {
    const raw = window.localStorage.getItem(LEARNING_ADMIN_STORAGE_KEY);
    if (!raw) return seedCourses();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedCourses();
    return parsed.map(normalizeCourse);
  } catch (e) {
    return seedCourses();
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
    published: lesson.status ? lesson.status === "published" : lesson.published !== false,
    deleted: lesson.deleted === true || lesson.status === "deleted",
    order: Number.isFinite(Number(lesson.order)) ? Number(lesson.order) : index,
    updatedAt: lesson.updatedAt || null,
  };
}

function seedLessons() {
  return Object.fromEntries(
    LearningCatalog.map(course => [
      course.id,
      (LESSON_CATALOG[course.id] || []).map((lesson, index) => normalizeLesson({ ...lesson, order: index }, index)),
    ])
  );
}

function readLessons() {
  try {
    const raw = window.localStorage.getItem(LEARNING_ADMIN_LESSONS_STORAGE_KEY);
    if (!raw) return seedLessons();
    const parsed = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return seedLessons();
    return Object.fromEntries(
      Object.entries(parsed).map(([courseId, lessons]) => [
        courseId,
        Array.isArray(lessons) ? lessons.map(normalizeLesson).sort((a, b) => a.order - b.order) : [],
      ])
    );
  } catch (e) {
    return seedLessons();
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
    createdAt: material.createdAt || now,
    updatedAt: material.updatedAt || now,
  };
}

function seedMaterials() {
  return [];
}

function readMaterials() {
  try {
    const raw = window.localStorage.getItem(LEARNING_ADMIN_MATERIALS_STORAGE_KEY);
    if (!raw) return seedMaterials();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedMaterials();
    return parsed.map(normalizeMaterial).sort((a, b) => a.order - b.order);
  } catch (e) {
    return seedMaterials();
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
  };
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
  };
}

function courseById(courseId) {
  return LearningCatalog.find(course => course.id === courseId) || {};
}

function normalizeEnrollment(enrollment, index = 0) {
  const course = courseById(enrollment.courseId);
  const totalLessons = Number(enrollment.totalLessons || course.lessons || (LESSON_CATALOG[enrollment.courseId] || []).length || 0);
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
    memo: enrollment.memo || "",
  };
}

function seedEnrollments() {
  const courseIds = LearningCatalog.slice(0, 4).map(course => course.id);
  const statuses = ["in_progress", "completed", "not_started", "in_progress", "completed"];
  return ENROLLMENT_SEED_TRAINEES.flatMap((trainee, traineeIndex) => (
    courseIds.slice(0, traineeIndex % 2 === 0 ? 3 : 2).map((courseId, courseIndex) => {
      const course = courseById(courseId);
      const status = statuses[(traineeIndex + courseIndex) % statuses.length];
      const totalLessons = Number(course.lessons || (LESSON_CATALOG[courseId] || []).length || 0);
      const progress = status === "completed" ? 100 : status === "not_started" ? 0 : [35, 50, 65, 80][(traineeIndex + courseIndex) % 4];
      const completedLessons = totalLessons ? Math.round((progress / 100) * totalLessons) : 0;
      return normalizeEnrollment({
        id: `enr_${trainee.traineeId}_${courseId}`,
        ...trainee,
        courseId,
        courseTitle: course.title,
        status,
        progress,
        completedLessons,
        totalLessons,
        lastStudiedAt: status === "not_started" ? "" : `2026-07-${String((traineeIndex + courseIndex) % 9 + 1).padStart(2, "0")}`,
        completedAt: status === "completed" ? `2026-07-${String((traineeIndex + courseIndex) % 9 + 1).padStart(2, "0")}` : null,
        skills: course.skills || [],
        learningMinutes: status === "not_started" ? 0 : 45 + (traineeIndex + courseIndex) * 35,
        recentHistory: status === "not_started" ? [] : [
          `${course.title} のレッスンを学習`,
          `${completedLessons} / ${totalLessons} Lessons 完了`,
        ],
        memo: status === "in_progress" ? "次回面談で進捗確認" : "",
      });
    })
  ));
}

function readEnrollments() {
  try {
    const raw = window.localStorage.getItem(LEARNING_ADMIN_ENROLLMENTS_STORAGE_KEY);
    if (!raw) return seedEnrollments();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedEnrollments();
    return parsed.map(normalizeEnrollment);
  } catch (e) {
    return seedEnrollments();
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

function seedQuizQuestions() {
  return LearningCatalog.slice(0, 3).flatMap((course, courseIndex) => {
    const lesson = (LESSON_CATALOG[course.id] || [])[0];
    if (!lesson) return [];
    return [
      normalizeQuizQuestion({
        id: `quiz_seed_${course.id}`,
        courseId: course.id,
        lessonId: lesson.id,
        type: courseIndex === 2 ? "review" : "lesson",
        question: `${lesson.title} の理解確認として正しいものは？`,
        choices: ["基本概念を説明できる", "教材を開かなくてよい", "復習は不要", "配点は常に0点"],
        answer: 0,
        explanation: "レッスンの基本概念を説明できる状態を確認します。",
        difficulty: courseIndex === 0 ? "入門" : "標準",
        tags: [course.category, "確認"],
        skill: (course.skills || [])[0] || "",
        pageId: "page-1",
        chapterId: "chapter-1",
        points: 10,
        published: true,
      }),
    ];
  });
}

function readQuizQuestions() {
  try {
    const raw = window.localStorage.getItem(LEARNING_ADMIN_QUIZZES_STORAGE_KEY);
    if (!raw) return seedQuizQuestions();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedQuizQuestions();
    return parsed.map(normalizeQuizQuestion);
  } catch (e) {
    return seedQuizQuestions();
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

function seedReviewFlags() {
  const lessons = Object.values(LESSON_CATALOG).flat().slice(0, 4);
  return lessons.map((lesson, index) => normalizeReviewFlag({
    id: `review_seed_${lesson.id}`,
    lessonId: lesson.id,
    pageId: `page-${index + 1}`,
    status: index % 3 === 0 ? "understood" : index % 3 === 1 ? "uncertain" : "review_later",
    understood: index % 3 === 0,
    reviewLater: index % 3 === 2,
    reviewed: false,
  }, index));
}

function readReviewFlags() {
  try {
    const raw = window.localStorage.getItem(LEARNING_LESSON_REVIEW_STORAGE_KEY);
    if (!raw) return seedReviewFlags();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedReviewFlags();
    return parsed.map(normalizeReviewFlag);
  } catch (e) {
    return seedReviewFlags();
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

export function useLearningAdmin() {
  const [courses, setCourses] = useState(readCourses);
  const [lessonsByCourse, setLessonsByCourse] = useState(readLessons);
  const [materials, setMaterials] = useState(readMaterials);
  const [enrollments, setEnrollments] = useState(readEnrollments);
  const [quizQuestions, setQuizQuestions] = useState(readQuizQuestions);
  const [reviewFlags, setReviewFlags] = useState(readReviewFlags);
  const [finalTestSettings, setFinalTestSettings] = useState(readFinalTestSettings);

  useEffect(() => {
    let alive = true;
    apiGet("/learning/admin/courses")
      .then(items => {
        if (!alive || !Array.isArray(items) || items.length === 0) return;
        const normalized = items.map(normalizeCourse).filter(course => course.id && course.deleted !== true);
        setCourses(normalized);
        saveCourses(normalized);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const courseIds = useMemo(() => courses.map(course => course.id).filter(Boolean).join("|"), [courses]);

  useEffect(() => {
    let alive = true;
    courses.forEach(course => {
      if (!course.id) return;
      apiGet(`/learning/admin/courses/${encodeURIComponent(course.id)}/lessons`)
        .then(items => {
          if (!alive || !Array.isArray(items) || items.length === 0) return;
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
        if (!alive || !Array.isArray(items) || items.length === 0) return;
        const normalized = items.map(normalizeMaterial).filter(material => material.id && material.deleted !== true);
        setMaterials(normalized);
        saveMaterials(normalized);
      })
      .catch(() => {});
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
      .catch(() => {});
    return course;
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
        .catch(() => {});
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
        .catch(() => {});
    }
  }

  function deleteCourse(courseId) {
    const deletedIds = readDeletedCourseIds();
    saveDeletedCourseIds([...deletedIds, courseId]);
    commit(courses.filter(course => course.id !== courseId));
    apiDelete(`/learning/admin/courses/${encodeURIComponent(courseId)}`).catch(() => {});
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
      .catch(() => {});
    return lesson;
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
        .catch(() => {});
    }
  }

  function deleteLesson(courseId, lessonId) {
    const nextLessons = lessonsForCourse(courseId)
      .filter(lesson => lesson.id !== lessonId)
      .map((lesson, index) => normalizeLesson({ ...lesson, order: index }, index));
    commitLessons({ ...lessonsByCourse, [courseId]: nextLessons });
    apiDelete(`/learning/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`).catch(() => {});
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
        .catch(() => {});
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
      apiPut(`/learning/admin/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lesson.id)}`, toLessonApiPayload(lesson)).catch(() => {});
    });
  }

  function commitMaterials(next) {
    const normalized = next.map(normalizeMaterial).sort((a, b) => a.order - b.order);
    setMaterials(normalized);
    saveMaterials(normalized);
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
      .catch(() => {});
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
        .catch(() => {});
    }
  }

  function deleteMaterial(materialId) {
    commitMaterials(materials.filter(material => material.id !== materialId));
    apiDelete(`/learning/admin/materials/${encodeURIComponent(materialId)}`).catch(() => {});
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
        .catch(() => {});
    }
  }

  function commitEnrollments(next) {
    const normalized = next.map(normalizeEnrollment);
    setEnrollments(normalized);
    saveEnrollments(normalized);
  }

  function updateEnrollmentMemo(enrollmentId, memo) {
    commitEnrollments(enrollments.map(enrollment => (
      enrollment.id === enrollmentId ? { ...enrollment, memo } : enrollment
    )));
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
    return item;
  }

  function updateQuizQuestion(questionId, form) {
    commitQuizQuestions(quizQuestions.map(item => (
      item.id === questionId
        ? normalizeQuizQuestion({ ...item, ...toQuizPayload(form), id: item.id, createdAt: item.createdAt })
        : item
    )));
  }

  function deleteQuizQuestion(questionId) {
    commitQuizQuestions(quizQuestions.filter(item => item.id !== questionId));
  }

  function toggleQuizPublish(questionId) {
    commitQuizQuestions(quizQuestions.map(item => (
      item.id === questionId
        ? normalizeQuizQuestion({ ...item, published: item.published !== true, updatedAt: new Date().toISOString() })
        : item
    )));
  }

  function commitReviewFlags(next) {
    const normalized = next.map(normalizeReviewFlag);
    setReviewFlags(normalized);
    saveReviewFlags(normalized);
  }

  function upsertReviewFlag(form, reviewId = null) {
    if (reviewId) {
      commitReviewFlags(reviewFlags.map(item => (
        item.id === reviewId ? normalizeReviewFlag({ ...item, ...toReviewPayload(form), id: item.id }) : item
      )));
      return;
    }
    const item = normalizeReviewFlag({ ...toReviewPayload(form), id: `review_${Date.now()}` }, reviewFlags.length);
    commitReviewFlags([...reviewFlags, item]);
  }

  function deleteReviewFlag(reviewId) {
    commitReviewFlags(reviewFlags.filter(item => item.id !== reviewId));
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
    stats,
    createCourse,
    updateCourse,
    togglePublish,
    deleteCourse,
    lessonsByCourse,
    lessonsForCourse,
    createLesson,
    updateLesson,
    deleteLesson,
    toggleLessonPublish,
    moveLesson,
    materials,
    materialStats,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    toggleMaterialPublish,
    enrollments,
    enrollmentStats,
    updateEnrollmentMemo,
    quizQuestions,
    quizStats,
    createQuizQuestion,
    updateQuizQuestion,
    deleteQuizQuestion,
    toggleQuizPublish,
    reviewFlags,
    upsertReviewFlag,
    deleteReviewFlag,
    finalTestSettings,
    updateFinalTestSettings,
  };
}
