import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAuthSession, getCurrentUser, signOut } from "aws-amplify/auth";
import { apiGet } from "../../api.js";
import { roleOf, isStaffRole } from "./role.js";
import { ENTRY_HTML } from "./entry/entryMarkup.js";
import { mountEntry } from "./entry/mountEntry.js";
import { entryAuth } from "./entry/entryAuth.js";
import { useLearning } from "../learning/useLearning.js";
import Shell from "./app/Shell.jsx";
import { Home, ListPage, TopicPage } from "./app/Browse.jsx";
import { CourseDetail, FinalTestPage, LessonPage } from "./app/CoursePages.jsx";
import DrillPage from "./app/DrillPage.jsx";
import CasePage from "./app/CasePage.jsx";
import ManagePage from "./app/manage/ManagePage.jsx";
import { LoadError, Loading } from "./app/ui.jsx";
import { submitInquiry, useCases, useDrills, useLabProgress, useMe, useTopics } from "./app/data.js";
import { caseModels, courseModels, drillModels } from "./app/model.js";
import "./app/app.css";

/* テノラボ（コース型、ADR 0024）の本体。LMS（TrainingApp）とは別の入口 lab.html で開く。
   CloudFront に SPA のフォールバックが無いので、画面は URL の # の後ろで切り替える。
     #/  #/login  #/try  #/quote          入口（モック tenolab-entry.html をそのまま載せる）
     #/home  #/topics/{id}                 ホーム・単元
     #/courses  #/drills  #/cases          一覧
     #/courses/{id}[/lessons/{lid}[/{slide}] | /test | /result]
     #/drills/{id}  #/cases/{id}
     #/manage/…                            講師・管理者 */
const ENTRY = new Set(["", "login", "try", "quote"]);

