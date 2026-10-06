import React, { useEffect, useRef, useState } from "react";
import { manage } from "../data.js";
import { runCode, FILE_NAME } from "../runtime.js";
import { readPptxSlides } from "./pptx.js";
import { initialMapping, rowStatus, shiftSuggestion, shifted, autoSkip } from "./align.js";
import * as A from "./api.js";
import "./studio.css";
import "./studio-extra.css";

/* 教材づくり（AIとチャットで作る）。モック docs/design/mockups/tenolab-2026-09/tenolab-studio.html の画面・流れのとおり。
   左がAIとの会話、右が作っているもの。
     コース：資料 → 位置合わせ → 構成 → 演習 → 公開（取り込みは既存の /learning/admin/pdf-import。構成で止めて直してから作る）
     演習：内容 → 演習の案 → 公開 ／ 案件体験：内容 → チケット → 公開（AIの下書き → ブラウザでお手本がテストを通るか確かめる → 公開）
   #/studio から始める。#/studio/course/{courseId} は既存のコースの「演習」から（コース一覧の「AIで直す」）。 */
const STEPS = { course: ["資料", "位置合わせ", "構成", "演習", "公開"], drill: ["内容", "演習の案", "公開"], case: ["内容", "チケット", "公開"] };
const RUNTIME_NAME = { js: "JavaScript", web: "HTML / CSS", java: "Java", sql: "SQL", check: "チェック", aws: "AWS" };
const LEVELS = ["入門", "初級", "中級", "上級"];
const SAVE_KEY = "tl-studio";
const EX_LABEL = { code_run: "コード演習", web_run: "HTML/CSSの演習" };
const exLabel = s => EX_LABEL[s.kind] || "確認クイズ";
const isExercise = s => s && !["image", "summary", "concept", "video", "pdf", "_cover", "_divider"].includes(s.kind);
const newId = p => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const itemId = p => `${p}${Date.now().toString(36)}`;

// 「**太字**」だけを太字にする（AIの吹き出し）
function rich(text) {
  return String(text || "").split(/(\*\*[^*]+\*\*)/).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : <React.Fragment key={i}>{part}</React.Fragment>));
}
function readSaved() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) { return null; } }
function writeSaved(v) { try { if (v) localStorage.setItem(SAVE_KEY, JSON.stringify(v)); else localStorage.removeItem(SAVE_KEY); } catch (e) { /* 保存できなくても続ける */ } }
const normLesson = (l, i) => ({ ...l, id: l.id || l.lessonId, slides: Array.isArray(l.slides) ? l.slides : [], order: Number.isFinite(Number(l.order)) ? Number(l.order) : i, published: l.status ? l.status === "published" : l.published !== false });

const EMPTY = {
  flow: "", step: 0, busy: "", proposal: null, retrying: false, lastInstruction: "", published: false,
  // コース
  pdf: null, pptx: null, pages: [], slides: [], noteSrc: [], skip: [], courseId: "", importId: "", uploaded: [], plan: null, lessons: null, course: null,
  inserted: [], justInserted: null, topic: "", level: "入門", finalCount: null,
  // 演習・案件体験
  draft: null, check: null,
};

