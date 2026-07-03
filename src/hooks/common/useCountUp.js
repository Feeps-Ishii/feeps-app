import { useEffect, useRef, useState } from "react";

// Shared count-up for stat numbers (800ms ease-out cubic by default).
// Animates from the currently displayed value to the new target, so it fires
// once on mount (0 -> value) and once more when async data arrives — never on
// unrelated re-renders. prefers-reduced-motion renders the final value directly.
export default function useCountUp(target, { duration = 800, decimals = 0 } = {}) {
  const n = Number(target) || 0;
  const factor = Math.pow(10, decimals);
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      valueRef.current = n;
      setValue(n);
      return;
    }
    const from = valueRef.current;
    if (from === n) return;
    let raf;
    const t0 = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round((from + (n - from) * eased) * factor) / factor;
      valueRef.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n, duration, factor]);

  return value;
}
