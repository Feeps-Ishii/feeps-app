import { useState } from "react";
import { apiPost } from "../../../../api.js";
import { EMPTY_DESIGNER_BRIEF, MAX_LESSON_COUNT_HINT } from "./aiCurriculumDesignerCatalog.js";

let idSeq = 0;
function nextId(prefix) {
  idSeq += 1;
  return `${prefix}-${Date.now()}-${idSeq}`;
}

function emptyQuestion() {
  return { _id: nextId("q"), question: "", choices: ["", "", "", ""], correctIndex: 0, explanation: "" };
}

function emptyMaterial() {
  return { _id: nextId("mat"), type: "text", title: "", description: "", url: "" };
}

function emptyLesson() {
  return {
    _id: nextId("lesson"),
    title: "",
    summary: "",
    learningGoals: [],
    points: [],
    estimatedMinutes: 30,
    materials: [],
    questions: [],
  };
}

function tagLesson(lesson) {
  return {
    _id: nextId("lesson"),
    title: lesson.title || "",
    summary: lesson.summary || "",
    learningGoals: Array.isArray(lesson.learningGoals) ? lesson.learningGoals : [],
    points: Array.isArray(lesson.points) ? lesson.points : [],
    estimatedMinutes: Number(lesson.estimatedMinutes || 30),
    materials: (lesson.materials || []).map(m => ({ _id: nextId("mat"), type: m.type || "text", title: m.title || "", description: m.description || "", url: m.url || "" })),
    questions: (lesson.questions || []).map(q => ({ _id: nextId("q"), question: q.question || "", choices: (q.choices && q.choices.length ? q.choices : ["", "", "", ""]).slice(0, 4), correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0, explanation: q.explanation || "" })),
  };
}

