import { LayoutDashboard, GitBranch, GraduationCap, Briefcase, FileText, Award, Star, Wrench, Users, Sparkles, Compass, Settings, BookOpen, Building2 } from "lucide-react";
const COURSE = "アクシス Javaエンジニア育成コース";
const PERIOD = "2026/04/01〜06/12（49日間）";
const ROLES = {
  trainee: { key: "trainee", label: "受講生", who: "田中 翔太", org: "株式会社アクシス", icon: GraduationCap, mail: "tanaka@axis.co.jp" },
  instructor: { key: "instructor", label: "講師", who: "石井 啓輔", org: "株式会社Feeps", icon: BookOpen, mail: "ishii@feeps.co.jp" },
  client: { key: "client", label: "企業担当者", who: "高橋 由美", org: "株式会社アクシス", icon: Building2, mail: "takahashi@axis.co.jp" },
  admin: { key: "admin", label: "管理者", who: "寺田 正哉", org: "株式会社Feeps", icon: Settings, mail: "admin@feeps.co.jp" },
};
const CURRICULUM = [
  { unit: "ビジネスマナー", range: "Day 1–2 ・ 4/1–4/2", status: "done", topics: ["言葉遣い", "挨拶・態度", "身だしなみ・電話対応", "顧客・クレーム対応", "コミュニケーション"] },
  { unit: "ビジネススキル・目標設定", range: "Day 3 ・ 4/3", status: "done", topics: ["ビジネススキル", "目標設定"] },
  { unit: "IT基礎", range: "Day 4 ・ 4/6", status: "done", topics: ["ハードウェア", "ソフトウェア", "最新技術動向"] },
  { unit: "生成AI基礎", range: "Day 5 ・ 4/7", status: "done", topics: ["生成AIとは", "生成AI体験", "AI活用ワークショップ"] },
  { unit: "クラウド基礎（AWS）", range: "Day 6–9 ・ 4/8–4/13", status: "done", topics: ["AWS概要・VPC", "EC2・RDS・S3", "可用性アーキテクチャ", "マイクロサービス・Docker", "サーバレス"] },
  { unit: "HTML / CSS", range: "Day 10 ・ 4/14", status: "done", topics: ["HTML基礎", "CSS基礎", "レイアウト"] },
  { unit: "Java", range: "Day 11–22 ・ 4/15–5/1", status: "current", topics: ["基本文法", "変数・式・演算子・配列", "条件分岐・反復", "メソッド・オブジェクト指向", "クラスの詳細・継承", "インターフェース・ポリモーフィズム", "コレクション・例外処理"] },
  { unit: "Spring", range: "Day 23–24 ・ 5/7–5/8", status: "upcoming", topics: ["Spring基礎・MVC", "画面遷移・スコープ", "入力チェック・DI/AOP"] },
  { unit: "SQL / JPA", range: "Day 24–26 ・ 5/8–5/12", status: "upcoming", topics: ["SQL基礎・SELECT", "関数・集計・結合", "JPA・CRUD操作"] },
  { unit: "小規模開発演習（Spring）", range: "Day 26–27 ・ 5/12–5/13", status: "upcoming", topics: ["演習課題"] },
  { unit: "JavaScript / TypeScript / React", range: "Day 28–31 ・ 5/14–5/19", status: "upcoming", topics: ["JS / TS基礎", "REST・React基礎", "CRUD操作", "テスト・デプロイ", "ミニアプリ作成"] },
  { unit: "上流工程基礎", range: "Day 32–34 ・ 5/20–5/22", status: "upcoming", topics: ["開発プロセス・PM基礎", "要求分析・要件定義", "外部 / 内部設計"] },
  { unit: "チーム開発演習", range: "Day 34–49 ・ 5/22–6/12", status: "upcoming", topics: ["設計", "製造", "結合試験", "プレゼン資料作成", "成果報告会"] },
];
const PORTFOLIO_SKILLS = [
  { name: "TOEIC 720", cat: "資格", level: 72 },
  { name: "Python", cat: "言語", level: 60 },
  { name: "簿記3級", cat: "資格", level: 100 },
  { name: "Excel / 関数", cat: "ツール", level: 80 },
];
/* エンジニア（社員）スキルシート用 */
const ENGINEER = { name: "田中 翔太", age: 23, station: "大宮駅（JR）", title: "ジュニアエンジニア", exp: "0.5年（研修含む）" };
const PROJECTS_SEED = [
  { id: "p1", period: "2026/05〜2026/06", name: "チーム開発演習：現場管理システム", role: "バックエンド", scale: "5名",
    tech: ["Java", "Spring", "MySQL"], phases: ["基本設計", "詳細設計", "製造", "結合試験"],
    desc: "建設現場の進捗・人員管理システムを開発。担当機能の画面設計〜実装、結合試験を担当。CRUD・認証・帳票出力を実装。" },
];
const PHASES = ["要件定義", "基本設計", "詳細設計", "製造", "結合試験", "総合試験", "運用保守"];
const STRENGTHS_SEED = ["論理的思考", "キャッチアップが早い", "丁寧なコミット"];
const WEAK_SEED = ["設計経験が浅い", "テスト自動化"];
const NEXT_SKILLS = [
  { name: "Spring Boot 実務", why: "Java基礎は習得済み。実務レベルのDI/AOP・REST設計へ", to: "curriculum" },
  { name: "AWS 実践（EC2 / S3 / RDS）", why: "クラウド基礎の次に、構築・運用の実践力を", to: "materials" },
  { name: "React + TypeScript", why: "フロント実装の幅を広げ、フルスタックへ", to: "materials" },
  { name: "テスト自動化（JUnit）", why: "弱みのテスト領域を補強し品質を担保", to: "materials" },
];
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

export { COURSE, PERIOD, ROLES, CURRICULUM, PORTFOLIO_SKILLS, ENGINEER, PROJECTS_SEED, PHASES, STRENGTHS_SEED, WEAK_SEED, NEXT_SKILLS, TALENT_NAV };
