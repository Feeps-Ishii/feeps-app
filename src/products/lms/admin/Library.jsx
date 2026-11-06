import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { TestBuilder, normalizeTest, testCourseIdList, testQuestionsOf } from "../../training/TrainingComponents.jsx";
import { testIdOf } from "../../training/useTraining.js";
import { CreateModal, Editor } from "../instructor/Practice.jsx";
import { Icon } from "../parts/icons.jsx";
import { Btn, Card, Chip, Modal } from "../parts/ui.jsx";
import { arr, errText, md } from "../staff/common.js";
import { TestFileModal } from "../staff/TestFile.jsx";

/* 全コース共通のテスト・練習問題（モック libS）：分類ごとにフォルダのように並べる。押すと中身の窓（litModal）。
   テストは common の印か、どのコースにも出していないもの。練習問題は /practice/common */

const NAME = { test: "テスト", prac: "練習問題" };
const q2 = id => `/practice/${encodeURIComponent(id)}?courseId=common`;
const readCats = k => { try { return JSON.parse(localStorage.getItem(`lms.libCats.${k}`) || "[]"); } catch { return []; } };
const saveCats = (k, l) => { try { localStorage.setItem(`lms.libCats.${k}`, JSON.stringify(l)); } catch { /* この画面の間だけ残る */ } };

// 一覧を読む（カリキュラムの棚からも使う）
export function useLib(kind) {
  const [st, setSt] = useState({ state: "loading", rows: [], courses: [] });
  const load = useCallback(() => {
    const names = apiGet("/courses").then(arr).catch(() => []);
    const list = kind === "test"
      ? apiGet("/tests").then(l => arr(l).filter(t => t.status !== "archived").map(normalizeTest).filter(t => t.common || !testCourseIdList(t).length).map(t => ({ id: testIdOf(t), t: t.title, cat: t.category || "", n: testQuestionsOf(t).length, min: t.limitMinutes || 0, used: testCourseIdList(t), at: t.updatedAt || t.createdAt || "", raw: t })))
      : apiGet("/practice/common").then(r => arr(r?.items).map(s => ({ id: s.id, t: s.title || "題名なし", cat: s.category || "", n: s.counts?.questions || 0, used: arr(s.usedIn), at: s.updatedAt || "", raw: s })));
    return Promise.all([list, names]).then(([rows, courses]) => setSt({ state: "ready", rows, courses })).catch(() => setSt({ state: "error", rows: [], courses: [] }));
  }, [kind]);
  useEffect(() => { load(); }, [load]);
  return { ...st, reload: load };
}
export const qtyOf = (kind, x) => (kind === "test" ? `${x.n} 問${x.min ? ` ・ ${x.min} 分` : ""}` : `${x.n} 問`);

