import React from "react";
import { T } from "./theme.js";

// Standard sub-screen heading row (Phase 3 spec): optional monotone icon,
// 20px medium -0.02em title, one-line muted description, primary action right.
export default function SectionHead({ icon: Icon, title, desc, action }) {
  return (
    <div className="feeps-hero-in mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} className="shrink-0" style={{ color: T.textMuted }} />}
          <h2 className="font-medium" style={{ color: T.textPrimary, fontSize: 20, letterSpacing: "-0.02em" }}>{title}</h2>
        </div>
        {desc && <p className="mt-1 text-sm" style={{ color: T.textMuted }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}
