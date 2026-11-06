import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { Btn, Card, Chip, Modal } from "../parts/ui.jsx";
import { arr, errText, md, useStaffCourse, useWorkdays } from "../staff/common.js";
import { todayStr } from "../../training/useTraining.js";
import CourseConfig from "../staff/CourseConfig.jsx";
import { JP_HOLIDAYS } from "../parts/jpHolidays.js";

/* コースの設定（モック settingX）：基本・研修日・日報の項目・担当。編集 → 確定で保存する。
   研修日を変えられるのは管理者だけ（API の決まり）。講師は見るだけ */

const TABS = [["base", "基本"], ["days", "研修日"], ["rf", "日報の項目"], ["who", "担当"], ["notice", "リマインド"], ["ai", "AI"]];

function Days({ courseId, canEdit, say, startDate, endDate }) {
  const today = todayStr();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [key, setKey] = useState(0);
  const wd = useWorkdays(courseId, `${month}${key ? "" : ""}`);
  const [busy, setBusy] = useState("");
  const [extra, setExtra] = useState({});
  const [err, setErr] = useState("");
  useEffect(() => { setExtra({}); }, [month, key]);
  const [y, m] = month.split("-").map(Number);
  const move = n => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const first = new Date(y, m - 1, 1), blanks = (first.getDay() + 6) % 7, last = new Date(y, m, 0).getDate();
  const isOn = iso => (iso in extra ? extra[iso] : wd.dates.includes(iso));
  const toggle = async iso => {
    const on = !isOn(iso);
    setBusy(iso); setErr("");
    try { await apiPut(`/courses/${encodeURIComponent(courseId)}/calendar`, { items: [{ date: iso, type: on ? "training" : "holiday", isTrainingDay: on }] }); setExtra(x => ({ ...x, [iso]: on })); say?.(`${md(iso)} を${on ? "研修日" : "休み"}にしました`); }
    catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(""); }
  };
  const putHolidays = async () => {
    const days = Object.keys(JP_HOLIDAYS).filter(d => d >= startDate && d <= endDate);
    if (!days.length) { say?.("期間に祝日はありません"); return; }
    setBusy("hol"); setErr("");
    try {
      for (let i = 0; i < days.length; i += 20) {
        // eslint-disable-next-line no-await-in-loop
        await apiPut(`/courses/${encodeURIComponent(courseId)}/calendar`, { items: days.slice(i, i + 20).map(date => ({ date, type: "holiday", isTrainingDay: false, title: JP_HOLIDAYS[date] })) });
      }
      setExtra(x => ({ ...x, ...Object.fromEntries(days.map(d => [d, false])) }));
      say?.(`祝日 ${days.length} 日を休みにしました`);
    } catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(""); }
  };
  const n = Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter(isOn).length;
  return (
    <Card className="pad">
      <div className="head"><h2 className="h2">研修日 ・ <span className="num">{wd.state === "ready" ? n : "—"}</span> 日</h2><span className="r"><span className="seg"><button type="button" onClick={() => move(-1)}>‹</button><button type="button" aria-pressed="true" className="num">{y}/{m}</button><button type="button" onClick={() => move(1)}>›</button></span>{canEdit && startDate && endDate && <Btn kind="ghost sm" disabled={!!busy} onClick={putHolidays}>{busy === "hol" ? "休みにしています" : "祝日を休みにする"}</Btn>}{!canEdit && <Chip>管理者が変更</Chip>}</span></div>
      {wd.state === "error" && <div className="empty"><b>研修日を確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div>}
      {wd.state === "setup_required" && <Chip tone="warn">研修の期間が未設定</Chip>}
      {wd.state === "ready" && (
        <div className="mcal">
          {["月", "火", "水", "木", "金", "土", "日"].map(w => <span key={w} className="h">{w}</span>)}
          {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: last }, (_, i) => {
            const iso = `${month}-${String(i + 1).padStart(2, "0")}`, on = isOn(iso);
            return canEdit
              ? <button key={iso} type="button" disabled={busy === iso} className={iso === today ? "td" : ""} aria-pressed={on} onClick={() => toggle(iso)}><b>{i + 1}</b>{on ? <i className="p">研修日</i> : <i>休み</i>}</button>
              : <span key={iso} className={on ? "" : "off"}><b>{i + 1}</b>{on && <i className="p">研修日</i>}</span>;
          })}
        </div>
      )}
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Card>
  );
}

