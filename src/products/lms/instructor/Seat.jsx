import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { getActiveCourseId, setActiveCourseId } from "../../../utils/common/courseContext.js";
import { DESK_KINDS, FX_KINDS, GENDER_LABEL, SEAT_H, SEAT_W, allSeatIds, autoAssign, deskOfSeat, deskStats, fitDesk, nextDeskId, reasonsOf, seatsOf, seq, snap } from "../../training/SeatingView.jsx";
import { Btn, Card, Chip, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { errText } from "../staff/common.js";

/* 席替え（モック seatX）：教室を作る・AI で配置・名前のドラッグで入れ替え・AI に頼む・保存と確定・座席表の印刷。
   配置の計算は今の画面（training/SeatingView.jsx）と同じものを使う。盤面の動きも同じで、見た目と窓だけ新しくする */

function Level({ n, tone }) {
  return <span className={`sx-lv ${tone}`} aria-hidden="true">{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= n ? "on" : ""} />)}</span>;
}

export default function InstructorSeat({ say }) {
  const [courses, setCourses] = useState(null);
  const [courseId, setCourseId] = useState("");
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState("seats");
  const load = useCallback(async id => {
    if (!id) return;
    setLoadErr(""); setData(null);
    try { setData(await apiGet(`/seating?courseId=${encodeURIComponent(id)}`)); }
    catch (e) { setLoadErr(errText(e, "席替えを確認できません")); }
  }, []);
  const loadCourses = useCallback(() => {
    setLoadErr("");
    apiGet("/seating/courses").then(d => {
      const list = Array.isArray(d?.courses) ? d.courses : [];
      setCourses(list);
      const pref = getActiveCourseId();
      const id = list.some(c => c.courseId === pref) ? pref : (list[0]?.courseId || "");
      setCourseId(id);
      if (id) setActiveCourseId(id);
    }).catch(e => setLoadErr(errText(e, "コースを確認できません")));
  }, []);
  useEffect(() => { loadCourses(); }, [loadCourses]);
  useEffect(() => { load(courseId); }, [courseId, load]);
  if (loadErr) return <Card><div className="empty"><b>{loadErr}</b><Btn kind="ghost sm" onClick={() => (courses ? load(courseId) : loadCourses())}>再読み込み</Btn></div></Card>;
  if (courses == null || (courseId && !data)) return <div className="soon card">読み込み中</div>;
  if (!courses.length) return <Card><div className="empty"><b>担当のコース</b><Chip>なし</Chip></div></Card>;
  const name = courses.find(c => c.courseId === courseId)?.name || "";
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{name}</div><h1 className="h1">席替え</h1></div>
        <span className="r"><span className="seg"><button type="button" aria-pressed={tab === "seats"} onClick={() => setTab("seats")}>席替え</button><button type="button" aria-pressed={tab === "people"} onClick={() => setTab("people")}>受講生の情報</button></span></span>
      </div>
      {/* 受講生の情報へ切り替えても保存前の席が消えないよう、席替えは隠すだけにする */}
      <div hidden={tab !== "seats"}><SeatingBoard key={courseId} data={data} courseId={courseId} setData={setData} say={say} /></div>
      {tab === "people" && <PeopleTable data={data} courseId={courseId} setData={setData} say={say} />}
    </div>
  );
}

