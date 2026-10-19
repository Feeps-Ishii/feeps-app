import { fetchAuthSession } from "aws-amplify/auth";

const BASE = "https://yit7ypsa40.execute-api.ap-northeast-1.amazonaws.com";

// 管理者のロール切り替え（表示確認用ビュー）: 実ロールがadminのユーザーが別ロールの
// 画面を確認しているとき、TrainingApp.jsxがここへ現在の表示ロールを渡す。
// Backend(getAuthContext)は「管理者からの降格リクエストのみ」有効とし、他ロールが
// このヘッダーを付けても無視する（昇格には使えない）。詳細: docs/api/api-routes.md
let viewRoleOverride = null;
export function setViewRoleOverride(role) {
  viewRoleOverride = role || null;
}

async function authHeaders() {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  const headers = idToken ? { authorization: "Bearer " + idToken } : {};
  if (viewRoleOverride) headers["x-feeps-view-role"] = viewRoleOverride;
  return headers;
}

// API が返す決まった理由（英字の名前）を、画面に出せる文に読みかえる（個人のプラン、2026-10-20、ADR 0029）
const ERROR_TEXT = {
  plan_required: "この機能は Pro プランで使えます。アカウントの「プランと支払い」から変更できます。",
  aws_hours_exceeded: "今月の本物の AWS の時間を使い切りました。来月になると、また使えます。",
  individual_not_allowed: "この画面は個人のアカウントでは使えません。",
};

async function throwApiError(res, path, method) {
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  const err = new Error(`${method} ${path} ${res.status}`);
  err.status = res.status;
  err.data = data;
  err.errorCode = data?.errorCode;
  err.errorMessage = data?.errorMessage || data?.detail || ERROR_TEXT[data?.error] || data?.error;
  err.hint = data?.hint;
  throw err;
}

export async function apiGet(path) {
  const res = await fetch(BASE + path, { headers: await authHeaders() });
  if (!res.ok) await throwApiError(res, path, "GET");
  return res.json();
}

export async function apiPut(path, body) {
  const res = await fetch(BASE + path, {
    method: "PUT",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwApiError(res, path, "PUT");
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) await throwApiError(res, path, "POST");
  return res.json();
}

export async function apiDelete(path) {
  const res = await fetch(BASE + path, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) await throwApiError(res, path, "DELETE");
  return res.json();
}
