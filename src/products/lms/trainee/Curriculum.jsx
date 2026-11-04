import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../../../api.js";
import { normalizeCurriculumSections } from "../../training/TrainingComponents.jsx";
import { setPracticeFocus, usePracticeLinks } from "../../training/practiceLinks.js";
import { testIdOf, todayStr } from "../../training/useTraining.js";
import { getActiveCourseId, setActiveCourseId, setLibraryTarget, setTestFocus } from "../../../utils/common/courseContext.js";
import { Btn, Cal, Card, Chip } from "../parts/ui.jsx";
import { Icon } from "../parts/icons.jsx";

/* 受講生のカリキュラム（モック curT2）：単元の札を横に並べ（開いたときは今日の単元を真ん中に。押しても並びは動かさない）、
   左に単元の見出し・目標・日ごと・演習、右にこの単元で使うもの（資料・テスト・練習問題・フォルダ） */

const arr = v => (Array.isArray(v) ? v : []);
const daysOf = s => arr(s?.chapters).flatMap(c => arr(c.lessons));
const dk = v => String(v || "").slice(0, 10);
const isD = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
const rangeOf = s => {
  const own = isD(dk(s.startDate));
  const ds = (own ? [s] : daysOf(s)).flatMap(x => [dk(x.startDate), dk(x.endDate || x.startDate)]).filter(isD).sort();
  return ds.length ? { start: ds[0], end: ds[ds.length - 1] } : null;
};
const md = d => { const [, m, dd] = d.split("-").map(Number); return `${m}/${dd}`; };
const rangeLabel = r => (r ? (r.start === r.end ? md(r.start) : `${md(r.start)}〜${md(r.end)}`) : "");
const stateOf = (s, today) => { const r = rangeOf(s); if (!r) return ""; return r.start <= today && today <= r.end ? "today" : r.end < today ? "done" : ""; };
const CAT = { done: "rep", today: "cur", "": "gy" };
const uniq = list => [...new Set(list.filter(Boolean))];
const EX_TYPE = { hands_on: "実技", individual: "個人演習", team: "チーム演習", submission: "提出" };
const fmtEx = v => String(v || "").replace(/\r\n?/g, "\n").replace(/([^\n])\s*(?=[(（]\d+[)）]|[①-⑳])/g, "$1\n").trim();

function testChip(r, known) {
  if (!known) return null;
  if (!r) return <Chip tone="warn">未受験</Chip>;
  if (Number(r.needsReview) > 0 && !r.reviewedAt) return <Chip>採点待ち</Chip>;
  const sc = Number(r.officialScore ?? r.score);
  return sc < 70 ? <Chip tone="bad">{sc} 点 ・ 再受験</Chip> : <Chip tone="ok">{sc} 点 ・ 合格</Chip>;
}

