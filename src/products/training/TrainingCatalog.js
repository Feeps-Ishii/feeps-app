import {
  LayoutDashboard, FileText, ClipboardCheck, Clock, NotebookPen, Users,
  Building2, BookOpen, Settings, GraduationCap, Search, Upload, Download,
  CheckCircle2, Circle, AlertCircle, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Trash2, LogOut,
  Bell, Plus, Send, MessageSquare, TrendingUp, Calendar, PlayCircle, Award,
  Sparkles, Flame, X, Eye, Pencil, StickyNote, Megaphone, ArrowUpRight,
  MoreHorizontal, Check, Filter, Target, ListChecks, Lock, Mail, Lightbulb,
  Wrench, Compass, ShieldCheck, FileSpreadsheet, LogIn, Menu, Star, Activity,
  GitBranch, Briefcase, Gauge, MapPin, User, Printer, RefreshCw, Receipt
} from "lucide-react";

const COURSE = "アクシス Javaエンジニア育成コース";
const COURSE_FULL = "株式会社アクシス Javaエンジニア育成コース";
const VENUE = "虎ノ門DC";
const PERIOD = "2026/04/01〜06/12（49日間）";
const TOTAL_HOURS = "364時間45分";
const TODAY = { dateLabel: "2026年4月15日（水）・15日目", unit: "Java", topic: "条件分岐・反復", testId: 2 };

/* ===== ロール ===== */
const ROLES = {
  trainee: { key: "trainee", label: "受講生", who: "田中 翔太", org: "株式会社アクシス", icon: GraduationCap, mail: "tanaka@axis.co.jp" },
  instructor: { key: "instructor", label: "講師", who: "石井 啓輔", org: "株式会社Feeps", icon: BookOpen, mail: "ishii@feeps.co.jp" },
  client: { key: "client", label: "企業担当者", who: "高橋 由美", org: "株式会社アクシス", icon: Building2, mail: "takahashi@axis.co.jp" },
  admin: { key: "admin", label: "管理者", who: "寺田 正哉", org: "株式会社Feeps", icon: Settings, mail: "admin@feeps.co.jp" },
};

/* ===== 研修目標①〜④ × タスク ===== */
const GOALS = [
  { id: "g1", title: "基礎スキル", sub: "SEとしての幅広い基礎", icon: Wrench, tasks: [
    { id: "t1", t: "IT基礎（ハード/ソフト/最新技術）を理解する" }, { id: "t2", t: "Java の基本文法・変数・配列を習得する" },
    { id: "t3", t: "条件分岐・反復・メソッドを使いこなす" }, { id: "t4", t: "オブジェクト指向・クラス・継承を理解する" },
    { id: "t5", t: "SQL / JPA でデータベースを操作する" }, { id: "t6", t: "HTML / CSS で画面を構築する" } ] },
  { id: "g2", title: "ビジネス基礎", sub: "学生から社会人へ", icon: Users, tasks: [
    { id: "t7", t: "ビジネスマナー（挨拶・言葉遣い・電話）を身に付ける" }, { id: "t8", t: "顧客対応・クレーム対応を学ぶ" },
    { id: "t9", t: "ビジネススキル・目標設定を理解する" } ] },
  { id: "g3", title: "次世代技術", sub: "DX / クラウド", icon: Sparkles, tasks: [
    { id: "t10", t: "生成AIの基礎とAI活用を体験する" }, { id: "t11", t: "クラウド基礎（AWS / VPC / EC2 / S3）を理解する" },
    { id: "t12", t: "可用性・サーバレス・Docker を理解する" }, { id: "t13", t: "JavaScript / TypeScript / React を習得する" } ] },
  { id: "g4", title: "コンサル基礎", sub: "ITコンサル人材へ", icon: Compass, tasks: [
    { id: "t14", t: "上流工程（要件定義・設計）を理解する" }, { id: "t15", t: "チーム開発演習（設計〜結合試験）を行う" },
    { id: "t16", t: "成果報告会でプレゼンする" } ] },
];
const GOAL_ICON_MAP = { g1: Wrench, g2: Users, g3: Sparkles, g4: Compass };
const ALL_TASKS = GOALS.flatMap(g => g.tasks.map(t => ({ ...t, goal: g.title, gid: g.id })));

