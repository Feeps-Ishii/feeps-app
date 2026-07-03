import React from "react";
import { ArrowUpRight } from "lucide-react";
import Card from "./Card.jsx";
import { T } from "./theme.js";

export default function Stat({ icon: Icon, label, value, sub, tone = "cyan", trend }) {
  const t = { cyan: T.accent, green: T.success, amber: T.warning, red: T.danger, muted: T.textMuted };
  return <Card className="p-4">
    <div className="flex items-start justify-between">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentSubtle, color: t[tone] }}><Icon size={18} /></div>
      {trend && <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: T.success }}><ArrowUpRight size={13} />{trend}</span>}</div>
    <div className="mt-3 text-2xl font-bold" style={{ color: T.textPrimary }}>{value}</div>
    <div className="text-xs" style={{ color: T.textMuted }}>{label}</div>
    {sub && <div className="mt-0.5 text-xs" style={{ color: T.textMuted }}>{sub}</div>}</Card>;
}
