import React from "react";
import { T, GRAD, AI_GRAD } from "./theme.js";

// type defaults to "button" so Btn inside a <form> never submits accidentally;
// pass type="submit" explicitly where submission is intended.
export default function Btn({ children, kind = "primary", icon: Icon, onClick, size = "md", full, type = "button", disabled, className = "", title, "aria-label": ariaLabel }) {
  const s = { primary: { background: T.accent, color: "#fff" }, grad: { background: GRAD, color: "#fff" },
    ghost: { background: T.bgSurface, color: T.textPrimary, border: `1px solid ${T.border}` }, soft: { background: T.accentSubtle, color: T.accentHover },
    dark: { background: T.darkBgElevated, color: T.darkTextPrimary, border: `1px solid ${T.darkBorder}` }, white: { background: "#fff", color: T.accentHover },
    danger: { background: T.danger, color: "#fff" },
    // "ai" is the product-wide identity for AI-powered actions.
    ai: { background: AI_GRAD, color: "#fff", boxShadow: "0 2px 8px rgba(109,90,224,.35)" } };
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-5 py-3 text-sm" : "px-4 py-2 text-sm";
  return <button type={type} onClick={onClick} disabled={disabled} title={title} aria-label={ariaLabel}
    className={"inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition hover:opacity-90 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 " + pad + (full ? " w-full" : "") + (className ? " " + className : "")}
    style={{ border: "none", ...s[kind] }}>{Icon && <Icon size={size === "sm" ? 14 : 16} />}{children}</button>;
}
