/* SQL をブラウザの中の SQLite（sql.js）で動かす（2026-10-13）。
   教材（SQL基本のき）は MySQL の書き方なので、SQLite に無いものをここで補う：
   - NOW()・TRUNCATE(数値,桁)・ROUND(数値,負の桁) を関数として足す
   - 「< ANY (副問合せ)」「> ALL (…)」を MAX / MIN の副問合せに書き換える（SQLite は ANY・ALL を持たない）
   - 「SET sql_mode=…;」は読み飛ばす（|| は SQLite ではそのまま連結）
   - 外部キー制約を有効にする（PRAGMA foreign_keys = ON）
   答え合わせは「受講生のSQLの結果」と「答えのSQLの結果」を比べる。答えに ORDER BY が無ければ並び順は問わない。
   check.query があるときは、それぞれのSQLを流したあとに check.query を流した結果を比べる（INSERT・UPDATE などの確かめ）。 */

// 教材の4つのテーブル（スライド p.25・p.31・p.118・p.121）
export const STANDARD_SETUP = `CREATE TABLE loc (locno INTEGER PRIMARY KEY, locname VARCHAR(10));
INSERT INTO loc VALUES (1,'築地'),(2,'豊洲');
CREATE TABLE dept (deptno INTEGER PRIMARY KEY, deptname VARCHAR(20), locno INTEGER REFERENCES loc(locno));
INSERT INTO dept VALUES (10,'管理',1),(20,'システム',2),(30,'営業',1),(40,'企画',1);
CREATE TABLE emp (empno INTEGER PRIMARY KEY, name VARCHAR(10), hire_date DATE, salary INTEGER, pref VARCHAR(10), deptno INTEGER REFERENCES dept(deptno));
INSERT INTO emp VALUES
 (1001,'寺田','1999/04/01',1000000,'chiba',10),
 (1002,'酒井','2005/06/02',600000,'tokyo',20),
 (1003,'栗田','2007/08/01',300000,'kanagawa',30),
 (1004,'椿','2007/08/01',750000,'tokyo',20),
 (1005,'原島','2010/01/07',500000,'tokyo',20),
 (1006,'利根川','2012/10/01',550000,'chiba',30),
 (1007,'田久保','2019/04/01',220000,'kanagawa',NULL);
CREATE TABLE sal_grades (grade CHAR(1) PRIMARY KEY, low_sal INTEGER, high_sal INTEGER);
INSERT INTO sal_grades VALUES ('A',200000,399999),('B',400000,599999),('C',600000,799999),('D',800000,999999),('E',1000000,1199999);`;

let sqlPromise = null;
export function loadSql() {
  if (!sqlPromise) {
    sqlPromise = Promise.all([import("sql.js"), import("sql.js/dist/sql-wasm.wasm?url")])
      .then(([mod, wasm]) => (mod.default || mod)({ locateFile: () => wasm.default }))
      .catch(e => { sqlPromise = null; throw e; });
  }
  return sqlPromise;
}

const pad = n => String(n).padStart(2, "0");
function nowText() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function roundTo(x, digits, cut) {
  if (x === null || x === undefined) return null;
  const n = Number(x), d = Math.trunc(Number(digits) || 0), f = Math.pow(10, d);
  const v = cut ? Math.trunc(n * f) / f : Math.sign(n) * Math.round(Math.abs(n) * f) / f;
  return d <= 0 ? Math.round(v) : Number(v.toFixed(d));
}

export function openDb(SQL, setup) {
  const db = new SQL.Database();
  db.create_function("NOW", () => nowText());
  db.create_function("CHAR_LENGTH", s => (s === null || s === undefined ? null : [...String(s)].length));
  db.create_function("TRUNCATE", (x, d) => roundTo(x, d, true));
  db.create_function("ROUND", (x, d) => roundTo(x, d === undefined ? 0 : d, false));
  db.run("PRAGMA foreign_keys = ON;");
  const s = setup === undefined || setup === null || setup === "" ? STANDARD_SETUP : setup;
  if (s) db.run(s);
  return db;
}

