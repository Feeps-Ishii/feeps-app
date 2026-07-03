import React from "react";
import {
  AnalyticsHome,
  AnalyticsPlaceholder,
  AwsCostDashboard,
  RiskBoard,
} from "./AnalyticsComponents.jsx";

export default function AnalyticsProduct({ subView, goSub, themeColor }) {
  const screens = {
    an_awscosts: <AwsCostDashboard />,
    an_risk: <RiskBoard />,
    an_report: <AnalyticsPlaceholder title="月次レポート" desc="月次の研修実績・受講状況をレポートで確認できます。" />,
    an_home: <AnalyticsHome goSub={goSub} themeColor={themeColor} />,
  };
  return screens[subView] || screens.an_home;
}

export { AwsCostDashboard, RiskBoard };
