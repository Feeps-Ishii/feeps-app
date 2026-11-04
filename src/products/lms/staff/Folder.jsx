import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { addMaterialToCurriculumTarget, normalizeCurriculumSections, sessionsFromSections } from "../../training/TrainingComponents.jsx";
import { fmtSize } from "../../training/DevReview.jsx";
import { getActiveCourseId, setActiveCourseId, takeLibraryTarget } from "../../../utils/common/courseContext.js";
import { Btn, Chip, FileIcon, Modal } from "../parts/ui.jsx";
import { arr, errText, md } from "./common.js";

const MaterialViewer = lazy(() => import("../../training/MaterialViewer.jsx"));
const GroupsModal = lazy(() => import("../../training/LibraryView.jsx").then(m => ({ default: m.GroupsModal })));
const UsageModal = lazy(() => import("../../training/LibraryView.jsx").then(m => ({ default: m.UsageModal })));
const VisibilityOverview = lazy(() => import("../../training/LibraryView.jsx").then(m => ({ default: m.VisibilityOverview })));

/* 講師・管理者のフォルダ（モック docS）：左に全コース共通とコース別、右に中身の表と行の操作。
   公開範囲は今の決まりのまま「だれ（役割）とどの範囲（コース・グループ・全コース）」で決める（人ごとの指定は持っていない）。
   見え方の一覧・グループの出し入れ・容量と費用は今の窓を中に出す */

const ROOT = "root";
const ROLES = [["trainee", "受講生"], ["instructor", "講師"], ["client", "企業担当者"]];
const VIS = { all: ["受講生に見える", "ok"], client: ["企業担当者にも見える", "blue"], group: ["チームだけ", "blue"], staff: ["講師・運営だけ", "warn"] };
const VIS_ORDER = ["all", "client", "group", "staff"];
const visKey = acl => { const r = acl?.roles || {}; return r.trainee && acl?.scope === "groups" ? "group" : r.client ? "client" : r.trainee ? "all" : "staff"; };
const nodeVis = n => { const own = visKey(n?.acl); if (n?.type !== "shortcut" || !n?.targetAcl) return own; const t = visKey(n.targetAcl); return VIS_ORDER.indexOf(t) > VIS_ORDER.indexOf(own) ? t : own; };
const nameOf = n => (n.type === "shortcut" ? n.targetName || n.name : n.name);
const isPdf = n => /\.pdf$/i.test(n.name || "") || n.contentType === "application/pdf";
const isDir = n => n.type !== "file";
const courseIdOf = sid => (String(sid).startsWith("course#") ? String(sid).slice(7) : "");
const SORTS = {
  name: (a, b) => nameOf(a).localeCompare(nameOf(b), "ja"),
  new: (a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
  size: (a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0),
};

function AclModal({ node, isRoot, sid, groups, onCreateGroup, onClose, onSave }) {
  const ops = sid === "ops", cid = courseIdOf(sid);
  const [mode, setMode] = useState(!node.ownAcl && !isRoot ? "inherit" : "own");
  const [d, setD] = useState({
    scope: ["org", "groups"].includes(node.acl?.scope) ? node.acl.scope : "course",
    groups: arr(node.acl?.groups),
    roles: { trainee: !!node.acl?.roles?.trainee, instructor: !!node.acl?.roles?.instructor, client: !!node.acl?.roles?.client },
    traineeWrite: !!node.acl?.traineeWrite,
  });
  const [name, setName] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!name.trim()) return;
    setErr("");
    try { const g = await onCreateGroup(name.trim()); setName(""); setD(x => ({ ...x, scope: "groups", groups: [...new Set([...x.groups, g.groupId])] })); }
    catch (e) { setErr(errText(e, "グループを作れませんでした")); }
  };
  const save = async () => {
    setBusy(true); setErr("");
    try { await onSave(mode === "inherit" ? null : d); onClose(); } catch (e) { setErr(errText(e, "保存できませんでした")); setBusy(false); }
  };
  const seen = mode === "inherit" ? node.parentAcl : d;
  return (
    <Modal title={`公開範囲 ・ ${node.name}`} width={540} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy || (mode === "own" && d.scope === "groups" && !d.groups.length)} onClick={save}>保存</Btn></>}>
      {!isRoot && <span className="seg"><button type="button" aria-pressed={mode === "inherit"} onClick={() => setMode("inherit")}>親フォルダと同じ</button><button type="button" aria-pressed={mode === "own"} onClick={() => setMode("own")}>ここで決める</button></span>}
      {mode === "own" && (
        <>
          {cid && <label className="field">範囲<select className="in" value={d.scope} onChange={e => setD(x => ({ ...x, scope: e.target.value }))}><option value="course">このコース</option><option value="groups">コース内のグループ</option><option value="org">全コース</option></select></label>}
          {cid && d.scope === "groups" && (
            <div className="field">グループ
              <span className="row">{groups.map(g => <label key={g.groupId} className="st-ck"><input type="checkbox" checked={d.groups.includes(g.groupId)} onChange={e => setD(x => ({ ...x, groups: e.target.checked ? [...x.groups, g.groupId] : x.groups.filter(v => v !== g.groupId) }))} />{g.name}<small className="num"> {g.memberCount} 人</small></label>)}{!groups.length && <Chip>なし</Chip>}</span>
              <span className="row"><input type="text" value={name} placeholder="新しいグループの名前" aria-label="新しいグループの名前" onChange={e => setName(e.target.value)} /><Btn kind="ghost sm" onClick={add}>作る</Btn></span>
            </div>
          )}
          <div className="field">見せる人
            <span className="row">{ROLES.filter(([k]) => !ops || k === "instructor").map(([k, t]) => <label key={k} className="st-ck"><input type="checkbox" checked={d.roles[k]} onChange={e => setD(x => ({ ...x, roles: { ...x.roles, [k]: e.target.checked } }))} />{t}</label>)}</span>
          </div>
          {!ops && d.roles.trainee && <label className="st-ck"><input type="checkbox" checked={d.traineeWrite} onChange={e => setD(x => ({ ...x, traineeWrite: e.target.checked }))} />受講生も置ける</label>}
        </>
      )}
      {seen && <div className="row"><Chip tone={VIS[visKey(seen)][1]}>{VIS[visKey(seen)][0]}</Chip></div>}
      <div className="row"><Chip>管理者はいつでも見られる</Chip><Chip>親より広くはできない</Chip></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

