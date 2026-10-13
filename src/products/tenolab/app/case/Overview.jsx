import React, { useState } from "react";

/* 案件体験の最初の画面（概要）とヒアリング（2026-10-13）
   モック docs/design/mockups/devhub-learning-2026-10/devhub-case-overview.html・devhub-aws-hearing.html
   - 概要：いま／困っていること／ゴール、V字のどこに参画するか、立場と体制、仕様の要点、実装方針（決まっている・お客さまに確認）
   - ヒアリング：聞き出すこと（確認済みは答えも）、提案、決まった方針（お客さまの指定で変わったときはそれも）
   - 聞き出し済み：まとめを上に、会話は「会話を見る」で */

export const PHASES = [
  ["req", "要件定義"], ["basic", "基本設計"], ["detail", "詳細設計"], ["impl", "実装"],
  ["unit", "単体テスト"], ["it", "結合テスト"], ["st", "総合テスト"], ["uat", "受入テスト"],
];
const DEFAULT_PHASES = { req: "done", basic: "done", detail: "pm", impl: "me", unit: "me", it: "lead", st: "pm", uat: "client" };
const WHO = { client: "お客さま", pm: "PM", lead: "リーダー", me: "あなた", done: "済み" };
const POS = { req: [70, 40], basic: [130, 110], detail: [190, 180], impl: [250, 250], unit: [390, 250], it: [450, 180], st: [510, 110], uat: [570, 40] };
const PAIRS = [["req", "uat"], ["basic", "st"], ["detail", "it"], ["impl", "unit"]];
export const MODE_LABEL = { fixed: "実装だけ", ask: "聞き出して提案", turn: "聞き出して提案", done: "聞き出し済み" };

