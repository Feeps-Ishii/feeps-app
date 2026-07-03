import { Activity, Gauge, NotebookPen, Receipt } from "lucide-react";

export const ANALYTICS_NAV = [
  { sec: null, items: [["an_home", "ホーム", Activity]] },
  { sec: "分析", items: [["an_awscosts", "AWS利用料金", Receipt], ["an_report", "月次レポート", NotebookPen], ["an_risk", "リスク分析", Gauge]] },
];

export const ANALYTICS_HOME_CARDS = [
  { key: "an_awscosts", icon: Receipt,     label: "AWS利用料金",  desc: "月別のAWS利用料金とBedrock使用量を確認します。", ready: true },
  { key: "an_risk",     icon: Gauge,       label: "リスク分析",   desc: "受講生のリスクを自動検出・アラート表示します。", ready: true },
  { key: "an_report",   icon: NotebookPen, label: "月次レポート", desc: "研修実績・受講状況の月次集計を確認します。", ready: false },
];

export const RISK_SIG_LABEL = {
  日報: "日報（未提出）",
  勤怠: "勤怠（欠席・遅刻・未登録）",
  テスト: "テスト（点数・未受験）",
  コメント: "コメント未対応",
};
