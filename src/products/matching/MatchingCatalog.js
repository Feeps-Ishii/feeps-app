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

export const MATCHING_HOME_CARDS = {
  client: [
    { key: "mt_placement", icon: MapPin,    label: "現場参画状況",   desc: "自社社員・受講生の参画先と進捗を確認します。" },
    { key: "mt_matching",  icon: Sparkles,  label: "案件マッチング", desc: "スキルシートから最適な案件候補を探します。" },
    { key: "mt_history",   icon: Activity,  label: "参画履歴",       desc: "過去の現場参画履歴を確認できます。" },
    { key: "mt_list",      icon: Briefcase, label: "案件一覧",       desc: "登録されている案件を確認できます。" },
  ],
  admin: [
    { key: "mt_list",      icon: Briefcase, label: "案件一覧",       desc: "登録されている案件を一覧で確認できます。" },
    { key: "mt_matching",  icon: Sparkles,  label: "案件マッチング", desc: "スキルシートから最適な案件をマッチングします。" },
    { key: "mt_placement", icon: MapPin,    label: "現場参画状況",   desc: "研修後の参画先と進捗を確認します。" },
    { key: "mt_history",   icon: Activity,  label: "参画履歴",       desc: "過去の現場参画履歴を確認できます。" },
  ],
};

export const SKILL_CAT = { Java: "言語", Spring: "フレームワーク", SQL: "言語", React: "フレームワーク", AWS: "ツール", Linux: "ツール", TypeScript: "言語" };

export const ENGINEERS = [
  { id: "e1", name: "田中 翔太", age: 23, station: "大宮駅", title: "ジュニアエンジニア", exp: "0.5年", avail: "即日",
    skills: { Java: 70, Spring: 45, SQL: 55, React: 25, AWS: 40, Linux: 30 }, strengths: ["論理的思考", "キャッチアップが早い"], weak: ["設計経験が浅い"],
    projects: [{ id: "tp1", period: "2026/05〜06", name: "現場管理システム", role: "バックエンド", scale: "5名", phases: ["製造", "結合試験"], tech: ["Java", "Spring"], desc: "CRUD・認証・帳票出力を実装。" }] },
  { id: "e2", name: "佐藤 美咲", age: 25, station: "横浜駅", title: "バックエンドエンジニア", exp: "2年", avail: "2026/07〜",
    skills: { Java: 80, Spring: 70, SQL: 75, React: 40, AWS: 35, Linux: 50 }, strengths: ["API設計", "DB設計", "レビュー対応"], weak: ["フロント実装"],
    projects: [{ id: "tp2", period: "2025/04〜2026/03", name: "ECサイト基幹改修", role: "BEリーダー", scale: "8名", phases: ["基本設計", "詳細設計", "製造"], tech: ["Java", "Spring", "PostgreSQL"], desc: "受注・在庫APIの再設計と実装をリード。" }] },
  { id: "e3", name: "鈴木 大輔", age: 22, station: "北千住駅", title: "ジュニアエンジニア", exp: "0.5年", avail: "即日",
    skills: { Java: 55, Spring: 30, SQL: 45, React: 20, AWS: 25, Linux: 20 }, strengths: ["素直さ", "学習意欲"], weak: ["配列・反復", "テスト"],
    projects: [{ id: "tp3", period: "2026/05〜06", name: "社内勤怠ツール", role: "PG", scale: "3名", phases: ["製造"], tech: ["Java"], desc: "一覧・集計画面を実装。" }] },
  { id: "e4", name: "伊藤 彩花", age: 27, station: "品川駅", title: "フルスタックエンジニア", exp: "4年", avail: "2026/08〜",
    skills: { Java: 85, Spring: 75, SQL: 80, React: 65, AWS: 60, Linux: 55 }, strengths: ["要件定義", "フルスタック", "チームリード"], weak: ["大規模PM"],
    projects: [{ id: "tp4", period: "2024/01〜2025/12", name: "保険業務SaaS新規開発", role: "テックリード", scale: "12名", phases: ["要件定義", "基本設計", "製造", "総合試験"], tech: ["Java", "Spring", "React", "AWS"], desc: "新規プロダクトの設計・実装・チームリードを担当。" }] },
  { id: "e5", name: "渡辺 健", age: 24, station: "吉祥寺駅", title: "フロントエンドエンジニア", exp: "1.5年", avail: "即日",
    skills: { Java: 60, Spring: 40, SQL: 50, React: 70, AWS: 30, Linux: 35 }, strengths: ["UI実装", "React", "デザイン連携"], weak: ["インフラ"],
    projects: [{ id: "tp5", period: "2025/06〜2026/05", name: "メディアサイトSPA刷新", role: "フロント", scale: "6名", phases: ["詳細設計", "製造", "結合試験"], tech: ["React", "TypeScript"], desc: "SPA化とコンポーネント設計を担当。" }] },
];

export const OPENINGS = [
  { id: "o1", name: "金融系Webシステム 改修", company: "大手SIer", industry: "金融", period: "2026/07〜2026/12", location: "東京（一部リモート）", headcount: 2,
    rate: "〜60万/月", phases: ["詳細設計", "製造", "結合試験"], req: [{ skill: "Java", level: 60 }, { skill: "Spring", level: 50 }, { skill: "SQL", level: 50 }] },
  { id: "o2", name: "自社SaaS フロント開発", company: "SaaSベンダー", industry: "IT", period: "2026/08〜長期", location: "フルリモート", headcount: 1,
    rate: "〜65万/月", phases: ["基本設計", "製造"], req: [{ skill: "React", level: 60 }, { skill: "Java", level: 45 }] },
  { id: "o3", name: "AWS基盤構築・運用支援", company: "クラウドSIer", industry: "インフラ", period: "2026/09〜2027/03", location: "東京（リモート可）", headcount: 1,
    rate: "〜70万/月", phases: ["要件定義", "基本設計", "運用保守"], req: [{ skill: "AWS", level: 55 }, { skill: "Linux", level: 50 }, { skill: "Java", level: 40 }] },
];
