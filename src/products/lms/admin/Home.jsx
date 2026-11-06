import React, { useEffect, useState } from "react";
import { apiGet } from "../../../api.js";
import { setActiveCourseId } from "../../../utils/common/courseContext.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, weekday } from "../parts/ui.jsx";
import { arr, md } from "../staff/common.js";
import { AddCompany, afterMade } from "./Companies.jsx";
import CourseCreate from "./CourseCreate.jsx";

/* 管理者のホーム（モック homeA）：コースの札（準備中・研修中）。企業を足す・コースを作るはここからも */

export const COL = ["var(--tm-d)", "var(--tst-d)", "var(--att-d)", "var(--cur-d)", "var(--rep-d)", "var(--dev-d)"];

export const stateOf = (c, today) => (c.status === "archived" ? "終わった" : c.endDate && c.endDate < today ? "終わった" : c.startDate && c.startDate <= today ? "研修中" : c.startDate && c.handedAt ? "これから" : "下書き");
export function setupOf(c) {
  return [["講師", arr(c.instructorIds).length > 0], ["受講生", (c.traineeCount || 0) > 0], ["研修の期間", !!(c.startDate && c.endDate)], ["始まりの時間", !!c.standardClockIn]];
}
export const dayOf = (c, today) => { const a = Date.parse(c.startDate), b = Date.parse(c.endDate), t = Date.parse(today); if (!Number.isFinite(a) || !Number.isFinite(b)) return null; return [Math.max(0, Math.round((Math.min(t, b) - a) / 86400000) + 1), Math.round((b - a) / 86400000) + 1]; };

export function CourseTile({ c, i, today, onOpen }) {
  const su = setupOf(c), miss = su.filter(x => !x[1]), st = stateOf(c, today), prep = st !== "研修中", dd = dayOf(c, today);
  return (
    <button type="button" className={`card act${!arr(c.instructorIds).length ? " bad" : ""}`} style={{ "--cc": COL[i % COL.length] }} onClick={onOpen}>
      <span className="act-top"><Chip tone={st === "研修中" ? "ok" : st === "これから" ? "blue" : ""}>{st}</Chip>{prep && c.handedAt && <Chip tone="ok">講師に渡した</Chip>}{miss.length > 0 && <span className={`act-al${arr(c.instructorIds).length ? " warn" : ""}`} aria-label={`気になるところ ${miss.length} 件`}>!<b>{miss.length}</b></span>}</span>
      <span className="act-n"><b>{c.name}</b><small>{c.startDate ? `${md(c.startDate)}〜${md(c.endDate)}` : "期間 未定"}</small></span>
      {prep ? <span className="act-pg"><span className="act-st">{su.map(x => <i key={x[0]} className={x[1] ? "ok" : ""} />)}</span><small className="num">準備 {su.length - miss.length} / {su.length}</small></span>
        : dd && <span className="act-pg"><span className="bar10"><i style={{ "--w": `${Math.round(dd[0] / dd[1] * 100)}%` }} /></span><small className="num">{dd[0]} / {dd[1]} 日目</small></span>}
      <span className="act-m"><span>講師</span><b>{arr(c.instructorIds).length ? `${c.instructorIds.length} 人` : "未定"}</b><span>受講生</span><b>{c.traineeCount == null ? "?" : c.traineeCount ? `${c.traineeCount} 人` : "まだ"}</b></span>
      {miss.length > 0 ? <span className="act-is">{miss.slice(0, 3).map(x => <span key={x[0]} className={x[0] === "講師" ? "" : "warn"}><i>!</i>{x[0]}がまだです</span>)}</span> : <span className="act-ok">✓ 準備ができています</span>}
    </button>
  );
}

export default function AdminHome({ go, say }) {
  const today = todayStr();
  const [st, setSt] = useState({ state: "loading", courses: [] });
  const [companies, setCompanies] = useState(null);
  const [adding, setAdding] = useState(false); const [making, setMaking] = useState(null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    apiGet("/admin/course-overview").then(r => { if (alive) setSt({ state: "ready", courses: arr(r?.courses) }); }).catch(() => { if (alive) setSt({ state: "error", courses: [] }); });
    apiGet("/companies").then(l => { if (alive) setCompanies(arr(l)); }).catch(() => { if (alive) setCompanies(null); });
    return () => { alive = false; };
  }, [key]);
  const d = new Date(`${today}T00:00:00`);
  const list = st.courses.map((c, i) => [c, i]);
  const prep = list.filter(([c]) => ["下書き", "これから"].includes(stateOf(c, today))), run = list.filter(([c]) => stateOf(c, today) === "研修中");
  const open = c => { setActiveCourseId(c.courseId); try { sessionStorage.setItem("lms.courseOpen", c.courseId); } catch { /* 一覧が開くだけ */ } go("course"); };
  return (
    <div className="th st">
      <div className="th-top ih-top">
        <div className="th-date"><b className="num">{d.getDate()}</b><div><em>{d.getMonth() + 1} 月 ・ {weekday(d.getMonth() + 1, d.getDate(), d.getFullYear())}曜日</em><small>管理{st.state === "ready" ? ` ・ コース ${st.courses.length}` : ""}{companies ? ` ・ 企業 ${companies.length}` : ""}</small></div></div>
        <div className="th-att"><span className="th-pill ok"><i aria-hidden="true" />研修中 <b className="num">{run.length}</b></span><span className="th-pill"><i aria-hidden="true" />準備中 <b className="num">{prep.length}</b></span><Btn kind="ghost sm" onClick={() => setAdding(true)}>企業を足す</Btn><Btn kind="sm" onClick={() => setMaking("")}>コースを作る</Btn></div>
      </div>
      {st.state === "error" ? <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card> : st.state === "loading" ? <div className="soon card">読み込み中</div> : (
        <>
          <div className="ah-sec"><h2 className="h2">準備中</h2><Chip>{prep.length}</Chip></div>
          <div className="act-g ad-g">{prep.map(([c, i]) => <CourseTile key={c.courseId} c={c} i={i} today={today} onOpen={() => open(c)} />)}{!prep.length && <Chip>なし</Chip>}</div>
          <div className="ah-sec"><h2 className="h2">研修中</h2><Chip tone="ok">{run.length}</Chip><span style={{ marginLeft: "auto" }} /><button type="button" className="lnk" onClick={() => { try { sessionStorage.setItem("lms.courseTab", "終わった"); } catch { /* 今のコースが出るだけ */ } go("course"); }}>終わったコース →</button></div>
          <div className="act-g ad-g">{run.map(([c, i]) => <CourseTile key={c.courseId} c={c} i={i} today={today} onOpen={() => open(c)} />)}{!run.length && <Chip>なし</Chip>}</div>
        </>
      )}
      {adding && <AddCompany onClose={() => setAdding(false)} onDone={() => setKey(k => k + 1)} onCourse={id => { setAdding(false); setMaking(id); }} />}
      {making !== null && <CourseCreate companies={arr(companies)} courses={st.courses} initial={making ? { companyId: making } : undefined} onClose={() => setMaking(null)} onDone={(id, r) => { setMaking(null); say?.("コースを下書きで作りました"); if (id) afterMade(go, id, r); else setKey(k => k + 1); }} />}
    </div>
  );
}
