import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, CalendarClock, Check, ChevronLeft, ChevronRight, Download, Eye, FileText,
  MapPin, Pencil, Plus, Search, Trash2, Upload, Users, X,
} from "lucide-react";
import {
  APPLICATION_TYPE_OPTIONS, applicationTypeLabel, DOCUMENT_TYPE_SUGGESTIONS, documentStatusLabel,
  documentStatusTone, EMPLOYMENT_TYPE_OPTIONS, employmentTypeLabel, EMPTY_GRANT_FORM, EMPTY_RESERVATION_FORM,
  GRADUATE_STATUS_OPTIONS, graduateStatusLabel, GRANT_STATUS_OPTIONS, GRANT_TYPE_SUGGESTIONS, GRANTS_HOME_CARDS,
  grantStatusLabel, grantStatusTone, IT_EXPERIENCE_OPTIONS, itExperienceLabel, RESERVATION_TYPE_OPTIONS,
  reservationStatusLabel, reservationStatusTone, reservationTypeLabel,
} from "./GrantsCatalog.js";
import {
  useCompanyCourses, useCompanyProfile, useCompanyTrainees, useGrantCompanies, useGrantDocuments,
  useGrantsList, useReservations,
} from "./useGrants.js";
import {
  Avatar, Badge, Btn, Card, EmptyState, Field, fieldStyle, Modal, PageHeader, PrismErrorRetryCard,
  ProductNavCard, SectionHead, SkeletonRows, T,
} from "../../components/common";

const LIST_PAGE_SIZE = 10;

// ---- 一覧共通ヘルパー（既存Product一覧と同じToolbar/ページングパターンをProduct内で複製） ----
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
function ErrorBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>
      <span>{message}</span>
      {onClose && <button type="button" onClick={onClose} className="shrink-0 font-bold underline">閉じる</button>}
    </div>
  );
}
function DeleteConfirm({ title, desc, warning, busy, onClose, onConfirm }) {
  return (
    <Modal title={title} onClose={busy ? undefined : onClose}
      footer={<><Btn kind="ghost" onClick={onClose} disabled={busy}>キャンセル</Btn><Btn kind="danger" icon={Trash2} onClick={onConfirm} disabled={busy}>{busy ? "削除中…" : "削除する"}</Btn></>}>
      <div className="space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: T.textSecondary }}>{desc}</p>
        {warning && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.warningSubtle, color: T.warning }}>{warning}</div>}
      </div>
    </Modal>
  );
}
function CompanySelector({ companies, loading, value, onChange, allowAll = false, label = "対象企業" }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold" style={{ color: T.textMuted }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={loading} style={{ ...fieldStyle, width: "auto", minWidth: 220 }}>
        <option value="">{allowAll ? "全企業" : "企業を選択してください"}</option>
        {companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
      </select>
    </div>
  );
}

// ================= Home =================
export function GrantsHome({ goSub, role = "client", themeColor = "#C9A227" }) {
  const { items: grants, loading: gLoading, error: gError, reload: gReload } = useGrantsList({}, true);
  const { items: reservations, loading: rLoading } = useReservations({}, true);
  const today = new Date().toISOString().slice(0, 10);
  const pendingCount = grants.filter(g => !["paid", "rejected", "cancelled"].includes(g.status)).length;
  const upcomingCount = reservations.filter(r => r.status !== "cancelled" && String(r.scheduledAt || "").slice(0, 10) >= today).length;
  const desc = role === "admin"
    ? "全社の助成金申請・提出書類・予約状況を確認できます。"
    : "自社の助成金申請・提出書類・予約状況を確認・管理します。";
  return (
    <div>
      <PageHeader product="grants" label="助成金管理" title="助成金申請を、迷わず前へ。" description={desc}
        chips={[
          { label: "進行中の申請", value: gLoading ? 0 : pendingCount, unit: "件" },
          { label: "今後の予約", value: rLoading ? 0 : upcomingCount, unit: "件" },
        ]}
        cta={{ label: "助成金申請を見る", icon: FileText, onClick: () => goSub("gr_list") }}
      />
      {gError && <PrismErrorRetryCard message={gError} onRetry={gReload} />}
      <div className="grid gap-4 md:grid-cols-3">
        {GRANTS_HOME_CARDS.map((c, i) => (
          <ProductNavCard key={c.key} product="grants" icon={c.icon} title={c.label} desc={c.desc}
            onClick={() => goSub(c.key)} highlight={i === 0} badge={i === 0 ? "よく使う" : undefined} delay={650 + i * 60} />
        ))}
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl p-4" style={{ background: `${themeColor}10`, border: `1px solid ${themeColor}30` }}>
        <FileText size={15} style={{ color: themeColor, marginTop: 2 }} />
        <p className="text-sm" style={{ color: T.textMuted }}><span className="font-semibold" style={{ color: T.textPrimary }}>対象:</span> このProductはadmin/client専用です。新規の助成金申請登録は運営（管理者）が行います。</p>
      </div>
    </div>
  );
}

