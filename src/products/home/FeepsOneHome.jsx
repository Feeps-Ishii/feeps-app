import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BookOpen, Briefcase, BarChart3, School, TrendingUp,
  CheckCircle2, Circle, Clock, ClipboardCheck, MessageSquare, ListChecks,
  FileText, Megaphone, RefreshCw, ChevronRight, Users,
} from "lucide-react";
import { apiGet } from "../../api.js";
import { Badge, Btn, Card, T, PRISM, PRISM_PRODUCT_GRAD } from "../../components/common";

// プロダクトのkey/label/icon(ロール共通、テキストのみロール別)。Product色・アイコンは
// PRISM_PRODUCT_GRAD/このmapに揃え、ロールごとに差し替えない（PC上部タブ・サイドバー・
// Bottom Navigation・下部Dockと同じ見た目にするため）。
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
  trainee: { primary: [["training", "medium"], ["learning", "large"]], secondary: ["talent", "matching"], recommended: [] },
};

// 勤怠・日報ステータスの短い日本語ラベル（Dashboard APIの生ステータス値をそのまま出さない）
const ATT_LABEL = { completed: "退勤済み", working: "出勤中", not_clocked_in: "未打刻", absent: "欠席", late: "遅刻", early_leave: "早退", unknown: "確認中" };
const REPORT_LABEL = { commented: "コメントあり", submitted: "提出済み", not_submitted: "未提出" };
const TODO_ICON = {
  report_unchecked: FileText, report_uncommented: MessageSquare, attendance_alert: Clock,
  test_pending_review: ClipboardCheck, test_unsubmitted: ClipboardCheck, test_low_score: ClipboardCheck,
  follow_up_students: Users, lesson_prep: BookOpen,
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

/* ===== 共通の見た目パーツ（Prism Bright／UIリデザインR3） ===== */
function SectionTitle({ title, desc, action }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold" style={{ color: PRISM.ink }}>{title}</h2>
        {desc && <p className="mt-1 text-sm" style={{ color: PRISM.mut }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function PBCard({ children, className = "", style = {}, hover }) {
  return (
    <Card hover={hover} className={className} style={{ border: `1px solid ${PRISM.line}`, borderRadius: 20, boxShadow: "0 1px 2px rgba(32,34,46,.04), 0 10px 30px rgba(60,80,180,.07)", ...style }}>
      {children}
    </Card>
  );
}

function CapLabel({ children }) {
  return <p className="mb-2.5 text-[11px] font-bold uppercase" style={{ color: PRISM.mut, letterSpacing: "0.06em" }}>{children}</p>;
}

function HomeHeading({ eyebrow, title }) {
  return (
    <div>
      {eyebrow && <p className="text-[13px] font-semibold" style={{ color: PRISM.sub }}>{eyebrow}</p>}
      <h1 className="mt-1 text-[26px] font-extrabold sm:text-[30px]" style={{ color: PRISM.ink, letterSpacing: "-0.025em" }}>{title}</h1>
    </div>
  );
}

function ErrorRetryCard({ message, onRetry }) {
  return (
    <PBCard className="p-4" style={{ background: PRISM.badSubtle, borderColor: "rgba(226,92,80,.3)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold" style={{ color: PRISM.bad }}>データを取得できませんでした</div>
          <div className="mt-1 text-xs" style={{ color: PRISM.sub }}>{message}</div>
        </div>
        <Btn size="sm" kind="ghost" icon={RefreshCw} onClick={onRetry}>再取得</Btn>
      </div>
    </PBCard>
  );
}

function SeverityChip({ severity, children }) {
  const map = {
    critical: { bg: PRISM.badSubtle, fg: PRISM.bad },
    warning: { bg: PRISM.warnSubtle, fg: PRISM.warn },
    info: { bg: "#EFF0F4", fg: PRISM.sub },
  };
  const c = map[severity] || map.info;
  return <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: c.bg, color: c.fg }}>{children}</span>;
}

function StatusDot({ status }) {
  if (status === "done") return <CheckCircle2 size={19} className="shrink-0" style={{ color: PRISM.ok }} />;
  if (status === "needs_action") return <Circle size={19} className="shrink-0" style={{ color: PRISM.warn }} />;
  if (status === "unavailable") return <Circle size={19} className="shrink-0" style={{ color: PRISM.mut }} />;
  return <Circle size={19} className="shrink-0" style={{ color: PRISM.accent }} />;
}

function ProgressRing({ percent, size = 112, stroke = 11, from, to, gradId, sub }) {
  const has = percent != null && Number.isFinite(percent);
  const clamped = has ? Math.max(0, Math.min(100, percent)) : 0;
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - clamped / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ECEEF6" strokeWidth={stroke} />
        {has && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 1s ease" }} />
        )}
        <defs><linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient></defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span className="text-2xl font-extrabold" style={{ color: T.textPrimary, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{has ? `${Math.round(clamped)}%` : "—"}</span>
        {sub && <span className="mt-0.5 truncate text-[10.5px] font-semibold leading-tight" style={{ color: PRISM.mut, maxWidth: size - 20 }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ===== Product紹介カード（admin/client向けHomeの主要導線。実データではなく機能紹介なので
   実際にできることのみを記載する。カード自体の彩色はPRISM_PRODUCT_GRADに統一） ===== */
function ProductHeroCard({ product, size, iconSide, recommended, onClick }) {
  const grad = PRISM_PRODUCT_GRAD[product.key] || PRISM.gradHome;
  const Icon = product.icon;
  const isLarge = size === "large";
  const iconBlockSizeClass = isLarge ? "h-44 sm:h-auto sm:w-1/3 sm:min-h-[260px]" : "h-24 sm:h-auto sm:w-[28%] sm:min-h-[140px]";
  const iconSize = isLarge ? 72 : 36;
  const contentPadClass = isLarge ? "p-6 sm:p-9" : "p-5 sm:p-6";
  return (
    <PBCard className="overflow-hidden p-0">
      <div className={`flex flex-col ${iconSide === "right" ? "sm:flex-row-reverse" : "sm:flex-row"}`}>
        <div className={`flex shrink-0 items-center justify-center ${iconBlockSizeClass}`} style={{ background: grad }}>
          <Icon size={iconSize} color="#fff" strokeWidth={1.6} />
        </div>
        <div className={`min-w-0 flex-1 ${contentPadClass}`}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={isLarge ? "text-2xl font-bold sm:text-[28px]" : "text-lg font-bold"} style={{ color: PRISM.ink, letterSpacing: "-0.02em" }}>{product.label}</h3>
            {recommended && <Badge>おすすめ</Badge>}
          </div>
          <p className={isLarge ? "mt-3 text-base font-semibold leading-relaxed sm:text-lg" : "mt-2 text-sm leading-relaxed"} style={{ color: PRISM.sub }}>{product.tagline}</p>
          {product.features.length > 0 && (
            <ul className={isLarge ? "mt-4 space-y-2.5" : "mt-3 space-y-1.5"}>
              {product.features.map(feature => (
                <li key={feature} className={isLarge ? "flex items-start gap-2 text-sm font-medium sm:text-base" : "flex items-start gap-2 text-xs"} style={{ color: PRISM.sub }}>
                  <CheckCircle2 size={isLarge ? 18 : 14} className="mt-0.5 shrink-0" style={{ color: PRISM.accentDeep }} />
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
    </PBCard>
  );
}

function ProductSmallCard({ product, onClick }) {
  const grad = PRISM_PRODUCT_GRAD[product.key] || PRISM.gradHome;
  const Icon = product.icon;
  return (
    <PBCard className="flex flex-col gap-3 p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: grad }}>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold" style={{ color: PRISM.ink, letterSpacing: "-0.02em" }}>{product.label}</h3>
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: PRISM.sub }}>{product.tagline}</p>
      </div>
      <div className="mt-auto pt-1">
        <Btn size="sm" kind="ghost" icon={ArrowRight} full onClick={onClick}>{product.cta}</Btn>
      </div>
    </PBCard>
  );
}

function ProductShowcase({ role, goProduct }) {
  const layout = PRODUCT_LAYOUT_BY_ROLE[role] || PRODUCT_LAYOUT_BY_ROLE.trainee;
  const introByKey = PRODUCT_INTRO_BY_ROLE[role] || PRODUCT_INTRO_BY_ROLE.trainee;
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

/* ===== 受講生Home（/dashboard/trainee の実データのみで構成。ダミーの連続日数やAI機能は
   バックエンドに対応するデータ/機能がまだ無いため表示しない） ===== */
function TraineeHome({ dashboard, displayName, goProduct, goTraining, goSub, loading, error, onRetry }) {
  const open = url => openTargetUrl(url, { goProduct, goTraining, goSub });
  const course = asArray(dashboard?.activeCourses)[0] || null;
  const todayCur = course?.todayCurriculum || null;
  const tasks = asArray(dashboard?.todayTasks);
  const tests = asArray(dashboard?.tests);
  const nextTest = tests[0] || null;
  const learning = dashboard?.learning || null;
  const attendance = dashboard?.attendance || null;
  const dailyReport = dashboard?.dailyReport || null;
  const announcements = asArray(dashboard?.dailyAnnouncements);
  const comments = asArray(dashboard?.comments);
  const testsDone = tests.filter(t => t.status !== "unsubmitted").length;

  return (
    <div className="flex flex-col gap-5">
      <HomeHeading eyebrow={course ? `${dateLabel()} · ${course.courseName}` : dateLabel()} title={`おはようございます、${displayName}さん`} />

      {error && <ErrorRetryCard message={error} onRetry={onRetry} />}

      {loading && !dashboard ? (
        <PBCard className="p-2"><div className="grid gap-3 p-2 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: PRISM.base }}>
            <span className="feeps-shimmer mb-2 block h-2.5 rounded" style={{ width: "40%" }} />
            <span className="feeps-shimmer block h-3.5 rounded" style={{ width: "65%" }} />
          </div>
        ))}</div></PBCard>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <PBCard className="p-6 sm:p-7" style={{ background: PRISM.gradHero, border: "none", color: "#fff", position: "relative", overflow: "hidden" }}>
              <span className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full" style={{ background: "rgba(255,255,255,.12)" }} />
              <div className="relative flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider opacity-85">TODAY · 今日の単元</p>
                  {todayCur?.title ? (
                    <>
                      <h2 className="mt-2 text-xl font-extrabold sm:text-2xl" style={{ letterSpacing: "-0.02em" }}>{todayCur.title}</h2>
                      {todayCur.summary && <p className="mt-1.5 max-w-xl text-sm opacity-90">{todayCur.summary}</p>}
                    </>
                  ) : (
                    <p className="mt-2 max-w-md text-sm opacity-90">{course ? "本日の単元はまだ登録されていません。" : "所属コースが登録されていません。管理者にご確認ください。"}</p>
                  )}
                  <div className="mt-5">
                    <Btn kind="white" icon={ArrowRight} onClick={() => open(course ? `/training/curriculum?courseId=${encodeURIComponent(course.courseId)}` : "/training")}>
                      {course ? "今日の教材を開く" : "研修管理を開く"}
                    </Btn>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2.5 rounded-2xl p-4 text-xs font-semibold" style={{ background: "rgba(255,255,255,.14)", minWidth: 170 }}>
                  <button type="button" onClick={() => open("/training/attendance")} className="flex items-center justify-between gap-4 text-left">
                    <span className="opacity-80">勤怠</span><span>{ATT_LABEL[attendance?.status] || "未確認"}</span>
                  </button>
                  <button type="button" onClick={() => open("/training/reports")} className="flex items-center justify-between gap-4 text-left">
                    <span className="opacity-80">日報</span><span>{REPORT_LABEL[dailyReport?.status] || "未確認"}</span>
                  </button>
                </div>
              </div>
            </PBCard>
          </div>

          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <PBCard className="flex h-full flex-col p-5">
              <CapLabel>学習進捗</CapLabel>
              <div className="flex flex-1 items-center gap-5">
                <ProgressRing percent={learning?.progressPercent ?? null} from={PRISM.accent} to={PRISM.teal} gradId="ring-learning" sub={learning?.currentLessonTitle} />
                <div className="min-w-0 text-xs font-semibold leading-loose" style={{ color: PRISM.sub }}>
                  <div>テスト <b className="tabular-nums" style={{ color: PRISM.ink }}>{testsDone}/{tests.length}</b></div>
                  <div>未受験 <b className="tabular-nums" style={{ color: PRISM.ink }}>{dashboard?.summary?.unsubmittedTests ?? 0}</b></div>
                </div>
              </div>
              {!learning && <p className="mt-2 text-[11px]" style={{ color: PRISM.mut }}>Eラーニングの学習履歴はまだありません。</p>}
            </PBCard>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <PBCard className="p-5">
              <CapLabel>今日やること</CapLabel>
              {tasks.length === 0 ? (
                <p className="text-xs" style={{ color: PRISM.mut }}>やることはありません。</p>
              ) : (
                <ul className="flex flex-col">
                  {tasks.map(t => (
                    <li key={t.type} className="flex items-center gap-2.5 border-b py-2.5 text-sm last:border-b-0" style={{ borderColor: PRISM.line }}>
                      <StatusDot status={t.status} />
                      <span className="min-w-0 flex-1 truncate" style={{ color: t.status === "done" ? PRISM.mut : PRISM.ink, textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.label}</span>
                      {t.actionLabel && t.status !== "done" && (
                        <button type="button" onClick={() => open(t.targetUrl)} className="shrink-0 text-xs font-bold" style={{ color: PRISM.accent }}>{t.actionLabel}</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </PBCard>
          </div>

          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <PBCard className="flex h-full flex-col p-5">
              <CapLabel>次のテスト</CapLabel>
              {nextTest ? (
                <>
                  <h3 className="text-[15px] font-bold" style={{ color: PRISM.ink }}>{nextTest.title}</h3>
                  <p className="mt-1 text-xs" style={{ color: PRISM.mut }}>
                    {nextTest.courseName}{nextTest.status === "completed" && nextTest.score != null ? ` · ${nextTest.score}/${nextTest.total}点` : ""}
                  </p>
                  <div className="mt-auto pt-3">
                    <Btn size="sm" kind="soft" icon={ArrowRight} onClick={() => open(nextTest.targetUrl)}>
                      {nextTest.status === "unsubmitted" ? "受験する" : "結果を見る"}
                    </Btn>
                  </div>
                </>
              ) : <p className="text-xs" style={{ color: PRISM.mut }}>現在対象のテストはありません。</p>}
            </PBCard>
          </div>

          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <PBCard className="flex h-full flex-col p-5" style={{ background: `linear-gradient(140deg, ${PRISM.aiSubtle}, #fff)`, borderColor: "rgba(139,124,246,.28)" }}>
              <p className="mb-2.5 text-[11px] font-bold uppercase" style={{ color: PRISM.aiDeep, letterSpacing: "0.06em" }}>講師コメント</p>
              {comments[0] ? (
                <>
                  <p className="line-clamp-3 text-sm leading-relaxed" style={{ color: PRISM.ink }}>{textOf(comments[0].body)}</p>
                  <p className="mt-2 text-[11px] font-semibold" style={{ color: PRISM.mut }}>{comments[0].authorName || "講師"}</p>
                  <div className="mt-auto pt-3"><Btn size="sm" kind="ghost" icon={ArrowRight} onClick={() => open(comments[0].targetUrl || "/training/reports")}>日報で見る</Btn></div>
                </>
              ) : <p className="text-xs" style={{ color: PRISM.mut }}>まだコメントはありません。</p>}
            </PBCard>
          </div>
        </div>
      )}

      {announcements.length > 0 && (
        <section>
          <SectionTitle title="本日のお知らせ" desc="担当講師から受講生向けに共有された連絡です。" />
          <div className="grid gap-4 sm:grid-cols-2">
            {announcements.map(item => (
              <PBCard key={`${item.courseId}-${item.date}`} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: PRISM_PRODUCT_GRAD.training }}><Megaphone size={18} /></span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold" style={{ color: PRISM.ink }}>{textOf(item.courseName, "コース")}</div>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: PRISM.sub }}>{textOf(item.announcement)}</p>
                  </div>
                </div>
              </PBCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ===== 講師Home（/dashboard/instructor の実データのみで構成） ===== */
function InstructorHome({ dashboard, displayName, goProduct, goTraining, goSub, loading, error, onRetry }) {
  const open = url => openTargetUrl(url, { goProduct, goTraining, goSub });
  const todos = asArray(dashboard?.todos);
  const followUps = asArray(dashboard?.followUps);
  const todayCourses = asArray(dashboard?.todayCourses);
  const scope = dashboard?.scope;
  const summary = dashboard?.summary || {};

  return (
    <div className="flex flex-col gap-5">
      <HomeHeading eyebrow={`${dateLabel()} · 担当 ${summary.assignedCourses ?? 0}コース`} title={`こんにちは、${displayName}さん`} />

      {error && <ErrorRetryCard message={error} onRetry={onRetry} />}

      {scope?.unassigned && (
        <PBCard className="p-5" style={{ background: PRISM.warnSubtle, borderColor: "rgba(221,148,38,.3)" }}>
          <p className="text-sm font-bold" style={{ color: PRISM.warn }}>担当コースが未設定です</p>
          <p className="mt-1 text-xs" style={{ color: PRISM.sub }}>管理者にコースの担当講師設定を依頼してください。</p>
        </PBCard>
      )}

      {loading && !dashboard ? (
        <PBCard className="p-2"><div className="grid gap-3 p-2 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: PRISM.base }}>
            <span className="feeps-shimmer mb-2 block h-2.5 rounded" style={{ width: "50%" }} />
            <span className="feeps-shimmer block h-5 rounded" style={{ width: "30%" }} />
          </div>
        ))}</div></PBCard>
      ) : (
        <>
          {todos.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {todos.slice(0, 4).map(t => {
                const Icon = TODO_ICON[t.type] || ListChecks;
                const tone = t.severity === "critical" ? PRISM.bad : t.severity === "warning" ? PRISM.warn : PRISM.ink;
                return (
                  <button key={t.type} type="button" onClick={() => open(t.targetUrl)} className="text-left">
                    <PBCard className="p-4" hover>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-bold" style={{ color: PRISM.sub }}>{t.label}</span>
                        <Icon size={14} className="shrink-0" style={{ color: tone }} />
                      </div>
                      <div className="mt-1.5 text-2xl font-extrabold tabular-nums" style={{ color: tone }}>{t.count}</div>
                    </PBCard>
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-7">
              <PBCard className="p-5">
                <CapLabel>要フォロー</CapLabel>
                {followUps.length === 0 ? (
                  <p className="text-xs" style={{ color: PRISM.mut }}>現在フォローが必要な受講生はいません。</p>
                ) : (
                  <ul className="flex flex-col">
                    {followUps.slice(0, 5).map(f => (
                      <li key={f.traineeId} className="flex items-center gap-3 border-b py-2.5 last:border-b-0" style={{ borderColor: PRISM.line }}>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: PRISM.accent }}>{String(f.traineeName || "?").slice(0, 1)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold" style={{ color: PRISM.ink }}>{f.traineeName}</div>
                          <div className="truncate text-xs" style={{ color: PRISM.mut }}>{f.courseName}</div>
                        </div>
                        <SeverityChip severity={f.severity}>{f.reasons?.[0]?.label || "要確認"}</SeverityChip>
                        <button type="button" onClick={() => open(f.targetUrl)} aria-label="詳細を見る"><ChevronRight size={16} style={{ color: PRISM.mut }} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </PBCard>
            </div>
            <div className="col-span-12 lg:col-span-5">
              <PBCard className="p-5">
                <CapLabel>担当コース</CapLabel>
                {todayCourses.length === 0 ? (
                  <p className="text-xs" style={{ color: PRISM.mut }}>担当コースがありません。</p>
                ) : (
                  <ul className="flex flex-col">
                    {todayCourses.slice(0, 4).map(c => (
                      <li key={c.courseId} className="border-b py-2.5 last:border-b-0" style={{ borderColor: PRISM.line }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-bold" style={{ color: PRISM.ink }}>{c.courseName}</span>
                          <span className="shrink-0 text-xs tabular-nums" style={{ color: PRISM.mut }}>{c.studentCount}名</span>
                        </div>
                        <p className="mt-1 truncate text-xs" style={{ color: PRISM.sub }}>{c.todayCurriculum?.title || "今日のカリキュラム未設定"}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3"><Btn size="sm" kind="ghost" icon={ArrowRight} full onClick={() => open("/training/curriculum")}>研修管理を開く</Btn></div>
              </PBCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ===== 管理者/企業担当者Home。横断ダッシュボードAPIが未実装のため、実際に使える機能への
   導線（ProductShowcase）で構成する（存在しない集計数値を演出で埋めない） ===== */
function ShowcaseHome({ role, displayName, goProduct }) {
  return (
    <div className="flex flex-col gap-6">
      <HomeHeading eyebrow={dateLabel()} title={`こんにちは、${displayName}さん`} />
      <ProductShowcase role={role} goProduct={goProduct} />
    </div>
  );
}

export default function FeepsOneHome({ role, displayName, goProduct, goTraining, goSub }) {
  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const loadDashboard = useMemo(() => async () => {
    const path = role === "instructor" ? "/dashboard/instructor" : role === "trainee" ? "/dashboard/trainee" : "";
    if (!path) { setDashboard(null); return; }
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

  if (role === "trainee") {
    return <TraineeHome dashboard={dashboard} displayName={displayName} goProduct={goProduct} goTraining={goTraining} goSub={goSub} loading={loadingDashboard} error={dashboardError} onRetry={loadDashboard} />;
  }
  if (role === "instructor") {
    return <InstructorHome dashboard={dashboard} displayName={displayName} goProduct={goProduct} goTraining={goTraining} goSub={goSub} loading={loadingDashboard} error={dashboardError} onRetry={loadDashboard} />;
  }
  return <ShowcaseHome role={role} displayName={displayName} goProduct={goProduct} />;
}