function parseHash() {
  const h = (window.location.hash || "").replace(/^#\/?/, "");
  const p = h.split("/").filter(Boolean).map(decodeURIComponent);
  if (!p.length || ENTRY.has(p[0])) return { page: "entry", view: p[0] || "" };
  if (p[0] === "home") return { page: "home" };
  if (p[0] === "topics" && p[1]) return { page: "topic", id: p[1] };
  if (p[0] === "courses" && !p[1]) return { page: "list", kind: "courses" };
  if (p[0] === "courses" && p[2] === "lessons" && p[3]) return { page: "lesson", id: p[1], lessonId: p[3], slideId: p[4] || null };
  if (p[0] === "courses" && (p[2] === "test" || p[2] === "result")) return { page: "test", id: p[1], mode: p[2] };
  if (p[0] === "courses") return { page: "course", id: p[1] };
  if (p[0] === "drills" && p[1]) return { page: "drill", id: p[1] };
  if (p[0] === "drills") return { page: "list", kind: "drills" };
  if (p[0] === "cases" && p[1]) return { page: "case", id: p[1] };
  if (p[0] === "cases") return { page: "list", kind: "cases" };
  if (p[0] === "manage") return { page: "manage", rest: p.slice(1) };
  return { page: "entry", view: "", anchor: p[0] };   // #how のようなページ内リンク
}
const SECTION = { home: "home", topic: "home", list: null, course: "courses", lesson: "courses", test: "courses", drill: "drills", case: "cases" };

export default function TenolabApp() {
  const [route, setRoute] = useState(parseHash);
  const [auth, setAuth] = useState({ state: "loading", name: "", email: "", role: "" }); // loading | in | out

  useEffect(() => {
    const onHash = () => {
      const r = parseHash();
      setRoute(r);
      if (!r.anchor) window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const u = await getCurrentUser();
      const email = u?.signInDetails?.loginId || "";
      let name = email.split("@")[0] || "";
      try {
        const p = await apiGet("/profile/me");
        if (p?.name) name = p.name;
      } catch (e) {
        console.warn("tenolab profile load failed", e);   // 名前が取れなくてもログインは続ける
      }
      let role = "trainee";
      try { role = roleOf((await fetchAuthSession())?.tokens?.idToken?.payload || {}); } catch (e) { console.warn("tenolab role load failed", e); }
      setAuth({ state: "in", name: name || "あなた", email, role });
      return true;
    } catch (e) {
      setAuth({ state: "out", name: "", email: "", role: "" });
      return false;
    }
  }, []);
  useEffect(() => { loadUser(); }, [loadUser]);

  // ログインが要る画面は、ログインしていなければログインへ。ログイン画面はログイン済みならホームへ
  useEffect(() => {
    if (auth.state === "out" && route.page !== "entry") window.location.hash = "#/login";
    if (auth.state === "in" && route.page === "entry" && route.view === "login") window.location.hash = "#/home";
  }, [auth.state, route.page, route.view]);

  async function logout() {
    try { await signOut(); } catch (e) { /* 抜けられなくても入口へ戻す */ }
    setAuth({ state: "out", name: "", email: "", role: "" });
    window.location.hash = "#/";
  }

  if (route.page === "entry") {
    return <EntryHost onLoggedIn={async () => { if (await loadUser()) window.location.hash = "#/home"; }} />;
  }
  if (auth.state !== "in") return <div className="tl-boot" role="status">読み込んでいます…</div>;
  return <App route={route} auth={auth} onLogout={logout} />;
}

/* 入口（紹介・ログイン・Java体験・お見積り）。モックの HTML と動きをそのまま載せる */
function EntryHost({ onLoggedIn }) {
  const ref = useRef(null);
  const loggedIn = useRef(onLoggedIn);
  loggedIn.current = onLoggedIn;
  useEffect(() => {
    const root = ref.current;
    root.innerHTML = ENTRY_HTML;
    // ページ内リンク（#how など）は、画面の切り替えと区別してスクロールにする
    const onClick = e => {
      const a = e.target.closest?.('a[href^="#"]');
      if (!a || !root.contains(a)) return;
      const href = a.getAttribute("href");
      if (href.startsWith("#/") || href === "#") return;
      e.preventDefault();
      const el = document.getElementById(href.slice(1));
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    };
    root.addEventListener("click", onClick, true);
    let destroy = null;
    try {
      destroy = mountEntry(root, { auth: entryAuth, onLoggedIn: () => loggedIn.current(), submitInquiry });
    } catch (e) {
      console.error("tenolab entry mount failed", e);
    }
    return () => {
      root.removeEventListener("click", onClick, true);
      if (typeof destroy === "function") destroy();
      root.innerHTML = "";
    };
  }, []);
  return <div ref={ref} className="tl-entry" />;
}

/* ログイン後 */
function App({ route, auth, onLogout }) {
  const staff = isStaffRole(auth.role);
  const lrn = useLearning(auth.role);
  const me = useMe(true);
  const topicsQ = useTopics(true);
  const drillsQ = useDrills(true);
  const casesQ = useCases(true);
  const progress = useLabProgress(true);
  const [views, setViews] = useState({ courses: {}, drills: {}, cases: {} });
  // 「戻る」用に、アプリの中で開いた画面を覚えておく（外から直接来たときは、決まった画面へ戻す）
  const prevHashes = useRef([]);
  const lastHash = useRef(window.location.hash);
  const goingBack = useRef(false);
  useEffect(() => {
    const onHash = () => {
      if (goingBack.current) goingBack.current = false;
      else { prevHashes.current.push(lastHash.current); if (prevHashes.current.length > 50) prevHashes.current.shift(); }
      lastHash.current = window.location.hash;
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const premium = !!me.data?.premium || staff;
  const topics = topicsQ.data || [];
  const rawCases = casesQ.data || [];
  const courses = useMemo(() => courseModels(lrn, topics, rawCases, premium), [lrn, topics, rawCases, premium]);
  const drills = useMemo(() => drillModels(drillsQ.data, topics, progress, premium), [drillsQ.data, topics, progress, premium]);
  const cases = useMemo(() => caseModels(rawCases, topics, courses, premium), [rawCases, topics, courses, premium]);

  // 続きから：最後に開いたレッスン（修了していないコース）
  const resume = useMemo(() => {
    const entries = Object.entries(lrn.progress || {}).filter(([id, p]) => p?.lastLessonId && lrn.courseById(id) && lrn.getCourseState(id).status !== "completed");
    entries.sort((a, b) => String(b[1].lastAccessedAt || "").localeCompare(String(a[1].lastAccessedAt || "")));
    const [cid, p] = entries[0] || [];
    if (!cid) return null;
    const course = lrn.courseById(cid);
    const lesson = lrn.lessonsForCourse(cid).find(l => l.id === p.lastLessonId) || null;
    return { course, lesson, label: "レッスンの続きから", href: `#/courses/${cid}/lessons/${p.lastLessonId}` };
  }, [lrn]);

  const go = useCallback(href => { if (window.location.hash !== href) window.location.hash = href; }, []);
  const back = useCallback(fallback => {
    if (prevHashes.current.length) { prevHashes.current.pop(); goingBack.current = true; window.history.back(); }
    else go(fallback);
  }, [go]);

  const ctx = { lrn, topics, courses, drills, cases, premium, staff, go, back, progress, resume };
  const loading = [topicsQ, me].some(q => q.state === "loading") || lrn.courseCatalogState === "loading";
  const failed = [topicsQ, me].find(q => q.state === "error");

  let page;
  if (route.page === "manage") page = staff ? <ManagePage ctx={ctx} rest={route.rest} role={auth.role} /> : <p className="muted" style={{ paddingTop: 24 }}>このメニューは講師と管理者だけが使えます。</p>;
  else if (failed) page = <LoadError onRetry={() => { topicsQ.reload(); me.reload(); }} />;
  else if (loading) page = <Loading />;
  else if (lrn.courseCatalogState === "error" && ["home", "topic", "list", "course"].includes(route.page) && route.kind !== "drills" && route.kind !== "cases") page = <LoadError onRetry={() => window.location.reload()} what="コースを読み込めませんでした" />;
  else if (route.page === "home") page = <><Home ctx={ctx} />{(drillsQ.state === "error" || casesQ.state === "error" || progress.state === "error") && <LoadError onRetry={() => { drillsQ.reload(); casesQ.reload(); progress.reload(); }} what="演習・案件体験を読み込めませんでした" />}</>;
  else if (route.page === "topic") page = <TopicPage ctx={ctx} topicId={route.id} />;
  else if (route.page === "list") {
    const q = route.kind === "drills" ? drillsQ : route.kind === "cases" ? casesQ : null;
    page = q?.state === "error" ? <LoadError onRetry={q.reload} />
      : q?.state === "loading" ? <Loading />
        : <ListPage ctx={ctx} kind={route.kind} view={views[route.kind]} setView={v => setViews(s => ({ ...s, [route.kind]: v }))} />;
  }
  else if (route.page === "course") page = <CourseDetail ctx={ctx} courseId={route.id} />;
  else if (route.page === "lesson") page = <LessonPage ctx={ctx} courseId={route.id} lessonId={route.lessonId} slideId={route.slideId} />;
  else if (route.page === "test") page = <FinalTestPage ctx={ctx} courseId={route.id} mode={route.mode} />;
  else if (route.page === "drill") page = <DrillPage ctx={ctx} id={route.id} />;
  else if (route.page === "case") page = <CasePage ctx={ctx} id={route.id} />;

  return (
    <Shell section={route.page === "list" ? route.kind : SECTION[route.page]} name={auth.name} email={auth.email} role={auth.role} staff={staff} onLogout={onLogout}>
      {page}
    </Shell>
  );
}
