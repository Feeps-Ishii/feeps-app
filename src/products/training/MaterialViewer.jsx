import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { apiGet, apiPut } from "../../api.js";
import { Card, Btn, T, SkeletonRows } from "../../components/common";
import InkLayer, { INK_COLORS } from "./InkLayer.jsx";
import {
  AlertCircle, ChevronLeft, ChevronRight, Eraser, ExternalLink, Hand, Highlighter, Maximize2,
  Minus, Pencil, Plus, Redo2, RotateCcw, Slash, Square, Trash2, Type, Undo2, X,
} from "lucide-react";

/* 教材ビューア。正典: docs/specs/training-notes-spec.md 6.1
 *
 * **アプリの中で教材を開く**ための部品。横にノート（LessonNoteDock）を並べて
 * 「読みながら書く」を成立させるのが目的なので、ここは表示だけを持ち、
 * ノートの置き方は呼び出し側（研修資料・カリキュラム）が決める。
 *
 * **pdfjs-dist は動的importでしか読まない。** 教材を開いた人だけが読み込む。
 * PDF以外（Excel・PowerPoint等）はブラウザに任せて別タブで開く。 */

// 既定の表示倍率。**幅いっぱいの75%を「100%」として開く**（2026-09-16 打合せ）。
// 幅いっぱいだと横に余白が無く、ノートと並べたときに文字が大きすぎる。
const BASE_FIT = 0.75;

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
  // 書き込みのレイヤをぴったり重ねるので、CSS上の大きさも返す
  return {
    task: page.render({ canvasContext: ctx, viewport }),
    width: Math.floor(viewport.width),
    height: Math.floor(viewport.height),
  };
}

/* 書き込みの道具。**6色固定**（迷わせない）。太さは3段だけ持つ */
const TOOLS = [
  { kind: "hand",   label: "手のひら",   icon: Hand },
  { kind: "pen",    label: "ペン",       icon: Pencil,      widths: [2, 3, 6] },
  { kind: "marker", label: "マーカー",   icon: Highlighter, widths: [10, 14, 20] },
  { kind: "line",   label: "直線",       icon: Slash,       widths: [2, 3, 6] },
  { kind: "rect",   label: "四角",       icon: Square,      widths: [2, 3, 6] },
  { kind: "text",   label: "文字",       icon: Type,        widths: [3, 4, 6] },
  { kind: "eraser", label: "消しゴム",   icon: Eraser },
];
const WIDTH_LABELS = ["細", "中", "太"];
const MAX_UNDO = 50;

