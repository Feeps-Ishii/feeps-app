import React from "react";
import "./steps.css";

/* 学ぶ → 試す → 実践 → 本物の環境（2026-11-19、モック docs/design/mockups/tenolab-2026-09/tenolab-nav.html）
   - StepTabs：受講生のヘッダーのタブ（アイコン＋動詞＋名前。AWS実習は4つ目）
   - PageBand：各画面の一番上の帯（見出し・やることの流れ・自分の数字）と、右の利用イメージ
   - NextStep：画面の下で次の段へ
   利用イメージの絵は固定（どの画面か伝えるためのもの）。下の段だけ本人のデータを出す */

export const STEPS = [
  { k: "courses", no: 1, verb: "学ぶ", name: "コース", page: "コース一覧", cls: "s1", href: "#/courses" },
  { k: "drills", no: 2, verb: "試す", name: "演習", page: "演習一覧", cls: "s2", href: "#/drills" },
  { k: "cases", no: 3, verb: "実践", name: "案件体験", page: "案件体験", cls: "s3", href: "#/cases" },
  { k: "aws", no: 4, verb: "本物の環境", name: "AWS実習", page: "AWS実習", cls: "s4", href: "#/aws" },
];

const svg = (children, extra = {}) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{children}</svg>;
const ICON = {
  home: svg(<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />, { strokeWidth: 2 }),
  courses: svg(<><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M10 9l4 2-4 2z" /></>),
  drills: svg(<path d="m8 8-4 4 4 4M16 8l4 4-4 4" />),
  cases: svg(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>),
  aws: svg(<path d="M7 18h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 9.1 4.5 4.5 0 0 0 7 18z" />),
};
const CHK = <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5.2l2 2L8 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/* ヘッダーのタブ。nav は [key, label, href] の並び（ホームと、ある段だけ） */
export function StepTabs({ nav, section }) {
  const keys = new Set(nav.map(n => n[0]));
  const steps = STEPS.filter(s => keys.has(s.k));
  return (
    <nav className="nav stp-nav" aria-label="画面">
      {keys.has("home") && <a href="#/home" className="stp-tab hm" aria-current={section === "home" ? "page" : undefined}><span className="ic">{ICON.home}</span><span className="lb"><b>ホーム</b></span></a>}
      {steps.map((s, i) => (
        <React.Fragment key={s.k}>
          {i > 0 && <span className="sep" aria-hidden="true">›</span>}
          <a href={s.href} className={`stp-tab ${s.cls}`} aria-current={section === s.k ? "page" : undefined}>
            <span className="ic">{ICON[s.k]}</span><span className="lb"><small>{s.verb}</small><b>{s.name}</b></span>
          </a>
        </React.Fragment>
      ))}
    </nav>
  );
}

/* 一番上の帯。nums は [ラベル, 値, 分母?] か、文字だけの「いま」の印 */
export function PageBand({ k, headline, flow, nums, scene }) {
  const s = STEPS.find(x => x.k === k);
  return (
    <section className={`stp-band ${s.cls}`} aria-label={s.page}>
      <div className="stp-in">
        <div className="stp-l">
          <div className="stp-ey"><span className={`stp-badge ${s.cls}`}><span className="no">{s.no}</span>{s.verb}</span><span className="pg">{s.page}</span></div>
          <h1>{headline}</h1>
          <ol className="stp-flow">{flow.map((f, i) => <React.Fragment key={f}>{i > 0 && <span className="ar" aria-hidden="true">→</span>}<li><i>{i + 1}</i>{f}</li></React.Fragment>)}</ol>
          {nums && <div className="stp-nums">{nums}</div>}
        </div>
        {scene}
      </div>
    </section>
  );
}
export const Mk = ({ children }) => <span className="stp-mk">{children}</span>;

/* 利用イメージのカード：上が絵、下が本人の続き */
function Scene({ cls, view, children }) {
  return <div className={`stp-scn ${cls}`}><div className={`stp-vw ${view[0]}`} aria-hidden="true">{view[1]}</div><div className="stp-act">{children}</div></div>;
}
export const ActGo = ({ onClick, children }) => <button type="button" className="go" onClick={onClick}>{children}</button>;

export function CourseScene({ children }) {
  return (
    <Scene cls="s1" view={["stp-deck", <>
      <div className="stp-slide">
        <div className="sh"><i>03</i>変数は、名前のついた箱</div>
        <div className="sb"><span className="box"><em>price</em>300</span><span className="la">←</span><code><span className="k">let</span> price = <span className="n">300</span>;</code></div>
        <div className="pg"><i /><i /><i className="on" /><i /><i /><span>12 / 20</span></div>
      </div>
      <div className="stp-quiz"><span className="q">確認問題</span><span className="qt">price の中身は？</span><span className="op ok">300 ✓</span><span className="op">"price"</span></div>
    </>]}>{children}</Scene>
  );
}

export function DrillScene({ children }) {
  return (
    <Scene cls="s2" view={["stp-ed", <>
      <div className="tb"><span className="fn">Main.java</span><span className="run"><svg viewBox="0 0 8 8"><path d="M1 0.5v7l6-3.5z" fill="currentColor" /></svg>実行</span></div>
      <pre className="src"><span className="l"><span className="k">int</span> apples = <span className="n">17</span>;</span><span className="l"><span className="k">int</span> box = <span className="n">5</span>;</span><span className="l">System.out.<span className="f">println</span>(apples / box);</span><span className="l cur">System.out.<span className="f">println</span>(apples % box);<span className="caret" /></span></pre>
      <div className="out"><span className="pr">出力</span><span className="v">3&nbsp;&nbsp;2</span><span className="ck"><i>{CHK}</i><i>{CHK}</i><i>{CHK}</i></span><span className="pass">クリア</span></div>
    </>]}>{children}</Scene>
  );
}

export function CaseScene({ children }) {
  return (
    <Scene cls="s3" view={["stp-case", <>
      <div className="stp-msg from-c"><span className="av">店</span><span className="bb"><small>依頼</small><span className="tx">送信を押しても、何も起きません。</span></span></div>
      <div className="stp-diff"><div className="fh">reserve.js<em>−1</em><span>+2</span></div>
        <div className="ln del">- form.onsubmit = send;</div>
        <div className="ln add">+ form.onsubmit = (e) =&gt; {"{"}</div>
        <div className="ln add">+   e.preventDefault(); send(); {"};"}</div></div>
      <div className="stp-msg from-r"><span className="av">講</span><span className="bb"><small>レビュー</small><span className="tx">原因の見つけ方が良いです。</span></span></div>
    </>]}>{children}</Scene>
  );
}

/* 案件の進み（依頼 › 修正 › 提出 › レビュー）。at＝いまの段（0〜3） */
export function CaseSteps({ at }) {
  const names = ["依頼", "修正", "提出", "レビュー"];
  return (
    <span className="stp-csteps" aria-label={`いまは「${names[at]}」`}>
      {names.map((n, i) => <React.Fragment key={n}>{i > 0 && <span className="ar" aria-hidden="true">›</span>}<span className={i < at ? "ok" : i === at ? "now" : "later"}><i>{i < at ? CHK : null}</i><span className={i < at ? "t done-t" : "t"}>{n}</span></span></React.Fragment>)}
    </span>
  );
}

/* 画面の下：いまの段と、次の段へ */
export function NextStep({ k, hasAws, go }) {
  const steps = STEPS.filter(s => s.k !== "aws" || hasAws);
  const i = steps.findIndex(s => s.k === k);
  const nx = steps[i + 1];
  if (!nx) return null;
  const cur = steps[i];
  return (
    <div className={`stp-next ${cur.cls}`}>
      <div className="trail">{steps.map((s, j) => <React.Fragment key={s.k}>{j > 0 && <span className="ar" aria-hidden="true">›</span>}<span className={`${s.cls} ${s.k === k ? "on" : ""}`}><i />{s.verb}</span></React.Fragment>)}</div>
      <button type="button" className={`go ${nx.k === "aws" ? "night" : ""}`} onClick={() => go(nx.href)}>{nx.verb}：{nx.name} →</button>
    </div>
  );
}
