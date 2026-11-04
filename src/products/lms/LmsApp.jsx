import React, { Suspense, useEffect, useState } from "react";
import "./lms.css";
import { DevHubMark } from "../../components/common/DevHubMark.jsx";
import { LMS_BNAV, LMS_LEGACY, LMS_ROLE_LABEL, lmsGroups, lmsLabel } from "./LmsCatalog.js";
import { Icon } from "./parts/icons.jsx";
import { Soon } from "./parts/ui.jsx";
import { ChatToasts } from "../training/ChatNotifier.jsx";
import CourseSwitch from "./parts/CourseSwitch.jsx";
import { LMS_SCREENS } from "./screens.js";

/* 新しい LMS（セージ）の入口（2026-11-02、計画 docs/specs/lms-sage-plan.md）。
   上の帯にまとまり（カーソルで中の画面が出る）、その下に画面のタブ。スマホは下のメニュー。
   作り直した画面は LMS_SCREENS から、まだの画面は今の画面（renderLegacy）を中に出す */

const LOC_KEY = "feeps.lms.loc";
const readLoc = () => { try { return window.sessionStorage.getItem(LOC_KEY) || "home"; } catch { return "home"; } };
const saveLoc = s => { try { window.sessionStorage.setItem(LOC_KEY, s); } catch { /* 読み直すとホームに戻るだけ */ } };

