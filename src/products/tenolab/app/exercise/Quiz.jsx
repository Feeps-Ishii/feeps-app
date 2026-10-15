import React, { useMemo, useState } from "react";
import { runJsPage } from "./jsRunner.js";
import { querySet, runSqlChecks } from "./sqlRunner.js";
import { SqlGrid } from "./SqlParts.jsx";
import "./quiz.css";

/* レッスンのクイズ（2026-10-15、モック devhub-lesson-quiz.html の ①③。見た目と動きは紹介ページと同じ）。
   ① ChoiceQuiz：slide.kind "quiz"・interaction.type "choice"
      { question, choices, answerIndex, explanation, wrongReasons?: [選択肢ごとの「なぜ違うか」], figure? }
      figure：{ type: "boxes", items: ["120","80","300"], op?: "=", answer: "500" }（正解すると ? が埋まる）／{ type: "code", code }（問いの前にコードを見せる）
   ③ CodeQuiz：slide.kind "quiz"・interaction.type "code"
      { lang: "js"|"sql", question, code（空欄は {{?}}）, choices, answerIndex, explanation, wrongReasons?,
        js：tests: [{ label, expr, want }]（expr を動かした値が want と同じなら ○。違えば「→ 値 になりました」）, html?
        sql：setup?（無ければ教材の4表）。正解の選択肢で流した結果と比べ、違えば行数を出す }
   答えは画面で確かめる（今までのクイズと同じ。記録はしない） */

