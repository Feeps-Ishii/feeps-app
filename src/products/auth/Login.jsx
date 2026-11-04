import React, { useState, useRef, useEffect } from "react";
import { signIn, signOut, confirmSignIn, resetPassword, confirmResetPassword, rememberDevice } from "aws-amplify/auth";
import { DevHubMark } from "../../components/common/DevHubMark.jsx";
import { StandaloneLegalPage } from "../../components/common/LegalPages.jsx";
import { TotpSetupPanel, TotpChallengePanel } from "./MfaSetup.jsx";
import { TermsCheckbox, recordTermsAgreement } from "../../components/common/TermsConsent.jsx";
import { Btn, Modal } from "../lms/parts/ui.jsx";
import "../lms/lms.css";
import "./loginSage.css";

// Cognito User Pool (ap-northeast-1_QG4KZb06z) の実設定を確認のうえ表示（Phase7-4b）。
// ハードコードではなく、実際のPasswordPolicy（MinimumLength:8, RequireUppercase/Lowercase/Numbers/Symbols:true）と一致させている。
const PASSWORD_REQUIREMENTS = [["8 文字以上", v => v.length >= 8], ["英大文字", v => /[A-Z]/.test(v)], ["英小文字", v => /[a-z]/.test(v)], ["数字", v => /\d/.test(v)], ["記号", v => /[^A-Za-z0-9]/.test(v)]];

const RESEND_COOLDOWN_SECONDS = 45;

// Cognitoの生エラー名を自然な日本語へ変換する。stack traceや生のエラー名は表示しない。
function friendlyAuthError(e) {
  const n = e?.name || "";
  switch (n) {
    case "CodeMismatchException": return "確認コードが正しくありません。";
    case "ExpiredCodeException": return "確認コードの有効期限が切れています。再送してください。";
    case "InvalidPasswordException": return "パスワードが条件を満たしていません。";
    case "LimitExceededException": return "試行回数が多すぎます。時間を置いて再度お試しください。";
    case "TooManyRequestsException": return "リクエストが多すぎます。時間を置いて再度お試しください。";
    case "TooManyFailedAttemptsException": return "試行回数が多すぎます。時間を置いて再度お試しください。";
    case "UserNotFoundException": return null; // 呼び出し元で汎用メッセージへ差し替える
    case "NotAuthorizedException": return "パスワード再設定を利用できません。管理者へお問い合わせください。";
    case "InvalidParameterException": return "入力内容を確認してください。";
    default: return e?.message ? "処理に失敗しました。時間をおいて再度お試しください。" : "処理に失敗しました。";
  }
}

