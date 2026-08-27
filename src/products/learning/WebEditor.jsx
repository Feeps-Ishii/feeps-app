import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { T } from "../../components/common";
import { indentEdit } from "./javaEditorSupport.js";
import {
  closeSlashEdit, closeTagEdit, tokenizeWeb,
  webCompletionsFor, webDedentEdit, webNewlineEdit, webTokenBefore,
} from "./webEditorSupport.js";

// 2026-08-27: HTML/CSS演習で使うエディタ。承認モック: mock/html-editor/index.html
//
// 作りは JavaEditor と同じ（透明なtextareaの下に色付きの層を敷く）。
// **字送りが1pxでもずれると文字が二重に見える**ので、フォント・行の高さ・余白は
// EDITOR_TEXT から両方へ同じ値を渡すこと。
//
// Javaと違ってコンパイラが無いので赤い波線は出さない。書いた結果は隣のプレビューが
// そのまま見せる。それがHTML/CSSの「実行」。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };
const CODE_BG = "#0F141C";
const EDITOR_TEXT = {
  fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 13,
  lineHeight: "24px",
  padding: "14px 16px 14px 4px",
  whiteSpace: "pre",
  tabSize: 2,
};
const LINE_H = 24;
const PAD_TOP = 14;
const TOKEN_COLOR = { kw: "#7FB2F5", attr: "#E9C46A", str: "#8FD69A", cmt: "#6B7B90", cls: "#79D3C8", num: "#E9C46A" };

