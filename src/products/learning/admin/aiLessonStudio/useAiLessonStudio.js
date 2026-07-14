import { useState } from "react";
import { apiPost } from "../../../../api.js";

// AI Lesson Studio Phase1(既存Lessonへの「AIでスライド作成」)用のHook。
// docs/specs/ai-lesson-studio-spec.md / docs/decisions/0006-ai-lesson-studio-kind-taxonomy.md
// Phase1範囲: 生成対象kindはconcept(TEXT)/compare/summary/quizの4種のみ。
// 図解/AI画像はこのPhaseではUI(トグル)のみで、生成内容には影響しない(次Phase以降で対応、
// モーダル側にその旨を明記する)。「疑似環境」トグルのみ2026-07-14 Phase3から実際に生成内容へ
// 反映される(selection_task/ordering_puzzle/fill_blank/interactive_formのいずれかを追加生成)。
// 保存はしない。生成結果は呼び出し側(2026-07-15〜 LessonSlideStudio)がslides配列へ追加する。

const EMPTY_SETTINGS = {
  level: "beginner", // beginner | practical | certification | manager | custom
  customLevelText: "",
  style: "balanced", // balanced | explanation | diagram | exercise | quiz
  diagramEnabled: true, // Phase1はUIのみ（生成内容に影響しない）
  exerciseVolume: "standard", // none | light | standard | heavy
  aiImageEnabled: false, // Phase1はUIのみ（次Phaseで画像生成）
  simulatedEnvEnabled: false, // 2026-07-14 Phase3から実際に効く（操作できる教材を2枚追加生成）
};

let idSeq = 0;
function nextId(prefix) {
  idSeq += 1;
  return `${prefix}-${Date.now()}-${idSeq}`;
}

// Backend(services/bedrock.mjs generateLessonStudioSlidesWithBedrock)のstudioSlideCountHint()
// と同じロジックの簡易版。生成前プレビューで「何枚生成されるか」の目安を示すためだけに使う
// (実際の生成結果はAIの裁量で多少前後する)。
function estimateSlideCounts({ style, exerciseVolume, simulatedEnvEnabled }) {
  let concept = 3;
  if (style === "explanation" || style === "diagram") concept += 1;
  if (style === "quiz") concept -= 1;
  concept = Math.max(2, Math.min(5, concept));

  const compare = 1;

  const exerciseBase = { none: 0, light: 1, standard: 2, heavy: 3 }[exerciseVolume] ?? 2;
  let quiz = exerciseBase + (style === "quiz" ? 1 : 0) + (style === "exercise" ? 1 : 0);
  quiz = Math.max(0, Math.min(4, quiz));

  const summary = 1;
  const interactive = simulatedEnvEnabled ? 2 : 0;
  return { concept, compare, quiz, interactive, summary, total: concept + compare + quiz + interactive + summary };
}

export function useAiLessonStudio() {
  const [settings, setSettings] = useState({ ...EMPTY_SETTINGS });
  const [genState, setGenState] = useState("idle"); // idle | loading | done | error
  const [notice, setNotice] = useState("");
  const [slides, setSlides] = useState([]); // 生成結果。各要素に selected フラグを持つ

  function setField(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  const counts = estimateSlideCounts(settings);
  const estimatedMinutes = Math.max(5, Math.round(counts.total * 2.5));

  function reset() {
    setSettings({ ...EMPTY_SETTINGS });
    setGenState("idle");
    setNotice("");
    setSlides([]);
  }

  async function generate({ course, lesson }) {
    if (genState === "loading" || !lesson) return;
    setGenState("loading");
    setNotice("");
    try {
      const data = await apiPost(`/learning/admin/ai-lesson-studio/lessons/${lesson.id}/generate`, {
        level: settings.level,
        customLevelText: settings.level === "custom" ? settings.customLevelText.trim() : "",
        style: settings.style,
        exerciseVolume: settings.exerciseVolume,
        diagramEnabled: settings.diagramEnabled,
        aiImageEnabled: settings.aiImageEnabled,
        simulatedEnvEnabled: settings.simulatedEnvEnabled,
      });
      const generated = Array.isArray(data?.slides) ? data.slides.map((s, i) => ({
        id: nextId("slide-studio"),
        order: i,
        selected: true,
        ...s,
      })) : [];
      if (!generated.length) throw new Error("スライド候補が返りませんでした。");
      setSlides(generated);
      setGenState("done");
    } catch (e) {
      const debug = [e?.errorCode, e?.errorMessage, e?.hint].filter(Boolean).join("\n");
      setNotice(debug || e?.message || "AI生成に失敗しました。入力内容を調整して再試行してください。");
      setGenState("error");
    }
  }

  function toggleSlideSelected(id) {
    setSlides(prev => prev.map(s => (s.id === id ? { ...s, selected: !s.selected } : s)));
  }

  function selectAll(value) {
    setSlides(prev => prev.map(s => ({ ...s, selected: value })));
  }

  return {
    settings, setField,
    counts, estimatedMinutes,
    genState, notice, slides,
    generate, reset, toggleSlideSelected, selectAll,
  };
}
