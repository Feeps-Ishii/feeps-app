import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../../api.js";
import { hasStaffComment } from "../../training/acks.js";
import { kindOf, noClock } from "../trainee/useTraineeAttendance.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, Modal, SysBanner, weekday } from "../parts/ui.jsx";
import { arr, errText, md, useRoster, useStaffCourse, useWorkdays } from "../staff/common.js";
import { PRing, PSeg } from "../staff/parts.jsx";
import { TaskList, TaskModal, useTasks } from "./Task.jsx";
import WeeklyCard from "./Weekly.jsx";

/* 講師・コース担当者のホーム（モック homeI）：今日の日報と勤怠、タスク、その場で出すお知らせ */

// 日報・勤怠の画面を、絞った状態で開く（staff/Reports・staff/Attendance が 1 回読む）
const goTab = (go, screen, tab) => { try { sessionStorage.setItem(`lms.${screen}Tab`, tab); } catch { /* 絞らずに開く */ } go(screen); };

function QuickAnn({ courseId, n, onSent, say }) {
  const EMPTY = { title: "", body: "", client: false, imp: false };
  const [v, setV] = useState(EMPTY);
  const [check, setCheck] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const f = (k, x) => setV(s => ({ ...s, [k]: x }));
  const open = () => { if (!v.title.trim() || !v.body.trim()) { setErr("件名と本文を入れてください"); return; } setErr(""); setCheck(true); };
  const send = async () => {
    setBusy(true); setErr("");
    const base = { title: v.title.trim(), body: v.body.trim(), importance: v.imp ? "important" : "normal", pinned: false, publishedAt: "", expiresAt: "" };
    try {
      await apiPost("/announcements", { audience: "trainee", courseId, ...base });
      if (v.client) await apiPost("/announcements", { audience: "client", courseId: "", ...base });
      say?.("お知らせを出しました"); setV(EMPTY); setCheck(false); onSent();
    } catch (e) { setErr(errText(e, "出せませんでした")); setCheck(false); } finally { setBusy(false); }
  };
  return (
    <div className="qcomp">
      <div className="row"><Chip tone="mk">宛先：受講生 {n} 人</Chip><span className="row"><label className="st-ck"><input type="checkbox" checked={v.client} onChange={e => f("client", e.target.checked)} />企業担当者にも</label><label className="st-ck"><input type="checkbox" checked={v.imp} onChange={e => f("imp", e.target.checked)} />重要</label></span></div>
      <input type="text" className="annt" aria-label="件名" value={v.title} placeholder="件名（例：明日の開始時間について）" onChange={e => f("title", e.target.value)} />
      <textarea className="annb" aria-label="本文" value={v.body} placeholder="本文" onChange={e => f("body", e.target.value)} />
      {err && <div className="lms-err" role="alert">{err}</div>}
      <span className="row st-end"><Btn onClick={open}>確かめて出す</Btn></span>
      {check && <Modal title="確かめて出す" width={500} onClose={() => setCheck(false)} footer={<><Btn kind="ghost" onClick={() => setCheck(false)}>直す</Btn><Btn disabled={busy} onClick={send}>{busy ? "出しています" : "出す"}</Btn></>}><dl className="kv"><div><dt>宛先</dt><dd>受講生 {n} 人{v.client ? "・企業担当者" : ""}</dd></div><div><dt>件名</dt><dd>{v.title}{v.imp ? "（重要）" : ""}</dd></div><div><dt>本文</dt><dd className="st-pre">{v.body}</dd></div></dl></Modal>}
    </div>
  );
}

