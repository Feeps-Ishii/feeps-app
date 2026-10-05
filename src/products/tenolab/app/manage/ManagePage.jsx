import React, { useCallback, useEffect, useState } from "react";
import { manage } from "../data.js";
import { Ic, TOPIC_ICONS, TopicIcon } from "../ui.jsx";
import ItemEditor from "./ItemEditor.jsx";

/* 講師・管理者のメニュー（#/manage/…）：コース／演習／案件体験／単元／提出の確認 */
const TABS = [["courses", "コース"], ["drills", "演習"], ["cases", "案件体験"], ["submissions", "提出の確認"], ["topics", "単元"]];

export default function ManagePage({ ctx, rest, role }) {
  const tab = rest[0] || "courses";
  const id = rest[1];
  const { go, topics, lrn } = ctx;
  const courses = (lrn.catalog || []).map(c => ({ id: c.id, title: c.title }));
  let body;
  if (tab === "courses") body = <CourseAdmin />;
  else if ((tab === "drills" || tab === "cases") && id) body = <ItemEditor key={`${tab}/${id}`} kind={tab} id={id === "_new" ? "" : id} isNew={id === "_new"} topics={topics} courses={courses} go={go} />;
  else if (tab === "drills" || tab === "cases") body = <ItemList kind={tab} topics={topics} go={go} />;
  else if (tab === "submissions") body = <Submissions />;
  else if (tab === "topics") body = role === "admin" ? <TopicsEditor topics={topics} /> : <p className="muted">単元を直せるのは管理者です。</p>;
  return (
    <div className="mpage">
      <div className="sec-h" style={{ marginTop: 0 }}><div className="ptitle"><span className="eyebrow">FOR STAFF</span><h1 className="h1">講師・管理者のメニュー</h1></div></div>
      <div className="tabs-h" role="tablist" style={{ marginBottom: 16 }}>
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => go(`#/manage/${k}`)}>{l}</button>)}
      </div>
      {body}
    </div>
  );
}

/* コース：元のEラーニングの管理画面（Tailwind の見た目のまま iframe で載せる） */
function CourseAdmin() {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span className="muted" style={{ fontSize: 13 }}>コースの設定・レッスン・スライド・問題・AIでの作成はここで行います。「単元」と「一覧のサムネイル」はコースの設定にあります。</span>
      <iframe title="コースの管理" src="/lab-embed.html#learning-admin" style={{ width: "100%", height: "calc(100vh - 220px)", minHeight: 600, border: "1px solid var(--line)", borderRadius: 12, background: "#fff" }} />
    </div>
  );
}

function ItemList({ kind, topics, go }) {
  const noun = kind === "drills" ? "演習" : "案件体験";
  const [st, setSt] = useState({ state: "loading", items: [] });
  const load = useCallback(() => {
    setSt(s => ({ ...s, state: "loading" }));
    manage.list(kind).then(r => setSt({ state: "ready", items: r.items || [] })).catch(() => setSt({ state: "error", items: [] }));
  }, [kind]);
  useEffect(() => { load(); }, [load]);
  const topicName = id => topics.find(t => t.id === id)?.name || "その他";
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="row"><button type="button" className="btn" onClick={() => go(`#/manage/${kind}/_new`)}>{noun}を作る</button></div>
      {st.state === "loading" && <p className="muted">読み込んでいます…</p>}
      {st.state === "error" && <div className="card flat" style={{ padding: 16 }} role="alert">読み込めませんでした。 <button type="button" className="btn ghost" onClick={load}>もう一度</button></div>}
      {st.state === "ready" && !st.items.length && <p className="muted">まだありません。</p>}
      {st.items.map(x => (
        <button key={x.id} type="button" className="drow" onClick={() => go(`#/manage/${kind}/${x.id}`)}>
          <span className="di">{x.runtime === "aws" ? "AWS" : <Ic id={kind === "cases" ? "case" : "code"} />}</span>
          <span style={{ minWidth: 0 }}><b style={{ fontWeight: 600 }}>{x.title || "（名前なし）"}</b>
            <div className="muted" style={{ fontSize: 12 }}>{topicName(x.topic)} ・ {x.runtime} ・ ID {x.id}</div></span>
          <span className={`chip ${x.published ? (x.changed ? "warn" : "done") : ""}`}>{x.published ? (x.changed ? "未公開の変更あり" : "公開中") : "下書き"}</span>
        </button>
      ))}
    </div>
  );
}

