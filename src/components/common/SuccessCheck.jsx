import React from "react";
import { T } from "./theme.js";

// Shared success micro-animation: a checkmark drawn via stroke-dashoffset (~400ms).
// Use for primary success-feedback moments (save/complete/send confirmations).
export default function SuccessCheck({ size = 40, color = T.success }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: T.successSubtle }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M4 12.5 L9.5 18 L20 6" pathLength="1" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="feeps-check-draw" />
      </svg>
    </span>
  );
}
