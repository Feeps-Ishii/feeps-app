# Feeps Frontend AGENTS.md

最終更新: 2026-07-06（Product分割前の旧記述を現行化）
Codex等のコーディングエージェント向けFrontendリポジトリガイド。
**まず [../../docs/START_HERE.md](../../docs/START_HERE.md) を読むこと。ルールの正典は `../../AI_RULES.md`。**

---

## Stack

React 18 / Vite 6 / Tailwind CSS v4 / AWS Amplify Auth（Cognito）。回答・説明は日本語。

## 構成（Product分割済み）

```
src/
  main.jsx          … エントリ（<App/>のみ）
  TrainingApp.jsx   … App shell / Product Router（大きな機能追加禁止）
  api.js            … apiGet/apiPut/apiPost/apiDelete（Cognito ID Token付与）
  aws.js            … Amplify Auth設定
  components/common/ … 共通UI + theme.js（デザイントークン正典）
  hooks/common/
  products/{learning, analytics, matching, talent, training, admin}/
```

- 新機能はProduct配下へ（配置判断は`AI_RULES.md`のLevel 1〜4）
- デザインは [DESIGN_BRIEF.md](DESIGN_BRIEF.md) に従う（生の色コード・z-index直書き禁止）
- 画面を追加・削除したら `../../docs/frontend/screen-inventory.md` を更新

## AWS / Backend

識別子の正典: [../../docs/architecture/aws-infrastructure.md](../../docs/architecture/aws-infrastructure.md)
API一覧: [../../docs/api/api-routes.md](../../docs/api/api-routes.md)

- API Gateway: `https://yit7ypsa40.execute-api.ap-northeast-1.amazonaws.com`
- Cognito: Pool `ap-northeast-1_QG4KZb06z` / Client `280tvccus7fe6kc6uhvsjs9n4g` / グループ trainee・instructor・client・admin
- 配信: CloudFront `d3bnmx82i79vdj.cloudfront.net`（distribution `E2E41GI86GW1JM`）+ S3 `feeps-app`

## Development Rules（要点）

- 最小差分・1タスク1機能・ついで修正禁止・既存UI/機能を壊さない
- 既存の共通コンポーネント・ヘルパーを優先して使う。新ライブラリ追加は事前確認必須
- 変更後は必ず `npm run build`
- 完了時は `../../CHANGELOG.md` と `../../HANDOFF.md` を更新（ルール: `../../docs/operations/documentation-rules.md`）

## Prohibited（明示指示なしに行わない）

React Router導入／Redux・Zustand・Context置き換え／TypeScript化／Tailwind設定変更／デザイン全面刷新／API URL変更／認証方式変更／package追加／deploy・git commit

## Commands

```bash
npm run dev     # 開発サーバー(5173)
npm run build   # 必須の検証
```

Deploy（ユーザー明示指示時のみ）: `deploy`（deploy.bat）／Git push: `gitpush "メッセージ"`

## How to Work

1. docs/START_HERE.md → 対象Productのコードを読む
2. 変更方針を短く説明（配置判断つき）
3. 最小差分で実装 → `npm run build`
4. 変更内容と確認結果を日本語で報告 → ドキュメント更新
