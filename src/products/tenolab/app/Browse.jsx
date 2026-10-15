import React, { useState } from "react";
import { Back, Carousel, Ic, PremTag, TopicIcon } from "./ui.jsx";
import { ActiveCases, CaseCard, CourseCard, DrillCard, CourseRow } from "./cards.jsx";
import { NoticeBanner, NoticeCard } from "./notices/Notices.jsx";
import { byTopic } from "./model.js";
import { OTHER_TOPIC } from "./ui.jsx";

/* ホーム（まず単元を選ぶ）・単元ページ・一覧（モックの home / topicPage / listPage） */

// 単元の並び。コース・演習・案件体験のどれかがある単元だけ。単元の決まっていないものは「その他」
// ホーム：登録した単元はすべて（まだ中身が無くても）。単元の決まっていないものがあれば「その他」も
function topicsWithOther(topics, ...lists) {
  const known = new Set(topics.map(t => t.id));
  return lists.flat().some(x => !known.has(x.topic)) ? [...topics, OTHER_TOPIC] : topics;
}
function topicsWith(topics, ...lists) {
  const ids = new Set(lists.flat().map(x => x.topic));
  const out = topics.filter(t => ids.has(t.id));
  if ([...ids].some(id => !topics.some(t => t.id === id))) out.push(OTHER_TOPIC);
  return out;
}

export function Home({ ctx }) {
  const { topics, courses, drills, cases, premium, go, resume, notices } = ctx;
  return (
    <>
      <NoticeBanner notices={notices} />
      {resume && (
        <section className="card resume">
          <div style={{ display: "grid", gap: 8 }}>
            <div className="eyebrow">続きから</div>
            <div className="h2">{resume.course.title}{resume.lesson ? ` ・ ${resume.lesson.title}` : ""}</div>
            <div className="row"><span className="chip"><Ic id="slide" />{resume.label}</span></div>
          </div>
          <button className="btn" type="button" onClick={() => go(resume.href)}><Ic id="play" />続きから学ぶ</button>
        </section>
      )}
      <ActiveCases cases={cases} go={go} limit={2} />
      <div className="sec-h"><h2 className="h2">単元から選ぶ</h2></div>
      <div className="topics">
        {topicsWithOther(topics, courses, drills, cases).map(t => {
          const other = t.id === OTHER_TOPIC.id, known = new Set(topics.map(x => x.id));
          const pickT = list => (other ? list.filter(x => !known.has(x.topic)) : byTopic(list, t.id));
          const cs = pickT(courses), ds = pickT(drills), xs = pickT(cases);
          const lk = !!t.premium && !premium;
          const done = cs.filter(c => c.completed).length;
          const avg = cs.length ? Math.round(cs.reduce((a, c) => a + c.progress, 0) / cs.length) : 0;
          const Tag = lk ? "div" : "button";
          return (
            <Tag key={t.id} className={`card tile ${lk ? "locked" : ""}`} {...(lk ? { "aria-disabled": "true" } : { type: "button", onClick: () => go(`#/topics/${t.id}`) })}>
              <TopicIcon topic={t} />
              <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <span className="row" style={{ gap: 6 }}><span className="eyebrow">{t.sub}</span><PremTag item={t} premium={premium} /></span>
                <h3>{t.name}</h3>
                <span className="counts"><span>コース <b>{cs.length}</b></span><span>演習 <b>{ds.length}</b></span><span>案件 <b>{xs.length}</b></span></span>
                {lk && <span className="lockline"><Ic id="lock" />Premiumプランで利用できます</span>}
                {cs.some(c => c.progress) && <span className="row" style={{ gap: 8 }}><span className="bar-p" style={{ flex: 1, maxWidth: 160 }}><i style={{ width: `${avg}%` }} /></span><span className="muted num" style={{ fontSize: 12 }}>修了 {done} / {cs.length}</span></span>}
              </span>
            </Tag>
          );
        })}
      </div>
      <div className="sec-h"><h2 className="h2">すべてを見る</h2></div>
      <div className="shortcuts">
        <button type="button" className="card shortcut" onClick={() => go("#/courses")}><Ic id="slide" /><span><b>コース一覧</b><div className="muted" style={{ fontSize: 12 }}>{courses.length}コース</div></span><span className="go">→</span></button>
        <button type="button" className="card shortcut" onClick={() => go("#/drills")}><Ic id="code" /><span><b>演習一覧</b><div className="muted" style={{ fontSize: 12 }}>{drills.length}問</div></span><span className="go">→</span></button>
        <button type="button" className="card shortcut" onClick={() => go("#/cases")}><Ic id="case" /><span><b>案件体験</b><div className="muted" style={{ fontSize: 12 }}>{cases.length}件</div></span><span className="go">→</span></button>
      </div>
      <NoticeCard notices={notices} className="at-bottom" />
    </>
  );
}

