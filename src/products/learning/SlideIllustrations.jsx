// 教材スライドの挿絵（2026-08-20新設。承認モック: mock/slide-design）。
//
// **AIには画像を描かせない。** ここに用意した8種類からAIが1語だけ選び
// （bedrock.mjs の SLIDE_ILLUSTRATIONS と1対1で対応）、その名前でこの部品を出す。
//   ・生成コストがゼロ（画像生成モデルは1枚あたり数円かかる）
//   ・絵柄が必ず揃う（AI生成だと毎回タッチがブレる）
// 様式は既存の TrainingHomeIllustrations.jsx に合わせる:
// フラット・文字を入れない・色はトークンから取る・viewBoxで拡縮する。
import React from "react";
import { T } from "../../components/common";

// 種別ごとの主色。スライド上端のラベル色とも揃える（SLIDE_KIND_TONE参照）。
const BLUE = T.accent;
const TEAL = "#176B67";
const GREEN = T.success;
const WARN = T.warning;
const VIOLET = T.aiAccentDeep;

function Document({ c }) {
  return (
    <>
      <rect x="18" y="24" width="96" height="102" rx="11" fill="#fff" opacity=".96" />
      <rect x="18" y="24" width="96" height="16" rx="11" fill="#fff" opacity=".5" />
      <rect x="18" y="32" width="96" height="8" fill="#fff" opacity=".5" />
      <rect x="33" y="55" width="66" height="6" rx="3" fill={c} opacity=".24" />
      <rect x="33" y="69" width="50" height="6" rx="3" fill={c} opacity=".17" />
      <rect x="33" y="83" width="58" height="6" rx="3" fill={c} opacity=".17" />
      <rect x="33" y="97" width="36" height="6" rx="3" fill={c} opacity=".12" />
      <rect x="130" y="34" width="64" height="40" rx="10" fill="#fff" opacity=".93" />
      <rect x="142" y="50" width="40" height="6" rx="3" fill={c} opacity=".2" />
      <rect x="130" y="84" width="64" height="40" rx="10" fill="#fff" opacity=".93" />
      <rect x="142" y="100" width="30" height="6" rx="3" fill={c} opacity=".2" />
    </>
  );
}

function Flow({ c }) {
  return (
    <>
      <circle cx="42" cy="75" r="24" fill="#fff" opacity=".95" />
      <circle cx="42" cy="75" r="10" fill={c} opacity=".28" />
      <path d="M70 75h20" stroke={c} strokeWidth="2.6" strokeDasharray="5 5" strokeLinecap="round" opacity=".45" />
      <circle cx="106" cy="75" r="24" fill="#fff" opacity=".95" />
      <circle cx="106" cy="75" r="10" fill={c} opacity=".2" />
      <path d="M134 75h20" stroke={c} strokeWidth="2.6" strokeDasharray="5 5" strokeLinecap="round" opacity=".45" />
      <circle cx="170" cy="75" r="24" fill="#fff" opacity=".95" />
      <path d="M163 75l5 5 10-11" stroke={GREEN} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  );
}

function Compare() {
  return (
    <>
      <rect x="20" y="26" width="78" height="98" rx="11" fill="#fff" opacity=".96" />
      <rect x="34" y="44" width="50" height="6" rx="3" fill={T.danger} opacity=".28" />
      <rect x="34" y="60" width="38" height="6" rx="3" fill={T.danger} opacity=".18" />
      <rect x="34" y="76" width="44" height="6" rx="3" fill={T.danger} opacity=".18" />
      <path d="M52 100l14 14M66 100l-14 14" stroke={T.danger} strokeWidth="3" strokeLinecap="round" opacity=".6" />
      <rect x="114" y="26" width="78" height="98" rx="11" fill="#fff" opacity=".96" />
      <rect x="128" y="44" width="50" height="6" rx="3" fill={GREEN} opacity=".3" />
      <rect x="128" y="60" width="38" height="6" rx="3" fill={GREEN} opacity=".2" />
      <rect x="128" y="76" width="44" height="6" rx="3" fill={GREEN} opacity=".2" />
      <path d="M144 107l6 6 12-13" stroke={GREEN} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  );
}

