import React from "react";
import { T, PRODUCT_ACCENT } from "./theme.js";

// Feature-navigation card shown under a Product-home hero (3-col grid / 1-col mobile).
// Icon chips take the product's subtle bg + accent icon — identical for every card in
// a Product (do not vary per card). `highlight` (max ONE per Home) draws the product
// accent border and an optional small badge (subtle bg + deep text).
export default function ProductNavCard({ product = "training", icon: Icon, title, desc, onClick, highlight = false, badge, delay = 0 }) {
  const pa = PRODUCT_ACCENT[product] || PRODUCT_ACCENT.training;
  return (
    <button type="button" onClick={onClick}
      className="feeps-navcard feeps-stagger-in relative flex min-w-0 flex-col items-start gap-3 rounded-xl p-5 text-left"
      style={{ "--pa-accent": pa.accent, background: T.bgSurface, border: `1px solid ${highlight ? pa.accent : T.border}`, animationDelay: `${delay}ms` }}>
      {highlight && badge && (
        <span className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: pa.subtle, color: pa.deep }}>{badge}</span>
      )}
      <span className="flex h-10 w-10 items-center justify-center rounded-[10px]" style={{ background: pa.subtle, color: pa.accent }}>
        {Icon && <Icon size={19} strokeWidth={1.8} />}
      </span>
      <span className="min-w-0">
        <span className="block break-words text-[15px] font-semibold" style={{ color: T.textPrimary }}>{title}</span>
        {desc && <span className="mt-0.5 block break-words text-[12.5px] leading-relaxed" style={{ color: T.textMuted }}>{desc}</span>}
      </span>
    </button>
  );
}
