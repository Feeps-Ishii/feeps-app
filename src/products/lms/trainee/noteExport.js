/* ノートの書き出し。Markdown・テキストはそのまま、Word は docx（開いたときだけ読み込む）、
   PDF はブラウザの印刷から保存する（日本語のフォントを同梱しなくて済み、文字も選べる）。
   notes = [{ title, rest, when, unit }] */

export const NOTE_FORMATS = {
  md: ["Markdown", ".md", "メモアプリ向け"],
  pdf: ["PDF", ".pdf", "印刷向け"],
  docx: ["Word", ".docx", "手直し向け"],
  txt: ["テキスト", ".txt", "飾りなし"],
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const lead = n => [n.when, n.unit].filter(Boolean).join(" ・ ");

export function notesToMarkdown(notes) {
  return notes.map(n => `# ${n.title}\n${lead(n)}\n\n${n.rest}`.trimEnd()).join("\n\n---\n\n") + "\n";
}

export function notesToText(notes) {
  const plain = s => s.replace(/^#{1,6} /gm, "").replace(/^[-*] /gm, "・").replace(/^```.*$/gm, "");
  return notes.map(n => `${n.title}\n${lead(n)}\n\n${plain(n.rest)}`.trimEnd()).join("\n\n----------\n\n") + "\n";
}

// 行ごとの種類に分ける（見出し・箇条書き・コード・ふつうの行）
export function noteLines(rest) {
  const out = [];
  let inCode = false;
  String(rest || "").split(/\r?\n/).forEach(l => {
    if (/^```/.test(l)) { inCode = !inCode; return; }
    if (inCode) out.push({ k: "code", t: l });
    else if (/^#{1,6} /.test(l)) out.push({ k: "h", t: l.replace(/^#{1,6} /, "") });
    else if (/^[-*] /.test(l)) out.push({ k: "li", t: l.slice(2) });
    else if (l.trim()) out.push({ k: "p", t: l });
  });
  return out;
}

function notesToHtml(notes, title) {
  const body = notes.map(n => {
    let html = "", list = false;
    noteLines(n.rest).forEach(({ k, t }) => {
      if (k === "li" && !list) { html += "<ul>"; list = true; }
      if (k !== "li" && list) { html += "</ul>"; list = false; }
      html += k === "h" ? `<h2>${esc(t)}</h2>` : k === "li" ? `<li>${esc(t)}</li>` : k === "code" ? `<pre>${esc(t)}</pre>` : `<p>${esc(t)}</p>`;
    });
    if (list) html += "</ul>";
    return `<article><h1>${esc(n.title)}</h1><small>${esc(lead(n))}</small>${html}</article>`;
  }).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{font-family:"Zen Kaku Gothic New","Yu Gothic","Hiragino Sans",sans-serif;color:#1f2624;font-size:11pt;line-height:1.8;margin:0}
    article+article{break-before:page}h1{font-size:18pt;margin:0}small{color:#646d69}h2{font-size:13pt;margin:14pt 0 2pt}p{margin:2pt 0}ul{margin:2pt 0;padding-left:1.3em}
    pre{margin:0;font-family:Consolas,monospace;font-size:9.5pt;background:#f1f3f2;padding:0 6pt;white-space:pre-wrap}@page{margin:18mm}
  </style></head><body>${body}</body></html>`;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function saveDocx(notes, name) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const children = [];
  notes.forEach((n, i) => {
    children.push(new Paragraph({ text: n.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: i > 0 }));
    children.push(new Paragraph({ children: [new TextRun({ text: lead(n), color: "646D69", size: 18 })] }));
    noteLines(n.rest).forEach(({ k, t }) => {
      if (k === "h") children.push(new Paragraph({ text: t, heading: HeadingLevel.HEADING_2 }));
      else if (k === "li") children.push(new Paragraph({ text: t, bullet: { level: 0 } }));
      else if (k === "code") children.push(new Paragraph({ children: [new TextRun({ text: t, font: "Consolas", size: 19 })] }));
      else children.push(new Paragraph({ text: t }));
    });
  });
  const doc = new Document({ styles: { default: { document: { run: { font: "Yu Gothic", size: 22 } } } }, sections: [{ children }] });
  download(await Packer.toBlob(doc), name);
}

function printPdf(notes, title) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  f.setAttribute("aria-hidden", "true");
  f.onload = () => {
    const w = f.contentWindow;
    const done = () => setTimeout(() => f.remove(), 500);
    w.addEventListener("afterprint", done);
    w.focus();
    w.print();
  };
  f.srcdoc = notesToHtml(notes, title);
  document.body.appendChild(f);
}

// 書き出す。base は拡張子を除いたファイル名
export async function exportNotes(fm, notes, base) {
  const name = `${base}${NOTE_FORMATS[fm][1]}`;
  if (fm === "md") download(new Blob([notesToMarkdown(notes)], { type: "text/markdown;charset=utf-8" }), name);
  else if (fm === "txt") download(new Blob([notesToText(notes)], { type: "text/plain;charset=utf-8" }), name);
  else if (fm === "docx") await saveDocx(notes, name);
  else printPdf(notes, base);
}
