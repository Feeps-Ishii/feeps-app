import React, { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../../api.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, Hero, Kpi } from "../parts/ui.jsx";
import { arr, errText } from "../staff/common.js";
import { stateOf } from "./Home.jsx";

/* 管理者の分析（モック anaX）：研修中のコースの数字を集めて全体の数字とコースごとの棒に。AI の費用は /admin/ai-usage。
   「数字に聞く」は集めた数字だけを渡して答えさせる */

const yen = v => `¥${Math.round(Number(v) || 0).toLocaleString()}`;
const USD_JPY = 150; // 目安の換算

export default function AdminAna() {
  const today = todayStr();
  const month = today.slice(0, 7);
  const [st, setSt] = useState({ state: "loading", rows: [] });
  const [ai, setAi] = useState(undefined);
  const [key, setKey] = useState(0);
  const [q, setQ] = useState(""); const [ans, setAns] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    setSt({ state: "loading", rows: [] });
    apiGet("/admin/course-overview").then(async r => {
      const cs = arr(r?.courses).filter(c => stateOf(c, today) === "研修中");
      const rows = await Promise.all(cs.map(c => apiGet(`/completion-report/stats?courseId=${encodeURIComponent(c.courseId)}`).then(d => ({ c, o: d.overall || {} })).catch(() => ({ c, o: null }))));
      if (alive) setSt({ state: "ready", rows });
    }).catch(() => { if (alive) setSt({ state: "error", rows: [] }); });
    apiGet(`/admin/ai-usage?month=${month}`).then(d => { if (alive) setAi(d || null); }).catch(() => { if (alive) setAi(null); });
    return () => { alive = false; };
  }, [key, today, month]);
  if (st.state === "error") return <Card><div className="empty"><b>分析の数字を確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card>;
  if (st.state === "loading") return <div className="soon card">読み込み中</div>;
  const known = st.rows.filter(r => r.o);
  const weighted = k => { const n = known.reduce((a, r) => a + (r.o[k] != null ? r.o.traineeCount || 0 : 0), 0); return n ? Math.round(known.reduce((a, r) => a + (r.o[k] || 0) * (r.o.traineeCount || 0), 0) / n) : null; };
  const people = known.reduce((a, r) => a + (r.o.traineeCount || 0), 0);
  const att = weighted("attendanceRate"), rep = weighted("reportRate");
  const usd = ai?.totalEstimatedCostUsd ?? ai?.estimatedCostUsd ?? ai?.totals?.estimatedCostUsd ?? ai?.summary?.estimatedCostUsd;
  const cost = usd != null ? usd * USD_JPY : null;
  const features = arr(ai?.byFeature);
  const maxF = Math.max(0.0001, ...features.map(x => Number(x.estimatedCostUsd) || 0));
  const ask = async () => {
    if (!q.trim() || busy) return;
    setBusy(true); setErr(""); setAns("");
    try { const r = await apiPost("/ai/staff-draft", { kind: "numbers", text: q.trim(), context: { month, attendanceRate: att, reportRate: rep, people, courses: known.map(r2 => ({ name: r2.c.name, ...r2.o })) } }); setAns(r.text); }
    catch (e) { setErr(errText(e, "答えを作れませんでした")); } finally { setBusy(false); }
  };
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{Number(month.slice(5))}月</div><h1 className="h1">分析</h1></div></div>
      <Hero cat="cur" className="an-hero" eyebrow="研修中の全コース" title={`受講生 ${people} 人`}>
        <Kpi items={[
          { label: "出席率", value: att ?? "—", unit: att != null ? "%" : "", pct: att ?? undefined },
          { label: "日報の提出", value: rep ?? "—", unit: rep != null ? "%" : "", pct: rep ?? undefined },
          { label: "AI の費用", value: cost != null ? yen(cost) : "—" },
          { label: "研修中のコース", value: st.rows.length, unit: "" },
        ]} />
      </Hero>
      <Card className="pad st-g">
        <div className="head"><h2 className="h2">数字に聞く</h2></div>
        <div className="an-ai"><input type="text" value={q} placeholder="例：出席率が下がっているコースは？" aria-label="質問" onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) ask(); }} /><Btn kind="sm" disabled={busy || !q.trim()} onClick={ask}>{busy ? "集めています" : "聞く"}</Btn></div>
        {ans && <div className="dr-m c-cur"><p className="st-pre">{ans}</p></div>}
        {err && <div className="lms-err" role="alert">{err}</div>}
      </Card>
      <div className="g2e">
        <Card className="pad st-g">
          <h2 className="h2">コースごとの出席率</h2>
          <div className="bars">{st.rows.map(r => <div key={r.c.courseId} className={r.o?.attendanceRate != null && r.o.attendanceRate < 90 ? "low" : ""}><span>{r.c.name}</span><s style={{ "--w": `${r.o?.attendanceRate ?? 0}%` }} /><span className="num">{r.o?.attendanceRate != null ? `${r.o.attendanceRate}%` : "—"}</span></div>)}{!st.rows.length && <Chip>なし</Chip>}</div>
        </Card>
        <Card className="pad st-g">
          <div className="head"><h2 className="h2">AI の使いみち ・ {Number(month.slice(5))}月</h2></div>
          {ai === null && <Chip>確認できません</Chip>}
          <div className="bars cost">{features.slice(0, 8).map(x => { const v = Number(x.estimatedCostUsd) || 0; return <div key={x.feature}><span>{x.feature}</span><s style={{ "--w": `${Math.round(v / maxF * 100)}%` }} /><span className="num">{yen(v * USD_JPY)}</span></div>; })}{ai && !features.length && <Chip>なし</Chip>}</div>
        </Card>
      </div>
    </div>
  );
}