// 2026-11-04: ログインをセージに（モック loginPage）。左にロゴ・ひとこと・PC とスマホの絵、右に入力。ログインの処理は変えない
const KINDS = [["日報", "rep"], ["勤怠", "att"], ["カリキュラム", "cur"], ["テスト", "tst"], ["個人開発", "dev"], ["チーム", "tm"]];
const FLOW = [["出勤", "09:02", "d"], ["今日の目標", "済", "d"], ["単元を学ぶ", "いま", "n"], ["練習問題", "0 / 3", ""], ["日報", "18:00 まで", ""]];
function FlowRows({ rows }) {
  return rows.map(([t, v, k]) => <span key={t} className={k}><i />{t}<em>{v}</em></span>);
}
function Devices() {
  return (
    <div className="ldev" aria-hidden="true">
      <span className="lmp">マルチプラットフォーム対応</span>
      <div className="ldev-art">
        <div className="dv-pc">
          <div className="dv-scr">
            <div className="dm-bar"><i className="dm-logo" /><b>DevHub <em>LMS</em></b><span className="dm-nav"><u className="on">毎日</u><u>研修</u><u>自分用</u></span><i className="dm-me" /></div>
            <div className="dm-body">
              <div className="dm-hero"><small>次にやること</small><b>単元を学ぶ</b><span>Spring Boot ② REST API</span><i className="dm-btn">スライドを開く</i></div>
              <div className="dm-flow"><small>今日の流れ</small><FlowRows rows={FLOW} /></div>
              <div className="dm-flow"><small>締め切り</small><span>確認テスト Spring 基礎<em className="w">あと 2 日</em></span><span>練習問題 問題 7〜9<em className="w">あと 2 日</em></span></div>
              <div className="dm-flow"><small>お知らせ</small><span><i className="mk" />明日は 10時開始です</span><span><i className="co" />配属面談の日程について</span></div>
            </div>
          </div>
          <div className="dv-base" />
        </div>
        <div className="dv-ph">
          <div className="dv-pscr">
            <i className="dv-notch" />
            <div className="dm-bar sm"><i className="dm-logo" /><b>DevHub</b><i className="dm-me" /></div>
            <div className="dm-hero sm"><small>次にやること</small><b>単元を学ぶ</b><i className="dm-btn">スライドを開く</i></div>
            <div className="dm-flow sm"><FlowRows rows={FLOW.slice(0, 4)} /></div>
            <div className="dm-bnav"><span className="on" /><span /><span /><span /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pw({ label, value, onChange, onEnter, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <label className="lg-f">
      <span>{label}</span>
      <span className="lg-pw">
        <input type={show ? "text" : "password"} value={value} placeholder={placeholder} autoComplete={autoComplete} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && onEnter) onEnter(); }} />
        <button type="button" aria-pressed={show} aria-label={show ? "パスワードを隠す" : "パスワードを表示"} onClick={() => setShow(v => !v)}>{show ? "隠す" : "表示"}</button>
      </span>
    </label>
  );
}
function Rules({ value }) {
  return <div className="lg-rl" aria-label="パスワードの条件">{PASSWORD_REQUIREMENTS.map(([t, ok]) => <span key={t} className={ok(value) ? "on" : ""}><i aria-hidden="true">{ok(value) ? "✓" : ""}</i>{t}</span>)}</div>;
}
function Steps({ k }) {
  return <ol className="lg-st" aria-label="手順">{["メール", "コード", "完了"].map((t, i) => <li key={t} className={i < k ? "dn" : i === k ? "on" : ""}><i className="num">{i < k ? "✓" : i + 1}</i>{t}</li>)}</ol>;
}
// 確認コード 6 桁。貼り付けと、打つと次の桁へ
function Otp({ value, onChange }) {
  const refs = useRef([]);
  const set = (i, v) => {
    const digits = v.replace(/\D/g, "");
    if (!digits) { onChange(value.slice(0, i) + value.slice(i + 1)); return; }
    const next = (value.slice(0, i) + digits + value.slice(i + digits.length)).slice(0, 6);
    onChange(next);
    refs.current[Math.min(i + digits.length, 5)]?.focus();
  };
  return (
    <div className="lg-otp">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <input key={i} ref={el => { refs.current[i] = el; }} type="text" inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} aria-label={`${i + 1} 桁目`} className={value.length === i ? "on" : ""} value={value[i] || ""}
          onChange={e => set(i, e.target.value)} onKeyDown={e => { if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus(); }} />
      ))}
    </div>
  );
}

