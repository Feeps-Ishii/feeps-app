import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { T } from "../../../../components/common";
import { apiGet } from "../../../../api.js";

// 「スライド確認」画面専用の読み取り専用プレビュー。ElSlideLessonView.jsxのSlideRenderer
// (受講者向け・lrn/accent依存・インタラクティブ)とは別実装。管理画面から見やすい静的表示に絞る。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

function AdminImageBody({ content }) {
  const [resolvedUrl, setResolvedUrl] = useState(content.url || "");
  const [resolveError, setResolveError] = useState(false);

  useEffect(() => {
    if (!content.materialId) return;
    let alive = true;
    setResolveError(false);
    apiGet(`/learning/materials/view?materialId=${encodeURIComponent(content.materialId)}`)
      .then(res => { if (alive && res?.url) setResolvedUrl(res.url); })
      .catch(() => { if (alive) setResolveError(true); });
    return () => { alive = false; };
  }, [content.materialId]);

  if (resolvedUrl) {
    return <img src={resolvedUrl} alt={content.alt || ""} className="max-h-[45vh] w-full rounded-xl object-contain" style={{ background: C.canvas }} />;
  }
  if (resolveError) return <p className="text-xs" style={{ color: "#ef4444" }}>画像を読み込めませんでした。</p>;
  return <p className="text-xs" style={{ color: C.muted }}>（画像未設定）</p>;
}

export default function AdminSlidePreview({ slide }) {
  if (!slide) {
    return <div className="text-xs" style={{ color: C.muted }}>スライドがありません。</div>;
  }
  const content = slide.content || {};
  const interaction = slide.interaction || {};

  let body;
  switch (slide.kind) {
    case "concept":
      body = <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: C.body }}>{content.body || ""}</p>;
      break;
    case "image":
      body = <AdminImageBody content={content} />;
      break;
    case "video":
      body = <p className="break-all text-sm" style={{ color: C.body }}>{content.url || "（動画URL未設定）"}</p>;
      break;
    case "diagram":
      body = (
        <div className="space-y-1.5">
          {(content.layers || []).map((layer, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: C.canvas }}>
              <span style={{ color: C.ink }}>{layer.label}</span>
              <span className="text-xs" style={{ color: C.muted }}>{layer.who}</span>
            </div>
          ))}
        </div>
      );
      break;
    case "table":
      body = (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ border: `1px solid ${C.line}` }}>
            <thead>
              <tr>
                {(content.columns || []).map(col => (
                  <th key={col} className="px-2.5 py-1.5 text-left text-xs font-bold" style={{ background: C.canvas, color: C.muted, borderBottom: `1px solid ${C.line}` }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(content.rows || []).map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, i) => (
                    <td key={i} className="px-2.5 py-1.5" style={{ color: C.body, borderBottom: `1px solid ${C.line}` }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      break;
    case "compare": {
      const left = content.left || {};
      const right = content.right || {};
      const Col = ({ side }) => (
        <div className="min-w-0 flex-1 rounded-xl p-3" style={{ background: C.canvas }}>
          <div className="mb-1.5 text-xs font-bold" style={{ color: C.ink }}>{side.label}</div>
          <ul className="space-y-1">
            {(side.items || []).map((item, i) => <li key={i} className="text-xs" style={{ color: C.body }}>・{item}</li>)}
          </ul>
        </div>
      );
      body = (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Col side={left} />
          <Col side={right} />
        </div>
      );
      break;
    }
    case "quiz":
      body = (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold" style={{ color: C.ink }}>{interaction.question}</p>
          <ul className="space-y-1">
            {(interaction.choices || []).map((c, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs" style={{ color: i === interaction.answerIndex ? "#15803d" : C.body }}>
                {i === interaction.answerIndex && <Check size={12} />}{c}
              </li>
            ))}
          </ul>
          {interaction.explanation && <p className="text-xs" style={{ color: C.muted }}>解説: {interaction.explanation}</p>}
        </div>
      );
      break;
    case "terminal":
      body = <p className="text-xs" style={{ color: C.muted }}>ターミナル演習スライドです（AI修正の対象外）。</p>;
      break;
    case "summary":
    default:
      body = (
        <ul className="space-y-1.5">
          {(content.points || []).map((p, i) => <li key={i} className="text-sm" style={{ color: C.body }}>・{p}</li>)}
          {content.nextLessonPreview && <li className="text-xs" style={{ color: C.muted }}>次回予告: {content.nextLessonPreview}</li>}
        </ul>
      );
      break;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-base font-bold" style={{ color: C.ink }}>{slide.title || "(無題)"}</h4>
      {body}
      {slide.caption && <p className="text-xs" style={{ color: C.muted }}>説明: {slide.caption}</p>}
    </div>
  );
}
