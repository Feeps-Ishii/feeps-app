import React, { useCallback, useEffect, useState } from "react";
import { getCurrentUser, signOut } from "aws-amplify/auth";
import { apiGet } from "../../api.js";
import MountedHtml from "./MountedHtml.jsx";
import { LANDING_HTML } from "./landing/landingMarkup.js";
import { mountLanding } from "./landing/mountLanding.js";
import { COURSE_MAP_HTML } from "./coursemap/courseMapMarkup.js";
import { mountCourseMap } from "./coursemap/mountCourseMap.js";
import LoginPage from "./screens/LoginPage.jsx";
import HomePage from "./screens/HomePage.jsx";
import LabPage from "./screens/LabPage.jsx";
import { useTenolabProgress } from "./useTenolab.js";
import { COURSE_ID, courseProgress, isPlayable } from "./tenolabData.js";
import "./tenolab.css";

/* テノラボ（体験型Eラーニング）の本体。LMS（TrainingApp）とは別の入口 lab.html で開く（ADR 0022）。
   CloudFront に SPA のフォールバックが無いので、画面は URL の # の後ろで切り替える。
     #/            入口
     #/login       ログイン
     #/try         登録なしで1単元（記録は残らない）
     #/home #/find #/devlab #/cloud #/made   ホーム（タブ）
     #/courses/dash        コースマップ
     #/units/dash/u2       単元（体験ラボ） */
const HOME_TABS = ["home", "find", "devlab", "cloud", "made"];

