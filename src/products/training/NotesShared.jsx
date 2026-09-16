import React, { useRef } from "react";
import ReactMarkdown from "react-markdown";
import { PRISM, PrismCard } from "../../components/common";
import { flattenLessons, lessonLabel } from "./notesLessons.js";
import { Bold, Check, ChevronDown, Code, Hash, HelpCircle, List, ListChecks, PenLine, Trash2, X } from "lucide-react";

/* 研修ノートの共通部品。正典: docs/specs/training-notes-spec.md
 *
 * ノート一覧（NotesView）と、カリキュラム・研修資料の横に出すノート（LessonNoteDock）の
 * 両方が同じ見た目・同じ書き味になるように、ここへ寄せている。
 * **react-markdown を含むので、読み込む側は必ず lazy にする。** */

export const MARKS = {
  none:    { label: "ふつう",       color: PRISM.mut },
  later:   { label: "あとで見返す", color: PRISM.accent },
  unknown: { label: "わからない",   color: PRISM.warn },
};

export function IconBtn({ children, label, onClick, danger }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="grid h-7 w-7 place-items-center rounded-lg"
      style={{ color: danger ? PRISM.warn : PRISM.mut, background: PRISM.neutralSubtle }}>
      {children}
    </button>
  );
}

export function NoteCard({ note, onEdit, onMark, onRemove, compact = false }) {
  return (
    <PrismCard className={compact ? "p-3" : "p-4"}>
      <div className="flex items-start gap-3">
        <div className="feeps-lesson-md min-w-0 flex-1 break-words text-sm" style={{ color: PRISM.ink }}>
          <ReactMarkdown>{note.body || ""}</ReactMarkdown>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconBtn label="直す" onClick={onEdit}><PenLine size={14} /></IconBtn>
          <IconBtn label="消す" onClick={onRemove} danger><Trash2 size={14} /></IconBtn>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {Object.entries(MARKS).map(([k, v]) => (
          <button key={k} onClick={() => onMark(k)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold"
            style={{
              background: note.mark === k ? PRISM.accentSubtle : "transparent",
              color: note.mark === k ? v.color : PRISM.mut,
              boxShadow: `inset 0 0 0 1px ${note.mark === k ? v.color + "55" : PRISM.line}`,
            }}>
            {k === "unknown" && <HelpCircle size={12} />}
            {k === "later" && <ListChecks size={12} />}
            {k === "none" && <Check size={12} />}
            {v.label}
          </button>
        ))}
        <span className="ml-auto text-[11px]" style={{ color: PRISM.mut }}>
          {String(note.updatedAt || note.createdAt || "").slice(0, 10)}
        </span>
      </div>
    </PrismCard>
  );
}

/* Markdownで書くが、**記法を覚えさせない**。ボタンから入れる。
   lessons を渡さないときは単元セレクタを出さない（カリキュラムの横で書くときは
   開いている単元が決まっているので、選ばせる意味がない）。 */
export function Editor({ lessons, value, saving, onChange, onSave, onCancel, rows = 8, bare = false }) {
  const ref = useRef(null);
  const insert = (before, after = "") => {
    const el = ref.current; if (!el) return;
    const { selectionStart: s, selectionEnd: e, value: v } = el;
    const next = v.slice(0, s) + before + v.slice(s, e) + after + v.slice(e);
    onChange({ ...value, body: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    });
  };
  const TOOLS = [
    { icon: Hash, label: "見出し", run: () => insert("## ") },
    { icon: Bold, label: "太字", run: () => insert("**", "**") },
    { icon: List, label: "箇条書き", run: () => insert("- ") },
    { icon: ListChecks, label: "チェック", run: () => insert("- [ ] ") },
    { icon: Code, label: "コード", run: () => insert("```\n", "\n```") },
  ];
  const Shell = bare ? "div" : PrismCard;
  return (
    <Shell className={bare ? "" : "p-4"}>
      {lessons && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold" style={{ color: PRISM.mut }}>どの単元のノートか</span>
          <div className="relative min-w-0 flex-1">
            <select
              value={value.lessonId} onChange={e => onChange({ ...value, lessonId: e.target.value })}
              className="w-full appearance-none rounded-xl border py-2 pl-3 pr-9 text-sm"
              style={{ borderColor: PRISM.line, background: PRISM.surface, color: PRISM.ink }}>
              {lessons.map(l => <option key={l.id} value={l.id}>{lessonLabel(l)}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: PRISM.mut }} />
          </div>
        </div>
      )}

      <div className={(lessons ? "mt-3 " : "") + "flex flex-wrap gap-1"}>
        {TOOLS.map(t => (
          <button key={t.label} onClick={t.run} title={t.label}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold"
            style={{ background: PRISM.neutralSubtle, color: PRISM.mut }}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      <textarea
        ref={ref} rows={rows} value={value.body}
        onChange={e => onChange({ ...value, body: e.target.value })}
        placeholder="気づいたこと、詰まったこと、あとで見返したいこと"
        className="mt-2 w-full resize-y rounded-xl border p-3 text-sm leading-relaxed"
        style={{ borderColor: PRISM.line, background: PRISM.surface, color: PRISM.ink }} />

      <div className="mt-3 flex items-center gap-2">
        <button onClick={onSave} disabled={saving || !value.lessonId || !value.body.trim()}
          className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
          style={{ background: PRISM.accent, color: "#fff" }}>
          {saving ? "保存中…" : "保存する"}
        </button>
        {onCancel && (
          <button onClick={onCancel}
            className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold"
            style={{ color: PRISM.mut }}>
            <X size={14} />やめる
          </button>
        )}
      </div>
    </Shell>
  );
}

export { flattenLessons, lessonLabel };
