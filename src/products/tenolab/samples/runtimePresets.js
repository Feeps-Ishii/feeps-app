// 単元づくりで実行環境を選んだときに入れる、最初の形（見本の単元）。フェーズB（2026-09-27〜）
// 実在の会社名・人名は使わない。

const WEB_START_HTML = [
  "<!DOCTYPE html>",
  "<html lang=\"ja\">",
  "<head>",
  "  <meta charset=\"UTF-8\">",
  "  <title>点数ダッシュボード</title>",
  "  <link rel=\"stylesheet\" href=\"style.css\">",
  "</head>",
  "<body>",
  "  <h1>点数ダッシュボード</h1>",
  "  <div class=\"cards\">",
  "    <div class=\"card\">受講生 5</div>",
  "    <!-- ここにカードを足そう -->",
  "  </div>",
  "</body>",
  "</html>",
  "",
].join("\n");

const WEB_ANSWER_HTML = WEB_START_HTML.replace("    <!-- ここにカードを足そう -->", [
  "    <div class=\"card\">合計 389</div>",
  "    <div class=\"card\">平均 77.8</div>",
  "    <div class=\"card\">最高点 90</div>",
].join("\n"));

const WEB_START_CSS = [
  "body {",
  "  font-family: sans-serif;",
  "  margin: 24px;",
  "}",
  "",
  ".card {",
  "  border: 2px solid #15171c;",
  "  border-radius: 12px;",
  "  padding: 16px;",
  "}",
  "",
].join("\n");

const WEB_ANSWER_CSS = WEB_START_CSS + [
  ".cards {",
  "  display: flex;",
  "  gap: 12px;",
  "}",
  "",
  "@media (max-width: 600px) {",
  "  .cards {",
  "    flex-direction: column;",
  "  }",
  "}",
  "",
].join("\n");

export const WEB_PRESET = {
  runtime: "web",
  title: "数字をカードで見せる",
  minutes: 20,
  todo: "4つの数字をカードにして、横に並べる。スマホ幅では縦に積む",
  adds: "4つの数字がカードで並ぶ",
  skills: ["HTMLの要素", "flexbox", "メディアクエリ"],
  fileName: "index.html",
  dataVar: "", watch: [], goalLines: [],
  coachNote: "カードの数・横並び（flex）・スマホ幅で縦積み。答えのコードは渡さない。",
  files: { start: WEB_START_HTML, answer: WEB_ANSWER_HTML, css: WEB_START_CSS, answerCss: WEB_ANSWER_CSS },
  steps: [
    {
      title: "カードを4枚にしよう", short: "4枚", todo: "合計・平均・最高点のカードを足す", file: "html",
      body: "`<div class=\"card\">` を3つ足して、カードを4枚にしましょう。",
      why: "同じ class を付けると、同じ見た目（CSS）がまとめて効きます。",
      done: "カードが4枚になりました。",
      anchor: ["<!-- ここにカードを足そう -->"], appendOnStart: "",
      check: { kind: "count", selector: ".card", value: "4", at: "wide", file: "html" },
      hints: ["いまあるカードの行をまねして、中の文字だけ変えます。", "`<div class=\"card\">合計 389</div>` のように書きます。"],
      demo: { mode: "replace", at: "    <!-- ここにカードを足そう -->", text: "    <div class=\"card\">合計 389</div>\n    <div class=\"card\">平均 77.8</div>\n    <div class=\"card\">最高点 90</div>" },
    },
    {
      title: "カードを横に並べよう", short: "横並び", todo: ".cards を flex にして、カードを横に並べる", file: "css",
      body: "`.cards` に `display: flex;` を書くと、中の要素が横に並びます。`gap` で間を空けます。",
      why: "flex は「中身を横（または縦）に並べる」ための並べ方です。並べる側（親）に書きます。",
      done: "横に並びました。",
      anchor: [".card {"], appendOnStart: "",
      check: { kind: "sameRow", selector: ".card", value: "", at: "wide", file: "html" },
      hints: ["並べたい要素の親（.cards）に書きます。", "`.cards { display: flex; gap: 12px; }` を足します。"],
      demo: { mode: "append", text: ".cards {\n  display: flex;\n  gap: 12px;\n}" },
    },
    {
      title: "スマホ幅では縦に積もう", short: "スマホ", todo: "幅が600px以下のときは縦に積む", file: "css",
      body: "`@media (max-width: 600px)` の中に書いたものは、狭い画面のときだけ効きます。",
      why: "スマホでは横に4枚並ぶと狭すぎるので、縦に積んで読みやすくします。",
      done: "スマホ幅では縦に積まれました。",
      anchor: [".cards {"], appendOnStart: "",
      check: { kind: "stacked", selector: ".card", value: "", at: "narrow", file: "html" },
      hints: ["`@media (max-width: 600px) { ... }` の中に `.cards` をもう一度書きます。", "`flex-direction: column;` で縦に積めます。"],
      demo: { mode: "append", text: "@media (max-width: 600px) {\n  .cards {\n    flex-direction: column;\n  }\n}" },
    },
  ],
};

