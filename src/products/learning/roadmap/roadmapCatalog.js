// 目標と、そこに必要なもの。正典: docs/specs/learning-roadmap-spec.md
//
// **ここが定義の正本。** Backend（routes/roadmap.mjs）は「どの目標を選んだか」と
// 「どれを自分で出来ると言ったか」だけを預かるので、**定義を直すのにデプロイは要らない**。
// コースが揃うにつれて何度も直す前提で、この形にしている（2026-09-08ユーザー判断）。
//
// **項目の状態は書かない。** 修了したかどうかはコースの進捗から、
// 出来ると言ったかどうかは自己申告から、その場で決める（stateOf）。
// ここに「済み」を書くと、実態とすぐずれる。
//
// course はコースの**タイトル**で紐づける。コースIDは入れ替わるが、タイトルは残るため。

// 自己申告は満点にしない。**確かめていないものが混ざったまま100%になるのを防ぐ。**
export const SELF_WEIGHT = 0.6;

// 総仕上げのコース。おすすめの並びで**最後に回す**（いちばん多く埋まるのは事実でも、
// 最初に勧めるものではない。効き目だけで並べたら1位に来てしまった）。
const isCapstone = title => title.startsWith("開発演習");

const I = (id, name, axis, course) => ({ id, name, axis, course });

export const GOALS = [
  {
    id: "backend", label: "バックエンド担当として現場に入る",
    summary: "処理とデータをつくり、画面の裏側を支える",
    items: [
      I("prog_basic", "プログラミングの基礎", "言語", "Java基礎"),
      I("oop", "オブジェクト指向", "言語", "Java基礎"),
      I("git_be", "バージョン管理（Git）", "開発", "開発演習：バックエンド担当"),
      I("read_req_be", "要件を読み取る", "上流", "上流工程基礎（要件定義・基本設計）"),
      I("sql_select", "SQLでデータを取り出す", "データ", "SQL基礎"),
      I("table_design", "テーブル設計を読む", "データ", "SQL基礎"),
      I("orm", "ORM（JPA）", "データ", "JPAによるデータアクセス"),
      I("rest_api", "REST APIを作る", "サーバー", "Spring Boot基礎"),
      I("di", "DIとフレームワーク", "サーバー", "Spring Boot基礎"),
      I("unit_test_be", "テストを書く", "開発", "開発演習：バックエンド担当"),
      I("integ_test", "結合テストまで通す", "開発", "開発演習：バックエンド担当"),
    ],
  },
  {
    id: "frontend", label: "フロントエンド担当として現場に入る",
    summary: "人が触る画面をつくり、見た目と操作感に責任を持つ",
    items: [
      I("html_css", "HTMLとCSS", "画面", "HTML/CSS基礎"),
      I("responsive", "レスポンシブ", "画面", "HTML/CSS基礎"),
      I("git_fe", "バージョン管理（Git）", "開発", "開発演習：フロントエンド担当"),
      I("js_basic", "JavaScriptの基礎", "言語", "JavaScript・TypeScript基礎"),
      I("async", "非同期処理", "言語", "JavaScript・TypeScript基礎"),
      I("ts_type", "TypeScriptの型", "言語", "JavaScript・TypeScript基礎"),
      I("component", "コンポーネント設計", "画面", "React基礎"),
      I("state", "状態管理", "画面", "React基礎"),
      I("api_call", "APIとつなぐ", "サーバー", "React基礎"),
      I("unit_test_fe", "単体テスト", "開発", "開発演習：フロントエンド担当"),
      I("read_req_fe", "要件を読み取る", "上流", "上流工程基礎（要件定義・基本設計）"),
    ],
  },
  {
    id: "infra", label: "インフラを任される",
    summary: "動かす場所をつくり、止まらないようにする",
    items: [
      I("network", "ネットワークの基礎", "土台", "IT基礎"),
      I("linux", "Linuxの操作", "土台", "IT基礎"),
      I("vpc", "VPCとサブネット", "クラウド", "クラウド実習：基礎"),
      I("routing", "ルーティング", "クラウド", "クラウド実習：基礎"),
      I("sg", "セキュリティグループ", "クラウド", "クラウド実習：基礎"),
      I("ec2", "EC2の起動と設定", "クラウド", "クラウド実習：基礎"),
      I("real_aws", "本物のAWSで組む", "クラウド", "クラウド実習：本物のAWSで1回作る"),
      I("serverless", "サーバーレス", "クラウド", "Lambdaによるサーバレスアーキテクチャの構築"),
      I("cost", "費用の見方", "運用", "クラウド実習：運用"),
      I("auto_stop", "止め忘れを防ぐ", "運用", "クラウド実習：運用"),
      I("logs", "ログと監視", "運用", "クラウド実習：運用"),
    ],
  },
  {
    id: "upstream", label: "上流工程に立つ",
    summary: "何を作るかを決め、お客様と作り手の間に立つ",
    items: [
      I("it_base", "ITの土台", "土台", "IT基礎"),
      I("dev_exp", "作る側の経験", "開発", "Java基礎"),
      I("horenso", "報連相", "ビジネス", "ビジネススキル基礎（報連相・議事録・段取り）"),
      I("elicit", "要件を引き出す", "上流", "上流工程基礎（要件定義・基本設計）"),
      I("basic_design", "基本設計に落とす", "上流", "上流工程基礎（要件定義・基本設計）"),
      I("vmodel", "V字で確かめ方を決める", "上流", "上流工程基礎（要件定義・基本設計）"),
      I("estimate", "見積りの考え方", "上流", "上流工程基礎（要件定義・基本設計）"),
      I("minutes", "議事録を残す", "ビジネス", "ビジネススキル基礎（報連相・議事録・段取り）"),
      I("planning", "段取りを組む", "ビジネス", "ビジネススキル基礎（報連相・議事録・段取り）"),
      I("client_talk", "お客様と話す", "ビジネス", "ビジネスマナー基礎"),
      I("acceptance", "受入まで立ち会う", "開発", "開発演習：上流工程担当"),
    ],
  },
  {
    id: "fullstack", label: "Webアプリを一人で作れる",
    summary: "画面から裏側、動かす場所まで通しで作れる",
    items: [
      I("fs_html", "HTMLとCSS", "画面", "HTML/CSS基礎"),
      I("fs_prog", "プログラミングの基礎", "言語", "Java基礎"),
      I("fs_git", "バージョン管理（Git）", "開発", "開発演習"),
      I("fs_js", "JavaScript", "言語", "JavaScript・TypeScript基礎"),
      I("fs_component", "画面を部品で組む", "画面", "React基礎"),
      I("fs_sql", "SQL", "データ", "SQL基礎"),
      I("fs_api", "REST APIを作る", "サーバー", "Spring Boot基礎"),
      I("fs_orm", "ORM（JPA）", "データ", "JPAによるデータアクセス"),
      I("fs_place", "動かす場所を用意する", "クラウド", "クラウド実習：基礎"),
      I("fs_publish", "公開する", "クラウド", "クラウド実習：本物のAWSで1回作る"),
      I("fs_test", "テストを書く", "開発", "開発演習"),
    ],
  },
];

