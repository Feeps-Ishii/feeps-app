import { Activity, Briefcase, LayoutDashboard, MapPin, Sparkles } from "lucide-react";

// サイドナビはロール別。clientが自社案件・参画の運用所有者、adminは監査閲覧のみ、
// traineeは本人向けのおすすめ・参画状況のみ。instructorはProduct/APIとも利用不可。
export const MATCHING_NAV = {
  admin: [
    { sec: null, items: [["mt_home", "ホーム", LayoutDashboard]] },
    { sec: "運用監査", items: [
      ["mt_list",      "案件監査", Briefcase],
      ["mt_placement", "参画監査", MapPin],
    ]},
  ],
  client: [
    { sec: null, items: [["mt_home", "ホーム", LayoutDashboard]] },
    { sec: "案件管理", items: [
      ["mt_list",      "自社案件",       Briefcase],
      ["mt_matching",  "候補者マッチング", Sparkles],
      ["mt_placement", "自社参画状況",   MapPin],
    ]},
  ],
  trainee: [
    { sec: null, items: [["mt_home", "ホーム", LayoutDashboard]] },
    { sec: "案件管理", items: [["mt_placement", "おすすめ・参画状況", Activity]] },
  ],
};

export const MATCHING_HOME_CARDS = {
  admin: [
    { key: "mt_list",      icon: Briefcase, label: "案件監査", desc: "企業ごとの登録状況と公開状態を読み取り専用で確認します。" },
    { key: "mt_placement", icon: MapPin,    label: "参画監査", desc: "参画ステータスと更新状況を読み取り専用で確認します。" },
  ],
  client: [
    { key: "mt_list",      icon: Briefcase, label: "自社案件",         desc: "自社案件を登録し、募集状態と条件を管理します。" },
    { key: "mt_matching",  icon: Sparkles,  label: "候補者マッチング", desc: "自社社員の実スキルから案件候補を選定します。" },
    { key: "mt_placement", icon: MapPin,    label: "自社参画状況",     desc: "自社社員との面談・参画ステータスを管理します。" },
  ],
  trainee: [
    { key: "mt_placement", icon: Activity,  label: "あなた向け案件・参画状況", desc: "所属企業から案内された案件候補と、現在の参画状況・履歴を確認します。" },
  ],
};

export const PROJECT_STATUS_OPTIONS = [
  { value: "draft", label: "下書き" },
  { value: "published", label: "公開準備" },
  { value: "recruiting", label: "募集中" },
  { value: "closed", label: "募集終了" },
  { value: "archived", label: "アーカイブ" },
];

export const PROJECT_VISIBILITY_OPTIONS = [
  { value: "internal", label: "社内限定" },
  { value: "client", label: "自社限定" },
  { value: "public", label: "公開" },
];

export const WORK_STYLE_OPTIONS = [
  { value: "", label: "未設定" },
  { value: "onsite", label: "常駐" },
  { value: "remote", label: "リモート" },
  { value: "hybrid", label: "ハイブリッド" },
];

export const PLACEMENT_STATUS_OPTIONS = [
  { value: "proposed", label: "提案中" },
  { value: "interviewing", label: "面談調整中" },
  { value: "accepted", label: "内定・合意済み" },
  { value: "active", label: "参画中" },
  { value: "completed", label: "完了" },
  { value: "declined", label: "見送り" },
  { value: "cancelled", label: "中止" },
  { value: "withdrawn", label: "辞退" },
];

export function projectStatusLabel(status) {
  return PROJECT_STATUS_OPTIONS.find(o => o.value === status)?.label || status || "";
}
export function projectVisibilityLabel(visibility) {
  return PROJECT_VISIBILITY_OPTIONS.find(o => o.value === visibility)?.label || visibility || "";
}
export function workStyleLabel(workStyle) {
  return WORK_STYLE_OPTIONS.find(o => o.value === workStyle)?.label || workStyle || "";
}
export function placementStatusLabel(status) {
  return PLACEMENT_STATUS_OPTIONS.find(o => o.value === status)?.label || status || "";
}

export const EMPTY_PROJECT_FORM = {
  companyId: "",
  title: "",
  description: "",
  status: "draft",
  visibility: "public",
  requiredSkillsText: "",
  preferredSkillsText: "",
  requiredQualificationsText: "",
  preferredQualificationsText: "",
  requiredExperience: "",
  location: "",
  workStyle: "",
  budgetMin: "",
  budgetMax: "",
  periodStart: "",
  periodEnd: "",
  openings: "1",
  tagsText: "",
  notes: "",
};