/* 受講生の情報（性別・受講形態・ふりがなは任意。実装力・コミュ力は AI が読み、講師が直せる） */
function PeopleTable({ data, courseId, setData, say }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("name");
  async function save(id, patch) {
    setErr("");
    try {
      const p = await apiPut(`/seating/people/${encodeURIComponent(id)}`, { courseId, ...patch });
      if (p) setData(d => ({ ...d, people: d.people.map(x => (x.id === id ? p : x)) }));
    } catch (e) { setErr(errText(e, "保存できませんでした")); }
  }
  async function score() {
    if (busy) return;
    setBusy(true); setErr("");
    try { const r = await apiPost("/seating/score", { courseId }); setData(d => ({ ...d, people: r.people })); say?.(`${r.scored} 人分を読み取りました`); }
    catch (e) { setErr(errText(e, "読み取れませんでした")); }
    finally { setBusy(false); }
  }
  const sel = (value, onChange, opts, label) => <select className="in sx-in" value={value} onChange={e => onChange(e.target.value)} aria-label={label}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
  const scoreSel = (p, k) => { const m = k === "impl" ? "manualImpl" : "manualComm", ai = k === "impl" ? "aiImpl" : "aiComm"; return sel(p[m] == null ? "" : String(p[m]), v => save(p.id, { [k]: v === "" ? null : Number(v) }), [["", `AI（${p[ai] ?? "－"}）`], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]], k === "impl" ? "実装力" : "コミュ力"); };
  const none = p => !p.reason;
  const list = data.people.filter(p => matchName(p.name, p.kana, q) && (tab === "all" || (tab === "online" ? p.mode === "online" : none(p))))
    .sort({ name: (a, b) => String(a.kana || a.name).localeCompare(String(b.kana || b.name), "ja"), impl: (a, b) => b.impl - a.impl, comm: (a, b) => b.comm - a.comm }[sort]);
  return (
    <>
      <div className="row"><Chip>性別・受講形態・ふりがなは任意</Chip><span className="sx-sp" /><Btn kind="sm" disabled={busy} onClick={score}>{busy ? "読み取っています" : "AI でカルテから読み直す"}</Btn></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      <ListTool tabs={[["all", "すべて", data.people.length], ["online", "オンライン", data.people.filter(p => p.mode === "online").length], ["none", "未読み取り", data.people.filter(none).length]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["name", "名前順"], ["impl", "実装力の高い順"], ["comm", "コミュ力の高い順"]]} sort={sort} onSort={setSort} />
      <Card className=""><div className="scroll"><table className="tbl sx-pt"><thead><tr><th>受講生</th><th>ふりがな</th><th>性別</th><th>受講形態</th><th>実装力</th><th>コミュ力</th><th>AI の見立て</th></tr></thead><tbody>
        {list.map(p => (
          <tr key={p.id}>
            <td><b>{p.name}</b></td>
            <td><input type="text" className="sx-in" defaultValue={p.kana} placeholder="ヤマダタロウ" aria-label={`${p.name} のふりがな`} onBlur={e => e.target.value !== p.kana && save(p.id, { kana: e.target.value })} /></td>
            <td>{sel(p.gender, v => save(p.id, { gender: v }), Object.entries(GENDER_LABEL), "性別")}</td>
            <td>{sel(p.mode, v => save(p.id, { mode: v }), [["", "教室"], ["online", "オンラインのみ"]], "受講形態")}</td>
            <td><span className="row sx-nw"><Level n={p.impl} tone="a" />{scoreSel(p, "impl")}</span></td>
            <td><span className="row sx-nw"><Level n={p.comm} tone="b" />{scoreSel(p, "comm")}</span></td>
            <td className="sx-why">{p.reason || <Chip>未読み取り</Chip>}{p.sources && <small className="num">テスト {p.sources.tests} 件{p.sources.testAverage != null ? `（平均 ${p.sources.testAverage} 点）` : ""} ・ 日報 {p.sources.reports} 件 ・ 講師メモ {p.sources.notes} 件</small>}</td>
          </tr>
        ))}
        {!list.length && <tr><td colSpan={7}><Chip>該当なし</Chip></td></tr>}
      </tbody></table></div></Card>
    </>
  );
}

