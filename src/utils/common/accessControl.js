// PRODUCTS配列のroles×modesフィルタを一元化する。2026-08-13 Phase1-B新設（ADR 0013-0016）。
//
// 2026-09-28: LMSは研修管理だけにした（Eラーニングはテノラボへ。ユーザー決定）。
// 研修管理／学習／スキル／企業管理のモード切替はやめ、モードは "training" の1つだけ。
// スキル・成長と企業管理は、モードではなく左のレールに並ぶProductの1つにした。
// viewMode の仕組み自体は残してある（localStorageに古いモードが残っていても "training" へ戻す）。

// 企業管理（契約・席・企業マスタ・運営コスト）は Feeps 側の運営機能。super admin だけ。
// adminTier未設定はsuper扱い（既存データの互換。AdminComponentsの判定と同じ流儀）。
export function canUseCompanyMode({ role, adminTier }) {
  return role === "admin" && adminTier !== "standard";
}

// instructorは特定の1企業に属さないためモードにゲートしない（2026-08-13ユーザー決定）。
export function isProductVisibleForMode(product, { role, viewMode }) {
  if (role === "instructor") return true;
  // modesが無い（未指定）Productはモードの概念がない
  if (!product.modes || product.modes.length === 0) return true;
  return product.modes.includes(viewMode);
}

// role×mode（と企業管理の super admin 判定）でPRODUCTS配列を絞り込む。
export function filterProductsForRoleAndMode(products, { role, viewMode, adminTier }) {
  return products.filter(p => p.roles.includes(role)
    && isProductVisibleForMode(p, { role, viewMode })
    && (p.key !== "company" || canUseCompanyMode({ role, adminTier })));
}

// 選べるviewModeの一覧。2026-09-28 から研修管理だけ（契約モードに関係なく）。
export function allowedViewModes() {
  return ["training"];
}

// モード切替は出さない（モードが1つだけのため）
export function shouldShowModeSwitch() {
  return false;
}
