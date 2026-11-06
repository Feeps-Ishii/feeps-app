import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { Btn, Card, Chip, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, errText, md } from "../staff/common.js";

const RosterImport = lazy(() => import("../../console/RosterImport.jsx"));

/* 管理者のユーザー（モック usersA）：ロール・状態で絞る・探す・並べ替え。まとめて選んで仮パスワード・利用を止める。
   ログインの作り方は今の画面と同じ（/admin/users）。最後のログインは 1 日 1 回の記録（lastSeenAt） */

const ROLES = [["trainee", "受講生"], ["instructor", "講師"], ["manager", "コース担当者"], ["client", "企業担当者"], ["admin", "管理者"]];
const R_NAME = Object.fromEntries(ROLES);
const R_ORD = { admin: 0, instructor: 1, manager: 2, client: 3, trainee: 4 };
const R_TONE = { manager: "mk", instructor: "blue", admin: "ink" };

export const makeTemp = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789", b = new Uint32Array(12); crypto.getRandomValues(b); return `Tp${[...b].map(x => c[x % c.length]).join("")}#7`; };

// メールの @ から企業とロールを当てる（モック guessUser）
function guessOf(email, companies) {
  const dom = String(email.split("@")[1] || "").trim().toLowerCase();
  if (!dom) return null;
  if (dom === "feeps.co.jp") return { role: "instructor", company: "", why: "@feeps.co.jp は社内" };
  if (dom === "id.devhub-lms.com") return { role: "trainee", company: "", why: "メールのない受講生のログイン ID" };
  const c = companies.find(x => String(x.domain || "").toLowerCase() === dom);
  return c ? { role: "trainee", company: c.companyId, why: `@${dom} は ${c.name}` } : { role: "trainee", company: "", why: `@${dom} の企業はまだありません` };
}

export function NewUser({ companies, courses, initial, onClose, onDone }) {
  const [v, setV] = useState({ name: "", email: "", role: "trainee", company: "", courseId: "", ...(initial || {}) });
  const [why, setWhy] = useState(initial ? "" : null); // null は読み取る前
  const [made, setMade] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const f = (k, x) => setV(s => ({ ...s, [k]: x }));
  const read = () => {
    const g = guessOf(v.email, companies);
    if (!g) { setErr("メールアドレスを入れてください"); return; }
    setErr(""); setWhy(g.why); setV(s => ({ ...s, role: initial?.role || g.role, company: initial?.company || g.company || s.company }));
  };
  const save = async () => {
    if (!v.name.trim() || !v.email.trim()) { setErr("名前とメールアドレスを入れてください"); return; }
    if ((v.role === "trainee" || v.role === "client") && !v.company) { setErr("企業を選んでください"); return; }
    setBusy(true); setErr("");
    const tempPassword = makeTemp();
    try { await apiPost("/admin/users", { email: v.email.trim(), name: v.name.trim(), role: v.role, tempPassword, companyId: v.company, courseId: v.courseId }); setMade(tempPassword); }
    catch (e) { setErr(errText(e, "足せませんでした")); } finally { setBusy(false); }
  };
  if (made) return <Modal title="ユーザーを足しました" width={460} onClose={onDone} footer={<Btn onClick={onDone}>閉じる</Btn>}><div className="mgoal"><span className="eyebrow">{v.name} の仮パスワード ・ 今だけ表示</span><b className="dv-mono">{made}</b></div></Modal>;
  return (
    <Modal title="ユーザーを足す" width={520} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy || why === null} onClick={save}>{busy ? "足しています" : "足す"}</Btn></>}>
      <label className="field">メールアドレス<span className="row st-nw"><input type="email" className="nuin" autoFocus value={v.email} onChange={e => f("email", e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) read(); }} /><Btn kind="ghost sm" onClick={read}>読み取る</Btn><Btn kind="ghost sm" onClick={() => { setErr(""); setWhy("仮メール ・ 初回ログインで本人が登録"); setV(s => ({ ...s, email: `temp-${Date.now().toString(36)}@id.devhub-lms.com` })); }}>仮メールにする</Btn></span></label>
      <label className="field">名前<input type="text" value={v.name} onChange={e => f("name", e.target.value)} /></label>
      {why !== null && (
        <div className="aip">
          {why && <div className="row"><Chip tone="mk">メールから</Chip><Chip>{why}</Chip></div>}
          <div className="field">ロール<span className="seg">{ROLES.filter(([k]) => k !== "admin").map(([k, t]) => <button key={k} type="button" aria-pressed={v.role === k} onClick={() => f("role", k)}>{t}</button>)}</span></div>
          <div className="st-fg">
            <label className="field">企業<select className="in" value={v.company} onChange={e => f("company", e.target.value)}><option value="">なし</option>{companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}</select></label>
            {(v.role === "trainee" || v.role === "instructor") && <label className="field">コース<select className="in" value={v.courseId} onChange={e => f("courseId", e.target.value)}><option value="">あとで</option>{courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}</select></label>}
          </div>
        </div>
      )}
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

