import React from "react";
import { Code2, BookOpen, Wand2, Briefcase, TrendingUp } from "lucide-react";
import { PRODUCT_ACCENT } from "../../src/components/common/theme.js";
import { MockTopbar, MockCaption, MockBody, MockApp, MockNavCard } from "../MockShell.jsx";

// 契約パターン2: 学習のみ契約。モード切替タブ自体が出ず、最初から学習モードが開く。
// 研修管理の機能は画面上に一切現れない。
export default function LearningOnlyScreen() {
  const pa = PRODUCT_ACCENT.learning;
  return (
    <div>
      <MockCaption>
        Eラーニングだけを契約した企業。<strong>モード切替タブ自体が出ない</strong>。研修管理の機能は視界に入らないので迷いようがない。
      </MockCaption>
      <MockApp>
        <MockTopbar brand={<span>Feeps One <span style={{ color: pa.accent }}>Learning</span></span>} planTag="Standard" avatarLabel="田" />
        <MockBody>
          <div className="mb-4 rounded-2xl p-3 text-[13px]" style={{ background: pa.subtle, color: pa.deep }}>
            <strong>前回の続き</strong>　Java入門 第5章から再開できます
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MockNavCard product="learning" icon={Code2} title="開発演習（DevLab）" desc="実際にコードを書いて動かしながら学べます。AIが提出コードを採点します。" badge="AI・実践" badgeTone="ai" />
            <MockNavCard product="learning" icon={BookOpen} title="Eラーニング" desc="コースを受講して、理解度テストで定着を確認します。" />
            <MockNavCard product="learning" icon={Wand2} title="AIコース生成" desc="学びたいテーマを入力すると、AIがコースと問題を作ります。" badge="Premium" locked ctaLabel="プランを見る →" />
            <MockNavCard product="matching" icon={Briefcase} title="案件管理" desc="案件情報を確認し、参画状況を追えます。" />
            <MockNavCard product="talent" icon={TrendingUp} title="スキル・成長" desc="身につけたスキルを、案件参画向けのシートに整えます。" badge="よく使う" badgeTone="accent" />
          </div>
        </MockBody>
      </MockApp>
    </div>
  );
}
