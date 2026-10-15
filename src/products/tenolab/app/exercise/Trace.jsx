import React, { useEffect, useMemo, useRef, useState } from "react";
import { runJsTrace } from "./jsTrace.js";
import "./quiz.css";

/* サンプルを動かす（2026-10-15、モック devhub-lesson-quiz.html の ②）。
   「▶ 動きを見る」で1行ずつ光り、右で変数の値が変わっていくようすを見せる。「1行ずつ」で自分のペースで進める。
   「書き換えて試す」でふつうの作業台（JsBench）にする。段の並びは開いたときに jsTrace.js が作る（教材のデータは要らない） */

const TOK = /(\/\/.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(?:const|let|var|function|return|if|else|for|of|in|while|do|break|continue|new|class|switch|case|default|true|false|null|undefined|typeof|this)\b|\b\d+(?:\.\d+)?\b|\b(?:console|document|window|Math|alert)\b)/g;
function hl(line) {
  const parts = []; let last = 0, m;
  TOK.lastIndex = 0;
  while ((m = TOK.exec(line))) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    const t = m[0];
    const cls = t.startsWith("//") ? "c" : /^["'`]/.test(t) ? "s" : /^\d/.test(t) ? "n" : /^(console|document|window|Math|alert)$/.test(t) ? "f" : "k";
    parts.push(<span key={m.index} className={cls}>{t}</span>);
    last = m.index + t.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

function Val({ name, v, prev }) {
  const changed = prev && prev.t !== v.t;
  const delta = changed && v.k === "num" && prev.k === "num" ? Number(v.t) - Number(prev.t) : null;
  const [pop, setPop] = useState(false);
  useEffect(() => { if (!changed) return undefined; setPop(true); const t = setTimeout(() => setPop(false), 420); return () => clearTimeout(t); }, [v.t, v.items?.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="tr-var">
      <span className="tr-name">{name}</span>
      {v.k === "arr"
        ? <span className="tr-arr">{v.items.map((x, i) => <i key={i}>{x}</i>)}{v.more && <em>…</em>}{!v.items.length && <em>（空）</em>}</span>
        : <span className="tr-box-wrap"><b className={`tr-box ${v.k} ${pop ? "pop" : ""}`}>{v.t}</b>{delta != null && delta !== 0 && pop && <em className="tr-delta">{delta > 0 ? `+${delta}` : delta}</em>}</span>}
    </div>
  );
}

export default function JsTraceSample({ slide, onEdit, onFail }) {
  const content = slide.content || {};
  const code = String(content.js || "").replace(/\s+$/, "");
  const lines = useMemo(() => code.split("\n"), [code]);
  const [trace, setTrace] = useState(undefined);
  const [pos, setPos] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(0);

  useEffect(() => {
    let alive = true;
    runJsTrace({ html: content.html || "", js: code }).then(t => {
      if (!alive) return;
      if (!t || t.steps.length < 2) { onFail?.(); return; }
      setTrace(t);
    });
    return () => { alive = false; clearTimeout(timer.current); };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = trace?.steps || [];
  const step = steps[pos] || null;
  const prevStep = pos > 0 ? steps[pos - 1] : null;
  const out = steps.slice(0, pos + 1).flatMap(s => s.out);
  const finished = pos >= steps.length - 1 && steps.length > 0;

  function play() {
    clearTimeout(timer.current);
    setPlaying(true);
    let k = -1;
    setPos(-1);
    const tick = () => {
      k += 1; setPos(k);
      if (k < steps.length - 1) timer.current = setTimeout(tick, 560); else setPlaying(false);
    };
    timer.current = setTimeout(tick, 120);
  }
  const stepOnce = () => { clearTimeout(timer.current); setPlaying(false); setPos(p => (p >= steps.length - 1 ? 0 : p + 1)); };
  const reset = () => { clearTimeout(timer.current); setPlaying(false); setPos(-1); };

  if (trace === undefined) return <div className="tr-wait">サンプルを読み込んでいます…</div>;
  const vars = step?.vars || [];
  const prevVars = Object.fromEntries((prevStep?.vars || []).map(([n, v]) => [n, v]));

  return (
    <div className="tr">
      {content.task && <p className="tr-task">{content.task}</p>}
      <div className="tr-two">
        <div className="tr-ed">
          <div className="tr-tabs">
            <span className="on">sample.js</span><span className="sp" />
            <button type="button" className="tr-run" onClick={reset} disabled={pos < 0}>最初から</button>
            <button type="button" className="tr-run" onClick={stepOnce}>1行ずつ</button>
            <button type="button" className={`tr-run go ${playing ? "press" : ""}`} onClick={play} disabled={playing}>▶ 動きを見る</button>
          </div>
          <div className="tr-code" role="list" aria-label="サンプルのコード">
            {lines.map((l, i) => <div key={i} role="listitem" className={`tr-ln ${step && !step.end && step.line === i + 1 ? "cur" : ""}`} data-n={i + 1}><span>{hl(l)}{"​"}</span></div>)}
          </div>
          <div className="tr-con" aria-live="polite">
            <span className="lbl">出力</span>
            {out.map((o, i) => <div key={i} className={o.t === "error" ? "e" : o.t === "alert" ? "a" : "o"}>{o.t === "alert" ? "⚠ alert: " : o.t === "error" ? "✕ " : "› "}{o.s}</div>)}
            {!out.length && <span className="pr">{pos < 0 ? "▶ 動きを見る で1行ずつ動かします" : ""}</span>}
          </div>
        </div>
        <div className="tr-watch" aria-live="polite">
          <span className="lbl">変数</span>
          {vars.length ? vars.map(([n, v]) => <Val key={n} name={n} v={v} prev={prevVars[n]} />) : <span className="pr">{pos < 0 ? "動かすと、ここに値が出ます" : "—"}</span>}
          {finished && <span className="tr-fin">✓ 最後まで動きました</span>}
        </div>
      </div>
      <div className="tr-foot">
        <span className="tr-meta">{pos < 0 ? "" : step?.end ? "おわり" : `${step?.line}行目を動かすところ`}</span>
        <span className="sp" />
        <button type="button" className="tr-edit" onClick={onEdit}>書き換えて試す →</button>
      </div>
    </div>
  );
}
