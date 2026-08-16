import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, BookOpen, CalendarDays, ClipboardCheck,
  Clock, FileText, GraduationCap, Megaphone, NotebookPen, RefreshCw, Save
} from "lucide-react";
import { apiGet, apiPut } from "../../api.js";
import {
  Badge, Btn, SkeletonCards, SkeletonRows, PRISM,
  PrismPage, PrismCard, PrismErrorRetryCard, PrismEmptyBlock,
  TrainingHomeHero, TrainingHomePanel, TrainingHomePanelRow, PRODUCT_ACCENT,
} from "../../components/common";
import { InstructorHomeIllustration } from "../../components/common/TrainingHomeIllustrations.jsx";
import { setActiveCourseId } from "../../utils/common/courseContext.js";

function textOf(value, fallback = "") {
  if (value == null || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(v => textOf(v)).filter(Boolean).join("、") || fallback;
  if (typeof value === "object") {
    return textOf(value.title ?? value.name ?? value.label ?? value.text ?? value.message ?? value.reason ?? value.content, fallback);
  }
  return fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asObjectArray(value) {
  return asArray(value).filter(item => item && typeof item === "object" && !Array.isArray(item));
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(value) {
  if (!value) return "";
  return String(value).replaceAll("-", "/");
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function goFromUrl(url, go) {
  const text = String(url || "");
  if (text.includes("attendance")) return go("attendance");
  if (text.includes("materials")) return go("materials");
  if (text.includes("curriculum")) return go("curriculum");
  if (text.includes("tests")) return go("tests");
  if (text.includes("reports")) return go("reports");
  if (text.includes("trainees") || text.includes("students")) return go("trainees");
  return go("home");
}

function EmptyBlock({ title, desc }) {
  return (
    <PrismEmptyBlock>
      <div className="font-semibold" style={{ color: PRISM.sub }}>{title}</div>
      {desc && <div className="mt-1 text-xs">{desc}</div>}
    </PrismEmptyBlock>
  );
}

function SectionTitle({ icon: Icon, title, desc, action }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: PRISM.accentSubtle, color: PRISM.accent }}><Icon size={16} /></span>}
          <h3 className="text-base font-bold" style={{ color: PRISM.ink, letterSpacing: "-0.02em" }}>{title}</h3>
        </div>
        {desc && <p className="mt-1 text-xs" style={{ color: PRISM.mut }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function ActionCard({ icon: Icon, title, value, desc, buttonLabel, onClick, tone = "normal" }) {
  const accent = tone === "alert" ? PRISM.warn : PRISM.accent;
  const bg = tone === "alert" ? PRISM.warnSubtle : PRISM.accentSubtle;
  return (
    <PrismCard className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: bg, color: accent }}><Icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold" style={{ color: PRISM.ink }}>{title}</div>
              <div className="mt-0.5 text-xs leading-5" style={{ color: PRISM.mut }}>{desc}</div>
            </div>
            {value != null && <Badge tone={tone === "alert" ? "amber" : "cyan"}>{value}</Badge>}
          </div>
          <Btn className="mt-3" size="sm" kind="soft" icon={ArrowUpRight} onClick={onClick}>{buttonLabel}</Btn>
        </div>
      </div>
    </PrismCard>
  );
}

function CourseOpenButton({ course, go }) {
  return <Btn size="sm" kind="ghost" icon={ArrowUpRight} onClick={() => { setActiveCourseId(course.courseId); go("courses"); }}>コースを開く</Btn>;
}

function LinkButton({ label, targetUrl, go }) {
  return (
    <button
      type="button"
      className="text-xs font-semibold hover:underline"
      style={{ color: targetUrl ? PRISM.accent : PRISM.mut }}
      onClick={() => targetUrl && goFromUrl(targetUrl, go)}
      disabled={!targetUrl}
    >
      {label}
    </button>
  );
}

function NoticeCard({ courses, date, onSaved }) {
  const [editingCourseId, setEditingCourseId] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const editingCourse = courses.find(c => c.courseId === editingCourseId);
  const firstWithoutNotice = courses.find(c => !textOf(asObject(c.dailyNote).announcement));
  const defaultCourse = firstWithoutNotice || courses[0];
  const hasAnyNotice = courses.some(c => !!textOf(asObject(c.dailyNote).announcement));

  function startEdit(course) {
    const note = asObject(course.dailyNote);
    setEditingCourseId(course.courseId || "");
    setDraft(textOf(note.announcement));
    setMessage("");
  }

  async function save() {
    if (!editingCourse) return;
    const note = asObject(editingCourse.dailyNote);
    setSaving(true);
    setMessage("");
    try {
      await apiPut(`/courses/${editingCourse.courseId}/daily-note`, {
        date,
        lessonTitle: textOf(note.lessonTitle),
        lessonMemo: textOf(note.lessonMemo),
        curriculumItemId: textOf(note.curriculumItemId),
        announcement: draft.trim(),
      });
      setMessage("保存しました。");
      setEditingCourseId("");
      setDraft("");
      await onSaved?.();
    } catch (e) {
      setMessage("保存に失敗しました: " + (e?.errorMessage || e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PrismCard className="p-4">
      <SectionTitle
        icon={Megaphone}
        title="本日のお知らせ"
        desc="講師から受講生への日次連絡です。"
        action={defaultCourse && !editingCourseId ? <Btn size="sm" kind="soft" icon={Megaphone} onClick={() => startEdit(defaultCourse)}>{hasAnyNotice ? "編集する" : "登録する"}</Btn> : null}
      />
      {!courses.length ? (
        <EmptyBlock title="本日の担当コースはありません" desc="本日はお知らせ登録の対象となる研修がありません。" />
      ) : (
        <div className="space-y-2">
          {courses.map(course => {
            const announcement = textOf(asObject(course.dailyNote).announcement);
            return (
              <div key={course.courseId} className="rounded-2xl px-3 py-2.5" style={{ background: PRISM.base, border: `1px solid ${PRISM.line}` }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold" style={{ color: PRISM.ink }}>{textOf(course.courseName, "コース名未設定")}</div>
                    <div className="mt-0.5 truncate text-xs" style={{ color: announcement ? PRISM.sub : PRISM.mut }}>{announcement || "未登録"}</div>
                  </div>
                  <Btn size="sm" kind="ghost" icon={NotebookPen} onClick={() => startEdit(course)}>{announcement ? "編集" : "登録"}</Btn>
                </div>
              </div>
            );
          })}
          {editingCourse && (
            <div className="rounded-2xl p-3" style={{ background: PRISM.surface, border: `1px solid ${PRISM.line2}` }}>
              <div className="mb-2 text-xs font-bold" style={{ color: PRISM.mut }}>{textOf(editingCourse.courseName)} へのお知らせ</div>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2}
                className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none"
                style={{ border: `1px solid ${PRISM.line2}`, color: PRISM.ink }}
                placeholder="例: 10分前にZoomへ入室してください" />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs" style={{ color: message.includes("失敗") ? PRISM.bad : PRISM.ok }}>{message}</span>
                <div className="flex gap-2">
                  <Btn size="sm" kind="ghost" onClick={() => setEditingCourseId("")}>閉じる</Btn>
                  <Btn size="sm" icon={Save} onClick={save} disabled={saving}>{saving ? "保存中" : "保存"}</Btn>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </PrismCard>
  );
}

export default function InstructorWorkspace({ go, displayName = "講師" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await apiGet("/dashboard/instructor");
      setData(res || null);
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      const message = e?.status === 403
        ? "講師Workspaceを表示する権限がありません。"
        : "講師Workspaceの取得に失敗しました。時間をおいて再度お試しください。";
      setError(`${message}${e?.errorMessage ? `（${e.errorMessage}）` : ""}`);
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = asObject(data?.summary);
  const todayCourses = asObjectArray(data?.todayCourses);
  const recentActivity = asObjectArray(data?.recentActivity).slice(0, 5);
  const lessonPrep = asObjectArray(data?.lessonPrep);
  const unassigned = Boolean(data?.scope?.unassigned);
  const date = data?.date || "";
  const todayLessonCount = lessonPrep.filter(item => textOf(item.curriculumTitle)).length || todayCourses.length;
  const hasLessonPrep = lessonPrep.length > 0 || todayCourses.length > 0;
  const noticeCount = todayCourses.filter(c => !!textOf(asObject(c.dailyNote).announcement)).length;
  const assignedCourseCount = num(summary.assignedCourses || data?.scope?.assignedCourseCount);
  const activeStudentCount = num(summary.activeStudents);
  const todaySummary = asObject(summary.today);
  const backlogSummary = asObject(summary.backlog);
  const todayPendingReportCount = num(todaySummary.pendingReports) + num(todaySummary.uncommentedReports);
  const todayAttendanceAlertCount = num(todaySummary.attendanceAlerts);
  const backlogPendingReportCount = num(backlogSummary.pendingReports) + num(backlogSummary.uncommentedReports);
  const backlogAttendanceAlertCount = num(backlogSummary.attendanceAlerts);
  const hasBacklog = backlogPendingReportCount > 0 || backlogAttendanceAlertCount > 0;

  const courseBlocks = useMemo(() => todayCourses.map(course => {
    const links = asObject(course.links);
    return {
      ...course,
      links,
      curriculumText: textOf(course.todayCurriculum, "今日の授業は未設定です。"),
    };
  }), [todayCourses]);

  // 研修管理Home刷新（モード分離Step2）: 対応が必要な件数(日報+勤怠)を1文で示すヒーローに統一。
  const heroActionCount = todayPendingReportCount + todayAttendanceAlertCount;
  const heroTitle = !todayCourses.length
    ? "本日の担当コースはありません"
    : heroActionCount > 0
      ? `対応が必要なことが${heroActionCount}件あります`
      : "今日の対応事項はありません";
  const heroDescParts = [];
  if (todayPendingReportCount > 0) heroDescParts.push(`日報の対応${todayPendingReportCount}件`);
  if (todayAttendanceAlertCount > 0) heroDescParts.push(`勤怠の確認${todayAttendanceAlertCount}件`);
  const heroDescription = !todayCourses.length
    ? "担当コースの情報は「担当コース」から確認できます。"
    : heroDescParts.length
      ? `${heroDescParts.join("、")}です。上から順に進めましょう。`
      : "受講生の状況・今日の進行から必要な確認ができます。";
  const heroGradient = `linear-gradient(120deg, ${PRODUCT_ACCENT.training.gradFrom}, ${PRODUCT_ACCENT.training.gradTo})`;
  const primaryCourse = courseBlocks[0] || null;

  return (
    <PrismPage>
      <TrainingHomeHero
        kicker={`${formatDate(date)} ・ ${displayName}`}
        title={heroTitle}
        description={heroDescription}
        gradient={heroGradient}
        illustration={<InstructorHomeIllustration />}
        actions={<>
          <Btn kind="white" onClick={() => go(todayPendingReportCount >= todayAttendanceAlertCount ? "reports" : "attendance")}>対応リストを開く</Btn>
          <Btn onClick={() => go("trainees")} style={{ background: PRISM.heroGlassStrong, color: "#fff", border: `1px solid ${PRISM.heroLine}` }}>受講生一覧</Btn>
        </>}
      />
      {unassigned && <PrismCard className="p-3"><Badge tone="amber">{textOf(data?.scope?.message, "担当コースがありません")}</Badge></PrismCard>}

      {error && <PrismErrorRetryCard message={error} onRetry={() => load()} />}

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2"><PrismCard><SkeletonCards count={3} /></PrismCard><PrismCard><SkeletonRows rows={4} /></PrismCard></div>
      ) : !error && (
        <>
          {/* お知らせ登録(NoticeCard)は他に入力手段が無いため、2パネル構成に加えて残す */}
          <NoticeCard courses={courseBlocks} date={date} onSaved={() => load({ silent: true })} />

          <div className="grid gap-3 sm:grid-cols-2">
            <TrainingHomePanel title="受講生の状況" meta={`受講生 ${activeStudentCount}名`}>
              <TrainingHomePanelRow icon={Clock} tone={todayAttendanceAlertCount ? "bad" : "ok"} label="要フォロー" sub="欠席・遅刻・未打刻が続く受講生です" actionLabel={`${todayAttendanceAlertCount}件`} onAction={() => go("attendance")} />
              <TrainingHomePanelRow icon={NotebookPen} tone={todayPendingReportCount ? "warn" : "ok"} label="日報" sub={todayCourses.length ? "本日の提出状況と未コメントを確認できます" : "本日は研修なし"} actionLabel="確認" onAction={() => go("reports")} />
            </TrainingHomePanel>
            <TrainingHomePanel title="今日の進行">
              <TrainingHomePanelRow icon={BookOpen} tone="accent" label={primaryCourse ? textOf(primaryCourse.courseName, "コース名未設定") : "今日の授業"} sub={primaryCourse?.curriculumText || "今日の授業は未設定です。"} actionLabel="状況" onAction={() => { if (primaryCourse) setActiveCourseId(primaryCourse.courseId); go("courses"); }} />
              <TrainingHomePanelRow icon={CalendarDays} tone={hasLessonPrep ? "accent" : "warn"} label="授業準備" sub={hasLessonPrep ? "教材・テストの準備状況を確認できます" : "本日は研修実施日ではありません"} actionLabel="開く" onAction={() => go("courses")} />
            </TrainingHomePanel>
          </div>
        </>
      )}
    </PrismPage>
  );
}
