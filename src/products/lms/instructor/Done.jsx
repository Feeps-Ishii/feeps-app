import React, { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { uploadToFolder } from "../../training/DevReview.jsx";
import { Btn, Card, Chip, FileIcon, Hero, Kpi, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, errText, md, saveXlsx, useStaffCourse } from "../staff/common.js";
import { BarChart } from "../staff/parts.jsx";
import { CertModal } from "../staff/Cert.jsx";
import { SurveyCard } from "../staff/Survey.jsx";

/* 講師・コース担当者の修了レポート（モック done）：企業担当者に送るファイル、研修全体の数字、受講生ごとの一言、講師の所見、確定。
   ファイルはコースのフォルダの「修了レポート」に置く（送るまで企業担当者には見えない） */

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
    try { await apiDelete(`/library/nodes/${encodeURIComponent(f.nodeId)}?spaceId=${encodeURIComponent(space)}`); say?.("消しました"); await load(); }
    catch (e) { setErr(errText(e, "消せませんでした")); } finally { setBusy(false); }
  };
  const open = async f => { try { const r = await apiGet(`/library/download?spaceId=${encodeURIComponent(space)}&nodeId=${encodeURIComponent(f.nodeId)}`); window.open(r.url, "_blank", "noopener"); } catch (e) { setErr(errText(e, "開けませんでした")); } };
  return (
    <Card className="pad rp-card">
      <div className="head"><h2 className="h2">企業担当者に送るファイル</h2><span className="r"><Chip>受講生に非公開</Chip><Chip tone={st.files.some(sent) ? "ok" : ""}>送った {st.files.filter(sent).length} / {st.files.length}</Chip></span></div>
      {st.state === "error" ? <div className="empty"><b>ファイルを確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div> : <>
        <div className="fdrop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); upload([...(e.dataTransfer.files || [])]); }}><span><b>修了レポートのファイルをここに落とす</b><small>PDF・Word・Excel ・ 送るまで非公開</small></span><label className={`btn ghost sm${busy ? " off" : ""}`}>ファイルを選ぶ<input type="file" multiple className="lms-sr" onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ""; upload(fs); }} /></label></div>
        {err && <div className="lms-err" role="alert">{err}</div>}
        <div className="fd-l">{st.files.map(f => <div key={f.nodeId} className="fd-f"><FileIcon name={f.name} /><span className="fd-fb"><button type="button" className="st-lk st-fn" onClick={() => open(f)}>{f.name}</button><small className="num">{md(f.updatedAt)}</small></span>{sent(f) ? <Chip tone="ok">送信済み</Chip> : <Chip>未送信</Chip>}<span className="fd-ac"><Btn kind={sent(f) ? "ghost sm" : "sm"} disabled={busy} onClick={() => toggle(f)}>{sent(f) ? "送るのをやめる" : "送る"}</Btn><Btn kind="ghost sm" disabled={busy} onClick={() => setDel(f)}>消す</Btn></span></div>)}</div>
      </>}
      {del && <Modal title="ファイルを消す" width={420} onClose={() => setDel(null)} footer={<><Btn kind="ghost" onClick={() => setDel(null)}>やめる</Btn><Btn onClick={() => remove(del)}>消す</Btn></>}><b>{del.name}</b></Modal>}
    </Card>
  );
}