const TOK = /(\/\/.*$|--.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:const|let|var|function|return|if|else|for|of|in|while|new|true|false|null|SELECT|FROM|WHERE|AND|OR|ORDER|BY|GROUP|HAVING|JOIN|ON|AS|COUNT|SUM|AVG|MAX|MIN|DESC|ASC|INSERT|INTO|VALUES|UPDATE|SET|DELETE|LIMIT|DISTINCT|IS|NOT|LIKE|IN|BETWEEN|LEFT|INNER)\b|\b\d+(?:\.\d+)?\b)/g;
function hl(line, key = "") {
  const parts = []; let last = 0, m;
  TOK.lastIndex = 0;
  while ((m = TOK.exec(line))) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    const t = m[0];
    parts.push(<span key={key + m.index} className={/^(\/\/|--)/.test(t) ? "c" : /^["']/.test(t) ? "s" : /^\d/.test(t) ? "n" : "k"}>{t}</span>);
    last = m.index + t.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}
const CodeBlock = ({ code, blank, filled }) => (
  <div className="qz-code">
    {String(code || "").replace(/\s+$/, "").split("\n").map((l, i) => {
      const at = l.indexOf("{{?}}");
      return (
        <div key={i} className="qz-ln" data-n={i + 1}><span>
          {at < 0 ? hl(l, `a${i}`) : <>{hl(l.slice(0, at), `b${i}`)}<span className={`qz-blank ${filled ? "set" : ""}`}>{filled || "？"}</span>{hl(l.slice(at + 5), `c${i}`)}</>}
          {"​"}
        </span></div>
      );
    })}
    {blank}
  </div>
);

function Figure({ figure, solved }) {
  if (!figure) return null;
  if (figure.type === "code") return <CodeBlock code={figure.code} />;
  if (figure.type === "boxes") {
    const items = Array.isArray(figure.items) ? figure.items : [];
    return (
      <div className="qz-fig">
        <div className="qz-boxes">{items.map((x, i) => <i key={i}>{x}</i>)}{figure.answer != null && <><span className="eq">{figure.op || "="}</span><i className={`q ${solved ? "done" : ""}`}>{solved ? figure.answer : "?"}</i></>}</div>
        <div className={`qz-brace ${solved ? "on" : ""}`} style={{ width: `${Math.max(1, items.length) * 70}px` }}><span /></div>
      </div>
    );
  }
  return null;
}

export function ChoiceQuiz({ slide }) {
  const it = slide.interaction || {};
  const choices = Array.isArray(it.choices) ? it.choices : [];
  const [picked, setPicked] = useState(null);
  const [wrong, setWrong] = useState([]);
  const [shake, setShake] = useState(0);
  const solved = picked === it.answerIndex;
  const reason = i => (Array.isArray(it.wrongReasons) && it.wrongReasons[i]) || "";
  function choose(i) {
    if (solved) return;
    setPicked(i);
    if (i !== it.answerIndex) { setWrong(w => (w.includes(i) ? w : [...w, i])); setShake(s => s + 1); }
  }
  const reset = () => { setPicked(null); setWrong([]); };
  return (
    <div className="qz">
      <div className="qz-head"><span className="qz-chip">確認クイズ</span></div>
      {slide.title && <p className="qz-title">{slide.title}</p>}
      <Figure figure={it.figure} solved={solved} />
      <div className="qz-card" role="group" aria-labelledby={`q-${slide.id}`}>
        <b id={`q-${slide.id}`}>{it.question}</b>
        {choices.map((c, i) => {
          const st = solved && i === it.answerIndex ? "ok" : wrong.includes(i) ? "ng" : "";
          return (
            <button key={i} type="button" className={`qz-opt ${st}`} disabled={solved || wrong.includes(i)} onClick={() => choose(i)}
              {...(st === "ng" && picked === i ? { "data-shake": shake } : {})}>
              <i aria-hidden="true" />{c}
            </button>
          );
        })}
        <div className={`qz-ex ${picked == null ? "" : solved ? "on" : "on ng"}`} aria-live="polite">
          <div className="in">{picked == null ? "" : solved ? it.explanation : (reason(picked) || "もう一度選んでみましょう。")}</div>
        </div>
      </div>
      <div className="qz-foot"><button type="button" className="qz-btn" onClick={reset} disabled={picked == null}>もう一度</button></div>
    </div>
  );
}

export function CodeQuiz({ slide }) {
  const it = slide.interaction || {};
  const choices = Array.isArray(it.choices) ? it.choices : [];
  const lang = it.lang === "sql" ? "sql" : "js";
  const tests = useMemo(() => (Array.isArray(it.tests) ? it.tests : []), [it.tests]);
  const [choice, setChoice] = useState(null);
  const [res, setRes] = useState(null);   // { items: [{ label, ok, got }], ok, set }
  const [running, setRunning] = useState(false);
  const fill = i => String(it.code || "").split("{{?}}").join(choices[i] ?? "");
  const reason = i => (Array.isArray(it.wrongReasons) && it.wrongReasons[i]) || "";

  async function run() {
    if (choice == null || running) return;
    setRunning(true); setRes(null);
    try {
      if (lang === "js") {
        const r = await runJsPage({ html: it.html || "", js: fill(choice), checks: tests.map(t => t.expr) });
        const items = tests.map((t, k) => {
          const got = r?.results?.[k]?.value;
          const want = JSON.stringify(t.want);
          return { label: t.label, ok: got === want, got: r?.results?.[k]?.error ? "エラー" : got };
        });
        // 1つずつ判定されるように少しずつ見せる
        for (let k = 1; k <= items.length; k++) { setRes({ items: items.slice(0, k), done: k === items.length }); await new Promise(f => setTimeout(f, 380)); }
        setRes({ items, done: true, ok: items.every(x => x.ok) });
      } else {
        const mine = await querySet(it.setup, fill(choice));
        const r = await runSqlChecks({ setup: it.setup, code: fill(choice), answer: fill(it.answerIndex), checks: [{ label: "正しい結果になる" }] });
        const exp = await querySet(it.setup, fill(it.answerIndex));
        const ok = !!r.results?.[0]?.ok;
        const got = mine.error ? "エラー" : `${mine.set?.values?.length ?? 0}行`;
        await new Promise(f => setTimeout(f, 380));
        setRes({ items: [{ label: `結果が ${exp.set?.values?.length ?? 0}行 になる`, ok, got }], done: true, ok, set: mine.set, error: mine.error });
      }
    } finally { setRunning(false); }
  }
  const pick = i => { setChoice(i); setRes(null); };
  return (
    <div className="qz">
      <div className="qz-head"><span className="qz-chip">コードのクイズ</span></div>
      {slide.title && <p className="qz-title">{slide.title}</p>}
      {it.question && <p className="qz-q">{it.question}</p>}
      <div className="qz-ed">
        <div className="qz-tabs"><span className="on">{lang === "sql" ? "query.sql" : "main.js"}</span><span className="sp" />
          <button type="button" className={`qz-run ${running ? "press" : ""}`} onClick={run} disabled={choice == null || running}>▶ 実行</button></div>
        <CodeBlock code={it.code} filled={choice == null ? "" : choices[choice]} />
        <div className="qz-con" aria-live="polite">
          <span className="lbl">テスト</span>
          {(res?.items || (lang === "js" ? tests.map(t => ({ label: t.label })) : [{ label: "正しい結果になる" }])).map((t, k) => (
            <div key={k} className={`qz-t ${t.ok === true ? "ok" : t.ok === false ? "ng" : ""}`}><i />{t.label}{t.ok === false && t.got != null && <small>→ {t.got} になりました</small>}</div>
          ))}
          {lang === "sql" && res?.error && <div className="qz-t ng"><small>{res.error}</small></div>}
        </div>
      </div>
      {lang === "sql" && res?.set && <div className="qz-grid"><SqlGrid set={res.set} max={8} light /></div>}
      <div className="qz-picks" role="group" aria-label="空欄に入るもの"><span>空欄に入るもの</span>
        {choices.map((c, i) => <button key={i} type="button" className="qz-pick" aria-pressed={choice === i} onClick={() => pick(i)}>{c}</button>)}
      </div>
      <div className={`qz-res ${res?.done ? (res.ok ? "ok" : "ng") : ""}`} aria-live="polite">
        {res?.done ? (res.ok ? (it.explanation || "正解です。") : (reason(choice) || "もう一度選んでみましょう。")) : ""}
      </div>
    </div>
  );
}
