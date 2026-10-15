import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiPost } from "../../../api.js";
import { SlideRenderer } from "../../learning/ElSlideLessonView.jsx";
import ExerciseBench, { BENCH_KINDS } from "./exercise/Bench.jsx";
import { ChoiceQuiz, CodeQuiz } from "./exercise/Quiz.jsx";

/* レッスン画面（モック tenolab-lesson.html、2026-10-08）
   パワポ＋PDFから作ったコースを、資料のページそのままで見せる。足したスライド（表紙・中扉・自動のまとめ）は出さない。
   代わりに、画面でタイトルだけの表紙（コースの最初）とレッスンの表紙（各レッスンの最初）を出す（2026-10-13、モック devhub-lesson-flow.html）。
   大きさはそのコースの資料のページと同じ縦横比。レッスンの表紙は単元の色を淡くした地。保存はしない（slide.id は _cover・_lesson）。
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
  if (slide.kind === "_title") return <span className={`lsn-thumb tt tt-${slide.variant}`} style={{ "--c": slide.color }} aria-hidden="true"><i /></span>;
  const url = useSlideUrl(lrn, slide.kind === "image" ? slide.content?.materialId : "");
  if (isExercise(slide)) return <span className="lsn-thumb ex">{slide.kind === "code_run" || slide.kind === "web_run" || slide.kind === "js_run" || slide.kind === "sql_run" ? "CODE" : "QUIZ"}</span>;
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
  if (slide.kind === "_title") return <TitlePage lrn={lrn} slide={slide} lastRatio={lastRatio} />;
  // クイズは紹介ページと同じ見た目と動き（2026-10-15、exercise/Quiz.jsx）
  if (slide.kind === "quiz" && (slide.interaction?.type === "choice" || slide.interaction?.type === "code")) {
    return <div className="lsn-frame free ex">{slide.interaction.type === "code" ? <CodeQuiz slide={slide} /> : <ChoiceQuiz slide={slide} />}</div>;
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

// 表紙・レッスンの表紙：タイトルだけ。縦横比はそのレッスンの最初の資料のページの画像から
function TitlePage({ lrn, slide, lastRatio }) {
  const url = useSlideUrl(lrn, slide.ratioFrom || "");
  const [ratio, setRatio] = useState(() => ratioCache.get(slide.ratioFrom) || lastRatio || 16 / 9);
  useEffect(() => {
    if (!url || ratioCache.get(slide.ratioFrom)) return undefined;
    let alive = true;
    const im = new Image();
    im.onload = () => { if (im.naturalWidth && im.naturalHeight) { const r = im.naturalWidth / im.naturalHeight; ratioCache.set(slide.ratioFrom, r); if (alive) setRatio(r); } };
    im.src = url;
    return () => { alive = false; };
  }, [url, slide.ratioFrom]);
  return (
    <div className={`lsn-frame lsn-title tt-${slide.variant}`} style={{ "--r": ratio, "--c": slide.color }}>
      {slide.variant === "course"
        ? <><h1>{slide.title}</h1><i className="rule" aria-hidden="true" /><span className="brand"><b>DevHub</b> Learning</span></>
        : <><span className="big" aria-hidden="true">{/^\d+$/.test(slide.no) ? slide.no.padStart(2, "0") : slide.no}</span><span className="no">LESSON {slide.no}</span><h2>{slide.title}</h2></>}
    </div>
  );
}

const FIRST_SUGG = ["もう少しかんたんに", "例えで説明して", "ここで大事なところは？"];

export default function LessonView({ ctx, course, lesson, lessons, slideId }) {
  const { lrn, go } = ctx;
  const li = lessons.findIndex(l => l.id === lesson.id);
  const slides = useMemo(() => {
    const real = [...(lesson.slides || [])]
      .filter(s => s && !HIDE_KINDS.has(s.kind) && s.status !== "hidden" && s.status !== "draft")
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    if (!real.length) return real;
    const ratioFrom = real.find(s => s.kind === "image")?.content?.materialId || "";
    const color = (ctx.topics || []).find(t => t.id === course.topic)?.color || "#2457E6";
    const no = String(lesson.title || "").match(/^\s*Lesson\s*\.?\s*([\d-]+)/i)?.[1] || String(li + 1);
    const head = { id: "_lesson", kind: "_title", variant: "lesson", no, color, ratioFrom, chatSlide: real[0],
      title: String(lesson.title || "").replace(/^\s*Lesson\s*\.?\s*[\d-]+\s*[.:：、]?\s*/i, "") || lesson.title, navLabel: `Lesson.${no}` };
    const cover = { id: "_cover", kind: "_title", variant: "course", ratioFrom, chatSlide: real[0], title: course.title, navLabel: "表紙" };
    return [...(li === 0 ? [cover] : []), head, ...real];
  }, [lesson, li, course.title, course.topic, ctx.topics]);
  const startAt = Math.max(0, slides.findIndex(s => s.id === slideId));
  const [i, setI] = useState(startAt);
  const [chatOpen, setChatOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth > 820 : true));
  const [focus, setFocus] = useState(false);
  const [lastRatio, setLastRatio] = useState(16 / 9);
  // 演習の作業台から受け取る「いまのコードと結果」（右のAIが一緒に見る）
  const exCtx = useRef(null);
  const [exSees, setExSees] = useState("");
  const chatAsk = useRef(null);
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
  // コードの演習は、言語ごとの作業台。左のページ一覧を細くして広く使う
  const bench = BENCH_KINDS.has(slide.kind);
  const askFromBench = q => { setChatOpen(true); setFocus(false); setTimeout(() => chatAsk.current?.(q), 0); };

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

      <div className={`lsn-layout ${chatOpen ? "" : "no-chat"} ${focus ? "focus" : ""} ${bench ? "ex" : ""}`}>
        <nav className="lsn-pages" aria-label="このレッスンのページ">
          {slides.map((s, k) => (
            <button key={s.id} type="button" aria-current={k === i} className={k < i ? "done" : ""} onClick={() => setI(k)}>
              <span className="n">{k < i ? "✓" : k + 1}</span><Thumb lrn={lrn} slide={s} /><span className="t">{decode(labelOf(s, k))}</span>
            </button>
          ))}
        </nav>
        {/* main 要素にはテノラボ全体の上下の余白が付くので、section にする（真ん中だけ下にずれていた） */}
        {bench ? (
          <section className="lsn-stage ex">
            <ExerciseBench key={slide.id} focus={focus} slide={slide} lrn={lrn} course={course} lesson={lesson} onContext={c => { exCtx.current = c; setExSees(c.language); }} onAsk={askFromBench} />
          </section>
        ) : (
          <section className="lsn-stage">
            <div className="lsn-fwrap"><Page key={slide.id} lrn={lrn} slide={slide} course={course} lesson={lesson} index={i} total={total} lastRatio={lastRatio} onRatio={setLastRatio} /></div>
            {caption && <div className="lsn-cap">{caption}</div>}
          </section>
        )}
        {chatOpen && <LessonChat course={course} lesson={lesson} slide={slide.chatSlide ? { ...slide.chatSlide, title: slide.navLabel } : slide} index={i} onClose={() => setChatOpen(false)} exCtx={bench ? exCtx : null} sees={bench ? exSees : ""} askRef={chatAsk} />}
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

