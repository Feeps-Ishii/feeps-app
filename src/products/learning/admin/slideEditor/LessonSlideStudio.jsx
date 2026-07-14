import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowDown, ArrowUp, Check, CheckCircle2, Copy, FileText, FileUp, HelpCircle,
  Image as ImageIcon, LayoutGrid, ListOrdered, Loader2, MousePointerClick, PenLine, Plus, Save,
  Scale, Search, Settings2, Sparkles, Table2, Terminal, Trash2, Video, X,
} from "lucide-react";
import { Badge, Btn, Field, fieldStyle, T, PRODUCT_ACCENT } from "../../../../components/common";
import { apiGet } from "../../../../api.js";
import AdminModal from "../AdminModal.jsx";
import { lessonToForm } from "../useLearningAdmin.js";
import SlideDeckImporter from "./SlideDeckImporter.jsx";
import AiLessonStudioModal from "../aiLessonStudio/AiLessonStudioModal.jsx";
import { REVISABLE_KINDS, useAiSlideReview } from "../slideReview/useAiSlideReview.js";
import { SlideRenderer } from "../../ElSlideLessonView.jsx";

// Lesson Studio CMS（2026-07-15 Phase4）。旧「スライド編集」(LessonSlideEditor.jsx)と
// 「スライド確認」(LessonSlideReview.jsx / AdminSlidePreview.jsx)を1画面へ統合し、
// 左=一覧(検索/フィルタ/並び替え/複製/削除/一括操作) 中央=編集 右=プレビュー の
// 3カラムCMSとして再構成した（両旧ファイルは削除済み）。
// - 公開状態はslide.status(draft/published/hidden)として保存する。新テーブル・新APIは
//   使わず、既存のLesson保存API(updateLesson)がslides配列をそのまま透過するのを利用する。
// - 新規追加・AI生成・AI追加・PDF/PPTXインポートのスライドは全てstatus:"draft"で始まり、
//   講師が内容を確認してから「公開」に切り替える運用とする(既存の「追加すればそのまま
//   受講者に見える」挙動からの変更点。CMSとして意図的に導入するレビューゲート)。
// - プレビューは受講画面(ElSlideLessonView.jsx)のSlideRendererをそのまま再利用し、
//   「受講者画面と同じ表示」を保証する。編集内容はこの画面のローカルslides stateへ
//   即時反映されるが、「保存する」を押すまでDBへは一切送信しない(既存方針を踏襲)。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

const KIND_META = {
  concept: { label: "Concept", icon: FileText },
  image: { label: "Image", icon: ImageIcon },
  video: { label: "Video", icon: Video },
  diagram: { label: "Diagram", icon: LayoutGrid },
  table: { label: "Table", icon: Table2 },
  compare: { label: "Compare", icon: Scale },
  terminal: { label: "Terminal", icon: Terminal },
  quiz: { label: "Quiz", icon: HelpCircle },
  summary: { label: "Summary", icon: CheckCircle2 },
  selection_task: { label: "Selection", icon: MousePointerClick },
  ordering_puzzle: { label: "Ordering", icon: ListOrdered },
  fill_blank: { label: "Fill Blank", icon: PenLine },
  interactive_form: { label: "Interactive", icon: Settings2 },
};
const BASIC_KINDS = ["concept", "image", "video"];
// 2026-07-16 Phase5: AIが返すintent(自然文の依頼種別)を差分プレビューで日本語表示するための辞書。
const INTENT_LABEL = {
  revise_current: "表現・難易度の書き換え",
  add_explanation: "説明の追加",
  add_comparison: "比較表の追加/変換",
  add_diagram: "図解の追加/変換",
  add_selection_task: "選択問題の追加/変換",
  add_ordering_puzzle: "並び替え問題の追加/変換",
  add_fill_blank: "穴埋め問題の追加/変換",
  add_interactive_form: "疑似操作の追加/変換",
  add_quiz: "クイズの追加/変換",
  add_summary: "まとめの追加",
};
const STATUS_META = {
  draft: { label: "Draft", tone: "amber" },
  published: { label: "公開", tone: "green" },
  hidden: { label: "非公開", tone: "muted" },
};

function slideStatus(slide) {
  return slide?.status === "draft" || slide?.status === "hidden" ? slide.status : "published";
}

function fmtUpdated(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "—";
  }
}

let idSeq = 0;
function nextSlideId(prefix = "slide-studio") {
  idSeq += 1;
  return `${prefix}-${Date.now()}-${idSeq}`;
}

const EMPTY_DRAFT = { title: "", navLabel: "", caption: "", body: "", url: "", alt: "" };

function IconBtn({ onClick, disabled, danger, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-25"
      style={{ color: danger ? T.danger : C.muted }}
    >
      {children}
    </button>
  );
}

