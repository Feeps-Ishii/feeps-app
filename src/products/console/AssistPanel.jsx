import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../api.js";
import { findPeople } from "./useConsole.js";
import { aclText, relayoutCurriculum, testCourseIds } from "./materials.js";

/* 頼んだ結果の板（2026-10-20）。AI が出した「変える内容」を1つずつ見せ、確かめてから実行する。
   公開・登録・変更は、ここで「この内容で実行」を押すまで何も起きない（ユーザー指定：公開する前は必ず確認）。
   実行は本人の権限で今までの API を呼ぶ（権限の判定は各 API のまま） */

const OP_LABEL = {
  assign_instructor: ["講師", "dhc-k-mv"],
  enroll: ["受講生を追加", "dhc-k-add"],
  announce: ["お知らせを出す", "dhc-k-pub"],
  rename_course: ["名前を変える", "dhc-k-mv"],
  course_dates: ["期間を変える", "dhc-k-mv"],
  link_test: ["テストを付ける", "dhc-k-add"],
  folder_access: ["見せる人", "dhc-k-pub"],
  copy_curriculum: ["カリキュラムを写す", "dhc-k-mv"],
};
const norm = s => String(s || "").replace(/[\s　「」『』]/g, "").toLowerCase();
const byName = (list, name, key = "name") => {
  const n = norm(name);
  const exact = list.filter(x => norm(x[key]) === n);
  if (exact.length) return exact;
  const part = list.filter(x => norm(x[key]).includes(n) || (n.length >= 2 && n.includes(norm(x[key])) && norm(x[key]).length >= 2));
  if (part.length) return part.slice(0, 6);
  // 語に分けて、どの語も入っているもの（「Javaの確認テスト」→「Java 基本文法 確認テスト」）
  const words = String(name || "").split(/[s　の・、「」]+/).map(norm).filter(w => w.length >= 2);
  return words.length ? list.filter(x => words.every(w => norm(x[key]).includes(w))).slice(0, 6) : [];
};
const spaceName = (spaceId, courses) => (spaceId === "shared" ? "共有（全社）" : spaceId === "ops" ? "運営だけ" : courses.find(c => `course#${c.id}` === spaceId)?.name || "コース");

function usePeople(changes, role, courses) {
  const needIns = role === "admin" && changes.some(c => c.op === "assign_instructor");
  // 受講生を探す：管理者は全員、コース担当者は自分のコースの企業の受講生（/companies/{id}/trainees）
  const needUsers = (role === "admin" || role === "manager") && changes.some(c => c.op === "enroll");
  const companyIds = [...new Set(courses.map(c => c.companyId).filter(Boolean))].join(",");
  const needTests = changes.some(c => c.op === "link_test");
  const folderCourses = changes.some(c => c.op === "folder_access") ? [...new Set(changes.filter(c => c.op === "folder_access").map(c => c.courseId || "*"))].join(",") : "";
  const [people, setPeople] = useState({ instructors: null, users: null, tests: null, folders: null, error: "" });
  useEffect(() => {
    if (!needIns && !needUsers && !needTests && !folderCourses) return;
    let alive = true;
    // フォルダは、コースが分かればそのコースと共有、分からなければ共有と担当のコース（20まで）から探す
    const ids = folderCourses.split(",").filter(Boolean);
    const spaces = !folderCourses ? [] : [...new Set(["shared", ...(ids.includes("*") ? ["ops", ...courses.slice(0, 20).map(c => `course#${c.id}`)] : []), ...ids.filter(x => x !== "*").map(id => `course#${id}`)])];
    Promise.all([
      needIns ? apiGet("/admin/instructors") : Promise.resolve([]),
      !needUsers ? Promise.resolve([]) : role === "admin" ? apiGet("/admin/users")
        : Promise.all(companyIds.split(",").filter(Boolean).map(id => apiGet(`/companies/${encodeURIComponent(id)}/trainees`).catch(() => []))).then(x => x.flat()),
      needTests ? apiGet("/tests") : Promise.resolve([]),
      Promise.all(spaces.map(sp => apiGet(`/library?spaceId=${encodeURIComponent(sp)}`).then(r => (r?.nodes || []).filter(n => n.type === "folder").map(n => ({ ...n, spaceId: sp }))).catch(() => []))).then(x => x.flat()),
    ]).then(([ins, users, tests, folders]) => {
      if (alive) setPeople({ instructors: ins || [], users: (users || []).filter(u => !u.role || u.role === "trainee"), tests: (tests || []).filter(t => t.status !== "archived"), folders: folders.map(f => (f.nodeId === "root" ? { ...f, name: "（いちばん上）" } : f)), error: "" });
    }).catch(() => { if (alive) setPeople({ instructors: [], users: [], tests: [], folders: [], error: "一覧を読み込めませんでした。" }); });
    return () => { alive = false; };
  }, [needIns, needUsers, needTests, folderCourses]); // eslint-disable-line react-hooks/exhaustive-deps
  return people;
}

