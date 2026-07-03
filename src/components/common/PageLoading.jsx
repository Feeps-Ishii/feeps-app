import React from "react";
import { T } from "./theme.js";

// Suspense fallback for lazy-loaded Product chunks. Deliberately quiet:
// a small spinner instead of a layout flash keeps product switching calm.
export default function PageLoading({ label = "読み込み中..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full" style={{ border: `3px solid ${T.border}`, borderTopColor: T.accent }} />
      <span className="text-xs font-semibold" style={{ color: T.textMuted }}>{label}</span>
    </div>
  );
}
