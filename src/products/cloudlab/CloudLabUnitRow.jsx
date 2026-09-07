import React from "react";
import { Check, ChevronRight, Lock } from "lucide-react";
import { T, PRODUCT_ACCENT } from "../../components/common";
import { isPlayable } from "./CloudLabCatalog.js";

// 単元1行。ハブ（グループ一覧）とグループ画面の両方から使う。
//
// **できていないものを隠さない。** 準備中も出して「まだ開けない・何が要るか」と言う。
// 道すじ全体が見えていることに値打ちがあるため。

const A = PRODUCT_ACCENT.cloudlab;
const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border };
const MONO = '"JetBrains Mono", ui-monospace, monospace';

export function Pill({ kind, children }) {
  const style = {
    mock: { background: T.bgBase, color: C.muted, border: `1px solid ${C.line}` },
    real: { background: "#2C2C34", color: "#fff" },
    prem: { background: T.warningSubtle, color: T.warning },
    ok: { background: T.successSubtle, color: T.success },
    wait: { background: T.bgBase, color: C.muted, border: `1px solid ${C.line}` },
  }[kind] || {};
  return (
    <span className="rounded-full px-2 py-[2px] text-[10px] font-extrabold" style={{ letterSpacing: ".03em", ...style }}>
      {children}
    </span>
  );
}

export default function CloudLabUnitRow({ unit, passed, onOpen, first }) {
  const playable = isPlayable(unit);
  const open = playable && !!onOpen;
  return (
    <button
      type="button" disabled={!open} onClick={open ? () => onOpen(unit.id) : undefined}
      className="flex w-full items-start gap-3 py-3 text-left transition enabled:hover:bg-black/[.02] disabled:cursor-default"
      style={{ borderTop: first ? "none" : `1px dashed ${C.line}` }}>
      <span className="mt-[1px] grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
        style={{
          fontFamily: MONO,
          border: `2px solid ${passed ? T.success : playable ? A.accent : C.line}`,
          background: passed ? T.success : T.bgSurface,
          color: passed ? "#fff" : playable ? A.deep : C.muted,
        }}>
        {passed ? <Check size={12} strokeWidth={3} /> : unit.no}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold" style={{ color: playable ? C.ink : C.muted }}>
          {unit.title}
          {unit.status === "external" ? <Pill kind="real">本物</Pill> : <Pill kind="mock">模型</Pill>}
          {unit.premium && <Pill kind="prem">Premium</Pill>}
          {passed && <Pill kind="ok">通過</Pill>}
          {!playable && !passed && <Pill kind="wait">準備中</Pill>}
        </span>
        <span className="mt-1 block text-[12px] leading-[1.75]" style={{ color: C.body }}>
          {playable
            ? <>つまずき: <b style={{ color: C.ink }}>{unit.fail}</b></>
            : <>{unit.touch}。<span style={{ color: C.muted }}>いま開けません（{unit.needs}が要ります）</span></>}
        </span>
      </span>
      {open
        ? <ChevronRight size={16} className="mt-1 shrink-0" style={{ color: A.accent }} />
        : <Lock size={13} className="mt-1.5 shrink-0" style={{ color: C.line }} />}
    </button>
  );
}
