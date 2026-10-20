import React, { useEffect, useMemo, useState } from "react";
import { apiPost } from "../../../../api.js";
import { admin } from "../data.js";
import { Title } from "./parts.jsx";
import { makePassword } from "../../../../utils/common/password.js";
import "./accountIssue.css";

/* アカウントを発行する（管理者のみ。2026-10-16、モック devhub-account-issue.html）
   #/manage/accounts[/{companyId}]
   依頼（ざっくりした文）→ 案（企業・人数・受講枠・ID・使い始め・確かめること。AI が読み取り、直せる）→ 一覧 → 発行 → お客さま向け Excel。
   ログインIDは {頭}-001@id.devhub-lms.com（メールは届かない）。本人は初回ログインでパスワード、次に名前とメールアドレスを登録する。
   仮パスワードはこの画面にしか出ない（保存しない）。企業の登録・受講枠の追加は「発行する」を押したときに行う */
const LOGIN_URL = "https://learn.devhub-lms.com/";
const CHUNK = 10;
const EXAMPLES = ["みなと文具さんに新入社員20名分。4月1日から。うち3名はPremiumで", "さくら精機 5アカウント 来週から研修", "既存の企業に追加で8名。来月から"];

const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+/, "").slice(0, 24);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayYmd = () => ymd(new Date());
const slashDate = s => (s ? s.replace(/-/g, "/").replace(/\/0(\d)/g, "/$1") : "");
const daysUntil = s => (s ? Math.round((Date.parse(`${s}T00:00:00`) - Date.parse(`${todayYmd()}T00:00:00`)) / 86400000) : 0);
const PLAN_NAME = { standard: "スタンダード", premium: "Premium", basic: "ベーシック" };

