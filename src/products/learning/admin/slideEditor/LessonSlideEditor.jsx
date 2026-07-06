import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, FileText, Image as ImageIcon, Plus, Save, Trash2, Video, X } from "lucide-react";
import { Btn, Field, fieldStyle, T } from "../../../../components/common";
import AdminModal from "../AdminModal.jsx";
import { lessonToForm } from "../useLearningAdmin.js";

// (e)最小版: Lessonのslides配列に対する追加・並べ替え・削除のみのシンプルなUI。
// 対応kindはtext(concept)/image/video の3種のみ(diagram/table/terminal/quiz/summaryは
// AI生成(STEP2, ADR 0005)側で扱う予定のため今回スコープ外)。既存の他kindのslideが
// 混在していても、追加/並べ替え/削除の対象として扱う(内容編集はできないが削除・移動は可能)。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

const KIND_OPTIONS = [
  { kind: "concept", label: "テキスト", icon: FileText },
  { kind: "image", label: "画像", icon: ImageIcon },
  { kind: "video", label: "動画", icon: Video },
];

let idSeq = 0;
function nextSlideId() {
  idSeq += 1;
  return `slide-${Date.now()}-${idSeq}`;
}

const EMPTY_DRAFT = { title: "", navLabel: "", caption: "", body: "", url: "", alt: "" };

function kindLabel(kind) {
  return KIND_OPTIONS.find(k => k.kind === kind)?.label || kind;
}

function SlideDraftForm({ kind, draft, onChange, onSubmit, onCancel }) {
  function set(key, value) { onChange({ ...draft, [key]: value }); }
  const canSubmit = draft.title.trim() && (kind === "concept" ? draft.body.trim() : draft.url.trim());
  return (
    <div className="space-y-3 rounded-2xl p-4" style={{ background: C.canvas, border: `1px solid ${C.line}` }}>
      <div className="text-sm font-bold" style={{ color: C.ink }}>{kindLabel(kind)}スライドを追加</div>
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
      <Field label="このページの説明（任意、ページ下部に表示）">
        <textarea style={{ ...fieldStyle, minHeight: 64 }} value={draft.caption} onChange={e => set("caption", e.target.value)} placeholder="このページで伝えたいことの要約" />
      </Field>
      <div className="flex flex-wrap gap-2 pt-1">
        <Btn icon={Save} onClick={onSubmit} disabled={!canSubmit}>追加する</Btn>
        <Btn kind="ghost" onClick={onCancel}>キャンセル</Btn>
      </div>
    </div>
  );
}

function SlideRow({ slide, index, total, onMove, onDelete }) {
  const option = KIND_OPTIONS.find(k => k.kind === slide.kind);
  const Icon = option?.icon || FileText;
  return (
    <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: C.canvas, color: C.muted }}>
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold" style={{ color: C.ink }}>{slide.title || "(無題)"}</div>
        <div className="text-xs" style={{ color: C.muted }}>{option?.label || slide.kind}</div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Btn kind="ghost" size="sm" icon={ArrowUp} onClick={() => onMove(index, -1)} disabled={index === 0} />
        <Btn kind="ghost" size="sm" icon={ArrowDown} onClick={() => onMove(index, 1)} disabled={index === total - 1} />
        <Btn kind="ghost" size="sm" icon={Trash2} onClick={() => onDelete(index)} />
      </div>
    </div>
  );
}

export default function LessonSlideEditor({ open, course, lesson, updateLesson, onClose }) {
  const [slides, setSlides] = useState(() => lesson?.slides || []);
  const [addingKind, setAddingKind] = useState(null);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });

  useEffect(() => {
    if (open) {
      setSlides(lesson?.slides || []);
      setAddingKind(null);
      setDraft({ ...EMPTY_DRAFT });
    }
  }, [open, lesson]);

  if (!open || !lesson) return null;

  function startAdd(kind) {
    setAddingKind(kind);
    setDraft({ ...EMPTY_DRAFT });
  }

  function submitDraft() {
    const content = addingKind === "concept" ? { body: draft.body }
      : addingKind === "image" ? { url: draft.url.trim(), alt: draft.alt.trim() }
      : { url: draft.url.trim() };
    const newSlide = {
      id: nextSlideId(),
      order: slides.length,
      kind: addingKind,
      title: draft.title.trim(),
      navLabel: draft.navLabel.trim(),
      caption: draft.caption.trim(),
      content,
    };
    setSlides(prev => [...prev, newSlide]);
    setAddingKind(null);
    setDraft({ ...EMPTY_DRAFT });
  }

  function moveSlide(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    setSlides(prev => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  }

  function deleteSlide(index) {
    setSlides(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })));
  }

  function handleSave() {
    updateLesson(course.id, lesson.id, { ...lessonToForm(lesson), slides });
    onClose();
  }

  return (
    <AdminModal open={open} title="スライド編集" desc={`Lesson: ${lesson.title}`} onClose={onClose} width={720}>
      <div className="space-y-4">
        <p className="text-xs leading-relaxed" style={{ color: C.muted }}>
          受講画面で1ページずつ表示されるスライドを追加・並べ替え・削除できます（今回はテキスト/画像/動画のみ対応）。
        </p>

        {slides.length ? (
          <div className="space-y-2">
            {slides.map((slide, index) => (
              <SlideRow key={slide.id || index} slide={slide} index={index} total={slides.length} onMove={moveSlide} onDelete={deleteSlide} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl p-4 text-center text-xs" style={{ background: C.canvas, color: C.muted }}>
            まだスライドがありません。下のボタンから追加してください。
          </div>
        )}

        {addingKind ? (
          <SlideDraftForm kind={addingKind} draft={draft} onChange={setDraft} onSubmit={submitDraft} onCancel={() => setAddingKind(null)} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {KIND_OPTIONS.map(option => (
              <Btn key={option.kind} kind="ghost" size="sm" icon={Plus} onClick={() => startAdd(option.kind)}>
                {option.label}を追加
              </Btn>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4" style={{ borderColor: C.line }}>
          <Btn kind="ghost" icon={X} onClick={onClose}>キャンセル</Btn>
          <Btn icon={Save} onClick={handleSave}>保存する</Btn>
        </div>
      </div>
    </AdminModal>
  );
}
