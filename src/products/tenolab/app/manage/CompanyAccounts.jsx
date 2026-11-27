import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../../api.js";
import "./companyAccounts.css";

/* 企業のアカウント（管理者のみ。2026-11-27）
   #/manage/companies/{id}/accounts
   発行したアカウントの一覧。仮パスワードを出し直す（この画面に一度だけ出す）・止める／再開する・消す。
   発行はアカウント発行の画面（AccountIssue.jsx）。API は /admin/users（GET・PUT status・POST temp-password・DELETE） */
const ROLE = { trainee: "受講生", client: "企業担当者", instructor: "講師", manager: "管理者", admin: "管理者" };
const PLAN = { standard: "スタンダード", premium: "Premium" };
const SORTS = [["new", "発行が新しい順"], ["old", "発行が古い順"], ["name", "名前順"], ["id", "ログインID順"]];
// 探すとき：全角半角・カタカナひらがなをそろえる
const norm = s => String(s || "").normalize("NFKC").toLowerCase().replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
const day = s => (s ? String(s).slice(0, 10).replace(/-/g, "/") : "—");
const stateOf = u => (u.disabled ? "off" : u.placeholder ? "first" : "on");
const STATE = { on: ["使用中", "done"], first: ["はじめてのログイン前", ""], off: ["止めている", "warn"] };

