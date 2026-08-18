// 学習プランの席（スロット）管理（2026-08-19新設。ADR 0019）。
// 企業担当者が自社社員へStandard/Premiumの席を割り当てる。席なしの社員はBasic。
//
// 業務ルールで一番効くのは「席は割り当てたら消費。ただし本人が未アクセスなら解除で戻る」。
// 戻る／戻らないは操作前に必ず画面で明示する（解除してから気づく事故を防ぐ）。
import React, { useCallback, useEffect, useState } from "react";
import { Plus, Users, X } from "lucide-react";
import {
  Badge, Btn, Card, EmptyState, Field, SectionHead, SkeletonRows, fieldStyle, T,
} from "../../../components/common";
import { apiGet, apiPost } from "../../../api.js";

const PLAN_LABEL = { standard: "Standard", premium: "Premium" };
const PLAN_TONE = { standard: "cyan", premium: "violet" };

function apiErrorMessage(e, fallback) {
  if (e?.status === 403) return "この操作を行う権限がありません。";
  return e?.errorMessage || e?.message || fallback;
}

function SeatCountCard({ plan, counts, onRequest }) {
  const c = counts[plan] || { total: 0, used: 0, available: 0 };
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{PLAN_LABEL[plan]}</span>
            <Badge tone={PLAN_TONE[plan]}>{c.available}席 空き</Badge>
          </div>
          <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
            契約{c.total}席のうち{c.used}席を割り当て済み
          </p>
        </div>
        <Btn kind="ghost" size="sm" icon={Plus} onClick={() => onRequest(plan)}>席を追加申請</Btn>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: T.surfaceMuted || T.border }}>
        <div className="h-full rounded-full" style={{
          width: c.total > 0 ? `${Math.min(100, (c.used / c.total) * 100)}%` : "0%",
          background: plan === "premium" ? T.accent : T.info || T.accent,
        }} />
      </div>
    </Card>
  );
}

function RequestForm({ plan, onSubmit, onCancel, busy }) {
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold" style={{ color: T.textPrimary }}>{PLAN_LABEL[plan]}の席を追加申請</h4>
        <Btn kind="ghost" size="sm" icon={X} onClick={onCancel}>閉じる</Btn>
      </div>
      <div className="space-y-3">
        <Field label="追加したい席数">
          <input type="number" min="1" max="500" style={fieldStyle} value={count}
            onChange={e => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} />
        </Field>
        <Field label="備考（任意）">
          <textarea style={{ ...fieldStyle, minHeight: 72 }} value={note} onChange={e => setNote(e.target.value)}
            placeholder="例: 4月入社の新卒10名分" />
        </Field>
      </div>
      <p className="mt-2 text-xs" style={{ color: T.textMuted }}>
        申請すると管理者が内容を確認して承認します。承認された時点で席が増えます。
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Btn kind="ghost" onClick={onCancel}>キャンセル</Btn>
        <Btn disabled={busy} onClick={() => onSubmit({ plan, count, note: note.trim() })}>申請する</Btn>
      </div>
    </Card>
  );
}

