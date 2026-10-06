import React, { useCallback, useEffect, useState } from "react";
import * as A from "../studio/api.js";
import { fmtTime } from "./parts.jsx";

/* 教材 › コース（モック tenolab-admin.html の「教材」：左に一覧、右にプレビュー）。
   作るのは「AIと作る」（#/studio）。スライド1枚ごとの手直しなどは「細かく直す」（元のEラーニングの管理画面）で */
const urlCache = new Map();
function useSlideUrl(materialId) {
  const [url, setUrl] = useState(materialId ? urlCache.get(materialId) || "" : "");
  useEffect(() => {
    if (!materialId) { setUrl(""); return undefined; }
    if (urlCache.get(materialId)) { setUrl(urlCache.get(materialId)); return undefined; }
    let alive = true;
    A.viewUrl(materialId).then(r => { urlCache.set(materialId, r.url); if (alive) setUrl(r.url); }).catch(() => {});
    return () => { alive = false; };
  }, [materialId]);
  return url;
}
const isEx = x => x && !["image", "summary", "concept", "video", "pdf", "_cover", "_divider"].includes(x.kind);
function stateOf(c) {
  if (!c.published) return ["下書き", ""];
  if (c.contentUpdatedAt && c.publishedAt && c.contentUpdatedAt > c.publishedAt) return ["未公開の変更あり", "warn"];
  return ["公開中", "done"];
}

export default function CourseList({ topics, go }) {
  const [st, setSt] = useState({ state: "loading", items: [] });
  const [sel, setSel] = useState("");
  const load = useCallback(() => {
    setSt(s => ({ ...s, state: "loading" }));
    A.listCourses().then(items => {
      const list = (Array.isArray(items) ? items : []).filter(c => !c.deleted).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      setSt({ state: "ready", items: list });
      setSel(cur => cur || list[0]?.id || "");
    }).catch(() => setSt({ state: "error", items: [] }));
  }, []);
  useEffect(() => { load(); }, [load]);
  const topicName = id => topics.find(t => t.id === id)?.name || "その他";
  const course = st.items.find(c => c.id === sel);
  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <a className="btn" href="#/studio">AIと作る</a>
        <button type="button" className="btn ghost" onClick={() => go("#/manage/courses/legacy")}>細かく直す</button>
      </div>
      {st.state === "loading" && <p className="muted">読み込んでいます…</p>}
      {st.state === "error" && <div className="card flat" style={{ padding: 16 }} role="alert">読み込めませんでした。 <button type="button" className="btn ghost" onClick={load}>もう一度</button></div>}
      {st.state === "ready" && (
        <div className="matgrid">
          <section className="card flat" style={{ padding: "4px 8px" }}>
            {st.items.length ? (
              <div className="tblwrap"><table className="mtbl">
                <tbody>
                  {st.items.map(c => { const s = stateOf(c); return (
                    <tr key={c.id} className={c.id === sel ? "sel" : ""} onClick={() => setSel(c.id)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") setSel(c.id); }}>
                      <td><span className="muted" style={{ fontSize: 12 }}>{topicName(c.topic)}{c.level ? ` ・ ${c.level}` : ""}</span><div><b>{c.title || "（名前なし）"}</b></div>{c.lessons > 0 && <span className="muted" style={{ fontSize: 12 }}>{c.lessons}レッスン</span>}</td>
                      <td className="rt"><span className={`chip ${s[1]}`}>{s[0]}</span><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{fmtTime(c.updatedAt)}</div></td>
                    </tr>
                  ); })}
                </tbody>
              </table></div>
            ) : <p className="muted" style={{ padding: 12 }}>まだありません。「AIと作る」から作れます。</p>}
          </section>
          {course && <Preview key={course.id} course={course} topicName={topicName(course.topic)} go={go} onChanged={load} />}
        </div>
      )}
    </>
  );
}

function Preview({ course, topicName, go, onChanged }) {
  const [lessons, setLessons] = useState(null);
  const [li, setLi] = useState(0);
  const [si, setSi] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let alive = true;
    A.getLessons(course.id).then(items => {
      if (!alive) return;
      const list = (Array.isArray(items) ? items : []).filter(l => !l.deleted && l.status !== "deleted").sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      setLessons(list);
    }).catch(() => alive && setLessons([]));
    return () => { alive = false; };
  }, [course.id]);
  const lesson = lessons?.[li];
  const slides = lesson?.slides || [];
  const slide = slides[si];
  const url = useSlideUrl(slide?.kind === "image" ? slide.content?.materialId : "");
  const s = stateOf(course);
  async function publish() {
    setBusy(true); setMsg("");
    try { await A.publishCourse(course.id); setMsg("公開しました。"); onChanged(); }
    catch (e) { setMsg(e?.errorMessage || "公開できませんでした。"); }
    finally { setBusy(false); }
  }
  return (
    <section className="card msec prev">
      <div className="row"><span className="eyebrow">PREVIEW</span><span className={`chip ${s[1]}`} style={{ marginLeft: "auto" }}>{s[0]}</span></div>
      <h2 style={{ fontSize: 19, margin: 0 }}>{course.title}</h2>
      <span className="muted" style={{ fontSize: 12.5 }}>{topicName} ・ {course.level || "入門"}</span>
      {lessons == null ? <p className="muted">読み込んでいます…</p> : !lessons.length ? <p className="muted">レッスンがまだありません。</p> : <>
        <div className={`pslide ${slide && isEx(slide) ? "ex" : ""}`}>
          {slide?.kind === "image" && url ? <img src={url} alt={slide.title || ""} />
            : <div className="pslide-t"><b>{slide ? (isEx(slide) ? (slide.kind === "code_run" ? "やってみよう" : slide.title) : slide.title) : ""}</b>{slide && isEx(slide) && <span>{slide.content?.task || slide.interaction?.question || slide.content?.question || ""}</span>}</div>}
        </div>
        <div className="pages">{slides.map((x, i) => <button key={x.id || i} type="button" className={isEx(x) ? "ex" : ""} aria-current={i === si} onClick={() => setSi(i)}>{isEx(x) ? "演習" : x.content?.sourcePage ? `p.${x.content.sourcePage}` : i + 1}</button>)}</div>
        {slide && (slide.caption || slide.content?.caption) && <div className="note">{slide.caption || slide.content?.caption}</div>}
        <ul className="lessons">{lessons.map((l, i) => (
          <li key={l.id || l.lessonId}><button type="button" className={`clrow ${i === li ? "on" : ""}`} onClick={() => { setLi(i); setSi(0); }}>
            <span className="n">{i + 1}</span>{l.title}<span className="chip" style={{ marginLeft: "auto" }}>{(l.slides || []).filter(x => !isEx(x)).length}枚{(l.slides || []).some(isEx) ? ` ・ 演習${(l.slides || []).filter(isEx).length}` : ""}</span>
          </button></li>
        ))}</ul>
      </>}
      {msg && <div className="verdict ok" role="status">{msg}</div>}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <a className="btn ghost" href={`#/courses/${encodeURIComponent(course.id)}`} target="_blank" rel="noopener noreferrer">受講生の画面で開く</a>
        <a className="btn ghost" href={`#/studio/course/${encodeURIComponent(course.id)}`}>AIで直す</a>
        {s[0] !== "公開中" && <button type="button" className="btn" style={{ marginLeft: "auto" }} onClick={publish} disabled={busy}>{busy ? "公開しています…" : s[0] === "下書き" ? "公開する" : "変更を公開する"}</button>}
      </div>
    </section>
  );
}
