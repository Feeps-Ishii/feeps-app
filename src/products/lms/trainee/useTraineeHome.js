import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../../../api.js";
import { todayStr } from "../../training/useTraining.js";
import { getActiveCourseId } from "../../../utils/common/courseContext.js";

/* 受講生のホームのデータ。取れなかったものは null（0 件・未提出と混ぜない） */
export function useTraineeHome() {
  const today = todayStr();
  const [data, setData] = useState({ state: "loading" });
  const [key, setKey] = useState(0);
  const reload = useCallback(() => setKey(k => k + 1), []);

  useEffect(() => {
    let alive = true;
    setData(d => ({ ...d, state: d.dash ? "ready" : "loading" }));
    Promise.allSettled([
      apiGet(`/dashboard/trainee?date=${today}`),
      apiGet("/reports/me"),
      apiGet("/announcements/me"),
    ]).then(async ([dashR, repR, annR]) => {
      const dash = dashR.status === "fulfilled" ? dashR.value : null;
      const reports = repR.status === "fulfilled" && Array.isArray(repR.value) ? repR.value : null;
      const anns = annR.status === "fulfilled" && Array.isArray(annR.value?.items) ? annR.value.items : null;
      const courses = Array.isArray(dash?.activeCourses) ? dash.activeCourses : [];
      const schedCourse = dash?.todayCompletion?.schedule?.courseId;
      const course = courses.find(c => c.courseId === schedCourse) || courses.find(c => c.courseId === getActiveCourseId()) || courses[0] || null;
      let devs = null, practice = [];
      if (course?.courseId) {
        devs = await apiGet(`/dev-assignments?courseId=${encodeURIComponent(course.courseId)}`)
          .then(r => (Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : []))
          .catch(() => null);
        practice = await apiGet(`/practice?courseId=${encodeURIComponent(course.courseId)}`).then(r => (Array.isArray(r?.items) ? r.items : [])).catch(() => []);
      }
      if (!alive) return;
      setData({
        state: dash ? "ready" : "error",
        today, dash, course, devs, practice, anns,
        reportToday: reports ? reports.find(r => r.date === today) || null : undefined,
      });
    });
    return () => { alive = false; };
  }, [today, key]);

  return { ...data, reload };
}
