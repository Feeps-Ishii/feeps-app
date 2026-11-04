import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { makeLocalId, sessionsFromSections, testCourseIdList } from "../../training/TrainingComponents.jsx";
import { relayoutCurriculum } from "../../console/materials.js";
import { extractPdfPageTexts } from "../../training/pdfText.js";
import { Btn, Chip, Modal } from "../parts/ui.jsx";
import { arr, errText } from "../staff/common.js";
import { JP_HOLIDAYS } from "../parts/jpHolidays.js";

/* コースを作る（モック cwModal）：白紙・ひな形 Excel・研修計画書・文で伝える・前のコースを写す → 確かめて作る。
   Excel はモックのひな形（public/templates/training-template.xlsx）。計画書と文は AI が読むだけで、作るのは確かめたあと。
   できあがりは下書き。受講生は名簿の窓（アカウントを作る決まりは今のまま）へ渡す */

const SOURCES = [["blank", "白紙から"], ["excel", "ひな形 Excel"], ["doc", "研修計画書"], ["text", "文で伝える"], ["copy", "前のコースを写す"]];
const WEEK = { "月〜金": [1, 2, 3, 4, 5], "月〜土": [1, 2, 3, 4, 5, 6], 毎日: [0, 1, 2, 3, 4, 5, 6] };
const EMPTY = { name: "", companyId: "", companyName: "", startDate: "", endDate: "", week: "月〜金", clockIn: "09:00", clockOut: "18:00", noHolidays: true, offDays: [], instructorIds: [], managerIds: [], units: [], trainees: [], later: [] };
const utc = iso => Date.parse(`${iso}T00:00:00Z`);
const toIso = t => new Date(t).toISOString().slice(0, 10);
const dateOf = v => {
  if (typeof v === "number" && Number.isFinite(v)) return toIso(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
  const m = String(v || "").trim().match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : "";
};
const timeOf = v => {
  if (typeof v === "number" && Number.isFinite(v)) { const f = v % 1, min = Math.round(f * 1440); return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`; }
  const m = String(v || "").trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
};
const norm = s => String(s || "").replace(/[\s　]/g, "");

// 研修の日：曜日のうち、祝日と会社の休みを除く
function trainingDays(v) {
  if (!v.startDate || !v.endDate || v.startDate > v.endDate) return [];
  const out = [], wk = WEEK[v.week] || WEEK["月〜金"], off = new Set(v.offDays);
  for (let t = utc(v.startDate), end = utc(v.endDate), i = 0; t <= end && i < 800; t += 86400000, i++) {
    const iso = toIso(t);
    if (wk.includes(new Date(t).getUTCDay()) && !off.has(iso) && !(v.noHolidays && JP_HOLIDAYS[iso])) out.push(iso);
  }
  return out;
}

async function readExcel(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const rows = name => (wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true }) : null);
  const info = rows("コース情報");
  if (!info) throw new Error("「コース情報」のシートがありません。ひな形から作ってください");
  const get = label => info.find(r => norm(r[0]) === norm(label))?.[1];
  const off = arr(rows("休み")).slice(4).filter(r => r[0] && norm(r[2]) !== "祝日").map(r => dateOf(r[0])).filter(Boolean);
  const people = arr(rows("メンバー")).filter(r => norm(r[0]) !== "例" && norm(r[1]) && norm(r[3]) && norm(r[1]) !== "氏名");
  const units = arr(rows("カリキュラム")).filter(r => norm(r[0]) !== "例" && norm(r[1]) && norm(r[1]) !== "単元名" && Number(r[2]) > 0)
    .map(r => ({ title: String(r[1]).trim(), days: Number(r[2]), goal: String(r[5] || "").trim(), note: String(r[8] || "").trim(), test: String(r[6] || "").trim(), prac: String(r[7] || "").trim() }));
  return {
    ...EMPTY,
    name: String(get("コース名") || "").trim(), companyName: String(get("企業名") || "").trim(),
    startDate: dateOf(get("始まりの日")), endDate: dateOf(get("終わりの日")),
    week: WEEK[String(get("研修の曜日") || "").trim()] ? String(get("研修の曜日")).trim() : "月〜金",
    clockIn: timeOf(get("始まりの時刻")) || "09:00", clockOut: timeOf(get("終わりの時刻")) || "18:00",
    noHolidays: String(get("祝日を休みにする") || "はい").trim() !== "いいえ", offDays: [...new Set(off)], units,
    staffNames: { ins: people.filter(r => norm(r[3]) === "講師").map(r => r[1]), mgr: people.filter(r => norm(r[3]) === "コース担当者").map(r => r[1]) },
    clients: people.filter(r => norm(r[3]) === "企業担当者").map(r => String(r[1]).trim()),
    trainees: people.filter(r => norm(r[3]) === "受講生").map(r => [String(r[1]).trim(), String(r[2] || "").trim(), String(r[4] || "").trim()]),
    later: [...new Set(units.flatMap(u => [u.test, u.prac]).filter(Boolean))],
  };
}

async function readDocText(file) {
  const name = file.name.toLowerCase();
  if (/\.pdf$/.test(name)) {
    const url = URL.createObjectURL(file);
    try { const r = await extractPdfPageTexts(url, { maxPages: 12 }); return arr(r?.pages).map(p => p.text).join("\n"); } finally { URL.revokeObjectURL(url); }
  }
  if (/\.(xlsx|xls|csv)$/.test(name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return wb.SheetNames.slice(0, 6).map(n => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n");
  }
  if (/\.txt$/.test(name)) return file.text();
  throw new Error("PDF・Excel・テキストにしてください（Word は PDF にしてから）");
}

export default function CourseCreate({ companies, courses, onClose, onDone }) {
  const [step, setStep] = useState(1);
  const [src, setSrc] = useState("blank");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [from, setFrom] = useState(courses[0]?.courseId || "");
  const [take, setTake] = useState({ cur: true, tests: true, rf: true, fx: true, ins: true });
  const [v, setV] = useState({ ...EMPTY });
  const [people, setPeople] = useState({ ins: [], mgr: [] });
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [note, setNote] = useState("");
  const [offText, setOffText] = useState("");
  useEffect(() => {
    apiGet("/admin/instructors").then(l => setPeople(p => ({ ...p, ins: arr(l) }))).catch(() => {});
    apiGet("/admin/users").then(l => setPeople(p => ({ ...p, mgr: arr(l).filter(u => u.role === "manager") }))).catch(() => {});
  }, []);
  const set = patch => setV(x => ({ ...x, ...patch }));
  const days = useMemo(() => trainingDays(v), [v]);
  const unitDays = v.units.reduce((a, u) => a + (Number(u.days) || 0), 0);
  const co = id => companies.find(x => x.companyId === id);
  // 名前から企業・担当を見つける（見つからないものは確認で決める）
  const fill = next => {
    const hit = companies.find(c => norm(c.name) === norm(next.companyName));
    const ids = (names, list) => list.filter(p => arr(names).some(n => norm(n) === norm(p.name))).map(p => p.userId);
    setV({ ...EMPTY, ...next, companyId: next.companyId || hit?.companyId || "", instructorIds: next.instructorIds?.length ? next.instructorIds : ids(next.staffNames?.ins, people.ins), managerIds: next.managerIds?.length ? next.managerIds : ids(next.staffNames?.mgr, people.mgr) });
    setOffText(arr(next.offDays).join(" "));
    setStep(2);
  };
  const next = async () => {
    setErr("");
    if (src === "blank") { fill({}); return; }
    setBusy("read");
    try {
      if (src === "excel") { if (!file) throw new Error("Excel を選んでください"); fill(await readExcel(file)); return; }
      if (src === "copy") {
        const c = courses.find(x => x.courseId === from);
        if (!c) throw new Error("写すコースを選んでください");
        fill({ name: `${c.name} のコピー`, companyId: c.companyId || "", instructorIds: take.ins ? arr(c.instructorIds) : [], clockIn: c.standardClockIn || "09:00" });
        return;
      }
      const body = src === "text" ? text.trim() : file ? await readDocText(file) : "";
      if (!body.trim()) throw new Error(src === "text" ? "決まっていることを書いてください" : "ファイルを選んでください（文字が読めない PDF は文で伝えるにしてください）");
      const r = await apiPost("/ai/course-plan", { text: body.slice(0, 12000) });
      const p = r?.plan || {};
      fill({ name: p.name || "", companyName: p.companyName || "", startDate: dateOf(p.startDate), endDate: dateOf(p.endDate), week: WEEK[p.week] ? p.week : "月〜金", clockIn: timeOf(p.clockIn) || "09:00", clockOut: timeOf(p.clockOut) || "18:00", offDays: arr(p.offDays).map(dateOf).filter(Boolean), units: arr(p.units).map(u => ({ title: String(u.title || "").trim(), days: Number(u.days) || 1, goal: String(u.goal || "").trim(), note: "" })).filter(u => u.title), staffNames: { ins: arr(p.instructors) } });
      setNote("AI の読み取りです。確かめてから作ってください");
    } catch (e) { setErr(errText(e, "読み取れませんでした")); } finally { setBusy(""); }
  };
  const setUnit = (i, patch) => set({ units: v.units.map((u, j) => (j === i ? { ...u, ...patch } : u)) });
  const make = async () => {
    if (!v.name.trim()) { setErr("コースの名前を入れてください"); return; }
    if (v.startDate && v.endDate && v.startDate > v.endDate) { setErr("終わりの日は始まりの日より後にしてください"); return; }
    setBusy("make"); setErr("");
    const warn = [];
    let id = "";
    try {
      const c = await apiPost("/courses", { name: v.name.trim(), kind: "shinjin", description: "" });
      id = c?.courseId || c?.item?.courseId;
      if (!id) throw new Error("コースを作れませんでした");
      await apiPut(`/courses/${encodeURIComponent(id)}`, { name: v.name.trim(), type: "shinjin", memo: "", startDate: v.startDate, endDate: v.endDate, companyId: v.companyId, standardClockIn: v.clockIn, standardClockOut: v.clockOut, instructorIds: v.instructorIds, managerIds: v.managerIds });
    } catch (e) { setErr(errText(e, "作れませんでした")); setBusy(""); return; }
    const step1 = async (label, fn) => { try { await fn(); } catch (e) { warn.push(`${label}：${errText(e, "できませんでした")}`); } };
    // 既定は期間内の月〜金が研修日。違うところだけ暦に書く
    if (v.startDate && v.endDate) {
      await step1("研修日", async () => {
        const on = new Set(days), items = [];
        for (let t = utc(v.startDate), end = utc(v.endDate), i = 0; t <= end && i < 800; t += 86400000, i++) {
          const iso = toIso(t), wd = new Date(t).getUTCDay(), def = wd >= 1 && wd <= 5;
          if (on.has(iso) !== def) items.push({ date: iso, type: on.has(iso) ? "training" : "holiday", isTrainingDay: on.has(iso), title: JP_HOLIDAYS[iso] || "" });
        }
        for (let i = 0; i < items.length; i += 20) {
          // eslint-disable-next-line no-await-in-loop
          await apiPut(`/courses/${encodeURIComponent(id)}/calendar`, { items: items.slice(i, i + 20) });
        }
      });
    }
    if (src === "copy") {
      const fromQ = encodeURIComponent(from);
      if (take.cur && v.startDate) await step1("カリキュラム", async () => { const cur = await apiGet(`/courses/${fromQ}/curriculum`); const plan = relayoutCurriculum(cur, v.startDate); await apiPut(`/courses/${encodeURIComponent(id)}/curriculum`, { sections: plan.sections, sessions: plan.sessions }); });
      if (take.tests) await step1("テスト", async () => { const ts = arr(await apiGet(`/tests?courseId=${fromQ}`)).filter(t => t.status !== "archived"); await Promise.all(ts.map(t => apiPut(`/tests/${encodeURIComponent(t.testId)}`, { courseIds: [...new Set([...testCourseIdList(t), id])], courseScopes: { [id]: Object.fromEntries(["scopeType", "sectionId", "sectionTitle", "chapterId", "chapterTitle", "lessonId", "lessonTitle"].map(k => [k, t[k] || ""])) } }))); });
      if (take.rf) await step1("日報の項目", async () => { const rf = await apiGet(`/courses/${fromQ}/report-settings`); if (arr(rf?.fields).length) await apiPut(`/courses/${encodeURIComponent(id)}/report-settings`, { fields: rf.fields }); });
      if (take.fx) await step1("使う機能", async () => { const cfg = await apiGet(`/course-config?courseId=${fromQ}`); await apiPut("/course-config", { courseId: id, features: cfg.features, remind: cfg.remind }); });
    } else if (v.units.length) {
      await step1("カリキュラム", async () => {
        let at = 0;
        const sections = v.units.map(u => {
          const n = Math.max(1, Number(u.days) || 1), a = days[at] || "", b = days[at + n - 1] || days[days.length - 1] || "";
          at += n;
          return { id: makeLocalId("section"), title: u.title, description: u.note || "", unitMode: "section", content: "", learningGoals: u.goal ? [u.goal] : [], preparationItems: [], exercises: [], materialIds: [], startDate: a, endDate: b, durationLabel: "", chapters: [] };
        });
        await apiPut(`/courses/${encodeURIComponent(id)}/curriculum`, { sections, sessions: sessionsFromSections(sections) });
      });
    }
    setBusy("");
    onDone(id, { warn, roster: v.trainees.length ? [["氏名", "ふりがな", "メールアドレス"], ...v.trainees] : null });
  };
  const toggle = (k, id, on) => set({ [k]: on ? [...new Set([...v[k], id])] : v[k].filter(x => x !== id) });

  if (step === 1) {
    return (
      <Modal title="コースを作る" width={560} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={!!busy} onClick={next}>{busy ? "読んでいます" : "次へ"}</Btn></>}>
        <div className="field">何から作る<span className="seg cw-seg">{SOURCES.map(([k, t]) => <button key={k} type="button" aria-pressed={src === k} onClick={() => { setSrc(k); setFile(null); setErr(""); }}>{t}</button>)}</span></div>
        {src === "excel" && <><a className="btn ghost sm cw-a" href="/templates/training-template.xlsx" download="研修情報ひな形.xlsx">ひな形を受け取る</a><label className="field">埋めた Excel<input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files?.[0] || null)} /></label></>}
        {src === "doc" && <><label className="field">研修計画書（PDF・Excel・テキスト）<input type="file" accept=".pdf,.xlsx,.xls,.csv,.txt" onChange={e => setFile(e.target.files?.[0] || null)} /></label><Chip tone="mk">AI が読み取る ・ 次で確かめる</Chip></>}
        {src === "text" && <><label className="field">決まっていること<textarea rows={4} maxLength={6000} value={text} placeholder="例：2027/4/1〜6/30、月〜金 9時〜18時。講師は山口さん" onChange={e => setText(e.target.value)} /></label><Chip tone="mk">AI が読み取る ・ 次で確かめる</Chip></>}
        {src === "copy" && (
          <>
            <label className="field">写すコース<select className="in" value={from} onChange={e => setFrom(e.target.value)}>{courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}</select></label>
            <div className="field">写すもの<span className="row">{[["cur", "カリキュラム"], ["tests", "テスト"], ["rf", "日報の項目"], ["fx", "使う機能"], ["ins", "講師"]].map(([k, t]) => <label key={k} className="st-ck"><input type="checkbox" checked={take[k]} onChange={e => setTake(x => ({ ...x, [k]: e.target.checked }))} />{t}</label>)}</span></div>
            <Chip>受講生・日報・結果は写さない</Chip>
          </>
        )}
        {err && <div className="lms-err" role="alert">{err}</div>}
      </Modal>
    );
  }
  return (
    <Modal title="確かめて作る" width={680} onClose={onClose} footer={<><Btn kind="ghost" disabled={!!busy} onClick={() => setStep(1)}>← 戻る</Btn><Btn disabled={!!busy} onClick={make}>{busy ? "作っています" : "下書きで作る"}</Btn></>}>
      {note && <Chip tone="mk">{note}</Chip>}
      <label className="field">名前<input type="text" maxLength={80} value={v.name} onChange={e => set({ name: e.target.value })} /></label>
      <label className="field">企業{v.companyName && !v.companyId && <Chip tone="warn">「{v.companyName}」が見つかりません</Chip>}<select className="in" value={v.companyId} onChange={e => set({ companyId: e.target.value })}><option value="">未定</option>{companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}</select></label>
      <div className="st-fg"><label className="field">開始日<input type="date" value={v.startDate} onChange={e => set({ startDate: e.target.value })} /></label><label className="field">終了日<input type="date" value={v.endDate} onChange={e => set({ endDate: e.target.value })} /></label></div>
      <div className="ce-g3"><label className="field">研修の曜日<select className="in" value={v.week} onChange={e => set({ week: e.target.value })}>{Object.keys(WEEK).map(k => <option key={k}>{k}</option>)}</select></label><label className="field">始まり<input type="time" value={v.clockIn} onChange={e => set({ clockIn: e.target.value })} /></label><label className="field">終わり<input type="time" value={v.clockOut} onChange={e => set({ clockOut: e.target.value })} /></label></div>
      <div className="row"><label className="st-ck"><input type="checkbox" checked={v.noHolidays} onChange={e => set({ noHolidays: e.target.checked })} />祝日を休みにする</label><Chip tone={days.length ? "mk" : "warn"}>研修日 {days.length} 日</Chip></div>
      <label className="field">会社の休み（日付を空白で区切る）<input type="text" value={offText} placeholder="2027-05-06 2027-06-01" onChange={e => { setOffText(e.target.value); set({ offDays: e.target.value.split(/[\s,、]+/).map(dateOf).filter(Boolean) }); }} /></label>
      <div className="field">講師<span className="row">{people.ins.map(p => <label key={p.userId} className="st-ck"><input type="checkbox" checked={v.instructorIds.includes(p.userId)} onChange={e => toggle("instructorIds", p.userId, e.target.checked)} />{p.name || "名前未設定"}</label>)}{!people.ins.length && <Chip>なし</Chip>}</span>{arr(v.staffNames?.ins).filter(n => !people.ins.some(p => norm(p.name) === norm(n))).map(n => <Chip key={n} tone="warn">「{n}」が見つかりません</Chip>)}</div>
      {people.mgr.length > 0 && <div className="field">コース担当者<span className="row">{people.mgr.map(p => <label key={p.userId} className="st-ck"><input type="checkbox" checked={v.managerIds.includes(p.userId)} onChange={e => toggle("managerIds", p.userId, e.target.checked)} />{p.name || "名前未設定"}</label>)}</span></div>}
      {src !== "copy" && (
        <div className="field">単元<span className="row"><Chip tone={v.units.length && unitDays !== days.length ? "warn" : ""}>日数の合計 {unitDays} / 研修日 {days.length}</Chip><Btn kind="ghost sm" onClick={() => set({ units: [...v.units, { title: "", days: 1, goal: "", note: "" }] })}>＋ 単元</Btn></span>
          {v.units.map((u, i) => <div key={i} className="cw-u"><span className="num">{i + 1}</span><input type="text" value={u.title} placeholder="単元名" aria-label="単元名" onChange={e => setUnit(i, { title: e.target.value })} /><input type="number" min="1" value={u.days} aria-label="日数" onChange={e => setUnit(i, { days: e.target.value })} /><button type="button" className="x2" aria-label={`単元 ${i + 1} を消す`} onClick={() => set({ units: v.units.filter((_, j) => j !== i) })}>×</button></div>)}
        </div>
      )}
      <div className="row">
        {v.trainees.length > 0 && <Chip tone="mk">受講生 {v.trainees.length} 人 ・ 作ったあと名簿の窓へ</Chip>}
        {arr(v.clients).length > 0 && <Chip>企業担当者 {v.clients.length} 人 ・ ユーザーの画面で</Chip>}
        {v.later.length > 0 && <Chip>テスト・練習問題の名前 {v.later.length} 件 ・ あとでつなぐ</Chip>}
      </div>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}
