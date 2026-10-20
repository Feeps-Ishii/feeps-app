import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../api.js";
import { makePassword } from "../../utils/common/password.js";
import { guessColumns, readRosterFile, rosterPeople, textToRows } from "./roster.js";
import ConfirmDialog from "./ConfirmDialog.jsx";

/* お客様の名簿で登録する（2026-10-20、管理者）。
   名簿（Excel・CSV・貼り付け）→ 列を見分ける（ルール、だめなら AI）→ 一覧で確かめる → 確かめる窓 → 作る・コースに入れる → お客様に渡す Excel。
   アカウントは仮のID（{頭}-001@id.devhub-lms.com）で作り、名前は名簿のまま。本人は初回ログインでパスワード、次にメールアドレスを登録する。
   本人のメールへの案内は送らない（SES の準備ができてから）。名簿のメールは Excel の「お渡し先」に入れるだけ。
   もういる人（同じ企業で、メールか名前が同じ）は作らずにコースへ入れるだけ */

const CHUNK = 10;
const FIELDS = [["name", "名前"], ["sei", "姓"], ["mei", "名"], ["kana", "ふりがな"], ["email", "メール"]];
const norm = s => String(s || "").replace(/[\s　]/g, "").toLowerCase();
const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+/, "").slice(0, 20);

