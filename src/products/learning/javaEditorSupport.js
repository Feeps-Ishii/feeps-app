// 2026-08-25: Javaエディタの下支え。色分け・補完辞書・字下げ・エラー位置の解釈。
// 承認モック: mock/code-editor/index.html
//
// **画面を持たない処理だけをここに置く。** 画面はJavaEditor.jsx。

// ---- 色分け ----
//
// 置換を重ねる方式にすると、自分が出したHTML（class="str" など）を次の置換が
// また拾ってしまい、文字列を書いた瞬間に崩れる（2026-08-25にモックで実際に踏んだ）。
// **必ず字句を1つずつ読む。**
const KEYWORDS = new Set([
  "public", "private", "protected", "class", "interface", "static", "void", "new", "return",
  "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
  "import", "package", "final", "extends", "implements", "this", "super",
  "true", "false", "null", "try", "catch", "finally", "throw", "throws",
  "int", "double", "boolean", "char", "long", "float", "short", "byte", "var", "String",
]);

// 1行を字句に分ける。type は kw / str / num / cls / cmt / ""(そのまま)。
export function tokenizeLine(line) {
  const out = [];
  let i = 0;
  const push = (type, from, to) => out.push({ type, from, to, text: line.slice(from, to) });

  while (i < line.length) {
    const c = line[i];
    if (c === "/" && line[i + 1] === "/") { push("cmt", i, line.length); i = line.length; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "\\") { j += 2; continue; }
        if (line[j] === c) { j += 1; break; }
        j += 1;
      }
      push("str", i, j); i = j; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_$]/.test(line[j])) j += 1;
      const word = line.slice(i, j);
      push(KEYWORDS.has(word) ? "kw" : /^[A-Z]/.test(word) ? "cls" : "", i, j);
      i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < line.length && /[0-9._]/.test(line[j])) j += 1;
      push("num", i, j); i = j; continue;
    }
    let j = i;
    while (j < line.length && !/["'A-Za-z_$0-9]/.test(line[j]) && !(line[j] === "/" && line[j + 1] === "/")) j += 1;
    if (j === i) j += 1;
    push("", i, j); i = j;
  }
  return out;
}

// ---- javacのエラーから、ファイル・行・列を取る ----
//
// javac は3行で位置を教えてくれる。
//   Profile.java:3: error: ';' expected
//       System.out.println("hi")
//                              ^
// 3行目のキャレットの位置が列。**推測せずこれをそのまま使う。**
export function parseJavacError(text) {
  const lines = String(text || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].match(/^([A-Za-z_$][A-Za-z0-9_$]*\.java):(\d+):\s*error:/);
    if (!head) continue;
    const caret = lines[i + 2] || "";
    const at = caret.indexOf("^");
    return {
      file: head[1],
      line: Number(head[2]),
      // 列が読めないときは0。画面側は行だけを示す。
      col: at >= 0 ? at + 1 : 0,
    };
  }
  return null;
}

// ---- 字下げ ----
export const INDENT = "  ";

export function lineStartAt(value, pos) {
  return value.lastIndexOf("\n", pos - 1) + 1;
}

// 改行したら、いまの行と同じ深さから書き始める。
// 行末が { なら1段深く、直後が } ならその } を1段浅い位置へ送る。
export function newlineEdit(value, pos) {
  const start = lineStartAt(value, pos);
  const indent = (value.slice(start, pos).match(/^[ \t]*/) || [""])[0];
  const opens = value.slice(0, pos).trimEnd().endsWith("{");
  const nextIsClose = value.slice(pos).trimStart().startsWith("}");
  const inner = indent + (opens ? INDENT : "");
  const insert = opens && nextIsClose ? `\n${inner}\n${indent}` : `\n${inner}`;
  return { value: value.slice(0, pos) + insert + value.slice(pos), caret: pos + 1 + inner.length };
}

// } を打った行が空白だけなら、1段戻してから置く。
export function closingBraceEdit(value, pos) {
  const start = lineStartAt(value, pos);
  const head = value.slice(start, pos);
  if (/^[ \t]+$/.test(head) && head.length >= INDENT.length) {
    const cut = start + head.length - INDENT.length;
    return { value: value.slice(0, cut) + "}" + value.slice(pos), caret: cut + 1 };
  }
  return { value: value.slice(0, pos) + "}" + value.slice(pos), caret: pos + 1 };
}

