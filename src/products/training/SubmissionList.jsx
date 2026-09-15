import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Btn, Card, EmptyState, T } from "../../components/common";

/* 日報・勤怠の「これまでの記録」（2026-09-15 承認モック: trainee-reports）。
   ホームの提出カレンダーと同じ月カレンダーを各画面にも置いていたため、同じものが
   3画面にあった。カレンダーはホームだけに置き、ここは**1日ずつの中身を見て直す場所**にする。
   カレンダーのバッジでは分からない「何時に打刻したか・遅刻の理由・どの単元の日か・
   講師コメントが付いたか」を行に出すので、ホームとは役割が被らない。

   表示の決めごと:
   - **1か月ずつ出す。** 継ぎ足していくと下へ伸び続けて目的の日を探しにくい。
   - **1行の中で字の大きさは2段まで**（日付・状態＝13px／補足＝11.5px）。
     薄い灰色は単元名などの補足だけに使い、読ませたい文字は本文の色のまま出す。 */

const PILL = {
  ok: { background: T.successSubtle, color: "#2F6E4E" },
  ng: { background: T.dangerSubtle, color: "#9E3F38" },
  warn: { background: T.warningSubtle, color: T.warning },
  info: { background: T.accentSubtle, color: T.accentHover },
  mut: { background: T.bgBase, color: T.textSecondary, border: `1px solid ${T.border}` },
};

function shiftMonth(month, delta) {
  const [y, m] = String(month).split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month) {
  const [y, m] = String(month).split("-").map(Number);
  return y && m ? `${y}年${m}月` : String(month || "");
}

export function SubmissionPill({ tone = "mut", children }) {
  return (
    <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"
      style={PILL[tone] || PILL.mut}>{children}</span>
  );
}

export default function SubmissionList({
  title, desc, month, onMonth, summary, notice, rows = [], empty, loading = false, action,
}) {
  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
        <h3 className="text-sm font-bold" style={{ color: T.textPrimary }}>{title}</h3>
        {desc && <p className="text-[11.5px]" style={{ color: T.textSecondary }}>{desc}</p>}
      </div>

      {/* 月ごとのページング。月を選ぶ操作はこのページャが兼ねる */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2" style={{ background: T.bgBase, borderBottom: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-1">
          <Btn kind="ghost" size="sm" aria-label="前の月" onClick={() => onMonth(shiftMonth(month, -1))}><ChevronLeft size={14} /></Btn>
          <span className="px-1 text-[12.5px] font-bold tabular-nums" style={{ color: T.textPrimary }}>{monthLabel(month)}</span>
          <Btn kind="ghost" size="sm" aria-label="次の月" onClick={() => onMonth(shiftMonth(month, 1))}><ChevronRight size={14} /></Btn>
        </div>
        {action}
        {summary && <span className="ml-auto text-[11.5px] font-bold" style={{ color: T.textSecondary }}>{summary}</span>}
      </div>

      {notice && (
        <div className="px-4 py-2 text-[11.5px] font-semibold" style={{ background: T.warningSubtle, color: T.warning }}>{notice}</div>
      )}

      {loading ? (
        <div className="px-4 py-6 text-center text-[12.5px]" style={{ color: T.textMuted }}>読み込んでいます…</div>
      ) : !rows.length ? (
        <EmptyState title={empty || "この月に記録はありません"} desc="月を切り替えて確認できます。" />
      ) : rows.map((row, index) => (
        <div key={row.key || row.date}
          className="flex flex-wrap items-center gap-3 px-4 py-3"
          style={{ borderBottom: index < rows.length - 1 ? `1px solid ${T.border}` : "none", background: row.miss ? T.dangerSubtle : "transparent" }}>
          <div className="w-[112px] shrink-0">
            <div className="text-[13px] font-bold tabular-nums" style={{ color: T.textPrimary }}>{row.date}</div>
            {row.unit && <div className="text-[11.5px] font-semibold" style={{ color: T.textSecondary }}>{row.unit}</div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold" style={{ color: T.textPrimary }}>{row.main}</div>
            {row.sub && <div className="text-[11.5px]" style={{ color: T.textSecondary }}>{row.sub}</div>}
          </div>
          {row.pill && <SubmissionPill tone={row.pill.tone}>{row.pill.label}</SubmissionPill>}
          {row.action && (
            <div className="ml-auto shrink-0">
              <Btn size="sm" kind={row.action.kind || "ghost"} disabled={row.action.disabled} onClick={row.action.onClick}>{row.action.label}</Btn>
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
