import React, { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { uploadToFolder } from "../../training/DevReview.jsx";
import { Btn, Card, Chip, FileIcon, Hero, Kpi, Modal } from "../parts/ui.jsx";
import { arr, errText, md, saveXlsx, useStaffCourse } from "../staff/common.js";
import { BarChart } from "../staff/parts.jsx";
import { CertModal } from "../staff/Cert.jsx";
import { SurveyCard } from "../staff/Survey.jsx";

/* 講師・コース担当者の修了レポート（モック done）：企業担当者に送るファイル、研修全体の数字、テスト・評価表・アンケート・日報と個人開発、受講生ごとのまとめ。
   ファイルはコースのフォルダの「修了レポート」に置く（送るまで企業担当者には見えない）。確定すると企業担当者が数字と修了証を見られる */

const FOLDER = "修了レポート";
const pct = v => (v == null ? "—" : `${v}%`);
export const SENT_FOLDER = "修了レポート（送信済み）";
const STAFF_ACL = { scope: "course", roles: { trainee: false, instructor: true, client: false }, groups: null, traineeWrite: false };
const CLIENT_ACL = { ...STAFF_ACL, roles: { trainee: false, instructor: true, client: true } };

function Files({ courseId, say }) {
  const space = `course#${courseId}`;
  const [st, setSt] = useState({ state: "loading", folder: null, sentFolder: null, files: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [del, setDel] = useState(null);
  const load = useCallback(async () => {
    try {
      const d = await apiGet(`/library?spaceId=${encodeURIComponent(space)}`);
      const nodes = arr(d?.nodes), top = name => nodes.find(n => n.type === "folder" && n.parentId === "root" && n.name === name) || null;
      const folder = top(FOLDER), sentFolder = top(SENT_FOLDER);
      setSt({ state: "ready", folder, sentFolder, files: nodes.filter(n => n.type === "file" && [folder?.nodeId, sentFolder?.nodeId].filter(Boolean).includes(n.parentId)) });
    } catch { setSt({ state: "error", folder: null, sentFolder: null, files: [] }); }
  }, [space]);
  useEffect(() => { load(); }, [load]);
  const ensure = async (cur, name, acl) => {
    if (cur) return cur.nodeId;
    const r = await apiPost("/library/folders", { spaceId: space, parentId: "root", name });
    await apiPut(`/library/nodes/${encodeURIComponent(r.nodeId)}`, { spaceId: space, acl });
    return r.nodeId;
  };
  const upload = async fs => {
    if (!fs.length) return;
    setBusy(true); setErr("");
    try { const parentId = await ensure(st.folder, FOLDER, STAFF_ACL); await uploadToFolder({ courseId, parentId, files: fs }); say?.(`${fs.length} 件を置きました（まだ送っていません）`); await load(); }
    catch (e) { setErr(errText(e, "置けませんでした")); } finally { setBusy(false); }
  };
  const sent = f => !!st.sentFolder && f.parentId === st.sentFolder.nodeId;
  const toggle = async f => {
    setBusy(true); setErr("");
    try { const parentId = sent(f) ? await ensure(st.folder, FOLDER, STAFF_ACL) : await ensure(st.sentFolder, SENT_FOLDER, CLIENT_ACL); await apiPut(`/library/nodes/${encodeURIComponent(f.nodeId)}`, { spaceId: space, parentId }); say?.(sent(f) ? "送るのをやめました" : `${f.name} を企業担当者に送りました`); await load(); }
    catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(false); }
  };
  const remove = async f => {
    setDel(null); setBusy(true);
    try { await apiDelete(`/library/nodes/${encodeURIComponent(f.nodeId)}?spaceId=${encodeURIComponent(space)}`); say?.("削除しました"); await load(); }
    catch (e) { setErr(errText(e, "消せませんでした")); } finally { setBusy(false); }
  };
  const open = async f => { try { const r = await apiGet(`/library/download?spaceId=${encodeURIComponent(space)}&nodeId=${encodeURIComponent(f.nodeId)}`); window.open(r.url, "_blank", "noopener"); } catch (e) { setErr(errText(e, "開けませんでした")); } };
  return (
    <Card className="pad rp-card">
      <div className="head"><h2 className="h2">企業担当者に送るファイル</h2><span className="r"><Chip>受講生に非公開</Chip><Chip tone={st.files.some(sent) ? "ok" : ""}>送った {st.files.filter(sent).length} / {st.files.length}</Chip></span></div>
      {st.state === "error" ? <div className="empty"><b>ファイルを確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div> : <>
        <div className="fdrop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); upload([...(e.dataTransfer.files || [])]); }}><span><b>修了レポートのファイルをここに落とす</b><small>PDF・Word・Excel ・ 送るまで非公開</small></span><label className={`btn ghost sm${busy ? " off" : ""}`}>ファイルを選ぶ<input type="file" multiple className="lms-sr" onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ""; upload(fs); }} /></label></div>
        {err && <div className="lms-err" role="alert">{err}</div>}
        <div className="fd-l">{st.files.map(f => <div key={f.nodeId} className="fd-f"><FileIcon name={f.name} /><span className="fd-fb"><button type="button" className="st-lk st-fn" onClick={() => open(f)}>{f.name}</button><small className="num">{md(f.updatedAt)}</small></span>{sent(f) ? <Chip tone="ok">送信済み</Chip> : <Chip>未送信</Chip>}<span className="fd-ac"><Btn kind={sent(f) ? "ghost sm" : "sm"} disabled={busy} onClick={() => toggle(f)}>{sent(f) ? "送るのをやめる" : "送る"}</Btn><Btn kind="ghost sm" disabled={busy} onClick={() => setDel(f)}>削除</Btn></span></div>)}</div>
      </>}
      {del && <Modal title="ファイルを削除" width={420} onClose={() => setDel(null)} footer={<><Btn kind="ghost" onClick={() => setDel(null)}>やめる</Btn><Btn onClick={() => remove(del)}>削除</Btn></>}><b>{del.name}</b></Modal>}
    </Card>
  );
}

// 評価表の回のうち、点が入っている一番新しい回の項目ごとの平均
function evalSummary(doc, people) {
  const rounds = arr(doc?.rounds), items = arr(doc?.items);
  for (const r of [...rounds].reverse()) {
    const cells = doc?.cells?.[r.id] || {};
    const got = people.filter(p => items.some(x => { const v = cells[p.id]?.sc?.[x.id]; return v !== "" && v != null; }));
    if (!got.length) continue;
    return {
      name: r.name, n: got.length,
      rows: items.map(x => { const vs = got.map(p => Number(cells[p.id]?.sc?.[x.id])).filter(Number.isFinite); return { ...x, avg: vs.length ? vs.reduce((a, v) => a + v, 0) / vs.length : null }; }),
      total: id => { const c = cells[id]; if (!c) return null; const vs = items.map(x => c.sc?.[x.id]).filter(v => v !== "" && v != null).map(Number); return vs.length ? { got: vs.reduce((a, v) => a + v, 0), max: items.reduce((a, x) => a + Number(x.max), 0) } : null; },
    };
  }
  return null;
}

export default function InstructorDone({ say }) {
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const [st, setSt] = useState({ state: "loading", data: null });
  const [key, setKey] = useState(0);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [conf, setConf] = useState(false);
  const [cert, setCert] = useState(false);
  const [survey, setSurvey] = useState(undefined); const [evals, setEvals] = useState(undefined); const [dev, setDev] = useState(undefined);
  useEffect(() => {
    if (!courseId) return undefined;
    let alive = true;
    setSt({ state: "loading", data: null });
    apiGet(`/completion-report?courseId=${encodeURIComponent(courseId)}`).then(data => { if (alive) setSt({ state: "ready", data }); }).catch(() => { if (alive) setSt({ state: "error", data: null }); });
    apiGet(`/course-survey?courseId=${encodeURIComponent(courseId)}`).then(d => { if (alive) setSurvey(d); }).catch(() => { if (alive) setSurvey(null); });
    apiGet(`/evaluations?courseId=${encodeURIComponent(courseId)}`).then(d => { if (alive) setEvals(d); }).catch(() => { if (alive) setEvals(null); });
    // 個人開発：公開中の課題ごとの提出とレビュー
    apiGet(`/dev-assignments?courseId=${encodeURIComponent(courseId)}`).then(async d => {
      const open = arr(d?.items).filter(a => a.status === "open");
      const subs = await Promise.all(open.map(a => apiGet(`/dev-assignments/${encodeURIComponent(a.id)}/submissions?courseId=${encodeURIComponent(courseId)}`).then(r => arr(r?.rows))));
      if (alive) setDev({ n: open.length, rows: subs.flat() });
    }).catch(() => { if (alive) setDev(null); });
    return () => { alive = false; };
  }, [courseId, key]);
  if (sc.state === "loading" || (courseId && st.state === "loading")) return <div className="soon card">読み込み中</div>;
  if (sc.state === "error" || st.state === "error") return <Card><div className="empty"><b>修了レポートを確認できません</b><Btn kind="ghost sm" onClick={() => { sc.reload(); setKey(k => k + 1); }}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>修了レポート</b><Chip>コースなし</Chip></div></Card>;
  const d = st.data, o = d.overall || {}, r = d.report || {}, confirmed = r.status === "confirmed";
  const save = async action => {
    setBusy(action); setErr(""); setConf(false);
    try {
      const x = await apiPut("/completion-report", { courseId, summary: r.summary || "", traineeNotes: r.traineeNotes || {}, action });
      setSt(s => ({ ...s, data: { ...s.data, report: x.report } }));
      say?.(action === "confirm" ? "確定しました。企業担当者が見られます" : "確定を取り消しました");
    } catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(""); }
  };
  const people = arr(d.trainees), tests = arr(d.tests).filter(t => t.average != null);
  const days = d.period?.trainingDays || 0;
  const qAvg = arr(survey?.questions).map(q => survey?.avg?.[q.id]).filter(v => v != null);
  const sat = qAvg.length ? Math.round(qAvg.reduce((a, v) => a + Number(v), 0) / qAvg.length * 10) / 10 : null;
  const ev = evals ? evalSummary(evals, people) : null;
  const devOf = id => { const l = arr(dev?.rows).filter(x => x.traineeId === id); return l.filter(x => arr(x.files).length > 0).length; };
  const devSub = arr(dev?.rows).filter(x => arr(x.files).length > 0).length, devPts = arr(dev?.rows).map(x => arr(x.reviews).find(v => v.publishedAt)?.total).filter(v => v != null);
  const xlsx = () => saveXlsx(`修了レポート_${sc.course.name}`, "受講生", [["受講生", "出席率", "遅刻", "早退", "欠勤", "日報", "テスト平均", "個人開発", ...(ev ? [`評価表（${ev.name}）`] : [])], ...people.map(t => [t.name, t.attendanceRate ?? "", t.late, t.early, t.absent, `${t.reportDays}/${days}`, t.testAverage ?? "", dev ? `${devOf(t.id)}/${dev.n}` : "", ...(ev ? [ev.total(t.id) ? `${ev.total(t.id).got}/${ev.total(t.id).max}` : ""] : [])])]);
  return (
    <div className="st">
      <div className="head">
        <div><div className="eyebrow eb-c">{sc.course.name}</div><h1 className="h1">修了レポート</h1></div>
        <span className="r">{confirmed && <Btn kind="ghost sm" onClick={() => setCert(true)}>修了証</Btn>}<Btn kind="ghost sm" onClick={xlsx}>まとめを Excel で受け取る</Btn>{confirmed ? <Btn kind="ghost sm" disabled={!!busy} onClick={() => save("unconfirm")}>確定を取り消す</Btn> : <Btn kind="sm" disabled={!!busy} onClick={() => setConf(true)}>確定する</Btn>}</span>
      </div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {d.unknown && <div className="lms-err" role="alert">一部の受講生を確認できません（数字が少なく出ている場合があります）</div>}
      <Files courseId={courseId} say={say} />
      <Hero cat="rep" className="dc-hero" eyebrow="研修全体 ・ LMS の記録から" step={days ? `研修日 ${days} 日` : undefined} title={d.courseName}>
        <span className="row dc-tags">{[...new Set(people.map(t => t.companyName).filter(Boolean))].map(t => <Chip key={t}>{t}</Chip>)}{d.period?.startDate && <Chip>{d.period.startDate.replace(/-/g, "/")}〜{String(d.period.endDate || "").replace(/-/g, "/")}</Chip>}<Chip>受講生 {o.traineeCount ?? 0} 人</Chip></span>
        <Kpi items={[
          { label: "出席率", value: o.attendanceRate ?? "—", unit: o.attendanceRate != null ? "%" : "", pct: o.attendanceRate ?? undefined, note: `遅刻 ${o.late ?? 0} ・ 欠勤 ${o.absent ?? 0}` },
          { label: "日報の提出", value: o.reportRate ?? "—", unit: o.reportRate != null ? "%" : "", pct: o.reportRate ?? undefined, note: `${(o.reportDays ?? 0).toLocaleString()} 件` },
          { label: "テストの平均", value: o.testAverage ?? "—", unit: o.testAverage != null ? "点" : "", pct: o.testAverage ?? undefined, note: `${arr(d.tests).length} 回` },
          { label: "満足度", value: sat ?? "—", unit: sat != null ? "/ 5" : "", pct: sat != null ? Math.round(sat / 5 * 100) : undefined, note: survey ? `回答 ${survey.n} / ${survey.of} 人` : undefined },
        ]} />
      </Hero>
      <div className="g2e">
        <Card className="pad rp-ch"><div className="head"><h2 className="h3">テストの平均</h2><span className="r"><Chip>受けた順</Chip></span></div>{tests.length ? <BarChart vals={tests.map(t => t.average)} labels={tests.map(t => t.title)} /> : <Chip>なし</Chip>}</Card>
        <Card className="pad">
          <div className="head"><h2 className="h3">評価表 ・ 項目ごとの平均</h2>{ev && <span className="r"><Chip tone="mk">{ev.name} ・ {ev.n} 人分</Chip></span>}</div>
          {evals === null ? <Chip>確認できません</Chip> : ev ? <div className="rp-ev">{[["com", "コミュニケーション面"], ["tech", "技術面"]].map(([g, t]) => <div key={g} className={`evg ${g}`}><span className="evgh">{t}</span>{ev.rows.filter(x => x.group === g).map(x => <div key={x.id} className="rp-evr"><span>{x.label || x.name}</span><span className="rp-evb"><i style={{ "--w": `${x.avg != null ? Math.round(x.avg / Number(x.max) * 100) : 0}%` }} /></span><b className="num">{x.avg != null ? x.avg.toFixed(1) : "—"}</b><small>/ {x.max}</small></div>)}</div>)}</div> : <Chip>なし</Chip>}
        </Card>
      </div>
      <div className="g2e">
        <SurveyCard courseId={courseId} say={say} />
        <Card className="pad">
          <div className="head"><h2 className="h3">日報・個人開発</h2></div>
          <div className="rowsx rp-dv">
            <div><span>日報の提出</span><b>{(o.reportDays ?? 0).toLocaleString()} / {(o.reportTotal ?? 0).toLocaleString()} 件{o.reportRate != null ? `（${o.reportRate}%）` : ""}</b></div>
            <div><span>講師のコメント</span><b>{(o.staffComments ?? 0).toLocaleString()} 件</b></div>
            <div><span>企業担当者のコメント</span><b>{(o.clientComments ?? 0).toLocaleString()} 件</b></div>
            <div><span>個人開発の提出</span><b>{dev === null ? "確認できません" : dev ? `課題 ${dev.n} つ ・ 提出 ${devSub} / ${dev.rows.length}` : "—"}</b></div>
            <div><span>個人開発の平均点</span><b>{devPts.length ? `${Math.round(devPts.reduce((a, v) => a + v, 0) / devPts.length)} 点` : "—"}</b></div>
          </div>
        </Card>
      </div>
      <Card className="pad">
        <div className="head"><h2 className="h3">受講生ごとのまとめ</h2><span className="r"><Btn kind="ghost sm" onClick={xlsx}>Excel で受け取る</Btn></span></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>受講生</th><th>出席率</th><th>遅刻・欠勤</th><th>日報</th><th>テスト平均</th><th>個人開発</th><th>評価表{ev ? `（${ev.name}）` : ""}</th></tr></thead><tbody>
          {people.map(t => {
            const tv = ev?.total(t.id);
            return <tr key={t.id}><td><span className="row st-nw"><span className="face sm">{t.name.slice(0, 1)}</span><b>{t.name}</b></span></td><td className="num">{pct(t.attendanceRate)}</td><td className="num">{[t.late > 0 && `遅刻 ${t.late}`, t.early > 0 && `早退 ${t.early}`, t.absent > 0 && `欠勤 ${t.absent}`].filter(Boolean).join(" ・ ") || "0"}</td><td className="num">{t.reportDays}/{days}</td><td className="num">{t.testAverage == null ? "—" : `${t.testAverage} 点`}</td><td className="num">{dev ? `${devOf(t.id)}/${dev.n}` : "—"}</td><td>{tv ? <Chip tone="ok">{tv.got} / {tv.max} 点</Chip> : <Chip>まだ</Chip>}</td></tr>;
          })}
          {!people.length && <tr><td colSpan={7}><Chip>なし</Chip></td></tr>}
        </tbody></table></div>
      </Card>
      {cert && <CertModal people={people} course={d.courseName} start={d.period?.startDate} end={d.period?.endDate} confirmedAt={r.confirmedAt} onClose={() => setCert(false)} />}
      {conf && <Modal title="修了レポートを確定しますか？" width={440} onClose={() => setConf(false)} footer={<><Btn kind="ghost" onClick={() => setConf(false)}>やめる</Btn><Btn onClick={() => save("confirm")}>確定する</Btn></>}><div className="row"><Chip>企業担当者が読めます</Chip><Chip>あとで取り消せます</Chip></div></Modal>}
    </div>
  );
}
