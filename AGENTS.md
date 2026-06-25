# Feeps Frontend AGENTS.md

このファイルは Codex などのコーディングエージェント向けの開発指示書です。
`feeps-app` のルートに `AGENTS.md` として配置してください。

---

## Project Overview

Feeps 研修管理クラウドは、B2B 向けの研修管理 SaaS です。
フロントエンドは React / Vite / Tailwind CSS / AWS Amplify Auth で構成されています。

- 主要ファイル: `src/TrainingApp.jsx`
- API ヘルパー: `src/api.js`
- 認証設定: `src/aws.js`
- ブランドカラー: `#00A0D2`
- 回答・説明は日本語

現在 `TrainingApp.jsx` は巨大な単一ファイルです。
機能完成までは大きな分割を行わず、既存構成を維持してください。

---

## Development Rules

- 変更は必要最小限にする
- 既存デザイン・既存UIを大きく崩さない
- 1回の作業では1機能に集中する
- 勝手な大規模リファクタリングは禁止
- 既存コンポーネント・既存ヘルパーを優先して使う
- Tailwind CSS の既存スタイルに合わせる
- 新しいライブラリ追加は原則禁止
- 不明点がある場合は、実装前に確認する
- 変更後は必ず `npm run build` を実行する

---

## Important Files

### `src/TrainingApp.jsx`

ほぼ全画面・全機能が入っている中心ファイルです。
主なコンポーネント例:

- `AdminUsers`
- `AdminCompanies`
- `AdminCourses`
- `Curriculum`
- `Materials`
- `Reports`
- `AttendanceManage`
- `TraineeAttendance`
- `Tests`
- `TraineePortfolio`
- `GoalsView`
- `TraineeList`
- `Karte`

共通ヘルパー例:

- `Modal`
- `Field`
- `fieldCls`
- `useNameMap`
- `fallbackName`
- `todayStr`
- `fmtLongDate`
- `COURSE_KINDS`
- `ROLE_OPTS`
- `roleLabel`
- `kindLabel`

### `src/api.js`

API Gateway への通信ヘルパーです。
`fetchAuthSession()` から Cognito ID Token を取得し、`Authorization: Bearer` として送信します。

利用可能な関数:

- `apiGet(path)`
- `apiPut(path, body)`
- `apiPost(path, body)`

---

## AWS / Backend Context

バックエンドは別フォルダ `feeps-api` にあります。
フロントからは API Gateway を呼び出します。

- API Gateway URL: `https://yit7ypsa40.execute-api.ap-northeast-1.amazonaws.com`
- Cognito User Pool: `ap-northeast-1_QG4KZb06z`
- Cognito App Client: `280tvccus7fe6kc6uhvsjs9n4g`
- Region: `ap-northeast-1`
- フロント配信: CloudFront + S3
- CloudFront domain: `d3bnmx82i79vdj.cloudfront.net`
- CloudFront distribution ID: `E2E41GI86GW1JM`
- S3 site bucket: `feeps-app`

Cognito グループ:

- `trainee`
- `instructor`
- `client`
- `admin`

---

## Existing API Routes Used by Frontend

主なAPI:

- `GET /reports/me`
- `PUT /reports/me`
- `GET /reports?date=`
- `PUT /reports/{traineeId}/comment`
- `GET /attendance/me`
- `PUT /attendance/me`
- `GET /attendance?date=`
- `PUT /attendance/{traineeId}`
- `GET /tests/me`
- `PUT /tests/{testId}/results/me`
- `GET /tests/{testId}/results`
- `GET /skills/me`
- `PUT /skills/me`
- `GET /tasks/me`
- `PUT /tasks/me`
- `GET /tasks/{traineeId}`
- `GET /karte/{traineeId}`
- `POST /karte/{traineeId}`
- `GET /profile/me`
- `PUT /profile/me`
- `GET /trainees`
- `GET /admin/users`
- `POST /admin/users`
- `PUT /admin/users/{userId}`
- `GET /companies`
- `POST /companies`
- `PUT /companies/{id}`
- `GET /companies/{id}/trainees`
- `GET /courses`
- `POST /courses`
- `PUT /courses/{id}`
- `GET /courses/{id}/trainees`
- `GET /courses/{courseId}/curriculum`
- `PUT /courses/{courseId}/curriculum`
- `GET /me/courses`
- `POST /materials/upload-url`
- `POST /materials`
- `GET /materials?courseId=`
- `GET /materials/view?courseId=&materialId=`

---

## Current Priority

直近の作業対象は管理画面の作り込みです。

優先順:

1. 企業管理
   - 一覧検索
   - 並び替え
   - 詳細表示
   - 編集保存
   - 所属受講生表示

2. コース管理
   - 一覧検索
   - 並び替え
   - 詳細表示
   - 編集保存
   - 所属受講生表示
   - カリキュラム画面への導線

3. ユーザー管理
   - 詳細表示
   - 氏名・ロール・所属企業編集
   - ロール変更時の注意表示

その後、ホーム画面のサマリーを実データ集計に置き換えます。

---

## UI Direction

企業向けSaaSらしい、落ち着いたUIを目指します。

- 白背景中心
- 余白多め
- 角丸カード
- 控えめな影
- ブランドカラー `#00A0D2`
- 強調色は使いすぎない
- 重要ボタンだけ色をつける
- 一覧・詳細・編集の導線をわかりやすくする

---

## Prohibited Changes

明示指示なしに以下を行わないでください。

- React Router 導入
- Redux / Zustand / Context への置き換え
- TypeScript 化
- Tailwind 設定変更
- デザイン全面刷新
- コンポーネント大分割
- API URL の変更
- 認証方式の変更
- package 追加

---

## Validation Commands

作業後は必ず実行してください。

```bash
npm run build
```

ビルドが失敗した場合は、エラーを確認して修正してください。

---

## Deploy Command

ユーザーは `feeps-app` フォルダに `deploy.bat` を作成済みです。
デプロイ時はユーザーが以下を実行します。

```bat
deploy
```

内容:

```bat
npm run build && aws s3 sync dist/ s3://feeps-app --delete && aws cloudfront create-invalidation --distribution-id E2E41GI86GW1JM --paths "/*"
```

Git push は以下です。

```bat
gitpush "コミットメッセージ"
```

---

## How to Work

作業時は以下の流れで進めてください。

1. 対象ファイルを読む
2. 変更方針を短く説明する
3. 最小差分で実装する
4. `npm run build` を実行する
5. 変更内容と確認結果を日本語で報告する
6. 次の一手を1つだけ提案する
