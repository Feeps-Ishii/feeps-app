import React, { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../../api.js";

/* プランと支払い（個人だけ、2026-10-20、ADR 0029）。#/account
   - 今のプラン・次の請求日を出す（決めるのは Stripe からの通知。ここは読むだけ：GET /billing/me）
   - 無料の人：Pro / Pro+ を選ぶ → Stripe の支払い画面へ（POST /billing/checkout）。カード番号はこちらに来ない
   - 有料の人：「支払いと解約」→ Stripe のカスタマーポータルへ（POST /billing/portal）
   価格は税込み。紹介ページの料金（docs/decisions/0029）と同じ */
const PLANS = [
  { id: "pro", name: "Pro", month: 1480, year: 11800, feats: ["全コース・練習問題", "Java の実行", "本物の AWS 月 15時間", "本格案件 2本", "AI コーチ", "修了証・学習の記録（PDF）"] },
  { id: "proplus", name: "Pro+", month: 2980, year: 29800, feats: ["Pro のすべて", "本物の AWS 月 40時間", "本格案件 すべて", "AWS の案件", "AI コーチ 多め"] },
];
const NAME = { free: "無料", pro: "Pro", proplus: "Pro+" };
// 本物の AWS の時間の買い足し（個人だけ・その月だけ。ADR 0029）
const ADDONS = [{ hours: 5, price: 300 }, { hours: 10, price: 500 }, { hours: 20, price: 900 }];
const yen = n => `¥${n.toLocaleString("ja-JP")}`;
const day = iso => { try { return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }); } catch { return ""; } };
const ERR = {
  billing_unavailable: "いまは支払いの手続きができません。時間をおいてもう一度お試しください。",
  already_subscribed: "すでに有料プランをお使いです。プランの変更は「支払いと解約」からできます。",
};

