// 研修管理/学習の2モード分離（ADR 0013-0016）。PRODUCTS配列のroles×modesフィルタを一元化する。
// 2026-08-13 Phase1-B新設。

// instructorは特定の1企業に属さないためモードにゲートしない
// （2026-08-13ユーザー決定。将来変更する場合はこの関数だけ直せばよい）。
export function isProductVisibleForMode(product, { role, viewMode }) {
  // 企業管理モードは運営専用。「モード未指定＝どこでも出す」の対象外にする。
  // そうしないと分析・レポートやHomeまで企業管理モードに並んでしまう（2026-08-21）。
  if (viewMode === "company") return Boolean(product.modes?.includes("company"));
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
// 2026-08-21: 企業管理モードを追加。契約・プラン・席・企業マスタはFeeps側の運営機能で、
// 「何を売っているか」(研修/学習)ではなく「誰に売っているか」の軸なので、どちらのモードの
// 下にも収まらない。**super adminだけ**に見せる（企業担当者向けの契約閲覧は将来別途）。
export function canUseCompanyMode({ role, adminTier }) {
  // adminTier未設定はsuper扱い（既存データの互換。AdminComponentsの判定と同じ流儀）。
  return role === "admin" && adminTier !== "standard";
}

export function allowedViewModes({ role, contractMode, adminTier }) {
  if (role === "admin") {
    return canUseCompanyMode({ role, adminTier })
      ? ["training", "learning", "company"]
      : ["training", "learning"];
  }
  if (role === "instructor") return ["training", "learning"];
  const cm = contractMode || "both"; // Backendのフェイルオープン既定値と揃える
  return cm === "both" ? ["training", "learning"] : [cm];
}

export function shouldShowModeSwitch({ role, contractMode, adminTier }) {
  if (role === "instructor") return false;
  return allowedViewModes({ role, contractMode, adminTier }).length > 1;
}
