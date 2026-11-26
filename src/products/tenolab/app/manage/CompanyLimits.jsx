import React, { useCallback, useEffect, useState } from "react";
import { admin } from "../data.js";
import { Title, yen } from "./parts.jsx";

/* 企業ごとの上限・公開と、全体の上限（2026-11-26、モック docs/design/mockups/tenolab-2026-09/tenolab-limits.html）
   API は routes/tenolabLimits.mjs。目安：AI は 1 回の平均（使用ログ）、AWS は 1 時間（先月の請求 ÷ 使った時間）。
   「1 回 × 1 人の月の上限 × 受講枠 = 最大」をいつも出して、数字を変えるとすぐ出し直す */

export function useCompanySettings(companyId) {
  const [st, setSt] = useState({ state: "loading" });
  const [draft, setDraft] = useState(null);
  const load = useCallback(() => admin.settings(companyId).then(d => { setSt({ state: "ready", data: d }); setDraft(d.settings); }).catch(() => setSt({ state: "error" })), [companyId]);
  useEffect(() => { load(); }, [load]);
  const set = (group, patch) => setDraft(x => ({ ...x, [group]: typeof patch === "function" ? patch(x[group]) : { ...x[group], ...patch } }));
  const dirty = !!(st.data && draft && JSON.stringify(st.data.settings) !== JSON.stringify(draft));
  const save = () => admin.saveSettings(companyId, draft).then(r => { setSt(s => ({ ...s, data: { ...s.data, settings: r.settings } })); setDraft(r.settings); return r; });
  return { ...st, draft, set, dirty, save, reload: load };
}

const n = v => Math.max(0, Number(v) || 0);
const fmtU = (v, unit) => (unit === "回" ? `¥${(Number(v) || 0).toFixed(2)}` : `¥${Math.round(Number(v) || 0)}`);
const seatsOf = d => d.seats?.total || d.seats?.learners || 0;

export function Formula({ unit, unitYen, perMonth, seats, light }) {
  return (
    <div className={`lm-fx${light ? " lt" : ""}`}>
      <span><small>1 {unit}</small><b>約 {fmtU(unitYen, unit)}</b></span><i>×</i>
      <span><small>1 人 月</small><b>{perMonth} {unit}</b></span><i>×</i>
      <span><small>受講枠</small><b>{seats} 人</b></span><i>=</i>
      <span className="eq"><small>最大</small><b>{yen(unitYen * perMonth * seats)}</b></span>
    </div>
  );
}

function Seg({ value, options, onChange, label }) {
  return <div className="lm-seg" role="group" aria-label={label}>{options.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}</div>;
}
function Toggle({ id, label, sub, checked, onChange }) {
  return (
    <div className="lm-opt">
      <span><b>{label}</b>{sub && <small>{sub}</small>}</span>
      <label className="sw"><input type="checkbox" id={id} checked={checked} onChange={e => onChange(e.target.checked)} aria-label={label} /></label>
    </div>
  );
}

// 契約・公開の期間の帯（契約は薄い青、公開は緑、今日は赤い線）
function Timeline({ from, to, openFrom, openTo }) {
  const ds = [from, to, openFrom, openTo].filter(Boolean).sort();
  if (!ds.length) return null;
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const a = Date.parse(ds[0]) - 30 * 864e5, b = Math.max(Date.parse(ds[ds.length - 1]), Date.parse(today)) + 30 * 864e5;
  const x = d => Math.min(100, Math.max(0, (Date.parse(d) - a) / (b - a) * 100));
  const seg = (f, t, cls) => (f || t ? <span className={cls} style={{ left: `${x(f || ds[0])}%`, width: `${Math.max(0.5, x(t || ds[ds.length - 1]) - x(f || ds[0]))}%` }} /> : null);
  const ticks = []; const s = new Date(a); s.setUTCDate(1);
  for (let d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1)); d.getTime() < b; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1))) ticks.push(d.toISOString().slice(0, 10));
  return (
    <>
      <div className="lm-tl" aria-hidden="true"><span className="ax" />{seg(from, to, "ct")}{seg(openFrom, openTo, "op")}<span className="today" style={{ left: `${x(today)}%` }} />{ticks.map(t => <span key={t} className="lb" style={{ left: `${x(t)}%` }}>{t.slice(2, 7).replace("-", "/")}</span>)}</div>
      <div className="lm-legend"><span><i className="ct" />契約</span><span><i className="op" />公開</span></div>
    </>
  );
}

