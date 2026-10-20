import React, { useState } from "react";
import CourseMenu from "./CourseMenu.jsx";
import { tabLabel } from "./ConsoleCourse.jsx";

/* ホーム（2026-10-20）。一番上に大きな頼む欄（コースを選んで頼む／決めずに頼む）。その下に担当のコース */

const n = v => (v == null ? "—" : v);

function CourseCard({ c, onOpen }) {
  const training = c.today === "training";
  return (
    <button type="button" className="dhc-cc" style={{ "--c": c.color }} onClick={() => onOpen(c.id)}>
      <span className="t"><b>{c.name}</b><small>{[c.company, c.term].filter(Boolean).join(" ・ ")}</small></span>
      <span className="nums">
        {training
          ? (<><span><b>{n(c.present)}</b>/ {n(c.students)} 出席</span><span><b>{n(c.reports)}</b>日報</span>{c.reports != null && c.commented != null && c.reports - c.commented > 0 && <span><b>{c.reports - c.commented}</b>コメント待ち</span>}</>)
          : <span>{c.today === "off" ? "今日は研修なし" : c.today === "setup_required" ? "日程が未設定" : "今日の様子は確認できません"}</span>}
      </span>
      <span className="tags">
        {training && <span className="dhc-pill ok">今日 研修</span>}
        {c.issues.map(is => <span key={is.code} className={`dhc-pill ${is.severity === "critical" ? "bad" : "warn"}`}>{is.label}</span>)}
      </span>
    </button>
  );
}

export default function ConsoleHome({ role, courses, loading, error, reload, scope, setScope, onAsk, asking, pick, setPick, openCourse }) {
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const sc = courses.find(c => c.id === scope) || null;
  const submit = t => { const v = String(t ?? text).trim(); if (!v) return; onAsk(v); setText(""); };
  const chips = role === "instructor"
    ? ["今日の日報を確認したい", "お知らせを出したい", "席替えをしたい", "チームを作りたい", "テストの採点待ちを見る"]
    : sc ? ["今日の日報を確認したい", "テストの採点待ちを見る", "お客様の名簿で登録したい", "お知らせを出したい"]
      : ["今日の日報を確認したい", "お客様の名簿で登録したい", "フォルダの公開先を見たい", "教材を使い回したい", "企業の一覧を見たい"];
  return (
    <>
      <section className="dhc-hero">
        <h2>何をしますか？</h2>
        <div className="dhc-hrow">
          <span className="dhc-scope">
            <button type="button" aria-expanded={menu} onClick={() => setMenu(m => !m)}>
              <span className="dhc-dot" style={{ "--c": sc ? sc.color : "#8E96A6" }} />
              <span>{sc ? sc.name : "すべてのコース"}<small>{sc ? [sc.company, sc.term].filter(Boolean).join(" ・ ") || "このコースで頼む" : "コースを決めずに頼む"}</small></span>
              <span className="chev">▾</span>
            </button>
            {menu && <CourseMenu courses={courses} value={scope} allowAll onPick={id => { setScope(id); setMenu(false); }} onClose={() => setMenu(false)} />}
          </span>
          <form className="dhc-bigask" onSubmit={e => { e.preventDefault(); submit(); }}>
            <input value={text} onChange={e => setText(e.target.value)} aria-label="頼む"
              placeholder={sc ? `${sc.name} で頼む（例：今日の日報 ／ 明日は10時開始とお知らせ ／ テストを開く）` : "例）今日の日報を見たい ／ 講師の山口さんを Java研修の担当に ／ 練習問題"} />
            <button type="submit" className="dhc-go" disabled={asking}>{asking ? "…" : "頼む"}</button>
          </form>
        </div>
        <div className="dhc-chips">
          {chips.map(t => <button key={t} type="button" onClick={() => submit(t)}>{t}</button>)}
        </div>
      </section>

      {pick && (
        <div className="dhc-card dhc-sec" style={{ borderColor: "var(--violet)" }}>
          <h3>どのコースの{tabLabel(pick)}を開きますか？<button type="button" className="dhc-lnk r" onClick={() => setPick("")}>やめる</button></h3>
        </div>
      )}

      <div className="dhc-secttl">
        <h2>{role === "instructor" ? "担当のコース" : "コース"}</h2>
        {!loading && <small>{courses.length} コース ・ 今日研修 {courses.filter(c => c.today === "training").length}</small>}
        <span className="r"><button type="button" className="dhc-btn ghost" onClick={reload}>読み直す</button></span>
      </div>
      {error ? <div className="dhc-err">{error} <button type="button" className="dhc-lnk" onClick={reload}>もう一度</button></div>
        : loading ? <div className="dhc-empty">読み込んでいます…</div>
          : !courses.length ? <div className="dhc-card dhc-empty">{role === "instructor" ? "担当のコースがありません。管理者にコースの担当にしてもらってください。" : "コースがありません。人・企業 → コース から作れます。"}</div>
            : <div className="dhc-courses">{courses.map(c => <CourseCard key={c.id} c={c} onOpen={id => openCourse(id, pick || "today")} />)}</div>}
    </>
  );
}
