import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import {
  CURRICULUM_EXCEL_HEADERS, TEST_SCOPE_KEYS, buildLearningContext, curriculumExcelTemplateRows, curriculumSectionsFromExcelRows, curriculumUnitScope, flattenUnitDays, makeLocalId,
  mergeCurriculumSections, normalizeCurriculumExercise, normalizeCurriculumSections, normalizeTest, safeExcelFilename, sessionsFromSections, splitCurriculumList, summarizeCurriculumSections, testCourseIdList, testQuestionsOf, unitDaysOf,
} from "../../training/TrainingComponents.jsx";
import { practiceNumLabel } from "../../training/practiceLinks.js";
import { testIdOf } from "../../training/useTraining.js";
import { Btn, Card, Chip, Modal, weekday } from "../parts/ui.jsx";
import { Icon } from "../parts/icons.jsx";
import { arr, errText, md } from "../staff/common.js";
import { TestEditModal } from "../staff/TestEdit.jsx";
import { useShelf } from "../admin/CurriculumShelf.jsx";

/* カリキュラムの編集（モック curS の編集）：その場で単元名・目標・日の内容を直し、共通の教材をドラッグか「＋」で付ける。
   「確定する」で受講生に反映（テスト・練習問題のつなぎ替えもそのときに送る）。データの形・保存先は /courses/{id}/curriculum のまま。
   内容・事前準備・演習・資料・日付は「詳しく直す」の窓（モックに画面はないが、受講生の画面が使うので残す） */

const EX_TYPES = [["hands_on", "実技"], ["individual", "個人演習"], ["team", "チーム演習"], ["submission", "提出課題"]];
const lines = t => String(t || "").split("\n").map(v => v.trim()).filter(Boolean);
const newEx = () => ({ id: makeLocalId("exercise"), title: "", type: "hands_on", instructions: "", completionCriteria: "", answerExample: "", estimatedMinutes: "" });
const newDay = (title = "", date = "") => ({ id: makeLocalId("lesson"), title, content: "", memo: "", learningGoals: [], preparationItems: [], exercises: [], skills: [], materialIds: [], startDate: date, endDate: date, durationLabel: "" });
const newUnit = () => ({ id: makeLocalId("section"), title: "新しい単元", description: "", unitMode: "lessons", content: "", learningGoals: [], preparationItems: [], exercises: [], materialIds: [], startDate: "", endDate: "", durationLabel: "", chapters: [{ id: makeLocalId("chapter"), title: "", description: "", lessons: [] }] });
const midsOf = s => s.materialIds || (s.materialId ? [s.materialId] : []);
const isD = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
const dk = v => String(v || "").slice(0, 10);
const NO_SCOPE = Object.fromEntries(TEST_SCOPE_KEYS.map(k => [k, ""]));
const scopeSig = t => `${t.sectionId || ""}|${t.lessonId || ""}|${testCourseIdList(t).join(",")}`;
const wd = d => { const [y, m, dd] = d.split("-").map(Number); return weekday(m, dd, y); };
const nextWeekday = iso => { const t = new Date(`${iso}T00:00:00Z`); do t.setUTCDate(t.getUTCDate() + 1); while ([0, 6].includes(t.getUTCDay())); return t.toISOString().slice(0, 10); };
const rangeLabel = (s, days) => { const ds = (isD(dk(s.startDate)) ? [s] : days).flatMap(x => [dk(x.startDate), dk(x.endDate || x.startDate)]).filter(isD).sort(); return ds.length ? (ds[0] === ds[ds.length - 1] ? md(ds[0]) : `${md(ds[0])}〜${md(ds[ds.length - 1])}`) : "日程なし"; };

function ListArea({ label, value, onCommit, split = lines, placeholder }) {
  // 1 行に 1 つ。入力中に空行を消さないよう、離れたときに確定する
  const [text, setText] = useState(arr(value).join("\n"));
  useEffect(() => { setText(arr(value).join("\n")); }, [value]);
  return <label className="field">{label}<textarea rows={2} value={text} placeholder={placeholder} onChange={e => setText(e.target.value)} onBlur={() => onCommit(split(text))} /></label>;
}

function Exercises({ list, onChange, aiBusy, aiErr, onAi }) {
  const [prompt, setPrompt] = useState("");
  const set = (i, patch) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="ce-b">
      <div className="head"><h4 className="h3">演習</h4><span className="r"><Chip>{list.length}</Chip><Btn kind="ghost sm" onClick={() => onChange([...list, newEx()])}>＋ 演習</Btn></span></div>
      <div className="row sx-nw"><input type="text" value={prompt} placeholder="AI に頼む（例：初心者向けの実技を 3 つ）" aria-label="AI に演習案を頼む" onChange={e => setPrompt(e.target.value)} /><Btn kind="ghost sm" disabled={!prompt.trim() || aiBusy} onClick={async () => { if (await onAi(prompt.trim())) setPrompt(""); }}>{aiBusy ? "作っています" : "AI で作る"}</Btn></div>
      {aiErr && <div className="lms-err" role="alert">{aiErr}</div>}
      {list.map((x, i) => (
        <div key={x.id || i} className="ce-ex">
          <div className="ce-exh"><input type="text" value={x.title || ""} placeholder="演習名" aria-label="演習名" onChange={e => set(i, { title: e.target.value })} /><select className="in" aria-label="種類" value={x.type || "hands_on"} onChange={e => set(i, { type: e.target.value })}>{EX_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select><input type="number" min="0" value={x.estimatedMinutes ?? ""} placeholder="目安（分）" aria-label="目安（分）" onChange={e => set(i, { estimatedMinutes: e.target.value === "" ? "" : Number(e.target.value) })} /><Btn kind="ghost sm" onClick={() => onChange(list.filter((_, j) => j !== i))}>消す</Btn></div>
          <div className="st-fg"><label className="field">問題・手順<textarea rows={2} value={x.instructions || ""} onChange={e => set(i, { instructions: e.target.value })} /></label><label className="field">完了条件・提出物<textarea rows={2} value={x.completionCriteria || ""} onChange={e => set(i, { completionCriteria: e.target.value })} /></label></div>
          <label className="field">解答例（受講生は押すまで見えない）<textarea rows={2} value={x.answerExample || ""} onChange={e => set(i, { answerExample: e.target.value })} /></label>
        </div>
      ))}
    </div>
  );
}

