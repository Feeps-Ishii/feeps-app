import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as A from "../studio/api.js";
import { manage } from "../data.js";
import { TopicIcon } from "../ui.jsx";
import { PublishResult, confirmPublish, needsPublish, publishMany } from "./publishParts.jsx";
import "./materialsByTopic.css";

/* 教材 › 単元ごと（2026-11-18、モック docs/design/mockups/tenolab-2026-09/tenolab-scope.html「教材を単元で整理」）
   左に単元、右にその単元のコース・演習・案件体験。ドラッグで並べかえ（演習・案件体験）、選んで別の単元へ移す。
   単元と並び順は PUT /tenolab/manage/arrange で、公開し直さなくてもすぐ受講生の一覧に効く */
const NONE = { id: "", name: "単元なし", sub: "どこにも入っていない", color: "#767D8C", soft: "#F2F3EE" };
const KINDS = [["courses", "コース", "コースを作る"], ["drills", "演習", "演習を作る"], ["cases", "案件体験", "案件体験を作る"]];

function courseState(c) {
  if (!c.published) return ["下書き", ""];
  if (c.contentUpdatedAt && c.publishedAt && c.contentUpdatedAt > c.publishedAt) return ["未公開の変更あり", "warn"];
  return ["公開中", "done"];
}
const itemState = x => (x.published ? (x.changed ? ["未公開の変更あり", "warn"] : ["公開中", "done"]) : ["下書き", ""]);
const Grip = () => <span className="mbt-grip" aria-hidden="true"><svg width="12" height="16" viewBox="0 0 12 16"><g fill="currentColor"><circle cx="3" cy="3" r="1.5" /><circle cx="9" cy="3" r="1.5" /><circle cx="3" cy="8" r="1.5" /><circle cx="9" cy="8" r="1.5" /><circle cx="3" cy="13" r="1.5" /><circle cx="9" cy="13" r="1.5" /></g></svg></span>;

