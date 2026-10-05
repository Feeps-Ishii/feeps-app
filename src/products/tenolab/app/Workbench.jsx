import React, { useRef, useState } from "react";
import { Ic } from "./ui.jsx";
import { FILE_NAME, runCode } from "./runtime.js";

/* コードを書いて動かす部品（モックの .try / .ed / .console）。演習と案件体験で使う。 */

export function Editor({ value, onChange, label, readOnly, minHeight, tabs }) {
  const onKey = e => {
    if (e.key === "Tab" && !readOnly) {
      e.preventDefault();
      const el = e.target, s = el.selectionStart;
      el.setRangeText("  ", s, el.selectionEnd, "end");
      onChange(el.value);
    }
  };
  return (
    <>
      <div className="tabs">{(tabs || [label]).map((t, i) => <span key={t} className={i === 0 ? "on" : ""}>{t}</span>)}</div>
      <textarea spellCheck="false" aria-label={label} value={value} readOnly={readOnly} style={minHeight ? { minHeight } : undefined}
        onChange={e => onChange(e.target.value)} onKeyDown={onKey} />
    </>
  );
}

// 演習の「書く → 実行 → 判定」。onResult(result) で結果を親に知らせる（記録の保存は親）
export function TryPanel({ item, code, setCode, onResult, onHint, onAnswer, answerState, hintShown }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [checks, setChecks] = useState({});
  const frame = useRef(null);
  const tests = item.tests || [];
  const runtime = item.runtime;

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await runCode(runtime, code, tests, { frame: frame.current, sqlSetup: item.sqlSetup });
      setRes(r);
      onResult && onResult(r);
    } finally { setBusy(false); }
  }

  // 自分で確かめて付けるチェック（Git など）
  if (runtime === "check") {
    const all = tests.length > 0 && tests.every((t, i) => checks[i]);
    return (
      <div className="try" style={{ gridTemplateColumns: "1fr" }}>
        <div className="console" style={{ background: "var(--card)", color: "var(--ink)" }}>
          <span className="eyebrow">できたらチェック</span>
          {tests.map((t, i) => (
            <label key={i} className="row" style={{ gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={!!checks[i]} onChange={e => setChecks({ ...checks, [i]: e.target.checked })} />{t.name}
            </label>
          ))}
          <button className="btn" type="button" disabled={!all} onClick={() => onResult && onResult({ out: [], error: "", results: tests.map(t => ({ name: t.name, ok: true })) })} style={{ justifySelf: "start" }}>完了にする</button>
          {hintShown && item.hint && <div className="hint">{item.hint}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="try">
      <div className="ed">
        <Editor value={code} onChange={setCode} label={FILE_NAME[runtime] || "main"} />
        <div className="run">
          <button className="btn" type="button" onClick={run} disabled={busy}><Ic id="play" />{busy ? "実行しています…" : "実行する"}</button>
          {item.hint && <button className="btn ghost" type="button" onClick={onHint}>ヒント</button>}
          {onAnswer && <button className="btn ghost" type="button" onClick={onAnswer} disabled={answerState === "loading"}>お手本</button>}
        </div>
      </div>
      <div className="console">
        <span className="eyebrow">実行結果</span>
        {runtime === "web" && <iframe ref={frame} title="表示" sandbox="allow-same-origin" style={{ width: "100%", minHeight: 180, border: "1px solid #262B38", borderRadius: 8, background: "#fff" }} />}
        {runtime !== "web" && <pre>{res ? (res.error ? `エラー: ${res.error}` : (res.out.join("\n") || "（表示なし）")) : "「実行する」を押すと、ここに結果が出ます"}</pre>}
        {runtime === "web" && res?.error && <pre>{`エラー: ${res.error}`}</pre>}
        {res ? res.results.map((r, i) => <div key={i} className={`verdict ${r.ok ? "ok" : "ng"}`}>{r.ok ? "OK" : "まだ"} ・ {r.name}</div>)
          : <div className="verdict wait">確かめること {tests.length}つ</div>}
        {res && res.results.length > 0 && res.results.every(r => r.ok) && <div className="verdict ok">完了しました</div>}
        {hintShown && item.hint && <div className="hint">{item.hint}</div>}
        {answerState === "locked" && <div className="hint">お手本は、何回か実行してみたあとに見られます。</div>}
        {answerState === "error" && <div className="hint">お手本を読み込めませんでした。もう一度押してください。</div>}
      </div>
    </div>
  );
}
