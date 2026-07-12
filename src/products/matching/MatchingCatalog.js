import { Activity, Briefcase, LayoutDashboard, MapPin, Sparkles, Users } from "lucide-react";

// サイドナビはロール別。admin/clientは案件管理者向け、instructorは担当受講生の参画確認のみ、
// traineeは自分向けのおすすめ・参画状況のみを表示する（Backend権限と対応させる）。
export const MATCHING_NAV = {
  admin: [
    { sec: null, items: [["mt_home", "ホーム", LayoutDashboard]] },
    { sec: "案件管理", items: [
      ["mt_list",      "案件一覧",       Briefcase],
      ["mt_matching",  "候補者マッチング", Sparkles],
      ["mt_placement", "参画状況",       MapPin],
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
  instructor: [
    { sec: null, items: [["mt_home", "ホーム", LayoutDashboard]] },
    { sec: "案件管理", items: [["mt_placement", "担当受講生の参画状況", Users]] },
  ],
  trainee: [
    { sec: null, items: [["mt_home", "ホーム", LayoutDashboard]] },
    { sec: "案件管理", items: [["mt_placement", "おすすめ・参画状況", Activity]] },
  ],
};

export const MATCHING_HOME_CARDS = {
  admin: [
    { key: "mt_list",      icon: Briefcase, label: "案件一覧",         desc: "登録されている案件を作成・編集・管理します。" },
    { key: "mt_matching",  icon: Sparkles,  label: "候補者マッチング", desc: "全受講生の実スキルから案件候補をマッチングします。" },
    { key: "mt_placement", icon: MapPin,    label: "参画状況",         desc: "参画中・参画履歴を横断で管理します。" },
  ],
  client: [
    { key: "mt_list",      icon: Briefcase, label: "自社案件",         desc: "自社に紐づく案件を確認します。" },
    { key: "mt_matching",  icon: Sparkles,  label: "候補者マッチング", desc: "自社受講生の実スキルから案件候補を探します。" },
    { key: "mt_placement", icon: MapPin,    label: "自社参画状況",     desc: "自社人材の参画先と進捗を確認します。" },
  ],
  instructor: [
    { key: "mt_placement", icon: Users,     label: "担当受講生の参画状況", desc: "担当受講生の案件参画結果を確認します（閲覧のみ）。" },
  ],
  trainee: [
    { key: "mt_placement", icon: Activity,  label: "おすすめ案件・参画状況", desc: "自分に合う案件候補と、現在の参画状況・履歴を確認します。" },
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
