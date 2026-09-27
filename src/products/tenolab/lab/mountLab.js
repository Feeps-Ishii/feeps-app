/* 体験ラボのエンジン。モック（docs/design/mockups/tenolab-2026-09）から移植し、2026-09-27に単元データ（OPTS.unit）で動くよう書き換えた。
   OPTS.unit … 単元（API /tenolab/courses/{c}/units/{u} の unit と同じ形）
   OPTS.meta … 見出し用 { courseId, courseTitle, unitNo, unitTotal, chapter }
   OPTS.preview … 講師の「受講生として試す」。保存の印を出さない */
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
     レッスンの中身は単元データ（OPTS.unit）から読む（単元づくり、2026-09-27〜）
     ===================================================================== */
  var U = OPTS.unit;
  var STEPS = U.steps || [];
  var INITIAL = (U.files && U.files.start) || "";
  var ANSWER = (U.files && U.files.answer) || "";
  var DATA = U.dataVar || "";
  var META = OPTS.meta || {};

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

  function passes(i, r){
    if (!r.ok) return false;
    var c = STEPS[i].check, lines = outLines(r);
    if (c.kind === "answerLine") {
      var want = stepWant(i, dataOf(r) || BASE_DATA);
      return !!want && sameLine(findPrefix(lines, c.prefix), want, c.prefix);
    }
    if (c.kind === "line") return c.value.split("\n").filter(Boolean).every(function(l){ return lines.indexOf(l) >= 0; });
    if (c.kind === "change") { var d = dataOf(r); return !!d && !sameData(d, BASE_DATA); }
    if (c.kind === "code") return c.value.split("\n").filter(Boolean).every(function(l){ return S.text.indexOf(l) >= 0; });
    return false;
  }

  function clearText(i, r){
    var c = STEPS[i].check;
    if (c.kind === "answerLine") return findPrefix(outLines(r), c.prefix) || "";
    if (c.kind === "line") return c.value.split("\n")[0];
    if (c.kind === "change") return DATA + " = " + fmt(dataOf(r), true);
    return c.value.split("\n")[0];
  }

  /* 合格の条件を [前, 印, 後] で返す（印はコードの見た目で出す） */
  function condParts(i, data){
    var c = STEPS[i].check;
    if (c.kind === "change") return ["", DATA, "の中身が変われば合格"];
    if (c.kind === "code") return ["コードに", c.value.split("\n")[0], "があれば合格"];
    return ["出力に", stepWant(i, data) || "", "と出れば合格"];
  }

  /* 完成の出力のうち、ステップ i が目指している行の番号 */
  function lineOfStep(i, lines){
    var p = stepPrefix(i);
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
    return { at: m >= 0 ? m + mark.length : t.replace(/\s*$/, "").length, del: 0, ins: "\n" + d.text };
  }
  function hasDemo(i){ var d = STEPS[i] && STEPS[i].demo; return !!d && (d.mode === "run" || (d.mode !== "none" && !!d.text)); }

  /* =====================================================================
     色付け・実行（画面に依存しない部分）
     ===================================================================== */
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
    set(".ide-bar .file", U.fileName || "main.js");
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

  function fresh(useSaved){
    var sv = useSaved && OPTS.initial ? OPTS.initial : null;
    return {
      step: sv ? Math.min(Math.max(0, sv.step || 0), STEPS.length) : 0, text: sv && sv.code ? sv.code : INITIAL, last: null, errLine: null,
      runs0: sv ? sv.runs || 0 : 0, hints0: sv ? sv.hints || 0 : 0, replays0: sv ? sv.replays || 0 : 0,
      runs: 0, hints: 0, replays: 0, errors: 0,
      hintLevel: STEPS.map(function(){ return 0; }), collapsed: false, replaying: false, fast: false,
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
      var skills = (U.skills || []).map(function(k, i){ return "<li" + (i === 0 ? ' class="m"' : "") + ">" + esc(k) + "</li>"; }).join("");
      html = '<div class="pop" id="pop">' +
        '<div class="k">レッスン完了</div><div class="t">お疲れさまでした</div>' +
        (skills ? '<ul class="kw sm">' + skills + "</ul>" : "") +
        '<div class="sum"><div>かかった時間<b>' + mins + '分</b></div><div>実行した回数<b>' + S.runs + '回</b></div>' +
        '<div>ヒント<b>' + S.hints + '回</b></div><div>お手本<b>' + S.replays + '回</b></div></div>' +
        '<div class="a"><button type="button" class="go" data-go="cleared">' + (OPTS.preview ? "単元づくりへ戻る" : "コースマップへ（単元クリア）") + '</button><button type="button" data-a="restart">もう一度はじめから</button></div></div>';
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

  function currentData(){ return parseData(S.text) || dataOf(S.last) || BASE_DATA; }

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
    el.innerHTML = left + preview;
  }

  /* 合格しなかった実行のあとに、目標といまの出力を並べる（出力で判定するステップだけ） */
  function cmpHtml(r){
    if (S.step >= STEPS.length) return "";
    var want = stepWant(S.step, dataOf(r) || currentData());
    if (!want) return "";
    var p = stepPrefix(S.step), lines = outLines(r);
    var got = p ? findPrefix(lines, p) : (lines.indexOf(want) >= 0 ? want : null);
    return '<div class="cmp"><div class="r"><span class="cl">目標</span><code>' + esc(want) + "</code></div>" +
      '<div class="r"><span class="cl">いまの出力</span>' + (got ? "<code>" + esc(got) + "</code>" : '<span class="miss">まだ出ていません</span>') + "</div></div>";
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
    var r = S.last, i = S.step;
    if (i >= STEPS.length || !r || !r.ok) return "";
    var c = STEPS[i].check;
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
  function ensureMark(mark){
    if (S.text.indexOf(mark) >= 0) return;
    S.text = S.text.replace(/\s*$/, "") + "\n\n" + mark + "\n";
    ta.value = S.text;
  }

  // ステップに入ったとき、目印の行（例「// ステップ4：…」）がなければ足す
  function enterStep(){
    var st = STEPS[S.step];
    if (st && st.appendOnStart) ensureMark(st.appendOnStart);
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
      while (S.step < STEPS.length && passes(S.step, r)) {
        var st = STEPS[S.step];
        extra += '<div class="o-ok"><b>ステップ' + (S.step + 1) + ' クリア</b>' + esc(clearText(S.step, r)) + "</div>";
        if (st.done) pushCoach(st.done, { force: true });
        S.step++; advanced = true;
        enterStep();
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
    if (!hasDemo(S.step)) { pushCoach("このステップにはお手本がありません。ヒントを使ってみてください。", { force: true }); return; }
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
    enterStep();
    ta.value = S.text; ta.scrollTop = 0;
    $("msgs").innerHTML = "";
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
  };
}
