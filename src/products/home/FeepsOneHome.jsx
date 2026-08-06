import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BookOpen, Building2, AlertCircle,
  Megaphone, ChevronRight, Users,
  Sparkles, ArrowUpRight, RefreshCw,
} from "lucide-react";
import { apiGet } from "../../api.js";
import { getActiveCourseId } from "../../utils/common/courseContext.js";
import {
  Btn, NOVA, PRISM, PRISM_PRODUCT_GRAD, PRODUCT_ACCENT,
  PrismSectionTitle as SectionTitle, PrismCard as PBCard,
  PrismCapLabel as CapLabel,
  PrismErrorRetryCard as ErrorRetryCard, PrismSeverityChip as SeverityChip,
  PrismStatusDot as StatusDot, PrismProgressRing as ProgressRing,
} from "../../components/common";

// 勤怠・日報ステータスの短い日本語ラベル（Dashboard APIの生ステータス値をそのまま出さない）
const ATT_LABEL = { completed: "退勤済み", working: "出勤中", not_clocked_in: "未打刻", absent: "欠席", late: "遅刻", early_leave: "早退", unknown: "確認中", not_applicable: "対象外", not_training_day: "本日は研修なし", setup_required: "日程設定待ち", conflict: "日程要確認" };
const REPORT_LABEL = { commented: "コメントあり", submitted: "提出済み", not_submitted: "未提出", not_applicable: "対象外" };

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

function parseTargetUrl(targetUrl) {
  try { return new URL(String(targetUrl || ""), "https://feeps.local"); }
  catch { return null; }
}

function openTargetUrl(targetUrl, { goProduct, goTraining, goSub }) {
  const parsed = parseTargetUrl(targetUrl);
  const path = parsed?.pathname || String(targetUrl || "");
  if (path.includes("/learning")) {
    goProduct("learning");
    if (goSub) goSub(path.includes("courses") ? "el_courses" : "el_inprogress");
    return;
  }
  if (path.includes("/talent")) {
    goProduct("talent");
    if (goSub) goSub(path.includes("skills") ? "tl_skills" : "tl_growth");
    return;
  }
  if (path.includes("/matching")) {
    goProduct("matching");
    if (goSub) goSub("mt_home");
    return;
  }
  if (path.includes("/training")) {
    const view = toTrainingView(path);
    const courseId = parsed?.searchParams.get("courseId") || "";
    const testId = parsed?.searchParams.get("testId") || "";
    const date = parsed?.searchParams.get("date") || "";
    goProduct("training", { preserveTarget: true });
    goTraining(view, { forceRemount: true, trainingTarget: { view, courseId, testId, date } });
    return;
  }
  goProduct("training");
}

const PRODUCT_COPY = {
  training: "カリキュラム・日報・勤怠を、ひとつの流れで管理します。",
  learning: "コース学習を進め、理解度と修了状況を確認します。",
  talent: "研修で得たスキルと成長の記録を可視化します。",
  matching: "身につけた力を、次の案件とキャリアにつなげます。",
  analytics: "研修成果・リスク・利用状況を横断して分析します。",
  grants: "助成金の申請・交付までを一元管理します。",
};

const ROLE_PORTAL_COPY = {
  trainee: {
    eyebrow: "YOUR LEARNING PORTAL",
    title: "今日の学びを、次の成長へ。",
    description: "研修を進め、記録し、身についた力を確認する。今日必要な場所へ、ここからすぐに移動できます。",
  },
  instructor: {
    eyebrow: "INSTRUCTOR PORTAL",
    title: "授業と受講生の今を、ひとつに。",
    description: "授業準備、日報、勤怠、受講生フォローをつなぎ、今日の研修運営を迷わず進められます。",
  },
  client: {
    eyebrow: "COMPANY LEARNING PORTAL",
    title: "研修の先にある成長まで、見渡せる。",
    description: "自社受講生の研修状況からスキル・案件活用まで、必要な情報へすばやくアクセスできます。",
  },
  admin: {
    eyebrow: "ADMIN COMMAND PORTAL",
    title: "Feeps One全体を、ここから動かす。",
    description: "研修運営、学習、スキル、案件、分析。すべての機能と今日の状況を、ひとつの入口に集約しました。",
  },
};

function metricValue(value, unit) {
  if (value == null) return "—";
  return `${value}${unit}`;
}

