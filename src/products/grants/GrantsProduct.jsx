import React, { useState } from "react";
import {
  CompanyProfileView,
  GrantDocuments,
  GrantsHome,
  GrantsManager,
  ReservationManager,
  TraineeGrantInfo,
} from "./GrantsComponents.jsx";

// 対象ロールはadmin/clientのみ（instructor/traineeはTrainingApp.jsxのPRODUCTS.rolesで
// 既に到達不可。ここでも二重に防御する）。
export default function GrantsProduct({ subView, goSub, role, themeColor }) {
  if (role !== "admin" && role !== "client") return null;

  // 助成金申請一覧の「提出書類を見る」から書類画面へ遷移する際、選択中の申請を引き継ぐ
  // （MatchingProductのactiveProjectIdと同じ受け渡しパターン）。
  const [activeGrantId, setActiveGrantId] = useState("");

  function openDocuments(grantId) {
    setActiveGrantId(grantId);
    goSub("gr_documents");
  }

  const screens = {
    gr_home: <GrantsHome goSub={goSub} role={role} themeColor={themeColor} />,
    gr_company: <CompanyProfileView role={role} />,
    gr_trainees: <TraineeGrantInfo role={role} />,
    gr_list: <GrantsManager role={role} onOpenDocuments={openDocuments} />,
    gr_documents: <GrantDocuments role={role} initialGrantId={activeGrantId} onGrantConsumed={() => setActiveGrantId("")} />,
    gr_reservations: <ReservationManager role={role} />,
  };
  return screens[subView] || screens.gr_home;
}
