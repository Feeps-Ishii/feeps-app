import React from "react";
import { NOVA } from "./theme.js";

export default function Card({ children, className = "", style = {}, hover, onClick, ...rest }) {
  const interactive = hover || typeof onClick === "function";
  return (
    <div
      {...rest}
      onClick={onClick}
      className={`rounded-[18px] transition-[transform,box-shadow,border-color] duration-200 ${interactive ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg " : ""}${className}`}
      style={{ background: NOVA.card, border: `1px solid ${NOVA.line}`, boxShadow: NOVA.shadowSm, ...style }}
    >
      {children}
    </div>
  );
}
