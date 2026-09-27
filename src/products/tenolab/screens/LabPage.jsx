import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiPost } from "../../../api.js";
import MountedHtml from "../MountedHtml.jsx";
import { LAB_HTML } from "../lab/labMarkup.js";
import { mountLab } from "../lab/mountLab.js";
import { useTenolabCourse, useTenolabUnit, unitMeta } from "../useTenolab.js";
import { SAMPLE_COURSE } from "../samples/dashSample.js";

// 体験ラボ（単元）。中身は単元データ（API、なければ同梱の見本）で、エンジンは mountLab。
// 保存：ステップが進んだらすぐ、コードを打ったら4秒あけて（まとめて1回）。
// おためし（ログインなし）と、講師の「受講生として試す」（preview）は保存しない。
const SAVE_DELAY = 4000;

export default function LabPage({ courseId, unitId, trial, preview, saved, onSave, onGo, onTrialProgress }) {
  const noSave = trial || preview;
  const unitQ = useTenolabUnit(courseId, unitId, { trial, draft: preview });
  const courseQ = useTenolabCourse(courseId, !trial, { draft: !!preview });
  const course = trial ? SAMPLE_COURSE : courseQ.course;

  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const latest = useRef(null);
  const timer = useRef(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const flush = useCallback(async (snap) => {
    const s = snap || latest.current;
    if (!s || noSave) return;
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
  }, [courseId, unitId, noSave]);

  const unit = unitQ.unit;
  const meta = useMemo(() => unitMeta(course, unitId), [course, unitId]);
  const opts = useMemo(() => ({
    unit,
    meta,
    preview: !!preview,
    backGo: preview ? "studio-back" : null,
    backLabel: preview ? "← 単元づくり" : null,
    initial: noSave ? null : saved,
    // Java は本物の javac / java で動かす（学習モードの演習と同じ実行環境。ログインが要る）
    runJava: trial ? null : (payload) => apiPost("/learning/exercises/java/run", payload),
    // おためし中は保存しないが、クリアしたところまでは覚えておく（ログインしたら保存する）
    onProgress: (snap) => { if (trial) { onTrialProgress && onTrialProgress(snap); return; } flush(snap); },
    onChange: (snap) => {
      if (noSave) return;
      latest.current = snap;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(), SAVE_DELAY);
    },
  }), [unit, meta, preview, trial, noSave, saved, flush, onTrialProgress]);

  // 画面を離れるとき、打ちかけの分を送っておく
  useEffect(() => () => { if (latest.current) flush(); }, [flush]);

  const retry = () => { if (latest.current) flush(); };

  // 見出し（単元の番号）が後から変わって画面を作り直さないよう、コースも読み終えてから出す
  if (unitQ.state === "loading" || (!trial && courseQ.state === "loading")) {
    return <div className="tl-app"><div className="wrap"><p className="wk-note" role="status" style={{ padding: "40px 0" }}>単元を読み込んでいます…</p></div></div>;
  }
  if (unitQ.state === "error") {
    return (
      <div className="tl-app"><div className="wrap hb">
        <div className="info" role="alert">単元を読み込めませんでした。通信状況を確かめて、もう一度読み込んでください。</div>
        <div><button className="btn btn-sec" type="button" onClick={unitQ.reload}>もう一度読み込む</button></div>
      </div></div>
    );
  }
  if (unitQ.state === "missing" || !unit) {
    return (
      <div className="tl-app"><div className="wrap hb"><div className="greet"><div><h1>この単元は準備中です</h1></div></div>
        <div><a className="btn btn-sec" href={`#/courses/${courseId}`}>コースマップへもどる</a></div></div></div>
    );
  }
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
        {preview && (
          <div className="trial">
            <ul className="kw sm"><li className="m">受講生として試す</li><li>下書き</li><li>記録なし</li></ul>
            <span className="sp" />
            <a className="btn btn-sm btn-sec" href="#/studio" onClick={e => { e.preventDefault(); onGo("studio-back"); }}>単元づくりへ戻る</a>
          </div>
        )}
        {!noSave && saveState === "error" && (
          <div className="trial" role="alert" style={{ background: "#FDECEA" }}>
            <span><b>保存できませんでした。</b>通信状況を確かめてください。書いたコードはこの画面に残っています。</span>
            <span className="sp" />
            <button className="btn btn-sm btn-sec" type="button" onClick={retry}>もう一度保存する</button>
          </div>
        )}
      </div>
      <MountedHtml className="tl-lab" html={LAB_HTML} mount={mountLab} opts={opts} onGo={onGo}
        mountKey={`${courseId}/${unitId}/${trial ? "trial" : preview ? "preview" : "saved"}`} />
      <div className="tl-app" aria-live="polite" style={{ position: "fixed", right: 16, bottom: 12, zIndex: 50, pointerEvents: "none" }}>
        {!noSave && saveState === "saving" && <span className="chip" style={{ background: "#fff" }}>保存しています…</span>}
        {!noSave && saveState === "saved" && <span className="chip" style={{ background: "#fff" }}>保存しました</span>}
      </div>
    </>
  );
}
