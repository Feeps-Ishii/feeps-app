import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Btn, Seg, PRODUCT_ACCENT } from "../../../components/common";
import CourseManager from "./CourseManager.jsx";
import EnrollmentManager from "./EnrollmentManager.jsx";
import LessonManager from "./LessonManager.jsx";
import MaterialManager from "./MaterialManager.jsx";
import QuizManager from "./QuizManager.jsx";
import AiCurriculumDesignerModal from "./aiDesigner/AiCurriculumDesignerModal.jsx";

const VIEW_TABS = [
  { value: "courses", label: "コース管理" },
  { value: "lessons", label: "レッスン管理" },
  { value: "materials", label: "教材管理" },
  { value: "enrollments", label: "受講状況" },
  { value: "quizzes", label: "理解度・問題" },
];

export default function LearningAdminProduct() {
  const [view, setView] = useState("courses");
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
        <Btn kind="ai" size="sm" icon={Sparkles} onClick={() => setDesignerOpen(true)}>AI研修デザイナー</Btn>
      </div>
      {view === "lessons" && <LessonManager initialCourseId={selectedCourseId} />}
      {view === "materials" && <MaterialManager />}
      {view === "enrollments" && <EnrollmentManager />}
      {view === "quizzes" && <QuizManager />}
      {view === "courses" && <CourseManager onOpenLessons={openLessons} />}
      {/* Mounted only while open: the modal's useLearningAdmin() fires admin API
          fetches on mount, which would otherwise duplicate every manager's own
          fetches on each Learning-admin page view. */}
      {designerOpen && <AiCurriculumDesignerModal open onClose={() => setDesignerOpen(false)} />}
    </div>
  );
}
