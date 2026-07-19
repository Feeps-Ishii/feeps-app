import {
  Building2, CalendarClock, FileText, LayoutDashboard, Upload, Users,
} from "lucide-react";

// 対象ロールはadmin/clientのみ（instructor/traineeはこのProduct自体に到達不可、
// TrainingApp.jsxのPRODUCTS.rolesで既に除外している。ここはnavの中身のみ）。
export const GRANTS_NAV = {
  admin: [
    { sec: null, items: [["gr_home", "ホーム", LayoutDashboard]] },
    { sec: "助成金管理", items: [
      ["gr_company",      "企業プロフィール",     Building2],
      ["gr_trainees",     "受講生の助成金情報",   Users],
      ["gr_list",         "助成金申請",           FileText],
      ["gr_documents",    "提出書類",             Upload],
      ["gr_reservations", "予約",                 CalendarClock],
    ]},
  ],
  client: [
    { sec: null, items: [["gr_home", "ホーム", LayoutDashboard]] },
    { sec: "助成金管理", items: [
      ["gr_company",      "企業プロフィール",     Building2],
      ["gr_trainees",     "受講生の助成金情報",   Users],
      ["gr_list",         "助成金申請",           FileText],
      ["gr_documents",    "提出書類",             Upload],
      ["gr_reservations", "予約",                 CalendarClock],
    ]},
  ],
};

export const GRANTS_HOME_CARDS = [
  { key: "gr_company",      icon: Building2,     label: "企業プロフィール",   desc: "住所・代表者・助成金向け項目（法人番号等）と支店情報を管理します。" },
  { key: "gr_trainees",     icon: Users,         label: "受講生の助成金情報", desc: "雇用形態・新卒既卒・IT経験と、助成金対象フラグを確認・入力します。" },
  { key: "gr_list",         icon: FileText,      label: "助成金申請",         desc: "申請の一覧・進捗・ステータスを管理します。" },
  { key: "gr_documents",    icon: Upload,        label: "提出書類",           desc: "申請ごとの提出書類をアップロード・確認・審査します。" },
  { key: "gr_reservations", icon: CalendarClock, label: "予約",               desc: "個社面談・成果報告会の予約を管理します。" },
];

// ---- 助成金申請 ----
export const GRANT_STATUS_OPTIONS = [
  { value: "draft", label: "下書き" },
  { value: "preparing", label: "準備中" },
  { value: "submitted", label: "申請済み" },
  { value: "under_review", label: "審査中" },
  { value: "approved", label: "承認" },
  { value: "rejected", label: "却下" },
  { value: "paid", label: "支給済み" },
  { value: "cancelled", label: "取下げ" },
];
export function grantStatusLabel(status) {
  return GRANT_STATUS_OPTIONS.find(o => o.value === status)?.label || status || "下書き";
}
export function grantStatusTone(status) {
  if (status === "approved" || status === "paid") return "green";
  if (status === "rejected" || status === "cancelled") return "red";
  if (status === "submitted" || status === "under_review") return "amber";
  return "muted";
}

export const APPLICATION_TYPE_OPTIONS = [
  { value: "off_the_job", label: "Off-JT（事業外訓練）" },
  { value: "in_company", label: "事業内訓練" },
];
export function applicationTypeLabel(value) {
  return APPLICATION_TYPE_OPTIONS.find(o => o.value === value)?.label || value || "";
}

export const GRANT_TYPE_SUGGESTIONS = [
  "人材開発支援助成金（人材育成支援コース）",
  "人材開発支援助成金（教育訓練休暇等付与コース）",
  "キャリアアップ助成金",
];

// ---- 提出書類 ----
export const DOCUMENT_STATUS_OPTIONS = [
  { value: "submitted", label: "提出済み（確認待ち）" },
  { value: "accepted", label: "受理済み" },
  { value: "rejected", label: "差戻し" },
];
export function documentStatusLabel(status) {
  return DOCUMENT_STATUS_OPTIONS.find(o => o.value === status)?.label || status || "";
}
export function documentStatusTone(status) {
  if (status === "accepted") return "green";
  if (status === "rejected") return "red";
  return "amber";
}
export const DOCUMENT_TYPE_SUGGESTIONS = ["支給申請書", "訓練カリキュラム", "出勤簿", "賃金台帳", "履歴書", "その他"];

// ---- 予約 ----
// grants.mjs実装のRESERVATION_TYPES/RESERVATION_STATUSESに合わせる（設計書ドラフトの
// "interview"/"completed"等とは異なるため、実装済みAPIの値をここで正本とする）。
export const RESERVATION_TYPE_OPTIONS = [
  { value: "individual_interview", label: "個社面談" },
  { value: "result_meeting", label: "成果報告会" },
  { value: "other", label: "その他" },
];
export function reservationTypeLabel(value) {
  return RESERVATION_TYPE_OPTIONS.find(o => o.value === value)?.label || value || "";
}
export const RESERVATION_STATUS_OPTIONS = [
  { value: "proposed", label: "提案中" },
  { value: "confirmed", label: "確定" },
  { value: "cancelled", label: "キャンセル" },
];
export function reservationStatusLabel(status) {
  return RESERVATION_STATUS_OPTIONS.find(o => o.value === status)?.label || status || "";
}
export function reservationStatusTone(status) {
  if (status === "confirmed") return "green";
  if (status === "cancelled") return "muted";
  return "amber";
}

// ---- 受講生の助成金項目 ----
export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "regular", label: "正社員" },
  { value: "contract", label: "契約社員" },
  { value: "dispatch", label: "派遣" },
  { value: "part_time", label: "パート・アルバイト" },
  { value: "other", label: "その他" },
];
export function employmentTypeLabel(value) {
  return EMPLOYMENT_TYPE_OPTIONS.find(o => o.value === value)?.label || (value ? value : "未設定");
}
export const GRADUATE_STATUS_OPTIONS = [
  { value: "new_graduate", label: "新卒" },
  { value: "existing_graduate", label: "既卒" },
];
export function graduateStatusLabel(value) {
  return GRADUATE_STATUS_OPTIONS.find(o => o.value === value)?.label || (value ? value : "未設定");
}
export const IT_EXPERIENCE_OPTIONS = [
  { value: "none", label: "未経験" },
  { value: "under_1y", label: "1年未満" },
  { value: "1to3y", label: "1〜3年" },
  { value: "over_3y", label: "3年以上" },
];
export function itExperienceLabel(value) {
  return IT_EXPERIENCE_OPTIONS.find(o => o.value === value)?.label || (value ? value : "未設定");
}

// 企業プロフィールのうち、実装済みgrants.mjsはフィールドレベルの権限を分けていないが
// （§12-1設計上はadmin編集のみとされる項目）、法令・行政手続きに関わる確定情報の
// 誤入力を防ぐため、UI側でclientには読み取り専用とするガードを設ける。
export const COMPANY_ADMIN_ONLY_FIELDS = [
  "corporateNumber", "capitalAmount", "employeeCount", "standardWorkingHours", "trainingWorkingHours",
];

export const EMPTY_GRANT_FORM = {
  companyId: "", courseId: "", grantType: "", applicationType: "off_the_job",
  assigneeUserId: "", remarks: "", targetTraineeIds: [],
};

export const EMPTY_RESERVATION_FORM = {
  type: "individual_interview", companyId: "", courseId: "", traineeId: "",
  scheduledAt: "", durationMinutes: "60", location: "", onlineUrl: "", note: "",
  confirmOnCreate: false,
};
