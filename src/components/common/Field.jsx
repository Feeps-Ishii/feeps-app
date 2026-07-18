import React from "react";
import { NOVA } from "./theme.js";

// Canonical form-input inline style, shared by admin/management forms.
// (Some screens use Tailwind class strings instead; both render the same look.)
export const fieldStyle = {
  width: "100%",
  border: `1px solid ${NOVA.line}`,
  borderRadius: 14,
  padding: "11px 13px",
  fontSize: 14,
  color: NOVA.ink,
  background: NOVA.card,
  boxShadow: NOVA.shadowSm,
};

export default function Field({ label, children, className = "", style = {}, ...rest }) {
  return (
    <label {...rest} className={`block ${className}`} style={style}>
      <div className="mb-1.5 text-xs font-semibold" style={{ color: NOVA.muted }}>{label}</div>
      {children}
    </label>
  );
}
