// クラウド実習の単元。正典: docs/specs/aws-lab-spec.md §8
//
// **単元の定義はここが正本**。Backend（routes/cloudlab.mjs）は受け取ったunitIdを
// 素通しで記録するだけなので、単元を足すのにBackendのデプロイは要らない。
//
// `status` は3つ。
//   ready    … いまの判定モデル（awsLabModel.js）で遊べる
//   pending  … 模型を足さないと作れない（何が足りないかを needs に書く）
//   external … 本物のAWS。実習アカウント側の仕組みができてから
//
// **できていないものを隠さない。** 道すじ全体が見えていることに価値があるので、
// 準備中も一覧には出して「まだ開けない」と言う。

export const CLOUD_LAB_ACCENT = "cloudlab";

// グループ（2026-09-07）。**単元を平らに並べない。**
// AWSは基礎・応用・運用で求められるものが別物で、8個を1列にすると
// 「どこまでやれば一区切りか」が分からなくなる。
//
// 本物のAWSで1回作る（単元7）は**基礎の総仕上げ**に置く。応用や運用の入口ではなく、
// 基礎で組んだものを本物で組み直すのが値打ちなので。
export const GROUPS = [
  {
    id: "basic", label: "基礎", en: "FOUNDATION",
    summary: "ネットワークを区切り、サーバーを1台立てて、外から見えるようにする",
    detail: "つながらない理由を自分で突き止められるようになるところまで。最後は本物のAWSで同じものを組みます。",
    unitIds: ["vpc_subnet", "igw_route", "security_group", "public_ip", "real_console"],
  },
  {
    id: "applied", label: "応用", en: "APPLIED",
    summary: "見せるものと隠すものを分け、構成をコードで書く",
    detail: "1台では起きない問題を扱います。公開と非公開の分離、サーバー同士の通信、そして手作業をやめる方法。",
    unitIds: ["private_subnet", "sg_reference", "cloudformation"],
  },
  {
    id: "operation", label: "運用", en: "OPERATION",
    summary: "作ったあとに毎日ついてくること",
    detail: "費用・止め忘れ・障害の気づき方。作れることと運用できることは別物です。",
    unitIds: ["cost", "auto_stop", "logs"],
  },
];

export const UNITS = [
  {
    id: "vpc_subnet", no: 1, status: "pending",
    title: "VPCとサブネット",
    touch: "CIDRを決めて区切る",
    fail: "範囲が重なって作れない",
    needs: "CIDRを自分で決める模型",
  },
  {
    id: "igw_route", no: 2, status: "ready",
    title: "IGWとルート",
    touch: "IGWを付け、0.0.0.0/0を向ける",
    fail: "IGWを付けただけでは通らない",
    lab: {
      task: "外から http:// でサンプルアプリのページが見える状態にしてください。",
      intro: "VPCは作った時点では外と切り離されています。まず外への道を通します。",
      // 出入口もルートも無い、まっさらな状態から始める
      initial: { igw: false, routeA: "local", routeB: "local", sg: [80], publicIp: true },
      userDataStarter: [
        "#!/bin/bash",
        "dnf install -y httpd",
        "systemctl enable --now httpd",
        'echo "<h1>Hello from EC2</h1>" > /var/www/html/index.html',
      ].join("\n"),
    },
  },
  {
    id: "security_group", no: 3, status: "ready",
    title: "セキュリティグループ",
    touch: "80番だけ開ける",
    fail: "SSHは開いているがHTTPが閉じている",
    lab: {
      task: "SSHは開いています。Webページが見えるように直してください。",
      intro: "道は通っているのに繋がりません。EC2の手前に立っている門番を見ます。",
      // **わざと壊しておく**。SSHだけ開いている、いちばんよくある形
      initial: { igw: true, routeA: "igw", routeB: "local", sg: [22], publicIp: true },
      userDataStarter: [
        "#!/bin/bash",
        "dnf install -y httpd",
        "systemctl enable --now httpd",
        'echo "<h1>Hello from EC2</h1>" > /var/www/html/index.html',
      ].join("\n"),
    },
  },
  {
    id: "public_ip", no: 4, status: "ready",
    title: "パブリックIPとユーザーデータ",
    touch: "宛先を付け、起動スクリプトでアプリを動かす",
    fail: "ルートもSGも正しいのにIPが無い",
    lab: {
      task: "ルートもセキュリティグループも正しいのに繋がりません。原因を見つけて直してください。",
      intro: "ここまでの設定は全部正しく入っています。残っているのは宛先と、EC2の中で動くものです。",
      // 道もSGも正しい。**足りないのは宛先とアプリだけ**という状態から始める
      initial: { igw: true, routeA: "igw", routeB: "local", sg: [80], publicIp: false },
      userDataStarter: "#!/bin/bash\n",
    },
  },
  {
    id: "private_subnet", no: 5, status: "pending",
    title: "プライベートサブネット",
    touch: "DBを外から見えない場所に置く",
    fail: "DBが外から見えてしまう構成を直す",
    needs: "EC2を2台置ける模型",
  },
  {
    id: "sg_reference", no: 6, status: "pending",
    title: "Web→DBだけ許可する",
    touch: "セキュリティグループ同士で参照する",
    fail: "SG同士の参照ができていない",
    needs: "EC2を2台置ける模型と、SG同士の参照",
  },
  {
    id: "real_console", no: 7, status: "ready",
    title: "本物のAWSで1回作る",
    touch: "同じ構成をAWSコンソールで",
    fail: "本物のエラーメッセージを読む",
    premium: true,
    // 模型ではなく本物のコンソールへ入る単元。専用の画面（CloudLabConsoleUnit）を出す
    console: true,
  },
  {
    id: "cloudformation", no: 8, status: "pending",
    title: "CloudFormationで書く",
    touch: "同じ構成をテンプレートに",
    fail: "手で作らずに済ませる",
    needs: "テンプレートを書く演習の画面",
  },

  // ---- 運用（2026-09-07に枠だけ用意）。まだ模型が無いので全部 pending ----
  // **中身を作る前でも道すじには出す。** 「作れること」と「運用できること」は別物だと
  // 最初に見えていることに値打ちがある。
  {
    id: "cost", no: 9, status: "pending",
    title: "費用の見方",
    touch: "何にいくらかかっているかを読む",
    fail: "止めたつもりのものが課金され続けている",
    needs: "費用の内訳を読む模型",
  },
  {
    id: "auto_stop", no: 10, status: "pending",
    title: "止め忘れを止める",
    touch: "使わない時間に自動で停止する",
    fail: "夜間も動きっぱなしになっている",
    needs: "時間で動く仕組みの模型",
  },
  {
    id: "logs", no: 11, status: "pending",
    title: "ログと気づき方",
    touch: "落ちたことに気づく仕組みを置く",
    fail: "利用者から言われるまで気づけない",
    needs: "ログと通知の模型",
  },
];

