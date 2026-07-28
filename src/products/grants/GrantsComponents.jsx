import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, Building2, CalendarClock, Calculator, Check, ChevronLeft, ChevronRight,
  Clock, Download, Eye, FileText, MapPin, Pencil, Plus, Search, Trash2, Upload, Users, X,
} from "lucide-react";
import {
  APPLICATION_TYPE_OPTIONS, applicationTypeLabel, DOCUMENT_TYPE_SUGGESTIONS, documentStatusLabel,
  documentStatusTone, EMPLOYMENT_TYPE_OPTIONS, employmentTypeLabel, EMPTY_GRANT_FORM, EMPTY_RESERVATION_FORM,
  ENTERPRISE_SIZE_OPTIONS, FORM_TYPE_OPTIONS, GRADUATE_STATUS_OPTIONS, graduateStatusLabel, GRANT_STATUS_OPTIONS,
  GRANT_TYPE_SUGGESTIONS, GRANTS_HOME_CARDS, grantStatusLabel, grantStatusTone, IT_EXPERIENCE_OPTIONS,
  itExperienceLabel, RATE_MASTER_APPLICATION_TYPE_OPTIONS, RATE_MASTER_COMPANY_SIZE_OPTIONS,
  RESERVATION_TYPE_OPTIONS, reservationStatusLabel, reservationStatusTone, reservationTypeLabel,
} from "./GrantsCatalog.js";
import {
  useCompanyCourses, useCompanyProfile, useCompanyTrainees, useGrantCalculationDraft, useGrantCompanies,
  useGrantCoursesMap, useGrantDocuments, useGrantExports, useGrantsList, useRateMaster, useRateMasterYears,
  useReservations,
} from "./useGrants.js";
import { computeGrantStages, computeNextActions } from "./grantStages.js";
import {
  Avatar, Badge, Btn, Card, EmptyState, Field, fieldStyle, Modal, PageHeader, PrismErrorRetryCard,
  ProductNavCard, SectionHead, SkeletonRows, T, TraineeBulkImportPanel,
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

// ---- ステージ・期限アラート・次アクション表示（2026-07-20 UX改善） ----
// grantStages.js の純粋関数（computeGrantStages/computeNextActions）をUI化する共通部品。
// gr_home（軽量版・要約カード）とgr_list詳細（フル版）の両方から使う。
function stageStateTone(value) {
  if (value === "accepted") return "green";
  if (value === "overdue" || value === "rejected") return "red";
  if (value === "cancelled" || value === "not_applicable" || value === "not_started") return "muted";
  return "amber"; // preparing / submitted / under_review
}

function DeadlineText({ deadline, compact = false }) {
  if (!deadline) return <span className="text-xs" style={{ color: T.textMuted }}>日程未設定</span>;
  const { date, daysRemaining, overdue, urgent } = deadline;
  const color = overdue ? T.danger : urgent ? T.warning : T.textMuted;
  const Icon = overdue ? AlertTriangle : urgent ? Clock : null;
  const label = overdue ? `期限超過（${Math.abs(daysRemaining)}日経過）` : `残り${daysRemaining}日`;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>
      {Icon && <Icon size={12} />}
      {compact ? label : `期限 ${date}（${label}）`}
    </span>
  );
}

// 3ステージ（計画申請・変更申請・支給申請）タイムライン。1440px/390pxいずれもgrid-colsが
// 3列→1列（sm未満）に落ちるだけなので横スクロールは発生しない。
function GrantStageTimeline({ stages }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stages.map(s => (
        <Card key={s.key} className="p-3" style={s.current ? { border: `2px solid ${T.accent}` } : {}}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{s.label}</span>
            {s.current && <Badge tone="cyan">現在</Badge>}
          </div>
          <div className="mt-1.5"><Badge tone={stageStateTone(s.state.value)}>{s.state.label}</Badge></div>
          <div className="mt-2"><DeadlineText deadline={s.deadline} /></div>
        </Card>
      ))}
    </div>
  );
}