// Tabは字下げ、Shift+Tabは戻す。複数行を選んでいればまとめて動かす。
export function indentEdit(value, selStart, selEnd, back) {
  const multi = value.slice(selStart, selEnd).includes("\n");
  if (!multi && !back) {
    return { value: value.slice(0, selStart) + INDENT + value.slice(selEnd), caret: selStart + INDENT.length };
  }
  const first = lineStartAt(value, selStart);
  let last = value.indexOf("\n", selEnd);
  if (last < 0) last = value.length;

  let headShift = 0;
  let delta = 0;
  const moved = value.slice(first, last).split("\n").map((line, i) => {
    if (back) {
      const cut = (line.match(/^ {1,2}/) || [""])[0].length;
      if (i === 0) headShift = -cut;
      delta -= cut;
      return line.slice(cut);
    }
    if (i === 0) headShift = INDENT.length;
    delta += INDENT.length;
    return line ? INDENT + line : line;
  }).join("\n");

  return {
    value: value.slice(0, first) + moved + value.slice(last),
    caret: Math.max(first, selStart + headShift),
    caretEnd: Math.max(first, selEnd + delta),
  };
}

// ---- 補完 ----
//
// **単元で扱う範囲だけを載せる。** Javaのすべてを出すと初学者には邪魔になる。
// 単元が進むごとに level を上げて候補を増やす。
const COMPLETIONS = [
  { label: "sysout", kind: "定型", detail: "System.out.println()", insert: "System.out.println($);", level: 1 },
  { label: "psvm", kind: "定型", detail: "main メソッド", insert: "public static void main(String[] args) {\n  $\n}", level: 1 },
  { label: "fori", kind: "定型", detail: "for 文", insert: "for (int i = 0; i < $; i++) {\n  \n}", level: 2 },
  { label: "System.out.println", kind: "メソッド", detail: "画面に出す", insert: "System.out.println($);", level: 1 },
  { label: "String", kind: "型", detail: "文字列", insert: "String ", level: 1 },
  { label: "int", kind: "型", detail: "整数", insert: "int ", level: 1 },
  { label: "double", kind: "型", detail: "小数", insert: "double ", level: 1 },
  { label: "boolean", kind: "型", detail: "true / false", insert: "boolean ", level: 1 },
  { label: "char", kind: "型", detail: "1文字", insert: "char ", level: 1 },
  { label: "long", kind: "型", detail: "大きな整数", insert: "long ", level: 1 },
  { label: "final", kind: "構文", detail: "あとから変えない", insert: "final ", level: 1 },
  { label: "Scanner", kind: "型", detail: "入力を読む（要 import）", insert: "Scanner ", import: "java.util.Scanner", level: 1 },
  { label: "ArrayList", kind: "型", detail: "並びを持つ入れもの（要 import）", insert: "ArrayList<>", import: "java.util.ArrayList", level: 3 },
  { label: "if", kind: "構文", detail: "条件分岐", insert: "if ($) {\n  \n}", level: 2 },
  { label: "else", kind: "構文", detail: "そうでなければ", insert: "else {\n  $\n}", level: 2 },
  { label: "for", kind: "構文", detail: "繰り返し", insert: "for ($) {\n  \n}", level: 2 },
  { label: "while", kind: "構文", detail: "繰り返し", insert: "while ($) {\n  \n}", level: 2 },
  { label: "length()", kind: "メソッド", detail: "文字数", insert: "length()", level: 1 },
  { label: "equals()", kind: "メソッド", detail: "中身が同じか比べる", insert: "equals($)", level: 1 },
  { label: "substring()", kind: "メソッド", detail: "一部を取り出す", insert: "substring($)", level: 2 },
  { label: "Integer.parseInt()", kind: "メソッド", detail: "文字列を整数へ", insert: "Integer.parseInt($)", level: 1 },
];

// 書いたら import が要るもの。候補から選んだときに上へ足す。
export const AUTO_IMPORT = {
  Scanner: "java.util.Scanner",
  ArrayList: "java.util.ArrayList",
  List: "java.util.List",
  Map: "java.util.Map",
  HashMap: "java.util.HashMap",
};

