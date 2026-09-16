import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../../api.js";
import { PRISM, PrismCard, SkeletonRows } from "../../components/common";
import { Editor, NoteCard } from "./NotesShared.jsx";
import { isWrittenNote, lessonLabel, noteCountLabel } from "./notesLessons.js";
import { AlertCircle, ChevronDown, ChevronUp, PenLine, Plus, RotateCcw } from "lucide-react";

/* 教材の横に出すノート。正典: docs/specs/training-notes-spec.md
 *
 * カリキュラムからでも研修資料からでも、**開いている単元のノートがその場で見える**ように
 * するための部品。ノート一覧（NotesView）と同じAPI・同じ部品を使う。
 * 単元が決まらないと書けないのはノート全体の決まりなので、ここでも単元は必ず選ぶ。
 *
 * **react-markdown を含むので、呼び出し側は React.lazy で読む。** */

export default function LessonNoteDock({ courseId, lessons = [], lessonId, onLessonId, onCount, materialId = "", page = 0 }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(null);   // { noteId?, lessonId, body }
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [open, setOpen] = useState(true);
  // 教材を開いているときだけ「このページ」と「この単元ぜんぶ」を切り替えられる（2026-09-16 打合せ）
  const canScope = !!materialId && page >= 1;
  const [scope, setScope] = useState("page");
  const onPage = canScope && scope === "page";

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    let alive = true;
    setLoading(true); setErr("");
    apiGet(`/notes/me?courseId=${encodeURIComponent(courseId)}`)
      .then(list => { if (alive) setNotes(Array.isArray(list) ? list.filter(isWrittenNote) : []); })
      // **取れなかったものを0件として見せない。**
      .catch(() => { if (alive) setErr("ノートを取得できませんでした。0件とは限りません。"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [courseId, reloadKey]);

  useEffect(() => { onCount?.(err ? null : notes.length); }, [notes.length, err, onCount]);

  // 単元が決まっていないときは先頭の単元にしておく（選ばせるより早い）
  const current = lessonId || lessons[0]?.id || "";
  const currentLesson = useMemo(() => lessons.find(l => l.id === current) || null, [lessons, current]);
  const mine = useMemo(() => {
    const inLesson = notes.filter(n => n.lessonId === current);
    if (!onPage) return inLesson;
    return inLesson.filter(n => n.materialId === materialId && Number(n.page) === Number(page));
  }, [notes, current, onPage, materialId, page]);

  const save = useCallback(async () => {
    if (!editing?.lessonId || !editing.body.trim()) return;
    setSaving(true); setSaveErr("");
    try {
      // **どこを見て書いたか**を残す。教材から書いたノートはページに紐づく
      const payload = {
        courseId, lessonId: editing.lessonId, body: editing.body, kind: "note",
        ...(editing.materialId ? { materialId: editing.materialId, page: editing.page } : {}),
      };
      const saved = editing.noteId
        ? await apiPut(`/notes/${editing.noteId}`, payload)
        : await apiPost("/notes/me", payload);
      setNotes(prev => editing.noteId
        ? prev.map(n => (n.noteId === saved.noteId ? saved : n))
        : [saved, ...prev]);
      setEditing(null);
    } catch {
      setSaveErr("保存できませんでした。通信を確認して、もう一度お試しください。");
    } finally { setSaving(false); }
  }, [editing, courseId]);

  const setMark = async (note, mark) => {
    const prev = notes;
    setNotes(p => p.map(n => (n.noteId === note.noteId ? { ...n, mark } : n)));
    try { await apiPut(`/notes/${note.noteId}/mark`, { mark }); }
    catch { setNotes(prev); setSaveErr("状態を変えられませんでした。"); }
  };
  const remove = async (note) => {
    const prev = notes;
    setNotes(p => p.filter(n => n.noteId !== note.noteId));
    try { await apiDelete(`/notes/${note.noteId}`); }
    catch { setNotes(prev); setSaveErr("削除できませんでした。"); }
  };

  return (
    <PrismCard className="overflow-hidden p-0">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        style={{ background: PRISM.accentSubtle }}>
        <PenLine size={15} style={{ color: PRISM.accent }} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold" style={{ color: PRISM.ink }}>{onPage ? `${page}ページのノート` : "この単元のノート"}</span>
          <span className="block text-[11px]" style={{ color: PRISM.mut }}>
            {noteCountLabel({ err, mine: mine.length, total: notes.length })}・講師には見えません
          </span>
        </span>
        {open ? <ChevronUp size={16} style={{ color: PRISM.mut }} /> : <ChevronDown size={16} style={{ color: PRISM.mut }} />}
      </button>

      {open && (
        <div className="flex flex-col gap-3 p-4">
          {canScope && (
            <div className="flex overflow-hidden rounded-xl" style={{ boxShadow: `inset 0 0 0 1px ${PRISM.line}` }}>
              {[["page", `このページ（${page}）`], ["lesson", "この単元ぜんぶ"]].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setScope(k)}
                  className="flex-1 px-3 py-2 text-xs font-bold"
                  style={{ background: scope === k ? PRISM.accentSubtle : "transparent", color: scope === k ? PRISM.accent : PRISM.mut }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {lessons.length > 1 && (
            <div className="relative">
              <select
                value={current} onChange={e => onLessonId?.(e.target.value)}
                aria-label="ノートを見る単元"
                className="w-full appearance-none rounded-xl border py-2 pl-3 pr-9 text-xs"
                style={{ borderColor: PRISM.line, background: PRISM.surface, color: PRISM.ink }}>
                {lessons.map(l => <option key={l.id} value={l.id}>{lessonLabel(l)}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: PRISM.mut }} />
            </div>
          )}

          {err && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: PRISM.warnSubtle, color: PRISM.warn }}>
              <AlertCircle size={14} />{err}
              <button onClick={() => setReloadKey(k => k + 1)} className="ml-auto flex items-center gap-1 font-bold">
                <RotateCcw size={12} />再試行
              </button>
            </div>
          )}
          {saveErr && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: PRISM.warnSubtle, color: PRISM.warn }}>
              <AlertCircle size={14} />{saveErr}
            </div>
          )}

          {editing ? (
            <Editor
              value={editing} saving={saving} rows={6} bare
              onChange={setEditing} onSave={save} onCancel={() => setEditing(null)}
            />
          ) : (
            <button
              onClick={() => setEditing({ lessonId: current, body: "", ...(onPage ? { materialId, page } : {}) })}
              disabled={!current}
              className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold disabled:opacity-50"
              style={{ borderColor: PRISM.line, color: PRISM.accent, background: PRISM.surface }}>
              <Plus size={14} />
              {!current ? "単元が選べません" : onPage ? `${page}ページについて書く` : `「${currentLesson?.title || "この単元"}」にノートを書く`}
            </button>
          )}

          {mine.length === 0 && !loading && !err && (
            <div className="rounded-xl px-3 py-2 text-[11px] leading-relaxed" style={{ background: PRISM.neutralSubtle, color: PRISM.mut }}>
              <b style={{ color: PRISM.ink }}>使い方</b>：分からなかったところに「わからない」を付けておくと、
              あとでその単元だけを見返せます。日報を書くときに、その日のノートをそのまま取り込めます。
            </div>
          )}
          {loading ? <SkeletonRows rows={2} /> : mine.length === 0 ? (
            <div className="rounded-xl px-3 py-4 text-center text-xs" style={{ background: PRISM.neutralSubtle, color: PRISM.mut }}>
              {err ? "いまは表示できません。" : onPage ? "このページのノートはまだありません。" : "この単元のノートはまだありません。"}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {mine.map(n => (
                <NoteCard key={n.noteId} note={n} compact
                  onEdit={() => setEditing({ noteId: n.noteId, lessonId: n.lessonId, body: n.body || "", ...(n.materialId ? { materialId: n.materialId, page: n.page } : {}) })}
                  onMark={m => setMark(n, m)} onRemove={() => remove(n)} />
              ))}
            </div>
          )}
        </div>
      )}
    </PrismCard>
  );
}
