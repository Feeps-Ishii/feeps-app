/* 自動生成（docs/design/mockups/tenolab-2026-09/src/gen_tenolab.py）で、モックから移植した。以後はこのファイルを直接直す。 */
export function mountLab(root, OPTS) {
  "use strict";
  OPTS = OPTS || {};
  /* 保存は画面側（React）に任せる。ここからは「いまの状態」を渡すだけ。
     onProgress: ステップが進んだとき（すぐ保存する）／onChange: コードを打ったとき（間を置いて保存する） */
  function snapshot(){
    return {
      step: S.step, status: S.step >= STEPS.length ? "cleared" : "doing", code: S.text,
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
     レッスンの中身
     ===================================================================== */
  var PLACEHOLDER = "// ここに1行書いてみよう";
  var STEP4_MARK = "// ステップ4：平均を求めて「平均:」と表示しよう";
  var STEP5_MARK = "// ステップ5（チャレンジ）：いちばん高い点数を「最高点:」と表示しよう";
  var INITIAL = [
    "// お題：テストの点数をまとめる",
    "const scores = [72, 85, 90, 64, 78];",
    "",
    "console.log(\"受講生の数:\", scores.length);",
    "",
    "// ステップ3：合計を求めよう",
    "let total = 0;",
    "for (const n of scores) {",
    "  " + PLACEHOLDER,
    "}",
    "console.log(\"合計:\", total);",
    ""
  ].join("\n");

  function sum(a){ return a.reduce(function(s, x){ return s + (Number(x) || 0); }, 0); }
  function findLine(r, re){
    for (var i = 0; i < r.out.length; i++) if (re.test(r.out[i].s)) return r.out[i].s;
    return null;
  }
  function numAfterColon(s){ var m = /:\s*(-?\d+(?:\.\d+)?)/.exec(s || ""); return m ? Number(m[1]) : NaN; }
  function scoresOf(r){ return (r && r.vars && Array.isArray(r.vars.scores)) ? r.vars.scores : null; }

  var STEPS = [
    {
      short: "動かす", title: "まずは動かしてみよう", goal: "「実行」を押して、出力を確かめる",
      body: "お手本のコードがもう入っています。<b>実行</b>（Ctrl+Enter）を押すと、<code>console.log</code> の中身が下の出力に出ます。",
      anchor: ["console.log(\"受講生の数:\""],
      hints: ["エディタの右上に「実行」があります。Ctrl+Enter でも動きます。", "押したら、下の「出力」に何が出たかを見てください。"],
      why: "`console.log` は、値を画面に出して確かめるための命令です。プログラムの途中で値を見たいときにもよく使います。",
      check: function(r){ return r.ok && !!findLine(r, /^受講生の数: \d+$/); },
      clear: function(){ return "出力を確かめました"; },
      done: function(){ return "動きましたね。合計がまだ `0` なのは、足す処理をまだ書いていないからです。"; }
    },
    {
      short: "変える", title: "点数を1つ増やしてみよう", goal: "配列 scores に数字を1つ足して、もう一度実行する",
      body: "配列 <code>scores</code> に数字を1つ足して、もう一度実行してみましょう。受講生の数が変わるはずです。",
      anchor: ["const scores"],
      hints: ["配列は `[ ]` の中に、カンマで区切って数字を並べます。", "たとえば `78` のあとに `, 95` と足してから実行します。"],
      why: "データを変えるだけで結果が変わるのが、配列や変数を使う良さです。コードそのものを書き直さずに試せます。",
      check: function(r){ var s = scoresOf(r); return r.ok && !!s && s.join(",") !== "72,85,90,64,78"; },
      clear: function(r){ return "点数が " + scoresOf(r).length + " 人分になりました"; },
      done: function(r){ return "受講生の数が " + scoresOf(r).length + " になりました。データを変えただけで結果が変わりましたね。"; }
    },
    {
      short: "合計", title: "合計を求めよう", goal: "ループの中で total に n を足して、合計を出す",
      body: "<code>for...of</code> は、配列から1つずつ取り出して <code>n</code> に入れてくれます。ループの中で <code>total</code> に <code>n</code> を足していきましょう。",
      anchor: [PLACEHOLDER, "total +=", "total = total", "for ("],
      hints: ["ループの中では、いま取り出した点数が `n` に入っています。", "`total` に `n` を足して戻します。書き方は `total += n;` です。"],
      why: "`total += n` は `total = total + n` を短く書いたものです。ループが回るたびに、いまの合計へ次の点数を足しています。",
      check: function(r){ var s = scoresOf(r); return r.ok && !!s && findLine(r, /^合計:/) === "合計: " + sum(s); },
      clear: function(r){ return "合計 " + sum(scoresOf(r)) + " が出ました"; },
      done: function(){ return "合計が出ました。ループのたびに `total` が増えていく様子を、下の出力に並べておきました。"; },
      trace: true
    },
    {
      short: "平均", title: "平均を出そう", goal: "合計 ÷ 人数 で平均を出し、「平均:」と表示する",
      body: "平均は <b>合計 ÷ 人数</b>。人数は <code>scores.length</code> で分かります。小数第1位までにするなら <code>toFixed(1)</code> を使います。",
      anchor: [STEP4_MARK],
      hints: ["合計は `total`、人数は `scores.length` で取れます。", "`const average = total / scores.length;` のあと、`console.log(\"平均:\", average.toFixed(1));` で表示できます。"],
      why: "`toFixed(1)` は、数を小数第1位までの文字にします。成績表で読みやすい形にそろえるためです。",
      check: function(r){
        var s = scoresOf(r); if (!r.ok || !s || !s.length) return false;
        var v = numAfterColon(findLine(r, /^平均:/));
        return isFinite(v) && Math.abs(v - sum(s) / s.length) <= 0.051;
      },
      clear: function(r){ var s = scoresOf(r); return "平均 " + (sum(s) / s.length).toFixed(1) + " が出ました"; },
      done: function(){ return "平均も出ましたね。`toFixed(1)` で小数第1位までにそろえています。"; }
    },
    {
      short: "最高点", title: "最高点を探そう（チャレンジ）", goal: "いちばん高い点数を「最高点:」と表示する",
      body: "ここは自分で考えてみましょう。詰まったら、右のコーチに聞いてかまいません。",
      anchor: [STEP5_MARK],
      hints: ["配列の最大値は `Math.max(...scores)` で取れます。`...` は配列を1つずつに広げる書き方です。", "ループで書くなら、`best` を最初の点数にして、もっと大きい `n` が来たら入れ替えます。"],
      why: "`Math.max` は、渡された数の中からいちばん大きいものを返します。配列はそのまま渡せないので `...scores` で広げます。",
      check: function(r){ var s = scoresOf(r); return r.ok && !!s && s.length > 0 && findLine(r, /^最高点:/) === "最高点: " + Math.max.apply(null, s); },
      clear: function(r){ return "最高点 " + Math.max.apply(null, scoresOf(r)) + " が出ました"; },
      done: function(){ return "最高点まで出せました。これでレッスンは完了です。"; }
    }
  ];

  /* ゴールの見せ方（2026-09-25）。
     「何をするか」だけでなく「どう出れば合格か」を、いまの点数から計算した実際の出力で見せる。
     説明文を読まなくても、目標の1行と自分の出力を見比べれば進められるようにするため。 */
  var BASE_SCORES = [72, 85, 90, 64, 78];
  function avgText(sc){ return sc.length ? (sum(sc) / sc.length).toFixed(1) : "0"; }
  function maxOf(sc){ return sc.length ? Math.max.apply(null, sc) : 0; }
  var MISSION = [
    { todo: "「実行」を押して、プログラムを動かす", line: 0, prefix: /^受講生の数:/,
      want: function(sc){ return "受講生の数: " + sc.length; },
      cond: function(sc){ return ["出力に", "受講生の数: " + sc.length, "と出れば合格"]; } },
    { todo: "scores の [ ] に点数を1つ足して、もう一度実行する", line: 0, prefix: /^受講生の数:/,
      want: function(){ return "受講生の数: 5 以外の数"; },
      cond: function(){ return ["受講生の数が", "5", "から変われば合格"]; } },
    { todo: "ループの中で、total に n を足していく", line: 1, prefix: /^合計:/,
      want: function(sc){ return "合計: " + sum(sc); },
      cond: function(sc){ return ["出力に", "合計: " + sum(sc), "と出れば合格"]; } },
    { todo: "合計 ÷ 人数 で平均を出して、「平均:」と表示する", line: 2, prefix: /^平均:/,
      want: function(sc){ return "平均: " + avgText(sc); },
      cond: function(sc){ return ["出力に", "平均: " + avgText(sc), "と出れば合格（小数第1位まで）"]; } },
    { todo: "いちばん高い点数を見つけて、「最高点:」と表示する", line: 3, prefix: /^最高点:/,
      want: function(sc){ return "最高点: " + maxOf(sc); },
      cond: function(sc){ return ["出力に", "最高点: " + maxOf(sc), "と出れば合格"]; } }
  ];
  function finalLines(sc){
    return ["受講生の数: " + sc.length, "合計: " + sum(sc), "平均: " + avgText(sc), "最高点: " + maxOf(sc)];
  }
  // 出力の各行が「できた」になるステップ（受講生の数はステップ2まで使う）
  var LINE_DONE_AT = [2, 3, 4, 5];
  /* コードに書いてある配列をそのまま読む。打っている途中でも目標の数字が追いつくように */
  function parseScores(t){
    var m = /const\s+scores\s*=\s*\[([^\]]*)\]/.exec(t || "");
    if (!m) return null;
    var nums = m[1].split(",").map(function(x){ return x.trim(); }).filter(Boolean).map(Number);
    return nums.length && nums.every(function(n){ return isFinite(n); }) ? nums : null;
  }

  /* お手本。いまのコードのどこに何を打つかを返す */
  var REPLAYS = [
    function(){ return { run: true }; },
    function(t){
      var i = t.indexOf("const scores = ["); if (i < 0) return null;
      var j = t.indexOf("]", i); if (j < 0) return null;
      return { at: j, del: 0, ins: ", 95" };
    },
    function(t){
      if (/total\s*\+=|total\s*=\s*total\s*\+/.test(t)) return { already: "for (const n of scores) {\n  total += n;\n}" };
      var i = t.indexOf(PLACEHOLDER);
      if (i >= 0) return { at: i, del: PLACEHOLDER.length, ins: "total += n;" };
      var head = "for (const n of scores) {", k = t.indexOf(head);
      return k < 0 ? null : { at: k + head.length, del: 0, ins: "\n  total += n;" };
    },
    function(t){
      var code = "const average = total / scores.length;\nconsole.log(\"平均:\", average.toFixed(1));";
      if (/\b(const|let|var)\s+average\b/.test(t)) return { already: code };
      var i = t.indexOf(STEP4_MARK);
      return { at: i >= 0 ? i + STEP4_MARK.length : t.replace(/\s*$/, "").length, del: 0, ins: "\n" + code };
    },
    function(t){
      var code = "const best = Math.max(...scores);\nconsole.log(\"最高点:\", best);";
      if (/\b(const|let|var)\s+best\b/.test(t)) return { already: code };
      var i = t.indexOf(STEP5_MARK);
      return { at: i >= 0 ? i + STEP5_MARK.length : t.replace(/\s*$/, "").length, del: 0, ins: "\n" + code };
    }
  ];

  /* =====================================================================
     色付け・実行（画面に依存しない部分）
     ===================================================================== */
  function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  var TOKEN = /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b\d+(?:\.\d+)?\b)|(\b(?:const|let|var|for|of|in|if|else|while|do|return|function|new|true|false|null|undefined|break|continue|typeof)\b)|(\b(?:console|Math)\b)|(\.[A-Za-z_$][\w$]*(?=\s*\())/g;
  function highlight(src){
    var out = "", last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(src))) {
      out += esc(src.slice(last, m.index));
      if (m[1]) out += '<span class="t-c">' + esc(m[0]) + "</span>";
      else if (m[2]) out += '<span class="t-s">' + esc(m[0]) + "</span>";
      else if (m[3]) out += '<span class="t-n">' + esc(m[0]) + "</span>";
      else if (m[4]) out += '<span class="t-k">' + esc(m[0]) + "</span>";
      else if (m[5]) out += '<span class="t-b">' + esc(m[0]) + "</span>";
      else out += '.<span class="t-f">' + esc(m[0].slice(1)) + "</span>";
      last = TOKEN.lastIndex;
      if (!m[0].length) TOKEN.lastIndex++;
    }
    return out + esc(src.slice(last));
  }

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

  var VARS = ["scores", "total", "average", "best"];
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
    var body = instrument(code) + "\n;return {" + VARS.map(function(v){
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

  function fresh(useSaved){
    var sv = useSaved && OPTS.initial ? OPTS.initial : null;
    return {
      step: sv ? Math.min(Math.max(0, sv.step || 0), STEPS.length) : 0, text: sv && sv.code ? sv.code : INITIAL, last: null, errLine: null,
      runs0: sv ? sv.runs || 0 : 0, hints0: sv ? sv.hints || 0 : 0, replays0: sv ? sv.replays || 0 : 0,
      runs: 0, hints: 0, replays: 0, errors: 0,
      hintLevel: [0, 0, 0, 0, 0], collapsed: false, replaying: false, fast: false,
      started: Date.now(), touched: Date.now(), nudged: {}, lastCoach: "", doneAt: null, tab: "out"
    };
  }

  function lineCount(){ return S.text.split("\n").length; }

  function anchorLine(){
    var lines = S.text.split("\n");
    if (S.step >= STEPS.length) return 1;
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
      html = '<div class="pop" id="pop">' +
        '<div class="k">レッスン完了</div><div class="t">お疲れさまでした</div>' +
        '<div class="b">配列・ループ・平均・最大値まで、自分の手で動かしました。本番では、この記録が講師の画面に残り、どのステップでつまずいたかが分かります。</div>' +
        '<div class="sum"><div>かかった時間<b>' + mins + '分</b></div><div>実行した回数<b>' + S.runs + '回</b></div>' +
        '<div>ヒント<b>' + S.hints + '回</b></div><div>お手本<b>' + S.replays + '回</b></div></div>' +
        '<div class="a"><button type="button" class="go" data-go="cleared">コースマップへ（単元クリア）</button><button type="button" data-a="restart">もう一度はじめから</button></div></div>';
    } else if (S.collapsed) {
      html = '<button class="pill" type="button" data-a="open" id="pop">ステップ' + (S.step + 1) + 'の説明を開く</button>';
    } else {
      var st = STEPS[S.step];
      html = '<div class="pop" id="pop" role="note">' +
        '<div class="k">ステップ ' + (S.step + 1) + ' の説明</div>' +
        '<div class="t">' + st.title + '</div><div class="b">' + st.body + '</div>' +
        '<div class="a"><button type="button" class="pri" data-a="ok">分かった</button>' +
        (S.step === 0 ? '<button type="button" data-a="run">実行してみる</button>' : '<button type="button" data-a="demo">お手本を見る</button>') +
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

  function currentScores(){ return parseScores(S.text) || scoresOf(S.last) || BASE_SCORES; }

  var ICON_TODO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>';
  var ICON_PASS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>';

  /* ゴール欄。左に「やること」と「合格の条件」、右に完成したときの出力を出す */
  function renderMission(){
    var sc = currentScores(), done = S.step >= STEPS.length;
    var nowLine = done ? -1 : MISSION[S.step].line;
    var preview = '<div class="preview"><div class="h">完成すると、出力はこうなります</div>' +
      finalLines(sc).map(function(l, i){
        var ok = S.step >= LINE_DONE_AT[i], now = i === nowLine;
        return '<div class="pl' + (ok ? " done" : now ? " now" : "") + '"><span class="ic">' + (ok ? "✓" : now ? "▶" : "・") + "</span>" +
          "<span>" + esc(l) + "</span>" + (now ? '<span class="here">いまここ</span>' : "") + "</div>";
      }).join("") + "</div>";

    var left;
    if (done) {
      left = '<div><div class="ms-head"><span class="ms-step">レッスン完了</span></div>' +
        '<div class="ms-title">4行ぜんぶ出せました</div>' +
        '<div class="ms-rows"><div class="ms-row"><div class="ms-k">' + ICON_TODO + "次にできること</div>" +
        '<div class="ms-v">点数を変えたり、最低点を出してみたり、自由に試してみてください。</div></div></div>' + '<div class="ms-go"><button type="button" data-go="cleared">この単元をクリアにしてコースマップへ</button></div></div>';
    } else {
      var st = STEPS[S.step], ms = MISSION[S.step], c = ms.cond(sc);
      var changed = sc.join(",") !== BASE_SCORES.join(",");
      left = '<div><div class="ms-head"><span class="ms-step">ステップ ' + (S.step + 1) + " / " + STEPS.length + "</span></div>" +
        '<div class="ms-title">' + esc(st.title) + "</div>" +
        '<div class="ms-rows">' +
          '<div class="ms-row"><div class="ms-k">' + ICON_TODO + 'やること</div><div class="ms-v">' + esc(ms.todo) + "</div></div>" +
          '<div class="ms-row"><div class="ms-k">' + ICON_PASS + '合格の条件</div><div class="ms-v pass">' +
            esc(c[0]) + " <code>" + esc(c[1]) + "</code> " + esc(c[2]) +
            (changed && S.step >= 2 ? '<div class="ms-note">あなたが変えた点数（' + sc.length + "人分）で計算しています。</div>" : "") +
          "</div></div>" +
        "</div></div>";
    }
    var el = $("mission");
    el.className = "mission" + (done ? " ms-done" : "");
    el.innerHTML = left + preview;
  }

  /* 合格しなかった実行のあとに、目標といまの出力を並べる */
  function cmpHtml(r){
    if (S.step >= STEPS.length) return "";
    var ms = MISSION[S.step], sc = scoresOf(r) || currentScores();
    var got = findLine(r, ms.prefix);
    return '<div class="cmp"><div class="r"><span class="cl">目標</span><code>' + esc(ms.want(sc)) + "</code></div>" +
      '<div class="r"><span class="cl">いまの出力</span>' + (got ? "<code>" + esc(got) + "</code>" : '<span class="miss">まだ出ていません</span>') + "</div></div>";
  }

  function renderSteps(){
    $("steps").innerHTML = STEPS.map(function(st, i){
      var cls = i < S.step ? "done" : i === S.step ? "now" : "";
      return '<li class="' + cls + '" title="' + st.title + '"><span class="bar"></span><span class="lbl">' + (i + 1) + ". " + st.short + "</span></li>";
    }).join("");
    $("stats").innerHTML = "実行 <b>" + S.runs + "</b> ・ ヒント <b>" + S.hints + "</b> ・ お手本 <b>" + S.replays + "</b>";
    $("btnDemo").disabled = S.step >= STEPS.length || S.replaying;
    $("chipErr").disabled = !(S.last && !S.last.ok);
  }

  function renderOutput(r, extra){
    var pane = $("outPane");
    if (!r) { pane.innerHTML = '<div class="o-empty">「実行」を押すと、ここに結果が出ます。</div>'; return; }
    var h = r.out.map(function(l){ return '<div class="o-line"><span class="g">›</span><span>' + esc(l.s) + "</span></div>"; }).join("");
    if (!r.out.length && r.ok) h = '<div class="o-empty">何も表示されませんでした（console.log がありません）。</div>';
    if (!r.ok) {
      h += '<div class="o-err"><b>エラー</b>' + (r.error.line ? '<span class="at">' + r.error.line + "行目</span>" : "") + esc(r.error.loop ? LOOP_MSG + "（20万回で止めました）" : r.error.message) + "</div>";
    }
    pane.innerHTML = h + (extra || "");
    pane.scrollTop = pane.scrollHeight;
  }

  function renderVars(r){
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
    var r = S.last, t = S.text, i = S.step, s = scoresOf(r);
    if (i === 1 && r && r.ok && s && s.join(",") === "72,85,90,64,78") return "点数はまだ元のままです。`[ ]` の中に数字を1つ足してから実行しましょう。";
    if (i === 2) {
      if (!/total\s*\+=|total\s*=\s*total\s*\+/.test(t)) return "まだ `total` に足す行が見当たりません。";
      if (r && r.ok && s) {
        var got = numAfterColon(findLine(r, /^合計:/)), want = sum(s);
        if (isFinite(got) && got !== want) return "足す行はありますが、合計が " + got + " になっています（正しくは " + want + "）。足す行がループの `{ }` の中にあるか見てみましょう。";
      }
    }
    if (i === 3 && r && r.ok && s && s.length) {
      var line = findLine(r, /^平均:/);
      if (!line) return "「平均:」と表示する行がまだ見当たりません。";
      var v = numAfterColon(line), w = sum(s) / s.length;
      if (isFinite(v) && Math.abs(v - w) > 0.051) return "平均が " + v + " と出ています。正しくは " + w.toFixed(1) + " です。割る数が人数（`scores.length`）になっているか見てみましょう。";
    }
    if (i === 4 && r && r.ok && s && s.length) {
      var l5 = findLine(r, /^最高点:/);
      if (!l5) return "「最高点:」と表示する行がまだ見当たりません。";
      var bv = numAfterColon(l5), bw = Math.max.apply(null, s);
      if (isFinite(bv) && bv !== bw) return "最高点が " + bv + " と出ています。いちばん大きい点数は " + bw + " です。";
    }
    return "";
  }

  function giveHint(){
    if (S.step >= STEPS.length) { pushCoach("レッスンは完了しています。数字を変えたり、最低点を出してみたり、自由に試してみてください。", { force: true }); return; }
    var st = STEPS[S.step], lv = S.hintLevel[S.step];
    S.hints++; S.hintLevel[S.step]++;
    var pre = situational();
    if (lv >= 2) {
      pushCoach((pre ? pre + " " : "") + "ここまで来たら、お手本を見てしまうのも手です。「お手本を見る」で、実際に打ってみせます。", { force: true });
    } else {
      pushCoach((pre ? pre + " " : "") + st.hints[lv], { force: true });
    }
    renderSteps();
  }

  function answer(q){
    var st = STEPS[Math.min(S.step, STEPS.length - 1)];
    if (/エラー|動かない|だめ|ダメ|おかしい/.test(q)) {
      if (S.last && !S.last.ok) return explainError(S.last.error);
      return "いまはエラーは出ていません。思ったとおりにならないところを、もう少し教えてください。";
    }
    if (/ヒント|わから|分から|詰ま|つま/.test(q)) { giveHint(); return null; }
    if (/お手本|答え|見せて/.test(q)) { replay(); return null; }
    if (/なぜ|どうして|意味|理由/.test(q)) return st.why;
    if (/for|ループ|繰り返/.test(q)) return "`for (const n of scores) { ... }` は、`scores` の中身を先頭から1つずつ `n` に入れて、`{ }` の中を繰り返します。5人分なら5回まわります。";
    if (/配列|\[/.test(q)) return "配列は、値を順番に並べて1つにまとめたものです。`scores[0]` で1番目、`scores.length` で個数が取れます。";
    if (/平均|toFixed/.test(q)) return STEPS[3].why;
    if (/const|let/.test(q)) return "`const` はあとから入れ替えない値、`let` はあとで入れ替える値に使います。合計はループで増えていくので `let` です。";
    if (/console|log/.test(q)) return STEPS[0].why;
    if (S.step >= STEPS.length) return "レッスンは完了しています。気になったことは何でも試してみてください。";
    return "いまは「" + st.title + "」のステップです。" + st.hints[0];
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
    else if (q === "why") { pushMe("なぜこう書くの？"); pushCoach(STEPS[Math.min(S.step, STEPS.length - 1)].why, { force: true }); }
    else if (q === "demo") { pushMe("お手本を見せて"); replay(); }
  }

  /* ---- 実行 ---- */
  function ensureMark(mark){
    if (S.text.indexOf(mark) >= 0) return;
    S.text = S.text.replace(/\s*$/, "") + "\n\n" + mark + "\n";
    ta.value = S.text;
  }

  function traceHtml(s){
    var run = 0;
    return '<div class="trace">ループの中で起きたこと（n を足すたびに total が増える）<div class="row">' +
      s.map(function(n){ run += Number(n) || 0; return '<span class="c">+' + esc(n) + " → <span>" + run + "</span></span>"; }).join("") +
      "</div></div>";
  }

  function run(){
    if (S.replaying) return;
    var r = execute(S.text);
    S.runs++; S.last = r; S.touched = Date.now();
    S.errLine = (!r.ok && r.error.line && r.error.line <= lineCount()) ? r.error.line : null;
    if (!r.ok) S.errors++;
    renderVars(r);

    var extra = "", advanced = false;
    if (r.ok) {
      while (S.step < STEPS.length && STEPS[S.step].check(r)) {
        var st = STEPS[S.step];
        extra += '<div class="o-ok"><b>ステップ' + (S.step + 1) + ' クリア</b>' + esc(st.clear(r)) + "</div>";
        if (st.trace) extra += traceHtml(scoresOf(r));
        pushCoach(st.done(r), { force: true });
        S.step++; advanced = true;
        if (S.step === 3) ensureMark(STEP4_MARK);
        if (S.step === 4) ensureMark(STEP5_MARK);
      }
      // 合格しなかったときは、目標の1行といまの出力を並べて見せる
      if (!advanced) extra += cmpHtml(r);
    }
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
    if (S.replaying) return;
    if (S.step >= STEPS.length) { pushCoach("レッスンは完了しています。", { force: true }); return; }
    var plan = REPLAYS[S.step](S.text);
    S.replays++;
    if (!plan) { pushCoach("お手本を入れる場所が見つかりませんでした。「最初から」で元の形に戻せます。", { force: true }); renderSteps(); return; }
    if (plan.run) {
      var btn = $("btnRun"); btn.classList.remove("flash"); void btn.offsetWidth; btn.classList.add("flash");
      pushCoach("お手本では、ここで「実行」を押します。見ていてください。", { force: true });
      setTimeout(run, REDUCED ? 0 : 900);
      renderSteps();
      return;
    }
    if (plan.already) {
      pushCoach("もう書き始めていますね。お手本の書き方はこうです。見比べてみてください。", { code: plan.already, force: true });
      renderSteps();
      return;
    }
    var before = S.text.slice(0, plan.at), after = S.text.slice(plan.at + plan.del), ins = plan.ins, i = 0;
    S.replaying = true; ta.readOnly = true; $("replayBar").hidden = false;
    pushCoach("お手本を打ちます。手元の動きを見ていてください。", { force: true });
    S.finishReplay = function(){ S.text = before + ins + after; ta.value = S.text; };
    function tick(){
      if (!S.replaying) return;
      i = REDUCED ? ins.length : Math.min(ins.length, i + 1);
      S.text = before + ins.slice(0, i) + after; ta.value = S.text;
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
    S.text = ta.value; S.errLine = null; S.touched = Date.now();
    changed();
    renderCode(); renderPopup(); renderMission();
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
    ta.value = S.text; ta.scrollTop = 0;
    $("msgs").innerHTML = "";
    renderOutput(null); renderVars(null); setTab("out");
    renderAll();
    if (useSaved && S.step >= STEPS.length) pushCoach("この単元はクリア済みです。数字を変えたり、最低点を出してみたり、自由に試してみてください。", { force: true });
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
  };
}
