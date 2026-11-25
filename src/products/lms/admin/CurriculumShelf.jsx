import React, { useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { makeLocalId } from "../../training/TrainingComponents.jsx";
import { fmtSize } from "../../training/DevReview.jsx";
import { todayStr } from "../../training/useTraining.js";
import { CreateModal, Editor } from "../instructor/Practice.jsx";
import { Icon } from "../parts/icons.jsx";
import { Btn, Card, Chip, FileIcon, Modal } from "../parts/ui.jsx";
import { arr, errText, md, saveXlsx } from "../staff/common.js";
import { TestFileModal } from "../staff/TestFile.jsx";
import { LitModal, qtyOf, useLib } from "./Library.jsx";
import { SORTS, UnitKinds, matches, sortUnits, useShelf } from "./unitShelf.jsx";

/* 単元（2026-11-24 作り直し、モック docs/design/mockups/devhub-lms-2026-10/lms-units.html）：
   全コース共通の単元を 1 つの一覧で持つ。単元の中に資料・テスト・練習問題をまとめて置き、コースは必要な単元を足して組む
   （足した時点でコースへ写す。あとで単元を直してもコースには届かない）。前のカリキュラム → 単元の 2 段はやめた。
   変えたらすぐ保存する。API は /curriculum-library。資料の実体は共有フォルダの「カリキュラムの資料」（講師まで）に置く */

const FOLDER = "カリキュラムの資料";
const newUnit = () => ({ id: makeLocalId("su"), title: "新しい単元", goals: [], content: "", exercises: [], testIds: [], pracIds: [], files: [], at: todayStr() });
const lines = t => String(t || "").split("\n").map(v => v.trim()).filter(Boolean);

// 一覧から足す（テスト・練習問題）
function PickModal({ kind, lib, has, onClose, onPick }) {
  const [sel, setSel] = useState({}); const [q, setQ] = useState("");
  const rows = lib.rows.filter(x => !has.includes(x.id) && (!q.trim() || x.t.includes(q.trim())));
  const ids = Object.keys(sel).filter(k => sel[k]);
  return (
    <Modal title={`${kind === "test" ? "テスト" : "練習問題"}を足す`} width={520} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={!ids.length} onClick={() => onPick(ids)}>{ids.length} 件を足す</Btn></>}>
      <span className="fsearch pc-q"><input type="search" value={q} placeholder="名前で探す" aria-label="名前で探す" onChange={e => setQ(e.target.value)} /></span>
      <div className="fs-pick">{rows.map(x => <label key={x.id} className="st-ck fs-pr"><input type="checkbox" checked={!!sel[x.id]} onChange={e => setSel(s => ({ ...s, [x.id]: e.target.checked }))} />{x.t}<small className="num"> {qtyOf(kind, x)}</small></label>)}{!rows.length && <Chip>なし</Chip>}</div>
    </Modal>
  );
}

