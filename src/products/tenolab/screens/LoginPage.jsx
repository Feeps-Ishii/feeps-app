import React, { useState } from "react";
import { signIn, signOut, confirmSignIn } from "aws-amplify/auth";

// テノラボのログイン。アカウントは Feeps One と共通（ADR 0022）。
// 初回のパスワード設定・二要素認証の登録・規約への同意は Feeps One の画面にしかないので、
// その段階に来たら Feeps One のログインへ案内する（ここで作り直さない）。
const FEEPS_ONE_LOGIN = "/index.html";

export default function LoginPage({ onLoggedIn, onGo, pendingClear }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [step, setStep] = useState("login"); // login | totp | elsewhere
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [bad, setBad] = useState("");
  const [forgot, setForgot] = useState(false);

  async function apply(result) {
    const s = result?.nextStep?.signInStep;
    if (result?.isSignedIn || s === "DONE") { await onLoggedIn(); return; }
    if (s === "CONFIRM_SIGN_IN_WITH_TOTP_CODE") { setStep("totp"); setErr(""); return; }
    if (s === "CONTINUE_SIGN_IN_WITH_MFA_SELECTION") { await apply(await confirmSignIn({ challengeResponse: "TOTP" })); return; }
    // 初回パスワード・二要素認証の登録など。途中のままにせず、いったん抜けてから案内する
    try { await signOut(); } catch (e) { /* 抜けられなくても案内は出す */ }
    setStep("elsewhere");
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
      else if (n === "UserNotConfirmedException") setErr("メールアドレスの確認がまだ終わっていません。Feeps One のログイン画面から確認してください。");
      else setErr(x?.message || "ログインできませんでした。通信状況を確かめて、もう一度試してください。");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code.trim())) { setErr("認証アプリに出ている6桁の数字を入れてください。"); return; }
    setErr(""); setBusy(true);
    try {
      await apply(await confirmSignIn({ challengeResponse: code.trim() }));
    } catch (x) {
      const n = x?.name || "";
      if (n === "CodeMismatchException") setErr("コードが一致しません。認証アプリの表示を確かめて、もう一度入れてください。");
      else if (n === "NotAuthorizedException") setErr("時間が切れました。最初からログインし直してください。");
      else setErr(x?.message || "コードを確かめられませんでした。");
    } finally {
      setBusy(false);
    }
  }

  async function cancelCode() {
    try { await signOut(); } catch (x) { /* 抜けられなくても入力画面へ戻す */ }
    setStep("login"); setCode(""); setErr("");
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
            <div className="lg-card">
              {step === "elsewhere" ? (
                <>
                  <h1>最初の設定が必要です</h1>
                  <p className="sub">初回のパスワード設定や、二要素認証の登録がまだのアカウントです。Feeps One の画面で設定を済ませると、テノラボにも同じアカウントで入れます。</p>
                  <div className="fm">
                    <a className="btn btn-pri" href={FEEPS_ONE_LOGIN}>Feeps One で設定する</a>
                    <button className="lnk" type="button" onClick={() => setStep("login")}>ログイン画面にもどる</button>
                  </div>
                </>
              ) : step === "totp" ? (
                <>
                  <h1>確認コード</h1>
                  <p className="sub">認証アプリに出ている6桁の数字を入れてください。</p>
                  <form className="fm" onSubmit={submitCode} noValidate>
                    <div className="fld">
                      <label htmlFor="tlCode">確認コード</label>
                      <input className="inp" id="tlCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value)} />
                    </div>
                    {err && <div className="ferr" role="alert">{err}</div>}
                    <button className="btn btn-pri" type="submit" disabled={busy}>{busy ? "確かめています…" : "ログイン"}</button>
                    <button className="lnk" type="button" onClick={cancelCode}>やめて最初からやり直す</button>
                  </form>
                </>
              ) : (
                <>
                  <h1>おかえりなさい</h1>
                  <p className="sub">{pendingClear ? "ログインすると、さっきの単元2のクリアを残します。" : "Feeps One と同じアカウントで入れます。前回書いたコードの続きから始まります。"}</p>
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
                    <button className="lnk" type="button" onClick={() => setForgot(true)}>パスワードを忘れた方</button>
                    {forgot && <div className="info" role="status">パスワードの決め直しは、<a href={FEEPS_ONE_LOGIN}>Feeps One のログイン画面</a>の「パスワードを忘れた方」からできます。決め直したパスワードで、テノラボにも入れます。</div>}
                  </form>
                  <div className="or"><span>アカウントをお持ちでない方</span></div>
                  <p className="lg-new" style={{ margin: 0 }}>アカウントは、会社や研修の担当者から届きます。まずは登録なしで、単元を1つ試せます。</p>
                </>
              )}
            </div>

            <aside className="lg-side" aria-label="ログインするとできること">
              <h2>書きかけのコードは、<br /><span className="mk">そのまま</span>待っています。</h2>
              <ul className="lg-list">
                <li><span className="ic" aria-hidden="true">1</span><div><b>前回の続きから始まる</b><span>止めた単元の、止めたステップから。書いたコードも残っています。</span></div></li>
                <li><span className="ic" aria-hidden="true">2</span><div><b>自分のアプリが育っていく</b><span>単元を終えるたびに部品が増えて、最後に1本のアプリが手元に残ります。</span></div></li>
                <li><span className="ic" aria-hidden="true">3</span><div><b>どの端末でも同じ続き</b><span>記録は保存されるので、会社のPCでも家のPCでも続きから始められます。</span></div></li>
              </ul>
            </aside>
          </main>
        </div>
      </section>
    </div>
  );
}
