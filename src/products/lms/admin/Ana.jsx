import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, Hero, Kpi, Modal } from "../parts/ui.jsx";
import { arr, errText } from "../staff/common.js";

/* 管理者の分析（モック anaX）：月ごとに、その月に研修があったコースの数字を集める。AI の費用は /admin/ai-usage、上限はコースの設定。
   「数字に聞く」は集めた数字だけを渡して答えさせる */

const yen = v => `¥${Math.round(Number(v) || 0).toLocaleString()}`;
const USD_JPY = 150; // 目安の換算
const ASK = ["出席率が下がっているコースは？", "テストの点が低い単元は？", "AI の費用が多い機能は？"];
const shift = (ym, n) => { const [y, m] = ym.split("-").map(Number), d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const inMonth = (c, ym) => c.startDate && c.startDate.slice(0, 7) <= ym && (!c.endDate || c.endDate.slice(0, 7) >= ym) && c.status !== "archived";
const stats = (c, ym) => apiGet(`/completion-report/stats?courseId=${encodeURIComponent(c.courseId)}&month=${ym}`).then(d => ({ c, o: d.overall || {}, tests: arr(d.tests) })).catch(() => ({ c, o: null, tests: [] }));
const usdOf = ai => ai?.totalEstimatedCostUsd ?? ai?.estimatedCostUsd ?? ai?.totals?.estimatedCostUsd ?? ai?.summary?.estimatedCostUsd;

function Limits({ rows, onClose, onDone }) {
  const [v, setV] = useState(() => Object.fromEntries(rows.map(r => [r.c.courseId, String(r.cfg?.aiBudgetYen ?? 0)])));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true); setErr("");
    try { for (const r of rows) { if (Number(v[r.c.courseId]) !== Number(r.cfg?.aiBudgetYen ?? 0)) await apiPut("/course-config", { courseId: r.c.courseId, aiBudgetYen: Number(v[r.c.courseId]) || 0 }); } onDone(); } // eslint-disable-line no-await-in-loop
    catch (e) { setErr(errText(e, "保存できませんでした")); setBusy(false); }
  };
  return (
    <Modal title="AI の費用の上限" width={560} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy} onClick={save}>決める</Btn></>}>
      <div className="scroll"><table className="tbl"><thead><tr><th>コース</th><th>今月</th><th>上限（円）</th></tr></thead><tbody>
        {rows.map(r => <tr key={r.c.courseId}><td><b>{r.c.name}</b></td><td className="num">{r.cfg?.aiUsedYen != null ? yen(r.cfg.aiUsedYen) : "—"}</td><td>{r.cfg ? <input type="number" min="0" step="1000" aria-label={`${r.c.name} の上限`} value={v[r.c.courseId]} onChange={e => setV(s => ({ ...s, [r.c.courseId]: e.target.value }))} /> : <Chip>確認できません</Chip>}</td></tr>)}
        {!rows.length && <tr><td colSpan={3}><Chip>なし</Chip></td></tr>}
      </tbody></table></div>
      <div className="row"><Chip>0 は上限なし</Chip></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

