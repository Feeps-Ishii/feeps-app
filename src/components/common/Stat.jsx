import React from "react";
import { ArrowUpRight } from "lucide-react";
import Card from "./Card.jsx";
import { T, NOVA } from "./theme.js";

export default function Stat({ icon: Icon, label, value, sub, tone = "cyan", trend, className = "", style = {}, ...rest }) {
  const tones = {
    cyan: { fg: NOVA.accentDeep, bg: NOVA.accentSoft },
    green: { fg: T.success, bg: T.successSubtle },
    amber: { fg: T.warning, bg: T.warningSubtle },
    red: { fg: T.danger, bg: T.dangerSubtle },
    muted: { fg: NOVA.muted, bg: NOVA.soft },
  };
  const current = tones[tone] || tones.muted;
  return (
    <Card {...rest} className={`p-5 ${className}`} style={style}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px]" style={{ background: current.bg, color: current.fg, border: `1px solid ${NOVA.line}` }}>
          {Icon && <Icon size={19} aria-hidden="true" />}
        </div>
        {trend && <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: T.success }}><ArrowUpRight size={13} aria-hidden="true" />{trend}</span>}
      </div>
      <div className="mt-4 text-[26px] font-bold leading-none" style={{ color: NOVA.ink, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div className="mt-2 text-xs font-semibold" style={{ color: NOVA.muted }}>{label}</div>
      {sub && <div className="mt-1 text-xs leading-relaxed" style={{ color: NOVA.muted }}>{sub}</div>}
    </Card>
  );
}
