import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPut } from "../../../api.js";
import { TEST_SCOPE_KEYS, TestBuilder, TestTaking, flattenCurriculumScopes, normalizeCurriculumSections, normalizeTest, testCourseIdList, testQuestionsOf, testScopeForCourse, testScopeIdOf, useNameMap } from "../../training/TrainingComponents.jsx";
import { emitNotificationRefresh, testIdOf, todayStr } from "../../training/useTraining.js";
import { takeTestBuildTarget } from "../../../utils/common/courseContext.js";
import { Btn, Card, Chip, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { TestFileModal, takeTestFiles } from "./TestFile.jsx";
import { arr, errText, md, useRoster, useStaffCourse } from "./common.js";

/* テスト（モック testS・libS・testResultS）：講師は担当コースの単元ごと、管理者は全部の一覧。
   結果は一覧と一人ずつ、採点は /tests/{id}/results/{traineeId}/review。作る・直す・試し受験は今の画面を中に出す（採点の決まりを変えないため） */

const PASS = 70;
const scoreOf = r => { const v = r?.officialScore ?? r?.teacherScore ?? r?.score; return v == null ? null : Number(v); };
const waiting = r => !r?.reviewedAt && (Number(r?.needsReview) > 0 || Object.values(r?.answers || {}).some(a => a?.needsReview));
const rangeOf = s => {
  const ds = [s, ...arr(s.chapters).flatMap(c => arr(c.lessons))].flatMap(x => [String(x.startDate || "").slice(0, 10), String(x.endDate || x.startDate || "").slice(0, 10)]).filter(d => /^\d{4}-/.test(d)).sort();
  return ds.length ? { start: ds[0], end: ds[ds.length - 1] } : null;
};
const statusTone = s => (s === "published" ? "ok" : s === "draft" ? "warn" : "");
const statusLabel = s => (s === "published" ? "公開中" : s === "draft" ? "下書き" : s === "archived" ? "保管" : "未設定");

function AssignModal({ test, courses, canAssign, onClose, onSaved }) {
  const [ids, setIds] = useState(testCourseIdList(test));
  const [scopes, setScopes] = useState(() => Object.fromEntries(testCourseIdList(test).map(id => [id, testScopeIdOf(testScopeForCourse(test, id))])));
  const [opts, setOpts] = useState({});   // courseId → 単元の候補（null は読めなかった）
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const load = id => {
    if (opts[id] !== undefined) return;
    setOpts(m => ({ ...m, [id]: "loading" }));
    apiGet(`/courses/${encodeURIComponent(id)}/curriculum`).then(d => setOpts(m => ({ ...m, [id]: flattenCurriculumScopes(normalizeCurriculumSections(d)) }))).catch(() => setOpts(m => ({ ...m, [id]: null })));
  };
  useEffect(() => { ids.filter(canAssign).forEach(load); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setBusy(true); setErr("");
    const courseScopes = {};
    ids.filter(canAssign).forEach(id => {
      const o = Array.isArray(opts[id]) ? opts[id].find(x => x.id === scopes[id]) : null;
      courseScopes[id] = o ? Object.fromEntries(TEST_SCOPE_KEYS.map(k => [k, o[k] || ""])) : null;
    });
    try { await apiPut(`/tests/${testIdOf(test)}`, { courseIds: ids, courseScopes }); emitNotificationRefresh(); onSaved(); } catch (e) { setErr(errText(e, "保存できませんでした")); setBusy(false); }
  };
  const list = [...courses.filter(c => canAssign(c.courseId)), ...courses.filter(c => !canAssign(c.courseId) && ids.includes(c.courseId))];
  return (
    <Modal title={`コースと単元 ・ ${test.title}`} width={560} onClose={onClose} footer={<><Chip>{ids.length ? `${ids.length} コース` : "どこにも出さない"}</Chip><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy} onClick={save}>保存</Btn></>}>
      <div className="fs-pick">
        {list.map(c => {
          const id = c.courseId, on = ids.includes(id), edit = canAssign(id), o = opts[id];
          return (
            <div key={id} className="fs-pr tx-as">
              <label className="st-ck"><input type="checkbox" disabled={!edit} checked={on} onChange={e => { setIds(p => (e.target.checked ? [...p, id] : p.filter(x => x !== id))); if (e.target.checked) load(id); }} />{c.name || id}{!edit && <Chip> 担当外</Chip>}</label>
              {on && edit && (o === null ? <Chip tone="warn">単元を確認できません ・ コース全体に出す</Chip> : Array.isArray(o) ? <select className="in" aria-label={`${c.name || id} の単元`} value={scopes[id] || ""} onChange={e => setScopes(m => ({ ...m, [id]: e.target.value }))}><option value="">コース全体</option>{o.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select> : <small className="dv-mt">読み込み中</small>)}
            </div>
          );
        })}
        {!list.length && <Chip>なし</Chip>}
      </div>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

function Results({ test, courses, fixedCourse, canGrade, onBack, say }) {
  const nameMap = useNameMap();
  const [courseId, setCourseId] = useState(fixedCourse || testCourseIdList(test)[0] || "");
  const { list: roster } = useRoster(courseId);
  const [rows, setRows] = useState(undefined);
  const [key, setKey] = useState(0);
  const [mode, setMode] = useState("list"); const [cur, setCur] = useState("");
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("desc");
  const [draft, setDraft] = useState({ score: "", comment: "" }); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    setRows(undefined);
    apiGet(`/tests/${testIdOf(test)}/results`).then(l => { if (alive) setRows(arr(l)); }).catch(() => { if (alive) setRows(null); });
    return () => { alive = false; };
  }, [test, key]);
  const qs = useMemo(() => testQuestionsOf(test), [test]);
  const people = useMemo(() => {
    if (rows == null) return [];
    const byId = new Map(rows.map(r => [r.traineeId, r]));
    const base = arr(roster).length ? arr(roster) : rows.map(r => ({ id: r.traineeId, name: nameMap[r.traineeId] || r.traineeName || r.name || "名前未設定", kana: "" }));
    return base.map(p => ({ ...p, r: byId.get(p.id) || null, score: scoreOf(byId.get(p.id)) }));
  }, [rows, roster, nameMap]);
  const took = people.filter(p => p.r);
  const scored = took.filter(p => p.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, p) => a + p.score, 0) / scored.length) : null;
  const list = people.filter(p => matchName(p.name, p.kana, q) && (tab === "all" || (tab === "ng" ? p.r && p.score != null && p.score < PASS : tab === "none" ? !p.r : p.r && waiting(p.r))))
    .sort((a, b) => (a.r ? 0 : 1) - (b.r ? 0 : 1) || { desc: (b.score ?? -1) - (a.score ?? -1), asc: (a.score ?? 999) - (b.score ?? 999), name: String(a.kana || a.name).localeCompare(String(b.kana || b.name), "ja") }[sort]);
  const rates = qs.map((_, i) => { const has = took.filter(p => p.r.answers?.[i]); return has.length ? Math.round(has.filter(p => p.r.answers[i].correct).length / has.length * 100) : null; });
  const seq = list.filter(p => p.r);
  const one = people.find(p => p.id === cur) || seq[0] || null;
  const idx = one ? seq.findIndex(p => p.id === one.id) : -1;
  useEffect(() => { if (one) { setDraft({ score: one.r?.teacherScore ?? one.score ?? "", comment: one.r?.teacherComment || "" }); setErr(""); } }, [one?.id, rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = id => { setCur(id); setMode("one"); window.scrollTo?.(0, 0); };
  const saveReview = async () => {
    setBusy(true); setErr("");
    try { await apiPut(`/tests/${testIdOf(test)}/results/${encodeURIComponent(one.id)}/review`, { teacherScore: Number(draft.score), teacherComment: draft.comment }); say?.("採点を保存しました"); setKey(k => k + 1); }
    catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(false); }
  };
  const ids = testCourseIdList(test);
  const courseSel = !fixedCourse && ids.length > 1 && <label className="fsort">コース<select className="in" value={courseId} onChange={e => setCourseId(e.target.value)}>{ids.map(id => <option key={id} value={id}>{courses.find(c => c.courseId === id)?.name || id}</option>)}</select></label>;
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">結果</div><h1 className="h1">{test.title}</h1></div><span className="r"><Btn kind="ghost sm" onClick={onBack}>← テストの一覧</Btn></span></div>
      {rows === null ? <Card><div className="empty"><b>結果を確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card> : rows === undefined ? <div className="soon card">読み込み中</div> : (
        <>
          <div className="row">
            <span className="seg"><button type="button" aria-pressed={mode === "list"} onClick={() => setMode("list")}>一覧で見る</button><button type="button" aria-pressed={mode === "one"} onClick={() => setMode("one")}>一人ずつ見る</button></span>
            {courseSel}
            <Chip>受けた {took.length}{arr(roster).length ? ` / ${roster.length}` : ""} 人</Chip><Chip tone="mk">平均 {avg ?? "—"} 点</Chip><Chip tone="ok">合格 {scored.filter(p => p.score >= PASS).length}</Chip>{took.some(p => waiting(p.r)) && <Chip tone="warn">採点待ち {took.filter(p => waiting(p.r)).length}</Chip>}
          </div>
          {mode === "list" ? (
            <>
              <ListTool tabs={[["all", "すべて", people.length], ["ng", "不合格", took.filter(p => p.score != null && p.score < PASS).length, "bad"], ["wait", "採点待ち", took.filter(p => waiting(p.r)).length, "warn"], ["none", "まだ", people.length - took.length]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["desc", "点の高い順"], ["asc", "点の低い順"], ["name", "名前順"]]} sort={sort} onSort={setSort} />
              <Card className="tr-t"><div className="scroll"><table className="tbl"><thead><tr><th>受講生</th><th>点</th><th>合否</th>{qs.map((_, i) => <th key={i} className="qc">{i + 1}</th>)}<th /></tr></thead><tbody>
                {list.map(p => (
                  <tr key={p.id} className={p.r ? "" : "tr-none"}>
                    <td><b>{p.name}</b></td>
                    <td className="num">{p.r ? <b className={`tr-pt${p.score != null && p.score < PASS ? " ng" : ""}`}>{p.score ?? "—"}</b> : "—"}</td>
                    <td>{!p.r ? <Chip>まだ</Chip> : waiting(p.r) ? <Chip tone="warn">採点待ち</Chip> : p.score >= PASS ? <Chip tone="ok">合格</Chip> : <Chip tone="bad">不合格</Chip>}</td>
                    {qs.map((_, i) => { const a = p.r?.answers?.[i]; return <td key={i} className={`qc${a ? (a.needsReview ? "" : a.correct ? " o" : " x") : ""}`}>{a ? (a.needsReview ? "?" : a.correct ? "○" : "×") : ""}</td>; })}
                    <td>{p.r && <Btn kind="ghost sm" onClick={() => open(p.id)}>{canGrade && waiting(p.r) ? "採点" : "見る"}</Btn>}</td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={qs.length + 4}><Chip>該当なし</Chip></td></tr>}
                {qs.length > 0 && took.length > 0 && <tr className="tr-rate"><td><b>正答率</b></td><td /><td />{rates.map((x, i) => <td key={i} className={`qc num${x != null && x < 60 ? " low" : ""}`}>{x ?? ""}</td>)}<td /></tr>}
              </tbody></table></div></Card>
            </>
          ) : !one ? <Card className="pad"><Chip>まだ受けた人はいません</Chip></Card> : (
            <>
              <div className="tr-nav">
                <Btn kind="ghost sm" disabled={idx <= 0} onClick={() => setCur(seq[idx - 1].id)}>‹ 前の人</Btn>
                <select className="in" aria-label="受講生を選ぶ" value={one.id} onChange={e => setCur(e.target.value)}>{seq.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <Btn kind="ghost sm" disabled={idx < 0 || idx >= seq.length - 1} onClick={() => setCur(seq[idx + 1].id)}>次の人 ›</Btn>
              </div>
              <Card className="pad st-g">
                <div className="tr-who"><span className="face">{one.name.slice(0, 1)}</span><span><b>{one.name}</b><small className="num">{md(one.r.takenAt || one.r.updatedAt)}{one.r.reviewedAt ? ` ・ 採点 ${md(one.r.reviewedAt)}` : ""}</small></span><span className={`tr-sc${one.score != null && one.score < PASS ? " ng" : ""}`}><b className="num">{one.score ?? "—"}</b><small>点</small></span></div>
                {canGrade && (
                  <div className="tx-rv">
                    <label className="field">講師の点<input type="number" min="0" max="100" value={draft.score} onChange={e => setDraft(d => ({ ...d, score: e.target.value }))} /></label>
                    <label className="field">コメント<input type="text" value={draft.comment} onChange={e => setDraft(d => ({ ...d, comment: e.target.value }))} /></label>
                    <Btn kind="sm" disabled={busy || draft.score === ""} onClick={saveReview}>{waiting(one.r) ? "採点を確定" : "保存"}</Btn>
                  </div>
                )}
                {err && <div className="lms-err" role="alert">{err}</div>}
              </Card>
              <div className="rlist tx-rl">
                {qs.map((x, i) => {
                  const a = one.r.answers?.[i], ans = a?.answer, shown = x.type === "choice" && Number.isInteger(ans) ? x.a[ans] : ans;
                  return (
                    <Card key={i} className={`pad st-g tx-q${a?.needsReview ? "" : a?.correct ? " ok" : " ng"}`}>
                      <div className="head"><b>{i + 1}. {x.q}</b><span className="r">{!a ? <Chip>未回答</Chip> : a.needsReview ? <Chip tone="warn">採点待ち</Chip> : a.correct ? <Chip tone="ok">正解</Chip> : <Chip tone="bad">まちがい</Chip>}{a?.score != null && a?.points != null && <Chip>{a.score} / {a.points}</Chip>}</span></div>
                      {shown != null && shown !== "" && <div className="tx-a"><span className="eyebrow">答え</span><pre>{String(shown)}</pre></div>}
                      {x.answer && <div className="tx-a"><span className="eyebrow">正解</span><pre>{x.answer}</pre></div>}
                      {a?.aiEvaluation && <div className="row"><Chip tone="mk">AI {a.aiEvaluation.score == null ? "採点待ち" : `${a.aiEvaluation.score} 点`}</Chip>{a.aiEvaluation.comment && <small>{a.aiEvaluation.comment}</small>}</div>}
                    </Card>
                  );
                })}
                {!qs.length && <Chip>問題なし</Chip>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// 共通から足す：ほかのコースのテストをこのコースの単元につなぐ（コピーしない）
function CategoryModal({ test, cats, onClose, onDone }) {
  const [v, setV] = useState(test.category || "");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true); setErr("");
    try { await apiPut(`/tests/${testIdOf(test)}`, { category: v.trim() }); onDone(); }
    catch (e) { setErr(errText(e, "保存できませんでした")); setBusy(false); }
  };
  return (
    <Modal title={`分類 ・ ${test.title}`} width={420} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy} onClick={save}>保存</Btn></>}>
      <label className="field">分類<input type="text" list="tx-cats" maxLength={40} value={v} placeholder="Java" onChange={e => setV(e.target.value)} /><datalist id="tx-cats">{cats.map(c => <option key={c} value={c} />)}</datalist></label>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

function AddFromOthers({ tests, courseId, sections, onClose, onDone }) {
  const [id, setId] = useState(testIdOf(tests[0] || {}) || "");
  const opts = useMemo(() => flattenCurriculumScopes(sections), [sections]);
  const [scope, setScope] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const list = tests.filter(t => !q.trim() || String(t.title).includes(q.trim()) || String(t.category || "").includes(q.trim()));
  const save = async () => {
    const t = tests.find(x => testIdOf(x) === id);
    if (!t) { setErr("テストを選んでください"); return; }
    setBusy(true); setErr("");
    const o = opts.find(x => x.id === scope);
    try { await apiPut(`/tests/${testIdOf(t)}`, { courseIds: [...new Set([...testCourseIdList(t), courseId])], courseScopes: { [courseId]: o ? Object.fromEntries(TEST_SCOPE_KEYS.map(k => [k, o[k] || ""])) : null } }); emitNotificationRefresh(); onDone(t); }
    catch (e) { setErr(errText(e, "足せませんでした")); setBusy(false); }
  };
  return (
    <Modal title="共通から足す" width={520} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy || !id} onClick={save}>このコースに足す</Btn></>}>
      <span className="fsearch pc-q"><input type="search" value={q} placeholder="テストを探す" aria-label="テストを探す" onChange={e => setQ(e.target.value)} /></span>
      <div className="fs-pick">{list.map(t => <label key={testIdOf(t)} className="st-ck fs-pr"><input type="radio" name="tx-pick" checked={id === testIdOf(t)} onChange={() => setId(testIdOf(t))} />{t.title}</label>)}{!list.length && <Chip>なし</Chip>}</div>
      <label className="field">つなぐ単元<select className="in" value={scope} onChange={e => setScope(e.target.value)}><option value="">コース全体</option>{opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

export default function StaffTests({ role, go, say }) {
  const admin = role === "admin";
  const today = todayStr();
  const sc = useStaffCourse();
  const courseId = admin ? "" : sc.course?.courseId || "";
  const { list: roster } = useRoster(courseId);
  const [handoff] = useState(() => takeTestBuildTarget(true));
  const [st, setSt] = useState({ state: "loading", tests: [], loose: [], sections: [], courses: [] });
  const [res, setRes] = useState({});   // testId → 結果（null は読めなかった）
  const [key, setKey] = useState(0);
  const [menu, setMenu] = useState("");
  const [build, setBuild] = useState(null);     // { mode, test?, duplicate?, scope? }
  const [taking, setTaking] = useState(null);
  const [results, setResults] = useState(null);
  const [assign, setAssign] = useState(null);
  const [del, setDel] = useState(null);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [fromCur, setFromCur] = useState(!!handoff);
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("new");
  const [catOf, setCatOf] = useState(null); const [catF, setCatF] = useState("");
  const [fileNew, setFileNew] = useState(null); const [dropOn, setDropOn] = useState(false);

  const reload = useCallback(() => setKey(k => k + 1), []);
  useEffect(() => {
    if (!admin && sc.state !== "ready") return undefined;
    if (!admin && !courseId) { setSt(s => ({ ...s, state: "ready" })); return undefined; }
    let alive = true;
    (async () => {
      const [ts, all, cur, cs] = await Promise.all([
        apiGet(admin ? "/tests" : `/tests?courseId=${encodeURIComponent(courseId)}`),
        admin ? Promise.resolve(null) : apiGet("/tests").catch(() => []),
        admin ? Promise.resolve(null) : apiGet(`/courses/${encodeURIComponent(courseId)}/curriculum`).catch(() => null),
        apiGet("/courses").catch(() => []),
      ]);
      if (!alive) return;
      const tests = arr(ts).filter(t => t.status !== "archived").map(normalizeTest);
      const loose = arr(all).filter(t => t.status !== "archived" && !testCourseIdList(t).length).map(normalizeTest);
      const others = arr(all).filter(t => t.status !== "archived" && !tests.some(x => testIdOf(x) === testIdOf(t)) && (t.common || !testCourseIdList(t).length)).map(normalizeTest);
      setSt({ state: "ready", tests, loose, others, sections: cur ? normalizeCurriculumSections(cur) : [], courses: arr(cs).filter(c => c?.courseId) });
      const every = [...tests, ...loose];
      const pairs = await Promise.all(every.map(t => apiGet(`/tests/${testIdOf(t)}/results`).then(r => [testIdOf(t), arr(r)]).catch(() => [testIdOf(t), null])));
      if (alive) setRes(Object.fromEntries(pairs));
    })().catch(() => { if (alive) setSt(s => ({ ...s, state: "error" })); });
    return () => { alive = false; };
  }, [admin, sc.state, courseId, key]);

  // カリキュラムの単元から来たとき：作る・直す・結果を開く。閉じたらカリキュラムへ戻る
  useEffect(() => {
    if (!handoff || st.state !== "ready" || handoff.done) return;
    handoff.done = true;
    if (handoff.testId) {
      const t = st.tests.find(x => testIdOf(x) === handoff.testId);
      if (!t) { setFromCur(false); return; }
      if (handoff.results) setResults(t); else setBuild({ mode: "manual", test: t });
      return;
    }
    setBuild({ mode: handoff.mode, scope: { courseId: handoff.courseId, scopeId: handoff.scopeId, title: handoff.title } });
  }, [handoff, st]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!menu) return undefined;
    const close = e => { if (!e.target.closest?.(".kmenu, .kbtn")) setMenu(""); };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [menu]);

  const closeSub = () => { setBuild(null); setTaking(null); setResults(null); if (fromCur) { setFromCur(false); go?.(admin ? "lcur" : "cur"); return; } reload(); };
  const mine = useMemo(() => new Set(arr(sc.courses).map(c => c.courseId)), [sc.courses]);
  const canAssign = id => admin || mine.has(id);
  const statOf = t => {
    const rows = res[testIdOf(t)];
    if (rows === undefined) return { state: "loading" };
    if (rows === null) return { state: "error" };
    const ids = !admin && arr(roster).length ? new Set(roster.map(p => p.id)) : null;
    const use = rows.filter(r => !ids || ids.has(r.traineeId)), sc0 = use.map(scoreOf).filter(v => v != null);
    return { state: "ready", n: use.length, avg: sc0.length ? Math.round(sc0.reduce((a, v) => a + v, 0) / sc0.length) : null, wait: use.filter(waiting).length };
  };
  const courseNames = t => testCourseIdList(t).map(id => st.courses.find(c => c.courseId === id)?.name || id);
  const setStatus = async t => { setErr(""); setMenu(""); try { await apiPut(`/tests/${testIdOf(t)}`, { status: t.status === "published" ? "draft" : "published" }); emitNotificationRefresh(); say?.(t.status === "published" ? "下書きに戻しました" : "公開しました"); reload(); } catch (e) { setErr(errText(e, "状態を変えられませんでした")); } };
  const remove = async () => { const t = del; setDel(null); setErr(""); try { await apiDelete(`/tests/${testIdOf(t)}`); emitNotificationRefresh(); say?.("消しました"); reload(); } catch (e) { setErr(errText(e, "消せませんでした")); } };

  if (build) return <div className="lms-legacy"><TestBuilder mode={build.mode} initialScope={build.scope || null} initialTest={build.test || null} duplicate={!!build.duplicate} back={closeSub} onSaved={reload} /></div>;
  if (taking) return <div className="lms-legacy"><TestTaking key={testIdOf(taking)} test={taking} preview back={() => { setTaking(null); }} onDone={async () => true} go={() => setTaking(null)} /></div>;
  if (results) return <Results test={results} courses={st.courses} fixedCourse={courseId} canGrade={admin || mine.size > 0} onBack={closeSub} say={say} />;
  if (!admin && sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  if (st.state === "loading" || (!admin && sc.state === "loading")) return <div className="soon card">読み込み中</div>;
  if (st.state === "error") return <Card><div className="empty"><b>テストを確認できません</b><Btn kind="ghost sm" onClick={() => { setSt(s => ({ ...s, state: "loading" })); reload(); }}>再読み込み</Btn></div></Card>;

  const N = arr(roster).length;
  const statusCell = t => <Chip tone={statusTone(t.status)}>{statusLabel(t.status)}</Chip>;
  const tookCell = s => (s.state === "loading" ? "…" : s.state === "error" ? <Chip tone="bad">確認できません</Chip> : <>{s.n}{N ? ` / ${N}` : ""}{s.wait > 0 && <> <Chip tone="warn">採点待ち {s.wait}</Chip></>}</>);
  const avgCell = s => (s.state === "ready" && s.avg != null ? <b className={s.avg < PASS ? "tr-pt ng" : ""}>{s.avg}</b> : "—");
  const dueOf = t => (t.dueDate ? <Chip tone={t.dueDate < today ? "" : "blue"}>{md(t.dueDate)}</Chip> : "—");
  const kebab = t => (
    <td className="fs-k">
      <button type="button" className="kbtn" aria-label={`${t.title} の操作`} aria-expanded={menu === testIdOf(t)} onClick={() => setMenu(m => (m === testIdOf(t) ? "" : testIdOf(t)))}>…</button>
      {menu === testIdOf(t) && (
        <div className="kmenu" role="menu">
          <button type="button" onClick={() => { setMenu(""); setBuild({ mode: "manual", test: t }); }}>直す</button>
          <button type="button" onClick={() => { setMenu(""); setBuild({ mode: "manual", test: t, duplicate: true }); }}>複製</button>
          <button type="button" onClick={() => { setMenu(""); setAssign(t); }}>コースと単元</button>
          {admin && <button type="button" onClick={() => { setMenu(""); setCatOf(t); }}>分類</button>}
          <button type="button" onClick={() => { setMenu(""); setTaking(t); }}>試しに受ける</button>
          <button type="button" onClick={() => setStatus(t)}>{t.status === "published" ? "下書きに戻す" : "公開する"}</button>
          <hr />
          <button type="button" className="del" onClick={() => { setMenu(""); setDel(t); }}>消す</button>
        </div>
      )}
    </td>
  );
  const toCommon = async t => { setErr(""); try { await apiPut(`/tests/${testIdOf(t)}`, { common: true }); say?.("全コース共通にしました"); reload(); } catch (e) { setErr(errText(e, "共通にできませんでした")); } };
  const row = t => {
    const s = statOf(t);
    if (!admin) return (
      <tr key={testIdOf(t)}>
        <td><b>{t.title}</b>{t.common && <> <Chip tone="mk">共通</Chip></>}<small className="sm2">{testQuestionsOf(t).length}問</small></td>
        <td className="num tat">{t.dueDate ? md(t.dueDate) : "—"}{t.limitMinutes ? <small className="sm2">目安 {t.limitMinutes}分</small> : null}</td>
        <td>{statusCell(t)}</td><td className="num">{tookCell(s)}</td><td className="num">{avgCell(s)}</td>
        <td><span className="row st-nw"><Btn kind="ghost sm" onClick={() => setResults(t)}>結果</Btn><Btn kind="ghost sm" onClick={() => setBuild({ mode: "manual", test: t })}>直す</Btn>{!t.common && <Btn kind="ghost sm" onClick={() => toCommon(t)}>全コース共通にする</Btn>}</span></td>
      </tr>
    );
    return (
      <tr key={testIdOf(t)} className={menu === testIdOf(t) ? "on" : ""}>
        <td><button type="button" className="fs-name" onClick={() => setResults(t)}><span><b>{t.title}</b><small className="fs-meta num">{t.category ? `${t.category} ・ ` : ""}{statusLabel(t.status)} ・ 受けた {s.state === "ready" ? s.n : "—"}{N ? ` / ${N}` : ""} ・ 平均 {s.avg ?? "—"}</small></span></button></td>
        {admin ? <td className="tx-cs">{courseNames(t).length ? courseNames(t).map(n => <Chip key={n}>{n}</Chip>) : <Chip tone="warn">どこにも出していない</Chip>}</td> : <td>{dueOf(t)}</td>}
        <td>{statusCell(t)}</td><td className="num">{tookCell(s)}</td><td className="num">{avgCell(s)}</td>
        <td><Btn kind="ghost sm" onClick={() => setResults(t)}>結果</Btn></td>
        {kebab(t)}
      </tr>
    );
  };
  const cats = [...new Set(st.tests.map(t => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
  const table = ts => <div className="scroll"><table className="tbl fs-t tx-t"><thead><tr><th>テスト</th><th>{admin ? "使用中のコース" : "実施"}</th><th>状態</th><th>受けた</th><th>平均</th><th />{admin && <th aria-label="操作" />}</tr></thead><tbody>{ts.map(row)}</tbody></table></div>;
  const modals = (
    <>
      {catOf && <CategoryModal test={catOf} cats={cats} onClose={() => setCatOf(null)} onDone={() => { setCatOf(null); say?.("保存しました"); reload(); }} />}
      {assign && <AssignModal test={assign} courses={st.courses} canAssign={canAssign} onClose={() => setAssign(null)} onSaved={() => { setAssign(null); say?.("保存しました"); reload(); }} />}
      {del && <Modal title="テストを消す" width={420} onClose={() => setDel(null)} footer={<><Btn kind="ghost" onClick={() => setDel(null)}>やめる</Btn><Btn onClick={remove}>消す</Btn></>}><b>{del.title}</b>{statOf(del).n > 0 && <div className="row"><Chip tone="warn">受けた人 {statOf(del).n} 人</Chip></div>}</Modal>}
    </>
  );

  if (admin) {
    const hit = st.tests.filter(t => (!q.trim() || String(t.title).includes(q.trim())) && (tab === "all" || (tab === "none" ? !testCourseIdList(t).length : t.status === tab)) && (!catF || (catF === "-" ? !t.category : t.category === catF)));
    const list = [...hit].sort({ new: (a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")), name: (a, b) => String(a.title).localeCompare(String(b.title), "ja"), used: (a, b) => testCourseIdList(b).length - testCourseIdList(a).length }[sort]);
    return (
      <div className="st">
        <div className="head"><div><div className="eyebrow">全コース共通</div><h1 className="h1">テスト</h1></div><span className="r"><Btn kind="ghost sm" onClick={() => setBuild({ mode: "ai" })}>AI で作る</Btn><Btn kind="sm" onClick={() => setBuild({ mode: "manual" })}>テストを作る</Btn></span></div>
        {err && <div className="lms-err" role="alert">{err}</div>}
        <ListTool tabs={[["all", "すべて", st.tests.length], ["published", "公開", st.tests.filter(t => t.status === "published").length, "ok"], ["draft", "下書き", st.tests.filter(t => t.status === "draft").length, "warn"], ["none", "コース未設定", st.tests.filter(t => !testCourseIdList(t).length).length]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="テストを探す" sorts={[["new", "新しい順"], ["name", "名前順"], ["used", "使っているコースの多い順"]]} sort={sort} onSort={setSort} />
        {cats.length > 0 && <span className="row"><select className="in tx-cat" aria-label="分類" value={catF} onChange={e => setCatF(e.target.value)}><option value="">すべての分類</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}<option value="-">分類なし</option></select></span>}
        <section className="card tx-card">{list.length ? table(list) : <div className="pad"><Chip>なし</Chip></div>}</section>
        {modals}
      </div>
    );
  }

  if (!courseId) return <Card><div className="empty"><b>担当のコース</b><Chip>なし</Chip></div></Card>;
  const inSec = new Set(st.sections.map(s => s.id));
  const whole = st.tests.filter(t => !inSec.has(t.sectionId));
  const curIdx = st.sections.findIndex(s => { const r = rangeOf(s); return r && r.start <= today && today <= r.end; });
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{sc.course?.name}</div><h1 className="h1">テスト</h1></div><span className="r"><Btn kind="ghost sm" onClick={() => setAdding(true)}>共通から足す</Btn><Btn kind="sm" onClick={() => setFileNew({})}>テストを作る</Btn></span></div>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {roster === null && <div className="lms-err" role="alert">受講生を確認できません</div>}
      <div className={`fdrop${dropOn ? " dropon" : ""}`} onDragOver={e => { e.preventDefault(); setDropOn(true); }} onDragLeave={() => setDropOn(false)} onDrop={e => { e.preventDefault(); setDropOn(false); if (e.dataTransfer.files.length) setFileNew(takeTestFiles(e.dataTransfer.files)); }}>
        <span className="fd-t"><b>問題と解答のファイルをここに落とす</b><small>Word・Excel ・ このコースだけに足す</small></span>
        <label className="btn ghost sm">ファイルを選ぶ<input type="file" accept=".docx,.xlsx,.xls,.csv" multiple className="lms-sr" onChange={e => { const fs = e.target.files; if (fs?.length) setFileNew(takeTestFiles(fs)); e.target.value = ""; }} /></label>
      </div>
      {curIdx >= 0 && (
        <div className="tp-now c-tst tu-now">
          <span className="tp-nl"><span className="eyebrow">今の単元</span><b>単元 {curIdx + 1} ・ {st.sections[curIdx].title}</b><small className="num">{(r => (r ? `${md(r.start)}〜${md(r.end)} ・ ` : ""))(rangeOf(st.sections[curIdx]))}テスト {st.tests.filter(t => t.sectionId === st.sections[curIdx].id).length}</small></span>
          <span style={{ marginLeft: "auto" }} />
          <Btn kind="ghost sm" onClick={() => document.getElementById(`tu-test-${st.sections[curIdx].id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>一覧で見る ↓</Btn>
        </div>
      )}
      <div className="tunits">
        {st.sections.map((s, i) => {
          const ts = st.tests.filter(t => t.sectionId === s.id), r = rangeOf(s);
          return (
            <section key={s.id} id={`tu-test-${s.id}`} className={`card tx-card${i === curIdx ? " tu-cur" : ""}`}>
              <div className="head pad tx-h"><div className="tu-h"><span className="tu-no num" aria-hidden="true">{i + 1}</span><div><span className="eyebrow num">単元 {i + 1} ・ {r ? `${md(r.start)}〜${md(r.end)}` : "日程未設定"}</span><h2 className="h3">{s.title}</h2></div></div><span className="r"><Btn kind="ghost sm" onClick={() => setFileNew({ sectionId: s.id })}>この単元で作る</Btn></span></div>
              {ts.length ? table(ts) : <div className="tx-e"><Chip>なし</Chip></div>}
            </section>
          );
        })}
        {whole.length > 0 && <section className="card tx-card"><div className="head pad tx-h"><h2 className="h3">コース全体</h2></div>{table(whole)}</section>}
        {!st.sections.length && !whole.length && <Card className="pad"><Chip>なし</Chip></Card>}
      </div>
      {fileNew && <TestFileModal courseId={courseId} sections={st.sections} initial={fileNew} onClose={() => setFileNew(null)} onSaved={(t, s) => { setFileNew(null); emitNotificationRefresh(); say?.(s === "published" ? `「${t.title}」を公開しました` : `「${t.title}」を下書きで保存しました`); reload(); }} />}
      {adding && <AddFromOthers tests={arr(st.others)} courseId={courseId} sections={st.sections} onClose={() => setAdding(false)} onDone={t => { setAdding(false); say?.(`${t.title} を足しました`); reload(); }} />}
      {modals}
    </div>
  );
}