const AWS_LEVELS = [["all", "すべて"], ["基礎", "基礎"], ["応用", "応用"], ["運用", "運用"]];
export function TopicPage({ ctx, topicId }) {
  const { topics, courses, drills, cases, premium, go, back } = ctx;
  const [lv, setLv] = useState("all");
  const [tagSel, setTagSel] = useState("all");
  const t = topics.find(x => x.id === topicId) || (topicId === OTHER_TOPIC.id ? OTHER_TOPIC : null);
  if (!t) return <><Back onClick={() => go("#/home")}>← ホーム</Back><p className="muted">この単元は見つかりませんでした。</p></>;
  if (t.premium && !premium) return <><Back onClick={() => go("#/home")}>← ホーム</Back><div className="card flat" style={{ padding: 18, marginTop: 12 }}><b><Ic id="lock" /> {t.name}はPremiumプランで利用できます</b></div></>;
  const cs0 = byTopic(courses, t.id), ds0 = byTopic(drills, t.id), xs0 = byTopic(cases, t.id);
  const levelOf = x => x.level || courses.find(c => c.id === x.needCourseId)?.level;
  const pick = list => (lv === "all" ? list : list.filter(x => levelOf(x) === lv));
  const cs = pick(cs0), ds1 = pick(ds0), xs = pick(xs0);
  // 演習をタグで絞る（2026-10-15、モック devhub-drill-filter.html の C 案）。演習に付いているものだけ出す。
  // 技術のタグは2つ以上あるとき（Web制作の HTML・CSS など）だけ前に並べる
  const { tech: techTags, learn: learnTags0 } = topicTags(t);
  const learnTags = [...(techTags.length > 1 ? techTags : []), ...learnTags0].map(x => [x, ds1.filter(d => (d.tags || []).includes(x)).length]).filter(([, n]) => n);
  const dtag = learnTags.some(([x]) => x === tagSel) ? tagSel : "all";
  const ds = dtag === "all" ? ds1 : ds1.filter(d => (d.tags || []).includes(dtag));
  return (
    <>
      <Back onClick={() => back("#/home")}>← ホーム</Back>
      <section className="card thead">
        <TopicIcon topic={t} size={96} />
        <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <span className="row" style={{ gap: 6 }}><span className="eyebrow">{t.sub}</span><PremTag item={t} premium={premium} /></span>
          <h1 className="h1">{t.name}</h1>
          {t.desc && <p style={{ margin: 0, color: "var(--ink2)" }}>{t.desc}</p>}
        </div>
        <div className="flow" aria-label="この単元の進め方">
          <div><small className="muted">学ぶ</small><b>コース {cs0.length}</b></div><span>→</span>
          <div><small className="muted">手を慣らす</small><b>演習 {ds0.length}</b></div><span>→</span>
          <div><small className="muted">仕事の一部を体験</small><b>案件体験 {xs0.length}</b></div>
        </div>
      </section>
      {t.premium && (
        <>
          <div className="sells">
            <div className="card"><b>本物のAWS環境</b><span className="muted" style={{ fontSize: 13 }}>画面のまねではなく、実際のマネジメントコンソールで操作します</span></div>
            <div className="card"><b>始める状態を選べる</b><span className="muted" style={{ fontSize: 13 }}>まっさらな環境から作る／用意済みの環境に足す／障害が起きた環境を直す</span></div>
            <div className="card"><b>作ったものを自動で採点</b><span className="muted" style={{ fontSize: 13 }}>できた構成をその場で確かめ、終わったら環境は自動で片付けます</span></div>
          </div>
          <div className="sec-h"><h2 className="h2">レベル</h2><div className="tabs-h" role="tablist">{AWS_LEVELS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={lv === k} onClick={() => setLv(k)}>{l}</button>)}</div></div>
        </>
      )}
      <div className="sec-h"><h2 className="h2">コース</h2></div>
      {cs.length ? <div className="courses">{cs.map(c => <CourseCard key={c.id} c={c} premium={premium} go={go} />)}</div> : <p className="muted">まだありません</p>}
      <div className="sec-h"><h2 className="h2">{t.premium ? "実習" : "簡単な演習"}</h2><span className="muted" style={{ fontSize: 13 }}>{t.premium ? "本物のAWS環境で 20〜45分" : "5〜10分で1問"}</span></div>
      {learnTags.length > 1 && (
        <div className="dfrow tagnav" role="group" aria-label="内容で絞り込む">
          <button type="button" className="f" aria-pressed={dtag === "all"} onClick={() => setTagSel("all")}>すべて <small>{ds1.length}</small></button>
          {learnTags.map(([x, n]) => <button key={x} type="button" className={`f tag ${techTags.includes(x) ? "tech" : ""}`} style={{ "--tc": t.color }} aria-pressed={dtag === x} onClick={() => setTagSel(x)}>{x} <small>{n}</small></button>)}
        </div>
      )}
      {ds.length ? <div className="courses">{ds.map(d => <DrillCard key={d.id} d={d} premium={premium} go={go} hits={dtag === "all" ? [] : [dtag]} />)}</div> : <p className="muted">まだありません</p>}
      <div className="sec-h"><h2 className="h2">この単元の案件体験</h2></div>
      {xs.length ? <div className="cases">{xs.map(x => <CaseCard key={x.id} x={x} premium={premium} go={go} />)}</div> : <p className="muted">まだありません</p>}
    </>
  );
}

