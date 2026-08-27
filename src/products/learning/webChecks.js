// 2026-08-27: HTML/CSS演習の「表示の確認」。承認モック: mock/html-editor/index.html
//
// **書いた文字ではなく、できあがった表示を測る。**
// 同じ見た目にたどり着く書き方は一通りではないので、ソースの文字列一致で採点すると
// 正しく書けた人を落とす。だから既定は描画結果（getComputedStyle / 位置）で見る。
//
// 例外は「文書の骨組み」と「style.css を読み込んでいるか」。ここは書けているか
// そのものが学ぶ内容なので、ソースを見る。
//
// 教材（curriculum JSON）が書くのは宣言だけで、判定の実装はここに集約する。
// 教材側にJavaScriptを書かせない（教材は実行しない）。

export const LINK_CSS = /<link\s[^>]*href\s*=\s*["']style\.css["'][^>]*>/i;

function el(doc, selector) {
  try { return doc.querySelector(selector); } catch (e) { return null; }
}
function all(doc, selector) {
  try { return Array.from(doc.querySelectorAll(selector)); } catch (e) { return []; }
}
function css(doc, node, prop) {
  try { return doc.defaultView.getComputedStyle(node).getPropertyValue(prop).trim(); } catch (e) { return ""; }
}

// check: 教材が書く宣言。共通で label / why / at を持つ。
//   at: "wide"（既定）| "narrow" — どちらの幅のプレビューで測るか
const RUNNERS = {
  // 文書の骨組み。ここだけはソースを見る（書けていること自体が学ぶ内容）。
  structure(check, ctx) {
    const src = ctx.files[check.file || "index.html"] || "";
    const doc = ctx.doc;
    return /<!DOCTYPE\s+html\s*>/i.test(src)
      && /<html[^>]*\slang\s*=/i.test(src)
      && Boolean(doc?.head)
      && Boolean(doc?.title);
  },
  // style.css を読み込めているか。読み込めていなければCSSは効かない。
  linkCss(check, ctx) {
    return LINK_CSS.test(ctx.files[check.file || "index.html"] || "");
  },
  // 書いた文字を見る。骨組み以外で使うときは「書き方が一通りしかない」ものに限る。
  source(check, ctx) {
    const src = ctx.files[check.file || "index.html"] || "";
    try { return new RegExp(check.pattern, check.flags || "i").test(src); } catch (e) { return false; }
  },
  exists(check, ctx) {
    return Boolean(el(ctx.doc, check.selector));
  },
  count(check, ctx) {
    const n = all(ctx.doc, check.selector).length;
    if (check.equals !== undefined) return n === check.equals;
    if (check.min !== undefined) return n >= check.min;
    return n > 0;
  },
  text(check, ctx) {
    const node = el(ctx.doc, check.selector);
    if (!node) return false;
    const t = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (check.contains) return t.includes(check.contains);
    if (check.equals !== undefined) return t === check.equals;
    return t.length > 0;
  },
  // 見た目の値。equals / oneOf / contains / notEquals のいずれかで比べる。
  style(check, ctx) {
    const node = el(ctx.doc, check.selector);
    if (!node) return false;
    const v = css(ctx.doc, node, check.prop);
    if (check.oneOf) return check.oneOf.includes(v);
    if (check.contains) return v.includes(check.contains);
    if (check.notEquals !== undefined) return v !== check.notEquals && v !== "";
    if (check.equals !== undefined) return v === check.equals;
    return v !== "";
  },
  // 1つ目と2つ目が横に並んでいるか。display の値ではなく実際の位置で見る。
  sameRow(check, ctx) {
    const [a, b] = all(ctx.doc, check.selector);
    if (!a || !b) return false;
    return Math.abs(a.getBoundingClientRect().top - b.getBoundingClientRect().top) < 2;
  },
  // 1つ目と2つ目が縦に積まれているか（レスポンシブの確認で使う）。
  stacked(check, ctx) {
    const [a, b] = all(ctx.doc, check.selector);
    if (!a || !b) return false;
    return b.getBoundingClientRect().top - a.getBoundingClientRect().top > 2;
  },
  // 横スクロールが出ていないか。狭い幅で見るときの定番の失敗。
  noOverflow(check, ctx) {
    const doc = ctx.doc;
    if (!doc?.documentElement) return false;
    return doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1;
  },
};

// checks: 教材が書いた宣言の配列
// ctx:    { doc, narrowDoc, files }
// 返り値: [{ label, why, ok }]
export function runWebChecks(checks, ctx) {
  return (Array.isArray(checks) ? checks : []).map(check => {
    const run = RUNNERS[check.type];
    const doc = check.at === "narrow" ? ctx.narrowDoc : ctx.doc;
    let ok = false;
    try {
      ok = Boolean(doc && run && run(check, { doc, files: ctx.files || {} }));
    } catch (e) {
      ok = false; // 判定が投げても演習は続けられる方が良い
    }
    return { label: check.label, why: check.why || "", ok };
  });
}

// 教材が使っている確認の種類が、この実装に揃っているか。
// 教材側の書き間違いを黙って「不合格」にしないための確認に使う。
export function unknownCheckTypes(checks) {
  return (Array.isArray(checks) ? checks : [])
    .map(c => c?.type)
    .filter(t => !RUNNERS[t]);
}

// 受講者が書いた文書を**そのまま**表示するためのHTMLを作る。
// style.css はサーバーが無いので <link> の位置に差し込む。
// link を書き忘れていれば差し込まれず、CSSは効かない。実際の開発と同じにする。
export function previewDocument(files) {
  const html = String(files["index.html"] || "");
  const style = String(files["style.css"] || "");
  if (!LINK_CSS.test(html)) return html;
  return html.replace(LINK_CSS, () => `<style>\n${style}\n</style>`);
}
