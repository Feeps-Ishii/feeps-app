import React from "react";

// 各画面の見出しの行。
// 2026-10-01（ユーザー指定・全ロール共通）：何の画面かは上のバー（例「研修管理／カリキュラム」）に出ているので、
// 大きな見出しと説明文は画面に出さない。見出しは読み上げ用にだけ残し、ボタン（action）があれば右に置く。
export default function SectionHead({ icon: _icon, title, desc: _desc, action, className = "", style = {}, ...rest }) {
  return (
    <div {...rest} className={`${action ? "mb-4 flex flex-wrap items-center justify-end gap-3" : ""} ${className}`} style={style}>
      <h2 className="sr-only">{title}</h2>
      {action}
    </div>
  );
}
