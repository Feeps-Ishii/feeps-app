import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { T } from "../../components/common";
import {
  addMissingImports, closingBraceEdit, completionsFor, indentEdit,
  newlineEdit, tokenBefore, tokenizeLine,
} from "./javaEditorSupport.js";

// 2026-08-25: 演習で使うJavaエディタ。承認モック: mock/code-editor/index.html
//
// 透明なtextareaの下に、色を付けたテキストを敷いて重ねている。
// **両者の字送りが1pxでもずれると文字が二重に見える**ので、フォント・行の高さ・
// 余白は下のEDITOR_TEXTから両方へ同じ値を渡すこと。
//
// 補完はブラウザの中だけで動く（辞書引き）。サーバーへは行かないので待ち時間ゼロ・費用ゼロ。
// 実行だけがLambdaで、そこは本物の javac / java。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };
const CODE_BG = "#0F141C";
const FOCUS = "#E8542F";
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
const TOKEN_COLOR = { kw: "#7FB2F5", str: "#8FD69A", num: "#E9C46A", cls: "#79D3C8", cmt: "#6B7B90" };

// diagnostic: { line, col } — javacが返す位置（1始まり）
function HighlightedLine({ line, diagnostic }) {
  const tokens = tokenizeLine(line);
  if (!line) return <span> </span>;
  const range = diagnostic
    ? [Math.max(0, (diagnostic.col || 1) - 1), Math.max((diagnostic.col || 1), (diagnostic.col || 1))]
    : null;
  // 列が読めない・行末より後ろを指すときは、行の終わりに印を出す
  const tail = range && range[0] >= line.length;

  return (
    <>
      {tokens.map((t, i) => {
        const style = t.type ? { color: TOKEN_COLOR[t.type] } : undefined;
        if (!range || tail) return <span key={i} style={style}>{t.text}</span>;
        const a = Math.max(t.from, range[0]);
        const b = Math.min(t.to, range[1]);
        if (b <= a) return <span key={i} style={style}>{t.text}</span>;
        return (
          <span key={i} style={style}>
            {line.slice(t.from, a)}
            <span style={{ textDecoration: `underline wavy ${FOCUS}`, textDecorationThickness: 2, textUnderlineOffset: 4 }}>
              {line.slice(a, b)}
            </span>
            {line.slice(b, t.to)}
          </span>
        );
      })}
      {tail && (
        <span style={{ textDecoration: `underline wavy ${FOCUS}`, textDecorationThickness: 2, textUnderlineOffset: 4 }}> </span>
      )}
    </>
  );
}