// 研修のない日の絵（モック illo rest）
const RestArt = () => (
  <span className="il" aria-hidden="true"><svg viewBox="0 0 240 160" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="120" cy="146" rx="96" ry="8" fill="var(--il-soft)" stroke="none" /><path d="M28 134h184" />
    <path d="M78 34a24 24 0 1 0 26 32 20 20 0 1 1-26-32z" fill="var(--il-soft)" /><path d="M150 30v6M147 33h6M176 52v4M174 54h4M128 22v4M126 24h4" stroke="var(--il-acc)" />
    <rect x="62" y="118" width="104" height="12" rx="4" fill="var(--il-card)" /><path d="M70 124h20" stroke="var(--il-acc)" />
    <path d="M180 108h18v20a6 6 0 0 1-6 6h-6a6 6 0 0 1-6-6z" fill="var(--il-card)" /><path d="M198 112h4a5 5 0 0 1 0 10h-4" /><path d="M185 99c0-4 4-4 4-8M193 99c0-4 4-4 4-8" />
  </svg></span>
);
// これからの平日で研修のない日（お休み）。研修日の一覧の最後の日まで
const offDays = (dates, today) => {
  const last = dates[dates.length - 1], set = new Set(dates), out = [];
  if (!last) return out;
  for (let t = new Date(`${today}T00:00:00Z`); out.length < 3; ) {
    t.setUTCDate(t.getUTCDate() + 1);
    const iso = t.toISOString().slice(0, 10);
    if (iso > last) break;
    if (![0, 6].includes(t.getUTCDay()) && !set.has(iso)) out.push(iso);
  }
  return out;
};

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
  const [taskNew, setTaskNew] = useState(false);
  const [sys, setSys] = useState([]);
  useEffect(() => { apiGet("/announcements/me").then(r => setSys(arr(r?.items))).catch(() => {}); }, []);
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
  const dow = iso => { const [y, m, dd] = iso.split("-").map(Number); return weekday(m, dd, y); };
  const { N } = nums, repN = N - nums.none, attN = N - nums.noin.length - nums.absent;
  const sent = arr(anns).filter(a => !a.courseId || a.courseId === courseId).slice(0, 3);
  return (
    <div className="th st">
      <SysBanner items={sys} />
      <div className="th-top ih-top">
        <div className="th-date"><b className="num">{d.getDate()}</b><div><em>{d.getMonth() + 1} 月 ・ {weekday(d.getMonth() + 1, d.getDate(), d.getFullYear())}曜日</em><small>{isDay ? "" : "研修のない日 ・ "}{sc.course.name}</small></div></div>
        <div className="th-att"><span className="th-pill ok"><i aria-hidden="true" />受講生 <b className="num">{N}</b> 人</span><Btn kind="ghost sm" onClick={() => go("setting")}>コースの設定</Btn></div>
      </div>
      {roster === null || day.state === "error" ? <Card><div className="empty"><b>今日の様子を確認できません</b><Btn kind="ghost sm" onClick={() => { reload(); setKey(k => k + 1); }}>再読み込み</Btn></div></Card>
        : !isDay ? (
          <Card className="ih-off"><RestArt /><div><h2 className="h2">今日は研修日ではありません</h2>{(next || offDays(wd.dates, today).length > 0) && <span className="row">{next && <Chip tone="mk">次の研修日 {md(next)}（{dow(next)}）</Chip>}{offDays(wd.dates, today).length > 0 && <Chip>お休み {offDays(wd.dates, today).map(md).join("・")}</Chip>}</span>}<span className="row">{prev && <Btn kind="ghost sm" onClick={() => go("report")}>前の研修日（{md(prev)} {dow(prev)}）の日報</Btn>}<Btn kind="ghost sm" onClick={() => go("att")}>勤怠</Btn></span></div></Card>
        ) : (
          <div className="ih-day">
            <section className="card ih-p">
              <div className="ih-ph"><h2 className="h2">本日の日報</h2>{sc.course.standardClockOut && <Chip>締め切り {sc.course.standardClockOut}</Chip>}</div>
              <div className="ih-pb"><PRing n={repN} of={N} /><div className="ih-pn"><span><b className="num">{repN}</b><small> / {N} 人</small></span><PSeg parts={[["コメント済み", nums.done, "mk"], ["コメント待ち", nums.wait, "warn"], ["まだ", nums.none, "no"]]} /></div></div>
              <div className="ih-pf"><Btn onClick={() => go("report")}>本日の日報 →</Btn><Btn kind="ghost" onClick={() => goTab(go, "report", "wait")}>コメント待ち {nums.wait}</Btn><Btn kind="ghost" onClick={() => goTab(go, "report", "none")}>まだ {nums.none}</Btn></div>
            </section>
            <section className="card ih-p">
              <div className="ih-ph"><h2 className="h2">本日の勤怠</h2>{sc.course.standardClockIn && sc.course.standardClockOut && <Chip>{sc.course.standardClockIn}〜{sc.course.standardClockOut}</Chip>}</div>
              <div className="ih-pb"><PRing n={attN} of={N} tone="ok" /><div className="ih-pn"><span><b className="num">{attN}</b><small> / {N} 人</small></span><PSeg parts={[["出勤", nums.ok, "ok"], ["遅刻", nums.late, "warn"], ["欠勤", nums.absent, "bad"], ["未打刻", nums.noin.length, "no"]]} /></div></div>
              <div className="ih-pf"><Btn onClick={() => go("att")}>本日の勤怠 →</Btn><Btn kind="ghost" onClick={() => goTab(go, "att", "none")}>未打刻 {nums.noin.length}</Btn><span className="ih-who">{nums.noin.slice(0, 4).map(p => <React.Fragment key={p.id}><span className="face sm">{p.name.slice(0, 1)}</span><small>{p.name}</small></React.Fragment>)}</span></div>
            </section>
          </div>
        )}
      <div className="ih-cols">
        <Card className="pad ih-tasks">
          <div className="head"><h2 className="h2">タスク</h2><span className="r"><Chip>まだ {tasks.open.length}</Chip><Btn kind="sm" onClick={() => setTaskNew(true)}>タスクを足す</Btn></span></div>
          <TaskList t={tasks} list={tasks.open.slice(0, 4)} today={today} say={say} />
          <div className="more"><button type="button" className="lnk" onClick={() => go("task")}>タスク一覧（{tasks.open.length}）→</button></div>
        </Card>
        <Card className="pad">
          <div className="head"><h2 className="h2">お知らせを出す</h2><span className="r"><Btn kind="ghost sm" onClick={() => go("ann")}>お知らせの一覧</Btn></span></div>
          <QuickAnn courseId={courseId} n={N} say={say} onSent={() => setKey(k => k + 1)} />
          {anns === null && <div className="empty"><b>お知らせを確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div>}
          <div className="ih-sent">{sent.map(a => <button key={a.announcementId} type="button" className="ih-si" onClick={() => go("ann")}><span className="num">{md(a.publishedAt || a.createdAt)}</span><b>{a.title}</b>{a.importance === "important" && <Chip tone="bad">重要</Chip>}{a.targetCount != null && <span className="ih-rd num">既読 {a.readCount}/{a.targetCount}</span>}</button>)}</div>
        </Card>
      </div>
      <WeeklyCard courseId={courseId} say={say} />
      {taskNew && <TaskModal t={tasks} onClose={() => setTaskNew(false)} say={say} />}
    </div>
  );
}
