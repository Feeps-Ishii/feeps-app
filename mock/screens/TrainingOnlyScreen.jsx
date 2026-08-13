import React from "react";
import { GraduationCap, Landmark, TrendingUp, Settings } from "lucide-react";
import { ProductNavCard } from "../../src/components/common/index.js";
import { NOVA } from "../../src/components/common/theme.js";
import { MockTopbar, MockCaption, MockBody, MockApp } from "../MockShell.jsx";

// 契約パターン3: 研修のみ契約（LMSのみ利用）。モード切替タブ自体を出さず、
// 学習側の機能は画面上に一切存在させない（参考モックに無かったパターンのため新規追加）。
export default function TrainingOnlyScreen() {
  return (
    <div>
      <MockCaption>
        研修管理だけを契約している企業。<strong>モード切替タブが出ない</strong>のは学習のみ契約と同じ構図。学習側の機能（DevLab・案件参画体験・Eラーニング等）はコード上も画面上も一切現れない。
      </MockCaption>
      <MockApp>
        <MockTopbar brand="Feeps One" avatarLabel="山" />
        <MockBody>
          <p className="mb-1 text-xs font-bold" style={{ color: NOVA.muted }}>研修管理</p>
          <h3 className="mb-4 text-[17px] font-bold" style={{ color: NOVA.ink }}>研修の運営に必要な機能</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ProductNavCard product="training" icon={GraduationCap} title="研修管理" desc="出欠・日報の記録から、カリキュラムの進行までを管理します。" delay={0} />
            <ProductNavCard product="grants" icon={Landmark} title="助成金管理" desc="助成金の申請から交付までの手続きを、ここで一元管理します。" delay={40} />
            <ProductNavCard product="talent" icon={TrendingUp} title="スキル・成長" desc="研修で身についたスキルや実績を記録します。" delay={80} />
            <ProductNavCard product="admin" icon={Settings} title="管理" desc="受講生・企業マスタ・アカウントを管理します。" delay={120} />
          </div>
        </MockBody>
      </MockApp>
    </div>
  );
}
