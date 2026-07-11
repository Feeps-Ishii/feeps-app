# Feeps One — Design Brief

Feeps One のフロントエンド（`feeps-app/feeps-app/src`）における唯一のデザイン規約書。
HANDOFF.md の「★デザイン規約」はこのファイルを参照する形に統合済み。
新しい画面・機能を作る／AIにデザイン作業を依頼するときは、まずここを読むこと。

---

## 1. デザインコンセプト

- **顔（Login/Header/Sidebar/AIカード）はダーク、業務画面（Main）はライト** の二面構成。
- lg以上（デスクトップ）は **Floating Canvas**: 淡いグラデーションのシェルの上に、
  Header/Sidebarを透過させ、Mainだけを角丸+影付きの白いシートとして浮かせる。
- lg未満（モバイル）はFloating Canvasを適用しない。ドロワー+通常スクロールの
  従来構成のまま、情報量とタップ領域を優先する。この方針は意図的な判断であり、
  「モバイルにもFloating Canvasを」は誤り。

---

## 2. トークン（`src/components/common/theme.js`）

JSXやCSSに生の色コード・z-index数値を直接書かない。必ず以下のトークン経由で参照する。

### 2.1 セマンティックカラー（`T`）
- ダーク面: `darkBgBase` `darkBgSurface` `darkBgElevated` `darkBorder` `darkTextPrimary` `darkTextSecondary` `darkTextMuted`
- ライト面: `bgBase` `bgSurface` `border` `textPrimary` `textSecondary` `textMuted`
- アクセント（操作色専用。CTA/リンク/active/フォーカスのみ。他用途禁止）: `accent` `accentHover` `accentSubtle`
- AI専用（他機能での流用禁止）: `aiAccent` `aiAccentDeep` `aiSubtle`
- 低彩度セマンティクス: `success` `successSubtle` `warning` `warningSubtle` `danger` `dangerSubtle`
- `*Subtle` 系は **バッジ/ステータスチップ/フォーカスリング限定**。カード背景など大面積には使わない。

### 2.2 Floating Canvas（Phase 4）
- `shellBase`: アプリ土台の背景グラデーション
- `canvasBg` / `canvasBorder` / `canvasShadow` / `canvasRadius`(18) / `canvasMargin`: Main を囲む白いシートの見た目
- `sidebarWidth`(216) / `sidebarWidthCollapsed`(64) / `headerHeight`(60, **PC文脈の値**。モバイルの2行ヘッダーには適用しない)

### 2.3 Product accent（`PRODUCT_ACCENT`）
`training` `learning` `talent` `matching` `analytics` `admin` の6色。各 `{ accent, deep, subtle, gradFrom, gradTo }`。
用途は **Product Homeのヒーローグラデ／そのHome内のアイコンチップ／Product切替の2px下線 or ドット／Sidebar activeのアイコン色** に限定。
ボタン・リンク・フォーム・フォーカスは常に共通の `T.accent`。`gradFrom` はグラデーションの濃い側（濃→明、120deg基調）。

これは**ロール別ではなくProduct別のアクセント**であり、`product`（現在表示中のProduct）のみに連動する。
ロールが変わっても同じProductを見ている限り色は変わらない（意図的な設計）。
ヘッダー/サイドバー/Product Homeのヒーローなど**大きな面**の配色はこのProduct基準を維持し、
ロールごとに切り替えることはしない（下記 §2.4 のロールバッジのみが例外）。

2026-07-03 時点の色（BtoB SaaSとして派手すぎない、Product同士で被らない6色に整理済み）:
- `training`（研修管理）: 黒・ダークグレー系 `#3A404C` — **`admin` と同一の値**。研修管理は全ロール共通のヒーローがこの色になる。AdminProduct配下の管理者専用画面は個別に`product="admin"`を指定しているため、値としては同じだが独立したキーとして維持している。
- `learning`（Eラーニング）: ティール系 `#14A3B8`
- `talent`（スキル・成長）: パープル系 `#7C5CE0`
- `matching`（案件管理）: オレンジ系 `#E07B39`
- `analytics`（分析・レポート）: ローズ／ワイン系 `#B23A55` — 以前はシアン系で`learning`と色が被っていたため変更。`T.danger`（`#C4554D`、テラコッタ寄りの赤）とも色相をずらしてあり、エラー表示と混同しない。
- `admin`（管理者専用画面）: 黒・ダークグレー系 `#3A404C`

