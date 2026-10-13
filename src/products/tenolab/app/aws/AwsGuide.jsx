import React, { useEffect, useState } from "react";
import "./guide.css";

/* AWS の演習の手順（2026-10-13、モック docs/design/mockups/devhub-learning-2026-10/devhub-aws-hearing.html）
   「詳しい手順」：1つの手順を小さな操作に分け、操作ごとに画面の見本（HTML で描いたスクショ風の絵）を出す。
   「決めた値だけ」：手順ごとに決まっている値だけを並べる（慣れた人向け）。
   手順ごとの「ここまで確かめる」は、本物の環境を採点（/cloudlab/scenarios/{id}/check）して、その手順の項目だけを見る。
   文の中の **語** は強調、{tagKey} {tagValue} {prefix} は受講生の環境の値に置き換える。 */

const VIEW_KEY = "tl-aws-guide-view";
const readLS = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 覚えられなくても動く */ } };

export function fillVars(text, session) {
  const v = { tagKey: session?.tag?.key, tagValue: session?.tag?.value, prefix: session?.namePrefix };
  return String(text || "").replace(/\{(tagKey|tagValue|prefix)\}/g, (m, k) => v[k] || "（環境を用意すると出ます）");
}
function Em({ text }) {
  return <>{String(text || "").split(/(\*\*[^*]+\*\*)/).map((s, k) => (/^\*\*[^*]+\*\*$/.test(s) ? <em key={k}>{s.slice(2, -2)}</em> : <React.Fragment key={k}>{s}</React.Fragment>))}</>;
}

/* ---------- 画面の見本（スクショ風の絵） ---------- */
const Mark = ({ n }) => <span className="ag-mark" aria-hidden="true">{n}</span>;
function Top({ query, hl }) {
  return (
    <div className="ag-top"><b>Console</b>
      <span className={`ag-srch ${hl ? "hl" : ""}`}>{hl && <Mark n={1} />}{query || "サービスを検索"}</span>
      <span className="ag-rg">東京 ▾</span></div>
  );
}
export function AwsShot({ shot, session }) {
  if (!shot) return null;
  const f = t => fillVars(t, session);
  if (shot.type === "search") {
    return (
      <div className="ag-shot short" role="img" aria-label={`検索欄に「${shot.query}」と入れて「${shot.pick}」を選ぶ画面の見本`}>
        <Top query={shot.query} hl />
        <div className="ag-dd"><span className="hl"><Mark n={2} /><b>{shot.pick}</b>{shot.pickSub && <small>{shot.pickSub}</small>}</span></div>
        <div style={{ height: 90 }} />
      </div>
    );
  }
  if (shot.type === "menu") {
    return (
      <div className="ag-shot" role="img" aria-label={`左のメニューの「${shot.active}」と「${shot.button}」を押す画面の見本`}>
        <Top />
        {shot.crumb && <div className="ag-crumb">{f(shot.crumb)}</div>}
        <div className="ag-main">
          <div className="ag-side">{(shot.menu || []).map(m => m === shot.active ? <span key={m} className="on hl"><Mark n={1} />{m}</span> : <span key={m}>{m}</span>)}</div>
          <div className="ag-list"><div className="lh"><h4>{shot.title}</h4>{shot.button && <span className="hl go-w"><Mark n={2} /><span className="ag-go">{shot.button}</span></span>}</div><div className="row" /><div className="row" /></div>
        </div>
      </div>
    );
  }
  let n = 0;
  return (
    <div className="ag-shot" role="img" aria-label={`${shot.title} の画面の見本`}>
      <Top />
      {shot.crumb && <div className="ag-crumb">{f(shot.crumb)}</div>}
      <div className="ag-form"><h4>{shot.title}</h4>
        {shot.radio && <div className="hl"><Mark n={++n} /><div className="ag-radio">{shot.radio.opts.map(o => <span key={o}><b className={o === shot.radio.sel ? "on" : ""} />{o}</span>)}</div></div>}
        {(shot.fields || []).map(x => <div key={x.label} className="hl"><Mark n={++n} /><div className="ag-fl"><span>{x.label}</span><i>{f(x.value)}</i></div></div>)}
        {shot.button && <div className="hl go-w"><Mark n={++n} /><span className="ag-go">{shot.button}</span></div>}
      </div>
    </div>
  );
}

