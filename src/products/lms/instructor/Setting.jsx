import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { Btn, Card, Chip } from "../parts/ui.jsx";
import { arr, errText, md, useStaffCourse, useWorkdays } from "../staff/common.js";
import { todayStr } from "../../training/useTraining.js";
import CourseConfig from "../staff/CourseConfig.jsx";

/* コースの設定（モック settingX）：基本・研修日・日報の項目・担当。変えたら下の帯から保存する。
   研修日を変えられるのは管理者だけ（API の決まり）。講師は見るだけ */

const TABS = [["base", "基本"], ["days", "研修日"], ["rf", "日報の項目"], ["who", "担当"], ["fx", "使う機能"], ["notice", "リマインド"], ["ai", "AI"]];

function Days({ courseId, canEdit, say }) {
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
  const n = Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter(isOn).length;
  return (
    <Card className="pad">
      <div className="head"><h2 className="h2">研修日 ・ <span className="num">{wd.state === "ready" ? n : "—"}</span> 日</h2><span className="r"><span className="seg"><button type="button" onClick={() => move(-1)}>‹</button><button type="button" aria-pressed="true" className="num">{y}/{m}</button><button type="button" onClick={() => move(1)}>›</button></span>{!canEdit && <Chip>管理者が変更</Chip>}</span></div>
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
  const inTab = {
    base: (
      <Card className="pad st-g">
        <div className="head"><h2 className="h2">基本</h2>{!canCourse && <span className="r"><Chip>管理者が変更</Chip></span>}</div>
        <label className="field">名前<input type="text" maxLength={80} disabled={!canCourse} value={v.name} onChange={e => f("name", e.target.value)} /></label>
        <div className="st-fg"><label className="field">開始日<input type="date" disabled={!canCourse} value={v.startDate} onChange={e => f("startDate", e.target.value)} /></label><label className="field">終了日<input type="date" disabled={!canCourse} value={v.endDate} onChange={e => f("endDate", e.target.value)} /></label></div>
        <div className="st-fg"><label className="field">始まり<input type="time" disabled={!canCourse} value={v.standardClockIn} onChange={e => f("standardClockIn", e.target.value)} /></label><label className="field">終わり<input type="time" disabled={!canCourse} value={v.standardClockOut} onChange={e => f("standardClockOut", e.target.value)} /></label></div>
      </Card>
    ),
    days: <Days courseId={courseId} canEdit={role === "admin"} say={say} />,
    fx: <CourseConfig courseId={courseId} part="fx" say={say} />,
    notice: <CourseConfig courseId={courseId} part="notice" say={say} />,
    ai: <CourseConfig courseId={courseId} part="ai" say={say} />,
    rf: (
      <Card className="pad st-g">
        <h2 className="h2">日報の項目（夕方）</h2>
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
      <div className="head"><div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">コースの設定</h1></div></div>
      <div className="side">
        <div className="card pick">{TABS.map(([k, t]) => <button key={k} type="button" className="nf" aria-current={tab === k} onClick={() => setTab(k)}><span><b>{t}</b></span>{diff[k] && <Chip tone="warn">変更</Chip>}</button>)}</div>
        <div className="st">{inTab[tab]}</div>
      </div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {diff.labels.length > 0 && <div className="savebar" role="status"><b>変えたところ {diff.labels.length}</b><small>{diff.labels.join("・")}</small><span style={{ marginLeft: "auto" }} /><Btn kind="ghost sm" onClick={() => setV(base)}>元に戻す</Btn><Btn kind="sm" disabled={busy} onClick={save}>{busy ? "保存しています" : "保存する"}</Btn></div>}
    </div>
  );
}
