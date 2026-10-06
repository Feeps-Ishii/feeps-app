import React, { useCallback, useEffect, useState } from "react";
import { admin } from "../data.js";
import { Title, yen, usdToYen, PLAN_LABEL, fmtTime } from "./parts.jsx";

/* 企業と契約（モック tenolab-admin.html の companies・company。ADR 0025 §5）
   企業そのものは LMS の企業管理で作る。ここでは契約（Eラーニングの有効・無効、プラン、受講枠、金額・期間）と使用料を見る・直す。
   研修でLMSを使っている企業は青い点線の枠「研修LMS」で見分ける */
const FILTERS = [["all", "すべて"], ["lms", "研修でLMS利用"], ["el", "Eラーニング契約"], ["off", "Eラーニングなし"], ["inq", "お見積り依頼"]];

export function useOverview() {
  const [st, setSt] = useState({ state: "loading" });
  const load = useCallback(() => {
    setSt(s => ({ ...s, state: "loading" }));
    admin.overview().then(d => setSt({ state: "ready", data: d })).catch(() => setSt({ state: "error" }));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ...st, reload: load };
}

export const LmsTag = () => <span className="chip lms">研修LMS</span>;
export function PlanChip({ c }) {
  if (!c.elearning) return <span className="muted">—</span>;
  return <span className={`chip ${c.learningPlan === "premium" ? "prem" : ""}`}>{PLAN_LABEL[c.learningPlan] || c.learningPlan}</span>;
}
export function seatText(c) {
  if (!c.elearning) return "—";
  if (c.billingMode !== "seat") return `${c.trainees}人`;
  const used = c.seats.standard.used + c.seats.premium.used, total = c.seats.standard.total + c.seats.premium.total;
  return `${used} / ${total}`;
}

export function CompanyTable({ list, rate, go, compact }) {
  return (
    <div className="tblwrap"><table className="mtbl" style={{ minWidth: compact ? 520 : 760 }}>
      <thead><tr><th>企業</th>{!compact && <th>Eラーニング</th>}<th>プラン</th><th className="rt">受講</th><th className="rt">契約金額/月</th><th className="rt">AI</th><th className="rt">AWS</th>{!compact && <th>期間</th>}</tr></thead>
      <tbody>
        {list.map(c => (
          <tr key={c.companyId} className={`${c.elearning ? "" : "off"} ${c.lms ? "lmsrow" : ""}`} onClick={() => go(`#/manage/companies/${encodeURIComponent(c.companyId)}`)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") go(`#/manage/companies/${encodeURIComponent(c.companyId)}`); }}>
            <td style={{ whiteSpace: "nowrap" }}><b>{c.name}</b> {c.lms && <LmsTag />}</td>
            {!compact && <td>{c.elearning ? <span className="chip done">有効</span> : <span className="chip">なし</span>}</td>}
            <td><PlanChip c={c} /></td>
            <td className="rt num">{seatText(c)}</td>
            <td className="rt num">{c.elearning && c.contract.feeMonthly ? yen(c.contract.feeMonthly) : "—"}</td>
            <td className="rt num">{c.elearning ? yen(usdToYen(c.usage.aiUsd, rate)) : "—"}</td>
            <td className="rt num">{c.elearning && c.learningPlan === "premium" ? yen(usdToYen(c.usage.awsUsd, rate)) : "—"}</td>
            {!compact && <td className="num" style={{ whiteSpace: "nowrap" }}>{c.elearning && (c.contract.startMonth || c.contract.endMonth) ? `${c.contract.startMonth || "?"}〜${c.contract.endMonth || ""}` : "—"}</td>}
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

export default function Companies({ go, companyId }) {
  const ov = useOverview();
  const [filter, setFilter] = useState("all");
  if (ov.state === "loading" && !ov.data) return <><Title eyebrow="COMPANIES" title="企業と契約" /><p className="muted">読み込んでいます…</p></>;
  if (ov.state === "error") return <><Title eyebrow="COMPANIES" title="企業と契約" /><div className="card flat" style={{ padding: 16 }} role="alert">読み込めませんでした。 <button type="button" className="btn ghost" onClick={ov.reload}>もう一度</button></div></>;
  const d = ov.data;
  if (companyId) {
    const c = d.companies.find(x => x.companyId === companyId);
    if (!c) return <><button type="button" className="back" onClick={() => go("#/manage/companies")}>← 企業と契約</button><p className="muted">この企業は見つかりませんでした。</p></>;
    return <Company key={`${c.companyId}/${c.contractMode}/${JSON.stringify(c.contract)}`} c={c} d={d} go={go} onSaved={ov.reload} />;
  }
  const list = { all: d.companies, lms: d.companies.filter(c => c.lms), el: d.companies.filter(c => c.elearning), off: d.companies.filter(c => !c.elearning) }[filter] || [];
  return (
    <>
      <Title eyebrow="COMPANIES" title="企業と契約" />
      <div className="tabs-h" role="tablist" style={{ marginBottom: 14 }}>
        {FILTERS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      {filter === "inq" ? <Inquiries /> : (
        <section className="card flat" style={{ padding: "4px 8px" }}>
          {list.length ? <CompanyTable list={list} rate={d.rate} go={go} /> : <p className="muted" style={{ padding: 12 }}>ありません。</p>}
        </section>
      )}
    </>
  );
}

function Company({ c, d, go, onSaved }) {
  const [f, setF] = useState(() => ({
    elearning: c.elearning,
    learningPlan: c.learningPlan || "standard",
    billingMode: c.billingMode,
    seats: { standard: c.seats.standard.total, premium: c.seats.premium.total },
    contract: { ...c.contract },
  }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const setC = (k, v) => setF(x => ({ ...x, contract: { ...x.contract, [k]: v } }));
  const off = !f.elearning;
  const aiYen = usdToYen(c.usage.aiUsd, d.rate), awsYen = usdToYen(c.usage.awsUsd, d.rate);
  const learningOnly = c.contractMode === "learning";

  async function save() {
    setBusy(true); setMsg({ kind: "", text: "" });
    try {
      await admin.saveCompany(c.companyId, {
        elearning: f.elearning, learningPlan: f.learningPlan, billingMode: f.billingMode,
        seats: f.billingMode === "seat" ? { standard: Number(f.seats.standard) || 0, premium: Number(f.seats.premium) || 0 } : undefined,
        contract: { feeMonthly: Number(f.contract.feeMonthly) || 0, startMonth: f.contract.startMonth, endMonth: f.contract.endMonth, awsCapMonthly: Number(f.contract.awsCapMonthly) || 0 },
      });
      setMsg({ kind: "ok", text: "保存しました。" });
      onSaved();
    } catch (e) {
      setMsg({ kind: "ng", text: e?.errorMessage || "保存できませんでした。" });
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="mttl">
        <div>
          <button type="button" className="back" onClick={() => go("#/manage/companies")}>← 企業と契約</button>
          <h1 className="h1" style={{ marginTop: 6 }}>{c.name} {c.lms && <LmsTag />}</h1>
        </div>
        <div className="r"><button type="button" className="btn" onClick={save} disabled={busy}>{busy ? "保存しています…" : "保存"}</button></div>
      </div>
      {msg.text && <div className={`verdict ${msg.kind}`} role={msg.kind === "ng" ? "alert" : "status"} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div className="mtwo" style={{ marginTop: 0 }}>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section className="card msec">
            <div className={`elbox ${f.elearning ? "on" : ""}`}>
              <label className="sw"><input type="checkbox" id={`el-${c.companyId}`} checked={f.elearning} disabled={learningOnly} onChange={e => set("elearning", e.target.checked)} /> Eラーニング</label>
              <span className="muted" style={{ fontSize: 13 }}>{learningOnly ? "Eラーニングだけの契約" : f.elearning ? "有効" : "研修のLMSだけ"}</span>
            </div>
            <div className="mgrid">
              <label className="mfield"><span>プラン</span>
                <select id={`plan-${c.companyId}`} value={f.learningPlan} disabled={off} onChange={e => set("learningPlan", e.target.value)}>{Object.entries(PLAN_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="mfield"><span>受講枠</span>
                <select id={`bm-${c.companyId}`} value={f.billingMode} disabled={off} onChange={e => set("billingMode", e.target.value)}><option value="company">枠なし（企業の全員）</option><option value="seat">人数で決める</option></select></label>
              {f.billingMode === "seat" && <>
                <label className="mfield"><span>スタンダードの枠（使用 {c.seats.standard.used}）</span><input id={`ss-${c.companyId}`} type="number" min={c.seats.standard.used} value={f.seats.standard} disabled={off} onChange={e => set("seats", { ...f.seats, standard: e.target.value })} /></label>
                <label className="mfield"><span>Premiumの枠（使用 {c.seats.premium.used}）</span><input id={`sp-${c.companyId}`} type="number" min={c.seats.premium.used} value={f.seats.premium} disabled={off} onChange={e => set("seats", { ...f.seats, premium: e.target.value })} /></label>
              </>}
              <label className="mfield"><span>開始</span><input id={`from-${c.companyId}`} type="month" value={f.contract.startMonth} disabled={off} onChange={e => setC("startMonth", e.target.value)} /></label>
              <label className="mfield"><span>終了</span><input id={`to-${c.companyId}`} type="month" value={f.contract.endMonth} disabled={off} onChange={e => setC("endMonth", e.target.value)} /></label>
              <label className="mfield"><span>月の契約金額（円）</span><input id={`fee-${c.companyId}`} type="number" min="0" step="1000" value={f.contract.feeMonthly} disabled={off} onChange={e => setC("feeMonthly", e.target.value)} /></label>
              <label className="mfield"><span>AWSの使用料の上限/月（円）</span><input id={`cap-${c.companyId}`} type="number" min="0" step="1000" value={f.contract.awsCapMonthly} disabled={off || f.learningPlan !== "premium"} onChange={e => setC("awsCapMonthly", e.target.value)} /></label>
            </div>
          </section>
          <section className="card msec">
            <h2>企業担当者</h2>
            {c.clients.length ? <ul className="todo">{c.clients.map((n, i) => <li key={i}><span>{n}</span></li>)}</ul> : <p className="muted" style={{ margin: 0 }}>いません。</p>}
          </section>
        </div>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section className="card msec">
            <h2>今月の使用料</h2>
            {c.elearning ? <>
              <div className="rows">
                <div><span>AI（採点・講評・質問）</span><span className="num">{yen(aiYen)}</span></div>
                <div><span>AWSの演習の環境{c.usage.awsMinutes ? `（${Math.round(c.usage.awsMinutes / 6) / 10}時間）` : ""}</span><span className="num">{c.learningPlan === "premium" ? yen(awsYen) : "—"}</span></div>
                <div className="total"><span>合計</span><span className="num">{yen(aiYen + awsYen)}</span></div>
              </div>
              {c.contract.awsCapMonthly > 0 && c.learningPlan === "premium" && (
                <div><span className="muted" style={{ fontSize: 12 }}>AWS {yen(awsYen)} / 上限 {yen(c.contract.awsCapMonthly)}</span><span className="meter"><i style={{ width: `${Math.min(100, awsYen / c.contract.awsCapMonthly * 100)}%`, background: "var(--aws, #F29A38)" }} /></span></div>
              )}
              <span className="muted" style={{ fontSize: 12 }}>概算 ・ 1ドル{d.rate}円 ・ AWSは{d.awsCost?.through || "—"}まで</span>
            </> : <p className="muted" style={{ margin: 0 }}>Eラーニングなし</p>}
          </section>
          <section className="card msec">
            <h2>受講</h2>
            <div className="rows">
              <div><span>受講生</span><span className="num">{c.trainees}人</span></div>
              {c.billingMode === "seat" && <>
                <div><span>スタンダードの枠</span><span className="num">{c.seats.standard.used} / {c.seats.standard.total}</span></div>
                <div><span>Premiumの枠</span><span className="num">{c.seats.premium.used} / {c.seats.premium.total}</span></div>
              </>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Inquiries() {
  const [st, setSt] = useState({ state: "loading", items: [] });
  const load = useCallback(() => {
    setSt(s => ({ ...s, state: "loading" }));
    admin.inquiries().then(r => setSt({ state: "ready", items: r.items || [] })).catch(() => setSt({ state: "error", items: [] }));
  }, []);
  useEffect(() => { load(); }, [load]);
  if (st.state === "loading") return <p className="muted">読み込んでいます…</p>;
  if (st.state === "error") return <div className="card flat" style={{ padding: 16 }} role="alert">読み込めませんでした。 <button type="button" className="btn ghost" onClick={load}>もう一度</button></div>;
  if (!st.items.length) return <p className="muted">お見積り依頼はまだありません。</p>;
  return (
    <section className="card flat" style={{ padding: "4px 8px" }}>
      <div className="tblwrap"><table className="mtbl" style={{ minWidth: 680 }}>
        <thead><tr><th>受け付け</th><th>会社</th><th>お名前</th><th>受講予定</th><th>プラン</th><th>単元</th></tr></thead>
        <tbody>
          {st.items.map(x => (
            <tr key={x.itemKey} style={{ cursor: "default" }}>
              <td className="num muted" style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtTime(x.createdAt)}</td>
              <td><b>{x.company}</b>{x.dept && <div className="muted" style={{ fontSize: 12 }}>{x.dept}</div>}</td>
              <td>{x.name}<div className="muted" style={{ fontSize: 12 }}>{x.email}{x.phone ? ` ・ ${x.phone}` : ""}</div></td>
              <td>{x.people}{x.period && <div className="muted" style={{ fontSize: 12 }}>{x.period}</div>}</td>
              <td>{x.plan}</td>
              <td style={{ fontSize: 12 }}>{(x.topics || []).join("、")}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </section>
  );
}
