import React, { useEffect, useState } from "react";
import { ChevronLeft, FolderUp, Upload } from "lucide-react";
import { apiGet, apiPost } from "../../api.js";
import { Badge, Btn, Card, PrismErrorRetryCard, SectionHead, SkeletonRows, T } from "../../components/common";
import { getActiveCourseId, setActiveCourseId } from "../../utils/common/courseContext.js";

/* 個人開発の課題とAIレビュー（2026-10-16、モック docs/design/mockups/devhub-lms-2026-10/lms-dev-review.html）。
   講師：課題を作る → 問題と解答をAIに読ませて要件・観点を決める → 公開（研修資料のフォルダに提出フォルダができる）→
         受講生とファイルを選んでAIレビュー → 直して公開（再提出を頼める）。講師の画面は DevReviewTeacher.jsx
   受講生：問題を見る → 自分の提出フォルダに置く（置くたびに日時のフォルダができ、前のものも残る）→ 結果を見て直す（何回でも） */
const DevReviewTeacher = React.lazy(() => import("./DevReviewTeacher.jsx"));

export const devApi = {
  list: c => apiGet(`/dev-assignments?courseId=${encodeURIComponent(c)}`),
  get: (c, id) => apiGet(`/dev-assignments/${encodeURIComponent(id)}?courseId=${encodeURIComponent(c)}`),
  create: (c, body) => apiPost("/dev-assignments", { ...body, courseId: c }),
  job: (c, id, jobId) => apiGet(`/dev-assignments/${encodeURIComponent(id)}/jobs/${encodeURIComponent(jobId)}?courseId=${encodeURIComponent(c)}`),
};
export const fmtDate = s => { if (!s) return ""; const d = new Date(s); return Number.isNaN(d.getTime()) ? s : `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
export const fmtSize = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : n >= 1024 ? `${Math.round(n / 1024)}KB` : `${n}B`);
const stamp = () => { const d = new Date(); const p = x => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}`; };

// AIの処理が終わるのを待つ（3秒ごと・最大6分）
export async function waitJob(courseId, id, jobId, onTick) {
  for (let i = 0; i < 120; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(r => setTimeout(r, i ? 3000 : 1500));
    // eslint-disable-next-line no-await-in-loop
    const r = await devApi.job(courseId, id, jobId);
    if (r.status === "done") return r;
    if (r.status === "error") throw new Error(r.error || "AIの処理に失敗しました。");
    onTick?.(r.status);
  }
  throw new Error("時間がかかりすぎています。少し待ってから開き直してください。");
}

