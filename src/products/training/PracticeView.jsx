import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FileUp, Lightbulb, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../api.js";
import { Badge, Btn, Card, SectionHead, SkeletonRows, T } from "../../components/common";
import { getActiveCourseId, setActiveCourseId } from "../../utils/common/courseContext.js";
import { PRACTICE_FOCUS_KEY, practiceNumLabel as numLabel } from "./practiceLinks.js";

/* 練習問題（2026-10-20、モック docs/design/mockups/devhub-lms-2026-10/lms-practice.html）
   管理者・講師：問題と解答の Word を送る → AI が問題集にする（図・小問・解答・ヒントの下書き）→ 確かめて直す → 公開
   受講生：問題集を解く。ヒントは1つずつ開き、解答は開いて見る。「できた」を付ける。カリキュラムの単元からも入れる
   API は routes/practice.mjs */
const api = {
  list: c => apiGet(`/practice?courseId=${encodeURIComponent(c)}`),
  get: (c, id, view) => apiGet(`/practice/${encodeURIComponent(id)}?courseId=${encodeURIComponent(c)}${view ? `&view=${view}` : ""}`),
  create: (c, title) => apiPost("/practice", { courseId: c, title }),
  build: (c, id, body) => apiPost(`/practice/${encodeURIComponent(id)}/build?courseId=${encodeURIComponent(c)}`, body),
  job: (c, id, jobId) => apiGet(`/practice/${encodeURIComponent(id)}/jobs/${encodeURIComponent(jobId)}?courseId=${encodeURIComponent(c)}`),
  put: (c, id, body) => apiPut(`/practice/${encodeURIComponent(id)}?courseId=${encodeURIComponent(c)}`, body),
  publish: (c, id) => apiPost(`/practice/${encodeURIComponent(id)}/publish?courseId=${encodeURIComponent(c)}`, {}),
  hide: (c, id) => apiPost(`/practice/${encodeURIComponent(id)}/hide?courseId=${encodeURIComponent(c)}`, {}),
  del: (c, id) => apiDelete(`/practice/${encodeURIComponent(id)}?courseId=${encodeURIComponent(c)}`),
  done: (c, id, qid, done) => apiPut(`/practice/${encodeURIComponent(id)}/done?courseId=${encodeURIComponent(c)}`, { qid, done }),
};
// カリキュラムの単元から来たとき（practiceLinks.js の setPracticeFocus が置く）
function takeFocus() { try { const v = JSON.parse(sessionStorage.getItem(PRACTICE_FOCUS_KEY) || "null"); sessionStorage.removeItem(PRACTICE_FOCUS_KEY); return v; } catch { return null; } }

const TYPE = { answer: ["答える", "cyan"], build: ["作る", "ai"] };
const errText = e => e?.errorMessage || e?.message || "うまくいきませんでした。もう一度お試しください。";
const ascii = s => /^[\x20-\x7E\s]+$/.test(s || "");