export default function MaterialViewer({ courseId, material, onClose, onPage, lessonId, canAnnotate = false }) {
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
  const [pageSize, setPageSize] = useState({ w: 0, h: 0 });

  /* ---- 教材への書き込み（PDF直書き） ---- */
  const [tool, setTool] = useState({ kind: "hand", color: 0, w: 3 });
  const [strokes, setStrokes] = useState([]);
  const [hist, setHist] = useState({ undo: [], redo: [] });
  const [inkState, setInkState] = useState("idle");   // idle | loading | error | saving | saved | saveerror
  const [inkReload, setInkReload] = useState(0);
  const pendingRef = useRef(null);                     // { page, strokes } … まだ保存していないもの
  const flushRef = useRef(null);
  // 書けるのは受講生だけ。単元が決まらないと刺す先が無いので書かせない（ノート全体の決まり）
  const inkReady = canAnnotate && kind === "pdf" && !!lessonId;

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
      const r = renderPdfPageToCanvas({ page: p, canvas: canvasRef.current, width, zoom: zoom * BASE_FIT });
      task = r.task;
      setPageSize(prev => (prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
      await task.promise;
    })().catch(e => {
      if (cancelled || e?.name === "RenderingCancelledException") return;
      setErr("このページを表示できませんでした。");
    });
    return () => { cancelled = true; task?.cancel?.(); };
  }, [docVersion, page, zoom, width]);

  /* このページの書き込みを読む。
     **読めなかったときは書かせない。** 空のまま書き足して保存すると、前に書いたものを消してしまう。 */
  useEffect(() => {
    if (!inkReady) { setStrokes([]); setHist({ undo: [], redo: [] }); return undefined; }
    let alive = true;
    setInkState("loading"); setStrokes([]); setHist({ undo: [], redo: [] });
    apiGet(`/notes/ink?courseId=${encodeURIComponent(courseId)}&materialId=${encodeURIComponent(material.materialId)}&page=${page}`)
      .then(r => { if (!alive) return; setStrokes(Array.isArray(r?.strokes) ? r.strokes : []); setInkState("idle"); })
      .catch(() => { if (alive) setInkState("error"); })
      .finally(() => {});
    return () => { alive = false; };
  }, [inkReady, courseId, material.materialId, page, inkReload]);

  /* 保存。**ページを持ったまま覚えておく**（保存前にページを送っても、別のページへ書き込まない） */
  const flush = useCallback(async () => {
    const p = pendingRef.current;
    if (!p || !inkReady) return;
    pendingRef.current = null;
    setInkState("saving");
    try {
      await apiPut("/notes/ink", {
        courseId, lessonId, materialId: material.materialId, page: p.page, strokes: p.strokes,
      });
      setInkState("saved");
    } catch {
      pendingRef.current = p;      // 捨てない。次の機会にもう一度出す
      setInkState("saveerror");
    }
  }, [courseId, lessonId, material.materialId, inkReady]);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  // 書き終わって少し経ったら保存する（1本ごとに通信しない）
  useEffect(() => {
    if (!pendingRef.current) return undefined;
    const t = setTimeout(() => { flushRef.current?.(); }, 800);
    return () => clearTimeout(t);
  }, [strokes]);

  // ページを移るとき・閉じるときは、溜まっているぶんを必ず出す
  useEffect(() => () => { flushRef.current?.(); }, [page]);

  const applyStrokes = useCallback(next => {
    setStrokes(cur => {
      setHist(h => ({ undo: [...h.undo, cur].slice(-MAX_UNDO), redo: [] }));
      pendingRef.current = { page, strokes: next };
      return next;
    });
  }, [page]);

  const undo = () => setHist(h => {
    if (!h.undo.length) return h;
    const prev = h.undo[h.undo.length - 1];
    setStrokes(cur => { pendingRef.current = { page, strokes: prev }; return prev; });
    return { undo: h.undo.slice(0, -1), redo: [...h.redo, strokes].slice(-MAX_UNDO) };
  });
  const redo = () => setHist(h => {
    if (!h.redo.length) return h;
    const next = h.redo[h.redo.length - 1];
    setStrokes(cur => { pendingRef.current = { page, strokes: next }; return next; });
    return { undo: [...h.undo, strokes].slice(-MAX_UNDO), redo: h.redo.slice(0, -1) };
  });
  const clearPage = () => { if (strokes.length) applyStrokes([]); };

  const pickTool = kindName => setTool(t => {
    const def = TOOLS.find(x => x.kind === kindName);
    const widths = def?.widths;
    return { ...t, kind: kindName, w: widths ? (widths.includes(t.w) ? t.w : widths[1]) : t.w };
  });
  const toolDef = TOOLS.find(t => t.kind === tool.kind);

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
          {material.description && <div className="mt-1 whitespace-pre-line text-xs leading-relaxed" style={{ color: T.textSecondary }}>{material.description}</div>}
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

      {/* 書き込みの道具。**PDFそのものは書き換えない**ので、いつでも消せる */}
      {!err && !loading && inkReady && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: T.border, background: T.bgSurface }}>
          <div className="flex overflow-hidden rounded-xl" style={{ boxShadow: `inset 0 0 0 1px ${T.border}` }}>
            {TOOLS.map(t => (
              <button key={t.kind} type="button" onClick={() => pickTool(t.kind)} title={t.label} aria-pressed={tool.kind === t.kind}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold"
                style={{
                  background: tool.kind === t.kind ? T.accentSubtle : "transparent",
                  color: tool.kind === t.kind ? T.accentHover : T.textSecondary,
                }}>
                <t.icon size={14} />
              </button>
            ))}
          </div>

          {tool.kind !== "hand" && tool.kind !== "eraser" && (
            <>
              <div className="flex items-center gap-1">
                {INK_COLORS.map((c, i) => (
                  <button key={c} type="button" onClick={() => setTool(t => ({ ...t, color: i }))} aria-label={`色${i + 1}`}
                    className="h-6 w-6 rounded-full"
                    style={{ background: c, boxShadow: tool.color === i ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "inset 0 0 0 1px rgba(0,0,0,.15)" }} />
                ))}
              </div>
              {toolDef?.widths && (
                <div className="flex overflow-hidden rounded-lg" style={{ boxShadow: `inset 0 0 0 1px ${T.border}` }}>
                  {toolDef.widths.map((w, i) => (
                    <button key={w} type="button" onClick={() => setTool(t => ({ ...t, w }))}
                      className="px-2 py-1.5 text-xs font-bold"
                      style={{ background: tool.w === w ? T.accentSubtle : "transparent", color: tool.w === w ? T.accentHover : T.textMuted }}>
                      {WIDTH_LABELS[i]}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs" style={{ color: inkState === "saveerror" || inkState === "error" ? T.danger : T.textMuted }}>
              {inkState === "loading" ? "書き込みを読み込み中…"
                : inkState === "error" ? "書き込みを読めませんでした（消さないため、書き込みを止めています）"
                : inkState === "saving" ? "保存中…"
                : inkState === "saveerror" ? "保存できませんでした。もう一度書くか、時間をおいてください"
                : inkState === "saved" ? "保存しました" : ""}
            </span>
            {inkState === "error" && <Btn kind="ghost" size="sm" icon={RotateCcw} onClick={() => setInkReload(k => k + 1)}>再試行</Btn>}
            <Btn kind="ghost" size="sm" icon={Undo2} disabled={!hist.undo.length} onClick={undo}>戻す</Btn>
            <Btn kind="ghost" size="sm" icon={Redo2} disabled={!hist.redo.length} onClick={redo}>やり直す</Btn>
            <Btn kind="ghost" size="sm" icon={Trash2} disabled={!strokes.length} onClick={clearPage}>このページを消す</Btn>
          </div>
        </div>
      )}
      {!err && !loading && canAnnotate && kind === "pdf" && !lessonId && (
        <div className="border-b px-4 py-2 text-xs" style={{ borderColor: T.border, color: T.textMuted }}>
          単元が決まっていないため書き込みはできません。カリキュラムが読み込まれると書けるようになります。
        </div>
      )}

      {/* 表示面。**ノートと横に並べる前提なので、幅は親が決める** */}
      <div ref={wrapRef} className="overflow-auto px-4 py-4" style={{ maxHeight: "76vh", background: T.bgBase }}>
        {!err && kind === "pdf" && (
          <div className="relative mx-auto" style={{ width: pageSize.w || undefined, height: pageSize.h || undefined }}>
            <canvas ref={canvasRef} className="block" style={{ boxShadow: "0 1px 6px rgba(0,0,0,.14)" }} />
            {inkReady && pageSize.w > 0 && (
              <InkLayer
                width={pageSize.w} height={pageSize.h} strokes={strokes} tool={tool}
                disabled={inkState === "loading" || inkState === "error"}
                onCommit={applyStrokes}
              />
            )}
          </div>
        )}
        {!err && kind === "image" && url && (
          <img src={url} alt={material.title || "教材"} className="mx-auto block max-w-full" style={{ width: `${Math.round(zoom * BASE_FIT * 100)}%` }} />
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
            <Btn kind="ghost" size="sm" icon={Maximize2} onClick={() => setZoom(zoom === 1 ? 1 / BASE_FIT : 1)}>{zoom === 1 ? "幅いっぱい" : "既定に戻す"}</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}
