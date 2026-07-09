import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowUpRight, BookOpen, Calendar, CheckCircle2, ClipboardCheck,
  Clock, FileText, GraduationCap, NotebookPen, RefreshCw, Users
} from "lucide-react";
import { apiGet } from "../../api.js";
import { Badge, Btn, Card, PageHeader, SkeletonCards, SkeletonRows, T } from "../../components/common";

const SEVERITY_TONE = {
  high: "red",
  medium: "amber",
  low: "cyan",
  info: "muted",
};

const TODO_LABELS = {
  report_unchecked: "未確認日報",
  report_uncommented: "未コメント日報",
  attendance_alert: "勤怠異常",
  test_pending_review: "確認待ちテスト",
  test_unsubmitted: "未受験テスト",
  test_low_score: "低スコア",
  follow_up_students: "要フォロー受講生",
  lesson_prep: "授業準備",
};

const WARNING_LABELS = {
  learning_progress_unavailable: "Learning進捗遅れは初期版では未集計です。",
  talent_summary_unavailable: "Talentの成長情報は初期版では未集計です。",
  comment_type_unavailable: "コメント種別の分離は今後の拡張対象です。",
  instructor_unassigned_readonly: "担当コース未設定のため、閲覧用の情報として表示しています。",
};

function textOf(value, fallback = "") {
  if (value == null || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(v => textOf(v)).filter(Boolean).join("、") || fallback;
  if (typeof value === "object") {
    return textOf(
      value.title ?? value.name ?? value.label ?? value.text ?? value.message ?? value.reason ?? value.content,
      fallback
    );
  }
  return fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function formatDate(value) {
  if (!value) return "";
  return String(value).replaceAll("-", "/");
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toneForSeverity(severity) {
  return SEVERITY_TONE[severity] || "muted";
}

function goFromUrl(url, go) {
  const text = String(url || "");
  if (text.includes("attendance")) return go("attendance");
  if (text.includes("tests")) return go("tests");
  if (text.includes("materials")) return go("materials");
  if (text.includes("curriculum")) return go("curriculum");
  if (text.includes("trainees") || text.includes("students")) return go("trainees");
  if (text.includes("reports")) return go("reports");
  return go("home");
}

function EmptyBlock({ title, desc }) {
  return (
    <div className="rounded-xl px-4 py-5 text-sm" style={{ background: T.bgBase, color: T.textMuted }}>
      <div className="font-semibold" style={{ color: T.textSecondary }}>{title}</div>
      {desc && <div className="mt-1 text-xs">{desc}</div>}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, desc, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: T.accentSubtle, color: T.accentHover }}><Icon size={16} /></span>}
          <h3 className="text-base font-bold" style={{ color: T.textPrimary }}>{title}</h3>
        </div>
        {desc && <p className="mt-1 text-xs" style={{ color: T.textMuted }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function TodoCard({ todo, go }) {
  const count = Number(todo?.count || 0);
  const active = count > 0;
  const tone = active ? toneForSeverity(todo?.severity) : "muted";
  return (
    <button type="button" onClick={() => todo?.targetUrl && goFromUrl(todo.targetUrl, go)} disabled={!todo?.targetUrl}
      className="rounded-xl p-4 text-left transition hover:-translate-y-0.5 disabled:cursor-default disabled:hover:translate-y-0"
      style={{ background: active ? T.bgSurface : T.bgBase, border: `1px solid ${active ? T.border : "transparent"}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold" style={{ color: active ? T.textPrimary : T.textSecondary }}>{todo?.label || TODO_LABELS[todo?.type] || "確認項目"}</div>
          <div className="mt-1 text-xs leading-relaxed" style={{ color: T.textMuted }}>{textOf(todo?.reason, "該当する項目を確認します。")}</div>
        </div>
        <Badge tone={tone}>{count}件</Badge>
      </div>
    </button>
  );
}

function LinkButton({ label, targetUrl, go }) {
  if (!targetUrl) return null;
  return (
    <button type="button" onClick={() => goFromUrl(targetUrl, go)}
      className="inline-flex items-center gap-1 text-xs font-semibold transition hover:opacity-70"
      style={{ color: T.accentHover }}>
      {label}<ArrowUpRight size={12} />
    </button>
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
  const todayCourses = asArray(data?.todayCourses);
  const followUps = asArray(data?.followUps);
  const recentActivity = asArray(data?.recentActivity);
  const lessonPrep = asArray(data?.lessonPrep);
  const todos = useMemo(() => asArray(data?.todos).sort((a, b) => {
    const ap = Number(a?.priority || 99);
    const bp = Number(b?.priority || 99);
    if (ap !== bp) return ap - bp;
    return Number(b?.count || 0) - Number(a?.count || 0);
  }), [data]);
  const warnings = asArray(data?.warnings);
  const readOnly = Boolean(data?.scope?.readOnly);

  return (
    <div>
      <PageHeader
        product="training"
        label="Instructor Workspace"
        title="今日見るべき受講生と未処理"
        description={`${formatDate(data?.date)} の担当コース、日報、勤怠、テスト、授業準備をまとめて確認します。`}
        chips={[
          { label: "担当コース", value: Number(summary.assignedCourses || data?.scope?.assignedCourseCount || 0), unit: "件" },
          { label: "未コメント日報", value: Number(summary.uncommentedReports || 0), unit: "件" },
          { label: "勤怠異常", value: Number(summary.attendanceAlerts || 0), unit: "件" },
          { label: "要フォロー", value: Number(summary.followUpStudents || 0), unit: "名" },
        ]}
        cta={{ label: refreshing ? "更新中" : "更新", icon: RefreshCw, onClick: () => load({ silent: true }) }}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm" style={{ color: T.textSecondary }}>
          {displayName} ・ 最終更新 {lastUpdated ? formatDateTime(lastUpdated) : "未取得"}
        </div>
        {readOnly && <Badge tone="amber">{data?.scope?.message || "担当未設定のため閲覧のみ"}</Badge>}
      </div>

      {error && (
        <Card className="mb-5 p-4">
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
        <div className="grid gap-5 lg:grid-cols-2"><Card><SkeletonCards count={3} /></Card><Card><SkeletonRows rows={5} /></Card></div>
      ) : !error && (
        <>
          <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
            <Card className="p-5">
              <SectionTitle icon={GraduationCap} title="今日の担当コース" desc="授業準備と確認画面へ進む入口です。" />
              {todayCourses.length ? (
                <div className="space-y-3">
                  {todayCourses.map((course, index) => {
                    const links = asObject(course.links);
                    const dailyNote = asObject(course.dailyNote);
                    const curriculumText = textOf(course.todayCurriculum, "今日のカリキュラムは未設定です。");
                    const dailyNoteText = textOf(dailyNote.announcement ?? dailyNote.lessonMemo ?? dailyNote.lessonTitle);
                    return (
                    <div key={course.courseId || index} className="rounded-xl p-4" style={{ background: T.bgBase }}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold" style={{ color: T.textPrimary }}>{textOf(course.courseName, "コース名未設定")}</div>
                          <div className="mt-1 text-xs" style={{ color: T.textMuted }}>{textOf(course.companyName, "企業未設定")} ・ 受講生 {Number(course.studentCount || 0)}名</div>
                          <div className="mt-3 text-sm" style={{ color: T.textSecondary }}>{curriculumText}</div>
                          {dailyNoteText && <div className="mt-2 text-xs leading-relaxed" style={{ color: T.textMuted }}>{dailyNoteText}</div>}
                        </div>
                        <Badge tone={course.readOnly ? "amber" : "green"}>{course.readOnly ? "閲覧のみ" : "担当"}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <LinkButton label="教材" targetUrl={links.materials} go={go} />
                        <LinkButton label="日報" targetUrl={links.reports} go={go} />
                        <LinkButton label="勤怠" targetUrl={links.attendance} go={go} />
                        <LinkButton label="テスト" targetUrl={links.tests} go={go} />
                      </div>
                    </div>
                  );})}
                </div>
              ) : <EmptyBlock title="今日の担当コースはありません" desc="担当コースが設定されるとここに表示されます。" />}
            </Card>

            <Card className="p-5">
              <SectionTitle icon={ClipboardCheck} title="今日やること" desc="未処理と異常を優先度順に表示します。" />
              {todos.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {todos.map(todo => <TodoCard key={todo.type + (todo.courseId || "")} todo={todo} go={go} />)}
                </div>
              ) : <EmptyBlock title="今日の未処理はありません" desc="新しい提出や異常があるとここに表示されます。" />}
            </Card>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <Card className="p-5">
              <SectionTitle icon={Users} title="要フォロー受講生" desc="複数理由がある受講生ほど優先して確認します。" action={<Badge tone={summary.followUpStudents ? "amber" : "green"}>{summary.followUpStudents || 0}名</Badge>} />
              {followUps.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {followUps.map((item, index) => (
                    <button type="button" key={item.traineeId || index} onClick={() => item.targetUrl && goFromUrl(item.targetUrl, go)}
                      className="rounded-xl p-4 text-left transition hover:-translate-y-0.5"
                      style={{ background: T.bgBase, border: `1px solid ${T.border}` }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold" style={{ color: T.textPrimary }}>{textOf(item.traineeName, "受講生名未設定")}</div>
                          <div className="mt-1 truncate text-xs" style={{ color: T.textMuted }}>{textOf(item.companyName, "企業未設定")} ・ {textOf(item.courseName, "コース未設定")}</div>
                        </div>
                        <Badge tone={toneForSeverity(item.severity)}>{item.severity === "high" ? "高" : item.severity === "medium" ? "中" : "確認"}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {asArray(item.reasons).slice(0, 5).map((reason, reasonIndex) => <Badge key={textOf(reason.type) + textOf(reason.label) + reasonIndex} tone={toneForSeverity(reason.severity || item.severity)}>{textOf(reason.label ?? reason.type, "確認")}</Badge>)}
                      </div>
                      <div className="mt-3 text-xs" style={{ color: T.textMuted }}>最終更新 {formatDateTime(item.lastUpdatedAt) || "未設定"}</div>
                    </button>
                  ))}
                </div>
              ) : <EmptyBlock title="要フォロー受講生はいません" desc="日報、勤怠、テストに注意点が出るとここに表示されます。" />}
            </Card>

            <Card className="p-5">
              <SectionTitle icon={Clock} title="最近の提出/コメント" desc="直近の動きを確認します。" />
              {recentActivity.length ? (
                <div className="space-y-2">
                  {recentActivity.map((item, index) => (
                    <button type="button" key={`${item.type}-${item.traineeId}-${item.occurredAt}-${index}`} onClick={() => item.targetUrl && goFromUrl(item.targetUrl, go)}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-black/[.03]">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: T.accentSubtle, color: T.accentHover }}>
                        {item.type?.includes("test") ? <ClipboardCheck size={15} /> : item.type?.includes("comment") ? <NotebookPen size={15} /> : <FileText size={15} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold" style={{ color: T.textPrimary }}>{textOf(item.label, "新着")}</span>
                        <span className="mt-0.5 block truncate text-xs" style={{ color: T.textMuted }}>{textOf(item.traineeName, "受講生")} ・ {textOf(item.courseName, "コース")} ・ {formatDateTime(item.occurredAt)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : <EmptyBlock title="最近の提出はありません" desc="提出やコメントがあるとここに表示されます。" />}
            </Card>
          </div>

          <Card className="mt-5 p-5">
            <SectionTitle icon={BookOpen} title="授業準備" desc="今日のカリキュラム、教材、テスト準備へ進みます。" />
            {lessonPrep.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {lessonPrep.map((item, index) => {
                  const targetUrls = asObject(item.targetUrls);
                  return (
                  <div key={item.courseId || index} className="rounded-xl p-4" style={{ background: T.bgBase }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold" style={{ color: T.textPrimary }}>{textOf(item.courseName, "コース名未設定")}</div>
                        <div className="mt-1 text-sm" style={{ color: T.textSecondary }}>{textOf(item.curriculumTitle, "今日のカリキュラムは未設定です。")}</div>
                      </div>
                      <Badge tone={item.aiLessonDesignerAvailable ? "cyan" : "muted"}>{item.aiLessonDesignerAvailable ? "AI利用可" : "AI未設定"}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs" style={{ color: T.textMuted }}>
                      <span>教材 {Number(item.materialCount || 0)}件</span>
                      <span>テスト {Number(item.testCount || 0)}件</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <LinkButton label="カリキュラム" targetUrl={targetUrls.curriculum} go={go} />
                      <LinkButton label="教材" targetUrl={targetUrls.materials} go={go} />
                      <LinkButton label="テスト" targetUrl={targetUrls.tests} go={go} />
                      <LinkButton label="AI Lesson Designer" targetUrl={targetUrls.aiLessonDesigner} go={go} />
                    </div>
                  </div>
                );})}
              </div>
            ) : <EmptyBlock title="授業準備データはありません" desc="カリキュラムや教材が登録されるとここに表示されます。" />}
          </Card>

          {warnings.length > 0 && (
            <Card className="mt-5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 size={16} style={{ color: T.textMuted }} />
                <div className="text-sm font-bold" style={{ color: T.textPrimary }}>初期版での補足</div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {warnings.map((w, index) => (
                  <div key={textOf(w, String(index))} className="rounded-xl px-3 py-2 text-xs" style={{ background: T.bgBase, color: T.textSecondary }}>
                    {WARNING_LABELS[textOf(w)] || textOf(w)}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