function Attach({ ids, mats, folders, links, onIds, onLinks, onUpload, uploading, onOpen }) {
  const free = Object.values(mats).filter(m => !ids.includes(m.materialId));
  const cur = arr(links), freeF = folders.filter(f => !cur.some(x => x.nodeId === f.nodeId));
  const ref = useRef(null);
  return (
    <div className="ce-b">
      <div className="head"><h4 className="h3">資料とフォルダ</h4><span className="r"><Btn kind="ghost sm" disabled={uploading} onClick={() => ref.current?.click()}>{uploading ? "置いています" : "アップロード"}</Btn></span></div>
      <input ref={ref} type="file" className="lms-sr" aria-label="置くファイル" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f); }} />
      <div className="row">
        {ids.filter(id => mats[id]).map(id => <span key={id} className="ce-t"><button type="button" onClick={() => onOpen(id)}>{mats[id].title || mats[id].filename}</button><button type="button" className="x2" aria-label={`${mats[id].title} を外す`} onClick={() => onIds(ids.filter(v => v !== id))}>×</button></span>)}
        {cur.map(f => <span key={f.nodeId} className="ce-t"><span className="folder" aria-hidden="true" /><span>{f.name || "フォルダ"}</span><button type="button" className="x2" aria-label={`${f.name} を外す`} onClick={() => onLinks(cur.filter(x => x.nodeId !== f.nodeId))}>×</button></span>)}
        {!ids.some(id => mats[id]) && !cur.length && <Chip>なし</Chip>}
      </div>
      <div className="st-fg">
        <label className="field">資料をつなぐ<select className="in" value="" disabled={!free.length} onChange={e => { if (e.target.value) onIds([...ids, e.target.value]); }}><option value="">選ぶ</option>{free.map(m => <option key={m.materialId} value={m.materialId}>{m.title || m.filename}</option>)}</select></label>
        <label className="field">フォルダをつなぐ<select className="in" value="" disabled={!freeF.length} onChange={e => { const f = folders.find(x => x.nodeId === e.target.value); if (f) onLinks([...cur, { nodeId: f.nodeId, name: f.name }]); }}><option value="">選ぶ</option>{freeF.map(f => <option key={f.nodeId} value={f.nodeId}>{f.label}</option>)}</select></label>
      </div>
    </div>
  );
}

// 共通の教材（モック cuShelf）
function Shelf({ lib, onDrag }) {
  const [f, setF] = useState("test");
  const [q, setQ] = useState("");
  const list = lib[f].filter(x => !q.trim() || x.t.includes(q.trim()));
  return (
    <aside className="card cu-shelf" aria-label="共通の教材">
      <div className="head"><h2 className="h3">共通の教材</h2><span className="r"><Chip tone="mk">ドラッグで付ける</Chip></span></div>
      <span className="seg">{[["test", "テスト"], ["prac", "練習問題"], ["unit", "単元"]].map(([k, t]) => <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{t} <span className="num">{lib[k].length}</span></button>)}</span>
      <input type="search" className="in" value={q} placeholder="名前で探す" aria-label="共通の教材を探す" onChange={e => setQ(e.target.value)} />
      <div className="sh-l">
        {lib.state === "error" ? <Chip tone="bad">確認できません</Chip> : list.map(x => (
          <div key={x.id} className={`sh-i ${f}`} draggable onDragStart={e => { e.dataTransfer.setData("text/plain", `${f}|${x.id}`); e.dataTransfer.effectAllowed = "copy"; onDrag(true); }} onDragEnd={() => onDrag(false)}>
            <span className="sh-g" aria-hidden="true">⠿</span><span className="sh-ic"><Icon k={f === "test" ? "test" : f === "prac" ? "prac" : "cur"} size={16} /></span>
            <span className="sh-t"><b>{x.t}</b><small>{x.sub}</small></span>
          </div>
        ))}
        {lib.state === "ready" && !list.length && <Chip>なし</Chip>}
      </div>
    </aside>
  );
}

