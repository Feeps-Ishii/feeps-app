import React from "react";

/* 管理の画面で共通に使う小さな部品 */
export function Title({ eyebrow, title, children }) {
  return (
    <div className="mttl">
      <div><span className="eyebrow">{eyebrow}</span><h1 className="h1">{title}</h1></div>
      {children && <div className="r">{children}</div>}
    </div>
  );
}

// 提出の状態 → [表示, chip の色]
export const VERDICT = { approved: ["合格", "done"], returned: ["やり直し", "ng"], skipped: ["先に進んだ", "warn"], submitted: ["採点できず", "warn"] };

export const fmtTime = iso => (iso ? new Date(iso).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

// 「この提出で基準を試す」：AI採点の画面から案件体験の編集へ、試すコードを渡す
export const TRY_KEY = "tl-grade-try";
