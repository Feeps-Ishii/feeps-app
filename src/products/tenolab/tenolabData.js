// テノラボのコースと単元（最初の版は見本を1本だけ持つ。ADR 0022）
// 単元づくり（講師が画面で作る）が入るまでは、中身はここが正本。
// 進み具合と書いたコードは API（/tenolab/progress）に保存する。

export const COURSE_ID = "dash";

// 単元の中身がある（実際に触れる）もの。ほかは「準備中」と出す
export const PLAYABLE = { dash: ["u2"] };

// 見本のコースは単元2から始める。単元1（変数と表示）はコンソールに1行出すだけなので、
// 最初の版ではクリア済みとして扱う（中身を作ったら外す）。
export const PRECLEARED = { dash: ["u1"] };

export const UNITS = [
  { id: "u1", t: "変数と表示", min: 10, adds: "コンソールに点数が出る" },
  { id: "u2", t: "配列で点数をまとめる", min: 20, adds: "人数・合計・平均・最高点が出る" },
  { id: "u3", t: "関数にまとめる", min: 20, adds: "計算を何度でも使い回せる" },
  { id: "u4", t: "オブジェクトで受講生を表す", min: 20, adds: "名前と点数がセットになる" },
  { id: "u5", t: "画面の骨組み", min: 15, adds: "アプリの画面ができる" },
  { id: "u6", t: "数字をカードで見せる", min: 20, adds: "4つの数字がカードで並ぶ" },
  { id: "u7", t: "表で一覧にする", min: 25, adds: "受講生の表が出る" },
  { id: "u8", t: "見た目を整える", min: 25, adds: "見た目が整う" },
  { id: "u9", t: "ボタンで並べ替える", min: 20, adds: "表を並べ替えられる" },
  { id: "u10", t: "フォームで点数を足す", min: 25, adds: "点数を追加できる" },
  { id: "u11", t: "条件で絞り込む", min: 20, adds: "条件に合う人だけ出せる" },
  { id: "u12", t: "グラフで見せる", min: 30, adds: "点数がグラフになる" },
  { id: "u13", t: "ブラウザに保存する", min: 20, adds: "閉じても残る" },
];

// ホームの「つづきから」に出す、単元ごとのゴール
export const MISSION = {
  u2: {
    chap: "第1章 データを扱う",
    todo: "5人の点数を配列にまとめて、人数・合計・平均・最高点を出す",
    pass: ["平均: 77.8", "最高点: 90"],
    steps: ["お手本を動かす", "点数を1つ増やす", "合計を求める", "平均を出す", "最高点を探す"],
  },
  u3: {
    chap: "第1章 データを扱う",
    todo: "合計と平均の計算を関数にまとめて、別の点数でも使ってみる",
    pass: ["average([80, 90]) → 85"],
    steps: ["合計を返す関数を作る", "平均を返す関数を作る", "同じ関数を別の点数で使う"],
  },
};

// 単元をクリアすると身につくこと
export const SKILLS = [
  { name: "配列", unit: "u2" },
  { name: "ループ（for）", unit: "u2" },
  { name: "関数", unit: "u3" },
  { name: "オブジェクト", unit: "u4" },
  { name: "画面の部品を作る", unit: "u6" },
  { name: "イベント（クリック）", unit: "u9" },
];

export const LV = { 1: ["lv1", "はじめて"], 2: ["lv2", "基礎"], 3: ["lv3", "実務"] };

export const COURSES = [
  { id: "dash", t: "点数ダッシュボードを作ろう", lv: 1, lang: "Web", units: 13, h: 5, d: "配列・関数・画面づくり・グラフまで。最初の1本に。", goal: "web", open: true },
  { id: "quiz", t: "クイズアプリを作ろう", lv: 1, lang: "Web", units: 8, h: 3, d: "問題を出して、答えを判定して、点数を出す。条件分岐が身につきます。", goal: "web" },
  { id: "todo", t: "ToDoアプリで学ぶ更新と削除", lv: 2, lang: "Web", units: 10, h: 4, d: "追加・完了・削除。アプリの基本の動きをひと通り作ります。", goal: "web" },
  { id: "nippo", t: "日報アプリを作ろう", lv: 2, lang: "Web", units: 12, h: 5, d: "書いて、保存して、あとから見返す。データの保存と一覧表示を学びます。", goal: "web" },
  { id: "java", t: "Javaで成績計算ツール", lv: 2, lang: "Java", units: 12, h: 5, d: "ファイルを読み込んで集計し、評価をつける。クラスの使い方まで。", goal: "java" },
  { id: "aws", t: "作ったアプリをAWSで公開", lv: 3, lang: "AWS", units: 9, h: 4, d: "自分のアプリを世界に出す。S3とCloudFrontで公開するまで。", goal: "ship" },
];

export const GOALS = [
  { id: "web", t: "Webアプリを1人で作れる", s: "点数ダッシュボード → ToDo → 日報" },
  { id: "java", t: "Javaの研修についていける", s: "成績計算ツールから" },
  { id: "ship", t: "作ったものを公開できる", s: "AWSで公開まで" },
];

// 進み具合（APIの items）から、コースの状態を組み立てる
export function courseProgress(items, courseId = COURSE_ID) {
  const cleared = new Set((PRECLEARED[courseId] || []));
  const byUnit = {};
  for (const it of items || []) {
    if (it.courseId !== courseId) continue;
    byUnit[it.unitId] = it;
    if (it.status === "cleared") cleared.add(it.unitId);
  }
  // 前から順にクリアした数（コースマップの「ここまで終わった」）
  let done = 0;
  for (const u of UNITS) { if (cleared.has(u.id)) done++; else break; }
  const next = UNITS[done] || null;
  return { cleared, byUnit, done, next, total: UNITS.length };
}

export function isPlayable(courseId, unitId) {
  return (PLAYABLE[courseId] || []).includes(unitId);
}