function orderedOf(slides) {
  return slides.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function SlideListRow({ slide, checked, active, reorderEnabled, canMoveUp, canMoveDown, onToggleChecked, onSelect, onMoveUp, onMoveDown, onDuplicate, onDeleteRequest }) {
  const meta = KIND_META[slide.kind] || { label: slide.kind, icon: FileText };
  const Icon = meta.icon;
  const status = slideStatus(slide);
  const statusMeta = STATUS_META[status];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      className="cursor-pointer space-y-1.5 rounded-xl p-2.5 text-left transition"
      style={{ background: active ? T.accentSubtle : "#fff", border: `1px solid ${active ? T.accent : C.line}` }}
    >
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={checked} onClick={e => e.stopPropagation()} onChange={onToggleChecked} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="shrink-0 text-[11px] font-bold tabular-nums" style={{ color: C.muted }}>{(Number(slide.order || 0)) + 1}</span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={{ color: C.ink }}>{slide.title || "(無題)"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1 pl-[22px]">
        <Badge tone="muted"><Icon size={10} />{meta.label}</Badge>
        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
        {slide.aiGenerated && <Badge tone="cyan"><Sparkles size={10} />AI</Badge>}
      </div>
      <div className="flex items-center justify-between pl-[22px]">
        <span className="text-[10px]" style={{ color: C.muted }}>{fmtUpdated(slide.updatedAt)}</span>
        <div className="flex shrink-0 gap-0.5" onClick={e => e.stopPropagation()}>
          <IconBtn title="上へ" onClick={onMoveUp} disabled={!reorderEnabled || !canMoveUp}><ArrowUp size={12} /></IconBtn>
          <IconBtn title="下へ" onClick={onMoveDown} disabled={!reorderEnabled || !canMoveDown}><ArrowDown size={12} /></IconBtn>
          <IconBtn title="複製" onClick={onDuplicate}><Copy size={12} /></IconBtn>
          <IconBtn title="削除" danger onClick={onDeleteRequest}><Trash2 size={12} /></IconBtn>
        </div>
      </div>
    </div>
  );
}

function AiAssistBox({ activeSlide, ai, onRevise, onAddSlides, onApply, onDiscard }) {
  const canRevise = activeSlide && REVISABLE_KINDS.includes(activeSlide.kind);
  return (
    <div className="space-y-2.5 rounded-2xl p-4" style={{ background: C.canvas }}>
      <div className="text-sm font-bold" style={{ color: C.ink }}>AIアシスト</div>
      {ai.pending ? (
        <div className="space-y-3 rounded-xl p-3" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          <div className="text-xs font-bold" style={{ color: C.ink }}>
            {ai.pending.type === "revise" ? "AIによる修正案" : `AIによる追加スライド案（${ai.pending.slides.length}枚）`}
          </div>
          <div className="text-[11px]" style={{ color: C.muted }}>依頼内容: {ai.pending.instruction}</div>
          <div className="space-y-1 rounded-lg p-2.5 text-[11px]" style={{ background: C.canvas }}>
            <div><span className="font-bold" style={{ color: C.ink }}>AIが判定した依頼種別: </span>{INTENT_LABEL[ai.pending.intent] || ai.pending.intent || "不明"}</div>
            {ai.pending.reason && <div><span className="font-bold" style={{ color: C.ink }}>生成理由: </span>{ai.pending.reason}</div>}
            {ai.pending.type === "revise" && ai.pending.kindChanged && (
              <div className="flex items-center gap-1.5">
                <span className="font-bold" style={{ color: C.ink }}>kind変更: </span>
                <Badge tone="muted">{KIND_META[ai.pending.kindChanged.from]?.label || ai.pending.kindChanged.from}</Badge>
                <span style={{ color: C.muted }}>→</span>
                <Badge tone="cyan">{KIND_META[ai.pending.kindChanged.to]?.label || ai.pending.kindChanged.to}</Badge>
              </div>
            )}
            {ai.pending.type === "add" && ai.pending.generatedKinds?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold" style={{ color: C.ink }}>生成kind: </span>
                {ai.pending.generatedKinds.map(k => <Badge key={k} tone="cyan">{KIND_META[k]?.label || k}</Badge>)}
              </div>
            )}
          </div>
          {ai.pending.type === "revise" ? (
            <div className="rounded-lg p-3" style={{ background: C.canvas }}>
              <SlideRenderer slide={ai.pending.revised} accent={T.accent} />
            </div>
          ) : (
            <div className="space-y-2">
              {ai.pending.slides.map((s, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: C.canvas }}>
                  <SlideRenderer slide={s} accent={T.accent} />
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Btn kind="ghost" size="sm" icon={X} onClick={onDiscard}>破棄</Btn>
            <Btn kind="ai" size="sm" icon={Check} onClick={onApply}>適用（Draftとして一覧へ追加）</Btn>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[11px] leading-relaxed" style={{ color: C.muted }}>
            例:「もっと初心者向けにして」「最後に並び替え問題を追加」「穴埋め問題を1枚追加」など。選択中のスライドを修正するか、新しいスライドを追加するかを下のボタンで選べます。
          </p>
          <textarea
            value={ai.requestText}
            onChange={e => ai.setRequestText(e.target.value)}
            disabled={ai.state === "loading"}
            rows={2}
            placeholder="AIへの依頼内容を自然文で入力"
            className="w-full resize-y rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-70"
            style={{ border: `1px solid ${C.line}`, color: C.ink, background: "#fff" }}
          />
          <div className="flex flex-wrap gap-2">
            <Btn
              kind="ai" size="sm" icon={ai.state === "loading" ? Loader2 : Sparkles}
              onClick={onRevise}
              disabled={ai.state === "loading" || !ai.requestText.trim() || !canRevise}
            >
              {ai.state === "loading" ? "処理中…" : "選択中のスライドを修正する"}
            </Btn>
            <Btn
              kind="ai" size="sm" icon={ai.state === "loading" ? Loader2 : Plus}
              onClick={onAddSlides}
              disabled={ai.state === "loading" || !ai.requestText.trim()}
            >
              {ai.state === "loading" ? "処理中…" : "スライドを追加する"}
            </Btn>
          </div>
          {activeSlide && !canRevise && (
            <p className="text-[11px]" style={{ color: C.muted }}>選択中の「{KIND_META[activeSlide.kind]?.label || activeSlide.kind}」種別はAI修正の対象外です（追加のみ利用できます）。</p>
          )}
          {ai.state === "error" && ai.notice && (
            <div className="flex items-start gap-2 rounded-xl p-3 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <div className="whitespace-pre-wrap">{ai.notice}</div>
            </div>
          )}
        </>
      )}
      {ai.history.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold" style={{ color: C.muted }}>AI依頼履歴</div>
          {ai.history.map(h => (
            <div key={h.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[11px]" style={{ background: "#fff" }}>
              <span className="min-w-0 flex-1 truncate" style={{ color: C.ink }}>{h.text}</span>
              <span className="shrink-0 font-semibold" style={{ color: h.status === "applied" ? "#15803d" : C.muted }}>{h.status === "applied" ? "適用済" : "破棄"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SlideDraftForm({ kind, draft, onChange, onSubmit, onCancel }) {
  function set(key, value) { onChange({ ...draft, [key]: value }); }
  const canSubmit = draft.title.trim() && (kind === "concept" ? draft.body.trim() : draft.url.trim());
  return (
    <div className="space-y-3 rounded-2xl p-4" style={{ background: C.canvas, border: `1px solid ${C.line}` }}>
      <div className="text-sm font-bold" style={{ color: C.ink }}>{KIND_META[kind]?.label}スライドを追加</div>
      <Field label="タイトル">
        <input style={fieldStyle} value={draft.title} onChange={e => set("title", e.target.value)} placeholder="このページの見出し" />
      </Field>
      <Field label="目次ラベル（任意）">
        <input style={fieldStyle} value={draft.navLabel} onChange={e => set("navLabel", e.target.value)} placeholder="省略時はタイトルが使われます" />
      </Field>
      {kind === "concept" && (
        <Field label="本文（Markdown対応）">
          <textarea style={{ ...fieldStyle, minHeight: 140 }} value={draft.body} onChange={e => set("body", e.target.value)} placeholder={"# 見出し\n\n**太字**や- 箇条書きが使えます"} />
        </Field>
      )}
      {kind === "image" && (
        <>
          <Field label="画像URL">
            <input style={fieldStyle} value={draft.url} onChange={e => set("url", e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="代替テキスト（任意）">
            <input style={fieldStyle} value={draft.alt} onChange={e => set("alt", e.target.value)} placeholder="画像の内容の説明" />
          </Field>
        </>
      )}
      {kind === "video" && (
        <Field label="動画URL">
          <input style={fieldStyle} value={draft.url} onChange={e => set("url", e.target.value)} placeholder="YouTube URL または 動画ファイルのURL" />
        </Field>
      )}
      <Field label="このページの説明（任意）">
        <textarea style={{ ...fieldStyle, minHeight: 64 }} value={draft.caption} onChange={e => set("caption", e.target.value)} placeholder="このページで伝えたいことの要約" />
      </Field>
      <div className="flex flex-wrap gap-2 pt-1">
        <Btn icon={Save} onClick={onSubmit} disabled={!canSubmit}>追加する（Draftとして保存）</Btn>
        <Btn kind="ghost" onClick={onCancel}>キャンセル</Btn>
      </div>
    </div>
  );
}

// 2026-07-16 Phase5: diagram/selection_task/ordering_puzzle/fill_blank/interactive_formの
// 5kindを、自由JSON直接編集ではなく構造化フォームで手動修正できるようにする最低限の実装。
// いずれもonChange(patch)を呼ぶだけで、実際の反映はEditPanel経由のonChangeContent(浅いマージ)
// が担う。

function DiagramEditor({ content, onChange }) {
  const nodes = Array.isArray(content.nodes) ? content.nodes : [];
  const edges = Array.isArray(content.edges) ? content.edges : [];
  const diagramType = content.diagramType || "flow";

  if (!nodes.length) {
    return (
      <div className="rounded-xl p-3 text-xs leading-relaxed" style={{ background: C.canvas, color: C.muted }}>
        レガシー形式（layers）の図解です。ノード編集は「AIアシスト」で新形式（ノード/つながり）へ作り直してから行えます。
      </div>
    );
  }

  function updateNode(id, label) { onChange({ nodes: nodes.map(n => (n.id === id ? { ...n, label } : n)) }); }
  function addNode() { onChange({ nodes: [...nodes, { id: `n${Date.now().toString(36)}`, label: "新しい項目" }] }); }
  function removeNode(id) { onChange({ nodes: nodes.filter(n => n.id !== id), edges: edges.filter(e => e.from !== id && e.to !== id) }); }
  function updateEdge(idx, patch) { onChange({ edges: edges.map((e, i) => (i === idx ? { ...e, ...patch } : e)) }); }
  function addEdge() { if (nodes.length >= 2) onChange({ edges: [...edges, { from: nodes[0].id, to: nodes[1].id, label: "" }] }); }
  function removeEdge(idx) { onChange({ edges: edges.filter((_, i) => i !== idx) }); }

  return (
    <div className="space-y-3">
      <Field label="図の種類">
        <select style={fieldStyle} value={diagramType} onChange={e => onChange({ diagramType: e.target.value })}>
          <option value="flow">flow（手順・流れ）</option>
          <option value="hierarchy">hierarchy（階層）</option>
          <option value="relationship">relationship（関係性）</option>
          <option value="architecture">architecture（構成図）</option>
          <option value="timeline">timeline（時系列）</option>
        </select>
      </Field>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: C.body }}>ノード</span>
          <IconBtn title="ノードを追加" onClick={addNode}><Plus size={13} /></IconBtn>
        </div>
        <div className="space-y-1.5">
          {nodes.map(n => (
            <div key={n.id} className="flex items-center gap-1.5">
              <input style={{ ...fieldStyle, flex: 1 }} value={n.label} onChange={e => updateNode(n.id, e.target.value)} />
              <IconBtn title="削除" danger onClick={() => removeNode(n.id)}><Trash2 size={13} /></IconBtn>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: C.body }}>つながり（矢印）</span>
          <IconBtn title="つながりを追加" onClick={addEdge} disabled={nodes.length < 2}><Plus size={13} /></IconBtn>
        </div>
        <div className="space-y-1.5">
          {edges.map((e, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <select style={{ ...fieldStyle, flex: 1 }} value={e.from} onChange={ev => updateEdge(i, { from: ev.target.value })}>
                {nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
              <span style={{ color: C.muted }}>→</span>
              <select style={{ ...fieldStyle, flex: 1 }} value={e.to} onChange={ev => updateEdge(i, { to: ev.target.value })}>
                {nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
              <IconBtn title="削除" danger onClick={() => removeEdge(i)}><Trash2 size={13} /></IconBtn>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SelectionTaskEditor({ content, onChange }) {
  const choices = content.choices?.length ? content.choices : ["", "", "", ""];
  function updateChoice(i, v) { const next = choices.slice(); next[i] = v; onChange({ choices: next }); }
  return (
    <div className="space-y-3">
      <Field label="問題文">
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={content.question || ""} onChange={e => onChange({ question: e.target.value })} />
      </Field>
      <Field label="選択肢（左のラジオボタンで正解を選択）">
        <div className="space-y-1.5">
          {choices.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input type="radio" checked={content.correctIndex === i} onChange={() => onChange({ correctIndex: i })} />
              <input style={{ ...fieldStyle, flex: 1 }} value={c} onChange={e => updateChoice(i, e.target.value)} />
            </div>
          ))}
        </div>
      </Field>
      <Field label="解説">
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={content.explanation || ""} onChange={e => onChange({ explanation: e.target.value })} />
      </Field>
    </div>
  );
}

function OrderingPuzzleEditor({ content, onChange }) {
  const items = content.items || [];
  function updateItem(i, v) { const next = items.slice(); next[i] = v; onChange({ items: next }); }
  function addItem() { onChange({ items: [...items, "新しい項目"] }); }
  function removeItem(i) { onChange({ items: items.filter((_, idx) => idx !== i) }); }
  function moveItem(i, dir) {
    const target = i + dir;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[i], next[target]] = [next[target], next[i]];
    onChange({ items: next });
  }
  return (
    <div className="space-y-3">
      <Field label="問題文（任意）">
        <textarea style={{ ...fieldStyle, minHeight: 50 }} value={content.instruction || ""} onChange={e => onChange({ instruction: e.target.value })} />
      </Field>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: C.body }}>項目（正しい順序で入力）</span>
          <IconBtn title="項目を追加" onClick={addItem}><Plus size={13} /></IconBtn>
        </div>
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="w-4 shrink-0 text-center text-[10px]" style={{ color: C.muted }}>{i + 1}</span>
              <input style={{ ...fieldStyle, flex: 1 }} value={item} onChange={e => updateItem(i, e.target.value)} />
              <IconBtn title="上へ" onClick={() => moveItem(i, -1)} disabled={i === 0}><ArrowUp size={12} /></IconBtn>
              <IconBtn title="下へ" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}><ArrowDown size={12} /></IconBtn>
              <IconBtn title="削除" danger onClick={() => removeItem(i)}><Trash2 size={12} /></IconBtn>
            </div>
          ))}
        </div>
      </div>
      <Field label="ヒント（任意）">
        <input style={fieldStyle} value={content.hint || ""} onChange={e => onChange({ hint: e.target.value })} />
      </Field>
      <Field label="解説">
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={content.explanation || ""} onChange={e => onChange({ explanation: e.target.value })} />
      </Field>
    </div>
  );
}

function FillBlankEditor({ content, onChange }) {
  const acceptableAnswers = content.acceptableAnswers || [];
  function updateAcceptable(i, v) { const next = acceptableAnswers.slice(); next[i] = v; onChange({ acceptableAnswers: next }); }
  function addAcceptable() { if (acceptableAnswers.length < 3) onChange({ acceptableAnswers: [...acceptableAnswers, ""] }); }
  function removeAcceptable(i) { onChange({ acceptableAnswers: acceptableAnswers.filter((_, idx) => idx !== i) }); }
  return (
    <div className="space-y-3">
      <Field label="空欄より前の文">
        <input style={fieldStyle} value={content.textBefore || ""} onChange={e => onChange({ textBefore: e.target.value })} />
      </Field>
      <Field label="正解">
        <input style={fieldStyle} value={content.answer || ""} onChange={e => onChange({ answer: e.target.value })} />
      </Field>
      <Field label="空欄より後の文">
        <input style={fieldStyle} value={content.textAfter || ""} onChange={e => onChange({ textAfter: e.target.value })} />
      </Field>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: C.body }}>別解（任意、最大3件）</span>
          <IconBtn title="別解を追加" onClick={addAcceptable} disabled={acceptableAnswers.length >= 3}><Plus size={13} /></IconBtn>
        </div>
        <div className="space-y-1.5">
          {acceptableAnswers.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input style={{ ...fieldStyle, flex: 1 }} value={a} onChange={e => updateAcceptable(i, e.target.value)} />
              <IconBtn title="削除" danger onClick={() => removeAcceptable(i)}><Trash2 size={13} /></IconBtn>
            </div>
          ))}
        </div>
      </div>
      <Field label="解説">
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={content.explanation || ""} onChange={e => onChange({ explanation: e.target.value })} />
      </Field>
    </div>
  );
}

function InteractiveFormEditor({ content, onChange }) {
  const fields = content.fields || [];
  function updateField(i, patch) { const next = fields.slice(); next[i] = { ...next[i], ...patch }; onChange({ fields: next }); }
  function addField() {
    if (fields.length >= 5) return;
    onChange({ fields: [...fields, { key: `field${fields.length + 1}`, label: "新しい項目", type: "text", options: [], placeholder: "", correctValue: "", hint: "" }] });
  }
  function removeField(i) { onChange({ fields: fields.filter((_, idx) => idx !== i) }); }
  function updateOptions(i, text) { updateField(i, { options: text.split(",").map(s => s.trim()).filter(Boolean) }); }
  return (
    <div className="space-y-3">
      <Field label="タイトル">
        <input style={fieldStyle} value={content.title || ""} onChange={e => onChange({ title: e.target.value })} />
      </Field>
      <Field label="操作指示">
        <textarea style={{ ...fieldStyle, minHeight: 50 }} value={content.instruction || ""} onChange={e => onChange({ instruction: e.target.value })} />
      </Field>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: C.body }}>入力項目（2〜5件）</span>
          <IconBtn title="項目を追加" onClick={addField} disabled={fields.length >= 5}><Plus size={13} /></IconBtn>
        </div>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="space-y-1.5 rounded-lg p-2" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-1.5">
                <input style={{ ...fieldStyle, flex: 1 }} value={f.label} onChange={e => updateField(i, { label: e.target.value })} placeholder="ラベル" />
                <select style={{ ...fieldStyle, width: 90 }} value={f.type} onChange={e => updateField(i, { type: e.target.value })}>
                  <option value="text">text</option>
                  <option value="select">select</option>
                  <option value="toggle">toggle</option>
                </select>
                <IconBtn title="削除" danger onClick={() => removeField(i)}><Trash2 size={13} /></IconBtn>
              </div>
              {(f.type === "select" || f.type === "toggle") && (
                <input style={fieldStyle} value={(f.options || []).join(", ")} onChange={e => updateOptions(i, e.target.value)} placeholder="選択肢をカンマ区切りで入力" />
              )}
              {f.type === "text" && (
                <input style={fieldStyle} value={f.placeholder || ""} onChange={e => updateField(i, { placeholder: e.target.value })} placeholder="プレースホルダー（任意）" />
              )}
              <input style={fieldStyle} value={f.correctValue || ""} onChange={e => updateField(i, { correctValue: e.target.value })} placeholder="正解値" />
              <input style={fieldStyle} value={f.hint || ""} onChange={e => updateField(i, { hint: e.target.value })} placeholder="ヒント（任意）" />
            </div>
          ))}
        </div>
      </div>
      <Field label="完成イメージ（任意、例: int age = 20;）">
        <input style={fieldStyle} value={content.completionPreview || ""} onChange={e => onChange({ completionPreview: e.target.value })} />
      </Field>
      <Field label="解説">
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={content.explanation || ""} onChange={e => onChange({ explanation: e.target.value })} />
      </Field>
    </div>
  );
}

const STRUCTURED_EDIT_KINDS = {
  diagram: DiagramEditor,
  selection_task: SelectionTaskEditor,
  ordering_puzzle: OrderingPuzzleEditor,
  fill_blank: FillBlankEditor,
  interactive_form: InteractiveFormEditor,
};

function EditPanel({ slide, onChangeCommon, onChangeContent, onDuplicate, onDeleteRequest }) {
  const meta = KIND_META[slide.kind] || { label: slide.kind };
  const isBasic = BASIC_KINDS.includes(slide.kind);
  const StructuredEditor = STRUCTURED_EDIT_KINDS[slide.kind];
  const content = slide.content || {};
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="muted">{meta.label}</Badge>
        <div className="flex gap-2">
          <Btn kind="ghost" size="sm" icon={Copy} onClick={onDuplicate}>複製</Btn>
          <Btn kind="ghost" size="sm" icon={Trash2} onClick={onDeleteRequest}>削除</Btn>
        </div>
      </div>
      <Field label="タイトル">
        <input style={fieldStyle} value={slide.title || ""} onChange={e => onChangeCommon({ title: e.target.value })} />
      </Field>
      <Field label="目次ラベル（任意）">
        <input style={fieldStyle} value={slide.navLabel || ""} onChange={e => onChangeCommon({ navLabel: e.target.value })} placeholder="省略時はタイトルが使われます" />
      </Field>
      <Field label="公開状態">
        <select style={fieldStyle} value={slideStatus(slide)} onChange={e => onChangeCommon({ status: e.target.value })}>
          <option value="draft">Draft（下書き・受講生には非表示）</option>
          <option value="published">公開（受講生に表示）</option>
          <option value="hidden">非公開（一時的に隠す）</option>
        </select>
      </Field>

      {isBasic ? (
        <>
          {slide.kind === "concept" && (
            <Field label="本文（Markdown対応）">
              <textarea style={{ ...fieldStyle, minHeight: 160 }} value={content.body || ""} onChange={e => onChangeContent({ body: e.target.value })} />
            </Field>
          )}
          {slide.kind === "image" && (
            <>
              <Field label="画像URL">
                <input style={fieldStyle} value={content.url || ""} onChange={e => onChangeContent({ url: e.target.value })} placeholder="https://..." />
              </Field>
              <Field label="代替テキスト（任意）">
                <input style={fieldStyle} value={content.alt || ""} onChange={e => onChangeContent({ alt: e.target.value })} />
              </Field>
            </>
          )}
          {slide.kind === "video" && (
            <Field label="動画URL">
              <input style={fieldStyle} value={content.url || ""} onChange={e => onChangeContent({ url: e.target.value })} placeholder="YouTube URL または 動画ファイルのURL" />
            </Field>
          )}
        </>
      ) : StructuredEditor ? (
        <StructuredEditor content={content} onChange={onChangeContent} />
      ) : (
        <div className="rounded-xl p-3 text-xs leading-relaxed" style={{ background: C.canvas, color: C.muted }}>
          この種別（{meta.label}）のコンテンツはAIが生成・修正します。内容は右側のプレビューで確認できます。変更したい場合は下の「AIアシスト」から依頼してください。
        </div>
      )}

      <Field label="このページの説明（任意）">
        <textarea style={{ ...fieldStyle, minHeight: 64 }} value={slide.caption || ""} onChange={e => onChangeCommon({ caption: e.target.value })} />
      </Field>
    </div>
  );
}

