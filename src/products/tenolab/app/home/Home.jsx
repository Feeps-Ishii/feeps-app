import React, { useEffect, useMemo, useState } from "react";
import { TopicIcon, OTHER_TOPIC, planLabel } from "../ui.jsx";
import { activeCases } from "../cards.jsx";
import { NoticeBanner, NOTICE_KIND, mdLabel } from "../notices/Notices.jsx";
import { useDrillData, nextPicks } from "../drills/DrillList.jsx";
import { STEPS } from "../steps/Steps.jsx";
import "./home.css";

/* ホーム（2026-11-20、モック docs/design/mockups/tenolab-2026-09/tenolab-home.html の案B）
   上：続きから（大きく。ほかの受講中のコースも）＋ 次にやる（試す・実践・本物の環境から1つずつ）
   中：道のり（4つの段の数字）。下：単元（5つまで＋もっと見る）と、お知らせ・学習の記録（上と同じ列の幅）。
   数字はすべて自分の記録から作る（新しい API は使わない） */

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const ACTIVE_LABEL = { doing: "対応中", returned: "修正依頼", submitted: "レビュー待ち" };
const ICON = {
  courses: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M10 9l4 2-4 2z" /></>,
  drills: <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />,
  cases: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  aws: <path d="M7 18h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 9.1 4.5 4.5 0 0 0 7 18z" />,
};
const StepIcon = ({ k }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[k]}</svg>;
const Play = () => <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1v8l7-4z" fill="currentColor" /></svg>;

