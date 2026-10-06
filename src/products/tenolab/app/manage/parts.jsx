import React from "react";

/* 管理の画面で共通に使う小さな部品 */
export function Title({ eyebrow, title, children }) {
  return (
    <div className="mttl">
      <div><span className="eyebrow">{eyebrow}</span><h1 className="h1">{title}</h1></div>
      {children && <div className="r">{children}</div>}
    </div>
  );
}

// 提出の状態 → [表示, chip の色]
export const VERDICT = { approved: ["合格", "done"], returned: ["やり直し", "ng"], skipped: ["先に進んだ", "warn"], submitted: ["採点できず", "warn"] };

export const fmtTime = iso => (iso ? new Date(iso).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

// お金（使用料はドルで来るので rate で円にする。端数は四捨五入）
export const yen = n => `¥${Math.round(Number(n) || 0).toLocaleString("ja-JP")}`;
export const usdToYen = (usd, rate) => (Number(usd) || 0) * (Number(rate) || 0);
export const PLAN_LABEL = { basic: "ベーシック", standard: "スタンダード", premium: "Premium" };

// 月ごとの使用料（AI と AWS の積み上げ、円）。points: [{ month: "2026-10", ai, aws }]
export function UsageChart({ points, partialLast }) {
  const W = 560, H = 190, L = 52, B = 26, T = 16;
  const top = Math.max(1, ...points.map(p => p.ai + p.aws));
  const step0 = Math.pow(10, Math.floor(Math.log10(top)));
  const step = [1, 2, 5, 10].map(k => k * step0).find(s => top / s <= 5) || step0 * 10;
  const max = Math.ceil(top / step) * step;
  const sy = v => T + (H - T - B) * (1 - v / max);
  const bw = 34, gap = (W - L - 10) / Math.max(1, points.length);
  const ticks = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="月ごとの使用料">
      {ticks.map(v => <g key={v}><line x1={L} x2={W - 6} y1={sy(v)} y2={sy(v)} stroke="#E2E5DD" /><text x={L - 8} y={sy(v) + 4} textAnchor="end" fontSize="10.5" fill="#767D8C" fontFamily="JetBrains Mono, monospace">{v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}</text></g>)}
      {points.map((p, i) => {
        const x = L + gap * i + (gap - bw) / 2, op = partialLast && i === points.length - 1 ? 0.55 : 1;
        return (
          <g key={p.month}>
            <rect x={x} y={sy(p.ai)} width={bw} height={Math.max(0, sy(0) - sy(p.ai))} fill="#2457E6" rx="2" opacity={op} />
            {p.aws > 0 && <rect x={x} y={sy(p.ai + p.aws)} width={bw} height={Math.max(0, sy(p.ai) - sy(p.ai + p.aws))} fill="#F29A38" rx="2" opacity={op} />}
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#454B57">{Number(p.month.slice(5))}月</text>
            <text x={x + bw / 2} y={sy(p.ai + p.aws) - 5} textAnchor="middle" fontSize="10.5" fill="#15171C" fontFamily="JetBrains Mono, monospace">{yen(p.ai + p.aws)}</text>
          </g>
        );
      })}
    </svg>
  );
}

// 「この提出で基準を試す」：AI採点の画面から案件体験の編集へ、試すコードを渡す
export const TRY_KEY = "tl-grade-try";
