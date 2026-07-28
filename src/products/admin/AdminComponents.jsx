import React, { useEffect, useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { apiGet, apiPut, apiPost } from "../../api.js";
import {
  Card, Badge, Btn, Avatar, Stat, SectionHead, Field, Modal, T, PageHeader, ProductNavCard, SkeletonRows, SkeletonCards,
  PRISM, PrismPage, PrismCard, PrismHomeHeading, PrismKpiCard, PrismSectionTitle, PrismErrorRetryCard,
  TraineeBulkImportPanel,
} from "../../components/common";
import { EmptyState } from "../training/TrainingComponents.jsx";
import { todayStr } from "../training/useTraining.js";
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
  const [dash, setDash] = useState(null);
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
    // 2026-07-21 監査対応: 「本日のアラート」「優先して確認する研修」は「今日」基準のraw集計だと
    // 非研修日に全コースが一律「要確認」化してしまう（オオカミ少年化）ため、直近研修日までの
    // 未解消異常を累積で数える/dashboard/adminの集計結果を使う（dashboard.mjs参照）。
    apiGet("/dashboard/admin?date=" + date).then(setDash).catch(e => { console.warn("admin dashboard failed", e); setDash(null); });
  }, [date]);
  const trainees = users.filter(u => u.role === "trainee");
  const reportIds = new Set(reports.map(r => r.traineeId));
  const attendanceIds = new Set(attendance.map(r => r.traineeId));
  const traineeIds = new Set(trainees.map(t => t.userId));
  const reportSubmitted = trainees.filter(t => reportIds.has(t.userId)).length;
  const attendanceRegistered = trainees.filter(t => attendanceIds.has(t.userId)).length;
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
    return { ...c, members, companyCount: companyIds.size, reportCount, attendanceCount };
  });
  // 「要確認研修」「本日のアラート」はdashboard.mjsの累積未解消集計（直近研修日基準）を正とする。
  // 取得前・失敗時はraw今日集計にフォールバックする（0件偽装はしない）。
  const dashCourses = dash?.courses || null;
  const attentionCourses = dashCourses
    ? courseSummaries.filter(c => dashCourses.find(dc => dc.courseId === c.courseId && (dc.status === "needs_attention" || dc.status === "unassigned")))
    : courseSummaries.filter(c => c.members.length > 0 && (c.reportCount < c.members.length || c.attendanceCount < c.members.length));
  const followUpStudents = dash?.summary?.followUpStudents;
  const alertCount = followUpStudents != null ? followUpStudents : (reportMissingCount + attendanceMissingCount + attentionCourses.length);
  const followUps = dash?.followUps || [];
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
        <PrismKpiCard icon={Clock} label="出席登録率" value={`${attendanceRate}%`} detail={`${attendanceRegistered}/${trainees.length}名 登録（本日）`} tone={attendanceMissingCount ? "warn" : "ok"} onClick={() => go && go("attendance")} />
        <PrismKpiCard icon={NotebookPen} label="日報提出率" value={`${reportRate}%`} detail={`${reportSubmitted}/${trainees.length}名 提出（本日）`} tone={reportMissingCount ? "warn" : "ok"} onClick={() => go && go("reports")} />
        <PrismKpiCard icon={AlertCircle} label="要フォロー" value={alertCount} unit="名" detail="直近研修日までの未解消異常" tone={alertCount ? "bad" : "ok"} />
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
          desc="直近研修日までに欠席・遅刻・早退・勤怠未登録・日報未提出などの未解消異常があるコースです（今日が研修日かは問いません）。"
          action={<div className="flex flex-wrap gap-2"><Badge tone={attentionCourses.length ? "amber" : "green"}>{attentionCourses.length}件</Badge><Btn size="sm" kind="ghost" icon={NotebookPen} onClick={() => go && go("reports")}>日報</Btn><Btn size="sm" kind="soft" icon={Clock} onClick={() => go && go("attendance")}>勤怠</Btn></div>}
        />
        <div className="grid gap-2 md:grid-cols-2">
          {attentionCourses.length ? attentionCourses.slice(0, 6).map(c => (
            <div key={c.courseId} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: PRISM.warnSubtle, border: `1px solid ${PRISM.warnLine}` }}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: PRISM.surface, color: PRISM.warn }}><AlertCircle size={17} /></span>
              <div className="min-w-0 flex-1"><div className="truncate font-semibold" style={{ color: PRISM.ink }}>{c.name}</div><div className="mt-1 text-xs" style={{ color: PRISM.sub }}>所属{c.members.length}名 ・ 本日日報 {c.reportCount}/{c.members.length} ・ 本日出席 {c.attendanceCount}/{c.members.length}</div></div>
              <Btn size="sm" kind="ghost" icon={ChevronRight} onClick={() => openCourse(c.courseId)}>開く</Btn>
            </div>
          )) : <div className="rounded-2xl p-4 text-sm md:col-span-2" style={{ background: PRISM.okSubtle, color: PRISM.ok }}>現在要確認の研修はありません。</div>}
        </div>
      </PrismCard>

      <PrismCard className="p-4 sm:p-5">
        <PrismSectionTitle
          title="要フォロー受講生"
          desc="欠席・遅刻・早退・勤怠未登録・日報未提出・テスト未受験を、直近研修日までの累積かつ理由別に表示します。"
          action={<Badge tone={followUps.length ? "amber" : "green"}>{followUps.length}名</Badge>}
        />
        {followUps.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {followUps.slice(0, 8).map(f => (
              <div key={f.traineeId} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: PRISM.base, border: `1px solid ${PRISM.line}` }}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: PRISM.accent }}>{String(f.traineeName || "?").slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold" style={{ color: PRISM.ink }}>{f.traineeName}</div>
                  <div className="truncate text-xs" style={{ color: PRISM.mut }}>{f.companyName || f.courseName}</div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {(f.reasons || []).slice(0, 2).map((r, i) => (
                    <Badge key={i} tone={r.severity === "critical" ? "red" : r.severity === "warning" ? "amber" : "cyan"}>{r.label}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : <div className="rounded-2xl p-4 text-sm" style={{ background: PRISM.okSubtle, color: PRISM.ok }}>現在フォローが必要な受講生はいません。</div>}
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
const LIST_PAGE_SIZES = [12, 30, 50, 100];
function pageSlice(rows, page, size = LIST_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * size;
  return { items: rows.slice(start, start + size), page: safePage, totalPages, total: rows.length, start };
}
// ページ番号へ直接飛べるページャ。件数が多い一覧で「前へ/次へ」だけだと目的の行まで遠いため、
// 表示件数の切り替えとページ番号ボタン（現在位置の前後2ページ＋先頭/末尾）を持たせる。
function pageNumbers(page, totalPages) {
  const set = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...set].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b);
}
function ListPager({ page, totalPages, total, onPage, size, onSize, start = 0 }) {
  const showSize = typeof onSize === "function";
  if (totalPages <= 1 && !(showSize && total > LIST_PAGE_SIZE)) return null;
  const nums = pageNumbers(page, totalPages);
  const end = Math.min(start + (size || LIST_PAGE_SIZE), total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs font-semibold" style={{ color: T.textMuted }}>{total}件中 {total === 0 ? 0 : start + 1}〜{end}件</div>
        {showSize && (
          <label className="flex items-center gap-1.5 text-xs" style={{ color: T.textMuted }}>表示件数
            <select value={size || LIST_PAGE_SIZE} onChange={e => onSize(Number(e.target.value))} className="rounded-lg px-2 py-1 text-xs outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }}>
              {LIST_PAGE_SIZES.map(n => <option key={n} value={n}>{n}件</option>)}
            </select>
          </label>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <Btn kind="ghost" size="sm" icon={ChevronLeft} onClick={() => onPage(page - 1)} disabled={page <= 1}>前へ</Btn>
          {nums.map((n, i) => (
            <span key={n} className="flex items-center gap-1">
              {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-xs" style={{ color: T.textMuted }}>…</span>}
              <button type="button" onClick={() => onPage(n)} className="min-w-[28px] rounded-lg px-2 py-1 text-xs font-semibold"
                style={n === page ? { background: T.accent, color: "#fff" } : { border: `1px solid ${T.border}`, color: T.textSecondary }}>{n}</button>
            </span>
          ))}
          <Btn kind="ghost" size="sm" icon={ChevronRight} onClick={() => onPage(page + 1)} disabled={page >= totalPages}>次へ</Btn>
        </div>
      )}
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
  const [pageSize, setPageSize] = useState(LIST_PAGE_SIZE);
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
  const visiblePage = pageSlice(visibleRows, page, pageSize);
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
            <div className="min-w-0"><h3 className="truncate font-bold" style={{ color: T.textPrimary }}>企業基本情報</h3><p className="text-xs" style={{ color: T.textMuted }}>{[selected.address, selected.tel].filter(Boolean).join(" ・ ") || "住所・電話は未登録です"}</p></div>
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
          <ListPager page={visiblePage.page} totalPages={visiblePage.totalPages} total={visiblePage.total} onPage={setPage} size={pageSize} onSize={n => { setPageSize(n); setPage(1); }} start={visiblePage.start} />
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
  const [pageSize, setPageSize] = useState(LIST_PAGE_SIZE);
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(courseEditValue());
  const [trainees, setTrainees] = useState([]);
  const [users, setUsers] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [addTraineeIds, setAddTraineeIds] = useState([]);
  const [addTraineeQuery, setAddTraineeQuery] = useState("");
  const [traineeListOpen, setTraineeListOpen] = useState(false);
  const [traineeSectionOpen, setTraineeSectionOpen] = useState(false);
  const [bulkRange, setBulkRange] = useState({ from: "", to: "" });
  const [showArchivedCourses, setShowArchivedCourses] = useState(false);
  // 誤操作防止のため、コース詳細は既定で閲覧モード。編集ボタンを押した間だけ入力できる。
  const [courseEditMode, setCourseEditMode] = useState(false);
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
      // 終了したコースは既定で隠す（statusが無い既存コースはactive扱い）
      const matchesStatus = showArchivedCourses || r.status !== "archived";
      return matchesQuery && matchesFilter && matchesStatus;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = sort.key === "type" ? kindLabel(typeOf(a)) : a.name || "";
      const bv = sort.key === "type" ? kindLabel(typeOf(b)) : b.name || "";
      return String(av).localeCompare(String(bv), "ja") * dir;
    });
  }, [rows, q, courseFilter, sort, instructors, showArchivedCourses]);
  useEffect(() => { setPage(1); }, [q, courseFilter, sort.key, sort.dir, rows.length, showArchivedCourses]);
  const visiblePage = pageSlice(visibleRows, page, pageSize);
  function changeSort(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }
  async function selectCourse(c) {
    setCourseEditMode(false);
    setActiveCourseId(c.courseId);
    setSelected(c);
    setEdit(courseEditValue(c));
    setErr("");
    setMsg("");
    setDetailLoading(true);
    setTrainees([]);
    setAddTraineeIds([]);
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
  // 研修カレンダーの一括設定。49日分を1日ずつラジオで選ぶ運用を避けるため、
  // 期間指定・平日/土日・表示中の月に対してまとめてtypeを適用する。
  function bulkSetCalendar({ from, to, type, weekdaysOnly = false, weekendOnly = false }) {
    const start = from || `${calendarMonth}-01`;
    const endDefault = new Date(Number(calendarMonth.slice(0, 4)), Number(calendarMonth.slice(5, 7)), 0);
    const end = to || `${calendarMonth}-${String(endDefault.getDate()).padStart(2, "0")}`;
    if (start > end) { setErr("開始日が終了日より後になっています。"); return; }
    const targets = [];
    for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (weekdaysOnly && (day === 0 || day === 6)) continue;
      if (weekendOnly && day !== 0 && day !== 6) continue;
      targets.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    if (!targets.length) { setMsg("対象の日がありません。"); return; }
    setCalendarItems(items => {
      const next = { ...items };
      for (const date of targets) {
        const base = next[date] || { date, type: "training", title: "", note: "" };
        next[date] = { ...base, type };
      }
      return next;
    });
    setCalendarDirty(d => {
      const next = { ...d };
      for (const date of targets) next[date] = true;
      return next;
    });
    setErr("");
    setMsg(`${targets.length}日を「${(CAL_TYPES.find(([v]) => v === type) || [])[1] || type}」にしました。内容を確認して「保存」を押してください。`);
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
        status: item.status === "archived" ? "archived" : "active",
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
        status: edit.status || "active",
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
  // 受講生の一括追加。1人ずつ選ぶ運用だと50名のコースで50往復になるため、
  // 複数選択（企業単位の一括選択つき）で既存APIへ逐次POSTする。
  async function addTrainees(ids) {
    const targets = (ids || []).filter(Boolean);
    if (!selected || !targets.length || busy) return;
    setBusy(true); setErr(""); setMsg("");
    const failed = [];
    try {
      for (const traineeId of targets) {
        try {
          await apiPost(`/courses/${selected.courseId}/trainees`, { traineeId });
        } catch (e) {
          failed.push(`${traineeName(traineeId)}（${e?.errorMessage || e?.message || e}）`);
        }
      }
      setAddTraineeIds([]);
      await reloadCourseTrainees(selected.courseId);
      if (failed.length) setErr(`${failed.length}名の追加に失敗しました：${failed.join(" / ")}`);
      else setMsg(`${targets.length}名をコースに追加しました。`);
    } finally { setBusy(false); }
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
  const traineeName = (id) => {
    const u = users.find(x => x.userId === id);
    return u?.name || u?.email || id;
  };
  const traineeOptions = useMemo(() => {
    const enrolled = new Set(trainees.map(t => t.userId));
    return users.filter(u => u.role === "trainee" && !enrolled.has(u.userId));
  }, [users, trainees]);
  const traineeCandidates = useMemo(() => {
    const q = addTraineeQuery.trim().toLowerCase();
    if (!q) return traineeOptions;
    return traineeOptions.filter(t => [t.name, t.email, companyName(t.company)]
      .some(v => String(v || "").toLowerCase().includes(q)));
  }, [traineeOptions, addTraineeQuery, companies]);
  const candidateCompanies = useMemo(() => {
    const ids = [...new Set(traineeOptions.map(t => t.company).filter(Boolean))];
    return ids.map(id => ({ companyId: id, name: companyName(id), count: traineeOptions.filter(t => t.company === id).length }));
  }, [traineeOptions, companies]);
  const toggleAddTrainee = (id) => setAddTraineeIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
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
        action={<div className="flex flex-wrap items-center justify-end gap-2">
          {courseEditMode
            ? <Btn kind="ghost" size="sm" onClick={() => { setCourseEditMode(false); setEdit(courseEditValue(selected)); setMsg("閲覧モードに戻しました。保存していない変更は破棄されます。"); }}>編集をやめる</Btn>
            : <Btn size="sm" icon={Pencil} onClick={() => setCourseEditMode(true)}>編集する</Btn>}
          <select value={selected.courseId} onChange={e => { const next = rows.find(row => row.courseId === e.target.value); if (next) selectCourse(next); }} className="min-w-52 rounded-xl px-3 py-2 text-sm font-semibold outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }}>{rows.map(row => <option key={row.courseId} value={row.courseId}>{row.name || row.courseId}</option>)}</select><Btn kind="ghost" size="sm" icon={ChevronLeft} onClick={() => { setSelected(null); setErr(""); setMsg(""); }}>コース一覧</Btn></div>} />
      {msg && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminMsgStyle}>{msg}</div>}
      {err && <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={adminErrStyle}>{err}</div>}
      {!courseEditMode && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: T.bgBase, color: T.textSecondary }}>
        <span>閲覧モードです。誤操作を防ぐため入力できません。変更するときは右上の「編集する」を押してください。</span>
        <Btn size="sm" icon={Pencil} onClick={() => setCourseEditMode(true)}>編集する</Btn>
      </div>}
      <Card className="mb-5 p-4">
        <div className="mb-3"><h3 className="font-bold" style={{ color: T.textPrimary }}>このコースの運用メニュー</h3><p className="text-xs" style={{ color: T.textMuted }}>選択中のコースを引き継いで、各管理画面を開きます。</p></div>
        <div className="flex flex-wrap gap-2"><Btn kind="soft" size="sm" icon={Calendar} onClick={() => go?.("curriculum")}>カリキュラム</Btn><Btn kind="ghost" size="sm" icon={NotebookPen} onClick={() => go?.("reports")}>日報</Btn><Btn kind="ghost" size="sm" icon={Clock} onClick={() => go?.("attendance")}>勤怠</Btn><Btn kind="ghost" size="sm" icon={ClipboardCheck} onClick={() => go?.("tests")}>テスト</Btn><Btn kind="ghost" size="sm" icon={FileSpreadsheet} onClick={() => go?.("materials")}>研修資料</Btn><Btn kind="ghost" size="sm" icon={Users} onClick={() => go?.("trainees")}>受講生</Btn></div>
      </Card>
      <div className="space-y-5">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentSubtle, color: T.accent }}><BookOpen size={17} /></div><div><h3 className="font-bold" style={{ color: T.textPrimary }}>コース基本情報</h3><p className="text-xs" style={{ color: T.textMuted }}>{[kindLabel(typeOf(selected)), [selected.startDate, selected.endDate].filter(Boolean).join(" 〜 ")].filter(Boolean).join(" ・ ") || "期間は未設定です"}</p></div></div>
            <Btn kind="ghost" icon={Calendar} onClick={() => go && go("curriculum")}>カリキュラムを編集</Btn>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="コース名"><input disabled={!courseEditMode} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="種別"><select disabled={!courseEditMode} value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>{COURSE_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <div className="lg:col-span-2"><Field label="メモ"><textarea disabled={!courseEditMode} value={edit.memo} onChange={e => setEdit({ ...edit, memo: e.target.value })} rows={3} className={fieldCls + " resize-none"} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field></div>
            <Field label="研修開始日"><input disabled={!courseEditMode} type="date" value={edit.startDate} onChange={e => setEdit({ ...edit, startDate: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="研修終了日"><input disabled={!courseEditMode} type="date" value={edit.endDate} onChange={e => setEdit({ ...edit, endDate: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準開始時刻"><input disabled={!courseEditMode} type="time" value={edit.standardClockIn} onChange={e => setEdit({ ...edit, standardClockIn: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準終了時刻"><input disabled={!courseEditMode} type="time" value={edit.standardClockOut} onChange={e => setEdit({ ...edit, standardClockOut: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準昼休み（開始）"><input disabled={!courseEditMode} type="time" value={edit.lunchBreakStart} onChange={e => setEdit({ ...edit, lunchBreakStart: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準昼休み（終了）"><input disabled={!courseEditMode} type="time" value={edit.lunchBreakEnd} onChange={e => setEdit({ ...edit, lunchBreakEnd: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準受講形式"><select disabled={!courseEditMode} value={edit.mode} onChange={e => setEdit({ ...edit, mode: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}><option value="">未設定</option><option value="online">オンライン</option><option value="onsite">対面</option><option value="hybrid">ハイブリッド</option></select></Field>
            <Field label="標準会場名"><input disabled={!courseEditMode} value={edit.venueName} onChange={e => setEdit({ ...edit, venueName: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準会場住所"><input disabled={!courseEditMode} value={edit.venueAddress} onChange={e => setEdit({ ...edit, venueAddress: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
            <Field label="標準オンラインURL"><input disabled={!courseEditMode} type="url" value={edit.onlineUrl} onChange={e => setEdit({ ...edit, onlineUrl: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /></Field>
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
          <div className="mt-4 flex flex-wrap justify-end gap-2"><Btn kind="ghost" onClick={async () => {
            const next = edit.status === "archived" ? "active" : "archived";
            if (!window.confirm(next === "archived" ? "このコースを「終了」にします。コース一覧の既定表示から外れます（データは残ります）。" : "このコースを「稼働中」に戻します。")) return;
            try {
              await apiPut(`/courses/${selected.courseId}`, { name: edit.name.trim(), type: edit.type, memo: edit.memo.trim(), status: next });
              setEdit(e => ({ ...e, status: next }));
              setMsg(next === "archived" ? "コースを終了にしました。" : "コースを稼働中に戻しました。");
              await load();
            } catch (e) { setErr("状態の変更に失敗しました：" + (e?.errorMessage || e?.message || e)); }
          }} disabled={busy}>{edit.status === "archived" ? "稼働中に戻す" : "コースを終了にする"}</Btn><Btn kind="ghost" icon={Trash2} onClick={() => setDeleteOpen(true)} disabled={busy || !courseEditMode}>削除</Btn><Btn icon={Check} onClick={save}>{busy ? "保存中…" : "保存する"}</Btn></div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 font-bold" style={{ color: T.textPrimary }}><Users size={16} />所属受講生</h3>
            <div className="flex items-center gap-2">
              <Badge tone="cyan">{trainees.length}名</Badge>
              <Btn kind="ghost" size="sm" onClick={() => setTraineeSectionOpen(v => !v)}>{traineeSectionOpen ? "閉じる" : "開く"}</Btn>
            </div>
          </div>
          <div className="mb-3 rounded-xl p-3 text-xs leading-relaxed" style={adminPanelStyle}>このコースには複数企業の受講生を所属できます。合同研修や研修後のEラーニング利用にも対応します。</div>
          <div className="mb-3 rounded-xl p-3" style={adminPanelStyle}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold" style={{ color: T.textPrimary }}>未所属の受講生を追加<span className="ml-2 text-xs font-normal" style={{ color: T.textMuted }}>{traineeOptions.length}名が未所属</span></div>
              <div className="flex flex-wrap items-center gap-2">
                {addTraineeIds.length > 0 && <Badge tone="cyan">{addTraineeIds.length}名選択中</Badge>}
                <Btn size="sm" icon={Plus} disabled={busy || !courseEditMode || !addTraineeIds.length} onClick={() => addTrainees(addTraineeIds)}>{busy ? "追加中…" : `選択した${addTraineeIds.length || ""}名を追加`}</Btn>
              </div>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input value={addTraineeQuery} onChange={e => { setAddTraineeQuery(e.target.value); setTraineeListOpen(true); }} placeholder="氏名・メール・企業で絞り込み" className="min-w-[200px] flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }} />
              <Btn kind="ghost" size="sm" onClick={() => setTraineeListOpen(v => !v)}>{traineeListOpen ? "一覧を閉じる" : "一覧から選ぶ"}</Btn>
            </div>
            {candidateCompanies.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs" style={{ color: T.textMuted }}>企業ごとにまとめて選択:</span>
                {candidateCompanies.map(c => (
                  <button key={c.companyId} type="button" onClick={() => setAddTraineeIds(s => [...new Set([...s, ...traineeOptions.filter(t => t.company === c.companyId).map(t => t.userId)])])}
                    className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ border: `1px solid ${T.border}`, color: T.textSecondary, background: T.bgSurface }}>{c.name} {c.count}名</button>
                ))}
                {addTraineeIds.length > 0 && <button type="button" onClick={() => setAddTraineeIds([])} className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ color: T.textMuted }}>選択を解除</button>}
              </div>
            )}
            {traineeListOpen && (
              <div className="max-h-64 overflow-y-auto rounded-xl" style={{ border: `1px solid ${T.border}`, background: T.bgSurface }}>
                {traineeCandidates.length === 0
                  ? <div className="px-3 py-4 text-center text-xs" style={{ color: T.textMuted }}>該当する受講生がいません。</div>
                  : traineeCandidates.map(t => (
                    <label key={t.userId} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm" style={{ borderBottom: `1px solid ${T.border}` }}>
                      <input type="checkbox" checked={addTraineeIds.includes(t.userId)} onChange={() => toggleAddTrainee(t.userId)} />
                      <span className="truncate" style={{ color: T.textPrimary }}>{t.name || t.email}</span>
                      <span className="truncate text-xs" style={{ color: T.textMuted }}>{t.email} / {companyName(t.company)}</span>
                    </label>
                  ))}
              </div>
            )}
          </div>
          {!traineeSectionOpen
            ? <div className="rounded-xl px-4 py-3 text-center text-xs" style={adminPanelStyle}>所属受講生{trainees.length}名。「開く」で一覧を表示します（この下に研修カレンダーがあります）。</div>
            : detailLoading ? <SkeletonCards count={2} />
            : trainees.length === 0 ? <div className="rounded-xl px-4 py-5 text-center text-sm" style={adminPanelStyle}>所属受講生はいません。</div>
            : <div className="grid gap-2 md:grid-cols-2">{trainees.map(t => <div key={t.userId} className="flex items-center gap-2 rounded-xl p-2" style={{ background: T.bgBase }}><Avatar name={t.name || t.email} size={28} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold" style={{ color: T.textPrimary }}>{t.name || "（氏名未設定）"}</div><div className="truncate text-xs" style={{ color: T.textMuted }}>{t.email || t.userId} / {companyName(t.company)}</div></div><Btn kind="ghost" size="sm" icon={X} disabled={!courseEditMode} onClick={() => removeTrainee(t.userId)}>解除</Btn></div>)}</div>}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="flex items-center gap-1.5 font-bold" style={{ color: T.textPrimary }}><Calendar size={16} />研修カレンダー</h3><p className="mt-1 text-xs" style={{ color: T.textMuted }}>休日・振替日・日ごとの時刻・受講形式・担当講師を設定できます。</p></div><div className="flex flex-wrap items-center gap-2"><Badge tone={workdays.status === "setup_required" ? "amber" : "green"}>{workdays.status === "setup_required" ? "日程設定が必要" : `研修日 ${workdays.trainingDaysCount ?? 0}日`}</Badge><input type="month" value={calendarMonth} onChange={e => setCalendarMonth(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /><Btn size="sm" icon={Check} disabled={!courseEditMode || calendarBusy} onClick={saveCalendar}>{calendarBusy ? "保存中…" : "保存"}</Btn></div></div>
          <div className="mb-3 rounded-xl p-3" style={adminPanelStyle}>
            <div className="mb-2 text-sm font-bold" style={{ color: T.textPrimary }}>まとめて設定</div>
            <div className="mb-2 flex flex-wrap items-end gap-2">
              <Field label="開始日"><input type="date" value={bulkRange.from} onChange={e => setBulkRange(s => ({ ...s, from: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }} /></Field>
              <Field label="終了日"><input type="date" value={bulkRange.to} onChange={e => setBulkRange(s => ({ ...s, to: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }} /></Field>
              <Btn size="sm" disabled={!courseEditMode} onClick={() => setBulkRange({ from: selected?.startDate || "", to: selected?.endDate || "" })}>研修期間を入れる</Btn>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" icon={Check} disabled={!courseEditMode} onClick={() => bulkSetCalendar({ ...bulkRange, type: "training", weekdaysOnly: true })}>平日を研修日にする</Btn>
              <Btn kind="ghost" size="sm" disabled={!courseEditMode} onClick={() => bulkSetCalendar({ ...bulkRange, type: "holiday", weekendOnly: true })}>土日を休日にする</Btn>
              <Btn kind="ghost" size="sm" disabled={!courseEditMode} onClick={() => bulkSetCalendar({ ...bulkRange, type: "training" })}>全日を研修日にする</Btn>
              <Btn kind="ghost" size="sm" disabled={!courseEditMode} onClick={() => bulkSetCalendar({ ...bulkRange, type: "holiday" })}>全日を休日にする</Btn>
            </div>
            <p className="mt-2 text-xs" style={{ color: T.textMuted }}>日付を空にすると表示中の月が対象になります。適用後は内容を確認して「保存」を押してください。</p>
          </div>
          {calendarLoading ? <SkeletonRows rows={3} />
            : <>
              <div className="space-y-2 md:hidden">
                {calendarCells.filter(row => !row.blank).map(row => <div key={row.date} className="rounded-xl p-3" style={{ background: row.isTrainingDay ? "#fff" : T.bgBase, border: `1px solid ${row.dirty ? T.accent : T.border}` }}>
                  <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="text-sm font-bold" style={{ color: T.textPrimary }}>{Number(row.date.slice(8, 10))}日</span><Badge tone={row.isTrainingDay ? "green" : "muted"}>{row.isTrainingDay ? "研修日" : "非研修日"}</Badge></div>{row.dirty && <Badge tone="cyan">変更あり</Badge>}</div>
                  <div className="grid gap-2 sm:grid-cols-3"><select value={row.type} disabled={!courseEditMode} onChange={e => updateCalendar(row.date, { type: e.target.value })} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }}>{CAL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><input value={row.title} disabled={!courseEditMode} onChange={e => updateCalendar(row.date, { title: e.target.value })} placeholder="タイトル" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface }} /><Btn kind="ghost" size="sm" icon={Pencil} disabled={!courseEditMode} onClick={() => setCalendarEditDate(row.date)}>日別設定</Btn></div>
                </div>)}
              </div>
              <div className="hidden overflow-x-auto md:block"><div className="grid grid-cols-7 gap-1.5" style={{ minWidth: 900 }}>{["月", "火", "水", "木", "金", "土", "日"].map(d => <div key={d} className="px-2 py-1 text-center text-xs font-bold" style={{ color: T.textMuted }}>{d}</div>)}{calendarCells.map((row, i) => row.blank ? <div key={row.key || i} className="min-h-[150px] rounded-xl" style={{ background: T.bgBase, border: `1px dashed ${T.border}` }} /> : <div key={row.date} className="min-h-[150px] rounded-xl p-2" style={{ background: row.isTrainingDay ? T.bgSurface : T.bgBase, border: `1px solid ${row.dirty ? T.accent : T.border}` }}><div className="mb-1 flex items-center justify-between gap-1"><span className="text-sm font-bold" style={{ color: T.textPrimary }}>{Number(row.date.slice(8, 10))}</span>{row.dirty && <span className="h-2 w-2 rounded-full" style={{ background: T.accent }} title="変更あり" />}</div><div className="mb-1 flex flex-wrap gap-1"><Badge tone={row.isTrainingDay ? "green" : "muted"}>{row.isTrainingDay ? "研修日" : "非研修日"}</Badge><Badge tone={calTypeTone(row.type)}>{calTypeLabel(row.type)}</Badge></div>{(row.title || row.note) && <div className="mb-1 line-clamp-2 text-xs" style={{ color: T.textMuted }}>{row.title || row.note}</div>}<div className="space-y-1.5"><select value={row.type} disabled={!courseEditMode} onChange={e => updateCalendar(row.date, { type: e.target.value })} className="w-full rounded-xl px-2 py-1.5 text-xs outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>{CAL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><input value={row.title} disabled={!courseEditMode} onChange={e => updateCalendar(row.date, { title: e.target.value })} placeholder="タイトル" className="w-full rounded-xl px-2 py-1.5 text-xs outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} /><Btn kind="ghost" size="sm" icon={Pencil} disabled={!courseEditMode} onClick={() => setCalendarEditDate(row.date)}>日別設定</Btn></div></div>)}</div></div>
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
        <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.textMuted }}>
          <input type="checkbox" checked={showArchivedCourses} onChange={e => setShowArchivedCourses(e.target.checked)} />終了したコースも表示
        </label><Btn size="sm" icon={Plus} onClick={() => { setOpen(true); setErr(""); setMsg(""); }}>コースを作成</Btn>
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
          <ListPager page={visiblePage.page} totalPages={visiblePage.totalPages} total={visiblePage.total} onPage={setPage} size={pageSize} onSize={n => { setPageSize(n); setPage(1); }} start={visiblePage.start} />
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
  const [form, setForm] = useState({ email: "", name: "", role: "trainee", tempPassword: "Feeps#1234", companyId: "", courseId: "", adminTier: "standard", canEditReportsAttendance: false, assignedCourseIds: [] });
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("すべて");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIST_PAGE_SIZE);
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState({ name: "", company: "", role: "trainee" });
  const [adminPerm, setAdminPerm] = useState({ adminTier: "standard", canEditReportsAttendance: false, assignedCourseIds: [] });
  const [adminPermBusy, setAdminPermBusy] = useState(false);
  const [myProfile, setMyProfile] = useState(null);
  const [courseIds, setCourseIds] = useState([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [courses, setCourses] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [bulkCompanyId, setBulkCompanyId] = useState("");
  // 管理者内の「スーパー管理者」判定。一般管理者への権限付与UIはスーパー管理者にのみ表示する（表示制御のみ・正本はBackend）。
  const isSuperAdminViewer = !!myProfile && myProfile.role === "admin" && myProfile.adminTier !== "standard";

  useEffect(() => {
    apiGet("/companies").then(l => setCompanies(l || [])).catch(() => setErr("企業一覧の取得に失敗しました。"));
    apiGet("/courses").then(l => setCourses(l || [])).catch(() => setErr("コース一覧の取得に失敗しました。"));
    apiGet("/profile/me").then(p => setMyProfile(p || null)).catch(() => setMyProfile(null));
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
  const visiblePage = pageSlice(visibleUsers, page, pageSize);
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
    setAdminPerm({
      adminTier: u.adminTier === "standard" ? "standard" : "super",
      canEditReportsAttendance: u.canEditReportsAttendance === true,
      assignedCourseIds: Array.isArray(u.assignedCourseIds) ? u.assignedCourseIds : [],
    });
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
      const payload = { email: form.email.trim(), name: form.name.trim(), role: form.role, tempPassword: form.tempPassword, companyId: form.companyId, courseId: form.role === "trainee" ? form.courseId : "" };
      if (form.role === "admin" && isSuperAdminViewer) {
        payload.adminTier = form.adminTier;
        payload.canEditReportsAttendance = form.adminTier === "standard" && form.canEditReportsAttendance === true;
        payload.assignedCourseIds = form.adminTier === "standard" ? form.assignedCourseIds : [];
      }
      await apiPost("/admin/users", payload);
      setMsg(`${form.email.trim()} を作成しました（ロール：${roleLabel(form.role)}）。初回ログイン時にパスワード変更が必要です。`);
      setForm({ email: "", name: "", role: "trainee", tempPassword: "Feeps#1234", companyId: "", courseId: "", adminTier: "standard", canEditReportsAttendance: false, assignedCourseIds: [] });
      setOpen(false);
      load();
    } catch (e) {
      const m = String(e?.message || e);
      setErr(m.includes("409") ? "このメールアドレスは既に登録済みです。" : "作成に失敗しました：" + m);
    } finally { setBusy(false); }
  }
  async function saveAdminPermissions() {
    if (!selected || adminPermBusy) return;
    setErr(""); setMsg(""); setAdminPermBusy(true);
    try {
      await apiPut(`/admin/users/${selected.userId}/admin-permissions`, {
        adminTier: adminPerm.adminTier,
        canEditReportsAttendance: adminPerm.adminTier === "standard" && adminPerm.canEditReportsAttendance === true,
        assignedCourseIds: adminPerm.adminTier === "standard" ? adminPerm.assignedCourseIds : [],
      });
      setMsg("管理者権限を保存しました。");
      await load();
    } catch (e) {
      setErr("管理者権限の保存に失敗しました：" + (e?.message || e));
    } finally { setAdminPermBusy(false); }
  }
  function toggleAdminPermCourse(courseId) {
    setAdminPerm(s => ({ ...s, assignedCourseIds: s.assignedCourseIds.includes(courseId) ? s.assignedCourseIds.filter(id => id !== courseId) : [...s.assignedCourseIds, courseId] }));
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
        {selected.role === "admin" && isSuperAdminViewer && (
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 font-bold" style={{ color: T.textPrimary }}><ShieldCheck size={16} />管理者権限</h3>
              <Badge tone={adminPerm.adminTier === "super" ? "red" : "cyan"}>{adminPerm.adminTier === "super" ? "スーパー管理者" : "一般管理者"}</Badge>
            </div>
            <p className="mb-3 text-xs leading-relaxed" style={{ color: T.textMuted }}>スーパー管理者は日報・勤怠を含む全機能を無条件に利用できます。一般管理者は、ここで権限を付与した場合のみ、担当コースの範囲で日報・勤怠の編集・削除ができます。</p>
            <div className="space-y-3">
              <Field label="管理者種別"><select value={adminPerm.adminTier} onChange={e => setAdminPerm(s => ({ ...s, adminTier: e.target.value }))} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>
                <option value="standard">一般管理者</option>
                <option value="super">スーパー管理者</option>
              </select></Field>
              {adminPerm.adminTier === "standard" && (<>
                <label className="flex items-center gap-2 text-sm" style={{ color: T.textPrimary }}>
                  <input type="checkbox" checked={adminPerm.canEditReportsAttendance} onChange={e => setAdminPerm(s => ({ ...s, canEditReportsAttendance: e.target.checked }))} />
                  日報・勤怠の編集・削除権限を付与する
                </label>
                {adminPerm.canEditReportsAttendance && (
                  <Field label="担当コース（このコース範囲のみ編集・削除できます）">
                    {courses.length === 0 ? <div className="rounded-xl px-4 py-5 text-center text-sm" style={adminPanelStyle}>コースがありません。</div> : (
                      <div className="grid gap-2 md:grid-cols-2">{courses.map(c => {
                        const checked = adminPerm.assignedCourseIds.includes(c.courseId);
                        return (
                          <label key={c.courseId} className="flex cursor-pointer items-center gap-2 rounded-xl p-3 transition hover:bg-slate-50" style={{ background: checked ? T.accentSubtle : T.bgBase, border: `1px solid ${checked ? T.accent : T.border}` }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleAdminPermCourse(c.courseId)} />
                            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold" style={{ color: T.textPrimary }}>{c.name}</div><div className="text-xs" style={{ color: T.textMuted }}>{kindLabel(c.type || c.kind)}</div></div>
                          </label>
                        );
                      })}</div>
                    )}
                  </Field>
                )}
              </>)}
            </div>
            <div className="mt-4 flex justify-end"><Btn size="sm" icon={Check} onClick={saveAdminPermissions} disabled={adminPermBusy}>{adminPermBusy ? "保存中..." : "管理者権限を保存"}</Btn></div>
          </Card>
        )}
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
          <ListPager page={visiblePage.page} totalPages={visiblePage.totalPages} total={visiblePage.total} onPage={setPage} size={pageSize} onSize={n => { setPageSize(n); setPage(1); }} start={visiblePage.start} />
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
            {form.role === "admin" && isSuperAdminViewer && (
              <div className="rounded-xl p-3 space-y-3" style={{ border: `1px solid ${T.border}`, background: T.bgBase }}>
                <Field label="管理者種別"><select value={form.adminTier} onChange={e => setForm({ ...form, adminTier: e.target.value })} className={fieldCls} style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>
                  <option value="standard">一般管理者</option>
                  <option value="super">スーパー管理者</option>
                </select></Field>
                {form.adminTier === "standard" && (<>
                  <label className="flex items-center gap-2 text-sm" style={{ color: T.textPrimary }}>
                    <input type="checkbox" checked={form.canEditReportsAttendance} onChange={e => setForm({ ...form, canEditReportsAttendance: e.target.checked })} />
                    日報・勤怠の編集権限を付与する
                  </label>
                  {form.canEditReportsAttendance && (
                    <Field label="担当コース（このコース範囲のみ編集・削除できます）">
                      <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg p-2" style={{ border: `1px solid ${T.border}` }}>
                        {courses.map(c => (
                          <label key={c.courseId} className="flex items-center gap-2 text-sm" style={{ color: T.textPrimary }}>
                            <input type="checkbox" checked={form.assignedCourseIds.includes(c.courseId)} onChange={() => setForm(s => ({ ...s, assignedCourseIds: s.assignedCourseIds.includes(c.courseId) ? s.assignedCourseIds.filter(id => id !== c.courseId) : [...s.assignedCourseIds, c.courseId] }))} />
                            {c.name}（{kindLabel(c.kind)}）
                          </label>
                        ))}
                      </div>
                    </Field>
                  )}
                </>)}
              </div>
            )}
            {form.role === "admin" && !isSuperAdminViewer && (
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.bgBase, color: T.textMuted }}>管理者アカウントの作成にはスーパー管理者権限が必要です。作成後の権限設定はスーパー管理者に依頼してください。</div>
            )}
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
