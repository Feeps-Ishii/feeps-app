import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { apiDelete, apiGet, apiPost, apiPut } from "../../api.js";
import { T, NOVA, Card, Btn, Badge, Modal, EmptyState, SectionHead, SkeletonRows, PrismErrorRetryCard } from "../../components/common";
import { setLibraryTarget } from "../../utils/common/courseContext.js";
import { normalizeCurriculumSections } from "./TrainingComponents.jsx";
import { markTeamChatRead, setOpenChatTeam, takeTeamChatFocus } from "./ChatNotifier.jsx";
import {
  Archive, Briefcase, Check, ChevronDown, ChevronLeft, ChevronRight, Code, Copy, Crown, Download, Eye, FileText, Folder, History, ListTodo, Lock, LogIn, LogOut, MessageSquare, Paperclip, PenTool, Plus, RotateCcw, Search, Send, Shuffle, Trash2, Upload, Users, X, Columns3,
} from "lucide-react";

// 共有ボード（Excalidraw）は重いので、ボードを開いた人だけが読み込む
const TeamBoard = React.lazy(() => import("./TeamBoard.jsx"));
// チームのフォルダはファイル管理の画面をこのフォルダだけに絞って使う（2026-10-01）
const LibraryView = React.lazy(() => import("./LibraryView.jsx"));

/* チーム（2026-10-01 ユーザー決定。CHANGELOG 185）。サイドバーの研修に「チーム」。
   - 受講生：自分のチームのページ（やること・フォルダ・メンバー）。チームは作れない
   - 講師（担当コースだけ）・管理者（すべて）：チームの一覧、入る・抜ける、メンバー管理、割り当て表、チームの設定
   - 既定は1人1チーム。コースごとに「1人で複数チームに入れる」にできる
   - チームのフォルダはファイル管理の「チーム」フォルダの下にあり、どちらからも開ける
   チャット（②）は数秒ごとに新着を読む。自分の発言は右に出す。共有ボード（③）は TeamBoard.jsx。 */
