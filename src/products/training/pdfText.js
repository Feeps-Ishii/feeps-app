import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/* 教材PDFから、ページごとの本文を取り出す（2026-09-16 打合せ）。
 *
 * **問題はコースの教材から作る。** 手で貼り直させないために、ここでテキストを引く。
 * サーバでPDFを開く仕組みは無いので、**ブラウザで開いて本文だけを送る**。
 * pdfjs-dist は動的importでしか読まない（使う人だけが読み込む）。
 *
 * ページ番号をそのまま持ち帰るのが肝。あとで「何ページを見ればいいか」を示すのに使う。 */

const MAX_PAGES = 60;        // AIへ渡せる現実的な上限
const MAX_CHARS_PER_PAGE = 1500;

export async function extractPdfPageTexts(url, { maxPages = MAX_PAGES, signal } = {}) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("教材を取得できませんでした（" + res.status + "）。");
  const buf = await res.arrayBuffer();
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const numPages = doc.numPages;
  const pages = [];
  try {
    for (let i = 1; i <= Math.min(numPages, maxPages); i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str || "").join(" ").replace(/\s+/g, " ").trim();
      // 文字が取れないページ（画像だけのスライド等）は、無いものとして扱う。
      // **空文字を送っても問題は作れない**ので、送らないほうが誤解が少ない
      if (text) pages.push({ page: i, text: text.slice(0, MAX_CHARS_PER_PAGE) });
    }
  } finally {
    doc.destroy?.();
  }
  return { pages, numPages, limit: maxPages, truncated: numPages > maxPages };
}

/* 読み取り結果の説明。**0ページと「読めなかった」を混同させない** */
export function describeExtraction({ pages, numPages, truncated, limit = MAX_PAGES }) {
  if (!pages.length) {
    return `${numPages}ページを開きましたが、文字を取り出せませんでした。画像だけのPDFの可能性があります。`;
  }
  const head = `${numPages}ページ中 ${pages.length}ページ分の本文を読み取りました。`;
  return truncated ? `${head} （先頭${limit}ページまでを対象にしています）` : head;
}
