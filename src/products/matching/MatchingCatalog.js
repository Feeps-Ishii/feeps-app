import { Activity, Briefcase, LayoutDashboard, MapPin, Sparkles } from "lucide-react";

export const MATCHING_NAV = [
  { sec: null, items: [["mt_home", "ホーム", LayoutDashboard]] },
  { sec: "案件管理", items: [
    ["mt_list",      "案件一覧",       Briefcase],
    ["mt_matching",  "案件マッチング", Sparkles],
    ["mt_placement", "現場参画状況",   MapPin],
    ["mt_history",   "参画履歴",       Activity],
  ]},
];

// ready=false のカードはProjects/Placementsテーブル追加後に対応（Phase5-5時点では準備中）
export const MATCHING_HOME_CARDS = {
  client: [
    { key: "mt_matching",  icon: Sparkles,  label: "案件マッチング", desc: "自社受講生の実スキルから案件候補を探します。", ready: true },
    { key: "mt_placement", icon: MapPin,    label: "現場参画状況",   desc: "自社社員・受講生の参画先と進捗を確認します。", ready: false },
    { key: "mt_history",   icon: Activity,  label: "参画履歴",       desc: "過去の現場参画履歴を確認できます。", ready: false },
    { key: "mt_list",      icon: Briefcase, label: "案件一覧",       desc: "登録されている案件を確認できます。", ready: false },
  ],
  admin: [
    { key: "mt_matching",  icon: Sparkles,  label: "案件マッチング", desc: "全受講生の実スキルから案件候補をマッチングします。", ready: true },
    { key: "mt_list",      icon: Briefcase, label: "案件一覧",       desc: "登録されている案件を一覧で確認できます。", ready: false },
    { key: "mt_placement", icon: MapPin,    label: "現場参画状況",   desc: "研修後の参画先と進捗を確認します。", ready: false },
    { key: "mt_history",   icon: Activity,  label: "参画履歴",       desc: "過去の現場参画履歴を確認できます。", ready: false },
  ],
};

export const SKILL_CAT = { Java: "言語", Spring: "フレームワーク", SQL: "言語", React: "フレームワーク", AWS: "ツール", Linux: "ツール", TypeScript: "言語" };

// 案件マスタはPhase5-5時点でProjectsテーブル未実装のため、実際の案件募集ではなく
// マッチ度算出のためのサンプル要件として扱う（画面上も「サンプル案件」と明示する）。
export const OPENINGS = [
  { id: "o1", name: "金融系Webシステム 改修", company: "大手SIer", industry: "金融", period: "2026/07〜2026/12", location: "東京（一部リモート）", headcount: 2,
    rate: "〜60万/月", phases: ["詳細設計", "製造", "結合試験"], req: [{ skill: "Java", level: 60 }, { skill: "Spring", level: 50 }, { skill: "SQL", level: 50 }] },
  { id: "o2", name: "自社SaaS フロント開発", company: "SaaSベンダー", industry: "IT", period: "2026/08〜長期", location: "フルリモート", headcount: 1,
    rate: "〜65万/月", phases: ["基本設計", "製造"], req: [{ skill: "React", level: 60 }, { skill: "Java", level: 45 }] },
  { id: "o3", name: "AWS基盤構築・運用支援", company: "クラウドSIer", industry: "インフラ", period: "2026/09〜2027/03", location: "東京（リモート可）", headcount: 1,
    rate: "〜70万/月", phases: ["要件定義", "基本設計", "運用保守"], req: [{ skill: "AWS", level: 55 }, { skill: "Linux", level: 50 }, { skill: "Java", level: 40 }] },
];
