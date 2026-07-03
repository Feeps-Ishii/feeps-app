import { NAV } from "./TrainingCatalog.js";

export const todayStr = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

export const statusKind = (status) => {
  const s = String(status || "");
  if (s.includes("?") || s.includes("?")) return "absent";
  if (s.includes("?") || s.includes("?")) return "late";
  return "present";
};

export const testIdOf = (t) => String(t?.testId ?? t?.id ?? "");

export function emitNotificationRefresh() {
  try { window.dispatchEvent(new Event("feeps:notifications-refresh")); } catch (e) {}
}

export const navViewSet = role => new Set([...(NAV[role] || []).flatMap(g => g.items.map(([k]) => k)), "notifications", "profile"]);

export default function useTraining() {
  return { todayStr, statusKind, testIdOf, emitNotificationRefresh, navViewSet };
}
