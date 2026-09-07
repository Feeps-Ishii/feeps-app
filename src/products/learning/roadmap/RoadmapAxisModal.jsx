import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { T } from "../../../components/common";
import RecommendationRow from "./RecommendationRow.jsx";

// 軸を押したときに出す中身。足りない項目と、それを埋めるコース。
//
// **自己申告には「取り消す」を残す。** 間違えて押したまま到達度が上がりっぱなしになると、
// 数字が信用できなくなる。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border };
const MK = {
  have: { cls: "have", ch: "✓", bg: T.success, label: "修了ずみ" },
  self: { cls: "self", ch: "自", bg: T.warning, label: "自己申告" },
  none: { cls: "none", ch: "・", bg: T.danger, label: "足りない" },
};

export default function RoadmapAxisModal({ axis, items, recommendations, saving, onDeclare, onOpenCourse, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const miss = items.filter(i => i.state !== "have");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-5"
      style={{ background: "rgba(20,24,32,.42)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={`${axis}の中身`}
        className="flex max-h-full w-full max-w-[560px] flex-col overflow-hidden rounded-2xl"
        style={{ background: T.bgSurface, boxShadow: "0 18px 50px rgba(15,23,42,.28)" }}>

        <div className="flex items-start gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div>
            <h3 className="m-0 text-[16px] font-extrabold" style={{ color: C.ink }}>{axis}</h3>
            <p className="mb-0 mt-1 text-[12px] leading-[1.75]" style={{ color: C.body }}>
              {miss.length
                ? <>目標に必要な {items.length} 件のうち、<b style={{ color: C.ink }}>{miss.length} 件</b>が埋まっていません。</>
                : <>目標に必要な {items.length} 件はすべて埋まっています。</>}
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="閉じる"
            className="ml-auto rounded-lg p-1.5" style={{ color: C.muted }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-auto px-5 py-4">
          <div>
            <div className="mb-2 text-[11px] font-extrabold" style={{ color: C.muted, letterSpacing: ".06em" }}>
              この軸で見ているもの
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map(i => {
                const m = MK[i.state];
                return (
                  <div key={i.id} className="flex flex-wrap items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px]"
                    style={{
                      border: `1px solid ${i.state === "none" ? "transparent" : C.line}`,
                      background: i.state === "none" ? T.dangerSubtle : T.bgSurface,
                    }}>
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
                      style={{ background: m.bg }}>{m.ch}</span>
                    <span style={{ color: C.ink }}>{i.name}</span>
                    <span className="ml-auto text-[11px]" style={{ color: C.muted }}>
                      {i.state === "have" ? `${i.course} を修了` : m.label}
                    </span>
                    {/* 修了しているものは申告で動かせない（実績が勝つ） */}
                    {i.state !== "have" && (
                      <button type="button" disabled={saving}
                        onClick={() => onDeclare(i.id, i.state !== "self")}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-bold disabled:opacity-50"
                        style={{
                          border: `1px solid ${i.state === "self" ? T.warning : C.line}`,
                          background: i.state === "self" ? T.warningSubtle : T.bgBase,
                          color: i.state === "self" ? T.warning : C.body,
                        }}>
                        {i.state === "self" ? "申告を取り消す" : "もう出来る"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-extrabold" style={{ color: C.muted, letterSpacing: ".06em" }}>
              埋めるコース
            </div>
            {recommendations.length ? (
              <div className="flex flex-col gap-2">
                {recommendations.map((c, i) => (
                  <RecommendationRow key={c.course} rec={c} index={i} top={i === 0} onOpen={onOpenCourse} />
                ))}
              </div>
            ) : (
              <p className="m-0 text-[12.5px]" style={{ color: C.muted }}>この軸で受けるものはありません。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