// 2026-07-21 監査P1(C-1)対応: dashboard取得中の「—」（一時的）と、取得失敗が続く「—」
// （unknown、要再試行）を見分けられるようタイトルを分ける。取得できていれば必ず実数（0でも）を表示する
function portalMetrics(role, dashboard, loading, hasError) {
  if (!dashboard) {
    const labels = {
      trainee: ["参加コース", "今日の未完了", "未受験テスト"],
      instructor: ["本日の研修", "対象受講生", "カリキュラム"],
      admin: ["稼働コース", "全受講生", "要確認"],
      client: ["自社受講生", "本日出席", "日報未提出"],
    }[role] || ["利用状況", "今日の対応", "要確認"];
    return labels.map(label => ({ label, value: "—", loading: !hasError, title: hasError ? "確認できません。再読み込みしてください。" : "読み込み中です。" }));
  }
  if (role === "trainee") {
    const todayCompletion = dashboard?.todayCompletion || null;
    const todayKnown = todayCompletion?.status === "completed" || todayCompletion?.status === "incomplete";
    const todayValue = todayKnown
      ? `${Math.max(0, Number(todayCompletion.requiredCount || 0) - Number(todayCompletion.completedCount || 0))}件`
      : todayCompletion?.status === "not_applicable" ? "対象外" : "—";
    return [
      { label: "参加コース", value: metricValue(dashboard?.availability?.courses === false ? null : asArray(dashboard?.activeCourses).length, "件", loading) },
      { label: "今日の未完了", value: todayValue },
      { label: "未受験テスト", value: metricValue(dashboard?.summary?.unsubmittedTests, "件", loading) },
    ];
  }
  if (role === "instructor") {
    const todayCourses = asArray(dashboard?.todayCourses);
    const todayStudents = todayCourses.reduce((sum, course) => sum + Number(course?.studentCount || 0), 0);
    const preparedCourses = todayCourses.filter(course => course?.todayCurriculum?.title).length;
    return [
      { label: "本日の研修", value: metricValue(todayCourses.length, "件", loading) },
      { label: "対象受講生", value: metricValue(todayStudents, "名", loading) },
      { label: "カリキュラム", value: todayCourses.length ? `${preparedCourses}/${todayCourses.length}件` : "対象なし" },
    ];
  }
  if (role === "admin") {
    const summary = dashboard?.summary || {};
    return [
      { label: "稼働コース", value: metricValue(summary.totalCourses, "件", loading) },
      { label: "全受講生", value: metricValue(summary.totalStudents, "名", loading) },
      { label: "要確認", value: metricValue(summary.coursesNeedingAttention, "件", loading) },
    ];
  }
  const summary = dashboard?.summary || {};
  return [
    { label: "自社受講生", value: metricValue(summary.traineeCount, "名", loading) },
    { label: "本日出席", value: metricValue(summary.attendanceOkToday, "名", loading) },
    { label: "日報未提出", value: metricValue(summary.unsubmittedReports, "名", loading) },
  ];
}

function nextPortalAction(role, dashboard) {
  if (!dashboard) {
    return role === "trainee"
      ? { label: "研修管理を開く", description: "今日の研修と提出状況を確認", targetUrl: "/training" }
      : role === "instructor"
        ? { label: "研修運営を開く", description: "担当コースと授業準備を確認", targetUrl: "/training" }
        : role === "client"
          ? { label: "自社の研修を開く", description: "受講生と研修状況を確認", targetUrl: "/training" }
          : { label: "研修管理を開く", description: "コースと運営状況を確認", targetUrl: "/training" };
  }
  if (role === "trainee") {
    const tasks = asArray(dashboard?.todayTasks);
    const nextTask = tasks.find(task => task.requiredToday === true && task.status === "needs_action" && task.targetUrl);
    if (nextTask) return { label: nextTask.actionLabel || nextTask.label || "次のタスクを開く", description: nextTask.label || "今日の未完了タスク", targetUrl: nextTask.targetUrl };
    if (dashboard?.todayCompletion?.status === "unknown") return { label: "研修状況を確認", description: "今日の勤怠・日報を再確認", targetUrl: "/training" };
    const activeCourses = asArray(dashboard?.activeCourses);
    const activeCourseId = getActiveCourseId();
    // 2026-07-21 監査P1(T-1)対応: 「今日の研修を開く」は今日実際に単元がある場合のみ表示する。
    // 非研修日にactiveCourses[0]へフォールバックしていた旧ロジックは、下部「今日の学習状況」
    // セクション（noTrainingToday表示）と同一画面内で矛盾していた。
    const todayCourse = activeCourses.find(item => item.courseId === activeCourseId && item.todayCurriculum)
      || activeCourses.find(item => item.todayCurriculum);
    if (todayCourse) {
      return { label: "今日の研修を開く", description: todayCourse.courseName || "所属コース", targetUrl: `/training/curriculum?courseId=${encodeURIComponent(todayCourse.courseId)}` };
    }
    if (activeCourses.length === 0) {
      return { label: "学習コースを見る", description: "公開中のコースを確認", targetUrl: "/learning/courses" };
    }
    const learningTargetUrl = dashboard?.learning?.targetUrl || "/learning";
    const allCoursesEnded = activeCourses.every(item => item.courseEnded === true);
    return allCoursesEnded
      ? { label: "復習・Eラーニングへ", description: "研修は終了しました。学んだ内容を復習できます。", targetUrl: learningTargetUrl }
      : { label: "Eラーニングを進める", description: "今日は研修日ではありません。学習を進めましょう。", targetUrl: learningTargetUrl };
  }
  if (role === "instructor") {
    const todayCourses = asArray(dashboard?.todayCourses);
    if (todayCourses.length === 0) {
      return { label: "研修管理を開く", description: "本日の担当研修はありません", targetUrl: "/training" };
    }
    const course = todayCourses.find(item => !item?.todayCurriculum?.title) || todayCourses[0];
    return {
      label: course?.todayCurriculum?.title ? "本日の担当研修を確認" : "授業準備を確認",
      description: course?.courseName || `${todayCourses.length}件の担当研修`,
      targetUrl: course?.courseId ? `/training/curriculum?courseId=${encodeURIComponent(course.courseId)}` : "/training/curriculum",
    };
  }
  if (role === "admin") {
    const attention = Number(dashboard?.summary?.coursesNeedingAttention || 0);
    return attention > 0
      ? { label: "要確認コースを見る", description: `${attention}件の研修を確認`, targetUrl: "/training/courses" }
      : { label: "研修管理を開く", description: "コースと運営状況を確認", targetUrl: "/training" };
  }
  const unsubmitted = Number(dashboard?.summary?.unsubmittedReports || 0);
  return unsubmitted > 0
    ? { label: "未提出の日報を確認", description: `${unsubmitted}名の状況を確認`, targetUrl: "/training/reports" }
    : { label: "自社受講生を見る", description: "研修と成長の状況を確認", targetUrl: "/training/trainees" };
}

