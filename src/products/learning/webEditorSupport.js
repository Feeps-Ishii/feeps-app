// 2026-08-27: HTML/CSS演習エディタの言語まわり。承認モック: mock/html-editor/index.html
//
// Javaと違い、HTML/CSSは**ブラウザ自身が実行環境**なのでサーバーへは行かない。
// 色付け・字下げ・補完はすべてこの中で完結する。
//
// 色付けは行をまたぐ状態（コメントの途中、タグの途中、文字列の途中）を持つ。
// 行ごとに独立させると、複数行にわたるコメントやタグで色が破綻する。

export const INDENT = "  ";

// ---- 色付け ----
//
// 返す形は JavaEditor と同じ { text, type, from, to }。
// type: kw(タグ名) / attr / str / cmt / cls(セレクタ) / num / null

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

// HTMLを1文書ぶん色分けする。行をまたぐ状態は state で持ち回る。
// state: "text" | "tag" | "cmt" | "str"（str のときは quote に引用符を持つ）
function tokenizeHtmlText(text) {
  const lines = String(text || "").split("\n");
  let state = "text";
  let quote = "";
  return lines.map(line => {
    const out = [];
    let i = 0;
    let plainFrom = 0;
    const flushPlain = (to, type) => {
      if (to > plainFrom) out.push({ text: line.slice(plainFrom, to), type: type || null, from: plainFrom, to });
    };

    while (i < line.length) {
      if (state === "cmt") {
        const end = line.indexOf("-->", i);
        const stop = end < 0 ? line.length : end + 3;
        out.push({ text: line.slice(i, stop), type: "cmt", from: i, to: stop });
        i = stop;
        plainFrom = i;
        if (end >= 0) state = "text";
        continue;
      }
      if (state === "str") {
        const end = line.indexOf(quote, i);
        const stop = end < 0 ? line.length : end + 1;
        out.push({ text: line.slice(i, stop), type: "str", from: i, to: stop });
        i = stop;
        plainFrom = i;
        if (end >= 0) state = "tag";
        continue;
      }
      if (state === "tag") {
        const ch = line[i];
        if (ch === '"' || ch === "'") { flushPlain(i, "attr"); quote = ch; state = "str"; plainFrom = i; continue; }
        if (ch === ">") {
          flushPlain(i, "attr");
          out.push({ text: ">", type: "kw", from: i, to: i + 1 });
          i += 1; plainFrom = i; state = "text";
          continue;
        }
        i += 1;
        continue;
      }
      // state === "text"
      if (line.startsWith("<!--", i)) { flushPlain(i); state = "cmt"; plainFrom = i; continue; }
      if (line[i] === "<") {
        flushPlain(i);
        // タグ名までを kw、そのあとの属性は tag 状態で attr として拾う
        const m = line.slice(i).match(/^<\/?[A-Za-z][\w:-]*|^<!DOCTYPE/i);
        const stop = i + (m ? m[0].length : 1);
        out.push({ text: line.slice(i, stop), type: "kw", from: i, to: stop });
        i = stop; plainFrom = i; state = "tag";
        continue;
      }
      i += 1;
    }
    flushPlain(line.length, state === "tag" ? "attr" : state === "cmt" ? "cmt" : null);
    return out;
  });
}

