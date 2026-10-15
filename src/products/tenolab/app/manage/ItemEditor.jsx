import { AwsStepsField, ProjectFields } from "./ProjectFields.jsx";
import React, { useEffect, useRef, useState } from "react";
import { company, manage } from "../data.js";
import { THUMB_KINDS, Thumb } from "../ui.jsx";
import { TryPanel } from "../Workbench.jsx";
import GradeView from "../GradeView.jsx";
import { TRY_KEY } from "./parts.jsx";

/* 演習・案件体験の編集（下書き → 試す → 公開）。kind は "drills" | "cases" */
const RUNTIMES = {
  drills: [["js", "JavaScript"], ["jsweb", "HTML＋JavaScript（画面を動かす）"], ["web", "HTML / CSS"], ["java", "Java"], ["sql", "SQL"], ["check", "チェック（Gitなど）"], ["aws", "AWS（本物の環境）"]],
  cases: [["servlet", "Java Servlet（画面つき）"], ["js", "JavaScript"], ["jsweb", "HTML＋JavaScript（画面を動かす）"], ["web", "HTML / CSS"], ["java", "Java"], ["sql", "SQL"], ["aws", "AWS（本物の環境）"]],
};
const SCENARIOS = [["vpc", "VPCだけを作る（まっさら）"], ["vpcec2", "VPCとEC2でWebサーバー（まっさら）"], ["elb", "ELBを足す（用意済み）"], ["asg", "Auto Scaling（用意済み）"], ["cw", "CloudWatchで異常に気づく（用意済み）"], ["recover", "止まったWebサーバーを復旧（障害あり）"]];
const LEVELS = ["やさしい", "ふつう", "むずかしい"], AWS_LEVELS = ["基礎", "応用", "運用"];
const TEST_HELP = {
  js: "式で確かめます。env に、書いたコードの関数や変数が入っています。例：env.total([120, 80, 300]) === 500",
  web: "式で確かめます。doc が表示した画面の document です。例：getComputedStyle(doc.querySelector('button')).textAlign === 'center'",
  java: "標準出力が「出てほしい出力」と同じならOK（前後の空白は無視）。",
  sql: "受講生のSQLの結果が、答え合わせのSQLの結果と同じならOK。",
  check: "受講生が自分で確かめて付けるチェックです。",
  jsweb: "式で確かめます。ページの中で動きます（document・window・__logs＝console.log の出力・__alerts＝alert の文字 が使えます）。例：(document.querySelector('#calc').click(), document.querySelector('#total').textContent === '600円')",
  servlet: "フォームの値（name=value&… 同じ name は何回でも）で Servlet を動かし、画面に出た文字に「出てほしい文字」（1行に1つ）がすべて含まれればOK（空白は無視）。",
};
const blank = kind => kind === "drills"
  ? { title: "", topic: "", runtime: "js", level: "やさしい", minutes: 10, tags: [], lessons: [], task: "", hint: "", starterCode: "", answerCode: "", tests: [{ name: "", expr: "" }], premium: false, order: 0, thumb: null }
  : { title: "", topic: "", runtime: "js", summary: "", hours: 2, needCourseId: "", ticket: { id: "", kind: "feat", client: "", background: "", scope: [""], done: [], notes: "", comments: [] }, spec: { rules: [], fields: [] }, starterCode: "", answerCode: "", tests: [{ name: "", expr: "" }], rubric: [], skipAfter: 2, premium: false, order: 0, thumb: null };
const SKIP_AFTER = [[1, "やり直し1回から"], [2, "やり直し2回から"], [3, "やり直し3回から"], [0, "出さない"]];

