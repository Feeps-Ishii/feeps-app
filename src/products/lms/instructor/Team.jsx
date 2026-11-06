import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { AssignBoard, CreateModal, MembersModal } from "../../training/TeamsView.jsx";
import { takeTeamChatFocus } from "../../training/ChatNotifier.jsx";
import { Btn, Card, Chip, ListTool, Modal } from "../parts/ui.jsx";
import { arr, errText, md, useStaffCourse } from "../staff/common.js";
import { TeamRoomSage } from "../trainee/Team.jsx";

/* 講師・コース担当者のチーム（モック teamS）：グループの札（メンバー・最後の様子）→ 開くと受講生と同じ部屋。
   メンバーの管理・席替えの割り当て・作るは今の窓を使う（決まりが多いため） */

const CATS = ["tm", "cur", "att", "tst", "rep", "dev"];
const isEnded = t => t?.status === "ended";

function AiSplit({ courseId, roster, nameOf, onClose, onDone }) {
  const [count, setCount] = useState(3); const [text, setText] = useState("");
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const propose = async () => {
    setBusy("ai"); setErr("");
    try {
      const st = await apiGet(`/completion-report/stats?courseId=${encodeURIComponent(courseId)}`).catch(() => null);
      const people = roster.map(p => { const t = arr(st?.trainees).find(x => x.id === p.userId); return { id: p.userId, testAverage: t?.testAverage ?? null, attendanceRate: t?.attendanceRate ?? null }; });
      const r = await apiPost("/ai/team-split", { courseId, count, text, people });
      setPlan(arr(r?.teams));
    } catch (e) { setErr(errText(e, "案を作れませんでした")); } finally { setBusy(""); }
  };
  const make = async () => {
    setBusy("make"); setErr("");
    try {
      for (const t of plan) {
        // eslint-disable-next-line no-await-in-loop
        const made = await apiPost("/teams", { courseId, name: t.name, theme: "" });
        // eslint-disable-next-line no-await-in-loop
        await apiPut(`/teams/${encodeURIComponent(made.teamId || made.team?.teamId)}`, { courseId, members: t.members });
      }
      onDone(plan.length);
    } catch (e) { setErr(errText(e, "作れませんでした")); setBusy(""); }
  };
  return (
    <Modal title="AI で分ける" width={560} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn>{plan ? <Btn disabled={!!busy} onClick={make}>{busy === "make" ? "作っています" : `${plan.length} チームを作る`}</Btn> : <Btn disabled={!!busy || !roster.length} onClick={propose}>{busy === "ai" ? "考えています" : "案を出す"}</Btn>}</>}>
      {!plan ? <>
        <label className="field">チームの数<input type="number" min="2" max="20" value={count} onChange={e => setCount(Number(e.target.value) || 2)} /></label>
        <label className="field">頼みたいこと<input type="text" maxLength={500} value={text} placeholder="例：テストの点が同じくらいになるように" onChange={e => setText(e.target.value)} /></label>
        <Chip>テストの平均と出席率を使う ・ 作るのは確かめたあと</Chip>
      </> : <div className="fs-pick">{plan.map(t => <div key={t.name} className="fs-pr tx-as"><b>{t.name} ・ {t.members.length} 人</b><small>{t.members.map(nameOf).join("、")}</small>{t.why && <small>{t.why}</small>}</div>)}</div>}
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

export default function InstructorTeam({ role, go, say }) {
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const [data, setData] = useState(undefined);
  const [roster, setRoster] = useState(null);
  const [open, setOpen] = useState("");
  const [members, setMembers] = useState(""); const [creating, setCreating] = useState(false); const [assign, setAssign] = useState(false);
  const [tab, setTab] = useState("now"); const [q, setQ] = useState(""); const [msg, setMsg] = useState("");
  const [aiOn, setAiOn] = useState(false);
  const load = useCallback(async () => {
    try { const d = await apiGet("/teams"); setData({ me: d?.me || "", courses: arr(d?.courses), teams: arr(d?.teams), people: d?.people || {} }); return d; }
    catch { setData(null); return null; }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!courseId) return;
    apiGet(`/courses/${encodeURIComponent(courseId)}/trainees`).then(l => setRoster(arr(l).map(p => ({ userId: p.userId, name: p.name || "" })))).catch(() => setRoster(null));
  }, [courseId]);
  useEffect(() => {
    if (!data) return undefined;
    const apply = () => { const id = takeTeamChatFocus(); if (id && data.teams.some(t => t.teamId === id)) setOpen(id); };
    apply();
    window.addEventListener("feeps:team-chat-focus", apply);
    return () => window.removeEventListener("feeps:team-chat-focus", apply);
  }, [data]);
  const people = useMemo(() => { const m = {}; Object.entries(data?.people || {}).forEach(([id, p]) => { m[id] = p?.name || ""; }); arr(roster).forEach(p => { if (p.name) m[p.userId] = p.name; }); return m; }, [data, roster]);
  const nameOf = useCallback(id => people[id] || "名前未設定", [people]);
  if (sc.state === "loading" || data === undefined) return <div className="soon card">読み込み中</div>;
  if (sc.state === "error" || data === null) return <Card><div className="empty"><b>チームを確認できません</b><Btn kind="ghost sm" onClick={() => { sc.reload(); load(); }}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>チーム</b><Chip>コースなし</Chip></div></Card>;
  const act = async (fn, ok) => { setMsg(""); try { await fn(); await load(); if (ok) say?.(ok); } catch (e) { setMsg(errText(e, "保存できませんでした")); } };
  const putTeam = (t, patch) => apiPut(`/teams/${encodeURIComponent(t.teamId)}`, { courseId: t.courseId, ...patch });
  const setEnded = (t, end) => act(() => apiPost(`/teams/${encodeURIComponent(t.teamId)}/${end ? "end" : "reopen"}`, { courseId: t.courseId }), end ? `${t.name}を終了しました` : `${t.name}を再開しました`);
  const teams = data.teams.filter(t => t.courseId === courseId);
  const cur = teams.find(t => t.teamId === open);
  const course = data.courses.find(c => c.courseId === courseId) || { courseId, name: sc.course.name };
  const mem = teams.find(t => t.teamId === members);
  const modals = (
    <>
      {creating && <div className="lms-legacy"><CreateModal courseId={courseId} onClose={() => setCreating(false)} onCreated={async t => { setCreating(false); await load(); setMembers(t.teamId); }} /></div>}
      {mem && <div className="lms-legacy"><MembersModal team={mem} course={course} teams={teams} trainees={roster} nameOf={nameOf} me={data.me} isAdmin={role === "admin"} onPut={putTeam} act={act} onSetEnded={setEnded} onClose={() => setMembers("")} onDeleted={() => { setMembers(""); setOpen(""); }} /></div>}
    </>
  );
  if (assign) return <div className="st"><div><Btn kind="ghost sm" onClick={() => setAssign(false)}>← チームの一覧</Btn></div><div className="lms-legacy"><AssignBoard course={course} teams={teams.filter(t => !isEnded(t))} trainees={roster} nameOf={nameOf} onPut={putTeam} act={act} onBack={() => setAssign(false)} onCreate={() => setCreating(true)} /></div>{modals}</div>;
  if (cur) {
    return (
      <div className="st">
        <div className="row"><Btn kind="ghost sm" onClick={() => setOpen("")}>← グループの一覧へ</Btn>{isEnded(cur) ? <Chip>終了 {md(cur.endedAt)}</Chip> : cur.joined ? <Chip tone="mk">講師として参加</Chip> : <Chip>{cur.canWrite ? "メンバーではない（書き込める）" : "見るだけ"}</Chip>}
          {cur.joined ? <Btn kind="ghost sm" onClick={() => act(() => apiPost(`/teams/${encodeURIComponent(cur.teamId)}/leave`, { courseId: cur.courseId }))}>抜ける</Btn> : !isEnded(cur) && <Btn kind="sm" onClick={() => act(() => apiPost(`/teams/${encodeURIComponent(cur.teamId)}/join`, { courseId: cur.courseId }), `${cur.name}に入りました`)}>このチームに入る</Btn>}
          {cur.canManage && <Btn kind="ghost sm" onClick={() => setMembers(cur.teamId)}>メンバー管理</Btn>}
          {cur.canManage && <Btn kind="ghost sm" onClick={() => setEnded(cur, !isEnded(cur))}>{isEnded(cur) ? "再開" : "チームを終了"}</Btn>}
        </div>
        {msg && <div className="lms-err" role="alert">{msg}</div>}
        <TeamRoomSage key={cur.teamId} team={cur} me={data.me} nameOf={nameOf} go={go} say={say} />
        {modals}
      </div>
    );
  }
  const now = teams.filter(t => !isEnded(t)), past = teams.filter(isEnded).sort((a, b) => String(b.endedAt || "").localeCompare(String(a.endedAt || "")));
  const assigned = new Set(now.flatMap(t => arr(t.members)));
  const unassigned = roster ? roster.filter(p => !assigned.has(p.userId)).length : null;
  const hit = t => !q.trim() || `${t.name}${t.theme || ""}${arr(t.members).map(nameOf).join("")}`.includes(q.trim());
  const list = (tab === "now" ? now : past).filter(hit);
  const canManage = course.canManage !== false;
  return (
    <div className="st">
      <div className="head">
        <div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">チーム</h1></div>
        <span className="r">{unassigned == null ? <Chip>受講生を確認できません</Chip> : unassigned ? <Chip tone="warn">未所属 {unassigned} 人</Chip> : <Chip tone="ok">全員所属</Chip>}<Btn kind="ghost sm" onClick={() => go("seat")}>席替えから作り直す</Btn></span>
      </div>
      <ListTool tabs={[["now", "今のチーム", now.length], ["past", "終わったチーム", past.length]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="チーム・テーマ・名前で探す" />
      {msg && <div className="lms-err" role="alert">{msg}</div>}
      {aiOn && <AiSplit courseId={courseId} roster={roster} nameOf={id => roster.find(p => p.userId === id)?.name || "名前未設定"} onClose={() => setAiOn(false)} onDone={n => { setAiOn(false); say?.(`${n} チームを作りました`); load(); }} />}
      <div className="tmS-g">
        {list.map((t, i) => (
          <section key={t.teamId} className={`card pad tmS-c c-${isEnded(t) ? "gy" : CATS[(Number(t.color) || i) % CATS.length]}`}>
            <div className="tmS-h"><span className="tm-gi big" aria-hidden="true">{String(t.name).slice(0, 1)}</span><div><b>{t.name}</b><small className="num">{arr(t.members).length} 人{t.theme ? ` ・ ${t.theme}` : ""}</small></div>{isEnded(t) && <Chip>〜{md(t.endedAt)}</Chip>}</div>
            <div className="tmS-m">{arr(t.members).map(id => <span key={id} className={t.leader === id ? "ld" : ""}><i aria-hidden="true">{nameOf(id).slice(0, 1)}</i>{nameOf(id)}</span>)}</div>
            <span className="tmS-a"><Btn kind="sm" onClick={() => setOpen(t.teamId)}>チャンネルを開く</Btn>{t.canManage && <Btn kind="ghost sm" onClick={() => setMembers(t.teamId)}>メンバー</Btn>}</span>
          </section>
        ))}
        {!list.length && <Card><div className="empty"><Chip>なし</Chip></div></Card>}
      </div>
      {modals}
    </div>
  );
}
