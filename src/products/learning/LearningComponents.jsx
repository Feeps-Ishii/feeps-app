import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  BadgeCheck, BookOpen, FileText, Settings, Users, Search, PlayCircle, Award,
  Sparkles, Flame, ChevronRight, ChevronLeft, Check, CheckCircle2,
  Circle, AlertCircle, Lightbulb, Calendar, Clock, RefreshCw, Download
} from "lucide-react";
import { Card, Badge, Btn, EmptyState, SectionHead, ProductNavCard, T, PRODUCT_ACCENT, PRISM } from "../../components/common";
import ElSlideLessonView from "./ElSlideLessonView.jsx";
import LearningMagazineHome, { LearningStatusHeader } from "./LearningMagazineHome.jsx";
import LearningExperienceFlow from "./LearningExperienceFlow.jsx";

// Learner-side palette: legacy key names kept, values sourced from tokens.
// "green" is the Learning product identity -> PRODUCT_ACCENT.learning.
const C = {
  cyan: T.accent, cyanDeep: T.accentHover, wash: T.accentSubtle, washDeep: T.border,
  ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, faint: T.textMuted,
  line: T.border, line2: T.border, canvas: T.bgBase,
  green: PRODUCT_ACCENT.learning.accent, greenW: PRODUCT_ACCENT.learning.subtle, amber: T.warning, amberW: T.warningSubtle,
  red: T.danger, redW: T.dangerSubtle, violet: T.aiAccent,
};
const GRAD = `linear-gradient(120deg, ${PRODUCT_ACCENT.learning.gradFrom} 0%, ${PRODUCT_ACCENT.learning.gradTo} 100%)`;
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function courseHours(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function formatCourseHours(value, prefix = "") {
  const n = courseHours(value);
  return n > 0 ? `${prefix}${n}時間` : "記録なし";
}
function recommendationReason(course) {
  if (course?.skills?.length) return `${course.skills[0]}を伸ばすため`;
  if (course?.category) return `${course.category}の基礎固め`;
  return "次の学習候補";
}

function Bar({ value, tone = "cyan" }) {
  const t = { cyan: C.cyan, green: C.green, amber: C.amber };
  return <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: C.line }}>
    <div className="h-full rounded-full" style={{ width: `${value}%`, background: t[tone], transition: "width .8s ease" }} /></div>;
}
function getLearningCourseMetrics(lrn, course) {
  const lessons = lrn.lessonsForCourse ? lrn.lessonsForCourse(course.id) : [];
  const done = lrn.getLessonsDone(course.id);
  const doneCnt = lessons.filter(l => done[l.id]?.completed).length;
  const pct = lrn.getCourseProgress ? lrn.getCourseProgress(course.id) : (lessons.length ? Math.round((doneCnt / lessons.length) * 100) : (lrn.progress[course.id]?.progress || 0));
  const nextLesson = lessons.find(l => !done[l.id]?.completed) || lessons[0] || null;
  return { lessons, done, doneCnt, pct, nextLesson };
}
function getLearningResume(lrn) {
  const candidates = lrn.inprogress
    .map(course => {
      const m = getLearningCourseMetrics(lrn, course);
      const saved = lrn.progress[course.id]?.lastLessonId;
      const last = m.lessons.find(l => l.id === saved);
      return { course, lesson: last || m.nextLesson, pct: m.pct, at: lrn.progress[course.id]?.lastAccessedAt || lrn.progress[course.id]?.startedAt || "" };
    })
    .filter(x => x.lesson);
  candidates.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return candidates[0] || null;
}
const REVIEW_STATUS_LABEL = {
  understood: "理解できた",
  uncertain: "少し不安",
  need_help: "質問したい",
  review_later: "後で復習したい",
};
const REVIEW_STATUS_TONE = {
  understood: "green",
  uncertain: "amber",
  need_help: "amber",
  review_later: "red",
};
function reviewStatusLabel(review) {
  return REVIEW_STATUS_LABEL[review?.status] || "未チェック";
}
function reviewStatusTone(review) {
  return REVIEW_STATUS_TONE[review?.status] || "muted";
}
function LearningEmptyAction({ title, desc, cta, onClick, icon: Icon = BookOpen, themeColor = PRODUCT_ACCENT.learning.accent }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid gap-4 p-5 sm:grid-cols-[150px_1fr] sm:items-center">
        <div className="flex h-28 items-center justify-center rounded-2xl" style={{ background: `${themeColor}10`, border: `1px solid ${themeColor}20` }}>
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "#fff", color: themeColor, boxShadow: "0 10px 25px rgba(21,38,47,.08)" }}>
            <Icon size={30} />
            <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: themeColor }}>+</span>
          </div>
        </div>
        <div>
          <h3 className="text-base font-bold" style={{ color: C.ink }}>{title}</h3>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: C.muted }}>{desc}</p>
          <div className="mt-4"><Btn icon={ChevronRight} onClick={onClick}>{cta}</Btn></div>
        </div>
      </div>
    </Card>
  );
}

function ElCompletionModal({ course, onClose, onGoTalent }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.55)" }} onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full" style={{ background: `${course.color}18` }}>
          <Award size={40} style={{ color: course.color }} />
        </div>
        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: C.muted }}>修了おめでとうございます 🎉</div>
        <h2 className="mt-2 text-2xl font-bold" style={{ color: C.ink }}>{course.title}</h2>
        <p className="mt-1 text-sm" style={{ color: C.muted }}>修了しました！</p>
        <div className="mt-5 rounded-2xl p-4 text-left" style={{ background: C.canvas }}>
          <div className="mb-2 text-xs font-bold" style={{ color: C.muted }}>取得スキル</div>
          <div className="flex flex-wrap gap-1.5">
            {(course.skills || []).map(s => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: C.greenW, color: C.green }}>
                <Check size={11} />{s}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: `${C.cyan}14`, color: C.cyanDeep }}>
          スキル・成長へ反映されました ✓
        </div>
        <div className="mt-5 flex gap-2">
          <Btn kind="ghost" onClick={onClose} full>閉じる</Btn>
          <Btn onClick={onGoTalent} full>スキル・成長を見る</Btn>
        </div>
      </div>
    </div>
  );
}

