import React from "react";
import { T } from "./theme.js";

export default function Avatar({ name, size = 38, ring }) {
  const palette = [T.accent, T.success, T.warning, "#7C6CE0", "#E2557F"];
  const idx = (name?.charCodeAt(0) || 0) % palette.length;
  return <div className="flex items-center justify-center rounded-full font-bold text-white shrink-0"
    style={{ width: size, height: size, background: palette[idx], fontSize: size * 0.4, boxShadow: ring ? `0 0 0 3px ${T.accentSubtle}` : "none" }}>{name?.slice(0, 1)}</div>;
}
