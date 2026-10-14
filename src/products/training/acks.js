// 受講生の「確認しました」の印（2026-10-14）。お知らせ・講師の当日連絡・日報コメントは、
// 確認ボタンを押すまで通知に残す。保存先は PUT /notifications/acks（PROFILES の acks）
import { apiGet, apiPut } from "../../api.js";

export const ackKey = {
  announcement: id => `anc#${id}`,
  dailyNote: (courseId, date) => `note#${courseId}#${date}`,
  reportComment: r => `rc#${r?.date}#${r?.lastCommentAt || latestCommentAt(r)}`,
};

export function latestCommentAt(r) {
  const list = Array.isArray(r?.comments) ? r.comments : [];
  return list.reduce((m, c) => (String(c?.createdAt || "") > m ? String(c.createdAt) : m), "") || r?.commentedAt || "";
}

export const hasStaffComment = r => !!r?.comment || (Array.isArray(r?.comments) && r.comments.length > 0);

export async function loadAcks() {
  const r = await apiGet("/notifications/acks");
  return r?.acks || {};
}

export async function ackKeys(keys) {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (!list.length) return null;
  const r = await apiPut("/notifications/acks", { keys: list });
  try { window.dispatchEvent(new Event("feeps:notifications-refresh")); } catch (e) { /* 通知の読み直しは次の画面遷移でも行う */ }
  return r?.acks || null;
}
