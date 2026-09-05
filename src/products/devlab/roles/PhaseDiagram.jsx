import React from "react";
import { T } from "../../../components/common";
import { phasesFor, TIES, INFRA_PHASE } from "./phases.js";

// 工程図。ウォーターフォールはV字、アジャイルはスプリントの輪。
// **担当していない工程も薄く出す**（他の人がやっていることが見えている方が現場に近い）。
// インフラは工程の順番の外側なので、この図には入れず呼び出し側が帯として出す。

function Node({ p, on }) {
  const w = p.label.length > 8 ? 168 : 132;
  return (
    <g opacity={on ? 1 : 0.36}>
      <rect
        x={p.x - w / 2} y={p.y - 22} width={w} height={44} rx={9}
        fill={on ? T.accentSubtle : T.bgSurface}
        stroke={on ? T.accent : T.border}
        strokeWidth={on ? 2 : 1.5}
      />
      <text x={p.x} y={p.y - 1} textAnchor="middle" fontSize="13" fontWeight="700"
        fill={on ? T.accentHover : T.textPrimary}>{p.label}</text>
      <text x={p.x} y={p.y + 13} textAnchor="middle" fontSize="10.5" fill={T.textMuted}>{p.sub}</text>
    </g>
  );
}

export default function PhaseDiagram({ method = "waterfall", activePhases = [], className = "" }) {
  const list = phasesFor(method);
  const active = new Set(activePhases);
  // インフラだけを担当しているときは、図の工程はすべて他の人のもの
  const onlyInfra = activePhases.length > 0 && activePhases.every(p => p === INFRA_PHASE);

  return (
    <div className={`overflow-x-auto ${className}`}>
      <svg viewBox="0 0 920 420" role="img" className="block h-auto w-full" style={{ minWidth: 720 }}>
        <title>{method === "agile" ? "スプリントの工程図" : "V字モデルの工程図"}</title>

        {method === "waterfall" ? (
          <>
            <path d="M120 60 L420 360 L480 360 L780 60" fill="none" stroke={T.border} strokeWidth="2.5" />
            {Object.entries(TIES).map(([left, right]) => {
              const L = list.find(p => p.id === left);
              const R = list.find(p => p.id === right);
              const both = !onlyInfra && active.has(left) && active.has(right);
              return (
                <line key={left} x1={L.x + 68} y1={L.y} x2={R.x - 68} y2={R.y}
                  stroke={both ? T.accent : T.border} strokeWidth="1.5" strokeDasharray="5 5"
                  opacity={both ? 0.55 : 1} />
              );
            })}
            <text x="56" y="28" fontSize="11" fontWeight="700" fill={T.textMuted} letterSpacing="1.1">つくる</text>
            <text x="786" y="28" fontSize="11" fontWeight="700" fill={T.textMuted} letterSpacing="1.1">たしかめる</text>
          </>
        ) : (
          <>
            <ellipse cx="460" cy="200" rx="250" ry="130" fill="none" stroke={T.border} strokeWidth="2.5" />
            {[-54, 18, 90, 162, 234].map(deg => {
              const r = (deg * Math.PI) / 180;
              const x = 460 + 250 * Math.cos(r);
              const y = 200 + 130 * Math.sin(r);
              const a = (Math.atan2(130 * Math.cos(r), -250 * Math.sin(r)) * 180) / Math.PI;
              return (
                <path key={deg} d="M0,-6 L11,0 L0,6 Z" fill={T.textMuted}
                  transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${a.toFixed(1)})`} />
              );
            })}
            <text x="460" y="196" textAnchor="middle" fontSize="15" fontWeight="700" fill={T.textSecondary}>
              スプリント 2 週間
            </text>
            <text x="460" y="220" textAnchor="middle" fontSize="12" fill={T.textMuted}>
              終わるたびに動くものを見せ、次を決め直す
            </text>
          </>
        )}

        {list.map(p => <Node key={p.id} p={p} on={!onlyInfra && active.has(p.id)} />)}
      </svg>
    </div>
  );
}
