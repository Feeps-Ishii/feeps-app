import React, { useEffect, useMemo, useRef } from "react";
import { GoArrow, Ic, TopicIcon, OTHER_TOPIC, planLabel, rowLink } from "../ui.jsx";
import "./drillList.css";
import { DrillsBand } from "../steps/Bands.jsx";
import { NextStep } from "../steps/Steps.jsx";

/* 演習一覧（2026-11-19、モック docs/design/mockups/tenolab-2026-09/tenolab-drills.html）
   単元別：次にやる（3問）＋ 単元ごとの進み → 単元を開くとレッスン順の道のり。
   一覧：単元・状態・レベルで絞って行で並べる。AWS の実習はここに出さない（「AWS実習」の画面へ）。
   view（App が覚える）：{ screen: "home" | "topic" | "list", topic, q, st, lv, sort, hide, lesson } */

const LV = { "やさしい": 1, "ふつう": 2, "むずかしい": 3, "基礎": 1, "応用": 2, "運用": 3 };
const LEVELS = ["やさしい", "ふつう", "むずかしい", "基礎", "応用", "運用"];
const SORTS = [["rec", "おすすめ順"], ["lesson", "レッスン順"], ["short", "短い順"], ["easy", "やさしい順"]];
const NONE_STAGE = "_none";
const norm = s => String(s ?? "").normalize("NFKC").toLowerCase();
const shortLesson = l => (String(l?.lessonTitle || "").match(/^Lesson\.\S+/) || [l?.lessonTitle || "レッスン"])[0];
const MK_LABEL = { done: "クリア", try: "挑戦中", lock: "利用できません" };

function Mk({ s }) { return <span className={`mk ${s}`} role="img" aria-label={MK_LABEL[s] || "未着手"} />; }
function Lvd({ level }) { return <span className="lvd" aria-hidden="true">{[1, 2, 3].map(n => <i key={n} className={n <= (LV[level] || 0) ? "on" : ""} />)}</span>; }
function Legend() { return <div className="legend"><span><span className="mk done" />クリア</span><span><span className="mk try" />挑戦中</span><span><span className="mk" />未着手</span></div>; }
function ActBtn({ s }) {
  if (s === "lock") return <span className="chip prem">{planLabel()}</span>;
  return <GoArrow />;
}
const ACT_LABEL = { try: "つづきから", done: "もう一度" };

/* 演習・単元・レッスンの並びと、自分の状態をまとめる */
export function useDrillData(ctx) {
  const { drills, topics, progress, lrn } = ctx;
  const ds = useMemo(() => (drills || []).filter(d => d.runtime !== "aws"), [drills]);
  // 紐づいたレッスンの並び順を使うので、まだ読んでいないコースのレッスンを読む
  const courseIds = useMemo(() => [...new Set(ds.flatMap(d => (d.lessons || []).map(l => l.courseId)).filter(Boolean))], [ds]);
  useEffect(() => {
    for (const cid of courseIds) if (lrn?.refreshCourseLessons && !lrn.lessonsForCourse(cid).length) lrn.refreshCourseLessons(cid);
  }, [courseIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => {
    const recOf = id => progress?.drill?.(id);
    const st = d => (d.locked ? "lock" : recOf(d.id)?.status === "cleared" ? "done" : recOf(d.id) ? "try" : "");
    const lessonIndex = {};
    for (const cid of courseIds) (lrn?.lessonsForCourse?.(cid) || []).forEach((l, i) => { lessonIndex[`${cid}/${l.id}`] = i; });
    const courseRank = cid => { const i = (lrn?.catalog || []).findIndex(c => c.id === cid); return i < 0 ? 999 : i; };
    const learned = l => {
      if (!l?.courseId) return "";
      if (lrn?.getLessonsDone?.(l.courseId)?.[l.lessonId]?.completed) return "done";
      return lrn?.progress?.[l.courseId]?.lastLessonId === l.lessonId ? "now" : "";
    };
    const known = new Set((topics || []).map(t => t.id));
    const topicIdOf = d => (known.has(d.topic) ? d.topic : OTHER_TOPIC.id);
    const groups = [...(topics || []), OTHER_TOPIC].map(t => {
      const items = ds.filter(d => topicIdOf(d) === t.id);
      if (!items.length) return null;
      // 段＝紐づいた最初のレッスン。レッスンの無い演習は最後の「そのほか」
      const stages = new Map();
      for (const d of items) {
        const l = (d.lessons || [])[0];
        const key = l?.courseId ? `${l.courseId}/${l.lessonId}` : NONE_STAGE;
        if (!stages.has(key)) stages.set(key, { key, lesson: l?.courseId ? l : null, items: [] });
        stages.get(key).items.push(d);
      }
      const minOrder = s => Math.min(...s.items.map(d => Number(d.order || 0)));
      const list = [...stages.values()].map(s => ({ ...s, items: s.items.sort((a, b) => (a.order - b.order) || String(a.title).localeCompare(String(b.title), "ja")) }));
      list.sort((a, b) => {
        if (a.key === NONE_STAGE || b.key === NONE_STAGE) return (a.key === NONE_STAGE) - (b.key === NONE_STAGE);
        const ra = courseRank(a.lesson.courseId) - courseRank(b.lesson.courseId);
        if (a.lesson.courseId !== b.lesson.courseId && ra) return ra;
        const ia = lessonIndex[a.key], ib = lessonIndex[b.key];
        if (ia != null && ib != null && ia !== ib) return ia - ib;
        return minOrder(a) - minOrder(b);
      });
      const ordered = list.flatMap(s => s.items);
      return { t, stages: list, ordered, locked: !!t.premium && !ctx.premium };
    }).filter(Boolean);
    const seq = new Map(groups.flatMap(g => g.ordered).map((d, i) => [d.id, i]));
    const recent = (progress?.items || []).filter(x => x.courseId === "drill" && x.status !== "cleared")
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).map(x => x.unitId);
    return { ds, groups, st, learned, seq, recent, recOf };
  }, [ds, topics, progress, lrn, courseIds, ctx.premium]);
}

