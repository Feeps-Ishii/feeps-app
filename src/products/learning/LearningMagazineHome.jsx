import React from "react";
import { Btn } from "../../components/common";
import { NOVA, T, PRODUCT_ACCENT } from "../../components/common/theme.js";
import { UserRound, UsersRound } from "lucide-react";
import RoadmapEntry from "./roadmap/RoadmapEntry.jsx";

// 学習モードHome上部のヘッダー（2026-08-14刷新、設計チャットのモック
// feeps-learning-header-mock.html「案5」を実装）。数値の羅列をやめ、状況と次の一手を
// 文章で出す。既存の共有コンポーネント components/common/PageHeader.jsx は8Product共通
// のため変更せず、学習モードHomeだけこの専用ヘッダーへ差し替える（呼び出し側の入れ替え）。
function HeaderArrowIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="9" fill={PRODUCT_ACCENT.learning.accent} opacity=".15" />
      <path d="M13 11l6 6-6 6" stroke={PRODUCT_ACCENT.learning.deep} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function LearningStatusHeader({ role, resume, completedCount, inprogressCount, goSub, onOpenDetail }) {
  const pa = PRODUCT_ACCENT.learning;
  let heading, desc, ctaLabel, onCta;

  // 2026-09-16: instructor/adminにも「続きから学習」「まだ学習を始めていません」が
  // 出ていた。2026-08-18にナビからは受講生導線を外したのに、ここだけ取り残されていた。
  // **自分では学習しないロール**（講師・管理者・企業担当）は管理側の入口にする。
  if (role === "instructor" || role === "admin") {
    heading = "受講状況をまとめて確認できます";
    desc = "コースごとの進み具合と、つまずいている人が分かります";
    ctaLabel = "受講状況を開く";
    onCta = () => goSub("el_students");
  } else if (role === "client") {
    // clientは自分が学習しないため別文言体系。自社受講生の集計は現状取得できないため
    // （GET /dashboard/clientの流用は学習モードHomeのヘッダー1行には不釣り合いなため見送り、
    // 2026-08-14ユーザー決定）、案内文のみとする。
    heading = "自社の学習状況を見渡せます";
    desc = "受講生ごとの進捗はコース一覧から確認できます";
    ctaLabel = "コース一覧を開く";
    onCta = () => goSub("el_courses");
  } else if (resume) {
    heading = `${resume.course.title} ${resume.lesson.title} の続きから`;
    desc = "前回の続きから再開できます";
    ctaLabel = "続きから学習";
    onCta = () => onOpenDetail && onOpenDetail(resume.course);
  } else if (completedCount === 0 && inprogressCount === 0) {
    heading = "まだ学習を始めていません";
    desc = "まずは開発演習を1問試すか、コース一覧から選んでみてください";
    ctaLabel = "コース一覧を開く";
    onCta = () => goSub("el_courses");
  } else {
    heading = `コースを${completedCount}本修了しました`;
    desc = "次のコースを選ぶか、開発演習で力を試してみてください";
    ctaLabel = "コース一覧を開く";
    onCta = () => goSub("el_courses");
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] px-5 py-3.5"
      style={{ background: `${pa.accent}0f`, border: `1px solid ${pa.accent}2e` }}>
      <HeaderArrowIcon />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold" style={{ color: NOVA.ink }}>{heading}</h3>
        <p className="text-xs" style={{ color: NOVA.muted }}>{desc}</p>
      </div>
      <Btn size="sm" onClick={onCta}>{ctaLabel}</Btn>
    </div>
  );
}

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

