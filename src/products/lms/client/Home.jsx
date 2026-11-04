import React, { useEffect, useState } from "react";
import { apiGet } from "../../../api.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Cal, Card, Chip, weekday } from "../parts/ui.jsx";
import { Icon } from "../parts/icons.jsx";
import { arr, md, setStaffFocus, usePins } from "../staff/common.js";
import { PRing, PSeg } from "../staff/parts.jsx";

/* 企業担当者のホーム（モック homeC）：今日の日報と勤怠、できることの札、担当の受講生、お知らせ */

const TILES = [["report", "日報", "rep", "毎日の振り返り ・ コメント"], ["att", "勤怠", "att", "出勤・遅刻・欠勤 ・ 月の集計"], ["state", "研修の様子", "cur", "週のまとめ ・ 出席率・テストのグラフ"], ["people", "受講生", "tm", "一人ずつの記録 ・ 担当の ✓"], ["eval", "評価表", "tst", "回ごとの評価 ・ Excel"], ["done", "修了レポート", "rep", "研修の結果 ・ 修了証"], ["ann", "お知らせ", "cur", "自社の受講生へ連絡"], ["grant", "助成金", "att", "書類 ・ 期限 ・ 見込み額"]];
const ATT = { clocked_in: "出勤", present: "出勤", late: "遅刻", early_leave: "早退", absent: "欠席", not_clocked_in: "未打刻", clocked_out: "出勤", completed: "出勤" };
const submitted = s => !!s && !["not_submitted", "unknown", "not_applicable"].includes(s);

