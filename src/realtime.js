/* 画面への合図（2026-10-25、ADR 0032）。AWS AppSync Events のチームのチャンネルを購読し、
   「チャットに新着」「ボードが更新された」の合図を受け取る。合図には発言の中身は入っていないので、受けた側は今の API で読む。
   - チャンネル名（/team/<推測できない文字列>）は API（/teams・/teams/unread の rt・channels）からもらう
   - 同じチャンネルを何か所で見ても、つなぐのは1回（数えて、最後の1つが離れたら閉じる）
   - つながらない（設定が空・社内のネットワークで WebSocket が通らない など）ときは live が false になる。
     そのあいだ、呼ぶ側は60秒ごとの問い合わせで動く（FALLBACK_POLL_MS） */
import { REALTIME_HTTP_DOMAIN } from "./aws.js";

export const FALLBACK_POLL_MS = 60000;
export const realtimeEnabled = () => !!REALTIME_HTTP_DOMAIN;

const RETRY_MS = [5000, 15000, 60000];
const chans = new Map();          // channel → { count, close, retry, timer }
const listeners = new Set();      // (event) => void
const liveListeners = new Set();  // (live) => void
let live = false;

function setLive(v) {
  if (live === v) return;
  live = v;
  liveListeners.forEach(f => f(v));
}
function recomputeLive() {
  const all = [...chans.values()];
  setLive(all.length > 0 && all.every(c => c.ok));
}

async function open(channel) {
  const c = chans.get(channel);
  if (!c) return;
  try {
    const { events } = await import("aws-amplify/data");   // 使うときだけ読み込む
    const ch = await events.connect(channel.replace(/^\//, ""));
    if (!chans.has(channel)) { ch.close(); return; }      // つないでいる間に離れた
    const sub = ch.subscribe({
      next: msg => { const ev = msg?.event; if (ev && typeof ev === "object") listeners.forEach(f => f(ev)); },
      error: err => { console.warn("realtime subscribe error", channel, err?.message || err); fail(channel); },
    });
    c.close = () => { try { sub.unsubscribe(); ch.close(); } catch { /* 閉じるだけ */ } };
    c.ok = true; c.retry = 0;
    recomputeLive();
  } catch (e) {
    console.warn("realtime connect error", channel, e?.message || e);
    fail(channel);
  }
}
function fail(channel) {
  const c = chans.get(channel);
  if (!c) return;
  c.ok = false; c.close?.(); c.close = null;
  recomputeLive();
  window.clearTimeout(c.timer);
  c.timer = window.setTimeout(() => open(channel), RETRY_MS[Math.min(c.retry++, RETRY_MS.length - 1)]);
}

/* チャンネルを見る。戻り値を呼ぶと見るのをやめる */
export function watchChannels(channels) {
  const list = [...new Set((channels || []).filter(Boolean))];
  if (!realtimeEnabled() || !list.length) return () => {};
  for (const channel of list) {
    const c = chans.get(channel);
    if (c) { c.count += 1; continue; }
    chans.set(channel, { count: 1, ok: false, retry: 0, close: null, timer: 0 });
    open(channel);
  }
  recomputeLive();
  return () => {
    for (const channel of list) {
      const c = chans.get(channel);
      if (!c) continue;
      c.count -= 1;
      if (c.count > 0) continue;
      window.clearTimeout(c.timer); c.close?.();
      chans.delete(channel);
    }
    recomputeLive();
  };
}

/* 合図を受け取る（{ t: "chat" | "board", team, ... }）。戻り値を呼ぶとやめる */
export function onSignal(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* 合図が届く状態か（true のあいだは定期の問い合わせを止めてよい） */
export function isLive() { return live; }
export function onLiveChange(fn) {
  liveListeners.add(fn);
  return () => liveListeners.delete(fn);
}
