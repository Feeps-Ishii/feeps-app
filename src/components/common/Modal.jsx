import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { T, Z } from "./theme.js";

const SIZES = { sm: 400, md: 560, lg: 720, xl: 960, "2xl": 1240 };

// Shared modal foundation (Header / Body / Footer), rendered through a portal on
// document.body so the overlay always covers the full viewport (sidebar/header
// included) regardless of in-layout stacking contexts.
// - ESC and overlay click close it; pass `dirty` to interpose a discard confirm.
// - Focuses the first form control on open and restores focus on close.
// - Locks background scroll; content scrolls inside the body (max-height 85dvh).
// - Mobile (<sm) renders as a bottom sheet (rounded top, safe-area padding);
//   sm+ keeps the centered panel anchored 9vh from the top.
// - Footer convention: primary CTA (verb label, accent) right, cancel (ghost) left,
//   destructive actions in danger styling.
export default function Modal({ title, desc, onClose, children, footer, size = "md", dirty = false, danger = false }) {
  const bodyRef = useRef(null);
  const restoreRef = useRef(null);

  function requestClose() {
    if (dirty && !window.confirm("入力内容を破棄して閉じますか？")) return;
    onClose && onClose();
  }

  useEffect(() => {
    restoreRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("feeps-modal-open");
    const el = bodyRef.current?.querySelector("input, select, textarea");
    if (el) el.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("feeps-modal-open");
      if (restoreRef.current?.focus) restoreRef.current.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return createPortal(
    <div className="feeps-modal-overlay fixed inset-0 flex items-end justify-center p-0 sm:items-start sm:p-4" style={{ background: "rgba(14,15,19,.55)", zIndex: Z.modal }} onClick={requestClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="feeps-modal-panel feeps-modal-sheet flex w-full flex-col rounded-t-2xl sm:rounded-xl" style={{ maxWidth: SIZES[size] || SIZES.md, maxHeight: "85dvh", background: T.bgSurface, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold" style={{ color: danger ? T.danger : T.textPrimary, letterSpacing: "-0.02em" }}>{title}</h3>
            {desc && <p className="mt-0.5 text-xs" style={{ color: T.textMuted }}>{desc}</p>}
          </div>
          <button type="button" onClick={requestClose} aria-label="閉じる" className="shrink-0 rounded-lg p-1.5 transition hover:opacity-70"><X size={18} style={{ color: T.textMuted }} /></button>
        </div>
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
        {footer && <div className="flex shrink-0 justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.border}` }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
