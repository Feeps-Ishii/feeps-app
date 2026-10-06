import React, { useCallback, useEffect, useState } from "react";
import { manage } from "../data.js";
import { Ic, TOPIC_ICONS, TopicIcon } from "../ui.jsx";
import ItemEditor from "./ItemEditor.jsx";
import AdminHome from "./AdminHome.jsx";
import Grading from "./Grading.jsx";
import Companies from "./Companies.jsx";
import { Title } from "./parts.jsx";

/* 管理の画面（#/manage/…、管理者だけ。モック tenolab-admin.html、2026-10-06〜）
     #/manage                         ホーム
     #/manage/companies[/{companyId}] 企業と契約
     #/manage/courses|drills|cases[/{id}|/_new]  教材
     #/manage/grading[/{caseId}]      AI採点（旧 #/manage/submissions もここ）
     #/manage/topics                  単元
   外枠（黒い帯のヘッダー）は TenolabApp が Shell variant="admin" で付ける */
export const ADMIN_NAV = [["home", "ホーム", "#/manage"], ["companies", "企業と契約", "#/manage/companies"], ["materials", "教材", "#/manage/courses"], ["grading", "AI採点", "#/manage/grading"], ["topics", "単元", "#/manage/topics"]];
const MATERIAL_TABS = [["courses", "コース"], ["drills", "演習"], ["cases", "案件体験"]];

export function adminSection(rest) {
  const t = rest[0] || "";
  if (!t) return "home";
  if (t === "courses" || t === "drills" || t === "cases") return "materials";
  if (t === "grading" || t === "submissions") return "grading";
  return t;
}

export default function ManagePage({ ctx, rest }) {
  const tab = rest[0] || "";
  const id = rest[1];
  const { go, topics, lrn } = ctx;
  const courses = (lrn.catalog || []).map(c => ({ id: c.id, title: c.title }));
  const section = adminSection(rest);
  if (section === "home") return <AdminHome go={go} />;
  if (section === "companies") return <Companies go={go} companyId={id ? decodeURIComponent(id) : ""} />;
  if (section === "grading") return <Grading go={go} caseId={tab === "grading" ? id || "" : ""} />;
  if (section === "topics") return <><Title eyebrow="TOPICS" title="単元" /><TopicsEditor topics={topics} /></>;
  if (section !== "materials") return <p className="muted">この画面はありません。</p>;
  let body;
  if (tab === "courses") body = <CourseAdmin />;
  else if (id) body = <ItemEditor key={`${tab}/${id}`} kind={tab} id={id === "_new" ? "" : id} isNew={id === "_new"} topics={topics} courses={courses} go={go} />;
  else body = <ItemList kind={tab} topics={topics} go={go} />;
  return (
    <div className="mpage">
      {!id && <>
        <Title eyebrow="MATERIALS" title="教材" />
        <div className="tabs-h" role="tablist" style={{ marginBottom: 16 }}>
          {MATERIAL_TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => go(`#/manage/${k}`)}>{l}</button>)}
        </div>
      </>}
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
        <button key={x.id} type="button" className="drow mrow" onClick={() => go(`#/manage/${kind}/${x.id}`)}>
          <span className="di">{x.runtime === "aws" ? "AWS" : <Ic id={kind === "cases" ? "case" : "code"} />}</span>
          <span style={{ minWidth: 0 }}><b style={{ fontWeight: 600 }}>{x.title || "（名前なし）"}</b>
            <div className="muted" style={{ fontSize: 12 }}>{topicName(x.topic)} ・ {x.runtime} ・ ID {x.id}</div></span>
          {kind === "cases" && x.runtime !== "aws" && <span className={`chip ${x.rubricCount ? "" : "warn"}`}>{x.rubricCount ? `基準 ${x.rubricCount}` : "基準なし"}</span>}
          <span className={`chip ${x.published ? (x.changed ? "warn" : "done") : ""}`}>{x.published ? (x.changed ? "未公開の変更あり" : "公開中") : "下書き"}</span>
        </button>
      ))}
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
