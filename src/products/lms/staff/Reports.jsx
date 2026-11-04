import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { hasStaffComment } from "../../training/acks.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, ListTool, Modal, Soon, matchName } from "../parts/ui.jsx";
import { arr, copyText, dayLabel, errText, hm, md, saveXlsx, setStaffFocus, stepDate, takeStaffFocus, useRoster, useStaffCourse, useWorkdays, usePins } from "./common.js";

/* 日報（講師・コース担当者・企業担当者で共通。モック reportS）：日は一覧、月はカレンダーと人ごと。開くと本文とコメント。
   企業担当者：開くと読んだ印を付ける・担当の ✓ を上に。講師：コメントなしの絞り込み・AI で下書き・リマインド */

const FIELDS = [["morningGoal", "朝の目標"], ["learned", "今日学んだこと"], ["reflection", "振り返り"], ["blockers", "困ったこと"], ["tomorrowGoal", "明日の目標"], ["nextday", "明日に向けて"], ["question", "講師への質問"]];
const ROLE = { client: "企業", admin: "管理者", instructor: "講師" };
const snippet = r => String(r?.learned || r?.reflection || r?.blockers || "").replace(/\s+/g, " ");
const goalsOf = r => { const g = arr(r?.goalItems); return g.length ? `目標 ${g.filter(x => x?.done).length}/${g.length} ・ ` : ""; };

function threadOf(r, name) {
  return [
    ...(r.comment ? [{ id: "legacy", text: r.comment, role: "instructor", who: "", at: r.commentedAt }] : []),
    ...arr(r.comments).map((c, i) => ({ id: c.commentId || i, text: c.text || c.comment, role: c.authorRole || "instructor", who: c.authorName || "", at: c.createdAt })),
    ...arr(r.replies).map((c, i) => ({ id: c.replyId || `r${i}`, text: c.text, role: "me", who: name, at: c.createdAt })),
  ].sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
}

function ReportModal({ row, date, order, onMove, onClose, ro, fields, onComment, onRemind, say }) {
  const r = row.report;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { setText(""); setErr(""); }, [row.id]);
  const k = order.indexOf(row.id);
  const rows = r ? [...FIELDS.map(([f, l]) => [f, fields?.find(x => x.id === f)?.label || l, r[f]]), ...arr(fields).filter(f => !FIELDS.some(([x]) => x === f.id)).map(f => [f.id, f.label || f.id, r.customFields?.[f.id]])].filter(([, , v]) => String(v || "").trim()) : [];
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy("send"); setErr("");
    try { await onComment(r, t); setText(""); say?.("コメントしました"); }
    catch (e) { setErr(errText(e, "コメントできませんでした")); } finally { setBusy(""); }
  };
  const draft = async () => {
    setBusy("ai"); setErr("");
    try { const d = await apiPost("/ai/reports/comment-draft", { traineeId: r.traineeId, date, intent: text.trim() || "がんばりを認めて、次の一歩をひとこと" }); setText(d?.comment || ""); }
    catch (e) { setErr(errText(e, "下書きを作れませんでした")); } finally { setBusy(""); }
  };
  return (
    <Modal title={`${row.name} ・ ${dayLabel(date)} の日報`} width={680} onClose={onClose}
      footer={<><span className="mpos">{k + 1} / {order.length}</span><Btn kind="ghost" disabled={k <= 0} onClick={() => onMove(-1)}>‹ 前の人</Btn><Btn kind="ghost" disabled={k >= order.length - 1} onClick={() => onMove(1)}>次の人 ›</Btn></>}>
      {!r ? (
        <div className="empty"><Chip tone="bad">未提出</Chip>{!ro && onRemind && <Btn kind="ghost sm" onClick={() => onRemind([row])}>この人にリマインド</Btn>}</div>
      ) : (
        <>
          <div className="row">{hm(r.submittedAt || r.updatedAt) && <Chip>{hm(r.submittedAt || r.updatedAt)} 提出</Chip>}{!ro && String(r.question || "").trim() && <Chip tone="warn">質問あり</Chip>}</div>
          {arr(r.goalItems).length > 0 && <div className="mgoal"><span className="eyebrow">今日の目標</span><div className="ticks">{r.goalItems.map((g, i) => <span key={i} className={g?.done ? "on" : ""}>{g?.done ? "✓" : "・"} {g?.text || g?.title || ""}</span>)}</div></div>}
          <dl className="kv">{rows.map(([f, l, v]) => <div key={f}><dt>{l}</dt><dd className="st-pre">{String(v)}</dd></div>)}</dl>
          <div className="dr-th st-th">
            <div className="head"><h3 className="h3">コメント</h3><span className="r"><Chip>本人・講師・企業</Chip></span></div>
            <div className="dr-tl">
              {threadOf(r, row.name).map(c => (
                <div key={c.id} className={`dr-m ${c.role === "me" ? "c-rep" : c.role === "client" ? "c-tst" : "c-tm"}`}>
                  <span className="row st-mh"><Chip tone={c.role === "client" ? "co" : c.role === "me" ? "" : "mk"}>{c.role === "me" ? "本人" : ROLE[c.role] || "講師"}</Chip>{c.who && <b>{c.who}</b>}<small className="num">{c.at ? `${md(c.at)} ${hm(c.at)}` : ""}</small></span>
                  <p>{c.text}</p>
                </div>
              ))}
            </div>
            <textarea value={text} rows={3} placeholder="コメントを書く" aria-label="コメント" onChange={e => setText(e.target.value)} />
            {err && <div className="lms-err" role="alert">{err}</div>}
            <span className="row st-end">{!ro && <Btn kind="ghost sm" disabled={!!busy} onClick={draft}>{busy === "ai" ? "下書きしています" : "AI で下書き"}</Btn>}<Btn kind="sm" disabled={!text.trim() || !!busy} onClick={send}>{busy === "send" ? "送っています" : "送る"}</Btn></span>
          </div>
        </>
      )}
    </Modal>
  );
}