/* 契約のタブに足すもの：終わったあとの扱い・知らせる、上限の目安 */
export function ContractExtra({ st, contract, go, companyId }) {
  const d = st.data, s = st.draft;
  if (!d || !s) return null;
  const seats = seatsOf(d);
  return (
    <>
      <section className="card msec">
        <h2>期間の効き方</h2>
        <Timeline from={contract.startDate} to={contract.endDate} openFrom={s.open.same ? contract.startDate : s.open.from} openTo={s.open.same ? contract.endDate : s.open.to} />
        <div className="mfield"><span>終わったあと</span><Seg label="終わったあと" value={s.contract.afterEnd} onChange={v => st.set("contract", { afterEnd: v })} options={[["stop", "入れなくする"], ["read", "見るだけにする"], ["grace", "しばらく使える"]]} /></div>
        {s.contract.afterEnd === "grace" && <label className="mfield"><span>使える日数</span><input id={`grace-${companyId}`} type="number" min="1" max="365" value={s.contract.graceDays} onChange={e => st.set("contract", { graceDays: n(e.target.value) })} /></label>}
        <Toggle id={`remind-${companyId}`} label="終わる 30 日前に知らせる" sub="企業と契約の一覧に「あと n 日」を出す" checked={s.contract.remind} onChange={v => st.set("contract", { remind: v })} />
      </section>
      <section className="card msec">
        <h2>上限の目安</h2>
        <div className="lm-opt"><span><b>AI</b><small>1 人 月 {s.ai.perMonth} 回 ・ 企業 {s.ai.capYen ? yen(s.ai.capYen) : "上限なし"}</small></span><button type="button" className="btn ghost" onClick={() => go(`#/manage/companies/${encodeURIComponent(companyId)}/ai`)}>直す</button></div>
        <Formula light unit="回" unitYen={d.estimate.ai.yenPerCall} perMonth={s.ai.perMonth} seats={seats} />
        <div className="lm-opt"><span><b>AWS 実習</b><small>1 人 月 {s.aws.perMonthHours} 時間 ・ 企業 {s.aws.capYen ? yen(s.aws.capYen) : "上限なし"}</small></span><button type="button" className="btn ghost" onClick={() => go(`#/manage/companies/${encodeURIComponent(companyId)}/aws`)}>直す</button></div>
        <Formula light unit="時間" unitYen={d.estimate.aws.yenPerHour} perMonth={s.aws.perMonthHours} seats={seats} />
      </section>
    </>
  );
}

const FEATS = [["lesson", "レッスン", "スライド・動画"], ["drill", "演習", "ドリル・道のり"], ["case", "案件体験", "PM・お客さまとのやり取り"], ["aws", "AWS 実習", "本物の環境"], ["rank", "ランキング", "企業の中だけ"], ["cert", "修了証", "修了したら出す"]];