/* 一覧：単元別（横送り）が標準、「すべて」で絞り込み */
const KIND = {
  courses: { eyebrow: "COURSES", title: "コース一覧", sub: "", Card: CourseCard, prop: "c", wrap: "car" },
  drills: { eyebrow: "EXERCISES", title: "演習一覧", sub: "", Card: DrillCard, prop: "d", wrap: "car" },
  cases: { eyebrow: "PROJECTS", title: "案件体験", sub: "実際の案件をもとにした課題", Card: CaseCard, prop: "x", wrap: "cases" },
};
const COURSE_TABS = [["all", "すべて"], ["inprogress", "受講中"], ["done", "修了"]];

// キーワード検索（2026-10-13）：名前・概要・単元・レベル・依頼元などに、空白で区切った語がすべて入っているもの
const norm = s => String(s ?? "").normalize("NFKC").toLowerCase();
const KIND_WORD = { feat: "機能追加", bug: "不具合", mod: "改修" };
const searchText = x => norm([x.title, x.summary, x.level, x.topicObj?.name, x.runtime, x.ticket?.client, x.ticket?.id, KIND_WORD[x.ticket?.kind], ...(x.tags || [])].join(" "));
function matchAll(list, q) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  return words.length ? list.filter(x => { const t = searchText(x); return words.every(w => t.includes(w)); }) : list;
}

/* コース一覧の単元別（モック devhub-course-list.html の A 案、2026-10-13）
   単元ごとのまとまりで2列。コースが3つ以上の単元と、2列で1つ余った単元は横いっぱい（中のコースは横に並べる）。
   同じ行の単元は同じ高さにそろえる。下に演習・案件体験の数 */
function CoursePanels({ groups, ctx }) {
  const { premium, go, drills = [], cases = [] } = ctx;
  const narrow = groups.filter(g => g.items.length < 3);
  const lastOdd = narrow.length % 2 ? narrow[narrow.length - 1] : null;
  return (
    <div className="cpanels">
      {groups.map(g => {
        const t = g.t, n = g.items.length;
        const wide = n >= 3 || g === lastOdd;
        const dn = drills.filter(d => d.topic === t.id).length, cn = cases.filter(x => x.topic === t.id).length;
        return (
          <section key={t.id} className={`card cpanel ${wide ? "wide" : ""}`} style={{ "--c": t.color, "--n": Math.min(3, Math.max(n, 2)) }}>
            <div className="cph"><TopicIcon topic={t} size={40} /><div><h2>{t.name}<PremTag item={t} premium={premium} /></h2>{t.desc && <p>{t.desc}</p>}</div>
              <div className="sum"><b>{n}</b>コース</div></div>
            <div className="cps">{g.items.map(c => <CourseRow key={c.id} c={c} premium={premium} go={go} />)}</div>
            {t.id !== OTHER_TOPIC.id && (
              <div className="cpf"><span>演習 {dn}</span><span>案件体験 {cn}</span>
                <button type="button" className="more" onClick={() => go(`#/topics/${t.id}`)}>この単元を見る →</button></div>
            )}
          </section>
        );
      })}
    </div>
  );
}
// 演習一覧：単元ごとに「クリア済みを隠す」（2026-10-13）。この端末だけに覚える
const HIDE_KEY = "tl-drills-hide-cleared";
function useHideCleared() {
  const [hide, setHide] = useState(() => { try { return JSON.parse(localStorage.getItem(HIDE_KEY) || "[]"); } catch (e) { return []; } });
  const toggle = id => setHide(h => {
    const next = h.includes(id) ? h.filter(x => x !== id) : [...h, id];
    try { localStorage.setItem(HIDE_KEY, JSON.stringify(next)); } catch (e) { /* 覚えられなくても切り替えはできる */ }
    return next;
  });
  return [hide, toggle];
}
/* 演習一覧の絞り込み（2026-10-15、モック devhub-drill-filter.html の A 案）
   単元 → その単元のタグ（技術は濃い色・学ぶことは薄い色）→ レベル・クリア済みを隠す。タグはどれかに当たれば出す */
