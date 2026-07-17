import React, { useState, useRef } from "react";
import { signIn, signOut, confirmSignIn, resetPassword, confirmResetPassword } from "aws-amplify/auth";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react";
import { PRISM, BrandMark } from "../../components/common";
import { StandaloneLegalPage } from "../../components/common/LegalPages.jsx";

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
  "--field-bg": "#FBFCFE",
  "--field-border": "#E5E8F5",
  "--field-text": PRISM.ink,
  "--field-focus": PRISM.accent,
  "--field-focus-ring": PRISM.accentSubtle,
};

const ctaStyle = { background: PRISM.gradCta, boxShadow: "0 8px 20px rgba(79,107,240,.32)" };
const ctaClass = "feeps-prism-cta w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60";

function PasswordField({ label, value, onChange, onEnter, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold" style={{ color: PRISM.sub }}>{label}</div>
      <div className="feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
        <Lock size={16} style={{ color: PRISM.mut }} />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && onEnter) onEnter(); }}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent py-3 text-sm outline-none"
          style={{ color: PRISM.ink }}
        />
        <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? "パスワードを隠す" : "パスワードを表示"} className="flex h-11 w-11 shrink-0 -mr-2 items-center justify-center rounded" style={{ color: PRISM.mut }}>
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
      <div className="w-full">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: PRISM.okSubtle, color: PRISM.ok }}>
          <CheckCircle2 size={24} />
        </div>
        <h2 className="text-2xl font-bold" style={{ color: PRISM.ink, letterSpacing: "-0.02em" }}>パスワードを変更しました</h2>
        <p className="mt-1 text-sm" style={{ color: PRISM.mut }}>新しいパスワードでログインしてください。</p>
        <button type="button" onClick={onBack} className={`${ctaClass} mt-6`} style={ctaStyle}>
          ログイン画面へ戻る
        </button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="w-full">
        <button type="button" onClick={() => { setErr(""); setNotice(""); setStep("email"); }} className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: PRISM.mut }}>
          <ArrowLeft size={14} />メールアドレスを変更
        </button>
        <h2 className="text-2xl font-bold" style={{ color: PRISM.ink, letterSpacing: "-0.02em" }}>確認コードを入力</h2>
        <p className="mt-1 text-sm" style={{ color: PRISM.mut }}>送信先: {email}</p>
        <div className="mt-6 space-y-4">
          {notice && <div className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: PRISM.okSubtle, color: PRISM.ok }}>{notice}</div>}
          {err && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: PRISM.badSubtle, color: PRISM.bad }}>{err}</div>}
          <label className="block">
            <div className="mb-1.5 text-xs font-semibold" style={{ color: PRISM.sub }}>確認コード</div>
            <div className="feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="w-full bg-transparent py-3 text-sm outline-none" style={{ color: PRISM.ink }} />
            </div>
          </label>
          <PasswordField label="新しいパスワード" value={newPw} onChange={setNewPw} placeholder="新しいパスワード" autoComplete="new-password" />
          <PasswordField label="新しいパスワード（確認）" value={newPw2} onChange={setNewPw2} onEnter={submitNewPassword} placeholder="新しいパスワード（確認）" autoComplete="new-password" />
          <ul className="rounded-lg px-3 py-2 text-[11px] leading-relaxed" style={{ background: PRISM.base, color: PRISM.mut }}>
            <li>パスワード条件: {PASSWORD_REQUIREMENTS.join("・")}</li>
          </ul>
          <button type="button" onClick={submitNewPassword} disabled={busy} className={ctaClass} style={ctaStyle}>
            {busy ? "変更中…" : "パスワードを変更"}
          </button>
          <button type="button" onClick={resendCode} disabled={busy || cooldown > 0} className="w-full text-center text-xs font-semibold disabled:opacity-50" style={{ color: PRISM.accent }}>
            {cooldown > 0 ? `確認コードを再送（${cooldown}秒後に再送可能）` : "確認コードを再送"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: PRISM.mut }}>
        <ArrowLeft size={14} />ログインへ戻る
      </button>
      <h2 className="text-2xl font-bold" style={{ color: PRISM.ink, letterSpacing: "-0.02em" }}>パスワードを再設定</h2>
      <p className="mt-1 text-sm" style={{ color: PRISM.mut }}>登録済みのメールアドレスへ確認コードを送信します。</p>
      <div className="mt-6 space-y-4">
        {err && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: PRISM.badSubtle, color: PRISM.bad }}>{err}</div>}
        <label className="block">
          <div className="mb-1.5 text-xs font-semibold" style={{ color: PRISM.sub }}>メールアドレス</div>
          <div className="feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
            <Mail size={16} style={{ color: PRISM.mut }} />
            <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendCode(); }} type="email" autoComplete="username" autoFocus placeholder="name@example.com" className="w-full bg-transparent py-3 text-sm outline-none" style={{ color: PRISM.ink }} />
          </div>
        </label>
        <button type="button" onClick={sendCode} disabled={busy} className={ctaClass} style={ctaStyle}>
          {busy ? "送信中…" : "確認コードを送信"}
        </button>
      </div>
    </div>
  );
}