/* 公開のタブ：公開の期間・公開する機能・単元ごとの公開日 */
export function PublishTab({ st, contract, topics = [], companyId }) {
  const d = st.data, s = st.draft;
  if (!d || !s) return null;
  const f = s.features, setF = (k, v) => st.set("features", { [k]: v });
  const weekly = () => {
    const base = s.open.same ? contract.startDate : s.open.from;
    const start = base || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    st.set("unitDates", () => Object.fromEntries(topics.map((t, i) => [t.id, new Date(Date.parse(`${start}T00:00:00Z`) + i * 7 * 864e5).toISOString().slice(0, 10)])));
  };
  return (
    <div className="mtwo" style={{ marginTop: 0 }}>
      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <section className="card msec">
          <h2>公開の期間</h2>
          <Toggle id={`same-${companyId}`} label="契約の期間と同じ" checked={s.open.same} onChange={v => st.set("open", { same: v })} />
          {!s.open.same && <div className="mgrid">
            <label className="mfield"><span>受講生が使い始める日</span><input id={`of-${companyId}`} type="date" value={s.open.from} onChange={e => st.set("open", { from: e.target.value })} /></label>
            <label className="mfield"><span>使えなくなる日</span><input id={`ot-${companyId}`} type="date" value={s.open.to} onChange={e => st.set("open", { to: e.target.value })} /></label>
          </div>}
          <Timeline from={contract.startDate} to={contract.endDate} openFrom={s.open.same ? contract.startDate : s.open.from} openTo={s.open.same ? contract.endDate : s.open.to} />
          {!contract.startDate && !contract.endDate && s.open.same && <p className="muted" style={{ margin: 0, fontSize: 13 }}>契約の期間がまだ入っていません（いつでも使えます）</p>}
        </section>
        <section className="card msec">
          <h2>公開する機能</h2>
          <div className="lm-feat">{FEATS.map(([k, l, sub]) => <Toggle key={k} id={`f-${k}-${companyId}`} label={l} sub={sub} checked={f[k]} onChange={v => setF(k, v)} />)}</div>
          <Toggle id={`f-ai-${companyId}`} label="AI に聞く" sub="受講生の AI ぜんぶ" checked={f.ai} onChange={v => setF("ai", v)} />
          {f.ai && [["aiSlides", "資料に聞く"], ["aiCode", "演習の AI"], ["aiCase", "案件体験のチャット"]].map(([k, l]) => <div key={k} className="lm-sub"><Toggle id={`f-${k}-${companyId}`} label={l} checked={f[k]} onChange={v => setF(k, v)} /></div>)}
        </section>
      </div>
      <section className="card msec">
        <h2>単元ごとの公開日 <span className="chip">空ならすぐ</span></h2>
        <div className="lm-drip">
          {topics.map((t, i) => (
            <div key={t.id} className="lm-dr"><span className="no num">{i + 1}</span><b>{t.name || t.title || t.id}</b>
              <input type="date" id={`ud-${t.id}`} value={s.unitDates[t.id] || ""} aria-label={`${t.name || t.title || t.id} の公開日`} onChange={e => st.set("unitDates", u => { const x = { ...u }; if (e.target.value) x[t.id] = e.target.value; else delete x[t.id]; return x; })} />
            </div>
          ))}
          {!topics.length && <p className="muted" style={{ margin: 0 }}>単元がありません。</p>}
        </div>
        <div className="row" style={{ gap: 8 }}><button type="button" className="btn ghost" onClick={weekly} disabled={!topics.length}>1 週ごとに入れる</button><button type="button" className="btn ghost" onClick={() => st.set("unitDates", () => ({}))}>全部すぐ</button></div>
      </section>
    </div>
  );
}

const KIND = {
  ai: { unit: "回", m: "perMonth", d: "perDay", presets: [["少なめ", 100, 20], ["ふつう", 300, 40], ["多め", 600, 80]], stopL: "止める", add: 100, val: u => u.ai.month, day: u => u.ai.day, extra: u => u.ai.extra },
  aws: { unit: "時間", m: "perMonthHours", d: "perDayHours", presets: [["少なめ", 10, 3], ["ふつう", 20, 4], ["多め", 40, 8]], stopL: "新しく立ち上げられなくする", add: 5, val: u => Math.round(u.aws.month / 6) / 10, day: u => Math.round(u.aws.day / 6) / 10, extra: u => Math.round(u.aws.extra / 60) },
};

