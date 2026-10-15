import React, { useEffect, useState } from "react";
import { BarChart3, CalendarClock, ChevronRight, ClipboardCheck, MessageSquareText, Send, Star, Users } from "lucide-react";
import { apiGet, apiPost } from "../../api.js";
import { Btn, PRISM, PrismCard, SkeletonRows } from "../../components/common";
import { Attendance, Curriculum, Tests } from "./TrainingComponents.jsx";

/* 企業担当者の画面（2026-10-15、モック docs/design/mockups/devhub-lms-2026-10/client-screens.html の A案）。
   ご紹介資料の「企業様ができること」を入り口にする。研修管理と助成金管理の切り替えはなくし、ここで1本にまとめた。
   - ホーム：6つの入り口（何を確認できるかの一言と件数）＋その場でお知らせを出す
   - 研修の様子：出欠・テスト・カリキュラムをタブで
   - 助成金：申請・書類・受講者情報・会社情報をタブで（助成金管理の画面をそのまま使う）
   - 評価表：提供予定 */
const GrantsParts = React.lazy(() => import("../grants/GrantsComponents.jsx").then(m => ({ default: ({ tab, role }) => {
  if (tab === "docs") return <m.GrantDocuments role={role} />;
  if (tab === "people") return <m.TraineeGrantInfo role={role} />;
  if (tab === "company") return <m.CompanyProfileView role={role} />;
  return <m.GrantsManager role={role} />;
} })));

const TONE = { blue: "#2F6FE0", teal: "#2FA9A1", violet: "#8C6BE0", orange: "#EE8A2E", gold: "#C9A227", navy: "#1F2B4D" };

function Tabs({ tabs, value, onChange, tone }) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist" style={{ borderBottom: `1px solid ${PRISM.line2}` }}>
      {tabs.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className="-mb-px px-4 py-2 text-sm font-bold"
          style={{ color: value === k ? PRISM.ink : PRISM.sub, borderBottom: `2.5px solid ${value === k ? tone : "transparent"}` }}>{label}</button>
      ))}
    </div>
  );
}

function PageHead({ title, sub }) {
  return <div className="flex flex-wrap items-end gap-3"><h2 className="text-xl font-bold" style={{ color: PRISM.ink }}>{title}</h2>{sub && <span className="text-xs" style={{ color: PRISM.sub }}>{sub}</span>}</div>;
}

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/* ---- ホーム ---- */
export function ClientHomeNav({ go }) {
  const date = todayStr();
  const [dash, setDash] = useState(null);
  useEffect(() => {
    let alive = true;
    apiGet(`/dashboard/client?date=${date}`).then(d => alive && setDash(d || null)).catch(() => alive && setDash(null));
    return () => { alive = false; };
  }, [date]);
  const today = (Array.isArray(dash?.trainees) ? dash.trainees : []).filter(t => t.dayStatus === "training_day");
  const late = today.filter(t => t.attendanceStatus === "late").length;
  const noClock = today.filter(t => t.attendanceStatus === "not_clocked_in" || t.attendanceStatus === "absent").length;
  const notSubmitted = today.filter(t => t.reportStatus === "not_submitted").length;
  // 件数は取れたものだけ出す（取れないときに0件と見せない）
  const entries = [
    { k: "state", Icon: BarChart3, tone: TONE.blue, title: "研修の様子を見る", desc: "出欠・テスト・カリキュラム", pills: [late && [`遅刻 ${late}名`, "warn"], noClock && [`まだ打刻がない ${noClock}名`, "bad"]] },
    { k: "reports", Icon: MessageSquareText, tone: TONE.teal, title: "日報にコメント", desc: "受講生の日報を読んで、励ましや気づきを書く", pills: [notSubmitted && [`今日の未提出 ${notSubmitted}名`, "warn"]] },
    { k: "trainees", Icon: Users, tone: TONE.violet, title: "一人ひとりの記録", desc: "出欠・日報・テスト・講師の指導記録", pills: [] },
    { k: "announcements", Icon: Send, tone: TONE.orange, title: "お知らせを出す", desc: "自社の受講生へ。日時を決めて予約もできる", pills: [] },
    { k: "reservations", Icon: CalendarClock, tone: TONE.orange, title: "面談・報告会を依頼", desc: "希望の日時を送るだけ", pills: [] },
    { k: "grants", Icon: ClipboardCheck, tone: TONE.gold, title: "助成金の手続き", desc: "会社情報・受講者情報の入力と書類の提出", pills: [] },
  ];
  const d = new Date(`${date}T00:00:00`);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="text-xl font-bold" style={{ color: PRISM.ink }}>今日の研修</h2>
        <span className="text-xs" style={{ color: PRISM.sub }}>{`${d.getMonth() + 1}月${d.getDate()}日（${"日月火水木金土"[d.getDay()]}）`}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {entries.map(e => (
          <button key={e.k} type="button" onClick={() => go(e.k)} className="group grid grid-cols-[auto_1fr_auto] items-start gap-x-3.5 gap-y-0.5 rounded-2xl p-4 text-left transition-colors"
            style={{ background: PRISM.surface, border: `1px solid ${PRISM.line2}` }}>
            <span className="row-span-3 grid h-11 w-11 place-items-center rounded-[13px] text-white" style={{ background: e.tone }}><e.Icon size={22} /></span>
            <b className="text-[15.5px]" style={{ color: PRISM.ink }}>{e.title}</b>
            <ChevronRight size={18} className="transition-transform group-hover:translate-x-[3px]" style={{ color: PRISM.mut }} />
            <span className="col-start-2 text-[12.5px]" style={{ color: PRISM.sub }}>{e.desc}</span>
            {e.pills.filter(Boolean).length > 0 && (
              <span className="col-start-2 mt-1.5 flex flex-wrap gap-1.5">
                {e.pills.filter(Boolean).map(([t, tone]) => <span key={t} className="rounded-full px-2.5 py-px text-[11.5px] font-bold" style={{ color: tone === "bad" ? PRISM.bad : PRISM.warn, background: tone === "bad" ? PRISM.badSubtle : PRISM.warnSubtle }}>{t}</span>)}
              </span>
            )}
          </button>
        ))}
      </div>
      <QuickNotice go={go} />
    </div>
  );
}

