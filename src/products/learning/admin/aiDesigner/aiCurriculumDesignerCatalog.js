// Options specific to the AI Curriculum Designer input form.
// Course-level options (category/level) are intentionally imported from
// LearningAdminCatalog.js instead of being redefined here.

export const AUDIENCE_LEVEL_OPTIONS = ["新人", "若手", "中堅", "管理職"];

// 2026-07-21: Backend側(generateCurriculumWithBedrock)の実測(CloudWatch)に基づく安全上限に合わせ
// 8→5へ引き下げ。1回のBedrock呼び出しでcourse+lessons+materials+questions+finalTestを同時生成する
// ため、レッスン数が多いとLambda/API Gatewayの29s同期上限内に収まらないリスクがある。
export const MAX_LESSON_COUNT_HINT = 5;

export const EMPTY_DESIGNER_BRIEF = {
  courseTitle: "",
  targetAudience: "",
  level: "入門",
  purpose: "",
  estimatedHours: "",
  desiredSkills: "",
  audienceLevel: "新人",
  category: "プログラミング",
  notes: "",
};
