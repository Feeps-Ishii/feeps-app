import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, BookOpen, CalendarDays, ClipboardCheck,
  Clock, FileText, GraduationCap, Megaphone, NotebookPen, RefreshCw, Save
} from "lucide-react";
import { apiGet, apiPut } from "../../api.js";
import {
  Badge, Btn, SkeletonCards, SkeletonRows, PRISM,
  PrismPage, PrismCard, PrismHero, PrismKpiCard, PrismErrorRetryCard, PrismEmptyBlock,
} from "../../components/common";
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
        <EmptyBlock title="担当コースがありません" desc="担当コースが設定されるとお知らせを登録できます。" />
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
  const pendingReportCount = num(summary.pendingReports) + num(summary.uncommentedReports);
  const attendanceAlertCount = num(summary.attendanceAlerts);

  const courseBlocks = useMemo(() => todayCourses.map(course => {
    const links = asObject(course.links);
    return {
      ...course,
      links,
      curriculumText: textOf(course.todayCurriculum, "今日の授業は未設定です。"),
    };
  }), [todayCourses]);

  return (
    <PrismPage>
      <PrismHero
        eyebrow="INSTRUCTOR WORKSPACE"
        title="今日の授業を、迷わず始める"
        description={`${formatDate(date)} ・ ${displayName} ・ 最終更新 ${lastUpdated ? formatDateTime(lastUpdated) : "未取得"}`}
        icon={GraduationCap}
        actions={<><Btn kind="white" icon={BookOpen} onClick={() => go("courses")}>担当コース</Btn><Btn kind="white" icon={RefreshCw} onClick={() => load({ silent: true })}>{refreshing ? "更新中" : "更新"}</Btn></>}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full px-3 py-1.5" style={{ background: PRISM.heroGlassStrong, border: `1px solid ${PRISM.heroLine}` }}>本日の授業 {todayLessonCount}件</span>
          <span className="rounded-full px-3 py-1.5" style={{ background: PRISM.heroGlassStrong, border: `1px solid ${PRISM.heroLine}` }}>お知らせ登録 {noticeCount}/{todayCourses.length}件</span>
          {unassigned && <Badge tone="amber">{textOf(data?.scope?.message, "担当コースがありません")}</Badge>}
        </div>
      </PrismHero>

      <div className="feeps-stagger-in grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PrismKpiCard icon={BookOpen} label="担当コース" value={assignedCourseCount} unit="件" detail="担当中の研修" onClick={() => go("courses")} />
        <PrismKpiCard icon={GraduationCap} label="受講生" value={activeStudentCount} unit="名" detail="担当コースの受講生" tone="teal" onClick={() => go("trainees")} />
        <PrismKpiCard icon={NotebookPen} label="未確認日報" value={pendingReportCount} unit="件" detail="提出・コメント待ち" tone={pendingReportCount ? "warn" : "ok"} onClick={() => go("reports")} />
        <PrismKpiCard icon={Clock} label="勤怠アラート" value={attendanceAlertCount} unit="件" detail="欠席・遅刻・未打刻" tone={attendanceAlertCount ? "bad" : "ok"} onClick={() => go("attendance")} />
      </div>

      {error && <PrismErrorRetryCard message={error} onRetry={() => load()} />}

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2"><PrismCard><SkeletonCards count={3} /></PrismCard><PrismCard><SkeletonRows rows={4} /></PrismCard></div>
      ) : !error && (
        <>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <NoticeCard courses={courseBlocks} date={date} onSaved={() => load({ silent: true })} />
            <PrismCard className="p-4">
              <SectionTitle icon={ClipboardCheck} title="今日やること" desc="ここだけ見れば授業開始に進めます。" />
              <div className="grid gap-3 sm:grid-cols-2">
                <ActionCard icon={Clock} title="勤怠確認" value={`異常 ${attendanceAlertCount}件`} desc="欠席・遅刻・未打刻を確認します。" buttonLabel="確認する" onClick={() => go("attendance")} tone={attendanceAlertCount ? "alert" : "normal"} />
                <ActionCard icon={NotebookPen} title="日報確認" value={`未確認 ${pendingReportCount}件`} desc="提出状況と未コメントを確認します。" buttonLabel="確認する" onClick={() => go("reports")} tone={pendingReportCount ? "alert" : "normal"} />
                <ActionCard icon={BookOpen} title="授業準備" value={`${todayLessonCount}件`} desc="今日のカリキュラム、教材、テストを開きます。" buttonLabel="開く" onClick={() => go("curriculum")} />
                <ActionCard icon={ClipboardCheck} title="テスト" value="結果と採点" desc="受験状況の確認と採点を行います。" buttonLabel="開く" onClick={() => go("tests")} />
              </div>
            </PrismCard>
          </div>

          <PrismCard className="p-4">
            <SectionTitle icon={GraduationCap} title="今日の担当コース" desc="必要な情報だけを表示します。" />
            {courseBlocks.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {courseBlocks.map((course, index) => (
                  <div key={course.courseId || index} className="rounded-2xl p-3" style={{ background: PRISM.base, border: `1px solid ${PRISM.line}` }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold" style={{ color: PRISM.ink }}>{textOf(course.courseName, "コース名未設定")}</div>
                        <div className="mt-1 truncate text-xs" style={{ color: PRISM.mut }}>{textOf(course.companyName, "企業未設定")} ・ 受講生 {Number(course.studentCount || 0)}名</div>
                        <div className="mt-2 truncate text-sm" style={{ color: PRISM.sub }}>{course.curriculumText}</div>
                      </div>
                      <CourseOpenButton course={course} go={go} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyBlock title="今日の担当コースはありません" desc="担当コースが設定されるとここに表示されます。" />}
          </PrismCard>

          <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
            <PrismCard className="p-4">
              <SectionTitle icon={FileText} title="最近の提出" desc="最新5件だけ表示します。" action={<Btn size="sm" kind="ghost" icon={ArrowUpRight} onClick={() => go("reports")}>一覧へ</Btn>} />
              {recentActivity.length ? (
                <div className="space-y-1.5">
                  {recentActivity.map((item, index) => (
                    <button type="button" key={`${item.type}-${item.traineeId}-${item.occurredAt}-${index}`} onClick={() => item.targetUrl && goFromUrl(item.targetUrl, go)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-black/[.03]">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: PRISM.accentSubtle, color: PRISM.accent }}>
                        {String(item.type || "").includes("test") ? <ClipboardCheck size={14} /> : String(item.type || "").includes("comment") ? <NotebookPen size={14} /> : <FileText size={14} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold" style={{ color: PRISM.ink }}>{textOf(item.label, "新着")}</span>
                        <span className="block truncate text-xs" style={{ color: PRISM.mut }}>{textOf(item.traineeName, "受講生")} ・ {textOf(item.courseName, "コース")} ・ {formatDateTime(item.occurredAt)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : <EmptyBlock title="最近の提出はありません" desc="提出やコメントがあるとここに表示されます。" />}
            </PrismCard>

            <PrismCard className="p-4">
              <SectionTitle icon={CalendarDays} title="授業準備" desc="教材とテストの準備状況を確認します。" />
              {hasLessonPrep ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {(lessonPrep.length ? lessonPrep : courseBlocks).map((item, index) => {
                    const targetUrls = asObject(item.targetUrls || item.links);
                    return (
                      <div key={item.courseId || index} className="rounded-2xl p-3" style={{ background: PRISM.base, border: `1px solid ${PRISM.line}` }}>
                        <div className="truncate text-sm font-bold" style={{ color: PRISM.ink }}>{textOf(item.courseName, "コース名未設定")}</div>
                        <div className="mt-1 truncate text-sm" style={{ color: PRISM.sub }}>{textOf(item.curriculumTitle ?? item.curriculumText, "今日の授業は未設定です。")}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs" style={{ color: PRISM.mut }}>
                          <span>教材 {Number(item.materialCount || 0)}件</span>
                          <span>テスト {Number(item.testCount || 0)}件</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3">
                          <LinkButton label="教材" targetUrl={targetUrls.materials} go={go} />
                          <LinkButton label="テスト" targetUrl={targetUrls.tests} go={go} />
                          <LinkButton label="カリキュラム" targetUrl={targetUrls.curriculum} go={go} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyBlock title="授業準備データはありません" desc="カリキュラムや教材が登録されるとここに表示されます。" />}
            </PrismCard>
          </div>

        </>
      )}
    </PrismPage>
  );
}
