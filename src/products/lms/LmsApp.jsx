import React, { Suspense, useEffect, useMemo, useState } from "react";
import { apiGet } from "../../api.js";
import { getActiveCourseId, setLibraryTarget } from "../../utils/common/courseContext.js";
import "./lms-staff.css";
import "./lms.css";
import { DevHubMark } from "../../components/common/DevHubMark.jsx";
import { LMS_BNAV, LMS_LEGACY, LMS_ROLE_LABEL, lmsGroups, lmsLabel } from "./LmsCatalog.js";
import { Icon } from "./parts/icons.jsx";
import { Soon } from "./parts/ui.jsx";
import { HelpPanel, PasswordModal } from "./parts/Ask.jsx";
import { BellPop, Face, NotifScreen, useNotifRead } from "./parts/Notif.jsx";
import Profile from "./parts/Profile.jsx";
import { ChatToasts } from "../training/ChatNotifier.jsx";
import CourseSwitch from "./parts/CourseSwitch.jsx";
import { LMS_SCREENS } from "./screens.js";

/* 新しい LMS（セージ）の入口（2026-11-02、計画 docs/specs/lms-sage-plan.md）。
   上の帯にまとまり（カーソルで中の画面が出る）、その下に画面のタブ。スマホは下のメニュー。
   作り直した画面は LMS_SCREENS から、まだの画面は今の画面（renderLegacy）を中に出す */

// 画面の中で落ちても、上の帯とメニューは残す（別の画面へ移ると戻る）
class ScreenBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error, info) { console.error("lms screen failed", error, info); }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="card lms-crash"><div className="empty"><b>この画面を開けませんでした</b><button type="button" className="btn ghost sm" onClick={() => window.location.reload()}>再読み込み</button></div></div>;
  }
}

// フォルダの「リンクをコピー」の URL（?fc=コース&fn=ファイル）から来たとき。読み込みで 1 回だけ読む
const FOLDER_LINK = (() => {
  try {
    const u = new URL(window.location.href), c = u.searchParams.get("fc"), n = u.searchParams.get("fn");
    if (!c || !n) return "";
    setLibraryTarget({ courseId: c, nodeId: n });
    u.searchParams.delete("fc"); u.searchParams.delete("fn");
    window.history.replaceState(null, "", u.toString());
    return c;
  } catch { return ""; }
})();

const LOC_KEY = "feeps.lms.loc";
const readLoc = () => { try { return window.sessionStorage.getItem(LOC_KEY) || "home"; } catch { return "home"; } };
const saveLoc = s => { try { window.sessionStorage.setItem(LOC_KEY, s); } catch { /* 読み直すとホームに戻るだけ */ } };

