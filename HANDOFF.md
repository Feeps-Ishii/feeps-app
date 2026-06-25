# Feeps 研修管理クラウド — 引き継ぎ資料

このドキュメントは、別のチャットで開発を継続するための引き継ぎ資料です。
新しいチャットの冒頭で、この `HANDOFF.md` と、最新の `feeps-app/src/TrainingApp.jsx`・
`feeps-api/src/app.mjs`・`feeps-api/template.yaml` を一緒に渡してください。それで文脈ゼロから続行できます。

---

## 0. これは何か
- B2B 向け「研修管理クラウド」SaaS。AWS サーバーレス構成。
- 開発者は Keisuke（株式会社Feeps、ソロ開発、Windows / コマンドプロンプト、基本モバイルでやり取り）。
- 日本語でやり取り。回答は簡潔に、毎ターン「ファイルを編集→ビルド検証→成果物を渡す→次の一手を提示」。
- ブランドカラー シアン `#00A0D2`。

---

## 1. 進め方の規約（重要・厳守）
- **ローカル2フォルダ**（どちらも OneDrive 配下＝ロック問題あり）:
  - フロント: `feeps-app`（リポジトリ https://github.com/Feeps-Ishii/feeps-app.git）。コンテナ作業パス `/home/claude/feeps-app/`。
  - バックエンド SAM: `feeps-api`（まだ Git 管理していない）。コンテナ作業パス `/home/claude/feeps-api/`。
- **バッチで操作**（ユーザーはこれを好む）。`feeps-app` フォルダに2つ作成済み:
  - `deploy.bat` = `npm run build && aws s3 sync dist/ s3://feeps-app --delete && aws cloudfront create-invalidation --distribution-id E2E41GI86GW1JM --paths "/*"` → コマンドは **`deploy`** の一言。
  - `gitpush.bat`（引数=コミットメッセージ。省略可）→ **`gitpush "メッセージ"`** または `gitpush`。
- **バックエンドのデプロイ手順**（OneDrive ロック対策込み・毎回これ）:
  ```
  rmdir /s /q .aws-sam
  sam build && sam deploy
  ```
  - `samconfig.toml` は保存済みなので `--guided` 不要。
  - OneDrive で `.aws-sam` が消せない時は OneDrive 同期を一時停止。根本対策＝プロジェクトを `C:\dev` に移す（ユーザーは当面 OneDrive のまま、後回し選択）。
- **成果物の渡し方**: コンテナ内で編集→`npm run build`（フロント）／`node --check src/app.mjs` と `cfn-lint template.yaml`（バックエンド）で検証→`/mnt/user-data/outputs/` にコピーして present_files。
  - フロント変更は基本 `TrainingApp.jsx` 1枚。バックエンドは `app.mjs`（＋必要時 `template.yaml`／`src/package.json`）。
- **毎回 1 機能ずつ**本物化する方針（一気にやらない）。各機能は「受講生が書く→保存→講師が見る」のように一周させてから次へ。
- 回答は日本語、簡潔、最後に動作確認手順と次の一手。デプロイで詰まったら画面を見てもらって対応。

---

## 2. AWS 主要識別子
- アカウント: `feeps`（ID **904684146413**）、リージョン **ap-northeast-1**、GitHub ユーザー `Feeps-Ishii`。
- フロント配信: CloudFront ドメイン **d3bnmx82i79vdj.cloudfront.net**、distribution ID **E2E41GI86GW1JM**、S3 サイトバケット **feeps-app**。
- Cognito ユーザープール **ap-northeast-1_QG4KZb06z**、アプリクライアント（SPA・シークレット無し）**280tvccus7fe6kc6uhvsjs9n4g**。
- API Gateway ベース URL: **https://yit7ypsa40.execute-api.ap-northeast-1.amazonaws.com**
- SAM スタック名: **feeps-api**。
- Cognito グループ（＝ロール）: `trainee` / `instructor` / `client` / `admin`。本人アカウント `k-ishii@feeps.co.jp` は instructor と admin 両方に所属。
- 資料用 S3 バケット: **feeps-materials-904684146413**（テンプレートで自動作成。非公開、署名付きURL経由のみ）。

