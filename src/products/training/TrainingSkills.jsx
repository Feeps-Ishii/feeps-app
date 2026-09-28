import React, { useEffect, useState } from "react";
import { CheckCircle2, GraduationCap } from "lucide-react";
import { apiGet } from "../../api.js";
import { Card, SectionHead, EmptyState, SkeletonRows, PrismErrorRetryCard, T } from "../../components/common";

/* 研修スキル（受講生本人）。2026-09-28〜
   LMSを研修管理だけにしたのに合わせ、スキル・成長のProductから研修管理へ移した（ADR 0023）。
   研修の中で身についたこと（目標とタスクの達成・テストの結果）だけを出す。
   研修外のスキル・資格の登録、案件用スキルシート、Eラーニングの取得スキルは出さない（ユーザー決定）。 */

function safeGoals(goals) {
  return Array.isArray(goals) ? goals.map(g => ({ ...g, tasks: Array.isArray(g?.tasks) ? g.tasks : [] })) : [];
}
function goalProgress(goals, done) {
  return safeGoals(goals).map(g => {
    const n = g.tasks.filter(t => done?.[t.id]).length;
    return { ...g, n, total: g.tasks.length, pct: g.tasks.length ? Math.round((n / g.tasks.length) * 100) : 0 };
  });
}
function Bar({ value, tone }) {
  const color = tone === "green" ? T.success : tone === "amber" ? T.warning : T.accent;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: T.border }}>
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color, transition: "width .8s ease" }} />
    </div>
  );
}

export default function TrainingSkills({ done = {}, goals = [], go }) {
  const [tests, setTests] = useState(null); // null＝読み込み中 / "error"
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setTests(null);
    apiGet("/tests/me")
      .then(ts => { if (alive) setTests(Array.isArray(ts) ? ts : []); })
      .catch(() => { if (alive) setTests("error"); });
    return () => { alive = false; };
  }, [reload]);

  const gp = goalProgress(goals, done);
  const acquired = safeGoals(goals).flatMap(g => g.tasks).filter(t => done[t.id]);
  const list = Array.isArray(tests) ? tests : [];
  const scores = list.map(t => Number(t.score)).filter(n => Number.isFinite(n));
  const avg = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null;
  const passed = list.filter(t => (Number(t.officialScore ?? t.score) || 0) >= 60).length;

  return (
    <div>
      <SectionHead title="研修スキル" desc="目標とタスクの達成と、テストの結果から見た研修の習得状況です。" />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl p-4" style={{ background: T.accentSubtle, border: `1px solid ${T.border}` }}>
          <div className="text-xs font-bold" style={{ color: T.textMuted }}>習得済みタスク</div>
          <div className="mt-1 text-2xl font-bold" style={{ color: T.textPrimary }}>{acquired.length}<span className="ml-1 text-sm font-normal" style={{ color: T.textMuted }}>件</span></div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: T.successSubtle, border: `1px solid ${T.border}` }}>
          <div className="text-xs font-bold" style={{ color: T.textMuted }}>テスト合格</div>
          <div className="mt-1 text-2xl font-bold" style={{ color: T.success }}>
            {tests === null ? "…" : tests === "error" ? "—" : <>{passed}<span className="ml-1 text-sm font-normal" style={{ color: T.textMuted }}>件</span></>}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: T.bgBase }}>
          <div className="text-xs font-bold" style={{ color: T.textMuted }}>テスト平均点</div>
          <div className="mt-1 text-2xl font-bold" style={{ color: T.textPrimary }}>{tests === null ? "…" : tests === "error" || avg == null ? "—" : `${avg}点`}</div>
        </div>
      </div>
      {tests === "error" && (
        <div className="mb-5"><PrismErrorRetryCard message="テストの結果を取得できませんでした。" onRetry={() => setReload(v => v + 1)} /></div>
      )}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2"><GraduationCap size={16} style={{ color: T.accent }} /><h3 className="font-bold" style={{ color: T.textPrimary }}>研修で身についたこと</h3></div>
        {tests === null && gp.length === 0 ? <SkeletonRows rows={3} />
          : gp.length === 0
            ? <EmptyState title="目標がまだありません" desc="目標とタスクに目標を追加すると、ここに達成状況が出ます。" />
            : (<>
              <div className="mb-4 grid gap-2 sm:grid-cols-2">{gp.map(g => (
                <div key={g.id}>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-medium" style={{ color: T.textSecondary }}>{g.title}</span><span style={{ color: T.textMuted }}>{g.n}/{g.total}</span></div>
                  <Bar value={g.pct} tone={g.pct >= 80 ? "green" : g.pct >= 40 ? "cyan" : "amber"} />
                </div>
              ))}</div>
              {acquired.length > 0
                ? <div className="flex flex-wrap gap-1.5">{acquired.map(s => (
                    <span key={s.id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: T.successSubtle, color: T.success }}><CheckCircle2 size={12} />{String(s.t || "").replace(/を.*$/, "").slice(0, 18)}</span>
                  ))}</div>
                : <div className="text-sm" style={{ color: T.textMuted }}>まだ完了したタスクがありません。</div>}
              {go && <button type="button" onClick={() => go("goals")} className="mt-4 text-xs font-bold" style={{ color: T.accent }}>目標とタスクを開く →</button>}
            </>)}
      </Card>
    </div>
  );
}
