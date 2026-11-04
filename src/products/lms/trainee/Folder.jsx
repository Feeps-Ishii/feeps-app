import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { normalizeCurriculumSections } from "../../training/TrainingComponents.jsx";
import { fmtSize } from "../../training/DevReview.jsx";
import { getActiveCourseId, setActiveCourseId, takeLibraryTarget } from "../../../utils/common/courseContext.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, FileIcon, Modal } from "../parts/ui.jsx";

const MaterialViewer = lazy(() => import("../../training/MaterialViewer.jsx"));

/* 受講生のフォルダ（モック docT2）：左にフォルダ（コース全体・単元を 1 から順・自分の）、右に中身。上の検索は全部から探す。
   中の階層・置ける場所へのアップロード・マイフォルダ・共有のショートカットは今の画面と同じ（できることの判定は API） */

const ROOT = "root", ME = "me";
const arr = v => (Array.isArray(v) ? v : []);
const uniq = l => [...new Set(l.filter(Boolean))];
const dk = v => String(v || "").slice(0, 10);
const isD = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
const md = v => { const [, m, d] = dk(v).split("-").map(Number); return m ? `${m}/${d}` : ""; };
const ext = n => (String(n).split(".").pop() || "").toLowerCase();
const isPdf = n => ext(n.name) === "pdf" || n.contentType === "application/pdf";
const isNew = (n, today) => n.updatedAt && Math.abs(Date.parse(today) - Date.parse(dk(n.updatedAt))) <= 3 * 86400000;
const byName = (a, b) => String(a.name).localeCompare(String(b.name), "ja");
const nameOf = n => (n.type === "shortcut" ? n.targetName || n.name : n.name);
const dayList = s => arr(s.chapters).flatMap(c => arr(c.lessons));
const rangeOf = s => {
  const ds = [s, ...dayList(s)].flatMap(x => [dk(x.startDate), dk(x.endDate || x.startDate)]).filter(isD).sort();
  return ds.length ? { start: ds[0], end: ds[ds.length - 1] } : null;
};
const spaceQuery = sp => `spaceId=${encodeURIComponent(sp.spaceId)}${sp.via ? `&via=${encodeURIComponent(sp.via)}` : ""}`;

