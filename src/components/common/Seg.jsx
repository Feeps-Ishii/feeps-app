import React from "react";
import { T } from "./theme.js";

// Segmented control. Options are plain strings, or { value, label } objects when
// the displayed label differs from the stored value. activeFg lets a Product keep
// its accent color (e.g. Learning admin green) while sharing the same shape.
export default function Seg({ value, onChange, options, activeFg = T.accentHover }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl p-1" style={{ background: T.bgBase, border: `1px solid ${T.border}` }}>
      {options.map(o => {
        const v = typeof o === "object" ? o.value : o;
        const label = typeof o === "object" ? o.label : o;
        const active = value === v;
        return (
          <button key={v} type="button" onClick={() => onChange(v)} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            style={{ background: active ? "#fff" : "transparent", color: active ? activeFg : T.textMuted, boxShadow: active ? "0 1px 2px rgba(21,38,47,.08)" : "none" }}>{label}</button>
        );
      })}
    </div>
  );
}
