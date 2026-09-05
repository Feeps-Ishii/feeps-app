import React from "react";
import { Card, Badge, Btn, T } from "../../../components/common";
import PhaseDiagram from "./PhaseDiagram.jsx";
import { METHODS, methodOf, roleSlotsFor, findRoleSlot, phaseLabel, INFRA_PHASE } from "./phases.js";

// 案件に入るときに担当を選ぶ画面と、選んだあとの見出し。
// 正典: docs/specs/dev-lab-role-spec.md §4-1
//
// 担当していない工程も図には出す。**自分の担当だけを見せると、案件の全体像が見えなくなる。**

// インフラ担当はAWS前提のためPremium限定。プラン判定はまだアプリに無いので、
// 呼び出し側から渡せるようにしておき、既定は「使えない」。
// 判定が入ったら infraAvailable を差し替えるだけで済む。

function MethodNote({ method }) {
  const m = METHODS.find(x => x.id === method) || METHODS[0];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: T.textSecondary }}>
      <span className="font-bold" style={{ color: T.textPrimary }}>{m.name}</span>
      <Badge tone="muted">{m.tag}</Badge>
      <span>{m.summary}</span>
    </div>
  );
}

function SlotCard({ slot, method, selected, disabled, onSelect }) {
  const names = (slot.phases || []).map(p => phaseLabel(method, p));
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect(slot.roleSlotId)}
      className="rounded-xl border p-3 text-left transition disabled:cursor-not-allowed"
      style={{
        borderColor: selected ? T.accent : T.border,
        background: selected ? T.accentSubtle : T.bgSurface,
        boxShadow: selected ? `0 0 0 3px ${T.accentSubtle}` : "none",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span className="flex flex-wrap items-center gap-2 text-sm font-bold" style={{ color: T.textPrimary }}>
        {slot.name}
        {slot.premium && <Badge tone="amber">Premium</Badge>}
      </span>
      <span className="mt-0.5 block text-xs" style={{ color: T.textSecondary }}>{slot.summary}</span>
      <span className="mt-1 block text-[11px]" style={{ color: T.textMuted }}>
        {names.length ? `${names.length}工程 ／ ${names.join("・")}` : "工程の外側"}
      </span>
      {disabled && (
        <span className="mt-1 block text-[11px] font-bold" style={{ color: T.warning }}>
          Premiumプランで使えます（準備中）
        </span>
      )}
    </button>
  );
}

export function RoleSelect({ project, value, onChange, onConfirm, confirmLabel = "この担当で始める", busy = false, infraAvailable = false }) {
  const method = methodOf(project);
  const slots = roleSlotsFor(project);
  const selected = findRoleSlot(project, value);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold" style={{ color: T.textPrimary }}>担当を選んでください</h3>
        <MethodNote method={method} />
      </div>
      <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
        選んだ範囲のタスクだけが出ます。同じ案件を、担当を変えて何周でもできます。
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map(slot => (
          <SlotCard
            key={slot.roleSlotId}
            slot={slot}
            method={method}
            selected={value === slot.roleSlotId}
            disabled={Boolean(slot.premium) && !infraAvailable}
            onSelect={onChange}
          />
        ))}
      </div>

      <PhaseDiagram className="mt-4" method={method} activePhases={selected?.phases || []} />

      <div
        className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border p-3"
        style={{
          borderColor: selected?.phases?.includes(INFRA_PHASE) ? T.warning : T.border,
          borderStyle: selected?.phases?.includes(INFRA_PHASE) ? "solid" : "dashed",
          background: selected?.phases?.includes(INFRA_PHASE) ? T.warningSubtle : T.bgBase,
        }}
      >
        <span className="text-[11px]" style={{ color: T.textMuted }}>┗━ 全工程を下から支える</span>
        <span className="min-w-0 flex-1 text-xs" style={{ color: T.textSecondary }}>
          <b style={{ color: T.textPrimary }}>インフラ担当</b>　開発環境と実行基盤（AWS）。
          工程の順番には入らず、実装からシステムテストまでを下から支えます。
        </span>
        <Badge tone="amber">Premium</Badge>
      </div>

      {selected && (
        <p className="mt-3 text-xs" style={{ color: T.textSecondary }}>{selected.handoverNote}</p>
      )}

      {onConfirm && (
        <Btn className="mt-3" disabled={!value || busy} onClick={onConfirm}>{confirmLabel}</Btn>
      )}
    </Card>
  );
}

// 参加後の見出し。いまの担当と、担当を変える／案件をやめる導線を出す。
// **会社から割り当てられた案件はやめられない**（onLeave を渡さない側で制御する）。
export function RoleSummary({ project, roleSlotId, hiddenCount, onChangeRole, onLeave, assignedByManager = false }) {
  const method = methodOf(project);
  const slot = findRoleSlot(project, roleSlotId);
  if (!slot) return null;
  const names = (slot.phases || []).map(p => phaseLabel(method, p));

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{slot.name}</span>
            <Badge tone="muted">{(METHODS.find(m => m.id === method) || METHODS[0]).name}</Badge>
            {slot.premium && <Badge tone="amber">Premium</Badge>}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: T.textSecondary }}>
            担当する工程: {names.join("・") || "工程の外側"}
          </p>
        </div>
        <span className="flex flex-wrap gap-2">
          {onChangeRole && <Btn kind="ghost" size="sm" onClick={onChangeRole}>担当を変える</Btn>}
          {onLeave && !assignedByManager && <Btn kind="ghost" size="sm" onClick={onLeave}>この案件をやめる</Btn>}
        </span>
      </div>

      {assignedByManager && (
        <p className="mt-1.5 text-xs" style={{ color: T.textMuted }}>
          この案件は会社から割り当てられています。担当は変えられますが、参加の取り消しはできません。
        </p>
      )}

      <PhaseDiagram className="mt-3" method={method} activePhases={slot.phases || []} />

      {hiddenCount > 0 && (
        <p className="mt-2 text-xs" style={{ color: T.textMuted }}>
          他の工程のタスク{hiddenCount}件は、この担当では出していません。担当を変えると出ます。
        </p>
      )}
    </Card>
  );
}