### 2.4 Role accent（`ROLE_ACCENT`）— ヘッダーのロールバッジ専用
`trainee` `instructor` `client` `admin` の4色 + 未知role用の `default`。各 `{ accent, subtle }`。
**用途はヘッダー右上のユーザー名の下に表示する小さな丸バッジ1箇所のみ**（`TrainingApp.jsx` の `userActionsTail`）。
サイドバー下部のユーザーカード、ヘッダー/サイドバーの背景・枠線・アイコン色など、他のどの大きな面にも使わない —
それらは引き続き §2.3 の `PRODUCT_ACCENT` が担当する。`ROLE_ACCENT[role]` が無い場合は
`ROLE_ACCENT.default`（ニュートラルグレー）にフォールバックする。
- `trainee`（受講生）: グリーン系 `#3E8E5B`
- `instructor`（講師）: スレートブルー系 `#4A6FA5`
- `client`（企業担当者）: ゴールド系 `#B08A34`
- `admin`（管理者）: ニュートラルグレー系 `#5C6067`
- `default`（未知role）: ニュートラルグレー系 `#5C6067`（`admin`と同値だが独立管理）

### 2.4 レイヤー（`Z`）
`header`(20) `dropdown`(30) `overlay`(100) `modal`(110) `toast`(120)。z-indexを直接数値で書かない。

### 2.5 形状
`RADIUS.md`(12) / `RADIUS.sm`(8)。見出しは `font-weight >= 600` + `letter-spacing: -0.02em`。数値は `font-variant-numeric: tabular-nums`（`useCountUp` と併用）。

### 2.6 タイポグラフィスケール（Phase5-2で全Product統一。新画面は必ずこの段階に合わせる）

| 用途 | サイズ/ウェイト | 実装 |
|---|---|---|
| Product Homeヒーロータイトル | 30px / 500 / -0.02em | `PageHeader`の`text-[30px] font-medium`（講師Workspaceのダークヒーローも同値） |
| サブ画面タイトル | 20px / 500 / -0.02em | `SectionHead` |
| ページ内セクション見出し | 18px / 700 | Home `SectionTitle`（h2 `text-lg font-bold`） |
| カード内タイトル | **16px / 700 / -0.02em** | h3 `text-base font-bold`。14px/15pxの独自サイズは廃止済み |
| KPI値 | **24px / 700 / tabular-nums** | `text-2xl font-bold`。`font-extrabold`(800)と30px超のKPIは使わない（Heroの`useCountUp`チップも24px） |
| ラベル | 12px / 600 muted | `text-xs font-semibold` + `T.textMuted` |
| 説明文 | 12〜14px / 400 | `text-xs`/`text-sm` + `T.textMuted` |

`font-extrabold`(800)が許されるのはブランドロゴタイプ「Feeps One」のみ。

### 2.7 フォームコントロール統一（Phase5-2）
- 入力欄・select・検索・日付/月選択はすべて **`rounded-xl`（12px = RADIUS.md）**。`rounded-lg`(8px)の入力欄は廃止済み（`fieldStyle`のborderRadius 12が正）。
- パディングは `px-3 py-2 text-sm` を基準にする。
- ローディングはテキストのみの「〜中...」を使わず、`SkeletonRows`/`SkeletonCards`（§4準拠）。

---

## 3. Floating Canvas 構造（lg+）

```
.app-root (min-height:100vh / lg: h-screen固定, background: T.shellBase)
├─ Header (transparent, height: T.headerHeight=60px, 1行統合: ロゴ+Product切替ピル+DEMO+通知+ユーザー)
├─ Sidebar (transparent, 幅 sidebarWidth/sidebarWidthCollapsed, 内部スクロールはSidebar自身)
└─ .feeps-canvas (Mainのラッパー。lg+のみ canvasBg/canvasBorder/canvasShadow/canvasRadius/canvasMarginを適用)
    └─ .feeps-main-scroll (アプリ内で唯一スクロールするコンテナ。overflow-y-auto)
        ├─ .feeps-pagehead (sticky top-0。スクロール前は`.is-flush`で透明、スクロールすると通常のPageHeadスタイルに昇格)
        └─ <main>
```

