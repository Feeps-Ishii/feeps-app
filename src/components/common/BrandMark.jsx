import React from "react";
import { DevHubMark } from "./DevHubMark.jsx";

// LMS のブランドマーク。2026-10-12 に「Feeps One」から「DevHub LMS」へ（マークはハブ B1、DevHubMark.jsx）。
// 呼び出し側はそのまま：withWordmark で「DevHub LMS」の横長ロックアップになる（ログイン/ヘッダー用）。
export default function BrandMark({ size = 34, withWordmark = false, wordmarkSize = 17, wordmarkColor }) {
  if (!withWordmark) return <DevHubMark product="lms" size={size} title="DevHub LMS" />;
  return (
    <span className="inline-flex items-center" style={{ gap: Math.max(8, Math.round(size * 0.26)) }}>
      <DevHubMark product="lms" size={size} />
      <span style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: wordmarkSize + 1, fontWeight: 400, letterSpacing: "-0.035em", color: wordmarkColor || "#15171C", whiteSpace: "nowrap", lineHeight: 1 }}>
        Dev<span style={{ fontWeight: 800 }}>Hub</span> <span style={{ fontWeight: 700, color: wordmarkColor ? "inherit" : "#1267B5" }}>LMS</span>
      </span>
    </span>
  );
}
