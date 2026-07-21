import React, { useState } from "react";
import {
  DevLabHome,
  ProjectCatalog,
  ProjectDetail,
  ProjectManager,
} from "./DevLabComponents.jsx";

// 対象ロールはtrainee/instructor/adminのみ（clientはTrainingApp.jsxのPRODUCTS.rolesで
// 既に到達不可。ここでも二重に防御する。GrantsProductと同じパターン）。
export default function DevLabProduct({ subView, goSub, role, themeColor }) {
  if (role !== "trainee" && role !== "instructor" && role !== "admin") return null;

  // 案件一覧から詳細へ遷移する際、選択中の案件を引き継ぐ（GrantsProductのactiveGrantIdと同じパターン）。
  const [activeProjectId, setActiveProjectId] = useState("");

  function openProject(projectId) {
    setActiveProjectId(projectId);
    goSub("dl_project_detail");
  }

  const screens = {
    dl_home: <DevLabHome role={role} themeColor={themeColor} goSub={goSub} />,
    dl_projects: <ProjectCatalog role={role} onOpenProject={openProject} />,
    dl_project_detail: <ProjectDetail role={role} projectId={activeProjectId} onBack={() => goSub("dl_projects")} />,
    dl_manage: <ProjectManager role={role} />,
  };
  return screens[subView] || screens.dl_home;
}
