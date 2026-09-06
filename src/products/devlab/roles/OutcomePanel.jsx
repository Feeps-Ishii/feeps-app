import React, { useState } from "react";
import { Card, Badge, Btn, T } from "../../../components/common";
import { methodOf, phasesFor, phaseLabel, stepsForRole } from "./phases.js";

// 「他の工程でできたもの」（2026-09-06）。
//
// 担当を選ぶと、その範囲のタスクしか出ない。それ自体は狙いどおりだが、
// **上流だけやった人が「結局どうなったのか」を知らずに終わる**のは学びとして片手落ちだった。
//
// 見せ方の線引き:
// - **担当していない工程の成果物は、いつでも見せる。** 自分がやらないので答えにならない
// - **自分の担当のタスクは、合格してから見せる。** 先に見せると答えを渡すことになる
//   （相手役AIが答えのコードを出さない設計と揃える）

export default function OutcomePanel({ project, roleSlot, byStep }) {
  const [open, setOpen] = useState({});
  const method = methodOf(project);
  const all = project?.steps || [];
  const mine = new Set(stepsForRole(all, roleSlot).map(s => s.stepId));

  // 完成例を持たないタスクは出さない（空の見出しを並べない）
  const rows = all
    .filter(s => (s.outcomeText || "").trim())
    .map(s => {
      const isMine = mine.has(s.stepId);
      const passed = byStep.get(s.stepId)?.passed === true;
      return { step: s, isMine, locked: isMine && !passed };
    });
  if (!rows.length) return null;

  const others = rows.filter(r => !r.isMine);
  const lockedCount = rows.filter(r => r.locked).length;

  // 工程の順に並べる（案件の進み方どおりに読める）
  const order = phasesFor(method).map(p => p.id);
  const sorted = [...rows].sort((a, b) => {
    const d = order.indexOf(a.step.phase) - order.indexOf(b.step.phase);
    return d !== 0 ? d : (a.step.order || 0) - (b.step.order || 0);
  });

  return (
    <Card className="mt-4 p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-bold" style={{ color: T.textPrimary }}>この案件でできたもの</h3>
        <span className="text-xs" style={{ color: T.textMuted }}>
          {others.length > 0
            ? `他の工程の成果物${others.length}件を見られます`
            : "自分の担当分の完成例です"}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {sorted.map(({ step, isMine, locked }) => {
          const shown = open[step.stepId];
          return (
            <li key={step.stepId} className="rounded-xl border p-3"
              style={{ borderColor: T.border, background: locked ? T.bgBase : T.bgSurface }}>
              <div className="flex flex-wrap items-center gap-2">
                {step.phase && <Badge tone="muted">{phaseLabel(method, step.phase)}</Badge>}
                <span className="text-[13.5px] font-bold" style={{ color: locked ? T.textMuted : T.textPrimary }}>
                  {step.title}
                </span>
                {isMine
                  ? <Badge tone={locked ? "muted" : "green"}>{locked ? "自分の担当" : "合格済み"}</Badge>
                  : <Badge tone="cyan">他の人の工程</Badge>}
                <span className="flex-1" />
                {locked ? (
                  <span className="text-[11.5px]" style={{ color: T.textMuted }}>合格すると見られます</span>
                ) : (
                  <Btn kind="ghost" size="sm" onClick={() => setOpen(o => ({ ...o, [step.stepId]: !shown }))}>
                    {shown ? "閉じる" : "できたものを見る"}
                  </Btn>
                )}
              </div>
              {shown && !locked && (
                <p className="mt-2 whitespace-pre-wrap rounded-lg p-3 text-[13px] leading-relaxed"
                  style={{ background: T.bgBase, color: T.textSecondary }}>
                  {step.outcomeText}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {lockedCount > 0 && (
        <p className="mt-3 text-xs" style={{ color: T.textMuted }}>
          自分の担当のタスク{lockedCount}件は、合格してから完成例を出します。先に見ると答えになってしまうためです。
        </p>
      )}
    </Card>
  );
}
