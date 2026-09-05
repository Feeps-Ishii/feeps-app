// 選んだ担当の置き場所。**いまはブラウザに置いているだけ**。
//
// 正しい置き場所は assignment（`DEVLAB#ASSIGNMENT#<projectId>` の roleSlotId）で、
// Backendを触る回で移す（docs/specs/dev-lab-role-spec.md §3-2）。
// そのとき差し替えるのがこの2関数だけで済むように、呼び出し側から localStorage を隠している。
//
// この置き方の限界は分かったうえで選んでいる: 別の端末では担当が引き継がれず、
// 管理者からの割り当ても反映できない。**Frontendだけで完結させる回のための仮置き**。

const KEY = "feeps.devlab.role";

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : null;
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) {
    return {};
  }
}

export function getRole(projectId) {
  if (!projectId) return "";
  const v = read()[projectId];
  return typeof v === "string" ? v : "";
}

export function setRole(projectId, roleSlotId) {
  if (!projectId) return;
  try {
    const next = read();
    if (roleSlotId) next[projectId] = roleSlotId; else delete next[projectId];
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    // 保存できなくても操作は続けられる（その場では選べている）
  }
}
