import React, { useMemo } from "react";
import { T } from "../../components/common";

// 2026-09-04: 演習エディタを「本格的な開発環境」に見せるガワ。
// 承認モック: mock/vscode-like/index.html
//
// **VS Code だと受け取ってもらえるのは、機能の数ではなく
// 「決まった位置に決まったものがある」こと。** 効く順に、
// ①青いステータスバー ②パンくず ③ミニマップ。
//
// ここに出す値は**すべて本当の値**にする。branch や文字コードを
// それっぽく出すと、分かる人にすぐ嘘だと分かる。

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// ---- パンくず ----
// ファイルの居場所。プロジェクト構成を意識させるのが目的なので、
// **実際のパスをそのまま**出す（教材が持っている構成をそのまま使う）。
export function Breadcrumb({ parts }) {
  const list = (parts || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div
      className="flex items-center gap-1 overflow-hidden whitespace-nowrap px-3.5 py-1"
      style={{ background: "#0B0F16", borderBottom: "1px solid #1E2733", color: "#5C6B7F", fontFamily: MONO, fontSize: 11 }}
    >
      {list.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ opacity: 0.5 }}>›</span>}
          <span style={i === list.length - 1 ? { color: "#8FA0B6" } : undefined}>{p}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ---- ミニマップ ----
// 行の長さをそのまま棒にする。本物と同じ考え方。
// **狭いところには出さない**（本文が570pxしかない画面では、コードを潰すだけ）。
export function Minimap({ lines, current, errorLine }) {
  const bars = useMemo(() => (lines || []).map((l, i) => {
    const len = String(l || "").length;
    const kind = i + 1 === errorLine ? "e" : i + 1 === current ? "a" : len > 30 ? "b" : "";
    return { w: Math.max(5, Math.min(46, len * 1.05)), kind };
  }), [lines, current, errorLine]);
  const color = { e: "#6B3A32", a: "#3C5570", b: "#35485C", "": "#2C3846" };
  return (
    <div
      className="flex flex-none flex-col gap-[2px] overflow-hidden px-1.5 py-2"
      aria-hidden="true"
      style={{ width: 58, background: "#0F141C", borderLeft: "1px solid rgba(255,255,255,.05)" }}
    >
      {bars.map((b, i) => (
        <span key={i} className="block" style={{ height: 2, width: b.w, borderRadius: 1, background: color[b.kind] }} />
      ))}
    </div>
  );
}

// ---- ステータスバー ----
// left / right に出すものは**呼び出し側が本当の値だけを渡す**。
export function StatusBar({ left = [], right = [] }) {
  const cell = (item, i) => {
    if (!item) return null;
    const { text, tone, minor } = typeof item === "string" ? { text: item } : item;
    return (
      <span
        key={i}
        // 狭い画面では、切れるより先に**大事でないものから隠す**。
        // 途中で切れた文字列が残っているより、無い方が読める。
        className={`h-full items-center gap-1.5 whitespace-nowrap px-2.5 ${minor ? "hidden sm:flex" : "flex"}`}
        style={tone === "warn"
          ? { background: "rgba(255,255,255,.16)" }
          : tone === "ok"
            ? { background: "rgba(255,255,255,.1)" }
            : undefined}
      >
        {text}
      </span>
    );
  };
  return (
    <div
      className="flex items-center overflow-hidden"
      style={{ height: 24, background: T.accentHover, color: "#E9F2FB", fontSize: 11, fontVariantNumeric: "tabular-nums" }}
    >
      {left.map(cell)}
      <span className="ml-auto flex h-full items-center">{right.map(cell)}</span>
    </div>
  );
}

// キャレットの位置を「行 n、列 m」にする。**1始まり**（エディタの慣習）。
export function caretAt(value, pos) {
  const upto = String(value || "").slice(0, pos);
  const line = upto.split("\n").length;
  const col = upto.length - upto.lastIndexOf("\n");
  return { line, col };
}
