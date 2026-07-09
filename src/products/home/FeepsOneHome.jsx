import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, BarChart3, BookOpen, Briefcase, Building2, CalendarDays,
  CheckCircle2, ClipboardCheck, Clock, ExternalLink, FileText, GraduationCap,
  Megaphone, RefreshCw, Settings, Sparkles, Target, TrendingUp, Users
} from "lucide-react";
import { apiGet } from "../../api.js";
import { Badge, Btn, Card, SkeletonCards, T, PRODUCT_ACCENT, ROLE_ACCENT } from "../../components/common";

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

const RECOMMENDED = {
  instructor: ["training", "learning", "talent"],
  trainee: ["learning", "training", "talent", "matching"],
  client: ["training", "talent", "matching"],
  admin: ["admin", "analytics", "training", "learning", "talent", "matching"],
};

const PRODUCT_BY_ROLE = {
  instructor: ["training", "learning", "talent"],
  trainee: ["learning", "training", "talent", "matching"],
  client: ["training", "talent", "matching"],
  admin: ["admin", "analytics", "training", "learning", "talent", "matching"],
  default: ["training", "learning", "talent"],
};

const PRODUCTS = [
  { key: "training", label: "研修管理", value: "研修運営をスムーズに", tags: ["勤怠", "日報", "テスト", "カリキュラム"], icon: GraduationCap },
  { key: "learning", label: "Eラーニング", value: "学びを止めない", tags: ["教材", "AI Lesson", "理解度", "AI採点"], icon: BookOpen },
  { key: "talent", label: "スキル・成長", value: "成長を見える化する", tags: ["目標", "スキル", "成長履歴", "ポートフォリオ"], icon: TrendingUp },
  { key: "matching", label: "案件", value: "成長を仕事へつなげる", tags: ["案件候補", "スキル条件", "マッチング"], icon: Briefcase, note: "今後強化" },
  { key: "analytics", label: "分析", value: "研修成果を分析する", tags: ["AI利用", "AWS利用", "研修成果", "利用状況"], icon: BarChart3 },
  { key: "admin", label: "管理", value: "運営基盤を管理する", tags: ["企業", "ユーザー", "権限", "設定"], icon: Settings },
];

const JOURNEY = ["研修", "学習", "成長", "案件", "現場参画", "継続学習"];

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
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
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

function openProduct(key, { role, goProduct, goTraining }) {
  if (key === "admin") {
    goProduct("training");
    goTraining("home");
    return;
  }
  goProduct(key);
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

function SmallStatus({ label, value, hint, icon: Icon, tone = "home" }) {
  const pa = PRODUCT_ACCENT[tone] || PRODUCT_ACCENT.home;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: pa.subtle, color: pa.deep }}>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold" style={{ color: T.textMuted }}>{label}</div>
          <div className="mt-1 text-xl font-bold leading-none" style={{ color: T.textPrimary }}>{value}</div>
          {hint && <div className="mt-1 text-xs" style={{ color: T.textMuted }}>{hint}</div>}
        </div>
      </div>
    </Card>
  );
}

function TaskCard({ icon: Icon, title, value, desc, action, tone = "home", onClick, disabled }) {
  const pa = PRODUCT_ACCENT[tone] || PRODUCT_ACCENT.home;
  return (
    <Card className="p-4">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: pa.subtle, color: pa.deep }}>
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold" style={{ color: T.textPrimary }}>{title}</div>
            <div className="mt-1 text-xs leading-relaxed" style={{ color: T.textMuted }}>{desc}</div>
          </div>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="text-2xl font-bold tabular-nums" style={{ color: T.textPrimary }}>{value}</div>
          {action && (
            <Btn size="sm" kind={disabled ? "ghost" : "soft"} icon={disabled ? Lock : ArrowRight} onClick={onClick} disabled={disabled}>
              {action}
            </Btn>
          )}
        </div>
      </div>
    </Card>
  );
}

