import React, { useState } from "react";
import { NOVA, T } from "../src/components/common/theme.js";
import { MODES } from "./modes.js";
import TrainingOnlyScreen from "./screens/TrainingOnlyScreen.jsx";
import TrainingModeScreen from "./screens/TrainingModeScreen.jsx";
import LearningPremiumScreen from "./screens/LearningPremiumScreen.jsx";
import LearningBasicScreen from "./screens/LearningBasicScreen.jsx";
import LearningOnlyScreen from "./screens/LearningOnlyScreen.jsx";
import ProjectExperienceScreen from "./screens/ProjectExperienceScreen.jsx";
import PlanComparisonScreen from "./screens/PlanComparisonScreen.jsx";

const TABS = [
  { key: "training-only", label: "1. 研修のみ契約", Screen: TrainingOnlyScreen },
  { key: "training-mode", label: "2. 両方契約：研修管理モード", Screen: TrainingModeScreen },
  { key: "learning-premium", label: "3. 両方契約：学習モード（Premium）", Screen: LearningPremiumScreen },
  { key: "learning-basic", label: "4. 両方契約：学習モード（Basic）", Screen: LearningBasicScreen },
  { key: "learning-only", label: "5. 学習のみ契約", Screen: LearningOnlyScreen },
  { key: "project", label: "6. 案件参画体験", Screen: ProjectExperienceScreen },
  { key: "plans", label: "7. プラン比較・コース公開範囲", Screen: PlanComparisonScreen },
];

// 社内検討用モック。実Productではないため src/products/ 配下には置かず、
// Viteの第2エントリ（mock/mode-split.html）から独立してマウントする。実データ・実APIには触れない。
export default function ModeSplitMock() {
  const [active, setActive] = useState(TABS[0].key);
  const Screen = TABS.find(t => t.key === active)?.Screen || TABS[0].Screen;

  return (
    <div style={{ background: NOVA.paper, minHeight: "100vh" }}>
      <div className="mx-auto max-w-[1080px] px-5 py-8">
        <p className="mb-1.5 text-xs font-bold" style={{ color: T.accent, letterSpacing: "0.06em" }}>FEEPS ONE — 社内検討用モック</p>
        <h1 className="mb-2 text-2xl font-bold" style={{ color: NOVA.ink }}>研修管理 / 学習 モード分離</h1>
        <p className="mb-6 text-sm" style={{ color: NOVA.muted }}>実装前のイメージ共有用。実データ・実APIには接続していません。文言・数値はすべて仮です。</p>

        <div className="mb-6 flex flex-wrap gap-1.5 border-b pb-3" style={{ borderColor: NOVA.line }} role="tablist">
          {TABS.map(t => {
            const isActive = t.key === active;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={isActive} onClick={() => setActive(t.key)}
                className="rounded-lg px-3 py-2 text-[13px] font-semibold"
                style={isActive ? { background: NOVA.ink, color: "#fff" } : { background: "transparent", border: `1px solid ${NOVA.line}`, color: NOVA.muted }}>
                {t.label}
              </button>
            );
          })}
        </div>

        <Screen />
      </div>
    </div>
  );
}