- lg+の背景/枠線/影の出し分けは、**JSトークンをCSSカスタムプロパティとしてinline style経由で渡し**、
  `index.css` 側は `@media (min-width:1024px)` で「いつ適用するか」だけを決める
  （`--canvas-bg` `--canvas-border` `--canvas-shadow` `--canvas-radius` `--canvas-margin`、
  `--ph-bg` `--ph-border` `--ph-shadow` パターン）。inline styleは常にCSSファイルの規則より強いため、
  デスクトップ限定の上書きをCSSにベタ書きすると効かない・効きすぎるの両方の事故になる。この橋渡し以外の
  目的でraw hexをCSSに書かない。
- モバイル（lg未満）はこの構造を適用しない。Header/Sidebar/Mainは従来どおり不透明・通常スクロール。

---

## 4. 共通コンポーネント規約

- **モーダル**: 共通 `Modal`（`document.body` へportal、`max-height:85vh`＋内部スクロール、画面上端から約9vh、
  フォーカス管理、dirty時の離脱確認）。`AdminModal` は `Modal` の薄いラッパーであり、直接拡張しない。
  モーダルを開いている間は `body.feeps-modal-open` クラスで `.feeps-main-scroll` も凍結する。
- **画面の頭**: Product Homeは `PageHeader`（動的タイトル/チップ/CTA構成。装飾SVGの追加は禁止）。
  サブ画面は `SectionHead`（iconはそのProductのlucideアイコンをmonotoneで使用。ドットでの色分けはしない）。
- **フォーム**: `Field` + `fieldStyle`。
- **Login画面の入力欄**: `Field`/`fieldStyle`とは別のLogin専用実装（`TrainingApp.jsx`の`Login()`）。
  入力欄のラッパーに`.feeps-login-field`クラス＋CSS変数（`--field-bg` `--field-border` `--field-text`
  `--field-focus` `--field-focus-ring`、値は`T.bgSurface` `T.border` `T.textPrimary` `T.accent`
  `T.accentSubtle`）を渡す。`:focus-within`でのborder/ring、および`input:-webkit-autofill`の
  背景色乗っ取り防止（`box-shadow: 0 0 0 1000px var(--field-bg) inset`）はこのCSS変数経由でのみ
  行い、生の16進を使わない。同様の「ブラウザautofillに配色を奪われる入力欄」を他画面で作る場合も
  このクラスとパターンを再利用する。
- **カード**: `Card` / `ProductNavCard`（hoverでProduct accentの枠+1px lift）。
- **バッジ**: `Badge`（低彩度5トーンのみ。多色濫用禁止）。
- **空状態**: `EmptyState`。検索結果ゼロなどで「準備中」ラベルは出さない（該当UIごと非表示にする）。
- **成功状態**: 絵文字を使わない。チェックアイコン＋落ち着いた文言。主要な成功フィードバック
  （保存/完了/送信の確定通知）には共通 `SuccessCheck`（stroke-dashoffsetで描画する約400msのチェックマーク）を使う。
- **ローディング**: 汎用スピナーやテキストのみの「読み込み中...」を新規に増やさない。
  一覧・テーブル的な文脈は `SkeletonRows`、カードグリッド的な文脈は `SkeletonCards`（いずれも `feeps-shimmer` ベース）。
  ページ全体のSuspenseフォールバックのみ既存の `PageLoading`（スピナー）を使い続けてよい。
- **通知パネル（デスクトップ）**: `.feeps-glass-panel`（`backdrop-filter: blur(18px) saturate(160%)`、
  非対応ブラウザは `@supports not` で不透明白にフォールバック）。モバイルはこのガラス化を適用せず、
  ベルタップで通知センターへ直接遷移する従来動作のまま。

---

## 5. アニメーション原則

