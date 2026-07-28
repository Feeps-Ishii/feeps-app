import React, { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { fetchMFAPreference, setUpTOTP, verifyTOTPSetup, updateMFAPreference } from "aws-amplify/auth";
import { ShieldCheck, Copy, Check, KeyRound } from "lucide-react";
import { T } from "../../components/common/theme.js";

// 二要素認証（TOTP＝認証アプリのワンタイムコード）の設定・入力UI。
// ログイン中（Login.jsx）とログイン後（プロフィール／管理者の必須設定）の両方から使う。
// 検証の呼び先はフローによって違う（サインイン中は confirmSignIn、ログイン後は verifyTOTPSetup）ため、
// 実際の検証処理は onVerify で受け取る。

const ISSUER = "Feeps One";

export const CODE_INPUT_PROPS = {
  inputMode: "numeric",
  autoComplete: "one-time-code",
  maxLength: 6,
  placeholder: "123456",
};

function fieldStyle() {
  return { border: `1px solid ${T.border}`, color: T.textPrimary, background: T.bgSurface };
}

// 6桁コードの入力欄。設定時とログイン時で共通。
export function TotpCodeField({ value, onChange, onSubmit, label = "認証アプリに表示されている6桁のコード", autoFocus = false }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-semibold" style={{ color: T.textPrimary }}>{label}</div>
      <input
        {...CODE_INPUT_PROPS}
        value={value}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        onKeyDown={e => { if (e.key === "Enter") onSubmit?.(); }}
        className="w-full rounded-xl px-3 py-3 text-center text-lg font-bold tracking-[0.4em] outline-none"
        style={fieldStyle()}
      />
    </label>
  );
}

// 認証アプリ登録パネル（QRコード＋手入力用キー＋コード確認）。
// setupUri / sharedSecret は Cognito が発行した値をそのまま使う。
export function TotpSetupPanel({ email, sharedSecret, setupUri, onVerify, busy, error, submitLabel = "設定を完了する" }) {
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);

  const uri = setupUri || (sharedSecret
    ? `otpauth://totp/${encodeURIComponent(ISSUER)}:${encodeURIComponent(email || "user")}?secret=${sharedSecret}&issuer=${encodeURIComponent(ISSUER)}`
    : "");

  useEffect(() => {
    let active = true;
    if (!uri) { setQr(""); return undefined; }
    QRCode.toDataURL(uri, { width: 216, margin: 1 })
      .then(url => { if (active) setQr(url); })
      .catch(() => { if (active) setQr(""); });
    return () => { active = false; };
  }, [uri]);

  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(sharedSecret || "");
      setCopied(true);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (e) { /* クリップボードが使えない環境では手入力してもらう */ }
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-1.5 text-sm" style={{ color: T.textSecondary }}>
        <li>1. スマートフォンに認証アプリ（Google Authenticator、Microsoft Authenticator など）を入れる</li>
        <li>2. アプリで「アカウントを追加」→ 下のQRコードを読み取る</li>
        <li>3. アプリに表示された6桁のコードを入力する</li>
      </ol>

      <div className="flex flex-col items-center gap-3 rounded-xl p-4" style={{ background: T.bgBase, border: `1px solid ${T.border}` }}>
        {qr
          ? <img src={qr} alt="認証アプリ登録用のQRコード" width={216} height={216} style={{ borderRadius: 8, background: "#fff" }} />
          : <div className="py-8 text-sm" style={{ color: T.textMuted }}>QRコードを準備しています…</div>}
        {sharedSecret && (
          <div className="w-full">
            <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>QRコードを読み取れないときは、この設定キーを手入力してください</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg px-2 py-1.5 text-xs" style={{ background: T.bgSurface, border: `1px solid ${T.border}`, color: T.textPrimary }}>{sharedSecret}</code>
              <button type="button" onClick={copySecret} className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold" style={{ background: T.accentSubtle, color: T.accentHover }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "コピーしました" : "コピー"}
              </button>
            </div>
          </div>
        )}
      </div>

      <TotpCodeField value={code} onChange={setCode} onSubmit={() => onVerify(code)} />
      {error && <div className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: T.dangerSubtle, color: T.danger }} role="alert">{error}</div>}
      <button
        type="button"
        onClick={() => onVerify(code)}
        disabled={busy || code.length < 6}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        style={{ background: T.accent }}
      >
        <ShieldCheck size={16} />{busy ? "確認中…" : submitLabel}
      </button>
    </div>
  );
}

