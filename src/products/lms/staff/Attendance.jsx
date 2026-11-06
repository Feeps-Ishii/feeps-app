import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { ATT_STATES, kindOf, needsReason, noClock } from "../trainee/useTraineeAttendance.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, copyText, dayLabel, errText, md, saveXlsx, stepDate, usePins, useRoster, useStaffCourse, useWorkdays } from "./common.js";

/* 勤怠（講師・コース担当者・企業担当者で共通。モック attS）：日は一覧、月はカレンダーと人ごと。
   講師は直せる（理由つき）。企業担当者は見るだけ・担当の ✓ を上に */

const KIND = { none: ["未打刻", "bad"], 欠勤: ["欠勤", "bad"], 遅刻: ["遅刻", "warn"], 早退: ["早退", "warn"], 中抜け: ["中抜け", "warn"], 休暇: ["休暇", ""], 出勤: ["出勤", "ok"] };
const ORD = { none: 0, 欠勤: 1, 遅刻: 2, 早退: 2, 中抜け: 2, 休暇: 3, 出勤: 4 };
const CELL = { 欠勤: ["欠", "a"], 遅刻: ["遅", "l"], 早退: ["早", "l"], 中抜け: ["中", "l"], 休暇: ["休", ""], 出勤: ["出", ""], none: ["—", "a"] };
const rowKind = r => (!r ? "none" : !r.clockIn && !noClock(r.status) ? "none" : kindOf(r));
const isIssue = k => k === "欠勤" || k === "遅刻" || k === "早退" || k === "中抜け";