// カーソルの手前にある「打ちかけの語」。
export function tokenBefore(value, pos) {
  const upto = value.slice(0, pos);
  const m = upto.match(/[A-Za-z_.$][A-Za-z0-9_.$]*$/);
  if (!m) return { word: "", start: pos };
  return { word: m[0], start: pos - m[0].length };
}

// コードの中に書いた名前（変数・メソッド・クラス）も候補にする（2026-10-15）。
// 宣言（int score = … / String name; / const total = … / function judge(…) / void show(…)）の名前を先に、
// ほかに出てくる名前をその後に。打ちかけの語そのもの（カーソルの位置の語）は数えない。
const JS_WORDS = new Set(["const", "let", "var", "function", "return", "if", "else", "for", "of", "in", "while", "do", "switch", "case",
  "break", "continue", "new", "class", "true", "false", "null", "undefined", "typeof", "this", "async", "await", "try", "catch", "throw"]);
export function codeWordCompletions(value, start, pos, word) {
  const q = String(word || "");
  if (!q || q.includes(".")) return [];
  const text = String(value || "").slice(0, start) + String(value || "").slice(pos);
  const plain = text.replace(/\/\/.*$/gm, "").replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "\"\"");
  const declared = new Map();
  const DECL = [
    /\b(?:int|long|short|byte|double|float|boolean|char|String|var|final|[A-Z][A-Za-z0-9_]*(?:<[^<>]*>)?(?:\[\])*)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?=[=;,):\[]|$)/gm,
    /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g,
    /\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)/g,
    /\b(?:void|int|long|double|boolean|String|[A-Z][A-Za-z0-9_]*)\s+([a-z_$][A-Za-z0-9_$]*)\s*\(/g,
    /\bclass\s+([A-Za-z_$][A-Za-z0-9_$]*)/g,
  ];
  for (const re of DECL) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(plain))) if (!KEYWORDS.has(m[1]) && !JS_WORDS.has(m[1])) declared.set(m[1], /\(/.test(plain.slice(m.index + m[0].length - 1, m.index + m[0].length)) || /function/.test(m[0]) ? "メソッド" : /class/.test(m[0]) ? "クラス" : "変数");
  }
  const others = new Set();
  const all = plain.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [];
  for (const w of all) if (!declared.has(w) && !KEYWORDS.has(w) && !JS_WORDS.has(w) && w.length > 1) others.add(w);
  const lq = q.toLowerCase();
  const hit = w => w !== q && w.toLowerCase().startsWith(lq);
  const items = [];
  for (const [w, kind] of declared) if (hit(w)) items.push({ label: w, kind, detail: "このコードの中", insert: w });
  for (const w of others) if (hit(w)) items.push({ label: w, kind: "名前", detail: "このコードの中", insert: w });
  return items.slice(0, 8);
}

export function completionsFor(word, level = 1, code = null) {
  const q = String(word || "").toLowerCase();
  const pool = COMPLETIONS.filter(c => (c.level || 1) <= level);
  const fixed = q ? pool.filter(c => c.label.toLowerCase().startsWith(q)) : pool;
  // 書いた変数を先に出す（定型と同じ名前は定型のほうを残す）
  const mine = code ? codeWordCompletions(code.value, code.start, code.pos, word).filter(m => !fixed.some(f => f.label === m.label)) : [];
  return [...mine, ...fixed].slice(0, 12);
}

// 使っているのに import が無いものを上に足す。足した行数を返す
// （エラー位置を持っている画面側が、行番号をずらせるように）。
export function addMissingImports(value) {
  const body = value.replace(/^import .*$/gm, "");
  const added = [];
  let next = value;
  for (const [name, path] of Object.entries(AUTO_IMPORT)) {
    const used = new RegExp(`\\b${name}\\b`).test(body);
    const has = new RegExp(`^import\\s+${path.replace(/\./g, "\\.")};`, "m").test(next);
    if (used && !has) {
      next = `import ${path};\n${next}`;
      added.push(`import ${path};`);
    }
  }
  return { value: next, added };
}
