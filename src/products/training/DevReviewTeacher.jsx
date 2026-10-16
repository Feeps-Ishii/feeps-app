import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Plus, Sparkles, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiPut } from "../../api.js";
import { Badge, Btn, Card, Modal, PrismErrorRetryCard, SectionHead, SkeletonRows, T } from "../../components/common";
import { FileList, PickFiles, ReviewBody, devApi, fmtDate, uploadToFolder, waitJob } from "./DevReview.jsx";

/* 個人開発の課題：講師の画面（2026-10-16）。一覧 → 課題を作る（問題・解答・範囲 → AIに読ませる → 要件・観点を決める → 公開）→
   提出とAIレビュー（受講生とファイルを選ぶ → AIレビュー → 直して公開／再提出を頼む） */
const box = { border: `1px solid ${T.border}`, background: "#fff", color: T.textPrimary };
const inputCls = "rounded-lg px-2.5 py-1.5 text-sm outline-none";

function Msg({ msg }) {
  if (!msg?.text) return null;
  return <div className="rounded-lg px-3 py-2 text-xs" role={msg.kind === "ng" ? "alert" : "status"} style={{ background: msg.kind === "ng" ? T.dangerSubtle : T.successSubtle, color: msg.kind === "ng" ? T.danger : T.success }}>{msg.text}</div>;
}

