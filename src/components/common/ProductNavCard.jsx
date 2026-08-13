import React from "react";
import { NOVA, PRODUCT_ACCENT } from "./theme.js";

// Feature-navigation card shown under a Product-home hero (3-col grid / 1-col mobile).
// Icon chips take the product's subtle bg + accent icon — identical for every card in
// a Product (do not vary per card). `highlight` (max ONE per Home) draws the product
// accent border and an optional small badge (subtle bg + deep text).
//
// `locked`（2026-08-13、研修管理/学習モード分離ADR0014のプラン制限UI用）: 契約プランで
// 使えない機能を隠さず、グレーアウト＋バッジ（プラン名）＋「プランを見る」導線で見せる。
// クリックしても本来の機能へは遷移させず、`onPlanClick`のみを呼ぶ（ルート要素をbutton→divへ
// 変える形。既存6箇所の呼び出しは`locked`を渡さないため、この分岐に入らず従来どおり動く）。
export default function ProductNavCard({
  product = "training", icon: Icon, title, desc, onClick, highlight = false, badge,
  locked = false, onPlanClick, delay = 0, className = "", style = {}, ...rest
}) {
  const pa = PRODUCT_ACCENT[product] || PRODUCT_ACCENT.training;
  const Tag = locked ? "div" : "button";
  const tagProps = locked ? {} : { type: "button", onClick };
  return (
    <Tag {...rest} {...tagProps}
      className={`feeps-navcard feeps-stagger-in relative flex min-w-0 flex-col items-start gap-4 rounded-[18px] p-5 text-left ${className}`}
      style={{
        "--pa-accent": pa.accent,
        background: locked ? NOVA.paper : NOVA.card,
        border: `1px solid ${highlight && !locked ? pa.accent : NOVA.line}`,
        boxShadow: !locked && highlight ? NOVA.shadowMd : NOVA.shadowSm,
        animationDelay: `${delay}ms`,
        ...style,
      }}>
      {badge && (highlight || locked) && (
        <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={locked
            ? { background: NOVA.soft, color: NOVA.quiet, border: `1px solid ${NOVA.line}` }
            : { background: pa.subtle, color: pa.deep, border: `1px solid ${NOVA.line}` }}>
          {badge}
        </span>
      )}
      <span className="flex h-11 w-11 items-center justify-center rounded-[14px]"
        style={{ background: locked ? NOVA.soft : pa.subtle, color: locked ? NOVA.quiet : pa.deep, border: `1px solid ${NOVA.line}` }}>
        {Icon && <Icon size={20} strokeWidth={1.8} aria-hidden="true" />}
      </span>
      <span className="min-w-0">
        <span className="block break-words text-base font-bold" style={{ color: locked ? NOVA.quiet : NOVA.ink }}>{title}</span>
        {desc && <span className="mt-1 block break-words text-[13px] leading-relaxed" style={{ color: NOVA.muted }}>{desc}</span>}
      </span>
      {locked && (
        <button type="button" onClick={onPlanClick}
          className="mt-1 w-full rounded-[10px] py-2 text-[13px] font-semibold"
          style={{ background: "transparent", border: `1px solid ${NOVA.line}`, color: NOVA.muted }}>
          プランを見る
        </button>
      )}
    </Tag>
  );
}