export default function CompanyAccounts({ companyId, go }) {
  const [list, setList] = useState({ state: "loading", users: [] });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("new");
  const [busy, setBusy] = useState("");          // `${userId}:${kind}`
  const [shown, setShown] = useState({});        // userId → 仮パスワード（この画面だけ）
  const [confirm, setConfirm] = useState("");    // 消す確認中の userId
  const [msg, setMsg] = useState({ kind: "", text: "" });

  const load = useCallback(async () => {
    setList(x => ({ ...x, state: x.users.length ? "reloading" : "loading" }));
    try {
      const all = await apiGet("/admin/users");
      setList({ state: "ok", users: (Array.isArray(all) ? all : []).filter(u => u.company === companyId) });
    } catch (e) {
      setList({ state: "error", users: [] });
    }
  }, [companyId]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const hit = u => words.every(w => norm(`${u.name} ${u.email} ${ROLE[u.role] || ""}`).includes(w));
    const at = u => String(u.issuedAt || u.createdAt || "");
    const by = {
      new: (a, b) => at(b).localeCompare(at(a)), old: (a, b) => at(a).localeCompare(at(b)),
      name: (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"), id: (a, b) => String(a.email || "").localeCompare(String(b.email || "")),
    };
    return list.users.filter(hit).sort(by[sort] || by.new);
  }, [list.users, q, sort]);
  const count = k => list.users.filter(u => stateOf(u) === k).length;

  async function act(u, kind, fn, okText) {
    if (busy) return;
    setBusy(`${u.userId}:${kind}`); setMsg({ kind: "", text: "" });
    try { await fn(); if (okText) setMsg({ kind: "ok", text: okText }); }
    catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || "うまくいきませんでした。もう一度お試しください。" }); }
    finally { setBusy(""); }
  }
  const reissue = u => act(u, "pw", async () => {
    const r = await apiPost(`/admin/users/${encodeURIComponent(u.userId)}/temp-password`, {});
    setShown(s => ({ ...s, [u.userId]: r?.password || "" }));
  }, `${u.name || u.email} の仮パスワードを出し直しました。本人に伝えてください（この画面を離れると見られません）。`);
  const toggle = u => act(u, "st", async () => {
    await apiPut(`/admin/users/${encodeURIComponent(u.userId)}/status`, { disabled: !u.disabled });
    await load();
  }, u.disabled ? `${u.name || u.email} を使えるようにしました。` : `${u.name || u.email} のログインを止めました（記録は残ります）。`);
  const remove = u => act(u, "del", async () => {
    await apiDelete(`/admin/users/${encodeURIComponent(u.userId)}`);
    setConfirm("");
    await load();
  }, `${u.name || u.email} を消しました。`);
  const copy = t => { try { navigator.clipboard?.writeText(t); } catch (e) { /* 写せなくても画面に出ている */ } };

  if (list.state === "loading") return <p className="muted">読み込んでいます…</p>;
  if (list.state === "error") return <div className="card flat" style={{ padding: 16 }} role="alert">アカウントを読み込めませんでした。 <button type="button" className="btn ghost sm" onClick={load}>もう一度</button></div>;

  return (
    <section className="card cac">
      <div className="cac-hd">
        <div className="cac-sum">
          <span><b className="num">{list.users.length}</b> 件</span>
          <span className="chip done">使用中 {count("on")}</span>
          <span className="chip">はじめてのログイン前 {count("first")}</span>
          {count("off") > 0 && <span className="chip warn">止めている {count("off")}</span>}
        </div>
        <span className="sp" />
        <input id="cac-q" className="cac-q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="名前・ログインIDで探す" aria-label="名前・ログインIDで探す" />
        <select id="cac-sort" className="cac-sort" value={sort} onChange={e => setSort(e.target.value)} aria-label="並べ替え">{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button type="button" className="btn sm" onClick={() => go(`#/manage/accounts/${encodeURIComponent(companyId)}`)}>アカウントを発行</button>
      </div>
      {msg.text && <div className={`verdict ${msg.kind}`} role={msg.kind === "ng" ? "alert" : "status"}>{msg.text}</div>}
      {!list.users.length ? (
        <div className="cac-empty"><p>まだアカウントがありません。</p><button type="button" className="btn" onClick={() => go(`#/manage/accounts/${encodeURIComponent(companyId)}`)}>アカウントを発行する</button></div>
      ) : !rows.length ? <p className="muted" style={{ padding: "12px 4px" }}>当てはまるアカウントはありません。</p> : (
        <div className="tblwrap">
          <table className="mtbl cac-tbl">
            <thead><tr><th>名前</th><th>ログインID</th><th>種類</th><th>状態</th><th>発行</th><th className="rt">操作</th></tr></thead>
            <tbody>{rows.map(u => {
              const s = stateOf(u), pw = shown[u.userId];
              return (
                <React.Fragment key={u.userId}>
                  <tr className={s === "off" ? "is-off" : ""}>
                    <td><b>{u.name || "—"}</b></td>
                    <td className="mono">{u.email}</td>
                    <td>{ROLE[u.role] || u.role}{u.seat?.plan ? <small className="muted"> ・ {PLAN[u.seat.plan] || u.seat.plan}</small> : null}</td>
                    <td><span className={`chip ${STATE[s][1]}`}>{STATE[s][0]}</span></td>
                    <td className="num">{day(u.issuedAt || u.createdAt)}</td>
                    <td className="rt">
                      <span className="cac-act">
                        <button type="button" className="btn ghost sm" disabled={!!busy || s === "off"} onClick={() => reissue(u)}>{busy === `${u.userId}:pw` ? "出しています…" : "仮パスワードを出し直す"}</button>
                        <button type="button" className="btn ghost sm" disabled={!!busy} onClick={() => toggle(u)}>{busy === `${u.userId}:st` ? "…" : u.disabled ? "再開する" : "止める"}</button>
                        <button type="button" className="btn ghost sm cac-del" disabled={!!busy} onClick={() => setConfirm(confirm === u.userId ? "" : u.userId)}>消す</button>
                      </span>
                    </td>
                  </tr>
                  {pw && (
                    <tr className="cac-sub"><td colSpan={6}>
                      <span className="cac-pw">仮パスワード <code>{pw}</code><button type="button" className="btn ghost sm" onClick={() => copy(pw)}>写す</button>
                        <small className="muted">本人に伝えてください。次のログインで新しいパスワードを決めます。この画面を離れると見られません。</small></span>
                    </td></tr>
                  )}
                  {confirm === u.userId && (
                    <tr className="cac-sub"><td colSpan={6}>
                      <span className="cac-confirm"><b>{u.name || u.email} を消しますか？</b><small className="muted">ログインできなくなり、元に戻せません。しばらく使わないだけなら「止める」を使ってください。</small>
                        <span className="sp" /><button type="button" className="btn ghost sm" onClick={() => setConfirm("")}>やめる</button>
                        <button type="button" className="btn sm danger" disabled={!!busy} onClick={() => remove(u)}>{busy === `${u.userId}:del` ? "消しています…" : "消す"}</button></span>
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
