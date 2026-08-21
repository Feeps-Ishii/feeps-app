import React, { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircleQuestion, Send, Sparkles } from "lucide-react";
import { T } from "../../components/common";
import { apiPost } from "../../api.js";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

// 2026-08-21: 「今見ているページ」について質問できる欄。
//
// **スライドの中身はクライアントから送らない。** courseId/lessonId/slideId だけを送り、
// Backendが保存済みの教材を引き直して答える（内容を差し替えて答えさせられないように）。
// 軽いモデル(Haiku)で1往復あたり0.4円ほど。履歴は直近だけ送る（長くすると毎回の費用が増える）。
export default function SlideQuestionBox({ courseId, lessonId, slideId, slideTitle }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]); // { role: "user" | "assistant", text }
  const [followUps, setFollowUps] = useState([]);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const aliveRef = useRef(true);

  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);
  // ページが変わったら会話をリセットする（別のページの話が混ざらないように）。
  useEffect(() => { setMessages([]); setFollowUps([]); setQuestion(""); setErrorMsg(""); setOpen(false); }, [slideId]);

  async function ask(text) {
    const q = String(text || "").trim();
    if (!q || busy) return;
    setBusy(true);
    setErrorMsg("");
    setQuestion("");
    setFollowUps([]);
    const history = messages.slice(-4);
    setMessages(prev => [...prev, { role: "user", text: q }]);
    try {
      const res = await apiPost("/learning/slides/ask", { courseId, lessonId, slideId, question: q, history });
      if (!aliveRef.current) return;
      setMessages(prev => [...prev, { role: "assistant", text: res.answer || "うまく答えられませんでした。聞き方を変えてみてください。" }]);
      setFollowUps(Array.isArray(res.followUps) ? res.followUps : []);
    } catch (e) {
      if (!aliveRef.current) return;
      setErrorMsg(e?.errorMessage || "回答を作れませんでした。時間をおいてお試しください。");
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[13px] font-bold transition hover:bg-black/[.03]"
        style={{ border: `1px dashed ${C.line}`, color: C.muted, background: "#fff" }}
      >
        <MessageCircleQuestion size={15} />このページについて質問する
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl p-4 sm:p-[18px]" style={{ background: T.aiSubtle, border: `1px solid ${T.aiAccentDeep}22` }}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <Sparkles size={13} style={{ color: T.aiAccentDeep }} />
        <span className="text-[12px] font-bold" style={{ color: T.aiAccentDeep, letterSpacing: "0.04em" }}>このページについて質問する</span>
      </div>

      {messages.length === 0 && (
        <p className="mb-3 text-xs leading-relaxed" style={{ color: C.muted }}>
          「{slideTitle || "このページ"}」を見ながら質問できます。ページに書かれていないことでも、関連することなら答えます。
        </p>
      )}

      {messages.length > 0 && (
        <div className="mb-3 space-y-2">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-[1.85] whitespace-pre-wrap"
                style={m.role === "user"
                  ? { background: "#fff", border: `1px solid ${C.line}`, color: C.ink }
                  : { background: "#fff", border: `1px solid ${T.aiAccentDeep}22`, color: C.body }}
              >
                {m.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
              <Loader2 size={12} className="animate-spin" />考えています…
            </div>
          )}
        </div>
      )}

      {followUps.length > 0 && !busy && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {followUps.map(f => (
            <button key={f} type="button" onClick={() => ask(f)}
              className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition hover:opacity-80"
              style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.body }}>
              {f}
            </button>
          ))}
        </div>
      )}

      {errorMsg && <div className="mb-2 text-xs font-semibold" style={{ color: T.danger }}>{errorMsg}</div>}

      <div className="flex items-end gap-2">
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask(question); }}
          placeholder="例: ITとICTの違いは？ / なぜこの手順が必要？"
          rows={2}
          maxLength={500}
          className="min-w-0 flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.ink }}
        />
        <button
          type="button"
          onClick={() => ask(question)}
          disabled={busy || !question.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition disabled:opacity-30"
          style={{ background: T.aiAccentDeep }}
          aria-label="質問する"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
