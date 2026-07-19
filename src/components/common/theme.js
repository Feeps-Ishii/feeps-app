// Feeps One design tokens — semantic, two-surface system.
// Nova Command: Global Rail / Login brand / AI UI use the dark set;
// Context Rail / Topbar / main content use the light set. Do not hardcode raw hex values in JSX.
//
// RULES:
// - accent is the ONLY interactive color: CTA, active nav, links, focus. Nothing else.
// - aiAccent is reserved for AI features. Using it elsewhere is forbidden.
// - *Subtle tokens are for badges, status chips and focus rings ONLY —
//   never for card backgrounds or any large surface (prevents color sprawl).
export const T = {
  // ---- Dark surfaces (Login / Header / Sidebar / AI cards) ----
  darkBgBase: "#151A2C",
  darkBgSurface: "#1C2238",
  darkBgElevated: "#252C45",
  darkBorder: "rgba(255,255,255,0.08)",
  darkTextPrimary: "#ECEDEF",
  darkTextSecondary: "#B7C0D5",
  darkTextMuted: "#8F9AB2",

  // ---- Light surfaces (main content) ----
  bgBase: "#F7F9FC",
  bgSurface: "#FFFFFF",
  border: "#E0E5EE",
  textPrimary: "#1A1C1F",
  textSecondary: "#535D6E",
  textMuted: "#687286",

  // ---- Accent (CTA / active nav / links / focus ONLY) ----
  accent: "#1267B5",
  accentHover: "#0B5799",
  accentSubtle: "#E7F3FF",

  // ---- AI-only accent ----
  aiAccent: "#9B79EC",
  aiAccentDeep: "#7454C7",
  aiSubtle: "#F2EDFD",

  // ---- Low-saturation semantics ----
  success: "#3D8A63",
  successSubtle: "#EAF3EE",
  warning: "#B07C2E",
  warningSubtle: "#F7F0E3",
  danger: "#C4554D",
  dangerSubtle: "#F9ECEA",

  // ---- Nova Command shell dimensions / compatibility surfaces ----
  // canvas* remain as compatibility values for the existing main wrapper.
  shellBase: "radial-gradient(900px 440px at 72% -8%, rgba(51,156,255,.08), transparent 68%), radial-gradient(760px 420px at 105% 14%, rgba(155,121,236,.07), transparent 70%), #F7F9FC",
  shellTail: "#F7F9FC", // shellBase末尾色。iOS Safariのオーバースクロール/100vh差分で白帯を出さないためbody背景に使う
  canvasBg: "#FFFFFF",
  canvasBorder: "1px solid rgba(26,28,31,.08)",
  canvasShadow: "0 1px 2px rgba(26,28,31,.03), 0 18px 44px rgba(29,42,74,.06)",
  canvasRadius: 0,
  canvasMargin: "0",
  sidebarWidth: 224,
  sidebarWidthCollapsed: 72,
  headerHeight: 72,
};

// Nova Command (2026-07-18 approved). The shell consumes these tokens through
// CSS custom properties so navigation, authentication and content surfaces stay
// visually aligned without scattering raw colors through JSX/CSS.
export const NOVA = {
  ink: "#1A1C1F",
  rail: "#151A2C",
  railElevated: "#202741",
  paper: "#F7F9FC",
  card: "#FFFFFF",
  muted: "#5D6678",
  quiet: "#748096",
  line: "rgba(26,28,31,.12)",
  soft: "#EEF2F7",
  accent: "#187FD4",
  accentDeep: "#1267B5",
  accentSoft: "#E7F3FF",
  violet: "#9B79EC",
  violetSoft: "#F2EDFD",
  teal: "#3AB9B1",
  tealSoft: "#E7F7F5",
  green: "#5DC977",
  orange: "#F3883B",
  rose: "#EB77B1",
  onDark: "#FFFFFF",
  onDarkMuted: "#F1F4F9",
  glass: "rgba(255,255,255,.82)",
  railGlass: "rgba(255,255,255,.92)",
  shadowSm: "0 1px 2px rgba(23,30,50,.05), 0 8px 22px rgba(23,30,50,.05)",
  shadowMd: "0 18px 44px rgba(23,30,50,.09)",
  shadowAccent: "0 16px 34px rgba(51,156,255,.22)",
  gradBrand: "linear-gradient(135deg,#1267B5,#6843B7 58%,#176B67)",
  gradAccent: "linear-gradient(135deg,#1267B5,#6843B7)",
  gradAccentTeal: "linear-gradient(135deg,#1267B5,#176B67)",
  gradPortal: "radial-gradient(540px 360px at 80% 12%,rgba(155,121,236,.16),transparent 62%),radial-gradient(420px 320px at 18% 90%,rgba(58,185,177,.14),transparent 64%),linear-gradient(135deg,#1267B5,#6843B7)",
  gradAuth: "radial-gradient(560px 420px at 86% 12%,rgba(155,121,236,.36),transparent 60%),radial-gradient(480px 360px at 6% 92%,rgba(58,185,177,.22),transparent 62%),linear-gradient(145deg,#202A49,#151A2C 58%,#241D42)",
};

