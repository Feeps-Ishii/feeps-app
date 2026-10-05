import React, { useEffect, useState } from "react";
import { Back, Ic, LoadError, Loading, durationHours, durationLabel } from "./ui.jsx";
import { ElFinalTestView, ElLessonView } from "../../learning/LearningComponents.jsx";

/* コース詳細・レッスン・総合テスト（元の Feeps One のEラーニング）。
   コース詳細はモック（tenolab-course.html の course）の見た目で作り直した。
   レッスンと総合テストは元の画面部品をそのまま使う（Tailwind のクラスで書かれているため .tl-legacy で包む）。 */

const EXERCISE_KINDS = new Set(["quiz", "terminal", "selection_task", "ordering_puzzle", "fill_blank", "interactive_form", "code_run", "web_run", "aws_lab"]);
const countExercises = ls => (Array.isArray(ls?.slides) ? ls.slides : []).filter(s => EXERCISE_KINDS.has(s?.kind)).length;
const REVIEW_LABEL = { uncertain: "少し不安", need_help: "質問したい", review_later: "あとで復習する" };

function useCourseLessons(lrn, courseId) {
  useEffect(() => { if (courseId && lrn.refreshCourseLessons) lrn.refreshCourseLessons(courseId); }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps
  return { lessons: lrn.lessonsForCourse(courseId), state: lrn.lessonCatalogState(courseId) };
}

function NotAvailable({ ctx, course, premiumLocked }) {
  return (
    <>
      <Back onClick={() => ctx.back("#/courses")} />
      <div className="card flat" style={{ padding: 18, marginTop: 12 }}>
        <b>{premiumLocked ? <><Ic id="lock" /> {course?.title || "このコース"}はPremiumプランで利用できます</> : "このコースは見つかりませんでした"}</b>
      </div>
    </>
  );
}

export function CourseDetail({ ctx, courseId }) {
  const { lrn, courses, cases, go, back, topics } = ctx;
  const model = courses.find(c => c.id === courseId);
  const course = lrn.courseById(courseId);
  const { lessons, state } = useCourseLessons(lrn, courseId);
  const [summary, setSummary] = useState(null);
  const finalTestEnabled = course?.finalTestEnabled !== false;
  useEffect(() => {
    if (!course || model?.locked) return undefined;
    if (!finalTestEnabled) { setSummary({ enabled: false, available: false }); return undefined; }
    let alive = true;
    lrn.fetchFinalTestSummary(courseId).then(r => { if (alive) setSummary(r); }).catch(() => { if (alive) setSummary(null); });
    return () => { alive = false; };
  }, [courseId, finalTestEnabled, !!course]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!course) return lrn.courseCatalogState === "loading" ? <Loading /> : <NotAvailable ctx={ctx} />;
  if (model?.locked) return <NotAvailable ctx={ctx} course={course} premiumLocked />;
  const topic = topics.find(t => t.id === course.topic) || model?.topicObj;
  const done = lrn.getLessonsDone(courseId);
  const st = lrn.getCourseState(courseId);
  const isCompleted = st.status === "completed";
  const doneCnt = lessons.filter(l => done[l.id]?.completed).length;
  const next = lessons.find(l => !done[l.id]?.completed);
  const pct = isCompleted ? 100 : (st.progress ?? 0);
  const exerciseCount = lessons.reduce((a, l) => a + countExercises(l), 0);
  const totalMin = Math.round(durationHours(course.duration) * 60);
  const remain = Math.max(0, lessons.length - doneCnt);
  const remainMin = lessons.length && totalMin ? Math.round((totalMin / lessons.length) * remain) : 0;
  const caseNext = cases.find(x => x.needCourseId === courseId);
  const canTest = finalTestEnabled && summary?.available && st.readyForFinalTest;
  const reviewItems = lrn.getCourseReviewItems(courseId);
  const latest = finalTestEnabled ? lrn.getLatestFinalTestResult(courseId) : null;

  const openLesson = ls => { lrn.startCourse(courseId); lrn.touchLesson(courseId, ls.id); go(`#/courses/${courseId}/lessons/${ls.id}`); };
  let primary = null, hint = "";
  if (!lessons.length) primary = null;
  else if (isCompleted) primary = { label: "もう一度見る", onClick: () => openLesson(lessons[0]) };
  else if (canTest) { primary = { label: st.status === "final_test_failed" ? "総合テストに再挑戦" : "総合テストを受ける", onClick: () => go(`#/courses/${courseId}/test`) }; hint = `${summary.questionCount}問 ・ ${summary.passLine}点で合格`; }
  else if (next) { primary = { label: lrn.progress?.[courseId]?.status ? "続きから学習する" : "受講を開始する", onClick: () => openLesson(next) }; hint = `次は ${next.title}`; }

  return (
    <>
      <Back onClick={() => back("#/courses")} />
      <section className="hero" style={{ borderTopColor: topic?.color }}>
        <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}>
            {topic && <span className="htag">{topic.name}</span>}
            {course.level && <span className="htag">{course.level}</span>}
            {course.official && <span className="htag">テノラボ公式</span>}
            {exerciseCount > 0 && <span className="htag on">演習あり</span>}
            {finalTestEnabled && summary?.available && <span className="htag on">総合テストあり</span>}
            {caseNext && <span className="htag on"><Ic id="case" />案件体験あり</span>}
          </div>
          <h1 className="h1">{course.title}</h1>
          {course.desc && <p style={{ margin: 0, maxWidth: "56ch", color: "var(--ink)" }}>{course.desc}</p>}
          <div className="row" style={{ gap: 6 }}>
            {course.duration && <span className="hfact"><small>学習時間</small>{durationLabel(course.duration)}</span>}
            <span className="hfact"><small>レッスン</small>{lessons.length || course.lessons || 0}本</span>
            {exerciseCount > 0 && <span className="hfact"><small>演習</small>{exerciseCount}問</span>}
            {finalTestEnabled && summary?.available && <span className="hfact"><small>総合テスト</small>{summary.questionCount}問 / {summary.passLine}点で合格</span>}
          </div>
          {Array.isArray(course.skills) && course.skills.length > 0 && (
            <div style={{ borderTop: "1.5px dashed var(--ink)", paddingTop: 12, display: "grid", gap: 8 }}>
              <b style={{ fontSize: 12, letterSpacing: ".05em" }}>修了すると身につくスキル</b>
              <div className="row" style={{ gap: 6 }}>{course.skills.map(s => <span key={s} className="skill"><Ic id="check" />{s}</span>)}</div>
            </div>
          )}
        </div>
        <div className="ppanel">
          <div className="pct num">{pct}%</div>
          <div style={{ fontWeight: 700, marginTop: 6 }}>{doneCnt} / {lessons.length} レッスン完了</div>
          <div className="muted" style={{ fontSize: 12 }}>{isCompleted ? "すべて完了しました" : remain ? `残り${remain}本${remainMin ? ` ・ 約${remainMin}分` : ""}` : ""}</div>
          <div className="ticks">{lessons.map(l => <i key={l.id} className={done[l.id]?.completed ? "on" : ""} />)}</div>
          {primary && <button className="btn" type="button" onClick={primary.onClick} style={{ width: "100%", justifyContent: "center", marginTop: 16 }}><Ic id="play" />{primary.label}</button>}
          {hint && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{hint}</div>}
        </div>
      </section>

      {caseNext && (
        <section className="card flat" style={{ marginTop: 18, padding: "16px 18px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 14, alignItems: "center", background: "var(--marker-soft)", borderColor: "var(--marker-deep)" }}>
          <span className="chip case" style={{ padding: "6px 12px" }}><Ic id="case" />案件体験</span>
          <div><b>修了すると「{caseNext.title}」に進めます</b><div className="muted" style={{ fontSize: 13 }}>実際の案件をもとにした課題{finalTestEnabled ? " ・ 総合テストに合格すると開きます" : ""}</div></div>
          <button className="btn ghost" type="button" onClick={() => go(`#/cases/${caseNext.id}`)}>詳細を見る</button>
        </section>
      )}

      <section className="card flat" style={{ marginTop: 18, padding: 18 }}>
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>レッスン一覧</h2>
        {state === "loading" && !lessons.length ? <Loading what="レッスンを読み込んでいます…" />
          : state === "error" && !lessons.length ? <LoadError onRetry={() => lrn.refreshCourseLessons(courseId)} what="レッスンを読み込めませんでした" />
            : !lessons.length ? <p className="muted">レッスンはまだ登録されていません。</p>
              : (
                <div style={{ display: "grid", gap: 8 }}>
                  {lessons.map((ls, i) => {
                    const d = !!done[ls.id]?.completed, now = !d && next?.id === ls.id && !isCompleted;
                    const rv = lrn.getLessonReview(courseId, ls.id);
                    const slides = Array.isArray(ls.slides) ? ls.slides.length : 0, ex = countExercises(ls);
                    return (
                      <button key={ls.id} type="button" className={`lrow ${d ? "done" : now ? "now" : ""}`} onClick={() => openLesson(ls)}>
                        <span className="n">{d ? <Ic id="check" /> : now ? <Ic id="play" /> : i + 1}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span className="row" style={{ gap: 6 }}>
                            <b style={{ fontWeight: now ? 700 : 500, color: d ? "var(--muted)" : "var(--ink)" }}>{ls.title}</b>
                            <span className="badge" style={{ color: d ? "var(--mint)" : now ? "var(--ink)" : "var(--muted)" }}>{d ? "完了" : now ? "学習中" : "未受講"}</span>
                            {REVIEW_LABEL[rv?.status] && !rv?.reviewed && <span className="badge" style={{ color: "#B07C00" }}>{REVIEW_LABEL[rv.status]}</span>}
                            {rv?.reviewed && <span className="badge" style={{ color: "var(--mint)" }}>復習済み</span>}
                          </span>
                          <span className="muted" style={{ fontSize: 12 }}>{[slides ? `スライド ${slides}枚` : ls.duration, ex ? `演習 ${ex}問` : ""].filter(Boolean).join(" ・ ") || ls.summary}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
      </section>

      {reviewItems.length > 0 && (
        <section className="card flat" style={{ marginTop: 18, padding: 18, display: "grid", gap: 10 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16 }}>復習した方がいいレッスン</h2>
          {reviewItems.map(r => {
            const i = lessons.findIndex(l => l.id === r.lessonId), ls = lessons[i];
            if (!ls) return null;
            return (
              <div key={r.lessonId} className="lrow" style={{ cursor: "default" }}>
                <span className="n">{i + 1}</span>
                <span style={{ flex: 1 }}><b style={{ fontWeight: 500 }}>{ls.title}</b><div className="muted" style={{ fontSize: 12 }}>「{REVIEW_LABEL[r.status] || "あとで復習する"}」を付けました</div></span>
                <button className="btn ghost" type="button" onClick={() => openLesson(ls)} style={{ padding: "4px 12px" }}>見直す</button>
                <button className="btn ghost" type="button" onClick={() => lrn.markLessonReviewed(courseId, r.lessonId)} style={{ padding: "4px 12px" }}>復習した</button>
              </div>
            );
          })}
        </section>
      )}

      {latest && (
        <section className="card flat" style={{ marginTop: 18, padding: 18, display: "grid", gap: 8 }}>
          <div className="row"><h2 style={{ fontWeight: 700, fontSize: 16 }}>総合テストの結果</h2><span className={`chip ${latest.passed ? "done" : ""}`}>{latest.passed ? <><Ic id="check" />合格</> : "不合格"}</span><span className="num muted" style={{ marginLeft: "auto" }}>{latest.score}点</span></div>
          <button className="btn ghost" type="button" onClick={() => go(`#/courses/${courseId}/result`)} style={{ justifySelf: "start" }}>結果を見る</button>
        </section>
      )}
    </>
  );
}

/* レッスン（元の画面部品） */
export function LessonPage({ ctx, courseId, lessonId, slideId }) {
  const { lrn, courses, go } = ctx;
  const model = courses.find(c => c.id === courseId);
  const course = lrn.courseById(courseId);
  const { lessons, state } = useCourseLessons(lrn, courseId);
  if (!course) return lrn.courseCatalogState === "loading" ? <Loading /> : <NotAvailable ctx={ctx} />;
  if (model?.locked) return <NotAvailable ctx={ctx} course={course} premiumLocked />;
  const lesson = lessons.find(l => l.id === lessonId);
  if (!lesson) {
    if (state === "loading") return <Loading what="レッスンを読み込んでいます…" />;
    return <><Back onClick={() => go(`#/courses/${courseId}`)}>← コース詳細へ</Back><LoadError onRetry={() => lrn.refreshCourseLessons(courseId)} what="レッスンを読み込めませんでした" /></>;
  }
  return (
    <div className="tl-legacy">
      <ElLessonView course={course} lesson={lesson} lrn={lrn} lessons={lessons} initialSlideId={slideId || null}
        onBack={() => go(`#/courses/${courseId}`)}
        onNavigate={(ls, sid) => { lrn.touchLesson(courseId, ls.id); go(`#/courses/${courseId}/lessons/${ls.id}${sid ? `/${sid}` : ""}`); }}
        onComplete={(cid, lid) => lrn.completeLesson(cid, lid)} />
    </div>
  );
}

/* 総合テスト（元の画面部品） */
export function FinalTestPage({ ctx, courseId, mode }) {
  const { lrn, courses, go } = ctx;
  const model = courses.find(c => c.id === courseId);
  const course = lrn.courseById(courseId);
  const { lessons } = useCourseLessons(lrn, courseId);
  if (!course) return lrn.courseCatalogState === "loading" ? <Loading /> : <NotAvailable ctx={ctx} />;
  if (model?.locked) return <NotAvailable ctx={ctx} course={course} premiumLocked />;
  return (
    <div className="tl-legacy">
      <ElFinalTestView course={course} lrn={lrn} lessons={lessons} initialMode={mode}
        onModeChange={m => go(`#/courses/${courseId}/${m === "result" ? "result" : "test"}`)}
        onBack={() => go(`#/courses/${courseId}`)}
        onOpenLesson={ls => go(`#/courses/${courseId}/lessons/${ls.id}`)} />
    </div>
  );
}
