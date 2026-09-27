import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Jp } from "../textFlow.jsx";
import Kw from "../Kw.jsx";
import { signIn, signOut, confirmSignIn, resetPassword, confirmResetPassword, rememberDevice } from "aws-amplify/auth";

// テノラボのログイン（ADR 0022）。アカウントは研修管理と同じ Cognito だが、画面の上ではつながりを出さない（2026-09-27〜、別アプリとして切り離す）。
// そのため、初回のパスワード設定・二要素認証の登録・パスワードの再設定も、この画面の中で済ませる。
const PASSWORD_RULES = ["8文字以上", "英大文字", "英小文字", "数字", "記号"];
const ISSUER = "Feeps";
const RESEND_WAIT = 45;

function authError(x, fallback) {
  switch (x?.name || "") {
    case "CodeMismatchException": return "コードが一致しません。もう一度入れてください。";
    case "ExpiredCodeException": return "コードの期限が切れました。送り直してください。";
    case "InvalidPasswordException": return "パスワードが条件を満たしていません。";
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException": return "回数が多すぎます。少し時間をおいてから試してください。";
    case "InvalidParameterException": return "入力を確かめてください。";
    default: return fallback;
  }
}

export default function LoginPage({ onLoggedIn, onGo, pendingClear }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  // login | totp | totpSetup | newpw | forgot | forgotCode | forgotDone
  const [step, setStep] = useState("login");
  const [setup, setSetup] = useState({ secret: "", qr: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [bad, setBad] = useState("");
  const [wait, setWait] = useState(0);
  const waitTimer = useRef(null);

  useEffect(() => () => clearInterval(waitTimer.current), []);

  function go(next) { setStep(next); setErr(""); setNotice(""); setCode(""); setNewPw(""); setNewPw2(""); }

  async function apply(result) {
    const s = result?.nextStep?.signInStep;
    if (result?.isSignedIn || s === "DONE") {
      // この端末を覚えて、次からは確認コードを省く（覚えられない環境でもログインは続ける）
      try { await rememberDevice(); } catch (e) { /* 毎回コードを求めるだけ */ }
      await onLoggedIn();
      return;
    }
    if (s === "CONFIRM_SIGN_IN_WITH_TOTP_CODE") { go("totp"); return; }
    if (s === "CONTINUE_SIGN_IN_WITH_MFA_SELECTION") { await apply(await confirmSignIn({ challengeResponse: "TOTP" })); return; }
    if (s === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") { go("newpw"); return; }
    if (s === "CONTINUE_SIGN_IN_WITH_TOTP_SETUP") {
      const d = result.nextStep.totpSetupDetails;
      let uri = "";
      try { uri = d?.getSetupUri?.(ISSUER, email.trim())?.toString() || ""; } catch (e) { uri = ""; }
      let qr = "";
      try { qr = uri ? await QRCode.toDataURL(uri, { width: 200, margin: 1 }) : ""; } catch (e) { qr = ""; }
      setSetup({ secret: d?.sharedSecret || "", qr });
      go("totpSetup");
      return;
    }
    try { await signOut(); } catch (e) { /* 抜けられなくても案内は出す */ }
    go("login");
    setErr("このアカウントは、いまはログインできません。担当者に問い合わせてください。");
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const m = email.trim();
    if (!m) { setErr("メールアドレスを入れてください。"); setBad("mail"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) { setErr("メールアドレスの形が正しくありません。@ のあとも確かめてください。"); setBad("mail"); return; }
    if (!password) { setErr("パスワードを入れてください。"); setBad("pass"); return; }
    setErr(""); setBad(""); setBusy(true);
    try {
      try { await signOut(); } catch (x) { /* 前のセッションが無ければそのまま */ }
      await apply(await signIn({ username: m, password }));
    } catch (x) {
      const n = x?.name || "";
      if (n === "UserNotFoundException" || n === "NotAuthorizedException") setErr("メールアドレスかパスワードが違います。");
      else if (n === "UserNotConfirmedException") setErr("メールアドレスの確認がまだ終わっていません。担当者に問い合わせてください。");
      else setErr(authError(x, "ログインできませんでした。通信状況を確かめて、もう一度試してください。"));
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  // 認証アプリのコード（ログインのたび／登録の確かめ）
  async function submitCode(e) {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code.trim())) { setErr("認証アプリに出ている6桁の数字を入れてください。"); return; }
    setErr(""); setBusy(true);
    try {
      await apply(await confirmSignIn({ challengeResponse: code.trim() }));
    } catch (x) {
      if (x?.name === "NotAuthorizedException") setErr("時間が切れました。最初からログインし直してください。");
      else setErr(authError(x, "コードを確かめられませんでした。"));
    } finally {
      setBusy(false);
    }
  }

  // 初回のパスワード設定
  async function submitNewPw(e) {
    e.preventDefault();
    if (busy) return;
    if (!newPw) { setErr("新しいパスワードを入れてください。"); return; }
    if (newPw !== newPw2) { setErr("2つのパスワードが一致しません。"); return; }
    setErr(""); setBusy(true);
    try {
      await apply(await confirmSignIn({ challengeResponse: newPw }));
    } catch (x) {
      if (x?.name === "NotAuthorizedException") setErr("時間が切れました。最初からログインし直してください。");
      else setErr(authError(x, "パスワードを設定できませんでした。"));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    try { await signOut(); } catch (x) { /* 抜けられなくても入力画面へ戻す */ }
    go("login");
  }

  function startWait() {
    setWait(RESEND_WAIT);
    clearInterval(waitTimer.current);
    waitTimer.current = setInterval(() => setWait(w => { if (w <= 1) { clearInterval(waitTimer.current); return 0; } return w - 1; }), 1000);
  }

  // パスワードの再設定：メールに確認コードを送る。アカウントがあるかどうかは言わない
  async function sendReset(e) {
    if (e) e.preventDefault();
    if (busy || wait > 0) return;
    const m = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) { setErr("メールアドレスを入れてください。"); return; }
    setErr(""); setBusy(true);
    try {
      await resetPassword({ username: m });
      setStep("forgotCode"); setNotice("確認コードを送りました。"); startWait();
    } catch (x) {
      if (x?.name === "UserNotFoundException") { setStep("forgotCode"); setNotice("確認コードを送りました。"); startWait(); }
      else setErr(authError(x, "確認コードを送れませんでした。"));
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code.trim())) { setErr("メールに届いた6桁のコードを入れてください。"); return; }
    if (!newPw) { setErr("新しいパスワードを入れてください。"); return; }
    if (newPw !== newPw2) { setErr("2つのパスワードが一致しません。"); return; }
    setErr(""); setBusy(true);
    try {
      await confirmResetPassword({ username: email.trim(), confirmationCode: code.trim(), newPassword: newPw });
      go("forgotDone");
    } catch (x) {
      setErr(authError(x, "パスワードを変えられませんでした。"));
    } finally {
      setBusy(false);
    }
  }

  const pwFields = (
    <>
      <div className="fld">
        <label htmlFor="tlNew">新しいパスワード</label>
        <input className="inp" id="tlNew" type="password" autoComplete="new-password" value={newPw} onChange={e => setNewPw(e.target.value)} />
      </div>
      <div className="fld">
        <label htmlFor="tlNew2">もう一度</label>
        <input className="inp" id="tlNew2" type="password" autoComplete="new-password" value={newPw2} onChange={e => setNewPw2(e.target.value)} />
      </div>
      <Kw cls="sm" plainFirst items={PASSWORD_RULES} />
    </>
  );

  let card;
  if (step === "totp") {
    card = (
      <>
        <h1>確認コード</h1>
        <Kw items={["認証アプリ", "6桁"]} />
        <form className="fm" onSubmit={submitCode} noValidate>
          <div className="fld">
            <label htmlFor="tlCode">確認コード</label>
            <input className="inp" id="tlCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value)} />
          </div>
          {err && <div className="ferr" role="alert">{err}</div>}
          <button className="btn btn-pri" type="submit" disabled={busy}>{busy ? "確かめています…" : "ログイン"}</button>
          <button className="lnk" type="button" onClick={cancel}>やめて最初からやり直す</button>
        </form>
      </>
    );
  } else if (step === "totpSetup") {
    card = (
      <>
        <h1>認証アプリの登録</h1>
        <Kw cls="flow" items={["アプリで読み取る", "6桁を入れる", "完了"]} />
        <form className="fm" onSubmit={submitCode} noValidate>
          {setup.qr && <img className="lg-qr" src={setup.qr} width={200} height={200} alt="認証アプリで読み取るQRコード" />}
          {setup.secret && <div className="fld"><span className="lb2">読み取れないときのキー</span><code className="lg-key">{setup.secret}</code></div>}
          <div className="fld">
            <label htmlFor="tlCode">アプリに出た6桁</label>
            <input className="inp" id="tlCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value)} />
          </div>
          {err && <div className="ferr" role="alert">{err}</div>}
          <button className="btn btn-pri" type="submit" disabled={busy}>{busy ? "確かめています…" : "登録してログイン"}</button>
          <button className="lnk" type="button" onClick={cancel}>やめて最初からやり直す</button>
        </form>
      </>
    );
  } else if (step === "newpw") {
    card = (
      <>
        <h1>パスワードを決める</h1>
        <Kw items={["初回ログイン"]} />
        <form className="fm" onSubmit={submitNewPw} noValidate>
          {pwFields}
          {err && <div className="ferr" role="alert">{err}</div>}
          <button className="btn btn-pri" type="submit" disabled={busy}>{busy ? "設定しています…" : "設定してログイン"}</button>
          <button className="lnk" type="button" onClick={cancel}>やめて最初からやり直す</button>
        </form>
      </>
    );
  } else if (step === "forgot") {
    card = (
      <>
        <h1>パスワードの再設定</h1>
        <Kw cls="flow" items={["メールにコード", "新しいパスワード"]} />
        <form className="fm" onSubmit={sendReset} noValidate>
          <div className="fld">
            <label htmlFor="tlMail">メールアドレス</label>
            <input className="inp" id="tlMail" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {err && <div className="ferr" role="alert">{err}</div>}
          <button className="btn btn-pri" type="submit" disabled={busy}>{busy ? "送っています…" : "確認コードを送る"}</button>
          <button className="lnk" type="button" onClick={() => go("login")}>ログインにもどる</button>
        </form>
      </>
    );
  } else if (step === "forgotCode") {
    card = (
      <>
        <h1>新しいパスワード</h1>
        <Kw items={[email.trim(), "6桁のコード"]} />
        <form className="fm" onSubmit={submitReset} noValidate>
          {notice && <div className="info" role="status">{notice}</div>}
          <div className="fld">
            <label htmlFor="tlCode">メールに届いたコード</label>
            <input className="inp" id="tlCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value)} />
          </div>
          {pwFields}
          {err && <div className="ferr" role="alert">{err}</div>}
          <button className="btn btn-pri" type="submit" disabled={busy}>{busy ? "変えています…" : "パスワードを変える"}</button>
          <button className="lnk" type="button" disabled={busy || wait > 0} onClick={() => sendReset()}>{wait > 0 ? `コードを送り直す（${wait}秒後）` : "コードを送り直す"}</button>
        </form>
      </>
    );
  } else if (step === "forgotDone") {
    card = (
      <>
        <h1>パスワードを変えました</h1>
        <Kw items={["新しいパスワードでログイン"]} />
        <div className="fm"><button className="btn btn-pri" type="button" onClick={() => go("login")}>ログインへ</button></div>
      </>
    );
  } else {
    card = (
      <>
        <h1>おかえりなさい</h1>
        <Kw items={pendingClear ? ["ログインで単元2のクリアを保存"] : ["続きから再開", "どの端末でも"]} />
        <form className="fm" onSubmit={submit} noValidate>
          <div className="fld">
            <label htmlFor="tlMail">メールアドレス</label>
            <input className="inp" id="tlMail" type="email" autoComplete="username" value={email} aria-invalid={bad === "mail" || undefined} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="fld">
            <label htmlFor="tlPass">パスワード</label>
            <div className="pw">
              <input className="inp" id="tlPass" type={showPw ? "text" : "password"} autoComplete="current-password" value={password} aria-invalid={bad === "pass" || undefined} onChange={e => setPassword(e.target.value)} />
              <button type="button" aria-controls="tlPass" aria-pressed={showPw} onClick={() => setShowPw(v => !v)}>{showPw ? "隠す" : "表示"}</button>
            </div>
          </div>
          {err && <div className="ferr" role="alert">{err}</div>}
          <button className="btn btn-pri" type="submit" disabled={busy}>{busy ? "ログインしています…" : "ログイン"}</button>
          <button className="lnk" type="button" onClick={() => go("forgot")}>パスワードを忘れた方</button>
        </form>
        <div className="or"><span><Jp>アカウントをお持ちでない方</Jp></span></div>
        <Kw cls="sm" plainFirst items={["アカウントは担当者から", "登録なしで1単元"]} />
      </>
    );
  }

  return (
    <div className="tl-app">
      <section className="grid-bg tl-login" aria-label="ログイン">
        <div className="wrap">
          <header className="lg-top">
            <a className="logo" href="#/" onClick={e => { e.preventDefault(); onGo("lp"); }} aria-label="テノラボ トップへ">
              <span className="w">テノ<span className="sw">ラボ</span></span><span className="by">by Feeps</span>
            </a>
            <span className="sp" />
            <span className="lg-new">はじめての方は <a href="#/try" onClick={e => { e.preventDefault(); onGo("try"); }}>登録なしで1単元さわる</a></span>
          </header>

          <main className="lg">
            <div className="lg-card">{card}</div>

            <aside className="lg-side" aria-label="ログインするとできること">
              <h2>書きかけのコードは、<br /><span className="mk">そのまま</span>待っています。</h2>
              <ul className="lg-list">
                <li><span className="ic" aria-hidden="true">1</span><div><b>前回の続きから始まる</b></div></li>
                <li><span className="ic" aria-hidden="true">2</span><div><b>自分のアプリが育っていく</b></div></li>
                <li><span className="ic" aria-hidden="true">3</span><div><b>どの端末でも同じ続き</b></div></li>
              </ul>
            </aside>
          </main>
        </div>
      </section>
    </div>
  );
}
