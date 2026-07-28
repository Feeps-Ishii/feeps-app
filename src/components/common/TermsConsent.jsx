import React, { useState } from "react";
import { FileText, ShieldCheck, X } from "lucide-react";
import { T } from "./theme.js";
import { TERMS_VERSION, TermsOfServiceContent, PrivacyPolicyContent } from "./LegalPages.jsx";
import { apiPut } from "../../api.js";

// 利用規約・プライバシーポリシーへの同意。
// 新規の利用者は初回パスワード設定の画面でチェックしてもらい（Login.jsx）、
// すでにパスワードを変更済みの利用者にはログイン後にこのダイアログを出す。
// 同意はサーバーへ記録する（版と日時。日時はサーバー側の時刻）。

export { TERMS_VERSION };

export async function recordTermsAgreement() {
  return apiPut("/profile/me/terms", { termsVersion: TERMS_VERSION });
}

// プロフィールの記録を見て、同意が必要かどうかを判定する。
// 取得できていないときは求めない（読み込み中に一瞬ダイアログが出るのを防ぐ）。
export function needsTermsAgreement(userProfile) {
  if (!userProfile) return false;
  return userProfile.termsVersion !== TERMS_VERSION;
}

// 規約本文を読むための表示。同意のチェックボックスからも、ダイアログからも開く。
export function LegalReader({ doc, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4" style={{ background: "rgba(20,24,36,.5)" }} role="dialog" aria-modal="true">
      <div className="my-8 w-full max-w-2xl rounded-2xl" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
        <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
          <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{doc === "privacy" ? "プライバシーポリシー" : "利用規約"}</span>
          <button type="button" onClick={onClose} aria-label="閉じる" className="rounded-lg p-1.5" style={{ color: T.textMuted }}><X size={18} /></button>
        </div>
        <div className="px-6 py-4">{doc === "privacy" ? <PrivacyPolicyContent /> : <TermsOfServiceContent />}</div>
        <div className="px-6 pb-5">
          <button type="button" onClick={onClose} className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: T.accent }}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

// 同意のチェックボックス（規約へのリンク付き）。初回パスワード設定の画面と共用する。
export function TermsCheckbox({ checked, onChange, tone = "light" }) {
  const [reading, setReading] = useState("");
  const linkColor = tone === "light" ? T.accent : T.accent;
  return (
    <>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm" style={{ background: T.bgBase, border: `1px solid ${T.border}` }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" style={{ accentColor: T.accent }} />
        <span style={{ color: T.textSecondary }}>
          <button type="button" onClick={e => { e.preventDefault(); setReading("terms"); }} className="font-bold underline" style={{ color: linkColor }}>利用規約</button>
          と
          <button type="button" onClick={e => { e.preventDefault(); setReading("privacy"); }} className="font-bold underline" style={{ color: linkColor }}>プライバシーポリシー</button>
          に同意します
        </span>
      </label>
      {reading && <LegalReader doc={reading} onClose={() => setReading("")} />}
    </>
  );
}

// すでに利用中の人へ、ログイン後に同意を求めるダイアログ。同意するまで先へ進めない。
export function TermsAgreementDialog({ onAgreed, onSignOut }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function agree() {
    if (busy || !checked) return;
    setBusy(true); setError("");
    try {
      await recordTermsAgreement();
      onAgreed?.();
    } catch (e) {
      setError("同意の記録に失敗しました。通信状況を確認して、もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(20,24,36,.5)" }} role="dialog" aria-modal="true" aria-labelledby="terms-dialog-title">
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: T.bgSurface, border: `1px solid ${T.border}`, boxShadow: "0 24px 60px rgba(16,20,32,.28)" }}>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentSubtle, color: T.accentHover }}><FileText size={18} /></span>
          <h2 id="terms-dialog-title" className="text-base font-bold" style={{ color: T.textPrimary }}>ご利用にあたっての確認</h2>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: T.textSecondary }}>
          Feeps One をお使いいただくにあたり、利用規約とプライバシーポリシーへの同意をお願いしています。内容はリンクからご確認ください。
        </p>
        <div className="mt-4"><TermsCheckbox checked={checked} onChange={setChecked} /></div>
        {error && <div className="mt-3 rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: T.dangerSubtle, color: T.danger }} role="alert">{error}</div>}
        <button type="button" onClick={agree} disabled={!checked || busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-50" style={{ background: T.accent }}>
          <ShieldCheck size={16} />{busy ? "記録中…" : "同意して利用を開始する"}
        </button>
        <button type="button" onClick={onSignOut} className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ border: `1px solid ${T.border}`, color: T.textSecondary }}>
          ログアウトする
        </button>
      </div>
    </div>
  );
}