---

## 3. アーキテクチャ / スタック
### フロント（`feeps-app`）
- Vite + React 18 + Tailwind v4 + aws-amplify v6（Auth）。
- 単一ファイル `src/TrainingApp.jsx`（巨大）。ほぼ全機能がここに入る。
- `src/aws.js`（Amplify.configure：プール/クライアントID）。`src/main.jsx` が `./aws.js` を import。
- `src/api.js`：API 呼び出しヘルパー。`fetchAuthSession()` で **ID トークン**を取得し `Authorization: Bearer` で付与。`apiGet/apiPut/apiPost` をエクスポート。BASE は API GW URL。
- ログイン：自前フォーム（Amplify `signIn`）。起動時 `getCurrentUser()` で既ログインなら自動入室。`signIn` 前に `signOut()`（"already signed in" 回避）。初回ログインの新パスワード設定（`confirmSignIn`）対応済み。`role`/`view` は localStorage 永続（F5 で画面維持）。アプリ内でロール切替ボタンあり（暫定。本来は Cognito グループ由来）。

### バックエンド（`feeps-api`、SAM）
- `template.yaml` + `src/app.mjs`（単一 Lambda ルーター、Node 22、arm64）。
- HTTP API（API Gateway v2）＋ Cognito JWT オーソライザー（デフォルト認証）。
- **CORS は Lambda で処理**（ゲートウェイの CORS は使わない）。`OPTIONS /{proxy+}` は `Auth: Authorizer: NONE` の専用ルートで Lambda に通し、全レスポンスに CORS ヘッダーを付与。`_origin` をモジュール変数で保持。許可オリジン＝CloudFront + localhost:5173。
- ルーティング：`event.requestContext.http` の path/method を `seg = path.split('/')` で分解して分岐。
- 認可：`claims = event.requestContext.authorizer.jwt.claims`。`sub`、`cognito:groups`（HTTP API では文字列化されるので `String(...).includes()` で判定）。`isInstructor = includes('instructor'|'admin')`、`isAdmin = includes('admin')`。
- フロントは **ID トークン**を送る（access ではなく id。audience=クライアントID で検証）。
- `src/package.json` は `{"type":"module"}` ＋依存 `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`（署名URL用。`sam build` で同梱）。その他 AWS SDK（dynamodb, lib-dynamodb, cognito-identity-provider）は Lambda 同梱ランタイム SDK を使用（package.json に入れない）。

### DynamoDB テーブル（全て PAY_PER_REQUEST）
| テーブル | PK | SK | GSI | 用途 |
|---|---|---|---|---|
| Reports | traineeId | date | byDate(date,traineeId) | 日報 |
| Attendance | traineeId | date | byDate(date,traineeId) | 勤怠 |
| TestResults | traineeId | testId | byTest(testId,traineeId) | テスト結果 |
| Skills | traineeId | sk("PORTFOLIO") | — | スキル/スキルシート |
| Tasks | traineeId | sk("DONE") | — | 目標タスク達成マップ |
| Karte | traineeId | memoId | — | 講師メモ |
| Profiles | userId(sub) | — | byRole(role,userId) | 氏名/ロール/所属企業/コース |
| Companies | companyId | — | — | 企業 |
| Courses | courseId | — | — | コース（kind: shinjin/regular） |
| Curriculum | courseId | sk("CURRICULUM") | — | 各コースの sessions 配列 |
| Enrollments | courseId | traineeId | byTrainee(traineeId,courseId) | 受講生×コース（多対多） |
| Materials | courseId | materialId | — | 研修資料メタ（mode: view/download, s3key, title, filename） |

---

