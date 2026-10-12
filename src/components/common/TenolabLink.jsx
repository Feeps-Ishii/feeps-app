import React from "react";
import { DevHubMark } from "./DevHubMark.jsx";

// ヘッダーに置く、DevHub Learning（体験型Eラーニング。別アプリ lab.html）への入口（2026-09-27〜）。
// 2026-10-01: ロゴだけではEラーニングと伝わらないので「Eラーニングはこちら」を添える（スマホは「Eラーニング」）
// 2026-10-12: テノラボ → DevHub Learning（マークはハブ B1）。白地・墨の線・影の札はそのまま
export default function TenolabLink({ compact = false }) {
  return (
    <a href="/lab.html#/home" aria-label="Eラーニング（DevHub Learning）を開く" title="Eラーニング（DevHub Learning）を開く"
      className="inline-flex shrink-0 items-center gap-2 no-underline transition hover:-translate-y-px"
      style={{ color: "#15171C" }}>
      <span className={compact ? "hidden min-[400px]:inline text-[10px] font-bold" : "text-xs font-bold"} style={{ color: "#535D6E" }}>{compact ? "Eラーニング" : "Eラーニングはこちら"}</span>
      <span className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] bg-white"
        style={{ borderColor: "#15171C", padding: compact ? "3px 8px 3px 4px" : "4px 11px 4px 5px", boxShadow: "2px 2px 0 #15171C" }}>
        <DevHubMark product="lrn" size={compact ? 18 : 22} />
        <span style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: compact ? 13 : 14, lineHeight: 1, letterSpacing: "-0.03em", fontWeight: 700 }}>
          Learning
        </span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
      </span>
    </a>
  );
}
