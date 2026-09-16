import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { apiGet, apiPost, apiPut, apiDelete } from "../../api.js";
import {
  PRISM, PrismPage, PrismCard, PrismHomeHeading, PrismSectionTitle, PrismErrorRetryCard, SkeletonRows,
} from "../../components/common";
import { normalizeCurriculumSections } from "./TrainingComponents.jsx";
import {
  AlertCircle, Bold, Check, ChevronDown, Code, Hash, HelpCircle, List, ListChecks,
  PenLine, Plus, Search, Trash2, X,
} from "lucide-react";

/* 研修ノート。正典: docs/specs/training-notes-spec.md
 *
 * **整理をさせない。** タグもフォルダも作らせず、カリキュラムの並び順に勝手に並べる。
 * そのために、すべてのノートは単元(lessonId)に刺さる。刺さらないノートは作れない。 */

const MARKS = {
  none:    { label: "ふつう",       color: PRISM.mut },
  later:   { label: "あとで見返す", color: PRISM.accent },
  unknown: { label: "わからない",   color: PRISM.warn },
};
const FILTERS = [["all", "すべて"], ["later", "あとで見返す"], ["unknown", "わからない"]];

/* カリキュラムの木を、上から順の平らな単元リストにする（＝教科書の並び） */
function flattenLessons(sections) {
  const out = [];
  (sections || []).forEach(section => {
    if (section.unitMode === "section") {
      out.push({ id: section.id, title: section.title, sectionTitle: section.title, chapterTitle: "" });
      return;
    }
    (section.chapters || []).forEach(chapter => {
      (chapter.lessons || []).forEach(lesson => {
        out.push({
          id: lesson.id,
          title: lesson.title,
          sectionTitle: section.title,
          chapterTitle: chapter.title,
        });
      });
    });
  });
  return out;
}

