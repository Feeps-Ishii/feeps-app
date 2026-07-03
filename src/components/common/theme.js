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
export const PRODUCT_ACCENT = {
  training:  { accent: "#3D6BFF", deep: "#1E47CC", subtle: "#EDF1FF", gradFrom: "#1E47CC", gradTo: "#3D6BFF" },
  learning:  { accent: "#14A3B8", deep: "#0E7A8A", subtle: "#E7F5F7", gradFrom: "#0E7A8A", gradTo: "#14A3B8" },
  talent:    { accent: "#7C5CE0", deep: "#6247B8", subtle: "#F3F0FC", gradFrom: "#4B32A8", gradTo: "#7C5CE0" },
  matching:  { accent: "#E07B39", deep: "#B25E1F", subtle: "#FBF0E7", gradFrom: "#B25E1F", gradTo: "#E07B39" },
  analytics: { accent: "#00A0D2", deep: "#00789E", subtle: "#E6F5FA", gradFrom: "#00789E", gradTo: "#00A0D2" },
  admin:     { accent: "#3A404C", deep: "#23272F", subtle: "#EDEEF1", gradFrom: "#23272F", gradTo: "#3A404C" },
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