const TEAM_COLORS = ["#E07A5F", "#3D8A63", "#7454C7", "#B07C2E", "#2E86AB", "#D1495B", "#00798C", "#5C946E"];
const teamColor = t => TEAM_COLORS[(Number(t?.color) || 0) % TEAM_COLORS.length];
const errText = (e, fallback) => e?.errorMessage || e?.message || fallback;
const fmtSize = b => (!b ? "—" : b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`);
const fmtDay = iso => { const s = String(iso || ""); return s ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : ""; };
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// 終了したチーム（2026-10-14）。席替えで変わる前のチームは履歴として読むだけ
const isEnded = t => t?.status === "ended";
const byEndedDesc = (a, b) => String(b.endedAt || "").localeCompare(String(a.endedAt || ""));
function EndedBadge({ team }) {
  return <Badge tone="muted"><Lock size={12} />終了{team?.endedAt ? ` ${fmtDay(team.endedAt)}` : ""}</Badge>;
}

function Emblem({ team, size = 40 }) {
  return <span className="inline-flex shrink-0 items-center justify-center font-bold text-white" style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), background: teamColor(team), fontSize: Math.round(size * 0.42) }}>{String(team?.name || "?").slice(0, 1)}</span>;
}
function Face({ name, size = 28, ring = true }) {
  const n = String(name || "？");
  let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return <span title={n} className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: `hsl(${h} 45% 48%)`, boxShadow: ring ? "0 0 0 2px #fff" : "none" }}>{n.slice(0, 1)}</span>;
}

export default function TeamsView({ role, go }) {
  const isStaff = role === "admin" || role === "instructor";
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [trainees, setTrainees] = useState({});       // courseId → [{userId,name}]（講師・管理者）
  const [scr, setScr] = useState("list");            // list | assign | room（講師・管理者）
  const [openId, setOpenId] = useState("");
  const [assignCourse, setAssignCourse] = useState("");
  const [membersOf, setMembersOf] = useState("");
  const [creating, setCreating] = useState("");
  const [msg, setMsg] = useState("");
  const [chatFocus, setChatFocus] = useState(0);
  const [showPast, setShowPast] = useState(false);

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const d = await apiGet("/teams");
      setData({ me: d?.me || "", courses: Array.isArray(d?.courses) ? d.courses : [], teams: Array.isArray(d?.teams) ? d.teams : [], people: d?.people || {} });
      return d;
    } catch (e) { setLoadErr(errText(e, "チームを読み込めませんでした。")); return null; }
  }, []);
  useEffect(() => { load(); }, [load]);
  // チャットの新着通知から開いたとき：そのチームのチャットを開く
  useEffect(() => {
    if (!data) return undefined;
    const apply = () => {
      const id = takeTeamChatFocus();
      if (!id || !data.teams.some(t => t.teamId === id)) return;
      setOpenId(id); if (isStaff) setScr("room"); setChatFocus(n => n + 1);
    };
    apply();
    window.addEventListener("feeps:team-chat-focus", apply);
    return () => window.removeEventListener("feeps:team-chat-focus", apply);
  }, [data, isStaff]);
  // 講師・管理者：コースの受講生（未所属の数・メンバーを足す候補・割り当て表）
  useEffect(() => {
    if (!isStaff || !data?.courses?.length) return;
    let alive = true;
    Promise.all(data.courses.map(c => apiGet(`/courses/${encodeURIComponent(c.courseId)}/trainees`).then(list => [c.courseId, (Array.isArray(list) ? list : []).map(p => ({ userId: p.userId, name: p.name || "" }))]).catch(() => [c.courseId, null])))
      .then(pairs => { if (alive) setTrainees(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [isStaff, data?.courses?.map(c => c.courseId).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const people = useMemo(() => {
    const m = {};
    Object.entries(data?.people || {}).forEach(([id, p]) => { m[id] = p?.name || ""; });
    Object.values(trainees).forEach(list => (list || []).forEach(p => { if (p.userId && p.name) m[p.userId] = p.name; }));
    return m;
  }, [data?.people, trainees]);
  const nameOf = useCallback(id => people[id] || "名前未設定", [people]);
  const teams = data?.teams || [];
  const team = id => teams.find(t => t.teamId === id) || null;

  async function act(fn, ok) {
    setMsg("");
    try { await fn(); await load(); if (ok) setMsg(ok); }
    catch (e) { setMsg(errText(e, "保存できませんでした。")); }
  }
  const putTeam = (t, patch) => apiPut(`/teams/${encodeURIComponent(t.teamId)}`, { courseId: t.courseId, ...patch });
  // 終了・再開（講師・管理者）。終了しても members は残り、元メンバーは読むだけできる
  const setEnded = (t, end) => {
    if (end && !window.confirm(`「${t.name}」を終了しますか？`)) return Promise.resolve();
    return act(() => apiPost(`/teams/${encodeURIComponent(t.teamId)}/${end ? "end" : "reopen"}`, { courseId: t.courseId }), end ? `${t.name}を終了しました。` : `${t.name}を再開しました。`);
  };

  if (loadErr && !data) return <div><SectionHead title="チーム" /><PrismErrorRetryCard message={loadErr} onRetry={load} /></div>;
  if (!data) return <div><SectionHead title="チーム" /><Card className="p-5"><SkeletonRows rows={5} /></Card></div>;

  const notice = msg && <div className="mb-3 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: T.accentSubtle, color: T.accentHover }}>{msg}</div>;

  /* ---------- 受講生：今のチームが中心。過去のチームは控えめな履歴から開く ---------- */
  if (!isStaff) {
    const mineAll = teams.filter(t => t.members.includes(data.me));
    const mine = mineAll.filter(t => !isEnded(t));
    const past = mineAll.filter(isEnded).sort(byEndedDesc);
    const current = mineAll.find(t => t.teamId === openId) || mine[0] || null;
    const chip = (t, active) => (
      <button key={t.teamId} type="button" onClick={() => setOpenId(t.teamId)} className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-bold"
        style={{ background: active ? T.accentSubtle : "#fff", border: `1px solid ${active ? T.accent : T.border}`, color: isEnded(t) ? T.textSecondary : T.textPrimary }}>
        <span style={{ opacity: isEnded(t) ? 0.55 : 1 }}><Emblem team={t} size={24} /></span><span className="truncate">{t.name}</span>
        {isEnded(t) && <span className="shrink-0 text-[11px] font-semibold" style={{ color: T.textMuted }}>〜{fmtDay(t.endedAt)}</span>}
      </button>
    );
    const viewingPast = current && isEnded(current);
    return (
      <div>
        <SectionHead title="チーム" />
        {notice}
        {(mine.length > 1 || past.length > 0 || viewingPast) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {viewingPast && mine.length > 0 && <Btn size="sm" kind="ghost" icon={ChevronLeft} onClick={() => { setOpenId(mine[0].teamId); setShowPast(false); }}>今のチーム</Btn>}
            {!viewingPast && mine.length > 1 && mine.map(t => chip(t, current?.teamId === t.teamId))}
            {past.length > 0 && (
              <button type="button" onClick={() => setShowPast(v => !v)} aria-expanded={showPast} className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: T.textMuted, border: `1px solid ${showPast ? T.border : "transparent"}` }}>
                <History size={13} />過去のチーム<span className="tabular-nums">{past.length}</span><ChevronDown size={13} style={{ transform: showPast ? "rotate(180deg)" : "none" }} />
              </button>
            )}
          </div>
        )}
        {showPast && past.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2 rounded-2xl p-2" style={{ border: `1px dashed ${T.border}`, background: T.bgBase }}>
            {past.map(t => chip(t, current?.teamId === t.teamId))}
          </div>
        )}
        {current
          ? <TeamRoom key={current.teamId} team={current} me={data.me} nameOf={nameOf} isStaff={false} role={role} go={go} chatFocus={chatFocus} />
          : <Card><EmptyState title="まだチームに入っていません" desc="" /></Card>}
      </div>
    );
  }

  /* ---------- 講師・管理者 ---------- */
  if (scr === "room" && team(openId)) {
    const t = team(openId);
    return (
      <div>
        <SectionHead title="チーム" />
        {notice}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white px-4 py-2.5" style={{ border: `1px dashed ${T.border}` }}>
          <Btn size="sm" kind="ghost" icon={ChevronLeft} onClick={() => setScr("list")}>チーム一覧</Btn>
          {isEnded(t) ? <EndedBadge team={t} /> : t.joined ? <Badge tone="green"><Check size={12} />メンバーとして参加中</Badge> : <Badge tone="muted"><Eye size={12} />メンバーではありません{t.canWrite ? "（書き込める）" : "（見るだけ）"}</Badge>}
          {t.joined
            ? <Btn size="sm" kind="ghost" icon={LogOut} onClick={() => act(() => apiPost(`/teams/${encodeURIComponent(t.teamId)}/leave`, { courseId: t.courseId }))}>抜ける</Btn>
            : !isEnded(t) && <Btn size="sm" icon={LogIn} onClick={() => act(() => apiPost(`/teams/${encodeURIComponent(t.teamId)}/join`, { courseId: t.courseId }), `${t.name}に入りました。`)}>このチームに入る</Btn>}
          {t.canManage && <Btn size="sm" kind="ghost" icon={Users} onClick={() => setMembersOf(t.teamId)}>メンバー管理</Btn>}
          {t.canManage && (isEnded(t)
            ? <Btn size="sm" kind="ghost" icon={RotateCcw} onClick={() => setEnded(t, false)}>再開</Btn>
            : <Btn size="sm" kind="ghost" icon={Archive} onClick={() => setEnded(t, true)}>チームを終了</Btn>)}
        </div>
        <TeamRoom key={t.teamId} team={t} me={data.me} nameOf={nameOf} isStaff role={role} go={go} chatFocus={chatFocus} />
        {membersOf && team(membersOf) && <MembersModal team={team(membersOf)} course={data.courses.find(c => c.courseId === team(membersOf).courseId)} teams={teams} trainees={trainees[team(membersOf).courseId]} nameOf={nameOf} me={data.me} isAdmin={role === "admin"} onPut={putTeam} act={act} onSetEnded={setEnded} onClose={() => setMembersOf("")} onDeleted={() => { setMembersOf(""); setScr("list"); }} />}
      </div>
    );
  }

  if (scr === "assign" && data.courses.some(c => c.courseId === assignCourse)) {
    const course = data.courses.find(c => c.courseId === assignCourse);
    return (
      <div>
        <SectionHead title="チーム" />
        {notice}
        <AssignBoard course={course} teams={teams.filter(t => t.courseId === course.courseId && !isEnded(t))} trainees={trainees[course.courseId]} nameOf={nameOf} onPut={putTeam} act={act} onBack={() => setScr("list")} onCreate={() => setCreating(course.courseId)} />
        {creating && <CreateModal courseId={creating} onClose={() => setCreating("")} onCreated={async t => { setCreating(""); await load(); setMembersOf(t.teamId); }} />}
        {membersOf && team(membersOf) && <MembersModal team={team(membersOf)} course={course} teams={teams} trainees={trainees[course.courseId]} nameOf={nameOf} me={data.me} isAdmin={role === "admin"} onPut={putTeam} act={act} onSetEnded={setEnded} onClose={() => setMembersOf("")} onDeleted={() => setMembersOf("")} />}
      </div>
    );
  }

  return (
    <div>
      <SectionHead title="チーム" />
      {notice}
      <TeamList role={role} data={data} trainees={trainees} nameOf={nameOf}
        onOpen={id => { setOpenId(id); setScr("room"); }}
        onJoin={t => act(() => apiPost(`/teams/${encodeURIComponent(t.teamId)}/join`, { courseId: t.courseId }), `${t.name}に入りました。`)}
        onMembers={id => setMembersOf(id)}
        onAssign={courseId => { setAssignCourse(courseId); setScr("assign"); }}
        onCreate={courseId => setCreating(courseId)}
        onMulti={(courseId, allowMulti) => act(() => apiPut("/teams/course-settings", { courseId, allowMulti }))} />
      {creating && <CreateModal courseId={creating} onClose={() => setCreating("")} onCreated={async t => { setCreating(""); await load(); setMembersOf(t.teamId); }} />}
      {membersOf && team(membersOf) && <MembersModal team={team(membersOf)} course={data.courses.find(c => c.courseId === team(membersOf).courseId)} teams={teams} trainees={trainees[team(membersOf).courseId]} nameOf={nameOf} me={data.me} isAdmin={role === "admin"} onPut={putTeam} act={act} onSetEnded={setEnded} onClose={() => setMembersOf("")} onDeleted={() => setMembersOf("")} />}
    </div>
  );
}

/* ---------- 一覧（講師・管理者） ---------- */
function TeamList({ role, data, trainees, nameOf, onOpen, onJoin, onMembers, onAssign, onCreate, onMulti }) {
  const [course, setCourse] = useState("all");
  const [q, setQ] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [endedOpen, setEndedOpen] = useState({});   // courseId → 終了したチームを開いているか
  const query = q.trim();
  const GRID = "grid grid-cols-[minmax(200px,1.4fr)_minmax(170px,1fr)_minmax(110px,.8fr)_auto] gap-3";
  const teamRow = t => (
    <div key={t.teamId} className={`${GRID} items-center px-4 py-2.5`} style={{ borderBottom: `1px solid ${T.border}`, background: isEnded(t) ? T.bgBase : undefined }}>
      <button type="button" onClick={() => onOpen(t.teamId)} className="flex min-w-0 items-center gap-2.5 text-left">
        <span style={{ opacity: isEnded(t) ? 0.55 : 1 }}><Emblem team={t} size={36} /></span>
        <span className="min-w-0"><span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: isEnded(t) ? T.textSecondary : T.textPrimary }}>{t.name}{isEnded(t) ? <EndedBadge team={t} /> : t.joined && <Badge tone="green">参加中</Badge>}</span><span className="block truncate text-xs" style={{ color: T.textMuted }}>{t.theme || "テーマ未設定"}</span></span>
      </button>
      <div className="flex items-center gap-2 text-xs" style={{ color: T.textSecondary }}>
        <span className="flex">{t.members.slice(0, 5).map((id, i) => <span key={id} style={{ marginLeft: i ? -6 : 0 }}><Face name={nameOf(id)} size={26} /></span>)}</span>
        <span className="tabular-nums">{t.members.length}人</span>
      </div>
      <div className="text-xs" style={{ color: t.staff.length || isEnded(t) ? T.textSecondary : T.warning }}>{t.staff.length ? t.staff.map(id => id === data.me ? "あなた" : nameOf(id)).join("・") : isEnded(t) ? "—" : "未設定"}</div>
      <div className="flex justify-end gap-2">
        <Btn size="sm" kind="ghost" onClick={() => onOpen(t.teamId)}>開く</Btn>
        {!t.joined && !isEnded(t) && <Btn size="sm" kind="ghost" icon={LogIn} onClick={() => onJoin(t)}>入る</Btn>}
        {t.canManage && <Btn size="sm" kind="ghost" icon={Users} aria-label="メンバー管理" title="メンバー管理" onClick={() => onMembers(t.teamId)} />}
      </div>
    </div>
  );
  const courses = data.courses.filter(c => course === "all" || c.courseId === course);
  if (!data.courses.length) return <Card><EmptyState title={role === "admin" ? "コースがありません" : "担当しているコースがありません"} desc="" /></Card>;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-0.5 rounded-xl bg-white p-1" style={{ border: `1px solid ${T.border}` }}>
          {[["all", role === "admin" ? "すべてのコース" : "担当コースすべて"], ...data.courses.map(c => [c.courseId, c.name])].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setCourse(id)} className="rounded-lg px-3 py-1.5 text-xs font-bold" style={course === id ? { background: T.textPrimary, color: "#fff" } : { color: T.textSecondary }}>{label}</button>
          ))}
        </div>
        <label className="inline-flex min-w-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5" style={{ border: `1px solid ${T.border}`, color: T.textMuted }}>
          <Search size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="チーム名・テーマ・人の名前" aria-label="チームを探す" className="w-52 min-w-0 bg-transparent text-sm outline-none" style={{ color: T.textPrimary }} />
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: T.textSecondary }}><input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} />自分が入っているチームだけ</label>
      </div>
      {courses.map(c => {
        const inCourse = data.teams.filter(t => t.courseId === c.courseId);
        const activeAll = inCourse.filter(t => !isEnded(t));
        const shownOf = arr => arr
          .filter(t => !mineOnly || t.joined)
          .filter(t => !query || `${t.name}${t.theme}${t.members.map(nameOf).join("")}`.includes(query));
        const list = shownOf(activeAll);
        const endedList = shownOf(inCourse.filter(isEnded)).sort(byEndedDesc);
        const roster = trainees[c.courseId];
        // 未所属は今のチームで数える（終了したチームは履歴）
        const assigned = new Set(activeAll.flatMap(t => t.members));
        const unassigned = Array.isArray(roster) ? roster.filter(p => !assigned.has(p.userId)).length : null;
        if (query && !list.length && !endedList.length) return null;
        const showEnded = !!endedOpen[c.courseId] || (!!query && endedList.length > 0);
        return (
          <Card key={c.courseId} className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
              <b className="text-[15px]" style={{ color: T.textPrimary }}>{c.name}</b>
              <Badge tone="muted">{activeAll.length}チーム</Badge>
              {unassigned == null ? <Badge tone="muted">受講生を確認できません</Badge> : unassigned ? <Badge tone="amber">未所属 {unassigned}人</Badge> : <Badge tone="green">全員所属</Badge>}
              {c.canManage && <label className="ml-1 inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: T.textSecondary }}><input type="checkbox" checked={!!c.allowMulti} onChange={e => onMulti(c.courseId, e.target.checked)} />1人で複数チームに入れる</label>}
              {c.canManage && <span className="ml-auto flex flex-wrap gap-2">
                <Btn size="sm" kind="ghost" icon={Columns3} onClick={() => onAssign(c.courseId)}>割り当て表</Btn>
                <Btn size="sm" icon={Plus} onClick={() => onCreate(c.courseId)}>チームを作る</Btn>
              </span>}
            </div>
            {list.length === 0 && !(showEnded && endedList.length) ? <div className="px-4 py-6 text-sm" style={{ color: T.textMuted }}>チームはまだありません</div> : (
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className={`${GRID} px-4 py-2 text-[11px] font-bold`} style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}><span>チーム</span><span>メンバー</span><span>講師</span><span /></div>
                  {list.map(teamRow)}
                  {showEnded && endedList.map(teamRow)}
                </div>
              </div>
            )}
            {endedList.length > 0 && !query && (
              <button type="button" onClick={() => setEndedOpen(s => ({ ...s, [c.courseId]: !s[c.courseId] }))} aria-expanded={showEnded}
                className="flex w-full items-center gap-1.5 px-4 py-2 text-xs font-bold" style={{ color: T.textMuted }}>
                <Archive size={13} />終了したチーム<span className="tabular-nums">{endedList.length}</span><ChevronDown size={13} style={{ transform: showEnded ? "rotate(180deg)" : "none" }} />
              </button>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- チームを作る ---------- */
function CreateModal({ courseId, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true); setErr("");
    try { const t = await apiPost("/teams", { courseId, name: name.trim(), theme: theme.trim() }); await onCreated(t); }
    catch (e) { setErr(errText(e, "作れませんでした。")); }
    finally { setBusy(false); }
  }
  return (
    <Modal title="チームを作る" onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn icon={Plus} disabled={!name.trim() || busy} onClick={submit}>{busy ? "作っています…" : "作る"}</Btn></>}>
      <div className="grid gap-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="チーム名（例：Aチーム）" aria-label="チーム名" maxLength={40} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} />
        <input value={theme} onChange={e => setTheme(e.target.value)} placeholder="テーマ（例：ToDo管理アプリ）" aria-label="テーマ" maxLength={80} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} />
        {err && <p className="text-xs" style={{ color: T.danger }}>{err}</p>}
      </div>
    </Modal>
  );
}

/* ---------- メンバー管理・チームの設定 ---------- */
const SETTING_LABELS = [
  ["traineeChat", "受講生がチャットに書き込める"],
  ["traineeFiles", "受講生がフォルダにファイルを置ける"],
  ["board", "ボードを使う"],
  ["staffWrite", "担当の講師・管理者は、チームに入らなくても書き込める"],
];
function MembersModal({ team, course, teams, trainees, nameOf, me, isAdmin, onPut, act, onSetEnded, onClose, onDeleted }) {
  const [q, setQ] = useState("");
  const [name, setName] = useState(team.name);
  const [theme, setTheme] = useState(team.theme);
  useEffect(() => { setName(team.name); setTheme(team.theme); }, [team.teamId]); // eslint-disable-line react-hooks/exhaustive-deps
  const allowMulti = !!course?.allowMulti;
  const ended = isEnded(team);   // 終了したチームのメンバーは終了時点のまま（サーバーでも変えられない）
  const otherTeamOf = id => teams.find(t => t.courseId === team.courseId && t.teamId !== team.teamId && !isEnded(t) && t.members.includes(id));
  const cands = (trainees || []).filter(p => !team.members.includes(p.userId) && (!q.trim() || String(p.name).includes(q.trim())))
    .sort((a, b) => (otherTeamOf(a.userId) ? 1 : 0) - (otherTeamOf(b.userId) ? 1 : 0));
  const staffCands = [...new Set([...(course?.instructorIds || []), ...(isAdmin ? [me] : [])])].filter(id => !team.staff.includes(id));
  const row = (id, right) => <div key={id} className="flex items-center gap-2.5 py-1.5" style={{ borderTop: `1px solid ${T.border}` }}><Face name={nameOf(id)} size={30} ring={false} /><span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: T.textPrimary }}>{nameOf(id)}{id === me ? "（自分）" : ""}</span>{right}</div>;
  const iconBtn = (label, onClick, Icon = X) => <button type="button" aria-label={label} title={label} onClick={onClick} className="inline-flex h-7 w-7 items-center justify-center rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.textMuted }}><Icon size={14} /></button>;
  return (
    <Modal size="lg" title={`${team.name} のメンバー管理`} onClose={onClose}
      footer={<><button type="button" className="mr-auto text-xs font-bold" style={{ color: T.danger }} onClick={() => { if (window.confirm(`「${team.name}」を消しますか？フォルダの中身は残ります。`)) act(() => apiDelete(`/teams/${encodeURIComponent(team.teamId)}?courseId=${encodeURIComponent(team.courseId)}`), "チームを消しました。").then(onDeleted); }}><Trash2 size={13} className="mr-1 inline" />チームを消す</button>{onSetEnded && <Btn kind="ghost" icon={ended ? RotateCcw : Archive} onClick={() => onSetEnded(team, !ended)}>{ended ? "再開" : "チームを終了"}</Btn>}<Btn onClick={onClose}>閉じる</Btn></>}>
      <div className="grid gap-4">
        {ended && <div><EndedBadge team={team} /></div>}
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
          <input value={name} onChange={e => setName(e.target.value)} onBlur={() => name.trim() && name.trim() !== team.name && act(() => onPut(team, { name: name.trim() }))} aria-label="チーム名" maxLength={40} className="rounded-xl px-3 py-2 text-sm font-bold outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} />
          <input value={theme} onChange={e => setTheme(e.target.value)} onBlur={() => theme.trim() !== team.theme && act(() => onPut(team, { theme: theme.trim() }))} placeholder="テーマ" aria-label="テーマ" maxLength={80} className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} />
        </div>
        <div className={`grid gap-5 ${ended ? "" : "md:grid-cols-2"}`}>
          <div>
            <div className="mb-1 text-xs font-bold" style={{ color: T.textMuted }}>メンバー {team.members.length}</div>
            {team.members.length === 0 && <div className="py-2 text-sm" style={{ color: T.textMuted }}>まだいません</div>}
            {team.members.map(id => ended ? row(id, team.leader === id ? <Badge tone="amber"><Crown size={12} />リーダー</Badge> : null) : row(id, <>
              <button type="button" onClick={() => act(() => onPut(team, { leader: team.leader === id ? "" : id }))} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={team.leader === id ? { background: T.warningSubtle, color: T.warning } : { border: `1px solid ${T.border}`, color: T.textMuted }} title="リーダーにする"><Crown size={12} />{team.leader === id ? "リーダー" : ""}</button>
              {iconBtn("外す", () => act(() => onPut(team, { members: team.members.filter(m => m !== id) })))}
            </>))}
            <div className="mb-1 mt-4 text-xs font-bold" style={{ color: T.textMuted }}>講師・管理者</div>
            {team.staff.length === 0 && <div className="py-1 text-sm" style={{ color: T.textMuted }}>いません</div>}
            {team.staff.map(id => row(id, iconBtn("外す", () => act(() => onPut(team, { staff: team.staff.filter(s => s !== id) })))))}
            {staffCands.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{staffCands.map(id => <Btn key={id} size="sm" kind="ghost" icon={Plus} onClick={() => act(() => onPut(team, { staff: [...team.staff, id] }))}>{id === me ? "自分" : nameOf(id)}</Btn>)}</div>}
          </div>
          {!ended && <div>
            <div className="mb-1 text-xs font-bold" style={{ color: T.textMuted }}>コースの受講生から足す</div>
            <label className="mb-2 flex items-center gap-1.5 rounded-xl px-3 py-1.5" style={{ border: `1px solid ${T.border}`, color: T.textMuted }}><Search size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="名前で探す" aria-label="受講生を探す" className="min-w-0 flex-1 bg-transparent text-sm outline-none" style={{ color: T.textPrimary }} /></label>
            {trainees == null ? <div className="text-sm" style={{ color: T.textMuted }}>受講生を確認できません</div> : (
              <div className="max-h-72 overflow-y-auto">
                {cands.length === 0 && <div className="py-2 text-sm" style={{ color: T.textMuted }}>いません</div>}
                {cands.map(p => { const other = otherTeamOf(p.userId); const move = other && !allowMulti;
                  return row(p.userId, <>
                    <span className="text-[11px]" style={{ color: other ? T.textMuted : T.warning }}>{other ? `${other.name}に所属` : "未所属"}</span>
                    <Btn size="sm" kind={move ? "ghost" : "primary"} onClick={() => act(() => onPut(team, { members: [...team.members, p.userId] }))}>{move ? "移す" : "足す"}</Btn>
                  </>); })}
              </div>
            )}
          </div>}
        </div>
        <div className="grid gap-1.5 rounded-xl p-3" style={{ background: T.bgBase }}>
          <div className="text-xs font-bold" style={{ color: T.textMuted }}>チームの設定</div>
          {SETTING_LABELS.map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: T.textPrimary }}>
              <input type="checkbox" checked={!!team.settings?.[k]} onChange={e => act(() => onPut(team, { settings: { [k]: e.target.checked } }))} />{label}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/* ---------- 割り当て表（ドラッグで移す） ---------- */
function AssignBoard({ course, teams, trainees, nameOf, onPut, act, onBack, onCreate }) {
  const [drag, setDrag] = useState(null);   // { userId, from }
  const [over, setOver] = useState("");
  const assigned = new Set(teams.flatMap(t => t.members));
  const cols = [{ teamId: "", name: "未所属", members: (trainees || []).filter(p => !assigned.has(p.userId)).map(p => p.userId) }, ...teams];
  async function moveTo(userId, from, to) {
    if (from === to) return;
    await act(async () => {
      const src = teams.find(t => t.teamId === from);
      const dst = teams.find(t => t.teamId === to);
      if (dst) await onPut(dst, { members: [...dst.members, userId] });
      // 1人で複数のコースでも、表で動かしたときは「移す」。1人1チームならサーバー側でも外れる
      if (src && (course.allowMulti || !dst)) await onPut(src, { members: src.members.filter(m => m !== userId) });
    });
  }
  async function spread() {
    const loose = cols[0].members;
    if (!loose.length || !teams.length) return;
    await act(async () => {
      const sizes = teams.map(t => ({ t, members: [...t.members] }));
      loose.forEach(id => { sizes.sort((a, b) => a.members.length - b.members.length); sizes[0].members.push(id); });
      for (const s of sizes) if (s.members.length !== s.t.members.length) await onPut(s.t, { members: s.members });
    }, "未所属の人を振り分けました。");
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Btn size="sm" kind="ghost" icon={ChevronLeft} onClick={onBack}>チーム一覧</Btn>
        <b className="text-[15px]" style={{ color: T.textPrimary }}>{course.name} の割り当て表</b>
        <span className="ml-auto flex flex-wrap gap-2">
          {course.canManage && <Btn size="sm" kind="ghost" icon={Shuffle} disabled={!cols[0].members.length || !teams.length} onClick={spread}>未所属を均等に振り分け</Btn>}
          {course.canManage && <Btn size="sm" icon={Plus} onClick={onCreate}>チームを作る</Btn>}
        </span>
      </div>
      {trainees == null && <div className="text-sm" style={{ color: T.warning }}>受講生を確認できないため、未所属の列は出していません。</div>}
      <div className="grid auto-cols-[minmax(210px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
        {cols.map(col => (
          <section key={col.teamId || "none"}
            onDragOver={e => { if (drag && course.canManage) { e.preventDefault(); setOver(col.teamId || "none"); } }}
            onDragLeave={() => setOver("")}
            onDrop={e => { e.preventDefault(); setOver(""); if (drag) moveTo(drag.userId, drag.from, col.teamId); setDrag(null); }}
            className="flex min-h-[280px] flex-col gap-1.5 rounded-2xl p-2.5"
            style={{ background: col.teamId ? "#fff" : T.bgBase, border: `1px ${col.teamId ? "solid" : "dashed"} ${T.border}`, outline: over === (col.teamId || "none") ? `3px solid ${T.accent}` : "none", outlineOffset: -3 }}>
            <div className="flex items-center gap-2 px-0.5 pb-1.5">
              {col.teamId ? <Emblem team={col} size={26} /> : <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: "#9AA3B2" }}>－</span>}
              <b className="text-sm" style={{ color: T.textPrimary }}>{col.name}</b>
              <span className="ml-auto text-xs font-bold tabular-nums" style={{ color: T.textMuted }}>{col.members.length}</span>
            </div>
            {col.members.map(id => (
              <div key={id} draggable={course.canManage} onDragStart={e => { e.dataTransfer.effectAllowed = "move"; setDrag({ userId: id, from: col.teamId }); }} onDragEnd={() => setDrag(null)}
                className="flex items-center gap-2 rounded-xl bg-white px-2 py-1.5 text-sm" style={{ border: `1px solid ${T.border}`, cursor: course.canManage ? "grab" : "default", opacity: drag?.userId === id && drag?.from === col.teamId ? 0.4 : 1, color: T.textPrimary }}>
                <Face name={nameOf(id)} size={24} ring={false} /><span className="min-w-0 flex-1 truncate">{nameOf(id)}</span>
                {col.leader === id && <Crown size={13} style={{ color: T.warning }} />}
              </div>
            ))}
            {col.members.length === 0 && <div className="rounded-xl py-5 text-center text-xs" style={{ color: T.textMuted, border: `1px dashed ${T.border}` }}>ここへドラッグ</div>}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ---------- チームのページ ---------- */
function TeamRoom({ team, me, nameOf, isStaff, role, go, chatFocus }) {
  const [tab, setTab] = useState("chat");
  useEffect(() => { if (chatFocus) setTab("chat"); }, [chatFocus]);
  const [exercises, setExercises] = useState([]);
  // 今日のカリキュラムのチーム演習（あれば帯で出す）
  useEffect(() => {
    let alive = true;
    if (isEnded(team)) { setExercises([]); return undefined; }   // 終了したチームに今日の演習は出さない
    apiGet(`/courses/${encodeURIComponent(team.courseId)}/curriculum`).then(item => {
      const day = todayKey();
      const inDay = u => { const s = String(u?.startDate || "").slice(0, 10), e = String(u?.endDate || u?.startDate || "").slice(0, 10); return s && s <= day && day <= e; };
      const out = [];
      normalizeCurriculumSections(item).forEach(sec => {
        const units = sec.unitMode === "section" ? [sec] : (sec.chapters || []).flatMap(ch => ch.lessons || []);
        units.filter(inDay).forEach(u => (u.exercises || []).filter(x => x.type === "team").forEach(x => out.push({ unit: u.title || sec.title, title: x.title || "チーム演習", minutes: x.estimatedMinutes })));
      });
      if (alive) setExercises(out);
    }).catch(() => {});
    return () => { alive = false; };
  }, [team.courseId, team.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabs = [["chat", MessageSquare, "チャット"], ...(team.settings?.board ? [["board", PenTool, "ボード"]] : []), ["todo", ListTodo, "やること"], ["files", Folder, "フォルダ"], ["members", Users, "メンバー"]];
  return (
    <div className="grid gap-3">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <Emblem team={team} size={44} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-lg font-bold" style={{ color: T.textPrimary }}>{team.name}{isEnded(team) && <EndedBadge team={team} />}</div>
            <div className="text-xs" style={{ color: T.textMuted }}>{[team.theme, team.courseName].filter(Boolean).join(" ・ ")}</div>
          </div>
          <div className="ml-auto flex">{[...team.members, ...team.staff].slice(0, 8).map((id, i) => <span key={id} style={{ marginLeft: i ? -6 : 0 }}><Face name={nameOf(id)} size={30} /></span>)}</div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-3" style={{ borderTop: `1px solid ${T.border}`, scrollbarWidth: "none" }} role="tablist">
          {tabs.map(([k, Icon, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-sm font-bold"
              style={{ color: tab === k ? T.textPrimary : T.textMuted, borderBottom: `2.5px solid ${tab === k ? T.accent : "transparent"}` }}>
              <Icon size={15} />{label}{k === "members" && <span className="rounded-full px-1.5 text-[11px]" style={{ background: T.bgBase, color: T.textSecondary }}>{team.members.length + team.staff.length}</span>}
            </button>
          ))}
        </div>
      </Card>
      {exercises.map((x, i) => (
        <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-4 py-3" style={{ border: `1px solid ${T.border}`, background: `linear-gradient(135deg, ${T.accentSubtle}, #fff)` }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: NOVA.gradAccent }}><Briefcase size={17} /></span>
          <div className="min-w-0"><div className="truncate text-sm font-bold" style={{ color: T.textPrimary }}>今日：{x.title}</div><div className="text-xs" style={{ color: T.textMuted }}>カリキュラム「{x.unit}」{x.minutes !== "" && x.minutes != null ? ` ・ 目安 ${x.minutes}分` : ""}</div></div>
          <Btn size="sm" kind="ghost" onClick={() => go?.("curriculum")}>演習を開く<ChevronRight size={14} className="ml-1 inline" /></Btn>
        </div>
      ))}
      {tab === "chat" && <ChatTab team={team} me={me} nameOf={nameOf} />}
      {tab === "board" && team.settings?.board && <React.Suspense fallback={<Card className="p-4"><SkeletonRows rows={4} /></Card>}><TeamBoard team={team} nameOf={nameOf} /></React.Suspense>}
      {tab === "todo" && <TodoTab team={team} me={me} nameOf={nameOf} />}
      {tab === "files" && <FilesTab team={team} role={role} go={go} />}
      {tab === "members" && <Card className="p-4">
        <div className="mb-1 text-xs font-bold" style={{ color: T.textMuted }}>メンバー {team.members.length}</div>
        {team.members.map(id => <div key={id} className="flex items-center gap-2.5 py-1.5" style={{ borderTop: `1px solid ${T.border}` }}><Face name={nameOf(id)} size={32} ring={false} /><span className="flex-1 text-sm font-semibold" style={{ color: T.textPrimary }}>{nameOf(id)}{id === me ? "（自分）" : ""}</span>{team.leader === id ? <Badge tone="amber"><Crown size={12} />リーダー</Badge> : <Badge tone="muted">メンバー</Badge>}</div>)}
        <div className="mb-1 mt-4 text-xs font-bold" style={{ color: T.textMuted }}>講師・管理者</div>
        {team.staff.length === 0 ? <div className="text-sm" style={{ color: T.textMuted }}>いません</div> : team.staff.map(id => <div key={id} className="flex items-center gap-2.5 py-1.5" style={{ borderTop: `1px solid ${T.border}` }}><Face name={nameOf(id)} size={32} ring={false} /><span className="flex-1 text-sm font-semibold" style={{ color: T.textPrimary }}>{nameOf(id)}{id === me ? "（自分）" : ""}</span></div>)}
      </Card>}
    </div>
  );
}

