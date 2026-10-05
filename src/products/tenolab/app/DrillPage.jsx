import React, { useEffect, useRef, useState } from "react";
import { Back, Ic, LoadError, Loading, PremTag, StartTag } from "./ui.jsx";
import { TryPanel } from "./Workbench.jsx";
import { cloud, getDrillAnswer, useDrill } from "./data.js";
import { START_OF } from "./model.js";

/* 演習1問（モックの drillPage / awsDrillPage） */
export default function DrillPage({ ctx, id }) {
  const { premium, go, back, progress, topics } = ctx;
  const d = useDrill(id);
  if (d.state === "loading") return <Loading />;
  if (d.state === "error" && d.status === 403) {
    return <><Back onClick={() => back("#/drills")} /><div className="card flat" style={{ padding: 18, marginTop: 12 }}><b><Ic id="lock" /> この実習はPremiumプランで利用できます</b></div></>;
  }
  if (d.state === "error" && d.status === 404) return <><Back onClick={() => back("#/drills")} /><p className="muted">この演習は見つかりませんでした。</p></>;
  if (d.state === "error" || !d.data) return <><Back onClick={() => back("#/drills")} /><LoadError onRetry={d.reload} what="演習を読み込めませんでした" /></>;
  const item = d.data;
  const topic = topics.find(t => t.id === item.topic);
  const rec = progress.drill(item.id);
  if (item.runtime === "aws") return <AwsDrill item={{ ...item, premium: true }} premium={premium} back={back} rec={rec} progress={progress} />;
  return <CodeDrill item={item} topic={topic} back={back} go={go} rec={rec} progress={progress} />;
}