export default function CurriculumShelf({ say, go }) {
  const shelf = useShelf(), tests = useLib("test"), pracs = useLib("prac");
  const [units, setUnits] = useState([]);
  const saved = useRef("[]"), stamp = useRef("");
  const [ready, setReady] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [q, setQ] = useState(""); const [sort, setSort] = useState("new"); const [picked, setPicked] = useState([]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [dropOn, setDropOn] = useState(false);
  const [dlg, setDlg] = useState(null);
  const [courses, setCourses] = useState([]);
  const [lit, setLit] = useState(null); const [editPrac, setEditPrac] = useState("");
  useEffect(() => {
    if (shelf.state !== "ready" || ready) return;
    setUnits(shelf.units); saved.current = JSON.stringify(shelf.units); stamp.current = shelf.updatedAt; setReady(true);
  }, [shelf.state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { apiGet("/completion-report/courses").then(r => setCourses(arr(r?.courses))).catch(() => {}); }, []);
  // 変えたらすぐ保存する
  useEffect(() => {
    if (!ready) return undefined;
    const body = JSON.stringify(units);
    if (body === saved.current) return undefined;
    const t = setTimeout(() => {
      apiPut("/curriculum-library", { units, expectedUpdatedAt: stamp.current }).then(r => { saved.current = body; stamp.current = r.updatedAt || ""; setErr(""); }).catch(e => setErr(errText(e, "保存できませんでした")));
    }, 400);
    return () => clearTimeout(t);
  }, [units, ready]);

  if (editPrac) return <Editor courseId="common" id={editPrac} say={say} onBack={() => { setEditPrac(""); pracs.reload(); }} />;
  if (shelf.state === "loading") return <div className="soon card">読み込み中</div>;
  if (shelf.state === "error") return <Card><div className="empty"><b>単元を確認できません</b><Btn kind="ghost sm" onClick={shelf.reload}>再読み込み</Btn></div></Card>;

  const U = units.find(u => u.id === unitId) || null;
  const setU = patch => setUnits(l => l.map(u => (u.id === unitId ? { ...u, ...patch } : u)));
  const libOf = kind => (kind === "test" ? tests : pracs);
  const itemOf = (kind, id) => libOf(kind).rows.find(x => x.id === id);
  const nameOf = (kind, id) => itemOf(kind, id)?.t || "見つかりません";
  const courseNames = u => arr(u?.usedIn).map(id => courses.find(c => c.courseId === id)?.name).filter(Boolean);

  const addUnit = () => { const u = newUnit(); setUnits(l => [u, ...l]); setUnitId(u.id); say?.("単元を足しました"); };
  const copyUnit = u => { const c = { ...u, id: makeLocalId("su"), title: `${u.title}（写し）`, usedIn: [], at: todayStr() }; setUnits(l => { const i = l.findIndex(x => x.id === u.id); return [...l.slice(0, i + 1), c, ...l.slice(i + 1)]; }); say?.(`${u.title} を写しました`); return c; };
  // 消すのは単元だけ。資料のファイルは共有フォルダに残す（コースからつないでいることがあるため）
  const removeUnits = ids => { setUnits(l => l.filter(u => !ids.includes(u.id))); setPicked(p => p.filter(id => !ids.includes(id))); if (ids.includes(unitId)) setUnitId(""); say?.(ids.length > 1 ? `${ids.length} 単元を消しました` : "単元を消しました"); };

  const folderId = async () => {
    const d = await apiGet("/library?spaceId=shared");
    const hit = arr(d?.nodes).find(n => n.type === "folder" && n.name === FOLDER && n.parentId === "root");
    if (hit) return hit.nodeId;
    const made = await apiPost("/library/folders", { spaceId: "shared", parentId: "root", name: FOLDER, acl: { scope: "org", roles: { instructor: true } } });
    return made.nodeId;
  };
  const upload = async files => {
    setBusy(true); setErr("");
    try {
      const parentId = await folderId(), added = [];
      for (const f of files) {
        // eslint-disable-next-line no-await-in-loop
        const got = await apiPost("/library/upload-url", { spaceId: "shared", parentId, filename: f.name, contentType: f.type || "application/octet-stream", sizeBytes: f.size });
        // eslint-disable-next-line no-await-in-loop
        const put = await fetch(got.uploadUrl, { method: "PUT", headers: { "content-type": got.contentType }, body: f });
        if (!put.ok) throw new Error(`「${f.name}」を置けませんでした（${put.status}）`);
        // eslint-disable-next-line no-await-in-loop
        await apiPost("/library/files", { spaceId: "shared", parentId, nodeId: got.nodeId, s3key: got.s3key, materialId: got.materialId, name: f.name, sizeBytes: f.size, contentType: got.contentType });
        added.push({ nodeId: got.nodeId, name: f.name, sizeBytes: f.size, at: todayStr() });
      }
      setU({ files: [...arr(U.files), ...added] });
      say?.(`${added.length} ファイルを置きました`);
    } catch (e) { setErr(errText(e, "置けませんでした")); } finally { setBusy(false); }
  };
  const removeFile = async f => {
    setErr("");
    try { await apiDelete(`/library/nodes/${encodeURIComponent(f.nodeId)}?spaceId=shared`); } catch (e) { setErr(errText(e, "消せませんでした")); return; }
    setU({ files: arr(U.files).filter(x => x.nodeId !== f.nodeId) });
  };
  const openFile = async f => {
    setErr("");
    const tab = window.open("", "_blank");
    try { const r = await apiGet(`/library/download?spaceId=shared&nodeId=${encodeURIComponent(f.nodeId)}`); if (tab) tab.location.href = r.url; else window.open(r.url, "_blank"); }
    catch { if (tab) tab.close(); setErr("開けませんでした"); }
  };
  const saveEdit = () => {
    const d = dlg, name = String(d.name || "").trim();
    if (!name) return;
    setU({ title: name, content: d.content || "", goals: lines(d.goals) });
    setDlg(null);
  };
  const exportXlsx = () => saveXlsx("単元", "単元", [["単元", "資料", "テスト", "練習問題", "使っているコース"], ...sortUnits(units, sort).map(u => [u.title, arr(u.files).map(f => f.name).join(" / "), arr(u.testIds).map(id => nameOf("test", id)).join(" / "), arr(u.pracIds).map(id => nameOf("prac", id)).join(" / "), courseNames(u).join(" / ")])]);

  const box = (cls, kind, title, n, body, adds, drop) => (
    <section className={`card lu-box ${cls}${drop && dropOn ? " on" : ""}`}
      {...(drop ? { onDragOver: e => { if (busy) return; e.preventDefault(); setDropOn(true); }, onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOn(false); }, onDrop: e => { e.preventDefault(); setDropOn(false); const fs = [...(e.dataTransfer.files || [])]; if (fs.length && !busy) upload(fs); } } : {})}>
      <div className="lu-bh"><h3 className="h3"><Icon k={kind} size={16} />{title}<em className="num">{n}</em></h3></div>
      {n ? body : <div className="lu-none">なし</div>}
      <div className="lu-adds">{adds}</div>
    </section>
  );
  const linkRow = (kind, id) => {
    const x = itemOf(kind, id), key = kind === "test" ? "testIds" : "pracIds";
    return (
      <div key={id} className="lu-it">
        <span className="lu-fi"><Icon k={kind} size={16} /></span>
        <button type="button" className="lu-nm" disabled={!x} onClick={() => setLit({ kind, row: x })}><b>{nameOf(kind, id)}</b>{x && <small className="num">{qtyOf(kind, x)}</small>}</button>
        <button type="button" className="x2" aria-label={`${nameOf(kind, id)} を外す`} onClick={() => setU({ [key]: arr(U[key]).filter(v => v !== id) })}>×</button>
      </div>
    );
  };

  const delDlg = dlg?.kind === "del" ? units.filter(u => dlg.ids.includes(u.id)) : [];
  const delUsed = [...new Set(delDlg.flatMap(courseNames))];
  const dialogs = (
    <>
      {dlg?.kind === "del" && delDlg.length > 0 && (
        <Modal title={delDlg.length === 1 ? `「${delDlg[0].title || "名前なし"}」を消しますか` : `${delDlg.length} 単元を消しますか`} width={480} onClose={() => setDlg(null)}
          footer={<><Btn kind="ghost" onClick={() => setDlg(null)}>やめる</Btn><Btn kind="lu-danger" onClick={() => { removeUnits(dlg.ids); setDlg(null); }}>消す</Btn></>}>
          <div className="lu-cl">
            <div><span>資料・テスト・演習</span><b className="num">{["files", "testIds", "pracIds"].map(k => delDlg.reduce((a, u) => a + arr(u[k]).length, 0)).join(" ・ ")}</b></div>
            <div><span>使っているコース</span><b>{delUsed.length ? delUsed.join(" ・ ") : "なし"}</b></div>
          </div>
          {delUsed.length > 0 && <div className="lu-warn">コースに入っている分は残ります</div>}
        </Modal>
      )}
      {dlg?.kind === "uedit" && (
        <Modal title="単元を直す" width={520} onClose={() => setDlg(null)} footer={<><Btn kind="ghost" onClick={() => setDlg(null)}>やめる</Btn><Btn onClick={saveEdit}>保存</Btn></>}>
          <label className="field">単元名<input type="text" maxLength={100} value={dlg.name} onChange={e => setDlg(d => ({ ...d, name: e.target.value }))} /></label>
          <label className="field">この単元で学ぶ内容<textarea rows={2} value={dlg.content} onChange={e => setDlg(d => ({ ...d, content: e.target.value }))} /></label>
          <label className="field">目標（1 行に 1 つ）<textarea rows={3} value={dlg.goals} onChange={e => setDlg(d => ({ ...d, goals: e.target.value }))} /></label>
        </Modal>
      )}
      {dlg?.kind === "pick" && U && <PickModal kind={dlg.pick} lib={libOf(dlg.pick)} has={arr(U[dlg.pick === "test" ? "testIds" : "pracIds"])} onClose={() => setDlg(null)} onPick={ids => { const key = dlg.pick === "test" ? "testIds" : "pracIds"; setU({ [key]: [...arr(U[key]), ...ids] }); setDlg(null); }} />}
      {dlg?.kind === "tnew" && U && <TestFileModal onClose={() => setDlg(null)} onSaved={(t, s) => { setDlg(null); setU({ testIds: [...arr(U.testIds), t.testId] }); tests.reload(); say?.(s === "published" ? `「${t.title}」を公開しました` : `「${t.title}」を下書きで保存しました`); }} />}
      {dlg?.kind === "pnew" && U && <CreateModal courseId="common" onClose={() => setDlg(null)} onMade={(id, s) => { setDlg(null); setU({ pracIds: [...arr(U.pracIds), id] }); pracs.reload(); say?.(s === "published" ? "練習問題を公開しました" : "練習問題を下書きで保存しました"); }} />}
      {lit && <LitModal kind={lit.kind} row={lit.row} courses={libOf(lit.kind).courses} cats={[...new Set(libOf(lit.kind).rows.map(x => x.cat).filter(Boolean))]} say={say} onClose={() => setLit(null)} onChanged={libOf(lit.kind).reload} onEdit={r => { setLit(null); if (lit.kind === "prac") setEditPrac(r.id); else go?.("ltest"); }} />}
    </>
  );

  // ---- 単元の中身 ----
  if (U) {
    const used = courseNames(U);
    return (
      <div className="st lu">
        <button type="button" className="lu-back" onClick={() => setUnitId("")}>← 単元</button>
        <div className="head"><h1 className="h1">{U.title || "名前なし"}</h1>
          <span className="r">
            <Btn kind="ghost sm" onClick={() => setDlg({ kind: "uedit", name: U.title, content: U.content || "", goals: arr(U.goals).join("\n") })}>名前・内容を直す</Btn>
            <Btn kind="ghost sm" onClick={() => setUnitId(copyUnit(U).id)}>写す</Btn>
            <Btn kind="sm lu-danger ghost" onClick={() => setDlg({ kind: "del", ids: [U.id] })}>消す</Btn>
          </span>
        </div>
        {err && <div className="lms-err" role="alert">{err}</div>}
        <section className="card lu-meta">
          <div><span>中身</span><UnitKinds u={U} /></div>
          <div><span>使っているコース</span><span className="row">{used.length ? used.map(n => <Chip key={n}>{n}</Chip>) : <b>まだ</b>}</span></div>
        </section>
        {(U.content || arr(U.goals).length > 0) && (
          <section className="card lu-goal">
            <div><span>学ぶ内容</span><p>{U.content || "—"}</p></div>
            <div><span>目標</span>{arr(U.goals).length ? <ul>{U.goals.map(g => <li key={g}>{g}</li>)}</ul> : <p>—</p>}</div>
          </section>
        )}
        <div className="lu-three">
          {box("doc", "doc", "資料", arr(U.files).length,
            arr(U.files).map(f => <div key={f.nodeId} className="lu-it"><FileIcon name={f.name} /><button type="button" className="lu-nm" onClick={() => openFile(f)}><b>{f.name}</b><small className="num">{f.at ? `${md(f.at)} ・ ` : ""}{fmtSize(f.sizeBytes)}</small></button><button type="button" className="x2" aria-label={`${f.name} を消す`} onClick={() => removeFile(f)}>×</button></div>),
            <label className={`lu-drop${busy ? " off" : ""}`}>{busy ? "置いています" : "ファイルを選ぶ ・ ここに置く"}<input type="file" multiple className="lms-sr" disabled={busy} onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) upload(fs); }} /></label>, true)}
          {box("tst", "test", "テスト", arr(U.testIds).length, arr(U.testIds).map(id => linkRow("test", id)),
            <><Btn kind="ghost sm" onClick={() => setDlg({ kind: "pick", pick: "test" })}>＋ 一覧から</Btn><Btn kind="ghost sm" onClick={() => setDlg({ kind: "tnew" })}>資料から作る</Btn></>)}
          {box("prc", "prac", "練習問題", arr(U.pracIds).length, arr(U.pracIds).map(id => linkRow("prac", id)),
            <><Btn kind="ghost sm" onClick={() => setDlg({ kind: "pick", pick: "prac" })}>＋ 一覧から</Btn><Btn kind="ghost sm" onClick={() => setDlg({ kind: "pnew" })}>Word から作る</Btn></>)}
        </div>
        {dialogs}
      </div>
    );
  }

  // ---- 単元の一覧 ----
  const rows = sortUnits(units.filter(u => matches(u, q)), sort);
  const allOn = rows.length > 0 && rows.every(u => picked.includes(u.id));
  return (
    <div className="st lu">
      <div className="head"><div><div className="eyebrow">全コース共通</div><h1 className="h1">単元</h1></div>
        <span className="r"><Btn kind="ghost sm" disabled={!units.length} onClick={exportXlsx}>Excel に書き出す</Btn><Btn kind="sm" onClick={addUnit}>＋ 単元</Btn></span>
      </div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      <section className="card lu-list">
        <div className="lu-tools">
          <input type="checkbox" className="lu-ck" aria-label="表示中の単元をすべて選ぶ" checked={allOn} disabled={!rows.length} onChange={e => setPicked(e.target.checked ? [...new Set([...picked, ...rows.map(u => u.id)])] : picked.filter(id => !rows.some(u => u.id === id)))} />
          <span className="fsearch lu-q"><input type="search" value={q} placeholder="単元の名前で探す" aria-label="単元の名前で探す" onChange={e => setQ(e.target.value)} /></span>
          <Chip><span className="num">{rows.length}</span> 単元</Chip>
          <select className="in lu-sort" aria-label="並べ替え" value={sort} onChange={e => setSort(e.target.value)}>{SORTS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        </div>
        {picked.length > 0 && (
          <div className="lu-bulk"><span><span className="num">{picked.length}</span> 件を選択中</span><span className="sp" /><Btn kind="ghost sm" onClick={() => setPicked([])}>選ぶのをやめる</Btn><Btn kind="sm lu-danger" onClick={() => setDlg({ kind: "del", ids: picked })}>消す</Btn></div>
        )}
        {rows.map(u => {
          const n = arr(u.usedIn).length;
          return (
            <div key={u.id} className="lu-r">
              <input type="checkbox" className="lu-ck" checked={picked.includes(u.id)} aria-label={`${u.title} を選ぶ`} onChange={e => setPicked(p => (e.target.checked ? [...p, u.id] : p.filter(id => id !== u.id)))} />
              <button type="button" className="lu-n" onClick={() => setUnitId(u.id)}><b>{u.title || "名前なし"}</b><small>{n ? <><span className="num">{n}</span> コースで使用</> : "未使用"}</small></button>
              <UnitKinds u={u} />
              <span className="lu-a"><button type="button" className="lu-ic" onClick={() => copyUnit(u)}>写す</button><button type="button" className="lu-ic del" onClick={() => setDlg({ kind: "del", ids: [u.id] })}>消す</button></span>
            </div>
          );
        })}
        {!rows.length && <div className="empty"><b>{units.length ? "見つかりません" : "単元はまだありません"}</b>{!units.length && <Btn kind="sm" onClick={addUnit}>＋ 単元</Btn>}</div>}
      </section>
      {dialogs}
    </div>
  );
}