export default function NotesView() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [lessons, setLessons] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);   // { noteId?, lessonId, body }
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  /* ---- コース ---- */
  useEffect(() => {
    let alive = true;
    apiGet("/me/courses").then(list => {
      if (!alive) return;
      const rows = Array.isArray(list) ? list : [];
      setCourses(rows);
      setCourseId(prev => prev || rows[0]?.courseId || "");
    }).catch(() => alive && setErr("コースを取得できませんでした。再読み込みしてください。"));
    return () => { alive = false; };
  }, []);

  /* ---- カリキュラムとノート ---- */
  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    let alive = true;
    setLoading(true); setErr("");
    Promise.allSettled([
      apiGet(`/courses/${courseId}/curriculum`),
      apiGet(`/notes/me?courseId=${encodeURIComponent(courseId)}`),
    ]).then(([cur, note]) => {
      if (!alive) return;
      if (cur.status === "fulfilled") setLessons(flattenLessons(normalizeCurriculumSections(cur.value || {})));
      if (note.status === "fulfilled") setNotes(Array.isArray(note.value) ? note.value : []);
      const failed = [cur, note].filter(r => r.status === "rejected").length;
      // **取れなかったものを0件として見せない。**
      if (failed) setErr(`一部を取得できませんでした（${failed}件）。0件とは限りません。再読み込みしてください。`);
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [courseId, reloadKey]);

  const lessonById = useMemo(
    () => Object.fromEntries(lessons.map(l => [l.id, l])),
    [lessons],
  );

  /* 表示するノート。カリキュラム順に並べ、同じ単元の中では新しい順 */
  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = n => {
      if (filter !== "all" && n.mark !== filter) return false;
      if (!needle) return true;
      const l = lessonById[n.lessonId];
      return [n.body, l?.title, l?.sectionTitle, l?.chapterTitle]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(needle));
    };
    const byLesson = {};
    notes.filter(hit).forEach(n => { (byLesson[n.lessonId] ||= []).push(n); });
    // 単元の順番はカリキュラムが決めている。並べ替えUIは作らない
    const rows = lessons
      .filter(l => byLesson[l.id]?.length)
      .map(l => ({ lesson: l, items: byLesson[l.id] }));
    // カリキュラムから消えた単元のノートも落とさない（最後にまとめる）
    const orphan = Object.keys(byLesson).filter(id => !lessonById[id]);
    if (orphan.length) {
      rows.push({
        lesson: { id: "__orphan", title: "カリキュラムから外れた単元", sectionTitle: "", chapterTitle: "" },
        items: orphan.flatMap(id => byLesson[id]),
      });
    }
    return rows;
  }, [notes, lessons, lessonById, q, filter]);

  const counts = useMemo(() => ({
    all: notes.length,
    later: notes.filter(n => n.mark === "later").length,
    unknown: notes.filter(n => n.mark === "unknown").length,
  }), [notes]);

  /* ---- 保存 ---- */
  const save = useCallback(async () => {
    if (!editing?.lessonId || !editing.body.trim()) return;
    setSaving(true); setSaveErr("");
    try {
      const payload = { courseId, lessonId: editing.lessonId, body: editing.body, kind: "note" };
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
    <PrismPage>
      <PrismHomeHeading
        eyebrow="研修中"
        title="ノート"
        description="書いたものは、カリキュラムの順に並びます。並べ替えもタグ付けも要りません。ここに書いたものは、講師には見えません。"
      />

      {courses.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold" style={{ color: PRISM.mut }}>コース</span>
          <div className="relative">
            <select
              value={courseId} onChange={e => setCourseId(e.target.value)}
              className="appearance-none rounded-xl border py-2 pl-3 pr-9 text-sm"
              style={{ borderColor: PRISM.line, background: PRISM.surface, color: PRISM.ink }}>
              {courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name || c.courseId}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: PRISM.mut }} />
          </div>
        </div>
      )}

      {err && <PrismErrorRetryCard message={err} onRetry={() => setReloadKey(k => k + 1)} />}
      {saveErr && (
        <PrismCard className="flex items-center gap-2 p-3 text-sm" style={{ borderColor: PRISM.warnLine, color: PRISM.warn }}>
          <AlertCircle size={16} />{saveErr}
        </PrismCard>
      )}

      {/* 書く */}
      {editing ? (
        <Editor
          lessons={lessons} value={editing} saving={saving}
          onChange={setEditing} onSave={save} onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          onClick={() => setEditing({ lessonId: lessons[0]?.id || "", body: "" })}
          disabled={!lessons.length}
          className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left disabled:opacity-50"
          style={{ borderColor: PRISM.line, background: PRISM.surface }}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: PRISM.accentSubtle, color: PRISM.accent }}><Plus size={18} /></span>
          <span className="min-w-0">
            <span className="block text-sm font-bold" style={{ color: PRISM.ink }}>ノートを書く</span>
            <span className="block text-xs" style={{ color: PRISM.mut }}>
              {lessons.length ? "単元を選んで書くと、その場所に残ります。" : "このコースのカリキュラムがまだありません。"}
            </span>
          </span>
        </button>
      )}

      {/* 探す */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: PRISM.mut }} />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="本文・単元名で探す"
            className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm"
            style={{ borderColor: PRISM.line, background: PRISM.surface, color: PRISM.ink }} />
        </div>
        <div className="flex overflow-hidden rounded-xl border" style={{ borderColor: PRISM.line }}>
          {FILTERS.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)}
              className="px-3 py-2 text-xs font-bold"
              style={{
                background: filter === k ? PRISM.accentSubtle : "transparent",
                color: filter === k ? PRISM.accent : PRISM.mut,
              }}>
              {label}<span className="ml-1 font-mono">{counts[k] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? <SkeletonRows rows={4} /> : grouped.length === 0 ? (
        <PrismCard className="p-8 text-center">
          <div className="text-sm font-bold" style={{ color: PRISM.ink }}>
            {notes.length ? "この条件に合うノートはありません" : "まだノートがありません"}
          </div>
          <div className="mt-1 text-xs" style={{ color: PRISM.mut }}>
            {notes.length ? "検索や絞り込みを外すと出てきます。" : "授業中に気づいたことを、単元に紐づけて残せます。"}
          </div>
        </PrismCard>
      ) : (
        grouped.map(({ lesson, items }) => (
          <div key={lesson.id}>
            <PrismSectionTitle
              title={lesson.title}
              desc={lesson.sectionTitle && lesson.sectionTitle !== lesson.title
                ? `${lesson.sectionTitle}${lesson.chapterTitle ? " ／ " + lesson.chapterTitle : ""}`
                : ""} />
            <div className="mt-2 flex flex-col gap-2">
              {items.map(n => (
                <NoteCard key={n.noteId} note={n}
                  onEdit={() => setEditing({ noteId: n.noteId, lessonId: n.lessonId, body: n.body || "" })}
                  onMark={m => setMark(n, m)} onRemove={() => remove(n)} />
              ))}
            </div>
          </div>
        ))
      )}
    </PrismPage>
  );
}

function NoteCard({ note, onEdit, onMark, onRemove }) {
  const mark = MARKS[note.mark] || MARKS.none;
  return (
    <PrismCard className="p-4">
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

function IconBtn({ children, label, onClick, danger }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="grid h-7 w-7 place-items-center rounded-lg"
      style={{ color: danger ? PRISM.warn : PRISM.mut, background: PRISM.neutralSubtle }}>
      {children}
    </button>
  );
}

/* Markdownで書くが、**記法を覚えさせない**。ボタンから入れる */
function Editor({ lessons, value, saving, onChange, onSave, onCancel }) {
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
  return (
    <PrismCard className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold" style={{ color: PRISM.mut }}>どの単元のノートか</span>
        <div className="relative min-w-0 flex-1">
          <select
            value={value.lessonId} onChange={e => onChange({ ...value, lessonId: e.target.value })}
            className="w-full appearance-none rounded-xl border py-2 pl-3 pr-9 text-sm"
            style={{ borderColor: PRISM.line, background: PRISM.surface, color: PRISM.ink }}>
            {lessons.map(l => (
              <option key={l.id} value={l.id}>
                {l.sectionTitle && l.sectionTitle !== l.title ? `${l.sectionTitle} / ` : ""}{l.title}
              </option>
            ))}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: PRISM.mut }} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {TOOLS.map(t => (
          <button key={t.label} onClick={t.run} title={t.label}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold"
            style={{ background: PRISM.neutralSubtle, color: PRISM.mut }}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      <textarea
        ref={ref} rows={8} value={value.body}
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
        <button onClick={onCancel}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold"
          style={{ color: PRISM.mut }}>
          <X size={14} />やめる
        </button>
      </div>
    </PrismCard>
  );
}
