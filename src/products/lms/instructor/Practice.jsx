import React, { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { CodeBlock, Items, Sheet, Style } from "../../training/PracticeView.jsx";
import { practiceNumLabel as numLabel } from "../../training/practiceLinks.js";
import { Btn, Card, Chip, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, errText, md, useRoster, useStaffCourse } from "../staff/common.js";

/* 練習問題（講師・管理者。モック pracS）：問題集の一覧と受講生の「できた」の進み、Word から作る、直す・公開。
   問題の見え方は受講生と同じ部品（training/PracticeView.jsx）。API は routes/practice.mjs */

const q = (c, extra = "") => `?courseId=${encodeURIComponent(c)}${extra}`;
const pid = id => encodeURIComponent(id);
const STATUS = { new: ["Word を送る前", ""], building: ["AI が作っています", "warn"], draft: ["下書き", "warn"], published: ["公開中", "ok"] };

async function waitJob(courseId, id, jobId, onTick) {
  for (let i = 0; i < 120; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(r => setTimeout(r, 5000));
    // eslint-disable-next-line no-await-in-loop
    const r = await apiGet(`/practice/${pid(id)}/jobs/${encodeURIComponent(jobId)}${q(courseId)}`);
    if (r.status === "done") return r;
    if (r.status === "error") throw new Error(r.error || "問題集にできませんでした");
    onTick?.(i);
  }
  throw new Error("時間がかかりすぎています。少し待ってから開き直してください");
}
async function putFile(url, file, contentType) {
  const r = await fetch(url, { method: "PUT", headers: { "content-type": contentType }, body: file });
  if (!r.ok) throw new Error(`「${file.name}」を送れませんでした（${r.status}）`);
}

function CreateModal({ courseId, onClose, onMade }) {
  const [title, setTitle] = useState("");
  const [prob, setProb] = useState(null); const [ans, setAns] = useState(null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const isDocx = f => !f || /\.docx$/i.test(f.name);
  const make = async () => {
    if (!prob) { setErr("問題の Word を選んでください"); return; }
    if (!isDocx(prob) || !isDocx(ans)) { setErr("Word（.docx）を選んでください"); return; }
    setErr(""); setBusy("Word を送っています");
    try {
      const c = await apiPost("/practice", { courseId, title: title.trim() });
      await putFile(c.uploads.problem, prob, c.uploads.contentType);
      if (ans) await putFile(c.uploads.answer, ans, c.uploads.contentType);
      setBusy("AI が問題集にしています");
      const { jobId } = await apiPost(`/practice/${pid(c.item.id)}/build${q(courseId)}`, { hasAnswer: !!ans, problemName: prob.name, answerName: ans?.name || "" });
      await waitJob(courseId, c.item.id, jobId, i => setBusy(`AI が問題集にしています（${(i + 1) * 5} 秒）`));
      onMade(c.item.id);
    } catch (e) { setErr(errText(e, "作れませんでした")); setBusy(""); }
  };
  return (
    <Modal title="練習問題を作る" width={520} onClose={() => !busy && onClose()} footer={<><Btn kind="ghost" disabled={!!busy} onClick={onClose}>やめる</Btn><Btn disabled={!!busy} onClick={make}>問題集を作る</Btn></>}>
      <label className="field">問題の Word（必須）<input type="file" accept=".docx" disabled={!!busy} onChange={e => setProb(e.target.files?.[0] || null)} /></label>
      <label className="field">解答の Word<input type="file" accept=".docx" disabled={!!busy} onChange={e => setAns(e.target.files?.[0] || null)} /></label>
      <label className="field">題名（空なら Word から）<input type="text" maxLength={120} value={title} disabled={!!busy} onChange={e => setTitle(e.target.value)} /></label>
      {busy && <Chip tone="mk">{busy}</Chip>}
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

function Editor({ courseId, id, onBack, say }) {
  const [st, setSt] = useState("loading");
  const [set, setSet] = useState(null); const [meta, setMeta] = useState(null);
  const [sections, setSections] = useState([]);
  const [qid, setQid] = useState("");
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const [conf, setConf] = useState(null);
  useEffect(() => {
    let alive = true;
    apiGet(`/practice/${pid(id)}${q(courseId)}`).then(r => { if (!alive) return; setMeta(r.item); setSet(r.set); setQid(r.set?.lessons?.[0]?.questions?.[0]?.id || ""); setSt("ready"); }).catch(() => { if (alive) setSt("error"); });
    apiGet(`/courses/${encodeURIComponent(courseId)}/curriculum`).then(c => { if (alive) setSections(arr(c?.sections).map(s => ({ id: s.id, title: s.title || s.categoryTitle || "" })).filter(s => s.id)); }).catch(() => {});
    return () => { alive = false; };
  }, [courseId, id]);
  const cur = useMemo(() => set?.lessons.flatMap(l => l.questions).find(x => x.id === qid) || null, [set, qid]);
  const edit = fn => { setSet(s => { const n = structuredClone(s); fn(n); return n; }); setDirty(true); };
  const editQ = fn => edit(n => { n.lessons.forEach(l => l.questions.forEach(x => { if (x.id === qid) fn(x); })); });
  const save = async publish => {
    setBusy(publish ? "publish" : "save"); setErr("");
    try {
      let r = await apiPut(`/practice/${pid(id)}${q(courseId)}`, { title: set.title, lessons: set.lessons, warnings: set.warnings || [], showAnswers: meta.showAnswers !== false, dueDate: meta.dueDate || "" });
      if (publish) r = await apiPost(`/practice/${pid(id)}/publish${q(courseId)}`, {});
      setMeta(r.item); setDirty(false);
      say?.(publish ? "公開しました" : "保存しました");
    } catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(""); }
  };
  const hide = async () => { setBusy("hide"); setErr(""); try { const r = await apiPost(`/practice/${pid(id)}/hide${q(courseId)}`, {}); setMeta(r.item); say?.("公開をやめました"); } catch (e) { setErr(errText(e, "公開をやめられませんでした")); } finally { setBusy(""); } };
  const remove = async () => { setErr(""); try { await apiDelete(`/practice/${pid(id)}${q(courseId)}`); say?.("消しました"); onBack(); } catch (e) { setErr(errText(e, "消せませんでした")); } };
  if (st === "loading") return <div className="soon card">読み込み中</div>;
  if (st === "error" || !set) return <Card><div className="empty"><b>練習問題を確認できません</b><Btn kind="ghost sm" onClick={onBack}>一覧へ</Btn></div></Card>;
  const [label, tone] = STATUS[meta?.status] || STATUS.draft;
  const back = () => { if (dirty) setConf({ title: "保存していない変更があります", ok: "保存せずに戻る", note: "保存していない変更は消える", run: onBack }); else onBack(); };
  return (
    <div className="st">
      <Style />
      <div className="head"><div><div className="eyebrow">練習問題</div><h1 className="h1">{set.title || "題名なし"}</h1></div>
        <span className="r"><Btn kind="ghost sm" onClick={back}>← 一覧</Btn><Btn kind="ghost sm" onClick={() => setPreview(p => !p)}>{preview ? "直す画面へ" : "受講生の見え方"}</Btn>{meta?.status === "published" && <Btn kind="ghost sm" disabled={!!busy} onClick={hide}>公開をやめる</Btn>}<Btn kind="ghost sm" onClick={() => setConf({ title: "この練習問題を消す", ok: "消す", note: "受講生の「できた」も見えなくなる", run: remove })}>消す</Btn><Btn kind="ghost sm" disabled={!!busy || !dirty} onClick={() => save(false)}>保存</Btn><Btn kind="sm" disabled={!!busy} onClick={() => save(true)}>{meta?.status === "published" ? "公開し直す" : "公開する"}</Btn></span>
      </div>
      <div className="row"><Chip tone={tone}>{label}</Chip>{meta?.hasDraftChanges && <Chip tone="warn">公開中のものと違う下書き</Chip>}{dirty && <Chip tone="warn">保存していない変更</Chip>}{set.source?.problem && <Chip>元 {set.source.problem}{set.source.answer ? ` ・ ${set.source.answer}` : ""}</Chip>}</div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {preview ? <Sheet meta={meta} set={set} showAnswers={meta?.showAnswers !== false} /> : (
        <>
          <Card className="pad st-g">
            <div className="ce-g3"><label className="field">題名<input type="text" maxLength={120} value={set.title} onChange={e => edit(n => { n.title = e.target.value; })} /></label><label className="field">締め切り<input type="date" value={meta?.dueDate || ""} onChange={e => { setMeta(m => ({ ...m, dueDate: e.target.value })); setDirty(true); }} /></label><label className="st-ck pc-ck"><input type="checkbox" checked={meta?.showAnswers !== false} onChange={e => { setMeta(m => ({ ...m, showAnswers: e.target.checked })); setDirty(true); }} />受講生に解答を見せる</label></div>
            {arr(set.warnings).map((w, i) => <div key={i} className="ce-tr"><Chip tone="warn">注意</Chip><span>{w}</span><span className="r"><button type="button" className="x2" aria-label="この注意を消す" onClick={() => edit(n => { n.warnings.splice(i, 1); })}>×</button></span></div>)}
            {set.lessons.map((l, li) => <label key={l.id} className="field">{l.no} {l.name}<select className="in" value={l.sectionId || ""} onChange={e => edit(n => { n.lessons[li].sectionId = e.target.value; })}><option value="">カリキュラムと結ばない</option>{sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>)}
          </Card>
          <div className="fsw">
            <nav className="card fs-tree" aria-label="問題">
              {set.lessons.map(l => (
                <React.Fragment key={l.id}>
                  <div className="fs-sec"><span className="eyebrow">{l.no} {l.name}</span></div>
                  {l.questions.map(x => <button key={x.id} type="button" className="fs-n" aria-current={qid === x.id} onClick={() => setQid(x.id)}><span>問題{x.n} {x.title}</span><em>{x.answer ? "" : "解答なし ・ "}ヒント {x.hints.length}</em></button>)}
                </React.Fragment>
              ))}
            </nav>
            {cur && (
              <div className="st">
                <Card className="pad st-g">
                  <div className="ce-exh pc-qh"><input type="text" maxLength={80} value={cur.title} aria-label="問題の名前" onChange={e => editQ(x => { x.title = e.target.value; })} /><select className="in" aria-label="問題の種類" value={cur.type} onChange={e => editQ(x => { x.type = e.target.value; })}><option value="answer">答える</option><option value="build">作る</option></select></div>
                  <div className="pq-q pc-parts"><Items items={cur.parts} images={set.images} onZoom={() => {}} /></div>
                </Card>
                <Card className="pad st-g">
                  <div className="head"><h2 className="h3">ヒント</h2><span className="r"><Chip tone="mk">AI の下書き</Chip>{cur.hints.length < 6 && <Btn kind="ghost sm" onClick={() => editQ(x => { x.hints.push(""); })}>＋ ヒント</Btn>}</span></div>
                  {cur.hints.map((h, i) => <div key={i} className="pc-h"><Chip>ヒント {i + 1}</Chip><textarea rows={2} maxLength={300} value={h} aria-label={`ヒント ${i + 1}`} onChange={e => editQ(x => { x.hints[i] = e.target.value; })} /><button type="button" className="x2" aria-label={`ヒント ${i + 1} を消す`} onClick={() => editQ(x => { x.hints.splice(i, 1); })}>×</button></div>)}
                  {!cur.hints.length && <Chip>なし</Chip>}
                </Card>
                <Card className="pad st-g">
                  <div className="head"><h2 className="h3">解答</h2><span className="r">{cur.answer ? <Chip>解答の Word から</Chip> : <Chip tone="warn">解答の Word にこの問題なし</Chip>}</span></div>
                  {arr(cur.answer?.rows).map((r, i) => <div key={i} className="pc-a"><b className="num">({i + 1})</b><textarea rows={1} value={r[0]} aria-label={`(${i + 1}) の解答`} onChange={e => editQ(x => { x.answer.rows[i][0] = e.target.value; })} /><textarea rows={1} value={r[1]} aria-label={`(${i + 1}) の解説`} onChange={e => editQ(x => { x.answer.rows[i][1] = e.target.value; })} /></div>)}
                  {arr(cur.answer?.files).map((f, i) => <CodeBlock key={i} fn={f.fn} code={f.code} />)}
                  {arr(cur.answer?.points).length > 0 && <div><span className="eyebrow">ポイント</span><ul className="pc-pts">{cur.answer.points.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
                </Card>
              </div>
            )}
          </div>
        </>
      )}
      {conf && <Modal title={conf.title} width={440} onClose={() => setConf(null)} footer={<><Btn kind="ghost" onClick={() => setConf(null)}>やめる</Btn><Btn onClick={() => { const c = conf; setConf(null); c.run(); }}>{conf.ok}</Btn></>}><Chip tone="warn">{conf.note}</Chip></Modal>}
    </div>
  );
}

export default function InstructorPractice({ say }) {
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const { list: roster } = useRoster(courseId);
  const [sets, setSets] = useState(undefined);
  const [key, setKey] = useState(0);
  const [making, setMaking] = useState(false);
  const [editing, setEditing] = useState("");
  const [open, setOpen] = useState(null);
  const [tab, setTab] = useState("all"); const [text, setText] = useState(""); const [sort, setSort] = useState("low"); const [pq, setPq] = useState("");
  useEffect(() => {
    if (!courseId) return undefined;
    let alive = true;
    setSets(undefined);
    apiGet(`/practice${q(courseId)}`).then(async r => {
      const items = arr(r?.items);
      const full = await Promise.all(items.map(s => (s.status === "published" ? apiGet(`/practice/${pid(s.id)}/progress${q(courseId)}`).then(p => ({ ...s, rows: arr(p?.items) })).catch(() => ({ ...s, rows: null })) : Promise.resolve(s))));
      if (alive) setSets(full);
    }).catch(() => { if (alive) setSets(null); });
    return () => { alive = false; };
  }, [courseId, key]);
  if (sc.state === "loading") return <div className="soon card">読み込み中</div>;
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (!courseId) return <Card><div className="empty"><b>担当のコース</b><Chip>なし</Chip></div></Card>;
  if (editing) return <Editor courseId={courseId} id={editing} say={say} onBack={() => { setEditing(""); setKey(k => k + 1); }} />;
  const n = roster?.length || 0;
  const avgOf = s => { const c = s.counts?.questions || 0; return c && n && s.rows ? Math.round(s.rows.reduce((a, r) => a + r.done, 0) / (c * n) * 100) : 0; };
  const all = arr(sets);
  const list = all.filter(s => (!text.trim() || String(s.title || "").includes(text.trim())) && (tab === "all" || s.status === tab)).sort(
    sort === "due" ? (a, b) => String(a.dueDate || "9").localeCompare(String(b.dueDate || "9")) : sort === "name" ? (a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ja") : (a, b) => avgOf(a) - avgOf(b),
  );
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{sc.course?.name}</div><h1 className="h1">練習問題</h1></div><span className="r"><Btn kind="sm" onClick={() => setMaking(true)}>Word から作る</Btn></span></div>
      {sets === null ? <Card><div className="empty"><b>練習問題を確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card> : sets === undefined ? <div className="soon card">読み込み中</div> : (
        <>
          <ListTool tabs={[["all", "すべて", all.length], ["published", "公開中", all.filter(s => s.status === "published").length, "ok"], ["draft", "下書き", all.filter(s => s.status === "draft").length, "warn"]]} tab={tab} onTab={setTab} q={text} onQ={setText} placeholder="問題集を探す" sorts={[["low", "進みの低い順"], ["due", "締め切りの近い順"], ["name", "名前順"]]} sort={sort} onSort={setSort} />
          <Card className=""><div className="scroll"><table className="tbl pc-t"><thead><tr><th>問題集</th><th>状態</th><th>問題</th><th>締め切り</th><th>できた（平均）</th><th /></tr></thead><tbody>
            {list.map(s => {
              const [label, tone] = STATUS[s.status] || STATUS.draft, wip = s.status === "new" || s.status === "building";
              return (
                <tr key={s.id}>
                  <td><b>{s.title || "題名なし"}</b><small className="adsm">{arr(s.lessons).map(l => `${l.no} ${numLabel(l.nums)}`).join(" / ")}</small></td>
                  <td><span className="row"><Chip tone={tone}>{label}</Chip>{s.hasDraftChanges && <Chip tone="warn">変更あり</Chip>}{arr(s.warnings).length > 0 && <Chip tone="warn">注意 {s.warnings.length}</Chip>}</span></td>
                  <td className="num">{s.counts?.questions || 0}</td>
                  <td className="num">{s.dueDate ? md(s.dueDate) : "—"}</td>
                  <td>{s.status !== "published" ? "—" : s.rows === null ? <Chip tone="bad">確認できません</Chip> : <span className="row sx-nw"><span className="tp-bar sm pc-bar"><i style={{ "--w": `${avgOf(s)}%` }} /></span><b className="num">{avgOf(s)}%</b></span>}</td>
                  <td><span className="row sx-nw">{s.status === "published" && s.rows && <Btn kind="ghost sm" onClick={() => { setPq(""); setOpen(s); }}>人ごと</Btn>}<Btn kind="ghost sm" disabled={wip} onClick={() => setEditing(s.id)}>直す</Btn></span></td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={6}><Chip>なし</Chip></td></tr>}
          </tbody></table></div></Card>
        </>
      )}
      {making && <CreateModal courseId={courseId} onClose={() => setMaking(false)} onMade={id => { setMaking(false); setEditing(id); }} />}
      {open && (
        <Modal title={open.title} width={520} onClose={() => setOpen(null)} footer={<Btn kind="ghost" onClick={() => setOpen(null)}>閉じる</Btn>}>
          <span className="fsearch pc-q"><input type="search" value={pq} placeholder="名前で探す" aria-label="名前で探す" onChange={e => setPq(e.target.value)} /></span>
          <div className="tp-ub">
            {arr(roster).filter(p => matchName(p.name, p.kana, pq)).map(p => ({ ...p, done: open.rows.find(r => r.traineeId === p.id)?.done || 0 })).sort((a, b) => a.done - b.done).map(p => { const c = open.counts?.questions || 0; return <div key={p.id} className="st-pr"><span>{p.name}</span><span className="tp-bar sm"><i style={{ "--w": `${c ? Math.round(p.done / c * 100) : 0}%` }} /></span><b className="num">{p.done} / {c}</b></div>; })}
          </div>
        </Modal>
      )}
    </div>
  );
}
