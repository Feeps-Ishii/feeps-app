import React, { useEffect, useState } from "react";
import { subscribeSpeech } from "./lectureAudio.js";

// 2026-08-24: 読み上げ中の文に**マーカーを引く**ための道具。
//
// Backendが返す文ごとの開始時刻（speech marks）から lectureAudio が「いま読んでいる文」を
// 配ってくるので、それを本文の中から探して蛍光ペンのように塗る。
// 探すのは描画後の文字列（Markdownの記号は既に消えている）なので、ノートでもそのまま効く。
// 見つからなければ何も塗らない（間違った場所を光らせるより無いほうがよい）。

// マーカーの見た目。下2/3だけ塗る＝蛍光ペンで線を引いた感じ。
const MARK_STYLE = {
  background: "linear-gradient(transparent 58%, rgba(255, 206, 61, .62) 58%)",
  borderRadius: "2px",
  transition: "background .15s ease",
};

// いま読み上げている文。sourceText が一致するときだけ返す
// （解説を読んでいるのにノートが光る、を防ぐ）。
export function useSpeechCue(sourceText) {
  const [cue, setCue] = useState(null);
  useEffect(() => {
    const key = String(sourceText || "");
    return subscribeSpeech(next => {
      setCue(next.speaking && next.sourceText === key ? next : null);
    });
  }, [sourceText]);
  return cue;
}

// React要素の中の文字だけを取り出す（<strong>などを跨いで文を探すため）。
function nodeText(node) {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (React.isValidElement(node)) return nodeText(node.props?.children);
  return "";
}

// [start, end) の範囲だけを <mark> で包む。カーソルは子要素を辿りながら進める。
function applyRange(children, range, cursor) {
  return React.Children.map(children, child => {
    if (typeof child === "string" || typeof child === "number") {
      const text = String(child);
      const start = cursor.i;
      cursor.i += text.length;
      const from = Math.max(range[0], start);
      const to = Math.min(range[1], start + text.length);
      if (to <= from) return text;
      return (
        <>
          {text.slice(0, from - start)}
          <mark style={MARK_STYLE}>{text.slice(from - start, to - start)}</mark>
          {text.slice(to - start)}
        </>
      );
    }
    if (React.isValidElement(child)) {
      const inner = child.props?.children;
      if (inner == null) return child;
      return React.cloneElement(child, undefined, applyRange(inner, range, cursor));
    }
    return child;
  });
}

// 子要素の中から sentence を探してマーカーを引く。無ければそのまま返す。
export function SpeechMarked({ sentence, children }) {
  const target = String(sentence || "").trim();
  if (!target) return <>{children}</>;
  const plain = nodeText(children);
  const at = plain.indexOf(target);
  if (at < 0) return <>{children}</>;
  return <>{applyRange(children, [at, at + target.length], { i: 0 })}</>;
}