function GrantNextActions({ actions, title = "次にやること" }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="rounded-xl p-3" style={{ background: T.accentSubtle }}>
      <div className="mb-1.5 text-xs font-bold" style={{ color: T.textPrimary }}>{title}</div>
      <ul className="space-y-1">
        {actions.map((a, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: T.textSecondary }}>
            <ArrowRight size={12} style={{ marginTop: 2, flexShrink: 0, color: T.accent }} />
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ================= Home =================
export function GrantsHome({ goSub, role = "client", themeColor = "#C9A227" }) {
  const isAdmin = role === "admin";
  const { items: grants, loading: gLoading, error: gError, reload: gReload } = useGrantsList({}, true);
  const { items: reservations, loading: rLoading } = useReservations({}, true);
  const { companies } = useGrantCompanies(isAdmin);
  const today = new Date().toISOString().slice(0, 10);
  const activeGrants = useMemo(() => grants.filter(g => !["paid", "rejected", "cancelled"].includes(g.status)), [grants]);
  const pendingCount = activeGrants.length;
  const upcomingCount = reservations.filter(r => r.status !== "cancelled" && String(r.scheduledAt || "").slice(0, 10) >= today).length;
  const desc = role === "admin"
    ? "全社の助成金申請・提出書類・予約状況を確認できます。"
    : "自社の助成金申請・提出書類・予約状況を確認・管理します。";

  // 期限アラート・次アクションの要約カード用（コース日程はgr_home表示中の申請分のみ軽量取得）。
  const { coursesById, loading: coursesLoading, error: coursesError } = useGrantCoursesMap(activeGrants, isAdmin, !gLoading);
  const companyName = id => companies.find(c => c.companyId === id)?.name || "（企業情報なし）";
  const summaries = useMemo(() => {
    if (gLoading || coursesLoading) return [];
    return activeGrants
      .map(g => {
        const course = coursesById[g.courseId] || null;
        const stages = computeGrantStages(g, course);
        const actions = computeNextActions({ grant: g, stages, course });
        const current = stages.find(s => s.current) || null;
        const urgency = stages.reduce((acc, s) => {
          if (s.deadline?.overdue) return Math.min(acc, -10000 + s.deadline.daysRemaining);
          if (s.deadline?.urgent) return Math.min(acc, s.deadline.daysRemaining);
          return acc;
        }, 10000);
        return { grant: g, current, actions, urgency };
      })
      .sort((a, b) => a.urgency - b.urgency);
  }, [activeGrants, coursesById, gLoading, coursesLoading]);
  const visibleSummaries = summaries.slice(0, 6);

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

      {/* Excel帳票エクスポートの入口が分かりにくいというフィードバックへの対応（2026-07-20）。
          gr_documents（提出書類）内の生成パネルへ直接誘導する。 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={{ background: T.accentSubtle, border: `1px solid ${T.border}` }}>
        <div className="flex items-start gap-3">
          <FileText size={16} style={{ color: T.accent, marginTop: 2 }} />
          <div>
            <div className="text-sm font-bold" style={{ color: T.textPrimary }}>Excel帳票の生成</div>
            <p className="text-xs" style={{ color: T.textMuted }}>計画申請・変更申請・支給申請書類一式・OFF-JT実施状況報告書をLMSデータから生成できます。</p>
          </div>
        </div>
        <Btn size="sm" icon={FileText} onClick={() => goSub("gr_documents")}>帳票を生成する</Btn>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {GRANTS_HOME_CARDS.filter(c => !c.adminOnly || role === "admin").map((c, i) => (
          <ProductNavCard key={c.key} product="grants" icon={c.icon} title={c.label} desc={c.desc}
            onClick={() => goSub(c.key)} highlight={i === 0} badge={i === 0 ? "よく使う" : undefined} delay={200 + i * 40} />
        ))}
      </div>

      {/* 申請ごとのステージ進行状況・期限アラート・次アクションの要約（2026-07-20 UX改善）。
          コース日程が確認できない申請は「日程未設定」表示になり、0日・NaNには丸めない。 */}
      {!gLoading && activeGrants.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-bold" style={{ color: T.textPrimary }}>申請の進捗・次にやること</div>
            <Btn kind="ghost" size="sm" onClick={() => goSub("gr_list")}>すべて見る</Btn>
          </div>
          {coursesLoading ? <SkeletonRows rows={2} /> : (
            <>
              {coursesError && <div className="mb-2 text-xs" style={{ color: T.textMuted }}>{coursesError}（期限の一部が確認できません）</div>}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleSummaries.map(({ grant, current, actions }) => (
                  <Card key={grant.grantId} className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-bold" style={{ color: T.textPrimary }}>{grant.grantType || "助成金種類未設定"}</span>
                      <Badge tone={grantStatusTone(grant.status)}>{grantStatusLabel(grant.status)}</Badge>
                    </div>
                    {isAdmin && <div className="mt-0.5 text-xs" style={{ color: T.textMuted }}>{companyName(grant.companyId)}</div>}
                    {current && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={stageStateTone(current.state.value)}>{current.label}：{current.state.label}</Badge>
                        <DeadlineText deadline={current.deadline} compact />
                      </div>
                    )}
                    {actions[0] && <div className="mt-2 text-xs leading-relaxed" style={{ color: T.textSecondary }}>次: {actions[0]}</div>}
                  </Card>
                ))}
              </div>
              {summaries.length > visibleSummaries.length && (
                <div className="mt-2 text-xs" style={{ color: T.textMuted }}>他{summaries.length - visibleSummaries.length}件は「助成金申請」から確認できます。</div>
              )}
            </>
          )}
        </div>
      )}

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
  delete payload.updatedAt;
  delete payload.updatedByRole;
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
      <SectionHead title="企業プロフィール" desc="助成金申請の基礎情報となる企業情報です。法人番号・代表者等の確定情報も含め、自社分は企業担当者が編集できます。行政手続きに使う情報のため、入力内容は正確にご確認のうえ保存してください。" />
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
                <Field label="代表者役職"><input value={form.representativeTitle} onChange={e => set("representativeTitle", e.target.value)} style={fieldStyle} /></Field>
                <Field label="代表者氏名"><input value={form.representativeName} onChange={e => set("representativeName", e.target.value)} style={fieldStyle} /></Field>
              </div>
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
                <Field label="法人番号（13桁）"><input value={form.corporateNumber} onChange={e => set("corporateNumber", e.target.value)} style={fieldStyle} /></Field>
                <Field label="資本金（円）"><input type="number" min="0" value={form.capitalAmount ?? ""} onChange={e => set("capitalAmount", e.target.value)} style={fieldStyle} /></Field>
                <Field label="従業員数"><input type="number" min="0" value={form.employeeCount ?? ""} onChange={e => set("employeeCount", e.target.value)} style={fieldStyle} /></Field>
                <Field label="通常就業時間"><input value={form.standardWorkingHours} onChange={e => set("standardWorkingHours", e.target.value)} style={fieldStyle} placeholder="09:00-18:00" /></Field>
                <Field label="研修中就業時間"><input value={form.trainingWorkingHours} onChange={e => set("trainingWorkingHours", e.target.value)} style={fieldStyle} placeholder="09:00-17:00" /></Field>
                <Field label="企業規模区分（自己申告）">
                  <select value={form.enterpriseSize || ""} onChange={e => set("enterpriseSize", e.target.value)} style={fieldStyle}>
                    <option value="">未設定</option>
                    {ENTERPRISE_SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: T.bgBase, color: T.textMuted }}>企業規模区分は助成率・上限額の判定に使う自己申告項目です（支給要領の定義に沿って選択してください）。</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="助成金担当者役職"><input value={form.grantContactTitle} onChange={e => set("grantContactTitle", e.target.value)} style={fieldStyle} /></Field>
                <Field label="助成金担当者氏名"><input value={form.grantContactName} onChange={e => set("grantContactName", e.target.value)} style={fieldStyle} /></Field>
                <Field label="助成金担当者Email"><input value={form.grantContactEmail} onChange={e => set("grantContactEmail", e.target.value)} style={fieldStyle} /></Field>
                <Field label="助成金担当者電話"><input value={form.grantContactPhone} onChange={e => set("grantContactPhone", e.target.value)} style={fieldStyle} /></Field>
              </div>
            </div>
            <BranchEditor branches={form.branches} onChange={b => set("branches", b)} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: T.border }}>
              <span className="text-xs" style={{ color: T.textMuted }}>
                {form.updatedAt ? `最終更新: ${form.updatedAt.slice(0, 19).replace("T", " ")}${form.updatedByRole ? `（${form.updatedByRole === "admin" ? "管理者" : "企業担当者"}）` : ""}` : "未保存"}
              </span>
              <div className="flex items-center gap-3">
                {saved && <span className="text-xs font-semibold" style={{ color: T.success }}>保存しました</span>}
                <Btn icon={Check} onClick={submit} disabled={saving}>{saving ? "保存中…" : "保存する"}</Btn>
              </div>
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
  const { courses: bulkImportCourses } = useCompanyCourses(companyId, enabled);
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
      <SectionHead title="受講生の助成金情報" desc="雇用形態・新卒既卒・IT経験を入力し、助成金対象の可否を確認します。"
        action={enabled && (!isAdmin || companyId) ? (
          <TraineeBulkImportPanel
            label="Excelで一括登録"
            desc={isAdmin ? "選択した企業に所属する受講生アカウントを、ひな形Excelから一括作成します。" : "自社の社員（受講生）アカウントを、ひな形Excelから一括作成します。"}
            courses={bulkImportCourses}
            companyId={companyId}
            onCompleted={reload}
          />
        ) : null} />
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

