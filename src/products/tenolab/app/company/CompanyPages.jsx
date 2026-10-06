import React, { useCallback, useEffect, useState } from "react";
import { company } from "../data.js";
import { Title, PLAN_LABEL, fmtTime } from "../manage/parts.jsx";

/* 企業担当者の画面と、管理者の受講状況（モック tenolab-admin.html の clientHome・learners・person。ADR 0025 §5）
   企業担当者：#/company（ホーム）・#/company/learners[/{userId}]（社員）・#/company/contract（契約）
   管理者：#/manage/learners[/{userId}]（企業を選ぶ。全社も見られる） */
export const CLIENT_NAV = [["home", "ホーム", "#/company"], ["learners", "社員", "#/company/learners"], ["contract", "契約", "#/company/contract"]];
const STATE = { ok: ["順調", "done"], hint: ["ヒント多め", "warn"], stop: ["止まっている", "ng"], notyet: ["未開始", ""] };
const OTHER = { id: "", name: "その他" };

export function clientSection(rest) {
  return rest[0] === "learners" ? "learners" : rest[0] === "contract" ? "contract" : "home";
}

function useCompany(companyId) {
  const [st, setSt] = useState({ state: "loading" });
  const load = useCallback(() => {
    setSt(s => ({ ...s, state: "loading" }));
    company.get(companyId).then(d => setSt({ state: "ready", data: d })).catch(() => setSt({ state: "error" }));
  }, [companyId]);
  useEffect(() => { load(); }, [load]);
  return { ...st, reload: load };
}

const Fail = ({ onRetry, what = "読み込めませんでした。" }) => <div className="card flat" style={{ padding: 16 }} role="alert">{what} <button type="button" className="btn ghost" onClick={onRetry}>もう一度</button></div>;

// 表に出す単元：登録された単元＋（使っていれば）その他
function shownTopics(topics, learners) {
  const anyOther = learners.some(l => (l.levels?.[""] || 0) > 0);
  return anyOther ? [...topics, OTHER] : topics;
}

/* ---------- 企業担当者のルート ---------- */
export default function ClientPages({ rest, go }) {
  const section = clientSection(rest);
  if (section === "learners" && rest[1]) return <LearnerDetail userId={decodeURIComponent(rest[1])} go={go} backHref="#/company/learners" backLabel="社員" />;
  return <ClientBody section={section} go={go} />;
}

function ClientBody({ section, go }) {
  const q = useCompany("");
  if (q.state === "loading" && !q.data) return <p className="muted">読み込んでいます…</p>;
  if (q.state === "error") return <Fail onRetry={q.reload} />;
  const d = q.data;
  if (section === "contract") return <Contract d={d} />;
  if (section === "learners") return <><Title eyebrow={d.company?.name || ""} title="社員" /><LearnersBlock d={d} go={go} base="#/company/learners" /></>;
  return <ClientHome d={d} go={go} />;
}

function ClientHome({ d, go }) {
  const L = d.learners;
  const started = L.filter(l => l.state !== "notyet");
  const avg = started.length ? Math.round(started.reduce((s, l) => s + (l.current?.progress || 0), 0) / started.length) : 0;
  const reached = L.filter(l => Object.values(l.levels || {}).some(v => v >= 4)).length;
  const stop = L.filter(l => l.state === "stop");
  const topics = shownTopics(d.topics, L);
  const fits = L.filter(l => l.topFit);
  return (
    <>
      <Title eyebrow={d.company?.name || ""} title={<span className="mark">社員の習得状況</span>} />
      <div className="kpi k4">
        <button type="button" onClick={() => go("#/company/learners")}><span className="lab">受講生</span><span className="big">{L.length}<small>人</small></span><span className="sub">取り組み中 {started.length}人</span></button>
        <button type="button" onClick={() => go("#/company/learners")}><span className="lab">平均の進み具合</span><span className="big">{avg}<small>%</small></span><span className="sub">いま取り組んでいるコース</span></button>
        <button type="button" onClick={() => go("#/company/learners")}><span className="lab">案件レベルに届いた</span><span className="big">{reached}<small>人</small></span><span className="sub">どれか1つの単元で</span></button>
        <button type="button" className={stop.length ? "hot" : ""} onClick={() => go("#/company/learners")}><span className="lab">止まっている人</span><span className="big">{stop.length}<small>人</small></span><span className="sub">2日以上、進んでいません</span></button>
      </div>
      <div className="mtwo">
        <section className="card msec"><div className="row"><h2>スキル</h2><button type="button" className="btn ghost" style={{ marginLeft: "auto" }} onClick={() => go("#/company/learners")}>社員を見る</button></div>
          <Heat learners={started.length ? started : L} topics={topics} levelNames={d.levelNames} go={go} base="#/company/learners" />
        </section>
        <section className="card msec"><div className="row"><h2>向いている案件</h2><span className="ai-tag" style={{ marginLeft: "auto" }}>AI</span></div>
          {fits.length ? (
            <div className="fit">
              {fits.slice(0, 6).map(l => (
                <button type="button" key={l.userId} className="fitrow" onClick={() => go(`#/company/learners/${encodeURIComponent(l.userId)}`)}>
                  <b>{l.name || "社員"}</b> <span className={`chip ${l.topFit.fit === "向いている" ? "done" : "warn"}`}>{l.topFit.title}</span>
                  <span className="muted" style={{ fontSize: 12.5 }}>{l.topFit.fit}</span>
                </button>
              ))}
            </div>
          ) : <p className="muted" style={{ margin: 0 }}>まだありません</p>}
        </section>
      </div>
    </>
  );
}