async function downloadExcel({ company, course, rows }) {
  const XLSX = await import("xlsx");
  const today = new Date().toISOString().slice(0, 10);
  const aoa = [
    ["DevHub LMS　アカウントのご案内"], [],
    ["企業名", company], ["コース", course], ["発行日", today], ["ログインの画面", window.location.origin + "/"], ["人数", `${rows.length}名`], [],
    ["はじめてのログインのしかた"],
    ["1. ログインの画面で、下の「ログインID」と「仮パスワード」を入れます。"],
    ["2. 新しいパスワードを決めます（8文字以上・英大文字・英小文字・数字・記号を含む）。"],
    ["3. お名前とメールアドレスを登録します。メールに届く確認コードを入れると完了です。"],
    ["4. 次からは、登録したメールアドレスと新しいパスワードでログインします。"],
    ["※ 仮パスワードは発行から30日で使えなくなります。この表は大切に保管し、お渡し後は削除してください。"], [],
    ["No", "お名前", "ログインID", "仮パスワード", "お渡し先（名簿のメール）"],
    ...rows.map((r, i) => [i + 1, r.name, r.loginId, r.password, r.email || ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 38 }, { wch: 18 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "アカウント");
  XLSX.writeFile(wb, `DevHub LMS アカウント_${company}_${today.replace(/-/g, "")}.xlsx`);
}

export default function RosterImport({ course, admin = true, onClose, onDone }) {
  const [rows, setRows] = useState(null);
  const [map, setMap] = useState(null);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState(null);
  const [companyId, setCompanyId] = useState(course.companyId || "");
  const [prefix, setPrefix] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(null);   // { made: [{name, loginId, password, email}], enrolled, failed: [] }

  useEffect(() => {
    // コース担当者は、このコースの企業だけ（API もそれ以外は断る）
    apiGet("/companies").then(l => setCompanies((l || []).filter(c => !c.deleted && (admin || !course.companyId || c.companyId === course.companyId)))).catch(() => setCompanies([]));
  }, [admin, course.companyId]);
  // 今いる人：選んだ企業の受講生（同じ人を二重に作らない）
  useEffect(() => {
    if (!companyId) { setUsers([]); return; }
    setUsers(null);
    apiGet(`/companies/${encodeURIComponent(companyId)}/trainees`).then(l => setUsers(l || [])).catch(() => setUsers([]));
  }, [companyId]);
  const company = companies.find(c => c.companyId === companyId);
  useEffect(() => { if (!prefix && company) setPrefix(slug(company.name) || slug(company.companyId) || "user"); }, [company]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(r) {
    setMsg("");
    const table = r.filter(x => x.some(c => String(c).trim()));
    if (!table.length) { setMsg("名簿の中身がありません。"); return; }
    let m = guessColumns(table);
    if (!m) {
      setBusy("map");
      try { m = await apiPost("/console/roster-map", { rows: table.slice(0, 8) }); }
      catch (e) { m = { headerRow: 0, name: 0, sei: -1, mei: -1, kana: -1, email: -1 }; setMsg(e?.errorMessage || "列を見分けられませんでした。下で列を選んでください。"); }
      setBusy("");
    }
    setRows(table); setMap(m);
  }
  async function onFile(f) {
    if (!f) return;
    try { await load(await readRosterFile(f)); } catch { setMsg("ファイルを読めませんでした。Excel（.xlsx）か CSV にしてください。"); }
  }

  const people = useMemo(() => rosterPeople(rows || [], map), [rows, map]);
  const judged = useMemo(() => {
    const mine = users || [];
    const seen = new Set();
    return people.map(p => {
      const key = p.email || norm(p.name);
      if (!p.name) return { ...p, kind: "skip", note: "名前がありません" };
      if (seen.has(key)) return { ...p, kind: "skip", note: "上と同じ人" };
      seen.add(key);
      const hit = mine.find(u => (p.email && String(u.email || "").toLowerCase() === p.email) || norm(u.name) === norm(p.name));
      return hit ? { ...p, kind: "enroll", userId: hit.userId, note: "もういます（コースに入れるだけ）" } : { ...p, kind: "new", note: "新しく作る" };
    });
  }, [people, users, companyId]);
  const count = k => judged.filter(p => p.kind === k).length;
  const prefixOk = /^[a-z0-9][a-z0-9-]{1,23}$/.test(prefix);

  async function run() {
    const made = [], failed = [];
    let enrolled = 0;
    const news = judged.filter(p => p.kind === "new");
    if (news.length) {
      const plan = await apiPost("/admin/accounts/plan", { prefix, count: news.length, courseId: course.id });
      const ids = plan?.loginIds || [];
      const list = news.map((p, i) => ({ ...p, loginId: ids[i], password: makePassword() })).filter(p => p.loginId);
      for (let i = 0; i < list.length; i += CHUNK) {
        const part = list.slice(i, i + CHUNK);
        try {
          const r = await apiPost("/admin/accounts/batch", { companyId, courseId: course.id, accounts: part.map(({ loginId, name, password }) => ({ loginId, name, password })) });
          for (const x of r?.results || []) {
            const p = part.find(y => y.loginId === x.loginId);
            if (!p) continue;
            if (x.ok) made.push(p); else failed.push({ name: p.name, error: x.error || "作れませんでした" });
          }
        } catch (e) { part.forEach(p => failed.push({ name: p.name, error: e?.errorMessage || "作れませんでした" })); }
      }
    }
    for (const p of judged.filter(x => x.kind === "enroll")) {
      try { await apiPost(`/courses/${encodeURIComponent(course.id)}/trainees`, { traineeId: p.userId }); enrolled += 1; }
      catch (e) { failed.push({ name: p.name, error: "コースに入れられませんでした" }); }
    }
    setDone({ made, enrolled, failed });
    onDone?.();
    return `${made.length} 人を作り、${enrolled} 人をコースに入れました。${failed.length ? `${failed.length} 人はできませんでした。` : ""}`;
  }

  return (
    <div className="dhc-shade dhc-center" onMouseDown={e => { if (e.target === e.currentTarget && !busy && !confirm) onClose(); }}>
      <section className="dhc-modal dhc-roster" role="dialog" aria-modal="true" aria-label="お客様の名簿で登録">
        <header><b>お客様の名簿で登録 ・ {course.name}</b><button type="button" onClick={onClose} aria-label="閉じる">×</button></header>
        <div className="in">
          {done ? (
            <>
              <div className="dhc-okmsg">{done.made.length} 人を作り、{done.enrolled} 人をコースに入れました。</div>
              {done.failed.length > 0 && <div className="dhc-err">{done.failed.map(f => `${f.name}：${f.error}`).join(" ／ ")}</div>}
              {done.made.length > 0 && (<>
                <p className="dhc-note" style={{ margin: 0 }}>仮パスワードはこの画面にしか出ません。Excel を受け取って、お客様にお渡しください。</p>
                <div><button type="button" className="dhc-btn ai" onClick={() => downloadExcel({ company: company?.name || "", course: course.name, rows: done.made })}>お客様に渡す Excel を受け取る</button></div>
              </>)}
            </>
          ) : !rows ? (
            <>
              <label className="dhc-drop">
                <input type="file" accept=".xlsx,.xls,.xlsm,.csv,.txt,.tsv" onChange={e => onFile(e.target.files?.[0])} />
                <b>名簿のファイルを選ぶ</b><small>Excel（.xlsx）・CSV。お客様から届いたままで大丈夫です</small>
              </label>
              <label className="dhc-field">または、名簿を貼り付け（1行に1人）
                <textarea rows={6} value={paste} onChange={e => setPaste(e.target.value)} placeholder={"山田 太郎\tyamada@example.co.jp\n鈴木 花子\tsuzuki@example.co.jp"} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: "7px 10px", fontSize: 13.5 }} />
              </label>
              <div><button type="button" className="dhc-btn" disabled={!paste.trim() || !!busy} onClick={() => load(textToRows(paste))}>読み込む</button></div>
            </>
          ) : (
            <>
              <div className="dhc-colmap">
                {FIELDS.map(([k, t]) => (
                  <label key={k} className="dhc-field">{t}
                    <select value={map[k]} onChange={e => setMap(m => ({ ...m, [k]: Number(e.target.value) }))}>
                      <option value={-1}>なし</option>
                      {(rows[Math.max(0, map.headerRow)] || []).map((c, i) => <option key={i} value={i}>{map.headerRow >= 0 ? (c || `${i + 1}列目`) : `${i + 1}列目（${String(c).slice(0, 10)}）`}</option>)}
                    </select>
                  </label>
                ))}
                <label className="dhc-field">見出しの行
                  <select value={map.headerRow} onChange={e => setMap(m => ({ ...m, headerRow: Number(e.target.value) }))}>
                    <option value={-1}>なし</option>
                    {rows.slice(0, 10).map((r, i) => <option key={i} value={i}>{i + 1}行目</option>)}
                  </select>
                </label>
              </div>
              <div className="dhc-steps2">
                <span className="dhc-pill ok">新しく作る {count("new")}</span>
                <span className="dhc-pill blue">コースに入れるだけ {count("enroll")}</span>
                {count("skip") > 0 && <span className="dhc-pill warn">とばす {count("skip")}</span>}
                {users === null && <span className="dhc-note">今いる人と照らし合わせています…</span>}
              </div>
              <div className="dhc-rtable">
                <table>
                  <thead><tr><th>行</th><th>名前</th><th>ふりがな</th><th>メール（お渡し先）</th><th>する事</th></tr></thead>
                  <tbody>{judged.slice(0, 300).map(p => (
                    <tr key={p.line} className={p.kind}><td>{p.line}</td><td>{p.name || "—"}</td><td>{p.kana}</td><td>{p.email}</td><td>{p.note}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="dhc-colmap">
                <label className="dhc-field">企業
                  <select value={companyId} onChange={e => { setCompanyId(e.target.value); setPrefix(""); }}>
                    <option value="">選んでください</option>
                    {companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
                  </select>
                </label>
                <label className="dhc-field">ログインIDの頭
                  <input value={prefix} onChange={e => setPrefix(slug(e.target.value))} placeholder="minato" />
                </label>
              </div>
              {count("new") > 0 && <span className="dhc-note">ログインIDは {prefixOk ? prefix : "（頭）"}-001@id.devhub-lms.com のようになります。本人のメールには送りません。</span>}
            </>
          )}
          {msg && <div className="dhc-warn">{msg}</div>}
        </div>
        {!done && rows && (
          <footer>
            <button type="button" className="dhc-btn ok" disabled={!companyId || (count("new") > 0 && !prefixOk) || !(count("new") + count("enroll")) || users === null} onClick={() => setConfirm(true)}>確かめて登録する</button>
            <button type="button" className="dhc-btn ghost" onClick={() => { setRows(null); setMap(null); }}>名簿を選び直す</button>
          </footer>
        )}
      </section>
      {confirm && (
        <ConfirmDialog title="この内容で登録する" runLabel="登録する"
          rows={[["企業", company?.name || "—"], ["コース", course.name], ["新しく作る", `${count("new")} 人（ID は ${prefix}-…、名前は名簿のまま）`], ["コースに入れるだけ", `${count("enroll")} 人`], ["とばす", `${count("skip")} 人`]]}
          warn="作ったあと、お客様に渡す Excel を受け取ってください（仮パスワードはそこにしか出ません）。"
          onClose={() => setConfirm(false)} onRun={run} />
      )}
    </div>
  );
}
