// 助成金申請の「計画申請・変更申請・支給申請」3ステージの状態・期限・次アクションを算出する
// 純粋関数群（2026-07-20 UX改善、docs/specs/grant-management-spec.md §16-2）。
//
// 設計メモ（既存の8値status（draft〜cancelled）は申請全体の単一パイプラインで、様式ごとの
// 個別ステータスを持たない。厳密な3ステージ管理ではなく、既存フィールド（appliedAt=計画申請日・
// changeDate=変更予定日・documentsSubmittedAt=支給申請書類提出日・paidAt=支給日・status）から
// 近似的に現在ステージと状態を導出する近似モデルである）。
// Backend変更は最小限（GrantへchangeDateを追加のみ）。日付計算はすべてFrontend側。

export const GRANT_STAGE_DEFS = [
  { key: "plan", label: "計画申請" },
  { key: "henkou", label: "変更申請" },
  { key: "shikyu", label: "支給申請" },
];

function parseISODate(value) {
  const s = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}
function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}
function toISO(date) {
  return date.toISOString().slice(0, 10);
}
function daysBetween(fromDate, toDate) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((toDate.getTime() - fromDate.getTime()) / MS);
}
function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// deadlineフィールドの共通シェイプ: { date, daysRemaining, overdue, urgent } または
// 起点日が未設定の場合は null（0日・NaNには絶対に丸めない）。
function buildDeadline(deadlineDate) {
  if (!deadlineDate) return null;
  const t = today();
  const daysRemaining = daysBetween(t, deadlineDate);
  return {
    date: toISO(deadlineDate),
    daysRemaining,
    overdue: daysRemaining < 0,
    urgent: daysRemaining >= 0 && daysRemaining <= 7,
  };
}

function planDeadline(course) {
  const start = parseISODate(course?.startDate);
  if (!start) return null;
  return buildDeadline(addMonths(start, -1));
}
function henkouDeadline(grant) {
  const change = parseISODate(grant?.changeDate);
  if (!change) return null;
  return buildDeadline(addDays(change, -1));
}
function shikyuDeadline(course) {
  const end = parseISODate(course?.endDate);
  if (!end) return null;
  return buildDeadline(addMonths(end, 2));
}

const STATUS_LABELS = {
  draft: "下書き", preparing: "準備中", submitted: "提出済み", under_review: "審査中",
  approved: "承認", rejected: "却下", paid: "支給済み", cancelled: "取下げ",
};

// 各ステージの状態（未着手/準備中/提出済み/受理/対象外 等）を算出する。
function planState(grant) {
  if (!grant.appliedAt) return { value: "not_started", label: "未着手" };
  if (["rejected", "cancelled"].includes(grant.status)) return { value: grant.status, label: STATUS_LABELS[grant.status] };
  if (["approved", "paid"].includes(grant.status)) return { value: "accepted", label: "受理" };
  if (["submitted", "under_review"].includes(grant.status)) return { value: "submitted", label: "提出済み" };
  return { value: "preparing", label: "準備中" };
}
function henkouState(grant) {
  if (!grant.changeDate) return { value: "not_applicable", label: "対象外" };
  if (grant.documentsSubmittedAt) return { value: "submitted", label: "提出済み" };
  const deadline = henkouDeadline(grant);
  if (deadline?.overdue) return { value: "overdue", label: "期限超過" };
  return { value: "preparing", label: "準備中" };
}
function shikyuState(grant) {
  if (grant.paidAt || grant.status === "paid") return { value: "accepted", label: "受理" };
  if (["rejected", "cancelled"].includes(grant.status)) return { value: grant.status, label: STATUS_LABELS[grant.status] };
  if (grant.documentsSubmittedAt) return { value: grant.status === "under_review" ? "under_review" : "submitted", label: grant.status === "under_review" ? "審査中" : "提出済み" };
  if (planState(grant).value === "accepted") return { value: "preparing", label: "準備中" };
  return { value: "not_started", label: "未着手" };
}

