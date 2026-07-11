import { LayoutDashboard, GitBranch, GraduationCap, Briefcase, FileText, Award, Star } from "lucide-react";
const PHASES = ["要件定義", "基本設計", "詳細設計", "製造", "結合試験", "総合試験", "運用保守"];
/* リスク分析：各シグナルは懸念度（高いほど要注意 0-100） */
const TALENT_NAV_ITEMS = [
  { sec: null, items: [["tl_home", "ホーム", LayoutDashboard]] },
  { sec: "スキル・成長", items: [
    ["tl_growth",  "成長履歴",          GitBranch],
    ["tl_skills",  "研修スキル",        GraduationCap],
    ["tl_sheet",   "案件用スキルシート", Briefcase],
    ["tl_works",   "制作実績",          FileText],
    ["tl_badge",   "資格・バッジ",      Award],
    ["tl_pr",      "自己PR・強み",      Star],
  ]},
];
// 非traineeは受講生横断のスキルシート確認のみ（成長履歴/制作実績/資格/自己PRは本人用ビューのため表示しない）
const TALENT_NAV_STAFF = [
  { sec: null, items: [["tl_home", "ホーム", LayoutDashboard]] },
  { sec: "スキル・成長", items: [["tl_sheet", "受講生スキルシート", Briefcase]] },
];
const TALENT_NAV = {
  trainee:    TALENT_NAV_ITEMS,
  instructor: TALENT_NAV_STAFF,
  client:     TALENT_NAV_STAFF,
  admin:      TALENT_NAV_STAFF,
};

export { PHASES, TALENT_NAV };
