import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { emitNotificationRefresh, todayStr } from "../../training/useTraining.js";
import { DEFAULT_REPORT_FIELDS } from "../../training/TrainingComponents.jsx";
import { ackKey, ackKeys, hasStaffComment } from "../../training/acks.js";
import { getActiveCourseId, getTrainingTargetContext, setActiveCourseId } from "../../../utils/common/courseContext.js";

/* 受講生の日報のデータと保存（今の画面 TrainingComponents の Reports と同じ決まり）：
   書きかけは自動で仮保存（講師には見えない）し、「提出」で日報になる。空の日は前の日の「明日の目標」を入れておく。
   研修日・項目・既存の日報を確認できないときは、上書きしないよう入力を止める */

const FIXED = new Set(DEFAULT_REPORT_FIELDS.map(f => f.id));
export const fieldValue = (d, id) => (FIXED.has(id) ? d?.[id] || "" : d?.customFields?.[id] || "");
const blank = () => ({ morningGoal: "", goalItems: [], learned: "", question: "", nextday: "", reflection: "", blockers: "", tomorrowGoal: "", customFields: {} });
const toDraft = r => ({
  morningGoal: r?.morningGoal || "", goalItems: Array.isArray(r?.goalItems) ? r.goalItems.map(g => ({ id: g.id, text: g.text || "", done: !!g.done })) : [],
  learned: r?.learned || "", question: r?.question || "", nextday: r?.nextday || "", reflection: r?.reflection || "",
  blockers: r?.blockers || "", tomorrowGoal: r?.tomorrowGoal || "", customFields: { ...(r?.customFields || {}) },
});
const ROLE_NAME = { instructor: "講師", admin: "管理者", client: "企業" };

