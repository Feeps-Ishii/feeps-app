import React, { useEffect, useMemo, useState } from "react";
import "./console.css";
import { apiPost } from "../../api.js";
import { useConsoleCourses } from "./useConsole.js";
import { ruleIntent } from "./intent.js";
import ConsoleHome from "./ConsoleHome.jsx";
import ConsoleCourse from "./ConsoleCourse.jsx";
import ConsolePeople from "./ConsolePeople.jsx";
import CourseMenu from "./CourseMenu.jsx";
import AssistPanel from "./AssistPanel.jsx";

/* 管理者・講師の新しい画面（2026-10-20。モック docs/design/mockups/devhub-lms-2026-10/lms-admin-new.html）
   入口：コース（ホーム）／人・企業（管理者だけ）。サイドバーはなし。
   頼む欄：ホームは大きく、ほかの画面は上の帯に小さく。移動はすぐ、変えるものは確かめてから実行。
   講師は担当のコースが1つならそのコースから始まる（中身は管理者と同じ） */

const LOC_KEY = "feeps.console.loc";
function readLoc() {
  try { const v = JSON.parse(window.sessionStorage.getItem(LOC_KEY) || "null"); return v && typeof v === "object" ? v : null; } catch { return null; }
}
function saveLoc(loc) { try { window.sessionStorage.setItem(LOC_KEY, JSON.stringify(loc)); } catch { /* 読み直すとホームに戻るだけ */ } }

const initials = name => String(name || "?").replace(/\s/g, "").slice(0, 1);

