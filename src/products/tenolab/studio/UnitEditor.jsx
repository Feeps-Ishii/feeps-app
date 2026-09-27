import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { CHECKS_JS, DEMO_MODES, HINT_LEVELS, RUNTIMES, blankStep, blankUnit, errText, fillUnit, splitList, toSave, unitIssues } from "./studioModel.js";

/* 単元づくり。左：ステップの一覧／中：最初のコードと完成形／右：選んだところの入力。
   下書きを保存 → 受講生として試す（下書きをそのまま動かす）→ 公開する（直すところがあれば止める） */
export default function UnitEditor({ courseId, unitId, setToast, onGo }) {
  const [st, setSt] = useState({ state: "loading" });
  const [unit, setUnit] = useState(null);
  const [saved, setSaved] = useState(null);      // 最後に保存した形（変更ありの判定）
  const [meta, setMeta] = useState({ published: false, changed: true, draftUpdatedAt: null });
  const [courseTitle, setCourseTitle] = useState("");
  const [sel, setSel] = useState(0);             // 0＝概要、1〜＝ステップ
  const [codeTab, setCodeTab] = useState("start");
  const [showIssues, setShowIssues] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [armDel, setArmDel] = useState(false);

  const load = useCallback(async () => {
    setSt({ state: "loading" });
    try {
      const [res, c] = await Promise.all([
        apiGet(`/tenolab/courses/${courseId}/units/${unitId}?draft=1`),
        apiGet(`/tenolab/courses/${courseId}?draft=1`).catch(() => null),
      ]);
      const u = fillUnit(res.unit);
      setUnit(u); setSaved(JSON.stringify(u));
      setMeta({ published: res.published, changed: res.changed, draftUpdatedAt: res.draftUpdatedAt });
      setCourseTitle(c?.course?.title || courseId);
      setSt({ state: "ready" });
    } catch (e) {
      console.warn("tenolab unit load failed", e);
      setSt({ state: e?.status === 404 ? "missing" : "error" });
    }
  }, [courseId, unitId]);
  useEffect(() => { load(); }, [load]);

  const issues = useMemo(() => (unit ? unitIssues(unit) : []), [unit]);
  const dirty = unit && JSON.stringify(unit) !== saved;

  // 保存していない変更があるまま閉じようとしたら止める
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  if (st.state === "loading") return <p className="wk-note" role="status">単元を読み込んでいます…</p>;
  if (st.state === "missing") {
    // コースの章には並んでいるが、中身をまだ作っていない単元
    const create = async () => {
      setBusy(true); setErr("");
      try {
        await apiPut(`/tenolab/courses/${courseId}/units/${unitId}`, { unit: blankUnit(unitId, ""), baseUpdatedAt: "" });
        load();
      } catch (e) {
        setErr(errText(e, "作れませんでした。"));
      } finally { setBusy(false); }
    };
    return (
      <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
        <div className="crumb"><a href="#/studio">コース管理</a> ／ <a href={`#/studio/${courseId}`}>{courseId}</a> ／ {unitId}</div>
        <ul className="kw sm"><li className="m">{unitId}</li><li>未作成</li></ul>
        {err && <div className="issues" role="alert"><b>{err}</b></div>}
        <button className="btn btn-pri" type="button" disabled={busy} onClick={create}>この単元を作る</button>
      </div>
    );
  }
  if (st.state === "error" || !unit) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div className="info" role="alert">単元を読み込めませんでした。通信状況を確かめて、もう一度読み込んでください。</div>
        <div><button className="btn btn-sec" type="button" onClick={load}>もう一度読み込む</button></div>
      </div>
    );
  }

  const setU = (patch) => setUnit(u => ({ ...u, ...patch }));
  const step = sel > 0 ? unit.steps[sel - 1] : null;
  const setStep = (patch) => setUnit(u => ({ ...u, steps: u.steps.map((s, i) => (i === sel - 1 ? { ...s, ...patch } : s)) }));

  async function save(quiet) {
    setBusy(true); setErr("");
    try {
      const res = await apiPut(`/tenolab/courses/${courseId}/units/${unitId}`, { unit: toSave(unit), baseUpdatedAt: meta.draftUpdatedAt || "" });
      const u = fillUnit(res.unit);
      setUnit(u); setSaved(JSON.stringify(u));
      setMeta(m => ({ ...m, draftUpdatedAt: res.draftUpdatedAt, changed: true }));
      if (!quiet) setToast("下書きを保存しました");
      return true;
    } catch (e) {
      setErr(errText(e, "保存できませんでした。"));
      return false;
    } finally { setBusy(false); }
  }

  async function tryAsLearner() {
    if (dirty && !(await save(true))) return;
    window.location.hash = `#/studio/${courseId}/${unitId}/try`;
  }

  async function publish() {
    if (issues.length) { setShowIssues(true); return; }
    if (dirty && !(await save(true))) return;
    setBusy(true); setErr("");
    try {
      const res = await apiPost(`/tenolab/courses/${courseId}/units/${unitId}/publish`, {});
      setMeta(m => ({ ...m, published: true, changed: false, publishedAt: res.publishedAt }));
      setShowIssues(false);
      setToast("公開しました");
    } catch (e) {
      if (e?.status === 422) setShowIssues(true);
      setErr(errText(e, "公開できませんでした。"));
    } finally { setBusy(false); }
  }

  async function removeUnit() {
    if (!armDel) { setArmDel(true); setTimeout(() => setArmDel(false), 4000); return; }
    setBusy(true); setErr("");
    try {
      await apiDelete(`/tenolab/courses/${courseId}/units/${unitId}`);
      const c = await apiGet(`/tenolab/courses/${courseId}?draft=1`);
      const chapters = c.course.chapters.map(ch => ({ ...ch, units: ch.units.filter(x => x !== unitId) }));
      await apiPut(`/tenolab/courses/${courseId}`, { ...c.course, chapters });
      setSaved(JSON.stringify(unit)); // 離れる確認を出さない
      window.location.hash = `#/studio/${courseId}`;
    } catch (e) {
      setErr(errText(e, "消せませんでした。"));
      setBusy(false);
    }
  }

  function addStep() {
    setUnit(u => ({ ...u, steps: [...u.steps, blankStep(u.steps.length + 1)] }));
    setSel(unit.steps.length + 1);
  }
  function moveStep(dir) {
    const i = sel - 1, j = i + dir;
    if (j < 0 || j >= unit.steps.length) return;
    setUnit(u => { const s = [...u.steps]; [s[i], s[j]] = [s[j], s[i]]; return { ...u, steps: s }; });
    setSel(j + 1);
  }
  function delStep() {
    if (unit.steps.length <= 1) { setErr("ステップは1つ以上必要です。"); return; }
    const n = sel;
    setUnit(u => ({ ...u, steps: u.steps.filter((_, i) => i !== n - 1) }));
    setSel(Math.min(n, unit.steps.length - 1));
  }

  const badStep = (i) => issues.some(x => x.step === i + 1 && !/AI/.test(x.message));
  const stateChip = !meta.published ? <span className="chip draft">未公開</span>
    : dirty || meta.changed ? <span className="chip edit">変更あり（まだ公開していない）</span> : <span className="chip pub">公開中</span>;
  const codeValue = codeTab === "answer" ? unit.files.answer : codeTab === "css" ? unit.files.css : unit.files.start;
  const setCode = (v) => setU({ files: { ...unit.files, [codeTab]: v } });

  return (
    <>
      <div className="crumb"><a href="#/studio">コース管理</a> ／ <a href={`#/studio/${courseId}`}>{courseTitle}</a> ／ {unitId}</div>
      <div className="ue-top">
        <h1>{unit.title || "（名前なし）"}</h1>
        {stateChip}
        {dirty && <span className="chip">保存していない変更</span>}
        <span className="sp" />
        <button className="btn btn-sec" type="button" disabled={busy} onClick={tryAsLearner}>受講生として試す</button>
        <button className="btn btn-sec" type="button" disabled={busy || !dirty} onClick={() => save(false)}>下書きを保存</button>
        <button className="btn btn-pri" type="button" disabled={busy} onClick={publish}>公開する</button>
      </div>
      {err && <div className="issues" role="alert"><b>{err}</b></div>}
      {showIssues && issues.length > 0 && (
        <div className="issues" role="alert">
          <b>公開する前に直すところ（{issues.length}件）</b>
          {issues.map((x, k) => <button key={k} type="button" onClick={() => setSel(x.step)}>{x.message}</button>)}
        </div>
      )}
      <div className="ue">
        <div>
          <nav className="ul" aria-label="ステップ">
            <button className="it" type="button" aria-current={sel === 0} onClick={() => setSel(0)}>
              <span className="k ov">概要</span>
              <span><span className="tt">単元の概要</span><span className="ss"><span className="chip">やること・データ</span></span></span>
            </button>
            {unit.steps.map((s, i) => (
              <button className="it" type="button" key={i} aria-current={sel === i + 1} onClick={() => setSel(i + 1)}>
                <span className="k">{i + 1}</span>
                <span><span className="tt">{s.title || "（名前なし）"}</span>
                  <span className="ss">{s.aiDraft && <span className="chip ai">AI下書き</span>}{badStep(i) ? <span className="chip draft">未入力あり</span> : <span className="chip pub">合格条件あり</span>}</span></span>
              </button>
            ))}
            <button className="add" type="button" onClick={addStep}>＋ ステップを足す</button>
          </nav>
          <button className="ai-btn" type="button" disabled title="次の版で使えます">AIでたたき台を作る（準備中）</button>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-sm btn-sec" type="button" onClick={removeUnit} disabled={busy || meta.published}>
              {armDel ? "もう一度押すと消します" : "この単元を消す"}
            </button>
          </div>
        </div>

        <div className="ce2">
          <div className="ce2-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={codeTab === "start"} onClick={() => setCodeTab("start")}>最初のコード</button>
            <button type="button" role="tab" aria-selected={codeTab === "answer"} onClick={() => setCodeTab("answer")}>完成形</button>
            <span className="fn">{unit.fileName} ・ JavaScript</span>
          </div>
          <label className="sr" htmlFor="codeArea">コード</label>
          <textarea id="codeArea" spellCheck={false} wrap="off" value={codeValue} onChange={e => setCode(e.target.value)}
            onKeyDown={e => { if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); const t = e.target, a = t.selectionStart; t.setRangeText("  ", a, t.selectionEnd, "end"); setCode(t.value); } }} />
          <div className="ce2-foot">
            <span><b>最初のコード</b> ＝ 開いたとき ・ <b>完成形</b> ＝ 「完成形と同じ行」の判定と、ゴール欄の出力</span>
            {step && step.anchor.length > 0 && <span>吹き出し → <code>{step.anchor[0]}</code> の行</span>}
          </div>
        </div>

        <div className="uf">
          {sel === 0 ? <Overview unit={unit} setU={setU} /> : <StepForm n={sel} step={step} setStep={setStep} unit={unit} onMove={moveStep} onDelete={delStep} />}
        </div>
      </div>
    </>
  );
}

