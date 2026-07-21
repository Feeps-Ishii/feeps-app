import React, { lazy, Suspense, useEffect, useState } from "react";
import {
  DevLabHome,
  ProjectCatalog,
  ProjectDetail,
  ProjectManager,
} from "./DevLabComponents.jsx";
import { PageLoading } from "../../components/common";

// ワークスペース（プロジェクト体験）はSandpackを直接importする唯一のファイルで、
// バンドルサイズが大きいためlazy importで分離する(docs/decisions/0011参照)。
// 学習ホーム/案件一覧/案件管理のchunkにSandpackを含めないための境界。
const WorkspaceCatalog = lazy(() => import("./DevLabWorkspaceComponents.jsx").then(m => ({ default: m.WorkspaceCatalog })));
const WorkspaceDetail = lazy(() => import("./DevLabWorkspaceComponents.jsx").then(m => ({ default: m.WorkspaceDetail })));

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
  const [activeTemplateId, setActiveTemplateId] = useState("");

  // 案件一覧・ワークスペース一覧以外へ移動したら選択状態をリセットする（サイドナビを
  // 経由して戻った際に、常にカタログから始まるようにするため）。
  useEffect(() => {
    if (subView !== "dl_projects") setActiveProjectId("");
    if (subView !== "dl_workspace") setActiveTemplateId("");
  }, [subView]);

  const screens = {
    dl_home: <DevLabHome role={role} themeColor={themeColor} goSub={goSub} />,
    dl_projects: activeProjectId
      ? <ProjectDetail role={role} projectId={activeProjectId} onBack={() => setActiveProjectId("")} />
      : <ProjectCatalog role={role} onOpenProject={setActiveProjectId} />,
    dl_manage: <ProjectManager role={role} />,
    dl_workspace: (
      <Suspense fallback={<PageLoading label="ワークスペースを準備しています…" />}>
        {activeTemplateId
          ? <WorkspaceDetail templateId={activeTemplateId} onBack={() => setActiveTemplateId("")} />
          : <WorkspaceCatalog onOpenTemplate={setActiveTemplateId} />}
      </Suspense>
    ),
  };
  return screens[subView] || screens.dl_home;
}
