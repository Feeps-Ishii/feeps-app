import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, BookOpen, CalendarDays, ClipboardCheck,
  Clock, FileText, GraduationCap, Megaphone, NotebookPen, RefreshCw, Save
} from "lucide-react";
import { apiGet, apiPut } from "../../api.js";
import {
  Badge, Btn, SkeletonCards, SkeletonRows, PRISM,
  PrismPage, PrismCard, PrismErrorRetryCard, PrismEmptyBlock, PrismHomeHeading, PrismKpiCard,
  TrainingHomePanel, TrainingHomePanelRow,
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

  const primaryCourse = courseBlocks[0] || null;

  /* 講師ホーム（2026-09-10 作り直し）。「気になる受講生」はやめた。
     何をもって気になるとするかの決めごとが増えるほど出てくる人が変わり、信用されなくなる。
     代わりに本日の出欠という記録そのものを並べ、誰を気にするかは講師が決める。 */
  const todayAttendance = asObjectArray(data?.todayAttendance);
  const attendanceAvailable = todayCourses.length > 0 && data?.todayAttendanceAvailable !== false;
  const notClockedIn = todayAttendance.filter(item => item.state === "not_clocked_in");
  const attendanceNotes = todayAttendance.filter(item => item.state === "late" || item.state === "early_leave" || item.state === "absent");
  const attendanceOkCount = todayAttendance.length - notClockedIn.length - attendanceNotes.length;
  const attendanceStateLabel = item => (
    item.state === "not_clocked_in" ? "未打刻"
      : item.state === "absent" ? "欠席"
      : item.state === "late" ? `${item.clockIn || ""} 遅刻`.trim()
      : item.state === "early_leave" ? `${item.clockOut || ""} 早退`.trim()
      : item.clockIn ? `${item.clockIn} 出勤` : "出勤"
  );

  const actionRows = [];
  if (todayPendingReportCount > 0) {
    actionRows.push({ key: "report_missing", icon: NotebookPen, tone: "warn", label: `本日の日報が${todayPendingReportCount}件まだです`, sub: "未提出・未コメントの合計です", actionLabel: "開く", onAction: () => go("reports") });
  }
  if (todayAttendanceAlertCount > 0) {
    actionRows.push({ key: "attendance_alert", icon: Clock, tone: "bad", label: `勤怠の確認が${todayAttendanceAlertCount}件あります`, sub: "欠席・遅刻・早退・未打刻です", actionLabel: "開く", onAction: () => go("attendance") });
  }
  if (hasBacklog) {
    actionRows.push({ key: "backlog", icon: CalendarDays, tone: "accent", label: `前日までの持ち越しが${backlogPendingReportCount + backlogAttendanceAlertCount}件あります`, sub: "本日分ではありません。時間のあるときに片付けられます", actionLabel: "確認", onAction: () => go(backlogPendingReportCount >= backlogAttendanceAlertCount ? "reports" : "attendance") });
  }

  const headingTitle = loading
    ? "本日の状況を確認しています"
    : !todayCourses.length
      ? "本日の担当コースはありません"
      : actionRows.length
        ? `いま手を打つことが${todayPendingReportCount + todayAttendanceAlertCount}件あります`
        : "今日の対応事項はありません";
  const headingDescription = !todayCourses.length
    ? "担当コースの情報は「コース」から確認できます。研修がない日は教材やテストの準備ができます。"
    : "出欠と日報は記録をそのまま出しています。気になる方がいれば、その場から個別の画面へ進めます。";

  return (
    <PrismPage>
      <PrismHomeHeading
        eyebrow={`${formatDate(date)} ・ ${displayName}`}
        title={headingTitle}
        description={headingDescription}
        action={actionRows.length ? <Btn onClick={actionRows[0].onAction}>対応リストを開く</Btn> : <Btn kind="soft" onClick={() => go("trainees")}>受講生一覧</Btn>}
      />
      {unassigned && <PrismCard className="p-3"><Badge tone="amber">{textOf(data?.scope?.message, "担当コースがありません")}</Badge></PrismCard>}

      {error && <PrismErrorRetryCard message={error} onRetry={() => load()} />}

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2"><PrismCard><SkeletonCards count={3} /></PrismCard><PrismCard><SkeletonRows rows={4} /></PrismCard></div>
      ) : !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <PrismKpiCard icon={GraduationCap} tone="accent" label="担当している受講生" value={activeStudentCount} unit="名"
              detail={assignedCourseCount ? `担当コース ${assignedCourseCount}件` : "担当コースがありません"} />
            <PrismKpiCard icon={NotebookPen} tone={todayPendingReportCount ? "warn" : "ok"} label="本日の日報" value={todayPendingReportCount} unit="件"
              detail={todayCourses.length ? "未提出・未コメントの合計です" : "本日は研修なし"} />
            <PrismKpiCard icon={Clock} tone={notClockedIn.length ? "bad" : "ok"} label="本日まだ未打刻"
              value={attendanceAvailable ? notClockedIn.length : "—"} unit="名"
              detail={attendanceAvailable ? (todayAttendance.length ? `本日の対象 ${todayAttendance.length}名` : "対象の受講生がいません") : "本日は研修なし"} />
          </div>

          {/* お知らせ登録(NoticeCard)は他に入力手段が無いため残す */}
          <NoticeCard courses={courseBlocks} date={date} onSaved={() => load({ silent: true })} />

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              <TrainingHomePanel title="いま手を打つこと" meta="放っておくと溜まるもの">
                {actionRows.length ? actionRows.map(row => (
                  <TrainingHomePanelRow key={row.key} icon={row.icon} tone={row.tone} label={row.label} sub={row.sub} actionLabel={row.actionLabel} onAction={row.onAction} />
                )) : (
                  <div className="py-2 text-[12.5px]" style={{ color: PRISM.sub }}>いま手を打つものはありません。</div>
                )}
              </TrainingHomePanel>

              <TrainingHomePanel title="本日の出欠" meta={attendanceAvailable && todayAttendance.length ? `${attendanceOkCount} / ${todayAttendance.length}名 出勤済み` : ""}>
                {!attendanceAvailable ? (
                  <div className="py-2 text-[12.5px]" style={{ color: PRISM.sub }}>本日は研修日ではないため、出欠の対象がありません。</div>
                ) : !todayAttendance.length ? (
                  <div className="py-2 text-[12.5px]" style={{ color: PRISM.sub }}>本日の研修コースに在籍している受講生がいません。</div>
                ) : (
                  <>
                    {[...notClockedIn, ...attendanceNotes].slice(0, 6).map(item => (
                      <TrainingHomePanelRow key={item.traineeId} icon={Clock}
                        tone={item.state === "not_clocked_in" || item.state === "absent" ? "bad" : "warn"}
                        label={textOf(item.name, "受講生")} sub={attendanceStateLabel(item)}
                        actionLabel="勤怠" onAction={() => go("attendance")} />
                    ))}
                    {attendanceOkCount > 0 && (
                      <TrainingHomePanelRow icon={ClipboardCheck} tone="ok" label={`ほか${attendanceOkCount}名は出勤済み`} sub="打刻された時刻は勤怠で確認できます" actionLabel="一覧" onAction={() => go("attendance")} />
                    )}
                  </>
                )}
              </TrainingHomePanel>
            </div>

            <div className="flex min-w-0 flex-col gap-3">
              <TrainingHomePanel title="今日の進行">
                <TrainingHomePanelRow icon={BookOpen} tone="accent" label={primaryCourse ? textOf(primaryCourse.courseName, "コース名未設定") : "今日の授業"} sub={primaryCourse?.curriculumText || "今日の授業は未設定です。"} actionLabel="状況" onAction={() => { if (primaryCourse) setActiveCourseId(primaryCourse.courseId); go("courses"); }} />
                <TrainingHomePanelRow icon={NotebookPen} tone={todayPendingReportCount ? "warn" : "ok"} label="日報" sub={todayCourses.length ? "本日の提出状況と未コメントを確認できます" : "本日は研修なし"} actionLabel="確認" onAction={() => go("reports")} />
              </TrainingHomePanel>
              <TrainingHomePanel title="授業の準備" meta={`本日の単元 ${todayLessonCount}件`}>
                <TrainingHomePanelRow icon={CalendarDays} tone={hasLessonPrep ? "accent" : "warn"} label="カリキュラム・教材" sub={hasLessonPrep ? "教材・テストの準備状況を確認できます" : "本日は研修実施日ではありません"} actionLabel="開く" onAction={() => go("curriculum")} />
                <TrainingHomePanelRow icon={FileText} tone="neutral" label="研修資料" sub="配布物の登録・差し替えができます" actionLabel="開く" onAction={() => go("materials")} />
                <TrainingHomePanelRow icon={ClipboardCheck} tone="neutral" label="テスト" sub="出題と採点の状況を確認できます" actionLabel="開く" onAction={() => go("tests")} />
              </TrainingHomePanel>
            </div>
          </div>

          {!todayCourses.length && (
            <PrismCard className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-[240px] flex-1">
                <div className="text-[13.5px] font-bold" style={{ color: PRISM.ink }}>研修がない日にできること</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: PRISM.sub }}>
                  次回の単元の準備、教材の差し替え、溜まっている日報へのコメントが進められます。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn size="sm" kind="soft" onClick={() => go("curriculum")}>カリキュラム</Btn>
                  <Btn size="sm" kind="ghost" onClick={() => go("reports")}>日報</Btn>
                </div>
              </div>
              <div className="hidden shrink-0 md:block" aria-hidden="true"><InstructorHomeIllustration /></div>
            </PrismCard>
          )}
        </>
      )}
    </PrismPage>
  );
}
