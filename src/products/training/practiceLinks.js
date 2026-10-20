import { useEffect, useState } from "react";
import { apiGet } from "../../api.js";

/* カリキュラムの単元 → 練習問題（2026-10-20）。練習問題の画面（PracticeView.jsx）は後から読み込むので、
   カリキュラムが使う小さな部分だけここに置く */
export const PRACTICE_FOCUS_KEY = "feeps.practiceFocus";
export function setPracticeFocus(focus) {
  try { sessionStorage.setItem(PRACTICE_FOCUS_KEY, JSON.stringify(focus)); } catch { /* 開くだけ */ }
}
export const practiceNumLabel = nums => {
  if (!nums?.length) return "";
  const s = [...nums].sort((a, b) => a - b);
  if (s.length === 1) return `問題${s[0]}`;
  return s.every((n, i) => !i || n === s[i - 1] + 1) ? `問題${s[0]}〜${s[s.length - 1]}` : `問題${s.join("・")}`;
};

// 公開中の問題集のうち、その単元と結んだ Lesson。取れなければ何も出さない（カリキュラムは止めない）
export function usePracticeLinks(courseId) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!courseId) { setItems([]); return undefined; }
    let alive = true;
    apiGet(`/practice?courseId=${encodeURIComponent(courseId)}`)
      .then(r => { if (alive) setItems((r?.items || []).filter(s => s.status === "published")); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [courseId]);
  return sectionId => items.flatMap(s => (s.lessons || []).filter(l => l.sectionId && l.sectionId === sectionId)
    .map(l => ({ setId: s.id, title: s.title, label: practiceNumLabel(l.nums), firstQ: l.firstQ, no: l.no })));
}
