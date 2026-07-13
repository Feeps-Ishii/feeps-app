import React, { useState, useRef } from "react";
import { signIn, signOut, confirmSignIn, resetPassword, confirmResetPassword } from "aws-amplify/auth";
import { TrendingUp, Mail, Lock, Sparkles, Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react";
import { T } from "../../components/common";
import { StandaloneLegalPage } from "../../components/common/LegalPages.jsx";
import useCountUp from "../../hooks/common/useCountUp.js";

const BRAND = { name: "Feeps One", tagline: "研修管理クラウド" };

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

function PasswordField({ label, value, onChange, onEnter, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold" style={{ color: T.textSecondary }}>{label}</div>
      <div className="feeps-login-field flex items-center gap-2 rounded-xl px-3" style={{ "--field-bg": T.bgSurface, "--field-border": T.border, "--field-text": T.textPrimary, "--field-focus": T.accent, "--field-focus-ring": T.accentSubtle }}>
        <Lock size={16} style={{ color: T.textMuted }} />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && onEnter) onEnter(); }}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent py-3 text-sm outline-none"
          style={{ color: T.textPrimary }}
        />
        <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? "パスワードを隠す" : "パスワードを表示"} className="flex h-11 w-11 shrink-0 -mr-2 items-center justify-center rounded" style={{ color: T.textMuted }}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}

