import React, { useId } from "react";

/* DevHub のマーク（2026-10-12 決定：アイコン B1「ハブ」。モック docs/design/mockups/devhub-brand/devhub-icon.html）。
   全体＝DevHub by Feeps（黒）／LMS＝DevHub LMS（Prism の青紫）／Learning＝DevHub Learning（黄色）。
   D の輪郭に点を置き、真ん中のハブから線でつなぐ。20px 以下では点と線を省いて形とハブだけにする（つぶれるため）。 */
const COLORS = {
  umb: { bg: "#15171C", fg: "#FFFFFF", hub: "#FFE14D" },
  lms: { bg: "grad", fg: "#FFFFFF", hub: "#FFFFFF" },
  lrn: { bg: "#FFE14D", fg: "#15171C", hub: "#15171C" },
};
const POINTS = [[15, 12], [15, 36], [26, 12], [35, 18], [35, 30], [26, 36]];

export function DevHubMark({ product = "lms", size = 32, title }) {
  const gid = `dhg${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const c = COLORS[product] || COLORS.lms;
  const small = size <= 20;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : "true"} style={{ display: "block", flex: "none" }}>
      {c.bg === "grad" && (
        <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1267B5" /><stop offset=".55" stopColor="#6843B7" /><stop offset="1" stopColor="#176B67" /></linearGradient></defs>
      )}
      <rect x="1" y="1" width="46" height="46" rx="13" fill={c.bg === "grad" ? `url(#${gid})` : c.bg} />
      <path d="M15 12 L26 12 L35 18 L35 30 L26 36 L15 36 Z" fill="none" stroke={c.fg} strokeWidth={small ? 3.4 : 2.6} strokeLinejoin="round" />
      {!small && POINTS.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <line x1="24" y1="24" x2={x} y2={y} stroke={c.fg} strokeWidth="1.3" opacity=".55" />
          <circle cx={x} cy={y} r="2.6" fill={c.fg} />
        </g>
      ))}
      <circle cx="24" cy="24" r={small ? 4.4 : 3.8} fill={c.hub} />
    </svg>
  );
}

// 文字の組み：「Dev**Hub** LMS」「Dev**Hub** Learning」「Dev**Hub**（by Feeps）」。dark は暗い帯の上に置くとき
const WORD_FONT = "'Bricolage Grotesque', 'Zen Kaku Gothic New', system-ui, sans-serif";
const PRODUCT = { lms: { label: "LMS", color: "#1267B5", dark: "#7FB6F0" }, lrn: { label: "Learning", color: "#B98F00", dark: "#FFE14D" } };

export function DevHubLogo({ product = "lms", size = 30, dark = false, by = false, color, className, style }) {
  const p = PRODUCT[product];
  const name = p ? `DevHub ${p.label}` : "DevHub by Feeps";
  return (
    <span className={className} role="img" aria-label={name}
      style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.27), whiteSpace: "nowrap", color: color || (dark ? "#FFFFFF" : "#15171C"), ...style }}>
      <DevHubMark product={p ? product : "umb"} size={size} />
      <span aria-hidden="true" style={{ fontFamily: WORD_FONT, fontSize: Math.round(size * 0.64), letterSpacing: "-0.035em", lineHeight: 1, fontWeight: 400 }}>
        Dev<span style={{ fontWeight: 800 }}>Hub</span>
        {p && <span style={{ fontWeight: 700, marginLeft: "0.28em", color: dark ? p.dark : p.color }}>{p.label}</span>}
        {(by || !p) && <span style={{ display: "block", fontSize: "0.47em", fontWeight: 500, letterSpacing: "0.02em", opacity: 0.6, marginTop: 3 }}>by Feeps</span>}
      </span>
    </span>
  );
}

export default DevHubLogo;
