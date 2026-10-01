import React, { useEffect, useRef, useState } from "react";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { T, SkeletonRows } from "../../components/common";

/* テスト作成で教材を選んだときに出す、ページの見本（2026-10-01 ユーザー指定）。
   ページ数を別に確かめに行かなくてよいように、縮小したページを並べ、押して範囲を選べるようにする。
   1回目に押したページが先頭、2回目に押したページまでが範囲。もう一度押すと選び直し。
   pdfjs-dist は動的importでしか読まない。 */
const MAX_THUMBS = 120;
const THUMB_W = 112;

export default function PdfPageStrip({ getUrl, materialKey, from, to, onRange }) {
  const [numPages, setNumPages] = useState(0);
  const [state, setState] = useState("loading");
  const [anchor, setAnchor] = useState(0);
  const holderRef = useRef(null);
  const docRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    setState("loading"); setNumPages(0); setAnchor(0);
    (async () => {
      const url = await getUrl();
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) throw new Error("fetch " + res.status);
      const buf = await res.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      if (!alive) { doc.destroy(); return; }
      docRef.current = doc;
      setNumPages(doc.numPages);
      setState("ready");
      // 1枚ずつ小さく描く（全部を一度に描くと重い）
      for (let i = 1; i <= Math.min(doc.numPages, MAX_THUMBS); i += 1) {
        if (!alive) return;
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (THUMB_W * 2) / base.width });
        const canvas = holderRef.current?.querySelector(`canvas[data-page="${i}"]`);
        if (!canvas) continue;
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      }
    })().catch(e => { if (alive && e?.name !== "AbortError") setState("error"); });
    return () => { alive = false; ac.abort(); docRef.current?.destroy?.(); docRef.current = null; };
  }, [materialKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(p) {
    if (!anchor) { setAnchor(p); onRange(p, p); return; }
    onRange(Math.min(anchor, p), Math.max(anchor, p));
    setAnchor(0);
  }
  if (state === "error") return <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: T.warningSubtle, color: T.warning }}>ページの見本を出せませんでした。ページ範囲は数字で入れてください。</div>;
  if (state === "loading") return <div className="mt-3"><SkeletonRows rows={2} /></div>;
  const lo = Number(from) > 0 ? Number(from) : 1;
  const hi = Number(to) > 0 ? Number(to) : numPages;
  const pages = Array.from({ length: Math.min(numPages, MAX_THUMBS) }, (_, i) => i + 1);
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold" style={{ color: T.textMuted }}>
        <span className="tabular-nums">全{numPages}ページ</span>
        <span className="tabular-nums" style={{ color: T.accentHover }}>{lo}〜{hi}ページを使う</span>
        {anchor > 0 && <span style={{ color: T.warning }}>{anchor}ページから。終わりのページを押す</span>}
        {(Number(from) > 0 || Number(to) > 0) && <button type="button" onClick={() => { setAnchor(0); onRange("", ""); }} className="font-bold" style={{ color: T.accentHover }}>全ページに戻す</button>}
      </div>
      <div ref={holderRef} className="flex gap-2 overflow-x-auto pb-2">
        {pages.map(p => {
          const on = p >= lo && p <= hi;
          return (
            <button key={p} type="button" onClick={() => pick(p)} aria-pressed={on} aria-label={`${p}ページ`}
              className="shrink-0 rounded-lg p-1 text-center transition"
              style={{ width: THUMB_W + 10, background: on ? T.accentSubtle : "#fff", border: `2px solid ${anchor === p ? T.warning : on ? T.accent : T.border}`, opacity: on ? 1 : 0.55 }}>
              <canvas data-page={p} className="block w-full rounded" style={{ background: T.bgBase, aspectRatio: "auto 4 / 3" }} />
              <span className="mt-1 block text-[11px] font-bold tabular-nums" style={{ color: on ? T.accentHover : T.textMuted }}>{p}</span>
            </button>
          );
        })}
      </div>
      {numPages > MAX_THUMBS && <div className="text-xs" style={{ color: T.textMuted }}>見本は先頭{MAX_THUMBS}ページまでです。</div>}
    </div>
  );
}
