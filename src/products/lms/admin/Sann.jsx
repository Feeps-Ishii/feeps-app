import React, { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { Btn, Card, Chip, ListTool, Modal } from "../parts/ui.jsx";
import { arr, errText, md } from "../staff/common.js";

/* 管理者のお知らせ（全体。モック sannS）：種類・宛先（ロール）・コース・期間。出す前に確かめる。一覧は既読数つき（受講生宛だけ。ADR 0033） */

const KINDS = ["お知らせ", "メンテナンス", "重要"];
const ROLES = [["trainee", "受講生"], ["instructor", "講師"], ["client", "企業担当者"]];
const EMPTY = { id: "", kind: "お知らせ", roles: { trainee: true, instructor: true, client: true }, courseId: "", from: "", to: "", title: "", body: "" };
const today = () => new Date().toISOString().slice(0, 10);

export default function AdminSann({ say }) {
  const [items, setItems] = useState(undefined);
  const [courses, setCourses] = useState([]);
  const [v, setV] = useState(EMPTY);
  const [check, setCheck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [del, setDel] = useState(null);
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("new");
  const load = useCallback(() => apiGet("/announcements").then(r => setItems(arr(r?.items))).catch(() => setItems(null)), []);
  useEffect(() => { load(); apiGet("/completion-report/courses").then(r => setCourses(arr(r?.courses))).catch(() => setCourses([])); }, [load]);
  const f = (k, x) => setV(s => ({ ...s, [k]: x }));
  const picked = ROLES.filter(([k]) => v.roles[k]);
  const open = () => {
    if (!v.title.trim() || !v.body.trim()) { setErr("件名と本文を入れてください"); return; }
    if (!picked.length) { setErr("宛先を選んでください"); return; }
    setErr(""); setCheck(true);
  };
  const send = async () => {
    setBusy(true); setErr("");
    const base = { title: v.title.trim(), body: v.body.trim(), kind: v.kind, importance: v.kind === "お知らせ" ? "normal" : "important", pinned: v.kind === "メンテナンス", publishedAt: v.from && v.from > today() ? new Date(`${v.from}T00:00:00`).toISOString() : "", expiresAt: v.to ? new Date(`${v.to}T23:59:59`).toISOString() : "" };
    try {
      if (v.id) await apiPut(`/announcements/${v.id}`, { audience: picked[0][0], courseId: picked[0][0] === "trainee" ? v.courseId : "", ...base });
      else for (const [k] of picked) await apiPost("/announcements", { audience: k, courseId: k === "trainee" ? v.courseId : "", ...base }); // eslint-disable-line no-await-in-loop
      say?.("お知らせを出しました");
      setV(EMPTY); setCheck(false); load();
    } catch (e) { setErr(errText(e, "出せませんでした")); setCheck(false); } finally { setBusy(false); }
  };
  const remove = async a => {
    setDel(null);
    try { await apiDelete(`/announcements/${a.announcementId}`); say?.("消しました"); load(); }
    catch (e) { setErr(errText(e, "消せませんでした")); }
  };
  const now = Date.now();
  const stateOf = a => (a.publishedAt && Date.parse(a.publishedAt) > now ? "予約" : a.expiresAt && Date.parse(a.expiresAt) < now ? "終了" : "公開中");
  const list = arr(items).filter(a => (tab === "all" || stateOf(a) === tab) && (!q.trim() || String(a.title).includes(q.trim()))).sort((a, b) => (sort === "unread" ? ((b.targetCount || 0) - (b.readCount || 0)) - ((a.targetCount || 0) - (a.readCount || 0)) : String(b.publishedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.createdAt || ""))));
  const AUD = { trainee: "受講生", instructor: "講師", client: "企業担当者" };
  const courseName = id => courses.find(c => c.courseId === id)?.name || "";
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">すべてのユーザー</div><h1 className="h1">お知らせ</h1></div></div>
      <Card className="pad st-g">
        <div className="head"><h2 className="h2">{v.id ? "お知らせを直す" : "お知らせを出す"}</h2>{v.id && <span className="r"><Btn kind="ghost sm" onClick={() => setV(EMPTY)}>やめる</Btn></span>}</div>
        <div className="field">種類<span className="seg">{KINDS.map(k => <button key={k} type="button" aria-pressed={v.kind === k} onClick={() => f("kind", k)}>{k}</button>)}</span></div>
        <div className="field">宛先<span className="row">{ROLES.map(([k, t]) => <label key={k} className="st-ck"><input type="checkbox" disabled={!!v.id} checked={!!v.roles[k]} onChange={e => f("roles", { ...v.roles, [k]: e.target.checked })} />{t}</label>)}</span></div>
        {v.roles.trainee && <label className="field">受講生のコース<select className="in" value={v.courseId} onChange={e => f("courseId", e.target.value)}><option value="">すべてのコース</option>{courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}</select></label>}
        <div className="st-fg"><label className="field">出す日<input type="date" value={v.from} onChange={e => f("from", e.target.value)} /></label><label className="field">表示の終了日<input type="date" value={v.to} onChange={e => f("to", e.target.value)} /></label></div>
        <label className="field">件名<input type="text" value={v.title} onChange={e => f("title", e.target.value)} /></label>
        <label className="field">本文<textarea rows={3} value={v.body} onChange={e => f("body", e.target.value)} /></label>
        <span className="row st-end"><Chip>宛先 {picked.map(x => x[1]).join("・") || "なし"}</Chip><Btn onClick={open}>確かめて出す</Btn></span>
        {err && <div className="lms-err" role="alert">{err}</div>}
      </Card>
      {items === null ? <Card><div className="empty"><b>お知らせを確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div></Card> : items === undefined ? <div className="soon card">読み込み中</div> : (
        <>
          <ListTool tabs={[["all", "すべて", items.length], ["公開中", "公開中", items.filter(a => stateOf(a) === "公開中").length, "ok"], ["予約", "予約", items.filter(a => stateOf(a) === "予約").length, "warn"], ["終了", "終了", items.filter(a => stateOf(a) === "終了").length]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="件名で探す" sorts={[["new", "新しい順"], ["unread", "未読の多い順"]]} sort={sort} onSort={setSort} />
          <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>件名</th><th>種類</th><th>宛先</th><th>出す期間</th><th>既読</th><th>状態</th><th /></tr></thead><tbody>
            {list.map(a => (
              <tr key={a.announcementId}>
                <td><b>{a.title}</b></td>
                <td><Chip tone={a.kind === "重要" || a.importance === "important" ? "bad" : a.kind === "メンテナンス" ? "warn" : ""}>{a.kind || (a.importance === "important" ? "重要" : "お知らせ")}</Chip></td>
                <td>{AUD[a.audience] || a.audience}{a.courseId ? ` ・ ${courseName(a.courseId)}` : ""}</td>
                <td className="num">{md(a.publishedAt || a.createdAt)}{a.expiresAt ? `〜${md(a.expiresAt)}` : ""}</td>
                <td className="num">{a.targetCount != null ? `${a.readCount} / ${a.targetCount}` : "—"}</td>
                <td><Chip tone={stateOf(a) === "公開中" ? "ok" : stateOf(a) === "予約" ? "warn" : ""}>{stateOf(a)}</Chip></td>
                <td><span className="row st-nw"><Btn kind="ghost sm" onClick={() => setV({ ...EMPTY, id: a.announcementId, kind: a.kind || (a.importance === "important" ? "重要" : "お知らせ"), roles: { [a.audience]: true }, courseId: a.courseId || "", to: String(a.expiresAt || "").slice(0, 10), title: a.title || "", body: a.body || "" })}>直す</Btn><Btn kind="ghost sm" onClick={() => setDel(a)}>削除</Btn></span></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7}><Chip>なし</Chip></td></tr>}
          </tbody></table></div></Card>
        </>
      )}
      {check && <Modal title="確かめて出す" width={500} onClose={() => setCheck(false)} footer={<><Btn kind="ghost" onClick={() => setCheck(false)}>直す</Btn><Btn disabled={busy} onClick={send}>{busy ? "出しています" : "出す"}</Btn></>}><dl className="kv"><div><dt>宛先</dt><dd>{picked.map(x => x[1]).join("・")}{v.courseId ? ` ・ ${courseName(v.courseId)}` : ""}</dd></div><div><dt>種類</dt><dd>{v.kind}</dd></div><div><dt>件名</dt><dd>{v.title}</dd></div><div><dt>本文</dt><dd className="st-pre">{v.body}</dd></div></dl></Modal>}
      {del && <Modal title="お知らせを削除" width={420} onClose={() => setDel(null)} footer={<><Btn kind="ghost" onClick={() => setDel(null)}>やめる</Btn><Btn onClick={() => remove(del)}>削除</Btn></>}><b>{del.title}</b></Modal>}
    </div>
  );
}
