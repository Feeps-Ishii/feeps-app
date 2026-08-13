// モード分離モック専用のダミーデータ。実データ・実APIには一切触れない。
// 表示専用の固定値。

export const TEAM_MEMBERS = [
  { name: "田中さん", role: "フロントエンド担当", filled: true },
  { name: "石井さん（自分）", role: "バックエンド担当", filled: true },
  { name: "佐藤さん", role: "インフラ担当", filled: true },
  { name: "募集中", role: "テスト担当を1名募集しています", filled: false },
];

export const PROJECT_STEPS = [
  { n: 1, title: "要件を受け取る", desc: "顧客役から要望をヒアリングします。", state: "done" },
  { n: 2, title: "設計する", desc: "チームで構成を決め、担当を分けます。", state: "active" },
  { n: 3, title: "実装する", desc: "DevLab上で各自の担当分を作ります。", state: "locked" },
  { n: 4, title: "レビューを受ける", desc: "AIレビューと社内レビュー担当者、両方から指摘をもらいます。", state: "locked" },
  { n: 5, title: "成果を残す", desc: "制作実績としてスキル・成長に記録されます。", state: "locked" },
];

export const REVIEW_OPTIONS = [
  { key: "ai", label: "AIレビュー", desc: "提出するとすぐに指摘が返ります。何度でも試せます。" },
  { key: "staff", label: "社内レビュー担当者", desc: "実務者の目線で、提出内容にコメントが付きます。" },
];

export const PLAN_ROWS = [
  { label: "コース受講・理解度テスト", basic: "yes", standard: "yes", premium: "yes" },
  { label: "開発演習（DevLab）", basic: "trial", standard: "yes", premium: "yes" },
  { label: "案件参画体験（チーム）", basic: "no", standard: "yes", premium: "yes" },
  { label: "学習履歴・獲得スキル", basic: "yes", standard: "yes", premium: "yes" },
  { label: "AI採点・フィードバック", basic: "no", standard: "yes", premium: "yes" },
  { label: "案件管理", basic: "no", standard: "yes", premium: "yes" },
  { label: "AIコース・問題生成", basic: "no", standard: "no", premium: "yes" },
];

export const COURSE_VISIBILITY_ROWS = [
  { course: "AWS基礎", plans: ["Basic", "Standard", "Premium"], companies: "全社共通" },
  { course: "Java入門", plans: ["Standard", "Premium"], companies: "全社共通" },
  { course: "チームリーダー研修", plans: ["Premium"], companies: "株式会社アクシス限定" },
  { course: "社内セキュリティ基礎", plans: ["Basic", "Standard", "Premium"], companies: "株式会社アクシス限定" },
];
