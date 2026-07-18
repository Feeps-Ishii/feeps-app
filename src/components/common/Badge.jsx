import React from "react";
import { T, NOVA } from "./theme.js";

export default function Badge({ tone = "muted", children, className = "", style = {}, ...rest }) {
  const tones = {
    muted: [NOVA.soft, NOVA.muted],
    cyan: [NOVA.accentSoft, NOVA.accentDeep],
    green: [T.successSubtle, T.success],
    amber: [T.warningSubtle, T.warning],
    red: [T.dangerSubtle, T.danger],
  };
  const [bg, fg] = tones[tone] || tones.muted;
  return (
    <span
      {...rest}
      className={`inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
      style={{ background: bg, color: fg, border: `1px solid ${NOVA.line}`, ...style }}
    >
      {children}
    </span>
  );
}
