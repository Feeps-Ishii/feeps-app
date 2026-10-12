import React, { useState, useRef, useEffect } from "react";
import { signIn, signOut, confirmSignIn, resetPassword, confirmResetPassword, rememberDevice } from "aws-amplify/auth";
import {
  Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, ShieldCheck,
  Sparkles, GraduationCap, NotebookPen, Clock, Calendar, ClipboardCheck, Users,
  LogIn, Send,
} from "lucide-react";
import { T, NOVA, PRISM, BrandMark } from "../../components/common";
import { StandaloneLegalPage } from "../../components/common/LegalPages.jsx";
import { TotpSetupPanel, TotpChallengePanel } from "./MfaSetup.jsx";
import { TermsCheckbox, recordTermsAgreement } from "../../components/common/TermsConsent.jsx";
import "./devhubAuth.css";

// Cognito User Pool (ap-northeast-1_QG4KZb06z) の実設定を確認のうえ表示（Phase7-4b）。
// ハードコードではなく、実際のPasswordPolicy（MinimumLength:8, RequireUppercase/Lowercase/Numbers/Symbols:true）と一致させている。
const PASSWORD_REQUIREMENTS = ["8文字以上", "英大文字を含む", "英小文字を含む", "数字を含む", "記号を含む"];

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

const loginFieldVars = {
  "--field-bg": T.bgSurface,
  "--field-border": T.border,
  "--field-text": PRISM.ink,
  "--field-focus": PRISM.accent,
  "--field-focus-ring": PRISM.accentSubtle,
};

// 2026-10-12: DevHub LMS のログイン（D 案）。青一色、押すと沈む
const ctaStyle = { background: "#1F5FD6", boxShadow: "0 5px 0 #123E96" };
const ctaClass = "feeps-auth-primary feeps-prism-cta w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60";

function AuthMeta({ step }) {
  return (
    <div className="feeps-auth-card-top">
      <span className="feeps-auth-security" style={{ color: PRISM.sub }}>
        <ShieldCheck size={15} aria-hidden="true" /> SECURE ACCESS
      </span>
      <span className="feeps-auth-step" style={{ color: PRISM.sub, background: PRISM.neutralSubtle, borderColor: PRISM.line2 }}>
        {step}
      </span>
    </div>
  );
}