export default function ConsoleApp({ role, displayName, userProfile, onLogout, onLegacy, goProduct, modeSwitch, viewAs }) {
  const data = useConsoleCourses(role);
  const { courses } = data;
  const [loc, setLoc] = useState(() => readLoc() || { area: "home" });
  const [scope, setScope] = useState("");
  const [pick, setPick] = useState("");
  const [ask, setAsk] = useState(null);
  const [mini, setMini] = useState("");
  const [menu, setMenu] = useState("");
  const [toast, setToast] = useState("");

  const go = next => { setLoc(next); saveLoc(next); setMenu(""); window.scrollTo?.(0, 0); };
  const openCourse = (courseId, tab = "today") => { setPick(""); go({ area: "course", courseId, tab }); };

  // 講師で担当が1つだけなら、そのコースから始める
  const single = role === "instructor" && courses.length === 1 ? courses[0] : null;
  useEffect(() => {
    if (single && loc.area === "home" && !pick) go({ area: "course", courseId: single.id, tab: loc.tab || "today" });
  }, [single?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const course = loc.area === "course" ? courses.find(c => c.id === loc.courseId) : null;
  // コースが見つからない（消えた・担当でなくなった）ときはホームへ
  useEffect(() => {
    if (loc.area === "course" && !data.loading && !course) go({ area: "home" });
  }, [loc.area, data.loading, course]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); }, [toast]);

  const counts = useMemo(() => {
    if (!course) return {};
    const waiting = course.reports != null && course.commented != null ? course.reports - course.commented : 0;
    const absent = course.students != null && course.present != null && course.today === "training" ? course.students - course.present : 0;
    return { report: waiting || 0, att: absent || 0 };
  }, [course]);

  function navigate(r) {
    if (r.area === "people" && role === "admin") return go({ area: "people" });
    if (r.area === "library") { setToast("教材の画面は準備中です。コースの中のタブから開けます。"); return undefined; }
    if (r.area === "course" && r.courseId) return openCourse(r.courseId, r.tab || "today");
    if (r.area === "course" && r.tab) { setPick(r.tab); return go({ area: "home" }); }
    return go({ area: "home" });
  }

  async function doAsk(text, scopeCourseId) {
    const rule = ruleIntent(text, { courses, scopeCourseId });
    if (rule?.kind === "navigate") { setAsk(null); return navigate(rule); }
    if (rule?.kind === "pick") { setAsk(null); setPick(rule.tab); return go({ area: "home" }); }
    setAsk({ text, loading: true });
    try {
      const result = await apiPost("/console/assist", { text, courseId: scopeCourseId || "" });
      if (result?.kind === "navigate") { setAsk(null); return navigate(result); }
      setAsk({ text, result });
    } catch (e) {
      setAsk({ text, error: e?.message || "うまく受け取れませんでした。もう一度お試しください。" });
    }
    return undefined;
  }

  const asking = !!ask?.loading;
  const isHome = loc.area === "home";
  const nav = [["home", single ? "コース" : "コース"], ...(role === "admin" ? [["people", "人・企業"]] : [])];

  return (
    <div className="dhc">
      {viewAs && <div className="dhc-viewas">{viewAs.label}の画面で表示しています <button type="button" onClick={viewAs.back}>管理者に戻る</button></div>}
      <header className="dhc-bar">
        <button type="button" className="dhc-brand" onClick={() => (single ? openCourse(single.id) : go({ area: "home" }))}>
          <i aria-hidden="true" /><span><b>DevHub LMS</b><small>{role === "instructor" ? "講師" : "管理"}</small></span>
        </button>
        <nav className="dhc-nav" aria-label="入口">
          {nav.map(([k, t]) => (
            <button key={k} type="button" aria-current={k === "home" ? loc.area === "home" || loc.area === "course" : loc.area === k}
              onClick={() => (k === "home" ? (single ? openCourse(single.id) : go({ area: "home" })) : go({ area: k }))}>{t}</button>
          ))}
        </nav>
        {course && !single && (
          <span className="dhc-cswitch">
            <button type="button" aria-expanded={menu === "course"} onClick={() => setMenu(m => (m === "course" ? "" : "course"))}>
              <span className="dhc-dot" style={{ "--c": course.color }} /><span>{course.name}</span><span className="chev">▾</span>
            </button>
            {menu === "course" && <CourseMenu courses={courses} value={course.id} onPick={id => openCourse(id, loc.tab)} onClose={() => setMenu("")} />}
          </span>
        )}
        {!isHome && (
          <form className="dhc-mini" onSubmit={e => { e.preventDefault(); const v = mini.trim(); if (v) { doAsk(v, course?.id || ""); setMini(""); } }}>
            <input value={mini} onChange={e => setMini(e.target.value)} aria-label="頼む" placeholder={course ? `${course.name} で頼む（例：日報 ／ お知らせを出して）` : "例）今日の日報 ／ 講師を担当に"} />
            <button type="submit" disabled={asking}>頼む</button>
          </form>
        )}
        <span className="dhc-me">
          {modeSwitch}
          <button type="button" className="dhc-av" style={{ "--ac": role === "instructor" ? "#2FA9A1" : "#6E54D9" }} aria-label="メニュー" aria-expanded={menu === "me"} onClick={() => setMenu(m => (m === "me" ? "" : "me"))}>{initials(displayName)}</button>
          {menu === "me" && (
            <div className="dhc-menu" role="menu">
              <span className="lab">{displayName}</span>
              <button type="button" onClick={() => onLegacy("profile")}>プロフィール</button>
              <button type="button" onClick={() => onLegacy("notifications")}>通知</button>
              <button type="button" onClick={() => onLegacy("reservations")}>予約（面談・報告会）</button>
              <button type="button" onClick={() => onLegacy("goals")}>目標とタスク</button>
              <hr />
              <button type="button" onClick={() => onLegacy("home", { persist: true })}>前の画面に切り替える</button>
              <button type="button" onClick={onLogout}>ログアウト</button>
            </div>
          )}
        </span>
      </header>

      <main className="dhc-body">
        {loc.area === "home" && (
          <ConsoleHome role={role} courses={courses} loading={data.loading} error={data.error} reload={data.reload}
            scope={scope} setScope={setScope} onAsk={t => doAsk(t, scope)} asking={asking}
            pick={pick} setPick={setPick} openCourse={openCourse} />
        )}
        {loc.area === "course" && course && (
          <ConsoleCourse course={course} tab={loc.tab || "today"} role={role} counts={counts}
            openTab={tab => go({ ...loc, tab })} onLegacy={onLegacy}
            userProfile={userProfile} displayName={displayName} goProduct={goProduct} />
        )}
        {loc.area === "course" && !course && <div className="dhc-empty">読み込んでいます…</div>}
        {loc.area === "people" && role === "admin" && <ConsolePeople sub={loc.sub} setSub={sub => go({ area: "people", sub })} onLegacy={onLegacy} />}
      </main>

      {ask && <AssistPanel key={ask.text + (ask.result ? "r" : "")} ask={ask} courses={courses} role={role} onClose={() => setAsk(null)} onNavigate={r => { setAsk(null); navigate(r); }} onDone={data.reload} />}
      {toast && <div role="status" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 70, background: "var(--ink)", color: "#fff", borderRadius: 12, padding: "9px 16px", fontSize: 13, fontWeight: 700 }}>{toast}</div>}
    </div>
  );
}
