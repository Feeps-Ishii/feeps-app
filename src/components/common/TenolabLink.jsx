import React from "react";

// ヘッダーに置く、テノラボ（体験型Eラーニング。別アプリ lab.html）への入口（2026-09-27〜）。
// 見た目はテノラボのロゴに合わせる（白地・墨の線・「ラボ」にだけ黄色の線）。アカウントは共通なので、開くとそのまま入れる。
// 2026-10-01: ロゴだけではEラーニングと伝わらないので「Eラーニングはこちら」を添える（スマホは「Eラーニング」）
export default function TenolabLink({ compact = false }) {
  return (
    <a href="/lab.html#/home" aria-label="Eラーニング（テノラボ）を開く" title="Eラーニング（テノラボ）を開く"
      className="inline-flex shrink-0 items-center gap-2 no-underline transition hover:-translate-y-px"
      style={{ color: "#15171C" }}>
      <span className={compact ? "hidden min-[400px]:inline text-[10px] font-bold" : "text-xs font-bold"} style={{ color: "#535D6E" }}>{compact ? "Eラーニング" : "Eラーニングはこちら"}</span>
      <span className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] bg-white"
        style={{ borderColor: "#15171C", padding: compact ? "3px 8px" : "5px 11px", boxShadow: "2px 2px 0 #15171C" }}>
        <span style={{ fontFamily: "'Dela Gothic One', 'Hiragino Kaku Gothic ProN', sans-serif", fontSize: compact ? 13 : 14, lineHeight: 1, letterSpacing: ".02em" }}>
          テノ<span style={{ backgroundImage: "linear-gradient(transparent 55%, #FFE14D 55%, #FFE14D 92%, transparent 92%)", padding: "0 .05em" }}>ラボ</span>
        </span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
      </span>
    </a>
  );
}
