/* PPTXから発表者ノートだけを取り出す。2026-08 のスライド取り込みで書いたものを、
 * コース生成（PdfCourseImporter）からも使えるように切り出した（2026-09-16 打合せ）。
 *
 * **スライドの見た目はPDFエクスポート版から作る。** PPTXをブラウザで忠実に描くことはできないため。
 * ここが扱うのは notesSlides/notesSlideN.xml だけで、1ページ目からの通し番号で返す。
 * ZIPを自前で読むのは、この1機能のためにライブラリを増やさないため。 */

function readUint32(view, offset) {
  return view.getUint32(offset, true);
}

function readUint16(view, offset) {
  return view.getUint16(offset, true);
}

function decodeText(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

async function inflateRaw(bytes) {
  if (!("DecompressionStream" in window)) {
    throw new Error("このブラウザはPPTX内の圧縮XML展開に対応していません。Chrome/Edgeでお試しください。");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZipEntries(file, wantedPattern) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (readUint32(view, i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("PPTXのZIP構造を読み取れませんでした。");

  const entryCount = readUint16(view, eocdOffset + 10);
  let centralOffset = readUint32(view, eocdOffset + 16);
  const found = [];
  for (let i = 0; i < entryCount; i += 1) {
    if (readUint32(view, centralOffset) !== 0x02014b50) throw new Error("PPTXの中央ディレクトリを読み取れませんでした。");
    const method = readUint16(view, centralOffset + 10);
    const compressedSize = readUint32(view, centralOffset + 20);
    const nameLength = readUint16(view, centralOffset + 28);
    const extraLength = readUint16(view, centralOffset + 30);
    const commentLength = readUint16(view, centralOffset + 32);
    const localOffset = readUint32(view, centralOffset + 42);
    const name = decodeText(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength));
    if (wantedPattern.test(name)) found.push({ name, method, compressedSize, localOffset });
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  const entries = [];
  for (const entry of found) {
    if (readUint32(view, entry.localOffset) !== 0x04034b50) throw new Error(`${entry.name}を読み取れませんでした。`);
    const localNameLength = readUint16(view, entry.localOffset + 26);
    const localExtraLength = readUint16(view, entry.localOffset + 28);
    const dataStart = entry.localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);
    const data = entry.method === 0 ? compressed : entry.method === 8 ? await inflateRaw(compressed) : null;
    if (!data) throw new Error(`${entry.name}の圧縮形式に対応していません。`);
    entries.push({ name: entry.name, text: decodeText(data) });
  }
  return entries;
}

function extractNoteText(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) return "";
  return [...doc.getElementsByTagName("a:t")]
    .map(node => node.textContent.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPptxNotesByPage(file) {
  const entries = await readZipEntries(file, /^ppt\/notesSlides\/notesSlide\d+\.xml$/);
  const notes = new Map();
  for (const entry of entries) {
    const match = entry.name.match(/notesSlide(\d+)\.xml$/);
    const pageNum = match ? Number(match[1]) : 0;
    const text = extractNoteText(entry.text);
    if (pageNum && text) notes.set(pageNum, text);
  }
  return notes;
}
