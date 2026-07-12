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
  instructor: ["training", "learning", "talent", "matching"],
  trainee: ["learning", "training", "talent", "matching"],
  client: ["training", "talent", "matching"],
  admin: ["admin", "analytics", "training", "learning", "talent", "matching"],
};

const PRODUCT_BY_ROLE = {
  instructor: ["training", "learning", "talent", "matching"],
  trainee: ["learning", "training", "talent", "matching"],
  client: ["training", "talent", "matching"],
  admin: ["admin", "analytics", "training", "learning", "talent", "matching"],
  default: ["training", "learning", "talent"],
};

const PRODUCTS = [
  { key: "training", label: "研修管理", value: "研修運営をスムーズに", tags: ["勤怠", "日報", "テスト", "カリキュラム"], icon: GraduationCap },
  { key: "learning", label: "Eラーニング", value: "学びを止めない", tags: ["教材", "AI Lesson", "理解度", "AI採点"], icon: BookOpen },
  { key: "talent", label: "スキル・成長", value: "成長を見える化する", tags: ["目標", "スキル", "成長履歴", "ポートフォリオ"], icon: TrendingUp },
  { key: "matching", label: "案件", value: "成長を仕事へつなげる", tags: ["案件候補", "スキル条件", "マッチング"], icon: Briefcase },
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

function openProduct(key, { goProduct, goTraining }) {
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
  const valueText = textOf(value);
  const isLongValue = valueText.length > 12;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex h-full items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: pa.subtle, color: pa.deep }}>
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold" style={{ color: T.textMuted }}>{label}</div>
          <div className={isLongValue ? "mt-2 break-words text-base font-bold leading-snug" : "mt-2 text-2xl font-bold leading-none tabular-nums"} style={{ color: T.textPrimary }}>{valueText}</div>
          {hint && <div className="mt-2 text-xs leading-relaxed" style={{ color: T.textMuted }}>{hint}</div>}
        </div>
      </div>
    </Card>
  );
}

function TaskCard({ icon: Icon, title, value, desc, action, tone = "home", onClick, disabled }) {
  const pa = PRODUCT_ACCENT[tone] || PRODUCT_ACCENT.home;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: pa.subtle, color: pa.deep }}>
            <Icon size={19} />
          </span>
          <div className="min-w-0">
            <div className="text-base font-bold" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>{title}</div>
            <div className="mt-2 text-2xl font-bold leading-none tabular-nums" style={{ color: T.textPrimary }}>{value}</div>
          </div>
        </div>
        <div className="text-xs leading-relaxed" style={{ color: T.textMuted }}>{desc}</div>
        {action && (
          <div className="mt-auto pt-1">
            <Btn size="sm" kind={disabled ? "ghost" : "soft"} icon={ArrowRight} onClick={onClick} disabled={disabled} full>
              {action}
            </Btn>
          </div>
        )}
      </div>
    </Card>
  );
}

