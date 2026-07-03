import React, { useMemo, useState } from "react";
import { BookOpen, Building2, Calendar, CheckCircle2, Clock, Eye, Search, Target, User } from "lucide-react";
import { Badge, Btn, Card, EmptyState, SectionHead, Stat, fieldStyle, T, PRODUCT_ACCENT } from "../../../components/common";
import { ENROLLMENT_STATUS_OPTIONS } from "./LearningAdminCatalog.js";
import { useLearningAdmin } from "./useLearningAdmin.js";

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase, green: PRODUCT_ACCENT.learning.accent, amber: T.warning, cyan: T.accent };

const statusLabel = {
  not_started: "未着手",
  in_progress: "学習中",
  completed: "修了",
};

const statusTone = {
  not_started: "muted",
  in_progress: "amber",
  completed: "green",
};

function ProgressBar({ value }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "#ECF1F4" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: C.green }} />
    </div>
  );
}

function EnrollmentRow({ enrollment, selected, onSelect }) {
  return (
    <Card className="p-4" hover onClick={() => onSelect(enrollment)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold" style={{ color: selected ? C.green : C.ink }}>{enrollment.traineeName}</h3>
            <Badge tone={statusTone[enrollment.status]}>{statusLabel[enrollment.status]}</Badge>
            <Badge tone="cyan">{enrollment.courseTitle}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: C.muted }}>
            <span className="inline-flex items-center gap-1"><Building2 size={13} />{enrollment.companyName}</span>
            <span>{enrollment.completedLessons} / {enrollment.totalLessons} Lessons</span>
            <span>最終学習: {enrollment.lastStudiedAt || "-"}</span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_52px] md:items-center">
            <ProgressBar value={enrollment.progress} />
            <div className="text-right text-xs font-bold" style={{ color: C.ink }}>{enrollment.progress}%</div>
          </div>
        </div>
        <Btn kind="ghost" size="sm" icon={Eye} onClick={() => onSelect(enrollment)}>詳細</Btn>
      </div>
    </Card>
  );
}

