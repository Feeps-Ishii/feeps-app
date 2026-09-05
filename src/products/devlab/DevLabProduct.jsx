import React, { lazy, Suspense, useEffect, useState } from "react";
import {
  DevLabHome,
  DevLabCombinedCatalog,
  ProjectDetail,
  MyTeamsCatalog,
} from "./DevLabComponents.jsx";
import DevLabManageHub from "./DevLabManageHub.jsx";
import { Seg, PRODUCT_ACCENT } from "../../components/common";
import { PageLoading } from "../../components/common";

// ワークスペース（プロジェクト体験）はSandpackを直接importする唯一のファイルで、
// バンドルサイズが大きいためlazy importで分離する(docs/decisions/0011参照)。
// 学習ホーム/開発演習カタログ/案件管理のchunkにSandpackを含めないための境界。
// DevLabCombinedCatalogはSandpackを持たないuseDevLabWorkspaceTemplatesのみ使うため、
// この境界を崩さずに"dl_projects"(統合カタログ)側へ持ち込める。
const WorkspaceCatalog = lazy(() => import("./DevLabWorkspaceComponents.jsx").then(m => ({ default: m.WorkspaceCatalog })));
const WorkspaceDetail = lazy(() => import("./DevLabWorkspaceComponents.jsx").then(m => ({ default: m.WorkspaceDetail })));
// チーム開発の作業画面もSandpackを使うため、同じlazy境界に載せる（2026-08-18）。
const TeamBranchWorkspace = lazy(() => import("./DevLabWorkspaceComponents.jsx").then(m => ({ default: m.TeamBranchWorkspace })));

// 対象ロールはtrainee/instructor/admin。
// clientは2026-08-19から「チーム編成＋進捗閲覧」だけ到達できる（dl_manage_teams のみ。
// 他のsubViewはここで弾く。Backendもallowlistで二重に閉じている）。
export default function DevLabProduct({ subView, goSub, role, themeColor }) {
  if (role === "client") {
    if (subView !== "dl_manage_teams") return null;
    return <DevLabManageHub role={role} initialTab="teams" />;
  }
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
  // 入口の質問から「この担当で始める」で来たときの担当（2026-09-05）
  const [initialRoleSlotId, setInitialRoleSlotId] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState("");
  // 案件詳細の「ワークスペースで作業する」から遷移した場合、ワークスペース画面からの「戻る」で
  // 案件詳細へ戻すためのprojectId(2026-07-22追加、案件×ワークスペース連携)。カタログ経由で
  // ワークスペースを開いた場合はnullのまま(=一覧へ戻る、従来通り)。
  const [workspaceReturnProjectId, setWorkspaceReturnProjectId] = useState("");
  // チーム開発（2026-08-18）: 一覧⇔作業画面をactiveTeamIdで切り替える（既存のactiveTemplateIdと同じパターン）
  const [activeTeamId, setActiveTeamId] = useState("");

  // カタログ系(dl_projects/dl_workspace)以外へ移動したら選択状態をリセットする（サイドナビを
  // 経由して戻った際に、常にカタログから始まるようにするため）。
  useEffect(() => {
    if (subView !== "dl_projects") { setActiveProjectId(""); setInitialRoleSlotId(""); }
    if (subView !== "dl_projects" && subView !== "dl_workspace") setActiveTemplateId("");
    if (subView !== "dl_projects" && subView !== "dl_workspace") setWorkspaceReturnProjectId("");
    if (subView !== "dl_team" && subView !== "dl_projects") setActiveTeamId("");
  }, [subView]);

  function openWorkspaceFromProject(projectId, templateId) {
    setWorkspaceReturnProjectId(projectId);
    setActiveProjectId("");
    setActiveTemplateId(templateId);
  }

  function backFromWorkspace() {
    if (workspaceReturnProjectId) {
      setActiveTemplateId("");
      setActiveProjectId(workspaceReturnProjectId);
      setWorkspaceReturnProjectId("");
    } else {
      setActiveTemplateId("");
    }
  }

  // 2026-09-05: 受講生のナビは「開発演習」1項目にした。ひとりでやるかチームでやるかは
  // 案件の性質であってメニューではないため、画面内のタブで切り替える。
  // 古いキー(dl_team)から来たときはチーム側のタブを開く。
  const devTab = subView === "dl_team" ? "team" : "projects";
  const [pickedTab, setPickedTab] = useState("");
  const tab = pickedTab || devTab;
  const tabbed = (body) => (
    <div>
      <div className="mb-3">
        <Seg
          value={tab}
          onChange={setPickedTab}
          options={[{ value: "projects", label: "案件・練習" }, { value: "team", label: "チーム開発" }]}
          activeFg={PRODUCT_ACCENT.learning.deep}
        />
      </div>
      {body}
    </div>
  );

  const screens = {
    dl_home: <DevLabHome role={role} themeColor={themeColor} goSub={goSub} />,
    // 案件の詳細・ワークスペース・チームの作業画面を開いているときはタブを出さない
    // （その画面の中に「戻る」があるので、上にタブが並ぶと戻り先が2つに見える）
    dl_projects: activeProjectId
      ? <ProjectDetail role={role} projectId={activeProjectId} initialRoleSlotId={initialRoleSlotId} onBack={() => { setActiveProjectId(""); setInitialRoleSlotId(""); }} onOpenWorkspace={templateId => openWorkspaceFromProject(activeProjectId, templateId)} />
      : activeTemplateId
        ? (
          <Suspense fallback={<PageLoading label="ワークスペースを準備しています…" />}>
            <WorkspaceDetail templateId={activeTemplateId} onBack={backFromWorkspace} backLabel={workspaceReturnProjectId ? "案件に戻る" : undefined} />
          </Suspense>
        )
        : activeTeamId
          ? (
            <Suspense fallback={<PageLoading label="チームの作業環境を準備しています…" />}>
              <TeamBranchWorkspace teamId={activeTeamId} onBack={() => setActiveTeamId("")} />
            </Suspense>
          )
          : tabbed(tab === "team"
            ? <MyTeamsCatalog onOpenTeam={setActiveTeamId} />
            : (
              <DevLabCombinedCatalog
                role={role}
                onOpenProject={(projectId, roleSlotId) => { setActiveProjectId(projectId); setInitialRoleSlotId(roleSlotId || ""); }}
                onOpenTemplate={setActiveTemplateId}
              />
            )),
    // 2026-09-05: 管理系の4画面を1つのタブへ統合した。旧キーは残してあり、
    // 対応するタブを開いた状態でハブを出す（Homeなどからの遷移を壊さないため）。
    dl_manage: <DevLabManageHub role={role} initialTab="projects" />,
    dl_manage_workspace: <DevLabManageHub role={role} initialTab="base" />,
    dl_manage_team: <DevLabManageHub role={role} initialTab="teamProjects" />,
    dl_manage_teams: <DevLabManageHub role={role} initialTab="teams" />,
    // 旧キー。ナビからは消えたが、履歴・古いリンクから来たら同じ画面のチーム側を出す
    dl_team: null,
    dl_workspace: (
      <Suspense fallback={<PageLoading label="ワークスペースを準備しています…" />}>
        {activeTemplateId
          ? <WorkspaceDetail templateId={activeTemplateId} onBack={() => setActiveTemplateId("")} />
          : <WorkspaceCatalog onOpenTemplate={setActiveTemplateId} />}
      </Suspense>
    ),
  };
  return (subView === "dl_team" ? screens.dl_projects : screens[subView]) || screens.dl_home;
}
