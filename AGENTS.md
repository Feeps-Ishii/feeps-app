# Feeps Frontend AGENTS.md

最終更新: 2026-07-07。
**まず [../../AGENTS.md](../../AGENTS.md)（プロジェクト全体のCodex向けエントリポイント）を読むこと。** 実装前報告フォーマット・自律実行ルール・ドキュメント更新義務など、全リポジトリ共通のルールはそちらに集約されている。本ファイルはFrontendリポジトリ固有の補足情報のみを持つ。

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

- 新機能はProduct配下へ（配置判断は[../../AGENTS.md §4](../../AGENTS.md)のLevel 1〜4）
- デザインは [DESIGN_BRIEF.md](DESIGN_BRIEF.md) に従う（生の色コード・z-index直書き禁止）
- 画面を追加・削除したら `../../docs/frontend/screen-inventory.md` を更新

## AWS識別子

正典: [../../docs/architecture/aws-infrastructure.md](../../docs/architecture/aws-infrastructure.md)（2026-07-07棚卸しで実機照合済み）／API一覧: [../../docs/api/api-routes.md](../../docs/api/api-routes.md)

- API Gateway: `https://yit7ypsa40.execute-api.ap-northeast-1.amazonaws.com`
- Cognito: Pool `ap-northeast-1_QG4KZb06z` / Client `280tvccus7fe6kc6uhvsjs9n4g` / **グループ: `instructor` / `admin` / `trainee`の3つ**（`client`グループは実在しない。コード上は`groups.includes("client")`判定が複数箇所にあるが実際のCognitoには未作成、2026-07-07棚卸しで判明した既知の齟齬）
- 配信: CloudFront `d3bnmx82i79vdj.cloudfront.net`（distribution `E2E41GI86GW1JM`）+ S3 `feeps-app`（完全非公開、CloudFront Origin Access Control経由のみ）

## Repository固有の禁止事項（明示指示なしに行わない）

React Router導入／Redux・Zustand・Context置き換え／TypeScript化／Tailwind設定変更／デザイン全面刷新／package追加

（deploy・commitの実行判断は[../../AGENTS.md §6](../../AGENTS.md)の自律実行ルール・4点セットに従う。ここでの「禁止」はAPI URL変更やライブラリ構成変更など、実行判断とは別種の設計変更を指す）

## Commands

```bash
npm run dev     # 開発サーバー(5173)
npm run build   # 必須の検証
deploy          # deploy.bat（build→S3 sync→CloudFront invalidation）
gitpush "メッセージ"  # gitpush.bat
```

## How to Work

1. [../../AGENTS.md](../../AGENTS.md) → [../../docs/START_HERE.md](../../docs/START_HERE.md) → 対象Productのコードを読む
2. 変更方針を報告フォーマット（[../../AGENTS.md §5](../../AGENTS.md)）で説明
3. 最小差分で実装 → `npm run build`
4. 変更内容と確認結果を日本語で報告 → ドキュメント更新（[../../AGENTS.md §7](../../AGENTS.md)）
