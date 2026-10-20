// 仮パスワード（12文字・英大文字・英小文字・数字・記号を1つ以上）。まとめて発行するアカウントで使う（2026-10-16、2026-10-20 ここへ移した）
export function makePassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "#$%&@!?"];
  const all = sets.join("");
  const r = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const chars = sets.map(s => s[r(s.length)]);
  while (chars.length < 12) chars.push(all[r(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = r(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}