// ログイン画面（Prism Bright / 2026-07-17確定のC3案）。
// 左＝ブランドコピー＋浮遊するProductピル、右＝白カードのフォーム。認証ロジックは従来と同一。
const PRODUCT_PILLS = [
  { label: "研修管理", grad: PRISM.gradTraining, delay: "0s" },
  { label: "Eラーニング", grad: PRISM.gradLearning, delay: "-2s" },
  { label: "スキル・成長", grad: PRISM.gradTalent, delay: "-4s" },
  { label: "案件マッチング", grad: PRISM.gradMatching, delay: "-6s" },
];

export default function Login({ onLogin }) {
  const [screen, setScreen] = useState("login"); // "login" | "forgot" | "legal:terms" | "legal:privacy"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needNewPw, setNeedNewPw] = useState(false);
  const [newPw, setNewPw] = useState("");

  async function handleLogin() {
    if (busy) return;
    setErr("");
    if (!email || !password) { setErr("メールアドレスとパスワードを入力してください。"); return; }
    setBusy(true);
    try {
      try { await signOut(); } catch (e) {}
      const { isSignedIn, nextStep } = await signIn({ username: email.trim(), password });
      if (isSignedIn || nextStep?.signInStep === "DONE") {
        onLogin();
      } else if (nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        setNeedNewPw(true);
        setErr("初回ログインです。新しいパスワードを設定してください。");
      } else if (nextStep?.signInStep === "CONFIRM_SIGN_UP") {
        setErr("メールアドレスの確認が未完了です。確認コードでの認証が必要です。");
      } else {
        setErr("追加の認証ステップが必要です：" + (nextStep?.signInStep || "不明"));
      }
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
      const { isSignedIn, nextStep } = await confirmSignIn({ challengeResponse: newPw });
      if (isSignedIn || nextStep?.signInStep === "DONE") {
        onLogin();
      } else {
        setErr("パスワード設定後、追加のステップが必要です：" + (nextStep?.signInStep || "不明"));
      }
    } catch (e) {
      setErr(e?.message || "パスワード設定に失敗しました（8文字以上・大小英字・数字・記号が必要です）。");
    } finally {
      setBusy(false);
      setNewPw("");
    }
  }

  if (screen === "legal:terms" || screen === "legal:privacy") {
    return <StandaloneLegalPage doc={screen === "legal:privacy" ? "privacy" : "terms"} onBack={() => setScreen("login")} />;
  }

  return (
    <div style={{ background: PRISM.auroraBg, minHeight: "100dvh", fontFamily: "'Inter','Noto Sans JP',sans-serif", color: PRISM.ink }}>
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-12" style={{ minHeight: "100dvh" }}>
        {/* ===== 左: ブランドコピー ===== */}
        <div className="relative hidden h-full flex-col justify-center lg:flex">
          <div className="feeps-stagger-in" style={{ animationDelay: "0ms" }}>
            <BrandMark size={44} withWordmark wordmarkSize={20} />
          </div>
          <h1 className="feeps-stagger-in mt-7 text-4xl font-bold" style={{ letterSpacing: "-0.035em", lineHeight: 1.4, animationDelay: "80ms", textWrap: "balance" }}>
            今日の学びが、<br />
            <span style={{ background: PRISM.gradText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>明日の仕事</span>になる。
          </h1>
          <p className="feeps-stagger-in mt-4 max-w-md text-sm leading-relaxed" style={{ color: PRISM.sub, animationDelay: "160ms" }}>
            研修・教材・スキル・案件。<br />
            成長のすべてが、<span style={{ whiteSpace: "nowrap" }}>ひとつのホームからはじまります。</span>
          </p>
          <div className="feeps-stagger-in mt-8 flex flex-wrap gap-2.5" style={{ animationDelay: "240ms" }}>
            {PRODUCT_PILLS.map(p => (
              <span key={p.label} className="feeps-float rounded-full px-4 py-1.5 text-xs font-bold text-white"
                style={{ background: p.grad, boxShadow: "0 5px 14px rgba(32,34,46,.14)", animationDuration: "8s", animationDelay: p.delay }}>
                {p.label}
              </span>
            ))}
          </div>
          <div className="feeps-stagger-in absolute bottom-0 left-0 right-0 flex items-center justify-between text-xs" style={{ color: PRISM.mut, animationDelay: "320ms" }}>
            <div className="flex items-center gap-3">
              {["研修管理", "AI活用", "スキル可視化"].map((f, i) => (
                <React.Fragment key={f}>
                  {i > 0 && <span style={{ color: PRISM.line2 }}>・</span>}
                  <span className="font-semibold">{f}</span>
                </React.Fragment>
              ))}
            </div>
            <span>© 2026 Feeps Inc.</span>
          </div>
        </div>

        {/* ===== 右: ログインフォーム / パスワード再設定フロー（白カード） ===== */}
        <div className="feeps-fade-in flex justify-center">
          <div className="w-full max-w-md rounded-3xl p-8 sm:p-10" style={{ background: "#fff", border: `1px solid ${PRISM.line}`, boxShadow: "0 24px 56px rgba(79,107,240,.16)" }}>
            <BrandMark size={38} withWordmark wordmarkSize={18} />

            {screen === "forgot" ? (
              <div className="mt-6">
                <ForgotPasswordFlow onBack={() => setScreen("login")} />
              </div>
            ) : (
              <div className="w-full">
                <h2 className="mt-6 text-2xl font-bold" style={{ color: PRISM.ink, letterSpacing: "-0.02em" }}>おかえりなさい</h2>
                <p className="mt-1 text-sm" style={{ color: PRISM.mut }}>アカウントは研修運営から発行されます</p>

                <div className="mt-6 space-y-4">
                  <label className="block">
                    <div className="mb-1.5 text-xs font-semibold" style={{ color: PRISM.sub }}>メールアドレス</div>
                    <div className="feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
                      <Mail size={16} style={{ color: PRISM.mut }} />
                      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" type="email" autoComplete="username" className="w-full bg-transparent py-3 text-sm outline-none" style={{ color: PRISM.ink }} />
                    </div>
                  </label>
                  <label className="block">
                    <div className="mb-1.5 text-xs font-semibold" style={{ color: PRISM.sub }}>パスワード</div>
                    <div className="feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
                      <Lock size={16} style={{ color: PRISM.mut }} />
                      <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleLogin(); }} placeholder="パスワード" autoComplete="current-password" className="w-full bg-transparent py-3 text-sm outline-none" style={{ color: PRISM.ink }} />
                      <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"} className="flex h-11 w-11 shrink-0 -mr-2 items-center justify-center rounded" style={{ color: PRISM.mut }}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>
                  {err && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: needNewPw ? PRISM.warnSubtle : PRISM.badSubtle, color: needNewPw ? PRISM.warn : PRISM.bad }}>{err}</div>}
                  {needNewPw && (
                    <PasswordField label="新しいパスワード" value={newPw} onChange={setNewPw} onEnter={handleNewPassword} placeholder="新しいパスワード" autoComplete="new-password" />
                  )}
                  {needNewPw
                    ? <button type="button" onClick={handleNewPassword} disabled={busy} className={ctaClass} style={ctaStyle}>{busy ? "設定中…" : "パスワードを設定して続行"}</button>
                    : <button type="button" onClick={handleLogin} disabled={busy} className={ctaClass} style={ctaStyle}>{busy ? "ログイン中…" : "Feeps One にログイン"}</button>}
                  <button type="button" onClick={() => { setErr(""); setScreen("forgot"); }} className="w-full text-center text-xs font-semibold" style={{ color: PRISM.accent }}>パスワードをお忘れですか？</button>
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-center gap-3 text-[11px]" style={{ color: PRISM.mut }}>
              <button type="button" onClick={() => setScreen("legal:terms")} className="hover:underline">利用規約</button>
              <span style={{ color: PRISM.line2 }}>・</span>
              <button type="button" onClick={() => setScreen("legal:privacy")} className="hover:underline">プライバシーポリシー</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