/* AI の上限・AWS の上限のタブ（同じ形） */
export function LimitTab({ st, kind, companyId }) {
  const [msg, setMsg] = useState("");
  const d = st.data, s = st.draft;
  if (!d || !s) return null;
  const k = KIND[kind], l = s[kind], u = k.unit;
  const est = d.estimate[kind], unitYen = kind === "ai" ? est.yenPerCall : est.yenPerHour;
  const seats = seatsOf(d), perMonth = l[k.m], perDay = l[k.d];
  const maxUser = unitYen * perMonth, maxAll = maxUser * seats;
  const last = kind === "ai" ? est.lastMonthPerUser : est.lastMonthPerUserHours;
  const expect = last * unitYen * (d.seats.learners || seats);
  const capFirst = l.capYen > 0 && l.capYen < maxAll, eff = capFirst ? l.capYen : maxAll;
  const top = Math.max(maxAll, l.capYen, expect, 1), pct = v => `${Math.min(100, v / top * 100)}%`;
  const used = d.usage[kind].yen, usedPct = l.capYen ? Math.round(used / l.capYen * 100) : 0;
  const users = d.users.filter(x => k.val(x) > 0 || k.extra(x) > 0).sort((a, b) => k.val(b) - k.val(a));
  const limitOf = x => perMonth + k.extra(x);
  const near = d.users.filter(x => k.val(x) / limitOf(x) >= 0.6).length;
  async function addExtra(x) {
    setMsg("");
    try { await admin.addExtra(companyId, { userId: x.userId, kind, amount: k.add }); setMsg(`${x.name} さんの今月の上限を ${k.add} ${u}足しました`); st.reload(); }
    catch (e) { setMsg(e?.errorMessage || "足せませんでした。"); }
  }
  return (
    <div className="mtwo" style={{ marginTop: 0 }}>
      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <section className="card msec">
          <h2>今月の使用</h2>
          <div className="lm-use">
            <div><span>企業の合計</span><b className="num">{yen(used)}</b>{l.capYen > 0 && <><span className="meter"><i style={{ width: `${Math.min(100, usedPct)}%`, background: usedPct >= l.warnPct ? "var(--marker-deep)" : "var(--mint)" }} /></span><small className="num">上限 {yen(l.capYen)} の {usedPct}%</small></>}</div>
            <div><span>使った人</span><b className="num">{d.usage[kind].activeUsers} 人</b>{kind === "ai" && <small className="num">{d.usage.ai.calls.toLocaleString()} 回</small>}{kind === "aws" && <small className="num">{Math.round(d.usage.aws.minutes / 6) / 10} 時間</small>}</div>
            <div><span>上限に近い人</span><b className="num">{near} 人</b><small>月 {perMonth} {u}の 60% 以上</small></div>
          </div>
          {msg && <div className="verdict ok" role="status">{msg}</div>}
          <div className="lm-users">
            {users.slice(0, 30).map(x => (
              <div key={x.userId} className="lm-ur">
                <span><b>{x.name || "名前なし"}</b><small className="num"> 今日 {k.day(x)} {u}</small></span>
                <span className="meter"><i style={{ width: `${Math.min(100, k.val(x) / limitOf(x) * 100)}%`, background: k.val(x) / limitOf(x) >= 0.6 ? "var(--marker-deep)" : "var(--mint)" }} /></span>
                <span className="num rt">{k.val(x)} / {limitOf(x)}</span>
                <button type="button" className="btn ghost" onClick={() => addExtra(x)}>＋{k.add} {u}</button>
              </div>
            ))}
            {!users.length && <p className="muted" style={{ margin: 0 }}>今月はまだ使った人がいません。</p>}
          </div>
        </section>
        <section className="card msec">
          <h2>1 人の上限</h2>
          <div className="lm-presets">{k.presets.map(([lb, m, dd]) => <button key={lb} type="button" aria-pressed={perMonth === m && perDay === dd} onClick={() => st.set(kind, { [k.m]: m, [k.d]: dd })}>{lb}（月 {m} {u}）</button>)}</div>
          <div className="mgrid">
            <label className="mfield"><span>月に（{u}まで）</span><input id={`${kind}-m-${companyId}`} type="number" min="1" value={perMonth} onChange={e => st.set(kind, { [k.m]: n(e.target.value) })} /></label>
            <label className="mfield"><span>1 日に（{u}まで）</span><input id={`${kind}-d-${companyId}`} type="number" min="1" value={perDay} onChange={e => st.set(kind, { [k.d]: n(e.target.value) })} /></label>
          </div>
          <p className="note">1 人あたり 月 最大 <b className="num">{yen(maxUser)}</b>（1 {u} 約 {fmtU(unitYen, u)} × {perMonth} {u}）</p>
        </section>
        <section className="card msec">
          <h2>企業の上限</h2>
          <div className="mgrid">
            <label className="mfield"><span>企業全体で月に（円まで、0 はなし）</span><input id={`${kind}-cap-${companyId}`} type="number" min="0" step="1000" value={l.capYen} onChange={e => st.set(kind, { capYen: n(e.target.value) })} /></label>
            <label className="mfield"><span>知らせる（%）</span><input id={`${kind}-warn-${companyId}`} type="number" min="10" max="100" step="5" value={l.warnPct} onChange={e => st.set(kind, { warnPct: n(e.target.value) })} /></label>
          </div>
          {l.capYen > 0 && <p className="note">{yen(l.capYen)} は 1 {u} 約 {fmtU(unitYen, u)} で 約 <b className="num">{Math.floor(l.capYen / unitYen).toLocaleString()}</b> {u}ぶん{seats ? `（受講枠 ${seats} 人なら 1 人 約 ${Math.floor(l.capYen / unitYen / seats)} ${u}）` : ""}</p>}
          <div className="mfield"><span>上限に着いたら</span><Seg label="上限に着いたら" value={l.onCap} onChange={v => st.set(kind, { onCap: v })} options={[["stop", k.stopL], ["notify", "知らせるだけ"]]} /></div>
        </section>
      </div>
      <aside className="lm-est" aria-label="費用の目安">
        <span className="eyebrow">目安 ・ 月</span>
        <Formula unit={u} unitYen={unitYen} perMonth={perMonth} seats={seats} />
        <div className="lm-big"><b className="num">{yen(eff)}</b><span>{capFirst ? "企業の上限で止まる" : "この設定でかかる最大"}</span></div>
        <div className="lm-meter">
          <div><span>先月の実績</span><span className="tr"><i style={{ width: pct(expect), background: "#7FE0BF" }} /></span><em className="num">{yen(expect)}</em></div>
          <div><span>1 人の上限×枠</span><span className="tr"><i style={{ width: pct(maxAll), background: "#9DB4F5" }} /></span><em className="num">{yen(maxAll)}</em></div>
          <div><span>企業の上限</span><span className="tr"><i style={{ width: pct(l.capYen), background: "var(--marker)" }} /></span><em className="num">{l.capYen ? yen(l.capYen) : "なし"}</em></div>
        </div>
        <div className={`lm-note${capFirst ? "" : " ok"}`}>{capFirst ? `全員が上限まで使う前に、企業の上限 ${yen(l.capYen)} で止まります` : "企業の上限より先に、1 人の上限で収まります"}</div>
        <div className="lm-calc">
          <div><span>1 {u}の目安のもと</span><b>{kind === "ai" ? (est.measured ? "今月の受講生の AI の平均" : "まだ実績がないので仮の値") : est.basis ? `${est.basis.month} の請求 ${yen(est.basis.billYen)} ÷ ${est.basis.hours} 時間` : "まだ実績がないので仮の値"}</b></div>
          <div><span>先月の 1 人平均</span><b className="num">{last} {u}</b></div>
        </div>
        {kind === "ai" && est.features.length > 0 && (
          <table className="lm-ptab"><thead><tr><th>機能</th><th className="rt">1 回</th><th className="rt">使われる割合</th></tr></thead>
            <tbody>{est.features.map(f => <tr key={f.name}><td>{f.name}</td><td className="rt num">¥{f.yen.toFixed(2)}</td><td className="rt num">{f.share}%</td></tr>)}</tbody></table>
        )}
        <span className="lm-foot">{kind === "ai" ? "Haiku 4.5 ・ 1 ドル 150 円" : "演習用アカウントの請求から ・ 1 ドル 150 円"} ・ 受講枠 {seats} 人</span>
      </aside>
    </div>
  );
}

