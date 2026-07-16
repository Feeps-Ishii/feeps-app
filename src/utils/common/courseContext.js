const ACTIVE_COURSE_KEY = "feeps.activeCourseId";

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
