import React, { useMemo, useState } from "react";
import { ChevronRight, Eye, ListChecks } from "lucide-react";
import { Badge, Btn, Card, T, PRODUCT_ACCENT } from "../../../components/common";
import AdminModal from "./AdminModal.jsx";
import ElSlideLessonView from "../ElSlideLessonView.jsx";

// フェーズ③(AIコーススタジオ強化): 「受講生表示でコースを通しで見る」プレビュー。
// 受講生の実画面コンポーネント(ElSlideLessonView)をそのまま再利用し、提出・進捗保存だけを
// 無効化したlrnスタブを渡す(バックエンド変更は不要、既存の受講生画面ロジックは一切変更しない)。
// 2つの入口から使う: (1) AiLessonDesigner.jsx — 保存前の下書き(メモリ上のresult)をそのまま渡す、
// (2) CourseManager.jsx — 保存済みコースを管理APIから取得して渡す。どちらもこのコンポーネントの
// 契約は同じ({course, lessons, finalTestQuestions})。
const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border };

// ElSlideLessonView/SlideRendererが読むlrnメソッドのうち、ガード無しで呼ばれるものだけ最低限の
// no-opを用意する(getExerciseSubmission/submitExercise/materialsForLessonは`lrn?.foo &&`で
// ガードされているため未定義のままでよい。submitExerciseを敢えて持たせないことで、演習の送信・
// AIフィードバック採点ボタンが自然に無効化される=「提出等は無効化したプレビューモード」)。
function buildPreviewLrn() {
  return {
    getExerciseSubmission: () => null,
    materialsForLesson: () => [],
    getMaterialViewUrl: async () => ({ url: null }),
    getLessonReview: () => ({ status: null, reviewed: false }),
    setLessonReview: () => {},
    getLessonsDone: () => ({}),
  };
}

function FinalTestPreview({ questions, onBack }) {
  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm font-semibold" style={{ color: C.muted }}>← レッスン一覧へ戻る</button>
      <div className="mb-4 rounded-xl p-3 text-xs" style={{ background: T.bgBase, color: C.muted }}>
        実際の総合テストは、この問題プールからランダムに出題されます（プレビューでは採点・合否判定は行いません）。
      </div>
      {!questions?.length ? (
        <p className="text-sm" style={{ color: C.muted }}>まだ総合テスト問題が生成されていません。</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <Card key={i} className="p-4">
              <div className="mb-2 text-sm font-bold" style={{ color: C.ink }}>{i + 1}. {q.question}</div>
              <ul className="space-y-1">
                {(q.choices || []).map((choice, ci) => (
                  <li
                    key={ci}
                    className="rounded-lg px-3 py-1.5 text-xs"
                    style={{
                      background: ci === q.answerIndex ? PRODUCT_ACCENT.learning.subtle : T.bgBase,
                      color: ci === q.answerIndex ? PRODUCT_ACCENT.learning.accent : C.body,
                      fontWeight: ci === q.answerIndex ? 700 : 400,
                    }}
                  >
                    {choice}{ci === q.answerIndex ? "（正解）" : ""}
                  </li>
                ))}
              </ul>
              {q.explanation && <p className="mt-2 text-xs" style={{ color: C.muted }}>{q.explanation}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonListView({ course, lessons, finalTestQuestions, onOpenLesson, onOpenFinalTest }) {
  return (
    <div>
      <div className="mb-4 rounded-xl p-3 text-xs" style={{ background: T.bgBase, color: C.muted }}>
        プレビューモード: 演習の提出・進捗・レッスン完了は保存されません。
      </div>
      <div className="mb-4 rounded-2xl p-5" style={{ background: `${course.color || PRODUCT_ACCENT.learning.accent}0D`, border: `1px solid ${course.color || PRODUCT_ACCENT.learning.accent}25` }}>
        <h2 className="text-lg font-bold" style={{ color: C.ink }}>{course.title || "無題のコース"}</h2>
        {course.desc && <p className="mt-1 text-sm" style={{ color: C.body }}>{course.desc}</p>}
      </div>
      <div className="space-y-2">
        {lessons.map((lesson, i) => (
          <button
            key={lesson.id || i}
            type="button"
            onClick={() => onOpenLesson(lesson)}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition hover:opacity-80"
            style={{ background: "#fff", border: `1px solid ${C.line}` }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: PRODUCT_ACCENT.learning.subtle, color: PRODUCT_ACCENT.learning.accent }}>{i + 1}</span>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold" style={{ color: C.ink }}>{lesson.title || "無題のレッスン"}</div>
                <div className="text-[11px]" style={{ color: C.muted }}>{(lesson.slides || []).length}ページ</div>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: C.muted }} />
          </button>
        ))}
        {!lessons.length && <p className="text-sm" style={{ color: C.muted }}>レッスンがまだありません。</p>}
      </div>
      <button
        type="button"
        onClick={onOpenFinalTest}
        className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition hover:opacity-80"
        style={{ background: T.aiSubtle, border: `1px solid ${T.aiAccent}30` }}
      >
        <div className="flex items-center gap-3">
          <ListChecks size={18} style={{ color: T.aiAccentDeep }} />
          <div>
            <div className="text-sm font-bold" style={{ color: C.ink }}>総合テスト（プレビュー）</div>
            <div className="text-[11px]" style={{ color: C.muted }}>{(finalTestQuestions || []).length}問の設問プール</div>
          </div>
        </div>
        <ChevronRight size={16} style={{ color: C.muted }} />
      </button>
    </div>
  );
}

export default function CourseWalkthroughPreview({ open, onClose, course, lessons = [], finalTestQuestions = [] }) {
  const [view, setView] = useState("list"); // list | lesson | finaltest
  const [currentLessonId, setCurrentLessonId] = useState(null);
  const previewLrn = useMemo(() => buildPreviewLrn(), []);

  const orderedLessons = useMemo(() => (
    lessons.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
  ), [lessons]);
  const currentLesson = orderedLessons.find(l => l.id === currentLessonId) || null;

  function handleClose() {
    setView("list");
    setCurrentLessonId(null);
    onClose();
  }

  return (
    <AdminModal open={open} title="コースを通しでプレビュー" desc="受講生の実画面を、この下書き内容でそのまま確認できます。" onClose={handleClose} width={1150}>
      <div className="flex items-center gap-2 mb-2">
        <Badge tone="cyan"><span className="inline-flex items-center gap-1"><Eye size={11} />プレビュー</span></Badge>
        {view !== "list" && (
          <Btn kind="ghost" size="sm" onClick={() => setView("list")}>一覧へ戻る</Btn>
        )}
      </div>
      {view === "list" && (
        <LessonListView
          course={course}
          lessons={orderedLessons}
          finalTestQuestions={finalTestQuestions}
          onOpenLesson={lesson => { setCurrentLessonId(lesson.id); setView("lesson"); }}
          onOpenFinalTest={() => setView("finaltest")}
        />
      )}
      {view === "lesson" && currentLesson && (
        <ElSlideLessonView
          course={course}
          lesson={currentLesson}
          lrn={previewLrn}
          lessons={orderedLessons}
          onBack={() => setView("list")}
          onNavigate={next => setCurrentLessonId(next.id)}
          onComplete={() => {}}
        />
      )}
      {view === "finaltest" && (
        <FinalTestPreview questions={finalTestQuestions} onBack={() => setView("list")} />
      )}
    </AdminModal>
  );
}
