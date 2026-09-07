import React from "react";
import { ArrowLeft } from "lucide-react";
import { T, PRODUCT_ACCENT } from "../../components/common";
import { unitsOfGroup, groupStatus } from "./CloudLabCatalog.js";
import CloudLabUnitRow from "./CloudLabUnitRow.jsx";

// グループ（基礎／応用／運用）の単元一覧。ハブから開いて、ここから単元へ入る。

const A = PRODUCT_ACCENT.cloudlab;
const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border };

export default function CloudLabGroup({ group, progress, onBack, onOpenUnit }) {
  const units = unitsOfGroup(group.id);
  const passedMap = progress?.units || {};
  const st = groupStatus(group, progress);

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack}
        className="flex w-fit items-center gap-1.5 text-[12.5px] font-bold" style={{ color: A.deep }}>
        <ArrowLeft size={14} />クラウド実習へ戻る
      </button>

      <div className="rounded-2xl p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${A.gradFrom}, ${A.accent})` }}>
        <div className="text-[10.5px] font-extrabold" style={{ letterSpacing: ".16em", opacity: .85 }}>
          {group.en}
        </div>
        <h2 className="mt-1.5 text-[22px] font-extrabold leading-[1.35]" style={{ letterSpacing: "-.02em" }}>
          {group.label}　<span className="text-[15px] font-bold" style={{ opacity: .9 }}>{group.summary}</span>
        </h2>
        <p className="mb-0 mt-2 max-w-[56ch] text-[12.5px] leading-[1.85]" style={{ opacity: .92 }}>
          {group.detail}
        </p>
      </div>

      <div className="rounded-2xl" style={{ border: `1px solid ${C.line}`, background: T.bgSurface }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          style={{ borderBottom: `1px solid ${C.line}` }}>
          <h3 className="m-0 text-[13px] font-extrabold" style={{ color: C.ink }}>単元</h3>
          <span className="text-[11px]" style={{ color: C.muted }}>
            {st.open
              ? <>いま開けるのは {st.playable} 単元 ／ 通過 {st.passed}</>
              : <>この{group.label}はまだ開けません</>}
          </span>
        </div>
        <div className="px-4 pb-2">
          {units.map((u, i) => (
            <CloudLabUnitRow key={u.id} unit={u} first={i === 0}
              passed={!!passedMap[u.id]?.passedAt} onOpen={onOpenUnit} />
          ))}
        </div>
      </div>
    </div>
  );
}
