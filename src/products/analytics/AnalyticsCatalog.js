import { Activity, Gauge, NotebookPen, Receipt } from "lucide-react";

export const ANALYTICS_NAV = [
  { sec: null, items: [["an_home", "ホーム", Activity]] },
  { sec: "分析", items: [["an_awscosts", "AWS利用料金", Receipt], ["an_report", "月次レポート", NotebookPen], ["an_risk", "リスク分析", Gauge]] },
];

export const ANALYTICS_HOME_CARDS = [
  { key: "an_awscosts", icon: Receipt,     label: "AWS利用料金",  desc: "月別のAWS利用料金とBedrock使用量を確認します。" },
  { key: "an_risk",     icon: Gauge,       label: "リスク分析",   desc: "受講生のリスクを自動検出・アラート表示します。" },
  { key: "an_report",   icon: NotebookPen, label: "月次レポート", desc: "研修実績・受講状況の月次集計を確認します。" },
];

export const RISK_SIG_LABEL = {
  日報: "日報（未提出）",
  勤怠: "勤怠（欠席・遅刻・未登録）",
  テスト: "テスト（点数・未受験）",
  コメント: "コメント未対応",
};

// AWSリソース棚卸し（静的定義・手動メンテ）。詳細: docs/operations/aws-resource-inventory-2026-07.md
export const AWS_RESOURCE_INVENTORY_DATE = "2026-07-22";
export const AWS_RESOURCE_INVENTORY = [
  { service: "DynamoDB", detail: "22テーブル（PITR全有効）", note: "アプリの主データストア" },
  { service: "Lambda", detail: "1関数（feeps-api-ApiFunction）", note: "APIバックエンド" },
  { service: "API Gateway", detail: "HTTP API 1本", note: "Lambda統合のAPIエンドポイント" },
  { service: "S3", detail: "2バケット（教材／配信）", note: "教材＝バージョニング＋90日ライフサイクル、配信＝フロントエンド静的ホスティング" },
  { service: "CloudFront", detail: "配信ディストリビューション 1", note: "フロントエンド配信CDN" },
  { service: "Cognito", detail: "User Pool 1", note: "認証基盤" },
  { service: "Bedrock", detail: "オンデマンド呼び出し", note: "AI機能（テスト問題生成・採点等）" },
  { service: "Cost Explorer API", detail: "24hキャッシュ", note: "本画面の料金取得元" },
];