function FixModal({ row, date, courseId, onClose, onSaved, say }) {
  const r = row.att;
  const [v, setV] = useState({ in: r?.clockIn || "", out: r?.clockOut || "", status: r ? kindOf(r) : "出勤", reason: r?.reason || r?.note || "", fix: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    if (!String(v.in).trim() && !noClock(v.status)) { setErr("出勤時刻を入力してください"); return; }
    if (needsReason(v.status) && !v.reason.trim()) { setErr("理由を入力してください"); return; }
    if (!v.fix.trim()) { setErr("直す理由を入力してください"); return; }
    setBusy(true); setErr("");
    try {
      await apiPut(`/attendance/${encodeURIComponent(row.id)}`, { date, courseId, clockIn: v.in, clockOut: v.out, status: v.status, reason: v.reason, note: v.reason, correctionReason: v.fix, ...(r?.breakPeriods ? { breakPeriods: r.breakPeriods } : {}) });
      say?.(`${row.name} さんの勤怠を直しました`);
      onSaved();
    } catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(false); }
  };
  const f = (k, val) => setV(x => ({ ...x, [k]: val }));
  return (
    <Modal title={`${row.name} ・ ${dayLabel(date)}`} width={460} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy} onClick={save}>{busy ? "保存しています" : "保存"}</Btn></>}>
      <div className="st-fg">
        <label className="field">出勤<input type="time" aria-label="出勤" value={v.in} onChange={e => f("in", e.target.value)} /></label>
        <label className="field">退勤<input type="time" aria-label="退勤" value={v.out} onChange={e => f("out", e.target.value)} /></label>
      </div>
      <label className="field">状態<select className="in" value={v.status} onChange={e => f("status", e.target.value)}>{ATT_STATES.map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="field">理由<input type="text" value={v.reason} onChange={e => f("reason", e.target.value)} /></label>
      <label className="field">直す理由<input type="text" value={v.fix} onChange={e => f("fix", e.target.value)} /></label>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

function MonthView({ courseId, month, setMonth, roster, pins, ro, onDay, sw, onCell }) {
  const today = todayStr();
  const wdays = useWorkdays(courseId, month);
  const [mode, setMode] = useState("cal");
  const [byDate, setByDate] = useState(null);
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("issue");
  const dates = useMemo(() => wdays.dates.filter(d => d <= today), [wdays.dates, today]);
  useEffect(() => {
    if (wdays.state !== "ready") return undefined;
    let alive = true;
    setByDate(null);
    Promise.all(dates.map(d => apiGet(`/attendance?date=${d}`).then(l => [d, new Map(arr(l).filter(x => x.deleted !== true).map(x => [x.traineeId, x]))]).catch(() => [d, null])))
      .then(p => { if (alive) setByDate(new Map(p)); });
    return () => { alive = false; };
  }, [wdays.state, dates]);
  const [y, m] = month.split("-").map(Number);
  const moveMonth = n => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const head = rest => <div className="head"><div><h1 className="h1">勤怠 ・ {m}月</h1></div><span className="r">{sw}<span className="seg"><button type="button" onClick={() => moveMonth(-1)}>‹</button><button type="button" aria-pressed="true" className="num">{m}月</button><button type="button" disabled={month >= today.slice(0, 7)} onClick={() => moveMonth(1)}>›</button></span><span className="seg"><button type="button" aria-pressed={mode === "cal"} onClick={() => setMode("cal")}>カレンダー</button><button type="button" aria-pressed={mode === "ppl"} onClick={() => setMode("ppl")}>人ごと</button></span>{rest}</span></div>;
  if (wdays.state === "error") return <>{head()}<Card><div className="empty"><b>研修日を確認できません</b></div></Card></>;
  if (wdays.state === "setup_required") return <>{head()}<Card><div className="empty"><Chip tone="warn">研修日が未設定</Chip></div></Card></>;
  if (!byDate || !roster) return <>{head()}<div className="soon card">読み込み中</div></>;
  if (mode === "cal") {
    const first = new Date(y, m - 1, 1), blanks = (first.getDay() + 6) % 7, last = new Date(y, m, 0).getDate();
    const cells = [];
    for (let d = 1; d <= last; d++) {
      const iso = `${month}-${String(d).padStart(2, "0")}`, w = new Date(y, m - 1, d).getDay();
      if (!wdays.dates.includes(iso) || iso > today) { cells.push(<span key={d} className={w === 0 || w === 6 ? "off" : "fut"}><b>{d}</b></span>); continue; }
      const got = byDate.get(iso);
      const kinds = got ? roster.map(p => rowKind(got.get(p.id))) : null;
      const c = k => (kinds || []).filter(x => x === k).length;
      const tags = !kinds ? [<i key="u" className="l">確認できません</i>] : [c("none") > 0 && <i key="n" className="a">未打刻 {c("none")}</i>, c("欠勤") > 0 && <i key="a" className="a">欠勤 {c("欠勤")}</i>, c("遅刻") + c("早退") > 0 && <i key="l" className="l">遅刻・早退 {c("遅刻") + c("早退")}</i>].filter(Boolean);
      cells.push(<button key={d} type="button" className={iso === today ? "td" : ""} onClick={() => onDay(iso)}><b>{d}</b>{tags.length ? tags : <i className="p">問題なし</i>}</button>);
    }
    return <>{head()}<Card><div className="mcal">{["月", "火", "水", "木", "金", "土", "日"].map(w => <span key={w} className="h">{w}</span>)}{Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}{cells}</div></Card></>;
  }
  const rows = roster.map(p => {
    const v = dates.map(d => { const g = byDate.get(d); return g ? rowKind(g.get(p.id)) : null; });
    const known = v.filter(Boolean), absent = known.filter(k => k === "欠勤").length, late = known.filter(k => k === "遅刻" || k === "早退").length, none = known.filter(k => k === "none").length;
    return { ...p, v, absent, late, none, rate: known.length ? Math.round((known.length - absent - none) / known.length * 100) : null };
  });
  const issueN = rows.filter(r => r.late + r.absent > 0).length;
  const list = rows.filter(r => matchName(r.name, r.kana, q) && (tab === "all" || (tab === "pin" ? pins.has(r.id) : tab === "issue" ? r.late + r.absent > 0 : r.late + r.absent === 0)))
    .sort((a, b) => (ro ? Number(pins.has(b.id)) - Number(pins.has(a.id)) : 0) || (sort === "issue" ? (b.absent * 2 + b.late) - (a.absent * 2 + a.late) : sort === "rate" ? (a.rate ?? 101) - (b.rate ?? 101) : (a.kana || a.name).localeCompare(b.kana || b.name, "ja")));
  const xlsx = () => saveXlsx(`勤怠_${month}`, "勤怠", [["受講生", "出席率", "遅・早", "欠", ...dates.map(md)], ...list.map(r => [r.name, r.rate == null ? "" : `${r.rate}%`, r.late, r.absent, ...r.v.map(k => (k ? CELL[k]?.[0] || k : "?"))])]);
  return (
    <>
      {head(<Btn kind="ghost sm" onClick={xlsx}>Excel で受け取る</Btn>)}
      <ListTool tabs={[["all", "すべて", rows.length], ...(ro ? [["pin", "担当", rows.filter(r => pins.has(r.id)).length, "ok"]] : []), ["issue", "遅刻・欠勤がある", issueN, "warn"], ["clean", "すべて出勤", rows.length - issueN, "ok"]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["issue", "遅刻・欠勤の多い順"], ["rate", "出席率の低い順"], ["name", "名前順"]]} sort={sort} onSort={setSort} />
      <Card className=""><div className="scroll"><table className="tbl amx"><thead><tr><th>受講生</th><th>出席率</th><th>遅・早</th><th>欠</th>{dates.map(d => <th key={d} className="num">{Number(d.slice(8))}</th>)}</tr></thead><tbody>
        {list.map(r => (
          <tr key={r.id}><td><b>{pins.has(r.id) && <i className="pinm" title="担当の受講生">✓</i>}{r.name}</b></td><td className="num">{r.rate == null ? "—" : `${r.rate}%`}</td><td>{r.late ? <Chip tone="warn">{r.late}</Chip> : <span className="num">0</span>}</td><td>{r.absent ? <Chip tone="bad">{r.absent}</Chip> : <span className="num">0</span>}</td>
            {r.v.map((k, i) => { const [t, c] = k ? CELL[k] || [k, ""] : ["?", "l"]; return <td key={i}>{ro ? <span className={`am ${c}`}>{t}</span> : <button type="button" className={`am ${c}`} aria-label={`${md(dates[i])} ${r.name}`} onClick={() => onCell(r.id, dates[i])}>{t}</button>}</td>; })}
          </tr>
        ))}
        {!list.length && <tr><td colSpan={dates.length + 4}><Chip>見つかりません</Chip></td></tr>}
      </tbody></table></div></Card>
    </>
  );
}

export default function StaffAttendance({ role, say }) {
  const ro = role === "client";
  const today = todayStr();
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const { list: roster, reload: reloadRoster } = useRoster(courseId);
  const { pins } = usePins(ro);
  const [view, setView] = useState("day");
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const wdays = useWorkdays(courseId, date.slice(0, 7));
  const [st, setSt] = useState({ state: "loading", rows: [] });
  const [tab, setTab] = useState(() => { try { const v = sessionStorage.getItem("lms.attTab"); sessionStorage.removeItem("lms.attTab"); return v || "all"; } catch { return "all"; } }); const [q, setQ] = useState(""); const [sort, setSort] = useState("status");
  const [fix, setFix] = useState("");
  const load = useCallback(() => {
    let alive = true;
    setSt(s => ({ ...s, state: "loading" }));
    apiGet(`/attendance?date=${date}`).then(r => { if (alive) setSt({ state: "ready", rows: arr(r).filter(x => x.deleted !== true) }); }).catch(() => { if (alive) setSt({ state: "error", rows: [] }); });
    return () => { alive = false; };
  }, [date]);
  useEffect(load, [load]);
  const rows = useMemo(() => (roster || []).map(p => { const att = st.rows.find(x => x.traineeId === p.id) || null; return { ...p, att, k: rowKind(att), noOut: !!att?.clockIn && !att?.clockOut }; }), [roster, st.rows]);
  const sw = <span className="seg"><button type="button" aria-pressed={view === "day"} onClick={() => setView("day")}>日</button><button type="button" aria-pressed={view === "month"} onClick={() => setView("month")}>月</button></span>;

  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>勤怠</b><Chip>コースなし</Chip></div></Card>;
  if (roster === null) return <Card><div className="empty"><b>受講生を確認できません</b><Btn kind="ghost sm" onClick={reloadRoster}>再読み込み</Btn></div></Card>;
  const cur = rows.find(r => r.id === fix);
  if (view === "month") {
    return <div className="st"><MonthView courseId={courseId} month={month} setMonth={setMonth} roster={roster} pins={pins} ro={ro} sw={sw} onDay={d => { setDate(d); setView("day"); }} onCell={(id, d) => { setDate(d); setView("day"); setFix(id); }} /></div>;
  }
  const cnt = f => rows.filter(f).length;
  const list = rows.filter(r => matchName(r.name, r.kana, q) && (tab === "all" || (tab === "pin" ? pins.has(r.id) : tab === "none" ? r.k === "none" : tab === "issue" ? isIssue(r.k) : r.noOut)))
    .sort((a, b) => (ro ? Number(pins.has(b.id)) - Number(pins.has(a.id)) : 0) || (sort === "name" ? (a.kana || a.name).localeCompare(b.kana || b.name, "ja") : sort === "in" ? String(a.att?.clockIn || "99").localeCompare(String(b.att?.clockIn || "99")) : ORD[a.k] - ORD[b.k]));
  const none = rows.filter(r => r.k === "none");
  return (
    <div className="st">
      <div className="head">
        <div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">勤怠 ・ {dayLabel(date)}</h1></div>
        <span className="r">{sw}<span className="seg"><button type="button" aria-label="前の研修日" onClick={() => setDate(stepDate(date, -1, wdays.dates))}>‹</button><button type="button" aria-pressed={date === today} onClick={() => setDate(today)}>今日</button><button type="button" aria-label="次の研修日" disabled={date >= today} onClick={() => { const n = stepDate(date, 1, wdays.dates); if (n <= today) setDate(n); }}>›</button></span></span>
      </div>
      {st.state === "error" ? <Card><div className="empty"><b>勤怠を確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div></Card> : (
        <>
          <ListTool tabs={[["all", "すべて", rows.length], ...(ro ? [["pin", "担当", cnt(r => pins.has(r.id)), "ok"]] : []), ["none", "未打刻", cnt(r => r.k === "none"), "bad"], ["issue", "遅刻・欠勤", cnt(r => isIssue(r.k)), "warn"], ["noout", "退勤まだ", cnt(r => r.noOut)]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["status", "状態順（未打刻が上）"], ["name", "名前順"], ["in", "出勤の時刻順"]]} sort={sort} onSort={setSort} />
          {tab === "none" && none.length > 0 && <div className="missbar"><b>未打刻 {none.length} 人</b><span>{none.map(r => r.name).join("・")}</span><Btn kind="ghost sm" onClick={() => { copyText(none.map(r => r.name).join("、")); say?.("名前を写しました"); }}>名前を写す</Btn></div>}
          {st.state === "loading" || roster === undefined ? <div className="soon card">読み込み中</div> : (
            <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>受講生</th><th>出勤</th><th>退勤</th><th>状態</th><th>理由</th>{!ro && <th />}</tr></thead><tbody>
              {list.map(r => {
                const [t, c] = KIND[r.k] || [r.k, ""];
                return (
                  <tr key={r.id} className={r.k !== "出勤" ? "on" : ""}>
                    <td><b>{pins.has(r.id) && <i className="pinm" title="担当の受講生">✓</i>}{r.name}</b></td>
                    <td className="num">{r.att?.clockIn || "—"}</td>
                    <td className="num">{r.noOut ? <Chip>まだ</Chip> : r.att?.clockOut || "—"}</td>
                    <td><Chip tone={c}>{t}</Chip></td>
                    <td>{r.att?.reason || r.att?.note || ""}</td>
                    {!ro && <td><Btn kind="ghost sm" onClick={() => setFix(r.id)}>直す</Btn></td>}
                  </tr>
                );
              })}
              {!list.length && <tr><td colSpan={ro ? 5 : 6}><Chip>見つかりません</Chip></td></tr>}
            </tbody></table></div></Card>
          )}
        </>
      )}
      {cur && !ro && <FixModal key={cur.id} row={cur} date={date} courseId={courseId} say={say} onClose={() => setFix("")} onSaved={() => { setFix(""); load(); }} />}
    </div>
  );
}