export default function TraineeFolder({ go, say }) {
  const today = todayStr();
  const [target] = useState(() => takeLibraryTarget(true));
  const [st, setSt] = useState({ state: "loading" });
  const [key, setKey] = useState(0);
  const [q, setQ] = useState("");
  const [nav, setNav] = useState(null);       // 左で選んでいるもの
  const [path, setPath] = useState([]);       // その中で開いたフォルダ [{ space, id, name }]
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [dlg, setDlg] = useState(null);       // { kind: "folder"|"rename"|"delete", node?, sp }
  const [text, setText] = useState("");
  const navRef = useRef(null), navDone = useRef(false), fileRef = useRef(null);

  const load = useCallback(async () => {
    const cs = arr(await apiGet("/me/courses")), c = cs.find(x => x.courseId === (target?.courseId || getActiveCourseId())) || cs[0];
    const get = (sid, via) => apiGet(`/library?spaceId=${encodeURIComponent(sid)}${via ? `&via=${encodeURIComponent(via)}` : ""}`);
    const me = await get(ME).catch(() => null);
    if (!c) { setSt({ state: "ready", course: null, spaces: { me }, units: [], devs: null }); return; }
    setActiveCourseId(c.courseId);
    const spaceId = `course#${c.courseId}`;
    const [course, cur, devs] = await Promise.all([
      get(spaceId),
      apiGet(`/courses/${c.courseId}/curriculum`).catch(() => null),
      apiGet(`/dev-assignments?courseId=${encodeURIComponent(c.courseId)}`).then(r => arr(r?.items)).catch(() => null),
    ]);
    const shared = arr(course.nodes).some(n => n.type === "shortcut") ? await get("shared", spaceId).catch(() => null) : null;
    setSt({ state: "ready", course: c, spaceId, spaces: { course, me, shared }, sections: cur ? normalizeCurriculumSections(cur) : [], devs });
  }, [target]);
  useEffect(() => {
    let alive = true;
    load().catch(() => { if (alive) setSt({ state: "error" }); });
    return () => { alive = false; };
  }, [key, load]);

  // 左の並びと、どのファイル・フォルダがどの単元のものか
  const model = useMemo(() => {
    if (st.state !== "ready" || !st.course) return null;
    const nodes = arr(st.spaces.course?.nodes), byId = new Map(nodes.map(n => [n.nodeId, n]));
    const devRoots = new Set(arr(st.devs).map(d => d.folderId).filter(Boolean));
    const inDev = n => { let c = n; const seen = new Set(); while (c && !seen.has(c.nodeId)) { if (devRoots.has(c.nodeId)) return true; seen.add(c.nodeId); c = byId.get(c.parentId); } return false; };
    const assigned = new Set();
    const units = arr(st.sections).map((s, i) => {
      const days = dayList(s);
      const matIds = new Set(uniq([...arr(s.materialIds), ...days.flatMap(d => [...arr(d.materialIds), d.materialId])]));
      const links = uniq([...arr(s.folderLinks), ...days.flatMap(d => arr(d.folderLinks))].map(f => f.nodeId));
      const items = [...nodes.filter(n => n.type === "file" && matIds.has(n.materialId)), ...links.map(id => byId.get(id)).filter(Boolean)].filter(n => !inDev(n));
      items.forEach(n => assigned.add(n.nodeId));
      return { id: `u${s.id}`, k: "unit", no: i + 1, n: s.title, range: rangeOf(s), items };
    });
    const rest = nodes.filter(n => n.parentId === ROOT && n.nodeId !== ROOT && !assigned.has(n.nodeId) && !inDev(n));
    const curUnit = units.find(u => u.range && u.range.start <= today && today <= u.range.end) || units.filter(u => u.range && u.range.start <= today).pop();
    return { units, rest, nodes, inDev, curUnit, byId };
  }, [st, today]);

  // カリキュラムのフォルダのカードから来たときは、そのフォルダを開く
  useEffect(() => {
    if (!model || nav) return;
    const t = target?.nodeId ? model.byId.get(target.nodeId) : null;
    if (t) {
      const u = model.units.find(x => x.items.includes(t));
      setNav(u?.id || "all");
      if (!u || t.type !== "file") setPath([crumb(t, st)]);
    } else setNav(model.curUnit?.id || "all");
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  // スマホで左の一覧が横に流れるとき、はじめだけ選んでいるものが見える位置に
  useEffect(() => {
    const r = navRef.current;
    if (!r || navDone.current || !nav) return;
    navDone.current = true;
    const on = r.querySelector(".fd-n.on");
    if (on && r.scrollWidth > r.clientWidth + 1) r.scrollLeft = on.offsetLeft - r.offsetLeft - 16;
  }, [nav]);

  if (st.state === "loading") return <div className="soon card">読み込み中</div>;
  if (st.state === "error") return <Card><div className="empty"><b>フォルダを確認できません</b><Btn kind="ghost sm" onClick={() => { setSt({ state: "loading" }); setKey(k => k + 1); }}>再読み込み</Btn></div></Card>;

  const courseSp = { spaceId: st.spaceId }, sharedSp = { spaceId: "shared", via: st.spaceId }, meSp = { spaceId: ME };
  const spData = sp => (sp.spaceId === ME ? st.spaces.me : sp.spaceId === "shared" ? st.spaces.shared : st.spaces.course);
  const kids = (sp, id) => arr(spData(sp)?.nodes).filter(n => n.parentId === id && !(sp === courseSp && model?.inDev(n)));
  const units = model?.units || [];
  const cnt = u => u.items.length;
  const q0 = q.trim().toLowerCase();

  async function reload() { await load(); }
  async function run(fn) {
    setBusy("run"); setErr("");
    try { await fn(); await reload(); } catch (e) { setErr(e?.errorMessage || e?.message || "うまくいきませんでした"); } finally { setBusy(""); }
  }
  const openFile = async (n, sp, download) => {
    setErr("");
    if (!download && sp.spaceId === st.spaceId && n.materialId && isPdf(n)) { setViewing(n); return; }
    try {
      const r = await apiGet(`/library/download?${spaceQuery(sp)}&nodeId=${encodeURIComponent(n.nodeId)}${download ? "&mode=download" : ""}`);
      window.open(r.url, "_blank", "noopener");
    } catch (e) { setErr(e?.errorMessage || e?.message || `「${n.name}」を開けませんでした`); }
  };
  const upload = (files, sp, parentId) => run(async () => {
    for (const f of files) {
      // eslint-disable-next-line no-await-in-loop
      const got = await apiPost("/library/upload-url", { spaceId: sp.spaceId, parentId, filename: f.name, contentType: f.type || "application/octet-stream", sizeBytes: f.size });
      // eslint-disable-next-line no-await-in-loop
      const put = await fetch(got.uploadUrl, { method: "PUT", headers: { "content-type": got.contentType }, body: f });
      if (!put.ok) throw new Error(`「${f.name}」を置けませんでした（${put.status}）`);
      // eslint-disable-next-line no-await-in-loop
      await apiPost("/library/files", { spaceId: sp.spaceId, parentId, nodeId: got.nodeId, s3key: got.s3key, materialId: got.materialId, name: f.name, sizeBytes: f.size, contentType: got.contentType });
    }
    say?.(`${files.length} ファイルを置きました`);
  });
  const confirmDlg = () => {
    const { kind, node, sp, parentId } = dlg, name = text.trim();
    if (kind !== "delete" && !name) return;
    setDlg(null);
    run(async () => {
      if (kind === "folder") await apiPost("/library/folders", { spaceId: sp.spaceId, parentId, name });
      if (kind === "rename") await apiPut(`/library/nodes/${encodeURIComponent(node.nodeId)}`, { spaceId: sp.spaceId, name });
      if (kind === "delete") await apiDelete(`/library/nodes/${encodeURIComponent(node.nodeId)}?spaceId=${encodeURIComponent(sp.spaceId)}`);
    });
  };

  const fileRow = (n, sp, where) => (
    <div key={n.nodeId} className="fd-f">
      <FileIcon name={n.name} />
      <span className="fd-fb"><b>{n.name}</b><small className="num">{where ? `${where} ・ ` : ""}{md(n.updatedAt)}{n.sizeBytes ? ` ・ ${fmtSize(n.sizeBytes)}` : ""}</small></span>
      {isNew(n, today) ? <Chip tone="co">新しい</Chip> : <span />}
      <span className="fd-ac">
        {isPdf(n) && <Btn kind="ghost sm" onClick={() => openFile(n, sp)}>開く</Btn>}
        <Btn kind="ghost sm fd-dl" aria-label={`${n.name} をダウンロード`} onClick={() => openFile(n, sp, true)}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3V11M4.5 7.5L8 11L11.5 7.5M3 13H13" /></svg><span>ダウンロード</span></Btn>
        {n.canWrite && rowEdit(n, sp)}
      </span>
    </div>
  );
  function rowEdit(node, sp) {
    return <><Btn kind="ghost sm" onClick={() => { setText(node.name); setDlg({ kind: "rename", node, sp }); }}>名前</Btn><Btn kind="ghost sm" onClick={() => setDlg({ kind: "delete", node, sp })}>消す</Btn></>;
  }
  const crumbOf = (n, sp) => (n.type === "shortcut" ? { sp: sharedSp, id: n.targetNodeId, name: nameOf(n) } : { sp, id: n.nodeId, name: n.name });
  const folderRow = (n, sp) => {
    const c = crumbOf(n, sp), count = n.type === "shortcut" ? n.targetFiles : kids(sp, n.nodeId).length;
    return (
      <div key={n.nodeId} className="fd-f fd-d">
        <span className="fd-fi" aria-hidden="true"><span className="dv-folder" /></span>
        <span className="fd-fb"><b>{nameOf(n)}</b>{Number.isFinite(count) && <small className="num">{count} 件</small>}</span>
        <span />
        <span className="fd-ac"><Btn kind="ghost sm" onClick={() => setPath(p => [...p, c])}>開く</Btn>{n.canWrite && n.type !== "shortcut" && rowEdit(n, sp)}</span>
      </div>
    );
  };
  const grp = (t, l) => (l.length ? <div className="fd-g"><span className="eyebrow">{t}<em className="num">{l.length}</em></span><div className="fd-l">{l}</div></div> : null);
  const lists = (nodes, sp, docLabel = "資料") => {
    const fold = nodes.filter(n => n.type !== "file").sort(byName), files = nodes.filter(n => n.type === "file").sort(byName);
    return <>{grp("フォルダ", fold.map(n => folderRow(n, sp)))}{grp("スライド", files.filter(isPdf).map(n => fileRow(n, sp)))}{grp(docLabel, files.filter(n => !isPdf(n)).map(n => fileRow(n, sp)))}</>;
  };
  const writeBar = (sp, parentId) => (
    <div className="row">
      <Btn kind="ghost sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>ファイルを置く</Btn>
      <Btn kind="ghost sm" disabled={!!busy} onClick={() => { setText(""); setDlg({ kind: "folder", sp, parentId }); }}>フォルダを作る</Btn>
      <input ref={fileRef} type="file" multiple className="lms-sr" aria-label="置くファイル" onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) upload(fs, sp, parentId); }} />
    </div>
  );
  const navBtn = (id, numOrNull, label, sub, count, cur) => (
    <button key={id} type="button" className={`fd-n${nav === id && !q0 ? " on" : ""}${cur ? " cur" : ""}`} aria-current={nav === id && !q0} onClick={() => { setNav(id); setPath([]); setQ(""); setErr(""); }}>
      {numOrNull != null ? <span className="fd-no num" aria-hidden="true">{numOrNull}</span> : <span className="fd-no fd-fi" aria-hidden="true"><span className="dv-folder" /></span>}
      <span className="fd-nb"><b>{label}</b>{sub && <small>{sub}</small>}</span>{count > 0 ? <em className="num">{count}</em> : <span />}
    </button>
  );

  // 全部のフォルダから探す（マイフォルダ・共有のショートカット先も）
  const hits = q0 ? [
    ...(model?.nodes || []).filter(n => n.type === "file" && !model.inDev(n)).map(n => [n, courseSp, units.find(u => u.items.includes(n)) ? `単元 ${units.find(u => u.items.includes(n)).no}` : "コース全体"]),
    ...arr(st.spaces.shared?.nodes).filter(n => n.type === "file").map(n => [n, sharedSp, "共有"]),
    ...arr(st.spaces.me?.nodes).filter(n => n.type === "file").map(n => [n, meSp, "マイフォルダ"]),
  ].filter(([n]) => String(n.name).toLowerCase().includes(q0)) : [];
  const nNew = (model?.nodes || []).filter(n => n.type === "file" && !model.inDev(n) && isNew(n, today)).length;
  const devRows = arr(st.devs).filter(d => d.state !== "none");
  const here = path[path.length - 1];
  const unit = units.find(u => u.id === nav);
  const meRoot = arr(st.spaces.me?.nodes).find(n => n.nodeId === ROOT);
  const hereNode = here ? arr(spData(here.sp)?.nodes).find(n => n.nodeId === here.id) : null;
  const crumbs = path.length > 0 && (
    <div className="fd-cr">
      <button type="button" onClick={() => setPath([])}>{unit ? unit.n : nav === "me" ? "マイフォルダ" : "コース全体"}</button>
      {path.map((c, i) => <React.Fragment key={c.id}><i aria-hidden="true">/</i>{i === path.length - 1 ? <b>{c.name}</b> : <button type="button" onClick={() => setPath(path.slice(0, i + 1))}>{c.name}</button>}</React.Fragment>)}
    </div>
  );

  let main;
  if (q0) {
    main = (
      <Card className="pad fd-main">
        <div className="head"><div><div className="eyebrow">全部のフォルダから</div><h2 className="h2">「{q.trim()}」</h2></div><span className="r"><Chip>{hits.length} 件</Chip><Btn kind="ghost sm" onClick={() => setQ("")}>探すのをやめる</Btn></span></div>
        {hits.length ? <div className="fd-l">{hits.map(([n, sp, w]) => fileRow(n, sp, w))}</div> : <div><Chip>なし</Chip></div>}
      </Card>
    );
  } else if (here) {
    const nodes = kids(here.sp, here.id);
    main = (
      <Card className="pad fd-main">
        <div className="head"><div>{crumbs}<h2 className="h2"><span className="dv-folder" aria-hidden="true" />{here.name}</h2></div></div>
        {hereNode?.canWrite && writeBar(here.sp, here.id)}
        {nodes.length ? lists(nodes, here.sp) : <div><Chip>なし</Chip></div>}
      </Card>
    );
  } else if (nav === "dev") {
    main = (
      <Card className="pad fd-main">
        <div className="head"><div><div className="eyebrow">自分の</div><h2 className="h2"><span className="dv-folder" aria-hidden="true" />個人開発の提出</h2></div><span className="r"><Chip>自分と講師だけ</Chip></span></div>
        {st.devs === null ? <div className="empty"><b>提出を確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div>
          : devRows.length ? <div className="fd-l">{devRows.map(d => (
            <div key={d.id} className="fd-f fd-d">
              <span className="fd-fi" aria-hidden="true"><span className="dv-folder" /></span>
              <span className="fd-fb"><b>{d.title}</b>{d.lastUpload && <small className="num">最新 {md(d.lastUpload)}</small>}</span>
              <Chip tone={d.state === "resubmit" ? "warn" : d.state === "done" ? "ok" : "blue"}>{d.state === "resubmit" ? "出し直し" : d.state === "done" ? "レビュー済み" : "レビュー待ち"}</Chip>
              <Btn kind="ghost sm" onClick={() => { try { sessionStorage.setItem("lms.devFocus", d.id); } catch { /* 開くだけなので無くてもよい */ } go("dev"); }}>個人開発で見る</Btn>
            </div>
          ))}</div> : <div><Chip>未提出</Chip></div>}
      </Card>
    );
  } else if (nav === "me") {
    main = (
      <Card className="pad fd-main">
        <div className="head"><div><div className="eyebrow">自分の</div><h2 className="h2"><span className="dv-folder" aria-hidden="true" />マイフォルダ</h2></div>{st.spaces.me?.quotaBytes > 0 && <span className="r"><Chip><span className="num">{fmtSize(st.spaces.me.usedBytes || 0)} / {fmtSize(st.spaces.me.quotaBytes)}</span></Chip></span>}</div>
        {st.spaces.me === null ? <div className="empty"><b>マイフォルダを確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div>
          : <>{meRoot?.canWrite !== false && writeBar(meSp, ROOT)}{kids(meSp, ROOT).length ? lists(kids(meSp, ROOT), meSp) : <div><Chip>なし</Chip></div>}</>}
      </Card>
    );
  } else if (unit) {
    main = (
      <Card className={`pad fd-main${unit === model.curUnit ? " c-cur" : ""}`}>
        <div className="head"><div><div className="eyebrow">単元 {unit.no}{unit.range ? ` ・ ${md(unit.range.start)}〜${md(unit.range.end)}` : ""}</div><h2 className="h2"><span className="dv-folder" aria-hidden="true" />{unit.n}</h2></div>{unit === model.curUnit && <span className="r"><Chip tone="co">今の単元</Chip></span>}</div>
        {cnt(unit) ? lists(unit.items, courseSp, "配布資料") : <div><Chip>なし</Chip></div>}
      </Card>
    );
  } else {
    const rootNode = model?.byId.get(ROOT);
    main = (
      <Card className="pad fd-main">
        <div className="head"><div><div className="eyebrow">コース全体</div><h2 className="h2"><span className="dv-folder" aria-hidden="true" />{st.course?.name || st.course?.courseName || "コース全体"}</h2></div></div>
        {rootNode?.canWrite && writeBar(courseSp, ROOT)}
        {model?.rest.length ? lists(model.rest, courseSp) : <div><Chip>なし</Chip></div>}
      </Card>
    );
  }

  return (
    <div className="th fd">
      <div className="th-top">
        <div><div className="eyebrow">{st.course?.name || st.course?.courseName || ""}</div><h1 className="h1">フォルダ</h1></div>
        <div className="th-att">
          {nNew > 0 && <span className="th-pill"><i aria-hidden="true" style={{ background: "var(--cur-d)" }} />新しいファイル <b className="num">{nNew}</b></span>}
          <span className="fsearch fd-q"><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="ファイルを探す" aria-label="全部のフォルダからファイルを探す" /></span>
        </div>
      </div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {busy && <div className="dv-mt" role="status">処理しています</div>}
      <div className="fd-w">
        <nav className="card fd-nav" aria-label="フォルダ" ref={navRef}>
          {st.course && navBtn("all", null, "コース全体", "", model?.rest.length || 0)}
          {units.length > 0 && <span className="eyebrow fd-sec">単元</span>}
          {units.map(u => navBtn(u.id, u.no, u.n, u === model.curUnit ? "今の単元" : !cnt(u) ? "まだ" : "", cnt(u), u === model.curUnit))}
          <span className="eyebrow fd-sec">自分の</span>
          {st.course && navBtn("dev", null, "個人開発の提出", "", devRows.length)}
          {navBtn("me", null, "マイフォルダ", "", kids(meSp, ROOT).length)}
        </nav>
        {main}
      </div>
      {viewing && (
        <Suspense fallback={null}>
          <div className="lms-legacy"><MaterialViewer courseId={st.course?.courseId} material={{ materialId: viewing.materialId, title: viewing.name, mode: "view" }} onClose={() => setViewing(null)} canAnnotate /></div>
        </Suspense>
      )}
      {dlg && (
        <Modal title={dlg.kind === "folder" ? "フォルダを作る" : dlg.kind === "rename" ? "名前を変える" : "消す"} width={420} onClose={() => setDlg(null)}
          footer={<><Btn kind="ghost" onClick={() => setDlg(null)}>やめる</Btn><Btn onClick={confirmDlg}>{dlg.kind === "delete" ? "消す" : "決める"}</Btn></>}>
          {dlg.kind === "delete"
            ? <b>{nameOf(dlg.node)}{dlg.node.type === "folder" && kids(dlg.sp, dlg.node.nodeId).length > 0 ? "（中身ごと）" : ""}</b>
            : <input type="text" value={text} autoFocus aria-label="名前" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") confirmDlg(); }} />}
        </Modal>
      )}
    </div>
  );
}

// カリキュラムから直接開くときの場所
function crumb(n, st) {
  return n.type === "shortcut" ? { sp: { spaceId: "shared", via: st.spaceId }, id: n.targetNodeId, name: nameOf(n) } : { sp: { spaceId: st.spaceId }, id: n.nodeId, name: n.name };
}
