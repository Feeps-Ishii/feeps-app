import React, { useEffect, useState } from "react";
import { Answer, Items, Rich, Style } from "../../training/PracticeView.jsx";
import { Btn, Chip } from "../parts/ui.jsx";

/* 練習問題を解く（モック pracPage / pracDrawer）：1 問ずつ・まとめて。問題の中身（図・コード）と解答は前の画面の部品のまま */

const label = q => `問題 ${q.q.n}`;
const keyOf = x => `${x.setId}:${x.q.id}`;

function Q({ x, images, showAnswers, hintsN, setHints, ansOpen, setAns, onDone, onZoom, foot = true }) {
  const q = x.q, k = keyOf(x), h = hintsN[k] || 0, a = !!ansOpen[k], hasAns = showAnswers && !!q.answer, hints = q.hints || [];
  return (
    <article className={`pqa${x.done ? " dn" : ""}`} id={`q-${k}`}>
      <div className="head"><h3 className="h3">{label(x)} {q.title}</h3><span className="r">{x.done && <Chip tone="ok">✓ できた</Chip>}</span></div>
      <Items items={q.parts} images={images} onZoom={onZoom} />
      {hints.slice(0, h).map((t, j) => <div key={j} className="hint"><b>ヒント {j + 1}</b>　<Rich text={t} /></div>)}
      {foot && (
        <span className="row">
          {h < hints.length && <Btn kind="ghost sm" onClick={() => setHints(m => ({ ...m, [k]: h + 1 }))}>{h ? "次のヒント" : "ヒントを見る"}</Btn>}
          {hasAns ? <Btn kind="ghost sm" onClick={() => setAns(m => ({ ...m, [k]: !a }))}>{a ? "解答を閉じる" : "解答を見る"}</Btn> : <Chip>解答は講師が確認</Chip>}
          <span className="st-sp" />
          <Btn kind={x.done ? "ghost sm" : "sm"} onClick={() => onDone(x.setId, q.id, !x.done)}>{x.done ? "✓ できた（取り消す）" : "できた"}</Btn>
        </span>
      )}
      {a && hasAns && <Answer a={q.answer} />}
    </article>
  );
}

