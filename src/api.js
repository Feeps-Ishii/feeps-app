import { fetchAuthSession } from "aws-amplify/auth";

const BASE = "https://yit7ypsa40.execute-api.ap-northeast-1.amazonaws.com";

async function authHeaders() {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  return idToken ? { authorization: "Bearer " + idToken } : {};
}

async function throwApiError(res, path, method) {
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  const err = new Error(`${method} ${path} ${res.status}`);
  err.status = res.status;
  err.data = data;
  err.errorCode = data?.errorCode;
  err.errorMessage = data?.errorMessage || data?.detail || data?.error;
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
