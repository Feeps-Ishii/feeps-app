import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../../api.js";
import { normalizeCurriculumSections } from "../../training/TrainingComponents.jsx";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, Hero, Kpi } from "../parts/ui.jsx";
import { arr, md, saveXlsx, useStaffCourse, useStats } from "../staff/common.js";
import { BarChart, LineChart, TestRow } from "../staff/parts.jsx";

/* 企業担当者の研修の様子（モック stateC）：週のまとめと数字を色の面に、出席率とテストのグラフ、カリキュラム、テスト */

const dk = v => String(v || "").slice(0, 10);
function unitsOf(cur, today) {
  return normalizeCurriculumSections(cur).map(s => {
    const ds = [s, ...arr(s.chapters).flatMap(c => arr(c.lessons))].flatMap(x => [dk(x.startDate), dk(x.endDate || x.startDate)]).filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v)).sort();
    const from = ds[0], to = ds[ds.length - 1];
    const k = !from ? "fut" : today > to ? "done" : today >= from ? "now" : "fut";
    const span = from && to ? Math.max(1, (Date.parse(to) - Date.parse(from)) / 86400000 + 1) : 1;
    const w = k === "done" ? 100 : k === "now" ? Math.round(((Date.parse(today) - Date.parse(from)) / 86400000 + 1) / span * 100) : 0;
    return { id: s.id, title: s.title, from, to, k, w };
  });
}

export default function ClientState() {
  const today = todayStr();
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const stats = useStats(courseId);
  const [weekly, setWeekly] = useState(undefined);
  const [cur, setCur] = useState(undefined);
  useEffect(() => {
    if (!courseId) return;
    apiGet(`/completion-report/weekly?courseId=${encodeURIComponent(courseId)}`).then(r => setWeekly(r?.item || null)).catch(() => setWeekly(undefined));
    apiGet(`/courses/${courseId}/curriculum`).then(setCur).catch(() => setCur(null));
  }, [courseId]);
  const units = useMemo(() => (cur ? unitsOf(cur, today) : []), [cur, today]);

  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>研修の様子</b><Chip>コースなし</Chip></div></Card>;
  if (stats.state === "error") return <Card><div className="empty"><b>研修の様子を確認できません</b><Btn kind="ghost sm" onClick={stats.reload}>再読み込み</Btn></div></Card>;
  if (stats.state === "loading") return <div className="soon card">読み込み中</div>;

  const d = stats.data, o = d.overall || {};
  const cDone = units.length ? Math.round(units.reduce((a, u) => a + u.w, 0) / units.length) : null;
  const weeks = arr(d.weekly).filter(w => w.rate != null);
  const tests = arr(d.tests).filter(t => t.average != null);
  const lo = weeks.length ? Math.max(0, Math.floor(Math.min(...weeks.map(w => w.rate)) / 10) * 10 - 10) : 0;
  const curNo = units.findIndex(u => u.k === "now");
  const xlsx = () => saveXlsx(`研修の様子_${sc.course.name}`, "受講生", [["受講生", "出席率", "遅刻", "早退", "欠席", "日報", "テスト平均"], ...arr(d.trainees).map(t => [t.name, t.attendanceRate ?? "", t.late, t.early, t.absent, t.reportDays, t.testAverage ?? ""])]);
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">研修の様子</h1></div><span className="r"><Btn kind="ghost sm" onClick={xlsx}>Excel で受け取る</Btn></span></div>
      {d.unknown && <div className="lms-err" role="alert">一部の受講生を確認できません（数字が少なく出ている場合があります）</div>}
      <div className="th sc">
        <Hero cat="tm" className="sc-hero" eyebrow={weekly ? `週のまとめ${weekly.from ? ` ・ ${md(weekly.from)}〜${md(weekly.to)}` : ""}` : "全体の数字"} step={weekly ? `${weekly.authorName ? `講師 ${weekly.authorName} ・ ` : ""}${md(weekly.sentAt)}` : undefined} title={weekly?.title}>
          {weekly && arr(weekly.points).length > 0 && <ul className="sc-sum">{weekly.points.map((p, i) => <li key={i}>{p}</li>)}</ul>}
          <Kpi items={[
            { label: "出席率", value: o.attendanceRate ?? "—", unit: o.attendanceRate != null ? "%" : "", pct: o.attendanceRate ?? undefined },
            { label: "日報の提出", value: o.reportRate ?? "—", unit: o.reportRate != null ? "%" : "", pct: o.reportRate ?? undefined },
            { label: "テストの平均", value: o.testAverage ?? "—", unit: o.testAverage != null ? "点" : "", pct: o.testAverage ?? undefined },
            { label: "カリキュラム", value: cDone ?? "—", unit: cDone != null ? "%" : "", pct: cDone ?? undefined },
          ]} />
        </Hero>
        <div className="g2e">
          <Card className="pad"><div className="head"><h2 className="h2">出席率</h2><span className="r"><Chip>週ごと</Chip></span></div>{weeks.length >= 2 ? <LineChart pts={weeks.map(w => w.rate)} labels={weeks.map(w => md(w.from))} lo={lo} hi={100} unit="%" /> : <Chip>なし</Chip>}</Card>
          <Card className="pad"><div className="head"><h2 className="h2">テストの平均</h2><span className="r"><Chip>受けた順</Chip></span></div>{tests.length ? <BarChart vals={tests.map(t => t.average)} labels={tests.map(t => t.title)} /> : <Chip>なし</Chip>}</Card>
        </div>
        <div className="g2e">
          <Card className="pad sc-c">
            <div className="head"><h2 className="h2">カリキュラム</h2>{units.length > 0 && <span className="r"><Chip>単元 {curNo >= 0 ? curNo + 1 : units.filter(u => u.k === "done").length} / {units.length}</Chip></span>}</div>
            {cur === null && <Chip>確認できません</Chip>}
            <div className="sc-ul">
              {units.map((u, i) => <div key={u.id} className={`sc-u ${u.k}`}><span className="tu-no num">{u.k === "done" ? "✓" : i + 1}</span><span className="sc-ub"><b>{u.title}{u.k === "now" && <em>今の単元</em>}</b><small className="num">{u.from ? `${md(u.from)}〜${md(u.to)}` : ""}</small></span><span className="tp-bar sm"><i style={{ "--w": `${u.w}%` }} /></span><b className="num sc-p">{u.w}<small>%</small></b></div>)}
            </div>
          </Card>
          <Card className="pad sc-c">
            <div className="head"><h2 className="h2">テスト</h2><span className="r"><Chip>合格 70 点</Chip></span></div>
            <div className="kt-l">{arr(d.tests).map(t => <TestRow key={t.testId} title={t.title} sub={`${t.takers} 人`} score={t.average} prefix="平均" />)}{!arr(d.tests).length && <Chip>なし</Chip>}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
