import React, { useEffect, useState } from "react";
import { apiGet } from "../../../api.js";
import { getActiveCourseId, setActiveCourseId } from "../../../utils/common/courseContext.js";

// 受講中のコースの切り替え。2 つ以上のコースに入っているときだけ出す（training/CourseSwitcher.jsx と同じ決まり）
export default function CourseSwitch({ onChange }) {
  const [courses, setCourses] = useState([]);
  const [cur, setCur] = useState(() => getActiveCourseId());
  useEffect(() => {
    let alive = true;
    apiGet("/me/courses").then(list => {
      if (!alive) return;
      const rows = (Array.isArray(list) ? list : []).filter(c => c?.courseId);
      setCourses(rows);
      if (rows.length && !rows.some(r => r.courseId === getActiveCourseId())) { setActiveCourseId(rows[0].courseId); setCur(rows[0].courseId); }
    }).catch(() => { /* 読めないときは出さない */ });
    return () => { alive = false; };
  }, []);
  if (courses.length < 2) return null;
  return (
    <label className="lms-cs">コース
      <select value={cur} aria-label="受講中のコース" onChange={e => { setActiveCourseId(e.target.value); setCur(e.target.value); onChange(); }}>
        {courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name || c.courseId}</option>)}
      </select>
    </label>
  );
}