/* ---- 一覧 ---- */
function List({ courseId, coursePick, open }) {
  const [st, setSt] = useState({ state: "loading" });
  const [creating, setCreating] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = () => { setSt(s => ({ ...s, state: "loading" })); devApi.list(courseId).then(d => setSt({ state: "ready", d })).catch(() => setSt({ state: "error" })); };
  useEffect(load, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function create() {
    if (!creating.title.trim()) { setErr("課題の名前を入れてください。"); return; }
    setBusy(true); setErr("");
    try {
      const r = await devApi.create(courseId, { title: creating.title.trim(), deadline: creating.deadline ? new Date(creating.deadline).toISOString() : "" });
      setCreating(null); open(r.item.id, "setup");
    } catch (e) { setErr(e?.errorMessage || "作れませんでした。"); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-4">
      <SectionHead title="個人開発" desc={st.d ? `受講生 ${st.d.traineeCount}名` : ""} action={<div className="flex flex-wrap items-center gap-2">{coursePick}<Btn icon={Plus} onClick={() => { setCreating({ title: "", deadline: "" }); setErr(""); }}>課題を作る</Btn></div>} />
      {st.state === "loading" ? <Card className="p-4"><SkeletonRows rows={3} /></Card> : st.state === "error" ? <PrismErrorRetryCard message="課題を読み込めませんでした。" onRetry={load} />
        : !st.d.items.length ? <Card className="p-6 text-center text-sm" style={{ color: T.textMuted }}>まだ課題はありません</Card> : (
          <Card className="overflow-hidden">
            <table className="w-full border-collapse text-sm"><thead><tr>{["課題", "締め切り", "提出", "AIレビュー", "公開", ""].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-bold" style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead>
              <tbody>{st.d.items.map(a => (
                <tr key={a.id} className="cursor-pointer hover:bg-gray-50" style={{ borderBottom: `1px solid ${T.border}` }} onClick={() => open(a.id, a.status === "open" ? "review" : "setup")}>
                  <td className="px-4 py-3"><b style={{ color: T.textPrimary }}>{a.title}</b><div className="text-xs" style={{ color: T.textMuted }}>{a.scope?.join(" ・ ") || ""}{a.requirements?.length ? ` ・ 要件${a.requirements.length}つ` : ""}</div></td>
                  <td className="px-4 py-3 text-xs" style={{ color: T.textSecondary }}>{a.deadline ? fmtDate(a.deadline) : "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{a.status === "open" ? `${a.submitted} / ${st.d.traineeCount}` : "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{a.status === "open" ? a.reviewed : "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{a.status === "open" ? a.published : "—"}</td>
                  <td className="px-4 py-3">{a.status !== "open" ? <Badge>下書き</Badge> : a.waiting ? <Badge tone="cyan">レビュー待ち {a.waiting}</Badge> : <Badge tone="green">公開中</Badge>}</td>
                </tr>
              ))}</tbody></table>
          </Card>
        )}
      {creating && (
        <Modal title="課題を作る" onClose={() => setCreating(null)} footer={<><Btn kind="ghost" onClick={() => setCreating(null)} disabled={busy}>やめる</Btn><Btn onClick={create} disabled={busy}>{busy ? "作っています…" : "作る"}</Btn></>}>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-semibold" style={{ color: T.textPrimary }}>課題の名前<input id="dev-title" value={creating.title} onChange={e => setCreating(c => ({ ...c, title: e.target.value.slice(0, 80) }))} className={inputCls} style={box} placeholder="会員ランクの判定" /></label>
            <label className="grid gap-1 text-sm font-semibold" style={{ color: T.textPrimary }}>締め切り（任意。過ぎても出せる）<input id="dev-deadline" type="datetime-local" value={creating.deadline} onChange={e => setCreating(c => ({ ...c, deadline: e.target.value }))} className={inputCls} style={box} /></label>
            <small style={{ color: T.textMuted }}>作ると、研修資料のフォルダに「個人開発 / {creating.title || "課題の名前"} / 問題・解答」ができます（公開するまで受講生には見えません）。</small>
            {err && <Msg msg={{ kind: "ng", text: err }} />}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---- 課題を作る（問題・解答・範囲 → AIに読ませる → 要件・観点 → 公開） ---- */
function Setup({ courseId, id, back, toReview }) {
  const [st, setSt] = useState({ state: "loading" });
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [scopeHints, setScopeHints] = useState([]);
  const [scopeText, setScopeText] = useState("");
  const load = () => devApi.get(courseId, id).then(d => { setSt({ state: "ready", d }); setF(x => x || { ...d.item, deadline: d.item.deadline ? toLocal(d.item.deadline) : "" }); }).catch(() => setSt({ state: "error" }));
  useEffect(() => { load(); apiGet(`/courses/${encodeURIComponent(courseId)}/curriculum`).then(c => setScopeHints((c?.sections || c?.units || []).map(s => s.title || s.name).filter(Boolean).slice(0, 40))).catch(() => {}); }, [courseId, id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (st.state === "loading" || !f) return <Card className="p-4"><SkeletonRows rows={5} /></Card>;
  if (st.state === "error") return <PrismErrorRetryCard message="課題を読み込めませんでした。" onRetry={load} />;
  const { problem, answer } = st.d;
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const total = (f.rubric || []).reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const body = () => ({ title: f.title, deadline: f.deadline ? new Date(f.deadline).toISOString() : "", scope: f.scope, requirements: f.requirements, rubric: f.rubric, outOfScope: f.outOfScope, summary: f.summary });
  async function upload(part, files) {
    setBusy(`up-${part}`); setMsg({ kind: "", text: "" });
    try { await uploadToFolder({ courseId, parentId: part === "problem" ? f.problemFolderId : f.answerFolderId, files, onProgress: (d, n) => setBusy(`up-${part}:${d}/${n}`) }); await load(); setMsg({ kind: "ok", text: `${files.length}ファイルを置きました。` }); }
    catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || e?.message || "置けませんでした。" }); } finally { setBusy(""); }
  }
  async function save(quiet) {
    setBusy("save"); setMsg({ kind: "", text: "" });
    try { const r = await apiPut(`/dev-assignments/${encodeURIComponent(id)}?courseId=${encodeURIComponent(courseId)}`, body()); setF(x => ({ ...x, ...r.item, deadline: x.deadline })); if (!quiet) setMsg({ kind: "ok", text: "保存しました。" }); return true; }
    catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || "保存できませんでした。" }); return false; } finally { setBusy(""); }
  }
  async function read() {
    if (!(await save(true))) return;
    setBusy("read"); setMsg({ kind: "", text: "" });
    try {
      const r = await apiPost(`/dev-assignments/${encodeURIComponent(id)}/read?courseId=${encodeURIComponent(courseId)}`, {});
      const done = await waitJob(courseId, id, r.jobId, s => setBusy(`read:${s}`));
      setF(x => ({ ...x, requirements: done.item.requirements, rubric: done.item.rubric, outOfScope: done.item.outOfScope, summary: done.item.summary }));
      setMsg({ kind: "ok", text: "読み取りました。要件と観点を確かめて、直してください。" });
    } catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || e?.message || "読み取れませんでした。" }); } finally { setBusy(""); }
  }
  async function openIt() {
    if (!(await save(true))) return;
    setBusy("open"); setMsg({ kind: "", text: "" });
    try { const r = await apiPost(`/dev-assignments/${encodeURIComponent(id)}/open?courseId=${encodeURIComponent(courseId)}`, {}); setMsg({ kind: "ok", text: `公開しました。受講生 ${r.folders}名の提出フォルダを作りました。` }); setF(x => ({ ...x, status: "open" })); }
    catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || "公開できませんでした。" }); } finally { setBusy(""); }
  }
  const addScope = v => { const t = v.trim(); if (t && !(f.scope || []).includes(t)) set("scope", [...(f.scope || []), t]); setScopeText(""); };
  return (
    <div className="grid gap-4">
      <button type="button" onClick={back} className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold" style={{ color: T.textMuted }}><ChevronLeft size={16} />課題の一覧</button>
      <div className="flex flex-wrap items-center gap-2">
        <input id="dev-edit-title" value={f.title} onChange={e => set("title", e.target.value.slice(0, 80))} className="min-w-[240px] rounded-lg px-2 py-1 text-xl font-bold outline-none" style={{ ...box, borderColor: "transparent" }} aria-label="課題の名前" />
        {f.status === "open" ? <Badge tone="green">公開中</Badge> : <Badge>下書き</Badge>}
        <span className="ml-auto flex flex-wrap gap-2">{f.status === "open" && <Btn kind="ghost" onClick={toReview}>提出とAIレビューへ</Btn>}<Btn kind="ghost" onClick={() => save(false)} disabled={!!busy}>保存</Btn>{f.status !== "open" && <Btn onClick={openIt} disabled={!!busy || !(f.requirements || []).length}>{busy === "open" ? "公開しています…" : "公開する（提出フォルダを作る）"}</Btn>}</span>
      </div>
      <Msg msg={msg} />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="grid gap-4">
          <Card className="grid gap-2 p-5">
            <div className="flex flex-wrap items-center gap-2"><b style={{ color: T.textPrimary }}>問題</b><small style={{ color: T.textMuted }}>受講生に見える</small><span className="ml-auto flex gap-2"><PickFiles label="ファイル" disabled={!!busy} onPick={fs => upload("problem", fs)} /></span></div>
            {busy.startsWith("up-problem") && <small style={{ color: T.textMuted }}>置いています… {busy.split(":")[1] || ""}</small>}
            <FileList files={problem} courseId={courseId} empty="課題の説明（PDF・Markdown・画像など）を置いてください" />
          </Card>
          <Card className="grid gap-2 p-5">
            <div className="flex flex-wrap items-center gap-2"><b style={{ color: T.textPrimary }}>解答</b><small style={{ color: T.textMuted }}>講師だけ</small><span className="ml-auto flex gap-2"><PickFiles folder label="フォルダ" disabled={!!busy} onPick={fs => upload("answer", fs)} /><PickFiles label="ファイル・zip" disabled={!!busy} onPick={fs => upload("answer", fs)} /></span></div>
            {busy.startsWith("up-answer") && <small style={{ color: T.textMuted }}>置いています… {busy.split(":")[1] || ""}</small>}
            <FileList files={answer} courseId={courseId} empty="解答のプロジェクト（フォルダか zip）を置いてください" />
          </Card>
          <Card className="grid gap-2 p-5">
            <b style={{ color: T.textPrimary }}>講義の範囲 <small className="font-normal" style={{ color: T.textMuted }}>この範囲の書き方で評価する</small></b>
            <div className="flex flex-wrap gap-1.5">{(f.scope || []).map(s => <button key={s} type="button" onClick={() => set("scope", f.scope.filter(x => x !== s))} className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: T.accentSubtle, color: T.accent }}>{s} ×</button>)}</div>
            <div className="flex gap-2"><input id="dev-scope" list="dev-scope-hints" value={scopeText} onChange={e => setScopeText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addScope(scopeText); } }} placeholder="Lesson.4 条件分岐" className={`${inputCls} flex-1`} style={box} /><Btn kind="ghost" size="sm" onClick={() => addScope(scopeText)}>足す</Btn></div>
            <datalist id="dev-scope-hints">{scopeHints.map(h => <option key={h} value={h} />)}</datalist>
            <label className="grid gap-1 text-sm font-semibold" style={{ color: T.textPrimary }}>締め切り<input id="dev-edit-deadline" type="datetime-local" value={f.deadline || ""} onChange={e => set("deadline", e.target.value)} className={inputCls} style={box} /></label>
            <div className="flex justify-end"><Btn icon={Sparkles} onClick={read} disabled={!!busy || !problem.length || !answer.length}>{busy.startsWith("read") ? "AIが読んでいます…" : "AIに読ませる"}</Btn></div>
            {(!problem.length || !answer.length) && <small style={{ color: T.textMuted }}>問題と解答を置くと、AIに読ませられます。</small>}
          </Card>
        </div>
        <div className="grid gap-4">
          <Card className="grid gap-2 p-5">
            <div className="flex items-center gap-2"><b style={{ color: T.textPrimary }}>要件</b><span className="ml-auto"><Btn kind="ghost" size="sm" icon={Plus} onClick={() => set("requirements", [...(f.requirements || []), { id: `R${(f.requirements || []).length + 1}`, text: "", how: "" }])}>足す</Btn></span></div>
            {(f.requirements || []).length ? f.requirements.map((r, i) => (
              <div key={i} className="grid grid-cols-[48px_1fr_auto] items-start gap-2">
                <input aria-label="要件の番号" value={r.id} onChange={e => set("requirements", f.requirements.map((x, j) => (j === i ? { ...x, id: e.target.value.slice(0, 8) } : x)))} className={`${inputCls} font-mono`} style={box} />
                <div className="grid gap-1"><input aria-label="要件" value={r.text} onChange={e => set("requirements", f.requirements.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className={inputCls} style={box} /><input aria-label="確かめ方" value={r.how} placeholder="確かめ方" onChange={e => set("requirements", f.requirements.map((x, j) => (j === i ? { ...x, how: e.target.value } : x)))} className={`${inputCls} text-xs`} style={box} /></div>
                <button type="button" aria-label="消す" onClick={() => set("requirements", f.requirements.filter((_, j) => j !== i))} style={{ color: T.textMuted }}><Trash2 size={16} /></button>
              </div>
            )) : <p className="m-0 text-sm" style={{ color: T.textMuted }}>「AIに読ませる」で問題と解答から作るか、手で足してください。</p>}
          </Card>
          <Card className="grid gap-2 p-5">
            <div className="flex items-center gap-2"><b style={{ color: T.textPrimary }}>採点の観点</b><Badge tone={total === 100 ? "green" : "amber"}>合計 {total}点</Badge><span className="ml-auto"><Btn kind="ghost" size="sm" icon={Plus} onClick={() => set("rubric", [...(f.rubric || []), { name: "", weight: 0, how: "" }])}>足す</Btn></span></div>
            {(f.rubric || []).map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_auto] items-start gap-2">
                <div className="grid gap-1"><input aria-label="観点" value={r.name} onChange={e => set("rubric", f.rubric.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={inputCls} style={box} /><input aria-label="見るところ" value={r.how} placeholder="見るところ" onChange={e => set("rubric", f.rubric.map((x, j) => (j === i ? { ...x, how: e.target.value } : x)))} className={`${inputCls} text-xs`} style={box} /></div>
                <input aria-label="配点" type="number" min="0" max="100" value={r.weight} onChange={e => set("rubric", f.rubric.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) || 0 } : x)))} className={`${inputCls} text-right`} style={box} />
                <button type="button" aria-label="消す" onClick={() => set("rubric", f.rubric.filter((_, j) => j !== i))} style={{ color: T.textMuted }}><Trash2 size={16} /></button>
              </div>
            ))}
          </Card>
          <Card className="grid gap-2 p-5">
            <b style={{ color: T.textPrimary }}>範囲外の書き方 <small className="font-normal" style={{ color: T.textMuted }}>減点しない・ひとこと添える</small></b>
            <input id="dev-out" value={(f.outOfScope || []).join("、")} onChange={e => set("outOfScope", e.target.value.split(/[、,]/).map(x => x.trim()).filter(Boolean))} placeholder="ラムダ式、Stream API" className={inputCls} style={box} />
            <label className="grid gap-1 text-sm font-semibold" style={{ color: T.textPrimary }}>課題のひとこと（受講生に見える）<input id="dev-summary" value={f.summary || ""} onChange={e => set("summary", e.target.value.slice(0, 300))} className={inputCls} style={box} /></label>
          </Card>
        </div>
      </div>
    </div>
  );
}
const toLocal = iso => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; const p = x => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

