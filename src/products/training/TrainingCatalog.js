import { LayoutDashboard, FileText, ClipboardCheck, Clock, NotebookPen, Users, Building2, BookOpen, Settings, GraduationCap, Calendar, Sparkles, Target, Wrench, Compass } from "lucide-react";


/* ===== ロール ===== */
const ROLES = {
  trainee: { key: "trainee", label: "受講生", icon: GraduationCap },
  instructor: { key: "instructor", label: "講師", icon: BookOpen },
  client: { key: "client", label: "企業担当者", icon: Building2 },
  admin: { key: "admin", label: "管理者", icon: Settings },
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

const NAV = {
  trainee: [
    { sec: null, items: [["home", "ホーム", LayoutDashboard]] },
    { sec: "研修中", items: [["courses", "所属コース", BookOpen], ["curriculum", "カリキュラム", Calendar], ["reports", "日報", NotebookPen], ["attendance", "勤怠", Clock], ["tests", "テスト", ClipboardCheck], ["materials", "研修資料", FileText], ["goals", "目標とタスク", Target]] },
  ],
  instructor: [
    { sec: null, items: [["home", "ホーム", LayoutDashboard]] },
    { sec: "コース運用", items: [["courses", "担当コース管理", BookOpen], ["trainees", "受講生", Users]] },
    { sec: "参照", items: [["companies", "企業", Building2], ["users", "ユーザー・講師", Users]] },
    { sec: "研修中", items: [["curriculum", "カリキュラム", Calendar], ["reports", "日報確認", NotebookPen], ["attendance", "勤怠確認", Clock], ["tests", "テスト", ClipboardCheck], ["materials", "研修資料", FileText], ["goals", "目標ダッシュボード", Target]] },
  ],
  client: [
    { sec: null, items: [["home", "ホーム", LayoutDashboard]] },
    { sec: "自社", items: [["courses", "参加コース", BookOpen], ["trainees", "自社受講生", Users], ["companies", "企業情報", Building2]] },
    { sec: "研修中", items: [["curriculum", "カリキュラム", Calendar], ["attendance", "出席・勤怠状況", Clock], ["reports", "日報確認・コメント", NotebookPen], ["tests", "テスト結果", ClipboardCheck], ["materials", "研修資料", FileText]] },
  ],
  admin: [
    { sec: null, items: [["home", "ホーム", LayoutDashboard]] },
    { sec: "全体管理", items: [["courses", "コース管理センター", BookOpen], ["trainees", "受講生", GraduationCap], ["companies", "企業", Building2], ["users", "ユーザー・講師", Users]] },
    { sec: "研修中", items: [["curriculum", "カリキュラム", Calendar], ["reports", "日報・月次集計", NotebookPen], ["attendance", "勤怠・月次集計", Clock], ["tests", "テスト", ClipboardCheck], ["materials", "研修資料", FileText]] },
  ],
};
const navViewSet = role => new Set([...(NAV[role] || []).flatMap(g => g.items.map(([k]) => k)), "notifications", "profile"]);

export { ROLES, GOALS, GOAL_ICON_MAP, QBANK, NAV, navViewSet };
