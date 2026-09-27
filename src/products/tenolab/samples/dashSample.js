// 見本のコース「点数ダッシュボードを作ろう」と単元2（ADR 0022）。
// 単元づくりの「見本を取り込む」で API（/tenolab/import）へ入れる元データ。
// おためし（ログインなし）では API を読めないので、この単元2をそのまま使う。
// 説明文の書き方：`コード` と **太字** だけが使える。

const PLACEHOLDER = "// ここに1行書いてみよう";
const STEP4_MARK = "// ステップ4：平均を求めて「平均:」と表示しよう";
const STEP5_MARK = "// ステップ5（チャレンジ）：いちばん高い点数を「最高点:」と表示しよう";

export const SAMPLE_COURSE = {
  courseId: "dash",
  title: "点数ダッシュボードを作ろう",
  lv: 1,
  lang: "Web",
  hours: 5,
  keywords: ["配列", "関数", "画面づくり", "グラフ"],
  appName: "点数ダッシュボード",
  status: "published",
  chapters: [
    { no: 1, title: "データを扱う", sub: "JavaScript", units: ["u1", "u2", "u3", "u4"] },
    { no: 2, title: "画面を作る", sub: "HTML・CSS", units: ["u5", "u6", "u7", "u8"] },
    { no: 3, title: "動きをつける", sub: "イベント", units: ["u9", "u10", "u11"] },
    { no: 4, title: "仕上げる", sub: "グラフ・保存", units: ["u12", "u13"] },
  ],
};

const U2 = {
  id: "u2",
  runtime: "js",
  title: "配列で点数をまとめる",
  minutes: 20,
  todo: "5人の点数を配列にまとめて、人数・合計・平均・最高点を出す",
  adds: "人数・合計・平均・最高点が出る",
  skills: ["配列", "ループ（for）"],
  fileName: "scores.js",
  dataVar: "scores",
  watch: ["scores", "total", "average", "best"],
  coachNote: "配列・for...of・合計・平均（toFixed）・Math.max を扱う単元。答えのコードは渡さず、どこを見ればよいかを返す。",
  goalLines: ["受講生の数: 5", "合計: 389", "平均: 77.8", "最高点: 90"],
  files: {
    start: [
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
      "",
    ].join("\n"),
    answer: [
      "const scores = [72, 85, 90, 64, 78];",
      "console.log(\"受講生の数:\", scores.length);",
      "let total = 0;",
      "for (const n of scores) {",
      "  total += n;",
      "}",
      "console.log(\"合計:\", total);",
      "const average = total / scores.length;",
      "console.log(\"平均:\", average.toFixed(1));",
      "const best = Math.max(...scores);",
      "console.log(\"最高点:\", best);",
    ].join("\n"),
    css: "",
  },
  steps: [
    {
      short: "動かす", title: "まずは動かしてみよう",
      todo: "「実行」を押して、プログラムを動かす",
      body: "お手本のコードがもう入っています。**実行**（Ctrl+Enter）を押すと、`console.log` の中身が下の出力に出ます。",
      why: "`console.log` は、値を画面に出して確かめるための命令です。プログラムの途中で値を見たいときにもよく使います。",
      done: "動きましたね。合計がまだ `0` なのは、足す処理をまだ書いていないからです。",
      anchor: ["console.log(\"受講生の数:\""],
      check: { kind: "answerLine", prefix: "受講生の数:" },
      hints: ["エディタの右上に「実行」があります。Ctrl+Enter でも動きます。", "押したら、下の「出力」に何が出たかを見てください。"],
      demo: { mode: "run" },
    },
    {
      short: "変える", title: "点数を1つ増やしてみよう",
      todo: "scores の [ ] に点数を1つ足して、もう一度実行する",
      body: "配列 `scores` に数字を1つ足して、もう一度実行してみましょう。受講生の数が変わるはずです。",
      why: "データを変えるだけで結果が変わるのが、配列や変数を使う良さです。コードそのものを書き直さずに試せます。",
      done: "受講生の数が変わりました。データを変えただけで結果が変わりましたね。",
      anchor: ["const scores"],
      check: { kind: "change" },
      hints: ["配列は `[ ]` の中に、カンマで区切って数字を並べます。", "たとえば `78` のあとに `, 95` と足してから実行します。"],
      demo: { mode: "insert", at: "64, 78", text: ", 95" },
    },
    {
      short: "合計", title: "合計を求めよう",
      todo: "ループの中で、total に n を足していく",
      body: "`for...of` は、配列から1つずつ取り出して `n` に入れてくれます。ループの中で `total` に `n` を足していきましょう。",
      why: "`total += n` は `total = total + n` を短く書いたものです。ループが回るたびに、いまの合計へ次の点数を足しています。",
      done: "合計が出ました。ループのたびに `total` が増えていきます。",
      anchor: [PLACEHOLDER, "total +=", "total = total", "for ("],
      check: { kind: "answerLine", prefix: "合計:" },
      hints: ["ループの中では、いま取り出した点数が `n` に入っています。", "`total` に `n` を足して戻します。書き方は `total += n;` です。"],
      demo: { mode: "replace", at: PLACEHOLDER, text: "total += n;" },
    },
    {
      short: "平均", title: "平均を出そう",
      todo: "合計 ÷ 人数 で平均を出して、「平均:」と表示する",
      body: "平均は **合計 ÷ 人数**。人数は `scores.length` で分かります。小数第1位までにするなら `toFixed(1)` を使います。",
      why: "`toFixed(1)` は、数を小数第1位までの文字にします。成績表で読みやすい形にそろえるためです。",
      done: "平均も出ましたね。`toFixed(1)` で小数第1位までにそろえています。",
      anchor: [STEP4_MARK],
      appendOnStart: STEP4_MARK,
      check: { kind: "answerLine", prefix: "平均:" },
      hints: ["合計は `total`、人数は `scores.length` で取れます。", "`const average = total / scores.length;` のあと、`console.log(\"平均:\", average.toFixed(1));` で表示できます。"],
      demo: { mode: "append", text: "const average = total / scores.length;\nconsole.log(\"平均:\", average.toFixed(1));" },
    },
    {
      short: "最高点", title: "最高点を探そう（チャレンジ）",
      todo: "いちばん高い点数を見つけて、「最高点:」と表示する",
      body: "ここは自分で考えてみましょう。詰まったら、右のコーチに聞いてかまいません。",
      why: "`Math.max` は、渡された数の中からいちばん大きいものを返します。配列はそのまま渡せないので `...scores` で広げます。",
      done: "最高点まで出せました。これでレッスンは完了です。",
      anchor: [STEP5_MARK],
      appendOnStart: STEP5_MARK,
      check: { kind: "answerLine", prefix: "最高点:" },
      hints: ["配列の最大値は `Math.max(...scores)` で取れます。`...` は配列を1つずつに広げる書き方です。", "ループで書くなら、`best` を最初の点数にして、もっと大きい `n` が来たら入れ替えます。"],
      demo: { mode: "append", text: "const best = Math.max(...scores);\nconsole.log(\"最高点:\", best);" },
    },
  ],
};

export const SAMPLE_UNITS = { dash: { u2: U2 } };

export function sampleUnit(courseId, unitId) {
  return SAMPLE_UNITS[courseId]?.[unitId] || null;
}
