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
import CourseCreate from "./CourseCreate.jsx";
import { LitModal, qtyOf, useLib } from "./Library.jsx";

/* カリキュラム管理（モック lcurS）：カリキュラム → 単元 の中に、資料・テスト・練習問題をまとめて置く。
   コースを作るときに単元ごとコースに付ける。日付は持たない。変えたらすぐ保存する。API は /curriculum-library。
   資料の実体は共有フォルダの「カリキュラムの資料」（講師まで）に置く */

const FOLDER = "カリキュラムの資料";
const newUnit = () => ({ id: makeLocalId("su"), title: "新しい単元", days: 3, goals: [], content: "", exercises: [], testIds: [], pracIds: [], files: [] });
const lines = t => String(t || "").split("\n").map(v => v.trim()).filter(Boolean);

export function useShelf() {
  const [st, setSt] = useState({ state: "loading", items: [], updatedAt: "" });
  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    apiGet("/curriculum-library").then(r => { if (alive) setSt({ state: "ready", items: arr(r?.items), updatedAt: r?.updatedAt || "" }); }).catch(() => { if (alive) setSt({ state: "error", items: [], updatedAt: "" }); });
    return () => { alive = false; };
  }, [key]);
  return { ...st, reload: () => setKey(k => k + 1) };
}

// コースの編集から：棚の単元を選んでコースへ足す
export function ShelfPicker({ onClose, onPick }) {
  const shelf = useShelf();
  const [picked, setPicked] = useState({});
  const units = shelf.items.flatMap(c => arr(c.units).map(u => ({ ...u, from: c.name })));
  const sel = units.filter(u => picked[u.id]);
  return (
    <Modal title="共通の棚から足す" width={560} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={!sel.length} onClick={() => onPick(sel)}>{sel.length} 単元を足す</Btn></>}>
      {shelf.state === "error" ? <div className="empty"><b>棚を確認できません</b><Btn kind="ghost sm" onClick={shelf.reload}>再読み込み</Btn></div> : shelf.state === "loading" ? <div className="dv-mt">読み込み中</div> : (
        <div className="fs-pick">
          {shelf.items.map(c => (
            <div key={c.id} className="st-g">
              <span className="eyebrow">{c.name}</span>
              {arr(c.units).map(u => <label key={u.id} className="st-ck fs-pr"><input type="checkbox" checked={!!picked[u.id]} onChange={e => setPicked(p => ({ ...p, [u.id]: e.target.checked }))} />{u.title || "名前なし"}<small className="num"> {u.days} 日{arr(u.testIds).length ? ` ・ テスト ${u.testIds.length}` : ""}</small></label>)}
              {!arr(c.units).length && <Chip>単元なし</Chip>}
            </div>
          ))}
          {!shelf.items.length && <Chip>棚は空です</Chip>}
        </div>
      )}
      <Chip>日付はコースで決める</Chip>
    </Modal>
  );
}

