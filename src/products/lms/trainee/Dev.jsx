import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../api.js";
import { devApi, fmtDate, fmtSize, openFile, stamp, uploadToFolder } from "../../training/DevReview.jsx";
import { getActiveCourseId, setActiveCourseId } from "../../../utils/common/courseContext.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, Hero } from "../parts/ui.jsx";

/* 受講生の個人開発（モック devT2）：上に課題の札、左に課題の中身と講師のレビュー、右に提出フォルダ。
   置くたびに日時のフォルダに分ける・前のものも残す・何回でも出せる（今の画面と同じ） */

const KIND = { none: ["まだ", "", ""], submitted: ["レビュー待ち", "blue", ""], resubmit: ["出し直し", "warn", "!"], done: ["レビュー済み", "ok", "✓"] };
const NOTE = { req: "要件", out: "講義の範囲外", style: "読みやすさ" };
const REQ = { ok: ["ok", "✓", "できている"], partial: ["pt", "△", "一部できている"], ng: ["ng", "!", "まだ"] };
const dk = v => String(v || "").slice(0, 10);
const md = v => { const [, m, d] = dk(v).split("-").map(Number); return m ? `${m}/${d}` : ""; };
const daysLeft = (iso, today) => Math.ceil((Date.parse(dk(iso)) - Date.parse(today)) / 86400000);
// 「2026-10-22 18.40」→「10/22 18:40」
const batchLabel = b => { const m = /^\d{4}-(\d\d)-(\d\d) (\d\d)\.(\d\d)$/.exec(b); return m ? `${Number(m[1])}/${Number(m[2])} ${m[3]}:${m[4]}` : b; };
const batchTime = b => Date.parse(b.replace(" ", "T").replace(/\.(\d\d)$/, ":$1"));

// 置いたフォルダの中身を File の並びにする（フォルダを選んだときと同じ相対パスを持たせる）
async function filesFromDrop(dt) {
  const entries = [...(dt.items || [])].map(i => i.webkitGetAsEntry?.()).filter(Boolean);
  const out = [];
  const walk = async (e, path) => {
    if (e.isFile) {
      const f = await new Promise((ok, ng) => e.file(ok, ng));
      if (path) Object.defineProperty(f, "webkitRelativePath", { value: `${path}${f.name}` });
      out.push(f);
      return;
    }
    const r = e.createReader();
    let got;
    do {
      // eslint-disable-next-line no-await-in-loop
      got = await new Promise((ok, ng) => r.readEntries(ok, ng));
      // eslint-disable-next-line no-await-in-loop
      for (const c of got) await walk(c, `${path}${e.name}/`);
    } while (got.length);
  };
  for (const e of entries) await walk(e, ""); // eslint-disable-line no-await-in-loop
  return out;
}

function Pick({ kind, folder, disabled, onPick, children }) {
  return (
    <label className={`btn ${kind}${disabled ? " off" : ""}`}>
      {children}
      <input type="file" multiple className="lms-sr" disabled={disabled} {...(folder ? { webkitdirectory: "", directory: "" } : {})} onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) onPick(fs); }} />
    </label>
  );
}

function FileRows({ files, courseId, onError }) {
  return <div className="dv-ft">{files.map(f => <button key={f.nodeId} type="button" title={f.name} onClick={() => openFile(courseId, f.nodeId).catch(() => onError(`「${f.name}」を開けませんでした`))}>{f.name}</button>)}</div>;
}