function PortalProductCard({ product, index, onOpen }) {
  const Icon = product.icon || Sparkles;
  const accent = PRODUCT_ACCENT[product.key] || PRODUCT_ACCENT.home;
  const gradient = PRISM_PRODUCT_GRAD[product.key] || NOVA.gradAccent;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="feeps-stagger-in group flex min-w-0 flex-col rounded-[22px] p-4 text-left transition hover:-translate-y-1"
      style={{
        background: NOVA.card,
        border: `1px solid ${NOVA.line}`,
        boxShadow: NOVA.shadowSm,
        animationDelay: `${100 + index * 40}ms`,
      }}
      aria-label={`${product.label}を開く`}
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: accent.subtle, color: accent.deep }}>
          <Icon size={20} strokeWidth={1.9} />
        </span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition group-hover:translate-x-0.5" style={{ background: NOVA.soft, color: NOVA.muted }}>
          <ArrowUpRight size={15} />
        </span>
      </span>
      <span className="mt-5 block text-base font-bold" style={{ color: NOVA.ink }}>{product.label}</span>
      <span className="mt-1 block min-h-10 text-xs leading-5" style={{ color: NOVA.muted }}>{PRODUCT_COPY[product.key] || "機能を開いて、今日の業務を進めます。"}</span>
      <span className="mt-4 h-1 w-12 rounded-full transition-all group-hover:w-20" style={{ background: gradient }} />
    </button>
  );
}