/* 採点の基準（AI採点）。必須をすべて満たせば合格。見る点は講評だけに使う */
function RubricEditor({ item, set, id, hasCode }) {
  const rubric = item.rubric || [];
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  // AI採点の画面の「この提出で基準を試す」から来たときは、そのコードを入れておく
  const [code, setCode] = useState(() => {
    try {
      const v = JSON.parse(sessionStorage.getItem(TRY_KEY) || "null");
      if (v && v.caseId === id) { sessionStorage.removeItem(TRY_KEY); return String(v.code || ""); }
    } catch (e) { /* 読めなければ空のまま */ }
    return null;
  });
  const [result, setResult] = useState(null);
  const box = useRef(null);
  useEffect(() => { if (code != null) box.current?.scrollIntoView({ block: "center" }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setRow = (i, k, v) => set("rubric", rubric.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const caseId = /^[a-z0-9][a-z0-9-]{0,39}$/.test(id) ? id : "new";
  async function draft() {
    if (rubric.length && !window.confirm("いまの基準を、AIが作った基準に置き換えます。よろしいですか？")) return;
    setBusy("draft"); setMsg("");
    try { const r = await manage.rubricDraft(caseId, { case: item }); set("rubric", r.rubric || []); }
    catch (e) { setMsg(e?.errorMessage || "AIが基準を作れませんでした。"); }
    finally { setBusy(""); }
  }
  async function test() {
    setBusy("test"); setMsg(""); setResult(null);
    try { setResult(await manage.gradeTest(caseId, { case: item, code })); }
    catch (e) { setMsg(e?.errorMessage || "採点できませんでした。"); }
    finally { setBusy(""); }
  }
  return (
    <section className="card mcard">
      <div className="row" style={{ gap: 8 }}>
        <div className="eyebrow">採点の基準（AI採点）</div>
        <button type="button" className="btn ghost" style={{ marginLeft: "auto" }} onClick={draft} disabled={!!busy}>{busy === "draft" ? "作っています…" : "AIで基準を作る"}</button>
      </div>
      <div className="mgrid">
        <Field label="合格">
          <span style={{ fontSize: 14, fontWeight: 400 }}>受け入れ条件がすべて通る ＋ 必須の基準をすべて満たす</span>
        </Field>
        <Field label="「先に進む」を出す">
          <select value={item.skipAfter ?? 2} onChange={e => set("skipAfter", Number(e.target.value))}>{SKIP_AFTER.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
      </div>
      {rubric.map((r, i) => (
        <div key={i} className={`mrule ${r.must ? "must" : ""}`}>
          <div className="row" style={{ gap: 8 }}>
            <input value={r.text} onChange={e => setRow(i, "text", e.target.value)} placeholder="見ること（例：入力ごとに、どこを直せばいいか分かるメッセージを出す）" aria-label={`基準${i + 1}`} />
            <label className="row" style={{ gap: 4, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}><input type="checkbox" checked={!!r.must} onChange={e => setRow(i, "must", e.target.checked)} />必須</label>
            <button type="button" className="btn ghost" onClick={() => set("rubric", rubric.filter((_, j) => j !== i))} aria-label={`基準${i + 1}を消す`}>消す</button>
          </div>
          <div className="mrule-ex">
            <input value={r.ok || ""} onChange={e => setRow(i, "ok", e.target.value)} placeholder="OKの例" aria-label={`基準${i + 1}のOKの例`} />
            <input value={r.ng || ""} onChange={e => setRow(i, "ng", e.target.value)} placeholder="NGの例" aria-label={`基準${i + 1}のNGの例`} />
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost" style={{ justifySelf: "start" }} onClick={() => set("rubric", [...rubric, { text: "", must: false, ok: "", ng: "" }])} disabled={rubric.length >= 10}>基準を足す</button>

      {hasCode && (
        <div className="mtry" ref={box}>
          <div className="row" style={{ gap: 8 }}>
            <b style={{ fontSize: 14 }}>基準を試す</b>
            <button type="button" className="btn ghost" style={{ marginLeft: "auto" }} onClick={() => { setCode(item.answerCode || ""); setResult(null); }}>お手本で</button>
            <button type="button" className="btn ghost" onClick={() => { setCode(item.starterCode || ""); setResult(null); }}>はじめのコードで</button>
          </div>
          {code != null && <>
            <textarea className="mono" rows={8} value={code} onChange={e => setCode(e.target.value)} aria-label="試すコード" />
            <button type="button" className="btn" style={{ justifySelf: "start" }} onClick={test} disabled={!!busy || !code.trim()}>{busy === "test" ? "採点しています…" : "AIで採点してみる"}</button>
          </>}
          {result && <GradeView label={result.pass ? "合格" : "やり直し"} tone={result.pass ? "ok" : "ng"} results={result.results} review={result.review} />}
        </div>
      )}
      {msg && <div className="verdict ng" role="alert">{msg}</div>}
    </section>
  );
}

const PEOPLE = [["client", "お客さま"], ["pm", "PM"], ["lead", "リーダー"]];

/* 受講生への割り当て（期限は任意）。企業を選んで受講生を選ぶ（GET /tenolab/company の受講生一覧を使う） */
function AssignPanel({ id }) {
  const [companies, setCompanies] = useState(null);
  const [co, setCo] = useState("");
  const [learners, setLearners] = useState([]);
  const [picked, setPicked] = useState({});
  const [due, setDue] = useState("");
  const [current, setCurrent] = useState([]);
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);
  const load = () => manage.assignments(id).then(r => setCurrent(r.items || [])).catch(() => setCurrent(null));
  useEffect(() => { company.get("").then(r => setCompanies(r.companies || [])).catch(() => setCompanies([])); load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLearners([]); setPicked({}); if (co) company.get(co).then(r => setLearners(r.learners || [])).catch(() => setLearners([])); }, [co]);
  const names = Object.fromEntries(learners.map(l => [l.userId, l.name]));
  async function save(remove, userIds) {
    setBusy(true); setMsg({ kind: "", text: "" });
    try {
      await manage.assign(id, { userIds, dueAt: remove ? "" : due, remove });
      setMsg({ kind: "ok", text: remove ? "割り当てを外しました。" : `${userIds.length}人に割り当てました。` });
      setPicked({}); load();
    } catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || "割り当てられませんでした。" }); }
    finally { setBusy(false); }
  }
  const ids = Object.keys(picked).filter(k => picked[k]);
  return (
    <section className="card mcard">
      <div className="eyebrow">受講生に割り当てる</div>
      <div className="mgrid">
        <Field label="企業">
          <select value={co} onChange={e => setCo(e.target.value)}>
            <option value="">選んでください</option>
            {(companies || []).map(c => <option key={c.id || c.companyId} value={c.id || c.companyId}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="期限（空なら期限なし）"><input type="date" value={due} onChange={e => setDue(e.target.value)} /></Field>
      </div>
      {co && (learners.length ? (
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {learners.map(l => <label key={l.userId} className="chip" style={{ cursor: "pointer", padding: "2px 10px" }}><input type="checkbox" checked={!!picked[l.userId]} onChange={e => setPicked({ ...picked, [l.userId]: e.target.checked })} />{l.name || l.userId}</label>)}
        </div>
      ) : <p className="muted" style={{ margin: 0, fontSize: 13 }}>受講生がいません</p>)}
      <button type="button" className="btn" style={{ justifySelf: "start" }} disabled={busy || !ids.length} onClick={() => save(false, ids)}>{busy ? "割り当てています…" : `${ids.length ? `${ids.length}人に` : ""}割り当てる`}</button>
      {current === null ? <p className="muted" style={{ margin: 0, fontSize: 13 }}>いまの割り当てを確認できません</p> : current.length > 0 && (
        <div style={{ display: "grid", gap: 4 }}>
          <span className="eyebrow">割り当て中</span>
          {current.map(a => (
            <div key={a.userId} className="row" style={{ gap: 8, fontSize: 13.5 }}>
              <span>{names[a.userId] || a.userId}</span>{a.dueAt ? <span className="chip warn">期限 {a.dueAt}</span> : <span className="chip">期限なし</span>}
              <button type="button" className="btn ghost" style={{ marginLeft: "auto", padding: "2px 10px" }} disabled={busy} onClick={() => save(true, [a.userId])}>外す</button>
            </div>
          ))}
        </div>
      )}
      {msg.text && <div className={`verdict ${msg.kind}`} role={msg.kind === "ng" ? "alert" : "status"}>{msg.text}</div>}
    </section>
  );
}

/* 演習のタグ（2026-10-15）。単元のタグの一覧から選ぶ。一覧に無いタグ（単元を変えた・一覧から外した）は×で外せるように残す */
const MAX_DRILL_TAGS = 3;
function TagPicker({ topic, value, onChange }) {
  const tech = topic?.tagsTech || [], learn = topic?.tagsLearn || [];
  const known = new Set([...tech, ...learn]);
  const toggle = x => onChange(value.includes(x) ? value.filter(y => y !== x) : value.length >= MAX_DRILL_TAGS ? value : [...value, x]);
  const chip = (x, strong) => <button key={x} type="button" className={`chip ${value.includes(x) ? "done" : ""}`} style={{ fontWeight: strong ? 700 : 500 }} aria-pressed={value.includes(x)} disabled={!value.includes(x) && value.length >= MAX_DRILL_TAGS} onClick={() => toggle(x)}>{x}</button>;
  if (!topic) return <span className="muted" style={{ fontSize: 13 }}>先に単元を選んでください</span>;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {tech.length > 0 && <div className="row" style={{ gap: 6, flexWrap: "wrap" }}><span className="muted" style={{ fontSize: 12, minWidth: 64 }}>技術</span>{tech.map(x => chip(x, true))}</div>}
      {learn.length > 0 && <div className="row" style={{ gap: 6, flexWrap: "wrap" }}><span className="muted" style={{ fontSize: 12, minWidth: 64 }}>学ぶこと</span>{learn.map(x => chip(x, false))}</div>}
      {value.filter(x => !known.has(x)).length > 0 && <div className="row" style={{ gap: 6, flexWrap: "wrap" }}><span className="muted" style={{ fontSize: 12, minWidth: 64 }}>一覧に無い</span>{value.filter(x => !known.has(x)).map(x => <button key={x} type="button" className="chip warn" onClick={() => toggle(x)}>{x} ×</button>)}</div>}
      {!tech.length && !learn.length && <span className="muted" style={{ fontSize: 13 }}>この単元にはタグの一覧がありません（「単元」で足せます）</span>}
    </div>
  );
}

/* 演習とレッスンの紐づけ（2026-10-15）。コースを選ぶとそのレッスンが出る */
function LessonLinks({ lrn, courses, value, onChange }) {
  const [cid, setCid] = useState("");
  const [lid, setLid] = useState("");
  useEffect(() => { if (cid && lrn?.refreshCourseLessons) lrn.refreshCourseLessons(cid); }, [cid]); // eslint-disable-line react-hooks/exhaustive-deps
  const lessonsOf = c => (lrn?.lessonsForCourse ? lrn.lessonsForCourse(c) : []) || [];
  const courseTitle = c => courses.find(x => x.id === c)?.title || c;
  const lessonTitle = (c, l) => lessonsOf(c).find(x => x.id === l)?.title || l;
  const add = () => {
    if (!cid || !lid || value.some(x => x.courseId === cid && x.lessonId === lid)) return;
    onChange([...value, { courseId: cid, lessonId: lid, courseTitle: courseTitle(cid), lessonTitle: lessonTitle(cid, lid) }]);
    setLid("");
  };
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {value.length > 0 && <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{value.map(x => <button key={`${x.courseId}/${x.lessonId}`} type="button" className="chip" onClick={() => onChange(value.filter(y => y !== x))}>{x.courseTitle || courseTitle(x.courseId)} ／ {x.lessonTitle || lessonTitle(x.courseId, x.lessonId)} ×</button>)}</div>}
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <select value={cid} aria-label="コース" onChange={e => { setCid(e.target.value); setLid(""); }}><option value="">コースを選ぶ</option>{courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        <select value={lid} aria-label="レッスン" disabled={!cid} onChange={e => setLid(e.target.value)}><option value="">レッスンを選ぶ</option>{lessonsOf(cid).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
        <button type="button" className="btn ghost" disabled={!cid || !lid} onClick={add}>足す</button>
      </div>
    </div>
  );
}

function Field({ label, children, wide }) {
  return <label className="mfield" style={wide ? { gridColumn: "1 / -1" } : undefined}><span>{label}</span>{children}</label>;
}

export default function ItemEditor({ kind, id, isNew, topics, courses, go, lrn }) {
  const noun = kind === "drills" ? "演習" : "案件体験";
  const [st, setSt] = useState({ state: isNew ? "ready" : "loading" });
  const [item, setItem] = useState(blank(kind));
  const [newId, setNewId] = useState("");
  const [meta, setMeta] = useState({ draftUpdatedAt: null, published: false, changed: true, issues: [] });
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState("");
  const [tryCode, setTryCode] = useState(null);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    manage.get(kind, id).then(r => {
      if (!alive) return;
      setItem(r.drill || r.case);
      setMeta({ draftUpdatedAt: r.draftUpdatedAt, published: r.published, changed: r.changed, issues: r.issues || [] });
      setSt({ state: "ready" });
    }).catch(e => alive && setSt({ state: "error", status: e?.status }));
    return () => { alive = false; };
  }, [kind, id, isNew]);

  const set = (k, v) => setItem(x => ({ ...x, [k]: v }));
  const setTicket = (k, v) => setItem(x => ({ ...x, ticket: { ...x.ticket, [k]: v } }));
  const setSpec = (k, v) => setItem(x => ({ ...x, spec: { ...(x.spec || { rules: [], fields: [] }), [k]: v } }));
  const setServlet = (k, v) => setItem(x => ({ ...x, servlet: { method: "post", path: "/", filePath: "", pageName: "index.html", pageHtml: "", ...(x.servlet || {}), [k]: v } }));
  const isServlet = item.runtime === "servlet";
  const setTest = (i, k, v) => setItem(x => ({ ...x, tests: x.tests.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const isAws = item.runtime === "aws";
  const hasCode = !isAws && item.runtime !== "check";

  async function save() {
    const realId = isNew ? newId.trim() : id;
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(realId)) { setMsg({ kind: "ng", text: "IDは英小文字・数字・ハイフンで入れてください（例：sum-array）。" }); return null; }
    setBusy("save"); setMsg({ kind: "", text: "" });
    try {
      const r = await manage.save(kind, realId, { [kind === "drills" ? "drill" : "case"]: item, baseUpdatedAt: isNew ? null : meta.draftUpdatedAt });
      setItem(r.drill || r.case);
      setMeta(m => ({ ...m, draftUpdatedAt: r.draftUpdatedAt, changed: true, issues: r.issues || [] }));
      setMsg({ kind: "ok", text: "下書きを保存しました。" });
      if (isNew) go(`#/manage/${kind}/${realId}`);
      return r;
    } catch (e) {
      setMsg({ kind: "ng", text: e?.status === 409 ? "ほかの人が先に保存しました。読み込み直してから直してください。" : e?.errorMessage || "保存できませんでした。" });
      return null;
    } finally { setBusy(""); }
  }
  async function publish() {
    if (!(await save())) return;
    setBusy("publish");
    try {
      await manage.publish(kind, id);
      setMeta(m => ({ ...m, published: true, changed: false }));
      setMsg({ kind: "ok", text: "公開しました。受講生の一覧に出ます。" });
    } catch (e) {
      setMsg({ kind: "ng", text: e?.status === 422 ? `公開できない箇所があります：${(e?.data?.issues || meta.issues || []).join("、")}` : e?.errorMessage || "公開できませんでした。" });
    } finally { setBusy(""); }
  }
  async function remove() {
    if (!window.confirm(`この${noun}を消します。よろしいですか？（一度も公開していないものだけ消せます）`)) return;
    setBusy("remove");
    try { await manage.remove(kind, id); go(`#/manage/${kind}`); }
    catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || "消せませんでした。" }); }
    finally { setBusy(""); }
  }

  if (st.state === "loading") return <p className="muted">読み込んでいます…</p>;
  if (st.state === "error") return <p className="muted">{st.status === 404 ? `この${noun}は見つかりませんでした。` : "読み込めませんでした。もう一度開いてください。"}</p>;

  return (
    <div className="medit">
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <button type="button" className="back" onClick={() => go(`#/manage/${kind}`)}>← {noun}の一覧</button>
        <span style={{ marginLeft: "auto" }} />
        {!isNew && <span className={`chip ${meta.published ? (meta.changed ? "warn" : "done") : ""}`}>{meta.published ? (meta.changed ? "公開中 ・ 未公開の変更あり" : "公開中") : "下書き"}</span>}
      </div>
      <h1 className="h1" style={{ margin: "8px 0 14px" }}>{isNew ? `${noun}を作る` : item.title || "（名前なし）"}</h1>

      <section className="card mcard">
        <div className="mgrid">
          {isNew && <Field label="ID（URLに使う。あとから変えられません）"><input value={newId} onChange={e => setNewId(e.target.value)} placeholder="sum-array" /></Field>}
          <Field label="名前"><input value={item.title} onChange={e => set("title", e.target.value)} /></Field>
          <Field label="単元">
            <select value={item.topic} onChange={e => set("topic", e.target.value)}>
              <option value="">未設定（その他）</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="実行環境">
            <select value={item.runtime} onChange={e => set("runtime", e.target.value)}>
              {RUNTIMES[kind].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {kind === "drills" ? <>
            <Field label="レベル"><select value={item.level} onChange={e => set("level", e.target.value)}>{(isAws ? AWS_LEVELS : LEVELS).map(l => <option key={l}>{l}</option>)}</select></Field>
            <Field label="目安（分）"><input type="number" min="1" value={item.minutes} onChange={e => set("minutes", Number(e.target.value))} /></Field>
            {/* label で包むと、見出しを押したときに最初のタグが切り替わるので div にする */}
            <div className="mfield" style={{ gridColumn: "1 / -1" }}><span>対応するレッスン（なくてもよい・複数可。レッスンの最後の「演習へ」で先頭に並ぶ）</span><LessonLinks lrn={lrn} courses={courses} value={item.lessons || []} onChange={v => set("lessons", v)} /></div>
            <div className="mfield" style={{ gridColumn: "1 / -1" }}><span>タグ（3つまで。一覧は「単元」で決める）</span><TagPicker topic={topics.find(t => t.id === item.topic)} value={item.tags || []} onChange={v => set("tags", v)} /></div>
          </> : <>
            <Field label="目安（時間）"><input type="number" min="0.5" step="0.5" value={item.hours} onChange={e => set("hours", Number(e.target.value))} /></Field>
            <Field label="挑戦できる条件（このコースを修了）">
              <select value={item.needCourseId} onChange={e => set("needCourseId", e.target.value)}>
                <option value="">なし（すぐ挑戦できる）</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>
          </>}
          {isAws && <Field label="AWSのシナリオ"><select value={item.aws?.scenario || ""} onChange={e => set("aws", { ...(item.aws || {}), scenario: e.target.value })}><option value="">選んでください</option>{SCENARIOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>}
          <Field label="並び順（小さいほど前）"><input type="number" min="0" value={item.order} onChange={e => set("order", Number(e.target.value))} /></Field>
          <Field label="Premium"><span className="row" style={{ gap: 6 }}><input type="checkbox" checked={!!item.premium} onChange={e => set("premium", e.target.checked)} />Premiumの人だけ（AWSと、Premiumの単元は自動でPremium）</span></Field>
        </div>
      </section>

      <section className="card mcard">
        <div className="eyebrow">一覧のサムネイル</div>
        <div className="mgrid">
          <Field label="種類">
            <select value={item.thumb?.kind || ""} onChange={e => set("thumb", e.target.value ? { ...(item.thumb || {}), kind: e.target.value } : null)}>
              <option value="">なし</option>
              {THUMB_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          {item.thumb?.kind === "out" && <Field label="出力の行（1行ずつ・4行まで）"><textarea rows={3} value={(item.thumb.out || []).join("\n")} onChange={e => set("thumb", { ...item.thumb, out: e.target.value.split("\n").slice(0, 4) })} /></Field>}
          <div style={{ maxWidth: 280 }}><Thumb item={item} /></div>
        </div>
      </section>

      {kind === "cases" && (
        <section className="card mcard">
          <div className="eyebrow">チケット</div>
          <div className="mgrid">
            <Field label="概要（一覧に出る1〜2文）" wide><input value={item.summary} onChange={e => set("summary", e.target.value)} /></Field>
            <Field label="チケット番号"><input value={item.ticket?.id || ""} onChange={e => setTicket("id", e.target.value)} placeholder="#RSV-142" /></Field>
            <Field label="種類"><select value={item.ticket?.kind || "feat"} onChange={e => setTicket("kind", e.target.value)}><option value="feat">機能追加</option><option value="bug">不具合</option><option value="mod">改修</option></select></Field>
            <Field label="依頼元"><input value={item.ticket?.client || ""} onChange={e => setTicket("client", e.target.value)} placeholder="飲食店グループの予約サイト" /></Field>
            <Field label="背景" wide><textarea rows={3} value={item.ticket?.background || ""} onChange={e => setTicket("background", e.target.value)} /></Field>
            <Field label="今回担当する範囲（1行に1つ）" wide><textarea rows={3} value={(item.ticket?.scope || []).join("\n")} onChange={e => setTicket("scope", e.target.value.split("\n"))} /></Field>
            <Field label="完了条件（1行に1つ）" wide><textarea rows={3} value={(item.ticket?.done || []).join("\n")} onChange={e => setTicket("done", e.target.value.split("\n"))} /></Field>
            <Field label="参考（任意）" wide><textarea rows={2} value={item.ticket?.notes || ""} onChange={e => setTicket("notes", e.target.value)} /></Field>
          </div>
          <div className="eyebrow">チケットのコメント（関係者のひと言・任意）</div>
          {(item.ticket?.comments || []).map((c, i) => (
            <div key={i} className="mtest">
              <select value={c.who} onChange={e => setTicket("comments", item.ticket.comments.map((x, j) => (j === i ? { ...x, who: e.target.value } : x)))}>{PEOPLE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <input value={c.text} onChange={e => setTicket("comments", item.ticket.comments.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="端数は全部切り捨てでお願いします" />
              <button type="button" className="btn ghost" onClick={() => setTicket("comments", item.ticket.comments.filter((_, j) => j !== i))}>消す</button>
            </div>
          ))}
          <button type="button" className="btn ghost" style={{ justifySelf: "start" }} disabled={(item.ticket?.comments || []).length >= 6} onClick={() => setTicket("comments", [...(item.ticket?.comments || []), { who: "client", text: "" }])}>コメントを足す</button>
        </section>
      )}

      {kind === "cases" && <ProjectFields project={item.project} onChange={v => set("project", v)} Field={Field} />}
      {isAws && <AwsStepsField steps={item.aws?.steps} onChange={v => set("aws", { ...(item.aws || {}), steps: v })} Field={Field} />}

      {kind === "cases" && !isAws && (
        <section className="card mcard">
          <div className="eyebrow">仕様書（任意）</div>
          <div className="mgrid">
            <Field label="ルール（1行に1つ。例：合計数量 ≧ 10 → 小計の5%を割引）" wide><textarea rows={4} value={(item.spec?.rules || []).join("\n")} onChange={e => setSpec("rules", e.target.value.split("\n"))} /></Field>
          </div>
          <div className="eyebrow">項目（表）</div>
          {(item.spec?.fields || []).map((f, i) => (
            <div key={i} className="mtest" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr auto" }}>
              {["label", "name", "type", "empty"].map(k => <input key={k} value={f[k] || ""} placeholder={{ label: "項目", name: "name", type: "型", empty: "空のとき" }[k]} onChange={e => setSpec("fields", item.spec.fields.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />)}
              <button type="button" className="btn ghost" onClick={() => setSpec("fields", item.spec.fields.filter((_, j) => j !== i))}>消す</button>
            </div>
          ))}
          <button type="button" className="btn ghost" style={{ justifySelf: "start" }} onClick={() => setSpec("fields", [...(item.spec?.fields || []), { label: "", name: "", type: "", empty: "" }])}>項目を足す</button>
        </section>
      )}

      {kind === "cases" && isServlet && (
        <section className="card mcard">
          <div className="eyebrow">Servlet</div>
          <div className="mgrid">
            <Field label="呼ぶメソッド"><select value={item.servlet?.method || "post"} onChange={e => setServlet("method", e.target.value)}><option value="post">POST（doPost）</option><option value="get">GET（doGet）</option></select></Field>
            <Field label="URL（@WebServlet の値）"><input className="mono" value={item.servlet?.path || ""} onChange={e => setServlet("path", e.target.value)} placeholder="/EstimateServlet" /></Field>
            <Field label="ファイルの場所（表示用）"><input className="mono" value={item.servlet?.filePath || ""} onChange={e => setServlet("filePath", e.target.value)} placeholder="src/main/java/jp/minato/estimate/" /></Field>
            <Field label="画面のファイル名"><input className="mono" value={item.servlet?.pageName || ""} onChange={e => setServlet("pageName", e.target.value)} placeholder="estimate.html" /></Field>
            <Field label="画面（form を含む HTML。動作確認で送信すると Servlet が動きます）" wide><textarea className="mono" rows={8} value={item.servlet?.pageHtml || ""} onChange={e => setServlet("pageHtml", e.target.value)} /></Field>
          </div>
        </section>
      )}

      <section className="card mcard">
        <div className="eyebrow">{kind === "drills" ? "課題" : "作業"}</div>
        <div className="mgrid">
          {kind === "drills" && <Field label="課題文" wide><textarea rows={3} value={item.task} onChange={e => set("task", e.target.value)} /></Field>}
          {kind === "drills" && <Field label="ヒント" wide><textarea rows={2} value={item.hint} onChange={e => set("hint", e.target.value)} /></Field>}
          {item.runtime === "sql" && <Field label="テーブルを作るSQL（実行の前に毎回流します）" wide><textarea className="mono" rows={5} value={item.sqlSetup || ""} onChange={e => set("sqlSetup", e.target.value)} /></Field>}
          {hasCode && <Field label="はじめのコード" wide><textarea className="mono" rows={8} value={item.starterCode} onChange={e => set("starterCode", e.target.value)} /></Field>}
          {hasCode && kind === "drills" && <Field label="お手本（何回か実行したあと受講生が見られます）" wide><textarea className="mono" rows={8} value={item.answerCode} onChange={e => set("answerCode", e.target.value)} /></Field>}
          {hasCode && kind === "cases" && <Field label="お手本（受講生には見せません。AI採点の参考）" wide><textarea className="mono" rows={8} value={item.answerCode || ""} onChange={e => set("answerCode", e.target.value)} /></Field>}
        </div>
      </section>

      {!isAws && (
        <section className="card mcard">
          <div className="eyebrow">{kind === "drills" ? "テスト" : "受け入れ条件（テスト）"}</div>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>{TEST_HELP[item.runtime]}</p>
          {item.tests.map((t, i) => (
            <div key={i} className="mtest">
              <input value={t.name} onChange={e => setTest(i, "name", e.target.value)} placeholder="名前（受講生に見えます）" />
              {(item.runtime === "js" || item.runtime === "web" || item.runtime === "jsweb") && <input className="mono" value={t.expr || ""} onChange={e => setTest(i, "expr", e.target.value)} placeholder="式" />}
              {item.runtime === "java" && <><input className="mono" value={t.stdin || ""} onChange={e => setTest(i, "stdin", e.target.value)} placeholder="入力（任意）" /><input className="mono" value={t.expect || ""} onChange={e => setTest(i, "expect", e.target.value)} placeholder="出てほしい出力" /></>}
              {item.runtime === "sql" && <><input className="mono" value={t.query || ""} onChange={e => setTest(i, "query", e.target.value)} placeholder="答え合わせのSQL" /><input className="mono" value={t.expect || ""} onChange={e => setTest(i, "expect", e.target.value)} placeholder="流したあとに確かめるSQL（INSERT・UPDATE のとき）" /></>}
              {isServlet && <><input className="mono" value={t.params || ""} onChange={e => setTest(i, "params", e.target.value)} placeholder="price=480&count=3" /><textarea className="mono" rows={2} value={t.expect || ""} onChange={e => setTest(i, "expect", e.target.value)} placeholder={"出てほしい文字（1行に1つ）\n合計：1584円"} /></>}
              <button type="button" className="btn ghost" onClick={() => set("tests", item.tests.filter((_, j) => j !== i))}>消す</button>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={() => set("tests", [...item.tests, { name: "" }])} style={{ justifySelf: "start" }}>テストを足す</button>
        </section>
      )}

      {kind === "cases" && <RubricEditor item={item} set={set} id={id || newId.trim() || "new"} hasCode={hasCode} />}
      {kind === "cases" && !isNew && meta.published && <AssignPanel id={id} />}

      {hasCode && !isServlet && (
        <section className="card mcard">
          <div className="row"><div className="eyebrow">試す</div><span className="muted" style={{ fontSize: 13 }}>保存しなくても、ここで動かして確かめられます</span>
            <button type="button" className="btn ghost" style={{ marginLeft: "auto" }} onClick={() => setTryCode(item.starterCode)}>はじめのコードで</button>
            {kind === "drills" && <button type="button" className="btn ghost" onClick={() => setTryCode(item.answerCode)}>お手本で</button>}</div>
          {tryCode != null && <TryPanel key={tryCode} item={item} code={tryCode} setCode={setTryCode} />}
        </section>
      )}

      {meta.issues?.length > 0 && <div className="verdict ng">公開の前に直すところ：{meta.issues.join("、")}</div>}
      {msg.text && <div className={`verdict ${msg.kind}`} role={msg.kind === "ng" ? "alert" : "status"}>{msg.text}</div>}
      <div className="mactions">
        <button type="button" className="btn ghost" onClick={save} disabled={!!busy}>{busy === "save" ? "保存しています…" : "下書きを保存"}</button>
        {!isNew && <button type="button" className="btn" onClick={publish} disabled={!!busy}>{busy === "publish" ? "公開しています…" : meta.published ? "変更を公開する" : "公開する"}</button>}
        {!isNew && !meta.published && <button type="button" className="btn ghost" onClick={remove} disabled={!!busy} style={{ marginLeft: "auto", color: "var(--red)" }}>消す</button>}
      </div>
    </div>
  );
}
