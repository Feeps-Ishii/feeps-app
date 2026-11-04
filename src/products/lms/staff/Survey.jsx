import React, { useCallback, useEffect, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { getActiveCourseId } from "../../../utils/common/courseContext.js";
import { Btn, Card, Chip, Modal } from "../parts/ui.jsx";
import { arr, errText } from "./common.js";

/* 研修アンケート（モック SURVEY）：講師が受け付けを始める → 受講生がホームから答える → 講師・企業担当者は集計だけ見る（だれの答えかは出さない） */

// 講師・企業担当者：修了レポートの中のカード
export function SurveyCard({ courseId, say }) {
  const [d, setD] = useState(undefined);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const load = useCallback(() => { apiGet(`/course-survey?courseId=${encodeURIComponent(courseId)}`).then(setD).catch(() => setD(null)); }, [courseId]);
  useEffect(() => { load(); }, [load]);
  if (d === undefined) return null;
  if (d === null) return <Card><div className="empty"><b>アンケートを確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div></Card>;
  if (!d.canEdit && !d.n) return null;
  const toggle = async () => {
    setBusy(true); setErr("");
    try { await apiPut(`/course-survey?courseId=${encodeURIComponent(courseId)}`, { courseId, open: !d.open }); say?.(d.open ? "受け付けを終えました" : "受け付けを始めました"); load(); }
    catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(false); }
  };
  return (
    <Card className="pad sc-c">
      <div className="head"><h2 className="h2">研修アンケート</h2><span className="r"><Chip>回答 {d.n} / {d.of} 人</Chip>{d.open && <Chip tone="ok">受付中</Chip>}{d.canEdit && <Btn kind={d.open ? "ghost sm" : "sm"} disabled={busy} onClick={toggle}>{d.open ? "受け付けを終える" : d.openedAt ? "もう一度受け付ける" : "受け付けを始める"}</Btn>}</span></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {d.n > 0 ? (
        <div className="kt-l">{arr(d.questions).map(q => { const v = d.avg?.[q.id]; return <div key={q.id} className="kt-t dc-q"><span className="kt-tb"><b>{q.t}</b></span><span className="kt-tbar"><i style={{ "--w": `${(v || 0) * 20}%` }} /></span><b className="num kt-sc">{v == null ? "—" : v.toFixed(1)}<small>/ 5</small></b></div>; })}</div>
      ) : <Chip>回答なし</Chip>}
      {arr(d.comments).length > 0 && <div className="sv-c"><span className="eyebrow">自由記述 ・ {d.comments.length} 件</span>{d.comments.map((c, i) => <p key={i}>{c}</p>)}</div>}
    </Card>
  );
}

// 受講生：ホームのカード。受付中だけ出す
export function SurveyPrompt({ say }) {
  const [courseId, setCourseId] = useState("");
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState({}); const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    apiGet("/me/courses").then(async cs => {
      const list = arr(cs), c = list.find(x => x.courseId === getActiveCourseId()) || list[0];
      if (!c) return;
      const r = await apiGet(`/course-survey?courseId=${encodeURIComponent(c.courseId)}`);
      if (alive) { setCourseId(c.courseId); setD(r); setScores(r.scores || {}); setComment(r.comment || ""); }
    }).catch(() => { /* 出さないだけ。ホームの他を止めない */ });
    return () => { alive = false; };
  }, []);
  if (!d?.open) return null;
  const all = arr(d.questions).every(q => scores[q.id]);
  const send = async () => {
    setBusy(true); setErr("");
    try { await apiPut("/course-survey/answer", { courseId, scores, comment }); setD(x => ({ ...x, answered: true })); setOpen(false); say?.("答えました。ありがとうございます"); }
    catch (e) { setErr(errText(e, "送れませんでした")); } finally { setBusy(false); }
  };
  return (
    <>
      <Card className="pad sv-p">
        <div><span className="eyebrow">研修アンケート</span><b>研修はいかがでしたか</b></div>
        <span className="row">{d.answered && <Chip tone="ok">回答済み</Chip>}<Chip>だれの答えかは講師に出ません</Chip><Btn kind={d.answered ? "ghost sm" : "sm"} onClick={() => setOpen(true)}>{d.answered ? "直す" : "答える"}</Btn></span>
      </Card>
      {open && (
        <Modal title="研修アンケート" width={560} onClose={() => setOpen(false)} footer={<><Btn kind="ghost" onClick={() => setOpen(false)}>やめる</Btn><Btn disabled={!all || busy} onClick={send}>{busy ? "送っています" : "送る"}</Btn></>}>
          <div className="row"><Chip>1 そう思わない</Chip><Chip>5 そう思う</Chip></div>
          {arr(d.questions).map(q => (
            <div key={q.id} className="sv-q" role="radiogroup" aria-label={q.t}>
              <b>{q.t}</b>
              <span className="seg">{[1, 2, 3, 4, 5].map(v => <button key={v} type="button" role="radio" aria-checked={scores[q.id] === v} aria-pressed={scores[q.id] === v} className="num" onClick={() => setScores(s => ({ ...s, [q.id]: v }))}>{v}</button>)}</span>
            </div>
          ))}
          <label className="field">自由記述（任意）<textarea rows={3} maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} /></label>
          {err && <div className="lms-err" role="alert">{err}</div>}
        </Modal>
      )}
    </>
  );
}
