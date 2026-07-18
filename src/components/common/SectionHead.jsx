import React from "react";
import { NOVA } from "./theme.js";

// Standard sub-screen heading row (Phase 3 spec): optional monotone icon,
// 20px medium -0.02em title, one-line muted description, primary action right.
export default function SectionHead({ icon: Icon, title, desc, action, className = "", style = {}, ...rest }) {
  return (
    <div {...rest} className={`feeps-hero-in mb-6 flex flex-wrap items-center justify-between gap-4 ${className}`} style={style}>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {Icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px]" style={{ color: NOVA.ink, background: NOVA.soft, border: `1px solid ${NOVA.line}` }}><Icon size={19} aria-hidden="true" /></span>}
          <h2 className="text-[22px] font-bold sm:text-2xl" style={{ color: NOVA.ink, letterSpacing: "-0.025em" }}>{title}</h2>
        </div>
        {desc && <p className={`${Icon ? "ml-[52px]" : ""} mt-1 max-w-3xl text-sm leading-6`} style={{ color: NOVA.muted }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}
