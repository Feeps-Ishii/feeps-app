import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiPost } from "../../../api.js";
import { SlideRenderer } from "../../learning/ElSlideLessonView.jsx";

/* レッスン画面（モック tenolab-lesson.html、2026-10-08）
   パワポ＋PDFから作ったコースを、資料のページそのままで見せる。足したスライド（表紙・中扉・自動のまとめ）は出さない。
   左：このレッスンのページ／中：16:9 の枠にページ（演習も同じ枠）とその説明／右：いつもいるAIチャット。
   下に、ついてくる操作の帯（前へ・ページ数・次へ・AIに聞く・集中）。← → でもページを動かせる。
   進み具合は今までどおり lrn.touchLesson（最後に開いた）と lrn.completeLesson（最後のページで「次のレッスン」）。 */
const HIDE_KINDS = new Set(["summary", "_cover", "_divider"]);
const isExercise = s => s && !["image", "concept", "video", "pdf", "figure", "table", "compare", "chapter", "agenda", "hook", "steps", "columns", "work"].includes(s.kind);
const urlCache = new Map();
const labelOf = (s, i) => s?.navLabel || s?.title || `ページ ${i + 1}`;
// AIが作った説明に「&lt;」のような文字参照が混ざることがある。画面ではふつうの文字に戻す
const ENT = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };
const decode = t => String(t || "").replace(/&(lt|gt|amp|quot|#39|apos|nbsp);/g, m => ENT[m] || m);

function useSlideUrl(lrn, materialId) {
  const [url, setUrl] = useState(materialId ? urlCache.get(materialId) || "" : "");
  useEffect(() => {
    if (!materialId || !lrn?.getMaterialViewUrl) { setUrl(""); return undefined; }
    if (urlCache.get(materialId)) { setUrl(urlCache.get(materialId)); return undefined; }
    let alive = true;
    lrn.getMaterialViewUrl(materialId).then(r => { if (r?.url) { urlCache.set(materialId, r.url); if (alive) setUrl(r.url); } }).catch(() => {});
    return () => { alive = false; };
  }, [lrn, materialId]);
  return url;
}

function Thumb({ lrn, slide }) {
  const url = useSlideUrl(lrn, slide.kind === "image" ? slide.content?.materialId : "");
  if (isExercise(slide)) return <span className="lsn-thumb ex">{slide.kind === "code_run" || slide.kind === "web_run" ? "CODE" : "QUIZ"}</span>;
  return <span className="lsn-thumb">{url ? <img src={url} alt="" loading="lazy" /> : null}</span>;
}

// 資料のページの縦横比（4:3・16:9 など）は、読み込んだ画像の大きさから決める。決まるまでは前のページの比率
const ratioCache = new Map();
function Page({ lrn, slide, course, lesson, index, total, lastRatio, onRatio }) {
  const materialId = slide.kind === "image" ? slide.content?.materialId : "";
  const url = useSlideUrl(lrn, materialId);
  const [ratio, setRatio] = useState(() => ratioCache.get(materialId) || lastRatio || 16 / 9);
  if (slide.kind === "image") {
    const onLoad = e => {
      const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
      if (w && h) { const r = w / h; ratioCache.set(materialId, r); setRatio(r); onRatio?.(r); }
    };
    return (
      <div className="lsn-frame" style={{ "--r": ratio }}>
        {url ? <img src={url} alt={slide.content?.alt || slide.title || ""} onLoad={onLoad} /> : <span className="lsn-wait">読み込んでいます…</span>}
      </div>
    );
  }
  // 演習やそのほかの版面は、元の部品をそのまま同じ枠の中に
  return (
    <div className={`lsn-frame free ${isExercise(slide) ? "ex" : ""}`}>
      <div className="tl-legacy lsn-legacy">
        <SlideRenderer slide={slide} accent={course.color || "#2457E6"} lrn={lrn} courseId={course.id} lessonId={lesson.id} index={index} total={total} />
      </div>
    </div>
  );
}

const FIRST_SUGG = ["もう少しかんたんに", "例えで説明して", "ここで大事なところは？"];

export default function LessonView({ ctx, course, lesson, lessons, slideId }) {
  const { lrn, go } = ctx;
  const slides = useMemo(() => [...(lesson.slides || [])]
    .filter(s => s && !HIDE_KINDS.has(s.kind) && s.status !== "hidden" && s.status !== "draft")
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0)), [lesson]);
  const startAt = Math.max(0, slides.findIndex(s => s.id === slideId));
  const [i, setI] = useState(startAt);
  const [chatOpen, setChatOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth > 820 : true));
  const [focus, setFocus] = useState(false);
  const [lastRatio, setLastRatio] = useState(16 / 9);
  const li = lessons.findIndex(l => l.id === lesson.id);
  const slide = slides[i];
  const total = slides.length;

  useEffect(() => { setI(Math.max(0, slides.findIndex(s => s.id === slideId))); }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { lrn.touchLesson?.(course.id, lesson.id); }, [course.id, lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // 今のページを URL に残す（開き直したときに同じページから）。履歴は増やさない
  useEffect(() => {
    if (!slide) return;
    const h = `#/courses/${encodeURIComponent(course.id)}/lessons/${encodeURIComponent(lesson.id)}/${encodeURIComponent(slide.id)}`;
    if (window.location.hash !== h) window.history.replaceState(null, "", h);
  }, [course.id, lesson.id, slide]);

  const toLesson = useCallback((n, atEnd) => {
    const l = lessons[n];
    if (!l) return;
    const ss = (l.slides || []).filter(s => s && !HIDE_KINDS.has(s.kind)).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const target = atEnd ? ss[ss.length - 1] : null;
    go(`#/courses/${encodeURIComponent(course.id)}/lessons/${encodeURIComponent(l.id)}${target ? `/${encodeURIComponent(target.id)}` : ""}`);
  }, [lessons, course.id, go]);
  const next = useCallback(() => {
    if (i < total - 1) { setI(i + 1); return; }
    lrn.completeLesson?.(course.id, lesson.id);
    if (li < lessons.length - 1) toLesson(li + 1);
    else go(`#/courses/${encodeURIComponent(course.id)}`);
  }, [i, total, li, lessons.length, course.id, lesson.id, lrn, go, toLesson]);
  const prev = useCallback(() => {
    if (i > 0) { setI(i - 1); return; }
    if (li > 0) toLesson(li - 1, true);
  }, [i, li, toLesson]);
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.("textarea,input,select,[contenteditable='true'],.cm-editor")) return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, prev]);

  if (!slide) {
    return (
      <div className="lsn-empty">
        <button type="button" className="back" onClick={() => go(`#/courses/${encodeURIComponent(course.id)}`)}>← {course.title}</button>
        <p className="muted">このレッスンにはまだページがありません。</p>
      </div>
    );
  }
  const last = i === total - 1;
  const caption = decode(slide.caption || slide.content?.caption || "");

  return (
    <div className="lsn">
      <div className="lsn-head">
        <button type="button" className="back" onClick={() => go(`#/courses/${encodeURIComponent(course.id)}`)}>← {course.title}</button>
        <label className="lsn-sel"><span className="chip">LESSON {li + 1}</span>
          <select id="lsn-lesson" value={lesson.id} aria-label="レッスン" onChange={e => toLesson(lessons.findIndex(l => l.id === e.target.value))}>
            {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </label>
        <div className="r"><span className="chip">{i + 1} / {total}ページ</span><span className="lsn-prog"><i style={{ width: `${(i + 1) / total * 100}%` }} /></span></div>
      </div>

      <div className={`lsn-layout ${chatOpen ? "" : "no-chat"} ${focus ? "focus" : ""}`}>
        <nav className="lsn-pages" aria-label="このレッスンのページ">
          {slides.map((s, k) => (
            <button key={s.id} type="button" aria-current={k === i} className={k < i ? "done" : ""} onClick={() => setI(k)}>
              <span className="n">{k < i ? "✓" : k + 1}</span><Thumb lrn={lrn} slide={s} /><span className="t">{decode(labelOf(s, k))}</span>
            </button>
          ))}
        </nav>
        {/* main 要素にはテノラボ全体の上下の余白が付くので、section にする（真ん中だけ下にずれていた） */}
        <section className="lsn-stage">
          <div className="lsn-fwrap"><Page key={slide.id} lrn={lrn} slide={slide} course={course} lesson={lesson} index={i} total={total} lastRatio={lastRatio} onRatio={setLastRatio} /></div>
          {caption && <div className="lsn-cap">{caption}</div>}
        </section>
        {chatOpen && <LessonChat course={course} lesson={lesson} slide={slide} index={i} onClose={() => setChatOpen(false)} />}
      </div>

      <div className="lsn-dock" role="toolbar" aria-label="ページの操作">
        <button type="button" onClick={prev} disabled={i === 0 && li === 0}>◀ <span className="lbl">前へ</span></button>
        <span className="pos">{i + 1} / {total}</span>
        <button type="button" className="next" onClick={next}><span className="lbl">{last ? (li < lessons.length - 1 ? "次のレッスン" : "コースへ戻る") : "次へ"}</span> ▶</button>
        <span className="sep" />
        <button type="button" aria-pressed={chatOpen} onClick={() => { setChatOpen(v => !v); setFocus(false); }}>AI <span className="lbl">に聞く</span></button>
        <button type="button" aria-pressed={focus} onClick={() => { setFocus(v => !v); if (!focus) setChatOpen(false); }}>⤢ <span className="lbl">集中</span></button>
      </div>
    </div>
  );
}

