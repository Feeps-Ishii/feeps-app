import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MountedHtml from "../MountedHtml.jsx";
import { LAB_HTML } from "../lab/labMarkup.js";
import { mountLab } from "../lab/mountLab.js";

// 体験ラボ（単元）。エンジンはモックから持ち込んだ mountLab。
// 保存：ステップが進んだらすぐ、コードを打ったら4秒あけて（まとめて1回）。
// おためし（ログインなし）のときは保存しない。
const SAVE_DELAY = 4000;

export default function LabPage({ courseId, unitId, trial, saved, onSave, onGo, onTrialProgress }) {
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const latest = useRef(null);
  const timer = useRef(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = useCallback(async (snap) => {
    const s = snap || latest.current;
    if (!s || trial) return;
    clearTimeout(timer.current); timer.current = null;
    latest.current = null;
    setSaveState("saving");
    try {
      await onSaveRef.current(courseId, unitId, s);
      setSaveState("saved");
    } catch (e) {
      console.warn("tenolab save failed", e);
      setSaveState("error");
      latest.current = latest.current || s; // 次の保存で送り直す
    }
  }, [courseId, unitId, trial]);

  const opts = useMemo(() => ({
    initial: trial ? null : saved,
    // おためし中は保存しないが、クリアしたところまでは覚えておく（ログインしたら保存する）
    onProgress: (snap) => { if (trial) { onTrialProgress && onTrialProgress(snap); return; } flush(snap); },
    onChange: (snap) => {
      if (trial) return;
      latest.current = snap;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(), SAVE_DELAY);
    },
  }), [trial, saved, flush, onTrialProgress]);

  // 画面を離れるとき、打ちかけの分を送っておく
  useEffect(() => () => { if (latest.current) flush(); }, [flush]);

  const retry = () => { if (latest.current) flush(); };

  return (
    <>
      <div className="tl-app">
        {trial && (
          <div className="trial">
            <span><b>おためし中</b>　この単元は登録なしで最後まで試せます。記録は残りません。</span>
            <span className="sp" />
            <a className="btn btn-sm btn-sec" href="#/login" onClick={e => { e.preventDefault(); onGo("login"); }}>ログインして記録を残す</a>
          </div>
        )}
        {!trial && saveState === "error" && (
          <div className="trial" role="alert" style={{ background: "#FDECEA" }}>
            <span><b>保存できませんでした。</b>通信状況を確かめてください。書いたコードはこの画面に残っています。</span>
            <span className="sp" />
            <button className="btn btn-sm btn-sec" type="button" onClick={retry}>もう一度保存する</button>
          </div>
        )}
      </div>
      <MountedHtml className="tl-lab" html={LAB_HTML} mount={mountLab} opts={opts} onGo={onGo}
        mountKey={`${courseId}/${unitId}/${trial ? "trial" : "saved"}`} />
      <div className="tl-app" aria-live="polite" style={{ position: "fixed", right: 16, bottom: 12, zIndex: 50, pointerEvents: "none" }}>
        {!trial && saveState === "saving" && <span className="chip" style={{ background: "#fff" }}>保存しています…</span>}
        {!trial && saveState === "saved" && <span className="chip" style={{ background: "#fff" }}>保存しました</span>}
      </div>
    </>
  );
}
