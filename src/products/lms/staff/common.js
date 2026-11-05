import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { getActiveCourseId, setActiveCourseId } from "../../../utils/common/courseContext.js";

/* 講師・コース担当者・企業担当者・管理者で共通の土台（コース・名簿・研修日・担当の印）。取れなかったものは 0 件にしない */

export const arr = v => (Array.isArray(v) ? v : []);
export const pad2 = n => String(n).padStart(2, "0");
export const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const md = v => { const s = String(v || ""); return s.length >= 10 ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : ""; };
export const wd = v => "日月火水木金土"[new Date(`${String(v).slice(0, 10)}T00:00:00`).getDay()];
export const dayLabel = v => `${md(v)} ${wd(v)}`;
export const hm = s => { const d = new Date(s || ""); return Number.isNaN(d.getTime()) ? "" : `${d.getHours()}:${pad2(d.getMinutes())}`; };
export const errText = (e, fb) => e?.errorMessage || e?.message || fb;

// 見られるコース（講師は担当・企業担当は自社の受講生がいるコース・管理者は全部）
export function useStaffCourse() {
  const [st, setSt] = useState({ state: "loading", courses: [], course: null });
  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    apiGet("/completion-report/courses").then(d => {
      if (!alive) return;
      const courses = arr(d?.courses);
      const course = courses.find(c => c.courseId === getActiveCourseId()) || courses[0] || null;
      if (course) setActiveCourseId(course.courseId);
      setSt({ state: "ready", courses, course });
    }).catch(() => { if (alive) setSt({ state: "error", courses: [], course: null }); });
    return () => { alive = false; };
  }, [key]);
  return { ...st, reload: () => setKey(k => k + 1) };
}

// 名簿 [{ id, name, kana }]。null は取れなかった
export function useRoster(courseId) {
  const [list, setList] = useState(undefined);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!courseId) { setList(undefined); return undefined; }
    let alive = true;
    apiGet(`/courses/${encodeURIComponent(courseId)}/trainees`)
      .then(l => { if (alive) setList(arr(l).map(p => ({ ...p, id: p.userId || p.id, name: p.name || "名前未設定", kana: p.nameKana || p.kana || "" })).sort((a, b) => (a.kana || a.name).localeCompare(b.kana || b.name, "ja"))); })
      .catch(() => { if (alive) setList(null); });
    return () => { alive = false; };
  }, [courseId, key]);
  return { list, reload: () => setKey(k => k + 1) };
}

// 集計（出席率・日報・テスト）。state: loading | ready | error
export function useStats(courseId) {
  const [st, setSt] = useState({ state: "loading", data: null });
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!courseId) { setSt({ state: "loading", data: null }); return undefined; }
    let alive = true;
    apiGet(`/completion-report/stats?courseId=${encodeURIComponent(courseId)}`)
      .then(data => { if (alive) setSt({ state: "ready", data }); })
      .catch(() => { if (alive) setSt({ state: "error", data: null }); });
    return () => { alive = false; };
  }, [courseId, key]);
  return { ...st, reload: () => setKey(k => k + 1) };
}

// その月の研修日。dates は今日までの分も含めた全部
export function useWorkdays(courseId, month) {
  const [st, setSt] = useState({ state: "loading", dates: [] });
  useEffect(() => {
    if (!courseId) return undefined;
    let alive = true;
    setSt({ state: "loading", dates: [] });
    apiGet(`/courses/${encodeURIComponent(courseId)}/workdays?month=${month}`)
      .then(r => { if (alive) setSt({ state: r?.status === "setup_required" ? "setup_required" : "ready", dates: arr(r?.days).filter(x => x.status === "ready" && x.isTrainingDay === true).map(x => x.date).sort() }); })
      .catch(() => { if (alive) setSt({ state: "error", dates: [] }); });
    return () => { alive = false; };
  }, [courseId, month]);
  return st;
}

// 担当の受講生の印。押したら先に画面を変え、失敗したら戻す
export function usePins(enabled = true) {
  const [ids, setIds] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (!enabled) { setIds([]); return undefined; }
    let alive = true;
    apiGet("/me/pinned-trainees").then(r => { if (alive) { ref.current = arr(r?.traineeIds); setIds(ref.current); } }).catch(() => { if (alive) setIds([]); });
    return () => { alive = false; };
  }, [enabled]);
  const set = useMemo(() => new Set(ids || []), [ids]);
  const toggle = useCallback(async (id, onFail) => {
    const prev = ref.current || [], next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    ref.current = next; setIds(next);
    try { await apiPut("/me/pinned-trainees", { traineeIds: next }); }
    catch { ref.current = prev; setIds(prev); onFail?.(); }
  }, []);
  return { pins: set, toggle, ready: ids != null };
}

// 指定の日へ飛ぶ（カルテ・ホームから日報を開くとき。1 回だけ読む）
const FOCUS_KEY = "lms.staffFocus";
export const setStaffFocus = v => { try { sessionStorage.setItem(FOCUS_KEY, JSON.stringify(v)); } catch { /* 開くだけなので無くてもよい */ } };
export const takeStaffFocus = kind => { try { const v = JSON.parse(sessionStorage.getItem(FOCUS_KEY) || "null"); if (v?.kind === kind) { sessionStorage.removeItem(FOCUS_KEY); return v; } return null; } catch { return null; } };

// Excel で受け取る（rows は 1 行目が見出しの配列の配列）
export async function saveXlsx(name, sheet, rows) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet.slice(0, 31));
  XLSX.writeFile(wb, `${name}.xlsx`);
}

// 名前を写す
export const copyText = t => navigator.clipboard?.writeText(t);

// 研修日を 1 つ前後へ（研修日が取れないときは土日を飛ばす）
export function stepDate(date, n, dates) {
  if (dates.length) {
    const all = dates.includes(date) ? dates : [...dates, date].sort();
    const i = all.indexOf(date) + n;
    return all[i] || date;
  }
  const d = new Date(`${date}T00:00:00`);
  do { d.setDate(d.getDate() + n); } while (d.getDay() === 0 || d.getDay() === 6);
  return ymd(d);
}

// 圧縮しない zip（書類をまとめて受け取る）。名前は UTF-8
const CRC = Array.from({ length: 256 }, (_, i) => { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export function zipStore(files) {
  const enc = new TextEncoder(), parts = [], dir = [];
  let off = 0;
  const head = (sig, f, extra) => { const u = new Uint8Array(extra), v = new DataView(u.buffer); v.setUint32(0, sig, true); return [u, v]; };
  files.forEach(f => {
    const name = enc.encode(f.name), crc = crc32(f.data), [u, v] = head(0x04034b50, f, 30);
    v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint32(14, crc, true); v.setUint32(18, f.data.length, true); v.setUint32(22, f.data.length, true); v.setUint16(26, name.length, true);
    parts.push(u, name, f.data);
    const [c, w] = head(0x02014b50, f, 46);
    w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(8, 0x0800, true); w.setUint32(16, crc, true); w.setUint32(20, f.data.length, true); w.setUint32(24, f.data.length, true); w.setUint16(28, name.length, true); w.setUint32(42, off, true);
    dir.push(c, name);
    off += u.length + name.length + f.data.length;
  });
  const size = dir.reduce((a, x) => a + x.length, 0), [e, x] = head(0x06054b50, null, 22);
  x.setUint16(8, files.length, true); x.setUint16(10, files.length, true); x.setUint32(12, size, true); x.setUint32(16, off, true);
  return new Blob([...parts, ...dir, e], { type: "application/zip" });
}
export function saveBlob(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 5000); }
