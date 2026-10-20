import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../api.js";
import { findPeople } from "./useConsole.js";

/* 頼んだ結果の板（2026-10-20）。AI が出した「変える内容」を1つずつ見せ、確かめてから実行する。
   公開・登録・変更は、ここで「この内容で実行」を押すまで何も起きない（ユーザー指定：公開する前は必ず確認）。
   実行は本人の権限で今までの API を呼ぶ（権限の判定は各 API のまま） */

const OP_LABEL = {
  assign_instructor: ["講師", "dhc-k-mv"],
  enroll: ["受講生を追加", "dhc-k-add"],
  announce: ["お知らせを出す", "dhc-k-pub"],
  rename_course: ["名前を変える", "dhc-k-mv"],
  course_dates: ["期間を変える", "dhc-k-mv"],
};

function usePeople(changes, role) {
  const needIns = changes.some(c => c.op === "assign_instructor");
  const needUsers = changes.some(c => c.op === "enroll");
  const [people, setPeople] = useState({ instructors: null, users: null, error: "" });
  useEffect(() => {
    if (role !== "admin" || (!needIns && !needUsers)) return;
    let alive = true;
    Promise.all([
      needIns ? apiGet("/admin/instructors") : Promise.resolve([]),
      needUsers ? apiGet("/admin/users") : Promise.resolve([]),
    ]).then(([ins, users]) => { if (alive) setPeople({ instructors: ins || [], users: (users || []).filter(u => !u.role || u.role === "trainee"), error: "" }); })
      .catch(() => { if (alive) setPeople({ instructors: [], users: [], error: "人の一覧を読み込めませんでした。" }); });
    return () => { alive = false; };
  }, [needIns, needUsers, role]);
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
        <CoursePick value={c.courseId} courses={courses} onChange={v => set(i, { courseId: v })} />
        {status?.ok && <small style={{ color: "var(--ok)", fontWeight: 700 }}>実行しました</small>}
        {status?.error && <small style={{ color: "var(--bad)" }}>{status.error}</small>}
      </div>
    </div>
  );
}

// 1つの変更を、今までの API で実行する
async function runChange(c, { courses, people }) {
  const course = courses.find(x => x.id === c.courseId);
  if (!course) throw new Error("コースを選んでください。");
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
  const people = usePeople(changes, role);
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
      catch (e) { next[i] = { error: e?.message || "実行できませんでした。" }; }
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
