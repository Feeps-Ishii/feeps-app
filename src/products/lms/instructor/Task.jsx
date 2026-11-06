import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, ListTool, Modal } from "../parts/ui.jsx";
import { arr, errText, md, useStaffCourse, wd } from "../staff/common.js";

/* タスク（講師・コース担当者で共有。モック taskX）：まだ・自分・重要度 高・済み。期限切れ／今週／来週から に分ける */

const IMP = { 高: 0, 中: 1, 低: 2 };
const left = (d, today) => Math.ceil((Date.parse(d) - Date.parse(today)) / 86400000);

export function useTasks(courseId) {
  const [st, setSt] = useState({ state: "loading", items: [], staff: [], me: "" });
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!courseId) return undefined;
    let alive = true;
    apiGet(`/staff-tasks?courseId=${encodeURIComponent(courseId)}`)
      .then(r => { if (alive) setSt({ state: "ready", items: arr(r?.items), staff: arr(r?.staff), me: r?.me || "" }); })
      .catch(() => { if (alive) setSt({ state: "error", items: [], staff: [], me: "" }); });
    return () => { alive = false; };
  }, [courseId, key]);
  const sorted = useMemo(() => [...st.items].sort((a, b) => Number(a.done) - Number(b.done) || String(a.due || "9").localeCompare(String(b.due || "9")) || (IMP[a.importance] ?? 1) - (IMP[b.importance] ?? 1)), [st.items]);
  const nameOf = useCallback(id => st.staff.find(p => p.id === id)?.name || "", [st.staff]);
  const save = useCallback(async (id, body) => {
    const q = `courseId=${encodeURIComponent(courseId)}`;
    const r = id ? await apiPut(`/staff-tasks/${encodeURIComponent(id)}?${q}`, { courseId, ...body }) : await apiPost(`/staff-tasks?${q}`, { courseId, ...body });
    setSt(s => ({ ...s, items: id ? s.items.map(x => (x.id === id ? r.item : x)) : [...s.items, r.item] }));
    return r.item;
  }, [courseId]);
  const remove = useCallback(async id => {
    await apiDelete(`/staff-tasks/${encodeURIComponent(id)}?courseId=${encodeURIComponent(courseId)}`);
    setSt(s => ({ ...s, items: s.items.filter(x => x.id !== id) }));
  }, [courseId]);
  return { ...st, sorted, open: sorted.filter(x => !x.done), nameOf, save, remove, reload: () => setKey(k => k + 1) };
}