// チーム開発（2026-08-19追加）。ブランチが分かれて合流する形＋コミット履歴で
// 「複数人で1つのコードベースを進める」ことを示す。トーンは案件系(matching)に合わせ、
// 主役1（学習=learning）と視覚的に対を作る。
const TeamDevIllustration = () => {
  const m = PRODUCT_ACCENT.matching;
  const l = PRODUCT_ACCENT.learning;
  return (
    <svg width="100%" height="152" viewBox="0 0 340 152" role="img" aria-label="チームでブランチを分けて合流するイラスト">
      <ellipse cx="170" cy="138" rx="108" ry="7" fill={m.accent} opacity=".12" />
      {/* main と 2本のブランチ */}
      <path d="M52 78h34" stroke={m.accent} strokeWidth="3" strokeLinecap="round" />
      <path d="M86 78C104 78 106 46 124 46h34" stroke={m.accent} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M86 78C104 78 106 110 124 110h34" stroke={l.accent} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M158 46C176 46 178 78 196 78h30" stroke={m.accent} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M158 110C176 110 178 78 196 78" stroke={l.accent} strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="86" cy="78" r="6" fill="#fff" stroke={m.accent} strokeWidth="3" />
      <circle cx="196" cy="78" r="6" fill="#fff" stroke={m.accent} strokeWidth="3" />
      <circle cx="124" cy="46" r="5.5" fill={m.accent} />
      <circle cx="158" cy="46" r="5.5" fill={m.accent} />
      <circle cx="124" cy="110" r="5.5" fill={l.accent} />
      <circle cx="158" cy="110" r="5.5" fill={l.accent} />
      {/* 合流後のコミット履歴カード */}
      <rect x="226" y="46" width="70" height="64" rx="7" fill="#fff" stroke={m.accent} strokeWidth="2" />
      <circle cx="238" cy="60" r="3.4" fill={m.accent} />
      <rect x="246" y="57.5" width="40" height="5" rx="2.5" fill={m.accent} opacity=".4" />
      <circle cx="238" cy="76" r="3.4" fill={l.accent} />
      <rect x="246" y="73.5" width="32" height="5" rx="2.5" fill={l.accent} opacity=".4" />
      <circle cx="238" cy="92" r="3.4" fill={PRODUCT_ACCENT.talent.accent} />
      <rect x="246" y="89.5" width="36" height="5" rx="2.5" fill={PRODUCT_ACCENT.talent.accent} opacity=".4" />
      {/* メンバー */}
      <circle cx="52" cy="52" r="10" fill={m.accent} opacity=".22" />
      <circle cx="52" cy="104" r="10" fill={l.accent} opacity=".22" />
      <text x="261" y="126" textAnchor="middle" fontSize="9.5" fill={m.deep} fontWeight="600">コミット履歴</text>
    </svg>
  );
};

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

const GREY_TONE = { accent: NOVA.quiet, deep: NOVA.quiet, subtle: NOVA.soft };

// 脇カード。3状態: 通常(クリック可) / comingSoon(機能未実装、プランは足りている) /
// locked(プラン不足)。comingSoon・lockedはどちらもクリック不可＝onClickを渡さない。
function SideCard({ icon: Icon, tone, title, desc, badge, badgeTone = "accent", state = "normal", onClick, onPlanClick, stats }) {
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
        {/* PageHeaderのチップ(修了/学習中の件数)から移設。ヘッダーからは削除し情報だけ残す
            （2026-08-14、ADR0014の数値羅列廃止方針に伴う。旧PageHeaderの表示先を差し替えた） */}
        {stats && <p className="mt-0.5 text-[11px]" style={{ color: NOVA.quiet }}>{stats}</p>}
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

// 開発演習の中の「ひとりで／チームで」。どちらの形式があるかをHomeで分かるようにする
// （2026-08-21、承認モック mock/learning-home）。
function DevLabMode({ tone, icon, tag, title, desc, linkLabel, locked, onClick, onPlanClick }) {
  const Icon = icon;
  return (
    <button
      type="button"
      onClick={locked ? onPlanClick : onClick}
      className="flex-1 p-4 text-left transition hover:bg-black/[.02]"
    >
      <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-bold"
        style={{ background: tone.subtle, color: tone.deep }}>
        <Icon size={11} />{tag}
      </span>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[13.5px] font-bold" style={{ color: NOVA.ink }}>{title}</span>
        {locked && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: NOVA.soft, color: NOVA.muted }}>Standard</span>
        )}
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: NOVA.muted }}>{desc}</p>
      <span className="mt-2 inline-block text-[11.5px] font-bold" style={{ color: PRODUCT_ACCENT.learning.deep }}>
        {locked ? "プランを見る ›" : `${linkLabel} ›`}
      </span>
    </button>
  );
}

