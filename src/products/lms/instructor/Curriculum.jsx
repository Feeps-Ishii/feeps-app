import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { relayoutCurriculum } from "../../console/materials.js";
import { normalizeCurriculumSections } from "../../training/TrainingComponents.jsx";
import { setPracticeFocus, usePracticeLinks } from "../../training/practiceLinks.js";
import { testIdOf, todayStr } from "../../training/useTraining.js";
import { setLibraryTarget, setTestBuildTarget } from "../../../utils/common/courseContext.js";
import { Btn, Card, Chip, Modal, weekday } from "../parts/ui.jsx";
import { errText } from "../staff/common.js";
import CurriculumEdit from "./CurriculumEdit.jsx";
import CurriculumShelf from "../admin/CurriculumShelf.jsx";
import { arr, md, useStaffCourse } from "../staff/common.js";

/* カリキュラム（講師・管理者。モック curS の読むところ）：単元を 1 から順に、開くと目標・単元を通して・日ごと。
   テスト・フォルダ・練習問題へはそのまま移る。編集は CurriculumEdit.jsx。管理者はコースごと（上のコースの切り替え） */

const dk = v => String(v || "").slice(0, 10);
const isD = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
const uniq = l => [...new Set(l.filter(Boolean))];
const daysOf = s => arr(s?.chapters).flatMap(c => arr(c.lessons));
const rangeOf = s => {
  const ds = (isD(dk(s.startDate)) ? [s] : daysOf(s)).flatMap(x => [dk(x.startDate), dk(x.endDate || x.startDate)]).filter(isD).sort();
  return ds.length ? { start: ds[0], end: ds[ds.length - 1] } : null;
};
const stateOf = (s, today) => { const r = rangeOf(s); return !r ? "" : r.start <= today && today <= r.end ? "now" : r.end < today ? "done" : ""; };
const wd = d => { const [y, m, dd] = d.split("-").map(Number); return weekday(m, dd, y); };

