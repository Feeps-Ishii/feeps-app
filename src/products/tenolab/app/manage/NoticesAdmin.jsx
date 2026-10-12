import React, { useCallback, useEffect, useState } from "react";
import { company, manage } from "../data.js";
import { Title } from "./parts.jsx";
import { NOTICE_KIND, NoticeBanner, NoticeTag, mdLabel } from "../notices/Notices.jsx";

/* 管理者：お知らせ（2026-10-13、モック devhub-notice.html の「管理者：お知らせ」）
   作る（種類・相手・企業・タイトル・本文・メンテナンスの日時・つなぐコース・出す日／下げる日・帯で出す）→ 右で見え方を確かめる → 出す。
   下は出したお知らせ（状態・読んだ人） */
const AUDIENCE = [["both", "受講生と企業担当者"], ["learner", "受講生"], ["client", "企業担当者"]];
const STATE = { draft: ["下書き", ""], scheduled: ["予約", "warn"], live: ["公開中", "done"], ended: ["終了", ""] };
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const blank = () => ({ id: "", kind: "info", to: "both", companyIds: [], title: "", body: "", banner: false, showFrom: today(), showUntil: "", maint: { start: "", end: "" }, courseId: "" });
const newId = () => `n-${Date.now().toString(36)}`;

function Field({ label, children, wide }) {
  return <label className="mfield" style={wide ? { gridColumn: "1 / -1" } : undefined}><span>{label}</span>{children}</label>;
}

