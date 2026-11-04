import React, { useState } from "react";
import { ackKeys } from "../../training/acks.js";
import { useTraineeHome } from "./useTraineeHome.js";
import { Btn, Cal, Card, Chip, Hero, Kpi, weekday } from "../parts/ui.jsx";
import { Icon } from "../parts/icons.jsx";

/* 受講生のホーム（モック homeT）：上に日付と出勤・終わり、左に「次にやること」の色の面、右に今日の流れ、
   下に締め切りとお知らせ。次にやることは 出勤 → 今日の目標 → 単元を学ぶ → 日報 → 退勤 の順 */

const DONE_REPORT = s => !!s && !["not_submitted", "unknown", "not_applicable"].includes(s);
const ymd = s => { const [y, m, d] = String(s || "").slice(0, 10).split("-").map(Number); return y ? { y, m, d } : null; };
const daysLeft = (iso, today) => Math.ceil((Date.parse(String(iso).slice(0, 10)) - Date.parse(today)) / 86400000);
const FROM = { instructor: ["講師から", "mk", "tm"], client: ["企業から", "co", "tst"], admin: ["運営から", "", "gy"] };

function steps(d) {
  const att = d.dash.attendance || {}, rep = d.dash.dailyReport || {};
  const sched = d.dash.todayCompletion?.schedule || {};
  const r = d.reportToday;
  const goalText = r ? String(r.morningGoal || (r.goalItems || []).map(g => g?.text || g).filter(Boolean)[0] || "") : "";
  const repDone = DONE_REPORT(rep.status);
  const lesson = d.course?.todayCurriculum?.title || "";
  return [
    { k: "in", t: "出勤", sub: att.clockIn || `${sched.startTime || "9:00"} まで`, done: !!att.clockIn, go: "att", cat: "att", act: "出勤する" },
    { k: "goal", t: "今日の目標", sub: goalText || "日報の朝の欄", done: !!goalText, go: "report", cat: "rep", act: "目標を書く" },
    { k: "lesson", t: "単元を学ぶ", sub: lesson || "今日の単元", done: repDone, go: "cur", cat: "cur", act: "カリキュラムを開く" },
    { k: "rep", t: "日報", sub: repDone ? "提出済み" : `${sched.endTime || "18:00"} まで`, done: repDone, go: "report", cat: "rep", act: "日報を書く" },
    { k: "out", t: "退勤", sub: att.clockOut || "日報のあと", done: !!att.clockOut, go: "att", cat: "att", act: "退勤する" },
  ];
}

