// 括弧と引用符を自動で閉じる（2026-10-15）。JavaEditor（Java・JavaScript・SQL）と WebEditor（HTML・CSS）で共通。
// VS Code と同じ動き：
//   - ( [ { " ' を打つと、閉じる側も入れてカーソルを間に置く（次の文字が英数字のときは入れない）
//   - 選んだ文字があれば、その両側を囲む
//   - 閉じる側を打ったとき、すぐ右に同じ文字があれば、新しく足さずに右へ進む
//   - 空の組 ( | ) の間で Backspace を押すと、両方消す
//   { の間で Enter を押したときの字下げは、各エディタの newlineEdit が受け持つ（{|} を3行にする）
const PAIRS = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
const CLOSERS = new Set([")", "]", "}"]);

// opts.quotes：自動で閉じる引用符（例：['"', "'"]）。opts.open：自動で閉じる括弧
export function pairEdit(value, selStart, selEnd, key, opts = {}) {
  const open = opts.open || ["(", "[", "{"];
  const quotes = opts.quotes || ['"', "'"];
  const next = value[selEnd] ?? "";
  const prev = value[selStart - 1] ?? "";
  const isQuote = quotes.includes(key);

  // 閉じる側：右に同じ文字があれば進むだけ（引用符も同じ）
  if ((CLOSERS.has(key) || isQuote) && selStart === selEnd && next === key) {
    return { value, caret: selStart + 1 };
  }
  if (!open.includes(key) && !isQuote) return null;

  // 選んだ範囲を囲む
  if (selStart !== selEnd) {
    const inner = value.slice(selStart, selEnd);
    return { value: value.slice(0, selStart) + key + inner + PAIRS[key] + value.slice(selEnd), caret: selStart + 1, caretEnd: selEnd + 1 };
  }
  // 右が英数字・引用符なら入れない（書きかけの語の前に打ったとき）
  if (/[A-Za-z0-9_$"'`]/.test(next)) return null;
  if (isQuote) {
    // 左が英数字・\ のとき（It's、\" など）は閉じない
    if (/[A-Za-z0-9_\\]/.test(prev)) return null;
    // この行の中で同じ引用符が奇数個（文字列の中にいる）なら閉じない
    const lineHead = value.slice(value.lastIndexOf("\n", selStart - 1) + 1, selStart).replace(/\\./g, "");
    if ((lineHead.split(key).length - 1) % 2 === 1) return null;
  }
  return { value: value.slice(0, selStart) + key + PAIRS[key] + value.slice(selEnd), caret: selStart + 1 };
}

// 空の組の間で Backspace：両方消す
export function pairBackspace(value, selStart, selEnd) {
  if (selStart !== selEnd || selStart === 0) return null;
  const prev = value[selStart - 1], next = value[selStart];
  if (PAIRS[prev] && PAIRS[prev] === next) return { value: value.slice(0, selStart - 1) + value.slice(selStart + 1), caret: selStart - 1 };
  return null;
}
