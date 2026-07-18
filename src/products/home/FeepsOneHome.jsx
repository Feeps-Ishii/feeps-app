import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BookOpen, Building2, AlertCircle,
  Clock, ClipboardCheck, MessageSquare, ListChecks,
  FileText, Megaphone, ChevronRight, Users,
  Sparkles, ArrowUpRight,
} from "lucide-react";
import { apiGet } from "../../api.js";
import {
  Btn, NOVA, PRISM, PRISM_PRODUCT_GRAD, PRODUCT_ACCENT,
  PrismSectionTitle as SectionTitle, PrismCard as PBCard,
  PrismCapLabel as CapLabel,
  PrismErrorRetryCard as ErrorRetryCard, PrismSeverityChip as SeverityChip,
  PrismStatusDot as StatusDot, PrismProgressRing as ProgressRing,
} from "../../components/common";

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

const PRODUCT_COPY = {
  training: "カリキュラム・日報・勤怠を、ひとつの流れで管理します。",
  learning: "コース学習を進め、理解度と修了状況を確認します。",
  talent: "研修で得たスキルと成長の記録を可視化します。",
  matching: "身につけた力を、次の案件とキャリアにつなげます。",
  analytics: "研修成果・リスク・利用状況を横断して分析します。",
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

function metricValue(value, unit, loading) {
  if (loading && value == null) return "—";
  return `${value ?? 0}${unit}`;
}

function portalMetrics(role, dashboard, loading) {
  if (!dashboard) {
    const labels = {
      trainee: ["参加コース", "今日の未完了", "未受験テスト"],
      instructor: ["担当コース", "未確認日報", "勤怠アラート"],
      admin: ["稼働コース", "全受講生", "要確認"],
      client: ["自社受講生", "本日出席", "日報未提出"],
    }[role] || ["利用状況", "今日の対応", "要確認"];
    return labels.map(label => ({ label, value: "—" }));
  }
  if (role === "trainee") {
    const tasks = asArray(dashboard?.todayTasks);
    const pending = tasks.filter(task => task.status !== "done").length;
    return [
      { label: "参加コース", value: metricValue(asArray(dashboard?.activeCourses).length, "件", loading) },
      { label: "今日の未完了", value: metricValue(pending, "件", loading) },
      { label: "未受験テスト", value: metricValue(dashboard?.summary?.unsubmittedTests, "件", loading) },
    ];
  }
  if (role === "instructor") {
    const summary = dashboard?.summary || {};
    const reportCount = Number(summary.pendingReports || 0) + Number(summary.uncommentedReports || 0);
    return [
      { label: "担当コース", value: metricValue(summary.assignedCourses, "件", loading) },
      { label: "未確認日報", value: metricValue(reportCount, "件", loading) },
      { label: "勤怠アラート", value: metricValue(summary.attendanceAlerts, "件", loading) },
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
    const nextTask = asArray(dashboard?.todayTasks).find(task => task.status !== "done" && task.targetUrl);
    if (nextTask) return { label: nextTask.actionLabel || nextTask.label || "次のタスクを開く", description: nextTask.label || "今日の未完了タスク", targetUrl: nextTask.targetUrl };
    const course = asArray(dashboard?.activeCourses)[0];
    return course
      ? { label: "今日の研修を開く", description: course.courseName || "所属コース", targetUrl: "/training/curriculum" }
      : { label: "学習コースを見る", description: "公開中のコースを確認", targetUrl: "/learning/courses" };
  }
  if (role === "instructor") {
    const todo = asArray(dashboard?.todos).find(item => Number(item.count || 0) > 0 && item.targetUrl);
    return todo
      ? { label: todo.label || "確認事項を開く", description: `${todo.count}件の対応があります`, targetUrl: todo.targetUrl }
      : { label: "今日の授業準備を開く", description: "カリキュラム・教材・テストを確認", targetUrl: "/training/curriculum" };
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
        animationDelay: `${160 + index * 60}ms`,
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

function ProductPortal({ role, displayName, products, dashboard, loading, goProduct, goTraining, goSub }) {
  const copy = ROLE_PORTAL_COPY[role] || ROLE_PORTAL_COPY.trainee;
  const availableProducts = asArray(products).filter(product => product?.key && product.key !== "home");
  const metrics = portalMetrics(role, dashboard, loading);
  const nextAction = nextPortalAction(role, dashboard);
  const orbitProducts = availableProducts.slice(0, 5);
  const openNext = () => openTargetUrl(nextAction.targetUrl, { goProduct, goTraining, goSub });

  return (
    <section className="flex flex-col gap-4">
      <div className="feeps-hero-in relative overflow-hidden rounded-[30px] p-6 sm:p-8 lg:p-10" style={{ background: NOVA.gradPortal, boxShadow: NOVA.shadowAccent, color: NOVA.onDark }}>
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
                    <div className="mt-1 truncate text-lg font-bold tabular-nums">{metric.value}</div>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
      <SectionTitle title="今日の学習状況" desc={course ? `${dateLabel()} · ${course.courseName}` : dateLabel()} />

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
            <PBCard className="p-6 sm:p-7" style={{ background: PRISM.gradHero, border: "none", color: NOVA.onDark, position: "relative", overflow: "hidden" }}>
              <span className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full" style={{ background: PRISM.heroGlass }} />
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
            <PBCard className="flex h-full flex-col p-5" style={{ background: `linear-gradient(140deg, ${PRISM.aiSubtle}, ${NOVA.card})`, borderColor: PRISM.ai }}>
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
      <SectionTitle title="今日の研修運営" desc={`${dateLabel()} · 担当 ${summary.assignedCourses ?? 0}コース`} />

      {error && <ErrorRetryCard message={error} onRetry={onRetry} />}

      {scope?.unassigned && (
        <PBCard className="p-5" style={{ background: PRISM.warnSubtle, borderColor: PRISM.warn }}>
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

/* ===== 管理者Home（/dashboard/admin の実データのみで構成。コースごとの出席率・日報提出率・
   要注意フラグを表示する。既存テーブルの読み取り集計のみで、新規テーブル/GSIは使用しない） ===== */
function AdminBoardHome({ dashboard, goProduct, goTraining, goSub, loading, error, onRetry }) {
  const open = url => openTargetUrl(url, { goProduct, goTraining, goSub });
  const courses = asArray(dashboard?.courses);
  const summary = dashboard?.summary || {};

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title="研修運営の状況" desc={`${dateLabel()} · 稼働中 ${summary.totalCourses ?? 0}コース · 受講生 ${summary.totalStudents ?? 0}名`} />

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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {courses.length === 0 ? (
              <PBCard className="p-5 sm:col-span-2"><p className="text-xs" style={{ color: PRISM.mut }}>稼働中のコースはありません。</p></PBCard>
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
                  <span>日報 <b className="tabular-nums" style={{ color: PRISM.ink }}>{c.reportRate != null ? `${c.reportRate}%` : "—"}</b></span>
                  <span>出席 <b className="tabular-nums" style={{ color: PRISM.ink }}>{c.attendanceRate != null ? `${c.attendanceRate}%` : "—"}</b></span>
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

export default function FeepsOneHome({ role, displayName, goProduct, goTraining, goSub, products = [] }) {
  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const loadDashboard = useMemo(() => async () => {
    const path = role === "instructor" ? "/dashboard/instructor"
      : role === "trainee" ? "/dashboard/trainee"
      : role === "admin" ? "/dashboard/admin"
      : role === "client" ? "/dashboard/client"
      : "";
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

  const roleDashboard = role === "trainee"
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
        goProduct={goProduct}
        goTraining={goTraining}
        goSub={goSub}
      />
      {roleDashboard}
    </div>
  );
}
