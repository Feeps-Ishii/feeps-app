import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Ic, planLabel } from "../ui.jsx";
import { cloud } from "../data.js";
import { AWS_CHECK_NAMES } from "../DrillPage.jsx";
import { awsDiagram } from "./awsDiagram.js";
import "./awsLabs.css";

/* AWS実習（2026-11-19、モック tenolab-drills.html「AWS実習」。宣伝ページの AWS の部分と同じ作り）
   上：黒い帯（4つ目の段「本物の環境」。見出し・作る/足す/直す・今月の残り）と、選んだ実習の構成図の小さなカード（2026-11-19 小さく）。
   動いている環境があれば帯の下に残り時間。下：作る・足す・直すの段ごとに実習のカード。
   始めると演習の画面（#/drills/{id}）へ移り、手順・採点はそちらで行う */

const TRACKS = [["基礎", "作る", "blank", "まっさらな環境から", "まっさら"], ["応用", "足す", "ready", "用意済みの環境に", "用意済み"], ["運用", "直す", "trouble", "障害が起きた環境を", "障害あり"]];
const LV_OF_START = { blank: "基礎", ready: "応用", trouble: "運用" };
const scenarioOf = d => d.aws?.scenario || d.id;
const stepsOf = d => (d.aws?.steps || []).map(s => s?.title || "").filter(t => t && !/コンソールを開く/.test(t));
const fmtLeft = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const fmtHM = min => `${Math.floor(min / 60)}:${String(Math.max(0, min % 60)).padStart(2, "0")}`;
const md = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()}`; };

function Diagram({ d, uid, crop }) {
  const html = useMemo(() => awsDiagram(scenarioOf(d), uid, crop), [d.id, uid, crop]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span className="dg" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function AwsLabs({ ctx }) {
  const { drills, progress, premium, go } = ctx;
  const labs = useMemo(() => (drills || []).filter(d => d.runtime === "aws"), [drills]);
  const trackOf = d => TRACKS.find(t => t[0] === d.level) || TRACKS.find(t => t[0] === LV_OF_START[d.start]) || TRACKS[0];
  const [info, setInfo] = useState({ state: premium ? "loading" : "off" });   // GET /cloudlab/session
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [confirmStop, setConfirmStop] = useState(false);
  const [sel, setSel] = useState(null);
  const archRef = useRef(null);

  async function load() {
    if (!premium) return;
    try { setInfo({ state: "ready", ...(await cloud.session()) }); } catch (e) { setInfo({ state: "error" }); }
  }
  useEffect(() => { load(); }, [premium]); // eslint-disable-line react-hooks/exhaustive-deps
  const session = info.session?.scenario ? info.session : null;
  useEffect(() => {
    if (!session) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [!!session]); // eslint-disable-line react-hooks/exhaustive-deps

  const running = session ? labs.find(d => scenarioOf(d) === session.scenario) || null : null;
  const st = d => (d.locked ? "lock" : progress?.drill?.(d.id)?.status === "cleared" ? "done" : running?.id === d.id ? "try" : "");
  const selected = labs.find(d => d.id === sel) || running || labs.find(d => !st(d)) || labs[0];
  // 構成図を描き直すたびに、線を描く動きを最初から
  useLayoutEffect(() => {
    const el = archRef.current;
    if (!el) return undefined;
    el.classList.remove("in");
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => el.classList.add("in")); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [selected?.id]);

  if (!labs.length) return <div className="awl-empty"><p className="muted">AWS の実習はまだありません。</p></div>;

  const done = labs.filter(d => st(d) === "done").length;
  const mins = labs.map(d => Number(d.minutes || 0)).filter(Boolean);
  const range = mins.length ? (Math.min(...mins) === Math.max(...mins) ? `${mins[0]}` : `${Math.min(...mins)}〜${Math.max(...mins)}`) : "";
  const quota = info.awsMinutes && info.awsMinutes.limit + info.awsMinutes.extra > 0 ? info.awsMinutes : null;
  const open = d => go(`#/drills/${encodeURIComponent(d.id)}`);

  async function act(kind, fn) {
    if (busy) return;
    setBusy(kind); setErr("");
    try { await fn(); }
    catch (e) {
      setErr(e?.errorMessage === "aws_hours_exceeded" ? "今月の実習の時間を使い切りました。"
        : e?.status === 409 ? (e?.errorMessage || "いまは環境の空きがありません。少し時間をおいてから試してください。")
          : e?.status === 403 ? `この実習は${planLabel()}プランで利用できます。`
            : (e?.errorMessage || "うまくいきませんでした。もう一度試してください。"));
    } finally { setBusy(""); }
  }
  const startLab = d => act("start", async () => { await cloud.start(scenarioOf(d)); open(d); });
  const stop = () => act("stop", async () => { setConfirmStop(false); await cloud.stop(); await load(); });
  // 押したその場で窓を開いておき、URL が届いたら移す（待ってから開くとポップアップとして止められるため）
  const openConsole = () => {
    const w = window.open("about:blank", "_blank");
    act("console", async () => {
      try {
        const r = await cloud.console();
        const u = r?.consoleUrl || r?.url;
        if (u && w) { w.opener = null; w.location.href = u; } else if (u) window.open(u, "_blank", "noopener");
        else if (w) w.close();
      } catch (e) { if (w) w.close(); throw e; }
    });
  };

  const ss = st(selected);
  const tr = trackOf(selected);
  const steps = stepsOf(selected);
  const checks = (AWS_CHECK_NAMES[scenarioOf(selected)] || []).length;
  const otherRunning = session && running?.id !== selected.id;
  const mainBtn = ss === "lock" ? <button type="button" className="btn" disabled>{planLabel()}プランで利用できます</button>
    : ss === "try" ? <button type="button" className="btn" onClick={() => open(selected)}>つづきから</button>
      : otherRunning ? <button type="button" className="btn" disabled>ほかの実習が動いています</button>
        : info.state === "loading" ? <button type="button" className="btn" disabled>確かめています…</button>
          : <button type="button" className="btn" disabled={!!busy} onClick={() => startLab(selected)}>{busy === "start" ? "用意しています…" : ss === "done" ? "もう一度やる" : "環境を用意して始める"}</button>;

  // 動いている環境の残り時間
  const left = session?.expiresAt ? new Date(session.expiresAt).getTime() - now : null;
  const planMin = info.scenarioMinutes?.[session?.scenario] || info.defaultScenarioMinutes || 30;
  const canExtend = info.extendsLeft == null || info.extendsLeft > 0;
  const totalMs = (planMin + (canExtend ? 0 : info.extendMinutes || 30)) * 60_000;
  const preparing = session?.stage === "preparing";

  return (
    <div className="awl">
      <section className="aws-dark">
        <div className="awl-wrap aws2">
          <div>
            <div className="aws-ey"><span className="stp-badge s4"><span className="no">4</span>本物の環境</span><span className="pg">AWS実習</span><span className="prem">{planLabel().toUpperCase()}</span></div>
            <h1 className="aws-h"><span className="mark">本物の環境</span>で、作る・足す・直す。</h1>
            <div className="starts">
              {TRACKS.map(([lv, verb, cls, , short]) => {
                const items = labs.filter(d => trackOf(d)[0] === lv);
                if (!items.length) return null;
                return (
                  <button key={lv} type="button" title={items.map(d => d.title).join(" ／ ")} onClick={() => document.getElementById(`awl-tr-${lv}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                    <b>{verb}</b><span className={`start ${cls}`}>{short}</span>
                    {premium ? <span className="tc"><b>{items.filter(d => st(d) === "done").length}</b> / {items.length}</span> : <span className="tc">{items.length}</span>}
                  </button>
                );
              })}
            </div>
            {premium ? (
              <div className="aws-plans">
                <span>クリア <b>{done}</b> / {labs.length}</span>
                {quota && <span>今月の残り <b>{fmtHM(quota.left)}</b><i className="meter"><i style={{ width: `${Math.min(100, (quota.left / (quota.limit + quota.extra)) * 100)}%` }} /></i>{Math.round((quota.limit + quota.extra) / 60)}時間</span>}
                {range && <span>1回 <b>{range}</b> 分</span>}
                <span>終わったら自動で片付け</span>
              </div>
            ) : (
              <div className="aws-lock"><Ic id="lock" />{planLabel()}プランで利用できます</div>
            )}
          </div>
          <div className="arch-card" ref={archRef}>
            <div className="arch-top">
              <h2 title={`${tr[3]} ・ ${tr[1]}`}>{selected.title}</h2>
              {ss === "done" ? <span className="score ok">採点 {checks} / {checks}</span> : ss === "try" ? <span className="score try">挑戦中</span> : checks ? <span className="score no">採点 {checks}項目</span> : null}
            </div>
            <div className="arch-diagram"><Diagram d={selected} uid="hero" crop /></div>
            <div className="arch-act">
              <span className="mt">{ss === "try" && left != null && !preparing ? <span>のこり <b>{fmtLeft(left)}</b></span> : selected.minutes ? <span>約<b>{selected.minutes}</b>分</span> : null}{steps.length > 0 && <span>手順 <b>{steps.length}</b></span>}</span>
              {mainBtn}
            </div>
            {err && <div className="arch-err" role="alert">{err}</div>}
          </div>
        </div>
      </section>

      <div className="awl-wrap">
        {premium && info.state === "error" && <div className="arun"><span className="nm"><b>環境の状態を確かめられませんでした</b></span><span className="r"><button type="button" className="btn ghost sm" onClick={load}>もう一度</button></span></div>}
        {session && (
          <div className="arun">
            <span className="dot" aria-hidden="true" />
            <span className="nm"><small>{preparing ? "環境を用意しています" : "環境を用意済み"}</small><b>{running?.title || "AWS の実習"}</b></span>
            {left != null && !preparing && (
              <span className="tm"><b>{fmtLeft(left)}</b><span className="meter"><i style={{ width: `${Math.max(0, Math.min(100, (left / totalMs) * 100))}%` }} /></span><small>のこり{canExtend ? " ・ 1回だけ延長できます" : ""}</small></span>
            )}
            <span className="r">
              {confirmStop ? (
                <><span className="cf">片付けると、作ったものは消えます</span><button type="button" className="btn ghost sm" onClick={() => setConfirmStop(false)}>やめる</button><button type="button" className="btn sm danger" disabled={!!busy} onClick={stop}>{busy === "stop" ? "片付けています…" : "片付ける"}</button></>
              ) : (
                <><button type="button" className="btn ghost sm" disabled={!!busy} onClick={() => setConfirmStop(true)}>片付けて終わる</button>
                  {preparing || !running ? (running && <button type="button" className="btn sm" onClick={() => open(running)}>実習を開く</button>)
                    : <button type="button" className="btn sm" disabled={!!busy} onClick={openConsole}>{busy === "console" ? "開いています…" : "コンソールへ戻る"}</button>}</>
              )}
            </span>
          </div>
        )}

        <div className="labs-h"><h2>実習</h2><span className="muted">{labs.length}件</span></div>
        <div className="tracks">
          {TRACKS.map(([lv, verb, cls, from], i) => {
            const items = labs.filter(d => trackOf(d)[0] === lv);
            if (!items.length) return null;
            return (
              <section key={lv} className={`track ${cls}`} id={`awl-tr-${lv}`}>
                <div className="trh"><span className="no">{String(i + 1).padStart(2, "0")} ・ {lv}</span><b>{verb}</b><span className={`start ${cls}`}>{from}</span>
                  {premium && <span className="tally"><b>{items.filter(d => st(d) === "done").length}</b> / {items.length}</span>}</div>
                <div className="labs">
                  {items.map((d, j) => {
                    const s = st(d);
                    const rec = progress?.drill?.(d.id);
                    const pick = () => { setSel(d.id); if (window.innerWidth < 980) archRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); };
                    return (
                      <article key={d.id} className={`card lab ${s === "lock" ? "locked" : ""}`} tabIndex={0} aria-current={d.id === selected.id}
                        onClick={e => { if (!e.target.closest("button")) pick(); }}
                        onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); pick(); } }}>
                        <div className="lab-dg"><Diagram d={d} uid={`t${i}${j}`} crop />
                          {s === "done" ? <span className="lbadge ok">✓ クリア</span> : s === "try" ? <span className="lbadge try">挑戦中</span> : null}</div>
                        <div className="lab-bd"><h3>{d.title}</h3>
                          <div className="meta"><span className={`start ${cls}`}>{from.replace(/(から|に|を)$/, "")}</span>{d.minutes ? <span className="chip">約{d.minutes}分</span> : null}{stepsOf(d).length > 0 && <span className="chip">手順 {stepsOf(d).length}</span>}</div></div>
                        <div className="lab-ft">
                          <span className="last">{s === "done" && rec?.clearedAt ? `${md(rec.clearedAt)} クリア` : ""}</span>
                          {s === "lock" ? <span className="chip prem">{planLabel()}</span>
                            : <button type="button" className={`btn sm ${s === "try" ? "" : "ghost"}`} onClick={() => open(d)}>{s === "try" ? "つづきから" : s === "done" ? "もう一度" : "開く"}</button>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
