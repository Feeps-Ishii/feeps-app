import React, { useCallback, useEffect, useState } from "react";
import { manage } from "../data.js";
import { Title, VERDICT, fmtTime as fmt, yen, usdToYen, UsageChart } from "./parts.jsx";
import { useOverview, CompanyTable } from "./Companies.jsx";

/* 管理のホーム（モック tenolab-admin.html の adminHome）。
   上：契約と使用料（企業と契約の画面と同じデータ）。下：AI採点と教材 */
const WEEK_MS = 7 * 24 * 3600 * 1000;

export default function AdminHome({ go }) {
  const [st, setSt] = useState({ state: "loading" });
  const load = useCallback(() => {
    setSt({ state: "loading" });
    Promise.all([manage.list("drills"), manage.list("cases"), manage.submissions({ status: "all" })])
      .then(([d, c, s]) => setSt({ state: "ready", drills: d.items || [], cases: c.items || [], subs: s.items || [] }))
      .catch(() => setSt({ state: "error" }));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (st.state === "loading") return <><Title eyebrow="ADMIN" title="ホーム" /><p className="muted">読み込んでいます…</p></>;
  if (st.state === "error") return <><Title eyebrow="ADMIN" title="ホーム" /><div className="card flat" style={{ padding: 16 }} role="alert">読み込めませんでした。 <button type="button" className="btn ghost" onClick={load}>もう一度</button></div></>;

  const unpublished = [...st.drills.map(x => ({ ...x, kind: "drills" })), ...st.cases.map(x => ({ ...x, kind: "cases" }))].filter(x => !x.published || x.changed);
  const since = Date.now() - WEEK_MS;
  const week = st.subs.filter(x => x.submittedAt && Date.parse(x.submittedAt) >= since);
  const count = s => week.filter(x => x.status === s).length;
  const failedGrade = st.subs.filter(x => x.status === "submitted");
  const stuck = st.subs.filter(x => x.status === "returned" && x.fails >= 3);
  const noRubric = st.cases.filter(x => x.runtime !== "aws" && !x.rubricCount);

  return (
    <>
      <Title eyebrow="ADMIN" title="ホーム" />
      <ContractSection go={go} />
      <h2 className="msub">AI採点と教材</h2>
      <div className="kpi">
        <button type="button" onClick={() => go("#/manage/grading")}><span className="lab">AI採点 ・ この7日</span><span className="big">{week.length}<small>件</small></span><span className="sub">合格 {count("approved")} ・ やり直し {count("returned")} ・ 先に進んだ {count("skipped")}</span></button>
        <button type="button" className={failedGrade.length ? "hot" : ""} onClick={() => go("#/manage/grading")}><span className="lab">採点できなかった提出</span><span className="big">{failedGrade.length}<small>件</small></span><span className="sub">AIの失敗・時間切れ</span></button>
        <button type="button" onClick={() => go("#/manage/drills")}><span className="lab">公開前の教材</span><span className="big">{unpublished.length}<small>件</small></span><span className="sub">演習・案件体験の下書きと未公開の変更</span></button>
      </div>
      <div className="mtwo">
        <section className="card msec">
          <h2>見ておくこと</h2>
          <ul className="todo">
            {stuck.map(x => <li key={`${x.userId}/${x.caseId}`}><span><b>{x.userName || "受講生"}</b> やり直し {x.fails}回 <span className="muted">{x.caseTitle}</span></span><button type="button" className="btn ghost" onClick={() => go(`#/manage/grading/${x.caseId}`)}>採点を見る</button></li>)}
            {noRubric.map(x => <li key={x.id}><span><b>{x.title || x.id}</b> <span className="chip warn">採点の基準なし</span></span><button type="button" className="btn ghost" onClick={() => go(`#/manage/cases/${x.id}`)}>基準を作る</button></li>)}
            {unpublished.slice(0, 5).map(x => <li key={`${x.kind}/${x.id}`}><span><b>{x.title || x.id}</b> <span className="chip">{x.published ? "未公開の変更あり" : "下書き"}</span></span><button type="button" className="btn ghost" onClick={() => go(`#/manage/${x.kind}/${x.id}`)}>開く</button></li>)}
            {!stuck.length && !noRubric.length && !unpublished.length && <li><span className="muted">ありません</span></li>}
          </ul>
        </section>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="make"><span className="ic">テ</span><span><b>コースを作る</b><br /><span>パワポとPDFから、AIで</span></span><button type="button" className="btn" onClick={() => go("#/manage/courses")}>作る</button></div>
          <section className="card msec">
            <div className="row"><h2>最近の採点</h2><button type="button" className="btn ghost" style={{ marginLeft: "auto" }} onClick={() => go("#/manage/grading")}>すべて見る</button></div>
            {st.subs.length ? (
              <ul className="feed">
                {st.subs.slice(0, 6).map(x => { const v = VERDICT[x.status] || [x.status, ""]; return <li key={`${x.userId}/${x.caseId}`}><span className="num">{fmt(x.submittedAt)}</span><span>{x.userName || "受講生"} <span className="muted">{x.caseTitle}</span></span><span className={`chip ${v[1]}`}>{v[0]}</span></li>; })}
              </ul>
            ) : <p className="muted" style={{ margin: 0 }}>まだ提出はありません。</p>}
          </section>
        </div>
      </div>
    </>
  );
}

/* 契約と使用料：契約している企業・月の契約金額・受講・今月の使用料、6か月の推移、企業ごと */
function ContractSection({ go }) {
  const ov = useOverview();
  if (ov.state === "loading" && !ov.data) return <p className="muted">契約と使用料を読み込んでいます…</p>;
  if (ov.state === "error") return <div className="card flat" style={{ padding: 16, marginBottom: 16 }} role="alert">契約と使用料を読み込めませんでした。 <button type="button" className="btn ghost" onClick={ov.reload}>もう一度</button></div>;
  const d = ov.data;
  const act = d.companies.filter(c => c.elearning);
  const fee = act.reduce((s, c) => s + (c.contract.feeMonthly || 0), 0);
  const trainees = act.reduce((s, c) => s + c.trainees, 0);
  const cost = usdToYen(d.totals.aiUsd + d.totals.awsUsd, d.rate);
  const points = d.history.map(h => ({ month: h.month, ai: usdToYen(h.aiUsd, d.rate), aws: usdToYen(h.awsUsd, d.rate) }));
  return (
    <>
      <div className="kpi k4">
        <button type="button" onClick={() => go("#/manage/companies")}><span className="lab">契約している企業</span><span className="big">{act.length}<small>社</small></span><span className="sub">研修でLMS利用 {d.companies.filter(c => c.lms).length}社 ・ Eラーニングなし {d.companies.length - act.length}社</span></button>
        <button type="button" onClick={() => go("#/manage/companies")}><span className="lab">月の契約金額</span><span className="big">{yen(fee)}</span><span className="sub">{act.filter(c => !c.contract.feeMonthly).length ? `金額が未設定 ${act.filter(c => !c.contract.feeMonthly).length}社` : "Eラーニングの契約の合計"}</span></button>
        <button type="button" onClick={() => go("#/manage/companies")}><span className="lab">受講生</span><span className="big">{trainees}<small>人</small></span><span className="sub">Eラーニングを契約している企業</span></button>
        <button type="button" className={fee && cost / fee > 0.2 ? "hot" : ""} onClick={() => go("#/manage/companies")}><span className="lab">今月の使用料</span><span className="big">{yen(cost)}</span><span className="sub">{fee ? `契約金額の ${(cost / fee * 100).toFixed(1)}% ・ ` : ""}概算</span></button>
      </div>
      <div className="mtwo">
        <section className="card msec">
          <div className="row"><h2>使用料の推移</h2><span className="legend" style={{ marginLeft: "auto" }}><span><i style={{ background: "#2457E6" }} />AI</span><span><i style={{ background: "#F29A38" }} />AWSの演習</span></span></div>
          <UsageChart points={points} partialLast />
          <span className="muted" style={{ fontSize: 12 }}>概算 ・ 1ドル{d.rate}円 ・ AWSは10日ごとに取得（{d.awsCost?.through ? `${d.awsCost.through}まで` : "まだ取得していません"}）</span>
        </section>
        <section className="card msec">
          <div className="row"><h2>企業ごと</h2><button type="button" className="btn ghost" style={{ marginLeft: "auto" }} onClick={() => go("#/manage/companies")}>すべて見る</button></div>
          {act.length ? <CompanyTable list={act} rate={d.rate} go={go} compact /> : <p className="muted" style={{ margin: 0 }}>まだありません。</p>}
        </section>
      </div>
    </>
  );
}
