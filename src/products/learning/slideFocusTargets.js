// 2026-08-24: スライドの中で「指せる場所」の一覧。
//
// 講義中にスライドのどこを指すかは、**座標ではなく要素の名前(ref)**で持つ。
// 画面の要素には data-focus="<ref>" が付いていて、実際の位置は表示時に測る。
// こうしておくと、画面幅が変わってもスマホでも指す場所がずれない。
//
// AIには ref と、その要素に書かれている文字だけを渡す。座標は渡さないし出させない
// （画像を見せて座標を答えさせる方法は実測でボタンから数十px外れた。2026-08-24検証）。
//
// **このファイルはBackendの utils/slideFocusTargets.mjs と同じ内容を保つこと。**
// 片方だけ直すと、AIが出したrefが画面に無い＝指せない、という壊れ方をする。
export function slideFocusTargets(slide) {
  const content = slide?.content || {};
  const out = [];
  const push = (ref, text) => {
    const value = String(text || "").trim();
    if (value) out.push({ ref, text: value });
  };

  switch (slide?.kind) {
    case "concept":
      (content.callouts || []).forEach((c, i) => push(`callout-${i}`, c?.text));
      break;
    case "summary":
      (content.points || []).forEach((p, i) => push(`point-${i}`, p));
      break;
    case "compare":
      push("left-head", content.left?.label);
      (content.left?.items || []).forEach((item, i) => push(`left-${i}`, item));
      push("right-head", content.right?.label);
      (content.right?.items || []).forEach((item, i) => push(`right-${i}`, item));
      break;
    case "table":
      (content.columns || []).forEach((col, i) => push(`col-${i}`, col));
      (content.rows || []).forEach((row, ri) => push(`row-${ri}`, Array.isArray(row) ? row.join(" / ") : row));
      break;
    case "steps":
      (content.items || []).forEach((item, i) => push(`step-${i}`, [item?.name, item?.desc].filter(Boolean).join(" / ")));
      (content.callouts || []).forEach((c, i) => push(`callout-${i}`, c?.text));
      break;
    case "columns":
      (content.columns || []).forEach((col, ci) => {
        push(`col-${ci}`, [col?.label, col?.sub].filter(Boolean).join(" "));
        (col?.items || []).forEach((item, i) => push(`col-${ci}-${i}`, [item?.k, item?.v].filter(Boolean).join(" / ")));
      });
      (content.callouts || []).forEach((c, i) => push(`callout-${i}`, c?.text));
      break;
    case "agenda":
      (content.items || []).forEach((item, i) => push(`ag-${i}`, [item?.title, item?.desc].filter(Boolean).join(" / ")));
      break;
    case "hook":
      push("hook-q", content.question);
      push("hook-turn", content.turn);
      break;
    case "work":
      push("work-task", content.task);
      break;
    case "figure":
      // 図は中の要素そのものを指す。refは図の種類ごとにデータが持っているidを使う。
      if (content.figure === "vmodel") {
        (content.pairs || []).forEach((pair, i) => {
          push(pair?.id || `v-left-${i}`, [pair?.left, pair?.leftDesc].filter(Boolean).join(" / "));
          push(pair?.rightId || `v-right-${i}`, [pair?.right, pair?.rightDesc].filter(Boolean).join(" / "));
        });
        if (content.bottom) push(content.bottom.id || "v-bottom", content.bottom.label);
      } else if (content.figure === "phaseflow") {
        (content.items || []).forEach((item, i) => push(item?.id || `p-${i}`, [item?.label, item?.meta].filter(Boolean).join(" / ")));
      } else if (content.figure === "contrast_loop") {
        (content.left?.steps || []).forEach((step, i) => push(`wf-${i}`, step));
        (content.right?.steps || []).slice(0, 4).forEach((step, i) => push(`ag-${i}`, step));
      }
      (content.callouts || []).forEach((c, i) => push(`callout-${i}`, c?.text));
      break;
    default:
      break;
  }
  return out;
}

// 保存されている指し示しの掃除。壊れたデータで画面が落ちないように、
// 使える形のものだけを通す。
export function normalizeSlideFocus(focus) {
  if (!Array.isArray(focus)) return [];
  return focus
    .map(f => {
      if (!f || typeof f !== "object") return null;
      const shape = ["spot", "box", "point"].includes(f.shape) ? f.shape : "spot";
      const atText = String(f.atText || "").trim();
      const at = Number.isInteger(f.at) ? f.at : -1;
      if (at < 0 && !atText) return null;
      // ref(自前スライド)か、rect(PDFページ画像)のどちらか。
      if (f.ref) return { at, atText, shape, ref: String(f.ref), label: String(f.label || "") };
      const nums = ["x", "y", "w", "h"].every(k => Number.isFinite(f[k]));
      if (nums) return { at, atText, shape, x: f.x, y: f.y, w: f.w, h: f.h, label: String(f.label || "") };
      return null;
    })
    .filter(Boolean);
}

// いま読んでいる文に対応する指し示しを選ぶ。
// Pollyの文の切り方と、保存時の切り方が完全に一致しないことがあるので、
// **文字での照合を先に**試し、だめなら番号で拾う。
export function focusForSentence(focusList, cue) {
  if (!focusList.length || !cue || !cue.speaking) return null;
  const sentence = String(cue.sentence || "").trim();
  if (sentence) {
    const hit = focusList.find(f => f.atText && (sentence.includes(f.atText) || f.atText.includes(sentence)));
    if (hit) return hit;
  }
  if (Number.isInteger(cue.index) && cue.index >= 0) {
    const hit = focusList.find(f => f.at === cue.index);
    if (hit) return hit;
  }
  return null;
}
