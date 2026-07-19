import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../api.js";
// useLearning - Repository層。コース/レッスン一覧はBackend APIを正本とし、
// localStorageは管理画面(useLearningAdmin.js)が直近に取得した実データのキャッシュとしてのみ使う
// （API読み込み中の一時表示用。ハードコードされたモックカタログへはフォールバックしない）。
export function useLearning(role = "trainee") {
  const PROGRESS_KEY = "feeps.el.progress";
  const EVENTS_KEY   = "feeps.el.events";
  const LESSON_KEY   = "feeps.el.lessons";
  const REVIEW_KEY   = "feeps.el.lesson.review";
  const FINAL_PLAN_KEY = "feeps.el.finalTestPlans";
  const FINAL_RESULTS_KEY = "feeps.el.finalTestResults";
  const FINAL_SETTINGS_KEY = "feeps.el.admin.finalTestSettings";
  const ADMIN_QUIZZES_KEY = "feeps.el.admin.quizzes";
  const ADMIN_COURSES_KEY = "feeps.el.admin.courses";
  const ADMIN_LESSONS_KEY = "feeps.el.admin.lessons";
  const ADMIN_MATERIALS_KEY = "feeps.el.admin.materials";
  const ADMIN_DELETED_COURSES_KEY = "feeps.el.admin.courses.deleted";
  function _loadProgress() { try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); } catch { return {}; } }
  function _loadEvents()   { try { return JSON.parse(localStorage.getItem(EVENTS_KEY)   || "[]"); } catch { return []; } }
  function _loadLessons()  { try { return JSON.parse(localStorage.getItem(LESSON_KEY)   || "{}"); } catch { return {}; } }
  function _loadReviews()  { try { const v = JSON.parse(localStorage.getItem(REVIEW_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
  function _loadFinalPlans() { try { return JSON.parse(localStorage.getItem(FINAL_PLAN_KEY) || "{}"); } catch { return {}; } }
  function _loadFinalResults() { try { const v = JSON.parse(localStorage.getItem(FINAL_RESULTS_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
  function _loadAdminQuizzes() { try { const v = JSON.parse(localStorage.getItem(ADMIN_QUIZZES_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
  function _loadAdminCourses() { try { const v = JSON.parse(localStorage.getItem(ADMIN_COURSES_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
  function _loadAdminLessons() { try { const v = JSON.parse(localStorage.getItem(ADMIN_LESSONS_KEY) || "{}"); return v && !Array.isArray(v) && typeof v === "object" ? v : {}; } catch { return {}; } }
  function _loadAdminMaterials() { try { const v = JSON.parse(localStorage.getItem(ADMIN_MATERIALS_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
  function _loadDeletedCourseIds() { try { const v = JSON.parse(localStorage.getItem(ADMIN_DELETED_COURSES_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
  function normalizeLearnerCourse(course) {
    const published = course.published !== false && course.status !== "draft" && course.status !== "private";
    return {
      id: course.id || course.courseId,
      title: course.title || "",
      category: course.category || "その他",
      level: course.level || "入門",
      duration: String(course.duration || ""),
      desc: course.desc || course.description || "",
      skills: Array.isArray(course.skills) ? course.skills : [],
      color: course.color || "#14A3B8",
      status: published ? "published" : "draft",
      lessons: Number(course.lessons || 0),
      published,
      deleted: course.deleted === true,
    };
  }
  function getLearnerCatalog() {
    const byId = new Map();
    const adminCourses = Array.isArray(apiCourses) ? apiCourses : _loadAdminCourses();
    adminCourses.forEach(course => {
      if (!course?.id) return;
      const normalized = normalizeLearnerCourse(course);
      if (normalized.deleted || !normalized.published) {
        byId.delete(normalized.id);
        return;
      }
      byId.set(normalized.id, normalized);
    });
    _loadDeletedCourseIds().forEach(courseId => byId.delete(courseId));
    return [...byId.values()];
  }
  function lessonsForCourse(courseId) {
    const apiLessons = apiLessonsByCourse[courseId];
    if (Array.isArray(apiLessons)) {
      return apiLessons
        .filter(lesson => lesson.deleted !== true && lesson.published !== false && lesson.status !== "draft" && lesson.status !== "deleted")
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    }
    const adminLessons = _loadAdminLessons();
    if (Array.isArray(adminLessons[courseId])) {
      return adminLessons[courseId]
        .filter(lesson => lesson.published !== false)
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    }
    return [];
  }
  function courseById(courseId) {
    return getLearnerCatalog().find(c => c.id === courseId) || null;
  }
  function _loadFinalSettings() {
    try {
      const v = JSON.parse(localStorage.getItem(FINAL_SETTINGS_KEY) || "{}");
      return {
        weaknessRatio: Number(v.weaknessRatio ?? v.weakFocusRate ?? 70),
        overallRatio: Number(v.overallRatio ?? v.coverageRate ?? 30),
        questionCount: Number(v.questionCount ?? 20),
        minLessonCount: Number(v.minLessonCount ?? v.minimumLessonCount ?? 3),
        aiFinalEnabled: v.aiFinalEnabled === true,
      };
    } catch {
      return { weaknessRatio: 70, overallRatio: 30, questionCount: 20, minLessonCount: 3, aiFinalEnabled: false };
    }
  }
  function _loadQuizAttempts() {
    const keys = ["feeps.el.quiz.attempts", "feeps.el.lesson.quizResults", "feeps.el.quiz.results"];
    return keys.flatMap(key => {
      try {
        const v = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(v) ? v : Object.values(v || {});
      } catch {
        return [];
      }
    });
  }
  const [progress, setProgressState] = useState(_loadProgress);
  const [lessonProgress, setLessonProgress] = useState(_loadLessons);
  const [lessonReviews, setLessonReviews] = useState(_loadReviews);
  const [finalTestPlans, setFinalTestPlans] = useState(_loadFinalPlans);
  const [finalTestResults, setFinalTestResults] = useState(_loadFinalResults);
  const [finalTestResultsState, setFinalTestResultsState] = useState("loading");
  const [apiCourses, setApiCourses] = useState(null);
  const [apiLessonsByCourse, setApiLessonsByCourse] = useState({});
  const [courseCatalogState, setCourseCatalogState] = useState("loading");
  const [lessonCatalogStates, setLessonCatalogStates] = useState({});
  const [apiMaterialsByCourse, setApiMaterialsByCourse] = useState({});
  const lastProgressPushRef = useRef({});
  useEffect(() => {
    let alive = true;
    apiGet("/learning/final-tests/results")
      .then(items => {
        if (!alive) return;
        if (!Array.isArray(items)) { setFinalTestResultsState("error"); return; }
        const normalized = items.map(item => ({ ...item, id: item.id || item.resultId }));
        setFinalTestResults(normalized);
        localStorage.setItem(FINAL_RESULTS_KEY, JSON.stringify(normalized));
        setFinalTestResultsState("ready");
      })
      .catch(() => { if (alive) setFinalTestResultsState("error"); });
    return () => { alive = false; };
  }, []);
  // サーバーに保存された受講進捗を取得し、あるコースぶんだけローカル値を上書きする
  // （サーバーに記録が無いコースはローカル値をそのまま維持する）。
  useEffect(() => {
    let alive = true;
    apiGet("/learning/progress/me")
      .then(items => {
        if (!alive || !Array.isArray(items) || items.length === 0) return;
        const nextProgress = { ...progress };
        const nextLessons = { ...lessonProgress };
        const nextReviews = [...lessonReviews];
        items.forEach(item => {
          const courseId = item?.courseId;
          if (!courseId) return;
          // server: "not_started" | "in_progress" | "completed" -> frontend: "" (未設定) | "inprogress" | "completed"
          const status = item.status === "completed" ? "completed" : item.status === "in_progress" ? "inprogress" : null;
          if (status) {
            nextProgress[courseId] = {
              ...(nextProgress[courseId] || {}),
              status,
              progress: Number(item.progress || 0),
              startedAt: item.startedAt || null,
              completedAt: item.completedAt || null,
              lastAccessedAt: item.lastStudiedAt || nextProgress[courseId]?.lastAccessedAt || null,
            };
          }
          const completionMap = item.lessonCompletion && typeof item.lessonCompletion === "object" ? item.lessonCompletion : {};
          const doneMap = { ...(nextLessons[courseId] || {}) };
          Object.entries(completionMap).forEach(([lessonId, entry]) => {
            if (entry?.completed) doneMap[lessonId] = { completed: true, completedAt: entry.completedAt || null };
          });
          nextLessons[courseId] = doneMap;
          Object.entries(completionMap).forEach(([lessonId, entry]) => {
            if (!entry?.understanding) return;
            const idx = nextReviews.findIndex(r => r.courseId === courseId && r.lessonId === lessonId);
            const reviewItem = {
              id: `${courseId}_${lessonId}`,
              courseId,
              lessonId,
              pageId: "lesson",
              status: entry.understanding,
              understood: entry.understanding === "understood",
              reviewLater: entry.understanding === "review_later",
              reviewed: idx >= 0 ? nextReviews[idx].reviewed === true : false,
              updatedAt: item.updatedAt || new Date().toISOString(),
            };
            if (idx >= 0) nextReviews[idx] = { ...nextReviews[idx], ...reviewItem };
            else nextReviews.push(reviewItem);
          });
        });
        _save(nextProgress);
        _saveLessons(nextLessons);
        _saveReviews(nextReviews);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    apiGet("/learning/courses")
      .then(items => {
        if (!alive) return;
        if (Array.isArray(items) && items.length > 0) setApiCourses(items);
        setCourseCatalogState(Array.isArray(items) ? "ready" : "error");
      })
      .catch(() => { if (alive) setCourseCatalogState("error"); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    const learnerCatalog = getLearnerCatalog();
    if (learnerCatalog.length) {
      setLessonCatalogStates(prev => ({
        ...prev,
        ...Object.fromEntries(learnerCatalog.map(course => [course.id, "loading"])),
      }));
    }
    learnerCatalog.forEach(course => {
      apiGet(`/learning/courses/${encodeURIComponent(course.id)}/lessons`)
        .then(items => {
          if (!alive) return;
          if (Array.isArray(items) && items.length > 0) setApiLessonsByCourse(prev => ({ ...prev, [course.id]: items }));
          setLessonCatalogStates(prev => ({ ...prev, [course.id]: Array.isArray(items) ? "ready" : "error" }));
        })
        .catch(() => { if (alive) setLessonCatalogStates(prev => ({ ...prev, [course.id]: "error" })); });
    });
    return () => { alive = false; };
  }, [apiCourses]);
  useEffect(() => {
    let alive = true;
    getLearnerCatalog().forEach(course => {
      apiGet(`/learning/courses/${encodeURIComponent(course.id)}/materials`)
        .then(items => {
          if (!alive || !Array.isArray(items) || items.length === 0) return;
          setApiMaterialsByCourse(prev => ({ ...prev, [course.id]: items }));
        })
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [apiCourses]);
  function _save(next)        { setProgressState(next);   localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); }
  function _saveLessons(next) { setLessonProgress(next);  localStorage.setItem(LESSON_KEY,   JSON.stringify(next)); }
  function _saveReviews(next) { setLessonReviews(next);   localStorage.setItem(REVIEW_KEY,   JSON.stringify(next)); }
  function _saveFinalPlans(next) { setFinalTestPlans(next); localStorage.setItem(FINAL_PLAN_KEY, JSON.stringify(next)); }
  function _saveFinalResults(next) { setFinalTestResults(next); localStorage.setItem(FINAL_RESULTS_KEY, JSON.stringify(next)); }
  // 対象コースの現在の状態をサーバーへ丸ごと保存する（fire-and-forget）。呼び出し元が直前に
  // _save/_saveLessons/_saveReviews したばかりの値は setState が非同期のため progress/lessonProgress/
  // lessonReviews からは読めない。呼び出し元が実際に変更したフィールドだけ overrides で渡してもらう。
  // learningMinutes は現状トラッキングしていないため送信しない（サーバー側は未送信時に既存値を維持する）。
  function _pushProgressToServer(courseId, overrides = {}) {
    const course = courseById(courseId);
    const cp = overrides.courseProgress || progress[courseId] || {};
    const doneMap = overrides.courseLessons || lessonProgress[courseId] || {};
    const reviews = overrides.courseReviews || lessonReviews.filter(r => r.courseId === courseId);
    const lessonCompletion = {};
    new Set([...Object.keys(doneMap), ...reviews.map(r => r.lessonId)]).forEach(lessonId => {
      const done = doneMap[lessonId] || {};
      const review = reviews.find(r => r.lessonId === lessonId);
      lessonCompletion[lessonId] = {
        completed: done.completed === true,
        completedAt: done.completedAt || null,
        understanding: review ? review.status : null,
      };
    });
    apiPut("/learning/progress", {
      courseId,
      courseTitle: course?.title || courseId,
      totalLessons: lessonsForCourse(courseId).length,
      skills: course?.skills || [],
      startedAt: cp.startedAt || null,
      lastStudiedAt: cp.lastAccessedAt || new Date().toISOString(),
      completedAt: cp.completedAt || null,
      lessonCompletion,
    }).catch(() => {});
  }
  // touchLesson はレッスン閲覧のたびに呼ばれ得るため、コースごとに60秒間隔へ間引く。
  function _pushProgressToServerThrottled(courseId, overrides) {
    const now = Date.now();
    const last = lastProgressPushRef.current[courseId] || 0;
    if (now - last < 60000) return;
    lastProgressPushRef.current[courseId] = now;
    _pushProgressToServer(courseId, overrides);
  }
  function startCourse(courseId) {
    if (progress[courseId]?.status) return;
    const nextEntry = { status: "inprogress", progress: 0, startedAt: new Date().toISOString(), completedAt: null };
    _save({ ...progress, [courseId]: nextEntry });
    _pushProgressToServer(courseId, { courseProgress: nextEntry });
  }
  function touchLesson(courseId, lessonId) {
    const now = new Date().toISOString();
    const cur = progress[courseId] || {};
    const keepStatus = ["lessons_completed", "review_recommended", "final_test_failed"].includes(cur.status) || (cur.status === "completed" && hasPassedFinalTest(courseId));
    const nextEntry = {
      ...cur,
      status: keepStatus ? cur.status : "inprogress",
      progress: cur.progress ?? 0,
      startedAt: cur.startedAt || now,
      completedAt: cur.completedAt || null,
      lastLessonId: lessonId,
      lastAccessedAt: now,
    };
    _save({ ...progress, [courseId]: nextEntry });
    _pushProgressToServerThrottled(courseId, { courseProgress: nextEntry });
  }
  function completeCourse(courseId) {
    const now = new Date().toISOString();
    const cur = progress[courseId];
    const nextEntry = { status: "completed", progress: 100, startedAt: cur?.startedAt || now, completedAt: now };
    _save({ ...progress, [courseId]: nextEntry });
    _pushProgressToServer(courseId, { courseProgress: nextEntry });
    const course = courseById(courseId);
    const events = _loadEvents().filter(e => !(e.type === "el_completed" && e.courseId === courseId));
    events.unshift({ id: "ela-" + Date.now(), type: "el_completed", courseId, courseTitle: course?.title || courseId, earnedSkills: course?.skills || [], completedAt: now });
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    window.dispatchEvent(new Event("feeps:notifications-refresh"));
  }
  function completeLesson(courseId, lessonId) {
    const now = new Date().toISOString();
    const courseData = lessonProgress[courseId] || {};
    const nextCourseData = { ...courseData, [lessonId]: { completed: true, completedAt: now } };
    const next = { ...lessonProgress, [courseId]: nextCourseData };
    _saveLessons(next);
    const allLessons = lessonsForCourse(courseId);
    const doneCnt = Object.values(nextCourseData).filter(l => l.completed).length;
    const lessonPct = allLessons.length ? Math.round((doneCnt / allLessons.length) * 100) : 20;
    const pct = hasPassedFinalTest(courseId) ? 100 : Math.min(90, Math.round(lessonPct * 0.9));
    const allDone = allLessons.length > 0 && doneCnt >= allLessons.length;
    const cur = progress[courseId];
    const reviewRecommended = getCourseReviewItems(courseId).length > 0;
    const nextStatus = allDone
      ? (reviewRecommended ? "review_recommended" : "lessons_completed")
      : "inprogress";
    const nextEntry = {
      ...cur,
      status: cur?.status === "completed" && hasPassedFinalTest(courseId) ? "completed" : nextStatus,
      progress: pct,
      startedAt: cur?.startedAt || now,
      completedAt: cur?.status === "completed" && hasPassedFinalTest(courseId) ? cur.completedAt : null,
      lessonsCompletedAt: allDone ? (cur?.lessonsCompletedAt || now) : cur?.lessonsCompletedAt || null,
      readyForFinalTest: allDone,
      lastLessonId: lessonId,
      lastAccessedAt: now,
    };
    _save({ ...progress, [courseId]: nextEntry });
    _pushProgressToServer(courseId, { courseProgress: nextEntry, courseLessons: nextCourseData });
    return allDone;
  }
  function getLessonsDone(courseId) { return lessonProgress[courseId] || {}; }
  function materialsForLesson(courseId, lessonId) {
    const apiMaterials = apiMaterialsByCourse[courseId];
    const source = Array.isArray(apiMaterials) ? apiMaterials : _loadAdminMaterials();
    return source
      .filter(material => (
        material.courseId === courseId &&
        material.lessonId === lessonId &&
        material.deleted !== true &&
        material.status === "published"
      ))
      .slice()
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  }
  // S3実ファイル教材(s3keyあり)の閲覧/ダウンロード用に、都度サーバーから署名付きURLを取得する。
  async function getMaterialViewUrl(materialId) {
    return apiGet(`/learning/materials/view?materialId=${encodeURIComponent(materialId)}`);
  }
  function getLessonReview(courseId, lessonId) {
    return lessonReviews.find(r => r.courseId === courseId && r.lessonId === lessonId) || null;
  }
  function setLessonReview(courseId, lessonId, review) {
    const now = new Date().toISOString();
    const status = review.status || "understood";
    const nextItem = {
      id: `${courseId}_${lessonId}`,
      courseId,
      lessonId,
      pageId: review.pageId || "lesson",
      status,
      understood: status === "understood" || review.understood === true,
      reviewLater: status === "review_later" || review.reviewLater === true,
      reviewed: review.reviewed === true,
      updatedAt: now,
    };
    const exists = lessonReviews.some(r => r.courseId === courseId && r.lessonId === lessonId);
    const next = exists
      ? lessonReviews.map(r => (r.courseId === courseId && r.lessonId === lessonId ? { ...r, ...nextItem } : r))
      : [...lessonReviews, nextItem];
    _saveReviews(next);
    _pushProgressToServer(courseId, { courseReviews: next.filter(r => r.courseId === courseId) });
    return nextItem;
  }
  function getCourseReviewItems(courseId) {
    return lessonReviews.filter(r => (
      r.courseId === courseId &&
      (r.status === "uncertain" || r.status === "need_help" || r.status === "review_later" || r.reviewLater === true) &&
      r.reviewed !== true
    ));
  }
  function markLessonReviewed(courseId, lessonId) {
    const current = getLessonReview(courseId, lessonId);
    const nextItem = {
      ...(current || { courseId, lessonId, pageId: "lesson", status: "understood", understood: true, reviewLater: false }),
      reviewed: true,
      reviewLater: false,
      updatedAt: new Date().toISOString(),
    };
    const exists = lessonReviews.some(r => r.courseId === courseId && r.lessonId === lessonId);
    const next = exists
      ? lessonReviews.map(r => (r.courseId === courseId && r.lessonId === lessonId ? nextItem : r))
      : [...lessonReviews, { id: `${courseId}_${lessonId}`, ...nextItem }];
    _saveReviews(next);
    _pushProgressToServer(courseId, { courseReviews: next.filter(r => r.courseId === courseId) });
  }
  function allocateQuestions(items, total) {
    if (!items.length || total <= 0) return items.map(item => ({ ...item, questionCount: 0 }));
    const base = Math.floor(total / items.length);
    let rest = total - base * items.length;
    return items.map(item => ({ ...item, questionCount: base + (rest-- > 0 ? 1 : 0) }));
  }
  function getLowQuizAttempts(courseId) {
    return _loadQuizAttempts().filter(a => (
      a?.courseId === courseId &&
      Number(a.score ?? a.scorePercent ?? 100) < 70
    ));
  }
  function buildFinalTestPlan(courseId) {
    const course = courseById(courseId);
    const lessons = lessonsForCourse(courseId);
    const done = getLessonsDone(courseId);
    const reviews = lessonReviews.filter(r => r.courseId === courseId);
    const lowAttempts = getLowQuizAttempts(courseId);
    const settings = _loadFinalSettings();
    const questionCount = Math.max(1, settings.questionCount || 20);
    const weaknessRatio = Math.max(0, Math.min(100, settings.weaknessRatio || 70));
    const overallRatio = Math.max(0, Math.min(100, settings.overallRatio || 30));
    const weaknessQuestions = Math.round(questionCount * (weaknessRatio / 100));
    const warnings = [];
    const unfinishedLessons = lessons.filter(ls => !done[ls.id]?.completed);
    if (unfinishedLessons.length) warnings.push(`未完了Lessonが${unfinishedLessons.length}件あります。総合テスト前に完了を推奨します。`);
    if (settings.aiFinalEnabled) warnings.push("AI総合問題は次フェーズ予定です。今回は出題計画のみ作成します。");

    const weakByLesson = new Map();
    reviews.forEach(r => {
      if (r.status !== "uncertain" && r.status !== "need_help" && r.status !== "review_later" && r.reviewLater !== true) return;
      const ls = lessons.find(item => item.id === r.lessonId);
      if (!ls) return;
      const high = r.status === "review_later" || r.reviewLater === true || r.reviewed !== true;
      weakByLesson.set(r.lessonId, {
        lessonId: r.lessonId,
        lessonTitle: ls.title,
        reason: r.status === "review_later" || r.reviewLater === true ? "後で復習したい" : r.status === "need_help" ? "質問したい" : "少し不安",
        priority: high ? "high" : "medium",
        reviewLater: r.status === "review_later" || r.reviewLater === true,
        reviewed: r.reviewed === true,
        status: r.status,
        pageId: r.pageId || "lesson",
      });
    });
    lowAttempts.forEach(a => {
      const ls = lessons.find(item => item.id === a.lessonId);
      if (!ls) return;
      weakByLesson.set(a.lessonId, {
        ...(weakByLesson.get(a.lessonId) || { lessonId: a.lessonId, lessonTitle: ls.title, reviewLater: false, reviewed: false }),
        reason: `確認テスト低スコア（${Number(a.score ?? a.scorePercent)}点）`,
        priority: "high",
        quizScore: Number(a.score ?? a.scorePercent),
      });
    });

    let targetLessons = [...weakByLesson.values()].sort((a, b) => (a.priority === "high" ? -1 : 1) - (b.priority === "high" ? -1 : 1));
    const minLessonCount = Math.max(1, settings.minLessonCount || 3);
    const targetIds = new Set(targetLessons.map(item => item.lessonId));
    let overallLessons = lessons
      .filter(ls => !targetIds.has(ls.id))
      .map(ls => ({ lessonId: ls.id, lessonTitle: ls.title, reason: "全体確認" }));
    if (targetLessons.length + overallLessons.length < minLessonCount) {
      const addable = lessons.filter(ls => !targetIds.has(ls.id) && !overallLessons.some(item => item.lessonId === ls.id));
      overallLessons = [...overallLessons, ...addable.map(ls => ({ lessonId: ls.id, lessonTitle: ls.title, reason: "最低出題Lesson数の補完" }))];
    }
    overallLessons = overallLessons.slice(0, Math.max(minLessonCount, overallLessons.length));
    const effectiveWeaknessQuestions = targetLessons.length ? weaknessQuestions : 0;
    const overallQuestions = questionCount - effectiveWeaknessQuestions;
    targetLessons = allocateQuestions(targetLessons, effectiveWeaknessQuestions);
    overallLessons = allocateQuestions(overallLessons, overallQuestions);
    const now = new Date().toISOString();
    const plan = {
      courseId,
      courseTitle: course?.title || courseId,
      questionCount,
      weaknessRatio,
      overallRatio,
      weaknessQuestions: effectiveWeaknessQuestions,
      overallQuestions,
      minLessonCount,
      targetLessons,
      overallLessons,
      warnings,
      source: {
        completedLessons: lessons.filter(ls => done[ls.id]?.completed).length,
        totalLessons: lessons.length,
        reviewCount: reviews.length,
        lowQuizAttemptCount: lowAttempts.length,
        aiFinalEnabled: settings.aiFinalEnabled,
      },
      createdAt: finalTestPlans[courseId]?.createdAt || now,
      updatedAt: now,
    };
    saveFinalTestPlan(courseId, plan);
    return plan;
  }
  function getFinalTestPlan(courseId) {
    return finalTestPlans[courseId] || null;
  }
  function saveFinalTestPlan(courseId, plan) {
    const now = new Date().toISOString();
    const next = {
      ...finalTestPlans,
      [courseId]: {
        ...plan,
        courseId,
        createdAt: plan.createdAt || finalTestPlans[courseId]?.createdAt || now,
        updatedAt: now,
      },
    };
    _saveFinalPlans(next);
    return next[courseId];
  }
  function clearFinalTestPlan(courseId) {
    const next = { ...finalTestPlans };
    delete next[courseId];
    _saveFinalPlans(next);
  }
  function normalizeFinalQuestion(raw, courseId, lesson, source, index = 0) {
    if (!raw || !lesson) return null;
    const question = raw.question || raw.q || "";
    const choices = raw.choices || raw.options || [];
    if (!question || !Array.isArray(choices) || choices.length < 2) return null;
    return {
      id: `final_${source}_${courseId}_${lesson.id}_${raw.id || index}`,
      source,
      courseId,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      question,
      choices: choices.slice(0, 4),
      answer: Math.max(0, Math.min(3, Number(raw.answer || 0))),
      explanation: raw.explanation || `${lesson.title}の内容を確認しましょう。`,
      skill: raw.skill || "",
      tags: Array.isArray(raw.tags) ? raw.tags : [],
    };
  }
  function mockFinalQuestion(courseId, lesson, index = 0) {
    return {
      id: `final_mock_${courseId}_${lesson.id}_${index}`,
      source: "mock",
      courseId,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      question: `${lesson.title}の理解確認として最も適切なものはどれですか？`,
      choices: [
        lesson.summary || "Lessonの重要ポイントを説明できる",
        "復習せずに進めばよい",
        "このLessonは総合テストと関係ない",
        "選択肢を読まずに回答する",
      ],
      answer: 0,
      explanation: `${lesson.title}の要点と学習ポイントを自分の言葉で説明できる状態を目指しましょう。`,
      skill: "",
      tags: ["mock"],
    };
  }
  function getQuestionsForLesson(courseId, lesson) {
    const adminQuestions = _loadAdminQuizzes()
      .filter(q => (
        q.courseId === courseId &&
        q.lessonId === lesson.id &&
        q.published !== false &&
        ["lesson", "review", "final"].includes(q.type || "lesson")
      ))
      .map((q, i) => normalizeFinalQuestion(q, courseId, lesson, "admin", i))
      .filter(Boolean);
    const lessonQuestions = (lesson.questions || [])
      .map((q, i) => normalizeFinalQuestion(q, courseId, lesson, "lesson", i))
      .filter(Boolean);
    return [...adminQuestions, ...lessonQuestions];
  }
  function buildFinalTestQuestions(courseId) {
    let plan = getFinalTestPlan(courseId);
    if (!plan) plan = buildFinalTestPlan(courseId);
    const lessons = lessonsForCourse(courseId);
    const selected = [];
    const pickForPlanItem = (item, fallbackIndex) => {
      const lesson = lessons.find(ls => ls.id === item.lessonId) || lessons[fallbackIndex % Math.max(1, lessons.length)];
      if (!lesson) return;
      const pool = getQuestionsForLesson(courseId, lesson);
      const count = Math.max(0, Number(item.questionCount || 0));
      for (let i = 0; i < count; i += 1) {
        const base = pool[i % Math.max(1, pool.length)] || mockFinalQuestion(courseId, lesson, i);
        selected.push({ ...base, id: `${base.id}_${selected.length}`, planReason: item.reason || "出題計画", priority: item.priority || "normal" });
      }
    };
    [...(plan.targetLessons || []), ...(plan.overallLessons || [])].forEach(pickForPlanItem);
    while (selected.length < plan.questionCount && lessons.length) {
      const lesson = lessons[selected.length % lessons.length];
      selected.push({ ...mockFinalQuestion(courseId, lesson, selected.length), planReason: "不足分の補完", priority: "normal" });
    }
    return selected.slice(0, plan.questionCount);
  }
  function getFinalTestResults(courseId) {
    return finalTestResults.filter(r => r.courseId === courseId);
  }
  function getLatestFinalTestResult(courseId) {
    return getFinalTestResults(courseId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;
  }
  function getOfficialFinalTestResult(courseId) {
    return getFinalTestResults(courseId)
      .filter(result => result?.passed === true)
      .sort((a, b) => {
        const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      })[0] || null;
  }
  function hasPassedFinalTest(courseId) {
    return Boolean(getOfficialFinalTestResult(courseId));
  }
  function getCourseProgress(courseId) {
    if (hasPassedFinalTest(courseId)) return 100;
    const lessons = lessonsForCourse(courseId);
    if (!lessons.length) return Math.min(90, Number(progress[courseId]?.progress || 0));
    const done = getLessonsDone(courseId);
    const doneCnt = lessons.filter(lesson => done[lesson.id]?.completed).length;
    return Math.min(90, Math.round((doneCnt / lessons.length) * 90));
  }
  function getCourseState(courseId) {
    const lessons = lessonsForCourse(courseId);
    const done = getLessonsDone(courseId);
    const doneCnt = lessons.filter(lesson => done[lesson.id]?.completed).length;
    const allLessonsDone = lessons.length > 0 && doneCnt >= lessons.length;
    const latestResult = getLatestFinalTestResult(courseId);
    const officialResult = getOfficialFinalTestResult(courseId);
    const reviewItems = getCourseReviewItems(courseId);
    const courseProgress = getCourseProgress(courseId);
    if (officialResult) return { status: "completed", progress: courseProgress, readyForFinalTest: true, allLessonsDone, doneCnt, total: lessons.length, latestResult, officialResult, reviewItems };
    if (latestResult && latestResult.passed === false) return { status: "final_test_failed", progress: courseProgress, readyForFinalTest: allLessonsDone, allLessonsDone, doneCnt, total: lessons.length, latestResult, officialResult, reviewItems };
    if (allLessonsDone && reviewItems.length) return { status: "review_recommended", progress: courseProgress, readyForFinalTest: true, allLessonsDone, doneCnt, total: lessons.length, latestResult, officialResult, reviewItems };
    if (allLessonsDone) return { status: "lessons_completed", progress: courseProgress, readyForFinalTest: true, allLessonsDone, doneCnt, total: lessons.length, latestResult, officialResult, reviewItems };
    const rawStatus = progress[courseId]?.status;
    const normalizedStatus = rawStatus === "completed" ? (allLessonsDone ? "lessons_completed" : "inprogress") : (rawStatus || "not_started");
    return { status: normalizedStatus, progress: courseProgress, readyForFinalTest: false, allLessonsDone, doneCnt, total: lessons.length, latestResult, officialResult, reviewItems };
  }
  function saveFinalTestResult(result) {
    const next = [result, ...finalTestResults.filter(r => r.id !== result.id)];
    _saveFinalResults(next);
    apiPost("/learning/final-tests/results", { ...result, resultId: result.resultId || result.id })
      .then(saved => {
        const item = saved?.result;
        if (!item) return;
        const normalized = { ...item, id: item.resultId || item.id };
        const merged = [normalized, ...next.filter(r => (r.resultId || r.id) !== (normalized.resultId || normalized.id))];
        _saveFinalResults(merged);
      })
      .catch(() => {});
    const cur = progress[result.courseId] || {};
    if (result.passed === true) {
      completeCourse(result.courseId);
    } else {
      _save({
        ...progress,
        [result.courseId]: {
          ...cur,
          status: "final_test_failed",
          progress: Math.min(90, Number(cur.progress ?? getCourseProgress(result.courseId) ?? 90)),
          readyForFinalTest: true,
          completedAt: null,
          lastFinalTestAt: result.createdAt || new Date().toISOString(),
        },
      });
    }
    return result;
  }
  function gradeFinalTest(courseId, questions, answers) {
    const course = courseById(courseId);
    const questionCount = questions.length;
    const correctCount = questions.filter(q => Number(answers[q.id]) === Number(q.answer)).length;
    const score = questionCount ? Math.round((correctCount / questionCount) * 100) : 0;
    const byLesson = questions.reduce((acc, q) => {
      if (!acc[q.lessonId]) acc[q.lessonId] = { lessonId: q.lessonId, lessonTitle: q.lessonTitle, correct: 0, total: 0 };
      acc[q.lessonId].total += 1;
      if (Number(answers[q.id]) === Number(q.answer)) acc[q.lessonId].correct += 1;
      return acc;
    }, {});
    const lessonBreakdown = Object.values(byLesson).map(item => ({
      ...item,
      rate: item.total ? Math.round((item.correct / item.total) * 100) : 0,
    }));
    const weakLessons = lessonBreakdown
      .filter(item => item.rate < 70)
      .map(item => ({ lessonId: item.lessonId, lessonTitle: item.lessonTitle, reason: "正答率が低い", rate: item.rate }));
    const result = {
      id: `final_${Date.now()}`,
      courseId,
      courseTitle: course?.title || courseId,
      skills: course?.skills || [],
      score,
      passed: score >= 70,
      correctCount,
      incorrectCount: Math.max(0, questionCount - correctCount),
      questionCount,
      passLine: 70,
      lessonBreakdown,
      weakLessons,
      answers: questions.map(q => ({
        questionId: q.id,
        lessonId: q.lessonId,
        lessonTitle: q.lessonTitle,
        question: q.question,
        choices: q.choices,
        selected: answers[q.id],
        correctAnswer: q.answer,
        correct: Number(answers[q.id]) === Number(q.answer),
        explanation: q.explanation,
      })),
      createdAt: new Date().toISOString(),
    };
    return saveFinalTestResult(result);
  }
  function getAchievements() { return _loadEvents().filter(e => e.type === "el_completed" && hasPassedFinalTest(e.courseId)); }
  function getEarnedSkills() {
    const done = getLearnerCatalog().filter(c => hasPassedFinalTest(c.id));
    return [...new Set(done.flatMap(c => c.skills))];
  }
  const catalog = getLearnerCatalog();
  const completed  = catalog.filter(c => hasPassedFinalTest(c.id));
  const inprogress = catalog.filter(c => {
    if (hasPassedFinalTest(c.id)) return false;
    const state = getCourseState(c.id).status;
    return ["inprogress", "lessons_completed", "review_recommended", "final_test_failed"].includes(state);
  });
  const notStarted = catalog.filter(c => !progress[c.id]?.status && !hasPassedFinalTest(c.id));
  return {
    progress,
    lessonProgress,
    lessonReviews,
    finalTestPlans,
    finalTestResults,
    startCourse,
    touchLesson,
    completeCourse,
    completeLesson,
    getLessonsDone,
    materialsForLesson,
    getMaterialViewUrl,
    getLessonReview,
    setLessonReview,
    getCourseReviewItems,
    markLessonReviewed,
    buildFinalTestPlan,
    getFinalTestPlan,
    saveFinalTestPlan,
    clearFinalTestPlan,
    buildFinalTestQuestions,
    gradeFinalTest,
    getFinalTestResults,
    getLatestFinalTestResult,
    finalTestResultsState,
    getOfficialFinalTestResult,
    hasPassedFinalTest,
    getCourseProgress,
    getCourseState,
    saveFinalTestResult,
    lessonsForCourse,
    courseById,
    courseCatalogState,
    lessonCatalogState: courseId => lessonCatalogStates[courseId] || "loading",
    getAchievements,
    getEarnedSkills,
    completed,
    inprogress,
    notStarted,
    catalog,
  };
}