export function LitModal({ kind, row, courses, cats, onClose, onEdit, onChanged, say }) {
  const [qs, setQs] = useState(kind === "test" ? testQuestionsOf(row.raw).slice(0, 4).map(q => q.q || q.question || "") : null);
  const [cat, setCat] = useState(row.cat); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => {
    if (kind !== "prac") return undefined;
    let alive = true;
    apiGet(q2(row.id)).then(r => { if (alive) setQs(arr(r?.set?.lessons).flatMap(l => arr(l.questions)).slice(0, 4).map(x => x.title || `問題 ${x.n}`)); }).catch(() => { if (alive) setQs([]); });
    return () => { alive = false; };
  }, [kind, row.id]);
  const saveCat = async () => {
    if (cat.trim() === row.cat) return;
    try { await (kind === "test" ? apiPut(`/tests/${encodeURIComponent(row.id)}`, { category: cat.trim() }) : apiPut(`/practice/${encodeURIComponent(row.id)}/category?courseId=common`, { category: cat.trim() })); say?.("分類を変えました"); onChanged(); }
    catch (e) { setErr(errText(e, "分類を変えられませんでした")); }
  };
  const copy = async () => {
    setBusy(true); setErr("");
    try {
      if (kind === "test") { const { testId, id, createdAt, updatedAt, createdBy, ...rest } = row.raw; await apiPost("/tests", { ...rest, title: `${row.t}（写し）`, status: "draft", courseIds: [], courseId: "", common: true }); }
      else await apiPost(`/practice/${encodeURIComponent(row.id)}/copy?courseId=common`, { toCourseId: "common" });
      say?.(`${row.t} を写しました`); onChanged(); onClose();
    } catch (e) { setErr(errText(e, "写せませんでした")); setBusy(false); }
  };
  const used = row.used.map(id => courses.find(c => c.courseId === id)?.name || id);
  return (
    <Modal title={row.t} width={600} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>閉じる</Btn><Btn kind="ghost" disabled={busy} onClick={copy}>写す</Btn><Btn disabled={busy} onClick={() => onEdit(row)}>直す</Btn></>}>
      <div className="row"><Icon k={kind} size={16} /><Chip>{NAME[kind]}</Chip></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      <div className="rowsx">
        <div><span>問題数</span><b>{row.n} 問</b></div>
        {kind === "test" && <div><span>時間の目安</span><b>{row.min ? `${row.min} 分` : "—"}</b></div>}
        <div><span>更新</span><b>{row.at ? md(row.at.slice(0, 10)) : "—"}</b></div>
      </div>
      <label className="field">分類<input type="text" list="lib-cats" maxLength={40} value={cat} onChange={e => setCat(e.target.value)} onBlur={saveCat} /><datalist id="lib-cats">{cats.map(c => <option key={c} value={c} />)}</datalist></label>
      <div className="field">問題（はじめの {arr(qs).length} 問）{qs === null ? <div className="dv-mt">読み込み中</div> : <ol className="litq">{qs.map((t, i) => <li key={i}>{t}</li>)}</ol>}</div>
      <div className="field">使用中のコース<span className="row">{used.length ? used.map(n => <Chip key={n}>{n}</Chip>) : <span className="fs-inh">まだ</span>}</span></div>
    </Modal>
  );
}

