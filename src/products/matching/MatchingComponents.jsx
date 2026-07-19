import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, Award, Briefcase, Building2, Calendar, Check, CheckCircle2,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, FileSpreadsheet, FileText, MapPin,
  Pencil, Plus, Printer, Search, Sparkles, Trash2, Wallet,
} from "lucide-react";
import {
  MATCHING_HOME_CARDS, PROJECT_STATUS_OPTIONS, PROJECT_VISIBILITY_OPTIONS, WORK_STYLE_OPTIONS,
  PLACEMENT_STATUS_OPTIONS, EMPTY_PROJECT_FORM, projectStatusLabel, projectVisibilityLabel, workStyleLabel,
} from "./MatchingCatalog.js";
import {
  candidateToSheet, fetchTraineePortfolio, matchTone, placementFormToPayload, projectFormToPayload,
  projectToForm, useCompanies, useManagedTrainees, useMatchingMe, useMatchingPlacements,
  useMatchingProjects, useProjectCandidates,
} from "./useMatching.js";
import { Card, Badge, Btn, Avatar, Field, fieldStyle, SectionHead, PageHeader, ProductNavCard, Modal, Stat, T, EmptyState as CommonEmptyState, SkeletonRows } from "../../components/common";

const GRAD = `linear-gradient(135deg, ${T.accent} 0%, #5B8CFF 100%)`;
const FOOTER = "Copyright © 2025 Feeps Inc. All Rights Reserved.";
const LIST_PAGE_SIZE = 10;

function Bar({ value, tone = "cyan" }) {
  const t = { cyan: T.accent, green: T.success, amber: T.warning, muted: T.textMuted };
  return <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: T.border }}>
    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: t[tone] || t.cyan, transition: "width .8s ease" }} /></div>;
}
function EmptyState({ title, desc }) {
  return <CommonEmptyState icon={Briefcase} title={title} desc={desc} />;
}
function ErrorBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>
      <span>{message}</span>
      {onClose && <button type="button" onClick={onClose} className="shrink-0 font-bold underline">閉じる</button>}
    </div>
  );
}
function money(n) {
  if (n === null || n === undefined || n === "") return null;
  return `${Number(n).toLocaleString("ja-JP")}円`;
}

// ---- 一覧共通: 検索/フィルタ/ソート/ページング/Excel（Training/Admin一覧と同じToolbarパターン） ----
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
async function exportMatchingExcel(rows, columns, sheetName, fileLabel) {
  try {
    const XLSX = await import("xlsx");
    const data = (rows || []).map(r => Object.fromEntries(columns.map(([key, label]) => [label, key(r)])));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = columns.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(wb, `${fileLabel}_${stamp}.xlsx`);
  } catch (e) { /* Excel出力失敗時は静かに諦める（一覧表示自体は継続） */ }
}
function DeleteConfirm({ title, name, warning, busy, onClose, onConfirm }) {
  return (
    <Modal title={title} onClose={busy ? undefined : onClose}
      footer={<><Btn kind="ghost" onClick={onClose} disabled={busy}>キャンセル</Btn><Btn kind="danger" icon={Trash2} onClick={onConfirm} disabled={busy}>{busy ? "削除中…" : "削除する"}</Btn></>}>
      <div className="space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: T.textSecondary }}>「{name}」を論理削除します。削除後は一覧に表示されません。</p>
        {warning && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.warningSubtle, color: T.warning }}>{warning}</div>}
      </div>
    </Modal>
  );
}

// ================= Home =================
export function MatchingHome({ goSub, role = "admin", themeColor = "#D97706" }) {
  const isManager = role === "admin" || role === "client";
  const isAudit = role === "admin";
  const { projects, loading: pLoading } = useMatchingProjects(isManager, role);
  const { items: placements, loading: plLoading } = useMatchingPlacements({}, isManager, role);
  const { data: meData, loading: mLoading } = useMatchingMe(role === "trainee", role);
  const cards = MATCHING_HOME_CARDS[role] || MATCHING_HOME_CARDS.trainee;
  const desc = role === "client" ? "自社案件の登録から社員の候補選定、面談・参画までを一つの流れで管理します。"
    : role === "admin" ? "企業が所有する案件運用を、商流・単価・個別メモに立ち入らず監査します。"
    : "所属企業から案内された案件のうち、あなたのスキル・修了コースに合う候補と参画状況を確認します。";
  const chips = isAudit
    ? [{ label: "監査対象案件", value: pLoading ? 0 : projects.filter(p => p.isDeleted !== true).length, unit: "件" },
       { label: "参画レコード", value: plLoading ? 0 : placements.length, unit: "件" }]
    : role === "client"
    ? [{ label: "登録案件", value: pLoading ? 0 : projects.filter(p => p.isDeleted !== true).length, unit: "件" },
       { label: "参画中", value: plLoading ? 0 : placements.filter(p => p.status === "active").length, unit: "件" }]
    : [{ label: "おすすめ案件", value: mLoading ? 0 : (meData?.recommendedProjects?.length || 0), unit: "件" },
       { label: "参画中", value: mLoading ? 0 : (meData?.placements?.length || 0), unit: "件" }];
  return (
    <div>
      <PageHeader
        product="matching"
        label="案件管理"
        title="スキルを、案件へつなげる。"
        description={desc}
        chips={chips}
        cta={{ label: isAudit ? "案件監査を開く" : isManager ? "自社案件を開く" : "参画状況を見る", icon: Sparkles, onClick: () => goSub(isManager ? "mt_list" : "mt_placement") }}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ key, icon, label, desc: d }, i) => (
          <ProductNavCard key={key} product="matching" icon={icon} title={label} desc={d}
            onClick={() => goSub(key)} highlight={i === 0} badge={i === 0 ? "よく使う" : undefined} delay={650 + i * 60} />
        ))}
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl p-4" style={{ background: `${themeColor}08`, border: `1px solid ${themeColor}20` }}>
        <Sparkles size={15} style={{ color: themeColor, marginTop: 2 }} />
        <p className="text-sm" style={{ color: T.textMuted }}><span className="font-semibold" style={{ color: T.textPrimary }}>連携：</span>スキル・成長プロダクトのスキルシート（保有スキル・自己PR・案件履歴）とLearningの修了実績が、そのまま案件マッチングの判定材料になります。</p>
      </div>
    </div>
  );
}

