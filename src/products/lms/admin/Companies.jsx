import React, { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { Btn, Card, Chip, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, errText } from "../staff/common.js";

/* 管理者の企業（モック coA）：一覧・足す・直す。企業担当者と受講生の数はユーザーから数える。「ユーザーを見る」はその企業で絞る */

function Edit({ co, onClose, onDone }) {
  const [v, setV] = useState({ name: co?.name || "", memo: co?.memo || co?.note || "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [del, setDel] = useState(false);
  const f = (k, x) => setV(s => ({ ...s, [k]: x }));
  const run = async fn => { setBusy(true); setErr(""); try { await fn(); onDone(); } catch (e) { setErr(errText(e, "うまくいきませんでした")); setBusy(false); } };
  return (
    <Modal title={co ? "企業を直す" : "企業を足す"} width={460} onClose={onClose} footer={<>{co && (!del ? <Btn kind="ghost" onClick={() => setDel(true)}>消す</Btn> : <Btn disabled={busy} onClick={() => run(() => apiDelete(`/companies/${co.companyId}`))}>本当に消す</Btn>)}<Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy || !v.name.trim()} onClick={() => run(() => (co ? apiPut(`/companies/${co.companyId}`, { name: v.name.trim(), memo: v.memo.trim() }) : apiPost("/companies", { name: v.name.trim(), note: v.memo.trim() })))}>決める</Btn></>}>
      <label className="field">名前<input type="text" autoFocus value={v.name} onChange={e => f("name", e.target.value)} /></label>
      <label className="field">メモ<textarea rows={2} value={v.memo} onChange={e => f("memo", e.target.value)} /></label>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

export default function AdminCompanies({ go, say }) {
  const [st, setSt] = useState({ state: "loading", cos: [], users: [], courses: [] });
  const [edit, setEdit] = useState(undefined); // undefined=閉じる / null=足す
  const [q, setQ] = useState(""); const [sort, setSort] = useState("name");
  const load = useCallback(() => {
    Promise.all([apiGet("/companies"), apiGet("/admin/users"), apiGet("/admin/course-overview").catch(() => ({ courses: [] }))])
      .then(([c, u, o]) => setSt({ state: "ready", cos: arr(c).filter(x => !x.deleted), users: arr(u), courses: arr(o?.courses) }))
      .catch(() => setSt({ state: "error", cos: [], users: [], courses: [] }));
  }, []);
  useEffect(load, [load]);
  if (st.state === "loading") return <div className="soon card">読み込み中</div>;
  if (st.state === "error") return <Card><div className="empty"><b>企業を確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div></Card>;
  const rows = st.cos.map(c => {
    const us = st.users.filter(u => u.company === c.companyId);
    return { c, contacts: us.filter(u => u.role === "client"), trainees: us.filter(u => u.role === "trainee").length, courses: st.courses.filter(x => x.companyId === c.companyId) };
  });
  const list = rows.filter(r => matchName(r.c.name, "", q)).sort(sort === "ppl" ? (a, b) => b.trainees - a.trainees : (a, b) => String(a.c.name).localeCompare(String(b.c.name), "ja"));
  const cats = ["tm", "att", "cur", "tst", "rep"];
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">企業 {st.cos.length}</div><h1 className="h1">企業</h1></div><span className="r"><Btn kind="sm" onClick={() => setEdit(null)}>企業を足す</Btn></span></div>
      <ListTool q={q} onQ={setQ} placeholder="企業を探す" sorts={[["name", "名前順"], ["ppl", "受講生の多い順"]]} sort={sort} onSort={setSort} />
      <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>企業</th><th>企業担当者</th><th>受講生</th><th>コース</th><th /></tr></thead><tbody>
        {list.map(({ c, contacts, trainees, courses }, i) => (
          <tr key={c.companyId}>
            <td><span className="ua-n"><span className={`co-av c-${cats[i % 5]}`}>{String(c.name).slice(0, 1)}</span><b>{c.name}</b></span></td>
            <td>{contacts.length ? contacts.map(u => u.name).join("・") : <Chip tone="warn">未設定</Chip>}</td>
            <td className="num">{trainees} 人</td>
            <td>{courses.length ? <span className="co-cs">{courses.map(x => <span key={x.courseId}>{x.name}</span>)}</span> : "—"}</td>
            <td><span className="row st-nw"><Btn kind="ghost sm" onClick={() => { try { sessionStorage.setItem("lms.userCompany", c.name); } catch { /* 絞らずに開く */ } go("users"); }}>ユーザーを見る</Btn><Btn kind="ghost sm" onClick={() => setEdit(c)}>直す</Btn></span></td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={5}><Chip>なし</Chip></td></tr>}
      </tbody></table></div></Card>
      {edit !== undefined && <Edit co={edit} onClose={() => setEdit(undefined)} onDone={() => { setEdit(undefined); say?.("保存しました"); load(); }} />}
    </div>
  );
}
