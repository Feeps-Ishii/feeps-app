import React, { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { Btn, Card, Chip, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, errText } from "../staff/common.js";
import CourseCreate from "./CourseCreate.jsx";
import { downloadAccountExcel } from "../../console/RosterImport.jsx";
import { NewUser, RosterPick, makeTemp } from "./Users.jsx";

/* 管理者の企業（モック coA・xcoModal）：一覧・足す。企業担当者と受講生の数はユーザーから数える。
   「ユーザーを見る」はその企業で絞る。名前を押すと直す窓 */

// ほかの画面で作ったコースを、コース一覧で開く
export const madeBox = { v: null };
export const afterMade = (go, id, r) => { madeBox.v = r || null; try { sessionStorage.setItem("lms.courseOpen", id); } catch { /* 一覧が開くだけ */ } go("course"); };

export function AddCompany({ onClose, onDone, onCourse }) {
  const [v, setV] = useState({ name: "", domain: "", cn: "", cm: "" });
  const [made, setMade] = useState(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const f = (k, x) => setV(s => ({ ...s, [k]: x }));
  const save = async () => {
    if (!v.name.trim()) { setErr("企業の名前を入れてください"); return; }
    if (!!v.cn.trim() !== !!v.cm.trim()) { setErr("企業担当者の名前とメールを両方入れてください"); return; }
    setBusy(true); setErr("");
    try {
      const r = await apiPost("/companies", { name: v.name.trim(), domain: v.domain.trim() });
      let temp = "", warn = "";
      if (v.cn.trim()) {
        temp = makeTemp();
        try { await apiPost("/admin/users", { email: v.cm.trim(), name: v.cn.trim(), role: "client", tempPassword: temp, companyId: r.companyId, courseId: "" }); }
        catch (e) { temp = ""; warn = errText(e, "企業担当者を作れませんでした"); }
      }
      setMade({ companyId: r.companyId, temp, warn });
      onDone?.();
    } catch (e) { setErr(errText(e, "足せませんでした")); } finally { setBusy(false); }
  };
  if (made) {
    return (
      <Modal title="企業を足す" width={560} onClose={onClose} footer={<Btn kind="ghost" onClick={onClose}>閉じる</Btn>}>
        <div className="okmsg">「{v.name.trim()}」を足しました</div>
        {made.warn && <div className="lms-err" role="alert">{made.warn}</div>}
        {made.temp && <div className="mgoal"><span className="eyebrow">{v.cn.trim()} の仮パスワード ・ 今だけ表示</span><b className="dv-mono">{made.temp}</b></div>}
        <div className="list"><div className="li"><span><b>コース</b><small>研修計画書・文・前のコースから</small></span><Btn kind="sm" onClick={() => onCourse(made.companyId)}>この企業のコースを作る</Btn></div></div>
      </Modal>
    );
  }
  return (
    <Modal title="企業を足す" width={560} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy} onClick={save}>足す</Btn></>}>
      <label className="field">企業の名前<input type="text" autoFocus value={v.name} onChange={e => f("name", e.target.value)} /></label>
      <label className="field">メールの @<input type="text" value={v.domain} placeholder="aoba-shoji.co.jp" onChange={e => f("domain", e.target.value)} /></label>
      <div className="g2e"><label className="field">企業担当者の名前<input type="text" value={v.cn} placeholder="あとでもよい" onChange={e => f("cn", e.target.value)} /></label><label className="field">企業担当者のメール<input type="email" value={v.cm} onChange={e => f("cm", e.target.value)} /></label></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

// 企業ごとのアカウント発行：選んだ人の仮パスワードを出し直して、お客様に渡す Excel にする（招待メールの代わり）
function IssueAccounts({ co, users, courses, onClose, onRoster }) {
  const people = users.filter(u => u.company === co.companyId && ["trainee", "client"].includes(u.role) && !u.disabled);
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("name");
  const [sel, setSel] = useState(() => Object.fromEntries(people.filter(u => !u.lastSeenAt).map(u => [u.userId, true])));
  const [sure, setSure] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const list = people.filter(u => matchName(u.name || "", u.kana || "", q) && (tab === "all" || (tab === "new" ? !u.lastSeenAt : !!u.lastSeenAt)))
    .sort(sort === "name" ? (a, b) => String(a.kana || a.name).localeCompare(String(b.kana || b.name), "ja") : (a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")));
  const picked = people.filter(u => sel[u.userId]);
  const issue = async () => {
    setBusy(true); setErr(""); setSure(false);
    const rows = [], failed = [];
    for (const u of picked) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const r = await apiPost(`/admin/users/${u.userId}/temp-password`, {});
        rows.push({ name: u.name || "", loginId: u.email || u.username || "", password: r.password, email: /@id\.devhub-lms\.com$/i.test(u.email || "") ? "" : (u.email || "") });
      } catch { failed.push(u.name || u.email); }
    }
    setBusy(false);
    setDone({ rows, failed });
    if (rows.length) { try { await downloadAccountExcel({ company: co.name, course: "", rows }); } catch { setErr("Excel を作れませんでした。下のボタンからもう一度受け取ってください"); } }
  };
  if (done) {
    return (
      <Modal title={`アカウント発行 ・ ${co.name}`} width={520} onClose={onClose} footer={<>{done.rows.length > 0 && <Btn kind="ghost" onClick={() => downloadAccountExcel({ company: co.name, course: "", rows: done.rows })}>もう一度 Excel を受け取る</Btn>}<Btn onClick={onClose}>閉じる</Btn></>}>
        {done.rows.length > 0 && <div className="okmsg">{done.rows.length} 人の仮パスワードを発行しました</div>}
        {done.failed.length > 0 && <div className="lms-err" role="alert">発行できませんでした：{done.failed.join("、")}</div>}
        {err && <div className="lms-err" role="alert">{err}</div>}
        <div className="row"><Chip tone="warn">閉じると仮パスワードはもう出せません</Chip></div>
      </Modal>
    );
  }
  return (
    <Modal title={`アカウント発行 ・ ${co.name}`} width={620} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy || !picked.length} onClick={() => setSure(true)}>{busy ? "発行しています" : `${picked.length} 人を発行して Excel を受け取る`}</Btn></>}>
      <div className="row"><Btn kind="ghost sm" disabled={!courses.length} onClick={onRoster}>お客様の名簿から作る</Btn>{!courses.length && <Chip>先にコースを作る</Chip>}</div>
      {people.length > 0 ? (
        <>
          <ListTool tabs={[["all", "すべて", people.length], ["new", "未ログイン", people.filter(u => !u.lastSeenAt).length, "warn"], ["seen", "ログイン済み", people.filter(u => u.lastSeenAt).length]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["name", "名前順"], ["seen", "最後のログイン順"]]} sort={sort} onSort={setSort} />
          <div className="row"><Btn kind="ghost sm" onClick={() => setSel(s => ({ ...s, ...Object.fromEntries(list.map(u => [u.userId, true])) }))}>表示中をすべて選ぶ</Btn><Btn kind="ghost sm" onClick={() => setSel({})}>選択を外す</Btn></div>
          <div className="fs-pick iss-l">{list.map(u => <label key={u.userId} className="st-ck fs-pr"><input type="checkbox" checked={!!sel[u.userId]} onChange={e => setSel(s => ({ ...s, [u.userId]: e.target.checked }))} />{u.name || "名前未設定"}<small className="num"> {u.role === "client" ? "企業担当者" : "受講生"}{u.lastSeenAt ? " ・ ログイン済み" : ""}</small></label>)}{!list.length && <Chip>該当なし</Chip>}</div>
        </>
      ) : <Chip>受講生・企業担当者なし</Chip>}
      {sure && <Modal title={`${picked.length} 人の仮パスワードを発行しますか？`} width={460} onClose={() => setSure(false)} footer={<><Btn kind="ghost" onClick={() => setSure(false)}>やめる</Btn><Btn onClick={issue}>発行する</Btn></>}><div className="row"><Chip tone="warn">今のパスワードは使えなくなる</Chip>{picked.some(u => u.lastSeenAt) && <Chip tone="bad">ログイン済み {picked.filter(u => u.lastSeenAt).length} 人を含む</Chip>}</div></Modal>}
    </Modal>
  );
}