function ProductPortal({ role, displayName, products, dashboard, loading, error, goProduct, goTraining, goSub }) {
  const copy = ROLE_PORTAL_COPY[role] || ROLE_PORTAL_COPY.trainee;
  const availableProducts = asArray(products).filter(product => product?.key && product.key !== "home");
  const metrics = portalMetrics(role, dashboard, loading, Boolean(error));
  const nextAction = nextPortalAction(role, dashboard);
  const orbitProducts = availableProducts.slice(0, 5);
  // 件数から列数を決める（4枚→2+2、5枚→3+2、6枚→3+3。広い画面では1行に収める）
  const productGridStyle = useMemo(() => {
    const n = availableProducts.length;
    const lg = n <= 3 ? Math.max(n, 1) : n === 4 ? 2 : 3;
    const xl = n <= 6 ? Math.max(n, 1) : 4;
    return { "--cols-lg": String(lg), "--cols-xl": String(xl) };
  }, [availableProducts.length]);
  const openNext = () => openTargetUrl(nextAction.targetUrl, { goProduct, goTraining, goSub });

  return (
    <section className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-[30px] p-6 sm:p-8 lg:p-10" style={{ background: NOVA.gradPortal, boxShadow: NOVA.shadowAccent, color: NOVA.onDark }}>
        <span className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full" style={{ border: `1px solid ${PRISM.heroLine}` }} />
        <span className="pointer-events-none absolute -left-5 -top-10 h-36 w-36 rounded-full" style={{ border: `1px solid ${PRISM.heroLine}` }} />
        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em]" style={{ color: NOVA.onDarkMuted }}>
              <Sparkles size={15} />{copy.eyebrow}
            </div>
            <p className="mt-4 text-sm font-semibold" style={{ color: NOVA.onDarkMuted }}>こんにちは、{displayName}さん</p>
            <h1 className="mt-1 max-w-2xl text-[30px] font-bold leading-tight sm:text-[38px]" style={{ letterSpacing: "-0.035em" }}>{copy.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7" style={{ color: NOVA.onDarkMuted }}>{copy.description}</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <button type="button" onClick={openNext} className="feeps-prism-cta flex min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-left" style={{ background: NOVA.railGlass, color: NOVA.ink, boxShadow: NOVA.shadowMd }}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: NOVA.accentSoft, color: NOVA.accentDeep }}><ArrowRight size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold tracking-[0.08em]" style={{ color: NOVA.quiet }}>NEXT ACTION</span>
                  <span className="block truncate text-sm font-bold">{nextAction.label}</span>
                  <span className="block truncate text-xs" style={{ color: NOVA.muted }}>{nextAction.description}</span>
                </span>
              </button>
              <div className="grid flex-1 grid-cols-3 gap-2">
                {metrics.map(metric => (
                  <div key={metric.label} className="rounded-2xl px-3 py-3" style={{ background: PRISM.heroGlassStrong, border: `1px solid ${PRISM.heroLine}` }}>
                    <div className="truncate text-[10px] font-semibold" style={{ color: NOVA.onDarkMuted }}>{metric.label}</div>
                    {metric.loading ? (
                      <span className="feeps-shimmer mt-2 block h-4 w-10 rounded" aria-label="読み込み中" />
                    ) : (
                      <div className="mt-1 truncate text-lg font-bold tabular-nums" title={metric.title}>{metric.value}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative mx-auto hidden h-[290px] w-[290px] lg:block" aria-hidden="true">
            <span className="absolute inset-4 rounded-full" style={{ border: `1px solid ${PRISM.heroLine}` }} />
            <span className="absolute inset-[54px] rounded-full" style={{ border: `1px solid ${PRISM.heroLine}` }} />
            <span className="feeps-float absolute inset-[95px] grid place-items-center rounded-[30px]" style={{ background: NOVA.railGlass, boxShadow: NOVA.shadowMd, animationDuration: "8s" }}>
              <Sparkles size={34} style={{ color: NOVA.violet }} />
            </span>
            {orbitProducts.map((product, index) => {
              const Icon = product.icon || Sparkles;
              const positions = ["left-0 top-[104px]", "right-1 top-6", "bottom-1 right-8", "bottom-4 left-8", "left-[112px] top-0"];
              return (
                <span key={product.key} className={`feeps-float absolute grid h-14 w-14 place-items-center rounded-2xl ${positions[index]}`} style={{ background: NOVA.railGlass, color: (PRODUCT_ACCENT[product.key] || PRODUCT_ACCENT.home).deep, boxShadow: NOVA.shadowMd, animationDuration: "9s", animationDelay: `${index * -1.3}s` }}>
                  <Icon size={23} />
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {availableProducts.length > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[11px] font-bold tracking-[0.1em]" style={{ color: NOVA.accentDeep }}>FEEPS ONE PRODUCTS</p>
              <h2 className="mt-1 text-xl font-bold" style={{ color: NOVA.ink, letterSpacing: "-0.025em" }}>できることから、機能を選ぶ</h2>
              <p className="mt-1 text-sm" style={{ color: NOVA.muted }}>現在の権限で利用できる機能だけを表示しています。</p>
            </div>
          </div>
          {/* 列数は件数から決める。5列固定だと6枚のとき1枚だけ次の行へ落ちて見た目が崩れるため、
              「1行に収める」か「均等な2行」になる列数を選ぶ（ロールごとに件数が変わる）。 */}
          <div className="feeps-product-grid gap-3" style={productGridStyle}>
            {availableProducts.map((product, index) => (
              <PortalProductCard key={product.key} product={product} index={index} onOpen={() => goProduct(product.key)} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ===== 受講生Home（/dashboard/trainee の実データのみで構成。ダミーの連続日数やAI機能は
   バックエンドに対応するデータ/機能がまだ無いため表示しない） ===== */
function TraineeHome({ dashboard, displayName, goProduct, goTraining, goSub, loading, error, onRetry }) {
  const open = url => openTargetUrl(url, { goProduct, goTraining, goSub });
  const activeCourses = asArray(dashboard?.activeCourses);
  const coursesAvailable = dashboard?.availability?.courses !== false
    && !asArray(dashboard?.warnings).some(warning => ["enrollments_unavailable", "courses_unavailable"].includes(warning?.code));
  const activeCourseId = getActiveCourseId();
  const course = activeCourses.find(item => item.courseId === activeCourseId && item.todayCurriculum)
    || activeCourses.find(item => item.todayCurriculum)
    || activeCourses.find(item => item.courseId === activeCourseId)
    || activeCourses[0]
    || null;
  const todayCur = course?.todayCurriculum || null;
  const tasks = asArray(dashboard?.todayTasks).filter(task => task.requiredToday === true);
  const todayCompletion = dashboard?.todayCompletion || null;
  const noTrainingToday = todayCompletion?.status === "not_applicable";
  const todayUnknown = todayCompletion?.status === "unknown";
  const tests = asArray(dashboard?.tests);
  const warningCodes = new Set(asArray(dashboard?.warnings).map(warning => warning?.code));
  const dailyLessonAvailable = coursesAvailable && !warningCodes.has("course_daily_note_unavailable");
  const testsAvailable = dashboard?.availability?.tests !== false
    && !warningCodes.has("test_results_unavailable")
    && !warningCodes.has("test_definitions_unavailable");
  const learningAvailable = dashboard?.availability?.learning !== false
    && !warningCodes.has("learning_progress_fetch_unavailable");
  const commentsAvailable = dashboard?.availability?.dailyReport !== false
    && !warningCodes.has("daily_report_unavailable");
  const nextTest = tests[0] || null;
  const learning = dashboard?.learning || null;
  const learningStageLabel = !learningAvailable
    ? "修了状態を確認できません"
    : !learning
      ? "学習履歴はまだありません"
      : learning.completionStage === "completed"
        ? `総合テスト合格${learning.finalTest?.score != null ? `・${learning.finalTest.score}点` : ""}`
        : learning.completionStage === "final_test_required"
          ? "Lesson完了・総合テスト待ち"
          : learning.lessonProgress?.total > 0
            ? `Lesson ${learning.lessonProgress.completed}/${learning.lessonProgress.total}`
            : "学習中";
  const attendance = dashboard?.attendance || null;
  const dailyReport = dashboard?.dailyReport || null;
  const announcements = asArray(dashboard?.dailyAnnouncements);
  const comments = asArray(dashboard?.comments);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title="今日の学習状況" desc={course ? `${dateLabel()} · ${course.courseName}` : dateLabel()} />

      {error && <ErrorRetryCard message={error} onRetry={onRetry} />}
      {!error && !loading && !coursesAvailable && <ErrorRetryCard message="所属コースの状態を確認できませんでした。未登録とは判定していません。" onRetry={onRetry} />}

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
            <PBCard className="p-6 sm:p-7" style={{ background: PRISM.gradHero, border: "none", color: NOVA.onDark, position: "relative", overflow: "hidden" }}>
              <span className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full" style={{ background: PRISM.heroGlass }} />
              <div className="relative flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider opacity-85">TODAY · 今日の単元</p>
                  {dailyLessonAvailable && todayCur?.title ? (
                    <>
                      <h2 className="mt-2 text-xl font-extrabold sm:text-2xl" style={{ letterSpacing: "-0.02em" }}>{todayCur.title}</h2>
                      {todayCur.summary && <p className="mt-1.5 max-w-xl text-sm opacity-90">{todayCur.summary}</p>}
                    </>
                  ) : (
                    <p className="mt-2 max-w-md text-sm opacity-90">{!dailyLessonAvailable ? "本日の単元情報を現在確認できません。未登録とは判定していません。" : course ? "本日の単元はまだ登録されていません。" : coursesAvailable ? "所属コースが登録されていません。管理者にご確認ください。" : "所属コースの状態を現在確認できません。"}</p>
                  )}
                  <div className="mt-5">
                    <Btn kind="white" icon={dailyLessonAvailable ? ArrowRight : RefreshCw} onClick={() => !dailyLessonAvailable ? onRetry() : course ? open(`/training/curriculum?courseId=${encodeURIComponent(course.courseId)}`) : open("/training")}>
                      {!dailyLessonAvailable ? "再読み込み" : course ? "今日の教材を開く" : "研修管理を開く"}
                    </Btn>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2.5 rounded-2xl p-4 text-xs font-semibold" style={{ background: PRISM.heroGlass, minWidth: 170 }}>
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
              <CapLabel>Eラーニング</CapLabel>
              <div className="flex flex-1 items-center gap-5">
                <ProgressRing percent={learningAvailable ? (learning?.progressPercent ?? null) : null} from={PRISM.accent} to={PRISM.teal} gradId="ring-learning" sub={learningAvailable ? learning?.currentLessonTitle : "確認できません"} />
                <div className="min-w-0 text-xs font-semibold leading-relaxed" style={{ color: PRISM.sub }}><div className="break-words" style={{ color: PRISM.ink }}>{learning?.currentCourseTitle || "Eラーニング"}</div><div className="mt-1 break-words">{learningStageLabel}</div></div>
              </div>
              {!learningAvailable ? <div className="mt-2 flex items-center justify-between gap-2"><p className="text-[11px] font-semibold" style={{ color: PRISM.warn }}>Eラーニングの学習履歴を確認できません。</p><button type="button" onClick={onRetry} className="shrink-0 text-[11px] font-bold" style={{ color: PRISM.accent }}>再読み込み</button></div> : !learning && <p className="mt-2 text-[11px]" style={{ color: PRISM.mut }}>Eラーニングの学習履歴はまだありません。</p>}
            </PBCard>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <PBCard className="p-5">
              <CapLabel>今日やること</CapLabel>
              {todayUnknown ? (
                <div><p className="text-xs font-semibold" style={{ color: PRISM.warn }}>今日が研修日か、勤怠・日報の状態を確認できません。</p><button type="button" onClick={onRetry} className="mt-3 text-xs font-bold" style={{ color: PRISM.accent }}>再読み込み</button></div>
              ) : noTrainingToday ? (
                <p className="text-xs" style={{ color: PRISM.mut }}>今日は研修日ではありません。勤怠・日報の入力は不要です。</p>
              ) : tasks.length === 0 ? (
                <p className="text-xs" style={{ color: PRISM.mut }}>今日の必須項目はありません。</p>
              ) : (
                <ul className="flex flex-col">
                  {tasks.map(t => (
                    <li key={t.type} className="flex items-center gap-2.5 border-b py-2.5 text-sm last:border-b-0" style={{ borderColor: PRISM.line }}>
                      <StatusDot status={t.status} />
                      <span className="min-w-0 flex-1 truncate" style={{ color: t.status === "done" ? PRISM.mut : PRISM.ink, textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.label}</span>
                      {t.actionLabel && t.status !== "done" && (
                        <button type="button" onClick={() => t.status === "unavailable" && ["attendance_unavailable", "daily_report_unavailable", "take_test"].includes(t.type) ? onRetry() : open(t.targetUrl)} className="shrink-0 text-xs font-bold" style={{ color: PRISM.accent }}>{t.actionLabel}</button>
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
              {!testsAvailable ? (
                <><p className="text-xs" style={{ color: PRISM.mut }}>公開テストと受験結果の状態を確認できません。</p><div className="mt-auto pt-3"><Btn size="sm" kind="ghost" icon={RefreshCw} onClick={onRetry}>再読み込み</Btn></div></>
              ) : nextTest ? (
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
            <PBCard className="flex h-full flex-col p-5" style={{ background: `linear-gradient(140deg, ${PRISM.aiSubtle}, ${NOVA.card})`, borderColor: PRISM.ai }}>
              <p className="mb-2.5 text-[11px] font-bold uppercase" style={{ color: PRISM.aiDeep, letterSpacing: "0.06em" }}>講師コメント</p>
              {!commentsAvailable ? (
                <><p className="text-xs font-semibold" style={{ color: PRISM.warn }}>講師コメントの状態を確認できません。コメントなしとは判定していません。</p><div className="mt-auto pt-3"><Btn size="sm" kind="ghost" icon={RefreshCw} onClick={onRetry}>再読み込み</Btn></div></>
              ) : comments[0] ? (
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
  const todayCourses = asArray(dashboard?.todayCourses);
  const scope = dashboard?.scope;
  const summary = dashboard?.summary || {};

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title="本日の担当研修" desc={`${dateLabel()} · 本日 ${todayCourses.length}コース`} />

      {error && <ErrorRetryCard message={error} onRetry={onRetry} />}

      {scope?.unassigned && (
        <PBCard className="p-5" style={{ background: PRISM.warnSubtle, borderColor: PRISM.warn }}>
          <p className="text-sm font-bold" style={{ color: PRISM.warn }}>担当コースが未設定です</p>
          <p className="mt-1 text-xs" style={{ color: PRISM.sub }}>管理者にコースの担当講師設定を依頼してください。</p>
        </PBCard>
      )}

      {loading && !dashboard ? (
        <PBCard className="p-5">
          <span className="feeps-shimmer mb-3 block h-3 w-32 rounded" />
          <span className="feeps-shimmer block h-20 rounded-2xl" />
        </PBCard>
      ) : (
        <PBCard className="p-5">
          <CapLabel>本日開講中の担当コース</CapLabel>
          {todayCourses.length === 0 ? (
            <div className="rounded-2xl px-5 py-8 text-center" style={{ background: PRISM.base, border: `1px solid ${PRISM.line}` }}>
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl" style={{ background: PRISM.accentSubtle, color: PRISM.accent }}><BookOpen size={20} /></span>
              <p className="mt-3 text-sm font-bold" style={{ color: PRISM.ink }}>本日の担当研修はありません</p>
              <p className="mt-1 text-xs" style={{ color: PRISM.mut }}>過去の記録は研修管理から確認できます（担当{summary.assignedCourses ?? 0}コース）。</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {todayCourses.slice(0, 4).map(c => {
                const startTime = c.dayContext?.startTime || "";
                const endTime = c.dayContext?.endTime || "";
                const timeLabel = startTime && endTime ? `${startTime} - ${endTime}` : startTime || endTime;
                return (
                  <div key={c.courseId} className="rounded-2xl p-4" style={{ background: PRISM.base, border: `1px solid ${PRISM.line}` }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold" style={{ color: PRISM.ink }}>{c.courseName}</div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: PRISM.mut }}>
                          <span>受講生 {c.studentCount}名</span>
                          {timeLabel && <span>{timeLabel}</span>}
                        </div>
                        <p className="mt-2 truncate text-xs" style={{ color: PRISM.sub }}>{c.todayCurriculum?.title || "今日のカリキュラム未設定"}</p>
                      </div>
                      <Btn size="sm" kind="ghost" icon={ArrowRight} onClick={() => open(`/training/curriculum?courseId=${encodeURIComponent(c.courseId)}`)}>開く</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4"><Btn size="sm" kind="ghost" icon={ArrowRight} full onClick={() => open("/training")}>研修管理を開く</Btn></div>
        </PBCard>
      )}
    </div>
  );
}

/* ===== 管理者Home（/dashboard/admin の実データのみで構成。コースごとの出席率・日報提出率・
   要注意フラグを表示する。既存テーブルの読み取り集計のみで、新規テーブル/GSIは使用しない） ===== */
function AdminBoardHome({ dashboard, goProduct, goTraining, goSub, loading, error, onRetry }) {
  const open = url => openTargetUrl(url, { goProduct, goTraining, goSub });
  const courses = asArray(dashboard?.courses);
  const followUps = asArray(dashboard?.followUps);
  const summary = dashboard?.summary || {};

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title="研修運営の状況" desc={`${dateLabel()} · 全${summary.totalCourses ?? 0}コース（本日開講 ${summary.todayTrainingCourses ?? 0}件） · 受講生 ${summary.totalStudents ?? 0}名`} />

      {error && <ErrorRetryCard message={error} onRetry={onRetry} />}

      {loading && !dashboard ? (
        <PBCard className="p-2"><div className="grid gap-3 p-2 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: PRISM.base }}>
            <span className="feeps-shimmer mb-2 block h-2.5 rounded" style={{ width: "50%" }} />
            <span className="feeps-shimmer block h-5 rounded" style={{ width: "30%" }} />
          </div>
        ))}</div></PBCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <PBCard className="p-4"><CapLabel><Building2 size={12} className="mr-1 inline" />契約企業</CapLabel><div className="text-2xl font-extrabold tabular-nums" style={{ color: PRISM.ink }}>{summary.totalCompanies ?? 0}<span className="ml-1 text-sm font-semibold" style={{ color: PRISM.mut }}>社</span></div></PBCard>
            <PBCard className="p-4"><CapLabel><BookOpen size={12} className="mr-1 inline" />コース</CapLabel><div className="text-2xl font-extrabold tabular-nums" style={{ color: PRISM.ink }}>{summary.totalCourses ?? 0}<span className="ml-1 text-sm font-semibold" style={{ color: PRISM.mut }}>件</span></div></PBCard>
            <PBCard className="p-4"><CapLabel><Users size={12} className="mr-1 inline" />全受講生</CapLabel><div className="text-2xl font-extrabold tabular-nums" style={{ color: PRISM.ink }}>{summary.totalStudents ?? 0}<span className="ml-1 text-sm font-semibold" style={{ color: PRISM.mut }}>名</span></div></PBCard>
            <PBCard className="p-4"><CapLabel><AlertCircle size={12} className="mr-1 inline" />要確認コース</CapLabel><div className="text-2xl font-extrabold tabular-nums" style={{ color: summary.coursesNeedingAttention ? PRISM.warn : PRISM.ink }}>{summary.coursesNeedingAttention ?? 0}<span className="ml-1 text-sm font-semibold" style={{ color: PRISM.mut }}>件</span></div></PBCard>
          </div>

          <PBCard className="p-5">
            <CapLabel>要フォロー（直近研修日までの未解消異常）</CapLabel>
            {followUps.length === 0 ? (
              <p className="mt-2 text-xs" style={{ color: PRISM.mut }}>現在フォローが必要な受講生はいません。</p>
            ) : (
              <ul className="mt-1 flex flex-col">
                {followUps.slice(0, 6).map(f => (
                  <li key={f.traineeId} className="flex items-center gap-3 border-b py-2.5 last:border-b-0" style={{ borderColor: PRISM.line }}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: PRISM.accent }}>{String(f.traineeName || "?").slice(0, 1)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold" style={{ color: PRISM.ink }}>{f.traineeName}</div>
                      <div className="truncate text-xs" style={{ color: PRISM.mut }}>{f.companyName || f.courseName}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {asArray(f.reasons).slice(0, 2).map((r, i) => (
                        <SeverityChip key={i} severity={r.severity}>{r.label}</SeverityChip>
                      ))}
                    </div>
                    <button type="button" onClick={() => open(f.targetUrl)} aria-label="詳細を見る"><ChevronRight size={16} style={{ color: PRISM.mut }} /></button>
                  </li>
                ))}
              </ul>
            )}
          </PBCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {courses.length === 0 ? (
              <PBCard className="p-5 sm:col-span-2"><p className="text-xs" style={{ color: PRISM.mut }}>コースがありません。</p></PBCard>
            ) : courses.map(c => (
              <PBCard key={c.courseId} className="p-5" hover>
                <div className="flex items-center justify-between gap-2">
                  <b className="truncate text-[15px] font-bold" style={{ color: PRISM.ink }}>{c.courseName}</b>
                  {c.status === "unassigned" ? <SeverityChip severity="critical">講師未設定</SeverityChip>
                    : c.status === "needs_attention" ? <SeverityChip severity="warning">要確認</SeverityChip>
                    : <SeverityChip severity="info">順調</SeverityChip>}
                </div>
                <p className="mt-1 truncate text-xs" style={{ color: PRISM.mut }}>
                  {c.companyName || "企業未設定"} · 受講生{c.studentCount}名{c.instructorNames.length > 0 ? ` · ${c.instructorNames.join("、")}` : ""}
                </p>
                <div className="mt-3 flex gap-5 text-xs" style={{ color: PRISM.sub }}>
                  <span>本日日報 <b className="tabular-nums" style={{ color: PRISM.ink }}>{c.reportRate != null ? `${c.reportRate}%` : "—"}</b></span>
                  <span>本日出席 <b className="tabular-nums" style={{ color: PRISM.ink }}>{c.attendanceRate != null ? `${c.attendanceRate}%` : "—"}</b></span>
                </div>
                <div className="mt-3"><Btn size="sm" kind="ghost" icon={ArrowRight} onClick={() => open(c.targetUrl)}>コースを開く</Btn></div>
              </PBCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ===== 企業担当者Home（/dashboard/client の実データのみで構成。自社受講生の出席・日報・
   学習進捗を表示する） ===== */
function ClientSummaryHome({ dashboard, goProduct, goTraining, goSub, loading, error, onRetry }) {
  const open = url => openTargetUrl(url, { goProduct, goTraining, goSub });
  const trainees = asArray(dashboard?.trainees);
  const summary = dashboard?.summary || {};
  const company = dashboard?.company || {};

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title="自社の研修状況" desc={company.companyName || dateLabel()} />

      {error && <ErrorRetryCard message={error} onRetry={onRetry} />}

      {loading && !dashboard ? (
        <PBCard className="p-2"><div className="grid gap-3 p-2 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: PRISM.base }}>
            <span className="feeps-shimmer mb-2 block h-2.5 rounded" style={{ width: "50%" }} />
            <span className="feeps-shimmer block h-5 rounded" style={{ width: "30%" }} />
          </div>
        ))}</div></PBCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <PBCard className="p-4"><CapLabel>自社受講生</CapLabel><div className="text-2xl font-extrabold tabular-nums" style={{ color: PRISM.ink }}>{summary.traineeCount ?? 0}<span className="ml-1 text-sm font-semibold" style={{ color: PRISM.mut }}>名</span></div></PBCard>
            <PBCard className="p-4"><CapLabel>本日出席</CapLabel><div className="text-2xl font-extrabold tabular-nums" style={{ color: PRISM.ink }}>{summary.attendanceOkToday ?? 0}<span className="ml-1 text-sm font-semibold" style={{ color: PRISM.mut }}>名</span></div></PBCard>
            <PBCard className="p-4"><CapLabel>日報提出</CapLabel><div className="text-2xl font-extrabold tabular-nums" style={{ color: PRISM.ink }}>{summary.reportSubmittedToday ?? 0}<span className="ml-1 text-sm font-semibold" style={{ color: PRISM.mut }}>名</span></div></PBCard>
            <PBCard className="p-4"><CapLabel>日報未提出</CapLabel><div className="text-2xl font-extrabold tabular-nums" style={{ color: summary.unsubmittedReports ? PRISM.warn : PRISM.ink }}>{summary.unsubmittedReports ?? 0}<span className="ml-1 text-sm font-semibold" style={{ color: PRISM.mut }}>名</span></div></PBCard>
          </div>

          <PBCard className="p-5">
            <CapLabel>自社受講生</CapLabel>
            {trainees.length === 0 ? (
              <p className="text-xs" style={{ color: PRISM.mut }}>自社受講生はまだ登録されていません。</p>
            ) : (
              <ul className="flex flex-col">
                {trainees.slice(0, 10).map(t => (
                  <li key={t.traineeId} className="flex items-center gap-3 border-b py-2.5 last:border-b-0" style={{ borderColor: PRISM.line }}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: PRISM.accent }}>{String(t.name || "?").slice(0, 1)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold" style={{ color: PRISM.ink }}>{t.name}</div>
                      <div className="truncate text-xs" style={{ color: PRISM.mut }}>{t.courseName || "コース未設定"}</div>
                    </div>
                    {t.learningProgress != null && (
                      <div className="hidden w-24 shrink-0 sm:block">
                        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: PRISM.ringTrack }}><div className="h-full rounded-full" style={{ width: `${t.learningProgress}%`, background: PRISM.gradCta }} /></div>
                      </div>
                    )}
                    <span className="shrink-0 text-xs font-semibold" style={{ color: t.attendanceStatus === "not_clocked_in" ? PRISM.warn : PRISM.sub }}>{ATT_LABEL[t.attendanceStatus] || "確認中"}</span>
                    <button type="button" onClick={() => open(t.targetUrl)} aria-label="詳細を見る"><ChevronRight size={16} style={{ color: PRISM.mut }} /></button>
                  </li>
                ))}
              </ul>
            )}
          </PBCard>
        </>
      )}
    </div>
  );
}

// 2026-07-21 体感速度対応(P3): TrainingApp.jsxの画面ラッパーはproduct切替のたびに
// key変更で完全アンマウント→再マウントする（他タブ→Home遷移を含む）。dashboard系APIは
// 1〜2秒台かかることがあり、毎回スケルトンから待たせると「もっさり」に感じるため、
// role単位でモジュールスコープにキャッシュし、再マウント時は前回値を即表示しつつ
// バックグラウンドで再取得する（表示内容・レイアウトは変更しない。取得失敗時は
// 既存キャッシュを保持したままエラー表示のみ行い、0件/未登録には見せない）。
const dashboardCacheByRole = new Map();

export default function FeepsOneHome({ role, displayName, goProduct, goTraining, goSub, products = [] }) {
  const cachedEntry = dashboardCacheByRole.get(role);
  const [dashboard, setDashboard] = useState(cachedEntry ? cachedEntry.data : null);
  const [loadingDashboard, setLoadingDashboard] = useState(!cachedEntry);
  const [dashboardError, setDashboardError] = useState("");

  const loadDashboard = useMemo(() => async () => {
    const path = role === "instructor" ? "/dashboard/instructor"
      : role === "trainee" ? "/dashboard/trainee"
      : role === "admin" ? "/dashboard/admin"
      : role === "client" ? "/dashboard/client"
      : "";
    if (!path) { setDashboard(null); return; }
    const hadCache = dashboardCacheByRole.has(role);
    setLoadingDashboard(true);
    setDashboardError("");
    try {
      const data = await apiGet(path);
      dashboardCacheByRole.set(role, { data });
      setDashboard(data);
    } catch (e) {
      // キャッシュがあれば維持したまま再試行を促す（前回表示していた実データを
      // 一時的な取得失敗で消さない）。初回失敗時のみ従来通りnullにする
      if (!hadCache) setDashboard(null);
      setDashboardError(e?.errorMessage || e?.message || "Dashboard APIの取得に失敗しました。");
    } finally {
      setLoadingDashboard(false);
    }
  }, [role]);

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDashboard]);

  const roleDashboard = dashboardError && !dashboard
    ? <div><SectionTitle title="最新状況" desc="データを取得できない間は、未登録・未提出とは判定しません。" /><ErrorRetryCard message={dashboardError} onRetry={loadDashboard} /></div>
    : role === "trainee"
    ? <TraineeHome dashboard={dashboard} displayName={displayName} goProduct={goProduct} goTraining={goTraining} goSub={goSub} loading={loadingDashboard} error={dashboardError} onRetry={loadDashboard} />
    : role === "instructor"
      ? <InstructorHome dashboard={dashboard} displayName={displayName} goProduct={goProduct} goTraining={goTraining} goSub={goSub} loading={loadingDashboard} error={dashboardError} onRetry={loadDashboard} />
      : role === "admin"
        ? <AdminBoardHome dashboard={dashboard} goProduct={goProduct} goTraining={goTraining} goSub={goSub} loading={loadingDashboard} error={dashboardError} onRetry={loadDashboard} />
        : <ClientSummaryHome dashboard={dashboard} goProduct={goProduct} goTraining={goTraining} goSub={goSub} loading={loadingDashboard} error={dashboardError} onRetry={loadDashboard} />;

  return (
    <div className="flex flex-col gap-8">
      <ProductPortal
        role={role}
        displayName={displayName}
        products={products}
        dashboard={dashboard}
        loading={loadingDashboard}
        error={dashboardError}
        goProduct={goProduct}
        goTraining={goTraining}
        goSub={goSub}
      />
      {roleDashboard}
    </div>
  );
}
