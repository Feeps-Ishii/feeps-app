// 単元づくりで使う、単元データの形と入力の選択肢（API の utils/tenolabUnit.mjs と同じ形）

export const RUNTIMES = [
  { id: "js", name: "JavaScript", ready: true },
  { id: "web", name: "Web（HTML・CSS）", ready: false },
  { id: "java", name: "Java", ready: false },
];

// 合格の条件（JavaScript）。need はその条件で入れる値
export const CHECKS_JS = [
  { id: "answerLine", name: "完成形と同じ行が出る", need: "prefix", label: "行の頭", ph: "合計:" },
  { id: "change", name: "データを変えて動かす", need: null },
  { id: "line", name: "決まった行が出る", need: "value", label: "出てほしい行（1行に1つ）", ph: "受講生の数: 5", multi: true },
  { id: "code", name: "コードに書き方がある", need: "value", label: "入っていてほしい書き方（1行に1つ）", ph: "total += n", multi: true },
];

export const DEMO_MODES = [
  { id: "none", name: "なし" },
  { id: "run", name: "実行を押してみせる" },
  { id: "insert", name: "この文字のすぐ後に打つ" },
  { id: "replace", name: "この文字を打ち替える" },
  { id: "append", name: "目印の後（なければ最後）に打つ" },
];

export const HINT_LEVELS = ["軽く", "具体的に", "ほぼ答え"];

export function blankStep(n) {
  return {
    title: n === 1 ? "まずは動かしてみよう" : "", short: n === 1 ? "動かす" : "", todo: n === 1 ? "「実行」を押して、プログラムを動かす" : "",
    body: "", why: "", done: "", anchor: [], appendOnStart: "",
    check: { kind: n === 1 ? "line" : "answerLine", value: "", prefix: "" },
    hints: ["", "", ""], demo: { mode: n === 1 ? "run" : "none", text: "", at: "" }, aiDraft: false,
  };
}

export function blankUnit(id, title) {
  return {
    id, runtime: "js", title: title || "", minutes: 20, todo: "", adds: "", skills: [], coachNote: "",
    fileName: "main.js", dataVar: "", watch: [], goalLines: [],
    files: { start: "// お題：\n", answer: "", css: "" },
    steps: [blankStep(1)],
  };
}

// 取り込んだ単元を、画面で扱いやすい形にそろえる（足りない項目を埋める）
export function fillUnit(u) {
  const b = blankUnit(u.id, u.title);
  return {
    ...b, ...u,
    files: { ...b.files, ...(u.files || {}) },
    steps: (u.steps || []).map(s => ({
      ...blankStep(2), ...s,
      check: { kind: "line", value: "", prefix: "", ...(s.check || {}) },
      hints: [0, 1, 2].map(i => (s.hints || [])[i] || ""),
      demo: { mode: "none", text: "", at: "", ...(s.demo || {}) },
      anchor: s.anchor || [],
    })),
  };
}

// 保存する形（空のヒントは送らない）
export function toSave(u) {
  return { ...u, steps: u.steps.map(s => ({ ...s, hints: s.hints.filter(h => h.trim()), anchor: s.anchor.filter(a => a.trim()) })) };
}

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
    if (!s.title.trim()) out.push({ step: i + 1, message: `${n}の名前がありません` });
    if (!s.body.trim()) out.push({ step: i + 1, message: `${n}の説明がありません` });
    const def = CHECKS_JS.find(c => c.id === s.check.kind);
    if (def?.need && !String(s.check[def.need] || "").trim()) out.push({ step: i + 1, message: `${n}の合格の条件がありません` });
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
