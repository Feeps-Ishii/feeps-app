import React from "react";
import { T } from "./theme.js";

export default function EmptyState({ title, desc, imageSrc, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
      {imageSrc && <img src={imageSrc} alt="" style={{ height: 110, opacity: .95 }} />}
      {!imageSrc && Icon && (
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl" style={{ background: T.accentSubtle, color: T.accentHover }}>
          <Icon size={32} />
        </div>
      )}
      <div className="mt-4 text-sm font-semibold" style={{ color: T.textSecondary }}>{title}</div>
      {desc && <div className="mt-1 text-xs" style={{ color: T.textMuted }}>{desc}</div>}
    </div>
  );
}
