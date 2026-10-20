import React, { useEffect, useState } from "react";
import TrainingProduct from "../training/TrainingProduct.jsx";
import { GOALS } from "../training/TrainingCatalog.js";
import { setActiveCourseId } from "../../utils/common/courseContext.js";

/* コースの画面（2026-10-20）。コースの頭＋タブ。タブの中身は今までの画面をそのまま入れる
   （どの画面も「選んだコース」を読むので、開く前に setActiveCourseId でこのコースにしておく）。
   key にコースを入れて、コースを切り替えたら中身を読み直す */

// [key, 名前, 今までの画面の view]
export const COURSE_TABS = [
  ["today", "今日", null],
  ["report", "日報", "reports"],
  ["att", "勤怠", "attendance"],
  ["curriculum", "カリキュラム", "curriculum"],
  ["test", "テスト", "tests"],
  ["practice", "練習問題", "practice"],
  ["doc", "資料", "materials"],
  ["dev", "個人開発", "devreview"],
  ["students", "受講生", "trainees"],
  "|",
  ["announce", "お知らせ", "announcements"],
  ["teams", "チーム", "teams"],
  ["seating", "席替え", "seating"],
  ["completion", "修了レポート", "completion"],
];
const TAB_OF_VIEW = Object.fromEntries(COURSE_TABS.filter(t => Array.isArray(t) && t[2]).map(([k, , v]) => [v, k]));
TAB_OF_VIEW.home = "today";
export const tabLabel = key => (COURSE_TABS.find(t => Array.isArray(t) && t[0] === key) || [])[1] || "";

const n = v => (v == null ? "—" : v);

function CourseToday({ course, openTab }) {
  const training = course.today === "training";
  const absent = course.students != null && course.present != null ? course.students - course.present : null;
  const notSent = course.students != null && course.reports != null ? course.students - course.reports : null;
  const waiting = course.reports != null && course.commented != null ? course.reports - course.commented : null;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {!training && <div className="dhc-card dhc-sec"><span className="dhc-note">{course.today === "unknown" ? "今日が研修日か確認できませんでした。" : course.today === "setup_required" ? "日程がまだ登録されていません。カリキュラムで日程を入れてください。" : "今日は研修日ではありません。"}</span></div>}
      <div className="dhc-g4">
        <button type="button" className={`dhc-td${absent ? " warn" : ""}`} onClick={() => openTab("att")}>
          <span>出席</span><b>{n(course.present)}<small style={{ fontSize: 14 }}> / {n(course.students)}</small></b>
          <small>{absent ? `まだ来ていない ${absent} 人` : training ? "全員そろっています" : "今日は研修なし"}</small><em>勤怠を開く →</em>
        </button>
        <button type="button" className={`dhc-td${notSent ? " warn" : ""}`} onClick={() => openTab("report")}>
          <span>日報</span><b>{n(course.reports)}<small style={{ fontSize: 14 }}> / {n(course.students)}</small></b>
          <small>{notSent ? `まだの人 ${notSent} 人` : "提出された日報"}</small><em>日報を開く →</em>
        </button>
        <button type="button" className={`dhc-td${waiting ? " warn" : ""}`} onClick={() => openTab("report")}>
          <span>コメント待ち</span><b>{n(waiting)}</b><small>日報にまだコメントしていない</small><em>コメントする →</em>
        </button>
        <button type="button" className="dhc-td" onClick={() => openTab("curriculum")}>
          <span>今日の単元</span><b style={{ fontSize: 16, lineHeight: 1.4, marginTop: 6 }}>{course.todayCurriculum?.title || "—"}</b>
          <small>カリキュラムの今日</small><em>カリキュラムを開く →</em>
        </button>
      </div>
      {course.issues.length > 0 && (
        <div className="dhc-card dhc-sec">
          <h3>直しておくこと</h3>
          {course.issues.map(is => (
            <div key={is.code} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span className={`dhc-pill ${is.severity === "critical" ? "bad" : "warn"}`}>{is.label}</span>
              <span className="dhc-note">{is.detail}</span>
              <button type="button" className="dhc-lnk" style={{ marginLeft: "auto" }} onClick={() => openTab(is.code.startsWith("schedule") ? "curriculum" : "students")}>開く →</button>
            </div>
          ))}
        </div>
      )}
      <div className="dhc-card dhc-sec">
        <h3>よく使う</h3>
        <div className="dhc-chips">
          {[["announce", "お知らせを出す"], ["test", "テストを作る"], ["practice", "練習問題を付ける"], ["doc", "資料を置く"], ["teams", "チームを作る"], ["seating", "席替え"]].map(([k, t]) => (
            <button key={k} type="button" onClick={() => openTab(k)}>{t}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ConsoleCourse({ course, tab, role, counts, openTab, onLegacy, userProfile, displayName, goProduct }) {
  const [karte, setKarte] = useState(null);
  // 中の画面が開く前に、このコースを「選んだコース」にしておく
  setActiveCourseId(course.id);
  useEffect(() => { setKarte(null); }, [course.id, tab]);
  const def = COURSE_TABS.find(t => Array.isArray(t) && t[0] === tab) || COURSE_TABS[0];
  const go = v => {
    if (TAB_OF_VIEW[v]) openTab(TAB_OF_VIEW[v]);
    else onLegacy(v);
  };
  const [taskDone, setTaskDone] = useState({});
  const [goals, setGoals] = useState(GOALS);
  return (
    <>
      <div className="dhc-chead">
        <h1><span className="dhc-dot" style={{ "--c": course.color }} />{course.name}</h1>
        <div className="meta">
          {course.company && <span>{course.company}</span>}
          {course.term && <span>{course.term}</span>}
          {course.students != null && <span>受講生 {course.students} 人</span>}
          {course.instructorNames?.length > 0 && <span>講師 {course.instructorNames.join("・")}</span>}
        </div>
      </div>
      <nav className="dhc-tabs" aria-label="コースの画面">
        {COURSE_TABS.map((t, i) => (t === "|"
          ? <span key={`g${i}`} className="grp" aria-hidden="true" />
          : <button key={t[0]} type="button" aria-current={tab === t[0]} onClick={() => openTab(t[0])}>{t[1]}{counts?.[t[0]] ? <em>{counts[t[0]]}</em> : null}</button>))}
      </nav>
      <div className="dhc-pane" key={`${course.id}-${tab}`}>
        {def[0] === "today"
          ? <CourseToday course={course} openTab={openTab} />
          : (
            <React.Suspense fallback={<div className="dhc-empty">読み込んでいます…</div>}>
              <TrainingProduct
                view={def[2]} role={role} karte={karte} setKarte={setKarte}
                go={go} goProduct={goProduct} goSub={() => {}}
                taskDone={taskDone} taskDataState="ready" onTaskRetry={() => {}} taskSaveState={{}}
                toggle={id => setTaskDone(d => ({ ...d, [id]: !d[id] }))} goals={goals} setGoals={setGoals}
                displayName={displayName} userProfile={userProfile}
              />
            </React.Suspense>
          )}
      </div>
    </>
  );
}
