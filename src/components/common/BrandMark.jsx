import React from "react";
import { PRISM } from "./theme.js";

// Prism Bright ブランドマーク（2026-07-17確定のC3案）。
// ブロブ形は index.css の .feeps-blob（14秒周期のborder-radiusモーフ）で呼吸する。
// withWordmark で「Feeps One」の横長ロックアップになる（ログイン/ヘッダー用）。
export default function BrandMark({ size = 34, withWordmark = false, wordmarkSize = 17, wordmarkColor }) {
  const mark = (
    <span
      className="feeps-blob inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        background: PRISM.gradMark,
        boxShadow: `0 ${Math.max(3, Math.round(size * 0.16))}px ${Math.round(size * 0.45)}px rgba(79,107,240,.3)`,
      }}
      aria-hidden={withWordmark ? "true" : undefined}
      role={withWordmark ? undefined : "img"}
      aria-label={withWordmark ? undefined : "Feeps One"}
    >
      <b style={{ color: "#fff", fontSize: Math.round(size * 0.48), fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>F</b>
    </span>
  );
  if (!withWordmark) return mark;
  return (
    <span className="inline-flex items-center" style={{ gap: Math.max(8, Math.round(size * 0.26)) }}>
      {mark}
      <span style={{ fontSize: wordmarkSize, fontWeight: 800, letterSpacing: "-0.03em", color: wordmarkColor || PRISM.ink, whiteSpace: "nowrap" }}>
        Feeps <span style={{ color: PRISM.accent }}>One</span>
      </span>
    </span>
  );
}