/* ===== サンプルデータ ===== */
const MATERIALS = [
  { id: 1, title: "ビジネスマナー 研修テキスト", type: "PDF", size: "3.4MB", cat: "ビジネス", done: true },
  { id: 2, title: "ビジネススキル・目標設定 ワークシート", type: "PDF", size: "1.8MB", cat: "ビジネス", done: true },
  { id: 3, title: "IT基礎 テキスト", type: "PDF", size: "4.0MB", cat: "IT・クラウド", done: true },
  { id: 4, title: "生成AI基礎 ハンドアウト", type: "PDF", size: "2.6MB", cat: "IT・クラウド", done: true },
  { id: 5, title: "クラウド基礎（AWS） テキスト", type: "PDF", size: "6.2MB", cat: "IT・クラウド", done: true },
  { id: 6, title: "HTML / CSS 教材", type: "PDF", size: "3.1MB", cat: "Web・フロント", done: true },
  { id: 7, title: "Java 基礎テキスト", type: "PDF", size: "7.4MB", cat: "Java・サーバ", done: true },
  { id: 8, title: "Java 練習問題集", type: "PDF", size: "2.2MB", cat: "Java・サーバ", done: false },
  { id: 9, title: "Java サンプルコード", type: "ZIP", size: "1.1MB", cat: "Java・サーバ", done: false },
  { id: 10, title: "Spring 教材（MVC / DI）", type: "PDF", size: "5.0MB", cat: "Java・サーバ", done: false },
  { id: 11, title: "SQL / JPA 教材", type: "PDF", size: "4.3MB", cat: "Java・サーバ", done: false },
  { id: 12, title: "JavaScript / TypeScript / React 教材", type: "PDF", size: "5.8MB", cat: "Web・フロント", done: false },
  { id: 13, title: "上流工程・チーム開発 演習要項", type: "PDF", size: "3.5MB", cat: "上流・チーム開発", done: false },
];
const TESTS = [
  { id: 1, title: "Java基礎 確認テスト（変数・配列）", q: 10, limit: "20分", status: "graded", score: 88, avg: 82, submitted: 5 },
  { id: 2, title: "条件分岐・反復 小テスト", q: 6, limit: "12分", status: "not_started", score: null, avg: 74, submitted: 3 },
  { id: 3, title: "オブジェクト指向 確認テスト", q: 10, limit: "20分", status: "not_started", score: null, avg: null, submitted: 0 },
];
const TRAINEES = [
  { id: 1, name: "田中 翔太", org: "株式会社アクシス", attend: 100, progress: 78, avg: 88, streak: 4, flag: null },
  { id: 2, name: "佐藤 美咲", org: "株式会社アクシス", attend: 100, progress: 85, avg: 92, streak: 5, flag: null },
  { id: 3, name: "鈴木 大輔", org: "株式会社アクシス", attend: 80, progress: 58, avg: 71, streak: 1, flag: "Javaの配列でつまずき気味" },
  { id: 4, name: "伊藤 彩花", org: "株式会社アクシス", attend: 100, progress: 92, avg: 95, streak: 5, flag: null },
  { id: 5, name: "渡辺 健", org: "株式会社アクシス", attend: 90, progress: 70, avg: 80, streak: 2, flag: "本日欠席（連絡済）" },
];
/* ポートフォリオ：自己登録の保有スキル */
const RISK = [
  { name: "鈴木 大輔", org: "株式会社アクシス", score: 74,
    signals: { 日報: 68, テスト: 75, 勤怠: 55, 学習時間: 62 },
    top: "テスト点数の低下と配列でのつまずき",
    advice: "Javaの理解度が低下しています。Spring演習の前に「配列・反復」の個別補強テストと再演習を追加し、次回の1on1で進捗を確認してください。" },
  { name: "渡辺 健", org: "株式会社アクシス", score: 48,
    signals: { 日報: 42, テスト: 45, 勤怠: 70, 学習時間: 50 },
    top: "欠席と学習時間の減少",
    advice: "欠席（本日・連絡済）で学習時間が減少傾向です。復帰後にフォロー面談を設定し、欠席分の録画・教材リンクを共有してください。" },
  { name: "田中 翔太", org: "株式会社アクシス", score: 22,
    signals: { 日報: 18, テスト: 25, 勤怠: 10, 学習時間: 30 },
    top: "おおむね順調",
    advice: "理解・出席ともに良好です。リーダー役やメンター補助を任せると、さらに伸びる可能性があります。" },
  { name: "佐藤 美咲", org: "株式会社アクシス", score: 18,
    signals: { 日報: 15, テスト: 20, 勤怠: 12, 学習時間: 24 },
    top: "安定",
    advice: "安定して高い習熟度です。発展課題（二重ループ・メソッド分割）を提示すると効果的です。" },
  { name: "伊藤 彩花", org: "株式会社アクシス", score: 12,
    signals: { 日報: 10, テスト: 10, 勤怠: 8, 学習時間: 18 },
    top: "非常に良好",
    advice: "全項目で良好です。難易度高めの課題やチーム開発のリード役が適しています。" },
];
const ATT_ROWS = [
  { name: "田中 翔太", org: "株式会社アクシス", in: "09:52", out: "17:05", s: "出勤", note: "" },
  { name: "佐藤 美咲", org: "株式会社アクシス", in: "09:48", out: "17:02", s: "出勤", note: "" },
  { name: "鈴木 大輔", org: "株式会社アクシス", in: "10:18", out: "17:00", s: "遅刻", note: "電車遅延" },
  { name: "伊藤 彩花", org: "株式会社アクシス", in: "09:40", out: "17:10", s: "出勤", note: "" },
  { name: "渡辺 健", org: "株式会社アクシス", in: "—", out: "—", s: "欠席", note: "体調不良（連絡済）" },
];
const KARTE = {
  3: [{ type: "memo", at: "04/15 18:30", who: "石井 啓輔", text: "配列のインデックス理解で詰まりやすい。図で再説明予定。基本文法は概ねOK。" },
      { type: "test", at: "04/15 16:10", text: "Java基礎 確認テスト 70点（配列は要復習）" },
      { type: "attend", at: "04/15 10:18", text: "遅刻（電車遅延）", tone: "amber" },
      { type: "report", at: "04/15 18:05", text: "日報保存：配列とListの違いが曖昧" }],
  1: [{ type: "memo", at: "04/15 18:20", who: "石井 啓輔", text: "理解が早い。質問の質が高くリーダー候補。" },
      { type: "test", at: "04/15 16:00", text: "Java基礎 確認テスト 88点" },
      { type: "report", at: "04/15 18:05", text: "日報保存：オブジェクト指向の実装が楽しみ" },
      { type: "attend", at: "04/15 09:52", text: "出勤", tone: "green" }],
};
const REPORTS_SEED = [
  { id: 1, name: "田中 翔太", org: "株式会社アクシス", date: "2026/04/15",
    learned: "Javaの変数・データ型と配列の基本を理解した。int型と参照型の違い、配列のインデックスが0始まりである点が腹落ちした。",
    question: "配列とList（コレクション）の使い分けの基準がまだ曖昧。",
    nextday: "条件分岐と反復を組み合わせて、配列を走査する処理を書けるようにしたい。",
    comments: [{ by: "石井 啓輔", role: "講師", text: "理解が良いです。要素数が固定なら配列、増減するならList、とまず覚えるとスッキリしますよ。明日のループ演習で配列操作に慣れましょう。", at: "04/15 18:20" }] },
  { id: 2, name: "佐藤 美咲", org: "株式会社アクシス", date: "2026/04/15",
    learned: "for文とwhile文の使い分け、拡張for文で配列を簡潔に回せることを学んだ。",
    question: "二重ループのときのインデックスの考え方が少し混乱した。",
    nextday: "メソッドに切り出して、処理を再利用できるように書きたい。", comments: [] },
];

