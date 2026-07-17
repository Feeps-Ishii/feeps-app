// Feeps One design tokens — semantic, two-surface system.
// 「顔はダーク、業務画面はライト」: Login / Shell / AI UI use the dark set,
// main content uses the light set. Do not hardcode raw hex values in JSX.
//
// RULES:
// - accent is the ONLY interactive color: CTA, active nav, links, focus. Nothing else.
// - aiAccent is reserved for AI features. Using it elsewhere is forbidden.
// - *Subtle tokens are for badges, status chips and focus rings ONLY —
//   never for card backgrounds or any large surface (prevents color sprawl).
export const T = {
  // ---- Dark surfaces (Login / Header / Sidebar / AI cards) ----
  darkBgBase: "#0E0F13",
  darkBgSurface: "#16181D",
  darkBgElevated: "#1C1F26",
  darkBorder: "rgba(255,255,255,0.08)",
  darkTextPrimary: "#ECEDEF",
  darkTextSecondary: "#9BA0A8",
  darkTextMuted: "#6B7078",

  // ---- Light surfaces (main content) ----
  bgBase: "#F7F7F5",
  bgSurface: "#FFFFFF",
  border: "#E4E4E0",
  textPrimary: "#1A1C20",
  textSecondary: "#5C6067",
  textMuted: "#9A9EA5",

  // ---- Accent (CTA / active nav / links / focus ONLY) ----
  accent: "#3D6BFF",
  accentHover: "#2F56D9",
  accentSubtle: "#EDF1FF",

  // ---- AI-only accent ----
  aiAccent: "#8B7CF6",
  aiAccentDeep: "#6D5AE0",
  aiSubtle: "#F1EFFE",

  // ---- Low-saturation semantics ----
  success: "#3D8A63",
  successSubtle: "#EAF3EE",
  warning: "#B07C2E",
  warningSubtle: "#F7F0E3",
  danger: "#C4554D",
  dangerSubtle: "#F9ECEA",

  // ---- Floating Canvas shell (Phase 4) ----
  // shellBase: tinted app base the transparent Header/Sidebar sit on.
  // canvas*: the floating white sheet that hosts all page content.
  shellBase: "radial-gradient(1200px 420px at 50% -60px, rgba(61,107,255,0.05), transparent 70%), linear-gradient(180deg, #EEF0F4, #EAECF1)",
  shellTail: "#EAECF1", // shellBase末尾色。iOS Safariのオーバースクロール/100vh差分で白帯を出さないためbody背景に使う
  canvasBg: "#FFFFFF",
  canvasBorder: "1px solid rgba(21,23,28,0.05)",
  canvasShadow: "0 1px 2px rgba(21,23,28,0.04), 0 12px 32px rgba(21,23,28,0.07)",
  canvasRadius: 18,
  canvasMargin: "0 14px 14px 4px",
  sidebarWidth: 216,
  sidebarWidthCollapsed: 64,
  headerHeight: 60,
};

// Product accent palette (Phase 2). Usage is strictly limited to:
// Product Home hero gradients / icon chips inside that Home (subtle bg + accent icon) /
// Product-nav active underline (2px) / Sidebar active bg (subtle) + text (deep).
// Buttons, links, forms and focus stay on the shared T.accent; aiAccent rules unchanged.
// gradFrom is the DARK side, gradTo the light side (approved mock: 濃→明, 120deg).
// training/adminのgradFrom/gradToはFeepsブランドブルー（Phase7-3デザインブラッシュアップで統一）:
// 研修管理Home（PageHeader経由のtrainee/client、InstructorWorkspace）と、admin役の研修管理導線
// （TrainingApp.jsxはproduct==="training"&&role==="admin"のときAdminProductを描画する。つまり
// 管理者にとって「研修管理」＝AdminProduct）が同じ青系グラデーションになるよう、training/admin
// 両方のgradFrom/gradToを揃えている。accent/deep/subtleはアイコンチップ・サイドバー等で広く
// 使われているため変更していない（gradFrom/gradToはPageHeader/Heroの背景専用）。
// Feeps One統合Home（FeepsOneHome.jsx）は白〜淡いブルー〜ブランドブルーの独自グラデーションを
// 直接組み立てており、このPRODUCT_ACCENTの値には依存しない（Home自体を主役にするための意図的な差別化）。
// analytics was moved off cyan (it collided with learning) onto a rose/wine family so
// every Product now has a visually distinct hue: blue(training/admin) / teal(learning) /
// purple(talent) / orange(matching) / rose(analytics).
export const PRODUCT_ACCENT = {
  home:      { accent: "#3D6BFF", deep: "#2F56D9", subtle: "#EDF1FF", gradFrom: "#2F56D9", gradTo: "#14A3B8" },
  training:  { accent: "#3A404C", deep: "#23272F", subtle: "#EDEEF1", gradFrom: "#2F56D9", gradTo: "#5B8CFF" },
  learning:  { accent: "#14A3B8", deep: "#0E7A8A", subtle: "#E7F5F7", gradFrom: "#0E7A8A", gradTo: "#14A3B8" },
  talent:    { accent: "#7C5CE0", deep: "#6247B8", subtle: "#F3F0FC", gradFrom: "#4B32A8", gradTo: "#7C5CE0" },
  matching:  { accent: "#E07B39", deep: "#B25E1F", subtle: "#FBF0E7", gradFrom: "#B25E1F", gradTo: "#E07B39" },
  analytics: { accent: "#B23A55", deep: "#8C2C43", subtle: "#F8E9ED", gradFrom: "#8C2C43", gradTo: "#B23A55" },
  admin:     { accent: "#3A404C", deep: "#23272F", subtle: "#EDEEF1", gradFrom: "#2F56D9", gradTo: "#5B8CFF" },
};