export default function TraineeHome({ go }) {
  const d = useTraineeHome();
  const [acked, setAcked] = useState({});
  const ack = key => { setAcked(m => ({ ...m, [key]: true })); ackKeys(key).catch(() => setAcked(m => ({ ...m, [key]: false }))); };
  const isAcked = key => acked[key] || !!d.acks?.[key];
  if (d.state === "loading") return <div className="soon card">読み込み中</div>;
  if (d.state === "error") return <Card className="pad"><div className="empty"><b>ホームの情報を確認できません</b><Btn kind="ghost sm" onClick={d.reload}>再読み込み</Btn></div></Card>;

  const { dash, today, course } = d;
  const t = ymd(today), sched = dash.todayCompletion?.schedule || {}, att = dash.attendance || {};
  const isDay = dash.todayCompletion?.applicability === "training_day";
  const list = steps(d), nextI = list.findIndex(s => !s.done), next = list[nextI];
  const allDone = isDay && nextI === -1;
  const unsub = dash.summary?.unsubmittedTests;
  const goalPct = dash.summary?.goalProgress?.progressPercent;

  // 締め切り：個人開発の課題（締め切りあり・終わっていないもの）と未受験のテスト
  const dls = [
    ...(d.devs || []).filter(a => a.deadline && a.state !== "done" && a.status !== "done").map(a => ({ key: `dev-${a.id}`, date: a.deadline, title: a.title, kind: "個人開発", cat: "dev", go: "dev" })),
    ...(dash.tests || []).filter(x => x.status === "unsubmitted" && x.dueDate).map(x => ({ key: `test-${x.testId}`, date: x.dueDate, title: x.title, kind: "テスト", cat: "tst", go: "test" })),
    ...(d.practice || []).filter(s => s.status === "published" && s.dueDate && (s.doneCount || 0) < (s.counts?.questions || 0)).map(s => ({ key: `prac-${s.id}`, date: s.dueDate, title: s.title, kind: "練習問題", cat: "tst", go: "prac" })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const tests = (dash.tests || []).filter(x => x.status === "unsubmitted" && !x.dueDate);
  const firstDl = dls[0] ? daysLeft(dls[0].date, today) : null;

  const hero = !isDay
    ? (
      <Hero cat="gy" art="gy" eyebrow="今日" title="研修のない日" sub={dash.nextTrainingDay ? `次の研修日 ${dash.nextTrainingDay.date.slice(5).replace("-", "/")}${dash.nextTrainingDay.lessonTitle ? ` ・ ${dash.nextTrainingDay.lessonTitle}` : ""}` : undefined}>
        <div className="row"><Btn kind="ghost" onClick={() => go("cur")}>カリキュラム</Btn><Btn kind="ghost" onClick={() => go("note")}>ノート</Btn></div>
      </Hero>
    )
    : allDone
      ? (
        <Hero cat="gy" art="gy" eyebrow="今日" step={`${list.length} / ${list.length}`} title="おつかれさまでした">
          <div className="row th-chips"><Chip>出勤 {att.clockIn}</Chip><Chip>退勤 {att.clockOut}</Chip><Chip tone="ok">日報 提出済み</Chip></div>
        </Hero>
      )
      : (
        <Hero cat={next.cat} art={next.cat} eyebrow="次にやること" step={`${nextI + 1} / ${list.length}`} title={next.t} sub={next.sub}>
          <div className="row">
            <Btn kind="big" onClick={() => go(next.go)}>{next.act}</Btn>
            {next.k !== "lesson" ? <Btn kind="ghost big th-ghost" onClick={() => go("cur")}>今日の単元</Btn> : <Btn kind="ghost big th-ghost" onClick={() => go("doc")}>フォルダ</Btn>}
          </div>
          <div className="row th-chips">
            {course?.todayCurriculum?.title && next.sub !== course.todayCurriculum.title && <Chip>{course.todayCurriculum.title}</Chip>}
            {(sched.startTime || sched.endTime) && <Chip>{sched.startTime || ""}〜{sched.endTime || ""}</Chip>}
          </div>
          <Kpi items={[
            { label: "未受験のテスト", value: unsub ?? "—", unit: unsub != null ? " 件" : "" },
            { label: "目標の進み", value: goalPct ?? "—", unit: goalPct != null ? "%" : "", pct: goalPct ?? undefined },
            { label: "次の締め切り", value: firstDl != null ? Math.max(firstDl, 0) : "—", unit: firstDl != null ? " 日" : "", note: dls[0]?.title },
          ]} />
        </Hero>
      );

  return (
    <div className="th">
      <div className="th-top">
        <div className="th-date">
          <b className="num">{t?.d}</b>
          <div><em>{t?.m} 月 ・ {weekday(t?.m, t?.d, t?.y)}曜日</em><small>{course?.courseName || ""}</small></div>
        </div>
        {isDay && (
          <div className="th-att">
            <span className={`th-pill${att.clockIn ? " ok" : ""}`}><i aria-hidden="true" />出勤 <b>{att.clockIn || "まだ"}</b></span>
            {sched.endTime && <span className="th-pill"><i aria-hidden="true" />終わり <b>{sched.endTime}</b></span>}
          </div>
        )}
      </div>

      <div className="th-grid">
        {hero}
        {isDay && (
          <Card className="pad th-flow">
            <div className="head"><h2 className="h2">今日の流れ</h2><span className="r"><span className="th-cnt num">{list.filter(s => s.done).length}<small> / {list.length}</small></span></span></div>
            <ol className="tf">
              {list.map((s, i) => {
                const st = s.done ? "done" : i === nextI ? "next" : "";
                return (
                  <li key={s.k} className={`${st} c-${s.cat}`}>
                    <i>{s.done ? "✓" : i + 1}</i>
                    <span><b>{s.t}</b><small>{s.sub}</small></span>
                    {i === nextI ? <em>次</em> : <span />}
                  </li>
                );
              })}
            </ol>
          </Card>
        )}
      </div>

      <div className="th-row">
        <Card className="pad">
          <div className="head"><h2 className="h2">締め切り</h2>{dls.length > 0 && <span className="r"><Chip>{dls.length}</Chip></span>}</div>
          {d.devs === null && <div className="empty"><b>課題を確認できません</b><Btn kind="ghost sm" onClick={d.reload}>再読み込み</Btn></div>}
          <div className="th-l">
            {dls.slice(0, 4).map(x => {
              const n = daysLeft(x.date, today), dd = ymd(x.date);
              return (
                <button key={x.key} type="button" className="th-dl" onClick={() => go(x.go)}>
                  <Cal date={`${dd.m}/${dd.d}`} year={dd.y} cat={x.cat} />
                  <span className="th-dlb"><b>{x.title}</b><small>{x.kind}</small></span>
                  <Chip tone={n < 0 ? "bad" : n <= 3 ? "warn" : ""}>{n < 0 ? "過ぎています" : `あと ${n} 日`}</Chip>
                </button>
              );
            })}
            {tests.slice(0, 3).map(x => (
              <button key={`t-${x.testId}`} type="button" className="th-dl" onClick={() => go("test")}>
                <span className="cal c-tst th-cal-ic"><Icon k="test" size={20} /></span>
                <span className="th-dlb"><b>{x.title}</b><small>テスト</small></span>
                <Chip tone="warn">未受験</Chip>
              </button>
            ))}
            {d.devs !== null && dls.length === 0 && tests.length === 0 && <div className="th-none"><Chip tone="ok">なし</Chip></div>}
          </div>
        </Card>

        <Card className="pad">
          <div className="head"><h2 className="h2">お知らせ</h2>{d.anns?.length > 0 && <span className="r"><Chip>{d.anns.length}</Chip></span>}</div>
          {d.anns === null && <div className="empty"><b>お知らせを確認できません</b><Btn kind="ghost sm" onClick={d.reload}>再読み込み</Btn></div>}
          <div className="th-l">
            {(d.notices || []).filter(n => !isAcked(`ntc#${n.id}`)).slice(-3).reverse().map(n => (
              <div key={n.id} className="th-an">
                <span className="th-av c-tm">{String(n.byName || "講").slice(0, 1)}</span>
                <span><span className="row" style={{ gap: 6 }}><Chip tone="mk">{n.kind === "remind" ? "リマインド" : "講師から"}</Chip></span><b>{n.message}</b><small>{n.byName || ""}</small></span>
                <Btn kind="ghost sm" onClick={() => ack(`ntc#${n.id}`)}>確認</Btn>
              </div>
            ))}
            {(d.anns || []).slice(0, 4).map(a => {
              const [label, tone, cat] = FROM[a.authorRole] || FROM.instructor;
              return (
                <div key={a.announcementId} className="th-an">
                  <span className={`th-av c-${cat}`}>{String(a.authorName || label).slice(0, 1)}</span>
                  <span>
                    <span className="row" style={{ gap: 6 }}><Chip tone={tone}>{label}</Chip>{a.importance === "important" && <Chip tone="bad">重要</Chip>}</span>
                    <b>{a.title}</b>
                    <small>{a.authorName || ""}{a.publishedAt ? ` ・ ${String(a.publishedAt).slice(5, 10).replace("-", "/")}` : ""}</small>
                  </span>
                  {d.acks && (isAcked(`anc#${a.announcementId}`) ? <Chip tone="ok">確認済み</Chip> : <Btn kind="ghost sm" onClick={() => ack(`anc#${a.announcementId}`)}>確認</Btn>)}
                </div>
              );
            })}
            {d.anns && d.anns.length === 0 && <div className="th-none"><Chip>なし</Chip></div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