/* ---------- チャット（②）。2026-10-14：Markdown表示・コードブロック・チームのフォルダのファイル添付・さかのぼり ---------- */
const CHAT_POLL_MS = 4000;
const MAX_CHAT_TEXT = 8000;
const MAX_CHAT_FILES = 5;
const hm = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
const dayLabel = iso => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; const t = new Date(); const same = (a, b) => a.toDateString() === b.toDateString(); const y = new Date(t); y.setDate(t.getDate() - 1); return same(d, t) ? "今日" : same(d, y) ? "昨日" : `${d.getMonth() + 1}月${d.getDate()}日`; };
const teamSpace = team => `course#${team.courseId}`;
const hastText = n => (n?.type === "text" ? n.value : (n?.children || []).map(hastText).join(""));

function CodeBlock({ node, children }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(hastText(node).replace(/\n$/, "")); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* コピーできない環境では何もしない */ }
  }
  return (
    <div className="relative mb-[0.9em] min-w-0 last:mb-0">
      <pre style={{ margin: 0, paddingRight: 40 }}>{children}</pre>
      <button type="button" onClick={copy} aria-label="コピー" title="コピー" className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "rgba(255,255,255,.12)", color: "#e2e8f0" }}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}
// 生の HTML は描画しない（skipHtml）。画像は外部を読み込まず、リンクとして出す
const MD_COMPONENTS = {
  pre: CodeBlock,
  a: ({ node: _n, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" />,
  img: ({ src, alt }) => <a href={src} target="_blank" rel="noopener noreferrer">{alt || src}</a>,
};
function MsgBody({ text }) {
  return (
    <div className="feeps-lesson-md min-w-0 max-w-full break-words [&_li]:whitespace-pre-wrap [&_p]:whitespace-pre-wrap">
      <ReactMarkdown skipHtml components={MD_COMPONENTS}>{text}</ReactMarkdown>
    </div>
  );
}

function FileChip({ file, onOpen, onRemove }) {
  const body = <>
    <FileText size={15} className="shrink-0" style={{ color: T.accent }} />
    <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: T.textPrimary }}>{file.name}</span>
    <span className="shrink-0 tabular-nums" style={{ color: T.textMuted }}>{fmtSize(file.sizeBytes)}</span>
  </>;
  return (
    <div className="flex min-w-0 max-w-full items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 text-xs" style={{ border: `1px solid ${T.border}` }}>
      {onOpen
        ? <button type="button" onClick={onOpen} title={file.name} className="flex min-w-0 flex-1 items-center gap-2 text-left">{body}<Download size={14} className="shrink-0" style={{ color: T.textMuted }} /></button>
        : <span className="flex min-w-0 flex-1 items-center gap-2">{body}</span>}
      {onRemove && <button type="button" onClick={onRemove} aria-label="外す" title="外す" className="shrink-0" style={{ color: T.textMuted }}><X size={14} /></button>}
    </div>
  );
}

