import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Megaphone, Pin, Plus, Trash2, Pencil, AlertCircle, RefreshCw, X } from "lucide-react";
import { T, Btn, Card, EmptyState, SkeletonRows, PrismErrorRetryCard } from "../../components/common";
import { apiGet, apiPost, apiPut, apiDelete } from "../../api.js";

// お知らせ（人が書いて出す連絡）。既存の「通知」（データから合成）とは別物。
//
// 研修の前にも後にも出すため、公開期間（開始日〜終了日）を持つ。開始日を未来にすれば
// 予約投稿になり、その日が来るまで相手のホームには出ない。
// 入力フォームはホームと管理画面で同じ AnnouncementEditor を使う（二重管理を避ける）。

const POSTER_ROLES = ["instructor", "client", "admin"];

// 公開期間から今の状態を出す。ホームの要約と管理一覧のバッジで同じ判定を使う。
function periodState(a) {
  const now = new Date().toISOString();
  if (a.publishedAt && a.publishedAt > now) return "before";
  if (a.expiresAt && a.expiresAt < now) return "after";
  return "live";
}
const PERIOD_LABEL = { before: "公開前", live: "公開中", after: "終了" };

function fmt(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// 日付入力(YYYY-MM-DD) と ISO文字列の相互変換。
// **日付は利用者の時間帯（日本時間）で解釈する。** ISO文字列の先頭10文字をそのまま使ったり
// `T00:00:00.000Z` を付けたりするとUTC扱いになり、9時間ずれて「8/31まで」が「9/1」と出る。
const pad = n => String(n).padStart(2, "0");
const toDateInput = iso => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// 今日の日付（利用者の時間帯）。「その日はじめて開いたか」の判定に使う。
const localDate = () => new Date().toLocaleDateString("sv-SE");
const startOfDay = d => (d ? new Date(`${d}T00:00:00`).toISOString() : "");
const endOfDay = d => (d ? new Date(`${d}T23:59:59.999`).toISOString() : "");

export function emptyDraft() {
  return {
    announcementId: "", audience: "trainee", courseId: "", title: "", body: "",
    importance: "normal", pinned: false, publishedAt: "", expiresAt: "",
  };
}

const fieldStyle = { border: `1px solid ${T.border}`, color: T.textPrimary };

// ---- 入力フォーム（ホームと管理画面で共用） ----
export function AnnouncementEditor({ role, courses, draft, setDraft, onSave, onCancel, busy, message, compact = false }) {
  const isAdmin = role === "admin";
  const isInstructor = role === "instructor";
  const isClient = role === "client";

  // 宛先を選べるのは管理者だけ。講師・企業担当者には宛先欄そのものを出さない（迷わせない）。
  const audienceOptions = isAdmin
    ? [{ value: "trainee", label: "受講生" }, { value: "client", label: "企業担当者" }, { value: "instructor", label: "講師" }]
    : [{ value: "trainee", label: "受講生" }];

  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: T.textMuted }}>
          {draft.announcementId ? "お知らせを編集" : "新しいお知らせ"}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {audienceOptions.length > 1 && (
          <label className="block">
            <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>誰に出すか</div>
            <select value={draft.audience} onChange={e => setDraft(p => ({ ...p, audience: e.target.value, courseId: "" }))}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={fieldStyle}>
              {audienceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        {draft.audience === "trainee" && (
          <label className="block">
            <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>
              コース{isInstructor ? "（必須）" : "（未選択なら対象の全受講生）"}
            </div>
            <select value={draft.courseId} onChange={e => setDraft(p => ({ ...p, courseId: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={fieldStyle}>
              <option value="">{isInstructor ? "コースを選択してください" : "指定しない"}</option>
              {courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <label className="block">
        <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>件名</div>
        <input value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} maxLength={120}
          placeholder="例: 来週の研修は会場が変わります"
          className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={fieldStyle} />
      </label>

      <label className="block">
        <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>本文</div>
        <textarea value={draft.body} onChange={e => setDraft(p => ({ ...p, body: e.target.value }))} rows={compact ? 4 : 5} maxLength={4000}
          placeholder="伝えたい内容を入力してください。"
          className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={fieldStyle} />
      </label>

      <div>
        <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>公開する期間</div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={toDateInput(draft.publishedAt)} aria-label="公開開始日"
            onChange={e => setDraft(p => ({ ...p, publishedAt: startOfDay(e.target.value) }))}
            className="rounded-xl px-3 py-2 text-sm outline-none" style={fieldStyle} />
          <span className="text-sm" style={{ color: T.textMuted }}>〜</span>
          <input type="date" value={toDateInput(draft.expiresAt)} aria-label="公開終了日"
            onChange={e => setDraft(p => ({ ...p, expiresAt: endOfDay(e.target.value) }))}
            className="rounded-xl px-3 py-2 text-sm outline-none" style={fieldStyle} />
          {(draft.publishedAt || draft.expiresAt) && (
            <Btn size="sm" kind="ghost" onClick={() => setDraft(p => ({ ...p, publishedAt: "", expiresAt: "" }))}>期間をクリア</Btn>
          )}
        </div>
        <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
          開始日を空にすると<strong>すぐ公開</strong>、未来の日付にすると<strong>その日から公開</strong>されます。
          終了日を空にすると、削除するまで相手のホームに出続けます。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <div className="mb-1 text-xs font-semibold" style={{ color: T.textMuted }}>重要度</div>
          <select value={draft.importance} onChange={e => setDraft(p => ({ ...p, importance: e.target.value }))}
            className="rounded-xl px-3 py-2 text-sm outline-none" style={fieldStyle}>
            <option value="normal">通常</option>
            <option value="important">重要</option>
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm" style={{ color: T.textSecondary }}>
          <input type="checkbox" checked={draft.pinned} onChange={e => setDraft(p => ({ ...p, pinned: e.target.checked }))}
            className="h-4 w-4" style={{ accentColor: T.accent }} />
          いちばん上に固定する
        </label>
      </div>

      {/* 重要と通常で通知の回数が変わる。出す側が選ぶときに分かるよう書いておく。 */}
      <p className="text-xs leading-relaxed" style={{ color: T.textMuted }}>
        <span className="font-bold" style={{ color: T.textSecondary }}>重要</span>にすると、公開期間中は
        <span className="font-bold" style={{ color: T.textSecondary }}>毎日1回</span>、相手がその日はじめて開いたときにお知らせが出ます。
        <span className="font-bold" style={{ color: T.textSecondary }}>通常</span>は公開期間中でも
        <span className="font-bold" style={{ color: T.textSecondary }}>最初の1回だけ</span>で、以降はホームの一覧に残ります。
      </p>

      {message && (
        <div className="rounded-xl px-3 py-2 text-sm font-semibold"
          style={{
            background: /失敗|ください/.test(message) ? T.dangerSubtle : T.successSubtle,
            color: /失敗|ください/.test(message) ? T.danger : T.success,
          }}>
          {message}
        </div>
      )}

      <div className="flex gap-2">
        <Btn size="sm" onClick={onSave} disabled={busy}>{busy ? "保存中…" : draft.announcementId ? "保存する" : "この内容で公開する"}</Btn>
        <Btn size="sm" kind="ghost" onClick={onCancel}>やめる</Btn>
      </div>
      {isClient && <p className="text-xs" style={{ color: T.textMuted }}>自社の受講生のホームに表示されます。</p>}
      {isInstructor && <p className="text-xs" style={{ color: T.textMuted }}>選んだコースの受講生のホームに表示されます。</p>}
    </div>
  );
}

// 保存処理はホームと管理画面で共通
async function saveDraft(draft, role) {
  if (!draft.title.trim()) throw new Error("件名を入力してください。");
  if (!draft.body.trim()) throw new Error("本文を入力してください。");
  if (role === "instructor" && draft.audience === "trainee" && !draft.courseId) {
    throw new Error("お知らせを出すコースを選択してください。");
  }
  const payload = {
    audience: draft.audience,
    courseId: draft.audience === "trainee" ? draft.courseId : "",
    title: draft.title.trim(),
    body: draft.body.trim(),
    importance: draft.importance,
    pinned: draft.pinned,
    publishedAt: draft.publishedAt || "",
    expiresAt: draft.expiresAt || "",
  };
  if (draft.announcementId) await apiPut(`/announcements/${draft.announcementId}`, payload);
  else await apiPost("/announcements", payload);
}

// ---- ホーム最上部。自分宛の表示＋（出せるロールなら）その場で作成 ----
export function AnnouncementBoard({ go, role, max = 3 }) {
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [courses, setCourses] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [posted, setPosted] = useState(null);   // 出した側の要約。null = まだ読めていない
  const [seen, setSeen] = useState(null);       // 自分がもう見たか。null = まだ読めていない
  const [popup, setPopup] = useState(null);     // ログイン後に出すお知らせ。null = 出さない
  const [popupBusy, setPopupBusy] = useState(false);
  const popupDoneRef = React.useRef(false);     // 1回の滞在で二度出さない
  const canPost = POSTER_ROLES.includes(role);

  const load = useCallback(() => {
    setState("loading");
    apiGet("/announcements/me")
      .then(r => { setItems(Array.isArray(r?.items) ? r.items : []); setState("ready"); })
      .catch(() => setState("error"));
    apiGet("/announcements/seen").then(setSeen).catch(() => setSeen(null));
    // 出した側は「今どれが出ているか」がホームで分かるようにする。
    // 取れなかった場合は要約を出さない（0件と混同させないため）。
    if (POSTER_ROLES.includes(role)) {
      apiGet("/announcements")
        .then(r => setPosted(Array.isArray(r?.items) ? r.items : []))
        .catch(() => setPosted(null));
    }
  }, [role]);
  useEffect(() => { load(); }, [load]);

  // ログイン後に1回だけ出す。重要は公開期間中は毎日、通常は新しく出たときだけ（2026-07-28ユーザー決定）。
  // 利用規約の同意ダイアログとは重ならない（TrainingApp側で同意前はここまで描画されない）。
  useEffect(() => {
    if (state !== "ready" || !seen || popupDoneRef.current) return;
    const today = localDate();
    const isNew = a => !seen.seenAt || String(a.publishedAt || a.createdAt || "") > seen.seenAt;
    const daily = seen.seenDate === today ? [] : items.filter(a => a.importance === "important");
    const ids = new Set();
    const target = [...items.filter(isNew), ...daily].filter(a => !ids.has(a.announcementId) && ids.add(a.announcementId));
    if (target.length === 0) return;
    popupDoneRef.current = true;
    setPopup(target);
  }, [state, items, seen]);

  async function confirmPopup() {
    if (popupBusy) return;
    setPopupBusy(true);
    const next = { seenAt: new Date().toISOString(), seenDate: localDate() };
    // 記録できなくても閉じる（閉じられないと打刻や日報の邪魔になる）。次回また出るだけ。
    try { await apiPut("/announcements/seen", next); } catch { /* noop */ }
    setSeen(next);
    setPopup(null);
    setPopupBusy(false);
  }

  function openCompose() {
    setMessage("");
    setDraft(emptyDraft());
    setComposing(true);
    if (courses.length === 0) apiGet("/courses").then(cs => setCourses(Array.isArray(cs) ? cs : [])).catch(() => setCourses([]));
  }

  async function submit() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      await saveDraft(draft, role);
      setComposing(false);
      setMessage("お知らせを公開しました。");
      load();
    } catch (e) {
      setMessage(e?.errorMessage || e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const shown = items.slice(0, max);
  const live = (posted || []).filter(a => periodState(a) === "live");
  const scheduled = (posted || []).filter(a => periodState(a) === "before");

  return (
    <div className="mb-4 flex flex-col gap-2">
      {popup && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(20,24,36,.5)" }}
          role="dialog" aria-modal="true" aria-labelledby="announcement-popup-title">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl p-6"
            style={{ background: T.bgSurface, border: `1px solid ${T.border}`, boxShadow: "0 24px 60px rgba(16,20,32,.28)" }}>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.accentSubtle, color: T.accentHover }}>
                <Megaphone size={18} />
              </span>
              <h2 id="announcement-popup-title" className="text-base font-bold" style={{ color: T.textPrimary }}>
                お知らせが{popup.length}件あります
              </h2>
            </div>
            <ul className="flex flex-col gap-3">
              {popup.map(a => (
                <li key={a.announcementId} className="rounded-xl p-3"
                  style={{ background: T.bgBase, border: `1px solid ${a.importance === "important" ? T.warning : T.border}` }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{a.title}</span>
                    {a.importance === "important" && (
                      <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: T.warningSubtle, color: T.warning }}>重要</span>
                    )}
                  </div>
                  {/* 重要は本文まで出す。通常は件名だけにして、詳しくはホームの一覧で読んでもらう */}
                  {a.importance === "important" && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: T.textSecondary }}>{a.body}</p>
                  )}
                  <div className="mt-1 text-xs" style={{ color: T.textMuted }}>
                    {a.authorName || ""}{a.expiresAt ? `・${fmt(a.expiresAt)}まで` : ""}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs" style={{ color: T.textMuted }}>
              内容はこのあともホームのいちばん上で確認できます。
            </p>
            <div className="mt-4 flex justify-end">
              <Btn onClick={confirmPopup} disabled={popupBusy}>{popupBusy ? "記録中…" : "確認しました"}</Btn>
            </div>
          </div>
        </div>
      )}

      {state === "error" && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: T.textSecondary }}>
            <AlertCircle size={16} style={{ color: T.warning }} />
            お知らせを確認できませんでした。
            <Btn size="sm" kind="ghost" icon={RefreshCw} onClick={load}>再試行</Btn>
          </div>
        </Card>
      )}

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

      {canPost && composing && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold" style={{ color: T.textPrimary }}>お知らせを出す</span>
            <button type="button" onClick={() => setComposing(false)} aria-label="閉じる" className="rounded-lg p-1" style={{ color: T.textMuted }}><X size={16} /></button>
          </div>
          <AnnouncementEditor role={role} courses={courses} draft={draft} setDraft={setDraft}
            onSave={submit} onCancel={() => setComposing(false)} busy={busy} message={message} compact />
        </Card>
      )}

      {canPost && !composing && posted && (
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Megaphone size={14} style={{ color: T.textMuted }} />
            <span className="text-xs font-bold" style={{ color: T.textSecondary }}>
              {role === "admin" ? "公開中のお知らせ" : "自分が出したお知らせ"}
            </span>
            {live.length === 0
              ? <span className="text-xs" style={{ color: T.textMuted }}>現在公開しているお知らせはありません。</span>
              : <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: T.successSubtle, color: T.success }}>{live.length}件公開中</span>}
            {scheduled.length > 0 && (
              <span className="text-xs" style={{ color: T.textMuted }}>公開前 {scheduled.length}件</span>
            )}
          </div>
          {live.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {live.map(a => (
                <li key={a.announcementId} className="flex items-center gap-2 text-xs" style={{ color: T.textSecondary }}>
                  <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: T.textMuted }} />
                  <span className="truncate">{a.title}</span>
                  {a.expiresAt && <span className="ml-auto shrink-0" style={{ color: T.textMuted }}>{fmt(a.expiresAt)}まで</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {canPost && !composing && (
        <div className="flex flex-wrap items-center gap-2">
          <Btn size="sm" kind="ghost" icon={Plus} onClick={openCompose}>お知らせを出す</Btn>
          <button type="button" onClick={() => go?.("announcements")} className="text-xs font-bold" style={{ color: T.accent }}>
            出したお知らせを管理する
          </button>
          {message && <span className="text-xs font-bold" style={{ color: T.success }}>{message}</span>}
        </div>
      )}
    </div>
  );
}

// ---- 管理画面（一覧・作成・編集・削除） ----
export default function Announcements({ role }) {
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isAdmin = role === "admin";

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

  async function submit() {
    if (!draft || busy) return;
    setBusy(true); setMessage("");
    try {
      await saveDraft(draft, role);
      setDraft(null);
      load();
    } catch (e) {
      setMessage(e?.errorMessage || e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(a) {
    if (busy) return;
    setBusy(true); setMessage("");
    try { await apiDelete(`/announcements/${a.announcementId}`); load(); }
    catch (e) { setMessage("削除に失敗しました: " + (e?.errorMessage || e?.message || e)); }
    finally { setBusy(false); }
  }

  const courseName = id => courses.find(c => c.courseId === id)?.name || (id ? "（コース情報なし）" : "");

  function targetLabel(a) {
    if (a.audience === "client") return "企業担当者";
    if (a.audience === "instructor") return "講師";
    if (a.courseId) return `受講生・${courseName(a.courseId)}`;
    if (a.companyId) return "受講生・自社";
    return "受講生・全員";
  }

  function periodLabel(a) {
    const range = `${fmt(a.publishedAt) || "即時"} 〜 ${fmt(a.expiresAt) || "終了日なし"}`;
    return { range, badge: PERIOD_LABEL[periodState(a)] };
  }

  if (state === "error") return <div className="p-4"><PrismErrorRetryCard message="お知らせを取得できませんでした。" onRetry={load} /></div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold" style={{ color: T.textPrimary }}>お知らせ</h3>
          <p className="text-xs" style={{ color: T.textMuted }}>
            公開期間を指定できます。研修が始まる前でも、終わった後でも出せます。
          </p>
        </div>
        <Btn size="sm" icon={Plus} onClick={() => { setMessage(""); setDraft(emptyDraft()); }}>お知らせを作成</Btn>
      </div>

      {!draft && message && (
        <div className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: T.dangerSubtle, color: T.danger }}>{message}</div>
      )}

      {draft && (
        <Card className="p-4">
          <AnnouncementEditor role={role} courses={courses} draft={draft} setDraft={setDraft}
            onSave={submit} onCancel={() => { setDraft(null); setMessage(""); }} busy={busy} message={message} />
        </Card>
      )}

      <Card className="p-0">
        {state === "loading" ? <div className="p-4"><SkeletonRows rows={3} /></div>
          : items.length === 0 ? <div className="p-4"><EmptyState icon={Megaphone} title="お知らせはまだありません" desc="「お知らせを作成」から登録できます。" /></div>
          : (
            <div className="flex flex-col">
              {items.map(a => {
                const p = periodLabel(a);
                const tone = p.badge === "公開中" ? { bg: T.successSubtle, fg: T.success }
                  : p.badge === "公開前" ? { bg: T.accentSubtle, fg: T.accentHover }
                  : { bg: T.bgBase, fg: T.textMuted };
                return (
                  <div key={a.announcementId} className="flex flex-wrap items-start gap-3 px-4 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{p.badge}</span>
                        <span className="text-sm font-bold" style={{ color: T.textPrimary }}>{a.title}</span>
                        {a.importance === "important" && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: T.warningSubtle, color: T.warning }}>重要</span>}
                        {a.pinned && <Pin size={13} style={{ color: T.textMuted }} />}
                      </div>
                      <div className="mt-0.5 text-xs" style={{ color: T.textMuted }}>
                        宛先: {targetLabel(a)} ・ 公開 {p.range}{isAdmin && a.authorName ? ` ・ ${a.authorName}` : ""}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm" style={{ color: T.textSecondary }}>{a.body}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Btn size="sm" kind="ghost" icon={Pencil} onClick={() => { setMessage(""); setDraft({ ...emptyDraft(), ...a }); }}>編集</Btn>
                      <Btn size="sm" kind="ghost" icon={Trash2} onClick={() => remove(a)} disabled={busy}>削除</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </Card>
    </div>
  );
}
