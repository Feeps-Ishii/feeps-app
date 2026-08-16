import {
  SkillMap,
  SkillSheetView,
  TalentHome,
  TrainingSkillsView,
  LearningBadgesView,
  SelfPrStrengthView,
  WorksView,
} from "./TalentComponents.jsx";

function TalentProduct({ subView, goSub, goProduct, role, themeColor, done = {}, goals = [], contractMode }) {
  if (subView === "tl_growth") return <SkillMap done={done} goals={goals} role={role} go={goSub} />;
  if (subView === "tl_skills") return <TrainingSkillsView done={done} goals={goals} role={role} />;
  if (subView === "tl_sheet") return <SkillSheetView role={role} />;
  if (subView === "tl_works") return <WorksView />;
  if (subView === "tl_badge") return <LearningBadgesView role={role} />;
  if (subView === "tl_pr") return <SelfPrStrengthView />;
  return <TalentHome goSub={goSub} goProduct={goProduct} role={role} themeColor={themeColor} contractMode={contractMode} />;
}

export default TalentProduct;