export default function AdminAna({ go, say }) {
  const now = todayStr().slice(0, 7);
  const months = [shift(now, -2), shift(now, -1), now];
  const [month, setMonth] = useState(now);
  const [st, setSt] = useState({ state: "loading", rows: [], prev: [], all: [] });
  const [ai, setAi] = useState(undefined);
  const [cfg, setCfg] = useState(undefined);
  const [key, setKey] = useState(0);
  const [q, setQ] = useState(""); const [ans, setAns] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [limit, setLimit] = useState(false);
  useEffect(() => {
    let alive = true;
    setSt(s => ({ ...s, state: "loading" })); setAi(undefined); setAns("");
    apiGet("/admin/course-overview").then(async r => {
      const all = arr(r?.courses), cs = all.filter(c => inMonth(c, month)), pm = shift(month, -1);
      const [rows, prev] = await Promise.all([Promise.all(cs.map(c => stats(c, month))), Promise.all(all.filter(c => inMonth(c, pm)).map(c => stats(c, pm)))]);
      if (alive) setSt({ state: "ready", rows, prev, all });
    }).catch(() => { if (alive) setSt({ state: "error", rows: [], prev: [], all: [] }); });
    apiGet(`/admin/ai-usage?month=${month}`).then(d => { if (alive) setAi(d || null); }).catch(() => { if (alive) setAi(null); });
    return () => { alive = false; };
  }, [key, month]);
  // 上限は今月のコース（研修中）の設定を足す
  useEffect(() => {
    if (st.state !== "ready") return undefined;
    let alive = true;
    const cur = st.all.filter(c => inMonth(c, now));
    Promise.all(cur.map(c => apiGet(`/course-config?courseId=${encodeURIComponent(c.courseId)}`).then(d => ({ c, cfg: d })).catch(() => ({ c, cfg: null })))).then(l => { if (alive) setCfg(l); });
    return () => { alive = false; };
  }, [st.state, st.all, now, key]);
  if (st.state === "error") return <Card><div className="empty"><b>分析の数字を確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card>;
  const known = st.rows.filter(r => r.o);
  const weighted = (list, k) => { const n = list.reduce((a, r) => a + (r.o[k] != null ? r.o.traineeCount || 0 : 0), 0); return n ? Math.round(list.reduce((a, r) => a + (r.o[k] || 0) * (r.o.traineeCount || 0), 0) / n) : null; };
  const people = known.reduce((a, r) => a + (r.o.traineeCount || 0), 0);
  const att = weighted(known, "attendanceRate"), rep = weighted(known, "reportRate");
  const pknown = st.prev.filter(r => r.o), patt = weighted(pknown, "attendanceRate"), prep = weighted(pknown, "reportRate");
  const usd = usdOf(ai), cost = usd != null ? usd * USD_JPY : null;
  const cap = arr(cfg).reduce((a, r) => a + (Number(r.cfg?.aiBudgetYen) || 0), 0);
  const features = arr(ai?.byFeature);
  const maxF = Math.max(0.0001, ...features.map(x => Number(x.estimatedCostUsd) || 0));
  const mn = Number(month.slice(5));
  const ask = async text => {
    const t = String(text ?? q).trim();
    if (!t || busy) return;
    setQ(t); setBusy(true); setErr(""); setAns("");
    try {
      const r = await apiPost("/ai/staff-draft", { kind: "numbers", text: t, context: { month, attendanceRate: att, reportRate: rep, people, previous: { attendanceRate: patt, reportRate: prep }, aiCostYen: cost, aiByFeature: features.slice(0, 8), courses: known.map(r2 => ({ name: r2.c.name, ...r2.o, tests: r2.tests.map(x => ({ title: x.title, average: x.average })) })) } });
      setAns(r.text);
    } catch (e) { setErr(errText(e, "答えを作れませんでした")); } finally { setBusy(false); }
  };
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{mn}月</div><h1 className="h1">分析</h1></div><span className="r"><span className="seg">{months.map(m => <button key={m} type="button" aria-pressed={month === m} onClick={() => setMonth(m)}>{Number(m.slice(5))}月</button>)}</span></span></div>
      {st.state === "loading" ? <div className="soon card">読み込み中</div> : (
        <>
          <Hero cat="cur" className="an-hero" eyebrow={`${mn}月 ・ 全コース`} title={`受講生 ${people} 人`}>
            <Kpi items={[
              { label: "出席率", value: att ?? "—", unit: att != null ? "%" : "", pct: att ?? undefined, note: patt != null ? `前月 ${patt}%` : undefined },
              { label: "日報の提出", value: rep ?? "—", unit: rep != null ? "%" : "", pct: rep ?? undefined, note: prep != null ? `前月 ${prep}%` : undefined },
              { label: "AI の費用", value: cost != null ? yen(cost) : "—", pct: cost != null && cap > 0 ? Math.min(100, Math.round(cost / cap * 100)) : undefined, note: cap > 0 ? `上限 ${yen(cap)}` : undefined },
              { label: "研修中のコース", value: st.rows.length, unit: "", pct: st.all.length ? Math.round(st.rows.length / st.all.length * 100) : undefined, note: `全 ${st.all.length}` },
            ]} />
          </Hero>
          <Card className="pad st-g">
            <div className="head"><h2 className="h2">数字に聞く</h2></div>
            <div className="an-ai"><input type="text" value={q} placeholder="例：出席率が下がっているコースは？" aria-label="質問" onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) ask(); }} /><Btn kind="sm" disabled={busy || !q.trim()} onClick={() => ask()}>{busy ? "集めています" : "聞く"}</Btn></div>
            {!ans && !busy && <div className="row">{ASK.map(x => <button key={x} type="button" className="chip qk" onClick={() => ask(x)}>{x}</button>)}</div>}
            {ans && <div className="dr-m c-cur"><p className="st-pre">{ans}</p></div>}
            {err && <div className="lms-err" role="alert">{err}</div>}
          </Card>
          <div className="g2e">
            <Card className="pad st-g">
              <h2 className="h2">コースごとの出席率</h2>
              <div className="bars">{st.rows.map(r => <div key={r.c.courseId} className={r.o?.attendanceRate != null && r.o.attendanceRate < 90 ? "low" : ""}><span>{r.c.name}</span><s style={{ "--w": `${r.o?.attendanceRate ?? 0}%` }} /><span className="num">{r.o?.attendanceRate != null ? `${r.o.attendanceRate}%` : "—"}</span></div>)}{!st.rows.length && <Chip>なし</Chip>}</div>
            </Card>
            <Card className="pad st-g">
              <div className="head"><h2 className="h2">AI の費用 ・ {mn}月</h2><span className="r"><Btn kind="ghost sm" disabled={cfg === undefined} onClick={() => setLimit(true)}>上限を変える</Btn></span></div>
              {ai === null && <Chip>確認できません</Chip>}
              <div className="bars cost">{features.slice(0, 8).map(x => { const v = Number(x.estimatedCostUsd) || 0; return <div key={x.feature}><span>{x.feature}</span><s style={{ "--w": `${Math.round(v / maxF * 100)}%` }} /><span className="num">{yen(v * USD_JPY)}</span></div>; })}{ai && !features.length && <Chip>なし</Chip>}</div>
            </Card>
          </div>
        </>
      )}
      {limit && <Limits rows={arr(cfg)} onClose={() => setLimit(false)} onDone={() => { setLimit(false); say?.("上限を変えました"); setKey(k => k + 1); }} />}
    </div>
  );
}
