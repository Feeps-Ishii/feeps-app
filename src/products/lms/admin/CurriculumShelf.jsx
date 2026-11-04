import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { flattenUnitDays, makeLocalId, normalizeCurriculumSections, unitDaysOf } from "../../training/TrainingComponents.jsx";
import { testIdOf } from "../../training/useTraining.js";
import { Btn, Card, Chip, Modal } from "../parts/ui.jsx";
import { arr, errText } from "../staff/common.js";

/* 全コース共通のカリキュラム（モック lcurS）：カリキュラムごとに単元を持つ棚。コースの編集から足す。
   日付は持たない（足したあとにコースで決める）。テストはつなぐだけで、コピーしない。API は /curriculum-library */

const newUnit = () => ({ id: makeLocalId("su"), title: "", days: 1, goals: [], content: "", exercises: [], testIds: [] });
const lines = t => String(t || "").split("\n").map(v => v.trim()).filter(Boolean);

export function useShelf() {
  const [st, setSt] = useState({ state: "loading", items: [], updatedAt: "" });
  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    apiGet("/curriculum-library").then(r => { if (alive) setSt({ state: "ready", items: arr(r?.items), updatedAt: r?.updatedAt || "" }); }).catch(() => { if (alive) setSt({ state: "error", items: [], updatedAt: "" }); });
    return () => { alive = false; };
  }, [key]);
  return { ...st, reload: () => setKey(k => k + 1) };
}

// コースの編集から：棚の単元を選んでコースへ足す
export function ShelfPicker({ onClose, onPick }) {
  const shelf = useShelf();
  const [picked, setPicked] = useState({});
  const units = shelf.items.flatMap(c => arr(c.units).map(u => ({ ...u, from: c.name })));
  const sel = units.filter(u => picked[u.id]);
  return (
    <Modal title="共通の棚から足す" width={560} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={!sel.length} onClick={() => onPick(sel)}>{sel.length} 単元を足す</Btn></>}>
      {shelf.state === "error" ? <div className="empty"><b>棚を確認できません</b><Btn kind="ghost sm" onClick={shelf.reload}>再読み込み</Btn></div> : shelf.state === "loading" ? <div className="dv-mt">読み込み中</div> : (
        <div className="fs-pick">
          {shelf.items.map(c => (
            <div key={c.id} className="st-g">
              <span className="eyebrow">{c.name}</span>
              {arr(c.units).map(u => <label key={u.id} className="st-ck fs-pr"><input type="checkbox" checked={!!picked[u.id]} onChange={e => setPicked(p => ({ ...p, [u.id]: e.target.checked }))} />{u.title || "名前なし"}<small className="num"> {u.days} 日{arr(u.testIds).length ? ` ・ テスト ${u.testIds.length}` : ""}</small></label>)}
              {!arr(c.units).length && <Chip>単元なし</Chip>}
            </div>
          ))}
          {!shelf.items.length && <Chip>棚は空です</Chip>}
        </div>
      )}
      <Chip>日付はコースで決める</Chip>
    </Modal>
  );
}

function ImportModal({ courses, onClose, onPick }) {
  const [from, setFrom] = useState(courses[0]?.courseId || "");
  const [secs, setSecs] = useState(null);
  const [picked, setPicked] = useState({});
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!from) return undefined;
    let alive = true;
    setSecs(null); setErr("");
    apiGet(`/courses/${encodeURIComponent(from)}/curriculum`).then(c => { if (alive) { const s = flattenUnitDays(normalizeCurriculumSections(c)); setSecs(s); setPicked(Object.fromEntries(s.map(x => [x.id, true]))); } }).catch(() => { if (alive) { setSecs([]); setErr("カリキュラムを確認できません"); } });
    return () => { alive = false; };
  }, [from]);
  const sel = arr(secs).filter(s => picked[s.id]);
  return (
    <Modal title="コースから取り込む" width={560} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={!sel.length} onClick={() => onPick(sel.map(s => ({ ...newUnit(), title: s.title || "", days: Math.max(1, unitDaysOf(s).length), goals: arr(s.learningGoals), content: s.content || "", exercises: arr(s.exercises) })))}>{sel.length} 単元を取り込む</Btn></>}>
      <label className="field">コース<select className="in" value={from} onChange={e => setFrom(e.target.value)}>{courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}</select></label>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {secs === null ? <div className="dv-mt">読み込み中</div> : <div className="fs-pick">{secs.map(s => <label key={s.id} className="st-ck fs-pr"><input type="checkbox" checked={!!picked[s.id]} onChange={e => setPicked(p => ({ ...p, [s.id]: e.target.checked }))} />{s.title || "名前なし"}</label>)}{!secs.length && <Chip>単元なし</Chip>}</div>}
    </Modal>
  );
}

