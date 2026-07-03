import React from "react";
import {
  MatchingHome,
  MatchingPlaceholder,
  ProjectMatching,
} from "./MatchingComponents.jsx";

export default function MatchingProduct({ subView, goSub, role, themeColor }) {
  const screens = {
    mt_matching: <ProjectMatching role={role} />,
    mt_placement: <ProjectMatching role={role} mode="placement" />,
    mt_list: <MatchingPlaceholder title="案件一覧" desc="登録されている案件を一覧で確認できます。" />,
    mt_history: <MatchingPlaceholder title="参画履歴" desc="過去の現場参画履歴を確認できます。" />,
    mt_home: <MatchingHome goSub={goSub} role={role} themeColor={themeColor} />,
  };
  return screens[subView] || screens.mt_home;
}

export { ProjectMatching };
