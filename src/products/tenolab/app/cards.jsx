import React from "react";
import { Ic, PremTag, StartTag, Thumb, TopicIcon, durationLabel } from "./ui.jsx";
import "./case/preview.css";

/* 一覧のカード（モックの courseCard / drillCard / caseCard）。
   c / d / x は app/model.js で整えた形（locked・progress・cleared などを含む）。 */

export function CourseCard({ c, premium, go }) {
  const t = c.topicObj, lk = c.locked;
  const st = c.progress >= 100 ? "done" : c.progress > 0 ? "now" : "";
  const Main = lk ? "div" : "button";
  const x = c.nextCase;
  return (
    <div className={`card ccard split ${lk ? "locked" : ""} ${st === "done" ? "is-done" : ""}`} aria-disabled={lk || undefined}>
      {!lk && st && <span className={`stamp ${st}`}>{st === "done" ? <><Ic id="check" />修了</> : `受講中 ${c.progress}%`}</span>}
      {lk && <span className="lockmark"><Ic id="lock" /></span>}
      <Main {...(lk ? {} : { type: "button", onClick: () => go(`#/courses/${c.id}`) })} className="cc-main">
        <div className="top" style={{ background: t.color }} />
        <div className="body">
          <span className="row" style={{ gap: 10 }}><TopicIcon topic={t} size={36} /><span className="eyebrow" style={{ color: t.color }}>{t.name}</span></span>
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>{c.title}</h3>
          <div className="row" style={{ gap: 6 }}><PremTag item={c} premium={premium} />{c.level && <span className="chip">{c.level}</span>}{c.lessons > 0 && <span className="chip"><Ic id="slide" />レッスン {c.lessons}</span>}</div>
          <div className="row"><div className="bar-p" style={{ flex: 1 }}><i style={{ width: `${c.progress}%` }} /></div><span className="num muted" style={{ fontSize: 12 }}>{c.progress >= 100 ? "100%" : c.progress ? `${c.progress}%` : "未受講"}</span></div>
          {c.duration && <span className="muted" style={{ fontSize: 12 }}>目安 {durationLabel(c.duration)}</span>}
        </div>
      </Main>
      {x && (
        <button type="button" className="cc-case" disabled={lk} onClick={() => go(`#/cases/${x.id}`)} aria-label={`案件体験：${x.title}`}>
          <span className="cc-ci"><Ic id="case" /></span>
          <span className="cc-ct"><small>この先の案件体験</small><b>{x.title}</b></span>
          <span className="cc-arrow">→</span>
        </button>
      )}
    </div>
  );
}

export function DrillCard({ d, premium, go }) {
  const t = d.topicObj, lk = d.locked, cleared = d.cleared;
  const body = (
    <>
      <div className={`thumb-wrap ${cleared ? "cleared" : ""}`}><Thumb item={d} />{cleared && <span className="clear-badge"><Ic id="check" />クリア済み</span>}</div>
      <div className="body">
        <span className="row" style={{ gap: 8 }}><TopicIcon topic={t} size={28} /><span className="eyebrow" style={{ color: t.color }}>{t.name}</span><PremTag item={d} premium={premium} /></span>
        <h3 style={{ fontWeight: 700, fontSize: 15 }}>{d.title}</h3>
        <div className="row" style={{ gap: 6 }}>
          {d.level && <span className="chip">{d.level}</span>}
          {d.minutes ? <span className="chip">約{d.minutes}分</span> : null}
          <StartTag start={d.start} />
          {lk && <span className="chip" style={{ color: "#8A5A10" }}><Ic id="lock" />Premium</span>}
        </div>
      </div>
    </>
  );
  if (lk) return <div className="card ccard locked" aria-disabled="true">{body}</div>;
  return <button type="button" className={`card ccard ${cleared ? "is-cleared" : ""}`} onClick={() => go(`#/drills/${d.id}`)}>{body}</button>;
}

/* 案件のイメージ（2026-10-13）。Servlet の案件は、作る画面（フォーム）をそのまま小さく映し、チケットの番号と種類を重ねる。
   画面の無い案件は、サムネイルが設定されていればそれを、無ければチケットの形で出す */