// 2つの柱（Eラーニング／開発演習）。Eラーニングを表に出し、開発演習は中で
// 「ひとりで／チームで」に分けて見せる（2026-08-21、承認モック mock/learning-home）。
function PillarCard({ tone, kicker, title, desc, illustration, stats, actions, children }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[18px]" style={{ background: NOVA.card, border: `1px solid ${NOVA.line}` }}>
      <div className="grid gap-3 p-5 pb-4" style={{ gridTemplateColumns: "1fr 116px" }}>
        <div className="min-w-0">
          <span className="text-[11px] font-bold" style={{ letterSpacing: "0.1em", color: tone.deep }}>{kicker}</span>
          <h3 className="mt-1.5 text-xl font-bold leading-tight" style={{ color: NOVA.ink, letterSpacing: "-0.03em" }}>{title}</h3>
          <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: NOVA.muted }}>{desc}</p>
        </div>
        <div className="flex items-center justify-center">{illustration}</div>
      </div>
      {stats?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pb-3.5">
          {stats.map(s => (
            <span key={s} className="rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: NOVA.soft, color: NOVA.muted }}>{s}</span>
          ))}
        </div>
      )}
      {actions && <div className="mt-auto flex flex-wrap gap-2 px-5 pb-4">{actions}</div>}
      {children}
    </div>
  );
}

function HeroCard({ illustration, kicker, kickerTone, title, desc, actions, badge }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[18px]" style={{ background: NOVA.card, border: `1px solid ${NOVA.line}` }}>
      <div className="pt-4" style={{ background: `linear-gradient(140deg, ${kickerTone.subtle}, ${NOVA.paper})` }}>
        {illustration}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] font-bold" style={{ letterSpacing: "0.05em", color: kickerTone.deep }}>{kicker}</span>
          {badge && (
            <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
              style={{ background: kickerTone.subtle, color: kickerTone.deep }}>{badge}</span>
          )}
        </div>
        <h3 className="mt-1 mb-1.5 text-lg font-bold leading-snug" style={{ color: NOVA.ink }}>{title}</h3>
        <p className="mb-3.5 text-[13px] leading-relaxed" style={{ color: NOVA.muted }}>{desc}</p>
        <div className="mt-auto flex flex-wrap gap-2">{actions}</div>
      </div>
    </div>
  );
}

// 「案件参画体験（近日公開）」だったプラン制限の判定。2026-08-19にチーム開発が実装され
// 主役2へ昇格したため、ここは主役2の出し分けに使う（課金設計はADR0014のまま変えない）。
export function isTeamDevPlanLocked(role, learningPlan) {
  const unrestricted = role === "admin" || role === "instructor"; // ADR0013: モードにゲートしない
  return !unrestricted && learningPlan === "basic";
}