/* 次にやる：挑戦中 → 習い終えた・習っているレッスンの未着手（単元をばらす）→ 最初の1問 */
export function nextPicks({ ds, st, learned, seq, recent }) {
  const out = [];
  const has = d => out.some(([x]) => x === d);
  for (const id of recent) { const d = ds.find(x => x.id === id); if (d && st(d) === "try" && out.length < 3) out.push([d, "try"]); }
  const bySeq = (a, b) => (seq.get(a.id) ?? 0) - (seq.get(b.id) ?? 0);
  const cand = ds.filter(d => !st(d) && learned((d.lessons || [])[0]))
    .sort((a, b) => (learned(b.lessons[0]) === "now") - (learned(a.lessons[0]) === "now") || bySeq(a, b));
  const seen = new Set(out.map(([d]) => d.topic));
  for (const d of cand) { if (out.length >= 3) break; if (seen.has(d.topic) && cand.some(x => !seen.has(x.topic) && !has(x))) continue; out.push([d, "new"]); seen.add(d.topic); }
  for (const d of cand) { if (out.length >= 3) break; if (!has(d)) out.push([d, "new"]); }
  // まだ何も習っていない単元からは、単元ごとに最初の1問
  const firsts = [...ds].sort(bySeq).filter(d => !st(d) && !has(d));
  for (const d of firsts) { if (out.length >= 3) break; if (seen.has(d.topic) && firsts.some(x => !seen.has(x.topic) && !has(x))) continue; out.push([d, "first"]); seen.add(d.topic); }
  for (const d of firsts) { if (out.length >= 3) break; if (!has(d)) out.push([d, "first"]); }
  return out;
}

// 見出しは上の帯にあるので、ここは探す・並べ方だけ
function Header({ view, set, screen }) {
  return (
    <div className="ptitle">
      <div className="r">
        <label className="lsearch"><Ic id="search" /><input id="dl-q" type="search" placeholder="キーワードで探す" aria-label="演習をキーワードで探す" value={view.q || ""} onChange={e => set({ q: e.target.value, screen: "list" })} /></label>
        <div className="tabs-h" role="tablist" aria-label="並べ方">
          <button type="button" role="tab" aria-selected={screen !== "list"} onClick={() => set({ screen: "home", q: "" })}>単元別</button>
          <button type="button" role="tab" aria-selected={screen === "list"} onClick={() => set({ screen: "list" })}>一覧</button>
        </div>
      </div>
    </div>
  );
}

