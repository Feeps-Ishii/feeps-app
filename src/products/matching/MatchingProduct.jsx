import React from "react";
import {
  MatchingHome,
  MatchingPlaceholder,
  ProjectMatching,
} from "./MatchingComponents.jsx";

export default function MatchingProduct({ subView, goSub, role, themeColor }) {
  const screens = {
    mt_matching: <ProjectMatching role={role} />,
    mt_placement: <MatchingPlaceholder title="現場参画状況" desc="参画先・ステータス管理には案件管理用のデータ基盤（Projects/Placements）の追加が必要です。準備が整い次第対応します。" />,
    mt_list: <MatchingPlaceholder title="案件一覧" desc="案件の登録・管理には案件管理用のデータ基盤（Projects）の追加が必要です。準備が整い次第対応します。" />,
    mt_history: <MatchingPlaceholder title="参画履歴" desc="参画履歴の記録には案件管理用のデータ基盤（Placements）の追加が必要です。準備が整い次第対応します。" />,
    mt_home: <MatchingHome goSub={goSub} role={role} themeColor={themeColor} />,
  };
  return screens[subView] || screens.mt_home;
}

export { ProjectMatching };