export function VModel({ phases }) {
  const ph = { ...DEFAULT_PHASES, ...(phases || {}) };
  const mine = PHASES.filter(([k]) => ph[k] === "me");
  return (
    <svg className="cfo-v" viewBox="0 0 640 290" role="img" aria-label={`V字モデル。あなたの担当：${mine.map(m => m[1]).join("・") || "なし"}`}>
      <path d="M70 40 L250 250 L390 250 L570 40" fill="none" stroke="#E2E5DD" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      {PAIRS.map(([a, b]) => <path key={a} d={`M${POS[a][0] + 52} ${POS[a][1]} H${POS[b][0] - 52}`} stroke="#D6D9D0" strokeDasharray="3 5" />)}
      {mine.length > 1 && <polyline points={mine.map(([k]) => POS[k].join(",")).join(" ")} fill="none" stroke="#FFE14D" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />}
      {PHASES.map(([k, name]) => {
        const st = ph[k], me = st === "me", done = st === "done";
        const [x, y] = POS[k];
        return (
          <g key={k}>
            <rect x={x - 50} y={y - 19} width="100" height="38" rx="10" fill={me ? "#FFE14D" : done ? "#F2F3EE" : "#fff"} stroke={me ? "#15171C" : "#CDD1C7"} strokeWidth={me ? 2 : 1.5} strokeDasharray={!me && !done ? "4 3" : undefined} />
            <text x={x} y={y - 1} textAnchor="middle" fontSize="13" fontWeight="700" fill={done ? "#767D8C" : "#15171C"}>{name}</text>
            <text x={x} y={y + 13} textAnchor="middle" fontSize="10" fill={me ? "#5E4700" : "#767D8C"}>{WHO[st] || ""}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Team({ project, item }) {
  const ph = { ...DEFAULT_PHASES, ...(project?.phases || {}) };
  const of = who => PHASES.filter(([k]) => ph[k] === who).map(p => p[1]);
  const people = [
    { who: "me", role: project?.role || "開発メンバー", items: of("me") },
    { who: "lead", role: "リーダー", items: ["レビュー", "技術の相談", ...of("lead")] },
    { who: "pm", role: "PM", items: ["進め方・優先度", ...of("pm")] },
    { who: "client", role: "お客さま", items: [item.ticket?.client || "", ...of("client")].filter(Boolean) },
  ];
  return (
    <div className="cfo-team">
      {people.map(p => (
        <div key={p.who} className={`cfo-person ${p.who === "me" ? "me" : ""}`}>
          <div className="top"><span className={`cfo-av ${p.who}`}>{p.who === "me" ? "あ" : p.who === "client" ? "客" : p.who === "pm" ? "PM" : "L"}</span>
            <b>{p.role}</b>{p.who !== "me" && <span className="aitag">AI</span>}</div>
          {p.items.length > 0 && <ul>{p.items.map(x => <li key={x}>{x}</li>)}</ul>}
        </div>
      ))}
    </div>
  );
}

/* ---------- 最初の画面（概要） ---------- */
export function CaseOverview({ item, side }) {
  const pj = item.project || {};
  const st = pj.story || {};
  const story = [["いま", st.now], ["困っていること", st.problem], ["ゴール", st.goal]].filter(x => x[1]);
  const sp = item.spec || {};
  const done = item.ticket?.done || [];
  const askMode = pj.mode === "ask" || pj.mode === "turn";
  const hearing = pj.hearing || [];
  return (
    <div className="cfo">
      <div className="cfo-main">
        {story.length > 0 && (
          <section className="cf-panel cfo-sec"><h2>案件の概要</h2>
            <div className="cfo-story">{story.map(([k, v], i) => <div key={k} className={i === story.length - 1 && k === "ゴール" ? "goal" : ""}><span className="eyebrow">{k}</span><p>{v}</p></div>)}</div>
          </section>
        )}
        <section className="cf-panel cfo-sec"><h2>参画する工程<span className="eyebrow">V字モデル</span></h2>
          <VModel phases={pj.phases} />
          <div className="cfo-legend"><span className="me"><i />あなた</span><span className="done"><i />済み</span><span className="other"><i />ほかの人</span></div>
        </section>
        <section className="cf-panel cfo-sec"><h2>立場と体制</h2><Team project={pj} item={item} />
          <div className="cfo-flow"><span className="eyebrow">報告の流れ</span><b>あなた</b><span>→</span><b>リーダー（レビュー）</b><span>→</span><b>PM</b><span>→</span><b>お客さま（受入）</b></div>
        </section>
        {((sp.rules || []).length > 0 || done.length > 0) && (
          <section className="cf-panel cfo-sec"><h2>仕様の要点</h2>
            <div className="cfo-two">
              {(sp.rules || []).length > 0 && <div><span className="eyebrow">ルール</span><ul className="cfo-ul">{sp.rules.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
              {done.length > 0 && <div><span className="eyebrow">完了条件</span><ul className="cfo-done">{done.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
            </div>
          </section>
        )}
        {((pj.policy || []).length > 0 || hearing.length > 0) && (
          <section className="cf-panel cfo-sec"><h2>実装方針</h2>
            <div className="cfo-two">
              <div className="cfo-pol cfo-fix"><h3>決まっている</h3>{(pj.policy || []).length ? <ul>{pj.policy.map((x, i) => <li key={i}>{x}</li>)}</ul> : <span className="muted">－</span>}</div>
              <div className={`cfo-pol cfo-ask ${askMode ? "" : "off"}`}>
                <h3>お客さまに確認{askMode ? <span className="chip warn">{hearing.length}件</span> : pj.mode === "done" ? <span className="chip ok">聞き出し済み</span> : null}</h3>
                {askMode ? <ul>{hearing.map((h, i) => <li key={i}>{h.q}</li>)}</ul> : pj.mode === "done" ? <ul>{(pj.decided || []).map((x, i) => <li key={i}>{x}</li>)}</ul> : <span className="muted">－</span>}
              </div>
            </div>
          </section>
        )}
      </div>
      <aside className="cfo-side">{side}</aside>
    </div>
  );
}

/* ---------- ヒアリング（聞き出す・お客さまの指定あり） ---------- */
export function HearingBoard({ item, hearing, sending, onPropose, onAsk, onNext }) {
  const pj = item.project || {};
  const items = hearing?.items || (pj.hearing || []).map(h => ({ q: h.q, a: "" }));
  const open = items.filter(x => !x.a).length;
  const [prop, setProp] = useState(hearing?.proposal || "");
  const done = hearing?.done === true;
  return (
    <div className="cfo-hear">
      <section className="cf-panel cfo-sec">
        <h2>お客さまの相談</h2>
        <div className="cf-cm"><span className="cfo-av client">客</span><div><div className="who">お客さま{item.ticket?.client ? `（${item.ticket.client}）` : ""}<span className="aitag">AI</span></div><p>{pj.request || item.ticket?.background}</p></div></div>
      </section>
      <section className="cf-panel cfo-sec">
        <h2>聞き出すこと<span className={`chip ${open ? "warn" : "ok"}`}>{open ? `未確認 ${open}` : "すべて確認済み"}</span></h2>
        <div className="cfo-qs">{items.map((x, i) => (
          <div key={i} className={`cfo-q ${x.a ? "yes" : ""}`}>
            <span className="s">{x.a ? "確認済み" : "未確認"}</span>
            <span>{x.q}{x.a && <span className="a">→ {x.a}</span>}</span>
            {!x.a && !done && <button type="button" className="btn ghost sm" disabled={sending} onClick={() => onAsk(`${x.q}`)}>聞く</button>}
          </div>
        ))}</div>
      </section>
      <section className="cf-panel cfo-sec">
        <h2>提案</h2>
        {done ? (
          <div className={`cfo-decided ${hearing.turned ? "turned" : ""}`}>
            <span className="from">{hearing.turned ? "お客さまの指定" : "決まった方針"}</span>
            {hearing.turned && hearing.proposal && <del>{hearing.proposal}</del>}
            <ul>{(hearing.decided || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
            <button type="button" className="btn" onClick={onNext} style={{ justifySelf: "start" }}>次へ →</button>
          </div>
        ) : (
          <form className="cfo-prop" onSubmit={e => { e.preventDefault(); if (prop.trim()) onPropose(prop.trim()); }}>
            <textarea rows={3} value={prop} onChange={e => setProp(e.target.value)} placeholder="何を作るか・どう解決するかを書く" aria-label="提案" />
            <button type="submit" className="btn dark" disabled={sending || !prop.trim()}>{sending ? "送っています…" : "お客さまに提案する"}</button>
          </form>
        )}
      </section>
    </div>
  );
}

/* ---------- 聞き出し済み：まとめを上に、会話は下で ---------- */
export function HearingSummary({ item, onNext, nextLabel }) {
  const pj = item.project || {};
  const NAME = { client: `お客さま${item.ticket?.client ? `（${item.ticket.client}）` : ""}`, pm: "PM", lead: "リーダー", me: "あなた" };
  return (
    <div className="cfo-hear">
      <section className="cf-panel cfo-sec cfo-sum">
        <div className="cfo-cols">
          <div><span className="eyebrow">依頼</span><ul className="cfo-ul">{[pj.request || item.ticket?.background].filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          <div><span className="eyebrow">聞き出した内容</span><ul className="cfo-qa">{(pj.hearing || []).map((h, i) => <li key={i}><span>{h.q}</span>{h.a}</li>)}</ul></div>
          <div><span className="eyebrow">決まった方針</span><ul className="cfo-ul">{(pj.decided || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        </div>
        <div className="cfo-next"><span className="chip ok">聞き出し済み</span><span className="sp" /><button type="button" className="btn" onClick={onNext}>{nextLabel} →</button></div>
      </section>
      {(pj.log || []).length > 0 && (
        <details className="cf-panel cfo-convo"><summary>会話を見る <span className="chip">{pj.log.length}件</span></summary>
          <div className="cfo-log">{pj.log.map((m, i) => (
            <div key={i} className={`cfo-m ${m.who === "me" ? "me" : ""}`}><span className={`cfo-av ${m.who}`}>{m.who === "me" ? "あ" : m.who === "client" ? "客" : m.who === "pm" ? "PM" : "L"}</span>
              <div><div className="who">{NAME[m.who]}</div><p>{m.text}</p></div></div>
          ))}</div>
        </details>
      )}
    </div>
  );
}