/* 案件体験の提出：コード・テスト結果・AIの講評を見て、OK かやり直し */
function Submissions() {
  const [status, setStatus] = useState("submitted");
  const [st, setSt] = useState({ state: "loading", items: [] });
  const [open, setOpen] = useState(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    setSt(s => ({ ...s, state: "loading" }));
    manage.submissions(status).then(r => setSt({ state: "ready", items: r.items || [], truncated: r.truncated })).catch(() => setSt({ state: "error", items: [] }));
  }, [status]);
  useEffect(() => { load(); setOpen(null); }, [load]);
  async function review(action) {
    if (action === "return" && !comment.trim()) { setErr("やり直しのときは、直してほしいところを書いてください。"); return; }
    setBusy(true); setErr("");
    try {
      await manage.review(open.userId, open.caseId, { action, comment });
      setOpen(null); setComment(""); load();
    } catch (e) { setErr(e?.errorMessage || "保存できませんでした。"); }
    finally { setBusy(false); }
  }
  const LABEL = { submitted: "確認待ち", returned: "やり直し", approved: "OK" };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="filters" role="group" aria-label="状態で絞り込む">
        {[["submitted", "確認待ち"], ["returned", "やり直し"], ["approved", "OK"], ["all", "すべて"]].map(([k, l]) => <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}
      </div>
      {st.state === "loading" && <p className="muted">読み込んでいます…</p>}
      {st.state === "error" && <div className="card flat" style={{ padding: 16 }} role="alert">読み込めませんでした。 <button type="button" className="btn ghost" onClick={load}>もう一度</button></div>}
      {st.state === "ready" && !st.items.length && <p className="muted">ありません。</p>}
      {st.items.map(x => {
        const isOpen = open && open.userId === x.userId && open.caseId === x.caseId;
        return (
          <div key={`${x.userId}/${x.caseId}`} className="card flat" style={{ padding: "14px 16px", display: "grid", gap: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <b>{x.userName || x.userId}</b><span className="muted" style={{ fontSize: 13 }}>{x.caseTitle || x.caseId}</span>
              <span className={`chip ${x.status === "approved" ? "done" : x.status === "returned" ? "warn" : ""}`}>{LABEL[x.status] || x.status}</span>
              <span className="muted num" style={{ fontSize: 12, marginLeft: "auto" }}>{x.submittedAt ? new Date(x.submittedAt).toLocaleString("ja-JP") : ""}</span>
              <button type="button" className="btn ghost" onClick={() => { setOpen(isOpen ? null : x); setComment(""); setErr(""); }}>{isOpen ? "閉じる" : "見る"}</button>
            </div>
            {isOpen && (
              <>
                <div className="tests">{(x.testResults || []).map((t, i) => <div key={i} className={t.ok ? "ok" : "ng"}>{t.ok ? "✓" : "✗"} {t.name}</div>)}</div>
                {x.code && <pre className="code" style={{ maxHeight: 360, overflow: "auto" }}>{x.code}</pre>}
                {x.aiReview && <div className="rv"><div className="who">AI</div><div className="bubble" style={{ whiteSpace: "pre-wrap" }}>{x.aiReview}</div></div>}
                {x.review?.comment && <div className="rv"><div className="who" style={{ background: "var(--marker)" }}>講</div><div className="bubble">{x.review.comment}</div></div>}
                {x.status === "submitted" && (
                  <>
                    <label className="mfield"><span>講師のコメント（受講生に届きます。やり直しのときは必須）</span><textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} /></label>
                    {err && <div className="verdict ng" role="alert">{err}</div>}
                    <div className="row" style={{ gap: 8 }}>
                      <button type="button" className="btn" onClick={() => review("approve")} disabled={busy}>OKにする</button>
                      <button type="button" className="btn ghost" onClick={() => review("return")} disabled={busy}>やり直しにする</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        );
      })}
      {st.truncated && <p className="muted" style={{ fontSize: 12 }}>新しい順に200件まで出しています。</p>}
    </div>
  );
}

/* 単元（管理者）：名前・説明・色・アイコン・Premium・並び順 */
function TopicsEditor({ topics }) {
  const [list, setList] = useState(() => topics.map(t => ({ ...t })));
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);
  const set = (i, k, v) => setList(l => l.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  async function save() {
    setBusy(true); setMsg({ kind: "", text: "" });
    try {
      await manage.saveTopics(list.map((t, i) => ({ ...t, order: i })));
      setMsg({ kind: "ok", text: "保存しました。画面を読み込み直すと反映されます。" });
    } catch (e) {
      const issues = e?.data?.issues;
      setMsg({ kind: "ng", text: Array.isArray(issues) && issues.length ? issues.join("、") : e?.errorMessage || "保存できませんでした。" });
    } finally { setBusy(false); }
  }
  const move = (i, d) => setList(l => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {list.map((t, i) => (
        <div key={i} className="card flat mtopic">
          <TopicIcon topic={t} size={48} />
          <div className="mgrid">
            <label className="mfield"><span>ID</span><input value={t.id} onChange={e => set(i, "id", e.target.value)} /></label>
            <label className="mfield"><span>名前</span><input value={t.name} onChange={e => set(i, "name", e.target.value)} /></label>
            <label className="mfield"><span>小見出し</span><input value={t.sub || ""} onChange={e => set(i, "sub", e.target.value)} /></label>
            <label className="mfield"><span>アイコン</span><select value={t.icon || t.id} onChange={e => set(i, "icon", e.target.value)}>{TOPIC_ICONS.map(k => <option key={k}>{k}</option>)}</select></label>
            <label className="mfield"><span>色</span><input type="color" value={t.color || "#767D8C"} onChange={e => set(i, "color", e.target.value)} /></label>
            <label className="mfield"><span>うすい色</span><input type="color" value={t.soft || "#F2F3EE"} onChange={e => set(i, "soft", e.target.value)} /></label>
            <label className="mfield" style={{ gridColumn: "1 / -1" }}><span>説明</span><input value={t.desc || ""} onChange={e => set(i, "desc", e.target.value)} /></label>
            <label className="row" style={{ gap: 6, fontSize: 13 }}><input type="checkbox" checked={!!t.premium} onChange={e => set(i, "premium", e.target.checked)} />Premium</label>
          </div>
          <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
            <button type="button" className="btn ghost" onClick={() => move(i, -1)} aria-label="上へ">↑</button>
            <button type="button" className="btn ghost" onClick={() => move(i, 1)} aria-label="下へ">↓</button>
            <button type="button" className="btn ghost" onClick={() => setList(l => l.filter((_, j) => j !== i))} aria-label="消す">×</button>
          </div>
        </div>
      ))}
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn ghost" onClick={() => setList(l => [...l, { id: "", name: "", sub: "", desc: "", color: "#2457E6", soft: "#E8EEFD", icon: "code", premium: false }])}>単元を足す</button>
        <button type="button" className="btn" onClick={save} disabled={busy}>{busy ? "保存しています…" : "保存する"}</button>
      </div>
      {msg.text && <div className={`verdict ${msg.kind}`} role={msg.kind === "ng" ? "alert" : "status"}>{msg.text}</div>}
    </div>
  );
}
