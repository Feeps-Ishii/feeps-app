import React, { useEffect, useState } from "react";
import { apiGet } from "../../../api.js";
import { Btn, Card, Chip, FileIcon, Hero, Kpi } from "../parts/ui.jsx";
import { arr, md, useStaffCourse } from "../staff/common.js";
import { TestRow } from "../staff/parts.jsx";
import { CertModal } from "../staff/Cert.jsx";

/* 企業担当者の修了レポート（モック doneC）：送られたファイルと修了証、全体の数字、テストの平均、アンケート */

const SENT_FOLDER = "修了レポート（送信済み）";

function useSentFiles(courseId) {
  const space = `course#${courseId}`;
  const [files, setFiles] = useState(undefined);
  useEffect(() => {
    if (!courseId) return undefined;
    let alive = true;
    apiGet(`/library?spaceId=${encodeURIComponent(space)}`).then(d => {
      const nodes = arr(d?.nodes), f = nodes.find(n => n.type === "folder" && n.name === SENT_FOLDER);
      if (alive) setFiles(f ? nodes.filter(n => n.parentId === f.nodeId && n.type === "file") : []);
    }).catch(() => { if (alive) setFiles(null); });
    return () => { alive = false; };
  }, [courseId, space]);
  return { files, space };
}

export default function ClientDone() {
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const [st, setSt] = useState({ state: "loading", data: null });
  const [key, setKey] = useState(0);
  const [cert, setCert] = useState(false); const [err, setErr] = useState("");
  const [survey, setSurvey] = useState(undefined);
  const { files, space } = useSentFiles(courseId);
  useEffect(() => {
    if (!courseId) return undefined;
    let alive = true;
    setSt({ state: "loading", data: null });
    apiGet(`/completion-report?courseId=${encodeURIComponent(courseId)}`).then(data => { if (alive) setSt({ state: "ready", data }); }).catch(() => { if (alive) setSt({ state: "error", data: null }); });
    apiGet(`/course-survey?courseId=${encodeURIComponent(courseId)}`).then(d => { if (alive) setSurvey(d); }).catch(() => { if (alive) setSurvey(null); });
    return () => { alive = false; };
  }, [courseId, key]);

  if (sc.state === "loading" || (courseId && st.state === "loading")) return <div className="soon card">読み込み中</div>;
  if (sc.state === "error" || st.state === "error") return <Card><div className="empty"><b>修了レポートを確認できません</b><Btn kind="ghost sm" onClick={() => { sc.reload(); setKey(k => k + 1); }}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>修了レポート</b><Chip>コースなし</Chip></div></Card>;
  const d = st.data, conf = !!d?.published, o = d?.overall || {}, list = arr(files), pub = list.length > 0;
  const get = async f => { setErr(""); try { const r = await apiGet(`/library/download?spaceId=${encodeURIComponent(space)}&nodeId=${encodeURIComponent(f.nodeId)}&mode=download`); window.open(r.url, "_blank", "noopener"); } catch { setErr(`「${f.name}」を開けませんでした`); } };
  const qs = arr(survey?.questions).filter(q => survey?.avg?.[q.id] != null);
  const sat = qs.length ? Math.round(qs.reduce((a, q) => a + Number(survey.avg[q.id]), 0) / qs.length * 10) / 10 : null;
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">修了レポート</h1></div></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {files === null && <div className="lms-err" role="alert">ファイルを確認できません</div>}
      <div className="th sc">
        <Hero cat={pub || conf ? "rep" : "gy"} className="dc-hero" eyebrow="修了レポート" step={pub || conf ? "公開済み" : sc.course.endDate ? `${md(sc.course.endDate)} 公開予定` : "公開予定"} title={pub ? `ファイル ${list.length} 件` : conf ? d.courseName : "未公開"}>
          {pub && <div className="dc-files">{list.map(f => <div key={f.nodeId} className="dc-f"><FileIcon name={f.name} /><span className="dc-fb"><b>{f.name}</b><small className="num">{md(f.updatedAt)}</small></span><Btn kind="ghost sm" onClick={() => get(f)}>ダウンロード</Btn></div>)}</div>}
          {conf && <div className="dc-f"><span className="dc-fb"><b>修了証</b><small>{arr(d.trainees).length} 人分</small></span><Btn kind="ghost sm" onClick={() => setCert(true)}>修了証</Btn></div>}
          {conf && <Kpi items={[
            { label: "出席率", value: o.attendanceRate ?? "—", unit: o.attendanceRate != null ? "%" : "", pct: o.attendanceRate ?? undefined },
            { label: "日報の提出", value: o.reportRate ?? "—", unit: o.reportRate != null ? "%" : "", pct: o.reportRate ?? undefined },
            { label: "テストの平均", value: o.testAverage ?? "—", unit: o.testAverage != null ? "点" : "", pct: o.testAverage ?? undefined },
            { label: "満足度", value: sat ?? "—", unit: sat != null ? "/ 5" : "", pct: sat != null ? Math.round(sat / 5 * 100) : undefined },
          ]} />}
        </Hero>
        {conf && <div className="g2e">
          <Card className="pad sc-c">
            <div className="head"><h2 className="h2">テストの平均</h2><span className="r"><Chip>合格 70 点</Chip></span></div>
            <div className="kt-l">{arr(d.tests).map(t => <TestRow key={t.testId} title={t.title} score={t.average} />)}{!arr(d.tests).length && <Chip>なし</Chip>}</div>
          </Card>
          <Card className="pad sc-c">
            <div className="head"><h2 className="h2">アンケート</h2>{survey && <span className="r"><Chip>回答 {survey.n} / {survey.of} 人</Chip></span>}</div>
            {survey === null ? <Chip>確認できません</Chip> : <div className="kt-l">{qs.map(q => { const v = Number(survey.avg[q.id]); return <div key={q.id} className="kt-t dc-q"><span className="kt-tb"><b>{q.t}</b></span><span className="kt-tbar"><i style={{ "--w": `${v / 5 * 100}%` }} /></span><b className="num kt-sc">{v.toFixed(1)}<small>/ 5</small></b></div>; })}{survey && !qs.length && <Chip>なし</Chip>}</div>}
          </Card>
        </div>}
      </div>
      {cert && <CertModal people={arr(d.trainees)} course={d.courseName} start={d.period?.startDate} end={d.period?.endDate} confirmedAt={d.report?.confirmedAt} onClose={() => setCert(false)} />}
    </div>
  );
}
