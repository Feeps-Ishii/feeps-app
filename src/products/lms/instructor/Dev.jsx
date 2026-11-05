import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { devApi, fmtDate, fmtSize, openFile, uploadToFolder, waitJob } from "../../training/DevReview.jsx";
import { Btn, Card, Chip, FileIcon, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, errText, useRoster, useStaffCourse } from "../staff/common.js";

/* 講師の個人開発（モック devS）：課題の一覧 → 課題の設定（問題・解答・範囲・AI に読ませる・要件・観点・公開）／提出と AI レビュー（絞り込み・並べ替え・直して公開）。
   決まりは今の画面（DevReviewTeacher）と同じ */

const toLocal = iso => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; const p = x => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const KIND = { req: ["要件", "bad"], out: ["講義の範囲外", "warn"], style: ["読みやすさ", ""], good: ["よいところ", "ok"] };
const MARK = { ok: ["○", "rv-ok"], partial: ["△", "rv-pt"], ng: ["✕", "rv-ng"] };
const NEXT = { ok: "partial", partial: "ng", ng: "ok" };
const statusOf = r => {
  if (!r.files.length) return ["none", "未提出", ""];
  const last = r.reviews[0];
  if (!last || last.createdAt < r.lastUpload) return ["wait", "レビュー待ち", "warn"];
  if (!last.publishedAt) return ["ai", "AI の下書きあり", "mk"];
  return last.resubmit ? ["redo", "出し直しを頼んだ", "bad"] : ["pub", "公開済み", "ok"];
};

function PickBtn({ label, folder, disabled, onPick, kind = "ghost sm" }) {
  return <label className={`btn ${kind}${disabled ? " off" : ""}`}>{label}<input type="file" multiple className="lms-sr" disabled={disabled} {...(folder ? { webkitdirectory: "", directory: "" } : {})} onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) onPick(fs); }} /></label>;
}
function Files({ files, courseId, select, onToggle, onError }) {
  if (!files?.length) return <div><Chip>なし</Chip></div>;
  return (
    <div className="dv-ft">
      {files.map(f => (
        <span key={f.nodeId} className="rv-fr">
          {select && <input type="checkbox" checked={select.has(f.nodeId)} aria-label={`${f.name} を選ぶ`} onChange={() => onToggle(f.nodeId)} />}
          <button type="button" title={f.name} onClick={() => openFile(courseId, f.nodeId).catch(() => onError?.(`「${f.name}」を開けませんでした`))}>{f.name}</button>
          <small className="num">{fmtSize(f.sizeBytes)}</small>
        </span>
      ))}
    </div>
  );
}

