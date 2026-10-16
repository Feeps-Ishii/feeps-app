import React, { useCallback, useEffect, useRef, useState } from "react";
import "./brief.css";

/* 案件の説明（参画する前に読む。2026-10-16、モック docs/design/mockups/devhub-learning-2026-10/devhub-case-onboarding.html）
   流れ：案件の概要（会社・システム・経緯）→ 現状（問題・課題）→ 修正内容／要件を聞き出す → あなたの担当 → 関係者・メンバー → 参画する
   中身は案件の project.brief（無い項目は ticket・project の今までの項目から作る）。どの案件も同じ「動く図」で見せる：
   枠（ブラウザ風）・箱がバネで出る・黄色のマーカー・線が伸びる・吹き出し。「もう一度」で動かし直せる */

// 線画のアイコン（24×24）
const P = {
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  yen: '<path d="M7 4l5 7 5-7M12 11v9M8 13h8M8 16.5h8"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  db: '<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/>',
  medal: '<circle cx="12" cy="14" r="5"/><path d="M8.5 9.5L6 3h4l2 4 2-4h4l-2.5 6.5"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  mail: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  store: '<path d="M4 9l1.5-5h13L20 9"/><path d="M5 9v11h14V9M10 20v-5h4v5"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
  users: '<circle cx="9" cy="9" r="3"/><path d="M3.8 19c.6-3 2.8-4.6 5.2-4.6s4.6 1.6 5.2 4.6M15.5 6.3a3 3 0 010 5.4M17 14.6c1.6.6 2.6 2 3 4.4"/>',
  form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>',
  cart: '<path d="M3 4h2.5l2 11h10.5l2-8H6.5"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h2"/>',
  server: '<rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M8 7.5h.01M8 16.5h.01"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M15 9v11"/>',
  table: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M3 14.5h18M9 5v14"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  layers: '<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>',
};
export function Ic({ n, size = 22 }) {
  return <svg className="bf-ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: P[n] || P.box }} />;
}

/* ---- 動かす仕組み：steps 個の段を gap ミリ秒ごとに足していく（p1 p2 …）。動きを減らす設定なら最後の形 ---- */
const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function useStage(steps, gap = 850) {
  const [n, setN] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (reduceMotion()) { setN(steps); return undefined; }
    setN(0);
    const ts = Array.from({ length: steps }, (_, i) => setTimeout(() => setN(i + 1), 350 + i * gap));
    return () => ts.forEach(clearTimeout);
  }, [steps, gap, run]);
  const cls = Array.from({ length: n }, (_, i) => `p${i + 1}`).join(" ");
  return [cls, n, () => setRun(r => r + 1)];
}
function Count({ to, from = 0, on, comma }) {
  const [v, setV] = useState(from);
  useEffect(() => {
    if (!on) { setV(from); return undefined; }
    if (reduceMotion()) { setV(to); return undefined; }
    let raf, t0;
    const tick = t => { t0 ??= t; const p = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - p, 3); setV(from + (to - from) * e); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, to, from]);
  const r = Math.round(v);
  return <>{comma ? r.toLocaleString("ja-JP") : r}</>;
}
function Demo({ url, cls, onReplay, className = "", children }) {
  return (
    <div className={`bf-demo ${cls} ${className}`}>
      {url != null && <div className="bf-bar"><i /><i /><i /><span className="url">{url}</span><button type="button" className="bf-replay" onClick={onReplay}>もう一度</button></div>}
      <div className="bf-body">{children}</div>
    </div>
  );
}
const Who = ({ who }) => <span className={`bf-av ${who}`}>{{ client: "客", pm: "PM", lead: "L", me: "あ" }[who] || "・"}</span>;
function Say({ who = "pm", name, children }) {
  return <div className={`bf-say ${who}`}><Who who={who} /><div className="bub"><small>{name}</small>{children}</div></div>;
}
const NAMES = { pm: "PM（AI）", lead: "リーダー（AI）", client: "お客さま（AI）" };

