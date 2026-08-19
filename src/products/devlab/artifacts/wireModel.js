// 画面設計（ワイヤーフレーム）の成果物モデル（2026-08-19新設）。
//
// ドラッグでの自由配置ではなく、**上から積むブロックの並び**として持つ。ER図と同じ判断で、
// 座標を持たせると「設計を考える」より「図を整える」作業になるため。行(row)の中に
// 複数ブロックを置けるので、2カラム・3カラムのレイアウトは表現できる。

export const BLOCK_TYPES = [
  { value: "header", label: "ヘッダー" },
  { value: "nav", label: "ナビゲーション" },
  { value: "heading", label: "見出し" },
  { value: "text", label: "本文" },
  { value: "image", label: "画像" },
  { value: "form", label: "入力フォーム" },
  { value: "table", label: "一覧・テーブル" },
  { value: "card", label: "カード" },
  { value: "button", label: "ボタン" },
  { value: "footer", label: "フッター" },
];

export const BLOCK_LABEL = Object.fromEntries(BLOCK_TYPES.map(b => [b.value, b.label]));

let seq = 0;
function wid(p) {
  seq += 1;
  return `${p}_${Date.now().toString(36)}${seq}`;
}

export function emptyWireModel() {
  return { screens: [newScreen("画面1")] };
}

export function newScreen(name = "新しい画面") {
  return { id: wid("sc"), name, rows: [newRow()] };
}
export function newRow() {
  return { id: wid("row"), blocks: [newBlock()] };
}
export function newBlock(type = "text") {
  return { id: wid("b"), type, label: "" };
}

export function sanitizeWireModel(model) {
  const screens = (Array.isArray(model?.screens) ? model.screens : []).slice(0, 10).map((sc, i) => ({
    id: sc?.id || `sc_${i}`,
    name: String(sc?.name || `画面${i + 1}`).slice(0, 80),
    rows: (Array.isArray(sc?.rows) ? sc.rows : []).slice(0, 20).map((r, ri) => ({
      id: r?.id || `row_${i}_${ri}`,
      blocks: (Array.isArray(r?.blocks) ? r.blocks : []).slice(0, 4).map((b, bi) => ({
        id: b?.id || `b_${i}_${ri}_${bi}`,
        type: BLOCK_LABEL[b?.type] ? b.type : "text",
        label: String(b?.label || "").slice(0, 120),
      })).filter(Boolean),
    })).filter(r => r.blocks.length),
  }));
  return { screens };
}

export function validateWireModel(model) {
  const issues = [];
  const screens = model?.screens || [];
  if (!screens.length) issues.push("画面が1つもありません。");
  for (const sc of screens) {
    if (!sc.name.trim()) issues.push("名前のない画面があります。");
    if (!sc.rows.length) issues.push(`${sc.name}: 要素が置かれていません。`);
    const unlabeled = sc.rows.flatMap(r => r.blocks).filter(b => !b.label.trim());
    if (unlabeled.length) issues.push(`${sc.name}: 説明が入っていない要素が${unlabeled.length}件あります。`);
  }
  return issues;
}

export function wireModelToText(model) {
  const m = sanitizeWireModel(model);
  const out = ["【画面設計】"];
  for (const sc of m.screens) {
    out.push(`■ ${sc.name}`);
    sc.rows.forEach((r, i) => {
      const cells = r.blocks.map(b => `${BLOCK_LABEL[b.type]}${b.label ? `「${b.label}」` : ""}`);
      out.push(`  ${i + 1}. ${cells.join(" ／ ")}`);
    });
  }
  return out.join("\n");
}
