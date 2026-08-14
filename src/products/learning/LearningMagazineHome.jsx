import React from "react";
import { Btn } from "../../components/common";
import { NOVA, T, PRODUCT_ACCENT } from "../../components/common/theme.js";

// 学習モードHomeのマガジン型レイアウト（2026-08-14新設）。設計チャットのモック
// （feeps-ui-final-mock.html「学習モード」「学習モード（Basic）」）をそのまま実装する。
// SVGはモックのものをそのまま流用（属性はJSX用にキャメルケース化のみ）。
// 色はモックの生の16進数値ではなく、対応する実際のPRODUCT_ACCENTトークンを使う
// （モック側の近似値とのズレをここで解消。DESIGN_BRIEF.mdの色トークン規約に従う）。
//
// clientロール（DevLab対象外）は主役をEラーニングに差し替え、脇カードに案件管理を追加する
// 構成にしている。設計チャット側でclientの学習モード体験は詰めきれていない前提のため、
// 見直しの残課題としてADR0013へ記録している（2026-08-14）。

const DevLabIllustration = () => (
  <svg width="100%" height="152" viewBox="0 0 340 152" role="img" aria-label="コードを書いて実行するイラスト">
    <ellipse cx="170" cy="138" rx="108" ry="7" fill={PRODUCT_ACCENT.learning.accent} opacity=".12" />
    <rect x="66" y="26" width="150" height="98" rx="8" fill="#fff" stroke={PRODUCT_ACCENT.learning.accent} strokeWidth="2" />
    <rect x="66" y="26" width="150" height="16" rx="8" fill={PRODUCT_ACCENT.learning.accent} />
    <rect x="66" y="35" width="150" height="7" fill={PRODUCT_ACCENT.learning.accent} />
    <circle cx="78" cy="34" r="2.6" fill="#fff" opacity=".9" />
    <circle cx="87" cy="34" r="2.6" fill="#fff" opacity=".6" />
    <circle cx="96" cy="34" r="2.6" fill="#fff" opacity=".4" />
    <text x="80" y="62" fontFamily="ui-monospace,monospace" fontSize="10" fill={PRODUCT_ACCENT.talent.accent}>public</text>
    <text x="122" y="62" fontFamily="ui-monospace,monospace" fontSize="10" fill={PRODUCT_ACCENT.training.accent}>class</text>
    <rect x="80" y="72" width="58" height="5" rx="2.5" fill={PRODUCT_ACCENT.learning.accent} opacity=".45" />
    <rect x="90" y="83" width="76" height="5" rx="2.5" fill={PRODUCT_ACCENT.training.accent} opacity=".33" />
    <rect x="90" y="94" width="44" height="5" rx="2.5" fill={PRODUCT_ACCENT.talent.accent} opacity=".38" />
    <rect x="80" y="105" width="30" height="5" rx="2.5" fill={PRODUCT_ACCENT.learning.accent} opacity=".3" />
    <rect x="234" y="52" width="62" height="52" rx="7" fill="#fff" stroke={PRODUCT_ACCENT.matching.accent} strokeWidth="2" />
    <path d="M252 78l8 8 17-18" stroke={PRODUCT_ACCENT.matching.accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <text x="265" y="122" textAnchor="middle" fontSize="9.5" fill={PRODUCT_ACCENT.matching.deep} fontWeight="600">AI採点</text>
    <path d="M220 76h10" stroke={PRODUCT_ACCENT.learning.accent} strokeWidth="2.4" strokeDasharray="4 4" strokeLinecap="round" />
    <circle cx="42" cy="52" r="11" fill={PRODUCT_ACCENT.talent.accent} opacity=".16" />
    <path d="M300 26l2.6 6.2 6.2 2.6-6.2 2.6-2.6 6.2-2.6-6.2-6.2-2.6 6.2-2.6z" fill={PRODUCT_ACCENT.learning.accent} opacity=".55" />
  </svg>
);

// Basic時（トライアル訴求）は右上の合格チェック演出を省く（モックの学習モード(Basic)画面準拠）
const DevLabIllustrationTrial = () => (
  <svg width="100%" height="152" viewBox="0 0 340 152" role="img" aria-label="コードを書いて実行するイラスト">
    <ellipse cx="170" cy="138" rx="108" ry="7" fill={PRODUCT_ACCENT.learning.accent} opacity=".12" />
    <rect x="66" y="26" width="150" height="98" rx="8" fill="#fff" stroke={PRODUCT_ACCENT.learning.accent} strokeWidth="2" />
    <rect x="66" y="26" width="150" height="16" rx="8" fill={PRODUCT_ACCENT.learning.accent} />
    <rect x="66" y="35" width="150" height="7" fill={PRODUCT_ACCENT.learning.accent} />
    <circle cx="78" cy="34" r="2.6" fill="#fff" opacity=".9" />
    <circle cx="87" cy="34" r="2.6" fill="#fff" opacity=".6" />
    <circle cx="96" cy="34" r="2.6" fill="#fff" opacity=".4" />
    <rect x="80" y="60" width="58" height="5" rx="2.5" fill={PRODUCT_ACCENT.learning.accent} opacity=".45" />
    <rect x="90" y="72" width="76" height="5" rx="2.5" fill={PRODUCT_ACCENT.training.accent} opacity=".33" />
    <rect x="90" y="84" width="44" height="5" rx="2.5" fill={PRODUCT_ACCENT.talent.accent} opacity=".38" />
    <rect x="80" y="96" width="30" height="5" rx="2.5" fill={PRODUCT_ACCENT.learning.accent} opacity=".3" />
    <rect x="234" y="52" width="62" height="52" rx="7" fill="#fff" stroke={PRODUCT_ACCENT.matching.accent} strokeWidth="2" />
    <path d="M252 78l8 8 17-18" stroke={PRODUCT_ACCENT.matching.accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M220 76h10" stroke={PRODUCT_ACCENT.learning.accent} strokeWidth="2.4" strokeDasharray="4 4" strokeLinecap="round" />
  </svg>
);

const ElearningIllustration = () => (
  <svg width="100%" height="152" viewBox="0 0 340 152" role="img" aria-label="コースで学ぶイラスト">
    <ellipse cx="170" cy="138" rx="108" ry="7" fill={PRODUCT_ACCENT.learning.accent} opacity=".12" />
    <rect x="90" y="30" width="160" height="94" rx="8" fill="#fff" stroke={PRODUCT_ACCENT.learning.accent} strokeWidth="2" />
    <rect x="90" y="30" width="160" height="16" rx="8" fill={PRODUCT_ACCENT.learning.accent} />
    <rect x="90" y="39" width="160" height="7" fill={PRODUCT_ACCENT.learning.accent} />
    <rect x="104" y="60" width="132" height="6" rx="3" fill={PRODUCT_ACCENT.learning.accent} opacity=".4" />
    <rect x="104" y="74" width="100" height="6" rx="3" fill={PRODUCT_ACCENT.training.accent} opacity=".3" />
    <rect x="104" y="88" width="112" height="6" rx="3" fill={PRODUCT_ACCENT.talent.accent} opacity=".35" />
    <rect x="104" y="102" width="70" height="6" rx="3" fill={PRODUCT_ACCENT.learning.accent} opacity=".28" />
    <circle cx="52" cy="70" r="12" fill={PRODUCT_ACCENT.talent.accent} opacity=".16" />
    <circle cx="288" cy="98" r="10" fill={PRODUCT_ACCENT.learning.accent} opacity=".16" />
  </svg>
);

function iconChipStyle(tone) {
  return { background: tone.subtle, opacity: 1 };
}

function ElearningIcon({ tone }) {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
      <rect width="46" height="46" rx="12" fill={tone.accent} opacity=".12" />
      <rect x="14" y="15" width="18" height="16" rx="3" stroke={tone.deep} strokeWidth="2.4" />
      <path d="M18 21h10M18 25h6" stroke={tone.deep} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function ProjectExperienceIcon({ tone }) {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
      <rect width="46" height="46" rx="12" fill={tone.accent} opacity=".14" />
      <circle cx="19" cy="19" r="4" stroke={tone.deep} strokeWidth="2.4" />
      <circle cx="28" cy="27" r="4" stroke={tone.deep} strokeWidth="2.4" />
      <path d="M22 22l3 2" stroke={tone.deep} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function SkillIcon({ tone }) {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
      <rect width="46" height="46" rx="12" fill={tone.accent} opacity=".13" />
      <path d="M15 29l6-8 5 5 7-11" stroke={tone.deep} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function AiCourseIcon({ tone }) {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
      <rect width="46" height="46" rx="12" fill={tone.accent} opacity=".13" />
      <path d="M23 14l2.7 6.3L32 23l-6.3 2.7L23 32l-2.7-6.3L14 23l6.3-2.7z" fill={tone.deep} opacity=".75" />
    </svg>
  );
}
function MatchingIcon({ tone }) {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
      <rect width="46" height="46" rx="12" fill={tone.accent} opacity=".13" />
      <path d="M15 24l5 5 10-12" stroke={tone.deep} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const GREY_TONE = { accent: NOVA.quiet, deep: NOVA.quiet, subtle: NOVA.soft };

// 脇カード。3状態: 通常(クリック可) / comingSoon(機能未実装、プランは足りている) /
// locked(プラン不足)。comingSoon・lockedはどちらもクリック不可＝onClickを渡さない。
function SideCard({ icon: Icon, tone, title, desc, badge, badgeTone = "accent", state = "normal", onClick, onPlanClick }) {
  const disabled = state !== "normal";
  const cardTone = state === "locked" ? GREY_TONE : tone;
  const clickable = state === "normal" && typeof onClick === "function";
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      aria-disabled={disabled || undefined}
      className="flex flex-1 items-center gap-3.5 rounded-[18px] p-4"
      style={{
        background: state === "locked" ? NOVA.paper : NOVA.card,
        border: `1px solid ${NOVA.line}`,
        cursor: clickable ? "pointer" : "not-allowed",
      }}>
      <Icon tone={cardTone} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold" style={{ color: state === "locked" ? NOVA.quiet : NOVA.ink }}>{title}</span>
          {badge && (
            <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
              style={badgeTone === "warning"
                ? { background: T.warningSubtle, color: T.warning }
                : { background: tone.subtle, color: tone.deep }}>
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: NOVA.muted }}>{desc}</p>
        {state === "locked" && (
          <button type="button" onClick={onPlanClick}
            className="mt-1.5 text-[11.5px] font-semibold" style={{ color: NOVA.muted }}>
            プランを見る →
          </button>
        )}
      </div>
    </div>
  );
}

function HeroCard({ illustration, kicker, kickerTone, title, desc, actions }) {
  return (
    <div className="overflow-hidden rounded-[18px]" style={{ background: NOVA.card, border: `1px solid ${NOVA.line}` }}>
      <div className="pt-4" style={{ background: `linear-gradient(140deg, ${kickerTone.subtle}, ${NOVA.paper})` }}>
        {illustration}
      </div>
      <div className="p-5">
        <div className="text-[11.5px] font-bold" style={{ letterSpacing: "0.05em", color: kickerTone.deep }}>{kicker}</div>
        <h3 className="mt-1 mb-1.5 text-lg font-bold leading-snug" style={{ color: NOVA.ink }}>{title}</h3>
        <p className="mb-3.5 text-[13px] leading-relaxed" style={{ color: NOVA.muted }}>{desc}</p>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
    </div>
  );
}

// role/学習プランから脇カード4枚の状態を組み立てる
function buildSideCards({ role, isCreator, learningPlan, goSub, goProduct }) {
  const unrestricted = role === "admin" || role === "instructor"; // ADR0013: モードにゲートしない
  const projectExperienceLocked = !unrestricted && learningPlan === "basic";
  const aiCourseLocked = !unrestricted && (learningPlan === "basic" || learningPlan === "standard");

  const projectExperience = {
    icon: ProjectExperienceIcon, tone: PRODUCT_ACCENT.matching,
    title: "案件参画体験", desc: "チームを組んで、実際の案件と同じ流れを体験します。",
    state: projectExperienceLocked ? "locked" : "comingSoon",
    badge: projectExperienceLocked ? "Standard" : "近日公開",
    badgeTone: projectExperienceLocked ? "accent" : "warning",
  };
  const skill = {
    icon: SkillIcon, tone: PRODUCT_ACCENT.talent,
    title: "スキル・成長", desc: "身につけたスキルを記録し、案件参画向けのシートに整えます。",
    state: "normal", onClick: () => goProduct && goProduct("talent"),
  };
  const aiCourse = {
    icon: AiCourseIcon, tone: PRODUCT_ACCENT.learning,
    title: "AIコース生成", desc: "学びたいテーマを入力すると、AIがコースと問題を作ります。",
    state: aiCourseLocked ? "locked" : "comingSoon",
    badge: aiCourseLocked ? "Premium" : "近日公開",
    badgeTone: aiCourseLocked ? "accent" : "warning",
  };
  const elearning = {
    icon: ElearningIcon, tone: PRODUCT_ACCENT.training,
    title: "Eラーニング", desc: "コースを受講して、理解度テストで定着を確認します。",
    state: "normal", onClick: () => goSub("el_courses"),
  };
  const matching = {
    icon: MatchingIcon, tone: PRODUCT_ACCENT.matching,
    title: "案件管理", desc: "案件の情報を確認し、参画状況や面談の進み具合を追えます。",
    state: "normal", onClick: () => goProduct && goProduct("matching"),
  };

  // client: DevLab対象外のため主役をEラーニングにし、脇へ案件管理を追加する構成
  // （設計チャットでclientの学習モード体験は未確定。ADR0013の残課題として記録済み）。
  if (role === "client") return [projectExperience, skill, aiCourse, matching];
  return [elearning, projectExperience, skill, aiCourse];
}

export default function LearningMagazineHome({ role, isCreator, canUseDevLab, learningPlan, goSub, goProduct, onShowPlanNotice }) {
  const heroIsDevLab = canUseDevLab; // trainee/instructor/admin。clientはEラーニングが主役
  const devLabTarget = () => goSub(isCreator ? "el_devlab_manage" : "el_devlab");
  const showTrial = !isCreator && learningPlan === "basic"; // Basic契約のtrainee/clientのみ（DevLab自体は常に体験可）

  const sideCards = buildSideCards({ role, isCreator, learningPlan, goSub, goProduct });

  const hero = heroIsDevLab ? (
    showTrial ? (
      <HeroCard
        illustration={<DevLabIllustrationTrial />}
        kicker="まずは試してみる" kickerTone={PRODUCT_ACCENT.learning}
        title="開発演習（DevLab）"
        desc="ブラウザ上で実際にコードを書いて動かしながら学べます。Basicプランでは3問まで体験できます（残り2問）。"
        actions={<Btn onClick={devLabTarget}>1問やってみる</Btn>}
      />
    ) : (
      <HeroCard
        illustration={<DevLabIllustration />}
        kicker="いちばん人気" kickerTone={PRODUCT_ACCENT.learning}
        title="開発演習（DevLab）"
        desc={isCreator
          ? "架空のクライアント案件をつくり、受講生の提出をステップごとに確認できます。ブラウザ上で完結し、環境構築は不要です。"
          : "ブラウザ上で実際にコードを書いて動かしながら学べます。提出するとAIがすぐに採点し、どこを直せばいいかを教えてくれます。環境構築は不要です。"}
        actions={<>
          <Btn onClick={devLabTarget}>{isCreator ? "案件を確認する" : "演習をはじめる"}</Btn>
          <Btn kind="ghost" onClick={devLabTarget}>課題一覧</Btn>
        </>}
      />
    )
  ) : (
    <HeroCard
      illustration={<ElearningIllustration />}
      kicker="自社の学習状況" kickerTone={PRODUCT_ACCENT.training}
      title="Eラーニング"
      desc="自社の受講生が学べるコースを確認できます。受講状況や理解度も、ここからまとめて把握できます。"
      actions={<Btn onClick={() => goSub("el_courses")}>コース一覧を開く</Btn>}
    />
  );

  return (
    <div className="mb-6 grid gap-3.5 lg:grid-cols-[1.55fr_1fr]">
      {hero}
      <div className="flex flex-col gap-3.5">
        {sideCards.map(c => (
          <SideCard key={c.title} icon={c.icon} tone={c.tone} title={c.title} desc={c.desc}
            badge={c.badge} badgeTone={c.badgeTone} state={c.state} onClick={c.onClick}
            onPlanClick={onShowPlanNotice} />
        ))}
      </div>
    </div>
  );
}