## 4. 設計の確定事項（DECISIONS）
- **コア4データから着手**（日報・勤怠・テスト・スキル）→ 順次拡張、という方針で進めた。
- **概念ごとに1テーブル**（単一テーブル設計ではなく素直なマルチテーブル）。
- 静的のままにするもの：テスト定義（TESTS。受験/結果は本物だが「テスト作成」はモック）、問題バンク等。
- **企業とコースは親子にしない**。受講生が「所属企業（1つ、profiles.company）」＋「所属コース（複数、Enrollments）」を持つ。これで合同コース（複数企業混在）も多重所属（新人研修＋定常を同時）も自然に表現。
- **コースは種別 kind** を持つ：`shinjin`（新人研修）/`regular`（定常）。管理者が見分けられる。
- **企業担当者(client)は自社の受講生のみ**閲覧（`/trainees` を profiles.company でフィルタ）。講師・管理者は全体。
- **受講生のコース所属は作成時1つ**から（複数割り当ては次段）。
- **氏名表示**：Profiles に氏名。講師ビュー（日報ボード・勤怠管理・テスト結果）は `useNameMap()`（`/trainees`）で ID→氏名解決。未登録は「受講生 +ID先頭」フォールバック。
- **管理者ユーザー作成**：Cognito 作成（仮パスワード・初回変更必須＝`Permanent:false`）＋ロールのグループ割当＋Profiles 保存＋（受講生なら）Enrollment 作成。
- **PDF資料**：署名付きURL方式（ブラウザ→S3直接、Lambda は URL 発行のみ）。アップロードは PUT 署名URL（5分）→ 完了後メタ保存。閲覧は GET 署名URL（**2時間**）。資料ごとに `mode`：view（ブラウザ表示）/ download（`ResponseContentDisposition: attachment` で必ず保存）。**閲覧はアプリ内 iframe をやめて別タブで開く**（レイアウト崩れ対策・汎用性）。ポップアップブロック回避のためクリック直後に空タブを開いてから URL 遷移。
- **カリキュラム⇄資料の紐づけ**：session に **materialIds 配列**（複数資料）。旧 `materialId`（単一）/`materialRef`（テキスト）は後方互換で配列扱いに正規化（`sessMids()`）。閲覧側は資料ボタンが並ぶ→別タブで開く。
- **サンプルバッジ**：まだ DB 未連携の画面に黄色い注意バー。`SAMPLE_VIEWS` 集合で中央管理（App の `{screen}` 描画直前）。本物化したら集合から外す。現在 `SAMPLE_VIEWS = new Set(["matching","risk"])`。
- **管理画面の作り込み**（詳細遷移・編集・絞り込み・ソート）は専用フェーズで実施（土台のバックエンドは実装済み、フロント未着手＝次の作業）。
- **AI（Bedrock）は最後**にまとめて。テスト作成画面の手動部分を先に本物化し、その上に AI 生成を後載せ、という分け方。

---

## 5. 実装済み API ルート（`app.mjs`）
- 日報：`GET/PUT /reports/me`、`GET /reports?date=`（講師）、`PUT /reports/{traineeId}/comment`（講師）。
- 勤怠：`GET/PUT /attendance/me`、`GET /attendance?date=`（講師）、`PUT /attendance/{traineeId}`（講師：修正）。
- テスト：`GET /tests/me`、`PUT /tests/{testId}/results/me`、`GET /tests/{testId}/results`（講師）。
- スキル：`GET/PUT /skills/me`。
- タスク：`GET/PUT /tasks/me`、`GET /tasks/{traineeId}`（講師）。
- カルテ：`GET/POST /karte/{traineeId}`（講師・管理者。who は投稿者の Profiles 氏名）。
- プロフィール：`GET/PUT /profile/me`（氏名・所属企業。role はトークンのグループから決定）。
- 受講生一覧：`GET /trainees`（講師・管理者＝全員 / client＝自社のみ）。
- 管理者ユーザー：`GET /admin/users`、`POST /admin/users`（作成）、`PUT /admin/users/{userId}`（氏名・所属企業・**ロール変更**＝Cognito グループ付け替え）。
- 企業：`GET/POST /companies`、`PUT /companies/{id}`、`GET /companies/{id}/trainees`。
- コース：`GET/POST /courses`、`PUT /courses/{id}`、`GET /courses/{id}/trainees`。
- カリキュラム：`GET/PUT /courses/{courseId}/curriculum`（sessions 配列）。
- 受講生の所属コース：`GET /me/courses`。
- 研修資料：`POST /materials/upload-url`（署名PUT）、`POST /materials`（メタ保存）、`GET /materials?courseId=`（一覧。受講生は所属チェック）、`GET /materials/view?courseId=&materialId=`（署名GET・2時間・mode で attachment/inline 出し分け）。