// CSSを1文書ぶん色分けする。
// state: "top"(セレクタ) | "block" | "value" | "cmt"
function tokenizeCssText(text) {
  const lines = String(text || "").split("\n");
  let state = "top";
  let back = "top";
  return lines.map(line => {
    const out = [];
    let i = 0;
    let from = 0;
    const flush = (to, type) => {
      if (to > from) out.push({ text: line.slice(from, to), type: type || null, from, to });
    };

    while (i < line.length) {
      if (state === "cmt") {
        const end = line.indexOf("*/", i);
        const stop = end < 0 ? line.length : end + 2;
        out.push({ text: line.slice(i, stop), type: "cmt", from: i, to: stop });
        i = stop; from = i;
        if (end >= 0) state = back;
        continue;
      }
      if (line.startsWith("/*", i)) {
        flush(i, state === "top" ? "cls" : state === "value" ? "str" : "kw");
        back = state; state = "cmt"; from = i;
        continue;
      }
      const ch = line[i];
      if (state === "top" && ch === "{") {
        flush(i, "cls");
        out.push({ text: "{", type: null, from: i, to: i + 1 });
        i += 1; from = i; state = "block";
        continue;
      }
      if (state !== "top" && ch === "}") {
        flush(i, state === "value" ? "str" : "kw");
        out.push({ text: "}", type: null, from: i, to: i + 1 });
        i += 1; from = i; state = "top";
        continue;
      }
      if (state === "block" && ch === ":") {
        flush(i, "kw");
        out.push({ text: ":", type: null, from: i, to: i + 1 });
        i += 1; from = i; state = "value";
        continue;
      }
      if (state === "value" && ch === ";") {
        flush(i, "str");
        out.push({ text: ";", type: null, from: i, to: i + 1 });
        i += 1; from = i; state = "block";
        continue;
      }
      i += 1;
    }
    flush(line.length, state === "top" ? "cls" : state === "value" ? "str" : state === "cmt" ? "cmt" : "kw");
    return out;
  });
}

export function tokenizeWeb(mode, text) {
  return mode === "css" ? tokenizeCssText(text) : tokenizeHtmlText(text);
}

// ---- 字下げ ----

export function lineStartAt(value, pos) {
  return value.lastIndexOf("\n", pos - 1) + 1;
}

// 開いたタグの行で改行したら1段深く、閉じタグの手前なら閉じタグを1段浅い位置へ送る。
// CSSは { } で同じことをする。
export function webNewlineEdit(mode, value, pos) {
  const start = lineStartAt(value, pos);
  const cur = value.slice(start, pos);
  const indent = (cur.match(/^[ \t]*/) || [""])[0];
  const after = value.slice(pos);

  let opens;
  let nextIsClose;
  if (mode === "css") {
    opens = cur.trimEnd().endsWith("{");
    nextIsClose = after.trimStart().startsWith("}");
  } else {
    const m = cur.trimEnd().match(/<([A-Za-z][\w:-]*)(\s[^<>]*)?>$/);
    // 空要素（<br> <img> など）と自分で閉じたタグは深くしない
    opens = Boolean(m) && !VOID_TAGS.has(m[1].toLowerCase()) && !cur.trimEnd().endsWith("/>");
    nextIsClose = /^\s*<\//.test(after);
  }

  const inner = indent + (opens ? INDENT : "");
  const insert = opens && nextIsClose ? `\n${inner}\n${indent}` : `\n${inner}`;
  return { value: value.slice(0, pos) + insert + value.slice(pos), caret: pos + 1 + inner.length };
}

