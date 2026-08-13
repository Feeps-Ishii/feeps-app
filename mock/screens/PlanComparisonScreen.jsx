import React from "react";
import { Check, Minus, Settings } from "lucide-react";
import { NOVA, T, PRODUCT_ACCENT } from "../../src/components/common/theme.js";
import { MockCaption } from "../MockShell.jsx";
import { PLAN_ROWS, COURSE_VISIBILITY_ROWS } from "../dummyData.js";

const PLANS = [
  { key: "basic", label: "Basic", sub: "まず使ってみる" },
  { key: "standard", label: "Standard", sub: "実務レベルで学ぶ", featured: true },
  { key: "premium", label: "Premium", sub: "自分で作って学ぶ" },
];

function Cell({ value }) {
  const pa = PRODUCT_ACCENT.learning;
  if (value === "yes") return <Check size={15} style={{ color: pa.deep }} />;
  if (value === "trial") return <span className="text-[11px] font-bold" style={{ color: T.warning }}>△3問</span>;
  return <Minus size={14} style={{ color: NOVA.quiet }} />;
}

// プラン比較（学習側のみ。研修管理にはプランを設けない構想）＋
// コース公開範囲（プラン単位・企業単位）の管理画面イメージ。データ設計は今回対象外、表示のみ。
export default function PlanComparisonScreen() {
  const pa = PRODUCT_ACCENT.learning;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <MockCaption>
          学習側のプラン構成案。研修管理にはプランを設けない（企業向け業務システムとして別契約）。価格・課金単位は未定。
        </MockCaption>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map(p => (
            <div key={p.key} className="rounded-[16px] p-5" style={{ background: NOVA.card, border: p.featured ? `2px solid ${pa.accent}` : `1px solid ${NOVA.line}` }}>
              {p.featured && <span className="mb-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: pa.subtle, color: pa.deep }}>想定の主力</span>}
              <div className="text-base font-bold" style={{ color: NOVA.ink }}>{p.label}</div>
              <p className="mb-3 text-xs" style={{ color: NOVA.muted }}>{p.sub}</p>
              <ul className="flex flex-col">
                {PLAN_ROWS.map(row => (
                  <li key={row.label} className="flex items-center justify-between gap-2 py-1.5 text-[13px]" style={{ borderTop: `1px solid ${NOVA.line}`, color: NOVA.ink }}>
                    <span>{row.label}</span>
                    <Cell value={row[p.key]} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div>
        <MockCaption>
          コースの公開範囲は<strong>プラン単位・企業単位の両方</strong>で制御する構想。管理画面のイメージのみ（データ設計は対象外、表示はダミー）。
        </MockCaption>
        <div className="overflow-hidden rounded-[14px]" style={{ background: NOVA.card, border: `1px solid ${NOVA.line}` }}>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: `1px solid ${NOVA.line}` }}>
            <Settings size={15} style={{ color: NOVA.muted }} />
            <span className="text-sm font-bold" style={{ color: NOVA.ink }}>コース公開範囲の設定</span>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[520px] border-collapse text-[13px]">
              <thead>
                <tr style={{ color: NOVA.muted }}>
                  <th className="px-2 py-2 text-left font-semibold">コース</th>
                  <th className="px-2 py-2 text-left font-semibold">公開プラン</th>
                  <th className="px-2 py-2 text-left font-semibold">公開企業</th>
                </tr>
              </thead>
              <tbody>
                {COURSE_VISIBILITY_ROWS.map(row => (
                  <tr key={row.course} style={{ borderTop: `1px solid ${NOVA.line}` }}>
                    <td className="px-2 py-2.5 font-semibold" style={{ color: NOVA.ink }}>{row.course}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {row.plans.map(pl => (
                          <span key={pl} className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: pa.subtle, color: pa.deep }}>{pl}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2.5" style={{ color: NOVA.muted }}>{row.companies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