- 入場アニメーションはマウント時1回のみ。`feeps-hero-in` / `feeps-stagger-in`（delayはinlineで個別指定）。
- 数値カウントアップは `useCountUp`。
- **無限ループとして許可されているのは `feeps-float` と `feeps-shimmer`（AI生成中の正典表現）のみ**。新しい無限ループ演出を増やさない。
- スライド系UI（Product切替ピル・Sidebar activeピル）は、対象DOMの `offsetLeft/offsetWidth`（横）または
  `offsetTop/offsetHeight`（縦）を `useLayoutEffect` で計測し、絶対配置した同要素をCSS `transition`
  （`cubic-bezier(.3,.9,.4,1)` 基調）で追従させる。ピル自体はz-indexで本体の下に置く。
  **必須ガード**: この種の「計測してsetStateする」`useLayoutEffect`/`useEffect`は、依存配列を
  正しく絞る（測定対象が変わる値のみに反応する。プロパティとして渡す配列/オブジェクトを呼び出し側で
  毎レンダー新規生成しないことも合わせて確認する）のに加えて、**setState前に必ず「新しい測定値が
  現在のstateと同じなら更新しない」ガードを入れる**こと（例: 関数形の更新で
  `setPill(prev => (prev && prev.top === next.top && prev.height === next.height) ? prev : next)`）。
  依存配列なしで毎レンダー実行する設計（レイアウト変化を確実に拾うため意図的にそうする場合）は
  なおさら必須。このガードが無いと、値が変わっていなくても新しいオブジェクト参照でsetStateし続け、
  `useLayoutEffect`は同期的にコミットフェーズ内で走るため React のネスト更新上限に達し、
  **React error #185（Maximum update depth exceeded）で本番が白画面になる**（2026-07-03に実際に発生
  し修正済み。詳細はCHANGELOG.mdの`Task-Urgent-Fix-ReactError185`を参照）。
- 成功チェックマークは `stroke-dashoffset` によるドローイン、約400ms。
- **`prefers-reduced-motion: reduce` で全アニメーションを無効化する。**
  `.app-root` 直下の包括ルール（`.view-anim{animation:none}` / `.app-root *{transition:none!important}`）が
  ピルのスライドを含め既に全体を止めているため、個別コンポーネント側で追加対応は不要。
  ただし新しいCSSアニメーション/transitionを足すときは、この包括ルールの対象（`.app-root`内）に
  入っていることを必ず確認する。

---

## 6. 禁止事項

- JSX/CSSへの生の色コード直書き（例外は `#fff` とカタログのDATA値のみ、トークン化して記録すること）。
- z-indexの直接数値指定（`Z` トークン経由のみ）。
- `*Subtle` トークンをバッジ/ステータス/フォーカスリング以外の大面積に使うこと。
- 絵文字によるフィードバック表現（成功/エラー/空状態すべてアイコン+文言で表現）。
- 「準備中」ラベルでの機能隠蔽（未実装のUIはラベルではなく要素ごと出し分ける）。
- 無許可の無限ループアニメーション追加（`feeps-float`/`feeps-shimmer` 以外）。
- `prefers-reduced-motion` を無視したアニメーション追加。
- モバイル（lg未満）へのFloating Canvas適用、およびモバイルヘッダーの2行構成からの変更。
- デザイン作業のついでにAPI・認証・ルーティング・業務ロジックを変更すること（別タスクとして扱う）。

---

## 7. AI依頼のコツ（このプロジェクトでデザイン作業を頼むとき）

1. **現状→影響範囲→実装方針の報告を先に求める。** 承認してから実装させる（`CLAUDE.md` のルール）。
2. **既存トークン（`theme.js`）を再利用させる。** 新しい色や間隔の値を都度発明させない。
   「このProductは`PRODUCT_ACCENT.xxx`を使う」など、既存カタログを明示すると精度が上がる。
3. **リグレッション監査を明示的に依頼する。** UI刷新は「元にあったフィルタ/ソート/検索/行アクション/
   バッジの数字」等を静かに落としやすい。「変更前後でgit diff相当の自己監査をしてから報告して」と
   毎回入れるとよい。
4. **モバイル/デスクトップの扱いを毎回明示する。** 「lg+のみ」「モバイルは現状維持」を言わないと、
   デスクトップ向けの数値（例: header 60px）がモバイルにまで波及して情報量が失われることがある。
5. **段階実装＋build確認を挟む。** 大きい変更は「フレーム構造→承認→残りのステップ」のように
   スクロール等の副作用が出やすいブロックの後に一度止めて確認させると事故が少ない。
   各ブロックの後に `npm run build` を必ず通す。
6. **データに存在しない情報を演出で埋めさせない。** 例: 通知に相対時刻フィールドが無いのに
   「3分前」のような表示を作らせると嘘の情報になる。無い場合は正直な表示（例:「本日」）にするか、
   別タスクとしてデータモデル拡張を依頼する。
7. **deployは明示的に指示しない限り実行させない。** `npm run build` の成功確認までが標準の完了条件。
