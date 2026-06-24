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
├─ .gitignore
└─ src/
   ├─ main.jsx         # React マウント
   ├─ index.css        # @import "tailwindcss";
   └─ TrainingApp.jsx  # アプリ本体（モック）
```

## Git（初回）

```bash
git init
git add .
git commit -m "chore: initial project setup (Vite + React + Tailwind)"
git branch -M main
git remote add origin <あなたのリポジトリURL>
git push -u origin main
```

> 補足: 現状はバックエンド未接続のモックです。今後 Cognito 認証・API Gateway + Lambda・DynamoDB を段階的に接続していきます。
