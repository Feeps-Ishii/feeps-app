import React, { useEffect, useMemo, useState } from "react";
import { apiPost } from "../../../api.js";
import { answerModeOf, questionPoints, testQuestionsOf } from "../../training/TrainingComponents.jsx";
import { testIdOf } from "../../training/useTraining.js";
import { clearTraineeTestDraft, getTraineeTestDraft, setTraineeTestDraft } from "../../../utils/common/courseContext.js";
import { Btn, Card, Chip } from "../parts/ui.jsx";

/* テストを受ける（モック testTake / testResult / testReview）：1 問ずつ → 見直して提出 → 結果 → ふりかえり。
   下書き・AI 採点・送信の決まりは前の画面と同じ。AI で点をつけないテストの書く問題は講師の採点待ちにする */

const PASS = 70;
const KEYS = "ABCDEFGHIJ";
const isChoice = q => q.type === "choice" || q.type === "trueFalse" || !q.type;
const given = (q, v) => (isChoice(q) ? Number.isInteger(v) : String(v ?? "").trim().length > 0);
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const md = d => { const [, m, dd] = String(d).split("-").map(Number); return m && dd ? `${m}/${dd}` : ""; };
const SAVE_ERR = "保存できませんでした。もう一度押してください";

function fromSaved(row) {
  const details = row?.answers && typeof row.answers === "object" ? row.answers : {};
  const answers = Object.fromEntries(Object.entries(details).map(([k, d]) => [k, d?.answer]).filter(([, v]) => v !== undefined && v !== null));
  const correct = Object.values(details).filter(d => d?.correct).length;
  return { answers, result: { score: Number(row?.officialScore ?? row?.teacherScore ?? row?.score) || 0, correct, needsReview: row?.reviewedAt ? 0 : (Number(row?.needsReview) || 0), details }, date: String(row?.takenAt || row?.updatedAt || "").slice(0, 10) };
}