// Role accent (2026-07-03). Independent from PRODUCT_ACCENT — this is ONLY for the
// small role badge next to the user's name in the header, so a role stays visually
// identifiable regardless of which Product is currently open. Never use these for
// headers/sidebar/large surfaces; that stays on PRODUCT_ACCENT. Unknown roles fall
// back to ROLE_ACCENT.default (neutral gray).
export const ROLE_ACCENT = {
  trainee:    { accent: "#3E8E5B", subtle: "#E9F4EE" },
  instructor: { accent: "#4A6FA5", subtle: "#EAF0F8" },
  client:     { accent: "#B08A34", subtle: "#F8F1E1" },
  admin:      { accent: "#5C6067", subtle: "#EDEEF0" },
  default:    { accent: "#5C6067", subtle: "#EDEEF0" },
};

// Layer system — the only allowed z-index values. Never hardcode z numbers.
export const Z = {
  header: 20,    // sticky page header / sidebar
  dropdown: 30,  // menus, popovers
  overlay: 100,  // full-screen scrims (drawer)
  modal: 110,    // dialogs (rendered via portal on document.body)
  toast: 120,
};

// Shape / typography conventions (apply via inline style or classes):
// radius 12px (small elements 8px), headings weight >= 600 with
// letter-spacing -0.02em, numerals use font-variant-numeric: tabular-nums.
export const RADIUS = { md: 12, sm: 8 };

export const GRAD = `linear-gradient(135deg, ${T.accent} 0%, #5B8CFF 100%)`;
export const AI_GRAD = `linear-gradient(135deg, ${T.aiAccentDeep} 0%, ${T.aiAccent} 100%)`;

// ---- Prism Bright (2026-07-17確定のUIリデザイン C3案) ----
// 白地×明るい4色グラデーション。グラデーションは「主役」(ヒーロー/CTA/ロゴ/ドック活性)のみに使い、
// カード面は白のまま。AIは引き続き紫(ai)専用。段階移行のため既存Tとは独立して定義し、
// Phase R1ではログイン画面のみが使用する（以降のフェーズでシェル→Home→各画面へ展開）。
export const PRISM = {
  base: "#F7F8FD", ink: "#20222E", sub: "#585D70", mut: "#8B90A4",
  line: "rgba(32,34,46,.07)", line2: "rgba(32,34,46,.13)",
  surface: "#FFFFFF", neutralSubtle: "#EFF0F4", ringTrack: "#ECEEF6",
  cardShadow: "0 1px 2px rgba(32,34,46,.04), 0 10px 30px rgba(60,80,180,.07)",
  cardShadowHover: "0 14px 38px rgba(60,80,180,.13)",
  accent: "#4F6BF0", accentDeep: "#3D55D6", accentSubtle: "#EDF0FE",
  ai: "#8B7CF6", aiDeep: "#6D5AE0", aiSubtle: "#F1EEFD",
  teal: "#0FA5A0", tealDeep: "#0B7F7C", tealSubtle: "#E5F6F4",
  ok: "#22A06B", okSubtle: "#E7F5EE",
  warn: "#DD9426", warnSubtle: "#FAF1DF",
  bad: "#E25C50", badSubtle: "#FBECEA",
  badLine: "rgba(226,92,80,.3)", warnLine: "rgba(221,148,38,.3)",
  heroGlass: "rgba(255,255,255,.14)", heroGlassStrong: "rgba(255,255,255,.2)",
  heroLine: "rgba(255,255,255,.24)", heroTextSoft: "rgba(255,255,255,.78)",
  heroShadow: "0 18px 50px rgba(79,107,240,.2)",
  gradCta: "linear-gradient(110deg,#4F6BF0,#2DC7B8)",
  gradHero: "linear-gradient(120deg,#4F6BF0,#8B7CF6)",
  gradMark: "linear-gradient(135deg,#4F6BF0,#8B7CF6 55%,#2DC7B8)",
  gradText: "linear-gradient(90deg,#4F6BF0,#8B7CF6 55%,#2DC7B8)",
  gradTraining: "linear-gradient(135deg,#4F6BF0,#7E8FFF)",
  gradLearning: "linear-gradient(135deg,#0FA5A0,#4ED4C5)",
  gradTalent: "linear-gradient(135deg,#7C5CE0,#A78BFA)",
  gradMatching: "linear-gradient(135deg,#F97362,#FFA88C)",
  gradAnalytics: "linear-gradient(135deg,#E0557E,#F58FAE)",
  gradHome: "linear-gradient(135deg,#4F6BF0,#2DC7B8)",
  // 四隅の光（Aurora）。ページ全面の背景にのみ使用する
  auroraBg: [
    "radial-gradient(640px 420px at -4% -6%, rgba(79,107,240,.12), transparent 66%)",
    "radial-gradient(560px 400px at 104% -4%, rgba(45,199,184,.10), transparent 66%)",
    "radial-gradient(560px 420px at -6% 106%, rgba(249,115,98,.07), transparent 66%)",
    "radial-gradient(640px 440px at 106% 106%, rgba(139,124,246,.10), transparent 66%)",
  ].join(",") + ", #F7F8FD",
};

// Product key -> Prism Brightグラデーション早見表。Dock/コマンドパレット/Home等、
// Prism Bright移行済みのProduct色表示はPRODUCT_ACCENT(旧トークン、他の未移行画面向け)ではなく
// こちらを参照して統一する（R2でDockに導入、R3でHomeにも適用）。
export const PRISM_PRODUCT_GRAD = {
  home: PRISM.gradHome,
  training: PRISM.gradTraining,
  learning: PRISM.gradLearning,
  talent: PRISM.gradTalent,
  matching: PRISM.gradMatching,
  analytics: PRISM.gradAnalytics,
};
