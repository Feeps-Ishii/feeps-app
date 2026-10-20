import React, { useEffect, useState } from "react";
import { apiGet, apiPut } from "../../api.js";
import ConfirmDialog from "./ConfirmDialog.jsx";

/* コースの設定（2026-10-20）。名前・期間・担当講師・コース担当者。
   管理者とコース担当者（自分のコースだけ）が開ける。コース担当者を付け外しできるのは管理者だけ。
   PUT /courses/{id} は name・type・memo を毎回送る決まり（送らないと空になる）なので、今の値のまま送る */
export default function CourseSettings({ course, role, onClose, onSaved }) {
  const [f, setF] = useState({ name: course.name || "", startDate: course.startDate || "", endDate: course.endDate || "", instructorIds: course.instructorIds || [], managerIds: course.managerIds || [] });
  const [instructors, setInstructors] = useState(null);
  const [managers, setManagers] = useState(null);
  useEffect(() => {
    apiGet("/admin/instructors").then(l => setInstructors(l || [])).catch(() => setInstructors([]));
    if (role === "admin") apiGet("/admin/users").then(l => setManagers((l || []).filter(u => u.role === "manager"))).catch(() => setManagers([]));
  }, [role]);
  const nameOf = (list, id) => (list || []).find(p => p.userId === id)?.name || "（名前なし）";
  const toggle = (k, id, on) => setF(x => ({ ...x, [k]: on ? [...new Set([...x[k], id])] : x[k].filter(v => v !== id) }));
  const diff = (a, b) => JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort());
  const rows = [
    ...(f.name !== course.name ? [["名前", `${course.name} → ${f.name}`]] : []),
    ...(f.startDate !== (course.startDate || "") || f.endDate !== (course.endDate || "") ? [["期間", `${course.startDate || "—"}〜${course.endDate || "—"} → ${f.startDate || "—"}〜${f.endDate || "—"}`]] : []),
    ...(diff(f.instructorIds, course.instructorIds || []) ? [["担当講師", f.instructorIds.map(id => nameOf(instructors, id)).join("、") || "なし"]] : []),
    ...(role === "admin" && diff(f.managerIds, course.managerIds || []) ? [["コース担当者", f.managerIds.map(id => nameOf(managers, id)).join("、") || "なし"]] : []),
  ];
  const bad = !f.name.trim() || (f.startDate && f.endDate && f.startDate > f.endDate);
  return (
    <ConfirmDialog title={`コースの設定 ・ ${course.name}`} runLabel="この内容で変える" canRun={rows.length > 0 && !bad}
      rows={rows} warn={bad ? "名前を入れ、終わりの日は始まりの日より後にしてください。" : rows.length ? "" : "変えるところを選んでください。"}
      onClose={onClose}
      onRun={async () => {
        await apiPut(`/courses/${encodeURIComponent(course.id)}`, {
          name: f.name.trim(), type: course.type || course.kind || "shinjin", memo: course.memo ?? course.description ?? "",
          startDate: f.startDate, endDate: f.endDate, instructorIds: f.instructorIds,
          ...(role === "admin" ? { managerIds: f.managerIds } : {}),
        });
        onSaved?.();
        return "変えました。";
      }}>
      <label className="dhc-field">名前<input value={f.name} maxLength={80} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></label>
      <div className="dhc-colmap">
        <label className="dhc-field">始まりの日<input type="date" value={f.startDate} onChange={e => setF(x => ({ ...x, startDate: e.target.value }))} /></label>
        <label className="dhc-field">終わりの日<input type="date" value={f.endDate} onChange={e => setF(x => ({ ...x, endDate: e.target.value }))} /></label>
      </div>
      <div className="dhc-field">担当講師
        {instructors === null ? <span className="dhc-note">読み込んでいます…</span> : !instructors.length ? <span className="dhc-note">講師がいません</span> : (
          <div className="dhc-checks">{instructors.map(p => (
            <label key={p.userId} className={f.instructorIds.includes(p.userId) ? "on" : ""}><input type="checkbox" checked={f.instructorIds.includes(p.userId)} onChange={e => toggle("instructorIds", p.userId, e.target.checked)} />{p.name || p.email}</label>
          ))}</div>)}
      </div>
      {role === "admin" && (
        <div className="dhc-field">コース担当者（このコースだけを扱える人）
          {managers === null ? <span className="dhc-note">読み込んでいます…</span> : !managers.length ? <span className="dhc-note">コース担当者がいません。人・企業 で、ロールを「コース担当者」にした人を作ってください。</span> : (
            <div className="dhc-checks">{managers.map(p => (
              <label key={p.userId} className={f.managerIds.includes(p.userId) ? "on" : ""}><input type="checkbox" checked={f.managerIds.includes(p.userId)} onChange={e => toggle("managerIds", p.userId, e.target.checked)} />{p.name || p.email}</label>
            ))}</div>)}
        </div>
      )}
    </ConfirmDialog>
  );
}
