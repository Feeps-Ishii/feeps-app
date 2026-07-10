import React from "react";
import {
  AnalyticsHome,
  AwsCostDashboard,
  MonthlyReport,
  RiskBoard,
} from "./AnalyticsComponents.jsx";

export default function AnalyticsProduct({ subView, goSub, themeColor }) {
  const screens = {
    an_awscosts: <AwsCostDashboard />,
    an_risk: <RiskBoard />,
    an_report: <MonthlyReport />,
    an_home: <AnalyticsHome goSub={goSub} themeColor={themeColor} />,
  };
  return screens[subView] || screens.an_home;
}

export { AwsCostDashboard, RiskBoard };
