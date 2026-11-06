import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { normalizeCurriculumSections } from "../../training/TrainingComponents.jsx";
import { flattenLessons, isWrittenNote, resolveUnitId, todayUnitId } from "../../training/notesLessons.js";
import { todayStr } from "../../training/useTraining.js";
import { getActiveCourseId, setActiveCourseId } from "../../../utils/common/courseContext.js";
import { Btn, Card, Chip, Modal } from "../parts/ui.jsx";
import { NOTE_FORMATS, exportNotes, notesToMarkdown, notesToText } from "./noteExport.js";

const MaterialViewer = lazy(() => import("../../training/MaterialViewer.jsx"));

/* 受講生のノート（モック noteT2）：左に一覧（日付ごと／単元ごと・探す）、右に書く／読む。上の「書き出す」で Markdown・PDF・Word・テキストに。
   ノートに題名の項目は無いので、本文の 1 行目を題名として見せる（教材の横のドックや日報の取り込みと同じ本文のまま）。単元に紐づくのが基本（notes-spec） */

const arr = v => (Array.isArray(v) ? v : []);
const SAVE_DELAY = 1200;
const dk = n => String(n?.createdAt || n?.updatedAt || "").slice(0, 10);
const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const hhmm = n => { const d = new Date(n?.createdAt || n?.updatedAt || ""); return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const split = body => {
  const s = String(body || ""), i = s.indexOf("\n");
  return i < 0 ? { title: s.replace(/^#{1,6} /, ""), rest: "" } : { title: s.slice(0, i).replace(/^#{1,6} /, ""), rest: s.slice(i + 1).replace(/^\n/, "") };
};
const compose = d => [d.title.trim(), d.rest].filter(Boolean).join("\n");
const safeName = s => String(s).replace(/[\\/:*?"<>|\r\n]/g, "_").slice(0, 60);
let tempId = 0;

export default function TraineeNote({ go, say }) {
  const today = todayStr();
  const [st, setSt] = useState({ state: "loading" });
  const [notes, setNotes] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [mats, setMats] = useState({});
  const [partial, setPartial] = useState(false);
  const [key, setKey] = useState(0);
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState("date");
  const [view, setView] = useState("edit");
  const [d, setD] = useState(null);           // 開いているノート { key, noteId, lessonId, title, rest, materialId, page, createdAt }
  const [save, setSave] = useState("");       // "" | saving | ok | err
  const [ex, setEx] = useState(null);         // 書き出しの窓 { sc, fm }
  const [exBusy, setExBusy] = useState(false);
  const [del, setDel] = useState(false);
  const [viewing, setViewing] = useState(null);
  const dRef = useRef(null), dirty = useRef(false), busy = useRef(false), timer = useRef(0), courseRef = useRef("");

  useEffect(() => {
    let alive = true;
    setSt(s => (s.state === "ready" ? s : { state: "loading" }));
    apiGet("/me/courses").then(async cs => {
      const list = arr(cs), c = list.find(x => x.courseId === getActiveCourseId()) || list[0];
      if (!c) { if (alive) { setSt({ state: "nocourse" }); } return; }
      setActiveCourseId(c.courseId);
      courseRef.current = c.courseId;
      const [cur, note, mat] = await Promise.allSettled([apiGet(`/courses/${c.courseId}/curriculum`), apiGet(`/notes/me?courseId=${encodeURIComponent(c.courseId)}`), apiGet(`/materials?courseId=${c.courseId}`)]);
      if (!alive) return;
      // ノートが取れないときは 0 件と見せない
      if (note.status === "rejected") { setSt({ state: "error" }); return; }
      const ls = cur.status === "fulfilled" ? flattenLessons(normalizeCurriculumSections(cur.value || {})) : [];
      const ns = arr(note.value).filter(isWrittenNote);
      setLessons(ls); setNotes(ns); setPartial(cur.status === "rejected");
      setMats(mat.status === "fulfilled" ? Object.fromEntries(arr(mat.value).map(m => [m.materialId, m])) : {});
      setSt({ state: "ready", courseId: c.courseId });
      const first = [...ns].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
      if (first) open(first);
    }).catch(() => { if (alive) setSt({ state: "error" }); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // 少し待って保存する。保存中に書いたぶんは、終わってからもう一度送る
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const x = dRef.current;
    if (!x || !dirty.current || busy.current) return;
    const body = compose(x);
    if (!body.trim()) return;
    dirty.current = false; busy.current = true;
    let failed = false;
    setSave("saving");
    try {
      const payload = { courseId: courseRef.current, lessonId: x.lessonId || "", body, kind: "note", ...(x.materialId ? { materialId: x.materialId } : {}), ...(x.page ? { page: x.page } : {}) };
      const saved = x.noteId ? await apiPut(`/notes/${x.noteId}`, payload) : await apiPost("/notes/me", payload);
      setNotes(prev => (prev.some(n => n.noteId === saved.noteId) ? prev.map(n => (n.noteId === saved.noteId ? saved : n)) : [saved, ...prev]));
      if (dRef.current?.key === x.key) {
        dRef.current = { ...dRef.current, noteId: saved.noteId, createdAt: saved.createdAt };
        setD(cur => (cur?.key === x.key ? { ...cur, noteId: saved.noteId, createdAt: saved.createdAt } : cur));
      }
      setSave("ok");
    } catch { failed = true; dirty.current = true; setSave("err"); } finally {
      busy.current = false;
      // eslint-disable-next-line no-use-before-define
      if (dirty.current && !failed && dRef.current) timer.current = window.setTimeout(flush, SAVE_DELAY);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { flush(); }, [flush]);

  function setDraft(next) { dRef.current = next; setD(next); }
  function open(n) {
    flush();
    dirty.current = false; setSave("");
    const { title, rest } = split(n.body);
    setDraft({ key: n.noteId, noteId: n.noteId, lessonId: n.lessonId || "", title, rest, materialId: n.materialId || "", page: n.page || 0, createdAt: n.createdAt || n.updatedAt || "" });
  }
  function change(patch) {
    const next = { ...dRef.current, ...patch };
    setDraft(next);
    dirty.current = true;
    setSave("");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY);
  }
  function newNote() {
    flush();
    dirty.current = false; setSave("");
    tempId += 1;
    setDraft({ key: `new${tempId}`, noteId: "", lessonId: todayUnitId(lessons, today), title: "", rest: "", materialId: "", page: 0, createdAt: "" });
    setView("edit");
  }
  async function remove() {
    const x = dRef.current;
    setDel(false);
    window.clearTimeout(timer.current); dirty.current = false;
    if (!x?.noteId) { setDraft(null); return; }
    const prev = notes;
    const rest = notes.filter(n => n.noteId !== x.noteId);
    setNotes(rest);
    if (rest[0]) open(rest[0]); else setDraft(null);
    try { await apiDelete(`/notes/${x.noteId}`); say?.("ノートを消しました"); }
    catch { setNotes(prev); say?.("消せませんでした"); }
  }

  const unitOf = useCallback(n => lessons.find(l => l.id === resolveUnitId(lessons, n.lessonId)), [lessons]);
  const unitNo = u => lessons.indexOf(u) + 1;
  const titleOf = n => split(n.body).title || "（題名なし）";
  const q0 = q.trim().toLowerCase();
  const hits = useMemo(() => notes.filter(n => !q0 || [n.body, unitOf(n)?.title].filter(Boolean).some(v => String(v).toLowerCase().includes(q0))).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))), [notes, q0, unitOf]);
  const groups = useMemo(() => {
    if (grp === "unit") {
      const out = lessons.map((l, i) => [`単元 ${i + 1} ・ ${l.title}`, hits.filter(n => unitOf(n) === l), l.id === todayUnitId(lessons, today) && !!(l.startDate && l.startDate <= today)]).filter(g => g[1].length);
      const free = hits.filter(n => !unitOf(n));
      if (free.length) out.unshift(["単元なし", free, false]);
      return out;
    }
    return [...new Set(hits.map(dk))].map(x => [x === today ? `今日 ・ ${md(x)}` : x ? md(x) : "日付なし", hits.filter(n => dk(n) === x), x === today]);
  }, [grp, hits, lessons, today, unitOf]);

  if (st.state === "loading") return <div className="soon card">読み込み中</div>;
  if (st.state === "error") return <Card><div className="empty"><b>ノートを確認できません</b><Btn kind="ghost sm" onClick={() => { setSt({ state: "loading" }); setKey(k => k + 1); }}>再読み込み</Btn></div></Card>;
  if (st.state === "nocourse") return <Card><div className="empty"><b>ノート</b><Chip>コースなし</Chip></div></Card>;

  const cu = d ? lessons.find(l => l.id === resolveUnitId(lessons, d.lessonId)) : null;
  const when = d?.createdAt ? `${Number(String(d.createdAt).slice(5, 7))} 月 ${Number(String(d.createdAt).slice(8, 10))} 日 ・ ${hhmm(d)}` : "いま";
  const mat = d?.materialId ? mats[d.materialId] : null;

  // 書き出すもの
  const toExport = sc => notes.filter(n => sc === "all" || (sc === "one" ? n.noteId === d?.noteId : sc === "day" ? dk(n) === (d?.createdAt ? String(d.createdAt).slice(0, 10) : today) : unitOf(n)?.id === cu?.id));
  const shape = n => { const { title, rest } = split(n.body), u = unitOf(n), x = dk(n); return { title: title || "（題名なし）", rest, when: x ? `${md(x)} ${hhmm(n)}`.trim() : "", unit: u ? u.title : "" }; };
  const exList = ex ? toExport(ex.sc).map(shape) : [];
  const exBase = ex ? `ノート_${safeName(ex.sc === "one" ? d?.title || "題名なし" : ex.sc === "day" ? (d?.createdAt ? String(d.createdAt).slice(0, 10) : today) : ex.sc === "unit" ? cu?.title || "単元" : "すべて")}` : "";
  async function runExport() {
    setExBusy(true);
    try {
      await flush();
      await exportNotes(ex.fm, exList, exBase);
      say?.(ex.fm === "pdf" ? "印刷の画面で「PDF に保存」を選んでください" : `ノート ${exList.length} 件を書き出しました`);
      setEx(null);
    } catch { say?.("書き出せませんでした"); } finally { setExBusy(false); }
  }
  const opt = (k, v, t, sub, n) => <button key={v} type="button" className="nt-o" aria-pressed={ex[k] === v} onClick={() => setEx(e => ({ ...e, [k]: v }))}><b>{t}</b><small>{sub}</small>{n != null && <em className="num">{n}</em>}</button>;

  return (
    <div className="th nt">
      <div className="th-top">
        <div><div className="eyebrow">自分用</div><h1 className="h1">ノート</h1></div>
        <div className="th-att">
          <span className="th-pill gy">全 <b className="num">{notes.length}</b> 件</span>
          <Btn kind="ghost sm" disabled={!notes.length} onClick={() => { flush(); setEx({ sc: d?.noteId ? "day" : "all", fm: "md" }); }}>書き出す</Btn>
          <Btn kind="ghost sm" onClick={() => { flush(); window.open(window.location.href, "_blank"); }}>別のタブで開く</Btn>
          <Btn kind="sm" onClick={newNote}>今日のノートを書く</Btn>
        </div>
      </div>
      {partial && <div className="lms-err" role="alert">単元を確認できません <Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div>}
      <div className="nt-w">
        <nav className="card nt-nav" aria-label="ノート">
          <span className="fsearch nt-q"><input type="search" value={q} placeholder="ノートを探す" aria-label="ノートを探す" onChange={e => setQ(e.target.value)} /></span>
          <span className="tm-seg nt-gs">{[["date", "日付ごと"], ["unit", "単元ごと"]].map(([k, t]) => <button key={k} type="button" aria-pressed={grp === k} onClick={() => setGrp(k)}>{t}</button>)}</span>
          <div className="nt-l">
            {d && !d.noteId && <button type="button" className="nt-i" aria-current="true"><b>{d.title || "新しいノート"}</b><small>いま</small></button>}
            {groups.map(([t, l, now]) => (
              <React.Fragment key={t}>
                <div className={`nt-gh${now ? " now" : ""}`}><span>{t}</span><em className="num">{l.length}</em></div>
                {l.map(n => {
                  const on = d?.noteId === n.noteId;
                  return <button key={n.noteId} type="button" className="nt-i" aria-current={on} onClick={() => { if (!on) open(n); }}><b>{on ? d.title || "（題名なし）" : titleOf(n)}</b><small className="num">{grp === "unit" && dk(n) ? `${md(dk(n))} ・ ` : ""}{hhmm(n)}</small></button>;
                })}
              </React.Fragment>
            ))}
            {!groups.length && <div className="nt-none"><Chip>{q0 ? "見つかりません" : "なし"}</Chip></div>}
          </div>
        </nav>
        <Card className="pad nt-ed">
          {!d ? <div className="empty"><b>ノート</b><Btn kind="sm" onClick={newNote}>今日のノートを書く</Btn></div> : (
            <>
              <div className="nt-h">
                <div className="nt-meta">
                  <span className="eyebrow num">{when}</span>
                  {lessons.length > 0
                    ? <select className="in nt-un" value={resolveUnitId(lessons, d.lessonId)} aria-label="単元" onChange={e => change({ lessonId: e.target.value })}>{!d.lessonId && <option value="">単元なし</option>}{lessons.map(l => <option key={l.id} value={l.id}>単元 {unitNo(l)} {l.title}</option>)}</select>
                    : <Chip>単元なし</Chip>}
                  {d.materialId && <button type="button" className="nt-src" onClick={() => setViewing({ materialId: d.materialId, title: mat?.title || "教材", page: d.page || 1 })}><span>{mat?.title || "教材"}{d.page ? ` ・ ${d.page} ページ` : ""}</span></button>}
                </div>
                <span className="tm-seg">{[["edit", "書く"], ["read", "読む"]].map(([k, t]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}>{t}</button>)}</span>
              </div>
              {view === "read"
                ? <><h2 className="nt-tt">{d.title || "（題名なし）"}</h2><div className="nt-rd feeps-lesson-md"><ReactMarkdown skipHtml>{d.rest}</ReactMarkdown></div></>
                : <>
                  <input type="text" className="nt-ti" value={d.title} placeholder="題名" aria-label="題名" onChange={e => change({ title: e.target.value.replace(/\n/g, " ") })} />
                  <textarea className="nt-ta" value={d.rest} aria-label="本文" spellCheck={false} onChange={e => change({ rest: e.target.value })} />
                </>}
              <div className="nt-f">
                {save === "err" ? <span className="nt-ng" role="alert">保存できませんでした <Btn kind="ghost sm" onClick={flush}>もう一度</Btn></span>
                  : save === "saving" ? <span>保存しています</span>
                  : d.noteId || save === "ok" ? <span className="nt-ok"><i aria-hidden="true">✓</i>自動保存済み</span> : <span>未保存</span>}
                <span className="num">{compose(d).length} 文字</span>
                <span style={{ marginLeft: "auto" }} />
                <Btn kind="ghost sm" onClick={() => setDel(true)}>消す</Btn>
                <Btn kind="ghost sm" onClick={() => { flush(); go("report"); }}>日報を開く</Btn>
              </div>
            </>
          )}
        </Card>
      </div>

      {del && (
        <Modal title="ノートを消す" width={420} onClose={() => setDel(false)} footer={<><Btn kind="ghost" onClick={() => setDel(false)}>やめる</Btn><Btn onClick={remove}>消す</Btn></>}>
          <b>{d?.title || "（題名なし）"}</b>
        </Modal>
      )}
      {ex && (
        <Modal title="ノートを書き出す" width={560} onClose={() => setEx(null)} footer={<><Btn kind="ghost" onClick={() => setEx(null)}>やめる</Btn><Btn disabled={!exList.length || exBusy} onClick={runExport}>{exBusy ? "書き出しています" : "書き出す"}</Btn></>}>
          <div className="nt-x">
            <span className="eyebrow">どれを</span>
            <div className="nt-os">
              {opt("sc", "one", "このノート", d?.title || "—", toExport("one").length)}
              {opt("sc", "day", "この日", d?.createdAt ? md(String(d.createdAt).slice(0, 10)) : md(today), toExport("day").length)}
              {opt("sc", "unit", "この単元", cu?.title || "—", toExport("unit").length)}
              {opt("sc", "all", "すべて", "全部の単元", toExport("all").length)}
            </div>
            <span className="eyebrow">どの形で</span>
            <div className="nt-os">{Object.entries(NOTE_FORMATS).map(([v, [t, e, sub]]) => opt("fm", v, t, `${e} ・ ${sub}`))}</div>
            <div className="nt-fn"><b>{exBase}{NOTE_FORMATS[ex.fm][1]}</b><span className="num">{exList.length} 件</span></div>
            {exList[0] && <pre className="nt-pv">{(ex.fm === "txt" ? notesToText([exList[0]]) : notesToMarkdown([exList[0]])).trim()}{exList.length > 1 ? `\n\nほか ${exList.length - 1} 件` : ""}</pre>}
          </div>
        </Modal>
      )}
      {viewing && <Suspense fallback={null}><div className="lms-legacy"><MaterialViewer courseId={st.courseId} material={{ materialId: viewing.materialId, title: viewing.title, mode: "view" }} initialPage={viewing.page} onClose={() => setViewing(null)} canAnnotate /></div></Suspense>}
    </div>
  );
}
