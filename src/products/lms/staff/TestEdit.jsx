import React, { useMemo, useRef, useState } from "react";
import { apiPut } from "../../../api.js";
import { testQuestionsOf } from "../../training/TrainingComponents.jsx";
import { testIdOf } from "../../training/useTraining.js";
import { Btn, Chip, Modal } from "../parts/ui.jsx";
import { errText } from "./common.js";
import { DropBox, readTestFiles } from "./TestFile.jsx";

/* テストを直す（モック xtedit）：名前・実施する日・始める時刻・目安の時間・公開、問題と解答を直す・足す・Word で差し替える */

const KINDS = [["choice", "選ぶ"], ["descriptive", "書く"], ["code", "コード"]];
const toRaw = q => ({
  type: q.type, answerMode: q.answerMode, question: q.q, options: q.a, correctIndex: q.c,
  answer: q.type === "choice" ? (q.a[q.c] ?? "") : q.modelAnswer, modelAnswer: q.type === "choice" ? (q.a[q.c] ?? "") : q.modelAnswer,
  topic: q.topic || "", weight: q.weight || "", explanation: q.explanation || "", wrongReason: q.wrongReason || "", reviewPoint: q.reviewPoint || "",
  points: q.points || 10, sourceMaterialId: q.sourceMaterialId || "", sourcePage: q.sourcePage || 0,
});
const blank = () => ({ type: "choice", answerMode: "", q: "", a: ["", "", "", ""], c: 0, modelAnswer: "", explanation: "", points: 10 });
const fromRead = q => ({ type: q.type || "choice", answerMode: q.answerMode || "", q: q.question || "", a: q.choices || [], c: Math.max(0, (q.choices || []).indexOf(q.answer)), modelAnswer: q.modelAnswer || q.answer || "", explanation: q.explanation || "", points: q.points || 10 });

function QEdit({ q, i, onChange, onDelete, onClose }) {
  const set = patch => onChange({ ...q, ...patch });
  const setType = type => set({ type, answerMode: type === "code" ? "codeExact" : type === "descriptive" ? "explanation" : "", a: type === "choice" && !q.a.length ? ["", "", "", ""] : q.a });
  return (
    <div className="tqe-e st-g">
      <div className="row"><span className="qn">{i + 1}</span><span className="seg">{KINDS.map(([k, t]) => <button key={k} type="button" aria-pressed={q.type === k} onClick={() => setType(k)}>{t}</button>)}</span><span className="st-sp" /><Btn kind="ghost sm" onClick={onDelete}>消す</Btn><Btn kind="ghost sm" onClick={onClose}>閉じる</Btn></div>
      <label className="field">問題<textarea rows={2} value={q.q} onChange={e => set({ q: e.target.value })} /></label>
      {q.type === "choice"
        ? <div className="st-g">{q.a.map((o, k) => <label key={k} className="tqe-c"><input type="radio" name={`tqe-${i}`} checked={q.c === k} aria-label={`${"ABCD"[k] || k + 1} を正解にする`} onChange={() => set({ c: k })} /><input type="text" value={o} aria-label={`選択肢 ${"ABCD"[k] || k + 1}`} onChange={e => set({ a: q.a.map((x, y) => (y === k ? e.target.value : x)) })} /></label>)}</div>
        : <label className="field">解答例<textarea rows={q.type === "code" ? 5 : 3} className={q.type === "code" ? "tk-ta code" : ""} value={q.modelAnswer} onChange={e => set({ modelAnswer: e.target.value })} /></label>}
      <label className="field">解説<input type="text" value={q.explanation || ""} onChange={e => set({ explanation: e.target.value })} /></label>
    </div>
  );
}