// 2026-10-12: ログイン画面を一新（モック docs/design/mockups/devhub-lms-2026-10/devhub-login.html の D 案）。
// 真ん中にロゴと入力のカード。まわりに機能のアイコンが浮かび、点線でカードにつながる（ロゴの「ハブ」）。
// その奥に、日報・勤怠・カリキュラム・テストの画面のかけらを薄くぼかして敷く（ユーザー指定）。
// 文章は置かない。狭い画面では背景を出さず、ロゴとカードだけ。
const ORBIT = [
  { Icon: GraduationCap, c: "#1F5FD6", x: 15, y: 30 },
  { Icon: NotebookPen, c: "#2B6BE0", x: 22, y: 74 },
  { Icon: Clock, c: "#11966F", x: 8, y: 54 },
  { Icon: Calendar, c: "#6B4FD8", x: 85, y: 26 },
  { Icon: ClipboardCheck, c: "#D9822B", x: 91, y: 54 },
  { Icon: Users, c: "#0E8F8A", x: 79, y: 79 },
];
function AuthBackdrop() {
  return (
    <div className="dh-auth-bg" aria-hidden="true">
      <div className="dh-shot dh-shot-1">
        <b><span className="dh-ic" style={{ "--c": "#2B6BE0" }}><NotebookPen size={14} /></span>日報</b>
        {[["#1F5FD6", 4], ["#11966F", 3], ["#D9483B", 0], ["#1F5FD6", 5]].map(([c, lv], i) => (
          <span key={i} className="dh-row"><i className="dh-av" /><i className="dh-line" /><span className="dh-lv">{[1, 2, 3, 4, 5].map(k => <i key={k} className={k <= lv ? "on" : ""} />)}</span><i className="dh-dot" style={{ background: c }} /></span>
        ))}
      </div>
      <div className="dh-shot dh-shot-2">
        <b><span className="dh-ic" style={{ "--c": "#6B4FD8" }}><Calendar size={14} /></span>カリキュラム</b>
        {["09:00", "09:30", "13:00", "14:00", "17:00"].map((t, i) => <span key={t} className={`dh-tl ${i === 1 ? "on" : ""}`}><small>{t}</small><i /><i className="dh-line" /></span>)}
      </div>
      <div className="dh-shot dh-shot-3">
        <b><span className="dh-ic" style={{ "--c": "#11966F" }}><Clock size={14} /></span>勤怠</b>
        <span className="dh-week">{["on", "on", "late", "on", "now"].map((k, i) => <i key={i} className={k} />)}</span>
        <svg width="74" height="74" viewBox="0 0 58 58"><circle cx="29" cy="29" r="23" fill="none" stroke="#EFF3F9" strokeWidth="8" /><circle cx="29" cy="29" r="23" fill="none" stroke="#11966F" strokeWidth="8" strokeLinecap="round" strokeDasharray="128 145" transform="rotate(-90 29 29)" /></svg>
      </div>
      <div className="dh-shot dh-shot-4">
        <b><span className="dh-ic" style={{ "--c": "#D9822B" }}><ClipboardCheck size={14} /></span>テスト</b>
        <span className="dh-bars">{[62, 84, 71, 90, 78, 88].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</span>
      </div>
      <svg className="dh-lines">{ORBIT.map(({ x, y }, i) => <line key={i} x1="50%" y1="50%" x2={`${x}%`} y2={`${y}%`} />)}</svg>
      {ORBIT.map(({ Icon, c, x, y }, i) => (
        <span key={i} className="dh-orb" style={{ "--c": c, left: `calc(${x}% - 29px)`, top: `calc(${y}% - 29px)`, animationDelay: `-${i * 0.8}s` }}><Icon size={26} /></span>
      ))}
    </div>
  );
}

function PasswordField({ label, value, onChange, onEnter, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <label className="feeps-auth-field block">
      <div className="mb-1.5 text-sm font-semibold" style={{ color: PRISM.ink }}>{label}</div>
      <div className="feeps-auth-input-wrap feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
        <Lock size={16} style={{ color: PRISM.mut }} />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && onEnter) onEnter(); }}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="feeps-auth-input w-full bg-transparent py-3 text-sm outline-none"
          style={{ color: PRISM.ink }}
        />
        <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? "パスワードを隠す" : "パスワードを表示"} aria-pressed={show} className="feeps-auth-password-toggle flex h-11 w-11 shrink-0 -mr-2 items-center justify-center rounded" style={{ color: PRISM.sub }}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}