const CSS = `
.pq{display:grid;gap:14px}
.pq-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px 16px;align-items:center;padding:16px 18px}
.pq-head h2{margin:0;font-size:19px;color:${T.textPrimary}}
.pq-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;color:${T.textSecondary}}
.pq-prog{display:grid;gap:4px;justify-items:end;font-size:12px;color:${T.textSecondary}}
.pq-bar{width:180px;height:8px;border-radius:99px;background:#EEF1F6;overflow:hidden}.pq-bar i{display:block;height:100%;background:${T.success}}
.pq-body{display:grid;grid-template-columns:220px minmax(0,1fr);gap:16px;align-items:start}
.pq-toc{position:sticky;top:12px;display:grid;gap:2px;padding:12px;font-size:13px}
.pq-ls{font-size:11px;font-weight:800;letter-spacing:.06em;color:${T.textMuted};padding:10px 8px 4px}.pq-ls:first-child{padding-top:2px}
.pq-ls span{display:block;font-size:12.5px;letter-spacing:0;color:${T.textSecondary}}
.pq-toc button{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left;border:0;background:none;border-radius:8px;padding:6px 8px;color:${T.textSecondary}}
.pq-toc button:hover{background:#F3F6FA}.pq-toc button[aria-current="true"]{background:${T.accentSubtle};color:${T.accent};font-weight:700}
.pq-ck{width:16px;height:16px;border-radius:50%;border:1.5px solid ${T.border};display:grid;place-items:center;font-size:10px;color:#fff}.pq-ck.on{background:${T.success};border-color:${T.success}}
.pq-ty{font-size:10.5px;font-weight:700;color:${T.textMuted}}
.pq-qs{display:grid;gap:16px;min-width:0}
.pq-lsn{display:flex;align-items:baseline;gap:10px;padding:4px 2px 0}.pq-lsn b{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:${T.accent}}.pq-lsn span{font-size:16px;font-weight:800;color:${T.textPrimary}}
.pq-lsn::after{content:"";flex:1;border-bottom:1px solid ${T.border};transform:translateY(-4px)}
.pq-q{padding:18px 20px;display:grid;gap:12px;scroll-margin-top:12px}
.pq-qh{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.pq-qh h3{margin:0;font-size:16.5px;color:${T.textPrimary}}
.pq-no{font-family:ui-monospace,Consolas,monospace;font-size:12px;font-weight:700;color:#fff;background:${T.textPrimary};border-radius:7px;padding:2px 8px}
.pq-lead{margin:0;font-size:14px;color:${T.textSecondary};white-space:pre-line;line-height:1.75}
.pq-subs{display:grid;border:1px solid ${T.border};border-radius:12px;overflow:hidden}
.pq-subs>div{display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;padding:10px 14px;font-size:13.5px;border-top:1px solid #EEF1F6;white-space:pre-line;color:${T.textPrimary}}.pq-subs>div:first-child{border-top:0}
.pq-subs b{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;color:${T.accent}}
.pq-fig{display:grid;gap:6px;justify-items:center;margin:0}
.pq-fig img{max-width:min(100%,var(--mw,760px));height:auto;border:1px solid ${T.border};border-radius:10px;background:#fff;cursor:zoom-in}
.pq-fig figcaption{font-size:12px;color:${T.textSecondary}}
.pq-figs{display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap}.pq-figs .pq-fig{flex:1 1 220px}.pq-arrow{font-size:22px;color:${T.textMuted}}
.pq-cells{display:grid;gap:14px;align-items:start;grid-template-columns:repeat(var(--n,2),minmax(0,1fr))}.pq-cells>div{display:grid;gap:10px;min-width:0}
.pq-list{display:grid;gap:6px;padding:12px 14px;border-radius:12px;background:#F6F8FB;border:1px solid #EEF1F6;font-size:13.5px;color:${T.textPrimary}}
.pq-list b{font-size:12px;color:${T.textSecondary}}.pq-list ul{margin:0;padding-left:1.2em;display:grid;gap:3px}
.pq-note{font-size:12.5px;color:${T.warning};font-weight:700;white-space:pre-line}
.pq-code{background:#151923;color:#E6E9F1;border-radius:12px;font-family:ui-monospace,Consolas,monospace;font-size:12.5px;line-height:1.75;overflow:hidden}
.pq-code .fn{display:flex;gap:8px;align-items:center;padding:6px 12px;background:#0E1118;color:#7D869C;font-size:12px}.pq-code .fn b{color:#E6E9F1;font-weight:600}.pq-code .fn span{margin-left:auto}
.pq-code pre{margin:0;padding:8px 0;white-space:pre;overflow:auto;max-height:420px}.pq-code .ln{display:block;padding:0 12px}.pq-code .ln i{font-style:normal;color:#4B5468;display:inline-block;width:28px;user-select:none}
.pq-code .k{color:#FF8C7A}.pq-code .s{color:#9FE3B3}.pq-code .c{color:#6C7891}
.pq-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-top:1px solid #EEF1F6;padding-top:12px}
.pq-hintbtn{border:1px solid #E8C25A;background:#FFF8E1;color:#7A5A00;border-radius:10px;padding:6px 14px;font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:6px}.pq-hintbtn:disabled{opacity:.55}
.pq-hintbtn small{font-weight:600;font-size:11.5px}
.pq-ansbtn{border:1px solid ${T.border};background:#fff;color:${T.textSecondary};border-radius:10px;padding:6px 14px;font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:6px}
.pq-ansbtn[aria-expanded="true"]{border-color:${T.textPrimary};color:${T.textPrimary}}.pq-ansbtn[aria-expanded="true"] svg{transform:rotate(180deg)}
.pq-donebtn{margin-left:auto;border:1px solid ${T.border};background:#fff;color:${T.textSecondary};border-radius:10px;padding:6px 14px;font-weight:700;font-size:13px}.pq-donebtn.on{border-color:${T.success};background:${T.successSubtle};color:${T.success}}
.pq-hints{display:grid;gap:8px}
.pq-hint{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start;padding:10px 14px;border-radius:12px;background:#FFF8E1;border:1px solid #F1D98A;font-size:13.5px;color:${T.textPrimary}}
.pq-hn{font-size:11.5px;font-weight:800;color:#7A5A00;background:#FFE9A8;border-radius:6px;padding:1px 8px;white-space:nowrap}
.pq-ans{display:grid;gap:8px;padding:12px 14px;border-radius:12px;border:1px solid #BFE3CF;background:${T.successSubtle}}
.pq-ans>b{font-size:12px;color:${T.success}}
.pq-rows{display:grid}.pq-rows>div{display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;padding:5px 0;border-top:1px dashed #BFE3CF;font-size:13.5px}.pq-rows>div:first-child{border-top:0}
.pq-rows i{font-style:normal;font-family:ui-monospace,Consolas,monospace;font-size:12.5px;color:${T.success};font-weight:700}
.pq-rows span{display:grid;gap:1px}.pq-rows .a1{font-weight:700;white-space:pre-line;color:${T.textPrimary}}.pq-rows small{color:${T.textSecondary};font-size:12.5px}
.pq-ans code,.pq-hint code{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;background:#fff;border:1px solid #E3E8EF;border-radius:5px;padding:0 5px}
.pq-why{font-size:12.5px;color:${T.textSecondary};white-space:pre-line}
.pq-pts{display:grid;gap:4px;font-size:13px}.pq-pts b{font-size:12px;color:${T.success}}.pq-pts ul{margin:0;padding-left:1.2em;display:grid;gap:2px}
.pq-zoom{position:fixed;inset:0;background:rgba(10,14,24,.72);display:grid;place-items:center;padding:24px;z-index:80}.pq-zoom img{max-width:min(1200px,100%);max-height:100%;border-radius:10px;background:#fff}
.pq-sets{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.pq-set{text-align:left;border:1px solid ${T.border};background:#fff;border-radius:16px;padding:16px;display:grid;gap:8px;color:inherit}.pq-set:hover{border-color:${T.accent}}
.pq-set b{font-size:15px;color:${T.textPrimary}}
.pq-warn{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:start;padding:8px 12px;border-radius:10px;background:${T.warningSubtle};color:${T.warning};font-size:12.5px;font-weight:700}
.pq-ed{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;align-items:start}
.pq-in{width:100%;border:1px solid ${T.border};border-radius:8px;padding:6px 8px;font-size:13px;background:#fff;color:${T.textPrimary}}
.pq-hrow{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:start}
.pq-arow{display:grid;grid-template-columns:44px minmax(0,.8fr) minmax(0,1.2fr);gap:8px;align-items:start}
.pq-arow b{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;color:${T.accent};padding-top:6px}
.pq-x{border:0;background:none;color:${T.textMuted};font-size:16px;padding:2px 6px}
.pq-drop{display:grid;gap:10px;padding:16px;border:2px dashed ${T.border};border-radius:14px;background:#F6F8FB}
.pq-file{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13px}
.pq-file label{font-weight:700;color:${T.textSecondary};min-width:110px}
@media (max-width:1000px){.pq-body,.pq-ed{grid-template-columns:1fr}.pq-toc{position:static}.pq-cells{grid-template-columns:1fr}}
@media (max-width:560px){.pq-head{grid-template-columns:1fr}.pq-prog{justify-items:start}.pq-arow{grid-template-columns:36px minmax(0,1fr)}.pq-arow textarea{grid-column:2}}
`;
export const Style = () => <style>{CSS}</style>;