function ChatTab({ team, me, nameOf }) {
  const ended = isEnded(team);
  const [msgs, setMsgs] = useState(null);
  const [canPost, setCanPost] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [older, setOlder] = useState(false);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);       // 送る前の添付
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const cursorRef = useRef("");
  const stickRef = useRef(true);
  const keepRef = useRef(null);                 // さかのぼったとき、見ていた位置を保つ
  const base = `/teams/${encodeURIComponent(team.teamId)}/messages`;
  const cq = `courseId=${encodeURIComponent(team.courseId)}`;
  const markedRef = useRef("");
  // 開いている間はこのチームを新着通知に数えない。読んだところまで既読にする
  useEffect(() => { setOpenChatTeam(team.teamId); return () => setOpenChatTeam(""); }, [team.teamId]);
  useEffect(() => {
    const last = msgs?.length ? msgs[msgs.length - 1].id : "";
    if (ended || msgs == null || document.visibilityState !== "visible" || (last && last === markedRef.current)) return;
    markedRef.current = last || "-";
    markTeamChatRead(team, last);
  }, [msgs, team, ended]);
  const addMsgs = useCallback(list => {
    if (!list.length) return;
    cursorRef.current = list[list.length - 1].id > cursorRef.current ? list[list.length - 1].id : cursorRef.current;
    setMsgs(cur => { const seen = new Set((cur || []).map(m => m.id)); return [...(cur || []), ...list.filter(m => !seen.has(m.id))]; });
  }, []);
  const load = useCallback(async () => {
    try {
      const d = await apiGet(`${base}?${cq}`);
      const list = Array.isArray(d?.messages) ? d.messages : [];
      cursorRef.current = list.length ? list[list.length - 1].id : "";
      setMsgs(list); setCanPost(!!d?.canPost); setHasMore(!!d?.hasMore); setErr("");
    } catch (e) { setErr(errText(e, "チャットを読み込めませんでした。")); }
  }, [base, cq]);
  useEffect(() => { load(); }, [load, ended]);
  // 新着を数秒ごとに読む（見えているときだけ。終了したチームは読まない）
  useEffect(() => {
    if (msgs == null || ended) return undefined;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const d = await apiGet(`${base}?${cq}${cursorRef.current ? `&after=${encodeURIComponent(cursorRef.current)}` : ""}`);
        addMsgs(Array.isArray(d?.messages) ? d.messages : []);
      } catch { /* 次の回で読み直す */ }
    }, CHAT_POLL_MS);
    return () => window.clearInterval(id);
  }, [msgs == null, ended, base, cq, addMsgs]); // eslint-disable-line react-hooks/exhaustive-deps
  // さかのぼったときは位置を保つ。下を見ているときだけ、新着で下へ送る
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (keepRef.current != null) { el.scrollTop = el.scrollHeight - keepRef.current; keepRef.current = null; return; }
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);
  async function loadOlder() {
    if (older || !msgs?.length) return;
    setOlder(true);
    try {
      const d = await apiGet(`${base}?${cq}&before=${encodeURIComponent(msgs[0].id)}`);
      const list = Array.isArray(d?.messages) ? d.messages : [];
      const el = listRef.current;
      keepRef.current = el ? el.scrollHeight - el.scrollTop : null;
      setMsgs(cur => { const seen = new Set((cur || []).map(m => m.id)); return [...list.filter(m => !seen.has(m.id)), ...(cur || [])]; });
      setHasMore(!!d?.hasMore);
    } catch (e) { setErr(errText(e, "読み込めませんでした。")); }
    finally { setOlder(false); }
  }
  async function send() {
    const v = text.trim();
    if ((!v && !files.length) || sending) return;
    setSending(true); setErr("");
    try {
      const m = await apiPost(base, { courseId: team.courseId, text: v, attachments: files.map(f => ({ nodeId: f.nodeId })) });
      setText(""); setFiles([]); stickRef.current = true; addMsgs([m]);
    } catch (e) { setErr(errText(e, "送れませんでした。")); }
    finally { setSending(false); }
  }
  async function remove(m) {
    if (!window.confirm("この発言を消しますか？")) return;
    try { await apiDelete(`${base}?${cq}&id=${encodeURIComponent(m.id)}`); setMsgs(cur => (cur || []).map(x => (x.id === m.id ? { ...x, deleted: true, text: "", attachments: [] } : x))); }
    catch (e) { setErr(errText(e, "消せませんでした。")); }
  }
  async function openFile(f) {
    setErr("");
    try {
      const r = await apiGet(`/library/download?spaceId=${encodeURIComponent(teamSpace(team))}&nodeId=${encodeURIComponent(f.nodeId)}&mode=download`);
      window.open(r.url, "_blank", "noopener");
    } catch (e) { setErr(errText(e, "ファイルを開けませんでした。")); }
  }
  // 「コード」：``` で囲む（選んでいる文字があれば、それを囲む）
  function insertCode() {
    const el = inputRef.current;
    const s = el ? el.selectionStart : text.length, e = el ? el.selectionEnd : text.length;
    const lead = s > 0 && text[s - 1] !== "\n" ? "\n" : "";
    const before = `${lead}\`\`\`\n`, after = "\n```\n";
    const next = (text.slice(0, s) + before + text.slice(s, e) + after + text.slice(e)).slice(0, MAX_CHAT_TEXT);
    setText(next);
    requestAnimationFrame(() => { if (!el) return; el.focus(); el.setSelectionRange(s + before.length, e + before.length); });
  }
  const inFence = (v, pos) => (v.slice(0, pos).match(/```/g) || []).length % 2 === 1;
  if (msgs == null) return err ? <PrismErrorRetryCard message={err} onRetry={load} /> : <Card className="p-4"><SkeletonRows rows={4} /></Card>;
  let lastDay = "";
  const attachList = (m, end) => (m.attachments?.length ? (
    <div className={`mt-1 flex w-full min-w-0 flex-col gap-1 ${end ? "items-end" : "items-start"}`}>
      {m.attachments.map(f => <div key={f.nodeId} className="w-64 max-w-full"><FileChip file={f} onOpen={() => openFile(f)} /></div>)}
    </div>
  ) : null);
  const iconBtn = (label, Icon, onClick, disabled) => (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-40" style={{ border: `1px solid ${T.border}`, color: T.textSecondary }}><Icon size={17} /></button>
  );
  return (
    <Card className="flex flex-col overflow-hidden p-0" style={{ height: "min(620px, 70vh)" }}>
      <div ref={listRef} onScroll={e => { const el = e.currentTarget; stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }} className="flex-1 overflow-y-auto px-4 py-3">
        {hasMore && <div className="mb-2 flex justify-center"><Btn size="sm" kind="ghost" icon={History} disabled={older} onClick={loadOlder}>{older ? "読み込み中…" : "さらに読み込む"}</Btn></div>}
        {msgs.length === 0 && <div className="py-10 text-center text-sm" style={{ color: T.textMuted }}>まだ発言はありません</div>}
        {msgs.map(m => {
          const day = dayLabel(m.createdAt);
          const sep = day !== lastDay ? <div className="my-2 flex justify-center"><span className="rounded-full px-2.5 text-[11px]" style={{ background: T.bgBase, color: T.textMuted }}>{day}</span></div> : null;
          lastDay = day;
          const mine = m.by === me;
          const bubble = !m.deleted && !m.text ? null : (
            <div className={`min-w-0 max-w-full break-words rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-tr-md" : "mt-0.5 rounded-tl-md"}`}
              style={m.deleted ? { background: T.bgBase, color: T.textMuted, ...(mine ? {} : { border: `1px solid ${T.border}` }) } : mine ? { background: T.accent, color: "#fff" } : { background: "#fff", border: `1px solid ${T.border}`, color: T.textPrimary }}>
              {m.deleted ? "この発言は消されました" : <MsgBody text={m.text} />}
            </div>
          );
          return (
            <React.Fragment key={m.id}>
              {sep}
              {mine ? (
                <div className="group my-1.5 flex justify-end gap-2">
                  <div className="flex min-w-0 max-w-[78%] flex-col items-end">
                    {bubble}
                    {!m.deleted && attachList(m, true)}
                    <div className="mt-0.5 flex items-center gap-2 text-[11px]" style={{ color: T.textMuted }}>{!m.deleted && !ended && <button type="button" onClick={() => remove(m)} className="opacity-0 transition group-hover:opacity-100 focus:opacity-100" style={{ color: T.textMuted }}>消す</button>}{hm(m.createdAt)}</div>
                  </div>
                </div>
              ) : (
                <div className="my-1.5 flex gap-2">
                  <Face name={nameOf(m.by)} size={30} ring={false} />
                  <div className="flex min-w-0 max-w-[78%] flex-col items-start">
                    <div className="text-xs font-bold" style={{ color: T.textSecondary }}>{nameOf(m.by)}<span className="ml-1.5 font-normal" style={{ color: T.textMuted }}>{hm(m.createdAt)}</span></div>
                    {bubble}
                    {!m.deleted && attachList(m, false)}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {err && <div className="px-4 pb-1 text-xs" style={{ color: T.danger }}>{err}</div>}
      {canPost && !ended ? (
        <div className="grid gap-2 px-3 py-2.5" style={{ borderTop: `1px solid ${T.border}` }}>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {files.map(f => <div key={f.nodeId} className="w-56 max-w-full"><FileChip file={f} onRemove={() => setFiles(cur => cur.filter(x => x.nodeId !== f.nodeId))} /></div>)}
            </div>
          )}
          <div className="flex items-end gap-2">
            {team.folderNodeId && iconBtn("ファイル", Paperclip, () => setPicking(true), files.length >= MAX_CHAT_FILES)}
            {iconBtn("コード", Code, insertCode)}
            <textarea ref={inputRef} value={text} onChange={e => setText(e.target.value)} rows={1} maxLength={MAX_CHAT_TEXT} placeholder={`${team.name} に送る`} aria-label="メッセージ"
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !inFence(text, e.currentTarget.selectionStart)) { e.preventDefault(); send(); } }}
              className="max-h-40 min-h-[40px] min-w-0 flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary, fontFamily: inFence(text, text.length) ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined }} />
            <Btn icon={Send} disabled={(!text.trim() && !files.length) || sending} onClick={send}>送る</Btn>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 px-3 py-3 text-sm" style={{ borderTop: `1px solid ${T.border}`, color: T.textMuted }}>{ended ? <EndedBadge team={team} /> : <><Eye size={15} />見るだけ</>}</div>
      )}
      {picking && <AttachPicker team={team} picked={files} onClose={() => setPicking(false)} onDone={list => { setFiles(list); setPicking(false); }} />}
    </Card>
  );
}