function Hero({ role, displayName }) {
  const roleAccent = ROLE_ACCENT[role] || ROLE_ACCENT.default;
  const heroBg = `linear-gradient(135deg, ${T.bgSurface} 0%, ${T.accentSubtle} 54%, ${PRODUCT_ACCENT.learning.subtle} 100%)`;
  return (
    <section className="overflow-hidden rounded-2xl p-5 sm:p-6" style={{ background: heroBg, border: `1px solid ${T.border}` }}>
      <div className="grid gap-5 lg:grid-cols-[1fr_430px] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Feeps One</Badge>
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: roleAccent.subtle, color: roleAccent.accent }}>{ROLE_LABEL[role] || role}</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl" style={{ color: T.textPrimary }}>研修・学習・成長を、ひとつに。</h1>
          <p className="mt-2 text-sm font-semibold" style={{ color: T.textSecondary }}>Integrated Training & Growth Platform</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm" style={{ color: T.textSecondary }}>
            <span>{displayName}さん、ようこそ。</span>
            <span className="hidden h-1 w-1 rounded-full sm:inline-block" style={{ background: T.textMuted }} />
            <span>{dateLabel()}</span>
          </div>
          <p className="mt-2 text-sm" style={{ color: T.textMuted }}>{ROLE_WELCOME[role] || ROLE_WELCOME.trainee}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
          <div className="text-xs font-bold uppercase" style={{ color: T.textMuted }}>Learning Journey</div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {JOURNEY.map((step, index) => {
              const productKey = index < 1 ? "training" : index < 2 ? "learning" : index < 3 ? "talent" : index < 5 ? "matching" : "learning";
              const pa = PRODUCT_ACCENT[productKey];
              return (
                <div key={step} className="relative rounded-xl px-3 py-2 text-sm font-bold" style={{ background: pa.subtle, color: pa.deep }}>
                  <span className="mr-2 text-xs tabular-nums">{index + 1}</span>{step}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: T.textMuted }}>研修で終わらず、現場参画後の継続学習まで循環させる入口です。</p>
        </div>
      </div>
    </section>
  );
}