const JAVA_START = [
  "public class Main {",
  "    public static void main(String[] args) {",
  "        int score = 85;",
  "        System.out.println(\"点数: \" + score);",
  "",
  "        // ステップ2：80点以上なら「評価: A」、それ以外は「評価: B」と表示しよう",
  "    }",
  "}",
  "",
].join("\n");

const JAVA_ANSWER = [
  "import java.util.Scanner;",
  "",
  "public class Main {",
  "    public static void main(String[] args) {",
  "        Scanner sc = new Scanner(System.in);",
  "        int score = sc.hasNextInt() ? sc.nextInt() : 85;",
  "        System.out.println(\"点数: \" + score);",
  "        if (score >= 80) {",
  "            System.out.println(\"評価: A\");",
  "        } else {",
  "            System.out.println(\"評価: B\");",
  "        }",
  "    }",
  "}",
  "",
].join("\n");

export const JAVA_PRESET = {
  runtime: "java",
  title: "点数に評価をつける",
  minutes: 20,
  todo: "点数から「評価: A」か「評価: B」を出す",
  adds: "点数に評価がつく",
  skills: ["if 文", "比較演算子", "標準入力"],
  fileName: "Main.java",
  dataVar: "", watch: [],
  goalLines: ["点数: 85", "評価: A"],
  coachNote: "if / else と >= の比較。Scanner は最後のステップで使う。",
  files: { start: JAVA_START, answer: JAVA_ANSWER, css: "", answerCss: "" },
  steps: [
    {
      title: "まずは動かしてみよう", short: "動かす", todo: "「実行」を押して、点数を表示する",
      body: "**実行**を押すと、本物の Java でコンパイルしてから動かします。少し時間がかかります。",
      why: "`System.out.println` は、かっこの中を1行表示する命令です。",
      done: "動きました。次は評価をつけます。",
      anchor: ["System.out.println"], appendOnStart: "",
      check: { kind: "line", value: "点数: 85" },
      hints: ["エディタの右上の「実行」を押します。"],
      demo: { mode: "run" },
    },
    {
      title: "評価をつけよう", short: "評価", todo: "80点以上なら「評価: A」、それ以外は「評価: B」",
      body: "`if (score >= 80) { ... } else { ... }` で、条件によって表示を変えます。",
      why: "`>=` は「以上」。80 ちょうども A になります。",
      done: "評価が出ました。",
      anchor: ["// ステップ2"], appendOnStart: "",
      check: { kind: "line", value: "評価: A" },
      hints: ["`if (score >= 80)` で始めます。", "`System.out.println(\"評価: A\");` を if の中に、`評価: B` を else の中に書きます。"],
      demo: { mode: "insert", at: "と表示しよう", text: "\n        if (score >= 80) {\n            System.out.println(\"評価: A\");\n        } else {\n            System.out.println(\"評価: B\");\n        }" },
    },
    {
      title: "入力した点数で確かめよう", short: "入力", todo: "点数を標準入力から読んで、どの点数でも正しい評価を出す",
      body: "`Scanner` で入力を読みます。いろいろな点数で自動テストします。",
      why: "決まった値だけで動くプログラムは、値が変わると確かめられません。入力を変えて試すのがテストです。",
      done: "どの点数でも正しい評価が出ました。",
      anchor: ["int score"], appendOnStart: "",
      check: { kind: "tests", value: "85 => 評価: A\n80 => 評価: A\n79 => 評価: B\n40 => 評価: B" },
      hints: ["ファイルの1行目に `import java.util.Scanner;` を足します。", "`Scanner sc = new Scanner(System.in);` のあと `int score = sc.nextInt();` にします。"],
      demo: { mode: "replace", at: "int score = 85;", text: "java.util.Scanner sc = new java.util.Scanner(System.in);\n        int score = sc.nextInt();" },
    },
  ],
};

export const RUNTIME_PRESETS = { web: WEB_PRESET, java: JAVA_PRESET };