/* ---- 1 案件の概要：会社 ---- */
function CompanyPage({ b, item }) {
  const c = b.company || {};
  const stats = (c.stats || []).slice(0, 3);
  const [cls, n, replay] = useStage(stats.length + 1, 850);
  return (
    <>
      <h2>{c.catch || `${c.name || item.ticket?.client || "お客さま"}の案件です`}</h2>
      {stats.length > 0 && (
        <Demo url={`${c.name || "お客さま"} ／ 会社のこと`} cls={cls} onReplay={replay}>
          <div className="bf-tiles" style={{ "--n": stats.length }}>
            {stats.map((s, i) => (
              <div key={i} className={`bf-tile ${n > i ? "on" : ""}`}>
                <small>{s.label}</small>
                <b><Count to={Number(s.value) || 0} on={n > i} comma={Number(s.value) >= 1000} /><em>{s.unit}</em></b>
                {s.icon && <span className="minis">{Array.from({ length: Math.min(24, Number(s.dots) || 0) }, (_, k) => <i key={k} style={{ "--d": `${k * 25}ms` }}><Ic n={s.icon} size={16} /></i>)}</span>}
                {s.meter && <span className="meter"><i style={{ width: n > i ? `${Math.min(100, Number(s.value))}%` : 0 }} /></span>}
                {s.note && <span className="note">{s.note}</span>}
              </div>
            ))}
          </div>
          {c.owner && <div className={`bf-float fl-bl ${n > stats.length ? "on" : ""}`}><Who who="client" />{c.owner}</div>}
        </Demo>
      )}
      <div className="bf-two">
        {(c.points || []).length > 0 && <div className="bf-box"><div className="h">どんな会社か</div><ul>{c.points.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        {c.quote && <Say who="client" name={c.quoteBy || NAMES.client}>{c.quote}</Say>}
      </div>
    </>
  );
}

/* ---- 1 案件の概要：システム ---- */
function SystemPage({ b }) {
  const s = b.system || {};
  const lanes = (s.lanes || []).slice(0, 3);
  const all = lanes.flatMap(l => l.nodes || []);
  const [cls, n, replay] = useStage(all.length + 1, 700);
  let k = 0;
  return (
    <>
      <h2>{s.headline || "使っているシステム"}</h2>
      <Demo url={`${s.name || "システム"} ／ 処理の流れ`} cls={cls} onReplay={replay}>
        <div className="bf-lanes">
          {lanes.map((l, li) => (
            <div key={li} className="bf-lane">
              <span className="lbl">{l.label}</span>
              <div className="nodes">
                {(l.nodes || []).map((nd, i) => { const at = ++k; return (
                  <React.Fragment key={i}>
                    {i > 0 && <span className={`ln ${n >= at ? "on" : ""}`}><i /></span>}
                    <div className={`nd ${n >= at ? "on" : ""} ${nd.key && n >= at ? "key" : ""}`}><Ic n={nd.icon || "box"} /><b>{nd.title}</b>{nd.sub && <small>{nd.sub}</small>}</div>
                  </React.Fragment>
                ); })}
              </div>
            </div>
          ))}
        </div>
        {s.note && <div className={`bf-float fl-br ${n > all.length ? "on" : ""}`}><Who who="lead" />{s.note}</div>}
      </Demo>
      {s.lead && <Say who="lead" name={NAMES.lead}>{s.lead}</Say>}
    </>
  );
}

/* ---- 1 案件の概要：経緯 ---- */
function HistoryPage({ b }) {
  const h = b.history || {};
  const items = (h.items || []).slice(0, 7);
  const [cls, n, replay] = useStage(items.length, 700);
  return (
    <>
      <h2>{h.headline || "これまでの経緯"}</h2>
      <Demo url="これまでのあゆみ" cls={cls} onReplay={replay}>
        <div className="bf-tl" style={{ "--n": items.length }}>
          <div className="track"><i style={{ transform: `scaleX(${items.length > 1 ? Math.max(0, n - 1) / (items.length - 1) : 1})` }} /></div>
          {items.map((it, i) => (
            <div key={i} className={`ms ${it.kind || ""} ${n > i ? "on" : ""}`}><span className="dot"><Ic n={it.icon || "doc"} size={18} /></span><b>{it.when}</b><strong>{it.title}</strong>{it.sub && <small>{it.sub}</small>}</div>
          ))}
        </div>
      </Demo>
      {((h.before || []).length > 0 || (h.after || []).length > 0) && (
        <div className="bf-ba">
          <div className="b0"><b>{h.beforeLabel || "前は"}</b><ul>{(h.before || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          <span className="arr">→</span>
          <div className="b1"><b>{h.afterLabel || "いまは"}</b><ul>{(h.after || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        </div>
      )}
      {h.quote && <Say who="client" name={NAMES.client}>{h.quote}</Say>}
    </>
  );
}

/* ---- 2 現状：問題（画面・連絡・影響） ---- */
function ProblemPage({ b, item }) {
  const p = b.problem || {};
  const sc = p.screen || null;
  const [cls, n, replay] = useStage(3, 1000);
  return (
    <>
      <h2>{p.headline || item.project?.story?.now || item.title}</h2>
      <div className="bf-prob">
        {sc && (
          <Demo url={sc.url || "お客さまの画面"} cls={cls} onReplay={replay} className="bf-screen">
            <div className="scr">
              {sc.title && <div className="st">{sc.title}{sc.id && <em>{sc.id}</em>}</div>}
              {sc.badge && <div className={`badge ${n >= 2 ? "on" : ""}`}><small>{sc.badgeLabel || ""}</small><b>{sc.badge}</b>{sc.flash && <span className="flash">{sc.flash}</span>}</div>}
              {(sc.rows || []).map((r, i) => <div key={i} className={`row ${r.bad && n >= 2 ? "bad" : ""}`}><span>{r.label}</span><b>{r.count != null ? <>{r.prefix}<Count to={Number(r.count)} from={Number(r.from || 0)} on={n >= 1} comma />{r.suffix}</> : r.value}</b></div>)}
            </div>
            {p.voice && <div className={`bf-float fl-bc ${n >= 3 ? "on" : ""}`}><Who who="client" />{p.voice}</div>}
          </Demo>
        )}
        <div className="side">
          {p.mail && <div className="bf-mail"><div className="mh"><b>{p.mail.subject}</b><span>{p.mail.from}</span></div><div className="mb">{p.mail.body}</div></div>}
          {(p.impacts || []).length > 0 && <div className="bf-kpis">{p.impacts.map((x, i) => <div key={i}><small>{x.label}</small><b>{x.value}</b></div>)}</div>}
        </div>
      </div>
    </>
  );
}

/* ---- 2 現状：課題（期待と実際の比べ・問題→原因→課題） ---- */
function IssuePage({ b, item }) {
  const s = b.issue || {};
  const rows = (s.compare || []).slice(0, 5);
  const [cls, n, replay] = useStage(rows.length + 3, 650);
  const cards = [["問題", s.problem || item.project?.story?.problem, "p"], ["原因の見立て", s.cause, "c"], ["課題", s.task || item.project?.story?.goal, "k"]].filter(c => c[1]);
  return (
    <>
      <h2>{s.headline || "何が問題で、何をすればよいか"}</h2>
      {rows.length > 0 && (
        <Demo url={s.compareTitle || "期待と実際"} cls={cls} onReplay={replay}>
          <div className="bf-cmp">
            <div className="hd"><span>{s.compareLabel || "入力"}</span><span>期待</span><span>いま</span></div>
            {rows.map((r, i) => (
              <div key={i} className={`r ${n > i ? "on" : ""} ${r.ng && n > i ? "ng" : ""}`}><span className="k">{r.input}</span><span className="e">{r.expected}</span><span className="a">{r.actual}{r.ng ? " ✕" : " ○"}</span></div>
            ))}
          </div>
        </Demo>
      )}
      <div className={`bf-issues ${rows.length ? "" : "solo"}`}>{cards.map(([k, v, c], i) => <div key={k} className={`is ${c} ${!rows.length || n > rows.length + i ? "on" : ""}`}><span>{k}</span><b>{v}</b></div>)}</div>
    </>
  );
}

/* ---- 3 修正内容（決まっている案件）：どう直したいかだけ（答えは書かない） ---- */
function WantsPage({ b, item }) {
  const w = b.wants || {};
  const [cls, n, replay] = useStage(3, 900);
  const items = (w.items || []).length ? w.items : (item.ticket?.scope || []).map(t => ({ icon: "check", title: t, tag: "やる" }));
  return (
    <>
      <h2>{w.headline || "お客さまは、こう直してほしいと言っています"}</h2>
      <Say who="pm" name={NAMES.pm}>{w.pm || "どこをどう直すかは、チケットに入ってから自分で調べてください。"}</Say>
      {w.before && w.after && (
        <Demo cls={cls} onReplay={replay} className="bf-want">
          <div className="wc w1"><small>いま</small><div className="mc bad"><span>{w.before.label}</span><b>{w.before.value}</b></div>{w.before.note && <p>{w.before.note}</p>}</div>
          <span className="warr">→</span>
          <div className="wc w2"><small>直したあと</small><div className="flip"><div className="mc bad back"><span>{w.before.label}</span><b>{w.before.value}</b></div><div className="mc good front"><span>{w.after.label}</span><b>{w.after.value}</b></div></div>{w.after.note && <p>{w.after.note}</p>}</div>
          {(w.keep || []).length > 0 && <div className="wc w3"><small>変えないこと</small><ul>{w.keep.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
          <button type="button" className="bf-replay solo" onClick={replay}>もう一度</button>
        </Demo>
      )}
      <div className="bf-reqs">{items.slice(0, 6).map((x, i) => <div key={i} className={`rq ${x.tag === "別件" || x.tag === "変えない" ? "other" : ""}`}><Ic n={x.icon || "check"} size={24} /><b>{x.title}</b>{x.tag && <span className={`pri ${x.tag === "別件" || x.tag === "変えない" ? "o" : "m"}`}>{x.tag}</span>}</div>)}</div>
    </>
  );
}

/* ---- 3 要件を聞き出す案件：何を聞くか（答えはこのあとの「ヒアリング」で） ---- */
function HearPage({ item }) {
  const pj = item.project || {};
  const qs = pj.hearing || [];
  const [cls, n, replay] = useStage(qs.length + 1, 650);
  return (
    <>
      <h2>まだ決まっていないことを、お客さまに聞いて決めます</h2>
      <Say who="pm" name={NAMES.pm}>{pj.mode === "done" ? "お客さまへの聞き取りは終わっています。決まった内容を、チケットに入ってから確かめてください。" : "細かいところがまだ決まっていません。チケットに入ったら、まずお客さまに聞いて要件をはっきりさせましょう。"}</Say>
      <Demo url="ヒアリングで聞くこと" cls={cls} onReplay={replay}>
        <div className="bf-hear">
          <div className="req"><Who who="client" /><p>{pj.request || item.ticket?.background}</p></div>
          <ul>{qs.map((h, i) => <li key={i} className={n > i ? "on" : ""}><span>?</span>{h.q}</li>)}</ul>
        </div>
        <div className={`bf-float fl-br ${n > qs.length ? "on" : ""}`}><Who who="pm" />聞いた内容が、そのまま仕様になります</div>
      </Demo>
    </>
  );
}

/* ---- 4 あなたの担当（工程の V 字を順にたどる） ---- */
const PHASES = [["req", "要件定義"], ["basic", "基本設計"], ["detail", "詳細設計"], ["impl", "実装"], ["unit", "単体テスト"], ["it", "結合テスト"], ["st", "総合テスト"], ["uat", "受入テスト"]];
const DEF = { req: "done", basic: "done", detail: "pm", impl: "me", unit: "me", it: "lead", st: "pm", uat: "client" };
const WHO = { client: "お客さま", pm: "PM", lead: "リーダー", me: "あなた", done: "済み" };
const ROW = [1, 2, 3, 4, 4, 3, 2, 1];
function RolePage({ b, item }) {
  const pj = item.project || {};
  const ph = { ...DEF, ...(pj.phases || {}) };
  const r = b.role || {};
  const [cls, n, replay] = useStage(PHASES.length + 1, 450);
  const mine = PHASES.filter(([k]) => ph[k] === "me").map(p => p[1]);
  const t = item.ticket || {};
  const cards = [["pencil", "やること", r.tasks || (t.scope || []).join(" ・ ")], ["box", "出すもの", r.deliverables || "直したコード ・ テストの結果 ・ プルリク"], ["check", "完了の条件", r.done || (t.done || []).slice(0, 3).join(" ・ ")], ["clock", "目安", r.deadline || (item.hours ? `約${item.hours}時間` : "")]].filter(c => c[2]);
  return (
    <>
      <h2>{r.headline || `あなたは「${pj.role || "開発メンバー"}」として、${mine.join("と")}を受け持ちます`}</h2>
      <Demo url="開発の工程と担当" cls={cls} onReplay={replay}>
        <div className="bf-v">{PHASES.map(([k, label], i) => <div key={k} className={`vs v-${ph[k]} ${n > i ? "on" : ""}`} style={{ gridColumn: i + 1, gridRow: ROW[i] }}><b>{label}</b><small>{WHO[ph[k]]}</small></div>)}</div>
        <div className={`bf-float fl-br ${n > PHASES.length ? "on" : ""}`}><Who who="me" />{mine.join("と")}があなたの担当</div>
      </Demo>
      <div className="bf-roles">{cards.map(([ic, k, v]) => <div key={k}><Ic n={ic} /><b>{k}</b><small>{v}</small></div>)}</div>
    </>
  );
}

/* ---- 5 関係者とメンバー ---- */
function MembersPage({ b, item }) {
  const client = item.ticket?.client || "お客さま";
  const base = [
    { who: "client", name: client, role: "お客さま", job: "今回の依頼主", about: "業務の決まりや、困っていることはこの人に", ask: "業務の決まり ・ 受入の確認" },
    { who: "pm", name: "PM", role: "プロジェクトマネージャー", job: "お客さまとの窓口。進め方と期限を決める", about: "迷ったら、まず全体の話をしてくれる", ask: "期限 ・ 範囲 ・ お客さまとの調整" },
    { who: "lead", name: "リーダー", role: "技術の責任者", job: "コードのレビューと結合テスト", about: "このシステムをよく知っている。コードのことは何でも聞ける", ask: "書き方 ・ テスト ・ どこを直すか" },
    { who: "me", name: "あなた", role: item.project?.role || "開発メンバー", job: "今日から参画", about: "分からないことは早めに聞くのが一番", ask: "" },
  ];
  const list = base.map(m => ({ ...m, ...((b.members || []).find(x => x.who === m.who) || {}) }));
  return (
    <>
      <h2>一緒に進める人たち</h2>
      <div className="bf-members">{list.map((m, i) => (
        <div key={m.who} className={`mc ${m.who === "me" ? "me" : ""}`} style={{ animationDelay: `${i * 120}ms` }}>
          <div className="top"><Who who={m.who} /><span><b>{m.name}</b><small>{m.role}</small></span>{m.who !== "me" && <em>AI</em>}</div>
          <p className="job">{m.job}</p><p className="about">{m.about}</p>{m.ask && <p className="ask">聞いていいこと：{m.ask}</p>}
        </div>
      ))}</div>
    </>
  );
}

/* ---- 6 参画する ---- */
function JoinPage({ item, accepted, busy, onJoin, onLater }) {
  const t = item.ticket || {};
  const pj = item.project || {};
  return (
    <>
      <h2>{accepted ? "この案件に参画しています" : "この案件に参画しますか？"}</h2>
      <div className="bf-join">
        <div className="jc">
          <div className="jh">{t.id && <span className="mono">{t.id}</span>}<b>{item.title}</b></div>
          <dl>
            <dt>お客さま</dt><dd>{t.client || "－"}</dd>
            <dt>あなたの役割</dt><dd>{pj.role || "開発メンバー"}</dd>
            <dt>{pj.mode === "fixed" ? "直すこと" : "まずやること"}</dt><dd>{pj.mode === "fixed" ? (pj.story?.goal || item.summary) : "お客さまに聞いて要件を決める"}</dd>
            {item.hours ? <><dt>目安</dt><dd>約{item.hours}時間</dd></> : null}
            <dt>相談先</dt><dd>技術はリーダー、決まり・お客さまのことは PM</dd>
          </dl>
        </div>
        <div className="jact">
          <Say who="pm" name={NAMES.pm}>{accepted ? "参画ありがとうございます。チケットから進めてください。" : "説明は以上です。準備ができたら参画してください。チケットの画面から仕事が始まります。"}</Say>
          <button type="button" className="btn go bf-big" onClick={onJoin} disabled={busy}>{accepted ? "チケットへ" : busy ? "参画しています…" : "参画する"}</button>
          {!accepted && <button type="button" className="btn ghost" onClick={onLater}>あとで（案件体験の一覧へ）</button>}
        </div>
      </div>
    </>
  );
}

/* ---- 目次と本体 ---- */
export default function CaseBrief({ item, accepted, busy, onJoin, onLater }) {
  const b = item.project?.brief || {};
  const pj = item.project || {};
  const fixed = (pj.mode || "fixed") === "fixed";
  const pages = [
    b.company && ["co", "1 案件の概要", "お客さまの会社", () => <CompanyPage b={b} item={item} />],
    b.system && ["sys", "1 案件の概要", "使っているシステム", () => <SystemPage b={b} />],
    b.history && ["hist", "1 案件の概要", "これまでの経緯", () => <HistoryPage b={b} />],
    ["prob", "2 現状", "いま起きていること", () => <ProblemPage b={b} item={item} />],
    ["issue", "2 現状", "課題", () => <IssuePage b={b} item={item} />],
    fixed ? ["fix", "3 修正内容", "修正内容", () => <WantsPage b={b} item={item} />] : ["hear", "3 要件を聞き出す", "聞いて決めること", () => <HearPage item={item} />],
    ["role", "4 あなたの担当", "あなたの担当と役割", () => <RolePage b={b} item={item} />],
    ["mem", "5 関係者・メンバー", "関係者とメンバー", () => <MembersPage b={b} item={item} />],
    ["join", "6 参画", accepted ? "参画済み" : "参画する", () => <JoinPage item={item} accepted={accepted} busy={busy} onJoin={onJoin} onLater={onLater} />],
  ].filter(Boolean);
  const KEY = `tl-case-brief-${item.id}`;
  // 参画済みでも、いつでも最初から読み返せる（2026-10-16）
  const [k, setK] = useState(0);
  const [read, setRead] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } });
  const top = useRef(null);
  const go = useCallback(next => {
    setRead(r => { const v = { ...r, [pages[k][0]]: true }; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 覚えられなくても進める */ } return v; });
    setK(next);
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [k, pages, KEY]);
  const Page = pages[Math.min(k, pages.length - 1)][3];
  let grp = "";
  return (
    <div className="bf" ref={top}>
      <nav className="bf-nav" aria-label="案件の説明の目次">
        <div className="ttl"><small>案件の説明</small><b>{item.title}</b></div>
        {pages.map(([id, g, t], i) => {
          const head = g !== grp ? <div className="grp">{g}</div> : null; grp = g;
          return <React.Fragment key={id}>{head}<button type="button" className={read[id] ? "done" : ""} aria-current={i === k ? "step" : undefined} onClick={() => go(i)}><span className="n">{read[id] ? "✓" : i + 1}</span>{t}</button></React.Fragment>;
        })}
      </nav>
      <div className="bf-page">
        <div className="bf-prog"><small>{k + 1} / {pages.length}</small><span><i style={{ width: `${(k + 1) / pages.length * 100}%` }} /></span></div>
        <div className="bf-content" key={pages[k][0]}><Page /></div>
        <div className="bf-foot"><button type="button" className="btn ghost" onClick={() => go(Math.max(0, k - 1))} disabled={k === 0}>◀ 戻る</button><span className="sp" />{accepted && k < pages.length - 1 && <button type="button" className="btn ghost" onClick={onJoin}>チケットへ</button>}{k < pages.length - 1 && <button type="button" className="btn go" onClick={() => go(k + 1)}>次へ ▶</button>}</div>
      </div>
    </div>
  );
}