// 別のコースに写す（to あり）・日程を並べ直す（to なし）。平日で数え直す（祝日は見ない）
function Relayout({ course, courses, onClose, onDone }) {
  const others = courses.filter(c => c.courseId !== course.courseId);
  const copy = courses.length > 0;
  const [to, setTo] = useState(others[0]?.courseId || "");
  const dest = copy ? others.find(c => c.courseId === to) : course;
  const [start, setStart] = useState((dest?.startDate || "").slice(0, 10));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { if (copy) setStart((others.find(c => c.courseId === to)?.startDate || "").slice(0, 10)); }, [to]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async () => {
    if (!start) { setErr("始まりの日を入れてください"); return; }
    setBusy(true); setErr("");
    try {
      const src = await apiGet(`/courses/${encodeURIComponent(course.courseId)}/curriculum`);
      const plan = relayoutCurriculum(src, start);
      await apiPut(`/courses/${encodeURIComponent(dest.courseId)}/curriculum`, { sections: plan.sections, sessions: plan.sessions });
      onDone(plan, dest);
    } catch (e) { setErr(errText(e, "保存できませんでした")); setBusy(false); }
  };
  return (
    <Modal title={copy ? "別のコースに写す" : "日程を並べ直す"} width={480} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy || !dest} onClick={run}>{busy ? "保存しています" : copy ? "写す" : "並べ直す"}</Btn></>}>
      {copy && (others.length ? <label className="field">写す先<select className="in" value={to} onChange={e => setTo(e.target.value)}>{others.map(c => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}</select></label> : <Chip>写せるコースなし</Chip>)}
      <label className="field">始まりの日<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
      <div className="row"><Chip tone="warn">{copy ? "写す先のカリキュラムは置き換わる" : "単元と日の日程が変わる"}</Chip><Chip>平日で数える ・ 祝日は見ない</Chip></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

export default function InstructorCurriculum({ role, go, say }) {
  const today = todayStr();
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const [st, setSt] = useState({ state: "loading", sections: [], tests: null, materials: [] });
  const [open, setOpen] = useState({});
  const [edit, setEdit] = useState(false);
  const [shelfOn, setShelfOn] = useState(false);
  const [lay, setLay] = useState("");
  const [err, setErr] = useState("");
  const [key, setKey] = useState(0);
  const practiceFor = usePracticeLinks(courseId);

  useEffect(() => {
    if (!courseId) return undefined;
    let alive = true;
    setSt(s => ({ ...s, state: "loading" }));
    apiGet(`/courses/${encodeURIComponent(courseId)}/curriculum`).then(item => {
      if (!alive) return;
      const sections = normalizeCurriculumSections(item);
      setSt(s => ({ ...s, state: "ready", sections }));
      const i = sections.findIndex(x => stateOf(x, today) === "now");
      const j = i >= 0 ? i : sections.findIndex(x => { const r = rangeOf(x); return r && r.start >= today; });
      if (j >= 0) setOpen({ [sections[j].id]: true });
    }).catch(() => { if (alive) setSt(s => ({ ...s, state: "error" })); });
    apiGet(`/tests?courseId=${encodeURIComponent(courseId)}`).then(l => { if (alive) setSt(s => ({ ...s, tests: arr(l).filter(t => t.status !== "archived") })); }).catch(() => { if (alive) setSt(s => ({ ...s, tests: null })); });
    apiGet(`/materials?courseId=${encodeURIComponent(courseId)}`).then(l => { if (alive) setSt(s => ({ ...s, materials: arr(l) })); }).catch(() => {});
    return () => { alive = false; };
  }, [courseId, key, today]);

  const mats = useMemo(() => Object.fromEntries(st.materials.map(m => [m.materialId, m])), [st.materials]);
  const keys = role === "admin" ? { test: "ltest", doc: "cdoc", prac: "lprac" } : { test: "test", doc: "doc", prac: "prac" };

  const seg = role === "admin" && <span className="seg"><button type="button" aria-pressed={!shelfOn} onClick={() => setShelfOn(false)}>コース別</button><button type="button" aria-pressed={shelfOn} onClick={() => setShelfOn(true)}>全コース共通の棚</button></span>;
  if (shelfOn) return <div className="st"><div className="head"><div><div className="eyebrow">全コース共通</div><h1 className="h1">カリキュラム</h1></div><span className="r">{seg}</span></div><CurriculumShelf say={say} go={go} /></div>;
  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!courseId) return <Card><div className="empty"><b>担当のコース</b><Chip>なし</Chip></div></Card>;
  if (edit) return <CurriculumEdit course={sc.course} go={go} keys={keys} say={say} onClose={() => { setEdit(false); setKey(k => k + 1); }} />;
  if (st.state === "error") return <Card><div className="empty"><b>カリキュラムを確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card>;
  if (st.state === "loading") return <div className="soon card">読み込み中</div>;

  const openMat = async id => {
    setErr("");
    const tab = window.open("", "_blank");
    try { const r = await apiGet(`/materials/view?courseId=${encodeURIComponent(courseId)}&materialId=${encodeURIComponent(id)}`); if (tab) tab.location.href = r.url; else window.open(r.url, "_blank"); }
    catch { if (tab) tab.close(); setErr("資料を開けませんでした"); }
  };
  const toTest = t => { setTestBuildTarget({ courseId, testId: testIdOf(t), results: true }); go(keys.test); };
  const toFolder = id => { setLibraryTarget({ courseId, nodeId: id }); go(keys.doc); };
  const testChips = list => list.map(t => <button key={testIdOf(t)} type="button" className="cu-i test" onClick={() => toTest(t)}><span>{t.title}</span><em>{t.status === "published" ? "公開" : "下書き"}</em></button>);
  const matChips = ids => ids.filter(id => mats[id]).map(id => <button key={id} type="button" className="cu-i" onClick={() => openMat(id)}><span>{mats[id].title || mats[id].filename}</span></button>);
  const allOpen = st.sections.length > 0 && st.sections.every(s => open[s.id]);

  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">カリキュラム</h1></div>
        <span className="r">{seg}{st.sections.length > 0 && <Btn kind="ghost sm" onClick={() => setOpen(allOpen ? {} : Object.fromEntries(st.sections.map(s => [s.id, true])))}>{allOpen ? "すべて閉じる" : "すべて開く"}</Btn>}{st.sections.length > 0 && <Btn kind="ghost sm" onClick={() => setLay("move")}>日程を並べ直す</Btn>}{st.sections.length > 0 && <Btn kind="ghost sm" onClick={() => setLay("copy")}>別のコースに写す</Btn>}<Btn kind="sm" onClick={() => setEdit(true)}>✎ 編集する</Btn></span>
      </div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {st.tests === null && <div className="lms-err" role="alert">テストを確認できません</div>}
      <div className="cu-list">
        {st.sections.map((s, i) => {
          const on = !!open[s.id], state = stateOf(s, today), r = rangeOf(s), days = daysOf(s);
          const ts = arr(st.tests).filter(t => t.sectionId === s.id), wholeT = ts.filter(t => !t.lessonId);
          const practice = practiceFor(s.id);
          const folders = [...arr(s.folderLinks), ...days.flatMap(d => arr(d.folderLinks))].filter((f, x, l) => f.nodeId && l.findIndex(y => y.nodeId === f.nodeId) === x);
          const secMats = uniq(arr(s.materialIds));
          const exs = [...arr(s.exercises), ...days.flatMap(d => arr(d.exercises))];
          const goals = arr(s.learningGoals);
          return (
            <section key={s.id} className={`card cu-u ${state}${on ? " on" : ""}`}>
              <button type="button" className="cu-h" aria-expanded={on} onClick={() => setOpen(o => ({ ...o, [s.id]: !o[s.id] }))}>
                <span className="cu-n num">{i + 1}</span>
                <span className="cu-t"><b>{s.title || "名称未設定"}</b><small className="num">{r ? `${md(r.start)}〜${md(r.end)}` : "日程未設定"}{days.length ? ` ・ ${days.length} 日` : ""}</small></span>
                <span className="row">{ts.length > 0 && <Chip>テスト {ts.length}</Chip>}{practice.length > 0 && <Chip>練習問題</Chip>}{state === "now" ? <Chip tone="mk">今の単元</Chip> : state === "done" ? <Chip tone="ok">済</Chip> : null}</span>
                <i className="cu-cv" aria-hidden="true">▾</i>
              </button>
              {on && (
                <div className="cu-b">
                  <div className="cu-top">
                    <div className="goalbox"><span className="eyebrow">この単元の目標</span>{goals.length ? goals.map((g, x) => <span key={x}>・{g}</span>) : <Chip>なし</Chip>}</div>
                    <div className="cu-all"><span className="eyebrow">単元を通して</span>
                      {folders.map(f => <button key={f.nodeId} type="button" className="cu-i" onClick={() => toFolder(f.nodeId)}><span className="folder" aria-hidden="true" /><span>{f.name || "フォルダ"}</span></button>)}
                      {matChips(secMats)}
                      {testChips(wholeT)}
                      {practice.map(p => <button key={`${p.setId}:${p.no}`} type="button" className="cu-i prac" onClick={() => { setPracticeFocus({ courseId, setId: p.setId, qid: p.firstQ }); go(keys.prac); }}><span>{p.title}</span></button>)}
                      {exs.length > 0 && <Chip>演習 {exs.length}</Chip>}
                      {!folders.length && !secMats.length && !wholeT.length && !practice.length && !exs.length && <Chip>なし</Chip>}
                    </div>
                  </div>
                  {days.length > 0 && (
                    <ol className="cu-days">
                      {days.map(d => {
                        const start = dk(d.startDate), end = dk(d.endDate || d.startDate), tdy = isD(start) && start <= today && today <= end, past = isD(start) && end < today;
                        const list = uniq([...arr(d.materialIds), d.materialId]);
                        const dts = ts.filter(t => t.lessonId === d.id);
                        return (
                          <li key={d.id} className={tdy ? "tdy" : past ? "past" : ""}>
                            <span className="cu-d">{isD(start) ? <><b className="num">{md(start)}</b><small>{wd(start)}</small></> : <small>未定</small>}</span>
                            <span className="cu-dt"><b>{d.title || "—"}</b>{tdy && <Chip tone="mk">今日</Chip>}{d.memo && <small className="cu-memo">講師メモ：{d.memo}</small>}</span>
                            <span className="row">{matChips(list)}{testChips(dts)}</span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              )}
            </section>
          );
        })}
        {!st.sections.length && <Card className="pad"><Chip>単元なし</Chip></Card>}
      </div>
      {lay && <Relayout course={sc.course} courses={lay === "copy" ? arr(sc.courses) : []} onClose={() => setLay("")} onDone={(plan, dest) => { setLay(""); say?.(lay === "copy" ? `${dest.name} に写しました` : "日程を並べ直しました"); setKey(k => k + 1); }} />}
    </div>
  );
}
