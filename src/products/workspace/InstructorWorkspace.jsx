import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, ClipboardCheck,
  Clock, FileText, GraduationCap, Megaphone, NotebookPen, RefreshCw, Save
} from "lucide-react";
import { apiGet, apiPut } from "../../api.js";
import { Badge, Btn, Card, SkeletonCards, SkeletonRows, T, PRODUCT_ACCENT } from "../../components/common";

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
    <div className="rounded-xl px-4 py-4 text-sm" style={{ background: T.bgBase, color: T.textMuted }}>
      <div className="font-semibold" style={{ color: T.textSecondary }}>{title}</div>
      {desc && <div className="mt-1 text-xs">{desc}</div>}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, desc, action }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: T.accentSubtle, color: T.accentHover }}><Icon size={15} /></span>}
          <h3 className="text-base font-bold" style={{ color: T.textPrimary, letterSpacing: "-0.02em" }}>{title}</h3>
        </div>
        {desc && <p className="mt-1 text-xs" style={{ color: T.textMuted }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function Metric({ label, value, unit }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}>
      <div className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.72)" }}>{label}</div>
      <div className="mt-0.5 text-2xl font-bold text-white" style={{ fontVariantNumeric: "tabular-nums" }}>{Number(value || 0)}<span className="ml-0.5 text-xs font-normal opacity-70">{unit}</span></div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, value, desc, buttonLabel, onClick, tone = "normal" }) {
  const accent = tone === "alert" ? T.warning : T.accentHover;
  const bg = tone === "alert" ? T.warningSubtle : T.accentSubtle;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: bg, color: accent }}><Icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold" style={{ color: T.textPrimary }}>{title}</div>
              <div className="mt-0.5 text-xs" style={{ color: T.textMuted }}>{desc}</div>
            </div>
            {value != null && <Badge tone={tone === "alert" ? "amber" : "cyan"}>{value}</Badge>}
          </div>
          <Btn className="mt-3" size="sm" kind="soft" icon={ArrowUpRight} onClick={onClick}>{buttonLabel}</Btn>
        </div>
      </div>
    </Card>
  );
}

function CourseOpenButton({ course, go }) {
  const links = asObject(course.links);
  const target = links.curriculum || links.materials || links.reports || links.attendance || links.tests;
  return <Btn size="sm" kind="ghost" icon={ArrowUpRight} onClick={() => target ? goFromUrl(target, go) : go("curriculum")}>開く</Btn>;
}