export function TestEditModal({ test, unitName = "", courseId = "", onClose, onSaved }) {
  const start = String(test.startAt || "");
  const [v, setV] = useState({ title: test.title || "", date: String(test.dueDate || "").slice(0, 10), time: start.slice(11, 16), min: String(test.limitMinutes || 20), pub: test.status === "published", ai: test.aiGrade !== false });
  const [qs, setQs] = useState(() => testQuestionsOf(test));
  const [openQ, setOpenQ] = useState(-1);
  const [swap, setSwap] = useState(null); // { prob, ans, busy }
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const alive = useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const hasWrite = useMemo(() => qs.some(q => q.type === "descriptive" || q.type === "code"), [qs]);
  const set = p => setV(x => ({ ...x, ...p }));

  const read = async () => {
    if (!swap?.prob) { setErr("問題のファイルを入れてください"); return; }
    setErr(""); setSwap(s => ({ ...s, busy: true }));
    try {
      const r = await readTestFiles({ courseId, title: v.title, prob: swap.prob, ans: swap.ans, alive });
      if (!alive.current || !r) return;
      setQs(r.questions.map(fromRead)); setOpenQ(-1); setSwap(null);
    } catch (e) { if (alive.current) { setErr(errText(e, "読み取れませんでした")); setSwap(s => ({ ...s, busy: false })); } }
  };
  const save = async () => {
    if (!v.title.trim()) { setErr("テストの名前を入れてください"); return; }
    const bad = qs.findIndex(q => !String(q.q).trim() || (q.type === "choice" && q.a.filter(x => String(x).trim()).length < 2));
    if (bad >= 0) { setOpenQ(bad); setErr(`問題 ${bad + 1} を入れてください`); return; }
    setBusy(true); setErr("");
    try {
      await apiPut(`/tests/${encodeURIComponent(testIdOf(test))}`, { title: v.title.trim(), limitMinutes: Number(v.min) || 0, dueDate: v.date, startAt: v.date && v.time ? `${v.date}T${v.time}` : "", status: v.pub ? "published" : "draft", aiGrade: v.ai, questions: qs.map(q => toRaw({ ...q, a: q.type === "choice" ? q.a.filter(x => String(x).trim()) : q.a })) });
      onSaved();
    } catch (e) { setErr(errText(e, "保存できませんでした")); setBusy(false); }
  };

  return (
    <Modal title="テストを直す" width={640} onClose={onClose} footer={<><Btn kind="ghost" disabled={busy} onClick={onClose}>やめる</Btn><Btn disabled={busy} onClick={save}>{busy ? "保存しています" : "この内容にする"}</Btn></>}>
      {err && <div className="lms-err" role="alert">{err}</div>}
      <label className="field">テストの名前<input type="text" maxLength={120} value={v.title} onChange={e => set({ title: e.target.value })} /></label>
      <div className="rowsx"><div><span>単元</span><b>{unitName || "コース全体"}</b></div><div><span>問題</span><b>{qs.length} 問</b></div></div>
      <div className="g3"><label className="field">実施する日<input type="date" value={v.date} onChange={e => set({ date: e.target.value })} /></label><label className="field">始める時刻<input type="time" value={v.time} onChange={e => set({ time: e.target.value })} /></label><label className="field">目安の時間<select className="in" value={v.min} onChange={e => set({ min: e.target.value })}>{[...new Set([10, 15, 20, 30, 45, 60, Number(v.min) || 20])].sort((a, b) => a - b).map(m => <option key={m} value={m}>{m}分</option>)}</select></label></div>
      <div className="field">公開<span className="stsel"><button type="button" aria-pressed={!v.pub} onClick={() => set({ pub: false })}>下書き</button><button type="button" aria-pressed={v.pub} onClick={() => set({ pub: true })}>公開する</button></span></div>
      {hasWrite && <span className="checks"><label className={v.ai ? "on" : ""}><input type="checkbox" checked={v.ai} onChange={e => set({ ai: e.target.checked })} />書く問題は AI で点をつける（解答例と照らす）</label></span>}
      <div className="field">問題と解答
        <div className="tqe">
          {qs.map((q, i) => (openQ === i
            ? <QEdit key={i} q={q} i={i} onChange={n => setQs(l => l.map((x, y) => (y === i ? n : x)))} onDelete={() => { setQs(l => l.filter((_, y) => y !== i)); setOpenQ(-1); }} onClose={() => setOpenQ(-1)} />
            : <div key={i}><span className="qn">{i + 1}</span><span>{q.q || "（問題なし）"}</span>{q.type === "choice" ? <Chip tone="ok">正解 {"ABCD"[q.c] || q.c + 1}</Chip> : <Chip tone="mk">{v.ai ? "解答例 ・ AI" : "解答例"}</Chip>}<Btn kind="ghost sm" onClick={() => setOpenQ(i)}>直す</Btn></div>))}
        </div>
        {swap
          ? <div className="st-g"><div className="g2e"><DropBox label="問題の Word・Excel" file={swap.prob} disabled={swap.busy} onFile={f => setSwap(s => ({ ...s, prob: f }))} /><DropBox label="解答の Word・Excel" file={swap.ans} disabled={swap.busy} onFile={f => setSwap(s => ({ ...s, ans: f }))} /></div><span className="row st-end"><Btn kind="ghost sm" disabled={swap.busy} onClick={() => setSwap(null)}>やめる</Btn><Btn kind="sm" disabled={swap.busy} onClick={read}>{swap.busy ? "読み取っています" : "読み取る"}</Btn></span></div>
          : <span className="row"><Btn kind="ghost sm" onClick={() => setSwap({ prob: null, ans: null, busy: false })}>問題と解答を差し替える（Word）</Btn><Btn kind="ghost sm" onClick={() => { setQs(l => [...l, blank()]); setOpenQ(qs.length); }}>問題を足す</Btn></span>}
      </div>
    </Modal>
  );
}
