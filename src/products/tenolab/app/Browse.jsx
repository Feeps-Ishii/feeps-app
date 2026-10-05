import React, { useState } from "react";
import { Back, Carousel, Ic, PremTag, TopicIcon } from "./ui.jsx";
import { CaseCard, CourseCard, DrillCard } from "./cards.jsx";
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
  const { topics, courses, drills, cases, premium, go, resume } = ctx;
  return (
    <>
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
    </>
  );
}

const AWS_LEVELS = [["all", "すべて"], ["基礎", "基礎"], ["応用", "応用"], ["運用", "運用"]];
export function TopicPage({ ctx, topicId }) {
  const { topics, courses, drills, cases, premium, go, back } = ctx;
  const [lv, setLv] = useState("all");
  const t = topics.find(x => x.id === topicId) || (topicId === OTHER_TOPIC.id ? OTHER_TOPIC : null);
  if (!t) return <><Back onClick={() => go("#/home")}>← ホーム</Back><p className="muted">この単元は見つかりませんでした。</p></>;
  if (t.premium && !premium) return <><Back onClick={() => go("#/home")}>← ホーム</Back><div className="card flat" style={{ padding: 18, marginTop: 12 }}><b><Ic id="lock" /> {t.name}はPremiumプランで利用できます</b></div></>;
  const cs0 = byTopic(courses, t.id), ds0 = byTopic(drills, t.id), xs0 = byTopic(cases, t.id);
  const levelOf = x => x.level || courses.find(c => c.id === x.needCourseId)?.level;
  const pick = list => (lv === "all" ? list : list.filter(x => levelOf(x) === lv));
  const cs = pick(cs0), ds = pick(ds0), xs = pick(xs0);
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
      {ds.length ? <div className="courses">{ds.map(d => <DrillCard key={d.id} d={d} premium={premium} go={go} />)}</div> : <p className="muted">まだありません</p>}
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
export function ListPage({ ctx, kind, view, setView }) {
  const { topics, premium, go } = ctx;
  const K = KIND[kind];
  const [tab, setTab] = useState("all");
  const flat = view.mode === "flat";
  let all = ctx[kind];
  if (kind === "courses") all = all.filter(c => tab === "all" || (tab === "done" ? c.completed : c.progress > 0 && !c.completed));
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
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {kind === "courses" && <div className="tabs-h" role="tablist" aria-label="受講の状態">{COURSE_TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>}
          <div className="tabs-h" role="tablist" aria-label="並べ方">{[["topic", "単元別"], ["flat", "すべて"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={(view.mode || "topic") === k} onClick={() => setView({ ...view, mode: k })}>{l}</button>)}</div>
        </span>
      </div>
      {flat ? (
        <>
          <div className="filters" role="group" aria-label="単元で絞り込む">
            <button type="button" aria-pressed={!view.filter || view.filter === "all"} onClick={() => setView({ ...view, filter: "all" })}>すべて</button>
            {groups.map(t => <button key={t.id} type="button" aria-pressed={view.filter === t.id} onClick={() => setView({ ...view, filter: t.id })}><i style={{ background: t.color }} />{t.name}</button>)}
          </div>
          {filtered.length ? <div className={K.wrap === "car" ? "courses" : K.wrap}>{filtered.map(card)}</div> : <p className="muted">該当するものはありません</p>}
        </>
      ) : (
        groups.length ? groups.map(t => {
          const items = byTopic(all, t.id);
          const lk = !!t.premium && !premium;
          return (
            <section key={t.id}>
              <div className="ghead"><TopicIcon topic={t} size={40} /><h2>{t.name}</h2><PremTag item={t} premium={premium} />{tally(items)}
                {t.id !== OTHER_TOPIC.id && <button type="button" className="more" disabled={lk} onClick={() => go(`#/topics/${t.id}`)}>{lk ? <><Ic id="lock" /> Premiumプランで利用できます</> : "この単元を見る →"}</button>}
              </div>
              {K.wrap === "car" ? <Carousel>{items.map(card)}</Carousel> : <div className={K.wrap}>{items.map(card)}</div>}
            </section>
          );
        }) : <p className="muted">{kind === "courses" && tab !== "all" ? "該当するコースはありません" : "まだありません"}</p>
      )}
    </>
  );
}
