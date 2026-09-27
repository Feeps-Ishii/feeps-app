/* 体験ラボのエンジン。モック（docs/design/mockups/tenolab-2026-09）から移植し、2026-09-27に単元データ（OPTS.unit）で動くよう書き換えた。
   OPTS.unit … 単元（API /tenolab/courses/{c}/units/{u} の unit と同じ形）
   OPTS.meta … 見出し用 { courseId, courseTitle, unitNo, unitTotal, chapter }
   OPTS.preview … 講師の「受講生として試す」。保存の印を出さない */
import { explainJava, highlightCode, javaResult, makeMeasureFrames, parseTests, renderWeb, webCond, webDocument, webMeasure, webPasses, webWant } from "./labRuntimes.js";

export function mountLab(root, OPTS) {
  "use strict";
  OPTS = OPTS || {};
  /* 保存は画面側（React）に任せる。ここからは「いまの状態」を渡すだけ。
     onProgress: ステップが進んだとき（すぐ保存する）／onChange: コードを打ったとき（間を置いて保存する） */
  function snapshot(){
    return {
      step: S.step, status: S.step >= STEPS.length ? "cleared" : "doing", code: packCode(S.files),
      runs: S.runs0 + S.runs, hints: S.hints0 + S.hints, replays: S.replays0 + S.replays,
      minutes: Math.max(1, Math.round((Date.now() - S.started) / 60000))
    };
  }
  function report(advanced){
    if (advanced && OPTS.onProgress) OPTS.onProgress(snapshot());
    else if (OPTS.onChange) OPTS.onChange(snapshot());
  }
  function changed(){ if (OPTS.onChange) OPTS.onChange(snapshot()); }

  var $ = function(id){ return document.getElementById(id); };
  var LH = 22, PAD = 14;
  var REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* =====================================================================
     レッスンの中身は単元データ（OPTS.unit）から読む（単元づくり、2026-09-27〜）
     ===================================================================== */
  var U = OPTS.unit;
  var STEPS = U.steps || [];
  // 実行環境：js＝ブラウザで動かす／web＝HTML・CSS を描画して表示を測る／java＝本物の javac・java（API）
  var RT = U.runtime === "web" || U.runtime === "java" ? U.runtime : "js";
  var UF = U.files || {};
  // ファイル。js・java は main の1つ、web は html（index.html）と css（style.css）
  var FILES0 = RT === "web" ? { html: UF.start || "", css: UF.css || "" } : { main: UF.start || "" };
  var FILE_NAME = { html: "index.html", css: "style.css", main: U.fileName || (RT === "java" ? "Main.java" : "main.js") };
  var INITIAL = FILES0.main || "";
  var ANSWER = RT === "js" ? (UF.answer || "") : "";
  var DATA = RT === "js" ? (U.dataVar || "") : "";
  var META = OPTS.meta || {};
  function stepFile(i){ return RT === "web" ? ((STEPS[i] && STEPS[i].file) || "html") : "main"; }
  function langOf(f){ return RT === "web" ? f : RT; }

  function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  // 説明文は `コード` と **太字** だけ使える
  function rich(s){ return esc(s || "").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>"); }

  /* 受講生が書き換えるデータ（例 scores）。コードに書いてある配列をそのまま読む。
     打っている途中でも、目標の数字が追いつくように */
  function dataRe(){ return new RegExp("((?:const|let|var)\\s+" + DATA + "\\s*=\\s*)(\\[[^\\]]*\\])"); }
  function parseData(t){
    if (!DATA) return null;
    var m = dataRe().exec(t || "");
    if (!m) return null;
    try { var v = JSON.parse(m[2]); return Array.isArray(v) ? v : null; } catch (e) { return null; }
  }
  var BASE_DATA = parseData(INITIAL);
  function dataOf(r){ return (r && r.vars && Array.isArray(r.vars[DATA])) ? r.vars[DATA] : null; }
  function sameData(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
  function outLines(r){ return r.out.map(function(o){ return o.s; }); }
  function findPrefix(lines, p){
    for (var i = 0; i < lines.length; i++) if (lines[i].indexOf(p) === 0) return lines[i];
    return null;
  }
  /* 同じ行か。数字は小数のずれ（77.8 と 77.80）を許す */
  function sameLine(got, want, prefix){
    if (got == null || want == null) return false;
    if (got === want) return true;
    prefix = prefix || "";
    if (got.slice(0, prefix.length) !== want.slice(0, prefix.length)) return false;
    var a = got.slice(prefix.length).trim(), b = want.slice(prefix.length).trim();
    if (!a || !b) return false;
    return isFinite(Number(a)) && isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= 0.051;
  }

  /* 完成したときの出力。完成形のコードを、受講生のいまのデータで動かして作る */
  var goalCache = {};
  function goalLines(data){
    if (!ANSWER) return U.goalLines || [];
    var key = JSON.stringify(data || null);
    if (goalCache[key]) return goalCache[key];
    var src = ANSWER;
    if (DATA && data) src = src.replace(dataRe(), function(_, head){ return head + JSON.stringify(data); });
    var r = execute(src);
    var lines = r.ok && r.out.length ? outLines(r) : (U.goalLines || []);
    goalCache[key] = lines;
    return lines;
  }

  /* ステップ i で出てほしい1行（出力で判定しないステップは null） */
  function stepWant(i, data){
    var c = STEPS[i].check;
    if (c.kind === "answerLine") return findPrefix(goalLines(data), c.prefix);
    if (c.kind === "line") return c.value.split("\n")[0];
    return null;
  }
  function stepPrefix(i){ var c = STEPS[i].check; return c.kind === "answerLine" ? c.prefix : ""; }

  function hasAll(text, value){ return value.split("\n").filter(Boolean).every(function(l){ return text.indexOf(l) >= 0; }); }

  /* ステップ i に合格したか。Java のテストは入力を変えてもう一度動かすので、Promise を返すことがある */
  function passes(i, r){
    var c = STEPS[i].check;
    if (RT === "web") {
      if (!r.docs) return false;
      return webPasses(c, r.docs, S.files);
    }
    if (RT === "java") {
      if (c.kind === "compile") return r.compiled === true;
      if (c.kind === "tests" && r.compiled) return runTests(c).then(function(res){ r.tests = res; return res.length > 0 && res.every(function(t){ return t.ok; }); });
      if (!r.ok) return false;
      if (c.kind === "code") return hasAll(S.files.main, c.value);
      var jl = outLines(r).map(function(l){ return l.trim(); });
      return c.value.split("\n").map(function(l){ return l.trim(); }).filter(Boolean).every(function(l){ return jl.indexOf(l) >= 0; });
    }
    if (!r.ok) return false;
    var lines = outLines(r);
    if (c.kind === "answerLine") {
      var want = stepWant(i, dataOf(r) || BASE_DATA);
      return !!want && sameLine(findPrefix(lines, c.prefix), want, c.prefix);
    }
    if (c.kind === "line") return c.value.split("\n").filter(Boolean).every(function(l){ return lines.indexOf(l) >= 0; });
    if (c.kind === "change") { var d = dataOf(r); return !!d && !sameData(d, BASE_DATA); }
    if (c.kind === "code") return hasAll(S.files.main, c.value);
    return false;
  }

  /* Java のテスト：入力を標準入力に渡して1つずつ動かす */
  function runTests(c){
    var tests = parseTests(c.value), out = [];
    var chain = Promise.resolve();
    tests.forEach(function(t){
      chain = chain.then(function(){
        return callJava(t.input).then(function(r){
          var got = r.ok ? outLines(r).map(function(l){ return l.trim(); }) : [];
          out.push({ label: t.label || "（入力なし）", want: t.want, got: r.ok ? (got.filter(function(l){ return l; }).slice(-1)[0] || "（何も出ない）") : (r.error && r.error.message || "エラー").split("\n")[0], ok: r.ok && got.indexOf(t.want) >= 0 });
        });
      });
    });
    return chain.then(function(){ return out; });
  }

  function callJava(stdin){
    if (!OPTS.runJava) return Promise.resolve({ ok: false, out: [], vars: {}, error: { message: "Java を動かすにはログインが必要です。" } });
    return OPTS.runJava({ files: [{ name: FILE_NAME.main, content: S.files.main }], filename: FILE_NAME.main, stdin: stdin || "" })
      .then(javaResult, function(e){ return { ok: false, out: [], vars: {}, error: { message: (e && e.errorMessage) || "実行環境につながりませんでした。もう一度実行してください。" } }; });
  }

  function clearText(i, r){
    var c = STEPS[i].check;
    if (RT === "web") return webWant(c);
    if (c.kind === "compile") return "コンパイルが通りました";
    if (c.kind === "tests") return (r.tests || []).length + "個のテストが通りました";
    if (c.kind === "answerLine") return findPrefix(outLines(r), c.prefix) || "";
    if (c.kind === "line") return c.value.split("\n")[0];
    if (c.kind === "change") return DATA + " = " + fmt(dataOf(r), true);
    return c.value.split("\n")[0];
  }

  /* 合格の条件を [前, 印, 後] で返す（印はコードの見た目で出す） */
  function condParts(i, data){
    var c = STEPS[i].check;
    if (RT === "web") return webCond(c);
    if (c.kind === "compile") return ["", "コンパイル", "が通れば合格"];
    if (c.kind === "tests") return ["", parseTests(c.value).length + "個のテスト", "がすべて通れば合格"];
    if (c.kind === "change") return ["", DATA, "の中身が変われば合格"];
    if (c.kind === "code") return ["コードに", c.value.split("\n")[0], "があれば合格"];
    return ["出力に", stepWant(i, data) || "", "と出れば合格"];
  }

  /* 完成の出力のうち、ステップ i が目指している行の番号 */
  function lineOfStep(i, lines){
    var c = STEPS[i].check, p = stepPrefix(i);
    if (c.kind === "line") { var first = c.value.split("\n")[0].trim(); return first ? lines.indexOf(first) : -1; }
    if (!p) return -1;
    for (var k = 0; k < lines.length; k++) if (lines[k].indexOf(p) === 0) return k;
    return -1;
  }
  /* 出力の行 k が「できた」になるステップ（その行を目指す最後のステップを越えたとき） */
  function lineDoneAt(k, lines){
    var at = -1;
    for (var i = 0; i < STEPS.length; i++) if (lineOfStep(i, lines) === k) at = i;
    return at < 0 ? STEPS.length : at + 1;
  }

  /* お手本。いまのコードのどこに何を打つかを返す */
  function demoPlan(i, t){
    var st = STEPS[i], d = st.demo || { mode: "none" };
    if (d.mode === "run") return { run: true };
    if (d.mode === "none" || !d.text) return null;
    if (t.indexOf(d.text.trim()) >= 0) return { already: d.text.trim() };
    if (d.mode === "insert" || d.mode === "replace") {
      var k = d.at ? t.indexOf(d.at) : -1;
      if (k < 0) return { already: d.text.trim() };
      return d.mode === "insert" ? { at: k + d.at.length, del: 0, ins: d.text } : { at: k, del: d.at.length, ins: d.text };
    }
    var mark = st.appendOnStart, m = mark ? t.indexOf(mark) : -1;
    return m >= 0 ? { at: m + mark.length, del: 0, ins: "\n" + d.text } : { at: t.replace(/\s*$/, "").length, del: 0, ins: "\n\n" + d.text };
  }
  function hasDemo(i){ var d = STEPS[i] && STEPS[i].demo; return !!d && (d.mode === "run" || (d.mode !== "none" && !!d.text)); }

  /* =====================================================================
     色付け・実行（画面に依存しない部分）
     ===================================================================== */
  function highlight(src, lang){ return highlightCode(src, lang || langOf(S ? S.cur : "main")); }

  /* 止まらないループで画面ごと固まらないよう、for / while の本体に回数の見張りを差し込む。
     行を増やさない（エラーの行番号がずれないように）。 */
  var GUARD = 'if(++__g.n>200000)throw new Error("__LOOP__");';
  function instrument(src){
    var out = "", i = 0, n = src.length;
    function skipString(p, q){ var j = p + 1; while (j < n && src[j] !== q) { if (src[j] === "\\") j++; j++; } return j; }
    while (i < n) {
      var c = src[i], d = src[i + 1];
      if (c === "/" && d === "/") { var e = src.indexOf("\n", i); e = e < 0 ? n : e; out += src.slice(i, e); i = e; continue; }
      if (c === "/" && d === "*") { var e2 = src.indexOf("*/", i + 2); e2 = e2 < 0 ? n : e2 + 2; out += src.slice(i, e2); i = e2; continue; }
      if (c === '"' || c === "'" || c === "`") { var j = skipString(i, c); out += src.slice(i, j + 1); i = j + 1; continue; }
      if (/[A-Za-z_$]/.test(c) && (i === 0 || !/[\w$]/.test(src[i - 1]))) {
        var k = i; while (k < n && /[\w$]/.test(src[k])) k++;
        var word = src.slice(i, k); out += word; i = k;
        if (word === "for" || word === "while") {
          var p = i; while (p < n && /\s/.test(src[p])) p++;
          if (src[p] === "(") {
            var depth = 0, q = p;
            for (; q < n; q++) {
              var ch = src[q];
              if (ch === '"' || ch === "'" || ch === "`") { q = skipString(q, ch); continue; }
              if (ch === "(") depth++;
              else if (ch === ")") { depth--; if (depth === 0) break; }
            }
            var r = q + 1; while (r < n && /[ \t]/.test(src[r])) r++;
            if (src[r] === "{") { out += src.slice(i, r + 1) + GUARD; i = r + 1; }
          }
        }
        continue;
      }
      out += c; i++;
    }
    return out;
  }

  function fmt(v, nested){
    if (typeof v === "string") return nested ? JSON.stringify(v) : v;
    if (Array.isArray(v)) return "[" + v.map(function(x){ return fmt(x, true); }).join(", ") + "]";
    if (v === undefined) return "undefined";
    if (v === null) return "null";
    if (typeof v === "object") { try { return JSON.stringify(v); } catch (e) { return String(v); } }
    return String(v);
  }

  // 「変数の中身」タブに出す変数。書き換えるデータは判定に使うので、必ず読む
  var VARS = (U.watch && U.watch.length ? U.watch : []).slice();
  var READ_VARS = DATA && VARS.indexOf(DATA) < 0 ? VARS.concat([DATA]) : VARS;
  var LOOP_MSG = "ループが止まらなくなっています";

  function lineFromStack(stack){
    var m = /<anonymous>:(\d+):\d+/.exec(stack || "") || /Function:(\d+):\d+/.exec(stack || "");
    return m ? Math.max(1, Number(m[1]) - 2) : null;
  }

  function execute(code){
    var out = [];
    var con = {
      log: function(){ out.push({ s: Array.prototype.map.call(arguments, function(a){ return fmt(a); }).join(" ") }); },
      warn: function(){ con.log.apply(null, arguments); },
      error: function(){ con.log.apply(null, arguments); }
    };
    var g = { n: 0 };
    var body = instrument(code) + "\n;return {" + READ_VARS.map(function(v){
      return v + ':(typeof ' + v + '!=="undefined"?' + v + ':undefined)';
    }).join(",") + "};";
    var fn;
    try {
      fn = new Function("console", "__g", body);
    } catch (e) {
      if (e instanceof EvalError || /unsafe-eval|Content Security/i.test(String(e && e.message))) {
        return executeViaScript(body, con, g, out);
      }
      return { ok: false, out: out, vars: {}, error: { message: String(e.message || e), line: null, syntax: true } };
    }
    try {
      var vars = fn(con, g) || {};
      return { ok: true, out: out, vars: vars };
    } catch (e2) {
      var loop = e2 && e2.message === "__LOOP__";
      return { ok: false, out: out, vars: {}, error: { message: loop ? LOOP_MSG : String(e2 && e2.message || e2), line: lineFromStack(e2 && e2.stack), loop: loop } };
    }
  }

  /* 画面の設定で eval が使えないときの逃げ道。<script> を差し込んで同じことをする */
  function executeViaScript(body, con, g, out){
    var slot = window.__labRun = { con: con, g: g, result: null, error: null };
    var syntaxErr = null;
    function onErr(ev){ syntaxErr = ev.error || new Error(ev.message); ev.preventDefault(); }
    window.addEventListener("error", onErr);
    var s = document.createElement("script");
    s.textContent = "try{window.__labRun.result=(function(console,__g){" + body + "\n})(window.__labRun.con,window.__labRun.g);}catch(e){window.__labRun.error=e;}";
    document.head.appendChild(s); s.remove();
    window.removeEventListener("error", onErr);
    if (syntaxErr) return { ok: false, out: out, vars: {}, error: { message: String(syntaxErr.message || syntaxErr), line: null, syntax: true } };
    if (slot.error) {
      var loop = slot.error.message === "__LOOP__";
      return { ok: false, out: out, vars: {}, error: { message: loop ? LOOP_MSG : String(slot.error.message), line: null, loop: loop } };
    }
    return { ok: true, out: out, vars: slot.result || {} };
  }

  function explainError(err){
    if (RT === "java") return explainJava(err);
    var msg = err.message || "";
    var name = /^(\S+) is not defined/.exec(msg);
    if (err.loop) return "ループが止まらなくなっています。繰り返しの条件が、いつまでも変わらないままになっていないか見てみましょう。";
    if (name) return "`" + name[1] + "` という名前が見つかりません。つづりが違うか、まだ作っていない変数を使っています。";
    if (/Assignment to constant/.test(msg)) return "`const` で作った変数は、あとから変えられません。変える予定があるなら `let` を使います。";
    if (/already been declared/.test(msg)) return "同じ名前の変数を2回作っています。2回目の `const` や `let` を外すか、別の名前にしましょう。";
    if (/Unexpected|missing|Invalid or unexpected|Unterminated/.test(msg)) return "書き方の形がくずれています。`( )` や `{ }`、`\" \"` の閉じ忘れがないか見てみましょう。";
    if (/Cannot read propert/.test(msg)) return "中身が空（undefined）のものから値を取ろうとしています。名前や番号が合っているか見てみましょう。";
    return "エラーの内容は「" + msg + "」です。";
  }

  /* =====================================================================
     画面
     ===================================================================== */
  var ta = $("src"), hl = $("hl"), gutter = $("gutter"), bands = $("bands"), pops = $("pops"), codeBox = $("codeBox");
  var S;

  /* 見出し（コース名・単元番号・ファイル名）を単元に合わせる */
  (function applyMeta(){
    function set(sel, v){ var el = root.querySelector(sel); if (el && v != null) el.textContent = v; }
    var no = META.unitNo ? "単元 " + META.unitNo : "";
    set(".tk-c", [META.courseTitle, no && META.unitTotal ? no + " / " + META.unitTotal : no].filter(Boolean).join(" ・ "));
    set(".eyebrow", [no, META.chapter].filter(Boolean).join(" ・ "));
    set(".lesson h1", U.title);
    set(".ide-bar .lang", RT === "web" ? "HTML・CSS" : RT === "java" ? "Java" : "JavaScript");
    var fileEl = root.querySelector(".ide-bar .file");
    if (fileEl) {
      if (RT === "web") {
        // index.html と style.css を切り替えるタブ
        fileEl.classList.add("ftabs");
        fileEl.setAttribute("role", "tablist");
        fileEl.innerHTML = '<button type="button" role="tab" data-f="html">index.html</button><button type="button" role="tab" data-f="css">style.css</button>';
      } else fileEl.textContent = FILE_NAME.main;
    }
    var kw0 = root.querySelector(".app > .kw .m");
    if (kw0) kw0.textContent = RT === "web" ? "本当に表示される HTML・CSS" : RT === "java" ? "本物の Java で実行" : "本当に動く JavaScript";
    var tv = $("tabVar");
    if (tv && RT === "web") tv.textContent = "スマホ幅";
    if (tv && RT === "java") tv.hidden = true;
    var back = root.querySelector(".tk-back");
    if (back) {
      if (OPTS.backGo) { back.setAttribute("data-go", OPTS.backGo); back.textContent = OPTS.backLabel || back.textContent; }
      else if (META.courseId) back.setAttribute("data-go", "course:" + META.courseId);
    }
    var kw = root.querySelector(".app > .kw");
    if (kw && OPTS.preview) kw.innerHTML = '<li class="m">受講生として試す</li><li>下書き</li><li>記録なし</li>';
    var ask = $("askInput");
    if (ask) ask.placeholder = "コーチに聞く";
  })();

  /* 保存するコード。web は2つのファイルを JSON にまとめて1つの文字列にする */
  function packCode(files){ return RT === "web" ? JSON.stringify({ html: files.html, css: files.css }) : files.main; }
  function unpackCode(code){
    if (!code) return null;
    if (RT !== "web") return { main: String(code) };
    try { var o = JSON.parse(code); return { html: String(o.html || ""), css: String(o.css || "") }; } catch (e) { return null; }
  }

  function fresh(useSaved){
    var sv = useSaved && OPTS.initial ? OPTS.initial : null;
    var files = (sv && unpackCode(sv.code)) || { html: FILES0.html, css: FILES0.css, main: FILES0.main };
    var step = sv ? Math.min(Math.max(0, sv.step || 0), STEPS.length) : 0;
    var cur = stepFile(Math.min(step, Math.max(0, STEPS.length - 1)));
    return {
      step: step, files: files, cur: cur, text: files[cur] || "", last: null, errLine: null, running: false,
      runs0: sv ? sv.runs || 0 : 0, hints0: sv ? sv.hints || 0 : 0, replays0: sv ? sv.replays || 0 : 0,
      runs: 0, hints: 0, replays: 0, errors: 0,
      hintLevel: STEPS.map(function(){ return 0; }), collapsed: false, replaying: false, fast: false,
      started: Date.now(), touched: Date.now(), nudged: {}, lastCoach: "", doneAt: null, tab: "out"
    };
  }

  function lineCount(){ return S.text.split("\n").length; }

  // いま開いているファイルの中身を変える（S.text と S.files をそろえる）
  function setText(t){ S.text = t; S.files[S.cur] = t; }

  function renderFileTabs(){
    if (RT !== "web") return;
    root.querySelectorAll(".ide-bar [data-f]").forEach(function(b){
      b.setAttribute("aria-selected", String(b.getAttribute("data-f") === S.cur));
    });
  }
  function switchFile(f){
    if (RT !== "web" || f === S.cur || S.replaying) return;
    S.cur = f; S.text = S.files[f] || ""; S.errLine = null;
    ta.value = S.text; ta.scrollTop = 0;
    renderFileTabs(); renderCode(); renderPopup();
  }
  // 説明の吹き出しは、そのステップで書くファイルを開いているときだけ行に付ける
  function onStepFile(){ return S.step >= STEPS.length || stepFile(S.step) === S.cur; }

  function anchorLine(){
    var lines = S.text.split("\n");
    if (S.step >= STEPS.length || !onStepFile()) return 1;
    var keys = STEPS[S.step].anchor;
    for (var k = 0; k < keys.length; k++) {
      for (var i = 0; i < lines.length; i++) if (lines[i].indexOf(keys[k]) >= 0) return i + 1;
    }
    for (var j = lines.length - 1; j >= 0; j--) if (lines[j].trim()) return j + 1;
    return 1;
  }

  function renderCode(){
    hl.innerHTML = highlight(S.text) + "\n ";
    var a = anchorLine(), n = lineCount(), g = "";
    for (var i = 1; i <= n; i++) {
      g += '<div class="ln' + (i === S.errLine ? " err" : i === a ? " anchor" : "") + '">' + i + "</div>";
    }
    gutter.innerHTML = g;
    var b = '<div class="band anchor" style="top:' + (PAD + (a - 1) * LH) + 'px"></div>';
    if (S.errLine) b += '<div class="band err" style="top:' + (PAD + (S.errLine - 1) * LH) + 'px"></div>';
    bands.innerHTML = b;
    syncScroll();
  }

  function syncScroll(){
    hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft;
    var y = "translateY(" + (-ta.scrollTop) + "px)";
    gutter.style.transform = y; bands.style.transform = y; pops.style.transform = y;
  }

  /* 講義の吹き出し。指している行の高さに出し、はみ出すなら見える範囲に寄せる */
  function renderPopup(){
    var a = anchorLine();
    var narrow = codeBox.clientWidth < 760;
    var html;
    if (S.step >= STEPS.length) {
      var mins = Math.max(1, Math.round(((S.doneAt || Date.now()) - S.started) / 60000));
      var skills = (U.skills || []).map(function(k, i){ return "<li" + (i === 0 ? ' class="m"' : "") + ">" + esc(k) + "</li>"; }).join("");
      html = '<div class="pop" id="pop">' +
        '<div class="k">レッスン完了</div><div class="t">お疲れさまでした</div>' +
        (skills ? '<ul class="kw sm">' + skills + "</ul>" : "") +
        '<div class="sum"><div>かかった時間<b>' + mins + '分</b></div><div>実行した回数<b>' + S.runs + '回</b></div>' +
        '<div>ヒント<b>' + S.hints + '回</b></div><div>お手本<b>' + S.replays + '回</b></div></div>' +
        '<div class="a"><button type="button" class="go" data-go="cleared">' + (OPTS.preview ? "単元づくりへ戻る" : "コースマップへ（単元クリア）") + '</button><button type="button" data-a="restart">もう一度はじめから</button></div></div>';
    } else if (!onStepFile()) {
      html = '<button class="pill" type="button" data-a="gofile" id="pop">ステップ' + (S.step + 1) + ' → ' + esc(FILE_NAME[stepFile(S.step)]) + "</button>";
    } else if (S.collapsed) {
      html = '<button class="pill" type="button" data-a="open" id="pop">ステップ' + (S.step + 1) + 'の説明を開く</button>';
    } else {
      var st = STEPS[S.step], dm = st.demo || {};
      html = '<div class="pop" id="pop" role="note">' +
        '<div class="k">ステップ ' + (S.step + 1) + ' の説明</div>' +
        '<div class="t">' + esc(st.title) + '</div><div class="b">' + rich(st.body) + '</div>' +
        '<div class="a"><button type="button" class="pri" data-a="ok">分かった</button>' +
        (dm.mode === "run" ? '<button type="button" data-a="run">実行してみる</button>' : hasDemo(S.step) ? '<button type="button" data-a="demo">お手本を見る</button>' : "") +
        '</div></div>';
    }
    pops.innerHTML = html;
    var el = $("pop");
    if (!el) return;
    if (narrow && el.classList.contains("pop")) el.classList.add("below");
    var h = el.offsetHeight;
    var top = narrow && el.classList.contains("pop") ? PAD + a * LH + 8 : PAD + (a - 1) * LH - 6;
    var viewTop = ta.scrollTop + 8, viewBottom = ta.scrollTop + ta.clientHeight - 8;
    if (top + h > viewBottom) top = Math.max(viewTop, viewBottom - h);
    if (top < viewTop) top = viewTop;
    el.style.top = top + "px";
  }

  function currentData(){ return parseData(S.files.main || "") || dataOf(S.last) || BASE_DATA; }

  var ICON_TODO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>';
  var ICON_PASS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>';

  /* ゴール欄。左に「やること」と「合格の条件」、右に完成したときの出力を出す */
  function renderMission(){
    var data = currentData(), done = S.step >= STEPS.length;
    var lines = goalLines(data);
    var nowLine = done ? -1 : lineOfStep(S.step, lines);
    var preview = lines.length ? '<div class="preview"><div class="h">完成すると、出力はこうなります</div>' +
      lines.map(function(l, i){
        var ok = S.step >= lineDoneAt(i, lines), now = i === nowLine;
        return '<div class="pl' + (ok ? " done" : now ? " now" : "") + '"><span class="ic">' + (ok ? "✓" : now ? "▶" : "・") + "</span>" +
          "<span>" + esc(l) + "</span>" + (now ? '<span class="here">いまここ</span>' : "") + "</div>";
      }).join("") + "</div>" : "";

    var left;
    if (done) {
      left = '<div><div class="ms-head"><span class="ms-step">レッスン完了</span></div>' +
        '<div class="ms-title">' + (lines.length ? lines.length + "行ぜんぶ出せました" : "ぜんぶのステップをクリア") + "</div>" +
        '<div class="ms-rows"><div class="ms-row"><div class="ms-k">' + ICON_TODO + "次にできること</div>" +
        '<div class="ms-v">自由に書き換えて試す</div></div></div>' +
        '<div class="ms-go"><button type="button" data-go="cleared">' + (OPTS.preview ? "単元づくりへ戻る" : "この単元をクリアにしてコースマップへ") + "</button></div></div>";
    } else {
      var st = STEPS[S.step], c = condParts(S.step, data);
      var changed = DATA && BASE_DATA && data && !sameData(data, BASE_DATA) && st.check.kind === "answerLine";
      left = '<div><div class="ms-head"><span class="ms-step">ステップ ' + (S.step + 1) + " / " + STEPS.length + "</span></div>" +
        '<div class="ms-title">' + esc(st.title) + "</div>" +
        '<div class="ms-rows">' +
          '<div class="ms-row"><div class="ms-k">' + ICON_TODO + 'やること</div><div class="ms-v">' + rich(st.todo) + "</div></div>" +
          '<div class="ms-row"><div class="ms-k">' + ICON_PASS + '合格の条件</div><div class="ms-v pass">' +
            esc(c[0]) + " <code>" + esc(c[1]) + "</code> " + esc(c[2]) +
            (changed ? '<div class="ms-note">あなたの <code>' + esc(DATA) + "</code> で計算</div>" : "") +
          "</div></div>" +
        "</div></div>";
    }
    var el = $("mission");
    el.className = "mission" + (done ? " ms-done" : "");
    if (RT === "web") {
      // 完成の見た目は枠で1回だけ描く（打つたびに描き直すとちらつく）
      if (!el.querySelector(".ms-l")) {
        el.innerHTML = '<div class="ms-l"></div>' + (UF.answer ? '<div class="preview wgoal"><div class="h">完成すると、こうなります</div><div class="wg"><iframe sandbox="" tabindex="-1" scrolling="no" title="完成の見た目"></iframe></div></div>' : "");
        var gf = el.querySelector(".wgoal iframe");
        if (gf) gf.srcdoc = webDocument(UF.answer, UF.answerCss);
      }
      el.querySelector(".ms-l").innerHTML = left;
      return;
    }
    el.innerHTML = left + preview;
  }

  /* 合格しなかった実行のあとに、目標といまの出力を並べる（出力で判定するステップだけ） */
  function cmpRow(want, got){
    return '<div class="cmp"><div class="r"><span class="cl">目標</span><code>' + esc(want) + "</code></div>" +
      '<div class="r"><span class="cl">いま</span>' + (got ? "<code>" + esc(got) + "</code>" : '<span class="miss">まだ出ていません</span>') + "</div></div>";
  }
  function cmpHtml(r){
    if (S.step >= STEPS.length) return "";
    var c = STEPS[S.step].check;
    if (RT === "web") return r.docs ? cmpRow(webWant(c), webMeasure(c, r.docs)) : "";
    if (c.kind === "tests" && r.tests) {
      return '<div class="cmp">' + r.tests.map(function(t){
        return '<div class="r"><span class="cl">' + (t.ok ? "✓" : "✗") + " " + esc(t.label) + '</span><code>' + esc(t.want) + "</code>" + (t.ok ? "" : ' <span class="miss">いま ' + esc(t.got) + "</span>") + "</div>";
      }).join("") + "</div>";
    }
    var want = stepWant(S.step, dataOf(r) || currentData());
    if (!want) return "";
    var p = stepPrefix(S.step), lines = outLines(r);
    var got = p ? findPrefix(lines, p) : (lines.indexOf(want) >= 0 ? want : null);
    return cmpRow(want, got);
  }

  function renderSteps(){
    $("steps").innerHTML = STEPS.map(function(st, i){
      var cls = i < S.step ? "done" : i === S.step ? "now" : "";
      return '<li class="' + cls + '" title="' + esc(st.title) + '"><span class="bar"></span><span class="lbl">' + (i + 1) + ". " + esc(st.short || st.title) + "</span></li>";
    }).join("");
    $("stats").innerHTML = "実行 <b>" + S.runs + "</b> ・ ヒント <b>" + S.hints + "</b> ・ お手本 <b>" + S.replays + "</b>";
    $("btnDemo").disabled = S.step >= STEPS.length || S.replaying || !hasDemo(S.step);
    $("chipErr").disabled = !(S.last && !S.last.ok);
  }

  /* Web：出力の欄は「表示」（いまのコードをそのまま描いた枠）と、確かめた結果 */
  var WEB = null;
  function setupWebPanes(){
    if (RT !== "web") return;
    $("outPane").innerHTML = '<div class="wprev"><iframe sandbox="allow-same-origin" title="表示"></iframe></div><div class="wres" aria-live="polite"></div>';
    $("varPane").innerHTML = '<div class="wprev narrow"><iframe sandbox="allow-same-origin" title="スマホ幅の表示"></iframe></div>';
    WEB = { wide: $("outPane").querySelector("iframe"), narrow: $("varPane").querySelector("iframe"), measure: WEB ? WEB.measure : makeMeasureFrames(root), timer: 0 };
  }
  // 打つたびに（少し間を置いて）表示だけ描き直す。判定は「実行」のときだけ
  function refreshWebPreview(now){
    if (!WEB) return;
    clearTimeout(WEB.timer);
    var draw = function(){ var d = webDocument(S.files.html, S.files.css); WEB.wide.srcdoc = d; WEB.narrow.srcdoc = d; };
    if (now) draw(); else WEB.timer = setTimeout(draw, 350);
  }

  function renderOutput(r, extra){
    if (RT === "web") {
      var res = $("outPane").querySelector(".wres");
      if (res) res.innerHTML = r ? (extra || "") : '<div class="o-empty">「実行」で表示を確かめる</div>';
      return;
    }
    var pane = $("outPane");
    if (!r) { pane.innerHTML = '<div class="o-empty">「実行」を押すと、ここに結果が出ます。</div>'; return; }
    var h = r.out.map(function(l){ return '<div class="o-line"><span class="g">›</span><span>' + esc(l.s) + "</span></div>"; }).join("");
    if (!r.out.length && r.ok) h = '<div class="o-empty">何も表示されませんでした（' + (RT === "java" ? "System.out.println" : "console.log") + " がありません）。</div>";
    if (!r.ok) {
      h += '<div class="o-err"><b>エラー</b>' + (r.error.line ? '<span class="at">' + r.error.line + "行目</span>" : "") + esc(r.error.loop ? LOOP_MSG + "（20万回で止めました）" : r.error.message) + "</div>";
    }
    pane.innerHTML = h + (extra || "");
    pane.scrollTop = pane.scrollHeight;
  }

  function renderVars(r){
    if (RT !== "js") return;
    var v = (r && r.ok) ? r.vars : {};
    $("varPane").innerHTML = '<table class="vt"><tbody>' + VARS.map(function(name){
      var has = v && v[name] !== undefined;
      return "<tr><td>" + name + "</td><td" + (has ? "" : ' class="none"') + ">" + (has ? esc(fmt(v[name], true)) : "まだありません") + "</td></tr>";
    }).join("") + "</tbody></table>";
  }

  function setTab(t){
    S.tab = t;
    $("tabOut").setAttribute("aria-selected", String(t === "out"));
    $("tabVar").setAttribute("aria-selected", String(t === "var"));
    $("outPane").hidden = t !== "out";
    $("varPane").hidden = t !== "var";
  }

  function renderAll(){ renderMission(); renderCode(); renderPopup(); renderSteps(); }

  /* ---- コーチ ---- */
  function fmtMsg(t){ return esc(t).replace(/`([^`]+)`/g, "<code>$1</code>"); }
  function pushCoach(text, opt){
    opt = opt || {};
    if (!text || (text === S.lastCoach && !opt.force)) return;
    S.lastCoach = text;
    var box = $("msgs");
    var el = document.createElement("div");
    el.className = "m ai";
    el.innerHTML = '<span class="dots" aria-label="入力中"><i></i><i></i><i></i></span>';
    box.appendChild(el); box.scrollTop = box.scrollHeight;
    setTimeout(function(){
      el.innerHTML = fmtMsg(text) + (opt.code ? "<pre>" + highlight(opt.code) + "</pre>" : "");
      box.scrollTop = box.scrollHeight;
    }, REDUCED ? 0 : 420);
  }
  function pushMe(text){
    var box = $("msgs"), el = document.createElement("div");
    el.className = "m me"; el.textContent = text;
    box.appendChild(el); box.scrollTop = box.scrollHeight;
  }

  /* いまのコードと実行結果を見て、具体的に言えることがあれば言う */
  function situational(){
    var r = S.last, i = S.step;
    if (i >= STEPS.length || !r || !r.ok) return "";
    var c = STEPS[i].check;
    if (RT === "web") {
      if (!r.docs) return "";
      return "いまは `" + webMeasure(c, r.docs) + "`。目標は `" + webWant(c) + "` です。";
    }
    if (c.kind === "tests" && r.tests) {
      var bad = r.tests.filter(function(t){ return !t.ok; })[0];
      return bad ? "入力 `" + bad.label + "` のとき `" + bad.want + "` と出てほしいところ、いまは `" + bad.got + "` です。" : "";
    }
    if (c.kind === "change") {
      var d = dataOf(r);
      return d && sameData(d, BASE_DATA) ? "`" + DATA + "` はまだ元のままです。中身を変えてから実行しましょう。" : "";
    }
    if (c.kind === "answerLine") {
      var got = findPrefix(outLines(r), c.prefix), want = stepWant(i, dataOf(r) || BASE_DATA);
      if (!got) return "「" + c.prefix + "」で始まる行がまだ出ていません。";
      if (want && !sameLine(got, want, c.prefix)) return "`" + got + "` と出ています。目標は `" + want + "` です。";
    }
    if (c.kind === "line") {
      var miss = c.value.split("\n").filter(Boolean).filter(function(l){ return outLines(r).indexOf(l) < 0; })[0];
      if (miss) return "`" + miss + "` がまだ出ていません。";
    }
    return "";
  }

  function giveHint(){
    if (S.step >= STEPS.length) { pushCoach("レッスンは完了しています。自由に書き換えて試してみてください。", { force: true }); return; }
    var st = STEPS[S.step], hints = st.hints || [], lv = S.hintLevel[S.step] || 0;
    S.hints++; S.hintLevel[S.step] = lv + 1;
    var pre = situational(), msg;
    if (lv < hints.length) msg = hints[lv];
    else if (hasDemo(S.step)) msg = "ここまで来たら、お手本を見てしまうのも手です。「お手本を見る」で、実際に打ってみせます。";
    else msg = hints.length ? hints[hints.length - 1] : "やることと合格の条件を見比べてみましょう。";
    pushCoach((pre ? pre + " " : "") + msg, { force: true });
    renderSteps();
  }

  function answer(q){
    var st = STEPS[Math.min(S.step, STEPS.length - 1)];
    if (/エラー|動かない|だめ|ダメ|おかしい/.test(q)) {
      if (S.last && !S.last.ok) return explainError(S.last.error);
      return situational() || "いまはエラーは出ていません。思ったとおりにならないところを、もう少し教えてください。";
    }
    if (/ヒント|わから|分から|詰ま|つま/.test(q)) { giveHint(); return null; }
    if (/お手本|答え|見せて/.test(q)) { replay(); return null; }
    if (/なぜ|どうして|意味|理由/.test(q)) return st.why || st.hints[0] || "";
    if (S.step >= STEPS.length) return "レッスンは完了しています。気になったことは何でも試してみてください。";
    return "いまは「" + st.title + "」のステップです。" + (situational() || (st.hints || [])[0] || "");
  }

  function onChip(q){
    if (q === "hint") { pushMe("ヒントをちょうだい"); giveHint(); }
    else if (q === "error") {
      pushMe("このエラーはなに？");
      if (S.last && !S.last.ok) {
        var e = S.last.error;
        pushCoach((e.line ? e.line + "行目で止まっています。" : "") + explainError(e), { force: true });
      } else pushCoach("いまはエラーは出ていません。", { force: true });
    }
    else if (q === "why") { pushMe("なぜこう書くの？"); var w = STEPS[Math.min(S.step, STEPS.length - 1)]; pushCoach(w.why || (w.hints || [])[0] || "", { force: true }); }
    else if (q === "demo") { pushMe("お手本を見せて"); replay(); }
  }

  /* ---- 実行 ---- */
  // 目印の行を、そのステップで書くファイルの最後に足す（なければ）
  function ensureMark(mark, f){
    f = f || S.cur;
    var t = S.files[f] || "";
    if (t.indexOf(mark) >= 0) return;
    S.files[f] = t.replace(/\s*$/, "") + "\n\n" + mark + "\n";
    if (f === S.cur) { S.text = S.files[f]; ta.value = S.text; }
  }

  // ステップに入ったとき：そのステップのファイルを開き、目印の行（例「// ステップ4：…」）がなければ足す
  function enterStep(){
    var st = STEPS[S.step];
    if (!st) return;
    if (RT === "web" && stepFile(S.step) !== S.cur) {
      S.cur = stepFile(S.step); S.text = S.files[S.cur] || ""; ta.value = S.text; ta.scrollTop = 0; renderFileTabs();
    }
    if (st.appendOnStart) ensureMark(st.appendOnStart, stepFile(S.step));
  }

  function setRunning(on){
    var b = $("btnRun");
    b.disabled = on;
    b.classList.toggle("busy", on);
    $("btnDemo").disabled = on || S.step >= STEPS.length || !hasDemo(S.step);
    if (on && RT === "java") renderOutputBusy();
  }
  function renderOutputBusy(){ $("outPane").innerHTML = '<div class="o-empty">Java をコンパイルして実行しています…</div>'; }

  // 実行環境ごとに動かす。結果の形はどれも { ok, out:[{s}], vars, error }（web は docs も）
  function execNow(){
    if (RT === "js") return Promise.resolve(execute(S.files.main));
    if (RT === "java") {
      // 入力で確かめるステップでは、最初のテストの入力を渡して動かす（入力なしだと読み込みで止まるため）
      var c = S.step < STEPS.length ? STEPS[S.step].check : null;
      var first = c && c.kind === "tests" ? parseTests(c.value)[0] : null;
      return callJava(first ? first.input : "");
    }
    refreshWebPreview(true);
    return renderWeb(WEB.measure, S.files.html, S.files.css).then(function(docs){ return { ok: true, out: [], vars: {}, docs: docs }; });
  }

  // 実行中（Java のテストを含めて終わるまで）は、もう一度押せないようにする
  async function run(){
    if (S.replaying || S.running) return;
    S.running = true; setRunning(true);
    try { await runOnce(); } finally { if (!destroyed) { S.running = false; setRunning(false); } }
  }

  async function runOnce(){
    var r = await execNow();
    if (destroyed) return;
    S.runs++; S.last = r; S.touched = Date.now();
    S.errLine = (!r.ok && r.error && r.error.line && r.error.line <= lineCount()) ? r.error.line : null;
    if (!r.ok) S.errors++;
    renderVars(r);

    var extra = "", advanced = false;
    // 合格したステップは続けて確かめる（完成形をまとめて書いた人は一度に進む）
    while (S.step < STEPS.length) {
      if (RT === "java" && STEPS[S.step].check.kind === "tests") $("outPane").innerHTML = '<div class="o-empty">入力を変えて、テストを動かしています…</div>';
      var ok = await passes(S.step, r);
      if (destroyed) return;
      if (!ok) break;
      var st = STEPS[S.step];
      extra += '<div class="o-ok"><b>ステップ' + (S.step + 1) + ' クリア</b>' + esc(clearText(S.step, r)) + "</div>";
      if (st.done) pushCoach(st.done, { force: true });
      S.step++; advanced = true;
      enterStep();
    }
    // 合格しなかったときは、目標といまを並べて見せる
    if (!advanced && r.ok) extra += cmpHtml(r);
    renderOutput(r, extra);
    setTab("out");

    if (!r.ok) {
      pushCoach((r.error.line ? r.error.line + "行目で止まりました。" : "うまく動きませんでした。") + explainError(r.error), { force: true });
    } else if (advanced) {
      S.collapsed = false; S.nudged = {};
      if (S.step >= STEPS.length) { S.doneAt = Date.now(); }
      else {
        var nx = STEPS[S.step];
        setTimeout(function(){ pushCoach("次は「" + nx.title + "」です。コードの横に出た説明を読んでから始めてみてください。", { force: true }); }, REDUCED ? 0 : 700);
      }
    } else {
      var hint = situational();
      if (hint) pushCoach(hint);
    }
    renderAll();
    report(advanced);
  }

  /* ---- お手本の再生：実際に1文字ずつ打ってみせる ---- */
  function keepVisible(caret){
    var line = S.text.slice(0, caret).split("\n").length;
    var top = PAD + (line - 1) * LH;
    if (top < ta.scrollTop + 10) ta.scrollTop = Math.max(0, top - 40);
    else if (top + LH > ta.scrollTop + ta.clientHeight - 10) ta.scrollTop = top + LH - ta.clientHeight + 60;
  }

  function replay(){
    if (S.replaying || S.running) return;
    if (S.step >= STEPS.length) { pushCoach("レッスンは完了しています。", { force: true }); return; }
    if (!hasDemo(S.step)) { pushCoach("このステップにはお手本がありません。ヒントを使ってみてください。", { force: true }); return; }
    // お手本は、そのステップで書くファイルに打つ
    if (RT === "web" && stepFile(S.step) !== S.cur) switchFile(stepFile(S.step));
    var plan = demoPlan(S.step, S.text);
    S.replays++;
    if (plan.run) {
      var btn = $("btnRun"); btn.classList.remove("flash"); void btn.offsetWidth; btn.classList.add("flash");
      pushCoach("お手本では、ここで「実行」を押します。見ていてください。", { force: true });
      setTimeout(run, REDUCED ? 0 : 900);
      renderSteps();
      return;
    }
    if (plan.already) {
      pushCoach("お手本の書き方はこうです。見比べてみてください。", { code: plan.already, force: true });
      renderSteps();
      return;
    }
    var before = S.text.slice(0, plan.at), after = S.text.slice(plan.at + plan.del), ins = plan.ins, i = 0;
    S.replaying = true; ta.readOnly = true; $("replayBar").hidden = false;
    pushCoach("お手本を打ちます。手元の動きを見ていてください。", { force: true });
    S.finishReplay = function(){ setText(before + ins + after); ta.value = S.text; };
    function tick(){
      if (!S.replaying) return;
      i = REDUCED ? ins.length : Math.min(ins.length, i + 1);
      setText(before + ins.slice(0, i) + after); ta.value = S.text;
      var caret = before.length + i;
      try { ta.setSelectionRange(caret, caret); } catch (e) {}
      keepVisible(caret);
      renderCode(); renderPopup();
      if (i < ins.length) S.replayTimer = setTimeout(tick, S.fast ? 14 : 42);
      else endReplay(true);
    }
    renderSteps();
    tick();
  }

  function endReplay(runAfter){
    clearTimeout(S.replayTimer);
    if (S.finishReplay) S.finishReplay();
    S.finishReplay = null; S.replaying = false; S.fast = false;
    ta.readOnly = false; $("replayBar").hidden = true; $("btnFast").textContent = "2倍速";
    refreshWebPreview(true);
    renderAll();
    if (runAfter) setTimeout(run, REDUCED ? 0 : 450);
  }

  /* ---- 入力まわり ---- */
  function insertText(str){
    ta.focus();
    var ok = false;
    try { ok = document.execCommand && document.execCommand("insertText", false, str); } catch (e) { ok = false; }
    if (!ok) {
      var s = ta.selectionStart, e2 = ta.selectionEnd;
      ta.setRangeText(str, s, e2, "end");
      ta.dispatchEvent(new Event("input"));
    }
  }

  ta.addEventListener("input", function(){
    setText(ta.value); S.errLine = null; S.touched = Date.now();
    changed();
    refreshWebPreview(false);
    renderCode(); renderPopup(); renderMission();
  });
  var fileBar = root.querySelector(".ide-bar .file");
  if (fileBar && RT === "web") fileBar.addEventListener("click", function(e){
    var b = e.target.closest("[data-f]"); if (b) switchFile(b.getAttribute("data-f"));
  });
  ta.addEventListener("scroll", function(){ syncScroll(); renderPopup(); });
  ta.addEventListener("keydown", function(e){
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); return; }
    if (ta.readOnly) return;
    if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); insertText("  "); return; }
    if (e.key === "Enter" && !e.isComposing) {
      var pos = ta.selectionStart, head = ta.value.slice(0, pos);
      var line = head.slice(head.lastIndexOf("\n") + 1);
      var indent = (/^\s*/.exec(line) || [""])[0];
      if (/\{\s*$/.test(line)) indent += "  ";
      e.preventDefault();
      insertText("\n" + indent);
    }
  });

  $("btnRun").addEventListener("click", run);
  $("btnDemo").addEventListener("click", replay);
  $("btnSkip").addEventListener("click", function(){ endReplay(true); });
  $("btnFast").addEventListener("click", function(){ S.fast = !S.fast; this.textContent = S.fast ? "ふつう" : "2倍速"; });
  $("tabOut").addEventListener("click", function(){ setTab("out"); });
  $("tabVar").addEventListener("click", function(){ setTab("var"); });

  pops.addEventListener("click", function(e){
    var b = e.target.closest("[data-a]"); if (!b) return;
    var a = b.getAttribute("data-a");
    if (a === "ok") { S.collapsed = true; renderPopup(); ta.focus(); }
    else if (a === "open") { S.collapsed = false; renderPopup(); }
    else if (a === "demo") { replay(); }
    else if (a === "run") { run(); }
    else if (a === "restart") { restart(); }
    else if (a === "gofile") { switchFile(stepFile(S.step)); }
  });

  $("chips").addEventListener("click", function(e){
    var b = e.target.closest("[data-q]"); if (!b || b.disabled) return;
    onChip(b.getAttribute("data-q"));
  });
  $("ask").addEventListener("submit", function(e){
    e.preventDefault();
    var inp = $("askInput"), q = inp.value.trim();
    if (!q) return;
    inp.value = "";
    pushMe(q);
    var a = answer(q);
    if (a) pushCoach(a, { force: true });
  });

  /* 画面の確認ダイアログは使えないので、2回押しで確定させる */
  var armTimer = null;
  $("btnReset").addEventListener("click", function(){
    var b = this;
    if (!b.classList.contains("armed")) {
      b.classList.add("armed"); b.textContent = "もう一度押すとやり直します";
      clearTimeout(armTimer);
      armTimer = setTimeout(function(){ b.classList.remove("armed"); b.textContent = "最初から"; }, 3000);
      return;
    }
    clearTimeout(armTimer); b.classList.remove("armed"); b.textContent = "最初から";
    restart();
  });

  function restart(useSaved){
    if (S && S.replaying) { clearTimeout(S.replayTimer); ta.readOnly = false; $("replayBar").hidden = true; }
    S = fresh(useSaved);
    enterStep();
    ta.value = S.text; ta.scrollTop = 0;
    $("msgs").innerHTML = "";
    setupWebPanes(); renderFileTabs(); refreshWebPreview(true);
    renderOutput(null); renderVars(null); setTab("out");
    renderAll();
    if (useSaved && S.step >= STEPS.length) pushCoach("この単元はクリア済みです。自由に書き換えて試してみてください。", { force: true });
    else if (useSaved && S.step > 0) pushCoach("おかえりなさい。前回の続き、ステップ" + (S.step + 1) + "「" + STEPS[S.step].title + "」からです。", { force: true });
    else pushCoach("こんにちは、コーチです。コードの横に出る説明を読みながら進めてください。分からないことは、いつでもここで聞いてください。まずは「実行」を押してみましょう。", { force: true });
  }

  /* 手が止まっていたら、一度だけ声をかける */
  var nudgeTimer = setInterval(function(){
    if (!S || S.replaying || S.step >= STEPS.length || S.nudged[S.step]) return;
    if (Date.now() - S.touched > 75000) {
      S.nudged[S.step] = true;
      pushCoach("少し手が止まっていますね。ヒントを出しましょうか？ 下の「ヒントをちょうだい」を押してください。", { force: true });
    }
  }, 5000);

  var destroyed = false;
  var onResize = function(){ renderPopup(); };
  window.addEventListener("resize", onResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ if (!destroyed) renderAll(); });

  restart(true);
  return function destroy(){
    destroyed = true;
    clearInterval(nudgeTimer);
    window.removeEventListener("resize", onResize);
    if (S) clearTimeout(S.replayTimer);
    if (WEB) { clearTimeout(WEB.timer); WEB.measure.wide.remove(); WEB.measure.narrow.remove(); }
  };
}
