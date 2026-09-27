// 単元づくりで使う、単元データの形と入力の選択肢（API の utils/tenolabUnit.mjs と同じ形）

export const RUNTIMES = [
  { id: "js", name: "JavaScript" },
  { id: "web", name: "Web（HTML・CSS）" },
  { id: "java", name: "Java" },
];

export const FILE_NAMES = { js: "main.js", web: "index.html", java: "Main.java" };

// 合格の条件。fields はその条件で入れるもの（selector / prop / value / prefix / at / file）
// value の見出しと例は label・ph、複数行なら multi
export const CHECKS = {
  js: [
    { id: "answerLine", name: "完成形と同じ行が出る", fields: ["prefix"], label: "行の頭", ph: "合計:" },
    { id: "change", name: "データを変えて動かす", fields: [] },
    { id: "line", name: "決まった行が出る", fields: ["value"], label: "出てほしい行（1行に1つ）", ph: "受講生の数: 5", multi: true },
    { id: "code", name: "コードに書き方がある", fields: ["value"], label: "入っていてほしい書き方（1行に1つ）", ph: "total += n", multi: true },
  ],
  web: [
    { id: "count", name: "要素の数", fields: ["selector", "value", "at"], label: "個数（「>=3」で3個以上）", ph: "4" },
    { id: "exists", name: "要素がある", fields: ["selector", "at"] },
    { id: "text", name: "要素の文字", fields: ["selector", "value", "at"], label: "入っていてほしい文字", ph: "点数ダッシュボード" },
    { id: "style", name: "見た目の値", fields: ["selector", "prop", "value", "at"], label: "値", ph: "flex" },
    { id: "sameRow", name: "横に並ぶ（1つ目と2つ目）", fields: ["selector", "at"] },
    { id: "stacked", name: "縦に並ぶ（1つ目と2つ目）", fields: ["selector", "at"] },
    { id: "noOverflow", name: "横にはみ出さない", fields: ["at"] },
    { id: "source", name: "コードに書き方がある", fields: ["file", "value"], label: "入っていてほしい書き方", ph: "<link rel=\"stylesheet\"" },
  ],
  java: [
    { id: "line", name: "決まった行が出る", fields: ["value"], label: "出てほしい行（1行に1つ）", ph: "評価: A", multi: true },
    { id: "tests", name: "入力を変えて確かめる", fields: ["value"], label: "1行に1つ「入力 => 出てほしい行」（入力の改行は \\n）", ph: "85 => 評価: A", multi: true },
    { id: "compile", name: "コンパイルが通る", fields: [] },
    { id: "code", name: "コードに書き方がある", fields: ["value"], label: "入っていてほしい書き方（1行に1つ）", ph: "if (", multi: true },
  ],
};

export const DEMO_MODES = [
  { id: "none", name: "なし" },
  { id: "run", name: "実行を押してみせる" },
  { id: "insert", name: "この文字のすぐ後に打つ" },
  { id: "replace", name: "この文字を打ち替える" },
  { id: "append", name: "目印の後（なければ最後）に打つ" },
];

export const HINT_LEVELS = ["軽く", "具体的に", "ほぼ答え"];

const blankCheck = (runtime, first) => ({
  kind: runtime === "web" ? "count" : runtime === "java" ? "line" : first ? "line" : "answerLine",
  value: "", prefix: "", selector: "", prop: "", at: "wide", file: "html",
});

export function blankStep(n, runtime = "js") {
  return {
    title: n === 1 ? "まずは動かしてみよう" : "", short: n === 1 ? "動かす" : "", todo: n === 1 ? "「実行」を押して、プログラムを動かす" : "",
    body: "", why: "", done: "", anchor: [], appendOnStart: "", file: "html",
    check: blankCheck(runtime, n === 1),
    hints: ["", "", ""], demo: { mode: n === 1 ? "run" : "none", text: "", at: "" }, aiDraft: false,
  };
}

const START = {
  js: "// お題：\n",
  web: "<!DOCTYPE html>\n<html lang=\"ja\">\n<head>\n  <meta charset=\"UTF-8\">\n  <title></title>\n  <link rel=\"stylesheet\" href=\"style.css\">\n</head>\n<body>\n\n</body>\n</html>\n",
  java: "public class Main {\n    public static void main(String[] args) {\n        \n    }\n}\n",
};