// 一覧から足す（モック kpickModal）
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
  const [items, setItems] = useState([]);
  const saved = useRef("[]"), stamp = useRef("");
  const [ready, setReady] = useState(false);
  const [cur, setCur] = useState(""); const [unitId, setUnitId] = useState(""); const [closed, setClosed] = useState({});
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState(null);
  const [making, setMaking] = useState(null); const [courses, setCourses] = useState([]); const [companies, setCompanies] = useState([]);
  const [lit, setLit] = useState(null); const [editPrac, setEditPrac] = useState("");
  const fileRef = useRef(null);
  useEffect(() => {
    if (shelf.state !== "ready" || ready) return;
    setItems(shelf.items); saved.current = JSON.stringify(shelf.items); stamp.current = shelf.updatedAt; setCur(shelf.items[0]?.id || ""); setReady(true);
  }, [shelf.state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    apiGet("/completion-report/courses").then(r => setCourses(arr(r?.courses))).catch(() => {});
    apiGet("/companies").then(l => setCompanies(arr(l))).catch(() => {});
  }, []);
  // 変えたらすぐ保存する
  useEffect(() => {
    if (!ready) return undefined;
    const body = JSON.stringify(items);
    if (body === saved.current) return undefined;
    const t = setTimeout(() => {
      apiPut("/curriculum-library", { items, expectedUpdatedAt: stamp.current }).then(r => { saved.current = body; stamp.current = r.updatedAt || ""; setErr(""); }).catch(e => setErr(errText(e, "保存できませんでした")));
    }, 400);
    return () => clearTimeout(t);
  }, [items, ready]);

  if (editPrac) return <Editor courseId="common" id={editPrac} say={say} onBack={() => { setEditPrac(""); pracs.reload(); }} />;
  if (shelf.state === "loading") return <div className="soon card">読み込み中</div>;
  if (shelf.state === "error") return <Card><div className="empty"><b>カリキュラムを確認できません</b><Btn kind="ghost sm" onClick={shelf.reload}>再読み込み</Btn></div></Card>;

  const K = items.find(x => x.id === cur) || null, units = arr(K?.units), U = units.find(u => u.id === unitId) || null, uj = U ? units.indexOf(U) : -1;
  const setK = patch => setItems(l => l.map(x => (x.id === cur ? { ...x, ...patch } : x)));
  const setU = patch => setK({ units: units.map(u => (u.id === unitId ? { ...u, ...patch } : u)) });
  const libOf = kind => (kind === "test" ? tests : pracs);
  const itemOf = (kind, id) => libOf(kind).rows.find(x => x.id === id);
  const nameOf = (kind, id) => itemOf(kind, id)?.t || "見つかりません";
  const countOf = u => arr(u.files).length + arr(u.testIds).length + arr(u.pracIds).length;

  const copyKeyed = list => list.map(u => ({ ...u, id: makeLocalId("su") }));
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

  const saveDlg = () => {
    const d = dlg, name = String(d.name || "").trim();
    if (!name) return;
    if (d.kind === "knew") { const k = { id: makeLocalId("sc"), name, note: "", units: [] }; setItems(l => [...l, k]); setCur(k.id); setUnitId(""); say?.("カリキュラムを足しました"); }
    if (d.kind === "kedit") setK({ name, note: d.note || "" });
    if (d.kind === "uedit") setU({ title: name, days: Math.max(1, Number(d.days) || 1), content: d.content || "", goals: lines(d.goals) });
    setDlg(null);
  };
  const section = (kind, title, n, add, body) => (
    <section className="ku-s">
      <div className="head"><h3 className="h3"><Icon k={kind} size={16} /> {title}</h3><span className="r"><Chip>{n}</Chip>{add}</span></div>
      {n ? <div className="ku-l">{body}</div> : <div className="au-e ku-e">なし</div>}
    </section>
  );
  const lrow = (kind, id) => {
    const x = itemOf(kind, id), key = kind === "test" ? "testIds" : "pracIds";
    return (
      <div key={id} className="ku-r">
        <button type="button" className="fs-name" disabled={!x} onClick={() => setLit({ kind, row: x })}><Icon k={kind} size={16} /><span>{nameOf(kind, id)}</span></button>
        {x && <small className="num">{qtyOf(kind, x)}</small>}
        <button type="button" className="x2" aria-label={`${nameOf(kind, id)} を外す`} onClick={() => setU({ [key]: arr(U[key]).filter(v => v !== id) })}>×</button>
      </div>
    );
  };
  const usedNames = arr(K?.usedIn).map(id => courses.find(c => c.courseId === id)?.name).filter(Boolean);
  const totalDays = units.reduce((a, u) => a + (Number(u.days) || 0), 0);
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">全コース共通</div><h1 className="h1">カリキュラム</h1></div>
        <span className="r"><Btn kind="ghost sm" onClick={() => setDlg({ kind: "knew", name: "" })}>＋ カリキュラム</Btn><Btn kind="sm" disabled={!K} onClick={() => { const u = newUnit(); setK({ units: [...units, u] }); setUnitId(u.id); say?.("単元を足しました"); }}>＋ 単元</Btn></span>
      </div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      <div className="fsw">
        <nav className="card fs-tree" aria-label="カリキュラム">
          <div className="fs-sec"><span className="eyebrow">カリキュラム</span></div>
          {items.map(k => {
            const op = !closed[k.id];
            return (
              <React.Fragment key={k.id}>
                <button type="button" className="fs-c" aria-expanded={op} onClick={() => setClosed(c => ({ ...c, [k.id]: op }))}><i aria-hidden="true">{op ? "▾" : "▸"}</i><span>{k.name || "名前なし"}</span><em className="num">{arr(k.units).length}</em></button>
                {op && (
                  <div className="fs-kids">
                    <button type="button" className="fs-n" aria-current={cur === k.id && !unitId} onClick={() => { setCur(k.id); setUnitId(""); }}><span>全体</span></button>
                    {arr(k.units).map((u, j) => <button key={u.id} type="button" className="fs-n" aria-current={unitId === u.id} onClick={() => { setCur(k.id); setUnitId(u.id); }}><em className="num kn">{j + 1}</em><span>{u.title || "名前なし"}</span><em className="num">{countOf(u)}</em></button>)}
                  </div>
                )}
              </React.Fragment>
            );
          })}
          {!items.length && <Chip>なし</Chip>}
        </nav>
        {K && !U && (
          <section className="card fs-main ku">
            <div className="fs-top">
              <div className="fs-bc"><span className="fs-scope cm">カリキュラム</span><i>›</i><b>{K.name}</b></div>
              <span className="row">
                <Btn kind="ghost sm" onClick={() => setDlg({ kind: "kedit", name: K.name, note: K.note || "" })}>名前を直す</Btn>
                <Btn kind="ghost sm" onClick={() => saveXlsx(`カリキュラム_${K.name}`, "カリキュラム", [["No", "単元", "日数", "資料", "テスト", "練習問題"], ...units.map((u, i) => [i + 1, u.title, u.days, arr(u.files).length, arr(u.testIds).map(id => nameOf("test", id)).join(" / "), arr(u.pracIds).map(id => nameOf("prac", id)).join(" / ")])])}>Excel に書き出す</Btn>
                <Btn kind="ghost sm" onClick={() => { const c = { ...K, id: makeLocalId("sc"), name: `${K.name}（写し）`, usedIn: [], units: copyKeyed(units) }; setItems(l => [...l, c]); setCur(c.id); say?.(`${K.name} を写しました`); }}>写す</Btn>
                <Btn kind="sm" disabled={!units.length} onClick={() => setMaking(K)}>このカリキュラムでコースを作る</Btn>
              </span>
            </div>
            <div className="ku-b">
              <div className="rowsx"><div><span>説明</span><b>{K.note || "—"}</b></div><div><span>単元</span><b>{units.length} ・ {totalDays} 日</b></div><div><span>使用中のコース</span><b>{usedNames.length ? usedNames.join("・") : "まだ"}</b></div></div>
              <div className="scroll"><table className="tbl"><thead><tr><th>No</th><th>単元</th><th>日数</th><th>資料</th><th>テスト</th><th>練習問題</th></tr></thead><tbody>
                {units.map((u, i) => <tr key={u.id} className="crow" onClick={() => setUnitId(u.id)}><td className="num">{i + 1}</td><td><b>{u.title || "名前なし"}</b></td><td className="num">{u.days}</td><td className="num">{arr(u.files).length}</td><td>{arr(u.testIds).map(id => nameOf("test", id)).join("・") || "—"}</td><td>{arr(u.pracIds).map(id => nameOf("prac", id)).join("・") || "—"}</td></tr>)}
                {!units.length && <tr><td colSpan={6}><Chip>なし</Chip></td></tr>}
              </tbody></table></div>
            </div>
          </section>
        )}
        {U && (
          <section className="card fs-main ku">
            <div className="fs-top">
              <div className="fs-bc"><span className="fs-scope cm">{K.name}</span><i>›</i><b className="ku-t"><span className="tu-no num">{uj + 1}</span>{U.title}</b></div>
              <span className="row">
                <Chip>{U.days} 日</Chip>
                <Btn kind="ghost sm" onClick={() => setDlg({ kind: "uedit", name: U.title, days: U.days, content: U.content || "", goals: arr(U.goals).join("\n") })}>名前・日数を直す</Btn>
                <Btn kind="ghost sm" onClick={() => { const c = { ...U, id: makeLocalId("su"), title: `${U.title}（写し）` }; setK({ units: [...units, c] }); setUnitId(c.id); say?.(`${U.title} を写しました`); }}>写す</Btn>
              </span>
            </div>
            <div className="ku-b">
              {section("doc", "資料", arr(U.files).length,
                <label className={`btn ghost sm${busy ? " off" : ""}`}>{busy ? "置いています" : "ファイルを選ぶ"}<input ref={fileRef} type="file" multiple className="lms-sr" disabled={busy} onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) upload(fs); }} /></label>,
                arr(U.files).map(f => <div key={f.nodeId} className="ku-r"><FileIcon name={f.name} /><button type="button" className="fs-name ku-n" onClick={() => openFile(f)}><span>{f.name}</span></button><small className="num">{f.at ? `${md(f.at)} ・ ` : ""}{fmtSize(f.sizeBytes)}</small><button type="button" className="x2" aria-label={`${f.name} を消す`} onClick={() => removeFile(f)}>×</button></div>))}
              {section("test", "テスト", arr(U.testIds).length,
                <><Btn kind="ghost sm" onClick={() => setDlg({ kind: "pick", pick: "test" })}>一覧から足す</Btn><Btn kind="ghost sm" onClick={() => setDlg({ kind: "tnew" })}>資料から作る</Btn></>,
                arr(U.testIds).map(id => lrow("test", id)))}
              {section("prac", "練習問題", arr(U.pracIds).length,
                <><Btn kind="ghost sm" onClick={() => setDlg({ kind: "pick", pick: "prac" })}>一覧から足す</Btn><Btn kind="ghost sm" onClick={() => setDlg({ kind: "pnew" })}>Word から作る</Btn></>,
                arr(U.pracIds).map(id => lrow("prac", id)))}
            </div>
          </section>
        )}
        {!K && <Card className="pad"><Chip>なし</Chip></Card>}
      </div>
      {dlg?.kind === "knew" && <Modal title="カリキュラムを足す" width={460} onClose={() => setDlg(null)} footer={<><Btn kind="ghost" onClick={() => setDlg(null)}>やめる</Btn><Btn onClick={saveDlg}>足す</Btn></>}><label className="field">カリキュラムの名前<input type="text" autoFocus maxLength={80} value={dlg.name} onChange={e => setDlg(d => ({ ...d, name: e.target.value }))} /></label></Modal>}
      {dlg?.kind === "kedit" && (
        <Modal title="カリキュラムを直す" width={480} onClose={() => setDlg(null)} footer={<><Btn kind="ghost" onClick={() => { setItems(l => l.filter(x => x.id !== cur)); setCur(items.find(x => x.id !== cur)?.id || ""); setDlg(null); }}>消す</Btn><span style={{ marginLeft: "auto" }} /><Btn kind="ghost" onClick={() => setDlg(null)}>やめる</Btn><Btn onClick={saveDlg}>保存</Btn></>}>
          <label className="field">カリキュラムの名前<input type="text" maxLength={80} value={dlg.name} onChange={e => setDlg(d => ({ ...d, name: e.target.value }))} /></label>
          <label className="field">説明<input type="text" maxLength={300} value={dlg.note} onChange={e => setDlg(d => ({ ...d, note: e.target.value }))} /></label>
        </Modal>
      )}
      {dlg?.kind === "uedit" && (
        <Modal title="単元を直す" width={520} onClose={() => setDlg(null)} footer={<><Btn kind="ghost" onClick={() => { setK({ units: units.filter(u => u.id !== unitId) }); setUnitId(""); setDlg(null); }}>消す</Btn><span style={{ marginLeft: "auto" }} /><Btn kind="ghost" onClick={() => setDlg(null)}>やめる</Btn><Btn onClick={saveDlg}>保存</Btn></>}>
          <div className="g2e"><label className="field">単元名<input type="text" maxLength={100} value={dlg.name} onChange={e => setDlg(d => ({ ...d, name: e.target.value }))} /></label><label className="field">日数<input type="number" min="1" value={dlg.days} onChange={e => setDlg(d => ({ ...d, days: e.target.value }))} /></label></div>
          <label className="field">この単元で学ぶ内容<textarea rows={2} value={dlg.content} onChange={e => setDlg(d => ({ ...d, content: e.target.value }))} /></label>
          <label className="field">目標（1 行に 1 つ）<textarea rows={3} value={dlg.goals} onChange={e => setDlg(d => ({ ...d, goals: e.target.value }))} /></label>
        </Modal>
      )}
      {dlg?.kind === "pick" && <PickModal kind={dlg.pick} lib={libOf(dlg.pick)} has={arr(U?.[dlg.pick === "test" ? "testIds" : "pracIds"])} onClose={() => setDlg(null)} onPick={ids => { const key = dlg.pick === "test" ? "testIds" : "pracIds"; setU({ [key]: [...arr(U[key]), ...ids] }); setDlg(null); }} />}
      {dlg?.kind === "tnew" && <TestFileModal onClose={() => setDlg(null)} onSaved={(t, s) => { setDlg(null); setU({ testIds: [...arr(U.testIds), t.testId] }); tests.reload(); say?.(s === "published" ? `「${t.title}」を公開しました` : `「${t.title}」を下書きで保存しました`); }} />}
      {dlg?.kind === "pnew" && <CreateModal courseId="common" onClose={() => setDlg(null)} onMade={id => { setDlg(null); setU({ pracIds: [...arr(U.pracIds), id] }); pracs.reload(); setEditPrac(id); }} />}
      {lit && <LitModal kind={lit.kind} row={lit.row} courses={libOf(lit.kind).courses} cats={[...new Set(libOf(lit.kind).rows.map(x => x.cat).filter(Boolean))]} say={say} onClose={() => setLit(null)} onChanged={libOf(lit.kind).reload} onEdit={r => { setLit(null); if (lit.kind === "prac") setEditPrac(r.id); else go?.("ltest"); }} />}
      {making && <CourseCreate companies={companies} courses={courses} initial={{ name: making.name, units: arr(making.units).map(u => ({ title: u.title, days: u.days, goal: arr(u.goals)[0] || "", note: "", testIds: arr(u.testIds), pracIds: arr(u.pracIds), files: arr(u.files) })) }} onClose={() => setMaking(null)} onDone={id => { const k = making; setMaking(null); say?.("コースを下書きで作りました"); if (id) setItems(l => l.map(x => (x.id === k.id ? { ...x, usedIn: [...new Set([...arr(x.usedIn), id])] } : x))); try { sessionStorage.setItem("lms.courseOpen", id); } catch { /* 一覧から開ける */ } setTimeout(() => go?.("course"), 600); }} />}
    </div>
  );
}
