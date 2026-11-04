import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../../../api.js";
import { kindOf } from "../trainee/useTraineeAttendance.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Cal, Chip, Hero, Kpi, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, errText, md, saveXlsx, setStaffFocus, usePins, useRoster, useStaffCourse, useStats, useWorkdays } from "./common.js";
import { TestRow } from "./parts.jsx";

/* 受講生（企業担当者・講師で共通。モック peopleC・karteC）：一覧は担当 ✓・絞り込み・探す・並べ替え、押すとひとりのページ。
   講師メモは企業担当者には出さない（API が見える範囲を決める）。評価表の点は /evaluations から */

const LOW = 60;
const asc = (a, b) => (a ?? 1000) - (b ?? 1000);

function Karte({ person, stats, ro, pinned, onPin, onBack, go, say, today, evalScore }) {
  const [reports, setReports] = useState(null);
  const [memos, setMemos] = useState(null);
  const [memoText, setMemoText] = useState(""); const [memoShare, setMemoShare] = useState("staff"); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [todayAtt, setTodayAtt] = useState(undefined);
  const [goals, setGoals] = useState(undefined);
  const [talk, setTalk] = useState(null); // 声をかける文
  const [talkBusy, setTalkBusy] = useState("");
  const [memoBusy, setMemoBusy] = useState(false);
  const courseId = stats?.courseId;
  const wd = useWorkdays(courseId, today.slice(0, 7));
  const id = person.id;
  useEffect(() => {
    if (wd.state !== "ready") return undefined;
    let alive = true;
    const days = wd.dates.filter(d => d <= today).slice(-5).reverse();
    Promise.all(days.map(d => apiGet(`/reports?date=${d}`).then(l => [d, arr(l).find(r => r.traineeId === id && r.deleted !== true) || null]).catch(() => [d, undefined])))
      .then(p => { if (alive) setReports(p); });
    return () => { alive = false; };
  }, [wd.state, wd.dates, today, id]);
  const loadMemos = () => apiGet(`/karte/${id}`).then(l => setMemos(arr(l))).catch(() => setMemos(null));
  useEffect(() => { loadMemos(); apiGet(`/attendance?date=${today}`).then(l => setTodayAtt(arr(l).find(r => r.traineeId === id && r.deleted !== true) || null)).catch(() => setTodayAtt(undefined)); }, [id, today]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (ro) return;
    apiGet(`/tasks/${id}`).then(t => setGoals({ goals: arr(t?.goals), done: t?.done || {} })).catch(() => setGoals(null));
  }, [ro, id]);
  const memoDraft = async () => {
    if (!memoText.trim()) { setErr("メモを書いてください"); return; }
    setMemoBusy(true); setErr("");
    try {
      const k = person.stat;
      const r = await apiPost("/ai/staff-draft", { kind: "karte", courseId, text: memoText, context: { name: person.name, attendanceRate: k?.attendanceRate, reportRate: k?.reportRate, testAverage: k?.testAverage } });
      setMemoText(r.text);
    } catch (e) { setErr(errText(e, "下書きを作れませんでした")); } finally { setMemoBusy(false); }
  };
  const talkDraft = async () => {
    setTalkBusy("ai");
    try { const r = await apiPost("/ai/staff-draft", { kind: "talk", courseId, text: talk || "最近の様子を気にかけていることを伝える", context: { name: person.name } }); setTalk(r.text); }
    catch (e) { setErr(errText(e, "下書きを作れませんでした")); } finally { setTalkBusy(""); }
  };
  const talkSend = async () => {
    setTalkBusy("send");
    try { await apiPost("/trainees/notify", { courseId, kind: "talk", traineeIds: [id], message: talk.trim() }); say?.("送りました"); setTalk(null); }
    catch (e) { setErr(errText(e, "送れませんでした")); setTalk(null); } finally { setTalkBusy(""); }
  };
  const addMemo = async () => {
    if (!memoText.trim() || busy) return;
    setBusy(true); setErr("");
    try { await apiPost(`/karte/${id}`, { text: memoText.trim(), visibility: memoShare }); setMemoText(""); setMemoShare("staff"); await loadMemos(); say?.("メモを残しました"); }
    catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(false); }
  };
  const delMemo = async m => {
    try { await apiDelete(`/karte/${id}/${encodeURIComponent(m.memoId || m.id)}`); await loadMemos(); }
    catch (e) { setErr(errText(e, "消せませんでした")); }
  };
  const k = person.stat;
  const kind = todayAtt ? kindOf(todayAtt) : null;
  const tone = kind === "欠勤" ? "dev" : kind === "遅刻" || kind === "早退" ? "att" : "tm";
  const tests = arr(stats?.tests).map((t, i) => ({ ...t, score: k?.scores?.[i] ?? null })).filter(t => t.score != null);
  const days = stats?.period?.trainingDays || 0;
  const present = k ? k.attended - k.late - k.early : 0;
  const passed = tests.filter(t => t.score >= 70).length;
  return (
    <div className="th kt">
      <Hero cat={tone} className="kt-hero">
        <div className="kt-h">
          <span className="kt-av" aria-hidden="true">{person.name.slice(0, 1)}</span>
          <div>
            <span className="eyebrow">受講生</span>
            <h1 className="hero-t">{person.name}</h1>
            <span className="row kt-tags">
              {person.kana && <Chip>{person.kana}</Chip>}
              {kind && <Chip tone={kind === "出勤" ? "ok" : kind === "欠勤" ? "bad" : "warn"}>今日 {kind}{todayAtt?.clockIn ? ` ${todayAtt.clockIn}` : ""}</Chip>}
              {ro && pinned && <Chip tone="ok">担当</Chip>}
              {k?.testAverage != null && k.testAverage < LOW && <Chip tone="bad">点が低い</Chip>}
            </span>
          </div>
          <span className="kt-act">{ro ? <Btn kind="ghost" onClick={onPin}>{pinned ? "担当から外す" : "担当にする"}</Btn> : <Btn kind="ghost" onClick={() => setTalk("")}>声をかける</Btn>}<Btn kind="ghost" onClick={onBack}>一覧へ</Btn></span>
        </div>
        <Kpi items={[
          { label: "出席率", value: k?.attendanceRate ?? "—", unit: k?.attendanceRate != null ? "%" : "", pct: k?.attendanceRate ?? undefined },
          { label: "日報", value: k?.reportDays ?? "—", unit: k ? ` / ${days}` : "", pct: k?.reportRate ?? undefined },
          { label: "テスト平均", value: k?.testAverage ?? "—", unit: k?.testAverage != null ? "点" : "", pct: k?.testAverage ?? undefined },
          { label: "評価表", value: evalScore ? evalScore.got : "—", unit: evalScore ? ` / ${evalScore.max}` : "", pct: evalScore ? Math.round(evalScore.got / evalScore.max * 100) : undefined },
        ]} />
      </Hero>
      <div className="kt-w">
        <div className="tc-l">
          <Card className="pad kt-c">
            <div className="head"><h2 className="h2">最近の日報</h2></div>
            <div className="kt-l">
              {!reports && <div className="dv-mt">読み込み中</div>}
              {(reports || []).map(([d, r]) => (
                r ? <button key={d} type="button" className="kt-r kc-r" onClick={() => { setStaffFocus({ kind: "report", date: d, id }); go("report"); }}><Cal date={md(d)} cat="rep" /><span className="kt-rb">{String(r.learned || r.reflection || "提出").slice(0, 60)}</span><Chip tone="mk">コメント {arr(r.comments).length}</Chip></button>
                  : <div key={d} className="kt-r"><Cal date={md(d)} cat="gy" /><span className="kt-rb none">{r === undefined ? "確認できません" : "未提出"}</span><Chip>{r === undefined ? "?" : "まだ"}</Chip></div>
              ))}
              {reports && !reports.length && <Chip>なし</Chip>}
            </div>
          </Card>
          <Card className="pad kt-c">
            <div className="head"><h2 className="h2">テスト</h2>{tests.length > 0 && <span className="r"><Chip tone="ok">合格 {passed} / {tests.length}</Chip></span>}</div>
            <div className="kt-l">{tests.map(t => <TestRow key={t.testId} title={t.title} score={t.score} />)}{!tests.length && <Chip>なし</Chip>}</div>
          </Card>
        </div>
        <div className="tc-l">
          <Card className="pad kt-c">
            <div className="head"><h2 className="h2">勤怠</h2><span className="r"><Btn kind="ghost sm" onClick={() => go("att")}>勤怠</Btn></span></div>
            {k ? <>
              <span className="ih-seg kc-seg"><i className="c-rep" style={{ flex: present }} /><i className="c-att" style={{ flex: k.late + k.early }} /><i className="c-dev" style={{ flex: k.absent }} /></span>
              <div className="kc-al"><span className="c-rep"><i />出勤<b className="num">{present}</b><small>日</small></span><span className="c-att"><i />遅刻・早退<b className="num">{k.late + k.early}</b><small>日</small></span><span className="c-dev"><i />欠勤<b className="num">{k.absent}</b><small>日</small></span>{k.missing > 0 && <span><i />未打刻<b className="num">{k.missing}</b><small>日</small></span>}</div>
            </> : <Chip>確認できません</Chip>}
          </Card>
          <Card className="pad kt-c">
            <div className="head"><h2 className="h2">評価表</h2><span className="r"><Btn kind="ghost sm" onClick={() => go("eval")}>評価表</Btn></span></div>
            {evalScore ? <div className="kc-ev"><b className="num">{evalScore.got}<small> / {evalScore.max}</small></b><span className="tp-bar"><i style={{ "--w": `${Math.round(evalScore.got / evalScore.max * 100)}%` }} /></span></div> : <div className="kc-ev none"><Chip>公開待ち</Chip></div>}
          </Card>
          {!ro && (
            <Card className="pad kt-c">
              <div className="head"><h2 className="h2">目標</h2></div>
              {goals === null && <Chip>確認できません</Chip>}
              <div className="kt-l">{arr(goals?.goals).map((g, i) => { const ts = arr(g.tasks), n = ts.filter(t => goals.done[t.id]).length; return <div key={g.id || i} className={`kt-g c-${["cur", "att", "tst", "dev", "tm"][i % 5]}`}><span>{g.custom ? `自分の目標：${g.title}` : g.title}</span><span className="tp-bar sm"><i style={{ "--w": `${ts.length ? Math.round(n / ts.length * 100) : 0}%` }} /></span><b className="num">{n} / {ts.length}</b></div>; })}{goals && !arr(goals.goals).length && <Chip>なし</Chip>}</div>
            </Card>
          )}
          {(memos === null || (memos && (memos.length > 0 || !ro))) && (
            <Card className="pad kt-c">
              <div className="head"><h2 className="h2">{ro ? "講師の記録" : "講師メモ"}</h2>{!ro && <span className="r"><Chip>本人には見えません</Chip></span>}</div>
              {memos === null && <Chip>確認できません</Chip>}
              <div className="kt-l">{arr(memos).map(m => <div key={m.memoId || m.id || m.createdAt} className="dr-m c-tm"><span className="row st-mh"><small className="num">{md(m.createdAt)}</small>{!ro && <Chip>{m.visibility === "client" || m.visibility === "shared" ? "企業にも見える" : "講師だけ"}</Chip>}{!ro && <button type="button" className="tm-del" onClick={() => delMemo(m)}>消す</button>}</span><p>{m.text || m.note}</p></div>)}</div>
              {!ro && <>
                <textarea value={memoText} rows={3} placeholder="メモを残す" aria-label="メモ" onChange={e => setMemoText(e.target.value)} />
                <span className="row st-end"><Btn kind="ghost sm" disabled={memoBusy} onClick={memoDraft}>{memoBusy ? "書いています" : "AI でカルテに下書き"}</Btn><select className="in st-sel" value={memoShare} aria-label="見える人" onChange={e => setMemoShare(e.target.value)}><option value="staff">講師だけ</option><option value="client">企業にも見える</option></select><Btn kind="sm" disabled={busy || !memoText.trim()} onClick={addMemo}>残す</Btn></span>
                {err && <div className="lms-err" role="alert">{err}</div>}
              </>}
            </Card>
          )}
        </div>
      </div>
      {talk != null && (
        <Modal title={`${person.name} さんに声をかける`} width={480} onClose={() => setTalk(null)} footer={<><Btn kind="ghost" onClick={() => setTalk(null)}>やめる</Btn><Btn disabled={!!talkBusy || !talk.trim()} onClick={talkSend}>{talkBusy === "send" ? "送っています" : "送る"}</Btn></>}>
          <div className="row"><Chip>本人の通知だけに届く</Chip></div>
          <textarea rows={4} value={talk} aria-label="文" placeholder="伝えたいこと" onChange={e => setTalk(e.target.value)} />
          <span className="row st-end"><Btn kind="ghost sm" disabled={!!talkBusy} onClick={talkDraft}>{talkBusy === "ai" ? "書いています" : "AI で下書き"}</Btn></span>
        </Modal>
      )}
    </div>
  );
}

