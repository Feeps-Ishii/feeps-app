import React, { lazy, Suspense, useEffect, useState } from "react";
import {
  DevLabHome,
  DevLabCombinedCatalog,
  ProjectDetail,
  ProjectManager,
} from "./DevLabComponents.jsx";
import { PageLoading } from "../../components/common";

// ワークスペース（プロジェクト体験）はSandpackを直接importする唯一のファイルで、
// バンドルサイズが大きいためlazy importで分離する(docs/decisions/0011参照)。
// 学習ホーム/開発演習カタログ/案件管理のchunkにSandpackを含めないための境界。
// DevLabCombinedCatalogはSandpackを持たないuseDevLabWorkspaceTemplatesのみ使うため、
// この境界を崩さずに"dl_projects"(統合カタログ)側へ持ち込める。
const WorkspaceCatalog = lazy(() => import("./DevLabWorkspaceComponents.jsx").then(m => ({ default: m.WorkspaceCatalog })));
const WorkspaceDetail = lazy(() => import("./DevLabWorkspaceComponents.jsx").then(m => ({ default: m.WorkspaceDetail })));

// 対象ロールはtrainee/instructor/adminのみ（clientはTrainingApp.jsxのPRODUCTS.rolesで
// 既に到達不可。ここでも二重に防御する。GrantsProductと同じパターン）。
export default function DevLabProduct({ subView, goSub, role, themeColor }) {
  if (role !== "trainee" && role !== "instructor" && role !== "admin") return null;

  // 案件一覧・ワークスペース詳細への遷移は、別のsubViewキーを発行せず"dl_projects"のまま
  // activeProjectId/activeTemplateIdで一覧/詳細を切り替える（MatchingProductの
  // activeProjectId＋ProjectMatchingパターンと同じ）。TrainingApp.jsxはnavに存在しない
  // subViewを検知すると自動でPRODUCT_DEFAULT_SUBVIEWへ戻す仕組みがあり、EL_NAVに無いキー
  // へgoSubすると即座にホームへ戻されてしまうため。
  // 2026-07-22: 受講生ナビの「案件一覧」「プロジェクト体験」を1項目(dl_projects)へ統合。
  // DevLabCombinedCatalog(案件+ワークスペースを1画面に並べる)からどちらを開いても
  // subViewは"dl_projects"のままactiveProjectId/activeTemplateIdだけで詳細を出し分ける。
  // instructor/adminは従来通り"dl_workspace"を専用ナビ項目として維持しているため、
  // そちらの状態遷移も両立させる必要がある。
  const [activeProjectId, setActiveProjectId] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState("");

  // カタログ系(dl_projects/dl_workspace)以外へ移動したら選択状態をリセットする（サイドナビを
  // 経由して戻った際に、常にカタログから始まるようにするため）。
  useEffect(() => {
    if (subView !== "dl_projects") setActiveProjectId("");
    if (subView !== "dl_projects" && subView !== "dl_workspace") setActiveTemplateId("");
  }, [subView]);

  const screens = {
    dl_home: <DevLabHome role={role} themeColor={themeColor} goSub={goSub} />,
    dl_projects: activeProjectId
      ? <ProjectDetail role={role} projectId={activeProjectId} onBack={() => setActiveProjectId("")} />
      : activeTemplateId
        ? (
          <Suspense fallback={<PageLoading label="ワークスペースを準備しています…" />}>
            <WorkspaceDetail templateId={activeTemplateId} onBack={() => setActiveTemplateId("")} />
          </Suspense>
        )
        : <DevLabCombinedCatalog role={role} onOpenProject={setActiveProjectId} onOpenTemplate={setActiveTemplateId} />,
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
