import React from "react";
import { NOVA, PRODUCT_ACCENT } from "./theme.js";
import useCountUp from "../../hooks/common/useCountUp.js";

const NUM = { fontVariantNumeric: "tabular-nums" };

function Chip({ label, value, unit, delay }) {
  const isNumber = typeof value === "number";
  const shown = useCountUp(isNumber ? value : 0);
  return (
    <div className="feeps-stagger-in min-w-[120px] rounded-[14px] px-4 py-3" style={{ background: NOVA.soft, border: `1px solid ${NOVA.line}`, animationDelay: `${delay}ms` }}>
      <div className="text-xs font-semibold" style={{ color: NOVA.muted }}>{label}</div>
      <div className="mt-1 text-2xl font-bold" style={{ ...NUM, color: NOVA.ink }}>
        {isNumber ? shown : value}
        {unit && <span className="ml-1 text-xs font-semibold" style={{ color: NOVA.muted }}>{unit}</span>}
      </div>
    </div>
  );
}

// Product-home hero. Identical structure across all Products: a white Nova surface
// with the Product color limited to the top accent and decorative details.
// chips: [{ label, value, unit? }] — numeric values count up (shared useCountUp),
// strings render statically. cta: { label, icon?, onClick } renders as a single,
// high-contrast dark action. Decoration is limited to the concentric-circle +
// polyline SVG and the Product accent strip.
export default function PageHeader({ product = "training", label, title, description, chips = [], cta, illustration, className = "", style = {}, ...rest }) {
  const pa = PRODUCT_ACCENT[product] || PRODUCT_ACCENT.training;
  const CtaIcon = cta?.icon;
  return (
    <section {...rest} className={`feeps-hero-in relative mb-6 overflow-hidden rounded-[18px] p-6 sm:p-[34px_38px] ${className}`} style={{ background: NOVA.card, border: `1px solid ${NOVA.line}`, boxShadow: NOVA.shadowMd, ...style }}>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${pa.gradFrom}, ${pa.gradTo})` }} aria-hidden="true" />
      <span className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full" style={{ background: pa.subtle }} aria-hidden="true" />
      {/* illustration未指定時は既存の同心円+折れ線デコレーションのまま（DevLab等、他利用箇所への影響なし）。
          製品ごとの見た目差別化（2026-08-17）はillustrationを渡す側だけに閉じる。 */}
      {illustration ? (
        <div className="pointer-events-none absolute right-5 top-4 hidden sm:block" aria-hidden="true">{illustration}</div>
      ) : (
        <svg className="pointer-events-none absolute right-5 top-4 hidden sm:block" width="170" height="120" viewBox="0 0 170 120" fill="none" aria-hidden="true" style={{ color: pa.accent }}>
          <circle cx="124" cy="34" r="24" stroke="currentColor" strokeWidth="1.5" opacity="0.22" />
          <circle cx="124" cy="34" r="44" stroke="currentColor" strokeWidth="1.5" opacity="0.16" />
          <circle cx="124" cy="34" r="64" stroke="currentColor" strokeWidth="1.5" opacity="0.11" />
          <path d="M10 104 L52 76 L86 90 L158 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.24" />
        </svg>
      )}
      <div className="relative">
        {label && <div className="flex items-center gap-2 text-xs font-bold uppercase" style={{ color: NOVA.muted, letterSpacing: "0.12em" }}><span className="h-2 w-2 rounded-full" style={{ background: pa.accent }} />{label}</div>}
        <h2 className="mt-2 break-words text-[30px] font-bold leading-snug sm:text-[34px]" style={{ color: NOVA.ink, letterSpacing: "-0.03em" }}>{title}</h2>
        {description && <p className="mt-2 max-w-3xl break-words text-sm leading-6" style={{ color: NOVA.muted }}>{description}</p>}
        {(chips.length > 0 || cta) && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            {chips.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                {chips.slice(0, 4).map((chip, i) => <Chip key={chip.label} {...chip} delay={120 + i * 40} />)}
              </div>
            )}
            {cta && (
              <button type="button" onClick={cta.onClick}
                className="feeps-hero-cta feeps-stagger-in inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-[14px] px-4 py-2.5 text-sm font-bold sm:w-auto"
                style={{ color: NOVA.onDark, background: NOVA.ink, boxShadow: NOVA.shadowMd, animationDelay: `${120 + Math.min(chips.length, 4) * 40}ms` }}>
                {CtaIcon && <CtaIcon size={15} aria-hidden="true" />}{cta.label}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
