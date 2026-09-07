import React, { useCallback, useMemo, useState } from "react";
import { Target } from "lucide-react";
import { T, PrismErrorRetryCard, SkeletonCards } from "../../../components/common";
import { useRoadmap } from "./useRoadmap.js";
import {
  GOALS, goalById, resolveItems, scoreOf, axesOf, recommendationsFor, SELF_WEIGHT,
} from "./roadmapCatalog.js";
import RoadmapAxisModal from "./RoadmapAxisModal.jsx";
import RecommendationRow from "./RecommendationRow.jsx";

// 目標と到達度。承認モック: https://claude.ai/code/artifact/c77e9e5a-cd0b-44d9-bc96-6d15336e5214
//
// **順番に進ませるのではなく、足りないものだけ出す。** 既に出来る人にステップを踏ませない、
// というのがこの画面の目的（2026-09-08ユーザー指示）。
//
// 効かせているのは3つだけ。
//   1. 凹んだところを押すと、足りない項目と埋めるコースが出る
//   2. おすすめは「受けると到達度が何点上がるか」の順。総仕上げだけ最後
//   3. **自己申告は満点にしない**（6割）。確かめていないものが混ざったまま100%にしない
//
// 数字は取れたものだけを出す。取れなければ「確認できません＋再試行」。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };
const MONO = '"JetBrains Mono", ui-monospace, monospace';

