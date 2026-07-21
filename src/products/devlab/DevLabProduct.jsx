import React, { useEffect, useState } from "react";
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

  // 案件一覧から詳細への遷移は、別のsubViewキーを発行せず"dl_projects"のまま
  // activeProjectIdで一覧/詳細を切り替える（MatchingProductのactiveProjectId＋
  // ProjectMatchingパターンと同じ）。TrainingApp.jsxはnavに存在しないsubViewを
  // 検知すると自動でPRODUCT_DEFAULT_SUBVIEWへ戻す仕組みがあり、DEVLAB_NAVに
  // 無いキー("dl_project_detail"等)へgoSubすると即座にホームへ戻されてしまうため。
  const [activeProjectId, setActiveProjectId] = useState("");

  // 案件一覧以外へ移動したら選択状態をリセットする（サイドナビ「案件一覧」を
  // 経由して戻った際に、常にカタログから始まるようにするため）。
  useEffect(() => {
    if (subView !== "dl_projects") setActiveProjectId("");
  }, [subView]);

  const screens = {
    dl_home: <DevLabHome role={role} themeColor={themeColor} goSub={goSub} />,
    dl_projects: activeProjectId
      ? <ProjectDetail role={role} projectId={activeProjectId} onBack={() => setActiveProjectId("")} />
      : <ProjectCatalog role={role} onOpenProject={setActiveProjectId} />,
    dl_manage: <ProjectManager role={role} />,
  };
  return screens[subView] || screens.dl_home;
}
