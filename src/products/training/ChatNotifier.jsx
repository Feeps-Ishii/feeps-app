import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet, apiPost } from "../../api.js";
import { T, NOVA, Z } from "../../components/common";
import { MessageCircle, X } from "lucide-react";
import { FALLBACK_POLL_MS, isLive, onLiveChange, onSignal, watchChannels } from "../../realtime.js";

/* チームのチャットの新着（2026-10-02 ユーザー決定。CHANGELOG 192）
   - 未読を読み、ヘッダーに「新着チャット n」、新しい発言が来たら右上に小さく出す（LINEの通知のように）
   - 2026-10-25〜（ADR 0032）：読むのは「開いたとき・チャットの合図が来たとき・タブに戻ったとき」だけ。
     合図が届かない環境では60秒ごとに読む（それまでは20秒ごと）
   - 押すとそのチームのチャットを開く。開いているチームのぶんは数えず、出さない
   - ヘッダーはPC用・スマートフォン用の2か所にあるので、読み込みはこのファイルの中で1つにまとめる */

const TEAM_COLORS = ["#E07A5F", "#3D8A63", "#7454C7", "#B07C2E", "#2E86AB", "#D1495B", "#00798C", "#5C946E"];

let state = { total: 0, teams: [] };
let seen = null;            // teamId → 最後に見た新着のid（はじめの1回は通知を出さない）
let openTeam = "";          // いま開いているチャットのチーム
let focusTeam = "";         // 通知から開くチーム（チームの画面が受け取る）
let refs = 0, timer = 0, soon = 0;
let unwatch = () => {}, watchedKey = "", offSignal = () => {}, offLive = () => {};
const subs = new Set(), toastSubs = new Set();

function publish(teams) {
  const shown = teams.filter(t => t.teamId !== openTeam && t.unread > 0);
  state = { total: shown.reduce((a, t) => a + t.unread, 0), teams: shown };
  subs.forEach(f => f(state));
}
let lastTeams = [];
async function poll() {
  if (document.visibilityState !== "visible") return;
  try {
    const d = await apiGet("/teams/unread");
    const teams = Array.isArray(d?.teams) ? d.teams : [];
    // 合図のチャンネル（自分の今のチーム）。変わったときだけつなぎ直す
    const chs = Array.isArray(d?.channels) ? d.channels : [];
    const key = chs.slice().sort().join(",");
    if (key !== watchedKey) { unwatch(); unwatch = watchChannels(chs); watchedKey = key; }
    if (seen) teams.forEach(t => { if (t.latest && t.latest.id !== seen.get(t.teamId) && t.teamId !== openTeam) toastSubs.forEach(f => f(t)); });
    seen = new Map(teams.map(t => [t.teamId, t.latest?.id || ""]));
    lastTeams = teams;
    publish(teams);
  } catch { /* 次の回で読み直す */ }
}
// 合図が届くあいだは定期に読まない。届かないあいだだけ60秒ごと
function setFallback() {
  window.clearInterval(timer); timer = 0;
  if (!isLive()) timer = window.setInterval(poll, FALLBACK_POLL_MS);
}
const onVisible = () => { if (document.visibilityState === "visible") poll(); };
function start() {
  refs += 1;
  if (refs > 1) return;
  poll();
  setFallback();
  offLive = onLiveChange(setFallback);
  // チャットの合図が来たら、少しまとめてから読む（続けて送られたときに何度も読まない）
  offSignal = onSignal(ev => {
    if (ev?.t !== "chat") return;
    window.clearTimeout(soon);
    soon = window.setTimeout(poll, 400);
  });
  window.addEventListener("focus", poll);
  document.addEventListener("visibilitychange", onVisible);
}
function stop() {
  refs -= 1;
  if (refs > 0) return;
  window.clearInterval(timer); timer = 0;
  window.clearTimeout(soon);
  offLive(); offSignal(); unwatch(); unwatch = () => {}; watchedKey = "";
  window.removeEventListener("focus", poll);
  document.removeEventListener("visibilitychange", onVisible);
  seen = null; lastTeams = []; state = { total: 0, teams: [] };
}