function CodeDrill({ item, topic, back, go, rec, progress }) {
  const [code, setCode] = useState(rec?.code ?? item.starterCode ?? "");
  const [hint, setHint] = useState(false);
  const [answerState, setAnswerState] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const runs = useRef(Number(rec?.runs || 0)), hints = useRef(Number(rec?.hints || 0));
  const cleared = rec?.status === "cleared";

  async function save(status) {
    try {
      await progress.saveDrill(item.id, { status, code, runs: runs.current, hints: hints.current });
      setSaveErr("");
    } catch (e) {
      console.warn("drill save failed", e);
      setSaveErr("記録を保存できませんでした。通信状況を確かめて、もう一度実行してください。");
    }
  }
  function onResult(r) {
    runs.current += 1;
    const ok = r.results.length > 0 && r.results.every(x => x.ok);
    save(ok ? "cleared" : (cleared ? "cleared" : "doing"));
  }
  async function onAnswer() {
    setAnswerState("loading");
    try {
      const res = await getDrillAnswer(item.id);
      if (res?.answerCode) { setCode(res.answerCode); setAnswerState(""); } else setAnswerState("locked");
    } catch (e) {
      setAnswerState(e?.status === 403 ? "locked" : "error");
    }
  }
  return (
    <>
      <Back onClick={() => back("#/drills")} />
      <div className="card slide" style={{ minHeight: 0 }}>
        <div className="row">
          {topic && <span className="eyebrow" style={{ color: topic.color }}>{topic.name}</span>}
          {item.level && <span className="chip">{item.level}</span>}
          {item.minutes ? <span className="chip">約{item.minutes}分</span> : null}
          {cleared && <span className="chip done"><Ic id="check" />クリア済み</span>}
        </div>
        <h1 className="h1">{item.title}</h1>
        {item.task && <p style={{ whiteSpace: "pre-wrap" }}>{item.task}</p>}
        <TryPanel item={item} code={code} setCode={setCode} onResult={onResult}
          onHint={() => { if (!hint) { hints.current += 1; setHint(true); } }} hintShown={hint}
          onAnswer={item.hasAnswer ? onAnswer : null} answerState={answerState} />
        {saveErr && <div className="verdict ng" role="alert">{saveErr}</div>}
      </div>
      {topic && (
        <div className="card flat" style={{ marginTop: 14, padding: "14px 18px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 13 }}>この演習の単元</span><button type="button" className="btn ghost" onClick={() => go(`#/topics/${topic.id}`)}>{topic.name}</button>
        </div>
      )}
    </>
  );
}

/* ---------- AWS の実習（本物の環境） ---------- */
const AWS_CHECK_NAMES = {
  vpc: ["VPC（10.0.0.0/16）がある", "パブリックサブネットが2つ、別のAZにある", "インターネットゲートウェイがつながっている", "ルートテーブルに 0.0.0.0/0 の経路がある"],
  vpcec2: ["VPCとサブネットがある", "EC2が起動している", "セキュリティグループで80番だけ開いている", "ブラウザでページが表示される"],
  elb: ["ALBが2つのAZにある", "ターゲットグループに2台が登録され、正常", "ALBのURLでページが表示される", "EC2へ直接アクセスできない"],
  asg: ["起動テンプレートがある", "Auto Scalingグループ（最小2・最大4）", "CPU使用率で台数が増える設定", "1台止めても自動で戻る"],
  cw: ["CPU使用率のアラームがある", "しきい値80%・5分", "通知先（SNS）につながっている", "テストで通知が届く"],
  recover: ["原因（セキュリティグループの変更）を見つけた", "設定を元に戻した", "ページがまた表示される", "対応メモを残した"],
};
const START_TEXT = {
  blank: "何もないAWS環境から作ります。できたら「採点する」を押してください。",
  ready: "VPC・サブネット・EC2が用意された環境から始めます。今回は足りない部分だけを作ります。",
  trouble: "Webサーバーが表示されなくなった環境から始めます。原因を探して直してください。",
};
const fmtLeft = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function AwsDrill({ item, premium, back, rec, progress }) {
  const start = START_OF[item.aws?.scenario] || "blank";
  const cleared = rec?.status === "cleared";
  return (
    <>
      <Back onClick={() => back("#/drills")} />
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        <div className="row"><PremTag item={item} premium={premium} />{item.level && <span className="chip">{item.level}</span>}{item.minutes ? <span className="chip">約{item.minutes}分</span> : null}<StartTag start={start} />{cleared && <span className="chip done"><Ic id="check" />クリア済み</span>}</div>
        <h1 className="h1">{item.title}</h1>
      </div>
      <AwsEnvPanel scenario={item.aws?.scenario || item.id} start={start} task={item.task} onGraded={r => { if (r?.allOk) progress.reload(); }} />
    </>
  );
}

/* 本物の環境の操作（用意する・コンソール・採点・作り直す・片付ける）。案件体験でも使う */
export function AwsEnvPanel({ scenario, start = "blank", task, onGraded, readOnly }) {
  const [sess, setSess] = useState({ state: "loading" });   // loading | none | preparing | ready | other | error
  const [graded, setGraded] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const [note, setNote] = useState({ cause: "", note: "" });
  const [reopen, setReopen] = useState(false);

  async function load() {
    try {
      const s = await cloud.session();
      const cur = s?.session;
      if (!cur) setSess({ state: "none", info: s });
      else if (cur.scenario && cur.scenario !== scenario) setSess({ state: "other", session: cur, info: s });
      else {
        // stage：waiting_vpc（自分でVPCを作るのを待っている）| preparing | ready | failed
        const stage = cur.stage || "ready";
        setSess(prev => {
          if (prev.session?.consolePhase === "create_vpc" && cur.consolePhase === "full") setReopen(true);
          return { state: stage === "preparing" ? "preparing" : stage === "failed" ? "failed" : "ready", session: cur, info: s };
        });
      }
    } catch (e) {
      setSess({ state: "error", status: e?.status });
    }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 用意している間（自分でVPCを作るのを待つ間も）は5秒ごとに確かめる。残り時間の表示は1秒ごと
  const waitingVpc = sess.session?.stage === "waiting_vpc";
  useEffect(() => {
    if (sess.state !== "preparing" && !waitingVpc) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [sess.state, waitingVpc]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sess.state !== "ready") return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sess.state]);

  async function act(kind, fn) {
    if (busy) return;
    setBusy(kind); setErr("");
    try { await fn(); }
    catch (e) {
      setErr(e?.status === 409 ? "いまは環境の空きがありません。少し時間をおいてから試してください。"
        : e?.status === 403 ? "この実習はPremiumプランで利用できます。"
          : (e?.errorMessage || "うまくいきませんでした。もう一度試してください。"));
    } finally { setBusy(""); }
  }
  const startEnv = () => act("start", async () => { await cloud.start(scenario); setGraded(null); await load(); });
  const openConsole = () => act("console", async () => { const r = await cloud.console(); setReopen(false); if (r?.url) window.open(r.url, "_blank", "noopener"); });
  const grade = () => act("grade", async () => {
    const r = await cloud.check(scenario);
    setGraded(r);
    onGraded && onGraded(r);
  });
  const reset = () => act("reset", async () => { await cloud.stop(); await cloud.start(scenario); setGraded(null); await load(); });
  const stop = () => act("stop", async () => { await cloud.stop(); setGraded(null); await load(); });
  const saveNote = () => act("note", async () => { await cloud.note(scenario, note); });

  const names = AWS_CHECK_NAMES[scenario] || [];
  const checks = graded?.checks || names.map((name, i) => ({ id: String(i), name, ok: false, pending: true }));
  const s = sess.session;
  const left = s?.expiresAt ? new Date(s.expiresAt).getTime() - now : null;

  return (
    <>
      <div className="env">
        <div style={{ display: "grid", gap: 16 }}>
          <section className="card" style={{ padding: "18px 20px", display: "grid", gap: 10 }}>
            <div className="eyebrow">やること</div>
            <p style={{ margin: 0, color: "var(--ink2)", whiteSpace: "pre-wrap" }}>{task || START_TEXT[start]}</p>
            <ul className="checks">{checks.map(c => <li key={c.id} className={c.ok ? "ok" : ""}><i>{c.ok ? "✓" : ""}</i>{c.name}{!c.ok && c.detail && <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>（{c.detail}）</span>}</li>)}</ul>
          </section>
          <section className="console-aws" aria-live="polite">
            {sess.state === "loading" && <span className="mute">$ 環境を確かめています…</span>}
            {sess.state === "error" && <span className="mute">$ 環境の状態を確かめられませんでした。ページを読み込み直してください。</span>}
            {sess.state === "none" && <span className="mute">$ 環境はまだありません</span>}
            {sess.state === "other" && <span className="mute">$ ほかの実習の環境が動いています。片付けてから始めてください。</span>}
            {sess.state === "failed" && <span className="mute">$ {s?.error || "環境を用意できませんでした。"}片付けて、もう一度用意してください。</span>}
            {sess.state === "preparing" && <><span>$ 練習用のAWS環境を用意しています…</span><span className="mute">数分かかることがあります。このままお待ちください</span></>}
            {sess.state === "ready" && <><span className="ok">✓ 環境ができました（{s?.region || "東京リージョン"}）</span>{left != null && <span className="mute">残り時間 {fmtLeft(left)} ・ 時間になると自動で片付けます</span>}</>}
            {sess.state === "ready" && waitingVpc && s?.tag && <span>$ VPCを作るときは、タグ {s.tag.key} = {s.tag.value} を付けてください（「VPCのみ」で作成）</span>}
            {sess.state === "ready" && s?.namePrefix && start !== "blank" && <span className="mute">ALB・Auto Scaling・アラームなどの名前は「{s.namePrefix}」で始めてください</span>}
            {reopen && <span className="ok">✓ VPCを確認しました。続きの操作のため、コンソールを開き直してください</span>}
          </section>
          {scenario === "recover" && sess.state === "ready" && (
            <section className="card" style={{ padding: "16px 18px", display: "grid", gap: 8 }}>
              <div className="eyebrow">対応メモ</div>
              <label className="row" style={{ gap: 8, display: "grid" }}><span style={{ fontSize: 13, fontWeight: 700 }}>原因</span><input value={note.cause} onChange={e => setNote({ ...note, cause: e.target.value })} style={{ font: "inherit", padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8 }} /></label>
              <label style={{ display: "grid", gap: 4 }}><span style={{ fontSize: 13, fontWeight: 700 }}>やったこと</span><textarea value={note.note} onChange={e => setNote({ ...note, note: e.target.value })} rows={3} style={{ font: "inherit", padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8 }} /></label>
              <button className="btn ghost" type="button" onClick={saveNote} disabled={!note.cause.trim() || !note.note.trim() || !!busy} style={{ justifySelf: "start" }}>{busy === "note" ? "保存しています…" : "メモを残す"}</button>
            </section>
          )}
          {graded && (
            <section className="card review">
              <div className="row"><span className="eyebrow">採点</span><span className={`chip ${graded.allOk ? "done" : ""}`}><Ic id="check" />{checks.filter(c => c.ok).length} / {checks.length}</span></div>
              <div className="rv"><div className="who">✓</div><div className="bubble">{graded.allOk ? "すべて確認できました。" : "まだ確認できない項目があります。カッコの中の内容を手がかりに、コンソールで見直してみましょう。"}</div></div>
            </section>
          )}
          {err && <div className="verdict ng" role="alert">{err}</div>}
        </div>
        <aside className="card" style={{ padding: 18, display: "grid", gap: 12, alignContent: "start" }}>
          <div className="eyebrow">環境</div>
          {(sess.state === "none" || sess.state === "failed") && <button className="btn" type="button" onClick={startEnv} disabled={!!busy} style={{ justifyContent: "center" }}>{busy === "start" ? "用意しています…" : "環境を用意する"}</button>}
          {sess.state === "preparing" && <button className="btn" type="button" disabled style={{ justifyContent: "center" }}>用意しています…</button>}
          {sess.state === "ready" && !readOnly && <>
            <button className="btn" type="button" onClick={openConsole} disabled={!!busy} style={{ justifyContent: "center" }}>AWSのコンソールを開く ↗</button>
            <button className="btn dark" type="button" onClick={grade} disabled={!!busy} style={{ justifyContent: "center" }}>{busy === "grade" ? "採点しています…" : "採点する"}</button>
            <button className="btn ghost" type="button" onClick={reset} disabled={!!busy} style={{ justifyContent: "center" }}>{busy === "reset" ? "作り直しています…" : "最初の状態に戻す"}</button>
          </>}
          {(sess.state === "ready" || sess.state === "other" || sess.state === "failed") && <button className="btn ghost" type="button" onClick={stop} disabled={!!busy} style={{ justifyContent: "center" }}>{busy === "stop" ? "片付けています…" : "環境を片付ける"}</button>}
          {sess.state === "error" && <button className="btn ghost" type="button" onClick={load} style={{ justifyContent: "center" }}>もう一度確かめる</button>}
          <div className="muted" style={{ fontSize: 12.5, display: "grid", gap: 4 }}><span>・1回 90分まで（延長できます）</span><span>・終わったら自動で片付けます</span></div>
        </aside>
      </div>
    </>
  );
}