// 経費実費（Grant.expenseActualCosts）フォーム⇔API変換。docs/specs/grant-calculation-spec.md §2-3。
// number入力は空文字を許容するため文字列でstate保持し、送信時のみnull/numberへ変換する。
const EXPENSE_COST_FIELDS = ["perPersonEnrollmentFee", "perPersonCertificationFee", "inCompanyCostTotal", "previousReceivedDeduction"];
function expenseCostsToForm(costs) {
  const form = { note: costs?.note || "" };
  for (const field of EXPENSE_COST_FIELDS) form[field] = costs?.[field] != null ? String(costs[field]) : "";
  return form;
}
function expenseCostsFromForm(form) {
  const out = { note: form.note || "" };
  for (const field of EXPENSE_COST_FIELDS) out[field] = form[field] === "" || form[field] == null ? null : Number(form[field]);
  return out;
}

// ---- 経費実費入力セクション。docs/specs/grant-calculation-spec.md §2-3・§3。
// 会計・請求書データはLMSが自動取得できないため、企業担当者または管理者が手入力する
// （PUT /grants/{id} のexpenseActualCosts、GrantDetailのsubmit()で他フィールドと一緒に保存される）。
function GrantExpenseCostsPanel({ expenseCosts, onChange }) {
  return (
    <Card className="p-4">
      <div className="mb-1 text-sm font-bold" style={{ color: T.textPrimary }}>経費実費（1人当たり訓練経費の元データ）</div>
      <div className="mb-3 text-xs" style={{ color: T.textMuted }}>
        会計・請求書データはLMSで自動取得できないため、実費を入力してください。入力後「保存する」を押し、
        下の「助成金額を計算する（下書き）」で経費助成額を再計算できます。
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="1人当たり入学料等（事業外訓練の経費、円）">
          <input type="number" min="0" value={expenseCosts.perPersonEnrollmentFee} onChange={e => onChange("perPersonEnrollmentFee", e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="1人当たり職業能力検定等費用（円）">
          <input type="number" min="0" value={expenseCosts.perPersonCertificationFee} onChange={e => onChange("perPersonCertificationFee", e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="事業内訓練の経費（按分後合計額、円。通常は空欄のままでよい）">
          <input type="number" min="0" value={expenseCosts.inCompanyCostTotal} onChange={e => onChange("inCompanyCostTotal", e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="既受給控除額（円、任意）">
          <input type="number" min="0" value={expenseCosts.previousReceivedDeduction} onChange={e => onChange("previousReceivedDeduction", e.target.value)} style={fieldStyle} />
        </Field>
      </div>
      <Field label="根拠メモ（請求書番号等、任意）">
        <textarea value={expenseCosts.note} onChange={e => onChange("note", e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
      </Field>
    </Card>
  );
}

// ---- 助成金計算（下書き）セクション。docs/specs/grant-calculation-spec.md §4-3。
// GET /grants/{id}/calculation-draftを叩き、不足項目チェック＋賃金助成額・経費助成額（下書き）を表示する。
// 経費助成額は上のGrantExpenseCostsPanelで実費が入力・保存済みの場合のみ計算される。
// 「amountへ反映」はAPIを新設せず、既存のamount入力欄（GrantDetailのstate）へ値をセットするだけ
// （実際の確定PUTは既存の「保存する」ボタンで行う。自動確定はしない）。
function GrantCalculationDraftPanel({ grant, isAdmin, onReflectAmount }) {
  const { calculate, calculating, error, result } = useGrantCalculationDraft(grant.grantId);

  async function handleCalculate() {
    try { await calculate(); } catch (e) { /* errorはhook側で表示 */ }
  }

  const lastDraft = grant.calculatedAmountDraft;
  const lastDraftAt = grant.calculatedAmountDraftAt;

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-bold" style={{ color: T.textPrimary }}>
        <Calculator size={15} />助成金計算（下書き）
      </div>
      <div className="mb-3 text-xs" style={{ color: T.textMuted }}>
        実訓練時間数（勤怠から機械算出）×年度別マスタの賃金助成単価から、賃金助成額の下書きを計算します。
        確定額（上の「金額（円）」欄）は自動更新されません。内容を確認のうえ、必要なら手動調整して保存してください。
      </div>

      {!result && lastDraft != null && (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: T.bgBase, color: T.textSecondary }}>
          前回の下書き計算: {Number(lastDraft).toLocaleString("ja-JP")}円{lastDraftAt ? `（${String(lastDraftAt).slice(0, 10)}算出）` : ""}
        </div>
      )}

      <Btn size="sm" icon={Calculator} onClick={handleCalculate} disabled={calculating}>
        {calculating ? "計算中…" : "助成金額を計算する（下書き）"}
      </Btn>

      {error && <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{error}</div>}

      {result && (
        <div className="mt-3 space-y-2">
          {result.missingItems?.length > 0 && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.warningSubtle, color: T.warning }}>
              <div className="mb-1 font-bold">不足項目（{result.missingItems.length}件）</div>
              <ul className="list-disc space-y-0.5 pl-4">
                {result.missingItems.map(item => <li key={item.code}>{item.label}</li>)}
              </ul>
            </div>
          )}
          {result.canCalculateWage && result.wageSubsidy && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.successSubtle, color: T.success }}>
              <div className="mb-1 font-bold">賃金助成額（下書き）</div>
              <div>実訓練時間数合計: 約{result.wageSubsidy.totalActualTrainingHoursDecimal}時間（{result.wageSubsidy.totalActualTrainingMinutes}分）</div>
              <div>単価: {Number(result.wageSubsidy.hourlyRate).toLocaleString("ja-JP")}円/時間（{result.fiscalYear}年度マスタ）</div>
              <div className="mt-1 text-sm font-bold">賃金助成額: {Number(result.wageSubsidy.amount).toLocaleString("ja-JP")}円</div>
            </div>
          )}
          {result.canCalculateExpense && result.expenseSubsidy ? (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.successSubtle, color: T.success }}>
              <div className="mb-1 font-bold">経費助成額（下書き）</div>
              <div>1人当たり訓練経費: {Number(result.expenseSubsidy.perPersonTrainingCost).toLocaleString("ja-JP")}円</div>
              <div>対象者数: 正規雇用労働者等 {result.expenseSubsidy.regularCount}名（助成率{result.expenseSubsidy.rateRegular}%） / 有期契約労働者等 {result.expenseSubsidy.fixedTermCount}名（助成率{result.expenseSubsidy.rateFixedTerm}%）</div>
              <div>上限額: 1人当たり{Number(result.expenseSubsidy.capPerPerson).toLocaleString("ja-JP")}円（合計上限 {Number(result.expenseSubsidy.capTotal).toLocaleString("ja-JP")}円）</div>
              <div className="mt-1 text-sm font-bold">経費助成額: {Number(result.expenseSubsidy.amount).toLocaleString("ja-JP")}円</div>
            </div>
          ) : (
            !result.canCalculateWage || result.expenseSubsidy == null ? (
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.bgBase, color: T.textMuted }}>
                {result.canCalculateWage ? "経費助成額は不足項目を解消すると計算されます（上の「経費実費」入力を確認してください）。" : "不足項目を解消すると助成額（下書き）が計算されます。"}
              </div>
            ) : null
          )}
          {result.totalDraftAmount != null && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.bgBase, color: T.textPrimary }}>
              <div className="text-sm font-bold">合計（下書き）: {Number(result.totalDraftAmount).toLocaleString("ja-JP")}円</div>
              {isAdmin && (
                <div className="mt-2">
                  <Btn kind="ghost" size="sm" onClick={() => onReflectAmount(result.totalDraftAmount)}>
                    この値を「金額（円）」欄へ反映（保存するまで確定しません）
                  </Btn>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function GrantDetail({
  grant, role, companyName, courseName, course, companyProfile, documents, documentsLoading, onDocumentsGenerated,
  trainees, onSave, onOpenDocuments, saving, actionError, clearActionError,
}) {
  const isAdmin = role === "admin";
  const [status, setStatus] = useState(grant.status);
  const [appliedAt, setAppliedAt] = useState(grant.appliedAt || "");
  const [changeDate, setChangeDate] = useState(grant.changeDate || "");
  const [documentsSubmittedAt, setDocumentsSubmittedAt] = useState(grant.documentsSubmittedAt || "");
  const [paidAt, setPaidAt] = useState(grant.paidAt || "");
  const [progressStage, setProgressStage] = useState(grant.progressStage || "");
  const [assigneeUserId, setAssigneeUserId] = useState(grant.assigneeUserId || "");
  const [amount, setAmount] = useState(grant.amount != null ? String(grant.amount) : "");
  const [remarks, setRemarks] = useState(grant.remarks || "");
  // 経費実費（1人当たり訓練経費の元データ）。docs/specs/grant-calculation-spec.md §2-3・§3。
  // remarksと同様、admin・client（自社分）どちらも編集可能（実費データの出所は自社の会計・請求書）。
  const [expenseCosts, setExpenseCosts] = useState(() => expenseCostsToForm(grant.expenseActualCosts));

  const traineeNames = (grant.targetTraineeIds || []).map(id => trainees.find(t => t.userId === id)?.name || "（不明な受講生）");
  const stages = useMemo(() => computeGrantStages(grant, course), [grant, course]);
  const nextActions = useMemo(
    () => computeNextActions({ grant, stages, course, company: companyProfile, documents: documentsLoading ? undefined : documents }),
    [grant, stages, course, companyProfile, documents, documentsLoading],
  );

  function updateExpenseCost(field, value) {
    setExpenseCosts(prev => ({ ...prev, [field]: value }));
  }

  async function submit() {
    const payload = { remarks, expenseActualCosts: expenseCostsFromForm(expenseCosts) };
    if (isAdmin) {
      Object.assign(payload, {
        status, appliedAt: appliedAt || null, changeDate: changeDate || null,
        documentsSubmittedAt: documentsSubmittedAt || null, paidAt: paidAt || null,
        progressStage, assigneeUserId, amount: amount === "" ? null : Number(amount),
      });
    }
    try { await onSave(payload); } catch (e) { /* actionErrorはhook側 */ }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={actionError} onClose={clearActionError} />

      <div>
        <div className="mb-2 text-xs font-bold" style={{ color: T.textMuted }}>ステージ・期限（計画申請→変更申請→支給申請）</div>
        <GrantStageTimeline stages={stages} />
      </div>
      <GrantNextActions actions={nextActions} />

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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="申請日（計画申請）"><input type="date" value={appliedAt || ""} onChange={e => setAppliedAt(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
        <Field label="変更予定日（変更申請がある場合のみ）"><input type="date" value={changeDate || ""} onChange={e => setChangeDate(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="提出日（支給申請）"><input type="date" value={documentsSubmittedAt || ""} onChange={e => setDocumentsSubmittedAt(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
        <Field label="支給日"><input type="date" value={paidAt || ""} onChange={e => setPaidAt(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="進捗"><input value={progressStage} onChange={e => setProgressStage(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
        <Field label="担当者"><input value={assigneeUserId} onChange={e => setAssigneeUserId(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>
      </div>
      <Field label="金額（円）"><input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} disabled={!isAdmin} style={fieldStyle} /></Field>

      <GrantExpenseCostsPanel expenseCosts={expenseCosts} onChange={updateExpenseCost} />
      <GrantCalculationDraftPanel grant={grant} isAdmin={isAdmin} onReflectAmount={value => setAmount(value != null ? String(value) : "")} />

      <Field label="対象受講生">
        <div className="flex flex-wrap gap-1.5">{traineeNames.length ? traineeNames.map((n, i) => <Badge key={i} tone="cyan">{n}</Badge>) : <span className="text-xs" style={{ color: T.textMuted }}>未設定</span>}</div>
      </Field>
      <Field label="備考（企業担当者も編集可）">
        <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
      </Field>

      {/* 「どこからExcelエクスポートできるか分からない」への対応（2026-07-20）。既存の
          GrantExportPanel（POST /grants/{id}/exports）をgr_documents画面と共通利用する。 */}
      <GrantExportPanel grantId={grant.grantId} onGenerated={onDocumentsGenerated} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: T.border }}>
        <Btn kind="ghost" size="sm" icon={Upload} onClick={onOpenDocuments}>提出書類一覧を見る</Btn>
        <Btn icon={Check} onClick={submit} disabled={saving}>{saving ? "保存中…" : "保存する"}</Btn>
      </div>
    </div>
  );
}

function GrantDetailModal({ grant, role, companies, onClose, onSave, onOpenDocuments, saving, actionError, clearActionError, onRequestDelete }) {
  const isAdmin = role === "admin";
  const { courses } = useCompanyCourses(isAdmin ? grant.companyId : "", true);
  const { trainees } = useCompanyTrainees(isAdmin ? grant.companyId : "", true);
  const { profile: companyProfile } = useCompanyProfile(isAdmin ? grant.companyId : "", true);
  const { items: documents, loading: documentsLoading, reload: reloadDocuments } = useGrantDocuments(grant.grantId, true);
  const companyName = isAdmin ? (companies.find(c => c.companyId === grant.companyId)?.name || "（企業情報なし）") : (companyProfile?.name || "（企業情報なし）");
  const course = courses.find(c => c.courseId === grant.courseId) || null;
  const courseName = course?.name || grant.courseId;

  return (
    <Modal title={`助成金申請：${companyName}`} onClose={onClose} size="lg"
      footer={<div className="flex w-full items-center justify-between">
        {isAdmin ? <Btn kind="danger" size="sm" icon={Trash2} onClick={onRequestDelete}>削除</Btn> : <span />}
        <Btn kind="ghost" onClick={onClose}>閉じる</Btn>
      </div>}>
      <GrantDetail key={`${grant.grantId}-${grant.updatedAt}`} grant={grant} role={role} companyName={companyName} courseName={courseName}
        course={course} companyProfile={companyProfile} documents={documents} documentsLoading={documentsLoading} onDocumentsGenerated={reloadDocuments}
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
  // 一覧から直接Excel帳票を生成する導線（2026-07-20 UX改善）。詳細を開かずに素早く生成できる。
  const [exportGrant, setExportGrant] = useState(null);

  const companyName = id => companies.find(c => c.companyId === id)?.name || "（企業情報なし）";

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
              <div className="flex shrink-0 flex-wrap gap-2">
                <Btn kind="ghost" size="sm" icon={FileText} onClick={() => setExportGrant(g)}>Excel帳票を生成</Btn>
                <Btn kind="ghost" size="sm" icon={Eye} onClick={() => setDetailGrant(g)}>詳細を見る</Btn>
              </div>
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
      {exportGrant && (
        <Modal title={`Excel帳票を生成：${companyName(exportGrant.companyId)} / ${exportGrant.grantType || "種類未設定"}`}
          onClose={() => setExportGrant(null)}
          footer={<Btn kind="ghost" onClick={() => setExportGrant(null)}>閉じる</Btn>}>
          <div className="space-y-3">
            <GrantExportPanel grantId={exportGrant.grantId} onGenerated={reload} />
            <Btn kind="ghost" size="sm" icon={Upload} onClick={() => { onOpenDocuments(exportGrant.grantId); setExportGrant(null); }}>
              生成した書類を提出書類一覧で見る
            </Btn>
          </div>
        </Modal>
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

// 助成金帳票のアプリ内Excel生成（POST /grants/{id}/exports）。生成物は提出書類一覧に自動生成書類
// として追加されるため、ここでは生成トリガーと直近結果（missingFields等）のみ表示する。
// gr_documents（提出書類画面）に加え、gr_list（申請一覧の行・申請詳細）からも共通利用する
// （2026-07-20 UX改善「どこからExcelエクスポートできるか分からない」への対応、二重実装しない）。
function GrantExportPanel({ grantId, onGenerated }) {
  const { generate, generating, error, clearError, lastResult } = useGrantExports(grantId);
  const [formType, setFormType] = useState(FORM_TYPE_OPTIONS[0].value);

  async function handleGenerate() {
    clearError();
    try {
      await generate(formType);
      onGenerated && onGenerated();
    } catch (e) { /* エラーはuseGrantExports側のerrorに表示済み */ }
  }

  return (
    <Card className="p-4">
      <div className="mb-1 text-sm font-bold" style={{ color: T.textPrimary }}>Excel帳票を生成</div>
      <div className="mb-3 text-xs" style={{ color: T.textMuted }}>
        実テンプレートにLMSデータを差し込んで生成します。率・単価・署名・賃金台帳等はLMSに保持していないため空欄のままです。生成後はExcel上で確認・補完してください。
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1">
          <Field label="帳票種別">
            <select value={formType} onChange={e => setFormType(e.target.value)} style={fieldStyle} disabled={generating}>
              {FORM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <Btn size="sm" icon={FileText} onClick={handleGenerate} disabled={generating}>{generating ? "生成中…" : "生成する"}</Btn>
      </div>
      {error && <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{error}</div>}
      {lastResult && (
        <div className="mt-3 space-y-2">
          {lastResult.files.length === 0
            ? <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.warningSubtle, color: T.warning }}>
                生成できるファイルがありませんでした。{lastResult.missingFields?.[0]?.label || "対象データを確認してください。"}
              </div>
            : <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.successSubtle, color: T.success }}>
                {lastResult.files.length}件生成しました。下の「提出書類」一覧からダウンロードできます。
              </div>}
          {lastResult.missingFields?.length > 0 && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.warningSubtle, color: T.warning }}>
              未入力項目が{lastResult.missingFields.length}件あります（空欄のまま生成済み。Excel上で手動補完してください）:
              {" "}{lastResult.missingFields.slice(0, 8).map(f => f.label).join("、")}{lastResult.missingFields.length > 8 ? " 他" : ""}
            </div>
          )}
        </div>
      )}
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

  const companyName = id => companies.find(c => c.companyId === id)?.name || "（企業情報なし）";

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
          <GrantExportPanel grantId={grantId} onGenerated={reload} />
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
                      {d.source === "generated" && <Badge tone="cyan">自動生成</Badge>}
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
                    {isAdmin && d.status === "submitted" && d.source !== "generated" && <Btn kind="ghost" size="sm" icon={Check} onClick={() => { setReviewTarget(d); setReviewNote(""); }}>審査</Btn>}
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

  const companyName = id => companies.find(c => c.companyId === id)?.name || "（企業情報なし）";
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

// ================= 助成金マスタ（年度別・助成率/単価/上限額。admin専用） =================
function emptyRateCategoryForm() {
  return {
    wageSubsidyHourlyRate: "", expenseSubsidyRateRegular: "", expenseSubsidyRateFixedTerm: "",
    expenseSubsidyCapPerPerson: "", sourceNote: "",
  };
}

function RateCategoryCard({ title, category, onSave, saving }) {
  const [form, setForm] = useState(emptyRateCategoryForm());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({
      wageSubsidyHourlyRate: category?.wageSubsidyHourlyRate ?? "",
      expenseSubsidyRateRegular: category?.expenseSubsidyRateRegular ?? "",
      expenseSubsidyRateFixedTerm: category?.expenseSubsidyRateFixedTerm ?? "",
      expenseSubsidyCapPerPerson: category?.expenseSubsidyCapPerPerson ?? "",
      sourceNote: category?.sourceNote || "",
    });
  }, [category]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit() {
    const payload = {};
    ["wageSubsidyHourlyRate", "expenseSubsidyRateRegular", "expenseSubsidyRateFixedTerm", "expenseSubsidyCapPerPerson"].forEach(k => {
      payload[k] = form[k] === "" ? null : Number(form[k]);
    });
    payload.sourceNote = form.sourceNote;
    try {
      await onSave(payload);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) { /* actionErrorは親側で表示済み */ }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-bold" style={{ color: T.textPrimary }}>{title}</div>
        {category?.updatedAt && (
          <span className="text-[11px]" style={{ color: T.textMuted }}>
            更新: {String(category.updatedAt).slice(0, 10)}{category.updatedByRole ? `（${category.updatedByRole === "admin" ? "管理者" : category.updatedByRole}）` : ""}
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="賃金助成単価（円/時）">
          <input type="number" min="0" value={form.wageSubsidyHourlyRate} onChange={e => set("wageSubsidyHourlyRate", e.target.value)} style={fieldStyle} placeholder="例: 800" />
        </Field>
        <Field label="経費助成率・正規雇用労働者等（%）">
          <input type="number" min="0" max="100" value={form.expenseSubsidyRateRegular} onChange={e => set("expenseSubsidyRateRegular", e.target.value)} style={fieldStyle} placeholder="例: 45" />
        </Field>
        <Field label="経費助成率・有期契約労働者等（%）">
          <input type="number" min="0" max="100" value={form.expenseSubsidyRateFixedTerm} onChange={e => set("expenseSubsidyRateFixedTerm", e.target.value)} style={fieldStyle} placeholder="例: 70" />
        </Field>
        <Field label="経費助成上限額（円/人）">
          <input type="number" min="0" step="10000" value={form.expenseSubsidyCapPerPerson} onChange={e => set("expenseSubsidyCapPerPerson", e.target.value)} style={fieldStyle} placeholder="例: 150000" />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="根拠（支給要領の版・確認日等、任意）">
          <input value={form.sourceNote} onChange={e => set("sourceNote", e.target.value)} style={fieldStyle} placeholder="例: 令和7年度4月版 支給要領で確認（2026-07-20）" />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {saved && <span className="text-xs font-semibold" style={{ color: T.success }}>保存しました</span>}
        <Btn size="sm" icon={Check} onClick={submit} disabled={saving}>{saving ? "保存中…" : "保存する"}</Btn>
      </div>
    </Card>
  );
}

export function GrantRateMaster({ role }) {
  if (role !== "admin") return null;
  const thisFiscalYear = (() => {
    const now = new Date();
    return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  })();
  const { items: years, loading: yearsLoading, error: yearsError, reload: reloadYears } = useRateMasterYears(true);
  const [fiscalYear, setFiscalYear] = useState(thisFiscalYear);
  const { master, loading, error, actionError, clearActionError, reload, saveCategory } = useRateMaster(fiscalYear, true);
  const [savingKey, setSavingKey] = useState("");

  async function handleSave(applicationType, companySize, payload) {
    setSavingKey(`${applicationType}:${companySize}`);
    try {
      await saveCategory(applicationType, companySize, payload);
      await reloadYears();
    } finally {
      setSavingKey("");
    }
  }

  return (
    <div>
      <SectionHead title="助成金マスタ" desc="Excel帳票の差し込みに使う、年度・区分ごとの助成率・単価・上限額を管理します。値は未確定のままでも構いません（最新の支給要領を確認のうえ入力してください）。未入力の区分は帳票生成時にテンプレの参考値のまま出力されます。" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold" style={{ color: T.textMuted }}>対象年度</span>
        <input type="number" value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value) || thisFiscalYear)}
          style={{ ...fieldStyle, width: "auto", minWidth: 120 }} />
        {!yearsLoading && years.length > 0 && (
          <select value="" onChange={e => { if (e.target.value) setFiscalYear(Number(e.target.value)); }} style={{ ...fieldStyle, width: "auto" }}>
            <option value="">登録済み年度から選ぶ…</option>
            {years.map(y => <option key={y.fiscalYear} value={y.fiscalYear}>{y.fiscalYear}年度</option>)}
          </select>
        )}
      </div>
      {yearsError && <PrismErrorRetryCard message={yearsError} onRetry={reloadYears} />}
      <ErrorBanner message={actionError} onClose={clearActionError} />
      {error ? (
        <PrismErrorRetryCard message={error} onRetry={reload} />
      ) : loading || !master ? (
        <Card className="p-5"><SkeletonRows rows={6} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {RATE_MASTER_APPLICATION_TYPE_OPTIONS.flatMap(at => RATE_MASTER_COMPANY_SIZE_OPTIONS.map(size => {
            const key = `${at.value}:${size.value}`;
            return (
              <RateCategoryCard
                key={key}
                title={`${at.label} / ${size.label}`}
                category={master.categories?.[at.value]?.[size.value]}
                saving={savingKey === key}
                onSave={payload => handleSave(at.value, size.value, payload)}
              />
            );
          }))}
        </div>
      )}
    </div>
  );
}
