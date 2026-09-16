// 研修管理/学習の2モード分離（ADR 0013-0016）。PRODUCTS配列のroles×modesフィルタを一元化する。
// 2026-08-13 Phase1-B新設。

// instructorは特定の1企業に属さないためモードにゲートしない
// （2026-08-13ユーザー決定。将来変更する場合はこの関数だけ直せばよい）。
export function isProductVisibleForMode(product, { role, viewMode }) {
  // 企業管理モードは運営専用。「モード未指定＝どこでも出す」の対象外にする。
  // そうしないと分析・レポートやHomeまで企業管理モードに並んでしまう（2026-08-21）。
  if (viewMode === "company") return Boolean(product.modes?.includes("company"));
  // スキルモードも同じ扱い。「モード未指定＝どこでも出す」の対象外にしないと、
  // ホームや分析までスキルの下に並んでしまう（2026-09-16）。
  if (viewMode === "skill") return Boolean(product.modes?.includes("skill"));
  // **スキルモードを持つのは受講生だけ**（自分の成長を見る場所）。受講生には他モードで
  // 重複表示しない。講師・企業担当・管理者にとってのスキル・成長は「受講生スキルシート」
  // という受講生を見る仕事なので、研修管理の中に置く（2026-09-16）。
  if (role === "trainee" && product.modes?.includes("skill")) return false;
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

// 2026-09-16: スキルモードを追加。成長履歴・街・スキルシートは**自分の成長を見る場所**で、
// 研修と学習のどちらから見ても同じもの。「何を売っているか」の軸に属さないので独立させた。
// **受講生だけのモード。** 契約モードではゲートしない（研修だけの契約でも自分の記録は見える）。
// 講師・企業担当・管理者にとってのスキルは「受講生スキルシート」＝受講生を見る仕事なので、
// 独立モードにはせず研修管理の中に置く（モードにすると中身が1枚だけになり浮く）。
export function allowedViewModes({ role, contractMode, adminTier }) {
  if (role === "admin") {
    return canUseCompanyMode({ role, adminTier })
      ? ["training", "learning", "company"]
      : ["training", "learning"];
  }
  if (role === "instructor") return ["training", "learning"];
  const cm = contractMode || "both"; // Backendのフェイルオープン既定値と揃える
  // 企業担当は自分では学習しない。スキル（自分の成長）のモードは持たず、
  // 受講生スキルシートは研修管理の中から開く
  if (role === "client") return cm === "both" ? ["training", "learning"] : [cm];
  return cm === "both" ? ["training", "learning", "skill"] : [cm, "skill"];
}

export function shouldShowModeSwitch({ role, contractMode, adminTier }) {
  if (role === "instructor") return false;
  return allowedViewModes({ role, contractMode, adminTier }).length > 1;
}
