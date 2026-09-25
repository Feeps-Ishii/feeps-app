/* 自動生成（docs/design/mockups/tenolab-2026-09/src/gen_tenolab.py）で、モックから移植した。以後はこのファイルを直接直す。 */
export function mountCourseMap(root, OPTS) {
  "use strict";
  OPTS = OPTS || {};

  var $ = function(id){ return document.getElementById(id); };
    var TRY_UNIT = 2;   // モックで実際に体験できる単元（体験ラボのモックにつながる）

  var CHAPTERS = [
    { no: 1, title: "データを扱う", sub: "JavaScript", units: [1, 2, 3, 4] },
    { no: 2, title: "画面を作る", sub: "HTML・CSS", units: [5, 6, 7, 8] },
    { no: 3, title: "動きをつける", sub: "イベント", units: [9, 10, 11] },
    { no: 4, title: "仕上げる", sub: "グラフ・保存", units: [12, 13] }
  ];
  var UNITS = {
    1:  { t: "変数と表示", min: 10, adds: "コンソールに点数が出る", steps: ["変数に点数を入れる", "console.log で表示する", "値を変えて、もう一度動かす"] },
    2:  { t: "配列で点数をまとめる", min: 20, adds: "人数・合計・平均・最高点が出る", steps: ["お手本を動かす", "点数を1つ増やす", "合計を求める", "平均を出す", "最高点を探す"] },
    3:  { t: "関数にまとめる", min: 20, adds: "計算を何度でも使い回せる", steps: ["合計を返す関数を作る", "平均を返す関数を作る", "同じ関数を別の点数で使う"] },
    4:  { t: "オブジェクトで受講生を表す", min: 20, adds: "名前と点数がセットになる", steps: ["名前と点数を1つにまとめる", "受講生を配列に並べる", "名前つきで表示する"] },
    5:  { t: "画面の骨組み", min: 15, adds: "アプリの画面ができる", steps: ["HTMLでタイトルを出す", "中身の枠を分ける", "ブラウザで開いて確かめる"] },
    6:  { t: "数字をカードで見せる", min: 20, adds: "4つの数字がカードで並ぶ", steps: ["要素をJavaScriptで作る", "単元2の数字を入れる", "カードを4枚並べる"] },
    7:  { t: "表で一覧にする", min: 25, adds: "受講生の表が出る", steps: ["表の見出しを作る", "ループで行を足す", "受講生の数だけ行が出るか確かめる"] },
    8:  { t: "見た目を整える", min: 25, adds: "見た目が整う", steps: ["色と余白を決める", "カードと表を読みやすくする", "文字の大きさをそろえる"] },
    9:  { t: "ボタンで並べ替える", min: 20, adds: "表を並べ替えられる", steps: ["ボタンを置く", "押したら並べ替える", "表を描き直す"] },
    10: { t: "フォームで点数を足す", min: 25, adds: "点数を追加できる", steps: ["入力欄を置く", "追加ボタンで配列に足す", "カードと表も一緒に更新する"] },
    11: { t: "条件で絞り込む", min: 20, adds: "条件に合う人だけ出せる", steps: ["選択肢を置く", "条件に合う人だけ残す", "カードの数字も合わせる"] },
    12: { t: "グラフで見せる", min: 30, adds: "点数がグラフになる", steps: ["点数で棒の長さを決める", "名前と数字をそえる", "データが変わったら描き直す"] },
    13: { t: "ブラウザに保存する", min: 20, adds: "閉じても残る", steps: ["localStorage に保存する", "開き直しても残るか確かめる", "消すボタンを作る"] }
  };
  var TOTAL = 13;
  // アプリの部品が、どの単元で生まれるか
  var PART_UNIT = { header: 5, cards: 6, table: 7, sort: 9, form: 10, filter: 11, chart: 12, save: 13 };

  var BASE = [
    { name: "佐藤", score: 72 }, { name: "鈴木", score: 85 }, { name: "高橋", score: 90 },
    { name: "田中", score: 64 }, { name: "伊藤", score: 78 }
  ];

  var S = { done: 1, open: 2, sort: "none", filter: "all", rows: BASE.slice(), added: {}, formErr: "" };

  function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function has(u){ return S.done >= u; }
  function stateOf(u){ return u <= S.done ? "done" : u === S.done + 1 ? "now" : "lock"; }

  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  var ICON_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0l10 6-10 6z" fill="currentColor"/></svg>';

  /* ---------- 上段の要約 ---------- */
  function renderSummary(){
    var left = 0;
    for (var u = S.done + 1; u <= TOTAL; u++) left += UNITS[u].min;
    var next = S.done < TOTAL ? S.done + 1 : null;
    var h = Math.floor(left / 60), m = left % 60;
    var cta;
    if (!next) cta = '<span class="cta" aria-disabled="true">全単元クリア</span>';
    else if (next === TRY_UNIT) cta = '<a class="cta" href="#" data-go="unit:dash:u2">' + ICON_PLAY + '続きから始める</a>';
    else cta = '<span class="cta" aria-disabled="true" title="この単元はいま準備中です">' + ICON_PLAY + '続きから始める</span>';
    $("summary").innerHTML =
      '<div><div class="sm-k">進み具合</div><div class="sm-v num">' + S.done + ' <small>/ ' + TOTAL + ' 単元</small></div>' +
        '<div class="prog"><i style="width:' + (S.done / TOTAL * 100).toFixed(1) + '%"></i></div></div>' +
      '<div><div class="sm-k">残り</div><div class="sm-v num">' + (left ? (h ? h + "時間" : "") + (m ? m + "分" : "") : "0分") + '</div></div>' +
      '<div><div class="sm-k">次の単元</div><div class="sm-v" style="font-size:14px">' + (next ? next + ". " + esc(UNITS[next].t) : "なし") + '</div></div>' +
      cta;
  }

  /* ---------- 左：単元の道のり ---------- */
  function renderChapters(){
    $("chapters").innerHTML = CHAPTERS.map(function(c){
      var doneIn = c.units.filter(function(u){ return u <= S.done; }).length;
      return '<section class="chap"><div class="chap-h"><span class="chap-no">第' + c.no + '章</span><h2>' + esc(c.title) + '</h2>' +
        '<span class="chap-sub">' + esc(c.sub) + '</span><span class="chap-p num">' + doneIn + ' / ' + c.units.length + '</span></div>' +
        '<ol class="units">' + c.units.map(unitHtml).join("") + '</ol></section>';
    }).join("");
  }

  function unitHtml(u){
    var d = UNITS[u], st = stateOf(u), open = S.open === u;
    var node = st === "done" ? ICON_CHECK : st === "lock" ? ICON_LOCK : String(u);
    var tags = (st === "now" ? '<span class="tag now">いまここ</span>' : "") + (u === TRY_UNIT ? '<span class="tag try">体験できます</span>' : "");
    var detail = "";
    if (open) {
      var cta;
      if (u === TRY_UNIT && st !== "lock") {
        cta = '<a class="cta" href="#" data-go="unit:dash:u2">' + ICON_PLAY + (st === "done" ? "もう一度やる" : "はじめる") + '</a>';
      } else if (st === "lock") {
        cta = '<span class="note">単元' + (u - 1) + '「' + esc(UNITS[u - 1].t) + '」を終えると開きます。</span>';
      } else {
        cta = '<span class="cta" aria-disabled="true">' + ICON_PLAY + (st === "done" ? "もう一度やる" : "はじめる") + '</span><span class="note">この単元はいま準備中です。</span>';
      }
      detail = '<div class="u-detail" id="ud-' + u + '">' +
        '<h3>この単元でやること</h3><ol>' + d.steps.map(function(s){ return "<li>" + esc(s) + "</li>"; }).join("") + '</ol>' +
        '<h3>アプリに加わるもの</h3><p>' + esc(d.adds) + (partOfUnit(u) ? "（右のアプリで光っている部分）" : "（右下のコンソールに出ます）") + '</p>' +
        '<div class="u-cta">' + cta + '</div></div>';
    }
    return '<li class="unit ' + st + (open ? " open" : "") + '" data-unit="' + u + '">' +
      '<button type="button" class="u-row" aria-expanded="' + open + '"' + (open ? ' aria-controls="ud-' + u + '"' : "") + '>' +
        '<span class="node">' + node + '</span>' +
        '<span><span class="u-t">' + u + ". " + esc(d.t) + '</span><span class="u-s">アプリに加わる：<b>' + esc(d.adds) + '</b></span></span>' +
        '<span class="u-r"><span class="u-min num">約' + d.min + '分</span>' + tags + '</span>' +
      '</button>' + detail + '</li>';
  }

  function partOfUnit(u){
    for (var k in PART_UNIT) if (PART_UNIT[k] === u) return k;
    return u === 8 ? "style" : null;
  }

  /* ---------- 右：受講生のアプリ ---------- */
  function visibleRows(){
    var rows = S.rows.slice();
    if (has(11)) {
      if (S.filter === "80") rows = rows.filter(function(r){ return r.score >= 80; });
      if (S.filter === "70") rows = rows.filter(function(r){ return r.score < 70; });
    }
    if (has(9)) {
      if (S.sort === "score") rows.sort(function(a, b){ return b.score - a.score; });
      if (S.sort === "name") rows.sort(function(a, b){ return a.name.localeCompare(b.name, "ja"); });
    }
    return rows;
  }
  function stats(rows){
    var n = rows.length, sum = rows.reduce(function(s, r){ return s + r.score; }, 0);
    return { n: n, sum: sum, avg: n ? (sum / n).toFixed(1) : "—", max: n ? Math.max.apply(null, rows.map(function(r){ return r.score; })) : "—" };
  }
  function ph(u){
    return '<div class="ph" data-unit="' + u + '" role="button" tabindex="0"><span>単元' + u + 'で作ります</span><b>' + esc(UNITS[u].t) + '</b></div>';
  }

  function renderApp(){
    var app = $("app");
    app.className = "app" + (has(5) && !has(8) ? " raw" : "");
    $("appNote").textContent = !has(5) ? "画面は第2章で作ります"
      : !has(8) ? "単元8までは、ブラウザ任せの素の見た目です"
      : S.done >= TOTAL ? "完成しました。実際に触れます" : "できた部分は、実際に触れます";

    if (!has(5)) {
      app.innerHTML = '<div class="empty-app ph" data-unit="5" role="button" tabindex="0"><div><b>まだ画面はありません</b>' +
        '第1章ではコンソールでデータを扱います。画面は単元5「画面の骨組み」から作りはじめます。</div></div>';
      return;
    }
    var rows = visibleRows(), st = stats(rows);
    var html = '<div class="stack">';

    html += '<div class="part a-h" data-unit="5"><h3>点数ダッシュボード</h3>' +
      (has(13) ? '<span class="saved">ブラウザに保存しています</span>' : "") +
      (!has(8) ? '<span class="styled-note">単元8で見た目を整えます</span>' : "") + '</div>';

    if (has(6)) {
      html += '<div class="part" data-unit="6"><div class="cards">' +
        card("受講生の数", st.n) + card("合計", st.sum) + card("平均", st.avg) + card("最高点", st.max) +
        '</div><div class="origin">単元2でコンソールに出した4つの数字が、カードになりました。</div></div>';
    } else html += ph(6);

    if (has(12)) {
      html += '<div class="part chart" data-unit="12" role="img" aria-label="点数の棒グラフ">' +
        rows.map(function(r){
          return '<div class="bar"><span>' + esc(r.name) + '</span><span class="tr"><i style="width:' + Math.max(0, Math.min(100, r.score)) + '%"></i></span><span class="n">' + r.score + '</span></div>';
        }).join("") +
        '<div class="axis"><span></span><span class="t"><span>0</span><span>50</span><span>100</span></span><span></span></div></div>';
    } else html += ph(12);

    var ctrl = "";
    ctrl += has(9) ? '<div class="part grp" data-unit="9">' +
        sortBtn("none", "元の順") + sortBtn("score", "点数の高い順") + sortBtn("name", "名前順") + '</div>'
      : ph(9);
    ctrl += has(11) ? '<div class="part" data-unit="11"><select class="asel" id="filterSel" aria-label="絞り込み">' +
        opt("all", "すべて") + opt("80", "80点以上") + opt("70", "70点未満") + '</select></div>'
      : ph(11);
    html += '<div class="ctrls">' + ctrl + '</div>';

    if (has(7)) {
      html += '<div class="part" data-unit="7"><table class="tbl"><thead><tr><th>名前</th><th class="r">点数</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function(r){
          return '<tr' + (S.added[r.name + ":" + r.score] ? ' class="new"' : "") + '><td>' + esc(r.name) + '</td><td class="r">' + r.score + '</td></tr>';
        }).join("") : '<tr><td colspan="2">条件に合う人はいません</td></tr>') +
        '</tbody></table></div>';
    } else html += ph(7);

    if (has(10)) {
      html += '<form class="part form" data-unit="10" id="addForm">' +
        '<label for="fName">名前<input id="fName" autocomplete="off" placeholder="例：山本"></label>' +
        '<label for="fScore">点数<input id="fScore" type="number" min="0" max="100" placeholder="0〜100"></label>' +
        '<button class="abtn" type="submit">追加</button>' +
        (S.formErr ? '<div class="err" role="alert">' + esc(S.formErr) + '</div>' : "") + '</form>';
    } else html += ph(10);

    if (!has(13)) html += ph(13);

    html += '</div>';
    app.innerHTML = html;

    var sel = $("filterSel");
    if (sel) sel.addEventListener("change", function(){ S.filter = sel.value; renderApp(); renderConsole(); });
    var form = $("addForm");
    if (form) form.addEventListener("submit", function(e){
      e.preventDefault();
      var name = $("fName").value.trim(), raw = $("fScore").value.trim(), score = Number(raw);
      if (!name) { S.formErr = "名前を入れてください。"; renderApp(); return; }
      if (raw === "" || !Number.isFinite(score) || score < 0 || score > 100) { S.formErr = "点数は0〜100の数で入れてください。"; renderApp(); return; }
      S.formErr = "";
      S.rows.push({ name: name, score: Math.round(score) });
      S.added[name + ":" + Math.round(score)] = true;
      renderApp(); renderConsole();
    });
  }
  function card(k, v){ return '<div class="card"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }
  function sortBtn(k, label){ return '<button type="button" class="abtn" data-sort="' + k + '" aria-pressed="' + (S.sort === k) + '">' + label + '</button>'; }
  function opt(v, label){ return '<option value="' + v + '"' + (S.filter === v ? " selected" : "") + '>' + label + '</option>'; }

  /* 第1章の成果。画面ができる前から、ここに少しずつ増えていく */
  function renderConsole(){
    var rows = S.rows, st = stats(rows), lines = [];
    if (has(1)) lines.push({ u: 1, s: "点数: " + rows[0].score });
    if (has(2)) {
      lines.push({ u: 2, s: "受講生の数: " + st.n });
      lines.push({ u: 2, s: "合計: " + st.sum });
      lines.push({ u: 2, s: "平均: " + st.avg });
      lines.push({ u: 2, s: "最高点: " + st.max });
    }
    if (has(3)) lines.push({ u: 3, s: "average(scores) → " + st.avg });
    if (has(4)) lines.push({ u: 4, s: '{ name: "' + rows[0].name + '", score: ' + rows[0].score + " }" });
    $("console").innerHTML = '<div class="h"><span>コンソール（第1章で出したもの）</span></div>' +
      (lines.length ? lines.map(function(l){
        return '<div class="l" data-unit="' + l.u + '"><span class="g">›</span><span>' + esc(l.s) + '</span><span class="from">単元' + l.u + '</span></div>';
      }).join("") : '<div class="none">まだ何も出ていません。単元1で最初の1行を出します。</div>');
  }

  /* ---------- 単元とアプリの部品を結ぶ ---------- */
  function highlight(u, on){
    Array.prototype.forEach.call(document.querySelectorAll('.browser [data-unit="' + u + '"]'), function(el){
      el.classList.toggle("hl", on);
    });
    if (u === 8 && has(5)) {
      Array.prototype.forEach.call(document.querySelectorAll(".browser .part"), function(el){ el.classList.toggle("hl", on); });
    }
    var li = document.querySelector('.unit[data-unit="' + u + '"]');
    if (li) li.classList.toggle("hl", on);
  }

  function openUnit(u, scroll){
    S.open = S.open === u ? null : u;
    renderChapters();
    if (scroll && S.open) {
      var li = document.querySelector('.unit[data-unit="' + u + '"]');
      if (li) li.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }
  }

  function setDone(n){
    S.done = Math.max(0, Math.min(TOTAL, n));
    S.open = S.done < TOTAL ? S.done + 1 : TOTAL;
    renderAll();
  }

  function renderAll(){ renderSummary(); renderChapters(); renderApp(); renderConsole(); }

  $("chapters").addEventListener("click", function(e){
    var row = e.target.closest(".u-row"); if (!row) return;
    openUnit(Number(row.closest(".unit").getAttribute("data-unit")), false);
  });
  $("chapters").addEventListener("mouseover", function(e){
    var li = e.target.closest(".unit"); if (!li) return;
    highlight(Number(li.getAttribute("data-unit")), true);
  });
  $("chapters").addEventListener("mouseout", function(e){
    var li = e.target.closest(".unit"); if (!li || li.contains(e.relatedTarget)) return;
    highlight(Number(li.getAttribute("data-unit")), false);
  });
  $("chapters").addEventListener("focusin", function(e){
    var li = e.target.closest(".unit"); if (li) highlight(Number(li.getAttribute("data-unit")), true);
  });
  $("chapters").addEventListener("focusout", function(e){
    var li = e.target.closest(".unit"); if (li) highlight(Number(li.getAttribute("data-unit")), false);
  });

  var browser = document.querySelector(".browser");
  browser.addEventListener("click", function(e){
    var sb = e.target.closest("[data-sort]");
    if (sb) { S.sort = sb.getAttribute("data-sort"); renderApp(); return; }
    var p = e.target.closest(".ph"); if (!p) return;
    var u = Number(p.getAttribute("data-unit"));
    if (S.open !== u) openUnit(u, true);
  });
  browser.addEventListener("keydown", function(e){
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("ph")) {
      e.preventDefault(); e.target.click();
    }
  });
  browser.addEventListener("mouseover", function(e){
    var p = e.target.closest("[data-unit]"); if (!p) return;
    var li = document.querySelector('.unit[data-unit="' + p.getAttribute("data-unit") + '"]');
    if (li) li.classList.add("hl");
  });
  browser.addEventListener("mouseout", function(e){
    var p = e.target.closest("[data-unit]"); if (!p || p.contains(e.relatedTarget)) return;
    var li = document.querySelector('.unit[data-unit="' + p.getAttribute("data-unit") + '"]');
    if (li) li.classList.remove("hl");
  });


  setDone(OPTS.done || 0);
  if (!OPTS.loggedIn) {
    var b = document.getElementById("tkBack"), t = document.getElementById("tkTry");
    if (b) { b.textContent = "← テノラボのトップ"; b.setAttribute("data-go", "lp"); }
    if (t) { t.hidden = false; t.setAttribute("data-go", "try"); }
  }
  return function destroy(){};
}