function LearningPlaceholder({ title, desc }) {
  return (
    <div>
      <SectionHead title={title} desc={desc} />
      <Card className="p-10 text-center">
        <BookOpen size={36} className="mx-auto mb-3" style={{ color: C.muted }} />
        <p className="text-sm font-semibold" style={{ color: C.ink }}>準備中</p>
        <p className="mt-1 text-xs" style={{ color: C.muted }}>この機能は今後実装予定です。</p>
      </Card>
    </div>
  );
}
function LearningOverview({ lrn, goSub, goProduct, onOpenDetail, role, learningPlan, themeColor = PRODUCT_ACCENT.learning.accent }) {
  const isCreator = role === "instructor" || role === "admin";
  // プラン制限バナー（ADR0014）。マガジンレイアウト内の脇カード「プランを見る」から開く
  // （2026-08-14、LearningMagazineHome.jsxへ差し替え。matching単独のロックカードは廃止）。
  const [showPlanNotice, setShowPlanNotice] = useState(false);
  const earnedSkills = lrn.getEarnedSkills();
  const todayCompleted = lrn.completed.filter(c => lrn.progress[c.id]?.completedAt?.slice(0, 10) === todayStr());
  const recommend = lrn.notStarted.slice(0, 3);
  const resume = getLearningResume(lrn);
  // 演習の誤答・AI採点低評価から復習対象コースを集計(2026-07-21追加)。コースごとに件数をまとめ、
  // Homeではコース詳細への導線のみ提示する（レッスン単位の「復習する」導線はコース詳細のWeakExercisesCard）。
  const weakByCourse = (lrn.getAllWeakItems ? lrn.getAllWeakItems() : []).reduce((acc, item) => {
    if (!item.courseId) return acc;
    acc[item.courseId] = (acc[item.courseId] || 0) + 1;
    return acc;
  }, {});
  const weakCourses = Object.entries(weakByCourse)
    .map(([courseId, count]) => ({ course: lrn.courseById ? lrn.courseById(courseId) : null, count }))
    .filter(entry => entry.course);
  // 2026-07-22: 開発演習(DevLab)独立タブ廃止に伴い、「学習」の2本柱
  // （Eラーニング／開発演習）としてホームで並べて提示する。clientはDevLab対象外。
  const canUseDevLab = role === "trainee" || role === "instructor" || role === "admin";
  return (
    <div>
      <LearningStatusHeader role={role} resume={resume} completedCount={lrn.completed.length}
        inprogressCount={lrn.inprogress.length} goSub={goSub} onOpenDetail={onOpenDetail} />

      <LearningMagazineHome role={role} isCreator={isCreator} canUseDevLab={canUseDevLab} learningPlan={learningPlan}
        goSub={goSub} goProduct={goProduct} onShowPlanNotice={() => setShowPlanNotice(true)}
        completedCount={lrn.completed.length} inprogressCount={lrn.inprogress.length} earnedSkillsCount={earnedSkills.length} />
      {showPlanNotice && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl p-4" style={{ background: C.amberW, border: `1px solid ${C.amber}30` }}>
          <p className="text-sm" style={{ color: C.ink }}>現在のプランではご利用いただけません。プラン変更のご相談は担当までご連絡ください。</p>
          <button type="button" onClick={() => setShowPlanNotice(false)} className="text-xs font-semibold shrink-0" style={{ color: C.muted }}>閉じる</button>
        </div>
      )}

      <LearningExperienceFlow className="mb-6" />

      {/* 今日の学習 */}
      <div className="mb-6">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <PlayCircle size={16} style={{ color: themeColor }} />
                <h3 className="text-base font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>前回の続き</h3>
              </div>
              {resume ? (
                <>
                  <div className="mt-3 text-lg font-bold" style={{ color: C.ink }}>{resume.course.title}</div>
                  <p className="mt-1 text-sm" style={{ color: C.muted }}>{resume.lesson.title}</p>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs" style={{ color: C.muted }}>
                      <span>進捗</span><span className="font-bold" style={{ color: themeColor }}>{resume.pct}%</span>
                    </div>
                    <Bar value={resume.pct} tone="green" />
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-3 text-lg font-bold" style={{ color: C.ink }}>最初の1レッスンを始めましょう</div>
                  <p className="mt-1 text-sm" style={{ color: C.muted }}>コースを開くと、次回からここに続きが表示されます。</p>
                </>
              )}
            </div>
            <Btn icon={PlayCircle} onClick={() => resume ? onOpenDetail(resume.course) : goSub("el_courses")}>続きから学習</Btn>
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProductNavCard product="learning" icon={BookOpen} title="コース一覧" desc="公開中のコースから学習を始める" onClick={() => goSub("el_courses")} delay={200} />
        <ProductNavCard product="learning" icon={PlayCircle} title="学習中" desc="受講中のコースを続きから再開" onClick={() => goSub("el_inprogress")} highlight badge="よく使う" delay={240} />
        <ProductNavCard product="learning" icon={Sparkles} title="獲得スキル" desc="学習で身についたスキルを確認" onClick={() => goSub("el_skills")} delay={280} />
        <ProductNavCard product="learning" icon={Award} title="修了済み" desc={`${lrn.completed.length}本修了`} onClick={() => goSub("el_completed")} delay={320} />
      </div>

      {todayCompleted.length > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl p-4" style={{ background: C.greenW, border: `1px solid ${C.green}30` }}>
          <Flame size={18} style={{ color: C.green }} />
          <div className="flex-1">
            <span className="text-sm font-bold" style={{ color: C.green }}>今日も学習しました！</span>
            <p className="mt-0.5 text-xs" style={{ color: C.green }}>{todayCompleted.map(c => c.title).join("・")} を修了</p>
          </div>
        </div>
      )}

      {/* 復習が必要な演習（誤答・AI採点低評価の集計、2026-07-21追加） */}
      {weakCourses.length > 0 && (
        <div className="mb-6 rounded-2xl p-4" style={{ background: C.amberW, border: `1px solid ${C.amber}30` }}>
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle size={16} style={{ color: C.amber }} />
            <span className="text-sm font-bold" style={{ color: C.ink }}>復習が必要な演習があります</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {weakCourses.map(({ course, count }) => (
              <button
                key={course.id}
                type="button"
                onClick={() => onOpenDetail && onOpenDetail(course)}
                className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold transition hover:shadow-sm"
                style={{ border: `1px solid ${C.line}`, color: C.ink }}
              >
                {course.title}<Badge tone="amber">{count}件</Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 学習中 */}
      {lrn.inprogress.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>学習中のコース</h3>
            <button onClick={() => goSub("el_inprogress")} className="text-xs font-semibold" style={{ color: themeColor }}>すべて見る →</button>
          </div>
          <div className="space-y-2">
            {lrn.inprogress.slice(0, 2).map(c => (
              <div key={c.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-3 transition hover:shadow-sm" style={{ border: `1px solid ${C.line}`, background: "#fff" }} onClick={() => onOpenDetail && onOpenDetail(c)}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: c.color }}>{c.title.slice(0, 2)}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>{c.title}</div>
                  <div className="mt-1.5"><Bar value={lrn.getCourseProgress ? lrn.getCourseProgress(c.id) : (lrn.progress[c.id]?.progress || 0)} tone="cyan" /></div>
                </div>
                <span className="shrink-0 text-xs font-bold" style={{ color: C.cyan }}>{lrn.getCourseProgress ? lrn.getCourseProgress(c.id) : (lrn.progress[c.id]?.progress || 0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* おすすめコース */}
      {recommend.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>おすすめコース</h3>
            <button onClick={() => goSub("el_recommend")} className="text-xs font-semibold" style={{ color: themeColor }}>すべて見る →</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {recommend.map(c => (
              <Card key={c.id} className="cursor-pointer p-4 transition hover:shadow-md" onClick={() => onOpenDetail ? onOpenDetail(c) : goSub("el_courses")}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white" style={{ background: c.color }}>{c.title.slice(0, 2)}</div>
                  <span className="text-sm font-bold" style={{ color: C.ink }}>{c.title}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{c.desc.slice(0, 40)}…</p>
                <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: C.faint }}>
                  <span>{c.level}</span><span>·</span><span>{formatCourseHours(c.duration)}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* スキル・成長への導線 */}
      {earnedSkills.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={{ background: "#7C3AED0D", border: "1px solid #7C3AED20" }}>
          <div>
            <div className="text-sm font-bold" style={{ color: PRODUCT_ACCENT.talent.accent }}>取得スキルをスキルシートに活かしましょう</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {earnedSkills.slice(0, 5).map(s => (
                <span key={s} className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#7C3AED14", color: PRODUCT_ACCENT.talent.accent }}>{s}</span>
              ))}
              {earnedSkills.length > 5 && <span className="text-xs" style={{ color: C.muted }}>+{earnedSkills.length - 5}件</span>}
            </div>
          </div>
          <Btn kind="soft" style={{ background: "#7C3AED14", color: PRODUCT_ACCENT.talent.accent }} onClick={() => goProduct && goProduct("talent")}>スキル・成長を見る</Btn>
        </div>
      )}

      {/* 管理機能 */}
      {isCreator && (
        <>
          <h3 className="mb-3 text-sm font-bold" style={{ color: C.ink }}>管理機能</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { key: "el_manage",   icon: Settings, label: "コース管理", desc: "コースの作成・編集・レッスン・教材・公開状態を管理できます。" },
              { key: "el_students", icon: Users,     label: "受講状況",     desc: "受講生の進捗と完了状況を確認できます。" },
            ].map(({ key, icon: Icon, label, desc }) => (
              <Card key={key} className="relative cursor-pointer p-4 transition hover:shadow-md" onClick={() => goSub(key)}>
                {key === "el_manage" && (
                  <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: PRISM.aiSubtle, color: PRISM.aiDeep, border: `1px solid ${C.line}` }}>AI</span>
                )}
                <div className="mb-1.5 flex items-center gap-2"><Icon size={15} style={{ color: themeColor }} />
                  <span className="text-sm font-bold" style={{ color: C.ink }}>{label}</span></div>
                <p className="text-xs" style={{ color: C.muted }}>{desc}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
function ElCourseCard({ course, prog, courseState, onStart, onComplete, onOpenDetail }) {
  const status = courseState?.status || prog?.status;
  const pct = courseState?.progress ?? prog?.progress ?? 0;
  const finalWaiting = ["lessons_completed", "review_recommended", "final_test_failed"].includes(status);
  function doOpen() { if (onOpenDetail) onOpenDetail(course); else if (onStart) onStart(course.id); }
  return (
    <Card className="overflow-hidden transition hover:shadow-md">
      <div className="cursor-pointer p-4" onClick={doOpen}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: course.color }}>
            {course.title.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold" style={{ color: C.ink }}>{course.title}</span>
              {/* Feeps公式コース(2026-08-21): 自社で作ったコースと出所を見分けられるようにする */}
              {course.official && <Badge tone="cyan"><span className="inline-flex items-center gap-1"><BadgeCheck size={11} />Feeps公式</span></Badge>}
              {status === "completed" && <Badge tone="green">修了</Badge>}
              {status === "inprogress" && <Badge tone="cyan">学習中</Badge>}
              {status === "lessons_completed" && <Badge tone="amber">総合テスト待ち</Badge>}
              {status === "review_recommended" && <Badge tone="amber">復習推奨</Badge>}
              {status === "final_test_failed" && <Badge tone="red">再挑戦</Badge>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs" style={{ color: C.muted }}>
              <span>{course.category}</span><span style={{ color: C.faint }}>·</span>
              <span>{formatCourseHours(course.duration)}</span><span style={{ color: C.faint }}>·</span>
              <span>{course.level}</span><span style={{ color: C.faint }}>·</span>
              <span>{course.lessons}レッスン</span>
            </div>
          </div>
        </div>
        {(status === "inprogress" || finalWaiting) && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs" style={{ color: C.muted }}>
              <span>進捗</span><span className="font-bold" style={{ color: C.cyan }}>{pct}%</span>
            </div>
            <Bar value={pct} tone="cyan" />
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed" style={{ color: C.muted }}>{course.desc}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {course.skills.map(s => (
            <span key={s} className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${course.color}14`, color: course.color }}>{s}</span>
          ))}
        </div>
      </div>
      <div className="flex gap-2 border-t px-4 py-3" style={{ borderColor: C.line }}>
        {!status && <Btn full icon={PlayCircle} onClick={doOpen}>コース詳細へ</Btn>}
        {status === "inprogress" && <Btn full kind="soft" icon={PlayCircle} onClick={doOpen}>続きを学習</Btn>}
        {status === "lessons_completed" && <Btn full icon={Award} onClick={doOpen}>総合テストへ進む</Btn>}
        {status === "review_recommended" && <Btn full icon={RefreshCw} onClick={doOpen}>復習して総合テストへ</Btn>}
        {status === "final_test_failed" && <Btn full icon={RefreshCw} onClick={doOpen}>再挑戦する</Btn>}
        {status === "completed" && (
          <button onClick={doOpen} className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold transition hover:opacity-80" style={{ background: C.greenW, color: C.green }}>
            <CheckCircle2 size={15} />修了済み（詳細を見る）
          </button>
        )}
      </div>
    </Card>
  );
}
function ElCourseView({ lrn, onStart, onComplete, onOpenDetail, themeColor }) {
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("すべて");
  const [originFilter, setOriginFilter] = useState("all"); // all | official | inhouse
  const catalog = lrn.catalog || [];
  const cats = ["すべて", ...new Set(catalog.map(c => c.category))];
  // 公式コースが1つも無い会社ではタブ自体を出さない（意味のない選択肢を並べない）
  const hasOfficial = catalog.some(c => c.official);
  const filtered = catalog.filter(c =>
    (catFilter === "すべて" || c.category === catFilter) &&
    (originFilter === "all" || (originFilter === "official" ? c.official : !c.official)) &&
    (!query || c.title.includes(query) || c.category.includes(query) || c.skills.some(s => s.includes(query)))
  );
  return (
    <div>
      <SectionHead title="コース一覧" desc={`全${catalog.length}コースから学習を選んで受講しましょう。`} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1" style={{ minWidth: "180px" }}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="コース・スキルで検索"
            className="ff-input w-full rounded-xl py-2 pl-8 pr-3 text-sm outline-none" style={{ border: `1px solid ${C.line2}`, color: C.ink }} />
        </div>
      </div>
      {hasOfficial && (
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            { key: "all", label: "すべて" },
            { key: "official", label: "Feeps公式コース" },
            { key: "inhouse", label: "自社のコース" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setOriginFilter(tab.key)}
              className="rounded-full px-3 py-1.5 text-xs font-bold transition"
              style={originFilter === tab.key
                ? { background: C.ink, color: "#fff", border: `1px solid ${C.ink}` }
                : { background: "#fff", color: C.body, border: `1px solid ${C.line2}` }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        {cats.map(c => (
          <button key={c} onClick={() => setCatFilter(c)} className="rounded-full px-3 py-1 text-xs font-semibold transition"
            style={{ background: catFilter === c ? themeColor : C.canvas, color: catFilter === c ? "#fff" : C.body, border: `1px solid ${catFilter === c ? themeColor : C.line2}` }}>
            {c}
          </button>
        ))}
      </div>
      {filtered.length === 0
        ? <Card><EmptyState title={catalog.length ? "コースが見つかりません" : "受講できるコースがありません"} desc={catalog.length ? "検索条件を変えてみてください。" : "公開済み、または受講中のEラーニングコースが登録されるとここに表示されます。"} /></Card>
        : <div className="grid gap-4 sm:grid-cols-2">{filtered.map(c => (
            <ElCourseCard key={c.id} course={c} prog={lrn.progress[c.id]} courseState={lrn.getCourseState(c.id)} onStart={onStart} onComplete={onComplete} onOpenDetail={onOpenDetail} />
          ))}</div>}
    </div>
  );
}
function ElInProgressView({ lrn, onStart, onComplete, onOpenDetail }) {
  const firstCourse = lrn.notStarted[0] || lrn.catalog?.[0] || null;
  return (
    <div>
      <SectionHead title="学習中" desc="受講中のコースの進捗を確認できます。" />
      {lrn.inprogress.length === 0
        ? <LearningEmptyAction title="学習中のコースがありません" desc="受講中のコースが登録されると、ここから前回の続きへ進めます。" cta={firstCourse ? "おすすめコースを見る" : "コース一覧を見る"} icon={PlayCircle} onClick={() => firstCourse && onOpenDetail ? onOpenDetail(firstCourse) : null} themeColor={PRODUCT_ACCENT.learning.accent} />
        : <div className="grid gap-4 sm:grid-cols-2">{lrn.inprogress.map(c => (
            <ElCourseCard key={c.id} course={c} prog={lrn.progress[c.id]} courseState={lrn.getCourseState(c.id)} onStart={onStart} onComplete={onComplete} onOpenDetail={onOpenDetail} />
          ))}</div>}
    </div>
  );
}
function ElCompletedView({ lrn, goSub, onOpenDetail }) {
  // 2026-08-21: 「修了証」タブを廃止してここへ統合した（同じコースの一覧を2タブに分けていた）。
  // 修了したコースを**バッジとして並べ**、そのカードから修了証をダウンロードできる。
  const totalHours = lrn.completed.reduce((s, c) => s + courseHours(c.duration), 0);
  return (
    <div>
      <SectionHead title="修了済み" desc={`${lrn.completed.length}本のコースを修了しました。修了証はこの画面からダウンロードできます。`} />
      {lrn.completed.length === 0
        ? <LearningEmptyAction title="修了済みのコースがありません" desc="最初のコースを修了すると、修了証と獲得スキルがここに並びます。" cta="学習を始める" icon={Award} onClick={() => goSub("el_courses")} themeColor={PRODUCT_ACCENT.learning.accent} />
        : (<>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {[
                { label: "修了コース", value: `${lrn.completed.length}本`, color: C.green },
                { label: "取得スキル", value: `${lrn.getEarnedSkills().length}件`, color: C.cyan },
                { label: "推定学習時間", value: `${totalHours}時間`, color: PRODUCT_ACCENT.talent.accent },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl p-4" style={{ background: C.canvas }}>
                  <div className="text-xs font-bold" style={{ color: C.muted }}>{label}</div>
                  <div className="mt-1 text-2xl font-bold" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lrn.completed.map(course => {
                const result = lrn.getOfficialFinalTestResult(course.id);
                const issuedAt = result?.createdAt?.slice(0, 10) || lrn.progress[course.id]?.completedAt?.slice(0, 10) || "";
                return (
                  <Card key={course.id} className="flex flex-col overflow-hidden p-0">
                    {/* 修了バッジ。コースの色で塗り分けるので、並ぶと実績の一覧に見える。 */}
                    <div className="flex items-center gap-3 p-4" style={{ background: `linear-gradient(140deg, ${course.color}1F, ${course.color}0A)` }}>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white" style={{ background: course.color }}>
                        <Award size={22} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold leading-snug" style={{ color: C.ink }}>{course.title}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone="green">修了</Badge>
                          {result?.score != null && <Badge tone="cyan">{result.score}点</Badge>}
                          {course.official && <Badge tone="muted">Feeps公式</Badge>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-4 pt-3">
                      {issuedAt && <div className="text-xs" style={{ color: C.muted }}>修了日: {issuedAt}</div>}
                      {course.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {course.skills.map(s => (
                            <span key={s} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: C.greenW, color: C.green }}>
                              <Check size={9} />{s}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-auto flex flex-wrap gap-2">
                        <Btn size="sm" icon={Download} onClick={() => downloadCertificate(course, result)}>修了証</Btn>
                        <Btn kind="ghost" size="sm" icon={BookOpen} onClick={() => onOpenDetail && onOpenDetail(course)}>コースを開く</Btn>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="mt-4 flex justify-center">
              <Btn kind="soft" icon={Sparkles} onClick={() => goSub("el_skills")}>獲得スキルを見る</Btn>
            </div>
          </>)}
    </div>
  );
}
function ElRecommendView({ lrn, goSub, onStart, onComplete, onOpenDetail, themeColor }) {
  const continueCourses = lrn.inprogress;
  const nextCourses = lrn.notStarted;
  const reviewCourses = lrn.catalog.filter(course => {
    const status = lrn.getCourseState(course.id).status;
    return ["completed", "lessons_completed", "review_recommended", "final_test_failed"].includes(status);
  });
  const hasAny = continueCourses.length || nextCourses.length || reviewCourses.length;
  const Section = ({ title, desc, children }) => (
    <section className="mb-6">
      <div className="mb-3">
        <h3 className="text-base font-bold" style={{ color: C.ink }}>{title}</h3>
        <p className="mt-0.5 text-xs" style={{ color: C.muted }}>{desc}</p>
      </div>
      {children}
    </section>
  );
  return (
    <div>
      <SectionHead title="おすすめコース" desc="学習中・未受講・復習を分けて表示します。" />
      <div className="mb-5 flex items-start gap-3 rounded-2xl p-4" style={{ background: `${themeColor}0D`, border: `1px solid ${themeColor}20` }}>
        <Lightbulb size={16} style={{ color: themeColor, marginTop: 1 }} />
        <p className="text-sm" style={{ color: C.body }}>
          <span className="font-semibold" style={{ color: C.ink }}>次にやることを選びやすくしました。</span>
          {" "}学習中コースは「学習を続ける」、未受講コースは「次におすすめ」、修了済みや復習対象は「復習する」に分けています。
        </p>
      </div>
      {!hasAny
        ? <LearningEmptyAction title="全コースを修了しました！" desc="次の成長テーマを整理して、スキル・成長画面で強みを確認しましょう。" cta="取得スキルを見る" icon={Sparkles} onClick={() => goSub("el_skills")} themeColor={themeColor} />
        : (
          <>
            <Section title="学習を続ける" desc="現在学習中のコースです。">
              {continueCourses.length === 0 ? <Card className="p-4 text-sm" style={{ color: C.muted }}>学習中のコースはありません。</Card> : <div className="grid gap-4 sm:grid-cols-2">{continueCourses.map(c => (
                <ElCourseCard key={c.id} course={c} prog={lrn.progress[c.id]} courseState={lrn.getCourseState(c.id)} onStart={onStart} onComplete={onComplete} onOpenDetail={onOpenDetail} />
              ))}</div>}
            </Section>
            <Section title="次におすすめ" desc="未受講コースだけを表示します。">
              {nextCourses.length === 0 ? <Card className="p-4 text-sm" style={{ color: C.muted }}>未受講のおすすめコースはありません。</Card> : <div className="grid gap-4 sm:grid-cols-2">{nextCourses.map(c => (
                <div key={c.id} className="space-y-2">
                  <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: `${themeColor}0D`, color: themeColor }}>おすすめ理由: {recommendationReason(c)}</div>
                  <ElCourseCard course={c} prog={lrn.progress[c.id]} courseState={lrn.getCourseState(c.id)} onStart={onStart} onComplete={onComplete} onOpenDetail={onOpenDetail} />
                </div>
              ))}</div>}
            </Section>
            <Section title="復習する" desc="修了済み・総合テスト待ち・復習推奨のコースです。">
              {reviewCourses.length === 0 ? <Card className="p-4 text-sm" style={{ color: C.muted }}>復習対象のコースはありません。</Card> : <div className="grid gap-4 sm:grid-cols-2">{reviewCourses.map(c => (
                <ElCourseCard key={c.id} course={c} prog={lrn.progress[c.id]} courseState={lrn.getCourseState(c.id)} onStart={onStart} onComplete={onComplete} onOpenDetail={onOpenDetail} />
              ))}</div>}
            </Section>
          </>
        )}
    </div>
  );
}
function ElSkillsView({ lrn, goProduct, themeColor }) {
  const earnedSkills = lrn.getEarnedSkills();
  const byCategory = lrn.completed.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = { color: c.color, skills: [] };
    c.skills.forEach(s => { if (!acc[c.category].skills.includes(s)) acc[c.category].skills.push(s); });
    return acc;
  }, {});
  return (
    <div>
      <SectionHead title="獲得スキル" desc={`Eラーニングで取得したスキルは${earnedSkills.length}件です。`} />
      {earnedSkills.length === 0
        ? <Card><EmptyState title="まだスキルを取得していません" desc="コースを修了するとスキルが獲得されます。" /></Card>
        : (<>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {[
                { label: "取得スキル数",   value: `${earnedSkills.length}件`,                   color: C.green },
                { label: "修了コース数",   value: `${lrn.completed.length}本`,                  color: C.cyanDeep },
                { label: "カバー分野",     value: `${Object.keys(byCategory).length}分野`,       color: C.ink },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl p-4" style={{ background: C.canvas }}>
                  <div className="text-xs font-bold" style={{ color: C.muted }}>{label}</div>
                  <div className="mt-1 text-2xl font-bold" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="space-y-4 mb-5">
              {Object.entries(byCategory).map(([cat, { color, skills }]) => (
                <Card key={cat} className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ background: color }} />
                    <span className="text-sm font-bold" style={{ color: C.ink }}>{cat}</span>
                    <Badge tone="muted">{skills.length}件</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map(s => (
                      <span key={s} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `${color}14`, color }}>
                        <Check size={11} />{s}
                      </span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={{ background: "#7C3AED0D", border: "1px solid #7C3AED20" }}>
              <div>
                <div className="text-sm font-bold" style={{ color: PRODUCT_ACCENT.talent.accent }}>スキル・成長と案件用スキルシートに活かしましょう</div>
                <div className="mt-0.5 text-xs" style={{ color: C.muted }}>取得スキルは成長履歴・スキルシートに自動反映されています。</div>
              </div>
              <Btn style={{ background: PRODUCT_ACCENT.talent.accent, color: "#fff" }} onClick={() => goProduct && goProduct("talent")}>スキル・成長を見る</Btn>
            </div>
          </>)}
    </div>
  );
}
// 演習(terminal/selection_task/ordering_puzzle/fill_blank/interactive_form/descriptive)の不正解・
// AI採点低評価から集計したweakItems(GET /learning/progress/me レスポンス拡張、useLearning.jsの
// getCourseWeakItems/getAllWeakItemsが返す)をレッスン単位でまとめて表示する。総合テストのweakLessons
// (FinalTestLatestResultCard)とは別集計軸(演習単位)のため独立したカードにする。2026-07-21追加。
function WeakExercisesCard({ items, lessons, onOpenLesson }) {
  if (!items || !items.length) return null;
  const byLesson = new Map();
  items.forEach(item => {
    if (!item.lessonId) return;
    const list = byLesson.get(item.lessonId) || [];
    list.push(item);
    byLesson.set(item.lessonId, list);
  });
  const groups = [...byLesson.entries()].filter(([lessonId]) => lessons.some(ls => ls.id === lessonId));
  if (!groups.length) return null;
  return (
    <Card className="mb-5 p-5" style={{ background: C.amberW, border: `1px solid ${C.amber}30` }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} style={{ color: C.amber }} />
          <h3 className="text-base font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>復習が必要な演習</h3>
        </div>
        <Badge tone="amber">{groups.length} Lessons</Badge>
      </div>
      <p className="mb-3 text-xs" style={{ color: C.muted }}>確認問題・演習で不正解、またはAI採点が基準未満だった単元です。再挑戦すると自動的にこの一覧から外れます。</p>
      <div className="space-y-2">
        {groups.map(([lessonId, group]) => {
          const lesson = lessons.find(ls => ls.id === lessonId);
          const label = [...new Set(group.map(g => g.slideTitle).filter(Boolean))].join("・") || `${group.length}件の演習`;
          return (
            <div key={lessonId} className="flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between" style={{ border: `1px solid ${C.line}` }}>
              <div className="min-w-0">
                <div className="text-sm font-bold" style={{ color: C.ink }}>{lesson.title}</div>
                <div className="mt-1 truncate text-xs" style={{ color: C.muted }}>{label}</div>
              </div>
              {/* 2026-07-21 監査P1(T-4)対応: 対象スライド(先頭の演習)へ直接ジャンプする。従来は
                  lesson先頭(1ページ目)にしか飛べず、目的のスライドまで手動で辿る必要があった */}
              <Btn size="sm" kind="ghost" icon={PlayCircle} onClick={() => onOpenLesson(lesson, group[0]?.slideId)}>復習する</Btn>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ReviewLessonList({ title, desc, lessons, items, onOpenLesson, onReviewed }) {
  if (!items.length) return null;
  return (
    <Card className="p-5" style={{ background: "rgba(20,163,184,.06)", border: "1px solid rgba(20,163,184,.18)" }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{title}</h3>
          {desc && <p className="mt-1 text-xs" style={{ color: C.muted }}>{desc}</p>}
        </div>
        <Badge tone="amber">{items.length} Lessons</Badge>
      </div>
      <div className="space-y-2">
        {items.map(item => {
          const lesson = lessons.find(ls => ls.id === item.lessonId);
          if (!lesson) return null;
          return (
            <div key={item.lessonId} className="flex flex-col gap-3 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between" style={{ border: `1px solid ${C.line}` }}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: C.ink }}>{lesson.title}</span>
                  <Badge tone={reviewStatusTone(item)}>{reviewStatusLabel(item)}</Badge>
                  {item.reviewed && <Badge tone="green">復習済み</Badge>}
                </div>
                <div className="mt-1 text-xs" style={{ color: C.muted }}>
                  {item.pageId && item.pageId !== "lesson" ? `対象: ${item.pageId}` : "Lesson全体"}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Btn size="sm" kind="ghost" icon={PlayCircle} onClick={() => onOpenLesson(lesson)}>レッスンへ戻る</Btn>
                {!item.reviewed && <Btn size="sm" kind="soft" icon={CheckCircle2} onClick={() => onReviewed(lesson.id)}>復習済みにする</Btn>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function LessonReviewCheck({ course, lesson, lrn }) {
  const review = lrn.getLessonReview(course.id, lesson.id);
  const options = [
    { status: "understood", label: "理解できた", desc: "このLessonは問題なく進められます。", icon: CheckCircle2, tone: "green" },
    { status: "uncertain", label: "少し不安", desc: "総合テスト前に見直しましょう。", icon: AlertCircle, tone: "amber" },
    { status: "review_later", label: "後で復習したい", desc: "復習リストに追加されます。", icon: RefreshCw, tone: "red" },
  ];
  function selectStatus(status) {
    lrn.setLessonReview(course.id, lesson.id, { status, reviewed: false });
  }
  return (
    <Card className="mb-5 p-5" style={{ background: "rgba(20,163,184,.06)", border: "1px solid rgba(20,163,184,.18)" }}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} style={{ color: C.green }} />
            <h3 className="text-base font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>理解度チェック</h3>
          </div>
          <p className="mt-1 text-xs" style={{ color: C.muted }}>今の理解度を1クリックで記録できます。</p>
        </div>
        {review && (
          <div className="flex flex-wrap gap-2">
            <Badge tone={reviewStatusTone(review)}>{reviewStatusLabel(review)}</Badge>
            {review.reviewed && <Badge tone="green">復習済み</Badge>}
          </div>
        )}
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {options.map(({ status, label, desc, icon: Icon, tone }) => {
          const active = review?.status === status;
          const color = tone === "green" ? C.green : tone === "amber" ? C.amber : C.red;
          return (
            <button key={status} onClick={() => selectStatus(status)}
              className="rounded-xl p-3 text-left transition hover:shadow-sm"
              style={{ background: active ? `${color}12` : "#fff", border: `1.5px solid ${active ? color + "55" : C.line2}` }}>
              <div className="flex items-center gap-2">
                <Icon size={16} style={{ color }} />
                <span className="text-sm font-bold" style={{ color: active ? color : C.ink }}>{label}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>{desc}</p>
            </button>
          );
        })}
      </div>
      {review && !review.reviewed && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3" style={{ border: `1px solid ${C.line}` }}>
          <span className="text-xs" style={{ color: C.muted }}>見直しが終わったら復習済みにできます。</span>
          <Btn size="sm" kind="soft" icon={CheckCircle2} onClick={() => lrn.markLessonReviewed(course.id, lesson.id)}>復習済みにする</Btn>
        </div>
      )}
    </Card>
  );
}

function FinalTestLatestResultCard({ result, lessons, onOpenLesson }) {
  if (!result) return null;
  return (
    <Card className="mb-5 p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} style={{ color: result.passed ? C.green : C.amber }} />
            <h3 className="text-base font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>前回の総合テスト結果</h3>
          </div>
          <p className="mt-1 text-xs" style={{ color: C.muted }}>最終受験日: {result.createdAt?.slice(0, 10)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={result.passed ? "green" : "amber"}>{result.passed ? "合格" : "不合格"}</Badge>
          <span className="text-2xl font-bold" style={{ color: result.passed ? C.green : C.amber }}>{result.score}点</span>
        </div>
      </div>
      {result.weakLessons?.length > 0 && (
        <div className="space-y-2">
          {result.weakLessons.slice(0, 3).map(item => {
            const lesson = lessons.find(ls => ls.id === item.lessonId);
            return (
              <div key={item.lessonId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl p-3" style={{ background: C.canvas }}>
                <div className="flex items-center gap-2">
                  <Badge tone="amber">復習推奨</Badge>
                  <span className="text-sm font-semibold" style={{ color: C.ink }}>{item.lessonTitle}</span>
                  <span className="text-xs" style={{ color: C.muted }}>{item.rate}%</span>
                </div>
                {lesson && <Btn size="sm" kind="ghost" icon={PlayCircle} onClick={() => onOpenLesson(lesson)}>復習する</Btn>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// コース詳細の大きな枠で使う小物（2026-08-21リデザイン）。
function HeroTag({ children, tone = "plain" }) {
  const style = tone === "on"
    ? { background: "rgba(255,255,255,.94)", color: "#1A1C1F", border: "1px solid transparent" }
    : tone === "off"
      ? { background: "transparent", color: "rgba(255,255,255,.78)", border: "1px dashed rgba(255,255,255,.45)" }
      : { background: "rgba(255,255,255,.17)", color: "#fff", border: "1px solid rgba(255,255,255,.26)" };
  return <span className="rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={style}>{children}</span>;
}

function HeroFact({ label, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
      style={{ background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.22)", color: "rgba(255,255,255,.85)" }}>
      {label}<b className="font-bold text-white">{children}</b>
    </span>
  );
}

// 色を暗くする。ヘッダーのグラデーションと、白パネル上の文字・ボタンに使う。
// コースの色(course.color)は明るめなので、そのままだと白背景に載せたとき読めない。
function darkenHex(hex, ratio = 0.42) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return "#176B67";
  const n = parseInt(m[1], 16);
  const mix = v => Math.max(0, Math.round(v * (1 - ratio)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix).map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

// 演習として数えるスライド種別。正典は ElSlideLessonView.jsx の EXERCISE_KINDS。
// 4択の確認クイズ(quiz)も受講者から見れば「演習」なのでここでは数える。
const COURSE_EXERCISE_KINDS = new Set(["quiz", "terminal", "selection_task", "ordering_puzzle", "fill_blank", "interactive_form"]);
function countLessonExercises(lesson) {
  return (Array.isArray(lesson?.slides) ? lesson.slides : []).filter(s => COURSE_EXERCISE_KINDS.has(s?.kind)).length;
}
function lessonMetaLabel(lesson) {
  const slides = Array.isArray(lesson?.slides) ? lesson.slides.length : 0;
  const ex = countLessonExercises(lesson);
  const parts = [];
  if (slides) parts.push(`${slides}ページ`);
  else if (lesson?.duration) parts.push(lesson.duration);
  if (ex) parts.push(`演習${ex}問`);
  if (!parts.length && lesson?.summary) return lesson.summary;
  return parts.join(" ・ ");
}

function ElCourseDetail({ course, lrn, onBack, onOpenLesson, onStartFinalTest, onShowFinalResult, themeColor = PRODUCT_ACCENT.learning.accent }) {
  const prog = lrn.progress[course.id];
  const lessonsDone = lrn.getLessonsDone(course.id);
  const lessons = lrn.lessonsForCourse ? lrn.lessonsForCourse(course.id) : [];
  const doneCnt = lessons.filter(l => lessonsDone[l.id]?.completed).length;
  const courseState = lrn.getCourseState(course.id);
  const pct = courseState.progress ?? (lessons.length ? Math.round((doneCnt / lessons.length) * 100) : (prog?.progress || 0));
  const isCompleted = courseState.status === "completed";
  const isInprogress = courseState.status === "inprogress";
  const isFinalWaiting = ["lessons_completed", "review_recommended", "final_test_failed"].includes(courseState.status);
  // 2026-08-21: 総合テストを行わないコースでは、テストの導線もカードも出さない。
  // 出しっぱなしにすると「開始できませんでした」で詰まる（実バグ）。
  const finalTestEnabled = course.finalTestEnabled !== false;
  const nextLesson = lessons.find(l => !lessonsDone[l.id]?.completed);
  const reviewItems = lrn.getCourseReviewItems(course.id);
  const latestFinalResult = lrn.getLatestFinalTestResult(course.id);
  const TYPE_LABEL = { video: "動画", text: "テキスト", quiz: "テスト" };
  const TYPE_TONE  = { video: "cyan",  text: "muted",   quiz: "amber" };
  function openLesson(ls, slideId) { lrn.startCourse(course.id); lrn.touchLesson(course.id, ls.id); onOpenLesson(ls, slideId); }
  function handleStartCourse() { lrn.startCourse(course.id); onOpenLesson(nextLesson || lessons[0]); }
  function handleReviewed(lessonId) { lrn.markLessonReviewed(course.id, lessonId); }

  const courseDeep = darkenHex(course.color);
  const exerciseCount = lessons.reduce((sum, ls) => sum + countLessonExercises(ls), 0);

  // 総合テストの有無は course.finalTestEnabled だけでは決まらない。
  // **問題が0問なら受験できない**（実際にIT基礎がその状態だった）ので、Backendへ問い合わせる。
  const [finalSummary, setFinalSummary] = useState(null);
  useEffect(() => {
    if (!finalTestEnabled) { setFinalSummary({ enabled: false, available: false, questionCount: 0, passLine: 70 }); return undefined; }
    let alive = true;
    setFinalSummary(null);
    lrn.fetchFinalTestSummary(course.id)
      .then(res => { if (alive) setFinalSummary(res); })
      // 取れないときはバッジを出さない（「あり」とも「なし」とも言わない）。
      .catch(() => { if (alive) setFinalSummary(null); });
    return () => { alive = false; };
  }, [course.id, finalTestEnabled]);

  // 残りの目安。学習時間はコース全体の値しか無いので、レッスン数で按分した概算にとどめる。
  const remainingCount = Math.max(0, lessons.length - doneCnt);
  const totalMinutes = Math.round((Number(String(course.duration).replace(/[^0-9.]/g, "")) || 0) * 60);
  const remainingMinutes = lessons.length && totalMinutes ? Math.round((totalMinutes / lessons.length) * remainingCount) : 0;
  const remainingLabel = isCompleted
    ? "すべて完了しました"
    : remainingCount
      ? `残り${remainingCount}本${remainingMinutes ? ` ・ 約${remainingMinutes}分` : ""}`
      : "";

  // 進捗パネルのボタン。状態ごとに「次にやること」を1つだけ出す。
  const canTakeFinalTest = finalTestEnabled && finalSummary?.available && courseState.readyForFinalTest;
  let primaryAction = null;
  let secondaryAction = null;
  let primaryHint = "";
  if (lessons.length === 0) {
    primaryAction = null;
  } else if (isCompleted) {
    primaryAction = { label: "もう一度見る", onClick: () => openLesson(lessons[0]) };
  } else if (canTakeFinalTest) {
    primaryAction = { label: courseState.status === "final_test_failed" ? "総合テストに再挑戦" : "総合テストを受ける", onClick: onStartFinalTest };
    if (nextLesson) secondaryAction = { label: "レッスンを見直す", onClick: () => openLesson(nextLesson) };
    primaryHint = finalSummary ? `${finalSummary.questionCount}問 ・ ${finalSummary.passLine}点で合格` : "";
  } else if (nextLesson) {
    primaryAction = { label: prog?.status ? "続きから学習する" : "受講を開始する", onClick: handleStartCourse };
    primaryHint = `次は ${nextLesson.title}`;
  }
  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-70" style={{ color: C.muted }}>
        <ChevronLeft size={16} />コース一覧へ戻る
      </button>

      {/* 2026-08-21 リデザイン（承認モック: mock/course-detail）。
          受講前に要るもの（概要・コース情報・身につくスキル・進捗）を**ひとつの大きな枠**へ集約する。
          以前は同じ情報がヘッダー・進捗カード・右3カードに散っていて、縦に長く読む順序も定まらなかった。
          「このコースの進み方」(6ステップ)と「総合テスト出題計画」はこの画面から外した。 */}
      <div className="mb-5 overflow-hidden rounded-[20px]" style={{ background: `linear-gradient(140deg, ${courseDeep} 0%, ${course.color} 100%)` }}>
        <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[1fr_262px]">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              <HeroTag>{course.category}</HeroTag>
              <HeroTag>{course.level}</HeroTag>
              {course.official && <HeroTag>Feeps公式</HeroTag>}
              {/* 演習・総合テストの有無をバッジで示す。**無いことも隠さない**（受ける前に分かるように）。 */}
              <HeroTag tone={exerciseCount > 0 ? "on" : "off"}>{exerciseCount > 0 ? "演習あり" : "演習なし"}</HeroTag>
              {finalSummary && (
                <HeroTag tone={finalSummary.available ? "on" : "off"}>
                  {finalSummary.available ? "総合テストあり" : "総合テストなし"}
                </HeroTag>
              )}
              {isCompleted && <HeroTag tone="on">修了済み</HeroTag>}
            </div>

            <h2 className="mt-3.5 text-[28px] font-bold leading-[1.25] text-white" style={{ letterSpacing: "-0.035em" }}>{course.title}</h2>
            {course.desc && (
              <p className="mt-3 text-[13.5px] leading-[1.95]" style={{ color: "rgba(255,255,255,.86)", maxWidth: "56ch" }}>{course.desc}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-1.5">
              <HeroFact label="学習時間">{formatCourseHours(course.duration, "約")}</HeroFact>
              <HeroFact label="レッスン">{`${lessons.length || course.lessons}本`}</HeroFact>
              {exerciseCount > 0 && <HeroFact label="演習">{`${exerciseCount}問`}</HeroFact>}
              {finalSummary?.available && (
                <HeroFact label="総合テスト">{`${finalSummary.questionCount}問 / ${finalSummary.passLine}点で合格`}</HeroFact>
              )}
            </div>

            <div className="mt-5 border-t pt-4" style={{ borderColor: "rgba(255,255,255,.2)" }}>
              <div className="text-[11.5px] font-bold" style={{ color: "rgba(255,255,255,.72)", letterSpacing: "0.05em" }}>修了すると身につくスキル</div>
              {course.skills?.length ? (
                <>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {course.skills.map(skill => (
                      <span key={skill} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white"
                        style={{ background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.24)" }}>
                        <Sparkles size={11} />{skill}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2.5 text-[11.5px]" style={{ color: "rgba(255,255,255,.7)" }}>
                    修了すると「獲得スキル」と「修了証」に追加され、成長の記録にも残ります。
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: "rgba(255,255,255,.72)" }}>
                  このコースには取得スキルが設定されていません。修了すると「修了済み」と「修了証」には残りますが、獲得スキルには追加されません。
                </p>
              )}
            </div>
          </div>

          {/* 進捗はバーをやめて数字で見せる。残り何本かはレッスン単位の目盛りで示す。 */}
          <div className="self-start rounded-2xl p-5 text-center" style={{ background: "rgba(255,255,255,.97)", boxShadow: "0 12px 30px rgba(9,32,30,.22)" }}>
            <div className="text-[46px] font-bold leading-none tabular-nums" style={{ color: courseDeep, letterSpacing: "-0.045em" }}>{pct}%</div>
            <div className="mt-1.5 text-[13px] font-bold" style={{ color: C.ink }}>{doneCnt} / {lessons.length} レッスン完了</div>
            {remainingLabel && <div className="mt-0.5 text-[11.5px]" style={{ color: C.muted }}>{remainingLabel}</div>}
            {lessons.length > 0 && lessons.length <= 24 && (
              <div className="mt-3.5 flex flex-wrap justify-center gap-1">
                {lessons.map((ls, i) => (
                  <span key={ls.id || i} className="h-1.5 w-6 rounded-full"
                    style={{ background: lessonsDone[ls.id]?.completed ? course.color : C.line2 }} />
                ))}
              </div>
            )}
            <div className="mt-4 space-y-2">
              {primaryAction && (
                <button onClick={primaryAction.onClick}
                  className="w-full rounded-xl px-4 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90"
                  style={{ background: courseDeep }}>
                  {primaryAction.label}
                </button>
              )}
              {secondaryAction && (
                <button onClick={secondaryAction.onClick}
                  className="w-full rounded-xl px-4 py-2 text-xs font-bold transition hover:bg-black/[.04]"
                  style={{ border: `1px solid ${C.line2}`, color: C.body }}>
                  {secondaryAction.label}
                </button>
              )}
            </div>
            {primaryHint && <div className="mt-2 text-[11.5px]" style={{ color: C.muted }}>{primaryHint}</div>}
          </div>
        </div>
      </div>

      {/* 総合テストで伝えることがあるときだけ帯を出す（問題が未登録・不合格） */}
      {finalTestEnabled && finalSummary && !finalSummary.available && courseState.allLessonsDone && (
        <Card className="mb-5 p-4" style={{ background: C.amberW, borderColor: "#FCD34D" }}>
          <div className="flex items-start gap-3">
            <AlertCircle size={18} style={{ color: C.amber }} />
            <div>
              <div className="text-sm font-bold" style={{ color: C.ink }}>総合テストの問題がまだ登録されていません。</div>
              <p className="mt-1 text-xs" style={{ color: C.body }}>管理者が問題を登録すると受験できるようになります。</p>
            </div>
          </div>
        </Card>
      )}
      {finalTestEnabled && courseState.status === "final_test_failed" && (
        <Card className="mb-5 p-4" style={{ background: C.redW, borderColor: "#FCA5A5" }}>
          <div className="flex items-start gap-3">
            <AlertCircle size={18} style={{ color: C.red }} />
            <div>
              <div className="text-sm font-bold" style={{ color: C.ink }}>総合テストは不合格です。復習して再挑戦してください。</div>
              <p className="mt-1 text-xs" style={{ color: C.body }}>下の「復習した方がいいレッスン」から戻れます。</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-5 p-5">
        <h3 className="mb-4 font-bold" style={{ color: C.ink }}>レッスン一覧</h3>
        {lessons.length === 0
          ? <div className="py-4 text-center text-sm" style={{ color: C.muted }}>レッスンはまだ登録されていません。</div>
          : <div className="space-y-2">
              {lessons.map((ls, idx) => {
                const done = !!lessonsDone[ls.id]?.completed;
                const current = !done && nextLesson?.id === ls.id && !isCompleted;
                const review = lrn.getLessonReview(course.id, ls.id);
                const stateTone = done ? "green" : current ? "cyan" : "muted";
                const stateLabel = done ? "完了" : current ? "学習中" : "未受講";
                const meta = lessonMetaLabel(ls);
                return (
                  <button key={ls.id} onClick={() => openLesson(ls)}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-gray-50"
                    style={{ border: `1px solid ${done ? C.green + "30" : current ? C.cyan + "35" : C.line2}`, background: done ? `${C.green}07` : current ? `${C.cyan}08` : "#fff" }}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: done ? C.greenW : current ? C.wash : C.canvas, color: done ? C.green : current ? C.cyanDeep : C.muted }}>
                      {done ? <Check size={14} /> : current ? <PlayCircle size={14} /> : idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: done ? C.muted : C.ink }}>{ls.title}</span>
                        <Badge tone={stateTone}>{stateLabel}</Badge>
                        {review && <Badge tone={reviewStatusTone(review)}>{reviewStatusLabel(review)}</Badge>}
                        {review?.reviewed && <Badge tone="green">復習済み</Badge>}
                      </div>
                      {meta && <div className="mt-0.5 text-xs" style={{ color: C.muted }}>{meta}</div>}
                    </div>
                    {done ? <CheckCircle2 size={18} style={{ color: C.green }} /> : <ChevronRight size={16} style={{ color: C.faint }} />}
                  </button>
                );
              })}
            </div>}
      </Card>

      {/* ここから下は「やったあとに見るもの」。実績が無いときは各カードが自分で消える。 */}
      <div className="mb-5">
        <ReviewLessonList
          title="復習した方がいいレッスン"
          desc="「少し不安」「後で復習したい」を付けたレッスンです。まとめて見直せます。"
          lessons={lessons}
          items={reviewItems}
          onOpenLesson={openLesson}
          onReviewed={handleReviewed}
        />
      </div>
      <WeakExercisesCard items={lrn.getCourseWeakItems ? lrn.getCourseWeakItems(course.id) : []} lessons={lessons} onOpenLesson={openLesson} />
      {finalTestEnabled && <FinalTestLatestResultCard result={latestFinalResult} lessons={lessons} onOpenLesson={openLesson} />}
    </div>
  );
}

// レッスン本文(Markdown)。text/video 両方の Lesson タイプで共通に使う。
// フェーズ4(見た目・操作性)で可読性を強化: 従来はTailwindのpreflightで見出し/リスト/コードの
// 既定スタイルが打ち消され、AI生成教材のMarkdown(見出し・箇条書き・コードブロック等)が
// ただの同じ大きさの文字の塊に見えていた。.feeps-lesson-md(index.css)で構造だけ復元し、
// 色・トークンはこれまで通り呼び出し側のinline style(color: C.body)に委ねる。
function LessonBodyText({ body }) {
  if (!body) return null;
  return (
    <div className="feeps-lesson-md mb-5 text-[15px] leading-[1.85]" style={{ color: C.body }}>
      <ReactMarkdown>{body}</ReactMarkdown>
    </div>
  );
}

function ElVideoLesson({ lesson, completed, onComplete }) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const totalSecs = parseInt(lesson.duration) * 60;
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setElapsed(s => Math.min(s + 1, totalSecs)), 1000);
    return () => clearInterval(id);
  }, [playing, totalSecs]);
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl" style={{ background: "#0f172a" }}>
        <div className="flex h-52 items-center justify-center sm:h-64">
          {!playing
            ? <button onClick={() => setPlaying(true)} className="flex h-16 w-16 items-center justify-center rounded-full transition hover:scale-105"
                style={{ background: "rgba(255,255,255,.15)", border: "2px solid rgba(255,255,255,.4)" }}>
                <PlayCircle size={32} style={{ color: "#fff" }} />
              </button>
            : <div className="text-center text-white">
                <div className="text-4xl font-bold tabular-nums">{fmt(elapsed)}</div>
                <div className="mt-1 text-sm" style={{ color: "rgba(255,255,255,.6)" }}>再生中 ···</div>
              </div>}
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: "rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}>
          <button onClick={() => setPlaying(p => !p)} className="opacity-80 hover:opacity-100" style={{ color: "#fff" }}>
            {playing ? <Circle size={18} /> : <PlayCircle size={18} />}
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.2)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${totalSecs ? Math.round((elapsed / totalSecs) * 100) : 0}%`, background: "#fff" }} />
          </div>
          <span className="tabular-nums text-xs" style={{ color: "rgba(255,255,255,.7)" }}>{fmt(elapsed)} / {lesson.duration}</span>
        </div>
      </div>
      {lesson.body && (
        <Card className="p-5">
          <LessonBodyText body={lesson.body} />
        </Card>
      )}
      <Card className="p-5">
        <h3 className="mb-3 font-bold" style={{ color: C.ink }}>学習ポイント</h3>
        <ul className="space-y-2">
          {(lesson.points || []).map((p, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: C.body }}>
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: C.wash, color: C.cyanDeep }}>{i + 1}</span>
              {p}
            </li>
          ))}
        </ul>
      </Card>
      <div className="flex items-center justify-between rounded-2xl p-4" style={{ background: C.canvas }}>
        {completed
          ? <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.green }}><CheckCircle2 size={18} />視聴済み</div>
          : <p className="text-sm" style={{ color: C.muted }}>動画を視聴したら完了にしましょう。</p>}
        <Btn icon={completed ? CheckCircle2 : Check} kind={completed ? "soft" : "primary"} onClick={onComplete}>
          {completed ? "完了済み" : "視聴完了にする"}
        </Btn>
      </div>
    </div>
  );
}

function ElTextLesson({ lesson, completed, onComplete }) {
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <LessonBodyText body={lesson.body} />
        <div className="rounded-2xl p-4" style={{ background: C.wash, border: `1px solid ${C.washDeep}` }}>
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb size={14} style={{ color: C.cyanDeep }} />
            <span className="text-xs font-bold" style={{ color: C.cyanDeep }}>重要ポイント</span>
          </div>
          <ul className="space-y-2">
            {(lesson.points || []).map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: C.body }}>
                <ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: C.cyan }} />{p}
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <div className="flex items-center justify-between rounded-2xl p-4" style={{ background: C.canvas }}>
        {completed
          ? <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.green }}><CheckCircle2 size={18} />読了済み</div>
          : <p className="text-sm" style={{ color: C.muted }}>教材を読んだら完了にしましょう。</p>}
        <Btn icon={completed ? CheckCircle2 : Check} kind={completed ? "soft" : "primary"} onClick={onComplete}>
          {completed ? "完了済み" : "教材を読了にする"}
        </Btn>
      </div>
    </div>
  );
}

