import React, { useRef, useState } from "react";
import { apiPut } from "../../../api.js";
import { Back, Ic, LoadError, Loading, PremTag } from "./ui.jsx";
import { Editor } from "./Workbench.jsx";
import { AwsEnvPanel } from "./DrillPage.jsx";
import { FILE_NAME, runCode } from "./runtime.js";
import { submitCase, useCase } from "./data.js";
import { START_OF } from "./model.js";

/* 案件体験（モックの casePage）。依頼を読む → 作る → テスト → 提出 → レビュー（AIの講評のあと講師が確認） */
const STEPS = ["依頼を読む", "作る", "テスト", "提出", "レビュー"];

export default function CasePage({ ctx, id }) {
  const { back, go, cases, premium, progress } = ctx;
  const c = useCase(id);
  const listItem = cases.find(x => x.id === id);
  if (c.state === "loading") return <Loading />;
  if (c.state === "error" && c.status === 403) {
    // 鍵がかかっているときは、一覧の情報で概要だけ見せる
    return (
      <>
        <Back onClick={() => back("#/cases")} />
        {listItem && <h1 className="h1" style={{ marginBottom: 8 }}>{listItem.title}</h1>}
        {listItem?.summary && <p style={{ margin: 0, color: "var(--ink2)", maxWidth: "66ch" }}>{listItem.summary}</p>}
        <div className="card flat" style={{ padding: 18, marginTop: 14, display: "grid", gap: 8, justifyItems: "start" }}>
          <b><Ic id="lock" /> {listItem?.locked ? "この案件体験はPremiumプランで利用できます" : `${listItem?.needTitle || "前提のコース"}を修了すると挑戦できます`}</b>
          {listItem?.needCourseId && !listItem?.locked && <button type="button" className="btn ghost" onClick={() => go(`#/courses/${listItem.needCourseId}`)}>コースへ</button>}
        </div>
      </>
    );
  }
  if (c.state === "error" && c.status === 404) return <><Back onClick={() => back("#/cases")} /><p className="muted">この案件体験は見つかりませんでした。</p></>;
  if (c.state === "error" || !c.data) return <><Back onClick={() => back("#/cases")} /><LoadError onRetry={c.reload} what="案件体験を読み込めませんでした" /></>;
  return <CaseWork item={{ ...c.data, premium: listItem?.premium ?? c.data.premium }} premium={premium} back={back} progress={progress} onSubmitted={c.reload} />;
}

