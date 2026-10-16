import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PRISM } from "./theme.js";

/* 長い一覧のページ送り（2026-10-16、モック client-screens.html。「長いところはどこも同じページ送り」のユーザー指定）。
   const pg = usePaged(rows, 20); … pg.rows を出して <Pager {...pg} unit="名" /> を一覧の下に置く。
   一覧が変わって今のページが無くなったら最後のページへ寄せる */
export function usePaged(list, per = 20) {
  const all = Array.isArray(list) ? list : [];
  const [size, setSize] = useState(per);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(all.length / size));
  useEffect(() => { if (page > pages - 1) setPage(pages - 1); }, [page, pages]);
  const p = Math.min(page, pages - 1);
  const rows = useMemo(() => all.slice(p * size, p * size + size), [all, p, size]);
  return { rows, page: p, pages, total: all.length, size, setPage, setSize: n => { setSize(n); setPage(0); } };
}

// 数字のボタンは前後2つと端だけ（多いときは … で省く）
function pageList(p, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i);
  const s = new Set([0, pages - 1, p - 1, p, p + 1].filter(i => i >= 0 && i < pages));
  const out = []; let prev = -1;
  [...s].sort((a, b) => a - b).forEach(i => { if (i - prev > 1) out.push("…" + i); out.push(i); prev = i; });
  return out;
}

export default function Pager({ page, pages, total, size, setPage, setSize, unit = "件", sizes = [20, 50, 100] }) {
  if (!total) return null;
  const from = page * size + 1, to = Math.min(total, page * size + size);
  const btn = { minWidth: 30, height: 30, borderRadius: 8, border: `1px solid ${PRISM.line2}`, background: PRISM.surface, color: PRISM.ink, fontSize: 13, fontWeight: 700, padding: "0 6px", display: "inline-grid", placeItems: "center" };
  return (
    <nav className="flex flex-wrap items-center gap-2 px-4 py-3" aria-label="ページ" style={{ borderTop: `1px solid ${PRISM.line}` }}>
      <small className="tabular-nums" style={{ color: PRISM.sub, fontSize: 12.5 }}>{from}〜{to} / {total}{unit}</small>
      {pages > 1 && (
        <span className="ml-auto flex items-center gap-1">
          <button type="button" style={{ ...btn, opacity: page > 0 ? 1 : 0.35 }} disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="前のページ"><ChevronLeft size={16} /></button>
          {pageList(page, pages).map(i => typeof i === "string"
            ? <span key={i} style={{ color: PRISM.mut, padding: "0 2px" }}>…</span>
            : <button key={i} type="button" aria-current={i === page ? "page" : undefined} onClick={() => setPage(i)} style={{ ...btn, ...(i === page ? { background: PRISM.ink, color: "#fff", borderColor: PRISM.ink } : {}) }}>{i + 1}</button>)}
          <button type="button" style={{ ...btn, opacity: page < pages - 1 ? 1 : 0.35 }} disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="次のページ"><ChevronRight size={16} /></button>
        </span>
      )}
      {setSize && total > sizes[0] && (
        <label className={`flex items-center gap-1.5 text-xs ${pages > 1 ? "" : "ml-auto"}`} style={{ color: PRISM.sub }}>表示
          <select value={size} onChange={e => setSize(Number(e.target.value))} className="rounded-lg px-1.5 py-1 text-xs" style={{ border: `1px solid ${PRISM.line2}`, background: PRISM.surface, color: PRISM.ink }}>
            {sizes.map(n => <option key={n} value={n}>{n}{unit}</option>)}
          </select>
        </label>
      )}
    </nav>
  );
}