export default function SeatManager() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestPlan, setRequestPlan] = useState("");

  const load = useCallback(() => {
    setLoading(true); setError("");
    return apiGet("/plans/seats")
      .then(res => setData(res || null))
      .catch(e => setError(apiErrorMessage(e, "席の状況を確認できません。")))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function assign(userId, plan) {
    setBusy(true); setActionError(""); setNotice("");
    try {
      await apiPost("/plans/seats/assign", { userId, plan });
      setNotice(`${PLAN_LABEL[plan]}の席を割り当てました。`);
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e, "席の割り当てに失敗しました。"));
    } finally { setBusy(false); }
  }

  async function revoke(member) {
    const refundable = member.seat?.revocableWithRefund;
    const msg = refundable
      ? `${member.name} さんの席を解除します。まだ利用開始していないため、席は戻ります。`
      : `${member.name} さんの席を解除します。\n\n既に利用開始しているため、この席は消費済みのままとなり戻りません。よろしいですか？`;
    if (!window.confirm(msg)) return;
    setBusy(true); setActionError(""); setNotice("");
    try {
      const res = await apiPost("/plans/seats/revoke", { userId: member.userId });
      setNotice(res?.message || "席を解除しました。");
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e, "席の解除に失敗しました。"));
    } finally { setBusy(false); }
  }

  async function submitRequest(payload) {
    setBusy(true); setActionError("");
    try {
      await apiPost("/plans/seats/requests", payload);
      setRequestPlan("");
      setNotice("席の追加を申請しました。管理者の承認をお待ちください。");
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e, "申請に失敗しました。"));
    } finally { setBusy(false); }
  }

  if (loading) return <Card><SkeletonRows rows={4} /></Card>;
  if (error) return <Card className="p-4"><p className="text-sm" style={{ color: T.danger }}>{error}</p></Card>;

  if (data?.billingMode !== "seat") {
    return (
      <div>
        <SectionHead icon={Users} title="プラン・席の管理" desc="社員ごとに学習プランの席を割り当てます。" />
        <Card className="p-5">
          <EmptyState icon={Users} title="席単位の契約ではありません"
            desc="現在の契約は企業単位のプランです。席単位での運用をご希望の場合は管理者へご相談ください。" />
        </Card>
      </div>
    );
  }

  const counts = data.seats || {};
  const members = data.members || [];
  const pending = (data.requests || []).filter(r => r.status === "pending");

  if (requestPlan) {
    return <RequestForm plan={requestPlan} onSubmit={submitRequest} onCancel={() => setRequestPlan("")} busy={busy} />;
  }

  return (
    <div>
      <SectionHead
        icon={Users}
        title="プラン・席の管理"
        desc="契約している席を自社の社員へ割り当てます。席を持たない社員はBasicになります。"
      />
      {actionError && <Card className="mb-4 p-4"><p className="text-sm" style={{ color: T.danger }}>{actionError}</p></Card>}
      {notice && <Card className="mb-4 p-4"><p className="text-sm" style={{ color: T.success }}>{notice}</p></Card>}

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <SeatCountCard plan="standard" counts={counts} onRequest={setRequestPlan} />
        <SeatCountCard plan="premium" counts={counts} onRequest={setRequestPlan} />
      </div>

      {pending.length > 0 && (
        <Card className="mb-4 p-4">
          <h4 className="mb-2 text-sm font-bold" style={{ color: T.textPrimary }}>承認待ちの申請</h4>
          <div className="space-y-1.5">
            {pending.map(r => (
              <div key={r.requestId} className="text-xs" style={{ color: T.textSecondary }}>
                ・{PLAN_LABEL[r.plan]} {r.count}席
                {r.note ? `（${r.note}）` : ""}
                {r.requestedAt ? ` ・ ${new Date(r.requestedAt).toLocaleDateString("ja-JP")}申請` : ""}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="受講生がいません" desc="先に受講生を登録してください。" />
        ) : (
          <div className="divide-y" style={{ borderColor: T.border }}>
            {members.map(m => (
              <div key={m.userId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{m.name}</span>
                    {m.seat
                      ? <Badge tone={PLAN_TONE[m.seat.plan]}>{PLAN_LABEL[m.seat.plan]}</Badge>
                      : <Badge tone="muted">Basic</Badge>}
                    {m.seat && !m.seat.usedAt && <Badge tone="amber">未利用</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: T.textMuted }}>
                    {m.email}
                    {m.seat?.usedAt && " ・ 利用開始済み（解除しても席は戻りません）"}
                    {m.seat && !m.seat.usedAt && " ・ まだ利用開始していません（解除すれば席が戻ります）"}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {m.seat ? (
                    <Btn kind="ghost" size="sm" disabled={busy} onClick={() => revoke(m)}>席を解除</Btn>
                  ) : (
                    <>
                      <Btn kind="ghost" size="sm" disabled={busy || counts.standard?.available <= 0}
                        onClick={() => assign(m.userId, "standard")}>Standardを割当</Btn>
                      <Btn kind="ghost" size="sm" disabled={busy || counts.premium?.available <= 0}
                        onClick={() => assign(m.userId, "premium")}>Premiumを割当</Btn>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
