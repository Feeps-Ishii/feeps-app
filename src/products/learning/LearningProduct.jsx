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
export default function LearningProduct({ subView, goSub, goProduct, role, themeColor }) {
  const lrn = useLearning(role);
  const [completionCourse, setCompletionCourse] = useState(null);
  const [activeCourse, setActiveCourse] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [activeFinalTestMode, setActiveFinalTestMode] = useState(null);
  useEffect(() => { setActiveCourse(null); setActiveLesson(null); setActiveFinalTestMode(null); }, [subView]);
  function handleStart(courseId) { lrn.startCourse(courseId); }
  function handleComplete(course) { handleOpenDetail(course); }
  function handleOpenDetail(course) { setActiveCourse(course); setActiveLesson(null); setActiveFinalTestMode(null); }
  function handleOpenLesson(lesson) {
    if (activeCourse && lesson?.id) lrn.touchLesson(activeCourse.id, lesson.id);
    setActiveLesson(lesson);
    setActiveFinalTestMode(null);
  }
  function handleBackToDetail() { setActiveLesson(null); setActiveFinalTestMode(null); }
  function handleBackToList() { setActiveCourse(null); setActiveLesson(null); setActiveFinalTestMode(null); }
  function handleStartFinalTest() { setActiveLesson(null); setActiveFinalTestMode("test"); }
  function handleShowFinalResult() { setActiveLesson(null); setActiveFinalTestMode("result"); }
  function handleLessonComplete(courseId, lessonId) {
    lrn.completeLesson(courseId, lessonId);
  }
  const modal = completionCourse && (
    <ElCompletionModal course={completionCourse} onClose={() => setCompletionCourse(null)}
      onGoTalent={() => { setCompletionCourse(null); goProduct && goProduct("talent"); }} />
  );
  if (activeCourse && activeLesson) {
    return (
      <>
        <ElLessonView course={activeCourse} lesson={activeLesson} lrn={lrn}
          lessons={lrn.lessonsForCourse(activeCourse.id)}
          onBack={handleBackToDetail} onNavigate={handleOpenLesson} onComplete={handleLessonComplete} />
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
      ? <LearningAdminProduct initialView="courses" />
      : <LearningPlaceholder title="コース管理"  desc="Eラーニングコースを作成・編集・公開できます。" />,
    el_lessons:    role === "admin" || role === "instructor"
      ? <LearningAdminProduct initialView="lessons" />
      : <LearningPlaceholder title="レッスン管理" desc="コースのレッスンと教材を管理できます。" />,
    el_students:   role === "admin" || role === "instructor"
      ? <LearningAdminProduct initialView="enrollments" />
      : <LearningPlaceholder title="受講状況"   desc="受講生の進捗と完了状況を確認できます。" />,
  };
  return (
    <>
      {sub[subView] || sub.el_home}
      {modal}
    </>
  );
}