// 研修資料のフォルダへ置く。フォルダごと選んだときは中のフォルダも作る（files は File の配列、relPath があればそれを使う）
export async function uploadToFolder({ courseId, parentId, files, onProgress }) {
  const spaceId = `course#${courseId}`;
  const made = new Map([["", parentId]]);
  const folderFor = async dir => {
    if (made.has(dir)) return made.get(dir);
    const parts = dir.split("/");
    const parent = await folderFor(parts.slice(0, -1).join("/"));
    const r = await apiPost("/library/folders", { spaceId, parentId: parent, name: parts[parts.length - 1] });
    made.set(dir, r.nodeId);
    return r.nodeId;
  };
  let done = 0;
  for (const f of files) {
    const rel = (f.webkitRelativePath || f.name).replace(/\\/g, "/");
    if (/(^|\/)(\.git|node_modules|target|build|bin|out|\.idea|\.settings)\//.test(`/${rel}`)) { done += 1; continue; }
    const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
    // eslint-disable-next-line no-await-in-loop
    const parent = await folderFor(dir);
    // eslint-disable-next-line no-await-in-loop
    const got = await apiPost("/library/upload-url", { spaceId, parentId: parent, filename: f.name, contentType: f.type || "application/octet-stream", sizeBytes: Math.max(1, f.size) });
    // eslint-disable-next-line no-await-in-loop
    const put = await fetch(got.uploadUrl, { method: "PUT", headers: { "content-type": got.contentType }, body: f });
    if (!put.ok) throw new Error(`「${f.name}」を置けませんでした（${put.status}）。`);
    // eslint-disable-next-line no-await-in-loop
    await apiPost("/library/files", { spaceId, parentId: parent, nodeId: got.nodeId, s3key: got.s3key, materialId: got.materialId, name: f.name, sizeBytes: Math.max(1, f.size), contentType: got.contentType });
    done += 1;
    onProgress?.(done, files.length);
  }
}
export async function openFile(courseId, nodeId, download = false) {
  const r = await apiGet(`/library/download?spaceId=${encodeURIComponent(`course#${courseId}`)}&nodeId=${encodeURIComponent(nodeId)}${download ? "&mode=download" : ""}`);
  window.open(r.url, "_blank", "noopener");
}

// ファイルを選ぶボタン（ファイル・フォルダ・zip）
export function PickFiles({ onPick, disabled, label = "ファイルを選ぶ", folder = false, accept }) {
  const id = React.useId();
  return (
    <label htmlFor={id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold ${disabled ? "pointer-events-none opacity-50" : ""}`} style={{ border: `1px solid ${T.border}`, background: "#fff", color: T.textPrimary }}>
      {folder ? <FolderUp size={15} /> : <Upload size={15} />}{label}
      <input id={id} type="file" multiple className="sr-only" accept={accept} {...(folder ? { webkitdirectory: "", directory: "" } : {})} disabled={disabled} onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) onPick(fs); }} />
    </label>
  );
}

export function FileList({ files, courseId, select, onToggle, empty = "まだありません" }) {
  if (!files?.length) return <p className="m-0 text-sm" style={{ color: T.textMuted }}>{empty}</p>;
  return (
    <ul className="m-0 grid list-none gap-0.5 p-0">
      {files.map(f => (
        <li key={f.nodeId} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] hover:bg-gray-50">
          {select && <input type="checkbox" checked={select.has(f.nodeId)} onChange={() => onToggle(f.nodeId)} aria-label={`${f.name}を選ぶ`} />}
          <button type="button" className="min-w-0 truncate text-left font-mono" style={{ color: T.textPrimary }} onClick={() => openFile(courseId, f.nodeId).catch(() => {})} title="開く">{f.name}</button>
          <span className="ml-auto shrink-0 text-[11px]" style={{ color: T.textMuted }}>{fmtSize(f.sizeBytes)} ・ {fmtDate(f.updatedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

const KIND = { req: ["要件", "red"], out: ["講義の範囲外", "amber"], style: ["読みやすさ", "cyan"], good: ["よいところ", "green"] };
// レビューの中身（受講生の結果・講師の確認の両方で使う。講師はここを直せる）
export function ReviewBody({ review, editable, onChange, showAnswer }) {
  const set = (k, v) => onChange?.({ ...review, [k]: v });
  return (
    <div className="grid gap-4">
      <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
        <div className="grid h-24 w-24 place-items-center rounded-full" style={{ background: `conic-gradient(${T.accent} 0 ${review.total}%, #EEF1F6 ${review.total}% 100%)` }}>
          <div className="grid h-[78px] w-[78px] place-items-center rounded-full bg-white"><b className="text-2xl leading-none" style={{ color: T.textPrimary }}>{review.total}<small className="text-xs font-normal" style={{ color: T.textMuted }}>/100</small></b></div>
        </div>
        <div className="grid gap-2">
          {(review.criteria || []).map((c, i) => (
            <div key={c.name} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-[13px]">
              <b style={{ color: T.textPrimary }}>{c.name}</b>
              {editable ? <span className="flex items-center gap-1"><input type="number" min="0" max={c.max} value={c.score} aria-label={`${c.name}の点`} onChange={e => set("criteria", review.criteria.map((x, j) => (j === i ? { ...x, score: Math.max(0, Math.min(x.max, Number(e.target.value) || 0)) } : x)))} className="w-14 rounded-lg px-1.5 py-0.5 text-right text-sm" style={{ border: `1px solid ${T.border}` }} /> / {c.max}</span>
                : <b className="tabular-nums" style={{ color: T.textPrimary }}>{c.score} / {c.max}</b>}
              <span className="col-span-2 h-1.5 overflow-hidden rounded-full" style={{ background: "#EEF1F6" }}><i className="block h-full" style={{ width: `${c.max ? (c.score / c.max) * 100 : 0}%`, background: T.accent }} /></span>
              {c.reason && <span className="col-span-2 text-xs" style={{ color: T.textMuted }}>{c.reason}</span>}
            </div>
          ))}
        </div>
      </div>
      {(review.requirements || []).length > 0 && (
        <div className="grid gap-1">
          <b className="text-[13px]" style={{ color: T.textPrimary }}>要件</b>
          {review.requirements.map((r, i) => (
            <div key={r.id} className="grid grid-cols-[28px_1fr] items-start gap-2 border-b py-1.5 text-[13px]" style={{ borderColor: "#EEF1F6" }}>
              {editable ? <button type="button" aria-label={`${r.id}を${r.ok ? "×" : "○"}にする`} onClick={() => set("requirements", review.requirements.map((x, j) => (j === i ? { ...x, ok: !x.ok } : x)))} className="font-extrabold" style={{ color: r.ok ? T.success : T.danger }}>{r.ok ? "○" : "✕"}</button>
                : <b style={{ color: r.ok ? T.success : T.danger }}>{r.ok ? "○" : "✕"}</b>}
              <span><b className="mr-1 font-mono text-xs" style={{ color: T.accent }}>{r.id}</b>{r.text}{r.note && <small className="block" style={{ color: T.textMuted }}>{r.note}</small>}</span>
            </div>
          ))}
        </div>
      )}
      {(review.notes || []).length > 0 && (
        <div className="grid gap-2">
          <b className="text-[13px]" style={{ color: T.textPrimary }}>ファイルごとの指摘</b>
          {review.notes.map((n, i) => (
            <div key={i} className="grid gap-1 rounded-xl px-3 py-2 text-[13px]" style={{ background: n.kind === "req" ? T.dangerSubtle : n.kind === "out" ? T.warningSubtle : n.kind === "good" ? T.successSubtle : "#F6F8FB" }}>
              <span className="flex flex-wrap items-center gap-2"><Badge tone={KIND[n.kind]?.[1] || "muted"}>{KIND[n.kind]?.[0] || "指摘"}{n.reqId ? ` ${n.reqId}` : ""}</Badge>{n.file && <span className="font-mono text-[11.5px]" style={{ color: T.textMuted }}>{n.file}{n.line ? ` ${n.line}行目` : ""}</span>}
                {editable && <button type="button" className="ml-auto text-xs" style={{ color: T.textMuted }} onClick={() => set("notes", review.notes.filter((_, j) => j !== i))}>消す</button>}</span>
              {editable ? <textarea value={n.text} rows={2} aria-label="指摘の文" onChange={e => set("notes", review.notes.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className="w-full resize-y rounded-lg px-2 py-1 text-[13px]" style={{ border: `1px solid ${T.border}`, background: "#fff" }} />
                : <p className="m-0" style={{ color: T.textPrimary }}>{n.text}</p>}
            </div>
          ))}
        </div>
      )}
      {(review.diffs || []).length > 0 && (
        <div className="grid gap-2">
          <b className="text-[13px]" style={{ color: T.textPrimary }}>{showAnswer ? "解答とのちがい" : "見直すところ"}</b>
          {review.diffs.map((d, i) => (
            <div key={i} className="grid gap-1">
              <small style={{ color: T.textMuted }}>{d.title}</small>
              <div className={`grid gap-2 ${showAnswer ? "sm:grid-cols-2" : ""}`}>
                <pre className="m-0 overflow-x-auto rounded-xl p-3 text-xs" style={{ background: "#151923", color: "#E6E9F1" }}><span style={{ color: "#7D869C" }}>{d.mine.file}{d.mine.line ? ` ${d.mine.line}行目` : ""}{"\n"}</span>{d.mine.code}</pre>
                {showAnswer && <pre className="m-0 overflow-x-auto rounded-xl p-3 text-xs" style={{ background: "#151923", color: "#E6E9F1" }}><span style={{ color: "#7D869C" }}>解答 {d.answer.file}{d.answer.line ? ` ${d.answer.line}行目` : ""}{"\n"}</span>{d.answer.code}</pre>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CoursePick({ courses, value, onChange }) {
  if (courses.length < 2) return null;
  return <select value={value} onChange={e => onChange(e.target.value)} className="rounded-xl px-3 py-2 text-sm" style={{ border: `1px solid ${T.border}`, background: "#fff", color: T.textPrimary }} aria-label="コース">{courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name || c.courseId}</option>)}</select>;
}

/* ---- 受講生 ---- */
const STATE = { none: ["まだ出していない", "muted"], submitted: ["レビュー待ち", "cyan"], resubmit: ["直して出してください", "amber"], done: ["結果あり", "green"] };
function TraineeList({ courseId, open }) {
  const [st, setSt] = useState({ state: "loading", items: [] });
  const load = () => { setSt(s => ({ ...s, state: "loading" })); devApi.list(courseId).then(r => setSt({ state: "ready", items: r.items || [] })).catch(() => setSt({ state: "error", items: [] })); };
  useEffect(load, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (st.state === "loading") return <Card className="p-4"><SkeletonRows rows={3} /></Card>;
  if (st.state === "error") return <PrismErrorRetryCard message="課題を読み込めませんでした。" onRetry={load} />;
  if (!st.items.length) return <Card className="p-6 text-center text-sm" style={{ color: T.textMuted }}>まだ課題はありません</Card>;
  return (
    <Card className="overflow-hidden">
      <table className="w-full border-collapse text-sm"><thead><tr>{["課題", "締め切り", "状態", "点"].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-bold" style={{ color: T.textMuted, borderBottom: `1px solid ${T.border}` }}>{h}</th>)}</tr></thead>
        <tbody>{st.items.map(a => (
          <tr key={a.id} className="cursor-pointer hover:bg-gray-50" onClick={() => open(a.id)} style={{ borderBottom: `1px solid ${T.border}` }}>
            <td className="px-4 py-3"><b style={{ color: T.textPrimary }}>{a.title}</b>{a.summary && <div className="text-xs" style={{ color: T.textMuted }}>{a.summary}</div>}</td>
            <td className="px-4 py-3 text-xs" style={{ color: T.textSecondary }}>{a.deadline ? fmtDate(a.deadline) : "—"}</td>
            <td className="px-4 py-3"><Badge tone={STATE[a.state]?.[1]}>{STATE[a.state]?.[0]}</Badge></td>
            <td className="px-4 py-3 tabular-nums" style={{ color: T.textPrimary }}>{a.total ?? "—"}</td>
          </tr>
        ))}</tbody></table>
    </Card>
  );
}

function TraineeTask({ courseId, id, back }) {
  const [st, setSt] = useState({ state: "loading" });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const load = () => devApi.get(courseId, id).then(d => setSt({ state: "ready", d })).catch(() => setSt({ state: "error" }));
  useEffect(() => { load(); }, [courseId, id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (st.state === "loading") return <Card className="p-4"><SkeletonRows rows={4} /></Card>;
  if (st.state === "error") return <PrismErrorRetryCard message="課題を読み込めませんでした。" onRetry={load} />;
  const { item, problem, files, folderId, reviews } = st.d;
  // 置くたびに日時のフォルダ（「2026-10-22 18.40」）に分ける。前のものも残る
  const batches = [...new Set(files.map(f => f.name.split("/")[0]))].sort().reverse();
  const late = item.deadline && Date.now() > Date.parse(item.deadline);
  async function submit(list) {
    setBusy("up"); setMsg({ kind: "", text: "" });
    try {
      const batch = await apiPost("/library/folders", { spaceId: `course#${courseId}`, parentId: folderId, name: stamp() });
      await uploadToFolder({ courseId, parentId: batch.nodeId, files: list, onProgress: (d, n) => setBusy(`up:${d}/${n}`) });
      setMsg({ kind: "ok", text: `${list.length}ファイルを出しました。講師がレビューします。` });
      await load();
    } catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || e?.message || "出せませんでした。" }); } finally { setBusy(""); }
  }
  const latest = reviews[0];
  return (
    <div className="grid gap-4">
      <button type="button" onClick={back} className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold" style={{ color: T.textMuted }}><ChevronLeft size={16} />課題の一覧</button>
      <div className="flex flex-wrap items-center gap-3"><h2 className="m-0 text-xl font-bold" style={{ color: T.textPrimary }}>{item.title}</h2>{item.deadline && <Badge tone={late ? "red" : "cyan"}>締め切り {fmtDate(item.deadline)}</Badge>}</div>
      {latest && (
        <Card className="grid gap-3 p-5" style={{ borderColor: latest.resubmit ? T.warning : T.success }}>
          <div className="flex flex-wrap items-center gap-2"><b className="text-[15px]" style={{ color: T.textPrimary }}>レビューの結果</b><Badge tone={latest.resubmit ? "amber" : "green"}>{latest.resubmit ? "直して出してください" : "結果あり"}</Badge><small style={{ color: T.textMuted }}>{fmtDate(latest.publishedAt)} 公開{reviews.length > 1 ? ` ・ ${reviews.length}回目` : ""}</small></div>
          {latest.teacherComment && <p className="m-0 rounded-xl px-3 py-2 text-sm" style={{ background: T.accentSubtle, color: T.textPrimary }}>{latest.teacherComment}</p>}
          {latest.summary && <p className="m-0 text-sm" style={{ color: T.textSecondary }}>{latest.summary}</p>}
          <ReviewBody review={latest} />
          {reviews.length > 1 && <details><summary className="cursor-pointer text-sm font-semibold" style={{ color: T.textMuted }}>前の結果（{reviews.length - 1}件）</summary><ul className="m-0 mt-2 grid list-none gap-1 p-0 text-sm">{reviews.slice(1).map(r => <li key={r.revId} className="flex gap-3"><span style={{ color: T.textMuted }}>{fmtDate(r.publishedAt)}</span><b className="tabular-nums">{r.total}点</b></li>)}</ul></details>}
        </Card>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="grid gap-3 p-5">
          <b className="text-[15px]" style={{ color: T.textPrimary }}>問題</b>
          <FileList files={problem} courseId={courseId} empty="問題のファイルはまだありません" />
          {item.requirements?.length > 0 && <div className="grid gap-1"><small className="font-bold" style={{ color: T.textMuted }}>満たすこと</small>{item.requirements.map(r => <div key={r.id} className="text-[13px]" style={{ color: T.textPrimary }}><b className="mr-1 font-mono text-xs" style={{ color: T.accent }}>{r.id}</b>{r.text}</div>)}</div>}
          {item.scope?.length > 0 && <div className="flex flex-wrap gap-1.5">{item.scope.map(s => <Badge key={s} tone="cyan">{s}</Badge>)}</div>}
        </Card>
        <Card className="grid gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2"><b className="text-[15px]" style={{ color: T.textPrimary }}>提出</b><small style={{ color: T.textMuted }}>自分と講師だけが見られる・何回でも出せる</small></div>
          <div className="grid justify-items-center gap-2 rounded-2xl border-2 border-dashed p-5 text-sm" style={{ borderColor: T.border, background: "#F6F8FB", color: T.textSecondary }}>
            <b style={{ color: T.textPrimary }}>プロジェクトのフォルダか zip を出す</b>
            <span className="flex flex-wrap justify-center gap-2"><PickFiles folder label="フォルダを選ぶ" disabled={!!busy} onPick={submit} /><PickFiles label="ファイル・zip を選ぶ" disabled={!!busy} onPick={submit} /></span>
            {busy.startsWith("up") && <span className="text-xs">出しています… {busy.slice(3)}</span>}
          </div>
          {msg.text && <div className="rounded-lg px-3 py-2 text-xs" role={msg.kind === "ng" ? "alert" : "status"} style={{ background: msg.kind === "ng" ? T.dangerSubtle : T.successSubtle, color: msg.kind === "ng" ? T.danger : T.success }}>{msg.text}</div>}
          {batches.length ? batches.map((b, i) => (
            <div key={b} className="grid gap-1"><small className="font-bold" style={{ color: T.textMuted }}>{b.replace(/\.(\d\d)$/, ":$1")} {i === 0 && <Badge tone="cyan">いちばん新しい</Badge>}{item.deadline && Date.parse(b.replace(" ", "T").replace(/\.(\d\d)$/, ":$1")) > Date.parse(item.deadline) && <Badge tone="amber">遅れ</Badge>}</small>
              <FileList files={files.filter(f => f.name.startsWith(`${b}/`)).map(f => ({ ...f, name: f.name.slice(b.length + 1) }))} courseId={courseId} /></div>
          )) : <p className="m-0 text-sm" style={{ color: T.textMuted }}>まだ出していません</p>}
        </Card>
      </div>
    </div>
  );
}

export default function DevReview({ role }) {
  const teacher = role === "admin" || role === "instructor";
  const [courses, setCourses] = useState(null);
  const [courseId, setCourseId] = useState(getActiveCourseId());
  const [open, setOpen] = useState("");
  useEffect(() => {
    apiGet("/courses").then(list => {
      const cs = (Array.isArray(list) ? list : []).filter(c => c.deleted !== true);
      setCourses(cs);
      setCourseId(cur => (cs.some(c => c.courseId === cur) ? cur : cs[0]?.courseId || ""));
    }).catch(() => setCourses([]));
  }, []);
  const pick = c => { setCourseId(c); setActiveCourseId(c); setOpen(""); };
  if (courses == null) return <div><SectionHead title="個人開発" /><Card className="p-4"><SkeletonRows rows={3} /></Card></div>;
  if (!courses.length || !courseId) return <div><SectionHead title="個人開発" /><Card className="p-6 text-center text-sm" style={{ color: T.textMuted }}>コースがありません</Card></div>;
  if (teacher) return <React.Suspense fallback={<Card className="p-4"><SkeletonRows rows={4} /></Card>}><DevReviewTeacher courseId={courseId} coursePick={<CoursePick courses={courses} value={courseId} onChange={pick} />} /></React.Suspense>;
  return (
    <div className="grid gap-4">
      {!open && <SectionHead title="個人開発" action={<CoursePick courses={courses} value={courseId} onChange={pick} />} />}
      {open ? <TraineeTask courseId={courseId} id={open} back={() => setOpen("")} /> : <TraineeList courseId={courseId} open={setOpen} />}
    </div>
  );
}