const useZoom = () => {
  const [zoom, setZoom] = useState("");
  useEffect(() => { const k = e => e.key === "Escape" && setZoom(""); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  return [zoom, setZoom, zoom ? <div className="pq-zoom" role="dialog" aria-label="図を大きく" onClick={() => setZoom("")}><img src={zoom} alt="" /></div> : null];
};

// qs: [{ q, setId, done }]、metaOf(setId) で { images, showAnswers }
export function PracticePage({ title, qs, metaOf, start, startMode = "one", onDone, onClose }) {
  const [mode, setMode] = useState(startMode);
  const [cur, setCur] = useState(() => Math.max(0, qs.findIndex(x => keyOf(x) === start)));
  const [hintsN, setHints] = useState({});
  const [ansOpen, setAns] = useState({});
  const [, setZoom, zoomEl] = useZoom();
  const dn = qs.filter(x => x.done).length;
  const props = x => ({ x, ...metaOf(x.setId), hintsN, setHints, ansOpen, setAns, onDone, onZoom: setZoom });
  const jump = (x, i) => { if (mode === "one") setCur(i); else document.getElementById(`q-${keyOf(x)}`)?.scrollIntoView({ block: "start", behavior: "smooth" }); };
  const one = qs[Math.min(cur, qs.length - 1)];
  return (
    <div className="st pracp">
      <Style />
      <header className="pr-h"><b>練習問題 ・ {title}</b><Chip tone={dn === qs.length ? "ok" : ""}>できた {dn} / {qs.length}</Chip><span className="st-sp" /><span className="seg"><button type="button" aria-pressed={mode === "one"} onClick={() => setMode("one")}>1問ずつ</button><button type="button" aria-pressed={mode === "all"} onClick={() => setMode("all")}>まとめて</button></span><Btn kind="ghost sm" onClick={onClose}>練習問題の一覧</Btn></header>
      <div className={`pbody ${mode}`}>
        <nav aria-label="問題の一覧">{qs.map((x, i) => <button key={keyOf(x)} type="button" aria-current={mode === "one" && i === cur} onClick={() => jump(x, i)}><span className={`ck${x.done ? " on" : ""}`} aria-hidden="true">{x.done ? "✓" : ""}</span><span><b>{label(x)}</b><small>{x.q.title}</small></span></button>)}</nav>
        <section>
          {mode === "one"
            ? <><Q {...props(one)} /><div className="row st-between"><Btn kind="ghost sm" disabled={!cur} onClick={() => setCur(cur - 1)}>‹ 前の問題</Btn>{cur < qs.length - 1 && <Btn kind="ghost sm" onClick={() => setCur(cur + 1)}>次の問題 ›</Btn>}</div></>
            : qs.map(x => <Q key={keyOf(x)} {...props(x)} />)}
        </section>
      </div>
      {zoomEl}
    </div>
  );
}

// カリキュラムの「解く」から開く窓
export function PracticeDrawer({ title, qs, metaOf, start, onDone, onClose, onOpenPage }) {
  const [cur, setCur] = useState(() => Math.max(0, qs.findIndex(x => keyOf(x) === start)));
  const [hintsN, setHints] = useState({});
  const [ansOpen, setAns] = useState({});
  const [, setZoom, zoomEl] = useZoom();
  const x = qs[Math.min(cur, qs.length - 1)], dn = qs.filter(y => y.done).length, k = keyOf(x), h = hintsN[k] || 0, m = metaOf(x.setId), hints = x.q.hints || [], a = !!ansOpen[k], hasAns = m.showAnswers && !!x.q.answer;
  useEffect(() => { const e = v => v.key === "Escape" && onClose(); window.addEventListener("keydown", e); return () => window.removeEventListener("keydown", e); }, [onClose]);
  return (
    <div className="shade" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <Style />
      <section className="drawer" role="dialog" aria-modal="true" aria-label="練習問題">
        <header><b>練習問題 ・ {title}</b><Chip tone={dn === qs.length ? "ok" : ""}>できた {dn} / {qs.length}</Chip><button type="button" className="x" aria-label="閉じる" onClick={onClose}>×</button></header>
        <div className="in">
          <div className="row">{qs.map((y, i) => <button key={keyOf(y)} type="button" className="fchip" aria-pressed={i === cur} onClick={() => setCur(i)}>{y.done ? "✓ " : ""}{label(y)}</button>)}</div>
          <h3 className="h3">{label(x)} {x.q.title}</h3>
          <Items items={x.q.parts} images={m.images} onZoom={setZoom} />
          {hints.slice(0, h).map((t, j) => <div key={j} className="hint"><b>ヒント {j + 1}</b>　<Rich text={t} /></div>)}
          <span className="row">{h < hints.length && <Btn kind="ghost sm" onClick={() => setHints(v => ({ ...v, [k]: h + 1 }))}>{h ? "次のヒント" : "ヒントを見る"}</Btn>}{hasAns ? <Btn kind="ghost sm" onClick={() => setAns(v => ({ ...v, [k]: !a }))}>{a ? "解答を閉じる" : "解答を見る"}</Btn> : <Chip>解答は講師が確認</Chip>}</span>
          {a && hasAns && <Answer a={x.q.answer} />}
        </div>
        <footer>{onOpenPage && <Btn kind="ghost" onClick={() => onOpenPage(x)}>練習問題の画面で開く</Btn>}<Btn kind={x.done ? "ghost" : ""} onClick={() => onDone(x.setId, x.q.id, !x.done)}>{x.done ? "✓ できた（取り消す）" : "できた"}</Btn></footer>
      </section>
      {zoomEl}
    </div>
  );
}
