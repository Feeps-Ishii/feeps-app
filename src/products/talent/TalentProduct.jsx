import React, { Suspense, lazy } from "react";
import {
  SkillMap,
  SkillSheetView,
  TalentHome,
  TrainingSkillsView,
  LearningBadgesView,
  SelfPrStrengthView,
  WorksView,
} from "./TalentComponents.jsx";

// 街は three.js を使うので、開いた人だけが読み込むように分ける
const TownView = lazy(() => import("./TownView.jsx"));

function TalentProduct({ subView, goSub, goProduct, role, themeColor, done = {}, goals = [], contractMode }) {
  if (subView === "tl_town") {
    return (
      <Suspense fallback={<div className="p-10 text-center text-sm opacity-60">街を読み込んでいます…</div>}>
        <TownView goProduct={goProduct} />
      </Suspense>
    );
  }
  if (subView === "tl_growth") return <SkillMap done={done} goals={goals} role={role} go={goSub} />;
  if (subView === "tl_skills") return <TrainingSkillsView done={done} goals={goals} role={role} />;
  if (subView === "tl_sheet") return <SkillSheetView role={role} />;
  if (subView === "tl_works") return <WorksView />;
  if (subView === "tl_badge") return <LearningBadgesView role={role} />;
  if (subView === "tl_pr") return <SelfPrStrengthView />;
  return <TalentHome goSub={goSub} goProduct={goProduct} role={role} themeColor={themeColor} contractMode={contractMode} />;
}

export default TalentProduct;
