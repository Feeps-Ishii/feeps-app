import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Badge, Btn, Card, Field, fieldStyle, T } from "../../../components/common";
import { apiPost } from "../../../api.js";
import { runAiJob } from "./aiJobPolling.js";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

// 2026-08-21: 既存コースの総合テストをAIで作る。
//
// 生成そのものは AI Lesson Designer が使っている
// POST /learning/admin/ai-lesson-designer/final-test/generate（非同期ジョブ finalTestGenerate）を
// そのまま使う。**新しい生成APIは作らない。** 違いは「これから作るコース」ではなく
// 「既に保存されているコースのレッスン」を素材にするところだけ。
//
// 保存も既存の POST /learning/admin/quiz-questions（type: "final"）をそのまま使う。
// AIが返す lessonRef を実レッスンIDへ対応付けてから保存する。
export default function FinalTestAiPanel({ course, lessons, existingFinalCount, onSaved }) {
  const [questionCount, setQuestionCount] = useState(6);
  const [state, setState] = useState("idle"); // idle | running | done | error
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState([]);
  const busy = state === "running";

  async function handleGenerate() {
    if (busy) return;
    setState("running");
    setNotice("");
    setPreview([]);
    try {
      const usable = lessons.filter(l => l.title);
      if (!usable.length) throw new Error("レッスンがまだありません。先にレッスンを作成してください。");
      const result = await runAiJob("/learning/admin/ai-lesson-designer/final-test/generate", {
        courseTitle: course.title,
        questionCountHint: questionCount,
        // lessonRefには実レッスンIDをそのまま渡す。AIが返した値をそのまま突き合わせられる。
        lessons: usable.map(l => ({ lessonRef: l.id, title: l.title, summary: l.summary || "", goal: l.goal || "" })),
      }, status => setNotice(status === "queued" ? "生成の順番を待っています…" : "AIが問題を作っています…"));

      const questions = Array.isArray(result?.questions) ? result.questions : [];
      if (!questions.length) throw new Error("問題を生成できませんでした。もう一度お試しください。");

      const byId = new Map(usable.map(l => [l.id, l]));
      let saved = 0;
      for (const q of questions) {
        const lessonId = byId.has(q.lessonRef) ? q.lessonRef : usable[0].id;
        try {
          await apiPost("/learning/admin/quiz-questions", {
            courseId: course.id,
            lessonId,
            type: "final",
            question: q.question,
            choices: q.choices,
            answer: q.answerIndex,
            explanation: q.explanation || "",
            published: true,
          });
          saved += 1;
        } catch (e) {
          // 1問の保存失敗で全体を失敗にしない。何問入ったかを最後に伝える。
        }
      }
      setPreview(questions);
      setState(saved ? "done" : "error");
      setNotice(saved
        ? `${saved}問を保存しました。内容は「理解度・問題」から編集できます。`
        : "生成はできましたが、保存に失敗しました。時間をおいてもう一度お試しください。");
      if (saved && onSaved) onSaved();
    } catch (e) {
      setState("error");
      setNotice(e?.errorMessage || e?.message || "生成に失敗しました。");
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl p-2" style={{ background: T.aiSubtle, color: T.aiAccentDeep }}><Sparkles size={18} /></div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold" style={{ color: C.ink }}>総合テストをAIで作る</h3>
            {existingFinalCount > 0 && <Badge tone="cyan">現在{existingFinalCount}問</Badge>}
          </div>
          <p className="text-xs" style={{ color: C.muted }}>
            このコースのレッスン{lessons.length}件から、コース全体を横断する4択問題を作って保存します。
          </p>
        </div>
      </div>

      {course.finalTestEnabled === false && (
        <div className="mb-3 flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed" style={{ background: T.warningSubtle, color: T.warning }}>
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          このコースは「総合テストを行う」がオフです。問題を作っても受講者には出ません。コース設定を確認してください。
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="出題数">
          <select style={fieldStyle} value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))} disabled={busy}>
            <option value={4}>4問</option>
            <option value={6}>6問（おすすめ）</option>
            <option value={8}>8問</option>
            <option value={10}>10問</option>
          </select>
        </Field>
      </div>

      {existingFinalCount > 0 && (
        <p className="mt-2 text-[11px]" style={{ color: C.muted }}>
          既にある{existingFinalCount}問は消えません。作り直したい場合は「理解度・問題」で不要な問題を削除してください。
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn kind="ai" size="sm" icon={busy ? Loader2 : Sparkles} onClick={handleGenerate} disabled={busy || !lessons.length}>
          {busy ? "生成中…" : "AIで総合テストを作る"}
        </Btn>
        {notice && (
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: state === "error" ? T.danger : state === "done" ? T.success : C.muted }}>
            {state === "done" ? <CheckCircle2 size={13} /> : state === "error" ? <AlertCircle size={13} /> : <Loader2 size={13} className="animate-spin" />}
            {notice}
          </span>
        )}
      </div>

      {preview.length > 0 && (
        <div className="mt-4 space-y-2">
          {preview.map((q, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: C.canvas }}>
              <div className="text-xs font-bold" style={{ color: C.ink }}>{i + 1}. {q.question}</div>
              <div className="mt-1 text-[11px]" style={{ color: C.muted }}>
                正解: {q.choices?.[q.answerIndex] || "-"}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