// Product accent palette. Usage is limited to Product identity:
// Product Home heroes / icon chips / Global Rail active item / Context Rail active item.
// Buttons, links, forms and focus stay on the shared T.accent; aiAccent rules unchanged.
// gradFrom is the DARK side, gradTo the light side (approved mock: 濃→明, 120deg).
// Feeps One総合HomeはNOVA.gradPortalを使い、Product Homeと役割・見た目を分ける。
// Product families stay distinct: blue(training) / teal(learning) / purple(talent) /
// orange(matching) / rose(analytics) / indigo(admin).
export const PRODUCT_ACCENT = {
  home:      { accent: "#339CFF", deep: "#187FD4", subtle: "#E7F3FF", gradFrom: "#1267B5", gradTo: "#176B67" },
  training:  { accent: "#339CFF", deep: "#187FD4", subtle: "#E7F3FF", gradFrom: "#1267B5", gradTo: "#4E55BC" },
  learning:  { accent: "#3AB9B1", deep: "#238B85", subtle: "#E7F7F5", gradFrom: "#176B67", gradTo: "#1C7771" },
  talent:    { accent: "#9B79EC", deep: "#7454C7", subtle: "#F2EDFD", gradFrom: "#5C3CB0", gradTo: "#6843B7" },
  matching:  { accent: "#F3883B", deep: "#C26421", subtle: "#FFF0E5", gradFrom: "#963F0B", gradTo: "#B2521A" },
  analytics: { accent: "#EB77B1", deep: "#BD4F86", subtle: "#FCEAF3", gradFrom: "#94285F", gradTo: "#AE3B77" },
  admin:     { accent: "#5D7BF0", deep: "#435BC1", subtle: "#EBEFFE", gradFrom: "#435BC1", gradTo: "#5366C8" },
  grants:    { accent: "#C9A227", deep: "#96791C", subtle: "#FBF3D9", gradFrom: "#7A6015", gradTo: "#C9A227" },
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

export const GRAD = NOVA.gradAccent;
export const AI_GRAD = `linear-gradient(135deg, #6843B7 0%, ${T.aiAccentDeep} 100%)`;

// ---- Prism Bright palette (Nova Command inherits its color language) ----
// 白地×明るいグラデーション。グラデーションはHero/CTA/ロゴ/Product active等の主役に限定し、
// カード面は白のまま。AIは引き続き紫(ai)専用。NOVAはこの色彩をshell/auth向けに再編している。
export const PRISM = {
  base: "#F7F9FC", ink: "#1A1C1F", sub: "#535D6E", mut: "#687286",
  line: "rgba(32,34,46,.07)", line2: "rgba(32,34,46,.13)",
  surface: "#FFFFFF", neutralSubtle: "#EFF0F4", ringTrack: "#ECEEF6",
  cardShadow: "0 1px 2px rgba(32,34,46,.04), 0 10px 30px rgba(60,80,180,.07)",
  cardShadowHover: "0 14px 38px rgba(60,80,180,.13)",
  accent: "#1267B5", accentDeep: "#0B5799", accentSubtle: "#E7F3FF",
  ai: "#9B79EC", aiDeep: "#7454C7", aiSubtle: "#F2EDFD",
  teal: "#3AB9B1", tealDeep: "#238B85", tealSubtle: "#E7F7F5",
  ok: "#22A06B", okSubtle: "#E7F5EE",
  warn: "#DD9426", warnSubtle: "#FAF1DF",
  bad: "#E25C50", badSubtle: "#FBECEA",
  badLine: "rgba(226,92,80,.3)", warnLine: "rgba(221,148,38,.3)",
  heroGlass: "rgba(255,255,255,.14)", heroGlassStrong: "rgba(255,255,255,.2)",
  heroLine: "rgba(255,255,255,.24)", heroTextSoft: "rgba(255,255,255,.78)",
  heroShadow: "0 18px 50px rgba(79,107,240,.2)",
  gradCta: "linear-gradient(110deg,#1267B5,#176B67)",
  gradHero: "linear-gradient(120deg,#1267B5,#6843B7)",
  gradMark: "linear-gradient(135deg,#1267B5,#6843B7 55%,#176B67)",
  gradText: "linear-gradient(90deg,#1267B5,#6843B7 55%,#176B67)",
  gradTraining: "linear-gradient(135deg,#1267B5,#4E55BC)",
  gradLearning: "linear-gradient(135deg,#176B67,#1C7771)",
  gradTalent: "linear-gradient(135deg,#5C3CB0,#6843B7)",
  gradMatching: "linear-gradient(135deg,#963F0B,#B2521A)",
  gradAnalytics: "linear-gradient(135deg,#94285F,#AE3B77)",
  gradHome: "linear-gradient(135deg,#1267B5,#176B67)",
  // 四隅の光（Aurora）。ページ全面の背景にのみ使用する
  auroraBg: [
    "radial-gradient(640px 420px at -4% -6%, rgba(79,107,240,.12), transparent 66%)",
    "radial-gradient(560px 400px at 104% -4%, rgba(45,199,184,.10), transparent 66%)",
    "radial-gradient(560px 420px at -6% 106%, rgba(249,115,98,.07), transparent 66%)",
    "radial-gradient(640px 440px at 106% 106%, rgba(139,124,246,.10), transparent 66%)",
  ].join(",") + ", #F7F8FD",
};

// Product key -> bright gradient lookup for Global Rail, command palette and Home.
export const PRISM_PRODUCT_GRAD = {
  home: PRISM.gradHome,
  training: PRISM.gradTraining,
  learning: PRISM.gradLearning,
  talent: PRISM.gradTalent,
  matching: PRISM.gradMatching,
  analytics: PRISM.gradAnalytics,
  grants: "linear-gradient(135deg,#7A6015,#C9A227)",
};
