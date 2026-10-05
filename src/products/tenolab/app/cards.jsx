import React from "react";
import { Ic, PremTag, StartTag, Thumb, TopicIcon, durationLabel } from "./ui.jsx";

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

const CASE_STATE = {
  submitted: ["提出済み ・ 確認待ち", ""],
  returned: ["やり直し", "warn"],
  approved: ["OK", "done"],
  doing: ["取り組み中", ""],
};
export function CaseCard({ x, premium, go }) {
  const t = x.topicObj;
  if (x.locked) {
    return (
      <div className="card case locked" aria-disabled="true">
        <div className="thumb-wrap"><Thumb item={x} /></div><span className="lockmark"><Ic id="lock" /></span>
        <div className="row"><span className="eyebrow" style={{ color: t.color }}>{t.name}</span><PremTag item={x} premium={premium} /></div>
        <h3 style={{ fontWeight: 700, fontSize: 16 }}>{x.title}</h3>
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{x.summary}</p>
        <div className="row" style={{ gap: 6 }}>{x.hours ? <span className="chip">目安 {x.hours}時間</span> : null}</div>
      </div>
    );
  }
  const st = CASE_STATE[x.status];
  return (
    <div className="card case">
      <div className="thumb-wrap"><Thumb item={x} /></div>
      <div className="row">
        <span className="eyebrow" style={{ color: t.color }}>{t.name}</span><PremTag item={x} premium={premium} />
        {st ? <span className={`chip ${st[1]}`}>{x.status === "approved" && <Ic id="check" />}{st[0]}</span>
          : x.open ? <span className="chip case"><Ic id="case" />受講できます</span>
            : <span className="chip"><Ic id="lock" />{x.needTitle ? `${x.needTitle}を修了すると` : "コースを修了すると"}</span>}
      </div>
      <h3 style={{ fontWeight: 700, fontSize: 16 }}>{x.title}</h3>
      <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{x.summary}</p>
      <div className="row" style={{ gap: 6 }}>
        {x.hours ? <span className="chip">目安 {x.hours}時間</span> : null}
        <button className="btn ghost" type="button" onClick={() => go(`#/cases/${x.id}`)} style={{ marginLeft: "auto", padding: "5px 12px" }}>詳細を見る →</button>
      </div>
    </div>
  );
}
