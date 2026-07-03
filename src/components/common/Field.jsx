import React from "react";
import { T } from "./theme.js";

// Canonical form-input inline style, shared by admin/management forms.
// (Some screens use Tailwind class strings instead; both render the same look.)
export const fieldStyle = {
  width: "100%",
  border: `1px solid ${T.border}`,
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 13,
  color: T.textPrimary,
  background: "#fff",
};

export default function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold" style={{ color: T.textSecondary }}>{label}</div>
      {children}
    </label>
  );
}
