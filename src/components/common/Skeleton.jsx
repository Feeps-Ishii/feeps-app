import React from "react";
import { T } from "./theme.js";

// Row-type skeleton: use in place of "読み込み中..." text for list/table-shaped content.
export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ background: T.bgBase }}>
          <span className="feeps-shimmer h-8 w-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="feeps-shimmer block h-3 rounded" style={{ width: "55%" }} />
            <span className="feeps-shimmer block h-2.5 rounded" style={{ width: "32%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Card-type skeleton: use in place of "読み込み中..." text for card-grid-shaped content.
export function SkeletonCards({ count = 2 }) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl p-3" style={{ background: T.bgBase }}>
          <span className="feeps-shimmer mb-2 block h-2.5 rounded" style={{ width: "40%" }} />
          <span className="feeps-shimmer block h-3.5 rounded" style={{ width: "65%" }} />
        </div>
      ))}
    </div>
  );
}
