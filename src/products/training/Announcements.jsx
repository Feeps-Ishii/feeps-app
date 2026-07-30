import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Megaphone, Pin, Plus, Trash2, Pencil, AlertCircle, RefreshCw } from "lucide-react";
import { T, Btn, Card, EmptyState, SkeletonRows, PrismErrorRetryCard } from "../../components/common";
import { apiGet, apiPost, apiPut, apiDelete } from "../../api.js";

// お知らせ（人が書いて出す連絡）。既存の「通知」（データから合成）とは別物。
// 画面は全ロールで1つ。宛先の選択肢だけロールで変わる（迷わせないため意図的に1画面）。

const IMPORTANCE_LABEL = { normal: "通常", important: "重要" };

function fmt(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// ---- ホーム最上部に出す表示。自分宛のものだけをAPIが返す ----
export function AnnouncementBoard({ go, max = 3 }) {
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(() => {
    setState("loading");
    apiGet("/announcements/me")
      .then(r => { setItems(Array.isArray(r?.items) ? r.items : []); setState("ready"); })
      .catch(() => setState("error"));
  }, []);
  useEffect(() => { load(); }, [load]);

  // 取得できないときは黙って消さず、確認できないことを出す（0件と混同させない）
  if (state === "error") {
    return (
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: T.textSecondary }}>
          <AlertCircle size={16} style={{ color: T.warning }} />
          お知らせを確認できませんでした。
          <Btn size="sm" kind="ghost" icon={RefreshCw} onClick={load}>再試行</Btn>
        </div>
      </Card>
    );
  }
  if (state === "loading") return null;
  if (items.length === 0) return null;

  const shown = items.slice(0, max);
  return (
    <div className="mb-4 flex flex-col gap-2">
      {shown.map(a => {
        const important = a.importance === "important";
        const open = !!expanded[a.announcementId];
        const long = String(a.body || "").length > 110;
        return (
          <Card key={a.announcementId} className="p-4" style={important ? { borderColor: T.warning } : undefined}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: important ? T.warningSubtle : T.accentSubtle, color: important ? T.warning : T.accentHover }}>
                <Megaphone size={15} />
              </span>
              <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{a.title}</span>
              {important && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: T.warningSubtle, color: T.warning }}>重要</span>}
              {a.pinned && <Pin size={13} style={{ color: T.textMuted }} />}
              <span className="ml-auto text-xs" style={{ color: T.textMuted }}>
                {a.authorName || ""}{a.publishedAt ? `・${fmt(a.publishedAt)}` : ""}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: T.textSecondary }}>
              {open || !long ? a.body : `${String(a.body).slice(0, 110)}…`}
            </p>
            {long && (
              <button type="button" onClick={() => setExpanded(p => ({ ...p, [a.announcementId]: !open }))}
                className="mt-1 text-xs font-bold" style={{ color: T.accent }}>
                {open ? "閉じる" : "続きを読む"}
              </button>
            )}
          </Card>
        );
      })}
      {items.length > max && (
        <button type="button" onClick={() => go?.("announcements")} className="self-start text-xs font-bold" style={{ color: T.accent }}>
          お知らせをすべて見る（{items.length}件）
        </button>
      )}
    </div>
  );
}