// role/学習プランから脇カード3枚の状態を組み立てる
function buildSideCards({ role, isCreator, learningPlan, goSub, goProduct, completedCount, inprogressCount, earnedSkillsCount }) {
  const unrestricted = role === "admin" || role === "instructor"; // ADR0013: モードにゲートしない
  const aiCourseLocked = !unrestricted && (learningPlan === "basic" || learningPlan === "standard");

  const skill = {
    icon: SkillIcon, tone: PRODUCT_ACCENT.talent,
    title: "スキル・成長",
    desc: isCreator || role === "client"
      ? "受講生の保有スキルと強みを、案件参画向けのシートで確認します。"
      : "身につけたスキルを記録し、案件参画向けのシートに整えます。",
    // 取得スキル数は**自分が学習する人の数字**。講師・管理者・企業担当には出さない
    stats: isCreator || role === "client" ? undefined : `取得スキル${earnedSkillsCount}件`,
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
    title: "Eラーニング",
    desc: isCreator ? "コースを作って公開し、受講状況を確認します。" : "コースを受講して、理解度テストで定着を確認します。",
    stats: isCreator ? undefined : `修了${completedCount}本 ・ 学習中${inprogressCount}本`,
    // goSubは行き先を検証しない。ナビにある画面だけへ送る
    state: "normal", onClick: () => goSub(isCreator ? "el_manage" : "el_courses"),
  };
  // 2026-08-19: 主役が2軸（学ぶ／チームで開発する）になり、Eラーニングとチーム開発は
  // 主役側へ移った。脇はそれ以外の3枚だけにする。
  // 2026-09-15: 案件管理を非表示にしたため、脇カードからも外した
  if (role === "client") return [skill, aiCourse];
  return [elearning, skill, aiCourse];
}