function CoursePick({ value, courses, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label="コース">
      <option value="">コースを選んでください</option>
      {courses.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? `（${c.company}）` : ""}</option>)}
    </select>
  );
}

function Change({ c, i, courses, people, set, status }) {
  const [label, cls] = OP_LABEL[c.op] || ["変更", "dhc-k-mv"];
  const course = courses.find(x => x.id === c.courseId);
  let body = null;
  if (c.op === "assign_instructor") {
    const hits = people.instructors ? findPeople(people.instructors, c.person) : null;
    body = (<>
      <b>{c.person} さんを講師にする</b>
      {hits === null ? <small>講師を探しています…</small>
        : !hits.length ? <small style={{ color: "var(--bad)" }}>「{c.person}」という講師が見つかりません。人・企業で講師を登録してください。</small>
        : <div className="dhc-which">{hits.map(p => (
          <button key={p.userId} type="button" aria-pressed={(c.userId || (hits.length === 1 ? hits[0].userId : "")) === p.userId} onClick={() => set(i, { userId: p.userId })}>
            {p.name}<small>{p.email}</small>
          </button>))}</div>}
    </>);
  } else if (c.op === "enroll") {
    const res = people.users ? c.people.map(n => ({ n, hits: findPeople(people.users, n) })) : null;
    body = (<>
      <b>受講生 {c.people.length} 人をコースに入れる</b>
      {res === null ? <small>受講生を探しています…</small> : <div className="dhc-names">{res.map(r => (
        <span key={r.n} className={r.hits.length === 1 ? "" : "ng"} title={r.hits.length > 1 ? "同じ名前が何人かいます" : r.hits.length ? r.hits[0].email : "見つかりません"}>
          {r.n}{r.hits.length === 1 ? "" : r.hits.length ? "（何人か）" : "（なし）"}
        </span>))}</div>}
      {res && res.some(r => r.hits.length !== 1) && <small>オレンジの人は入れません。アカウントがない人は 人・企業 から登録してください。</small>}
    </>);
  } else if (c.op === "announce") {
    body = (<>
      <b>受講生へお知らせを出す</b>
      <input type="text" value={c.title} onChange={e => set(i, { title: e.target.value })} aria-label="件名" />
      <textarea value={c.body} onChange={e => set(i, { body: e.target.value })} aria-label="本文" />
      <small>出すとすぐに受講生のホームに出ます。文を直してから実行できます。</small>
    </>);
  } else if (c.op === "link_test") {
    const hits = people.tests ? byName(people.tests, c.test, "title") : null;
    const pickId = c.testId || (hits?.length === 1 ? (hits[0].testId || hits[0].id) : "");
    body = (<>
      <b>テスト「{c.test}」をコースに付ける</b>
      {hits === null ? <small>テストを探しています…</small>
        : !hits.length ? <small style={{ color: "var(--bad)" }}>「{c.test}」というテストが見つかりません。教材 → テスト で探してください。</small>
        : <div className="dhc-which">{hits.map(t => (
          <button key={t.testId || t.id} type="button" aria-pressed={pickId === (t.testId || t.id)} onClick={() => set(i, { testId: t.testId || t.id })}>
            {t.title}<small>{t.status === "published" ? "公開中（付けたコースの受講生にすぐ出ます）" : "下書き"}</small>
          </button>))}</div>}
    </>);
  } else if (c.op === "folder_access") {
    const hits = people.folders ? byName(people.folders, c.folder) : null;
    const pick = hits?.find(f => `${f.spaceId}|${f.nodeId}` === c.folderKey) || (hits?.length === 1 ? hits[0] : null);
    const next = { scope: pick?.acl?.scope === "org" ? "org" : pick?.acl?.scope === "groups" ? "groups" : "course", groups: pick?.acl?.groups || null, roles: { trainee: !!c.trainee, client: !!c.client, instructor: c.instructor !== false } };
    body = (<>
      <b>フォルダ「{c.folder}」を見せる人を変える</b>
      {hits === null ? <small>フォルダを探しています…</small>
        : !hits.length ? <small style={{ color: "var(--bad)" }}>「{c.folder}」というフォルダが見つかりません。教材 → フォルダ で探してください。</small>
        : (<>
          {hits.length > 1 && <div className="dhc-which">{hits.map(f => (
            <button key={f.spaceId + f.nodeId} type="button" aria-pressed={pick === f} onClick={() => set(i, { folderKey: `${f.spaceId}|${f.nodeId}` })}>
              {f.name}<small>{spaceName(f.spaceId, courses)}</small>
            </button>))}</div>}
          {pick && <small>{spaceName(pick.spaceId, courses)} ・ いま {aclText(pick.acl, pick.spaceId)} → <b style={{ color: "var(--ink)" }}>{aclText(next, pick.spaceId)}</b></small>}
        </>)}
      <div className="dhc-checks">{[["trainee", "受講生"], ["instructor", "講師"], ["client", "企業担当"]].map(([k, t]) => (
        <label key={k} className={(k === "instructor" ? c[k] !== false : c[k]) ? "on" : ""}><input type="checkbox" disabled={!!status} checked={k === "instructor" ? c[k] !== false : !!c[k]} onChange={e => set(i, { [k]: e.target.checked })} />{t}</label>))}</div>
    </>);
  } else if (c.op === "copy_curriculum") {
    const from = courses.find(x => x.id === c.fromCourseId);
    body = (<>
      <b>{from?.name || "—"} のカリキュラムを写す</b>
      <small>写す先のいまのカリキュラムは置きかわります。日付は始まりの日から平日で並べ直します（祝日は見ません）。</small>
      <label className="dhc-field">始まりの日<input type="date" value={c.startDate || course?.startDate || ""} onChange={e => set(i, { startDate: e.target.value })} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: "5px 10px" }} /></label>
    </>);
  } else if (c.op === "rename_course") {
    body = (<><b>名前を変える</b><small>{course?.name || "—"} → </small><input type="text" value={c.name} onChange={e => set(i, { name: e.target.value })} aria-label="新しい名前" /></>);
  } else if (c.op === "course_dates") {
    body = (<><b>期間を変える</b><small>{course?.startDate || "—"} 〜 {course?.endDate || "—"} → {c.startDate || course?.startDate || "—"} 〜 {c.endDate || course?.endDate || "—"}</small></>);
  }
  return (
    <div className={`dhc-chg${status?.ok ? " done" : status?.error ? " fail" : ""}`}>
      <input type="checkbox" checked={c.on !== false} disabled={!!status} onChange={e => set(i, { on: e.target.checked })} aria-label="この変更を実行する" />
      <span className={`k ${cls}`}>{label}</span>
      <div className="bd">
        {body}
        {c.op !== "folder_access" && <CoursePick value={c.courseId} courses={courses} onChange={v => set(i, { courseId: v })} />}
        {status?.ok && <small style={{ color: "var(--ok)", fontWeight: 700 }}>実行しました</small>}
        {status?.error && <small style={{ color: "var(--bad)" }}>{status.error}</small>}
      </div>
    </div>
  );
}

