import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { emitNotificationRefresh, todayStr } from "../../training/useTraining.js";
import { getTrainingTargetContext } from "../../../utils/common/courseContext.js";

/* 受講生の勤怠のデータと保存（今の画面 TraineeAttendance と同じ決まり）：
   研修日だけ打刻できる。研修日を確認できない・別の研修と重なる日は保存しない（欠席と判定しない）。
   遅刻・早退・欠勤・中抜けは理由が要る */

export const ATT_STATES = ["出勤", "遅刻", "早退", "欠勤", "中抜け", "休暇"];
export const needsReason = s => ["遅刻", "早退", "欠席", "欠勤", "中抜け"].some(v => String(s || "").includes(v));
// 欠勤・休暇は打刻が無くてよい
export const noClock = s => /欠|休暇|absent|leave/i.test(String(s || ""));
export const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

// 記録の状態（英語の古い値も読む）
export function kindOf(row) {
  const raw = String(row?.status || "").toLowerCase();
  if (raw.includes("欠") || raw.includes("absent")) return "欠勤";
  if (raw.includes("休暇") || raw.includes("leave")) return "休暇";
  if (raw.includes("遅") || raw.includes("late")) return "遅刻";
  if (raw.includes("早") || raw.includes("early")) return "早退";
  if (raw.includes("中抜") || raw.includes("break")) return "中抜け";
  return "出勤";
}

export function useTraineeAttendance() {
  const today = todayStr();
  const [target] = useState(() => getTrainingTargetContext("attendance", { consume: true })?.date || "");
  const [state, setState] = useState("loading");
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [month, setMonth] = useState(() => (target || today).slice(0, 7));
  const [days, setDays] = useState({ state: "loading", byDate: {} });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [key, setKey] = useState(0);
  const reload = useCallback(() => setKey(k => k + 1), []);

  const fetchRows = useCallback(() => apiGet("/attendance/me").then(items => setRows(Array.isArray(items) ? items : [])), []);

  useEffect(() => {
    let alive = true;
    setState("loading"); setErr("");
    Promise.all([apiGet("/attendance/me"), apiGet("/me/courses")])
      .then(([items, cs]) => { if (!alive) return; setRows(Array.isArray(items) ? items : []); setCourses(Array.isArray(cs) ? cs : []); setState("ready"); })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [key]);

  useEffect(() => {
    if (state !== "ready") return undefined;
    const ids = courses.map(c => c.courseId).filter(Boolean);
    if (!ids.length) { setDays({ state: "ready", byDate: {} }); return undefined; }
    let alive = true;
    setDays(d => ({ ...d, state: "loading" }));
    const months = [...new Set([month, today.slice(0, 7)])];
    Promise.all(ids.flatMap(id => months.map(m => apiGet(`/courses/${id}/workdays?month=${m}`).then(result => ({ id, result })))))
      .then(rs => {
        if (!alive) return;
        const byDate = {};
        rs.forEach(({ id, result }) => (result?.days || []).filter(x => x.status === "ready" && x.isTrainingDay === true).forEach(x => {
          (byDate[x.date] ||= []).push({ ...x, courseId: id });
        }));
        setDays({ state: rs.some(({ result }) => result?.status === "setup_required") ? "setup_required" : "ready", byDate });
      })
      .catch(() => { if (alive) setDays({ state: "error", byDate: {} }); });
    return () => { alive = false; };
  }, [state, courses, month, today, key]);

  const byDate = useMemo(() => Object.fromEntries(rows.map(r => [r.date, r])), [rows]);
  const courseFor = useCallback(d => { const c = days.byDate[d] || []; return c.length === 1 ? c[0].courseId : ""; }, [days.byDate]);
  const conflict = useCallback(d => (days.byDate[d] || []).length > 1, [days.byDate]);
  const isDay = useCallback(d => (days.byDate[d] || []).length > 0, [days.byDate]);
  const canSave = useCallback(d => days.state === "ready" && isDay(d) && !conflict(d), [days.state, isDay, conflict]);

  // v = { in, out, status, reason, correctionReason }
  const save = useCallback(async (date, v) => {
    if (!canSave(date) || saving) return false;
    if (!String(v.in || "").trim() && !noClock(v.status)) { setErr("出勤時刻を入力してください"); return false; }
    if (needsReason(v.status) && !String(v.reason || "").trim()) { setErr("理由を入力してください"); return false; }
    const cur = byDate[date];
    setErr(""); setSaving(true);
    try {
      await apiPut("/attendance/me", {
        date, courseId: courseFor(date), clockIn: v.in || "", clockOut: v.out || "", status: v.status || "出勤", reason: v.reason || "",
        correctionReason: v.correctionReason || "", breakPeriods: cur?.breakPeriods || [], ...(cur?.updatedAt ? { expectedUpdatedAt: cur.updatedAt } : {}),
      });
      emitNotificationRefresh();
      // 更新の時刻はサーバーの値を読み直す（次の保存の同時編集の判定に使う）
      await fetchRows().catch(() => {});
      return true;
    } catch (e) {
      setErr(e?.data?.code === "stale_update" ? "別の画面で更新されています。読み直してください" : e?.errorMessage || "保存できませんでした。時刻は確定していません");
      return false;
    } finally { setSaving(false); }
  }, [canSave, saving, byDate, courseFor, fetchRows]);

  return { today, target, state, rows, byDate, courses, month, setMonth, days, courseFor, conflict, isDay, canSave, save, saving, err, setErr, reload };
}