const LEVEL_ORDER = ["やさしい", "ふつう", "むずかしい", "基礎", "応用", "運用"];
const topicTags = t => ({ tech: t?.tagsTech || [], learn: t?.tagsLearn || [] });
function DrillFilter({ all, groups, view, setView, premium, go }) {
  const topic = view.filter && view.filter !== "all" && groups.some(g => g.id === view.filter) ? view.filter : "all";
  const tags = view.tags || [];
  const set = patch => setView({ ...view, ...patch });
  const inTopic = topic === "all" ? all : all.filter(d => d.topic === topic);
  const t = groups.find(g => g.id === topic);
  // すべてのときは各単元の技術のタグ、単元を選んだときはその単元の技術と学ぶこと
  const tagRows = topic === "all"
    ? groups.flatMap(g => topicTags(g).tech.map(x => ({ x, color: g.color, tech: true })))
    : [...topicTags(t).tech.map(x => ({ x, color: t?.color, tech: true })), ...topicTags(t).learn.map(x => ({ x, color: t?.color, tech: false }))];
  const seenTag = new Set();
  const tagChips = tagRows.filter(r => !seenTag.has(r.x) && seenTag.add(r.x)).map(r => ({ ...r, n: inTopic.filter(d => (d.tags || []).includes(r.x)).length }));
  const levels = LEVEL_ORDER.filter(l => inTopic.some(d => d.level === l));
  const level = levels.includes(view.level) ? view.level : "all";
  const list = inTopic.filter(d => (!tags.length || tags.some(x => (d.tags || []).includes(x))) && (level === "all" || d.level === level) && !(view.hide && d.cleared));
  const toggleTag = x => set({ tags: tags.includes(x) ? tags.filter(y => y !== x) : [...tags, x] });
  return (
    <>
      <div className="dfbar">
        <div className="dfrow" role="group" aria-label="単元で絞り込む"><span className="lbl">単元</span>
          <button type="button" className="f" aria-pressed={topic === "all"} onClick={() => set({ filter: "all", tags: [] })}>すべて <small>{all.length}</small></button>
          {groups.map(g => <button key={g.id} type="button" className="f" aria-pressed={topic === g.id} onClick={() => set({ filter: g.id, tags: [] })}><i style={{ background: g.color }} />{g.name} <small>{all.filter(d => d.topic === g.id).length}</small></button>)}
        </div>
        {tagChips.some(c => c.n) && (
          <div className="dfrow" role="group" aria-label="技術・内容で絞り込む"><span className="lbl">{topic === "all" ? "技術" : "技術・内容"}</span>
            {tagChips.map(c => <button key={c.x} type="button" className={`f tag ${c.tech ? "tech" : ""}`} style={{ "--tc": c.color }} aria-pressed={tags.includes(c.x)} disabled={!c.n} onClick={() => toggleTag(c.x)}>{c.x} <small>{c.n}</small></button>)}
          </div>
        )}
        <div className="dfrow last">
          {levels.length > 1 && <span className="seg" role="group" aria-label="レベル">{[["all", "すべて"], ...levels.map(l => [l, l])].map(([k, l]) => <button key={k} type="button" aria-pressed={level === k} onClick={() => set({ level: k })}>{l}</button>)}</span>}
          {inTopic.some(d => d.cleared) && <label className="hide-sw"><input type="checkbox" role="switch" checked={!!view.hide} onChange={e => set({ hide: e.target.checked })} /><i aria-hidden="true" />クリア済みを隠す</label>}
          <span className="dcount"><b>{list.length}</b>問</span>
        </div>
      </div>
      {list.length ? <div className="courses">{list.map(d => <DrillCard key={d.id} d={d} premium={premium} go={go} hits={tags} />)}</div> : <p className="muted">当てはまる演習はありません</p>}
    </>
  );
}