---

## 6. 本物化の進捗（棚卸し）
**本物化済み（DB連携・動作確認済み）**：ログイン/認証、日報、勤怠、スキル、テスト（受験・結果）、目標タスク、カルテ（メモ）、受講生一覧、ユーザー管理（作成）、企業管理（一覧・追加）、コース管理（一覧・追加・種別バッジ）、カリキュラム（コース選択・編集・閲覧・複数資料紐づけ）、研修資料（アップロード・別タブ閲覧・閲覧/DL 出し分け・カリキュラム連携）、氏名の実名表示。

**まだサンプル / 未着手**：
- 案件マッチング（matching）：サンプル。
- リスク分析（risk）：サンプル（離脱リスクは日報・テスト・勤怠から算出する派生データの想定。横断集計段で）。
- 各ホームのダッシュボードのサマリー（受講生数・出席率・平均点・進捗など固定値）→ **次にやる候補**（フロント集計で本物化方針）。
- **管理画面の作り込み**（企業・コース・ユーザーの 一覧→詳細遷移→編集→保存、絞り込み・ソート、関連表示）→ **直近の作業対象**。バックエンドは実装済み、フロント未着手。
- テスト作成（テストビルダー）：手動で問題作成・保存がモック。
- 受講生の複数コース所属の割り当て UI。
- カルテの活動タイムライン＋集計値（横断集計）：一旦外してある。PDF書き込み/メモ/出力も後回し（ユーザーは「メモ機能にするかも、追々」）。
- AI（Bedrock）：最後。

---

## 7. 次にやる作業（中断地点）
ユーザー要望：「ホームのサマリー本物化」と「管理画面の作り込み」を**まとめて**やりたい。判断は任せる、後で直せる、とのこと。
合意した進め方：**まず管理画面の作り込み → 次にホームのサマリー本物化**（重い土台＝編集ルートを先に固め、軽い集計を後に）。

### 直前ターンで完了したこと
**管理画面の作り込みの「バックエンド土台」を実装済み**（`app.mjs` に以下を追加、検証OK、ユーザーがこれから `sam build && sam deploy` する段階）：
- `PUT /companies/{id}`、`GET /companies/{id}/trainees`
- `PUT /courses/{id}`、`GET /courses/{id}/trainees`
- `PUT /admin/users/{userId}`（氏名・所属企業・ロール変更。`setUserRole()` で Cognito グループ付け替え＝旧4グループから外して新ロールへ add、必要なら CreateGroup）
- import に `AdminRemoveUserFromGroupCommand` 追加、モジュール直下に `ROLE_GROUPS` と `async setUserRole(username,newRole)` 追加。
- ※ロール変更は次回ログイン時にトークン反映（開きっぱなしには即時反映されない）＝仕様。