/* チャットに添付するファイルを、チームのフォルダから選ぶ／新しく置く（置いたファイルはそのまま選んだ状態にする） */
function AttachPicker({ team, picked, onClose, onDone }) {
  const spaceId = teamSpace(team);
  const [nodes, setNodes] = useState(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(() => picked.map(f => f.nodeId));
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const load = useCallback(async () => {
    try { const d = await apiGet(`/library?spaceId=${encodeURIComponent(spaceId)}`); setNodes(Array.isArray(d?.nodes) ? d.nodes : []); setErr(""); }
    catch (e) { setErr(errText(e, "フォルダを読み込めませんでした。")); }
  }, [spaceId]);
  useEffect(() => { load(); }, [load]);
  const byId = useMemo(() => new Map((nodes || []).map(n => [n.nodeId, n])), [nodes]);
  const folder = byId.get(team.folderNodeId);
  // チームのフォルダの下か。下のフォルダの名前は場所として添える
  const placeOf = n => {
    const names = [];
    let cur = byId.get(n.parentId);
    for (let i = 0; cur && i < 30; i++) {
      if (cur.nodeId === team.folderNodeId) return names.reverse().join(" / ");
      names.push(cur.name);
      cur = byId.get(cur.parentId);
    }
    return null;
  };
  const files = (nodes || []).filter(n => n.type === "file").map(n => ({ n, place: placeOf(n) })).filter(x => x.place !== null)
    .sort((a, b) => String(b.n.updatedAt || "").localeCompare(String(a.n.updatedAt || "")));
  const toggle = id => setSel(cur => (cur.includes(id) ? cur.filter(x => x !== id) : cur.length >= MAX_CHAT_FILES ? cur : [...cur, id]));
  async function onFiles(e) {
    const list = [...(e.target.files || [])];
    e.target.value = "";
    if (!list.length) return;
    setBusy(true); setErr("");
    const added = [];
    try {
      for (const f of list) {
        // eslint-disable-next-line no-await-in-loop
        const got = await apiPost("/library/upload-url", { spaceId, parentId: team.folderNodeId, filename: f.name, contentType: f.type || "application/octet-stream", sizeBytes: f.size });
        // eslint-disable-next-line no-await-in-loop
        const put = await fetch(got.uploadUrl, { method: "PUT", headers: { "content-type": got.contentType }, body: f });
        if (!put.ok) throw new Error(`アップロードに失敗しました（${put.status}）。`);
        // eslint-disable-next-line no-await-in-loop
        const node = await apiPost("/library/files", { spaceId, parentId: team.folderNodeId, nodeId: got.nodeId, s3key: got.s3key, materialId: got.materialId, name: f.name, sizeBytes: f.size, contentType: got.contentType });
        added.push(node?.nodeId || got.nodeId);
      }
    } catch (e2) { setErr(errText(e2, "アップロードできませんでした。")); }
    finally {
      if (added.length) setSel(cur => [...cur, ...added.filter(id => !cur.includes(id))].slice(0, MAX_CHAT_FILES));
      await load();
      setBusy(false);
    }
  }
  function done() {
    const keep = new Map(picked.map(f => [f.nodeId, f]));
    onDone(sel.map(id => {
      const n = byId.get(id);
      return n ? { nodeId: n.nodeId, name: n.name, sizeBytes: n.sizeBytes, contentType: n.contentType } : keep.get(id);
    }).filter(Boolean));
  }
  return (
    <Modal title="チームのフォルダ" onClose={onClose}
      footer={<>
        {folder?.canWrite && <>
          <input ref={fileInput} type="file" multiple hidden onChange={onFiles} />
          <Btn kind="ghost" icon={Upload} disabled={busy} onClick={() => fileInput.current?.click()} className="mr-auto">{busy ? "アップロード中…" : "アップロード"}</Btn>
        </>}
        <Btn kind="ghost" onClick={onClose}>やめる</Btn>
        <Btn icon={Paperclip} disabled={busy} onClick={done}>添付{sel.length ? ` ${sel.length}` : ""}</Btn>
      </>}>
      {err && <p className="mb-2 text-xs" style={{ color: T.danger }}>{err}</p>}
      {nodes == null ? (err ? <Btn size="sm" kind="ghost" onClick={load}>再読み込み</Btn> : <SkeletonRows rows={4} />) : files.length === 0 ? (
        <div className="py-8 text-center text-sm" style={{ color: T.textMuted }}>ファイルはありません</div>
      ) : (
        <div className="grid max-h-[50vh] gap-1 overflow-y-auto">
          {files.map(({ n, place }) => {
            const on = sel.includes(n.nodeId);
            const full = !on && sel.length >= MAX_CHAT_FILES;
            return (
              <label key={n.nodeId} className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2" style={{ border: `1px solid ${on ? T.accent : T.border}`, background: on ? T.accentSubtle : "#fff", opacity: full ? 0.5 : 1 }}>
                <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(n.nodeId)} />
                <FileText size={16} className="shrink-0" style={{ color: T.accent }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold" style={{ color: T.textPrimary }}>{n.name}</span>
                  {place && <span className="block truncate text-[11px]" style={{ color: T.textMuted }}><Folder size={11} className="mr-1 inline" />{place}</span>}
                </span>
                <span className="shrink-0 text-xs tabular-nums" style={{ color: T.textMuted }}>{fmtSize(n.sizeBytes)}</span>
                <span className="hidden shrink-0 text-xs tabular-nums sm:inline" style={{ color: T.textMuted }}>{fmtDay(n.updatedAt)}</span>
              </label>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function TodoTab({ team, me, nameOf }) {
  const [todos, setTodos] = useState(null);
  const [canWrite, setCanWrite] = useState(false);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [who, setWho] = useState("");
  const base = `/teams/${encodeURIComponent(team.teamId)}/todos`;
  const cq = `courseId=${encodeURIComponent(team.courseId)}`;
  const load = useCallback(async () => {
    try { const d = await apiGet(`${base}?${cq}`); setTodos(Array.isArray(d?.todos) ? d.todos : []); setCanWrite(!!d?.canWrite); setErr(""); }
    catch (e) { setErr(errText(e, "やることを読み込めませんでした。")); }
  }, [base, cq]);
  useEffect(() => { load(); }, [load]);
  async function run(fn) { try { await fn(); await load(); } catch (e) { setErr(errText(e, "保存できませんでした。")); } }
  if (todos == null) return err ? <PrismErrorRetryCard message={err} onRetry={load} /> : <Card className="p-4"><SkeletonRows rows={3} /></Card>;
  const done = todos.filter(t => t.done).length;
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2"><b className="text-sm" style={{ color: T.textPrimary }}>やること</b><Badge tone="muted">{done} / {todos.length}</Badge></div>
      {err && <p className="mb-2 text-xs" style={{ color: T.danger }}>{err}</p>}
      {todos.length === 0 && <div className="py-2 text-sm" style={{ color: T.textMuted }}>まだありません</div>}
      {todos.map(t => (
        <div key={t.todoId} className="flex items-center gap-2.5 py-2" style={{ borderTop: `1px solid ${T.border}` }}>
          <input type="checkbox" checked={!!t.done} disabled={!canWrite} onChange={e => run(() => apiPut(`${base}/${encodeURIComponent(t.todoId)}`, { courseId: team.courseId, done: e.target.checked }))} aria-label={`${t.text} を済みにする`} />
          <span className="min-w-0 flex-1 text-sm" style={{ color: t.done ? T.textMuted : T.textPrimary, textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
          <span className="text-xs" style={{ color: T.textMuted }}>{(t.assignees || []).length ? t.assignees.map(id => (id === "all" ? "全員" : nameOf(id))).join("・") : ""}</span>
          {canWrite && <button type="button" aria-label="消す" title="消す" onClick={() => run(() => apiDelete(`${base}/${encodeURIComponent(t.todoId)}?${cq}`))} style={{ color: T.textMuted }}><Trash2 size={14} /></button>}
        </div>
      ))}
      {canWrite && (
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); if (!text.trim()) return; run(() => apiPost(base, { courseId: team.courseId, text: text.trim(), assignees: who ? [who] : [] })); setText(""); }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="やることを足す" aria-label="やること" maxLength={120} className="min-w-0 flex-1 basis-full rounded-xl sm:basis-auto px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} />
          <select value={who} onChange={e => setWho(e.target.value)} aria-label="担当" className="rounded-xl bg-white px-2 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textSecondary }}>
            <option value="">担当なし</option><option value="all">全員</option>
            {team.members.map(id => <option key={id} value={id}>{nameOf(id)}{id === me ? "（自分）" : ""}</option>)}
          </select>
          <Btn type="submit" icon={Plus} disabled={!text.trim()}>足す</Btn>
        </form>
      )}
    </Card>
  );
}

function FilesTab({ team, role, go }) {
  function openInLibrary() { setLibraryTarget({ courseId: team.courseId, nodeId: team.folderNodeId }); go?.("materials"); }
  if (!team.folderNodeId) return <Card><EmptyState title="このチームのフォルダはありません" desc="" /></Card>;
  return (
    <div className="grid gap-2">
      <div className="flex justify-end"><Btn size="sm" kind="ghost" icon={Folder} onClick={openInLibrary}>ファイル管理で開く</Btn></div>
      <React.Suspense fallback={<Card className="p-4"><SkeletonRows rows={4} /></Card>}>
        <LibraryView role={role} go={go} scope={{ courseId: team.courseId, nodeId: team.folderNodeId }} />
      </React.Suspense>
    </div>
  );
}
