import React from "react";
import { T } from "./theme.js";

export default function Badge({ tone = "muted", children }) {
  const m = { muted: [T.border, T.textSecondary], cyan: [T.accentSubtle, T.accentHover], green: [T.successSubtle, T.success], amber: [T.warningSubtle, T.warning], red: [T.dangerSubtle, T.danger] };
  const [bg, fg] = m[tone];
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: bg, color: fg }}>{children}</span>;
}