// 演習のページで、AIが一緒に見ているもの（単語の印で出す）
const SEES = { java: ["ページ", "コード", "出力"], web: ["ページ", "HTML", "CSS", "表示"], js: ["ページ", "コード", "コンソール"], sql: ["ページ", "SQL", "結果"] };
const EX_SUGG = { java: ["この書き方で合ってる？", "ヒントだけほしい", "エラーの意味は？"], web: ["思ったとおりに見えないのはなぜ？", "どこを見ればいい？", "ヒントだけほしい"], js: ["思ったとおりに動かないのはなぜ？", "エラーの意味は？", "ヒントだけほしい"], sql: ["期待する結果にならないのはなぜ？", "エラーの意味は？", "ヒントだけほしい"] };

/* いつも横にいるAIチャット。今のページについて答える（既存の POST /learning/slides/ask）。
   コードの演習のページでは、書いているコードと結果も一緒に送る（既存の POST /learning/exercises/{java|web}/ask。答えのコードは返さない） */
function LessonChat({ course, lesson, slide, index, onClose, exCtx, sees, askRef }) {
  const [msgs, setMsgs] = useState([{ who: "ai", text: "このページで分からないところがあれば、いつでも聞いてください。" }]);
  const [sugg, setSugg] = useState(FIRST_SUGG);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);
  const hist = useRef([]);
  const busyRef = useRef(false);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy]);
  useEffect(() => { setSugg(sees ? EX_SUGG[sees] || FIRST_SUGG : FIRST_SUGG); }, [slide.id, sees]);
  useEffect(() => { if (askRef) askRef.current = ask; });
  async function ask(q) {
    const v = String(q || "").trim();
    if (!v || busyRef.current) return;
    busyRef.current = true;
    setText("");
    setMsgs(m => [...m, { who: "me", text: v }]);
    setBusy(true);
    try {
      const c = exCtx?.current;
      const res = c
        ? await apiPost(`/learning/exercises/${c.language === "web" ? "web" : c.language === "js" ? "js" : c.language === "sql" ? "sql" : "java"}/ask`, { courseId: course.id, lessonId: lesson.id, slideId: slide.id, source: c.source, files: c.files, output: c.output, compiled: c.compiled, question: v, history: hist.current.slice(-4) })
        : await apiPost("/learning/slides/ask", { courseId: course.id, lessonId: lesson.id, slideId: slide.id, question: v, history: hist.current.slice(-4) });
      const a = res?.answer || "うまく答えられませんでした。聞き方を変えてみてください。";
      hist.current.push({ role: "user", text: v }, { role: "assistant", text: a });
      setMsgs(m => [...m, { who: "ai", text: a }]);
      setSugg(Array.isArray(res?.followUps) && res.followUps.length ? res.followUps : sees ? EX_SUGG[sees] || FIRST_SUGG : FIRST_SUGG);
    } catch (e) {
      setMsgs(m => [...m, { who: "ai", text: e?.errorMessage || "回答を作れませんでした。時間をおいてお試しください。" }]);
    } finally { busyRef.current = false; setBusy(false); }
  }
  return (
    <aside className={`lsn-chat ${sees && SEES[sees] ? "has-sees" : ""}`} aria-label="AIに聞く">
      <div className="ch"><b>AIに聞く</b><span className="ctx">p.{index + 1}「{decode(slide.title || slide.navLabel || "")}」について</span><button type="button" onClick={onClose} aria-label="閉じる">×</button></div>
      {sees && SEES[sees] && <div className="sees" aria-label="AIが見ているもの">{SEES[sees].map(s => <span key={s}>{s}</span>)}</div>}
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