export default function JavaEditor({ value, onChange, diagnostic, level = 1, onRun, readOnly = false }) {
  const taRef = useRef(null);
  const gutterRef = useRef(null);
  const boxRef = useRef(null);
  const [menu, setMenu] = useState(null); // { items, sel, start, top, left }
  const [toast, setToast] = useState("");

  const lines = useMemo(() => String(value || "").split("\n"), [value]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  // 書き換えたあとのカーソル位置。
  // requestAnimationFrame で戻すと、Reactが値を差し替えた拍子にカーソルが
  // 行末へ飛ぶことがある（2026-08-26。改行の直後に打った文字が最終行へ入った）。
  // DOMの更新直後に必ず走る useLayoutEffect で当てる。
  const pendingCaret = useRef(null);

  function apply({ value: next, caret, caretEnd }) {
    pendingCaret.current = [caret, caretEnd === undefined ? caret : caretEnd];
    onChange(next);
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
    const { word, start } = tokenBefore(ta.value, pos);
    if (!force && word.length < 2) { setMenu(null); return; }
    const items = completionsFor(word, level);
    if (!items.length) { setMenu(null); return; }
    const upto = ta.value.slice(0, pos);
    const lineNo = upto.split("\n").length;
    const col = upto.length - upto.lastIndexOf("\n") - 1;
    // 候補の位置は、スクロールする枠の中の座標で持つ（枠と一緒に動くので
    // 縦スクロール量を引かない）。横だけは入力欄の中でスクロールするので引く。
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
    const before = ta.value.slice(0, menu.start);
    const after = ta.value.slice(pos);
    const indent = (before.slice(before.lastIndexOf("\n") + 1).match(/^[ \t]*/) || [""])[0];
    let text = item.insert.replace(/\n/g, `\n${indent}`);
    const hole = text.indexOf("$");
    text = text.replace("$", "");
    let next = before + text + after;
    let caret = before.length + (hole >= 0 ? hole : text.length);

    if (item.import) {
      const withImports = addMissingImports(next);
      if (withImports.added.length) {
        caret += withImports.value.length - next.length;
        next = withImports.value;
        setToast(`${withImports.added.join(" / ")} を追加しました`);
      }
    }
    setMenu(null);
    apply({ value: next, caret });
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
    if (e.key === "Enter") { e.preventDefault(); apply(newlineEdit(ta.value, ta.selectionStart)); return; }
    if (e.key === "}") { e.preventDefault(); apply(closingBraceEdit(ta.value, ta.selectionStart)); return; }
  }

  // 横に長い行だけは入力欄の中でスクロールするので、色付けの層も同じだけ動かす。
  // **縦は入力欄をスクロールさせない**（下の bodyHeight を参照）。
  function syncScroll(e) {
    if (boxRef.current) boxRef.current.scrollLeft = e.target.scrollLeft;
  }

  // 入力欄の高さを中身ちょうどにして、縦のスクロールは外側の枠に任せる。
  //
  // 入力欄の中で縦スクロールさせると、下に敷いた色付けの層が付いてこられず、
  // 行がずれる（2026-08-26に実機で発生。入力欄196px・層844pxで層が動けなかった）。
  // 高さを合わせてしまえば、ずれる余地そのものが無くなる。
  const bodyHeight = lines.length * LINE_H + PAD_TOP * 2;

  return (
    <div className="relative grid overflow-y-auto" style={{ gridTemplateColumns: "46px minmax(0,1fr)", background: CODE_BG, maxHeight: 460, resize: "vertical" }}>
      <div ref={gutterRef} className="py-[14px] text-right" aria-hidden="true" style={{ height: bodyHeight }}>
        {lines.map((_, i) => {
          const bad = diagnostic && diagnostic.line === i + 1;
          return (
            <span
              key={i}
              className="block pr-2.5"
              style={{
                fontFamily: EDITOR_TEXT.fontFamily, fontSize: EDITOR_TEXT.fontSize, lineHeight: EDITOR_TEXT.lineHeight,
                color: bad ? "#fff" : "#5B6779", background: bad ? FOCUS : "transparent",
                fontWeight: bad ? 700 : 400, borderRadius: bad ? "4px 0 0 4px" : 0,
              }}
            >{i + 1}</span>
          );
        })}
      </div>

      <div className="relative overflow-hidden" style={{ height: bodyHeight }}>
        <div ref={boxRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" style={{ ...EDITOR_TEXT, color: "#DCE3EE" }}>
          {lines.map((line, i) => (
            <div key={i} style={{ height: LINE_H }}>
              <HighlightedLine line={line} diagnostic={diagnostic && diagnostic.line === i + 1 ? diagnostic : null} />
            </div>
          ))}
        </div>
        <textarea
          ref={taRef}
          value={value}
          readOnly={readOnly}
          onChange={e => onChange(e.target.value)}
          onKeyUp={e => { if (!["Escape", "Enter", "Tab"].includes(e.key)) openMenu(false); }}
          onScroll={syncScroll}
          onBlur={() => setTimeout(() => setMenu(null), 140)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          aria-label="Javaのコード"
          className="relative block w-full border-0 bg-transparent outline-none"
          style={{
            ...EDITOR_TEXT, color: "transparent", caretColor: "#DCE3EE",
            height: bodyHeight, resize: "none", overflowX: "auto", overflowY: "hidden",
          }}
        />
      </div>

      {menu && (
        <div
          className="absolute z-20 overflow-hidden rounded-xl"
          role="listbox"
          style={{ top: menu.top, left: 46 + menu.left, minWidth: 260, maxWidth: 380, background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 10px 26px rgba(23,30,50,.18)" }}
        >
          <ul className="m-0 max-h-52 list-none overflow-y-auto p-1">
            {menu.items.map((item, i) => (
              <li
                key={item.label}
                role="option"
                aria-selected={i === menu.sel}
                onMouseDown={e => { e.preventDefault(); accept(i); }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5"
                style={{ background: i === menu.sel ? T.accentSubtle : "transparent" }}
              >
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

      {toast && (
        <div className="absolute right-3 top-3 z-30 rounded-lg px-3 py-2 text-[11.5px] font-bold" style={{ background: T.successSubtle, color: T.success }}>
          {toast}
        </div>
      )}
    </div>
  );
}