function Checklist({ c }) {
  return (
    <>
      <rect x="30" y="20" width="152" height="110" rx="12" fill="#fff" opacity=".96" />
      {[46, 75, 104].map((y, i) => (
        <g key={y}>
          <circle cx="56" cy={y} r="10" fill={c} opacity={0.2 - i * 0.03} />
          <path d={`M51 ${y}l4 4 8-8.5`} stroke={c} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".85" />
          <rect x="78" y={y - 4} width={i === 0 ? 74 : i === 1 ? 60 : 66} height="7" rx="3.5" fill={c} opacity={0.24 - i * 0.04} />
        </g>
      ))}
    </>
  );
}

function Caution() {
  return (
    <>
      <path d="M106 26l58 84a8 8 0 0 1-6.6 12.4H54.6A8 8 0 0 1 48 110z" fill="#fff" opacity=".95" />
      <path d="M106 40l48 70H58z" fill={WARN} opacity=".16" />
      <rect x="101" y="62" width="10" height="30" rx="5" fill={WARN} opacity=".8" />
      <circle cx="106" cy="102" r="5.4" fill={WARN} opacity=".8" />
    </>
  );
}

function Data({ c }) {
  return (
    <>
      <rect x="24" y="24" width="164" height="102" rx="12" fill="#fff" opacity=".96" />
      <rect x="46" y="82" width="20" height="28" rx="4" fill={c} opacity=".2" />
      <rect x="78" y="64" width="20" height="46" rx="4" fill={c} opacity=".3" />
      <rect x="110" y="46" width="20" height="64" rx="4" fill={c} opacity=".4" />
      <rect x="142" y="72" width="20" height="38" rx="4" fill={c} opacity=".22" />
      <path d="M46 60l32-14 32-16 32 12" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".5" />
    </>
  );
}

function People({ c }) {
  return (
    <>
      <circle cx="72" cy="52" r="19" fill="#fff" opacity=".95" />
      <circle cx="72" cy="47" r="8" fill={c} opacity=".3" />
      <path d="M60 66c2-6 6-9 12-9s10 3 12 9z" fill={c} opacity=".22" />
      <rect x="38" y="80" width="68" height="46" rx="11" fill="#fff" opacity=".95" />
      <rect x="52" y="96" width="40" height="6" rx="3" fill={c} opacity=".22" />
      <rect x="52" y="108" width="28" height="6" rx="3" fill={c} opacity=".15" />
      <circle cx="150" cy="60" r="15" fill="#fff" opacity=".9" />
      <circle cx="150" cy="56" r="6" fill={c} opacity=".2" />
      <path d="M141 71c1.6-4.6 4.8-7 9-7s7.4 2.4 9 7z" fill={c} opacity=".15" />
      <rect x="122" y="86" width="58" height="40" rx="10" fill="#fff" opacity=".9" />
      <rect x="134" y="100" width="34" height="6" rx="3" fill={c} opacity=".16" />
    </>
  );
}

function Time({ c }) {
  return (
    <>
      <circle cx="106" cy="75" r="46" fill="#fff" opacity=".95" />
      <circle cx="106" cy="75" r="38" fill="none" stroke={c} strokeWidth="3" opacity=".3" />
      <path d="M106 50v25l16 11" stroke={c} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".7" />
      <circle cx="106" cy="75" r="4" fill={c} opacity=".7" />
    </>
  );
}

const SHAPES = {
  document: { Comp: Document, color: BLUE },
  flow: { Comp: Flow, color: TEAL },
  compare: { Comp: Compare, color: BLUE },
  checklist: { Comp: Checklist, color: GREEN },
  caution: { Comp: Caution, color: WARN },
  data: { Comp: Data, color: BLUE },
  people: { Comp: People, color: VIOLET },
  time: { Comp: Time, color: TEAL },
};

export function hasIllustration(name) {
  return !!SHAPES[name];
}

/** @param name SLIDE_ILLUSTRATIONS のいずれか。未知の値ならnullを返す（描かない） */
export default function SlideIllustration({ name, width = 212, height = 150 }) {
  const shape = SHAPES[name];
  if (!shape) return null;
  const { Comp, color } = shape;
  return (
    <svg width={width} height={height} viewBox="0 0 212 150" role="img" aria-hidden="true" focusable="false">
      <Comp c={color} />
    </svg>
  );
}