export default function LessonSlideStudio({ open, course, lesson, updateLesson, createMaterialAwaitingApi, onClose }) {
  const [slides, setSlides] = useState(() => lesson?.slides || []);
  const [activeId, setActiveId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [addingKind, setAddingKind] = useState(null);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [importerOpen, setImporterOpen] = useState(false);
  const [aiStudioOpen, setAiStudioOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const ai = useAiSlideReview();

  useEffect(() => {
    if (open) {
      const initial = orderedOf(lesson?.slides || []);
      setSlides(initial);
      setActiveId(initial[0]?.id || null);
      setSelectedIds(new Set());
      setAddingKind(null);
      setDraft({ ...EMPTY_DRAFT });
      setQuery("");
      setKindFilter("all");
      setStatusFilter("all");
      setImporterOpen(false);
      setAiStudioOpen(false);
      setDeleteTarget(null);
      setBulkDeleteConfirm(false);
      ai.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson]);

  const previewLrn = useMemo(() => ({
    getMaterialViewUrl: materialId => apiGet(`/learning/materials/view?materialId=${encodeURIComponent(materialId)}`),
  }), []);

  const filteredSlides = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orderedOf(slides)
      .filter(s => kindFilter === "all" || s.kind === kindFilter)
      .filter(s => statusFilter === "all" || slideStatus(s) === statusFilter)
      .filter(s => !q || [s.title, s.navLabel].some(v => String(v || "").toLowerCase().includes(q)));
  }, [slides, query, kindFilter, statusFilter]);

  if (!open || !lesson) return null;

  const accent = course?.color || PRODUCT_ACCENT.learning.accent;
  const activeSlide = slides.find(s => s.id === activeId) || null;
  const reorderEnabled = filteredSlides.length === slides.length;

  function touch(patch) {
    return { ...patch, updatedAt: new Date().toISOString() };
  }

  function moveSlide(id, direction) {
    const ordered = orderedOf(slides);
    const idx = ordered.findIndex(s => s.id === id);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= ordered.length) return;
    const next = ordered.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    setSlides(next.map((s, i) => ({ ...s, order: i })));
  }

  function duplicateSlide(id) {
    setSlides(prev => {
      const ordered = orderedOf(prev);
      const idx = ordered.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      const copy = { ...ordered[idx], id: nextSlideId("slide-dup"), ...touch({}) };
      ordered.splice(idx + 1, 0, copy);
      return ordered.map((s, i) => ({ ...s, order: i }));
    });
  }

  function removeSlideIds(ids) {
    setSlides(prev => orderedOf(prev.filter(s => !ids.has(s.id))).map((s, i) => ({ ...s, order: i })));
    if (activeId && ids.has(activeId)) setActiveId(null);
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
  }

  function toggleChecked(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function bulkSetStatus(status) {
    setSlides(prev => prev.map(s => (selectedIds.has(s.id) ? { ...s, ...touch({ status }) } : s)));
    setSelectedIds(new Set());
  }

  function updateActiveCommon(patch) {
    if (!activeId) return;
    setSlides(prev => prev.map(s => (s.id === activeId ? { ...s, ...touch(patch) } : s)));
  }

  function updateActiveContent(patch) {
    if (!activeId) return;
    setSlides(prev => prev.map(s => (s.id === activeId ? { ...s, content: { ...(s.content || {}), ...patch }, ...touch({}) } : s)));
  }

  function startAdd(kind) {
    setAddingKind(kind);
    setDraft({ ...EMPTY_DRAFT });
    setActiveId(null);
  }

  function submitDraft() {
    const content = addingKind === "concept" ? { body: draft.body }
      : addingKind === "image" ? { url: draft.url.trim(), alt: draft.alt.trim() }
      : { url: draft.url.trim() };
    const newSlide = {
      id: nextSlideId(), order: slides.length, kind: addingKind,
      title: draft.title.trim(), navLabel: draft.navLabel.trim(), caption: draft.caption.trim(),
      content, status: "draft", updatedAt: new Date().toISOString(),
    };
    setSlides(prev => [...prev, newSlide]);
    setAddingKind(null);
    setDraft({ ...EMPTY_DRAFT });
    setActiveId(newSlide.id);
  }

  function handlePdfImported(newSlides) {
    setSlides(prev => {
      const merged = [...prev, ...newSlides.map(s => ({ ...s, status: "draft", updatedAt: new Date().toISOString() }))];
      return merged.map((s, i) => ({ ...s, order: i }));
    });
  }

  function handleAiStudioImported(newSlides) {
    setSlides(prev => {
      const now = new Date().toISOString();
      const merged = [...prev, ...newSlides.map(s => ({ ...s, status: "draft", aiGenerated: true, updatedAt: now }))];
      return merged.map((s, i) => ({ ...s, order: i }));
    });
  }

  function handleAiRevise() {
    ai.reviseCurrent({ course, lesson, currentSlide: activeSlide });
  }

  function handleAiAddSlides() {
    ai.addSlides({ course, lesson, existingSlidesOutline: slides.map(s => ({ kind: s.kind, title: s.title })) });
  }

  function handleAiApply() {
    const applied = ai.applyPending();
    if (!applied) return;
    const now = new Date().toISOString();
    if (applied.type === "revise") {
      setSlides(prev => prev.map(s => (
        s.id === applied.original.id ? { ...s, ...applied.revised, id: s.id, status: s.status, aiGenerated: true, updatedAt: now } : s
      )));
    } else {
      const newSlides = applied.slides.map(s => ({ ...s, id: nextSlideId("slide-review"), status: "draft", aiGenerated: true, updatedAt: now }));
      setSlides(prev => {
        const ordered = orderedOf(prev);
        const insertAt = activeId ? ordered.findIndex(s => s.id === activeId) + 1 : ordered.length;
        ordered.splice(insertAt <= 0 ? ordered.length : insertAt, 0, ...newSlides);
        return ordered.map((s, i) => ({ ...s, order: i }));
      });
      setActiveId(newSlides[0]?.id || activeId);
    }
  }

  function handleSave() {
    updateLesson(course.id, lesson.id, { ...lessonToForm(lesson), slides });
    onClose();
  }

  return (
    <AdminModal open={open} title="スライド管理" desc={`Lesson: ${lesson.title}（教材の一覧・編集・公開状態をまとめて管理する画面です）`} onClose={onClose} width={1240}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl p-2.5" style={{ background: C.canvas }}>
          <span className="text-xs font-semibold" style={{ color: C.ink }}>{slides.length}枚のスライド</span>
          <div className="flex flex-wrap gap-2">
            <Btn kind="ghost" size="sm" icon={X} onClick={onClose}>キャンセル</Btn>
            <Btn size="sm" icon={Save} onClick={handleSave}>保存する</Btn>
          </div>
        </div>

        {slides.length === 0 && !addingKind ? (
          <div className="rounded-xl p-4 text-center text-xs" style={{ background: C.canvas, color: C.muted }}>
            まだスライドがありません。下のボタンから追加してください。
          </div>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* 左: 一覧 */}
          <div className="w-full space-y-3 lg:w-[280px] lg:shrink-0">
            <div className="space-y-2 rounded-xl p-2.5" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5" style={{ borderColor: C.line }}>
                <Search size={13} style={{ color: C.muted }} />
                <input className="w-full bg-transparent text-xs outline-none" value={query} onChange={e => setQuery(e.target.value)} placeholder="タイトルで検索" style={{ color: C.ink }} />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <select style={{ ...fieldStyle, padding: "6px 8px", fontSize: 11 }} value={kindFilter} onChange={e => setKindFilter(e.target.value)}>
                  <option value="all">すべての種類</option>
                  {Object.entries(KIND_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                </select>
                <select style={{ ...fieldStyle, padding: "6px 8px", fontSize: 11 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="all">すべての状態</option>
                  <option value="draft">Draft</option>
                  <option value="published">公開</option>
                  <option value="hidden">非公開</option>
                </select>
              </div>
              {!reorderEnabled && filteredSlides.length > 0 && (
                <p className="text-[10px]" style={{ color: C.muted }}>検索・フィルタ中は並び替えできません。</p>
              )}
            </div>

            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl p-2.5" style={{ background: T.accentSubtle }}>
                <span className="text-[11px] font-semibold" style={{ color: T.accentHover }}>{selectedIds.size}件選択中</span>
                <div className="flex flex-wrap gap-1.5">
                  <Btn kind="ghost" size="sm" onClick={() => bulkSetStatus("published")}>公開</Btn>
                  <Btn kind="ghost" size="sm" onClick={() => bulkSetStatus("hidden")}>非公開</Btn>
                  <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => setBulkDeleteConfirm(true)}>削除</Btn>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {filteredSlides.map(slide => (
                <SlideListRow
                  key={slide.id}
                  slide={slide}
                  active={slide.id === activeId}
                  checked={selectedIds.has(slide.id)}
                  reorderEnabled={reorderEnabled}
                  canMoveUp={Number(slide.order || 0) > 0}
                  canMoveDown={Number(slide.order || 0) < slides.length - 1}
                  onToggleChecked={() => toggleChecked(slide.id)}
                  onSelect={() => { setAddingKind(null); setActiveId(slide.id); }}
                  onMoveUp={() => moveSlide(slide.id, -1)}
                  onMoveDown={() => moveSlide(slide.id, 1)}
                  onDuplicate={() => duplicateSlide(slide.id)}
                  onDeleteRequest={() => setDeleteTarget(slide)}
                />
              ))}
              {filteredSlides.length === 0 && slides.length > 0 && (
                <div className="rounded-xl p-3 text-center text-[11px]" style={{ background: C.canvas, color: C.muted }}>
                  条件に一致するスライドがありません。
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {BASIC_KINDS.map(kind => (
                <Btn key={kind} kind="ghost" size="sm" icon={Plus} onClick={() => startAdd(kind)}>{KIND_META[kind].label}</Btn>
              ))}
              <Btn kind="ghost" size="sm" icon={FileUp} onClick={() => setImporterOpen(true)}>資料をインポート</Btn>
              <Btn kind="ai" size="sm" icon={Sparkles} onClick={() => setAiStudioOpen(true)}>AIでスライド作成</Btn>
            </div>
          </div>

          {/* 中央: 編集 */}
          <div className="min-w-0 flex-1 space-y-4">
            {addingKind ? (
              <SlideDraftForm kind={addingKind} draft={draft} onChange={setDraft} onSubmit={submitDraft} onCancel={() => setAddingKind(null)} />
            ) : activeSlide ? (
              <EditPanel
                slide={activeSlide}
                onChangeCommon={updateActiveCommon}
                onChangeContent={updateActiveContent}
                onDuplicate={() => duplicateSlide(activeSlide.id)}
                onDeleteRequest={() => setDeleteTarget(activeSlide)}
              />
            ) : (
              <div className="rounded-xl p-4 text-center text-xs" style={{ background: C.canvas, color: C.muted }}>
                左の一覧からスライドを選択するか、下のボタンから追加してください。
              </div>
            )}
            <AiAssistBox
              activeSlide={activeSlide}
              ai={ai}
              onRevise={handleAiRevise}
              onAddSlides={handleAiAddSlides}
              onApply={handleAiApply}
              onDiscard={ai.discardPending}
            />
          </div>

          {/* 右: プレビュー */}
          <div className="w-full lg:w-[360px] lg:shrink-0">
            <div className="mb-2 text-[11px] font-bold uppercase" style={{ color: C.muted, letterSpacing: "0.06em" }}>プレビュー（受講画面と同じ表示）</div>
            <div className="rounded-2xl p-6" style={{ background: "#fff", border: `1px solid ${C.line}`, minHeight: 280 }}>
              {activeSlide ? (
                <SlideRenderer slide={activeSlide} accent={accent} lrn={previewLrn} />
              ) : (
                <p className="text-xs" style={{ color: C.muted }}>スライドを選択するとここに表示されます。</p>
              )}
            </div>
            {activeSlide?.caption && (
              <div className="mt-3 rounded-xl p-3" style={{ background: C.canvas }}>
                <div className="mb-1 text-[11px] font-bold" style={{ color: C.muted }}>このページの説明</div>
                <p className="text-xs leading-relaxed" style={{ color: C.body }}>{activeSlide.caption}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <SlideDeckImporter
        open={importerOpen}
        course={course}
        lesson={lesson}
        createMaterialAwaitingApi={createMaterialAwaitingApi}
        existingSlideCount={slides.length}
        onImported={handlePdfImported}
        onClose={() => setImporterOpen(false)}
      />

      <AiLessonStudioModal
        open={aiStudioOpen}
        course={course}
        lesson={lesson}
        existingSlideCount={slides.length}
        onImported={handleAiStudioImported}
        onClose={() => setAiStudioOpen(false)}
      />

      <AdminModal open={Boolean(deleteTarget)} title="スライドの削除" desc={deleteTarget ? `「${deleteTarget.title || "(無題)"}」を削除します。` : ""} onClose={() => setDeleteTarget(null)} danger width={480}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "#FEE2E2", color: T.danger }}>
            <Trash2 size={18} />
            <div className="text-sm font-bold">この操作は取り消せません。</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn kind="ghost" onClick={() => setDeleteTarget(null)}>キャンセル</Btn>
            <Btn kind="ghost" icon={Trash2} onClick={() => { removeSlideIds(new Set([deleteTarget.id])); setDeleteTarget(null); }}>削除する</Btn>
          </div>
        </div>
      </AdminModal>

      <AdminModal open={bulkDeleteConfirm} title="選択したスライドの削除" desc={`${selectedIds.size}件のスライドを削除します。`} onClose={() => setBulkDeleteConfirm(false)} danger width={480}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "#FEE2E2", color: T.danger }}>
            <Trash2 size={18} />
            <div className="text-sm font-bold">この操作は取り消せません。</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Btn kind="ghost" onClick={() => setBulkDeleteConfirm(false)}>キャンセル</Btn>
            <Btn kind="ghost" icon={Trash2} onClick={() => { removeSlideIds(new Set(selectedIds)); setBulkDeleteConfirm(false); }}>削除する</Btn>
          </div>
        </div>
      </AdminModal>
    </AdminModal>
  );
}
