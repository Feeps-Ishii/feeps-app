import React from "react";
import { PageHeader, T, PRODUCT_ACCENT } from "../../components/common";
import { Code2, GitBranch } from "lucide-react";

// 受講生の開発演習の見出しと、案件／チームの切り替え（2026-09-06）。
//
// 統合したとき、切り替えを小さなセグメントで見出しの上に置いたら**見出しに埋もれた**
// （ユーザー指摘）。切り替えは画面の性格を変える操作なので、見出しと同じ強さで出す。
//
// 見出しは PageHeader（他Productと同じ部品）に寄せた。SectionHead だと文字だけで淡泊だったため。

const TABS = [
  { value: "projects", label: "案件・練習", Icon: Code2, desc: "ひとりで進める案件と、コードの練習" },
  { value: "team", label: "チーム開発", Icon: GitBranch, desc: "チームで1つのコードベースを進める" },
];

export default function DevLabTraineeHeader({ tab, onChange, projectCount = 0, runningCount = 0, teamCount = 0 }) {
  const chips = [];
  if (projectCount > 0) chips.push({ label: "案件", value: `${projectCount}` });
  if (runningCount > 0) chips.push({ label: "進行中", value: `${runningCount}` });
  if (teamCount > 0) chips.push({ label: "チーム", value: `${teamCount}` });

  return (
    <>
      <PageHeader
        product="devlab"
        label="開発演習"
        title={tab === "team" ? "チームで開発する" : "案件で開発を体験する"}
        description={tab === "team"
          ? "チームで1つのコードベースを進めます。他のメンバーの変更を取り込みながら、自分の担当を実装しましょう。"
          : "実際の案件に近い流れを、担当を選んで体験します。まずコードを書いて練習することもできます。"}
        chips={chips}
      />

      {/* 切り替えは見出しの直下に、押せると分かる大きさで置く */}
      <div className="mb-5 grid gap-2 sm:grid-cols-2">
        {TABS.map(({ value, label, Icon, desc }) => {
          const on = tab === value;
          const count = value === "team" ? teamCount : projectCount;
          return (
            <button
              key={value} type="button" aria-pressed={on} onClick={() => onChange(value)}
              className="flex items-center gap-3 rounded-2xl border p-3.5 text-left transition"
              style={{
                borderColor: on ? PRODUCT_ACCENT.devlab.accent : T.border,
                background: on ? PRODUCT_ACCENT.devlab.subtle : T.bgSurface,
                boxShadow: on ? `0 0 0 3px ${PRODUCT_ACCENT.devlab.subtle}` : "none",
              }}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{
                  background: on ? PRODUCT_ACCENT.devlab.accent : T.bgBase,
                  color: on ? "#fff" : T.textMuted,
                }}>
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: on ? PRODUCT_ACCENT.devlab.deep : T.textPrimary }}>
                    {label}
                  </span>
                  {count > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        background: on ? "#fff" : T.bgBase,
                        color: on ? PRODUCT_ACCENT.devlab.deep : T.textMuted,
                      }}>{count}</span>
                  )}
                </span>
                <span className="mt-0.5 block text-[11.5px]" style={{ color: T.textSecondary }}>{desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