export function TaskModal({ t, task, onClose, say }) {
  const [v, setV] = useState({ title: task?.title || "", note: task?.note || "", due: task?.due || todayStr(), importance: task?.importance || "中", assigneeId: task?.assigneeId || t.me });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const f = (k, val) => setV(x => ({ ...x, [k]: val }));
  const save = async () => {
    if (!v.title.trim()) { setErr("タスクの名前を入れてください"); return; }
    setBusy(true); setErr("");
    try { await t.save(task?.id, v); say?.(task ? "タスクを直しました" : "タスクを足しました"); onClose(); }
    catch (e) { setErr(errText(e, "保存できませんでした")); setBusy(false); }
  };
  const del = async () => {
    setBusy(true);
    try { await t.remove(task.id); say?.("タスクを消しました"); onClose(); } catch (e) { setErr(errText(e, "消せませんでした")); setBusy(false); }
  };
  return (
    <Modal title={task ? "タスクを直す" : "タスクを足す"} width={480} onClose={onClose} footer={<>{task && <Btn kind="ghost" disabled={busy} onClick={del}>消す</Btn>}<Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy} onClick={save}>決める</Btn></>}>
      <label className="field">名前<input type="text" autoFocus value={v.title} onChange={e => f("title", e.target.value)} /></label>
      <label className="field">メモ<textarea rows={2} value={v.note} onChange={e => f("note", e.target.value)} /></label>
      <div className="st-fg">
        <label className="field">期限<input type="date" value={v.due} onChange={e => f("due", e.target.value)} /></label>
        <label className="field">重要度<select className="in" value={v.importance} onChange={e => f("importance", e.target.value)}>{Object.keys(IMP).map(x => <option key={x}>{x}</option>)}</select></label>
      </div>
      <label className="field">担当<select className="in" value={v.assigneeId} onChange={e => f("assigneeId", e.target.value)}><option value="">担当なし</option>{t.staff.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

export function TaskList({ t, list, today, say }) {
  const [edit, setEdit] = useState(null);
  if (t.state === "error") return <div className="empty"><b>タスクを確認できません</b><Btn kind="ghost sm" onClick={t.reload}>再読み込み</Btn></div>;
  if (t.state === "loading") return <div className="dv-mt">読み込み中</div>;
  const toggle = k => t.save(k.id, { done: !k.done }).then(() => say?.(!k.done ? `「${k.title}」を済みにしました` : "済みを取り消しました")).catch(() => say?.("保存できませんでした"));
  return (
    <div className="tkl">
      {list.map(k => {
        const n = k.due ? left(k.due, today) : null, who = t.nameOf(k.assigneeId);
        return (
          <div key={k.id} className={`tk${k.done ? " done" : ""} imp-${IMP[k.importance] ?? 1}`}>
            <button type="button" className="tkc" aria-pressed={k.done} aria-label={k.done ? "済みを取り消す" : "済みにする"} onClick={() => toggle(k)}>{k.done ? "✓" : ""}</button>
            <span className="tkb"><span className="row" style={{ gap: 6 }}><Chip tone={k.importance === "高" ? "bad" : k.importance === "中" ? "warn" : ""}>{k.importance}</Chip><b>{k.title}</b></span>{k.note && <small>{k.note}</small>}</span>
            <span className="tkd num">{k.due ? <>{md(k.due)}（{wd(k.due)}）{!k.done && (n < 0 ? <b className="late"> ・ {-n} 日過ぎ</b> : n === 0 ? <b className="soon"> ・ 今日まで</b> : n <= 3 ? <b className="soon"> ・ あと {n} 日</b> : ` ・ あと ${n} 日`)}</> : "期限なし"}</span>
            <span className="tkw">{who && <><span className="face sm">{who.slice(0, 1)}</span><small>{who}</small></>}</span>
            <Btn kind="ghost sm" onClick={() => setEdit(k)}>直す</Btn>
          </div>
        );
      })}
      {!list.length && <div><Chip>なし</Chip></div>}
      {edit && <TaskModal t={t} task={edit} say={say} onClose={() => setEdit(null)} />}
    </div>
  );
}

export default function InstructorTask({ say }) {
  const today = todayStr();
  const sc = useStaffCourse();
  const t = useTasks(sc.course?.courseId || "");
  const [tab, setTab] = useState("open");
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>タスク</b><Chip>コースなし</Chip></div></Card>;
  const open = t.sorted.filter(x => !x.done);
  const n = { open: open.length, me: open.filter(x => x.assigneeId === t.me).length, imp: open.filter(x => x.importance === "高").length, done: t.sorted.length - open.length };
  const hit = x => !q.trim() || [x.title, x.note, t.nameOf(x.assigneeId)].some(v => String(v || "").includes(q.trim()));
  const list = t.sorted.filter(x => (tab === "done" ? x.done : !x.done) && (tab !== "me" || x.assigneeId === t.me) && (tab !== "imp" || x.importance === "高") && hit(x));
  const in7 = x => x.due && left(x.due, today) <= 7 && left(x.due, today) >= 0;
  const groups = tab === "done" ? [["済み", list]] : [["期限切れ", list.filter(x => x.due && left(x.due, today) < 0)], ["今週", list.filter(in7)], ["来週から", list.filter(x => !x.due || left(x.due, today) > 7)]];
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{sc.course.name}</div><h1 className="h1">タスク</h1></div><span className="r"><Btn kind="sm" onClick={() => setAdding(true)}>タスクを足す</Btn></span></div>
      <ListTool tabs={[["open", "まだ", n.open], ["me", "自分", n.me, "ok"], ["imp", "重要度 高", n.imp, "bad"], ["done", "済み", n.done]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="タスクを探す" />
      {t.staff.length > 0 && <div className="row">{t.staff.map(p => <Chip key={p.id}>{p.name}</Chip>)}</div>}
      {t.state !== "ready" ? <Card className="pad"><TaskList t={t} list={[]} today={today} say={say} /></Card>
        : groups.filter(([, l]) => l.length).map(([ti, l]) => <Card key={ti} className="pad"><div className="head"><h3 className="h3">{ti}</h3><span className="r"><Chip tone={ti === "期限切れ" ? "bad" : ""}>{l.length}</Chip></span></div><TaskList t={t} list={l} today={today} say={say} /></Card>)}
      {t.state === "ready" && !list.length && <Card><div className="empty"><Chip>なし</Chip></div></Card>}
      {adding && <TaskModal t={t} say={say} onClose={() => setAdding(false)} />}
    </div>
  );
}
