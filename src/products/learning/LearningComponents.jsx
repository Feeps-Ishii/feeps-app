import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  BookOpen, FileText, Settings, Users, Search, PlayCircle, Award,
  Sparkles, Flame, ChevronRight, ChevronLeft, Check, CheckCircle2,
  Circle, AlertCircle, Lightbulb, Calendar, Clock, RefreshCw, Download
} from "lucide-react";
import { Card, Badge, Btn, EmptyState, SectionHead, PageHeader, ProductNavCard, T, PRODUCT_ACCENT } from "../../components/common";
import ElSlideLessonView from "./ElSlideLessonView.jsx";
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
function LearningOverview({ lrn, goSub, goProduct, onOpenDetail, role, themeColor = PRODUCT_ACCENT.learning.accent }) {
  const isCreator = role === "instructor" || role === "admin";
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
  return (
    <div>
      <PageHeader
        product="learning"
        label="Eラーニング"
        title="理解して、試して、身につける。"
        description="短い説明と例のあとに自分で操作。すぐにフィードバックを受け、復習と総合テストで定着を確かめます。"
        chips={[
          { label: "修了コース", value: lrn.completed.length, unit: "本" },
          { label: "学習中", value: lrn.inprogress.length, unit: "本" },
          { label: "取得スキル", value: earnedSkills.length, unit: "件" },
        ]}
        cta={{ label: "コース一覧を開く", icon: BookOpen, onClick: () => goSub("el_courses") }}
      />

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

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <ProductNavCard product="learning" icon={BookOpen} title="コース一覧" desc="公開中のコースから学習を始める" onClick={() => goSub("el_courses")} delay={650} />
        <ProductNavCard product="learning" icon={PlayCircle} title="学習中" desc="受講中のコースを続きから再開" onClick={() => goSub("el_inprogress")} highlight badge="よく使う" delay={710} />
        <ProductNavCard product="learning" icon={Sparkles} title="獲得スキル" desc="学習で身についたスキルを確認" onClick={() => goSub("el_skills")} delay={770} />
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

      {/* クイックアクセス */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { key: "el_courses",   icon: BookOpen,  label: "コース一覧", desc: `全${(lrn.catalog || []).length}コース` },
          { key: "el_completed", icon: Award,     label: "修了済み",   desc: `${lrn.completed.length}本修了` },
          { key: "el_skills",    icon: Sparkles,  label: "獲得スキル", desc: `${earnedSkills.length}件` },
          { key: "el_recommend", icon: Lightbulb, label: "おすすめ",   desc: `${lrn.notStarted.length}本未受講` },
        ].map(({ key, icon: Icon, label, desc }) => (
          <Card key={key} className="cursor-pointer p-4 transition hover:shadow-md" onClick={() => goSub(key)}>
            <div className="mb-1.5 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${themeColor}14` }}>
                <Icon size={14} style={{ color: themeColor }} />
              </div>
              <span className="text-sm font-bold" style={{ color: C.ink }}>{label}</span>
            </div>
            <p className="text-xs" style={{ color: C.muted }}>{desc}</p>
          </Card>
        ))}
      </div>

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
              { key: "el_manage",   icon: Settings, label: "Learning Studio", desc: "目的からAI構成案を作り、Lessonを確認して公開準備できます。" },
              { key: "el_lessons",  icon: FileText,  label: "レッスン管理", desc: "レッスンと教材を管理できます。" },
              { key: "el_students", icon: Users,     label: "受講状況",     desc: "受講生の進捗と完了状況を確認できます。" },
            ].map(({ key, icon: Icon, label, desc }) => (
              <Card key={key} className="cursor-pointer p-4 transition hover:shadow-md" onClick={() => goSub(key)}>
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
  const catalog = lrn.catalog || [];
  const cats = ["すべて", ...new Set(catalog.map(c => c.category))];
  const filtered = catalog.filter(c =>
    (catFilter === "すべて" || c.category === catFilter) &&
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
  return (
    <div>
      <SectionHead title="修了済み" desc={`${lrn.completed.length}本のコースを修了しました。`} />
      {lrn.completed.length === 0
        ? <LearningEmptyAction title="修了済みのコースがありません" desc="最初のコースを修了すると、獲得スキルと成長履歴に反映されます。" cta="学習を始める" icon={Award} onClick={() => goSub("el_courses")} themeColor={PRODUCT_ACCENT.learning.accent} />
        : (<>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {[
                { label: "修了コース", value: `${lrn.completed.length}本`, color: C.green },
                { label: "取得スキル", value: `${lrn.getEarnedSkills().length}件`, color: C.cyan },
                { label: "推定学習時間", value: `${lrn.completed.reduce((s, c) => s + courseHours(c.duration), 0)}時間`, color: PRODUCT_ACCENT.talent.accent },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl p-4" style={{ background: C.canvas }}>
                  <div className="text-xs font-bold" style={{ color: C.muted }}>{label}</div>
                  <div className="mt-1 text-2xl font-bold" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3">{lrn.completed.map(c => {
              const prog = lrn.progress[c.id];
              const officialResult = lrn.getOfficialFinalTestResult(c.id);
              return (
                <Card key={c.id} className="cursor-pointer p-4 transition hover:shadow-md" onClick={() => onOpenDetail && onOpenDetail(c)}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: c.color }}>{c.title.slice(0, 2)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: C.ink }}>{c.title}</span>
                        <Badge tone="green">修了</Badge>
                        <Badge tone="cyan">総合テスト合格</Badge>
                      </div>
                      <div className="mt-0.5 text-xs" style={{ color: C.muted }}>
                        {officialResult?.createdAt ? `修了日: ${officialResult.createdAt.slice(0, 10)} / ${officialResult.score}点` : (prog?.completedAt ? `修了日: ${prog.completedAt.slice(0, 10)}` : "")}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.skills.map(s => <span key={s} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: C.greenW, color: C.green }}><Check size={9} />{s}</span>)}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}</div>
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

function pdfEscape(text) {
  return String(text || "").replace(/[^\x20-\x7E]/g, "?").replace(/[\\()]/g, "\\$&");
}
function buildSimplePdf(lines) {
  const content = lines.map((line, index) => `72 ${760 - index * 28} Td (${pdfEscape(line)}) Tj`).join("\n");
  const stream = `BT\n/F1 18 Tf\n${content}\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach(obj => { offsets.push(pdf.length); pdf += obj; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}
function downloadCertificate(course, result) {
  const issuedAt = result?.createdAt?.slice(0, 10) || course?.completedAt?.slice?.(0, 10) || new Date().toISOString().slice(0, 10);
  const pdf = buildSimplePdf([
    "Feeps One Certificate",
    `Course: ${course?.title || course?.id}`,
    `Issued: ${issuedAt}`,
    result?.score != null ? `Score: ${result.score}` : "Score: -",
    "This certificate is generated from completed learning records.",
  ]);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `feeps-certificate-${course?.id || "course"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function ElCertificateView({ lrn, goSub }) {
  return (
    <div>
      <SectionHead title="修了証" desc="Eラーニングの修了済みコースから修了証を確認できます。" />
      {lrn.completed.length === 0 ? (
        <LearningEmptyAction title="修了証はまだありません" desc="コースを修了すると、取得日と対象コースがここに表示されます。" cta="学習を始める" icon={Award} onClick={() => goSub("el_courses")} themeColor={PRODUCT_ACCENT.learning.accent} />
      ) : (
        <div className="space-y-3">
          {lrn.completed.map(course => {
            const result = lrn.getOfficialFinalTestResult(course.id);
            const issuedAt = result?.createdAt?.slice(0, 10) || lrn.progress[course.id]?.completedAt?.slice(0, 10) || "-";
            return (
              <Card key={course.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="green">取得済み</Badge>
                      <h3 className="text-base font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>{course.title}</h3>
                    </div>
                    <div className="mt-1 text-xs" style={{ color: C.muted }}>取得日: {issuedAt}{result?.score != null ? ` / ${result.score}点` : ""}</div>
                  </div>
                  <Btn icon={Download} onClick={() => downloadCertificate(course, result)}>PDFダウンロード</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}
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
              <Btn size="sm" kind="ghost" icon={PlayCircle} onClick={() => onOpenLesson(lesson)}>復習する</Btn>
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

function FinalTestPlanCard({ course, plan, onBuild, onUpdate, onStartTest, onShowResult, latestResult, canStart }) {
  const [showJson, setShowJson] = useState(false);
  const targetLessons = plan?.targetLessons || [];
  const overallLessons = plan?.overallLessons || [];
  return (
    <Card className="mb-5 p-5" style={{ background: "rgba(20,163,184,.06)", border: "1px solid rgba(20,163,184,.18)" }}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Award size={16} style={{ color: C.green }} />
            <h3 className="text-base font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>総合テスト出題計画</h3>
          </div>
          <p className="mt-1 text-xs" style={{ color: C.muted }}>理解度チェックと復習フラグをもとに、AI呼び出し前の出題プランを作成します。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" icon={RefreshCw} onClick={plan ? onUpdate : onBuild}>{plan ? "計画を更新" : "出題計画を作成"}</Btn>
          {canStart && <Btn size="sm" icon={Award} onClick={onStartTest}>総合テストを開始</Btn>}
          {latestResult && <Btn size="sm" kind="ghost" icon={CheckCircle2} onClick={onShowResult}>前回の結果を見る</Btn>}
        </div>
      </div>
      {!plan ? (
        <div className="rounded-xl bg-white p-4 text-sm" style={{ border: `1px solid ${C.line}`, color: C.muted }}>
          まだ出題計画はありません。コース終盤で「少し不安」「後で復習したい」を記録してから作成すると、苦手中心の計画になります。
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["出題数", `${plan.questionCount}問`, C.green],
              ["苦手重視率", `${plan.weaknessRatio}%`, C.amber],
              ["全体確認率", `${plan.overallRatio}%`, C.cyanDeep],
              ["苦手Lesson", `${targetLessons.length}件`, C.red],
              ["全体確認Lesson", `${overallLessons.length}件`, C.ink],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-xl bg-white p-3" style={{ border: `1px solid ${C.line}` }}>
                <div className="text-[11px] font-bold" style={{ color: C.muted }}>{label}</div>
                <div className="mt-1 text-lg font-bold" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-white p-4" style={{ border: `1px solid ${C.line}` }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: C.ink }}>優先復習Lesson</span>
                <Badge tone="amber">{plan.weaknessQuestions}問</Badge>
              </div>
              {targetLessons.length === 0 ? (
                <p className="text-xs" style={{ color: C.muted }}>復習フラグはありません。全体確認中心で出題します。</p>
              ) : (
                <div className="space-y-2">
                  {targetLessons.slice(0, 4).map(item => (
                    <div key={item.lessonId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-semibold" style={{ color: C.body }}>{item.lessonTitle}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge tone={item.priority === "high" ? "red" : "amber"}>{item.reason}</Badge>
                        <span style={{ color: C.muted }}>{item.questionCount}問</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-white p-4" style={{ border: `1px solid ${C.line}` }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: C.ink }}>注意事項</span>
                <Badge tone={plan.warnings?.length ? "amber" : "green"}>{plan.warnings?.length || 0}件</Badge>
              </div>
              {plan.warnings?.length ? (
                <div className="space-y-1">
                  {plan.warnings.map(w => <div key={w} className="text-xs" style={{ color: C.amber }}>{w}</div>)}
                </div>
              ) : (
                <p className="text-xs" style={{ color: C.muted }}>総合テスト前の大きな注意事項はありません。</p>
              )}
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px]" style={{ color: C.muted }}>
                  <span>苦手中心</span><span>{plan.weaknessQuestions}/{plan.questionCount}問</span>
                </div>
                <Bar value={plan.questionCount ? Math.round((plan.weaknessQuestions / plan.questionCount) * 100) : 0} tone="amber" />
              </div>
            </div>
          </div>
          <button onClick={() => setShowJson(v => !v)} className="mt-4 text-xs font-bold" style={{ color: C.green }}>
            {showJson ? "AIへ渡す予定のデータを閉じる" : "AIへ渡す予定のデータを見る"}
          </button>
          {showJson && (
            <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-white p-4 text-xs" style={{ border: `1px solid ${C.line}`, color: C.body }}>
              {JSON.stringify(plan, null, 2)}
            </pre>
          )}
        </>
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

function FinalPreparationCard({ plan, reviewItems, lessons, onOpenLesson, onReviewed }) {
  if (!plan && reviewItems.length === 0) return null;
  const targets = plan?.targetLessons?.length ? plan.targetLessons : reviewItems;
  return (
    <Card className="p-5" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold" style={{ color: C.ink, letterSpacing: "-0.02em" }}>総合テスト前の準備</h3>
          <p className="mt-1 text-xs" style={{ color: C.muted }}>まず振り返るべきLessonを確認してから、次フェーズのAI総合テストへ進みます。</p>
        </div>
        <Badge tone="green">AI総合テストは次フェーズ予定</Badge>
      </div>
      <div className="space-y-2">
        {targets.slice(0, 5).map(item => {
          const lesson = lessons.find(ls => ls.id === item.lessonId);
          if (!lesson) return null;
          return (
            <div key={item.lessonId} className="flex flex-col gap-3 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between" style={{ border: `1px solid ${C.line}` }}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: C.ink }}>{lesson.title}</span>
                  <Badge tone={item.priority === "high" || item.reviewLater ? "red" : "amber"}>{item.reason || reviewStatusLabel(item)}</Badge>
                  {item.reviewed && <Badge tone="green">復習済み</Badge>}
                </div>
                <div className="mt-1 text-xs" style={{ color: C.muted }}>
                  {plan ? `${item.questionCount || 0}問予定` : (item.pageId && item.pageId !== "lesson" ? `対象: ${item.pageId}` : "Lesson全体")}
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
      {plan && (
        <div className="mt-4 rounded-xl bg-white p-3 text-xs" style={{ border: `1px solid ${C.line}`, color: C.body }}>
          出題計画: 全{plan.questionCount}問 / 苦手中心 {plan.weaknessQuestions}問 / 全体確認 {plan.overallQuestions}問
        </div>
      )}
    </Card>
  );
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
  const nextLesson = lessons.find(l => !lessonsDone[l.id]?.completed);
  const reviewItems = lrn.getCourseReviewItems(course.id);
  const finalPlan = lrn.getFinalTestPlan(course.id);
  const latestFinalResult = lrn.getLatestFinalTestResult(course.id);
  const TYPE_LABEL = { video: "動画", text: "テキスト", quiz: "テスト" };
  const TYPE_TONE  = { video: "cyan",  text: "muted",   quiz: "amber" };
  function openLesson(ls) { lrn.startCourse(course.id); lrn.touchLesson(course.id, ls.id); onOpenLesson(ls); }
  function handleStartCourse() { lrn.startCourse(course.id); onOpenLesson(nextLesson || lessons[0]); }
  function handleReviewed(lessonId) { lrn.markLessonReviewed(course.id, lessonId); }
  function handleBuildFinalPlan() { lrn.buildFinalTestPlan(course.id); }
  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-70" style={{ color: C.muted }}>
        <ChevronLeft size={16} />コース一覧へ戻る
      </button>
      <div className="mb-6 overflow-hidden rounded-2xl" style={{ background: `linear-gradient(135deg, ${course.color} 0%, ${course.color}bb 100%)` }}>
        <div className="p-6" style={{ background: "rgba(0,0,0,.1)" }}>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white" style={{ background: "rgba(255,255,255,.2)" }}>
              {course.title.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,.7)" }}>{course.category}</div>
              <h2 className="mt-1 text-2xl font-bold text-white">{course.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,.8)" }}>
                <span>{course.level}</span><span style={{ color: "rgba(255,255,255,.35)" }}>·</span>
                <span>{formatCourseHours(course.duration, "約")}</span><span style={{ color: "rgba(255,255,255,.35)" }}>·</span>
                <span>{lessons.length || course.lessons}レッスン</span>
              </div>
            </div>
            {isCompleted && <div className="shrink-0 rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>修了済み ✓</div>}
            {courseState.status === "lessons_completed" && <div className="shrink-0 rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>総合テスト待ち</div>}
            {courseState.status === "review_recommended" && <div className="shrink-0 rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>復習推奨</div>}
            {courseState.status === "final_test_failed" && <div className="shrink-0 rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>再挑戦</div>}
          </div>
          {(isInprogress || isCompleted || isFinalWaiting) && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-sm" style={{ color: "rgba(255,255,255,.8)" }}>
                <span>進捗</span><span className="font-bold">{pct}%（{doneCnt}/{lessons.length} レッスン）</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,.25)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#fff" }} />
              </div>
            </div>
          )}
          <div className="mt-4">
            {!prog?.status && lessons.length > 0 && (
              <button onClick={handleStartCourse} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "rgba(255,255,255,.22)", border: "1.5px solid rgba(255,255,255,.45)" }}>
                <PlayCircle size={15} className="mr-1.5 inline" />受講を開始する
              </button>
            )}
            {isInprogress && nextLesson && (
              <button onClick={handleStartCourse} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "rgba(255,255,255,.22)", border: "1.5px solid rgba(255,255,255,.45)" }}>
                <PlayCircle size={15} className="mr-1.5 inline" />続きから学習する
              </button>
            )}
            {isCompleted && lessons.length > 0 && (
              <button onClick={() => openLesson(lessons[0])} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "rgba(255,255,255,.22)", border: "1.5px solid rgba(255,255,255,.45)" }}>
                <BookOpen size={15} className="mr-1.5 inline" />復習する
              </button>
            )}
            {courseState.status === "lessons_completed" && (
              <button onClick={onStartFinalTest} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "rgba(255,255,255,.22)", border: "1.5px solid rgba(255,255,255,.45)" }}>
                <Award size={15} className="mr-1.5 inline" />総合テストへ進む
              </button>
            )}
            {courseState.status === "review_recommended" && (
              <button onClick={onStartFinalTest} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "rgba(255,255,255,.22)", border: "1.5px solid rgba(255,255,255,.45)" }}>
                <RefreshCw size={15} className="mr-1.5 inline" />復習して総合テストへ
              </button>
            )}
            {courseState.status === "final_test_failed" && (
              <button onClick={onStartFinalTest} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "rgba(255,255,255,.22)", border: "1.5px solid rgba(255,255,255,.45)" }}>
                <RefreshCw size={15} className="mr-1.5 inline" />総合テストに再挑戦
              </button>
            )}
          </div>
        </div>
      </div>
      <LearningExperienceFlow
        compact
        className="mb-5"
        activeKey={isCompleted || ["lessons_completed", "final_test_failed"].includes(courseState.status)
          ? "final"
          : courseState.status === "review_recommended" ? "review" : "explanation"}
      />
      {isFinalWaiting && (
        <Card className="mb-5 p-4" style={{ background: courseState.status === "final_test_failed" ? C.redW : C.amberW, borderColor: courseState.status === "final_test_failed" ? "#FCA5A5" : "#FCD34D" }}>
          <div className="flex items-start gap-3">
            <AlertCircle size={18} style={{ color: courseState.status === "final_test_failed" ? C.red : C.amber }} />
            <div>
              <div className="text-sm font-bold" style={{ color: C.ink }}>
                {courseState.status === "final_test_failed" ? "総合テストは不合格です。復習して再挑戦してください。" : courseState.status === "review_recommended" ? "総合テスト前に復習した方がいいLessonがあります。" : "全Lesson完了。総合テストに合格するとコース修了です。"}
              </div>
              <p className="mt-1 text-xs" style={{ color: C.body }}>復習対象があっても総合テストは受験できます。</p>
            </div>
          </div>
        </Card>
      )}
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold" style={{ color: C.ink }}>コース進捗</div>
            <div className="mt-1 text-xs" style={{ color: C.muted }}>{doneCnt} / {lessons.length} Lessons</div>
          </div>
          <div className="text-2xl font-bold" style={{ color: course.color }}>{pct}%</div>
        </div>
        <div className="mt-3"><Bar value={pct} tone={isCompleted ? "green" : "cyan"} /></div>
      </Card>
      <Card className="mb-5 p-5" style={{ background: "#7C3AED0D", border: "1px solid #7C3AED20" }}>
        <div className="mb-3 flex items-center gap-2">
          <Award size={16} style={{ color: PRODUCT_ACCENT.talent.accent }} />
          <h3 className="text-base font-bold" style={{ color: PRODUCT_ACCENT.talent.accent, letterSpacing: "-0.02em" }}>このコースを修了すると</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[course.skills[0] || "基礎スキル", "クラウドスキル +20", "スキルシート更新", "成長履歴へ反映", "案件マッチングへ活用"].map(t => (
            <div key={t} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm" style={{ color: C.body, border: `1px solid ${C.line}` }}>
              <CheckCircle2 size={14} style={{ color: PRODUCT_ACCENT.talent.accent }} />
              <span className="font-semibold">{t}</span>
            </div>
          ))}
        </div>
      </Card>
      <FinalTestPlanCard
        course={course}
        plan={finalPlan}
        latestResult={latestFinalResult}
        canStart={courseState.readyForFinalTest || !!finalPlan}
        onBuild={handleBuildFinalPlan}
        onUpdate={handleBuildFinalPlan}
        onStartTest={onStartFinalTest}
        onShowResult={onShowFinalResult}
      />
      <FinalTestLatestResultCard result={latestFinalResult} lessons={lessons} onOpenLesson={openLesson} />
      <WeakExercisesCard items={lrn.getCourseWeakItems ? lrn.getCourseWeakItems(course.id) : []} lessons={lessons} onOpenLesson={openLesson} />
      <div className="mb-5">
        <ReviewLessonList
          title="復習した方がいいLesson"
          desc="「少し不安」「後で復習したい」を付けたLessonです。総合テスト前に見直しましょう。"
          lessons={lessons}
          items={reviewItems}
          onOpenLesson={openLesson}
          onReviewed={handleReviewed}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <h3 className="mb-2 font-bold" style={{ color: C.ink }}>コース概要</h3>
            <p className="text-sm leading-relaxed" style={{ color: C.body }}>{course.desc}</p>
          </Card>
          <Card className="p-5">
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
                            <Badge tone={TYPE_TONE[ls.type]}>{TYPE_LABEL[ls.type]}</Badge>
                            <Badge tone={stateTone}>{stateLabel}</Badge>
                            {review && <Badge tone={reviewStatusTone(review)}>{reviewStatusLabel(review)}</Badge>}
                            {review?.reviewed && <Badge tone="green">復習済み</Badge>}
                          </div>
                          <div className="mt-0.5 text-xs" style={{ color: C.muted }}>{ls.duration} · {ls.summary}</div>
                        </div>
                        {done ? <CheckCircle2 size={18} style={{ color: C.green }} /> : <ChevronRight size={16} style={{ color: C.faint }} />}
                      </button>
                    );
                  })}
                </div>}
          </Card>
          {(pct >= 80 || doneCnt >= Math.max(0, lessons.length - 1)) && (
            <ReviewLessonList
              title="総合テスト前に振り返る内容"
              desc="コース終盤で見直しておきたいLessonです。復習済みにするとこの一覧から外れます。"
              lessons={lessons}
              items={reviewItems}
              onOpenLesson={openLesson}
              onReviewed={handleReviewed}
            />
          )}
          {(pct >= 80 || doneCnt >= Math.max(0, lessons.length - 1)) && (
            <FinalPreparationCard
              plan={finalPlan}
              reviewItems={reviewItems}
              lessons={lessons}
              onOpenLesson={openLesson}
              onReviewed={handleReviewed}
            />
          )}
        </div>
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="mb-3 font-bold" style={{ color: C.ink }}>習得できるスキル</h3>
            <div className="flex flex-wrap gap-1.5">
              {course.skills.map(s => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: `${course.color}14`, color: course.color }}>
                  <Sparkles size={10} />{s}
                </span>
              ))}
            </div>
          </Card>
          <Card className="p-5" style={{ background: "#7C3AED0D", border: "1px solid #7C3AED20" }}>
            <h3 className="mb-3 text-sm font-bold" style={{ color: PRODUCT_ACCENT.talent.accent }}>このコースを修了すると</h3>
            <div className="space-y-2">
              {["スキル・成長に自動反映", "成長履歴へ記録", "案件用スキルシートに反映", "将来の案件マッチングに活用"].map(t => (
                <div key={t} className="flex items-center gap-2 text-sm">
                  <Check size={13} style={{ color: PRODUCT_ACCENT.talent.accent }} />
                  <span style={{ color: C.body }}>{t}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 font-bold" style={{ color: C.ink }}>コース情報</h3>
            <div className="space-y-2">
              {[["カテゴリ", course.category], ["難易度", course.level], ["学習時間", formatCourseHours(course.duration, "約")], ["レッスン数", `${lessons.length || course.lessons}本`]].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between text-sm">
                  <span style={{ color: C.muted }}>{l}</span>
                  <span className="font-semibold" style={{ color: C.ink }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
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

function ElLessonView({ course, lesson, lrn, onBack, onNavigate, onComplete, lessons }) {
  // slidesを持つLessonだけ「メインスライド中心UI」へ分岐する。既存Lesson(slidesなし)はこの下の
  // 既存実装をそのまま通る。
  if (lesson.slides?.length > 0) {
    return (
      <ElSlideLessonView
        course={course} lesson={lesson} lrn={lrn}
        onBack={onBack} onNavigate={onNavigate} onComplete={onComplete} lessons={lessons}
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
                <div className="text-xs" style={{ color: C.muted }}>{next ? "次のレッスンへ進みましょう。" : "全Lesson完了。総合テストに合格するとコース修了です。"}</div>
              </div>
            </div>
            {next
              ? <Btn icon={ChevronRight} onClick={() => onNavigate(next)}>次のレッスンへ</Btn>
              : <Btn icon={Award} onClick={onBack}>総合テストへ進む</Btn>}
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
  ElCertificateView,
  ElCompletionModal,
  ElCourseDetail,
  ElFinalTestView,
  ElLessonView,
  LessonBodyText,
};
