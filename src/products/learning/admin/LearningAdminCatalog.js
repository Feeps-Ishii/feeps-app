export const LEARNING_ADMIN_STORAGE_KEY = "feeps.el.admin.courses";
export const LEARNING_ADMIN_DELETED_COURSES_STORAGE_KEY = "feeps.el.admin.courses.deleted";
export const LEARNING_ADMIN_LESSONS_STORAGE_KEY = "feeps.el.admin.lessons";

export const COURSE_CATEGORY_OPTIONS = [
  "プログラミング",
  "クラウド",
  "フロントエンド",
  "ビジネス",
  "AI",
  "ツール",
  "データベース",
];

export const COURSE_LEVEL_OPTIONS = ["入門", "初級", "中級", "上級"];

export const COURSE_COLOR_OPTIONS = [
  "#16A34A",
  "#059669",
  "#0891B2",
  "#2563EB",
  "#7C3AED",
  "#D97706",
  "#DC2626",
  "#374151",
];

export const EMPTY_COURSE_FORM = {
  title: "",
  category: "プログラミング",
  level: "入門",
  duration: "3",
  desc: "",
  skillsText: "",
  color: "#16A34A",
  published: false,
  // 可視範囲制御（企業単位、2026-07-21追加）: "all"=全体公開 / "companies"=targetCompanyIdsのみ。
  visibilityScope: "all",
  targetCompanyIds: [],
};

export const COURSE_VISIBILITY_SCOPE_OPTIONS = [
  { value: "all", label: "全体公開" },
  { value: "companies", label: "特定企業のみ" },
];

export const LESSON_TYPE_OPTIONS = [
  { value: "video", label: "Video" },
  { value: "text", label: "Text" },
  { value: "quiz", label: "Quiz" },
];

export const EMPTY_LESSON_FORM = {
  title: "",
  type: "video",
  summary: "",
  duration: "10分",
  pointsText: "",
  body: "",
  questionsText: "",
  published: false,
};

export const LEARNING_ADMIN_MATERIALS_STORAGE_KEY = "feeps.el.admin.materials";

export const MATERIAL_TYPE_OPTIONS = [
  { value: "video", label: "Video" },
  { value: "pdf", label: "PDF" },
  { value: "slide", label: "Slide" },
  { value: "text", label: "Text" },
  { value: "link", label: "Link" },
  { value: "file", label: "File" },
];

export const EMPTY_MATERIAL_FORM = {
  courseId: "",
  lessonId: "",
  type: "pdf",
  title: "",
  description: "",
  url: "",
  duration: "10",
  order: "1",
  tagsText: "",
  status: "draft",
  memo: "",
};

export const LEARNING_ADMIN_ENROLLMENTS_STORAGE_KEY = "feeps.el.admin.enrollments";

export const ENROLLMENT_STATUS_OPTIONS = [
  { value: "not_started", label: "未着手" },
  { value: "in_progress", label: "学習中" },
  { value: "completed", label: "修了" },
  // 2026-07-21フェーズ4: COURSE_PROGRESS#がまだ無いが演習提出だけはある受講生(合成行、
  // useLearningAdminのenrollments effect参照)。
  { value: "exercise_only", label: "演習のみ（進捗未保存）" },
];

export const LEARNING_ADMIN_QUIZZES_STORAGE_KEY = "feeps.el.admin.quizzes";
export const LEARNING_LESSON_REVIEW_STORAGE_KEY = "feeps.el.lesson.review";
export const LEARNING_FINAL_TEST_SETTINGS_STORAGE_KEY = "feeps.el.admin.finalTestSettings";

export const QUIZ_TYPE_OPTIONS = [
  { value: "lesson", label: "レッスン確認問題" },
  { value: "review", label: "復習問題" },
  { value: "final", label: "総合確認問題" },
  { value: "ai_final", label: "AI総合問題" },
];

export const QUIZ_DIFFICULTY_OPTIONS = ["入門", "標準", "応用"];

export const EMPTY_QUIZ_FORM = {
  courseId: "",
  lessonId: "",
  type: "lesson",
  question: "",
  choice1: "",
  choice2: "",
  choice3: "",
  choice4: "",
  answer: "1",
  explanation: "",
  difficulty: "標準",
  tagsText: "",
  skill: "",
  pageId: "",
  chapterId: "",
  points: "10",
  published: false,
};

export const EMPTY_REVIEW_FORM = {
  lessonId: "",
  pageId: "page-1",
  status: "understood",
  understood: true,
  reviewLater: false,
  reviewed: false,
};

export const DEFAULT_FINAL_TEST_SETTINGS = {
  weakFocusRate: 70,
  coverageRate: 30,
  questionCount: 20,
  minLessonCount: 5,
  aiFinalEnabled: false,
};