// 身についたこと。**単元と1対1にしない。** 通った単元から導くので、
// 単元を分割・統合しても表示が壊れない
export const GAINS = [
  { id: "route", label: "外への道を通す", from: ["igw_route"] },
  { id: "filter", label: "通信を絞る", from: ["security_group"] },
  { id: "boot", label: "サーバーを起動する", from: ["public_ip"] },
  { id: "split", label: "ネットワークを区切る", from: ["vpc_subnet"] },
  { id: "hide", label: "公開と非公開を分ける", from: ["private_subnet", "sg_reference"] },
  { id: "iac", label: "構成をコードで書く", from: ["cloudformation"] },
];

export const isPlayable = u => u.status === "ready";

export function unitById(id) {
  return UNITS.find(u => u.id === id) || null;
}

export function groupById(id) {
  return GROUPS.find(g => g.id === id) || null;
}

// グループに属する単元。**GROUPSに書いた順で返す**（UNITSの並び順ではない）ので、
// 単元を足すときに並べ替えたければ GROUPS 側だけ直せばよい
export function unitsOfGroup(groupId) {
  const g = groupById(groupId);
  if (!g) return [];
  return g.unitIds.map(unitById).filter(Boolean);
}

// グループの状況。**通過数だけでなく「いま遊べるか」も返す**。
// 全部準備中のグループを、進捗0件と同じ見た目にしないため
export function groupStatus(group, progress) {
  const passedMap = progress?.units || {};
  const units = unitsOfGroup(group.id);
  const playable = units.filter(isPlayable);
  const passed = units.filter(u => passedMap[u.id]?.passedAt);
  return {
    total: units.length,
    playable: playable.length,
    passed: passed.length,
    // 遊べるものが1つも無い＝まだ開けないグループ
    open: playable.length > 0,
    // 遊べるものを全部通した
    cleared: playable.length > 0 && playable.every(u => passedMap[u.id]?.passedAt),
  };
}

export function groupOfUnit(unitId) {
  return GROUPS.find(g => g.unitIds.includes(unitId)) || null;
}

// 続きからやる単元。**通っていない中でいちばん手前の遊べるもの**。
// 全部通っていたら null（画面側で「次に来るもの」を出す）
export function nextUnit(progress) {
  const passed = progress?.units || {};
  // **グループの順で探す**（基礎→応用→運用）。UNITSの並びで探すと、
  // グループをまたいで並べ替えたときに「続きから」が飛ぶ
  for (const g of GROUPS) {
    const hit = unitsOfGroup(g.id).find(u => isPlayable(u) && !passed[u.id]?.passedAt);
    if (hit) return hit;
  }
  return null;
}

export function passedCount(progress) {
  const passed = progress?.units || {};
  return UNITS.filter(u => passed[u.id]?.passedAt).length;
}

export function gainsFor(progress) {
  const passed = progress?.units || {};
  return GAINS.map(g => ({ ...g, got: g.from.some(id => passed[id]?.passedAt) }));
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分`;
  return `${Math.floor(m / 60)}時間${m % 60}分`;
}
