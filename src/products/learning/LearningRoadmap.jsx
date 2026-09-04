import React from "react";
import { T, PRODUCT_ACCENT } from "../../components/common";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, faint: T.textFaint, line: T.border };

// 2026-08-21: 学習ホームのロードマップ（承認モック: mock/learning-home の案A）。
//
// **全員に同じ5段**を見せ、いまどこにいるかだけを変える。コースを並べる案（案B）は
// 「どのコースをどの順に並べるか」を決める画面が別に要るので、まずこちらを出す。
// 案Bへ差し替えるときは、この STEPS を配列で受け取る形にすればレイアウトは流用できる。
const STEPS = [
  { key: "learn", label: "基礎を学ぶ", sub: "Eラーニング", x: 60, y: 118 },
  { key: "practice", label: "演習で確かめる", sub: "クイズ・操作演習", x: 250, y: 96 },
  { key: "solo", label: "ひとりで作る", sub: "開発演習", x: 440, y: 108 },
  { key: "team", label: "チームで作る", sub: "チーム開発", x: 680, y: 84 },
  { key: "project", label: "案件へ", sub: "スキルシート・マッチング", x: 918, y: 104 },
];

// 進んだところまでを塗る道。曲がっているのは「一本道ではない」という気分を出すため。
//
// **曲線は STEPS の座標から作る。手で書かない。**
// 以前は手書きのベジェ（M60 118 C 200 60, 300 170, 440 108 S 700 60, 918 104）で、
// 1・3・5番目しか通っていなかった。2番目と4番目のノードが線から外れ、
// ラベルに曲線が重なっていた（2026-09-04にユーザー指摘）。
// 座標から作れば、**どのノードも必ず線の上に乗る**。
// 区間を**一度だけ**作り、塗る側はその先頭から必要な本数を取る。
// 部分だけを作り直すと端の制御点が変わり、塗った線が下の線からずれる。
function curveSegments(points) {
  const at = i => points[Math.max(0, Math.min(points.length - 1, i))];
  return points.slice(0, -1).map((_, i) => {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    // Catmull-Rom を3次ベジェへ。制御点を1/6にするのが標準の変換。
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    return ` C${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  });
}

const SEGMENTS = curveSegments(STEPS);
const START = `M${STEPS[0].x} ${STEPS[0].y}`;
const PATH_FULL = START + SEGMENTS.join("");
const PATH_TO = Object.fromEntries(
  STEPS.map((s, i) => [s.key, START + SEGMENTS.slice(0, i).join("")]),
);

// いまどこかを、取れている実績だけで決める。**取れないものを「済み」にしない**。
// 開発演習・チーム開発の実績はこの画面では取っていないので、そこから先は常に「これから」。
export function resolveRoadmapStage({ completedCount = 0, inprogressCount = 0, canUseDevLab = true }) {
  if (completedCount > 0) return canUseDevLab ? "solo" : "project";
  if (inprogressCount > 0) return "practice";
  return "learn";
}

export default function LearningRoadmap({ completedCount = 0, inprogressCount = 0, canUseDevLab = true, onStepClick }) {
  const current = resolveRoadmapStage({ completedCount, inprogressCount, canUseDevLab });
  const currentIndex = STEPS.findIndex(s => s.key === current);
  const teal = PRODUCT_ACCENT.learning.accent;
  const tealDeep = PRODUCT_ACCENT.learning.deep;

  return (
    <div className="mb-6 rounded-2xl p-5" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>あなたの道のり</h3>
        <span className="text-[11.5px]" style={{ color: C.muted }}>学んで、作って、案件へ</span>
      </div>
      {/* 幅は枠いっぱいに伸ばす（固定1000pxだと広い画面で右側が余っていた）。
          狭い画面ではこの中だけを横スクロールさせる（ページ全体は横に動かさない）。 */}
      <div className="overflow-x-auto py-1.5">
        <svg className="block h-auto w-full min-w-[880px]" viewBox="0 0 1000 188" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`学習の道のり。現在は「${STEPS[currentIndex]?.label}」の段階です。`}>
          <path d={PATH_FULL} fill="none" stroke={C.line} strokeWidth="10" strokeLinecap="round" />
          <path d={PATH_TO[current] || PATH_TO.learn} fill="none" stroke={teal} strokeWidth="10" strokeLinecap="round" />

          {STEPS.map((step, i) => {
            const done = i < currentIndex;
            const isCurrent = i === currentIndex;
            const clickable = Boolean(onStepClick);
            return (
              <g
                key={step.key}
                onClick={clickable ? () => onStepClick(step.key) : undefined}
                style={clickable ? { cursor: "pointer" } : undefined}
              >
                {isCurrent && (
                  <>
                    <rect x={step.x - 54} y={step.y - 84} width="108" height="26" rx="13" fill={tealDeep} />
                    <text x={step.x} y={step.y - 66} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">いまここ</text>
                    <path d={`M${step.x} ${step.y - 58}v${29}`} stroke={tealDeep} strokeWidth="2" strokeDasharray="3 3" />
                  </>
                )}
                {done ? (
                  <>
                    <circle cx={step.x} cy={step.y} r="21" fill={teal} />
                    <path d={`M${step.x - 8} ${step.y}l5 5 11-11`} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                ) : isCurrent ? (
                  <>
                    <circle cx={step.x} cy={step.y} r="25" fill="#fff" stroke={tealDeep} strokeWidth="4" />
                    <circle cx={step.x} cy={step.y} r="9" fill={tealDeep} />
                  </>
                ) : (
                  <>
                    <circle cx={step.x} cy={step.y} r="21" fill="#fff" stroke={C.line} strokeWidth="3" />
                    <text x={step.x} y={step.y + 6} textAnchor="middle" fontSize="13" fontWeight="800" fill={C.faint}>{i + 1}</text>
                  </>
                )}
                <text x={step.x} y={step.y + (isCurrent ? 45 : 41)} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={done || isCurrent ? C.ink : C.body}>{step.label}</text>
                <text x={step.x} y={step.y + (isCurrent ? 62 : 58)} textAnchor="middle" fontSize="11" fill={C.muted}>{step.sub}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
