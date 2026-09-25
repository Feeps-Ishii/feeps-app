/* 自動生成（docs/design/mockups/tenolab-2026-09/src/gen_tenolab.py）で、モックから移植した。以後はこのファイルを直接直す。 */
/* コースと作品の小さな画面。画像ではなく、その場で組み立てた画面そのもの（中身は固定の文字列） */
  function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var BAR = '<div class="th-bar"><i></i><i></i><i></i><span>';
  function frame(path, inner){ return '<div class="thumb" aria-hidden="true">' + BAR + path + "</span></div>" + inner + "</div>"; }
export const THUMBS = {
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