/* ホームからお知らせを出す（2026-10-15 ユーザー指定）。自社の受講生のホームに出る。日時を決めれば予約 */
function QuickNotice({ go }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [when, setWhen] = useState("now");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [recent, setRecent] = useState(null);
  const load = () => apiGet("/announcements").then(r => setRecent(Array.isArray(r?.items) ? r.items : [])).catch(() => setRecent(null));
  useEffect(() => { load(); }, []);
  async function send() {
    if (busy) return;
    if (!title.trim() || !body.trim()) { setMsg({ kind: "ng", text: "件名と本文を入れてください。" }); return; }
    if (when === "at" && !at) { setMsg({ kind: "ng", text: "出す日時を選んでください。" }); return; }
    setBusy(true); setMsg({ kind: "", text: "" });
    try {
      await apiPost("/announcements", { audience: "trainee", courseId: "", title: title.trim(), body: body.trim(), importance: "normal", pinned: false, publishedAt: when === "at" ? new Date(at).toISOString() : "", expiresAt: "" });
      setTitle(""); setBody(""); setAt(""); setWhen("now");
      setMsg({ kind: "ok", text: when === "at" ? "予約しました。" : "お知らせを出しました。" });
      load();
    } catch (e) {
      setMsg({ kind: "ng", text: e?.errorMessage || e?.message || "出せませんでした。" });
    } finally { setBusy(false); }
  }
  const field = { border: `1px solid ${PRISM.line2}`, background: PRISM.surface, color: PRISM.ink };
  const now = Date.now();
  const rows = (recent || []).slice().sort((a, b) => String(b.publishedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.createdAt || ""))).slice(0, 3);
  return (
    <PrismCard className="grid p-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" style={{ borderRadius: 16 }}>
      <div className="flex flex-col gap-2 p-4">
        <b className="flex items-center gap-2 text-[14.5px]" style={{ color: PRISM.ink }}><Send size={16} style={{ color: TONE.orange }} />受講生にお知らせを出す<span className="text-xs font-normal" style={{ color: PRISM.sub }}>自社の受講生のホームに出ます</span></b>
        <input id="client-notice-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="件名" aria-label="件名" className="rounded-[10px] px-3 py-2 text-sm outline-none" style={field} />
        <textarea id="client-notice-body" value={body} onChange={e => setBody(e.target.value)} placeholder="伝えたいこと" aria-label="本文" rows={3} className="resize-y rounded-[10px] px-3 py-2 text-sm outline-none" style={field} />
        <div className="flex flex-wrap items-center gap-2">
          <select id="client-notice-when" value={when} onChange={e => setWhen(e.target.value)} aria-label="いつ出すか" className="rounded-[10px] px-2.5 py-1.5 text-sm" style={field}><option value="now">すぐに出す</option><option value="at">日時を決める</option></select>
          {when === "at" && <input id="client-notice-at" type="datetime-local" value={at} onChange={e => setAt(e.target.value)} aria-label="出す日時" className="rounded-[10px] px-2.5 py-1.5 text-sm" style={field} />}
          {msg.text && <span className="text-xs font-bold" role={msg.kind === "ng" ? "alert" : "status"} style={{ color: msg.kind === "ng" ? PRISM.bad : PRISM.ok }}>{msg.text}</span>}
          <span className="ml-auto"><Btn icon={Send} onClick={send} disabled={busy}>{busy ? "出しています…" : when === "at" ? "予約する" : "出す"}</Btn></span>
        </div>
      </div>
      <div className="flex flex-col gap-1 p-4 md:border-l" style={{ borderColor: PRISM.line2 }}>
        <div className="flex items-center"><b className="text-[14px]" style={{ color: PRISM.ink }}>最近出したもの</b><button type="button" onClick={() => go("announcements")} className="ml-auto rounded-lg px-2 py-0.5 text-xs font-bold" style={{ color: PRISM.sub, border: `1px solid ${PRISM.line2}` }}>すべて</button></div>
        {recent === null ? <span className="py-2 text-xs" style={{ color: PRISM.sub }}>読み込めませんでした</span>
          : !rows.length ? <span className="py-2 text-xs" style={{ color: PRISM.sub }}>まだありません</span>
            : rows.map(a => {
              const before = a.publishedAt && Date.parse(a.publishedAt) > now;
              return (
                <div key={a.announcementId} className="grid grid-cols-[1fr_auto] gap-x-2 border-t py-2 first:border-t-0" style={{ borderColor: PRISM.line }}>
                  <b className="truncate text-[13.5px]" style={{ color: PRISM.ink }}>{a.title}</b>
                  <span className="rounded-full px-2 py-px text-[11px] font-bold" style={before ? { color: PRISM.accent, background: PRISM.accentSubtle } : { color: PRISM.ok, background: PRISM.okSubtle }}>{before ? "予約" : "公開中"}</span>
                  <span className="col-span-2 truncate text-xs" style={{ color: PRISM.sub }}>{a.body}</span>
                </div>
              );
            })}
      </div>
    </PrismCard>
  );
}

