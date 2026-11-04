import React, { Suspense, lazy, useEffect, useState } from "react";
import { apiGet } from "../../../api.js";
import { Btn, Card, Chip, Modal } from "../parts/ui.jsx";
import { arr, useRoster, useStaffCourse } from "../staff/common.js";

const PracticeView = lazy(() => import("../../training/PracticeView.jsx"));

/* 講師の練習問題：上に受講生の「できた」の進み（問題集ごと）、下は今の編集画面（Word の取り込み・直す・公開） */

export default function InstructorPractice({ role }) {
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const { list: roster } = useRoster(courseId);
  const [sets, setSets] = useState(undefined);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (!courseId) return undefined;
    let alive = true;
    apiGet(`/practice?courseId=${encodeURIComponent(courseId)}`).then(async r => {
      const items = arr(r?.items).filter(s => s.status === "published");
      const full = await Promise.all(items.map(s => apiGet(`/practice/${encodeURIComponent(s.id)}/progress?courseId=${encodeURIComponent(courseId)}`).then(p => ({ ...s, rows: arr(p?.items) })).catch(() => ({ ...s, rows: null }))));
      if (alive) setSets(full);
    }).catch(() => { if (alive) setSets(null); });
    return () => { alive = false; };
  }, [courseId]);
  const n = roster?.length || 0;
  const avgOf = s => { const q = s.counts?.questions || 0; return q && n && s.rows ? Math.round(s.rows.reduce((a, r) => a + r.done, 0) / (q * n) * 100) : 0; };
  return (
    <div className="st">
      {sets === null && <Card><div className="empty"><b>進みを確認できません</b></div></Card>}
      {arr(sets).length > 0 && (
        <Card className="pad">
          <div className="head"><h2 className="h2">受講生の進み</h2><span className="r"><Chip>できた（平均）</Chip></span></div>
          <div className="tp-ub">{sets.map(s => <div key={s.id} className="st-pr"><span>{s.title}</span><span className="tp-bar sm"><i style={{ "--w": `${avgOf(s)}%` }} /></span><b className="num">{s.rows ? `${avgOf(s)}%` : "?"}</b><Btn kind="ghost sm" disabled={!s.rows} onClick={() => setOpen(s)}>人ごと</Btn></div>)}</div>
        </Card>
      )}
      <div className="lms-legacy"><Suspense fallback={<div className="soon card">読み込み中</div>}><PracticeView role={role} /></Suspense></div>
      {open && (
        <Modal title={open.title} width={520} onClose={() => setOpen(null)} footer={<Btn kind="ghost" onClick={() => setOpen(null)}>閉じる</Btn>}>
          <div className="tp-ub">
            {[...arr(roster)].map(p => ({ ...p, done: open.rows.find(r => r.traineeId === p.id)?.done || 0 })).sort((a, b) => a.done - b.done).map(p => { const q = open.counts?.questions || 0; return <div key={p.id}><span>{p.name}</span><span className="tp-bar sm"><i style={{ "--w": `${q ? Math.round(p.done / q * 100) : 0}%` }} /></span><b className="num">{p.done} / {q}</b></div>; })}
          </div>
        </Modal>
      )}
    </div>
  );
}