// ================= Project Form（新規作成/編集/閲覧） =================
function ProjectForm({ mode, form, companies, onChange, readOnly, ownerMode = false }) {
  function set(key, value) { onChange({ ...form, [key]: value }); }
  const dis = readOnly;
  return (
    <div className="space-y-3">
      <Field label="案件タイトル">
        <input value={form.title} onChange={e => set("title", e.target.value)} disabled={dis} style={fieldStyle} placeholder="Java新人研修後の実務案件" />
      </Field>
      {ownerMode ? (
        <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: T.accentSubtle, color: T.accentHover }}>
          所属企業の自社案件として登録され、他社や講師には公開されません。
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="会社">
            <select value={form.companyId} onChange={e => set("companyId", e.target.value)} disabled={dis} style={fieldStyle}>
              <option value="">未選択</option>
              {companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="公開範囲">
            <select value={form.visibility} onChange={e => set("visibility", e.target.value)} disabled={dis} style={fieldStyle}>
              {PROJECT_VISIBILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ステータス">
          <select value={form.status} onChange={e => set("status", e.target.value)} disabled={dis} style={fieldStyle}>
            {PROJECT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="勤務形態">
          <select value={form.workStyle} onChange={e => set("workStyle", e.target.value)} disabled={dis} style={fieldStyle}>
            {WORK_STYLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="必須スキル（「スキル名:レベル」をカンマ区切り。例: Java:60, SQL:40）">
        <input value={form.requiredSkillsText} onChange={e => set("requiredSkillsText", e.target.value)} disabled={dis} style={fieldStyle} placeholder="Java:60, SQL:40" />
      </Field>
      <Field label="歓迎スキル（同上の形式）">
        <input value={form.preferredSkillsText} onChange={e => set("preferredSkillsText", e.target.value)} disabled={dis} style={fieldStyle} placeholder="Spring:30" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="必須資格（カンマ区切り）">
          <input value={form.requiredQualificationsText} onChange={e => set("requiredQualificationsText", e.target.value)} disabled={dis} style={fieldStyle} />
        </Field>
        <Field label="歓迎資格（カンマ区切り）">
          <input value={form.preferredQualificationsText} onChange={e => set("preferredQualificationsText", e.target.value)} disabled={dis} style={fieldStyle} placeholder="基本情報技術者試験" />
        </Field>
      </div>
      <Field label="勤務地">
        <input value={form.location} onChange={e => set("location", e.target.value)} disabled={dis} style={fieldStyle} placeholder="東京（一部リモート）" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="期間（開始）"><input type="date" value={form.periodStart} onChange={e => set("periodStart", e.target.value)} disabled={dis} style={fieldStyle} /></Field>
        <Field label="期間（終了）"><input type="date" value={form.periodEnd} onChange={e => set("periodEnd", e.target.value)} disabled={dis} style={fieldStyle} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="募集人数"><input type="number" min="1" value={form.openings} onChange={e => set("openings", e.target.value)} disabled={dis} style={fieldStyle} /></Field>
        <Field label="単価下限（円/月）"><input type="number" min="0" value={form.budgetMin} onChange={e => set("budgetMin", e.target.value)} disabled={dis} style={fieldStyle} /></Field>
        <Field label="単価上限（円/月）"><input type="number" min="0" value={form.budgetMax} onChange={e => set("budgetMax", e.target.value)} disabled={dis} style={fieldStyle} /></Field>
      </div>
      <Field label="必要経験（自由記述）">
        <input value={form.requiredExperience} onChange={e => set("requiredExperience", e.target.value)} disabled={dis} style={fieldStyle} />
      </Field>
      <Field label="タグ（カンマ区切り）">
        <input value={form.tagsText} onChange={e => set("tagsText", e.target.value)} disabled={dis} style={fieldStyle} />
      </Field>
      <Field label="案件詳細">
        <textarea value={form.description} onChange={e => set("description", e.target.value)} disabled={dis} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
      </Field>
      <Field label="メモ（社内向け）">
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)} disabled={dis} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
      </Field>
    </div>
  );
}

function ProjectAuditDetail({ project }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="案件"><div className="text-sm font-semibold" style={{ color: T.textPrimary }}>{project.title || "案件名未設定"}</div></Field>
      <Field label="企業"><div className="text-sm" style={{ color: T.textSecondary }}>{project.companyName || project.companyId || "企業未設定"}</div></Field>
      <Field label="ステータス"><Badge tone={project.status === "recruiting" ? "green" : "muted"}>{projectStatusLabel(project.status)}</Badge></Field>
      <Field label="公開区分"><div className="text-sm" style={{ color: T.textSecondary }}>{projectVisibilityLabel(project.visibility)}</div></Field>
      <Field label="案件期間"><div className="text-sm" style={{ color: T.textSecondary }}>{project.periodStart || "未設定"}〜{project.periodEnd || ""}</div></Field>
      <Field label="募集人数"><div className="text-sm" style={{ color: T.textSecondary }}>{project.openings || 0}名</div></Field>
      <Field label="最終更新"><div className="text-sm" style={{ color: T.textSecondary }}>{project.updatedAt ? String(project.updatedAt).slice(0, 16).replace("T", " ") : "未設定"}</div></Field>
      <Field label="監査ID"><div className="break-all text-xs" style={{ color: T.textMuted }}>{project.projectId}</div></Field>
      <div className="sm:col-span-2 rounded-xl px-3 py-2 text-xs" style={{ background: T.bgBase, color: T.textMuted }}>
        管理者には商流・単価・募集条件・社内メモ・候補者情報を表示しません。編集は企業担当者が行います。
      </div>
    </div>
  );
}

// ================= 案件一覧（client: 自社CRUD / admin: 監査閲覧） =================
export function ProjectManager({ role, onOpenCandidates }) {
  const isAudit = role === "admin";
  const canManage = role === "client";
  const { projects, loading, error, actionError, clearActionError, createProject, updateProject, deleteProject } = useMatchingProjects(true, role);
  const { companies } = useCompanies(isAudit, role);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [sort, setSort] = useState({ key: "updatedAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // null=閉じている, {}=新規, project=編集
  const [form, setForm] = useState({ ...EMPTY_PROJECT_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const companyName = (id) => companies.find(c => c.companyId === id)?.name || "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter(p => (
      (!q || [p.title, p.description, p.companyName, companyName(p.companyId), ...(p.tags || [])].some(v => String(v || "").toLowerCase().includes(q))) &&
      (!statusFilter || p.status === statusFilter) &&
      (!companyFilter || p.companyId === companyFilter)
    ));
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = sort.key === "title" ? (a.title || "") : sort.key === "status" ? (a.status || "") : (a.updatedAt || "");
      const bv = sort.key === "title" ? (b.title || "") : sort.key === "status" ? (b.status || "") : (b.updatedAt || "");
      return String(av).localeCompare(String(bv), "ja") * dir;
    });
  }, [projects, query, statusFilter, companyFilter, sort, companies]);
  useEffect(() => { setPage(1); }, [query, statusFilter, companyFilter, sort.key, sort.dir]);
  const visible = pageSlice(filtered, page);
  const projectStats = {
    total: projects.length,
    recruiting: projects.filter(project => project.status === "recruiting").length,
    preparation: projects.filter(project => ["draft", "published"].includes(project.status)).length,
    closed: projects.filter(project => ["closed", "archived"].includes(project.status)).length,
  };

  function changeSort(key) { setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }); }
  const SortMark = ({ k }) => sort.key === k ? (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : null;

  function startNew() { setEditing({}); setForm({ ...EMPTY_PROJECT_FORM, visibility: "client" }); clearActionError(); }
  function startEdit(p) { setEditing(p); setForm(projectToForm(p)); clearActionError(); }
  function startView(p) { setEditing({ ...p, __readOnly: true }); setForm(projectToForm(p)); clearActionError(); }
  function closeForm() { setEditing(null); }

  async function submit() {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      const payload = projectFormToPayload(form);
      if (editing?.projectId) await updateProject(editing.projectId, payload);
      else await createProject(payload);
      closeForm();
    } catch (e) { /* actionErrorはhook側で設定済み。モーダルは開いたまま */ }
    finally { setSaving(false); }
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true); setDeleteError("");
    try { await deleteProject(deleteTarget.projectId); setDeleteTarget(null); }
    catch (e) { setDeleteError(e?.errorMessage || e?.message || "削除に失敗しました。"); }
    finally { setDeleteBusy(false); }
  }

  return (
    <div>
      <SectionHead title={isAudit ? "案件監査" : "自社案件"} desc={isAudit ? "企業ごとの案件登録・公開状態を読み取り専用で確認します。" : "自社案件を登録し、募集条件と公開状態を管理します。"}
        action={<div className="flex flex-wrap items-center gap-2">
          <Btn size="sm" kind="ghost" icon={FileSpreadsheet} onClick={() => exportMatchingExcel(filtered, [
            [r => r.title || "", "タイトル"], [r => r.companyName || companyName(r.companyId) || "企業未設定", "会社"],
            [r => projectStatusLabel(r.status), "ステータス"], [r => projectVisibilityLabel(r.visibility), "公開範囲"],
            [r => r.periodStart || "", "開始日"], [r => r.periodEnd || "", "終了日"], [r => r.openings || "", "募集人数"],
          ], "案件一覧", "案件一覧")}>Excel出力</Btn>
          {canManage && <Btn size="sm" icon={Plus} onClick={startNew}>新規案件</Btn>}
        </div>} />
      <ErrorBanner message={error} />
      <ErrorBanner message={actionError} onClose={clearActionError} />
      {!loading && projects.length > 0 && <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Briefcase} label="登録案件" value={`${projectStats.total}件`} sub="登録済み全体" />
        <Stat icon={Activity} label="募集中" value={`${projectStats.recruiting}件`} sub="候補者確認の対象" tone="green" />
        <Stat icon={AlertCircle} label="公開前・準備中" value={`${projectStats.preparation}件`} sub="内容と公開状態を確認" tone="amber" />
        <Stat icon={CheckCircle2} label="終了・保管" value={`${projectStats.closed}件`} sub="募集終了・アーカイブ" tone="muted" />
      </div>}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3" style={{ border: `1px solid ${T.border}` }}>
            <Search size={15} style={{ color: T.textMuted }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="タイトル・会社・タグで検索" className="w-full bg-transparent text-sm outline-none" style={{ color: T.textPrimary }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...fieldStyle, width: "auto" }}>
            <option value="">全ステータス</option>
            {PROJECT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {isAudit && (
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} style={{ ...fieldStyle, width: "auto" }}>
              <option value="">全企業</option>
              {companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
            </select>
          )}
          <Btn kind={sort.key === "title" ? "soft" : "ghost"} size="sm" onClick={() => changeSort("title")}>タイトル <SortMark k="title" /></Btn>
          <Btn kind={sort.key === "status" ? "soft" : "ghost"} size="sm" onClick={() => changeSort("status")}>状態 <SortMark k="status" /></Btn>
          <Btn kind={sort.key === "updatedAt" ? "soft" : "ghost"} size="sm" onClick={() => changeSort("updatedAt")}>更新日 <SortMark k="updatedAt" /></Btn>
        </div>
        {loading ? <SkeletonRows rows={5} />
          : projects.length === 0 ? <EmptyState title={isAudit ? "監査対象の案件がありません" : "自社案件がありません"} desc={isAudit ? "企業担当者が案件を登録すると表示されます。" : "「新規案件」から登録できます。"} />
          : filtered.length === 0 ? <div className="px-4 py-8 text-center text-sm" style={{ color: T.textMuted }}>検索条件に一致する案件がありません。</div>
          : <div>{visible.items.map((p, i) => (
            <div key={p.projectId} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${T.border}` : "none", background: i % 2 ? T.bgBase : "#fff" }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{p.title}</span>
                  <Badge tone={p.status === "recruiting" ? "green" : p.status === "closed" || p.status === "archived" ? "muted" : "amber"}>{projectStatusLabel(p.status)}</Badge>
                  <Badge tone="cyan">{projectVisibilityLabel(p.visibility)}</Badge>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: T.textMuted }}>
                  <span className="inline-flex items-center gap-1"><Building2 size={11} />{p.companyName || companyName(p.companyId) || "企業未設定"}</span>
                  {p.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{p.location}</span>}
                  <span>募集{p.openings}名</span>
                  {p.updatedAt && <span>更新 {String(p.updatedAt).slice(0, 10)}</span>}
                  {(p.requiredSkills || []).slice(0, 3).map(s => <Badge key={s.skill} tone="muted">{s.skill}{s.level}+</Badge>)}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {canManage && <Btn kind="ghost" size="sm" icon={Sparkles} onClick={() => onOpenCandidates(p.projectId)}>候補者を見る</Btn>}
                {canManage
                  ? <><Btn kind="ghost" size="sm" icon={Pencil} onClick={() => startEdit(p)}>編集</Btn>
                      <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => { setDeleteTarget(p); setDeleteError(""); }}>削除</Btn></>
                  : <Btn kind="ghost" size="sm" icon={FileText} onClick={() => startView(p)}>監査詳細</Btn>}
              </div>
            </div>
          ))}</div>}
        <ListPager page={visible.page} totalPages={visible.totalPages} total={visible.total} onPage={setPage} />
      </Card>

      {editing && (
        <Modal
          title={editing.__readOnly ? "案件詳細" : editing.projectId ? "案件編集" : "案件新規作成"}
          desc={editing.__readOnly ? "この案件は閲覧のみです。" : undefined}
          onClose={closeForm}
          size="lg"
          footer={editing.__readOnly
            ? <Btn kind="ghost" onClick={closeForm}>閉じる</Btn>
            : <><Btn kind="ghost" onClick={closeForm} disabled={saving}>キャンセル</Btn><Btn icon={Check} onClick={submit} disabled={saving || !form.title.trim()}>{saving ? "保存中…" : "保存する"}</Btn></>}
        >
          {editing.__readOnly
            ? <ProjectAuditDetail project={editing} />
            : <ProjectForm mode={editing.projectId ? "edit" : "new"} form={form} companies={companies} onChange={setForm} readOnly={false} ownerMode />}
        </Modal>
      )}
      {deleteTarget && (
        <div>
          {deleteError && <div className="fixed inset-x-0 top-4 z-[999] mx-auto w-fit rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{deleteError}</div>}
          <DeleteConfirm title="案件の削除" name={deleteTarget.title} warning="参画中・調整中のデータがある案件は削除できません。" busy={deleteBusy} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
        </div>
      )}
    </div>
  );
}

// ================= スキルシートプレビュー（Talent APIの実データのみ、未登録はそのまま表示） =================
async function exportSkillSheetExcel({ p, selfPR, strengths, weak, skills, projects }) {
  try {
    const XLSX = await import("xlsx");
    const W = 6, rows = [], merges = [];
    const push = r => rows.push(r);
    const full = text => { const r = rows.length; push([text]); merges.push({ s: { r, c: 0 }, e: { r, c: W } }); };
    full("スキルシート");
    push([]);
    push(["氏名", p.name, "", "年齢", String(p.age), "", ""]);
    push(["役割", p.title, "", "経験年数", p.exp, "", ""]);
    push(["最寄駅", p.station, "", "", "", "", ""]);
    push([]);
    full("自己PR");
    { const r = rows.length; push([selfPR || "未登録"]); merges.push({ s: { r, c: 0 }, e: { r, c: W } }); }
    push([]);
    push(["強み", strengths.length ? strengths.join("、") : "未登録"]);
    push(["弱み・課題", weak.length ? weak.join("、") : "未登録"]);
    push([]);
    full("保有スキル・資格");
    push(["分類", "名称", "習熟度(%)"]);
    if (skills.length) skills.forEach(sk => push([sk.cat || "", sk.name, sk.level]));
    else push(["未登録", "", ""]);
    push([]);
    full("案件履歴 / 職務経歴");
    push(["No", "期間", "案件名 / 業務内容", "役割", "規模", "担当工程", "使用技術"]);
    if (projects.length) projects.forEach((pr, i) => push([
      i + 1, pr.period, pr.name + (pr.desc ? "\n" + pr.desc : ""), pr.role, pr.scale,
      (pr.phases || []).join("・"), (pr.tech || []).join(", "),
    ]));
    else push(["未登録", "", "", "", "", "", ""]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 46 }, { wch: 14 }, { wch: 10 }, { wch: 26 }, { wch: 28 }];
    ws["!merges"] = merges;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "スキルシート");
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(wb, `スキルシート_${p.name}_${stamp}.xlsx`);
  } catch (e) { /* Excel出力失敗時は静かに諦める */ }
}

function SkillSheetPreview({ data, onClose }) {
  const { p, selfPR, strengths, weak, skills, projects } = data;
  const today = new Date().toLocaleDateString("ja-JP");
  function doPrint() { try { window.print(); } catch (e) { /* noop */ } }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Btn kind="ghost" size="sm" icon={ChevronLeft} onClick={onClose}>候補者一覧に戻る</Btn>
        <div className="flex gap-2"><Btn kind="ghost" size="sm" icon={Printer} onClick={doPrint}>印刷</Btn>
          <Btn size="sm" icon={FileSpreadsheet} onClick={() => exportSkillSheetExcel(data)}>Excelで発行</Btn></div>
      </div>
      <Card className="overflow-hidden">
        <div className="h-2" style={{ background: GRAD }} />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4" style={{ borderColor: T.border }}>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: T.accent }}>SKILL SHEET</div>
              <div className="mt-1 text-2xl font-bold" style={{ color: T.textPrimary }}>{p.name}</div>
              <div className="text-sm" style={{ color: T.textSecondary }}>{p.title}</div>
            </div>
            <div className="text-right text-xs" style={{ color: T.textMuted }}>
              <div>年齢：{p.age}　経験：{p.exp}</div>
              <div className="flex items-center justify-end gap-1"><MapPin size={11} />最寄：{p.station}</div>
              <div className="mt-1">発行日：{today}</div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1.5 text-xs font-bold" style={{ color: T.textPrimary }}>自己PR</div>
            <p className="text-sm leading-relaxed" style={{ color: selfPR ? T.textSecondary : T.textMuted }}>{selfPR || "未登録"}</p>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-bold" style={{ color: T.accent }}>強み</div>
              {strengths.length > 0
                ? <div className="flex flex-wrap gap-1.5">{strengths.map(t => <span key={t} className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: T.accentSubtle, color: T.accentHover }}>{t}</span>)}</div>
                : <div className="text-xs" style={{ color: T.textMuted }}>未登録</div>}
            </div>
            <div>
              <div className="mb-1.5 text-xs font-bold" style={{ color: T.warning }}>弱み・伸ばしたい点</div>
              {weak.length > 0
                ? <div className="flex flex-wrap gap-1.5">{weak.map(t => <span key={t} className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: T.warningSubtle, color: T.warning }}>{t}</span>)}</div>
                : <div className="text-xs" style={{ color: T.textMuted }}>未登録</div>}
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-xs font-bold" style={{ color: T.textPrimary }}>保有スキル</div>
            {skills.length === 0 ? <div className="text-xs" style={{ color: T.textMuted }}>未登録</div> : <div className="grid gap-2 sm:grid-cols-2">{skills.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 truncate font-semibold" style={{ color: T.textPrimary }}>{s.name}</span>
                <div className="flex-1"><Bar value={s.level} tone={s.level >= 80 ? "green" : "cyan"} /></div>
                <span style={{ color: T.textMuted }}>{s.level}</span>
              </div>
            ))}</div>}
          </div>

          <div className="mt-5">
            <div className="mb-2 text-xs font-bold" style={{ color: T.textPrimary }}>案件履歴 / 職務経歴</div>
            {projects.length === 0 ? <div className="text-xs" style={{ color: T.textMuted }}>未登録</div> : <div className="space-y-2">{projects.map((pr, i) => (
              <div key={pr.id || i} className="rounded-lg p-3" style={{ border: `1px solid ${T.border}` }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{pr.name}</span>
                  <span className="text-xs" style={{ color: T.textMuted }}>{pr.period}</span></div>
                <div className="mt-0.5 text-xs" style={{ color: T.textMuted }}>役割：{pr.role || "—"} ・ 規模：{pr.scale || "—"}{pr.phases && pr.phases.length ? " ・ 担当：" + pr.phases.join("・") : ""}</div>
                {pr.desc && <div className="mt-1 text-xs leading-relaxed" style={{ color: T.textSecondary }}>{pr.desc}</div>}
                <div className="mt-1.5 flex flex-wrap gap-1">{(pr.tech || []).map(t => <span key={t} className="rounded px-1.5 py-0.5 text-xs font-semibold" style={{ background: T.accentSubtle, color: T.accentHover }}>{t}</span>)}</div>
              </div>
            ))}</div>}
          </div>

          <div className="mt-6 flex items-center justify-between border-t pt-3 text-xs" style={{ borderColor: T.border, color: T.textMuted }}>
            <span>Generated by Feeps 研修管理</span><span>{FOOTER}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ================= 候補者マッチング（client: 自社案件 × 自社社員） =================
export function ProjectMatching({ role, initialProjectId }) {
  const canMatch = role === "client";
  const { projects, loading: projectsLoading } = useMatchingProjects(canMatch, role);
  const [projectId, setProjectId] = useState(initialProjectId || "");
  useEffect(() => {
    if (initialProjectId) { setProjectId(initialProjectId); return; }
    if (!projectId && projects.length) setProjectId(projects[0].projectId);
  }, [initialProjectId, projects, projectId]);
  const { items, loading, error } = useProjectCandidates(projectId, canMatch);
  const [sortKey, setSortKey] = useState("score");
  const [preview, setPreview] = useState(null); // { candidate, portfolio }
  const [previewLoading, setPreviewLoading] = useState(false);

  const opening = projects.find(p => p.projectId === projectId);
  const sorted = useMemo(() => {
    const list = [...items];
    if (sortKey === "name") list.sort((a, b) => String(a.trainee?.name || "").localeCompare(String(b.trainee?.name || ""), "ja"));
    return list;
  }, [items, sortKey]);

  async function openSkillSheet(candidate) {
    setPreviewLoading(true);
    try {
      const portfolio = await fetchTraineePortfolio(candidate.trainee.traineeId);
      setPreview({ candidate, portfolio });
    } catch (e) {
      setPreview({ candidate, portfolio: null });
    } finally { setPreviewLoading(false); }
  }

  if (!canMatch) return (
    <Card><EmptyState title="候補者情報は企業担当者専用です" desc="管理者は案件と参画の監査画面のみ利用できます。" /></Card>
  );

  if (preview) return (
    <SkillSheetPreview data={candidateToSheet(preview.candidate.trainee, preview.portfolio)} onClose={() => setPreview(null)} />
  );

  return (
    <div>
      <SectionHead title="候補者マッチング" desc="自社社員の実スキルシートから、自社案件にマッチする人材を選定します。" />

      {projectsLoading ? <Card><SkeletonRows rows={2} /></Card> : projects.length === 0 ? (
        <Card><EmptyState title="案件がありません" desc="先に案件一覧から案件を作成してください。" /></Card>
      ) : (
        <>
          <div className="-mx-1 mb-5 flex gap-3 overflow-x-auto px-1 pb-1">
            {projects.map(op => { const active = op.projectId === projectId;
              return (
                <button key={op.projectId} onClick={() => setProjectId(op.projectId)} className="w-64 shrink-0 rounded-2xl p-4 text-left transition"
                  style={{ background: active ? T.accentSubtle : "#fff", border: `1.5px solid ${active ? T.accent : T.border}` }}>
                  <div className="flex items-center justify-between"><Badge tone="cyan">{projectStatusLabel(op.status)}</Badge>
                    <span className="text-xs font-semibold" style={{ color: T.textMuted }}>募集 {op.openings}名</span></div>
                  <div className="mt-2 text-sm font-bold leading-snug" style={{ color: T.textPrimary }}>{op.title}</div>
                  <div className="mt-1 text-xs" style={{ color: T.textMuted }}>{op.companyName || "Feeps社内"}{op.periodStart ? ` ・ ${op.periodStart}〜` : ""}</div>
                  <div className="mt-2 flex flex-wrap gap-1">{(op.requiredSkills || []).map(r => <span key={r.skill} className="rounded px-1.5 py-0.5 text-xs font-semibold" style={{ background: T.bgBase, color: T.textSecondary }}>{r.skill}</span>)}</div>
                </button>
              );
            })}
          </div>

          {opening && (
            <Card className="mb-5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="font-bold" style={{ color: T.textPrimary }}>{opening.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: T.textMuted }}>
                    <span className="inline-flex items-center gap-1"><Building2 size={12} />{opening.companyName || "Feeps社内"}</span>
                    {opening.periodStart && <span className="inline-flex items-center gap-1"><Calendar size={12} />{opening.periodStart}〜{opening.periodEnd || ""}</span>}
                    {opening.location && <span className="inline-flex items-center gap-1"><MapPin size={12} />{opening.location}</span>}
                    {money(opening.budgetMin) && <span className="inline-flex items-center gap-1"><Wallet size={12} />{money(opening.budgetMin)}〜{money(opening.budgetMax)}</span>}
                    <span>募集 {opening.openings}名</span></div></div>
                <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={{ ...fieldStyle, width: "auto" }}>
                  <option value="score">スコア高い順</option>
                  <option value="name">氏名順</option>
                </select>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold" style={{ color: T.textMuted }}>必須スキル：</span>
                {(opening.requiredSkills || []).map(r => <span key={r.skill} className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: T.accentSubtle, color: T.accentHover }}>{r.skill}（{r.level}+）</span>)}
                {(opening.preferredSkills || []).length > 0 && <><span className="text-xs font-bold" style={{ color: T.textMuted }}>｜ 歓迎：</span>
                  {opening.preferredSkills.map(r => <span key={r.skill} className="rounded px-1.5 py-0.5 text-xs font-semibold" style={{ background: T.successSubtle, color: T.success }}>{r.skill}（{r.level}+）</span>)}</>}
              </div>
            </Card>
          )}

          <ErrorBanner message={error} />
          {loading || previewLoading ? <Card><SkeletonRows rows={5} /></Card> : sorted.length === 0 ? (
            <Card><EmptyState title="候補者がいません" desc="自社社員が登録されると候補者として表示されます。" /></Card>
          ) : (
            <div className="space-y-3">{sorted.map((c, i) => (
              <Card key={c.trainee.traineeId} className="p-4" style={i === 0 && sortKey === "score" && c.requiredMet ? { border: `1.5px solid ${T.accent}` } : undefined}>
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={c.trainee.name || c.trainee.traineeId} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{c.trainee.name || "氏名未設定"}</span>
                      {c.requiredMet && <Badge tone="cyan">必須条件充足</Badge>}
                    </div>
                    <div className="text-xs" style={{ color: T.textMuted }}>{c.trainee.companyName || "所属未設定"}</div>
                  </div>
                  <div className="w-24 text-right">
                    <div className="text-lg font-bold" style={{ color: c.score >= 80 ? T.success : c.score >= 60 ? T.accentHover : c.score >= 40 ? T.warning : T.textMuted }}>{c.score}点</div>
                    <div className="text-xs" style={{ color: T.textMuted }}>マッチ度</div>
                  </div>
                </div>
                <div className="mt-2"><Bar value={c.score} tone={matchTone(c.score)} /></div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.matchedSkills.map(s => <span key={s} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: T.successSubtle, color: T.success }}><CheckCircle2 size={11} />{s}</span>)}
                  {c.missingSkills.map(s => <span key={s} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: T.warningSubtle, color: T.warning }}><AlertCircle size={11} />{s} 不足</span>)}
                  {c.completedCourses.map(t => <span key={t} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: T.accentSubtle, color: T.accentHover }}><Award size={11} />{t} 修了</span>)}
                  {c.worksCount > 0 && <Badge tone="muted">制作実績 {c.worksCount}件</Badge>}
                </div>
                {(c.reasons.length > 0 || c.warnings.length > 0) && (
                  <div className="mt-2 space-y-1 text-xs" style={{ color: T.textMuted }}>
                    {c.reasons.map((r, ri) => <div key={"r" + ri}>✓ {r}</div>)}
                    {c.warnings.map((w, wi) => <div key={"w" + wi} style={{ color: T.warning }}>⚠ {w}</div>)}
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <Btn kind="ghost" size="sm" icon={FileText} onClick={() => openSkillSheet(c)}>スキルシート</Btn>
                </div>
              </Card>
            ))}</div>
          )}
          <p className="mt-3 text-xs" style={{ color: T.textMuted }}>※ マッチ度は候補者の実スキルシート・Learning修了実績・制作実績と、案件の必要スキル・レベルから算出します（100点満点）。</p>
        </>
      )}
    </div>
  );
}

// ================= 参画管理（client: 自社CRUD / admin: 監査閲覧） =================
function PlacementForm({ form, onChange, projects, trainees, mode }) {
  function set(key, value) { onChange({ ...form, [key]: value }); }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="案件">
          <select value={form.projectId} onChange={e => set("projectId", e.target.value)} disabled={mode === "edit"} style={fieldStyle}>
            <option value="">選択してください</option>
            {projects.map(p => <option key={p.projectId} value={p.projectId}>{p.title}</option>)}
          </select>
        </Field>
        <Field label="受講生">
          <select value={form.traineeId} onChange={e => set("traineeId", e.target.value)} disabled={mode === "edit"} style={fieldStyle}>
            <option value="">選択してください</option>
            {trainees.map(t => <option key={t.userId || t.id} value={t.userId || t.id}>{t.name || t.email}</option>)}
          </select>
        </Field>
      </div>
      <Field label="ステータス">
        <select value={form.status} onChange={e => set("status", e.target.value)} style={fieldStyle}>
          {PLACEMENT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="面談日"><input type="date" value={(form.interviewAt || "").slice(0, 10)} onChange={e => set("interviewAt", e.target.value)} style={fieldStyle} /></Field>
        <Field label="内定日"><input type="date" value={(form.acceptedAt || "").slice(0, 10)} onChange={e => set("acceptedAt", e.target.value)} style={fieldStyle} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="参画開始日"><input type="date" value={form.startDate || ""} onChange={e => set("startDate", e.target.value)} style={fieldStyle} /></Field>
        <Field label="参画終了予定日"><input type="date" value={form.expectedEndDate || ""} onChange={e => set("expectedEndDate", e.target.value)} style={fieldStyle} /></Field>
        <Field label="実終了日"><input type="date" value={form.actualEndDate || ""} onChange={e => set("actualEndDate", e.target.value)} style={fieldStyle} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="単価（円/月・任意）"><input type="number" min="0" value={form.rate} onChange={e => set("rate", e.target.value)} style={fieldStyle} /></Field>
        <Field label="契約形態（任意）"><input value={form.contractType} onChange={e => set("contractType", e.target.value)} style={fieldStyle} placeholder="業務委託 / 派遣 / SES" /></Field>
      </div>
      <Field label="メモ">
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
      </Field>
    </div>
  );
}

const EMPTY_PLACEMENT_FORM = { projectId: "", traineeId: "", status: "proposed", interviewAt: "", acceptedAt: "", startDate: "", expectedEndDate: "", actualEndDate: "", rate: "", contractType: "", notes: "" };

function PlacementAuditDetail({ placement }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="受講生"><div className="text-sm font-semibold" style={{ color: T.textPrimary }}>{placement.traineeName || placement.traineeId || "受講生未設定"}</div></Field>
      <Field label="案件"><div className="text-sm font-semibold" style={{ color: T.textPrimary }}>{placement.projectTitle || placement.projectId || "案件未設定"}</div></Field>
      <Field label="ステータス"><Badge tone={placement.status === "active" ? "green" : placement.status === "completed" ? "cyan" : "amber"}>{placement.statusLabel}</Badge></Field>
      <Field label="面談日"><div className="text-sm" style={{ color: T.textSecondary }}>{placement.interviewAt ? String(placement.interviewAt).slice(0, 10) : "未設定"}</div></Field>
      <Field label="参画期間"><div className="text-sm" style={{ color: T.textSecondary }}>{placement.startDate || "未設定"}〜{placement.actualEndDate || placement.expectedEndDate || ""}</div></Field>
      <Field label="最終更新"><div className="text-sm" style={{ color: T.textSecondary }}>{placement.updatedAt ? String(placement.updatedAt).slice(0, 16).replace("T", " ") : "未設定"}</div></Field>
      <Field label="企業ID"><div className="break-all text-xs" style={{ color: T.textMuted }}>{placement.companyId || "未設定"}</div></Field>
      <Field label="監査ID"><div className="break-all text-xs" style={{ color: T.textMuted }}>{placement.placementId}</div></Field>
      <div className="sm:col-span-2 rounded-xl px-3 py-2 text-xs" style={{ background: T.bgBase, color: T.textMuted }}>
        管理者には単価・契約形態・企業と社員の個別メモを表示しません。ステータス更新は企業担当者が行います。
      </div>
    </div>
  );
}

export function PlacementManager({ role }) {
  const isAudit = role === "admin";
  const canManage = role === "client";
  const { items, loading, error, actionError, clearActionError, createPlacement, updatePlacement, deletePlacement } = useMatchingPlacements({}, true, role);
  const { projects } = useMatchingProjects(true, role);
  const { trainees } = useManagedTrainees(canManage, role);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState({ key: "updatedAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_PLACEMENT_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter(pl => (
      (!q || [pl.traineeName, pl.projectTitle, pl.notes].some(v => String(v || "").toLowerCase().includes(q))) &&
      (!statusFilter || pl.status === statusFilter)
    ));
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => String(a[sort.key] || "").localeCompare(String(b[sort.key] || ""), "ja") * dir);
  }, [items, query, statusFilter, sort]);
  useEffect(() => { setPage(1); }, [query, statusFilter, sort.key, sort.dir]);
  const visible = pageSlice(filtered, page);
  const placementStats = {
    total: items.length,
    adjusting: items.filter(item => ["proposed", "interviewing"].includes(item.status)).length,
    accepted: items.filter(item => item.status === "accepted").length,
    active: items.filter(item => item.status === "active").length,
  };
  function changeSort(key) { setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }); }
  const SortMark = ({ k }) => sort.key === k ? (sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : null;

  function startNew() { setEditing({}); setForm({ ...EMPTY_PLACEMENT_FORM }); clearActionError(); }
  function startEdit(pl) {
    setEditing(pl);
    setForm({ projectId: pl.projectId, traineeId: pl.traineeId, status: pl.status, interviewAt: pl.interviewAt || "", acceptedAt: pl.acceptedAt || "", startDate: pl.startDate || "", expectedEndDate: pl.expectedEndDate || "", actualEndDate: pl.actualEndDate || "", rate: pl.rate != null ? String(pl.rate) : "", contractType: pl.contractType || "", notes: pl.notes || "" });
    clearActionError();
  }
  function startView(pl) { setEditing({ ...pl, __readOnly: true }); clearActionError(); }
  function closeForm() { setEditing(null); }

  async function submit() {
    if (!form.projectId || !form.traineeId || saving) return;
    setSaving(true);
    try {
      const payload = placementFormToPayload(form);
      if (editing?.placementId) await updatePlacement(editing.placementId, payload);
      else await createPlacement(payload);
      closeForm();
    } catch (e) { /* actionErrorはhook側で設定済み */ }
    finally { setSaving(false); }
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true); setDeleteError("");
    try { await deletePlacement(deleteTarget.placementId); setDeleteTarget(null); }
    catch (e) { setDeleteError(e?.errorMessage || e?.message || "削除に失敗しました。"); }
    finally { setDeleteBusy(false); }
  }

  return (
    <div>
      <SectionHead title={isAudit ? "参画監査" : "自社参画状況"} desc={isAudit ? "企業が管理する参画ステータスと更新状況を読み取り専用で確認します。" : "自社案件と自社社員の面談・参画状況を管理します。"}
        action={<div className="flex flex-wrap items-center gap-2">
          <Btn size="sm" kind="ghost" icon={FileSpreadsheet} onClick={() => exportMatchingExcel(filtered, [
            [r => r.traineeName || "", "受講生"], [r => r.projectTitle || "", "案件"], [r => r.statusLabel || "", "ステータス"],
            [r => r.startDate || "", "参画開始日"], [r => r.expectedEndDate || "", "終了予定日"],
          ], "参画状況", "参画状況")}>Excel出力</Btn>
          {canManage && <Btn size="sm" icon={Plus} onClick={startNew}>参画を登録</Btn>}
        </div>} />
      <ErrorBanner message={error} />
      <ErrorBanner message={actionError} onClose={clearActionError} />
      {!loading && items.length > 0 && <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Briefcase} label="参画データ" value={`${placementStats.total}件`} sub="登録済み全体" />
        <Stat icon={Calendar} label="提案・面談調整" value={`${placementStats.adjusting}件`} sub="次の対応を確認" tone="amber" />
        <Stat icon={CheckCircle2} label="内定・合意済み" value={`${placementStats.accepted}件`} sub="参画開始前" tone="cyan" />
        <Stat icon={Activity} label="参画中" value={`${placementStats.active}件`} sub="現在稼働中" tone="green" />
      </div>}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3" style={{ border: `1px solid ${T.border}` }}>
            <Search size={15} style={{ color: T.textMuted }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="受講生名・案件名で検索" className="w-full bg-transparent text-sm outline-none" style={{ color: T.textPrimary }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...fieldStyle, width: "auto" }}>
            <option value="">全ステータス</option>
            {PLACEMENT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Btn kind={sort.key === "traineeName" ? "soft" : "ghost"} size="sm" onClick={() => changeSort("traineeName")}>受講生 <SortMark k="traineeName" /></Btn>
          <Btn kind={sort.key === "updatedAt" ? "soft" : "ghost"} size="sm" onClick={() => changeSort("updatedAt")}>更新日 <SortMark k="updatedAt" /></Btn>
        </div>
        {loading ? <SkeletonRows rows={5} />
          : items.length === 0 ? <EmptyState title="参画データがありません" desc={isAudit ? "企業担当者が参画を登録すると表示されます。" : "「参画を登録」から自社社員を紐づけられます。"} />
          : filtered.length === 0 ? <div className="px-4 py-8 text-center text-sm" style={{ color: T.textMuted }}>検索条件に一致するデータがありません。</div>
          : <div>{visible.items.map((pl, i) => (
            <div key={pl.placementId} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${T.border}` : "none", background: i % 2 ? T.bgBase : "#fff" }}>
              <Avatar name={pl.traineeName || pl.traineeId} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{pl.traineeName || "氏名未設定"}</span>
                  <Badge tone={pl.status === "active" ? "green" : pl.status === "completed" ? "cyan" : ["declined", "cancelled", "withdrawn"].includes(pl.status) ? "muted" : "amber"}>{pl.statusLabel}</Badge>
                </div>
                <div className="mt-0.5 text-xs" style={{ color: T.textMuted }}>{pl.projectTitle}
                  {pl.startDate && ` ・ ${pl.startDate}〜${pl.expectedEndDate || ""}`}
                  {pl.rate != null && ` ・ ${money(pl.rate)}`}
                  {pl.updatedAt && ` ・ 更新 ${String(pl.updatedAt).slice(0, 10)}`}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {canManage ? <>
                  <Btn kind="ghost" size="sm" icon={Pencil} onClick={() => startEdit(pl)}>編集</Btn>
                  <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => { setDeleteTarget(pl); setDeleteError(""); }}>削除</Btn>
                </> : <Btn kind="ghost" size="sm" icon={FileText} onClick={() => startView(pl)}>監査詳細</Btn>}
              </div>
            </div>
          ))}</div>}
        <ListPager page={visible.page} totalPages={visible.totalPages} total={visible.total} onPage={setPage} />
      </Card>

      {editing && (
        <Modal title={editing.__readOnly ? "参画詳細" : editing.placementId ? "参画編集" : "参画登録"} onClose={closeForm} size="lg"
          footer={editing.__readOnly ? <Btn kind="ghost" onClick={closeForm}>閉じる</Btn> : <><Btn kind="ghost" onClick={closeForm} disabled={saving}>キャンセル</Btn><Btn icon={Check} onClick={submit} disabled={saving || !form.projectId || !form.traineeId}>{saving ? "保存中…" : "保存する"}</Btn></>}>
          {editing.__readOnly
            ? <PlacementAuditDetail placement={editing} />
            : <PlacementForm form={form} onChange={setForm} projects={projects} trainees={trainees} mode={editing.placementId ? "edit" : "new"} />}
        </Modal>
      )}
      {deleteTarget && (
        <div>
          {deleteError && <div className="fixed inset-x-0 top-4 z-[999] mx-auto w-fit rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{deleteError}</div>}
          <DeleteConfirm title="参画の削除" name={`${deleteTarget.traineeName || "受講生"} / ${deleteTarget.projectTitle || "案件"}`} warning="参画中・完了済みのデータは削除できません。" busy={deleteBusy} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
        </div>
      )}
    </div>
  );
}