export default function AccountPlan() {
  const [st, setSt] = useState({ state: "loading", data: null });
  const [cycle, setCycle] = useState("month");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [aws, setAws] = useState(null);   // 本物の AWS の今月の時間（有料の人だけ）
  const q = window.location.hash.split("?")[1] || "";
  const notice = q.includes("billing=success") ? "ok" : q.includes("billing=addon") ? "addon" : q.includes("billing=cancel") ? "cancel" : "";

  const load = () => {
    setSt(s => ({ ...s, state: "loading" }));
    apiGet("/billing/me").then(d => setSt({ state: "ok", data: d }), () => setSt({ state: "error", data: null }));
  };
  useEffect(load, []);
  useEffect(() => {
    if (st.data?.plan !== "pro" && st.data?.plan !== "proplus") return;
    apiGet("/cloudlab/session").then(r => setAws(r?.awsMinutes || null), () => setAws(null));
  }, [st.data?.plan]);
  // 支払いのあとは、Stripe からの通知が届くまで少しかかる。数回だけ読み直す
  useEffect(() => {
    if (notice !== "ok" || st.state !== "ok" || st.data?.plan !== "free") return undefined;
    let n = 0;
    const t = setInterval(() => { n += 1; apiGet("/billing/me").then(d => { if (d?.plan !== "free" || n >= 6) { clearInterval(t); setSt({ state: "ok", data: d }); } }).catch(() => {}); }, 2500);
    return () => clearInterval(t);
  }, [notice, st.state, st.data?.plan]);

  async function go(path, body, key) {
    setBusy(key); setMsg("");
    try {
      const r = await apiPost(path, body);
      if (r?.url) { window.location.assign(r.url); return; }
      setMsg("うまくいきませんでした。もう一度お試しください。");
    } catch (e) {
      setMsg(ERR[e?.data?.error || e?.body?.error || ""] || ERR[String(e?.message || "")] || "うまくいきませんでした。もう一度お試しください。");
    }
    setBusy("");
  }

  if (st.state === "loading") return <div className="ap"><p className="muted">読み込んでいます…</p></div>;
  if (st.state === "error") return (
    <div className="ap"><div className="card ap-err"><b>プランを確かめられませんでした</b><button type="button" className="btn ghost" onClick={load}>もう一度読み込む</button></div></div>
  );
  const d = st.data || {};
  const paid = d.plan === "pro" || d.plan === "proplus";

  return (
    <div className="ap">
      <span className="eyebrow">ACCOUNT</span>
      <h1 className="h1">プランと支払い</h1>
      {notice === "ok" && <div className="ap-note ok" role="status">{paid ? `${NAME[d.plan]} になりました。` : "お支払いを確かめています…"}</div>}
      {notice === "cancel" && <div className="ap-note" role="status">お支払いは取りやめました。</div>}
      {notice === "addon" && <div className="ap-note ok" role="status">時間を買い足しました。反映まで少しかかることがあります。</div>}
      {d.unknown && <div className="ap-note" role="status">契約を確かめられませんでした。時間をおいて読み込み直してください。</div>}

      <section className="card ap-now">
        <div><span className="ap-k">いまのプラン</span><b className="ap-plan">{NAME[d.plan] || "無料"}</b></div>
        {paid && <div><span className="ap-k">{d.cancelAtPeriodEnd ? "使える期限" : "次の請求日"}</span><b>{day(d.currentPeriodEnd)}</b>{d.cancelAtPeriodEnd && <small>この日で無料に戻ります</small>}</div>}
        {paid && aws && <div><span className="ap-k">本物の AWS（今月の残り）</span><b>{Math.floor(aws.left / 60)}時間{aws.left % 60 ? ` ${aws.left % 60}分` : ""}</b><small>月 {Math.round((aws.limit + aws.extra) / 60)}時間まで</small></div>}
        {paid && d.status === "past_due" && <div className="ap-warn">お支払いを確かめられませんでした。カードを確かめてください。</div>}
        {d.hasCustomer && <button type="button" className="btn ghost" disabled={!!busy} onClick={() => go("/billing/portal", {}, "portal")}>{busy === "portal" ? "開いています…" : "支払いと解約"}</button>}
      </section>

      {paid && (
        <section className="card ap-add">
          <div><b>本物の AWS の時間を買い足す</b><small>今月だけ使えます（月が変わると残りは消えます）</small></div>
          <div className="ap-add-btns">
            {ADDONS.map(a => (
              <button key={a.hours} type="button" className="btn ghost" disabled={!!busy} onClick={() => go("/billing/addon", { hours: a.hours }, `add${a.hours}`)}>
                {busy === `add${a.hours}` ? "開いています…" : <>＋{a.hours}時間<small>{yen(a.price)}</small></>}
              </button>
            ))}
          </div>
        </section>
      )}

      {!paid && <>
        <div className="ap-cycle" role="group" aria-label="支払いの単位">
          <button type="button" aria-pressed={cycle === "month"} onClick={() => setCycle("month")}>月額</button>
          <button type="button" aria-pressed={cycle === "year"} onClick={() => setCycle("year")}>年額<small>2か月分おトク</small></button>
        </div>
        <div className="ap-plans">
          {PLANS.map(p => (
            <article key={p.id} className={`card ap-p${p.id === "pro" ? " pick" : ""}`}>
              {p.id === "pro" && <span className="ap-flag">おすすめ</span>}
              <b className="ap-pn">{p.name}</b>
              <div className="ap-price">{yen(cycle === "month" ? p.month : p.year)}<small>/ {cycle === "month" ? "月" : "年"}・税込</small></div>
              {cycle === "year" && <small className="muted">月あたり {yen(Math.round(p.year / 12))}</small>}
              <ul>{p.feats.map(f => <li key={f}>{f}</li>)}</ul>
              <button type="button" className={`btn${p.id === "pro" ? "" : " ghost"}`} disabled={!!busy} onClick={() => go("/billing/checkout", { plan: p.id, interval: cycle }, p.id)}>
                {busy === p.id ? "支払いの画面を開いています…" : `${p.name} にする`}
              </button>
            </article>
          ))}
        </div>
        <p className="muted ap-fine">お支払いは Stripe の画面で行います（カード番号はこちらに届きません）。いつでも解約でき、解約すると次の更新日から無料に戻ります。日割りの返金はありません。個人プランは会社での利用はできません。</p>
      </>}
      {msg && <div className="ap-note ng" role="alert">{msg}</div>}
    </div>
  );
}
