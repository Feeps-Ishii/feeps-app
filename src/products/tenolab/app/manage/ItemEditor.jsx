import React, { useEffect, useState } from "react";
import { manage } from "../data.js";
import { THUMB_KINDS, Thumb } from "../ui.jsx";
import { TryPanel } from "../Workbench.jsx";

/* 演習・案件体験の編集（下書き → 試す → 公開）。kind は "drills" | "cases" */
const RUNTIMES = {
  drills: [["js", "JavaScript"], ["web", "HTML / CSS"], ["java", "Java"], ["sql", "SQL"], ["check", "チェック（Gitなど）"], ["aws", "AWS（本物の環境）"]],
  cases: [["js", "JavaScript"], ["web", "HTML / CSS"], ["java", "Java"], ["sql", "SQL"], ["aws", "AWS（本物の環境）"]],
};
const SCENARIOS = [["vpc", "VPCだけを作る（まっさら）"], ["vpcec2", "VPCとEC2でWebサーバー（まっさら）"], ["elb", "ELBを足す（用意済み）"], ["asg", "Auto Scaling（用意済み）"], ["cw", "CloudWatchで異常に気づく（用意済み）"], ["recover", "止まったWebサーバーを復旧（障害あり）"]];
const LEVELS = ["やさしい", "ふつう", "むずかしい"], AWS_LEVELS = ["基礎", "応用", "運用"];
const TEST_HELP = {
  js: "式で確かめます。env に、書いたコードの関数や変数が入っています。例：env.total([120, 80, 300]) === 500",
  web: "式で確かめます。doc が表示した画面の document です。例：getComputedStyle(doc.querySelector('button')).textAlign === 'center'",
  java: "標準出力が「出てほしい出力」と同じならOK（前後の空白は無視）。",
  sql: "受講生のSQLの結果が、答え合わせのSQLの結果と同じならOK。",
  check: "受講生が自分で確かめて付けるチェックです。",
};
const blank = kind => kind === "drills"
  ? { title: "", topic: "", runtime: "js", level: "やさしい", minutes: 10, task: "", hint: "", starterCode: "", answerCode: "", tests: [{ name: "", expr: "" }], premium: false, order: 0, thumb: null }
  : { title: "", topic: "", runtime: "js", summary: "", hours: 2, needCourseId: "", ticket: { id: "", client: "", background: "", scope: [""], notes: "" }, starterCode: "", tests: [{ name: "", expr: "" }], premium: false, order: 0, thumb: null };

function Field({ label, children, wide }) {
  return <label className="mfield" style={wide ? { gridColumn: "1 / -1" } : undefined}><span>{label}</span>{children}</label>;
}

