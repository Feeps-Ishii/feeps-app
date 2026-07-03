import React from "react";
import { PRODUCT_ACCENT } from "./theme.js";
import useCountUp from "../../hooks/common/useCountUp.js";

const NUM = { fontVariantNumeric: "tabular-nums" };

function Chip({ label, value, unit, delay }) {
  const isNumber = typeof value === "number";
  const shown = useCountUp(isNumber ? value : 0);
  return (
    <div className="feeps-stagger-in min-w-[120px] rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", animationDelay: `${delay}ms` }}>
      <div className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>{label}</div>
      <div className="mt-0.5 text-2xl font-bold text-white" style={NUM}>
        {isNumber ? shown : value}
        {unit && <span className="ml-0.5 text-xs font-normal" style={{ color: "rgba(255,255,255,0.7)" }}>{unit}</span>}
      </div>
    </div>
  );
}

// Phase 2 Product-home hero. Identical structure across all six Products —
// only the product accent and copy differ (approved mock).
// chips: [{ label, value, unit? }] — numeric values count up (shared useCountUp),
// strings render statically. cta: { label, icon?, onClick } renders as the single
// white CTA (deep-colored text). Decoration is limited to the concentric-circle +
// polyline SVG; do not add more.
export default function PageHeader({ product = "training", label, title, description, chips = [], cta }) {
  const pa = PRODUCT_ACCENT[product] || PRODUCT_ACCENT.training;
  const CtaIcon = cta?.icon;
  return (
    <div className="feeps-hero-in relative mb-6 overflow-hidden p-6 sm:p-[36px_40px]" style={{ borderRadius: 16, background: `linear-gradient(120deg, ${pa.gradFrom} 0%, ${pa.gradTo} 100%)` }}>
      <svg className="pointer-events-none absolute right-5 top-4 hidden sm:block" width="170" height="120" viewBox="0 0 170 120" fill="none" aria-hidden="true">
        <circle cx="124" cy="34" r="24" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
        <circle cx="124" cy="34" r="44" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" />
        <circle cx="124" cy="34" r="64" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        <path d="M10 104 L52 76 L86 90 L158 40" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="relative">
        {label && <div className="text-xs font-bold uppercase" style={{ color: "rgba(255,255,255,0.75)", letterSpacing: "0.14em" }}>{label}</div>}
        <h2 className="mt-1.5 break-words text-[30px] font-medium leading-snug text-white" style={{ letterSpacing: "-0.02em" }}>{title}</h2>
        {description && <p className="mt-1.5 break-words text-[13.5px]" style={{ color: "rgba(255,255,255,0.75)" }}>{description}</p>}
        {(chips.length > 0 || cta) && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            {chips.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                {chips.slice(0, 4).map((chip, i) => <Chip key={chip.label} {...chip} delay={450 + i * 70} />)}
              </div>
            )}
            {cta && (
              <button type="button" onClick={cta.onClick}
                className="feeps-hero-cta feeps-stagger-in inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold sm:w-auto"
                style={{ color: pa.deep, animationDelay: `${450 + Math.min(chips.length, 4) * 70}ms` }}>
                {CtaIcon && <CtaIcon size={15} />}{cta.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
