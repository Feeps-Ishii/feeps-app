import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BarChart3, BookOpen, Briefcase, CalendarDays,
  CheckCircle2, FileText, Megaphone, RefreshCw, School, Sparkles, TrendingUp, Users
} from "lucide-react";
import { apiGet } from "../../api.js";
import { Badge, Btn, Card, T, PRODUCT_ACCENT, ROLE_ACCENT } from "../../components/common";

const ROLE_LABEL = {
  instructor: "講師",
  trainee: "受講生",
  client: "企業担当者",
  admin: "管理者",
};

// バナーの特徴バッジ。ロール共通・プロダクト全体の強みを短く伝える（マーケティング用途、機能一覧ではない）。
const HERO_FEATURE_BADGES = ["AI搭載", "オールインワン管理", "リアルタイム集計"];

// Heroバナー背景の装飾アイコン（Phase7-5: 写真を使わない軽量なイラスト風装飾）。
// 各製品を象徴するアイコンを低opacityで散らし配置する。テキストより背面に置くため
// z-indexはHero側で明示的に管理する（position:absolute要素はDOM順に関わらず
// 静的コンテンツより手前に来るため、本文側にも relative z-[1] を付けて明示的に上へ出す）。
const HERO_DECORATIONS = [
  { icon: School, size: 132, style: { top: "-18px", right: "8%" }, rotate: -12, opacity: 0.1, float: true },
  { icon: BookOpen, size: 84, style: { top: "46%", right: "26%" }, rotate: 14, opacity: 0.09, float: false },
  { icon: Users, size: 66, style: { top: "6%", right: "38%" }, rotate: 8, opacity: 0.12, float: true },
  { icon: Sparkles, size: 56, style: { bottom: "4%", right: "4%" }, rotate: -14, opacity: 0.15, float: false },
  { icon: BarChart3, size: 74, style: { bottom: "10%", right: "44%" }, rotate: 16, opacity: 0.08, float: true },
];

// プロダクトのkey/label/icon(ロール共通、テキストのみロール別)。Product色・アイコンは
// PRODUCT_ACCENT/このmapに揃え、ロールごとに差し替えない（PC上部タブ・サイドバー・
// Bottom Navigationと同じ見た目にするため）。
const PRODUCT_META = {
  training: { label: "研修管理", icon: School },
  learning: { label: "Eラーニング", icon: BookOpen },
  talent: { label: "スキル・成長", icon: TrendingUp },
  matching: { label: "案件管理", icon: Briefcase },
  analytics: { label: "分析・レポート", icon: BarChart3 },
};

