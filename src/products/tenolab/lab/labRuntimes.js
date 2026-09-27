/* 体験ラボの実行環境ごとの部品（2026-09-27〜、フェーズB）。
   - 色付け：JavaScript / Java / HTML / CSS
   - Web：受講生の index.html と style.css を画面外の枠で描画し、表示を測って判定する。
     判定の実装は学習モードの演習と同じ learning/webChecks.js を使う（書いた文字ではなく、できた表示を測る）。
     プレビューは sandbox="allow-same-origin" だけ。**allow-scripts は付けない**（同じ出どころのトークンに触らせない）
   - Java：/learning/exercises/java/run（本物の javac / java）の結果を、ラボの形に読み替える */
import { previewDocument, runWebChecks } from "../../learning/webChecks.js";

function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/* ---------- 色付け ---------- */
function tokenize(src, re, classes){
  var out = "", last = 0, m;
  re.lastIndex = 0;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    var k = 1; while (k < m.length && !m[k]) k++;
    var cls = classes[k - 1];
    if (cls === "fn") out += '.<span class="t-f">' + esc(m[0].slice(1)) + "</span>";
    else out += '<span class="' + cls + '">' + esc(m[0]) + "</span>";
    last = re.lastIndex;
    if (!m[0].length) re.lastIndex++;
  }
  return out + esc(src.slice(last));
}

