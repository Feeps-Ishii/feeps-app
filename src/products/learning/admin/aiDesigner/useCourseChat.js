// 「AIと相談してつくる」モードの会話（2026-08-20新設）。
//
// 会話はBackendのHaikuで同期処理（聞き取りだけなので出力が小さい。教材本体の生成は
// 非同期ジョブのまま＝ADR 0018）。AIには毎ターン「今わかっている条件の全量」を返させ、
// ここでbriefへマージする。差分だけ返させると前の発言を忘れる挙動になりやすいため。
import { useCallback, useRef, useState } from "react";
import { apiPost } from "../../../../api.js";

const OPENING = "どんな研修をつくりますか？ひとことで大丈夫です。";

export function useCourseChat({ brief, applyBrief, lessons }) {
  const [messages, setMessages] = useState([{ role: "assistant", text: OPENING, suggestions: [] }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  // 送信中に積まれた履歴を取りこぼさないよう、常に最新をrefから読む
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const send = useCallback(async (text) => {
    const body = String(text || "").trim();
    if (!body || busy) return null;
    setError("");
    setBusy(true);
    const next = [...messagesRef.current, { role: "user", text: body }];
    setMessages(next);
    try {
      const res = await apiPost("/learning/admin/ai-lesson-designer/chat", {
        messages: next.map(m => ({ role: m.role, text: m.text })),
        brief,
        lessons: (lessons || []).map(l => ({ title: l.title })),
      });
      setMessages(prev => [...prev, { role: "assistant", text: res?.reply || "", suggestions: res?.suggestions || [] }]);
      if (res?.brief) applyBrief(res.brief);
      setReadyToGenerate(res?.readyToGenerate === true);
      return res?.action || null;
    } catch (e) {
      const msg = [e?.errorCode, e?.errorMessage].filter(Boolean).join("\n") || e?.message || "AIとの会話に失敗しました。";
      setError(msg);
      // 失敗した発言は履歴に残す（もう一度打ち直させない）が、AIの返答は積まない
      return null;
    } finally {
      setBusy(false);
    }
  }, [brief, applyBrief, lessons, busy]);

  // 生成の開始・完了をAIの発言として履歴へ挟む（会話の中で何が起きたか分かるように）
  const note = useCallback((text) => {
    setMessages(prev => [...prev, { role: "assistant", text, suggestions: [] }]);
  }, []);

  const reset = useCallback(() => {
    setMessages([{ role: "assistant", text: OPENING, suggestions: [] }]);
    setReadyToGenerate(false);
    setError("");
  }, []);

  return { messages, send, note, reset, busy, error, readyToGenerate };
}