function Hero({ role, displayName, contextLine }) {
  const roleAccent = ROLE_ACCENT[role] || ROLE_ACCENT.default;
  const heroBg = `linear-gradient(135deg, ${T.bgSurface} 0%, ${T.accentSubtle} 58%, ${PRODUCT_ACCENT.learning.subtle} 100%)`;
  return (
    <section className="overflow-hidden rounded-[24px] p-4 sm:p-9" style={{ background: heroBg, border: `1px solid ${T.border}`, boxShadow: "0 14px 36px rgba(21,38,47,.07)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: T.border }}>
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
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: T.bgSurface, color: T.textSecondary, border: `1px solid ${T.border}` }}>
          <CalendarDays size={14} />
          {dateLabel()}
        </div>
      </div>

      <div className="grid gap-4 pt-4 sm:gap-6 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-end">
        <div className="min-w-0">
          <h1 className="hidden text-3xl font-semibold leading-tight sm:block sm:text-4xl" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>研修・学習・成長を、ひとつに。</h1>
          <p className="mt-2 hidden text-sm font-semibold sm:block" style={{ color: T.textSecondary }}>Integrated Training & Growth Platform</p>
          <div className="mt-0 rounded-2xl p-4 sm:mt-6 sm:p-5" style={{ background: "rgba(255,255,255,.72)", border: `1px solid ${T.border}` }}>
            <p className="text-base font-bold leading-relaxed" style={{ color: T.textPrimary }}>
              {displayName}さん、<br className="sm:hidden" />おかえりなさい。
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: T.textSecondary }}>{contextLine}</p>
          </div>
        </div>

        <div className="hidden rounded-2xl p-4 lg:block" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-bold uppercase" style={{ color: T.textMuted }}>Learning Journey</div>
            <Sparkles size={15} style={{ color: PRODUCT_ACCENT.learning.deep }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {JOURNEY.map((step, index) => {
              const productKey = index < 1 ? "training" : index < 2 ? "learning" : index < 3 ? "talent" : index < 5 ? "matching" : "learning";
              const pa = PRODUCT_ACCENT[productKey];
              return (
                <React.Fragment key={step}>
                  <div className="rounded-full px-2.5 py-1.5 text-xs font-semibold" style={{ background: pa.subtle, color: pa.deep }}>
                    {step}
                  </div>
                  {index < JOURNEY.length - 1 && <ArrowRight size={13} style={{ color: T.textMuted }} />}
                </React.Fragment>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: T.textMuted }}>研修で終わらず、現場参画後の継続学習まで循環させます。</p>
        </div>
      </div>
    </section>
  );
}

function ProductNavigator({ role, goProduct, goTraining, goSub }) {
  const availableKeys = PRODUCT_BY_ROLE[role] || PRODUCT_BY_ROLE.default;
  const recommended = RECOMMENDED[role] || PRODUCT_BY_ROLE.default;
  const ordered = availableKeys.map(key => PRODUCTS.find(product => product.key === key)).filter(Boolean);
  return (
    <section>
      <SectionTitle title="利用できるサービス" desc="あなたのロールで利用できるサービスへ移動できます。" />
      {/* モバイルは2列コンパクト（アイコン+名前、カード全体タップ）。sm以上は従来のリッチカード */}
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        {ordered.map(product => {
          const pa = PRODUCT_ACCENT[product.key] || PRODUCT_ACCENT.training;
          const Icon = product.icon;
          return (
            <Card key={product.key} hover onClick={() => openProduct(product.key, { goProduct, goTraining, goSub })} className="p-4">
              <div className="flex min-h-[56px] items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: pa.subtle, color: pa.deep }}>
                  <Icon size={20} />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>{product.label}</div>
                  <div className="mt-0.5 truncate text-[11px]" style={{ color: T.textMuted }}>{product.value}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="hidden gap-5 sm:grid md:grid-cols-2 xl:grid-cols-3">
        {ordered.map(product => {
          const pa = PRODUCT_ACCENT[product.key] || PRODUCT_ACCENT.training;
          const recommendedHere = recommended.includes(product.key);
          const Icon = product.icon;
          return (
            <Card key={product.key} className="p-6 sm:p-7" hover>
              <div className="flex min-h-[220px] flex-col gap-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl" style={{ background: pa.subtle, color: pa.deep }}>
                    <Icon size={30} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>{product.label}</h3>
                      {recommendedHere && <Badge>おすすめ</Badge>}
                      {product.note && <Badge>{product.note}</Badge>}
                    </div>
                    <p className="mt-2 text-sm font-semibold" style={{ color: T.textSecondary }}>{product.value}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map(tag => (
                    <span key={tag} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: T.bgBase, color: T.textSecondary }}>{tag}</span>
                  ))}
                </div>
                <div className="mt-auto pt-1">
                  <Btn size="sm" kind="soft" icon={ExternalLink} full onClick={() => openProduct(product.key, { goProduct, goTraining, goSub })}>
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

  // client/adminのHome指標は既存APIのフロント集計で表示する（specs/feeps-one-feature-role-matrix.md §D。専用Dashboard APIは将来拡張）
  const [ops, setOps] = useState(null);
  const [opsLoading, setOpsLoading] = useState(false);
  useEffect(() => {
    if (role !== "client" && role !== "admin") { setOps(null); return; }
    let alive = true;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const month = today.slice(0, 7);
    setOpsLoading(true);
    (async () => {
      try {
        if (role === "client") {
          const [trainees, attendance, reports, tests] = await Promise.all([
            apiGet("/trainees").catch(() => []),
            apiGet(`/attendance?date=${today}`).catch(() => []),
            apiGet(`/reports?date=${today}`).catch(() => []),
            apiGet("/tests").catch(() => []),
          ]);
          const activeTests = asArray(tests).filter(t => (t?.status || "published") !== "archived");
          const resultLists = await Promise.all(activeTests.map(t => apiGet(`/tests/${t.testId || t.id}/results`).catch(() => [])));
          const scores = resultLists.flatMap(r => asArray(r)).map(r => Number(r?.score)).filter(n => Number.isFinite(n));
          if (!alive) return;
          setOps({
            trainees: asArray(trainees).length,
            present: asArray(attendance).filter(a => a?.clockIn).length,
            reports: asArray(reports).length,
            avgScore: scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null,
            lowScores: scores.filter(n => n < 70).length,
          });
        } else {
          const [companies, users, courses, reports, attendance, aiUsage, awsCosts] = await Promise.all([
            apiGet("/companies").catch(() => []),
            apiGet("/admin/users").catch(() => []),
            apiGet("/courses").catch(() => []),
            apiGet(`/reports?date=${today}`).catch(() => []),
            apiGet(`/attendance?date=${today}`).catch(() => []),
            apiGet(`/admin/ai-usage?month=${month}`).catch(() => null),
            apiGet(`/admin/aws-costs?month=${month}`).catch(() => null),
          ]);
          const traineeUsers = asArray(users).filter(u => (u?.role || "trainee") === "trainee" && u?.deleted !== true);
          const reportIds = new Set(asArray(reports).map(r => r?.traineeId || r?.userId));
          const attIds = new Set(asArray(attendance).map(a => a?.traineeId || a?.userId));
          const absent = asArray(attendance).filter(a => /欠|absent/i.test(String(a?.status || ""))).length;
          // AdminProduct本日のアラートと同じ考え方（日報未保存+勤怠未登録+欠席）
          const alerts = traineeUsers.filter(t => !reportIds.has(t.userId)).length
            + traineeUsers.filter(t => !attIds.has(t.userId)).length
            + absent;
          if (!alive) return;
          setOps({
            companies: asArray(companies).length,
            trainees: traineeUsers.length,
            courses: asArray(courses).length,
            alerts,
            aiRequests: aiUsage?.totalRequests ?? null,
            aiCost: aiUsage?.totalEstimatedCostUsd ?? null,
            awsTotal: awsCosts?.total?.amount ?? null,
          });
        }
      } finally {
        if (alive) setOpsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [role]);
  const opsText = (make) => (opsLoading ? "取得中" : ops ? make(ops) : "未取得");

  const summary = dashboard?.summary || {};
  const todayCourses = asArray(dashboard?.todayCourses);
  const traineeCourses = asArray(dashboard?.activeCourses);
  const traineeTasks = asArray(dashboard?.todayTasks);
  const traineeAnnouncements = asArray(dashboard?.dailyAnnouncements);
  const traineeTests = asArray(dashboard?.tests);
  const traineeComments = asArray(dashboard?.comments);
  const lessonPrep = asArray(dashboard?.lessonPrep);
  const pendingReports = num(summary.pendingReports);
  const attendanceAlerts = num(summary.attendanceAlerts);
  const activeStudents = num(summary.activeStudents);
  const assignedCourses = num(summary.assignedCourses);
  const traineeActiveCourses = num(summary.activeCourses ?? traineeCourses.length);
  const traineeUnsubmittedTests = num(summary.unsubmittedTests ?? traineeTests.filter(t => t?.status === "unsubmitted").length);

  const primaryCourse = textOf(todayCourses[0]?.courseName);
  const traineePrimaryCourse = textOf(traineeCourses[0]?.courseName);
  const contextLine = role === "instructor" && primaryCourse
    ? `今日は${primaryCourse}があります。`
    : role === "trainee" && traineePrimaryCourse
      ? `今日は${traineePrimaryCourse}の状況を確認できます。`
    : ROLE_WELCOME[role] || ROLE_WELCOME.trainee;

  const instructorTaskClick = (view) => {
    goProduct("training");
    goTraining(view);
  };
  const openDashboardTarget = (targetUrl) => openTargetUrl(targetUrl, { goProduct, goTraining, goSub });
  const traineeTaskByType = new Map(traineeTasks.map(task => [task?.type, task]));
  const traineeTask = (types) => {
    const list = Array.isArray(types) ? types : [types];
    return list.map(type => traineeTaskByType.get(type)).find(Boolean) || null;
  };
  const traineeAttendanceTask = traineeTask(["attendance_checkin", "attendance_checked"]);
  const traineeReportTask = traineeTask(["daily_report_submit", "daily_report_submitted"]);
  const traineeLearningTask = traineeTask("continue_learning");
  const traineeTestTask = traineeTask("take_test");
  const traineeGoalTask = traineeTask("check_goal");
  const traineeLoadingText = loadingDashboard ? "取得中" : "確認する";

  const todoCards = role === "instructor" ? [
    { icon: Megaphone, title: "本日のお知らせ", value: todayCourses.some(c => textOf(c?.dailyNote)) ? "登録済" : "未登録", desc: "講師から受講生への日次連絡です。研修管理で登録します。", action: "研修管理へ", tone: "training", onClick: () => instructorTaskClick("home") },
    { icon: Clock, title: "勤怠確認", value: `${attendanceAlerts}件`, desc: "欠席・遅刻・未打刻など、今日確認したい勤怠です。", action: "確認する", tone: "training", onClick: () => instructorTaskClick("attendance") },
    { icon: FileText, title: "日報確認", value: `${pendingReports}件`, desc: "未確認の日報を一覧で確認します。", action: "確認する", tone: "training", onClick: () => instructorTaskClick("reports") },
    { icon: ClipboardCheck, title: "授業準備", value: `${lessonPrep.length || todayCourses.length}件`, desc: "今日のカリキュラム・教材・テストを開きます。", action: "開く", tone: "learning", onClick: () => instructorTaskClick("curriculum") },
  ] : role === "trainee" ? [
    { icon: Clock, title: "勤怠登録", value: textOf(traineeAttendanceTask?.status === "done" ? "登録済み" : traineeAttendanceTask?.status === "needs_action" ? "未登録" : traineeLoadingText), desc: textOf(traineeAttendanceTask?.description, dashboardError || "今日の勤怠状態を確認できます。"), action: textOf(traineeAttendanceTask?.actionLabel, "開く"), tone: "training", onClick: () => openDashboardTarget(traineeAttendanceTask?.targetUrl || "/training/attendance") },
    { icon: FileText, title: "日報提出", value: textOf(traineeReportTask?.status === "done" ? "提出済み" : traineeReportTask?.status === "needs_action" ? "未提出" : traineeLoadingText), desc: textOf(traineeReportTask?.description, "今日の日報状態を確認できます。"), action: textOf(traineeReportTask?.actionLabel, "開く"), tone: "training", onClick: () => openDashboardTarget(traineeReportTask?.targetUrl || "/training/reports") },
    { icon: BookOpen, title: Number(dashboard?.learning?.progressPercent) >= 100 ? "次の学習へ" : "前回の続き", value: dashboard?.learning?.progressPercent != null ? `${dashboard.learning.progressPercent}%` : textOf(traineeLearningTask?.status === "unavailable" ? "Learningで確認" : traineeLoadingText), desc: Number(dashboard?.learning?.progressPercent) >= 100 ? "修了しました。次のコースや復習に進めます。" : textOf(traineeLearningTask?.description, "学習の続きはEラーニングで確認できます。"), action: textOf(traineeLearningTask?.actionLabel, "Learningへ"), tone: "learning", onClick: () => openDashboardTarget(traineeLearningTask?.targetUrl || "/learning/inprogress") },
    { icon: ClipboardCheck, title: "未受験テスト", value: loadingDashboard ? "取得中" : `${traineeUnsubmittedTests}件`, desc: textOf(traineeTestTask?.description, "未受験テストを確認できます。"), action: textOf(traineeTestTask?.actionLabel, "開く"), tone: "training", onClick: () => openDashboardTarget(traineeTestTask?.targetUrl || "/training/tests") },
  ] : role === "client" ? [
    { icon: Users, title: "自社受講生", value: opsText(o => `${o.trainees}名`), desc: "自社範囲の受講生一覧を確認します。", action: "開く", tone: "training", onClick: () => instructorTaskClick("trainees") },
    { icon: Clock, title: "本日の出席", value: opsText(o => `${o.present}/${o.trainees}名`), desc: "本日の出席状況を確認します。", action: "開く", tone: "training", onClick: () => instructorTaskClick("attendance") },
    { icon: FileText, title: "日報提出", value: opsText(o => `${o.reports}/${o.trainees}名`), desc: "日報の提出状況とコメントを確認します。", action: "開く", tone: "training", onClick: () => instructorTaskClick("reports") },
    { icon: ClipboardCheck, title: "テスト結果", value: opsText(o => o.avgScore != null ? `平均${o.avgScore}点` : "結果なし"), desc: opsLoading || !ops ? "自社受講生の結果を確認します。" : `低スコア（70点未満）${ops.lowScores}件`, action: "開く", tone: "talent", onClick: () => instructorTaskClick("tests") },
  ] : [
    { icon: CheckCircle2, title: "未処理アラート", value: opsText(o => `${o.alerts}件`), desc: "本日の日報未保存・勤怠未登録・欠席の合計です。", action: "確認する", tone: "admin", onClick: () => instructorTaskClick("home") },
    { icon: Building2, title: "企業/コース管理", value: opsText(o => `${o.companies}社/${o.courses}件`), desc: "企業・コース・ユーザーを管理します。", action: "管理へ", tone: "admin", onClick: () => openProduct("admin", { goProduct, goTraining }) },
    { icon: Activity, title: "AI利用", value: opsText(o => o.aiRequests != null ? `${o.aiRequests}回` : "未取得"), desc: opsLoading || !ops || ops.aiCost == null ? "AI利用状況は分析Productで確認します。" : `今月の推定 $${Number(ops.aiCost).toFixed(4)}`, action: "分析へ", tone: "analytics", onClick: () => openProduct("analytics", { goProduct, goTraining }) },
    { icon: BarChart3, title: "AWS利用", value: opsText(o => o.awsTotal != null ? `$${Number(o.awsTotal).toFixed(2)}` : "未取得"), desc: "AWSコストは分析Productで確認します。", action: "分析へ", tone: "analytics", onClick: () => openProduct("analytics", { goProduct, goTraining }) },
  ];

  const statusCards = role === "instructor" ? [
    { label: "担当コース", value: loadingDashboard ? "取得中" : `${assignedCourses}件`, hint: dashboardError ? "取得失敗" : "担当範囲", icon: GraduationCap, tone: "training" },
    { label: "受講生数", value: loadingDashboard ? "取得中" : `${activeStudents}名`, hint: "担当コース内", icon: Users, tone: "training" },
    { label: "未確認日報", value: loadingDashboard ? "取得中" : `${pendingReports}件`, hint: "今日見るもの", icon: FileText, tone: "training" },
    { label: "勤怠異常", value: loadingDashboard ? "取得中" : `${attendanceAlerts}件`, hint: "確認が必要", icon: Clock, tone: "training" },
  ] : role === "trainee" ? [
    { label: "受講中コース", value: loadingDashboard ? "取得中" : `${traineeActiveCourses}件`, hint: textOf(traineeCourses[0]?.courseName, "研修管理で確認"), icon: GraduationCap, tone: "training" },
    { label: "学習進捗", value: dashboard?.summary?.learningProgress?.label || (loadingDashboard ? "取得中" : "Learningで確認"), hint: dashboard?.learning?.currentLessonTitle || "Eラーニングで確認", icon: BookOpen, tone: "learning" },
    { label: "日報状態", value: textOf(dashboard?.summary?.dailyReportStatus === "submitted" ? "提出済み" : dashboard?.summary?.dailyReportStatus === "commented" ? "コメントあり" : dashboard?.summary?.dailyReportStatus === "not_submitted" ? "未提出" : loadingDashboard ? "取得中" : "確認する"), hint: "今日の日報", icon: FileText, tone: "training" },
    { label: "現在目標", value: textOf(dashboard?.summary?.currentGoal?.title, loadingDashboard ? "取得中" : "スキル・成長で確認"), hint: textOf(traineeGoalTask?.description, "Talentで確認"), icon: Target, tone: "talent" },
  ] : role === "client" ? [
    { label: "自社受講生", value: opsText(o => `${o.trainees}名`), hint: "自社範囲", icon: Users, tone: "training" },
    { label: "本日出席率", value: opsText(o => o.trainees ? `${Math.round((o.present / o.trainees) * 100)}%` : "—"), hint: "本日の勤怠登録", icon: Clock, tone: "training" },
    { label: "日報提出率", value: opsText(o => o.trainees ? `${Math.round((o.reports / o.trainees) * 100)}%` : "—"), hint: "本日の日報", icon: FileText, tone: "training" },
    { label: "テスト平均", value: opsText(o => o.avgScore != null ? `${o.avgScore}点` : "結果なし"), hint: "自社受講生の結果", icon: ClipboardCheck, tone: "talent" },
  ] : [
    { label: "企業数", value: opsText(o => `${o.companies}社`), hint: "契約企業", icon: Building2, tone: "admin" },
    { label: "受講生数", value: opsText(o => `${o.trainees}名`), hint: "全体", icon: Users, tone: "admin" },
    { label: "AI利用", value: opsText(o => o.aiRequests != null ? `${o.aiRequests}回` : "未取得"), hint: "今月", icon: Activity, tone: "analytics" },
    { label: "AWS利用", value: opsText(o => o.awsTotal != null ? `$${Number(o.awsTotal).toFixed(2)}` : "未取得"), hint: "今月", icon: BarChart3, tone: "analytics" },
  ];

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      {/* モバイルは「今日やること」を最上段へ（order制御）。lg+は従来どおりHero先頭 */}
      <div className="order-2 lg:order-1">
        <Hero role={role} displayName={displayName} contextLine={contextLine} />
      </div>

      {(role === "instructor" || role === "trainee") && dashboardError && (
        <Card className="order-1 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold" style={{ color: T.danger }}>Dashboard APIを取得できませんでした</div>
              <div className="mt-1 text-xs" style={{ color: T.textMuted }}>{dashboardError}</div>
            </div>
            <Btn size="sm" kind="ghost" icon={RefreshCw} onClick={loadDashboard}>再取得</Btn>
          </div>
        </Card>
      )}

      <section className="order-1 lg:order-2">
        <SectionTitle title="今日やること" desc="まず確認するものだけを並べています。" />
        {(role === "instructor" || role === "trainee") && loadingDashboard && !dashboard ? (
          <SkeletonCards count={4} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {todoCards.map(card => <TaskCard key={card.title} {...card} />)}
          </div>
        )}
      </section>

      <div className="order-3">
        <ProductNavigator role={role} goProduct={goProduct} goTraining={goTraining} goSub={goSub} />
      </div>

      <section className="order-4">
        <SectionTitle
          title="現在の状況"
          desc="Homeでは状況把握に必要な最小限だけ表示します。"
          action={role === "instructor" ? <Btn size="sm" kind="ghost" icon={RefreshCw} onClick={loadDashboard} disabled={loadingDashboard}>更新</Btn> : null}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statusCards.map(card => <SmallStatus key={card.label} {...card} />)}
        </div>
      </section>

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