const CASE_KIND = { feat: "機能追加", bug: "不具合", mod: "改修" };
function CasePreview({ x }) {
  const t = x.ticket || {};
  const kind = CASE_KIND[t.kind] ? t.kind : "feat";
  const tag = (t.id || CASE_KIND[kind]) && <span className="cp-tag">{t.id && <b>{t.id}</b>}<i className={`cp-kind ${kind}`}>{CASE_KIND[kind]}</i></span>;
  if (x.servlet?.pageHtml) {
    return (
      <div className="cp" aria-hidden="true">
        <div className="cp-win">
          <div className="cp-bar"><i /><i /><i /><span>localhost:8080/{x.servlet.pageName || ""}</span></div>
          <div className="cp-page"><iframe title="" tabIndex={-1} sandbox="" loading="lazy" scrolling="no" srcDoc={x.servlet.pageHtml} /></div>
        </div>
        {tag}
      </div>
    );
  }
  if (x.thumb) return <Thumb item={x} />;
  return (
    <div className="cp ticket" aria-hidden="true">
      {tag}
      <div className="cp-flow">{["チケット", "実装", "テスト", "プルリク", "レビュー"].map((s, i) => <React.Fragment key={s}>{i > 0 && <em>→</em>}<span>{s}</span></React.Fragment>)}</div>
    </div>
  );
}

const CASE_STATE = {
  submitted: ["採点できず ・ もう一度提出", "warn"],
  returned: ["やり直し", "warn"],
  approved: ["マージ済み", "done"],
  skipped: ["先に進んだ", ""],
  doing: ["対応中", ""],
};
// 期限（YYYY-MM-DD）を「10/24（金）」に
const dueText = d => {
  const t = new Date(String(d).length === 10 ? `${d}T00:00:00` : d);
  return Number.isNaN(t.getTime()) ? d : `${t.getMonth() + 1}/${t.getDate()}（${"日月火水木金土"[t.getDay()]}）`;
};
export function CaseCard({ x, premium, go }) {
  const t = x.topicObj;
  if (x.locked) {
    return (
      <div className="card case locked" aria-disabled="true">
        <div className="thumb-wrap"><CasePreview x={x} /></div><span className="lockmark"><Ic id="lock" /></span>
        <div className="row"><span className="eyebrow" style={{ color: t.color }}>{t.name}</span><PremTag item={x} premium={premium} /></div>
        <h3 style={{ fontWeight: 700, fontSize: 16 }}>{x.title}</h3>
        <p className="muted" style={{ marginBlock: 0, fontSize: 13.5 }}>{x.summary}</p>
        <div className="row" style={{ gap: 6 }}>{x.hours ? <span className="chip">目安 {x.hours}時間</span> : null}</div>
      </div>
    );
  }
  const st = CASE_STATE[x.status];
  return (
    <div className="card case">
      <div className="thumb-wrap"><CasePreview x={x} /></div>
      <div className="row">
        <span className="eyebrow" style={{ color: t.color }}>{t.name}</span><PremTag item={x} premium={premium} />
        {st ? <span className={`chip ${st[1]}`}>{x.status === "approved" && <Ic id="check" />}{x.status === "approved" && x.runtime === "aws" ? "合格" : st[0]}</span>
          : x.open ? <span className="chip case"><Ic id="case" />受講できます</span>
            : <span className="chip"><Ic id="lock" />{x.needTitle ? `${x.needTitle}を修了すると` : "コースを修了すると"}</span>}
      </div>
      <h3 style={{ fontWeight: 700, fontSize: 16 }}>{x.title}</h3>
      <p className="muted" style={{ marginBlock: 0, fontSize: 13.5 }}>{x.summary}</p>
      <div className="row" style={{ gap: 6 }}>
        {x.assigned && <span className="chip warn">管理者から</span>}
        {x.dueAt && x.status !== "approved" && <span className="chip warn">期限 {dueText(x.dueAt)}</span>}
        {x.hours ? <span className="chip">目安 {x.hours}時間</span> : null}
        <button className="btn ghost" type="button" onClick={() => go(`#/cases/${x.id}`)} style={{ marginLeft: "auto", padding: "5px 12px" }}>{x.status && x.status !== "approved" ? "続きから →" : x.status === "approved" ? "ふりかえり →" : "始める →"}</button>
      </div>
    </div>
  );
}
