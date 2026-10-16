import React, { useState } from "react";
import { apiPost } from "../../../../api.js";

/* アカウントをまとめて発行（管理者のみ。2026-10-16）
   人数とIDの頭を入れる → 仮の一覧（名前・ログインID・仮パスワード）を出す → 発行 → お客さまに送れる Excel。
   ログインIDは {頭}-001@id.devhub-lms.com（メールは届かない）。本人は初回ログインでパスワードを変え、
   次に名前とメールアドレスを登録する。仮パスワードはこの画面にしか出ない（保存しない） */
const LOGIN_URL = "https://learn.devhub-lms.com/";
const CHUNK = 10;

// 仮パスワード（12文字。英大文字・英小文字・数字・記号を1つ以上。見まちがえやすい文字は使わない）
function makePassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "#$%&@!?"];
  const all = sets.join("");
  const r = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const chars = sets.map(s => s[r(s.length)]);
  while (chars.length < 12) chars.push(all[r(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = r(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}
const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+/, "").slice(0, 24);
const today = () => { const d = new Date(); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };

async function downloadExcel(company, rows) {
  const XLSX = await import("xlsx");
  const aoa = [
    ["DevHub Learning　アカウントのご案内"],
    [],
    ["企業名", company],
    ["発行日", today()],
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
    ["No", "お名前（仮）", "ログインID", "仮パスワード", "お渡し先（ご記入ください）"],
    ...rows.map((r, i) => [i + 1, r.name, r.loginId, r.password, ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 38 }, { wch: 18 }, { wch: 26 }];
  ws["!merges"] = [0, 7, 8, 9, 10, 11, 12].map(r => ({ s: { r, c: 0 }, e: { r, c: 4 } }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "アカウント");
  XLSX.writeFile(wb, `DevHub Learning アカウント_${company}_${today().replace(/\//g, "")}.xlsx`);
}

export default function BatchAccounts({ c, onDone }) {
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState(() => slug(c.companyId).slice(0, 12) || "user");
  const [namePrefix, setNamePrefix] = useState("受講者");
  const [plan, setPlan] = useState(null); // [{ loginId, name, password, state: "" | "ok" | "ng", error }]
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const seatLeft = c.billingMode === "seat" ? (c.seats.standard.total - c.seats.standard.used) + (c.seats.premium.total - c.seats.premium.used) : null;
  const done = plan && plan.every(r => r.state === "ok" || r.state === "ng");
  const okRows = (plan || []).filter(r => r.state === "ok");

  async function makePlan() {
    setBusy("plan"); setMsg({ kind: "", text: "" });
    try {
      const n = Math.max(1, Math.min(200, Number(count) || 0));
      const r = await apiPost("/admin/accounts/plan", { prefix, count: n });
      const w = String(n).length < 2 ? 2 : String(n).length;
      setPlan((r?.loginIds || []).map((loginId, i) => ({ loginId, name: `${namePrefix}${String(i + 1).padStart(w, "0")}`, password: makePassword(), state: "", error: "" })));
    } catch (e) {
      setMsg({ kind: "ng", text: e?.errorMessage || "一覧を作れませんでした。" });
    } finally { setBusy(""); }
  }
  async function issue() {
    if (!plan?.length || busy) return;
    setBusy("issue"); setMsg({ kind: "", text: "" });
    const rows = plan.map(r => ({ ...r }));
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK).filter(r => r.state !== "ok");
      if (!part.length) continue;
      try {
        const r = await apiPost("/admin/accounts/batch", { companyId: c.companyId, accounts: part.map(({ loginId, name, password }) => ({ loginId, name, password })) });
        for (const x of r?.results || []) { const row = rows.find(y => y.loginId === x.loginId); if (row) { row.state = x.ok ? "ok" : "ng"; row.error = x.error || ""; } }
      } catch (e) {
        part.forEach(row => { row.state = "ng"; row.error = e?.errorMessage || "作れませんでした"; });
      }
      setPlan(rows.map(r => ({ ...r })));
    }
    const ng = rows.filter(r => r.state === "ng").length;
    setMsg(ng ? { kind: "ng", text: `${rows.length - ng}件を発行しました。${ng}件は作れませんでした（もう一度「発行する」で作れなかった分だけやり直せます）。` } : { kind: "ok", text: `${rows.length}件を発行しました。Excelを受け取ってください（仮パスワードはこの画面を離れると見られません）。` });
    setBusy("");
    onDone?.();
  }

  return (
    <section className="card msec" style={{ marginTop: 16 }}>
      <h2>アカウントをまとめて発行</h2>
      <div className="mgrid">
        <label className="mfield"><span>人数</span><input id="ba-count" type="number" min="1" max="200" value={count} disabled={!!plan} onChange={e => setCount(e.target.value)} /></label>
        <label className="mfield"><span>IDの頭（英小文字・数字・-）</span><input id="ba-prefix" value={prefix} disabled={!!plan} onChange={e => setPrefix(slug(e.target.value))} placeholder="minato" /></label>
        <label className="mfield"><span>仮の名前</span><input id="ba-name" value={namePrefix} disabled={!!plan} onChange={e => setNamePrefix(e.target.value.slice(0, 20))} /></label>
        <div className="mfield"><span>できるID</span><code className="mono" style={{ fontSize: 13, paddingTop: 8 }}>{prefix || "…"}-001@id.devhub-lms.com</code></div>
      </div>
      {seatLeft != null && Number(count) > seatLeft && <div className="verdict ng" role="alert" style={{ marginTop: 10 }}>受講枠の残りは {seatLeft} 人です（枠を超える人は受講できません）。</div>}
      {!plan ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}><button type="button" className="btn" disabled={busy === "plan" || !prefix || !(Number(count) >= 1)} onClick={makePlan}>{busy === "plan" ? "作っています…" : "一覧を作る"}</button></div>
      ) : (
        <>
          <div className="tblwrap" style={{ marginTop: 12, maxHeight: 420, overflow: "auto" }}>
            <table className="mtbl">
              <thead><tr><th className="rt">No</th><th>名前（仮）</th><th>ログインID</th><th>仮パスワード</th><th>状態</th></tr></thead>
              <tbody>
                {plan.map((r, i) => (
                  <tr key={r.loginId}>
                    <td className="rt num">{i + 1}</td>
                    <td><input aria-label={`${i + 1}人目の名前`} value={r.name} disabled={r.state === "ok" || busy === "issue"} onChange={e => setPlan(p => p.map((x, j) => (j === i ? { ...x, name: e.target.value.slice(0, 40) } : x)))} style={{ width: "100%", minWidth: 120 }} /></td>
                    <td className="mono" style={{ fontSize: 13 }}>{r.loginId}</td>
                    <td className="mono" style={{ fontSize: 13 }}>{r.password}</td>
                    <td>{r.state === "ok" ? <span className="chip done">発行済み</span> : r.state === "ng" ? <span className="chip" style={{ color: "var(--red, #D9483B)" }} title={r.error}>× {r.error}</span> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            {!okRows.length && <button type="button" className="btn ghost" disabled={!!busy} onClick={() => { setPlan(null); setMsg({ kind: "", text: "" }); }}>作り直す</button>}
            {(!done || plan.some(r => r.state === "ng")) && <button type="button" className="btn" disabled={!!busy} onClick={issue}>{busy === "issue" ? `発行しています…（${okRows.length} / ${plan.length}）` : `${plan.filter(r => r.state !== "ok").length}件を発行する`}</button>}
            {okRows.length > 0 && <button type="button" className="btn" disabled={busy === "issue"} onClick={() => downloadExcel(c.name, okRows)}>Excelで受け取る（{okRows.length}件）</button>}
            {done && okRows.length > 0 && <button type="button" className="btn ghost" onClick={() => { setPlan(null); setMsg({ kind: "", text: "" }); }}>閉じる</button>}
          </div>
        </>
      )}
      {msg.text && <div className={`verdict ${msg.kind}`} role={msg.kind === "ng" ? "alert" : "status"} style={{ marginTop: 10 }}>{msg.text}</div>}
    </section>
  );
}