function Overview({ unit, setU }) {
  return (
    <>
      <h2>単元の概要</h2>
      <div className="fld2"><span className="lb">実行環境</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} role="radiogroup" aria-label="実行環境">
          {RUNTIMES.map(r => (
            <label key={r.id} className="chip" style={{ padding: "4px 10px", opacity: r.ready ? 1 : 0.55 }}>
              <input type="radio" name="rt" checked={unit.runtime === r.id} disabled={!r.ready} onChange={() => setU({ runtime: r.id })} style={{ margin: "0 6px 0 0" }} />
              {r.name}{!r.ready && " ・ 準備中"}
            </label>
          ))}
        </div>
      </div>
      <div className="fld2"><label htmlFor="ovT">単元の名前</label><input className="in" id="ovT" value={unit.title} onChange={e => setU({ title: e.target.value })} /></div>
      <div className="fld2"><label htmlFor="ovTodo">この単元でやること</label><textarea className="in" id="ovTodo" value={unit.todo} onChange={e => setU({ todo: e.target.value })} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="fld2"><label htmlFor="ovFile">ファイル名</label><input className="in mono" id="ovFile" value={unit.fileName} onChange={e => setU({ fileName: e.target.value })} /></div>
        <div className="fld2"><label htmlFor="ovMin">目安（分）</label><input className="in" id="ovMin" type="number" min={5} max={120} value={unit.minutes} onChange={e => setU({ minutes: Number(e.target.value) })} /></div>
      </div>
      <div className="fld2"><label htmlFor="ovData">受講生が書き換えるデータ（変数名）</label><input className="in mono" id="ovData" value={unit.dataVar} placeholder="scores" onChange={e => setU({ dataVar: e.target.value.trim() })} />
        <span className="help">配列 → 完成形の出力をこのデータで計算し直す</span></div>
      <div className="fld2"><label htmlFor="ovWatch">「変数の中身」に出す変数（カンマ区切り）</label><input className="in mono" id="ovWatch" value={unit.watch.join(", ")} onChange={e => setU({ watch: splitList(e.target.value) })} /></div>
      <div className="fld2"><label htmlFor="ovAdds">アプリに加わるもの</label><input className="in" id="ovAdds" value={unit.adds} onChange={e => setU({ adds: e.target.value })} /></div>
      <div className="fld2"><label htmlFor="ovSk">身につくこと（カンマ区切り）</label><input className="in" id="ovSk" value={unit.skills.join(", ")} onChange={e => setU({ skills: splitList(e.target.value) })} /></div>
      <div className="fld2"><label htmlFor="ovCoach">AIコーチへのメモ（受講生には見えない）</label><textarea className="in" id="ovCoach" value={unit.coachNote} onChange={e => setU({ coachNote: e.target.value })} />
        <span className="help">よくある間違い → コーチが先回り</span></div>
    </>
  );
}

