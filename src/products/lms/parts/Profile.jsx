import React, { useEffect, useState } from "react";
import { updatePassword } from "aws-amplify/auth";
import { apiGet, apiPut } from "../../../api.js";
import { MfaSettingsCard, useMfaStatus } from "../../auth/MfaSetup.jsx";
import { Btn, Card, Chip, Modal } from "./ui.jsx";
import { Face } from "./Notif.jsx";

/* プロフィール（モック profile）：基本の情報とパスワード。名前を直せない受講生は講師に伝える。メールはログインの ID なのでここでは変えない */

const arr = v => (Array.isArray(v) ? v : []);
const PW_ERR = { NotAuthorizedException: "いまのパスワードが違います", InvalidPasswordException: "新しいパスワードの決まりに合っていません", LimitExceededException: "回数が多すぎます。少し待ってください" };
const RULES = ["8文字以上", "英大文字", "英小文字", "数字", "記号"];

function Password({ say }) {
  const [v, setV] = useState({ now: "", next: "", again: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const f = k => e => setV(x => ({ ...x, [k]: e.target.value }));
  const save = async e => {
    e.preventDefault();
    if (!v.now || !v.next) { setErr("パスワードを入れてください"); return; }
    if (v.next !== v.again) { setErr("新しいパスワードが 2 回で違います"); return; }
    setBusy(true); setErr("");
    try { await updatePassword({ oldPassword: v.now, newPassword: v.next }); say?.("パスワードを変えました"); setV({ now: "", next: "", again: "" }); }
    catch (x) { setErr(PW_ERR[x?.name] || "変えられませんでした"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="st-g">
      <label className="field">いまのパスワード<input type="password" autoComplete="current-password" value={v.now} onChange={f("now")} /></label>
      <label className="field">新しいパスワード<input type="password" autoComplete="new-password" placeholder="8文字以上" value={v.next} onChange={f("next")} /></label>
      <div className="row">{RULES.map(x => <Chip key={x}>{x}</Chip>)}</div>
      <label className="field">もう一度<input type="password" autoComplete="new-password" value={v.again} onChange={f("again")} /></label>
      {err && <div className="lms-err" role="alert">{err}</div>}
      <span className="row st-end"><button type="submit" className="btn" disabled={busy}>パスワードを変える</button></span>
    </form>
  );
}

function Mfa({ role, email }) {
  const { status } = useMfaStatus(true);
  const [open, setOpen] = useState(false);
  const on = status === "enabled";
  return (
    <div className="li"><span>二要素認証</span>
      {role === "trainee" && !on ? <Chip>使っていません</Chip> : <span className="row">{on && <Chip tone="ok">使っています</Chip>}<Btn kind="ghost sm" onClick={() => setOpen(true)}>{on ? "直す" : "設定する"}</Btn></span>}
      {open && <Modal title="二要素認証" width={560} onClose={() => setOpen(false)} footer={<Btn kind="ghost" onClick={() => setOpen(false)}>閉じる</Btn>}><div className="lms-legacy"><MfaSettingsCard email={email} /></div></Modal>}
    </div>
  );
}

export default function Profile({ role, label, initialTab = "info", say }) {
  const [tab, setTab] = useState(initialTab);
  const [st, setSt] = useState({ state: "loading", p: null, co: "", courses: [] });
  const [key, setKey] = useState(0);
  const [name, setName] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    Promise.all([
      apiGet("/profile/me"),
      apiGet(role === "trainee" ? "/me/courses" : "/completion-report/courses").then(r => arr(r?.courses || r)).catch(() => null),
      apiGet("/companies").then(arr).catch(() => []),
    ]).then(([p, courses, cos]) => { if (alive) { setSt({ state: "ready", p, courses, co: cos.find(c => c.companyId === p?.company)?.name || "" }); setName(p?.name || ""); } })
      .catch(() => { if (alive) setSt({ state: "error", p: null, co: "", courses: [] }); });
    return () => { alive = false; };
  }, [role, key]);
  if (st.state === "loading") return <div className="soon card">読み込み中</div>;
  if (st.state === "error") return <Card><div className="empty"><b>プロフィールを確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card>;
  const p = st.p || {}, locked = role === "trainee" && !!String(p.name || "").trim() && p.nameEditable !== true;
  const save = async () => {
    setBusy(true); setErr("");
    try { await apiPut("/profile/me", { name: name.trim() }); say?.("保存しました"); setKey(k => k + 1); }
    catch (e) { setErr(e?.message || "保存できませんでした"); } finally { setBusy(false); }
  };
  const courseNames = arr(st.courses).map(c => c.name || c.courseName).filter(Boolean).join(" ・ ");
  return (
    <div className="st">
      <div className="head"><h1 className="h1">プロフィール</h1></div>
      <div className="side">
        <div className="card pick">{[["info", "基本の情報"], ["pw", "パスワード"]].map(([k, t]) => <button key={k} type="button" className="nf" aria-current={tab === k} onClick={() => setTab(k)}><span><b>{t}</b></span></button>)}</div>
        <Card className="pad st-g">
          <div className="head"><span className="ua-n pf-h"><Face name={p.name} size={48} /><span><h2 className="h2">{p.name || "名前未設定"}</h2><small className="adsm">{label}</small></span></span></div>
          {tab === "pw" ? <Password say={say} /> : (
            <>
              <div className="g2e"><label className="field">お名前<input type="text" maxLength={40} disabled={locked} value={name} onChange={e => setName(e.target.value)} /></label><label className="field">メールアドレス<input type="text" disabled value={p.email || p.username || ""} /></label></div>
              {locked && <div className="row"><Chip>名前を直すときは講師へ</Chip></div>}
              <div className="list">
                <div className="li"><span>ロール</span><Chip tone="mk">{label}</Chip></div>
                {st.co && <div className="li"><span>企業</span><span>{st.co}</span></div>}
                {role !== "admin" && <div className="li"><span>{role === "trainee" ? "コース" : "担当のコース"}</span>{st.courses === null ? <Chip>確認できません</Chip> : <span>{courseNames || "—"}</span>}</div>}
                <Mfa role={role} email={p.email || ""} />
              </div>
              {err && <div className="lms-err" role="alert">{err}</div>}
              {!locked && <span className="row st-end"><Btn disabled={busy || !name.trim() || name.trim() === p.name} onClick={save}>保存</Btn></span>}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
