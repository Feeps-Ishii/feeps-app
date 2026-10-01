const ACTIVE_COURSE_KEY = "feeps.activeCourseId";
const TRAINING_TARGET_KEY = "feeps.trainingTarget";
const TRAINEE_TEST_DRAFT_KEY = "feeps.traineeTestDraft";
export const TRAINING_TARGET_CHANGE_EVENT = "feeps:training-target-change";
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

function emitTrainingTargetChange(target, historyAction = "replace") {
  try { window.dispatchEvent(new CustomEvent(TRAINING_TARGET_CHANGE_EVENT, { detail: { target, historyAction } })); }
  catch { /* CustomEvent非対応環境では履歴同期を省略 */ }
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
  try {
    window.sessionStorage.removeItem(TRAINING_TARGET_KEY);
    emitTrainingTargetChange(null);
  }
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

export function setTraineeTestDraft({ testId, answers, pendingSubmission, result } = {}) {
  const safeTestId = safeTargetValue(testId);
  if (!safeTestId) { clearTraineeTestDraft(); return; }
  try {
    window.sessionStorage.setItem(TRAINEE_TEST_DRAFT_KEY, JSON.stringify({
      testId: safeTestId,
      answers: answers && typeof answers === "object" ? answers : {},
      pendingSubmission: pendingSubmission && typeof pendingSubmission === "object" ? pendingSubmission : null,
      result: result && typeof result === "object" ? result : null,
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
      result: stored.result && typeof stored.result === "object" ? stored.result : null,
    };
  } catch {
    clearTraineeTestDraft();
    return null;
  }
}

// Homeなど別画面から研修画面へ移る際の対象と、更新後に復元する選択内容をタブ単位で保持する。
export function setTrainingTargetContext({ view, courseId, testId, date, mode, materialId, page } = {}, { historyAction = "replace" } = {}) {
  const pageNumber = Math.floor(Number(page));
  const target = {
    view: TRAINING_TARGET_VIEWS.has(view) ? view : "home",
    courseId: safeTargetValue(courseId),
    testId: safeTargetValue(testId),
    date: safeTargetDate(date),
    mode: ["taking", "result"].includes(mode) ? mode : "",
    // 「テストの解説から、教材の該当ページへ飛ぶ」ための行き先（2026-09-16 打合せ）
    materialId: safeTargetValue(materialId),
    page: Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= 5000 ? pageNumber : 0,
    authUserId: (() => {
      try { return window.localStorage.getItem("feeps.authUserId") || ""; }
      catch { return ""; }
    })(),
    createdAt: Date.now(),
  };
  if (target.courseId) setActiveCourseId(target.courseId);
  try {
    if (!target.courseId && !target.testId && !target.date && !target.materialId) {
      window.sessionStorage.removeItem(TRAINING_TARGET_KEY);
      emitTrainingTargetChange(null, historyAction);
    } else {
      window.sessionStorage.setItem(TRAINING_TARGET_KEY, JSON.stringify(target));
      emitTrainingTargetChange(target, historyAction);
    }
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
      mode: ["taking", "result"].includes(stored?.mode) ? stored.mode : "",
      // 教材の該当ページへ戻る行き先（2026-09-16）。壊れた値は0にして「指定なし」と同じ扱いにする
      materialId: safeTargetValue(stored?.materialId),
      page: (() => {
        const n = Math.floor(Number(stored?.page));
        return Number.isInteger(n) && n >= 1 && n <= 5000 ? n : 0;
      })(),
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

/* 研修資料で開くフォルダ（2026-09-30）。カリキュラムのフォルダのカードから研修資料へ移るときに使う。
   { courseId, nodeId } … nodeId はコースの置き場のフォルダかショートカット。1回読んだら消す */
const LIBRARY_TARGET_KEY = "feeps.libraryTarget";
export function setLibraryTarget({ courseId, nodeId } = {}) {
  const c = safeTargetValue(courseId), n = safeTargetValue(nodeId);
  try {
    if (c && n) window.sessionStorage.setItem(LIBRARY_TARGET_KEY, JSON.stringify({ courseId: c, nodeId: n }));
    else window.sessionStorage.removeItem(LIBRARY_TARGET_KEY);
  } catch { /* sessionStorageが使えない環境では研修資料の先頭を開く */ }
}
// remove=false は読むだけ（開けたあとで setLibraryTarget({}) で消す。読み込みが2回走っても取りこぼさない）
export function takeLibraryTarget(remove = true) {
  try {
    const raw = window.sessionStorage.getItem(LIBRARY_TARGET_KEY);
    if (remove) window.sessionStorage.removeItem(LIBRARY_TARGET_KEY);
    const t = raw ? JSON.parse(raw) : null;
    const c = safeTargetValue(t?.courseId), n = safeTargetValue(t?.nodeId);
    return c && n ? { courseId: c, nodeId: n } : null;
  } catch { return null; }
}

/* カリキュラムとテストの行き来（2026-10-01）。
   テストへ：{ courseId, scopeId, title, mode: "ai"|"manual" }（単元で作る）／{ courseId, testId, results }（なおす・結果）
   カリキュラムへ戻る：{ courseId, unitKey }（テストを閉じたら元の単元を開く）。どちらも読むだけにして、使ったあとで {} で消す */
const TEST_BUILD_TARGET_KEY = "feeps.testBuildTarget";
export function setTestBuildTarget({ courseId, scopeId, title, mode, testId, results } = {}) {
  const t = { courseId: safeTargetValue(courseId), scopeId: safeTargetValue(scopeId), title: safeTargetValue(title, 200), mode: mode === "ai" ? "ai" : "manual", testId: safeTargetValue(testId), results: !!results };
  try {
    if (t.courseId && (t.scopeId || t.testId)) window.sessionStorage.setItem(TEST_BUILD_TARGET_KEY, JSON.stringify(t));
    else window.sessionStorage.removeItem(TEST_BUILD_TARGET_KEY);
  } catch { /* sessionStorageが使えない環境ではテストの一覧を開く */ }
}
export function takeTestBuildTarget(remove = true) {
  try {
    const raw = window.sessionStorage.getItem(TEST_BUILD_TARGET_KEY);
    if (remove) window.sessionStorage.removeItem(TEST_BUILD_TARGET_KEY);
    const t = raw ? JSON.parse(raw) : null;
    const courseId = safeTargetValue(t?.courseId), scopeId = safeTargetValue(t?.scopeId), testId = safeTargetValue(t?.testId);
    if (!courseId || !(scopeId || testId)) return null;
    return { courseId, scopeId, testId, title: safeTargetValue(t?.title, 200), mode: t?.mode === "ai" ? "ai" : "manual", results: !!t?.results };
  } catch { return null; }
}
const CURRICULUM_RETURN_KEY = "feeps.curriculumReturn";
export function setCurriculumReturn({ courseId, unitKey } = {}) {
  const c = safeTargetValue(courseId), k = safeTargetValue(unitKey, 64);
  try {
    if (c && k) window.sessionStorage.setItem(CURRICULUM_RETURN_KEY, JSON.stringify({ courseId: c, unitKey: k }));
    else window.sessionStorage.removeItem(CURRICULUM_RETURN_KEY);
  } catch { /* sessionStorageが使えない環境では今日の単元を開く */ }
}
export function takeCurriculumReturn(remove = true) {
  try {
    const raw = window.sessionStorage.getItem(CURRICULUM_RETURN_KEY);
    if (remove) window.sessionStorage.removeItem(CURRICULUM_RETURN_KEY);
    const t = raw ? JSON.parse(raw) : null;
    const c = safeTargetValue(t?.courseId), k = safeTargetValue(t?.unitKey, 64);
    return c && k ? { courseId: c, unitKey: k } : null;
  } catch { return null; }
}

/* テストの一覧で目立たせるテスト（2026-10-01）。カリキュラムの確認テストから一覧へ移るときに使う。
   テストはテストの一覧で選んで受ける（ユーザー指定）。読むだけにして、使ったあとで {} で消す */
const TEST_FOCUS_KEY = "feeps.testFocus";
export function setTestFocus({ courseId, testId } = {}) {
  const c = safeTargetValue(courseId), t = safeTargetValue(testId);
  if (c) setActiveCourseId(c);
  try {
    if (t) window.sessionStorage.setItem(TEST_FOCUS_KEY, JSON.stringify({ courseId: c, testId: t }));
    else window.sessionStorage.removeItem(TEST_FOCUS_KEY);
  } catch { /* sessionStorageが使えない環境では一覧の先頭を出す */ }
}
export function takeTestFocus(remove = true) {
  try {
    const raw = window.sessionStorage.getItem(TEST_FOCUS_KEY);
    if (remove) window.sessionStorage.removeItem(TEST_FOCUS_KEY);
    const t = raw ? JSON.parse(raw) : null;
    const testId = safeTargetValue(t?.testId);
    return testId ? { courseId: safeTargetValue(t?.courseId), testId } : null;
  } catch { return null; }
}
