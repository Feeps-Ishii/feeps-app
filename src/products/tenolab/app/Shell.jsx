import React, { useEffect, useRef, useState } from "react";
import { ICON_SPRITE } from "./ui.jsx";

/* ログイン後の外枠（モックの header.bar）。右上に名前とメニュー。
   受講生の画面：ホーム／コース一覧／演習一覧／案件体験。
   管理の画面（variant "admin"、モック tenolab-admin.html）：帯を黒にして受講生の画面と見分ける。
   管理者は右上のリンクで、管理の画面と受講生の画面を行き来できる */
export const LEARNER_NAV = [["home", "ホーム", "#/home"], ["courses", "コース一覧", "#/courses"], ["drills", "演習一覧", "#/drills"], ["cases", "案件体験", "#/cases"]];
const ROLE_LABEL = { admin: "管理者", instructor: "講師", client: "企業担当者", trainee: "受講生" };

export default function Shell({ section, name, email, role, admin, onLogout, children, variant = "learner", nav = LEARNER_NAV }) {
  const [open, setOpen] = useState(false);
  const um = useRef(null), btn = useRef(null);
  const isAdminView = variant === "admin";
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = e => { if (um.current && !um.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className={`tl-course ${isAdminView ? "is-admin" : ""}`}>
      <span dangerouslySetInnerHTML={{ __html: ICON_SPRITE }} />
      <header className={`bar ${isAdminView ? "admin" : ""}`}>
        <div className="wrap">
          <a className="logo" href={isAdminView ? "#/manage" : "#/home"} style={{ textDecoration: "none", color: "inherit" }}>テノ<b>ラボ</b>{!isAdminView && <small>TENO LAB</small>}</a>
          {isAdminView && <span className="mode">ADMIN</span>}
          <nav className="nav" aria-label="画面">
            {nav.map(([k, label, href, count]) => <a key={k} href={href} aria-current={section === k ? "page" : undefined} className="navlink">{label}{count ? <span className="n">{count}</span> : null}</a>)}
          </nav>
          <div className="me">
            {admin && <a className="switch" href={isAdminView ? "#/home" : "#/manage"}>{isAdminView ? "受講生の画面で見る" : "管理の画面"}</a>}
            <div className="um" ref={um}>
              <button type="button" className="um-btn" aria-haspopup="menu" aria-expanded={open} ref={btn} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
                <span className="um-name"><b>{name}</b><small>{ROLE_LABEL[role] || "受講生"}</small></span>
                <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
              <div className="um-menu" role="menu" hidden={!open}>
                <div className="um-head"><b>{name}</b>{email && <small>{email}</small>}</div>
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