// 1つの変更を、今までの API で実行する
async function runChange(c, { courses, people }) {
  if (c.op === "folder_access") {
    const hits = byName(people.folders || [], c.folder);
    const f = hits.find(x => `${x.spaceId}|${x.nodeId}` === c.folderKey) || (hits.length === 1 ? hits[0] : null);
    if (!f) throw new Error("フォルダを1つ選んでください。");
    const acl = { scope: f.acl?.scope === "org" ? "org" : f.acl?.scope === "groups" ? "groups" : "course", groups: f.acl?.groups || null, roles: { trainee: !!c.trainee, client: !!c.client, instructor: c.instructor !== false }, ...(f.acl?.owner ? { owner: f.acl.owner } : {}) };
    await apiPut(`/library/nodes/${encodeURIComponent(f.nodeId)}`, { spaceId: f.spaceId, acl });
    return;
  }
  const course = courses.find(x => x.id === c.courseId);
  if (!course) throw new Error("コースを選んでください。");
  if (c.op === "link_test") {
    const hits = byName(people.tests || [], c.test, "title");
    const t = (people.tests || []).find(x => (x.testId || x.id) === c.testId) || (hits.length === 1 ? hits[0] : null);
    if (!t) throw new Error("テストを1つ選んでください。");
    await apiPut(`/tests/${encodeURIComponent(t.testId || t.id)}`, { courseIds: [...new Set([...testCourseIds(t), course.id])] });
    return;
  }
  if (c.op === "copy_curriculum") {
    const start = c.startDate || course.startDate;
    if (!start) throw new Error("始まりの日を入れてください。");
    const src = await apiGet(`/courses/${encodeURIComponent(c.fromCourseId)}/curriculum`);
    const plan = relayoutCurriculum(src, start);
    await apiPut(`/courses/${encodeURIComponent(course.id)}/curriculum`, { sections: plan.sections, sessions: plan.sessions });
    return;
  }
  const coursePut = extra => apiPut(`/courses/${encodeURIComponent(course.id)}`, {
    name: course.name, type: course.type || course.kind || "shinjin", memo: course.memo ?? course.description ?? "", ...extra,
  });
  if (c.op === "assign_instructor") {
    const hits = findPeople(people.instructors || [], c.person);
    const userId = c.userId || (hits.length === 1 ? hits[0].userId : "");
    if (!userId) throw new Error("講師を1人選んでください。");
    const ids = [...new Set([...(course.instructorIds || []), userId])];
    await coursePut({ instructorIds: ids });
    return;
  }
  if (c.op === "enroll") {
    const ids = c.people.map(n => findPeople(people.users || [], n)).filter(h => h.length === 1).map(h => h[0].userId);
    if (!ids.length) throw new Error("入れられる受講生がいません。");
    for (const traineeId of ids) await apiPost(`/courses/${encodeURIComponent(course.id)}/trainees`, { traineeId });
    return;
  }
  if (c.op === "announce") {
    if (!String(c.title || "").trim() || !String(c.body || "").trim()) throw new Error("件名と本文を入れてください。");
    await apiPost("/announcements", { title: c.title.trim(), body: c.body.trim(), audience: "trainee", courseId: course.id });
    return;
  }
  if (c.op === "rename_course") { await coursePut({ name: String(c.name || "").trim() || course.name }); return; }
  if (c.op === "course_dates") {
    await coursePut({ ...(c.startDate ? { startDate: c.startDate } : {}), ...(c.endDate ? { endDate: c.endDate } : {}) });
    return;
  }
  throw new Error("この変更はまだできません。");
}