// 選んだ人をコースに入れる（モック ubulk）
function AddToCourse({ ids, users, courses, onClose, onDone }) {
  const can = ids.filter(id => ["trainee", "instructor"].includes(users.find(u => u.userId === id)?.role));
  const [courseId, setCourseId] = useState(courses[0]?.courseId || "");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true); setErr("");
    try {
      for (const id of can) {
        /* eslint-disable no-await-in-loop */
        const l = await apiGet(`/admin/users/${id}/courses`);
        const cur = arr(l?.courseIds || l).map(x => x.courseId || x);
        if (!cur.includes(courseId)) await apiPut(`/admin/users/${id}/courses`, { courseIds: [...cur, courseId] });
        /* eslint-enable no-await-in-loop */
      }
      onDone(can.length);
    } catch (e) { setErr(errText(e, "入れられませんでした")); setBusy(false); }
  };
  return (
    <Modal title="コースに入れる" width={460} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy || !courseId || !can.length} onClick={save}>{can.length} 人を入れる</Btn></>}>
      <label className="field">コース<select className="in" value={courseId} onChange={e => setCourseId(e.target.value)}>{courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}</select></label>
      {can.length < ids.length && <div className="row"><Chip tone="warn">受講生・講師だけ入れます（{ids.length - can.length} 人は外します）</Chip></div>}
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

// お客様の名簿で登録：コースを選んでから名簿の窓へ
function RosterPick({ courses, onClose, onDone }) {
  const [courseId, setCourseId] = useState(""); const [open, setOpen] = useState(false);
  const c = courses.find(x => x.courseId === courseId);
  if (open && c) return <Suspense fallback={null}><div className="lms-legacy"><RosterImport course={{ ...c, id: c.courseId }} onClose={onClose} onDone={onDone} /></div></Suspense>;
  return (
    <Modal title="お客様の名簿で登録" width={460} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={!c} onClick={() => setOpen(true)}>次へ</Btn></>}>
      <label className="field">コース<select className="in" value={courseId} onChange={e => setCourseId(e.target.value)}><option value="">選ぶ</option>{courses.map(x => <option key={x.courseId} value={x.courseId}>{x.name}</option>)}</select></label>
    </Modal>
  );
}

// 管理者の段階（スーパー管理者だけが変えられる。API が確かめる）
function AdminPerm({ u, courses, say, onDone }) {
  const [v, setV] = useState({ tier: u.adminTier === "standard" ? "standard" : "super", edit: u.canEditReportsAttendance === true, ids: arr(u.assignedCourseIds) });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true); setErr("");
    try { await apiPut(`/admin/users/${u.userId}/admin-permissions`, { adminTier: v.tier, canEditReportsAttendance: v.tier === "standard" && v.edit, assignedCourseIds: v.tier === "standard" ? v.ids : [] }); say?.("権限を保存しました"); onDone(); }
    catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(false); }
  };
  return (
    <div className="ce-b">
      <div className="head"><h4 className="h3">管理者の権限</h4><span className="r"><Chip tone={v.tier === "super" ? "bad" : "blue"}>{v.tier === "super" ? "スーパー管理者" : "一般管理者"}</Chip></span></div>
      <label className="field">種別<select className="in" value={v.tier} onChange={e => setV(x => ({ ...x, tier: e.target.value }))}><option value="standard">一般管理者</option><option value="super">スーパー管理者</option></select></label>
      {v.tier === "standard" && <>
        <label className="st-ck"><input type="checkbox" checked={v.edit} onChange={e => setV(x => ({ ...x, edit: e.target.checked }))} />日報・勤怠の修正と削除</label>
        <div className="field">担当コース<span className="row">{courses.map(c => <label key={c.courseId} className="st-ck"><input type="checkbox" checked={v.ids.includes(c.courseId)} onChange={e => setV(x => ({ ...x, ids: e.target.checked ? [...x.ids, c.courseId] : x.ids.filter(id => id !== c.courseId) }))} />{c.name}</label>)}</span></div>
      </>}
      {err && <div className="lms-err" role="alert">{err}</div>}
      <span className="row st-end"><Btn kind="sm" disabled={busy} onClick={save}>権限を保存</Btn></span>
    </div>
  );
}

