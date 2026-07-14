import React, { useState } from "react";
import {
  MatchingHome,
  MatchingMeView,
  PlacementManager,
  ProjectManager,
  ProjectMatching,
} from "./MatchingComponents.jsx";

export default function MatchingProduct({ subView, goSub, role, themeColor }) {
  const isManager = role === "admin" || role === "client";
  // 案件一覧の「候補者を見る」から候補者マッチングへ遷移する際、選択中の案件を引き継ぐ。
  const [activeProjectId, setActiveProjectId] = useState("");

  function openCandidates(projectId) {
    setActiveProjectId(projectId);
    goSub("mt_matching");
  }

  const screens = {
    mt_home: <MatchingHome goSub={goSub} role={role} themeColor={themeColor} />,
    mt_list: isManager
      ? <ProjectManager role={role} onOpenCandidates={openCandidates} />
      : <MatchingHome goSub={goSub} role={role} themeColor={themeColor} />,
    mt_matching: isManager
      ? <ProjectMatching role={role} initialProjectId={activeProjectId} />
      : <MatchingHome goSub={goSub} role={role} themeColor={themeColor} />,
    // instructorはPRODUCTS(TrainingApp.jsx)からmatchingを除外済みでこの画面に到達しない。
    // 担当受講生の参画状況は研修管理のカルテ内(TraineeParticipationStatus)で閲覧する。
    mt_placement: isManager
      ? <PlacementManager role={role} />
      : <MatchingMeView />,
  };
  return screens[subView] || screens.mt_home;
}

export { ProjectMatching };