// ログイン後に「自分の二要素認証が有効かどうか」を確認する。
// 取得に失敗したときは "error" を返し、未設定（＝未保護）と混同させない。
export function useMfaStatus(enabled = true) {
  const [status, setStatus] = useState("loading");
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    if (!enabled) { setStatus("loading"); return undefined; }
    let active = true;
    setStatus("loading");
    fetchMFAPreference()
      .then(pref => {
        if (!active) return;
        setStatus((pref?.enabled || []).includes("TOTP") ? "enabled" : "disabled");
      })
      .catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [enabled, version]);
  return { status, reload };
}

// ログイン後の認証アプリ登録フロー（プロフィール画面と管理者の必須設定画面で共通）。
export function TotpEnrollment({ email, onDone }) {
  const [details, setDetails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // setUpTOTP はCognito側で同時実行できない（2回同時に呼ぶと ConcurrentModification になる）。
  // StrictModeの二重実行や再レンダーでも1回だけ走るよう、実行中のPromiseを保持して共有する。
  const setupPromiseRef = useRef(null);

  useEffect(() => {
    let active = true;
    setError("");
    if (!setupPromiseRef.current) setupPromiseRef.current = setUpTOTP();
    setupPromiseRef.current
      .then(result => {
        if (!active) return;
        let uri = "";
        try { uri = result?.getSetupUri?.(ISSUER, email || "user")?.toString() || ""; } catch (e) { uri = ""; }
        setDetails({ sharedSecret: result?.sharedSecret || "", uri });
      })
      .catch(e => {
        setupPromiseRef.current = null;
        if (active) setError(e?.message || "設定を開始できませんでした。時間をおいて再試行してください。");
      });
    return () => { active = false; };
  }, [email]);

  async function verify(code) {
    if (busy) return;
    setError("");
    if (!code || code.length < 6) { setError("6桁のコードを入力してください。"); return; }
    setBusy(true);
    try {
      await verifyTOTPSetup({ code });
      await updateMFAPreference({ totp: "PREFERRED" });
      onDone?.();
    } catch (e) {
      const n = e?.name || "";
      if (n === "CodeMismatchException" || n === "EnableSoftwareTokenMFAException") setError("コードが一致しません。認証アプリの表示を確認して、もう一度入力してください。");
      else setError(e?.message || "設定に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  if (error && !details) return <div className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: T.dangerSubtle, color: T.danger }} role="alert">{error}</div>;
  if (!details) return <div className="py-6 text-center text-sm" style={{ color: T.textMuted }}>設定を準備しています…</div>;
  return <TotpSetupPanel email={email} sharedSecret={details.sharedSecret} setupUri={details.uri} onVerify={verify} busy={busy} error={error} />;
}

// 二要素認証が未設定のときにログイン後へ出すお知らせ。設定は任意なので閉じて先へ進める。
export function MfaSuggestionDialog({ onOpenProfile, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(20,24,36,0.45)" }} role="dialog" aria-modal="true" aria-labelledby="mfa-suggestion-title">
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: T.bgSurface, border: `1px solid ${T.border}`, boxShadow: "0 24px 60px rgba(16,20,32,0.28)" }}>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentSubtle, color: T.accentHover }}><ShieldCheck size={18} /></span>
          <h2 id="mfa-suggestion-title" className="text-base font-bold" style={{ color: T.textPrimary }}>二要素認証を設定できます</h2>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: T.textSecondary }}>
          パスワードに加えて認証アプリの6桁コードを使うと、パスワードが漏れた場合でも他人がログインできなくなります。
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: T.textSecondary }}>
          設定は<strong>プロフィール画面</strong>からいつでも行え、解除もできます。コードを聞かれるのは初めての端末のときと、前回の確認から14日が過ぎたときだけです。
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={onOpenProfile} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: T.accent }}>
            プロフィールを開く
          </button>
          <button type="button" onClick={onClose} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ border: `1px solid ${T.border}`, color: T.textSecondary }}>
            あとで設定する
          </button>
        </div>
      </div>
    </div>
  );
}