function MoveModal({ node, nodes, onClose, onMove }) {
  const byId = useMemo(() => new Map(nodes.map(n => [n.nodeId, n])), [nodes]);
  const under = id => { let c = byId.get(id); const seen = new Set(); while (c && !seen.has(c.nodeId)) { if (c.nodeId === node.nodeId) return true; seen.add(c.nodeId); c = byId.get(c.parentId); } return false; };
  const label = n => { const out = []; let c = n; const seen = new Set(); while (c && c.nodeId !== ROOT && !seen.has(c.nodeId)) { out.unshift(c.name); seen.add(c.nodeId); c = byId.get(c.parentId); } return out.join(" / ") || "いちばん上"; };
  const opts = nodes.filter(n => n.type === "folder" && n.canWrite && n.nodeId !== node.parentId && !under(n.nodeId)).sort((a, b) => label(a).localeCompare(label(b), "ja"));
  const [to, setTo] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); setErr(""); try { await onMove(to); onClose(); } catch (e) { setErr(errText(e, "移動できませんでした")); setBusy(false); } };
  return (
    <Modal title={`移動 ・ ${nameOf(node)}`} width={460} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={!to || busy} onClick={go}>移動する</Btn></>}>
      {opts.length ? <label className="field">移動先<select className="in" value={to} onChange={e => setTo(e.target.value)}><option value="">選ぶ</option>{opts.map(n => <option key={n.nodeId} value={n.nodeId}>{label(n)}</option>)}</select></label> : <Chip>移動先なし</Chip>}
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