export default function AssistPanel({ ask, courses, role, onClose, onNavigate, onDone }) {
  const [changes, setChanges] = useState(() => (ask.result?.changes || []).map(c => ({ ...c, on: true })));
  const [status, setStatus] = useState({});
  const [running, setRunning] = useState(false);
  const people = usePeople(changes, role, courses);
  const set = (i, patch) => setChanges(list => list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const r = ask.result;
  const finished = changes.length > 0 && changes.every((c, i) => c.on === false || status[i]);

  async function run() {
    setRunning(true);
    const next = { ...status };
    for (let i = 0; i < changes.length; i++) {
      const c = changes[i];
      if (c.on === false || next[i]?.ok) continue;
      try { await runChange(c, { courses, people }); next[i] = { ok: true }; }
      catch (e) { next[i] = { error: e?.errorMessage || (e?.status ? "実行できませんでした（権限がないか、入力が正しくありません）。" : e?.message) || "実行できませんでした。" }; }
      setStatus({ ...next });
    }
    setRunning(false);
    onDone?.();
  }

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="dhc-shade" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="dhc-panel" role="dialog" aria-modal="true" aria-label="頼んだこと">
        <header><b>頼んだこと</b><button type="button" onClick={onClose} aria-label="閉じる">×</button></header>
        <div className="in">
          <div className="dhc-you">{ask.text}</div>
          <div className="dhc-say">
            <span className="ic">AI</span>
            <div className="tx">
              {ask.loading && <span className="dhc-note">考えています…</span>}
              {ask.error && <div className="dhc-err">{ask.error}</div>}
              {r?.kind === "answer" && <span>{r.text}</span>}
              {r?.kind === "navigate" && (<>
                <span>{r.summary || "この画面で行えます。"}</span>
                <div><button type="button" className="dhc-btn" onClick={() => onNavigate(r)}>開く</button></div>
              </>)}
              {r?.kind === "plan" && (<>
                <span>{r.summary || "次の内容で変えます。"} <b>まだ何も変えていません。</b>確かめて「この内容で実行」を押してください。</span>
                {people.error && <div className="dhc-err">{people.error}</div>}
                {changes.map((c, i) => <Change key={i} c={c} i={i} courses={courses} people={people} set={set} status={status[i]} />)}
              </>)}
            </div>
          </div>
        </div>
        {r?.kind === "plan" && (
          <footer>
            {!finished
              ? <button type="button" className="dhc-btn ok" disabled={running || !changes.some(c => c.on !== false)} onClick={run}>{running ? "実行しています…" : "この内容で実行"}</button>
              : <button type="button" className="dhc-btn" onClick={onClose}>閉じる</button>}
            {!finished && <button type="button" className="dhc-btn ghost" onClick={onClose}>やめる</button>}
            <span className="dhc-note">チェックを外したものは実行しません</span>
          </footer>
        )}
      </section>
    </div>
  );
}
