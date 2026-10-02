import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet, apiPost, apiPut } from "../../api.js";
import { T, Card, Btn, Badge, EmptyState, SectionHead, SkeletonRows, PrismErrorRetryCard } from "../../components/common";
import { getActiveCourseId, setActiveCourseId } from "../../utils/common/courseContext.js";
import { Check, FileDown, Move, Pin, Plus, RotateCcw, Sparkles, Send, Wifi, X, Users, LayoutGrid, Save } from "lucide-react";

/* 席替え（2026-10-02 ユーザー決定。CHANGELOG 189。モック docs/design/mockups/lms-2026-09/seats-room.html）
   - 白紙の教室から、広さ（右下の角）・机・設備を置く（コースごとに保存）
   - 「AIで配置」：実装力・コミュ力・性別・受講形態・前回の机・固定席から、机ごとのバランスを取って席に入れる（画面で計算）
   - 名前のドラッグで入れ替え／「まだ席がない人」へ外す。机を押すと理由、名前を押すと評価
   - 「AIに頼む」：入れ替え案だけを返し、確かめてから反映
   - 「PDFで出力」：座席表（A4横）。回（第1回…）ごとに下書き → 確定。前回の机はひとつ前の確定した回 */
const SEAT_W = 92, SEAT_H = 40;
const DESK_KINDS = [
  { label: "縦の机（左右3席）", w: 66, h: 120, L: 3, R: 3, T: 0, B: 0 },
  { label: "縦の机（左右2席）", w: 66, h: 80, L: 2, R: 2, T: 0, B: 0 },
  { label: "横の机（上下3席）", w: 288, h: 56, L: 0, R: 0, T: 3, B: 3 },
  { label: "1人の机", w: 66, h: 44, L: 0, R: 1, T: 0, B: 0 },
];
const FX_KINDS = [["入口", 70, 56], ["窓", 400, 18], ["スクリーン", 190, 18], ["TVモニター", 140, 18], ["柱", 40, 40], ["棚", 300, 18], ["ロッカー", 60, 120], ["講師卓", 120, 50], ["自由", 120, 24]];
const GENDER_LABEL = { male: "男性", female: "女性", other: "その他", none: "答えない", "": "未設定" };
const errText = (e, f) => e?.errorMessage || e?.message || f;
const snap = v => Math.round(v / 10) * 10;
const seq = (() => { let n = 0; return () => `fx${Date.now().toString(36)}${(n++).toString(36)}`; })();

function seatsOf(d) {
  const out = [], v = d.h / Math.max(d.L, d.R, 1), hz = d.w / Math.max(d.T, d.B, 1);
  for (let i = 0; i < d.T; i++) out.push({ id: `${d.id}-T${i}`, x: d.x + hz * i + (hz - SEAT_W) / 2, y: d.y - 44 });
  for (let i = 0; i < d.B; i++) out.push({ id: `${d.id}-B${i}`, x: d.x + hz * i + (hz - SEAT_W) / 2, y: d.y + d.h + 4 });
  for (let i = 0; i < d.L; i++) out.push({ id: `${d.id}-L${i}`, x: d.x - 94, y: d.y + v * i + (v - SEAT_H) / 2 });
  for (let i = 0; i < d.R; i++) out.push({ id: `${d.id}-R${i}`, x: d.x + d.w + 2, y: d.y + v * i + (v - SEAT_H) / 2 });
  return out;
}
const deskOfSeat = sid => String(sid).split("-")[0];
function fitDesk(d) {
  if (d.T || d.B) d.w = Math.max(66, Math.max(d.T, d.B) * 96);
  if (d.L || d.R) d.h = Math.max(44, Math.max(d.L, d.R) * 40);
}
function nextDeskId(desks) { const used = new Set(desks.map(d => d.id)); for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!used.has(c)) return c; return `Z${desks.length}`; }
function allSeatIds(desks) { return desks.flatMap(d => seatsOf(d).map(s => s.id).filter(id => id !== d.teacher)); }

/* AIで配置（画面で計算）：実装の合計が小さい机・コミュが平均に近い机・同じ性別が少ない机へ、前回の机は避けて入れる */
function autoAssign(desks, people, pins, prev, seed) {
  const seatSet = new Set(allSeatIds(desks));
  const a = {};
  Object.entries(pins).forEach(([pid, sid]) => { if (seatSet.has(sid)) a[sid] = pid; });
  const byId = new Map(people.map(p => [p.id, p]));
  const free = {}, mem = {};
  desks.forEach(d => {
    free[d.id] = seatsOf(d).map(s => s.id).filter(sid => sid !== d.teacher && !a[sid]);
    mem[d.id] = Object.keys(a).filter(sid => deskOfSeat(sid) === d.id).map(sid => byId.get(a[sid])).filter(Boolean);
  });
  const list = people.filter(p => p.mode !== "online" && !pins[p.id])
    .sort((x, y) => (y.impl * 2 + y.comm) - (x.impl * 2 + x.comm) || ((x.id.charCodeAt(x.id.length - 1) + seed) % 5) - ((y.id.charCodeAt(y.id.length - 1) + seed) % 5));
  list.forEach((p, i) => {
    let best = null, bs = -Infinity;
    desks.forEach((d, j) => {
      if (!free[d.id].length) return;
      const m = mem[d.id];
      let sc = -m.reduce((s, q) => s + q.impl, 0) - Math.abs(m.reduce((s, q) => s + q.comm, 0) - m.length * 3.2) * 0.6;
      if (p.gender === "male" || p.gender === "female") sc -= m.filter(q => q.gender === p.gender).length * 1.4;
      if (prev[p.id] === d.id) sc -= 9;
      sc -= m.length * 0.5 + ((i + j + seed) % desks.length) * 0.03;
      if (sc > bs) { bs = sc; best = d.id; }
    });
    if (best) { a[free[best].shift()] = p.id; mem[best].push(p); }
  });
  return a;
}
function deskStats(d, assign, byId, prev) {
  const m = seatsOf(d).map(s => assign[s.id]).filter(Boolean).map(id => byId.get(id)).filter(Boolean);
  const avg = k => (m.length ? m.reduce((s, q) => s + q[k], 0) / m.length : 0);
  return { m, impl: avg("impl"), comm: avg("comm"), f: m.filter(q => q.gender === "female").length, ma: m.filter(q => q.gender === "male").length, again: m.filter(q => prev[q.id] === d.id) };
}
function reasonsOf(st) {
  const m = st.m;
  if (!m.length) return ["まだ誰も座っていません"];
  const sur = q => q.name.split(/[\s　]/)[0];
  const hi = [...m].sort((a, b) => b.impl - a.impl)[0], lo = [...m].sort((a, b) => a.impl - b.impl)[0], talk = [...m].sort((a, b) => b.comm - a.comm)[0];
  const r = [];
  if (hi.impl - lo.impl >= 2) r.push(`実装が得意な${sur(hi)}さん（実装 ${hi.impl}）と、まだ慣れていない${sur(lo)}さん（実装 ${lo.impl}）を同じ机に。教え合える組み合わせです`);
  else r.push(`実装力が近い人どうし（平均 ${st.impl.toFixed(1)}）。進み方がそろいやすい組み合わせです`);
  if (talk.comm >= 4) r.push(`${sur(talk)}さん（コミュ ${talk.comm}）が話を回せるように入れています`);
  r.push(`女性 ${st.f}人・男性 ${st.ma}人${Math.abs(st.f - st.ma) <= 1 ? "でバランスが取れています" : "。人数の関係で少し偏っています"}`);
  r.push(st.again.length ? `前回もこの机だった人：${st.again.map(q => q.name).join("・")}（入れ替え候補）` : "前回この机だった人はいません");
  return r;
}
function Level({ n, color }) {
  return <span className="inline-flex gap-0.5">{[1, 2, 3, 4, 5].map(i => <i key={i} className="block h-2 w-3.5 rounded-sm" style={{ background: i <= n ? color : T.bgBase }} />)}</span>;
}

