import { fetchAuthSession } from "aws-amplify/auth";

const API_BASE = "https://yit7ypsa40.execute-api.ap-northeast-1.amazonaws.com";

export async function apiDelete(path) {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  const res = await fetch(API_BASE + path, {
    method: "DELETE",
    headers: idToken ? { authorization: "Bearer " + idToken } : {},
  });
  if (!res.ok) throw new Error("DELETE " + path + " " + res.status);
  return res.json();
}

export default function useAdmin() {
  return { apiDelete };
}