/* ===== 問題バンク（範囲・重点でAI生成）— Java ===== */
const QBANK = {
  "変数・データ型": [
    { q: "Javaでint型の変数を宣言する正しい記述は？", a: ["int x = 10;", "x = int 10;", "int x == 10;", "var x : int = 10"] },
    { q: "整数を扱う基本データ型は？", a: ["int", "String", "boolean", "decimal"] },
    { q: "文字列を扱う型は？", a: ["String", "char専用", "text", "str"] },
  ],
  "配列": [
    { q: "配列の最初の要素のインデックスは？", a: ["0", "1", "-1", "length"] },
    { q: "長さ5のint配列を作る記述は？", a: ["int[] a = new int[5];", "int a = new int(5);", "array a[5];", "int a[] = 5;"] },
  ],
  "条件分岐": [
    { q: "条件で処理を分ける構文は？", a: ["if 文", "for 文", "while 文", "import 文"] },
    { q: "等価を比較する演算子は？", a: ["==", "=", "=>", "><"] },
  ],
  "反復（ループ）": [
    { q: "決まった回数の繰り返しに適すのは？", a: ["for 文", "if 文", "try 文", "switch 文"] },
    { q: "配列全体を走査する拡張for文は？", a: ["for (int v : arr)", "foreach v in arr", "loop(arr)", "while arr"] },
  ],
  "メソッド": [
    { q: "値を返さないメソッドの戻り値型は？", a: ["void", "null", "int", "empty"] },
  ],
  "オブジェクト指向": [
    { q: "クラスから生成される実体を何という？", a: ["インスタンス", "メソッド", "パッケージ", "変数"] },
    { q: "継承で使うキーワードは？", a: ["extends", "implements", "inherit", "super()"] },
  ],
  "例外処理": [
    { q: "例外を捕捉する構文は？", a: ["try - catch", "if - else", "for - each", "switch - case"] },
  ],
  "SQL基礎": [
    { q: "データを取得するSQLは？", a: ["SELECT", "UPDATE", "DELETE", "CREATE"] },
  ],
};
const TAKE_Q = [
  { q: "int型の変数を宣言する正しい記述は？", a: ["int x == 10;", "int x = 10;", "x := 10", "var int x 10"], c: 1 },
  { q: "配列の最初の要素のインデックスは？", a: ["1", "0", "-1", "null"], c: 1 },
  { q: "決まった回数の繰り返しに適すのは？", a: ["if 文", "switch 文", "for 文", "try 文"], c: 2 },
  { q: "等価を比較する演算子は？", a: ["=", "==", "=>", ">="], c: 1 },
];
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