export default function SeatingView({ role }) {
  const [courses, setCourses] = useState(null);
  const [courseId, setCourseId] = useState("");
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState("seats");
  const load = useCallback(async id => {
    if (!id) return;
    setLoadErr(""); setData(null);
    try { setData(await apiGet(`/seating?courseId=${encodeURIComponent(id)}`)); }
    catch (e) { setLoadErr(errText(e, "席替えを読み込めませんでした。")); }
  }, []);
  useEffect(() => {
    apiGet("/seating/courses").then(d => {
      const list = Array.isArray(d?.courses) ? d.courses : [];
      setCourses(list);
      const pref = getActiveCourseId();
      setCourseId(list.some(c => c.courseId === pref) ? pref : (list[0]?.courseId || ""));
    }).catch(e => { setCourses([]); setLoadErr(errText(e, "コースを読み込めませんでした。")); });
  }, []);
  useEffect(() => { load(courseId); }, [courseId, load]);

  if (role !== "admin" && role !== "instructor") return null;
  if (courses == null) return <div><SectionHead title="席替え" /><Card className="p-5"><SkeletonRows rows={5} /></Card></div>;
  if (!courses.length) return <div><SectionHead title="席替え" /><Card><EmptyState title={role === "admin" ? "コースがありません" : "担当しているコースがありません"} desc="" /></Card></div>;
  return (
    <div>
      <SectionHead title="席替え" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-sm font-bold" style={{ border: `1px solid ${T.border}` }}>
          <span className="text-xs" style={{ color: T.textMuted }}>コース</span>
          <select value={courseId} onChange={e => { setCourseId(e.target.value); setActiveCourseId(e.target.value); }} className="bg-transparent outline-none">{courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}</select>
        </label>
        <div className="inline-flex gap-0.5 rounded-xl bg-white p-1" style={{ border: `1px solid ${T.border}` }} role="tablist">
          {[["seats", "席替え"], ["people", "受講生の情報"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="rounded-lg px-3 py-1 text-xs font-bold" style={tab === k ? { background: T.textPrimary, color: "#fff" } : { color: T.textSecondary }}>{l}</button>)}
        </div>
      </div>
      {loadErr && <PrismErrorRetryCard message={loadErr} onRetry={() => load(courseId)} />}
      {!data && !loadErr && <Card className="p-5"><SkeletonRows rows={6} /></Card>}
      {/* 受講生の情報へ切り替えても保存前の席が消えないよう、席替えは隠すだけにする */}
      {data && <div hidden={tab !== "seats"}><SeatingBoard key={courseId} data={data} courseId={courseId} onReload={() => load(courseId)} setData={setData} /></div>}
      {data && tab === "people" && <PeopleTable data={data} courseId={courseId} setData={setData} />}
    </div>
  );
}

/* ---------- 受講生の情報（性別・受講形態・ふりがなは任意。実装力・コミュ力は AI が読み、講師が直せる） ---------- */
function PeopleTable({ data, courseId, setData }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function save(id, patch) {
    setMsg("");
    try {
      const p = await apiPut(`/seating/people/${encodeURIComponent(id)}`, { courseId, ...patch });
      if (p) setData(d => ({ ...d, people: d.people.map(x => (x.id === id ? p : x)) }));
    } catch (e) { setMsg(errText(e, "保存できませんでした。")); }
  }
  async function score() {
    if (busy) return;
    setBusy(true); setMsg("");
    try { const r = await apiPost("/seating/score", { courseId }); setData(d => ({ ...d, people: r.people })); setMsg(`${r.scored}人ぶんをカルテ・テスト・日報から読み取りました。`); }
    catch (e) { setMsg(errText(e, "読み取れませんでした。")); }
    finally { setBusy(false); }
  }
  const sel = (value, onChange, opts, label) => <select value={value} onChange={e => onChange(e.target.value)} aria-label={label} className="rounded-lg bg-white px-2 py-1 text-xs outline-none" style={{ border: `1px solid ${T.border}` }}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
  const scoreSel = (p, k) => sel(p[k === "impl" ? "manualImpl" : "manualComm"] == null ? "" : String(p[k === "impl" ? "manualImpl" : "manualComm"]), v => save(p.id, { [k]: v === "" ? null : Number(v) }), [["", `AI（${p[k === "impl" ? "aiImpl" : "aiComm"] ?? "－"}）`], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]], k === "impl" ? "実装力" : "コミュニケーション力");
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
        <b className="text-sm" style={{ color: T.textPrimary }}>受講生の情報</b>
        <Badge tone="cyan">性別・受講形態・ふりがなは任意</Badge>
        <span className="ml-auto"><Btn size="sm" icon={Sparkles} disabled={busy} onClick={score}>{busy ? "読み取り中…" : "AIでカルテから読み直す"}</Btn></span>
      </div>
      {msg && <div className="px-4 py-2 text-xs font-semibold" style={{ color: T.accentHover, background: T.accentSubtle }}>{msg}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead><tr>{["受講生", "ふりがな", "性別", "受講形態", "実装力", "コミュニケーション力", "AIの見立て"].map(h => <th key={h} className="px-3 py-2 text-left text-[11px] font-bold" style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead>
          <tbody>{data.people.map(p => (
            <tr key={p.id} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td className="px-3 py-2 font-bold" style={{ color: T.textPrimary }}>{p.name}</td>
              <td className="px-3 py-2"><input defaultValue={p.kana} onBlur={e => e.target.value !== p.kana && save(p.id, { kana: e.target.value })} placeholder="ヤマダタロウ" aria-label={`${p.name}のふりがな`} className="w-32 rounded-lg px-2 py-1 text-xs outline-none" style={{ border: `1px solid ${T.border}` }} /></td>
              <td className="px-3 py-2">{sel(p.gender, v => save(p.id, { gender: v }), Object.entries(GENDER_LABEL).map(([k, l]) => [k, l]), "性別")}</td>
              <td className="px-3 py-2">{sel(p.mode, v => save(p.id, { mode: v }), [["", "教室"], ["online", "オンラインのみ"]], "受講形態")}</td>
              <td className="px-3 py-2"><span className="flex items-center gap-2"><Level n={p.impl} color={T.accent} />{scoreSel(p, "impl")}</span></td>
              <td className="px-3 py-2"><span className="flex items-center gap-2"><Level n={p.comm} color={T.success} />{scoreSel(p, "comm")}</span></td>
              <td className="max-w-[320px] px-3 py-2 text-xs" style={{ color: T.textSecondary }}>{p.reason || <span style={{ color: T.textMuted }}>まだ読み取っていません</span>}{p.sources && <div className="mt-0.5 text-[11px]" style={{ color: T.textMuted }}>テスト {p.sources.tests}件{p.sources.testAverage != null ? `（平均 ${p.sources.testAverage}点）` : ""} ・ 日報 {p.sources.reports}件 ・ 講師メモ {p.sources.notes}件</div>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- 席替えの盤面 ---------- */
function SeatingBoard({ data, courseId, onReload, setData }) {
  const people = data.people;
  const byId = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
  const [layout, setLayout] = useState(() => data.layout || { room: { w: 1100, h: 480 }, desks: [], fx: [] });
  const rounds = data.rounds;
  const [roundId, setRoundId] = useState(() => rounds[rounds.length - 1]?.roundId || "");
  const round = rounds.find(r => r.roundId === roundId) || null;
  const [assign, setAssign] = useState(() => round?.assign || {});
  const [pins, setPins] = useState(() => round?.pins || {});
  const [edit, setEdit] = useState(() => !data.layout || !data.layout.desks?.length);
  const [sel, setSel] = useState(null);
  const [history, setHistory] = useState([]);
  const [dirty, setDirty] = useState({ layout: false, round: false });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [howto, setHowto] = useState(true);
  const [chat, setChat] = useState([]);
  const [pending, setPending] = useState(null);
  const [plan, setPlan] = useState(0);
  const wrapRef = useRef(null);
  const roomRef = useRef(null);
  const dragRef = useRef(null);
  const dragSeatRef = useRef(null);
  const [scale, setScale] = useState(1);
  const keepLocalRef = useRef(false);
  const ptRef = useRef(null);         // 最後に押した場所（説明のカードをその横に出す）   // 保存で回を作ったときは、画面の席をそのまま残す

  // 前回の机：この回より前の、確定した回のうち最後のもの
  const prev = useMemo(() => {
    const cur = round?.createdAt || "￿";
    const done = rounds.filter(r => r.status === "confirmed" && r.roundId !== roundId && r.createdAt < cur);
    const last = done[done.length - 1];
    const out = {};
    if (last) Object.entries(last.assign || {}).forEach(([sid, pid]) => { out[pid] = deskOfSeat(sid); });
    return out;
  }, [rounds, roundId, round?.createdAt]);
  useEffect(() => { if (keepLocalRef.current) { keepLocalRef.current = false; return; } setAssign(round?.assign || {}); setPins(round?.pins || {}); setChat([]); setPending(null); setHistory([]); setDirty(d => ({ ...d, round: false })); }, [roundId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fit = useCallback(() => {
    const w = wrapRef.current?.clientWidth || 1000;
    setScale(Math.min(1, (w - 24) / (layout.room.w + 6)));
  }, [layout.room.w]);
  useLayoutEffect(() => { fit(); }, [fit]);
  useEffect(() => { const ro = new ResizeObserver(fit); if (wrapRef.current) ro.observe(wrapRef.current); return () => ro.disconnect(); }, [fit]);

  const snapshot = () => setHistory(h => [...h.slice(-39), JSON.stringify({ layout, assign, pins })]);
  function undo() { setHistory(h => { const last = h[h.length - 1]; if (!last) return h; const o = JSON.parse(last); setLayout(o.layout); setAssign(o.assign); setPins(o.pins); setDirty({ layout: true, round: true }); return h.slice(0, -1); }); }
  const changeLayout = fn => { snapshot(); setLayout(l => { const n = JSON.parse(JSON.stringify(l)); fn(n); return n; }); setDirty(d => ({ ...d, layout: true })); };
  const changeAssign = (fn, pinFn) => { snapshot(); setAssign(a => fn({ ...a })); if (pinFn) setPins(p => pinFn({ ...p })); setDirty(d => ({ ...d, round: true })); };
  const cleanAssignTo = desks => { const ok = new Set(allSeatIds(desks)); setAssign(a => Object.fromEntries(Object.entries(a).filter(([k]) => ok.has(k)))); };

  const online = people.filter(p => p.mode === "online");
  const seated = new Set(Object.values(assign));
  const loose = people.filter(p => p.mode !== "online" && !seated.has(p.id));
  const seatCount = allSeatIds(layout.desks).length;
  const totAgain = layout.desks.reduce((s, d) => s + deskStats(d, assign, byId, prev).again.length, 0);

  /* ---- 保存 ---- */
  async function saveLayout() {
    setBusy("layout"); setMsg("");
    try { const l = await apiPut("/seating/layout", { courseId, ...layout }); setLayout(l); setData(d => ({ ...d, layout: l })); setDirty(d => ({ ...d, layout: false })); return true; }
    catch (e) { setMsg(errText(e, "教室の配置を保存できませんでした。")); return false; }
    finally { setBusy(""); }
  }
  async function ensureRound() {
    if (round) return round;
    const r = await apiPost("/seating/rounds", { courseId });
    setData(d => ({ ...d, rounds: [...d.rounds, r] }));
    keepLocalRef.current = true;
    setRoundId(r.roundId);
    return r;
  }
  async function saveRound(status) {
    setBusy(status || "round"); setMsg("");
    try {
      if (dirty.layout && !(await saveLayout())) return;
      const r = await ensureRound();
      const saved = await apiPut(`/seating/rounds/${encodeURIComponent(r.roundId)}`, { courseId, assign, pins, ...(status ? { status } : {}) });
      setData(d => ({ ...d, rounds: d.rounds.some(x => x.roundId === saved.roundId) ? d.rounds.map(x => (x.roundId === saved.roundId ? saved : x)) : [...d.rounds, saved] }));
      setDirty({ layout: false, round: false });
      setMsg(status === "confirmed" ? `${saved.title}を確定しました。` : "保存しました。");
    } catch (e) { setMsg(errText(e, "保存できませんでした。")); }
    finally { setBusy(""); }
  }
  async function newRound() {
    if ((dirty.round || dirty.layout) && !window.confirm("保存していない変更があります。新しい回を作りますか？（今の変更は消えます）")) return;
    setBusy("new");
    try {
      if (dirty.layout) await saveLayout();
      const r = await apiPost("/seating/rounds", { courseId, startDate: "" });
      setData(d => ({ ...d, rounds: [...d.rounds, r] }));
      setRoundId(r.roundId);
    } catch (e) { setMsg(errText(e, "新しい回を作れませんでした。")); }
    finally { setBusy(""); }
  }
  function runAuto() {
    snapshot();
    const next = plan + 1; setPlan(next);
    setAssign(autoAssign(layout.desks, people, pins, prev, next));
    setDirty(d => ({ ...d, round: true })); setEdit(false); setSel(null);
  }
  function printPdf() {
    const el = document.getElementById("seating-print");
    if (!el) return;
    window.print();
  }

  /* ---- AIに頼む ---- */
  async function ask(textIn) {
    const t = String(textIn || "").trim(); if (!t || busy) return;
    setChat(c => [...c.map(m => (m.state === "open" ? { ...m, state: "rejected" } : m)), { who: "me", text: t }]);
    setPending(null); setBusy("ask");
    try {
      const r = await apiPost("/seating/ask", { courseId, text: t, assign, pins, prevDesks: prev });
      const moves = (r.moves || []).map(m => {
        const a = byId.get(assign[m.from]), b = byId.get(assign[m.to]);
        const desk = s => `机${s.replace(/-[LRTB]\d+$/, "")}`;
        return { ...m, label: `${a?.name || "空席"}（${desk(m.from)}）⇄ ${b?.name || "空席"}（${desk(m.to)}）` };
      });
      const msgItem = { who: "ai", text: r.reply, moves, state: moves.length ? "open" : "" };
      setChat(c => [...c, msgItem]);
      setPending(moves.length ? msgItem : null);
    } catch (e) { setChat(c => [...c, { who: "ai", text: errText(e, "案を作れませんでした。"), moves: [], state: "" }]); }
    finally { setBusy(""); }
  }
  function applyMoves(idx) {
    const m = chat[idx]; if (!m || m.state !== "open") return;
    changeAssign(a => { m.moves.forEach(v => { const x = a[v.from], y = a[v.to]; if (x) a[v.to] = x; else delete a[v.to]; if (y) a[v.from] = y; else delete a[v.from]; }); return a; });
    setChat(c => c.map((x, i) => (i === idx ? { ...x, state: "applied" } : x)));
    setPending(null);
  }

  /* ---- 編集：ドラッグ・大きさ ---- */
  function pointFrom(e) { const r = roomRef.current.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; }
  function onPointerDown(e) {
    if (!edit) return;
    const rs = e.target.closest("[data-rs]"), el = e.target.closest("[data-desk],[data-fx]");
    const p0 = pointFrom(e);
    if (rs) {
      snapshot();
      if (rs.dataset.rs === "room") dragRef.current = { kind: "room", w0: layout.room.w, h0: layout.room.h, p0 };
      else {
        // 選んでいる机・設備の右辺（e）・下辺（s）・右下（se）をドラッグして大きさを変える
        const isDesk = sel?.type === "d", o = isDesk ? layout.desks.find(x => x.id === sel.id) : layout.fx.find(x => x.id === sel?.id);
        if (!o) return;
        dragRef.current = { kind: "size", dir: rs.dataset.rs, isDesk, id: o.id, w0: o.w, h0: o.h, p0 };
      }
      e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); return;
    }
    if (!el) { setSel(null); return; }
    const isDesk = !!el.dataset.desk, id = el.dataset.desk || el.dataset.fx;
    const obj = isDesk ? layout.desks.find(d => d.id === id) : layout.fx.find(f => f.id === id);
    setSel({ type: isDesk ? "d" : "f", id });
    snapshot();
    dragRef.current = { kind: "move", isDesk, id, dx: p0.x - obj.x, dy: p0.y - obj.y, moved: false };
    e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    const g = dragRef.current; if (!g) return;
    const p = pointFrom(e);
    setLayout(l => {
      const n = { ...l, room: { ...l.room }, desks: l.desks.map(d => ({ ...d })), fx: l.fx.map(f => ({ ...f })) };
      if (g.kind === "room") { n.room.w = Math.max(500, Math.min(3000, snap(g.w0 + p.x - g.p0.x))); n.room.h = Math.max(300, Math.min(1600, snap(g.h0 + p.y - g.p0.y))); }
      if (g.kind === "size") {
        const o = g.isDesk ? n.desks.find(d => d.id === g.id) : n.fx.find(f => f.id === g.id), min = g.isDesk ? 30 : 10;
        if (g.dir.includes("e")) o.w = Math.max(min, Math.min(n.room.w - o.x, snap(g.w0 + p.x - g.p0.x)));
        if (g.dir.includes("s")) o.h = Math.max(min, Math.min(n.room.h - o.y, snap(g.h0 + p.y - g.p0.y)));
      }
      if (g.kind === "move") { const o = g.isDesk ? n.desks.find(d => d.id === g.id) : n.fx.find(f => f.id === g.id); o.x = Math.max(0, Math.min(n.room.w - o.w, snap(p.x - g.dx))); o.y = Math.max(0, Math.min(n.room.h - o.h, snap(p.y - g.dy))); g.moved = true; }
      return n;
    });
  }
  function onPointerUp() {
    const g = dragRef.current; if (!g) return;
    dragRef.current = null;
    if (g.kind === "move" && !g.moved) setHistory(h => h.slice(0, -1)); else setDirty(d => ({ ...d, layout: true }));
  }
  function addDesk(k) {
    const id = nextDeskId(layout.desks);
    changeLayout(n => { n.desks.push({ id, x: Math.max(10, snap((n.room.w - k.w) / 2)), y: Math.max(10, snap((n.room.h - k.h) / 2)), w: k.w, h: k.h, L: k.L, R: k.R, T: k.T, B: k.B, teacher: "" }); });
    setSel({ type: "d", id });
  }
  function addFx(k) {
    const name = k[0] === "自由" ? (window.prompt("名前（例：プリンター）", "") || "設備") : k[0];
    const id = seq();
    changeLayout(n => { n.fx.push({ id, t: name, x: Math.max(0, snap((n.room.w - k[1]) / 2)), y: Math.max(0, snap((n.room.h - k[2]) / 2)), w: k[1], h: k[2] }); });
    setSel({ type: "f", id });
  }
  function copySel() {
    if (!sel || (sel.type !== "d" && sel.type !== "f")) return;
    if (sel.type === "d") { const id = nextDeskId(layout.desks); changeLayout(n => { const d = n.desks.find(x => x.id === sel.id); n.desks.push({ ...d, id, teacher: "", x: Math.min(n.room.w - d.w, d.x + d.w + 210) }); }); setSel({ type: "d", id }); }
    else { const id = seq(); changeLayout(n => { const f = n.fx.find(x => x.id === sel.id); n.fx.push({ ...f, id, x: Math.min(n.room.w - f.w, f.x + 30), y: Math.min(n.room.h - f.h, f.y + 30) }); }); setSel({ type: "f", id }); }
  }
  function delSel() {
    if (!sel || (sel.type !== "d" && sel.type !== "f")) return;
    if (sel.type === "d") { let next; changeLayout(n => { n.desks = n.desks.filter(x => x.id !== sel.id); next = n.desks; }); setTimeout(() => cleanAssignTo(next), 0); }
    else changeLayout(n => { n.fx = n.fx.filter(x => x.id !== sel.id); });
    setSel(null);
  }
  useEffect(() => {
    const onKey = e => {
      if (!edit || !sel || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName || "")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); copySel(); }
      if (e.key === "Delete") { e.preventDefault(); delSel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---- 名前のドラッグ ---- */
  function onDrop(toSeat) {
    const from = dragSeatRef.current; dragSeatRef.current = null;
    if (!from) return;
    if (toSeat === "tray") { if (from.seat) changeAssign(a => { delete a[from.seat]; return a; }, p => { delete p[assign[from.seat]]; return p; }); return; }
    if (from.loose) { changeAssign(a => { const was = a[toSeat]; a[toSeat] = from.loose; return a; }); return; }
    if (from.seat === toSeat) return;
    const a0 = assign[from.seat], b0 = assign[toSeat];
    changeAssign(a => { if (a0) a[toSeat] = a0; else delete a[toSeat]; if (b0) a[from.seat] = b0; else delete a[from.seat]; return a; },
      p => { Object.keys(p).forEach(pid => { if (pid === a0) p[pid] = toSeat; if (pid === b0) p[pid] = from.seat; }); return p; });
  }

  /* ---- 描く ---- */
  const hlSeats = new Set(pending ? pending.moves.flatMap(m => [m.from, m.to]) : []);
  const handle = { position: "absolute", background: T.accent, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,.25)", borderRadius: 4, zIndex: 6 };
  const sizeHandles = <>
    <span data-rs="e" title="ドラッグで幅を変える" style={{ ...handle, right: -9, top: "50%", width: 12, height: 26, marginTop: -13, cursor: "ew-resize" }} />
    <span data-rs="s" title="ドラッグで奥行きを変える" style={{ ...handle, bottom: -9, left: "50%", width: 26, height: 12, marginLeft: -13, cursor: "ns-resize" }} />
    <span data-rs="se" title="ドラッグで大きさを変える" style={{ ...handle, right: -10, bottom: -10, width: 18, height: 18, cursor: "nwse-resize" }} />
  </>;
  function renderRoom(forPrint) {
    const ed = edit && !forPrint;
    return (
      <div ref={forPrint ? undefined : roomRef} className="relative select-none bg-white" style={{ width: layout.room.w, height: layout.room.h, border: "2.5px solid #1A1C1F", fontSize: 12 }}
        onPointerDown={forPrint ? undefined : onPointerDown} onPointerMove={forPrint ? undefined : onPointerMove} onPointerUp={forPrint ? undefined : onPointerUp}>
        {!layout.desks.length && !layout.fx.length && !forPrint && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-sm leading-8" style={{ color: "#9AA3B2" }}>上の「机を置く」「設備を置く」から始めてください<br />右下の青い角をドラッグすると、教室の広さを変えられます</div>}
        {layout.fx.map(f => {
          const on = ed && sel?.type === "f" && sel.id === f.id;
          return <div key={f.id} data-fx={f.id} className="absolute grid place-items-center bg-white text-xs" style={{ left: f.x, top: f.y, width: f.w, height: f.h, border: "1.5px solid #1A1C1F", zIndex: 2, writingMode: f.h > f.w * 1.4 ? "vertical-rl" : undefined, cursor: ed ? "move" : "default", outline: on ? `2.5px solid ${T.accent}` : ed ? `1px dashed ${T.accent}` : "none", outlineOffset: on ? 3 : 0 }}>
            {f.t}{on && sizeHandles}
          </div>;
        })}
        {layout.desks.map(d => {
          const again = deskStats(d, assign, byId, prev).again.length;
          const on = !forPrint && sel?.type === "d" && sel.id === d.id;
          return <div key={d.id} data-desk={d.id} onClick={() => !edit && setSel({ type: "d", id: d.id })} className="absolute grid place-items-center bg-white text-[15px] font-medium"
            style={{ left: d.x, top: d.y, width: d.w, height: d.h, border: `2.5px solid ${on && !ed ? T.accent : "#1A1C1F"}`, background: on && !ed ? T.accentSubtle : "#fff", zIndex: 3, cursor: ed ? "move" : "pointer", outline: ed ? (on ? `2.5px solid ${T.accent}` : `2px dashed ${T.accent}`) : "none", outlineOffset: 3 }}>
            {d.id}{ed && on && sizeHandles}{again > 0 && !forPrint && <span className="absolute grid h-[18px] w-[18px] place-items-center rounded-full text-[11px] font-bold text-white" style={{ top: -9, right: -9, background: T.danger }} title="前回と同じ机の人">{again}</span>}
          </div>;
        })}
        {layout.desks.map(d => seatsOf(d).map(s => {
          const base = { left: s.x, top: s.y, width: SEAT_W, height: SEAT_H, zIndex: 4, pointerEvents: ed ? "none" : "auto" };
          if (d.teacher === s.id) return <div key={s.id} className="absolute grid place-content-center justify-items-center" style={base}><span className="text-[9.5px]">&nbsp;</span><span className="text-[14.5px] font-bold">メイン講師</span></div>;
          const pid = assign[s.id], p = pid && byId.get(pid);
          const hl = hlSeats.has(s.id);
          const common = { onDragOver: e => { if (dragSeatRef.current) e.preventDefault(); }, onDrop: e => { e.preventDefault(); onDrop(s.id); } };
          if (!p) return <div key={s.id} {...common} className="absolute grid place-content-center justify-items-center rounded-lg" style={{ ...base, border: `1.5px solid ${hl ? T.warning : "transparent"}`, background: hl ? T.warningSubtle : "transparent" }}><span className="text-[9.5px]">&nbsp;</span><span className="text-xs" style={{ color: "#B8C0CC" }}>{forPrint ? "" : "空席"}</span></div>;
          const picked = !forPrint && sel?.type === "p" && sel.id === p.id;
          return <div key={s.id} {...common} draggable={!ed && !forPrint} onDragStart={e => { dragSeatRef.current = { seat: s.id }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", s.id); }}
            onClick={() => setSel({ type: "p", id: p.id })} title={p.name}
            className="absolute grid cursor-grab place-content-center justify-items-center rounded-lg" style={{ ...base, border: `1.5px solid ${hl ? T.warning : picked ? T.accent : "transparent"}`, background: hl ? T.warningSubtle : picked ? T.accentSubtle : "transparent" }}>
            {!forPrint && pins[p.id] === s.id && <Pin size={10} className="absolute" style={{ left: 4, top: 2, color: T.warning }} />}
            {!forPrint && prev[p.id] === d.id && <span className="absolute h-2 w-2 rounded-full" style={{ right: 4, top: 3, background: T.danger }} title="前回と同じ机" />}
            <span className="text-[9.5px] leading-tight" style={{ color: "#333" }}>{p.kana || " "}</span>
            <span className="whitespace-nowrap text-[14.5px] font-medium leading-tight" style={{ color: "#111" }}>{p.name.replace(/[\s　]/g, "")}</span>
          </div>;
        }))}
        {ed && <span data-rs="room" title="ドラッグで広さを変える" className="absolute rounded-md" style={{ right: -9, bottom: -9, width: 18, height: 18, background: T.accent, border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,.25)", cursor: "nwse-resize", zIndex: 20 }} />}
      </div>
    );
  }

  const curRoundLabel = round ? `${round.title}${round.status === "confirmed" ? "（確定）" : "（下書き）"}` : "まだ回がありません";
  return (
    <div className="grid gap-3" onPointerDownCapture={e => { if (e.target.closest?.("[data-seat-card]")) return; const r = (e.target.closest?.("[data-desk],[title],span") || e.target).getBoundingClientRect(); ptRef.current = { l: r.left, r: r.right, y: r.top }; }}>
      <style>{`@media print{@page{size:A4 landscape;margin:8mm} body *{visibility:hidden !important} #seating-print,#seating-print *{visibility:visible !important} #seating-print{display:block !important;position:absolute;left:0;top:0}}`}</style>
      <details open={howto} onToggle={e => setHowto(e.currentTarget.open)} className="rounded-2xl bg-white px-4 py-3" style={{ border: `1px solid ${T.border}` }}>
        <summary className="cursor-pointer text-sm font-bold" style={{ color: T.textPrimary }}>使い方</summary>
        <ol className="mt-1 grid list-decimal gap-0.5 pl-5 text-[13px]" style={{ color: T.textSecondary }}>
          <li>「レイアウトを編集」で教室を作ります。右下の青い角をドラッグすると教室の広さが変わります（コースごとに保存）。</li>
          <li>「机を置く」「設備を置く」で置き、ドラッグで動かします。押して選ぶと右で席の数・名前・大きさを変えられ、Ctrl+D でコピー、Delete で削除できます。</li>
          <li>「受講生の情報」で性別・受講形態（任意）を入れ、「AIでカルテから読み直す」で実装力・コミュニケーション力を読み取ります。</li>
          <li>「AIで配置」で、実装力・コミュニケーション力・性別・受講形態・前回の机をもとに席へ入れます。名前はドラッグで入れ替え、「まだ席がない人」へドラッグすると外せます。</li>
          <li>机を押すとその組み合わせの理由、名前を押すとその人の評価が右に出ます。「AIに頼む」に「○○さんを前の席に」などと書くと入れ替え案が出ます。</li>
          <li>「保存」で下書き、「確定」で決定。次の席替えは「新しい回」から。前回の机と重ならないよう配置します。「PDFで出力」で座席表になります。</li>
        </ol>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-sm font-bold" style={{ border: `1px solid ${T.border}` }}>
          <span className="text-xs" style={{ color: T.textMuted }}>回</span>
          {rounds.length ? <select value={roundId} onChange={e => { if ((dirty.round) && !window.confirm("保存していない席の変更があります。別の回を開きますか？")) return; setRoundId(e.target.value); }} className="bg-transparent outline-none">{rounds.map(r => <option key={r.roundId} value={r.roundId}>{r.title}{r.status === "confirmed" ? "（確定）" : "（下書き）"}</option>)}</select> : <span>{curRoundLabel}</span>}
        </label>
        <Btn size="sm" kind="ghost" icon={Plus} disabled={!!busy} onClick={newRound}>新しい回</Btn>
        <Badge tone="muted">席 {seatCount} ・ 教室の受講生 {people.length - online.length}人</Badge>
        {layout.desks.length > 0 && <Badge tone={totAgain ? "red" : "green"}>前回と同じ机 {totAgain}人</Badge>}
        {(dirty.layout || dirty.round) && <Badge tone="amber">保存していない変更</Badge>}
        <span className="ml-auto flex flex-wrap gap-2">
          <Btn size="sm" kind={edit ? "dark" : "ghost"} icon={Move} onClick={async () => { if (edit && dirty.layout) await saveLayout(); setEdit(v => !v); setSel(null); }}>{edit ? "編集を終える" : "レイアウトを編集"}</Btn>
          <Btn size="sm" kind="ghost" icon={RotateCcw} disabled={!history.length} onClick={undo}>戻す</Btn>
          <Btn size="sm" kind="ghost" icon={Sparkles} disabled={!seatCount} onClick={runAuto}>{Object.keys(assign).length ? "AIで配置し直す" : "AIで配置"}</Btn>
          <Btn size="sm" kind="ghost" icon={FileDown} onClick={printPdf}>PDFで出力</Btn>
          <Btn size="sm" kind="ghost" icon={Save} disabled={!!busy} onClick={() => saveRound("")}>{busy === "round" ? "保存中…" : "保存"}</Btn>
          <Btn size="sm" icon={Check} disabled={!!busy} onClick={() => saveRound("confirmed")}>{busy === "confirmed" ? "確定中…" : "確定"}</Btn>
        </span>
      </div>
      {msg && <div className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: T.accentSubtle, color: T.accentHover }}>{msg}</div>}

      {layout.desks.length > 0 && <AskBox chat={chat} busy={busy === "ask"} onAsk={ask} onApply={applyMoves} onReject={i => { setChat(c => c.map((x, j) => (j === i ? { ...x, state: "rejected" } : x))); setPending(null); }} />}

      <Card className="overflow-hidden p-0">
        {edit && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5" style={{ borderBottom: `1px solid ${T.border}` }}>
            <b className="mr-1 text-xs" style={{ color: T.textSecondary }}>机を置く</b>
            {DESK_KINDS.map(k => <button key={k.label} type="button" onClick={() => addDesk(k)} className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold" style={{ border: `1px dashed ${T.border}` }}>{k.label}</button>)}
            <span className="mx-1 h-5 w-px" style={{ background: T.border }} />
            <b className="mr-1 text-xs" style={{ color: T.textSecondary }}>設備を置く</b>
            {FX_KINDS.map(k => <button key={k[0]} type="button" onClick={() => addFx(k)} className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold" style={{ border: `1px dashed ${T.border}` }}>{k[0]}</button>)}
          </div>
        )}
        {/* 編集中は、選んだ机・設備（何も選んでいなければ教室）の設定を教室の上の1行に出す（教室を隠さない） */}
        {edit && <Drawer bar sel={sel && (sel.type === "d" || sel.type === "f") ? sel : { type: "room" }} setSel={setSel} edit layout={layout} assign={assign} pins={pins} byId={byId} prev={prev}
          changeLayout={changeLayout} copySel={copySel} delSel={delSel} cleanAssignTo={cleanAssignTo} togglePin={() => {}} />}
        <div ref={wrapRef} className="overflow-hidden p-2.5">
          <div style={{ width: (layout.room.w + 6) * scale, height: (layout.room.h + 6) * scale }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>{renderRoom(false)}</div>
          </div>
        </div>
      </Card>

      <Card className="flex min-h-[52px] flex-wrap items-center gap-1.5 px-4 py-2.5" onDragOver={e => { if (dragSeatRef.current?.seat) e.preventDefault(); }} onDrop={e => { e.preventDefault(); onDrop("tray"); }}>
        <b className="mr-1 text-sm" style={{ color: T.textPrimary }}>まだ席がない人 <span className="tabular-nums">{loose.length}</span></b>
        {loose.map(p => <span key={p.id} draggable onDragStart={e => { dragSeatRef.current = { loose: p.id }; e.dataTransfer.setData("text/plain", p.id); }} onClick={() => setSel({ type: "p", id: p.id })} className="cursor-grab rounded-full bg-white px-2.5 py-0.5 text-[13px]" style={{ border: `1px solid ${T.border}` }}>{p.name} <small style={{ color: T.textMuted }}>実{p.impl}・コ{p.comm}</small></span>)}
        {online.length > 0 && <><span className="basis-full" /><b className="mr-1 inline-flex items-center gap-1 text-sm" style={{ color: T.textPrimary }}><Wifi size={14} />オンライン参加</b>{online.map(p => <span key={p.id} onClick={() => setSel({ type: "p", id: p.id })} className="cursor-pointer rounded-full bg-white px-2.5 py-0.5 text-[13px]" style={{ border: `1px solid ${T.border}` }}>{p.name}</span>)}</>}
      </Card>

      {sel && !edit && <Drawer at={ptRef.current} sel={sel} setSel={setSel} edit={false} layout={layout} assign={assign} pins={pins} byId={byId} prev={prev}
        changeLayout={changeLayout} copySel={copySel} delSel={delSel} cleanAssignTo={cleanAssignTo}
        togglePin={pid => changeAssign(a => a, p => { if (p[pid]) delete p[pid]; else { const s = Object.keys(assign).find(k => assign[k] === pid); if (s) p[pid] = s; } return p; })} />}

      <div id="seating-print" style={{ display: "none" }}>
        <div style={{ font: "700 16px sans-serif", marginBottom: 4 }}>座席表　{data.courseName}{round ? ` ・ ${round.title}` : ""}</div>
        <div style={{ font: "12px sans-serif", color: "#444", marginBottom: 8 }}>出力 {new Date().toLocaleDateString("ja-JP")}</div>
        <div style={{ transform: `scale(${Math.min(1, 1040 / (layout.room.w + 6))})`, transformOrigin: "0 0" }}>{renderRoom(true)}</div>
      </div>
    </div>
  );
}

function AskBox({ chat, busy, onAsk, onApply, onReject }) {
  const [text, setText] = useState("");
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [chat]);
  const examples = ["○○さんと○○さんを別の机にしたい", "○○さんを机Cに入れたい", "○○さんを前の席にしたい"];
  return (
    <Card className="grid gap-2 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-bold" style={{ color: T.textPrimary }}><Sparkles size={15} />AIに頼む<Badge tone="muted">入れ替え案を出し、確認してから反映</Badge></div>
      {chat.length > 0 ? (
        <div ref={logRef} className="grid max-h-56 gap-2 overflow-y-auto pr-1">
          {chat.map((m, i) => m.who === "me"
            ? <div key={i} className="max-w-[78%] justify-self-end whitespace-pre-wrap rounded-2xl rounded-tr-md px-3 py-1.5 text-[13px] text-white" style={{ background: T.accent }}>{m.text}</div>
            : <div key={i} className="max-w-[78%] justify-self-start whitespace-pre-wrap rounded-2xl rounded-tl-md px-3 py-1.5 text-[13px]" style={{ background: "#F2EDFD", color: T.textPrimary }}>
                {m.text}
                {m.moves?.length > 0 && <div className="my-1.5 grid gap-1">{m.moves.map((v, j) => <div key={j} className="rounded-lg bg-white px-2 py-1 text-xs" style={{ border: `1px solid ${T.border}` }}>{v.label}</div>)}</div>}
                {m.moves?.length > 0 && (m.state === "applied" ? <div className="text-xs font-bold" style={{ color: T.success }}>入れ替えました</div> : m.state === "rejected" ? <div className="text-xs" style={{ color: T.textMuted }}>見送りました</div> : <div className="mt-1 flex gap-1.5"><Btn size="sm" onClick={() => onApply(i)}>この案で入れ替える</Btn><Btn size="sm" kind="ghost" onClick={() => onReject(i)}>やめる</Btn></div>)}
              </div>)}
          {busy && <div className="justify-self-start text-xs" style={{ color: T.textMuted }}>考えています…</div>}
        </div>
      ) : <div className="flex flex-wrap gap-1.5">{examples.map(t => <button key={t} type="button" onClick={() => setText(t)} className="rounded-full bg-white px-2.5 py-0.5 text-xs" style={{ border: `1px dashed ${T.border}`, color: T.textSecondary }}>{t}</button>)}</div>}
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (!text.trim()) return; onAsk(text); setText(""); }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="例：A班の佐藤さんは目が悪いので前の席に／田中さんと山口さんは離したい" aria-label="AIに頼む" maxLength={400} className="min-w-0 flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
        <Btn type="submit" icon={Send} disabled={busy || !text.trim()}>送る</Btn>
      </form>
    </Card>
  );
}

// 説明のカードは押した場所の横に小さく出す（右に入らなければ左。画面からはみ出さない）
function cardPos(at) {
  const vw = window.innerWidth, vh = window.innerHeight, w = Math.min(300, vw - 32), h = Math.min(400, vh - 96);
  if (!at || vw < 640) return { left: 16, right: 16, bottom: 16, maxHeight: Math.min(360, vh - 96) };
  let left = at.r + 12;
  if (left + w > vw - 16) left = Math.max(16, at.l - w - 12);
  const top = Math.max(72, Math.min(at.y - 8, vh - h - 16));
  return { left, top, width: w, maxHeight: h };
}

function Drawer({ bar, at, sel, setSel, edit, layout, assign, pins, byId, prev, changeLayout, copySel, delSel, cleanAssignTo, togglePin }) {
  const boxRef = useRef(null);
  // 浮いているカードは、外を押したら閉じる（机・名前を押した場合は、その内容で開き直る）
  useEffect(() => {
    if (bar) return undefined;
    const onDown = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setSel(null); };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [bar, setSel]);
  const shell = (title, sub, children) => bar ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 text-sm" style={{ borderBottom: `1px solid ${T.border}`, background: T.bgBase }} aria-label={title}>
      <b className="text-sm" style={{ color: T.textPrimary }}>{title}{sub && <small className="ml-1.5 font-normal" style={{ color: T.textMuted }}>{sub}</small>}</b>
      {children}
    </div>
  ) : (
    createPortal(<aside ref={boxRef} data-seat-card className="fixed z-50 flex flex-col rounded-2xl bg-white shadow-2xl" style={{ ...cardPos(at), border: `1px solid ${T.border}` }} aria-label={title}>
      <div className="flex items-center gap-2 px-3.5 py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
        <div className="min-w-0"><div className="text-[11px]" style={{ color: T.textMuted }}>{sub}</div><b className="text-[15px]" style={{ color: T.textPrimary }}>{title}</b></div>
        <button type="button" onClick={() => setSel(null)} aria-label="閉じる" className="ml-auto" style={{ color: T.textMuted }}><X size={18} /></button>
      </div>
      <div className="grid content-start gap-2.5 overflow-y-auto px-3.5 py-2.5 text-sm">{children}</div>
    </aside>, document.body)
  );
  const lab = "flex items-center gap-1.5 text-xs font-bold";
  const tools = kind => <div className="flex flex-wrap gap-1.5"><Btn size="sm" kind="ghost" onClick={copySel}>コピー（Ctrl+D）</Btn><Btn size="sm" kind="ghost" onClick={delSel}>削除（Delete）</Btn>{kind === "f" && <Btn size="sm" kind="ghost" onClick={() => changeLayout(n => { const f = n.fx.find(x => x.id === sel.id); const w = f.w; f.w = f.h; f.h = w; })}>縦横を入れ替え</Btn>}</div>;
  const numIn = (value, onChange, label, min = 10) => <input type="number" min={min} step={10} value={value} onChange={e => onChange(Math.max(min, Number(e.target.value) || min))} aria-label={label} className="w-[72px] rounded-lg bg-white px-2 py-1 font-normal outline-none" style={{ border: `1px solid ${T.border}` }} />;
  if (sel.type === "room") return shell("教室の広さ", "", <div className={lab} style={{ color: T.textSecondary }}>{numIn(layout.room.w, v => changeLayout(n => { n.room.w = Math.min(3000, Math.max(500, v)); }), "幅", 500)}×{numIn(layout.room.h, v => changeLayout(n => { n.room.h = Math.min(1600, Math.max(300, v)); }), "高さ", 300)}</div>);
  if (sel.type === "f") {
    const f = layout.fx.find(x => x.id === sel.id); if (!f) return null;
    return shell("設備", "", <>
      <label className={lab} style={{ color: T.textSecondary }}>名前<input key={f.id} defaultValue={f.t} onBlur={e => changeLayout(n => { n.fx.find(x => x.id === f.id).t = e.target.value.trim() || "設備"; })} className="w-32 rounded-lg bg-white px-2 py-1 text-sm font-normal outline-none" style={{ border: `1px solid ${T.border}` }} /></label>
      <div className={lab} style={{ color: T.textSecondary }}>大きさ {numIn(f.w, v => changeLayout(n => { n.fx.find(x => x.id === f.id).w = v; }), "幅")}×{numIn(f.h, v => changeLayout(n => { n.fx.find(x => x.id === f.id).h = v; }), "高さ")}</div>
      {tools("f")}
    </>);
  }
  if (sel.type === "d") {
    const d = layout.desks.find(x => x.id === sel.id); if (!d) return null;
    const st = deskStats(d, assign, byId, prev);
    const seatsCtl = <div className="flex flex-wrap gap-2 text-xs">{[["L", "左"], ["R", "右"], ["T", "上"], ["B", "下"]].map(([k, l]) => <label key={k}>{l} <select value={d[k]} onChange={e => { let next; changeLayout(n => { const x = n.desks.find(y => y.id === d.id); x[k] = Number(e.target.value); fitDesk(x); next = n.desks; }); setTimeout(() => cleanAssignTo(next), 0); }} className="rounded-lg bg-white px-1.5 py-0.5" style={{ border: `1px solid ${T.border}` }}>{[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n}>{n}</option>)}</select></label>)}</div>;
    if (edit) {
      const seatOpts = seatsOf(d).map(s => s.id);
      return shell(`机 ${d.id}`, `${d.L + d.R + d.T + d.B}席`, <>
        <label className={lab} style={{ color: T.textSecondary }}>名前<input key={d.id} defaultValue={d.id} maxLength={3} onBlur={e => { const v = e.target.value.trim(); if (!v || v === d.id || layout.desks.some(x => x.id === v)) return; changeLayout(n => { const x = n.desks.find(y => y.id === d.id); x.id = v; if (x.teacher) x.teacher = v + x.teacher.slice(d.id.length); }); setSel({ type: "d", id: v }); }} className="w-14 rounded-lg bg-white px-2 py-1 text-sm font-normal outline-none" style={{ border: `1px solid ${T.border}` }} /></label>
        <div className={lab} style={{ color: T.textSecondary }}>席{seatsCtl}</div>
        <div className={lab} style={{ color: T.textSecondary }}>大きさ {numIn(d.w, v => changeLayout(n => { n.desks.find(x => x.id === d.id).w = v; }), "幅", 30)}×{numIn(d.h, v => changeLayout(n => { n.desks.find(x => x.id === d.id).h = v; }), "奥行き", 30)}</div>
        <label className={lab} style={{ color: T.textSecondary }}>講師の席<select value={d.teacher || ""} onChange={e => changeLayout(n => { n.desks.find(y => y.id === d.id).teacher = e.target.value; })} className="rounded-lg bg-white px-2 py-1 text-sm font-normal" style={{ border: `1px solid ${T.border}` }}><option value="">なし</option>{seatOpts.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
        {tools("d")}
      </>);
    }
    return shell(`机 ${d.id}`, `${st.m.length}人 ・ 席 ${d.L + d.R + d.T + d.B}`, <>
      <div className="grid grid-cols-4 gap-1.5 text-center">{[[st.impl.toFixed(1), "実装の平均"], [st.comm.toFixed(1), "コミュの平均"], [`${st.f}/${st.ma}`, "女/男"], [st.again.length, "前回と同じ"]].map(([v, l], i) => <div key={l} className="rounded-lg py-1.5" style={{ background: T.bgBase }}><b className="block text-base tabular-nums" style={{ color: i === 3 ? (st.again.length ? T.danger : T.success) : T.textPrimary }}>{v}</b><small className="text-[10.5px]" style={{ color: T.textMuted }}>{l}</small></div>)}</div>
      <div><div className="mb-1 flex items-center gap-1 text-xs font-bold" style={{ color: T.textSecondary }}><Sparkles size={13} />この組み合わせにした理由</div><div className="grid gap-1.5">{reasonsOf(st).map((r, i) => <div key={i} className="rounded-r-lg py-1.5 pl-2.5 text-[13px]" style={{ borderLeft: "3px solid #7454C7", background: "#F2EDFD", color: T.textSecondary }}>{r}</div>)}</div></div>
      <div><div className="mb-1 text-xs font-bold" style={{ color: T.textSecondary }}>座っている人</div>{st.m.map(q => <button key={q.id} type="button" onClick={() => setSel({ type: "p", id: q.id })} className="flex w-full items-center gap-2 py-1.5 text-left" style={{ borderTop: `1px solid ${T.border}` }}><b>{q.name}</b><span className="ml-auto flex gap-1"><Badge tone="cyan">実{q.impl}</Badge><Badge tone="green">コ{q.comm}</Badge>{prev[q.id] === d.id && <Badge tone="red">前回同じ</Badge>}</span></button>)}</div>
      <div className="grid gap-1 text-xs font-bold" style={{ color: T.textSecondary }}>席の数{seatsCtl}</div>
    </>);
  }
  const p = byId.get(sel.id); if (!p) return null;
  const seat = Object.keys(assign).find(k => assign[k] === p.id), desk = seat ? deskOfSeat(seat) : "";
  const neighbors = seat ? deskStats(layout.desks.find(x => x.id === desk) || { id: desk, L: 0, R: 0, T: 0, B: 0, x: 0, y: 0, w: 0, h: 0 }, assign, byId, prev).m.filter(q => q.id !== p.id) : [];
  return shell(p.name, p.kana, <>
    <Badge tone={p.mode === "online" ? "cyan" : "muted"}>{p.mode === "online" ? "オンライン" : desk ? `机 ${desk}` : "未配置"}</Badge>
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 text-[13px]">
      <span>実装力</span><span className="flex items-center gap-2"><Level n={p.impl} color={T.accent} /><b>{p.impl}</b>{p.manualImpl != null && <small style={{ color: T.textMuted }}>講師が設定</small>}</span>
      <span>コミュニケーション</span><span className="flex items-center gap-2"><Level n={p.comm} color={T.success} /><b>{p.comm}</b>{p.manualComm != null && <small style={{ color: T.textMuted }}>講師が設定</small>}</span>
      <span>性別</span><span>{GENDER_LABEL[p.gender] || "未設定"}</span>
      <span>受講形態</span><span>{p.mode === "online" ? "オンラインのみ" : "教室"}</span>
      <span>前回の机</span><span>{prev[p.id] || "－"}{desk && prev[p.id] && (prev[p.id] === desk ? <Badge tone="red" className="ml-1">今回も同じ</Badge> : <Badge tone="green" className="ml-1">別の机</Badge>)}</span>
    </div>
    <div><div className="mb-1 flex items-center gap-1 text-xs font-bold" style={{ color: T.textSecondary }}><Sparkles size={13} />カルテから読んだこと</div>
      <div className="rounded-r-lg py-1.5 pl-2.5 text-[13px]" style={{ borderLeft: "3px solid #7454C7", background: "#F2EDFD", color: T.textSecondary }}>{p.reason || "まだ読み取っていません（「受講生の情報」の「AIでカルテから読み直す」）"}</div>
      {p.sources && <div className="mt-1 text-[11px]" style={{ color: T.textMuted }}>テスト {p.sources.tests}件{p.sources.testAverage != null ? `（平均 ${p.sources.testAverage}点）` : ""} ・ 日報 {p.sources.reports}件 ・ 講師メモ {p.sources.notes}件</div>}
    </div>
    {neighbors.length > 0 && <div><div className="mb-1 text-xs font-bold" style={{ color: T.textSecondary }}>同じ机の人</div>{neighbors.map(q => <button key={q.id} type="button" onClick={() => setSel({ type: "p", id: q.id })} className="flex w-full items-center gap-2 py-1.5 text-left" style={{ borderTop: `1px solid ${T.border}` }}><b>{q.name}</b><span className="ml-auto flex gap-1"><Badge tone="cyan">実{q.impl}</Badge><Badge tone="green">コ{q.comm}</Badge></span></button>)}</div>}
    {seat && <div><Btn size="sm" kind="ghost" icon={Pin} onClick={() => togglePin(p.id)}>{pins[p.id] ? "固定をやめる" : "この席に固定"}</Btn></div>}
  </>);
}
