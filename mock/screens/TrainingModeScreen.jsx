import React from "react";
import { GraduationCap, Landmark, TrendingUp, Settings } from "lucide-react";
import { ProductNavCard } from "../../src/components/common/index.js";
import { NOVA } from "../../src/components/common/theme.js";
import { MockTopbar, MockCaption, MockBody, MockApp } from "../MockShell.jsx";
import { MODES } from "../modes.js";

// 契約パターン1: 両方契約。ヘッダーのモード切替タブで研修⇔学習を行き来する。
// 研修側にはプランの概念がないため、プランタグは出さない。
export default function TrainingModeScreen() {
  return (
    <div>
      <MockCaption>
        研修管理・学習の両方を契約している企業。ヘッダーのタブでモードを切り替える。研修側にはプランの概念がないので、プラン表示は出さない。
      </MockCaption>
      <MockApp>
        <MockTopbar modes={MODES} activeMode="training" />
        <MockBody>
          <p className="mb-1 text-xs font-bold" style={{ color: NOVA.muted }}>研修管理モード</p>
          <h3 className="mb-4 text-[17px] font-bold" style={{ color: NOVA.ink }}>研修の運営に必要な機能</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ProductNavCard product="training" icon={GraduationCap} title="研修管理" desc="出欠・日報の記録から、カリキュラムの進行までを管理します。" delay={0} />
            <ProductNavCard product="grants" icon={Landmark} title="助成金管理" desc="助成金の申請から交付までの手続きを、ここで一元管理します。" delay={40} />
            <ProductNavCard product="talent" icon={TrendingUp} title="スキル・成長" desc="研修で身についたスキルや実績を記録します（学習モードと共通）。" delay={80} />
            <ProductNavCard product="admin" icon={Settings} title="管理" desc="受講生・企業マスタ・アカウントを管理します。" delay={120} />
          </div>
        </MockBody>
      </MockApp>
    </div>
  );
}
