// 新しい LMS（セージ）の分け方（2026-11-02、計画 docs/specs/lms-sage-plan.md）。
// モック docs/design/mockups/devhub-lms-2026-10/lms-learning-style.html の groupsOf と同じ並び。
// [まとまりのキー, 見出し, [[画面のキー, 名前], ...]]

export const LMS_GROUPS = {
  trainee: [
    ["day", "毎日", [["home", "ホーム"], ["report", "日報"], ["att", "勤怠"]]],
    ["learn", "研修", [["cur", "カリキュラム"], ["test", "テスト"], ["prac", "練習問題"], ["dev", "個人開発"], ["doc", "フォルダ"], ["team", "チーム"]]],
    ["me", "自分用", [["note", "ノート"], ["goal", "目標"]]],
  ],
  instructor: [
    ["day", "毎日", [["home", "ホーム"], ["task", "タスク"], ["report", "日報"], ["att", "勤怠"]]],
    ["learn", "研修", [["cur", "カリキュラム"], ["test", "テスト"], ["prac", "練習問題"], ["doc", "フォルダ"], ["dev", "個人開発"]]],
    ["room", "教室", [["ann", "お知らせ"], ["team", "チーム"], ["seat", "席替え"], ["people", "受講生"], ["eval", "評価表"], ["done", "修了レポート"], ["setting", "コースの設定"]]],
  ],
  client: [
    ["day", "毎日", [["home", "ホーム"], ["report", "日報"], ["att", "勤怠"]]],
    ["state", "研修の様子", [["state", "様子"], ["people", "受講生"], ["eval", "評価表"], ["done", "修了レポート"]]],
    ["talk", "連絡", [["ann", "お知らせ"]]],
    ["grant", "助成金", [["grant", "助成金"]]],
  ],
  admin: [
    ["run", "準備", [["home", "ホーム"], ["cos", "企業"], ["users", "ユーザー"], ["sann", "お知らせ"]]],
    ["cmg", "コース管理", [["course", "コース一覧"]]],
    ["kmg", "カリキュラム管理", [["lcur", "カリキュラム"], ["ltest", "テスト"], ["lprac", "練習問題"]]],
    ["fmg", "フォルダ管理", [["cdoc", "コース別フォルダ"], ["doc", "共有フォルダ"]]],
    ["num", "分析・助成金", [["ana", "分析"], ["grant", "助成金"]]],
  ],
};

// まだ作り直していない画面は、今の画面（TrainingProduct などの view）をそのまま中に出す。null は今の画面にも無いもの
export const LMS_LEGACY = {
  trainee: { home: "home", report: "reports", att: "attendance", cur: "curriculum", test: "tests", prac: "practice", dev: "devreview", doc: "materials", team: "teams", note: "notes", goal: "goals" },
  instructor: { home: "home", task: null, report: "reports", att: "attendance", cur: "curriculum", test: "tests", prac: "practice", doc: "materials", dev: "devreview", ann: "announcements", team: "teams", seat: "seating", people: "trainees", eval: null, done: "completion", setting: null },
  client: { home: "home", report: "reports", att: "state", state: "state", people: "trainees", eval: "evaluation", done: "completion", ann: "announcements", grant: "grants" },
  admin: { home: "home", cos: "companies", users: "users", sann: "announcements", course: "courses", lcur: "curriculum", ltest: "tests", lprac: "practice", cdoc: "materials", doc: "materials", ana: "analytics", grant: "grants" },
};

// スマホの下のメニュー（最後に「メニュー」が付く。受講生は 4 つだけ）
export const LMS_BNAV = {
  trainee: ["home", "report", "att", "cur"],
  instructor: ["home", "report", "att", "people"],
  client: ["home", "report", "att", "people"],
  admin: ["home", "course", "lcur", "users"],
};

export const LMS_ROLE_LABEL = { trainee: "受講生", instructor: "講師", manager: "コース担当者", client: "企業担当者", admin: "管理者" };

// 標準で新しい画面にするロール（できたロールから true にする。2026-11-02 ユーザー指定）
export const LMS_DEFAULT_ROLES = { trainee: false, instructor: false, client: false, admin: false };

export const lmsGroups = role => LMS_GROUPS[role] || LMS_GROUPS.trainee;
export const lmsScreens = role => lmsGroups(role).flatMap(g => g[2]);
export const lmsLabel = (role, key) => (lmsScreens(role).find(s => s[0] === key) || [key, key])[1];
