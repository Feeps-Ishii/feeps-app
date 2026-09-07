import React from "react";
import { T } from "../../../components/common";

// おすすめコース1件。到達度と本文の両方から使う。
//
// **「受けると何点上がるか」を出す。** 順番の理由が言えないおすすめは、
// 結局どれから手を付けるか迷わせる。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border };

export default function RecommendationRow({ rec, index, top, onOpen }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-3"
      style={{
        border: `1px solid ${top ? T.accent : C.line}`,
        background: top ? T.accentSubtle : T.bgSurface,
      }}>
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[12px] font-extrabold"
        style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          background: top ? T.accent : T.bgBase,
          color: top ? "#fff" : C.muted,
        }}>{index + 1}</span>

      <span className="min-w-[180px] flex-1">
        <span className="block text-[13.5px] font-extrabold" style={{ color: C.ink }}>{rec.course}</span>
        <span className="mt-0.5 block text-[11.5px] leading-[1.7]" style={{ color: C.body }}>
          {rec.names.join("・")} が埋まります{rec.capstone ? "。ひととおり済んでからの総仕上げです" : ""}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block text-[13px] font-bold"
          style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: T.success }}>
          +{rec.lift}pt
        </span>
        <span className="block text-[10px]" style={{ color: C.muted }}>到達度</span>
      </span>

      {/* **中身が空のコースは押せないようにする。** 開いても何も無いのは、いちばん体験を損なう */}
      {rec.ready ? (
        <button type="button" onClick={() => onOpen(rec.course)}
          className="shrink-0 rounded-xl px-4 py-2 text-[12.5px] font-extrabold text-white"
          style={{ background: T.accent }}>
          はじめる
        </button>
      ) : (
        <span className="shrink-0 rounded-xl px-4 py-2 text-[12px] font-bold"
          style={{ border: `1px solid ${C.line}`, background: T.bgBase, color: C.muted }}>
          中身を準備中
        </span>
      )}
    </div>
  );
}