// ---- 作成・編集・削除の画面。講師／企業担当者／管理者が使う ----
export default function Announcements({ role, userProfile }) {
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const isAdmin = role === "admin";
  const isInstructor = role === "instructor";
  const isClient = role === "client";

  // 宛先の選択肢はロールで決まる。講師・企業担当者は迷う余地を作らない。
  const audienceOptions = useMemo(() => {
    if (isAdmin) {
      return [
        { value: "trainee", label: "受講生" },
        { value: "client", label: "企業担当者" },
        { value: "instructor", label: "講師" },
      ];
    }
    return [{ value: "trainee", label: "受講生" }];
  }, [isAdmin]);

  const load = useCallback(() => {
    setState("loading");
    Promise.all([apiGet("/announcements"), apiGet("/courses").catch(() => [])])
      .then(([r, cs]) => {
        setItems(Array.isArray(r?.items) ? r.items : []);
        setCourses(Array.isArray(cs) ? cs : []);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);
  useEffect(() => { load(); }, [load]);

  function startNew() {
    setMessage("");
    setEditing({
      announcementId: "", audience: "trainee", courseId: "", title: "", body: "",
      importance: "normal", pinned: false, expiresAt: "",
    });
  }

  async function save() {
    if (!editing || busy) return;
    if (!editing.title.trim()) { setMessage("件名を入力してください。"); return; }
    if (!editing.body.trim()) { setMessage("本文を入力してください。"); return; }
    if (isInstructor && editing.audience === "trainee" && !editing.courseId) {
      setMessage("お知らせを出すコースを選択してください。"); return;
    }
    setBusy(true); setMessage("");
    try {
      const payload = {
        audience: editing.audience,
        courseId: editing.audience === "trainee" ? editing.courseId : "",
        title: editing.title.trim(),
        body: editing.body.trim(),
        importance: editing.importance,
        pinned: editing.pinned,
        expiresAt: editing.expiresAt || "",
      };
      if (editing.announcementId) await apiPut(`/announcements/${editing.announcementId}`, payload);
      else await apiPost("/announcements", payload);
      setEditing(null);
      load();
    } catch (e) {
      setMessage("保存に失敗しました: " + (e?.errorMessage || e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(a) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      await apiDelete(`/announcements/${a.announcementId}`);
      load();
    } catch (e) {
      setMessage("削除に失敗しました: " + (e?.errorMessage || e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const courseName = id => courses.find(c => c.courseId === id)?.name || (id ? "（コース情報なし）" : "");

  function targetLabel(a) {
    if (a.audience === "client") return "企業担当者";
    if (a.audience === "instructor") return "講師";
    if (a.courseId) return `受講生・${courseName(a.courseId)}`;
    if (a.companyId) return "受講生・自社";
    return "受講生・全員";
  }

  if (state === "error") return <div className="p-4"><PrismErrorRetryCard message="お知らせを取得できませんでした。" onRetry={load} /></div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold" style={{ color: T.textPrimary }}>お知らせ</h3>
          <p className="text-xs" style={{ color: T.textMuted }}>
            {isInstructor && "担当コースの受講生のホームに表示されます。"}
            {isClient && "自社の受講生のホームに表示されます。"}
            {isAdmin && "宛先に選んだ相手のホームに表示されます。"}
          </p>
        </div>
        <Btn size="sm" icon={Plus} onClick={startNew}>お知らせを作成</Btn>
      </div>

      {message && (
        <div className="rounded-xl px-3 py-2 text-sm font-semibold"
          style={{ background: message.includes("失敗") || message.includes("ください") ? T.dangerSubtle : T.successSubtle, color: message.includes("失敗") || message.includes("ください") ? T.danger : T.success }}>
          {message}
        </div>
      )}

      {editing && (
        <Card className="p-4">
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: T.textMuted }}>
            {editing.announcementId ? "お知らせを編集" : "新しいお知らせ"}
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {audienceOptions.length > 1 && (
              <label className="block">
                <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>宛先</div>
                <select value={editing.audience} onChange={e => setEditing(p => ({ ...p, audience: e.target.value, courseId: "" }))}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>
                  {audienceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            )}
            {editing.audience === "trainee" && (
              <label className="block">
                <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>コース{isInstructor ? "（必須）" : "（未選択なら対象の全受講生）"}</div>
                <select value={editing.courseId} onChange={e => setEditing(p => ({ ...p, courseId: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>
                  <option value="">{isInstructor ? "コースを選択してください" : "指定しない"}</option>
                  {courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}
                </select>
              </label>
            )}
            <label className="block">
              <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>件名</div>
              <input value={editing.title} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} maxLength={120}
                placeholder="例: 来週の研修会場が変わります"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} />
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>本文</div>
              <textarea value={editing.body} onChange={e => setEditing(p => ({ ...p, body: e.target.value }))} rows={5} maxLength={4000}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>重要度</div>
                <select value={editing.importance} onChange={e => setEditing(p => ({ ...p, importance: e.target.value }))}
                  className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }}>
                  <option value="normal">通常</option>
                  <option value="important">重要</option>
                </select>
              </label>
              <label className="block">
                <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>掲載終了日（任意）</div>
                <input type="date" value={editing.expiresAt ? String(editing.expiresAt).slice(0, 10) : ""}
                  onChange={e => setEditing(p => ({ ...p, expiresAt: e.target.value ? `${e.target.value}T23:59:59.999Z` : "" }))}
                  className="rounded-xl px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.textPrimary }} />
              </label>
              <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm" style={{ color: T.textSecondary }}>
                <input type="checkbox" checked={editing.pinned} onChange={e => setEditing(p => ({ ...p, pinned: e.target.checked }))}
                  className="h-4 w-4" style={{ accentColor: T.accent }} />
                いちばん上に固定する
              </label>
            </div>
            <p className="text-xs" style={{ color: T.textMuted }}>
              掲載終了日を入れないと、消すまで相手のホームに出続けます。期間の決まった連絡には日付を入れてください。
            </p>
            <div className="flex gap-2">
              <Btn size="sm" onClick={save} disabled={busy}>{busy ? "保存中…" : "保存して掲載する"}</Btn>
              <Btn size="sm" kind="ghost" onClick={() => { setEditing(null); setMessage(""); }}>やめる</Btn>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-0">
        {state === "loading" ? <div className="p-4"><SkeletonRows rows={3} /></div>
          : items.length === 0 ? <div className="p-4"><EmptyState icon={Megaphone} title="お知らせはまだありません" desc="「お知らせを作成」から登録できます。" /></div>
          : (
            <div className="flex flex-col">
              {items.map(a => (
                <div key={a.announcementId} className="flex flex-wrap items-start gap-3 px-4 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{a.title}</span>
                      {a.importance === "important" && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: T.warningSubtle, color: T.warning }}>重要</span>}
                      {a.pinned && <Pin size={13} style={{ color: T.textMuted }} />}
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: T.textMuted }}>
                      宛先: {targetLabel(a)} ・ 掲載 {fmt(a.publishedAt)}
                      {a.expiresAt ? ` 〜 ${fmt(a.expiresAt)}` : "（終了日なし）"}
                      {isAdmin && a.authorName ? ` ・ ${a.authorName}` : ""}
                    </div>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm" style={{ color: T.textSecondary }}>{a.body}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Btn size="sm" kind="ghost" icon={Pencil} onClick={() => { setMessage(""); setEditing({ ...a, expiresAt: a.expiresAt || "" }); }}>編集</Btn>
                    <Btn size="sm" kind="ghost" icon={Trash2} onClick={() => remove(a)} disabled={busy}>削除</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
      </Card>
    </div>
  );
}