export function ListPage({ ctx, kind, view, setView }) {
  const { topics, premium, go } = ctx;
  const K = KIND[kind];
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [hide, toggleHide] = useHideCleared();
  const flat = view.mode === "flat";
  let all = ctx[kind];
  if (kind === "courses") all = all.filter(c => tab === "all" || (tab === "done" ? c.completed : c.progress > 0 && !c.completed));
  all = matchAll(all, q);
  const card = item => <K.Card key={item.id} {...{ [K.prop]: item }} premium={premium} go={go} />;
  const tally = items => kind === "courses" ? <span className="tally">修了 <b>{items.filter(c => c.completed).length}</b> / {items.length}</span>
    : kind === "drills" ? <span className="tally">クリア <b>{items.filter(d => d.cleared).length}</b> / {items.length}</span>
      : <span className="tally">{items.length}件</span>;
  const filtered = view.filter && view.filter !== "all" ? all.filter(x => x.topic === view.filter) : all;
  const groups = topicsWith(topics, all);
  return (
    <>
      <div className="sec-h" style={{ marginTop: 0, alignItems: "flex-end" }}>
        <div className="ptitle"><span className="eyebrow">{K.eyebrow}</span><h1 className="h1">{K.title}</h1></div>
        {K.sub && <span className="muted" style={{ fontSize: 13, paddingBottom: 6 }}>{K.sub}</span>}
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label className="lsearch"><Ic id="search" /><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="キーワードで探す" aria-label={`${K.title}をキーワードで探す`} /></label>
          {kind === "courses" && <div className="tabs-h" role="tablist" aria-label="受講の状態">{COURSE_TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>}
          <div className="tabs-h" role="tablist" aria-label="並べ方">{[["topic", "単元別"], ["flat", "すべて"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={(view.mode || "topic") === k} onClick={() => setView({ ...view, mode: k })}>{l}</button>)}</div>
        </span>
      </div>
      {kind === "cases" && <ActiveCases cases={all} go={go} />}
      {flat && kind === "drills" ? (
        <DrillFilter all={all} groups={groups} view={view} setView={setView} premium={premium} go={go} />
      ) : flat ? (
        <>
          <div className="filters" role="group" aria-label="単元で絞り込む">
            <button type="button" aria-pressed={!view.filter || view.filter === "all"} onClick={() => setView({ ...view, filter: "all" })}>すべて</button>
            {groups.map(t => <button key={t.id} type="button" aria-pressed={view.filter === t.id} onClick={() => setView({ ...view, filter: t.id })}><i style={{ background: t.color }} />{t.name}</button>)}
          </div>
          {filtered.length ? <div className={K.wrap === "car" ? "courses" : K.wrap}>{filtered.map(card)}</div> : <p className="muted">該当するものはありません</p>}
        </>
      ) : kind === "courses" ? (
        groups.length ? <CoursePanels groups={groups.map(t => ({ t, items: byTopic(all, t.id) })).filter(g => g.items.length)} ctx={ctx} />
          : <p className="muted">{q ? "該当するものはありません" : tab !== "all" ? "該当するコースはありません" : "まだありません"}</p>
      ) : (
        groups.length ? groups.map(t => {
          const items = byTopic(all, t.id);
          const lk = !!t.premium && !premium;
          const canHide = kind === "drills" && items.some(d => d.cleared);
          const hiding = canHide && hide.includes(t.id);
          const shown = hiding ? items.filter(d => !d.cleared) : items;
          return (
            <section key={t.id}>
              <div className="ghead"><TopicIcon topic={t} size={40} /><h2>{t.name}</h2><PremTag item={t} premium={premium} />{tally(items)}
                {canHide && <label className="hide-sw"><input type="checkbox" role="switch" checked={hiding} onChange={() => toggleHide(t.id)} /><i aria-hidden="true" />クリア済みを隠す</label>}
                {t.id !== OTHER_TOPIC.id && <button type="button" className="more" disabled={lk} onClick={() => go(`#/topics/${t.id}`)}>{lk ? <><Ic id="lock" /> Premiumプランで利用できます</> : "この単元を見る →"}</button>}
              </div>
              {hiding && !shown.length ? <span className="chip done all-clear"><Ic id="check" />すべてクリア済み</span>
                : K.wrap === "car" ? <Carousel key={hiding ? "h" : "a"}>{shown.map(card)}</Carousel> : <div className={K.wrap}>{shown.map(card)}</div>}
            </section>
          );
        }) : <p className="muted">{q ? "該当するものはありません" : "まだありません"}</p>
      )}
    </>
  );
}
