import React, { useEffect, useRef, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { Btn, Chip } from "./ui.jsx";

/* 通知（モック bellPop・notif）。中身は今の通知（データから都度作る）。既読はプロフィールに持つ（どの端末でも同じ） */

export function useNotifRead(items) {
  const [ids, setIds] = useState(() => new Set());
  const loaded = useRef(false);
  useEffect(() => {
    let alive = true;
    // 読めなかったときは書かない（ほかの端末の既読を消さないため）
    apiGet("/notifications/read-state").then(r => { if (alive) { loaded.current = true; setIds(new Set(Array.isArray(r?.readIds) ? r.readIds : [])); } }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const push = next => { setIds(next); if (loaded.current) apiPut("/notifications/read-state", { readIds: [...next] }).catch(() => {}); };
  const isUnread = n => !ids.has(n.id);
  const read = n => { if (ids.has(n.id)) return; const s = new Set(ids); s.add(n.id); push(s); };
  const readAll = () => { const s = new Set(ids); items.forEach(n => s.add(n.id)); push(s); };
  return { isUnread, read, readAll, unread: items.filter(isUnread).length };
}

function Row({ n, un, onOpen }) {
  return (
    <button type="button" className={`nrow${un ? " un" : ""}`} onClick={() => onOpen(n)}>
      <span className="nic" aria-hidden="true">{String(n.category || "通").slice(0, 1)}</span>
      <span><b>{n.title}</b>{n.desc && <small>{n.desc}</small>}</span>
      {un ? <i aria-label="未読" /> : <span />}
    </button>
  );
}

export function BellPop({ items, loading, error, st, onOpen, onAll, onRetry }) {
  return (
    <div className="pop npop" role="dialog" aria-label="通知">
      <header><b>通知</b>{st.unread > 0 && <Chip tone="mk">未読 {st.unread}</Chip>}<button type="button" className="lnk" onClick={st.readAll}>すべて既読</button></header>
      <div className="nlist">
        {error ? <div className="npad"><Chip>確認できません</Chip><Btn kind="ghost sm" onClick={onRetry}>再読み込み</Btn></div>
          : loading && !items.length ? <div className="npad"><Chip>読み込み中</Chip></div>
            : items.length ? items.slice(0, 5).map(n => <Row key={n.id} n={n} un={st.isUnread(n)} onOpen={onOpen} />)
              : <div className="npad"><Chip>なし</Chip></div>}
      </div>
      <footer><button type="button" className="lnk" onClick={onAll}>通知をすべて見る →</button></footer>
    </div>
  );
}

export function NotifScreen({ items, loading, error, st, onOpen, onRetry }) {
  const [f, setF] = useState("all");
  const rows = items.filter(n => f === "all" || st.isUnread(n));
  return (
    <div className="st">
      <div className="head"><h1 className="h1">通知</h1><span className="r"><span className="seg"><button type="button" aria-pressed={f === "all"} onClick={() => setF("all")}>すべて</button><button type="button" aria-pressed={f === "un"} onClick={() => setF("un")}>未読 {st.unread}</button></span><Btn kind="ghost sm" onClick={st.readAll}>すべて既読</Btn></span></div>
      <div className="card nlist big">
        {error ? <div className="empty"><b>通知を確認できません</b><Btn kind="ghost sm" onClick={onRetry}>再読み込み</Btn></div>
          : loading && !items.length ? <div className="soon">読み込み中</div>
            : rows.length ? rows.map(n => <Row key={n.id} n={n} un={st.isUnread(n)} onOpen={onOpen} />)
              : <div className="empty"><Chip>{f === "un" ? "未読なし" : "なし"}</Chip></div>}
      </div>
    </div>
  );
}

// 顔：頭文字
export function Face({ name, size }) {
  const style = size ? { width: size, height: size, fontSize: Math.round(size * 0.38) } : undefined;
  return <span className="face" style={style}>{String(name || "?").slice(0, 1)}</span>;
}