var JS_RE = /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b\d+(?:\.\d+)?\b)|(\b(?:const|let|var|for|of|in|if|else|while|do|return|function|new|true|false|null|undefined|break|continue|typeof)\b)|(\b(?:console|Math)\b)|(\.[A-Za-z_$][\w$]*(?=\s*\())/g;
var JAVA_RE = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(\b\d+(?:\.\d+)?[dfL]?\b)|(\b(?:public|private|protected|static|final|void|class|interface|extends|implements|new|return|if|else|for|while|do|switch|case|default|break|continue|try|catch|finally|throw|throws|import|package|this|super|null|true|false|int|long|double|float|boolean|char|byte|short|var|record|enum)\b)|(\b(?:String|System|Math|Integer|Double|List|ArrayList|Map|HashMap|Scanner)\b)|(\.[A-Za-z_$][\w$]*(?=\s*\())/g;
var CSS_RE = /(\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|fr|s|ms|deg)?\b)|([a-z-]+(?=\s*:))|(@[a-z-]+|[.#][A-Za-z_][\w-]*)/g;
var HTML_RE = /(<!--[\s\S]*?(?:-->|$))|("[^"\n]*"?|'[^'\n]*'?)|(<!DOCTYPE[^>]*>)|(<\/?[A-Za-z][\w-]*)|(\s[A-Za-z-:]+(?==))/g;

export function highlightCode(src, lang){
  if (lang === "java") return tokenize(src, JAVA_RE, ["t-c", "t-s", "t-n", "t-k", "t-b", "fn"]);
  if (lang === "css") return tokenize(src, CSS_RE, ["t-c", "t-s", "t-n", "t-b", "t-k"]);
  if (lang === "html") return tokenize(src, HTML_RE, ["t-c", "t-s", "t-c", "t-k", "t-b"]);
  return tokenize(src, JS_RE, ["t-c", "t-s", "t-n", "t-k", "t-b", "fn"]);
}

/* ---------- Web ---------- */
export function webDocument(html, css){ return previewDocument({ "index.html": html || "", "style.css": css || "" }); }

// 画面外で描画して測るための枠（広い幅とスマホ幅）。見えている枠はタブで隠れると大きさが0になり測れないため、別に持つ
export function makeMeasureFrames(root){
  function mk(w){
    var f = document.createElement("iframe");
    f.setAttribute("sandbox", "allow-same-origin");
    f.setAttribute("aria-hidden", "true");
    f.tabIndex = -1;
    f.style.cssText = "position:fixed;left:-20000px;top:0;width:" + w + "px;height:720px;border:0;visibility:hidden;pointer-events:none";
    root.appendChild(f);
    return f;
  }
  return { wide: mk(1024), narrow: mk(375) };
}

function loadInto(frame, doc){
  return new Promise(function(resolve){
    var done = false;
    function finish(){ if (done) return; done = true; frame.removeEventListener("load", finish); resolve(frame.contentDocument); }
    frame.addEventListener("load", finish);
    frame.srcdoc = doc;
    setTimeout(finish, 2000);
  });
}

export async function renderWeb(frames, html, css){
  var doc = webDocument(html, css);
  var docs = await Promise.all([loadInto(frames.wide, doc), loadInto(frames.narrow, doc)]);
  return { doc: docs[0], narrowDoc: docs[1] };
}

function reEscape(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// 色などは書き方が何通りもあるので、同じ枠の中で「期待する値」も計算させて比べる（red と rgb(255, 0, 0) を同じと見る）
function computedOf(doc, prop, value){
  try {
    var d = doc.createElement("div");
    d.style.setProperty(prop, value);
    if (!d.style.getPropertyValue(prop)) return null;
    doc.body.appendChild(d);
    var v = doc.defaultView.getComputedStyle(d).getPropertyValue(prop).trim();
    d.remove();
    return v;
  } catch (e) { return null; }
}

function one(doc, sel){ try { return doc.querySelector(sel); } catch (e) { return null; } }
function many(doc, sel){ try { return Array.prototype.slice.call(doc.querySelectorAll(sel)); } catch (e) { return []; } }

export function webPasses(c, docs, files){
  var doc = c.at === "narrow" ? docs.narrowDoc : docs.doc;
  if (!doc) return false;
  var v = String(c.value || "").trim();
  var ctx = { doc: docs.doc, narrowDoc: docs.narrowDoc, files: { "index.html": files.html || "", "style.css": files.css || "" } };
  if (c.kind === "style") {
    var node = one(doc, c.selector);
    if (!node) return false;
    var got = doc.defaultView.getComputedStyle(node).getPropertyValue(c.prop).trim();
    if (!v) return got !== "";
    return got === v || got === computedOf(doc, c.prop, v);
  }
  var check;
  if (c.kind === "count") {
    var m = /^>=\s*(\d+)$/.exec(v);
    check = m ? { type: "count", selector: c.selector, min: Number(m[1]) } : { type: "count", selector: c.selector, equals: v === "" ? undefined : Number(v) };
  } else if (c.kind === "text") check = { type: "text", selector: c.selector, contains: v || undefined };
  else if (c.kind === "source") check = { type: "source", file: c.file === "css" ? "style.css" : "index.html", pattern: reEscape(v), flags: "i" };
  else check = { type: c.kind, selector: c.selector };
  check.at = c.at;
  var res = runWebChecks([check], ctx)[0];
  return !!(res && res.ok);
}

// いまの表示で測った値（合格しなかったときに、目標と並べて見せる）
export function webMeasure(c, docs){
  var doc = c.at === "narrow" ? docs.narrowDoc : docs.doc;
  if (!doc) return "";
  if (c.kind === "count") return many(doc, c.selector).length + " 個";
  if (c.kind === "exists") return one(doc, c.selector) ? "あり" : "なし";
  if (c.kind === "text") { var t = one(doc, c.selector); return t ? (t.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) || "（空）" : "なし"; }
  if (c.kind === "style") { var n = one(doc, c.selector); return n ? doc.defaultView.getComputedStyle(n).getPropertyValue(c.prop).trim() : c.selector + " がない"; }
  if (c.kind === "sameRow" || c.kind === "stacked") {
    var ab = many(doc, c.selector);
    if (ab.length < 2) return ab.length + " 個";
    var dy = ab[1].getBoundingClientRect().top - ab[0].getBoundingClientRect().top;
    return Math.abs(dy) < 2 ? "横に並んでいる" : "縦に並んでいる";
  }
  if (c.kind === "noOverflow") {
    var de = doc.documentElement;
    return de.scrollWidth > de.clientWidth + 1 ? (de.scrollWidth - de.clientWidth) + "px はみ出している" : "はみ出していない";
  }
  return "";
}

// 合格の条件の見せ方 [前, 印, 後]
export function webCond(c){
  var v = String(c.value || "").trim(), w = c.at === "narrow" ? "スマホ幅で " : "";
  if (c.kind === "count") return [w, c.selector, "が " + (v ? v.replace(/^>=\s*/, "") + (/^>=/.test(v) ? " 個以上" : " 個") : "1つ以上") + "あれば合格"];
  if (c.kind === "exists") return [w, c.selector, "があれば合格"];
  if (c.kind === "text") return [w + c.selector + " の文字に", v, "が入れば合格"];
  if (c.kind === "style") return [w + c.selector + " の " + c.prop + " が", v || "（何か）", "なら合格"];
  if (c.kind === "sameRow") return [w, c.selector, "の1つ目と2つ目が横に並べば合格"];
  if (c.kind === "stacked") return [w, c.selector, "の1つ目と2つ目が縦に並べば合格"];
  if (c.kind === "noOverflow") return ["", c.at === "narrow" ? "スマホ幅" : "広い幅", "で横にはみ出さなければ合格"];
  return [(c.file === "css" ? "style.css" : "index.html") + " に", v, "があれば合格"];
}

export function webWant(c){
  var v = String(c.value || "").trim();
  var parts = webCond(c);
  if (c.kind === "count") return c.selector + " が " + (v ? v.replace(/^>=\s*/, "") + (/^>=/.test(v) ? " 個以上" : " 個") : "1つ以上");
  if (c.kind === "style") return c.prop + ": " + v;
  if (c.kind === "noOverflow") return "はみ出さない";
  if (c.kind === "sameRow") return "横に並ぶ";
  if (c.kind === "stacked") return "縦に並ぶ";
  return parts[1];
}

/* ---------- Java ---------- */
function lines(s){ return String(s || "").replace(/\r/g, "").split("\n").filter(function(l, i, a){ return l !== "" || i < a.length - 1; }); }

// API の結果 → ラボの実行結果 { ok, out:[{s}], error }
export function javaResult(res){
  if (!res || res.ok === false) return { ok: false, out: [], vars: {}, error: { message: (res && res.error) || "実行できませんでした。", line: null } };
  if (!res.compiled) {
    var ce = String(res.compileError || "");
    var m = /\.java:(\d+):/.exec(ce);
    return { ok: false, out: [], vars: {}, compiled: false, error: { message: ce, line: m ? Number(m[1]) : null, compile: true } };
  }
  var out = lines(res.stdout).map(function(s){ return { s: s }; });
  if (res.timedOut) return { ok: false, out: out, vars: {}, compiled: true, error: { message: res.message || "時間内に終わりませんでした。", line: null, loop: true } };
  if (res.exitCode !== 0) {
    var se = String(res.stderr || "");
    var m2 = /\((\w+)\.java:(\d+)\)/.exec(se);
    return { ok: false, out: out, vars: {}, compiled: true, error: { message: se.split("\n").slice(0, 4).join("\n") || "途中で止まりました。", line: m2 ? Number(m2[2]) : null } };
  }
  return { ok: true, out: out, vars: {}, compiled: true };
}

// tests の値：1行に1つ「入力 => 出てほしい行」。入力の「\n」は改行
export function parseTests(value){
  return String(value || "").split("\n").map(function(l){
    var k = l.indexOf("=>");
    if (k < 0) return null;
    return { input: l.slice(0, k).trim().replace(/\\n/g, "\n"), want: l.slice(k + 2).trim(), label: l.slice(0, k).trim() };
  }).filter(Boolean).slice(0, 5);
}

export function explainJava(err){
  var msg = err.message || "";
  if (err.loop) return "時間内に終わりませんでした。繰り返しの条件が、いつまでも変わらないままになっていないか見てみましょう。";
  if (/cannot find symbol/.test(msg)) return "名前が見つかりません。つづりが違うか、まだ作っていない変数・メソッドを使っています。大文字と小文字も区別されます。";
  if (/';' expected/.test(msg)) return "行の終わりの `;` が足りません。";
  if (/incompatible types/.test(msg)) return "型が合いません。入れようとしている値の型と、変数の型を見比べてみましょう。";
  if (/reached end of file|class, interface, enum, or record expected|illegal start of/.test(msg)) return "`{ }` や `( )` の閉じ忘れか、書く場所がずれています。";
  if (/missing return statement/.test(msg)) return "値を返すメソッドなのに、`return` がない道があります。";
  if (/unclosed string literal/.test(msg)) return "`\" \"` の閉じ忘れがあります。";
  if (/ArithmeticException/.test(msg)) return "0 で割っています。割る数が 0 にならないか見てみましょう。";
  if (/NullPointerException/.test(msg)) return "中身が null のものを使おうとしています。";
  if (/ArrayIndexOutOfBounds|IndexOutOfBounds/.test(msg)) return "配列やリストの番号が範囲の外です。0 から数えることに気をつけましょう。";
  if (/NumberFormatException/.test(msg)) return "数に変えられない文字を、数に変えようとしています。";
  if (/main が見つかりません/.test(msg)) return msg;
  return "エラーの内容は「" + msg.split("\n")[0] + "」です。";
}
