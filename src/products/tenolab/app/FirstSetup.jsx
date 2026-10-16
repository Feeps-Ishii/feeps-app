import React, { useEffect, useState } from "react";
import { confirmUserAttribute, fetchAuthSession, fetchUserAttributes, sendUserAttributeVerificationCode, updateUserAttributes } from "aws-amplify/auth";
import { apiPut } from "../../../api.js";

/* はじめての設定（2026-10-16）。管理者がまとめて発行した仮のID（@id.devhub-lms.com）で入った人は、
   パスワードを変えたあと、ここで名前とメールアドレスを登録する。メールに届く確認コードで確定し、
   以後はそのメールアドレスでログインする（パスワードを忘れても本人がメールで再設定できる）。
   途中でやめても、次にログインしたときにここへ戻る（profile.placeholder が外れるまで） */
const PLACEHOLDER = /@id\.devhub-lms\.com$/i;
const errText = e => {
  const n = e?.name || "";
  if (n === "AliasExistsException") return "このメールアドレスはもう使われています。別のメールアドレスを入れてください。";
  if (n === "CodeMismatchException") return "確認コードがちがいます。メールの6けたの数字を入れてください。";
  if (n === "ExpiredCodeException") return "確認コードの期限が切れました。「コードを送り直す」を押してください。";
  if (n === "LimitExceededException" || n === "TooManyRequestsException") return "回数が多すぎます。しばらくしてからもう一度お試しください。";
  if (n === "InvalidParameterException") return "メールアドレスの形が正しくありません。";
  return e?.message || "うまくいきませんでした。もう一度お試しください。";
};

export default function FirstSetup({ name: initialName, onDone }) {
  const [step, setStep] = useState("loading");
  const [name, setName] = useState(/^受講者\d*$/.test(initialName || "") ? "" : initialName || "");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });

  // メールアドレスを変えたあと確認コードを入れずにやめた人は、コードの画面から
  useEffect(() => {
    fetchUserAttributes().then(a => {
      if (a?.email && !PLACEHOLDER.test(a.email) && a.email_verified !== "true") { setEmail(a.email); setStep("code"); }
      else setStep("form");
    }).catch(() => setStep("form"));
  }, []);

  async function sendForm(e) {
    e.preventDefault();
    const n = name.trim(), m = email.trim().toLowerCase();
    if (!n) { setMsg({ kind: "ng", text: "お名前を入れてください。" }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m) || PLACEHOLDER.test(m)) { setMsg({ kind: "ng", text: "ふだん使うメールアドレスを入れてください。" }); return; }
    setBusy(true); setMsg({ kind: "", text: "" });
    try {
      await apiPut("/profile/me", { name: n }).catch(() => {});
      await updateUserAttributes({ userAttributes: { email: m } });
      setEmail(m); setStep("code");
      setMsg({ kind: "ok", text: `${m} に確認コードを送りました。` });
    } catch (er) { setMsg({ kind: "ng", text: errText(er) }); } finally { setBusy(false); }
  }
  async function sendCode(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) { setMsg({ kind: "ng", text: "メールに届いた6けたの数字を入れてください。" }); return; }
    setBusy(true); setMsg({ kind: "", text: "" });
    try {
      await confirmUserAttribute({ userAttributeKey: "email", confirmationCode: code.trim() });
      await fetchAuthSession({ forceRefresh: true });
      await apiPut("/profile/me", name.trim() ? { name: name.trim() } : {});
      onDone?.();
    } catch (er) { setMsg({ kind: "ng", text: errText(er) }); setBusy(false); }
  }
  async function resend() {
    setBusy(true); setMsg({ kind: "", text: "" });
    try { await sendUserAttributeVerificationCode({ userAttributeKey: "email" }); setMsg({ kind: "ok", text: `${email} に確認コードを送り直しました。` }); }
    catch (er) { setMsg({ kind: "ng", text: errText(er) }); } finally { setBusy(false); }
  }

  return (
    <section className="card" style={{ maxWidth: 520, margin: "32px auto", padding: "26px 28px", display: "grid", gap: 16 }}>
      <div>
        <div className="eyebrow">はじめての設定</div>
        <h1 className="h1" style={{ margin: "6px 0 0", fontSize: 24 }}>{step === "code" ? "確認コードを入れてください" : "お名前とメールアドレスを登録します"}</h1>
      </div>
      {step === "loading" && <p className="muted">読み込んでいます…</p>}
      {step === "form" && (
        <form onSubmit={sendForm} style={{ display: "grid", gap: 12 }}>
          <label className="mfield"><span>お名前</span><input id="fs-name" value={name} onChange={e => setName(e.target.value.slice(0, 40))} autoComplete="name" placeholder="山田 太郎" /></label>
          <label className="mfield"><span>メールアドレス（次からのログインに使います）</span><input id="fs-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="name@example.co.jp" /></label>
          <button type="submit" className="btn" disabled={busy} style={{ justifySelf: "end" }}>{busy ? "送っています…" : "確認コードを送る"}</button>
        </form>
      )}
      {step === "code" && (
        <form onSubmit={sendCode} style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0 }}><b>{email}</b> に届いた6けたの数字を入れてください。</p>
          <label className="mfield"><span>確認コード</span><input id="fs-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" /></label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button type="button" className="btn ghost" disabled={busy} onClick={resend}>コードを送り直す</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => { setStep("form"); setCode(""); setMsg({ kind: "", text: "" }); }}>メールアドレスを直す</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "確かめています…" : "登録する"}</button>
          </div>
        </form>
      )}
      {msg.text && <div className={`verdict ${msg.kind}`} role={msg.kind === "ng" ? "alert" : "status"}>{msg.text}</div>}
    </section>
  );
}
