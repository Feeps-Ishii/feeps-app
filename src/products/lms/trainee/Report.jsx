import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../../api.js";
import { isWrittenNote } from "../../training/notesLessons.js";
import { fieldValue, threadOf, useTraineeReport } from "./useTraineeReport.js";
import { Btn, Cal, Card, Chip, ListTool, Modal, weekday } from "../parts/ui.jsx";

/* 受講生の日報（モック reportT2）：上に日付と書けた数、朝（今日の目標・小目標）と夕方（振り返り）を分け、
   提出は下に残るバーで。右はこれまでの日報（月ごと・絞り込み）。「今日のノートを見る」で右をノートに切り替える */

const SUN = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></svg>;
const MOON = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" /></svg>;
const parts = d => { const [y, m, dd] = String(d).split("-").map(Number); return { y, m, d: dd, md: `${m}/${dd}` }; };
const hm = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const stamp = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()} ${hm(iso)}`; };
const shiftMonth = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const LIMIT = 8;

function Thread({ report, onSend, say }) {
  const list = threadOf(report);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!list.some(x => x.role !== "me")) return null;
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setErr("");
    try { await onSend(text.trim()); setText(""); say("返事を送りました"); }
    catch (e) { setErr(e?.errorMessage || "送れませんでした"); }
    finally { setBusy(false); }
  };
  return (
    <Card className="pad dr-th">
      <div className="head"><h2 className="h2">コメント</h2><span className="r"><Chip>{list.length}</Chip></span></div>
      <div className="dr-tl">
        {list.map(c => (
          <div key={c.id} className={`dr-m ${c.role === "me" ? "me" : c.role === "client" ? "c-tst" : "c-tm"}`}>
            <div className="dr-mh"><b>{c.who}</b>{c.label && <Chip tone={c.role === "client" ? "co" : "mk"}>{c.label}</Chip>}<small className="num">{stamp(c.at)}</small></div>
            <p>{c.text}</p>
          </div>
        ))}
      </div>
      <label className="dr-f"><span className="dr-fl">返事</span><textarea id="lms-report-reply" rows={2} value={text} onChange={e => setText(e.target.value)} /></label>
      {err && <div className="lms-err" role="alert">{err}</div>}
      <span className="row" style={{ justifyContent: "flex-end" }}><Btn kind="sm" disabled={busy || !text.trim()} onClick={send}>{busy ? "送信中" : "返事する"}</Btn></span>
    </Card>
  );
}

// これまでの日報の窓（モック dayModal）：読む → この日を書く・直す
function DayModal({ r, row, say, onClose }) {
  const rep = row.rep, p = parts(row.d), goals = rep?.goalItems || [];
  return (
    <Modal title={`${p.md}（${weekday(p.m, p.d, p.y)}）の日報`} width={640} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>閉じる</Btn><Btn onClick={() => { onClose(); r.goDate(row.d); window.scrollTo?.(0, 0); }}>{rep ? "この日を直す" : "この日を書く"}</Btn></>}>
      <div className="row">{rep ? <Chip tone="ok">提出済み</Chip> : <Chip tone="warn">まだ</Chip>}</div>
      {rep && (
        <>
          {(rep.morningGoal || goals.length > 0) && <div className="mgoal"><span className="eyebrow">朝 ・ 今日の目標</span>{rep.morningGoal && <b>{rep.morningGoal}</b>}{goals.length > 0 && <div className="ticks">{goals.map(g => <span key={g.id} className={g.done ? "on" : ""}>{g.done ? "✓" : "・"} {g.text}</span>)}</div>}</div>}
          <dl className="kv">{r.fields.map(f => <div key={f.id}><dt>{f.label}</dt><dd>{String(fieldValue(rep, f.id) || "").trim() || "—"}</dd></div>)}</dl>
          <Thread key={row.d} report={rep} onSend={t => r.sendReply(t, row.d)} say={say} />
        </>
      )}
    </Modal>
  );
}

function History({ r, say }) {
  const [view, setView] = useState(null);
  const [tab, setTab] = useState("all");
  const [all, setAll] = useState(false);
  const rows = useMemo(() => r.days.dates.filter(d => d.startsWith(r.month) && d <= r.today).sort((a, b) => b.localeCompare(a)).map(d => {
    const rep = r.reports.find(x => x.date === d);
    const comments = threadOf(rep).filter(x => x.role !== "me").length;
    const goals = rep?.goalItems || [];
    return { d, rep, comments, title: rep ? String(rep.learned || rep.morningGoal || "提出済み").split("\n")[0] : "", goals: goals.length, done: goals.filter(g => g.done).length, draft: !rep && !!r.drafts[d] };
  }), [r.days.dates, r.month, r.today, r.reports, r.drafts]);
  const n = { late: rows.filter(x => !x.rep).length, cmt: rows.filter(x => x.comments > 0).length };
  const shown = rows.filter(x => (tab === "late" ? !x.rep : tab === "cmt" ? x.comments > 0 : true));
  const list = all ? shown : shown.slice(0, LIMIT);
  const course = r.courses.find(c => c.courseId === r.courseId);
  const minM = String(course?.startDate || "").slice(0, 7), nowM = r.today.slice(0, 7);
  return (
    <Card className="pad dr-hc">
      <div className="head"><h2 className="h2">これまでの日報</h2>
        <span className="r"><span className="seg dr-mo">
          <button type="button" aria-label="前の月" disabled={!!minM && r.month <= minM} onClick={() => r.setMonth(shiftMonth(r.month, -1))}>‹</button>
          <button type="button" aria-pressed="true">{Number(r.month.slice(5))}月</button>
          <button type="button" aria-label="次の月" disabled={r.month >= nowM} onClick={() => r.setMonth(shiftMonth(r.month, 1))}>›</button>
        </span></span>
      </div>
      {r.days.state === "error"
        ? <div className="empty"><b>研修日を確認できません</b><Btn kind="ghost sm" onClick={r.reload}>再読み込み</Btn></div>
        : (
          <>
            <ListTool tabs={[["all", "すべて", rows.length], ["late", "まだ", n.late, "warn"], ["cmt", "コメントあり", n.cmt, "ok"]]} tab={tab} onTab={setTab} />
            <div className="dr-hl">
              {list.map(x => {
                const k = !x.rep ? "att" : x.comments ? "rep" : "gy", p = parts(x.d);
                return (
                  <button key={x.d} type="button" className={`dr-hi c-${k}${x.d === r.date ? " on" : ""}`} aria-current={x.d === r.date ? "date" : undefined} onClick={() => setView(x.d)}>
                    <Cal date={p.md} year={p.y} cat={k} />
                    <span className="dr-hb"><b>{x.rep ? x.title : "未提出"}</b><small>{x.rep ? (x.goals ? `小目標 ${x.done} / ${x.goals}` : "提出済み") : x.draft ? "書きかけあり" : "後から記入可"}</small></span>
                    {!x.rep ? <Chip tone="warn">まだ</Chip> : x.comments ? <Chip tone="ok">コメント {x.comments}</Chip> : <span className="dr-nc">コメントなし</span>}
                  </button>
                );
              })}
              {r.days.state !== "loading" && shown.length === 0 && <div className="th-none"><Chip>なし</Chip></div>}
            </div>
            {shown.length > LIMIT && <div className="row" style={{ justifyContent: "center" }}><Btn kind="ghost sm" onClick={() => setAll(v => !v)}>{all ? "たたむ" : `残り ${shown.length - LIMIT} 日を見る`}</Btn></div>}
          </>
        )}
      {view && rows.some(x => x.d === view) && <DayModal r={r} row={rows.find(x => x.d === view)} say={say} onClose={() => setView(null)} />}
    </Card>
  );
}

function Notes({ r, onClose }) {
  const [notes, setNotes] = useState(null);
  const [err, setErr] = useState(false);
  const [target, setTarget] = useState(() => (r.fields.some(f => f.id === "learned") ? "learned" : r.fields[0]?.id || ""));
  const [used, setUsed] = useState(() => new Set());
  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    setErr(false); setNotes(null);
    apiGet("/notes/me?limit=100")
      .then(list => { if (alive) setNotes((Array.isArray(list) ? list : []).filter(n => isWrittenNote(n) && String(n.createdAt || "").slice(0, 10) === r.date && (!r.courseId || n.courseId === r.courseId))); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [r.date, r.courseId, key]);
  return (
    <Card className="pad dr-hc">
      <div className="head"><h2 className="h2">この日のノート</h2><span className="r"><Btn kind="ghost sm" onClick={onClose}>閉じる</Btn></span></div>
      {err
        ? <div className="empty"><b>ノートを確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div>
        : notes === null ? <div className="empty">読み込み中</div>
          : notes.length === 0 ? <div className="th-none"><Chip>なし</Chip></div>
            : (
              <>
                <label className="dr-f"><span className="dr-fl">入れ先</span>
                  <select className="in" value={target} onChange={e => setTarget(e.target.value)}>{r.fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
                </label>
                <div className="dr-nl">
                  {notes.map(n => (
                    <div key={n.noteId} className={`dr-n${used.has(n.noteId) ? " used" : ""}`}>
                      <p>{String(n.body || "").slice(0, 300)}</p>
                      <Btn kind="ghost sm" disabled={!r.canEdit} onClick={() => { r.insertNote(target, String(n.body || "").trim()); setUsed(s => new Set(s).add(n.noteId)); }}>{used.has(n.noteId) ? "もう一度入れる" : "日報へ入れる"}</Btn>
                    </div>
                  ))}
                </div>
              </>
            )}
    </Card>
  );
}

export default function TraineeReport({ say }) {
  const r = useTraineeReport();
  const [showNotes, setShowNotes] = useState(false);
  if (r.state === "loading") return <div className="soon card">読み込み中</div>;
  if (r.state === "error") return <Card><div className="empty"><b>日報を確認できません</b><Btn kind="ghost sm" onClick={r.reload}>再読み込み</Btn></div></Card>;

  const { draft, date, today, report, canEdit } = r;
  const isToday = date === today, p = parts(date), done = !!report; const dirty = done && !!r.drafts[date];
  const goalsDone = draft.goalItems.filter(g => g.done).length;
  const hasGoal = !!draft.morningGoal.trim();
  const filled = r.fields.filter(f => String(fieldValue(draft, f.id)).trim()).length;
  const updateGoal = (id, patch) => r.setDraft(d => ({ ...d, goalItems: d.goalItems.map(g => (g.id === id ? { ...g, ...patch } : g)) }));
  const addGoal = () => r.setDraft(d => ({ ...d, goalItems: [...d.goalItems, { id: `goal_${Date.now()}`, text: "", done: false }] }));
  const delGoal = id => r.setDraft(d => ({ ...d, goalItems: d.goalItems.filter(g => g.id !== id) }));
  const latest = [...r.days.dates].filter(d => d <= today).pop();
  const block = r.fieldsState === "error" ? "日報の項目を確認できません"
    : r.days.state === "error" ? "研修日を確認できません"
      : r.days.state === "setup_required" ? "研修日の設定待ち"
        : r.conflict ? "別の研修と日程が重複"
          : r.days.state === "ready" && !r.isDay ? "研修のない日" : "";
  const saveText = r.autoSave.state === "saving" ? "保存中" : r.autoSave.state === "error" ? "自動保存に失敗" : r.autoSave.at ? `自動保存 ${hm(r.autoSave.at)}` : "";
  const submit = async () => { if (await r.submit()) say(done ? "直して提出しました" : "提出しました"); };

  return (
    <div className="th dr">
      <div className="th-top">
        <div className="th-date">
          <b className="num">{p.d}</b>
          <div><em>{p.m}月 ・ {weekday(p.m, p.d, p.y)}曜日</em><small>{isToday ? "今日の日報" : "これまでの日報"}</small></div>
        </div>
        <div className="th-att">
          <span className={`th-pill${hasGoal ? " ok" : ""}`}><i aria-hidden="true" />朝の目標 <b>{hasGoal ? "済" : "まだ"}</b></span>
          <span className={`th-pill${filled === r.fields.length ? " ok" : ""}`}><i aria-hidden="true" />振り返り <b>{filled} / {r.fields.length}</b></span>
        </div>
      </div>

      {!isToday && <div className="dr-edit"><span>{p.md} の日報</span><Btn kind="ghost sm" onClick={() => { r.goDate(today); r.setMonth(today.slice(0, 7)); }}>今日の日報に戻る</Btn></div>}
      {block && (
        <div className="dr-block" role="status"><b>{block}</b>
          {(r.fieldsState === "error" || r.days.state === "error") && <Btn kind="ghost sm" onClick={r.reload}>再読み込み</Btn>}
          {!r.isDay && r.days.state === "ready" && latest && latest !== date && <Btn kind="ghost sm" onClick={() => { r.setMonth(latest.slice(0, 7)); r.goDate(latest); }}>直近の研修日へ</Btn>}
        </div>
      )}
      {report && <Thread key={date} report={report} onSend={r.sendReply} say={say} />}

      <div className="dr-grid">
        <div className="dr-l">
          <section className="card pad dr-sec c-att">
            <div className="dr-h"><span className="dr-ic">{SUN}</span><div><span className="eyebrow">朝</span><h2 className="h2">今日の目標</h2></div></div>
            <label className="dr-f">
              <span className="dr-fl">今日の大きな目標{r.prefill && <Chip tone="mk">前日の「明日の目標」から</Chip>}</span>
              <textarea id="lms-report-goal" className="dr-big" rows={2} disabled={!canEdit} value={draft.morningGoal} onChange={e => r.setField("morningGoal", e.target.value)} />
            </label>
            <div className="dr-f">
              <span className="dr-fl">小目標{draft.goalItems.length > 0 && <span className="dr-cnt num">{goalsDone} / {draft.goalItems.length}</span>}</span>
              {draft.goalItems.length > 0 && (
                <div className="dr-goals">
                  {draft.goalItems.map(g => (
                    <label key={g.id} className={g.done ? "on" : ""}>
                      <input type="checkbox" checked={g.done} disabled={!canEdit} aria-label={`${g.text || "小目標"} ができた`} onChange={e => updateGoal(g.id, { done: e.target.checked })} />
                      <input type="text" value={g.text} disabled={!canEdit} aria-label="小目標" onChange={e => updateGoal(g.id, { text: e.target.value })} />
                      <button type="button" aria-label="削除" disabled={!canEdit} onClick={e => { e.preventDefault(); delGoal(g.id); }}>×</button>
                    </label>
                  ))}
                </div>
              )}
              <span><Btn kind="ghost sm" disabled={!canEdit} onClick={addGoal}>＋ 小目標を足す</Btn></span>
            </div>
          </section>

          <section className="card pad dr-sec c-cur">
            <div className="dr-h"><span className="dr-ic">{MOON}</span><div><span className="eyebrow">夕方</span><h2 className="h2">振り返り</h2></div>
              <span className="r"><Btn kind="ghost sm" onClick={() => setShowNotes(v => !v)}>{showNotes ? "ノートを閉じる" : isToday ? "今日のノートを見る" : "この日のノートを見る"}</Btn></span>
            </div>
            {r.fields.map((f, i) => {
              const v = fieldValue(draft, f.id);
              return (
                <label key={f.id} className="dr-f">
                  <span className="dr-fl"><em className="num">{i + 1}</em>{f.label}{f.required && <Chip tone="bad">必須</Chip>}{f.id === "question" && <Chip tone="mk">講師に届く</Chip>}{v && <span className="dr-len num">{v.length} 字</span>}</span>
                  <textarea id={`lms-report-${f.id}`} rows={f.id === "learned" || f.id === "reflection" ? 3 : 2} placeholder={f.placeholder || ""} disabled={!canEdit} value={v} onChange={e => r.setField(f.id, e.target.value)} />
                </label>
              );
            })}
          </section>
        </div>
        {showNotes ? <Notes r={r} onClose={() => setShowNotes(false)} /> : <History say={say} r={r} />}
      </div>

      {r.err && <div className="lms-err" role="alert">{r.err}</div>}
      <div className={`dr-bar${done && !dirty ? " done" : ""}`} role="status">
        <span className="dr-st"><i aria-hidden="true" /><span><b>{dirty ? "変更を未提出" : done ? "提出済み" : "未提出"}</b><small>{saveText || (report?.updatedAt ? `提出 ${stamp(report.updatedAt)}` : "")}</small></span></span>
        <span className="dr-sum">{draft.goalItems.length > 0 && <>小目標 <b className="num">{goalsDone} / {draft.goalItems.length}</b><span aria-hidden="true">・</span></>}振り返り <b className="num">{filled} / {r.fields.length}</b></span>
        <Btn kind={done ? "ghost" : ""} disabled={!canEdit} onClick={submit}>{r.saving ? "提出中" : done ? "直して提出する" : "提出する"}</Btn>
      </div>
    </div>
  );
}
