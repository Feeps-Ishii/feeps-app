import React from "react";

/* AI採点の結果（基準ごとの ✓／✕ と講評）。管理の画面と受講生の画面で同じ形。
   tone：ok（合格）／ng（やり直し）／warn（先に進んだ・採点できなかった）。label が無ければ帯を出さない */
export default function GradeView({ label, tone, sub, results, review, children }) {
  return (
    <div className="grade-view">
      {label && <div className={`gverdict ${tone || ""}`}><b>{label}</b>{sub && <span>{sub}</span>}</div>}
      {(results || []).length > 0 && (
        <ul className="crit">
          {results.map((r, i) => (
            <li key={i}>
              <span className={`mk ${r.met ? "y" : r.must ? "n" : "p"}`} aria-label={r.met ? "満たしている" : "満たしていない"}>{r.met ? "✓" : r.must ? "✕" : "－"}</span>
              <span>{r.text}<small>{r.must ? "必須" : "見る点"}{r.note ? ` ・ ${r.note}` : ""}</small></span>
            </li>
          ))}
        </ul>
      )}
      {review && <div className="rv"><div className="who">AI</div><div className="bubble" style={{ whiteSpace: "pre-wrap" }}>{review}</div></div>}
      {children}
    </div>
  );
}
