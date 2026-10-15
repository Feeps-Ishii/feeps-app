import React, { useEffect, useState } from "react";
import { Check, ChevronRight, Megaphone } from "lucide-react";
import { Btn, PRISM, PrismCard } from "../../components/common";
import { NAV, NAV_GROUP_TONE } from "./TrainingCatalog.js";
import { ackKey, ackKeys, hasStaffComment, loadAcks } from "./acks.js";
import { apiGet } from "../../api.js";
import { useChatUnread } from "./ChatNotifier.jsx";

// 受講生ホームの上（2026-10-14 ユーザー指定、10-15 モック trainee-home-nav.html の A-1 メニュー型）。
// よく開く画面へすぐ行けるボタン。グループと色はサイドバーと同じ（毎日・研修・自分用）。研修の箱だけ広く2列。
// 件数：日報＝まだ確認していないコメント、テスト＝未受験、チーム＝チャットの新着。取れないときは出さない
export function TraineeHomeNav({ go, reports = null }) {
  const groups = (NAV.trainee || []).filter(g => g.sec);
  const chat = useChatUnread(true);
  const [counts, setCounts] = useState({});
  useEffect(() => {
    let alive = true;
    Promise.all([loadAcks().catch(() => null), apiGet("/tests").catch(() => null), apiGet("/tests/me").catch(() => null)])
      .then(([acks, tests, mine]) => {
        if (!alive) return;
        const next = {};
        if (acks && Array.isArray(reports)) next.reports = reports.filter(r => hasStaffComment(r) && !acks[ackKey.reportComment(r)]).length;
        if (Array.isArray(tests) && Array.isArray(mine)) {
          const taken = new Set(mine.filter(t => t.status === "graded" || t.score != null).map(t => String(t.testId ?? t.id ?? "")));
          next.tests = tests.filter(t => (t.status || "published") === "published" && !taken.has(String(t.testId ?? t.id ?? ""))).length;
        }
        setCounts(next);
      });
    return () => { alive = false; };
  }, [reports]);
  const badge = { reports: counts.reports ? `コメント ${counts.reports}` : "", tests: counts.tests ? `未受験 ${counts.tests}` : "", teams: chat.total ? `新着 ${chat.total}` : "" };
  return (
    <div className="grid gap-3.5 md:grid-cols-[1fr_2fr_1fr]">
      {groups.map(g => {
        const tone = NAV_GROUP_TONE[g.sec] || PRISM.accent;
        const wide = g.items.length > 2;
        return (
          <PrismCard key={g.sec} className="p-0" style={{ borderRadius: 16 }}>
            <div className="flex items-center gap-2 px-[18px] pb-1.5 pt-3.5 text-[12px] font-bold" style={{ color: PRISM.sub, letterSpacing: "0.12em" }}>
              <span className="h-[2px] w-3.5 rounded" style={{ background: tone }} />{g.sec}
            </div>
            <div className={`grid gap-x-1.5 px-1.5 pb-1.5 ${wide ? "grid-cols-2" : "grid-cols-2 md:grid-cols-1"}`}>
              {g.items.map(([k, label, Icon], i) => (
                <button key={k} type="button" onClick={() => go(k)}
                  className="th-nav-row group relative flex items-center gap-3 rounded-[10px] px-3 py-[13px] text-left text-[14.5px] font-bold"
                  style={{ "--tone": tone, color: PRISM.ink }}>
                  {i >= (wide ? 2 : 1) && <span className={`absolute left-3 right-3 top-0 h-px ${wide ? "" : "hidden md:block"}`} style={{ background: PRISM.line }} />}
                  <Icon size={20} strokeWidth={1.6} className="th-nav-ic shrink-0" style={{ color: tone }} />
                  <span className="min-w-0 flex-1 whitespace-nowrap">{label}</span>
                  {badge[k] && <span className="shrink-0 rounded-full px-2 py-px text-[11px] font-bold tabular-nums" style={{ color: tone, background: `${tone}1F` }}>{badge[k]}</span>}
                  <ChevronRight size={16} className="shrink-0 transition-transform group-hover:translate-x-[3px]" style={{ color: PRISM.mut }} />
                </button>
              ))}
            </div>
          </PrismCard>
        );
      })}
      <style>{`.th-nav-row:hover{background:color-mix(in srgb,var(--tone) 7%,transparent)}.th-nav-row:focus-visible{outline:2px solid var(--tone);outline-offset:2px}`}</style>
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
