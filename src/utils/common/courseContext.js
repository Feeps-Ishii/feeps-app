const ACTIVE_COURSE_KEY = "feeps.activeCourseId";
const TRAINING_TARGET_KEY = "feeps.trainingTarget";
const TRAINEE_TEST_DRAFT_KEY = "feeps.traineeTestDraft";
const TRAINEE_TEST_DRAFT_TTL_MS = 4 * 60 * 60 * 1000;
const TRAINING_TARGET_VIEWS = new Set(["home", "courses", "curriculum", "reports", "attendance", "tests", "materials", "trainees"]);

function safeTargetValue(value, maxLength = 256) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) return "";
  return text;
}

function safeTargetDate(value) {
  const text = String(value || "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return "";
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? text : "";
}

export function getActiveCourseId() {
  try { return window.localStorage.getItem(ACTIVE_COURSE_KEY) || ""; }
  catch { return ""; }
}

export function setActiveCourseId(courseId) {
  try {
    if (courseId) window.localStorage.setItem(ACTIVE_COURSE_KEY, String(courseId));
    else window.localStorage.removeItem(ACTIVE_COURSE_KEY);
  } catch { /* localStorageが利用できない環境では画面内stateだけで継続 */ }
}

export function clearTrainingTargetContext() {
  try { window.sessionStorage.removeItem(TRAINING_TARGET_KEY); }
  catch { /* sessionStorageが利用できない環境では何もしない */ }
}

export function clearTraineeTestDraft(testId = "") {
  try {
    if (testId) {
      const stored = JSON.parse(window.sessionStorage.getItem(TRAINEE_TEST_DRAFT_KEY) || "null");
      if (stored?.testId && stored.testId !== String(testId)) return;
    }
    window.sessionStorage.removeItem(TRAINEE_TEST_DRAFT_KEY);
  } catch { /* sessionStorageが利用できない環境では何もしない */ }
}

export function setTraineeTestDraft({ testId, answers, pendingSubmission } = {}) {
  const safeTestId = safeTargetValue(testId);
  if (!safeTestId) { clearTraineeTestDraft(); return; }
  try {
    window.sessionStorage.setItem(TRAINEE_TEST_DRAFT_KEY, JSON.stringify({
      testId: safeTestId,
      answers: answers && typeof answers === "object" ? answers : {},
      pendingSubmission: pendingSubmission && typeof pendingSubmission === "object" ? pendingSubmission : null,
      authUserId: window.localStorage.getItem("feeps.authUserId") || "",
      createdAt: Date.now(),
    }));
  } catch { /* 容量超過等の場合も画面内stateで受験を継続 */ }
}

export function getTraineeTestDraft(testId = "") {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(TRAINEE_TEST_DRAFT_KEY) || "null");
    const age = Date.now() - Number(stored?.createdAt);
    const currentUserId = window.localStorage.getItem("feeps.authUserId") || "";
    const invalid = !stored?.testId || !Number.isFinite(age) || age < 0 || age > TRAINEE_TEST_DRAFT_TTL_MS
      || (stored.authUserId && currentUserId && stored.authUserId !== currentUserId)
      || (testId && stored.testId !== String(testId));
    if (invalid) {
      if (!testId || stored?.testId === String(testId) || (stored?.authUserId && currentUserId && stored.authUserId !== currentUserId)) clearTraineeTestDraft();
      return null;
    }
    return {
      testId: stored.testId,
      answers: stored.answers && typeof stored.answers === "object" ? stored.answers : {},
      pendingSubmission: stored.pendingSubmission && typeof stored.pendingSubmission === "object" ? stored.pendingSubmission : null,
    };
  } catch {
    clearTraineeTestDraft();
    return null;
  }
}

// Homeなど別画面から研修画面へ移る際の対象と、更新後に復元する選択内容をタブ単位で保持する。
export function setTrainingTargetContext({ view, courseId, testId, date } = {}) {
  const target = {
    view: TRAINING_TARGET_VIEWS.has(view) ? view : "home",
    courseId: safeTargetValue(courseId),
    testId: safeTargetValue(testId),
    date: safeTargetDate(date),
    authUserId: (() => {
      try { return window.localStorage.getItem("feeps.authUserId") || ""; }
      catch { return ""; }
    })(),
    createdAt: Date.now(),
  };
  if (target.courseId) setActiveCourseId(target.courseId);
  try {
    if (!target.courseId && !target.testId && !target.date) window.sessionStorage.removeItem(TRAINING_TARGET_KEY);
    else window.sessionStorage.setItem(TRAINING_TARGET_KEY, JSON.stringify(target));
  }
  catch { /* sessionStorageが利用できない環境では通常の画面遷移だけ継続 */ }
}

export function getTrainingTargetContext(view, { consume = true } = {}) {
  try {
    const raw = window.sessionStorage.getItem(TRAINING_TARGET_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const target = {
      view: TRAINING_TARGET_VIEWS.has(stored?.view) ? stored.view : "home",
      courseId: safeTargetValue(stored?.courseId),
      testId: safeTargetValue(stored?.testId),
      date: safeTargetDate(stored?.date),
      authUserId: safeTargetValue(stored?.authUserId),
      createdAt: Number(stored?.createdAt),
    };
    let currentUserId = "";
    try { currentUserId = window.localStorage.getItem("feeps.authUserId") || ""; }
    catch { /* localStorageが利用できない環境ではsessionStorage内の対象を利用 */ }
    const invalid = !Number.isFinite(target.createdAt)
      || (target.authUserId && currentUserId && target.authUserId !== currentUserId);
    if (invalid) {
      window.sessionStorage.removeItem(TRAINING_TARGET_KEY);
      return null;
    }
    if (view && target.view !== view) return null;
    if (consume) window.sessionStorage.removeItem(TRAINING_TARGET_KEY);
    return target;
  } catch {
    try { window.sessionStorage.removeItem(TRAINING_TARGET_KEY); } catch { /* noop */ }
    return null;
  }
}
