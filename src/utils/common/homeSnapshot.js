// ホームの「前回の表示」を保存しておき、次に開いたときに先に出す（2026-09-30）。
// 出したあと裏で最新を取り直し、届いたら差し替える。取り直しに失敗したときは従来どおりエラーを出す
// （前回の表示を「最新」として出し続けない）。
//
// 保存先はこのブラウザの localStorage。利用者・役割・日付ごとに分け、別の日のものは使わない。
// ログアウトで消す（clearHomeSnapshots）。12時間を過ぎたものも使わない。

const PREFIX = "feeps.homeSnapshot.v1:";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

// ログイン中の利用者（Amplify が保存している LastAuthUser）。取れなければ保存しない
function currentUserKey() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && /^CognitoIdentityServiceProvider\.[^.]+\.LastAuthUser$/.test(key)) return localStorage.getItem(key) || "";
    }
  } catch { /* 読めない環境では使わない */ }
  return "";
}

export function homeSnapshotKey(name, date = "") {
  const user = currentUserKey();
  return user ? `${PREFIX}${user}:${name}:${date}` : "";
}

export function readHomeSnapshot(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Date.now() - Number(parsed.savedAt || 0) > MAX_AGE_MS) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export function writeHomeSnapshot(key, data) {
  if (!key) return;
  try {
    // 同じ利用者・同じホームの古い日付のものは消してから書く（たまり続けないように）
    const base = key.slice(0, key.lastIndexOf(":") + 1);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k !== key && k.startsWith(base)) localStorage.removeItem(k);
    }
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch { /* 容量不足などは保存しないだけ */ }
}

export function clearHomeSnapshots() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch { /* noop */ }
}
