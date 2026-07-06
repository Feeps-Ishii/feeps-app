# Feeps 研修管理アプリ

Feeps 研修管理クラウドのフロントエンド（React + Vite + Tailwind CSS v4）。

## 必要環境

- Node.js 18 以上（推奨 20+）

## セットアップ

```bash
npm install
```

## ローカル開発

```bash
npm run dev
```

表示された `http://localhost:5173` をブラウザで開きます。

## 本番ビルド

```bash
npm run build
```

`dist/` に静的ファイルが出力されます。これを S3 + CloudFront に配置します。

```bash
npm run preview   # ビルド結果をローカルで確認
```

## 構成

```
feeps-app/
├─ index.html          # Vite エントリ
├─ vite.config.js      # React + Tailwind v4 プラグイン
├─ package.json
├─ deploy.bat          # build → S3 sync → CloudFront invalidation
└─ src/
   ├─ main.jsx         # React マウント
   ├─ TrainingApp.jsx  # App shell / Product Router
   ├─ api.js / aws.js  # API通信 / Cognito認証
   ├─ components/common/  # 共通UI + theme.js
   └─ products/        # Product別実装（learning/analytics/matching/talent/training/admin）
```

> 詳細な構成・開発ルール・AI向けガイドは [AGENTS.md](AGENTS.md) と `../../docs/START_HERE.md` を参照。
> Backend（Cognito認証・API Gateway + Lambda・DynamoDB）と接続済みの本番稼働アプリです。