function EditUser({ u, companies, courses, isSuper, onClose, onDone, say }) {
  const [mine, setMine] = useState(null);
  useEffect(() => { if (u.role === "trainee" || u.role === "instructor") apiGet(`/admin/users/${u.userId}/courses`).then(l => setMine(arr(l?.courseIds || l).map(x => x.courseId || x))).catch(() => setMine(undefined)); }, [u.userId, u.role]);
  const [v, setV] = useState({ name: u.name || "", role: u.role, company: u.company || "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [temp, setTemp] = useState(""); const [del, setDel] = useState(false);
  const f = (k, x) => setV(s => ({ ...s, [k]: x }));
  const run = async fn => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(errText(e, "うまくいきませんでした")); } finally { setBusy(false); } };
  return (
    <Modal title={`${u.name || "名前未設定"} を直す`} width={480} onClose={onClose} footer={<>{!del ? <Btn kind="ghost" disabled={busy} onClick={() => setDel(true)}>消す</Btn> : <Btn disabled={busy} onClick={() => run(async () => { await apiDelete(`/admin/users/${u.userId}`); say?.("消しました"); onDone(); })}>本当に消す</Btn>}<Btn kind="ghost" onClick={onClose}>閉じる</Btn><Btn disabled={busy} onClick={() => run(async () => { await apiPut(`/admin/users/${u.userId}`, { name: v.name.trim(), company: v.company, role: v.role }); say?.("直しました"); onDone(); })}>保存</Btn></>}>
      <label className="field">名前<input type="text" value={v.name} onChange={e => f("name", e.target.value)} /></label>
      <div className="st-fg">
        <label className="field">ロール<select className="in" value={v.role} onChange={e => f("role", e.target.value)}>{ROLES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className="field">企業<select className="in" value={v.company} onChange={e => f("company", e.target.value)}><option value="">なし</option>{companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}</select></label>
      </div>
      {mine !== null && (u.role === "trainee" || u.role === "instructor") && <div className="field">コース{mine === undefined ? <Chip>確認できません</Chip> : <span className="row">{courses.map(c => <label key={c.courseId} className="st-ck"><input type="checkbox" checked={mine.includes(c.courseId)} disabled={busy} onChange={e => { const next = e.target.checked ? [...mine, c.courseId] : mine.filter(x => x !== c.courseId); run(async () => { await apiPut(`/admin/users/${u.userId}/courses`, { courseIds: next }); setMine(next); say?.("コースを変えました"); }); }} />{c.name}</label>)}</span>}</div>}
      {isSuper && u.role === "admin" && <AdminPerm u={u} courses={courses} say={say} onDone={onDone} />}
      <div className="row">
        <Btn kind="ghost sm" disabled={busy} onClick={() => run(async () => { const r = await apiPost(`/admin/users/${u.userId}/temp-password`, {}); setTemp(r.password); })}>仮パスワードを出す</Btn>
        <Btn kind="ghost sm" disabled={busy} onClick={() => run(async () => { await apiPut(`/admin/users/${u.userId}/status`, { disabled: !u.disabled }); say?.(u.disabled ? "利用を再開しました" : "利用を止めました"); onDone(); })}>{u.disabled ? "利用を再開する" : "利用を止める"}</Btn>
      </div>
      {temp && <div className="mgoal"><span className="eyebrow">仮パスワード ・ 今だけ表示</span><b className="dv-mono">{temp}</b></div>}
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

export default function AdminUsers({ say }) {
  const [st, setSt] = useState({ state: "loading", users: [] });
  const [companies, setCompanies] = useState([]);
  const [courses, setCourses] = useState([]);
  const [isSuper, setIsSuper] = useState(false);
  useEffect(() => { apiGet("/profile/me").then(p => setIsSuper(p?.role === "admin" && p?.adminTier !== "standard")).catch(() => {}); }, []);
  const [tab, setTab] = useState("all"); const [status, setStatus] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("role");
  const [sel, setSel] = useState({}); const [adding, setAdding] = useState(false); const [roster, setRoster] = useState(false); const [toCourse, setToCourse] = useState(false); const [edit, setEdit] = useState(""); const [busy, setBusy] = useState(false); const [temps, setTemps] = useState(null); const [err, setErr] = useState(""); const [stopConfirm, setStopConfirm] = useState(false);
  const load = useCallback(() => apiGet("/admin/users").then(l => setSt({ state: "ready", users: arr(l).map(u => ({ ...u, kana: u.nameKana || "" })) })).catch(() => setSt({ state: "error", users: [] })), []);
  useEffect(() => { load(); apiGet("/companies").then(l => setCompanies(arr(l))).catch(() => setCompanies([])); apiGet("/admin/course-overview").then(r => setCourses(arr(r?.courses))).catch(() => setCourses(null)); try { const c = sessionStorage.getItem("lms.userCompany"); if (c) { sessionStorage.removeItem("lms.userCompany"); setQ(c); } } catch { /* 絞らずに出すだけ */ } }, [load]);
  const coName = useMemo(() => Object.fromEntries(companies.map(c => [c.companyId, c.name])), [companies]);
  if (st.state === "loading") return <div className="soon card">読み込み中</div>;
  if (st.state === "error") return <Card><div className="empty"><b>ユーザーを確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div></Card>;
  const stOf = u => (u.disabled ? "stop" : !u.lastSeenAt ? "inv" : "ok");
  const hit = u => !q.trim() || matchName(u.name || "", u.kana, q) || String(u.email || "").includes(q.trim()) || String(coName[u.company] || "").includes(q.trim());
  const by = { role: (a, b) => (R_ORD[a.role] ?? 9) - (R_ORD[b.role] ?? 9) || String(a.name).localeCompare(String(b.name), "ja"), name: (a, b) => String(a.name).localeCompare(String(b.name), "ja"), new: (a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")), old: (a, b) => String(a.lastSeenAt || "9").localeCompare(String(b.lastSeenAt || "9")) }[sort];
  const list = st.users.filter(u => (tab === "all" || u.role === tab) && (status === "all" || stOf(u) === status) && hit(u)).sort(by);
  const picked = Object.keys(sel).filter(k => sel[k]);
  const allOn = list.length > 0 && list.every(u => sel[u.userId]);
  const bulk = async fn => {
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr(errText(e, "うまくいきませんでした")); } finally { setBusy(false); }
  };
  const nameOf = id => st.users.find(u => u.userId === id)?.name || id;
  const editing = st.users.find(u => u.userId === edit);
  const cl = arr(courses);
  // コースの列：受講生は登録、講師・担当者はコースの担当、企業担当者は自社のコース
  const courseOf = u => {
    if (courses === null) return null;
    if (u.role === "trainee") return u.courseIds ? cl.filter(c => u.courseIds.includes(c.courseId)) : null;
    if (u.role === "instructor") return cl.filter(c => arr(c.instructorIds).includes(u.userId));
    if (u.role === "manager") return cl.filter(c => arr(c.managerIds).includes(u.userId));
    if (u.role === "client") return cl.filter(c => c.companyId && c.companyId === u.company);
    return [];
  };
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">ユーザー {st.users.length}</div><h1 className="h1">ユーザー</h1></div><span className="r"><Btn kind="ghost sm" onClick={() => setRoster(true)}>お客様の名簿で登録</Btn><Btn kind="sm" onClick={() => setAdding(true)}>ユーザーを足す</Btn></span></div>
      <ListTool tabs={[["all", "すべて", st.users.length], ...ROLES.map(([k, t]) => [k, t, st.users.filter(u => u.role === k).length])]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前・メール・企業で探す" sorts={[["role", "ロール順"], ["name", "名前順"], ["new", "最後のログインの新しい順"], ["old", "最後のログインの古い順"]]} sort={sort} onSort={setSort} />
      <div className="row"><span className="seg"><button type="button" aria-pressed={status === "all"} onClick={() => setStatus("all")}>状態 すべて</button>{[["inv", "未ログイン"], ["stop", "停止中"]].map(([k, t]) => <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}>{t} <span className="num">{st.users.filter(u => stOf(u) === k).length}</span></button>)}</span></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {picked.length > 0 && (
        <div className="adbulk" role="status"><b>{picked.length} 人を選んでいます</b>
          <span className="row">
            <Btn kind="ghost sm" disabled={busy} onClick={() => bulk(async () => { const out = []; for (const id of picked) { const r = await apiPost(`/admin/users/${id}/temp-password`, {}); out.push([nameOf(id), r.password]); } setTemps(out); })}>仮パスワードを出す</Btn>
            <Btn kind="ghost sm" disabled={busy} onClick={() => setToCourse(true)}>コースに入れる</Btn>
            <Btn kind="ghost sm" disabled={busy} onClick={() => setStopConfirm(true)}>利用を止める</Btn>
          </span>
          <button type="button" className="lnk" onClick={() => setSel({})}>選ぶのをやめる</button>
        </div>
      )}
      <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th><button type="button" className={`pinc${allOn ? " on" : ""}`} aria-pressed={allOn} aria-label="見えている人をすべて選ぶ" onClick={() => setSel(s => { const n = { ...s }; list.forEach(u => { n[u.userId] = !allOn; }); return n; })}>{allOn ? "✓" : ""}</button></th><th>名前</th><th>ロール</th><th>ログイン</th><th>企業</th><th>コース</th><th>最後のログイン</th><th /></tr></thead><tbody>
        {list.map(u => (
          <tr key={u.userId} className={`${u.disabled ? "stopped" : ""}${sel[u.userId] ? " pinr" : ""}`}>
            <td><button type="button" className={`pinc${sel[u.userId] ? " on" : ""}`} aria-pressed={!!sel[u.userId]} aria-label={`${u.name} を選ぶ`} onClick={() => setSel(s => ({ ...s, [u.userId]: !s[u.userId] }))}>{sel[u.userId] ? "✓" : ""}</button></td>
            <td><span className="ua-n"><span className={`face r-${R_ORD[u.role] ?? 4}`}>{String(u.name || "?").slice(0, 1)}</span><b>{u.name || "名前未設定"}</b></span>{u.disabled && <> <Chip>停止中</Chip></>}</td>
            <td><Chip tone={R_TONE[u.role] || ""}>{R_NAME[u.role] || u.role}</Chip></td>
            <td className="num">{u.email || u.username || ""}</td>
            <td>{coName[u.company] || "—"}</td>
            <td>{(() => { const l = courseOf(u); return l === null ? <Chip>確認できません</Chip> : l.length ? l.map(c => c.name).join(" ・ ") : "—"; })()}</td>
            <td>{u.lastSeenAt ? <span className="num">{md(u.lastSeenAt)}</span> : <Chip>まだ</Chip>}</td>
            <td><Btn kind="ghost sm" onClick={() => setEdit(u.userId)}>直す</Btn></td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={8}><Chip>該当なし</Chip></td></tr>}
      </tbody></table></div></Card>
      {adding && <NewUser companies={companies} courses={cl} onClose={() => setAdding(false)} onDone={() => { setAdding(false); say?.("ユーザーを足しました"); load(); }} />}
      {roster && <RosterPick courses={cl} onClose={() => setRoster(false)} onDone={() => { setRoster(false); load(); }} />}
      {toCourse && <AddToCourse ids={picked} users={st.users} courses={cl} onClose={() => setToCourse(false)} onDone={n => { setToCourse(false); setSel({}); say?.(`${n} 人をコースに入れました`); load(); }} />}
      {editing && <EditUser key={editing.userId} u={editing} companies={companies} courses={cl} isSuper={isSuper} say={say} onClose={() => setEdit("")} onDone={() => { setEdit(""); load(); }} />}
      {stopConfirm && <Modal title={`${picked.length} 人の利用を止める`} width={460} onClose={() => setStopConfirm(false)} footer={<><Btn kind="ghost" onClick={() => setStopConfirm(false)}>やめる</Btn><Btn disabled={busy} onClick={() => { setStopConfirm(false); bulk(async () => { for (const id of picked) await apiPut(`/admin/users/${id}/status`, { disabled: true }); setSel({}); say?.(`${picked.length} 人の利用を止めました`); await load(); }); }}>止める</Btn></>}><div className="row">{picked.slice(0, 12).map(id => <Chip key={id}>{nameOf(id)}</Chip>)}{picked.length > 12 && <Chip>ほか {picked.length - 12} 人</Chip>}</div></Modal>}
      {temps && <Modal title="仮パスワード ・ 今だけ表示" width={500} onClose={() => { setTemps(null); setSel({}); }} footer={<Btn kind="ghost" onClick={() => { setTemps(null); setSel({}); }}>閉じる</Btn>}><div className="st-g">{temps.map(([n, p]) => <div key={n} className="fd-f st-tp"><span className="fd-fb"><b>{n}</b></span><b className="dv-mono">{p}</b></div>)}</div></Modal>}
    </div>
  );
}