function Review({ reviews, stale }) {
  const r = reviews[0], good = (r.notes || []).filter(n => n.kind === "good"), fix = (r.notes || []).filter(n => n.kind !== "good");
  return (
    <Card className="pad dv-rv" id="dv-rv">
      <div className="head">
        <div><h2 className="h2">講師のレビュー</h2><small className="dv-mt num">{fmtDate(r.publishedAt)}{reviews.length > 1 ? ` ・ ${reviews.length} 回目` : ""}</small></div>
        <span className="r">{stale ? <Chip>前の提出へ</Chip> : r.resubmit && <Chip tone="warn">出し直し</Chip>}<span className="dv-sc"><b className="num">{r.total}</b><small>/ 100</small></span></span>
      </div>
      {r.teacherComment && <p className="dv-msg">{r.teacherComment}</p>}
      {r.summary && <p className="dv-sum">{r.summary}</p>}
      {(r.criteria || []).length > 0 && (
        <div className="dv-cr">
          {r.criteria.map(c => (
            <div key={c.name}>
              <span>{c.name}</span><b className="num">{c.score} / {c.max}</b>
              <span className="tp-bar sm"><i style={{ "--w": `${c.max ? Math.round(c.score / c.max * 100) : 0}%` }} /></span>
              {c.reason && <small>{c.reason}</small>}
            </div>
          ))}
        </div>
      )}
      {(good.length > 0 || fix.length > 0) && (
        <div className="dv-cols">
          {good.length > 0 && <div className="dv-gd"><span className="eyebrow">良いところ</span>{good.map((n, i) => <span key={i}><i aria-hidden="true">✓</i>{n.text}</span>)}</div>}
          {fix.length > 0 && (
            <div className="dv-fx">
              <span className="eyebrow">直すところ</span>
              {fix.map((n, i) => (
                <div key={i}>
                  <span className="dv-f">{n.file && <b className="dv-mono">{n.file}</b>}{n.line ? <em className="num">{n.line} 行目</em> : null}<Chip>{NOTE[n.kind] || "指摘"}{n.reqId ? ` ${n.reqId}` : ""}</Chip></span>
                  <span>{n.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {(r.diffs || []).length > 0 && (
        <div className="dv-df">
          <span className="eyebrow">見直すところ</span>
          {r.diffs.map((d, i) => <div key={i}><small>{d.title}</small><pre><span>{d.mine?.file}{d.mine?.line ? ` ${d.mine.line} 行目` : ""}{"\n"}</span>{d.mine?.code}</pre></div>)}
        </div>
      )}
      {reviews.length > 1 && (
        <details className="dv-h">
          <summary><span className="dv-hb"><b>前の結果</b></span><Chip>{reviews.length - 1}</Chip></summary>
          <div className="dv-pv">{reviews.slice(1).map(x => <span key={x.revId}><span className="num">{fmtDate(x.publishedAt)}</span><b className="num">{x.total} 点</b></span>)}</div>
        </details>
      )}
    </Card>
  );
}

export default function TraineeDev({ go, say }) {
  const today = todayStr();
  const [st, setSt] = useState({ state: "loading", items: [], courseId: "", courseName: "" });
  const [sel, setSel] = useState(() => { try { const v = sessionStorage.getItem("lms.devFocus"); sessionStorage.removeItem("lms.devFocus"); return v; } catch { return null; } });
  const [details, setDetails] = useState({}); // id → { state, data }
  const [key, setKey] = useState(0);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const row = useRef(null), rowDone = useRef(false);

  useEffect(() => {
    let alive = true;
    setSt(s => ({ ...s, state: "loading" }));
    apiGet("/me/courses").then(async cs => {
      const list = Array.isArray(cs) ? cs : [], c = list.find(x => x.courseId === getActiveCourseId()) || list[0];
      if (!c) { if (alive) setSt({ state: "ready", items: [], courseId: "", courseName: "" }); return; }
      setActiveCourseId(c.courseId);
      const r = await devApi.list(c.courseId);
      if (alive) setSt({ state: "ready", items: Array.isArray(r?.items) ? r.items : [], courseId: c.courseId, courseName: c.name || c.courseName || "" });
    }).catch(() => { if (alive) setSt(s => ({ ...s, state: "error" })); });
    return () => { alive = false; };
  }, [key]);

  const { items, courseId } = st;
  const cur = items.find(x => x.state === "resubmit") || items.find(x => x.state !== "done") || items[items.length - 1];
  const d = items.find(x => x.id === sel) || cur;
  const detail = d ? details[d.id] : null;

  const loadDetail = useCallback(id => {
    setDetails(m => ({ ...m, [id]: { state: "loading", data: m[id]?.data } }));
    return devApi.get(courseId, id).then(data => setDetails(m => ({ ...m, [id]: { state: "ready", data } }))).catch(() => setDetails(m => ({ ...m, [id]: { state: "error" } })));
  }, [courseId]);
  useEffect(() => { if (d && courseId && !details[d.id]) loadDetail(d.id); }, [d?.id, courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // スマホで札が横に流れるとき、はじめだけ選んでいる札が見える位置に。あとは動かした位置を保つ
  useEffect(() => {
    const r = row.current;
    if (!r || rowDone.current || !items.length) return;
    rowDone.current = true;
    const on = r.querySelector(".dv-k.on");
    if (on && r.scrollWidth > r.clientWidth) r.scrollLeft = on.offsetLeft - r.offsetLeft - 16;
  }, [items.length]);

  if (st.state === "loading" && !items.length) return <div className="soon card">読み込み中</div>;
  if (st.state === "error") return <Card><div className="empty"><b>個人開発の課題を確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card>;
  if (!items.length) return <Card><div className="empty"><b>個人開発の課題</b><Chip>なし</Chip></div></Card>;

  const n = items.indexOf(d) + 1;
  const rvd = items.filter(x => x.state === "done" && x.total != null);
  const avg = rvd.length ? Math.round(rvd.reduce((a, x) => a + x.total, 0) / rvd.length) : null;
  const data = detail?.data, item = data?.item || d;
  const reviews = data?.reviews || [], latest = reviews[0];
  const left = d.deadline ? daysLeft(d.deadline, today) : null;
  const files = data?.files || [];
  const batches = [...new Set(files.map(f => f.name.split("/")[0]))].sort().reverse();
  const reqs = item.requirements || [];
  const status = id => { const r = (latest?.requirements || []).find(x => x.id === id); return r ? { s: r.status || (r.ok ? "ok" : "ng"), note: r.note } : null; };
  const met = reqs.filter(r => status(r.id)?.s === "ok").length;
  const stale = latest && d.state === "submitted";
  const jump = id => { const el = document.getElementById(id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" }); };

  async function submit(list) {
    if (!list.length || !data?.folderId) return;
    setBusy("0"); setErr("");
    try {
      const batch = await apiPost("/library/folders", { spaceId: `course#${courseId}`, parentId: data.folderId, name: stamp() });
      await uploadToFolder({ courseId, parentId: batch.nodeId, files: list, onProgress: (a, b) => setBusy(`${a} / ${b}`) });
      say?.(`${list.length} ファイルを出しました`);
      await loadDetail(d.id);
      const r = await devApi.list(courseId);
      setSt(s => ({ ...s, items: Array.isArray(r?.items) ? r.items : s.items }));
    } catch (e) { setErr(e?.errorMessage || e?.message || "出せませんでした"); } finally { setBusy(""); }
  }
  const pickers = kind => (
    <div className="row dv-pk">
      <Pick kind={kind} folder disabled={!!busy || !data} onPick={submit}>フォルダを選ぶ</Pick>
      <Pick kind="ghost sm" disabled={!!busy || !data} onPick={submit}>ファイル・zip</Pick>
    </div>
  );

  return (
    <div className="th dv">
      <div className="th-top">
        <div><div className="eyebrow">{st.courseName}</div><h1 className="h1">個人開発</h1></div>
        <div className="th-att">
          <span className="th-pill ok"><i aria-hidden="true" />レビュー済み <b className="num">{rvd.length} / {items.length}</b></span>
          {avg != null && <span className="th-pill"><i aria-hidden="true" style={{ background: "var(--dev-d)" }} />平均 <b className="num">{avg}</b> 点</span>}
        </div>
      </div>

      <div className="dv-ks" ref={row}>
        {items.map((x, i) => {
          const [kt, kc, km] = KIND[x.state] || KIND.none;
          return (
            <button key={x.id} type="button" className={`dv-k st-${x.state}${x === d ? " on" : ""}`} aria-current={x === d} onClick={() => setSel(x.id)}>
              <span className="dv-kn num" aria-hidden="true">{km || i + 1}</span>
              <span className="dv-kb"><span className="eyebrow">課題 {i + 1}{x === cur ? " ・ 今の課題" : ""}</span><b>{x.title}</b>{x.deadline && <small className="num">{md(x.deadline)} まで</small>}</span>
              <Chip tone={kc}>{kt}</Chip>
            </button>
          );
        })}
      </div>

      <div className="tc-grid">
        <div className="tc-l">
          <Hero cat="dev" art="dev" className="dv-hero" eyebrow={d === cur ? "今の課題" : `課題 ${n}`}
            step={d.state === "done" && d.total != null ? `${d.total} 点` : left != null ? (left < 0 ? "期限切れ" : `あと ${left} 日`) : undefined}
            title={d.title} sub={`課題 ${n}${d.deadline ? ` ・ ${md(d.deadline)} まで` : ""}`}>
            {item.summary && <p className="dv-bd">{item.summary}</p>}
            <div className="row">
              {d.state === "resubmit" && <><Btn kind="big" onClick={() => jump("dv-drop")}>出し直す</Btn><Btn kind="ghost big th-ghost" onClick={() => jump("dv-rv")}>レビューを見る</Btn></>}
              {d.state === "done" && <Btn kind="ghost big th-ghost" onClick={() => jump("dv-rv")}>レビューを見る</Btn>}
              {(d.state === "none" || d.state === "submitted") && <Btn kind="big" onClick={() => jump("dv-drop")}>{d.state === "none" ? "フォルダを出す" : "もう一度出す"}</Btn>}
            </div>
            {(item.scope || []).length > 0 && <div className="row">{item.scope.map(s => <Chip key={s}>{s}</Chip>)}</div>}
            {reqs.length > 0 && (
              <div className="tc-goals dv-goals">
                <span className="eyebrow">満たすこと{latest && <em className="num">{met} / {reqs.length}</em>}</span>
                {reqs.map(r => {
                  const v = status(r.id), m = v ? REQ[v.s] || REQ.ng : null;
                  return <span key={r.id} className={m ? `is-${m[0]}` : ""}><i className={m ? m[0] : ""} aria-label={m ? m[2] : undefined}>{m ? m[1] : ""}</i><span>{r.text}{v?.note && <small>{v.note}</small>}</span></span>;
                })}
              </div>
            )}
            {(data?.problem || []).length > 0 && (
              <div className="dv-pb">
                <span className="eyebrow">問題のファイル</span>
                {data.problem.map(f => <button key={f.nodeId} type="button" onClick={() => openFile(courseId, f.nodeId).catch(() => setErr(`「${f.name}」を開けませんでした`))}><b>{f.name}</b><small className="num">{fmtSize(f.sizeBytes)}</small></button>)}
              </div>
            )}
          </Hero>
          {detail?.state === "error" && <Card><div className="empty"><b>課題の中身を確認できません</b><Btn kind="ghost sm" onClick={() => loadDetail(d.id)}>再読み込み</Btn></div></Card>}
          {latest && <Review reviews={reviews} stale={stale} />}
        </div>

        <Card className="pad tl-side dv-sb">
          <div className="head"><h2 className="h2"><span className="dv-folder" aria-hidden="true" />提出フォルダ</h2><span className="r"><Chip>自分と講師だけ</Chip></span></div>
          {d.state === "done"
            ? <div id="dv-drop">{pickers("ghost sm")}</div>
            : (
              <div id="dv-drop" className={`dv-drop${over ? " on" : ""}`}
                onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
                onDrop={async e => { e.preventDefault(); setOver(false); if (!busy && data) submit(await filesFromDrop(e.dataTransfer)); }}>
                <b>フォルダをここに置く</b>
                <span>プロジェクトのフォルダをまるごと</span>
                {pickers("sm")}
              </div>
            )}
          {busy && <div className="row" role="status"><span className="tp-bar dv-up"><i style={{ "--w": busy.includes("/") ? `${Math.round(Number(busy.split(" / ")[0]) / Number(busy.split(" / ")[1]) * 100)}%` : "4%" }} /></span><span className="tp-n num">{busy === "0" ? "出しています" : busy}</span></div>}
          {err && <div className="lms-err" role="alert">{err}</div>}
          <div className="dv-hs">
            <span className="eyebrow">出したもの{batches.length > 0 ? ` ${batches.length} 回` : ""}</span>
            {batches.map((b, i) => {
              const fs = files.filter(f => f.name.startsWith(`${b}/`)).map(f => ({ ...f, name: f.name.slice(b.length + 1) }));
              const size = fs.reduce((a, f) => a + (f.sizeBytes || 0), 0);
              const late = d.deadline && batchTime(b) > Date.parse(d.deadline);
              return (
                <details key={b} className="dv-h" open={i === 0}>
                  <summary><span className="dv-folder" aria-hidden="true" /><span className="dv-hb"><b className="num">{batchLabel(b)}</b><small className="num">{fs.length} ファイル ・ {fmtSize(size)}</small></span><span className="dv-hc">{late && <Chip tone="warn">遅れ</Chip>}{i === 0 ? <Chip tone="mk">最新</Chip> : <Chip>{batches.length - i} 回目</Chip>}</span></summary>
                  <FileRows files={fs} courseId={courseId} onError={setErr} />
                </details>
              );
            })}
            {data && !batches.length && <div><Chip>未提出</Chip></div>}
            {!data && detail?.state === "loading" && <div className="dv-mt">読み込み中</div>}
          </div>
          <span><Btn kind="ghost sm" onClick={() => go("doc")}>フォルダの画面で開く</Btn></span>
        </Card>
      </div>
    </div>
  );
}