export default function MaterialsByTopic({ topics, go }) {
  const [st, setSt] = useState({ state: "loading", courses: [], drills: [], cases: [] });
  const [cur, setCur] = useState(() => topics?.[0]?.id || "");
  const [q, setQ] = useState("");
  const [onlyDraft, setOnlyDraft] = useState(false);
  const [busy, setBusy] = useState("");
  const [res, setRes] = useState(null);
  const [msg, setMsg] = useState("");
  const [drag, setDrag] = useState(null); // { kind, id }
  const [over, setOver] = useState("");

  const load = useCallback(() => {
    setSt(s => ({ ...s, state: s.courses.length || s.drills.length ? "ready" : "loading" }));
    Promise.all([A.listCourses(), manage.list("drills"), manage.list("cases")]).then(([cs, ds, ks]) => {
      setSt({
        state: "ready",
        courses: (Array.isArray(cs) ? cs : []).filter(c => !c.deleted).map(c => ({ ...c, id: c.id || c.courseId, topic: c.topic || "" })),
        drills: (ds.items || []).map(x => ({ ...x, topic: x.topic || "", order: Number(x.order || 0) })),
        cases: (ks.items || []).map(x => ({ ...x, topic: x.topic || "", order: Number(x.order || 0) })),
      });
    }).catch(() => setSt(s => ({ ...s, state: "error" })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const known = useMemo(() => new Set((topics || []).map(t => t.id)), [topics]);
  const tid = x => (known.has(x.topic) ? x.topic : "");
  const sortOrd = (a, b) => (a.order - b.order) || String(a.title).localeCompare(String(b.title), "ja");
  const inTopic = (kind, id) => st[kind].filter(x => tid(x) === id).sort(kind === "courses" ? (a, b) => String(a.title).localeCompare(String(b.title), "ja") : sortOrd);
  const drafts = (kind, x) => (kind === "courses" ? courseState(x)[0] !== "公開中" : needsPublish(x));
  const railItems = [...(topics || []), NONE];
  const topic = railItems.find(t => t.id === cur) || NONE;

  async function arrange(kind, items) {
    setMsg("");
    // 先に画面を変えてから保存。失敗したら読み直す
    setSt(s => ({ ...s, [kind]: s[kind].map(x => { const n = items.find(y => y.id === x.id); return n ? { ...x, topic: n.topic, order: n.order } : x; }) }));
    try {
      const r = await manage.arrange(kind, items);
      if (r?.missing?.length) { setMsg(`見つからなかった教材があります（${r.missing.length}件）。読み込み直しました。`); load(); }
    } catch (e) {
      setMsg(e?.errorMessage || "保存できませんでした。読み込み直しました。");
      load();
    }
  }
  function drop(kind, targetId) {
    setOver("");
    if (!drag || drag.kind !== kind || drag.id === targetId) return;
    const list = inTopic(kind, cur);
    const from = list.findIndex(x => x.id === drag.id), to = list.findIndex(x => x.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...list];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    arrange(kind, next.map((x, i) => ({ id: x.id, topic: x.topic, order: (i + 1) * 10 })));
  }
  function move(kind, x, topicId) {
    const target = inTopic(kind, topicId);
    const order = kind === "courses" ? 0 : (target.reduce((a, y) => Math.max(a, y.order), 0) + 10);
    arrange(kind, [{ id: x.id, topic: topicId, order }]);
  }
  async function publish(kind, x) {
    if (busy || !confirmPublish([x])) return;
    setBusy(`${kind}/${x.id}`); setRes(null);
    const r = await publishMany([x], y => (kind === "courses" ? A.publishCourse(y.id) : manage.publish(kind, y.id)));
    setBusy(""); setRes(r); load();
  }
  const open = (kind, x) => go(kind === "courses" ? "#/manage/courses" : `#/manage/${kind}/${x.id}`);
  const make = kind => go(kind === "courses" ? "#/studio" : `#/manage/${kind}/_new`);

  if (st.state === "loading") return <p className="muted">読み込んでいます…</p>;
  if (st.state === "error") return <div className="card flat" style={{ padding: 16 }} role="alert">読み込めませんでした。 <button type="button" className="btn ghost" onClick={load}>もう一度</button></div>;

  const match = (kind, x) => (!q || String(x.title || "").toLowerCase().includes(q.toLowerCase())) && (!onlyDraft || drafts(kind, x));
  const topicSelect = (kind, x) => (
    <select className="mbt-move" aria-label={`${x.title}の単元`} value={tid(x)} onChange={e => move(kind, x, e.target.value)}>
      {(topics || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      <option value="">単元なし</option>
    </select>
  );

  return (
    <div className="mbt">
      <nav className="card mbt-rail" aria-label="単元">
        {railItems.map(t => {
          const n = KINDS.reduce((a, [k]) => a + inTopic(k, t.id).length, 0);
          const d = KINDS.reduce((a, [k]) => a + inTopic(k, t.id).filter(x => drafts(k, x)).length, 0);
          if (t === NONE && !n) return null;
          return (
            <button key={t.id || "_none"} type="button" aria-current={cur === t.id} onClick={() => setCur(t.id)}>
              <TopicIcon topic={t} size={30} />
              <span className="nm"><b>{t.name}</b><small>{t.sub || ""}</small></span>
              <span className="n">{n}{d > 0 && <span className="dr" title={`未公開 ${d}件`}>{d}</span>}</span>
            </button>
          );
        })}
        <button type="button" className="add" onClick={() => go("#/manage/topics")}><span className="plus">＋</span><span>単元を足す・直す</span></button>
      </nav>

      <div className="mbt-main">
        <div className="mbt-head">
          <TopicIcon topic={topic} size={52} />
          <div><h2>{topic.name}</h2>{topic.sub && <span className="muted" style={{ fontSize: 13 }}>{topic.sub}</span>}</div>
        </div>
        <div className="mbt-tools">
          <input id="mbt-q" className="mbt-search" type="search" placeholder="名前で探す" aria-label="名前で探す" value={q} onChange={e => setQ(e.target.value)} />
          <label className="mbt-opt"><input type="checkbox" id="mbt-draft" checked={onlyDraft} onChange={e => setOnlyDraft(e.target.checked)} />未公開だけ</label>
        </div>
        <PublishResult res={res} onClose={() => setRes(null)} />
        {msg && <div className="verdict ng" role="alert">{msg}</div>}

        {KINDS.map(([kind, title, makeLabel]) => {
          const all = inTopic(kind, cur);
          const rows = all.filter(x => match(kind, x));
          const draggable = kind !== "courses" && !q && !onlyDraft;
          return (
            <section key={kind} className="card mbt-sec">
              <div className="mbt-sech"><h3>{title}</h3><span className="n">{all.length}</span><button type="button" className="btn ghost sm" onClick={() => make(kind)}>＋ {makeLabel}</button></div>
              {!rows.length ? <p className="mbt-empty">{all.length ? "見つかりません" : "まだありません"}</p> : (
                <div className="mbt-list">
                  {rows.map((x, i) => {
                    const [label, cls] = kind === "courses" ? courseState(x) : itemState(x);
                    const key = `${kind}/${x.id}`;
                    return (
                      <div key={x.id} className={`mbt-row ${draggable ? "" : "nodrag"} ${over === key ? "over" : ""} ${drag?.id === x.id && drag?.kind === kind ? "dragging" : ""}`}
                        draggable={draggable}
                        onDragStart={e => { setDrag({ kind, id: x.id }); e.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => { setDrag(null); setOver(""); }}
                        onDragOver={e => { if (drag?.kind === kind) { e.preventDefault(); setOver(key); } }}
                        onDragLeave={() => setOver(o => (o === key ? "" : o))}
                        onDrop={e => { e.preventDefault(); drop(kind, x.id); }}>
                        {draggable ? <Grip /> : <span />}
                        <span className="ord num">{kind === "courses" ? "" : i + 1}</span>
                        <span className="tt"><b>{x.title || "（名前なし）"}</b><small>{kind === "courses" ? `レッスン ${Number(x.lessons || 0)}` : kind === "cases" ? "案件体験" : x.runtime || ""}</small></span>
                        <span className={`chip ${cls}`}>{label}</span>
                        {topicSelect(kind, x)}
                        {drafts(kind, x)
                          ? <button type="button" className="btn sm" disabled={!!busy} onClick={() => publish(kind, x)}>{busy === key ? "公開しています…" : x.published ? "変更を公開" : "公開する"}</button>
                          : <button type="button" className="btn ghost sm" onClick={() => open(kind, x)}>開く</button>}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
