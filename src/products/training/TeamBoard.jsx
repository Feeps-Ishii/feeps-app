import React, { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { apiGet, apiPut } from "../../api.js";
import { T, SkeletonRows, PrismErrorRetryCard } from "../../components/common";

/* チームの共有ボード（2026-10-01 ③）。Excalidraw（MIT）を使う。重いので開いた人だけが読み込む（TeamsView から lazy）。
   同時編集は「図形ごとの version が大きいほうを残す」で合わせる。書いたら少し待って送り、ほかの人の変更は数秒ごとに読む。
   画像は共有の仕組みが無いので使わない。 */
const POLL_MS = 3000;
const SEND_DELAY_MS = 800;
const sig = els => (els || []).map(e => `${e.id}:${e.version}`).join("|");
const byIndex = (a, b) => (String(a.index || "") < String(b.index || "") ? -1 : String(a.index || "") > String(b.index || "") ? 1 : 0);
function mergeElements(local, remote) {
  const map = new Map((local || []).map(e => [e.id, e]));
  (remote || []).forEach(r => {
    const l = map.get(r.id);
    if (!l || r.version > l.version || (r.version === l.version && r.versionNonce < l.versionNonce)) map.set(r.id, r);
  });
  return [...map.values()].sort(byIndex);
}
const ago = iso => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return !iso ? "" : s < 60 ? `${s}秒前` : s < 3600 ? `${Math.round(s / 60)}分前` : new Date(iso).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function TeamBoard({ team, nameOf }) {
  const base = `/teams/${encodeURIComponent(team.teamId)}/board?courseId=${encodeURIComponent(team.courseId)}`;
  const [initial, setInitial] = useState(null);
  const [err, setErr] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [info, setInfo] = useState({ updatedAt: "", updatedBy: "" });
  const [saveState, setSaveState] = useState("");
  const apiRef = useRef(null);
  const revRef = useRef(0);
  const lastSig = useRef("");
  const timerRef = useRef(null);
  const sendingRef = useRef(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    setErr("");
    try {
      const d = await apiGet(base);
      revRef.current = Number(d?.rev) || 0;
      lastSig.current = sig(d?.elements);
      setCanWrite(!!d?.canWrite);
      setInfo({ updatedAt: d?.updatedAt || "", updatedBy: d?.updatedBy || "" });
      setInitial({ elements: Array.isArray(d?.elements) ? d.elements : [], appState: { viewBackgroundColor: "#ffffff", currentItemFontFamily: 2 }, scrollToContent: true });
    } catch (e) { setErr(e?.errorMessage || e?.message || "ボードを読み込めませんでした。"); }
  }, [base]);
  useEffect(() => { load(); }, [load]);

  // ほかの人の変更を数秒ごとに読む（見えているときだけ）
  useEffect(() => {
    if (!initial) return undefined;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible" || sendingRef.current || !apiRef.current) return;
      try {
        const d = await apiGet(`${base}&rev=${revRef.current}`);
        tick(n => n + 1);
        if (d?.unchanged || !Array.isArray(d?.elements)) return;
        revRef.current = Number(d.rev) || revRef.current;
        setInfo({ updatedAt: d.updatedAt || "", updatedBy: d.updatedBy || "" });
        const merged = mergeElements(apiRef.current.getSceneElementsIncludingDeleted(), d.elements);
        lastSig.current = sig(merged);
        apiRef.current.updateScene({ elements: merged });
      } catch { /* 次の回で読み直す */ }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [initial, base]);

  const send = useCallback(async () => {
    const api = apiRef.current;
    if (!api || sendingRef.current) return;
    const els = api.getSceneElementsIncludingDeleted();
    if (sig(els) === lastSig.current) return;
    sendingRef.current = true; setSaveState("saving");
    try {
      const d = await apiPut(base, { courseId: team.courseId, elements: els });
      revRef.current = Number(d?.rev) || revRef.current;
      setInfo({ updatedAt: d?.updatedAt || "", updatedBy: d?.updatedBy || "" });
      const merged = mergeElements(api.getSceneElementsIncludingDeleted(), d?.elements);
      lastSig.current = sig(merged);
      if (sig(merged) !== sig(api.getSceneElementsIncludingDeleted())) api.updateScene({ elements: merged });
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setErr(e?.errorMessage || e?.message || "保存できませんでした。");
    } finally { sendingRef.current = false; }
  }, [base, team.courseId]);

  const onChange = useCallback(elements => {
    if (!canWrite) return;
    if (sig(elements) === lastSig.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(send, SEND_DELAY_MS);
  }, [canWrite, send]);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  if (err && !initial) return <PrismErrorRetryCard message={err} onRetry={load} />;
  if (!initial) return <div className="rounded-2xl bg-white p-4" style={{ border: `1px solid ${T.border}` }}><SkeletonRows rows={4} /></div>;
  return (
    <div className="overflow-hidden rounded-2xl bg-white" style={{ border: `1px solid ${T.border}` }}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs" style={{ borderBottom: `1px solid ${T.border}`, color: T.textMuted }}>
        <b className="text-sm" style={{ color: T.textPrimary }}>{team.name}のボード</b>
        {!canWrite && <span className="rounded-full px-2 py-0.5 font-bold" style={{ background: T.bgBase }}>見るだけ</span>}
        <span className="ml-auto">{saveState === "saving" ? "保存中…" : saveState === "error" ? <span style={{ color: T.danger }}>保存できませんでした</span> : info.updatedAt ? `${nameOf(info.updatedBy)}が更新 ・ ${ago(info.updatedAt)}` : "まだ何も描かれていません"}</span>
      </div>
      {/* Excalidraw の重ね用レイヤーが枠の外へはみ出して横スクロールが出るので、この中に閉じ込める */}
      <div style={{ height: "min(640px, 72vh)", position: "relative", contain: "layout paint" }}>
        <Excalidraw
          excalidrawAPI={api => { apiRef.current = api; }}
          initialData={initial}
          onChange={onChange}
          viewModeEnabled={!canWrite}
          langCode="ja-JP"
          UIOptions={{ tools: { image: false }, canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false } }}
        />
      </div>
    </div>
  );
}
