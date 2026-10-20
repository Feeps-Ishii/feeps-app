import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../api.js";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { ROLE_NAMES, aclLabel, aclText, curriculumCount, curriculumDates, relayoutCurriculum, testCourseIds } from "./materials.js";

const LibraryView = React.lazy(() => import("../training/LibraryView.jsx"));

/* 教材（2026-10-20）。コースと関係ない入口。作ったものをコースに付けて使い回す。
   フォルダ：置き場ごとのフォルダと「誰に見せているか」。公開先を変える・共有のフォルダをコースに付ける
   テスト：1つのテストを何コースにも付けられる（courseIds）
   カリキュラム：別のコースへ写す（写す先の始まりの日から研修日で並べ直す）
   練習問題：別のコースへ下書きとして写す
   どれも確かめる窓（ConfirmDialog）を通してから実行する */

const TABS = [["folders", "フォルダ"], ["tests", "テスト"], ["curriculum", "カリキュラム"], ["practice", "練習問題"]];

function Chips({ ids, courses }) {
  if (!ids.length) return <span className="dhc-note">どのコースにも付いていません</span>;
  return ids.map(id => {
    const c = courses.find(x => x.id === id);
    return <span key={id} className="dhc-cchip" style={{ "--c": c?.color || "#8E96A6" }} title={c?.company || ""}><i />{c?.name || "ほかのコース"}</span>;
  });
}

function CourseChecks({ courses, value, onChange, exclude = [] }) {
  const list = courses.filter(c => !exclude.includes(c.id));
  if (!list.length) return <span className="dhc-note">付けられるコースがありません</span>;
  return (
    <div className="dhc-checks">
      {list.map(c => {
        const on = value.includes(c.id);
        return (
          <label key={c.id} className={on ? "on" : ""}>
            <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked ? [...value, c.id] : value.filter(x => x !== c.id))} />
            {c.name}
          </label>
        );
      })}
    </div>
  );
}

function CourseSelect({ courses, value, onChange, exclude = [], label = "コース" }) {
  return (
    <label className="dhc-field">{label}
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">選んでください</option>
        {courses.filter(c => !exclude.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? `（${c.company}）` : ""}</option>)}
      </select>
    </label>
  );
}

const Loading = () => <div className="dhc-empty">読み込んでいます…</div>;
const Failed = ({ text, retry }) => <div className="dhc-err">{text} <button type="button" className="dhc-lnk" onClick={retry}>もう一度</button></div>;

/* ---------- フォルダ ---------- */
function AclEditor({ acl, spaceId, onChange }) {
  const a = acl || { scope: "course", roles: {} };
  const set = patch => onChange({ ...a, ...patch });
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="dhc-field">見せる人
        <div className="dhc-checks">
          {ROLE_NAMES.map(([k, t]) => (
            <label key={k} className={a.roles?.[k] ? "on" : ""}>
              <input type="checkbox" checked={!!a.roles?.[k]} onChange={e => set({ roles: { ...a.roles, [k]: e.target.checked } })} />{t}
            </label>
          ))}
        </div>
      </div>
      {spaceId !== "shared" && spaceId !== "ops" && a.scope !== "groups" && (
        <div className="dhc-field">範囲
          <div className="dhc-checks">
            {[["course", "このコース"], ["org", "全コース"]].map(([k, t]) => (
              <label key={k} className={a.scope === k ? "on" : ""}><input type="radio" name="dhc-scope" checked={a.scope === k} onChange={() => set({ scope: k })} />{t}</label>
            ))}
          </div>
        </div>
      )}
      {a.scope === "groups" && <span className="dhc-note">いまはグループに見せています（グループの変更はフォルダの画面で行えます）</span>}
      <span className="dhc-note">管理者はいつでも見られます。中のフォルダは、ここより広くは見せられません。</span>
    </div>
  );
}

