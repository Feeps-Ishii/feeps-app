import React, { useEffect, useState } from "react";
import { Receipt, RefreshCw } from "lucide-react";
import { Card, Btn, Badge, PrismErrorRetryCard, SkeletonRows } from "../../../components/common";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { useCompanyDirectory } from "./useCompanyDirectory.js";

// プラン・契約管理（ADR0013-0016、2026-08-13 Phase1-D新設）。学習モード固有の管理機能
// （ADR0013「学習: 管理（プラン・契約・AI利用量）」）のためlearning product配下に置く。
// 課金・価格は扱わない（ADR0014のスコープ外）。AI利用量はPhase1-Dのスコープ外（ADR0015、別Phase）。
const CONTRACT_MODE_LABEL = { training: "研修のみ", learning: "学習のみ", both: "両方契約" };
const PLAN_LABEL = { basic: "Basic", standard: "Standard", premium: "Premium" };

function PlanRow({ company, plan, onSaved }) {
  const [contractMode, setContractMode] = useState(plan?.contractMode || "both");
  const [learningPlan, setLearningPlan] = useState(plan?.learningPlan || "premium");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = contractMode !== (plan?.contractMode || "both") || learningPlan !== (plan?.learningPlan || "premium");

  async function save() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const body = { companyId: company.companyId, contractMode, learningPlan: contractMode === "training" ? null : learningPlan };
      const saved = await apiPut("/plans/company", body);
      onSaved(company.companyId, saved);
      setMessage("保存しました。");
    } catch (e) {
      setMessage(e?.errorMessage || e?.message || "保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 text-sm font-bold" style={{ color: "#1A1C1F" }}>{company.name || company.companyId}</span>
        <Badge tone="muted">{CONTRACT_MODE_LABEL[plan?.contractMode || "both"]}</Badge>
        {(plan?.contractMode || "both") !== "training" && <Badge tone="cyan">{PLAN_LABEL[plan?.learningPlan || "premium"]}</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <div className="mb-1 text-xs font-semibold" style={{ color: "#687286" }}>契約モード</div>
          <select value={contractMode} onChange={e => setContractMode(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "#E0E5EE" }}>
            <option value="both">両方契約</option>
            <option value="training">研修のみ</option>
            <option value="learning">学習のみ</option>
          </select>
        </label>
        {contractMode !== "training" && (
          <label className="block">
            <div className="mb-1 text-xs font-semibold" style={{ color: "#687286" }}>学習プラン</div>
            <select value={learningPlan} onChange={e => setLearningPlan(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "#E0E5EE" }}>
              <option value="basic">Basic</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
          </label>
        )}
        <Btn size="sm" onClick={save} disabled={busy || !dirty}>{busy ? "保存中…" : "保存"}</Btn>
        {message && <span className="text-xs font-semibold" style={{ color: message.includes("失敗") ? "#C4554D" : "#3D8A63" }}>{message}</span>}
      </div>
      {contractMode !== "training" && <SeatSettings company={company} plan={plan} onSaved={onSaved} />}
    </Card>
  );
}

// 席（スロット）課金の設定（2026-08-19新設、ADR 0019）。
// 席制は企業ごとのオプトイン。既存企業は「企業単位」のままなので挙動が変わらない。
function SeatSettings({ company, plan, onSaved }) {
  const seatMode = plan?.billingMode === "seat";
  const [billingMode, setBillingMode] = useState(plan?.billingMode || "company");
  const [standard, setStandard] = useState(plan?.seats?.standard?.total ?? 0);
  const [premium, setPremium] = useState(plan?.seats?.premium?.total ?? 0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const used = plan?.seats || {};

  async function save() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      await apiPut("/plans/company/seats", {
        companyId: company.companyId,
        billingMode,
        seats: { standard: Number(standard) || 0, premium: Number(premium) || 0 },
      });
      const refreshed = await apiGet(`/plans/company?companyId=${encodeURIComponent(company.companyId)}`);
      onSaved(company.companyId, refreshed);
      setMessage("保存しました。");
    } catch (e) {
      setMessage(e?.errorMessage || e?.message || "保存に失敗しました。");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-3 rounded-xl border p-3" style={{ borderColor: "#E0E5EE" }}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <div className="mb-1 text-xs font-semibold" style={{ color: "#687286" }}>課金方式</div>
          <select value={billingMode} onChange={e => setBillingMode(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "#E0E5EE" }}>
            <option value="company">企業単位（従来）</option>
            <option value="seat">席単位（スロット）</option>
          </select>
        </label>
        {billingMode === "seat" && (
          <>
            <label className="block">
              <div className="mb-1 text-xs font-semibold" style={{ color: "#687286" }}>Standard席数</div>
              <input type="number" min="0" value={standard} onChange={e => setStandard(e.target.value)}
                className="w-28 rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "#E0E5EE" }} />
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold" style={{ color: "#687286" }}>Premium席数</div>
              <input type="number" min="0" value={premium} onChange={e => setPremium(e.target.value)}
                className="w-28 rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "#E0E5EE" }} />
            </label>
          </>
        )}
        <Btn size="sm" kind="ghost" onClick={save} disabled={busy}>{busy ? "保存中…" : "席設定を保存"}</Btn>
        {message && <span className="text-xs font-semibold" style={{ color: message.includes("失敗") ? "#C4554D" : "#3D8A63" }}>{message}</span>}
      </div>
      {seatMode && (
        <p className="mt-2 text-xs" style={{ color: "#687286" }}>
          割り当て済み: Standard {used.standard?.used ?? 0}/{used.standard?.total ?? 0}席 ・
          Premium {used.premium?.used ?? 0}/{used.premium?.total ?? 0}席
          （使用中の席数を下回る設定はできません）
        </p>
      )}
    </div>
  );
}

// 企業担当者からの席追加申請。承認すると契約席数がその分増える。
function SeatRequestsPanel({ onApproved }) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  function load() {
    setState("loading");
    apiGet("/plans/seats/requests?status=pending")
      .then(res => { setItems(res?.items || []); setState("ready"); })
      .catch(() => setState("error"));
  }
  useEffect(load, []);

  async function decide(req, action) {
    setBusyId(req.requestId); setMessage("");
    try {
      await apiPost(`/plans/seats/requests/${encodeURIComponent(req.requestId)}/${action}`, { companyId: req.companyId });
      setMessage(action === "approve" ? "承認しました。席が追加されました。" : "却下しました。");
      load();
      if (action === "approve" && onApproved) onApproved(req.companyId);
    } catch (e) {
      setMessage(e?.errorMessage || e?.message || "処理に失敗しました。");
    } finally { setBusyId(""); }
  }

  if (state === "loading") return <Card className="p-4"><SkeletonRows rows={2} /></Card>;
  if (state === "error") return null;
  if (!items.length) return null;

  return (
    <Card className="p-4">
      <h4 className="mb-2 text-sm font-bold" style={{ color: "#1A1C1F" }}>席の追加申請（{items.length}件）</h4>
      {message && <p className="mb-2 text-xs font-semibold" style={{ color: message.includes("失敗") ? "#C4554D" : "#3D8A63" }}>{message}</p>}
      <div className="divide-y" style={{ borderColor: "#E0E5EE" }}>
        {items.map(r => (
          <div key={r.requestId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold" style={{ color: "#1A1C1F" }}>{r.companyId}</span>
                <Badge tone={r.plan === "premium" ? "violet" : "cyan"}>{PLAN_LABEL[r.plan]} {r.count}席</Badge>
              </div>
              <div className="mt-0.5 text-xs" style={{ color: "#687286" }}>
                {r.requestedByName}
                {r.requestedAt ? ` ・ ${new Date(r.requestedAt).toLocaleString("ja-JP")}` : ""}
                {r.note ? ` ・ ${r.note}` : ""}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Btn size="sm" disabled={busyId === r.requestId} onClick={() => decide(r, "approve")}>承認</Btn>
              <Btn size="sm" kind="ghost" disabled={busyId === r.requestId} onClick={() => decide(r, "reject")}>却下</Btn>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function PlansContractsAdmin() {
  const { companies, companiesError } = useCompanyDirectory();
  const [plans, setPlans] = useState({});
  const [state, setState] = useState("loading");

  function load() {
    if (companies.length === 0) return;
    setState("loading");
    Promise.all(companies.map(c =>
      apiGet(`/plans/company?companyId=${encodeURIComponent(c.companyId)}`)
        .then(p => [c.companyId, p])
        .catch(() => [c.companyId, null])
    )).then(entries => {
      setPlans(Object.fromEntries(entries));
      setState("ready");
    });
  }
  useEffect(load, [companies]);

  if (companiesError) return <div className="p-4"><PrismErrorRetryCard message={companiesError} onRetry={load} /></div>;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Receipt size={18} style={{ color: "#238B85" }} />
          <div>
            <h3 className="text-base font-bold" style={{ color: "#1A1C1F" }}>プラン・契約管理</h3>
            <p className="text-xs" style={{ color: "#687286" }}>企業ごとの契約モードと学習プランを設定します。価格・課金は扱いません。</p>
          </div>
        </div>
        <Btn size="sm" kind="ghost" icon={RefreshCw} onClick={load}>更新</Btn>
      </div>

      <SeatRequestsPanel onApproved={load} />

      {state === "loading" && <SkeletonRows rows={4} />}
      {state === "ready" && companies.length === 0 && (
        <p className="text-sm" style={{ color: "#687286" }}>登録されている企業がありません。</p>
      )}
      {state === "ready" && companies.map(c => (
        <PlanRow key={c.companyId} company={c} plan={plans[c.companyId]}
          onSaved={(companyId, saved) => setPlans(prev => ({ ...prev, [companyId]: saved }))} />
      ))}
    </div>
  );
}
