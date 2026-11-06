import React, { useEffect, useMemo, useState } from "react";
import { ATT_STATES, kindOf, needsReason, noClock, nowHM, useTraineeAttendance } from "./useTraineeAttendance.js";
import { Btn, Card, Chip, Modal, Ring, weekday } from "../parts/ui.jsx";
import { Icon } from "../parts/icons.jsx";

/* 受講生の勤怠（モック attT2）：上に日付と今月の数、左に今日（今の時刻と出勤・退勤）、右に今月のまとめ（出席率の輪）、
   下に月のカレンダー。カレンダーの日を押すとその日を直せる */

const K = { 出勤: ["出勤", "rep"], now: ["出勤中", "cur"], 遅刻: ["遅刻", "att"], 早退: ["早退", "att"], 中抜け: ["中抜け", "att"], 欠勤: ["欠勤", "dev"], 休暇: ["休暇", "gy"], none: ["記録なし", "dev"] };
const parts = d => { const [y, m, dd] = String(d).split("-").map(Number); return { y, m, d: dd }; };
const shiftMonth = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const standardIn = c => c?.standardClockIn || c?.standardStartTime || c?.defaultClockIn || "";
const standardOut = c => c?.standardClockOut || c?.standardEndTime || c?.defaultClockOut || "";

function Field({ id, label, ...rest }) {
  return <label className="dr-f" htmlFor={id}><span className="dr-fl">{label}</span><input id={id} {...rest} /></label>;
}

