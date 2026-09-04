import { useCallback, useEffect, useRef, useState } from "react";
import { MSG, newChannelId, openChannel, openExerciseWindow, send } from "./exerciseChannel.js";

// 2026-09-04: 主（講義ウィンドウ）側。演習を別ウィンドウへ切り離す。
//
// 状態はここが持ち続ける。従は「見せて、書いて、実行を頼む」だけ。
// だから従を閉じても、書きかけのコードはこちらに残っている。
//
// state: { title, task, kind, files, activeFile, language, checks, result, running }
// 呼び出し側は state を作り、onEdit / onRun を受け取る。

export default function useExerciseWindow({ state, onEdit, onRun, enabled = true }) {
  const [detached, setDetached] = useState(false);
  const [error, setError] = useState("");
  const chRef = useRef(null);
  const winRef = useRef(null);
  const idRef = useRef(null);
  // 最新の state を送るために、描画のたびに差し替える
  const stateRef = useRef(state);
  stateRef.current = state;
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  const teardown = useCallback((tellChild) => {
    if (tellChild) send(chRef.current, MSG.CLOSE);
    try { chRef.current?.close(); } catch (e) { /* 既に閉じている */ }
    chRef.current = null;
    try { if (winRef.current && !winRef.current.closed) winRef.current.close(); } catch (e) { /* 別タブへ移動済み */ }
    winRef.current = null;
    idRef.current = null;
    setDetached(false);
  }, []);

  const detach = useCallback(() => {
    if (!enabled || detached) return;
    setError("");
    const id = newChannelId();
    const ch = openChannel(id);
    if (!ch) { setError("この環境では別ウィンドウを使えません。このまま下で書いてください。"); return; }

    ch.onmessage = (e) => {
      const { type, payload } = e.data || {};
      if (type === MSG.HELLO) { send(ch, MSG.STATE, stateRef.current); return; }
      if (type === MSG.EDIT) { onEditRef.current?.(payload); return; }
      if (type === MSG.RUN) { onRunRef.current?.(); return; }
      if (type === MSG.BYE) { teardown(false); return; }
    };

    const w = openExerciseWindow(id);
    if (!w) {
      try { ch.close(); } catch (err) { /* まだ何も送っていない */ }
      // **押しても何も起きない、を作らない。** 止められたことをその場で伝える。
      setError("別ウィンドウが開けませんでした（ブラウザで止められています）。このまま下で書けます。");
      return;
    }
    chRef.current = ch;
    winRef.current = w;
    idRef.current = id;
    setDetached(true);
  }, [detached, enabled, teardown]);

  const reattach = useCallback(() => teardown(true), [teardown]);

  // 状態が変わるたびに従へ送る。**正しい状態はこちらにしかない。**
  useEffect(() => {
    if (detached) send(chRef.current, MSG.STATE, state);
  }, [detached, state]);

  // 従が閉じられたことは message では分からないので、閉じたかどうかを見る
  useEffect(() => {
    if (!detached) return undefined;
    const t = setInterval(() => {
      if (winRef.current && winRef.current.closed) teardown(false);
    }, 700);
    return () => clearInterval(t);
  }, [detached, teardown]);

  // 主を閉じたら従も閉じる。孤立した窓を残さない。
  useEffect(() => {
    if (!detached) return undefined;
    const bye = () => teardown(true);
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, [detached, teardown]);

  // 別のページへ移ったら畳む（2つの窓で違う課題を見ている状態を作らない）
  useEffect(() => () => teardown(true), [teardown]);

  return { detached, detach, reattach, error, clearError: () => setError("") };
}