export default function Home({ ctx, alert }) {
  const { lrn, topics, courses, drills, cases, premium, go, resume, notices, progress } = ctx;
  const dd = useDrillData(ctx);
  const labs = useMemo(() => (drills || []).filter(d => d.runtime === "aws"), [drills]);
  const hasAws = labs.length > 0;
  const progressError = progress?.state === "error";

  // ほかの受講中のコース（最後に触った順）。今のレッスン名のために、まだ読んでいないコースのレッスンを読む
  const doing = useMemo(() => courses.filter(c => !c.locked && c.progress > 0 && !c.completed)
    .sort((a, b) => String(lrn.progress?.[b.id]?.lastAccessedAt || "").localeCompare(String(lrn.progress?.[a.id]?.lastAccessedAt || ""))), [courses, lrn]);
  const others = doing.filter(c => c.id !== resume?.course?.id).slice(0, 3);
  useEffect(() => {
    for (const c of others) if (lrn.refreshCourseLessons && lrn.progress?.[c.id]?.lastLessonId && !lrn.lessonsForCourse(c.id).length) lrn.refreshCourseLessons(c.id);
  }, [others.map(c => c.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stp hm">
      <section className="hm-top">
        <div className="hm-in">
          <NoticeBanner notices={notices} />
          <div className="hm-grid">
            <Player ctx={ctx} others={others} doing={doing} />
            <Queue ctx={ctx} dd={dd} labs={labs} />
          </div>
        </div>
      </section>
      <div className="stp-body">
        {alert && <div className="hm-alert">{alert}</div>}
        <Strip courses={courses} dd={dd} cases={cases} labs={labs} hasAws={hasAws} progress={progress} progressError={progressError} go={go} />
        <div className="hm-low">
          <Topics topics={topics} courses={courses} drills={drills} cases={cases} premium={premium} go={go} />
          <aside className="hm-side" aria-label="お知らせ">
            <div className="hm-sec"><h2>お知らせ</h2></div>
            <Notes notices={notices} />
            <button type="button" className="hm-rec" onClick={() => go("#/record")}>
              <span className="ri"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h4" /></svg></span>
              <span><b>学習の記録</b><small>修了・クリア・合格をまとめて見る</small></span><span className="gt" aria-hidden="true">→</span>
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* 続きから（いちばん大事）。続きのレッスンが無ければ、受講中のコース、それも無ければ最初のコース */
function Player({ ctx, others, doing }) {
  const { lrn, courses, resume, go } = ctx;
  let main = null;
  if (resume) {
    const cm = courses.find(c => c.id === resume.course.id);
    const ls = lrn.lessonsForCourse(resume.course.id) || [];
    const i = resume.lesson ? ls.findIndex(l => l.id === resume.lesson.id) : -1;
    const total = ls.length || cm?.lessons || 0;
    const doneMap = lrn.getLessonsDone?.(resume.course.id) || {};
    const doneN = ls.filter(l => doneMap[l.id]?.completed).length;
    main = { kind: "resume", label: "続きから", course: resume.course.title, title: resume.lesson?.title || resume.course.title, no: i >= 0 ? i + 1 : 0, total, doneN, progress: cm?.progress || 0, href: resume.href, btn: "続きから" };
  } else if (doing[0]) {
    const c = doing[0];
    main = { kind: "resume", label: "続きから", course: c.topicObj?.name || "", title: c.title, no: 0, total: c.lessons, doneN: null, progress: c.progress, href: `#/courses/${c.id}`, btn: "続きから" };
  } else {
    const c = courses.find(x => !x.locked && !x.completed);
    if (c) main = { kind: "first", label: "はじめの一歩", course: c.topicObj?.name || "", title: c.title, meta: [c.lessons ? `レッスン ${c.lessons}` : "", c.duration].filter(Boolean).join(" ・ "), href: `#/courses/${c.id}`, btn: "はじめる" };
  }
  if (!main) {
    return <article className="hm-player empty"><div className="pinfo"><span className="lab">続きから</span><h2>{courses.length ? "すべてのコースを修了しました" : "コースはまだありません"}</h2>{courses.length > 0 && <button type="button" className="go" onClick={() => go("#/courses")}>コース一覧へ →</button>}</div></article>;
  }
  const dots = Math.min(main.total || 0, 12);
  return (
    <article className="hm-player">
      <button type="button" className="hm-stage" onClick={() => go(main.href)} aria-label={`${main.title}を${main.btn === "はじめる" ? "はじめる" : "続きから開く"}`}>
        {main.kind === "first" ? (
          <span className="hm-slide cover"><span className="k">COURSE{main.course ? ` ・ ${main.course}` : ""}</span><span className="t">{main.title}</span><i className="rule" /><span className="big" aria-hidden="true">01</span></span>
        ) : (
          <span className="hm-slide">
            <span className="k">{main.no ? `LESSON ${String(main.no).padStart(2, "0")}` : "COURSE"}</span>
            <span className="t">{main.title}</span>
            <span className="cn">{main.course}</span>
            {dots > 1 ? <span className="pd">{Array.from({ length: dots }, (_, j) => <i key={j} className={j + 1 === main.no ? "on" : j + 1 < main.no ? "past" : ""} />)}<span>{main.no ? `${main.no} / ${main.total}` : ""}</span></span> : <span className="pd" />}
            {main.no > 0 && <span className="big" aria-hidden="true">{String(main.no).padStart(2, "0")}</span>}
          </span>
        )}
        <span className="play"><Play /></span>
      </button>
      <div className="pinfo">
        <span className="lab">{main.label}{main.kind === "resume" && main.course && <span>{main.course}</span>}</span>
        <h2>{main.title}</h2>
        {main.kind === "first" ? <span className="pr">{main.meta}</span>
          : <span className="pr"><span className="hm-bar"><i style={{ width: `${main.progress}%` }} /></span>{main.doneN != null && main.total ? `${main.doneN} / ${main.total} レッスン` : `${main.progress}%`}</span>}
        <button type="button" className="go" onClick={() => go(main.href)}>{main.btn} →</button>
      </div>
      {others.length > 0 && (
        <div className="others">
          <span className="oh">ほかの受講中<small>{others.length}コース</small></span>
          {others.map(c => {
            const lid = lrn.progress?.[c.id]?.lastLessonId;
            const lt = lid ? (lrn.lessonsForCourse(c.id) || []).find(l => l.id === lid)?.title : "";
            return (
              <button key={c.id} type="button" className="oc" onClick={() => go(lid ? `#/courses/${c.id}/lessons/${lid}` : `#/courses/${c.id}`)}>
                <span className="n"><b>{c.title}</b>{lt && <small>{lt}</small>}</span>
                <span className="p"><span className="hm-meter"><i style={{ width: `${c.progress}%` }} /></span>{c.progress}%</span>
                <span className="g">続き →</span>
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

/* 次にやる：試す・実践・本物の環境から1つずつ */
function Queue({ ctx, dd, labs }) {
  const { cases, premium, progress, go } = ctx;
  const items = [];
  const s = k => STEPS.find(x => x.k === k);
  if (progress?.state !== "error") {
    const [d, why] = nextPicks(dd)[0] || [];
    if (d) items.push({ st: s("drills"), chip: why === "try" ? "つづき" : why === "first" ? "最初の1問" : "次の1問", tt: d.title, mt: [d.topicObj?.name, d.minutes ? `約${d.minutes}分` : ""].filter(Boolean).join(" ・ "), href: `#/drills/${encodeURIComponent(d.id)}` });
  }
  const act = activeCases(cases);
  if (act[0]) {
    const x = act[0];
    items.push({ st: s("cases"), chip: ACTIVE_LABEL[x.status] || "割り当て", warn: x.status !== "doing", tt: x.title, mt: [x.ticket?.id, act.length > 1 ? `ほか ${act.length - 1}件` : ""].filter(Boolean).join(" ・ "), href: `#/cases/${x.id}` });
  } else {
    const x = (cases || []).find(c => !c.locked && !c.status);
    if (x) items.push({ st: s("cases"), chip: "はじめに", tt: x.title, mt: [x.topicObj?.name, x.ticket?.id].filter(Boolean).join(" ・ "), href: `#/cases/${x.id}` });
  }
  if (labs.length) {
    if (!premium) items.push({ st: s("aws"), chip: planLabel().toUpperCase(), tt: "本物のAWS環境で実習", mt: `${planLabel()}プランで利用できます`, href: "#/aws" });
    else {
      const lab = labs.find(l => !l.locked && progress?.drill?.(l.id)?.status !== "cleared");
      const steps = n => (n ? `手順 ${n}` : "");
      if (lab) items.push({ st: s("aws"), chip: "次の実習", tt: lab.title, mt: [lab.minutes ? `約${lab.minutes}分` : "", steps((lab.aws?.steps || []).filter(x => !/コンソールを開く/.test(x?.title || "")).length)].filter(Boolean).join(" ・ "), href: "#/aws" });
    }
  }
  const sub = STEPS.filter(x => x.k !== "courses" && (x.k !== "aws" || labs.length)).map(x => x.verb).join(" ・ ");
  return (
    <section className="hm-queue" aria-label="次にやる">
      <div className="qh"><b>次にやる</b><small>{sub}</small></div>
      {items.length ? (
        <ol>{items.map(it => (
          <li key={it.st.k}><button type="button" className={`qi ${it.st.cls}`} onClick={() => go(it.href)}>
            <span className="rl" aria-hidden="true" />
            <span className="k">{it.st.no} {it.st.verb}<span className={`hm-chip ${it.warn ? "warn" : ""}`}>{it.chip}</span></span>
            <span className="tt">{it.tt}</span>
            {it.mt && <span className="mt">{it.mt}</span>}
            <span className="ar" aria-hidden="true">→</span>
          </button></li>
        ))}</ol>
      ) : <p className="qe">{progress?.state === "error" ? "進み具合を確認できません" : "いま次にやるものはありません"}</p>}
    </section>
  );
}

/* 道のり：4つの段の数字（押すとその画面へ） */
function Strip({ courses, dd, cases, labs, hasAws, progress, progressError, go }) {
  const ds = dd.ds || [];
  const cDone = courses.filter(c => c.completed).length;
  const dDone = ds.filter(d => dd.st(d) === "done").length;
  const act = activeCases(cases).length;
  const merged = (cases || []).filter(x => x.status === "approved").length;
  const lDone = labs.filter(l => progress?.drill?.(l.id)?.status === "cleared").length;
  const row = {
    courses: ["修了", cDone, courses.length, pct(cDone, courses.length)],
    drills: ["クリア", progressError ? null : dDone, ds.length, pct(dDone, ds.length)],
    cases: ["対応中", act, 0, pct(merged, (cases || []).length)],
    aws: ["クリア", progressError ? null : lDone, labs.length, pct(lDone, labs.length)],
  };
  const steps = STEPS.filter(s => s.k !== "aws" || hasAws);
  return (
    <section aria-label="道のり">
      <div className="hm-sec"><h2>道のり</h2></div>
      <div className={`hm-strip n${steps.length}`}>
        {steps.map(s => {
          const [u, n, d, p] = row[s.k];
          return (
            <button key={s.k} type="button" className={`sc ${s.cls}`} onClick={() => go(s.href)}>
              <span className={`node ${n ? "on" : ""}`}><StepIcon k={s.k} /></span>
              <span className="nm"><small>{s.verb}</small>{s.name}</span>
              <span className="hm-row"><em>{u} <b>{n == null ? "—" : n}</b>{d ? ` / ${d}` : ""}</em><span className="hm-meter"><i style={{ width: `${n == null ? 0 : p}%` }} /></span></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* 単元：コース・演習・案件の進み。5つまで出して、多いときは「もっと見る」 */
const LIMIT = 5;
function Topics({ topics, courses, drills, cases, premium, go }) {
  const [open, setOpen] = useState(false);
  const known = new Set(topics.map(t => t.id));
  const hasOther = [...courses, ...drills, ...cases].some(x => !known.has(x.topic));
  const all = [...topics, ...(hasOther ? [OTHER_TOPIC] : [])];
  const isLocked = t => !!t.premium && !premium;
  const list = [...all.filter(t => !isLocked(t)), ...all.filter(isLocked)];
  const shown = open || list.length <= LIMIT + 1 ? list : list.slice(0, LIMIT);
  const pick = (arr, t) => (t.id === OTHER_TOPIC.id ? arr.filter(x => !known.has(x.topic)) : arr.filter(x => x.topic === t.id));
  return (
    <section className="hm-topics" aria-label="単元から選ぶ">
      <div className="hm-sec"><h2>単元から選ぶ</h2><span className="r">{list.length}単元</span></div>
      <div className="trows">
        {shown.map(t => {
          if (isLocked(t)) return (
            <button key={t.id} type="button" className="hm-tr locked" onClick={() => go(`#/topics/${t.id}`)}>
              <TopicIcon topic={t} size={40} /><span className="hd">{t.sub && <small>{t.sub}</small>}<b>{t.name}</b></span>
              <span className="lk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>{planLabel()}プランで利用できます</span>
              <span className="gt" aria-hidden="true">→</span>
            </button>
          );
          const cs = pick(courses, t), ds = pick(drills, t), xs = pick(cases, t);
          const m = [["s1", "コース", cs.filter(c => c.completed).length, cs.length], ["s2", "演習", ds.filter(d => d.cleared).length, ds.length], ["s3", "案件", xs.filter(x => x.status === "approved").length, xs.length]];
          return (
            <button key={t.id} type="button" className="hm-tr" onClick={() => go(`#/topics/${t.id}`)}>
              <TopicIcon topic={t} size={40} /><span className="hd">{t.sub && <small>{t.sub}</small>}<b>{t.name}</b></span>
              <span className="ms3">{m.map(([c, l, d, n]) => (
                <span key={l} className={`m1 ${c} ${n ? "" : "none"}`}><span><b>{l}</b><em>{n ? `${d} / ${n}` : "—"}</em></span><span className="hm-meter"><i style={{ width: `${pct(d, n)}%` }} /></span></span>
              ))}</span>
              <span className="gt" aria-hidden="true">→</span>
            </button>
          );
        })}
        {list.length > LIMIT + 1 && <button type="button" className="hm-tr more" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? "閉じる" : `もっと見る（ほか ${list.length - LIMIT} 単元）`}</button>}
      </div>
    </section>
  );
}

/* お知らせ：新しいもの3件。押すと右から中身 */
function Notes({ notices }) {
  const items = notices?.items || [];
  const unread = items.filter(x => !x.read).length;
  return (
    <div className="hm-notes">
      <div className="nh">新着{unread > 0 && <span className="dot">{unread > 9 ? "9+" : unread}</span>}{items.length > 0 && <button type="button" className="r" onClick={() => notices.open(null)}>すべて →</button>}</div>
      {items.length ? items.slice(0, 3).map(n => (
        <button key={n.id} type="button" className="nt" onClick={() => notices.open(n.id)}>
          <span className={`tg ${n.read ? "" : "new"}`}>{n.read ? (NOTICE_KIND[n.kind] || "お知らせ") : "新着"}</span><b>{n.title}</b><small>{mdLabel(n.date)}</small>
        </button>
      )) : <p className="ne">お知らせはまだありません</p>}
      {items.length > 3 && <button type="button" className="nmore" onClick={() => notices.open(null)}>過去のお知らせ →</button>}
    </div>
  );
}
