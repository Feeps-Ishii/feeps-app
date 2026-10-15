import React, { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { apiGet } from "../../api.js";
import { getActiveCourseId, setActiveCourseId } from "../../utils/common/courseContext.js";

/* 受講生のコースの切り替え（2026-10-15 ユーザー指定）。サイドバーの上に置き、2つ以上のコースに入っているときだけ出す。
   画面ごとのコースの欄はやめ、どの画面もここで選んだコース（getActiveCourseId）を使う。
   切り替えたら onChange で画面を読み直してもらう */
export default function CourseSwitcher({ onChange, dark = false }) {
  const [courses, setCourses] = useState([]);
  const [cur, setCur] = useState(() => getActiveCourseId());
  useEffect(() => {
    let alive = true;
    apiGet("/me/courses").then(list => {
      if (!alive) return;
      const rows = (Array.isArray(list) ? list : []).filter(c => c?.courseId);
      setCourses(rows);
      const active = getActiveCourseId();
      if (rows.length && !rows.some(r => r.courseId === active)) { setActiveCourseId(rows[0].courseId); setCur(rows[0].courseId); }
    }).catch(() => { /* 読めないときは出さない（各画面は1つ目のコースで動く） */ });
    return () => { alive = false; };
  }, []);
  if (courses.length < 2) return null;
  const change = id => { setActiveCourseId(id); setCur(id); onChange?.(id); };
  return (
    <label className="block px-1 pb-2">
      <span className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-bold" style={{ color: dark ? "#9AA6BF" : "#6B7280", letterSpacing: "0.06em" }}><BookOpen size={12} />受講中のコース</span>
      <select value={cur} onChange={e => change(e.target.value)} aria-label="受講中のコース"
        className="w-full truncate rounded-xl px-3 py-2 text-[13px] font-bold outline-none"
        style={dark ? { background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.14)", color: "#fff" } : { background: "#fff", border: "1px solid #E5E9F0", color: "#18202F" }}>
        {courses.map(c => <option key={c.courseId} value={c.courseId} style={{ color: "#18202F" }}>{c.name || c.courseId}</option>)}
      </select>
    </label>
  );
}