function Exercise({ e, no }) {
  const [open, setOpen] = useState(false);
  const [ans, setAns] = useState(false);
  return (
    <div className={`tc-ex${open ? " on" : ""}`}>
      <button type="button" className="tc-exh" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <b>{e.title || `演習 ${no}`}</b>
        <Chip tone="blue">{EX_TYPE[e.type] || "演習"}</Chip>
        {e.estimatedMinutes !== "" && e.estimatedMinutes != null && <Chip>目安 {e.estimatedMinutes} 分</Chip>}
        <span className={`tc-cv${open ? " on" : ""}`}><Icon k="down" size={15} /></span>
      </button>
      {open && (
        <div className="tc-exb">
          {e.instructions && <div><span className="eyebrow">問題</span><p>{fmtEx(e.instructions)}</p></div>}
          {e.completionCriteria && <div><span className="eyebrow">完了条件</span><p>{fmtEx(e.completionCriteria)}</p></div>}
          {e.answerExample && (
            <div>
              <Btn kind="ghost sm" onClick={() => setAns(v => !v)}>{ans ? "解答例を閉じる" : "解答例を見る"}</Btn>
              {ans && <p className="tc-ans">{fmtEx(e.answerExample)}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Day({ d, no, today, onMat, mats }) {
  const [open, setOpen] = useState(false);
  const start = dk(d.startDate), tdy = !!start && start <= today && today <= dk(d.endDate || d.startDate), past = !!start && dk(d.endDate || d.startDate) < today;
  const list = uniq([...arr(d.materialIds), d.materialId]).filter(m => mats[m]);
  return (
    <li className={tdy ? "tdy" : past ? "past" : "fut"}>
      {isD(start) ? <Cal date={md(start)} year={Number(start.slice(0, 4))} cat={tdy ? "cur" : past ? "rep" : "gy"} /> : <span className="cal c-gy tc-noday"><b>{no}</b></span>}
      <span className="tc-dt">
        <span className="tc-dn num">{no} 日目</span>
        <b>{d.title || "—"}</b>
        {d.content && <button type="button" className="tc-more" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? "閉じる" : "内容"}</button>}
        {open && <span className="tc-dc">{d.content}</span>}
      </span>
      <span className="tc-da">
        {tdy && <em>今日</em>}
        {past && !tdy && <span className="tc-ok" aria-label="済">✓</span>}
        {list.map((m, i) => <Btn key={m} kind={tdy && i === 0 ? "sm" : "ghost sm"} title={mats[m].title} onClick={() => onMat(m)}>{list.length > 1 ? mats[m].title : "資料を開く"}</Btn>)}
      </span>
    </li>
  );
}

export default function TraineeCurriculum({ go }) {
  const today = todayStr();
  const [courseId, setCourseId] = useState("");
  const [state, setState] = useState("loading");
  const [sections, setSections] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [tests, setTests] = useState(null);
  const [results, setResults] = useState(null);
  const [sel, setSel] = useState("");
  const [courseName, setCourseName] = useState("");
  const [err, setErr] = useState("");
  const [key, setKey] = useState(0);
  const road = useRef(null);
  const centered = useRef(false);
  const [edge, setEdge] = useState({ l: false, r: false });
  const practiceFor = usePracticeLinks(courseId);

  useEffect(() => {
    let alive = true;
    setState("loading");
    apiGet("/me/courses").then(async list => {
      const cs = arr(list), active = getActiveCourseId(), c = cs.find(x => x.courseId === active) || cs[0];
      if (!c) { if (alive) { setSections([]); setState("ready"); } return; }
      setActiveCourseId(c.courseId);
      const item = await apiGet(`/courses/${c.courseId}/curriculum`);
      if (!alive) return;
      const next = normalizeCurriculumSections(item);
      setCourseId(c.courseId); setCourseName(c.name || c.courseName || ""); setSections(next);
      const i = next.findIndex(s => stateOf(s, today) === "today");
      const j = i >= 0 ? i : next.findIndex(s => { const r = rangeOf(s); return r && r.start >= today; });
      setSel(next[j >= 0 ? j : 0]?.id || "");
      setState("ready");
      apiGet(`/materials?courseId=${c.courseId}`).then(l => { if (alive) setMaterials(arr(l)); }).catch(() => { if (alive) setMaterials([]); });
      apiGet(`/tests?courseId=${c.courseId}`).then(l => { if (alive) setTests(arr(l).filter(t => t.status !== "archived")); }).catch(() => { if (alive) setTests(null); });
      apiGet("/tests/me").then(rows => { if (alive) setResults(Object.fromEntries(arr(rows).map(r => [String(r.testId), r]))); }).catch(() => { if (alive) setResults(null); });
    }).catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [key, today]);

  const mats = useMemo(() => Object.fromEntries(materials.map(m => [m.materialId, m])), [materials]);
  const unit = sections.find(s => s.id === sel) || sections[0];

  const syncEdge = useCallback(() => { const r = road.current; if (r) setEdge({ l: r.scrollLeft > 4, r: r.scrollLeft + r.clientWidth < r.scrollWidth - 4 }); }, []);
  // 開いたときだけ今日の単元を真ん中に（押しても並びは動かさない）
  useLayoutEffect(() => {
    const r = road.current; if (!r || centered.current || !sections.length) return;
    const on = r.querySelector(".tc-u.on");
    if (on) { r.scrollLeft = on.offsetLeft - r.offsetLeft - (r.clientWidth - on.clientWidth) / 2; centered.current = true; }
    syncEdge();
  }, [sections, sel, syncEdge]);

  const openMat = async id => {
    const tab = window.open("", "_blank");
    try {
      const r = await apiGet(`/materials/view?courseId=${courseId}&materialId=${id}`);
      if (tab) tab.location.href = r.url; else window.open(r.url, "_blank");
    } catch { if (tab) tab.close(); setErr("資料を開けませんでした"); }
  };

  if (state === "loading") return <div className="soon card">読み込み中</div>;
  if (state === "error") return <Card><div className="empty"><b>カリキュラムを確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card>;
  if (!unit) return <Card><div className="empty"><b>カリキュラム</b><Chip>準備中</Chip></div></Card>;

  const ui = sections.indexOf(unit), st0 = stateOf(unit, today), cat = CAT[st0];
  const uDays = daysOf(unit);
  const passed = uDays.filter(d => isD(dk(d.startDate)) && dk(d.startDate) <= today).length;
  const allDays = sections.flatMap(daysOf).filter(d => isD(dk(d.startDate)));
  const allPassed = allDays.filter(d => dk(d.startDate) <= today).length;
  const doneN = sections.filter(s => stateOf(s, today) === "done").length;
  const goals = uniq([...arr(unit.learningGoals), ...uDays.flatMap(d => arr(d.learningGoals))]);
  const prep = uniq([...arr(unit.preparationItems), ...uDays.flatMap(d => arr(d.preparationItems))]);
  const exercises = [...arr(unit.exercises), ...uDays.flatMap(d => arr(d.exercises))];
  const unitMats = uniq(arr(unit.materialIds)).filter(m => mats[m]);
  const seen = new Set();
  const folders = [...arr(unit.folderLinks), ...uDays.flatMap(d => arr(d.folderLinks))].filter(f => f.nodeId && !seen.has(f.nodeId) && seen.add(f.nodeId));
  const unitTests = (tests || []).filter(t => t.sectionId && t.sectionId === unit.id);
  const practice = practiceFor(unit.id);
  const body = [unit.description, unit.content].filter(Boolean);
  const scrollBy = n => { const r = road.current; if (r) r.scrollBy({ left: n * Math.max(240, r.clientWidth * 0.7), behavior: "smooth" }); };
  const hasUse = unitMats.length || folders.length || unitTests.length || practice.length || prep.length;

  return (
    <div className="th tc">
      <div className="th-top">
        <div><div className="eyebrow">{courseName}</div><h1 className="h1">カリキュラム</h1></div>
        <div className="th-att">
          <span className="th-pill ok"><i aria-hidden="true" />単元 <b>{doneN} / {sections.length}</b> 済</span>
          {allDays.length > 0 && <span className="th-pill"><i aria-hidden="true" style={{ background: "var(--cur-d)" }} />研修 <b>{allPassed} / {allDays.length}</b> 日目</span>}
        </div>
      </div>

      <div className="tc-rw">
        {edge.l && <button type="button" className="tc-nav l" aria-label="前の単元を見る" onClick={() => scrollBy(-1)}><Icon k="right" size={16} className="flip" /></button>}
        <div className="tc-road" role="tablist" aria-label="単元" ref={road} onScroll={syncEdge}>
          {sections.map((s, i) => {
            const k = stateOf(s, today), r = rangeOf(s), ds = daysOf(s), n = ds.filter(d => isD(dk(d.startDate)) && dk(d.startDate) <= today).length;
            return (
              <button key={s.id} type="button" role="tab" aria-selected={s.id === unit.id} className={`tc-u c-${CAT[k]}${s.id === unit.id ? " on" : ""}`} onClick={() => setSel(s.id)}>
                <span className="tc-ut"><span className="tc-un num">{i + 1}</span><span className="tc-ub">{k === "done" ? "✓ 済" : k === "today" ? "今日" : "これから"}</span></span>
                <b>{s.title}</b>
                <small>{rangeLabel(r)}{ds.length ? ` ・ ${ds.length} 日` : ""}</small>
                <span className="tc-ubar"><i style={{ "--w": `${k === "done" ? 100 : ds.length ? Math.round(n / ds.length * 100) : 0}%` }} /></span>
              </button>
            );
          })}
        </div>
        {edge.r && <button type="button" className="tc-nav r" aria-label="次の単元を見る" onClick={() => scrollBy(1)}><Icon k="right" size={16} /></button>}
      </div>

      {err && <div className="lms-err" role="alert">{err}</div>}
      <div className="tc-grid">
        <div className="tc-l">
          <section className={`hero c-${cat}`}>
            <div className="hero-h"><span className="eyebrow">単元 {ui + 1}{rangeOf(unit) ? ` ・ ${rangeLabel(rangeOf(unit))}` : ""}</span>{uDays.length > 0 && <span className="hero-step">{passed} / {uDays.length} 日</span>}</div>
            <h2 className="hero-t">{unit.title}</h2>
            {body.map((t, i) => <p key={i} className="hero-s tc-body">{t}</p>)}
            {goals.length > 0 && (
              <div className="tc-goals">
                <span className="eyebrow">この単元の目標</span>
                {goals.map(g => <span key={g}><i aria-hidden="true">{st0 === "done" ? "✓" : ""}</i>{g}</span>)}
              </div>
            )}
          </section>
          {uDays.length > 0 && (
            <Card className="pad">
              <div className="head"><h2 className="h2">日ごと</h2><span className="r"><Chip>{uDays.length} 日</Chip></span></div>
              <ol className="tc-days">{uDays.map((d, i) => <Day key={d.id || i} d={d} no={i + 1} today={today} mats={mats} onMat={openMat} />)}</ol>
            </Card>
          )}
          {exercises.length > 0 && (
            <Card className="pad">
              <div className="head"><h2 className="h2">演習</h2><span className="r"><Chip>{exercises.length}</Chip></span></div>
              <div className="tc-exl">{exercises.map((e, i) => <Exercise key={e.id || i} e={e} no={i + 1} />)}</div>
            </Card>
          )}
        </div>
        <Card className="pad tc-uc">
          <div className="head"><h2 className="h2">この単元で使うもの</h2></div>
          <div className="tc-rl">
            {unitMats.map(m => (
              <div key={m} className="tc-r c-cur"><span className="tc-ri"><Icon k="report" size={19} /></span><span className="tc-rb"><span className="eyebrow">資料</span><b>{mats[m].title}</b></span><Btn kind="ghost sm" onClick={() => openMat(m)}>開く</Btn></div>
            ))}
            {practice.map(p => (
              <div key={`${p.setId}:${p.no}`} className="tc-r c-tst"><span className="tc-ri"><Icon k="prac" size={19} /></span><span className="tc-rb"><span className="eyebrow">練習問題</span><b>{p.title || "練習問題"}</b><small>{p.label}</small></span><Btn kind="sm" onClick={() => { setPracticeFocus({ courseId, setId: p.setId, qid: p.firstQ }); go("prac"); }}>解く</Btn></div>
            ))}
            {unitTests.map(t => {
              const id = testIdOf(t), r = results?.[id];
              return (
                <div key={id} className="tc-r c-tst"><span className="tc-ri"><Icon k="test" size={19} /></span><span className="tc-rb"><span className="eyebrow">テスト</span><b>{t.title || t.name}</b><span>{testChip(r, results !== null)}</span></span>
                  <Btn kind={r ? "ghost sm" : "sm"} onClick={() => { setTestFocus({ courseId, testId: id }); go("test"); }}>{r ? "結果を見る" : "受ける"}</Btn></div>
              );
            })}
            {folders.map(f => (
              <div key={f.nodeId} className="tc-r c-gy"><span className="tc-ri"><Icon k="doc" size={19} /></span><span className="tc-rb"><span className="eyebrow">フォルダ</span><b>{f.name || "フォルダ"}</b></span><Btn kind="ghost sm" onClick={() => { setLibraryTarget({ courseId, nodeId: f.nodeId }); go("doc"); }}>開く</Btn></div>
            ))}
            {prep.length > 0 && (
              <div className="tc-r tc-pre c-att"><span className="tc-rb"><span className="eyebrow">事前の準備</span>{prep.map(x => <small key={x}>{x}</small>)}</span></div>
            )}
            {!hasUse && <div className="th-none"><Chip>なし</Chip></div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