/* ===== パスワード再設定フロー（Step1: メール入力→Step2: コード+新パスワード→Step3: 完了） ===== */
function ForgotPasswordFlow({ onBack, startStep = "email" }) {
  const [step, setStep] = useState(startStep); // "email" | "code" | "done"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef(null);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(cooldownTimer.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function sendCode() {
    if (busy || cooldown > 0) return;
    setErr(""); setNotice("");
    if (!email.trim()) { setErr("メールアドレスを入力してください。"); return; }
    setBusy(true);
    try {
      await resetPassword({ username: email.trim() });
      setStep("code");
      setNotice("入力されたメールアドレスを確認し、再設定の案内を送信しました。");
      startCooldown();
    } catch (e) {
      // セキュリティ上、アカウントの有無は明示しない（UserNotFoundExceptionも同じ案内で次のステップへ進める）。
      if (e?.name === "UserNotFoundException") {
        setStep("code");
        setNotice("入力されたメールアドレスを確認し、再設定の案内を送信しました。");
        startCooldown();
      } else {
        setErr(friendlyAuthError(e) || "確認コードの送信に失敗しました。");
      }
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (busy || cooldown > 0) return;
    setErr(""); setNotice("");
    setBusy(true);
    try {
      await resetPassword({ username: email.trim() });
      setNotice("確認コードを再送しました。");
      startCooldown();
    } catch (e) {
      if (e?.name === "UserNotFoundException") { setNotice("確認コードを再送しました。"); startCooldown(); }
      else setErr(friendlyAuthError(e) || "確認コードの再送に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPassword() {
    if (busy) return;
    setErr(""); setNotice("");
    if (!code.trim()) { setErr("確認コードを入力してください。"); return; }
    if (!newPw) { setErr("新しいパスワードを入力してください。"); return; }
    if (newPw !== newPw2) { setErr("新しいパスワードが一致しません。"); return; }
    setBusy(true);
    try {
      await confirmResetPassword({ username: email.trim(), confirmationCode: code.trim(), newPassword: newPw });
      // 成功後はパスワード・コードのstateを破棄する。
      setCode(""); setNewPw(""); setNewPw2("");
      setStep("done");
    } catch (e) {
      setErr(friendlyAuthError(e) || "パスワードの再設定に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <>
        <span className="eyebrow">パスワード再設定</span>
        <h1 className="lg-h">変更完了</h1>
        <Steps k={3} />
        <div className="lg-ok" role="status"><span className="lg-oki" aria-hidden="true">✓</span><b>パスワード変更済み</b><span>他の端末は再ログイン</span></div>
        <Btn kind="big full" onClick={onBack}>ログインへ</Btn>
      </>
    );
  }

  if (step === "code") {
    return (
      <>
        <span className="eyebrow">パスワード再設定</span>
        <h1 className="lg-h">確認コード入力</h1>
        <Steps k={1} />
        <div className="lg-kv"><span>送信先</span><b>{email}</b></div>
        {notice && <div className="lg-msg" role="status" aria-live="polite">{notice}</div>}
        {err && <div className="lg-err" role="alert"><b>{err}</b></div>}
        <Otp value={code} onChange={setCode} />
        <Pw label="新しいパスワード" value={newPw} onChange={setNewPw} placeholder="8 文字以上" autoComplete="new-password" />
        <Rules value={newPw} />
        <Pw label="新しいパスワード（確認）" value={newPw2} onChange={setNewPw2} onEnter={submitNewPassword} placeholder="確認用" autoComplete="new-password" />
        <Btn kind="big full" disabled={busy} aria-busy={busy} onClick={submitNewPassword}>{busy ? "変更中" : "パスワードを変更"}</Btn>
        <span className="lg-sec">
          <button type="button" className="lg-lk" onClick={() => { setErr(""); setNotice(""); setStep("email"); }}>メールアドレスを変更</button>
          <button type="button" className="lg-lk" disabled={busy || cooldown > 0} onClick={resendCode}>{cooldown > 0 ? `コード再送（${cooldown} 秒後）` : "コード再送"}</button>
        </span>
      </>
    );
  }

  return (
    <>
      <span className="eyebrow">パスワード再設定</span>
      <h1 className="lg-h">メール確認</h1>
      <Steps k={0} />
      {err && <div className="lg-err" role="alert"><b>{err}</b></div>}
      <label className="lg-f"><span>登録メールアドレス</span><input value={email} type="email" autoComplete="username" autoFocus placeholder="name@example.co.jp" onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendCode(); }} /></label>
      <Btn kind="big full" disabled={busy} aria-busy={busy} onClick={sendCode}>{busy ? "送信中" : "確認コードを送信"}</Btn>
      <button type="button" className="lg-lk c" onClick={onBack}>ログインへ戻る</button>
    </>
  );
}

export default function Login({ onLogin, preview = {} }) {
  const [screen, setScreen] = useState(preview.screen || "login"); // "login" | "forgot" | "legal:terms" | "legal:privacy"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needNewPw, setNeedNewPw] = useState(!!preview.first);
  const [help, setHelp] = useState(false);
  const [newPw, setNewPw] = useState("");
  // 初回パスワード設定のときだけ、規約への同意を必須にする（同意はログイン成立後に記録する）
  const [agreedTerms, setAgreedTerms] = useState(false);
  // 二要素認証（TOTP）。"" = 不要 / "challenge" = コード入力 / "setup" = 認証アプリの登録から
  const [mfaStep, setMfaStep] = useState("");
  const [totpSetup, setTotpSetup] = useState({ sharedSecret: "", uri: "" });

  // signIn / confirmSignIn の結果を見て次の画面を決める。どちらの呼び出しからも同じ判定を使う。
  async function applyNextStep(result) {
    const step = result?.nextStep?.signInStep;
    if (result?.isSignedIn || step === "DONE") {
      // このデバイスを記憶し、次回以降はコード入力を省略する（14日後に日次ジョブが失効させる）。
      // 記憶に失敗しても毎回コードを求められるだけなので、ログイン自体は止めない。
      try { await rememberDevice(); } catch (e) { /* 記憶できない環境ではMFAを都度要求する */ }
      // 初回パスワード設定で同意した場合はここで記録する（この時点でトークンが揃っている）。
      // 失敗してもログインは止めない。記録が無ければログイン後に改めて同意を求める画面が出る。
      if (agreedTerms) { try { await recordTermsAgreement(); } catch (e) { /* 後続の同意画面で拾う */ } }
      onLogin();
      return;
    }
    if (step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
      setNeedNewPw(true);
      setErr("初回ログインです。新しいパスワードを設定してください。");
      return;
    }
    if (step === "CONFIRM_SIGN_IN_WITH_TOTP_CODE") {
      setNeedNewPw(false); setErr(""); setMfaStep("challenge");
      return;
    }
    if (step === "CONTINUE_SIGN_IN_WITH_TOTP_SETUP") {
      const details = result.nextStep.totpSetupDetails;
      let uri = "";
      try { uri = details?.getSetupUri?.("DevHub LMS", email.trim())?.toString() || ""; } catch (e) { uri = ""; }
      setTotpSetup({ sharedSecret: details?.sharedSecret || "", uri });
      setNeedNewPw(false); setErr(""); setMfaStep("setup");
      return;
    }
    if (step === "CONTINUE_SIGN_IN_WITH_MFA_SELECTION") {
      // 認証方式が複数ある場合。本サービスは認証アプリ（TOTP）のみを使う
      await applyNextStep(await confirmSignIn({ challengeResponse: "TOTP" }));
      return;
    }
    if (step === "CONFIRM_SIGN_UP") {
      setErr("メールアドレスの確認が未完了です。確認コードでの認証が必要です。");
      return;
    }
    setErr("追加の認証ステップが必要です：" + (step || "不明"));
  }

  async function handleLogin() {
    if (busy) return;
    setErr("");
    if (!email || !password) { setErr("メールアドレスとパスワードを入力してください。"); return; }
    setBusy(true);
    try {
      try { await signOut(); } catch (e) {}
      await applyNextStep(await signIn({ username: email.trim(), password }));
    } catch (e) {
      const n = e?.name || "";
      if (n === "UserNotFoundException" || n === "NotAuthorizedException") setErr("メールアドレスまたはパスワードが正しくありません。");
      else if (n === "UserNotConfirmedException") setErr("メールアドレスの確認が未完了です。");
      else setErr(e?.message || "ログインに失敗しました。");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  async function handleNewPassword() {
    if (busy) return;
    setErr("");
    if (!newPw) { setErr("新しいパスワードを入力してください。"); return; }
    setBusy(true);
    try {
      await applyNextStep(await confirmSignIn({ challengeResponse: newPw }));
    } catch (e) {
      setErr(e?.message || "パスワード設定に失敗しました（8文字以上・大小英字・数字・記号が必要です）。");
    } finally {
      setBusy(false);
      setNewPw("");
    }
  }

  // TOTPのコード確認（登録時・ログイン時で共通。Cognitoはどちらも confirmSignIn で受け取る）
  async function handleTotpCode(code) {
    if (busy) return;
    setErr("");
    if (!code || code.length < 6) { setErr("6桁のコードを入力してください。"); return; }
    setBusy(true);
    try {
      await applyNextStep(await confirmSignIn({ challengeResponse: code }));
    } catch (e) {
      const n = e?.name || "";
      if (n === "CodeMismatchException" || n === "EnableSoftwareTokenMFAException") setErr("コードが一致しません。認証アプリの表示を確認して、もう一度入力してください。");
      else if (n === "NotAuthorizedException") setErr("認証の有効期限が切れました。最初からログインし直してください。");
      else setErr(e?.message || "コードの確認に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  // MFAの途中でやめるとき。中断したセッションを残さないようサインアウトしてから戻る
  async function cancelMfa() {
    try { await signOut(); } catch (e) {}
    setMfaStep(""); setTotpSetup({ sharedSecret: "", uri: "" }); setErr(""); setPassword("");
  }

  if (screen === "legal:terms" || screen === "legal:privacy") {
    return <StandaloneLegalPage doc={screen === "legal:privacy" ? "privacy" : "terms"} onBack={() => setScreen("login")} />;
  }

  const body = screen === "forgot" ? <ForgotPasswordFlow onBack={() => setScreen("login")} startStep={preview.step} />
    : mfaStep ? (
      <>
        <span className="eyebrow">二要素認証</span>
        <h1 className="lg-h">{mfaStep === "setup" ? "認証アプリの登録" : "コード入力"}</h1>
        <div className="lms-legacy lg-mfa">
          {mfaStep === "setup"
            ? <TotpSetupPanel email={email.trim()} sharedSecret={totpSetup.sharedSecret} setupUri={totpSetup.uri} onVerify={handleTotpCode} busy={busy} error={err} submitLabel="設定を完了してログイン" />
            : <TotpChallengePanel onVerify={handleTotpCode} busy={busy} error={err} />}
        </div>
        <button type="button" className="lg-lk c" onClick={cancelMfa}>ログインへ戻る</button>
      </>
    ) : needNewPw ? (
      <>
        <span className="eyebrow">初回ログイン</span>
        <h1 className="lg-h">パスワード設定</h1>
        <div className="lg-kv"><span>招待先</span><b>{email}</b></div>
        {err && !err.startsWith("初回ログイン") && <div className="lg-err" role="alert"><b>{err}</b></div>}
        <Pw label="新しいパスワード" value={newPw} onChange={setNewPw} onEnter={handleNewPassword} placeholder="8 文字以上" autoComplete="new-password" />
        <Rules value={newPw} />
        <TermsCheckbox checked={agreedTerms} onChange={setAgreedTerms} />
        <Btn kind="big full" disabled={busy || !agreedTerms} aria-busy={busy} onClick={handleNewPassword}>{busy ? "設定中" : "設定してはじめる"}</Btn>
      </>
    ) : (
      <>
        <span className="eyebrow">ようこそ</span>
        <h1 className="lg-h">ログイン</h1>
        {err && <div className="lg-err" role="alert"><b>ログイン失敗</b><span>{err}</span></div>}
        <label className={`lg-f${err ? " ng" : ""}`}><span>メールアドレス</span><input value={email} type="email" autoComplete="username" placeholder="name@example.co.jp" onChange={e => setEmail(e.target.value)} /></label>
        <Pw label="パスワード" value={password} onChange={setPassword} onEnter={handleLogin} placeholder="パスワード" autoComplete="current-password" />
        <div className="lg-row"><span /><button type="button" className="lg-lk" onClick={() => { setErr(""); setScreen("forgot"); }}>パスワードをお忘れの方</button></div>
        <Btn kind="big full" disabled={busy} aria-busy={busy} onClick={handleLogin}>{busy ? "ログイン中" : "ログイン"}</Btn>
      </>
    );

  return (
    <div className="lms lgw">
      <div className="login lg2">
        <section className="lbrand">
          <span className="lg-blob b1" aria-hidden="true" /><span className="lg-blob b2" aria-hidden="true" />
          <div className="lg-top"><div className="lmark"><DevHubMark product="teal" size={48} /></div><span className="wm">Dev<b>Hub</b><i>LMS</i></span></div>
          <p className="lcopy">研修の毎日を、<br />ひとつに。</p>
          <div className="lg-kd">{KINDS.map(([t, c]) => <span key={t} className={`c-${c}`}><i aria-hidden="true" />{t}</span>)}</div>
          <Devices />
        </section>
        <main className="lform">
          <div className="lcard">{body}</div>
          <footer className="lfoot">
            <button type="button" onClick={() => setScreen("legal:terms")}>利用規約</button>
            <button type="button" onClick={() => setScreen("legal:privacy")}>プライバシーポリシー</button>
            <button type="button" onClick={() => setHelp(true)}>困ったとき</button>
            <span>© 2026 Feeps</span>
          </footer>
        </main>
      </div>
      {help && (
        <Modal title="困ったとき" width={460} onClose={() => setHelp(false)} footer={<Btn kind="ghost" onClick={() => setHelp(false)}>閉じる</Btn>}>
          <div className="lg-help">
            <div><b>初めてログインする</b><small>招待メールの仮パスワードでログイン</small></div>
            <div><b>パスワードを忘れた</b><small><button type="button" className="lg-lk" onClick={() => { setHelp(false); setErr(""); setScreen("forgot"); }}>パスワード再設定へ</button></small></div>
            <div><b>メールが届かない・ログインできない</b><small>研修の担当者へ連絡</small></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