// 共有のファイル・フォルダをコースで使う（ショートカット・コピー）
function PlaceModal({ node, courses, linked, onClose, onPlace, onUnlink }) {
  const folder = node.type === "folder";
  const [mode, setMode] = useState("link"); const [picked, setPicked] = useState([]); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const rows = (mode === "copy" ? linked?.copies : linked?.shortcuts) || [];
  const done = new Set(rows.map(x => x.courseId));
  const go = async () => { setBusy(true); setErr(""); try { await onPlace(mode, picked); onClose(); } catch (e) { setErr(errText(e, "コースに置けませんでした")); setBusy(false); } };
  return (
    <Modal title={`コースで使う ・ ${node.name}`} width={520} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={!picked.length || busy} onClick={go}>{folder && mode === "copy" ? "コピーする" : "置く"}</Btn></>}>
      {folder && <span className="seg"><button type="button" aria-pressed={mode === "link"} onClick={() => { setMode("link"); setPicked([]); }}>ショートカット</button><button type="button" aria-pressed={mode === "copy"} onClick={() => { setMode("copy"); setPicked([]); }}>コピー</button></span>}
      <div className="fs-pick">
        {courses.map(c => {
          const on = done.has(c.courseId), sc = mode === "link" ? rows.find(x => x.courseId === c.courseId) : null;
          return (
            <div key={c.courseId} className="row fs-pr">
              <label className="st-ck"><input type="checkbox" disabled={on} checked={on || picked.includes(c.courseId)} onChange={e => setPicked(p => (e.target.checked ? [...p, c.courseId] : p.filter(x => x !== c.courseId)))} />{c.name || c.courseId}</label>
              {on && <span className="row"><Chip tone="blue">{mode === "copy" ? "コピー済み" : "使っている"}</Chip>{sc && <Btn kind="ghost sm" onClick={() => onUnlink(c.courseId, sc.nodeId)}>外す</Btn>}</span>}
            </div>
          );
        })}
        {!courses.length && <Chip>なし</Chip>}
      </div>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

function StaffFolder({ role, say, view = "all" }) {
  const admin = role === "admin";
  const showCommon = view !== "course", showCourses = view !== "common";
  const [target] = useState(() => takeLibraryTarget(true));
  const [courses, setCourses] = useState(undefined);
  const [spaces, setSpaces] = useState({});      // spaceId → 中身（null は読めなかった）
  const [links, setLinks] = useState(null);
  const [cur, setCur] = useState(null);          // { sid, id }
  const [open, setOpen] = useState({});
  const [cq, setCq] = useState("");
  const [q, setQ] = useState(""); const [sort, setSort] = useState("name");
  const [menu, setMenu] = useState("");
  const [dlg, setDlg] = useState(null);          // { kind, node? }
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const [groups, setGroups] = useState([]);
  const [units, setUnits] = useState([]); const [linkTo, setLinkTo] = useState("");
  const [viewing, setViewing] = useState(null);
  const [overview, setOverview] = useState(false);
  const [usage, setUsage] = useState(null);
  const [drop, setDrop] = useState(false);
  const fileRef = useRef(null);

  const loadSpace = useCallback(sid => apiGet(`/library?spaceId=${encodeURIComponent(sid)}`)
    .then(d => { setSpaces(s => ({ ...s, [sid]: d })); return d; })
    .catch(() => { setSpaces(s => ({ ...s, [sid]: null })); return null; }), []);
  const loadLinks = useCallback(() => apiGet("/library/links?spaceId=shared").then(r => setLinks(r?.links || {})).catch(() => setLinks(null)), []);

  useEffect(() => {
    let alive = true;
    apiGet("/courses").then(list => {
      if (!alive) return;
      const cs = arr(list).filter(c => c?.courseId);
      setCourses(cs);
      const pref = target?.courseId || getActiveCourseId();
      const first = showCourses ? (cs.some(c => c.courseId === pref) ? pref : cs[0]?.courseId) : "";
      if (first) setOpen({ [first]: true });
      setCur({ sid: first ? `course#${first}` : "shared", id: target?.courseId === first && target?.nodeId ? target.nodeId : ROOT });
    }).catch(() => { if (alive) { setCourses(null); if (showCommon) setCur({ sid: "shared", id: ROOT }); } });
    if (showCommon) { loadSpace("shared"); loadSpace("ops"); }
    loadLinks();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (cur?.sid && spaces[cur.sid] === undefined) loadSpace(cur.sid); }, [cur?.sid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { Object.keys(open).filter(k => open[k] && spaces[`course#${k}`] === undefined).forEach(k => loadSpace(`course#${k}`)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const cid = cur ? courseIdOf(cur.sid) : "";
  const loadGroups = useCallback(() => {
    if (!cid) { setGroups([]); return; }
    apiGet(`/library/groups?courseId=${encodeURIComponent(cid)}`).then(r => setGroups(arr(r?.groups))).catch(() => setGroups([]));
  }, [cid]);
  useEffect(() => {
    loadGroups(); setLinkTo(""); setUnits([]);
    if (!cid) return undefined;
    let alive = true;
    apiGet(`/courses/${encodeURIComponent(cid)}/curriculum`).then(d => { if (alive) setUnits(normalizeCurriculumSections(d)); }).catch(() => {});
    return () => { alive = false; };
  }, [cid, loadGroups]);

  // 行のメニューは外を押すと閉じる
  useEffect(() => {
    if (!menu) return undefined;
    const close = e => { if (!e.target.closest?.(".kmenu, .kbtn")) setMenu(""); };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [menu]);

  const data = cur ? spaces[cur.sid] : undefined;
  const nodes = useMemo(() => arr(data?.nodes), [data]);
  const byId = useMemo(() => new Map(nodes.map(n => [n.nodeId, n])), [nodes]);
  const here = cur ? byId.get(cur.id) || byId.get(ROOT) : null;
  const chain = useMemo(() => { const out = []; let c = here; const seen = new Set(); while (c && !seen.has(c.nodeId)) { out.unshift(c); seen.add(c.nodeId); c = byId.get(c.parentId); } return out; }, [here, byId]);
  const courseName = id => arr(courses).find(c => c.courseId === id)?.name || "コース";
  const scopeName = sid => (sid === "shared" ? "共有（全社）" : sid === "ops" ? "運営だけ" : courseName(courseIdOf(sid)));
  const pathOf = n => { const out = []; let c = byId.get(n.parentId); const seen = new Set(); while (c && c.nodeId !== ROOT && !seen.has(c.nodeId)) { out.unshift(c.name); seen.add(c.nodeId); c = byId.get(c.parentId); } return out.join(" / "); };

  const q0 = q.trim().toLowerCase();
  const list = useMemo(() => {
    const base = q0 ? nodes.filter(n => n.nodeId !== ROOT && nameOf(n).toLowerCase().includes(q0)) : nodes.filter(n => here && n.parentId === here.nodeId);
    return [...base].sort((a, b) => (isDir(a) === isDir(b) ? SORTS[sort](a, b) : isDir(a) ? -1 : 1));
  }, [nodes, here, q0, sort]);

  const unitOpts = useMemo(() => units.flatMap(s => [{ v: `section:${s.id}`, t: s.title || "名称未設定" }, ...arr(s.chapters).flatMap(c => arr(c.lessons).map(l => ({ v: `lesson:${l.id}`, t: `　${c.title || "章"} / ${l.title || "名称未設定"}` })))]), [units]);

  const go = (sid, id = ROOT) => { setCur({ sid, id }); setQ(""); setMenu(""); setErr(""); setOverview(false); const c = courseIdOf(sid); if (c) { setActiveCourseId(c); setOpen(o => ({ ...o, [c]: true })); } };
  const openShortcut = n => go("shared", n.targetNodeId || ROOT);
  const enter = n => (n.type === "shortcut" ? openShortcut(n) : go(cur.sid, n.nodeId));

  async function run(label, fn) {
    setBusy(label); setErr(""); setMenu("");
    const sid = cur.sid;
    try { await fn(); await loadSpace(sid); if (sid === "shared") loadLinks(); return true; }
    catch (e) { setErr(errText(e, "うまくいきませんでした")); return false; }
    finally { setBusy(""); }
  }
  const openFile = async (n, download) => {
    setErr(""); setMenu("");
    if (!download && cid && n.materialId && isPdf(n)) { setViewing(n); return; }
    try {
      const r = await apiGet(`/library/download?spaceId=${encodeURIComponent(cur.sid)}&nodeId=${encodeURIComponent(n.nodeId)}${download ? "&mode=download" : ""}`);
      window.open(r.url, "_blank", "noopener");
    } catch (e) { setErr(errText(e, `「${n.name}」を開けませんでした`)); }
  };
  const upload = files => run("upload", async () => {
    let cu = units;
    for (const f of files) {
      // eslint-disable-next-line no-await-in-loop
      const got = await apiPost("/library/upload-url", { spaceId: cur.sid, parentId: here.nodeId, filename: f.name, contentType: f.type || "application/octet-stream", sizeBytes: f.size });
      // eslint-disable-next-line no-await-in-loop
      const put = await fetch(got.uploadUrl, { method: "PUT", headers: { "content-type": got.contentType }, body: f });
      if (!put.ok) throw new Error(`「${f.name}」を置けませんでした（${put.status}）`);
      // eslint-disable-next-line no-await-in-loop
      await apiPost("/library/files", { spaceId: cur.sid, parentId: here.nodeId, nodeId: got.nodeId, s3key: got.s3key, materialId: got.materialId, name: f.name, sizeBytes: f.size, contentType: got.contentType });
      if (linkTo && got.materialId && cid) {
        const next = addMaterialToCurriculumTarget(cu, linkTo, got.materialId);
        // eslint-disable-next-line no-await-in-loop
        try { await apiPut(`/courses/${encodeURIComponent(cid)}/curriculum`, { sections: next, sessions: sessionsFromSections(next) }); cu = next; setUnits(next); }
        catch { setErr(`「${f.name}」は置きました。単元には付けられませんでした`); }
      }
    }
    say?.(`${files.length} ファイルを置きました`);
  });
  const confirmDlg = () => {
    const { kind, node } = dlg, name = text.trim();
    if (kind !== "delete" && !name) return;
    setDlg(null);
    run(kind, async () => {
      if (kind === "folder") await apiPost("/library/folders", { spaceId: cur.sid, parentId: here.nodeId, name });
      if (kind === "rename") await apiPut(`/library/nodes/${encodeURIComponent(node.nodeId)}`, { spaceId: cur.sid, name });
      if (kind === "delete") await apiDelete(`/library/nodes/${encodeURIComponent(node.nodeId)}?spaceId=${encodeURIComponent(cur.sid)}`);
      say?.(kind === "folder" ? "フォルダを作りました" : kind === "rename" ? "名前を変えました" : node.type === "shortcut" ? "外しました" : "消しました");
    });
  };
  const place = async (node, mode, ids) => {
    const r = node.type === "file"
      ? await apiPost("/library/link-to-course", { spaceId: "shared", nodeId: node.nodeId, courseIds: ids })
      : await apiPost(mode === "copy" ? "/library/copy-folder" : "/library/link-folder", { spaceId: "shared", nodeId: node.nodeId, courseIds: ids });
    await Promise.all([loadLinks(), ...ids.filter(id => spaces[`course#${id}`] !== undefined).map(id => loadSpace(`course#${id}`))]);
    say?.(`${arr(r?.placed).length} コースに置きました`);
  };
  const unlink = (courseId, nodeId) => run("unlink", async () => {
    await apiDelete(`/library/nodes/${encodeURIComponent(nodeId)}?spaceId=${encodeURIComponent(`course#${courseId}`)}`);
    await loadLinks();
    if (spaces[`course#${courseId}`] !== undefined) await loadSpace(`course#${courseId}`);
    setDlg(null);
    say?.("外しました");
  });
  const openUsage = async () => { setUsage({ open: true, data: null }); try { setUsage({ open: true, data: await apiGet("/library/usage") }); } catch (e) { setUsage({ open: true, data: { error: errText(e, "集計を確認できません") } }); } };

  // 左の一覧。開いている道の上だけ、下の階層も見せる
  const treeKids = (sid, parent) => {
    const ns = arr(spaces[sid]?.nodes), onPath = cur?.sid === sid ? chain.map(c => c.nodeId) : [];
    return ns.filter(n => n.parentId === parent && isDir(n) && n.nodeId !== ROOT).sort(SORTS.name).map(n => {
      const files = ns.filter(x => x.parentId === n.nodeId && x.type === "file").length;
      return (
        <React.Fragment key={n.nodeId}>
          <button type="button" className="fs-n" aria-current={cur?.sid === sid && cur.id === n.nodeId} onClick={() => (n.type === "shortcut" ? openShortcut(n) : go(sid, n.nodeId))}><span className="folder" aria-hidden="true" /><span>{nameOf(n)}</span>{n.type === "shortcut" ? <em>共有</em> : files > 0 ? <em className="num">{files}</em> : null}</button>
          {onPath.includes(n.nodeId) && n.type !== "shortcut" && ns.some(x => x.parentId === n.nodeId && isDir(x)) && <div className="fs-kids">{treeKids(sid, n.nodeId)}</div>}
        </React.Fragment>
      );
    });
  };
  const rootBtn = (sid, label) => <button type="button" className="fs-n" aria-current={cur?.sid === sid && cur.id === ROOT} onClick={() => go(sid)}><span className="folder" aria-hidden="true" /><span>{label}</span></button>;
  const shownCourses = arr(courses).filter(c => !cq.trim() || String(c.name || "").includes(cq.trim()));

  if (courses === undefined && !cur) return <div className="soon card">読み込み中</div>;
  const canWriteHere = !!here?.canWrite && !q0;
  const k = here ? visKey(here.acl) : "staff";
  const mi = (t, fn, cls) => <button type="button" className={cls} onClick={() => { setMenu(""); fn(); }}>{t}</button>;

  return (
    <div className="st">
      <div className="head"><h1 className="h1">フォルダ</h1>
        <span className="r">{showCourses && arr(courses).length > 0 && <Btn kind="ghost sm" onClick={() => setOverview(v => !v)}>{overview ? "フォルダへ戻る" : "見え方の一覧"}</Btn>}{admin && <Btn kind="ghost sm" onClick={openUsage}>容量と費用</Btn>}</span>
      </div>
      {courses === null && <div className="lms-err" role="alert">コースを確認できません</div>}
      {err && <div className="lms-err" role="alert">{err}</div>}
      {overview ? (
        <div className="lms-legacy"><Suspense fallback={<div className="soon card">読み込み中</div>}><VisibilityOverview courses={arr(courses)} initialCourseId={cid} onOpen={(sid, nodeId) => { if (spaces[sid] === undefined) loadSpace(sid); go(sid, nodeId); }} /></Suspense></div>
      ) : (
        <div className="fsw">
          <nav className="card fs-tree" aria-label="フォルダ">
            {showCommon && <>
              <div className="fs-sec"><span className="eyebrow">全コース共通</span></div>
              {rootBtn("shared", "共有（全社）")}
              {cur?.sid === "shared" && <div className="fs-kids">{treeKids("shared", ROOT)}</div>}
              {rootBtn("ops", "運営だけ")}
              {cur?.sid === "ops" && <div className="fs-kids">{treeKids("ops", ROOT)}</div>}
            </>}
            {showCourses && <>
              <div className="fs-sec"><span className="eyebrow">コース別</span></div>
              {arr(courses).length > 6 && <span className="fsearch fs-cq"><input type="search" value={cq} placeholder="コースを探す" aria-label="コースを探す" onChange={e => setCq(e.target.value)} /></span>}
              {shownCourses.map(c => {
                const sid = `course#${c.courseId}`, on = !!open[c.courseId];
                return (
                  <React.Fragment key={c.courseId}>
                    <button type="button" className="fs-c" aria-expanded={on} onClick={() => { if (on && cur?.sid !== sid) { go(sid); return; } if (on) { setOpen(o => ({ ...o, [c.courseId]: false })); return; } go(sid); }}><i aria-hidden="true">{on ? "▾" : "▸"}</i><span className="folder" aria-hidden="true" /><span>{c.name || c.courseId}</span></button>
                    {on && <div className="fs-kids">{spaces[sid] === null ? <Chip tone="bad">確認できません</Chip> : <>{rootBtn(sid, "いちばん上")}{treeKids(sid, ROOT)}</>}</div>}
                  </React.Fragment>
                );
              })}
              {courses && !shownCourses.length && <Chip>なし</Chip>}
            </>}
          </nav>
          <section className={`card fs-main${drop ? " dropon" : ""}`}
            onDragOver={e => { if (canWriteHere && e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDrop(true); } }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDrop(false); }}
            onDrop={e => { if (!canWriteHere || !e.dataTransfer?.files?.length) return; e.preventDefault(); setDrop(false); upload([...e.dataTransfer.files]); }}>
            {data === null ? <div className="empty"><b>フォルダを確認できません</b><Btn kind="ghost sm" onClick={() => loadSpace(cur.sid)}>再読み込み</Btn></div>
              : !data || !here ? (cur || courses === undefined ? <div className="soon">読み込み中</div> : <div className="empty"><b>コース</b><Chip>なし</Chip></div>) : (
                <>
                  <div className="fs-top">
                    <div className="fs-bc">
                      <span className={cid ? "fs-scope" : "fs-scope cm"}>{scopeName(cur.sid)}</span>
                      {chain.filter(c => c.nodeId !== ROOT).map((c, i, l) => <React.Fragment key={c.nodeId}><i aria-hidden="true">›</i>{i === l.length - 1 ? <b>{c.name}</b> : <button type="button" className="lnk" onClick={() => go(cur.sid, c.nodeId)}>{c.name}</button>}</React.Fragment>)}
                    </div>
                    <span className="row">
                      <Chip tone={VIS[k][1]}>{VIS[k][0]}</Chip>
                      {here.canWrite && <Btn kind="ghost sm" onClick={() => setDlg({ kind: "acl", node: here })}>このフォルダの公開範囲</Btn>}
                      {cid && <Btn kind="ghost sm" onClick={() => setDlg({ kind: "groups" })}>グループ</Btn>}
                    </span>
                  </div>
                  <div className="fs-top fs-bar">
                    <span className="row">
                      {canWriteHere && <><Btn kind="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy === "upload" ? "置いています" : "アップロード"}</Btn><Btn kind="ghost sm" disabled={!!busy} onClick={() => { setText(""); setDlg({ kind: "folder" }); }}>＋ 新しいフォルダ</Btn></>}
                      {canWriteHere && cid && unitOpts.length > 0 && <label className="fsort">単元にも付ける<select className="in" value={linkTo} onChange={e => setLinkTo(e.target.value)}><option value="">付けない</option>{unitOpts.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}</select></label>}
                      <input ref={fileRef} type="file" multiple className="lms-sr" aria-label="置くファイル" onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) upload(fs); }} />
                    </span>
                    <span className="row">
                      {data.quotaBytes > 0 && <Chip><span className="num">{fmtSize(data.usedBytes || 0)} / {fmtSize(data.quotaBytes)}</span></Chip>}
                      <label className="fsort">並べ替え<select className="in" value={sort} onChange={e => setSort(e.target.value)}><option value="name">名前順</option><option value="new">新しい順</option><option value="size">大きい順</option></select></label>
                      <span className="fsearch"><input type="search" value={q} placeholder="この置き場から探す" aria-label="この置き場から探す" onChange={e => setQ(e.target.value)} /></span>
                    </span>
                  </div>
                  <div className="scroll"><table className="tbl fs-t"><thead><tr><th>名前</th><th>更新日</th><th>大きさ</th><th>公開範囲</th><th aria-label="操作" /></tr></thead><tbody>
                    {list.map(n => {
                      const v = nodeVis(n), used = cur.sid === "shared" ? (links?.[n.nodeId]?.shortcuts?.length || 0) + (links?.[n.nodeId]?.copies?.length || 0) : 0;
                      return (
                        <tr key={n.nodeId} className={menu === n.nodeId ? "on" : ""}>
                          <td><button type="button" className="fs-name" onClick={() => (isDir(n) ? enter(n) : openFile(n))}>{isDir(n) ? <span className="folder" aria-hidden="true" /> : <FileIcon name={n.name} />}<span>{nameOf(n)}{q0 && pathOf(n) && <small className="fs-path">{pathOf(n)}</small>}<small className="fs-meta num">{md(n.updatedAt)}{n.sizeBytes ? ` ・ ${fmtSize(n.sizeBytes)}` : ""} ・ {VIS[v][0]}</small></span></button>{n.type === "shortcut" && <Chip tone="mk">共有</Chip>}{n.ownAcl && <Chip>専用の範囲</Chip>}{used > 0 && <Chip tone="blue">{used} コース</Chip>}</td>
                          <td className="num">{md(n.updatedAt) || "—"}</td>
                          <td className="num">{n.type === "file" ? fmtSize(n.sizeBytes) : "—"}</td>
                          <td><Chip tone={VIS[v][1]}>{VIS[v][0]}</Chip></td>
                          <td className="fs-k">
                            <button type="button" className="kbtn" aria-label={`${nameOf(n)} の操作`} aria-expanded={menu === n.nodeId} onClick={() => setMenu(m => (m === n.nodeId ? "" : n.nodeId))}>…</button>
                            {menu === n.nodeId && (
                              <div className="kmenu" role="menu">
                                {mi("開く", () => (isDir(n) ? enter(n) : openFile(n)))}
                                {n.type === "file" && mi("ダウンロード", () => openFile(n, true))}
                                {cur.sid === "shared" && n.type !== "shortcut" && mi("コースで使う", () => setDlg({ kind: "place", node: n }))}
                                {n.canWrite && <hr />}
                                {n.canWrite && n.type !== "shortcut" && mi("名前を変更", () => { setText(n.name); setDlg({ kind: "rename", node: n }); })}
                                {n.canWrite && n.type !== "shortcut" && mi("移動", () => setDlg({ kind: "move", node: n }))}
                                {n.canWrite && mi("公開範囲", () => setDlg({ kind: "acl", node: n }))}
                                {n.canWrite && <hr />}
                                {n.canWrite && mi(n.type === "shortcut" ? "外す" : "消す", () => setDlg({ kind: "delete", node: n }), "del")}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!list.length && <tr><td colSpan={5}><Chip>なし</Chip></td></tr>}
                  </tbody></table></div>
                  <div className="fs-drop">ここに落とす</div>
                </>
              )}
          </section>
        </div>
      )}
      {dlg?.kind === "acl" && (
        <AclModal node={{ ...dlg.node, parentAcl: byId.get(dlg.node.parentId)?.acl }} isRoot={dlg.node.nodeId === ROOT} sid={cur.sid} groups={groups}
          onCreateGroup={name => apiPost("/library/groups", { courseId: cid, name }).then(g => { loadGroups(); return g; })}
          onClose={() => setDlg(null)}
          onSave={async acl => { await apiPut(`/library/nodes/${encodeURIComponent(dlg.node.nodeId)}`, { spaceId: cur.sid, acl }); await loadSpace(cur.sid); say?.("公開範囲を変えました"); }} />
      )}
      {dlg?.kind === "move" && <MoveModal node={dlg.node} nodes={nodes} onClose={() => setDlg(null)} onMove={async to => { await apiPut(`/library/nodes/${encodeURIComponent(dlg.node.nodeId)}`, { spaceId: cur.sid, parentId: to }); await loadSpace(cur.sid); say?.("移動しました"); }} />}
      {dlg?.kind === "place" && <PlaceModal node={dlg.node} courses={arr(courses)} linked={links?.[dlg.node.nodeId]} onClose={() => setDlg(null)} onPlace={(mode, ids) => place(dlg.node, mode, ids)} onUnlink={unlink} />}
      {dlg && ["folder", "rename", "delete"].includes(dlg.kind) && (
        <Modal title={dlg.kind === "folder" ? "新しいフォルダ" : dlg.kind === "rename" ? "名前を変更" : dlg.node.type === "shortcut" ? "外す" : "消す"} width={420} onClose={() => setDlg(null)}
          footer={<><Btn kind="ghost" onClick={() => setDlg(null)}>やめる</Btn><Btn onClick={confirmDlg}>{dlg.kind === "delete" ? (dlg.node.type === "shortcut" ? "外す" : "消す") : "決める"}</Btn></>}>
          {dlg.kind === "delete"
            ? <b>{nameOf(dlg.node)}{dlg.node.type === "folder" && nodes.some(x => x.parentId === dlg.node.nodeId) ? "（中身ごと）" : ""}</b>
            : <input type="text" value={text} autoFocus aria-label="名前" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") confirmDlg(); }} />}
        </Modal>
      )}
      {dlg?.kind === "groups" && <div className="lms-legacy"><Suspense fallback={null}><GroupsModal courseId={cid} courseName={courseName(cid)} onClose={() => { setDlg(null); loadGroups(); }} /></Suspense></div>}
      {usage?.open && usage.data && <div className="lms-legacy"><Suspense fallback={null}><UsageModal data={usage.data} onClose={() => setUsage(null)} /></Suspense></div>}
      {viewing && <Suspense fallback={null}><div className="lms-legacy"><MaterialViewer courseId={cid} material={{ materialId: viewing.materialId, title: viewing.name, mode: "view" }} onClose={() => setViewing(null)} canAnnotate /></div></Suspense>}
    </div>
  );
}

export default StaffFolder;
export const AdminCourseFolder = p => <StaffFolder {...p} view="course" />;
export const AdminSharedFolder = p => <StaffFolder {...p} view="common" />;