function LinkButton({ label, targetUrl, go }) {
  return (
    <button
      type="button"
      className="text-xs font-semibold hover:underline"
      style={{ color: targetUrl ? T.accentHover : T.textMuted }}
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
    <Card className="p-4">
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
              <div key={course.courseId} className="rounded-xl px-3 py-2.5" style={{ background: T.bgBase }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold" style={{ color: T.textPrimary }}>{textOf(course.courseName, "コース名未設定")}</div>
                    <div className="mt-0.5 truncate text-xs" style={{ color: announcement ? T.textSecondary : T.textMuted }}>{announcement || "未登録"}</div>
                  </div>
                  <Btn size="sm" kind="ghost" icon={NotebookPen} onClick={() => startEdit(course)}>{announcement ? "編集" : "登録"}</Btn>
                </div>
              </div>
            );
          })}
          {editingCourse && (
            <div className="rounded-xl p-3" style={{ background: T.bgSurface, border: `1px solid ${T.border}` }}>
              <div className="mb-2 text-xs font-bold" style={{ color: T.textMuted }}>{textOf(editingCourse.courseName)} へのお知らせ</div>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2}
                className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none"
                style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}
                placeholder="例: 10分前にZoomへ入室してください" />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs" style={{ color: message.includes("失敗") ? T.danger : T.success }}>{message}</span>
                <div className="flex gap-2">
                  <Btn size="sm" kind="ghost" onClick={() => setEditingCourseId("")}>閉じる</Btn>
                  <Btn size="sm" icon={Save} onClick={save} disabled={saving}>{saving ? "保存中" : "保存"}</Btn>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
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
    <div className="space-y-5">
      {/* Phase7-3正式版デザイン調整: 研修管理HomeはFeepsブランドブルーのグラデーション（KPIカードは白文字基本）。
          PRODUCT_ACCENT.trainingのgradFrom/gradToを再利用し、PageHeader経由のtrainee/client向け研修管理Homeと統一する。 */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6" style={{ background: `linear-gradient(120deg, ${PRODUCT_ACCENT.training.gradFrom} 0%, ${PRODUCT_ACCENT.training.gradTo} 100%)` }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase" style={{ color: "rgba(255,255,255,0.75)", letterSpacing: "0.14em" }}>Instructor Workspace</div>
            <h2 className="mt-1.5 text-[30px] font-medium leading-snug text-white" style={{ letterSpacing: "-0.02em" }}>今日の授業を始める</h2>
            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,.72)" }}>{formatDate(date)} ・ {displayName} ・ 最終更新 {lastUpdated ? formatDateTime(lastUpdated) : "未取得"}</p>
          </div>
          <Btn kind="white" icon={RefreshCw} onClick={() => load({ silent: true })}>{refreshing ? "更新中" : "更新"}</Btn>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="担当コース" value={assignedCourseCount} unit="件" />
          <Metric label="受講生数" value={activeStudentCount} unit="名" />
          <Metric label="未確認日報" value={pendingReportCount} unit="件" />
          <Metric label="勤怠異常" value={attendanceAlertCount} unit="件" />
        </div>
        {unassigned && <div className="mt-3"><Badge tone="amber">{textOf(data?.scope?.message, "担当コースがありません")}</Badge></div>}
      </div>

      {error && (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} style={{ color: T.danger }} />
            <div>
              <div className="text-sm font-bold" style={{ color: T.danger }}>読み込みエラー</div>
              <div className="mt-1 text-sm" style={{ color: T.textSecondary }}>{error}</div>
              <Btn className="mt-3" size="sm" kind="soft" icon={RefreshCw} onClick={() => load()}>再読み込み</Btn>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2"><Card><SkeletonCards count={3} /></Card><Card><SkeletonRows rows={4} /></Card></div>
      ) : !error && (
        <>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <NoticeCard courses={courseBlocks} date={date} onSaved={() => load({ silent: true })} />
            <Card className="p-4">
              <SectionTitle icon={ClipboardCheck} title="今日やること" desc="ここだけ見れば授業開始に進めます。" />
              <div className="grid gap-3 sm:grid-cols-2">
                <ActionCard icon={Clock} title="勤怠確認" value={`異常 ${attendanceAlertCount}件`} desc="欠席・遅刻・未打刻を確認します。" buttonLabel="確認する" onClick={() => go("attendance")} tone={attendanceAlertCount ? "alert" : "normal"} />
                <ActionCard icon={NotebookPen} title="日報確認" value={`未確認 ${pendingReportCount}件`} desc="提出状況と未コメントを確認します。" buttonLabel="確認する" onClick={() => go("reports")} tone={pendingReportCount ? "alert" : "normal"} />
                <ActionCard icon={BookOpen} title="授業準備" value={`${todayLessonCount}件`} desc="今日のカリキュラム、教材、テストを開きます。" buttonLabel="開く" onClick={() => go("curriculum")} />
                <ActionCard icon={ClipboardCheck} title="テスト" value="結果と採点" desc="受験状況の確認と採点を行います。" buttonLabel="開く" onClick={() => go("tests")} />
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <SectionTitle icon={GraduationCap} title="今日の担当コース" desc="必要な情報だけを表示します。" />
            {courseBlocks.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {courseBlocks.map((course, index) => (
                  <div key={course.courseId || index} className="rounded-xl p-3" style={{ background: T.bgBase }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold" style={{ color: T.textPrimary }}>{textOf(course.courseName, "コース名未設定")}</div>
                        <div className="mt-1 truncate text-xs" style={{ color: T.textMuted }}>{textOf(course.companyName, "企業未設定")} ・ 受講生 {Number(course.studentCount || 0)}名</div>
                        <div className="mt-2 truncate text-sm" style={{ color: T.textSecondary }}>{course.curriculumText}</div>
                      </div>
                      <CourseOpenButton course={course} go={go} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyBlock title="今日の担当コースはありません" desc="担当コースが設定されるとここに表示されます。" />}
          </Card>

          <div className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
            <Card className="p-4">
              <SectionTitle icon={FileText} title="最近の提出" desc="最新5件だけ表示します。" action={<Btn size="sm" kind="ghost" icon={ArrowUpRight} onClick={() => go("reports")}>一覧へ</Btn>} />
              {recentActivity.length ? (
                <div className="space-y-1.5">
                  {recentActivity.map((item, index) => (
                    <button type="button" key={`${item.type}-${item.traineeId}-${item.occurredAt}-${index}`} onClick={() => item.targetUrl && goFromUrl(item.targetUrl, go)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-black/[.03]">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: T.accentSubtle, color: T.accentHover }}>
                        {String(item.type || "").includes("test") ? <ClipboardCheck size={14} /> : String(item.type || "").includes("comment") ? <NotebookPen size={14} /> : <FileText size={14} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold" style={{ color: T.textPrimary }}>{textOf(item.label, "新着")}</span>
                        <span className="block truncate text-xs" style={{ color: T.textMuted }}>{textOf(item.traineeName, "受講生")} ・ {textOf(item.courseName, "コース")} ・ {formatDateTime(item.occurredAt)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : <EmptyBlock title="最近の提出はありません" desc="提出やコメントがあるとここに表示されます。" />}
            </Card>

            <Card className="p-4">
              <SectionTitle icon={CalendarDays} title="授業準備" desc="教材とテストの準備状況を確認します。" />
              {hasLessonPrep ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {(lessonPrep.length ? lessonPrep : courseBlocks).map((item, index) => {
                    const targetUrls = asObject(item.targetUrls || item.links);
                    return (
                      <div key={item.courseId || index} className="rounded-xl p-3" style={{ background: T.bgBase }}>
                        <div className="truncate text-sm font-bold" style={{ color: T.textPrimary }}>{textOf(item.courseName, "コース名未設定")}</div>
                        <div className="mt-1 truncate text-sm" style={{ color: T.textSecondary }}>{textOf(item.curriculumTitle ?? item.curriculumText, "今日の授業は未設定です。")}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs" style={{ color: T.textMuted }}>
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
            </Card>
          </div>

        </>
      )}
    </div>
  );
}