### 次にやること（フロント。未着手）
1. **管理画面の作り込み（フロント）**：企業・コース・ユーザーの各一覧で
   - 行クリック→詳細画面に遷移（view 追加 or 詳細 state）。
   - 詳細で基本情報を編集して保存（`PUT /companies/{id}` `PUT /courses/{id}` `PUT /admin/users/{userId}`）。
   - 関連表示：企業詳細＝所属受講生（`GET /companies/{id}/trainees`）、コース詳細＝所属受講生（`GET /courses/{id}/trainees`）＋カリキュラムへの導線、ユーザー詳細＝氏名・ロール・所属企業の編集。
   - 一覧に絞り込み（検索）とソート。
   - 既存コンポーネント：`AdminCompanies` / `AdminCourses` / `AdminUsers`（一覧＋追加モーダルは実装済み。共通 `Modal` / `Field` / `fieldCls` / `COURSE_KINDS` / `kindLabel` / `kindTone` / `ROLE_OPTS` / `roleLabel` / `roleTone` ヘルパーあり）。これを詳細遷移・編集に拡張する。
2. **ホームのサマリー本物化**（その後）：各ロールのホーム（`TraineeHome` / `InstructorHome` / `ClientHome` / `AdminHome`）の固定値を実データ集計に。当面フロント集計（受講生一覧＋各データ取得）。重くなったら集計API。

---

## 8. フロント主要コンポーネント／ヘルパー（`TrainingApp.jsx` 内、おおよそ）
- `App`（最下部）：state（loggedIn, role, view, karte, taskDone…）、認証チェック、localStorage 永続、`toggle`（タスク達成→`PUT /tasks/me`）、`go/switchRole/login/logout`、`screen` でビュー分岐、サンプルバナー。
- ビュー分岐：home(ロール別 Home)、curriculum、goals、skillmap、portfolio、matching、risk、materials、tests、attendance、reports、trainees、companies、courses、users。
- API ヘルパー：`./api.js` の `apiGet/apiPut/apiPost`。
- 共通：`useNameMap()`（ID→氏名、`/trainees`）、`fallbackName`、`todayStr/nowHM/fmtAttDate/fmtLongDate/fmtTs`、`Modal/Field/fieldCls`、`COURSE_KINDS/kindLabel/kindTone`、`ROLE_OPTS/roleLabel/roleTone`、`SAMPLE_VIEWS`。
- 本物化済みコンポーネント：`Reports`/`TraineeAttendance`/`AttendanceManage`/`Tests`/`TraineePortfolio`(skills)/`GoalsView`(tasks)/`TraineeList`/`Karte`/`AdminUsers`/`AdminCompanies`/`AdminCourses`/`Curriculum`/`Materials`。

---

## 9. よくある落とし穴（再発防止メモ）
- cfn-lint：Description などコロン+空白を含む値はクォート。
- DynamoDB 予約語は ExpressionAttributeNames で回避：date(#d), status(#s), comment(#c), name(#n), role(#r)。
- Cognito：admin-create-user 後に admin-set-user-password（UserNotFound 回避）。グループ反映は再ログインで。
- 「There is already a signed in user」はエラーではない（自動入室＋signOut→signInで対処済み）。
- HTTP API の `cognito:groups` は文字列化される → includes 判定。
- 署名URL期限は「開き始め」の期限。開いた後は表示し続けられる。リロード/開き直しで取り直し（2時間に設定＋クリック毎に再発行）。
- OneDrive の `.aws-sam` ロック → `rmdir /s /q .aws-sam` を毎回先頭に。
- 別タブ open はクリック直後に空タブ→URL 遷移（ポップアップブロック回避）。
- todayStr/nowHM はローカル時刻（JST）で算出（UTC ずれ回避）。

---

## 10. 新チャットでの最初の一言（推奨）
「Feeps 研修管理クラウドの続き。HANDOFF.md と TrainingApp.jsx / app.mjs / template.yaml を渡します。次は『管理画面の作り込み（企業・コース・ユーザーの詳細遷移＋編集＋絞り込み・ソート、関連表示）』のフロント実装から。バックエンドの編集ルートは実装済み・デプロイ済み（のはず）。」
