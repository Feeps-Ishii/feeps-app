import React, { Suspense, lazy } from "react";

/* 面談・報告会（モック resv）。予約の作り方・状態の決まりは今の画面のまま中に出す（/grant-reservations）。
   管理者は全部、企業担当者は自社、講師は見るだけ */
const ReservationManager = lazy(() => import("../../grants/GrantsComponents.jsx").then(m => ({ default: m.ReservationManager })));

export default function StaffResv({ role }) {
  return <div className="lms-legacy"><Suspense fallback={<div className="soon card">読み込み中</div>}><ReservationManager role={role} /></Suspense></div>;
}