// 副問合せの「SELECT 式 FROM 残り」を分ける（かっこの外の最初の FROM で切る）
function splitSelect(inner) {
  const head = inner.match(/^\s*SELECT\s+(?:DISTINCT\s+)?/i);
  if (!head) return null;
  let depth = 0;
  for (let i = head[0].length; i < inner.length; i++) {
    const c = inner[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (!depth && /\sFROM\s/i.test(inner.slice(i, i + 6))) return { expr: inner.slice(head[0].length, i).trim(), rest: inner.slice(i + 6) };
  }
  return null;
}

function rewriteAnyAll(sql) {
  const re = /(<=|>=|<>|!=|=|<|>)\s*(ANY|SOME|ALL)\s*\(/i;
  for (let guard = 0; guard < 20; guard++) {
    const m = re.exec(sql);
    if (!m) break;
    const open = m.index + m[0].length - 1;
    let depth = 0, end = -1;
    for (let i = open; i < sql.length; i++) {
      if (sql[i] === "(") depth++;
      else if (sql[i] === ")" && --depth === 0) { end = i; break; }
    }
    if (end < 0) break;
    const inner = sql.slice(open + 1, end);
    const op = m[1], all = m[2].toUpperCase() === "ALL";
    let repl;
    if (op === "=" && !all) repl = `IN (${inner})`;
    else if ((op === "<>" || op === "!=") && all) repl = `NOT IN (${inner})`;
    else {
      const sel = splitSelect(inner);
      if (!sel) break;
      // < ANY → 最大より小さい／< ALL → 最小より小さい／> ANY → 最小より大きい／> ALL → 最大より大きい
      const agg = (op[0] === "<") === all ? "MIN" : "MAX";
      repl = `${op} (SELECT ${agg}(${sel.expr}) FROM ${sel.rest})`;
    }
    sql = sql.slice(0, m.index) + repl + sql.slice(end + 1);
  }
  return sql;
}

export function prepareSql(code) {
  return rewriteAnyAll(String(code || "").replace(/^\s*SET\s+sql_mode\s*=[^;]*;?/gim, ""));
}

// SQLite のエラーを、受講生が読める言葉に
export function sqlErrorText(e) {
  const msg = String(e?.message || e);
  const rules = [
    [/no such table: (\S+)/, m => `テーブル「${m[1]}」がありません（名前の書きまちがいがないか確かめてください）`],
    [/no such column: (\S+)/, m => `列「${m[1]}」がありません（列名・別名の書きまちがいがないか確かめてください）`],
    [/near "([^"]*)": syntax error/, m => `「${m[1]}」のあたりで書き方がまちがっています`],
    [/incomplete input/, () => "SQLが途中で終わっています（かっこや ' の閉じ忘れ、セミコロンを確かめてください）"],
    [/UNIQUE constraint failed: (\S+)/, m => `${m[1]} に同じ値がすでにあります（主キー・UNIQUE制約）`],
    [/NOT NULL constraint failed: (\S+)/, m => `${m[1]} は空（NULL）にできません（NOT NULL制約）`],
    [/FOREIGN KEY constraint failed/, () => "参照先にない値か、ほかから参照されている行です（外部キー制約）"],
    [/CHECK constraint failed/, () => "条件に合わない値です（CHECK制約）"],
    [/table (\S+) already exists/, m => `テーブル「${m[1]}」はもうあります`],
    [/misuse of aggregate/, () => "集計関数（SUM・COUNT など）の使い方がまちがっています（WHERE では使えません。HAVING を使います）"],
    [/must appear in the GROUP BY|not an aggregate/, () => "GROUP BY に書いていない列は、そのまま SELECT できません"],
    [/ambiguous column name: (\S+)/, m => `列「${m[1]}」が複数のテーブルにあります（テーブル名か別名を付けてください）`],
  ];
  for (const [re, f] of rules) { const m = msg.match(re); if (m) return f(m); }
  return msg;
}

const normCell = v => (v === null || v === undefined ? null : typeof v === "number" ? Math.round(v * 1e6) / 1e6 : String(v));
function sameSet(a, b, { ordered, columns }) {
  if (!a || !b) return false;
  if (columns && JSON.stringify(a.columns) !== JSON.stringify(b.columns)) return false;
  const rows = s => s.values.map(r => JSON.stringify(r.map(normCell)));
  const ra = rows(a), rb = rows(b);
  if (ra.length !== rb.length || a.columns.length !== b.columns.length) return false;
  if (!ordered) { ra.sort(); rb.sort(); }
  return ra.every((r, i) => r === rb[i]);
}
const emptySet = () => ({ columns: [], values: [] });

/* ---------- MySQL ならエラーになる書き方を、SQLite でもエラーにする ----------
   SQLite は次の2つを黙って通すが、教材（MySQL）ではエラーとして教えている（スライド p.95・p.132）。
   - 集計関数・GROUP BY を使うのに、GROUP BY に書いていない列をそのまま SELECT する
   - 2行以上を返す副問合せを、= や >= など1行用の演算子で比べる
   どちらも文のいちばん外側だけを見る簡単な読み取り。読み取れない書き方は確かめずに通す */
const AGG = /\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i;
const NOT_COLUMN = new Set(["CASE", "WHEN", "THEN", "ELSE", "END", "AND", "OR", "NOT", "NULL", "IS", "IN", "LIKE", "BETWEEN", "AS", "DISTINCT", "ASC", "DESC", "TRUE", "FALSE"]);
// 文字列・"別名"・コメントの中身を伏せる（位置はそのまま）
const maskSql = sql => sql
  .replace(/'(?:[^']|'')*'/g, m => `'${"~".repeat(m.length - 2)}'`)
  .replace(/"[^"]*"/g, m => `"${"~".repeat(m.length - 2)}"`)
  .replace(/--[^\n]*/g, m => " ".repeat(m.length));
