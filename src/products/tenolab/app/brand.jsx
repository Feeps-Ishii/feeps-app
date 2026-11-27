import React from "react";

/* リーフィットのロゴ（2026-11-27 決定：折り紙の葉＋LEAFIT＋リーフィット）。
   モック docs/design/mockups/leafit-2026-11/leafit-logo-3.html（N 案）・leafit-site.html */
const FACETS = [
  ["16,84 24,42 50,50", "#8BD39B"], ["24,42 52,18 50,50", "#56B874"], ["52,18 84,16 50,50", "#8BD39B"],
  ["16,84 50,50 58,76", "#1F7A4C"], ["58,76 50,50 82,48", "#2E9A5E"], ["82,48 50,50 84,16", "#1F7A4C"],
];

export function LeafitMark({ size = 30, title }) {
  return (
    <svg width={size} height={size} viewBox="8 8 84 84" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : "true"} style={{ display: "block", flex: "none" }}>
      {FACETS.map(([p, c]) => <polygon key={p} points={p} fill={c} />)}
    </svg>
  );
}

// dark は暗い帯の上に置くとき（管理の画面）
export function LeafitLogo({ size = 30, dark = false }) {
  return (
    <span role="img" aria-label="リーフィット" style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.3), whiteSpace: "nowrap" }}>
      <LeafitMark size={size} />
      <span aria-hidden="true" style={{ display: "grid", lineHeight: 1 }}>
        <span style={{ fontFamily: "'Josefin Sans', 'Zen Kaku Gothic New', sans-serif", fontWeight: 600, letterSpacing: "0.18em", fontSize: Math.round(size * 0.62), color: dark ? "#FFFFFF" : "#10241A" }}>LEAFIT</span>
        <span style={{ fontWeight: 700, letterSpacing: "0.36em", fontSize: Math.max(9, Math.round(size * 0.31)), color: dark ? "#8BD39B" : "#2E9A5E", marginTop: Math.round(size * 0.13) }}>リーフィット</span>
      </span>
    </span>
  );
}

// AI コーチの印（チャットの吹き出しの横）
export function LeafAvatar() {
  return <LeafitMark size={17} />;
}
