import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BookOpen, Building2, AlertCircle,
  CheckCircle2, Circle, Clock, ClipboardCheck, MessageSquare, ListChecks,
  FileText, Megaphone, RefreshCw, ChevronRight, Users,
} from "lucide-react";
import { apiGet } from "../../api.js";
import { Btn, Card, T, PRISM, PRISM_PRODUCT_GRAD } from "../../components/common";

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

/* ===== 管理者Home（/dashboard/admin の実データのみで構成。コースごとの出席率・日報提出率・
   要注意フラグを表示する。既存テーブルの読み取り集計のみで、新規テーブル/GSIは使用しない） ===== */
function AdminBoardHome({ dashboard, goProduct, goTraining, goSub, loading, error, onRetry }) {
  const open = url => openTargetUrl(url, { goProduct, goTraining, goSub });
  const courses = asArray(dashboard?.courses);
  const summary = dashboard?.summary || {};

  return (
    <div className="flex flex-col gap-5">
      <HomeHeading eyebrow={`${dateLabel()} · 稼働中 ${summary.totalCourses ?? 0}コース · 受講生 ${summary.totalStudents ?? 0}名`} title="コース俯瞰ボード" />

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
      <HomeHeading eyebrow={company.companyName || dateLabel()} title="自社の研修サマリー" />

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
                        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "#ECEEF6" }}><div className="h-full rounded-full" style={{ width: `${t.learningProgress}%`, background: PRISM.gradCta }} /></div>
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

export default function FeepsOneHome({ role, displayName, goProduct, goTraining, goSub }) {
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

  if (role === "trainee") {
    return <TraineeHome dashboard={dashboard} displayName={displayName} goProduct={goProduct} goTraining={goTraining} goSub={goSub} loading={loadingDashboard} error={dashboardError} onRetry={loadDashboard} />;
  }
  if (role === "instructor") {
    return <InstructorHome dashboard={dashboard} displayName={displayName} goProduct={goProduct} goTraining={goTraining} goSub={goSub} loading={loadingDashboard} error={dashboardError} onRetry={loadDashboard} />;
  }
  if (role === "admin") {
    return <AdminBoardHome dashboard={dashboard} goProduct={goProduct} goTraining={goTraining} goSub={goSub} loading={loadingDashboard} error={dashboardError} onRetry={loadDashboard} />;
  }
  return <ClientSummaryHome dashboard={dashboard} goProduct={goProduct} goTraining={goTraining} goSub={goSub} loading={loadingDashboard} error={dashboardError} onRetry={loadDashboard} />;
}