// ロール別のキャッチコピー・特徴・CTA文言。本人が実際にできることだけを書き、他ロールの
// 内部管理機能・AI生成の裏側・閲覧監視機能は見せない（唯一の例外: 講師・管理者向け
// Eラーニングカードでは「AI教材作成」を主機能として表示してよい）。
// 2026-07-14 Home緊急修正: 旧PRODUCT_INTRO(ロール共通1本)を廃止しロール別へ分離。
const PRODUCT_INTRO_BY_ROLE = {
  admin: {
    training: {
      tagline: "企業・コース・受講生・講師をまとめて管理。研修全体の運営状況を確認できます。",
      features: ["企業・コース・ユーザーを一元管理", "日報・勤怠・テストを横断して確認", "コースごとの運営状況やアラートを把握"],
      cta: "研修管理を開く",
    },
    learning: {
      tagline: "オンライン教材と受講状況を一元管理。コース作成から公開まで行えます。",
      features: ["コース・Lesson・教材を管理", "AI Lesson Designer / AI Lesson Studioを利用", "受講状況・修了状況を確認"],
      cta: "Eラーニング管理を開く",
    },
    talent: {
      tagline: "研修と学習の成果を、スキルとして可視化。人材の成長状況を横断して確認できます。",
      features: ["受講生のスキル・資格・制作実績を確認", "成長履歴や自己PRを把握", "人材活用や案件連携へつなげる"],
      cta: "スキル・成長を開く",
    },
    matching: {
      tagline: "案件と人材をつなぎ、参画状況まで一元管理。スキルをもとに候補者を確認できます。",
      features: ["案件の登録・編集・公開", "候補者のマッチング結果を確認", "参画状況・履歴を管理"],
      cta: "案件管理を開く",
    },
    analytics: {
      tagline: "研修運営・AI利用・AWSコストをまとめて分析。全体の状況をデータで把握できます。",
      features: ["月次レポートとリスク分析", "AI利用回数・推定コスト", "AWS利用料金と運用状況"],
      cta: "分析・レポートを開く",
    },
  },
  instructor: {
    training: {
      tagline: "担当コースの授業運営を、ひとつの画面で。毎日の確認と受講生フォローを効率化します。",
      features: ["担当受講生の勤怠と日報を確認", "コメント・お知らせ・テスト結果を管理", "カリキュラム・教材・授業準備を整理"],
      cta: "担当研修を開く",
    },
    learning: {
      tagline: "担当コースの教材づくりと学習支援を効率化。Lessonやスライドを作成・改善できます。",
      features: ["担当コースのLesson・教材を編集", "AIでスライドを作成・レビュー", "受講状況や理解度を確認"],
      cta: "教材・学習状況を開く",
    },
    talent: {
      tagline: "担当受講生の成長を、授業やフォローに活用。スキル・目標・実績を確認できます。",
      features: ["担当受講生のスキルシートを確認", "目標・成長履歴・制作実績を把握", "学習成果を今後の指導へ活用"],
      cta: "受講生の成長を見る",
    },
  },
  client: {
    training: {
      tagline: "自社の受講生の研修状況を、いつでも確認。出席・日報・テスト結果をまとめて把握できます。",
      features: ["自社受講生の勤怠・出席状況を確認", "日報や講師コメントを閲覧", "テスト結果や研修の進み具合を把握"],
      cta: "自社の研修状況を見る",
    },
    learning: {
      tagline: "自社受講生のオンライン学習状況を確認。どの学習を進め、どこまで修了したか把握できます。",
      features: ["自社受講生の受講状況を確認", "学習中・修了済みコースを把握", "獲得スキルや修了実績を確認"],
      cta: "学習状況を見る",
    },
    talent: {
      tagline: "自社受講生の成長とスキルを見える化。研修後の人材活用にもつなげられます。",
      features: ["自社受講生のスキルシートを確認", "資格・制作実績・自己PRを把握", "研修成果をExcelで確認・共有"],
      cta: "自社受講生のスキルを見る",
    },
    matching: {
      tagline: "自社の案件と候補者を確認。人材のスキルと案件要件を照らし合わせられます。",
      features: ["自社案件を確認", "候補者のスキルマッチングを確認", "自社受講生の参画状況を把握"],
      cta: "案件・候補者を見る",
    },
  },
  trainee: {
    training: {
      tagline: "毎日の研修に必要なことを、ここから。勤怠・日報・テスト・教材へすぐ進めます。",
      features: ["出退勤を登録", "日報の作成・編集", "テスト・カリキュラム・研修資料を確認"],
      cta: "研修を開く",
    },
    learning: {
      tagline: "自分のペースで学び、知識とスキルを身につける。続きからすぐに学習できます。",
      features: ["受講中のコースを続きから学習", "クイズや総合テストで理解度を確認", "修了証・獲得スキルを確認"],
      cta: "学習を始める",
    },
    talent: {
      tagline: "学んだことを、これからのキャリアへ。自分のスキルや実績を育てられます。",
      features: ["スキル・資格・バッジを確認", "制作実績や自己PRを登録", "目標と成長履歴を振り返る"],
      cta: "自分の成長を見る",
    },
    matching: {
      tagline: "身につけたスキルを、次の仕事へ。自分に合う案件や参画状況を確認できます。",
      features: ["おすすめ案件を確認", "マッチング理由や不足スキルを把握", "自分の参画状況・履歴を確認"],
      cta: "おすすめ案件を見る",
    },
  },
};

