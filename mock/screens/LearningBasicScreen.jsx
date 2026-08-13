import React from "react";
import { Code2, BookOpen, Wand2, Briefcase, TrendingUp } from "lucide-react";
import { NOVA, T, PRODUCT_ACCENT } from "../../src/components/common/theme.js";
import { MockTopbar, MockCaption, MockBody, MockApp, MockNavCard } from "../MockShell.jsx";
import { MODES } from "../modes.js";

// 学習モード・Basic契約。使えない機能は隠さず、グレーアウト＋プランバッジ＋「プランを見る」で見せる。
// DevLabはBasicでも3問まで体験できる入口として扱う。
export default function LearningBasicScreen() {
  const pa = PRODUCT_ACCENT.learning;
  return (
    <div>
      <MockCaption>
        Basic契約。使えない機能を<strong>隠さずに見せて</strong>、上位プランだと分かる形にする。DevLabは体験だけできるので入口として機能する。
      </MockCaption>
      <MockApp>
        <MockTopbar modes={MODES} activeMode="learning" planTag="Basic" />
        <MockBody>
          <p className="mb-1 text-xs font-bold" style={{ color: pa.deep }}>学習モード</p>
          <h3 className="mb-4 text-[17px] font-bold" style={{ color: NOVA.ink }}>学んで、試して、案件につなげる</h3>

          <div className="mb-4 rounded-2xl p-3 text-[13px]" style={{ background: T.warningSubtle, color: T.warning }}>
            <strong>体験中</strong>　開発演習は3問まで試せます（残り2問）
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MockNavCard product="learning" icon={Code2} title="開発演習（DevLab）" desc="実際にコードを書いて動かしながら学べます。Basicでは3問まで試せます。" badge="体験できます" badgeTone="trial" ctaLabel="まず1問やってみる →" />
            <MockNavCard product="learning" icon={BookOpen} title="Eラーニング" desc="コースを受講して、理解度テストで定着を確認します。" />
            <MockNavCard product="learning" icon={Wand2} title="AIコース生成" desc="学びたいテーマを入力すると、AIがコースと問題を作ります。" badge="Premium" locked ctaLabel="プランを見る →" />
            <MockNavCard product="matching" icon={Briefcase} title="案件管理" desc="案件情報を確認し、参画状況や面談の進み具合を追えます。" badge="Standard" locked ctaLabel="プランを見る →" />
            <MockNavCard product="talent" icon={TrendingUp} title="スキル・成長" desc="身につけたスキルを記録します。" />
          </div>
        </MockBody>
      </MockApp>
    </div>
  );
}
