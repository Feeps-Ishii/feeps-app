import React from "react";
import Modal from "./Modal.jsx";
import { NOVA, PRODUCT_ACCENT } from "./theme.js";

// ヘッダー常設の「使い方」ボタンから開く。現在のロールで見えているProductだけを
// 説明する（個別カードへのツールチップは追加せず、ここに集約する2026-07-28決定）。
// 文言はcommon層に持たせず、呼び出し側（TrainingApp.jsx）からdescつきで渡す
// （componentsがproducts配下のデータへ依存しないため）。
export default function HelpGuideModal({ products, onClose }) {
  return (
    <Modal title="Feeps One の使い方" desc="今のあなたが使える機能を、かんたんに紹介します。" onClose={onClose} size="md">
      <div className="flex flex-col gap-3">
        {products.map(({ key, label, icon: Icon, desc }) => {
          const pa = PRODUCT_ACCENT[key] || PRODUCT_ACCENT.training;
          return (
            <div key={key} className="flex items-start gap-3 rounded-2xl p-3" style={{ border: `1px solid ${NOVA.line}` }}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]" style={{ background: pa.subtle, color: pa.deep }}>
                {Icon && <Icon size={18} strokeWidth={1.8} aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold" style={{ color: NOVA.ink }}>{label}</div>
                <p className="mt-0.5 text-xs leading-relaxed" style={{ color: NOVA.muted }}>{desc || ""}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