// 2026-08-19: 主役を2軸にした（ユーザー指定「2軸な感じでアピールしてもいいかも」）。
// チーム開発が実装・本番稼働したため、「案件参画体験（近日公開）」の脇カードを廃止し、
// 主役2へ昇格させている。2軸は
//   軸1 ひとりで鍛える  = 開発演習（DevLab）／clientはEラーニング
//   軸2 チームで開発する = チーム開発
// 案件参画体験の残りのフェーズ（要件受け取り・設計・レビュー・成果記録）はまだ構想段階なので、
// 「案件参画体験」ではなく実装済みの「チーム開発」として出す（ROADMAP参照）。
export default function LearningMagazineHome({ role, isCreator, canUseDevLab, learningPlan, goSub, goProduct, onShowPlanNotice, lrn, completedCount = 0, inprogressCount = 0, earnedSkillsCount = 0 }) {
  const heroIsDevLab = canUseDevLab; // trainee/instructor/admin。clientはEラーニングが軸1
  const devLabTarget = () => goSub(isCreator ? "el_devlab_manage" : "el_devlab");
  const showTrial = !isCreator && learningPlan === "basic"; // Basic契約のtrainee/clientのみ（DevLab自体は常に体験可）
  const teamDevLocked = isTeamDevPlanLocked(role, learningPlan);
  // trainee=自分のチーム / instructor・admin・client=チームの編成と進捗
  // 2026-09-05: instructor/adminのナビは「開発演習の管理」1項目へ統合したので、
  // el_devlab_teams はナビに無い＝goSubしても弾かれる。clientのナビには残っている
  const teamDevTarget = () => goSub(
    role === "trainee" ? "el_devlab_myteam"
      : role === "client" ? "el_devlab_teams" : "el_devlab_manage",
  );

  const sideCards = buildSideCards({ role, isCreator, learningPlan, goSub, goProduct, completedCount, inprogressCount, earnedSkillsCount });

  // 2026-08-21 リデザイン（承認モック: mock/learning-home）。
  // Eラーニングを表に出し、開発演習と2枚の柱にする。開発演習の中は「ひとりで／チームで」。
  const elearningPillar = (
    <PillarCard
      tone={PRODUCT_ACCENT.learning}
      kicker="読んで理解する"
      title="Eラーニング"
      desc={isCreator
        ? "コースを作って公開し、受講状況を確認します。受講生からの見え方は各コースのプレビューで確かめられます。"
        : role === "client"
          ? "自社の受講生が学べるコースです。受講状況や理解度もここから把握できます。"
          : "スライドで学び、その場で演習して、総合テストで確かめます。修了するとスキルと修了証が残ります。"}
      illustration={<ElearningIllustration />}
      // 受講中/修了/取得スキルは**自分が学習する人の数字**。講師・管理者・企業担当には出さない
      stats={isCreator || role === "client" ? [] : [`受講中 ${inprogressCount}本`, `修了 ${completedCount}本`, `取得スキル ${earnedSkillsCount}件`]}
      // goSubは行き先を検証しないので、**そのロールのナビにある画面だけ**を出す。
      // 講師・管理者のナビは「コース管理／受講状況」で、コース一覧・修了済みは無い
      actions={isCreator ? (<>
        <Btn onClick={() => goSub("el_manage")}>コース管理</Btn>
        <Btn kind="ghost" onClick={() => goSub("el_students")}>受講状況</Btn>
      </>) : (<>
        <Btn onClick={() => goSub("el_courses")}>コース一覧</Btn>
        <Btn kind="ghost" onClick={() => goSub("el_completed")}>修了済み</Btn>
      </>)}
    />
  );

  const devlabPillar = canUseDevLab ? (
    <PillarCard
      tone={PRODUCT_ACCENT.talent}
      kicker="手を動かす"
      title="開発演習"
      desc={isCreator
        ? "架空のクライアント案件をつくって、受講生の提出をステップごとに確認できます。環境構築は不要です。"
        : "ブラウザ上でコードを書いて動かします。ひとりで解く課題と、チームで1つのコードベースを触る開発の2種類。"}
      illustration={<DevLabIllustration />}
    >
      <div className="mt-auto grid border-t sm:grid-cols-2" style={{ borderColor: NOVA.line }}>
        <DevLabMode
          tone={PRODUCT_ACCENT.talent}
          icon={UserRound}
          tag="ひとりで"
          title={isCreator ? "課題・プロジェクト体験の管理" : "課題・プロジェクト体験"}
          desc={showTrial
            ? "Basicプランでは3問まで体験できます。"
            : "AIがすぐ採点して、どこを直せばいいか教えてくれます。"}
          linkLabel={isCreator ? "案件を確認する" : "課題を見る"}
          onClick={devLabTarget}
        />
        <div className="border-t sm:border-l sm:border-t-0" style={{ borderColor: NOVA.line }}>
          <DevLabMode
            tone={PRODUCT_ACCENT.matching}
            icon={UsersRound}
            tag="チームで"
            title="チーム開発"
            desc="ブランチ・取り込み・衝突の解消まで、現場と同じ流れを体験できます。"
            linkLabel={role === "trainee" ? "チームを開く" : "チームを見る"}
            locked={teamDevLocked}
            onClick={teamDevTarget}
            onPlanClick={onShowPlanNotice}
          />
        </div>
      </div>
    </PillarCard>
  ) : (
    // clientは開発演習の対象外。代わりにチーム開発（自社社員のハンズオン）だけを出す。
    <PillarCard
      tone={PRODUCT_ACCENT.matching}
      kicker="チームで開発する"
      title="チーム開発"
      desc="自社の社員をチームに編成して、ハンズオン形式の研修ができます。誰が何をコミットしたかを進捗として追えます。"
      illustration={<TeamDevIllustration />}
      actions={teamDevLocked
        ? <Btn kind="ghost" onClick={onShowPlanNotice}>プランを見る</Btn>
        : <Btn onClick={teamDevTarget}>チームを見る</Btn>}
    />
  );

  return (
    <>
      <div className="mb-3.5 grid gap-3.5 lg:grid-cols-2">
        {elearningPillar}
        {devlabPillar}
      </div>

      {/* 2026-09-08: 「あなたの道のり」（全員同じ5段の絵）をやめ、目標と到達度への導線にした。
          目標と到達度の画面ができて役目が重なったため（ユーザー指摘）。
          絵は場所を取るわりに、次に何をすればいいかを言えていなかった。 */}
      <RoadmapEntry lrn={lrn} onOpen={() => goSub("el_roadmap")} />

      <div className="mb-6 grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
        {sideCards.map(c => (
          <SideCard key={c.title} icon={c.icon} tone={c.tone} title={c.title} desc={c.desc} stats={c.stats}
            badge={c.badge} badgeTone={c.badgeTone} state={c.state} onClick={c.onClick}
            onPlanClick={onShowPlanNotice} />
        ))}
      </div>
    </>
  );
}
