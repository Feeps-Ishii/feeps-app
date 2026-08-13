import React from "react";
import { Users, Bot, UserCheck } from "lucide-react";
import { NOVA, T, PRODUCT_ACCENT } from "../../src/components/common/theme.js";
import { MockTopbar, MockCaption, MockBody, MockApp } from "../MockShell.jsx";
import { MODES } from "../modes.js";
import { TEAM_MEMBERS, PROJECT_STEPS, REVIEW_OPTIONS } from "../dummyData.js";

const STEP_STATE_LABEL = { done: "完了", active: "進行中", locked: "" };

function StepCard({ step }) {
  const pa = PRODUCT_ACCENT.learning;
  const locked = step.state === "locked";
  return (
    <div className="relative flex flex-col gap-2 rounded-[16px] p-4"
      style={{
        background: locked ? NOVA.paper : NOVA.card,
        border: step.state === "active" ? `2px solid ${pa.accent}` : `1px solid ${NOVA.line}`,
      }}>
      {STEP_STATE_LABEL[step.state] && (
        <span className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={step.state === "active" ? { background: pa.subtle, color: pa.deep } : { background: T.successSubtle, color: T.success }}>
          {STEP_STATE_LABEL[step.state]}
        </span>
      )}
      <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
        style={{ background: locked ? NOVA.soft : pa.subtle, color: locked ? NOVA.quiet : pa.deep }}>{step.n}</span>
      <span className="text-sm font-bold" style={{ color: locked ? NOVA.quiet : NOVA.ink }}>{step.title}</span>
      <p className="text-xs leading-relaxed" style={{ color: NOVA.muted }}>{step.desc}</p>
      {step.n === 4 && (
        <div className="mt-1 flex flex-col gap-1.5">
          {REVIEW_OPTIONS.map(r => (
            <div key={r.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: NOVA.soft }}>
              {r.key === "ai" ? <Bot size={13} style={{ color: T.aiAccentDeep }} /> : <UserCheck size={13} style={{ color: pa.deep }} />}
              <span className="text-[11px] font-semibold" style={{ color: NOVA.muted }}>{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 案件参画体験の画面イメージ。チーム編成の状況＋案件進行ステップ（実装=DevLab想定、
// レビュー=AI/社内担当者の両方が選べる想定、成果=スキル・成長へ記録される想定）。
export default function ProjectExperienceScreen() {
  const pa = PRODUCT_ACCENT.learning;
  return (
    <div>
      <MockCaption>
        案件参画体験の画面イメージ。<strong>チームを組んで、実際の案件と同じ流れを最後まで通す</strong>のが差になる部分。チーム機能・実装/レビューとの連携は構想段階のため画面上の文言のみで示す。
      </MockCaption>
      <MockApp>
        <MockTopbar modes={MODES} activeMode="learning" planTag="Standard" />
        <MockBody>
          <p className="mb-1 text-xs font-bold" style={{ color: pa.deep }}>学習モード ／ 案件参画体験</p>
          <h3 className="mb-4 text-[17px] font-bold" style={{ color: NOVA.ink }}>社内ポータルの刷新プロジェクト</h3>

          <div className="mb-4 flex items-center gap-2 rounded-2xl p-3 text-[13px]" style={{ background: T.aiSubtle, color: T.aiAccentDeep }}>
            <Users size={15} /><strong>チーム編成中</strong>　4人中3人が参加済み。全員そろうとキックオフできます。
          </div>

          <p className="mb-2 text-xs font-bold" style={{ color: NOVA.muted }}>チーム編成</p>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TEAM_MEMBERS.map(m => (
              <div key={m.name} className="flex flex-col items-start gap-2 rounded-[14px] p-3" style={{ background: m.filled ? NOVA.card : NOVA.paper, border: `1px solid ${NOVA.line}` }}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ background: m.filled ? pa.subtle : NOVA.soft, color: m.filled ? pa.deep : NOVA.quiet }}>{m.name.slice(0, 1)}</span>
                <span className="text-[13px] font-bold" style={{ color: m.filled ? NOVA.ink : NOVA.quiet }}>{m.name}</span>
                <span className="text-[11px]" style={{ color: NOVA.muted }}>{m.role}</span>
              </div>
            ))}
          </div>

          <p className="mb-2 text-xs font-bold" style={{ color: NOVA.muted }}>案件の流れ</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {PROJECT_STEPS.map(s => <StepCard key={s.n} step={s} />)}
          </div>

          <div className="mt-4 rounded-2xl p-3 text-[13px]" style={{ background: PRODUCT_ACCENT.talent.subtle, color: PRODUCT_ACCENT.talent.deep }}>
            <strong>この体験で身につくもの</strong>　チーム開発の進め方／設計の判断／レビュー対応　→　修了するとスキル・成長に記録されます
          </div>
        </MockBody>
      </MockApp>
    </div>
  );
}