/* ---------- 手順 ---------- */
export default function AwsGuide({ scenario, steps, session, ready, verify }) {
  const posKey = `tl-aws-guide-step-${scenario}`;
  const [view, setView] = useState(() => readLS(VIEW_KEY, "detail"));
  const [cur, setCur] = useState(() => Math.min(steps.length - 1, Math.max(0, Number(readLS(posKey, "0")) || 0)));
  const [vs, setVs] = useState({});     // 手順ごとの確かめた結果 { i: { st: "wait" | "ok" | "ng", lines: [] } }
  useEffect(() => { writeLS(VIEW_KEY, view); }, [view]);
  useEffect(() => { writeLS(posKey, String(cur)); }, [posKey, cur]);
  const f = t => fillVars(t, session);

  async function check(i) {
    const ids = steps[i].checks || [];
    if (!ids.length || vs[i]?.st === "wait") return;
    setVs(v => ({ ...v, [i]: { st: "wait", lines: [] } }));
    try {
      const r = await verify();
      const mine = (r?.checks || []).filter(c => ids.includes(c.id));
      const ok = mine.length > 0 && mine.every(c => c.ok);
      setVs(v => ({ ...v, [i]: { st: ok ? "ok" : "ng", lines: mine.map(c => ({ ok: c.ok, text: `${c.name}${c.detail ? `：${c.detail}` : ""}` })) } }));
    } catch (e) {
      setVs(v => ({ ...v, [i]: { st: "ng", lines: [{ ok: false, text: e?.errorMessage || "確かめられませんでした。環境が用意できているか見てから、もう一度押してください。" }] } }));
    }
  }
  const result = i => vs[i] && (
    <div className={`ag-vres ${vs[i].st}`} role="status">
      {vs[i].st === "wait" ? "本物の環境を確かめています…" : vs[i].lines.map((l, k) => <div key={k}>{l.ok ? "✓" : "✕"} {l.text}</div>)}
    </div>
  );
  const verifyBtn = (i, small) => (steps[i].checks || []).length > 0 && (
    <button type="button" className={`btn ${small ? "ghost sm" : "dark sm"}`} onClick={() => check(i)} disabled={!ready || vs[i]?.st === "wait"} title={ready ? "" : "環境を用意すると確かめられます"}>
      {vs[i]?.st === "wait" ? "確かめています…" : small ? "確かめる" : "ここまで確かめる"}
    </button>
  );

  return (
    <section className="ag" aria-label="手順">
      <div className="ag-head">
        <span className="eyebrow">STEPS</span>
        <div className="ag-seg" role="group" aria-label="手順の出し方">
          <button type="button" aria-pressed={view === "detail"} onClick={() => setView("detail")}>詳しい手順</button>
          <button type="button" aria-pressed={view === "brief"} onClick={() => setView("brief")}>決めた値だけ</button>
        </div>
        <span className="ag-pos mono">{cur + 1} / {steps.length}</span>
      </div>

      {view === "brief" ? (
        <div className="ag-brief">
          {steps.map((st, i) => (
            <div key={i} className={`ag-bi ${vs[i]?.st === "ok" ? "done" : ""}`}>
              <span className="n">{vs[i]?.st === "ok" ? "✓" : i + 1}</span>
              <div><h3>{st.title}</h3>
                {(st.decided || []).length > 0 && <ul>{st.decided.map((d, k) => <li key={k}>{d.k} <code>{f(d.v)}</code></li>)}</ul>}
                {result(i)}</div>
              {verifyBtn(i, true) || <span />}
            </div>
          ))}
        </div>
      ) : (
        <div className="ag-steps">
          {steps.map((st, i) => {
            const state = i < cur ? "done" : i === cur ? "cur" : "";
            return (
              <div key={i} className={`ag-st ${state}`}>
                <button type="button" className="ag-sh" aria-expanded={i === cur} onClick={() => setCur(i)}>
                  <span className="n">{i < cur ? "✓" : i + 1}</span><span className="t">{st.title}</span>
                  {i === cur ? <span className="chip warn">いまここ</span> : vs[i]?.st === "ok" ? <span className="chip ok">確かめ済み</span> : null}
                </button>
                {i === cur && (
                  <div className="ag-body">
                    <ol className="ag-ops">{st.ops.map((o, k) => <li key={k}><b aria-hidden="true">{k + 1}</b><div><p><Em text={f(o.text)} /></p><AwsShot shot={o.shot} session={session} /></div></li>)}</ol>
                    {(st.values || []).length > 0 && (
                      <div className="ag-vals">{st.values.map((v, k) => <div key={k}><b>{v.k}</b><code>{f(v.v)}</code><button type="button" onClick={() => navigator.clipboard?.writeText(f(v.v)).catch(() => {})}>コピー</button></div>)}</div>
                    )}
                    {st.stuck && <details className="ag-stuck"><summary>うまくいかないとき</summary><Em text={f(st.stuck)} /></details>}
                    {(st.checks || []).length > 0 && <div className="ag-verify">{verifyBtn(i)}{result(i)}</div>}
                    <div className="ag-acts">
                      {i > 0 && <button type="button" className="btn ghost sm" onClick={() => setCur(i - 1)}>← 前の手順</button>}
                      {i < steps.length - 1 ? <button type="button" className="btn" onClick={() => setCur(i + 1)}>できた → 次へ</button> : <span className="chip">最後の手順</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
