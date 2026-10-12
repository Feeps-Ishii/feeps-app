import React, { useEffect, useState } from "react";
import "./notices.css";

/* お知らせ（2026-10-13、モック docs/design/mockups/devhub-learning-2026-10/devhub-notice.html）
   ホームの上の帯（メンテナンス・重要で「帯で出す」もの）・ホームのお知らせ（4件）・ヘッダーのベルから開く一覧と中身。
   データは GET /tenolab/notices（data.js の useNotices）。開いたら POST …/read で既読にする */
export const NOTICE_KIND = { course: "新コース", maint: "メンテナンス", info: "お知らせ", important: "重要", report: "レポート" };

const WEEK = "日月火水木金土";
export function mdLabel(d) {
  const t = new Date(String(d).length === 10 ? `${d}T00:00:00` : d);
  return Number.isNaN(t.getTime()) ? String(d || "") : `${t.getMonth() + 1}/${String(t.getDate()).padStart(2, "0")}`;
}
export function maintLabel(m) {
  if (!m?.start) return "";
  const s = new Date(m.start), e = new Date(m.end || m.start);
  if (Number.isNaN(s.getTime())) return "";
  const hm = t => `${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`;
  const day = t => `${t.getMonth() + 1}/${t.getDate()}（${WEEK[t.getDay()]}）`;
  const same = s.toDateString() === e.toDateString();
  return `${day(s)} ${hm(s)}〜${same ? "" : `${day(e)} `}${hm(e)}`;
}

const ICONS = {
  maint: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" /></svg>,
  important: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 8v5M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>,
};

export function NoticeTag({ kind }) {
  return <span className={`ntc-tag ${kind}`}>{NOTICE_KIND[kind] || "お知らせ"}</span>;
}

function Row({ n, onOpen }) {
  return (
    <button type="button" className="ntc-row" onClick={() => onOpen(n.id)}>
      <span className={`dot ${n.read ? "read" : ""}`} aria-label={n.read ? undefined : "未読"} />
      <span className="t">{n.title}</span>
      <span className="m"><NoticeTag kind={n.kind} />{mdLabel(n.date)}</span>
    </button>
  );
}

// 帯を閉じたことは、この端末に覚えておく（お知らせごと）
const HIDE_KEY = "dh-notice-hidden";
const readHidden = () => { try { return JSON.parse(localStorage.getItem(HIDE_KEY) || "[]"); } catch (e) { return []; } };

export function NoticeBanner({ notices }) {
  const [hidden, setHidden] = useState(readHidden);
  const n = (notices?.items || []).find(x => x.banner && !hidden.includes(x.id));
  if (!n) return null;
  const hide = () => {
    const next = [...hidden, n.id].slice(-30);
    setHidden(next);
    try { localStorage.setItem(HIDE_KEY, JSON.stringify(next)); } catch (e) { /* 覚えられなくても閉じる */ }
  };
  return (
    <section className={`ntc-banner ${n.kind === "important" ? "important" : ""}`} role="status">
      <span className="ic">{ICONS[n.kind] || ICONS.maint}</span>
      <span className="txt"><span className="hd"><NoticeTag kind={n.kind} /><b>{n.title}</b></span>{n.maint && <span className="when">{maintLabel(n.maint)}</span>}</span>
      <button type="button" className="btn ghost" onClick={() => notices.open(n.id)}>くわしく</button>
      <button type="button" className="x" onClick={hide} aria-label="閉じる">×</button>
    </section>
  );
}

export function NoticeCard({ notices, className = "" }) {
  const items = notices?.items || [];
  if (!items.length) return null;
  const unread = items.filter(x => !x.read).length;
  return (
    <section className={`card ntc-card ${className}`} aria-label="お知らせ">
      <div className="hd"><h2 className="h2">お知らせ</h2>{unread > 0 && <span className="chip warn">未読 {unread}</span>}<button type="button" className="all" onClick={() => notices.open(null)}>すべて見る →</button></div>
      {items.slice(0, 4).map(n => <Row key={n.id} n={n} onOpen={notices.open} />)}
    </section>
  );
}

// ヘッダーのベル
export function NoticeBell({ notices, dark }) {
  if (!notices) return null;
  const unread = (notices.items || []).filter(x => !x.read).length;
  return (
    <button type="button" className={`ntc-bell ${dark ? "dark" : ""} ${unread ? "has" : ""}`} onClick={() => notices.open(null)} aria-label={`お知らせ${unread ? `（未読 ${unread}件）` : ""}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
      {unread > 0 && <><span className="lbl">お知らせ</span><span className="n">{unread > 9 ? "9+" : unread}</span></>}
    </button>
  );
}

// 右から出る一覧と中身
export function NoticeDrawer({ notices, courseTitle, onCourse }) {
  const [filter, setFilter] = useState("all");
  const st = notices?.drawer;
  useEffect(() => {
    if (!st) return undefined;
    const onKey = e => { if (e.key === "Escape") notices.close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!st) return null;
  const items = notices.items || [];
  const n = st.id ? items.find(x => x.id === st.id) : null;
  const unread = items.filter(x => !x.read).length;
  const kinds = [...new Set(items.map(x => x.kind))];
  const list = items.filter(x => filter === "all" || (filter === "unread" ? !x.read : x.kind === filter));
  return (
    <>
      <div className="ntc-scrim" onClick={notices.close} />
      <aside className="ntc-drawer" aria-label="お知らせ" role="dialog" aria-modal="true">
        <div className="dh"><b>お知らせ</b>{unread > 0 && <span className="chip warn">未読 {unread}</span>}<button type="button" className="x" onClick={notices.close} aria-label="閉じる">×</button></div>
        {n ? (
          <div className="detail">
            <button type="button" className="back" onClick={() => notices.open(null)}>← 一覧</button>
            <div className="meta"><NoticeTag kind={n.kind} /><span>{mdLabel(n.date)}</span></div>
            <h3>{n.title}</h3>
            {n.maint?.start && <dl className="when"><dt>日時</dt><dd>{maintLabel(n.maint)}</dd></dl>}
            {n.courseId && courseTitle(n.courseId) && (
              <div className="course"><b>{courseTitle(n.courseId)}</b><button type="button" className="btn" onClick={() => { notices.close(); onCourse(n.courseId); }}>コースを見る</button></div>
            )}
            {n.body && <div className="body">{n.body}</div>}
          </div>
        ) : (
          <>
            <div className="filters" role="group" aria-label="絞り込み">
              {[["all", "すべて"], ["unread", "未読"], ...kinds.map(k => [k, NOTICE_KIND[k]])].map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
            </div>
            <div className="dlist">{list.map(x => <Row key={x.id} n={x} onOpen={notices.open} />)}</div>
          </>
        )}
      </aside>
    </>
  );
}
