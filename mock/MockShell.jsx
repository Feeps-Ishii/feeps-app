import React from "react";
import { NOVA, T, PRODUCT_ACCENT } from "../src/components/common/theme.js";
import { Badge } from "../src/components/common/index.js";

// モック専用の簡易トップバー。実アプリのTrainingApp.jsx内トップバーの見た目（ブランド＋
// モード切替＋右側アクション）を再現するが、ロジックは持たない静的表示。
export function MockTopbar({ brand = "Feeps One", modes, activeMode, planTag, avatarLabel = "石" }) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-3.5" style={{ borderBottom: `1px solid ${NOVA.line}` }}>
      <span className="text-[15px] font-bold" style={{ color: NOVA.ink }}>{brand}</span>
      {modes && (
        <div className="flex gap-0.5 rounded-[11px] p-[3px]" style={{ background: NOVA.soft }}>
          {modes.map(m => {
            const active = m.key === activeMode;
            const pa = PRODUCT_ACCENT[m.key] || PRODUCT_ACCENT.training;
            return (
              <span key={m.key} className="rounded-lg px-4 py-1.5 text-[13px] font-semibold"
                style={active ? { background: pa.accent, color: "#fff" } : { color: NOVA.muted }}>
                {m.label}
              </span>
            );
          })}
        </div>
      )}
      <div className="ml-auto flex items-center gap-3 text-[13px]" style={{ color: NOVA.muted }}>
        {planTag && <Badge tone="cyan">{planTag}</Badge>}
        <span>使い方</span>
        <span>通知</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: T.accentSubtle, color: T.accent }}>{avatarLabel}</span>
      </div>
    </div>
  );
}

// 画面ごとの状況説明キャプション（判断用モックであることを常に示す）。
export function MockCaption({ children }) {
  return (
    <p className="mb-4 border-l-[3px] pl-3 text-[13px]" style={{ borderColor: T.accent, color: NOVA.muted }}>{children}</p>
  );
}

export function MockBody({ children }) {
  return <div className="p-5" style={{ background: NOVA.paper }}>{children}</div>;
}

export function MockApp({ children }) {
  return (
    <div className="overflow-hidden rounded-[14px]" style={{ background: NOVA.card, border: `1px solid ${NOVA.line}` }}>
      {children}
    </div>
  );
}

// 実際のProductNavCardは「1枚1バッジ・highlightは1画面1枚まで」という制約を持つ
// （src/components/common/ProductNavCard.jsx参照）。このモックはプラン差分を示すために
// 複数カードへ同時にバッジ（AI／Premium／Standard／体験できます等）を出す必要があり、
// その制約に合わない。ProductNavCard自体は拡張せず、モック専用の別カードとして用意する。
export function MockNavCard({ product = "training", icon: Icon, title, desc, badge, badgeTone = "plan", locked = false, ctaLabel, onCta }) {
  const pa = PRODUCT_ACCENT[product] || PRODUCT_ACCENT.training;
  const badgeStyle = badgeTone === "ai"
    ? { background: T.aiSubtle, color: T.aiAccentDeep }
    : badgeTone === "trial"
      ? { background: T.warningSubtle, color: T.warning }
      // "accent"はプラン制限ではない一般の目印（例:よく使う）。プランバッジ（product色）と混同しないよう分ける。
      : badgeTone === "accent"
        ? { background: T.accentSubtle, color: T.accent }
        : { background: pa.subtle, color: pa.deep };
  return (
    <div className="relative flex min-w-0 flex-col items-start gap-3 rounded-[18px] p-4"
      style={{ background: locked ? NOVA.paper : NOVA.card, border: `1px solid ${NOVA.line}` }}>
      {badge && (
        <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold" style={badgeStyle}>{badge}</span>
      )}
      <span className="flex h-11 w-11 items-center justify-center rounded-[14px]"
        style={{ background: locked ? NOVA.soft : pa.subtle, color: locked ? NOVA.quiet : pa.deep }}>
        {Icon && <Icon size={20} strokeWidth={1.8} aria-hidden="true" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold" style={{ color: locked ? NOVA.quiet : NOVA.ink }}>{title}</span>
        {desc && <span className="mt-1 block text-[13px] leading-relaxed" style={{ color: NOVA.muted }}>{desc}</span>}
      </span>
      {ctaLabel && (
        <button type="button" onClick={onCta}
          className="mt-1 w-full rounded-[10px] py-2 text-[13px] font-semibold"
          style={locked
            ? { background: "transparent", border: `1px solid ${NOVA.line}`, color: NOVA.muted }
            : { background: T.accent, color: "#fff" }}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