/* ---- 部品 ---- */
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// 1回でまとめて置きかえる（順に置きかえると、先に入れた <span class="k"> の "k" を文字列として拾ってしまう。2026-10-20）
const hl = l => esc(l).replace(/(\/\*.*?\*\/|&lt;!--.*?--&gt;)|(&lt;\/?[!a-zA-Z0-9-]+)|("[^"\n]*")/g, (m, c, k, str) => (c ? `<span class="c">${c}</span>` : k ? `<span class="k">${k}</span>` : `<span class="s">${str}</span>`));
function CodeBlock({ fn, code }) {
  const lines = String(code || "").split("\n");
  return (
    <div className="pq-code"><div className="fn"><b>{fn || "コード"}</b><span>{lines.length} 行</span></div>
      <pre>{lines.map((l, i) => <span key={i} className="ln"><i>{i + 1}</i><span dangerouslySetInnerHTML={{ __html: hl(l) }} /></span>)}</pre>
    </div>
  );
}
// `code` を <code> に
function Rich({ text }) {
  const parts = String(text || "").split(/(`[^`]+`)/g);
  return <>{parts.map((p, i) => (p.startsWith("`") && p.endsWith("`") && p.length > 2 ? <code key={i}>{p.slice(1, -1)}</code> : <React.Fragment key={i}>{p}</React.Fragment>))}</>;
}
function Fig({ img, caption, images, onZoom }) {
  const im = images?.[img];
  if (!im?.url) return null;
  const mw = im.w ? Math.min(760, Math.max(240, Math.round(im.w * 0.75))) : 760;
  return (
    <figure className="pq-fig" style={{ "--mw": `${mw}px` }}>
      <img src={im.url} alt={caption || "問題の図"} loading="lazy" onClick={() => onZoom(im.url)} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
function Items({ items, images, onZoom }) {
  return (items || []).map((it, i) => {
    if (it.t === "text") return <p key={i} className="pq-lead">{it.text}</p>;
    if (it.t === "note") return <div key={i} className="pq-note">{it.text}</div>;
    if (it.t === "subs") return <div key={i} className="pq-subs">{it.items.map((s, si) => <div key={si}><b>({si + 1})</b><span>{s}</span></div>)}</div>;
    if (it.t === "figure") return <Fig key={i} img={it.img} caption={it.caption} images={images} onZoom={onZoom} />;
    if (it.t === "figures") return <div key={i} className="pq-figs">{it.items.map((f, fi) => <React.Fragment key={fi}>{fi > 0 && <span className="pq-arrow" aria-hidden="true">→</span>}<Fig img={f.img} caption={f.caption} images={images} onZoom={onZoom} /></React.Fragment>)}</div>;
    if (it.t === "code") return <CodeBlock key={i} fn={it.fn} code={it.code} />;
    if (it.t === "list") return <div key={i} className="pq-list">{it.title && <b>■ {it.title}</b>}<ul>{it.items.map((x, xi) => <li key={xi}>{x}</li>)}</ul></div>;
    if (it.t === "cells") return <div key={i} className="pq-cells" style={{ "--n": it.cells.length }}>{it.cells.map((c, ci) => <div key={ci}><Items items={c} images={images} onZoom={onZoom} /></div>)}</div>;
    return null;
  });
}
function Answer({ a }) {
  return (
    <div className="pq-ans"><b>{a.files?.length ? "模範解答" : "解答・解説"}</b>
      {a.rows?.length > 0 && <div className="pq-rows">{a.rows.map((r, i) => <div key={i}><i>({i + 1})</i><span><span className="a1">{ascii(r[0]) ? <code>{r[0]}</code> : r[0]}</span>{r[1] && <small>{r[1]}</small>}</span></div>)}</div>}
      {(a.notes || []).map((t, i) => <div key={i} className="pq-why">{t}</div>)}
      {(a.files || []).map((f, i) => <CodeBlock key={i} fn={f.fn} code={f.code} />)}
      {a.points?.length > 0 && <div className="pq-pts"><b>ポイント</b><ul>{a.points.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
    </div>
  );
}

/* ---- 問題のページ（受講生・講師の「受講生の見え方」） ---- */
export function Sheet({ meta, set, done = {}, onDone, focusQ, showAnswers = true }) {
  const [hints, setHints] = useState({});
  const [ans, setAns] = useState({});
  const [cur, setCur] = useState(focusQ || set.lessons[0]?.questions[0]?.id || "");
  const [zoom, setZoom] = useState("");
  const qs = set.lessons.flatMap(l => l.questions);
  const doneN = qs.filter(q => done[q.id]).length;
  useEffect(() => { if (focusQ) setTimeout(() => document.getElementById(`pq-${focusQ}`)?.scrollIntoView({ block: "start" }), 60); }, [focusQ]);
  useEffect(() => { const k = e => e.key === "Escape" && setZoom(""); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const jump = id => { setCur(id); document.getElementById(`pq-${id}`)?.scrollIntoView({ block: "start", behavior: "smooth" }); };
  const counts = { answer: qs.filter(q => q.type === "answer").length, build: qs.filter(q => q.type === "build").length };
  return (
    <div className="pq">
      <Card className="pq-head">
        <div><h2>{set.title || meta?.title || "練習問題"}</h2>
          <div className="pq-meta"><Badge tone="cyan">答える {counts.answer}</Badge><Badge tone="muted" style={{ background: T.aiSubtle, color: T.aiAccentDeep }}>作る {counts.build}</Badge><span>{set.lessons.map(l => l.no).filter(Boolean).join("・")}</span></div></div>
        {onDone && <div className="pq-prog"><span>{doneN} / {qs.length} できた</span><span className="pq-bar"><i style={{ width: `${qs.length ? Math.round(doneN / qs.length * 100) : 0}%` }} /></span></div>}
      </Card>
      <div className="pq-body">
        <Card className="pq-toc" role="navigation" aria-label="問題の目次">
          {set.lessons.map(l => (
            <React.Fragment key={l.id}>
              <div className="pq-ls">{l.no}<span>{l.name}</span></div>
              {l.questions.map(q => (
                <button key={q.id} type="button" aria-current={cur === q.id} onClick={() => jump(q.id)}>
                  <span className={`pq-ck ${done[q.id] ? "on" : ""}`}>{done[q.id] ? "✓" : ""}</span><span>問題{q.n} {q.title}</span><span className="pq-ty">{TYPE[q.type][0]}</span>
                </button>
              ))}
            </React.Fragment>
          ))}
        </Card>
        <div className="pq-qs">
          {set.lessons.map(l => (
            <React.Fragment key={l.id}>
              <div className="pq-lsn"><b>{l.no}</b><span>{l.name}</span></div>
              {l.questions.map(q => {
                const n = hints[q.id] || 0, open = !!ans[q.id], hasAns = showAnswers && !!q.answer;
                return (
                  <Card key={q.id} id={`pq-${q.id}`} className="pq-q" style={cur === q.id ? { boxShadow: `0 0 0 2px ${T.accentSubtle}` } : undefined}>
                    <div className="pq-qh"><span className="pq-no">問題{q.n}</span><h3>{q.title}</h3><Badge tone={TYPE[q.type][1] === "ai" ? "muted" : "cyan"} style={TYPE[q.type][1] === "ai" ? { background: T.aiSubtle, color: T.aiAccentDeep } : undefined}>{TYPE[q.type][0]}</Badge>{done[q.id] && <Badge tone="green">✓ できた</Badge>}</div>
                    <Items items={q.parts} images={set.images} onZoom={setZoom} />
                    {n > 0 && <div className="pq-hints">{q.hints.slice(0, n).map((h, i) => <div key={i} className="pq-hint"><span className="pq-hn">ヒント {i + 1}</span><span><Rich text={h} /></span></div>)}</div>}
                    {open && hasAns && <Answer a={q.answer} />}
                    <div className="pq-foot">
                      {q.hints.length > 0 && <button type="button" className="pq-hintbtn" disabled={n >= q.hints.length} onClick={() => { setCur(q.id); setHints(h => ({ ...h, [q.id]: n + 1 })); }}><Lightbulb size={14} />{n ? "次のヒント" : "ヒントを見る"}<small>{n} / {q.hints.length}</small></button>}
                      {hasAns ? <button type="button" className="pq-ansbtn" aria-expanded={open} onClick={() => { setCur(q.id); setAns(a => ({ ...a, [q.id]: !open })); }}>解答<ChevronDown size={14} /></button> : <Badge tone="muted">解答は講師が確認</Badge>}
                      {onDone && <button type="button" className={`pq-donebtn ${done[q.id] ? "on" : ""}`} onClick={() => onDone(q.id, !done[q.id])}>{done[q.id] ? "✓ できた" : "できた"}</button>}
                    </div>
                  </Card>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      {zoom && <div className="pq-zoom" role="dialog" aria-label="図を大きく" onClick={() => setZoom("")}><img src={zoom} alt="" /></div>}
    </div>
  );
}

/* ---- 受講生 ---- */
function TraineeHome({ courseId, coursePick, focus }) {
  const [st, setSt] = useState({ state: "loading", items: [] });
  const [open, setOpen] = useState(focus?.courseId === courseId ? focus : null);
  const load = () => { setSt(s => ({ ...s, state: "loading" })); api.list(courseId).then(r => setSt({ state: "ok", items: r.items || [] }), () => setSt({ state: "error", items: [] })); };
  useEffect(load, [courseId]);
  if (open) return <TraineeSheet courseId={courseId} id={open.setId} focusQ={open.qid} back={() => { setOpen(null); load(); }} />;
  return (
    <div className="pq">
      <SectionHead title="練習問題" action={coursePick} />
      {st.state === "loading" ? <Card className="p-4"><SkeletonRows rows={3} /></Card>
        : st.state === "error" ? <Card className="p-4 text-sm" style={{ color: T.danger }}>練習問題を読み込めませんでした。<button type="button" className="ml-2 font-bold" style={{ color: T.accent }} onClick={load}>もう一度</button></Card>
        : !st.items.length ? <Card className="p-6 text-center text-sm" style={{ color: T.textMuted }}>まだ練習問題はありません</Card>
        : <div className="pq-sets">{st.items.map(s => (
          <button key={s.id} type="button" className="pq-set" onClick={() => setOpen({ setId: s.id })}>
            <b>{s.title}</b>
            <span className="pq-meta"><Badge tone="cyan">答える {s.counts?.answer || 0}</Badge><Badge tone="muted" style={{ background: T.aiSubtle, color: T.aiAccentDeep }}>作る {s.counts?.build || 0}</Badge><span>{(s.lessons || []).map(l => l.no).filter(Boolean).join("・")}</span></span>
            <span className="pq-bar" style={{ width: "100%" }}><i style={{ width: `${s.counts?.questions ? Math.round((s.doneCount || 0) / s.counts.questions * 100) : 0}%` }} /></span>
            <span className="pq-meta">{s.doneCount || 0} / {s.counts?.questions || 0} できた</span>
          </button>
        ))}</div>}
    </div>
  );
}
function TraineeSheet({ courseId, id, focusQ, back }) {
  const [st, setSt] = useState({ state: "loading" });
  const [done, setDone] = useState({});
  useEffect(() => { api.get(courseId, id).then(r => { setSt({ state: "ok", ...r }); setDone(r.done || {}); }, () => setSt({ state: "error" })); }, [courseId, id]);
  const mark = (qid, v) => { setDone(d => ({ ...d, [qid]: v })); api.done(courseId, id, qid, v).then(r => setDone(r.done || {})).catch(() => setDone(d => ({ ...d, [qid]: !v }))); };
  return (
    <div className="pq">
      <div><button type="button" className="text-sm font-bold" style={{ color: T.accent }} onClick={back}>← 練習問題の一覧</button></div>
      {st.state === "loading" ? <Card className="p-4"><SkeletonRows rows={5} /></Card>
        : st.state === "error" || !st.set ? <Card className="p-4 text-sm" style={{ color: T.danger }}>練習問題を読み込めませんでした。</Card>
        : <Sheet meta={st.item} set={st.set} done={done} onDone={mark} focusQ={focusQ} showAnswers={st.item?.showAnswers !== false} />}
    </div>
  );
}

/* ---- 管理者・講師 ---- */
const STATUS = { new: ["Word を送る前", "muted"], building: ["AI が作っています", "amber"], draft: ["下書き", "amber"], published: ["公開中", "green"] };
async function waitJob(courseId, id, jobId, onTick) {
  for (let i = 0; i < 120; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise(r => setTimeout(r, 5000)); // 2026-10-21: 3秒→5秒（ADR 0031）
    // eslint-disable-next-line no-await-in-loop
    const r = await api.job(courseId, id, jobId);
    if (r.status === "done") return r;
    if (r.status === "error") throw new Error(r.error || "問題集にできませんでした。");
    onTick?.(i);
  }
  throw new Error("時間がかかりすぎています。少し待ってから開き直してください。");
}
async function putFile(url, file, contentType) {
  const r = await fetch(url, { method: "PUT", headers: { "content-type": contentType }, body: file });
  if (!r.ok) throw new Error(`「${file.name}」を送れませんでした（${r.status}）。`);
}

function CreatePanel({ courseId, onMade, cancel }) {
  const [title, setTitle] = useState("");
  const [prob, setProb] = useState(null);
  const [ans, setAns] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const isDocx = f => !f || /\.docx$/i.test(f.name);
  async function make() {
    if (!prob) { setErr("問題の Word を選んでください。"); return; }
    if (!isDocx(prob) || !isDocx(ans)) { setErr("Word（.docx）を選んでください。"); return; }
    setErr(""); setBusy("Word を送っています…");
    try {
      const c = await api.create(courseId, title.trim());
      await putFile(c.uploads.problem, prob, c.uploads.contentType);
      if (ans) await putFile(c.uploads.answer, ans, c.uploads.contentType);
      setBusy("AI が問題集にしています…（30秒〜1分ほど）");
      const { jobId } = await api.build(courseId, c.item.id, { hasAnswer: !!ans, problemName: prob.name, answerName: ans?.name || "" });
      await waitJob(courseId, c.item.id, jobId, i => setBusy(`AI が問題集にしています…（${(i + 1) * 5}秒）`));
      onMade(c.item.id);
    } catch (e) { setErr(errText(e)); setBusy(""); }
  }
  return (
    <Card className="grid gap-3 p-5">
      <div className="flex items-center gap-2"><b style={{ color: T.textPrimary }}>練習問題を作る</b><span className="text-xs" style={{ color: T.textMuted }}>問題と解答の Word を送るだけ</span></div>
      <div className="pq-drop">
        <div className="pq-file"><label htmlFor="pq-prob">問題（必須）</label><input id="pq-prob" type="file" accept=".docx" disabled={!!busy} onChange={e => setProb(e.target.files?.[0] || null)} /></div>
        <div className="pq-file"><label htmlFor="pq-ans">解答（あれば）</label><input id="pq-ans" type="file" accept=".docx" disabled={!!busy} onChange={e => setAns(e.target.files?.[0] || null)} /></div>
        <div className="pq-file"><label htmlFor="pq-title">題名（空なら Word から）</label><input id="pq-title" className="pq-in" style={{ maxWidth: 420 }} value={title} disabled={!!busy} onChange={e => setTitle(e.target.value.slice(0, 120))} placeholder="例）HTML / CSS 基本のき 練習問題" /></div>
      </div>
      {err && <div className="text-sm font-bold" style={{ color: T.danger }} role="alert">{err}</div>}
      {busy && <div className="text-sm font-bold" style={{ color: T.aiAccentDeep }} role="status">{busy}</div>}
      <div className="flex flex-wrap gap-2">
        <Btn kind="ai" icon={FileUp} disabled={!!busy} onClick={make}>問題集を作る</Btn>
        <Btn kind="ghost" disabled={!!busy} onClick={cancel}>やめる</Btn>
      </div>
    </Card>
  );
}

function Editor({ courseId, id, back }) {
  const [st, setSt] = useState({ state: "loading" });
  const [set, setSet] = useState(null);
  const [meta, setMeta] = useState(null);
  const [sections, setSections] = useState([]);
  const [qid, setQid] = useState("");
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });
  useEffect(() => {
    api.get(courseId, id).then(r => { setMeta(r.item); setSet(r.set); setQid(r.set?.lessons?.[0]?.questions?.[0]?.id || ""); setSt({ state: "ok" }); }, () => setSt({ state: "error" }));
    apiGet(`/courses/${encodeURIComponent(courseId)}/curriculum`).then(c => setSections((c?.sections || []).map(s => ({ id: s.id, title: s.title || s.categoryTitle || "" })).filter(s => s.id))).catch(() => setSections([]));
  }, [courseId, id]);
  const q = useMemo(() => set?.lessons.flatMap(l => l.questions).find(x => x.id === qid) || null, [set, qid]);
  const edit = fn => { setSet(s => { const n = structuredClone(s); fn(n); return n; }); setDirty(true); };
  const editQ = fn => edit(n => { for (const l of n.lessons) for (const x of l.questions) if (x.id === qid) fn(x); });
  async function save(andPublish) {
    setBusy(andPublish ? "公開しています…" : "保存しています…"); setMsg({ kind: "", text: "" });
    try {
      let r = await api.put(courseId, id, { title: set.title, lessons: set.lessons, warnings: set.warnings || [], showAnswers: meta.showAnswers !== false });
      if (andPublish) r = await api.publish(courseId, id);
      setMeta(r.item); setDirty(false);
      setMsg({ kind: "ok", text: andPublish ? "公開しました。受講生の「練習問題」とカリキュラムに出ます。" : "保存しました。" });
    } catch (e) { setMsg({ kind: "ng", text: errText(e) }); }
    setBusy("");
  }
  async function hide() { setBusy("…"); try { const r = await api.hide(courseId, id); setMeta(r.item); setMsg({ kind: "ok", text: "公開をやめました。" }); } catch (e) { setMsg({ kind: "ng", text: errText(e) }); } setBusy(""); }
  async function remove() {
    if (!window.confirm || !window.confirm("この練習問題を消しますか？ 受講生の「できた」も見えなくなります。")) return;
    try { await api.del(courseId, id); back(); } catch (e) { setMsg({ kind: "ng", text: errText(e) }); }
  }
  if (st.state === "loading") return <Card className="p-4"><SkeletonRows rows={5} /></Card>;
  if (st.state === "error" || !set) return <Card className="p-4 text-sm" style={{ color: T.danger }}>練習問題を読み込めませんでした。<button type="button" className="ml-2 font-bold" style={{ color: T.accent }} onClick={back}>一覧へ</button></Card>;
  const [stLabel, stTone] = STATUS[meta?.status] || STATUS.draft;
  return (
    <div className="pq">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="text-sm font-bold" style={{ color: T.accent }} onClick={back}>← 練習問題の一覧</button>
        <Badge tone={stTone}>{stLabel}</Badge>{meta?.hasDraftChanges && <Badge tone="amber">公開中のものと違う下書き</Badge>}
        <span className="ml-auto flex flex-wrap gap-2">
          <Btn kind="ghost" size="sm" onClick={() => setPreview(p => !p)}>{preview ? "直す画面へ" : "受講生の見え方"}</Btn>
          <Btn kind="ghost" size="sm" disabled={!!busy || !dirty} onClick={() => save(false)}>保存</Btn>
          <Btn kind="primary" size="sm" disabled={!!busy} onClick={() => save(true)}>{meta?.status === "published" ? "公開し直す" : "公開する"}</Btn>
          {meta?.status === "published" && <Btn kind="ghost" size="sm" disabled={!!busy} onClick={hide}>公開をやめる</Btn>}
          <Btn kind="ghost" size="sm" icon={Trash2} aria-label="消す" onClick={remove} />
        </span>
      </div>
      {msg.text && <div className="text-sm font-bold" style={{ color: msg.kind === "ok" ? T.success : T.danger }} role="status">{msg.text}</div>}
      {preview ? <Sheet meta={meta} set={set} showAnswers={meta?.showAnswers !== false} /> : <>
        <Card className="grid gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input className="pq-in" style={{ maxWidth: 480, fontWeight: 700, fontSize: 15 }} value={set.title} aria-label="題名" onChange={e => edit(n => { n.title = e.target.value.slice(0, 120); })} />
            <label className="flex items-center gap-1.5 text-sm" style={{ color: T.textSecondary }}><input type="checkbox" checked={meta?.showAnswers !== false} onChange={e => { setMeta(m => ({ ...m, showAnswers: e.target.checked })); setDirty(true); }} />受講生に解答を見せる</label>
            {set.source?.problem && <span className="text-xs" style={{ color: T.textMuted }}>元：{set.source.problem}{set.source.answer ? ` ・ ${set.source.answer}` : ""}</span>}
          </div>
          {(set.warnings || []).map((w, i) => (
            <div key={i} className="pq-warn"><span>!</span><span>{w}</span><button type="button" className="pq-x" aria-label="この注意を消す" onClick={() => edit(n => { n.warnings.splice(i, 1); })}>×</button></div>
          ))}
          <div className="grid gap-2">
            {set.lessons.map((l, li) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                <b style={{ color: T.textPrimary, minWidth: 220 }}>{l.no} {l.name}</b>
                <select className="pq-in" style={{ maxWidth: 320 }} value={l.sectionId || ""} aria-label={`${l.no} と結ぶカリキュラムの単元`} onChange={e => edit(n => { n.lessons[li].sectionId = e.target.value; })}>
                  <option value="">カリキュラムと結ばない</option>
                  {sections.map(s => <option key={s.id} value={s.id}>カリキュラム：{s.title}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Card>
        <div className="pq-ed">
          <Card className="pq-toc" role="navigation" aria-label="問題">
            {set.lessons.map(l => (
              <React.Fragment key={l.id}>
                <div className="pq-ls">{l.no}<span>{l.name}</span></div>
                {l.questions.map(x => (
                  <button key={x.id} type="button" aria-current={qid === x.id} onClick={() => setQid(x.id)}>
                    <span className={`pq-ck ${x.answer ? "on" : ""}`}>{x.answer ? "✓" : ""}</span><span>問題{x.n} {x.title}</span><span className="pq-ty">ヒント{x.hints.length}</span>
                  </button>
                ))}
              </React.Fragment>
            ))}
          </Card>
          {q && <div className="grid gap-3">
            <Card className="grid gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pq-no">問題{q.n}</span>
                <input className="pq-in" style={{ maxWidth: 360, fontWeight: 700 }} value={q.title} aria-label="問題の名前" onChange={e => editQ(x => { x.title = e.target.value.slice(0, 80); })} />
                <select className="pq-in" style={{ maxWidth: 120 }} value={q.type} aria-label="問題の種類" onChange={e => editQ(x => { x.type = e.target.value; })}><option value="answer">答える</option><option value="build">作る</option></select>
              </div>
              <div className="grid gap-3 rounded-xl p-3" style={{ border: `1px solid ${T.border}` }}><Items items={q.parts} images={set.images} onZoom={() => {}} /></div>
            </Card>
            <Card className="grid gap-2 p-4">
              <div className="flex items-center gap-2"><b style={{ color: T.textPrimary }}>ヒント</b><Badge tone="muted" style={{ background: T.aiSubtle, color: T.aiAccentDeep }}>AI の下書き</Badge><span className="text-xs" style={{ color: T.textMuted }}>受講生は上から1つずつ開く</span></div>
              {q.hints.map((h, i) => (
                <div key={i} className="pq-hrow"><span className="pq-hn">ヒント {i + 1}</span>
                  <textarea className="pq-in" rows={2} value={h} aria-label={`ヒント ${i + 1}`} onChange={e => editQ(x => { x.hints[i] = e.target.value.slice(0, 300); })} />
                  <button type="button" className="pq-x" aria-label={`ヒント ${i + 1} を消す`} onClick={() => editQ(x => { x.hints.splice(i, 1); })}>×</button>
                </div>
              ))}
              {q.hints.length < 6 && <button type="button" className="justify-self-start text-sm font-bold" style={{ color: T.accent }} onClick={() => editQ(x => { x.hints.push(""); })}>＋ ヒントを足す</button>}
            </Card>
            <Card className="grid gap-2 p-4">
              <div className="flex items-center gap-2"><b style={{ color: T.textPrimary }}>解答</b><span className="text-xs" style={{ color: T.textMuted }}>{q.answer ? "解答の Word から" : "解答の Word にこの問題がありませんでした"}</span></div>
              {q.answer?.rows?.map((r, i) => (
                <div key={i} className="pq-arow"><b>({i + 1})</b>
                  <textarea className="pq-in" rows={1} value={r[0]} aria-label={`(${i + 1}) の解答`} onChange={e => editQ(x => { x.answer.rows[i][0] = e.target.value; })} />
                  <textarea className="pq-in" rows={1} value={r[1]} aria-label={`(${i + 1}) の解説`} onChange={e => editQ(x => { x.answer.rows[i][1] = e.target.value; })} />
                </div>
              ))}
              {q.answer?.files?.map((f, i) => <CodeBlock key={i} fn={f.fn} code={f.code} />)}
              {q.answer?.points?.length > 0 && <div className="pq-list"><b>■ ポイント</b><ul>{q.answer.points.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
            </Card>
          </div>}
        </div>
      </>}
    </div>
  );
}

function TeacherHome({ courseId, coursePick }) {
  const [st, setSt] = useState({ state: "loading", items: [] });
  const [making, setMaking] = useState(false);
  const [open, setOpen] = useState("");
  const load = () => { setSt(s => ({ ...s, state: "loading" })); api.list(courseId).then(r => setSt({ state: "ok", items: r.items || [] }), () => setSt({ state: "error", items: [] })); };
  useEffect(() => { load(); setOpen(""); setMaking(false); }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (open) return <Editor courseId={courseId} id={open} back={() => { setOpen(""); load(); }} />;
  return (
    <div className="pq">
      <SectionHead title="練習問題" action={<div className="flex flex-wrap items-center gap-2">{coursePick}{!making && <Btn kind="ai" icon={FileUp} onClick={() => setMaking(true)}>練習問題を作る</Btn>}</div>} />
      {making && <CreatePanel courseId={courseId} cancel={() => setMaking(false)} onMade={id => { setMaking(false); setOpen(id); }} />}
      {st.state === "loading" ? <Card className="p-4"><SkeletonRows rows={3} /></Card>
        : st.state === "error" ? <Card className="p-4 text-sm" style={{ color: T.danger }}>練習問題を読み込めませんでした。<button type="button" className="ml-2 font-bold" style={{ color: T.accent }} onClick={load}>もう一度</button></Card>
        : !st.items.length ? (!making && <Card className="p-6 text-center text-sm" style={{ color: T.textMuted }}>まだ練習問題はありません。「練習問題を作る」から、問題と解答の Word を送ってください。</Card>)
        : <div className="pq-sets">{st.items.map(s => {
          const [label, tone] = STATUS[s.status] || STATUS.draft;
          return (
            <button key={s.id} type="button" className="pq-set" disabled={s.status === "new" || s.status === "building"} onClick={() => setOpen(s.id)}>
              <span className="pq-meta"><Badge tone={tone}>{label}</Badge>{s.hasDraftChanges && <Badge tone="amber">下書きに変更あり</Badge>}</span>
              <b>{s.title || "（題名なし）"}</b>
              <span className="pq-meta"><span>問題 {s.counts?.questions || 0}</span><span>・解答 {s.counts?.answers || 0}</span><span>・ヒント {s.counts?.hints || 0}</span></span>
              <span className="pq-meta">{(s.lessons || []).map(l => `${l.no} ${numLabel(l.nums)}`).join(" ／ ")}</span>
              {s.warnings?.length > 0 && <span className="pq-meta" style={{ color: T.warning, fontWeight: 700 }}>注意 {s.warnings.length}件</span>}
            </button>
          );
        })}</div>}
    </div>
  );
}

function CoursePick({ courses, value, onChange }) {
  if (courses.length < 2) return null;
  return <select value={value} onChange={e => onChange(e.target.value)} aria-label="コース" className="rounded-xl px-3 py-2 text-sm" style={{ border: `1px solid ${T.border}`, background: "#fff", color: T.textPrimary }}>{courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name || c.title || c.courseId}</option>)}</select>;
}

export default function PracticeView({ role }) {
  const teacher = role === "admin" || role === "instructor";
  const focus = useRef(takeFocus()).current;
  const [courses, setCourses] = useState(null);
  const [courseId, setCourseId] = useState(focus?.courseId || getActiveCourseId());
  useEffect(() => {
    apiGet(teacher ? "/courses" : "/me/courses").then(list => {
      const cs = (Array.isArray(list) ? list : []).filter(c => c.deleted !== true);
      setCourses(cs);
      setCourseId(cur => (cs.some(c => c.courseId === cur) ? cur : cs[0]?.courseId || ""));
    }).catch(() => setCourses([]));
  }, [teacher]);
  const pick = c => { setCourseId(c); setActiveCourseId(c); };
  return (
    <>
      <Style />
      {courses == null ? <Card className="p-4"><SkeletonRows rows={3} /></Card>
        : !courses.length || !courseId ? <Card className="p-6 text-center text-sm" style={{ color: T.textMuted }}>コースがありません</Card>
        : teacher ? <TeacherHome courseId={courseId} coursePick={<CoursePick courses={courses} value={courseId} onChange={pick} />} />
        : <TraineeHome key={courseId} courseId={courseId} focus={focus} coursePick={<CoursePick courses={courses} value={courseId} onChange={pick} />} />}
    </>
  );
}
