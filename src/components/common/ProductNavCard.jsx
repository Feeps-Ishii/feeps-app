import React from "react";
import { NOVA, PRODUCT_ACCENT } from "./theme.js";

// Feature-navigation card shown under a Product-home hero (3-col grid / 1-col mobile).
// Icon chips take the product's subtle bg + accent icon — identical for every card in
// a Product (do not vary per card). `highlight` (max ONE per Home) draws the product
// accent border and an optional small badge (subtle bg + deep text).
export default function ProductNavCard({ product = "training", icon: Icon, title, desc, onClick, highlight = false, badge, delay = 0, className = "", style = {}, ...rest }) {
  const pa = PRODUCT_ACCENT[product] || PRODUCT_ACCENT.training;
  return (
    <button {...rest} type="button" onClick={onClick}
      className={`feeps-navcard feeps-stagger-in relative flex min-w-0 flex-col items-start gap-4 rounded-[18px] p-5 text-left ${className}`}
      style={{ "--pa-accent": pa.accent, background: NOVA.card, border: `1px solid ${highlight ? pa.accent : NOVA.line}`, boxShadow: highlight ? NOVA.shadowMd : NOVA.shadowSm, animationDelay: `${delay}ms`, ...style }}>
      {highlight && badge && (
        <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: pa.subtle, color: pa.deep, border: `1px solid ${NOVA.line}` }}>{badge}</span>
      )}
      <span className="flex h-11 w-11 items-center justify-center rounded-[14px]" style={{ background: pa.subtle, color: pa.deep, border: `1px solid ${NOVA.line}` }}>
        {Icon && <Icon size={20} strokeWidth={1.8} aria-hidden="true" />}
      </span>
      <span className="min-w-0">
        <span className="block break-words text-base font-bold" style={{ color: NOVA.ink }}>{title}</span>
        {desc && <span className="mt-1 block break-words text-[13px] leading-relaxed" style={{ color: NOVA.muted }}>{desc}</span>}
      </span>
    </button>
  );
}
