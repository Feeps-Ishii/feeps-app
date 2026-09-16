import React from "react";
import { AdminCompanies } from "../admin/AdminComponents.jsx";
import PlansContractsAdmin from "../learning/admin/PlansContractsAdmin.jsx";
import { AwsCostDashboard } from "../analytics/AnalyticsProduct.jsx";

// 企業管理モード（2026-08-21新設）。
//
// 契約・プラン・席・企業マスタは「何を売っているか」(研修/学習)ではなく
// 「誰に売っているか」の軸なので、研修管理モードにも学習モードにも収まらない。
// 実際、**「研修のみ契約」の企業の契約を変えるのに学習モードへ入る**というねじれが起きていた
// （プラン・契約管理が learning product 配下にあったため）。ここへ集約する。
//
// **既存の画面は移動せず参照する。** AdminCompanies(企業マスタ) と PlansContractsAdmin
// (契約・プラン・席・申請承認) はそのまま動いているものなので、置き場所だけを変える。
// 将来ここへ足すもの: AI利用量、請求。企業担当者向けの契約閲覧は別タブ（本人の会社のみ）。
export default function CompanyProduct({ subView }) {
  if (subView === "cm_plans") return <PlansContractsAdmin />;
  // 2026-09-16: AWS利用料金は運営コスト。研修の分析ではないのでここへ移した
  if (subView === "cm_awscosts") return <AwsCostDashboard />;
  return <AdminCompanies />;
}
