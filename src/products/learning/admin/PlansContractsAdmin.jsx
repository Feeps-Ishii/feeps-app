import React, { useEffect, useState } from "react";
import { Receipt, RefreshCw } from "lucide-react";
import { Card, Btn, Badge, PrismErrorRetryCard, SkeletonRows } from "../../../components/common";
import { apiGet, apiPut } from "../../../api.js";
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
