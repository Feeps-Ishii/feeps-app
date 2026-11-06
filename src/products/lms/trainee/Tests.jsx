import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { TestTaking, normalizeCurriculumSections, normalizeTest } from "../../training/TrainingComponents.jsx";
import { emitNotificationRefresh, testIdOf, todayStr } from "../../training/useTraining.js";
import { clearTraineeTestDraft, getActiveCourseId, getTraineeTestDraft, setActiveCourseId, takeTestFocus } from "../../../utils/common/courseContext.js";
import { Btn, Cal, Card, Chip, Hero } from "../parts/ui.jsx";
import { Icon } from "../parts/icons.jsx";

/* 受講生のテスト（モック testList2）：上に未受験のテスト（大きく）、下に受けたテストを単元ごと（テストのない単元は出さない）、
   右に点数の推移。受ける画面と結果は今の TestTaking をそのまま使う（解答の下書き・AI 採点・送信の決まりを変えないため） */

const PASS = 70;
const arr = v => (Array.isArray(v) ? v : []);
const scoreOf = r => Number(r?.officialScore ?? r?.teacherScore ?? r?.score);
const pending = r => Number(r?.needsReview) > 0 && !r?.reviewedAt;
const dateOf = r => String(r?.takenAt || r?.reviewedAt || r?.updatedAt || "").slice(0, 10);
const daysLeft = (iso, today) => Math.ceil((Date.parse(String(iso).slice(0, 10)) - Date.parse(today)) / 86400000);
const md = d => { const [, m, dd] = String(d).split("-").map(Number); return `${m}/${dd}`; };

function Due({ t, today }) {
  if (!t.dueDate) return null;
  const n = daysLeft(t.dueDate, today);
  return n < 0 ? <Chip tone="bad">{md(t.dueDate)} ・ 期限切れ</Chip> : <Chip tone={n <= 3 ? "warn" : ""}>{md(t.dueDate)} まで</Chip>;
}

