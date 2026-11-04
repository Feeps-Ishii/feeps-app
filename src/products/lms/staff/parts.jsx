import React from "react";

// 講師・企業担当者で共通の小さな部品（モック cRing・cSeg・lineChart・barChart）

export function PRing({ n, of, tone = "" }) {
  const r = 44, c = 2 * Math.PI * r, pct = of ? Math.round(n / of * 100) : 0;
  return (
    <span className={`ih-ring ${tone}`}>
      <svg viewBox="0 0 108 108" aria-hidden="true">
        <circle cx="54" cy="54" r={r} className="tr" />
        <circle cx="54" cy="54" r={r} className="fg" strokeDasharray={`${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 54 54)" />
      </svg>
      <b>{pct}<small>%</small></b>
    </span>
  );
}

// parts = [[名前, 数, 色]]
export function PSeg({ parts }) {
  return (
    <>
      <span className="ih-seg">{parts.filter(p => p[1]).map(([t, n, k]) => <i key={t} className={`t-${k}`} style={{ flex: n }} />)}</span>
      <span className="ih-lg">{parts.map(([t, n, k]) => <span key={t} className={`t-${k}`}><i />{t}<b className="num">{n}</b></span>)}</span>
    </>
  );
}

export function LineChart({ pts, labels, lo, hi, unit = "" }) {
  if (pts.length < 2) return null;
  const W = 320, H = 150, L = 36, Rr = 12, T = 14, B = 26, x = i => L + i * (W - L - Rr) / (pts.length - 1), y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const last = pts.length - 1;
  // 見出しが重ならないよう、多いときは間引く
  const every = Math.ceil(pts.length / 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={labels.map((l, i) => `${l} ${pts[i]}${unit}`).join("、")}>
      {[lo, (lo + hi) / 2, hi].map(v => <React.Fragment key={v}><line x1={L} x2={W - Rr} y1={y(v)} y2={y(v)} className="gl" /><text x={L - 6} y={y(v) + 4} textAnchor="end" className="ax">{v}</text></React.Fragment>)}
      <path d={`${d} L${x(last)},${y(lo)} L${x(0)},${y(lo)}Z`} className="ar" /><path d={d} className="ln" />
      {pts.map((v, i) => <React.Fragment key={i}><circle cx={x(i)} cy={y(v)} r={i === last ? 4.5 : 3} className={`dt${i === last ? " end" : ""}`} />{(i % every === 0 || i === last) && <text x={x(i)} y={H - 8} textAnchor="middle" className="ax">{labels[i]}</text>}</React.Fragment>)}
      <text x={x(last)} y={y(pts[last]) - 10} textAnchor="end" className="vl">{pts[last]}{unit}</text>
    </svg>
  );
}

export function BarChart({ vals, labels, hi = 100 }) {
  const W = 320, H = 150, L = 10, T = 18, B = 26, bw = (W - L * 2) / Math.max(vals.length, 1);
  const short = s => (String(s).length > 5 ? `${String(s).slice(0, 5)}…` : s);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={labels.map((l, i) => `${l} ${vals[i]}点`).join("、")}>
      <line x1={L} x2={W - L} y1={H - B} y2={H - B} className="gl" />
      {vals.map((v, i) => {
        const h = v / hi * (H - T - B), cx = L + bw * i + bw / 2;
        return <React.Fragment key={i}><rect x={cx - bw * .3} y={H - B - h} width={bw * .6} height={h} rx="3" className={`br${i === vals.length - 1 ? " end" : ""}`} /><text x={cx} y={H - B - h - 5} textAnchor="middle" className="vl sm">{v}</text>{vals.length <= 7 && <text x={cx} y={H - 8} textAnchor="middle" className="ax">{short(labels[i])}</text>}</React.Fragment>;
      })}
    </svg>
  );
}

// テストの棒（合格点の線つき）
export function TestRow({ title, sub, score, unit = "点", prefix }) {
  const ng = score != null && score < 70;
  return (
    <div className={`kt-t${ng ? " ng" : ""}`}>
      <span className="kt-tb"><b>{title}</b>{sub && <small className="num">{sub}</small>}</span>
      <span className="kt-tbar"><i style={{ "--w": `${score ?? 0}%` }} /><em style={{ left: "70%" }} aria-hidden="true" /></span>
      <b className="num kt-sc">{prefix && <small>{prefix} </small>}{score ?? "—"}{score != null && !prefix && <small>{unit}</small>}</b>
    </div>
  );
}