function DetailPanel({ enrollment, onMemoChange, onMemoSave }) {
  const [memoDraft, setMemoDraft] = useState(enrollment?.memo || "");

  React.useEffect(() => {
    setMemoDraft(enrollment?.memo || "");
  }, [enrollment?.id]);

  if (!enrollment) {
    return (
      <Card className="p-6">
        <EmptyState title="受講者を選択してください" desc="一覧から受講者を選ぶと、進捗詳細を確認できます。" />
      </Card>
    );
  }

  const incomplete = Math.max(0, enrollment.totalLessons - enrollment.completedLessons);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-bold" style={{ color: C.ink }}>{enrollment.traineeName}</div>
          <div className="mt-1 text-xs" style={{ color: C.muted }}>{enrollment.companyName}</div>
        </div>
        <Badge tone={statusTone[enrollment.status]}>{statusLabel[enrollment.status]}</Badge>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold" style={{ color: C.body }}>
            <span>{enrollment.courseTitle}</span>
            <span>{enrollment.progress}%</span>
          </div>
          <ProgressBar value={enrollment.progress} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl p-3" style={{ background: C.canvas }}>
            <div className="text-xs" style={{ color: C.muted }}>受講中コース</div>
            <div className="mt-1 text-sm font-bold" style={{ color: C.ink }}>{enrollment.status === "in_progress" ? 1 : 0}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: C.canvas }}>
            <div className="text-xs" style={{ color: C.muted }}>修了済みコース</div>
            <div className="mt-1 text-sm font-bold" style={{ color: C.ink }}>{enrollment.status === "completed" ? 1 : 0}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: C.canvas }}>
            <div className="text-xs" style={{ color: C.muted }}>総学習時間</div>
            <div className="mt-1 text-sm font-bold" style={{ color: C.ink }}>{enrollment.learningMinutes}分</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: C.canvas }}>
            <div className="text-xs" style={{ color: C.muted }}>修了日</div>
            <div className="mt-1 text-sm font-bold" style={{ color: C.ink }}>{enrollment.completedAt || "-"}</div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-bold" style={{ color: C.body }}>獲得スキル</div>
          <div className="flex flex-wrap gap-1">
            {(enrollment.skills || []).map(skill => <Badge key={skill} tone="green">{skill}</Badge>)}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-bold" style={{ color: C.body }}>最近の学習履歴</div>
          <div className="space-y-2">
            {(enrollment.recentHistory || []).length ? enrollment.recentHistory.map(item => (
              <div key={item} className="rounded-xl px-3 py-2 text-xs" style={{ background: C.canvas, color: C.body }}>{item}</div>
            )) : <div className="text-xs" style={{ color: C.muted }}>履歴はまだありません。</div>}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-bold" style={{ color: C.body }}>未完了レッスン</div>
          <div className="rounded-xl px-3 py-2 text-xs" style={{ background: C.canvas, color: C.body }}>
            残り {incomplete} Lessons
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-bold" style={{ color: C.body }}>管理者メモ</div>
          <textarea
            style={{ ...fieldStyle, minHeight: 96 }}
            value={memoDraft}
            onChange={e => setMemoDraft(e.target.value)}
            placeholder="次回フォロー内容や復習ポイントを記録"
          />
          <div className="mt-2">
            <Btn size="sm" onClick={() => onMemoSave(enrollment.id, memoDraft)}>メモ保存</Btn>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function EnrollmentManager() {
  const { courses, enrollments, enrollmentStats, updateEnrollmentMemo } = useLearningAdmin();
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);

  const companies = useMemo(() => Array.from(new Set(enrollments.map(e => e.companyName).filter(Boolean))).sort(), [enrollments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrollments.filter(enrollment => {
      if (courseFilter && enrollment.courseId !== courseFilter) return false;
      if (statusFilter && enrollment.status !== statusFilter) return false;
      if (companyFilter && enrollment.companyName !== companyFilter) return false;
      if (!q) return true;
      return [
        enrollment.traineeName,
        enrollment.companyName,
        enrollment.courseTitle,
        enrollment.memo,
        ...(enrollment.skills || []),
      ].some(value => String(value || "").toLowerCase().includes(q));
    });
  }, [enrollments, query, courseFilter, statusFilter, companyFilter]);

  function saveMemo(enrollmentId, memo) {
    updateEnrollmentMemo(enrollmentId, memo);
    setSelectedEnrollment(prev => prev?.id === enrollmentId ? { ...prev, memo } : prev);
  }

  return (
    <div className="space-y-5">
      <SectionHead title="受講状況" desc="受講者ごとのEラーニング進捗、修了状況、獲得スキルを確認します。" />

      <Card className="p-5">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-bold" style={{ color: C.ink }}>管理者向け進捗モニタリング</div>
          <p className="text-xs" style={{ color: C.body }}>
            今回はモックデータとlocalStorageで受講状況を確認します。API化後は同じ表示を進捗テーブルへ接続します。
          </p>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-5">
        <Stat icon={User} label="総受講者数" value={enrollmentStats.totalTrainees} sub="ユニーク人数" tone="green" />
        <Stat icon={BookOpen} label="学習中" value={enrollmentStats.inProgressTrainees} sub="進行中" tone="cyan" />
        <Stat icon={CheckCircle2} label="修了済み" value={enrollmentStats.completedTrainees} sub="完了者" tone="green" />
        <Stat icon={Target} label="未着手" value={enrollmentStats.notStartedTrainees} sub="要フォロー" tone="amber" />
        <Stat icon={Clock} label="平均進捗率" value={`${enrollmentStats.averageProgress}%`} sub="全受講データ" tone="muted" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-3">
          <Card className="p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_150px_180px]">
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: C.line, background: "#fff" }}>
                <Search size={16} style={{ color: C.muted }} />
                <input
                  className="w-full bg-transparent text-sm outline-none"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="受講者名・企業・スキルで検索"
                  style={{ color: C.ink }}
                />
              </div>
              <select style={fieldStyle} value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
                <option value="">全コース</option>
                {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
              <select style={fieldStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">全ステータス</option>
                {ENROLLMENT_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select style={fieldStyle} value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
                <option value="">全企業</option>
                {companies.map(company => <option key={company} value={company}>{company}</option>)}
              </select>
            </div>
          </Card>

          {filtered.length ? (
            <div className="space-y-3">
              {filtered.map(enrollment => (
                <EnrollmentRow
                  key={enrollment.id}
                  enrollment={enrollment}
                  selected={selectedEnrollment?.id === enrollment.id}
                  onSelect={setSelectedEnrollment}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="該当する受講状況がありません" desc="検索条件またはフィルタを変更してください。" />
          )}
        </div>

        <DetailPanel enrollment={selectedEnrollment || filtered[0] || null} onMemoSave={saveMemo} />
      </div>
    </div>
  );
}
