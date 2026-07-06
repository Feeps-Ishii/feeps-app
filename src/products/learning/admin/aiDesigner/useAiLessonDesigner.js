import { useState } from "react";
import { apiPost } from "../../../../api.js";
import { PRODUCT_ACCENT } from "../../../../components/common";

// AI Lesson Designer STEP1(コース設計)用の軽量Hook。既存のuseAiCurriculumDesigner.jsとは異なり、
// 生成結果の確認・下書き保存のみが目的で、編集用のadd/update/delete関数は持たない。
// 保存(saveGenerated)は、既存のuseAiCurriculumDesigner.jsのsaveToLearningAdmin()と同じく
// useLearningAdmin.jsの既存createCourse/createLessonへ委譲するだけで、新しい保存の仕組みは作らない。
// このSTEPではslides/動画/terminal/quizは一切生成・保存しない(将来のLesson単位生成フェーズで扱う)。
const EMPTY_BRIEF = {
  audience: "",
  duration: "",
  difficulty: "初級",
  goals: "",
  techs: "",
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

  function setBriefField(key, value) {
    setBrief(prev => ({ ...prev, [key]: value }));
  }

  async function generate() {
    if (genState === "loading") return;
    setGenState("loading");
    setNotice("");
    setGeneratedFor({ ...brief });
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
      for (let i = 0; i < result.lessons.length; i += 1) {
        const lesson = result.lessons[i];
        await learningAdmin.createLessonAwaitingApi(course.id, {
          title: lesson.title || `レッスン${i + 1}`,
          type: "text",
          duration: lesson.estimatedMinutes ? `${lesson.estimatedMinutes}分` : "",
          summary: lesson.summary || "",
          pointsText: "",
          body: "",
          questionsText: "",
          goal: lesson.goal || "",
          teacherMemo: lesson.teacherMemo || "",
          published: false,
        });
      }
      setSaveState("done");
      setSaveNotice(`「${course.title}」を下書きコースとして保存しました。管理画面から確認・公開してください。`);
      return { ok: true, courseId: course.id };
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
  };
}
