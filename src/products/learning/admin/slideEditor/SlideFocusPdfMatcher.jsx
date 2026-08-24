import React, { useMemo, useState } from "react";
import { AlertCircle, FileUp, Loader2, MousePointerClick, X } from "lucide-react";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Btn, T } from "../../../../components/common";
import { apiGet } from "../../../../api.js";
import AdminModal from "../AdminModal.jsx";
import { planSlideFocus } from "../useLearningAdmin.js";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

// 2026-08-24: PDFから作ったページ画像スライドに「指し示し」を付ける。
//
// ページ画像には画面の要素が無いので、指す場所は**PDFの中の文字の位置**から取る。
// PDFには文字が座標付きで入っているので、AIには「どの文字を指すか」だけ選ばせれば、
// 座標は機械的に決まる＝ずれない（AIに座標を答えさせると数十pxずれることを実測済み）。
//
// 取り込み済みのコースはPDFを保存していないので、**もう一度PDFを選んでもらう**。
// スライドは作り直さず、位置情報だけを足す。

// PDFの文字は下原点。画面と揃えるため上原点の0-1000グリッドへ直す。
export function toGrid(item, viewport) {
  const [, , , , x, y] = item.transform;
  return {
    x: Math.round((x / viewport.width) * 1000),
    y: Math.round(((viewport.height - y - item.height) / viewport.height) * 1000),
    w: Math.round((item.width / viewport.width) * 1000),
    h: Math.round((item.height / viewport.height) * 1000),
  };
}

// スライドがPDFの何ページかを決める。
//   1. content.sourcePage（2026-08-24以降の取り込みで入る）
//   2. 教材のタイトル末尾の「p.12」（それ以前の取り込み）
//   3. どちらも無ければ、ページ画像スライドの並び順
// 3で当てるのは危ういので、画面には決め方を出して確認してもらう。
export function resolvePages(imageSlides, materialTitleById) {
  return imageSlides.map((slide, i) => {
    const direct = Number(slide.content?.sourcePage);
    if (Number.isInteger(direct) && direct > 0) return { slide, page: direct, how: "取り込み時の記録" };
    const title = materialTitleById.get(slide.content?.materialId) || "";
    const m = title.match(/p\.\s*(\d+)\s*$/);
    if (m) return { slide, page: Number(m[1]), how: "教材名" };
    return { slide, page: i + 1, how: "並び順（要確認）" };
  });
}

