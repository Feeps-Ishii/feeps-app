import React, { useMemo } from "react";
import { PlanLink, planLabel } from "./ui.jsx";

/* 学習の記録（2026-10-20、機能の一覧 B5・ADR 0029）。#/record
   修了したコース・総合テストの点・クリアした演習・案件体験を1枚にまとめ、ブラウザの印刷で PDF にする。
   **外には公開しない**（本人が自分で出すだけ）。PDF に出せるのは有料の人（個人は Pro 以上、企業の人は今までどおり）。
   数字は画面が持っている自分の記録から作る（新しい API は使わない） */
const day = iso => { try { return iso ? new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" }) : "—"; } catch { return "—"; } };
const CASE_STATUS = { approved: ["合格", "ok"], submitted: ["レビュー待ち", ""], returned: ["差し戻し", "warn"], doing: ["進めている", ""], skipped: ["スキップ", ""] };

export default function RecordPage({ ctx, name, email }) {
  const { lrn, courses, drills, cases, progress, premium } = ctx;
  const done = useMemo(() => courses.filter(c => c.completed).map(c => {
    const t = lrn.getOfficialFinalTestResult?.(c.id) || lrn.getLatestFinalTestResult?.(c.id) || null;
    return { ...c, completedAt: lrn.progress?.[c.id]?.completedAt || t?.createdAt || null, score: t?.score ?? null };
  }).sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || ""))), [courses, lrn]);
  const doing = courses.filter(c => !c.completed && c.progress > 0);
  const cleared = useMemo(() => drills.filter(d => d.cleared).map(d => ({ ...d, clearedAt: progress.drill(d.id)?.clearedAt || null }))
    .sort((a, b) => String(b.clearedAt || "").localeCompare(String(a.clearedAt || ""))), [drills, progress]);
  const myCases = cases.filter(c => c.accepted || c.status);
  const passed = myCases.filter(c => c.status === "approved").length;
  const canPrint = premium;

  return (
    <div className="rec">
      <style>{"@media print{@page{size:A4;margin:12mm} body *{visibility:hidden !important} #record-print,#record-print *{visibility:visible !important} #record-print{position:absolute;left:0;top:0;width:100%}}"}</style>
      <div className="rec-bar">
        <div><span className="eyebrow">RECORD</span><h1 className="h1">学習の記録</h1></div>
        <div className="rec-act">
          <button type="button" className="btn" disabled={!canPrint} onClick={() => window.print()}>PDF に出す</button>
          {!canPrint && <small>{planLabel()} プランで PDF に出せます <PlanLink /></small>}
        </div>
      </div>
      <p className="muted rec-note">印刷の画面で「PDF に保存」を選ぶと、PDF になります。記録は本人だけが見られ、外には公開されません。</p>

      <article id="record-print" className="card rec-sheet">
        <header className="rec-head">
          <div><b className="rec-title">DevHub Learning 学習の記録</b><span className="rec-who">{name || "—"}{email ? `（${email}）` : ""}</span></div>
          <span className="rec-date">出力日 {day(new Date().toISOString())}</span>
        </header>
        <div className="rec-sum">
          <div><span>修了したコース</span><b>{done.length}</b></div>
          <div><span>クリアした演習</span><b>{cleared.length}</b></div>
          <div><span>合格した案件体験</span><b>{passed}</b></div>
        </div>

        <h2>修了したコース</h2>
        {done.length ? (
          <table className="rec-t"><thead><tr><th>コース</th><th>単元</th><th>総合テスト</th><th>修了日</th></tr></thead>
            <tbody>{done.map(c => <tr key={c.id}><td>{c.title}</td><td>{c.topicObj?.name || "—"}</td><td className="num">{c.score != null ? `${c.score}点` : "—"}</td><td className="num">{day(c.completedAt)}</td></tr>)}</tbody></table>
        ) : <p className="muted">まだありません</p>}

        {doing.length > 0 && <>
          <h2>学習中のコース</h2>
          <table className="rec-t"><thead><tr><th>コース</th><th>単元</th><th>進み具合</th></tr></thead>
            <tbody>{doing.map(c => <tr key={c.id}><td>{c.title}</td><td>{c.topicObj?.name || "—"}</td><td className="num">{c.progress}%</td></tr>)}</tbody></table>
        </>}

        <h2>クリアした演習</h2>
        {cleared.length ? (
          <table className="rec-t"><thead><tr><th>演習</th><th>単元</th><th>クリアした日</th></tr></thead>
            <tbody>{cleared.map(d => <tr key={d.id}><td>{d.title}{d.runtime === "aws" ? <span className="rec-aws">本物の AWS</span> : null}</td><td>{d.topicObj?.name || "—"}</td><td className="num">{day(d.clearedAt)}</td></tr>)}</tbody></table>
        ) : <p className="muted">まだありません</p>}

        <h2>案件体験</h2>
        {myCases.length ? (
          <table className="rec-t"><thead><tr><th>案件</th><th>状態</th></tr></thead>
            <tbody>{myCases.map(c => { const [label, cls] = CASE_STATUS[c.status] || ["進めている", ""]; return <tr key={c.id}><td>{c.title}</td><td><span className={`rec-st ${cls}`}>{label}</span></td></tr>; })}</tbody></table>
        ) : <p className="muted">まだありません</p>}

        <footer className="rec-foot">DevHub Learning（運営：Feeps）・この記録は本人の学習の記録から作りました</footer>
      </article>
    </div>
  );
}
