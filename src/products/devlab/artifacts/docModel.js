// 設計書・文書の成果物モデル（2026-08-19新設）。
// 「設計書をテキストで提出」を、章立てのある文書としてアプリ内で書けるようにする。
//
// 自由記述1枚ではなく章（section）の配列にしているのは、何を書くべきかが分かるようにするため。
// 案件側が用意したテンプレートから始められる。

export function emptyDocModel() {
  return {
    title: "",
    sections: [
      { id: sid(), heading: "目的・背景", body: "" },
      { id: sid(), heading: "機能一覧", body: "" },
      { id: sid(), heading: "処理の流れ", body: "" },
      { id: sid(), heading: "考慮事項・制約", body: "" },
    ],
  };
}

let seq = 0;
function sid() {
  seq += 1;
  return `s_${Date.now().toString(36)}${seq}`;
}
export function newSection() {
  return { id: sid(), heading: "", body: "" };
}

export function sanitizeDocModel(model) {
  const sections = (Array.isArray(model?.sections) ? model.sections : [])
    .slice(0, 20)
    .map((s, i) => ({
      id: s?.id || `s_${i}`,
      heading: String(s?.heading || "").slice(0, 120),
      body: String(s?.body || "").slice(0, 8000),
    }));
  return { title: String(model?.title || "").slice(0, 200), sections };
}

export function validateDocModel(model) {
  const issues = [];
  const sections = model?.sections || [];
  if (!sections.length) issues.push("章が1つもありません。");
  const filled = sections.filter(s => s.body.trim());
  if (!filled.length) issues.push("本文が入力されていません。");
  for (const s of sections) {
    if (s.body.trim() && !s.heading.trim()) issues.push("見出しのない章があります。");
    if (s.heading.trim() && !s.body.trim()) issues.push(`「${s.heading}」の本文が空です。`);
  }
  return issues;
}

/** Markdownとして組み立てる。プレビューとAI採点用テキストの両方で使う。 */
export function docModelToMarkdown(model) {
  const m = sanitizeDocModel(model);
  const out = [];
  if (m.title.trim()) out.push(`# ${m.title.trim()}`, "");
  for (const s of m.sections) {
    if (!s.heading.trim() && !s.body.trim()) continue;
    out.push(`## ${s.heading.trim() || "(見出しなし)"}`, "");
    if (s.body.trim()) out.push(s.body.trim(), "");
  }
  return out.join("\n").trim();
}

export function docModelToText(model) {
  return `【設計書】\n${docModelToMarkdown(model)}`;
}
