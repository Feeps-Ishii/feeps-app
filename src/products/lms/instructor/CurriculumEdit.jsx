import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import {
  CURRICULUM_EXCEL_HEADERS, buildLearningContext, curriculumExcelTemplateRows, curriculumSectionsFromExcelRows, curriculumUnitScope, flattenUnitDays, makeLocalId,
  mergeCurriculumSections, normalizeCurriculumExercise, normalizeCurriculumSections, safeExcelFilename, sessionsFromSections, splitCurriculumList, summarizeCurriculumSections, testCourseIdList, testScopeIdOf, unitDaysOf,
} from "../../training/TrainingComponents.jsx";
import { testIdOf } from "../../training/useTraining.js";
import { setTestBuildTarget } from "../../../utils/common/courseContext.js";
import { Btn, Card, Chip, Modal } from "../parts/ui.jsx";
import { arr, errText, md } from "../staff/common.js";
import { ShelfPicker } from "../admin/CurriculumShelf.jsx";

/* カリキュラムの編集（モック curS の編集）：保存して初めて受講生に反映される。データの形・保存先は今の画面と同じ（/courses/{id}/curriculum）。
   日ごとの区切りは任意。テストは単元・日につなぐだけで、作る・直す・結果はテストの画面で開く */

const EX_TYPES = [["hands_on", "実技"], ["individual", "個人演習"], ["team", "チーム演習"], ["submission", "提出課題"]];
const lines = t => String(t || "").split("\n").map(v => v.trim()).filter(Boolean);
const newEx = () => ({ id: makeLocalId("exercise"), title: "", type: "hands_on", instructions: "", completionCriteria: "", answerExample: "", estimatedMinutes: "" });
const newDay = () => ({ id: makeLocalId("lesson"), title: "", content: "", memo: "", learningGoals: [], preparationItems: [], exercises: [], skills: [], materialIds: [], startDate: "", endDate: "", durationLabel: "" });
const newUnit = () => ({ id: makeLocalId("section"), title: "", description: "", unitMode: "lessons", content: "", learningGoals: [], preparationItems: [], exercises: [], materialIds: [], startDate: "", endDate: "", durationLabel: "", chapters: [] });
const midsOf = s => s.materialIds || (s.materialId ? [s.materialId] : []);

function ListArea({ label, value, onCommit, split = lines, placeholder }) {
  // 1 行に 1 つ。入力中に空行を消さないよう、離れたときに確定する
  const [text, setText] = useState(arr(value).join("\n"));
  useEffect(() => { setText(arr(value).join("\n")); }, [value]);
  return <label className="field">{label}<textarea rows={2} value={text} placeholder={placeholder} onChange={e => setText(e.target.value)} onBlur={() => onCommit(split(text))} /></label>;
}

