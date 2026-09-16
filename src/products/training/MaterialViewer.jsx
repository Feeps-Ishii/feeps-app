import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { apiGet } from "../../api.js";
import { Card, Btn, T, SkeletonRows } from "../../components/common";
import { AlertCircle, ChevronLeft, ChevronRight, ExternalLink, Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";

/* 教材ビューア。正典: docs/specs/training-notes-spec.md 6.1
 *
 * **アプリの中で教材を開く**ための部品。横にノート（LessonNoteDock）を並べて
 * 「読みながら書く」を成立させるのが目的なので、ここは表示だけを持ち、
 * ノートの置き方は呼び出し側（研修資料・カリキュラム）が決める。
 *
 * **pdfjs-dist は動的importでしか読まない。** 教材を開いた人だけが読み込む。
 * PDF以外（Excel・PowerPoint等）はブラウザに任せて別タブで開く。 */

const PDF_RE = /\.pdf$/i;
const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

function kindOf(material) {
  const name = String(material?.filename || material?.title || "");
  if (PDF_RE.test(name)) return "pdf";
  if (IMG_RE.test(name)) return "image";
  return "other";
}

/* 1ページをcanvasへ描く。**幅は親が決め、拡大率はその何倍かで持つ**（ピクセルで持つと端末で変わる）。
   端末の解像度(dpr)ぶんだけ実ピクセルを増やし、CSSサイズは論理pxのままにする。
   戻り値は pdf.js のレンダータスク（呼び出し側が cancel できるように返す）。 */
export function renderPdfPageToCanvas({ page, canvas, width, zoom = 1, maxDpr = 2 }) {
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: (width / base.width) * zoom });
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return page.render({ canvasContext: ctx, viewport });
}

export default function MaterialViewer({ courseId, material, onClose, onPage }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const docRef = useRef(null);

  const [url, setUrl] = useState("");
  const [kind, setKind] = useState(() => kindOf(material));
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);        // 1 = 幅に合わせる
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [docVersion, setDocVersion] = useState(0);

  useEffect(() => { onPage?.(page); }, [page, onPage]);

  /* 幅を見てから描く（先に描くと拡大率がずれる） */
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(prev => (Math.abs(prev - el.clientWidth) < 2 ? prev : el.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* 署名URLを取って、PDFなら読み込む */
  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    setLoading(true); setErr(""); setPage(1); setZoom(1);
    setKind(kindOf(material));
    docRef.current?.destroy?.();
    docRef.current = null;
    setNumPages(0); setDocVersion(v => v + 1);

    (async () => {
      const r = await apiGet(`/materials/view?courseId=${encodeURIComponent(courseId)}&materialId=${encodeURIComponent(material.materialId)}`);
      if (!alive) return;
      setUrl(r?.url || "");
      if (kindOf(material) !== "pdf") { setLoading(false); return; }
      // 署名URLをそのまま pdf.js に渡すとRange要求になるので、1回のGETで全部取る
      const res = await fetch(r.url, { signal: ac.signal });
      if (!res.ok) throw new Error("fetch " + res.status);
      const buf = await res.arrayBuffer();
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      if (!alive) { doc.destroy(); return; }
      docRef.current = doc;
      setNumPages(doc.numPages);
      setDocVersion(v => v + 1);
      setLoading(false);
    })().catch(e => {
      if (!alive || e?.name === "AbortError") return;
      setErr("教材を開けませんでした。別タブで開くこともできます。");
      setLoading(false);
    });

    return () => { alive = false; ac.abort(); };
  }, [courseId, material.materialId, reloadKey]);

  /* 画面から消えるときはPDFを解放する（開きっぱなしにするとメモリを持っていかれる） */
  useEffect(() => () => { docRef.current?.destroy?.(); docRef.current = null; }, []);

  /* ページを描く */
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || !canvasRef.current || !width) return undefined;
    let cancelled = false;
    let task = null;
    (async () => {
      const p = await doc.getPage(page);
      if (cancelled || !canvasRef.current) return;
      task = renderPdfPageToCanvas({ page: p, canvas: canvasRef.current, width, zoom });
      await task.promise;
    })().catch(e => {
      if (cancelled || e?.name === "RenderingCancelledException") return;
      setErr("このページを表示できませんでした。");
    });
    return () => { cancelled = true; task?.cancel?.(); };
  }, [docVersion, page, zoom, width]);

  const openTab = () => { if (url) window.open(url, "_blank", "noopener"); };
  const go = d => setPage(p => Math.min(Math.max(1, p + d), Math.max(1, numPages)));

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: T.border }}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold" style={{ color: T.textPrimary }}>{material.title || material.filename}</div>
          <div className="text-xs" style={{ color: T.textMuted }}>
            {kind === "pdf" ? (numPages ? `${numPages}ページ` : "読み込み中…") : kind === "image" ? "画像" : "この形式はアプリ内で開けません"}
          </div>
        </div>
        <Btn kind="ghost" size="sm" icon={ExternalLink} onClick={openTab} disabled={!url}>別タブ</Btn>
        {onClose && <Btn kind="ghost" size="sm" icon={X} onClick={onClose}>閉じる</Btn>}
      </div>

      {err ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-4 text-sm" style={{ color: T.danger }}>
          <AlertCircle size={16} />{err}
          <Btn kind="ghost" size="sm" icon={RotateCcw} onClick={() => setReloadKey(k => k + 1)}>再読み込み</Btn>
        </div>
      ) : loading ? (
        <div className="p-4"><SkeletonRows rows={5} /></div>
      ) : kind === "other" ? (
        <div className="px-4 py-8 text-center text-sm" style={{ color: T.textMuted }}>
          PDFと画像はここで開けます。この資料は別タブで開いてください。
        </div>
      ) : null}

      {/* 表示面。**ノートと横に並べる前提なので、幅は親が決める** */}
      <div ref={wrapRef} className="overflow-auto px-4 py-4" style={{ maxHeight: "76vh", background: T.bgBase }}>
        {!err && kind === "pdf" && <canvas ref={canvasRef} className="mx-auto block" style={{ boxShadow: "0 1px 6px rgba(0,0,0,.14)" }} />}
        {!err && kind === "image" && url && (
          <img src={url} alt={material.title || "教材"} className="mx-auto block max-w-full" style={{ width: `${Math.round(zoom * 100)}%` }} />
        )}
      </div>

      {!err && (kind === "pdf" || kind === "image") && (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5" style={{ borderColor: T.border }}>
          {kind === "pdf" && (
            <>
              <Btn kind="ghost" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => go(-1)}>前</Btn>
              <span className="text-xs font-bold tabular-nums" style={{ color: T.textSecondary }}>{page} / {numPages || "—"}</span>
              <Btn kind="ghost" size="sm" icon={ChevronRight} disabled={!numPages || page >= numPages} onClick={() => go(1)}>次</Btn>
            </>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Btn kind="ghost" size="sm" icon={Minus} onClick={() => setZoom(z => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}>縮小</Btn>
            <span className="text-xs font-bold tabular-nums" style={{ color: T.textMuted }}>{Math.round(zoom * 100)}%</span>
            <Btn kind="ghost" size="sm" icon={Plus} onClick={() => setZoom(z => Math.min(3, Math.round((z + 0.25) * 100) / 100))}>拡大</Btn>
            <Btn kind="ghost" size="sm" icon={Maximize2} onClick={() => setZoom(1)}>幅に合わせる</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}
