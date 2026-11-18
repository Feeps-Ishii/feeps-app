import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "../../../../api.js";
import { admin, manage } from "../data.js";
import { TopicIcon, OTHER_TOPIC } from "../ui.jsx";
import "./materialScope.css";

/* 企業ごとの使える教材（2026-11-18、モック docs/design/mockups/tenolab-2026-09/tenolab-scope.html）
   単元 → コース（レッスン）・演習・案件体験の順にチェック。外した教材は「鍵つき」か「出さない」。
   保存するときは、いま見えている教材を全部 on / locked / hidden のどれかに入れる。
   どれにも入っていない教材（このあと足したもの）は「あとから足した教材」の設定に従う（初期値 出さない） */
const lessonKey = (courseId, lessonId) => `lesson:${courseId}/${lessonId}`;
const NEW_LABEL = [["on", "使える"], ["lock", "鍵つき"], ["hide", "出さない"]];

const LockIco = () => <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" /><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>;
const HideIco = () => <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3 3.4M6.6 6.6C4.3 8.2 3 12 3 12s4 6 9 6c1.6 0 3-.4 4.3-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;

// 3つの状態のチェック（indeterminate は属性で渡せないので ref で）
function Check({ checked, mixed, disabled, onChange, label }) {
  const ref = useCallback(el => { if (el) el.indeterminate = !!mixed; }, [mixed]);
  return <input ref={ref} type="checkbox" className="msc-ck" checked={!!checked} disabled={disabled} aria-label={label} onChange={onChange} onClick={e => e.stopPropagation()} />;
}

// 教材の一覧（公開中のものだけ）を単元ごとに
async function loadCatalog() {
  const [courses, drills, cases] = await Promise.all([apiGet("/learning/courses"), manage.list("drills"), manage.list("cases")]);
  const cs = await Promise.all((courses || []).map(async c => {
    const id = c.courseId || c.id;
    const ls = await apiGet(`/learning/courses/${encodeURIComponent(id)}/lessons`);
    return { id, title: c.title || "", topic: c.topic || "", lessons: (ls || []).map(l => ({ id: l.id || l.lessonId, title: l.title || "" })) };
  }));
  const pub = r => (r.items || []).filter(x => x.published).map(x => ({ id: x.id, title: x.title || x.id, topic: x.topic || "", order: Number(x.order || 0) }));
  return { courses: cs, drills: pub(drills), cases: pub(cases) };
}