export default function CurriculumEdit({ course, go, keys, onClose, say }) {
  const courseId = course.courseId;
  const [st, setSt] = useState("loading");
  const [sections, setSections] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [tests, setTests] = useState([]);       // 確定まで手元で動かす（_gone は外したもの）
  const [pracs, setPracs] = useState([]);       // このコースの練習問題
  const [addPrac, setAddPrac] = useState([]);   // 確定で足す共通の練習問題 { id, t, sectionId }
  const [dropPrac, setDropPrac] = useState([]); // 確定で外す練習問題 { setId, sectionId }
  const [folders, setFolders] = useState([]);
  const [common, setCommon] = useState({ state: "loading", test: [], prac: [], raw: [] });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(""); const [aiBusy, setAiBusy] = useState({}); const [aiErr, setAiErr] = useState({});
  const [conf, setConf] = useState(null);
  const [leave, setLeave] = useState(null);
  const [detail, setDetail] = useState(null);   // 詳しく直す単元の id
  const [openDay, setOpenDay] = useState({});
  const [pick, setPick] = useState(null);       // ＋ で足す先 { target, label }
  const [editT, setEditT] = useState(null);
  const [dragging, setDragging] = useState(false); const [dropOn, setDropOn] = useState("");
  const [imp, setImp] = useState(null); const [impBusy, setImpBusy] = useState(false); const [sure, setSure] = useState(false);
  const saved = useRef(""); const savedTests = useRef({});
  const fileRef = useRef(null);
  const shelf = useShelf();

  useEffect(() => {
    let alive = true;
    apiGet(`/courses/${encodeURIComponent(courseId)}/curriculum`).then(item => {
      if (!alive) return;
      const next = flattenUnitDays(normalizeCurriculumSections(item));
      setSections(next); saved.current = JSON.stringify(next); setSt("ready");
    }).catch(() => { if (alive) setSt("error"); });
    apiGet(`/materials?courseId=${encodeURIComponent(courseId)}`).then(l => { if (alive) setMaterials(arr(l)); }).catch(() => {});
    apiGet(`/tests?courseId=${encodeURIComponent(courseId)}`).then(l => {
      if (!alive) return;
      const list = arr(l).filter(t => t.status !== "archived");
      savedTests.current = Object.fromEntries(list.map(t => [testIdOf(t), scopeSig(t)]));
      setTests(list);
    }).catch(() => {});
    apiGet(`/practice?courseId=${encodeURIComponent(courseId)}`).then(r => { if (alive) setPracs(arr(r?.items)); }).catch(() => {});
    apiGet(`/library?spaceId=${encodeURIComponent(`course#${courseId}`)}`).then(d => {
      if (!alive) return;
      const nodes = arr(d?.nodes), byId = new Map(nodes.map(n => [n.nodeId, n]));
      const label = n => { if (n.type === "shortcut") return `${n.targetName || n.name}（共有）`; const out = []; let c = n; while (c && c.nodeId !== "root") { out.unshift(c.name); c = byId.get(c.parentId); } return out.join(" / "); };
      setFolders(nodes.filter(n => n.nodeId !== "root" && (n.type === "folder" || n.type === "shortcut")).map(n => ({ nodeId: n.nodeId, name: n.type === "shortcut" ? n.targetName || n.name : n.name, label: label(n) })).sort((a, b) => a.label.localeCompare(b.label, "ja")));
    }).catch(() => {});
    Promise.all([apiGet("/tests"), apiGet("/practice/common")]).then(([ts, ps]) => {
      if (!alive) return;
      const raw = arr(ts).filter(t => t.status !== "archived" && (t.common || !testCourseIdList(t).length)).map(normalizeTest);
      setCommon({
        state: "ready", raw,
        test: raw.map(t => { const n = testQuestionsOf(t).length, min = Number(t.limitMinutes) || 0, use = testCourseIdList(t).length; return { id: testIdOf(t), t: t.title, sub: [`${n}問`, min ? `目安 ${min}分` : "", `${use} コースで使用`].filter(Boolean).join(" ・ ") }; }),
        prac: arr(ps?.items).filter(x => x.status !== "new" && x.status !== "building").map(x => ({ id: x.id, t: x.title || "題名なし", sub: `${x.counts?.questions || 0}問 ・ ${arr(x.usedIn).length} コースで使用` })),
      });
    }).catch(() => { if (alive) setCommon(c => ({ ...c, state: "error" })); });
    return () => { alive = false; };
  }, [courseId]);

  const lib = useMemo(() => {
    const units = shelf.items.flatMap(c => arr(c.units).map(u => ({ id: u.id, t: u.title, sub: `${Number(u.days) || 0} 日 ・ ${c.name}`, raw: u })));
    return { state: common.state === "error" || shelf.state === "error" ? "error" : common.state === "ready" && shelf.state !== "loading" ? "ready" : "loading", test: common.test, prac: common.prac, unit: units };
  }, [common, shelf.items, shelf.state]);

  const mats = useMemo(() => Object.fromEntries(materials.map(m => [m.materialId, m])), [materials]);
  const liveTests = tests.filter(t => !t._gone);
  const testsChanged = tests.some(t => savedTests.current[testIdOf(t)] !== (t._gone ? "gone" : scopeSig(t)));
  const dirty = st === "ready" && (JSON.stringify(sections) !== saved.current || testsChanged || addPrac.length > 0 || dropPrac.length > 0);
  const setSec = (si, patch) => setSections(xs => xs.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const setDay = (si, li, patch) => setSections(xs => xs.map((s, i) => (i !== si ? s : { ...s, chapters: arr(s.chapters).map((c, j) => (j !== 0 ? c : { ...c, lessons: arr(c.lessons).map((l, k) => (k === li ? { ...l, ...patch, ...(patch.materialIds ? { materialId: undefined } : {}) } : l)) })) })));
  const addDay = si => setSections(xs => xs.map((s, i) => { if (i !== si) return s; const ch = arr(s.chapters)[0] || { id: makeLocalId("chapter"), title: "", description: "", lessons: [] }; const ds = arr(ch.lessons).map(l => dk(l.endDate || l.startDate)).filter(isD).sort(); return { ...s, chapters: [{ ...ch, lessons: [...arr(ch.lessons), newDay("", ds.length ? nextWeekday(ds[ds.length - 1]) : "")] }] }; }));
  const delDay = (si, li) => {
    const d = unitDaysOf(sections[si])[li];
    setTests(l => l.map(t => (t.lessonId === d?.id ? { ...t, ...NO_SCOPE } : t)));
    setSections(xs => xs.map((s, i) => (i !== si ? s : { ...s, chapters: arr(s.chapters).map((c, j) => (j !== 0 ? c : { ...c, lessons: arr(c.lessons).filter((_, k) => k !== li) })) })));
  };
  const lastDate = () => sections.flatMap(s => [dk(s.endDate), ...unitDaysOf(s).map(d => dk(d.endDate || d.startDate))]).filter(isD).sort().pop() || "";
  const addEmptyUnit = () => { const u = newUnit(), l = lastDate(); u.chapters[0].lessons = [newDay("", l ? nextWeekday(l) : "")]; setSections(xs => [...xs, u]); };

  // ---- 共通の教材を付ける ----
  const scopeOf = target => {
    const [k, a, b] = target.split("|"), s = sections[Number(a)];
    if (k === "day") return { s, fields: curriculumUnitScope(s, arr(s.chapters)[0], unitDaysOf(s)[Number(b)], "lesson").fields };
    return { s, fields: curriculumUnitScope(s, null, null, "section").fields };
  };
  const attachTest = (raw, fields) => setTests(l => {
    const id = testIdOf(raw), cur = l.find(t => testIdOf(t) === id);
    const courseIds = [...new Set([...testCourseIdList(cur || raw), courseId])];
    return cur ? l.map(t => (testIdOf(t) === id ? { ...t, ...fields, courseIds, _gone: false } : t)) : [...l, { ...raw, ...fields, courseIds }];
  });
  const fromCourse = id => tests.find(t => testIdOf(t) === id);
  const attach = (target, key) => {
    const [f, id] = key.split("|");
    if (f === "unit") {
      if (target !== "end") { say?.("単元は下の「共通の単元をここへ」に落としてください"); return; }
      addShelfUnit(lib.unit.find(u => u.id === id)?.raw);
      return;
    }
    if (target === "end") { say?.("テスト・練習問題は、日か「単元を通して」に落としてください"); return; }
    const { s, fields } = scopeOf(target), where = target.startsWith("day") ? "この日" : `単元「${s.title}」`;
    if (f === "test") {
      const raw = common.raw.find(t => testIdOf(t) === id) || fromCourse(id);
      if (!raw) return;
      attachTest(raw, fields);
      say?.(`「${raw.title}」を${where}に付けました`);
    } else {
      const x = lib.prac.find(p => p.id === id);
      if (!x) return;
      setAddPrac(l => (l.some(p => p.id === id && p.sectionId === s.id) ? l : [...l, { id, t: x.t, sectionId: s.id }]));
      say?.(`「${x.t}」を単元「${s.title}」に付けました`);
    }
  };
  // 棚の単元：日数ぶんの日を、最後の日の次の平日から並べる。テスト・練習問題もつなぐ
  const addShelfUnit = u => {
    if (!u) return;
    const made = { ...newUnit(), title: u.title || "新しい単元", content: u.content || "", learningGoals: arr(u.goals), exercises: arr(u.exercises).map(x => ({ ...x, id: makeLocalId("exercise") })) };
    let d = lastDate();
    made.chapters[0].lessons = Array.from({ length: Math.max(0, Number(u.days) || 0) }, () => { d = d ? nextWeekday(d) : ""; return newDay("", d); });
    setSections(xs => [...xs, made]);
    const fields = curriculumUnitScope(made, null, null, "section").fields;
    arr(u.testIds).forEach(id => { const raw = common.raw.find(t => testIdOf(t) === id) || fromCourse(id); if (raw) attachTest(raw, fields); });
    setAddPrac(l => [...l, ...arr(u.pracIds).map(id => ({ id, t: lib.prac.find(p => p.id === id)?.t || "練習問題", sectionId: made.id }))]);
    say?.(`単元「${made.title}」を足しました`);
  };
  const zone = target => ({
    onDragOver: e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (dropOn !== target) setDropOn(target); },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOn(o => (o === target ? "" : o)); },
    onDrop: e => { e.preventDefault(); setDropOn(""); setDragging(false); const k = e.dataTransfer.getData("text/plain"); if (k) attach(target, k); },
    "data-drop": target,
    ...(dropOn === target ? { "data-on": "1" } : {}),
  });

  // ---- 外す ----
  const askTest = (t, where) => setConf({ title: "このテストを外しますか？", rows: [["テスト", t.title], ["付いている所", where]], ok: "外す", run: () => setTests(l => l.map(x => {
    if (testIdOf(x) !== testIdOf(t)) return x;
    // 共通のテストはこのコースから外す。コースのテストはコース全体に戻す（テストの画面に残る）
    return savedTests.current[testIdOf(t)] === undefined ? { ...x, _gone: true } : t.common ? { ...x, ...NO_SCOPE, courseIds: testCourseIdList(x).filter(c => c !== courseId), _gone: true } : { ...x, ...NO_SCOPE };
  })) });
  const askUnit = (si, s, days) => setConf({ title: "この単元を外しますか？", rows: [["単元", s.title || "名前のない単元"], ["日程", `${rangeLabel(s, days)} ・ ${days.length} 日`]], chip: "中の日・テスト・練習問題も一緒に外れます", ok: "外す", run: () => {
    setTests(l => l.map(t => (t.sectionId === s.id ? { ...t, ...NO_SCOPE } : t)));
    pracs.forEach(p => { if (arr(p.lessons).some(l => l.sectionId === s.id)) setDropPrac(d => [...d, { setId: p.id, sectionId: s.id }]); });
    setAddPrac(l => l.filter(p => p.sectionId !== s.id));
    setSections(xs => xs.filter((_, i) => i !== si));
  } });

  async function save() {
    if (busy) return;
    setBusy(true); setErr("");
    let failed = 0;
    try {
      // 日ごとの区切りがある単元は日単位、ない単元は単元そのものを「今日の単元」の判定に使う
      const out = sections.map(s => ({ ...s, learningGoals: arr(s.learningGoals).map(g => String(g).trim()).filter(Boolean), unitMode: unitDaysOf(s).length ? "lessons" : "section" }));
      await apiPut(`/courses/${encodeURIComponent(courseId)}/curriculum`, { sections: out, sessions: sessionsFromSections(out) });
      saved.current = JSON.stringify(sections);
    } catch (e) { setErr(errText(e, "保存できませんでした")); setBusy(false); return; }
    // テストのつなぎ替え
    for (const t of tests) {
      const id = testIdOf(t), was = savedTests.current[id];
      if (was === (t._gone ? "gone" : scopeSig(t)) || (t._gone && was === undefined)) continue;
      try {
        const scoped = !t._gone && t.sectionId;
        // eslint-disable-next-line no-await-in-loop
        await apiPut(`/tests/${encodeURIComponent(id)}`, { courseIds: testCourseIdList(t), courseScopes: { [courseId]: scoped ? Object.fromEntries(TEST_SCOPE_KEYS.map(k => [k, t[k] || ""])) : null } });
        savedTests.current[id] = t._gone ? "gone" : scopeSig(t);
      } catch { failed += 1; }
    }
    // 練習問題：共通から足す（下書きで入る）・単元から外す
    const leftAdd = [];
    for (const p of addPrac) {
      // eslint-disable-next-line no-await-in-loop
      try { await apiPost(`/practice/common/${encodeURIComponent(p.id)}/add`, { courseId, sectionId: p.sectionId }); } catch { failed += 1; leftAdd.push(p); }
    }
    setAddPrac(leftAdd);
    const leftDrop = [];
    for (const d of dropPrac) {
      try {
        const qs = `?courseId=${encodeURIComponent(courseId)}`;
        // eslint-disable-next-line no-await-in-loop
        const g = await apiGet(`/practice/${encodeURIComponent(d.setId)}${qs}`);
        // eslint-disable-next-line no-await-in-loop
        await apiPut(`/practice/${encodeURIComponent(d.setId)}${qs}`, { title: g.set.title, lessons: g.set.lessons.map(l => (l.sectionId === d.sectionId ? { ...l, sectionId: "" } : l)), warnings: g.set.warnings || [], showAnswers: g.item.showAnswers !== false, dueDate: g.item.dueDate || "" });
      } catch { failed += 1; leftDrop.push(d); }
    }
    setDropPrac(leftDrop);
    setBusy(false);
    if (failed) { setErr(`カリキュラムは確定しました。テスト・練習問題 ${failed} 件をつなげませんでした`); return; }
    say?.("カリキュラムを確定しました");
    onClose();
  }
  const upload = async (file, key, attachId) => {
    setUploading(key); setErr("");
    try {
      const contentType = file.type || "application/octet-stream";
      const { uploadUrl, materialId, s3key } = await apiPost("/materials/upload-url", { courseId, filename: file.name, contentType });
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      if (!put.ok) throw new Error("ファイルを送れませんでした");
      const title = file.name.replace(/\.[^.]+$/, "") || file.name;
      await apiPost("/materials", { courseId, materialId, s3key, title, filename: file.name });
      setMaterials(ms => [...ms, { courseId, materialId, title, s3key, filename: file.name }]);
      attachId(materialId);
    } catch (e) { setErr(errText(e, "アップロードできませんでした")); } finally { setUploading(""); }
  };
  const openMat = async id => {
    const tab = window.open("", "_blank");
    try { const r = await apiGet(`/materials/view?courseId=${encodeURIComponent(courseId)}&materialId=${encodeURIComponent(id)}`); if (tab) tab.location.href = r.url; else window.open(r.url, "_blank"); }
    catch { if (tab) tab.close(); setErr("資料を開けませんでした"); }
  };
  const genAi = async (key, request, meta, apply) => {
    setAiBusy(s => ({ ...s, [key]: true })); setAiErr(s => ({ ...s, [key]: "" }));
    try {
      const r = await apiPost("/ai/exercises/generate", { courseId, courseName: course.name || "", exerciseCount: 3, request, ...meta });
      const made = arr(r?.exercises).map((x, i) => ({ ...normalizeCurriculumExercise(x, i), id: makeLocalId("exercise") }));
      if (!made.length) throw new Error("演習案が返されませんでした");
      apply(made);
      return true;
    } catch (e) { setAiErr(s => ({ ...s, [key]: errText(e, "演習案を作れませんでした") })); return false; }
    finally { setAiBusy(s => ({ ...s, [key]: false })); }
  };
  const leaveTo = fn => { if (dirty) setLeave({ run: fn }); else fn(); };
  const exportTemplate = async () => {
    setErr("");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(curriculumExcelTemplateRows(), { header: CURRICULUM_EXCEL_HEADERS });
      sheet["!cols"] = CURRICULUM_EXCEL_HEADERS.map(h => ({ wch: Math.max(14, Math.min(34, h.length * 2 + 8)) }));
      XLSX.utils.book_append_sheet(wb, sheet, "カリキュラム");
      XLSX.writeFile(wb, `カリキュラム登録テンプレート_${safeExcelFilename(course.name || "コース")}.xlsx`);
    } catch (e) { setErr(errText(e, "ひな形を作れませんでした")); }
  };
  const readExcel = async file => {
    setImpBusy(true); setErr("");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets["カリキュラム"] || wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("カリキュラムシートがありません");
      const got = curriculumSectionsFromExcelRows(XLSX.utils.sheet_to_json(sheet, { defval: "" }));
      if (!got.length) throw new Error("大項目が入力された行がありません");
      setSure(false); setImp({ fileName: file.name, sections: got, summary: summarizeCurriculumSections(got) });
    } catch (e) { setErr(errText(e, "Excel を読み込めませんでした")); } finally { setImpBusy(false); }
  };
  const applyImp = mode => {
    if (mode === "replace" && sections.length && !sure) { setSure(true); return; }
    setSections(mode === "merge" ? flattenUnitDays(mergeCurriculumSections(sections, imp.sections)) : flattenUnitDays(imp.sections));
    setImp(null);
    say?.("反映しました ・ 確定はまだです");
  };

  if (st === "loading") return <div className="soon card">読み込み中</div>;
  if (st === "error") return <Card><div className="empty"><b>カリキュラムを確認できません</b><Btn kind="ghost sm" onClick={onClose}>戻る</Btn></div></Card>;

  const testChip = (t, where) => (
    <span key={testIdOf(t)} className="cu-iw">
      <button type="button" className="cu-i test" onClick={() => setEditT(t)}><Icon k="test" size={16} /><span>{t.title}</span>{t.common && <i className="lbm">共通</i>}<em>{t.status === "published" ? "公開" : "下書き"}</em><i className="cu-pen" aria-hidden="true">✎</i></button>
      <button type="button" className="cu-x" aria-label={`${t.title} を外す`} onClick={() => askTest(t, where)}>×</button>
    </span>
  );
  const pracOf = s => pracs.filter(p => arr(p.lessons).some(l => l.sectionId === s.id) && !dropPrac.some(d => d.setId === p.id && d.sectionId === s.id));
  const pracChips = s => [
    ...pracOf(s).map(p => {
      const nums = arr(p.lessons).filter(l => l.sectionId === s.id).flatMap(l => arr(l.nums));
      return (
        <span key={p.id} className="cu-iw">
          <button type="button" className="cu-i prac" onClick={() => leaveTo(() => go(keys.prac))}><Icon k="prac" size={16} /><span>{p.title || "練習問題"}</span>{p.commonId && <i className="lbm">共通</i>}{nums.length > 0 && <em>{practiceNumLabel(nums)}</em>}<i className="cu-pen" aria-hidden="true">✎</i></button>
          <button type="button" className="cu-x" aria-label={`${p.title} を外す`} onClick={() => setConf({ title: "この練習問題を外しますか？", rows: [["練習問題", p.title || "練習問題"], ["付いている所", "単元を通して"]], ok: "外す", run: () => setDropPrac(l => [...l, { setId: p.id, sectionId: s.id }]) })}>×</button>
        </span>
      );
    }),
    ...addPrac.filter(p => p.sectionId === s.id).map(p => (
      <span key={`add:${p.id}`} className="cu-iw">
        <span className="cu-i prac"><Icon k="prac" size={16} /><span>{p.t}</span><i className="lbm">共通</i></span>
        <button type="button" className="cu-x" aria-label={`${p.t} を外す`} onClick={() => setAddPrac(l => l.filter(x => x !== p))}>×</button>
      </span>
    )),
  ];
  const detailI = sections.findIndex(s => s.id === detail), dS = sections[detailI];

  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow eb-c">{course.name}</div><h1 className="h1">カリキュラム</h1></div>
        <span className="r"><Chip tone="warn">編集中</Chip><Btn kind="ghost sm" disabled={busy} onClick={() => leaveTo(onClose)}>やめる</Btn><Btn kind="sm" disabled={busy} onClick={save}>{busy ? "確定しています" : "確定する"}</Btn></span>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="lms-sr" aria-label="Excel を選ぶ" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) readExcel(f); }} />
      {err && <div className="lms-err" role="alert">{err}</div>}
      <div className={`cu-ed${dragging ? " dragging" : ""}`}>
        <div className="cu-list">
          {sections.map((s, si) => {
            const days = unitDaysOf(s), goals = arr(s.learningGoals), whole = liveTests.filter(t => t.sectionId === s.id && !t.lessonId);
            return (
              <section key={s.id} className="card cu-u on">
                <div className="cu-h ed">
                  <span className="cu-n num">{si + 1}</span>
                  <span className="cu-t"><input type="text" className="in cu-in" aria-label={`単元 ${si + 1} の名前`} value={s.title || ""} onChange={e => setSec(si, { title: e.target.value })} /><small className="num">{rangeLabel(s, days)} ・ {days.length} 日</small></span>
                  <span className="row"><Btn kind="ghost sm" onClick={() => setDetail(s.id)}>詳しく直す</Btn><Btn kind="ghost sm" onClick={() => askUnit(si, s, days)}>この単元を外す</Btn></span>
                </div>
                <div className="cu-b">
                  <div className="cu-top">
                    <div className="goalbox"><span className="eyebrow">この単元の目標</span>
                      {goals.map((g, gi) => <input key={gi} type="text" className="in" aria-label={`目標 ${gi + 1}`} value={g} autoFocus={g === ""} onChange={e => setSec(si, { learningGoals: goals.map((x, y) => (y === gi ? e.target.value : x)) })} />)}
                      <span><Btn kind="ghost sm" onClick={() => setSec(si, { learningGoals: [...goals, ""] })}>＋ 目標</Btn></span>
                    </div>
                    <div className="cu-all" {...zone(`unit|${si}`)}><span className="eyebrow">単元を通して</span>
                      {whole.map(t => testChip(t, "単元を通して"))}
                      {pracChips(s)}
                      <span className="cu-dz">テスト・練習問題をここへ</span>
                      <span><Btn kind="ghost sm" aria-label={`単元 ${si + 1} に足す`} onClick={() => setPick({ target: `unit|${si}`, label: s.title || "この単元" })}>＋</Btn></span>
                    </div>
                  </div>
                  <ol className="cu-days">
                    {days.map((d, li) => {
                      const start = dk(d.startDate), list = [...new Set([...midsOf(d), d.materialId].filter(Boolean))].filter(id => mats[id]), its = liveTests.filter(t => t.lessonId === d.id);
                      return (
                        <li key={d.id || li} {...zone(`day|${si}|${li}`)}>
                          <span className="cu-d">{isD(start) ? <><b className="num">{md(start)}</b><small>{wd(start)}</small></> : <small>未定</small>}</span>
                          <span className="cu-dt"><input type="text" className="in cu-in2" aria-label={`${isD(start) ? md(start) : `${li + 1} 日目`} の内容`} value={d.title || ""} onChange={e => setDay(si, li, { title: e.target.value })} />{its.length > 0 && <span className="cu-is">{its.map(t => testChip(t, isD(start) ? `${md(start)}（${wd(start)}）` : `${li + 1} 日目`))}</span>}</span>
                          <span className="row">{list.length === 1 ? <Btn kind="ghost sm" onClick={() => openMat(list[0])}>スライド</Btn> : list.map(id => <Btn key={id} kind="ghost sm" onClick={() => openMat(id)}>{mats[id].title || "スライド"}</Btn>)}<Btn kind="ghost sm" aria-label={`${isD(start) ? md(start) : `${li + 1} 日目`} に足す`} onClick={() => setPick({ target: `day|${si}|${li}`, label: isD(start) ? md(start) : `${li + 1} 日目` })}>＋</Btn></span>
                        </li>
                      );
                    })}
                  </ol>
                  <span><Btn kind="ghost sm" onClick={() => addDay(si)}>＋ 日</Btn></span>
                </div>
              </section>
            );
          })}
          <div className="cu-end" {...zone("end")}><span>共通の単元をここへ</span><Btn kind="ghost sm" onClick={addEmptyUnit}>空の単元を足す</Btn></div>
          <div className="row st-end"><Btn kind="ghost sm" onClick={exportTemplate}>Excel ひな形</Btn><Btn kind="ghost sm" disabled={impBusy} onClick={() => fileRef.current?.click()}>{impBusy ? "読んでいます" : "Excel 読み込み"}</Btn></div>
        </div>
        <Shelf lib={lib} onDrag={setDragging} />
      </div>

      {editT && <TestEditModal test={normalizeTest(editT)} unitName={editT.lessonTitle || editT.sectionTitle || ""} courseId={courseId} onClose={() => setEditT(null)} onSaved={() => { setEditT(null); say?.("テストを直しました"); apiGet(`/tests?courseId=${encodeURIComponent(courseId)}`).then(l => setTests(cur => { const fresh = new Map(arr(l).map(t => [testIdOf(t), t])); return cur.map(t => { const f = fresh.get(testIdOf(t)); return f ? { ...f, ...Object.fromEntries(TEST_SCOPE_KEYS.map(k => [k, t[k] || ""])), courseIds: testCourseIdList(t), _gone: t._gone } : t; }); })).catch(() => {}); }} />}

      {pick && (
        <Modal title={`${pick.label} に足す`} width={520} onClose={() => setPick(null)} footer={<Btn kind="ghost" onClick={() => setPick(null)}>閉じる</Btn>}>
          {lib.state === "error" ? <Chip tone="bad">確認できません</Chip> : (
            <div className="sh-l pick">
              {[...lib.test.map(x => ["test", x]), ...lib.prac.map(x => ["prac", x])].map(([f, x]) => (
                <div key={`${f}:${x.id}`} className={`sh-i ${f}`}><span className="sh-ic"><Icon k={f} size={16} /></span><span className="sh-t"><b>{x.t}</b><small>{f === "test" ? "テスト" : "練習問題"} ・ {x.sub}</small></span><Btn kind="ghost sm" onClick={() => { attach(pick.target, `${f}|${x.id}`); setPick(null); }}>足す</Btn></div>
              ))}
              {!lib.test.length && !lib.prac.length && <Chip>なし</Chip>}
            </div>
          )}
        </Modal>
      )}

      {dS && (
        <Modal title={`詳しく直す ・ ${dS.title || `単元 ${detailI + 1}`}`} width={780} onClose={() => setDetail(null)} footer={<Btn onClick={() => setDetail(null)}>閉じる</Btn>}>
          <div className="ce">
            <div className="ce-g3"><label className="field">単元名<input type="text" value={dS.title || ""} onChange={e => setSec(detailI, { title: e.target.value })} /></label><label className="field">開始日<input type="date" value={dS.startDate || ""} onChange={e => setSec(detailI, { startDate: e.target.value })} /></label><label className="field">終了日<input type="date" value={dS.endDate || ""} onChange={e => setSec(detailI, { endDate: e.target.value })} /></label></div>
            <label className="field">説明<input type="text" value={dS.description || ""} onChange={e => setSec(detailI, { description: e.target.value })} /></label>
            <label className="field">この単元で学ぶ内容<textarea rows={2} value={dS.content || ""} onChange={e => setSec(detailI, { content: e.target.value })} /></label>
            <ListArea label="事前に用意すること（1 行に 1 つ）" value={dS.preparationItems} split={splitCurriculumList} onCommit={v => setSec(detailI, { preparationItems: v })} />
            <label className="field">期間の表示（例：1〜3 日目）<input type="text" value={dS.durationLabel || ""} onChange={e => setSec(detailI, { durationLabel: e.target.value })} /></label>
            <Attach ids={arr(dS.materialIds)} mats={mats} folders={folders} links={dS.folderLinks} onIds={v => setSec(detailI, { materialIds: v })} onLinks={v => setSec(detailI, { folderLinks: v })} uploading={uploading === `s:${dS.id}`} onOpen={openMat} onUpload={f => upload(f, `s:${dS.id}`, id => setSections(xs => xs.map((x, i) => (i === detailI ? { ...x, materialIds: [...arr(x.materialIds).filter(v => v !== id), id] } : x))))} />
            <Exercises list={arr(dS.exercises)} onChange={v => setSec(detailI, { exercises: v })} aiBusy={!!aiBusy[`s:${dS.id}`]} aiErr={aiErr[`s:${dS.id}`]} onAi={request => genAi(`s:${dS.id}`, request, { scopeType: "section", sectionTitle: dS.title, learningContext: buildLearningContext({ section: dS, lessons: [], materialsById: mats }) }, made => setSec(detailI, { exercises: [...arr(dS.exercises), ...made] }))} />
            <div className="ce-b">
              <div className="head"><h4 className="h3">日ごと</h4><span className="r"><Chip>{unitDaysOf(dS).length} 日</Chip></span></div>
              {unitDaysOf(dS).map((d, li) => {
                const k = `${dS.id}:${li}`, on = !!openDay[k], ch = arr(dS.chapters)[0], ids = midsOf(d);
                return (
                  <div key={d.id || li} className={`ce-d${on ? " on" : ""}`}>
                    <button type="button" className="ce-dh" aria-expanded={on} onClick={() => setOpenDay(o => ({ ...o, [k]: !o[k] }))}><span className="num">{d.startDate ? md(d.startDate) : "日付なし"}</span><b>{d.title || "名前なし"}</b><i className="cu-cv" aria-hidden="true">▾</i></button>
                    {on && (
                      <div className="ce-db">
                        <div className="ce-g3"><label className="field">この日の内容<input type="text" value={d.title || ""} onChange={e => setDay(detailI, li, { title: e.target.value })} /></label><label className="field">開始日<input type="date" value={d.startDate || ""} onChange={e => setDay(detailI, li, { startDate: e.target.value })} /></label><label className="field">終了日<input type="date" value={d.endDate || ""} onChange={e => setDay(detailI, li, { endDate: e.target.value })} /></label></div>
                        <div className="st-fg"><label className="field">学習内容<textarea rows={2} value={d.content || ""} onChange={e => setDay(detailI, li, { content: e.target.value })} /></label><label className="field">講師メモ（受講生に出さない）<textarea rows={2} value={d.memo || ""} onChange={e => setDay(detailI, li, { memo: e.target.value })} /></label></div>
                        <div className="st-fg"><ListArea label="この日の目標（1 行に 1 つ）" value={d.learningGoals} onCommit={v => setDay(detailI, li, { learningGoals: v })} /><ListArea label="この日までに用意すること（1 行に 1 つ）" value={d.preparationItems} split={splitCurriculumList} onCommit={v => setDay(detailI, li, { preparationItems: v })} /></div>
                        <label className="field">期間の表示（例：3 日目）<input type="text" value={d.durationLabel || ""} onChange={e => setDay(detailI, li, { durationLabel: e.target.value })} /></label>
                        <Attach ids={ids} mats={mats} folders={folders} links={d.folderLinks} onIds={v => setDay(detailI, li, { materialIds: v })} onLinks={v => setDay(detailI, li, { folderLinks: v })} uploading={uploading === `d:${d.id}`} onOpen={openMat} onUpload={f => upload(f, `d:${d.id}`, id => setDay(detailI, li, { materialIds: [...ids.filter(v => v !== id), id] }))} />
                        <Exercises list={arr(d.exercises)} onChange={v => setDay(detailI, li, { exercises: v })} aiBusy={!!aiBusy[`d:${d.id}`]} aiErr={aiErr[`d:${d.id}`]} onAi={request => genAi(`d:${d.id}`, request, { scopeType: "lesson", sectionTitle: dS.title, chapterTitle: ch?.title, lessonTitle: d.title, learningContext: buildLearningContext({ section: dS, chapter: ch, lessons: [d], materialsById: mats }) }, made => setDay(detailI, li, { exercises: [...arr(d.exercises), ...made] }))} />
                        <span className="row st-end"><Btn kind="ghost sm" onClick={() => setConf({ title: "この日を外しますか？", rows: [["日", d.title || "名前なし"], ["日程", d.startDate ? md(d.startDate) : "日付なし"]], ok: "外す", run: () => delDay(detailI, li) })}>この日を外す</Btn></span>
                      </div>
                    )}
                  </div>
                );
              })}
              {!unitDaysOf(dS).length && <Chip>なし</Chip>}
            </div>
          </div>
        </Modal>
      )}

      {conf && <Modal title={conf.title} width={460} onClose={() => setConf(null)} footer={<><Btn kind="ghost" onClick={() => setConf(null)}>やめる</Btn><Btn kind="danger" onClick={() => { const c = conf; setConf(null); c.run(); }}>{conf.ok}</Btn></>}><div className="rowsx">{conf.rows.map(([a, b]) => <div key={a}><span>{a}</span><b>{b}</b></div>)}</div>{conf.chip && <div className="row"><Chip tone="warn">{conf.chip}</Chip></div>}</Modal>}
      {leave && <Modal title="確定していない変更があります" width={440} onClose={() => setLeave(null)} footer={<><Btn kind="ghost" onClick={() => setLeave(null)}>続ける</Btn><Btn onClick={() => { const r = leave.run; setLeave(null); r(); }}>確定せずに移る</Btn></>}><Chip tone="warn">変えたところは消える</Chip></Modal>}
      {imp && (
        <Modal title={`Excel の確認 ・ ${imp.fileName}`} width={520} onClose={() => setImp(null)} footer={<><Btn kind="ghost" onClick={() => setImp(null)}>やめる</Btn>{sections.length > 0 && <Btn kind="ghost" onClick={() => applyImp("merge")}>今の内容に足す</Btn>}<Btn onClick={() => applyImp("replace")}>{sure ? "本当に置き換える" : sections.length ? "今の内容と置き換える" : "反映する"}</Btn></>}>
          <div className="row"><Chip>単元 {imp.summary.sections}</Chip><Chip>日 {imp.summary.lessons}</Chip><Chip>事前準備 {imp.summary.preparations}</Chip><Chip>演習 {imp.summary.exercises}</Chip></div>
          {sure && <Chip tone="bad">今の編集内容は消える</Chip>}
          <Chip tone="warn">反映のあと「確定する」を押すまで受講生には出ない</Chip>
        </Modal>
      )}
    </div>
  );
}
