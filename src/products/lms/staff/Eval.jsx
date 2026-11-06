import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { Btn, Card, Chip, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, errText, md, saveXlsx, usePins, useRoster, useStaffCourse, useStats } from "./common.js";

/* 評価表（モック evalX）：回ごと。講師は左にメモ、右に AI の下書き（項目ごとの文と点。直してから企業担当者に出す）。
   企業担当者は公開した回だけ読む（点の推移と一人ずつの文）。保存は少し待ってまとめて送る */

const G = { com: "コミュニケーション面", tech: "技術面" };
const SAVE_DELAY = 1000;
const sumOf = (c, items, g) => {
  const its = items.filter(x => !g || x.group === g);
  const got = its.map(x => { const v = c?.sc?.[x.id]; return v === "" || v == null ? null : Math.min(Number(v), x.max); }).filter(v => v != null && Number.isFinite(v));
  return { got: got.reduce((a, v) => a + v, 0), max: its.reduce((a, x) => a + Number(x.max), 0), n: got.length, all: its.length };
};

function ClientView({ doc, people, pins, course }) {
  const pub = doc.rounds.filter(r => r.publishedAt);
  const [sel, setSel] = useState(pub[pub.length - 1]?.id || doc.rounds[0]?.id);
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("pin");
  const round = doc.rounds.find(r => r.id === sel) || doc.rounds[0];
  const T = id => sumOf(doc.cells[round?.id]?.[id], doc.items).got;
  const key = p => p.kana || p.name;
  const by = { pin: (a, b) => Number(pins.has(b.id)) - Number(pins.has(a.id)) || key(a).localeCompare(key(b), "ja"), hi: (a, b) => T(b.id) - T(a.id), lo: (a, b) => T(a.id) - T(b.id), kana: (a, b) => key(a).localeCompare(key(b), "ja") }[sort];
  const list = people.filter(p => (tab === "all" || pins.has(p.id)) && matchName(p.name, p.kana, q)).sort(by);
  const xlsx = () => saveXlsx(`評価表_${course.name}`, "評価表", [["受講生", ...pub.map(r => r.name)], ...list.map(p => [p.name, ...pub.map(r => { const s = sumOf(doc.cells[r.id]?.[p.id], doc.items); return s.n ? `${s.got}/${s.max}` : ""; })])]);
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{course.name}</div><h1 className="h1">評価表</h1></div><span className="r"><Btn kind="ghost sm" disabled={!pub.length} onClick={xlsx}>Excel で受け取る</Btn></span></div>
      <div className="evrd">
        {doc.rounds.map(r => <button key={r.id} type="button" className={`card evrdc${r.id === round?.id ? " on" : ""}`} onClick={() => setSel(r.id)}><span className="eyebrow">{r.from ? `${md(r.from)}〜${md(r.to)}` : ""}</span><b>{r.name}</b>{r.publishedAt ? <Chip tone="ok">公開 {md(r.publishedAt)}</Chip> : <Chip>公開待ち</Chip>}</button>)}
      </div>
      <ListTool tabs={[["all", "すべて", people.length], ["pin", "担当", people.filter(p => pins.has(p.id)).length, "ok"]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["pin", "担当を上に"], ["hi", "点の高い順"], ["lo", "点の低い順"], ["kana", "名前順"]]} sort={sort} onSort={setSort} />
      <Card className="pad">
        <div className="head"><h2 className="h3">これまでの評価</h2><span className="r"><Chip>合計点</Chip></span></div>
        <div className="scroll"><table className="tbl evh"><thead><tr><th>受講生</th>{doc.rounds.map(r => <th key={r.id} className={r.id === round?.id ? "on" : ""}>{r.name}</th>)}</tr></thead><tbody>
          {list.map(p => <tr key={p.id}><td><b>{pins.has(p.id) && <i className="pinm">✓</i>}{p.name}</b></td>{doc.rounds.map(r => { const s = sumOf(doc.cells[r.id]?.[p.id], doc.items); return <td key={r.id} className={r.id === round?.id ? "on" : ""}>{r.publishedAt && s.n ? <button type="button" className="evh-b" onClick={() => { setSel(r.id); document.getElementById(`evc-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}><b className="num">{s.got}</b><small> / {s.max}</small></button> : <span className="evh-w">{r.publishedAt ? "—" : "公開待ち"}</span>}</td>; })}</tr>)}
        </tbody></table></div>
      </Card>
      {round?.publishedAt ? (
        <div className="evc">
          {list.map(p => {
            const c = doc.cells[round.id]?.[p.id], t = sumOf(c, doc.items);
            return (
              <Card key={p.id} className="pad evcc" id={`evc-${p.id}`}>
                <div className="head"><span className="face">{p.name.slice(0, 1)}</span><h3 className="h3">{p.name}</h3><span className="r"><b className="num evct">{t.got}</b><small>/ {t.max} 点</small></span></div>
                {["com", "tech"].map(g => { const u = sumOf(c, doc.items, g); return <div key={g} className={`evg ${g}`}><span className="evgh">{G[g]}<em className="num">小計 {u.got} / {u.max}</em></span>{doc.items.filter(x => x.group === g).map(it => <div key={it.id} className="evo"><span className="evoh"><b>{it.name}</b><span className="num">{c?.sc?.[it.id] ?? "—"} / {it.max}</span></span><p>{c?.out?.[it.id] || ""}</p></div>)}</div>; })}
              </Card>
            );
          })}
        </div>
      ) : <Card><div className="empty"><Chip>{round?.name} は公開待ち</Chip></div></Card>}
    </div>
  );
}

function SettingModal({ doc, onClose, onSave }) {
  const [rounds, setRounds] = useState(doc.rounds.map(r => ({ ...r })));
  const [items, setItems] = useState(doc.items.map(x => ({ ...x })));
  const setR = (i, k, v) => setRounds(l => l.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const setI = (i, k, v) => setItems(l => l.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <Modal title="回と項目の設定" width={640} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn onClick={() => onSave({ rounds, items })}>決める</Btn></>}>
      <span className="eyebrow">評価の回</span>
      {rounds.map((r, i) => <div key={r.id} className="ev-sr"><input type="text" aria-label="回の名前" value={r.name} onChange={e => setR(i, "name", e.target.value)} /><input type="date" aria-label="始まり" value={r.from} onChange={e => setR(i, "from", e.target.value)} /><input type="date" aria-label="終わり" value={r.to} onChange={e => setR(i, "to", e.target.value)} /><Btn kind="ghost sm" onClick={() => setRounds(l => l.filter((_, j) => j !== i))}>消す</Btn></div>)}
      <span><Btn kind="ghost sm" onClick={() => setRounds(l => [...l, { id: `r${Date.now()}`, name: `第${l.length + 1}回`, from: "", to: "", publishedAt: "" }])}>回を足す</Btn></span>
      <span className="eyebrow">項目</span>
      {items.map((x, i) => <div key={x.id} className="ev-si"><input type="text" aria-label="項目の名前" value={x.name} onChange={e => setI(i, "name", e.target.value)} /><select className="in" aria-label="面" value={x.group} onChange={e => setI(i, "group", e.target.value)}><option value="com">{G.com}</option><option value="tech">{G.tech}</option></select><select className="in" aria-label="満点" value={x.max} onChange={e => setI(i, "max", Number(e.target.value))}>{[3, 4, 5, 10, 100].map(n => <option key={n} value={n}>{n} 点</option>)}</select><Btn kind="ghost sm" onClick={() => setItems(l => l.filter((_, j) => j !== i))}>消す</Btn></div>)}
      <span className="row"><Btn kind="ghost sm" onClick={() => setItems(l => [...l, { id: `i${Date.now()}`, name: "", group: "tech", max: 5 }])}>＋ 技術の項目</Btn><Btn kind="ghost sm" onClick={() => setItems(l => [...l, { id: `i${Date.now()}`, name: "", group: "com", max: 5 }])}>＋ コミュニケーションの項目</Btn></span>
    </Modal>
  );
}

function StaffView({ initial, people, stats, courseId, course, say }) {
  const [doc, setDoc] = useState(initial);
  const [rid, setRid] = useState(() => { const un = initial.rounds.find(r => !r.publishedAt); return un?.id || initial.rounds[initial.rounds.length - 1]?.id; });
  const [sel, setSel] = useState(people[0]?.id || "");
  const [busy, setBusy] = useState(""); // draft:<id> | all
  const [save, setSave] = useState("");
  const [err, setErr] = useState("");
  const [setting, setSetting] = useState(false);
  const [pub, setPub] = useState(false);
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("kana");
  const version = useRef(initial.updatedAt);
  const pending = useRef(null);
  const timer = useRef(0);
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    setSave("saving");
    try {
      const r = await apiPut("/evaluations", { courseId, expectedUpdatedAt: version.current, ...p });
      version.current = r.updatedAt;
      setSave("ok"); setErr("");
    } catch (e) {
      setSave("err");
      setErr(e?.code === "stale_update" || /stale|ほかの人/.test(errText(e, "")) ? "ほかの人が先に直しました。読み直してください" : errText(e, "保存できませんでした"));
    }
  }, [courseId]);
  useEffect(() => () => { flush(); }, [flush]);
  const queue = patch => {
    const cur = pending.current || {};
    const cells = patch.cells ? { ...(cur.cells || {}) } : cur.cells;
    if (patch.cells) Object.entries(patch.cells).forEach(([r, m]) => { cells[r] = { ...(cells[r] || {}), ...m }; });
    pending.current = { ...cur, ...patch, ...(cells ? { cells } : {}) };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY);
  };
  const cellOf = (r, id) => doc.cells[r]?.[id] || { com: "", tech: "", gen: 0, out: {}, sc: {} };
  const setCell = (id, patch) => {
    const next = { ...cellOf(rid, id), ...patch };
    setDoc(d => ({ ...d, cells: { ...d.cells, [rid]: { ...(d.cells[rid] || {}), [id]: next } } }));
    queue({ cells: { [rid]: { [id]: next } } });
  };
  const draft = async p => {
    const c = cellOf(rid, p.id);
    if (!c.com.trim() && !c.tech.trim()) { setErr("コミュニケーション面か技術面を書いてください"); return false; }
    const st = arr(stats?.trainees).find(t => t.id === p.id);
    const r = await apiPost("/evaluations/draft", { courseId, traineeName: p.name, com: c.com, tech: c.tech, testAverage: st?.testAverage ?? "" });
    const sc = { ...r.sc, ...Object.fromEntries(Object.entries(c.sc || {}).filter(([, v]) => v !== "" && v != null)) };
    setCell(p.id, { gen: 2, out: r.out, sc });
    return true;
  };
  const one = async p => {
    setBusy(`draft:${p.id}`); setErr("");
    try { await draft(p); } catch (e) { setErr(errText(e, "下書きを作れませんでした")); } finally { setBusy(""); }
  };
  const all = async () => {
    setBusy("all"); setErr("");
    let n = 0;
    try {
      for (const p of people) {
        const c = cellOf(rid, p.id);
        if (c.gen !== 2 && (c.com.trim() || c.tech.trim())) { await draft(p); n += 1; } // eslint-disable-line no-await-in-loop
      }
      say?.(`${n} 人分を下書きしました`);
    } catch (e) { setErr(errText(e, "下書きを作れませんでした")); } finally { setBusy(""); }
  };
  const round = doc.rounds.find(r => r.id === rid) || doc.rounds[0];
  const publish = v => {
    const rounds = doc.rounds.map(r => (r.id === round.id ? { ...r, publishedAt: v ? new Date().toISOString() : "" } : r));
    setDoc(d => ({ ...d, rounds }));
    queue({ rounds });
    flush();
    setPub(false);
    say?.(v ? "企業担当者に出しました" : "公開をやめました");
  };
  const done = people.filter(p => cellOf(rid, p.id).gen === 2).length;
  const cur = people.find(p => p.id === sel) || people[0];
  const c = cur ? cellOf(rid, cur.id) : null;
  const total = c ? sumOf(c, doc.items) : null;
  const key = p => p.kana || p.name;
  const tot = id => sumOf(cellOf(rid, id), doc.items).got;
  const state = p => (cellOf(rid, p.id).gen === 2 ? "done" : cellOf(rid, p.id).com || cellOf(rid, p.id).tech ? "memo" : "none");
  const list = people.filter(p => (tab === "all" || state(p) === tab) && matchName(p.name, p.kana, q)).sort({ kana: (a, b) => key(a).localeCompare(key(b), "ja"), hi: (a, b) => tot(b.id) - tot(a.id), lo: (a, b) => tot(a.id) - tot(b.id) }[sort]);
  const stChip = p => { const s = state(p); if (s === "done") { const t = sumOf(cellOf(rid, p.id), doc.items); return <Chip tone="ok">{t.got} / {t.max} 点</Chip>; } return s === "memo" ? <Chip tone="warn">メモだけ</Chip> : <Chip>まだ</Chip>; };
  const scoreInput = it => {
    const v = c.sc?.[it.id] ?? "";
    const on = e => setCell(cur.id, { sc: { ...c.sc, [it.id]: e.target.value === "" ? "" : Number(e.target.value) } });
    return <span className="evsc">{it.max > 10 ? <input type="number" min="0" max={it.max} value={v} aria-label={`${it.name} の点`} onChange={on} /> : <select value={v} aria-label={`${it.name} の点`} onChange={on}><option value="">—</option>{Array.from({ length: it.max }, (_, k) => it.max - k).map(n => <option key={n} value={n}>{n}</option>)}</select>}<small>/ {it.max}</small></span>;
  };
  return (
    <div className="st">
      <div className="head">
        <div><div className="eyebrow">{course.name}</div><h1 className="h1">評価表</h1></div>
        <span className="r">
          <span className="seg">{doc.rounds.map(r => <button key={r.id} type="button" aria-pressed={r.id === round?.id} onClick={() => { flush(); setRid(r.id); }}>{r.name}</button>)}</span>
          <Btn kind="ghost sm" onClick={() => setSetting(true)}>回と項目の設定</Btn>
          {round?.publishedAt ? <><Chip tone="ok">企業担当者に出しました</Chip><Btn kind="ghost sm" onClick={() => publish(false)}>公開をやめる</Btn></> : <Btn kind="sm" onClick={() => setPub(true)}>企業担当者に出す</Btn>}
        </span>
      </div>
      <div className="row">
        <Chip tone="mk">{round?.name}{round?.from ? ` ・ ${md(round.from)}〜${md(round.to)}` : ""}</Chip>
        <Chip tone={done === people.length && done > 0 ? "ok" : "warn"}>下書き {done} / {people.length} 人</Chip>
        <span className="evleg">{["com", "tech"].map(g => <span key={g} className={`evk ${g}`}><i />{G[g]} {doc.items.filter(x => x.group === g).length} 項目</span>)}<span className="evk tot">満点 {doc.items.reduce((a, x) => a + Number(x.max), 0)} 点</span></span>
        {save === "saving" && <Chip>保存しています</Chip>}{save === "ok" && <Chip tone="ok">保存しました</Chip>}
      </div>
      {err && <div className="lms-err" role="alert">{err}{save === "err" && <> <Btn kind="ghost sm" onClick={() => window.location.reload()}>読み直す</Btn></>}</div>}
      <ListTool tabs={[["all", "すべて", people.length], ["none", "まだ", people.filter(p => state(p) === "none").length, "warn"], ["memo", "メモだけ", people.filter(p => state(p) === "memo").length], ["done", "下書き済み", done, "ok"]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["kana", "名前順"], ["hi", "点の高い順"], ["lo", "点の低い順"]]} sort={sort} onSort={setSort} />
      <div className="evw">
        <Card className="pad evlc">
          <div className="head"><h2 className="h3">講師のメモ</h2><span className="r"><Btn kind="ghost sm" disabled={!!busy} onClick={all}>{busy === "all" ? "下書きしています" : "全員を AI で下書き"}</Btn></span></div>
          <div className="evl">
            {list.map(p => {
              const x = cellOf(rid, p.id);
              return (
                <div key={p.id} className={`evr${p.id === cur?.id ? " on" : ""}`}>
                  <button type="button" className="evn" onClick={() => setSel(p.id)}><span className="face">{p.name.slice(0, 1)}</span><b>{p.name}</b>{stChip(p)}</button>
                  <div className="evin">
                    <label className="evta com"><span>{G.com}</span><textarea rows={3} value={x.com} placeholder="人柄・話し方・報連相など、気づいたことを箇条書きで" onFocus={() => setSel(p.id)} onChange={e => setCell(p.id, { com: e.target.value })} /></label>
                    <label className="evta tech"><span>{G.tech}</span><textarea rows={3} value={x.tech} placeholder="正確さ・理解・つまずき方など" onFocus={() => setSel(p.id)} onChange={e => setCell(p.id, { tech: e.target.value })} /></label>
                  </div>
                </div>
              );
            })}
            {!list.length && <Chip>見つかりません</Chip>}
          </div>
        </Card>
        {cur && (
          <Card className="pad evrc">
            <div className="head"><span className="face">{cur.name.slice(0, 1)}</span><div><h2 className="h3">{cur.name}</h2><small className="dv-mt">{round?.name} の報告文</small></div><span className="r"><Btn kind={c.gen === 2 ? "ghost sm" : "sm"} disabled={!!busy} onClick={() => one(cur)}>{busy === `draft:${cur.id}` ? "書いています" : c.gen === 2 ? "もう一度下書き" : "AI で下書き"}</Btn></span></div>
            {c.gen === 2 ? (
              <>
                <div className="evtot"><span>合計</span><b className="num">{total.got}</b><small>/ {total.max} 点</small>{total.n < total.all && <Chip tone="warn">点がまだ {total.all - total.n} 項目</Chip>}<span className="evbar"><i style={{ "--w": `${total.max ? Math.round(total.got / total.max * 100) : 0}%` }} /></span></div>
                {["com", "tech"].map(g => { const t = sumOf(c, doc.items, g); return <div key={g} className={`evg ${g}`}><span className="evgh">{G[g]}<em className="num">小計 {t.got} / {t.max}</em></span>{doc.items.filter(x => x.group === g).map(it => <div key={it.id} className="evo"><span className="evoh"><b>{it.name}</b>{scoreInput(it)}</span><textarea rows={3} aria-label={`${it.name} の報告文`} value={c.out?.[it.id] || ""} onChange={e => setCell(cur.id, { out: { ...c.out, [it.id]: e.target.value } })} /></div>)}</div>; })}
                {list.indexOf(cur) >= 0 && list.indexOf(cur) < list.length - 1 && <span className="row st-end"><Btn kind="ghost sm" onClick={() => setSel(list[list.indexOf(cur) + 1].id)}>次の人 ›</Btn></span>}
              </>
            ) : <div className="empty"><Chip>左にメモを書いて AI で下書き</Chip></div>}
          </Card>
        )}
      </div>
      {setting && <SettingModal doc={doc} onClose={() => setSetting(false)} onSave={({ rounds, items }) => { setDoc(d => ({ ...d, rounds, items })); queue({ rounds, items }); flush(); setSetting(false); if (!rounds.some(r => r.id === rid)) setRid(rounds[0]?.id); }} />}
      {pub && <Modal title="企業担当者に出しますか？" width={440} onClose={() => setPub(false)} footer={<><Btn kind="ghost" onClick={() => setPub(false)}>やめる</Btn><Btn onClick={() => publish(true)}>出す</Btn></>}>
        <div className="row"><Chip tone="mk">{round?.name}</Chip><Chip>受講生 {people.length} 人</Chip>{done < people.length && <Chip tone="warn">下書きがまだ {people.length - done} 人</Chip>}</div>
      </Modal>}
    </div>
  );
}

export default function StaffEval({ role, say }) {
  const ro = role === "client";
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const { list: roster, reload } = useRoster(courseId);
  const stats = useStats(ro ? "" : courseId);
  const { pins } = usePins(ro);
  const [st, setSt] = useState({ state: "loading", doc: null });
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!courseId) return undefined;
    let alive = true;
    setSt({ state: "loading", doc: null });
    apiGet(`/evaluations?courseId=${encodeURIComponent(courseId)}`).then(doc => { if (alive) setSt({ state: "ready", doc }); }).catch(() => { if (alive) setSt({ state: "error", doc: null }); });
    return () => { alive = false; };
  }, [courseId, key]);
  const people = useMemo(() => roster || [], [roster]);
  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>評価表</b><Chip>コースなし</Chip></div></Card>;
  if (st.state === "error" || roster === null) return <Card><div className="empty"><b>評価表を確認できません</b><Btn kind="ghost sm" onClick={() => { reload(); setKey(k => k + 1); }}>再読み込み</Btn></div></Card>;
  if (st.state === "loading" || roster === undefined) return <div className="soon card">読み込み中</div>;
  return ro ? <ClientView doc={st.doc} people={people} pins={pins} course={sc.course} /> : <StaffView key={courseId} initial={st.doc} people={people} stats={stats.data} courseId={courseId} course={sc.course} say={say} />;
}
