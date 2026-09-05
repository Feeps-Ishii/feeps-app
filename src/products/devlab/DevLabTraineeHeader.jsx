import React from "react";
import { T, PRODUCT_ACCENT } from "../../components/common";
import { Code2, GitBranch } from "lucide-react";

// 受講生の開発演習の見出しと、案件／チームの切り替え（2026-09-06）。
// 承認モック: mock/devlab-header の案E（Cの看板の見た目 ＋ Dの低さ）
//
// 経緯: 最初は小さなセグメントを見出しの上に置いたが**見出しに埋もれた**。
// 次に大きなカード2枚にしたら**336pxで場所を取りすぎた**（案件カードが見えない）。
// 看板の質感を残したまま横長にして、146pxに収めたのがこの形。

const A = PRODUCT_ACCENT.devlab;

const TABS = [
  { value: "projects", label: "ひとりで案件をやる", Icon: Code2, desc: "ひとりで進める案件と、コードの練習" },
  { value: "team", label: "チームで開発する", Icon: GitBranch, desc: "チームで1つのコードベースを進める" },
];

const DESC = {
  projects: "実際の案件に近い流れを、担当を選んで体験します。まずコードを書いて練習することもできます。",
  team: "チームで1つのコードベースを進めます。他のメンバーの変更を取り込みながら、自分の担当を実装しましょう。",
};

export default function DevLabTraineeHeader({ tab, onChange, projectCount = 0, teamCount = 0 }) {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] text-white"
          style={{ background: `linear-gradient(135deg, ${A.gradFrom}, ${A.accent})` }}>
          <Code2 size={17} />
        </span>
        <h2 className="text-xl font-bold tracking-tight" style={{ color: T.textPrimary }}>開発演習</h2>
        <p className="w-full text-xs" style={{ color: T.textSecondary }}>{DESC[tab] || DESC.projects}</p>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {TABS.map(({ value, label, Icon, desc }) => {
          const on = tab === value;
          const count = value === "team" ? teamCount : projectCount;
          return (
            <button
              key={value} type="button" aria-pressed={on} onClick={() => onChange(value)}
              className="relative flex items-center gap-3 overflow-hidden rounded-[15px] border p-3 text-left transition"
              style={{
                borderColor: on ? A.accent : T.border,
                background: T.bgSurface,
                boxShadow: on ? `0 0 0 3px ${A.subtle}` : "none",
              }}
            >
              {/* 看板の質感（案Cから引き継いだ装飾）。選択中は製品色で染める */}
              <span aria-hidden="true" className="pointer-events-none absolute -bottom-[34px] -right-[34px] h-[110px] w-[110px] rounded-full"
                style={{ background: on ? A.subtle : T.bgBase, opacity: 0.85 }} />
              <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[13px]"
                style={on
                  ? { background: `linear-gradient(135deg, ${A.gradFrom}, ${A.accent})`, color: "#fff" }
                  : { background: T.bgBase, color: T.textMuted }}>
                <Icon size={19} />
              </span>
              <span className="relative min-w-0">
                <span className="flex items-center gap-2 text-[14.5px] font-bold"
                  style={{ color: on ? A.deep : T.textPrimary }}>
                  {label}
                  {count > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: on ? A.subtle : T.bgBase, color: on ? A.deep : T.textMuted }}>
                      {count}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[11.5px]" style={{ color: T.textSecondary }}>{desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
