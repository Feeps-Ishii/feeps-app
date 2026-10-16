import React, { useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { apiGet, apiPut } from "../../api.js";
import { Btn, PRISM, PrismCard, Pager, SkeletonRows, usePaged } from "../../components/common";

/* 企業担当者の日報（2026-10-16、モック client-screens.html の「日報」）。
   左：その日の日報（まだ読んでいない／すべて）・未提出の人。右：開いた日報とコメント。
   開くと「読んだ」にする（PUT /reports/{traineeId}/read。読んだ人は clientReadIds）。
   取れなかったときは 0件と見せず「読み込めませんでした」 */

const TEAL = "#2FA9A1";
const FIELDS = [["morningGoal", "朝の目標"], ["learned", "今日学んだこと"], ["reflection", "振り返り"], ["blockers", "困ったこと"], ["tomorrowGoal", "明日の目標"], ["nextday", "明日に向けて"], ["question", "講師への質問"]];
const ROLE = { client: "企業担当者", admin: "管理者", instructor: "講師" };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => ymd(new Date());
// 前後の平日へ（土日は研修が無いので飛ばす）
const shift = (date, n) => { const d = new Date(`${date}T00:00:00`); do { d.setDate(d.getDate() + n); } while (d.getDay() === 0 || d.getDay() === 6); return ymd(d); };
const label = date => { const d = new Date(`${date}T00:00:00`); return `${d.getMonth() + 1}月${d.getDate()}日（${"日月火水木金土"[d.getDay()]}）`; };
const hm = s => { if (!s) return ""; const d = new Date(s); return Number.isNaN(d.getTime()) ? "" : `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
const md = s => { if (!s) return ""; const d = new Date(s); return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()} ${hm(s)}`; };

function Av({ name, size = 30 }) {
  const n = String(name || "?");
  let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360;
  return <span className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${h} 45% 52%)` }}>{n[0]}</span>;
}

export default function ClientReports({ go }) {
  const [me, setMe] = useState("");
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState("unread");
  const [st, setSt] = useState({ state: "loading", reports: [], roster: [] });
  const [cur, setCur] = useState("");
  const [fields, setFields] = useState({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });

  useEffect(() => { getCurrentUser().then(u => setMe(u?.userId || u?.username || "")).catch(() => {}); }, []);
  const load = () => {
    let alive = true;
    setSt(s => ({ ...s, state: "loading" }));
    Promise.all([apiGet(`/reports?date=${date}`), apiGet(`/dashboard/client?date=${date}`).catch(() => null)])
      .then(([r, d]) => { if (alive) setSt({ state: "ready", reports: (Array.isArray(r) ? r : []).filter(x => x.deleted !== true), roster: Array.isArray(d?.trainees) ? d.trainees : null }); })
      .catch(() => { if (alive) setSt({ state: "error", reports: [], roster: [] }); });
    return () => { alive = false; };
  };
  useEffect(load, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = useMemo(() => new Map((st.roster || []).map(t => [t.traineeId, t.name])), [st.roster]);
  const unread = r => !!me && !(r.clientReadIds || []).includes(me);
  const list = st.reports.slice()
    .sort((a, b) => (unread(b) - unread(a)) || String(a.submittedAt || a.updatedAt || "").localeCompare(String(b.submittedAt || b.updatedAt || "")))
    .filter(r => filter === "all" || unread(r));
  const unreadN = st.reports.filter(unread).length;
  const missing = (st.roster || []).filter(t => t.dayStatus === "training_day" && !st.reports.some(r => r.traineeId === t.traineeId));
  const pg = usePaged(list, 20);
  const open = st.reports.find(r => r.traineeId === cur) || null;

  // 項目の名前はコースの日報の設定から（取れなければ既定の名前）
  useEffect(() => {
    const ids = [...new Set(st.reports.map(r => r.courseId).filter(Boolean))].filter(id => !fields[id]);
    ids.forEach(id => apiGet(`/courses/${encodeURIComponent(id)}/report-settings`).then(r => setFields(f => ({ ...f, [id]: Array.isArray(r?.fields) ? r.fields : [] }))).catch(() => setFields(f => ({ ...f, [id]: [] }))));
  }, [st.reports]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pick(r) {
    setCur(r.traineeId); setText(""); setMsg({ kind: "", text: "" });
    if (!unread(r)) return;
    // 読んだ印は先に画面へ（失敗しても日報は読める。次に開いたときにまた送る）
    setSt(s => ({ ...s, reports: s.reports.map(x => (x.traineeId === r.traineeId ? { ...x, clientReadIds: [...(x.clientReadIds || []), me] } : x)) }));
    apiPut(`/reports/${encodeURIComponent(r.traineeId)}/read`, { date: r.date || date }).catch(() => {});
  }
  async function comment() {
    const t = text.trim();
    if (!open || !t || busy) return;
    setBusy(true); setMsg({ kind: "", text: "" });
    try {
      const res = await apiPut(`/reports/${encodeURIComponent(open.traineeId)}/comment`, { date: open.date || date, comment: t });
      const c = res?.comment || { text: t, authorRole: "client", createdAt: new Date().toISOString() };
      setSt(s => ({ ...s, reports: s.reports.map(x => (x.traineeId === open.traineeId ? { ...x, comments: [...(x.comments || []), c] } : x)) }));
      setText(""); setMsg({ kind: "ok", text: "コメントしました。" });
    } catch (e) {
      setMsg({ kind: "ng", text: e?.errorMessage || e?.message || "コメントできませんでした。" });
    } finally { setBusy(false); }
  }

  const rowsOf = r => {
    const custom = (fields[r.courseId] || []).filter(f => !FIELDS.some(([k]) => k === f.id)).map(f => [f.id, f.label || f.id, r.customFields?.[f.id]]);
    const extra = Object.entries(r.customFields || {}).filter(([k]) => !custom.some(([c]) => c === k)).map(([k, v]) => [k, k, v]);
    return [...FIELDS.map(([k, l]) => [k, (fields[r.courseId] || []).find(f => f.id === k)?.label || l, r[k]]), ...custom, ...extra].filter(([, , v]) => String(v || "").trim());
  };
  const seg = (k, l) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => { setFilter(k); pg.setPage(0); }} className="rounded-full px-3 py-1 text-xs font-bold" style={filter === k ? { background: PRISM.surface, color: PRISM.ink, boxShadow: "0 1px 4px rgba(0,0,0,.12)" } : { color: PRISM.sub }}>{l}</button>;
  const isToday = date === today();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold" style={{ color: PRISM.ink }}>日報</h2>
        <span className="flex items-center gap-1">
          <button type="button" onClick={() => { setDate(shift(date, -1)); setCur(""); }} className="grid h-8 w-8 place-items-center rounded-lg" style={{ border: `1px solid ${PRISM.line2}`, background: PRISM.surface }} aria-label="前の日"><ChevronLeft size={16} /></button>
          <b className="min-w-[8.5em] text-center text-sm" style={{ color: PRISM.ink }}>{label(date)}</b>
          <button type="button" disabled={isToday} onClick={() => { setDate(shift(date, 1)); setCur(""); }} className="grid h-8 w-8 place-items-center rounded-lg disabled:opacity-35" style={{ border: `1px solid ${PRISM.line2}`, background: PRISM.surface }} aria-label="次の日"><ChevronRight size={16} /></button>
          {!isToday && <button type="button" onClick={() => { setDate(today()); setCur(""); }} className="ml-1 rounded-lg px-2.5 py-1 text-xs font-bold" style={{ border: `1px solid ${PRISM.line2}`, color: PRISM.sub }}>今日へ</button>}
        </span>
        <span className="ml-auto inline-flex rounded-full p-1" style={{ background: PRISM.neutralSubtle }}>{seg("unread", `まだ読んでいない${unreadN ? ` ${unreadN}` : ""}`)}{seg("all", "すべて")}</span>
      </div>

      {st.state === "error" ? (
        <PrismCard className="flex items-center gap-3 p-5" style={{ borderRadius: 16 }}><span className="text-sm" style={{ color: PRISM.bad }}>日報を読み込めませんでした。</span><Btn kind="ghost" size="sm" onClick={load}>もう一度</Btn></PrismCard>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <PrismCard className="overflow-hidden p-0" style={{ borderRadius: 16 }}>
            {st.roster && missing.length > 0 && <div className="px-4 py-2.5 text-xs font-bold" style={{ background: PRISM.warnSubtle, color: "#8A5A10" }}>未提出 {missing.length}名：{missing.map(t => t.name).join("・")}</div>}
            {st.state === "loading" ? <div className="p-4"><SkeletonRows rows={5} /></div>
              : !list.length ? <p className="m-0 p-5 text-sm" style={{ color: PRISM.sub }}>{filter === "unread" && st.reports.length ? "まだ読んでいない日報はありません" : "この日の日報はまだありません"}</p>
                : pg.rows.map(r => {
                  const u = unread(r);
                  const nm = nameOf.get(r.traineeId) || r.traineeName || r.name || "受講生";
                  return (
                    <button key={r.traineeId} type="button" onClick={() => pick(r)} aria-current={cur === r.traineeId ? "true" : undefined}
                      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 text-left"
                      style={{ borderTop: `1px solid ${PRISM.line}`, background: cur === r.traineeId ? "#E9F6F5" : "transparent", boxShadow: cur === r.traineeId ? `inset 3px 0 0 ${TEAL}` : "none" }}>
                      <span className="row-span-2"><Av name={nm} /></span>
                      <b className="flex items-center gap-1.5 text-sm" style={{ color: PRISM.ink, fontWeight: u ? 800 : 600 }}>{u && <i className="h-2 w-2 rounded-full" style={{ background: TEAL }} aria-label="まだ読んでいない" />}{nm}</b>
                      <small className="text-[11.5px] tabular-nums" style={{ color: PRISM.mut }}>{hm(r.submittedAt || r.updatedAt)}</small>
                      <span className="col-span-2 truncate text-xs" style={{ color: PRISM.sub }}>{r.learned || r.reflection || r.blockers || ""}</span>
                    </button>
                  );
                })}
            <Pager {...pg} />
          </PrismCard>

          <PrismCard className="grid gap-4 p-5" style={{ borderRadius: 16 }}>
            {!open ? <p className="m-0 py-8 text-center text-sm" style={{ color: PRISM.sub }}>{list.length ? "左の一覧から日報を選んでください" : "—"}</p> : (() => {
              const nm = nameOf.get(open.traineeId) || open.traineeName || "受講生";
              const comments = [...(open.comment ? [{ text: open.comment, authorRole: "instructor", createdAt: open.commentedAt }] : []), ...(open.comments || [])];
              return (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <Av name={nm} size={40} />
                    <span><b className="block text-base" style={{ color: PRISM.ink }}>{nm}</b><small className="text-xs" style={{ color: PRISM.sub }}>{label(open.date || date)}{hm(open.submittedAt || open.updatedAt) ? ` ・ ${hm(open.submittedAt || open.updatedAt)} 提出` : ""}</small></span>
                    {go && <button type="button" onClick={() => go("trainees")} className="ml-auto rounded-lg px-3 py-1.5 text-xs font-bold" style={{ border: `1px solid ${PRISM.line2}`, color: PRISM.sub }}>受講生の記録へ</button>}
                  </div>
                  <dl className="m-0 grid gap-3">
                    {rowsOf(open).map(([k, l, v]) => <div key={k}><dt className="text-xs font-bold" style={{ color: PRISM.mut }}>{l}</dt><dd className="m-0 whitespace-pre-wrap text-sm" style={{ color: PRISM.ink }}>{String(v)}</dd></div>)}
                    {Array.isArray(open.goalItems) && open.goalItems.length > 0 && <div><dt className="text-xs font-bold" style={{ color: PRISM.mut }}>今日の目標</dt><dd className="m-0 text-sm" style={{ color: PRISM.ink }}>{open.goalItems.map((g, i) => <span key={i} className="mr-3 inline-block">{g?.done ? "✓ " : "・"}{g?.text || g?.title || ""}</span>)}</dd></div>}
                  </dl>
                  {comments.length > 0 && (
                    <div className="grid gap-2">
                      {comments.map((c, i) => (
                        <div key={c.commentId || i} className="rounded-xl px-3.5 py-2.5" style={{ background: c.authorRole === "client" ? "#FFF6E6" : PRISM.accentSubtle }}>
                          <b className="text-xs" style={{ color: PRISM.ink }}>{c.authorName || ROLE[c.authorRole] || "講師"}<small className="ml-2 font-normal" style={{ color: PRISM.mut }}>{ROLE[c.authorRole] || ""} {md(c.createdAt)}</small></b>
                          <p className="m-0 whitespace-pre-wrap text-sm" style={{ color: PRISM.ink }}>{c.text || c.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid gap-2">
                    <textarea id="client-report-comment" value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="励ましや気づきを書く" aria-label="コメント" className="resize-y rounded-[10px] px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${PRISM.line2}`, background: PRISM.surface, color: PRISM.ink }} />
                    <div className="flex flex-wrap items-center gap-2">
                      <small className="text-xs" style={{ color: PRISM.sub }}>受講生と講師に見えます</small>
                      {msg.text && <span className="text-xs font-bold" role={msg.kind === "ng" ? "alert" : "status"} style={{ color: msg.kind === "ng" ? PRISM.bad : PRISM.ok }}>{msg.text}</span>}
                      <span className="ml-auto"><Btn icon={Send} onClick={comment} disabled={busy || !text.trim()}>{busy ? "送っています…" : "コメントする"}</Btn></span>
                    </div>
                  </div>
                </>
              );
            })()}
          </PrismCard>
        </div>
      )}
    </div>
  );
}