const loginFieldVars = {
  "--field-bg": T.bgSurface,
  "--field-border": T.border,
  "--field-text": T.textPrimary,
  "--field-focus": T.accent,
  "--field-focus-ring": T.accentSubtle,
};

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
      <div className="w-full max-w-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: T.successSubtle, color: T.success }}>
          <CheckCircle2 size={24} />
        </div>
        <h2 className="text-2xl font-bold" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>パスワードを変更しました</h2>
        <p className="mt-1 text-sm" style={{ color: T.textMuted }}>新しいパスワードでログインしてください。</p>
        <button type="button" onClick={onBack} className="feeps-login-cta mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ background: T.accent }}>
          ログイン画面へ戻る
        </button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="w-full max-w-sm">
        <button type="button" onClick={() => { setErr(""); setNotice(""); setStep("email"); }} className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.textMuted }}>
          <ArrowLeft size={14} />メールアドレスを変更
        </button>
        <h2 className="text-2xl font-bold" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>確認コードを入力</h2>
        <p className="mt-1 text-sm" style={{ color: T.textMuted }}>送信先: {email}</p>
        <div className="mt-6 space-y-4">
          {notice && <div className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: T.successSubtle, color: T.success }}>{notice}</div>}
          {err && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{err}</div>}
          <label className="block">
            <div className="mb-1.5 text-xs font-semibold" style={{ color: T.textSecondary }}>確認コード</div>
            <div className="feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
              <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="w-full bg-transparent py-3 text-sm outline-none" style={{ color: T.textPrimary }} />
            </div>
          </label>
          <PasswordField label="新しいパスワード" value={newPw} onChange={setNewPw} placeholder="新しいパスワード" autoComplete="new-password" />
          <PasswordField label="新しいパスワード（確認）" value={newPw2} onChange={setNewPw2} onEnter={submitNewPassword} placeholder="新しいパスワード（確認）" autoComplete="new-password" />
          <ul className="rounded-lg px-3 py-2 text-[11px] leading-relaxed" style={{ background: T.bgBase, color: T.textMuted }}>
            <li>パスワード条件: {PASSWORD_REQUIREMENTS.join("・")}</li>
          </ul>
          <button type="button" onClick={submitNewPassword} disabled={busy} className="feeps-login-cta w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ background: T.accent }}>
            {busy ? "変更中…" : "パスワードを変更"}
          </button>
          <button type="button" onClick={resendCode} disabled={busy || cooldown > 0} className="w-full text-center text-xs font-semibold disabled:opacity-50" style={{ color: T.accent }}>
            {cooldown > 0 ? `確認コードを再送（${cooldown}秒後に再送可能）` : "確認コードを再送"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: T.textMuted }}>
        <ArrowLeft size={14} />ログインへ戻る
      </button>
      <h2 className="text-2xl font-bold" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>パスワードを再設定</h2>
      <p className="mt-1 text-sm" style={{ color: T.textMuted }}>登録済みのメールアドレスへ確認コードを送信します。</p>
      <div className="mt-6 space-y-4">
        {err && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: T.dangerSubtle, color: T.danger }}>{err}</div>}
        <label className="block">
          <div className="mb-1.5 text-xs font-semibold" style={{ color: T.textSecondary }}>メールアドレス</div>
          <div className="feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
            <Mail size={16} style={{ color: T.textMuted }} />
            <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendCode(); }} type="email" autoComplete="username" placeholder="name@example.com" className="w-full bg-transparent py-3 text-sm outline-none" style={{ color: T.textPrimary }} />
          </div>
        </label>
        <button type="button" onClick={sendCode} disabled={busy} className="feeps-login-cta w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ background: T.accent }}>
          {busy ? "送信中…" : "確認コードを送信"}
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

  const loginRate = useCountUp(86.2, { decimals: 1 });

  if (screen === "legal:terms" || screen === "legal:privacy") {
    return <StandaloneLegalPage doc={screen === "legal:privacy" ? "privacy" : "terms"} onBack={() => setScreen("login")} />;
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]" style={{ background: T.bgBase, minHeight: "100dvh", fontFamily: "'Inter','Noto Sans JP',sans-serif" }}>
      {/* ===== 左: 製品ショーケース ===== */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex" style={{ borderRight: `1px solid ${T.border}` }}>
        <svg className="pointer-events-none absolute -right-24 -top-24" width="520" height="520" viewBox="0 0 520 520" fill="none" aria-hidden="true">
          <circle cx="260" cy="260" r="160" stroke="rgba(124,92,224,0.10)" strokeWidth="1.5" />
          <circle cx="260" cy="260" r="230" stroke="rgba(61,107,255,0.08)" strokeWidth="1.5" />
        </svg>
        <div className="feeps-stagger-in relative flex items-center gap-2.5" style={{ animationDelay: "0ms" }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: T.accent }}><TrendingUp size={20} color="#fff" /></span>
          <span className="text-lg font-bold" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>{BRAND.name}</span>
        </div>

        <div className="relative">
          <h1 className="feeps-stagger-in text-4xl font-bold leading-snug" style={{ color: T.textPrimary, letterSpacing: "-0.02em", animationDelay: "80ms" }}>企業研修を「学ぶ」で<br />終わらせない。</h1>
          <p className="feeps-stagger-in mt-4 max-w-md text-sm leading-relaxed" style={{ color: T.textSecondary, animationDelay: "160ms" }}>
            研修管理、Eラーニング、AI問題作成、スキル可視化まで。ひとつにつながる人材育成プラットフォーム。
          </p>

          <div className="relative mt-10 h-[330px] max-w-lg">
            <div className="feeps-stagger-in absolute left-0 top-0 w-[62%]" style={{ animationDelay: "300ms" }}>
              <div className="feeps-float rounded-xl p-5" style={{ background: "#fff", border: `1px solid ${T.border}`, boxShadow: "0 12px 32px rgba(26,28,32,.07)", animationDuration: "7s" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: T.textMuted, letterSpacing: "0.06em" }}>スキル達成率</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: T.successSubtle, color: T.success }}>+12% 前月比</span>
                </div>
                <div className="mt-2 text-4xl font-bold" style={{ color: T.textPrimary, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                  {loginRate.toFixed(1)}<span className="text-base font-semibold" style={{ color: T.textMuted }}>%</span>
                </div>
                <svg className="mt-3 w-full" viewBox="0 0 240 60" fill="none" aria-hidden="true">
                  <path className="feeps-draw" style={{ animationDelay: "700ms" }} pathLength="1" d="M4 50 L36 44 L68 46 L100 36 L132 40 L164 28 L196 30 L236 14" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div className="feeps-stagger-in absolute right-0 top-[108px] w-[56%]" style={{ animationDelay: "400ms" }}>
              <div className="feeps-float rounded-xl p-4" style={{ background: "#fff", border: `1px solid ${T.border}`, boxShadow: "0 12px 32px rgba(26,28,32,.08)", animationDuration: "6s", animationDelay: "-2s" }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: T.aiAccentDeep }}><Sparkles size={13} color="#fff" /></span>
                    <span className="text-sm font-bold" style={{ color: T.textPrimary }}>AI問題生成</span>
                  </div>
                  <span className="text-[11px] font-semibold" style={{ color: T.aiAccent }}>生成中…</span>
                </div>
                <div className="feeps-shimmer mt-3 h-1.5 w-full rounded-full" />
                <div className="mt-3 space-y-2">
                  <div className="h-2 w-[85%] rounded-full" style={{ background: T.border }} />
                  <div className="h-2 w-[70%] rounded-full" style={{ background: T.border }} />
                  <div className="h-2 w-[78%] rounded-full" style={{ background: T.border }} />
                </div>
              </div>
            </div>
            <div className="feeps-stagger-in absolute bottom-0 left-[8%] w-[52%]" style={{ animationDelay: "500ms" }}>
              <div className="feeps-float rounded-xl p-4" style={{ background: "#fff", border: `1px solid ${T.border}`, boxShadow: "0 12px 32px rgba(26,28,32,.07)", animationDuration: "8s", animationDelay: "-4s" }}>
                <div className="text-xs font-semibold" style={{ color: T.textMuted, letterSpacing: "0.06em" }}>研修進捗</div>
                <div className="mt-3 space-y-3">
                  {[["Java基礎", 78], ["AWS入門", 45]].map(([name, pct]) => (
                    <div key={name} className="flex items-center gap-2.5">
                      <span className="w-16 shrink-0 text-xs font-semibold" style={{ color: T.textPrimary }}>{name}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: T.border }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: T.accent }} />
                      </div>
                      <span className="shrink-0 text-xs" style={{ color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="feeps-stagger-in relative flex items-center justify-between text-xs" style={{ color: T.textMuted, animationDelay: "600ms" }}>
          <div className="flex items-center gap-3">
            {["研修管理", "AI活用", "スキル可視化"].map((f, i) => (
              <React.Fragment key={f}>
                {i > 0 && <span style={{ color: T.border }}>・</span>}
                <span className="font-semibold">{f}</span>
              </React.Fragment>
            ))}
          </div>
          <span>© 2026 Feeps Inc.</span>
        </div>
      </div>

      {/* ===== 右: ログインフォーム / パスワード再設定フロー ===== */}
      <div className="feeps-fade-in flex flex-col items-center justify-center p-6 sm:p-12" style={{ background: T.bgSurface }}>
        <div className="mb-4 lg:hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accent }}><TrendingUp size={18} color="#fff" /></span>
            <span className="text-lg font-bold" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>{BRAND.name}</span>
          </div>
        </div>

        {screen === "forgot" ? (
          <ForgotPasswordFlow onBack={() => setScreen("login")} />
        ) : (
          <div className="w-full max-w-sm">
            <h2 className="text-2xl font-bold" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>ログイン</h2>
            <p className="mt-1 text-sm" style={{ color: T.textMuted }}>アカウント情報を入力してください</p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <div className="mb-1.5 text-xs font-semibold" style={{ color: T.textSecondary }}>メールアドレス</div>
                <div className="feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
                  <Mail size={16} style={{ color: T.textMuted }} />
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" type="email" autoComplete="username" className="w-full bg-transparent py-3 text-sm outline-none" style={{ color: T.textPrimary }} />
                </div>
              </label>
              <label className="block">
                <div className="mb-1.5 text-xs font-semibold" style={{ color: T.textSecondary }}>パスワード</div>
                <div className="feeps-login-field flex items-center gap-2 rounded-xl px-3" style={loginFieldVars}>
                  <Lock size={16} style={{ color: T.textMuted }} />
                  <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleLogin(); }} placeholder="パスワード" autoComplete="current-password" className="w-full bg-transparent py-3 text-sm outline-none" style={{ color: T.textPrimary }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"} className="flex h-11 w-11 shrink-0 -mr-2 items-center justify-center rounded" style={{ color: T.textMuted }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              {err && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: needNewPw ? T.warningSubtle : T.dangerSubtle, color: needNewPw ? T.warning : T.danger }}>{err}</div>}
              {needNewPw && (
                <PasswordField label="新しいパスワード" value={newPw} onChange={setNewPw} onEnter={handleNewPassword} placeholder="新しいパスワード" autoComplete="new-password" />
              )}
              {needNewPw
                ? <button type="button" onClick={handleNewPassword} disabled={busy} className="feeps-login-cta w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ background: T.accent }}>{busy ? "設定中…" : "パスワードを設定して続行"}</button>
                : <button type="button" onClick={handleLogin} disabled={busy} className="feeps-login-cta w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ background: T.accent }}>{busy ? "ログイン中…" : "ログイン"}</button>}
              <button type="button" onClick={() => { setErr(""); setScreen("forgot"); }} className="w-full text-center text-xs font-semibold" style={{ color: T.accent }}>パスワードをお忘れですか？</button>
            </div>
          </div>
        )}

        <div className="mt-10 flex items-center gap-3 text-[11px]" style={{ color: T.textMuted }}>
          <button type="button" onClick={() => setScreen("legal:terms")} className="hover:underline">利用規約</button>
          <span style={{ color: T.border }}>・</span>
          <button type="button" onClick={() => setScreen("legal:privacy")} className="hover:underline">プライバシーポリシー</button>
        </div>
      </div>
    </div>
  );
}