function RemindModal({ people, date, courseId, onClose, say }) {
  const [text, setText] = useState(`${md(date)} の日報をお願いします。`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async () => {
    setBusy(true); setErr("");
    try { await apiPost("/trainees/notify", { courseId, date, kind: "remind", traineeIds: people.map(p => p.id), message: text.trim() }); say?.(`${people.length} 人にリマインドを送りました`); onClose(); }
    catch (e) { setErr(errText(e, "送れませんでした")); } finally { setBusy(false); }
  };
  return (
    <Modal title="リマインドを送る" width={480} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy || !text.trim()} onClick={send}>{busy ? "送っています" : `${people.length} 人に送る`}</Btn></>}>
      <div className="row">{people.slice(0, 12).map(p => <Chip key={p.id}>{p.name}</Chip>)}{people.length > 12 && <Chip>ほか {people.length - 12} 人</Chip>}</div>
      <textarea value={text} rows={3} aria-label="本文" onChange={e => setText(e.target.value)} />
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

function MonthView({ courseId, month, setMonth, roster, pins, ro, go, onDay, sw }) {
  const today = todayStr();
  const wdays = useWorkdays(courseId, month);
  const [mode, setMode] = useState("cal");
  const [byDate, setByDate] = useState(null);
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("miss");
  const dates = useMemo(() => wdays.dates.filter(d => d <= today), [wdays.dates, today]);
  useEffect(() => {
    if (wdays.state !== "ready") return undefined;
    let alive = true;
    setByDate(null);
    Promise.all(dates.map(d => apiGet(`/reports?date=${d}`).then(l => [d, new Set(arr(l).filter(x => x.deleted !== true).map(x => x.traineeId))]).catch(() => [d, null])))
      .then(p => { if (alive) setByDate(new Map(p)); });
    return () => { alive = false; };
  }, [wdays.state, dates]);
  const [y, m] = month.split("-").map(Number);
  const moveMonth = n => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const nav = <span className="seg"><button type="button" onClick={() => moveMonth(-1)}>‹</button><button type="button" aria-pressed="true" className="num">{m}月</button><button type="button" disabled={month >= today.slice(0, 7)} onClick={() => moveMonth(1)}>›</button></span>;
  const head = rest => <div className="head"><div><h1 className="h1">日報 ・ {m}月</h1></div><span className="r">{sw}{nav}<span className="seg"><button type="button" aria-pressed={mode === "cal"} onClick={() => setMode("cal")}>カレンダー</button><button type="button" aria-pressed={mode === "ppl"} onClick={() => setMode("ppl")}>人ごと</button></span>{rest}</span></div>;
  if (wdays.state === "error") return <>{head()}<Card><div className="empty"><b>研修日を確認できません</b></div></Card></>;
  if (wdays.state === "setup_required") return <>{head()}<Card><div className="empty"><Chip tone="warn">研修日が未設定</Chip></div></Card></>;
  if (!byDate || !roster) return <>{head()}<div className="soon card">読み込み中</div></>;
  const ids = new Set(roster.map(p => p.id));
  if (mode === "cal") {
    const first = new Date(y, m - 1, 1), blanks = (first.getDay() + 6) % 7, last = new Date(y, m, 0).getDate();
    const cells = [];
    for (let d = 1; d <= last; d++) {
      const iso = `${month}-${String(d).padStart(2, "0")}`, w = new Date(y, m - 1, d).getDay();
      if (!wdays.dates.includes(iso)) { cells.push(<span key={d} className={w === 0 || w === 6 ? "off" : "fut"}><b>{d}</b></span>); continue; }
      if (iso > today) { cells.push(<span key={d} className="fut"><b>{d}</b></span>); continue; }
      const got = byDate.get(iso);
      const miss = got ? roster.filter(p => !got.has(p.id)).length : null;
      cells.push(<button key={d} type="button" className={iso === today ? "td" : ""} onClick={() => onDay(iso)}><b>{d}</b>{miss == null ? <i className="l">確認できません</i> : miss ? <i className="a">未提出 {miss}人</i> : <i className="p">問題なし</i>}</button>);
    }
    return <>{head()}<Card><div className="mcal">{["月", "火", "水", "木", "金", "土", "日"].map(w => <span key={w} className="h">{w}</span>)}{Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}{cells}</div></Card></>;
  }
  const rows = roster.map(p => { const v = dates.map(d => { const g = byDate.get(d); return g ? g.has(p.id) : null; }); return { ...p, v, miss: v.filter(x => x === false).length, ok: v.filter(Boolean).length }; }).filter(p => ids.has(p.id));
  const missN = rows.filter(r => r.miss > 0).length;
  const list = rows.filter(r => matchName(r.name, r.kana, q) && (tab === "all" || (tab === "pin" ? pins.has(r.id) : tab === "miss" ? r.miss > 0 : r.miss === 0)))
    .sort((a, b) => (ro ? Number(pins.has(b.id)) - Number(pins.has(a.id)) : 0) || (sort === "miss" ? b.miss - a.miss : sort === "name" ? (a.kana || a.name).localeCompare(b.kana || b.name, "ja") : b.ok - a.ok));
  const xlsx = () => saveXlsx(`日報_${month}`, "日報", [["受講生", "未提出", ...dates.map(md)], ...list.map(r => [r.name, r.miss, ...r.v.map(x => (x == null ? "?" : x ? "○" : "×"))])]);
  return (
    <>
      {head(<Btn kind="ghost sm" onClick={xlsx}>Excel で受け取る</Btn>)}
      <ListTool tabs={[["all", "すべて", rows.length], ...(ro ? [["pin", "担当", rows.filter(r => pins.has(r.id)).length, "ok"]] : []), ["miss", "未提出がある", missN, "warn"], ["full", "全部出した", rows.length - missN, "ok"]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["miss", "未提出の多い順"], ["name", "名前順"], ["ok", "提出の多い順"]]} sort={sort} onSort={setSort} />
      <Card className=""><div className="scroll"><table className="tbl amx"><thead><tr><th>受講生</th><th>未提出</th>{dates.map(d => <th key={d} className="num">{Number(d.slice(8))}</th>)}</tr></thead><tbody>
        {list.map(r => (
          <tr key={r.id}><td><b>{pins.has(r.id) && <i className="pinm" title="担当の受講生">✓</i>}{r.name}</b></td><td>{r.miss ? <Chip tone="bad">{r.miss} 日</Chip> : <Chip tone="ok">0</Chip>}</td>
            {r.v.map((x, i) => <td key={i}><button type="button" className={`am${x === false ? " a" : ""}`} aria-label={`${md(dates[i])} ${x === false ? "未提出" : x == null ? "確認できません" : "提出"}`} onClick={() => { setStaffFocus({ kind: "report", date: dates[i], id: r.id }); onDay(dates[i], r.id); }}>{x == null ? "?" : x ? "✓" : "×"}</button></td>)}
          </tr>
        ))}
        {!list.length && <tr><td colSpan={dates.length + 2}><Chip>見つかりません</Chip></td></tr>}
      </tbody></table></div></Card>
    </>
  );
}

export default function StaffReports({ role, go, say }) {
  const ro = role === "client";
  const today = todayStr();
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const { list: roster, reload: reloadRoster } = useRoster(courseId);
  const { pins } = usePins(ro);
  const [view, setView] = useState("day");
  const [focus] = useState(() => takeStaffFocus("report"));
  const [date, setDate] = useState(focus?.date || today);
  const [month, setMonth] = useState((focus?.date || today).slice(0, 7));
  const wdays = useWorkdays(courseId, date.slice(0, 7));
  const [st, setSt] = useState({ state: "loading", reports: [] });
  const [fields, setFields] = useState(null);
  const [me, setMe] = useState("");
  const [open, setOpen] = useState(focus?.id || "");
  const [tab, setTab] = useState(ro ? "all" : "all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("status");
  const [remind, setRemind] = useState(null);

  useEffect(() => { if (ro) getCurrentUser().then(u => setMe(u?.userId || u?.username || "")).catch(() => {}); }, [ro]);
  const load = useCallback(() => {
    let alive = true;
    setSt(s => ({ ...s, state: "loading" }));
    apiGet(`/reports?date=${date}`).then(r => { if (alive) setSt({ state: "ready", reports: arr(r).filter(x => x.deleted !== true) }); }).catch(() => { if (alive) setSt({ state: "error", reports: [] }); });
    return () => { alive = false; };
  }, [date]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!courseId) return;
    apiGet(`/courses/${encodeURIComponent(courseId)}/report-settings`).then(r => setFields(arr(r?.fields))).catch(() => setFields([]));
  }, [courseId]);

  const rows = useMemo(() => (roster || []).map(p => {
    const report = st.reports.find(x => x.traineeId === p.id) || null;
    const s = !report ? "none" : hasStaffComment(report) ? "done" : "wait";
    return { ...p, report, st: s, unread: !!report && !!me && !arr(report.clientReadIds).includes(me) };
  }), [roster, st.reports, me]);
  const cnt = k => rows.filter(r => r.st === k).length;
  const match = r => (tab === "all" ? true : tab === "pin" ? pins.has(r.id) : tab === "unread" ? r.unread : tab === "sub" ? r.st !== "none" : r.st === tab);
  const ord = { none: 0, wait: 1, done: 2 };
  const list = rows.filter(r => match(r) && matchName(r.name, r.kana, q)).sort((a, b) => (ro ? Number(pins.has(b.id)) - Number(pins.has(a.id)) : 0)
    || (sort === "name" ? (a.kana || a.name).localeCompare(b.kana || b.name, "ja") : sort === "time" ? String(a.report?.submittedAt || "z").localeCompare(String(b.report?.submittedAt || "z")) : ord[a.st] - ord[b.st]));
  const order = list.map(r => r.id);
  const cur = rows.find(r => r.id === open) || null;

  const pick = r => {
    setOpen(r.id);
    if (ro && r.unread) {
      setSt(s => ({ ...s, reports: s.reports.map(x => (x.traineeId === r.id ? { ...x, clientReadIds: [...arr(x.clientReadIds), me] } : x)) }));
      apiPut(`/reports/${encodeURIComponent(r.id)}/read`, { date }).catch(() => {});
    }
  };
  const comment = async (rep, t) => {
    const res = await apiPut(`/reports/${encodeURIComponent(rep.traineeId)}/comment`, { date, comment: t });
    const c = res?.comment || { text: t, authorRole: role, createdAt: new Date().toISOString() };
    setSt(s => ({ ...s, reports: s.reports.map(x => (x.traineeId === rep.traineeId ? { ...x, comments: [...arr(x.comments), c] } : x)) }));
  };
  const sw = <span className="seg"><button type="button" aria-pressed={view === "day"} onClick={() => setView("day")}>日</button><button type="button" aria-pressed={view === "month"} onClick={() => setView("month")}>月</button></span>;

  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>日報</b><Chip>コースなし</Chip></div></Card>;
  if (roster === null) return <Card><div className="empty"><b>受講生を確認できません</b><Btn kind="ghost sm" onClick={reloadRoster}>再読み込み</Btn></div></Card>;
  if (view === "month") return <div className="st"><MonthView courseId={courseId} month={month} setMonth={setMonth} roster={roster} pins={pins} ro={ro} go={go} sw={sw} onDay={(d, id) => { setDate(d); setView("day"); if (id) setOpen(id); }} /></div>;

  const missing = rows.filter(r => r.st === "none");
  return (
    <div className="st">
      <div className="head">
        <div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">日報 ・ {dayLabel(date)}</h1></div>
        <span className="r">{sw}<span className="seg"><button type="button" aria-label="前の研修日" onClick={() => setDate(stepDate(date, -1, wdays.dates))}>‹</button><button type="button" aria-pressed={date === today} onClick={() => setDate(today)}>今日</button><button type="button" aria-label="次の研修日" disabled={date >= today} onClick={() => { const n = stepDate(date, 1, wdays.dates); if (n <= today) setDate(n); }}>›</button></span></span>
      </div>
      {st.state === "error" ? <Card><div className="empty"><b>日報を確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div></Card> : (
        <>
          <ListTool tabs={[["all", "すべて", rows.length], ...(ro ? [["pin", "担当", rows.filter(r => pins.has(r.id)).length, "ok"], ["unread", "未読", rows.filter(r => r.unread).length, "warn"]] : []), ["none", "未提出", cnt("none"), "bad"], ...(ro ? [["sub", "提出済み", rows.length - cnt("none"), "ok"]] : [["wait", "コメントなし", cnt("wait")], ["done", "コメントあり", cnt("done"), "ok"]])]}
            tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["status", "状態順（未提出が上）"], ["name", "名前順"], ["time", "提出の時刻順"]]} sort={sort} onSort={setSort} />
          {tab === "none" && missing.length > 0 && !ro && (
            <div className="missbar"><b>未提出 {missing.length} 人</b><span>{missing.map(r => r.name).join("・")}</span><Btn kind="ghost sm" onClick={() => { copyText(missing.map(r => r.name).join("、")); say?.("名前を写しました"); }}>名前を写す</Btn><Btn kind="sm" onClick={() => setRemind(missing)}>リマインドを送る</Btn></div>
          )}
          {st.state === "loading" || roster === undefined ? <div className="soon card">読み込み中</div> : (
            <div className="card pick rlist">
              {list.map(r => (
                <button key={r.id} type="button" onClick={() => pick(r)}>
                  <span className="face">{r.name.slice(0, 1)}</span>
                  <span><b>{pins.has(r.id) && <i className="pinm" title="担当の受講生">✓</i>}{r.unread && <i className="st-dot" aria-label="未読" />}{r.name}</b><small>{r.st === "none" ? "未提出" : `${hm(r.report.submittedAt || r.report.updatedAt)} ・ ${goalsOf(r.report)}${snippet(r.report)}`}</small></span>
                  {r.st === "none" ? <Chip tone="bad">未提出</Chip> : ro ? <Chip tone="ok">提出</Chip> : r.st === "done" ? <Chip tone="ok">済</Chip> : <Chip tone="warn">待ち</Chip>}
                </button>
              ))}
              {!list.length && <div className="empty"><Chip>見つかりません</Chip></div>}
            </div>
          )}
        </>
      )}
      {cur && <ReportModal row={cur} date={date} order={order.includes(cur.id) ? order : rows.map(r => r.id)} ro={ro} fields={fields} say={say} onClose={() => setOpen("")} onComment={comment} onRemind={ro ? null : p => { setOpen(""); setRemind(p); }}
        onMove={n => { const o = order.includes(cur.id) ? order : rows.map(r => r.id), id = o[o.indexOf(cur.id) + n]; const nx = rows.find(r => r.id === id); if (nx) pick(nx); }} />}
      {remind && <RemindModal people={remind} date={date} courseId={courseId} say={say} onClose={() => setRemind(null)} />}
    </div>
  );
}
