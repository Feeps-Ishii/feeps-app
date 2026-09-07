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
  ElCompletionModal,
  ElCourseDetail,
  ElFinalTestView,
  ElLessonView,
} from "./LearningComponents.jsx";
import ElCoursesHub from "./ElCoursesHub.jsx";
import LearningAdminProduct from "./admin/LearningAdminProduct.jsx";
import EnrollmentManager from "./admin/EnrollmentManager.jsx";
import PlansContractsAdmin from "./admin/PlansContractsAdmin.jsx";
import SeatManager from "./admin/SeatManager.jsx";
import DevLabProduct from "../devlab/DevLabProduct.jsx";
// クラウド実習（2026-09-07）。学習モードの3本目の柱。実体は products/cloudlab/
import CloudLabProduct from "../cloudlab/CloudLabProduct.jsx";
import RoadmapView from "./roadmap/RoadmapView.jsx";
import { setProductDetailHistory } from "../../utils/common/navigationHistory.js";

// 2026-07-22: 開発演習(DevLab)は独立Productを廃止し、Eラーニングと並ぶ「学習」内の
// もう1本の柱として統合（ファイルはproducts/devlab/に残置、DevLabProduct自体の
// role guardも維持しつつLearning側でも二重に制御する）。
const DEVLAB_ALLOWED_ROLES = ["trainee", "instructor", "admin"];

export default function LearningProduct({ subView, goSub, goProduct, role, themeColor, navigationTarget, learningPlan }) {
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
  // 2026-08-21 実バグ: window.history.back()だと「1つ前の画面」へ戻るだけなので、
  // レッスンを次々に進んだあとで「〇〇へ戻る」を押すと**1つ前のレッスンに戻ってしまい、
  // コースのTOPに行かなかった**。戻り先は履歴の深さではなく画面の構造で決める。
  function handleBackToDetail() {
    if (!activeCourse) { window.history.back(); return; }
    setProductDetailHistory({ kind: "learning", courseId: activeCourse.id });
    setActiveLesson(null); setActiveSlideId(null); setActiveFinalTestMode(null);
  }
  function handleBackToList() {
    setProductDetailHistory(null);
    setActiveCourse(null); setActiveLesson(null); setActiveSlideId(null); setActiveFinalTestMode(null);
  }
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
  const sp = { lrn, goSub, goProduct, role, themeColor, learningPlan, onStart: handleStart, onComplete: handleComplete, onOpenDetail: handleOpenDetail };
  const sub = {
    el_home:       <LearningOverview {...sp} />,
    // 2026-09-05: 「コース一覧／おすすめ／学習中／修了済み」を1項目＋タブへ統合した。
    // どれも同じカタログの絞り込み違いで、画面の作りも同じだったため（mock/learning-inventory）。
    // 旧キーはナビから消えたが、履歴・古いリンクから来たときのために対応するタブで開く。
    el_courses:    <ElCoursesHub initialTab="all"        {...sp} />,
    el_recommend:  <ElCoursesHub initialTab="recommend"  {...sp} />,
    el_inprogress: <ElCoursesHub initialTab="inprogress" {...sp} />,
    el_completed:  <ElCoursesHub initialTab="completed"  {...sp} />,
    // 2026-09-08: 目標との差分を出す画面。既に出来る人にステップを踏ませないための入口。
    // コース名で紐づけているので、開くときはカタログから同じ名前のコースを引く。
    el_roadmap:    <RoadmapView lrn={lrn} onOpenCourse={title => {
      const hit = (lrn.catalog || []).find(c => c.title === title);
      if (hit) handleOpenDetail(hit);
    }} />,
    el_skills:     <ElSkillsView {...sp} />,
    // 2026-08-21: 「修了証」タブは「修了済み」へ統合した。
    el_cert:       <ElCoursesHub initialTab="completed"  {...sp} />,
    el_manage:     role === "admin" || role === "instructor"
      ? <LearningAdminProduct role={role} />
      : <LearningPlaceholder title="コース管理"  desc="Eラーニングコースを作成・編集・公開できます。" />,
    el_students:   role === "admin" || role === "instructor"
      ? <EnrollmentManager />
      : <LearningPlaceholder title="受講状況"   desc="受講生の進捗と完了状況を確認できます。" />,
    el_plans:      role === "admin"
      ? <PlansContractsAdmin />
      : <LearningPlaceholder title="プラン・契約" desc="この機能はご利用いただけません。" />,
    // 席（スロット）課金の割り当て。企業担当者が自社社員へ席を配る（ADR 0019）
    el_seats:      role === "client"
      ? <SeatManager />
      : <LearningPlaceholder title="プラン・席の管理" desc="この機能はご利用いただけません。" />,
    // ナビに出すのはtraineeだけ。instructor/adminは中身を見に来られるようにしておく
    // （管理画面は枠が決まってから作る。docs/specs/aws-lab-spec.md §9）
    el_cloudlab:      DEVLAB_ALLOWED_ROLES.includes(role)
      ? <CloudLabProduct />
      : <LearningPlaceholder title="クラウド実習" desc="この機能はご利用いただけません。" />,
    el_devlab:        DEVLAB_ALLOWED_ROLES.includes(role)
      ? <DevLabProduct subView="dl_projects" goSub={goSub} role={role} themeColor={themeColor} />
      : <LearningPlaceholder title="開発演習" desc="この機能はご利用いただけません。" />,
    el_devlab_manage: (role === "admin" || role === "instructor")
      ? <DevLabProduct subView="dl_manage" goSub={goSub} role={role} themeColor={themeColor} />
      : <LearningPlaceholder title="案件管理" desc="この機能はご利用いただけません。" />,
    el_devlab_manage_workspace: (role === "admin" || role === "instructor")
      ? <DevLabProduct subView="dl_manage_workspace" goSub={goSub} role={role} themeColor={themeColor} />
      : <LearningPlaceholder title="プロジェクト体験管理" desc="この機能はご利用いただけません。" />,
    el_devlab_manage_team: (role === "admin" || role === "instructor")
      ? <DevLabProduct subView="dl_manage_team" goSub={goSub} role={role} themeColor={themeColor} />
      : <LearningPlaceholder title="チーム開発案件" desc="この機能はご利用いただけません。" />,
    // clientは「自社受講生の編成＋進捗閲覧」のみ。題材作成・実装は開放していない（dev-team-spec §1）
    el_devlab_teams: (role === "admin" || role === "instructor" || role === "client")
      ? <DevLabProduct subView="dl_manage_teams" goSub={goSub} role={role} themeColor={themeColor} />
      : <LearningPlaceholder title="チーム" desc="この機能はご利用いただけません。" />,
    el_devlab_myteam: DEVLAB_ALLOWED_ROLES.includes(role)
      ? <DevLabProduct subView="dl_team" goSub={goSub} role={role} themeColor={themeColor} />
      : <LearningPlaceholder title="チーム開発" desc="この機能はご利用いただけません。" />,
    el_devlab_workspace: DEVLAB_ALLOWED_ROLES.includes(role)
      ? <DevLabProduct subView="dl_workspace" goSub={goSub} role={role} themeColor={themeColor} />
      : <LearningPlaceholder title="プロジェクト体験" desc="この機能はご利用いただけません。" />,
  };
  return (
    <>
      {sub[subView] || sub.el_home}
      {modal}
    </>
  );
}
