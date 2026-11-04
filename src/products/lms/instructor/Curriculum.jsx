import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../../api.js";
import { Curriculum as LegacyCurriculum, normalizeCurriculumSections } from "../../training/TrainingComponents.jsx";
import { setPracticeFocus, usePracticeLinks } from "../../training/practiceLinks.js";
import { testIdOf, todayStr } from "../../training/useTraining.js";
import { setLibraryTarget, setTestBuildTarget } from "../../../utils/common/courseContext.js";
import { Btn, Card, Chip, Modal, weekday } from "../parts/ui.jsx";
import { LMS_LEGACY } from "../LmsCatalog.js";
import { arr, md, useStaffCourse } from "../staff/common.js";

/* 講師のカリキュラム（モック curS の読むところ）：単元を 1 から順に、開くと目標・単元を通して・日ごと。
   テスト・フォルダ・練習問題へはそのまま移る。編集は今の画面を中に出す（Excel の取り込み・演習の AI・資料のアップロードをそのまま使うため） */

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

export default function InstructorCurriculum({ role, go }) {
  const today = todayStr();
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const [st, setSt] = useState({ state: "loading", sections: [], tests: null, materials: [] });
  const [open, setOpen] = useState({});
  const [edit, setEdit] = useState(false);
  const [leaving, setLeaving] = useState(false);
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
  // 今の画面からの移動（カリキュラムの中のボタン）を新しい画面のキーへ
  const legacyGo = v => { const k = Object.entries(LMS_LEGACY[role] || {}).find(([, lv]) => lv === v)?.[0]; if (k) go(k); };

  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!courseId) return <Card><div className="empty"><b>担当のコース</b><Chip>なし</Chip></div></Card>;
  if (edit) {
    return (
      <div className="st">
        <div className="head"><div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">カリキュラムの編集</h1></div><span className="r"><Btn kind="ghost sm" onClick={() => setLeaving(true)}>編集を終える</Btn></span></div>
        <div className="lms-legacy"><LegacyCurriculum role={role} go={legacyGo} /></div>
        {leaving && <Modal title="編集を終える" width={420} onClose={() => setLeaving(false)} footer={<><Btn kind="ghost" onClick={() => setLeaving(false)}>編集に戻る</Btn><Btn onClick={() => { setLeaving(false); setEdit(false); setKey(k => k + 1); }}>終える</Btn></>}><Chip tone="warn">保存していない変更は消えます</Chip></Modal>}
      </div>
    );
  }
  if (st.state === "error") return <Card><div className="empty"><b>カリキュラムを確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card>;
  if (st.state === "loading") return <div className="soon card">読み込み中</div>;

  const openMat = async id => {
    setErr("");
    const tab = window.open("", "_blank");
    try { const r = await apiGet(`/materials/view?courseId=${encodeURIComponent(courseId)}&materialId=${encodeURIComponent(id)}`); if (tab) tab.location.href = r.url; else window.open(r.url, "_blank"); }
    catch { if (tab) tab.close(); setErr("資料を開けませんでした"); }
  };
  const toTest = t => { setTestBuildTarget({ courseId, testId: testIdOf(t), results: true }); go("test"); };
  const toFolder = id => { setLibraryTarget({ courseId, nodeId: id }); go("doc"); };
  const testChips = list => list.map(t => <button key={testIdOf(t)} type="button" className="cu-i test" onClick={() => toTest(t)}><span>{t.title}</span><em>{t.status === "published" ? "公開" : "下書き"}</em></button>);
  const matChips = ids => ids.filter(id => mats[id]).map(id => <button key={id} type="button" className="cu-i" onClick={() => openMat(id)}><span>{mats[id].title || mats[id].filename}</span></button>);
  const allOpen = st.sections.length > 0 && st.sections.every(s => open[s.id]);

  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">カリキュラム</h1></div>
        <span className="r">{st.sections.length > 0 && <Btn kind="ghost sm" onClick={() => setOpen(allOpen ? {} : Object.fromEntries(st.sections.map(s => [s.id, true])))}>{allOpen ? "すべて閉じる" : "すべて開く"}</Btn>}<Btn kind="sm" onClick={() => setEdit(true)}>編集する</Btn></span>
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
                      {practice.map(p => <button key={`${p.setId}:${p.no}`} type="button" className="cu-i prac" onClick={() => { setPracticeFocus({ courseId, setId: p.setId, qid: p.firstQ }); go("prac"); }}><span>{p.title}</span></button>)}
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
    </div>
  );
}
