import React, { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { Btn, Card, Chip, Modal } from "../parts/ui.jsx";
import { arr, errText } from "../staff/common.js";
import CourseCreate from "./CourseCreate.jsx";
import { NewUser, makeTemp } from "./Users.jsx";

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
              <td><span className="row st-nw"><Btn kind="ghost sm" onClick={() => { try { sessionStorage.setItem("lms.userCompany", c.name); } catch { /* 絞らずに開く */ } go("users"); }}>ユーザーを見る</Btn><Btn kind="ghost sm" onClick={() => setMaking(c.companyId)}>コースを作る</Btn></span></td>
            </tr>
          );
        })}
        {!st.cos.length && <tr><td colSpan={6}><Chip>なし</Chip></td></tr>}
      </tbody></table></div></Card>
      {adding && <AddCompany onClose={() => setAdding(false)} onDone={load} onCourse={id => { setAdding(false); setMaking(id); }} />}
      {edit && <Edit co={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); say?.("保存しました"); load(); }} />}
      {contact && <NewUser companies={st.cos} courses={st.courses} initial={{ email: contact.domain ? `@${contact.domain}` : "", role: "client", company: contact.companyId }} onClose={() => setContact(null)} onDone={() => { setContact(null); say?.("企業担当者を足しました"); load(); }} />}
      {making !== null && <CourseCreate companies={st.cos} courses={st.courses} initial={{ companyId: making }} onClose={() => setMaking(null)} onDone={(id, r) => { setMaking(null); say?.("コースを下書きで作りました"); if (id) afterMade(go, id, r); }} />}
    </div>
  );
}