export default function MaterialScope({ companyId, topics }) {
  const [cat, setCat] = useState({ state: "loading", data: null });
  const [scope, setScope] = useState(null); // { mode, on:Set, locked:Set, hidden:Set, newItems, saved:Set }
  const [open, setOpen] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: "", text: "" });

  const load = useCallback(() => {
    setCat({ state: "loading", data: null });
    Promise.all([loadCatalog(), admin.scope(companyId)]).then(([data, r]) => {
      const s = r?.scope || {};
      const saved = new Set([...(s.on || []), ...(s.locked || []), ...(s.hidden || [])]);
      setCat({ state: "ready", data });
      setScope({ mode: s.mode === "pick" ? "pick" : "all", on: new Set(s.on || []), locked: new Set(s.locked || []), hidden: new Set(s.hidden || []), newItems: s.newItems || "hide", saved, everSaved: !!r?.updatedAt });
    }).catch(() => setCat({ state: "error", data: null }));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  // 単元ごとのまとまり（登録した単元の順、知らない単元は「その他」）
  const groups = useMemo(() => {
    if (!cat.data) return [];
    const list = [...(topics || []), OTHER_TOPIC];
    const known = new Set((topics || []).map(t => t.id));
    const tid = x => (known.has(x.topic) ? x.topic : OTHER_TOPIC.id);
    return list.map(t => {
      const courses = cat.data.courses.filter(c => tid(c) === t.id).map(c => ({ ...c, keys: c.lessons.map(l => lessonKey(c.id, l.id)) }));
      const drills = cat.data.drills.filter(d => tid(d) === t.id).sort((a, b) => a.order - b.order).map(d => ({ ...d, key: `drill:${d.id}` }));
      const cases = cat.data.cases.filter(d => tid(d) === t.id).sort((a, b) => a.order - b.order).map(d => ({ ...d, key: `case:${d.id}` }));
      const lessonKeys = courses.flatMap(c => c.keys);
      return { topic: t, courses, drills, cases, lessonKeys, drillKeys: drills.map(d => d.key), caseKeys: cases.map(d => d.key), all: [...lessonKeys, ...drills.map(d => d.key), ...cases.map(d => d.key)] };
    }).filter(g => g.all.length || g.topic.id !== OTHER_TOPIC.id);
  }, [cat.data, topics]);
  const everyKey = useMemo(() => groups.flatMap(g => g.all), [groups]);

  if (cat.state === "loading" || !scope) return <p className="muted">読み込んでいます…</p>;
  if (cat.state === "error") return <div className="card flat" style={{ padding: 16 }} role="alert">読み込めませんでした。 <button type="button" className="btn ghost" onClick={load}>もう一度</button></div>;

  // 「すべて」のときは全部使える。保存したことがなく「選んだものだけ」に切り替えたときは全部使える状態から始める
  const status = k => {
    if (scope.mode === "all") return "on";
    if (scope.on.has(k)) return "on";
    if (scope.locked.has(k)) return "lock";
    if (scope.hidden.has(k)) return "hide";
    return scope.newItems;
  };
  const isNew = k => scope.mode === "pick" && scope.everSaved && !scope.saved.has(k);
  const cnt = ks => ks.filter(k => status(k) === "on").length;
  const pick = scope.mode === "pick";
  const update = fn => setScope(s => {
    const n = { ...s, on: new Set(s.on), locked: new Set(s.locked), hidden: new Set(s.hidden) };
    fn(n); return n;
  });
  const setStatus = (n, k, st) => { n.on.delete(k); n.locked.delete(k); n.hidden.delete(k); (st === "on" ? n.on : st === "lock" ? n.locked : n.hidden).add(k); };
  // まとめて：全部使えるなら全部外す（外したものは鍵つき）、そうでなければ全部使える
  const toggle = ks => update(n => {
    const allOn = ks.every(k => status(k) === "on");
    ks.forEach(k => setStatus(n, k, allOn ? (status(k) === "hide" ? "hide" : "lock") : "on"));
  });
  const offOf = ks => ks.filter(k => status(k) !== "on");
  const lockState = ks => { const off = offOf(ks), n = off.filter(k => status(k) === "lock").length; return { checked: off.length > 0 && n === off.length, mixed: n > 0 && n < off.length, disabled: !pick || !off.length }; };
  const setLock = (ks, show) => update(n => offOf(ks).forEach(k => setStatus(n, k, show ? "lock" : "hide")));
  const checkState = ks => { const n = cnt(ks); return { checked: ks.length > 0 && n === ks.length, mixed: n > 0 && n < ks.length, disabled: !pick || !ks.length }; };

  function setMode(mode) {
    if (mode === scope.mode) return;
    update(n => {
      n.mode = mode;
      // 初めて「選んだものだけ」にしたときは、全部使える状態から外していく
      if (mode === "pick" && !n.on.size && !n.locked.size && !n.hidden.size) everyKey.forEach(k => n.on.add(k));
    });
  }
  async function save() {
    setBusy(true); setMsg({ kind: "", text: "" });
    // いま見えている教材は全部どれかに入れる（入っていないもの＝このあと足した教材）
    const on = [], locked = [], hidden = [];
    for (const k of everyKey) { const st = status(k); (st === "on" ? on : st === "lock" ? locked : hidden).push(k); }
    try {
      const r = await admin.saveScope(companyId, scope.mode === "pick" ? { mode: "pick", on, locked, hidden, newItems: scope.newItems } : { mode: "all", newItems: scope.newItems });
      setScope(s => ({ ...s, saved: new Set([...(r.scope?.on || []), ...(r.scope?.locked || []), ...(r.scope?.hidden || [])]), everSaved: true }));
      setMsg({ kind: "ok", text: "保存しました。" });
    } catch (e) {
      setMsg({ kind: "ng", text: e?.errorMessage || "保存できませんでした。" });
    } finally { setBusy(false); }
  }

  const sum = f => groups.reduce((a, g) => [a[0] + cnt(g[f]), a[1] + g[f].length], [0, 0]);
  const [l1, l2] = sum("lessonKeys"), [d1, d2] = sum("drillKeys"), [c1, c2] = sum("caseKeys");
  const unitsOn = groups.filter(g => cnt(g.all) > 0).length;
  const lockAll = lockState(everyKey);

  const Item = ({ k, label, meta }) => {
    const st = status(k);
    return (
      <label className={`msc-item ${st === "on" ? "" : "off"}`}>
        <Check checked={st === "on"} disabled={!pick} label={label} onChange={() => update(n => setStatus(n, k, st === "on" ? "lock" : "on"))} />
        <span className="t">{label}</span>
        {isNew(k) && <span className="chip msc-new">新しい</span>}
        {st !== "on" && <button type="button" className={`msc-lk ${st === "hide" ? "hide" : ""}`} disabled={!pick} onClick={e => { e.preventDefault(); update(n => setStatus(n, k, st === "hide" ? "lock" : "hide")); }}>{st === "hide" ? <><HideIco />出さない</> : <><LockIco />鍵つき</>}</button>}
        {meta && <span className="meta">{meta}</span>}
      </label>
    );
  };
  const Col = ({ title, ks, empty, children }) => {
    const c = checkState(ks);
    return (
      <div className="msc-col">
        <div className="msc-colh"><Check {...c} label={`${title}をまとめて`} onChange={() => toggle(ks)} /><h3>{title}</h3><span className="n">{cnt(ks)} / {ks.length}</span></div>
        {ks.length ? children : <p className="msc-empty">{empty}</p>}
      </div>
    );
  };

  return (
    <div className="mscope">
      <div className="card msc-bar">
        <div className="msc-seg" role="group" aria-label="範囲">
          <button type="button" aria-pressed={!pick} onClick={() => setMode("all")}>すべて</button>
          <button type="button" aria-pressed={pick} onClick={() => setMode("pick")}>選んだものだけ</button>
        </div>
        <div className="msc-totals">
          <span>単元 <b>{pick ? unitsOn : groups.length}</b><small> / {groups.length}</small></span>
          <span>レッスン <b>{l1}</b><small> / {l2}</small></span>
          <span>演習 <b>{d1}</b><small> / {d2}</small></span>
          <span>案件体験 <b>{c1}</b><small> / {c2}</small></span>
        </div>
        <div className="msc-opts">
          <label className="msc-opt"><Check {...lockAll} label="外した教材を鍵つきで見せる" onChange={e => setLock(everyKey, e.target.checked)} />外した教材を鍵つきで見せる</label>
          <span className="msc-opt">あとから足した教材
            <span className="msc-seg sm" role="group" aria-label="あとから足した教材">
              {NEW_LABEL.map(([k, l]) => <button key={k} type="button" aria-pressed={scope.newItems === k} disabled={!pick} onClick={() => update(n => { n.newItems = k; })}>{l}</button>)}
            </span>
          </span>
          <button type="button" className="btn" onClick={save} disabled={busy}>{busy ? "保存しています…" : "保存"}</button>
        </div>
      </div>
      {msg.text && <div className={`verdict ${msg.kind}`} role={msg.kind === "ng" ? "alert" : "status"}>{msg.text}</div>}

      <div className="msc-topics">
        {groups.map(g => {
          const t = g.topic, n = cnt(g.all), isOpen = open.has(t.id);
          const state = !g.all.length ? ["", "教材なし"] : n === g.all.length ? ["done", "すべて"] : n ? ["warn", "一部"] : ["", "なし"];
          const lk = lockState(g.all);
          const flip = () => setOpen(o => { const x = new Set(o); x.has(t.id) ? x.delete(t.id) : x.add(t.id); return x; });
          return (
            <article key={t.id} className={`card msc-topic ${isOpen ? "open" : ""} ${g.all.length && !n ? "is-off" : ""}`}>
              <div className="msc-head" onClick={flip}>
                <button type="button" className="msc-chev" aria-expanded={isOpen} aria-label={`${t.name}を開く`} onClick={e => { e.stopPropagation(); flip(); }}><svg width="14" height="14" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                <Check {...checkState(g.all)} label={t.name} onChange={() => toggle(g.all)} />
                <TopicIcon topic={t} size={40} />
                <span className="msc-name"><b>{t.name}</b><small>{t.sub || ""}</small></span>
                <span className="msc-count"><span>レッスン <b>{cnt(g.lessonKeys)}</b>/{g.lessonKeys.length}</span><span>演習 <b>{cnt(g.drillKeys)}</b>/{g.drillKeys.length}</span><span>案件 <b>{cnt(g.caseKeys)}</b>/{g.caseKeys.length}</span></span>
                <label className={`msc-lockck ${lk.disabled ? "na" : ""}`} onClick={e => e.stopPropagation()}><Check {...lk} label={`${t.name}の外した教材を鍵つきで見せる`} onChange={e => setLock(g.all, e.target.checked)} /><LockIco />鍵つきで見せる</label>
                <span className={`chip ${state[0]}`}>{state[1]}</span>
              </div>
              {isOpen && (
                <div className="msc-body">
                  <Col title="コース" ks={g.lessonKeys} empty="コースなし">
                    {g.courses.map(c => {
                      const cs = checkState(c.keys);
                      return (
                        <div key={c.id} className="msc-course">
                          <label className="msc-item strong"><Check {...cs} label={c.title} onChange={() => toggle(c.keys)} /><span className="t">{c.title}</span><span className="meta">{cnt(c.keys)} / {c.keys.length}</span></label>
                          <div className="msc-lessons">{c.lessons.map((l, i) => <Item key={l.id} k={c.keys[i]} label={l.title} meta={`L${i + 1}`} />)}</div>
                        </div>
                      );
                    })}
                  </Col>
                  <Col title="演習" ks={g.drillKeys} empty="演習なし">{g.drills.map(d => <Item key={d.key} k={d.key} label={d.title} />)}</Col>
                  <Col title="案件体験" ks={g.caseKeys} empty="案件体験なし">{g.cases.map(d => <Item key={d.key} k={d.key} label={d.title} />)}</Col>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