const RESOLVED_STATES = new Set(["accepted", "submitted", "under_review", "rejected", "cancelled", "not_applicable"]);

// grant（GET /grants の1件）とcourse（GET /grants/company-courses の1件。startDate/endDate必須）から
// 3ステージ分の { key, label, state, deadline, current } 配列を返す。courseが取得できていない場合、
// startDate/endDateはnullとして扱い、deadlineはnull（「日程未設定」表示用）になる。
export function computeGrantStages(grant, course) {
  const plan = { key: "plan", label: "計画申請", state: planState(grant), deadline: planDeadline(course) };
  const henkou = { key: "henkou", label: "変更申請", state: henkouState(grant), deadline: henkouDeadline(grant) };
  const shikyu = { key: "shikyu", label: "支給申請", state: shikyuState(grant), deadline: shikyuDeadline(course) };
  const stages = [plan, henkou, shikyu];

  // 現在ステージ = まだ解決していない（未着手/準備中/期限超過）最初のステージ。
  // 全ステージ解決済み（対象外含む）なら最後の未対象外ステージを現在ステージとして表示する。
  let current = stages.find(s => !RESOLVED_STATES.has(s.state.value)) || null;
  if (!current) current = [...stages].reverse().find(s => s.state.value !== "not_applicable") || shikyu;
  return stages.map(s => ({ ...s, current: s.key === current.key }));
}

// 現在ステージ・期限超過/切迫・不足情報から、次にやることを最大3件返す（文字列配列）。
// company/documentsは取得できていれば渡す（取れなければ該当チェックはスキップ＝unknown分離）。
export function computeNextActions({ grant, stages, course, company, documents }) {
  const actions = [];
  const push = (msg) => { if (msg && !actions.includes(msg)) actions.push(msg); };

  const overdueStage = stages.find(s => s.deadline?.overdue && !RESOLVED_STATES.has(s.state.value));
  if (overdueStage) push(`「${overdueStage.label}」の期限を過ぎています。至急ご確認ください。`);
  const urgentStage = stages.find(s => s.deadline?.urgent && !RESOLVED_STATES.has(s.state.value));
  if (urgentStage) push(`「${urgentStage.label}」の期限まで残り${urgentStage.deadline.daysRemaining}日です。`);

  const current = stages.find(s => s.current);
  if (current) {
    if (current.key === "plan") {
      if (!course) push("コースの開始日・終了日が未設定です。設定すると期限を確認できます。");
      if (current.state.value === "not_started" || current.state.value === "preparing") {
        push("計画申請の書類を作成・提出してください（Excel帳票を生成できます）。");
      } else if (current.state.value === "submitted") {
        push("計画申請の審査結果をお待ちください。");
      }
    } else if (current.key === "henkou") {
      if (current.state.value === "overdue" || current.state.value === "preparing") {
        push("変更届（様式第2-1号）を作成・提出してください。");
      }
    } else if (current.key === "shikyu") {
      if (current.state.value === "not_started" || current.state.value === "preparing") {
        push("支給申請書類一式を準備してください（Excel帳票を生成できます）。");
      } else if (current.state.value === "submitted" || current.state.value === "under_review") {
        push("支給申請の審査結果をお待ちください。");
      } else if (current.state.value === "accepted") {
        push("支給手続きが完了しています。書類を保管してください。");
      }
    }
  }

  if (!Array.isArray(grant.targetTraineeIds) || grant.targetTraineeIds.length === 0) {
    push("対象受講生が未選択です。選択してください。");
  }
  if (company && !company.enterpriseSize) {
    push("企業プロフィールで企業規模区分（中小企業／大企業）を設定してください。");
  }
  if (Array.isArray(documents)) {
    if (documents.length === 0) {
      push("提出書類がまだありません。アップロードしてください。");
    } else if (documents.some(d => d.status === "rejected")) {
      push("差し戻された書類があります。再提出してください。");
    }
  }

  return actions.slice(0, 3);
}
