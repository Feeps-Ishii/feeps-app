import React, { useEffect, useState } from "react";
import { Check, ChevronRight, Megaphone } from "lucide-react";
import { Btn, PRISM, PrismCard } from "../../components/common";
import { NAV, NAV_GROUP_TONE } from "./TrainingCatalog.js";
import { ackKey, ackKeys, loadAcks } from "./acks.js";

// 受講生ホームの上（2026-10-14 ユーザー指定）。状況の表示ではなく、よく開く画面へすぐ行けるボタン。
// グループと色はサイドバーと同じ（毎日・研修・自分用）
export function TraineeHomeNav({ go }) {
  const groups = (NAV.trainee || []).filter(g => g.sec);
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {groups.map(g => {
        const tone = NAV_GROUP_TONE[g.sec] || PRISM.accent;
        return (
          <PrismCard key={g.sec} className="overflow-hidden p-0" style={{ borderTop: `4px solid ${tone}` }}>
            <div className="flex items-center gap-2 px-4 pb-1 pt-3 text-[12px] font-extrabold" style={{ color: tone, letterSpacing: "0.06em" }}>
              <span className="h-2 w-2 rounded-[3px]" style={{ background: tone }} />{g.sec}
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 pt-1.5">
              {g.items.map(([k, label, Icon]) => (
                <button key={k} type="button" onClick={() => go(k)}
                  className="group flex min-h-[56px] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:-translate-y-px"
                  style={{ background: `${tone}12`, border: `1px solid ${tone}33`, color: PRISM.ink }}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: tone }}><Icon size={17} /></span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{label}</span>
                  <ChevronRight size={15} className="shrink-0 opacity-40 transition group-hover:opacity-80" />
                </button>
              ))}
            </div>
          </PrismCard>
        );
      })}
    </div>
  );
}

// 講師からの当日連絡。確認ボタンを押すまで通知に残る
export function DailyNoteCard({ courseId, date, text, courseName }) {
  const key = ackKey.dailyNote(courseId, date);
  const [acked, setAcked] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    loadAcks().then(a => alive && setAcked(!!a[key])).catch(() => alive && setAcked(null));
    return () => { alive = false; };
  }, [key]);
  async function confirm() {
    setErr(false);
    try { await ackKeys(key); setAcked(true); } catch (e) { setErr(true); }
  }
  return (
    <PrismCard className="flex flex-wrap items-start gap-3 p-4" style={acked ? undefined : { background: PRISM.warnSubtle, borderColor: PRISM.warnLine }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: PRISM.surface, color: PRISM.warn }}><Megaphone size={16} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold" style={{ color: PRISM.warn }}>本日の連絡{courseName ? `・${courseName}` : ""}</div>
        <div className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed" style={{ color: PRISM.ink }}>{text}</div>
        {err && <div className="mt-1 text-xs font-bold" style={{ color: PRISM.danger || PRISM.warn }}>記録できませんでした</div>}
      </div>
      {acked === true && <span className="inline-flex items-center gap-1 self-center text-xs font-bold" style={{ color: PRISM.mut }}><Check size={13} />確認済み</span>}
      {acked === false && <Btn size="sm" icon={Check} onClick={confirm}>確認しました</Btn>}
    </PrismCard>
  );
}