export default function CurriculumShelf({ say }) {
  const shelf = useShelf();
  const [items, setItems] = useState([]);
  const [base, setBase] = useState("[]");
  const [updatedAt, setUpdatedAt] = useState("");
  const [cur, setCur] = useState(""); const [unitId, setUnitId] = useState("");
  const [courses, setCourses] = useState([]); const [tests, setTests] = useState([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [imp, setImp] = useState(false); const [conf, setConf] = useState(null); const [goalText, setGoalText] = useState("");
  useEffect(() => { if (shelf.state === "ready") { setItems(shelf.items); setBase(JSON.stringify(shelf.items)); setUpdatedAt(shelf.updatedAt); setCur(c => c || shelf.items[0]?.id || ""); } }, [shelf.state, shelf.items, shelf.updatedAt]);
  useEffect(() => {
    apiGet("/completion-report/courses").then(r => setCourses(arr(r?.courses))).catch(() => {});
    apiGet("/tests").then(l => setTests(arr(l).filter(t => t.status !== "archived"))).catch(() => {});
  }, []);
  const K = items.find(x => x.id === cur) || null, U = arr(K?.units).find(u => u.id === unitId) || null;
  const dirty = JSON.stringify(items) !== base;
  useEffect(() => { setGoalText(arr(U?.goals).join("\n")); }, [unitId]); // eslint-disable-line react-hooks/exhaustive-deps
  const setK = patch => setItems(l => l.map(x => (x.id === cur ? { ...x, ...patch } : x)));
  const setU = patch => setK({ units: arr(K.units).map(u => (u.id === unitId ? { ...u, ...patch } : u)) });
  const testName = useMemo(() => Object.fromEntries(tests.map(t => [testIdOf(t), t.title])), [tests]);
  const save = async () => {
    setBusy(true); setErr("");
    try { const r = await apiPut("/curriculum-library", { items, expectedUpdatedAt: updatedAt }); setItems(arr(r.items)); setBase(JSON.stringify(arr(r.items))); setUpdatedAt(r.updatedAt || ""); say?.("保存しました"); }
    catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(false); }
  };
  if (shelf.state === "loading") return <div className="soon card">読み込み中</div>;
  if (shelf.state === "error") return <Card><div className="empty"><b>棚を確認できません</b><Btn kind="ghost sm" onClick={shelf.reload}>再読み込み</Btn></div></Card>;
  const add = () => { const k = { id: makeLocalId("sc"), name: "新しいカリキュラム", note: "", units: [] }; setItems(l => [...l, k]); setCur(k.id); setUnitId(""); };
  return (
    <>
      <div className="row"><Btn kind="ghost sm" onClick={add}>＋ カリキュラム</Btn>{K && <Btn kind="ghost sm" onClick={() => { const u = newUnit(); setK({ units: [...arr(K.units), u] }); setUnitId(u.id); }}>＋ 単元</Btn>}{K && <Btn kind="ghost sm" disabled={!courses.length} onClick={() => setImp(true)}>コースから取り込む</Btn>}<span className="sx-sp" />{dirty && <Chip tone="warn">保存していない変更</Chip>}<Btn kind="sm" disabled={!dirty || busy} onClick={save}>{busy ? "保存しています" : "保存"}</Btn></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      <div className="fsw">
        <nav className="card fs-tree" aria-label="カリキュラム">
          {items.map(k => (
            <React.Fragment key={k.id}>
              <button type="button" className="fs-n" aria-current={cur === k.id && !unitId} onClick={() => { setCur(k.id); setUnitId(""); }}><span>{k.name || "名前なし"}</span><em className="num">{arr(k.units).length}</em></button>
              {cur === k.id && arr(k.units).length > 0 && <div className="fs-kids">{k.units.map((u, i) => <button key={u.id} type="button" className="fs-n" aria-current={unitId === u.id} onClick={() => setUnitId(u.id)}><span>{i + 1} {u.title || "名前なし"}</span><em className="num">{u.days} 日</em></button>)}</div>}
            </React.Fragment>
          ))}
          {!items.length && <Chip>棚は空です</Chip>}
        </nav>
        {K && !U && (
          <Card className="pad st-g">
            <label className="field">カリキュラムの名前<input type="text" maxLength={80} value={K.name} onChange={e => setK({ name: e.target.value })} /></label>
            <label className="field">説明<input type="text" maxLength={300} value={K.note || ""} onChange={e => setK({ note: e.target.value })} /></label>
            <div className="scroll"><table className="tbl"><thead><tr><th>No</th><th>単元</th><th>日数</th><th>テスト</th><th>演習</th></tr></thead><tbody>{arr(K.units).map((u, i) => <tr key={u.id} className="crow" onClick={() => setUnitId(u.id)}><td className="num">{i + 1}</td><td><b>{u.title || "名前なし"}</b></td><td className="num">{u.days}</td><td className="num">{arr(u.testIds).length}</td><td className="num">{arr(u.exercises).length}</td></tr>)}{!arr(K.units).length && <tr><td colSpan={5}><Chip>なし</Chip></td></tr>}</tbody></table></div>
            <span className="row st-end"><Btn kind="ghost sm" onClick={() => setConf({ title: `「${K.name}」を消す`, run: () => { setItems(l => l.filter(x => x.id !== cur)); setCur(""); } })}>このカリキュラムを消す</Btn></span>
          </Card>
        )}
        {U && (
          <Card className="pad st-g">
            <div className="ce-g3"><label className="field">単元名<input type="text" maxLength={100} value={U.title} onChange={e => setU({ title: e.target.value })} /></label><label className="field">日数<input type="number" min="1" value={U.days} onChange={e => setU({ days: Math.max(1, Number(e.target.value) || 1) })} /></label><span /></div>
            <label className="field">この単元で学ぶ内容<textarea rows={2} value={U.content || ""} onChange={e => setU({ content: e.target.value })} /></label>
            <label className="field">目標（1 行に 1 つ）<textarea rows={3} value={goalText} onChange={e => setGoalText(e.target.value)} onBlur={() => setU({ goals: lines(goalText) })} /></label>
            <div className="field">テスト<span className="row">{arr(U.testIds).map(id => <span key={id} className="ce-t"><span>{testName[id] || "見つからないテスト"}</span><button type="button" className="x2" aria-label="外す" onClick={() => setU({ testIds: U.testIds.filter(x => x !== id) })}>×</button></span>)}{!arr(U.testIds).length && <Chip>なし</Chip>}</span>
              <select className="in" value="" onChange={e => { if (e.target.value) setU({ testIds: [...arr(U.testIds), e.target.value] }); }}><option value="">テストをつなぐ</option>{tests.filter(t => !arr(U.testIds).includes(testIdOf(t))).map(t => <option key={testIdOf(t)} value={testIdOf(t)}>{t.title}</option>)}</select></div>
            {arr(U.exercises).length > 0 && <Chip>演習 {U.exercises.length} ・ コースの編集で直す</Chip>}
            <span className="row st-end"><Btn kind="ghost sm" onClick={() => setConf({ title: `「${U.title || "この単元"}」を消す`, run: () => { setK({ units: arr(K.units).filter(u => u.id !== unitId) }); setUnitId(""); } })}>この単元を消す</Btn></span>
          </Card>
        )}
      </div>
      {imp && <ImportModal courses={courses} onClose={() => setImp(false)} onPick={us => { setK({ units: [...arr(K.units), ...us] }); setImp(false); }} />}
      {conf && <Modal title={conf.title} width={420} onClose={() => setConf(null)} footer={<><Btn kind="ghost" onClick={() => setConf(null)}>やめる</Btn><Btn onClick={() => { const c = conf; setConf(null); c.run(); }}>消す</Btn></>}><Chip>コースに足した単元はそのまま残る</Chip></Modal>}
    </>
  );
}