function Today({ a, say }) {
  const { today } = a;
  const row = a.byDate[today];
  const inT = row?.clockIn || "", outT = row?.clockOut || "", saved = row?.status || "出勤";
  const [now, setNow] = useState(nowHM);
  const [status, setStatus] = useState(saved);
  const [reason, setReason] = useState(row?.reason || row?.note || "");
  const [fix, setFix] = useState(null);
  useEffect(() => { const t = setInterval(() => setNow(nowHM()), 20000); return () => clearInterval(t); }, []);
  useEffect(() => { setStatus(row?.status || "出勤"); setReason(row?.reason || row?.note || ""); }, [row?.updatedAt, row?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const ok = a.canSave(today);
  const course = a.courses.find(c => c.courseId === a.courseFor(today));
  const sched = (a.days.byDate[today] || [])[0] || {};
  const start = sched.startTime || standardIn(course), end = sched.endTime || standardOut(course);
  const off = noClock(status);
  const changed = status !== saved || reason !== (row?.reason || row?.note || "");
  const base = { in: inT, out: outT, status, reason };
  const punch = async (patch, msg) => { if (await a.save(today, { ...base, ...patch })) say(msg); };
  const record = () => punch({ in: inT || (off ? "" : nowHM()) }, "記録しました");
  const saveFix = async () => { if (await a.save(today, { ...base, in: fix.in, out: fix.out, correctionReason: fix.why })) { setFix(null); say("時刻を直しました"); } };

  return (
    <section className="card pad ta-today c-att">
      <div className="dr-h">
        <span className="dr-ic"><Icon k="att" size={22} /></span>
        <div><span className="eyebrow">今日{start || end ? ` ・ ${start}〜${end}` : ""}</span><h2 className="h2">打刻</h2></div>
        <span className="r"><span className="ta-now num">{now}</span></span>
      </div>
      {a.days.state === "loading" && <Chip>研修日を確認中</Chip>}
      {a.days.state === "error" && <div className="dr-block"><b>研修日を確認できません</b><Btn kind="ghost sm" onClick={a.reload}>再読み込み</Btn></div>}
      {a.days.state === "setup_required" && <div className="dr-block"><b>研修日の設定待ち</b></div>}
      {a.days.state === "ready" && a.conflict(today) && <div className="dr-block"><b>別の研修と日程が重複</b></div>}
      {a.days.state === "ready" && !a.isDay(today) && <div className="dr-block"><b>研修のない日</b></div>}

      {!off && (
        <div className="ta-punch">
          {inT
            ? <div className="ta-p done"><span>出勤</span><b className="num">{inT}</b><small>✓ 記録済み</small></div>
            : <button type="button" className="ta-p go" disabled={!ok || a.saving} onClick={() => punch({ in: nowHM() }, "出勤しました")}><span>出勤</span><b>出勤する</b><small>今の時刻で記録</small></button>}
          {outT
            ? <div className="ta-p done"><span>退勤</span><b className="num">{outT}</b><small>✓ 記録済み</small></div>
            : <button type="button" className={`ta-p ${inT ? "go" : "wait"}`} disabled={!ok || !inT || a.saving} onClick={() => punch({ out: nowHM() }, "退勤しました")}><span>退勤</span><b>退勤する</b><small>{inT ? "日報を出してから" : "出勤のあと"}</small></button>}
        </div>
      )}
      {!off && ((!inT && standardIn(course)) || (inT && !outT && standardOut(course))) && (
        <div className="row">
          {!inT && <Btn kind="ghost sm" disabled={!ok || a.saving} onClick={() => punch({ in: standardIn(course) }, "出勤しました")}>定時 {standardIn(course)} で出勤</Btn>}
          {inT && !outT && <Btn kind="ghost sm" disabled={!ok || a.saving} onClick={() => punch({ out: standardOut(course) }, "退勤しました")}>定時 {standardOut(course)} で退勤</Btn>}
        </div>
      )}

      <div className="dr-f">
        <span className="dr-fl">今日の状態</span>
        <span className="seg ta-seg">{ATT_STATES.map(x => <button key={x} type="button" aria-pressed={kindOf({ status }) === x} disabled={!ok} onClick={() => setStatus(x)}>{x}</button>)}</span>
      </div>
      {needsReason(status) && <div className="ta-warn"><b>{status} ・ 先に講師へ連絡</b><span>実際の時刻と理由を記録</span></div>}
      {(needsReason(status) || status === "休暇") && (
        <label className="dr-f" htmlFor="lms-att-reason"><span className="dr-fl">理由{needsReason(status) && <Chip tone="bad">必須</Chip>}</span><textarea id="lms-att-reason" rows={2} disabled={!ok} value={reason} placeholder="例）電車が遅れたため" onChange={e => setReason(e.target.value)} /></label>
      )}
      {a.err && <div className="lms-err" role="alert">{a.err}</div>}
      <div className="row">
        {!off && <Btn kind="ghost sm" disabled={!ok} onClick={() => setFix(f => (f ? null : { in: inT, out: outT, why: "" }))}>{fix ? "やめる" : "時刻を直す"}</Btn>}
        <span style={{ marginLeft: "auto" }} />
        {changed && <Btn kind="sm" disabled={!ok || a.saving} onClick={record}>この内容で記録</Btn>}
      </div>
      {fix && (
        <div className="ta-fix">
          <div className="g2e">
            <Field id="lms-att-in" label="出勤" type="time" value={fix.in} onChange={e => setFix(f => ({ ...f, in: e.target.value }))} />
            <Field id="lms-att-out" label="退勤" type="time" value={fix.out} onChange={e => setFix(f => ({ ...f, out: e.target.value }))} />
          </div>
          <Field id="lms-att-why" label="直した理由" type="text" placeholder="例）出勤を押し忘れたため" value={fix.why} onChange={e => setFix(f => ({ ...f, why: e.target.value }))} />
          <span className="row" style={{ justifyContent: "flex-end" }}><Btn kind="sm" disabled={a.saving} onClick={saveFix}>時刻を直す</Btn></span>
        </div>
      )}
    </section>
  );
}

function DayModal({ a, date, onClose, say }) {
  const row = a.byDate[date], p = parts(date);
  const [v, setV] = useState({ in: row?.clockIn || "", out: row?.clockOut || "", status: kindOf(row), reason: row?.reason || row?.note || "", correctionReason: "" });
  const off = noClock(v.status);
  const save = async () => { if (await a.save(date, v)) { say("記録しました"); onClose(); } };
  return (
    <Modal title={`${p.m}/${p.d}（${weekday(p.m, p.d, p.y)}）の勤怠`} onClose={onClose}
      footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={a.saving} onClick={save}>{a.saving ? "保存中" : "記録する"}</Btn></>}>
      <div className="dr-f"><span className="dr-fl">状態</span>
        <span className="seg ta-seg">{ATT_STATES.map(x => <button key={x} type="button" aria-pressed={v.status === x} onClick={() => setV(c => ({ ...c, status: x }))}>{x}</button>)}</span>
      </div>
      {!off && (
        <div className="g2e">
          <Field id="lms-day-in" label="出勤" type="time" value={v.in} onChange={e => setV(c => ({ ...c, in: e.target.value }))} />
          <Field id="lms-day-out" label="退勤" type="time" value={v.out} onChange={e => setV(c => ({ ...c, out: e.target.value }))} />
        </div>
      )}
      {(needsReason(v.status) || v.status === "休暇") && (
        <label className="dr-f" htmlFor="lms-day-reason"><span className="dr-fl">理由{needsReason(v.status) && <Chip tone="bad">必須</Chip>}</span><textarea id="lms-day-reason" rows={2} value={v.reason} onChange={e => setV(c => ({ ...c, reason: e.target.value }))} /></label>
      )}
      {row && <Field id="lms-day-why" label="直した理由" type="text" value={v.correctionReason} onChange={e => setV(c => ({ ...c, correctionReason: e.target.value }))} />}
      {a.err && <div className="lms-err" role="alert">{a.err}</div>}
    </Modal>
  );
}

export default function TraineeAttendance({ say }) {
  const a = useTraineeAttendance();
  const [edit, setEdit] = useState("");
  const { today, month, byDate, days } = a;
  useEffect(() => { if (a.target && days.state === "ready" && a.target <= today && a.canSave(a.target)) setEdit(a.target); }, [days.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const [y, m] = month.split("-").map(Number);
  const cells = useMemo(() => {
    const last = new Date(y, m, 0).getDate();
    return Array.from({ length: last }, (_, i) => {
      const d = `${month}-${String(i + 1).padStart(2, "0")}`, dow = new Date(y, m - 1, i + 1).getDay(), row = byDate[d], train = !!days.byDate[d];
      let k = "off";
      if (row) k = d === today && row.clockIn && !row.clockOut && kindOf(row) === "出勤" ? "now" : kindOf(row);
      else if (train) k = d > today ? "fut" : d === today ? "todo" : "none";
      return { d, n: i + 1, dow, row, k, train };
    });
  }, [y, m, month, byDate, days.byDate, today]);
  const past = cells.filter(c => (c.train || c.row) && c.d <= today && c.k !== "todo");
  const cnt = (...ks) => past.filter(c => ks.includes(c.k)).length;
  const present = cnt("出勤", "now", "遅刻", "早退", "中抜け");
  const notes = past.filter(c => c.row && (c.row.reason || c.row.note));

  if (a.state === "loading") return <div className="soon card">読み込み中</div>;
  if (a.state === "error") return <Card><div className="empty"><b>勤怠を確認できません</b><Btn kind="ghost sm" onClick={a.reload}>再読み込み</Btn></div></Card>;

  const p = parts(today), ready = days.state === "ready";
  const course = a.courses.find(c => c.courseId === a.courseFor(today)) || a.courses[0];
  const minM = String(a.courses.map(c => c.startDate).filter(Boolean).sort()[0] || "").slice(0, 7), nowM = today.slice(0, 7);
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  return (
    <div className="th dr ta">
      <div className="th-top">
        <div className="th-date"><b className="num">{p.d}</b><div><em>{p.m}月 ・ {weekday(p.m, p.d, p.y)}曜日</em><small>{course?.name || course?.courseName || "勤怠"}</small></div></div>
        {ready && (
          <div className="th-att">
            <span className="th-pill ok"><i aria-hidden="true" />出勤 <b>{cnt("出勤", "now")}</b></span>
            <span className="th-pill"><i aria-hidden="true" style={{ background: "var(--att-d)" }} />遅刻 <b>{cnt("遅刻")}</b></span>
            <span className="th-pill"><i aria-hidden="true" style={{ background: "var(--dev-d)" }} />欠勤 <b>{cnt("欠勤")}</b></span>
          </div>
        )}
      </div>
      <div className="th-grid">
        <Today a={a} say={say} />
        <section className="card pad ta-mon">
          <div className="head"><h2 className="h2">{m}月のまとめ</h2>{ready && <span className="r"><Chip>研修日 {past.length} 日</Chip></span>}</div>
          {!ready
            ? <div className="empty">{days.state === "loading" ? "読み込み中" : "確認できません"}</div>
            : (
              <div className="ta-sum">
                <Ring n={present} of={past.length} cat="rep" />
                <div className="ta-lg">
                  {[["出勤", cnt("出勤", "now"), "rep"], ["遅刻・早退", cnt("遅刻", "早退", "中抜け"), "att"], ["欠勤", cnt("欠勤"), "dev"], ["休暇", cnt("休暇"), "gy"], ["記録なし", cnt("none"), "gy"]].map(([t, n, c]) => <span key={t} className={`c-${c}`}><i aria-hidden="true" />{t}<b className="num">{n}</b></span>)}
                </div>
              </div>
            )}
          {notes.length > 0 && (
            <div className="ta-note"><span className="eyebrow">この月の連絡</span>
              {notes.map(c => <div key={c.d}><b className="num">{m}/{c.n}</b><Chip tone={kindOf(c.row) === "欠勤" ? "bad" : "warn"}>{kindOf(c.row)}</Chip><span>{c.row.reason || c.row.note}</span></div>)}
            </div>
          )}
        </section>
      </div>
      <section className="card pad ta-cal">
        <div className="head"><h2 className="h2">{m}月のカレンダー</h2>
          <span className="r"><span className="seg dr-mo">
            <button type="button" aria-label="前の月" disabled={!!minM && month <= minM} onClick={() => a.setMonth(shiftMonth(month, -1))}>‹</button>
            <button type="button" aria-pressed="true">{m}月</button>
            <button type="button" aria-label="次の月" disabled={month >= nowM} onClick={() => a.setMonth(shiftMonth(month, 1))}>›</button>
          </span></span>
        </div>
        <div className="ta-g">
          {["月", "火", "水", "木", "金", "土", "日"].map((w, i) => <span key={w} className={`ta-w${i >= 5 ? " we" : ""}`}>{w}</span>)}
          {Array.from({ length: firstDow }, (_, i) => <span key={`b${i}`} className="ta-c blank" />)}
          {cells.map(c => {
            if (c.k === "off") return <span key={c.d} className="ta-c off"><b>{c.n}</b></span>;
            if (c.k === "fut") return <span key={c.d} className="ta-c fut"><b>{c.n}</b></span>;
            const [lb, cat] = c.k === "todo" ? ["今日", "cur"] : K[c.k] || K.none;
            const can = ready && c.d <= today && a.canSave(c.d);
            const inner = <><b>{c.n}</b><span className="ta-cs"><i aria-hidden="true" />{lb}</span>{c.row?.clockIn && <small className="num">{c.row.clockIn}{c.row.clockOut ? `–${c.row.clockOut}` : ""}</small>}</>;
            return can
              ? <button key={c.d} type="button" className={`ta-c c-${cat}${c.d === today ? " td" : ""}`} aria-label={`${m}/${c.n} ${lb}`} onClick={() => { a.setErr(""); setEdit(c.d); }}>{inner}</button>
              : <span key={c.d} className={`ta-c c-${cat} ro${c.d === today ? " td" : ""}`}>{inner}</span>;
          })}
        </div>
      </section>
      {edit && <DayModal key={edit} a={a} date={edit} say={say} onClose={() => setEdit("")} />}
    </div>
  );
}