function ProductNavigator({ role, goProduct, goTraining }) {
  const availableKeys = PRODUCT_BY_ROLE[role] || PRODUCT_BY_ROLE.default;
  const recommended = RECOMMENDED[role] || PRODUCT_BY_ROLE.default;
  const ordered = availableKeys.map(key => PRODUCTS.find(product => product.key === key)).filter(Boolean);
  return (
    <section>
      <SectionTitle title="利用できるサービス" desc="あなたのロールで利用できるサービスへ移動できます。" />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map(product => {
          const pa = PRODUCT_ACCENT[product.key] || PRODUCT_ACCENT.training;
          const recommendedHere = recommended.includes(product.key);
          const Icon = product.icon;
          return (
            <Card key={product.key} className="p-5 sm:p-6">
              <div className="flex min-h-[190px] flex-col gap-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: pa.subtle, color: pa.deep }}>
                    <Icon size={27} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold" style={{ color: T.textPrimary }}>{product.label}</h3>
                      {recommendedHere && <Badge>おすすめ</Badge>}
                      {product.note && <Badge>{product.note}</Badge>}
                    </div>
                    <p className="mt-1 text-sm" style={{ color: T.textSecondary }}>{product.value}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map(tag => (
                    <span key={tag} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: T.bgBase, color: T.textSecondary }}>{tag}</span>
                  ))}
                </div>
                <div className="mt-auto">
                  <Btn size="sm" kind="soft" icon={ExternalLink} onClick={() => openProduct(product.key, { role, goProduct, goTraining })}>
                    開く
                  </Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export default function FeepsOneHome({ role, displayName, goProduct, goTraining }) {
  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const loadDashboard = useMemo(() => async () => {
    if (role !== "instructor") return;
    setLoadingDashboard(true);
    setDashboardError("");
    try {
      setDashboard(await apiGet("/dashboard/instructor"));
    } catch (e) {
      setDashboard(null);
      setDashboardError(e?.errorMessage || e?.message || "講師Dashboard APIの取得に失敗しました。");
    } finally {
      setLoadingDashboard(false);
    }
  }, [role]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const summary = dashboard?.summary || {};
  const todayCourses = asArray(dashboard?.todayCourses);
  const lessonPrep = asArray(dashboard?.lessonPrep);
  const pendingReports = num(summary.pendingReports);
  const attendanceAlerts = num(summary.attendanceAlerts);
  const activeStudents = num(summary.activeStudents);
  const assignedCourses = num(summary.assignedCourses);

  const instructorTaskClick = (view) => {
    goProduct("training");
    goTraining(view);
  };

  const todoCards = role === "instructor" ? [
    { icon: Megaphone, title: "本日のお知らせ", value: todayCourses.some(c => textOf(c?.dailyNote)) ? "登録済" : "未実装", desc: "講師から受講生への日次連絡。登録APIは未実装です。", action: "研修管理へ", tone: "training", onClick: () => instructorTaskClick("home") },
    { icon: Clock, title: "勤怠確認", value: `${attendanceAlerts}件`, desc: "欠席・遅刻・未打刻などを確認します。", action: "確認する", tone: "training", onClick: () => instructorTaskClick("attendance") },
    { icon: FileText, title: "日報確認", value: `${pendingReports}件`, desc: "未確認の日報を一覧で確認します。", action: "確認する", tone: "training", onClick: () => instructorTaskClick("reports") },
    { icon: ClipboardCheck, title: "授業準備", value: `${lessonPrep.length || todayCourses.length}件`, desc: "今日のカリキュラム・教材・テストを開きます。", action: "開く", tone: "learning", onClick: () => instructorTaskClick("curriculum") },
  ] : role === "trainee" ? [
    { icon: Clock, title: "勤怠登録", value: "各Productで確認", desc: "自分の打刻・勤怠は研修管理で確認します。", action: "研修管理へ", tone: "training", onClick: () => openProduct("training", { role, goProduct, goTraining }) },
    { icon: FileText, title: "未提出日報", value: "準備中", desc: "集約APIは今後追加予定です。", action: "研修管理へ", tone: "training", onClick: () => openProduct("training", { role, goProduct, goTraining }) },
    { icon: BookOpen, title: "前回の続き", value: "各Productで確認", desc: "学習の続きはEラーニングで確認します。", action: "Learningへ", tone: "learning", onClick: () => openProduct("learning", { role, goProduct, goTraining }) },
    { icon: ClipboardCheck, title: "未受験テスト", value: "準備中", desc: "テスト状況のHome集約は今後対応します。", action: "研修管理へ", tone: "training", onClick: () => openProduct("training", { role, goProduct, goTraining }) },
  ] : role === "client" ? [
    { icon: Clock, title: "出席状況", value: "研修管理で確認", desc: "自社受講生の勤怠を確認します。", action: "開く", tone: "training", onClick: () => openProduct("training", { role, goProduct, goTraining }) },
    { icon: FileText, title: "日報提出", value: "研修管理で確認", desc: "提出状況とコメントを確認します。", action: "開く", tone: "training", onClick: () => openProduct("training", { role, goProduct, goTraining }) },
    { icon: ClipboardCheck, title: "テスト結果", value: "研修管理で確認", desc: "自社受講生の結果を確認します。", action: "開く", tone: "training", onClick: () => openProduct("training", { role, goProduct, goTraining }) },
    { icon: Sparkles, title: "コメント確認", value: "研修管理で確認", desc: "講師コメントは研修管理で確認します。", action: "開く", tone: "talent", onClick: () => openProduct("training", { role, goProduct, goTraining }) },
  ] : [
    { icon: CheckCircle2, title: "未処理アラート", value: "管理画面で確認", desc: "全体運営の未処理は管理画面で確認します。", action: "管理へ", tone: "admin", onClick: () => openProduct("admin", { role, goProduct, goTraining }) },
    { icon: Building2, title: "企業/コース管理", value: "管理へ", desc: "企業・コース・ユーザーを管理します。", action: "管理へ", tone: "admin", onClick: () => openProduct("admin", { role, goProduct, goTraining }) },
    { icon: Activity, title: "AI利用", value: "分析で確認", desc: "AI利用状況は分析Productで確認します。", action: "分析へ", tone: "analytics", onClick: () => openProduct("analytics", { role, goProduct, goTraining }) },
    { icon: BarChart3, title: "AWS利用", value: "分析で確認", desc: "AWSコストは分析Productで確認します。", action: "分析へ", tone: "analytics", onClick: () => openProduct("analytics", { role, goProduct, goTraining }) },
  ];

  const statusCards = role === "instructor" ? [
    { label: "担当コース", value: loadingDashboard ? "取得中" : `${assignedCourses}件`, hint: dashboardError ? "取得失敗" : "担当範囲", icon: GraduationCap, tone: "training" },
    { label: "受講生数", value: loadingDashboard ? "取得中" : `${activeStudents}名`, hint: "担当コース内", icon: Users, tone: "training" },
    { label: "未確認日報", value: loadingDashboard ? "取得中" : `${pendingReports}件`, hint: "今日見るもの", icon: FileText, tone: "training" },
    { label: "勤怠異常", value: loadingDashboard ? "取得中" : `${attendanceAlerts}件`, hint: "確認が必要", icon: Clock, tone: "training" },
  ] : role === "trainee" ? [
    { label: "受講中コース", value: "各Productで確認", hint: "研修管理", icon: GraduationCap, tone: "training" },
    { label: "学習進捗", value: "準備中", hint: "Learning集約は今後対応", icon: BookOpen, tone: "learning" },
    { label: "未提出", value: "未取得", hint: "研修管理で確認", icon: FileText, tone: "training" },
    { label: "現在目標", value: "準備中", hint: "Talentで確認", icon: Target, tone: "talent" },
  ] : role === "client" ? [
    { label: "自社受講生", value: "研修管理で確認", hint: "自社範囲", icon: Users, tone: "training" },
    { label: "出席率", value: "未取得", hint: "研修管理で確認", icon: Clock, tone: "training" },
    { label: "提出率", value: "未取得", hint: "研修管理で確認", icon: FileText, tone: "training" },
    { label: "進捗", value: "準備中", hint: "Talent連携予定", icon: TrendingUp, tone: "talent" },
  ] : [
    { label: "企業数", value: "管理画面で確認", hint: "Administration", icon: Building2, tone: "admin" },
    { label: "受講者数", value: "管理画面で確認", hint: "Administration", icon: Users, tone: "admin" },
    { label: "AI利用", value: "分析で確認", hint: "Analytics", icon: Activity, tone: "analytics" },
    { label: "AWS利用", value: "分析で確認", hint: "Analytics", icon: BarChart3, tone: "analytics" },
  ];

  return (
    <div className="space-y-7">
      <Hero role={role} displayName={displayName} />

      {role === "instructor" && dashboardError && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold" style={{ color: T.danger }}>講師Dashboard APIを取得できませんでした</div>
              <div className="mt-1 text-xs" style={{ color: T.textMuted }}>{dashboardError}</div>
            </div>
            <Btn size="sm" kind="ghost" icon={RefreshCw} onClick={loadDashboard}>再取得</Btn>
          </div>
        </Card>
      )}

      <section>
        <SectionTitle title="今日やること" desc="まず確認するものだけを並べています。" />
        {role === "instructor" && loadingDashboard && !dashboard ? (
          <SkeletonCards count={4} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {todoCards.map(card => <TaskCard key={card.title} {...card} />)}
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          title="現在の状況"
          desc="Homeでは状態把握に必要な最小限だけ表示します。"
          action={role === "instructor" ? <Btn size="sm" kind="ghost" icon={RefreshCw} onClick={loadDashboard} disabled={loadingDashboard}>更新</Btn> : null}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statusCards.map(card => <SmallStatus key={card.label} {...card} />)}
        </div>
      </section>

      {role === "instructor" && todayCourses.length > 0 && (
        <section>
          <SectionTitle title="今日の担当コース" desc="詳細な編集や確認は研修管理Productで行います。" />
          <div className="grid gap-4 md:grid-cols-2">
            {todayCourses.slice(0, 2).map(course => (
              <Card key={textOf(course.courseId || course.courseName, "course")} className="p-4">
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

      <ProductNavigator role={role} goProduct={goProduct} goTraining={goTraining} />
    </div>
  );
}
