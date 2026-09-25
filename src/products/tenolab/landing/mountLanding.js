/* 自動生成（docs/design/mockups/tenolab-2026-09/src/gen_tenolab.py）で、モックから移植した。以後はこのファイルを直接直す。 */
export function mountLanding(root, OPTS) {
  "use strict";
  OPTS = OPTS || {};

  var $ = function(id){ return document.getElementById(id); };
  function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  /* ---------- ヒーローの体験 ----------
     コードの形は決め打ちにして、配列の数字だけを読む。
     知らない人の手元でコードを実行しないので安全で、どこでも同じように動く */
  var NAMES = ["Aさん", "Bさん", "Cさん", "Dさん", "Eさん", "Fさん"];
  var GOAL = 85;
  var tried = false;
  function readScores(src){
    var m = /const\s+scores\s*=\s*\[([^\]]*)\]/.exec(src);
    if (!m) return { err: "「const scores = [ ... ]」の形がくずれています。[ ] の閉じ忘れがないか見てみよう。" };
    var parts = m[1].split(",").map(function(x){ return x.trim(); }).filter(Boolean);
    if (!parts.length) return { err: "[ ] の中に点数がありません。数字をカンマで区切って入れてみよう。" };
    if (parts.length > 6) return { err: "このミニ版では6人までにしています。" };
    var nums = parts.map(Number);
    if (nums.some(function(n){ return !Number.isFinite(n); })) return { err: "数字でないものが入っています。点数は数字で書こう。" };
    if (nums.some(function(n){ return n < 0 || n > 100; })) return { err: "点数は0〜100にしよう。" };
    return { nums: nums };
  }
  function runDemo(){
    var r = readScores($("code").value);
    var bars = $("bars"), err = $("pvErr"), st = $("goalSt"), avg = $("avg");
    if (r.err) {
      err.innerHTML = '<div class="pv-err">' + esc(r.err) + "</div>";
      st.textContent = "まだ"; st.className = "st"; return;
    }
    err.innerHTML = "";
    bars.innerHTML = r.nums.map(function(n, i){
      return '<div class="bar"><span>' + NAMES[i] + '</span><span class="tr"><i data-w="' + n + '"></i></span><span class="v">' + n + "</span></div>";
    }).join("");
    requestAnimationFrame(function(){
      Array.prototype.forEach.call(bars.querySelectorAll("i[data-w]"), function(el){ el.style.width = el.getAttribute("data-w") + "%"; });
    });
    var a = r.nums.reduce(function(s, n){ return s + n; }, 0) / r.nums.length;
    avg.textContent = a.toFixed(1);
    var ok = a >= GOAL;
    st.textContent = ok ? "クリア！" : "あと " + (GOAL - a).toFixed(1) + "点";
    st.className = "st" + (ok ? " ok" : "");
    if (tried) {
      $("bubble").innerHTML = ok
        ? "<b>できました</b>コードを変えたら、画面が変わりました。これがテノラボの学び方です。"
        : "<b>もう少し</b>平均が " + a.toFixed(1) + " です。低い点数を上げてみよう。";
    }
    tried = true;
  }
  $("run").addEventListener("click", runDemo);
  $("code").addEventListener("keydown", function(e){
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runDemo(); }
  });
  runDemo();

  /* ---------- アプリの小さな画面（画像の代わりに、その場で組む） ---------- */
  var BAR = '<div class="th-bar"><i></i><i></i><i></i><span>';
  function frame(path, inner){ return '<div class="thumb" aria-hidden="true">' + BAR + path + "</span></div>" + inner + "</div>"; }
  var THUMBS = {
    dash: function(){
      return frame("score-dashboard", '<div class="th-title">点数ダッシュボード</div>' +
        '<div class="th-row">' + [["受講生", 5], ["合計", 389], ["平均", 77.8], ["最高点", 90]].map(function(s){
          return '<div class="th-stat"><small>' + s[0] + "</small><b>" + s[1] + "</b></div>"; }).join("") + "</div>" +
        '<div class="th-bars">' + [72, 85, 90, 64, 78].map(function(n){ return '<i style="width:' + n + '%"></i>'; }).join("") + "</div>");
    },
    nippo: function(){
      return frame("daily-report", '<div class="th-title">日報</div><div class="th-list">' +
        [["9/22", "APIの設計を読んだ"], ["9/23", "テーブルを2つ作った"], ["9/24", "画面から保存できた"]].map(function(x){
          return '<div class="th-li"><span class="d">' + x[0] + "</span><span>" + x[1] + "</span></div>"; }).join("") + "</div>");
    },
    todo: function(){
      return frame("todo", '<div class="th-title">今日のやること</div><div class="th-list">' +
        [["資料を読む", 1], ["環境を確認する", 1], ["課題を提出する", 0], ["日報を書く", 0]].map(function(x){
          return '<div class="th-li' + (x[1] ? " done" : "") + '"><span class="cb' + (x[1] ? " on" : "") + '"></span><span>' + x[0] + "</span></div>"; }).join("") + "</div>");
    },
    quiz: function(){
      return frame("quiz", '<div class="th-q">Q3. 配列の個数を返すのはどれ？</div><div class="th-ch">' +
        ["size()", "length", "count", "total"].map(function(x){ return "<span" + (x === "length" ? ' class="ok"' : "") + ">" + x + "</span>"; }).join("") + "</div>");
    },
    java: function(){
      return frame("GradeTool.java", '<div class="th-term"><span class="p">$ java GradeTool</span><br>読み込み: 5人<br>平均: <span class="o">77.8</span><br>最高点: <span class="o">90</span>（高橋）<br>評価: <span class="o">B</span></div>');
    },
    aws: function(){
      return frame("deploy", '<div class="th-title">作ったアプリを公開する</div><div class="th-flow">' +
        '<div class="th-node">あなたのアプリ<small>index.html</small></div><span class="th-arrow"></span>' +
        '<div class="th-node">AWS<small>S3 + CloudFront</small></div></div><span class="th-live">公開中 https://…</span>');
    },
    stock: function(){
      return frame("stock-checker", '<div class="th-title">在庫チェッカー</div><div class="th-list">' +
        [["ノート", 42, 0], ["ボールペン", 3, 1], ["付箋", 18, 0], ["クリップ", 2, 1]].map(function(x){
          return '<div class="th-li"><span>' + x[0] + '</span><span style="margin-left:auto;font-variant-numeric:tabular-nums">' + x[1] + "個</span>" + (x[2] ? '<span class="red">残りわずか</span>' : "") + "</div>"; }).join("") + "</div>");
    },
    weather: function(){
      return frame("weather-board", '<div class="th-title">週間の天気（APIから取得）</div><div class="th-days">' +
        [["月", 24, 1], ["火", 22, 0], ["水", 19, 0], ["木", 23, 1], ["金", 25, 1]].map(function(x){
          return '<div class="th-day">' + x[0] + '<span class="' + (x[2] ? "sun" : "cld") + '"></span><b>' + x[1] + "°</b></div>"; }).join("") + "</div>");
    },
    attend: function(){
      var cells = "";
      for (var i = 0; i < 28; i++) cells += '<i class="' + (i % 7 > 4 ? "" : i === 10 || i === 18 ? "l" : "w") + '"></i>';
      return frame("attendance", '<div class="th-title">勤怠ログ（9月）</div><div class="th-cal">' + cells + "</div>");
    }
  };

  var COURSE_LINK = "https://claude.ai/artifact/ExC8bx8tAQvgfFEonnfm9A";
  var COURSES = [
    { id: "dash", t: "点数ダッシュボードを作ろう", lv: 1, lang: "Web", units: 13, h: 5, d: "配列・関数・画面づくり・グラフまで。最初の1本に。", link: COURSE_LINK },
    { id: "quiz", t: "クイズアプリを作ろう", lv: 1, lang: "Web", units: 8, h: 3, d: "問題を出して、答えを判定して、点数を出す。条件分岐が身につきます。" },
    { id: "nippo", t: "日報アプリを作ろう", lv: 2, lang: "Web", units: 12, h: 5, d: "書いて、保存して、あとから見返す。データの保存と一覧表示を学びます。" },
    { id: "todo", t: "ToDoアプリで学ぶ更新と削除", lv: 2, lang: "Web", units: 10, h: 4, d: "追加・完了・削除。アプリの基本の動きをひと通り作ります。" },
    { id: "java", t: "Javaで成績計算ツール", lv: 2, lang: "Java", units: 12, h: 5, d: "ファイルを読み込んで集計し、評価をつける。クラスの使い方まで。" },
    { id: "aws", t: "作ったアプリをAWSで公開", lv: 3, lang: "AWS", units: 9, h: 4, d: "自分のアプリを世界に出す。S3とCloudFrontで公開するまで。" }
  ];
  var LV = { 1: ["lv1", "はじめて"], 2: ["lv2", "基礎"], 3: ["lv3", "実務"] };

  var SHOW = [
    ["dash", "点数ダッシュボード", "13単元 ・ はじめて"], ["nippo", "日報アプリ", "12単元 ・ 基礎"], ["todo", "ToDoアプリ", "10単元 ・ 基礎"],
    ["quiz", "クイズアプリ", "8単元 ・ はじめて"], ["java", "成績計算ツール（Java）", "12単元 ・ 基礎"], ["stock", "在庫チェッカー", "11単元 ・ 実務"],
    ["weather", "天気ボード（API）", "9単元 ・ 実務"], ["attend", "勤怠ログ", "10単元 ・ 基礎"], ["aws", "AWSで公開", "9単元 ・ 実務"]
  ];
  function showCard(s, hidden){
    return '<a class="app-card" href="#courses"' + (hidden ? ' tabindex="-1" aria-hidden="true"' : "") + ">" + THUMBS[s[0]]() +
      '<div class="cap"><b>' + esc(s[1]) + "</b><span>" + esc(s[2]) + "</span></div></a>";
  }
  // 同じ並びを2周ぶん置いて、つなぎ目なく流す（2周目は読み上げ・タブ移動から外す）
  $("marq").innerHTML = SHOW.map(function(s){ return showCard(s, false); }).join("") + SHOW.map(function(s){ return showCard(s, true); }).join("");

  var filter = "all";
  function renderCourses(){
    var list = COURSES.filter(function(c){
      if (filter === "all") return true;
      if (filter === "lv1") return c.lv === 1;
      return c.lang === filter;
    });
    $("courseGrid").innerHTML = list.map(function(c){
      var lv = LV[c.lv];
      var tag = c.link ? "a" : "div";
      var attrs = c.link ? ' href="#" data-go="course:dash"' : "";
      return "<" + tag + ' class="course"' + attrs + ">" + THUMBS[c.id]() +
        '<div class="c-body"><div class="c-tags"><span class="tag ' + lv[0] + '">' + lv[1] + '</span><span class="tag lang">' + c.lang + "</span></div>" +
        "<h3>" + esc(c.t) + "</h3><p>" + esc(c.d) + "</p>" +
        '<div class="c-meta"><span><b>' + c.units + "</b> 単元</span><span>約 <b>" + c.h + "</b> 時間</span>" +
        (c.link ? '<span class="c-open">単元の一覧を見る →</span>' : "") + "</div></div></" + tag + ">";
    }).join("");
  }
  $("filters").addEventListener("click", function(e){
    var b = e.target.closest("[data-f]"); if (!b) return;
    filter = b.getAttribute("data-f");
    Array.prototype.forEach.call(this.querySelectorAll("[data-f]"), function(x){ x.setAttribute("aria-pressed", String(x === b)); });
    renderCourses();
  });
  renderCourses();

  /* ---------- 研修担当の画面（例） ---------- */
  var PEOPLE = [
    ["佐藤", "ooooooohn"], ["鈴木", "oooohoooon"], ["高橋", "oooooooooon"],
    ["田中", "oooos"], ["伊藤", "ooohohon"]
  ];
  var cols = 10, head = "<tr><th class=\"nm\">名前</th>";
  for (var u = 1; u <= cols; u++) head += "<th>" + u + "</th>";
  head += "</tr>";
  var body = PEOPLE.map(function(p){
    var row = '<tr><td class="nm">' + p[0] + "</td>";
    for (var i = 0; i < cols; i++) {
      var ch = p[1][i] || "-";
      var cls = ch === "o" ? "c-ok" : ch === "h" ? "c-hint" : ch === "s" ? "c-stuck" : ch === "n" ? "c-now" : "c-no";
      var label = ch === "o" ? "クリア" : ch === "h" ? "ヒント多め" : ch === "s" ? "止まっている" : ch === "n" ? "いまここ" : "未着手";
      row += '<td class="c ' + cls + '" title="単元' + (i + 1) + "：" + label + '"></td>';
    }
    return row + "</tr>";
  }).join("");
  $("heat").innerHTML = "<caption style=\"position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)\">受講生ごとの単元の進み具合</caption><thead>" + head + "</thead><tbody>" + body + "</tbody>";

  /* ---------- 相談ボタン ---------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-consult]"), function(b){
    b.addEventListener("click", function(){
      var c = $("consult"); c.hidden = false;
      c.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    });
  });
  if (OPTS.loggedIn) {
    var nl = document.getElementById("navLogin");
    if (nl) { nl.textContent = "ホームへ"; nl.setAttribute("data-go", "home"); }
  }
  return function destroy(){};
}