// ---- 閉じタグ ----
//
// カーソルより前で「まだ閉じていないタグ」を、外側から順に返す。
// 各要素は { name, at }。at は開始タグの `<` の位置で、閉じタグの字下げを
// 開いた行に合わせるために使う。
// 文字列やコメントの中は見ない（教材の範囲では実害が出ないので簡単に済ませる）。
export function openTagsAt(value, pos) {
  const stack = [];
  const re = /<(\/?)([A-Za-z][\w:-]*)((?:"[^"]*"|'[^']*'|[^<>])*)>/g;
  const text = value.slice(0, pos);
  let m;
  while ((m = re.exec(text))) {
    const [, slash, name, attrs] = m;
    const lower = name.toLowerCase();
    if (slash) {
      const at = stack.map(x => x.name).lastIndexOf(lower);
      if (at >= 0) stack.length = at;
      continue;
    }
    if (VOID_TAGS.has(lower) || attrs.trimEnd().endsWith("/")) continue;
    stack.push({ name: lower, at: m.index });
  }
  return stack;
}

// `>` を打った瞬間に閉じタグを補う（VS Codeと同じ）。
// **これが無いと、閉じ忘れが「打ち間違い」として量産される。** 閉じタグの / を
// 忘れる、はこの単元でいちばん多い詰まり方なので、道具の側で減らす。
export function closeTagEdit(value, pos) {
  const before = value.slice(0, pos);
  const m = before.match(/<([A-Za-z][\w:-]*)((?:"[^"]*"|'[^']*'|[^<>])*)$/);
  if (!m) return null;
  const [, name, attrs] = m;
  if (VOID_TAGS.has(name.toLowerCase()) || attrs.trimEnd().endsWith("/")) return null;
  // すぐ後ろに同じ閉じタグがもうあるなら足さない
  if (new RegExp(`^\\s*</${name}\\s*>`, "i").test(value.slice(pos))) return null;
  const insert = `></${name}>`;
  return { value: before + insert + value.slice(pos), caret: pos + 1 };
}

// `</` まで打ったら、いま開いているいちばん内側のタグ名を補って閉じる。
// 行に `<` しか無ければ、**開始タグを書いた行と同じ字下げ**にそろえる
// （1段戻すのではなく、開いた行に合わせる。入れ子が深いときにずれないため）。
export function closeSlashEdit(value, pos) {
  if (!value.slice(0, pos).endsWith("<")) return null;
  const open = openTagsAt(value, pos - 1).pop();
  if (!open) return null;

  const start = lineStartAt(value, pos);
  const only = value.slice(start, pos).match(/^([ \t]*)<$/);
  let cut = pos - 1;                           // 打った `<` から置き換える
  let indent = "";
  if (only) {
    const openLine = lineStartAt(value, open.at);
    indent = (value.slice(openLine, open.at).match(/^[ \t]*/) || [""])[0];
    if (value.slice(openLine, open.at) === indent) cut = start;   // 開始タグが行頭のときだけ合わせる
  }

  const insert = `${indent}</${open.name}>`;
  return { value: value.slice(0, cut) + insert + value.slice(pos), caret: cut + insert.length };
}

// 打った文字で行の頭を戻す。CSSの } と、HTMLの </ が対象。
// 「その行がまだ空白だけ」のときだけ動かす（書いた文字を勝手に動かさない）。
export function webDedentEdit(mode, value, pos, typed) {
  const start = lineStartAt(value, pos);
  const head = value.slice(start, pos);
  const trigger = mode === "css" ? typed === "}" : typed === "/" && head.endsWith("<");
  const blank = mode === "css" ? /^[ \t]*$/.test(head) : /^[ \t]*<$/.test(head);
  if (!trigger || !blank) return null;
  const spaces = (head.match(/^[ \t]*/) || [""])[0];
  if (spaces.length < INDENT.length) return null;
  const cut = start + spaces.length - INDENT.length;
  const keep = value.slice(start + spaces.length, pos); // HTMLでは "<"
  return { value: value.slice(0, cut) + keep + typed + value.slice(pos), caret: cut + keep.length + 1 };
}

// ---- 補完 ----
//
// **単元で扱う範囲だけを載せる。** レベルが上がると候補が増える。
// $ はカーソルを置く場所。
const HTML_COMPLETIONS = [
  { label: "html:5", kind: "定型", detail: "文書のひな形", level: 1, insert: '<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>$</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n\n</body>\n</html>' },
  { label: "link:css", kind: "定型", detail: "style.css を読み込む", level: 1, insert: '<link rel="stylesheet" href="style.css">' },
  { label: "meta:charset", kind: "定型", detail: "文字の種類を宣言", level: 1, insert: '<meta charset="UTF-8">' },
  { label: "meta:viewport", kind: "定型", detail: "スマホの表示幅", level: 7, insert: '<meta name="viewport" content="width=device-width, initial-scale=1">' },
  // 骨組みのタグ。単元1で最初に書かせるので level 1 に置く。
  { label: "title", kind: "タグ", detail: "タブに出る名前（head の中）", level: 1, insert: "<title>$</title>" },
  { label: "head", kind: "タグ", detail: "設定を書く場所（画面に出ない）", level: 1, insert: "<head>\n  $\n</head>" },
  { label: "body", kind: "タグ", detail: "人が見るもの", level: 1, insert: "<body>\n  $\n</body>" },
  { label: "html", kind: "タグ", detail: "文書全体を包む", level: 1, insert: '<html lang="ja">\n$\n</html>' },
  { label: "meta", kind: "タグ", detail: "設定（閉じタグなし）", level: 1, insert: '<meta charset="UTF-8">' },
  { label: "link", kind: "タグ", detail: "CSSの読み込み（閉じタグなし）", level: 1, insert: '<link rel="stylesheet" href="style.css">' },
  { label: "h1", kind: "タグ", detail: "見出し（1ページに1つ）", level: 1, insert: "<h1>$</h1>" },
  { label: "h3", kind: "タグ", detail: "見出し", level: 1, insert: "<h3>$</h3>" },
  { label: "br", kind: "タグ", detail: "改行（閉じタグなし）", level: 1, insert: "<br>" },
  { label: "strong", kind: "タグ", detail: "強調", level: 2, insert: "<strong>$</strong>" },
  { label: "h2", kind: "タグ", detail: "見出し", level: 1, insert: "<h2>$</h2>" },
  { label: "p", kind: "タグ", detail: "段落", level: 1, insert: "<p>$</p>" },
  { label: "a", kind: "タグ", detail: "リンク", level: 1, insert: '<a href="$"></a>' },
  { label: "img", kind: "タグ", detail: "画像（閉じタグなし）", level: 1, insert: '<img src="$" alt="">' },
  { label: "ul", kind: "タグ", detail: "箇条書き", level: 1, insert: "<ul>\n  <li>$</li>\n</ul>" },
  { label: "ol", kind: "タグ", detail: "番号付きの並び", level: 1, insert: "<ol>\n  <li>$</li>\n</ol>" },
  { label: "li", kind: "タグ", detail: "並びの1つ", level: 1, insert: "<li>$</li>" },
  { label: "div", kind: "タグ", detail: "意味を持たない箱", level: 2, insert: '<div class="$"></div>' },
  { label: "span", kind: "タグ", detail: "文の一部を囲む", level: 2, insert: "<span>$</span>" },
  { label: "header", kind: "タグ", detail: "ページの頭", level: 2, insert: "<header>\n  $\n</header>" },
  { label: "main", kind: "タグ", detail: "本文（1ページに1つ）", level: 2, insert: "<main>\n  $\n</main>" },
  { label: "footer", kind: "タグ", detail: "ページの足", level: 2, insert: "<footer>\n  $\n</footer>" },
  { label: "nav", kind: "タグ", detail: "案内リンクのまとまり", level: 2, insert: "<nav>\n  $\n</nav>" },
  { label: "section", kind: "タグ", detail: "見出しを持つまとまり", level: 2, insert: "<section>\n  $\n</section>" },
  { label: "article", kind: "タグ", detail: "それだけで通じるまとまり", level: 2, insert: "<article>\n  $\n</article>" },
  { label: "table", kind: "タグ", detail: "表", level: 2, insert: "<table>\n  <tr>\n    <th>$</th>\n  </tr>\n</table>" },
  { label: "form", kind: "タグ", detail: "入力のまとまり", level: 2, insert: "<form>\n  $\n</form>" },
  { label: "input", kind: "タグ", detail: "入力欄（閉じタグなし）", level: 2, insert: '<input type="text" name="$">' },
  { label: "button", kind: "タグ", detail: "ボタン", level: 2, insert: "<button>$</button>" },
  { label: "class", kind: "属性", detail: "CSSから指す名前", level: 3, insert: 'class="$"' },
  { label: "id", kind: "属性", detail: "1ページに1つだけの名前", level: 3, insert: 'id="$"' },
  { label: "alt", kind: "属性", detail: "画像の代わりの文", level: 1, insert: 'alt="$"' },
  { label: "href", kind: "属性", detail: "リンク先", level: 1, insert: 'href="$"' },
];

const CSS_COMPLETIONS = [
  { label: "color", kind: "プロパティ", detail: "文字の色", level: 3, insert: "color: $;" },
  { label: "background", kind: "プロパティ", detail: "背景", level: 4, insert: "background: $;" },
  { label: "background-color", kind: "プロパティ", detail: "背景の色", level: 4, insert: "background-color: $;" },
  { label: "font-size", kind: "プロパティ", detail: "文字の大きさ", level: 4, insert: "font-size: $;" },
  { label: "font-weight", kind: "プロパティ", detail: "文字の太さ", level: 4, insert: "font-weight: $;" },
  { label: "font-family", kind: "プロパティ", detail: "書体", level: 4, insert: "font-family: $;" },
  { label: "line-height", kind: "プロパティ", detail: "行の高さ", level: 4, insert: "line-height: $;" },
  { label: "text-align", kind: "プロパティ", detail: "文字の寄せ", level: 4, insert: "text-align: $;" },
  { label: "margin", kind: "プロパティ", detail: "外側の余白", level: 4, insert: "margin: $;" },
  { label: "padding", kind: "プロパティ", detail: "内側の余白", level: 4, insert: "padding: $;" },
  { label: "border", kind: "プロパティ", detail: "線", level: 4, insert: "border: 1px solid $;" },
  { label: "border-radius", kind: "プロパティ", detail: "角の丸み", level: 4, insert: "border-radius: $;" },
  { label: "width", kind: "プロパティ", detail: "幅", level: 4, insert: "width: $;" },
  { label: "height", kind: "プロパティ", detail: "高さ", level: 4, insert: "height: $;" },
  { label: "max-width", kind: "プロパティ", detail: "これ以上広げない幅", level: 4, insert: "max-width: $;" },
  { label: "box-sizing", kind: "プロパティ", detail: "幅に線と余白を含める", level: 4, insert: "box-sizing: border-box;" },
  { label: "display", kind: "プロパティ", detail: "並べ方の種類", level: 5, insert: "display: $;" },
  { label: "flex", kind: "値", detail: "横に並べる（display）", level: 5, insert: "flex" },
  { label: "gap", kind: "プロパティ", detail: "要素の間隔", level: 5, insert: "gap: $;" },
  { label: "justify-content", kind: "プロパティ", detail: "並ぶ向きの寄せ", level: 5, insert: "justify-content: $;" },
  { label: "align-items", kind: "プロパティ", detail: "交わる向きの寄せ", level: 5, insert: "align-items: $;" },
  { label: "flex-direction", kind: "プロパティ", detail: "並ぶ向き", level: 5, insert: "flex-direction: $;" },
  { label: "flex-wrap", kind: "プロパティ", detail: "はみ出したら折り返す", level: 5, insert: "flex-wrap: wrap;" },
  { label: "grid", kind: "値", detail: "格子に並べる（display）", level: 6, insert: "grid" },
  { label: "grid-template-columns", kind: "プロパティ", detail: "列の決め方", level: 6, insert: "grid-template-columns: $;" },
  { label: "repeat()", kind: "関数", detail: "同じ列を繰り返す", level: 6, insert: "repeat($, 1fr)" },
  { label: "minmax()", kind: "関数", detail: "最小と最大を決める", level: 6, insert: "minmax($, 1fr)" },
  { label: "@media", kind: "構文", detail: "画面の幅で切り替える", level: 7, insert: "@media (max-width: $px) {\n  \n}" },
];

// カーソルの手前にある「打ちかけの語」。HTMLは < と - も語に含める。
export function webTokenBefore(mode, value, pos) {
  const upto = value.slice(0, pos);
  const re = mode === "css" ? /[@A-Za-z-][A-Za-z0-9-]*$/ : /[A-Za-z][A-Za-z0-9:-]*$/;
  const m = upto.match(re);
  if (!m) return { word: "", start: pos };
  return { word: m[0], start: pos - m[0].length };
}

export function webCompletionsFor(mode, word, level = 1) {
  const pool = (mode === "css" ? CSS_COMPLETIONS : HTML_COMPLETIONS).filter(c => (c.level || 1) <= level);
  const q = String(word || "").toLowerCase();
  if (!q) return pool.slice(0, 12);
  return pool.filter(c => c.label.toLowerCase().startsWith(q)).slice(0, 12);
}
