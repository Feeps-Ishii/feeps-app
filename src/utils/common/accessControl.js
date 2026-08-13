// 研修管理/学習の2モード分離（ADR 0013-0016）。PRODUCTS配列のroles×modesフィルタを一元化する。
// 2026-08-13 Phase1-B新設。

// instructorは特定の1企業に属さないためモードにゲートしない
// （2026-08-13ユーザー決定。将来変更する場合はこの関数だけ直せばよい）。
export function isProductVisibleForMode(product, { role, viewMode }) {
  if (role === "instructor") return true;
  // modesが無い（未指定）Productはモードの概念がない、または両モード共通（talent等）
  if (!product.modes || product.modes.length === 0) return true;
  return product.modes.includes(viewMode);
}

// role×modeの両方でPRODUCTS配列を絞り込む。既存の`.filter(p => p.roles.includes(role))`と
// 置き換える形で使う（TrainingApp.jsx内の6箇所）。
export function filterProductsForRoleAndMode(products, { role, viewMode }) {
  return products.filter(p => p.roles.includes(role) && isProductVisibleForMode(p, { role, viewMode }));
}

// 現在のロール・契約モードから、選べるviewModeの一覧を返す。
// admin: 特定企業に縛られないため常に両方（表示整理のための個人設定）。
// instructor: モードにゲートされないため実質未使用（呼び出し元でタブ自体を出さない）。
// trainee/client: 自社の契約（contractMode）に従う。
export function allowedViewModes({ role, contractMode }) {
  if (role === "admin" || role === "instructor") return ["training", "learning"];
  const cm = contractMode || "both"; // Backendのフェイルオープン既定値と揃える
  return cm === "both" ? ["training", "learning"] : [cm];
}

export function shouldShowModeSwitch({ role, contractMode }) {
  if (role === "instructor") return false;
  return allowedViewModes({ role, contractMode }).length > 1;
}
