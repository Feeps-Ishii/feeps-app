import QRCode from "qrcode";
import { signIn, signOut, confirmSignIn, resetPassword, confirmResetPassword, rememberDevice, signInWithRedirect } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { GOOGLE_LOGIN } from "../../../aws.js";

/* 入口（mountEntry）のログイン画面が使う、本番の認証（Cognito）。
   流れは本番のテノラボのログインと同じ：ログイン → 確認コード／初回のパスワード設定 → 認証アプリの登録、
   パスワードの再設定（メールにコード → 新しいパスワード）。
   どれも成功すれば { next } を返し、失敗は画面に出せる日本語の文で Error を投げる。 */
const ISSUER = "Feeps";

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
const fail = msg => { throw new Error(msg); };

// Cognito の次の段階を、画面の段階（done / totp / newpw / totpSetup）に読みかえる
async function next(result, email) {
  const s = result?.nextStep?.signInStep;
  if (result?.isSignedIn || s === "DONE") {
    // この端末を覚えて、次からは確認コードを省く（覚えられない環境でもログインは続ける）
    try { await rememberDevice(); } catch (e) { /* 毎回コードを求めるだけ */ }
    return { next: "done" };
  }
  if (s === "CONFIRM_SIGN_IN_WITH_TOTP_CODE") return { next: "totp" };
  if (s === "CONTINUE_SIGN_IN_WITH_MFA_SELECTION") return next(await confirmSignIn({ challengeResponse: "TOTP" }), email);
  if (s === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") return { next: "newpw" };
  if (s === "CONTINUE_SIGN_IN_WITH_TOTP_SETUP") {
    const d = result.nextStep.totpSetupDetails;
    let uri = "";
    try { uri = d?.getSetupUri?.(ISSUER, email)?.toString() || ""; } catch (e) { uri = ""; }
    let qr = "";
    try { qr = uri ? await QRCode.toDataURL(uri, { width: 240, margin: 1 }) : ""; } catch (e) { qr = ""; }
    return { next: "totpSetup", setup: { secret: d?.sharedSecret || "", qr } };
  }
  try { await signOut(); } catch (e) { /* 抜けられなくても案内は出す */ }
  return fail("このアカウントは、いまはログインできません。お勤め先の研修担当に問い合わせてください。");
}

let currentEmail = "";

/* Google のログイン（2026-10-17、ADR 0028）。Google から戻ってきた結果は、画面ができる前に届くことがあるので、
   読み込んだ時点で受け取っておき、onGoogleResult で渡す。断られた理由（DH_…）は登録前の判定（cognitoPreSignUp）が付ける */
const GOOGLE_ERRORS = {
  DH_NO_ACCOUNT: "この Google アカウントのメールアドレスは登録されていません。登録したメールアドレスとパスワードでログインしてください。",
  DH_PASSWORD_ONLY: "このアカウントは、メールアドレスとパスワードでログインしてください。",
  DH_UNVERIFIED: "Google アカウントのメールアドレスを確かめられませんでした。",
  access_denied: "Google のログインを取りやめました。",
};
const RETRY_KEY = "devhub.googleRetry";
const session = {
  get: () => { try { return sessionStorage.getItem(RETRY_KEY); } catch (e) { return null; } },
  set: () => { try { sessionStorage.setItem(RETRY_KEY, "1"); } catch (e) { /* 保存できなくても続ける */ } },
  clear: () => { try { sessionStorage.removeItem(RETRY_KEY); } catch (e) { /* 同上 */ } },
};
let googleResult = null;
let googleListener = null;
const deliver = r => { if (googleListener) googleListener(r); else googleResult = r; };
if (GOOGLE_LOGIN) {
  Hub.listen("auth", ({ payload }) => {
    if (payload.event === "signInWithRedirect") { session.clear(); deliver({ ok: true }); }
    if (payload.event !== "signInWithRedirect_failure") return;
    const msg = String(payload.data?.error?.message || "");
    // 今のアカウントに Google をつないだ直後の1回だけ断られる。もう一度 Google へ送れば、そのまま入れる
    if (msg.includes("DH_LINKED") && !session.get()) {
      session.set();
      signInWithRedirect({ provider: "Google" }).catch(() => deliver({ error: "Google でログインできませんでした。もう一度試してください。" }));
      return;
    }
    session.clear();
    const code = Object.keys(GOOGLE_ERRORS).find(k => msg.includes(k));
    deliver({ error: code ? GOOGLE_ERRORS[code] : "Google でログインできませんでした。もう一度試してください。" });
  });
}

export const entryAuth = {
  googleEnabled: GOOGLE_LOGIN,
  async google() {
    try {
      await signInWithRedirect({ provider: "Google" });
      return { next: "redirect" };
    } catch (x) {
      if (x?.name === "UserAlreadyAuthenticatedException") return { next: "done" };
      return fail("Google のログインを始められませんでした。もう一度試してください。");
    }
  },
  // Google から戻ってきた結果（{ ok } か { error }）を1回だけ渡す。返り値で受け取りをやめる
  onGoogleResult(cb) {
    googleListener = cb;
    if (googleResult) { const r = googleResult; googleResult = null; cb(r); }
    return () => { if (googleListener === cb) googleListener = null; };
  },
  async signIn(email, password) {
    currentEmail = email.trim();
    try {
      try { await signOut(); } catch (x) { /* 前のセッションが無ければそのまま */ }
      return await next(await signIn({ username: currentEmail, password }), currentEmail);
    } catch (x) {
      if (x instanceof Error && !x.name?.endsWith("Exception")) throw x;
      const n = x?.name || "";
      if (n === "UserNotFoundException" || n === "NotAuthorizedException") fail("メールアドレスかパスワードが違います。");
      if (n === "UserNotConfirmedException") fail("メールアドレスの確認がまだ終わっていません。お勤め先の研修担当に問い合わせてください。");
      return fail(authError(x, "ログインできませんでした。通信状況を確かめて、もう一度試してください。"));
    }
  },
  async confirmCode(code) {
    try {
      return await next(await confirmSignIn({ challengeResponse: code }), currentEmail);
    } catch (x) {
      if (x?.name === "NotAuthorizedException") fail("時間が切れました。最初からログインし直してください。");
      if (x instanceof Error && !x.name?.endsWith("Exception")) throw x;
      return fail(authError(x, "コードを確かめられませんでした。"));
    }
  },
  async newPassword(password) {
    try {
      return await next(await confirmSignIn({ challengeResponse: password }), currentEmail);
    } catch (x) {
      if (x?.name === "NotAuthorizedException") fail("時間が切れました。最初からログインし直してください。");
      if (x instanceof Error && !x.name?.endsWith("Exception")) throw x;
      return fail(authError(x, "パスワードを設定できませんでした。"));
    }
  },
  async cancel() {
    try { await signOut(); } catch (x) { /* 抜けられなくても入力画面へ戻す */ }
  },
  // アカウントがあるかどうかは言わない（無くても「送りました」）
  async sendReset(email) {
    try {
      await resetPassword({ username: email.trim() });
    } catch (x) {
      if (x?.name !== "UserNotFoundException") fail(authError(x, "確認コードを送れませんでした。"));
    }
  },
  async confirmReset(email, code, password) {
    try {
      await confirmResetPassword({ username: email.trim(), confirmationCode: code, newPassword: password });
    } catch (x) {
      fail(authError(x, "パスワードを変えられませんでした。"));
    }
  },
};