/* ---- 研修の様子：出欠・テスト・カリキュラム ---- */
export function ClientStateView({ role, go, goProduct, userProfile, done, goals }) {
  const [tab, setTab] = useState("att");
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHead title="研修の様子" />
      <Tabs tone={TONE.blue} value={tab} onChange={setTab} tabs={[["att", "出欠"], ["test", "テスト"], ["cur", "カリキュラム"]]} />
      <div key={tab} className="min-w-0">
        {tab === "att" ? <Attendance role={role} userProfile={userProfile} />
          : tab === "test" ? <Tests role={role} go={go} />
            : <Curriculum role={role} go={go} goProduct={goProduct} done={done} goals={goals} />}
      </div>
    </div>
  );
}

/* ---- 助成金：申請・書類・受講者情報・会社情報 ---- */
export function ClientGrantsView({ role }) {
  const [tab, setTab] = useState("apply");
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHead title="助成金" sub="Feepsが書類づくりをお手伝いします" />
      <Tabs tone={TONE.gold} value={tab} onChange={setTab} tabs={[["apply", "申請"], ["docs", "書類"], ["people", "受講者情報"], ["company", "会社情報"]]} />
      <React.Suspense fallback={<div className="p-4"><SkeletonRows rows={5} /></div>}>
        <GrantsParts key={tab} tab={tab} role={role} />
      </React.Suspense>
    </div>
  );
}

/* ---- 評価表（提供予定） ---- */
export function ClientEvaluationSoon() {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-3"><h2 className="text-xl font-bold" style={{ color: PRISM.ink }}>評価表</h2><span className="rounded-full px-2.5 py-px text-xs font-bold" style={{ color: PRISM.sub, background: PRISM.neutralSubtle }}>提供予定</span></div>
      <PrismCard className="grid justify-items-center gap-2 p-10 text-center" style={{ borderRadius: 16 }}>
        <span className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: "#EEF0F6", color: TONE.navy }}><Star size={26} /></span>
        <b className="text-[17px]" style={{ color: PRISM.ink }}>一人ひとりの評価を、配属先へ</b>
        <p className="m-0 text-[13px]" style={{ color: PRISM.sub }}>研修の記録と講師の指導記録から下書きをつくり、講師が確定してお渡しします。</p>
      </PrismCard>
    </div>
  );
}