// ================= 企業プロフィール =================
function BranchEditor({ branches, onChange }) {
  function update(i, field, value) {
    const next = branches.slice();
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  }
  function add() { onChange([...branches, { branchId: `branch_${Date.now()}`, name: "", address: "", tel: "" }]); }
  function remove(i) { onChange(branches.filter((_, idx) => idx !== i)); }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: T.textMuted }}>支店</span>
        <Btn kind="ghost" size="sm" icon={Plus} onClick={add}>支店を追加</Btn>
      </div>
      {branches.length === 0 ? <div className="text-xs" style={{ color: T.textMuted }}>登録されている支店はありません。</div> : (
        <div className="space-y-2">
          {branches.map((b, i) => (
            <Card key={b.branchId || i} className="p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={b.name} onChange={e => update(i, "name", e.target.value)} placeholder="支店名" style={fieldStyle} />
                <input value={b.address} onChange={e => update(i, "address", e.target.value)} placeholder="住所" style={fieldStyle} />
                <input value={b.tel} onChange={e => update(i, "tel", e.target.value)} placeholder="TEL" style={fieldStyle} />
              </div>
              <div className="mt-2 flex justify-end"><Btn kind="ghost" size="sm" icon={Trash2} onClick={() => remove(i)}>削除</Btn></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function companyFormToPayload(form) {
  const payload = { ...form };
  delete payload.companyId;
  ["capitalAmount", "employeeCount"].forEach(k => {
    if (payload[k] === "" || payload[k] === null || payload[k] === undefined) delete payload[k];
    else payload[k] = Number(payload[k]);
  });
  return payload;
}

export function CompanyProfileView({ role }) {
  const isAdmin = role === "admin";
  const { companies, loading: companiesLoading } = useGrantCompanies(isAdmin);
  const [companyId, setCompanyId] = useState("");
  const enabled = isAdmin ? !!companyId : true;
  const { profile, loading, error, actionError, clearActionError, reload, save } = useCompanyProfile(companyId, enabled);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(profile ? { ...profile, branches: Array.isArray(profile.branches) ? profile.branches : [] } : null);
  }, [profile]);

  function set(key, value) { setForm(f => ({ ...f, [key]: value })); }

  async function submit() {
    if (!form || saving) return;
    setSaving(true); setSaved(false);
    try {
      await save(companyFormToPayload(form));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) { /* actionErrorはhook側で表示済み */ }
    finally { setSaving(false); }
  }

  return (
    <div>
      <SectionHead title="企業プロフィール" desc="助成金申請の基礎情報となる企業情報です。法人番号・資本金・代表者等の確定情報は管理者のみ編集できます（Backend側でも制限済み）。" />
      {isAdmin && <CompanySelector companies={companies} loading={companiesLoading} value={companyId} onChange={setCompanyId} />}
      {isAdmin && !companyId ? (
        <Card><EmptyState icon={Building2} title="企業を選択してください" desc="対象企業を選ぶとプロフィールが表示されます。" /></Card>
      ) : error ? (
        <PrismErrorRetryCard message={error} onRetry={reload} />
      ) : loading || !form ? (
        <Card className="p-5"><SkeletonRows rows={6} /></Card>
      ) : (
        <Card className="p-5 sm:p-6">
          <ErrorBanner message={actionError} onClose={clearActionError} />
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-xs font-bold uppercase" style={{ color: T.textMuted, letterSpacing: "0.06em" }}>通常情報</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="会社名"><input value={form.name} onChange={e => set("name", e.target.value)} style={fieldStyle} /></Field>
                <Field label="住所"><input value={form.address} onChange={e => set("address", e.target.value)} style={fieldStyle} /></Field>
                <Field label="TEL"><input value={form.tel} onChange={e => set("tel", e.target.value)} style={fieldStyle} /></Field>
                <Field label="代表者役職"><input value={form.representativeTitle} onChange={e => set("representativeTitle", e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
                <Field label="代表者氏名"><input value={form.representativeName} onChange={e => set("representativeName", e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
              </div>
              {!isAdmin && <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: T.bgBase, color: T.textMuted }}>代表者情報は管理者のみ編集できます。</div>}
            </div>
            <div>
              <div className="mb-2 text-xs font-bold uppercase" style={{ color: T.textMuted, letterSpacing: "0.06em" }}>担当者</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="担当者氏名"><input value={form.contactPersonName} onChange={e => set("contactPersonName", e.target.value)} style={fieldStyle} /></Field>
                <Field label="担当者Email"><input value={form.contactPersonEmail} onChange={e => set("contactPersonEmail", e.target.value)} style={fieldStyle} /></Field>
                <Field label="担当者電話"><input value={form.contactPersonPhone} onChange={e => set("contactPersonPhone", e.target.value)} style={fieldStyle} /></Field>
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-bold uppercase" style={{ color: T.textMuted, letterSpacing: "0.06em" }}>助成金向け項目</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="法人番号（13桁）"><input value={form.corporateNumber} onChange={e => set("corporateNumber", e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
                <Field label="資本金（円）"><input type="number" min="0" value={form.capitalAmount ?? ""} onChange={e => set("capitalAmount", e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
                <Field label="従業員数"><input type="number" min="0" value={form.employeeCount ?? ""} onChange={e => set("employeeCount", e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
                <Field label="通常就業時間"><input value={form.standardWorkingHours} onChange={e => set("standardWorkingHours", e.target.value)} disabled={!isAdmin} style={fieldStyle} placeholder="09:00-18:00" /></Field>
                <Field label="研修中就業時間"><input value={form.trainingWorkingHours} onChange={e => set("trainingWorkingHours", e.target.value)} disabled={!isAdmin} style={fieldStyle} placeholder="09:00-17:00" /></Field>
              </div>
              {!isAdmin && <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: T.bgBase, color: T.textMuted }}>法人番号・資本金・従業員数・就業時間は管理者のみ編集できます。</div>}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="助成金担当者役職"><input value={form.grantContactTitle} onChange={e => set("grantContactTitle", e.target.value)} style={fieldStyle} /></Field>
                <Field label="助成金担当者氏名"><input value={form.grantContactName} onChange={e => set("grantContactName", e.target.value)} style={fieldStyle} /></Field>
                <Field label="助成金担当者Email"><input value={form.grantContactEmail} onChange={e => set("grantContactEmail", e.target.value)} style={fieldStyle} /></Field>
                <Field label="助成金担当者電話"><input value={form.grantContactPhone} onChange={e => set("grantContactPhone", e.target.value)} style={fieldStyle} /></Field>
              </div>
            </div>
            <BranchEditor branches={form.branches} onChange={b => set("branches", b)} />
            <div className="flex items-center justify-end gap-3 border-t pt-4" style={{ borderColor: T.border }}>
              {saved && <span className="text-xs font-semibold" style={{ color: T.success }}>保存しました</span>}
              <Btn icon={Check} onClick={submit} disabled={saving}>{saving ? "保存中…" : "保存する"}</Btn>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ================= 受講生の助成金情報 =================
function TraineeEditForm({ form, onChange, isAdmin }) {
  function set(k, v) { onChange({ ...form, [k]: v }); }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="雇用形態">
          <select value={form.employmentType} onChange={e => set("employmentType", e.target.value)} style={fieldStyle}>
            <option value="">未設定</option>
            {EMPLOYMENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="新卒/既卒">
          <select value={form.graduateStatus} onChange={e => set("graduateStatus", e.target.value)} style={fieldStyle}>
            <option value="">未設定</option>
            {GRADUATE_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="IT経験">
          <select value={form.itExperienceLevel} onChange={e => set("itExperienceLevel", e.target.value)} style={fieldStyle}>
            <option value="">未設定</option>
            {IT_EXPERIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="性別（任意）"><input value={form.gender} onChange={e => set("gender", e.target.value)} style={fieldStyle} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="入社日"><input type="date" value={form.hireDate} onChange={e => set("hireDate", e.target.value)} style={fieldStyle} /></Field>
        <Field label="雇用保険番号"><input value={form.employmentInsuranceNumber} onChange={e => set("employmentInsuranceNumber", e.target.value)} style={fieldStyle} /></Field>
      </div>
      {isAdmin ? (
        <div className="rounded-xl p-3" style={{ background: T.warningSubtle }}>
          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: T.textPrimary }}>
            <input type="checkbox" checked={!!form.grantEligible} onChange={e => set("grantEligible", e.target.checked)} />
            助成金対象として確定する
          </label>
          <div className="mt-2">
            <Field label="対象外の場合の理由等（任意）">
              <textarea value={form.grantEligibilityNote} onChange={e => set("grantEligibilityNote", e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
            </Field>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: T.bgBase, color: T.textMuted }}>
          助成金対象の確定は管理者のみ行います。現在：<Badge tone={form.grantEligible ? "green" : "muted"}>{form.grantEligible ? "対象" : "対象外／未確定"}</Badge>
        </div>
      )}
    </div>
  );
}

export function TraineeGrantInfo({ role }) {
  const isAdmin = role === "admin";
  const { companies, loading: companiesLoading } = useGrantCompanies(isAdmin);
  const [companyId, setCompanyId] = useState("");
  const enabled = isAdmin ? !!companyId : true;
  const { trainees, loading, error, actionError, clearActionError, reload, updateTrainee } = useCompanyTrainees(companyId, enabled);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trainees;
    return trainees.filter(t => [t.name, t.email].some(v => String(v || "").toLowerCase().includes(q)));
  }, [trainees, query]);

  function startEdit(t) {
    setEditing(t);
    setForm({
      employmentType: t.employmentType || "", graduateStatus: t.graduateStatus || "",
      itExperienceLevel: t.itExperienceLevel || "", gender: t.gender || "",
      hireDate: t.hireDate || "", employmentInsuranceNumber: t.employmentInsuranceNumber || "",
      grantEligible: !!t.grantEligible, grantEligibilityNote: t.grantEligibilityNote || "",
    });
    clearActionError();
  }
  function closeForm() { setEditing(null); setForm(null); }

  async function submit() {
    if (!editing || !form || saving) return;
    setSaving(true);
    try {
      const payload = { ...form };
      if (!isAdmin) { delete payload.grantEligible; delete payload.grantEligibilityNote; }
      await updateTrainee(editing.userId, payload);
      closeForm();
    } catch (e) { /* actionErrorはhook側で表示 */ }
    finally { setSaving(false); }
  }

  return (
    <div>
      <SectionHead title="受講生の助成金情報" desc="雇用形態・新卒既卒・IT経験を入力し、助成金対象の可否を確認します。" />
      {isAdmin && <CompanySelector companies={companies} loading={companiesLoading} value={companyId} onChange={setCompanyId} />}
      <ErrorBanner message={actionError} onClose={clearActionError} />
      {isAdmin && !companyId ? (
        <Card><EmptyState icon={Users} title="企業を選択してください" desc="対象企業を選ぶと受講生一覧が表示されます。" /></Card>
      ) : error ? (
        <PrismErrorRetryCard message={error} onRetry={reload} />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4" style={{ borderBottom: `1px solid ${T.border}` }}>
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3" style={{ border: `1px solid ${T.border}` }}>
              <Search size={15} style={{ color: T.textMuted }} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="氏名・メールで検索" className="w-full bg-transparent text-sm outline-none" style={{ color: T.textPrimary }} />
            </div>
          </div>
          {loading ? <SkeletonRows rows={5} />
            : trainees.length === 0 ? <EmptyState icon={Users} title="該当する受講生がいません" desc="企業に受講生が登録されると表示されます。" />
            : filtered.length === 0 ? <div className="px-4 py-8 text-center text-sm" style={{ color: T.textMuted }}>検索条件に一致する受講生がいません。</div>
            : <div>{filtered.map((t, i) => (
              <div key={t.userId} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${T.border}` : "none", background: i % 2 ? T.bgBase : "#fff" }}>
                <Avatar name={t.name || t.email} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{t.name || "氏名未設定"}</span>
                    <Badge tone={t.grantEligible ? "green" : "muted"}>{t.grantEligible ? "助成金対象" : "対象外／未確定"}</Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: T.textMuted }}>
                    <span>{employmentTypeLabel(t.employmentType)}</span>
                    <span>{graduateStatusLabel(t.graduateStatus)}</span>
                    <span>IT経験: {itExperienceLabel(t.itExperienceLevel)}</span>
                  </div>
                </div>
                <Btn kind="ghost" size="sm" icon={Pencil} onClick={() => startEdit(t)}>編集</Btn>
              </div>
            ))}</div>}
        </Card>
      )}
      {editing && form && (
        <Modal title={`受講生情報編集：${editing.name || editing.email || editing.userId}`} onClose={closeForm}
          footer={<><Btn kind="ghost" onClick={closeForm} disabled={saving}>キャンセル</Btn><Btn icon={Check} onClick={submit} disabled={saving}>{saving ? "保存中…" : "保存する"}</Btn></>}>
          <TraineeEditForm form={form} onChange={setForm} isAdmin={isAdmin} />
        </Modal>
      )}
    </div>
  );
}

// ================= 助成金申請 =================
function GrantForm({ form, onChange, companies, courses, trainees }) {
  function set(key, value) {
    if (key === "companyId") { onChange({ ...form, companyId: value, courseId: "", targetTraineeIds: [] }); return; }
    onChange({ ...form, [key]: value });
  }
  function toggleTrainee(id) {
    const has = form.targetTraineeIds.includes(id);
    set("targetTraineeIds", has ? form.targetTraineeIds.filter(x => x !== id) : [...form.targetTraineeIds, id]);
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="対象企業">
          <select value={form.companyId} onChange={e => set("companyId", e.target.value)} style={fieldStyle}>
            <option value="">選択してください</option>
            {companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="対象コース">
          <select value={form.courseId} onChange={e => set("courseId", e.target.value)} style={fieldStyle} disabled={!form.companyId}>
            <option value="">選択してください</option>
            {courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name || c.courseId}</option>)}
          </select>
        </Field>
      </div>
      <Field label="助成金種類">
        <input list="grant-type-suggestions" value={form.grantType} onChange={e => set("grantType", e.target.value)} style={fieldStyle} placeholder="人材開発支援助成金（人材育成支援コース）" />
        <datalist id="grant-type-suggestions">{GRANT_TYPE_SUGGESTIONS.map(t => <option key={t} value={t} />)}</datalist>
      </Field>
      <Field label="申請区分">
        <select value={form.applicationType} onChange={e => set("applicationType", e.target.value)} style={fieldStyle}>
          {APPLICATION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="担当者（ユーザーID・メール等）"><input value={form.assigneeUserId} onChange={e => set("assigneeUserId", e.target.value)} style={fieldStyle} /></Field>
      <Field label="備考"><textarea value={form.remarks} onChange={e => set("remarks", e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} /></Field>
      <div>
        <div className="mb-1.5 text-xs font-semibold" style={{ color: T.textMuted }}>対象受講生（助成金対象の受講生を優先的にチェック済みにしています）</div>
        {!form.companyId ? <div className="text-xs" style={{ color: T.textMuted }}>企業を選択すると受講生一覧が表示されます。</div>
          : trainees.length === 0 ? <div className="text-xs" style={{ color: T.textMuted }}>この企業に受講生がいません。</div>
          : <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl p-2" style={{ border: `1px solid ${T.border}` }}>
            {trainees.map(t => (
              <label key={t.userId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-black/[.02]" style={{ color: T.textPrimary }}>
                <input type="checkbox" checked={form.targetTraineeIds.includes(t.userId)} onChange={() => toggleTrainee(t.userId)} />
                {t.name || t.email || t.userId}
                <Badge tone={t.grantEligible ? "green" : "muted"}>{t.grantEligible ? "対象" : "対象外"}</Badge>
              </label>
            ))}
          </div>}
      </div>
    </div>
  );
}

function GrantCreateModal({ companies, onClose, onCreate, saving, actionError, clearActionError }) {
  const [form, setForm] = useState({ ...EMPTY_GRANT_FORM });
  const { courses } = useCompanyCourses(form.companyId, !!form.companyId);
  const { trainees } = useCompanyTrainees(form.companyId, !!form.companyId);

  useEffect(() => {
    if (form.companyId && trainees.length && form.targetTraineeIds.length === 0) {
      setForm(f => ({ ...f, targetTraineeIds: trainees.filter(t => t.grantEligible).map(t => t.userId) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.companyId, trainees.length]);

  async function submit() {
    if (!form.companyId || !form.courseId || !form.grantType.trim() || saving) return;
    try {
      await onCreate({
        companyId: form.companyId, courseId: form.courseId, grantType: form.grantType.trim(),
        applicationType: form.applicationType, assigneeUserId: form.assigneeUserId, remarks: form.remarks,
        targetTraineeIds: form.targetTraineeIds,
      });
    } catch (e) { /* actionErrorはhook側で表示、モーダルは開いたまま */ }
  }

  return (
    <Modal title="助成金申請 新規登録" onClose={onClose} size="lg"
      footer={<><Btn kind="ghost" onClick={onClose} disabled={saving}>キャンセル</Btn><Btn icon={Check} onClick={submit} disabled={saving || !form.companyId || !form.courseId || !form.grantType.trim()}>{saving ? "登録中…" : "登録する"}</Btn></>}>
      <ErrorBanner message={actionError} onClose={clearActionError} />
      <GrantForm form={form} onChange={setForm} companies={companies} courses={courses} trainees={trainees} />
    </Modal>
  );
}

function GrantDetail({ grant, role, companyName, courseName, trainees, onSave, onOpenDocuments, saving, actionError, clearActionError }) {
  const isAdmin = role === "admin";
  const [status, setStatus] = useState(grant.status);
  const [appliedAt, setAppliedAt] = useState(grant.appliedAt || "");
  const [documentsSubmittedAt, setDocumentsSubmittedAt] = useState(grant.documentsSubmittedAt || "");
  const [paidAt, setPaidAt] = useState(grant.paidAt || "");
  const [progressStage, setProgressStage] = useState(grant.progressStage || "");
  const [assigneeUserId, setAssigneeUserId] = useState(grant.assigneeUserId || "");
  const [amount, setAmount] = useState(grant.amount != null ? String(grant.amount) : "");
  const [remarks, setRemarks] = useState(grant.remarks || "");

  const traineeNames = (grant.targetTraineeIds || []).map(id => trainees.find(t => t.userId === id)?.name || id);

  async function submit() {
    const payload = { remarks };
    if (isAdmin) {
      Object.assign(payload, {
        status, appliedAt: appliedAt || null, documentsSubmittedAt: documentsSubmittedAt || null, paidAt: paidAt || null,
        progressStage, assigneeUserId, amount: amount === "" ? null : Number(amount),
      });
    }
    try { await onSave(payload); } catch (e) { /* actionErrorはhook側 */ }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={actionError} onClose={clearActionError} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="企業"><div className="text-sm font-semibold" style={{ color: T.textPrimary }}>{companyName}</div></Field>
        <Field label="コース"><div className="text-sm font-semibold" style={{ color: T.textPrimary }}>{courseName}</div></Field>
        <Field label="助成金種類"><div className="text-sm" style={{ color: T.textSecondary }}>{grant.grantType || "未設定"}</div></Field>
        <Field label="申請区分"><div className="text-sm" style={{ color: T.textSecondary }}>{applicationTypeLabel(grant.applicationType)}</div></Field>
      </div>
      <Field label="ステータス">
        {isAdmin
          ? <select value={status} onChange={e => setStatus(e.target.value)} style={fieldStyle}>{GRANT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          : <Badge tone={grantStatusTone(grant.status)}>{grantStatusLabel(grant.status)}</Badge>}
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="申請日"><input type="date" value={appliedAt || ""} onChange={e => setAppliedAt(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
        <Field label="提出日"><input type="date" value={documentsSubmittedAt || ""} onChange={e => setDocumentsSubmittedAt(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
        <Field label="支給日"><input type="date" value={paidAt || ""} onChange={e => setPaidAt(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="進捗"><input value={progressStage} onChange={e => setProgressStage(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
        <Field label="担当者"><input value={assigneeUserId} onChange={e => setAssigneeUserId(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
      </div>
      <Field label="金額（円）"><input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
      <Field label="対象受講生">
        <div className="flex flex-wrap gap-1.5">{traineeNames.length ? traineeNames.map((n, i) => <Badge key={i} tone="cyan">{n}</Badge>) : <span className="text-xs" style={{ color: T.textMuted }}>未設定</span>}</div>
      </Field>
      <Field label="備考（企業担当者も編集可）">
        <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: T.border }}>
        <Btn kind="ghost" size="sm" icon={Upload} onClick={onOpenDocuments}>提出書類を見る</Btn>
        <Btn icon={Check} onClick={submit} disabled={saving}>{saving ? "保存中…" : "保存する"}</Btn>
      </div>
    </div>
  );
}

function GrantDetailModal({ grant, role, companies, onClose, onSave, onOpenDocuments, saving, actionError, clearActionError, onRequestDelete }) {
  const isAdmin = role === "admin";
  const { courses } = useCompanyCourses(isAdmin ? grant.companyId : "", true);
  const { trainees } = useCompanyTrainees(isAdmin ? grant.companyId : "", true);
  const { profile: ownProfile } = useCompanyProfile("", !isAdmin);
  const companyName = isAdmin ? (companies.find(c => c.companyId === grant.companyId)?.name || grant.companyId) : (ownProfile?.name || grant.companyId);
  const courseName = courses.find(c => c.courseId === grant.courseId)?.name || grant.courseId;

  return (
    <Modal title={`助成金申請：${companyName}`} onClose={onClose} size="lg"
      footer={<div className="flex w-full items-center justify-between">
        {isAdmin ? <Btn kind="danger" size="sm" icon={Trash2} onClick={onRequestDelete}>削除</Btn> : <span />}
        <Btn kind="ghost" onClick={onClose}>閉じる</Btn>
      </div>}>
      <GrantDetail key={`${grant.grantId}-${grant.updatedAt}`} grant={grant} role={role} companyName={companyName} courseName={courseName}
        trainees={trainees} onSave={onSave} onOpenDocuments={() => onOpenDocuments(grant.grantId)}
        saving={saving} actionError={actionError} clearActionError={clearActionError} />
    </Modal>
  );
}

export function GrantsManager({ role, onOpenDocuments }) {
  const isAdmin = role === "admin";
  const { companies } = useGrantCompanies(isAdmin);
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { items, loading, error, actionError, clearActionError, reload, createGrant, updateGrant, deleteGrant } =
    useGrantsList({ companyId: isAdmin ? companyFilter : undefined, status: statusFilter }, true);
  const [creating, setCreating] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [detailGrant, setDetailGrant] = useState(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const companyName = id => companies.find(c => c.companyId === id)?.name || id;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(g => [g.grantType, companyName(g.companyId)].some(v => String(v || "").toLowerCase().includes(q)));
  }, [items, query, companies]);
  useEffect(() => { setPage(1); }, [query, statusFilter, companyFilter]);
  const visible = pageSlice(filtered, page);

  async function handleCreate(payload) {
    setCreateSaving(true);
    try { await createGrant(payload); setCreating(false); }
    finally { setCreateSaving(false); }
  }
  async function handleSave(payload) {
    setDetailSaving(true);
    try {
      const saved = await updateGrant(detailGrant.grantId, payload);
      if (saved) setDetailGrant(saved);
    } finally { setDetailSaving(false); }
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true); setDeleteErr("");
    try { await deleteGrant(deleteTarget.grantId); setDeleteTarget(null); setDetailGrant(null); }
    catch (e) { setDeleteErr(e?.errorMessage || e?.message || "削除に失敗しました。"); }
    finally { setDeleteBusy(false); }
  }

  return (
    <div>
      <SectionHead title="助成金申請" desc={isAdmin ? "全社の助成金申請を管理します。" : "自社の助成金申請の状況を確認し、備考を編集できます。"}
        action={isAdmin ? <Btn size="sm" icon={Plus} onClick={() => setCreating(true)}>新規申請</Btn> : undefined} />
      {!isAdmin && <div className="mb-4 rounded-xl px-3 py-2 text-xs" style={{ background: T.bgBase, color: T.textMuted }}>新規の助成金申請は運営（管理者）が登録します。備考欄から連絡・依頼事項を記入できます。</div>}
      <ErrorBanner message={actionError} onClose={clearActionError} />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3" style={{ border: `1px solid ${T.border}` }}>
            <Search size={15} style={{ color: T.textMuted }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="助成金種類・企業で検索" className="w-full bg-transparent text-sm outline-none" style={{ color: T.textPrimary }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...fieldStyle, width: "auto" }}>
            <option value="">全ステータス</option>
            {GRANT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {isAdmin && (
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} style={{ ...fieldStyle, width: "auto" }}>
              <option value="">全企業</option>
              {companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
            </select>
          )}
        </div>
        {error ? <div className="p-4"><PrismErrorRetryCard message={error} onRetry={reload} /></div>
          : loading ? <SkeletonRows rows={5} />
          : items.length === 0 ? <EmptyState icon={FileText} title="助成金申請がまだありません" desc={isAdmin ? "「新規申請」から登録できます。" : "登録されると、ここに表示されます。"} />
          : filtered.length === 0 ? <div className="px-4 py-8 text-center text-sm" style={{ color: T.textMuted }}>検索条件に一致する申請がありません。</div>
          : <div>{visible.items.map((g, i) => (
            <div key={g.grantId} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${T.border}` : "none", background: i % 2 ? T.bgBase : "#fff" }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{g.grantType || "助成金種類未設定"}</span>
                  <Badge tone={grantStatusTone(g.status)}>{grantStatusLabel(g.status)}</Badge>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: T.textMuted }}>
                  <span className="inline-flex items-center gap-1"><Building2 size={11} />{companyName(g.companyId)}</span>
                  {g.appliedAt && <span>申請日 {g.appliedAt}</span>}
                  {g.amount != null && <span>{Number(g.amount).toLocaleString("ja-JP")}円</span>}
                  {g.updatedAt && <span>更新 {String(g.updatedAt).slice(0, 10)}</span>}
                </div>
              </div>
              <Btn kind="ghost" size="sm" icon={Eye} onClick={() => setDetailGrant(g)}>詳細を見る</Btn>
            </div>
          ))}</div>}
        <ListPager page={visible.page} totalPages={visible.totalPages} total={visible.total} onPage={setPage} />
      </Card>

      {creating && (
        <GrantCreateModal companies={companies} onClose={() => setCreating(false)} onCreate={handleCreate}
          saving={createSaving} actionError={actionError} clearActionError={clearActionError} />
      )}
      {detailGrant && (
        <GrantDetailModal grant={detailGrant} role={role} companies={companies} onClose={() => setDetailGrant(null)}
          onSave={handleSave} onOpenDocuments={onOpenDocuments} saving={detailSaving}
          actionError={actionError} clearActionError={clearActionError}
          onRequestDelete={() => setDeleteTarget(detailGrant)} />
      )}
      {deleteTarget && (
        <div>
          {deleteErr && <div className="fixed inset-x-0 top-4 z-[999] mx-auto w-fit rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{deleteErr}</div>}
          <DeleteConfirm title="助成金申請の削除" desc={`「${deleteTarget.grantType || deleteTarget.grantId}」を論理削除します。削除後は一覧に表示されません。`}
            warning="提出後（申請済み以降）の申請は削除できません。取下げへ変更してください。" busy={deleteBusy} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
        </div>
      )}
    </div>
  );
}

// ================= 提出書類 =================
function DocumentUploadForm({ onUpload, uploading, uploadError }) {
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPE_SUGGESTIONS[0]);
  const [customType, setCustomType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const type = documentType === "その他" ? (customType.trim() || "その他") : documentType;
    await onUpload({ file, documentType: type, dueDate, note });
  }

  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-bold" style={{ color: T.textPrimary }}>書類をアップロード</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="書類種別">
          <select value={documentType} onChange={e => setDocumentType(e.target.value)} style={fieldStyle}>
            {DOCUMENT_TYPE_SUGGESTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        {documentType === "その他" && <Field label="種別（自由入力）"><input value={customType} onChange={e => setCustomType(e.target.value)} style={fieldStyle} /></Field>}
        <Field label="提出期限（任意）"><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={fieldStyle} /></Field>
      </div>
      <Field label="メモ（任意）"><input value={note} onChange={e => setNote(e.target.value)} style={fieldStyle} /></Field>
      {uploadError && <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{uploadError}</div>}
      <div className="mt-3">
        <input ref={fileRef} type="file" onChange={handleFile} style={{ display: "none" }} />
        <Btn size="sm" icon={Upload} onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? "アップロード中…" : "ファイルを選択してアップロード"}</Btn>
      </div>
    </Card>
  );
}

export function GrantDocuments({ role, initialGrantId, onGrantConsumed }) {
  const isAdmin = role === "admin";
  const { companies } = useGrantCompanies(isAdmin);
  const [companyFilter, setCompanyFilter] = useState("");
  const { items: grants, loading: grantsLoading } = useGrantsList({ companyId: isAdmin ? companyFilter : undefined }, true);
  const [grantId, setGrantId] = useState(initialGrantId || "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (initialGrantId) { setGrantId(initialGrantId); onGrantConsumed && onGrantConsumed(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGrantId]);

  const { items: documents, loading, error, actionError, clearActionError, reload, uploadDocument, reviewDocument, removeDocument, viewDocument } =
    useGrantDocuments(grantId, !!grantId);

  const companyName = id => companies.find(c => c.companyId === id)?.name || id;

  async function handleUpload(args) {
    setUploading(true); setUploadError("");
    try { await uploadDocument(args); }
    catch (e) { setUploadError(e?.errorMessage || e?.message || "アップロードに失敗しました。"); }
    finally { setUploading(false); }
  }
  async function handleView(documentId) {
    try {
      const url = await viewDocument(documentId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) { window.alert("書類URLの取得に失敗しました。時間を置いて再試行してください。"); }
  }
  async function submitReview(status) {
    if (!reviewTarget) return;
    setReviewBusy(true);
    try { await reviewDocument(reviewTarget.documentId, status, reviewNote); setReviewTarget(null); setReviewNote(""); }
    finally { setReviewBusy(false); }
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try { await removeDocument(deleteTarget.documentId); setDeleteTarget(null); }
    finally { setDeleteBusy(false); }
  }

  return (
    <div>
      <SectionHead title="提出書類" desc="助成金申請を選択し、書類のアップロード・確認・審査を行います。" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isAdmin && (
          <select value={companyFilter} onChange={e => { setCompanyFilter(e.target.value); setGrantId(""); }} style={{ ...fieldStyle, width: "auto" }}>
            <option value="">全企業</option>
            {companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
        )}
        <select value={grantId} onChange={e => setGrantId(e.target.value)} style={{ ...fieldStyle, width: "auto", minWidth: 260 }} disabled={grantsLoading}>
          <option value="">助成金申請を選択してください</option>
          {grants.map(g => <option key={g.grantId} value={g.grantId}>{companyName(g.companyId)} / {g.grantType || "種類未設定"}</option>)}
        </select>
      </div>

      {!grantId ? (
        <Card><EmptyState icon={Upload} title="助成金申請を選択してください" desc="申請を選ぶと提出書類が表示されます。" /></Card>
      ) : (
        <div className="space-y-4">
          <DocumentUploadForm onUpload={handleUpload} uploading={uploading} uploadError={uploadError} />
          <ErrorBanner message={actionError} onClose={clearActionError} />
          <Card className="overflow-hidden">
            {error ? <div className="p-4"><PrismErrorRetryCard message={error} onRetry={reload} /></div>
              : loading ? <SkeletonRows rows={4} />
              : documents.length === 0 ? <EmptyState icon={FileText} title="この助成金にはまだ書類がありません" desc="上のフォームからアップロードできます。" />
              : <div>{documents.map((d, i) => (
                <div key={d.documentId} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${T.border}` : "none", background: i % 2 ? T.bgBase : "#fff" }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{d.documentType || "種別未設定"}</span>
                      <Badge tone={documentStatusTone(d.status)}>{documentStatusLabel(d.status)}</Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: T.textMuted }}>
                      <span className="truncate">{d.fileName}</span>
                      {d.dueDate && <span>期限 {d.dueDate}</span>}
                      {d.uploadedAt && <span>提出 {String(d.uploadedAt).slice(0, 10)}</span>}
                    </div>
                    {d.note && <div className="mt-1 text-xs" style={{ color: T.textMuted }}>メモ: {d.note}</div>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Btn kind="ghost" size="sm" icon={Download} onClick={() => handleView(d.documentId)}>DL・閲覧</Btn>
                    {isAdmin && d.status === "submitted" && <Btn kind="ghost" size="sm" icon={Check} onClick={() => { setReviewTarget(d); setReviewNote(""); }}>審査</Btn>}
                    {isAdmin && <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => setDeleteTarget(d)}>削除</Btn>}
                  </div>
                </div>
              ))}</div>}
          </Card>
        </div>
      )}

      {reviewTarget && (
        <Modal title={`書類の審査：${reviewTarget.documentType}`} onClose={() => setReviewTarget(null)}
          footer={<>
            <Btn kind="ghost" onClick={() => setReviewTarget(null)} disabled={reviewBusy}>キャンセル</Btn>
            <Btn kind="danger" onClick={() => submitReview("rejected")} disabled={reviewBusy}>差し戻す</Btn>
            <Btn icon={Check} onClick={() => submitReview("accepted")} disabled={reviewBusy}>受理する</Btn>
          </>}>
          <Field label="差戻し理由・コメント（任意）">
            <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
          </Field>
        </Modal>
      )}
      {deleteTarget && (
        <DeleteConfirm title="書類の削除" desc={`「${deleteTarget.fileName || deleteTarget.documentType}」を完全に削除します（復元できません）。`}
          warning="S3上のファイルとメタデータの両方が削除されます。" busy={deleteBusy} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      )}
    </div>
  );
}

// ================= 予約 =================
function ReservationForm({ form, onChange, isAdmin, companies, courses, trainees }) {
  function set(k, v) {
    if (k === "companyId") { onChange({ ...form, companyId: v, courseId: "", traineeId: "" }); return; }
    onChange({ ...form, [k]: v });
  }
  return (
    <div className="space-y-3">
      <Field label="種別">
        <select value={form.type} onChange={e => set("type", e.target.value)} style={fieldStyle}>
          {RESERVATION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      {isAdmin && (
        <Field label="対象企業">
          <select value={form.companyId} onChange={e => set("companyId", e.target.value)} style={fieldStyle}>
            <option value="">選択してください</option>
            {companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="対象コース（任意）">
          <select value={form.courseId} onChange={e => set("courseId", e.target.value)} style={fieldStyle} disabled={isAdmin && !form.companyId}>
            <option value="">未選択</option>
            {courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name || c.courseId}</option>)}
          </select>
        </Field>
        <Field label="対象受講生（任意）">
          <select value={form.traineeId} onChange={e => set("traineeId", e.target.value)} style={fieldStyle} disabled={isAdmin && !form.companyId}>
            <option value="">未選択</option>
            {trainees.map(t => <option key={t.userId} value={t.userId}>{t.name || t.email}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="日時"><input type="datetime-local" value={form.scheduledAt} onChange={e => set("scheduledAt", e.target.value)} style={fieldStyle} /></Field>
        <Field label="所要時間（分）"><input type="number" min="15" max="480" value={form.durationMinutes} onChange={e => set("durationMinutes", e.target.value)} style={fieldStyle} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="会場（任意）"><input value={form.location} onChange={e => set("location", e.target.value)} style={fieldStyle} /></Field>
        <Field label="オンラインURL（任意）"><input value={form.onlineUrl} onChange={e => set("onlineUrl", e.target.value)} style={fieldStyle} /></Field>
      </div>
      <Field label="メモ（任意）"><textarea value={form.note} onChange={e => set("note", e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} /></Field>
      {isAdmin && (
        <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: T.textPrimary }}>
          <input type="checkbox" checked={!!form.confirmOnCreate} onChange={e => set("confirmOnCreate", e.target.checked)} />
          登録と同時に確定にする
        </label>
      )}
    </div>
  );
}

export function ReservationManager({ role }) {
  const isAdmin = role === "admin";
  const { companies } = useGrantCompanies(isAdmin);
  const [companyFilter, setCompanyFilter] = useState("");
  const { items, loading, error, actionError, clearActionError, reload, createReservation, updateReservationStatus } =
    useReservations({ companyId: isAdmin ? companyFilter : undefined }, true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_RESERVATION_FORM });
  const [saving, setSaving] = useState(false);
  const { courses } = useCompanyCourses(isAdmin ? form.companyId : "", isAdmin ? !!form.companyId : true);
  const { trainees } = useCompanyTrainees(isAdmin ? form.companyId : "", isAdmin ? !!form.companyId : true);

  const companyName = id => companies.find(c => c.companyId === id)?.name || id;
  const sorted = useMemo(() => [...items].sort((a, b) => String(a.scheduledAt || "").localeCompare(String(b.scheduledAt || ""))), [items]);

  function startNew() { setForm({ ...EMPTY_RESERVATION_FORM }); setCreating(true); clearActionError(); }
  async function submit() {
    if (!form.scheduledAt || saving) return;
    if (isAdmin && !form.companyId) return;
    setSaving(true);
    try {
      const scheduledIso = new Date(form.scheduledAt).toISOString();
      const payload = {
        type: form.type, scheduledAt: scheduledIso, durationMinutes: Number(form.durationMinutes) || 60,
        courseId: form.courseId || undefined, traineeId: form.traineeId || undefined,
        location: form.location || undefined, onlineUrl: form.onlineUrl || undefined, note: form.note || "",
      };
      if (isAdmin) {
        payload.companyId = form.companyId;
        if (form.confirmOnCreate) payload.status = "confirmed";
      }
      await createReservation(payload);
      setCreating(false);
    } catch (e) { /* actionErrorはhook側で表示 */ }
    finally { setSaving(false); }
  }
  async function setStatus(r, status) {
    try { await updateReservationStatus(r.reservationId, status); } catch (e) { /* actionError */ }
  }

  return (
    <div>
      <SectionHead title="予約" desc={isAdmin ? "個社面談・成果報告会の予約を作成・確定します。" : "個社面談・成果報告会をリクエストできます（確定は運営が行います）。"}
        action={<div className="flex items-center gap-2">
          {isAdmin && (
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} style={{ ...fieldStyle, width: "auto" }}>
              <option value="">全企業</option>
              {companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
            </select>
          )}
          <Btn size="sm" icon={Plus} onClick={startNew}>{isAdmin ? "新規予約" : "面談をリクエスト"}</Btn>
        </div>} />
      <ErrorBanner message={actionError} onClose={clearActionError} />
      <Card className="overflow-hidden">
        {error ? <div className="p-4"><PrismErrorRetryCard message={error} onRetry={reload} /></div>
          : loading ? <SkeletonRows rows={4} />
          : items.length === 0 ? <EmptyState icon={CalendarClock} title="予約がまだありません" desc={isAdmin ? "「新規予約」から登録できます。" : "「面談をリクエスト」から依頼できます。"} />
          : <div>{sorted.map((r, i) => (
            <div key={r.reservationId} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${T.border}` : "none", background: i % 2 ? T.bgBase : "#fff" }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{reservationTypeLabel(r.type)}</span>
                  <Badge tone={reservationStatusTone(r.status)}>{reservationStatusLabel(r.status)}</Badge>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: T.textMuted }}>
                  <span className="inline-flex items-center gap-1"><Building2 size={11} />{companyName(r.companyId)}</span>
                  <span>{r.scheduledAt ? String(r.scheduledAt).slice(0, 16).replace("T", " ") : "日時未設定"}（{r.durationMinutes || 60}分）</span>
                  {r.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{r.location}</span>}
                </div>
                {r.note && <div className="mt-1 text-xs" style={{ color: T.textMuted }}>{r.note}</div>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {isAdmin && r.status === "proposed" && <Btn kind="ghost" size="sm" icon={Check} onClick={() => setStatus(r, "confirmed")}>確定</Btn>}
                {r.status !== "cancelled" && <Btn kind="ghost" size="sm" icon={X} onClick={() => setStatus(r, "cancelled")}>キャンセル</Btn>}
              </div>
            </div>
          ))}</div>}
      </Card>
      {creating && (
        <Modal title={isAdmin ? "新規予約" : "面談をリクエスト"} onClose={() => setCreating(false)} size="lg"
          footer={<><Btn kind="ghost" onClick={() => setCreating(false)} disabled={saving}>キャンセル</Btn><Btn icon={Check} onClick={submit} disabled={saving || !form.scheduledAt || (isAdmin && !form.companyId)}>{saving ? "登録中…" : "登録する"}</Btn></>}>
          <ReservationForm form={form} onChange={setForm} isAdmin={isAdmin} companies={companies} courses={courses} trainees={trainees} />
        </Modal>
      )}
    </div>
  );
}
