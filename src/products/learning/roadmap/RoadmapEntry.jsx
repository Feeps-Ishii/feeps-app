import React, { useMemo } from "react";
import { ChevronRight, Target } from "lucide-react";
import { T } from "../../../components/common";
import { useRoadmap } from "./useRoadmap.js";
import { goalById, resolveItems, scoreOf, SELF_WEIGHT } from "./roadmapCatalog.js";

// ホームに置く「目標と到達度」への導線（2026-09-08）。
//
// 以前ここには「あなたの道のり」（全員同じ5段の絵）を置いていたが、
// **目標と到達度の画面ができたので役目が重なった**（ユーザー指摘）。絵をやめて、
// いまの到達度と足りない数だけを1行で出し、押すと本体へ入る形にした。
//
// **取れなかったときは黙って引っ込む。** ホームの主役ではないので、
// ここでエラーを出して驚かせるより、出さないほうがよい（本体を開けば理由が出る）。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border };
const MONO = '"JetBrains Mono", ui-monospace, monospace';

export default function RoadmapEntry({ lrn, onOpen }) {
  const { state, loading, error } = useRoadmap();

  const completedTitles = useMemo(
    () => new Set((lrn?.completed || []).map(c => c.title).filter(Boolean)),
    [lrn?.completed],
  );

  const goal = state?.goalId ? goalById(state.goalId) : null;
  const items = useMemo(
    () => resolveItems(goal, completedTitles, new Set(state?.declared || [])),
    [goal, completedTitles, state?.declared],
  );

  if (loading || error || !state) return null;

  const score = items.length ? Math.round(scoreOf(items) * 100) : null;
  const gaps = items.filter(i => i.state === "none").length;
  const haveRatio = items.length ? items.filter(i => i.state === "have").length / items.length : 0;
  const selfRatio = items.length ? items.filter(i => i.state === "self").length / items.length * SELF_WEIGHT : 0;

  return (
    <button
      type="button" onClick={onOpen}
      className="mb-6 flex w-full flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl px-5 py-4 text-left transition hover:shadow-sm"
      style={{ background: T.bgSurface, border: `1px solid ${goal ? T.accent : C.line}` }}>

      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
        style={{ background: T.accentSubtle, color: T.accent }}>
        <Target size={19} />
      </span>

      <span className="min-w-[200px] flex-1">
        {goal ? (
          <>
            <span className="block text-[14.5px] font-extrabold" style={{ color: C.ink }}>{goal.label}</span>
            <span className="mt-0.5 block text-[12px]" style={{ color: C.body }}>
              目標まであと <b style={{ color: T.danger }}>{gaps}</b> 件。押すと足りないところと、埋めるコースが出ます
            </span>
          </>
        ) : (
          <>
            <span className="block text-[14.5px] font-extrabold" style={{ color: C.ink }}>目指す姿を決めましょう</span>
            <span className="mt-0.5 block text-[12px]" style={{ color: C.body }}>
              選ぶと、いま足りないところと、それを埋めるコースが出ます
            </span>
          </>
        )}
      </span>

      {goal && (
        <span className="flex min-w-[150px] flex-1 items-center gap-3">
          <span className="flex h-[8px] flex-1 overflow-hidden rounded-full" style={{ background: C.line }}>
            <i className="block h-full" style={{ width: `${haveRatio * 100}%`, background: T.success }} />
            <i className="block h-full" style={{ width: `${selfRatio * 100}%`, background: T.warning }} />
          </span>
          <span className="shrink-0 text-[17px] font-bold" style={{ fontFamily: MONO, color: C.ink }}>
            {score}%
          </span>
        </span>
      )}

      <span className="ml-auto flex shrink-0 items-center gap-1 text-[12.5px] font-bold" style={{ color: T.accentHover }}>
        {goal ? "見る" : "目標を選ぶ"}<ChevronRight size={15} />
      </span>
    </button>
  );
}
