// 「AIと相談してつくる」モードの左レール（2026-08-20新設）。
// 承認モック（mock/course-studio の FinalChat）に対応。
// フォームモードと入れ替わるのはこのレールだけで、右のコース本体は共通。
import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, FileText, Loader2, Sparkles } from "lucide-react";
import { T, NOVA } from "../../../../components/common";
import { C } from "./studioParts.jsx";

function Bubble({ message }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-[14px_4px_14px_14px] px-3.5 py-3 text-[12.5px] leading-relaxed" style={{ background: T.accentSubtle, color: C.ink }}>
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: T.aiAccentDeep }}>
        <Sparkles size={13} color={NOVA.onDark} />
      </span>
      <div className="min-w-0 flex-1 rounded-[4px_14px_14px_14px] px-3.5 py-3 text-[12.5px] leading-relaxed" style={{ background: T.bgBase, color: C.ink }}>
        {message.text}
      </div>
    </div>
  );
}

export default function ChatRail({
  messages, onSend, busy, error, readyToGenerate, onGenerate, onShowBrief, generating,
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  function submit(text) {
    const body = String(text ?? draft).trim();
    if (!body || busy) return;
    setDraft("");
    onSend(body);
  }

  const lastSuggestions = messages[messages.length - 1]?.role === "assistant"
    ? (messages[messages.length - 1].suggestions || [])
    : [];

  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-2xl lg:w-[380px] lg:shrink-0"
      style={{ background: NOVA.card, border: `1px solid ${C.line}`, boxShadow: NOVA.shadowSm, minHeight: 560 }}
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5" style={{ borderColor: C.line }}>
        <span className="text-[13px] font-bold" style={{ color: C.ink }}>AIと相談</span>
        <button type="button" onClick={onShowBrief} className="flex items-center gap-1 text-[11.5px] font-semibold transition hover:opacity-70" style={{ color: T.accent }}>
          <FileText size={12} />今の条件を見る
        </button>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4" style={{ maxHeight: 520 }}>
        {messages.map((m, i) => <Bubble key={i} message={m} />)}

        {busy && (
          <div className="flex gap-2.5">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: T.aiAccentDeep }}>
              <Sparkles size={13} color={NOVA.onDark} />
            </span>
            <div className="rounded-[4px_14px_14px_14px] px-3.5 py-3" style={{ background: T.bgBase }}>
              <Loader2 size={14} className="animate-spin" style={{ color: T.aiAccentDeep }} />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl p-2.5" style={{ background: T.dangerSubtle }}>
            <AlertCircle size={13} style={{ color: T.danger, flexShrink: 0, marginTop: 1 }} />
            <span className="whitespace-pre-wrap text-[11.5px] leading-relaxed" style={{ color: C.body }}>{error}</span>
          </div>
        )}

        {!busy && lastSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-[36px]">
            {lastSuggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition hover:opacity-70"
                style={{ background: NOVA.card, border: `1px solid ${C.line}`, color: C.body }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {!busy && readyToGenerate && !generating && (
          <button
            type="button"
            onClick={onGenerate}
            className="ml-[36px] flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition hover:opacity-85"
            style={{ background: `linear-gradient(135deg, #6843B7 0%, ${T.aiAccentDeep} 100%)`, color: NOVA.onDark }}
          >
            <Sparkles size={13} />この内容でコースをつくる<ArrowRight size={12} />
          </button>
        )}

        <div ref={endRef} />
      </div>

      <div className="px-4 pb-4 pt-3">
        <div
          className="flex items-center gap-2 rounded-[15px] px-3 py-2.5"
          style={{ background: NOVA.card, border: `1px solid ${C.line}`, boxShadow: NOVA.shadowSm }}
        >
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
            placeholder="「新卒向けにAWSの基礎」など"
            disabled={busy}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
            style={{ color: C.ink }}
          />
          <button
            type="button"
            onClick={() => submit()}
            disabled={busy || !draft.trim()}
            aria-label="送信"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] transition hover:opacity-85 disabled:opacity-40"
            style={{ background: NOVA.gradAccent, color: NOVA.onDark }}
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