function Contract({ d }) {
  const c = d.contract;
  if (!c) return null;
  const seat = c.billingMode === "seat";
  return (
    <>
      <Title eyebrow={d.company?.name || ""} title="契約" />
      <div className="mtwo" style={{ marginTop: 0 }}>
        <section className="card msec">
          <div className="rows">
            <div><span>Eラーニング</span><span>{c.contractMode === "training" ? "なし" : <span className={`chip ${c.learningPlan === "premium" ? "prem" : ""}`}>{PLAN_LABEL[c.learningPlan] || c.learningPlan}</span>}</span></div>
            <div><span>期間</span><span className="num">{c.startMonth || c.endMonth ? `${c.startMonth || "?"}〜${c.endMonth || ""}` : "—"}</span></div>
            <div><span>AWSの演習（本物の環境）</span><span>{c.learningPlan === "premium" ? "使えます" : "Premium で使えます"}</span></div>
          </div>
        </section>
        <section className="card msec">
          <h2>受講</h2>
          <div className="rows">
            <div><span>受講生</span><span className="num">{d.learners.length}人</span></div>
            {seat && <>
              <div><span>スタンダードの枠</span><span className="num">{c.seats.standard.used} / {c.seats.standard.total}</span></div>
              <div><span>Premiumの枠</span><span className="num">{c.seats.premium.used} / {c.seats.premium.total}</span></div>
            </>}
          </div>
          <a className="btn ghost" href="#/quote" style={{ justifySelf: "start" }}>枠や契約の相談</a>
        </section>
      </div>
    </>
  );
}

/* ---------- 管理者の受講状況 ---------- */
export function AdminLearners({ rest, go }) {
  const [companyId, setCompanyId] = useState("");
  if (rest[1]) return <LearnerDetail userId={decodeURIComponent(rest[1])} go={go} backHref="#/manage/learners" backLabel="受講状況" showCompany />;
  return <AdminLearnersList companyId={companyId} setCompanyId={setCompanyId} go={go} />;
}

