// 2026-10-13: SQL の演習で JavaEditor を lang="sql" で使うときの色分けと補完。
// 補完は辞書引き（ブラウザの中だけ）。テーブル名・列名は画面から words で渡す。

const KEYWORDS = [
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "BETWEEN", "LIKE", "IS", "NULL", "AS", "DISTINCT",
  "ORDER", "BY", "ASC", "DESC", "GROUP", "HAVING", "JOIN", "INNER", "LEFT", "RIGHT", "OUTER", "ON",
  "CASE", "WHEN", "THEN", "ELSE", "END", "ANY", "ALL", "EXISTS", "UNION", "LIMIT",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE", "DROP", "ALTER", "ADD",
  "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "UNIQUE", "DEFAULT", "CHECK", "CONSTRAINT",
  "INTEGER", "VARCHAR", "CHAR", "DATE", "DECIMAL", "COMMIT", "ROLLBACK",
];
const KW = new Set(KEYWORDS);
const FUNCS = [
  ["COUNT", "件数"], ["SUM", "合計"], ["AVG", "平均"], ["MAX", "最大"], ["MIN", "最小"],
  ["LENGTH", "文字数"], ["UPPER", "大文字に"], ["LOWER", "小文字に"], ["SUBSTR", "一部を取り出す"], ["CONCAT", "つなげる"],
  ["ROUND", "四捨五入"], ["TRUNCATE", "切り捨て"], ["NOW", "いまの日時"], ["COALESCE", "NULLでない最初の値"],
];
const FN = new Set(FUNCS.map(f => f[0]));

const SNIPPETS = [
  { label: "SELECT … FROM", kind: "形", detail: "検索", insert: "SELECT $\nFROM " },
  { label: "ORDER BY", kind: "形", detail: "並べる", insert: "ORDER BY $" },
  { label: "GROUP BY", kind: "形", detail: "まとめる", insert: "GROUP BY $" },
  { label: "INNER JOIN … ON", kind: "形", detail: "結合", insert: "INNER JOIN $ ON " },
  { label: "LEFT OUTER JOIN … ON", kind: "形", detail: "外部結合", insert: "LEFT OUTER JOIN $ ON " },
  { label: "CASE WHEN … END", kind: "形", detail: "場合分け", insert: "CASE WHEN $ THEN  ELSE  END" },
  { label: "INSERT INTO … VALUES", kind: "形", detail: "追加", insert: "INSERT INTO $ VALUES ();" },
  { label: "UPDATE … SET", kind: "形", detail: "更新", insert: "UPDATE $ SET  WHERE ;" },
  { label: "DELETE FROM", kind: "形", detail: "削除", insert: "DELETE FROM $ WHERE ;" },
];

export function tokenizeSqlLine(line) {
  const out = [];
  let i = 0;
  const push = (type, from, to) => out.push({ type, from, to, text: line.slice(from, to) });
  while (i < line.length) {
    const c = line[i];
    if (c === "-" && line[i + 1] === "-") { push("cmt", i, line.length); i = line.length; continue; }
    if (c === "'") {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "'" && line[j + 1] === "'") { j += 2; continue; }
        if (line[j] === "'") { j += 1; break; }
        j += 1;
      }
      push("str", i, j); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j += 1;
      const up = line.slice(i, j).toUpperCase();
      push(KW.has(up) ? "kw" : FN.has(up) ? "cls" : "", i, j);
      i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < line.length && /[0-9.]/.test(line[j])) j += 1;
      push("num", i, j); i = j; continue;
    }
    let j = i;
    while (j < line.length && !/['A-Za-z_0-9]/.test(line[j]) && !(line[j] === "-" && line[j + 1] === "-")) j += 1;
    push("", i, j); i = j;
  }
  return out;
}

// 「e.na」のように別名のあとは、点の後ろだけを補う
export function sqlTokenBefore(value, pos) {
  const upto = value.slice(0, pos);
  const m = upto.match(/[A-Za-z_][A-Za-z0-9_]*$/);
  if (!m) return { word: "", start: pos };
  return { word: m[0], start: pos - m[0].length };
}

export function sqlCompletionsFor(word, words = []) {
  const q = String(word || "").toLowerCase();
  const upper = /^[A-Z]/.test(word || "");
  const names = [...new Set(words)].map(w => ({ label: w, kind: "名前", detail: "", insert: w }));
  const kws = KEYWORDS.map(k => ({ label: k, kind: "語", detail: "", insert: upper || !q ? k : k.toLowerCase() }));
  const fns = FUNCS.map(([f, d]) => ({ label: `${f}()`, kind: "関数", detail: d, insert: `${upper || !q ? f : f.toLowerCase()}($)` }));
  const pool = [...names, ...SNIPPETS, ...fns, ...kws];
  if (!q) return pool.slice(0, 12);
  return pool.filter(c => c.label.toLowerCase().startsWith(q) && c.label.toLowerCase() !== q).slice(0, 12);
}
