import React, { useEffect, useRef, useState } from "react";

/* コースを選ぶメニュー（ホームの頼む欄のコース選び・上の帯のコースの切り替えで使う）。
   コースが多くても探せるように、名前・企業で絞り込める */
export default function CourseMenu({ courses, value, allowAll = false, onPick, onClose }) {
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  const t = q.trim().toLowerCase();
  const list = t ? courses.filter(c => `${c.name} ${c.company}`.toLowerCase().includes(t)) : courses;
  return (
    <div className="dhc-cmenu" ref={ref}>
      {courses.length > 6 && <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="コース・企業で探す" aria-label="コースを探す" />}
      {allowAll && (
        <button type="button" className="dhc-ci" style={{ "--c": "#8E96A6" }} aria-current={!value} onClick={() => onPick("")}>
          <i /><span><b>すべてのコース</b><small>コースを決めずに頼む</small></span>
        </button>
      )}
      <span className="lab">{allowAll ? "コース" : "コースを切り替える"}</span>
      {list.map(c => (
        <button key={c.id} type="button" className="dhc-ci" style={{ "--c": c.color }} aria-current={value === c.id} onClick={() => onPick(c.id)}>
          <i /><span><b>{c.name}</b><small>{[c.company, c.term].filter(Boolean).join(" ・ ") || "　"}</small></span>
          {c.issues?.length ? <span className="dhc-pill warn">{c.issues.length}</span> : c.today === "training" ? <span className="dhc-pill ok">今日</span> : null}
        </button>
      ))}
      {!list.length && <span className="dhc-note" style={{ padding: 8 }}>見つかりません</span>}
    </div>
  );
}
