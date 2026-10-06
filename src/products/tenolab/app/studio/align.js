/* PDFのページとパワポのスライド（ノート）の突き合わせ（教材づくりの「位置合わせ」）。
   PDFはパワポの書き出しなので、ページの文字とスライドの文字はほぼ同じになる。これで対応を決め、ずれを見つける。
   - 非表示のスライドを除いた枚数がPDFのページ数と同じなら、その順で対応させる
   - 枚数が違うときは、文字の似かたで順に対応させる（前後3枚の中でいちばん似ているもの）
   ノートは「どのスライドのノートを付けるか（noteSrc）」で持ち、↑↓とまとめてずらす操作はこれを動かす。 */

const norm = s => String(s || "").replace(/\s+/g, "").toLowerCase();
function grams(s) {
  const t = norm(s), set = new Set();
  for (let i = 0; i < t.length - 1; i += 1) set.add(t.slice(i, i + 2));
  return set;
}
// 0〜1。どちらかの文字が少なすぎると判断しない（null）
export function similarity(a, b) {
  const A = grams(a), B = grams(b);
  if (A.size < 4 || B.size < 4) return null;
  let both = 0;
  for (const g of A) if (B.has(g)) both += 1;
  return both / Math.min(A.size, B.size);
}

// 最初の対応。pages: [{ page, text }]、slides: readPptxSlides の結果 → noteSrc: ページごとのスライドの位置（slides の添字。無ければ -1）
export function initialMapping(pages, slides) {
  if (!slides.length) return pages.map(() => -1);
  const visible = slides.map((s, i) => (s.hidden ? -1 : i)).filter(i => i >= 0);
  if (visible.length === pages.length) return visible;
  if (slides.length === pages.length) return slides.map((_, i) => i);
  const out = [];
  let j = 0;
  for (const p of pages) {
    let best = -1, bestSim = -1;
    for (let k = j; k < Math.min(slides.length, j + 4); k += 1) {
      const sim = similarity(p.text, slides[k].text) ?? 0;
      if (sim > bestSim) { best = k; bestSim = sim; }
    }
    if (best < 0) { out.push(-1); continue; }
    out.push(best);
    j = best + 1;
  }
  return out;
}

// ページごとの判定：ok（文字が合う）／off（合わないが、となりのスライドとは合う＝ずれている）／unknown（文字が少なく判断できない）
export function rowStatus(pages, slides, noteSrc) {
  return pages.map((p, i) => {
    const k = noteSrc[i];
    if (k < 0 || !slides[k]) return "unknown";
    const here = similarity(p.text, slides[k].text);
    if (here == null) return "unknown";
    if (here >= 0.45) return "ok";
    const near = [k - 1, k + 1].filter(x => slides[x]).map(x => similarity(p.text, slides[x].text) ?? 0);
    return Math.max(0, ...near) >= 0.45 && Math.max(0, ...near) > here ? "off" : "unknown";
  });
}

// ずれの直し方の提案：最初にずれているページから後ろを、前後どちらに1つずらすとよくなるか
export function shiftSuggestion(pages, slides, noteSrc, status) {
  const first = status.findIndex(s => s === "off");
  if (first < 0) return null;
  const score = src => rowStatus(pages, slides, src).filter(s => s === "ok").length;
  const base = score(noteSrc);
  let best = null;
  for (const d of [1, -1]) {
    const next = shifted(noteSrc, first, d, slides.length);
    const sc = score(next);
    if (sc > base && (!best || sc > best.score)) best = { from: first, delta: d, score: sc };
  }
  return best;
}

export function shifted(noteSrc, from, delta, max) {
  return noteSrc.map((k, i) => (i < from || k < 0 ? k : (k + delta >= 0 && k + delta < max ? k + delta : -1)));
}

// 表紙・目次（今日の流れ・アジェンダ）は、はじめから「使わない」にする
export function autoSkip(pages) {
  return pages.map((p, i) => i === 0 || /目次|アジェンダ|agenda|今日の流れ|本日の流れ/i.test(p.text.slice(0, 40)));
}