function CaseWork({ item, premium, back, progress, onSubmitted }) {
  const rec = item.progress || progress.caseOf(item.id) || {};
  const status = rec.status || "";
  const locked = status === "submitted" || status === "approved";
  const [code, setCode] = useState(rec.code ?? item.starterCode ?? "");
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState("");
  const [hint, setHint] = useState(false);
  const [err, setErr] = useState("");
  const frame = useRef(null);
  const tests = item.tests || [];
  const isAws = item.runtime === "aws";
  const passAll = !!run && !run.error && run.results.length > 0 && run.results.every(r => r.ok);
  const stepNow = status === "approved" ? 5 : locked ? 4 : passAll ? 3 : 1;
  const t = item.ticket || {};

  async function doRun() {
    if (busy) return;
    setBusy("run"); setErr("");
    try {
      const r = await runCode(item.runtime, code, tests, { frame: frame.current, sqlSetup: item.sqlSetup });
      setRun(r);
      // 書きかけのコードを残す（提出前だけ）。失敗しても作業は続けられる
      if (!locked) apiPut(`/tenolab/progress/case/${encodeURIComponent(item.id)}`, { status: "doing", code }).then(res => progress.upsert(res?.item)).catch(() => {});
    } finally { setBusy(""); }
  }
  async function submit() {
    if (busy || !passAll) return;
    setBusy("submit"); setErr("");
    try {
      const res = await submitCase(item.id, { code, testResults: run.results.map(r => ({ name: r.name, ok: r.ok })) });
      progress.upsert(res?.item);
      onSubmitted();
    } catch (e) {
      setErr(e?.status === 409 ? "すでに提出済みです。画面を読み込み直してください。" : "提出できませんでした。通信状況を確かめて、もう一度提出してください。");
    } finally { setBusy(""); }
  }
  const results = run?.results || (locked && Array.isArray(rec.testResults) ? rec.testResults : null);

  return (
    <>
      <Back onClick={() => back("#/cases")} />
      <div style={{ display: "grid", gap: 8 }}>
        <div className="row"><span className="chip case"><Ic id="case" />案件体験</span><PremTag item={item} premium={premium} />{item.hours ? <span className="chip">目安 {item.hours}時間</span> : null}<span className="chip">実際の案件をもとに再構成</span></div>
        <h1 className="h1">{item.title}</h1>
        {item.summary && <p style={{ margin: 0, color: "var(--ink2)", maxWidth: "66ch" }}>{item.summary}</p>}
      </div>
      <div className="steps">{STEPS.map((s, i) => <div key={s} className={i < stepNow ? "done" : i === stepNow ? "now" : ""}><small>STEP {i + 1}</small>{s}</div>)}</div>
      <div className="case-wrap">
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section className="card ticket">
            <div className="row">{t.id && <span className="id">TICKET {t.id}</span>}<span className="chip">担当：あなた</span><span className="chip">レビュー：講師</span></div>
            {t.client && <span className="muted" style={{ fontSize: 13 }}>{t.client}</span>}
            {t.background && <p className="muted" style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap" }}>{t.background}</p>}
            {Array.isArray(t.scope) && t.scope.length > 0 && (
              <div><div className="eyebrow" style={{ marginBottom: 6 }}>今回担当する範囲</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink2)", fontSize: 14, display: "grid", gap: 4 }}>{t.scope.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            )}
            <div><div className="eyebrow" style={{ marginBottom: 6 }}>受け入れ条件</div>
              <ul className="checks">{tests.map((x, i) => { const ok = results?.[i]?.ok; return <li key={i} className={ok ? "ok" : ""}><i>{ok ? "✓" : ""}</i>{x.name}</li>; })}</ul></div>
          </section>
          {t.notes && <section className="card flat" style={{ padding: "16px 18px", display: "grid", gap: 8 }}><div className="eyebrow">参考</div><p style={{ margin: 0, fontSize: 14, color: "var(--ink2)", whiteSpace: "pre-wrap" }}>{t.notes}</p></section>}
        </div>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {isAws ? (
            <AwsEnvPanel scenario={item.aws?.scenario} start={START_OF[item.aws?.scenario] || "blank"} task={item.task} readOnly={locked}
              onGraded={r => setRun({ out: [], error: "", results: (r?.checks || []).map(x => ({ name: x.name, ok: !!x.ok })) })} />
          ) : (
            <div className="ed">
              <Editor value={code} onChange={setCode} label={FILE_NAME[item.runtime] || "main"} readOnly={locked} minHeight={330} />
              <div className="run">
                <button className="btn" type="button" onClick={doRun} disabled={locked || !!busy}><Ic id="play" />{busy === "run" ? "実行しています…" : "テストを実行"}</button>
                {item.hint && <button className="btn ghost" type="button" onClick={() => setHint(true)} disabled={locked}>ヒント</button>}
                <button className="btn dark" type="button" onClick={submit} disabled={!passAll || locked || !!busy} style={{ marginLeft: "auto" }}>{busy === "submit" ? "提出しています…" : "提出する"}</button>
              </div>
            </div>
          )}
          {item.runtime === "web" && <iframe ref={frame} title="表示" sandbox="allow-same-origin" style={{ width: "100%", minHeight: 200, border: "1px solid var(--line)", borderRadius: 10, background: "#fff" }} />}
          <section className="card flat" style={{ padding: "14px 16px", display: "grid", gap: 8 }}>
            <div className="row"><span className="eyebrow">テスト</span>{results && <b className="num" style={{ marginLeft: "auto" }}>{results.filter(x => x.ok).length} / {tests.length || results.length}</b>}</div>
            {run?.error && <div className="verdict ng">エラー: {run.error}</div>}
            {run && run.out?.length > 0 && <pre className="code" style={{ margin: 0, maxHeight: 160, overflow: "auto" }}>{run.out.join("\n")}</pre>}
            <div className="tests">{(tests.length ? tests : (results || [])).map((x, i) => { const v = results?.[i]; return <div key={i} className={v ? (v.ok ? "ok" : "ng") : ""}>{v ? (v.ok ? "✓" : "✗") : "・"} {x.name}</div>; })}</div>
            {hint && item.hint && <div className="hint">{item.hint}</div>}
            {isAws && passAll && !locked && <button className="btn dark" type="button" onClick={submit} disabled={!!busy} style={{ justifySelf: "start" }}>{busy === "submit" ? "提出しています…" : "提出する"}</button>}
          </section>
          {err && <div className="verdict ng" role="alert">{err}</div>}
          {(locked || status === "returned") && (
            <section className="card review">
              <div className="row"><span className="eyebrow">レビュー</span><span className={`chip ${status === "approved" ? "done" : ""}`}><Ic id="check" />受け入れ条件 {(rec.testResults || []).filter(x => x.ok).length} / {(rec.testResults || []).length}</span></div>
              {rec.aiReview && <div className="rv"><div className="who">AI</div><div className="bubble" style={{ whiteSpace: "pre-wrap" }}>{rec.aiReview}</div></div>}
              <div className="rv"><div className="who" style={{ background: "var(--marker)" }}>講</div><div className="bubble" style={{ whiteSpace: "pre-wrap" }}>
                {status === "submitted" ? "講師の確認待ちです。確認が終わると、案件体験の記録に残ります。"
                  : status === "approved" ? (rec.review?.comment || "確認しました。OKです。")
                    : (rec.review?.comment ? `やり直し：${rec.review.comment}` : "やり直しになりました。直してもう一度提出してください。")}
              </div></div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