export default function NoticesAdmin({ courses }) {
  const [list, setList] = useState({ state: "loading", items: [] });
  const [item, setItem] = useState(blank);
  const [companies, setCompanies] = useState([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const load = useCallback(() => {
    manage.notices().then(r => setList({ state: "ready", items: r.items || [] })).catch(() => setList(s => ({ ...s, state: "error" })));
  }, []);
  useEffect(() => { load(); company.get("").then(r => setCompanies(r.companies || [])).catch(() => setCompanies([])); }, [load]);

  const set = (k, v) => setItem(x => ({ ...x, [k]: v }));
  const pickKind = k => setItem(x => ({ ...x, kind: k, banner: k === "maint" || k === "important" ? true : x.banner }));
  async function save(publish) {
    if (!item.title.trim()) { setMsg({ kind: "ng", text: "タイトルを入れてください。" }); return; }
    setBusy(publish ? "publish" : "save"); setMsg({ kind: "", text: "" });
    const id = item.id || newId();
    try {
      const r = await manage.saveNotice(id, { ...item, id, status: publish ? "published" : "draft" });
      setItem({ ...blank(), ...r.notice, maint: r.notice.maint || { start: "", end: "" }, courseId: r.notice.courseId || "" });
      setMsg({ kind: "ok", text: publish ? (r.notice.state === "scheduled" ? `${mdLabel(r.notice.showFrom)} に出します。` : "出しました。") : "下書きを保存しました。" });
      load();
    } catch (e) {
      setMsg({ kind: "ng", text: e?.status === 422 ? `直すところ：${(e?.data?.issues || []).join("、")}` : e?.errorMessage || "保存できませんでした。" });
    } finally { setBusy(""); }
  }
  async function stop(n) {
    if (!window.confirm("このお知らせを下げて、下書きに戻します。よろしいですか？")) return;
    try { await manage.saveNotice(n.id, { ...n, status: "draft" }); load(); }
    catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || "下げられませんでした。" }); }
  }
  async function remove(n) {
    if (!window.confirm("このお知らせを消します。よろしいですか？")) return;
    try { await manage.removeNotice(n.id); if (item.id === n.id) setItem(blank()); load(); }
    catch (e) { setMsg({ kind: "ng", text: e?.errorMessage || "消せませんでした。" }); }
  }
  const edit = n => { setItem({ ...blank(), ...n, maint: n.maint || { start: "", end: "" }, courseId: n.courseId || "" }); setMsg({ kind: "", text: "" }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const preview = { items: [{ id: "pv", kind: item.kind, title: item.title || "（タイトル）", banner: item.banner, date: item.showFrom, maint: item.kind === "maint" ? item.maint : null, read: false }], open: () => {} };
  const pickedCo = new Set(item.companyIds || []);
  return (
    <div className="mpage">
      <Title eyebrow="NOTICES" title="お知らせ" />
      <div className="ntc-admin">
        <section className="card mcard" aria-label="お知らせを作る">
          <div className="row" style={{ gap: 8 }}><b style={{ fontSize: 16 }}>{item.id ? "お知らせを直す" : "お知らせを作る"}</b>{item.id && <button type="button" className="btn ghost" style={{ marginLeft: "auto" }} onClick={() => { setItem(blank()); setMsg({ kind: "", text: "" }); }}>新しく作る</button>}</div>
          <div className="mgrid">
            <Field label="種類" wide><span className="ntc-pick">{Object.keys(NOTICE_KIND).map(k => <button key={k} type="button" aria-pressed={item.kind === k} onClick={() => pickKind(k)}><NoticeTag kind={k} /></button>)}</span></Field>
            <Field label="相手" wide><span className="ntc-pick">{AUDIENCE.map(([k, l]) => <button key={k} type="button" aria-pressed={item.to === k} onClick={() => set("to", k)}>{l}</button>)}</span></Field>
            <Field label="企業で絞る（選ばなければ、すべての企業）" wide>
              <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {companies.map(c => <label key={c.id} className="chip" style={{ cursor: "pointer", padding: "2px 10px" }}><input type="checkbox" checked={pickedCo.has(c.id)} onChange={e => set("companyIds", e.target.checked ? [...pickedCo, c.id] : [...pickedCo].filter(x => x !== c.id))} />{c.name}</label>)}
              </span>
            </Field>
            <Field label="タイトル" wide><input value={item.title} maxLength={120} onChange={e => set("title", e.target.value)} /></Field>
            <Field label="本文" wide><textarea rows={5} value={item.body} onChange={e => set("body", e.target.value)} /></Field>
            {item.kind === "maint" && <>
              <Field label="メンテナンスの開始"><input type="datetime-local" value={item.maint?.start || ""} onChange={e => set("maint", { ...item.maint, start: e.target.value })} /></Field>
              <Field label="終了"><input type="datetime-local" value={item.maint?.end || ""} onChange={e => set("maint", { ...item.maint, end: e.target.value })} /></Field>
            </>}
            {item.kind === "course" && (
              <Field label="つなぐコース" wide>
                <select value={item.courseId} onChange={e => set("courseId", e.target.value)}><option value="">つながない</option>{courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
              </Field>
            )}
            <Field label="出す日"><input type="date" value={item.showFrom} onChange={e => set("showFrom", e.target.value)} /></Field>
            <Field label="下げる日（空なら下げない）"><input type="date" value={item.showUntil} onChange={e => set("showUntil", e.target.value)} /></Field>
            <Field label="ホームの上に帯で出す" wide><span className="row" style={{ gap: 6 }}><input type="checkbox" checked={!!item.banner} onChange={e => set("banner", e.target.checked)} />帯で出す（メンテナンス・重要のときに）</span></Field>
          </div>
          {msg.text && <div className={`verdict ${msg.kind}`} role={msg.kind === "ng" ? "alert" : "status"}>{msg.text}</div>}
          <div className="mactions">
            <button type="button" className="btn ghost" onClick={() => save(false)} disabled={!!busy}>{busy === "save" ? "保存しています…" : "下書きを保存"}</button>
            <button type="button" className="btn" onClick={() => save(true)} disabled={!!busy}>{busy === "publish" ? "出しています…" : item.showFrom > today() ? `${mdLabel(item.showFrom)} に出す` : "出す"}</button>
          </div>
        </section>
        <div className="ntc-pv">
          <div className="row" style={{ gap: 8 }}><span className="eyebrow">PREVIEW</span><span className="chip">{AUDIENCE.find(a => a[0] === item.to)?.[1]}</span></div>
          <div className="frame">
            {item.banner && <NoticeBanner notices={preview} />}
            <section className="card ntc-card"><div className="hd"><h2 className="h2">お知らせ</h2></div>
              <div className="ntc-row" style={{ cursor: "default" }}><span className="dot" /><span className="t">{item.title || "（タイトル）"}</span><span className="m"><NoticeTag kind={item.kind} />{mdLabel(item.showFrom)}</span></div>
            </section>
          </div>
        </div>
      </div>

      <section className="card mcard" style={{ marginTop: 18 }}>
        <div className="eyebrow">出したお知らせ</div>
        {list.state === "error" ? <p className="muted" style={{ margin: 0 }}>お知らせを確認できません</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="ntc-list">
              <thead><tr><th>種類</th><th>タイトル</th><th>相手</th><th>期間</th><th>読んだ人</th><th>状態</th><th /></tr></thead>
              <tbody>{list.items.map(n => (
                <tr key={n.id} className={item.id === n.id ? "on" : ""}>
                  <td><NoticeTag kind={n.kind} /></td>
                  <td>{n.title}{n.banner && <span className="chip warn" style={{ marginLeft: 6 }}>帯</span>}{n.companyIds?.length ? <span className="chip" style={{ marginLeft: 6 }}>{n.companyIds.length}社</span> : null}</td>
                  <td>{AUDIENCE.find(a => a[0] === n.to)?.[1]}</td>
                  <td className="num">{mdLabel(n.showFrom)}〜{n.showUntil ? mdLabel(n.showUntil) : ""}</td>
                  <td className="num">{n.readCount || 0}人</td>
                  <td><span className={`chip ${STATE[n.state]?.[1] || ""}`}>{STATE[n.state]?.[0] || n.state}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="btn ghost" style={{ padding: "2px 10px" }} onClick={() => edit(n)}>直す</button>{" "}
                    {n.state === "live" || n.state === "scheduled" ? <button type="button" className="btn ghost" style={{ padding: "2px 10px" }} onClick={() => stop(n)}>下げる</button>
                      : <button type="button" className="btn ghost" style={{ padding: "2px 10px", color: "var(--red)" }} onClick={() => remove(n)}>消す</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