/* ===== パスワード再設定フロー（Step1: メール入力→Step2: コード+新パスワード→Step3: 完了） ===== */
function ForgotPasswordFlow({ onBack }) {
  const [step, setStep] = useState("email"); // "email" | "code" | "done"
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
    if (!agreedTerms) { setErr("利用規約とプライバシーポリシーへの同意が必要です。"); return; }
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
      <div className="feeps-auth-view feeps-auth-complete w-full">
        <AuthMeta step="RESET · 03" />
        <div className="feeps-auth-success" style={{ background: PRISM.gradCta, color: PRISM.surface, boxShadow: PRISM.heroShadow }} role="status" aria-label="パスワード変更完了">
          <CheckCircle2 size={38} aria-hidden="true" />
        </div>
        <div className="feeps-auth-heading">
          <h2 style={{ color: PRISM.ink }}>パスワードを変更しました</h2>
          <p style={{ color: PRISM.sub }}>新しいパスワードでDevHub LMS をご利用いただけます。</p>
        </div>
        <button type="button" onClick={onBack} className={`${ctaClass} mt-7`} style={ctaStyle}>
          <LogIn size={17} aria-hidden="true" />ログイン画面へ戻る
        </button>
        <div className="feeps-auth-note mt-4" style={{ background: PRISM.accentSubtle, color: PRISM.ink, borderColor: PRISM.line2 }}>
          <ShieldCheck size={17} aria-hidden="true" />
          <span>セキュリティのため、ほかの端末では再ログインが必要になる場合があります。</span>
        </div>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="feeps-auth-view w-full">
        <AuthMeta step="RESET · 02" />
        <div className="feeps-auth-heading">
          <h2 style={{ color: PRISM.ink }}>確認コードを入力</h2>
          <p style={{ color: PRISM.sub }}>6桁のコードと、新しいパスワードを入力してください。</p>
        </div>
        <div className="feeps-auth-form">
          {notice && <div className="feeps-auth-note" style={{ background: PRISM.okSubtle, color: PRISM.ink, borderColor: PRISM.line2 }} role="status" aria-live="polite"><Mail size={17} aria-hidden="true" /><span>{notice}<strong className="block">送信先: {email}</strong></span></div>}
          {err && <div className="feeps-auth-alert" style={{ background: PRISM.badSubtle, color: PRISM.ink, borderColor: PRISM.badLine }} role="alert">{err}</div>}
          <label className="feeps-auth-field block">
            <div className="mb-1.5 text-sm font-semibold" style={{ color: PRISM.ink }}>6桁の確認コード</div>
            <div className="feeps-auth-input-wrap feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="123456" aria-invalid={Boolean(err)} className="feeps-auth-input feeps-auth-code w-full bg-transparent py-3 text-sm outline-none" style={{ color: PRISM.ink }} />
            </div>
          </label>
          <PasswordField label="新しいパスワード" value={newPw} onChange={setNewPw} placeholder="新しいパスワード" autoComplete="new-password" />
          <PasswordField label="新しいパスワード（確認）" value={newPw2} onChange={setNewPw2} onEnter={submitNewPassword} placeholder="新しいパスワード（確認）" autoComplete="new-password" />
          <ul className="feeps-auth-checks" style={{ background: PRISM.neutralSubtle, color: PRISM.sub }} aria-label="パスワード条件">
            {PASSWORD_REQUIREMENTS.map(requirement => <li key={requirement}><CheckCircle2 size={14} aria-hidden="true" />{requirement}</li>)}
          </ul>
          <button type="button" onClick={submitNewPassword} disabled={busy} aria-busy={busy} className={ctaClass} style={ctaStyle}>
            <ShieldCheck size={17} aria-hidden="true" />{busy ? "変更中…" : "パスワードを変更"}
          </button>
          <div className="feeps-auth-field-row">
            <button type="button" onClick={() => { setErr(""); setNotice(""); setStep("email"); }} className="feeps-auth-link" style={{ color: PRISM.accentDeep }}>
              <ArrowLeft size={14} aria-hidden="true" />メールアドレスを変更
            </button>
            <button type="button" onClick={resendCode} disabled={busy || cooldown > 0} className="feeps-auth-link disabled:opacity-50" style={{ color: PRISM.accentDeep }}>
              {cooldown > 0 ? `コードを再送（${cooldown}秒後）` : "コードを再送"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="feeps-auth-view w-full">
      <AuthMeta step="RESET · 01" />
      <div className="feeps-auth-heading">
        <h2 style={{ color: PRISM.ink }}>パスワードを再設定</h2>
        <p style={{ color: PRISM.sub }}>登録済みのメールアドレスへ、確認コードを送信します。</p>
      </div>
      <div className="feeps-auth-form">
        {err && <div className="feeps-auth-alert" style={{ background: PRISM.badSubtle, color: PRISM.ink, borderColor: PRISM.badLine }} role="alert">{err}</div>}
        <label className="feeps-auth-field block">
          <div className="mb-1.5 text-sm font-semibold" style={{ color: PRISM.ink }}>メールアドレス</div>
          <div className="feeps-auth-input-wrap feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
            <Mail size={16} style={{ color: PRISM.mut }} />
            <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendCode(); }} type="email" autoComplete="username" autoFocus placeholder="name@example.com" className="feeps-auth-input w-full bg-transparent py-3 text-sm outline-none" style={{ color: PRISM.ink }} />
          </div>
        </label>
        <div className="feeps-auth-note" style={{ background: PRISM.accentSubtle, color: PRISM.ink, borderColor: PRISM.line2 }}>
          <ShieldCheck size={17} aria-hidden="true" /><span>アカウントの有無にかかわらず、同じご案内を表示します。</span>
        </div>
        <button type="button" onClick={sendCode} disabled={busy} aria-busy={busy} className={ctaClass} style={ctaStyle}>
          <Send size={17} aria-hidden="true" />{busy ? "送信中…" : "確認コードを送信"}
        </button>
        <button type="button" onClick={onBack} className="feeps-auth-secondary" style={{ color: PRISM.ink, background: PRISM.surface, borderColor: PRISM.line2 }}>
          <ArrowLeft size={15} aria-hidden="true" />ログイン画面へ戻る
        </button>
      </div>
    </div>
  );
}

