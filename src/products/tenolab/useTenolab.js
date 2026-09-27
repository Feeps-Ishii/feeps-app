import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPut } from "../../api.js";
import { SAMPLE_COURSE, SAMPLE_UNITS, sampleUnit } from "./samples/dashSample.js";

// テノラボの学習記録（自分の分）。正本は API（DynamoDB）。取得に失敗したら "error" のまま出し、
// 0件として扱わない（進み具合がゼロに見えると、続きから始められなくなるため）。
export function useTenolabProgress(enabled) {
  const [state, setState] = useState(enabled ? "loading" : "off"); // off | loading | ready | error
  const [items, setItems] = useState([]);

  const reload = useCallback(async () => {
    if (!enabled) { setState("off"); setItems([]); return; }
    setState("loading");
    try {
      const res = await apiGet("/tenolab/progress");
      setItems(Array.isArray(res?.items) ? res.items : []);
      setState("ready");
    } catch (e) {
      console.warn("tenolab progress load failed", e);
      setState("error");
    }
  }, [enabled]);

  useEffect(() => { reload(); }, [reload]);

  // 1単元ぶんを保存する。失敗は呼び出し側へそのまま投げる（画面で知らせるため）
  const save = useCallback(async (courseId, unitId, data) => {
    const res = await apiPut(`/tenolab/progress/${courseId}/${unitId}`, data);
    const item = res?.item;
    if (item) {
      setItems(prev => {
        const rest = prev.filter(x => !(x.courseId === item.courseId && x.unitId === item.unitId));
        return [...rest, item];
      });
    }
    return item;
  }, []);

  return { state, items, reload, save };
}

/* コースの中身（公開中の単元の要約つき）。API にまだ無いコース（見本を取り込む前）は、
   同梱の見本を使う。404 以外の失敗は "error" のまま出す。 */
export function useTenolabCourse(courseId, enabled, { draft = false } = {}) {
  const [st, setSt] = useState({ state: enabled ? "loading" : "off", course: null, units: [], source: null });

  const reload = useCallback(async () => {
    if (!enabled || !courseId) { setSt({ state: "off", course: null, units: [], source: null }); return; }
    setSt(s => ({ ...s, state: "loading" }));
    try {
      const res = await apiGet(`/tenolab/courses/${courseId}${draft ? "?draft=1" : ""}`);
      setSt({ state: "ready", course: res.course, units: res.units || [], source: "api" });
    } catch (e) {
      if (e?.status === 404 && SAMPLE_COURSE.courseId === courseId) {
        setSt({ state: "ready", course: SAMPLE_COURSE, units: Object.values(SAMPLE_UNITS[courseId] || {}), source: "sample" });
        return;
      }
      if (e?.status === 404) { setSt({ state: "missing", course: null, units: [], source: null }); return; }
      console.warn("tenolab course load failed", e);
      setSt(s => ({ ...s, state: "error" }));
    }
  }, [courseId, enabled, draft]);

  useEffect(() => { reload(); }, [reload]);
  return { ...st, reload };
}

/* 単元の中身。draft=true は講師の下書き（受講生として試す）。
   おためし（ログインなし）は API を読めないので、同梱の見本だけを使う。 */
export function useTenolabUnit(courseId, unitId, { trial = false, draft = false } = {}) {
  const [st, setSt] = useState({ state: "loading", unit: null });

  const reload = useCallback(async () => {
    const sample = sampleUnit(courseId, unitId);
    if (trial) { setSt(sample ? { state: "ready", unit: sample } : { state: "missing", unit: null }); return; }
    setSt({ state: "loading", unit: null });
    try {
      const res = await apiGet(`/tenolab/courses/${courseId}/units/${unitId}${draft ? "?draft=1" : ""}`);
      setSt({ state: "ready", unit: res.unit });
    } catch (e) {
      if (e?.status === 404) { setSt(sample && !draft ? { state: "ready", unit: sample } : { state: "missing", unit: null }); return; }
      console.warn("tenolab unit load failed", e);
      setSt({ state: "error", unit: null });
    }
  }, [courseId, unitId, trial, draft]);

  useEffect(() => { reload(); }, [reload]);
  return { ...st, reload };
}

/* 見出し用：コースの中での単元の番号と章 */
export function unitMeta(course, unitId) {
  const chapters = course?.chapters || [];
  const all = chapters.flatMap(c => c.units);
  const ch = chapters.find(c => c.units.includes(unitId));
  const i = all.indexOf(unitId);
  return {
    courseId: course?.courseId,
    courseTitle: course?.title || "",
    unitNo: i >= 0 ? i + 1 : null,
    unitTotal: all.length || null,
    chapter: ch ? `第${ch.no}章 ${ch.title}` : "",
  };
}
