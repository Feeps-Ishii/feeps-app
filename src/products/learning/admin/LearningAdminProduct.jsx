// ==========================================================================
// Eラーニング管理画面（コース中心構造、2026-07-21再編）
// 旧: コース管理/レッスン管理/教材管理/受講状況/理解度・問題/Learning Studioの6タブ構成
//     （ラベル「コース管理」の中身がLearning Studio決め打ちになっていた不整合が主因で再編）
// 新: 「コース一覧」→「コース詳細（設定/レッスン管理/教材管理/理解度・問題/受講状況）」の
//     2階層。Learning Studioはタブを廃止し、「コースを追加」の「AIに任せる」から起動する。
// コース選択IDはこのコンポーネントで一元管理し、各ManagerへfixedCourseId propとして渡す
// （各Manager個別フックはそのまま。Context化などの大規模リファクタはしない）。
// ==========================================================================
import React, { useState } from "react";
import CourseManager from "./CourseManager.jsx";
import CourseDetailView from "./CourseDetailView.jsx";
import AiLessonDesigner from "./aiDesigner/AiLessonDesigner.jsx";

export default function LearningAdminProduct({ role }) {
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [detailTab, setDetailTab] = useState("settings");
  const [studioOpen, setStudioOpen] = useState(false);

  function openCourseDetail(course, tab = "settings") {
    setSelectedCourseId(course.id);
    setDetailTab(tab);
  }
  function backToList() {
    setSelectedCourseId("");
  }
  function closeStudioToList() {
    setStudioOpen(false);
    setSelectedCourseId("");
  }

  if (studioOpen) {
    return <AiLessonDesigner onOpenCourseManager={closeStudioToList} />;
  }

  if (selectedCourseId) {
    return (
      <CourseDetailView
        courseId={selectedCourseId}
        role={role}
        activeTab={detailTab}
        onTabChange={setDetailTab}
        onBack={backToList}
      />
    );
  }

  return (
    <CourseManager
      role={role}
      onOpenLessons={(course) => openCourseDetail(course, "lessons")}
      onSelectCourse={(course) => openCourseDetail(course, "settings")}
      onOpenStudio={() => setStudioOpen(true)}
    />
  );
}
