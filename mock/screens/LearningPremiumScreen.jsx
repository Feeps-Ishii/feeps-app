import React from "react";
import { Sparkles, Code2, BookOpen, Wand2, Briefcase, TrendingUp, Settings } from "lucide-react";
import { Btn } from "../../src/components/common/index.js";
import { NOVA, PRODUCT_ACCENT } from "../../src/components/common/theme.js";
import { MockTopbar, MockCaption, MockBody, MockApp, MockNavCard } from "../MockShell.jsx";
import { MODES } from "../modes.js";

// 学習モード・Premium契約。全機能が使える。案件参画体験を目玉としてHero表示。
export default function LearningPremiumScreen() {
  const pa = PRODUCT_ACCENT.learning;
  return (
    <div>
      <MockCaption>
        学習モードに切り替えた状態。Premium契約なので全機能が使える。案件参画体験を目玉としてHeroに置き、DevLabに「AI・実践」バッジを出す。<strong>自分のプランで使える機能には制限バッジを出さない</strong>ため、AIコース生成にPremiumバッジは付けない（画面4のBasicでは同じカードに制限バッジが付く＝使えないときだけ出る）。
      </MockCaption>
      <MockApp>
        <MockTopbar modes={MODES} activeMode="learning" planTag="Premium" />
        <MockBody>
          <p className="mb-1 text-xs font-bold" style={{ color: pa.deep }}>学習モード</p>
          <h3 className="mb-4 text-[17px] font-bold" style={{ color: NOVA.ink }}>学んで、試して、案件につなげる</h3>

          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl p-4" style={{ border: `2px solid ${pa.accent}`, background: NOVA.card }}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: pa.subtle, color: pa.deep }}><Sparkles size={20} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold" style={{ color: NOVA.ink }}>案件参画体験 <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: pa.subtle, color: pa.deep }}>チームで実践</span></div>
              <p className="mt-1 text-[13px]" style={{ color: NOVA.muted }}>実際の案件と同じ流れを、チームを組んで最後まで体験します。要件の受け取りから設計・実装・レビューまで。</p>
            </div>
            <Btn>体験してみる →</Btn>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MockNavCard product="learning" icon={Code2} title="開発演習（DevLab）" desc="実際にコードを書いて動かしながら学べます。AIが提出コードを採点します。" badge="AI・実践" badgeTone="ai" />
            <MockNavCard product="learning" icon={BookOpen} title="Eラーニング" desc="コースを受講して、理解度テストで定着を確認します。" />
            <MockNavCard product="learning" icon={Wand2} title="AIコース生成" desc="学びたいテーマを入力すると、AIがコースと問題を作ります。" />
            <MockNavCard product="matching" icon={Briefcase} title="案件管理" desc="案件情報を確認し、参画状況や面談の進み具合を追えます。" />
            <MockNavCard product="talent" icon={TrendingUp} title="スキル・成長" desc="身につけたスキルを、案件参画向けのシートに整えます（研修モードと共通）。" />
            <MockNavCard product="admin" icon={Settings} title="管理" desc="プラン・契約・AI利用量を管理します。" />
          </div>
        </MockBody>
      </MockApp>
    </div>
  );
}
