# Feeps One — Design Brief

Feeps One のフロントエンド（`feeps-app/feeps-app/src`）における唯一のデザイン規約書。
HANDOFF.md の「★デザイン規約」はこのファイルを参照する形に統合済み。
新しい画面・機能を作る／AIにデザイン作業を依頼するときは、まずここを読むこと。

---

## 1. デザインコンセプト

- **Nova Command（2026-07-18採用）**: 濃紺のブランド面と、白く明るい業務面を組み合わせる。
  色はグラデーションで面を埋めず、Product識別・主要CTA・総合HomeのHeroへ重点的に使う。
- **デスクトップ**: 左端72pxの固定Global RailでProductを切り替える。Product内ではその右に
  224px（折りたたみ時72px）の固定Context Railを置き、画面メニューを内部スクロールさせる。
  総合HomeだけはContext Railを表示せず、Productへの入口として広い表示領域を使う。
- **モバイル**: 下部タブは使わない。上部のメニューボタンから、利用可能Productと現在Product内の
  画面を1つのドロワーで切り替える。視点移動と表示領域の圧迫を抑え、44px以上のタップ領域を守る。
- **可読性優先**: 本文は`NOVA.ink`、補助文も`NOVA.muted`以上のコントラストを基本とする。
  ガラス表現はナビゲーションや小さな補助面に限定し、業務カードは不透明な白面を維持する。
- **ビューポート**: `viewport-fit=cover`・`100dvh`を優先し、`body`背景は`T.shellTail`へ合わせる。
  モバイルの`.feeps-main-scroll`はsafe-area分だけ余白を持つ。

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

### 2.2 Nova Command（`NOVA`）
- 基本面: `rail` / `paper` / `card` / `glass`。Global Railのみ濃紺、Context Railと業務面は明るい白系。
- 文字・境界: `ink` / `muted` / `quiet` / `line` / `soft` / `onDark` / `onDarkMuted`。
- 影: `shadowSm` / `shadowMd` / `shadowAccent`。カードは`shadowSm`、浮遊面だけ`shadowMd`以上を使う。
- グラデーション: `gradBrand` / `gradAccent` / `gradPortal` / `gradAuth`。Hero・CTA・ブランド面へ限定する。
- レイアウト寸法は`T.sidebarWidth`(224) / `T.sidebarWidthCollapsed`(72) / `T.headerHeight`(72)。Global Railは72px固定。

### 2.3 Product accent（`PRODUCT_ACCENT`）
`training` `learning` `talent` `matching` `analytics` `admin` の6色。各 `{ accent, deep, subtle, gradFrom, gradTo }`。
用途は **Product Homeのヒーローグラデ／そのHome内のアイコンチップ／Product切替の2px下線 or ドット／Sidebar activeのアイコン色** に限定。
ボタン・リンク・フォーム・フォーカスは常に共通の `T.accent`。`gradFrom` はグラデーションの濃い側（濃→明、120deg基調）。

これは**ロール別ではなくProduct別のアクセント**であり、`product`（現在表示中のProduct）のみに連動する。
ロールが変わっても同じProductを見ている限り色は変わらない（意図的な設計）。
ヘッダー/サイドバー/Product Homeのヒーローなど**大きな面**の配色はこのProduct基準を維持し、
ロールごとに切り替えることはしない（下記 §2.4 のロールバッジのみが例外）。

2026-07-18時点の系統: `home`/`training`=ブルー、`learning`=ティール、`talent`=バイオレット、
`matching`=オレンジ、`analytics`=ローズ、`admin`=インディゴ。値は`theme.js`を唯一の正とし、文書へ複製しない。

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

### 2.5 レイヤー（`Z`）
`header`(20) `dropdown`(30) `overlay`(100) `modal`(110) `toast`(120)。z-indexを直接数値で書かない。

### 2.6 形状
業務コントロールは`RADIUS.md`(12) / `RADIUS.sm`(8)。Novaのカードは14〜22px、Heroは最大30pxまでを許可する。
見出しは `font-weight >= 600` + `letter-spacing: -0.02em`。数値は `font-variant-numeric: tabular-nums`（`useCountUp` と併用）。

### 2.7 タイポグラフィスケール（全Product共通）

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