export default function StudioPage({ ctx, rest }) {
  const { topics, lrn } = ctx;
  const [st, setSt] = useState(EMPTY);
  const [msgs, setMsgs] = useState([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const sref = useRef(EMPTY);
  const logRef = useRef(null);
  const pptxIn = useRef(null), pdfIn = useRef(null), frame = useRef(null);
  const thumbs = useRef(new Map());
  const [, bump] = useState(0);

  // 流れの途中（await の後）でもすぐ最新を読めるよう、sref を先に書き換えてから画面に渡す
  const set = patch => { const prev = sref.current; const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) }; sref.current = next; setSt(next); };
  const say = (who, body, quick = []) => setMsgs(m => [...m, { id: newId("m"), who, body, quick, used: false }]);
  const ai = async (body, quick = [], delay = 350) => { setTyping(true); await new Promise(r => setTimeout(r, delay)); setTyping(false); say("ai", body, quick); };
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, typing]);

  // 失敗したときの共通の返事
  async function fail(e, quick = []) { set({ busy: "" }); setTyping(false); await ai(e?.errorMessage || e?.message || "うまくいきませんでした。もう一度お試しください。", quick, 0); }

  /* ---------- 始め方 ---------- */
  useEffect(() => {
    if (rest[0] === "course" && rest[1]) { openCourse(decodeURIComponent(rest[1])); return; }
    const saved = readSaved();
    if (saved?.flow === "course" && saved.importId) {
      ai("作りかけのコースがあります。続きから進めますか？", [["続きから", "resume", true], ["最初から", "restart"]], 200);
      return;
    }
    restart();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function restart() {
    writeSaved(null);
    sref.current = EMPTY; setSt(EMPTY); setMsgs([]);
    ai("何を作りますか？", [["コース（パワポから）", "course", true], ["演習", "drill"], ["案件体験", "case"]], 300);
  }

  /* ---------- 会話の入口 ---------- */
  function onQuick(msgId, label, act) {
    setMsgs(m => m.map(x => (x.id === msgId ? { ...x, used: true } : x)));
    say("me", label);
    run(act, label);
  }
  // AIが作業している間も送れる。送ったものは、今の作業が終わってから順に扱う（2026-10-07 ユーザー指摘：説明を書いている間に構成を直せなかった）
  const pending = useRef([]);
  function onSend(e) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText("");
    say("me", v);
    if (sref.current.busy) {
      pending.current.push(v);
      say("ai", "受け取りました。今の作業が終わったら、続けて直します。");
      return;
    }
    freeText(v);
  }
  // 作業が終わったところで、待っている指示を1つずつ扱う
  async function drainPending() {
    while (pending.current.length && !sref.current.busy) {
      const v = pending.current.shift();
      await freeText(v);
    }
  }
  const STRUCT_RE = /レッスン|lesson|構成|分け|まとめ|ずれ|ズレ|はじめに|名前|タイトル|章/i;
  const EXER_RE = /演習|クイズ|問題|コード|入れて|挟/;
  async function freeText(v) {
    const s = sref.current;
    if (!s.flow) { run(/演習/.test(v) && !/コース/.test(v) ? "drill" : /案件/.test(v) ? "case" : "course"); return; }
    if (s.flow === "course") {
      if (s.step === 2) { await doReplan(v); return; }
      // 演習の段階でも、レッスンの分け方は言葉で直せる（スライドは作り直さない）
      if (s.step === 3 && STRUCT_RE.test(v) && !EXER_RE.test(v)) { await doRestructure(v); return; }
      if (s.step === 3) { await doExercise(s.retrying && s.proposal ? `${s.lastInstruction}。${v}` : v); return; }
      ai(s.step <= 1 ? "この段階では、右の画面とボタンで進めてください。" : "公開の前の確認です。右の画面で単元と難易度を選んで、公開してください。");
      return;
    }
    doDraft(s.draft ? v : v, s.draft || null);
  }

  /* ---------- 動き ---------- */
  async function run(act, label) {
    const s = sref.current;
    try {
      if (act === "restart") { restart(); return; }
      if (act === "resume") { await resume(); return; }
      if (act === "course" || act === "drill" || act === "case") {
        writeSaved(null);
        set({ ...EMPTY, flow: act });
        if (act === "course") await ai("パワポ（.pptx）と、PowerPointで書き出したPDFを入れてください。\nノートはスライドの説明に使います。");
        if (act === "drill") await ai("どんな演習にしますか？ 単元と、やってほしいことを教えてください。", [["JavaScriptで配列の平均を出す演習", "say"]]);
        if (act === "case") await ai("題材にしたい案件を教えてください。どの業務の、どの機能かがあると作りやすいです。", [["予約サイトの入力チェック", "say"]]);
        return;
      }
      if (act === "say") { freeText(label); return; }
      if (act === "noPptx") { await readFiles(true); return; }
      if (act === "fixShift") { applyShift(); return; }
      if (act === "selfFix") { await ai("右の ↑↓ でノートを動かせます。使わないページは、右の印を押すと切り替わります。直したら教えてください。", [["直しました", "toPlan", true]]); return; }
      if (act === "toPlan") { await toPlan(); return; }
      if (act === "toExercise") { await toExercise(); return; }
      if (act === "accept") { await acceptProposal(); return; }
      if (act === "retry") { set({ retrying: true }); await ai("どこを直しますか？（例：もう少しやさしく／出力を変えて）"); return; }
      if (act === "drop") { set({ proposal: null, retrying: false }); await ai("やめました。ほかに入れたい演習があれば指示してください。", [["演習はこれで十分", "toPublish", true]]); return; }
      if (act === "toPublish") { await toPublish(); return; }
      if (act === "finalTest") { await makeFinalTest(); return; }
      if (act === "preview") { window.open(`${window.location.pathname}#/courses/${encodeURIComponent(s.courseId)}`, "_blank", "noopener"); return; }
      if (act === "publish") { await publishCourseNow(); return; }
      if (act === "publishDraft") { await publishDraft(); return; }
      if (act === "retryDraft") { set({ retrying: true }); await ai("どこを直しますか？（例：もう少し難しく／条件を1つ足して）"); return; }
    } catch (e) { await fail(e); }
  }

  /* ---------- コース：資料 ---------- */
  function pickFile(kind, file) {
    if (!file) return;
    if (kind === "pdf" && !/\.pdf$/i.test(file.name)) { ai("PDF（.pdf）を入れてください。"); return; }
    if (kind === "pptx" && !/\.pptx$/i.test(file.name)) { ai("パワポは .pptx の形で入れてください（古い .ppt は、PowerPointで .pptx に保存し直してください）。"); return; }
    set({ [kind]: file });
    const s = sref.current;
    if (s.pdf && s.pptx) readFiles(false);
    else if (kind === "pdf") ai("PDFを受け取りました。パワポも入れると、発表者ノートを説明に使います。", [["パワポなしで進める", "noPptx"]]);
    else ai("パワポを受け取りました。書き出したPDFも入れてください。");
  }
  async function readFiles(noPptx) {
    const s = sref.current;
    if (!s.pdf || s.busy) return;
    set({ busy: "read" });
    setTyping(true);
    let slides = [];
    if (s.pptx && !noPptx) {
      try { slides = await readPptxSlides(s.pptx); } catch (e) { console.warn("pptx read failed", e); await ai("パワポを読み取れませんでした。PDFだけで進めます。"); }
    }
    const { pages, numPages } = await A.renderPdf(s.pdf, (n, total) => set({ busy: `read:${n}/${total}` }));
    const noteSrc = initialMapping(pages, slides);
    const skip = autoSkip(pages);
    set({ busy: "", pages, slides, noteSrc, skip, step: 1 });
    setTyping(false);
    const notes = slides.filter(x => x.notes && !x.hidden).length;
    const hidden = slides.filter(x => x.hidden).length;
    await ai(`読み取りました。**${pages.length}ページ${slides.length ? `・ノート${notes}枚` : ""}**です。${numPages > pages.length ? `\n（${A.MAX_PAGES}ページまで使います）` : ""}${hidden ? `\nパワポに非表示のスライドが${hidden}枚あり、PDFには入っていないので外して合わせました。` : ""}`, [], 200);
    await alignMessage();
  }
  async function alignMessage() {
    const s = sref.current;
    if (!s.slides.length) { await ai("ノートが無いので、スライドの説明はページの内容から書きます。\n使わないページ（表紙など）は、右の印を押すと切り替わります。", [["確認しました", "toPlan", true]]); return; }
    const status = rowStatus(s.pages, s.slides, s.noteSrc);
    const sug = shiftSuggestion(s.pages, s.slides, s.noteSrc, status);
    const skipped = s.pages.filter((_, i) => s.skip[i]).map(p => `p.${p.page}`);
    if (sug) {
      const p = s.pages[sug.from];
      const note = s.slides[s.noteSrc[sug.from]]?.notes || "";
      await ai(`ページとノートの組み合わせを確かめてください。\n**p.${p.page} から後ろのノートが、${sug.delta < 0 ? "1つ後ろ" : "1つ前"}のページの内容になっているようです。**${note ? `（p.${p.page}「${(p.text || "").slice(0, 16)}」に、「${note.slice(0, 24)}…」が付いています）` : ""}`,
        [[`p.${p.page} 以降を${sug.delta < 0 ? "1つ後ろへ" : "1つ前へ"}`, "fixShift", true], ["自分で直す", "selfFix"]]);
      return;
    }
    await ai(`ページとノートの組み合わせを確かめました。**${s.pages.length}ページすべて、ページとノートがそろっています。**${skipped.length ? `\n${skipped.join("・")} は、スライドには使いません。` : ""}`, [["確認しました", "toPlan", true]]);
  }
  function applyShift() {
    const s = sref.current;
    const status = rowStatus(s.pages, s.slides, s.noteSrc);
    const sug = shiftSuggestion(s.pages, s.slides, s.noteSrc, status);
    if (sug) set({ noteSrc: shifted(s.noteSrc, sug.from, sug.delta, s.slides.length) });
    const after = sref.current;
    const left = rowStatus(after.pages, after.slides, after.noteSrc).filter(x => x === "off").length;
    ai(left ? `直しました。まだ合わないページが${left}つあります。右の ↑↓ で直してください。` : `直しました。**${after.pages.length}ページすべて、ページとノートがそろっています。**`, [[left ? "直しました" : "確認しました", "toPlan", true]]);
  }
  function moveNote(i, d) {
    const s = sref.current;
    const j = i + d;
    if (j < 0 || j >= s.noteSrc.length) return;
    const next = [...s.noteSrc];
    [next[i], next[j]] = [next[j], next[i]];
    set({ noteSrc: next });
  }
  function toggleSkip(i) { set(s => ({ skip: s.skip.map((v, k) => (k === i ? !v : v)) })); }

  /* ---------- コース：構成 ---------- */
  async function toPlan() {
    const s = sref.current;
    const use = s.pages.map((p, i) => ({ ...p, i })).filter(p => !s.skip[p.i]);
    if (!use.length) { await ai("使うページがありません。右の印で、使うページを選んでください。"); return; }
    set({ busy: "upload" });
    setTyping(true);
    const baseName = (s.pdf?.name || "資料").replace(/\.pdf$/i, "");
    const course = await A.createDraftCourse(baseName);
    const up = await A.uploadPages(course.id, baseName, use, (n, total) => set({ busy: `upload:${n}/${total}` }));
    const uploaded = up.map((u, k) => ({ page: u.page, materialId: u.materialId, text: use[k].text, notes: s.slides[s.noteSrc[use[k].i]]?.notes || "" }));
    const started = await A.startImport({ courseId: course.id, pages: uploaded, filename: s.pdf?.name || "", planOnly: true, exerciseCount: 0 });
    set({ courseId: course.id, importId: started.importId, uploaded, busy: "plan" });
    writeSaved({ flow: "course", courseId: course.id, importId: started.importId, uploaded });
    const st = await A.waitImport(started.importId, ["planned"]);
    set({ busy: "", plan: st.plan, step: 2 });
    setTyping(false);
    await ai(`内容から、**${st.plan.lessons.length}つのレッスン**に分けました。各スライドの説明はノートをもとに書きます。\nレッスンの分け方を変えたいときは、言葉で指示してください。`,
      [["この構成でいい", "toExercise", true], ...(st.plan.lessons.length > 1 ? [["レッスン1と2をまとめて", "say"]] : [])], 200);
    await drainPending();
  }
  async function doReplan(instruction) {
    const s = sref.current;
    set({ busy: "replan" }); setTyping(true);
    try {
      const r = await A.replan(s.importId, { lessons: s.plan.lessons, instruction });
      set({ busy: "", plan: { ...s.plan, lessons: r.lessons } });
      setTyping(false);
      await ai(`${r.reply || "直しました。"}\n**${r.lessons.length}つのレッスン**です。`, [["この構成でいい", "toExercise", true]], 0);
      await drainPending();
    } catch (e) { await fail(e, [["この構成でいい", "toExercise", true]]); }
  }

  /* ---------- コース：演習 ---------- */
  async function toExercise() {
    const s = sref.current;
    set({ busy: "generate:0" }); setTyping(true);
    await A.continueImport(s.importId, { lessons: s.plan.lessons, pages: s.uploaded, exerciseCount: 0 });
    await A.waitImport(s.importId, ["done"], st => set({ busy: `generate:${st.lessonsDone || 0}/${st.lessonsTotal || s.plan.lessons.length}` }));
    await loadLessons(s.courseId);
    writeSaved({ flow: "course", courseId: s.courseId, importId: s.importId, uploaded: s.uploaded, generated: true });
    set({ busy: "", step: 3 });
    setTyping(false);
    await exerciseIntro("スライドの説明を書きました。\n次に、**演習を入れたい場所と内容**を指示してください。どのページの後に入るかを見せてから入れます。");
  }
  async function exerciseIntro(body) {
    const s = sref.current;
    const titles = (s.lessons || []).flatMap(l => l.slides.filter(x => x.kind === "image").map(x => x.title)).filter(t => t && t.length <= 14);
    const sample = titles[Math.floor(titles.length * 0.6)] || "";
    await ai(`${body}
レッスンの分け方を直したいときも、言葉で指示してください。`, [...(sample ? [[`${sample}のところにコード演習を入れて`, "say", true]] : []), ["各レッスンの最後に確認クイズを1問ずつ", "say"], ["演習はこれで十分", "toPublish"]], 0);
    await drainPending();
  }
  // 作ったあとのレッスンの分け方を直す。スライドはそのまま、どのレッスンに入れるかと名前だけを変える
  async function doRestructure(instruction) {
    const s = sref.current;
    set({ busy: "restructure" }); setTyping(true);
    try {
      const r = await A.restructure({ instruction, lessons: s.lessons.map(l => ({ lessonId: l.id, title: l.title, slides: l.slides.map(x => ({ id: x.id, title: x.title, page: x.content?.sourcePage })) })) });
      const slideById = new Map(s.lessons.flatMap(l => l.slides.map(x => [x.id, x])));
      const ownerOf = new Map(s.lessons.flatMap(l => l.slides.map(x => [x.id, l])));
      const used = new Set();
      const next = [];
      for (let i = 0; i < r.lessons.length; i += 1) {
        const g = r.lessons[i];
        const slides = g.slideIds.map(id => slideById.get(id)).filter(Boolean).map((x, k) => ({ ...x, order: k }));
        // いちばん多くのスライドを持っていた元のレッスンを使い回す（無ければ新しく作る）
        const counts = new Map();
        g.slideIds.forEach(id => { const o = ownerOf.get(id); if (o && !used.has(o.id)) counts.set(o, (counts.get(o) || 0) + 1); });
        const base = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (base) {
          used.add(base.id);
          const l = { ...base, title: g.title, slides, order: i };
          await A.saveLesson(s.courseId, l);
          next.push(l);
        } else {
          const res = await A.createLesson(s.courseId, { title: g.title, type: s.lessons[0]?.type, slides, order: i });
          next.push(normLesson(res.lesson || {}, i));
        }
      }
      for (const l of s.lessons) if (!used.has(l.id)) await A.deleteLesson(s.courseId, l.id);
      set({ busy: "", lessons: next, proposal: null });
      setTyping(false);
      await ai(`${r.reply || "直しました。"}
**${next.length}つのレッスン**です。`, [["演習はこれで十分", "toPublish", true]], 0);
      await drainPending();
    } catch (e) { await fail(e); }
  }
  async function loadLessons(courseId) {
    const [items, courses] = await Promise.all([A.getLessons(courseId), A.listCourses()]);
    const lessons = (Array.isArray(items) ? items : []).map(normLesson).filter(l => l.id && l.deleted !== true && l.status !== "deleted").sort((a, b) => a.order - b.order);
    const course = (courses || []).find(c => c.id === courseId) || null;
    set({ lessons, course, topic: course?.topic || sref.current.topic || "", level: course?.level || "入門" });
    return lessons;
  }
  async function doExercise(instruction) {
    const s = sref.current;
    set({ busy: "exercise", proposal: null, retrying: false, lastInstruction: instruction }); setTyping(true);
    try {
      const r = await A.studioJob({
        kind: "exercise", courseTitle: s.course?.title || "", instruction,
        lessons: s.lessons.map(l => ({ lessonId: l.id, title: l.title, summary: l.summary, goal: l.goal, slides: l.slides.map(x => ({ id: x.id, kind: x.kind, title: x.title, page: x.content?.sourcePage })) })),
      });
      const proposals = r.proposals || [];
      set({ busy: "", proposal: proposals });
      setTyping(false);
      if (proposals.length === 1) {
        const p = proposals[0], ex = p.slides[0];
        const expect = ex.kind === "code_run" ? ex.content?.expect : "";
        await ai(`**${p.afterPage ? `p.${p.afterPage}` : p.lessonTitle}「${p.afterTitle}」の後**に、${exLabel(ex)}を1つ挟みます。${expect ? `\nお手本を実際に動かして、正解の出力は「${expect.split("\n").slice(0, 3).join(" / ").slice(0, 48)}${expect.split("\n").length > 3 ? " …" : ""}」にしました。` : ""}`, [], 0);
      } else {
        await ai(`**${proposals.length}か所**に入れる案です。`, [], 0);
      }
    } catch (e) { await fail(e); }
  }
  async function acceptProposal() {
    const s = sref.current;
    if (!s.proposal?.length) return;
    set({ busy: "save" });
    const lessons = s.lessons.map(l => ({ ...l, slides: [...l.slides] }));
    const added = [];
    for (const p of s.proposal) {
      const l = lessons.find(x => x.id === p.lessonId);
      if (!l) continue;
      const at = l.slides.findIndex(x => x.id === p.afterSlideId);
      const fresh = p.slides.map(x => ({ ...x, id: newId("slide-ai"), status: "published" }));
      l.slides.splice(at < 0 ? l.slides.length : at + 1, 0, ...fresh);
      l.slides = l.slides.map((x, i) => ({ ...x, order: i }));
      added.push(...fresh.map(x => x.id));
      l.dirty = true;
    }
    for (const l of lessons.filter(x => x.dirty)) { await A.saveLesson(s.courseId, l); delete l.dirty; }
    const one = s.proposal.length === 1 ? s.proposal[0] : null;
    set({ busy: "", lessons, proposal: null, inserted: [...s.inserted, ...added], justInserted: added[0] || null });
    await ai(one ? `${one.afterPage ? `p.${one.afterPage}` : `「${one.afterTitle}」`} の後に入れました。ほかにも入れますか？` : `${added.length}つ入れました。`,
      [["各レッスンの最後に確認クイズを1問ずつ", "say"], ["演習はこれで十分", "toPublish", true]], 0);
  }

  /* ---------- コース：公開 ---------- */
  async function toPublish() {
    const s = sref.current;
    set({ busy: "check", proposal: null, step: 4 });
    const qs = await A.finalQuestions().catch(() => null);
    const finalCount = Array.isArray(qs) ? qs.filter(q => q.courseId === s.courseId && q.type === "final" && q.deleted !== true).length : null;
    set({ busy: "", finalCount });
    const issues = publishIssues(sref.current);
    await ai(`公開の前に確かめました。${issues.length ? `直すとよいところがあります：${issues.join("、")}。` : "問題はありません。"}**受講生として見る**で、実際の画面を確かめられます。`,
      [["公開する", "publish", true], ...(finalCount === 0 ? [["総合テストを作る", "finalTest"]] : [])]);
  }
  function publishIssues(s) {
    const imgs = (s.lessons || []).flatMap(l => l.slides.filter(x => x.kind === "image"));
    const out = [];
    if (imgs.some(x => !String(x.caption || x.content?.caption || "").trim())) out.push(`説明の無いスライドが${imgs.filter(x => !String(x.caption || x.content?.caption || "").trim()).length}枚`);
    if (!s.topic) out.push("単元が未設定");
    if (s.finalCount === 0) out.push("総合テストが無い");
    return out;
  }
  async function makeFinalTest() {
    const s = sref.current;
    set({ busy: "final" }); setTyping(true);
    try {
      const r = await A.finalTestJob({ courseTitle: s.course?.title || "", questionCountHint: 10, lessons: s.lessons.map(l => ({ lessonRef: l.id, title: l.title, summary: l.summary || "", goal: l.goal || "" })) });
      let saved = 0;
      for (const q of r.questions || []) {
        const lessonId = s.lessons.some(l => l.id === q.lessonRef) ? q.lessonRef : s.lessons[0]?.id;
        try { await A.saveQuestion({ courseId: s.courseId, lessonId, type: "final", question: q.question, choices: q.choices, answer: q.answerIndex, explanation: q.explanation || "", published: true }); saved += 1; } catch (e) { /* 1問の失敗で止めない */ }
      }
      set({ busy: "", finalCount: (s.finalCount || 0) + saved });
      setTyping(false);
      await ai(saved ? `総合テストを**${saved}問**作りました。` : "総合テストを作れませんでした。もう一度お試しください。", [["公開する", "publish", true]], 0);
    } catch (e) { await fail(e, [["公開する", "publish", true]]); }
  }
  async function publishCourseNow() {
    const s = sref.current;
    if (!s.topic) { await ai("右の画面で単元を選んでから公開してください。"); return; }
    set({ busy: "publish" });
    const courses = await A.listCourses();
    const course = (courses || []).find(c => c.id === s.courseId);
    if (!course) throw new Error("コースが見つかりませんでした。");
    await A.saveCourse({ ...course, topic: s.topic, level: s.level, lessons: s.lessons.length });
    await A.publishCourse(s.courseId);
    writeSaved(null);
    set({ busy: "", published: true, step: 5 });
    const tname = topics.find(t => t.id === s.topic)?.name || "その他";
    await ai(`公開しました。コース一覧の「${tname}」の単元に出ています。`, [["もう1つ作る", "restart"]], 0);
  }

  /* ---------- 作りかけ・既存のコース ---------- */
  async function resume() {
    const saved = readSaved();
    if (!saved?.importId) { restart(); return; }
    set({ ...EMPTY, flow: "course", courseId: saved.courseId, importId: saved.importId, uploaded: saved.uploaded || [], busy: "resume" });
    setTyping(true);
    const st = await A.getImport(saved.importId).catch(() => null);
    setTyping(false);
    if (!st) { set({ busy: "" }); await ai("作りかけのコースが見つかりませんでした。最初から作ります。", [["最初から", "restart", true]]); return; }
    if (st.status === "planned") {
      set({ busy: "", plan: st.plan, step: 2 });
      await ai(`構成の確認の途中です。**${st.plan.lessons.length}つのレッスン**に分けています。`, [["この構成でいい", "toExercise", true]], 0);
      return;
    }
    if (st.status === "planning" || st.status === "queued" || st.status === "generating") {
      set({ busy: st.status === "generating" ? "generate:0" : "plan" }); setTyping(true);
      if (st.status === "generating") {
        await A.waitImport(saved.importId, ["done"], x => set({ busy: `generate:${x.lessonsDone || 0}/${x.lessonsTotal || 0}` }));
      } else {
        const p = await A.waitImport(saved.importId, ["planned"]);
        set({ busy: "", plan: p.plan, step: 2 }); setTyping(false);
        await ai(`内容から、**${p.plan.lessons.length}つのレッスン**に分けました。`, [["この構成でいい", "toExercise", true]], 0);
        return;
      }
    }
    await loadLessons(saved.courseId);
    set({ busy: "", step: 3 }); setTyping(false);
    await exerciseIntro("スライドの説明ができています。**演習を入れたい場所と内容**を指示してください。");
  }
  async function openCourse(courseId) {
    set({ ...EMPTY, flow: "course", courseId, step: 3, busy: "load" });
    try {
      const lessons = await loadLessons(courseId);
      set({ busy: "" });
      if (!lessons.length) { await ai("このコースにはまだレッスンがありません。パワポから作る場合は「最初から」を押してください。", [["最初から", "restart", true]], 0); return; }
      await exerciseIntro(`「${sref.current.course?.title || "コース"}」を開きました。**演習を入れたい場所と内容**を指示してください。`);
    } catch (e) { await fail(e, [["最初から", "restart", true]]); }
  }

  /* ---------- 演習・案件体験 ---------- */
  // auto：お手本でテストが通らなかったときに、1回だけAIに直してもらう
  async function doDraft(instruction, prev, auto = false) {
    const s = sref.current;
    const kind = s.flow;
    set({ busy: "draft", retrying: false }); setTyping(true);
    try {
      const r = await A.studioJob({
        kind, instruction, prev: prev || undefined,
        topics: topics.map(t => ({ id: t.id, name: t.name })),
        courses: (lrn.catalog || []).map(c => ({ id: c.id, title: c.title })),
      });
      const draft = kind === "drill" ? r.drill : r.case;
      set({ draft, step: 1, check: null });
      const check = await verifyDraft(draft);
      if (check && !check.ok && !auto) {
        const names = draft.tests.filter((_, i) => !check.results[i]?.ok).map(t => `「${t.name}」`).join("");
        set({ check });
        setTyping(false);
        await ai("お手本で通らないテストがあったので、AIに直してもらっています…", [], 0);
        await doDraft(`お手本（answerCode）で、次のテストが通りませんでした：${names}${check.error ? `（エラー：${check.error}）` : ""}。テストかお手本を直して、すべて通るようにしてください。`, draft, true);
        return;
      }
      set({ busy: "", check });
      setTyping(false);
      const ok = check && check.ok;
      const tested = check ? (ok ? `お手本を動かして、テストが${check.total === 2 ? "2つとも" : `${check.total}つすべて`}通ることを確かめました。` : `お手本で通らないテストがあります（${check.passed}/${check.total}）。「直して」と伝えてください。`) : "";
      if (kind === "drill") {
        await ai(`${r.reply ? `${r.reply}\n` : ""}${tested}${ok ? "\nヒントと「何回か実行したらお手本」も付けています。" : ""}`, [["公開する", "publishDraft", true], ["もう少し難しく", "say"]], 0);
      } else {
        const need = (lrn.catalog || []).find(c => c.id === draft.needCourseId)?.title;
        await ai(`${r.reply ? `${r.reply}\n` : ""}チケットと受け入れ条件を作りました。受け入れ条件はそのままテストになります。${tested ? `\n${tested}` : ""}${need ? `\n挑戦できるのは「${need}」を修了した人にしています。` : ""}`, [["公開する", "publishDraft", true], ["条件を1つ足して", "say"]], 0);
      }
    } catch (e) { await fail(e); }
  }
  async function verifyDraft(d) {
    if (!d || !d.answerCode || d.runtime === "aws" || d.runtime === "check") return null;
    try {
      const r = await runCode(d.runtime, d.answerCode, d.tests, { frame: frame.current, sqlSetup: d.sqlSetup });
      const results = r?.results || [];
      const passed = results.filter(x => x.ok).length;
      return { ok: !r?.error && results.length > 0 && passed === results.length, passed, total: d.tests.length, results, error: r?.error || "" };
    } catch (e) { return { ok: false, passed: 0, total: d.tests.length, results: [], error: e?.message || "" }; }
  }
  async function publishDraft() {
    const s = sref.current;
    if (!s.draft) return;
    const kind = s.flow === "drill" ? "drills" : "cases";
    set({ busy: "publish" });
    const id = itemId(s.flow === "drill" ? "d" : "c");
    const body = s.flow === "drill" ? { drill: { ...s.draft, id } } : { case: { ...s.draft, id } };
    try {
      await manage.save(kind, id, body);
      await manage.publish(kind, id);
      set({ busy: "", published: true, step: 2 });
      await ai("公開しました。", [["もう1つ作る", "restart"]], 0);
    } catch (e) {
      const issues = e?.data?.issues;
      await fail(Array.isArray(issues) && issues.length ? { message: `公開できない箇所があります：${issues.join("、")}。「直して」と伝えてください。` } : e);
    }
  }

  /* ---------- 右側 ---------- */
  const s = st;
  const busyText = s.busy.startsWith("read:") ? `ページを読み取っています（${s.busy.slice(5)}）`
    : s.busy.startsWith("upload:") ? `ページを準備しています（${s.busy.slice(7)}）`
      : s.busy === "plan" ? "内容を読んで、レッスンに分けています…"
        : s.busy.startsWith("generate:") ? `スライドの説明を書いています（レッスン ${s.busy.slice(9)}）`
          : { exercise: "演習を作っています…", restructure: "レッスンの分け方を直しています…", draft: "案を作っています…", final: "総合テストを作っています…", replan: "構成を直しています…", publish: "公開しています…", save: "入れています…" }[s.busy] || "";

  return (
    <div className="tl-studio">
      <header className="bar"><div className="in">
        <a className="logo" href="#/manage" style={{ textDecoration: "none", color: "inherit" }}>テノ<b>ラボ</b></a>
        <span className="crumb">教材づくり</span>
        <span className="me"><a href="#/manage/courses" style={{ color: "inherit" }}>管理の画面</a>　管理者　<button className="btn ghost sm" type="button" onClick={restart}>最初から</button></span>
      </div></header>
      <div className="studio">
        <section className="chat" aria-label="AIとの会話">
          <div className="log" ref={logRef} aria-live="polite">
            {msgs.map(m => (
              <React.Fragment key={m.id}>
                <div className={`msg ${m.who === "me" ? "me" : ""}`}>
                  {m.who === "me" ? <div className="b">{m.body}</div> : <><div className="who">テ</div><div className="b">{rich(m.body)}</div></>}
                </div>
                {m.quick?.length > 0 && (
                  <div className="quick">{m.quick.map(([label, act, pri]) => <button key={label} type="button" className={pri ? "pri" : ""} disabled={m.used || !!s.busy} onClick={() => onQuick(m.id, label, act)}>{label}</button>)}</div>
                )}
              </React.Fragment>
            ))}
            {typing && <div className="msg"><div className="who">テ</div><div className="b typing"><i /><i /><i /></div></div>}
          </div>
          <form className="compose" onSubmit={onSend}>
            <textarea id="studio-say" rows={1} value={text} placeholder="AIに指示する" aria-label="AIへの指示" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(e); } }} />
            <button className="btn" type="submit">送る</button>
          </form>
        </section>
        <main className="work" aria-label="作っている教材">
          {!s.flow ? <Pick onPick={k => { say("me", { course: "コース", drill: "演習", case: "案件体験" }[k]); run(k); }} />
            : <>
              <Steps flow={s.flow} step={s.step} />
              {busyText && <div className="fixbar" role="status"><span className="spin" aria-hidden="true" />{busyText}</div>}
              {s.flow === "course" && <CourseWork s={s} thumbs={thumbs} bump={bump} topics={topics} pptxIn={pptxIn} pdfIn={pdfIn} pickFile={pickFile} moveNote={moveNote} toggleSkip={toggleSkip} applyShift={() => { say("me", "ずれを直す"); applyShift(); }} act={(a, label) => { say("me", label); run(a); }} setTopic={v => set({ topic: v })} setLevel={v => set({ level: v })} />}
              {s.flow !== "course" && <DraftWork s={s} kind={s.flow} topics={topics} courses={lrn.catalog || []} act={(a, label) => { say("me", label); run(a); }} />}
            </>}
          <iframe ref={frame} title="確かめ用" sandbox="allow-same-origin" style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", border: 0 }} aria-hidden="true" tabIndex={-1} />
        </main>
      </div>
    </div>
  );
}

