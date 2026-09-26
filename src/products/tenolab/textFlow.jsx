import React from "react";

/* 日本語の説明文を、文の途中で折り返さないための道具（2026-09-26 ユーザー指摘）。
   1文（「。」まで）を1つのかたまりにして、改行は「。」のあとで起きるようにする。
   1文が1行に入りきらないときは「、」のあとで、それでも入りきらないときだけ文節ごとに折り返す
   （CSS の word-break: auto-phrase）。 */
const SENTENCE = /[^。！？]+[。！？]+[」』）]*|[^。！？]+$/g;

// 1文の中は「、」でも区切る。1文が1行に入りきらないときは、「、」のあとで折り返す
const CLAUSE = /[^、]+、*/g;
export function splitClauses(sentence) {
  const parts = String(sentence || "").match(CLAUSE);
  return parts && parts.length ? parts : [sentence];
}

export function splitSentences(text) {
  const s = String(text || "");
  const parts = s.match(SENTENCE);
  return parts && parts.length ? parts : [s];
}

// React の画面用：<Jp>文章。文章。</Jp>
export function Jp({ children }) {
  if (typeof children !== "string") return children ?? null;
  const parts = splitSentences(children);
  if (parts.length < 2 && splitClauses(children).length < 2) return children;
  return parts.map((p, i) => (
    <span key={i} className="tl-sent">{splitClauses(p).map((c, k) => <span key={k} className="tl-cl">{c}</span>)}</span>
  ));
}

// モックから持ち込んだ画面（HTML文字列）用。文字だけの段落を、文ごと・読点ごとのかたまりに分ける。
// 中にリンクや太字があるものは、そのまわりの文字だけを読点ごとのかたまりにする（リンク・太字の中は auto-phrase に任せる）
const TARGETS = "p, .lead, .biz-list li span, .heat-note, .try-foot, .price-note, .lg-list span, .u-s, .ms-v, .foot";

function clauseSpans(text) {
  const frag = document.createDocumentFragment();
  for (const p of splitSentences(text)) {
    for (const c of splitClauses(p)) {
      const cl = document.createElement("span");
      cl.className = "tl-cl";
      cl.textContent = c;
      frag.appendChild(cl);
    }
  }
  return frag;
}

export function wrapSentences(root) {
  if (!root) return;
  root.querySelectorAll(TARGETS).forEach((el) => {
    if (el.dataset.jpDone) return;
    if (el.children.length) {
      el.dataset.jpDone = "1";
      [...el.childNodes].forEach((n) => {
        if (n.nodeType === 3 && n.data.trim()) n.replaceWith(clauseSpans(n.data));
      });
      return;
    }
    const text = el.textContent;
    const parts = splitSentences(text);
    if (parts.length < 2 && splitClauses(text).length < 2) return;
    el.dataset.jpDone = "1";
    el.textContent = "";
    for (const p of parts) {
      const span = document.createElement("span");
      span.className = "tl-sent";
      for (const c of splitClauses(p)) {
        const cl = document.createElement("span");
        cl.className = "tl-cl";
        cl.textContent = c;
        span.appendChild(cl);
      }
      el.appendChild(span);
    }
  });
}
