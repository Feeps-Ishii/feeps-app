import {
  Portfolio,
  SkillMap,
  SkillSheetView,
  TalentHome,
  TalentPlaceholder,
  TrainingSkillsView,
  WorksView,
} from "./TalentComponents.jsx";

function TalentProduct({ subView, goSub, goProduct, role, themeColor, done = {}, goals = [] }) {
  if (subView === "tl_growth") return <SkillMap done={done} goals={goals} role={role} go={goSub} />;
  if (subView === "tl_skills") return <TrainingSkillsView done={done} goals={goals} role={role} />;
  if (subView === "tl_sheet") return <SkillSheetView role={role} />;
  if (subView === "tl_works") return <WorksView />;
  if (subView === "tl_badge") return <TalentPlaceholder title="資格・バッジ" desc="取得した資格やバッジを管理できます。" />;
  if (subView === "tl_pr") return <TalentPlaceholder title="自己PR・強み" desc="強みと自己PRを整理できます。" />;
  return <TalentHome goSub={goSub} goProduct={goProduct} role={role} themeColor={themeColor} />;
}

export { SkillMap, Portfolio };
export default TalentProduct;