function Lib({ kind, say }) {
  const nm = NAME[kind], lib = useLib(kind);
  const [cur, setCur] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("new");
  const [extra, setExtra] = useState(() => readCats(kind)); const [newCat, setNewCat] = useState(null);
  const [lit, setLit] = useState(null); const [making, setMaking] = useState(false); const [edit, setEdit] = useState(null);
  const cats = useMemo(() => [...new Set([...lib.rows.map(x => x.cat).filter(Boolean), ...extra])].sort((a, b) => a.localeCompare(b, "ja")), [lib.rows, extra]);
  if (edit) {
    if (kind === "prac") return <Editor courseId="common" id={edit.id} say={say} onBack={() => { setEdit(null); lib.reload(); }} />;
    return <div className="lms-legacy"><TestBuilder mode="manual" initialTest={edit.raw} back={() => { setEdit(null); lib.reload(); }} onSaved={() => lib.reload()} /></div>;
  }
  const nameOf = id => lib.courses.find(c => c.courseId === id)?.name || id;
  const by = { new: (a, b) => String(b.at).localeCompare(String(a.at)), name: (a, b) => a.t.localeCompare(b.t, "ja"), used: (a, b) => b.used.length - a.used.length, none: (a, b) => a.used.length - b.used.length }[sort];
  const rows = lib.rows.filter(x => (cur === "all" || x.cat === cur) && (!q.trim() || x.t.includes(q.trim()))).sort(by);
  const node = (k, t, n) => <button key={k} type="button" className="fs-n" aria-current={cur === k} onClick={() => setCur(k)}>{k !== "all" && <Icon k={kind} size={15} />}<span>{t}</span><em className="num">{n}</em></button>;
  const addCat = () => { const t = String(newCat || "").trim(); if (t) { const l = [...new Set([...extra, t])]; setExtra(l); saveCats(kind, l); say?.("分類を足しました"); } setNewCat(null); };
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">全コース共通</div><h1 className="h1">{nm}</h1></div>
        <span className="r"><Btn kind="ghost sm" onClick={() => setNewCat("")}>＋ 分類</Btn><a className="btn ghost sm" href={`/templates/${kind === "test" ? "test" : "practice"}-template.xlsx`} download={`${nm}ひな形.xlsx`}>{nm}ひな形</a><Btn kind="sm" onClick={() => setMaking(true)}>{kind === "test" ? "資料から作る" : "Word から作る"}</Btn></span>
      </div>
      {lib.state === "loading" ? <div className="soon card">読み込み中</div> : lib.state === "error" ? <Card><div className="empty"><b>{nm}を確認できません</b><Btn kind="ghost sm" onClick={lib.reload}>再読み込み</Btn></div></Card> : (
        <div className="fsw">
          <nav className="card fs-tree" aria-label={`${nm}の分類`}><div className="fs-sec"><span className="eyebrow">分類</span></div>{node("all", "すべて", lib.rows.length)}{cats.map(c => node(c, c, lib.rows.filter(x => x.cat === c).length))}</nav>
          <section className="card fs-main">
            <div className="fs-top">
              <div className="fs-bc"><span className="fs-scope cm">{nm}</span><i>›</i><b>{cur === "all" ? "すべて" : cur}</b></div>
              <span className="row"><span className="fsearch"><input type="search" value={q} placeholder={`${nm}を探す`} aria-label={`${nm}を探す`} onChange={e => setQ(e.target.value)} /></span><label className="fsort">並べ替え<select value={sort} onChange={e => setSort(e.target.value)}><option value="new">更新の新しい順</option><option value="name">名前順</option><option value="used">使用中のコースの多い順</option><option value="none">まだ使っていないを上に</option></select></label></span>
            </div>
            <div className="scroll"><table className="tbl fs-t"><thead><tr><th>名前</th><th>分類</th><th>{kind === "test" ? "問題数・時間" : "問題数"}</th><th>使用中のコース</th><th>更新</th></tr></thead><tbody>
              {rows.map(x => (
                <tr key={x.id}>
                  <td><button type="button" className="fs-name" onClick={() => setLit(x)}><Icon k={kind} size={16} /><span>{x.t}</span></button></td>
                  <td>{x.cat || "—"}</td>
                  <td className="num">{qtyOf(kind, x)}</td>
                  <td>{x.used.length ? <span className="row">{x.used.map(id => <Chip key={id}>{nameOf(id)}</Chip>)}</span> : <span className="fs-inh">まだ</span>}</td>
                  <td className="num">{x.at ? md(x.at.slice(0, 10)) : "—"}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5}><Chip>なし</Chip></td></tr>}
            </tbody></table></div>
          </section>
        </div>
      )}
      {lit && <LitModal kind={kind} row={lit} courses={lib.courses} cats={cats} say={say} onClose={() => setLit(null)} onEdit={r => { setLit(null); setEdit(r); }} onChanged={lib.reload} />}
      {newCat !== null && <Modal title="分類を足す" width={420} onClose={() => setNewCat(null)} footer={<><Btn kind="ghost" onClick={() => setNewCat(null)}>やめる</Btn><Btn onClick={addCat}>足す</Btn></>}><label className="field">分類の名前<input type="text" autoFocus maxLength={40} value={newCat} onChange={e => setNewCat(e.target.value)} /></label></Modal>}
      {making && kind === "test" && <TestFileModal onClose={() => setMaking(false)} onSaved={(t, s) => { setMaking(false); say?.(s === "published" ? `「${t.title}」を公開しました` : `「${t.title}」を下書きで保存しました`); lib.reload(); }} />}
      {making && kind === "prac" && <CreateModal courseId="common" onClose={() => setMaking(false)} onMade={id => { setMaking(false); setEdit({ id }); }} />}
    </div>
  );
}

export function AdminTestLib({ say }) { return <Lib kind="test" say={say} />; }
export function AdminPracLib({ say }) { return <Lib kind="prac" say={say} />; }
