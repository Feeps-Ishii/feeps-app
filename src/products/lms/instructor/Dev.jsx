import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { devApi, fmtDate, fmtSize, openFile, uploadToFolder, waitJob } from "../../training/DevReview.jsx";
import { Btn, Card, Chip, FileIcon, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, errText, pad2, useRoster, useStaffCourse } from "../staff/common.js";

/* 講師の個人開発（モック devS）：課題を切り替えて提出の表を見る。開くと右に提出・AI のレビュー・講師のレビュー。課題の設定（問題・解答・範囲・AI に読ませる・要件・観点・公開）は別の画面。
   決まりは今の画面（DevReviewTeacher）と同じ */

const toLocal = iso => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; const p = x => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

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

// 提出の状態（モック dvKind）。AI の下書きは「レビューまだ」に入れる
const kindOf = r => {
  if (!r.files.length) return "none";
  const last = r.reviews[0];
  if (last?.publishedAt && last.createdAt >= r.lastUpload) return last.resubmit ? "redo" : "pub";
  return "wait";
};
const aiReady = r => { const last = r.reviews[0]; return !!last && !last.publishedAt && last.createdAt >= r.lastUpload; };
const batchesOf = r => [...new Set(r.files.map(f => f.name.split("/")[0]))].sort().reverse();
const pointOf = r => { const k = kindOf(r); return k === "pub" || k === "redo" ? r.reviews[0].total : aiReady(r) ? r.reviews[0].total - 0.5 : -1; };
const deadlineOf = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`; };

function Board({ courseId, course, initial, openSetup, say }) {
  const roster = useRoster(courseId);
  const [ls, setLs] = useState({ state: "loading" }); const [aid, setAid] = useState(initial || "");
  const [sub, setSub] = useState({ state: "loading" });
  const [creating, setCreating] = useState(null);
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("hi");
  const [pick, setPick] = useState(""); const [sel, setSel] = useState(new Set()); const [rev, setRev] = useState(null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const loadList = () => {
    setLs(s => ({ ...s, state: "loading" }));
    devApi.list(courseId).then(d => {
      const items = arr(d?.items);
      setLs({ state: "ready", items });
      setAid(cur => (items.some(a => a.id === cur) ? cur : (items.find(a => a.status === "open" && a.waiting) || items.find(a => a.status === "open") || items[0])?.id || ""));
    }).catch(() => setLs({ state: "error" }));
  };
  useEffect(loadList, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps
  const item = ls.items?.find(a => a.id === aid);
  const path = `/dev-assignments/${encodeURIComponent(aid)}`, qs = `courseId=${encodeURIComponent(courseId)}`;
  const loadSub = () => apiGet(`${path}/submissions?${qs}`).then(d => { setSub({ state: "ready", d }); return d; }).catch(() => { setSub({ state: "error" }); return null; });
  useEffect(() => {
    setPick(""); setRev(null); setErr("");
    if (item?.status !== "open") return;
    setSub({ state: "loading" }); loadSub();
  }, [aid, item?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = async () => {
    if (!creating.title.trim()) { setErr("課題の名前を入れてください"); return; }
    setBusy("create"); setErr("");
    try { const r = await devApi.create(courseId, { title: creating.title.trim(), deadline: creating.deadline ? new Date(creating.deadline).toISOString() : "" }); setCreating(null); openSetup(r.item.id); }
    catch (e) { setErr(errText(e, "作れませんでした")); } finally { setBusy(""); }
  };

  const rowsAll = arr(sub.d?.rows), row = rowsAll.find(r => r.traineeId === pick);
  const c = k => rowsAll.filter(r => kindOf(r) === k).length;
  const kana = id => arr(roster.list).find(p => p.id === id)?.kana || "";
  const by = { hi: (a, b) => pointOf(b) - pointOf(a), lo: (a, b) => (pointOf(a) < 0) - (pointOf(b) < 0) || pointOf(a) - pointOf(b), new: (a, b) => String(b.lastUpload).localeCompare(String(a.lastUpload)), many: (a, b) => batchesOf(b).length - batchesOf(a).length, kana: (a, b) => (kana(a.traineeId) || a.name).localeCompare(kana(b.traineeId) || b.name, "ja") }[sort];
  const rows = rowsAll.filter(r => (tab === "all" || kindOf(r) === tab) && matchName(r.name, kana(r.traineeId), q)).sort(by);
  const open = r => {
    if (pick === r.traineeId) return;
    setPick(r.traineeId); setErr("");
    const newest = batchesOf(r)[0];
    setSel(new Set(r.files.filter(f => f.name.startsWith(`${newest}/`)).map(f => f.nodeId)));
    setRev(r.reviews[0] ? { ...r.reviews[0] } : null);
  };
  const runAi = async () => {
    setBusy("ai"); setErr("");
    try { const r = await apiPost(`${path}/review?${qs}`, { traineeId: pick, nodeIds: [...sel] }); const done = await waitJob(courseId, aid, r.jobId, () => {}); setRev(done.review); await loadSub(); say?.("AI のレビューができました"); }
    catch (e) { setErr(errText(e, "AI のレビューができませんでした")); } finally { setBusy(""); }
  };
  const send = async resubmit => {
    if (!String(rev.teacherComment || "").trim()) { setErr("講師のレビューを書いてください"); return; }
    setBusy(resubmit ? "redo" : "pub"); setErr("");
    try { const r = await apiPut(`${path}/reviews/${encodeURIComponent(rev.revId)}?${qs}`, { criteria: rev.criteria, requirements: rev.requirements, notes: rev.notes, summary: rev.summary, teacherComment: rev.teacherComment, total: rev.total, resubmit, publish: true }); setRev(r.review); await loadSub(); say?.(resubmit ? `${row.name} さんに出し直しを頼みました` : `${row.name} さんにレビューを送りました`); }
    catch (e) { setErr(errText(e, "送れませんでした")); } finally { setBusy(""); }
  };
  const good = arr(rev?.notes).filter(n => n.kind === "good"), fix = arr(rev?.notes).filter(n => n.kind !== "good");
  const whereOf = n => [n.file, n.line ? `${n.line} 行` : ""].filter(Boolean).join(" ");
  const copyAi = () => setRev(r => ({ ...r, teacherComment: [good.length ? `良いところ\n${good.map(n => `・${n.text}`).join("\n")}` : "", fix.length ? `直すとよいところ\n${fix.map(n => `・${whereOf(n) ? `${whereOf(n)}：` : ""}${n.text}`).join("\n")}` : ""].filter(Boolean).join("\n\n") }));
  const newest = row ? batchesOf(row)[0] : "";
  const shown = row && newest ? row.files.filter(f => f.name.startsWith(`${newest}/`)).map(f => ({ ...f, name: f.name.slice(newest.length + 1) })) : [];
  const revKind = row ? kindOf(row) : "";

  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{course.name}</div><h1 className="h1">個人開発</h1></div><span className="r"><Btn kind="sm" onClick={() => { setCreating({ title: "", deadline: "" }); setErr(""); }}>課題を作る</Btn></span></div>
      {ls.state === "loading" ? <div className="soon card">読み込み中</div> : ls.state === "error" ? <Card><div className="empty"><b>課題を確認できません</b><Btn kind="ghost sm" onClick={loadList}>再読み込み</Btn></div></Card> : !ls.items.length ? <Card><div className="empty"><Chip>なし</Chip></div></Card> : (
        <>
          <div className="row">
            <span className="seg">{ls.items.map((a, i) => <button key={a.id} type="button" aria-pressed={a.id === aid} onClick={() => setAid(a.id)}>課題{i + 1} {a.title}</button>)}</span>
            <span style={{ marginLeft: "auto" }} />
            {item?.status === "open" && sub.state === "ready" && <><Chip tone="ok">提出 {rowsAll.filter(r => r.files.length).length}/{rowsAll.length}</Chip><Chip tone="warn">レビューまだ {c("wait")}</Chip></>}
            {item?.status !== "open" && <Chip>下書き</Chip>}
            {item?.deadline && <Chip>{deadlineOf(item.deadline)} まで</Chip>}
            <Btn kind="ghost sm" onClick={() => openSetup(aid)}>課題の設定</Btn>
          </div>
          {err && !row && <div className="lms-err" role="alert">{err}</div>}
          {item?.status !== "open" ? null : sub.state === "loading" ? <div className="soon card">読み込み中</div> : sub.state === "error" ? <Card><div className="empty"><b>提出を確認できません</b><Btn kind="ghost sm" onClick={loadSub}>再読み込み</Btn></div></Card> : (
            <div className={row ? "dv2" : ""}>
              <div className="st">
                <ListTool tabs={[["all", "すべて", rowsAll.length], ["wait", "レビューまだ", c("wait"), "warn"], ["redo", "出し直し", c("redo")], ["pub", "送った", c("pub"), "ok"], ["none", "未提出", c("none")]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["hi", "点の高い順"], ["lo", "点の低い順"], ["new", "提出の新しい順"], ["many", "提出の多い順"], ["kana", "名前順"]]} sort={sort} onSort={setSort} />
                <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>受講生</th><th>提出</th><th>最新</th><th>レビュー</th><th>点</th><th /></tr></thead><tbody>
                  {rows.map(r => {
                    const k = kindOf(r), n = batchesOf(r).length;
                    return (
                      <tr key={r.traineeId} className={pick === r.traineeId ? "on" : ""}>
                        <td><span className="dvs-n"><span className="face">{r.name.slice(0, 1)}</span><b>{r.name}</b></span></td>
                        <td className="num">{n ? `${n} 回` : "—"}</td>
                        <td className="num">{r.lastUpload ? fmtDate(r.lastUpload) : "—"}</td>
                        <td>{k === "redo" ? <Chip tone="warn">出し直しを頼んだ</Chip> : k === "pub" ? <Chip tone="ok">送った</Chip> : aiReady(r) ? <Chip tone="mk">AI のレビューあり</Chip> : <Chip>まだ</Chip>}</td>
                        <td className="num">{k === "pub" || k === "redo" ? <b>{r.reviews[0].total}</b> : aiReady(r) ? <small className="dv-est">AI {r.reviews[0].total}</small> : "—"}</td>
                        <td>{r.files.length > 0 && <Btn kind="ghost sm" onClick={() => open(r)}>開く</Btn>}</td>
                      </tr>
                    );
                  })}
                  {!rows.length && <tr><td colSpan={6}><Chip>なし</Chip></td></tr>}
                </tbody></table></div></Card>
              </div>
              {row && (
                <div className="dv-r">
                  {err && <div className="lms-err" role="alert">{err}</div>}
                  <Card className="pad st-g">
                    <div className="head"><div><h3 className="h3">{row.name}</h3><small className="dv-sm num">提出 {batchesOf(row).length} 回 ・ 最新 {fmtDate(row.lastUpload)}</small></div><span className="r">{row.files.some(f => f.name.startsWith(`${newest}/`)) && <Btn kind="ghost sm" onClick={() => { const f = row.files.find(x => x.name.startsWith(`${newest}/`)); openFile(courseId, f.nodeId).catch(() => setErr(`「${f.name}」を開けませんでした`)); }}>コードを開く ↗</Btn>}<Btn kind="sm" disabled={!!busy || !sel.size} onClick={runAi}>{busy === "ai" ? "AI がレビューしています" : rev ? "AI でやり直す" : "AI でレビューする"}</Btn><button type="button" className="x2" aria-label="閉じる" onClick={() => { setPick(""); setRev(null); setErr(""); }}>×</button></span></div>
                    <Files files={shown} courseId={courseId} select={sel} onToggle={nid => setSel(s => { const n = new Set(s); if (n.has(nid)) n.delete(nid); else n.add(nid); return n; })} onError={setErr} />
                  </Card>
                  {rev && (
                    <>
                      <Card className="pad st-g dv-aic">
                        <div className="head"><h3 className="h3">AI のレビュー</h3><span className="r"><Chip>点の目安 {arr(rev.criteria).reduce((n, x) => n + (x.score || 0), 0)}</Chip></span></div>
                        <div className="dv-ai">
                          {rev.summary && <span>{rev.summary}</span>}
                          {good.length > 0 && <><b className="ok">良いところ</b><ul>{good.map((n, i) => <li key={i}>{n.text}</li>)}</ul></>}
                          {fix.length > 0 && <><b className="ng">直すとよいところ</b><ul>{fix.map((n, i) => <li key={i}>{whereOf(n) && <span className="mono">{whereOf(n)}</span>}{n.text}</li>)}</ul></>}
                        </div>
                        <span className="row st-end"><Btn kind="ghost sm" onClick={copyAi}>講師のレビューに写す</Btn></span>
                      </Card>
                      <Card className="pad st-g">
                        <div className="head"><h3 className="h3">講師のレビュー</h3><span className="r">{revKind === "pub" ? <Chip tone="ok">送った</Chip> : revKind === "redo" ? <Chip tone="warn">出し直しを頼んだ</Chip> : <Chip>まだ送っていない</Chip>}</span></div>
                        <textarea rows={7} aria-label="講師のレビュー" placeholder="AI のレビューを見ながら、受講生に送る言葉で書く" value={rev.teacherComment || ""} onChange={e => setRev(r => ({ ...r, teacherComment: e.target.value }))} />
                        <div className="row"><label className="row dv-pt">点<input type="number" min="0" max="100" value={rev.total ?? 0} onChange={e => setRev(r => ({ ...r, total: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} /><small>/100</small></label><span style={{ marginLeft: "auto" }} className="row"><Btn kind="ghost sm" disabled={!!busy} onClick={() => send(true)}>{busy === "redo" ? "送っています" : "出し直しを頼む"}</Btn><Btn kind="sm" disabled={!!busy} onClick={() => send(false)}>{busy === "pub" ? "送っています" : "レビューを送る"}</Btn></span></div>
                      </Card>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {creating && (
        <Modal title="課題を作る" width={480} onClose={() => setCreating(null)} footer={<><Btn kind="ghost" disabled={!!busy} onClick={() => setCreating(null)}>やめる</Btn><Btn disabled={!!busy} onClick={create}>{busy === "create" ? "作っています" : "作る"}</Btn></>}>
          <label className="field">課題の名前<input type="text" autoFocus value={creating.title} onChange={e => setCreating(x => ({ ...x, title: e.target.value.slice(0, 80) }))} /></label>
          <label className="field">締め切り（任意）<input type="datetime-local" value={creating.deadline} onChange={e => setCreating(x => ({ ...x, deadline: e.target.value }))} /></label>
          {err && <div className="lms-err" role="alert">{err}</div>}
        </Modal>
      )}
    </div>
  );
}

function Setup({ courseId, id, back, say }) {
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
      <div><Btn kind="ghost sm" onClick={back}>← 個人開発</Btn></div>
      <div className="head"><input type="text" className="rv-ti" aria-label="課題の名前" value={f.title} onChange={e => set("title", e.target.value.slice(0, 80))} /><span className="r">{f.status === "open" ? <Chip tone="ok">公開中</Chip> : <Chip>下書き</Chip>}<Btn kind="ghost sm" disabled={!!busy} onClick={() => save(false)}>保存</Btn>{f.status !== "open" && <Btn kind="sm" disabled={!!busy || !reqs.length} onClick={openIt}>{busy === "open" ? "公開しています" : "公開する"}</Btn>}</span></div>
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

export default function InstructorDev({ say }) {
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const [setup, setSetup] = useState("");
  const [last, setLast] = useState("");
  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!sc.course) return <Card><div className="empty"><b>個人開発</b><Chip>コースなし</Chip></div></Card>;
  if (setup) return <Setup key={setup} courseId={courseId} id={setup} say={say} back={() => { setLast(setup); setSetup(""); }} />;
  return <Board courseId={courseId} course={sc.course} initial={last} openSetup={setSetup} say={say} />;
}
