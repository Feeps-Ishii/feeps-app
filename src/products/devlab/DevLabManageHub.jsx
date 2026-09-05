import React, { useState } from "react";
import { Seg, T } from "../../components/common";
import { ProjectManager, WorkspaceTemplateManager, TeamProjectManager, TeamManager } from "./DevLabComponents.jsx";

// 開発演習の管理をまとめた画面（2026-09-05）。
//
// それまでサイドナビに「案件管理」「プロジェクト体験管理」「チーム開発案件」「チーム」が
// 並んでおり、**どれが題材でどれが実体か分からない**という指摘を受けて1画面へ統合した。
// 4つは層が違うだけで、どれも「開発演習を用意する」作業なので、タブで並べる方が近い。
//
//   案件         受講生が1人で進める疑似案件（担当工程・タスク・チェックリスト）
//   ベースコード  案件から開くワークスペースの出発点コード（旧「プロジェクト体験」）
//   チームの題材  複数人で1つのコードを触る案件（役割分担・AIメンバーのコミット）
//   チーム編成    その題材から作る実際のチーム。誰をどの役割に置くか

const TABS = [
  { value: "projects", label: "案件", desc: "1人で進める疑似案件。担当工程とタスクを決めます" },
  { value: "base", label: "ベースコード", desc: "案件から開くワークスペースの出発点です" },
  { value: "teamProjects", label: "チームの題材", desc: "複数人で1つのコードを触る案件です" },
  { value: "teams", label: "チーム編成", desc: "題材から実際のチームを作り、担当を割り当てます" },
];

// 企業担当者はチーム編成だけ（題材の作成と実装は開放していない。dev-team-spec §1）
const CLIENT_TABS = TABS.filter(t => t.value === "teams");

export default function DevLabManageHub({ role, initialTab = "projects" }) {
  const tabs = role === "client" ? CLIENT_TABS : TABS;
  const [tab, setTab] = useState(tabs.some(t => t.value === initialTab) ? initialTab : tabs[0].value);
  const current = tabs.find(t => t.value === tab) || tabs[0];

  return (
    <div>
      {/* 各画面が自分の見出しを持っているので、ここは切り替えだけを出す */}
      {tabs.length > 1 && (
        <div className="mb-2">
          <Seg value={tab} onChange={setTab} options={tabs.map(t => ({ value: t.value, label: t.label }))} />
          <p className="mt-1.5 text-xs" style={{ color: T.textMuted }}>{current.desc}</p>
        </div>
      )}

      {tab === "projects" && <ProjectManager role={role} />}
      {tab === "base" && <WorkspaceTemplateManager />}
      {tab === "teamProjects" && <TeamProjectManager role={role} />}
      {tab === "teams" && <TeamManager role={role} />}
    </div>
  );
}