/* チャットを開いている間は、そのチームを数えない（閉じたら null） */
export function setOpenChatTeam(teamId) {
  openTeam = teamId || "";
  publish(lastTeams);
}
/* 読んだところまで既読にする */
export async function markTeamChatRead(team, lastId) {
  if (!team?.teamId) return;
  lastTeams = lastTeams.map(t => (t.teamId === team.teamId ? { ...t, unread: 0 } : t));
  publish(lastTeams);
  try { await apiPost(`/teams/${encodeURIComponent(team.teamId)}/messages/read`, { courseId: team.courseId, lastId: lastId || "" }); } catch { /* 次に開いたときに既読になる */ }
}
/* 通知から開くチーム（チームの画面が1回だけ受け取る） */
export function takeTeamChatFocus() {
  const id = focusTeam; focusTeam = ""; return id;
}

// ホームの移動ボタン（チームの新着の件数）からも使う
export function useChatUnread(enabled) {
  const [s, setS] = useState(state);
  useEffect(() => {
    if (!enabled) return undefined;
    subs.add(setS); start();
    setS(state);
    return () => { subs.delete(setS); stop(); };
  }, [enabled]);
  return s;
}

function Toasts({ onOpen }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const add = t => {
      const key = `${t.teamId}:${t.latest.id}`;
      setItems(cur => [{ key, team: t }, ...cur.filter(x => x.team.teamId !== t.teamId)].slice(0, 3));
      window.setTimeout(() => setItems(cur => cur.filter(x => x.key !== key)), 7000);
    };
    toastSubs.add(add);
    return () => { toastSubs.delete(add); };
  }, []);
  if (!items.length) return null;
  return createPortal(
    <div className="fixed right-3 top-[76px] grid w-[min(340px,calc(100vw-24px))] gap-2" style={{ zIndex: Z.toast }} aria-live="polite">
      {items.map(({ key, team }) => (
        <div key={key} className="flex items-start gap-3 rounded-2xl bg-white px-3.5 py-3" style={{ border: `1px solid ${T.border}`, boxShadow: NOVA.shadowMd }}>
          <button type="button" onClick={() => { setItems(cur => cur.filter(x => x.key !== key)); onOpen(team.teamId); }} className="flex min-w-0 flex-1 items-start gap-3 text-left">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: TEAM_COLORS[team.color % TEAM_COLORS.length] }}>{String(team.name || "?").slice(0, 1)}</span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-bold" style={{ color: T.textMuted }}>{team.name}{team.unread > 1 ? ` ・ ${team.unread}件` : ""}</span>
              <span className="block truncate text-sm font-bold" style={{ color: T.textPrimary }}>{team.latest.byName}</span>
              <span className="line-clamp-2 block text-[13px]" style={{ color: T.textSecondary }}>{team.latest.text}</span>
            </span>
          </button>
          <button type="button" onClick={() => setItems(cur => cur.filter(x => x.key !== key))} aria-label="閉じる" style={{ color: T.textMuted }}><X size={16} /></button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

// トーストだけ出す（新しい LMS。件数のボタンはヘッダーを持つ側で出す）
export function ChatToasts({ role, onOpenTeams }) {
  const enabled = role === "trainee" || role === "instructor" || role === "admin";
  useChatUnread(enabled);
  if (!enabled) return null;
  return <Toasts onOpen={teamId => { focusTeam = teamId || ""; onOpenTeams?.(); window.dispatchEvent(new Event("feeps:team-chat-focus")); }} />;
}

export default function ChatNotifier({ role, onOpenTeams, compact = false, toasts = false }) {
  const enabled = role === "trainee" || role === "instructor" || role === "admin";
  const s = useChatUnread(enabled);
  if (!enabled) return null;
  const open = teamId => {
    focusTeam = teamId || "";
    onOpenTeams?.();
    window.dispatchEvent(new Event("feeps:team-chat-focus"));
  };
  return (
    <>
      {toasts && <Toasts onOpen={open} />}
      {s.total > 0 && (
        <button type="button" onClick={() => open(s.teams[0]?.teamId)} aria-label={`新着チャット ${s.total}件`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: T.accent }}>
          <MessageCircle size={14} />{compact ? "" : "新着チャット"}<span className="tabular-nums">{s.total > 99 ? "99+" : s.total}</span>
        </button>
      )}
    </>
  );
}