export default function WebEditor({ value, onChange, mode = "html", level = 1, onRun, readOnly = false, maxHeight = 460 }) {
  const taRef = useRef(null);
  const boxRef = useRef(null);
  const [menu, setMenu] = useState(null); // { items, sel, start, top, left }

  const text = String(value || "");
  const lines = useMemo(() => text.split("\n"), [text]);
  const tokenLines = useMemo(() => tokenizeWeb(mode, text), [mode, text]);

  // 書き換えたあとのカーソル位置は、DOMの更新直後に必ず走る useLayoutEffect で当てる。
  // requestAnimationFrame で戻すとカーソルが行末へ飛ぶことがある（2026-08-26の実バグ）。
  const pendingCaret = useRef(null);

  function apply(edit) {
    if (!edit) return;
    pendingCaret.current = [edit.caret, edit.caretEnd === undefined ? edit.caret : edit.caretEnd];
    onChange(edit.value);
  }

  useLayoutEffect(() => {
    if (!pendingCaret.current) return;
    const ta = taRef.current;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(pendingCaret.current[0], pendingCaret.current[1]);
    }
    pendingCaret.current = null;
  });

  useEffect(() => { setMenu(null); }, [mode]);

  function charWidth() {
    const ta = taRef.current;
    if (!ta) return 7.8;
    const cs = getComputedStyle(ta);
    const canvas = charWidth.canvas || (charWidth.canvas = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    ctx.font = `${cs.fontSize} ${cs.fontFamily}`;
    return ctx.measureText("M").width || 7.8;
  }

  function openMenu(force) {
    const ta = taRef.current;
    if (!ta || readOnly) return;
    const pos = ta.selectionStart;
    const { word, start } = webTokenBefore(mode, ta.value, pos);
    // `<` を打った直後は1文字目から候補を出す。タグ名は2文字待つと遅い。
    const afterAngle = mode !== "css" && ta.value[start - 1] === "<";
    if (!force && word.length < (afterAngle ? 1 : 2)) { setMenu(null); return; }
    const items = webCompletionsFor(mode, word, level);
    if (!items.length) { setMenu(null); return; }
    const upto = ta.value.slice(0, pos);
    const lineNo = upto.split("\n").length;
    const col = upto.length - upto.lastIndexOf("\n") - 1;
    setMenu({
      items,
      sel: 0,
      start,
      top: PAD_TOP + lineNo * LINE_H,
      left: Math.max(4, 4 + col * charWidth() - ta.scrollLeft),
    });
  }

  function accept(index) {
    const ta = taRef.current;
    const item = menu?.items?.[index];
    if (!ta || !item) return;
    const pos = ta.selectionStart;
    // すでに `<` を打っている場合、候補も `<` から始まるので二重にしない
    const cut = (ta.value[menu.start - 1] === "<" && item.insert.startsWith("<")) ? menu.start - 1 : menu.start;
    const before = ta.value.slice(0, cut);
    const after = ta.value.slice(pos);
    // 貼り付ける定型は、いまの行の深さに合わせて字下げし直す
    const indent = (before.slice(before.lastIndexOf("\n") + 1).match(/^[ \t]*/) || [""])[0];
    let insert = item.insert.replace(/\n/g, `\n${indent}`);
    const hole = insert.indexOf("$");
    insert = insert.replace("$", "");
    setMenu(null);
    apply({ value: before + insert + after, caret: before.length + (hole >= 0 ? hole : insert.length) });
  }

  function handleKeyDown(e) {
    if (readOnly) return;
    const ta = e.target;
    const open = Boolean(menu);

    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onRun?.(); return; }
    if (e.key === " " && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openMenu(true); return; }

    if (open) {
      if (e.key === "Escape") { e.preventDefault(); setMenu(null); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setMenu(m => ({ ...m, sel: (m.sel + 1) % m.items.length })); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMenu(m => ({ ...m, sel: (m.sel - 1 + m.items.length) % m.items.length })); return; }
      // 確定は Tab と Enter の両方（VS Codeと同じ）。改行したいときは先に Esc。
      if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); accept(menu.sel); return; }
    }

    if (e.key === "Tab") { e.preventDefault(); apply(indentEdit(ta.value, ta.selectionStart, ta.selectionEnd, e.shiftKey)); return; }
    if (e.key === "Enter") { e.preventDefault(); apply(webNewlineEdit(mode, ta.value, ta.selectionStart)); return; }
    // `>` で閉じタグを補い、`</` でいま開いているタグ名を補う。
    // 閉じタグの書き忘れはこの講座でいちばん多い詰まり方なので、道具の側で減らす。
    if (mode !== "css" && e.key === ">") {
      const edit = closeTagEdit(ta.value, ta.selectionStart);
      if (edit) { e.preventDefault(); setMenu(null); apply(edit); return; }
    }
    if (mode !== "css" && e.key === "/") {
      const edit = closeSlashEdit(ta.value, ta.selectionStart);
      if (edit) { e.preventDefault(); setMenu(null); apply(edit); return; }
    }
    if (e.key === "}" || e.key === "/") {
      const edit = webDedentEdit(mode, ta.value, ta.selectionStart, e.key);
      if (edit) { e.preventDefault(); apply(edit); }
    }
  }

  // 横に長い行だけは入力欄の中でスクロールするので、色付けの層も同じだけ動かす。
  // **縦は入力欄をスクロールさせない**（下の bodyHeight を参照）。
  function syncScroll(e) {
    if (boxRef.current) boxRef.current.scrollLeft = e.target.scrollLeft;
  }

  // 入力欄の高さを中身ちょうどにして、縦のスクロールは外側の枠に任せる。
  // 入力欄の中で縦スクロールさせると下に敷いた層が付いてこられず行がずれる（2026-08-26の実バグ）。
  const bodyHeight = lines.length * LINE_H + PAD_TOP * 2;

  return (
    <div className="relative grid overflow-y-auto" style={{ gridTemplateColumns: "46px minmax(0,1fr)", background: CODE_BG, maxHeight, resize: "vertical" }}>
      <div className="py-[14px] text-right" aria-hidden="true" style={{ height: bodyHeight }}>
        {lines.map((_, i) => (
          <span key={i} className="block pr-2.5"
            style={{ fontFamily: EDITOR_TEXT.fontFamily, fontSize: EDITOR_TEXT.fontSize, lineHeight: EDITOR_TEXT.lineHeight, color: "#5B6779" }}>
            {i + 1}
          </span>
        ))}
      </div>

      <div className="relative overflow-hidden" style={{ height: bodyHeight }}>
        <div ref={boxRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" style={{ ...EDITOR_TEXT, color: "#DCE3EE" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ height: LINE_H }}>
              {line
                ? (tokenLines[i] || []).map((t, j) => (
                    <span key={j} style={t.type ? { color: TOKEN_COLOR[t.type] } : undefined}>{t.text}</span>
                  ))
                : <span> </span>}
            </div>
          ))}
        </div>
        <textarea
          ref={taRef}
          value={text}
          readOnly={readOnly}
          onChange={e => onChange(e.target.value)}
          onKeyUp={e => { if (!["Escape", "Enter", "Tab"].includes(e.key)) openMenu(false); }}
          onScroll={syncScroll}
          onBlur={() => setTimeout(() => setMenu(null), 140)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          aria-label={mode === "css" ? "CSSのコード" : "HTMLのコード"}
          className="relative block w-full border-0 bg-transparent outline-none"
          style={{
            ...EDITOR_TEXT, color: "transparent", caretColor: "#DCE3EE",
            height: bodyHeight, resize: "none", overflowX: "auto", overflowY: "hidden",
          }}
        />
      </div>

      {menu && (
        <div className="absolute z-20 overflow-hidden rounded-xl" role="listbox"
          style={{ top: menu.top, left: 46 + menu.left, minWidth: 260, maxWidth: 380, background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 10px 26px rgba(23,30,50,.18)" }}>
          <ul className="m-0 max-h-52 list-none overflow-y-auto p-1">
            {menu.items.map((item, i) => (
              <li key={item.label} role="option" aria-selected={i === menu.sel}
                onMouseDown={e => { e.preventDefault(); accept(i); }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5"
                style={{ background: i === menu.sel ? T.accentSubtle : "transparent" }}>
                <span className="shrink-0 rounded px-1.5 py-[2px] text-[9.5px] font-extrabold" style={{ background: C.canvas, color: C.muted }}>{item.kind}</span>
                <span className="text-[12.5px] font-semibold" style={{ fontFamily: EDITOR_TEXT.fontFamily, color: C.ink }}>{item.label}</span>
                <span className="ml-auto whitespace-nowrap text-[11px]" style={{ color: C.muted }}>{item.detail}</span>
              </li>
            ))}
          </ul>
          <div className="px-2.5 py-1.5 text-[10.5px]" style={{ background: C.canvas, color: C.muted, borderTop: `1px solid ${C.line}` }}>
            Tab / Enter 確定　↑↓ 選択　Esc 閉じる
          </div>
        </div>
      )}
    </div>
  );
}