// Central hook for the AI Curriculum Designer: holds the input brief, drives the
// Bedrock "generate draft" call, and owns the editable tree (course/lessons/materials/
// questions/finalTest) shown in the preview before saving. Kept separate from
// useLearningAdmin.js so the designer's generation/editing concerns don't grow that
// file further; saving still delegates entirely to useLearningAdmin's existing
// create* functions (see AiCurriculumDesignerModal.jsx).
export function useAiCurriculumDesigner() {
  const [brief, setBrief] = useState({ ...EMPTY_DESIGNER_BRIEF });
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const [tree, setTree] = useState(null); // null until first successful generation

  function setBriefField(key, value) {
    setBrief(prev => ({ ...prev, [key]: value }));
  }

  async function generate() {
    if (generating) return;
    if (!brief.courseTitle.trim()) {
      setNotice("コースタイトルを入力してください。");
      return;
    }
    setGenerating(true);
    setNotice("");
    try {
      const estimatedHoursNum = Number(brief.estimatedHours);
      const lessonCountHint = Number.isFinite(estimatedHoursNum) && estimatedHoursNum > 0
        ? Math.max(1, Math.min(MAX_LESSON_COUNT_HINT, Math.round(estimatedHoursNum)))
        : undefined;
      const data = await apiPost("/learning/admin/ai-curriculum/generate", {
        courseTitle: brief.courseTitle.trim(),
        targetAudience: brief.targetAudience.trim(),
        level: brief.level,
        purpose: brief.purpose.trim(),
        estimatedHours: brief.estimatedHours.trim(),
        desiredSkills: brief.desiredSkills.trim(),
        audienceLevel: brief.audienceLevel,
        category: brief.category,
        notes: brief.notes.trim(),
        lessonCountHint,
      });
      const lessons = Array.isArray(data?.lessons) ? data.lessons.map(tagLesson) : [];
      if (!lessons.length) throw new Error("レッスン候補が返りませんでした。");
      setTree({
        course: {
          title: data?.course?.title || brief.courseTitle,
          category: data?.course?.category || brief.category,
          level: data?.course?.level || brief.level,
          duration: data?.course?.duration || brief.estimatedHours,
          desc: data?.course?.desc || "",
          skills: Array.isArray(data?.course?.skills) ? data.course.skills : [],
        },
        lessons,
        finalTest: {
          questions: Array.isArray(data?.finalTest?.questions)
            ? data.finalTest.questions.map(q => ({ _id: nextId("q"), question: q.question || "", choices: (q.choices && q.choices.length ? q.choices : ["", "", "", ""]).slice(0, 4), correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0, explanation: q.explanation || "" }))
            : [],
        },
      });
      setNotice("AIが叩き台を作成しました。内容を確認・編集してから保存してください。");
    } catch (e) {
      const debug = [e?.errorCode, e?.errorMessage, e?.hint].filter(Boolean).join("\n");
      setNotice(debug || "AI生成に失敗しました。入力内容を調整して再試行してください。");
    } finally {
      setGenerating(false);
    }
  }

  function updateCourseField(key, value) {
    setTree(prev => (prev ? { ...prev, course: { ...prev.course, [key]: value } } : prev));
  }

  function updateLessonField(lessonId, key, value) {
    setTree(prev => (prev ? { ...prev, lessons: prev.lessons.map(l => (l._id === lessonId ? { ...l, [key]: value } : l)) } : prev));
  }

  function addLesson() {
    setTree(prev => (prev ? { ...prev, lessons: [...prev.lessons, emptyLesson()] } : prev));
  }

  function deleteLesson(lessonId) {
    setTree(prev => (prev ? { ...prev, lessons: prev.lessons.filter(l => l._id !== lessonId) } : prev));
  }

  function addMaterial(lessonId) {
    setTree(prev => (prev ? { ...prev, lessons: prev.lessons.map(l => (l._id === lessonId ? { ...l, materials: [...l.materials, emptyMaterial()] } : l)) } : prev));
  }

  function updateMaterial(lessonId, materialId, key, value) {
    setTree(prev => (prev ? {
      ...prev,
      lessons: prev.lessons.map(l => (l._id !== lessonId ? l : {
        ...l,
        materials: l.materials.map(m => (m._id === materialId ? { ...m, [key]: value } : m)),
      })),
    } : prev));
  }

  function deleteMaterial(lessonId, materialId) {
    setTree(prev => (prev ? {
      ...prev,
      lessons: prev.lessons.map(l => (l._id !== lessonId ? l : { ...l, materials: l.materials.filter(m => m._id !== materialId) })),
    } : prev));
  }

  function addLessonQuestion(lessonId) {
    setTree(prev => (prev ? { ...prev, lessons: prev.lessons.map(l => (l._id === lessonId ? { ...l, questions: [...l.questions, emptyQuestion()] } : l)) } : prev));
  }

  function updateLessonQuestion(lessonId, questionId, key, value) {
    setTree(prev => (prev ? {
      ...prev,
      lessons: prev.lessons.map(l => (l._id !== lessonId ? l : {
        ...l,
        questions: l.questions.map(q => (q._id === questionId ? { ...q, [key]: value } : q)),
      })),
    } : prev));
  }

  function updateLessonQuestionChoice(lessonId, questionId, choiceIndex, value) {
    setTree(prev => (prev ? {
      ...prev,
      lessons: prev.lessons.map(l => (l._id !== lessonId ? l : {
        ...l,
        questions: l.questions.map(q => (q._id !== questionId ? q : { ...q, choices: q.choices.map((c, i) => (i === choiceIndex ? value : c)) })),
      })),
    } : prev));
  }

  function deleteLessonQuestion(lessonId, questionId) {
    setTree(prev => (prev ? {
      ...prev,
      lessons: prev.lessons.map(l => (l._id !== lessonId ? l : { ...l, questions: l.questions.filter(q => q._id !== questionId) })),
    } : prev));
  }

  function addFinalQuestion() {
    setTree(prev => (prev ? { ...prev, finalTest: { questions: [...prev.finalTest.questions, emptyQuestion()] } } : prev));
  }

  function updateFinalQuestion(questionId, key, value) {
    setTree(prev => (prev ? { ...prev, finalTest: { questions: prev.finalTest.questions.map(q => (q._id === questionId ? { ...q, [key]: value } : q)) } } : prev));
  }

  function updateFinalQuestionChoice(questionId, choiceIndex, value) {
    setTree(prev => (prev ? {
      ...prev,
      finalTest: { questions: prev.finalTest.questions.map(q => (q._id !== questionId ? q : { ...q, choices: q.choices.map((c, i) => (i === choiceIndex ? value : c)) })) },
    } : prev));
  }

  function deleteFinalQuestion(questionId) {
    setTree(prev => (prev ? { ...prev, finalTest: { questions: prev.finalTest.questions.filter(q => q._id !== questionId) } } : prev));
  }

  function reset() {
    setTree(null);
    setNotice("");
    setBrief({ ...EMPTY_DESIGNER_BRIEF });
  }

  // Reflects the reviewed/edited tree into the existing admin data via useLearningAdmin's
  // own create* functions (API-first with localStorage fallback, unchanged). Returns
  // { ok, error }; on failure nothing generated so far is lost — the tree stays as-is
  // so the admin can retry.
  function saveToLearningAdmin(learningAdmin) {
    if (!tree) return { ok: false, error: "生成された内容がありません。" };
    try {
      const course = learningAdmin.createCourse({
        title: tree.course.title || brief.courseTitle,
        category: tree.course.category || brief.category,
        level: tree.course.level || brief.level,
        duration: String(tree.course.duration || brief.estimatedHours || ""),
        desc: tree.course.desc || "",
        skillsText: (tree.course.skills || []).join(", "),
        color: "#16A34A",
        published: false,
      });
      tree.lessons.forEach(lesson => {
        const savedLesson = learningAdmin.createLesson(course.id, {
          title: lesson.title || "無題のレッスン",
          type: "text",
          summary: lesson.summary || "",
          duration: `${Number(lesson.estimatedMinutes || 30)}分`,
          pointsText: (lesson.points || []).join("\n"),
          body: (lesson.learningGoals || []).length ? `学習目標:\n${lesson.learningGoals.join("\n")}` : "",
          questionsText: "",
          published: false,
        });
        lesson.materials.forEach(material => {
          if (!material.title.trim()) return;
          learningAdmin.createMaterial({
            courseId: course.id,
            lessonId: savedLesson.id,
            type: material.type || "text",
            title: material.title,
            description: material.description || "",
            url: material.url || "",
            duration: "0",
            order: "1",
            tagsText: "",
            status: "draft",
            memo: "AI研修デザイナーによる叩き台",
          });
        });
        lesson.questions.forEach(question => {
          if (!question.question.trim()) return;
          learningAdmin.createQuizQuestion({
            courseId: course.id,
            lessonId: savedLesson.id,
            type: "lesson",
            question: question.question,
            choice1: question.choices[0] || "",
            choice2: question.choices[1] || "",
            choice3: question.choices[2] || "",
            choice4: question.choices[3] || "",
            answer: String((question.correctIndex || 0) + 1),
            explanation: question.explanation || "",
            difficulty: "標準",
            tagsText: "",
            skill: "",
            pageId: "",
            chapterId: "",
            points: "10",
            published: false,
          });
        });
      });
      tree.finalTest.questions.forEach(question => {
        if (!question.question.trim()) return;
        learningAdmin.createQuizQuestion({
          courseId: course.id,
          lessonId: "",
          type: "final",
          question: question.question,
          choice1: question.choices[0] || "",
          choice2: question.choices[1] || "",
          choice3: question.choices[2] || "",
          choice4: question.choices[3] || "",
          answer: String((question.correctIndex || 0) + 1),
          explanation: question.explanation || "",
          difficulty: "標準",
          tagsText: "",
          skill: "",
          pageId: "",
          chapterId: "",
          points: "10",
          published: false,
        });
      });
      return { ok: true, courseId: course.id };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  return {
    brief, setBriefField, generating, notice, setNotice, tree,
    generate, reset,
    updateCourseField,
    updateLessonField, addLesson, deleteLesson,
    addMaterial, updateMaterial, deleteMaterial,
    addLessonQuestion, updateLessonQuestion, updateLessonQuestionChoice, deleteLessonQuestion,
    addFinalQuestion, updateFinalQuestion, updateFinalQuestionChoice, deleteFinalQuestion,
    saveToLearningAdmin,
  };
}