// ================= trainee向け: おすすめ案件・参画状況・履歴 =================
function PlacementRow({ pl }) {
  return (
    <div className="rounded-xl p-3" style={{ background: T.bgBase }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{pl.projectTitle}</span>
        <Badge tone={pl.status === "active" ? "green" : pl.status === "completed" ? "cyan" : "muted"}>{pl.statusLabel}</Badge>
      </div>
      <div className="mt-0.5 text-xs" style={{ color: T.textMuted }}>
        {pl.startDate && `${pl.startDate}〜${pl.expectedEndDate || pl.actualEndDate || ""}`}
      </div>
    </div>
  );
}

export function MatchingMeView() {
  const { data, loading, error } = useMatchingMe();
  if (loading) return <Card><SkeletonRows rows={4} /></Card>;
  return (
    <div className="space-y-5">
      <SectionHead title="あなた向け案件・参画状況" desc="所属企業から案内された案件候補と、現在の参画状況・履歴です。" />
      <ErrorBanner message={error} />
      {data?.warnings?.map((w, i) => <div key={i} className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: T.warningSubtle, color: T.warning }}><AlertCircle size={14} />{w}</div>)}

      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-1.5 font-bold" style={{ color: T.textPrimary }}><Sparkles size={16} />あなた向け案件</h3>
        {!data?.recommendedProjects?.length ? <EmptyState title="現在案内中の案件はありません" desc="所属企業から案件が案内されると、スキルとの一致度とともに表示されます。" /> : (
          <div className="space-y-3">{data.recommendedProjects.map(r => (
            <div key={r.project.projectId} className="rounded-xl p-3" style={{ background: T.bgBase }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold" style={{ color: T.textPrimary }}>{r.project.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs" style={{ color: T.textMuted }}>
                    {r.project.companyName && <span>{r.project.companyName}</span>}
                    {r.project.location && <span>{r.project.location}</span>}
                    {r.project.workStyle && <span>{workStyleLabel(r.project.workStyle)}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold" style={{ color: r.score >= 80 ? T.success : r.score >= 60 ? T.accentHover : T.textMuted }}>{r.score}点</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.matchedSkills.map(s => <span key={s} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: T.successSubtle, color: T.success }}><CheckCircle2 size={11} />{s}</span>)}
                {r.missingSkills.map(s => <span key={s} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: T.warningSubtle, color: T.warning }}><AlertCircle size={11} />{s} 不足</span>)}
              </div>
            </div>
          ))}</div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-1.5 font-bold" style={{ color: T.textPrimary }}><Activity size={16} />参画中</h3>
        {!data?.placements?.length ? <div className="text-sm" style={{ color: T.textMuted }}>現在参画中の案件はありません。</div> : (
          <div className="space-y-2">{data.placements.map(pl => <PlacementRow key={pl.placementId} pl={pl} />)}</div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-1.5 font-bold" style={{ color: T.textPrimary }}><Award size={16} />参画履歴</h3>
        {!data?.placementHistory?.length ? <div className="text-sm" style={{ color: T.textMuted }}>参画履歴はまだありません。</div> : (
          <div className="space-y-2">{data.placementHistory.map(pl => <PlacementRow key={pl.placementId} pl={pl} />)}</div>
        )}
      </Card>
    </div>
  );
}