function List({ courseId, course, open }) {
  const [st, setSt] = useState({ state: "loading" });
  const [creating, setCreating] = useState(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const load = () => { setSt(s => ({ ...s, state: "loading" })); devApi.list(courseId).then(d => setSt({ state: "ready", d })).catch(() => setSt({ state: "error" })); };
  useEffect(load, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = async () => {
    if (!creating.title.trim()) { setErr("課題の名前を入れてください"); return; }
    setBusy(true); setErr("");
    try { const r = await devApi.create(courseId, { title: creating.title.trim(), deadline: creating.deadline ? new Date(creating.deadline).toISOString() : "" }); setCreating(null); open(r.item.id, "setup"); }
    catch (e) { setErr(errText(e, "作れませんでした")); } finally { setBusy(false); }
  };
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{course.name}{st.d ? ` ・ 受講生 ${st.d.traineeCount} 人` : ""}</div><h1 className="h1">個人開発</h1></div><span className="r"><Btn kind="sm" onClick={() => { setCreating({ title: "", deadline: "" }); setErr(""); }}>課題を作る</Btn></span></div>
      {st.state === "loading" ? <div className="soon card">読み込み中</div> : st.state === "error" ? <Card><div className="empty"><b>課題を確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div></Card> : (
        <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>課題</th><th>締め切り</th><th>提出</th><th>AI レビュー</th><th>公開</th><th>状態</th><th /></tr></thead><tbody>
          {arr(st.d.items).map(a => (
            <tr key={a.id}>
              <td><b>{a.title}</b><small className="adsm">{arr(a.scope).join(" ・ ")}{arr(a.requirements).length ? ` ・ 要件 ${a.requirements.length} つ` : ""}</small></td>
              <td className="num">{a.deadline ? fmtDate(a.deadline) : "—"}</td>
              <td className="num">{a.status === "open" ? `${a.submitted} / ${st.d.traineeCount}` : "—"}</td>
              <td className="num">{a.status === "open" ? a.reviewed : "—"}</td>
              <td className="num">{a.status === "open" ? a.published : "—"}</td>
              <td>{a.status !== "open" ? <Chip>下書き</Chip> : a.waiting ? <Chip tone="warn">レビュー待ち {a.waiting}</Chip> : <Chip tone="ok">公開中</Chip>}</td>
              <td><span className="row st-nw">{a.status === "open" && <Btn kind="sm" onClick={() => open(a.id, "review")}>提出を見る</Btn>}<Btn kind="ghost sm" onClick={() => open(a.id, "setup")}>設定</Btn></span></td>
            </tr>
          ))}
          {!arr(st.d.items).length && <tr><td colSpan={7}><Chip>なし</Chip></td></tr>}
        </tbody></table></div></Card>
      )}
      {creating && (
        <Modal title="課題を作る" width={480} onClose={() => setCreating(null)} footer={<><Btn kind="ghost" disabled={busy} onClick={() => setCreating(null)}>やめる</Btn><Btn disabled={busy} onClick={create}>{busy ? "作っています" : "作る"}</Btn></>}>
          <label className="field">課題の名前<input type="text" autoFocus value={creating.title} onChange={e => setCreating(c => ({ ...c, title: e.target.value.slice(0, 80) }))} /></label>
          <label className="field">締め切り（任意）<input type="datetime-local" value={creating.deadline} onChange={e => setCreating(c => ({ ...c, deadline: e.target.value }))} /></label>
          {err && <div className="lms-err" role="alert">{err}</div>}
        </Modal>
      )}
    </div>
  );
}

function Setup({ courseId, id, back, toReview, say }) {
  const [st, setSt] = useState({ state: "loading" });
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [scopeText, setScopeText] = useState("");
  const load = () => devApi.get(courseId, id).then(d => { setSt({ state: "ready", d }); setF(x => x || { ...d.item, deadline: d.item.deadline ? toLocal(d.item.deadline) : "" }); }).catch(() => setSt({ state: "error" }));
  useEffect(() => { load(); }, [courseId, id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (st.state === "error") return <Card><div className="empty"><b>課題を確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div></Card>;
  if (st.state === "loading" || !f) return <div className="soon card">読み込み中</div>;
  const problem = arr(st.d.problem), answer = arr(st.d.answer);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const total = arr(f.rubric).reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const body = () => ({ title: f.title, deadline: f.deadline ? new Date(f.deadline).toISOString() : "", scope: f.scope, requirements: f.requirements, rubric: f.rubric, outOfScope: f.outOfScope, summary: f.summary });
  const q = `courseId=${encodeURIComponent(courseId)}`, path = `/dev-assignments/${encodeURIComponent(id)}`;
  const upload = async (part, files) => {
    setBusy(`up-${part}`); setErr("");
    try { await uploadToFolder({ courseId, parentId: part === "problem" ? f.problemFolderId : f.answerFolderId, files }); await load(); say?.(`${files.length} ファイルを置きました`); }
    catch (e) { setErr(errText(e, "置けませんでした")); } finally { setBusy(""); }
  };
  const save = async quiet => {
    setBusy("save"); setErr("");
    try { const r = await apiPut(`${path}?${q}`, body()); setF(x => ({ ...x, ...r.item, deadline: x.deadline })); if (!quiet) say?.("保存しました"); return true; }
    catch (e) { setErr(errText(e, "保存できませんでした")); return false; } finally { setBusy(""); }
  };
  const read = async () => {
    if (!(await save(true))) return;
    setBusy("read"); setErr("");
    try {
      const r = await apiPost(`${path}/read?${q}`, {});
      const done = await waitJob(courseId, id, r.jobId, () => {});
      setF(x => ({ ...x, requirements: done.item.requirements, rubric: done.item.rubric, outOfScope: done.item.outOfScope, summary: done.item.summary }));
      say?.("読み取りました");
    } catch (e) { setErr(errText(e, "読み取れませんでした")); } finally { setBusy(""); }
  };
  const openIt = async () => {
    if (!(await save(true))) return;
    setBusy("open"); setErr("");
    try { const r = await apiPost(`${path}/open?${q}`, {}); say?.(`公開しました（提出フォルダ ${r.folders} 人分）`); setF(x => ({ ...x, status: "open" })); }
    catch (e) { setErr(errText(e, "公開できませんでした")); } finally { setBusy(""); }
  };
  const addScope = v => { const t = v.trim(); if (t && !arr(f.scope).includes(t)) set("scope", [...arr(f.scope), t]); setScopeText(""); };
  const reqs = arr(f.requirements), rub = arr(f.rubric);
  return (
    <div className="st">
      <div><Btn kind="ghost sm" onClick={back}>← 課題の一覧</Btn></div>
      <div className="head"><input type="text" className="rv-ti" aria-label="課題の名前" value={f.title} onChange={e => set("title", e.target.value.slice(0, 80))} /><span className="r">{f.status === "open" ? <Chip tone="ok">公開中</Chip> : <Chip>下書き</Chip>}{f.status === "open" && <Btn kind="ghost sm" onClick={toReview}>提出と AI レビュー</Btn>}<Btn kind="ghost sm" disabled={!!busy} onClick={() => save(false)}>保存</Btn>{f.status !== "open" && <Btn kind="sm" disabled={!!busy || !reqs.length} onClick={openIt}>{busy === "open" ? "公開しています" : "公開する"}</Btn>}</span></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      <div className="g2e">
        <div className="st">
          <Card className="pad st-g"><div className="head"><h2 className="h3">問題</h2><span className="r"><Chip>受講生に見える</Chip><PickBtn label="ファイル" disabled={!!busy} onPick={fs => upload("problem", fs)} /></span></div><Files files={problem} courseId={courseId} onError={setErr} /></Card>
          <Card className="pad st-g"><div className="head"><h2 className="h3">解答</h2><span className="r"><Chip>講師だけ</Chip><PickBtn label="フォルダ" folder disabled={!!busy} onPick={fs => upload("answer", fs)} /><PickBtn label="ファイル・zip" disabled={!!busy} onPick={fs => upload("answer", fs)} /></span></div><Files files={answer} courseId={courseId} onError={setErr} /></Card>
          <Card className="pad st-g">
            <h2 className="h3">講義の範囲</h2>
            <div className="row">{arr(f.scope).map(s => <button key={s} type="button" className="chip mk" onClick={() => set("scope", f.scope.filter(x => x !== s))}>{s} ×</button>)}</div>
            <div className="an-ai"><input type="text" value={scopeText} placeholder="Lesson.4 条件分岐" aria-label="範囲を足す" onChange={e => setScopeText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addScope(scopeText); } }} /><Btn kind="ghost sm" onClick={() => addScope(scopeText)}>足す</Btn></div>
            <label className="field">締め切り<input type="datetime-local" value={f.deadline || ""} onChange={e => set("deadline", e.target.value)} /></label>
            <span className="row st-end"><Btn kind="sm" disabled={!!busy || !problem.length || !answer.length} onClick={read}>{busy === "read" ? "AI が読んでいます" : "AI に読ませる"}</Btn></span>
          </Card>
        </div>
        <div className="st">
          <Card className="pad st-g">
            <div className="head"><h2 className="h3">要件</h2><span className="r"><Btn kind="ghost sm" onClick={() => set("requirements", [...reqs, { id: `R${reqs.length + 1}`, text: "", how: "" }])}>足す</Btn></span></div>
            {reqs.map((r, i) => { const up = p => set("requirements", reqs.map((x, j) => (j === i ? { ...x, ...p } : x))); return <div key={i} className="rv-rq"><input type="text" aria-label="番号" value={r.id} onChange={e => up({ id: e.target.value.slice(0, 8) })} /><div className="st-g"><input type="text" aria-label="要件" value={r.text} onChange={e => up({ text: e.target.value })} /><input type="text" aria-label="確かめ方" placeholder="確かめ方" value={r.how || ""} onChange={e => up({ how: e.target.value })} /></div><button type="button" className="tm-del" onClick={() => set("requirements", reqs.filter((_, j) => j !== i))}>消す</button></div>; })}
            {!reqs.length && <Chip>なし</Chip>}
          </Card>
          <Card className="pad st-g">
            <div className="head"><h2 className="h3">採点の観点</h2><span className="r"><Chip tone={total === 100 ? "ok" : "warn"}>合計 {total} 点</Chip><Btn kind="ghost sm" onClick={() => set("rubric", [...rub, { name: "", weight: 0, how: "" }])}>足す</Btn></span></div>
            {rub.map((r, i) => { const up = p => set("rubric", rub.map((x, j) => (j === i ? { ...x, ...p } : x))); return <div key={i} className="rv-ru"><div className="st-g"><input type="text" aria-label="観点" value={r.name} onChange={e => up({ name: e.target.value })} /><input type="text" aria-label="見るところ" placeholder="見るところ" value={r.how || ""} onChange={e => up({ how: e.target.value })} /></div><input type="number" min="0" max="100" aria-label="配点" value={r.weight} onChange={e => up({ weight: Number(e.target.value) || 0 })} /><button type="button" className="tm-del" onClick={() => set("rubric", rub.filter((_, j) => j !== i))}>消す</button></div>; })}
          </Card>
          <Card className="pad st-g">
            <label className="field">範囲外の書き方（減点しない）<input type="text" placeholder="ラムダ式、Stream API" value={arr(f.outOfScope).join("、")} onChange={e => set("outOfScope", e.target.value.split(/[、,]/).map(x => x.trim()).filter(Boolean))} /></label>
            <label className="field">課題のひとこと（受講生に見える）<input type="text" value={f.summary || ""} onChange={e => set("summary", e.target.value.slice(0, 300))} /></label>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ReviewEditor({ rev, setRev }) {
  const up = next => setRev(r => ({ ...r, ...next, total: (next.criteria || r.criteria || []).reduce((s, c) => s + (c.score || 0), 0) }));
  return (
    <>
      <div className="dv-cr">{arr(rev.criteria).map((c, i) => <div key={c.name}><span>{c.name}</span><span className="evsc"><input type="number" min="0" max={c.max} value={c.score} aria-label={`${c.name}の点`} onChange={e => up({ criteria: rev.criteria.map((x, j) => (j === i ? { ...x, score: Math.max(0, Math.min(x.max, Number(e.target.value) || 0)) } : x)) })} /><small>/ {c.max}</small></span><span className="tp-bar sm"><i style={{ "--w": `${c.max ? c.score / c.max * 100 : 0}%` }} /></span>{c.reason && <small>{c.reason}</small>}</div>)}</div>
      {arr(rev.requirements).length > 0 && (
        <div className="st-g"><span className="eyebrow">要件</span>{rev.requirements.map((r, i) => { const s = r.status || (r.ok ? "ok" : "ng"); return <div key={r.id} className="rv-rr"><button type="button" className={MARK[s][1]} aria-label={`${r.id} を ${MARK[NEXT[s]][0]} にする`} onClick={() => up({ requirements: rev.requirements.map((x, j) => (j === i ? { ...x, status: NEXT[s], ok: NEXT[s] === "ok" } : x)) })}>{MARK[s][0]}</button><span><b className="dv-mono">{r.id}</b> {r.text}{r.note && <small className="dv-mt">{r.note}</small>}</span></div>; })}</div>
      )}
      {arr(rev.notes).length > 0 && (
        <div className="st-g"><span className="eyebrow">ファイルごとの指摘</span>{rev.notes.map((n, i) => <div key={i} className="dv-fxr"><span className="dv-f"><Chip tone={KIND[n.kind]?.[1] || ""}>{KIND[n.kind]?.[0] || "指摘"}{n.reqId ? ` ${n.reqId}` : ""}</Chip>{n.file && <b className="dv-mono">{n.file}</b>}{n.line ? <em className="num">{n.line} 行目</em> : null}<button type="button" className="tm-del" onClick={() => up({ notes: rev.notes.filter((_, j) => j !== i) })}>消す</button></span><textarea rows={2} aria-label="指摘の文" value={n.text} onChange={e => up({ notes: rev.notes.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} /></div>)}</div>
      )}
      {arr(rev.diffs).length > 0 && (
        <div className="dv-df"><span className="eyebrow">解答とのちがい</span>{rev.diffs.map((d, i) => <div key={i}><small>{d.title}</small><div className="g2e"><pre><span>{d.mine?.file}{d.mine?.line ? ` ${d.mine.line} 行目` : ""}{"\n"}</span>{d.mine?.code}</pre><pre><span>解答 {d.answer?.file}{d.answer?.line ? ` ${d.answer.line} 行目` : ""}{"\n"}</span>{d.answer?.code}</pre></div></div>)}</div>
      )}
    </>
  );
}

function Review({ courseId, id, back, toSetup, say }) {
  const roster = useRoster(courseId);
  const [st, setSt] = useState({ state: "loading" });
  const [pick, setPick] = useState(""); const [sel, setSel] = useState(new Set()); const [rev, setRev] = useState(null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("status");
  const path = `/dev-assignments/${encodeURIComponent(id)}`, qs = `courseId=${encodeURIComponent(courseId)}`;
  const load = () => apiGet(`${path}/submissions?${qs}`).then(d => { setSt({ state: "ready", d }); return d; }).catch(() => { setSt({ state: "error" }); return null; });
  const choose = r => {
    setPick(r.traineeId); setErr("");
    const newest = [...new Set(r.files.map(f => f.name.split("/")[0]))].sort().reverse()[0];
    setSel(new Set(r.files.filter(f => f.name.startsWith(`${newest}/`)).map(f => f.nodeId)));
    setRev(r.reviews[0] ? { ...r.reviews[0] } : null);
  };
  useEffect(() => { load().then(d => { const rows = arr(d?.rows), first = rows.find(r => statusOf(r)[0] === "wait") || rows.find(r => r.files.length) || rows[0]; if (first) choose(first); }); }, [courseId, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const row = st.d?.rows.find(r => r.traineeId === pick);
  const batches = useMemo(() => (row ? [...new Set(row.files.map(f => f.name.split("/")[0]))].sort().reverse() : []), [row]);
  if (st.state === "error") return <Card><div className="empty"><b>提出を確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div></Card>;
  if (st.state === "loading") return <div className="soon card">読み込み中</div>;
  const kana = id2 => arr(roster.list).find(p => p.id === id2)?.kana || "";
  const ptOf = r => r.reviews[0]?.total ?? -1;
  const ORD = { wait: 0, ai: 1, redo: 2, pub: 3, none: 4 };
  const by = { status: (a, b) => ORD[statusOf(a)[0]] - ORD[statusOf(b)[0]] || String(b.lastUpload).localeCompare(String(a.lastUpload)), hi: (a, b) => ptOf(b) - ptOf(a), lo: (a, b) => (ptOf(a) < 0) - (ptOf(b) < 0) || ptOf(a) - ptOf(b), new: (a, b) => String(b.lastUpload).localeCompare(String(a.lastUpload)), kana: (a, b) => (kana(a.traineeId) || a.name).localeCompare(kana(b.traineeId) || b.name, "ja") }[sort];
  const rowsAll = st.d.rows, c = k => rowsAll.filter(r => statusOf(r)[0] === k).length;
  const rows = rowsAll.filter(r => (tab === "all" || (tab === "wait" ? ["wait", "ai"].includes(statusOf(r)[0]) : statusOf(r)[0] === tab)) && matchName(r.name, kana(r.traineeId), q)).sort(by);
  const runAi = async () => {
    setBusy("ai"); setErr("");
    try { const r = await apiPost(`${path}/review?${qs}`, { traineeId: pick, nodeIds: [...sel] }); const done = await waitJob(courseId, id, r.jobId, () => {}); setRev(done.review); await load(); say?.("AI のレビューができました"); }
    catch (e) { setErr(errText(e, "AI のレビューができませんでした")); } finally { setBusy(""); }
  };
  const saveRev = async publish => {
    setBusy(publish ? "pub" : "save"); setErr("");
    try { const r = await apiPut(`${path}/reviews/${encodeURIComponent(rev.revId)}?${qs}`, { criteria: rev.criteria, requirements: rev.requirements, notes: rev.notes, summary: rev.summary, teacherComment: rev.teacherComment, resubmit: rev.resubmit, publish }); setRev(r.review); await load(); say?.(publish ? "受講生に公開しました" : "保存しました"); }
    catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(""); }
  };
  const prev = row?.reviews.find(v => v.publishedAt && v.revId !== rev?.revId);
  return (
    <div className="st">
      <div><Btn kind="ghost sm" onClick={back}>← 課題の一覧</Btn></div>
      <div className="head"><div><h1 className="h1">{st.d.item.title}</h1></div><span className="r">{st.d.item.deadline && <Chip>{fmtDate(st.d.item.deadline)} まで</Chip>}<Chip tone="ok">提出 {rowsAll.filter(r => r.files.length).length} / {rowsAll.length}</Chip><Btn kind="ghost sm" onClick={toSetup}>課題の設定</Btn></span></div>
      <ListTool tabs={[["all", "すべて", rowsAll.length], ["wait", "レビューまだ", c("wait") + c("ai"), "warn"], ["redo", "出し直し", c("redo")], ["pub", "送った", c("pub"), "ok"], ["none", "未提出", c("none")]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["status", "状態順"], ["hi", "点の高い順"], ["lo", "点の低い順"], ["new", "提出の新しい順"], ["kana", "名前順"]]} sort={sort} onSort={setSort} />
      {err && <div className="lms-err" role="alert">{err}</div>}
      <div className="rv-w">
        <div className="card pick rlist rv-l">
          {rows.map(r => { const [, t, tone] = statusOf(r); return <button key={r.traineeId} type="button" aria-current={r.traineeId === pick} onClick={() => choose(r)}><span className="face">{r.name.slice(0, 1)}</span><span><b>{r.name}</b><small className="num">{r.lastUpload ? fmtDate(r.lastUpload) : "—"}{r.reviews[0] ? ` ・ ${r.reviews[0].total} 点` : ""}</small></span><Chip tone={tone}>{t}</Chip></button>; })}
          {!rows.length && <div className="empty"><Chip>見つかりません</Chip></div>}
        </div>
        {row ? (
          <div className="st">
            <Card className="pad st-g">
              <div className="head"><div className="dvs-p"><span className="kt-av sm" aria-hidden="true">{row.name.slice(0, 1)}</span><h2 className="h3">{row.name} の提出</h2></div><span className="r"><Btn kind="sm" disabled={!!busy || !sel.size} onClick={runAi}>{busy === "ai" ? "AI がレビューしています" : `選んだ ${sel.size} ファイルを AI レビュー`}</Btn></span></div>
              {batches.map((b, i) => <div key={b} className="st-g"><span className="row"><b className="num">{b.replace(/\.(\d\d)$/, ":$1")}</b>{i === 0 && <Chip tone="mk">最新</Chip>}</span><Files files={row.files.filter(f => f.name.startsWith(`${b}/`)).map(f => ({ ...f, name: f.name.slice(b.length + 1) }))} courseId={courseId} select={sel} onToggle={nid => setSel(s => { const n = new Set(s); if (n.has(nid)) n.delete(nid); else n.add(nid); return n; })} onError={setErr} /></div>)}
              {!batches.length && <Chip>未提出</Chip>}
            </Card>
            {rev && (
              <Card className="pad st-g">
                <div className="head"><div><h2 className="h3">レビュー</h2><small className="dv-mt num">{fmtDate(rev.createdAt)} ・ {arr(rev.files).length} ファイル</small></div><span className="r">{rev.publishedAt ? <Chip tone="ok">公開済み {fmtDate(rev.publishedAt)}</Chip> : <Chip tone="mk">AI の下書き</Chip>}{prev && <Chip>前回 {prev.total} 点</Chip>}<span className="dv-sc"><b className="num">{rev.total}</b><small>/ 100</small></span></span></div>
                {rev.summary != null && <textarea rows={2} aria-label="まとめ" value={rev.summary} onChange={e => setRev(r => ({ ...r, summary: e.target.value }))} />}
                <ReviewEditor rev={rev} setRev={setRev} />
                <label className="field">講師から（結果の上に出る）<textarea rows={3} value={rev.teacherComment || ""} onChange={e => setRev(r => ({ ...r, teacherComment: e.target.value }))} /></label>
                <span className="row"><label className="st-ck"><input type="checkbox" checked={!!rev.resubmit} onChange={e => setRev(r => ({ ...r, resubmit: e.target.checked }))} />出し直してもらう</label><span style={{ marginLeft: "auto" }} /><Btn kind="ghost sm" disabled={!!busy} onClick={() => saveRev(false)}>下書きで保存</Btn><Btn kind="sm" disabled={!!busy} onClick={() => saveRev(true)}>{busy === "pub" ? "公開しています" : rev.publishedAt ? "直して公開し直す" : "公開する"}</Btn></span>
                {row.reviews.length > 1 && <details className="dv-h"><summary><span className="dv-hb"><b>これまでのレビュー</b></span><Chip>{row.reviews.length}</Chip></summary><div className="dv-pv">{row.reviews.map(v => <button key={v.revId} type="button" className="st-lk" onClick={() => setRev({ ...v })}>{fmtDate(v.createdAt)} ・ {v.total} 点 ・ {v.publishedAt ? "公開済み" : "下書き"}</button>)}</div></details>}
              </Card>
            )}
          </div>
        ) : <Card><div className="empty"><Chip>受講生を選んでください</Chip></div></Card>}
      </div>
    </div>
  );
}

export default function InstructorDev({ say }) {
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const [view, setView] = useState({ id: "", mode: "" });
  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>個人開発</b><Chip>コースなし</Chip></div></Card>;
  const home = () => setView({ id: "", mode: "" });
  if (view.id && view.mode === "setup") return <Setup key={view.id} courseId={courseId} id={view.id} say={say} back={home} toReview={() => setView(v => ({ ...v, mode: "review" }))} />;
  if (view.id && view.mode === "review") return <Review key={view.id} courseId={courseId} id={view.id} say={say} back={home} toSetup={() => setView(v => ({ ...v, mode: "setup" }))} />;
  return <List courseId={courseId} course={sc.course} open={(id, mode) => setView({ id, mode })} />;
}