export default function LmsApp({ role, manager = false, displayName, badges = {}, tasks, onLogout, renderLegacy, notifications = [], notifLoading = false, notifError = "", notifDismissedAll = false, onReadAll, onRetryNotifs, onOpenNotif }) {
  const [off, setOff] = useState([]);          // コースの設定で切った機能（読めないときは全部出す）
  const groups = useMemo(() => lmsGroups(role).map(g => [g[0], g[1], g[2].filter(s => !off.includes(s[0]))]).filter(g => g[2].length), [role, off]);
  const keys = groups.flatMap(g => g[2].map(s => s[0]));
  const [screen, setScreen] = useState(() => { const s = FOLDER_LINK ? (role === "admin" && FOLDER_LINK !== "shared" ? "cdoc" : "doc") : readLoc(); return keys.includes(s) ? s : "home"; });
  const [help, setHelp] = useState(null);      // 使い方（null は閉じている）
  const [pwOpen, setPwOpen] = useState(false);
  const [extra, setExtra] = useState(null); // 通知・プロフィールなど、メニューに無い画面
  const [pop, setPop] = useState("");
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState("");
  const [lastIn, setLastIn] = useState({});
  const [courseV, setCourseV] = useState(0);   // コースを切り替えたら画面を読み直す
  const [mail, setMail] = useState("");
  const nst = useNotifRead(notifications, notifDismissedAll, onReadAll);

  const admin = role === "admin";
  const cur = groups.find(g => g[2].some(s => s[0] === screen)) || groups[0];
  const go = k => { setExtra(null); setScreen(k); saveLoc(k); setPop(""); setSheet(false); const g = groups.find(x => x[2].some(s => s[0] === k)); if (g) setLastIn(m => ({ ...m, [g[0]]: k })); window.scrollTo?.(0, 0); };
  const say = t => setToast(t);
  // メニューの件数の印（モックと同じく講師・コース担当者だけ。数は今の画面のメニューと同じ通知から）
  const nOf = k => { if (role !== "instructor") return 0; const v = LMS_LEGACY[role]?.[k]; return (v && badges?.[v]) || 0; };
  useEffect(() => { const open = () => setHelp(""); window.addEventListener("lms:help", open); return () => window.removeEventListener("lms:help", open); }, []);
  useEffect(() => { const open = () => { setExtra("notifications"); window.scrollTo?.(0, 0); }; window.addEventListener("lms:notifications", open); return () => window.removeEventListener("lms:notifications", open); }, []);
  useEffect(() => { if (pop !== "me" || mail) return; apiGet("/profile/me").then(p => setMail(p?.email || p?.username || "")).catch(() => {}); }, [pop, mail]);
  useEffect(() => {
    if (role === "admin") return undefined;
    let alive = true;
    apiGet(role === "trainee" ? "/me/courses" : "/completion-report/courses").then(async list => {
      const rows = Array.isArray(list) ? list : Array.isArray(list?.courses) ? list.courses : [];
      const c = rows.find(x => x.courseId === getActiveCourseId()) || rows[0];
      if (!c?.courseId) return;
      const r = await apiGet(`/course-config?courseId=${encodeURIComponent(c.courseId)}`);
      if (alive) setOff(Object.entries(r?.features || {}).filter(([, on]) => on === false).map(([k]) => k));
    }).catch(() => { /* 読めないときは全部出す */ });
    return () => { alive = false; };
  }, [role, courseV]);
  useEffect(() => { if (off.includes(screen)) go("home"); }, [off]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!pop) return undefined; const close = e => { if (!e.target.closest?.(".lms-me")) setPop(""); }; document.addEventListener("click", close); return () => document.removeEventListener("click", close); }, [pop]);

  // 中に出した今の画面からの移動：新しい画面にあればそこへ、無ければ今の画面のまま開く
  const goLegacy = v => { const k = Object.entries(LMS_LEGACY[role] || {}).find(([, lv]) => lv === v)?.[0]; if (k) go(k); else { setExtra(v); window.scrollTo?.(0, 0); } };
  const label = manager ? LMS_ROLE_LABEL.manager : LMS_ROLE_LABEL[role];
  const Screen = LMS_SCREENS[role]?.[screen];
  const legacyView = extra || LMS_LEGACY[role]?.[screen];
  const openNotif = n => { nst.read(n); setPop(""); setExtra(null); onOpenNotif?.(n, goLegacy); };
  const body = extra === "profile" || extra === "profile:pw"
    ? <Profile key={extra} role={role} label={label} initialTab={extra === "profile:pw" ? "pw" : "info"} say={say} />
    : extra === "notifications"
    ? <NotifScreen items={notifications} loading={notifLoading} error={notifError} st={nst} onOpen={openNotif} onRetry={onRetryNotifs} />
    : !extra && Screen
    ? <Screen key={courseV} role={role} manager={manager} go={go} say={say} displayName={displayName} tasks={tasks} />
    : legacyView
      ? <div className="lms-legacy" key={`${legacyView}-${courseV}`}>{renderLegacy(legacyView, goLegacy)}</div>
      : <Soon k={screen} label={lmsLabel(role, screen)} />;

  const bnav = (LMS_BNAV[role] || LMS_BNAV.trainee).filter(k => !off.includes(k));
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
                  {gt}<span className="cv" aria-hidden="true">▾</span>{cur[0] !== gk && subs.reduce((n, s) => n + nOf(s[0]), 0) > 0 && <span className="n">{subs.reduce((n, s) => n + nOf(s[0]), 0)}</span>}
                </button>
                <div className="lms-drop">
                  <div className="lms-dc" role="menu" aria-label={gt}>
                    <div className="lms-dh">{gt}</div>
                    {subs.map(([k, t]) => (
                      <button key={k} type="button" role="menuitem" className="lms-di" aria-current={screen === k && !extra ? "page" : undefined} onClick={e => { e.currentTarget.blur(); go(k); }}>
                        <span className="ic"><Icon k={k} /></span><span>{t}</span>{nOf(k) > 0 && <span className="n">{nOf(k)}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>
          <div className="lms-me">
            <button type="button" className="lms-bell" aria-label="通知" aria-expanded={pop === "bell"} onClick={() => setPop(p => (p === "bell" ? "" : "bell"))}>
              <Icon k="bell" />{nst.unread > 0 && <em>{nst.unread}</em>}
            </button>
            <button type="button" className="lms-um" aria-expanded={pop === "me"} onClick={() => setPop(p => (p === "me" ? "" : "me"))}>
              <Face name={displayName} size={28} />
              <span><b>{displayName}</b><small>{label}</small></span><i aria-hidden="true">≡</i>
            </button>
            {pop === "bell" && <BellPop items={notifications} loading={notifLoading} error={notifError} st={nst} onOpen={openNotif} onAll={() => { setExtra("notifications"); setPop(""); window.scrollTo?.(0, 0); }} onRetry={onRetryNotifs} />}
            {pop === "me" && (
              <div className="lms-pop" role="menu">
                <div className="mh"><Face name={displayName} /><span><b>{displayName}</b>{mail && <small>{mail}</small>}</span></div>
                <div className="mrow"><span className="chip mk">{label}</span></div>
                <button type="button" role="menuitem" onClick={() => { setExtra("profile"); setPop(""); }}>プロフィール</button>
                <button type="button" role="menuitem" onClick={() => { setExtra("profile:pw"); setPop(""); }}>パスワードを変える</button>
                <button type="button" role="menuitem" onClick={() => { setHelp(""); setPop(""); }}>ヘルプ・使い方</button>
                <button type="button" role="menuitem" onClick={onLogout}>ログアウト</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="lms-sub">
        <div className="lms-wrap" role="tablist" aria-label={cur[1]}>
          {cur[2].map(([k, t]) => <button key={k} type="button" role="tab" aria-current={screen === k && !extra ? "page" : undefined} aria-selected={screen === k && !extra} onClick={() => go(k)}>{t}{nOf(k) > 0 && <span className="n">{nOf(k)}</span>}</button>)}
          <CourseSwitch role={role} onChange={() => setCourseV(v => v + 1)} />
        </div>
      </div>
      <main className="lms-main lms-wrap">
        <ScreenBoundary resetKey={`${screen}|${extra || ""}|${courseV}`}><Suspense fallback={<div className="soon">読み込み中</div>}>{body}</Suspense></ScreenBoundary>
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
      {help !== null && <HelpPanel role={role} groups={groups} initial={help} onClose={() => setHelp(null)} onGo={k => { setHelp(null); go(k); }} onPassword={() => { setHelp(null); setPwOpen(true); }} />}
      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} say={say} />}
      {toast && <div className="lms-toast" role="status">{toast}</div>}
      <ChatToasts role={role} onOpenTeams={() => go("team")} />
    </div>
  );
}