export default function SlideFocusPdfMatcher({ open, lesson, slides, onClose, onApply }) {
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | reading | asking | done
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null);

  const imageSlides = useMemo(
    () => (slides || []).filter(s => s.kind === "image" && s.content?.materialId && (s.note || s.caption || s.content?.caption)),
    [slides],
  );

  function close() {
    if (phase === "reading" || phase === "asking") return;
    setFile(null); setPhase("idle"); setErrorMsg(""); setResult(null);
    onClose();
  }

  async function run() {
    if (!file) return;
    setErrorMsg("");
    setResult(null);
    setPhase("reading");
    try {
      const materials = await apiGet("/learning/admin/materials").catch(() => []);
      const materialTitleById = new Map(
        (Array.isArray(materials) ? materials : []).map(m => [m.id || m.materialId, m.title || ""]),
      );

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;

      const mapping = resolvePages(imageSlides, materialTitleById);
      // slideId -> [{ref, text, rect}]
      const perSlide = new Map();
      for (const { slide, page } of mapping) {
        if (page < 1 || page > pdf.numPages) continue;
        const pdfPage = await pdf.getPage(page);
        const viewport = pdfPage.getViewport({ scale: 1 });
        const textContent = await pdfPage.getTextContent();
        const items = [];
        textContent.items.forEach((item, i) => {
          const text = String(item.str || "").trim();
          // 1〜2文字の断片は指す対象にならないので落とす（ページ番号や記号）。
          if (text.length < 2) return;
          items.push({ ref: `t-${i}`, text, rect: toGrid(item, viewport) });
        });
        if (items.length) perSlide.set(slide.id, items);
      }

      if (!perSlide.size) {
        setPhase("idle");
        setErrorMsg("このPDFから文字を取り出せませんでした。画像だけで作られたPDF（スキャン等）は指し示しを作れません。");
        return;
      }

      setPhase("asking");
      const slideTargets = {};
      for (const [slideId, items] of perSlide) {
        slideTargets[slideId] = items.map(i => ({ ref: i.ref, text: i.text }));
      }
      const res = await planSlideFocus(lesson.id, { slideTargets });

      // AIが選んだrefを、PDFから取った実際の座標へ戻す。
      const focusBySlide = {};
      let marks = 0;
      Object.entries(res?.focus || {}).forEach(([slideId, entries]) => {
        const items = perSlide.get(slideId);
        if (!items) return;
        const byRef = new Map(items.map(i => [i.ref, i]));
        const built = entries
          .map(e => {
            const item = byRef.get(e.ref);
            if (!item) return null;
            return {
              at: e.at,
              atText: e.atText,
              shape: e.shape || "spot",
              label: e.label || "",
              ...item.rect,
            };
          })
          .filter(Boolean);
        if (built.length) { focusBySlide[slideId] = built; marks += built.length; }
      });

      setResult({
        slideCount: Object.keys(focusBySlide).length,
        marks,
        pages: mapping,
        pdfPages: pdf.numPages,
        failed: Array.isArray(res?.failedSlideIds) ? res.failedSlideIds.length : 0,
        focus: focusBySlide,
      });
      setPhase("done");
    } catch (e) {
      setPhase("idle");
      setErrorMsg(e?.errorMessage || "PDFを読み込めませんでした。");
    }
  }

  const busy = phase === "reading" || phase === "asking";

  return (
    <AdminModal
      open={open}
      title="PDFから指し示しを作る"
      desc="ページ画像のスライドに、読み上げに合わせた指し示しを付けます。取り込みに使ったPDFをもう一度選んでください。"
      onClose={close}
      width={720}
    >
      <div className="space-y-3.5">
        <div className="rounded-xl p-3 text-[11.5px] leading-relaxed" style={{ background: C.canvas, color: C.muted }}>
          指す場所はPDFの中の文字の位置から決めます。AIは「どの文字を指すか」を選ぶだけなので、位置はずれません。
          <br />
          <strong style={{ color: C.body }}>文字のない図やアイコンは指せません。</strong>
          スキャンした画像だけのPDFも対象外です。スライドは作り直しません。
        </div>

        {imageSlides.length === 0 ? (
          <div className="rounded-xl p-4 text-center text-xs" style={{ background: C.canvas, color: C.muted }}>
            このレッスンには、PDFページの画像スライドがありません。
          </div>
        ) : (
          <>
            <div className="text-[11.5px]" style={{ color: C.body }}>
              対象: ページ画像のスライド {imageSlides.length}枚（読み上げ原稿があるもの）
            </div>

            <label
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-3 transition hover:bg-black/[.02]"
              style={{ border: `1px dashed ${C.line}`, color: file ? C.ink : C.muted }}
            >
              <FileUp size={16} />
              <span className="text-[13px] font-semibold">{file ? file.name : "PDFファイルを選ぶ"}</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={busy}
                onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); setErrorMsg(""); }}
              />
            </label>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl p-3 text-[11.5px]" style={{ background: T.dangerSubtle, color: T.danger }}>
                <AlertCircle size={14} className="mt-0.5 shrink-0" />{errorMsg}
              </div>
            )}

            {result && (
              <div className="space-y-2 rounded-xl p-3.5" style={{ background: C.canvas }}>
                <div className="text-[12px] font-bold" style={{ color: C.ink }}>
                  {result.marks > 0
                    ? `${result.slideCount}枚のスライドに、合わせて${result.marks}か所の指し示しを作りました。`
                    : "指し示しを作れる場所が見つかりませんでした。"}
                </div>
                {result.failed > 0 && (
                  <div className="text-[11.5px]" style={{ color: T.warning }}>
                    {result.failed}枚は作成に失敗しました。もう一度お試しください。
                  </div>
                )}
                <div className="text-[11px]" style={{ color: C.muted }}>
                  PDFは{result.pdfPages}ページ。スライドとページの対応:
                </div>
                <div className="max-h-[180px] space-y-1 overflow-y-auto">
                  {result.pages.map(({ slide, page, how }) => (
                    <div key={slide.id} className="flex items-center justify-between gap-3 text-[11px]" style={{ color: C.body }}>
                      <span className="min-w-0 flex-1 truncate">{slide.title}</span>
                      <span style={{ color: how.includes("要確認") ? T.warning : C.muted }}>p.{page}（{how}）</span>
                      <span style={{ color: C.muted }}>{result.focus[slide.id]?.length || 0}か所</span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px]" style={{ color: C.muted }}>
                  ページの対応が違っていたら、そのまま反映せずに閉じてください。
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Btn kind="ghost" size="sm" icon={X} onClick={close} disabled={busy}>閉じる</Btn>
              {result && result.marks > 0 ? (
                <Btn size="sm" icon={MousePointerClick} onClick={() => { onApply(result.focus); close(); }}>
                  スライドへ反映する
                </Btn>
              ) : (
                <Btn size="sm" icon={busy ? Loader2 : MousePointerClick} onClick={run} disabled={!file || busy}>
                  {phase === "reading" ? "PDFを読んでいます..." : phase === "asking" ? "指し示しを考えています..." : "作る"}
                </Btn>
              )}
            </div>
          </>
        )}
      </div>
    </AdminModal>
  );
}