function Pick({ onPick }) {
  return (
    <div className="empty"><span className="big">何を<span className="mark">作りますか</span>？</span>
      <div className="pick">
        <button type="button" onClick={() => onPick("course")}><b>コース</b><span>パワポとPDFから</span></button>
        <button type="button" onClick={() => onPick("drill")}><b>演習</b><span>5〜10分の1問</span></button>
        <button type="button" onClick={() => onPick("case")}><b>案件体験</b><span>チケットと受け入れ条件</span></button>
      </div>
    </div>
  );
}

function Steps({ flow, step }) {
  return <div className="steps">{(STEPS[flow] || []).map((x, i) => <span key={x} className={i < step ? "done" : i === step ? "now" : ""}><i>{i < step ? "✓" : i + 1}</i>{x}</span>)}</div>;
}

// ページの絵。手元で作った画像があればそれ、無ければ教材から署名つきURLを取って出す
function Page({ src, materialId, title, thumbs, bump, cover }) {
  const cached = materialId ? thumbs.current.get(materialId) : null;
  useEffect(() => {
    if (src || !materialId || thumbs.current.has(materialId)) return;
    thumbs.current.set(materialId, "");
    A.viewUrl(materialId).then(r => { thumbs.current.set(materialId, r.url); bump(n => n + 1); }).catch(() => {});
  }, [src, materialId]); // eslint-disable-line react-hooks/exhaustive-deps
  const url = src || cached;
  if (url) return <div className="slide img"><img src={url} alt={title || ""} loading="lazy" /></div>;
  return <div className={`slide ${cover ? "cover" : ""}`}><span className="t">{title || ""}</span><span className="l" style={{ width: "90%" }} /><span className="l" style={{ width: "76%" }} /></div>;
}