export default function LmsApp({ role, manager = false, displayName, unread = 0, tasks, onLogout, onLegacy, renderLegacy }) {
  const groups = lmsGroups(role);
  const keys = groups.flatMap(g => g[2].map(s => s[0]));
  const [screen, setScreen] = useState(() => { const s = readLoc(); return keys.includes(s) ? s : "home"; });
  const [extra, setExtra] = useState(null); // 通知・プロフィールなど、メニューに無い画面
  const [pop, setPop] = useState("");
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState("");
  const [lastIn, setLastIn] = useState({});
  const [courseV, setCourseV] = useState(0);   // コースを切り替えたら画面を読み直す

  const admin = role === "admin";
  const cur = groups.find(g => g[2].some(s => s[0] === screen)) || groups[0];
  const go = k => { setExtra(null); setScreen(k); saveLoc(k); setPop(""); setSheet(false); const g = groups.find(x => x[2].some(s => s[0] === k)); if (g) setLastIn(m => ({ ...m, [g[0]]: k })); window.scrollTo?.(0, 0); };
  const say = t => setToast(t);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!pop) return undefined; const close = e => { if (!e.target.closest?.(".lms-me")) setPop(""); }; document.addEventListener("click", close); return () => document.removeEventListener("click", close); }, [pop]);

  // 中に出した今の画面からの移動：新しい画面にあればそこへ、無ければ今の画面のまま開く
  const goLegacy = v => { const k = Object.entries(LMS_LEGACY[role] || {}).find(([, lv]) => lv === v)?.[0]; if (k) go(k); else { setExtra(v); window.scrollTo?.(0, 0); } };
  const label = manager ? LMS_ROLE_LABEL.manager : LMS_ROLE_LABEL[role];
  const Screen = LMS_SCREENS[role]?.[screen];
  const legacyView = extra || LMS_LEGACY[role]?.[screen];
  const body = Screen
    ? <Screen key={courseV} role={role} manager={manager} go={go} say={say} displayName={displayName} tasks={tasks} />
    : legacyView
      ? <div className="lms-legacy" key={`${legacyView}-${courseV}`}>{renderLegacy(legacyView, goLegacy)}</div>
      : <Soon k={screen} label={lmsLabel(role, screen)} />;

  const bnav = LMS_BNAV[role] || LMS_BNAV.trainee;
  return (
    <div className="lms">
      <header className={`lms-bar${admin ? " admin" : ""}`}>
        <div className="lms-wrap">
          <button type="button" className="lms-logo" onClick={() => go("home")} aria-label="DevHub LMS のホーム">
            <DevHubMark product="teal" size={30} /><span className="wm">Dev<b>Hub</b><i>LMS</i></span>
          </button>
          {admin && <span className="lms-mode">ADMIN</span>}
          <nav className="lms-nav" aria-label="分け方">
            {groups.map(([gk, gt, subs]) => (
              <div className="lms-ng" key={gk}>
                <button type="button" aria-current={cur[0] === gk ? "page" : undefined} aria-haspopup="true" onClick={() => go(lastIn[gk] || subs[0][0])}>
                  {gt}<span className="cv"><Icon k="down" size={12} /></span>
                </button>
                <div className="lms-drop">
                  <div className="lms-dc" role="menu" aria-label={gt}>
                    <div className="lms-dh">{gt}</div>
                    {subs.map(([k, t]) => (
                      <button key={k} type="button" role="menuitem" className="lms-di" aria-current={screen === k && !extra ? "page" : undefined} onClick={() => go(k)}>
                        <span className="ic"><Icon k={k} /></span><span>{t}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>
          <div className="lms-me">
            <button type="button" className="lms-bell" aria-label="通知" onClick={() => { setExtra("notifications"); setPop(""); }}>
              <Icon k="bell" />{unread > 0 && <em>{unread}</em>}
            </button>
            <button type="button" className="lms-um" aria-expanded={pop === "me"} onClick={() => setPop(p => (p === "me" ? "" : "me"))}>
              <span className="face" style={{ width: 28, height: 28, fontSize: 12 }}>{String(displayName || "?").slice(0, 1)}</span>
              <span><b>{displayName}</b><small>{label}</small></span>
            </button>
            {pop === "me" && (
              <div className="lms-pop" role="menu">
                <button type="button" role="menuitem" onClick={() => { setExtra("profile"); setPop(""); }}>プロフィール</button>
                <button type="button" role="menuitem" onClick={() => onLegacy()}>前の画面に戻す</button>
                <button type="button" role="menuitem" onClick={onLogout}>ログアウト</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="lms-sub">
        <div className="lms-wrap" role="tablist" aria-label={cur[1]}>
          {cur[2].map(([k, t]) => <button key={k} type="button" role="tab" aria-current={screen === k && !extra ? "page" : undefined} aria-selected={screen === k && !extra} onClick={() => go(k)}>{t}</button>)}
          {role === "trainee" && <CourseSwitch onChange={() => setCourseV(v => v + 1)} />}
        </div>
      </div>
      <main className="lms-main lms-wrap">
        <Suspense fallback={<div className="soon">読み込み中</div>}>{body}</Suspense>
      </main>
      <nav className="lms-bnav" aria-label="メニュー">
        {bnav.map(k => <button key={k} type="button" aria-current={screen === k && !extra ? "page" : undefined} onClick={() => go(k)}><Icon k={k} size={20} />{lmsLabel(role, k)}</button>)}
        <button type="button" aria-expanded={sheet} onClick={() => setSheet(true)}><Icon k="menu" size={20} />メニュー</button>
      </nav>
      {sheet && (
        <div className="lms-sheet" onClick={e => { if (e.target === e.currentTarget) setSheet(false); }}>
          <div role="dialog" aria-label="メニュー">
            {groups.map(([gk, gt, subs]) => (
              <section key={gk} style={{ display: "grid", gap: 8 }}>
                <h3>{gt}</h3>
                <div className="grid">{subs.map(([k, t]) => <button key={k} type="button" aria-current={screen === k ? "page" : undefined} onClick={() => go(k)}><Icon k={k} size={20} />{t}</button>)}</div>
              </section>
            ))}
          </div>
        </div>
      )}
      {toast && <div className="lms-toast" role="status">{toast}</div>}
      <ChatToasts role={role} onOpenTeams={() => go("team")} />
    </div>
  );
}
