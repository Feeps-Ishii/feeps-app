import { fetchAuthSession } from "aws-amplify/auth";

const BASE = "https://yit7ypsa40.execute-api.ap-northeast-1.amazonaws.com";

async function authHeaders() {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  return idToken ? { authorization: "Bearer " + idToken } : {};
}

export async function apiGet(path) {
  const res = await fetch(BASE + path, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`GET ${path} ${res.status}`);
  return res.json();
}

export async function apiPut(path, body) {
  const res = await fetch(BASE + path, {
    method: "PUT",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} ${res.status}`);
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} ${res.status}`);
  return res.json();
}
