import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../../api.js";
import { hasStaffComment } from "../../training/acks.js";
import { kindOf, noClock } from "../trainee/useTraineeAttendance.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, weekday } from "../parts/ui.jsx";
import { arr, md, useRoster, useStaffCourse, useWorkdays } from "../staff/common.js";
import { PRing, PSeg } from "../staff/parts.jsx";
import { TaskList, useTasks } from "./Task.jsx";
import WeeklyCard from "./Weekly.jsx";

/* 講師・コース担当者のホーム（モック homeI）：今日の日報と勤怠、タスク、送信済みのお知らせ */

export default function InstructorHome({ go, say }) {
  const today = todayStr();
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const { list: roster, reload } = useRoster(courseId);
  const wd = useWorkdays(courseId, today.slice(0, 7));
  const [day, setDay] = useState({ state: "loading", reports: [], att: [] });
  const [anns, setAnns] = useState(undefined);
  const [key, setKey] = useState(0);
  const tasks = useTasks(courseId);
  useEffect(() => {
    let alive = true;
    Promise.all([apiGet(`/reports?date=${today}`), apiGet(`/attendance?date=${today}`)])
      .then(([r, a]) => { if (alive) setDay({ state: "ready", reports: arr(r).filter(x => x.deleted !== true), att: arr(a).filter(x => x.deleted !== true) }); })
      .catch(() => { if (alive) setDay({ state: "error", reports: [], att: [] }); });
    apiGet("/announcements").then(r => { if (alive) setAnns(arr(r?.items)); }).catch(() => { if (alive) setAnns(null); });
    return () => { alive = false; };
  }, [today, key]);
  const nums = useMemo(() => {
    const ppl = roster || [];
    const rep = ppl.map(p => day.reports.find(r => r.traineeId === p.id));
    const att = ppl.map(p => day.att.find(r => r.traineeId === p.id));
    const k = att.map(a => (!a || (!a.clockIn && !noClock(a.status)) ? "none" : kindOf(a)));
    const c = x => k.filter(v => v === x).length;
    return { N: ppl.length, done: rep.filter(r => r && hasStaffComment(r)).length, wait: rep.filter(r => r && !hasStaffComment(r)).length, none: rep.filter(r => !r).length, ok: c("出勤"), late: c("遅刻") + c("早退"), absent: c("欠勤"), noin: ppl.filter((_, i) => k[i] === "none") };
  }, [roster, day]);
  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>担当のコース</b><Chip>なし</Chip></div></Card>;
  const d = new Date(`${today}T00:00:00`);
  const isDay = wd.state === "ready" ? wd.dates.includes(today) : true;
  const next = wd.dates.find(x => x > today);
  const prev = [...wd.dates].reverse().find(x => x < today);
  const { N } = nums, repN = N - nums.none, attN = N - nums.noin.length - nums.absent;
  const sent = arr(anns).filter(a => !a.courseId || a.courseId === courseId).slice(0, 3);
  return (
    <div className="th st">
      <div className="th-top ih-top">
        <div className="th-date"><b className="num">{d.getDate()}</b><div><em>{d.getMonth() + 1} 月 ・ {weekday(d.getMonth() + 1, d.getDate(), d.getFullYear())}曜日</em><small>{isDay ? "" : "研修のない日 ・ "}{sc.course.name}</small></div></div>
        <div className="th-att"><span className="th-pill ok"><i aria-hidden="true" />受講生 <b className="num">{N}</b> 人</span><Btn kind="ghost sm" onClick={() => go("setting")}>コースの設定</Btn></div>
      </div>
      {roster === null || day.state === "error" ? <Card><div className="empty"><b>今日の様子を確認できません</b><Btn kind="ghost sm" onClick={() => { reload(); setKey(k => k + 1); }}>再読み込み</Btn></div></Card>
        : !isDay ? (
          <Card className="ih-off pad"><div><h2 className="h2">今日は研修日ではありません</h2><span className="row">{next && <Chip tone="mk">次の研修日 {md(next)}</Chip>}{prev && <Btn kind="ghost sm" onClick={() => go("report")}>前の研修日の日報</Btn>}<Btn kind="ghost sm" onClick={() => go("att")}>勤怠</Btn></span></div></Card>
        ) : (
          <div className="ih-day">
            <section className="card ih-p">
              <div className="ih-ph"><h2 className="h2">本日の日報</h2></div>
              <div className="ih-pb"><PRing n={repN} of={N} /><div className="ih-pn"><span><b className="num">{repN}</b><small> / {N} 人</small></span><PSeg parts={[["コメント済み", nums.done, "mk"], ["コメント待ち", nums.wait, "warn"], ["まだ", nums.none, "no"]]} /></div></div>
              <div className="ih-pf"><Btn onClick={() => go("report")}>本日の日報 →</Btn></div>
            </section>
            <section className="card ih-p">
              <div className="ih-ph"><h2 className="h2">本日の勤怠</h2></div>
              <div className="ih-pb"><PRing n={attN} of={N} tone="ok" /><div className="ih-pn"><span><b className="num">{attN}</b><small> / {N} 人</small></span><PSeg parts={[["出勤", nums.ok, "ok"], ["遅刻", nums.late, "warn"], ["欠勤", nums.absent, "bad"], ["未打刻", nums.noin.length, "no"]]} /></div></div>
              <div className="ih-pf"><Btn onClick={() => go("att")}>本日の勤怠 →</Btn><span className="ih-who">{nums.noin.slice(0, 4).map(p => <React.Fragment key={p.id}><span className="face sm">{p.name.slice(0, 1)}</span><small>{p.name}</small></React.Fragment>)}</span></div>
            </section>
          </div>
        )}
      <div className="ih-cols">
        <Card className="pad ih-tasks">
          <div className="head"><h2 className="h2">タスク</h2><span className="r"><Chip>まだ {tasks.open.length}</Chip><Btn kind="sm" onClick={() => go("task")}>タスク一覧</Btn></span></div>
          <TaskList t={tasks} list={tasks.open.slice(0, 4)} today={today} say={say} />
        </Card>
        <Card className="pad">
          <div className="head"><h2 className="h2">送信済みのお知らせ</h2><span className="r"><Btn kind="sm" onClick={() => go("ann")}>お知らせを出す</Btn></span></div>
          {anns === null && <div className="empty"><b>お知らせを確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div>}
          <div className="ih-sent">{sent.map(a => <button key={a.announcementId} type="button" className="ih-si" onClick={() => go("ann")}><span className="num">{md(a.publishedAt || a.createdAt)}</span><b>{a.title}</b>{a.importance === "important" && <Chip tone="bad">重要</Chip>}{a.targetCount != null && <span className="ih-rd num">既読 {a.readCount}/{a.targetCount}</span>}</button>)}</div>
          {anns && !sent.length && <Chip>なし</Chip>}
        </Card>
      </div>
      <WeeklyCard courseId={courseId} say={say} />
    </div>
  );
}