function Exercises({ list, onChange, ai, aiBusy, aiErr, onAi }) {
  const [prompt, setPrompt] = useState("");
  const set = (i, patch) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="ce-b">
      <div className="head"><h4 className="h3">演習</h4><span className="r"><Chip>{list.length}</Chip><Btn kind="ghost sm" onClick={() => onChange([...list, newEx()])}>＋ 演習</Btn></span></div>
      <div className="row sx-nw"><input type="text" value={prompt} placeholder="AI に頼む（例：初心者向けの実技を 3 つ）" aria-label="AI に演習案を頼む" onChange={e => setPrompt(e.target.value)} /><Btn kind="ghost sm" disabled={!prompt.trim() || aiBusy} onClick={async () => { if (await onAi(prompt.trim(), ai)) setPrompt(""); }}>{aiBusy ? "作っています" : "AI で作る"}</Btn></div>
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

function TestsBox({ own, others, onBuild, onEdit, onResults, onLink }) {
  return (
    <div className="ce-b">
      <div className="head"><h4 className="h3">テスト</h4><span className="r"><Btn kind="ghost sm" onClick={() => onBuild("ai")}>AI で作る</Btn><Btn kind="ghost sm" onClick={() => onBuild("manual")}>＋ テスト</Btn></span></div>
      {own.map(t => <div key={testIdOf(t)} className="ce-tr"><b>{t.title}</b><Chip tone={t.status === "published" ? "ok" : "warn"}>{t.status === "published" ? "公開" : "下書き"}</Chip><span className="r"><Btn kind="ghost sm" onClick={() => onEdit(t)}>直す</Btn><Btn kind="ghost sm" onClick={() => onResults(t)}>結果</Btn></span></div>)}
      {!own.length && <Chip>なし</Chip>}
      {others.length > 0 && <label className="field">コースのテストをここにつなぐ<select className="in" value="" onChange={e => { const t = others.find(x => testIdOf(x) === e.target.value); if (t) onLink(t); }}><option value="">選ぶ</option>{others.map(t => <option key={testIdOf(t)} value={testIdOf(t)}>{t.title}</option>)}</select></label>}
    </div>
  );
}

export default function CurriculumEdit({ course, go, keys, onClose, say }) {
  const courseId = course.courseId;
  const [st, setSt] = useState("loading");
  const [sections, setSections] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [tests, setTests] = useState([]);
  const [folders, setFolders] = useState([]);
  const [open, setOpen] = useState({}); const [openDay, setOpenDay] = useState({});
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(""); const [aiBusy, setAiBusy] = useState({}); const [aiErr, setAiErr] = useState({});
  const [conf, setConf] = useState(null);
  const [picking, setPicking] = useState(false);
  const [imp, setImp] = useState(null); const [impBusy, setImpBusy] = useState(false); const [sure, setSure] = useState(false);
  const saved = useRef("");
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    apiGet(`/courses/${encodeURIComponent(courseId)}/curriculum`).then(item => {
      if (!alive) return;
      const next = flattenUnitDays(normalizeCurriculumSections(item));
      setSections(next); saved.current = JSON.stringify(next); setSt("ready");
    }).catch(() => { if (alive) setSt("error"); });
    apiGet(`/materials?courseId=${encodeURIComponent(courseId)}`).then(l => { if (alive) setMaterials(arr(l)); }).catch(() => {});
    apiGet(`/tests?courseId=${encodeURIComponent(courseId)}`).then(l => { if (alive) setTests(arr(l).filter(t => t.status !== "archived")); }).catch(() => {});
    apiGet(`/library?spaceId=${encodeURIComponent(`course#${courseId}`)}`).then(d => {
      if (!alive) return;
      const nodes = arr(d?.nodes), byId = new Map(nodes.map(n => [n.nodeId, n]));
      const label = n => { if (n.type === "shortcut") return `${n.targetName || n.name}（共有）`; const out = []; let c = n; while (c && c.nodeId !== "root") { out.unshift(c.name); c = byId.get(c.parentId); } return out.join(" / "); };
      setFolders(nodes.filter(n => n.nodeId !== "root" && (n.type === "folder" || n.type === "shortcut")).map(n => ({ nodeId: n.nodeId, name: n.type === "shortcut" ? n.targetName || n.name : n.name, label: label(n) })).sort((a, b) => a.label.localeCompare(b.label, "ja")));
    }).catch(() => {});
    return () => { alive = false; };
  }, [courseId]);

  const mats = useMemo(() => Object.fromEntries(materials.map(m => [m.materialId, m])), [materials]);
  const dirty = st === "ready" && JSON.stringify(sections) !== saved.current;
  const setSec = (si, patch) => setSections(xs => xs.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const setDay = (si, li, patch) => setSections(xs => xs.map((s, i) => (i !== si ? s : { ...s, chapters: arr(s.chapters).map((c, j) => (j !== 0 ? c : { ...c, lessons: arr(c.lessons).map((l, k) => (k === li ? { ...l, ...patch, ...(patch.materialIds ? { materialId: undefined } : {}) } : l)) })) })));
  const addDay = si => setSections(xs => xs.map((s, i) => { if (i !== si) return s; const ch = arr(s.chapters)[0] || { id: makeLocalId("chapter"), title: "", description: "", lessons: [] }; return { ...s, chapters: [{ ...ch, lessons: [...arr(ch.lessons), newDay()] }] }; }));
  const delDay = (si, li) => setSections(xs => xs.map((s, i) => (i !== si ? s : { ...s, chapters: arr(s.chapters).map((c, j) => (j !== 0 ? c : { ...c, lessons: arr(c.lessons).filter((_, k) => k !== li) })) })));

  async function save() {
    if (busy) return false;
    setBusy(true); setErr("");
    try {
      // 日ごとの区切りがある単元は日単位、ない単元は単元そのものを「今日の単元」の判定に使う
      const out = sections.map(s => ({ ...s, unitMode: unitDaysOf(s).length ? "lessons" : "section" }));
      await apiPut(`/courses/${encodeURIComponent(courseId)}/curriculum`, { sections: out, sessions: sessionsFromSections(out) });
      saved.current = JSON.stringify(sections);
      say?.("保存しました");
      return true;
    } catch (e) { setErr(errText(e, "保存できませんでした")); return false; } finally { setBusy(false); }
  }
  const upload = async (file, key, attach) => {
    setUploading(key); setErr("");
    try {
      const contentType = file.type || "application/octet-stream";
      const { uploadUrl, materialId, s3key } = await apiPost("/materials/upload-url", { courseId, filename: file.name, contentType });
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      if (!put.ok) throw new Error("ファイルを送れませんでした");
      const title = file.name.replace(/\.[^.]+$/, "") || file.name;
      await apiPost("/materials", { courseId, materialId, s3key, title, filename: file.name });
      setMaterials(ms => [...ms, { courseId, materialId, title, s3key, filename: file.name }]);
      attach(materialId);
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
  const leaveTo = fn => { if (dirty) setConf({ title: "保存していない変更があります", ok: "保存せずに移る", run: fn }); else fn(); };
  const toTests = target => leaveTo(() => { setTestBuildTarget({ courseId, ...target }); go(keys.test); });
  const linkTest = async (t, fields) => {
    setErr("");
    try { const u = await apiPut(`/tests/${testIdOf(t)}`, { courseScopes: { [courseId]: fields } }); setTests(l => l.map(x => (testIdOf(x) === testIdOf(t) ? { ...x, ...(u?.testId ? u : {}), ...fields } : x))); say?.("つなぎました"); }
    catch (e) { setErr(errText(e, "テストをつなげませんでした")); }
  };
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
  // 棚の単元をコースへ。日付は空のまま。テストはこのコースにつなぐ（保存を待たずに）
  const addFromShelf = async units => {
    setPicking(false); setErr("");
    const made = units.map(u => ({ ...newUnit(), title: u.title, content: u.content || "", learningGoals: arr(u.goals), exercises: arr(u.exercises).map(x => ({ ...x, id: makeLocalId("exercise") })) }));
    setSections(xs => [...xs, ...made]);
    setOpen(o => ({ ...o, ...Object.fromEntries(made.map(m => [m.id, true])) }));
    const links = units.flatMap((u, i) => arr(u.testIds).map(id => ({ id, sec: made[i] })));
    const failed = [];
    for (const l of links) {
      const t = tests.find(x => testIdOf(x) === l.id), scope = curriculumUnitScope(l.sec, null, null, "section").fields;
      try {
        // eslint-disable-next-line no-await-in-loop
        const full = t || arr(await apiGet("/tests")).find(x => testIdOf(x) === l.id);
        if (!full) throw new Error("not found");
        // eslint-disable-next-line no-await-in-loop
        await apiPut(`/tests/${encodeURIComponent(l.id)}`, { courseIds: [...new Set([...testCourseIdList(full), courseId])], courseScopes: { [courseId]: scope } });
        setTests(ts => (ts.some(x => testIdOf(x) === l.id) ? ts.map(x => (testIdOf(x) === l.id ? { ...x, ...scope } : x)) : [...ts, { ...full, ...scope }]));
      } catch { failed.push(l.id); }
    }
    if (failed.length) setErr(`テスト ${failed.length} 件をつなげませんでした`);
    say?.(`${made.length} 単元を足しました ・ 保存はまだです`);
  };
  const applyImp = mode => {
    if (mode === "replace" && sections.length && !sure) { setSure(true); return; }
    setSections(mode === "merge" ? flattenUnitDays(mergeCurriculumSections(sections, imp.sections)) : flattenUnitDays(imp.sections));
    setImp(null);
    say?.("反映しました ・ 保存はまだです");
  };

  if (st === "loading") return <div className="soon card">読み込み中</div>;
  if (st === "error") return <Card><div className="empty"><b>カリキュラムを確認できません</b><Btn kind="ghost sm" onClick={onClose}>戻る</Btn></div></Card>;

  const scopeTests = (scopeId, own) => ({ own, others: tests.filter(t => testScopeIdOf(t) !== scopeId && !own.includes(t)) });
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{course.name}</div><h1 className="h1">カリキュラムの編集</h1></div>
        <span className="r">{dirty ? <Chip tone="warn">保存していない変更</Chip> : <Chip>保存済み</Chip>}<Btn kind="ghost sm" onClick={exportTemplate}>Excel ひな形</Btn><Btn kind="ghost sm" disabled={impBusy} onClick={() => fileRef.current?.click()}>{impBusy ? "読んでいます" : "Excel 読み込み"}</Btn><Btn kind="ghost sm" onClick={() => leaveTo(onClose)}>やめる</Btn><Btn kind="sm" disabled={busy || !dirty} onClick={save}>{busy ? "保存しています" : "確定する"}</Btn></span>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="lms-sr" aria-label="Excel を選ぶ" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) readExcel(f); }} />
      {err && <div className="lms-err" role="alert">{err}</div>}
      <div className="cu-list">
        {sections.map((s, si) => {
          const on = !!open[s.id], days = unitDaysOf(s), unitScope = curriculumUnitScope(s, null, null, "section");
          const own = tests.filter(t => t.sectionId === s.id && !t.lessonId && !t.chapterId);
          const box = scopeTests(unitScope.scopeId, own);
          return (
            <section key={s.id} className={`card cu-u${on ? " on" : ""}`}>
              <button type="button" className="cu-h" aria-expanded={on} onClick={() => setOpen(o => ({ ...o, [s.id]: !o[s.id] }))}>
                <span className="cu-n num">{si + 1}</span>
                <span className="cu-t"><b>{s.title || "名前のない単元"}</b><small className="num">{s.startDate ? `${md(s.startDate)}${s.endDate ? `〜${md(s.endDate)}` : ""}` : "日程なし"}{days.length ? ` ・ ${days.length} 日` : ""}</small></span>
                <span className="row">{own.length > 0 && <Chip>テスト {own.length}</Chip>}{arr(s.exercises).length > 0 && <Chip>演習 {arr(s.exercises).length}</Chip>}</span>
                <i className="cu-cv" aria-hidden="true">▾</i>
              </button>
              {on && (
                <div className="cu-b ce">
                  <div className="ce-g3"><label className="field">単元名<input type="text" value={s.title || ""} onChange={e => setSec(si, { title: e.target.value })} /></label><label className="field">開始日<input type="date" value={s.startDate || ""} onChange={e => setSec(si, { startDate: e.target.value })} /></label><label className="field">終了日<input type="date" value={s.endDate || ""} onChange={e => setSec(si, { endDate: e.target.value })} /></label></div>
                  <label className="field">説明<input type="text" value={s.description || ""} onChange={e => setSec(si, { description: e.target.value })} /></label>
                  <label className="field">この単元で学ぶ内容<textarea rows={2} value={s.content || ""} onChange={e => setSec(si, { content: e.target.value })} /></label>
                  <div className="st-fg"><ListArea label="目標（1 行に 1 つ）" value={s.learningGoals} onCommit={v => setSec(si, { learningGoals: v })} /><ListArea label="事前に用意すること（1 行に 1 つ）" value={s.preparationItems} split={splitCurriculumList} onCommit={v => setSec(si, { preparationItems: v })} /></div>
                  <label className="field">期間の表示（例：1〜3 日目）<input type="text" value={s.durationLabel || ""} onChange={e => setSec(si, { durationLabel: e.target.value })} /></label>
                  <Attach ids={arr(s.materialIds)} mats={mats} folders={folders} links={s.folderLinks} onIds={v => setSec(si, { materialIds: v })} onLinks={v => setSec(si, { folderLinks: v })} uploading={uploading === `s:${s.id}`} onOpen={openMat} onUpload={f => upload(f, `s:${s.id}`, id => setSections(xs => xs.map((x, i) => (i === si ? { ...x, materialIds: [...arr(x.materialIds).filter(v => v !== id), id] } : x))))} />
                  <Exercises list={arr(s.exercises)} onChange={v => setSec(si, { exercises: v })} aiBusy={!!aiBusy[`s:${s.id}`]} aiErr={aiErr[`s:${s.id}`]} onAi={request => genAi(`s:${s.id}`, request, { scopeType: "section", sectionTitle: s.title, learningContext: buildLearningContext({ section: s, lessons: [], materialsById: mats }) }, made => setSec(si, { exercises: [...arr(s.exercises), ...made] }))} />
                  <TestsBox own={box.own} others={box.others} onBuild={mode => toTests({ scopeId: unitScope.scopeId, title: unitScope.title, mode })} onEdit={t => toTests({ testId: testIdOf(t) })} onResults={t => toTests({ testId: testIdOf(t), results: true })} onLink={t => linkTest(t, unitScope.fields)} />
                  <div className="ce-b">
                    <div className="head"><h4 className="h3">日ごと</h4><span className="r"><Chip>{days.length} 日</Chip><Btn kind="ghost sm" onClick={() => { addDay(si); setOpenDay(o => ({ ...o, [`${s.id}:${days.length}`]: true })); }}>＋ 日</Btn></span></div>
                    {days.map((d, li) => {
                      const k = `${s.id}:${li}`, dOn = !!openDay[k], ch = arr(s.chapters)[0], dScope = curriculumUnitScope(s, ch, d, "lesson");
                      const dOwn = tests.filter(t => t.lessonId === d.id), dBox = scopeTests(dScope.scopeId, dOwn), ids = midsOf(d);
                      return (
                        <div key={d.id || li} className={`ce-d${dOn ? " on" : ""}`}>
                          <button type="button" className="ce-dh" aria-expanded={dOn} onClick={() => setOpenDay(o => ({ ...o, [k]: !o[k] }))}><span className="num">{d.startDate ? md(d.startDate) : "日付なし"}</span><b>{d.title || "名前なし"}</b><i className="cu-cv" aria-hidden="true">▾</i></button>
                          {dOn && (
                            <div className="ce-db">
                              <div className="ce-g3"><label className="field">この日の内容<input type="text" value={d.title || ""} onChange={e => setDay(si, li, { title: e.target.value })} /></label><label className="field">開始日<input type="date" value={d.startDate || ""} onChange={e => setDay(si, li, { startDate: e.target.value })} /></label><label className="field">終了日<input type="date" value={d.endDate || ""} onChange={e => setDay(si, li, { endDate: e.target.value })} /></label></div>
                              <div className="st-fg"><label className="field">学習内容<textarea rows={2} value={d.content || ""} onChange={e => setDay(si, li, { content: e.target.value })} /></label><label className="field">講師メモ（受講生に出さない）<textarea rows={2} value={d.memo || ""} onChange={e => setDay(si, li, { memo: e.target.value })} /></label></div>
                              <div className="st-fg"><ListArea label="この日の目標（1 行に 1 つ）" value={d.learningGoals} onCommit={v => setDay(si, li, { learningGoals: v })} /><ListArea label="この日までに用意すること（1 行に 1 つ）" value={d.preparationItems} split={splitCurriculumList} onCommit={v => setDay(si, li, { preparationItems: v })} /></div>
                              <label className="field">期間の表示（例：3 日目）<input type="text" value={d.durationLabel || ""} onChange={e => setDay(si, li, { durationLabel: e.target.value })} /></label>
                              <Attach ids={ids} mats={mats} folders={folders} links={d.folderLinks} onIds={v => setDay(si, li, { materialIds: v })} onLinks={v => setDay(si, li, { folderLinks: v })} uploading={uploading === `d:${d.id}`} onOpen={openMat} onUpload={f => upload(f, `d:${d.id}`, id => setDay(si, li, { materialIds: [...ids.filter(v => v !== id), id] }))} />
                              <Exercises list={arr(d.exercises)} onChange={v => setDay(si, li, { exercises: v })} aiBusy={!!aiBusy[`d:${d.id}`]} aiErr={aiErr[`d:${d.id}`]} onAi={request => genAi(`d:${d.id}`, request, { scopeType: "lesson", sectionTitle: s.title, chapterTitle: ch?.title, lessonTitle: d.title, learningContext: buildLearningContext({ section: s, chapter: ch, lessons: [d], materialsById: mats }) }, made => setDay(si, li, { exercises: [...arr(d.exercises), ...made] }))} />
                              <TestsBox own={dBox.own} others={dBox.others} onBuild={mode => toTests({ scopeId: dScope.scopeId, title: dScope.title, mode })} onEdit={t => toTests({ testId: testIdOf(t) })} onResults={t => toTests({ testId: testIdOf(t), results: true })} onLink={t => linkTest(t, dScope.fields)} />
                              <span className="row st-end"><Btn kind="ghost sm" onClick={() => setConf({ title: `「${d.title || "この日"}」を消す`, ok: "消す", run: () => delDay(si, li) })}>この日を消す</Btn></span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {!days.length && <Chip>なし</Chip>}
                  </div>
                  <span className="row st-end"><Btn kind="ghost sm" onClick={() => setConf({ title: `「${s.title || "この単元"}」を消す`, ok: "消す", run: () => setSections(xs => xs.filter((_, i) => i !== si)) })}>この単元を外す</Btn></span>
                </div>
              )}
            </section>
          );
        })}
        <button type="button" className="ce-add" onClick={() => { const u = newUnit(); setSections(xs => [...xs, u]); setOpen(o => ({ ...o, [u.id]: true })); }}>空の単元を足す</button>
        <button type="button" className="ce-add" onClick={() => setPicking(true)}>共通の棚から足す</button>
      </div>
      {picking && <ShelfPicker onClose={() => setPicking(false)} onPick={addFromShelf} />}
      {conf && <Modal title={conf.title} width={440} onClose={() => setConf(null)} footer={<><Btn kind="ghost" onClick={() => setConf(null)}>やめる</Btn><Btn onClick={() => { const c = conf; setConf(null); c.run(); }}>{conf.ok}</Btn></>}><Chip tone="warn">{conf.ok === "消す" ? "保存するまで受講生には反映されない" : "保存していない変更は消える"}</Chip></Modal>}
      {imp && (
        <Modal title={`Excel の確認 ・ ${imp.fileName}`} width={520} onClose={() => setImp(null)} footer={<><Btn kind="ghost" onClick={() => setImp(null)}>やめる</Btn>{sections.length > 0 && <Btn kind="ghost" onClick={() => applyImp("merge")}>今の内容に足す</Btn>}<Btn onClick={() => applyImp("replace")}>{sure ? "本当に置き換える" : sections.length ? "今の内容と置き換える" : "反映する"}</Btn></>}>
          <div className="row"><Chip>単元 {imp.summary.sections}</Chip><Chip>日 {imp.summary.lessons}</Chip><Chip>事前準備 {imp.summary.preparations}</Chip><Chip>演習 {imp.summary.exercises}</Chip></div>
          {sure && <Chip tone="bad">今の編集内容は消える</Chip>}
          <Chip tone="warn">反映のあと「保存」を押すまで受講生には出ない</Chip>
        </Modal>
      )}
    </div>
  );
}
