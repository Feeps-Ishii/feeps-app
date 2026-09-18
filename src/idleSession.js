/* 無操作が続いたら自動でログアウトする（2026-09-18 決定）。
   これまではログインから24時間で、操作していても切れていた。
   **12時間触らなければ切れる。触れば延びる。**

   Cognitoのリフレッシュトークンは「発行時から固定」で、触っても延びない。
   サーバ側でスライドさせるにはトークンのローテーションが要るが、
   Amplifyが新しいトークンを保存するか確証が取れていないため、
   まずは画面側で確実に動く形にしてある（サーバ側は24時間が上限のまま）。 */

const KEY = "feeps.lastActivity";
export const IDLE_LIMIT_MS = 12 * 60 * 60 * 1000;
// 毎回書くとlocalStorageへの書き込みが増えるので、1分に1回までに抑える
const WRITE_INTERVAL_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;

function now() { return Date.now(); }

export function markActivity(force = false) {
  try {
    const prev = Number(window.localStorage.getItem(KEY)) || 0;
    const t = now();
    if (force || t - prev > WRITE_INTERVAL_MS) window.localStorage.setItem(KEY, String(t));
  } catch { /* プライベートウィンドウ等で書けなくても動き続ける */ }
}

export function lastActivity() {
  try {
    return Number(window.localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

export function idleFor() {
  const last = lastActivity();
  return last ? now() - last : 0;
}

/* 監視を始める。戻り値を呼ぶと止まる。
   onExpire は「12時間以上放置された」と判断したときに1回だけ呼ぶ。 */
export function watchIdle(onExpire, limitMs = IDLE_LIMIT_MS) {
  if (typeof window === "undefined") return () => {};
  let done = false;
  markActivity(true);

  const touch = () => { if (!done) markActivity(); };
  const check = () => {
    if (done) return;
    // 復帰直後（スリープ明け・タブ切替）にも見る。ここを timer だけにすると、
    // 寝ている間は timer が止まっていて気づけない
    if (idleFor() > limitMs) {
      done = true;
      stop();
      onExpire();
    }
  };
  const onVisible = () => { if (document.visibilityState === "visible") check(); };

  const events = ["pointerdown", "keydown", "wheel", "touchstart"];
  events.forEach(e => window.addEventListener(e, touch, { passive: true }));
  window.addEventListener("focus", onVisible);
  document.addEventListener("visibilitychange", onVisible);
  const timer = window.setInterval(check, CHECK_INTERVAL_MS);

  function stop() {
    events.forEach(e => window.removeEventListener(e, touch));
    window.removeEventListener("focus", onVisible);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
  }

  check();
  return () => { done = true; stop(); };
}

export function clearActivity() {
  try { window.localStorage.removeItem(KEY); } catch { /* 消せなくても困らない */ }
}
