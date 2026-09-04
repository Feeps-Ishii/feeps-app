// 2026-09-04: 講義ウィンドウと演習ウィンドウのやり取り。承認モック: mock/devenv-window
//
// **講義ウィンドウが主、演習ウィンドウが従。** 正しい状態はいつも主が持つ。
// 従には認証も合否の記録も持たせない（ADR 0021）。窓が2つあると
// 「どちらの結果が正しいか」が必ず問題になるので、持たせなければ起きない。
//
// 実行APIも主が代行する。従はトークンを持たないので、自分では叩けない。

const PREFIX = "feeps.exercise.";

// 同じ人が2つのレッスンを別々に開いても混ざらないよう、開くたびに合図を変える。
export function newChannelId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function openChannel(id) {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(PREFIX + id);
  } catch (e) {
    return null;   // 使えない環境では別ウィンドウを出さない（呼び出し側で判定）
  }
}

export const MSG = {
  HELLO: "hello",     // 従 → 主  「開きました。いまの課題をください」
  STATE: "state",     // 主 → 従  課題・書きかけのコード
  EDIT: "edit",       // 従 → 主  書き換えた
  RUN: "run",         // 従 → 主  実行して
  RESULT: "result",   // 主 → 従  実行の結果
  CLOSE: "close",     // 主 → 従  閉じて（主が閉じられた／インラインへ戻す）
  BYE: "bye",         // 従 → 主  閉じます
};

export function send(ch, type, payload) {
  if (!ch) return;
  try { ch.postMessage({ type, payload }); } catch (e) { /* 相手が居なければ捨ててよい */ }
}

// 演習ウィンドウを開く。**開けなかったことを呼び出し側へ必ず返す。**
// 会社のPCではポップアップを止めている場合が多く、「押しても何も起きない」を作らない。
export function openExerciseWindow(id) {
  const url = `${location.origin}/exercise.html?ch=${encodeURIComponent(id)}`;
  const w = window.open(url, PREFIX + id, "width=1080,height=820,noopener=no");
  return w || null;
}
