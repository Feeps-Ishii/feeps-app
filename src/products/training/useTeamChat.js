import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost } from "../../api.js";
import { markTeamChatRead, setOpenChatTeam } from "./ChatNotifier.jsx";
import { FALLBACK_POLL_MS, isLive, onLiveChange, onSignal, watchChannels } from "../../realtime.js";

/* チームのチャットの読み書き（TeamsView の ChatTab と新しい LMS の両方で使う）。見た目は持たない。
   2026-10-14：コードブロック・添付・さかのぼり／2026-10-25：合図を受けて読む（ADR 0032） */
export const MAX_CHAT_TEXT = 8000;
export const MAX_CHAT_FILES = 5;
const isEnded = t => t?.status === "ended";
const errText = (e, fallback) => e?.errorMessage || e?.message || fallback;
const teamSpace = team => `course#${team.courseId}`;

export function useTeamChat({ team }) {
  const ended = isEnded(team);
  const [msgs, setMsgs] = useState(null);
  const [canPost, setCanPost] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [older, setOlder] = useState(false);
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);       // 送る前の添付
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState(null);      // コードを貼る欄（null＝閉じている）。送るときに ``` で囲んで本文の後ろに付ける
  const codeRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const cursorRef = useRef("");
  const stickRef = useRef(true);
  const keepRef = useRef(null);                 // さかのぼったとき、見ていた位置を保つ
  const base = `/teams/${encodeURIComponent(team.teamId)}/messages`;
  const cq = `courseId=${encodeURIComponent(team.courseId)}`;
  const markedRef = useRef("");
  // 開いている間はこのチームを新着通知に数えない。読んだところまで既読にする
  useEffect(() => { setOpenChatTeam(team.teamId); return () => setOpenChatTeam(""); }, [team.teamId]);
  useEffect(() => {
    const last = msgs?.length ? msgs[msgs.length - 1].id : "";
    if (ended || msgs == null || document.visibilityState !== "visible" || (last && last === markedRef.current)) return;
    markedRef.current = last || "-";
    markTeamChatRead(team, last);
  }, [msgs, team, ended]);
  const addMsgs = useCallback(list => {
    if (!list.length) return;
    cursorRef.current = list[list.length - 1].id > cursorRef.current ? list[list.length - 1].id : cursorRef.current;
    setMsgs(cur => { const seen = new Set((cur || []).map(m => m.id)); return [...(cur || []), ...list.filter(m => !seen.has(m.id))]; });
  }, []);
  const load = useCallback(async () => {
    try {
      const d = await apiGet(`${base}?${cq}`);
      const list = Array.isArray(d?.messages) ? d.messages : [];
      cursorRef.current = list.length ? list[list.length - 1].id : "";
      setMsgs(list); setCanPost(!!d?.canPost); setHasMore(!!d?.hasMore); setErr("");
    } catch (e) { setErr(errText(e, "チャットを読み込めませんでした。")); }
  }, [base, cq]);
  useEffect(() => { load(); }, [load, ended]);
  // 新着は、チームのチャンネルの合図を受けて読む（2026-10-25、ADR 0032。それまでは4秒ごと）。
  // 合図が届かないあいだだけ60秒ごと。見えているときだけ読み、タブに戻ったら読む。終了したチームは読まない
  const fetchNew = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const d = await apiGet(`${base}?${cq}${cursorRef.current ? `&after=${encodeURIComponent(cursorRef.current)}` : ""}`);
      addMsgs(Array.isArray(d?.messages) ? d.messages : []);
    } catch { /* 次の合図・次の回で読み直す */ }
  }, [base, cq, addMsgs]);
  useEffect(() => {
    if (msgs == null || ended) return undefined;
    const unwatch = watchChannels([team.rt]);
    let timer = 0;
    const setFallback = live => { window.clearInterval(timer); timer = live ? 0 : window.setInterval(fetchNew, FALLBACK_POLL_MS); };
    setFallback(isLive());
    const offLive = onLiveChange(setFallback);
    const offSignal = onSignal(ev => {
      if (ev?.t !== "chat" || ev.team !== team.teamId) return;
      // 消された発言は、その場で消して見せる（それまでは開き直すまで残っていた）
      if (ev.del) setMsgs(cur => (cur || []).map(m => (m.id === ev.del ? { ...m, deleted: true, text: "", attachments: [] } : m)));
      else fetchNew();
    });
    const onVisible = () => { if (document.visibilityState === "visible") fetchNew(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); offLive(); offSignal(); unwatch(); document.removeEventListener("visibilitychange", onVisible); };
  }, [msgs == null, ended, team.rt, team.teamId, fetchNew]); // eslint-disable-line react-hooks/exhaustive-deps
  // さかのぼったときは位置を保つ。下を見ているときだけ、新着で下へ送る
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (keepRef.current != null) { el.scrollTop = el.scrollHeight - keepRef.current; keepRef.current = null; return; }
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);
  async function loadOlder() {
    if (older || !msgs?.length) return;
    setOlder(true);
    try {
      const d = await apiGet(`${base}?${cq}&before=${encodeURIComponent(msgs[0].id)}`);
      const list = Array.isArray(d?.messages) ? d.messages : [];
      const el = listRef.current;
      keepRef.current = el ? el.scrollHeight - el.scrollTop : null;
      setMsgs(cur => { const seen = new Set((cur || []).map(m => m.id)); return [...list.filter(m => !seen.has(m.id)), ...(cur || [])]; });
      setHasMore(!!d?.hasMore);
    } catch (e) { setErr(errText(e, "読み込めませんでした。")); }
    finally { setOlder(false); }
  }
  const composed = () => {
    const t = text.trim();
    const c = (code || "").replace(/\s+$/, "").replace(/^\n+/, "");
    return [t, c.trim() ? "```\n" + c + "\n```" : ""].filter(Boolean).join("\n");
  };
  async function send() {
    const v = composed();
    if ((!v && !files.length) || sending) return;
    if (v.length > MAX_CHAT_TEXT) { setErr(`長すぎます（${MAX_CHAT_TEXT}文字まで）。`); return; }
    setSending(true); setErr("");
    try {
      const m = await apiPost(base, { courseId: team.courseId, text: v, attachments: files.map(f => ({ nodeId: f.nodeId })) });
      setText(""); setCode(null); setFiles([]); stickRef.current = true; addMsgs([m]);
    } catch (e) { setErr(errText(e, "送れませんでした。")); }
    finally { setSending(false); }
  }
  async function remove(m) {
    if (!window.confirm("この発言を消しますか？")) return;
    try { await apiDelete(`${base}?${cq}&id=${encodeURIComponent(m.id)}`); setMsgs(cur => (cur || []).map(x => (x.id === m.id ? { ...x, deleted: true, text: "", attachments: [] } : x))); }
    catch (e) { setErr(errText(e, "消せませんでした。")); }
  }
  async function openFile(f) {
    setErr("");
    try {
      const r = await apiGet(`/library/download?spaceId=${encodeURIComponent(teamSpace(team))}&nodeId=${encodeURIComponent(f.nodeId)}&mode=download`);
      window.open(r.url, "_blank", "noopener");
    } catch (e) { setErr(errText(e, "ファイルを開けませんでした。")); }
  }
  // 「コード」：入力欄の上にコードを貼る欄を開く（2026-10-15 ユーザー指定）。送るときに ``` で囲んで付ける
  function insertCode() {
    if (code == null) setCode("");
    requestAnimationFrame(() => codeRef.current?.focus());
  }
  // コードの欄の Tab は字下げ（2文字）にする
  function codeKey(e) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget, st = el.selectionStart, en = el.selectionEnd;
    const next = (code || "").slice(0, st) + "  " + (code || "").slice(en);
    setCode(next);
    requestAnimationFrame(() => el.setSelectionRange(st + 2, st + 2));
  }
  const inFence = (v, pos) => (v.slice(0, pos).match(/```/g) || []).length % 2 === 1;
  return { ended, msgs, canPost, hasMore, older, err, setErr, text, setText, files, setFiles, picking, setPicking, sending, code, setCode, codeRef, listRef, inputRef, stickRef, load, loadOlder, send, remove, openFile, insertCode, codeKey, inFence };
}
