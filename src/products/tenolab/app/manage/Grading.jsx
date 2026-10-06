import React, { useCallback, useEffect, useState } from "react";
import { manage } from "../data.js";
import GradeView from "../GradeView.jsx";
import { Title, VERDICT, fmtTime, TRY_KEY } from "./parts.jsx";

/* AI採点（モック tenolab-admin.html の grading）。採点はAIが済ませて受講生に返している。
   ここでは結果を見て、必要なときだけ判定を変える。基準を直すときは案件体験の編集へ */
const STATUS_TABS = [["all", "すべて"], ["approved", "合格"], ["returned", "やり直し"], ["skipped", "先に進んだ"], ["submitted", "採点できず"]];

export default function Grading({ go, caseId }) {
  const [cases, setCases] = useState([]);
  const [status, setStatus] = useState("all");
  const [st, setSt] = useState({ state: "loading", items: [] });
  const [sel, setSel] = useState(null);
  useEffect(() => { manage.list("cases").then(r => setCases(r.items || [])).catch(() => setCases([])); }, []);
  const load = useCallback(() => {
    setSt(s => ({ ...s, state: "loading" }));
    manage.submissions({ status, caseId }).then(r => setSt({ state: "ready", items: r.items || [], truncated: r.truncated })).catch(() => setSt({ state: "error", items: [] }));
  }, [status, caseId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSel(null); }, [status, caseId]);
  const cur = st.items.find(x => sel && x.userId === sel.userId && x.caseId === sel.caseId) || st.items[0] || null;

  return (
    <>
      <Title eyebrow="AI GRADING" title="AI採点">
        <select className="msel" value={caseId} onChange={e => go(e.target.value ? `#/manage/grading/${e.target.value}` : "#/manage/grading")} aria-label="案件体験">
          <option value="">すべての案件体験</option>
          {cases.map(c => <option key={c.id} value={c.id}>{c.title || c.id}</option>)}
        </select>
        {caseId && <button type="button" className="btn ghost" onClick={() => go(`#/manage/cases/${caseId}`)}>採点の基準</button>}
      </Title>
      <div className="tabs-h" role="tablist" style={{ marginBottom: 14 }}>
        {STATUS_TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={status === k} onClick={() => setStatus(k)}>{l}</button>)}
      </div>
      {st.state === "loading" && <p className="muted">読み込んでいます…</p>}
      {st.state === "error" && <div className="card flat" style={{ padding: 16 }} role="alert">読み込めませんでした。 <button type="button" className="btn ghost" onClick={load}>もう一度</button></div>}
      {st.state === "ready" && !st.items.length && <p className="muted">提出はまだありません。</p>}
      {st.state === "ready" && st.items.length > 0 && (
        <div className="mgrade">
          <section className="card flat" style={{ padding: "4px 8px" }}>
            <div className="tblwrap"><table className="mtbl">
              <thead><tr><th>受講生</th><th>判定</th><th className="rt">回目</th><th>日時</th></tr></thead>
              <tbody>
                {st.items.map(x => {
                  const v = VERDICT[x.status] || [x.status, ""];
                  const on = cur && cur.userId === x.userId && cur.caseId === x.caseId;
                  return (
                    <tr key={`${x.userId}/${x.caseId}`} className={on ? "sel" : ""} onClick={() => setSel(x)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(x); } }} aria-selected={on}>
                      <td><b>{x.userName || "受講生"}</b>{x.company && <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>{x.company}</span>}{!caseId && <div className="muted" style={{ fontSize: 12 }}>{x.caseTitle}</div>}</td>
                      <td><span className={`chip ${v[1]}`}>{v[0]}</span></td>
                      <td className="rt num">{x.attempts || "－"}</td>
                      <td className="muted num" style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtTime(x.submittedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            {st.truncated && <p className="muted" style={{ fontSize: 12, padding: "0 8px" }}>新しい順に200件まで出しています。</p>}
          </section>
          {cur && <Detail key={`${cur.userId}/${cur.caseId}/${cur.status}`} x={cur} go={go} onChanged={load} />}
        </div>
      )}
    </>
  );
}

function Detail({ x, go, onChanged }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const v = VERDICT[x.status] || [x.status, ""];
  const tone = { approved: "ok", returned: "ng" }[x.status] || "warn";
  const sub = [x.review?.override ? "管理者が変更" : x.grade ? "AI" : "", x.attempts ? `${x.attempts}回目` : "", x.fails ? `やり直し ${x.fails}回` : ""].filter(Boolean).join(" ・ ");
  async function change(action) {
    if (action === "return" && !comment.trim()) { setErr("やり直しにするときは、直してほしいことを書いてください。"); return; }
    setBusy(true); setErr("");
    try { await manage.review(x.userId, x.caseId, { action, comment }); setComment(""); onChanged(); }
    catch (e) { setErr(e?.errorMessage || "変えられませんでした。"); }
    finally { setBusy(false); }
  }
  function tryRubric() {
    try { sessionStorage.setItem(TRY_KEY, JSON.stringify({ caseId: x.caseId, code: x.code || "" })); } catch (e) { /* 保存できなくても編集へは行ける */ }
    go(`#/manage/cases/${x.caseId}`);
  }
  return (
    <section className="card msec">
      <div className="row" style={{ gap: 8 }}><h2 style={{ margin: 0 }}>{x.caseTitle || x.caseId}</h2><span className="muted" style={{ fontSize: 13 }}>{x.userName}{x.company ? ` ・ ${x.company}` : ""}</span></div>
      <GradeView label={v[0]} tone={tone} sub={sub} results={x.grade?.results} review={x.aiReview}>
        {x.review?.comment && <div className="rv"><div className="who" style={{ background: "var(--marker)" }}>管</div><div className="bubble" style={{ whiteSpace: "pre-wrap" }}>{x.review.comment}</div></div>}
      </GradeView>
      {(x.testResults || []).length > 0 && <div className="tests">{x.testResults.map((t, i) => <div key={i} className={t.ok ? "ok" : "ng"}>{t.ok ? "✓" : "✗"} {t.name}</div>)}</div>}
      {x.code && <pre className="code" style={{ maxHeight: 340, overflow: "auto", margin: 0 }}>{x.code}</pre>}
      <label className="mfield"><span>受講生へのコメント（やり直しにするときは必須）</span><textarea id={`ov-${x.userId}-${x.caseId}`} rows={2} value={comment} onChange={e => setComment(e.target.value)} /></label>
      {err && <div className="verdict ng" role="alert">{err}</div>}
      <div className="row" style={{ gap: 8 }}>
        {x.status !== "approved" && <button type="button" className="btn ghost" onClick={() => change("approve")} disabled={busy}>合格にする</button>}
        {x.status !== "returned" && <button type="button" className="btn ghost" onClick={() => change("return")} disabled={busy}>やり直しにする</button>}
        {x.code && <button type="button" className="btn ghost" style={{ marginLeft: "auto" }} onClick={tryRubric}>この提出で基準を試す</button>}
      </div>
    </section>
  );
}