/* いつも横にいるAIチャット。今のページについて答える（既存の POST /learning/slides/ask） */
function LessonChat({ course, lesson, slide, index, onClose }) {
  const [msgs, setMsgs] = useState([{ who: "ai", text: "このページで分からないところがあれば、いつでも聞いてください。" }]);
  const [sugg, setSugg] = useState(FIRST_SUGG);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);
  const hist = useRef([]);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy]);
  useEffect(() => { setSugg(FIRST_SUGG); }, [slide.id]);
  async function ask(q) {
    const v = String(q || "").trim();
    if (!v || busy) return;
    setText("");
    setMsgs(m => [...m, { who: "me", text: v }]);
    setBusy(true);
    try {
      const res = await apiPost("/learning/slides/ask", { courseId: course.id, lessonId: lesson.id, slideId: slide.id, question: v, history: hist.current.slice(-4) });
      const a = res?.answer || "うまく答えられませんでした。聞き方を変えてみてください。";
      hist.current.push({ role: "user", text: v }, { role: "assistant", text: a });
      setMsgs(m => [...m, { who: "ai", text: a }]);
      setSugg(Array.isArray(res?.followUps) && res.followUps.length ? res.followUps : FIRST_SUGG);
    } catch (e) {
      setMsgs(m => [...m, { who: "ai", text: e?.errorMessage || "回答を作れませんでした。時間をおいてお試しください。" }]);
    } finally { setBusy(false); }
  }
  return (
    <aside className="lsn-chat" aria-label="AIに聞く">
      <div className="ch"><b>AIに聞く</b><span className="ctx">p.{index + 1}「{decode(slide.title || slide.navLabel || "")}」について</span><button type="button" onClick={onClose} aria-label="閉じる">×</button></div>
      <div className="log" ref={logRef} aria-live="polite">
        {msgs.map((m, k) => (
          <div key={k} className={`msg ${m.who === "me" ? "me" : ""}`}>
            {m.who === "me" ? <div className="b">{m.text}</div> : <><div className="who">テ</div><div className="b">{m.text}</div></>}
          </div>
        ))}
        {busy && <div className="msg"><div className="who">テ</div><div className="b typing"><i /><i /><i /></div></div>}
      </div>
      <div className="sugg">{sugg.map(s => <button key={s} type="button" disabled={busy} onClick={() => ask(s)}>{s}</button>)}</div>
      <form className="compose" onSubmit={e => { e.preventDefault(); ask(text); }}>
        <textarea id="lsn-ask" rows={1} value={text} placeholder="このページについて聞く" aria-label="AIへの質問" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(text); } }} />
        <button className="btn" type="submit" disabled={busy || !text.trim()}>送る</button>
      </form>
    </aside>
  );
}