// ロール別のカード構成: primaryは[key, size]の並び順どおりに縦積みする大型/中型カード、
// secondaryは3列グリッドの小型カード。recommendedは「おすすめ」バッジを付けるkey一覧。
// 表示Productは既存の上部タブ/サイドバー/Bottom Navigation(TrainingApp.jsxのPRODUCTS.roles)と
// 一致させる: admin=5(training/learning/talent/matching/analytics)、
// instructor=3(training/learning/talent、matchingとanalyticsは非表示)、
// client=4(training/learning/talent/matching)、trainee=4(同左)。
const PRODUCT_LAYOUT_BY_ROLE = {
  admin: { primary: [["training", "large"], ["learning", "large"]], secondary: ["talent", "matching", "analytics"], recommended: ["training", "learning"] },
  instructor: { primary: [["training", "large"], ["learning", "medium"]], secondary: ["talent"], recommended: [] },
  client: { primary: [["training", "large"]], secondary: ["learning", "talent", "matching"], recommended: [] },
  // 受講生は日常利用頻度の高い研修管理(日報・勤怠)を先に表示する。サイズはlearning=large/training=mediumを維持。
  trainee: { primary: [["training", "medium"], ["learning", "large"]], secondary: ["talent", "matching"], recommended: [] },
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function textOf(value, fallback = "") {
  if (value == null || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(v => textOf(v)).filter(Boolean).join(" / ") || fallback;
  if (typeof value === "object") {
    return textOf(value.title ?? value.name ?? value.label ?? value.text ?? value.message ?? value.content, fallback);
  }
  return fallback;
}

function dateLabel(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
}

function toTrainingView(url) {
  const text = String(url || "");
  if (text.includes("attendance")) return "attendance";
  if (text.includes("materials")) return "materials";
  if (text.includes("curriculum")) return "curriculum";
  if (text.includes("tests")) return "tests";
  if (text.includes("reports")) return "reports";
  if (text.includes("trainees") || text.includes("students")) return "trainees";
  return "home";
}

function openTargetUrl(targetUrl, { goProduct, goTraining, goSub }) {
  const text = String(targetUrl || "");
  if (text.includes("/learning")) {
    goProduct("learning");
    if (goSub) goSub(text.includes("courses") ? "el_courses" : "el_inprogress");
    return;
  }
  if (text.includes("/talent")) {
    goProduct("talent");
    if (goSub) goSub(text.includes("skills") ? "tl_skills" : "tl_growth");
    return;
  }
  if (text.includes("/matching")) {
    goProduct("matching");
    if (goSub) goSub("mt_home");
    return;
  }
  if (text.includes("/training")) {
    goProduct("training");
    goTraining(toTrainingView(text));
    return;
  }
  goProduct("training");
}

function SectionTitle({ title, desc, action }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold" style={{ color: T.textPrimary }}>{title}</h2>
        {desc && <p className="mt-1 text-sm" style={{ color: T.textMuted }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function Hero({ role, displayName }) {
  const roleAccent = ROLE_ACCENT[role] || ROLE_ACCENT.default;
  // 正式版デザイン方針（再調整、Phase7-4）: 黒基調は企業向けSaaSとして重く見えるため、
  // 白〜淡いブルー〜ブランドブルーの明るいグラデーションへ変更。文字は濃色（T.textPrimary/T.textSecondary）
  // で統一する（Microsoft 365 / Azure Portal / Notion / Linear系の明るく洗練された企業向けSaaSトーン）。
  // PRODUCT_ACCENT.training/adminの濃いブランドブルーとは別に、Home自体は白地を主役にした固有のグラデーションを
  // 直接組み立てる（既存トークンT.bgSurface/accentSubtle/accentのみ使用）。
  const heroBg = `linear-gradient(120deg, ${T.bgSurface} 0%, ${T.accentSubtle} 48%, ${T.accent} 100%)`;
  return (
    <section className="relative overflow-hidden rounded-[24px] p-5 sm:p-10" style={{ background: heroBg, border: `1px solid ${T.border}`, boxShadow: "0 14px 36px rgba(61,107,255,.12)" }}>
      {/* イラスト風背景装飾（Phase7-5）: 写真は使わず、製品を象徴するアイコンを低opacityで散らして
          奥行きを出す。pointer-events-noneでクリックを妨げず、本文側のrelative z-[1]より背面に置く。 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {HERO_DECORATIONS.map(({ icon: Icon, size, style, rotate, opacity, float }, i) => (
          <Icon
            key={i}
            size={size}
            strokeWidth={1.4}
            className={`absolute ${float ? "feeps-float" : ""}`}
            style={{ ...style, color: T.textPrimary, opacity, transform: `rotate(${rotate}deg)`, animationDuration: `${7 + i}s` }}
          />
        ))}
      </div>

      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: "rgba(26,28,32,0.08)" }}>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: T.accent, color: "#fff" }}>
            <TrendingUp size={20} />
          </span>
          <div className="min-w-0">
            <div className="text-lg font-extrabold leading-none" style={{ color: T.textPrimary }}>Feeps One</div>
            <div className="mt-1 text-xs font-semibold" style={{ color: T.textMuted }}>Integrated Training & Growth Platform</div>
          </div>
          <span className="ml-1 rounded-full px-3 py-1 text-xs font-bold" style={{ background: roleAccent.subtle, color: roleAccent.accent }}>
            {ROLE_LABEL[role] || role}
          </span>
          {/* ログイン中であることが分かる程度の小さな個人名表示（Phase7-5: バナーの主役はプロダクト紹介） */}
          <span className="text-xs font-semibold" style={{ color: T.textMuted }}>{displayName}さん</span>
        </div>
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.75)", color: T.textSecondary, border: `1px solid ${T.border}` }}>
          <CalendarDays size={14} />
          {dateLabel()}
        </div>
      </div>

      {/* プロダクト紹介型バナー（Phase7-5）: 個人向け挨拶ではなく製品全体の価値訴求を主役にする。
          全ロール共通のマーケティング文言＋特徴バッジのみで構成し、ロール別の個別文言は持たない。 */}
      <div className="relative z-[1] pt-6 sm:pt-8">
        <h1 className="text-3xl font-bold leading-tight sm:text-5xl" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>
          研修・学習・成長を、ひとつに。
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: T.textSecondary }}>
          研修管理からEラーニング、スキル可視化、案件連携まで。人材育成の全工程をワンプラットフォームで。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {HERO_FEATURE_BADGES.map(badge => (
            <span key={badge} className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(255,255,255,0.75)", color: T.accentHover, border: `1px solid ${T.border}` }}>
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductHeroCard({ product, size, iconSide, recommended, onClick }) {
  const pa = PRODUCT_ACCENT[product.key] || PRODUCT_ACCENT.training;
  const Icon = product.icon;
  const isLarge = size === "large";
  // large/mediumの大小差はアイコンブロックの高さ・アイコンサイズ・文字サイズの3軸で明確に付ける。
  // アイコンブロックはproduct固有のgradFrom/gradTo（PageHeader.jsx等で既に使われているブランド色）を
  // フルブリードの背景として使い、白アイコンでコントラストを強める（既存トークンのみ使用、新規色なし）。
  const iconBlockSizeClass = isLarge ? "h-44 sm:h-auto sm:w-1/3 sm:min-h-[260px]" : "h-24 sm:h-auto sm:w-[28%] sm:min-h-[140px]";
  const iconSize = isLarge ? 72 : 36;
  const contentPadClass = isLarge ? "p-6 sm:p-9" : "p-5 sm:p-6";
  return (
    <Card className="overflow-hidden p-0">
      <div className={`flex flex-col ${iconSide === "right" ? "sm:flex-row-reverse" : "sm:flex-row"}`}>
        <div className={`flex shrink-0 items-center justify-center ${iconBlockSizeClass}`} style={{ background: `linear-gradient(135deg, ${pa.gradFrom} 0%, ${pa.gradTo} 100%)` }}>
          <Icon size={iconSize} color="#fff" strokeWidth={1.6} />
        </div>
        <div className={`min-w-0 flex-1 ${contentPadClass}`}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={isLarge ? "text-2xl font-bold sm:text-[28px]" : "text-lg font-bold"} style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>{product.label}</h3>
            {recommended && <Badge>おすすめ</Badge>}
          </div>
          <p className={isLarge ? "mt-3 text-base font-semibold leading-relaxed sm:text-lg" : "mt-2 text-sm leading-relaxed"} style={{ color: T.textSecondary }}>{product.tagline}</p>
          {product.features.length > 0 && (
            <ul className={isLarge ? "mt-4 space-y-2.5" : "mt-3 space-y-1.5"}>
              {product.features.map(feature => (
                <li key={feature} className={isLarge ? "flex items-start gap-2 text-sm font-medium sm:text-base" : "flex items-start gap-2 text-xs"} style={{ color: T.textSecondary }}>
                  <CheckCircle2 size={isLarge ? 18 : 14} className="mt-0.5 shrink-0" style={{ color: pa.deep }} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          )}
          <div className={isLarge ? "mt-6" : "mt-4"}>
            <Btn size={isLarge ? "md" : "sm"} kind="soft" icon={ArrowRight} onClick={onClick}>{product.cta}</Btn>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProductSmallCard({ product, onClick }) {
  const pa = PRODUCT_ACCENT[product.key] || PRODUCT_ACCENT.training;
  const Icon = product.icon;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: pa.subtle, color: pa.deep }}>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>{product.label}</h3>
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: T.textSecondary }}>{product.tagline}</p>
      </div>
      <div className="mt-auto pt-1">
        <Btn size="sm" kind="ghost" icon={ArrowRight} full onClick={onClick}>{product.cta}</Btn>
      </div>
    </Card>
  );
}

function ProductShowcase({ role, goProduct }) {
  const layout = PRODUCT_LAYOUT_BY_ROLE[role] || PRODUCT_LAYOUT_BY_ROLE.trainee;
  const introByKey = PRODUCT_INTRO_BY_ROLE[role] || PRODUCT_INTRO_BY_ROLE.trainee;
  // ロール別コピーが未定義のkeyはHome非表示が前提（PRODUCT_LAYOUT_BY_ROLEにも含めない想定）。
  // 万一layoutとの不整合があっても壊れないよう、intro未定義ならnullを返しカード自体を出さない。
  const byKey = key => {
    const meta = PRODUCT_META[key];
    const intro = introByKey[key];
    if (!meta || !intro) return null;
    return { key, ...meta, ...intro };
  };
  return (
    <section>
      <SectionTitle title="Feeps Oneでできること" desc="ロールに合わせて利用できる機能をご紹介します。" />
      <div className="flex flex-col gap-5">
        {layout.primary.map(([key, size], index) => {
          const product = byKey(key);
          if (!product) return null;
          return (
            <ProductHeroCard
              key={key}
              product={product}
              size={size}
              iconSide={index % 2 === 0 ? "left" : "right"}
              recommended={layout.recommended.includes(key)}
              onClick={() => goProduct(key)}
            />
          );
        })}
      </div>
      {layout.secondary.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {layout.secondary.map(key => {
            const product = byKey(key);
            if (!product) return null;
            return <ProductSmallCard key={key} product={product} onClick={() => goProduct(key)} />;
          })}
        </div>
      )}
    </section>
  );
}

export default function FeepsOneHome({ role, displayName, goProduct, goTraining, goSub }) {
  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const loadDashboard = useMemo(() => async () => {
    const path = role === "instructor" ? "/dashboard/instructor" : role === "trainee" ? "/dashboard/trainee" : "";
    if (!path) return;
    setLoadingDashboard(true);
    setDashboardError("");
    try {
      setDashboard(await apiGet(path));
    } catch (e) {
      setDashboard(null);
      setDashboardError(e?.errorMessage || e?.message || "Dashboard APIの取得に失敗しました。");
    } finally {
      setLoadingDashboard(false);
    }
  }, [role]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const todayCourses = asArray(dashboard?.todayCourses);
  const traineeAnnouncements = asArray(dashboard?.dailyAnnouncements);
  const traineeComments = asArray(dashboard?.comments);

  const openDashboardTarget = (targetUrl) => openTargetUrl(targetUrl, { goProduct, goTraining, goSub });

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <Hero role={role} displayName={displayName} />

      {(role === "instructor" || role === "trainee") && dashboardError && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold" style={{ color: T.danger }}>Dashboard APIを取得できませんでした</div>
              <div className="mt-1 text-xs" style={{ color: T.textMuted }}>{dashboardError}</div>
            </div>
            <Btn size="sm" kind="ghost" icon={RefreshCw} onClick={loadDashboard}>再取得</Btn>
          </div>
        </Card>
      )}

      <ProductShowcase role={role} goProduct={goProduct} />

      {role === "instructor" && todayCourses.length > 0 && (
        <section className="order-5">
          <SectionTitle title="今日の担当コース" desc="詳細な編集や確認は研修管理Productで行います。" />
          <div className="grid gap-4 md:grid-cols-2">
            {todayCourses.slice(0, 2).map(course => (
              <Card key={textOf(course.courseId || course.courseName, "course")} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold" style={{ color: T.textPrimary }}>{textOf(course.courseName, "コース名未設定")}</h3>
                    <p className="mt-1 text-xs" style={{ color: T.textMuted }}>{textOf(course.companyName, "企業名未取得")} / {num(course.studentCount)}名</p>
                    <p className="mt-3 text-sm" style={{ color: T.textSecondary }}>{textOf(course.todayCurriculum, "今日の授業は未設定です。")}</p>
                  </div>
                  <Btn size="sm" kind="soft" icon={ArrowRight} onClick={() => {
                    goProduct("training");
                    goTraining(toTrainingView(course.links?.curriculum || course.links?.reports || "curriculum"));
                  }}>開く</Btn>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {role === "trainee" && traineeAnnouncements.length > 0 && (
        <section className="order-5">
          <SectionTitle title="本日のお知らせ" desc="担当講師から受講生向けに共有された連絡です。" />
          <div className="grid gap-4 md:grid-cols-2">
            {traineeAnnouncements.map(item => (
              <Card key={`${item.courseId}-${item.date}`} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: PRODUCT_ACCENT.training.subtle, color: PRODUCT_ACCENT.training.deep }}>
                    <Megaphone size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold" style={{ color: T.textPrimary }}>{textOf(item.courseName, "コース")}</div>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: T.textSecondary }}>{textOf(item.announcement)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {role === "trainee" && traineeComments.length > 0 && (
        <section className="order-6">
          <SectionTitle title="講師コメント" desc="日報に届いた最新のフィードバックです。" />
          <div className="grid gap-4 md:grid-cols-2">
            {traineeComments.slice(0, 2).map((item, index) => (
              <Card key={`${textOf(item.createdAt, index)}-${index}`} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: PRODUCT_ACCENT.training.subtle, color: PRODUCT_ACCENT.training.deep }}>
                    <FileText size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-bold" style={{ color: T.textPrimary }}>{textOf(item.authorName, "講師")}</div>
                      <Badge>日報コメント</Badge>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed" style={{ color: T.textSecondary }}>{textOf(item.body, textOf(item.text))}</p>
                    <div className="mt-3 flex justify-end">
                      <Btn size="sm" kind="ghost" icon={ArrowRight} onClick={() => openDashboardTarget(item.targetUrl || "/training/reports")}>日報で見る</Btn>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