function FoldersTab({ courses, role, focus }) {
  const spaces = useMemo(() => [
    ["shared", "共有（全社）"],
    ["ops", "運営だけ"],
    ...courses.map(c => [`course#${c.id}`, c.name]),
  ], [courses]);
  const [spaceId, setSpaceId] = useState(focus?.spaceId || "shared");
  const [state, setState] = useState({ loading: true });
  const [links, setLinks] = useState(null);
  const [edit, setEdit] = useState(null);       // { node, acl }
  const [attach, setAttach] = useState(null);   // { node, ids, mode }
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    setState({ loading: true });
    try {
      const r = await apiGet(`/library?spaceId=${encodeURIComponent(spaceId)}`);
      setState({ loading: false, nodes: r?.nodes || [] });
    } catch (e) { setState({ loading: false, error: e?.errorMessage || "フォルダを読み込めませんでした。" }); }
    if (spaceId === "shared") apiGet("/library/links?spaceId=shared").then(r => setLinks(r?.links || {})).catch(() => setLinks({}));
  }, [spaceId]);
  useEffect(() => { load(); }, [load]);

  const tree = useMemo(() => {
    const nodes = state.nodes || [];
    const kids = new Map();
    nodes.forEach(n => { const k = n.parentId || ""; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(n); });
    const files = id => (kids.get(id) || []).reduce((s, n) => s + (n.type === "file" ? 1 : n.type === "folder" ? files(n.nodeId) : 0), 0);
    const rows = [];
    const root = nodes.find(n => n.nodeId === "root");
    (function walk(id, d) {
      (kids.get(id) || []).filter(n => n.type === "folder" || n.type === "shortcut").sort((a, b) => String(a.name).localeCompare(String(b.name), "ja"))
        .forEach(n => { rows.push({ n, d, files: n.type === "folder" ? files(n.nodeId) : n.targetFiles ?? null }); if (d < 3) walk(n.nodeId, d + 1); });
    })("root", 0);
    return { root, rows, rootFiles: files("root") };
  }, [state.nodes]);

  if (open) {
    return (
      <>
        <div><button type="button" className="dhc-sbtn" onClick={() => { setOpen(false); load(); }}>← 公開先の一覧に戻る</button></div>
        <React.Suspense fallback={<Loading />}>
          <LibraryView role={role} go={() => {}} scope={spaceId.startsWith("course#") ? { courseId: spaceId.slice(7) } : null} />
        </React.Suspense>
      </>
    );
  }
  const linkOf = n => (links?.[n.nodeId] ? [...links[n.nodeId].shortcuts, ...links[n.nodeId].copies].map(x => x.courseId) : []);
  return (
    <>
      <div className="dhc-toolbar">
        <label className="dhc-field" style={{ minWidth: 240 }}>置き場
          <select value={spaceId} onChange={e => setSpaceId(e.target.value)}>
            {spaces.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </label>
        <span style={{ marginLeft: "auto" }} />
        <button type="button" className="dhc-sbtn pri" onClick={() => setOpen(true)}>フォルダの画面で開く（ファイルを置く・作る）</button>
      </div>
      {state.loading ? <Loading /> : state.error ? <Failed text={state.error} retry={load} /> : (
        <div className="dhc-card dhc-tree">
          <div className="dhc-row" style={{ background: "var(--soft)", borderRadius: "16px 16px 0 0" }}>
            <span className="nm"><b>この置き場のいちばん上</b><small>ファイル {tree.rootFiles}</small></span>
            <span className="uses"><span className="dhc-pill blue">{aclText(tree.root?.acl, spaceId)}</span></span>
            <span className="act">{tree.root && <button type="button" className="dhc-sbtn" onClick={() => setEdit({ node: tree.root, acl: tree.root.ownAcl || tree.root.acl })}>見せる人を変える</button>}</span>
          </div>
          {!tree.rows.length && <div className="dhc-empty">フォルダはまだありません。「フォルダの画面で開く」から作れます。</div>}
          {tree.rows.map(({ n, d, files }) => {
            const a = aclLabel(n.acl, spaceId);
            const used = spaceId === "shared" ? linkOf(n) : [];
            return (
              <div key={n.nodeId} className="dhc-row">
                <span className="nm" style={{ "--d": d }}>
                  <b><span className={`dhc-fold${n.type === "shortcut" ? " sc" : ""}`} aria-hidden="true" />{n.name}</b>
                  <small>{n.type === "shortcut" ? `共有のフォルダへのつなぎ${n.targetName ? `（${n.targetName}）` : ""}` : `ファイル ${files}`}{n.ownAcl ? "" : " ・ 上と同じ"}</small>
                </span>
                <span className="uses">
                  {a.roles.length ? a.roles.map(r => <span key={r} className="dhc-pill ok">{r}</span>) : <span className="dhc-pill">講師・管理者だけ</span>}
                  <span className="dhc-pill blue">{a.scope}</span>
                  {a.owner && <span className="dhc-pill">本人だけ</span>}
                  {spaceId === "shared" && <Chips ids={used} courses={courses} />}
                </span>
                <span className="act">
                  {n.type === "folder" && <button type="button" className="dhc-sbtn" onClick={() => setEdit({ node: n, acl: n.ownAcl || n.acl })}>見せる人を変える</button>}
                  {spaceId === "shared" && n.type === "folder" && <button type="button" className="dhc-sbtn" onClick={() => setAttach({ node: n, ids: [], mode: "link", used })}>コースに付ける</button>}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {edit && (
        <ConfirmDialog title={`「${edit.node.nodeId === "root" ? "いちばん上" : edit.node.name}」を見せる人`}
          rows={[["いま", aclText(edit.node.acl, spaceId)], ["変えたあと", aclText(edit.acl, spaceId)]]}
          warn={(() => {
            // 見える範囲は上のフォルダより広くできない（utils/libraryAcl.mjs）。上で見せていない人は、ここで足しても見えない
            const parent = (state.nodes || []).find(n => n.nodeId === edit.node.parentId);
            const blocked = parent ? ROLE_NAMES.filter(([k]) => edit.acl?.roles?.[k] && !parent.acl?.roles?.[k]).map(([, t]) => t) : [];
            if (blocked.length) return `上のフォルダ（${parent.nodeId === "root" ? "いちばん上" : parent.name}）で${blocked.join("・")}に見せていないので、ここだけ変えても見えません。先に上のフォルダを変えてください。`;
            return edit.acl?.roles?.trainee && !edit.node.acl?.roles?.trainee ? "受講生に見えるようになります（中のファイルも見えます）。" : "";
          })()}
          runLabel="この内容で変える"
          onClose={() => { setEdit(null); load(); }}
          onRun={async () => { await apiPut(`/library/nodes/${encodeURIComponent(edit.node.nodeId)}`, { spaceId, acl: edit.acl }); return "変えました。"; }}>
          <AclEditor acl={edit.acl} spaceId={spaceId} onChange={acl => setEdit(x => ({ ...x, acl }))} />
        </ConfirmDialog>
      )}
      {attach && (
        <ConfirmDialog title={`「${attach.node.name}」をコースに付ける`} canRun={attach.ids.length > 0}
          rows={[["付けるコース", attach.ids.map(id => courses.find(c => c.id === id)?.name).join("、") || "—"], ["付け方", attach.mode === "link" ? "つなぐ（元を直すと全コースに反映）" : "写す（コースごとに直せる）"], ["見せる人", aclText(attach.node.acl, "shared")]]}
          onClose={() => { setAttach(null); load(); }}
          onRun={async () => { const r = await apiPost(`/library/${attach.mode === "link" ? "link-folder" : "copy-folder"}`, { spaceId: "shared", nodeId: attach.node.nodeId, courseIds: attach.ids }); return `${(r?.placed || []).length} コースに付けました。${(r?.skipped || []).length ? `（${r.skipped.length} コースはもう付いていました）` : ""}`; }}>
          <div className="dhc-field">付けるコース<CourseChecks courses={courses} value={attach.ids} exclude={attach.used} onChange={ids => setAttach(x => ({ ...x, ids }))} /></div>
          <div className="dhc-field">付け方
            <div className="dhc-checks">
              {[["link", "つなぐ"], ["copy", "写す"]].map(([k, t]) => <label key={k} className={attach.mode === k ? "on" : ""}><input type="radio" name="dhc-mode" checked={attach.mode === k} onChange={() => setAttach(x => ({ ...x, mode: k }))} />{t}</label>)}
            </div>
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}

/* ---------- テスト ---------- */
function TestsTab({ courses, openCourse }) {
  const [state, setState] = useState({ loading: true });
  const [q, setQ] = useState("");
  const [only, setOnly] = useState("");
  const [attach, setAttach] = useState(null);
  const load = useCallback(async () => {
    setState({ loading: true });
    try { setState({ loading: false, tests: (await apiGet("/tests")) || [] }); }
    catch (e) { setState({ loading: false, error: e?.errorMessage || "テストを読み込めませんでした。" }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const list = (state.tests || [])
    .filter(t => t.status !== "archived")
    .filter(t => !q || String(t.title || "").includes(q))
    .filter(t => !only || testCourseIds(t).includes(only))
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  return (
    <>
      <div className="dhc-toolbar">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="テストの名前で探す" aria-label="テストを探す" />
        <select value={only} onChange={e => setOnly(e.target.value)} aria-label="コースで絞る">
          <option value="">すべてのコース</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {state.loading ? <Loading /> : state.error ? <Failed text={state.error} retry={load} /> : (
        <div className="dhc-card dhc-list">
          {!list.length && <div className="dhc-empty">テストがありません。コースの「テスト」タブで作れます。</div>}
          {list.map(t => {
            const ids = testCourseIds(t);
            return (
              <div key={t.testId || t.id} className="dhc-row">
                <span className="nm"><b>{t.title || "（名前なし）"}</b><small>{(t.questions || []).length || t.questionCount || 0} 問 ・ {t.status === "published" ? "公開中" : "下書き"}</small></span>
                <span className="uses"><Chips ids={ids} courses={courses} /></span>
                <span className="act">
                  <button type="button" className="dhc-sbtn" onClick={() => setAttach({ t, ids: [], cur: ids })}>コースに付ける</button>
                  {ids[0] && courses.some(c => c.id === ids[0]) && <button type="button" className="dhc-sbtn" onClick={() => openCourse(ids[0], "test")}>開く</button>}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {attach && (
        <ConfirmDialog title={`「${attach.t.title}」をコースに付ける`} canRun={attach.ids.length > 0}
          rows={[["付けるコース", attach.ids.map(id => courses.find(c => c.id === id)?.name).join("、") || "—"], ["テストの状態", attach.t.status === "published" ? "公開中（付けたコースの受講生にもすぐ見えます）" : "下書き（受講生には見えません）"]]}
          warn={attach.t.status === "published" ? "公開中のテストです。付けたコースの受講生にすぐ出ます。" : ""}
          onClose={() => { setAttach(null); load(); }}
          onRun={async () => { await apiPut(`/tests/${encodeURIComponent(attach.t.testId || attach.t.id)}`, { courseIds: [...new Set([...attach.cur, ...attach.ids])] }); return "付けました。"; }}>
          <div className="dhc-field">付けるコース<CourseChecks courses={courses} value={attach.ids} exclude={attach.cur} onChange={ids => setAttach(x => ({ ...x, ids }))} /></div>
        </ConfirmDialog>
      )}
    </>
  );
}

/* ---------- カリキュラム ---------- */
function CurriculumTab({ courses, openCourse }) {
  const [rows, setRows] = useState({});
  const [copy, setCopy] = useState(null);   // { from, to, start }
  const load = useCallback(() => {
    courses.forEach(c => {
      setRows(r => ({ ...r, [c.id]: { loading: true } }));
      apiGet(`/courses/${encodeURIComponent(c.id)}/curriculum`)
        .then(cur => setRows(r => ({ ...r, [c.id]: { cur } })))
        .catch(() => setRows(r => ({ ...r, [c.id]: { error: true } })));
    });
  }, [courses]);
  useEffect(() => { load(); }, [load]);
  const toCourse = copy && courses.find(c => c.id === copy.to);
  const plan = copy && copy.to && copy.start && rows[copy.from]?.cur ? relayoutCurriculum(rows[copy.from].cur, copy.start) : null;
  const targetCount = copy?.to ? curriculumCount(rows[copy.to]?.cur) : null;
  return (
    <>
      <div className="dhc-card dhc-list">
        {!courses.length && <div className="dhc-empty">コースがありません。</div>}
        {courses.map(c => {
          const r = rows[c.id] || { loading: true };
          const cnt = r.cur ? curriculumCount(r.cur) : null;
          const dates = r.cur ? curriculumDates(r.cur) : [];
          return (
            <div key={c.id} className="dhc-row">
              <span className="nm"><b>{c.name}</b><small>{c.company || "　"}</small></span>
              <span className="uses">
                {r.loading ? <span className="dhc-note">読み込んでいます…</span> : r.error ? <span className="dhc-note">読み込めませんでした</span>
                  : cnt.units ? (<><span className="dhc-pill blue">{cnt.sections ? `${cnt.sections} 章 ・ ` : ""}{cnt.units} 単元</span>{dates.length > 0 && <span className="dhc-note">{dates[0]} 〜 {dates[dates.length - 1]}</span>}</>)
                    : <span className="dhc-note">まだありません</span>}
              </span>
              <span className="act">
                {cnt?.units > 0 && <button type="button" className="dhc-sbtn" onClick={() => setCopy({ from: c.id, to: "", start: "" })}>別のコースに写す</button>}
                <button type="button" className="dhc-sbtn" onClick={() => openCourse(c.id, "curriculum")}>開く</button>
              </span>
            </div>
          );
        })}
      </div>
      {copy && (
        <ConfirmDialog title={`「${courses.find(c => c.id === copy.from)?.name}」のカリキュラムを写す`} canRun={!!plan}
          rows={plan ? [["写す先", toCourse?.name || "—"], ["日付", `${plan.first} 〜 ${plan.last}（平日で並べ直し）`], ["写す先のいま", targetCount?.units ? `${targetCount.units} 単元（置きかわります）` : "空"]] : []}
          warn={targetCount?.units ? "写す先のいまのカリキュラムは置きかわります。祝日は見ていないので、写したあとで日付を確かめてください。" : "祝日は見ていないので、写したあとで日付を確かめてください。"}
          onClose={() => { setCopy(null); load(); }}
          onRun={async () => { await apiPut(`/courses/${encodeURIComponent(copy.to)}/curriculum`, { sections: plan.sections, sessions: plan.sessions }); return "写しました。写す先のカリキュラムで確かめてください。"; }}>
          <CourseSelect courses={courses} value={copy.to} exclude={[copy.from]} label="写す先のコース"
            onChange={to => setCopy(x => ({ ...x, to, start: x.start || courses.find(c => c.id === to)?.startDate || "" }))} />
          <label className="dhc-field">始まりの日<input type="date" value={copy.start} onChange={e => setCopy(x => ({ ...x, start: e.target.value }))} /></label>
        </ConfirmDialog>
      )}
    </>
  );
}

/* ---------- 練習問題 ---------- */
function PracticeTab({ courses, openCourse }) {
  const [rows, setRows] = useState({});
  const [copy, setCopy] = useState(null);   // { from, set, to }
  const load = useCallback(() => {
    courses.forEach(c => {
      apiGet(`/practice?courseId=${encodeURIComponent(c.id)}`)
        .then(r => setRows(x => ({ ...x, [c.id]: { items: r?.items || [] } })))
        .catch(() => setRows(x => ({ ...x, [c.id]: { error: true } })));
    });
  }, [courses]);
  useEffect(() => { load(); }, [load]);
  const all = courses.flatMap(c => (rows[c.id]?.items || []).map(s => ({ ...s, course: c })));
  const loading = courses.some(c => !rows[c.id]);
  return (
    <>
      <div className="dhc-card dhc-list">
        {loading && <Loading />}
        {!loading && !all.length && <div className="dhc-empty">練習問題はまだありません。コースの「練習問題」タブで Word から作れます。</div>}
        {all.map(s => (
          <div key={s.course.id + s.id} className="dhc-row">
            <span className="nm"><b>{s.title || "（名前なし）"}</b><small>{s.counts?.questions || 0} 問 ・ {s.status === "published" ? "公開中" : s.status === "draft" ? "下書き" : "作成中"}</small></span>
            <span className="uses"><Chips ids={[s.course.id]} courses={courses} /></span>
            <span className="act">
              {s.counts?.questions > 0 && <button type="button" className="dhc-sbtn" onClick={() => setCopy({ from: s.course.id, set: s, to: "" })}>別のコースに写す</button>}
              <button type="button" className="dhc-sbtn" onClick={() => openCourse(s.course.id, "practice")}>開く</button>
            </span>
          </div>
        ))}
      </div>
      {copy && (
        <ConfirmDialog title={`「${copy.set.title}」を写す`} canRun={!!copy.to}
          rows={[["写す先", courses.find(c => c.id === copy.to)?.name || "—"], ["写したあと", "下書き（受講生にはまだ見えません）"]]}
          warn="写したあと、写す先の練習問題で中身を確かめてから公開してください。"
          onClose={() => { setCopy(null); load(); }}
          onRun={async () => { await apiPost(`/practice/${encodeURIComponent(copy.set.id)}/copy?courseId=${encodeURIComponent(copy.from)}`, { toCourseId: copy.to }); return "下書きとして写しました。"; }}>
          <CourseSelect courses={courses} value={copy.to} exclude={[copy.from]} label="写す先のコース" onChange={to => setCopy(x => ({ ...x, to }))} />
        </ConfirmDialog>
      )}
    </>
  );
}

export default function ConsoleLibrary({ courses, role, sub, setSub, openCourse, focus }) {
  const cur = TABS.some(([k]) => k === sub) ? sub : "folders";
  return (
    <>
      <div className="dhc-secttl"><h2>教材</h2><small>作ったものをコースに付けて使い回す</small></div>
      <nav className="dhc-tabs" aria-label="教材">
        {TABS.map(([k, t]) => <button key={k} type="button" aria-current={cur === k} onClick={() => setSub(k)}>{t}</button>)}
      </nav>
      <div className="dhc-pane" key={cur} style={{ display: "grid", gap: 12 }}>
        {cur === "folders" && <FoldersTab courses={courses} role={role} focus={focus} />}
        {cur === "tests" && <TestsTab courses={courses} openCourse={openCourse} />}
        {cur === "curriculum" && <CurriculumTab courses={courses} openCourse={openCourse} />}
        {cur === "practice" && <PracticeTab courses={courses} openCourse={openCourse} />}
      </div>
    </>
  );
}