function StepForm({ n, step, setStep, unit, onMove, onDelete }) {
  const def = CHECKS_JS.find(c => c.id === step.check.kind) || CHECKS_JS[0];
  const setCheck = (patch) => setStep({ check: { ...step.check, ...patch } });
  const setDemo = (patch) => setStep({ demo: { ...step.demo, ...patch } });
  return (
    <>
      <h2>ステップ {n}{step.aiDraft && <> <span className="chip ai">AI下書き</span></>}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 120px", gap: 10 }}>
        <div className="fld2"><label htmlFor="stT">ステップの名前</label><input className="in" id="stT" value={step.title} onChange={e => setStep({ title: e.target.value })} /></div>
        <div className="fld2"><label htmlFor="stShort">短い名前</label><input className="in" id="stShort" maxLength={12} value={step.short} onChange={e => setStep({ short: e.target.value })} /></div>
      </div>
      <div className="fld2"><label htmlFor="stTodo">やること（1文で）</label><input className="in" id="stTodo" value={step.todo} onChange={e => setStep({ todo: e.target.value })} /></div>
      <div className="fld2"><label htmlFor="stBody">説明（コードの横の吹き出し）</label><textarea className="in" id="stBody" value={step.body} onChange={e => setStep({ body: e.target.value })} />
        <span className="help">`コード` ・ **太字**</span></div>
      <div className="fld2"><label htmlFor="stAnchor">吹き出しを出す行（この言葉がある行。1行に1つ、上から探す）</label>
        <textarea className="in mono" id="stAnchor" rows={2} value={step.anchor.join("\n")} onChange={e => setStep({ anchor: e.target.value.split("\n") })} /></div>
      <div className="fld2"><label htmlFor="stMark">このステップで足す目印の行（なければ空）</label>
        <input className="in mono" id="stMark" value={step.appendOnStart} placeholder="// ステップ4：平均を求めよう" onChange={e => setStep({ appendOnStart: e.target.value })} /></div>

      <div className="fld2"><label htmlFor="stKind">合格の条件</label>
        <select className="in" id="stKind" value={step.check.kind} onChange={e => setCheck({ kind: e.target.value })}>
          {CHECKS_JS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {def.need === "prefix" && <>
          <label htmlFor="stVal" className="help" style={{ marginTop: 4 }}>{def.label}</label>
          <input className="in mono" id="stVal" value={step.check.prefix} placeholder={def.ph} onChange={e => setCheck({ prefix: e.target.value })} />
          <span className="help">完成形 × 受講生のデータ → この行</span>
        </>}
        {def.need === "value" && <>
          <label htmlFor="stVal" className="help" style={{ marginTop: 4 }}>{def.label}</label>
          <textarea className="in mono" id="stVal" rows={2} value={step.check.value} placeholder={def.ph} onChange={e => setCheck({ value: e.target.value })} />
        </>}
        {def.id === "change" && <span className="help">{unit.dataVar ? <><code>{unit.dataVar}</code> が最初と違えば合格</> : "概要 → 書き換えるデータ"}</span>}
      </div>

      <div className="fld2"><span className="lb">ヒント（押すたびに1段ずつ）</span>
        {HINT_LEVELS.map((lb, k) => (
          <div className="hint-row" key={k}><span>{lb}</span>
            <input className="in" aria-label={`ヒント ${lb}`} value={step.hints[k]} onChange={e => setStep({ hints: step.hints.map((h, i) => (i === k ? e.target.value : h)) })} /></div>
        ))}
      </div>
      <div className="fld2"><label htmlFor="stWhy">「なぜこう書くの？」への答え</label><textarea className="in" id="stWhy" value={step.why} onChange={e => setStep({ why: e.target.value })} /></div>
      <div className="fld2"><label htmlFor="stDone">合格したときのひとこと</label><input className="in" id="stDone" value={step.done} onChange={e => setStep({ done: e.target.value })} /></div>

      <div className="fld2"><label htmlFor="stDemo">お手本</label>
        <select className="in" id="stDemo" value={step.demo.mode} onChange={e => setDemo({ mode: e.target.value })}>
          {DEMO_MODES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {(step.demo.mode === "insert" || step.demo.mode === "replace") && <>
          <label htmlFor="stAt" className="help" style={{ marginTop: 4 }}>{step.demo.mode === "insert" ? "この文字のすぐ後" : "打ち替える文字"}</label>
          <input className="in mono" id="stAt" value={step.demo.at} onChange={e => setDemo({ at: e.target.value })} />
        </>}
        {step.demo.mode !== "none" && step.demo.mode !== "run" && <>
          <label htmlFor="stDemoT" className="help" style={{ marginTop: 4 }}>打ち込むもの（1文字ずつ入る）</label>
          <textarea className="in mono" id="stDemoT" rows={3} value={step.demo.text} onChange={e => setDemo({ text: e.target.value })} />
        </>}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {step.aiDraft && <button className="btn btn-sm btn-sec" type="button" onClick={() => setStep({ aiDraft: false })}>見直した（AI下書きを外す）</button>}
        <button className="btn btn-sm btn-sec" type="button" onClick={() => onMove(-1)} disabled={n === 1}>上へ</button>
        <button className="btn btn-sm btn-sec" type="button" onClick={() => onMove(1)} disabled={n === unit.steps.length}>下へ</button>
        <button className="btn btn-sm btn-sec" type="button" onClick={onDelete}>このステップを消す</button>
      </div>
    </>
  );
}
