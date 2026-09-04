import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, List, Maximize2, Minimize2, Type, X } from "lucide-react";
import { T } from "../../components/common";

// 2026-09-04: 受講画面の集中モード。承認モック: mock/focus-mode
//
// **実測で、1440pxのノートPCでスライド本文は570pxしかなかった。**
// 周りの案内（レール72＋サイドバー224＋余白80＋左ナビ190＋右情報240＋gap64）で
// 押し出されている。図やエディタには足りない。
//
// 隠したもののうち受講中に本当に要るものだけを、この1本のバーへ集める。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border };

export const FONT_STEPS = [
  { key: "s", label: "標準", scale: 1 },
  { key: "m", label: "大きめ", scale: 1.12 },
  { key: "l", label: "特大", scale: 1.26 },
];

export default function FocusModeBar({
  title, index, total, onPrev, onNext, onExit,
  onToc, fontStep, onFont, fullscreen, onFullscreen,
}) {
  const pct = total > 1 ? Math.round((index / (total - 1)) * 100) : 0;
  return (
    <div
      className="sticky top-0 z-30 flex items-center gap-3 px-3 sm:px-4"
      style={{ height: 56, background: "#fff", borderBottom: `1px solid ${C.line}` }}
    >
      <button type="button" onClick={onExit} title="集中モードを終わる（Esc）" aria-label="集中モードを終わる"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/[.04]"
        style={{ border: `1px solid ${C.line}`, color: C.muted }}>
        <X size={15} />
      </button>

      <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold" style={{ color: C.ink, letterSpacing: "-0.01em" }}>
        {title}
      </span>

      <span className="hidden shrink-0 items-center gap-2 sm:flex">
        <button type="button" onClick={onPrev} disabled={index <= 0} aria-label="前のページ"
          className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/[.04] disabled:opacity-30"
          style={{ color: C.muted }}>
          <ChevronLeft size={16} />
        </button>
        <span className="text-[12px] font-bold tabular-nums" style={{ color: C.muted, fontVariantNumeric: "tabular-nums" }}>
          {index + 1} / {total}
        </span>
        <button type="button" onClick={onNext} disabled={index >= total - 1} aria-label="次のページ"
          className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/[.04] disabled:opacity-30"
          style={{ color: C.muted }}>
          <ChevronRight size={16} />
        </button>
      </span>

      <span className="hidden h-[5px] min-w-[60px] flex-1 overflow-hidden rounded-full md:block" style={{ background: C.line, maxWidth: 220 }}>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: T.accent }} />
      </span>

      <button type="button" onClick={onToc} title="目次（T）"
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition hover:bg-black/[.04]"
        style={{ border: `1px solid ${C.line}`, color: C.body }}>
        <List size={13} /><span className="hidden sm:inline">目次</span>
      </button>

      {/* 幅を広げても文字が小さいままだと、1行が長くなって逆に読みにくい。 */}
      <button type="button" onClick={onFont} title="文字の大きさを変える"
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition hover:bg-black/[.04]"
        style={{ border: `1px solid ${C.line}`, color: fontStep === 0 ? C.body : T.accent }}>
        <Type size={13} /><span className="hidden sm:inline">{FONT_STEPS[fontStep].label}</span>
      </button>

      <button type="button" onClick={onFullscreen} title={fullscreen ? "全画面をやめる" : "全画面にする"}
        aria-label={fullscreen ? "全画面をやめる" : "全画面にする"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/[.04]"
        style={{ border: `1px solid ${C.line}`, color: C.muted }}>
        {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );
}

// 目次。**選んだら閉じる。** 開きっぱなしにすると本文が狭くなり、集中モードの意味がなくなる。
export function TocDrawer({ open, onClose, slides, current, onSelect, labelOf }) {
  const ref = useRef(null);
  useEffect(() => {
    if (open) ref.current?.querySelector("[data-cur]")?.scrollIntoView({ block: "center" });
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ background: "rgba(12,17,25,.35)" }} onClick={onClose}>
      <aside
        ref={ref}
        className="flex h-full w-[320px] max-w-[85vw] flex-col"
        style={{ background: "#fff", borderLeft: `1px solid ${C.line}` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <span className="text-[12px] font-extrabold" style={{ color: C.muted, letterSpacing: "0.08em" }}>目次</span>
          <button type="button" onClick={onClose} className="ml-auto" aria-label="閉じる" style={{ color: C.muted }}>
            <X size={16} />
          </button>
        </div>
        <ul className="m-0 flex-1 list-none overflow-y-auto p-2">
          {slides.map((s, i) => (
            <li key={s.id || i}>
              <button
                type="button"
                data-cur={i === current ? "1" : undefined}
                onClick={() => { onSelect(i); onClose(); }}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition hover:bg-black/[.04]"
                style={{
                  background: i === current ? T.accentSubtle : "transparent",
                  color: i === current ? T.accentHover : C.body,
                  fontWeight: i === current ? 700 : 400,
                }}
              >
                <span className="w-5 shrink-0 text-[11px] tabular-nums" style={{ color: C.muted, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                <span className="min-w-0">{labelOf(s, i)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

// 集中モードのキー操作。
// **入力中は横取りしない。** コードを書いている最中にページが飛ぶのが、いちばん困る。
export function useFocusKeys({ active, onExit, onPrev, onNext, onToc, onToggle }) {
  useEffect(() => {
    const typing = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (typing()) return;
      if (e.key === "f" || e.key === "F") { e.preventDefault(); onToggle?.(); return; }
      if (!active) return;
      if (e.key === "Escape") { e.preventDefault(); onExit?.(); return; }
      if (e.key === "t" || e.key === "T") { e.preventDefault(); onToc?.(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); onPrev?.(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); onNext?.(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onExit, onPrev, onNext, onToc, onToggle]);
}

// 端末ごとに覚える（受講者の設定としては保存しない）。
const KEY = "feeps.lesson.focus";
export function useRememberedFocus() {
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* 保存できなくても動作は変わらない */ }
  }, [on]);
  return [on, setOn];
}
