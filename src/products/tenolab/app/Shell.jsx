import React, { useEffect, useRef, useState } from "react";
import { ICON_SPRITE } from "./ui.jsx";

/* ログイン後の外枠（モックの header.bar）。ナビ：ホーム／コース一覧／演習一覧／案件体験。右上に名前とメニュー。 */
const NAV = [["home", "ホーム", "#/home"], ["courses", "コース一覧", "#/courses"], ["drills", "演習一覧", "#/drills"], ["cases", "案件体験", "#/cases"]];
const ROLE_LABEL = { admin: "管理者", instructor: "講師", client: "研修担当", trainee: "受講生" };

export default function Shell({ section, name, email, role, staff, onLogout, children }) {
  const [open, setOpen] = useState(false);
  const um = useRef(null), btn = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = e => { if (um.current && !um.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="tl-course">
      <span dangerouslySetInnerHTML={{ __html: ICON_SPRITE }} />
      <header className="bar">
        <div className="wrap">
          <a className="logo" href="#/home" style={{ textDecoration: "none", color: "inherit" }}>テノ<b>ラボ</b><small>TENO LAB</small></a>
          <nav className="nav" aria-label="画面">
            {NAV.map(([k, label, href]) => <a key={k} href={href} aria-current={section === k ? "page" : undefined} className="navlink">{label}</a>)}
          </nav>
          <div className="me">
            <div className="um" ref={um}>
              <button type="button" className="um-btn" aria-haspopup="menu" aria-expanded={open} ref={btn} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
                <span className="um-name"><b>{name}</b><small>{ROLE_LABEL[role] || "受講生"}</small></span>
                <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
              <div className="um-menu" role="menu" hidden={!open}>
                <div className="um-head"><b>{name}</b>{email && <small>{email}</small>}</div>
                {staff && <a role="menuitem" href="#/manage" className="um-item" onClick={() => setOpen(false)}>講師・管理者のメニュー</a>}
                <button type="button" role="menuitem" className="um-out" onClick={() => { setOpen(false); onLogout(); }}>ログアウト</button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="wrap" id="app">{children}</main>
      <footer className="tl-foot"><div className="wrap"><span className="logo" style={{ fontSize: 15 }}>テノ<b>ラボ</b></span><span>© {new Date().getFullYear()} Feeps</span></div></footer>
    </div>
  );
}
