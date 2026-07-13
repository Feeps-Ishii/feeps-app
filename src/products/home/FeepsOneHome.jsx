import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BarChart3, BookOpen, Briefcase, CalendarDays,
  CheckCircle2, FileText, Megaphone, RefreshCw, School, TrendingUp
} from "lucide-react";
import { apiGet } from "../../api.js";
import { Badge, Btn, Card, T, PRODUCT_ACCENT, ROLE_ACCENT } from "../../components/common";

const ROLE_WELCOME = {
  instructor: "今日の授業と受講生の状態を確認しましょう。",
  trainee: "今日の学習、提出、コメントを確認しましょう。",
  client: "自社受講生の出席、提出、成長状況を確認しましょう。",
  admin: "全体運営、未処理、コストの状態を確認しましょう。",
};

const ROLE_LABEL = {
  instructor: "講師",
  trainee: "受講生",
  client: "企業担当者",
  admin: "管理者",
};

// プロダクト紹介セクション用データ（Phase7-5: ランディングページ風の全面再設計）。
// featuresが空の製品はsmallカードのみに割り当てられ、箇条書きは表示しない。
const PRODUCT_INTRO = [
  {
    key: "training", label: "研修管理", icon: School,
    tagline: "受講生・企業・講師をひとつの画面で。日々の運営をスムーズにします。",
    features: ["日報・勤怠をロール別に自動集計", "企業担当者は自社の受講生だけを閲覧", "カリキュラム・テストを一元管理"],
  },
  {
    key: "learning", label: "Eラーニング", icon: BookOpen,
    tagline: "AIがコース設計からスライド作成まで。教材づくりの時間を大幅に削減します。",
    features: ["AIが学習目標からレッスンを自動生成", "PDF/PowerPointをそのままスライド化"],
  },
  {
    key: "talent", label: "スキル・成長", icon: TrendingUp,
    tagline: "研修の成果を、そのままキャリアの資産に。",
    features: [],
  },
  {
    key: "matching", label: "案件管理", icon: Briefcase,
    tagline: "育った人材を、次の現場へつなげる。",
    features: [],
  },
  {
    key: "analytics", label: "分析・レポート", icon: BarChart3,
    tagline: "研修運営とAI利用のコストを、ひと目で把握。",
    features: [],
  },
];

// ロール別のカード構成: primaryは[key, size]の並び順どおりに縦積みする大型/中型カード、
// secondaryは3列グリッドの小型カード。recommendedは「おすすめ」バッジを付けるkey一覧。
const PRODUCT_LAYOUT_BY_ROLE = {
  admin: { primary: [["training", "large"], ["learning", "large"]], secondary: ["talent", "matching", "analytics"], recommended: ["training", "learning"] },
  instructor: { primary: [["training", "large"], ["learning", "medium"]], secondary: [], recommended: [] },
  client: { primary: [["training", "large"]], secondary: [], recommended: [] },
  // 受講生は日常利用頻度の高い研修管理(日報・勤怠)を先に表示する。サイズはlearning=large/training=mediumを維持。
  trainee: { primary: [["training", "medium"], ["learning", "large"]], secondary: [], recommended: [] },
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

function Hero({ role, displayName, contextLine }) {
  const roleAccent = ROLE_ACCENT[role] || ROLE_ACCENT.default;
  // 正式版デザイン方針（再調整、Phase7-4）: 黒基調は企業向けSaaSとして重く見えるため、
  // 白〜淡いブルー〜ブランドブルーの明るいグラデーションへ変更。文字は濃色（T.textPrimary/T.textSecondary）
  // で統一し、Welcomeメッセージを主役にして余白を広くとる（Microsoft 365 / Azure Portal / Notion / Linear
  // 系の明るく洗練された企業向けSaaSトーン）。PRODUCT_ACCENT.training/adminの濃いブランドブルーとは別に、
  // Home自体は白地を主役にした固有のグラデーションを直接組み立てる（既存トークンT.bgSurface/accentSubtle/accentのみ使用）。
  const heroBg = `linear-gradient(120deg, ${T.bgSurface} 0%, ${T.accentSubtle} 48%, ${T.accent} 100%)`;
  return (
    <section className="overflow-hidden rounded-[24px] p-5 sm:p-10" style={{ background: heroBg, border: `1px solid ${T.border}`, boxShadow: "0 14px 36px rgba(61,107,255,.12)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: "rgba(26,28,32,0.08)" }}>
        <div className="flex min-w-0 items-center gap-3">
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
        </div>
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.75)", color: T.textSecondary, border: `1px solid ${T.border}` }}>
          <CalendarDays size={14} />
          {dateLabel()}
        </div>
      </div>

      {/* プロダクト紹介型リニューアル（Phase7-5）: 右側のLearning Journeyチップは新設のプロダクト紹介
          セクションと内容が重複するため削除し、Welcomeメッセージのみのシンプルな挨拶バナーへ整理。 */}
      <div className="pt-6 sm:pt-8">
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: T.accent }}>研修・学習・成長を、ひとつに。</div>
        <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>
          {displayName}さん、おかえりなさい。
        </h1>
        <p className="mt-3 text-sm leading-relaxed sm:text-base" style={{ color: T.textSecondary }}>{contextLine}</p>
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
            <Btn size={isLarge ? "md" : "sm"} kind="soft" icon={ArrowRight} onClick={onClick}>{product.label}を開く</Btn>
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
        <Btn size="sm" kind="ghost" icon={ArrowRight} full onClick={onClick}>{product.label}を開く</Btn>
      </div>
    </Card>
  );
}

function ProductShowcase({ role, goProduct }) {
  const layout = PRODUCT_LAYOUT_BY_ROLE[role] || PRODUCT_LAYOUT_BY_ROLE.trainee;
  const byKey = key => PRODUCT_INTRO.find(product => product.key === key);
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
  const traineeCourses = asArray(dashboard?.activeCourses);
  const traineeAnnouncements = asArray(dashboard?.dailyAnnouncements);
  const traineeComments = asArray(dashboard?.comments);

  const primaryCourse = textOf(todayCourses[0]?.courseName);
  const traineePrimaryCourse = textOf(traineeCourses[0]?.courseName);
  const contextLine = role === "instructor" && primaryCourse
    ? `今日は${primaryCourse}があります。`
    : role === "trainee" && traineePrimaryCourse
      ? `今日は${traineePrimaryCourse}の状況を確認できます。`
    : ROLE_WELCOME[role] || ROLE_WELCOME.trainee;

  const openDashboardTarget = (targetUrl) => openTargetUrl(targetUrl, { goProduct, goTraining, goSub });

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <Hero role={role} displayName={displayName} contextLine={contextLine} />

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