/* AI と費用（全体）：全体の上限と、企業ごとの今月 */
export function AiCostPage({ go }) {
  const [st, setSt] = useState({ state: "loading" });
  const [g, setG] = useState(null);
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const load = useCallback(() => admin.limits().then(d => { setSt({ state: "ready", data: d }); setG(d.global); }).catch(() => setSt({ state: "error" })), []);
  useEffect(() => { load(); }, [load]);
  if (st.state === "loading") return <><Title eyebrow="AI ・ AWS" title="AI と費用" /><p className="muted">読み込んでいます…</p></>;
  if (st.state === "error") return <><Title eyebrow="AI ・ AWS" title="AI と費用" /><div className="card flat" style={{ padding: 16 }} role="alert">読み込めませんでした。 <button type="button" className="btn ghost" onClick={load}>もう一度</button></div></>;
  const d = st.data;
  const dirty = JSON.stringify(d.global) !== JSON.stringify(g);
  async function save() {
    setMsg({ kind: "", text: "" });
    try { const r = await admin.saveLimits(g); setSt(s => ({ ...s, data: { ...s.data, global: r.global } })); setG(r.global); setMsg({ kind: "ok", text: "保存しました。" }); }
    catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || "保存できませんでした。" }); }
  }
  const aiPct = g.aiCapYen ? Math.round(d.ai.yen / g.aiCapYen * 100) : 0, awsPct = g.awsCapYen ? Math.round(d.aws.yen / g.awsCapYen * 100) : 0;
  return (
    <>
      <Title eyebrow="AI ・ AWS" title="AI と費用"><button type="button" className="btn" disabled={!dirty} onClick={save}>保存</button></Title>
      {msg.text && <div className={`verdict ${msg.kind}`} role={msg.kind === "ng" ? "alert" : "status"} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div className="mtwo" style={{ marginTop: 0 }}>
        <section className="card msec">
          <h2>AI の全体の上限</h2>
          <div className="lm-use">
            <div><span>今月の AI（全体）</span><b className="num">{yen(d.ai.yen)}</b><span className="meter"><i style={{ width: `${Math.min(100, aiPct)}%`, background: "var(--mint)" }} /></span><small className="num">上限 {yen(g.aiCapYen)} の {aiPct}%</small></div>
            <div><span>1 回の目安</span><b className="num">¥{d.ai.yenPerCall.toFixed(2)}</b><small>Haiku 4.5</small></div>
            <div><span>受講生の AI</span><b className="num">{d.ai.learnerCalls.toLocaleString()}</b><small>回</small></div>
          </div>
          <label className="mfield"><span>全体で月に（円まで）</span><input id="g-ai-cap" type="number" min="0" step="5000" value={g.aiCapYen} onChange={e => setG(x => ({ ...x, aiCapYen: n(e.target.value) }))} /></label>
          <Toggle id="g-ai-stop" label="上限で全員の AI を止める" sub="最後の守り。企業の上限より大きくしておく" checked={g.aiStop} onChange={v => setG(x => ({ ...x, aiStop: v }))} />
        </section>
        <section className="card msec">
          <h2>AWS 実習の全体</h2>
          <div className="lm-use">
            <div><span>今月の見込み</span><b className="num">{yen(d.aws.yen)}</b><span className="meter"><i style={{ width: `${Math.min(100, awsPct)}%`, background: "var(--mint)" }} /></span><small className="num">目安 {yen(g.awsCapYen)} の {awsPct}%</small></div>
            <div><span>1 時間の目安</span><b className="num">{yen(d.aws.yenPerHour)}</b><small>{d.aws.basis ? `請求 ${yen(d.aws.basis.billYen)} ÷ ${d.aws.basis.hours} 時間` : "まだ実績がないので仮の値"}</small></div>
            <div><span>使った時間</span><b className="num">{Math.round(d.aws.minutes / 6) / 10}</b><small>時間</small></div>
          </div>
          <label className="mfield"><span>全体の月の目安（円）</span><input id="g-aws-cap" type="number" min="0" step="5000" value={g.awsCapYen} onChange={e => setG(x => ({ ...x, awsCapYen: n(e.target.value) }))} /></label>
        </section>
      </div>
      <section className="card flat" style={{ padding: "4px 8px", marginTop: 16 }}>
        <div className="tblwrap"><table className="mtbl" style={{ minWidth: 720 }}>
          <thead><tr><th>企業</th><th className="rt">受講生</th><th className="rt">AI 1 人 月</th><th className="rt">AI 企業の上限</th><th className="rt">AI 今月</th><th>上限まで</th><th className="rt">AWS 今月</th></tr></thead>
          <tbody>
            {d.companies.map(c => (
              <tr key={c.companyId} onClick={() => go(`#/manage/companies/${encodeURIComponent(c.companyId)}/ai`)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") go(`#/manage/companies/${encodeURIComponent(c.companyId)}/ai`); }}>
                <td><b>{c.name}</b></td><td className="rt num">{c.users}</td><td className="rt num">{c.ai.perMonth} 回</td>
                <td className="rt num">{c.ai.capYen ? yen(c.ai.capYen) : "なし"}</td><td className="rt num">{yen(c.ai.yen)}</td>
                <td style={{ minWidth: 110 }}>{c.ai.capYen ? <span className="meter"><i style={{ width: `${Math.min(100, c.ai.yen / c.ai.capYen * 100)}%`, background: c.ai.yen / c.ai.capYen >= 0.8 ? "var(--marker-deep)" : "var(--mint)" }} /></span> : <span className="muted">—</span>}</td>
                <td className="rt num">{yen(c.aws.minutes / 60 * d.aws.yenPerHour)}</td>
              </tr>
            ))}
            <tr style={{ cursor: "default" }}><td className="muted">企業に属さない人・社内</td><td /><td /><td /><td className="rt num">{yen(d.other.aiYen)}</td><td /><td className="rt num">{yen(d.other.awsMinutes / 60 * d.aws.yenPerHour)}</td></tr>
          </tbody>
        </table></div>
      </section>
    </>
  );
}
