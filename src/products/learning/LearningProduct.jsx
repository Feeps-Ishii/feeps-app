import React, { useEffect, useState } from "react";
import { useLearning } from "./useLearning.js";
import {
  LearningPlaceholder,
  LearningOverview,
  ElCourseView,
  ElInProgressView,
  ElCompletedView,
  ElRecommendView,
  ElSkillsView,
  ElCertificateView,
  ElCompletionModal,
  ElCourseDetail,
  ElFinalTestView,
  ElLessonView,
} from "./LearningComponents.jsx";
import LearningAdminProduct from "./admin/LearningAdminProduct.jsx";
import EnrollmentManager from "./admin/EnrollmentManager.jsx";
import { setProductDetailHistory } from "../../utils/common/navigationHistory.js";

export default function LearningProduct({ subView, goSub, goProduct, role, themeColor, navigationTarget }) {
  const lrn = useLearning(role);
  const [completionCourse, setCompletionCourse] = useState(null);
  const [activeCourse, setActiveCourse] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  // 2026-07-21 監査P1(T-4)対応: 「復習が必要な演習」からの直接ジャンプ先スライドを保持する
  const [activeSlideId, setActiveSlideId] = useState(null);
  const [activeFinalTestMode, setActiveFinalTestMode] = useState(null);
  useEffect(() => { setActiveCourse(null); setActiveLesson(null); setActiveSlideId(null); setActiveFinalTestMode(null); }, [subView]);
  const historyCourse = navigationTarget?.kind === "learning" ? lrn.courseById(navigationTarget.courseId) : null;
  const historyLesson = historyCourse && navigationTarget?.lessonId
    ? lrn.lessonsForCourse(historyCourse.id).find(lesson => lesson.id === navigationTarget.lessonId) || null
    : null;
  const historyLessonState = historyCourse ? lrn.lessonCatalogState(historyCourse.id) : "loading";
  const historyFinalResult = historyCourse ? lrn.getLatestFinalTestResult(historyCourse.id) : null;
  useEffect(() => {
    if (!navigationTarget || navigationTarget.kind !== "learning") return;
    if (!historyCourse) {
      if (lrn.courseCatalogState !== "ready") return;
      setProductDetailHistory(null, { historyAction: "replace" });
      setActiveCourse(null); setActiveLesson(null); setActiveSlideId(null); setActiveFinalTestMode(null);
      return;
    }
    if (navigationTarget.lessonId && !historyLesson) {
      if (historyLessonState !== "ready") return;
      setProductDetailHistory({ kind: "learning", courseId: historyCourse.id }, { historyAction: "replace" });
      setActiveCourse(historyCourse); setActiveLesson(null); setActiveSlideId(null); setActiveFinalTestMode(null);
      return;
    }
    if (navigationTarget.mode && historyLessonState !== "ready") return;
    if (navigationTarget.mode === "result" && !historyFinalResult) {
      if (lrn.finalTestResultsState !== "ready") return;
      setProductDetailHistory({ kind: "learning", courseId: historyCourse.id }, { historyAction: "replace" });
      setActiveCourse(historyCourse); setActiveLesson(null); setActiveSlideId(null); setActiveFinalTestMode(null);
      return;
    }
    setActiveCourse(historyCourse);
    setActiveLesson(historyLesson);
    setActiveFinalTestMode(historyLesson ? null : navigationTarget.mode || null);
  }, [navigationTarget?.kind, navigationTarget?.courseId, navigationTarget?.lessonId, navigationTarget?.mode, historyCourse?.id, historyLesson?.id, historyLessonState, historyFinalResult?.id, lrn.courseCatalogState, lrn.finalTestResultsState]);
  function handleStart(courseId) { lrn.startCourse(courseId); }
  function handleComplete(course) { handleOpenDetail(course); }
  function handleOpenDetail(course) {
    setProductDetailHistory({ kind: "learning", courseId: course.id });
    setActiveCourse(course); setActiveLesson(null); setActiveSlideId(null); setActiveFinalTestMode(null);
  }
  function handleOpenLesson(lesson, slideId) {
    if (activeCourse && lesson?.id) lrn.touchLesson(activeCourse.id, lesson.id);
    if (activeCourse && lesson?.id) setProductDetailHistory({ kind: "learning", courseId: activeCourse.id, lessonId: lesson.id });
    setActiveLesson(lesson);
    setActiveSlideId(slideId || null);
    setActiveFinalTestMode(null);
  }
  function handleBackToDetail() { window.history.back(); }
  function handleBackToList() { window.history.back(); }
  function handleStartFinalTest() {
    if (activeCourse) setProductDetailHistory({ kind: "learning", courseId: activeCourse.id, mode: "test" });
    setActiveLesson(null); setActiveFinalTestMode("test");
  }
  function handleShowFinalResult() {
    if (activeCourse) setProductDetailHistory({ kind: "learning", courseId: activeCourse.id, mode: "result" });
    setActiveLesson(null); setActiveFinalTestMode("result");
  }
  function handleFinalTestModeChange(mode) {
    if (!activeCourse || !["test", "result"].includes(mode)) return;
    setProductDetailHistory({ kind: "learning", courseId: activeCourse.id, mode }, { historyAction: "replace" });
    setActiveFinalTestMode(mode);
  }
  function handleLessonComplete(courseId, lessonId) {
    lrn.completeLesson(courseId, lessonId);
  }
  const modal = completionCourse && (
    <ElCompletionModal course={completionCourse} onClose={() => setCompletionCourse(null)}
      onGoTalent={() => { setCompletionCourse(null); goProduct && goProduct("talent"); }} />
  );
  if (navigationTarget?.kind === "learning" && !historyCourse && lrn.courseCatalogState === "loading") {
    return <LearningPlaceholder title="コースを読み込んでいます" desc="前回開いていたコースを確認しています。" />;
  }
  if (navigationTarget?.kind === "learning" && !historyCourse && lrn.courseCatalogState === "error") {
    return <LearningPlaceholder title="コースを確認できません" desc="通信状況を確認して、ブラウザを更新してください。現在地は保持されています。" />;
  }
  if (navigationTarget?.lessonId && historyCourse && !historyLesson && historyLessonState === "loading") {
    return <LearningPlaceholder title="レッスンを読み込んでいます" desc="前回開いていたレッスンを確認しています。" />;
  }
  if (navigationTarget?.lessonId && historyCourse && !historyLesson && historyLessonState === "error") {
    return <LearningPlaceholder title="レッスンを確認できません" desc="通信状況を確認して、ブラウザを更新してください。現在地は保持されています。" />;
  }
  if (navigationTarget?.mode && historyCourse && historyLessonState === "loading") {
    return <LearningPlaceholder title="総合テストを読み込んでいます" desc="問題と復習情報を確認しています。" />;
  }
  if (navigationTarget?.mode && historyCourse && historyLessonState === "error") {
    return <LearningPlaceholder title="総合テストを確認できません" desc="通信状況を確認して、ブラウザを更新してください。現在地は保持されています。" />;
  }
  if (navigationTarget?.mode === "result" && historyCourse && !historyFinalResult && lrn.finalTestResultsState === "loading") {
    return <LearningPlaceholder title="テスト結果を読み込んでいます" desc="前回の採点結果を確認しています。" />;
  }
  if (navigationTarget?.mode === "result" && historyCourse && !historyFinalResult && lrn.finalTestResultsState === "error") {
    return <LearningPlaceholder title="テスト結果を確認できません" desc="通信状況を確認して、ブラウザを更新してください。現在地は保持されています。" />;
  }
  if (navigationTarget?.mode === "result" && historyCourse && !historyFinalResult) {
    return <LearningPlaceholder title="保存済みのテスト結果がありません" desc="コース詳細へ戻ります。" />;
  }
  if (activeCourse && activeLesson) {
    return (
      <>
        <ElLessonView course={activeCourse} lesson={activeLesson} lrn={lrn}
          lessons={lrn.lessonsForCourse(activeCourse.id)}
          onBack={handleBackToDetail} onNavigate={handleOpenLesson} onComplete={handleLessonComplete}
          initialSlideId={activeSlideId} />
        {modal}
      </>
    );
  }
  if (activeCourse && activeFinalTestMode) {
    return (
      <>
        <ElFinalTestView course={activeCourse} lrn={lrn}
          lessons={lrn.lessonsForCourse(activeCourse.id)}
          initialMode={activeFinalTestMode}
          onModeChange={handleFinalTestModeChange}
          onBack={handleBackToDetail}
          onOpenLesson={handleOpenLesson} />
        {modal}
      </>
    );
  }
  if (activeCourse) {
    return (
      <>
        <ElCourseDetail course={activeCourse} lrn={lrn} onBack={handleBackToList}
          onOpenLesson={handleOpenLesson}
          onStartFinalTest={handleStartFinalTest}
          onShowFinalResult={handleShowFinalResult}
          themeColor={themeColor} />
        {modal}
      </>
    );
  }
  const sp = { lrn, goSub, goProduct, role, themeColor, onStart: handleStart, onComplete: handleComplete, onOpenDetail: handleOpenDetail };
  const sub = {
    el_home:       <LearningOverview {...sp} />,
    el_courses:    <ElCourseView     {...sp} />,
    el_recommend:  <ElRecommendView  {...sp} />,
    el_inprogress: <ElInProgressView {...sp} />,
    el_completed:  <ElCompletedView  {...sp} />,
    el_skills:     <ElSkillsView     {...sp} />,
    el_cert:       <ElCertificateView {...sp} />,
    el_manage:     role === "admin" || role === "instructor"
      ? <LearningAdminProduct role={role} />
      : <LearningPlaceholder title="コース管理"  desc="Eラーニングコースを作成・編集・公開できます。" />,
    el_students:   role === "admin" || role === "instructor"
      ? <EnrollmentManager />
      : <LearningPlaceholder title="受講状況"   desc="受講生の進捗と完了状況を確認できます。" />,
  };
  return (
    <>
      {sub[subView] || sub.el_home}
      {modal}
    </>
  );
}
