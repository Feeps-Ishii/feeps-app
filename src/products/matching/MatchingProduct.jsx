import React, { useState } from "react";
import {
  MatchingHome,
  MatchingMeView,
  PlacementManager,
  ProjectManager,
  ProjectMatching,
} from "./MatchingComponents.jsx";

export default function MatchingProduct({ subView, goSub, role, themeColor }) {
  const canOpenManagement = role === "admin" || role === "client";
  const isOwner = role === "client";
  // 案件一覧の「候補者を見る」から候補者マッチングへ遷移する際、選択中の案件を引き継ぐ。
  const [activeProjectId, setActiveProjectId] = useState("");

  if (role === "instructor") return null;

  function openCandidates(projectId) {
    setActiveProjectId(projectId);
    goSub("mt_matching");
  }

  const screens = {
    mt_home: <MatchingHome goSub={goSub} role={role} themeColor={themeColor} />,
    mt_list: canOpenManagement
      ? <ProjectManager key={role} role={role} onOpenCandidates={openCandidates} />
      : <MatchingHome goSub={goSub} role={role} themeColor={themeColor} />,
    mt_matching: isOwner
      ? <ProjectMatching role={role} initialProjectId={activeProjectId} />
      : <MatchingHome goSub={goSub} role={role} themeColor={themeColor} />,
    mt_placement: canOpenManagement
      ? <PlacementManager key={role} role={role} />
      : <MatchingMeView />,
  };
  return screens[subView] || screens.mt_home;
}

export { ProjectMatching };