function CourseWork({ s, thumbs, bump, topics, pptxIn, pdfIn, pickFile, moveNote, toggleSkip, applyShift, act, setTopic, setLevel }) {
  const pageUrl = n => s.pages.find(p => p.page === n)?.url;
  const matOf = n => s.uploaded.find(u => u.page === n)?.materialId;
  if (s.step === 0) {
    const drop = (kind, e) => { e.preventDefault(); pickFile(kind, e.dataTransfer.files?.[0]); };
    return (
      <section className="panel"><div className="ph"><h2>資料</h2></div>
        <div className="drops">
          <button type="button" className={`drop ${s.pptx ? "has" : ""}`} onClick={() => pptxIn.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => drop("pptx", e)}>
            <span className="fi" style={{ background: "#D24726" }}>PPTX</span><b>{s.pptx ? s.pptx.name : "パワポ（.pptx）"}</b><small>{s.pptx ? "受け取りました" : "発表者ノートを説明に使います"}</small>
          </button>
          <button type="button" className={`drop ${s.pdf ? "has" : ""}`} onClick={() => pdfIn.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => drop("pdf", e)}>
            <span className="fi" style={{ background: "#B30B00" }}>PDF</span><b>{s.pdf ? s.pdf.name : "書き出したPDF"}</b><small>{s.pdf ? "受け取りました" : "PowerPointの「PDFとして保存」"}</small>
          </button>
        </div>
        <input ref={pptxIn} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden onChange={e => { pickFile("pptx", e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={pdfIn} type="file" accept=".pdf,application/pdf" hidden onChange={e => { pickFile("pdf", e.target.files?.[0]); e.target.value = ""; }} />
      </section>
    );
  }
  if (s.step === 1) {
    const status = rowStatus(s.pages, s.slides, s.noteSrc);
    const sug = s.slides.length ? shiftSuggestion(s.pages, s.slides, s.noteSrc, status) : null;
    const bad = status.filter(x => x === "off").length;
    return (
      <section className="panel">
        <div className="ph"><h2>ページとノート</h2>{s.slides.length ? (bad ? <span className="chip warn">{bad}ページ ずれているかも</span> : <span className="chip ok">✓ そろっています</span>) : <span className="chip">ノートなし</span>}</div>
        {sug && <div className="fixbar"><span><b>p.{s.pages[sug.from].page} 以降のノートが{sug.delta < 0 ? "1つ前" : "1つ後ろ"}にずれています</b></span><button className="btn sm" type="button" onClick={applyShift}>p.{s.pages[sug.from].page} 以降を{sug.delta < 0 ? "1つ後ろへ" : "1つ前へ"}</button></div>}
        <div className="align">
          {s.pages.map((p, i) => {
            const n = s.slides[s.noteSrc[i]]?.notes || "";
            const off = status[i] === "off", skip = s.skip[i];
            return (
              <div key={p.page} className={`arow ${off ? "bad" : ""} ${skip ? "skip" : ""}`}>
                <span className="pn">p.{p.page}</span>
                <Page src={p.url} title={p.text.slice(0, 20)} thumbs={thumbs} bump={bump} />
                <div className="note"><span className="who">ノート</span>{n ? n.slice(0, 160) + (n.length > 160 ? "…" : "") : <span style={{ color: "var(--muted)" }}>（ノートなし）</span>}</div>
                <div className="st">
                  <button type="button" className={`chip ${skip ? "" : off ? "warn" : "ok"}`} onClick={() => toggleSkip(i)} aria-label={`p.${p.page}を${skip ? "使う" : "使わない"}にする`}>{skip ? "使わない" : off ? "内容が合わない" : "✓"}</button>
                  {s.slides.length > 0 && <div className="shift"><button type="button" aria-label="ノートを上へ" onClick={() => moveNote(i, -1)}>↑</button><button type="button" aria-label="ノートを下へ" onClick={() => moveNote(i, 1)}>↓</button></div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }
  if (s.step === 2 && s.plan) {
    const total = s.plan.lessons.reduce((a, l) => a + l.pages.length, 0);
    return (
      <section className="panel">
        <div className="ph"><h2>レッスンの構成</h2><span className="r"><span className="chip">レッスン {s.plan.lessons.length}</span><span className="chip">スライド {total}</span><span className="chip">演習 0</span></span></div>
        <div className="lessons">{s.plan.lessons.map((L, li) => (
          <div className="les" key={li}><div className="hd"><span className="eyebrow">LESSON {li + 1}</span><b>{L.title}</b><span className="chip">p.{L.pages[0]}〜{L.pages[L.pages.length - 1]}</span></div>
            <div className="strip">{L.pages.map(n => <div className="s" key={n}><Page src={pageUrl(n)} materialId={matOf(n)} title={(s.plan.digest || []).find(d => d.page === n)?.heading || `p.${n}`} thumbs={thumbs} bump={bump} /><small>p.{n}</small></div>)}</div>
          </div>
        ))}</div>
      </section>
    );
  }
  if (s.step === 3 && s.lessons) {
    const proposals = s.proposal || [];
    const exCount = s.lessons.reduce((a, l) => a + l.slides.filter(isExercise).length, 0);
    return (
      <>
        {proposals.length > 0 && <Proposal proposals={proposals} act={act} />}
        <section className="panel">
          <div className="ph"><h2>演習を入れる</h2><span className="r"><span className="chip">レッスン {s.lessons.length}</span><span className="chip">スライド {s.lessons.reduce((a, l) => a + l.slides.filter(x => x.kind === "image").length, 0)}</span><span className={`chip ${exCount ? "ok" : ""}`}>演習 {exCount}</span></span></div>
          <div className="lessons">{s.lessons.map((L, li) => (
            <div className="les" key={L.id}><div className="hd"><span className="eyebrow">LESSON {li + 1}</span><b>{L.title}</b><span className="chip">{L.slides.length}枚</span></div>
              <div className="strip">{L.slides.map(x => (
                <React.Fragment key={x.id}>
                  {x.kind === "image" ? <div className="s"><Page materialId={x.content?.materialId} title={x.title} thumbs={thumbs} bump={bump} /><small>{x.content?.sourcePage ? `p.${x.content.sourcePage}` : ""}</small></div>
                    : x.kind === "summary" ? <div className="ex">まとめ</div>
                      : isExercise(x) ? <div className={`ex ${x.kind === "code_run" || x.kind === "web_run" ? "code" : ""} ${s.justInserted === x.id || s.inserted.includes(x.id) ? "new" : ""}`}>{x.kind === "code_run" || x.kind === "web_run" ? "▶ " : ""}{exLabel(x)}<br />{String(x.title || "").slice(0, 12)}</div>
                        : <div className="ex">{String(x.title || "").slice(0, 12)}</div>}
                  {proposals.some(p => p.afterSlideId === x.id) && <div className="ins">ここに入る</div>}
                </React.Fragment>
              ))}</div>
            </div>
          ))}</div>
        </section>
      </>
    );
  }
  if (s.step >= 4 && s.lessons) {
    const imgs = s.lessons.flatMap(l => l.slides.filter(x => x.kind === "image"));
    const exs = s.lessons.flatMap(l => l.slides.filter(isExercise));
    const codes = exs.filter(x => x.kind === "code_run");
    const noCap = imgs.filter(x => !String(x.caption || x.content?.caption || "").trim()).length;
    return (
      <section className="panel">
        <div className="ph"><h2>公開の前に</h2><span className="r">
          <button className="btn ghost" type="button" onClick={() => act("preview", "受講生として見る")}>受講生として見る</button>
          <button className="btn" type="button" disabled={s.published || !!s.busy} onClick={() => act("publish", "公開する")}>{s.published ? "公開しました ✓" : "公開する"}</button>
        </span></div>
        <div className="facts"><div><small>レッスン</small><b>{s.lessons.length}</b></div><div><small>スライド</small><b>{imgs.length}</b></div><div><small>演習</small><b>{exs.length}</b></div><div><small>総合テスト</small><b>{s.finalCount ?? "—"}<span style={{ fontSize: 13 }}>問</span></b></div></div>
        <ul className="checks">
          {s.slides.length > 0 && <li><i>✓</i>ページとノートがそろっている</li>}
          <li><i className={noCap ? "warn" : ""}>{noCap ? "!" : "✓"}</i>{noCap ? `説明の無いスライドが${noCap}枚あります` : "すべてのスライドに説明がある"}</li>
          {codes.length > 0 && <li><i>✓</i>コード演習のお手本が動いた（{codes.length}つ）</li>}
          <li><i className={s.topic ? "" : "warn"}>{s.topic ? "✓" : "!"}</i>
            <label>単元：<select id="studio-topic" value={s.topic} onChange={e => setTopic(e.target.value)}><option value="">選んでください</option>{topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label> ・ 難易度：<select id="studio-level" value={s.level} onChange={e => setLevel(e.target.value)}>{LEVELS.map(l => <option key={l}>{l}</option>)}</select></label>
          </li>
          <li><i className={s.finalCount ? "" : "warn"}>{s.finalCount ? "✓" : "!"}</i>{s.finalCount ? `総合テスト ${s.finalCount}問` : <>総合テストがまだありません <button className="btn ghost sm" type="button" disabled={!!s.busy} onClick={() => act("finalTest", "総合テストを作る")}>総合テストを作る</button></>}</li>
        </ul>
      </section>
    );
  }
  return null;
}

function Proposal({ proposals, act }) {
  if (proposals.length > 1) {
    return (
      <section className="prop"><div className="top"><span className="chip warn">AIの案</span><b>{proposals.length}か所に{exLabel(proposals[0].slides[0])}</b></div><div className="body">
        <div className="qlist">{proposals.map((p, i) => <div key={i}><span>{p.afterPage ? `p.${p.afterPage}の後` : p.lessonTitle.slice(0, 8)}</span>{p.slides[0]?.interaction?.question || p.slides[0]?.content?.question || p.slides[0]?.title}</div>)}</div>
        <div className="acts"><button className="btn" type="button" onClick={() => act("accept", "入れる")}>入れる</button><button className="btn ghost" type="button" onClick={() => act("retry", "直して")}>直して</button><button className="btn ghost" type="button" onClick={() => act("drop", "やめる")}>やめる</button></div>
      </div></section>
    );
  }
  const p = proposals[0], x = p.slides[0] || {}, c = x.content || {};
  return (
    <section className="prop"><div className="top"><span className="chip warn">AIの案</span><b>{p.afterPage ? `p.${p.afterPage}` : ""}「{p.afterTitle}」の後に{exLabel(x)}</b>{x.kind === "code_run" && <span className="chip ok">✓ お手本が動いた</span>}</div><div className="body">
      {(c.task || x.caption) && <p style={{ fontSize: 14, color: "var(--ink2)" }}>{c.task || x.caption}</p>}
      {x.kind === "code_run" && <div className="ed"><div className="tabs"><span>{c.filename || "Main.java"}</span><span>はじめのコード</span></div><pre>{c.source}</pre><div className="res">✓ お手本の出力：{String(c.expect || "").split("\n").slice(0, 4).join(" / ")}{String(c.expect || "").split("\n").length > 4 ? " …" : ""}</div></div>}
      {x.kind === "web_run" && <>
        <div className="ed"><div className="tabs"><span>index.html</span><span>はじめのコード</span></div><pre>{c.html}{c.css ? `\n\n<style>\n${c.css}\n</style>` : ""}</pre></div>
        <div className="qlist">{(c.checks || []).map((k, i) => <div key={i}><span>確かめる</span>{k.label}</div>)}</div>
      </>}
      {!EX_LABEL[x.kind] && (() => { const q = x.interaction || {}; const choices = q.choices || c.choices; return <div className="qlist"><div><span>問題</span>{q.question || c.question || c.prompt || x.title}</div>{Array.isArray(choices) && choices.map((ch, i) => <div key={i}><span>{i === q.answerIndex ? "✓ 正解" : i + 1}</span>{typeof ch === "string" ? ch : ch?.text || ""}</div>)}</div>; })()}
      <div className="acts"><button className="btn" type="button" onClick={() => act("accept", "入れる")}>入れる</button><button className="btn ghost" type="button" onClick={() => act("retry", "直して")}>直して</button><button className="btn ghost" type="button" onClick={() => act("drop", "やめる")}>やめる</button></div>
    </div></section>
  );
}

function DraftWork({ s, kind, topics, courses, act }) {
  if (s.step === 0 || !s.draft) return <section className="panel"><div className="empty" style={{ padding: 30 }}>{kind === "drill" ? "左で、作りたい演習を教えてください" : "左で、題材にしたい案件を教えてください"}</div></section>;
  const d = s.draft, check = s.check;
  const topicName = topics.find(t => t.id === d.topic)?.name;
  const results = check?.results || [];
  const okChip = check ? <span className={`chip ${check.ok ? "ok" : "ng"}`}>{check.ok ? "✓ お手本でテストが通った" : `✕ お手本で通らないテストがあります（${check.passed}/${check.total}）`}</span> : null;
  const acts = <div className="acts"><button className="btn" type="button" disabled={s.published || !!s.busy} onClick={() => act("publishDraft", "公開する")}>{s.published ? "公開しました ✓" : "公開する"}</button>{!s.published && <button className="btn ghost" type="button" disabled={!!s.busy} onClick={() => act("retryDraft", "直して")}>直して</button>}</div>;
  if (kind === "drill") {
    return (
      <section className="prop"><div className="top"><span className="chip warn">AIの案</span><b>{d.title}</b><span className="chip">{RUNTIME_NAME[d.runtime] || d.runtime}</span><span className="chip">{d.level} ・ 約{d.minutes}分</span>{topicName && topicName !== RUNTIME_NAME[d.runtime] && <span className="chip">{topicName}</span>}{okChip}</div><div className="body">
        <p style={{ fontSize: 14, color: "var(--ink2)" }}>{d.task}</p>
        <div className="ed"><div className="tabs"><span>{FILE_NAME[d.runtime] || "main"}</span><span>はじめのコード</span></div><pre>{d.starterCode}</pre>
          {d.tests.length > 0 && <div className="res">{d.tests.map((t, i) => `${results[i] ? (results[i].ok ? "✓" : "✕") : "・"} ${t.name}`).join("　")}</div>}</div>
        {d.hint && <div className="note"><span className="who">ヒント</span>{d.hint}</div>}
        {acts}
      </div></section>
    );
  }
  const need = courses.find(c => c.id === d.needCourseId)?.title;
  return (
    <section className="prop"><div className="top"><span className="chip warn">AIの案</span><b>{d.title}</b><span className="chip">{topicName || RUNTIME_NAME[d.runtime]} ・ 目安{d.hours}時間</span>{need && <span className="chip">{need}の修了後</span>}{okChip}</div><div className="body">
      <div className="note"><span className="who">チケット {d.ticket?.id}</span>{d.ticket?.background}</div>
      {(d.ticket?.scope || []).length > 0 && <div className="qlist">{d.ticket.scope.map((x, i) => <div key={`s${i}`}><span>作業</span>{x}</div>)}</div>}
      <div className="qlist">{d.tests.map((t, i) => <div key={`t${i}`}><span>受け入れ</span>{results[i] ? (results[i].ok ? "✓ " : "✕ ") : ""}{t.name}</div>)}</div>
      {(d.rubric || []).length > 0 && <div className="qlist">{d.rubric.map((r, i) => <div key={`r${i}`}><span>{r.must ? "採点・必須" : "採点"}</span>{r.text}</div>)}</div>}
      {acts}
    </div></section>
  );
}
