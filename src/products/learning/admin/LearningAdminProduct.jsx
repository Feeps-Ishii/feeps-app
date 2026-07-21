import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Btn, Seg, T, PRODUCT_ACCENT } from "../../../components/common";
import CourseManager from "./CourseManager.jsx";
import EnrollmentManager from "./EnrollmentManager.jsx";
import LessonManager from "./LessonManager.jsx";
import MaterialManager from "./MaterialManager.jsx";
import QuizManager from "./QuizManager.jsx";
import AiCurriculumDesignerModal from "./aiDesigner/AiCurriculumDesignerModal.jsx";
import AiLessonDesigner from "./aiDesigner/AiLessonDesigner.jsx";

const VIEW_TABS = [
  { value: "courses", label: "コース管理" },
  { value: "lessons", label: "レッスン管理" },
  { value: "materials", label: "教材管理" },
  { value: "enrollments", label: "受講状況" },
  { value: "quizzes", label: "理解度・問題" },
  { value: "ai-lesson-designer", label: "Learning Studio" },
];

export default function LearningAdminProduct({ initialView = "courses", role }) {
  const [view, setView] = useState(initialView);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [designerOpen, setDesignerOpen] = useState(false);

  function openLessons(course) {
    setSelectedCourseId(course.id);
    setView("lessons");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Seg value={view} onChange={setView} options={VIEW_TABS} activeFg={PRODUCT_ACCENT.learning.deep} />
        {/* 2026-07-21 Phase3(AIコーススタジオ強化): 「AI研修デザイナー」(ai-curriculum/generate、
            course+lessons+finalTestを1回で生成)は分割生成に対応した「Learning Studio」タブへ
            機能統合したため非推奨。コード・APIは削除せず残す(既存の叩き台生成としては動作する、
            利用中の講師が居る可能性を考慮し互換のため)が、入口はここに残しつつ非推奨である旨を
            明示する。新規はLearning Studioタブの利用を案内する。 */}
        <Btn kind="ghost" size="sm" icon={Sparkles} onClick={() => setDesignerOpen(true)} title="非推奨: Learning Studioタブの利用を推奨します">
          研修概要をAI設計（非推奨）
        </Btn>
      </div>
      <p className="text-[11px]" style={{ color: T.textMuted }}>
        「研修概要をAI設計」は旧方式です。演習・総合テストまで一括生成できる「Learning Studio」タブの利用を推奨します。
      </p>
      {view === "lessons" && <LessonManager initialCourseId={selectedCourseId} />}
      {view === "materials" && <MaterialManager />}
      {view === "enrollments" && <EnrollmentManager />}
      {view === "quizzes" && <QuizManager />}
      {view === "courses" && <CourseManager onOpenLessons={openLessons} role={role} />}
      {view === "ai-lesson-designer" && <AiLessonDesigner onOpenCourseManager={() => setView("courses")} />}
      {/* Mounted only while open: the modal's useLearningAdmin() fires admin API
          fetches on mount, which would otherwise duplicate every manager's own
          fetches on each Learning-admin page view. */}
      {designerOpen && <AiCurriculumDesignerModal open onClose={() => setDesignerOpen(false)} />}
    </div>
  );
}