export default function ClientHome({ go }) {
  const today = todayStr();
  const [dash, setDash] = useState(undefined);
  const [anns, setAnns] = useState(undefined);
  const { pins } = usePins(true);
  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    apiGet(`/dashboard/client?date=${today}`).then(d => { if (alive) setDash(d || null); }).catch(() => { if (alive) setDash(null); });
    apiGet("/announcements/me").then(r => { if (alive) setAnns(arr(r?.items)); }).catch(() => { if (alive) setAnns(null); });
    return () => { alive = false; };
  }, [today, key]);
  if (dash === undefined) return <div className="soon card">読み込み中</div>;
  if (dash === null) return <Card><div className="empty"><b>今日の様子を確認できません</b><Btn kind="ghost sm" onClick={() => { setDash(undefined); setKey(k => k + 1); }}>再読み込み</Btn></div></Card>;

  const all = arr(dash.trainees), day = all.filter(t => t.dayStatus === "training_day");
  const N = day.length, sub = day.filter(t => submitted(t.reportStatus)).length;
  const kindOf = t => ATT[t.attendanceStatus] || (String(t.attendanceStatus).includes("clock") ? "出勤" : "未打刻");
  const n = k => day.filter(t => kindOf(t) === k).length;
  const att = N - n("欠席") - n("未打刻");
  const odd = day.filter(t => kindOf(t) !== "出勤").slice(0, 4);
  const pinned = all.filter(t => pins.has(t.traineeId));
  const d = new Date(`${today}T00:00:00`);
  const unit = day[0]?.courseName || all[0]?.courseName || dash.company?.companyName || "";
  return (
    <div className="th st">
      <div className="th-top ih-top">
        <div className="th-date"><b className="num">{d.getDate()}</b><div><em>{d.getMonth() + 1} 月 ・ {weekday(d.getMonth() + 1, d.getDate(), d.getFullYear())}曜日</em><small>{unit}</small></div></div>
        <div className="th-att"><span className="th-pill ok"><i aria-hidden="true" />受講生 <b className="num">{all.length}</b> 人</span><Btn kind="ghost sm" onClick={() => go("state")}>研修の様子</Btn></div>
      </div>
      {arr(dash.warnings).filter(w => w.severity === "warning").map(w => <div key={w.code} className="lms-err">{w.message}</div>)}
      {N > 0 ? (
        <div className="ih-day">
          <section className="card ih-p">
            <div className="ih-ph"><h2 className="h2">本日の日報</h2></div>
            <div className="ih-pb"><PRing n={sub} of={N} /><div className="ih-pn"><span><b className="num">{sub}</b><small> / {N} 人</small></span><PSeg parts={[["提出", sub, "mk"], ["まだ", N - sub, "no"]]} /></div></div>
            <div className="ih-pf"><Btn onClick={() => go("report")}>本日の日報 →</Btn></div>
          </section>
          <section className="card ih-p">
            <div className="ih-ph"><h2 className="h2">本日の勤怠</h2></div>
            <div className="ih-pb"><PRing n={att} of={N} tone="ok" /><div className="ih-pn"><span><b className="num">{att}</b><small> / {N} 人</small></span><PSeg parts={[["出勤", n("出勤"), "ok"], ["遅刻", n("遅刻") + n("早退"), "warn"], ["欠勤", n("欠席"), "bad"], ...(n("未打刻") ? [["未打刻", n("未打刻"), "no"]] : [])]} /></div></div>
            <div className="ih-pf"><Btn onClick={() => go("att")}>本日の勤怠 →</Btn><span className="ih-who">{odd.map(t => <React.Fragment key={t.traineeId}><span className="face sm">{String(t.name).slice(0, 1)}</span><small>{t.name}</small></React.Fragment>)}</span></div>
          </section>
        </div>
      ) : <Card><div className="empty"><Chip>今日は研修のない日</Chip></div></Card>}
      <section className="ct-w">
        <div className="ah-sec"><h2 className="h2">できること</h2></div>
        <div className="ct-g">{TILES.map(([k, t, c, sub2]) => <button key={k} type="button" className={`ct c-${c}`} onClick={() => go(k)}><span className="ct-ic"><Icon k={k} size={17} /></span><b>{t}</b><small>{sub2}</small><i className="ct-go" aria-hidden="true">→</i></button>)}</div>
      </section>
      <div className="ih-cols">
        <Card className="pad hc-c">
          <div className="head"><h2 className="h2">担当の受講生</h2><span className="r">{pinned.length > 0 && <Chip>{pinned.length} 人</Chip>}<Btn kind="ghost sm" onClick={() => go("people")}>{pinned.length ? "選び直す" : "選ぶ"}</Btn></span></div>
          {pinned.length ? (
            <div className="hc-pl">
              {pinned.map(t => {
                const k = kindOf(t), sb = submitted(t.reportStatus), inDay = t.dayStatus === "training_day";
                return (
                  <div key={t.traineeId} className={`hc-pr c-${k === "欠席" ? "dev" : k === "出勤" ? "rep" : "att"}`}>
                    <span className="face">{String(t.name).slice(0, 1)}</span>
                    <span className="hc-pb"><b>{t.name}</b><small>{!inDay ? "研修のない日" : sb ? "日報 提出" : "日報 未提出"}</small></span>
                    {inDay && <Chip tone={k === "出勤" ? "ok" : k === "欠席" ? "bad" : "warn"}>{k}</Chip>}
                    <span className="hc-pa">{sb && <Btn kind="sm" onClick={() => { setStaffFocus({ kind: "report", date: today, id: t.traineeId }); go("report"); }}>コメント</Btn>}<Btn kind="ghost sm" onClick={() => go("people")}>カルテ</Btn></span>
                  </div>
                );
              })}
            </div>
          ) : (
            <button type="button" className="hc-none" onClick={() => go("people")}><span className="hc-fs">{all.slice(0, 5).map(t => <span key={t.traineeId} className="face">{String(t.name).slice(0, 1)}</span>)}</span><b>未選択</b><span className="hc-go">受講生一覧 →</span></button>
          )}
        </Card>
        <Card className="pad hc-c">
          <div className="head"><h2 className="h2">お知らせ</h2><span className="r"><Btn kind="ghost sm" onClick={() => go("ann")}>お知らせを出す</Btn></span></div>
          {anns === null && <div className="empty"><b>お知らせを確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div>}
          <div className="hc-al">
            {arr(anns).slice(0, 3).map(a => {
              const co = a.authorRole === "client";
              return <button key={a.announcementId} type="button" className="hc-an" onClick={() => go("ann")}><Cal date={md(a.publishedAt || a.createdAt)} cat={co ? "cur" : "tm"} /><span className="hc-ab"><span className="row" style={{ gap: 6 }}><Chip tone={co ? "co" : "mk"}>{co ? "企業から" : "講師から"}</Chip>{a.importance === "important" && <Chip tone="bad">重要</Chip>}</span><b>{a.title}</b><small>{a.authorName || ""}</small></span></button>;
            })}
            {anns && !anns.length && <Chip>なし</Chip>}
          </div>
          {anns && anns.length > 0 && <div className="more"><button type="button" className="lnk" onClick={() => go("ann")}>お知らせ一覧 →</button></div>}
        </Card>
      </div>
    </div>
  );
}
