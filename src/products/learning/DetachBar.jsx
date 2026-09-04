import React from "react";
import { Monitor, X } from "lucide-react";
import { T } from "../../components/common";

// 2026-09-04: 演習を別ウィンドウへ切り離すボタンと、切り離し中の表示。
// 承認モック: mock/devenv-window
//
// **切り離しても、正しい状態はこちら（講義ウィンドウ）にある。**
// だから閉じれば書きかけごと戻ってくる。そのことを画面にも書いておく。

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

export function DetachButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition hover:bg-black/[.04]"
      style={{ border: `1px solid ${C.line}`, color: C.muted }}
      title="コードを書く画面を別のウィンドウに出します"
    >
      <Monitor size={12} />別ウィンドウで開く
    </button>
  );
}

// 切り離している間、講義側に出す枠。エディタの代わりにここが立つ。
export default function DetachBar({ onReattach, note }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center" style={{ background: C.canvas }}>
      <span className="flex items-center gap-2 text-[13.5px] font-bold" style={{ color: C.ink }}>
        <span className="h-2 w-2 rounded-full" style={{ background: T.success }} />
        別のウィンドウで開いています
      </span>
      <p className="m-0 max-w-md text-[12.5px] leading-[1.9]" style={{ color: C.body }}>
        {note || "コードはあちらの窓で書いてください。"}
        <br />
        <b>書いたものはこの講義ウィンドウが持っています。</b>閉じても消えません。
      </p>
      <button
        type="button"
        onClick={onReattach}
        className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-bold transition hover:bg-black/[.04]"
        style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.body }}
      >
        <X size={13} />この画面に戻す
      </button>
    </div>
  );
}

// ポップアップが止められたときなど。**押しても何も起きない、を作らない。**
export function DetachError({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 px-3.5 py-2.5 text-[12px]" style={{ background: T.warningSubtle, color: T.warning, borderBottom: `1px solid ${C.line}` }}>
      <span className="font-bold">！</span>
      <span className="min-w-0 flex-1">{message}</span>
      <button type="button" onClick={onDismiss} className="font-bold" aria-label="閉じる">×</button>
    </div>
  );
}