export default function InstructorDone({ say }) {
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const [st, setSt] = useState({ state: "loading", data: null });
  const [key, setKey] = useState(0);
  const [summary, setSummary] = useState(""); const [notes, setNotes] = useState({}); const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [conf, setConf] = useState(false);
  const [q, setQ] = useState(""); const [sort, setSort] = useState("name");
  const [cert, setCert] = useState(false);
  useEffect(() => {
    if (!courseId) return undefined;
    let alive = true;
    setSt({ state: "loading", data: null });
    apiGet(`/completion-report?courseId=${encodeURIComponent(courseId)}`).then(data => { if (!alive) return; setSt({ state: "ready", data }); setSummary(data?.report?.summary || ""); setNotes(data?.report?.traineeNotes || {}); setDirty(false); }).catch(() => { if (alive) setSt({ state: "error", data: null }); });
    return () => { alive = false; };
  }, [courseId, key]);
  if (sc.state === "loading" || (courseId && st.state === "loading")) return <div className="soon card">読み込み中</div>;
  if (sc.state === "error" || st.state === "error") return <Card><div className="empty"><b>修了レポートを確認できません</b><Btn kind="ghost sm" onClick={() => { sc.reload(); setKey(k => k + 1); }}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>修了レポート</b><Chip>コースなし</Chip></div></Card>;
  const d = st.data, o = d.overall || {}, r = d.report || {}, confirmed = r.status === "confirmed", editable = d.canEdit && !confirmed;
  const save = async action => {
    setBusy(action); setErr(""); setConf(false);
    try {
      const x = await apiPut("/completion-report", { courseId, summary, traineeNotes: notes, action });
      setSt(s => ({ ...s, data: { ...s.data, report: x.report } })); setDirty(false);
      say?.(action === "confirm" ? "確定しました。企業担当者が見られます" : action === "unconfirm" ? "確定を取り消しました" : "保存しました");
    } catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(""); }
  };
  const list = arr(d.trainees).filter(t => matchName(t.name, "", q)).sort((a, b) => (sort === "att" ? (a.attendanceRate ?? 101) - (b.attendanceRate ?? 101) : sort === "thi" ? (b.testAverage ?? -1) - (a.testAverage ?? -1) : a.name.localeCompare(b.name, "ja")));
  const tests = arr(d.tests).filter(t => t.average != null);
  const xlsx = () => saveXlsx(`修了レポート_${sc.course.name}`, "受講生", [["受講生", "出席率", "遅刻", "早退", "欠席", "日報", "テスト平均", "一言"], ...arr(d.trainees).map(t => [t.name, t.attendanceRate ?? "", t.late, t.early, t.absent, t.reportRate ?? "", t.testAverage ?? "", notes[t.id] || ""])]);
  return (
    <div className="st">
      <div className="head">
        <div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">修了レポート</h1></div>
        <span className="r">{confirmed ? <Chip tone="ok">確定 ・ 企業担当者に公開中</Chip> : <Chip tone="warn">下書き</Chip>}{dirty && <Chip tone="warn">保存していない変更</Chip>}{confirmed && <Btn kind="ghost sm" onClick={() => setCert(true)}>修了証</Btn>}<Btn kind="ghost sm" onClick={xlsx}>まとめを Excel で受け取る</Btn>{!confirmed && <Btn kind="ghost sm" disabled={!!busy} onClick={() => save("save")}>保存</Btn>}{confirmed ? <Btn kind="ghost sm" disabled={!!busy} onClick={() => save("unconfirm")}>確定を取り消す</Btn> : <Btn kind="sm" disabled={!!busy} onClick={() => setConf(true)}>確定する</Btn>}</span>
      </div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {d.unknown && <div className="lms-err" role="alert">一部の受講生を確認できません（数字が少なく出ている場合があります）</div>}
      <Files courseId={courseId} say={say} />
      <Hero cat="rep" className="dc-hero" eyebrow="研修全体 ・ LMS の記録から" step={d.period?.trainingDays ? `研修日 ${d.period.trainingDays} 日` : undefined} title={d.courseName}>
        <Kpi items={[
          { label: "出席率", value: o.attendanceRate ?? "—", unit: o.attendanceRate != null ? "%" : "", pct: o.attendanceRate ?? undefined, note: `遅刻 ${o.late ?? 0} ・ 欠勤 ${o.absent ?? 0}` },
          { label: "日報の提出", value: o.reportRate ?? "—", unit: o.reportRate != null ? "%" : "", pct: o.reportRate ?? undefined },
          { label: "テストの平均", value: o.testAverage ?? "—", unit: o.testAverage != null ? "点" : "", pct: o.testAverage ?? undefined, note: `${arr(d.tests).length} 回` },
          { label: "受講生", value: o.traineeCount ?? "—", unit: " 人" },
        ]} />
      </Hero>
      {tests.length > 0 && <Card className="pad rp-ch"><div className="head"><h2 className="h3">テストの平均</h2><span className="r"><Chip>受けた順</Chip></span></div><BarChart vals={tests.map(t => t.average)} labels={tests.map(t => t.title)} /></Card>}
      <SurveyCard courseId={courseId} say={say} />
      <Card className="pad">
        <div className="head"><h2 className="h3">講師の所見</h2></div>
        {editable ? <textarea rows={6} maxLength={4000} value={summary} aria-label="講師の所見" onChange={e => { setSummary(e.target.value); setDirty(true); }} /> : <p className="st-pre st-p">{summary || "—"}</p>}
      </Card>
      <ListTool q={q} onQ={setQ} placeholder="名前で探す" sorts={[["name", "名前順"], ["att", "出席率の低い順"], ["thi", "テスト平均の高い順"]]} sort={sort} onSort={setSort} />
      <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>受講生</th><th>出席率</th><th>遅刻・欠勤</th><th>日報</th><th>テスト平均</th><th>一言</th></tr></thead><tbody>
        {list.map(t => (
          <tr key={t.id}><td><b>{t.name}</b></td><td className="num">{pct(t.attendanceRate)}</td><td className="num">{[t.late > 0 && `遅刻 ${t.late}`, t.early > 0 && `早退 ${t.early}`, t.absent > 0 && `欠勤 ${t.absent}`].filter(Boolean).join(" ・ ") || "0"}</td><td className="num">{pct(t.reportRate)}</td><td className="num">{t.testAverage == null ? "—" : `${t.testAverage} 点`}</td>
            <td className="st-note">{editable ? <textarea rows={2} maxLength={600} value={notes[t.id] || ""} aria-label={`${t.name}への一言`} onChange={e => { setNotes(n => ({ ...n, [t.id]: e.target.value })); setDirty(true); }} /> : <span className="st-pre">{notes[t.id] || "—"}</span>}</td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={6}><Chip>見つかりません</Chip></td></tr>}
      </tbody></table></div></Card>
      {cert && <CertModal people={arr(d.trainees)} course={d.courseName} start={d.period?.startDate} end={d.period?.endDate} confirmedAt={r.confirmedAt} onClose={() => setCert(false)} />}
      {conf && <Modal title="修了レポートを確定しますか？" width={440} onClose={() => setConf(false)} footer={<><Btn kind="ghost" onClick={() => setConf(false)}>やめる</Btn><Btn onClick={() => save("confirm")}>確定する</Btn></>}><div className="row"><Chip>企業担当者が読めます</Chip><Chip>あとで取り消せます</Chip></div></Modal>}
    </div>
  );
}