### 2.8 フォームコントロール統一
- 入力欄・select・検索・日付/月選択はすべて **`rounded-xl`（12px = RADIUS.md）**。`rounded-lg`(8px)の入力欄は廃止済み（`fieldStyle`のborderRadius 12が正）。
- パディングは `px-3 py-2 text-sm` を基準にする。
- ローディングはテキストのみの「〜中...」を使わず、`SkeletonRows`/`SkeletonCards`（§4準拠）。

---

## 3. Nova Command 構造

```
.app-root.feeps-nova-shell (100dvh)
├─ .feeps-global-rail (PC固定72px。権限内Productだけ表示)
├─ .feeps-context-rail (PC固定224px/72px。総合Homeでは非表示)
├─ .feeps-topbar (PC。本文の開始位置と連動)
├─ .feeps-mobile-topbar + .feeps-mobile-drawer (モバイルのみ)
└─ .feeps-shell-body
    └─ .feeps-main-scroll (PCの主スクロール領域)
        └─ <main> (総合Home max 1360px / その他 max 1280px)
```

- JSXは`NOVA`/`PRODUCT_ACCENT`をCSSカスタムプロパティへ渡し、`index.css`は構造・状態・レスポンシブだけを担当する。
- Global Rail・Context Rail・Topbar・本文のoffsetは必ず同じ計算を使う。Context Railの折りたたみ時も本文とTopbarを同時に追従させる。
- ロールによるProduct表示可否とProduct内メニューは既存`PRODUCTS.roles`/NAV定義を正とし、デザイン側で権限を増やさない。

---

## 4. 共通コンポーネント規約

- **モーダル**: 共通 `Modal`（`document.body` へportal、`max-height:85dvh`＋内部スクロール。**sm未満はボトムシート**（下端密着・上角丸・safe-area padding・スライドイン）、sm+は画面上端から約9vh、
  フォーカス管理、dirty時の離脱確認）。`AdminModal` は `Modal` の薄いラッパーであり、直接拡張しない。
  モーダルを開いている間は `body.feeps-modal-open` クラスで `.feeps-main-scroll` も凍結する。
- **画面の頭**: Product Homeは `PageHeader`（動的タイトル/チップ/CTA構成。装飾SVGの追加は禁止）。
  サブ画面は `SectionHead`（iconはそのProductのlucideアイコンをmonotoneで使用。ドットでの色分けはしない）。
- **フォーム**: `Field` + `fieldStyle`。
- **Login画面の入力欄**: `Field`/`fieldStyle`とは別のLogin専用実装（`products/auth/Login.jsx`）。
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

- 入場アニメーションはマウント時1回のみ。`view-anim` / `feeps-hero-in` / `feeps-stagger-in`（delayはinlineで個別指定）。
- 数値カウントアップは `useCountUp`。
- **無限ループとして許可されているのは `feeps-float`、ブランドマークの呼吸、`feeps-shimmer`（生成中の正典表現）のみ**。新しい無限ループ演出を増やさない。
- スライド系UI（Sidebar activeピル等）は、対象DOMの `offsetLeft/offsetWidth`（横）または
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
- **`prefers-reduced-motion: reduce` で装飾アニメーションを無効化する。** 新しいCSS animation/transitionを足すときは、
  `index.css`の同media queryへ停止規則も追加する。操作結果やフォーカスなど意味を伝える状態変化は即時表示へ切り替える。

---

## 6. 禁止事項

- JSX/CSSへの生の色コード直書き（例外は `#fff` とカタログのDATA値のみ、トークン化して記録すること）。
- z-indexの直接数値指定（`Z` トークン経由のみ）。
- `*Subtle` トークンをバッジ/ステータス/フォーカスリング以外の大面積に使うこと。
- 絵文字によるフィードバック表現（成功/エラー/空状態すべてアイコン+文言で表現）。
- 「準備中」ラベルでの機能隠蔽（未実装のUIはラベルではなく要素ごと出し分ける）。
- 無許可の無限ループアニメーション追加（`feeps-float`/`feeps-shimmer` 以外）。
- `prefers-reduced-motion` を無視したアニメーション追加。
- 下部Dock／Bottom Navigation／上部Productタブを再導入すること。モバイルのProduct切替は統合ドロワーを正とする。
- 総合HomeへContext Railを表示すること（総合HomeはProductへの入口、各Product Homeは業務状況の把握という役割を分ける）。
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
7. **Build成功後はルート`AGENTS.md` / `AI_RULES.md`の4点セットに従う。** commit前deployは禁止し、
   CHANGELOG・HANDOFF・START_HERE更新と本番確認までを一連の完了条件とする。