export default function InstructorSetting({ role, manager, say }) {
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const [tab, setTab] = useState("base");
  const [st, setSt] = useState({ state: "loading" });
  const [v, setV] = useState(null);
  const [base, setBase] = useState(null);
  const [people, setPeople] = useState({ instructors: null, managers: null });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [nf, setNf] = useState("");
  const [key, setKey] = useState(0);
  const [rfSug, setRfSug] = useState(null); const [rfBusy, setRfBusy] = useState(false);
  const [ed, setEd] = useState(false); const [conf, setConf] = useState(false);
  const [ask, setAsk] = useState(""); const [askBusy, setAskBusy] = useState(false); const [prop, setProp] = useState(null);
  const load = useCallback(async () => {
    if (!courseId) return;
    setSt({ state: "loading" });
    try {
      const [courses, rf] = await Promise.all([apiGet("/courses"), apiGet(`/courses/${encodeURIComponent(courseId)}/report-settings`)]);
      const c = arr(courses).find(x => x.courseId === courseId) || sc.course;
      const next = { name: c.name || "", startDate: c.startDate || "", endDate: c.endDate || "", standardClockIn: c.standardClockIn || "", standardClockOut: c.standardClockOut || "", instructorIds: arr(c.instructorIds), managerIds: arr(c.managerIds), fields: arr(rf?.fields), type: c.type || c.kind || "shinjin", memo: c.memo ?? c.description ?? "" };
      setV(next); setBase(next); setSt({ state: "ready" });
    } catch { setSt({ state: "error" }); }
  }, [courseId, sc.course]);
  useEffect(() => { load(); }, [load, key]);
  useEffect(() => {
    apiGet("/admin/instructors").then(l => setPeople(p => ({ ...p, instructors: arr(l) }))).catch(() => setPeople(p => ({ ...p, instructors: [] })));
    if (role === "admin") apiGet("/admin/users").then(l => setPeople(p => ({ ...p, managers: arr(l).filter(u => u.role === "manager") }))).catch(() => setPeople(p => ({ ...p, managers: [] })));
  }, [role]);
  const diff = useMemo(() => {
    if (!v || !base) return { base: false, rf: false, who: false, labels: [] };
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const b = ["name", "startDate", "endDate", "standardClockIn", "standardClockOut"].some(k => v[k] !== base[k]);
    const rf = !same(v.fields, base.fields);
    const who = !same([...v.instructorIds].sort(), [...base.instructorIds].sort()) || !same([...v.managerIds].sort(), [...base.managerIds].sort());
    return { base: b, rf, who, labels: [b && "基本", rf && "日報の項目", who && "担当"].filter(Boolean) };
  }, [v, base]);
  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>コースの設定</b><Chip>コースなし</Chip></div></Card>;
  if (st.state === "error") return <Card><div className="empty"><b>設定を確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card>;
  if (st.state === "loading" || !v) return <div className="soon card">読み込み中</div>;
  // 名前・期間・時間・担当を変えられるのは管理者とコース担当者だけ（API の決まり）。講師は見るだけ
  const canCourse = role === "admin" || !!manager;
  const f = (k, val) => setV(x => ({ ...x, [k]: val }));
  const setField = (i, patch) => f("fields", v.fields.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const moveField = (i, n) => { const l = [...v.fields], [x] = l.splice(i, 1); l.splice(i + n, 0, x); f("fields", l); };
  const check = (k, id, on) => f(k, on ? [...new Set([...v[k], id])] : v[k].filter(x => x !== id));
  const bad = !v.name.trim() || (v.startDate && v.endDate && v.startDate > v.endDate);
  const save = async () => {
    if (bad) { setErr("名前を入れ、終わりの日は始まりの日より後にしてください"); return; }
    setBusy(true); setErr("");
    try {
      if (diff.base || diff.who) await apiPut(`/courses/${encodeURIComponent(courseId)}`, { name: v.name.trim(), type: v.type, memo: v.memo, startDate: v.startDate, endDate: v.endDate, instructorIds: v.instructorIds, standardClockIn: v.standardClockIn, standardClockOut: v.standardClockOut, ...(role === "admin" ? { managerIds: v.managerIds } : {}) });
      if (diff.rf) await apiPut(`/courses/${encodeURIComponent(courseId)}/report-settings`, { fields: v.fields });
      setBase(v); say?.("保存しました");
    } catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(false); }
  };
  const suggestRf = async () => {
    setRfBusy(true); setErr("");
    try { const r = await apiPost("/ai/staff-draft", { kind: "reportFields", courseId, text: v.fields.map(x => x.label).join("、") }); setRfSug(String(r.text || "").split(/\r?\n/).map(x => x.replace(/^[・\-\d.\s]+/, "").trim()).filter(Boolean).slice(0, 3)); }
    catch (e) { setErr(errText(e, "案を作れませんでした")); } finally { setRfBusy(false); }
  };
  const propose = async () => {
    setAskBusy(true); setErr(""); setProp(null);
    try {
      const r = await apiPost("/ai/course-setting", { courseId, text: ask, current: { today: todayStr(), name: v.name, startDate: v.startDate, endDate: v.endDate, clockIn: v.standardClockIn, clockOut: v.standardClockOut, fields: v.fields.map(x => x.label) } });
      const p = r?.plan || {}, rows = [];
      const same = (a, b) => !a || a === b;
      if (canCourse) {
        if (!same(p.name, v.name)) rows.push({ t: "名前", to: p.name, patch: { name: p.name } });
        if (!same(p.startDate, v.startDate)) rows.push({ t: "開始日", to: p.startDate, patch: { startDate: p.startDate } });
        if (!same(p.endDate, v.endDate)) rows.push({ t: "終了日", to: p.endDate, patch: { endDate: p.endDate } });
        if (!same(p.clockIn, v.standardClockIn)) rows.push({ t: "始まり", to: p.clockIn, patch: { standardClockIn: p.clockIn } });
        if (!same(p.clockOut, v.standardClockOut)) rows.push({ t: "終わり", to: p.clockOut, patch: { standardClockOut: p.clockOut } });
      }
      arr(p.addFields).filter(x => x && !v.fields.some(f => f.label === x)).forEach(x => rows.push({ t: "日報の項目を足す", to: x, field: x }));
      if (role === "admin") {
        arr(p.offDays).forEach(d => rows.push({ t: "休みにする", to: d, day: [d, false] }));
        arr(p.onDays).forEach(d => rows.push({ t: "研修日にする", to: d, day: [d, true] }));
      }
      if (p.remindReport) rows.push({ t: "日報のリマインド", to: p.remindReport, remind: { repOn: true, rep: p.remindReport } });
      if (p.remindAttendance) rows.push({ t: "出勤のリマインド", to: p.remindAttendance, remind: { attOn: true, att: p.remindAttendance } });
      setProp(rows.map(x => ({ ...x, on: true })));
    } catch (e) { setErr(errText(e, "案を作れませんでした")); } finally { setAskBusy(false); }
  };
  const applyProp = async () => {
    const use = prop.filter(x => x.on);
    setAskBusy(true); setErr("");
    try {
      setV(x => { let n = x; use.forEach(r => { if (r.patch) n = { ...n, ...r.patch }; if (r.field) n = { ...n, fields: [...n.fields, { id: `custom_${Date.now()}_${n.fields.length}`, label: r.field, required: false, placeholder: "" }] }; }); return n; });
      const days = use.filter(r => r.day);
      if (days.length) await apiPut(`/courses/${encodeURIComponent(courseId)}/calendar`, { items: days.map(r => ({ date: r.day[0], type: r.day[1] ? "training" : "holiday", isTrainingDay: r.day[1] })) });
      const rems = use.filter(r => r.remind);
      if (rems.length) { const c = await apiGet(`/course-config?courseId=${encodeURIComponent(courseId)}`); await apiPut("/course-config", { courseId, features: c.features, remind: rems.reduce((a, r) => ({ ...a, ...r.remind }), c.remind) }); }
      setProp(null); setAsk("");
      say?.(use.some(r => r.patch || r.field) ? "反映しました ・ 確定で保存します" : "反映しました");
    } catch (e) { setErr(errText(e, "反映できませんでした")); } finally { setAskBusy(false); }
  };
  const inTab = {
    base: (
      <Card className="pad st-g">
        <div className="head"><h2 className="h2">基本</h2>{!canCourse && <span className="r"><Chip>管理者が変更</Chip></span>}</div>
        <label className="field">名前<input type="text" maxLength={80} disabled={!canCourse} value={v.name} onChange={e => f("name", e.target.value)} /></label>
        <div className="st-fg"><label className="field">開始日<input type="date" disabled={!canCourse} value={v.startDate} onChange={e => f("startDate", e.target.value)} /></label><label className="field">終了日<input type="date" disabled={!canCourse} value={v.endDate} onChange={e => f("endDate", e.target.value)} /></label></div>
        <div className="st-fg"><label className="field">始まり<input type="time" disabled={!canCourse} value={v.standardClockIn} onChange={e => f("standardClockIn", e.target.value)} /></label><label className="field">終わり<input type="time" disabled={!canCourse} value={v.standardClockOut} onChange={e => f("standardClockOut", e.target.value)} /></label></div>
      </Card>
    ),
    days: <Days courseId={courseId} canEdit={role === "admin"} say={say} startDate={v.startDate} endDate={v.endDate} />,
    fx: <CourseConfig courseId={courseId} part="fx" say={say} />,
    notice: <CourseConfig courseId={courseId} part="notice" say={say} />,
    ai: <CourseConfig courseId={courseId} part="ai" say={say} />,
    rf: (
      <Card className="pad st-g">
        <div className="head"><h2 className="h2">日報の項目（夕方）</h2><span className="r"><Btn kind="ghost sm" disabled={rfBusy} onClick={suggestRf}>{rfBusy ? "考えています" : "項目の案を出す"}</Btn></span></div>
        {arr(rfSug).length > 0 && <div className="row">{rfSug.map(x => <button key={x} type="button" className="chip qk" onClick={() => { f("fields", [...v.fields, { id: `custom_${Date.now()}`, label: x, required: false, placeholder: "" }]); setRfSug(l => l.filter(y => y !== x)); }}>＋ {x}</button>)}</div>}
        <div className="st-g">
          {v.fields.map((x, i) => (
            <div key={x.id} className="st-rf"><span className="num">{i + 1}</span><input type="text" aria-label="項目の名前" value={x.label || ""} onChange={e => setField(i, { label: e.target.value })} /><label className="st-ck"><input type="checkbox" checked={!!x.required} onChange={e => setField(i, { required: e.target.checked })} />必須</label><span className="seg"><button type="button" aria-label="上へ" disabled={i === 0} onClick={() => moveField(i, -1)}>↑</button><button type="button" aria-label="下へ" disabled={i === v.fields.length - 1} onClick={() => moveField(i, 1)}>↓</button></span><Btn kind="ghost sm" disabled={v.fields.length <= 1} onClick={() => f("fields", v.fields.filter((_, j) => j !== i))}>消す</Btn></div>
          ))}
        </div>
        {v.fields.length < 8 && <span className="an-ai"><input type="text" value={nf} placeholder="項目を足す" aria-label="項目を足す" onChange={e => setNf(e.target.value)} /><Btn kind="ghost sm" disabled={!nf.trim()} onClick={() => { f("fields", [...v.fields, { id: `custom_${Date.now()}`, label: nf.trim(), required: false, placeholder: "" }]); setNf(""); }}>足す</Btn></span>}
      </Card>
    ),
    who: (
      <Card className="pad st-g">
        <div className="head"><h2 className="h2">担当</h2>{!canCourse && <span className="r"><Chip>管理者が変更</Chip></span>}</div>
        <div className="field">講師{people.instructors === null ? <span className="dv-mt">読み込み中</span> : <span className="row">{people.instructors.map(p => <label key={p.userId} className="st-ck"><input type="checkbox" disabled={!canCourse} checked={v.instructorIds.includes(p.userId)} onChange={e => check("instructorIds", p.userId, e.target.checked)} />{p.name || "名前未設定"}</label>)}{!people.instructors.length && <Chip>なし</Chip>}</span>}</div>
        {role === "admin" && <div className="field">コース担当者{people.managers === null ? <span className="dv-mt">読み込み中</span> : <span className="row">{people.managers.map(p => <label key={p.userId} className="st-ck"><input type="checkbox" checked={v.managerIds.includes(p.userId)} onChange={e => check("managerIds", p.userId, e.target.checked)} />{p.name || "名前未設定"}</label>)}{!people.managers.length && <Chip>なし</Chip>}</span>}</div>}
      </Card>
    ),
  };
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">コースの設定</h1></div><span className="r">{ed ? <><Btn kind="ghost sm" onClick={() => { setV(base); setEd(false); setProp(null); }}>やめる</Btn><Btn kind="sm" disabled={busy || !diff.labels.length} onClick={() => setConf(true)}>確定</Btn></> : <Btn kind="sm" onClick={() => setEd(true)}>編集</Btn>}</span></div>
      <fieldset className="cfgfs" disabled={!ed}><div className="aip">
        <div className="row"><b>AI に頼んで変える</b></div>
        <div className="row sx-nw"><input type="text" value={ask} maxLength={1000} placeholder="例：11/24 を休みに。金曜は 17時まで" aria-label="AI に頼む" onChange={e => setAsk(e.target.value)} /><Btn kind="sm" disabled={askBusy || !ask.trim()} onClick={propose}>{askBusy ? "考えています" : "案を出す"}</Btn></div>
        {!prop && !ask && <div className="row">{["祝日を休みにする", "金曜は 17時まで", "日報に「今日の調子」を足す", "リマインドを 17:30 に"].map(x => <button key={x} type="button" className="chip qk" onClick={() => setAsk(x)}>{x}</button>)}</div>}
        {prop && (prop.length ? <>
          {prop.map((r, i) => <label key={i} className="st-ck"><input type="checkbox" checked={r.on} onChange={e => setProp(l => l.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} /><b>{r.t}</b> → {r.to}</label>)}
          <span className="row st-end"><Btn kind="ghost sm" onClick={() => setProp(null)}>やめる</Btn><Btn kind="sm" disabled={askBusy || !prop.some(x => x.on)} onClick={applyProp}>{prop.filter(x => x.on).length} 件を反映する</Btn></span>
        </> : <Chip tone="warn">読み取れませんでした</Chip>)}
      </div></fieldset>
      <div className="side">
        <div className="card pick">{TABS.map(([k, t]) => <button key={k} type="button" className="nf" aria-current={tab === k} onClick={() => setTab(k)}><span><b>{t}</b></span>{diff[k] && <Chip tone="warn">変更</Chip>}</button>)}</div>
        <fieldset className="st cfgfs cfgc" disabled={!ed}>{inTab[tab]}</fieldset>
      </div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {diff.labels.length > 0 && <div className="savebar" role="status"><b>変えたところ {diff.labels.length}</b><small>{diff.labels.join("・")}</small><span style={{ marginLeft: "auto" }} /><Btn kind="ghost sm" onClick={() => setV(base)}>元に戻す</Btn><Btn kind="sm" disabled={busy} onClick={() => setConf(true)}>確定</Btn></div>}
      {conf && <Modal title="コースの設定を確定" width={480} onClose={() => setConf(false)} footer={<><Btn kind="ghost" onClick={() => setConf(false)}>戻る</Btn><Btn disabled={busy} onClick={async () => { await save(); setConf(false); setEd(false); }}>{busy ? "保存しています" : "確定"}</Btn></>}><div className="list">{diff.labels.map(t => <div key={t} className="li"><span><b>{t}</b></span><Chip tone="warn">変更</Chip></div>)}</div></Modal>}
    </div>
  );
}
