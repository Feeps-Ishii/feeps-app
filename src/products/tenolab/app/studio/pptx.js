/* パワポ（.pptx）を、実際のスライドの並び順で読む（教材づくり、2026-10-06）。
   これまでの読み込み（learning/admin/pptxNotes.js）は notesSlideN の N をページ番号として使っていたが、
   N はスライドの並びと一致しないことがある（並べ替え・削除のあと）。さらに**非表示のスライドはPDFに書き出されない**ので、
   そのままだとノートが1枚ずつずれる。ここでは presentation.xml の並びと各スライドの関係ファイルからノートを引き、
   非表示（show="0"）も返す。PDFとの突き合わせは align.js。 */
import { readZipEntries } from "../../../learning/admin/pptxNotes.js";

const parse = text => new DOMParser().parseFromString(text || "", "application/xml");
const textOf = (doc, { skipFields = false } = {}) => [...doc.getElementsByTagName("a:t")]
  .filter(n => !(skipFields && n.parentNode?.nodeName === "a:fld"))
  .map(n => n.textContent.trim()).filter(Boolean).join("\n");

function relTargets(xml) {
  const map = new Map();
  for (const r of parse(xml).getElementsByTagName("Relationship")) map.set(r.getAttribute("Id"), { target: r.getAttribute("Target") || "", type: r.getAttribute("Type") || "" });
  return map;
}
// "slides/slide3.xml"（presentation.xml からの相対）や "../notesSlides/notesSlide3.xml"（slides/ からの相対）を ppt/ からの名前に
const resolve = (base, target) => {
  const parts = (base + target).split("/");
  const out = [];
  for (const p of parts) { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); }
  return out.join("/");
};

// [{ index（1から。非表示も数える）, hidden, title, text, notes }]
export async function readPptxSlides(file) {
  const entries = await readZipEntries(file, /^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|slides\/slide\d+\.xml|slides\/_rels\/slide\d+\.xml\.rels|notesSlides\/notesSlide\d+\.xml)$/);
  const by = new Map(entries.map(e => [e.name, e.text]));
  const pres = parse(by.get("ppt/presentation.xml"));
  const presRels = relTargets(by.get("ppt/_rels/presentation.xml.rels"));
  const order = [...pres.getElementsByTagName("p:sldId")].map(el => el.getAttribute("r:id"));
  const slides = [];
  order.forEach((rid, i) => {
    const rel = presRels.get(rid);
    if (!rel) return;
    const name = resolve("ppt/", rel.target);
    const xml = by.get(name);
    if (!xml) return;
    const doc = parse(xml);
    const root = doc.documentElement;
    const hidden = root?.getAttribute("show") === "0";
    const text = textOf(doc, { skipFields: true });
    const relsName = name.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels");
    let notes = "";
    for (const r of relTargets(by.get(relsName)).values()) {
      if (/\/notesSlide$/.test(r.type)) { notes = textOf(parse(by.get(resolve("ppt/slides/", r.target))), { skipFields: true }); break; }
    }
    slides.push({ index: i + 1, hidden, title: text.split("\n")[0] || "", text, notes: notes.replace(/\n{3,}/g, "\n\n").trim() });
  });
  return slides;
}