// プロフィール画面のセキュリティカード。設定状況の確認と、設定・解除を行う。
export function MfaSettingsCard({ email }) {
  const { status, reload } = useMfaStatus(true);
  const [enrolling, setEnrolling] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function disable() {
    if (busy) return;
    setConfirmingDisable(false);
    setBusy(true); setMessage("");
    try {
      await updateMFAPreference({ totp: "DISABLED" });
      reload();
      setMessage("二要素認証を解除しました。");
    } catch (e) {
      setMessage("解除に失敗しました: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const label = status === "loading" ? "確認中…"
    : status === "error" ? "状態を確認できません"
    : status === "enabled" ? "有効（認証アプリ）"
    : "未設定";
  const labelColor = status === "enabled" ? T.success : status === "error" ? T.textMuted : T.warning;

  return (
    <div className="rounded-2xl" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: T.textMuted }}>セキュリティ</div>
      </div>
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold" style={{ color: T.textPrimary }}>二要素認証</div>
            <div className="text-xs" style={{ color: T.textMuted }}>ログイン時に認証アプリの6桁コードを追加で確認します</div>
          </div>
          <span className="rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: T.bgBase, color: labelColor }}>{label}</span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: T.textMuted }}>
          コードを求めるのは、初めてのデバイスでログインしたときと、前回の確認から14日が過ぎたときだけです。普段のログインでは入力しません。
        </p>
        {status === "disabled" && !enrolling && (
          <button type="button" onClick={() => { setMessage(""); setEnrolling(true); }} className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: T.accent }}>
            <ShieldCheck size={15} className="mr-1.5 inline" />二要素認証を設定する
          </button>
        )}
        {status === "enabled" && !confirmingDisable && (
          <button type="button" onClick={() => { setMessage(""); setConfirmingDisable(true); }} className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ border: `1px solid ${T.border}`, color: T.textSecondary }}>
            二要素認証を解除する
          </button>
        )}
        {status === "enabled" && confirmingDisable && (
          <div className="space-y-2 rounded-xl px-3 py-3" style={{ background: T.warningSubtle }}>
            <div className="text-sm font-semibold" style={{ color: T.warning }}>解除すると、ログインはパスワードだけになります。よろしいですか？</div>
            <div className="flex gap-2">
              <button type="button" onClick={disable} disabled={busy} className="flex-1 rounded-lg px-3 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: T.warning }}>
                {busy ? "解除中…" : "解除する"}
              </button>
              <button type="button" onClick={() => setConfirmingDisable(false)} className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: `1px solid ${T.border}`, color: T.textSecondary }}>
                やめる
              </button>
            </div>
          </div>
        )}
        {enrolling && <TotpEnrollment email={email} onDone={() => { setEnrolling(false); reload(); setMessage("二要素認証を有効にしました。"); }} />}
        {message && <div className="text-sm font-semibold" style={{ color: message.includes("失敗") ? T.danger : T.success }}>{message}</div>}
      </div>
    </div>
  );
}

// ログイン時のコード入力（すでに認証アプリを登録済みのユーザー向け）。
export function TotpChallengePanel({ onVerify, busy, error, note }) {
  const [code, setCode] = useState("");
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm" style={{ background: T.accentSubtle, color: T.textPrimary }}>
        <KeyRound size={17} className="mt-0.5 shrink-0" />
        <span>{note || "認証アプリに表示されている6桁のコードを入力してください。"}</span>
      </div>
      <TotpCodeField value={code} onChange={setCode} onSubmit={() => onVerify(code)} autoFocus />
      {error && <div className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: T.dangerSubtle, color: T.danger }} role="alert">{error}</div>}
      <button
        type="button"
        onClick={() => onVerify(code)}
        disabled={busy || code.length < 6}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        style={{ background: T.accent }}
      >
        <ShieldCheck size={16} />{busy ? "確認中…" : "ログインする"}
      </button>
    </div>
  );
}