function parseHash() {
  const h = (window.location.hash || "").replace(/^#\/?/, "");
  const p = h.split("/").filter(Boolean);
  if (!p.length) return { page: "lp" };
  if (p[0] === "login") return { page: "login" };
  if (p[0] === "try") return { page: "lab", courseId: COURSE_ID, unitId: "u2", trial: true };
  if (HOME_TABS.includes(p[0])) return { page: "home", tab: p[0] };
  if (p[0] === "courses" && p[1]) return { page: "map", courseId: p[1] };
  if (p[0] === "units" && p[1] && p[2]) return { page: "lab", courseId: p[1], unitId: p[2] };
  return { page: "lp" };
}

function setHash(h) {
  if (window.location.hash !== h) window.location.hash = h;
}

export default function TenolabApp() {
  const [route, setRoute] = useState(parseHash);
  const [auth, setAuth] = useState({ state: "loading", name: "" }); // loading | in | out
  const [pendingClear, setPendingClear] = useState(false);
  const [trialSnap, setTrialSnap] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const progress = useTenolabProgress(auth.state === "in");

  useEffect(() => {
    const onHash = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadUser = useCallback(async () => {
    try {
      const u = await getCurrentUser();
      let name = (u?.signInDetails?.loginId || "").split("@")[0] || "";
      try {
        const p = await apiGet("/profile/me");
        if (p?.name) name = p.name;
      } catch (e) {
        // 名前が取れなくてもログインは続ける（メールの前半で呼ぶ）
        console.warn("tenolab profile load failed", e);
      }
      setAuth({ state: "in", name: name || "あなた" });
      return true;
    } catch (e) {
      setAuth({ state: "out", name: "" });
      return false;
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const go = useCallback((to) => {
    setModal(null);
    if (to === "lp") return setHash("#/");
    if (to === "login") return setHash("#/login");
    if (to === "try") return setHash("#/try");
    if (to === "home") return setHash("#/home");
    if (HOME_TABS.includes(to)) return setHash("#/" + to);
    if (to === "cleared") return onCleared();
    const [kind, a, b] = String(to).split(":");
    if (kind === "course") return setHash("#/courses/" + a);
    if (kind === "unit") {
      if (auth.state !== "in") return setHash("#/try");
      return setHash(`#/units/${a}/${b}`);
    }
    return undefined;
  }, [auth.state]); // eslint-disable-line react-hooks/exhaustive-deps

  function onCleared() {
    if (auth.state === "in") {
      setHash(`#/courses/${COURSE_ID}`);
      setToast("単元2 クリア！ アプリに「人数・合計・平均・最高点」が出るようになりました");
      return;
    }
    setModal("trialClear");
  }

  async function onLoggedIn() {
    const ok = await loadUser();
    if (!ok) return;
    if (pendingClear) {
      setPendingClear(false);
      // おためしでクリアした分を、ログインしたこのときに保存する
      if (trialSnap) {
        try {
          await progress.save(COURSE_ID, "u2", trialSnap);
          setTrialSnap(null);
          setToast("記録を残しました。単元2はクリア済みです");
          setHash(`#/courses/${COURSE_ID}`);
        } catch (e) {
          console.warn("tenolab trial save failed", e);
          setToast("おためしの記録を保存できませんでした。単元2を開いて、もう一度クリアしてください");
          setHash(`#/units/${COURSE_ID}/u2`);
        }
        return;
      }
      setHash(`#/units/${COURSE_ID}/u2`);
      return;
    }
    setHash("#/home");
  }

  async function logout() {
    try { await signOut(); } catch (e) { /* 抜けられなくても入口へ戻す */ }
    setAuth({ state: "out", name: "" });
    setHash("#/");
    setToast("ログアウトしました");
  }

  // ログインが要る画面
  const needsLogin = route.page === "home" || route.page === "map" || (route.page === "lab" && !route.trial);
  useEffect(() => {
    if (auth.state === "out" && needsLogin) {
      if (route.page === "map") return; // コースマップは、ログインしていなくても見せる（入口から来る）
      setHash("#/login");
    }
    if (auth.state === "in" && route.page === "login") setHash("#/home");
  }, [auth.state, needsLogin, route.page]);

  let page;
  if (auth.state === "loading" && route.page !== "lp" && !route.trial) {
    page = <div className="tl-app"><div className="wrap"><p className="wk-note" role="status" style={{ padding: "40px 0" }}>読み込んでいます…</p></div></div>;
  } else if (route.page === "login") {
    page = <LoginPage onLoggedIn={onLoggedIn} onGo={go} pendingClear={pendingClear} />;
  } else if (route.page === "home") {
    page = <HomePage tab={route.tab} onTab={t => setHash("#/" + t)} onGo={go} name={auth.name}
      progressState={progress.state} items={progress.items} onRetry={progress.reload} onLogout={logout} />;
  } else if (route.page === "map") {
    if (auth.state === "in" && progress.state === "loading") page = <Loading />;
    else if (auth.state === "in" && progress.state === "error") page = <LoadError onRetry={progress.reload} />;
    else {
      const pr = courseProgress(progress.items, route.courseId);
      page = <MountedHtml className="tl-map" html={COURSE_MAP_HTML} mount={mountCourseMap}
        opts={{ done: pr.done, loggedIn: auth.state === "in" }} onGo={go} mountKey={`${pr.done}/${auth.state}`} />;
    }
  } else if (route.page === "lab") {
    if (!isPlayable(route.courseId, route.unitId)) {
      page = <div className="tl-app"><div className="wrap hb"><div className="greet"><div><h1>この単元は準備中です</h1><p>できた単元から順に開きます。</p></div></div>
        <div><a className="btn btn-sec" href={`#/courses/${route.courseId}`}>コースマップへもどる</a></div></div></div>;
    } else if (!route.trial && progress.state === "loading") page = <Loading />;
    else if (!route.trial && progress.state === "error") page = <LoadError onRetry={progress.reload} />;
    else {
      const saved = (progress.items || []).find(x => x.courseId === route.courseId && x.unitId === route.unitId) || null;
      page = <LabPage courseId={route.courseId} unitId={route.unitId} trial={!!route.trial} saved={saved}
        onSave={progress.save} onGo={go} onTrialProgress={setTrialSnap} />;
    }
  } else {
    page = <MountedHtml className="tl-lp" html={LANDING_HTML} mount={mountLanding}
      opts={{ loggedIn: auth.state === "in" }} onGo={go} mountKey={auth.state} />;
  }

  return (
    <>
      {page}
      <div className="tl-app">
        {modal === "trialClear" && (
          <div className="modal" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
            <div className="mo" role="dialog" aria-modal="true" aria-labelledby="tlClearT">
              <button className="mo-x" type="button" aria-label="閉じる" onClick={() => setModal(null)}>×</button>
              <div className="mo-in">
                <h2 id="tlClearT"><span className="mk">単元2 クリア！</span></h2>
                <p>配列・ループ・平均・最高点まで、自分の手で動かしました。ログインすると、ここからの記録と書いたコードが残り、単元3へ進めます。</p>
                <ul className="mo-list"><li>書いたコードが保存されます</li><li>コースマップのアプリに、今回の4行が加わります</li><li>次は「関数にまとめる」（約20分）</li></ul>
                <div className="mo-a">
                  <button className="btn btn-pri" type="button" onClick={() => { setPendingClear(true); go("login"); }}>ログインして続ける</button>
                  <button className="lnk" type="button" onClick={() => setModal(null)}>あとで</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </>
  );
}

function Loading() {
  return <div className="tl-app"><div className="wrap"><p className="wk-note" role="status" style={{ padding: "40px 0" }}>記録を読み込んでいます…</p></div></div>;
}

function LoadError({ onRetry }) {
  return (
    <div className="tl-app"><div className="wrap hb">
      <div className="info" role="alert">記録を読み込めませんでした。通信状況を確かめて、もう一度読み込んでください。進み具合は消えていません。</div>
      <div><button className="btn btn-sec" type="button" onClick={onRetry}>もう一度読み込む</button></div>
    </div></div>
  );
}
