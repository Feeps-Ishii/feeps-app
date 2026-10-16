import React, { useEffect, useRef, useState } from "react";
import { ICON_SPRITE } from "./ui.jsx";
import { DevHubLogo } from "../../../components/common/DevHubMark.jsx";
import { NoticeBell } from "./notices/Notices.jsx";

/* ログイン後の外枠（モックの header.bar）。右上に名前とメニュー。
   受講生の画面：ホーム／コース一覧／演習一覧／案件体験。
   管理の画面（variant "admin"、モック tenolab-admin.html）：帯を黒にして受講生の画面と見分ける。
   企業担当者の画面（variant "client"）も黒い帯。右上のリンク（switchLink）で受講生の画面と行き来できる */
export const LEARNER_NAV = [["home", "ホーム", "#/home"], ["courses", "コース一覧", "#/courses"], ["drills", "演習一覧", "#/drills"], ["cases", "案件体験", "#/cases"]];
const ROLE_LABEL = { admin: "管理者", instructor: "講師", client: "企業担当者", trainee: "受講生" };

export default function Shell({ section, name, email, role, switchLink, onLogout, onRename, children, variant = "learner", nav = LEARNER_NAV, notices }) {
  const [open, setOpen] = useState(false);
  // 名前を変える（まとめて発行したアカウントの人だけ。2026-10-16）
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  async function saveName(e) {
    e.preventDefault();
    const n = newName.trim();
    if (!n || renameBusy) return;
    setRenameBusy(true);
    try { await onRename(n); setRenaming(false); setOpen(false); } catch (er) { /* 失敗したら開いたまま */ } finally { setRenameBusy(false); }
  }
  const um = useRef(null), btn = useRef(null);
  const isAdminView = variant === "admin" || variant === "client";
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
          <a className="logo" href={variant === "admin" ? "#/manage" : variant === "client" ? "#/company" : "#/home"} style={{ textDecoration: "none", color: "inherit" }}><DevHubLogo product="lrn" size={30} dark={isAdminView} /></a>
          {isAdminView && <span className="mode">{variant === "client" ? "CLIENT" : "ADMIN"}</span>}
          <nav className="nav" aria-label="画面">
            {nav.map(([k, label, href, count]) => <a key={k} href={href} aria-current={section === k ? "page" : undefined} className="navlink">{label}{count ? <span className="n">{count}</span> : null}</a>)}
          </nav>
          <div className="me">
            {switchLink && <a className="switch" href={switchLink[0]}>{switchLink[1]}</a>}
            {notices && variant !== "admin" && <NoticeBell notices={notices} dark={isAdminView} />}
            <div className="um" ref={um}>
              <button type="button" className="um-btn" aria-haspopup="menu" aria-expanded={open} ref={btn} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
                <span className="um-name"><b>{name}</b><small>{ROLE_LABEL[role] || "受講生"}</small></span>
                <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
              <div className="um-menu" role="menu" hidden={!open}>
                <div className="um-head"><b>{name}</b>{email && <small>{email}</small>}</div>
                {onRename && (renaming
                  ? <form onSubmit={saveName} style={{ display: "grid", gap: 6, padding: "8px 12px" }}><input id="um-rename" aria-label="新しい名前" value={newName} autoFocus onChange={e => setNewName(e.target.value.slice(0, 40))} /><span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><button type="button" className="btn ghost" onClick={() => setRenaming(false)}>やめる</button><button type="submit" className="btn" disabled={renameBusy || !newName.trim()}>{renameBusy ? "保存しています…" : "保存"}</button></span></form>
                  : <button type="button" role="menuitem" className="um-out" onClick={() => { setNewName(name || ""); setRenaming(true); }}>名前を変える</button>)}
                <button type="button" role="menuitem" className="um-out" onClick={() => { setOpen(false); onLogout(); }}>ログアウト</button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="wrap" id="app">{children}</main>
      <footer className="tl-foot"><div className="wrap"><DevHubLogo product="lrn" size={22} /><span>© {new Date().getFullYear()} Feeps</span></div></footer>
    </div>
  );
}
