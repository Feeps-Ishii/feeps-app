// ER図（テーブル設計）の成果物モデル（2026-08-19新設）。
// 案件参画体験を外部提出ではなくアプリ内で完結させるための第1弾。
//
// 保存はこの構造のまま（再編集できるように）。AI採点には erModelToText() が作る
// DDL＋表のテキストを submittedText として送るので、採点側のロジックは変えなくてよい。

export const COLUMN_TYPES = [
  "INT", "BIGINT", "VARCHAR(50)", "VARCHAR(255)", "TEXT",
  "DATE", "DATETIME", "BOOLEAN", "DECIMAL(10,2)",
];

export const CARDINALITIES = [
  { value: "1-1", label: "1 対 1" },
  { value: "1-N", label: "1 対 多" },
  { value: "N-N", label: "多 対 多" },
];

let seq = 0;
function nextId(prefix) {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq}`;
}

export function emptyErModel() {
  return { tables: [], relations: [] };
}

export function newTable(name = "new_table") {
  return {
    id: nextId("t"),
    name,
    comment: "",
    columns: [
      { id: nextId("c"), name: "id", type: "INT", pk: true, notNull: true, comment: "主キー" },
    ],
  };
}

export function newColumn() {
  return { id: nextId("c"), name: "", type: "VARCHAR(255)", pk: false, notNull: false, comment: "" };
}

export function newRelation(fromTableId, toTableId) {
  return { id: nextId("r"), fromTableId, fromColumnId: "", toTableId, toColumnId: "", cardinality: "1-N" };
}

// 壊れた参照（削除済みテーブル/カラムを指すリレーション）を落とす。
// 保存前・読み込み後の両方で通す。
export function sanitizeErModel(model) {
  const tables = Array.isArray(model?.tables) ? model.tables : [];
  const byTable = new Map(tables.map(t => [t.id, new Set((t.columns || []).map(c => c.id))]));
  const relations = (Array.isArray(model?.relations) ? model.relations : []).filter(r => {
    const from = byTable.get(r.fromTableId);
    const to = byTable.get(r.toTableId);
    if (!from || !to) return false;
    if (r.fromColumnId && !from.has(r.fromColumnId)) return false;
    if (r.toColumnId && !to.has(r.toColumnId)) return false;
    return true;
  });
  return { tables, relations };
}

// 設計上の問題を洗い出す。提出前に受講生へ見せる（採点前に自分で気づけるように）。
export function validateErModel(model) {
  const issues = [];
  const tables = model?.tables || [];
  if (!tables.length) issues.push("テーブルが1つもありません。");

  const seen = new Set();
  for (const t of tables) {
    const name = (t.name || "").trim();
    if (!name) { issues.push("名前のないテーブルがあります。"); continue; }
    if (seen.has(name)) issues.push(`テーブル名が重複しています: ${name}`);
    seen.add(name);

    const cols = t.columns || [];
    if (!cols.length) issues.push(`${name}: カラムがありません。`);
    if (!cols.some(c => c.pk)) issues.push(`${name}: 主キーが設定されていません。`);
    const colNames = new Set();
    for (const c of cols) {
      const cn = (c.name || "").trim();
      if (!cn) { issues.push(`${name}: 名前のないカラムがあります。`); continue; }
      if (colNames.has(cn)) issues.push(`${name}: カラム名が重複しています: ${cn}`);
      colNames.add(cn);
    }
  }
  for (const r of (model?.relations || [])) {
    if (!r.fromColumnId || !r.toColumnId) issues.push("参照するカラムが選ばれていないリレーションがあります。");
  }
  return issues;
}

export function tableName(model, tableId) {
  return (model?.tables || []).find(t => t.id === tableId)?.name || "?";
}
export function columnName(model, tableId, columnId) {
  const t = (model?.tables || []).find(x => x.id === tableId);
  return (t?.columns || []).find(c => c.id === columnId)?.name || "?";
}

/** CREATE TABLE 文を組み立てる（画面のプレビューと、AIへ渡す提出テキストの両方で使う）。 */
export function erModelToSql(model) {
  const tables = model?.tables || [];
  const lines = [];
  for (const t of tables) {
    const name = (t.name || "table").trim();
    lines.push(`CREATE TABLE ${name} (`);
    const cols = (t.columns || []).filter(c => (c.name || "").trim());
    const body = cols.map(c => {
      const parts = [`  ${c.name} ${c.type}`];
      if (c.notNull || c.pk) parts.push("NOT NULL");
      return parts.join(" ") + (c.comment ? `  -- ${c.comment}` : "");
    });
    const pks = cols.filter(c => c.pk).map(c => c.name);
    if (pks.length) body.push(`  PRIMARY KEY (${pks.join(", ")})`);
    lines.push(body.join(",\n"));
    lines.push(`);${t.comment ? `  -- ${t.comment}` : ""}`);
    lines.push("");
  }
  for (const r of (model?.relations || [])) {
    if (!r.fromColumnId || !r.toColumnId) continue;
    lines.push(
      `-- ${tableName(model, r.fromTableId)}.${columnName(model, r.fromTableId, r.fromColumnId)}`
      + ` → ${tableName(model, r.toTableId)}.${columnName(model, r.toTableId, r.toColumnId)}`
      + ` (${r.cardinality})`
    );
  }
  return lines.join("\n").trim();
}

/**
 * AI採点へ渡す提出テキスト。既存の採点は submittedText を読むだけなので、
 * 構造をここで人が読める形へ落としておけば採点ロジックを変えずに済む。
 */
export function erModelToText(model) {
  const tables = model?.tables || [];
  const out = ["【テーブル設計】"];
  for (const t of tables) {
    out.push(`■ ${t.name}${t.comment ? `（${t.comment}）` : ""}`);
    for (const c of (t.columns || [])) {
      const flags = [c.pk ? "PK" : "", c.notNull ? "NOT NULL" : ""].filter(Boolean).join(" / ");
      out.push(`  - ${c.name}: ${c.type}${flags ? ` [${flags}]` : ""}${c.comment ? ` — ${c.comment}` : ""}`);
    }
  }
  const rels = (model?.relations || []).filter(r => r.fromColumnId && r.toColumnId);
  if (rels.length) {
    out.push("", "【リレーション】");
    for (const r of rels) {
      out.push(`  - ${tableName(model, r.fromTableId)}.${columnName(model, r.fromTableId, r.fromColumnId)}`
        + ` → ${tableName(model, r.toTableId)}.${columnName(model, r.toTableId, r.toColumnId)} (${r.cardinality})`);
    }
  }
  out.push("", "【CREATE TABLE】", erModelToSql(model));
  return out.join("\n");
}
