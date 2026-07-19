const NAVIGATION_STATE_KEY = "__feepsNavigation";
const NAVIGATION_EPOCH_KEY = "feeps.navigationEpoch";
export const PRODUCT_DETAIL_HISTORY_EVENT = "feeps:product-detail-history";

function randomEpoch() {
  try {
    if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  } catch { /* UUID非対応環境では時刻と乱数へフォールバック */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getNavigationEpoch() {
  try {
    const current = window.sessionStorage.getItem(NAVIGATION_EPOCH_KEY);
    if (current) return current;
    const next = randomEpoch();
    window.sessionStorage.setItem(NAVIGATION_EPOCH_KEY, next);
    return next;
  } catch {
    return randomEpoch();
  }
}

export function rotateNavigationEpoch() {
  const next = randomEpoch();
  try { window.sessionStorage.setItem(NAVIGATION_EPOCH_KEY, next); }
  catch { /* sessionStorageが利用できない環境ではメモリ上の世代だけを使う */ }
  return next;
}

export function readNavigationHistoryEntry(state = window.history.state) {
  const entry = state && typeof state === "object" ? state[NAVIGATION_STATE_KEY] : null;
  return entry?.version === 1 ? entry : null;
}

export function writeNavigationHistoryEntry(entry, { push = false } = {}) {
  const current = window.history.state;
  const base = current && typeof current === "object" ? current : {};
  const next = { ...base, [NAVIGATION_STATE_KEY]: entry };
  if (push) window.history.pushState(next, "");
  else window.history.replaceState(next, "");
}

export function clearNavigationHistoryEntry() {
  const current = window.history.state;
  if (!current || typeof current !== "object" || !(NAVIGATION_STATE_KEY in current)) return;
  const next = { ...current };
  delete next[NAVIGATION_STATE_KEY];
  window.history.replaceState(next, "");
}

export function setProductDetailHistory(target, { historyAction = "push" } = {}) {
  try {
    window.dispatchEvent(new CustomEvent(PRODUCT_DETAIL_HISTORY_EVENT, {
      detail: { target: target && typeof target === "object" ? target : null, historyAction },
    }));
  } catch { /* CustomEvent非対応環境では画面内の遷移だけ継続 */ }
}