function Edit({ co, onClose, onDone }) {
  const [v, setV] = useState({ name: co.name || "", domain: co.domain || "", memo: co.memo || co.note || "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [del, setDel] = useState(false);
  const f = (k, x) => setV(s => ({ ...s, [k]: x }));
  const run = async fn => { setBusy(true); setErr(""); try { await fn(); onDone(); } catch (e) { setErr(errText(e, "うまくいきませんでした")); setBusy(false); } };
  return (
    <Modal title="企業を直す" width={460} onClose={onClose} footer={<>{!del ? <Btn kind="ghost" onClick={() => setDel(true)}>消す</Btn> : <Btn disabled={busy} onClick={() => run(() => apiDelete(`/companies/${co.companyId}`))}>本当に消す</Btn>}<Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy || !v.name.trim()} onClick={() => run(() => apiPut(`/companies/${co.companyId}`, { name: v.name.trim(), domain: v.domain.trim(), memo: v.memo.trim() }))}>決める</Btn></>}>
      <label className="field">企業の名前<input type="text" autoFocus value={v.name} onChange={e => f("name", e.target.value)} /></label>
      <label className="field">メールの @<input type="text" value={v.domain} placeholder="aoba-shoji.co.jp" onChange={e => f("domain", e.target.value)} /></label>
      <label className="field">メモ<textarea rows={2} value={v.memo} onChange={e => f("memo", e.target.value)} /></label>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

export default function AdminCompanies({ go, say }) {
  const [st, setSt] = useState({ state: "loading", cos: [], users: [], courses: [] });
  const [edit, setEdit] = useState(null); const [adding, setAdding] = useState(false);
  const [contact, setContact] = useState(null); const [making, setMaking] = useState(null);
  const [issue, setIssue] = useState(null); const [rosterFor, setRosterFor] = useState(null);
  const load = useCallback(() => {
    Promise.all([apiGet("/companies"), apiGet("/admin/users"), apiGet("/admin/course-overview").catch(() => ({ courses: [] }))])
      .then(([c, u, o]) => setSt({ state: "ready", cos: arr(c).filter(x => !x.deleted), users: arr(u), courses: arr(o?.courses) }))
      .catch(() => setSt({ state: "error", cos: [], users: [], courses: [] }));
  }, []);
  useEffect(load, [load]);
  if (st.state === "loading") return <div className="soon card">読み込み中</div>;
  if (st.state === "error") return <Card><div className="empty"><b>企業を確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div></Card>;
  const cats = ["tm", "att", "cur", "tst", "rep"];
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">企業 {st.cos.length}</div><h1 className="h1">企業</h1></div><span className="r"><Btn kind="sm" onClick={() => setAdding(true)}>企業を足す</Btn></span></div>
      <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>企業</th><th>メールの @</th><th>企業担当者</th><th>受講生</th><th>コース</th><th /></tr></thead><tbody>
        {st.cos.map((c, i) => {
          const us = st.users.filter(u => u.company === c.companyId), contacts = us.filter(u => u.role === "client"), courses = st.courses.filter(x => x.companyId === c.companyId);
          return (
            <tr key={c.companyId}>
              <td><span className="ua-n"><span className={`co-av c-${cats[i % 5]}`}>{String(c.name).slice(0, 1)}</span><button type="button" className="lnk adcn" onClick={() => setEdit(c)}>{c.name}</button></span></td>
              <td className="num">{c.domain ? `@${c.domain}` : "—"}</td>
              <td>{contacts.length ? contacts.map(u => u.name).join("・") : <button type="button" className="chip warn" onClick={() => setContact(c)}>未設定 ・ 足す</button>}</td>
              <td className="num">{us.filter(u => u.role === "trainee").length} 人</td>
              <td>{courses.length ? <span className="co-cs">{courses.map(x => <span key={x.courseId}>{x.name}</span>)}</span> : "—"}</td>
              <td><span className="row st-nw"><Btn kind="ghost sm" onClick={() => setIssue(c)}>アカウント発行</Btn><Btn kind="ghost sm" onClick={() => { try { sessionStorage.setItem("lms.userCompany", c.name); } catch { /* 絞らずに開く */ } go("users"); }}>ユーザーを見る</Btn><Btn kind="ghost sm" onClick={() => setMaking(c.companyId)}>コースを作る</Btn></span></td>
            </tr>
          );
        })}
        {!st.cos.length && <tr><td colSpan={6}><Chip>なし</Chip></td></tr>}
      </tbody></table></div></Card>
      {issue && <IssueAccounts key={issue.companyId} co={issue} users={st.users} courses={st.courses.filter(x => x.companyId === issue.companyId)} onClose={() => setIssue(null)} onRoster={() => { setRosterFor(issue); setIssue(null); }} />}
      {rosterFor && <RosterPick courses={st.courses.filter(x => x.companyId === rosterFor.companyId)} onClose={() => { setRosterFor(null); load(); }} onDone={() => { setRosterFor(null); load(); }} />}
      {adding && <AddCompany onClose={() => setAdding(false)} onDone={load} onCourse={id => { setAdding(false); setMaking(id); }} />}
      {edit && <Edit co={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); say?.("保存しました"); load(); }} />}
      {contact && <NewUser companies={st.cos} courses={st.courses} initial={{ email: contact.domain ? `@${contact.domain}` : "", role: "client", company: contact.companyId }} onClose={() => setContact(null)} onDone={() => { setContact(null); say?.("企業担当者を足しました"); load(); }} />}
      {making !== null && <CourseCreate companies={st.cos} courses={st.courses} initial={{ companyId: making }} onClose={() => setMaking(null)} onDone={(id, r) => { setMaking(null); say?.("コースを下書きで作りました"); if (id) afterMade(go, id, r); }} />}
    </div>
  );
}