/* ---- 提出とAIレビュー ---- */
const STATUS = r => {
  if (!r.files.length) return ["未提出", "muted"];
  const last = r.reviews[0];
  if (!last || last.createdAt < r.lastUpload) return ["レビュー待ち", "cyan"];
  if (!last.publishedAt) return ["AIレビュー済み", "amber"];
  return last.resubmit ? ["再提出待ち", "red"] : ["公開済み", "green"];
};
function Review({ courseId, id, back, toSetup }) {
  const [st, setSt] = useState({ state: "loading" });
  const [pick, setPick] = useState("");
  const [sel, setSel] = useState(new Set());
  const [rev, setRev] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const detailRef = useRef(null);
  const load = () => apiGet(`/dev-assignments/${encodeURIComponent(id)}/submissions?courseId=${encodeURIComponent(courseId)}`).then(d => { setSt({ state: "ready", d }); return d; }).catch(() => { setSt({ state: "error" }); return null; });
  useEffect(() => { load().then(d => { const first = d?.rows.find(r => r.files.length && STATUS(r)[0] === "レビュー待ち") || d?.rows.find(r => r.files.length) || d?.rows[0]; if (first) choose(first); }); }, [courseId, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const row = st.d?.rows.find(r => r.traineeId === pick);
  const batches = useMemo(() => (row ? [...new Set(row.files.map(f => f.name.split("/")[0]))].sort().reverse() : []), [row]);
  function choose(r, user) {
    setPick(r.traineeId); setMsg({ kind: "", text: "" });
    // 一覧と提出が縦に並ぶ幅では、選んだ人の提出へ移る
    if (user && window.matchMedia("(max-width: 1023px)").matches) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    const newest = [...new Set(r.files.map(f => f.name.split("/")[0]))].sort().reverse()[0];
    setSel(new Set(r.files.filter(f => f.name.startsWith(`${newest}/`)).map(f => f.nodeId)));
    setRev(r.reviews[0] ? { ...r.reviews[0] } : null);
  }
  if (st.state === "loading") return <Card className="p-4"><SkeletonRows rows={5} /></Card>;
  if (st.state === "error") return <PrismErrorRetryCard message="提出を読み込めませんでした。" onRetry={load} />;
  const { item } = st.d;
  // 出した人を上に（レビュー待ち → AIレビュー済み → 再提出待ち → 公開済み → 未提出）
  const ORDER = { "レビュー待ち": 0, "AIレビュー済み": 1, "再提出待ち": 2, "公開済み": 3, "未提出": 4 };
  const rows = [...st.d.rows].sort((a, b) => ORDER[STATUS(a)[0]] - ORDER[STATUS(b)[0]] || String(b.lastUpload).localeCompare(String(a.lastUpload)));
  async function runAi() {
    setBusy("ai"); setMsg({ kind: "", text: "" });
    try {
      const r = await apiPost(`/dev-assignments/${encodeURIComponent(id)}/review?courseId=${encodeURIComponent(courseId)}`, { traineeId: pick, nodeIds: [...sel] });
      const done = await waitJob(courseId, id, r.jobId, s => setBusy(`ai:${s}`));
      setRev(done.review); await load();
      setMsg({ kind: "ok", text: "AIのレビューができました。確かめて直してから公開してください。" });
    } catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || e?.message || "AIのレビューができませんでした。" }); } finally { setBusy(""); }
  }
  async function saveRev(publish) {
    setBusy(publish ? "pub" : "save"); setMsg({ kind: "", text: "" });
    try {
      const r = await apiPut(`/dev-assignments/${encodeURIComponent(id)}/reviews/${encodeURIComponent(rev.revId)}?courseId=${encodeURIComponent(courseId)}`, { criteria: rev.criteria, requirements: rev.requirements, notes: rev.notes, summary: rev.summary, teacherComment: rev.teacherComment, resubmit: rev.resubmit, publish });
      setRev(r.review); await load();
      setMsg({ kind: "ok", text: publish ? "受講生に公開しました。" : "保存しました。" });
    } catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || "保存できませんでした。" }); } finally { setBusy(""); }
  }
  const prev = row?.reviews.find(v => v.publishedAt && v.revId !== rev?.revId);
  return (
    <div className="grid gap-4">
      <button type="button" onClick={back} className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold" style={{ color: T.textMuted }}><ChevronLeft size={16} />課題の一覧</button>
      <div className="flex flex-wrap items-center gap-3"><h2 className="m-0 text-xl font-bold" style={{ color: T.textPrimary }}>{item.title}</h2>{item.deadline && <Badge tone="cyan">締め切り {fmtDate(item.deadline)}</Badge>}<span className="ml-auto"><Btn kind="ghost" size="sm" onClick={toSetup}>課題の設定</Btn></span></div>
      <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="overflow-hidden lg:sticky lg:top-4">
          <div className="max-h-[42vh] overflow-y-auto lg:max-h-[calc(100vh-180px)]">
          {rows.map(r => { const [s, tone] = STATUS(r); const last = r.reviews[0]; return (
            <button key={r.traineeId} type="button" onClick={() => choose(r, true)} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-2 px-4 py-2.5 text-left" style={{ borderBottom: `1px solid ${T.border}`, background: pick === r.traineeId ? T.accentSubtle : "#fff" }}>
              <b className="truncate text-sm" style={{ color: T.textPrimary }}>{r.name}</b><span className="tabular-nums text-sm" style={{ color: T.textPrimary }}>{last ? last.total : ""}</span>
              <span className="col-span-2 flex items-center gap-2"><Badge tone={tone}>{s}</Badge>{r.lastUpload && <small style={{ color: T.textMuted }}>{fmtDate(r.lastUpload)}</small>}</span>
            </button>
          ); })}
          </div>
        </Card>
        {row ? (
          <div className="grid gap-4" ref={detailRef}>
            <Card className="grid gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2"><b style={{ color: T.textPrimary }}>{row.name}の提出</b><small style={{ color: T.textMuted }}>提出のたびに日時のフォルダ</small>
                <span className="ml-auto"><Btn icon={Sparkles} onClick={runAi} disabled={!!busy || !sel.size}>{busy.startsWith("ai") ? "AIがレビューしています…" : `選んだ${sel.size}ファイルをAIレビュー`}</Btn></span></div>
              {batches.length ? batches.map((b, i) => (
                <div key={b} className="grid gap-1"><small className="font-bold" style={{ color: T.textMuted }}>{b.replace(/\.(\d\d)$/, ":$1")} {i === 0 && <Badge tone="cyan">いちばん新しい</Badge>}</small>
                  <FileList files={row.files.filter(f => f.name.startsWith(`${b}/`)).map(f => ({ ...f, name: f.name.slice(b.length + 1) }))} courseId={courseId} select={sel} onToggle={nid => setSel(s => { const n = new Set(s); n.has(nid) ? n.delete(nid) : n.add(nid); return n; })} /></div>
              )) : <p className="m-0 text-sm" style={{ color: T.textMuted }}>まだ出していません</p>}
            </Card>
            <Msg msg={msg} />
            {rev && (
              <Card className="grid gap-4 p-5">
                <div className="flex flex-wrap items-center gap-2"><b style={{ color: T.textPrimary }}>レビュー</b>{rev.publishedAt ? <Badge tone="green">公開済み {fmtDate(rev.publishedAt)}</Badge> : <Badge tone="amber">講師が確かめる前</Badge>}<small style={{ color: T.textMuted }}>{fmtDate(rev.createdAt)} ・ {rev.files.length}ファイル</small>{prev && <Badge tone="cyan">前回 {prev.total}点 → 今回 {rev.total}点</Badge>}</div>
                {rev.summary && <textarea aria-label="まとめ" value={rev.summary} rows={2} onChange={e => setRev(r => ({ ...r, summary: e.target.value }))} className="w-full resize-y rounded-lg px-3 py-2 text-sm" style={box} />}
                <ReviewBody review={rev} editable showAnswer onChange={next => setRev(r => ({ ...r, ...next, total: (next.criteria || r.criteria).reduce((s, c) => s + (c.score || 0), 0) }))} />
                <label className="grid gap-1 text-sm font-semibold" style={{ color: T.textPrimary }}>講師から（結果の上に出る）<textarea id="dev-teacher-comment" value={rev.teacherComment} rows={3} onChange={e => setRev(r => ({ ...r, teacherComment: e.target.value }))} className="w-full resize-y rounded-lg px-3 py-2 text-sm font-normal" style={box} /></label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-sm" style={{ color: T.textPrimary }}><input type="checkbox" checked={!!rev.resubmit} onChange={e => setRev(r => ({ ...r, resubmit: e.target.checked }))} />再提出してもらう</label>
                  <span className="ml-auto flex gap-2"><Btn kind="ghost" onClick={() => saveRev(false)} disabled={!!busy}>下書きで保存</Btn><Btn onClick={() => saveRev(true)} disabled={!!busy}>{busy === "pub" ? "公開しています…" : rev.publishedAt ? "直して公開し直す" : "受講生に公開する"}</Btn></span>
                </div>
                {row.reviews.length > 1 && <details><summary className="cursor-pointer text-sm font-semibold" style={{ color: T.textMuted }}>これまでのレビュー（{row.reviews.length}件）</summary><ul className="m-0 mt-2 grid list-none gap-1 p-0 text-sm">{row.reviews.map(v => <li key={v.revId}><button type="button" onClick={() => setRev({ ...v })} className="flex gap-3" style={{ color: v.revId === rev.revId ? T.accent : T.textPrimary }}><span>{fmtDate(v.createdAt)}</span><b className="tabular-nums">{v.total}点</b><span>{v.publishedAt ? "公開済み" : "下書き"}</span></button></li>)}</ul></details>}
              </Card>
            )}
          </div>
        ) : <Card className="p-6 text-center text-sm" style={{ color: T.textMuted }}>受講生を選んでください</Card>}
      </div>
    </div>
  );
}

export default function DevReviewTeacher({ courseId, coursePick }) {
  const [view, setView] = useState({ id: "", mode: "" });
  if (view.id && view.mode === "setup") return <Setup key={view.id} courseId={courseId} id={view.id} back={() => setView({ id: "", mode: "" })} toReview={() => setView(v => ({ ...v, mode: "review" }))} />;
  if (view.id && view.mode === "review") return <Review key={view.id} courseId={courseId} id={view.id} back={() => setView({ id: "", mode: "" })} toSetup={() => setView(v => ({ ...v, mode: "setup" }))} />;
  return <List courseId={courseId} coursePick={coursePick} open={(id, mode) => setView({ id, mode })} />;
}