/* 席替えの盤面 */
function SeatingBoard({ data, courseId, setData, say }) {
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
  const [msg, setMsgRaw] = useState("");
  const [err, setErr] = useState("");
  const setMsg = t => { setMsgRaw(t); setErr(""); };
  const [conf, setConf] = useState(null);
  const [busy, setBusy] = useState("");
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
    catch (e) { setErr(errText(e, "教室の配置を保存できませんでした。")); return false; }
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
    } catch (e) { setErr(errText(e, "保存できませんでした。")); }
    finally { setBusy(""); }
  }
  function runAuto() {
    snapshot();
    const next = plan + 1; setPlan(next);
    setAssign(autoAssign(layout.desks, people, pins, prev, next));
    setDirty(d => ({ ...d, round: true })); setEdit(false); setSel(null);
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
    const name = k[0] === "自由" ? "設備" : k[0];
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

  async function newRound(force) {
    if (!force && (dirty.round || dirty.layout)) { setConf({ title: "保存していない変更があります", ok: "変更を捨てて新しい回へ", run: () => newRound(true) }); return; }
    setBusy("new"); setMsg("");
    try {
      if (dirty.layout) await saveLayout();
      const r = await apiPost("/seating/rounds", { courseId, startDate: "" });
      setData(d => ({ ...d, rounds: [...d.rounds, r] }));
      setRoundId(r.roundId);
    } catch (e) { setErr(errText(e, "新しい回を作れませんでした")); }
    finally { setBusy(""); }
  }
  const pickRound = id => { if (dirty.round) { setConf({ title: "保存していない席の変更があります", ok: "変更を捨てて開く", run: () => setRoundId(id) }); return; } setRoundId(id); };

  /* ---- 描く ---- */
  const hlSeats = new Set(pending ? pending.moves.flatMap(m => [m.from, m.to]) : []);
  const sizeHandles = <>
    <span className="sx-h e" data-rs="e" title="幅" />
    <span className="sx-h s" data-rs="s" title="奥行き" />
    <span className="sx-h se" data-rs="se" title="大きさ" />
  </>;
  function renderRoom(forPrint) {
    const ed = edit && !forPrint;
    return (
      <div ref={forPrint ? undefined : roomRef} className={`lroom sx-room${ed ? " ed" : ""}`} style={{ width: layout.room.w, height: layout.room.h }}
        onPointerDown={forPrint ? undefined : onPointerDown} onPointerMove={forPrint ? undefined : onPointerMove} onPointerUp={forPrint ? undefined : onPointerUp}>
        {!layout.desks.length && !layout.fx.length && !forPrint && <div className="sx-blank"><Chip>教室は空です</Chip></div>}
        {layout.fx.map(f => {
          const on = ed && sel?.type === "f" && sel.id === f.id;
          return <div key={f.id} data-fx={f.id} className={`lfx${on ? " on" : ""}${f.t === "窓" ? " win" : ""}`} style={{ left: f.x, top: f.y, width: f.w, height: f.h, writingMode: f.h > f.w * 1.4 ? "vertical-rl" : undefined }}><span>{f.t}</span>{on && sizeHandles}</div>;
        })}
        {layout.desks.map(d => {
          const again = deskStats(d, assign, byId, prev).again.length;
          const on = !forPrint && sel?.type === "d" && sel.id === d.id;
          return <div key={d.id} data-desk={d.id} onClick={() => !edit && setSel({ type: "d", id: d.id })} className={`ldesk${on ? " on" : ""}`} style={{ left: d.x, top: d.y, width: d.w, height: d.h }}>{d.id}{ed && on && sizeHandles}{again > 0 && !forPrint && <span className="sx-ag num" title="前回と同じ机の人">{again}</span>}</div>;
        })}
        {layout.desks.map(d => seatsOf(d).map(s => {
          const base = { left: s.x, top: s.y, width: SEAT_W, height: SEAT_H, pointerEvents: ed ? "none" : "auto" };
          if (d.teacher === s.id) return <div key={s.id} className="lst sx-t" style={base}><b>メイン講師</b></div>;
          const pid = assign[s.id], p = pid && byId.get(pid), hl = hlSeats.has(s.id);
          const common = { onDragOver: e => { if (dragSeatRef.current) e.preventDefault(); }, onDrop: e => { e.preventDefault(); onDrop(s.id); } };
          if (!p) return <div key={s.id} {...common} className={`lst empty${hl ? " hl" : ""}${forPrint ? " pr" : ""}`} style={base} />;
          const picked = !forPrint && sel?.type === "p" && sel.id === p.id;
          return (
            <div key={s.id} {...common} draggable={!ed && !forPrint} onDragStart={e => { dragSeatRef.current = { seat: s.id }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", s.id); }}
              onClick={() => setSel({ type: "p", id: p.id })} title={p.name} className={`lst${hl ? " hl" : ""}${picked ? " on" : ""}`} style={base}>
              {!forPrint && pins[p.id] === s.id && <i className="sx-pin" title="固定" />}
              {!forPrint && prev[p.id] === d.id && <i className="sx-dot" title="前回と同じ机" />}
              <small>{p.kana || " "}</small><b>{p.name.replace(/[\s　]/g, "")}</b>
            </div>
          );
        }))}
        {ed && <span className="lrs" data-rs="room" title="教室の広さ" />}
      </div>
    );
  }
  const togglePin = pid => changeAssign(a => a, p => { if (p[pid]) delete p[pid]; else { const s = Object.keys(assign).find(k => assign[k] === pid); if (s) p[pid] = s; } return p; });
  const barSel = sel && (sel.type === "d" || sel.type === "f") ? sel : { type: "room" };
  const draw = { setSel, layout, assign, pins, byId, prev, changeLayout, copySel, delSel, cleanAssignTo, togglePin };
  return (
    <div className="seatw" onPointerDownCapture={e => { if (e.target.closest?.("[data-seat-card]")) return; const r = (e.target.closest?.("[data-desk],[title],span") || e.target).getBoundingClientRect(); ptRef.current = { l: r.left, r: r.right, y: r.top }; }}>
      <style>{`@media print{@page{size:A4 landscape;margin:8mm} body *{visibility:hidden !important} #seating-print,#seating-print *{visibility:visible !important} #seating-print{display:block !important;position:absolute;left:0;top:0}}`}</style>
      <Card className="pad st-g">
        <div className="head">
          <span className="row">
            {rounds.length ? <select className="in sx-round" aria-label="回" value={roundId} onChange={e => pickRound(e.target.value)}>{rounds.map(r => <option key={r.roundId} value={r.roundId}>{r.title}{r.status === "confirmed" ? "（確定）" : "（下書き）"}</option>)}</select> : <Chip>回なし</Chip>}
            <Btn kind="ghost sm" disabled={!!busy} onClick={() => newRound(false)}>＋ 新しい回</Btn>
            <Chip>席 {seatCount} ・ 教室 {people.length - online.length} 人</Chip>
            {layout.desks.length > 0 && <Chip tone={totAgain ? "bad" : "ok"}>前回と同じ机 {totAgain} 人</Chip>}
            {(dirty.layout || dirty.round) && <Chip tone="warn">保存していない変更</Chip>}
          </span>
          <span className="r">
            <Btn kind="ghost sm" onClick={async () => { if (edit && dirty.layout) await saveLayout(); setEdit(v => !v); setSel(null); }}>{edit ? "編集を終える" : "レイアウトを編集"}</Btn>
            <Btn kind="ghost sm" disabled={!history.length} onClick={undo}>戻す</Btn>
            <Btn kind="ghost sm" onClick={() => window.print()}>座席表を印刷</Btn>
          </span>
        </div>
        {err && <div className="lms-err" role="alert">{err}</div>}
        {msg && <div className="okmsg" role="status">{msg}</div>}
        {edit && (
          <div className="ltools">
            <b>机を置く</b>{DESK_KINDS.map(k => <button key={k.label} type="button" className="ladd" onClick={() => addDesk(k)}>{k.label}</button>)}
            <span className="ldv" /><b>設備を置く</b>{FX_KINDS.map(k => <button key={k[0]} type="button" className="ladd" onClick={() => addFx(k)}>{k[0]}</button>)}
          </div>
        )}
        {edit && <div className="lprops"><Props sel={barSel} {...draw} /></div>}
        <div ref={wrapRef} className="lwrap sx-w">
          <div style={{ width: (layout.room.w + 6) * scale, height: (layout.room.h + 6) * scale }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>{renderRoom(false)}</div>
          </div>
        </div>
        <div className="ltray sx-tray" onDragOver={e => { if (dragSeatRef.current?.seat) e.preventDefault(); }} onDrop={e => { e.preventDefault(); onDrop("tray"); }}>
          <b>まだ席がない人 <span className="num">{loose.length}</span></b>
          {loose.map(p => <button key={p.id} type="button" draggable className="sx-pp" onDragStart={e => { dragSeatRef.current = { loose: p.id }; e.dataTransfer.setData("text/plain", p.id); }} onClick={() => setSel({ type: "p", id: p.id })}>{p.name} <small className="num">実{p.impl}・コ{p.comm}</small></button>)}
          {online.length > 0 && <><span className="sx-br" /><b>オンライン参加</b>{online.map(p => <button key={p.id} type="button" className="sx-pp" onClick={() => setSel({ type: "p", id: p.id })}>{p.name}</button>)}</>}
        </div>
      </Card>
      {!edit && (
        <Card className="pad st-g">
          <div className="head"><h2 className="h2">配置</h2><span className="r"><Btn kind="ghost sm" disabled={!seatCount} onClick={runAuto}>{Object.keys(assign).length ? "AI で配置し直す" : "AI で配置"}</Btn><Btn kind="ghost sm" disabled={!!busy} onClick={() => saveRound("")}>{busy === "round" ? "保存しています" : "保存"}</Btn><Btn kind="sm" disabled={!!busy} onClick={() => saveRound("confirmed")}>{busy === "confirmed" ? "確定しています" : "確定"}</Btn></span></div>
          {layout.desks.length > 0 && <AskBox chat={chat} busy={busy === "ask"} onAsk={ask} onApply={applyMoves} onReject={i => { setChat(c => c.map((x, j) => (j === i ? { ...x, state: "rejected" } : x))); setPending(null); }} />}
        </Card>
      )}
      {sel && !edit && <FloatCard at={ptRef.current} sel={sel} {...draw} />}
      {conf && <Modal title={conf.title} width={440} onClose={() => setConf(null)} footer={<><Btn kind="ghost" onClick={() => setConf(null)}>やめる</Btn><Btn onClick={() => { const c = conf; setConf(null); c.run(); }}>{conf.ok}</Btn></>}><Chip tone="warn">今の変更は消えます</Chip></Modal>}
      <div id="seating-print" style={{ display: "none" }}>
        <div className="sx-ph"><b>座席表　{data.courseName}{round ? ` ・ ${round.title}` : ""}</b><small>出力 {new Date().toLocaleDateString("ja-JP")}</small></div>
        <div style={{ transform: `scale(${Math.min(1, 1040 / (layout.room.w + 6))})`, transformOrigin: "0 0" }}>{renderRoom(true)}</div>
      </div>
    </div>
  );
}

function AskBox({ chat, busy, onAsk, onApply, onReject }) {
  const [text, setText] = useState("");
  const logRef = useRef(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [chat]);
  return (
    <div className="aip">
      <div className="row"><b>AI に頼む</b><Chip>確かめてから反映</Chip></div>
      {chat.length > 0 ? (
        <div ref={logRef} className="sx-log">
          {chat.map((m, i) => (m.who === "me"
            ? <div key={i} className="sx-me">{m.text}</div>
            : (
              <div key={i} className="sx-ai">
                {m.text}
                {m.moves?.length > 0 && <div className="sx-mv">{m.moves.map((v, j) => <span key={j}>{v.label}</span>)}</div>}
                {m.moves?.length > 0 && (m.state === "applied" ? <Chip tone="ok">入れ替えました</Chip> : m.state === "rejected" ? <Chip>見送りました</Chip> : <span className="row"><Btn kind="sm" onClick={() => onApply(i)}>この案にする</Btn><Btn kind="ghost sm" onClick={() => onReject(i)}>やめる</Btn></span>)}
              </div>
            )))}
          {busy && <Chip>考えています</Chip>}
        </div>
      ) : <div className="row">{["前回同じ机の人を離す", "○○さんを前の席に", "○○さんと○○さんを別の机に"].map(t => <button key={t} type="button" className="chip qk" onClick={() => setText(t)}>{t}</button>)}</div>}
      <form className="row sx-nw" onSubmit={e => { e.preventDefault(); if (!text.trim()) return; onAsk(text); setText(""); }}>
        <input type="text" value={text} maxLength={400} placeholder="例：田中さんと山口さんは離したい" aria-label="AI に頼む" onChange={e => setText(e.target.value)} />
        <Btn kind="sm" type="submit" disabled={busy || !text.trim()}>送る</Btn>
      </form>
    </div>
  );
}

// 編集中の上の帯：選んだ机・設備（何も選んでいなければ教室）
function Props({ sel, setSel, layout, changeLayout, copySel, delSel, cleanAssignTo }) {
  const numIn = (value, onChange, label, min = 10) => <label className="lp">{label}<input type="number" min={min} step={10} value={value} onChange={e => onChange(Math.max(min, Number(e.target.value) || min))} /></label>;
  const tools = kind => <span className="lp-r"><Btn kind="ghost sm" onClick={copySel}>コピー</Btn><Btn kind="ghost sm" onClick={delSel}>消す</Btn>{kind === "f" && <Btn kind="ghost sm" onClick={() => changeLayout(n => { const f = n.fx.find(x => x.id === sel.id); const w = f.w; f.w = f.h; f.h = w; })}>縦横を入れ替え</Btn>}</span>;
  if (sel.type === "room") return <><b>教室</b>{numIn(layout.room.w, v => changeLayout(n => { n.room.w = Math.min(3000, Math.max(500, v)); }), "幅", 500)}{numIn(layout.room.h, v => changeLayout(n => { n.room.h = Math.min(1600, Math.max(300, v)); }), "奥行き", 300)}</>;
  if (sel.type === "f") {
    const f = layout.fx.find(x => x.id === sel.id); if (!f) return null;
    return <><b>設備</b><label className="lp">名前<input type="text" key={f.id} defaultValue={f.t} onBlur={e => changeLayout(n => { n.fx.find(x => x.id === f.id).t = e.target.value.trim() || "設備"; })} /></label>{numIn(f.w, v => changeLayout(n => { n.fx.find(x => x.id === f.id).w = v; }), "幅")}{numIn(f.h, v => changeLayout(n => { n.fx.find(x => x.id === f.id).h = v; }), "奥行き")}{tools("f")}</>;
  }
  const d = layout.desks.find(x => x.id === sel.id); if (!d) return null;
  return (
    <>
      <b>机 {d.id}</b>
      <label className="lp">名前<input type="text" key={d.id} defaultValue={d.id} maxLength={3} onBlur={e => { const v = e.target.value.trim(); if (!v || v === d.id || layout.desks.some(x => x.id === v)) return; changeLayout(n => { const x = n.desks.find(y => y.id === d.id); x.id = v; if (x.teacher) x.teacher = v + x.teacher.slice(d.id.length); }); setSel({ type: "d", id: v }); }} /></label>
      <SeatCtl d={d} changeLayout={changeLayout} cleanAssignTo={cleanAssignTo} />
      {numIn(d.w, v => changeLayout(n => { n.desks.find(x => x.id === d.id).w = v; }), "幅", 30)}{numIn(d.h, v => changeLayout(n => { n.desks.find(x => x.id === d.id).h = v; }), "奥行き", 30)}
      <label className="lp">講師の席<select className="in sx-in" value={d.teacher || ""} onChange={e => changeLayout(n => { n.desks.find(y => y.id === d.id).teacher = e.target.value; })}><option value="">なし</option>{seatsOf(d).map(s => <option key={s.id} value={s.id}>{s.id}</option>)}</select></label>
      {tools("d")}
    </>
  );
}

function SeatCtl({ d, changeLayout, cleanAssignTo }) {
  return [["L", "左"], ["R", "右"], ["T", "上"], ["B", "下"]].map(([k, l]) => (
    <label key={k} className="lp">{l}の席<select className="in sx-in" value={d[k]} onChange={e => { let next; changeLayout(n => { const x = n.desks.find(y => y.id === d.id); x[k] = Number(e.target.value); fitDesk(x); next = n.desks; }); setTimeout(() => cleanAssignTo(next), 0); }}>{[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
  ));
}

// 押した場所の横に小さく出す（右に入らなければ左。画面からはみ出さない）
function cardPos(at) {
  const vw = window.innerWidth, vh = window.innerHeight, w = Math.min(320, vw - 32), h = Math.min(420, vh - 96);
  if (!at || vw < 640) return { left: 16, right: 16, bottom: 76, maxHeight: Math.min(360, vh - 150) };
  let left = at.r + 12;
  if (left + w > vw - 16) left = Math.max(16, at.l - w - 12);
  return { left, top: Math.max(72, Math.min(at.y - 8, vh - h - 16)), width: w, maxHeight: h };
}

function FloatCard({ at, sel, setSel, layout, assign, pins, byId, prev, changeLayout, cleanAssignTo, togglePin }) {
  const boxRef = useRef(null);
  // 外を押したら閉じる（机・名前を押した場合は、その内容で開き直る）
  useEffect(() => {
    const onDown = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setSel(null); };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [setSel]);
  const shell = (title, sub, children) => (
    <aside ref={boxRef} data-seat-card className="sx-card" style={cardPos(at)} aria-label={title}>
      <div className="sx-ch"><div><small>{sub}</small><b>{title}</b></div><button type="button" className="x2" aria-label="閉じる" onClick={() => setSel(null)}>×</button></div>
      <div className="sx-cb">{children}</div>
    </aside>
  );
  const who = (q, extra) => <button key={q.id} type="button" className="sx-who" onClick={() => setSel({ type: "p", id: q.id })}><b>{q.name}</b><span className="row"><Chip tone="blue">実{q.impl}</Chip><Chip tone="ok">コ{q.comm}</Chip>{extra}</span></button>;
  if (sel.type === "d") {
    const d = layout.desks.find(x => x.id === sel.id); if (!d) return null;
    const st = deskStats(d, assign, byId, prev);
    return shell(`机 ${d.id}`, `${st.m.length} 人 ・ 席 ${d.L + d.R + d.T + d.B}`, <>
      <div className="row"><Chip>実装 {st.impl.toFixed(1)}</Chip><Chip>コミュ {st.comm.toFixed(1)}</Chip><Chip>女 {st.f} ・ 男 {st.ma}</Chip><Chip tone={st.again.length ? "bad" : "ok"}>前回と同じ {st.again.length}</Chip></div>
      <div className="sx-rs"><span className="eyebrow">この組み合わせの理由</span>{reasonsOf(st).map((r, i) => <p key={i}>{r}</p>)}</div>
      {st.m.length > 0 && <div><span className="eyebrow">座っている人</span>{st.m.map(q => who(q, prev[q.id] === d.id && <Chip tone="bad">前回同じ</Chip>))}</div>}
      <div className="sx-sc"><span className="eyebrow">席の数</span><SeatCtl d={d} changeLayout={changeLayout} cleanAssignTo={cleanAssignTo} /></div>
    </>);
  }
  const p = byId.get(sel.id); if (!p) return null;
  const seat = Object.keys(assign).find(k => assign[k] === p.id), desk = seat ? deskOfSeat(seat) : "";
  const deskObj = layout.desks.find(x => x.id === desk);
  const near = seat && deskObj ? deskStats(deskObj, assign, byId, prev).m.filter(q => q.id !== p.id) : [];
  return shell(p.name, p.kana, <>
    <div className="row"><Chip tone={p.mode === "online" ? "blue" : ""}>{p.mode === "online" ? "オンライン" : desk ? `机 ${desk}` : "未配置"}</Chip>{prev[p.id] && <Chip tone={desk && prev[p.id] === desk ? "bad" : ""}>前回 {prev[p.id]}</Chip>}<Chip>{GENDER_LABEL[p.gender] || "未設定"}</Chip></div>
    <div className="sx-kv"><span>実装力</span><span className="row sx-nw"><Level n={p.impl} tone="a" /><b className="num">{p.impl}</b>{p.manualImpl != null && <small>講師が設定</small>}</span><span>コミュ力</span><span className="row sx-nw"><Level n={p.comm} tone="b" /><b className="num">{p.comm}</b>{p.manualComm != null && <small>講師が設定</small>}</span></div>
    <div className="sx-rs"><span className="eyebrow">カルテから読んだこと</span>{p.reason ? <p>{p.reason}</p> : <Chip>未読み取り</Chip>}{p.sources && <small className="num">テスト {p.sources.tests} 件{p.sources.testAverage != null ? `（平均 ${p.sources.testAverage} 点）` : ""} ・ 日報 {p.sources.reports} 件 ・ 講師メモ {p.sources.notes} 件</small>}</div>
    {near.length > 0 && <div><span className="eyebrow">同じ机の人</span>{near.map(q => who(q))}</div>}
    {seat && <Btn kind="ghost sm" onClick={() => togglePin(p.id)}>{pins[p.id] ? "固定をやめる" : "この席に固定"}</Btn>}
  </>);
}
