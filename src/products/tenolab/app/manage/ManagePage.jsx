import React, { useCallback, useEffect, useState } from "react";
import { manage } from "../data.js";
import { Ic, TOPIC_ICONS, TopicIcon } from "../ui.jsx";
import ItemEditor from "./ItemEditor.jsx";
import AdminHome from "./AdminHome.jsx";
import Grading from "./Grading.jsx";
import Companies from "./Companies.jsx";
import { AdminLearners } from "../company/CompanyPages.jsx";
import CourseList from "./CourseList.jsx";
import { Title } from "./parts.jsx";
import NoticesAdmin from "./NoticesAdmin.jsx";
import { GroupHead, PublishResult, confirmPublish, groupByTopic, needsPublish, publishMany } from "./publishParts.jsx";

/* 管理の画面（#/manage/…、管理者だけ。モック tenolab-admin.html、2026-10-06〜）
     #/manage                         ホーム
     #/manage/companies[/{companyId}] 企業と契約
     #/manage/learners[/{userId}]     受講状況（企業担当者の画面と同じ部品）
     #/manage/courses|drills|cases[/{id}|/_new]  教材（コースは一覧とプレビュー。#/manage/courses/legacy は元の管理画面＝細かく直す）
     #/manage/grading[/{caseId}]      AI採点（旧 #/manage/submissions もここ）
     #/manage/topics                  単元
   外枠（黒い帯のヘッダー）は TenolabApp が Shell variant="admin" で付ける */
export const ADMIN_NAV = [["home", "ホーム", "#/manage"], ["companies", "企業と契約", "#/manage/companies"], ["learners", "受講状況", "#/manage/learners"], ["materials", "教材", "#/manage/courses"], ["grading", "AI採点", "#/manage/grading"], ["notices", "お知らせ", "#/manage/notices"], ["topics", "単元", "#/manage/topics"]];
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
  if (section === "learners") return <AdminLearners rest={rest} go={go} />;
  if (section === "companies") return <Companies go={go} companyId={id ? decodeURIComponent(id) : ""} />;
  if (section === "grading") return <Grading go={go} caseId={tab === "grading" ? id || "" : ""} />;
  if (section === "topics") return <><Title eyebrow="TOPICS" title="単元" /><TopicsEditor topics={topics} /></>;
  if (section === "notices") return <NoticesAdmin courses={courses} />;
  if (section !== "materials") return <p className="muted">この画面はありません。</p>;
  let body;
  if (tab === "courses") body = id === "legacy" ? <CourseAdmin go={go} /> : <CourseList topics={topics} go={go} />;
  else if (id) body = <ItemEditor key={`${tab}/${id}`} kind={tab} id={id === "_new" ? "" : id} isNew={id === "_new"} topics={topics} courses={courses} go={go} lrn={lrn} />;
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
function CourseAdmin({ go }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button type="button" className="back" onClick={() => go("#/manage/courses")}>← 教材</button>
      <iframe title="コースの管理" src="/lab-embed.html#learning-admin" style={{ width: "100%", height: "calc(100vh - 220px)", minHeight: 600, border: "1px solid var(--line)", borderRadius: 12, background: "#fff" }} />
    </div>
  );
}

