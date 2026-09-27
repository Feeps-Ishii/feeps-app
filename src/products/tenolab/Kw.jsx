import React from "react";

// 説明の文章の代わりに並べる、短い言葉の印（2026-09-27）。最初の1つは黄色にする。
// cls: "sm"（小さめ）／ "flow"（矢印でつなぐ）／ "inv"（黒い面の上）
export default function Kw({ items, cls = "", plainFirst = false }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <ul className={"kw" + (cls ? " " + cls : "")}>
      {list.map((t, i) => <li key={i} className={i === 0 && !plainFirst ? "m" : undefined}>{t}</li>)}
    </ul>
  );
}