export function blankUnit(id, title, runtime = "js") {
  return {
    id, runtime, title: title || "", minutes: 20, todo: "", adds: "", skills: [], coachNote: "",
    fileName: FILE_NAMES[runtime], dataVar: "", watch: [], goalLines: [],
    files: { start: START[runtime], answer: "", css: "", answerCss: "" },
    steps: [blankStep(1, runtime)],
  };
}

// 取り込んだ単元を、画面で扱いやすい形にそろえる（足りない項目を埋める）
export function fillUnit(u) {
  const rt = u.runtime || "js";
  const b = blankUnit(u.id, u.title, rt);
  return {
    ...b, ...u,
    files: { ...b.files, ...(u.files || {}) },
    steps: (u.steps || []).map(s => ({
      ...blankStep(2, rt), ...s,
      check: { ...blankCheck(rt, false), ...(s.check || {}) },
      hints: [0, 1, 2].map(i => (s.hints || [])[i] || ""),
      demo: { mode: "none", text: "", at: "", ...(s.demo || {}) },
      anchor: s.anchor || [],
    })),
  };
}

// 実行環境を変えたとき：ファイル名と、その環境で使えない合格の条件をそろえる（コードとステップの中身は残す）
export function withRuntime(u, runtime) {
  const ids = CHECKS[runtime].map(c => c.id);
  return {
    ...u, runtime,
    fileName: FILE_NAMES[runtime],
    steps: u.steps.map((s, i) => (ids.includes(s.check.kind) ? s : { ...s, check: blankCheck(runtime, i === 0) })),
  };
}

// 保存する形（空のヒント・空の行は送らない）
export function toSave(u) {
  return {
    ...u,
    goalLines: (u.goalLines || []).filter(l => l.trim()),
    steps: u.steps.map(s => ({ ...s, hints: s.hints.filter(h => h.trim()), anchor: s.anchor.filter(a => a.trim()) })),
  };
}

export const checkDef = (runtime, kind) => (CHECKS[runtime] || CHECKS.js).find(c => c.id === kind) || (CHECKS[runtime] || CHECKS.js)[0];

// 公開前に直すところ（API の unitIssues と同じ基準。画面ですぐ見せるため）
export function unitIssues(u) {
  const out = [];
  if (!u.title.trim()) out.push({ step: 0, message: "単元の名前がありません" });
  if (!u.files.start.trim()) out.push({ step: 0, message: "最初のコードがありません" });
  if (!u.steps.length) out.push({ step: 0, message: "ステップが1つもありません" });
  if (u.steps.some(s => s.check.kind === "answerLine") && !u.files.answer.trim()) out.push({ step: 0, message: "完成形のコードがありません" });
  if (u.steps.some(s => s.check.kind === "change") && !u.dataVar) out.push({ step: 0, message: "書き換えるデータの変数名がありません" });
  u.steps.forEach((s, i) => {
    const n = `ステップ${i + 1}`;
    const c = s.check;
    if (!s.title.trim()) out.push({ step: i + 1, message: `${n}の名前がありません` });
    if (!s.body.trim()) out.push({ step: i + 1, message: `${n}の説明がありません` });
    const def = checkDef(u.runtime, c.kind);
    if (def.fields.includes("selector") && !c.selector.trim()) out.push({ step: i + 1, message: `${n}の合格の条件に、対象（セレクタ）がありません` });
    else if (def.fields.includes("prop") && !c.prop.trim()) out.push({ step: i + 1, message: `${n}の合格の条件に、プロパティ名がありません` });
    else if (c.kind === "tests" && !c.value.split("\n").some(l => l.includes("=>"))) out.push({ step: i + 1, message: `${n}のテストがありません` });
    else if (def.fields.includes("prefix") && !c.prefix.trim()) out.push({ step: i + 1, message: `${n}の合格の条件がありません` });
    else if (def.fields.includes("value") && !["count", "text", "style"].includes(c.kind) && !c.value.trim()) out.push({ step: i + 1, message: `${n}の合格の条件がありません` });
    if (s.aiDraft) out.push({ step: i + 1, message: `${n}はAIの下書きのままです` });
  });
  return out;
}

// 次の単元の番号（u1, u2 … の続き）
export function nextUnitId(chapters) {
  const nums = (chapters || []).flatMap(c => c.units).map(id => Number(String(id).replace(/^u/, ""))).filter(Number.isFinite);
  return "u" + ((nums.length ? Math.max(...nums) : 0) + 1);
}

export const errText = (e, fallback) => e?.errorMessage || fallback;

export const splitList = (v) => String(v || "").split(/[,、\n]/).map(x => x.trim()).filter(Boolean);