export default function TestTake({ test, saved = null, onDone, onBack, onMaterial }) {
  const id = testIdOf(test), qs = useMemo(() => testQuestionsOf(test), [test]), N = qs.length, min = Number(test.limitMinutes) || 0;
  const [init] = useState(() => (saved ? fromSaved(saved) : getTraineeTestDraft(id)));
  const [ans, setAns] = useState(() => Object.fromEntries(Object.entries(init?.answers || {}).filter(([k, v]) => qs[Number(k)] && given(qs[Number(k)], v))));
  const [result, setResult] = useState(() => init?.result || null);
  const [mode, setMode] = useState(saved ? "review" : init?.result ? "result" : "take");
  const [qi, setQi] = useState(0);
  const [sec, setSec] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pendingSave, setPendingSave] = useState(init?.pendingSubmission || null);
  const [filter, setFilter] = useState("all");
  const answered = qs.filter((q, i) => given(q, ans[i])).length;

  useEffect(() => { if (mode !== "take" && mode !== "confirm") return undefined; const t = setInterval(() => setSec(s => s + 1), 1000); return () => clearInterval(t); }, [mode]);
  useEffect(() => { if (!saved && !result) setTraineeTestDraft({ testId: id, answers: ans, pendingSubmission: pendingSave }); }, [ans, pendingSave, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = v => { if (busy) return; setAns(a => ({ ...a, [qi]: v })); setPendingSave(null); setErr(""); };

  const finish = (next, payload) => onDone(payload).then(() => { setTraineeTestDraft({ testId: id, answers: ans, result: next }); setResult(next); setPendingSave(null); setMode("result"); window.scrollTo?.(0, 0); });
  const submit = async () => {
    if (busy) return;
    setErr(""); setBusy(true);
    if (pendingSave) {
      try { await finish(pendingSave.result, pendingSave.payload); } catch { setErr(SAVE_ERR); } finally { setBusy(false); }
      return;
    }
    let correct = 0, needsReview = 0, earned = 0, possible = 0;
    const details = {}, weak = [], fallback = N ? 100 / N : 0;
    for (let i = 0; i < N; i++) {
      const q = qs[i], val = ans[i], text = String(val ?? "").trim(), model = String(q.modelAnswer || q.answer || "").trim(), writing = q.type === "descriptive" || q.type === "code", points = questionPoints(q, fallback);
      possible += points;
      let ai = null, ok = isChoice(q) ? val === q.c : !!text && !!model && text === model, sc = ok ? 100 : 0;
      if (writing && text) {
        if (test.aiGrade === false) { ai = { status: "pending", comment: "", score: null }; needsReview++; ok = false; sc = 0; }
        else {
          try {
            ai = await apiPost("/ai/tests/evaluate", { testId: id, questionId: String(i), questionType: q.type, answerMode: answerModeOf(q), question: q.q, studentAnswer: text, modelAnswer: model, explanation: q.explanation || "", reviewPoint: q.reviewPoint || "", wrongReason: q.wrongReason || "", points: q.points || 10 });
            sc = Number(ai.score || 0); ok = !!ai.correct || sc >= 80;
            (ai.weakAreas || []).forEach(w => weak.push(w));
          } catch { ai = { status: "pending", comment: "", score: null }; needsReview++; }
        }
      }
      if (ok) correct++;
      earned += (Number(sc) || 0) / 100 * points;
      details[i] = { answer: val, correct: ok, needsReview: !!ai?.status, type: q.type, answerMode: answerModeOf(q), aiEvaluation: ai, score: sc, points, earned: Math.round(((Number(sc) || 0) / 100 * points) * 10) / 10 };
    }
    const score = possible ? Math.round(earned / possible * 100) : 0;
    const next = { score, correct, needsReview, details, weakAreas: weak };
    const payload = { score, total: 100, answers: details, correctCount: correct, totalQuestions: N, needsReview, weakAreas: [...new Set(weak)], elapsedSec: sec };
    try { await finish(next, payload); }
    catch { setPendingSave({ result: next, payload }); setErr(SAVE_ERR); }
    finally { setBusy(false); }
  };
  const leave = () => { if (result) clearTraineeTestDraft(id); onBack(); };

  if (!N) return <Card className="pad"><div className="empty"><b>{test.title}</b><Chip>問題なし</Chip><Btn kind="ghost sm" onClick={onBack}>テストの一覧へ</Btn></div></Card>;

  const timer = <span className={`timer${min && sec > min * 60 ? " over" : ""}`}>経過 <b className="num">{mmss(sec)}</b>{min > 0 && <small>目安 {min}分</small>}</span>;
  const map = (cls = "") => <span className={`qmap ${cls}`}>{qs.map((q, i) => <button key={i} type="button" className={`${given(q, ans[i]) ? "on" : ""}${cls && i === qi ? " cur" : ""}`} aria-label={`問題 ${i + 1}`} onClick={() => { setQi(i); setMode("take"); }}>{i + 1}</button>)}</span>;

  if (mode === "confirm") {
    return (
      <div className="st tkt">
        <div className="head"><div><div className="eyebrow">{test.title}</div><h1 className="h1">見直して提出</h1></div><span className="r">{timer}</span></div>
        <Card className="pad st-g">
          {map()}
          <div className="row"><Chip tone={answered < N ? "warn" : "ok"}>{answered} / {N} 問</Chip>{answered < N && <Chip tone="warn">まだ {N - answered} 問</Chip>}</div>
          {err && <div className="lms-err" role="alert">{err}</div>}
          <span className="row st-end"><Btn kind="ghost" disabled={busy} onClick={() => { setQi(N - 1); setMode("take"); }}>問題に戻る</Btn><Btn kind="big" disabled={busy} onClick={submit}>{busy ? "採点しています" : pendingSave ? "もう一度保存" : "提出する"}</Btn></span>
        </Card>
      </div>
    );
  }

  if (mode === "result" && result) {
    const pass = result.score >= PASS, wait = result.needsReview > 0;
    return (
      <div className="st tkt">
        <div className="head"><div><div className="eyebrow">{test.title}</div><h1 className="h1">結果</h1></div></div>
        <Card className="pad st-g">
          <div className={`result ${pass ? "ok" : "ng"}`}>
            <b className="num">{result.score}<small> 点</small></b>
            {wait ? <Chip tone="warn">採点待ち {result.needsReview} 問</Chip> : <Chip tone={pass ? "ok" : "bad"}>{pass ? "合格" : "不合格"}</Chip>}
            <span className="meta">合格は {PASS}点 ・ 正解 {result.correct} / {N}</span>
          </div>
          <span className="row tk-c"><Btn onClick={() => setMode("review")}>振り返る</Btn><Btn kind="ghost" onClick={leave}>テストの一覧へ</Btn></span>
        </Card>
      </div>
    );
  }

  if (mode === "review" && result) {
    const stateOf = i => { const d = result.details?.[i]; return d?.needsReview && !saved?.reviewedAt ? "wait" : d?.correct ? "ok" : "ng"; };
    const okN = qs.filter((_, i) => stateOf(i) === "ok").length, ngN = qs.filter((_, i) => stateOf(i) === "ng").length;
    const pass = result.score >= PASS;
    const dt = init?.date ? `${md(init.date)} に受けた` : "";
    return (
      <div className="st tkt">
        <div className="head"><div><div className="eyebrow">{[test.title, dt].filter(Boolean).join(" ・ ")}</div><h1 className="h1">ふりかえり</h1></div><span className="r"><Chip tone={pass ? "ok" : "bad"}>{result.score}点</Chip><Btn kind="ghost sm" onClick={leave}>テストの一覧へ</Btn></span></div>
        <div className="row"><Chip tone="ok">正解 {okN}</Chip><Chip tone="bad">まちがい {ngN}</Chip><span className="seg tk-r"><button type="button" aria-pressed={filter !== "ng"} onClick={() => setFilter("all")}>すべて</button><button type="button" aria-pressed={filter === "ng"} onClick={() => setFilter("ng")}>まちがいだけ</button></span></div>
        <div className="tk-list">
          {qs.map((q, i) => ({ q, i })).filter(({ i }) => filter !== "ng" || stateOf(i) === "ng").map(({ q, i }) => {
            const s = stateOf(i), ch = isChoice(q), a = result.details?.[i]?.aiEvaluation, mine = ch ? q.a?.[ans[i]] : ans[i];
            return (
              <Card key={i} className={`pad rq st-g ${s === "wait" ? "" : s}`}>
                <div className="head"><span className="row"><span className="qn">{i + 1}</span>{s === "ok" ? <Chip tone="ok">○ 正解</Chip> : s === "ng" ? <Chip tone="bad">✕ まちがい</Chip> : <Chip tone="warn">採点待ち</Chip>}</span></div>
                <b>{q.q}</b>
                <div className="ans">
                  <span><small>あなたの答え</small>{ch ? (mine ?? "—") : <pre className="tk-pre">{mine || "—"}</pre>}</span>
                  {s !== "ok" && <span className="right"><small>{ch ? "正解" : "解答例"}</small>{ch ? q.a?.[q.c] : <pre className="tk-pre">{q.modelAnswer || q.answer || "—"}</pre>}</span>}
                </div>
                {a?.comment && <div className="ex"><small>AI の講評</small>{a.comment}</div>}
                {q.explanation && <div className="ex"><small>解説</small>{q.explanation}</div>}
                {q.sourceMaterialId && onMaterial && <span><Btn kind="ghost sm" onClick={() => onMaterial(q.sourceMaterialId, q.sourcePage)}>教材を開く ↗</Btn></span>}
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const q = qs[qi], ch = isChoice(q);
  return (
    <div className="st tkt">
      <div className="ttop">
        <b>{test.title}</b><span className="num">問題 {qi + 1} / {N}</span>{timer}
        <span className="bar10 tk-bar"><i style={{ "--w": `${Math.round((qi + 1) / N * 100)}%` }} /></span>
        <Btn kind="ghost sm" onClick={onBack}>テストの一覧へ</Btn>
      </div>
      <Card className="pad st-g">
        <span className="eyebrow">問題 {qi + 1}</span>
        <h2 className="h2 tk-q">{q.q}</h2>
        {ch
          ? <div className="choices">{(q.a || []).map((c, k) => <button key={k} type="button" aria-pressed={ans[qi] === k} onClick={() => pick(k)}><span className="k">{KEYS[k]}</span>{c}</button>)}</div>
          : <textarea className={`in tk-ta${q.type === "code" ? " code" : ""}`} rows={q.type === "code" ? 10 : 5} aria-label={`問題 ${qi + 1} の答え`} value={ans[qi] || ""} onChange={e => pick(e.target.value)} />}
        <div className="row tk-nav">
          <Btn kind="ghost" disabled={!qi} onClick={() => setQi(qi - 1)}>‹ 前の問題</Btn>
          {map("sm")}
          {qi < N - 1 ? <Btn onClick={() => { setQi(qi + 1); window.scrollTo?.(0, 0); }}>次の問題 ›</Btn> : <Btn onClick={() => setMode("confirm")}>見直して提出 ›</Btn>}
        </div>
      </Card>
    </div>
  );
}
