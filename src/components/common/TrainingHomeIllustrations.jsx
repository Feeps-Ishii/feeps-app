import React from "react";
import { PRISM, PRODUCT_ACCENT } from "./theme.js";

// 研修管理Home刷新（モード分離Step2、2026-08-15）のヒーローイラスト。
// 形状・レイアウト・配置はモック(feeps-training-home-final-mock.html)をそのまま流用し、
// 色だけをPRODUCT_ACCENT/PRISMトークンへ差し替えている。文字は入れない方針（モック通り）。

const trainDeep = PRODUCT_ACCENT.training.deep;
const trainAccent = PRODUCT_ACCENT.training.accent;
const trainGradFrom = PRODUCT_ACCENT.training.gradFrom;
const trainGradTo = PRODUCT_ACCENT.training.gradTo;
const heroGradFrom = "#1267B5"; // PRISM.gradHero 1つ目の停止色（トークン文字列からの直接参照が無いため値を明示）
const heroGradTo = "#6843B7"; // PRISM.gradHero 2つ目の停止色
const warm = PRODUCT_ACCENT.matching.accent;
const ok = PRISM.ok;
const bad = PRISM.bad;
const warn = PRISM.warn;

export function TraineeTrainingDayIllustration() {
  return (
    <svg width="220" height="128" viewBox="0 0 220 128" role="img" aria-label="日報と出勤状況を表すイラスト">
      <rect x="16" y="19" width="92" height="90" rx="9" fill="#fff" opacity=".95" />
      <rect x="16" y="19" width="92" height="16" rx="9" fill="#fff" opacity=".5" />
      <rect x="16" y="27" width="92" height="8" fill="#fff" opacity=".5" />
      <rect x="30" y="48" width="64" height="5" rx="2.5" fill={trainDeep} opacity=".26" />
      <rect x="30" y="60" width="48" height="5" rx="2.5" fill={trainDeep} opacity=".19" />
      <rect x="30" y="72" width="56" height="5" rx="2.5" fill={trainDeep} opacity=".19" />
      <rect x="30" y="84" width="34" height="5" rx="2.5" fill={trainDeep} opacity=".13" />
      <path d="M30 96h26" stroke={warm} strokeWidth="3" strokeLinecap="round" opacity=".5" />
      <path d="M112 64h14" stroke="#fff" strokeWidth="2.4" strokeDasharray="4 4" strokeLinecap="round" opacity=".65" />
      <rect x="134" y="22" width="70" height="38" rx="9" fill="#fff" opacity=".93" />
      <path d="M159 41.5l6 6 12-13" stroke={ok} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="134" y="68" width="70" height="38" rx="9" fill="#fff" opacity=".93" />
      <circle cx="169" cy="87" r="11" stroke={warm} strokeWidth="2.8" fill="none" />
      <path d="M169 81.5V87l4 2.6" stroke={warm} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function TraineeOffDayIllustration() {
  return (
    <svg width="220" height="128" viewBox="0 0 220 128" role="img" aria-label="カレンダーと次の研修日を表すイラスト">
      <rect x="20" y="18" width="100" height="92" rx="9" fill="#fff" opacity=".95" />
      <rect x="20" y="18" width="100" height="18" rx="9" fill="#fff" opacity=".5" />
      <rect x="20" y="28" width="100" height="8" fill="#fff" opacity=".5" />
      <circle cx="42" cy="15" r="4" fill="#fff" opacity=".65" />
      <circle cx="98" cy="15" r="4" fill="#fff" opacity=".65" />
      <rect x="32" y="46" width="17" height="14" rx="3.5" fill={heroGradFrom} opacity=".18" />
      <rect x="53" y="46" width="17" height="14" rx="3.5" fill={heroGradFrom} opacity=".18" />
      <rect x="74" y="46" width="17" height="14" rx="3.5" fill={heroGradFrom} opacity=".18" />
      <rect x="95" y="46" width="17" height="14" rx="3.5" fill={heroGradFrom} opacity=".18" />
      <rect x="32" y="65" width="17" height="14" rx="3.5" fill={heroGradFrom} opacity=".18" />
      <rect x="53" y="65" width="17" height="14" rx="3.5" fill={warm} opacity=".85" />
      <rect x="74" y="65" width="17" height="14" rx="3.5" fill={heroGradFrom} opacity=".18" />
      <rect x="95" y="65" width="17" height="14" rx="3.5" fill={heroGradFrom} opacity=".18" />
      <rect x="32" y="84" width="17" height="14" rx="3.5" fill={heroGradFrom} opacity=".18" />
      <rect x="53" y="84" width="17" height="14" rx="3.5" fill={heroGradFrom} opacity=".18" />
      <rect x="74" y="84" width="17" height="14" rx="3.5" fill={heroGradFrom} opacity=".18" />
      <path d="M124 64h14" stroke="#fff" strokeWidth="2.4" strokeDasharray="4 4" strokeLinecap="round" opacity=".65" />
      <rect x="146" y="33" width="58" height="58" rx="9" fill="#fff" opacity=".92" />
      <path d="M160 60h30M160 70h20" stroke={heroGradFrom} strokeWidth="3.4" strokeLinecap="round" opacity=".38" />
      <path d="M175 45l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z" fill={warm} opacity=".8" />
    </svg>
  );
}

export function InstructorHomeIllustration() {
  return (
    <svg width="220" height="128" viewBox="0 0 220 128" role="img" aria-label="対応待ちの件数を表すイラスト">
      <rect x="14" y="20" width="104" height="88" rx="9" fill="#fff" opacity=".95" />
      <rect x="14" y="20" width="104" height="16" rx="9" fill="#fff" opacity=".5" />
      <rect x="14" y="28" width="104" height="8" fill="#fff" opacity=".5" />
      <circle cx="34" cy="53" r="6.5" fill={bad} opacity=".3" />
      <rect x="47" y="50" width="56" height="5" rx="2.5" fill={trainGradFrom} opacity=".22" />
      <circle cx="34" cy="72" r="6.5" fill={bad} opacity=".3" />
      <rect x="47" y="69" width="44" height="5" rx="2.5" fill={trainGradFrom} opacity=".22" />
      <circle cx="34" cy="91" r="6.5" fill={warn} opacity=".42" />
      <rect x="47" y="88" width="50" height="5" rx="2.5" fill={trainGradFrom} opacity=".22" />
      <path d="M122 64h14" stroke="#fff" strokeWidth="2.4" strokeDasharray="4 4" strokeLinecap="round" opacity=".65" />
      <rect x="144" y="35" width="62" height="58" rx="9" fill="#fff" opacity=".93" />
      <path d="M163 64h24" stroke={warm} strokeWidth="3.4" strokeLinecap="round" opacity=".75" />
      <path d="M175 52v24" stroke={warm} strokeWidth="3.4" strokeLinecap="round" opacity=".75" />
    </svg>
  );
}

export function ClientHomeIllustration() {
  return (
    <svg width="220" height="128" viewBox="0 0 220 128" role="img" aria-label="受講生全体の状況を表すイラスト">
      <rect x="14" y="20" width="106" height="88" rx="9" fill="#fff" opacity=".95" />
      <rect x="14" y="20" width="106" height="16" rx="9" fill="#fff" opacity=".5" />
      <rect x="14" y="28" width="106" height="8" fill="#fff" opacity=".5" />
      <rect x="30" y="80" width="14" height="18" rx="3" fill={trainGradFrom} opacity=".38" />
      <rect x="49" y="70" width="14" height="28" rx="3" fill={trainGradFrom} opacity=".5" />
      <rect x="68" y="56" width="14" height="42" rx="3" fill={trainGradFrom} opacity=".66" />
      <rect x="87" y="64" width="14" height="34" rx="3" fill={ok} opacity=".55" />
      <path d="M124 64h14" stroke="#fff" strokeWidth="2.4" strokeDasharray="4 4" strokeLinecap="round" opacity=".65" />
      <rect x="146" y="24" width="60" height="38" rx="9" fill="#fff" opacity=".93" />
      <path d="M167 43l5.5 5.5 11-12" stroke={ok} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="146" y="68" width="60" height="38" rx="9" fill="#fff" opacity=".93" />
      <path d="M176 77v14" stroke={bad} strokeWidth="3.4" strokeLinecap="round" opacity=".8" />
      <circle cx="176" cy="98" r="2.2" fill={bad} opacity=".8" />
    </svg>
  );
}

export function AdminHomeIllustration() {
  return (
    <svg width="220" height="128" viewBox="0 0 220 128" role="img" aria-label="複数コースの運営状況を表すイラスト">
      <rect x="14" y="26" width="58" height="76" rx="9" fill="#fff" opacity=".95" />
      <rect x="14" y="26" width="58" height="14" rx="9" fill="#fff" opacity=".5" />
      <rect x="14" y="33" width="58" height="7" fill="#fff" opacity=".5" />
      <rect x="27" y="54" width="32" height="5" rx="2.5" fill={trainGradFrom} opacity=".3" />
      <rect x="27" y="66" width="24" height="5" rx="2.5" fill={trainGradFrom} opacity=".22" />
      <rect x="27" y="78" width="28" height="5" rx="2.5" fill={trainGradFrom} opacity=".22" />
      <rect x="81" y="26" width="58" height="76" rx="9" fill="#fff" opacity=".88" />
      <rect x="81" y="26" width="58" height="14" rx="9" fill="#fff" opacity=".45" />
      <rect x="81" y="33" width="58" height="7" fill="#fff" opacity=".45" />
      <rect x="94" y="54" width="32" height="5" rx="2.5" fill={trainGradFrom} opacity=".28" />
      <rect x="94" y="66" width="22" height="5" rx="2.5" fill={trainGradFrom} opacity=".2" />
      <rect x="94" y="78" width="30" height="5" rx="2.5" fill={trainGradFrom} opacity=".2" />
      <rect x="148" y="26" width="58" height="76" rx="9" fill="#fff" opacity=".8" />
      <rect x="148" y="26" width="58" height="14" rx="9" fill="#fff" opacity=".4" />
      <rect x="148" y="33" width="58" height="7" fill="#fff" opacity=".4" />
      <circle cx="177" cy="70" r="15" fill={bad} opacity=".22" />
      <path d="M177 62v10" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" opacity=".9" />
      <circle cx="177" cy="78" r="2" fill="#fff" opacity=".9" />
    </svg>
  );
}
