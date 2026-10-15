import React from "react";
import { NOVA } from "./theme.js";

export default function Card({ children, className = "", style = {}, hover, onClick, ...rest }) {
  const interactive = hover || typeof onClick === "function";
  // data-plain-card：背景色を指定していないふつうのカード。すりガラスの画面（feeps-glass-page）ではCSSで半透明の白にする（2026-10-15）
  return (
    <div
      data-plain-card={style?.background || style?.backgroundColor ? undefined : ""}
      {...rest}
      onClick={onClick}
      className={`rounded-[18px] transition-[transform,box-shadow,border-color] duration-200 ${interactive ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg " : ""}${className}`}
      style={{ background: NOVA.card, border: `1px solid ${NOVA.line}`, boxShadow: NOVA.shadowSm, ...style }}
    >
      {children}
    </div>
  );
}
