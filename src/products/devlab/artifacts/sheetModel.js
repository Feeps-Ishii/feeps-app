// 表計算（Excel風）の成果物モデル（2026-08-19新設）。
// 要件一覧・試算表・工数見積のような「表で考える」演習をアプリ内で完結させる。
//
// セルはA1記法のスパースなマップで持つ。空セルを持たないので、20x30の表でも
// 実際に入力した分しか保存されない（成果物の200KB上限に対して有利）。

export const MAX_COLS = 12;
export const MAX_ROWS = 40;

export function colLabel(index) {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function cellRef(col, row) {
  return `${colLabel(col)}${row + 1}`;
}

export function emptySheetModel() {
  return { cols: 5, rows: 8, cells: {}, headerRow: true };
}

export function sanitizeSheetModel(model) {
  const cols = Math.min(MAX_COLS, Math.max(1, Number(model?.cols) || 5));
  const rows = Math.min(MAX_ROWS, Math.max(1, Number(model?.rows) || 8));
  const raw = model?.cells && typeof model.cells === "object" && !Array.isArray(model.cells) ? model.cells : {};
  const cells = {};
  for (const [ref, value] of Object.entries(raw)) {
    if (typeof value !== "string" || value === "") continue;
    const m = /^([A-Z]+)([0-9]+)$/.exec(ref);
    if (!m) continue;
    // 表の外に出たセルは捨てる（列・行を減らしたときに残骸が残らないように）
    const c = colIndex(m[1]);
    const r = Number(m[2]) - 1;
    if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
    cells[ref] = value.slice(0, 200);
  }
  return { cols, rows, cells, headerRow: model?.headerRow !== false };
}

export function colIndex(label) {
  let n = 0;
  for (const ch of String(label)) {
    const v = ch.charCodeAt(0) - 64;
    if (v < 1 || v > 26) return -1;
    n = n * 26 + v;
  }
  return n - 1;
}

const FUNCS = {
  SUM: xs => xs.reduce((a, b) => a + b, 0),
  AVERAGE: xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0),
  COUNT: xs => xs.length,
  MIN: xs => (xs.length ? Math.min(...xs) : 0),
  MAX: xs => (xs.length ? Math.max(...xs) : 0),
};

function expandRange(a, b) {
  const ma = /^([A-Z]+)([0-9]+)$/.exec(a);
  const mb = /^([A-Z]+)([0-9]+)$/.exec(b);
  if (!ma || !mb) return [];
  const c1 = colIndex(ma[1]), r1 = Number(ma[2]) - 1;
  const c2 = colIndex(mb[1]), r2 = Number(mb[2]) - 1;
  const refs = [];
  for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) refs.push(cellRef(c, r));
  }
  return refs;
}

/**
 * セルの表示値を求める。`=` で始まるものを数式として評価する。
 * 対応: 四則演算・括弧・セル参照・範囲付き関数(SUM/AVERAGE/COUNT/MIN/MAX)。
 * 循環参照は evaluating で検出して #CIRC! を返す（無限ループを防ぐ）。
 */
class CellError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function evaluateCell(model, ref, evaluating = new Set()) {
  const raw = model?.cells?.[ref];
  if (raw === undefined || raw === "") return "";
  if (!raw.startsWith("=")) return raw;
  if (evaluating.has(ref)) return "#CIRC!";
  evaluating.add(ref);
  try {
    return evalFormula(model, raw.slice(1), evaluating);
  } catch (e) {
    // 参照先のエラー(#CIRC!等)はそのまま伝播させる。ここで潰すと循環参照が
    // 「0」として静かに計算されてしまう（2026-08-19の単体検証で検出）。
    return e instanceof CellError ? e.code : "#ERR!";
  } finally {
    evaluating.delete(ref);
  }
}

function numeric(model, ref, evaluating) {
  const v = evaluateCell(model, ref, evaluating);
  if (typeof v === "string" && v.startsWith("#")) throw new CellError(v);
  if (v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function evalFormula(model, expr, evaluating) {
  // 関数呼び出しを先に畳み込む: SUM(A1:A5) / SUM(A1,B2)
  let s = expr.toUpperCase().replace(/\s+/g, "");
  const fnPattern = new RegExp(`(${Object.keys(FUNCS).join("|")})\\(([^()]*)\\)`);
  let guard = 0;
  while (fnPattern.test(s)) {
    if (++guard > 50) throw new Error("too complex");
    s = s.replace(fnPattern, (_, name, args) => {
      const values = [];
      for (const part of args.split(",")) {
        if (!part) continue;
        const range = part.split(":");
        if (range.length === 2) {
          for (const r of expandRange(range[0], range[1])) values.push(numeric(model, r, evaluating));
        } else if (/^[A-Z]+[0-9]+$/.test(part)) {
          values.push(numeric(model, part, evaluating));
        } else {
          const n = Number(part);
          if (Number.isFinite(n)) values.push(n);
        }
      }
      return String(FUNCS[name](values));
    });
  }
  // 残ったセル参照を数値へ置換
  s = s.replace(/[A-Z]+[0-9]+/g, m => String(numeric(model, m, evaluating)));
  // ここまでで数字と演算子だけになっているはず。想定外の文字が残っていたらエラーにする
  if (!/^[0-9+\-*/().]*$/.test(s)) throw new Error("invalid");
  if (!s) return "";
  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict";return (${s})`)();
  if (!Number.isFinite(result)) return "#ERR!";
  return String(Math.round(result * 1e6) / 1e6);
}

export function validateSheetModel(model) {
  const issues = [];
  const cells = model?.cells || {};
  if (!Object.keys(cells).length) issues.push("セルが1つも入力されていません。");
  for (const ref of Object.keys(cells)) {
    const v = evaluateCell(model, ref);
    if (v === "#CIRC!") issues.push(`${ref}: 循環参照になっています。`);
    if (v === "#ERR!") issues.push(`${ref}: 数式を計算できません。`);
  }
  return issues;
}

/** AI採点へ渡す提出テキスト。表をそのまま読める形にし、数式は式と結果の両方を出す。 */
export function sheetModelToText(model) {
  const m = sanitizeSheetModel(model);
  const out = ["【表】"];
  for (let r = 0; r < m.rows; r++) {
    const row = [];
    let hasValue = false;
    for (let c = 0; c < m.cols; c++) {
      const ref = cellRef(c, r);
      const raw = m.cells[ref] || "";
      if (raw) hasValue = true;
      const shown = raw.startsWith("=") ? `${evaluateCell(m, ref)}（${raw}）` : raw;
      row.push(shown);
    }
    if (hasValue) out.push(`${m.headerRow && r === 0 ? "見出し" : `行${r + 1}`}: ${row.join(" | ")}`);
  }
  const formulas = Object.entries(m.cells).filter(([, v]) => v.startsWith("="));
  if (formulas.length) {
    out.push("", "【数式】");
    for (const [ref, f] of formulas) out.push(`  ${ref}: ${f} = ${evaluateCell(m, ref)}`);
  }
  return out.join("\n");
}
