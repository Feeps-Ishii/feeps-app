import { NAV } from "./TrainingCatalog.js";

export const todayStr = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

// TrainingComponents.jsxのattendanceStatusLabelと同じ判定基準（raw statusは英語/日本語どちらでも
// 保存され得るため両方を見る）。以前は文字化けした比較文字列("?")のため欠席/遅刻が常にヒットせず、
// AdminHomeの「本日のアラート」欠席集計が機能していなかった(Phase7-1監査で発見、Phase7-2で修正)。
export const statusKind = (status) => {
  const s = String(status || "").toLowerCase();
  if (s.includes("absent") || s.includes("欠")) return "absent";
  if (s.includes("late") || s.includes("遅")) return "late";
  if (s.includes("early") || s.includes("早")) return "early";
  if (s.includes("fixed") || s.includes("修正")) return "fixed";
  if (s.includes("incomplete") || s.includes("missing") || s.includes("未")) return "incomplete";
  return "present";
};

export const testIdOf = (t) => String(t?.testId ?? t?.id ?? "");

// 「9月10日（木）」。ホームの日付は年より曜日のほうが役に立つ（4ロール共通、2026-09-10）。
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];
export function homeDateLabel(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return String(iso || "");
  return `${m}月${d}日（${WEEKDAY_JA[new Date(y, m - 1, d).getDay()]}）`;
}

export function emitNotificationRefresh() {
  try { window.dispatchEvent(new Event("feeps:notifications-refresh")); } catch (e) {}
}

export const navViewSet = role => new Set([...(NAV[role] || []).flatMap(g => g.items.map(([k]) => k)), "notifications", "profile", "plans", "terms", "privacy"]);
