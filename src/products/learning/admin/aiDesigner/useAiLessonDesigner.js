import { useState } from "react";
import { apiPost } from "../../../../api.js";
import { PRODUCT_ACCENT } from "../../../../components/common";

// AI Lesson Designer STEP1(コース設計)+STEP2(Lesson単位のslides生成)用の軽量Hook。
// 既存のuseAiCurriculumDesigner.jsとは異なり、生成結果の確認・下書き保存のみが目的で、
// 編集用のadd/update/delete関数は持たない。保存(saveGenerated)は、既存の
// useAiCurriculumDesigner.jsのsaveToLearningAdmin()と同じくuseLearningAdmin.jsの既存
// createCourseAwaitingApi/createLessonAwaitingApiへ委譲するだけで、新しい保存の仕組みは作らない。
// STEP2の「このLessonを生成」は、コース保存前の生成結果(result.lessons、まだDB未保存)に対して
// 動作する。生成されたslidesはresult.lessons[i].slidesに保持され、後で「このコースを保存する」を
// 押した時に一緒に保存される(§saveGenerated参照)。生成対象kindはconcept/diagram/table/summary/
// quiz(選択式)の5種のみ(ADR 0005)。image/video/pdf_page(将来)は管理画面での手動追加のみ。
const EMPTY_BRIEF = {
  audience: "",
  duration: "",
  difficulty: "初級",
  goals: "",
  techs: "",
  // 2026-07-21 Phase3(AIコーススタジオ強化): 演習系kind(terminal/selection_task/ordering_puzzle/
  // fill_blank)の一括生成をON/OFFするトグル。デフォルトON(演習込みで一括生成する)。
  exercisesEnabled: true,
};

const DEFAULT_LESSON_COUNT_HINT = 4;

let idSeq = 0;
function nextId(prefix) {
  idSeq += 1;
  return `${prefix}-${Date.now()}-${idSeq}`;
}

