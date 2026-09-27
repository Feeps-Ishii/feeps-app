// Cognito の idToken からロールを読む（表示の出し分け用。権限の判定は API 側で行う）
export function roleOf(payload = {}) {
  const claimed = String(payload?.["custom:role"] || payload?.role || "").toLowerCase();
  if (["admin", "instructor", "client", "trainee"].includes(claimed)) return claimed;
  const raw = payload?.["cognito:groups"] ?? payload?.groups ?? [];
  const g = (Array.isArray(raw) ? raw.join(",") : String(raw)).toLowerCase();
  return g.includes("admin") ? "admin" : g.includes("instructor") ? "instructor" : g.includes("client") ? "client" : "trainee";
}

export const isStaffRole = (role) => role === "admin" || role === "instructor";