// かっこの中を空白にした文字列（いちばん外側の句を探す）
function outerOnly(masked) {
  let d = 0, out = "";
  for (const c of masked) {
    if (c === "(") { d++; out += " "; } else if (c === ")") { d = Math.max(0, d - 1); out += " "; } else out += d ? " " : c;
  }
  return out;
}
function splitTop(text) {
  const parts = []; let d = 0, from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(") d++; else if (c === ")") d--; else if (c === "," && !d) { parts.push(text.slice(from, i)); from = i + 1; }
  }
  parts.push(text.slice(from));
  return parts.map(p => p.trim()).filter(Boolean);
}
function columnsIn(maskedItem) {
  const out = [];
  const re = /([A-Za-z_][A-Za-z0-9_]*)(?:\.([A-Za-z_][A-Za-z0-9_]*))?(\s*\()?/g;
  let m;
  while ((m = re.exec(maskedItem))) {
    if (m[3]) continue; // 関数の名前
    const name = (m[2] || m[1]);
    if (!NOT_COLUMN.has(name.toUpperCase()) && !/^\d/.test(name)) out.push(name.toLowerCase());
  }
  return out;
}
function checkGroupBy(text) {
  const masked = maskSql(text);
  const top = outerOnly(masked);
  const sel = top.match(/^\s*SELECT\s+(DISTINCT\s+)?/i);
  if (!sel) return;
  const from = top.search(/\bFROM\b/i);
  if (from < 0) return;
  const g = top.match(/\bGROUP\s+BY\b/i);
  const listText = masked.slice(sel[0].length, from);
  const items = splitTop(listText);
  const hasAgg = items.some(it => AGG.test(it));
  if (!hasAgg && !g) return;
  if (items.some(it => /\bSELECT\b/i.test(it))) return;
  let groupItems = [];
  if (g) {
    const start = g.index + g[0].length;
    const rest = top.slice(start);
    const end = rest.search(/\b(HAVING|ORDER\s+BY|LIMIT|UNION)\b/i);
    groupItems = splitTop(masked.slice(start, end < 0 ? top.length : start + end));
  }
  const groupCols = new Set(groupItems.flatMap(columnsIn));
  const groupNums = new Set(groupItems.filter(x => /^\d+$/.test(x)).map(Number));
  const bad = [];
  items.forEach((it, k) => {
    if (AGG.test(it)) return;
    const alias = (it.match(/\s+AS\s+(\S+)\s*$/i) || [])[1];
    if (groupNums.has(k + 1) || (alias && groupCols.has(alias.toLowerCase()))) return;
    const body = it.replace(/\s+AS\s+\S+\s*$/i, "");
    if (/^\*$|\.\*$/.test(body)) { bad.push("*"); return; }
    bad.push(...columnsIn(body).filter(c => !groupCols.has(c)));
  });
  if (bad.length) {
    const names = [...new Set(bad)].join("・");
    throw new Error(g
      ? `GROUP BY に書いていない列（${names}）は、そのまま SELECT できません。GROUP BY に足すか、集計関数で包みます`
      : `集計関数（COUNT・SUM など）と、ふつうの列（${names}）を一緒に SELECT するときは GROUP BY が要ります`);
  }
}
function checkScalarSubqueries(db, text) {
  const masked = maskSql(text);
  const re = /(<=|>=|<>|!=|=|<|>)\s*\(\s*SELECT\b/gi;
  let m;
  while ((m = re.exec(masked))) {
    const open = masked.indexOf("(", m.index);
    let d = 0, end = -1;
    for (let i = open; i < masked.length; i++) {
      if (masked[i] === "(") d++;
      else if (masked[i] === ")" && --d === 0) { end = i; break; }
    }
    if (end < 0) return;
    let rows = 0;
    try {
      // 外の表の列を使う副問合せ（相関副問合せ）は単独では動かないので、確かめずに通す
      const r = db.exec(text.slice(open + 1, end));
      rows = r[0]?.values.length || 0;
    } catch (e) { rows = 0; }
    if (rows > 1) throw new Error(`副問合せが${rows}行を返しています。「${m[1]}」は1行を返す副問合せにしか使えません（複数行なら IN・ANY・ALL を使います）`);
  }
}

// 文を1つずつ流して、最後に結果を返した文の結果を返す（0行でも列名を残す。exec は0行だと何も返さない）
function execAll(db, sql, strict = true) {
  let last = null;
  for (const stmt of db.iterateStatements(sql)) {
    try {
      if (strict) {
        const text = stmt.getSQL();
        checkGroupBy(text);
        checkScalarSubqueries(db, text);
      }
      const columns = stmt.getColumnNames();
      const values = [];
      while (stmt.step()) values.push(stmt.get());
      if (columns.length) last = { columns, values };
    } finally { stmt.free(); }
  }
  return last;
}

// 1つのSQL（複数の文でもよい）を流して、最後の結果を返す。query があれば続けて流した結果を返す
export function runOn(SQL, setup, code, query) {
  const db = openDb(SQL, setup);
  try {
    const res = execAll(db, prepareSql(code));
    if (query) return execAll(db, prepareSql(query)) || emptySet();
    return res;
  } finally { db.close(); }
}

/* 受講生のSQLを流し、確かめることを1つずつ見る。
   返す形：{ set: 最後の結果 {columns, values} | null, changed: 結果を返さない文だけだったか, error, results: [{ ok, error? }] } */
export async function runSqlChecks({ setup, code, answer, checks = [] }) {
  let SQL;
  try { SQL = await loadSql(); } catch (e) { return { set: null, error: "SQLを動かす準備ができませんでした。ページを読み込み直してください。", results: checks.map(() => ({ ok: false })) }; }
  let set = null, error = "";
  try { set = runOn(SQL, setup, code, ""); } catch (e) { error = sqlErrorText(e); }
  const results = checks.map(c => {
    if (error) return { ok: false };
    try {
      const ans = c.answer ?? answer;
      const mine = c.query ? runOn(SQL, setup, code, c.query) : set;
      const exp = runOn(SQL, setup, ans, c.query || "");
      const ordered = /\bORDER\s+BY\b/i.test(c.query || ans || "");
      return { ok: sameSet(mine, exp, { ordered, columns: !!c.columns }) };
    } catch (e) { return { ok: false, error: sqlErrorText(e) }; }
  });
  return { set, error, results };
}

// テーブルの一覧と中身（「テーブル」タブ・補完の候補に使う）
export async function describeTables(setup, code = "") {
  const SQL = await loadSql();
  const db = openDb(SQL, setup);
  try {
    if (code) { try { execAll(db, prepareSql(code)); } catch (e) { /* 途中で止まっても、そこまでの中身を見せる */ } }
    const names = (db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")[0]?.values || []).map(r => r[0]);
    return names.map(name => {
      const r = db.exec(`SELECT * FROM "${name}" LIMIT 100`)[0];
      const cols = (db.exec(`PRAGMA table_info("${name}")`)[0]?.values || []).map(v => ({ name: v[1], type: v[2], pk: !!v[5] }));
      return { name, columns: cols, values: r?.values || [] };
    });
  } finally { db.close(); }
}

// 1つのSQLの最後の結果（「期待する結果」に使う）
export async function querySet(setup, code, query = "") {
  const SQL = await loadSql();
  try { return { set: runOn(SQL, setup, code, query), error: "" }; } catch (e) { return { set: null, error: sqlErrorText(e) }; }
}

export function sqlWords(tables) {
  return (tables || []).flatMap(t => [t.name, ...t.columns.map(c => c.name)]);
}