export default function StaffPeople({ role, go, say }) {
  const ro = role === "client";
  const today = todayStr();
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const { list: roster, reload } = useRoster(courseId);
  const stats = useStats(courseId);
  const { pins, toggle } = usePins(ro);
  const [att, setAtt] = useState(null);
  const [open, setOpen] = useState("");
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState(ro ? "pin" : "kana");
  const [evals, setEvals] = useState({});
  useEffect(() => { apiGet(`/attendance?date=${today}`).then(l => setAtt(new Map(arr(l).filter(x => x.deleted !== true).map(x => [x.traineeId, x])))).catch(() => setAtt(null)); }, [today]);
  useEffect(() => {
    if (!courseId) return;
    apiGet(`/evaluations/summary?courseId=${encodeURIComponent(courseId)}`).then(r => setEvals(r?.scores || {})).catch(() => setEvals({}));
  }, [courseId]);
  const rows = useMemo(() => (roster || []).map(p => {
    const stat = arr(stats.data?.trainees).find(t => t.id === p.id) || null;
    const a = att?.get(p.id);
    return { ...p, stat, kind: a ? kindOf(a) : null };
  }), [roster, stats.data, att]);

  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>受講生</b><Chip>コースなし</Chip></div></Card>;
  if (roster === null) return <Card><div className="empty"><b>受講生を確認できません</b><Btn kind="ghost sm" onClick={reload}>再読み込み</Btn></div></Card>;
  if (roster === undefined) return <div className="soon card">読み込み中</div>;

  const pin = id => { const p = rows.find(r => r.id === id); const was = pins.has(id); toggle(id, () => say?.("保存できませんでした")); say?.(was ? `${p?.name} さんを担当から外しました` : `${p?.name} さんを担当にしました`); };
  const cur = rows.find(r => r.id === open);
  if (cur) return <Karte key={cur.id} person={cur} stats={stats.data} ro={ro} pinned={pins.has(cur.id)} onPin={() => pin(cur.id)} onBack={() => setOpen("")} go={go} say={say} today={today} evalScore={evals[cur.id]} />;

  const issue = r => r.kind && r.kind !== "出勤" && r.kind !== "休暇";
  const low = r => r.stat?.testAverage != null && r.stat.testAverage < LOW;
  const nameKey = r => r.kana || r.name;
  const by = {
    pin: (a, b) => Number(pins.has(b.id)) - Number(pins.has(a.id)) || nameKey(a).localeCompare(nameKey(b), "ja"),
    kana: (a, b) => nameKey(a).localeCompare(nameKey(b), "ja"),
    att: (a, b) => asc(a.stat?.attendanceRate, b.stat?.attendanceRate),
    tlo: (a, b) => asc(a.stat?.testAverage, b.stat?.testAverage),
    thi: (a, b) => asc(b.stat?.testAverage == null ? null : -b.stat.testAverage, a.stat?.testAverage == null ? null : -a.stat.testAverage) * -1,
  }[sort];
  const list = rows.filter(r => (tab === "all" || (tab === "pin" ? pins.has(r.id) : tab === "absent" ? issue(r) : low(r))) && matchName(r.name, r.kana, q)).sort(by);
  const days = stats.data?.period?.trainingDays || 0;
  const xlsx = () => saveXlsx(`受講生_${sc.course.name}`, "受講生", [["受講生", "出席率", "日報", "テスト平均"], ...list.map(r => [r.name, r.stat?.attendanceRate ?? "", r.stat?.reportDays ?? "", r.stat?.testAverage ?? ""])]);
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">受講生 ・ {rows.length} 人</h1></div><span className="r"><Btn kind="ghost sm" onClick={xlsx}>Excel で受け取る</Btn></span></div>
      {ro && pins.size === 0 && <div className="pinhint"><span className="pinc on" aria-hidden="true">✓</span><span><b>担当の受講生に ✓</b><small>一覧・日報・勤怠・ホームの上に表示</small></span></div>}
      <ListTool tabs={[["all", "すべて", rows.length], ...(ro ? [["pin", "担当", rows.filter(r => pins.has(r.id)).length, "ok"]] : []), ["absent", "欠席・遅刻", rows.filter(issue).length, "warn"], ["low", "点が低い", rows.filter(low).length, "bad"]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す"
        sorts={[...(ro ? [["pin", "担当を上に"]] : []), ["kana", "名前順"], ["att", "出席率の低い順"], ["tlo", "テスト平均の低い順"], ["thi", "テスト平均の高い順"]]} sort={sort} onSort={setSort} />
      {stats.state === "error" && <div className="lms-err" role="alert">集計を確認できません <Btn kind="ghost sm" onClick={stats.reload}>再読み込み</Btn></div>}
      <Card className=""><div className="scroll"><table className="tbl"><thead><tr>{ro && <th>担当</th>}<th>受講生</th><th>出席率</th><th>日報</th><th>テスト平均</th><th>評価表</th><th /></tr></thead><tbody>
        {list.map(r => (
          <tr key={r.id} className={ro && pins.has(r.id) ? "pinr" : ""}>
            {ro && <td><button type="button" className={`pinc${pins.has(r.id) ? " on" : ""}`} aria-pressed={pins.has(r.id)} aria-label={`${r.name} を担当にする`} onClick={() => pin(r.id)}>{pins.has(r.id) ? "✓" : ""}</button></td>}
            <td><span className="row st-nw"><span className="face">{r.name.slice(0, 1)}</span><b>{r.name}</b>{issue(r) && <Chip tone={r.kind === "欠勤" ? "bad" : "warn"}>{r.kind}</Chip>}</span></td>
            <td>{r.stat?.attendanceRate == null ? <span className="num">{stats.state === "loading" ? "…" : "—"}</span> : <span className="row st-nw st-bar"><span className="bar10"><i style={{ "--w": `${r.stat.attendanceRate}%` }} /></span><span className="num">{r.stat.attendanceRate}%</span></span>}</td>
            <td className="num">{r.stat ? `${r.stat.reportDays}/${days}` : "—"}</td>
            <td className="num">{r.stat?.testAverage == null ? "—" : <><b className={low(r) ? "pt-ng" : ""}>{r.stat.testAverage}</b> 点</>}</td>
            <td>{evals[r.id] ? <span className="num"><b>{evals[r.id].got}</b> / {evals[r.id].max}</span> : <Chip>まだ</Chip>}</td>
            <td><Btn kind="sm" onClick={() => setOpen(r.id)}>カルテ</Btn></td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={ro ? 7 : 6}><Chip>該当なし</Chip></td></tr>}
      </tbody></table></div></Card>
    </div>
  );
}