function HomeScreen({ data, set, go }) {
  const picks = nextPicks(data);
  const { st, groups } = data;
  return (
    <>
      {picks.length > 0 && (
        <>
          <div className="sec-h"><h2>次にやる</h2></div>
          <div className="next">
            {picks.map(([d, why]) => {
              const t = d.topicObj || OTHER_TOPIC, s = st(d), l = (d.lessons || [])[0];
              return (
                <article key={d.id} className="card ncard is-link" style={{ "--tc": t.color }} {...rowLink(() => go(`#/drills/${encodeURIComponent(d.id)}`), `${d.title}（${s === "try" ? "つづきから" : "始める"}）`)}>
                  <div className="top"><TopicIcon topic={t} size={26} /><span className="eyebrow" style={{ color: t.color }}>{t.name}</span>
                    <span className={`why ${why === "try" ? "try" : "new"}`}>{why === "try" ? "挑戦中" : why === "first" ? "最初の1問" : "習ったところ"}</span></div>
                  <h3>{d.title}</h3>
                  {l?.lessonTitle && <div className="ls"><Ic id="slide" /><span>{[l.courseTitle, l.lessonTitle].filter(Boolean).join(" ・ ")}</span></div>}
                  <div className="foot">{d.level && <span className="chip"><Lvd level={d.level} />{d.level}</span>}{d.minutes ? <span className="chip">約{d.minutes}分</span> : null}
                    <GoArrow /></div>
                </article>
              );
            })}
          </div>
        </>
      )}
      <div className="sec-h"><h2>単元ごと</h2><div className="r"><Legend /></div></div>
      <div className="tgrid">
        {groups.map(({ t, ordered, locked }) => {
          const done = ordered.filter(d => st(d) === "done").length;
          const dots = <div className="dots">{ordered.map(d => <i key={d.id} className={st(d)} title={d.title} />)}</div>;
          const hd = <div className="hd"><TopicIcon topic={t} size={40} /><div><b>{t.name}</b>{t.sub && <small>{t.sub}</small>}</div>
            <span className="cnt">{locked ? <><b>{ordered.length}</b><small> 問</small></> : <><b style={{ color: done ? "var(--mint)" : "var(--ink)" }}>{done}</b><small> / {ordered.length}</small></>}</span></div>;
          if (locked) return <div key={t.id} className="card tcard locked" role="group" aria-label={t.name}>{hd}{dots}<div className="nx lk"><Ic id="lock" />{planLabel()}プランで利用できます</div></div>;
          const nxt = ordered.find(d => st(d) === "try") || ordered.find(d => !st(d));
          return (
            <button key={t.id} type="button" className="card tcard" onClick={() => { set({ screen: "topic", topic: t.id, lesson: null }); window.scrollTo(0, 0); }}>
              {hd}{dots}
              <div className="nx">{nxt ? <><small>{st(nxt) === "try" ? "つづき" : "次"}</small><b>{nxt.title}</b></> : <b style={{ color: "var(--mint)" }}>すべてクリア</b>}<span className="go">開く →</span></div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function TopicScreen({ data, view, set, go }) {
  const { st, learned, groups } = data;
  const g = groups.find(x => x.t.id === view.topic);
  const focusRef = useRef(null);
  const L = view.lesson;
  useEffect(() => { if (L && focusRef.current) focusRef.current.scrollIntoView({ block: "center" }); }, [L?.lessonId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return <><button type="button" className="back" onClick={() => set({ screen: "home" })}>← 演習一覧</button><p className="muted">この単元の演習はありません。</p></>;
  const { t, stages, ordered, locked } = g;
  const done = ordered.filter(d => st(d) === "done").length, tr = ordered.filter(d => st(d) === "try").length;
  const pct = n => `${ordered.length ? (n / ordered.length) * 100 : 0}%`;
  const courseTitles = [...new Set(stages.map(s => s.lesson?.courseTitle).filter(Boolean))];
  const open = d => go(`#/drills/${encodeURIComponent(d.id)}`);
  return (
    <>
      <button type="button" className="back" onClick={() => set({ screen: "home", lesson: null })}>← 演習一覧</button>
      {L && (
        <div className="dflesson">
          <span className="x">レッスン：{L.title}<button type="button" aria-label="レッスンの印を外す" onClick={() => set({ lesson: null })}>×</button></span>
          <span className="sp" style={{ flex: 1 }} />
          <button type="button" className="btn ghost" onClick={() => go(L.back)}>◀ レッスンに戻る</button>
          <button type="button" className="btn" onClick={() => go(L.next)}>{L.nextLabel} ▶</button>
        </div>
      )}
      <section className="card dl-thead">
        <TopicIcon topic={t} size={56} />
        <div><span className="eyebrow">{t.sub}</span><h1>{t.name}</h1>{courseTitles.length > 0 && <span className="sub">{courseTitles.join(" ・ ")} のレッスン順</span>}</div>
        <div className="prog">
          <div className="t"><span>クリア</span><b style={{ color: done ? "var(--mint)" : "var(--ink)" }}>{done}</b><span>/ {ordered.length}</span>{tr > 0 && <span>・ 挑戦中 {tr}</span>}</div>
          <div className="pbar"><i className="done" style={{ width: pct(done) }} /><i className="try" style={{ width: pct(tr) }} /></div>
        </div>
      </section>
      <div className="ttools">
        {locked ? <span className="chip prem">{planLabel()}プランで利用できます</span>
          : <label className="sw"><input type="checkbox" id="dl-hide" checked={!!view.hide} onChange={e => set({ hide: e.target.checked })} />クリア済みを隠す</label>}
        <Legend />
      </div>
      <div className="path">
        {stages.map((s, i) => {
          const items = s.items;
          const Ls = s.lesson ? learned(s.lesson) : "";
          const sd = items.filter(d => st(d) === "done").length;
          const node = sd === items.length ? "done" : Ls ? "now" : "yet";
          const focus = L && s.lesson && s.lesson.courseId === L.courseId && s.lesson.lessonId === L.lessonId;
          const shown = view.hide ? items.filter(d => st(d) !== "done") : items;
          return (
            <section key={s.key} className={`dstage ${node === "yet" ? "yet" : ""} ${focus ? "focus" : ""}`} ref={focus ? focusRef : undefined}>
              <div className="rail"><span className={`node ${node}`}>{node === "done" ? "✓" : i + 1}</span><span className="line" /></div>
              <div className="card sbox">
                <div className="sh">
                  {s.lesson ? <><h3>{s.lesson.lessonTitle || "レッスン"}</h3><span className="cs">{s.lesson.courseTitle}</span>
                    <span className={`st ${Ls || "yet"}`}>{Ls === "done" ? "学習済み" : Ls === "now" ? "学習中" : "未学習"}</span></>
                    : <h3>そのほかの演習</h3>}
                  <span className="r"><span className="tally"><b>{sd}</b> / {items.length}</span>
                    {s.lesson && Ls !== "done" && <button type="button" className="btn ghost sm" onClick={() => go(`#/courses/${encodeURIComponent(s.lesson.courseId)}/lessons/${encodeURIComponent(s.lesson.lessonId)}`)}>レッスンを見る</button>}</span>
                </div>
                {shown.length ? shown.map(d => {
                  const ds = st(d);
                  return (
                    <div key={d.id} className={`dl-row ${ds === "done" ? "cleared" : ""} ${ds === "lock" ? "" : "is-link"}`} {...(ds === "lock" ? {} : rowLink(() => open(d), `${d.title}（${ACT_LABEL[ds] || "始める"}）`))}>
                      <Mk s={ds} />
                      <span className="tt"><b>{d.title}</b><small>{(d.tags || []).slice(0, 3).map(x => <span key={x} className="tg">{x}</span>)}{(d.lessons || []).slice(1).map(l => <span key={`${l.courseId}/${l.lessonId}`} className="also">＋{shortLesson(l)}</span>)}</small></span>
                      <span className="dl-lv">{d.level && <><Lvd level={d.level} />{d.level}</>}</span>
                      <span className="mn">{d.minutes ? `約${d.minutes}分` : ""}</span>
                      <span className="act"><ActBtn s={ds} /></span>
                    </div>
                  );
                }) : <div className="allclear"><span className="mk done" />すべてクリア</div>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function ListScreen({ data, view, set, go }) {
  const { ds, st, learned, seq, groups } = data;
  const topic = groups.some(g => g.t.id === view.topic) ? view.topic : "all";
  const stf = view.st || "all", sort = view.sort || "rec";
  const inTopic = d => topic === "all" || (d.topicObj?.id === topic || d.topic === topic);
  const levels = LEVELS.filter(l => ds.some(d => inTopic(d) && d.level === l));
  const lv = levels.includes(view.lv) ? view.lv : "all";
  const words = norm(view.q).split(/\s+/).filter(Boolean);
  const text = d => norm([d.title, d.level, d.topicObj?.name, ...(d.tags || []), ...(d.lessons || []).flatMap(l => [l.courseTitle, l.lessonTitle])].join(" "));
  const rank = d => { const s = st(d); return s === "try" ? 0 : s === "lock" ? 4 : s === "done" ? 3 : learned((d.lessons || [])[0]) ? 1 : 2; };
  const bySeq = (a, b) => (seq.get(a.id) ?? 0) - (seq.get(b.id) ?? 0);
  const sorters = { rec: (a, b) => rank(a) - rank(b) || bySeq(a, b), lesson: bySeq, short: (a, b) => (a.minutes || 0) - (b.minutes || 0) || bySeq(a, b), easy: (a, b) => (LV[a.level] || 9) - (LV[b.level] || 9) || bySeq(a, b) };
  const rows = ds.filter(d => inTopic(d) && (lv === "all" || d.level === lv)
    && (stf === "all" || (stf === "none" ? !st(d) || st(d) === "lock" : st(d) === stf))
    && (!words.length || words.every(w => text(d).includes(w)))).sort(sorters[sort] || sorters.rec);
  const n = f => ds.filter(f).length;
  const F = (k, v, children) => <button key={`${k}-${v}`} type="button" className="f" aria-pressed={(k === "topic" ? topic : k === "st" ? stf : lv) === v} onClick={() => set(k === "topic" ? { topic: v, lv: "all" } : { [k]: v })}>{children}</button>;
  return (
    <>
      <div className="card lbar">
        <div className="frow" role="group" aria-label="単元"><span className="lbl">単元</span>
          {F("topic", "all", <>すべて <small>{ds.length}</small></>)}
          {groups.map(({ t, ordered }) => F("topic", t.id, <><i style={{ background: t.color }} />{t.name} <small>{ordered.length}</small></>))}
        </div>
        <div className="frow" role="group" aria-label="状態"><span className="lbl">状態</span>
          {F("st", "all", <>すべて</>)}
          {F("st", "none", <><span className="mk sm" />未着手</>)}
          {F("st", "try", <><span className="mk try sm" />挑戦中 <small>{n(d => st(d) === "try")}</small></>)}
          {F("st", "done", <><span className="mk done sm" />クリア <small>{n(d => st(d) === "done")}</small></>)}
        </div>
        <div className="frow"><span className="lbl">レベル</span>
          {F("lv", "all", <>すべて</>)}
          {levels.map(l => F("lv", l, l))}
          <span className="sp" />
          <select className="sort" id="dl-sort" aria-label="並べ替え" value={sort} onChange={e => set({ sort: e.target.value })}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <span className="count"><b>{rows.length}</b>問</span>
        </div>
      </div>
      <div className="card ltable">
        <div className="lhead"><span /><span>演習</span><span>単元</span><span>レベル</span><span style={{ textAlign: "right" }}>時間</span><span /></div>
        {rows.length ? rows.map(d => {
          const t = d.topicObj || OTHER_TOPIC, s = st(d), l = (d.lessons || [])[0];
          return (
            <div key={d.id} className={`dl-lrow ${s === "lock" ? "" : "is-link"}`} {...(s === "lock" ? {} : rowLink(() => go(`#/drills/${encodeURIComponent(d.id)}`), `${d.title}（${ACT_LABEL[s] || "始める"}）`))}>
              <Mk s={s} />
              <span className="tt"><b>{d.title}</b><small>{l?.lessonTitle ? [l.courseTitle, l.lessonTitle].filter(Boolean).join(" ・ ") : (d.tags || []).slice(0, 2).join(" ・ ")}</small></span>
              <span className="tp"><i style={{ background: t.color }} />{t.name}</span>
              <span className="dl-lv">{d.level && <><Lvd level={d.level} />{d.level}</>}</span>
              <span className="mn">{d.minutes ? `約${d.minutes}分` : ""}</span>
              <span className="act"><ActBtn s={s} /></span>
            </div>
          );
        }) : <div className="empty">当てはまる演習はありません</div>}
      </div>
    </>
  );
}

export default function DrillList({ ctx, view, setView }) {
  const data = useDrillData(ctx);
  const set = patch => setView({ ...view, ...patch });
  const screen = view.screen === "topic" && view.topic ? "topic" : view.screen === "list" ? "list" : "home";
  // 一番上の帯（単元別・一覧のとき。単元の道のりでは出さない）
  const { ds, st, learned } = data;
  const band = screen !== "topic" && (
    <DrillsBand go={ctx.go} total={ds.length} done={ds.filter(d => st(d) === "done").length} trying={ds.filter(d => st(d) === "try").length}
      learned={ds.filter(d => !st(d) && learned((d.lessons || [])[0])).length} next={nextPicks(data)[0]} progressError={ctx.progress?.state === "error"} />
  );
  return (
    <div className="stp">
      {band}
      <div className="stp-body dl">
        {screen !== "topic" && <Header view={view} set={set} screen={screen} />}
        {!data.ds.length ? <p className="muted">まだありません</p>
          : screen === "topic" ? <TopicScreen data={data} view={view} set={set} go={ctx.go} />
            : screen === "list" ? <ListScreen data={data} view={view} set={set} go={ctx.go} />
              : <HomeScreen data={data} set={set} go={ctx.go} />}
        {screen === "home" && <NextStep k="drills" hasAws={(ctx.drills || []).some(d => d.runtime === "aws")} go={ctx.go} />}
      </div>
    </div>
  );
}