export function goalById(id) {
  return GOALS.find(g => g.id === id) || null;
}

// ---- 状態の判定 ----
//
// completedTitles: 修了したコースのタイトルの集合
// declared:        「もう出来る」と自分で言った項目のIDの集合
//
// **修了が自己申告に勝つ。** 逆にすると、修了しているのに自己申告扱いで6割のままになる。
export function stateOf(item, completedTitles, declared) {
  if (completedTitles.has(item.course)) return "have";
  if (declared.has(item.id)) return "self";
  return "none";
}

export function weightOf(state) {
  return state === "have" ? 1 : state === "self" ? SELF_WEIGHT : 0;
}

export function resolveItems(goal, completedTitles, declared) {
  return (goal?.items || []).map(i => ({ ...i, state: stateOf(i, completedTitles, declared) }));
}

export function scoreOf(items) {
  if (!items.length) return 0;
  return items.reduce((n, i) => n + weightOf(i.state), 0) / items.length;
}

export function axesOf(items) {
  const m = new Map();
  items.forEach(i => {
    const a = m.get(i.axis) || { need: 0, got: 0, miss: 0 };
    a.need += 1;
    a.got += weightOf(i.state);
    if (i.state !== "have") a.miss += 1;
    m.set(i.axis, a);
  });
  return [...m.entries()].map(([name, v]) => ({ name, ...v, ratio: v.got / v.need }));
}

// おすすめのコース。**受けると到達度が何点上がるか**で並べ、総仕上げだけ最後に回す。
//
// 順番の規則はこれだけにしてある。「前提の要らないものが先」まで足したら、
// フロントエンド志望に上流工程がReactより先に出た（前提が要らないというだけの理由で）。
export function recommendationsFor(items, isReady) {
  const base = scoreOf(items);
  const map = new Map();
  items.filter(i => i.state === "none").forEach(i => {
    const c = map.get(i.course) || { course: i.course, names: [], axes: new Set() };
    c.names.push(i.name);
    c.axes.add(i.axis);
    map.set(i.course, c);
  });
  return [...map.values()].map(c => {
    const after = items.map(i => (i.state === "none" && i.course === c.course) ? { ...i, state: "have" } : i);
    return {
      ...c,
      axes: [...c.axes],
      capstone: isCapstone(c.course),
      ready: isReady ? isReady(c.course) : false,
      lift: Math.round((scoreOf(after) - base) * 100),
    };
  }).sort((a, b) =>
    (a.capstone ? 1 : 0) - (b.capstone ? 1 : 0)
    || b.lift - a.lift
    || (b.ready ? 1 : 0) - (a.ready ? 1 : 0));
}