export function useAiLessonDesigner() {
  const [brief, setBrief] = useState({ ...EMPTY_BRIEF });
  const [genState, setGenState] = useState("idle"); // idle | loading | done | error
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState(null); // { course, lessons }
  const [generatedFor, setGeneratedFor] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | done | error
  const [saveNotice, setSaveNotice] = useState("");
  const [slideGenByLessonId, setSlideGenByLessonId] = useState({}); // { [lessonId]: { status, notice } }
  // 2026-07-21 Phase3(AIコーススタジオ強化) Stage3: 総合テスト生成の状態。コース設計(STEP1)→
  // レッスンごとの生成(STEP2、演習込み)に続く3段階目。
  const [finalTestState, setFinalTestState] = useState("idle"); // idle | loading | done | error
  const [finalTestNotice, setFinalTestNotice] = useState("");
  const [finalTestQuestions, setFinalTestQuestions] = useState([]); // [{lessonRef, question, choices, answerIndex, explanation}]

  function setBriefField(key, value) {
    setBrief(prev => ({ ...prev, [key]: value }));
  }

  async function generate() {
    if (genState === "loading") return;
    setGenState("loading");
    setNotice("");
    setGeneratedFor({ ...brief });
    setFinalTestState("idle");
    setFinalTestNotice("");
    setFinalTestQuestions([]);
    try {
      const data = await apiPost("/learning/admin/ai-lesson-designer/generate", {
        targetAudience: brief.audience.trim(),
        duration: brief.duration.trim(),
        difficulty: brief.difficulty,
        goals: brief.goals.trim(),
        techs: brief.techs.trim(),
        lessonCountHint: DEFAULT_LESSON_COUNT_HINT,
      });
      const lessons = Array.isArray(data?.lessons) ? data.lessons.map(l => ({
        id: nextId("lesson"),
        title: l.title || "",
        summary: l.summary || "",
        goal: l.goal || "",
        teacherMemo: l.teacherMemo || "",
        difficulty: l.difficulty || "",
        estimatedMinutes: Number(l.estimatedMinutes) || 30,
      })) : [];
      if (!lessons.length) throw new Error("Lesson候補が返りませんでした。");
      setResult({
        course: {
          title: data?.course?.title || "生成されたコース",
          level: data?.course?.level || brief.difficulty,
          desc: data?.course?.desc || "",
        },
        lessons,
      });
      setGenState("done");
    } catch (e) {
      const debug = [e?.errorCode, e?.errorMessage, e?.hint].filter(Boolean).join("\n");
      setNotice(debug || e?.message || "AI生成に失敗しました。入力内容を調整して再試行してください。");
      setGenState("error");
    }
  }

  function reset() {
    setResult(null);
    setNotice("");
    setGenState("idle");
    setGeneratedFor(null);
    setSaveState("idle");
    setSaveNotice("");
    setSlideGenByLessonId({});
    setFinalTestState("idle");
    setFinalTestNotice("");
    setFinalTestQuestions([]);
  }

  // Stage3: コース全体の総合テスト問題を生成する。各Lessonのslides生成(STEP2)が完了した後に
  // 呼ぶ想定(lessonTitle/summary/goalを渡すため)。まだコースは未保存なので、各questionには
  // 一時的なlessonId(result.lessons[i].id)をlessonRefとして持たせ、保存時(saveGenerated)に
  // 実際のlessonIdへ対応付ける。
  async function generateFinalTest() {
    if (!result?.lessons?.length || finalTestState === "loading") return { ok: false };
    setFinalTestState("loading");
    setFinalTestNotice("");
    try {
      const data = await apiPost("/learning/admin/ai-lesson-designer/final-test/generate", {
        courseTitle: result.course.title || "",
        lessons: result.lessons.map(l => ({ lessonRef: l.id, title: l.title || "", summary: l.summary || "", goal: l.goal || "" })),
        questionCountHint: Math.min(8, Math.max(4, result.lessons.length)),
      });
      const questions = Array.isArray(data?.questions) ? data.questions : [];
      if (!questions.length) throw new Error("総合テスト問題が返りませんでした。");
      setFinalTestQuestions(questions);
      setFinalTestState("done");
      return { ok: true, count: questions.length };
    } catch (e) {
      const debug = [e?.errorCode, e?.errorMessage, e?.hint].filter(Boolean).join("\n");
      const msg = debug || e?.message || "総合テスト問題の生成に失敗しました。";
      setFinalTestNotice(msg);
      setFinalTestState("error");
      return { ok: false, error: msg };
    }
  }

  // STEP2: 1Lesson分のslidesをBedrockで生成し、result.lessons内の該当Lessonへ反映する。
  // まだDBには保存しない(コース自体が未保存のため)。失敗時は黙殺せずstatus="error"にする。
  async function generateLessonSlides(lessonId) {
    const lesson = result?.lessons.find(l => l.id === lessonId);
    if (!lesson) return { ok: false, error: "lesson not found" };
    setSlideGenByLessonId(prev => ({ ...prev, [lessonId]: { status: "loading", notice: "" } }));
    try {
      const data = await apiPost("/learning/admin/ai-lesson-designer/lessons/generate", {
        courseTitle: result.course.title || "",
        lessonTitle: lesson.title || "",
        lessonSummary: lesson.summary || "",
        lessonGoal: lesson.goal || "",
        teacherMemo: lesson.teacherMemo || "",
        difficulty: lesson.difficulty || "",
        estimatedMinutes: lesson.estimatedMinutes,
        // 2026-07-21 Phase3: 演習系kind(terminal/selection_task/ordering_puzzle/fill_blank)を
        // このLessonの生成に含めるかどうか。brief.exercisesEnabledで一括ON/OFFする。
        simulatedEnvEnabled: brief.exercisesEnabled !== false,
      });
      const slides = Array.isArray(data?.slides) ? data.slides.map((s, i) => ({ id: nextId("slide"), order: i, ...s })) : [];
      if (!slides.length) throw new Error("スライド候補が返りませんでした。");
      setResult(prev => ({
        ...prev,
        lessons: prev.lessons.map(l => (l.id === lessonId ? { ...l, slides } : l)),
      }));
      setSlideGenByLessonId(prev => ({ ...prev, [lessonId]: { status: "done", notice: "" } }));
      return { ok: true, slideCount: slides.length };
    } catch (e) {
      const debug = [e?.errorCode, e?.errorMessage, e?.hint].filter(Boolean).join("\n");
      const msg = debug || e?.message || "スライド生成に失敗しました。";
      setSlideGenByLessonId(prev => ({ ...prev, [lessonId]: { status: "error", notice: msg } }));
      return { ok: false, error: msg };
    }
  }

  // 生成結果(コース設計+Lesson構成+講師メモ)をそのまま下書きコースとして保存する。
  // 既存のcreateCourse/createLessonではなく、API呼び出し結果をawaitして失敗を黙殺しない
  // createCourseAwaitingApi/createLessonAwaitingApiに委譲する(useLearningAdmin.js参照)。
  // slidesは持たせない(このSTEPでは生成していないため)。estimatedMinutesは既存のduration
  // 文字列フィールドにマッピングする(Lesson側に分単位の数値フィールドが無いため)。
  // 公開(published)は行わず、管理画面での確認を前提とする。
  async function saveGenerated(learningAdmin) {
    if (!result) {
      setSaveState("error");
      setSaveNotice("保存する生成結果がありません。先にコースを設計してください。");
      return { ok: false, error: "no result" };
    }
    setSaveState("saving");
    setSaveNotice("");
    try {
      const course = await learningAdmin.createCourseAwaitingApi({
        title: result.course.title || "AI生成コース",
        category: "",
        color: PRODUCT_ACCENT.learning.accent,
        skillsText: "",
        lessons: result.lessons.length,
        duration: brief.duration || "",
        level: result.course.level || brief.difficulty,
        desc: result.course.desc || "",
        published: false,
      });
      // lessonRef(生成時の一時id、result.lessons[i].id)→実lessonIdの対応表。Stage3の総合テスト
      // 問題をLEARNING#QUIZ(type:"final")として保存する際、実際に保存されたlessonIdへ付け替える。
      const lessonIdByRef = {};
      for (let i = 0; i < result.lessons.length; i += 1) {
        const lesson = result.lessons[i];
        const savedLesson = await learningAdmin.createLessonAwaitingApi(course.id, {
          title: lesson.title || `レッスン${i + 1}`,
          type: "text",
          duration: lesson.estimatedMinutes ? `${lesson.estimatedMinutes}分` : "",
          summary: lesson.summary || "",
          pointsText: "",
          body: "",
          questionsText: "",
          goal: lesson.goal || "",
          teacherMemo: lesson.teacherMemo || "",
          slides: lesson.slides || [],
          published: false,
        });
        lessonIdByRef[lesson.id] = savedLesson?.id || null;
      }

      // Stage3: 生成済みの総合テスト問題があれば、実lessonIdへ対応付けてLEARNING#QUIZ
      // (type:"final"、既存のquiz-questions API・既存の総合テスト集計経路をそのまま使う)として
      // 保存する。1問でも失敗しても、コース/レッスン保存自体は既に完了しているため黙殺せず
      // 件数を記録するだけに留める(コース保存自体を失敗扱いにしない)。
      let savedFinalTestCount = 0;
      if (finalTestQuestions.length && lessonIdByRef && Object.values(lessonIdByRef).some(Boolean)) {
        const fallbackLessonId = Object.values(lessonIdByRef).find(Boolean);
        for (const q of finalTestQuestions) {
          const lessonId = lessonIdByRef[q.lessonRef] || fallbackLessonId;
          if (!lessonId) continue;
          try {
            await apiPost("/learning/admin/quiz-questions", {
              courseId: course.id,
              lessonId,
              type: "final",
              question: q.question,
              choices: q.choices,
              answer: q.answerIndex,
              explanation: q.explanation || "",
              published: true,
            });
            savedFinalTestCount += 1;
          } catch (e) {
            // 1問の保存失敗はコース保存全体を失敗にしない(管理画面の理解度・問題管理から後で追加できる)。
          }
        }
      }

      setSaveState("done");
      setSaveNotice(
        `「${course.title}」を下書きコースとして保存しました。${savedFinalTestCount ? `総合テスト問題${savedFinalTestCount}件も保存しました。` : ""}管理画面から確認・公開してください。`
      );
      return { ok: true, courseId: course.id, savedFinalTestCount };
    } catch (e) {
      setSaveState("error");
      const msg = [e?.errorMessage, e?.message].filter(Boolean).join(" / ");
      setSaveNotice(msg || "保存に失敗しました。管理画面で内容を確認してください。");
      return { ok: false, error: msg || String(e) };
    }
  }

  return {
    brief, setBriefField, genState, notice, result, generatedFor, generate, reset,
    saveState, saveNotice, saveGenerated,
    slideGenByLessonId, generateLessonSlides,
    finalTestState, finalTestNotice, finalTestQuestions, generateFinalTest,
  };
}
