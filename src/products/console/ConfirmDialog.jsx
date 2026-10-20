import React, { useEffect, useState } from "react";

/* 変える前に確かめる小さな窓（2026-10-20）。公開・付ける・写す・公開先を変える、はすべてここを通す。
   rows：[["変えるもの", "前 → 後"]...]。children に選ぶ欄を入れられる。onRun が投げたら文を出してそのまま */
export default function ConfirmDialog({ title, rows = [], warn = "", children, runLabel = "この内容で実行", canRun = true, onRun, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  async function run() {
    setBusy(true); setErr("");
    try { const msg = await onRun(); setDone(typeof msg === "string" && msg ? msg : "実行しました。"); }
    catch (e) { setErr(e?.errorMessage || e?.message || "実行できませんでした。"); }
    setBusy(false);
  }
  return (
    <div className="dhc-shade dhc-center" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section className="dhc-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header><b>{title}</b><button type="button" onClick={onClose} aria-label="閉じる" disabled={busy}>×</button></header>
        <div className="in">
          {children}
          {rows.length > 0 && (
            <div className="dhc-rows">
              {rows.map(([k, v], i) => <div key={i}><span>{k}</span><b>{v}</b></div>)}
            </div>
          )}
          {warn && <div className="dhc-warn">{warn}</div>}
          {err && <div className="dhc-err">{err}</div>}
          {done && <div className="dhc-okmsg">{done}</div>}
        </div>
        <footer>
          {done
            ? <button type="button" className="dhc-btn" onClick={onClose}>閉じる</button>
            : (<>
              <button type="button" className="dhc-btn ok" disabled={busy || !canRun} onClick={run}>{busy ? "実行しています…" : runLabel}</button>
              <button type="button" className="dhc-btn ghost" onClick={onClose} disabled={busy}>やめる</button>
              <span className="dhc-note">押すまで何も変わりません</span>
            </>)}
        </footer>
      </section>
    </div>
  );
}
