import React, { useState } from "react";
import { Btn, Chip } from "./ui.jsx";

/* 通知（モック bellPop・notif）。中身は今の通知（データから都度作る）。既読はこの端末の印と「すべて既読」の基準時刻 */

const KEY = "feeps.lms.read";
export const readIds = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); } };
const saveIds = s => { try { localStorage.setItem(KEY, JSON.stringify([...s].slice(-300))); } catch { /* 印だけ */ } };

export function useNotifRead(items, dismissedAll, markAll) {
  const [ids, setIds] = useState(readIds);
  const isUnread = n => !dismissedAll && !ids.has(n.id);
  const read = n => { const s = new Set(ids); s.add(n.id); saveIds(s); setIds(s); };
  const readAll = () => { const s = new Set(ids); items.forEach(n => s.add(n.id)); saveIds(s); setIds(s); markAll?.(); };
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

// 顔：写真があれば写真、なければ頭文字
export function Face({ name, photo, size }) {
  const style = size ? { width: size, height: size, fontSize: Math.round(size * 0.38) } : undefined;
  return photo
    ? <span className="face ph" style={style}><img src={photo} alt="" /></span>
    : <span className="face" style={style}>{String(name || "?").slice(0, 1)}</span>;
}
