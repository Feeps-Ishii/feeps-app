// 開発演習の工程（phase）と担当区分（roleSlot）。正典: docs/specs/dev-lab-role-spec.md
//
// **工程は案件データではなくアプリ側の定数**。案件ごとに工程名が変わると
// 「同じ案件を担当を変えて何周でもできる」「進め方の違いを比べる」が成り立たなくなる。
//
// 既存案件は method も roleSlots も phase も持たない。**そのときは今までどおり全ステップを出す**
// （hasRoleSetup() が false を返す）。互換をここで担保して、呼び出し側に分岐を散らさない。

export const METHODS = [
  {
    id: "waterfall",
    name: "ウォーターフォール",
    tag: "V字モデル",
    summary: "工程を順番に進めます。前の工程で決めたことを、対になる工程で確かめます。",
    fit: "要件が先に決まる案件。作り直しの費用が大きい案件",
  },
  {
    id: "agile",
    name: "アジャイル",
    tag: "スクラム",
    summary: "2週間ごとに動くものを作って見せ、そこで次を決め直します。",
    fit: "要件が動く案件。早く見せて反応を見たい案件",
  },
];

// 座標はV字の腕・スプリントの輪の上に等分で置いている（PhaseDiagram.jsx が使う）
// 2026-09-07: 底の2つ（実装・単体テスト）が x=420 と x=480 で、箱の幅132に対して
// 60しか離れておらず**重なっていた**（ユーザー指摘）。V字の底を広げて離した。
// 箱の半幅は66なので、隣り合う箱は最低でも136離すこと。
const WATERFALL = [
  { id: "req", label: "要件定義", sub: "REQUIREMENT", x: 120, y: 60 },
  { id: "basic", label: "基本設計", sub: "ARCHITECTURE", x: 200, y: 160 },
  { id: "detail", label: "詳細設計", sub: "DETAIL", x: 280, y: 260 },
  { id: "code", label: "実装", sub: "CODING", x: 360, y: 360 },
  { id: "unit", label: "単体テスト", sub: "UNIT", x: 540, y: 360 },
  { id: "integ", label: "結合テスト", sub: "INTEGRATION", x: 620, y: 260 },
  { id: "system", label: "システムテスト", sub: "SYSTEM", x: 700, y: 160 },
  { id: "accept", label: "受入テスト", sub: "ACCEPTANCE", x: 780, y: 60 },
];

const AGILE = [
  { id: "plan", label: "スプリント計画", sub: "PLANNING", x: 460, y: 70 },
  { id: "design", label: "設計", sub: "DESIGN", x: 698, y: 160 },
  { id: "build", label: "実装", sub: "BUILD", x: 607, y: 305 },
  { id: "test", label: "テスト", sub: "TEST", x: 313, y: 305 },
  { id: "review", label: "レビュー・ふりかえり", sub: "REVIEW", x: 222, y: 160 },
];

// V字の対応（左で決めたことを右で確かめる）。図の点線に使う
export const TIES = { req: "accept", basic: "system", detail: "integ" };

// 工程の順番の外側。V字にもスプリントの輪にも入れず、図の外に帯として置く
export const INFRA_PHASE = "infra";

export function phasesFor(method) {
  return method === "agile" ? AGILE : WATERFALL;
}

export function phaseLabel(method, phaseId) {
  if (phaseId === INFRA_PHASE) return "インフラ";
  return phasesFor(method).find(p => p.id === phaseId)?.label || phaseId || "";
}

export function methodOf(project) {
  return project?.method === "agile" ? "agile" : "waterfall";
}

// 案件が担当区分を持たないときの既定。案件データ側で上書きできる
const DEFAULT_SLOTS = {
  waterfall: [
    { roleSlotId: "upstream", name: "上流工程担当", summary: "要件を決めて設計に落とす",
      phases: ["req", "basic", "accept"], counterpart: "client",
      handoverNote: "お客様から要件を引き出し、基本設計まで。最後の受入テストにも立ち会います" },
    { roleSlotId: "front", name: "フロントエンド担当", summary: "画面をつくる",
      phases: ["detail", "code", "unit"], counterpart: "senpai",
      handoverNote: "基本設計書は渡されます。画面の詳細設計から単体テストまで" },
    { roleSlotId: "back", name: "バックエンド担当", summary: "処理とデータをつくる",
      phases: ["detail", "code", "unit", "integ"], counterpart: "senpai",
      handoverNote: "基本設計書は渡されます。詳細設計から結合テストまで" },
    { roleSlotId: "qa", name: "テスト担当", summary: "仕様どおりかを確かめる",
      phases: ["integ", "system", "accept"], counterpart: "qa_lead",
      handoverNote: "要件定義書・基本設計書・動くアプリが渡されます。テスト設計から" },
    { roleSlotId: "infra", name: "インフラ担当", summary: "動かす場所をつくる",
      phases: [INFRA_PHASE], counterpart: "sre", premium: true,
      handoverNote: "工程の順番の外側で、実装からシステムテストまでを下から支えます" },
    { roleSlotId: "all", name: "ひとりで全部", summary: "上流から受入まで通す",
      phases: WATERFALL.map(p => p.id), counterpart: "pm",
      handoverNote: "工程は全部やりますが、1工程あたりは軽くしています" },
  ],
  agile: [
    { roleSlotId: "po", name: "要件・優先順位", summary: "何を先につくるか決める",
      phases: ["plan", "review"], counterpart: "po",
      handoverNote: "POと一緒にバックログを作り、スプリントごとに何を入れるか決めます" },
    // アジャイルではフロントとバックを分けない。1つの機能を通しで作る
    { roleSlotId: "dev", name: "開発担当", summary: "設計から実装・テストまで通す",
      phases: ["design", "build", "test"], counterpart: "senpai",
      handoverNote: "1つの機能を通しで作ります" },
    { roleSlotId: "qa", name: "品質担当", summary: "壊れていないかを見続ける",
      phases: ["test", "review"], counterpart: "qa_lead",
      handoverNote: "テストが最後に来ません。毎スプリント動くものを確かめます" },
    { roleSlotId: "infra", name: "インフラ担当", summary: "動かす場所をつくる",
      phases: [INFRA_PHASE], counterpart: "sre", premium: true,
      handoverNote: "工程の順番の外側で、全体を下から支えます" },
    { roleSlotId: "all", name: "ひとりで全部", summary: "1人で1スプリントを回す",
      phases: AGILE.map(p => p.id), counterpart: "pm",
      handoverNote: "計画から ふりかえり まで自分で回します" },
  ],
};

export function roleSlotsFor(project) {
  const custom = project?.roleSlots;
  if (Array.isArray(custom) && custom.length) {
    return custom.map(s => ({ ...s, phases: Array.isArray(s.phases) ? s.phases : [] }));
  }
  return DEFAULT_SLOTS[methodOf(project)];
}

export function findRoleSlot(project, roleSlotId) {
  return roleSlotsFor(project).find(s => s.roleSlotId === roleSlotId) || null;
}

// **担当を持たせるかどうかの判定**。案件が roleSlots を持つか、ステップが phase を持つときだけ。
// どちらも無い既存案件は今までどおり全ステップを出す
export function hasRoleSetup(project) {
  if (Array.isArray(project?.roleSlots) && project.roleSlots.length) return true;
  return (project?.steps || []).some(s => s.phase);
}

// phase を持たないステップは常に出す（既存案件の互換）
export function stepsForRole(steps, slot) {
  const list = steps || [];
  if (!slot) return list;
  const set = new Set(slot.phases || []);
  return list.filter(s => !s.phase || set.has(s.phase));
}