function ElQuizLesson({ lesson, completed, onComplete, onNext, onPrev, hasNext }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const questions = lesson.questions || [];
  const PASS = 70;
  const correct = questions.filter(q => answers[q.id] === q.answer).length;
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  const passed = score >= PASS;
  function submit() { if (Object.keys(answers).length < questions.length) return; setSubmitted(true); }
  function reset() { setAnswers({}); setSubmitted(false); }
  if (submitted) {
    return (
      <div className="space-y-5">
        <Card className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: passed ? C.greenW : C.amberW }}>
            {passed ? <Award size={36} style={{ color: C.green }} /> : <AlertCircle size={36} style={{ color: C.amber }} />}
          </div>
          <div className="text-3xl font-bold" style={{ color: passed ? C.green : C.amber }}>{score}点</div>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: passed ? C.greenW : C.amberW, color: passed ? C.green : C.amber }}>
            {passed ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}{passed ? "合格" : "復習しましょう"}
          </div>
          <div className="mt-1 text-sm font-semibold" style={{ color: C.ink }}>{passed ? "合格！よくできました 🎉" : "不合格：もう一度挑戦しましょう"}</div>
          <div className="mt-1 text-xs" style={{ color: C.muted }}>合格ライン {PASS}点 · {correct}/{questions.length} 問正解</div>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {!passed && <Btn kind="ghost" icon={RefreshCw} onClick={reset}>もう一度挑戦</Btn>}
            {!passed && onPrev && <Btn kind="soft" icon={ChevronLeft} onClick={onPrev}>前レッスンへ戻る</Btn>}
            {passed && !completed && <Btn icon={Check} onClick={onComplete}>テスト完了にする</Btn>}
            {passed && completed && hasNext && <Btn icon={ChevronRight} onClick={onNext}>次のレッスンへ</Btn>}
            {passed && completed && !hasNext && <Btn icon={Award} onClick={onComplete}>Lesson完了</Btn>}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-4 font-bold" style={{ color: C.ink }}>解答確認</h3>
          <div className="space-y-4">
            {questions.map((q, i) => {
              const ok = answers[q.id] === q.answer;
              return (
                <div key={q.id} className="rounded-xl p-4"
                  style={{ background: ok ? `${C.green}08` : `${C.amber}08`, border: `1px solid ${ok ? C.green + "30" : C.amber + "30"}` }}>
                  <div className="mb-2 flex items-start gap-2">
                    {ok ? <CheckCircle2 size={16} style={{ color: C.green, marginTop: 1 }} /> : <AlertCircle size={16} style={{ color: C.amber, marginTop: 1 }} />}
                    <span className="text-sm font-semibold" style={{ color: C.ink }}>Q{i + 1}. {q.q}</span>
                  </div>
                  <div className="ml-6 space-y-1 text-xs">
                    <div style={{ color: C.muted }}>あなたの答え: <span style={{ color: ok ? C.green : C.red }}>{q.options[answers[q.id]] ?? "—"}</span></div>
                    {!ok && <div style={{ color: C.green }}>正解: {q.options[q.answer]}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: C.wash }}>
        <span className="text-sm font-semibold" style={{ color: C.ink }}>確認テスト — {questions.length}問</span>
        <Badge tone="amber">合格ライン {PASS}点</Badge>
      </div>
      {questions.map((q, i) => (
        <Card key={q.id} className="p-5">
          <div className="mb-3 text-sm font-semibold" style={{ color: C.ink }}>Q{i + 1}. {q.q}</div>
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const sel = answers[q.id] === oi;
              return (
                <button key={oi} onClick={() => setAnswers({ ...answers, [q.id]: oi })}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition"
                  style={{ border: `1.5px solid ${sel ? C.cyan : C.line2}`, background: sel ? C.wash : "#fff", color: sel ? C.cyanDeep : C.body }}>
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: sel ? C.cyan : C.canvas, color: sel ? "#fff" : C.muted }}>
                    {["A", "B", "C", "D"][oi]}
                  </div>
                  {opt}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
      <div className="flex items-center justify-between rounded-2xl p-4" style={{ background: C.canvas }}>
        <span className="text-sm" style={{ color: C.muted }}>{Object.keys(answers).length}/{questions.length} 問回答済み</span>
        <Btn icon={Check} onClick={submit}>
          {Object.keys(answers).length < questions.length
            ? `あと${questions.length - Object.keys(answers).length}問残っています`
            : "提出する"}
        </Btn>
      </div>
    </div>
  );
}

function ElFinalTestView({ course, lrn, lessons, onBack, onOpenLesson, onModeChange, initialMode = "test" }) {
  const latestResult = lrn.getLatestFinalTestResult(course.id);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(initialMode === "result" ? latestResult : null);
  const [attemptState, setAttemptState] = useState(initialMode === "result" && latestResult ? "ready" : "loading");
  const [submitState, setSubmitState] = useState("idle");
  useEffect(() => {
    if (initialMode === "result" && latestResult) setResult(latestResult);
  }, [initialMode, latestResult?.id]);
  useEffect(() => {
    if (initialMode === "result") return undefined;
    let alive = true;
    setAttemptState("loading");
    lrn.createFinalTestAttempt(course.id)
      .then(nextAttempt => {
        if (!alive) return;
        setAttempt(nextAttempt);
        setQuestions(nextAttempt.questions);
        setAnswers({});
        setIndex(0);
        setAttemptState("ready");
      })
      .catch(() => { if (alive) setAttemptState("error"); });
    return () => { alive = false; };
    // course切替時にだけ新しいserver attemptを発行する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, initialMode]);
  const current = questions[index];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = questions.length > 0 && answeredCount >= questions.length;
  function selectAnswer(questionId, value) { setAnswers({ ...answers, [questionId]: value }); }
  async function submit() {
    if (!allAnswered || submitState === "saving") return;
    setSubmitState("saving");
    try {
      const savedResult = await lrn.gradeFinalTest(attempt.attemptId, questions, answers);
      setResult(savedResult);
      setSubmitState("idle");
      onModeChange?.("result");
    } catch {
      setSubmitState("error");
    }
  }
  async function retake() {
    setAttemptState("loading");
    setAnswers({});
    setIndex(0);
    setResult(null);
    setSubmitState("idle");
    onModeChange?.("test");
    if (initialMode === "result") return;
    try {
      const nextAttempt = await lrn.createFinalTestAttempt(course.id);
      setAttempt(nextAttempt);
      setQuestions(nextAttempt.questions);
      setAttemptState("ready");
    } catch {
      setAttemptState("error");
    }
  }
  function reviewLesson(lessonId) {
    const lesson = lessons.find(ls => ls.id === lessonId);
    if (lesson) onOpenLesson(lesson);
  }
  if (result) {
    return (
      <div>
        <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-70" style={{ color: C.muted }}>
          <ChevronLeft size={16} />コース詳細へ戻る
        </button>
        <LearningExperienceFlow activeKey="final" compact className="mb-5" />
        <Card className="mb-5 p-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full" style={{ background: result.passed ? C.greenW : C.amberW }}>
            {result.passed ? <Award size={36} style={{ color: C.green }} /> : <AlertCircle size={36} style={{ color: C.amber }} />}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge tone={result.passed ? "green" : "amber"}>{result.passed ? "合格" : "不合格"}</Badge>
            <Badge tone="cyan">サーバー採点済み</Badge>
          </div>
          <div className="mt-3 text-4xl font-bold" style={{ color: result.passed ? C.green : C.amber }}>{result.score}点</div>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>
            正答率 {result.score}% · {result.correctCount}/{result.questionCount}問正解 · 不正解 {result.incorrectCount}問
          </p>
          <p className="mt-2 text-sm font-semibold" style={{ color: result.passed ? C.green : C.amber }}>
            {result.passed ? "総合テスト合格。コース修了です。" : "総合テストは不合格です。復習して再挑戦してください。"}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Btn icon={RefreshCw} onClick={retake}>もう一度受ける</Btn>
            <Btn kind="ghost" icon={ChevronLeft} onClick={onBack}>コース詳細へ戻る</Btn>
          </div>
        </Card>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-4 font-bold" style={{ color: C.ink }}>Lesson別理解度</h3>
            <div className="space-y-3">
              {result.lessonBreakdown.map(item => (
                <div key={item.lessonId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold" style={{ color: C.ink }}>{item.lessonTitle}</span>
                    <span style={{ color: item.rate >= 70 ? C.green : C.amber }}>{item.correct}/{item.total}問 · {item.rate}%</span>
                  </div>
                  <Bar value={item.rate} tone={item.rate >= 70 ? "green" : "amber"} />
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 font-bold" style={{ color: C.ink }}>苦手Lesson・復習導線</h3>
            {result.weakLessons.length === 0 ? (
              <div className="rounded-xl p-4 text-sm" style={{ background: C.greenW, color: C.green }}>苦手Lessonはありません。よくできています。</div>
            ) : (
              <div className="space-y-2">
                {result.weakLessons.map(item => (
                  <div key={item.lessonId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl p-3" style={{ border: `1px solid ${C.line}` }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone="amber">復習推奨</Badge>
                        <span className="text-sm font-bold" style={{ color: C.ink }}>{item.lessonTitle}</span>
                      </div>
                      <p className="mt-1 text-xs" style={{ color: C.muted }}>{item.reason} · 正答率 {item.rate}%</p>
                    </div>
                    <Btn size="sm" kind="ghost" icon={PlayCircle} onClick={() => reviewLesson(item.lessonId)}>復習する</Btn>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        <Card className="mt-5 p-5">
          <h3 className="mb-4 font-bold" style={{ color: C.ink }}>解説</h3>
          <div className="space-y-3">
            {result.answers.map((a, i) => (
              <div key={a.questionId} className="rounded-xl p-4" style={{ background: a.correct ? `${C.green}08` : `${C.amber}08`, border: `1px solid ${a.correct ? C.green + "30" : C.amber + "30"}` }}>
                <div className="mb-2 flex items-start gap-2">
                  {a.correct ? <CheckCircle2 size={16} style={{ color: C.green, marginTop: 1 }} /> : <AlertCircle size={16} style={{ color: C.amber, marginTop: 1 }} />}
                  <span className="text-sm font-semibold" style={{ color: C.ink }}>Q{i + 1}. {a.question}</span>
                </div>
                <div className="ml-6 space-y-1 text-xs">
                  <div style={{ color: C.muted }}>あなたの答え: <span style={{ color: a.correct ? C.green : C.red }}>{a.choices[a.selected] ?? "未回答"}</span></div>
                  {!a.correct && <div style={{ color: C.green }}>正解: {a.choices[a.correctAnswer]}</div>}
                  <div style={{ color: C.body }}>解説: {a.explanation}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }
  if (attemptState === "loading") {
    return (
      <div>
        <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-70" style={{ color: C.muted }}>
          <ChevronLeft size={16} />コース詳細へ戻る
        </button>
        <Card className="p-8 text-center">
          <RefreshCw size={28} className="mx-auto mb-3 animate-spin" style={{ color: course.color }} />
          <p className="font-bold" style={{ color: C.ink }}>総合テストを準備しています</p>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>公開済みの問題から今回の受験問題を作成しています。</p>
        </Card>
      </div>
    );
  }
  if (attemptState === "error" || !attempt) {
    return (
      <div>
        <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-70" style={{ color: C.muted }}>
          <ChevronLeft size={16} />コース詳細へ戻る
        </button>
        <Card className="p-8 text-center">
          <AlertCircle size={32} className="mx-auto mb-3" style={{ color: C.amber }} />
          <p className="font-bold" style={{ color: C.ink }}>総合テストを開始できませんでした</p>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>公開問題が設定されているか確認し、時間をおいて再度お試しください。</p>
          <div className="mt-4"><Btn icon={RefreshCw} onClick={retake}>もう一度準備する</Btn></div>
        </Card>
      </div>
    );
  }
  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-70" style={{ color: C.muted }}>
        <ChevronLeft size={16} />中断して戻る
      </button>
      <LearningExperienceFlow activeKey="final" compact className="mb-5" />
      <div className="mb-5 rounded-2xl p-5" style={{ background: `${course.color}0D`, border: `1px solid ${course.color}25` }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge tone="green">総合テスト</Badge>
            <h2 className="mt-2 text-xl font-bold" style={{ color: C.ink }}>{course.title}</h2>
            <p className="mt-1 text-sm" style={{ color: C.muted }}>
              出題数 {questions.length}問 · 合格基準 {attempt.passLine}点 · サーバー採点
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: course.color }}>{index + 1}/{questions.length}</div>
            <div className="text-xs" style={{ color: C.muted }}>回答済み {answeredCount}/{questions.length}</div>
          </div>
        </div>
        <div className="mt-4"><Bar value={questions.length ? Math.round(((index + 1) / questions.length) * 100) : 0} tone="green" /></div>
        {questions.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="設問一覧">
            {questions.map((q, qi) => {
              const isCurrent = qi === index;
              const isAnswered = answers[q.id] !== undefined;
              return (
                <button key={q.id} type="button" onClick={() => setIndex(qi)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`設問${qi + 1}${isAnswered ? "（回答済み）" : "（未回答）"}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition"
                  style={{
                    border: `1.5px solid ${isCurrent ? course.color : isAnswered ? `${course.color}60` : C.line2}`,
                    background: isCurrent ? course.color : isAnswered ? `${course.color}15` : "#fff",
                    color: isCurrent ? "#fff" : isAnswered ? course.color : C.muted,
                  }}>
                  {qi + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {current && (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="cyan">総合問題</Badge>
            <span className="text-xs" style={{ color: C.muted }}>{current.lessonTitle}</span>
          </div>
          <h3 className="mb-4 text-base font-bold" style={{ color: C.ink }}>Q{index + 1}. {current.question}</h3>
          <div className="space-y-2">
            {current.choices.map((choice, choiceIndex) => {
              const selected = answers[current.id] === choiceIndex;
              return (
                <button key={choiceIndex} onClick={() => selectAnswer(current.id, choiceIndex)}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition"
                  style={{ border: `1.5px solid ${selected ? course.color : C.line2}`, background: selected ? `${course.color}10` : "#fff", color: selected ? course.color : C.body }}>
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: selected ? course.color : C.canvas, color: selected ? "#fff" : C.muted }}>
                    {["A", "B", "C", "D"][choiceIndex]}
                  </div>
                  {choice}
                </button>
              );
            })}
          </div>
        </Card>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Btn kind="ghost" icon={ChevronLeft} disabled={index === 0} onClick={() => setIndex(Math.max(0, index - 1))}>前へ</Btn>
        <div className="flex flex-wrap gap-2">
          {index < questions.length - 1
            ? <Btn icon={ChevronRight} onClick={() => setIndex(Math.min(questions.length - 1, index + 1))}>次へ</Btn>
            : <Btn icon={Check} disabled={!allAnswered || submitState === "saving"} onClick={submit}>{submitState === "saving" ? "結果を保存しています…" : allAnswered ? "採点する" : `未回答 ${questions.length - answeredCount}問`}</Btn>}
        </div>
      </div>
      {submitState === "error" && <div className="mt-3 rounded-xl px-4 py-3 text-sm font-semibold" role="alert" style={{ background: C.redW, color: C.red }}>結果を保存できませんでした。回答は残っています。通信状態を確認して、もう一度提出してください。</div>}
    </div>
  );
}

// S3教材(s3keyあり)のうち、ページ内プレビュー対象にする種別だけ判定する。
// それ以外(PPTX/DOCX等)・外部URL教材はダウンロード/従来通りの「開く」導線のまま。
function materialPreviewKind(material) {
  const contentType = String(material.contentType || "").toLowerCase();
  const type = String(material.type || "").toLowerCase();
  if (contentType === "application/pdf" || type === "pdf") return "pdf";
  if (contentType.startsWith("image/")) return "image";
  if (contentType === "video/mp4" || type === "video") return "video";
  return "other";
}

function LessonMaterialsCard({ materials, onOpenMaterial }) {
  const TYPE_LABEL = { video: "動画", pdf: "PDF", slide: "スライド", text: "テキスト", link: "リンク", file: "ファイル" };
  const [previewUrls, setPreviewUrls] = useState({});
  const [previewErrors, setPreviewErrors] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadErrorId, setDownloadErrorId] = useState(null);

  // 依存配列は materials 配列そのもの(毎レンダー新規生成される)ではなく、内容から作った
  // 安定な文字列にする。加えて「取得済み/失敗済みならスキップ」するガードも入れることで、
  // 親の再レンダーだけで再取得や無限ループが起きないようにする。
  const previewKey = (materials || [])
    .filter(material => material.s3key && materialPreviewKind(material) !== "other")
    .map(material => material.id || material.materialId)
    .join("|");

  useEffect(() => {
    if (!previewKey) return;
    let alive = true;
    (materials || []).forEach(material => {
      const id = material.id || material.materialId;
      if (!material.s3key || materialPreviewKind(material) === "other") return;
      if (previewUrls[id] || previewErrors[id]) return;
      onOpenMaterial(id)
        .then(res => {
          if (!alive) return;
          if (res?.url) setPreviewUrls(prev => ({ ...prev, [id]: res.url }));
          else setPreviewErrors(prev => ({ ...prev, [id]: true }));
        })
        .catch(() => {
          if (alive) setPreviewErrors(prev => ({ ...prev, [id]: true }));
        });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  if (!materials?.length) return null;

  function handleDownload(material) {
    const id = material.id || material.materialId;
    setDownloadErrorId(null);
    if (material.s3key) {
      // ポップアップブロック対策: クリック直後(同期)に空タブを開いてから、非同期で
      // 署名付きURLを取得してそのタブへ遷移させる。
      const win = window.open("", "_blank", "noopener,noreferrer");
      setDownloadingId(id);
      onOpenMaterial(id)
        .then(res => {
          if (res?.url) {
            if (win) win.location.href = res.url;
          } else {
            if (win) win.close();
            setDownloadErrorId(id);
          }
        })
        .catch(() => {
          if (win) win.close();
          setDownloadErrorId(id);
        })
        .finally(() => setDownloadingId(null));
    } else if (material.url) {
      window.open(material.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <Card className="mb-5 p-5">
      <div className="mb-3 flex items-center gap-2">
        <FileText size={16} style={{ color: C.green }} />
        <h3 className="text-base font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>関連教材</h3>
      </div>
      <div className="space-y-3">
        {materials.map(material => {
          const id = material.id || material.materialId;
          const kind = materialPreviewKind(material);
          const previewable = Boolean(material.s3key) && kind !== "other";
          const downloadable = !previewable && Boolean(material.s3key || material.url);
          const url = previewUrls[id];
          return (
            <div key={id} className="rounded-xl p-3" style={{ background: C.canvas, border: `1px solid ${C.line}` }}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="green">{TYPE_LABEL[material.type] || material.type}</Badge>
                    <span className="text-sm font-bold" style={{ color: C.ink }}>{material.title}</span>
                  </div>
                  {material.description && <p className="mt-1 text-xs" style={{ color: C.muted }}>{material.description}</p>}
                  {previewable && previewErrors[id] && <p className="mt-1 text-xs" style={{ color: C.red }}>プレビューを表示できませんでした。</p>}
                  {downloadErrorId === id && <p className="mt-1 text-xs" style={{ color: C.red }}>教材を開けませんでした。もう一度お試しください。</p>}
                </div>
                {downloadable && (
                  <Btn size="sm" kind="ghost" icon={ChevronRight} disabled={downloadingId === id} onClick={() => handleDownload(material)}>
                    {downloadingId === id ? "開いています..." : (material.s3key ? "ダウンロード" : "開く")}
                  </Btn>
                )}
              </div>
              {previewable && (
                url ? (
                  <>
                    {kind === "pdf" && <iframe title={material.title} src={url} className="mt-3 h-96 w-full rounded-lg" style={{ border: `1px solid ${C.line}` }} />}
                    {kind === "image" && <img src={url} alt={material.title} className="mt-3 max-h-96 w-full rounded-lg object-contain" />}
                    {kind === "video" && <video src={url} controls className="mt-3 w-full rounded-lg" />}
                  </>
                ) : !previewErrors[id] && (
                  <p className="mt-3 text-xs" style={{ color: C.muted }}>プレビューを読み込み中...</p>
                )
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ElLessonView({ course, lesson, lrn, onBack, onNavigate, onComplete, lessons, initialSlideId }) {
  // slidesを持つLessonだけ「メインスライド中心UI」へ分岐する。既存Lesson(slidesなし)はこの下の
  // 既存実装をそのまま通る。
  if (lesson.slides?.length > 0) {
    return (
      <ElSlideLessonView
        course={course} lesson={lesson} lrn={lrn}
        onBack={onBack} onNavigate={onNavigate} onComplete={onComplete} lessons={lessons}
        initialSlideId={initialSlideId}
      />
    );
  }
  const lessonsDone = lrn.getLessonsDone(course.id);
  const completed = !!lessonsDone[lesson.id]?.completed;
  const materials = lrn.materialsForLesson ? lrn.materialsForLesson(course.id, lesson.id) : [];
  const idx = lessons.findIndex(l => l.id === lesson.id);
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx < lessons.length - 1 ? lessons[idx + 1] : null;
  const TYPE_LABEL = { video: "動画", text: "テキスト", quiz: "テスト" };
  const TYPE_TONE  = { video: "cyan",  text: "muted",   quiz: "amber" };
  function handleComplete() { onComplete(course.id, lesson.id); }
  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-70" style={{ color: C.muted }}>
        <ChevronLeft size={16} />{course.title}へ戻る
      </button>
      <div className="mb-5 rounded-2xl p-5" style={{ background: `${course.color}0D`, border: `1px solid ${course.color}25` }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TYPE_TONE[lesson.type]}>{TYPE_LABEL[lesson.type]}</Badge>
              <span className="text-xs" style={{ color: C.muted }}>Lesson {idx + 1} / {lessons.length}</span>
              {completed && <Badge tone="green">完了</Badge>}
            </div>
            <h2 className="mt-1.5 text-xl font-bold" style={{ color: C.ink }}>{lesson.title}</h2>
            <p className="mt-0.5 text-sm" style={{ color: C.muted }}>{lesson.duration} · {lesson.summary}</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: course.color }}>
            {idx + 1}
          </div>
        </div>
        {lessons.length > 1 && (
          <div className="mt-3 flex gap-1">
            {lessons.map(l => {
              const done = !!lessonsDone[l.id]?.completed;
              const active = l.id === lesson.id;
              return <div key={l.id} className="h-1.5 flex-1 rounded-full" style={{ background: done ? C.green : active ? course.color : C.line2 }} />;
            })}
          </div>
        )}
      </div>
      <LessonReviewCheck course={course} lesson={lesson} lrn={lrn} />
      <LessonMaterialsCard materials={materials} onOpenMaterial={lrn.getMaterialViewUrl} />
      {lesson.type === "video" && <ElVideoLesson lesson={lesson} completed={completed} onComplete={handleComplete} />}
      {lesson.type === "text"  && <ElTextLesson  lesson={lesson} completed={completed} onComplete={handleComplete} />}
      {lesson.type === "quiz"  && <ElQuizLesson  lesson={lesson} completed={completed} onComplete={handleComplete} onNext={() => next && onNavigate(next)} onPrev={() => prev && onNavigate(prev)} hasNext={!!next} />}
      {completed && (
        <div className="mt-5 overflow-hidden rounded-2xl p-4" style={{ background: `${course.color}0D`, border: `1px solid ${course.color}25` }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: C.greenW, color: C.green }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: C.ink }}>レッスン完了</div>
                <div className="text-xs" style={{ color: C.muted }}>
                  {next ? "次のレッスンへ進みましょう。"
                    : course.finalTestEnabled === false ? "全Lesson完了。これでコース修了です。"
                      : "全Lesson完了。総合テストに合格するとコース修了です。"}
                </div>
              </div>
            </div>
            {next
              ? <Btn icon={ChevronRight} onClick={() => onNavigate(next)}>次のレッスンへ</Btn>
              : <Btn icon={Award} onClick={onBack}>{course.finalTestEnabled === false ? "コースへ戻る" : "総合テストへ進む"}</Btn>}
          </div>
        </div>
      )}
      <div className="mt-5 flex items-center justify-between">
        {prev
          ? <button onClick={() => onNavigate(prev)} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:shadow-sm"
              style={{ border: `1px solid ${C.line2}`, background: "#fff", color: C.body }}>
              <ChevronLeft size={15} />前のレッスン
            </button>
          : <div />}
        {next
          ? <button onClick={() => onNavigate(next)} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:shadow-sm"
              style={{ border: `1px solid ${C.line2}`, background: "#fff", color: C.body }}>
              次のレッスン<ChevronRight size={15} />
            </button>
          : <div />}
      </div>
    </div>
  );
}
export {
  LearningPlaceholder,
  LearningOverview,
  ElCourseView,
  ElInProgressView,
  ElCompletedView,
  ElRecommendView,
  ElSkillsView,
  ElCompletionModal,
  ElCourseDetail,
  ElFinalTestView,
  ElLessonView,
  LessonBodyText,
};