async function downloadExcel({ company, start, rows }) {
  const XLSX = await import("xlsx");
  const aoa = [
    ["DevHub Learning　アカウントのご案内"],
    [],
    ["企業名", company],
    ["発行日", slashDate(todayYmd())],
    ...(start ? [["使い始め", slashDate(start)]] : []),
    ["ログインの画面", LOGIN_URL],
    ["人数", `${rows.length}名`],
    [],
    ["はじめてのログインのしかた"],
    ["1. ログインの画面で、下の「ログインID」と「仮パスワード」を入れます。"],
    ["2. 新しいパスワードを決めます（8文字以上・英大文字・英小文字・数字・記号を含む）。"],
    ["3. お名前とメールアドレスを登録します。メールに届く確認コードを入れると完了です。"],
    ["4. 次からは、登録したメールアドレスと新しいパスワードでログインします。"],
    ["※ 仮パスワードは発行から30日で使えなくなります。この表は大切に保管し、お渡し後は削除してください。"],
    [],
    ["No", "お名前（仮）", "ログインID", "仮パスワード", "プラン", "お渡し先（ご記入ください）"],
    ...rows.map((r, i) => [i + 1, r.name, r.loginId, r.password, PLAN_NAME[r.seatPlan] || "", ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 38 }, { wch: 18 }, { wch: 14 }, { wch: 26 }];
  const head = aoa.findIndex(r => r[0] === "はじめてのログインのしかた");
  ws["!merges"] = [0, head, head + 1, head + 2, head + 3, head + 4, head + 5].map(r => ({ s: { r, c: 0 }, e: { r, c: 5 } }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "アカウント");
  XLSX.writeFile(wb, `DevHub Learning アカウント_${company}_${todayYmd().replace(/-/g, "")}.xlsx`);
}

export default function AccountIssue({ go, companyId: presetId }) {
  const [ov, setOv] = useState(null); // 企業の一覧（受講枠・契約）
  const [text, setText] = useState("");
  const [step, setStep] = useState(presetId ? 2 : 1);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });
  // 案（直せる）
  const [p, setP] = useState(null);
  const [answers, setAnswers] = useState({});
  const [rows, setRows] = useState(null);

  const loadOv = () => admin.overview().then(d => { setOv(d?.companies || []); return d?.companies || []; }).catch(() => { setOv([]); return []; });
  useEffect(() => {
    loadOv().then(list => {
      if (!presetId) return;
      const c = list.find(x => x.companyId === presetId);
      setP({ companyId: presetId, newName: "", count: 10, premium: 0, prefix: slug(presetId).slice(0, 12) || "user", namePrefix: "受講者", start: "", notes: [], quote: c ? `${c.name} のアカウント` : "" });
    });
  }, [presetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const co = useMemo(() => (p?.companyId ? (ov || []).find(c => c.companyId === p.companyId) || null : null), [p?.companyId, ov]);
  const n = Math.max(0, Math.floor(Number(p?.count) || 0));
  const prem = Math.max(0, Math.min(n, Math.floor(Number(p?.premium) || 0)));
  const seatBilling = co ? co.billingMode === "seat" : true; // 新しく登録する企業は「人数で決める枠」
  const std = n - (seatBilling ? prem : 0);
  const stdLeft = co ? co.seats.standard.total - co.seats.standard.used : 0;
  const premLeft = co ? co.seats.premium.total - co.seats.premium.used : 0;
  const addStd = co && seatBilling ? Math.max(0, std - stdLeft) : 0;
  const addPrem = co && seatBilling ? Math.max(0, prem - premLeft) : 0;

  // 確かめること（案の中身から決まる）。[key, 文, [[値, ラベル]], おすすめ]
  const questions = [];
  if (p && !p.companyId) questions.push(["company", `「${p.newName || "（企業名なし）"}」は登録されていません。`, [["new", "新しく登録する（Eラーニング・人数で決める枠）"], ["pick", "登録済みの企業から選ぶ"]], "new"]);
  if (co && !co.elearning) questions.push(["elearning", `${co.name} はEラーニングが無効（研修のLMSだけ）です。`, [["on", "Eラーニングを有効にする"], ["stop", "発行をやめる"]], "on"]);
  if (co && (addStd || addPrem)) questions.push(["seats", `受講枠が足りません（${addStd ? `スタンダード +${addStd}` : ""}${addStd && addPrem ? " ・ " : ""}${addPrem ? `Premium +${addPrem}` : ""}）。`, [["add", "枠を増やして発行する"], ["fit", "枠の中だけ発行する"]], "add"]);
  if (co && !seatBilling && prem) questions.push(["premflat", `${co.name} は枠なし（企業のプラン：${PLAN_NAME[co.learningPlan] || "—"}）なので、Premium の人数は使いません。`, [["ok", "わかった"]], "ok"]);
  if (p?.start && daysUntil(p.start) > 30) questions.push(["early", `使い始め（${slashDate(p.start)}）まで30日より先です。仮パスワードは発行から30日で使えなくなります。`, [["now", "今すぐ発行する"], ["later", "近くなってから発行する"]], "later"]);
  const open = questions.filter(([k]) => answers[k] == null).length;
  const stop = answers.elearning === "stop" || answers.early === "later" || (answers.company === "pick" && !p?.companyId);
  // 枠の中だけ発行するときの人数
  const fitN = answers.seats === "fit" ? Math.max(0, Math.min(std, stdLeft)) + Math.max(0, Math.min(prem, premLeft)) : n;

  async function propose() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy("propose"); setMsg({ kind: "", text: "" }); setAnswers({}); setRows(null);
    try {
      const r = await apiPost("/admin/accounts/propose", { text: t });
      const list = ov?.length ? ov : await loadOv();
      const id = r?.company?.exists ? r.company.id : "";
      const base = id ? list.find(c => c.companyId === id) : null;
      setP({ companyId: id, newName: id ? "" : r?.company?.name || "", count: r?.count || 10, premium: r?.premium || 0, prefix: slug(r?.prefix || (base ? base.companyId : "")).slice(0, 24) || "user", prefixReused: !!r?.prefixReused, namePrefix: r?.namePrefix || "受講者", start: r?.start || "", notes: r?.notes || [], quote: t });
      setStep(2);
    } catch (e) {
      setMsg({ kind: "ng", text: e?.errorMessage || "依頼を読み取れませんでした。もう一度お試しください。" });
    } finally { setBusy(""); }
  }
  async function toList() {
    if (busy) return;
    setBusy("list"); setMsg({ kind: "", text: "" });
    try {
      const count = fitN;
      const r = await apiPost("/admin/accounts/plan", { prefix: p.prefix, count });
      const ids = r?.loginIds || [];
      const w = Math.max(2, String(count).length);
      // Premium は一覧の後ろの人（席の契約のときだけ）。枠の中だけのときは、空きのぶんだけ
      const premN = !seatBilling ? 0 : answers.seats === "fit" ? Math.max(0, Math.min(prem, premLeft)) : prem;
      setRows(ids.map((loginId, i) => ({ loginId, name: `${p.namePrefix || "受講者"}${String(i + 1).padStart(w, "0")}`, password: makePassword(), seatPlan: seatBilling ? (i >= ids.length - premN ? "premium" : "standard") : "", state: "", error: "" })));
      setStep(3);
    } catch (e) {
      setMsg({ kind: "ng", text: e?.errorMessage || "一覧を作れませんでした。" });
    } finally { setBusy(""); }
  }
  async function issue() {
    if (!rows?.length || busy) return;
    setBusy("issue"); setMsg({ kind: "", text: "" });
    let companyId = p.companyId;
    try {
      // 先に企業の登録・Eラーニングの有効化・受講枠の追加
      if (!companyId) {
        const r = await apiPost("/companies", { name: p.newName.trim() });
        companyId = r?.companyId;
        if (!companyId) throw new Error("企業を登録できませんでした。");
        const s = rows.filter(r => r.seatPlan === "standard").length, pm = rows.filter(r => r.seatPlan === "premium").length;
        await admin.saveCompany(companyId, { elearning: true, learningPlan: pm ? "premium" : "standard", billingMode: "seat", seats: { standard: s, premium: pm }, contract: { feeMonthly: 0, startMonth: "", endMonth: "", awsCapMonthly: 0 } });
        setP(x => ({ ...x, companyId }));
      } else if (co && (answers.elearning === "on" || answers.seats === "add")) {
        await admin.saveCompany(companyId, {
          elearning: true, learningPlan: co.learningPlan || "standard", billingMode: co.billingMode,
          seats: co.billingMode === "seat" ? { standard: co.seats.standard.total + addStd, premium: co.seats.premium.total + addPrem } : undefined,
          contract: { feeMonthly: co.contract?.feeMonthly || 0, startMonth: co.contract?.startMonth || "", endMonth: co.contract?.endMonth || "", awsCapMonthly: co.contract?.awsCapMonthly || 0 },
        });
      }
    } catch (e) {
      setMsg({ kind: "ng", text: e?.errorMessage || e?.message || "企業の登録・受講枠の追加ができませんでした。" });
      setBusy(""); return;
    }
    const list = rows.map(r => ({ ...r }));
    for (let i = 0; i < list.length; i += CHUNK) {
      const part = list.slice(i, i + CHUNK).filter(r => r.state !== "ok");
      if (!part.length) continue;
      try {
        const r = await apiPost("/admin/accounts/batch", { companyId, accounts: part.map(({ loginId, name, password, seatPlan }) => ({ loginId, name, password, seatPlan })) });
        for (const x of r?.results || []) { const row = list.find(y => y.loginId === x.loginId); if (row) { row.state = x.ok ? "ok" : "ng"; row.error = x.error || ""; } }
      } catch (e) {
        part.forEach(row => { row.state = "ng"; row.error = e?.errorMessage || "作れませんでした"; });
      }
      setRows(list.map(r => ({ ...r })));
    }
    const ng = list.filter(r => r.state === "ng").length;
    setMsg(ng ? { kind: "ng", text: `${list.length - ng}件を発行しました。${ng}件は作れませんでした（もう一度「発行する」で、作れなかった分だけやり直せます）。` } : { kind: "ok", text: `${list.length}件を発行しました。Excelを受け取ってください（仮パスワードはこの画面を離れると見られません）。` });
    setStep(ng ? 3 : 4);
    setBusy("");
    loadOv();
  }

  const okRows = (rows || []).filter(r => r.state === "ok");
  const companyName = co?.name || p?.newName || "";
  const STEPS = ["依頼", "案", "一覧", "発行", "Excel"];
  return (
    <div className="ai-page">
      <Title eyebrow="ACCOUNTS" title="アカウントを発行する" />
      <div className="ai-flow">{STEPS.map((t, i) => <span key={t} className={i + 1 < step ? "done" : i + 1 === step ? "on" : ""}><i>{i + 1 < step ? "✓" : i + 1}</i>{t}</span>)}</div>

      {step <= 2 && (
        <section className="card ai-ask">
          <label htmlFor="ai-req"><b>依頼</b></label>
          <textarea id="ai-req" value={text} onChange={e => setText(e.target.value)} rows={3} placeholder={EXAMPLES[0]} onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) propose(); }} />
          <div className="ai-ex"><small>例</small>{EXAMPLES.map(x => <button key={x} type="button" onClick={() => setText(x)}>{x}</button>)}</div>
          <div className="ai-row"><span className="sp" /><button type="button" className="btn" disabled={!text.trim() || busy === "propose"} onClick={propose}>{busy === "propose" ? "読み取っています…" : "案を出す"}</button></div>
        </section>
      )}

      {step === 2 && p && (
        <div className="ai-plan">
          <section className="card ai-pc">
            <div className="hd"><b>こう作ります</b><span className="chip">案</span><small className="muted">直せます</small></div>
            {p.quote && <p className="quote">{p.quote}</p>}
            <div className="items">
              <div className="it"><span>企業</span><div className="v">
                <select id="ai-co" value={p.companyId || "_new"} onChange={e => setP(x => ({ ...x, companyId: e.target.value === "_new" ? "" : e.target.value }))}>
                  <option value="_new">{p.newName ? `新しく登録：${p.newName}` : "新しく登録する"}</option>
                  {(ov || []).map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
                </select>
                {!p.companyId && <input id="ai-newname" value={p.newName} onChange={e => setP(x => ({ ...x, newName: e.target.value.slice(0, 60) }))} placeholder="企業名" />}
                {co ? <span className="chip done">登録済み</span> : <span className="chip">新しく登録</span>}
              </div><small className="muted">{co ? (co.elearning ? `プラン ${PLAN_NAME[co.learningPlan] || "—"} ・ ${co.billingMode === "seat" ? "人数で決める枠" : "枠なし"}` : "Eラーニングなし") : ""}</small></div>
              <div className="it"><span>人数</span><div className="v"><input id="ai-n" className="num" type="number" min="1" max="200" value={p.count} onChange={e => setP(x => ({ ...x, count: e.target.value }))} /> 名
                {seatBilling && <> ・ うち Premium <input id="ai-prem" className="num" type="number" min="0" max={n} value={p.premium} onChange={e => setP(x => ({ ...x, premium: e.target.value }))} /> 名</>}</div><span /></div>
              {co && seatBilling && <div className="it"><span>受講枠</span><div className="v">
                <span className="muted">スタンダード 残り {stdLeft} ・ Premium 残り {premLeft}</span>
                {addStd || addPrem ? <span className="chip warn">足りません</span> : <span className="chip done">枠の中</span>}
              </div><span /></div>}
              <div className="it"><span>ログインID</span><div className="v"><input id="ai-prefix" className="id" value={p.prefix} onChange={e => setP(x => ({ ...x, prefix: slug(e.target.value) }))} /><span className="mono">-001〜@id.devhub-lms.com</span></div><small className="muted">{p.prefixReused ? "前に使った頭の続き" : "使っていない番号から"}</small></div>
              <div className="it"><span>仮の名前</span><div className="v"><input id="ai-name" className="id" value={p.namePrefix} onChange={e => setP(x => ({ ...x, namePrefix: e.target.value.slice(0, 10) }))} /><span className="mono">01〜</span></div><span /></div>
              <div className="it"><span>使い始め</span><div className="v"><input id="ai-start" type="date" value={p.start} onChange={e => setP(x => ({ ...x, start: e.target.value }))} /></div><small className="muted">仮パスワードの期限 30日</small></div>
            </div>
            {p.notes?.length > 0 && <ul className="notes">{p.notes.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          </section>
          <div className="ai-side">
            <section className="card ai-q">
              <h3>確かめること <span className={`chip ${open ? "warn" : "done"}`}>{questions.length ? (open ? `のこり ${open}` : "決まり") : "なし"}</span></h3>
              {questions.map(([k, q, opts]) => (
                <div key={k} className={`qi ${answers[k] != null ? "done" : ""}`}><p>{q}</p><div className="ch">{opts.map(([v, l]) => <button key={v} type="button" aria-pressed={answers[k] === v} onClick={() => setAnswers(a => ({ ...a, [k]: v }))}>{l}</button>)}</div></div>
              ))}
            </section>
            <section className="card ai-sum">
              <div><span>発行する人数</span><b>{fitN} 名</b></div>
              <div><span>企業</span><b>{companyName || "—"}</b></div>
              {(addStd || addPrem) > 0 && answers.seats === "add" && <div><span>受講枠を増やす</span><b>+{addStd + addPrem}</b></div>}
              {stop && <p className="verdict ng" style={{ margin: 0 }}>{answers.early === "later" ? "使い始めが近くなってから、もう一度依頼してください。" : answers.elearning === "stop" ? "発行をやめました。" : "上の「企業」で登録済みの企業を選んでください。"}</p>}
            </section>
            <div className="ai-row">{!presetId && <button type="button" className="btn ghost" onClick={() => { setStep(1); setP(null); }}>依頼を書き直す</button>}<span className="sp" /><button type="button" className="btn" disabled={!!open || stop || !fitN || !p.prefix || (!p.companyId && !p.newName.trim()) || busy === "list"} onClick={toList}>{busy === "list" ? "作っています…" : "一覧を見る"}</button></div>
          </div>
        </div>
      )}

      {step >= 3 && rows && (
        <section className="card ai-list">
          <div className="ai-row hd"><b>{companyName} ・ {rows.length}名</b>{okRows.length === rows.length && <span className="chip done">発行済み</span>}<span className="sp" />
            {!okRows.length && <button type="button" className="btn ghost" disabled={!!busy} onClick={() => { setStep(2); setRows(null); }}>案に戻る</button>}
            {okRows.length < rows.length && <button type="button" className="btn" disabled={!!busy} onClick={issue}>{busy === "issue" ? `発行しています…（${okRows.length} / ${rows.length}）` : `${rows.length - okRows.length}件を発行する`}</button>}
            {okRows.length > 0 && <button type="button" className="btn" disabled={busy === "issue"} onClick={() => { downloadExcel({ company: companyName, start: p.start, rows: okRows }); setStep(5); }}>Excelで受け取る（{okRows.length}件）</button>}
          </div>
          <div className="tblwrap" style={{ maxHeight: 460, overflow: "auto" }}>
            <table className="mtbl">
              <thead><tr><th className="rt">No</th><th>名前（仮）</th><th>ログインID</th><th>仮パスワード</th>{seatBilling && <th>プラン</th>}<th>状態</th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={r.loginId}>
                  <td className="rt num">{i + 1}</td>
                  <td><input aria-label={`${i + 1}人目の名前`} value={r.name} disabled={r.state === "ok" || busy === "issue"} onChange={e => setRows(list => list.map((x, j) => (j === i ? { ...x, name: e.target.value.slice(0, 40) } : x)))} style={{ width: "100%", minWidth: 110 }} /></td>
                  <td className="mono" style={{ fontSize: 13 }}>{r.loginId}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{r.password}</td>
                  {seatBilling && <td>{r.seatPlan === "premium" ? <span className="chip prem">Premium</span> : <span className="muted" style={{ fontSize: 12 }}>スタンダード</span>}</td>}
                  <td>{r.state === "ok" ? <span className="chip done">発行済み</span> : r.state === "ng" ? <span className="chip" style={{ color: "var(--red, #D9483B)" }}>× {r.error}</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
      {msg.text && <div className={`verdict ${msg.kind}`} role={msg.kind === "ng" ? "alert" : "status"}>{msg.text}</div>}
      {step >= 4 && co && <button type="button" className="btn ghost" style={{ justifySelf: "start" }} onClick={() => go(`#/manage/companies/${encodeURIComponent(co.companyId)}`)}>{co.name} のページへ</button>}
    </div>
  );
}