export default function Login({ onLogin }) {
  const [screen, setScreen] = useState("login"); // "login" | "forgot" | "legal:terms" | "legal:privacy"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needNewPw, setNeedNewPw] = useState(false);
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

  return (
    <div className="dh-auth" style={{ color: PRISM.ink, "--auth-line": NOVA.line, "--auth-soft": NOVA.soft, "--auth-card": NOVA.card, "--auth-ink": NOVA.ink, "--auth-muted": NOVA.muted, "--auth-accent": NOVA.accent, "--auth-shadow": NOVA.shadowMd }}>
      <AuthBackdrop />
      <main className="dh-auth-col">
        <div className="dh-auth-logo"><BrandMark size={50} withWordmark wordmarkSize={27} /></div>
        <div className="feeps-auth-card dh-auth-card">
          {screen === "forgot" ? (
            <ForgotPasswordFlow onBack={() => setScreen("login")} />
          ) : mfaStep ? (
            <div className="feeps-auth-view w-full">
              <AuthMeta step="AUTH · 03" />
              <div className="feeps-auth-heading">
                <h2 style={{ color: PRISM.ink }}>{mfaStep === "setup" ? "二要素認証を設定します" : "二要素認証"}</h2>
                <p style={{ color: PRISM.sub }}>
                  {mfaStep === "setup"
                    ? "パスワードだけで入れないよう、認証アプリを登録してください。設定は最初の1回だけです。"
                    : "このデバイスからは初回のみ確認します。以降14日間はコードの入力を省略できます。"}
                </p>
              </div>
              <div className="feeps-auth-form">
                {mfaStep === "setup"
                  ? <TotpSetupPanel email={email.trim()} sharedSecret={totpSetup.sharedSecret} setupUri={totpSetup.uri} onVerify={handleTotpCode} busy={busy} error={err} submitLabel="設定を完了してログイン" />
                  : <TotpChallengePanel onVerify={handleTotpCode} busy={busy} error={err} />}
                <button type="button" onClick={cancelMfa} className="feeps-auth-secondary" style={{ color: PRISM.ink, background: PRISM.surface, borderColor: PRISM.line2 }}>
                  <ArrowLeft size={15} aria-hidden="true" />ログイン画面へ戻る
                </button>
              </div>
            </div>
          ) : needNewPw ? (
            <div className="feeps-auth-view w-full">
              <AuthMeta step="AUTH · 02" />
              <div className="feeps-auth-heading">
                <h2 style={{ color: PRISM.ink }}>DevHub LMS へようこそ</h2>
                <p style={{ color: PRISM.sub }}>最初に、ご自身のパスワードを設定してください。</p>
              </div>
              <div className="feeps-auth-form">
                <div className="feeps-auth-note" style={{ background: PRISM.accentSubtle, color: PRISM.ink, borderColor: PRISM.line2 }}>
                  <Mail size={17} aria-hidden="true" /><span>招待先 <strong>{email}</strong></span>
                </div>
                {err && (
                  <div className={err.startsWith("初回ログイン") ? "feeps-auth-note" : "feeps-auth-alert"}
                    style={{ background: err.startsWith("初回ログイン") ? PRISM.accentSubtle : PRISM.badSubtle, color: PRISM.ink, borderColor: err.startsWith("初回ログイン") ? PRISM.line2 : PRISM.badLine }}
                    role={err.startsWith("初回ログイン") ? "status" : "alert"}>
                    {err}
                  </div>
                )}
                <PasswordField label="新しいパスワード" value={newPw} onChange={setNewPw} onEnter={handleNewPassword} placeholder="新しいパスワード" autoComplete="new-password" />
                <ul className="feeps-auth-checks" style={{ background: PRISM.neutralSubtle, color: PRISM.sub }} aria-label="パスワード条件">
                  {PASSWORD_REQUIREMENTS.map(requirement => <li key={requirement}><CheckCircle2 size={14} aria-hidden="true" />{requirement}</li>)}
                </ul>
                <TermsCheckbox checked={agreedTerms} onChange={setAgreedTerms} />
                <button type="button" onClick={handleNewPassword} disabled={busy || !agreedTerms} aria-busy={busy} className={ctaClass} style={{ ...ctaStyle, opacity: agreedTerms ? 1 : 0.6 }}>
                  <Sparkles size={17} aria-hidden="true" />{busy ? "設定中…" : "パスワードを設定してはじめる"}
                </button>
              </div>
            </div>
          ) : (
            <div className="feeps-auth-view w-full">
              <AuthMeta step="AUTH · 01" />
              <div className="feeps-auth-heading">
                {/* 2026-09-09: 「おかえりなさい」をやめた。毎日見る画面で情緒に寄ると白々しくなる */}
                <h2 style={{ color: PRISM.ink }}>ログイン</h2>
              </div>
              <div className="feeps-auth-form" role="form" aria-label="ログイン">
                {err && <div className="feeps-auth-alert" style={{ background: PRISM.badSubtle, color: PRISM.ink, borderColor: PRISM.badLine }} role="alert">{err}</div>}
                <label className="feeps-auth-field block">
                  <div className="mb-1.5 text-sm font-semibold" style={{ color: PRISM.ink }}>メールアドレス</div>
                  <div className="feeps-auth-input-wrap feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
                    <Mail size={16} style={{ color: PRISM.mut }} />
                    <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" type="email" autoComplete="username" className="feeps-auth-input w-full bg-transparent py-3 text-sm outline-none" style={{ color: PRISM.ink }} />
                  </div>
                </label>
                <label className="feeps-auth-field block">
                  <div className="feeps-auth-field-row mb-1.5">
                    <span className="text-sm font-semibold" style={{ color: PRISM.ink }}>パスワード</span>
                    <button type="button" onClick={() => { setErr(""); setScreen("forgot"); }} className="feeps-auth-link" style={{ color: PRISM.accentDeep }}>パスワードをお忘れですか？</button>
                  </div>
                  <div className="feeps-auth-input-wrap feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
                    <Lock size={16} style={{ color: PRISM.mut }} />
                    <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleLogin(); }} placeholder="パスワード" autoComplete="current-password" className="feeps-auth-input w-full bg-transparent py-3 text-sm outline-none" style={{ color: PRISM.ink }} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"} aria-pressed={showPassword} className="feeps-auth-password-toggle flex h-11 w-11 shrink-0 -mr-2 items-center justify-center rounded" style={{ color: PRISM.sub }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
                <button type="button" onClick={handleLogin} disabled={busy} aria-busy={busy} className={ctaClass} style={ctaStyle}>
                  {/* 2026-09-09: 「Feeps One にログイン」から製品名を外した。
                      名前が変わる可能性があるので、触る箇所を増やさない（ユーザー指示） */}
                  <LogIn size={17} aria-hidden="true" />{busy ? "ログイン中…" : "ログイン"}
                </button>
                <div className="feeps-auth-divider" style={{ background: PRISM.line2 }} />
                <div className="feeps-auth-note" style={{ background: PRISM.accentSubtle, color: PRISM.ink, borderColor: PRISM.line2 }}>
                  <Mail size={17} aria-hidden="true" /><span>初めて利用する方は、招待メールに記載された仮パスワードでログインしてください。</span>
                </div>
              </div>
            </div>
          )}

        </div>
        <footer className="feeps-auth-foot dh-auth-foot" style={{ color: PRISM.sub }}>
          <button type="button" onClick={() => setScreen("legal:terms")}>利用規約</button>
          <button type="button" onClick={() => setScreen("legal:privacy")}>プライバシーポリシー</button>
          <span>© 2026 Feeps</span>
        </footer>
      </main>
    </div>
  );
}