const BADGES = {
  trainee: {},
  instructor: {},
  client: {},
  admin: {},
};
const NAV = {
  trainee: [
    { sec: null, items: [["home", "ホーム", LayoutDashboard]] },
    { sec: "研修中", items: [["curriculum", "カリキュラム", Calendar], ["reports", "日報", NotebookPen], ["attendance", "勤怠", Clock], ["tests", "テスト", ClipboardCheck], ["materials", "研修資料", FileText], ["goals", "目標とタスク", Target]] },
  ],
  instructor: [
    { sec: null, items: [["home", "ホーム", LayoutDashboard]] },
    { sec: "研修中", items: [["curriculum", "カリキュラム", Calendar], ["reports", "日報確認", NotebookPen], ["attendance", "勤怠確認", Clock], ["tests", "テスト", ClipboardCheck], ["materials", "研修資料", FileText], ["goals", "目標ダッシュボード", Target], ["trainees", "受講生カルテ・要確認者", Users]] },
  ],
  client: [
    { sec: null, items: [["home", "ホーム", LayoutDashboard]] },
    { sec: "研修中", items: [["trainees", "自社受講生", Users], ["attendance", "出席・勤怠状況", Clock], ["reports", "日報確認・コメント", NotebookPen], ["tests", "テスト結果", ClipboardCheck]] },
  ],
  admin: [
    { sec: null, items: [["home", "ホーム", LayoutDashboard]] },
    { sec: "全体管理", items: [["companies", "企業", Building2], ["courses", "コース", BookOpen], ["users", "ユーザー・講師", Users], ["trainees", "受講生", GraduationCap]] },
    { sec: "研修中", items: [["curriculum", "カリキュラム", Calendar], ["reports", "日報・月次集計", NotebookPen], ["attendance", "勤怠・月次集計", Clock], ["tests", "テスト", ClipboardCheck], ["materials", "研修資料", FileText]] },
  ],
};
const navViewSet = role => new Set([...(NAV[role] || []).flatMap(g => g.items.map(([k]) => k)), "notifications", "profile"]);

export { COURSE, COURSE_FULL, VENUE, PERIOD, TOTAL_HOURS, TODAY, ROLES, GOALS, GOAL_ICON_MAP, ALL_TASKS, MATERIALS, TESTS, TRAINEES, RISK, ATT_ROWS, KARTE, REPORTS_SEED, QBANK, TAKE_Q, CURRICULUM, BADGES, NAV, navViewSet };
