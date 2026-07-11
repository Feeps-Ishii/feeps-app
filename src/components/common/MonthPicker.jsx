import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { T } from "./theme.js";

// 月次業務（勤怠・日報・レポート）の月移動を1クリックにするステッパー付きmonth入力
export default function MonthPicker({ value, onChange }) {
  const shift = (delta) => {
    const [y, m] = String(value || "").split("-").map(Number);
    if (!y || !m) return;
    const t = new Date(y, m - 1 + delta, 1);
    onChange(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <div className="inline-flex items-center gap-1">
      <button type="button" aria-label="前の月" onClick={() => shift(-1)} className="flex h-9 w-8 items-center justify-center rounded-xl transition hover:bg-black/5" style={{ border: `1px solid ${T.border}`, color: T.textSecondary }}><ChevronLeft size={15} /></button>
      <input type="month" value={value} onChange={e => onChange(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, background: "#fff" }} />
      <button type="button" aria-label="次の月" onClick={() => shift(1)} className="flex h-9 w-8 items-center justify-center rounded-xl transition hover:bg-black/5" style={{ border: `1px solid ${T.border}`, color: T.textSecondary }}><ChevronRight size={15} /></button>
    </div>
  );
}
