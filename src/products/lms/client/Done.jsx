import React, { useEffect, useState } from "react";
import { apiGet } from "../../../api.js";
import { Btn, Card, Chip, FileIcon, Hero, Kpi, ListTool, matchName } from "../parts/ui.jsx";
import { arr, md, useStaffCourse } from "../staff/common.js";
import { TestRow } from "../staff/parts.jsx";
import { CertModal } from "../staff/Cert.jsx";
import { SurveyCard } from "../staff/Survey.jsx";

/* 企業担当者の修了レポート（モック doneC）：確定したものを読む。全体の数字・テストの平均・受講生ごと・講師の所見 */

const pct = v => (v == null ? "—" : `${v}%`);
const SENT_FOLDER = "修了レポート（送信済み）";

function SentFiles({ courseId }) {
  const space = `course#${courseId}`;
  const [files, setFiles] = useState(undefined);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    apiGet(`/library?spaceId=${encodeURIComponent(space)}`).then(d => {
      const nodes = arr(d?.nodes), f = nodes.find(n => n.type === "folder" && n.name === SENT_FOLDER);
      if (alive) setFiles(f ? nodes.filter(n => n.parentId === f.nodeId && n.type === "file") : []);
    }).catch(() => { if (alive) setFiles(null); });
    return () => { alive = false; };
  }, [space]);
  if (files === undefined || (files && !files.length)) return null;
  if (files === null) return <div className="lms-err" role="alert">ファイルを確認できません</div>;
  const get = async f => { try { const r = await apiGet(`/library/download?spaceId=${encodeURIComponent(space)}&nodeId=${encodeURIComponent(f.nodeId)}&mode=download`); window.open(r.url, "_blank", "noopener"); } catch { setErr(`「${f.name}」を開けませんでした`); } };
  return (
    <Card className="pad sc-c">
      <div className="head"><h2 className="h2">修了レポートのファイル</h2><span className="r"><Chip>{files.length}</Chip></span></div>
      <div className="fd-l">{files.map(f => <div key={f.nodeId} className="fd-f"><FileIcon name={f.name} /><span className="fd-fb"><b>{f.name}</b><small className="num">{md(f.updatedAt)}</small></span><span /><Btn kind="ghost sm" onClick={() => get(f)}>ダウンロード</Btn></div>)}</div>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Card>
  );
}

export default function ClientDone() {
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const [st, setSt] = useState({ state: "loading", data: null });
  const [key, setKey] = useState(0);
  const [q, setQ] = useState(""); const [sort, setSort] = useState("name");
  const [cert, setCert] = useState(false);
  useEffect(() => {
    if (!courseId) return undefined;
    let alive = true;
    setSt({ state: "loading", data: null });
    apiGet(`/completion-report?courseId=${encodeURIComponent(courseId)}`).then(data => { if (alive) setSt({ state: "ready", data }); }).catch(() => { if (alive) setSt({ state: "error", data: null }); });
    return () => { alive = false; };
  }, [courseId, key]);

  if (sc.state === "loading" || (courseId && st.state === "loading")) return <div className="soon card">読み込み中</div>;
  if (sc.state === "error" || st.state === "error") return <Card><div className="empty"><b>修了レポートを確認できません</b><Btn kind="ghost sm" onClick={() => { sc.reload(); setKey(k => k + 1); }}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>修了レポート</b><Chip>コースなし</Chip></div></Card>;
  const d = st.data;
  const head = <div className="head"><div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">修了レポート</h1></div>{d?.published && <span className="r"><Btn kind="ghost sm" onClick={() => setCert(true)}>修了証</Btn><Btn kind="ghost sm" onClick={() => window.print()}>PDF で受け取る</Btn></span>}</div>;
  if (!d?.published) {
    return (
      <div className="st">{head}
        <SentFiles courseId={courseId} />
        <Hero cat="gy" className="dc-hero" eyebrow="修了レポート" step={sc.course.endDate ? `${md(sc.course.endDate)} 公開予定` : undefined} title="未公開" />
      </div>
    );
  }
  const o = d.overall || {}, notes = d.report?.traineeNotes || {};
  const list = arr(d.trainees).filter(t => matchName(t.name, "", q)).sort((a, b) => (sort === "att" ? (a.attendanceRate ?? 101) - (b.attendanceRate ?? 101) : sort === "thi" ? (b.testAverage ?? -1) - (a.testAverage ?? -1) : a.name.localeCompare(b.name, "ja")));
  return (
    <div className="st" id="completion-print">
      <style>{"@media print{@page{size:A4;margin:12mm} body *{visibility:hidden !important} #completion-print,#completion-print *{visibility:visible !important} #completion-print{position:absolute;left:0;top:0;width:100%}}"}</style>
      {head}
      <div className="th sc">
        <Hero cat="rep" className="dc-hero" eyebrow="修了レポート" step={d.report?.confirmedAt ? `確定 ${md(d.report.confirmedAt)}` : "公開済み"} title={d.courseName}>
          <Kpi items={[
            { label: "出席率", value: o.attendanceRate ?? "—", unit: o.attendanceRate != null ? "%" : "", pct: o.attendanceRate ?? undefined },
            { label: "日報の提出", value: o.reportRate ?? "—", unit: o.reportRate != null ? "%" : "", pct: o.reportRate ?? undefined },
            { label: "テストの平均", value: o.testAverage ?? "—", unit: o.testAverage != null ? "点" : "", pct: o.testAverage ?? undefined },
            { label: "受講生", value: o.traineeCount ?? "—", unit: " 人" },
          ]} />
        </Hero>
        <SentFiles courseId={courseId} />
        {d.report?.summary && <Card className="pad sc-c"><div className="head"><h2 className="h2">講師の所見</h2>{d.report.confirmedByName && <span className="r"><Chip tone="mk">{d.report.confirmedByName}</Chip></span>}</div><p className="st-pre st-p">{d.report.summary}</p></Card>}
        <SurveyCard courseId={courseId} />
        <Card className="pad sc-c">
          <div className="head"><h2 className="h2">テストの平均</h2><span className="r"><Chip>合格 70 点</Chip></span></div>
          <div className="kt-l">{arr(d.tests).map(t => <TestRow key={t.testId} title={t.title} sub={`${t.takers} 人`} score={t.average} />)}{!arr(d.tests).length && <Chip>なし</Chip>}</div>
        </Card>
        <ListTool q={q} onQ={setQ} placeholder="名前で探す" sorts={[["name", "名前順"], ["att", "出席率の低い順"], ["thi", "テスト平均の高い順"]]} sort={sort} onSort={setSort} />
        <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>受講生</th><th>出席率</th><th>遅・早・欠</th><th>日報</th><th>テスト平均</th><th>一言</th></tr></thead><tbody>
          {list.map(t => <tr key={t.id}><td><b>{t.name}</b></td><td className="num">{pct(t.attendanceRate)}</td><td className="num">{t.late} ・ {t.early} ・ {t.absent}</td><td className="num">{pct(t.reportRate)}</td><td className="num">{t.testAverage == null ? "—" : `${t.testAverage} 点`}</td><td className="st-pre">{notes[t.id] || "—"}</td></tr>)}
          {!list.length && <tr><td colSpan={6}><Chip>見つかりません</Chip></td></tr>}
        </tbody></table></div></Card>
      </div>
      {cert && <CertModal people={arr(d.trainees)} course={d.courseName} start={d.period?.startDate} end={d.period?.endDate} confirmedAt={d.report?.confirmedAt} onClose={() => setCert(false)} />}
    </div>
  );
}
