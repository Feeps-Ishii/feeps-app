import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../api.js";
import { TEST_SCOPE_KEYS, flattenCurriculumScopes } from "../../training/TrainingComponents.jsx";
import { readDocText } from "../admin/CourseCreate.jsx";
import { Btn, Chip, Modal } from "../parts/ui.jsx";
import { arr, errText } from "./common.js";

/* テストを作る（モック xtnew）：問題と解答のファイルを選ぶ → AI が読み取る → 確かめて保存。
   文字は画面で取り出して /ai/test-read に送る。courseId が空なら全コース共通のテストとして作る */

const WRITTEN = t => t !== "choice" && t !== "trueFalse";
export const takeTestFiles = files => {
  const list = [...files], ans = list.find(f => /解答|answer/i.test(f.name)) || null;
  return { ans, prob: list.find(f => f !== ans) || null };
};

export function DropBox({ label, file, onFile, disabled }) {
  return (
    <label className={`drop${file ? " on" : ""}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && !disabled) onFile(f); }}>
      <b>{label}</b><span>{file?.name || "ここに落とす"}</span>
      <input type="file" accept=".docx,.xlsx,.xls,.csv" className="lms-sr" disabled={disabled} aria-label={label} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
    </label>
  );
}

// 問題と解答のファイルを AI に読ませる（作る窓・直す窓で同じ）
export async function readTestFiles({ courseId, title, prob, ans, alive }) {
  const [problemText, answerText] = await Promise.all([readDocText(prob), ans ? readDocText(ans) : Promise.resolve("")]);
  const { jobId } = await apiPost("/ai/test-read", { courseId, title: String(title || "").trim(), problemText, answerText });
  for (let i = 0; i < 100 && alive.current; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(r => setTimeout(r, 3000));
    // eslint-disable-next-line no-await-in-loop
    const r = await apiGet(`/ai/test-read/${encodeURIComponent(jobId)}`);
    if (r.status === "error") throw new Error(r.error || "読み取れませんでした");
    if (r.status === "done") return { questions: arr(r.questions), warnings: arr(r.warnings) };
  }
  if (!alive.current) return null;
  throw new Error("読み取りに時間がかかっています。もう一度お試しください");
}

export function TestFileModal({ courseId = "", sections = [], initial, onClose, onSaved }) {
  const [step, setStep] = useState(1);
  const [v, setV] = useState({ sectionId: initial?.sectionId || sections[0]?.id || "", title: "", date: "", time: "", min: "20" });
  const [prob, setProb] = useState(initial?.prob || null); const [ans, setAns] = useState(initial?.ans || null);
  const [qs, setQs] = useState([]); const [warn, setWarn] = useState([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const opts = useMemo(() => flattenCurriculumScopes(sections), [sections]);
  const set = patch => setV(x => ({ ...x, ...patch }));

  const read = async () => {
    if (!v.title.trim()) { setErr("テストの名前を入れてください"); return; }
    if (!prob) { setErr("問題のファイルを入れてください"); return; }
    setErr(""); setStep(2);
    try {
      const r = await readTestFiles({ courseId, title: v.title, prob, ans, alive });
      if (r && alive.current) { setQs(r.questions); setWarn(r.warnings); setStep(3); }
    } catch (e) { if (alive.current) { setErr(errText(e, "読み取れませんでした")); setStep(1); } }
  };

  const save = async status => {
    setBusy(true); setErr("");
    const scope = courseId && v.sectionId ? opts.find(o => o.id === `section:${v.sectionId}`) : null;
    const fields = scope ? Object.fromEntries(TEST_SCOPE_KEYS.map(k => [k, scope[k] || ""])) : {};
    try {
      const made = await apiPost("/tests", {
        title: v.title.trim(), description: "", type: "quiz", limitMinutes: Number(v.min) || 0, dueDate: v.date, startAt: v.date && v.time ? `${v.date}T${v.time}` : "", aiGrade: v.ai !== false, status,
        courseIds: courseId ? [courseId] : [], courseId, ...fields, ...(courseId ? { courseScopes: { [courseId]: scope ? fields : null } } : { common: true }),
        questions: qs.map(q => ({
          type: q.type, answerMode: q.answerMode, question: q.question, options: q.choices, correctIndex: Math.max(0, q.choices.indexOf(q.answer)),
          answer: q.answer || q.modelAnswer, modelAnswer: q.modelAnswer || q.answer, topic: "", weight: "", explanation: q.explanation, wrongReason: "", reviewPoint: "", points: q.points, sourceMaterialId: "", sourcePage: 0,
        })),
      });
      onSaved(made, status);
    } catch (e) { setErr(errText(e, "保存できませんでした")); setBusy(false); }
  };

  const answered = qs.filter(q => q.answer || q.modelAnswer).length;
  const foot = step === 1 ? <><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn onClick={read}>読み取る</Btn></>
    : step === 2 ? <Btn kind="ghost" onClick={onClose}>やめる</Btn>
      : <><Btn kind="ghost" disabled={busy} onClick={onClose}>やめる</Btn><Btn kind="ghost" disabled={busy} onClick={() => save("draft")}>下書きで保存</Btn><Btn disabled={busy} onClick={() => save("published")}>公開する</Btn></>;
  return (
    <Modal title="テストを作る" width={720} onClose={onClose} footer={foot}>
      <div className="steps">{["① 問題と解答を選ぶ", "② 読み取る", "③ 確かめて保存"].map((x, i) => <span key={x} className={step === i + 1 ? "on" : step > i + 1 ? "done" : ""}>{x}</span>)}</div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {step === 1 && (
        <>
          <div className="g2e">
            {courseId ? <label className="field">単元<select className="in" value={v.sectionId} onChange={e => set({ sectionId: e.target.value })}><option value="">コース全体</option>{sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label> : null}
            <label className="field">テストの名前<input type="text" maxLength={120} value={v.title} placeholder="例）確認テスト Spring 応用" onChange={e => set({ title: e.target.value })} /></label>
          </div>
          <div className="g2e">
            {courseId ? <label className="field">実施する日<input type="date" value={v.date} onChange={e => set({ date: e.target.value })} /></label> : null}
            {courseId ? <label className="field">始める時刻<input type="time" value={v.time} onChange={e => set({ time: e.target.value })} /></label> : null}
            <label className="field">目安の時間<select className="in" value={v.min} onChange={e => set({ min: e.target.value })}>{[10, 15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m}分</option>)}</select></label>
          </div>
          <div className="g2e"><DropBox label="問題の Word・Excel" file={prob} onFile={setProb} /><DropBox label="解答の Word・Excel" file={ans} onFile={setAns} /></div>
          <div className="rowsx"><div><span>点のつけ方</span><b>解答と照らして自動でつける</b></div></div>
          <span className="checks"><label className={v.ai !== false ? "on" : ""}><input type="checkbox" checked={v.ai !== false} onChange={e => set({ ai: e.target.checked })} />書く問題は AI で点をつける（解答例と照らす）</label></span>
        </>
      )}
      {step === 2 && <><div className="empty">問題と解答を読み取っています…</div><span className="bar10"><i style={{ "--w": "64%" }} /></span></>}
      {step === 3 && (
        <>
          <div className="okmsg">{qs.length} 問・解答 {answered} を読み取りました（下書き）</div>
          {warn.map(w => <span key={w}><Chip tone="warn">{w}</Chip></span>)}
          <div className="scroll"><table className="tbl"><thead><tr><th>#</th><th>問題</th><th>形式</th><th>正解</th><th>配点</th></tr></thead><tbody>
            {qs.map((q, i) => (
              <tr key={i}>
                <td className="num">{i + 1}</td><td>{q.question}</td>
                <td><Chip tone={WRITTEN(q.type) ? "blue" : ""}>{WRITTEN(q.type) ? "書く" : "選ぶ"}</Chip></td>
                <td>{WRITTEN(q.type) ? <Chip tone={q.modelAnswer ? "mk" : "warn"}>{q.modelAnswer ? "解答例" : "解答なし"}</Chip> : q.choices.includes(q.answer) ? <b className="num">{"ABCDEFGHIJ"[q.choices.indexOf(q.answer)]}</b> : <Chip tone="warn">解答なし</Chip>}</td>
                <td className="num">{q.points}</td>
              </tr>
            ))}
          </tbody></table></div>
        </>
      )}
    </Modal>
  );
}
