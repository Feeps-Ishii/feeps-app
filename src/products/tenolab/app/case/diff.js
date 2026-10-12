/* プルリクの差分（はじめのコード → いまのコード）。行単位の LCS。教材のコードは数百行までなので素直に作る。
   返す形：[{ t: "same" | "add" | "del", s, a?, b? }]（a = はじめの行番号、b = いまの行番号。1 から） */
export function lineDiff(before, after) {
  const A = String(before || "").split("\n"), B = String(after || "").split("\n");
  const n = A.length, m = B.length;
  if (n * m > 400000) {
    // 大きすぎるときは全部入れ替えとして出す
    return [...A.map((s, i) => ({ t: "del", s, a: i + 1 })), ...B.map((s, j) => ({ t: "add", s, b: j + 1 }))];
  }
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: "same", s: A[i], a: i + 1, b: j + 1 }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ t: "del", s: A[i], a: i + 1 }); i++; }
    else { out.push({ t: "add", s: B[j], b: j + 1 }); j++; }
  }
  while (i < n) { out.push({ t: "del", s: A[i], a: i + 1 }); i++; }
  while (j < m) { out.push({ t: "add", s: B[j], b: j + 1 }); j++; }
  return out;
}

// 変わった行の前後 ctx 行だけを残し、間を { t: "gap" } で区切る。keep（いまの行番号）は必ず残す（レビューのコメントの行）
export function hunks(rows, ctx = 2, keep = []) {
  const show = new Set();
  const keepSet = new Set(keep);
  rows.forEach((r, k) => {
    if (r.t !== "same" || keepSet.has(r.b)) for (let x = Math.max(0, k - ctx); x <= Math.min(rows.length - 1, k + ctx); x++) show.add(x);
  });
  const out = [];
  let prev = -2;
  [...show].sort((x, y) => x - y).forEach(k => {
    if (k !== prev + 1) out.push({ t: "gap" });
    out.push(rows[k]);
    prev = k;
  });
  return out;
}

export const diffStat = rows => ({ add: rows.filter(r => r.t === "add").length, del: rows.filter(r => r.t === "del").length });