export default function TraineeTests({ go, say }) {
  const today = todayStr();
  const [focus] = useState(() => takeTestFocus(true)?.testId || "");
  const [state, setState] = useState("loading");
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState({});
  const [sections, setSections] = useState([]);
  const [courseName, setCourseName] = useState("");
  const [taking, setTaking] = useState(null);
  const [opened, setOpened] = useState({});
  const [err, setErr] = useState("");
  const [key, setKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setState("loading");
    apiGet("/me/courses").then(async cs => {
      const list = arr(cs), c = list.find(x => x.courseId === getActiveCourseId()) || list[0];
      if (!c) { if (alive) { setTests([]); setState("ready"); } return; }
      setActiveCourseId(c.courseId);
      const [ts, rs, cur] = await Promise.all([apiGet(`/tests?courseId=${c.courseId}`), apiGet("/tests/me"), apiGet(`/courses/${c.courseId}/curriculum`).catch(() => null)]);
      if (!alive) return;
      setTests(arr(ts).filter(t => t.status !== "archived").map(normalizeTest));
      setResults(Object.fromEntries(arr(rs).map(r => [String(r.testId), r])));
      setSections(cur ? normalizeCurriculumSections(cur) : []);
      setCourseName(c.name || c.courseName || "");
      setState("ready");
    }).catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [key]);

  const data = useMemo(() => {
    const idx = Object.fromEntries(sections.map((s, i) => [s.id, i]));
    const rows = tests.map(t => ({ t, id: testIdOf(t), r: results[testIdOf(t)], ui: idx[t.sectionId] ?? -1 }));
    const byDue = (a, b) => String(a.t.dueDate || "9999").localeCompare(String(b.t.dueDate || "9999")) || a.ui - b.ui;
    const todo = rows.filter(x => !x.r).sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : byDue(a, b)));
    const done = rows.filter(x => x.r);
    const graded = done.filter(x => !pending(x.r));
    const seq = [...graded].sort((a, b) => dateOf(a.r).localeCompare(dateOf(b.r)));
    const avg = graded.length ? Math.round(graded.reduce((a, x) => a + scoreOf(x.r), 0) / graded.length) : null;
    const groups = [];
    done.forEach(x => {
      const k = x.ui >= 0 ? sections[x.ui].id : "other";
      let g = groups.find(y => y.k === k);
      if (!g) { g = { k, ui: x.ui, title: x.ui >= 0 ? sections[x.ui].title : "コース全体", list: [] }; groups.push(g); }
      g.list.push(x);
    });
    groups.sort((a, b) => (a.ui < 0 ? 1 : b.ui < 0 ? -1 : a.ui - b.ui));
    return { all: rows, todo, done, graded, seq, avg, pass: graded.filter(x => scoreOf(x.r) >= PASS).length, groups };
  }, [tests, results, sections, focus]);

  const start = (x, { fresh = false, saved = null } = {}) => {
    if (fresh) clearTraineeTestDraft(x.id);
    setErr(""); setTaking({ test: x.t, saved });
    window.scrollTo?.(0, 0);
  };
  const submit = async result => {
    const id = testIdOf(taking.test), isNum = typeof result === "number";
    try {
      await apiPut(`/tests/${id}/results/me`, { score: isNum ? result : result?.score, total: isNum ? 100 : result?.total, answers: isNum ? {} : result?.answers, needsReview: isNum ? 0 : result?.needsReview || 0, weakAreas: isNum ? [] : result?.weakAreas || [] });
      emitNotificationRefresh();
      return true;
    } catch (e) { setErr("テスト結果を送れませんでした。もう一度お試しください"); throw e; }
  };

  if (taking) {
    return (
      <div className="tl-take">
        {err && <div className="lms-err" role="alert">{err}</div>}
        <div className="lms-legacy">
          <TestTaking key={`${testIdOf(taking.test)}:${taking.saved ? "saved" : "take"}`} test={taking.test} savedResult={taking.saved} back={() => { setTaking(null); setKey(k => k + 1); }} onDone={submit} go={v => { setTaking(null); go(v === "curriculum" ? "cur" : "test"); }} />
        </div>
      </div>
    );
  }
  if (state === "loading") return <div className="soon card">読み込み中</div>;
  if (state === "error") return <Card><div className="empty"><b>テストを確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card>;

  const { all, todo, done, graded, seq, avg, pass, groups } = data, nx = todo[0];
  const recent = seq.slice(-10);
  const lastK = groups[groups.length - 1]?.k;
  const label = x => (getTraineeTestDraft(x.id) ? "続きから" : "受ける");
  // 始める時刻の前は受けられない（教室で講師が始める）
  const before = x => (x.t.startAt && new Date(x.t.startAt) > new Date() ? x.t.startAt : "");
  const startLabel = x => { const b = before(x); return b ? `${md(b.slice(0, 10))} ${b.slice(11)} から` : label(x); };
  const unitLine = x => (x.ui >= 0 ? `単元 ${x.ui + 1} ・ ${sections[x.ui].title}` : "コース全体");

  return (
    <div className="th tl">
      <div className="th-top">
        <div><div className="eyebrow">{courseName}</div><h1 className="h1">テスト</h1></div>
        <div className="th-att">
          <span className="th-pill ok"><i aria-hidden="true" />受けた <b>{done.length} / {all.length}</b></span>
          <span className="th-pill"><i aria-hidden="true" style={{ background: "var(--tst-d)" }} />平均 <b>{avg ?? "—"}</b> 点</span>
        </div>
      </div>
      <div className="tc-grid">
        <div className="tc-l">
          {nx
            ? (
              <Hero cat="tst" art="tst" eyebrow="未受験のテスト" step={nx.t.dueDate ? (daysLeft(nx.t.dueDate, today) < 0 ? "期限切れ" : `あと ${daysLeft(nx.t.dueDate, today)} 日`) : undefined} title={nx.t.title || nx.t.name} sub={unitLine(nx)}>
                <div className="row"><Btn kind="big" disabled={!!before(nx)} onClick={() => start(nx)}>{startLabel(nx)}</Btn>{nx.ui >= 0 && <Btn kind="ghost big th-ghost" onClick={() => go("cur")}>単元を見る</Btn>}</div>
                <div className="row th-chips"><Chip>{nx.t.q} 問</Chip>{Number(nx.t.limitMinutes) > 0 && <Chip>目安 {nx.t.limitMinutes} 分</Chip>}<Due t={nx.t} today={today} /><Chip>合格は {PASS} 点</Chip></div>
                {todo.length > 1 && (
                  <div className="tl-more">
                    <span className="eyebrow">ほかの未受験テスト {todo.length - 1}</span>
                    {todo.slice(1).map(x => (
                      <div key={x.id}>
                        <span className="tl-mb"><b>{x.t.title || x.t.name}</b><small>{x.ui >= 0 ? `単元 ${x.ui + 1} ・ ` : ""}{x.t.q} 問{Number(x.t.limitMinutes) > 0 ? ` ・ 目安 ${x.t.limitMinutes} 分` : ""}</small></span>
                        <span className="tl-md"><Due t={x.t} today={today} /></span>
                        <Btn kind="ghost sm" disabled={!!before(x)} onClick={() => start(x)}>{startLabel(x)}</Btn>
                      </div>
                    ))}
                  </div>
                )}
              </Hero>
            )
            : <Hero cat="rep" eyebrow="未受験のテスト" title="なし" sub="次回の出題待ち" />}

          {done.length > 0 && (
            <Card className="pad tl-res">
              <div className="head"><h2 className="h2">受けたテスト</h2><span className="r"><Chip tone="ok">合格 {pass} / {graded.length}</Chip></span></div>
              {groups.map(g => {
                const op = opened[g.k] ?? (g.k === lastK || g.list.some(x => x.id === focus));
                const gr = g.list.filter(x => !pending(x.r)), av = gr.length ? Math.round(gr.reduce((a, x) => a + scoreOf(x.r), 0) / gr.length) : null, ps = gr.filter(x => scoreOf(x.r) >= PASS).length;
                return (
                  <div key={g.k} className={`tl-u${op ? " op" : ""}`}>
                    <button type="button" className="tl-uh" aria-expanded={op} onClick={() => setOpened(m => ({ ...m, [g.k]: !op }))}>
                      <span className="eyebrow">{g.ui >= 0 ? `単元 ${g.ui + 1}` : "全体"}</span><b>{g.title}</b>
                      <span className="tl-us">
                        <span>{g.list.length} 回</span>
                        <span>平均 <b className="num">{av ?? "—"}</b></span>
                        <span className={ps < gr.length ? "ng" : ""}>合格 <b className="num">{ps} / {gr.length}</b></span>
                        <i aria-hidden="true" className={op ? "up" : ""}><Icon k="down" size={14} /></i>
                      </span>
                    </button>
                    {op && g.list.map(x => {
                      const wait = pending(x.r), sc = scoreOf(x.r), ok = sc >= PASS, d = dateOf(x.r);
                      return (
                        <div key={x.id} className={`tl-r ${wait ? "" : ok ? "ok" : "ng"}`}>
                          {d ? <Cal date={md(d)} year={Number(d.slice(0, 4))} cat={wait ? "gy" : ok ? "rep" : "dev"} /> : <span className="cal c-gy tc-noday"><Icon k="test" size={18} /></span>}
                          <span className="tl-rb"><b>{x.t.title || x.t.name}</b><small>{x.t.q} 問</small></span>
                          <span className="tl-sc"><b className="num">{wait ? "—" : sc}</b><small>点</small></span>
                          {wait ? <Chip>採点待ち</Chip> : <Chip tone={ok ? "ok" : "bad"}>{ok ? "合格" : "不合格"}</Chip>}
                          <span className="tl-ra">
                            <Btn kind="ghost sm" onClick={() => start(x, { saved: x.r })}>振り返る</Btn>
                            <Btn kind={ok || wait ? "ghost sm" : "sm"} onClick={() => start(x, { fresh: true })}>もう一度受ける</Btn>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </Card>
          )}
        </div>

        <Card className="pad tl-side">
          <div className="head"><h2 className="h2">点数の推移</h2><span className="r"><span className="tl-lg"><i aria-hidden="true" />合格 {PASS} 点</span></span></div>
          {seq.length > 10 && <span className="tl-rc">最近の 10 回 ・ 全 {seq.length} 回</span>}
          <div className="tl-avg">
            <span><small>平均</small><b className="num">{avg ?? "—"}</b><em>点</em></span>
            <span><small>合格</small><b className="num">{pass}</b><em>/ {graded.length}</em></span>
          </div>
          {recent.length > 0
            ? (
              <div className="tl-ch" role="img" aria-label={recent.map(x => `${x.t.title} ${scoreOf(x.r)}点`).join("、")}>
                <div className="tl-pl">
                  <i className="tl-th" style={{ bottom: PASS / 100 * 120 }} aria-hidden="true" />
                  {recent.map(x => <span key={x.id} className={`tl-b${scoreOf(x.r) >= PASS ? "" : " ng"}`} style={{ height: Math.min(scoreOf(x.r), 100) / 100 * 120 }} title={`${x.t.title} ${scoreOf(x.r)}点`} />)}
                </div>
                <div className="tl-xl">{recent.map(x => <span key={x.id} className={scoreOf(x.r) >= PASS ? "" : "ng"}><b className="num">{scoreOf(x.r)}</b><small className="num">{dateOf(x.r) ? md(dateOf(x.r)) : ""}</small></span>)}</div>
              </div>
            )
            : <div className="th-none"><Chip>なし</Chip></div>}
        </Card>
      </div>
    </div>
  );
}