function AdminLearnersList({ companyId, setCompanyId, go }) {
  const q = useCompany(companyId);
  return (
    <>
      <Title eyebrow="LEARNERS" title="受講状況">
        <select className="msel" value={companyId} onChange={e => setCompanyId(e.target.value)} aria-label="企業">
          <option value="">すべての企業</option>
          {(q.data?.companies || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Title>
      {q.state === "loading" && !q.data ? <p className="muted">読み込んでいます…</p>
        : q.state === "error" ? <Fail onRetry={q.reload} />
          : <LearnersBlock d={q.data} go={go} base="#/manage/learners" showCompany={!companyId} />}
    </>
  );
}

/* ---------- 社員の一覧（両方で使う） ---------- */
function LearnersBlock({ d, go, base, showCompany }) {
  const [filter, setFilter] = useState("all");
  const coName = new Map((d.companies || []).map(c => [c.id, c.name]));
  // 最近動いた人から。まだ何もしていない人は後ろ
  const L = d.learners.filter(l => filter === "all" || l.state === filter).sort((a, b) => String(b.lastAt || "").localeCompare(String(a.lastAt || "")));
  const topics = shownTopics(d.topics, d.learners);
  return (
    <>
      <div className="tabs-h" role="tablist" style={{ marginBottom: 12 }}>
        {[["all", "すべて"], ["stop", "止まっている"], ["hint", "ヒント多め"], ["notyet", "未開始"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{l} {k !== "all" && <span className="num">{d.learners.filter(x => x.state === k).length}</span>}</button>)}
      </div>
      <section className="card flat" style={{ padding: "4px 8px" }}>
        {L.length ? (
          <div className="tblwrap"><table className="mtbl" style={{ minWidth: 640 }}>
            <thead><tr><th>社員</th>{showCompany && <th>企業</th>}<th>いま取り組んでいるコース</th><th>進み具合</th><th className="rt">演習</th><th>最後</th><th>状態</th></tr></thead>
            <tbody>
              {L.map(l => (
                <tr key={l.userId} onClick={() => go(`${base}/${encodeURIComponent(l.userId)}`)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") go(`${base}/${encodeURIComponent(l.userId)}`); }}>
                  <td style={{ whiteSpace: "nowrap" }}><b>{l.name || "社員"}</b></td>
                  {showCompany && <td style={{ whiteSpace: "nowrap" }}>{coName.get(l.companyId) || ""}</td>}
                  <td>{l.current?.title || <span className="muted">—</span>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{l.current ? <><span className="bar-p" style={{ width: 90, display: "inline-block", verticalAlign: "middle" }}><i style={{ width: `${l.current.progress}%` }} /></span> <span className="num" style={{ fontSize: 12 }}>{l.current.progress}%</span></> : "—"}</td>
                  <td className="rt num">{l.drills.cleared}</td>
                  <td className="muted num" style={{ whiteSpace: "nowrap", fontSize: 12 }}>{l.lastAt ? fmtTime(l.lastAt) : "—"}</td>
                  <td><span className={`chip ${STATE[l.state][1]}`}>{STATE[l.state][0]}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : <p className="muted" style={{ padding: 12 }}>いません。</p>}
      </section>
      <section className="card msec" style={{ marginTop: 16 }}><h2>スキル</h2><Heat learners={L} topics={topics} levelNames={d.levelNames} go={go} base={base} /></section>
    </>
  );
}

function Heat({ learners, topics, levelNames, go, base }) {
  if (!learners.length) return <p className="muted" style={{ margin: 0 }}>いません。</p>;
  return (
    <>
      <div className="tblwrap"><table className="mtbl skheat" style={{ minWidth: 120 + topics.length * 70 }}>
        <thead><tr><th />{topics.map(t => <th key={t.id} style={{ textAlign: "center" }}>{t.name}</th>)}</tr></thead>
        <tbody>
          {learners.slice(0, 60).map(l => (
            <tr key={l.userId} onClick={() => go(`${base}/${encodeURIComponent(l.userId)}`)}>
              <td style={{ whiteSpace: "nowrap" }}><b>{l.name || "社員"}</b></td>
              {topics.map(t => { const v = l.levels?.[t.id] || 0; return <td key={t.id} className="skc"><span className={`lv${v}`} title={levelNames[v]}>{v || "–"}</span></td>; })}
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="legend">{levelNames.map((n, i) => <span key={n}><i className={`lv${i}`} />{i} {n}</span>)}</div>
    </>
  );
}

/* ---------- 社員の詳細（両方で使う） ---------- */
function LearnerDetail({ userId, go, backHref, backLabel, showCompany }) {
  const [st, setSt] = useState({ state: "loading" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    setSt(s => ({ ...s, state: "loading" }));
    company.learner(userId).then(d => setSt({ state: "ready", data: d })).catch(e => setSt({ state: "error", status: e?.status }));
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  async function makeInsight() {
    setBusy(true); setErr("");
    try {
      const r = await company.insight(userId);
      setSt(s => ({ ...s, data: { ...s.data, insight: r.insight, insightStale: false } }));
    } catch (e) { setErr(e?.errorMessage || "コメントを作れませんでした。"); }
    finally { setBusy(false); }
  }
  // 開いたときに、記録が変わっていればAIのコメントを作り直す
  const stale = st.state === "ready" && st.data.insightStale;
  useEffect(() => { if (stale) makeInsight(); }, [stale]); // eslint-disable-line react-hooks/exhaustive-deps

  if (st.state === "loading" && !st.data) return <p className="muted">読み込んでいます…</p>;
  if (st.state === "error") return <><button type="button" className="back" onClick={() => go(backHref)}>← {backLabel}</button>{st.status === 404 ? <p className="muted">この社員は見つかりませんでした。</p> : <Fail onRetry={load} />}</>;
  const { learner: l, topics, levelNames, insight } = st.data;
  const shown = shownTopics(topics, [l]);
  const s = STATE[l.state];
  return (
    <>
      <div className="mttl">
        <div><button type="button" className="back" onClick={() => go(backHref)}>← {backLabel}</button><h1 className="h1" style={{ marginTop: 6 }}>{l.name || "社員"}</h1></div>
        <div className="r">{showCompany && l.companyName && <span className="chip">{l.companyName}</span>}<span className={`chip ${s[1]}`}>{s[0]}</span></div>
      </div>
      <div className="person">
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section className="card msec"><h2>スキル</h2>
            <Radar topics={shown} levels={l.levels} />
            <div className="rows">{shown.map(t => { const v = l.levels?.[t.id] || 0; return <div key={t.id}><span>{t.name}</span><span className={`chip lv${v}`} style={{ border: 0 }}>{levelNames[v]}</span></div>; })}</div>
          </section>
          <section className="card msec"><h2>つまずいているところ</h2>
            {l.stumbles?.length ? <ul className="tl">{l.stumbles.map((x, i) => <li key={i}><span>{x.kind === "test" ? "総合テスト" : x.kind === "drill" ? "演習" : "案件体験"}</span>{x.title}<span className="chip warn">{x.label}</span></li>)}</ul> : <p className="muted" style={{ margin: 0 }}>ありません。</p>}
          </section>
        </div>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section className="card msec">
            <div className="row"><h2>向いている案件</h2><span className="ai-tag" style={{ marginLeft: "auto" }}>AI</span>{insight?.at && <span className="muted" style={{ fontSize: 12 }}>{fmtTime(insight.at)}</span>}</div>
            {busy && <p className="muted" style={{ margin: 0 }}>学習の記録から考えています…</p>}
            {!busy && insight?.few && <div className="ev"><span className="chip">材料が足りない</span><span className="chip">修了・クリア 2つ未満</span></div>}
            {!busy && insight?.fits?.length > 0 && (
              <div className="fit">
                {insight.fits.map((f, i) => (
                  <article key={i} className={f.fit === "向いている" ? "top" : ""}>
                    <h3>{f.title} <span className={`chip ${f.fit === "向いている" ? "done" : "warn"}`}>{f.fit}</span></h3>
                    {f.skills && <span className="muted" style={{ fontSize: 12.5 }}>{f.skills}</span>}
                    <p>{f.note}</p>
                    {f.evidence?.length > 0 && <div className="ev">{f.evidence.map((e, j) => <span key={j} className="chip">{e}</span>)}</div>}
                  </article>
                ))}
              </div>
            )}
            {err && <div className="verdict ng" role="alert">{err} <button type="button" className="btn ghost" onClick={makeInsight}>もう一度</button></div>}
          </section>
          <section className="card msec"><h2>コース</h2>
            {l.courses?.length ? (
              <div className="rows">{l.courses.map(c => <div key={c.id}><span>{c.title}</span><span style={{ display: "flex", gap: 8, alignItems: "center" }}>{c.status === "completed" ? <span className="chip done">修了</span> : <><span className="bar-p" style={{ width: 80, display: "inline-block" }}><i style={{ width: `${c.progress}%` }} /></span><span className="num" style={{ fontSize: 12 }}>{c.progress}%</span></>}</span></div>)}</div>
            ) : <p className="muted" style={{ margin: 0 }}>まだありません。</p>}
          </section>
          <section className="card msec"><h2>演習と案件体験</h2>
            <div className="rows">
              <div><span>演習</span><span className="num">{l.drills.cleared} / {l.drills.total} クリア</span></div>
              {(l.caseList || []).map(c => <div key={c.id}><span>{c.title}</span><span className={`chip ${c.status === "approved" ? "done" : c.status === "returned" ? "ng" : "warn"}`}>{{ approved: "合格", returned: `やり直し ${c.fails}回`, skipped: "先に進んだ", submitted: "採点できず", doing: "取り組み中" }[c.status] || c.status}</span></div>)}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Radar({ topics, levels }) {
  const n = topics.length;
  if (n < 3) return null;
  const cx = 160, cy = 132, R = 92;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const vals = topics.map(t => levels?.[t.id] || 0);
  return (
    <svg className="radar" viewBox="0 0 320 270" role="img" aria-label="単元ごとのスキル">
      {[1, 2, 3, 4].map(k => <polygon key={k} points={topics.map((_, i) => pt(i, R * k / 4).join(",")).join(" ")} fill={k === 4 ? "#FBFBF7" : "none"} stroke="#E2E5DD" />)}
      {topics.map((t, i) => { const [x, y] = pt(i, R), [lx, ly] = pt(i, R + 18); return <g key={t.id}><line x1={cx} y1={cy} x2={x} y2={y} stroke="#E2E5DD" /><text x={lx} y={ly + 4} textAnchor={Math.abs(lx - cx) < 4 ? "middle" : lx > cx ? "start" : "end"} fontSize="12" fill="#454B57" fontWeight="700">{t.name}</text></g>; })}
      <polygon points={vals.map((v, i) => pt(i, R * Math.max(v, 0.15) / 4).join(",")).join(" ")} fill="rgba(255,225,77,.55)" stroke="#15171C" strokeWidth="1.5" />
      {vals.map((v, i) => { const [x, y] = pt(i, R * Math.max(v, 0.15) / 4); return <circle key={i} cx={x} cy={y} r="3.5" fill="#15171C" />; })}
    </svg>
  );
}