// コメント（講師・企業）と本人の返事を時間の順に
export function threadOf(r) {
  if (!r) return [];
  const out = [];
  if (r.comment) out.push({ id: "legacy", who: "講師", role: "instructor", text: r.comment, at: r.commentedAt || "" });
  (Array.isArray(r.comments) ? r.comments : []).forEach((c, i) => {
    const text = String(c?.text ?? c?.comment ?? "").trim();
    if (!text) return;
    const role = String(c?.authorRole || "instructor").toLowerCase();
    out.push({ id: c.commentId || `c${i}`, who: c.authorName || c.authorTitle || ROLE_NAME[role] || "講師", role, label: c.authorTitle || ROLE_NAME[role] || "講師", text, at: c.createdAt || "" });
  });
  (Array.isArray(r.replies) ? r.replies : []).forEach((c, i) => out.push({ id: c.replyId || `r${i}`, who: "自分", role: "me", text: c.text, at: c.createdAt || "" }));
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

export function useTraineeReport() {
  const today = todayStr();
  const [target] = useState(() => getTrainingTargetContext("reports", { consume: true }));
  const [state, setState] = useState("loading");
  const [reports, setReports] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(() => target?.courseId || getActiveCourseId() || "");
  const [drafts, setDrafts] = useState({});
  const [date, setDate] = useState(() => target?.date || today);
  const [draft, setDraft] = useState(blank);
  const [prefill, setPrefill] = useState(null);
  const [fields, setFields] = useState(DEFAULT_REPORT_FIELDS);
  const [fieldsState, setFieldsState] = useState("loading");
  const [month, setMonth] = useState(() => (target?.date || today).slice(0, 7));
  const [days, setDays] = useState({ state: "loading", dates: [], conflicts: [] });
  const [autoSave, setAutoSave] = useState({ state: "", at: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [key, setKey] = useState(0);
  const reload = useCallback(() => setKey(k => k + 1), []);

  const lastSaved = useRef("");
  const pending = useRef(null);
  const timer = useRef(0);
  const job = useRef(null);

  const open = useCallback((d, list, map) => {
    const rep = list.find(r => r.date === d), saved = map[d];
    let next, pre = null;
    if (saved) next = toDraft(saved);
    else if (rep) next = toDraft(rep);
    else {
      next = blank();
      const prev = list.filter(r => r.date < d && String(r.tomorrowGoal || "").trim()).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (prev) { pre = prev.date; next.morningGoal = String(prev.tomorrowGoal).trim(); }
    }
    setPrefill(pre);
    lastSaved.current = JSON.stringify(next);
    setDraft(next);
    setAutoSave({ state: "", at: saved?.updatedAt || "" });
    setDate(d);
  }, []);

  const flush = useCallback(() => {
    const p = pending.current; pending.current = null; clearTimeout(timer.current);
    if (!p) return job.current || Promise.resolve();
    setAutoSave(a => ({ ...a, state: "saving" }));
    const run = (job.current || Promise.resolve()).catch(() => {})
      .then(() => apiPut("/reports/me/draft", { date: p.date, courseId: p.courseId, ...p.data }))
      .then(res => {
        lastSaved.current = JSON.stringify(p.data);
        setDrafts(cur => ({ ...cur, [p.date]: { ...p.data, date: p.date, updatedAt: res?.updatedAt || "" } }));
        setAutoSave({ state: "saved", at: res?.updatedAt || "" });
      })
      .catch(() => setAutoSave(a => ({ ...a, state: "error" })));
    job.current = run;
    return run;
  }, []);

  useEffect(() => {
    let alive = true;
    setState("loading"); setErr("");
    Promise.all([apiGet("/reports/me"), apiGet("/me/courses"), apiGet("/reports/me/drafts").catch(() => [])])
      .then(([items, cs, ds]) => {
        if (!alive) return;
        const list = Array.isArray(items) ? items : [], courseList = Array.isArray(cs) ? cs : [];
        const map = Object.fromEntries((Array.isArray(ds) ? ds : []).filter(x => x?.date).map(x => [x.date, x]));
        setReports(list); setCourses(courseList); setDrafts(map);
        setCourseId(cur => { const id = courseList.some(c => c.courseId === cur) ? cur : courseList[0]?.courseId || ""; if (id) setActiveCourseId(id); return id; });
        open(target?.date || today, list, map);
        setState("ready");
      })
      .catch(() => { if (alive) { setState("error"); setErr("既存の日報または所属コースを確認できません。上書きしないよう入力を止めています。"); } });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!courseId) { setFields(DEFAULT_REPORT_FIELDS); setFieldsState("ready"); return undefined; }
    let alive = true;
    setFieldsState("loading");
    apiGet(`/courses/${courseId}/report-settings`)
      .then(r => { if (alive) { setFields(Array.isArray(r?.fields) && r.fields.length ? r.fields : DEFAULT_REPORT_FIELDS); setFieldsState("ready"); } })
      .catch(() => { if (alive) setFieldsState("error"); });
    return () => { alive = false; };
  }, [courseId, key]);

  // 研修日：開いている日の月と、一覧で見ている月。別のコースと重なる日は保存できない
  useEffect(() => {
    if (!courseId || !courses.length) { setDays({ state: courses.length ? "loading" : "ready", dates: [], conflicts: [] }); return undefined; }
    let alive = true;
    const months = [...new Set([month, date.slice(0, 7)])];
    const ids = [...new Set(courses.map(c => c.courseId).filter(Boolean))];
    setDays(d => ({ ...d, state: "loading" }));
    Promise.all(ids.flatMap(id => months.map(m => apiGet(`/courses/${id}/workdays?month=${m}`).then(result => ({ id, result })))))
      .then(rs => {
        if (!alive) return;
        const by = {}, mine = new Set();
        rs.forEach(({ id, result }) => (result?.days || []).filter(x => x.status === "ready" && x.isTrainingDay === true).forEach(x => {
          (by[x.date] ||= new Set()).add(id);
          if (id === courseId) mine.add(x.date);
        }));
        setDays({
          state: rs.some(({ result }) => result?.status === "setup_required") ? "setup_required" : "ready",
          dates: [...mine].sort(),
          conflicts: Object.entries(by).filter(([, s]) => s.size > 1).map(([d]) => d),
        });
      })
      .catch(() => { if (alive) setDays({ state: "error", dates: [], conflicts: [] }); });
    return () => { alive = false; };
  }, [courseId, courses, month, date, key]);

  const dateSet = useMemo(() => new Set(days.dates), [days.dates]);
  const conflict = days.conflicts.includes(date);
  const isDay = dateSet.has(date);
  const canEdit = state === "ready" && fieldsState === "ready" && days.state === "ready" && isDay && !conflict && !saving;

  // 自動の仮保存（1.5 秒止まったら）
  useEffect(() => {
    if (!canEdit) return;
    if (JSON.stringify(draft) === lastSaved.current) return;
    pending.current = { date, courseId, data: draft };
    clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 1500);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (pending.current) flush(); clearTimeout(timer.current); }, [flush]);

  const report = reports.find(r => r.date === date) || null;

  // コメントのある日報を開いたら「確認した」にする（通知から消える）
  useEffect(() => {
    if (report && hasStaffComment(report)) ackKeys(ackKey.reportComment(report)).catch(() => {});
  }, [report]);

  const goDate = useCallback(async d => {
    setErr("");
    if (pending.current) await flush();
    open(d, reports, drafts);
  }, [flush, open, reports, drafts]);

  const changeCourse = useCallback(id => { setCourseId(id); setActiveCourseId(id); }, []);

  const insertNote = useCallback((fieldId, text) => {
    if (!fieldId || !text) return;
    setDraft(cur => {
      const prev = fieldValue(cur, fieldId), next = prev.trim() ? `${prev.replace(/\s+$/, "")}\n${text}` : text;
      return FIXED.has(fieldId) ? { ...cur, [fieldId]: next } : { ...cur, customFields: { ...cur.customFields, [fieldId]: next } };
    });
  }, []);

  const setField = useCallback((id, v) => setDraft(cur => (FIXED.has(id) ? { ...cur, [id]: v } : { ...cur, customFields: { ...cur.customFields, [id]: v } })), []);

  const submit = useCallback(async () => {
    if (!canEdit) return false;
    const hasAny = draft.morningGoal.trim() || draft.goalItems.some(g => g.text.trim()) || fields.some(f => String(fieldValue(draft, f.id)).trim());
    if (!hasAny) { setErr("内容を入力してください"); return false; }
    const missing = fields.find(f => f.required && !String(fieldValue(draft, f.id)).trim());
    if (missing) { setErr(`「${missing.label}」を入力してください`); return false; }
    const payload = { date, courseId, ...draft, goalItems: draft.goalItems.filter(g => g.text.trim()) };
    pending.current = null; clearTimeout(timer.current);
    setErr(""); setSaving(true);
    try {
      await (job.current || Promise.resolve()).catch(() => {});
      const res = await apiPut("/reports/me", { ...payload, expectedUpdatedAt: report?.updatedAt || "" });
      emitNotificationRefresh();
      const saved = { ...(report || {}), ...payload, updatedAt: res?.updatedAt || new Date().toISOString() };
      setReports(cur => (cur.some(r => r.date === date) ? cur.map(r => (r.date === date ? saved : r)) : [saved, ...cur]));
      setDrafts(cur => { const n = { ...cur }; delete n[date]; return n; });
      const nextDraft = toDraft(saved);
      lastSaved.current = JSON.stringify(nextDraft);
      setDraft(nextDraft); setPrefill(null); setAutoSave({ state: "", at: "" });
      return true;
    } catch (e) {
      setErr(e?.data?.code === "stale_update" ? "別の画面で更新されています。読み直してください" : e?.errorMessage || "提出できませんでした");
      return false;
    } finally { setSaving(false); }
  }, [canEdit, draft, fields, date, courseId, report]);

  const sendReply = useCallback(async (text, day = date) => {
    const res = await apiPut("/reports/me/reply", { date: day, text });
    setReports(cur => cur.map(r => (r.date === day ? { ...r, replies: [...(r.replies || []), res.reply] } : r)));
  }, [date]);

  return {
    today, state, err, setErr, reports, courses, courseId, changeCourse, drafts, date, goDate, draft, setDraft, setField, prefill,
    fields, fieldsState, month, setMonth, days, dateSet, conflict, isDay, canEdit, autoSave, saving, report, submit, sendReply, insertNote, reload,
  };
}
