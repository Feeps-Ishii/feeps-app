import React from "react";
import { T, NOVA, AI_GRAD } from "./theme.js";

// type defaults to "button" so Btn inside a <form> never submits accidentally;
// pass type="submit" explicitly where submission is intended.
export default function Btn({ children, kind = "primary", icon: Icon, onClick, size = "md", full, type = "button", disabled, className = "", style = {}, title, "aria-label": ariaLabel, ...rest }) {
  const variants = {
    primary: { background: NOVA.gradAccent, color: NOVA.onDark, boxShadow: NOVA.shadowAccent },
    grad: { background: NOVA.gradAccentTeal, color: NOVA.onDark, boxShadow: NOVA.shadowAccent },
    ghost: { background: NOVA.card, color: NOVA.ink, border: `1px solid ${NOVA.line}`, boxShadow: NOVA.shadowSm },
    soft: { background: NOVA.accentSoft, color: NOVA.accentDeep, border: `1px solid ${NOVA.accentSoft}` },
    dark: { background: NOVA.railElevated, color: NOVA.onDark, border: `1px solid ${T.darkBorder}` },
    white: { background: NOVA.card, color: NOVA.accentDeep, border: `1px solid ${NOVA.line}`, boxShadow: NOVA.shadowSm },
    danger: { background: T.danger, color: NOVA.onDark },
    // "ai" remains the product-wide identity for AI-powered actions.
    ai: { background: AI_GRAD, color: NOVA.onDark, boxShadow: NOVA.shadowMd },
  };
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-5 py-3 text-sm" : "px-4 py-2 text-sm";
  const variant = variants[kind] || variants.primary;
  return (
    <button
      {...rest}
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[14px] font-semibold transition-[transform,filter,box-shadow] duration-200 hover:-translate-y-0.5 hover:brightness-[1.03] active:translate-y-0 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${pad}${full ? " w-full" : ""}${className ? ` ${className}` : ""}`}
      style={{ border: "none", ...variant, ...style }}
    >
      {Icon && <Icon size={size === "sm" ? 14 : size === "lg" ? 17 : 16} aria-hidden="true" />}
      {children}
    </button>
  );
}