function Radar({ axes, onPick }) {
  const cx = 160, cy = 150, R = 94, n = axes.length;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  };
  const ring = f => axes.map((_, i) => {
    const p = pt(i, R * f);
    return `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join("") + "Z";
  const now = axes.map((a, i) => {
    // 0だと点が中心に潰れて、軸が何本あるか分からなくなる
    const p = pt(i, R * Math.max(0.05, a.ratio));
    return `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join("") + "Z";

  return (
    <svg viewBox="0 0 320 300" role="img" className="block h-auto w-full"
      aria-label={`目標に対する到達度。${axes.map(a => `${a.name} ${Math.round(a.ratio * 100)}%`).join("、")}`}>
      {[0.34, 0.67, 1].map(f => <path key={f} d={ring(f)} fill="none" stroke={C.line} strokeWidth="1" />)}
      {axes.map((_, i) => {
        const p = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke={C.line} strokeWidth="1" />;
      })}
      <path d={ring(1)} fill="none" stroke={T.accent} strokeWidth="2" strokeDasharray="5 4" />
      <path d={now} fill={T.accent} fillOpacity="0.18" stroke={T.accent} strokeWidth="2.5" strokeLinejoin="round" />
      {axes.map((a, i) => {
        const p = pt(i, R * Math.max(0.05, a.ratio));
        const lp = pt(i, R + 21);
        const anchor = Math.abs(lp.x - cx) < 12 ? "middle" : lp.x > cx ? "start" : "end";
        return (
          <g key={a.name} style={{ cursor: "pointer" }} onClick={() => onPick(a.name)}>
            <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4" fill={T.accent} />
            <text x={lp.x.toFixed(1)} y={(lp.y + 4).toFixed(1)} textAnchor={anchor}
              fontSize="11.5" fontWeight="800" fill={a.ratio >= 1 ? T.success : C.body}>{a.name}</text>
            {/* 文字だけだと押しづらいので、当たり判定を広げる */}
            <circle cx={lp.x.toFixed(1)} cy={lp.y.toFixed(1)} r="26" fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}

export default function RoadmapView({ lrn, onOpenCourse }) {
  const { state, loading, error, saving, reload, chooseGoal, setDeclared } = useRoadmap();
  const [axisOpen, setAxisOpen] = useState("");

  // 修了したコースのタイトル。**コースIDではなくタイトルで紐づける**（IDは入れ替わる）
  const completedTitles = useMemo(
    () => new Set((lrn?.completed || []).map(c => c.title).filter(Boolean)),
    [lrn?.completed],
  );
  // 中身のあるコースだけ「はじめる」を押せるようにする
  const readyTitles = useMemo(() => {
    const set = new Set();
    (lrn?.catalog || []).forEach(c => { if (Number(c.lessonCount || c.lessons || 0) > 0) set.add(c.title); });
    return set;
  }, [lrn?.catalog]);
  const isReady = useCallback(title => readyTitles.has(title), [readyTitles]);

  const goal = state?.goalId ? goalById(state.goalId) : null;
  const declared = useMemo(() => new Set(state?.declared || []), [state?.declared]);
  const items = useMemo(() => resolveItems(goal, completedTitles, declared), [goal, completedTitles, declared]);
  const axes = useMemo(() => axesOf(items), [items]);
  const recs = useMemo(() => recommendationsFor(items, isReady), [items, isReady]);

  const score = items.length ? Math.round(scoreOf(items) * 100) : null;
  const gapCount = items.filter(i => i.state === "none").length;
  const haveRatio = items.length ? items.filter(i => i.state === "have").length / items.length : 0;
  const selfRatio = items.length ? items.filter(i => i.state === "self").length / items.length * SELF_WEIGHT : 0;

  const openCourse = useCallback(title => { if (onOpenCourse) onOpenCourse(title); }, [onOpenCourse]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 text-[10.5px] font-extrabold" style={{ letterSpacing: ".14em", color: T.accent }}>
          <Target size={13} />ROADMAP
        </div>
        <h2 className="mt-1.5 text-[24px] font-extrabold leading-[1.35]" style={{ color: C.ink, letterSpacing: "-.02em" }}>
          目標と、足りないもの
        </h2>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.95]" style={{ color: C.body }}>
          目指す姿を選ぶと、<b style={{ color: C.ink }}>いま足りないところ</b>と、
          それを埋めるコースが出ます。<b style={{ color: C.ink }}>もう出来ることは飛ばせます</b>。
        </p>
      </div>

      {error && <PrismErrorRetryCard message={error} onRetry={reload} />}
      {loading && !state && <SkeletonCards count={2} />}

      {/* 目標を選ぶ */}
      {state && (
        <div>
          <div className="mb-2 text-[12px] font-extrabold" style={{ color: C.body }}>目指す姿</div>
          <div className="flex flex-wrap gap-2">
            {GOALS.map(g => (
              <button key={g.id} type="button" disabled={saving}
                onClick={() => chooseGoal(g.id === state.goalId ? "" : g.id)}
                className="rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition disabled:opacity-50"
                style={{
                  border: `1px solid ${g.id === state.goalId ? T.accent : C.line}`,
                  background: g.id === state.goalId ? T.accentSubtle : T.bgSurface,
                  color: g.id === state.goalId ? T.accentHover : C.body,
                }}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {state && !goal && (
        <div className="rounded-2xl p-5 text-[13.5px] leading-[1.9]"
          style={{ border: `1px solid ${C.line}`, background: T.bgSurface, color: C.body }}>
          <b style={{ color: C.ink }}>まず目指す姿をひとつ選んでください。</b>
          選ぶと、そこに必要なものと、いま足りないものが出ます。
          <b style={{ color: C.ink }}>あとから変えられます</b>し、修了した記録は持ち越されます。
        </div>
      )}

      {goal && (
        <>
          {/* 到達度 */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl px-4 py-3.5"
            style={{ border: `1px solid ${C.line}`, background: T.bgSurface }}>
            <div>
              <div className="text-[11.5px]" style={{ color: C.muted }}>目標への到達度</div>
              <div className="text-[30px] font-bold leading-none" style={{ fontFamily: MONO, color: C.ink }}>
                {score == null ? "—" : `${score}%`}
              </div>
            </div>
            <div className="flex h-[9px] min-w-[160px] flex-1 overflow-hidden rounded-full" style={{ background: C.line }}>
              <i className="block h-full" style={{ width: `${haveRatio * 100}%`, background: T.success }} />
              <i className="block h-full" style={{ width: `${selfRatio * 100}%`, background: T.warning }} />
            </div>
            <div>
              <div className="text-[11.5px]" style={{ color: C.muted }}>足りないもの</div>
              <div className="text-[30px] font-bold leading-none" style={{ fontFamily: MONO, color: T.danger }}>{gapCount}</div>
            </div>
          </div>

          {/* レーダーと凡例 */}
          <div className="rounded-2xl p-4" style={{ border: `1px solid ${C.line}`, background: T.bgSurface }}>
            <div className="grid items-center gap-4 lg:grid-cols-[320px_1fr]" style={{ minWidth: 0 }}>
              <div className="min-w-0 overflow-x-auto"><Radar axes={axes} onPick={setAxisOpen} /></div>
              <div className="flex min-w-0 flex-col gap-1.5">
                {[...axes].sort((a, b) => a.ratio - b.ratio).map(a => (
                  <button key={a.name} type="button" onClick={() => setAxisOpen(a.name)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] transition hover:border-current"
                    style={{ border: `1px solid ${C.line}`, background: T.bgSurface, color: C.body }}>
                    <span className="min-w-[72px] font-extrabold" style={{ color: C.ink }}>{a.name}</span>
                    <span className="h-[7px] min-w-[40px] flex-1 overflow-hidden rounded-full" style={{ background: C.line }}>
                      <i className="block h-full rounded-full"
                        style={{ width: `${Math.round(a.ratio * 100)}%`, background: a.ratio >= 1 ? T.success : T.accent }} />
                    </span>
                    <span className="shrink-0 text-[11.5px] font-bold"
                      style={{ fontFamily: MONO, color: a.ratio >= 1 ? T.success : T.danger }}>
                      {a.ratio >= 1 ? "届いている" : `あと ${a.miss}`}
                    </span>
                    <span className="shrink-0" style={{ color: C.line }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* おすすめ */}
          <div className="rounded-2xl" style={{ border: `1px solid ${C.line}`, background: T.bgSurface }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
              style={{ borderBottom: `1px solid ${C.line}` }}>
              <h3 className="m-0 text-[13px] font-extrabold" style={{ color: C.ink }}>足りないところを埋めるコース</h3>
              <span className="text-[11.5px]" style={{ color: C.muted }}>
                {recs.length ? "埋まる量が多い順。総仕上げは最後" : ""}
              </span>
            </div>
            <div className="flex flex-col gap-2 p-4">
              {recs.length
                ? recs.map((c, i) => (
                  <RecommendationRow key={c.course} rec={c} index={i} top={i === 0} onOpen={openCourse} />
                ))
                : (
                  <p className="m-0 text-[13px]" style={{ color: T.success }}>
                    <b>この目標に必要なものは、すべて埋まっています。</b>
                  </p>
                )}
            </div>
          </div>

          <p className="m-0 text-[11.5px] leading-[1.8]" style={{ color: C.muted }}>
            「もう出来る」と申告したものは<b style={{ color: C.body }}>6割で数えています</b>。
            確かめていないものが混ざったまま到達度が100%にならないようにするためです。
          </p>
        </>
      )}

      {axisOpen && goal && (
        <RoadmapAxisModal
          axis={axisOpen}
          items={items.filter(i => i.axis === axisOpen)}
          recommendations={recs.filter(r => r.axes.includes(axisOpen))}
          saving={saving}
          onDeclare={setDeclared}
          onOpenCourse={openCourse}
          onClose={() => setAxisOpen("")}
        />
      )}
    </div>
  );
}