export default function ItemEditor({ kind, id, isNew, topics, courses, go }) {
  const noun = kind === "drills" ? "演習" : "案件体験";
  const [st, setSt] = useState({ state: isNew ? "ready" : "loading" });
  const [item, setItem] = useState(blank(kind));
  const [newId, setNewId] = useState("");
  const [meta, setMeta] = useState({ draftUpdatedAt: null, published: false, changed: true, issues: [] });
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState("");
  const [tryCode, setTryCode] = useState(null);

  useEffect(() => {
    if (isNew) return;
    let alive = true;
    manage.get(kind, id).then(r => {
      if (!alive) return;
      setItem(r.drill || r.case);
      setMeta({ draftUpdatedAt: r.draftUpdatedAt, published: r.published, changed: r.changed, issues: r.issues || [] });
      setSt({ state: "ready" });
    }).catch(e => alive && setSt({ state: "error", status: e?.status }));
    return () => { alive = false; };
  }, [kind, id, isNew]);

  const set = (k, v) => setItem(x => ({ ...x, [k]: v }));
  const setTicket = (k, v) => setItem(x => ({ ...x, ticket: { ...x.ticket, [k]: v } }));
  const setTest = (i, k, v) => setItem(x => ({ ...x, tests: x.tests.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const isAws = item.runtime === "aws";
  const hasCode = !isAws && item.runtime !== "check";

  async function save() {
    const realId = isNew ? newId.trim() : id;
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(realId)) { setMsg({ kind: "ng", text: "IDは英小文字・数字・ハイフンで入れてください（例：sum-array）。" }); return null; }
    setBusy("save"); setMsg({ kind: "", text: "" });
    try {
      const r = await manage.save(kind, realId, { [kind === "drills" ? "drill" : "case"]: item, baseUpdatedAt: isNew ? null : meta.draftUpdatedAt });
      setItem(r.drill || r.case);
      setMeta(m => ({ ...m, draftUpdatedAt: r.draftUpdatedAt, changed: true, issues: r.issues || [] }));
      setMsg({ kind: "ok", text: "下書きを保存しました。" });
      if (isNew) go(`#/manage/${kind}/${realId}`);
      return r;
    } catch (e) {
      setMsg({ kind: "ng", text: e?.status === 409 ? "ほかの人が先に保存しました。読み込み直してから直してください。" : e?.errorMessage || "保存できませんでした。" });
      return null;
    } finally { setBusy(""); }
  }
  async function publish() {
    if (!(await save())) return;
    setBusy("publish");
    try {
      await manage.publish(kind, id);
      setMeta(m => ({ ...m, published: true, changed: false }));
      setMsg({ kind: "ok", text: "公開しました。受講生の一覧に出ます。" });
    } catch (e) {
      setMsg({ kind: "ng", text: e?.status === 422 ? `公開できない箇所があります：${(e?.data?.issues || meta.issues || []).join("、")}` : e?.errorMessage || "公開できませんでした。" });
    } finally { setBusy(""); }
  }
  async function remove() {
    if (!window.confirm(`この${noun}を消します。よろしいですか？（一度も公開していないものだけ消せます）`)) return;
    setBusy("remove");
    try { await manage.remove(kind, id); go(`#/manage/${kind}`); }
    catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || "消せませんでした。" }); }
    finally { setBusy(""); }
  }

  if (st.state === "loading") return <p className="muted">読み込んでいます…</p>;
  if (st.state === "error") return <p className="muted">{st.status === 404 ? `この${noun}は見つかりませんでした。` : "読み込めませんでした。もう一度開いてください。"}</p>;

  return (
    <div className="medit">
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <button type="button" className="back" onClick={() => go(`#/manage/${kind}`)}>← {noun}の一覧</button>
        <span style={{ marginLeft: "auto" }} />
        {!isNew && <span className={`chip ${meta.published ? (meta.changed ? "warn" : "done") : ""}`}>{meta.published ? (meta.changed ? "公開中 ・ 未公開の変更あり" : "公開中") : "下書き"}</span>}
      </div>
      <h1 className="h1" style={{ margin: "8px 0 14px" }}>{isNew ? `${noun}を作る` : item.title || "（名前なし）"}</h1>

      <section className="card mcard">
        <div className="mgrid">
          {isNew && <Field label="ID（URLに使う。あとから変えられません）"><input value={newId} onChange={e => setNewId(e.target.value)} placeholder="sum-array" /></Field>}
          <Field label="名前"><input value={item.title} onChange={e => set("title", e.target.value)} /></Field>
          <Field label="単元">
            <select value={item.topic} onChange={e => set("topic", e.target.value)}>
              <option value="">未設定（その他）</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="実行環境">
            <select value={item.runtime} onChange={e => set("runtime", e.target.value)}>
              {RUNTIMES[kind].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {kind === "drills" ? <>
            <Field label="レベル"><select value={item.level} onChange={e => set("level", e.target.value)}>{(isAws ? AWS_LEVELS : LEVELS).map(l => <option key={l}>{l}</option>)}</select></Field>
            <Field label="目安（分）"><input type="number" min="1" value={item.minutes} onChange={e => set("minutes", Number(e.target.value))} /></Field>
          </> : <>
            <Field label="目安（時間）"><input type="number" min="0.5" step="0.5" value={item.hours} onChange={e => set("hours", Number(e.target.value))} /></Field>
            <Field label="挑戦できる条件（このコースを修了）">
              <select value={item.needCourseId} onChange={e => set("needCourseId", e.target.value)}>
                <option value="">なし（すぐ挑戦できる）</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </Field>
          </>}
          {isAws && <Field label="AWSのシナリオ"><select value={item.aws?.scenario || ""} onChange={e => set("aws", { scenario: e.target.value })}><option value="">選んでください</option>{SCENARIOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>}
          <Field label="並び順（小さいほど前）"><input type="number" min="0" value={item.order} onChange={e => set("order", Number(e.target.value))} /></Field>
          <Field label="Premium"><span className="row" style={{ gap: 6 }}><input type="checkbox" checked={!!item.premium} onChange={e => set("premium", e.target.checked)} />Premiumの人だけ（AWSと、Premiumの単元は自動でPremium）</span></Field>
        </div>
      </section>

      <section className="card mcard">
        <div className="eyebrow">一覧のサムネイル</div>
        <div className="mgrid">
          <Field label="種類">
            <select value={item.thumb?.kind || ""} onChange={e => set("thumb", e.target.value ? { ...(item.thumb || {}), kind: e.target.value } : null)}>
              <option value="">なし</option>
              {THUMB_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
          {item.thumb?.kind === "out" && <Field label="出力の行（1行ずつ・4行まで）"><textarea rows={3} value={(item.thumb.out || []).join("\n")} onChange={e => set("thumb", { ...item.thumb, out: e.target.value.split("\n").slice(0, 4) })} /></Field>}
          <div style={{ maxWidth: 280 }}><Thumb item={item} /></div>
        </div>
      </section>

      {kind === "cases" && (
        <section className="card mcard">
          <div className="eyebrow">チケット</div>
          <div className="mgrid">
            <Field label="概要（一覧に出る1〜2文）" wide><input value={item.summary} onChange={e => set("summary", e.target.value)} /></Field>
            <Field label="チケット番号"><input value={item.ticket?.id || ""} onChange={e => setTicket("id", e.target.value)} placeholder="#RSV-142" /></Field>
            <Field label="依頼元"><input value={item.ticket?.client || ""} onChange={e => setTicket("client", e.target.value)} placeholder="飲食店グループの予約サイト" /></Field>
            <Field label="背景" wide><textarea rows={3} value={item.ticket?.background || ""} onChange={e => setTicket("background", e.target.value)} /></Field>
            <Field label="今回担当する範囲（1行に1つ）" wide><textarea rows={3} value={(item.ticket?.scope || []).join("\n")} onChange={e => setTicket("scope", e.target.value.split("\n"))} /></Field>
            <Field label="参考（任意）" wide><textarea rows={2} value={item.ticket?.notes || ""} onChange={e => setTicket("notes", e.target.value)} /></Field>
          </div>
        </section>
      )}

      <section className="card mcard">
        <div className="eyebrow">{kind === "drills" ? "課題" : "作業"}</div>
        <div className="mgrid">
          {kind === "drills" && <Field label="課題文" wide><textarea rows={3} value={item.task} onChange={e => set("task", e.target.value)} /></Field>}
          {kind === "drills" && <Field label="ヒント" wide><textarea rows={2} value={item.hint} onChange={e => set("hint", e.target.value)} /></Field>}
          {item.runtime === "sql" && <Field label="テーブルを作るSQL（実行の前に毎回流します）" wide><textarea className="mono" rows={5} value={item.sqlSetup || ""} onChange={e => set("sqlSetup", e.target.value)} /></Field>}
          {hasCode && <Field label="はじめのコード" wide><textarea className="mono" rows={8} value={item.starterCode} onChange={e => set("starterCode", e.target.value)} /></Field>}
          {hasCode && kind === "drills" && <Field label="お手本（何回か実行したあと受講生が見られます）" wide><textarea className="mono" rows={8} value={item.answerCode} onChange={e => set("answerCode", e.target.value)} /></Field>}
        </div>
      </section>

      {!isAws && (
        <section className="card mcard">
          <div className="eyebrow">{kind === "drills" ? "テスト" : "受け入れ条件（テスト）"}</div>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>{TEST_HELP[item.runtime]}</p>
          {item.tests.map((t, i) => (
            <div key={i} className="mtest">
              <input value={t.name} onChange={e => setTest(i, "name", e.target.value)} placeholder="名前（受講生に見えます）" />
              {(item.runtime === "js" || item.runtime === "web") && <input className="mono" value={t.expr || ""} onChange={e => setTest(i, "expr", e.target.value)} placeholder="式" />}
              {item.runtime === "java" && <><input className="mono" value={t.stdin || ""} onChange={e => setTest(i, "stdin", e.target.value)} placeholder="入力（任意）" /><input className="mono" value={t.expect || ""} onChange={e => setTest(i, "expect", e.target.value)} placeholder="出てほしい出力" /></>}
              {item.runtime === "sql" && <input className="mono" value={t.query || ""} onChange={e => setTest(i, "query", e.target.value)} placeholder="答え合わせのSQL" />}
              <button type="button" className="btn ghost" onClick={() => set("tests", item.tests.filter((_, j) => j !== i))}>消す</button>
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={() => set("tests", [...item.tests, { name: "" }])} style={{ justifySelf: "start" }}>テストを足す</button>
        </section>
      )}

      {hasCode && (
        <section className="card mcard">
          <div className="row"><div className="eyebrow">試す</div><span className="muted" style={{ fontSize: 13 }}>保存しなくても、ここで動かして確かめられます</span>
            <button type="button" className="btn ghost" style={{ marginLeft: "auto" }} onClick={() => setTryCode(item.starterCode)}>はじめのコードで</button>
            {kind === "drills" && <button type="button" className="btn ghost" onClick={() => setTryCode(item.answerCode)}>お手本で</button>}</div>
          {tryCode != null && <TryPanel key={tryCode} item={item} code={tryCode} setCode={setTryCode} />}
        </section>
      )}

      {meta.issues?.length > 0 && <div className="verdict ng">公開の前に直すところ：{meta.issues.join("、")}</div>}
      {msg.text && <div className={`verdict ${msg.kind}`} role={msg.kind === "ng" ? "alert" : "status"}>{msg.text}</div>}
      <div className="mactions">
        <button type="button" className="btn ghost" onClick={save} disabled={!!busy}>{busy === "save" ? "保存しています…" : "下書きを保存"}</button>
        {!isNew && <button type="button" className="btn" onClick={publish} disabled={!!busy}>{busy === "publish" ? "公開しています…" : meta.published ? "変更を公開する" : "公開する"}</button>}
        {!isNew && !meta.published && <button type="button" className="btn ghost" onClick={remove} disabled={!!busy} style={{ marginLeft: "auto", color: "var(--red)" }}>消す</button>}
      </div>
    </div>
  );
}