// 演習・案件体験の一覧：単元ごとに分け、一覧から公開・単元ごとにまとめて公開できる（2026-10-13）
function ItemList({ kind, topics, go }) {
  const noun = kind === "drills" ? "演習" : "案件体験";
  const [st, setSt] = useState({ state: "loading", items: [] });
  const [busy, setBusy] = useState("");
  const [res, setRes] = useState(null);
  const load = useCallback(() => {
    setSt(s => ({ ...s, state: s.items.length ? "ready" : "loading" }));
    manage.list(kind).then(r => setSt({ state: "ready", items: r.items || [] })).catch(() => setSt({ state: "error", items: [] }));
  }, [kind]);
  useEffect(() => { load(); }, [load]);
  async function publish(list, key) {
    if (busy || !list.length || !confirmPublish(list)) return;
    setBusy(key); setRes(null);
    const r = await publishMany(list, x => manage.publish(kind, x.id));
    setBusy(""); setRes(r); load();
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="row"><button type="button" className="btn" onClick={() => go(`#/manage/${kind}/_new`)}>{noun}を作る</button></div>
      <PublishResult res={res} onClose={() => setRes(null)} />
      {st.state === "loading" && <p className="muted">読み込んでいます…</p>}
      {st.state === "error" && <div className="card flat" style={{ padding: 16 }} role="alert">読み込めませんでした。 <button type="button" className="btn ghost" onClick={load}>もう一度</button></div>}
      {st.state === "ready" && !st.items.length && <p className="muted">まだありません。</p>}
      {groupByTopic(st.items, topics).map(g => {
        const drafts = g.items.filter(needsPublish);
        return (
          <section key={g.topic.id} className="mgroup">
            <GroupHead topic={g.topic} count={g.items.length} drafts={drafts.length} busy={busy === g.topic.id} onPublishAll={() => publish(drafts, g.topic.id)} />
            {g.items.map(x => (
              <div key={x.id} className="drow mrow">
                <button type="button" className="mrow-main" onClick={() => go(`#/manage/${kind}/${x.id}`)}>
                  <span className="di">{x.runtime === "aws" ? "AWS" : <Ic id={kind === "cases" ? "case" : "code"} />}</span>
                  <span style={{ minWidth: 0 }}><b style={{ fontWeight: 600 }}>{x.title || "（名前なし）"}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{x.runtime} ・ ID {x.id}</div></span>
                </button>
                {kind === "cases" && x.runtime !== "aws" && <span className={`chip ${x.rubricCount ? "" : "warn"}`}>{x.rubricCount ? `基準 ${x.rubricCount}` : "基準なし"}</span>}
                <span className={`chip ${x.published ? (x.changed ? "warn" : "done") : ""}`}>{x.published ? (x.changed ? "未公開の変更あり" : "公開中") : "下書き"}</span>
                {needsPublish(x) && <button type="button" className="btn sm" disabled={!!busy} onClick={() => publish([x], x.id)}>{busy === x.id ? "公開しています…" : x.published ? "変更を公開" : "公開する"}</button>}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

// タグの一覧は、編集中は文字のまま持ち、保存するときに配列にする
const splitTags = v => (Array.isArray(v) ? v : String(v || "").split(/[、,，\n]/)).map(s => s.trim()).filter(Boolean);
const tagText = (t, k) => (Array.isArray(t[k]) ? t[k].join("、") : t[k] || "");

/* 単元（管理者）：名前・説明・色・アイコン・Premium・並び順・演習のタグ */
function TopicsEditor({ topics }) {
  const [list, setList] = useState(() => topics.map(t => ({ ...t })));
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);
  const set = (i, k, v) => setList(l => l.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  async function save() {
    setBusy(true); setMsg({ kind: "", text: "" });
    try {
      await manage.saveTopics(list.map((t, i) => ({ ...t, tagsTech: splitTags(t.tagsTech), tagsLearn: splitTags(t.tagsLearn), order: i })));
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
            {/* 演習のタグの一覧（2026-10-15）。読点か改行で区切る。技術＝濃い色、学ぶこと＝薄い色 */}
            <label className="mfield" style={{ gridColumn: "1 / -1" }}><span>演習のタグ：技術（、で区切る）</span><input value={tagText(t, "tagsTech")} onChange={e => set(i, "tagsTech", e.target.value)} placeholder="HTML、CSS" /></label>
            <label className="mfield" style={{ gridColumn: "1 / -1" }}><span>演習のタグ：学ぶこと（、で区切る）</span><input value={tagText(t, "tagsLearn")} onChange={e => set(i, "tagsLearn", e.target.value)} placeholder="フォーム、表、Flexbox" /></label>
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
