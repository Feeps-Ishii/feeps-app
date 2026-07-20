import React, { useEffect, useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { apiGet, apiPut, apiPost } from "../../api.js";
import {
  Card, Badge, Btn, Avatar, Stat, SectionHead, Field, Modal, T, PageHeader, ProductNavCard, SkeletonRows, SkeletonCards,
  PRISM, PrismPage, PrismCard, PrismHomeHeading, PrismKpiCard, PrismSectionTitle, PrismErrorRetryCard,
  TraineeBulkImportPanel,
} from "../../components/common";
import { EmptyState } from "../training/TrainingComponents.jsx";
import { statusKind, todayStr } from "../training/useTraining.js";
import { getActiveCourseId, setActiveCourseId } from "../../utils/common/courseContext.js";
import {
  ClipboardCheck, Clock, NotebookPen, Users,
  Building2, BookOpen, GraduationCap, Search,
  AlertCircle, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Trash2, X,
  Plus, Calendar,
  Pencil, StickyNote,
  Check, Filter, Mail,
  ShieldCheck, FileSpreadsheet,
  User
} from "lucide-react";

async function exportAdminListExcel(rows, columns, sheetName, fileLabel) {
  try {
    const XLSX = await import("xlsx");
    const data = (rows || []).map(r => Object.fromEntries(columns.map(([key, label]) => [label, key(r)])));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = columns.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(wb, `${fileLabel}_${stamp}.xlsx`);
  } catch (e) { console.error(e); }
}
const monthStr = () => todayStr().slice(0, 7);
const datesInMonth = (ym) => {
  if (!ym) return [];
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return [];
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => ym + "-" + String(i + 1).padStart(2, "0"));
};
function AdminHome({ go, openRisk }) {
  const [date, setDate] = useState(todayStr());
  const [companies, setCompanies] = useState([]);
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [courseMap, setCourseMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const labelKind = (k) => (k === "regular" ? "定常" : k === "elearning" ? "Eラーニング" : k === "support" ? "継続支援" : "新人研修");
  useEffect(() => {
    let alive = true;
    setLoading(true); setErr("");
    Promise.all([apiGet("/companies"), apiGet("/courses"), apiGet("/admin/users")])
      .then(async ([cs, crs, us]) => {
        if (!alive) return;
        const courseList = crs || [];
        const pairs = await Promise.all(courseList.map(c => apiGet(`/courses/${c.courseId}/trainees`).then(t => [c.courseId, t || []]).catch(() => [c.courseId, []])));
        if (!alive) return;
        setCompanies(cs || []);
        setCourses(courseList);
        setUsers(us || []);
        setCourseMap(Object.fromEntries(pairs));
      })
      .catch(e => alive && setErr("運用データの取得に失敗しました：" + (e?.message || e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    apiGet("/reports?date=" + date).then(r => setReports(r || [])).catch(e => { console.warn("admin reports failed", e); setErr("日報の取得に失敗しました：" + (e?.message || e)); });
    apiGet("/attendance?date=" + date).then(r => setAttendance(r || [])).catch(e => { console.warn("admin attendance failed", e); setAttendance([]); });
  }, [date]);
  const trainees = users.filter(u => u.role === "trainee");
  const reportIds = new Set(reports.map(r => r.traineeId));
  const attendanceIds = new Set(attendance.map(r => r.traineeId));
  const traineeIds = new Set(trainees.map(t => t.userId));
  const reportSubmitted = trainees.filter(t => reportIds.has(t.userId)).length;
  const attendanceRegistered = trainees.filter(t => attendanceIds.has(t.userId)).length;
  const absentCount = attendance.filter(a => traineeIds.has(a.traineeId) && statusKind(a.status) === "absent").length;
  const reportMissingCount = Math.max(trainees.length - reportSubmitted, 0);
  const attendanceMissingCount = Math.max(trainees.length - attendanceRegistered, 0);
  const reportRate = trainees.length ? Math.round((reportSubmitted / trainees.length) * 100) : 0;
  const attendanceRate = trainees.length ? Math.round((attendanceRegistered / trainees.length) * 100) : 0;
  const companyName = (id) => companies.find(c => c.companyId === id)?.name || id || "未設定";
  const courseSummaries = courses.map(c => {
    const members = courseMap[c.courseId] || [];
    const companyIds = new Set(members.map(t => t.company || "").filter(Boolean));
    const reportCount = members.filter(t => reportIds.has(t.userId)).length;
    const attendanceCount = members.filter(t => attendanceIds.has(t.userId)).length;
    return { ...c, members, companyCount: companyIds.size, reportCount, attendanceCount, needsAttention: members.length > 0 && (reportCount < members.length || attendanceCount < members.length) };
  });
  const attentionCourses = courseSummaries.filter(c => c.needsAttention);
  const alertCount = reportMissingCount + attendanceMissingCount + absentCount + attentionCourses.length;
  const companySummaries = companies.map(co => {
    const members = trainees.filter(t => t.company === co.companyId);
    const memberIds = new Set(members.map(t => t.userId));
    const joined = courseSummaries.filter(c => c.members.some(t => memberIds.has(t.userId)));
    return { ...co, members, courses: joined };
  });
  function openCourse(courseId) {
    setActiveCourseId(courseId);
    go?.("courses");
  }
  return (
    <PrismPage>
      <PrismHomeHeading
        eyebrow={`研修管理 · ${date.replace(/-/g, "/")}`}
        title="Feeps One全体を、ここから管理。"
        description="コース単位・企業単位で、今日の研修運用状況を確認します。"
        action={<Btn kind="soft" icon={BookOpen} onClick={() => go && go("courses")}>コース管理センター</Btn>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PrismKpiCard icon={Users} label="全受講生" value={trainees.length} unit="名" detail="登録済み受講生" tone="teal" onClick={() => go && go("users")} />
        <PrismKpiCard icon={Clock} label="出席登録率" value={`${attendanceRate}%`} detail={`${attendanceRegistered}/${trainees.length}名 登録`} tone={attendanceMissingCount || absentCount ? "warn" : "ok"} onClick={() => go && go("attendance")} />
        <PrismKpiCard icon={NotebookPen} label="日報提出率" value={`${reportRate}%`} detail={`${reportSubmitted}/${trainees.length}名 提出`} tone={reportMissingCount ? "warn" : "ok"} onClick={() => go && go("reports")} />
        <PrismKpiCard icon={AlertCircle} label="本日のアラート" value={alertCount} unit="件" detail="未提出・未登録・欠席・要確認" tone={alertCount ? "bad" : "ok"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <PrismKpiCard icon={BookOpen} label="コース管理" value={courses.length} unit="件" detail="設定と研修運用" onClick={() => go && go("courses")} />
          <PrismKpiCard icon={Building2} label="企業管理" value={companies.length} unit="社" detail="契約企業の登録・管理" tone="ai" onClick={() => go && go("companies")} />
          <PrismKpiCard icon={Users} label="ユーザー管理" value={users.length} unit="名" detail="全ロールのアカウント" tone="teal" onClick={() => go && go("users")} />
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs font-semibold" style={{ color: PRISM.mut }}>
          確認日
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${PRISM.line2}`, color: PRISM.ink, background: PRISM.surface }} />
        </label>
      </div>

      {err && <PrismErrorRetryCard message={err} />}

      <PrismCard className="p-4 sm:p-5">
        <PrismSectionTitle
          title="優先して確認する研修"
          desc="日報または勤怠の登録が不足しているコースです。"
          action={<div className="flex flex-wrap gap-2"><Badge tone={attentionCourses.length ? "amber" : "green"}>{attentionCourses.length}件</Badge><Btn size="sm" kind="ghost" icon={NotebookPen} onClick={() => go && go("reports")}>日報</Btn><Btn size="sm" kind="soft" icon={Clock} onClick={() => go && go("attendance")}>勤怠</Btn></div>}
        />
        <div className="grid gap-2 md:grid-cols-2">
          {attentionCourses.length ? attentionCourses.slice(0, 6).map(c => (
            <div key={c.courseId} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: PRISM.warnSubtle, border: `1px solid ${PRISM.warnLine}` }}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: PRISM.surface, color: PRISM.warn }}><AlertCircle size={17} /></span>
              <div className="min-w-0 flex-1"><div className="truncate font-semibold" style={{ color: PRISM.ink }}>{c.name}</div><div className="mt-1 text-xs" style={{ color: PRISM.sub }}>日報 {c.reportCount}/{c.members.length} ・ 勤怠 {c.attendanceCount}/{c.members.length}</div></div>
              <Btn size="sm" kind="ghost" icon={ChevronRight} onClick={() => openCourse(c.courseId)}>開く</Btn>
            </div>
          )) : <div className="rounded-2xl p-4 text-sm md:col-span-2" style={{ background: PRISM.okSubtle, color: PRISM.ok }}>今日の要確認研修はありません。</div>}
        </div>
      </PrismCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <PrismCard className="overflow-hidden">
          <div className="p-4" style={{ borderBottom: `1px solid ${PRISM.line}` }}><PrismSectionTitle title="コース別" desc="参加企業・受講生・今日の登録状況" action={<Btn kind="soft" size="sm" icon={BookOpen} onClick={() => go && go("courses")}>管理</Btn>} /></div>
          {loading ? <SkeletonRows /> : courseSummaries.length === 0 ? <EmptyState title="コースがありません" desc="管理からコースを作成できます" /> : (
            <div className="divide-y" style={{ borderColor: PRISM.line }}>{courseSummaries.map(c => (
              <div key={c.courseId} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-bold" style={{ color: PRISM.ink }}>{c.name}</h4><Badge tone={kindTone(c.type || c.kind)}>{labelKind(c.type || c.kind)}</Badge></div><p className="mt-1 text-xs" style={{ color: PRISM.mut }}>{c.companyCount}社参加 / {c.members.length}名所属</p></div>
                  <div className="flex flex-wrap gap-1.5"><Badge tone={c.reportCount ? "green" : "muted"}>日報 {c.reportCount}</Badge><Badge tone={c.attendanceCount ? "cyan" : "muted"}>勤怠 {c.attendanceCount}</Badge><Btn size="sm" kind="ghost" icon={ChevronRight} onClick={() => openCourse(c.courseId)}>管理</Btn></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">{[...new Set(c.members.map(t => t.company).filter(Boolean))].slice(0, 4).map(id => <span key={id} className="rounded-full px-2 py-1 text-xs" style={{ background: PRISM.base, color: PRISM.sub }}>{companyName(id)}</span>)}{c.companyCount > 4 && <span className="text-xs" style={{ color: PRISM.mut }}>ほか{c.companyCount - 4}社</span>}</div>
              </div>
            ))}</div>
          )}
        </PrismCard>

        <PrismCard className="overflow-hidden">
          <div className="p-4" style={{ borderBottom: `1px solid ${PRISM.line}` }}><PrismSectionTitle title="企業別" desc="各社の受講生と所属コース" action={<Btn kind="soft" size="sm" icon={Building2} onClick={() => go && go("companies")}>管理</Btn>} /></div>
          {loading ? <SkeletonRows /> : companySummaries.length === 0 ? <EmptyState title="企業がありません" desc="管理から企業を追加できます" /> : (
            <div className="divide-y" style={{ borderColor: PRISM.line }}>{companySummaries.map(co => (
              <div key={co.companyId} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h4 className="font-bold" style={{ color: PRISM.ink }}>{co.name}</h4><p className="mt-1 text-xs" style={{ color: PRISM.mut }}>{co.members.length}名 / {co.courses.length}コース所属</p></div><Badge tone={co.members.length ? "cyan" : "muted"}>{co.members.length}名</Badge></div>
                <div className="mt-3 flex flex-wrap gap-1.5">{co.courses.slice(0, 4).map(c => <span key={c.courseId} className="rounded-full px-2 py-1 text-xs" style={{ background: PRISM.accentSubtle, color: PRISM.accentDeep }}>{c.name}</span>)}{co.courses.length > 4 && <span className="text-xs" style={{ color: PRISM.mut }}>ほか{co.courses.length - 4}件</span>}{co.courses.length === 0 && <span className="text-xs" style={{ color: PRISM.mut }}>所属コースなし</span>}</div>
              </div>
            ))}</div>
          )}
        </PrismCard>
      </div>
      {openRisk && <div className="flex justify-end"><Btn kind="soft" size="sm" onClick={openRisk}>リスク分析を見る</Btn></div>}
    </PrismPage>
  );
}
const fieldCls = "w-full rounded-xl px-3 py-2 text-sm outline-none";
const adminGridCls = "grid gap-4 lg:grid-cols-5";
const adminListCardCls = "overflow-hidden lg:col-span-3";
const adminToolbarCls = "flex flex-wrap items-center gap-2 p-3 sm:p-4";
const adminSearchCls = "flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3";
const adminHeaderCls = "hidden grid-cols-12 gap-3 px-4 py-2 text-xs font-bold sm:grid";
const adminRowCls = "flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50";
const adminMsgStyle = { background: T.successSubtle, color: T.success };
const adminErrStyle = { background: T.dangerSubtle, color: T.danger };
const adminPanelStyle = { background: T.bgBase, color: T.textMuted };
const API_BASE = "https://yit7ypsa40.execute-api.ap-northeast-1.amazonaws.com";
const LIST_PAGE_SIZE = 12;
function pageSlice(rows, page, size = LIST_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * size;
  return { items: rows.slice(start, start + size), page: safePage, totalPages, total: rows.length, start };
}
function ListPager({ page, totalPages, total, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="text-xs font-semibold" style={{ color: T.textMuted }}>{total}件中 {page}/{totalPages}ページ</div>
      <div className="flex items-center gap-2">
        <Btn kind="ghost" size="sm" icon={ChevronLeft} onClick={() => onPage(page - 1)} disabled={page <= 1}>前へ</Btn>
        <Btn kind="ghost" size="sm" icon={ChevronRight} onClick={() => onPage(page + 1)} disabled={page >= totalPages}>次へ</Btn>
      </div>
    </div>
  );
}
async function apiDelete(path) {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  const res = await fetch(API_BASE + path, {
    method: "DELETE",
    headers: idToken ? { authorization: "Bearer " + idToken } : {},
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(data?.error || `DELETE ${path} ${res.status}`);
    err.status = res.status;
    err.references = data?.references || null;
    throw err;
  }
  return data;
}
function DeleteConfirm({ title, name, warning, busy, onClose, onConfirm }) {
  return (
    <Modal title={title} onClose={busy ? undefined : onClose}
      footer={<><Btn kind="ghost" onClick={onClose} disabled={busy}>キャンセル</Btn><Btn kind="danger" icon={Trash2} onClick={onConfirm} disabled={busy}>{busy ? "削除中..." : "削除する"}</Btn></>}>
      <div className="space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: T.textSecondary }}>{name} を論理削除します。削除後は一覧に表示されません。</p>
        {warning && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.warningSubtle, color: T.warning }}>{warning}</div>}
      </div>
    </Modal>
  );
}
const COURSE_KINDS = [["shinjin", "新人研修"], ["regular", "定常"]];
const kindLabel = (k) => (COURSE_KINDS.find(o => o[0] === k)?.[1]) || "新人研修";
const kindTone = (k) => k === "regular" ? "green" : "cyan";

function AdminCompanies() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", note: "" });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState({ name: "", memo: "" });
  const [trainees, setTrainees] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const memoOf = (r) => r?.memo ?? r?.note ?? "";
  function load() {
    setLoading(true);
    return apiGet("/companies")
      .then(l => {
        const list = l || [];
        setRows(list);
        if (selected) {
          const fresh = list.find(x => x.companyId === selected.companyId);
          if (fresh) {
            setSelected(fresh);
            setEdit({ name: fresh.name || "", memo: memoOf(fresh) });
          }
        }
      })
      .catch(() => setErr("企業一覧の取得に失敗しました。"))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);
  const visibleRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = rows.filter(r => !s || `${r.name || ""} ${memoOf(r)}`.toLowerCase().includes(s));
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => String(sort.key === "memo" ? memoOf(a) : a.name || "").localeCompare(String(sort.key === "memo" ? memoOf(b) : b.name || ""), "ja") * dir);
  }, [rows, q, sort]);
  useEffect(() => { setPage(1); }, [q, sort.key, sort.dir, rows.length]);
  const visiblePage = pageSlice(visibleRows, page);
  function changeSort(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }
  async function selectCompany(r) {
    setSelected(r);
    setEdit({ name: r.name || "", memo: memoOf(r) });
    setErr("");
    setMsg("");
    setDetailLoading(true);
    setTrainees([]);
    try { setTrainees(await apiGet(`/companies/${r.companyId}/trainees`) || []); }
    catch (e) { setErr("所属受講生の取得に失敗しました：" + (e?.message || e)); }
    finally { setDetailLoading(false); }
  }
  async function create() {
    if (!form.name.trim() || busy) return;
    setBusy(true); setErr(""); setMsg("");
    try { await apiPost("/companies", { name: form.name.trim(), note: form.note.trim() }); setMsg(`${form.name.trim()} を作成しました。`); setForm({ name: "", note: "" }); setOpen(false); load(); }
    catch (e) { setErr("作成に失敗しました：" + (e?.message || e)); } finally { setBusy(false); }
  }
  async function save() {
    if (!selected || !edit.name.trim() || busy) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      await apiPut(`/companies/${selected.companyId}`, { name: edit.name.trim(), memo: edit.memo.trim() });
      setMsg(`${edit.name.trim()} を保存しました。`);
      await load();
    } catch (e) { setErr("保存に失敗しました：" + (e?.message || e)); } finally { setBusy(false); }
  }
  async function deleteCompany() {
    if (!selected || busy) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      await apiDelete(`/companies/${selected.companyId}`);
      setMsg(`${selected.name || "企業"} を削除しました。`);
      setDeleteOpen(false);
      setSelected(null);
      await load();
    } catch (e) {
      setErr(e?.message || "削除に失敗しました。");
    } finally { setBusy(false); }
  }
  const SortMark = ({ k }) => sort.key === k ? (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : null;
  if (selected) return (
    <div>
      <SectionHead title={selected.name || "企業詳細"} desc="企業基本情報と所属受講生を管理します"
        action={<Btn kind="ghost" size="sm" icon={ChevronLeft} onClick={() => { setSelected(null); setErr(""); setMsg(""); }}>企業一覧に戻る</Btn>} />
      {msg && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminMsgStyle}>{msg}</div>}
      {err && !open && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminErrStyle}>{err}</div>}
      <div className="space-y-5">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentSubtle, color: T.accent }}><Building2 size={17} /></div>
            <div className="min-w-0"><h3 className="truncate font-bold" style={{ color: T.textPrimary }}>企業基本情報</h3><p className="text-xs" style={{ color: T.textMuted }}>{selected.companyId}</p></div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="企業名"><input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <div className="lg:col-span-2"><Field label="メモ"><textarea value={edit.memo} onChange={e => setEdit({ ...edit, memo: e.target.value })} rows={3} className={fieldCls + " resize-none"} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field></div>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><Btn kind="ghost" icon={Trash2} onClick={() => setDeleteOpen(true)} disabled={busy}>削除</Btn><Btn icon={Check} onClick={save}>{busy ? "保存中..." : "保存する"}</Btn></div>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-bold" style={{ color: T.textPrimary }}><Users size={16} />所属受講生</h3>
            <Badge tone="cyan">{trainees.length}名</Badge>
          </div>
          {detailLoading ? <SkeletonCards count={2} />
            : trainees.length === 0 ? <div className="rounded-xl px-4 py-5 text-center text-sm" style={adminPanelStyle}>所属受講生はいません。</div>
            : <div className="grid gap-2 md:grid-cols-2">{trainees.map(t => (
              <div key={t.userId} className="flex items-center gap-2 rounded-xl p-2" style={{ background: T.bgBase }}>
                <Avatar name={t.name || t.email} size={28} />
                <div className="min-w-0"><div className="truncate text-sm font-semibold" style={{ color: T.textPrimary }}>{t.name || "名称未設定"}</div>{t.email && <div className="truncate text-xs" style={{ color: T.textMuted }}>{t.email}</div>}</div>
              </div>
            ))}</div>}
        </Card>
        <Card className="p-5">
          <h3 className="mb-2 font-bold" style={{ color: T.textPrimary }}>関連コース概要</h3>
          <p className="text-sm leading-relaxed" style={{ color: T.textMuted }}>コース所属は Enrollments を正として管理します。企業別の関連コース集計は、今後の集計APIでより正確に表示する想定です。</p>
        </Card>
      </div>
      {deleteOpen && selected && <DeleteConfirm title="企業を削除" name={selected.name || selected.companyId} warning="所属ユーザーがいる企業は削除できません。" busy={busy} onClose={() => setDeleteOpen(false)} onConfirm={deleteCompany} />}
    </div>
  );
  return (
    <div>
      <SectionHead title="企業管理" desc="契約企業の管理" action={<div className="flex flex-wrap items-center gap-2">
        <Btn size="sm" kind="ghost" icon={FileSpreadsheet} onClick={() => exportAdminListExcel(visibleRows, [
          [r => r.name || "", "企業名"], [r => memoOf(r), "メモ"], [r => r.companyId || "", "企業ID"],
        ], "企業一覧", "企業一覧")}>Excel出力</Btn>
        <Btn size="sm" icon={Plus} onClick={() => { setOpen(true); setErr(""); setMsg(""); }}>企業を追加</Btn>
      </div>} />
      {msg && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminMsgStyle}>{msg}</div>}
      {err && !open && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminErrStyle}>{err}</div>}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat icon={Building2} label="登録企業" value={`${rows.length}社`} tone="cyan" />
        <Stat icon={StickyNote} label="メモ登録済み" value={`${rows.filter(r => memoOf(r)).length}社`} tone="green" />
        <Stat icon={AlertCircle} label="メモ未登録" value={`${rows.filter(r => !memoOf(r)).length}社`} tone={rows.some(r => !memoOf(r)) ? "amber" : "muted"} />
      </div>
      <div>
        <Card className="overflow-hidden">
          <div className={adminToolbarCls} style={{ borderBottom: `1px solid ${T.border}` }}>
            <div className={adminSearchCls} style={{ border: `1px solid ${T.border}` }}>
              <Search size={15} style={{ color: T.textMuted }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="企業名・メモで検索" className="w-full bg-transparent text-sm outline-none" style={{ color: T.textPrimary }} />
            </div>
            <Btn kind={sort.key === "name" ? "soft" : "ghost"} size="sm" icon={Pencil} onClick={() => changeSort("name")}>企業名 <SortMark k="name" /></Btn>
            <Btn kind={sort.key === "memo" ? "soft" : "ghost"} size="sm" icon={StickyNote} onClick={() => changeSort("memo")}>メモ <SortMark k="memo" /></Btn>
          </div>
          <div className={adminHeaderCls} style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>
            <div className="col-span-7">企業</div><div className="col-span-4">メモ</div><div className="col-span-1 text-right">操作</div>
          </div>
          {loading ? <SkeletonRows />
            : rows.length === 0 ? <EmptyState title="企業がありません" desc="「企業を追加」から登録できます" />
            : visibleRows.length === 0 ? <div className="px-4 py-8 text-center text-sm" style={{ color: T.textMuted }}>検索条件に一致する企業がありません。</div>
            : visiblePage.items.map((r, i) => {
              const active = selected?.companyId === r.companyId;
              return (
                <button key={r.companyId || i} onClick={() => selectCompany(r)} className={adminRowCls} style={{ borderTop: visiblePage.start + i ? `1px solid ${T.border}` : "none", background: active ? T.accentSubtle : "#fff" }}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: active ? "#fff" : T.accentSubtle }}><Building2 size={15} style={{ color: T.accent }} /></div>
                  <div className="min-w-0 flex-1"><div className="text-sm font-semibold" style={{ color: T.textPrimary }}>{r.name}</div>{memoOf(r) && <div className="truncate text-xs" style={{ color: T.textMuted }}>{memoOf(r)}</div>}</div>
                  <span className="hidden text-xs font-semibold sm:inline" style={{ color: T.accentHover }}>詳細・編集</span><ChevronRight size={16} style={{ color: T.textMuted }} />
                </button>
              );
            })}
          <ListPager page={visiblePage.page} totalPages={visiblePage.totalPages} total={visiblePage.total} onPage={setPage} />
        </Card>
      </div>
      {open && (
        <Modal title="企業を追加" onClose={() => setOpen(false)}
          footer={<><Btn kind="ghost" onClick={() => setOpen(false)}>キャンセル</Btn><Btn icon={Check} onClick={create} disabled={busy}>{busy ? "作成中…" : "作成する"}</Btn></>}>
          <div className="space-y-3">
            <Field label="企業名"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="株式会社アクシス" className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="メモ（任意）"><input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            {err && <div className="rounded-lg px-3 py-2 text-xs" style={adminErrStyle}>{err}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
const CAL_TYPES = [["training", "通常研修日"], ["holiday", "祝日/休日"], ["closed", "休講日"], ["makeup", "振替研修日"]];
const calTypeLabel = (t) => (CAL_TYPES.find(x => x[0] === t)?.[1]) || t || "通常研修日";
const calTypeTone = (t) => t === "training" ? "green" : t === "makeup" ? "cyan" : t === "closed" ? "amber" : "muted";
const calTraining = (t) => t === "training" || t === "makeup";
const courseEditValue = (course = {}) => ({
  name: course.name || "", type: course.type ?? course.kind ?? "shinjin", memo: course.memo ?? course.description ?? "",
  instructorIds: Array.isArray(course.instructorIds) ? course.instructorIds : [],
  startDate: course.startDate || "", endDate: course.endDate || "",
  standardClockIn: course.standardClockIn || "", standardClockOut: course.standardClockOut || "",
  lunchBreakStart: course.lunchBreakStart || "", lunchBreakEnd: course.lunchBreakEnd || "",
  mode: course.mode || "", venueName: course.venueName || "", venueAddress: course.venueAddress || "", onlineUrl: course.onlineUrl || "",
});

function AdminCourses({ go }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "shinjin", description: "" });
  const [q, setQ] = useState("");
  const [courseFilter, setCourseFilter] = useState("すべて");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(courseEditValue());
  const [trainees, setTrainees] = useState([]);
  const [users, setUsers] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [addTraineeId, setAddTraineeId] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(monthStr());
  const [calendarItems, setCalendarItems] = useState({});
  const [calendarDirty, setCalendarDirty] = useState({});
  const [workdays, setWorkdays] = useState({ month: monthStr(), days: [], trainingDaysCount: 0 });
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarEditDate, setCalendarEditDate] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const typeOf = (c) => c?.type ?? c?.kind ?? "shinjin";
  const memoOf = (c) => c?.memo ?? c?.description ?? "";
  function load() {
    setLoading(true);
    return apiGet("/courses")
      .then(l => {
        const list = l || [];
        setRows(list);
        if (selected) {
          const fresh = list.find(x => x.courseId === selected.courseId);
          if (fresh) {
            setSelected(fresh);
            setEdit(courseEditValue(fresh));
          }
        } else {
          const active = list.find(x => x.courseId === getActiveCourseId());
          if (active) selectCourse(active);
        }
      })
      .catch(() => setErr("コース一覧の取得に失敗しました。"))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    apiGet("/admin/users").then(l => setUsers(l || [])).catch(() => setErr("ユーザー一覧の取得に失敗しました。"));
    apiGet("/admin/instructors").then(l => setInstructors(l || [])).catch(() => setErr("講師一覧の取得に失敗しました。"));
    apiGet("/companies").then(l => setCompanies(l || [])).catch(() => setErr("企業一覧の取得に失敗しました。"));
  }, []);
  useEffect(() => {
    if (!selected?.courseId) return;
    loadCalendar(selected.courseId, calendarMonth);
  }, [selected?.courseId, calendarMonth]);
  const visibleRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = rows.filter(r => {
      const assignedNames = (Array.isArray(r.instructorIds) ? r.instructorIds : []).map(id => instructors.find(x => x.userId === id)?.name || instructors.find(x => x.userId === id)?.email || id).join(" ");
      const matchesQuery = !s || `${r.name || ""} ${kindLabel(typeOf(r))} ${memoOf(r)} ${assignedNames}`.toLowerCase().includes(s);
      const matchesFilter = courseFilter === "すべて"
        || (courseFilter === "担当講師未設定" ? !(r.instructorIds || []).length : kindLabel(typeOf(r)) === courseFilter);
      return matchesQuery && matchesFilter;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = sort.key === "type" ? kindLabel(typeOf(a)) : a.name || "";
      const bv = sort.key === "type" ? kindLabel(typeOf(b)) : b.name || "";
      return String(av).localeCompare(String(bv), "ja") * dir;
    });
  }, [rows, q, courseFilter, sort, instructors]);
  useEffect(() => { setPage(1); }, [q, courseFilter, sort.key, sort.dir, rows.length]);
  const visiblePage = pageSlice(visibleRows, page);
  function changeSort(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }
  async function selectCourse(c) {
    setActiveCourseId(c.courseId);
    setSelected(c);
    setEdit(courseEditValue(c));
    setErr("");
    setMsg("");
    setDetailLoading(true);
    setTrainees([]);
    setAddTraineeId("");
    try { setTrainees(await apiGet(`/courses/${c.courseId}/trainees`) || []); }
    catch (e) { setErr("所属受講生の取得に失敗しました：" + (e?.message || e)); }
    finally { setDetailLoading(false); }
  }
  async function loadCalendar(courseId = selected?.courseId, month = calendarMonth) {
    if (!courseId || !month) return;
    setCalendarLoading(true);
    try {
      const [items, wd] = await Promise.all([
        apiGet(`/courses/${courseId}/calendar?month=${month}`).catch(() => []),
        apiGet(`/courses/${courseId}/workdays?month=${month}`),
      ]);
      const byDate = {};
      (items || []).forEach(item => { if (item.date) byDate[item.date] = item; });
      setCalendarItems(byDate);
      setCalendarDirty({});
      setWorkdays(wd || { month, days: [], trainingDaysCount: 0 });
    } catch (e) {
      setErr("研修カレンダーの取得に失敗しました：" + (e?.message || e));
    } finally {
      setCalendarLoading(false);
    }
  }
  function updateCalendar(date, patch) {
    setCalendarItems(items => {
      const base = items[date] || { date, type: "training", title: "", note: "" };
      return { ...items, [date]: { ...base, ...patch } };
    });
    setCalendarDirty(d => ({ ...d, [date]: true }));
  }
  async function saveCalendar() {
    if (!selected?.courseId || calendarBusy) return;
    const items = Object.keys(calendarDirty).map(date => {
      const item = calendarItems[date] || { date, type: "training" };
      const type = item.type || "training";
      return {
        date, type, title: item.title || "", note: item.note || "", isTrainingDay: calTraining(type),
        startTime: item.startTime || "", endTime: item.endTime || "",
        lunchBreakStart: item.lunchBreakStart || "", lunchBreakEnd: item.lunchBreakEnd || "",
        instructorIds: Array.isArray(item.instructorIds) ? item.instructorIds : [],
        subInstructorIds: Array.isArray(item.subInstructorIds) ? item.subInstructorIds : [],
        mode: item.mode || "", venueName: item.venueName || "", venueAddress: item.venueAddress || "", onlineUrl: item.onlineUrl || "",
        materialIds: Array.isArray(item.materialIds) ? item.materialIds : [],
        materialDownloadEnabled: item.materialDownloadEnabled === true,
      };
    });
    if (!items.length) { setMsg("保存するカレンダー変更はありません。"); return; }
    setCalendarBusy(true); setErr(""); setMsg("");
    try {
      await apiPut(`/courses/${selected.courseId}/calendar`, { items });
      setMsg("研修カレンダーを保存しました。");
      await loadCalendar(selected.courseId, calendarMonth);
    } catch (e) {
      setErr("研修カレンダーの保存に失敗しました：" + (e?.message || e));
    } finally {
      setCalendarBusy(false);
    }
  }
  async function reloadCourseTrainees(courseId = selected?.courseId) {
    if (!courseId) return;
    setDetailLoading(true);
    try { setTrainees(await apiGet(`/courses/${courseId}/trainees`) || []); }
    catch (e) { setErr("所属受講生の取得に失敗しました：" + (e?.message || e)); }
    finally { setDetailLoading(false); }
  }
  async function create() {
    if (!form.name.trim() || busy) return;
    setBusy(true); setErr(""); setMsg("");
    try { await apiPost("/courses", { name: form.name.trim(), kind: form.kind, description: form.description.trim() }); setMsg(`${form.name.trim()} を作成しました。`); setForm({ name: "", kind: "shinjin", description: "" }); setOpen(false); load(); }
    catch (e) { setErr("作成に失敗しました：" + (e?.message || e)); } finally { setBusy(false); }
  }
  async function save() {
    if (!selected || !edit.name.trim() || busy) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      await apiPut(`/courses/${selected.courseId}`, {
        name: edit.name.trim(), type: edit.type, memo: edit.memo.trim(), instructorIds: edit.instructorIds,
        startDate: edit.startDate, endDate: edit.endDate,
        standardClockIn: edit.standardClockIn, standardClockOut: edit.standardClockOut,
        lunchBreakStart: edit.lunchBreakStart, lunchBreakEnd: edit.lunchBreakEnd,
        mode: edit.mode, venueName: edit.venueName.trim(), venueAddress: edit.venueAddress.trim(), onlineUrl: edit.onlineUrl.trim(),
      });
      setMsg(`${edit.name.trim()} を保存しました。`);
      await load();
    } catch (e) { setErr("保存に失敗しました：" + (e?.message || e)); } finally { setBusy(false); }
  }
  async function deleteCourse() {
    if (!selected || busy) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      await apiDelete(`/courses/${selected.courseId}`);
      setMsg(`${selected.name || "コース"} を削除しました。`);
      setDeleteOpen(false);
      setSelected(null);
      await load();
    } catch (e) {
      setErr(e?.message || "削除に失敗しました。");
    } finally { setBusy(false); }
  }
  async function addTrainee() {
    if (!selected || !addTraineeId || busy) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      await apiPost(`/courses/${selected.courseId}/trainees`, { traineeId: addTraineeId });
      setMsg("受講生をコースに追加しました。");
      setAddTraineeId("");
      await reloadCourseTrainees(selected.courseId);
    } catch (e) { setErr("受講生の追加に失敗しました：" + (e?.message || e)); } finally { setBusy(false); }
  }
  async function removeTrainee(traineeId) {
    if (!selected || !traineeId || busy) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      await apiDelete(`/courses/${selected.courseId}/trainees/${traineeId}`);
      setMsg("受講生の所属を解除しました。");
      await reloadCourseTrainees(selected.courseId);
    } catch (e) { setErr("所属解除に失敗しました：" + (e?.message || e)); } finally { setBusy(false); }
  }
  const companyName = (id) => companies.find(c => c.companyId === id)?.name || id || "（未選択）";
  const traineeOptions = useMemo(() => {
    const enrolled = new Set(trainees.map(t => t.userId));
    return users.filter(u => u.role === "trainee" && !enrolled.has(u.userId));
  }, [users, trainees]);
  const instructorName = (id) => instructors.find(x => x.userId === id)?.name || instructors.find(x => x.userId === id)?.email || id;
  const instructorNames = (ids = []) => (Array.isArray(ids) ? ids : []).map(instructorName).filter(Boolean).join("、") || "未設定";
  function toggleInstructor(id) {
    setEdit(e => {
      const current = Array.isArray(e.instructorIds) ? e.instructorIds : [];
      return { ...e, instructorIds: current.includes(id) ? current.filter(x => x !== id) : [...current, id] };
    });
  }
  const workdayByDate = useMemo(() => Object.fromEntries((workdays.days || []).map(d => [d.date, d])), [workdays]);
  const calendarRows = useMemo(() => datesInMonth(calendarMonth).map(date => {
    const saved = calendarItems[date] || {};
    const base = workdayByDate[date] || {};
    const type = saved.type || base.type || "training";
    return {
      date,
      type,
      title: saved.title ?? base.title ?? "",
      note: saved.note ?? "",
      startTime: saved.startTime ?? base.startTime ?? "",
      endTime: saved.endTime ?? base.endTime ?? "",
      lunchBreakStart: saved.lunchBreakStart ?? base.lunchBreakStart ?? "",
      lunchBreakEnd: saved.lunchBreakEnd ?? base.lunchBreakEnd ?? "",
      instructorIds: Array.isArray(saved.instructorIds) ? saved.instructorIds : [],
      subInstructorIds: Array.isArray(saved.subInstructorIds) ? saved.subInstructorIds : [],
      mode: saved.mode ?? base.mode ?? "",
      venueName: saved.venueName ?? base.venueName ?? "",
      venueAddress: saved.venueAddress ?? base.venueAddress ?? "",
      onlineUrl: saved.onlineUrl ?? base.onlineUrl ?? "",
      materialIds: Array.isArray(saved.materialIds) ? saved.materialIds : [],
      materialDownloadEnabled: saved.materialDownloadEnabled === true,
      isTrainingDay: saved.type ? calTraining(type) : !!base.isTrainingDay,
      dirty: !!calendarDirty[date],
    };
  }), [calendarMonth, calendarItems, calendarDirty, workdayByDate]);
  const calendarCells = useMemo(() => {
    const first = calendarRows[0]?.date;
    const offset = first ? (new Date(`${first}T00:00:00`).getDay() + 6) % 7 : 0;
    return [...Array.from({ length: offset }, (_, i) => ({ blank: true, key: `b${i}` })), ...calendarRows];
  }, [calendarRows]);
  const calendarEditRow = calendarRows.find(row => row.date === calendarEditDate) || null;
  function toggleDayInstructor(date, field, userId) {
    const row = calendarRows.find(item => item.date === date);
    const current = Array.isArray(row?.[field]) ? row[field] : [];
    updateCalendar(date, { [field]: current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId] });
  }
  const SortMark = ({ k }) => sort.key === k ? (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : null;
  if (selected) return (
    <div>
      <SectionHead title={selected.name || "コース詳細"} desc="基本情報・担当講師・所属受講生・研修カレンダーを管理します"
        action={<div className="flex flex-wrap items-center justify-end gap-2"><select value={selected.courseId} onChange={e => { const next = rows.find(row => row.courseId === e.target.value); if (next) selectCourse(next); }} className="min-w-52 rounded-xl px-3 py-2 text-sm font-semibold outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }}>{rows.map(row => <option key={row.courseId} value={row.courseId}>{row.name || row.courseId}</option>)}</select><Btn kind="ghost" size="sm" icon={ChevronLeft} onClick={() => { setSelected(null); setErr(""); setMsg(""); }}>コース一覧</Btn></div>} />
      {msg && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminMsgStyle}>{msg}</div>}
      {err && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminErrStyle}>{err}</div>}
      <Card className="mb-5 p-4">
        <div className="mb-3"><h3 className="font-bold" style={{ color: T.textPrimary }}>このコースの運用メニュー</h3><p className="text-xs" style={{ color: T.textMuted }}>選択中のコースを引き継いで、各管理画面を開きます。</p></div>
        <div className="flex flex-wrap gap-2"><Btn kind="soft" size="sm" icon={Calendar} onClick={() => go?.("curriculum")}>カリキュラム</Btn><Btn kind="ghost" size="sm" icon={NotebookPen} onClick={() => go?.("reports")}>日報</Btn><Btn kind="ghost" size="sm" icon={Clock} onClick={() => go?.("attendance")}>勤怠</Btn><Btn kind="ghost" size="sm" icon={ClipboardCheck} onClick={() => go?.("tests")}>テスト</Btn><Btn kind="ghost" size="sm" icon={FileSpreadsheet} onClick={() => go?.("materials")}>研修資料</Btn><Btn kind="ghost" size="sm" icon={Users} onClick={() => go?.("trainees")}>受講生</Btn></div>
      </Card>
      <div className="space-y-5">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentSubtle, color: T.accent }}><BookOpen size={17} /></div><div><h3 className="font-bold" style={{ color: T.textPrimary }}>コース基本情報</h3><p className="text-xs" style={{ color: T.textMuted }}>{selected.courseId}</p></div></div>
            <Btn kind="ghost" icon={Calendar} onClick={() => go && go("curriculum")}>カリキュラムを編集</Btn>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="コース名"><input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="種別"><select value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>{COURSE_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <div className="lg:col-span-2"><Field label="メモ"><textarea value={edit.memo} onChange={e => setEdit({ ...edit, memo: e.target.value })} rows={3} className={fieldCls + " resize-none"} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field></div>
            <Field label="研修開始日"><input type="date" value={edit.startDate} onChange={e => setEdit({ ...edit, startDate: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="研修終了日"><input type="date" value={edit.endDate} onChange={e => setEdit({ ...edit, endDate: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準開始時刻"><input type="time" value={edit.standardClockIn} onChange={e => setEdit({ ...edit, standardClockIn: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準終了時刻"><input type="time" value={edit.standardClockOut} onChange={e => setEdit({ ...edit, standardClockOut: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準昼休み（開始）"><input type="time" value={edit.lunchBreakStart} onChange={e => setEdit({ ...edit, lunchBreakStart: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準昼休み（終了）"><input type="time" value={edit.lunchBreakEnd} onChange={e => setEdit({ ...edit, lunchBreakEnd: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準受講形式"><select value={edit.mode} onChange={e => setEdit({ ...edit, mode: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}><option value="">未設定</option><option value="online">オンライン</option><option value="onsite">対面</option><option value="hybrid">ハイブリッド</option></select></Field>
            <Field label="標準会場名"><input value={edit.venueName} onChange={e => setEdit({ ...edit, venueName: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準会場住所"><input value={edit.venueAddress} onChange={e => setEdit({ ...edit, venueAddress: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準オンラインURL"><input type="url" value={edit.onlineUrl} onChange={e => setEdit({ ...edit, onlineUrl: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
          </div>
          {(!edit.startDate || !edit.endDate) && <div className="mt-3 rounded-xl px-3 py-2 text-xs" style={{ background: T.warningSubtle, color: T.textSecondary, border: `1px solid ${T.warning}` }}>開始日・終了日が未設定の間は、日報や勤怠を欠席扱いにせず「日程設定が必要」と表示します。</div>}
          <div className="mt-5">
            <div className="mb-2 text-sm font-bold" style={{ color: T.textPrimary }}>担当講師</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {instructors.map(i => {
                const checked = (edit.instructorIds || []).includes(i.userId);
                return <label key={i.userId} className="flex cursor-pointer items-center gap-2 rounded-xl p-3 text-sm" style={{ background: checked ? T.accentSubtle : T.bgBase, border: `1px solid ${checked ? T.accent : T.border}` }}><input type="checkbox" checked={checked} onChange={() => toggleInstructor(i.userId)} /><span style={{ color: T.textPrimary }}>{i.name || i.email}</span></label>;
              })}
              {!instructors.length && <div className="text-sm" style={{ color: T.textMuted }}>講師ユーザーがまだ登録されていません。</div>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><Btn kind="ghost" icon={Trash2} onClick={() => setDeleteOpen(true)} disabled={busy}>削除</Btn><Btn icon={Check} onClick={save}>{busy ? "保存中…" : "保存する"}</Btn></div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-1.5 font-bold" style={{ color: T.textPrimary }}><Users size={16} />所属受講生</h3><Badge tone="cyan">{trainees.length}名</Badge></div>
          <div className="mb-3 rounded-xl p-3 text-xs leading-relaxed" style={adminPanelStyle}>このコースには複数企業の受講生を所属できます。合同研修や研修後のEラーニング利用にも対応します。</div>
          <div className="mb-3 flex flex-wrap items-end gap-2"><div className="min-w-0 flex-1"><Field label="未所属の受講生を追加"><select value={addTraineeId} onChange={e => setAddTraineeId(e.target.value)} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}><option value="">（選択してください）</option>{traineeOptions.map(t => <option key={t.userId} value={t.userId}>{t.name || t.email} / {companyName(t.company)}</option>)}</select></Field></div><Btn size="sm" icon={Plus} onClick={addTrainee}>{busy ? "追加中…" : "追加"}</Btn></div>
          {detailLoading ? <SkeletonCards count={2} />
            : trainees.length === 0 ? <div className="rounded-xl px-4 py-5 text-center text-sm" style={adminPanelStyle}>所属受講生はいません。</div>
            : <div className="grid gap-2 md:grid-cols-2">{trainees.map(t => <div key={t.userId} className="flex items-center gap-2 rounded-xl p-2" style={{ background: T.bgBase }}><Avatar name={t.name || t.email} size={28} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold" style={{ color: T.textPrimary }}>{t.name || "（氏名未設定）"}</div><div className="truncate text-xs" style={{ color: T.textMuted }}>{t.email || t.userId} / {companyName(t.company)}</div></div><Btn kind="ghost" size="sm" icon={X} onClick={() => removeTrainee(t.userId)}>解除</Btn></div>)}</div>}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="flex items-center gap-1.5 font-bold" style={{ color: T.textPrimary }}><Calendar size={16} />研修カレンダー</h3><p className="mt-1 text-xs" style={{ color: T.textMuted }}>休日・振替日・日ごとの時刻・受講形式・担当講師を設定できます。</p></div><div className="flex flex-wrap items-center gap-2"><Badge tone={workdays.status === "setup_required" ? "amber" : "green"}>{workdays.status === "setup_required" ? "日程設定が必要" : `研修日 ${workdays.trainingDaysCount ?? 0}日`}</Badge><input type="month" value={calendarMonth} onChange={e => setCalendarMonth(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /><Btn size="sm" icon={Check} onClick={saveCalendar}>{calendarBusy ? "保存中…" : "保存"}</Btn></div></div>
          {calendarLoading ? <SkeletonRows rows={3} />
            : <>
              <div className="space-y-2 md:hidden">
                {calendarCells.filter(row => !row.blank).map(row => <div key={row.date} className="rounded-xl p-3" style={{ background: row.isTrainingDay ? "#fff" : T.bgBase, border: `1px solid ${row.dirty ? T.accent : T.border}` }}>
                  <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="text-sm font-bold" style={{ color: T.textPrimary }}>{Number(row.date.slice(8, 10))}日</span><Badge tone={row.isTrainingDay ? "green" : "muted"}>{row.isTrainingDay ? "研修日" : "非研修日"}</Badge></div>{row.dirty && <Badge tone="cyan">変更あり</Badge>}</div>
                  <div className="grid gap-2 sm:grid-cols-3"><select value={row.type} onChange={e => updateCalendar(row.date, { type: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }}>{CAL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><input value={row.title} onChange={e => updateCalendar(row.date, { title: e.target.value })} placeholder="タイトル" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }} /><Btn kind="ghost" size="sm" icon={Pencil} onClick={() => setCalendarEditDate(row.date)}>日別設定</Btn></div>
                </div>)}
              </div>
              <div className="hidden overflow-x-auto md:block"><div className="grid grid-cols-7 gap-1.5" style={{ minWidth: 900 }}>{["月", "火", "水", "木", "金", "土", "日"].map(d => <div key={d} className="px-2 py-1 text-center text-xs font-bold" style={{ color: T.textMuted }}>{d}</div>)}{calendarCells.map((row, i) => row.blank ? <div key={row.key || i} className="min-h-[150px] rounded-xl" style={{ background: T.bgBase, border: `1px dashed ${T.border}` }} /> : <div key={row.date} className="min-h-[150px] rounded-xl p-2" style={{ background: row.isTrainingDay ? T.bgSurface : T.bgBase, border: `1px solid ${row.dirty ? T.accent : T.border}` }}><div className="mb-1 flex items-center justify-between gap-1"><span className="text-sm font-bold" style={{ color: T.textPrimary }}>{Number(row.date.slice(8, 10))}</span>{row.dirty && <span className="h-2 w-2 rounded-full" style={{ background: T.accent }} title="変更あり" />}</div><div className="mb-1 flex flex-wrap gap-1"><Badge tone={row.isTrainingDay ? "green" : "muted"}>{row.isTrainingDay ? "研修日" : "非研修日"}</Badge><Badge tone={calTypeTone(row.type)}>{calTypeLabel(row.type)}</Badge></div>{(row.title || row.note) && <div className="mb-1 line-clamp-2 text-xs" style={{ color: T.textMuted }}>{row.title || row.note}</div>}<div className="space-y-1.5"><select value={row.type} onChange={e => updateCalendar(row.date, { type: e.target.value })} className="w-full rounded-xl px-2 py-1.5 text-xs outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>{CAL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><input value={row.title} onChange={e => updateCalendar(row.date, { title: e.target.value })} placeholder="タイトル" className="w-full rounded-xl px-2 py-1.5 text-xs outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /><Btn kind="ghost" size="sm" icon={Pencil} onClick={() => setCalendarEditDate(row.date)}>日別設定</Btn></div></div>)}</div></div>
            </>}
        </Card>
      </div>
      {calendarEditRow && <Modal title={`${calendarEditRow.date} の日別設定`} desc="この日の設定はコースの標準設定より優先されます。" onClose={() => setCalendarEditDate("")} footer={<><Btn kind="ghost" onClick={() => setCalendarEditDate("")}>閉じる</Btn><Btn icon={Check} onClick={() => { setCalendarEditDate(""); setMsg("日別設定を反映しました。カレンダーの保存を押して確定してください。"); }}>設定して閉じる</Btn></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="日の種類"><select value={calendarEditRow.type} onChange={e => updateCalendar(calendarEditRow.date, { type: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>{CAL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="タイトル"><input value={calendarEditRow.title} onChange={e => updateCalendar(calendarEditRow.date, { title: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
          <Field label="開始時刻"><input type="time" value={calendarEditRow.startTime} onChange={e => updateCalendar(calendarEditRow.date, { startTime: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
          <Field label="終了時刻"><input type="time" value={calendarEditRow.endTime} onChange={e => updateCalendar(calendarEditRow.date, { endTime: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
          <Field label="昼休み（開始）"><input type="time" value={calendarEditRow.lunchBreakStart} onChange={e => updateCalendar(calendarEditRow.date, { lunchBreakStart: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
          <Field label="昼休み（終了）"><input type="time" value={calendarEditRow.lunchBreakEnd} onChange={e => updateCalendar(calendarEditRow.date, { lunchBreakEnd: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
          <Field label="受講形式"><select value={calendarEditRow.mode} onChange={e => updateCalendar(calendarEditRow.date, { mode: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}><option value="">標準設定を使用</option><option value="online">オンライン</option><option value="onsite">対面</option><option value="hybrid">ハイブリッド</option></select></Field>
          <Field label="会場名"><input value={calendarEditRow.venueName} onChange={e => updateCalendar(calendarEditRow.date, { venueName: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
          <Field label="会場住所"><input value={calendarEditRow.venueAddress} onChange={e => updateCalendar(calendarEditRow.date, { venueAddress: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
          <Field label="オンラインURL"><input type="url" value={calendarEditRow.onlineUrl} onChange={e => updateCalendar(calendarEditRow.date, { onlineUrl: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
          <div className="sm:col-span-2"><Field label="運営メモ"><textarea rows={2} value={calendarEditRow.note} onChange={e => updateCalendar(calendarEditRow.date, { note: e.target.value })} className={fieldCls + " resize-none"} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field></div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[['instructorIds', 'メイン講師'], ['subInstructorIds', 'サブ講師']].map(([field, label]) => <div key={field}><div className="mb-2 text-sm font-bold" style={{ color: T.textPrimary }}>{label}</div><div className="space-y-2">{instructors.filter(i => (edit.instructorIds || []).includes(i.userId)).map(i => { const checked = (calendarEditRow[field] || []).includes(i.userId); return <label key={i.userId} className="flex cursor-pointer items-center gap-2 rounded-xl p-2 text-sm" style={{ background: checked ? T.accentSubtle : T.bgBase, border: `1px solid ${checked ? T.accent : T.border}` }}><input type="checkbox" checked={checked} onChange={() => toggleDayInstructor(calendarEditRow.date, field, i.userId)} /><span style={{ color: T.textPrimary }}>{i.name || i.email}</span></label>; })}{!(edit.instructorIds || []).length && <div className="text-xs" style={{ color: T.textMuted }}>先にコースの担当講師を設定してください。</div>}</div></div>)}
        </div>
      </Modal>}
      {deleteOpen && selected && <DeleteConfirm title="コースを削除" name={selected.name || selected.courseId} warning="受講生やカリキュラムがあるコースは削除できません。" busy={busy} onClose={() => setDeleteOpen(false)} onConfirm={deleteCourse} />}
    </div>
  );
  return (
    <div>
      <SectionHead title="コース管理" desc="研修・Eラーニング・継続支援枠をコースとして管理します" action={<div className="flex flex-wrap items-center gap-2">
        <Btn size="sm" kind="ghost" icon={FileSpreadsheet} onClick={() => exportAdminListExcel(visibleRows, [
          [r => r.name || "", "コース名"], [r => kindLabel(typeOf(r)), "種別"], [r => memoOf(r), "メモ"], [r => (r.instructorIds || []).length, "担当講師数"], [r => r.courseId || "", "コースID"],
        ], "コース一覧", "コース一覧")}>Excel出力</Btn>
        <Btn size="sm" icon={Plus} onClick={() => { setOpen(true); setErr(""); setMsg(""); }}>コースを作成</Btn>
      </div>} />
      {msg && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminMsgStyle}>{msg}</div>}
      {err && !open && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminErrStyle}>{err}</div>}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={BookOpen} label="全コース" value={`${rows.length}件`} tone="cyan" />
        <Stat icon={GraduationCap} label="新人研修" value={`${rows.filter(r => kindLabel(typeOf(r)) === "新人研修").length}件`} tone="green" />
        <Stat icon={Calendar} label="定常" value={`${rows.filter(r => kindLabel(typeOf(r)) === "定常").length}件`} tone="muted" />
        <Stat icon={AlertCircle} label="担当講師未設定" value={`${rows.filter(r => !(r.instructorIds || []).length).length}件`} tone={rows.some(r => !(r.instructorIds || []).length) ? "amber" : "green"} />
      </div>
      <div>
        <Card className="overflow-hidden">
          <div className={adminToolbarCls} style={{ borderBottom: `1px solid ${T.border}` }}>
            <div className={adminSearchCls} style={{ border: `1px solid ${T.border}` }}>
              <Search size={15} style={{ color: T.textMuted }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="コース名・種別・メモで検索" className="w-full bg-transparent text-sm outline-none" style={{ color: T.textPrimary }} />
            </div>
            <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }}><option>すべて</option><option>新人研修</option><option>定常</option><option>担当講師未設定</option></select>
            <Btn kind={sort.key === "name" ? "soft" : "ghost"} size="sm" icon={Pencil} onClick={() => changeSort("name")}>コース名 <SortMark k="name" /></Btn>
            <Btn kind={sort.key === "type" ? "soft" : "ghost"} size="sm" icon={Filter} onClick={() => changeSort("type")}>種別 <SortMark k="type" /></Btn>
          </div>
          <div className={adminHeaderCls} style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>
            <div className="col-span-6">コース</div><div className="col-span-3">種別</div><div className="col-span-2">担当講師</div><div className="col-span-1 text-right">操作</div>
          </div>
          {loading ? <SkeletonRows />
            : rows.length === 0 ? <EmptyState title="コースがありません" desc="「コースを作成」から登録できます" />
            : visibleRows.length === 0 ? <div className="px-4 py-8 text-center text-sm" style={{ color: T.textMuted }}>検索条件に一致するコースがありません。</div>
            : visiblePage.items.map((c, i) => {
              const active = selected?.courseId === c.courseId;
              const type = typeOf(c);
              return (
                <button key={c.courseId || i} onClick={() => selectCourse(c)} className={adminRowCls} style={{ borderTop: visiblePage.start + i ? `1px solid ${T.border}` : "none", background: active ? T.accentSubtle : "#fff" }}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: active ? "#fff" : T.accentSubtle }}><BookOpen size={15} style={{ color: T.accent }} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><div className="text-sm font-semibold" style={{ color: T.textPrimary }}>{c.name}</div><Badge tone={kindTone(type)}>{kindLabel(type)}</Badge></div>
                    {memoOf(c) && <div className="mt-0.5 truncate text-xs" style={{ color: T.textMuted }}>{memoOf(c)}</div>}
                    <div className="mt-0.5 truncate text-xs" style={{ color: T.textMuted }}>担当講師: {instructorNames(c.instructorIds)}</div>
                  </div>
                  <span className="hidden text-xs font-semibold sm:inline" style={{ color: T.accentHover }}>詳細・編集</span><ChevronRight size={16} style={{ color: T.textMuted }} />
                </button>
              );
            })}
          <ListPager page={visiblePage.page} totalPages={visiblePage.totalPages} total={visiblePage.total} onPage={setPage} />
        </Card>
      </div>
      {open && (
        <Modal title="コースを作成" onClose={() => setOpen(false)}
          footer={<><Btn kind="ghost" onClick={() => setOpen(false)}>キャンセル</Btn><Btn icon={Check} onClick={create} disabled={busy}>{busy ? "作成中…" : "作成する"}</Btn></>}>
          <div className="space-y-3">
            <Field label="コース名"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Javaエンジニア育成コース" className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="種別"><select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>{COURSE_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="説明（任意）"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className={fieldCls + " resize-none"} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            {err && <div className="rounded-lg px-3 py-2 text-xs" style={adminErrStyle}>{err}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
const ROLE_OPTS = [["trainee", "受講生"], ["instructor", "講師"], ["client", "企業担当者"], ["admin", "管理者"]];
const roleLabel = (r) => (ROLE_OPTS.find(o => o[0] === r)?.[1]) || r || "—";
const roleTone = (r) => r === "instructor" ? "cyan" : r === "admin" ? "red" : r === "client" ? "amber" : "muted";

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "trainee", tempPassword: "Feeps#1234", companyId: "", courseId: "" });
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("すべて");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState({ name: "", company: "", role: "trainee" });
  const [courseIds, setCourseIds] = useState([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [courses, setCourses] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [bulkCompanyId, setBulkCompanyId] = useState("");

  useEffect(() => {
    apiGet("/companies").then(l => setCompanies(l || [])).catch(() => setErr("企業一覧の取得に失敗しました。"));
    apiGet("/courses").then(l => setCourses(l || [])).catch(() => setErr("コース一覧の取得に失敗しました。"));
  }, []);

  function load() {
    setLoading(true);
    return apiGet("/admin/users")
      .then(list => {
        const next = list || [];
        setUsers(next);
        if (selected) {
          const fresh = next.find(x => x.userId === selected.userId);
          if (fresh) {
            setSelected(fresh);
            setEdit({ name: fresh.name || "", company: fresh.company || "", role: fresh.role || "trainee" });
          }
        }
      })
      .catch(() => setErr("ユーザー一覧の取得に失敗しました（管理者権限・再ログインをご確認ください）。"))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);
  const visibleUsers = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = users.filter(u => {
      const company = companies.find(c => c.companyId === u.company)?.name || "";
      const matchesQuery = !s || `${u.name || ""} ${u.email || ""} ${roleLabel(u.role)} ${company}`.toLowerCase().includes(s);
      const matchesRole = roleFilter === "すべて" || roleLabel(u.role) === roleFilter;
      return matchesQuery && matchesRole;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = sort.key === "role" ? roleLabel(a.role) : a[sort.key] || "";
      const bv = sort.key === "role" ? roleLabel(b.role) : b[sort.key] || "";
      return String(av).localeCompare(String(bv), "ja") * dir;
    });
  }, [users, q, roleFilter, sort, companies]);
  useEffect(() => { setPage(1); }, [q, roleFilter, sort.key, sort.dir, users.length]);
  const visiblePage = pageSlice(visibleUsers, page);
  function changeSort(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }
  async function loadUserCourses(userId) {
    if (!userId) return;
    setCourseLoading(true);
    try {
      const list = await apiGet(`/admin/users/${userId}/courses`);
      setCourseIds((list || []).map(c => c.courseId));
    } catch (e) {
      setErr("所属コースの取得に失敗しました：" + (e?.message || e));
      setCourseIds([]);
    } finally { setCourseLoading(false); }
  }
  function selectUser(u) {
    setSelected(u);
    setEdit({ name: u.name || "", company: u.company || "", role: u.role || "trainee" });
    setCourseIds([]);
    setErr("");
    setMsg("");
    if (u.role === "trainee") loadUserCourses(u.userId);
  }

  async function create() {
    setErr(""); setMsg("");
    if (!form.email.trim() || !form.tempPassword.trim()) { setErr("メールと仮パスワードは必須です。"); return; }
    setBusy(true);
    try {
      await apiPost("/admin/users", { email: form.email.trim(), name: form.name.trim(), role: form.role, tempPassword: form.tempPassword, companyId: form.companyId, courseId: form.role === "trainee" ? form.courseId : "" });
      setMsg(`${form.email.trim()} を作成しました（ロール：${roleLabel(form.role)}）。初回ログイン時にパスワード変更が必要です。`);
      setForm({ email: "", name: "", role: "trainee", tempPassword: "Feeps#1234", companyId: "", courseId: "" });
      setOpen(false);
      load();
    } catch (e) {
      const m = String(e?.message || e);
      setErr(m.includes("409") ? "このメールアドレスは既に登録済みです。" : "作成に失敗しました：" + m);
    } finally { setBusy(false); }
  }
  async function save() {
    if (!selected || busy) return;
    setErr(""); setMsg(""); setBusy(true);
    try {
      await apiPut(`/admin/users/${selected.userId}`, { name: edit.name.trim(), company: edit.company, role: edit.role });
      setMsg(`${edit.name.trim() || selected.email} を保存しました。`);
      await load();
    } catch (e) {
      setErr("保存に失敗しました：" + (e?.message || e));
    } finally { setBusy(false); }
  }
  async function deleteUser() {
    if (!selected || busy) return;
    setErr(""); setMsg(""); setBusy(true);
    try {
      await apiDelete(`/admin/users/${selected.userId}`);
      setMsg(`${selected.name || selected.email || "ユーザー"} を削除しました。`);
      setDeleteOpen(false);
      setSelected(null);
      await load();
    } catch (e) {
      setErr(e?.message || "削除に失敗しました。");
    } finally { setBusy(false); }
  }
  async function saveCourses() {
    if (!selected || busy) return;
    setErr(""); setMsg(""); setBusy(true);
    try {
      await apiPut(`/admin/users/${selected.userId}/courses`, { courseIds });
      setMsg("所属コースを保存しました。");
      await loadUserCourses(selected.userId);
    } catch (e) {
      setErr("所属コースの保存に失敗しました：" + (e?.message || e));
    } finally { setBusy(false); }
  }
  function toggleCourse(courseId) {
    setCourseIds(ids => ids.includes(courseId) ? ids.filter(id => id !== courseId) : [...ids, courseId]);
  }
  const companyName = (id) => companies.find(c => c.companyId === id)?.name || "（未選択）";
  const SortMark = ({ k }) => sort.key === k ? (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : null;

  if (selected) return (
    <div>
      <SectionHead title={selected.name || selected.email || "ユーザー詳細"} desc="基本情報、所属企業、ロール、所属コースを管理します"
        action={<Btn kind="ghost" size="sm" icon={ChevronLeft} onClick={() => { setSelected(null); setErr(""); setMsg(""); }}>ユーザー一覧に戻る</Btn>} />
      {msg && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminMsgStyle}>{msg}</div>}
      {err && !open && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminErrStyle}>{err}</div>}
      <div className="space-y-5">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={selected.name || selected.email} ring />
            <div className="min-w-0"><h3 className="truncate font-bold" style={{ color: T.textPrimary }}>基本情報</h3><p className="truncate text-xs" style={{ color: T.textMuted }}>{selected.email}</p></div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="氏名"><input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="所属企業"><select value={edit.company} onChange={e => setEdit({ ...edit, company: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>
              <option value="">未選択</option>{companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}</select></Field>
            <Field label="ロール"><select value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>
              {ROLE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <div className="rounded-xl p-3 text-xs" style={adminPanelStyle}>現在の所属企業: {companyName(selected.company)}</div>
          </div>
          {edit.role !== selected.role && <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: T.warningSubtle, color: T.warning }}>ロール変更は再ログイン後に反映されます。</div>}
          <div className="mt-4 flex flex-wrap justify-end gap-2"><Btn kind="ghost" icon={Trash2} onClick={() => setDeleteOpen(true)} disabled={busy}>削除</Btn><Btn icon={Check} onClick={save}>{busy ? "保存中..." : "保存する"}</Btn></div>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-bold" style={{ color: T.textPrimary }}><BookOpen size={16} />所属コース</h3>
            <Badge tone="cyan">{courseIds.length}件</Badge>
          </div>
          {edit.role === "trainee" ? (
            <div>
              <p className="mb-3 text-xs leading-relaxed" style={{ color: T.textMuted }}>受講生は複数コースに所属できます。研修、Eラーニング、継続利用枠をここで管理します。</p>
              {courseLoading ? <SkeletonRows rows={3} />
                : courses.length === 0 ? <div className="rounded-xl px-4 py-5 text-center text-sm" style={adminPanelStyle}>コースがありません。</div>
                : <div className="grid gap-2 md:grid-cols-2">{courses.map(c => {
                  const id = c.courseId;
                  const checked = courseIds.includes(id);
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-2 rounded-xl p-3 transition hover:bg-slate-50" style={{ background: checked ? T.accentSubtle : T.bgBase, border: `1px solid ${checked ? T.accent : T.border}` }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleCourse(id)} />
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold" style={{ color: T.textPrimary }}>{c.name}</div><div className="text-xs" style={{ color: T.textMuted }}>{kindLabel(c.type || c.kind)}</div></div>
                    </label>
                  );
                })}</div>}
              <div className="mt-4 flex justify-end"><Btn size="sm" icon={Check} onClick={saveCourses}>{busy ? "保存中..." : "所属コースを保存"}</Btn></div>
            </div>
          ) : (
            <div className="rounded-xl p-3 text-xs" style={adminPanelStyle}>所属コースは受講生ロールのユーザーに設定します。</div>
          )}
        </Card>
      </div>
      {deleteOpen && selected && <DeleteConfirm title="ユーザーを削除" name={selected.name || selected.email || selected.userId} warning="所属コース、担当コース、カルテ・日報・勤怠・テスト結果があるユーザーは削除できません。" busy={busy} onClose={() => setDeleteOpen(false)} onConfirm={deleteUser} />}
    </div>
  );

  return (
    <div>
      <SectionHead title="ユーザー管理" desc="アカウントとロールの管理・追加"
        action={<div className="flex flex-wrap items-center gap-2">
          <Btn size="sm" kind="ghost" icon={FileSpreadsheet} onClick={() => exportAdminListExcel(visibleUsers, [
            [u => u.name || "", "氏名"], [u => u.email || "", "メールアドレス"], [u => roleLabel(u.role), "ロール"], [u => u.userId || "", "ユーザーID"],
          ], "ユーザー一覧", "ユーザー一覧")}>Excel出力</Btn>
          <select value={bulkCompanyId} onChange={e => setBulkCompanyId(e.target.value)} className="rounded-xl px-3 py-2 text-xs outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }}>
            <option value="">一括登録先の企業を選択</option>
            {companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <TraineeBulkImportPanel
            label="Excelで一括登録"
            desc="選択した企業に所属する受講生アカウントを、ひな形Excelから一括作成します。"
            courses={courses}
            companyId={bulkCompanyId}
            disabledReason={bulkCompanyId ? "" : "先に一括登録先の企業を選択してください"}
            onCompleted={load}
          />
          <Btn size="sm" icon={Plus} onClick={() => { setOpen(true); setErr(""); setMsg(""); }}>ユーザーを追加</Btn>
        </div>} />
      {msg && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminMsgStyle}>{msg}</div>}
      {err && !open && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminErrStyle}>{err}</div>}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="全ユーザー" value={`${users.length}名`} tone="cyan" />
        <Stat icon={GraduationCap} label="受講生" value={`${users.filter(u => u.role === "trainee").length}名`} tone="green" />
        <Stat icon={ShieldCheck} label="運営ロール" value={`${users.filter(u => u.role !== "trainee").length}名`} tone="muted" sub="講師・企業担当者・管理者" />
        <Stat icon={AlertCircle} label="所属企業未設定" value={`${users.filter(u => !u.company).length}名`} tone={users.some(u => !u.company) ? "amber" : "green"} />
      </div>
      <div>
        <Card className="overflow-hidden">
          <div className={adminToolbarCls} style={{ borderBottom: `1px solid ${T.border}` }}>
            <div className={adminSearchCls} style={{ border: `1px solid ${T.border}` }}>
              <Search size={15} style={{ color: T.textMuted }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="氏名・メール・ロールで検索" className="w-full bg-transparent text-sm outline-none" style={{ color: T.textPrimary }} />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }}><option>すべて</option>{ROLE_OPTS.map(([, label]) => <option key={label}>{label}</option>)}</select>
            <Btn kind={sort.key === "name" ? "soft" : "ghost"} size="sm" icon={User} onClick={() => changeSort("name")}>氏名 <SortMark k="name" /></Btn>
            <Btn kind={sort.key === "email" ? "soft" : "ghost"} size="sm" icon={Mail} onClick={() => changeSort("email")}>メール <SortMark k="email" /></Btn>
            <Btn kind={sort.key === "role" ? "soft" : "ghost"} size="sm" icon={ShieldCheck} onClick={() => changeSort("role")}>ロール <SortMark k="role" /></Btn>
          </div>
          <div className={adminHeaderCls} style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>
            <div className="col-span-6">ユーザー</div><div className="col-span-4">所属企業</div><div className="col-span-1">ロール</div><div className="col-span-1 text-right">操作</div>
          </div>
          {loading ? <SkeletonRows />
            : users.length === 0 ? <div className="px-4 py-8 text-center text-sm" style={{ color: T.textMuted }}>まだユーザーがいません。「ユーザーを追加」から作成できます。</div>
            : visibleUsers.length === 0 ? <div className="px-4 py-8 text-center text-sm" style={{ color: T.textMuted }}>検索条件に一致するユーザーがいません。</div>
            : visiblePage.items.map((u, i) => {
              const active = selected?.userId === u.userId;
              return (
                <button key={u.userId || i} onClick={() => selectUser(u)} className={adminRowCls + " justify-between"} style={{ borderTop: visiblePage.start + i ? `1px solid ${T.border}` : "none", background: active ? T.accentSubtle : "#fff" }}>
                  <div className="flex min-w-0 items-center gap-3"><Avatar name={u.name || u.email} /><div className="min-w-0"><div className="truncate text-sm font-semibold" style={{ color: T.textPrimary }}>{u.name || "（氏名未設定）"}</div><div className="truncate text-xs" style={{ color: T.textMuted }}>{u.email}</div></div></div>
                  <div className="flex shrink-0 items-center gap-2"><span className="hidden max-w-36 truncate text-xs sm:inline" style={{ color: T.textMuted }}>{companyName(u.company)}</span><Badge tone={roleTone(u.role)}>{roleLabel(u.role)}</Badge><span className="hidden text-xs font-semibold lg:inline" style={{ color: T.accentHover }}>詳細・編集</span><ChevronRight size={16} style={{ color: T.textMuted }} /></div>
                </button>
              );
            })}
          <ListPager page={visiblePage.page} totalPages={visiblePage.totalPages} total={visiblePage.total} onPage={setPage} />
        </Card>
      </div>

      {open && (
        <Modal title="ユーザーを追加" desc="ロールと所属を設定して、初回ログイン用アカウントを作成します。" onClose={busy ? undefined : () => setOpen(false)} footer={<><Btn kind="ghost" onClick={() => setOpen(false)} disabled={busy}>キャンセル</Btn><Btn icon={Check} onClick={create} disabled={busy}>{busy ? "作成中…" : "作成する"}</Btn></>}>
          <div className="space-y-3">
            <Field label="メールアドレス"><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" placeholder="user@example.com" className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="氏名"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="山田 太郎" className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="ロール"><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>{ROLE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="所属企業（任意）"><select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}><option value="">（未選択）</option>{companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}</select></Field>
            {form.role === "trainee" && <Field label="所属コース（任意）"><select value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}><option value="">（未選択）</option>{courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name}（{kindLabel(c.kind)}）</option>)}</select></Field>}
            <Field label="仮パスワード（初回ログイン時に変更）"><input value={form.tempPassword} onChange={e => setForm({ ...form, tempPassword: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            {err && <div className="rounded-lg px-3 py-2 text-xs" style={adminErrStyle}>{err}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ===== スキルマップ / ポートフォリオ / リスク分析 ===== */

export { AdminHome, AdminCompanies, AdminCourses, AdminUsers };
