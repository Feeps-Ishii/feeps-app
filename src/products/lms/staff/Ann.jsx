import React, { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { Btn, Cal, Card, Chip, Modal } from "../parts/ui.jsx";
import { arr, errText, hm, md, useStaffCourse, useRoster } from "./common.js";

/* お知らせ（講師・コース担当者・企業担当者で共通。モック annC・annX）：左で出す（確かめて出す・日時を決めて予約も）、右に一覧と既読数。
   講師は宛先に企業担当者を足せる・AI で書く／やさしく／短く／英語も添える・まだの人を見てもう一度知らせる（既読は ADR 0033）。
   企業担当者の宛先は自社の受講生 */

const EMPTY = { announcementId: "", title: "", body: "", important: false, when: "now", at: "", toTrainee: true, toClient: false };

export default function StaffAnn({ role, say }) {
  const ro = role === "client";
  const sc = useStaffCourse();
  const courseId = sc.course?.courseId || "";
  const { list: roster } = useRoster(courseId);
  const [coName, setCoName] = useState("");
  useEffect(() => { if (ro) apiGet("/companies").then(l => setCoName(arr(l)[0]?.name || "")).catch(() => {}); }, [ro]);
  const [mine, setMine] = useState(undefined);
  const [recv, setRecv] = useState(undefined);
  const [v, setV] = useState(EMPTY);
  const [check, setCheck] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [del, setDel] = useState(null);
  const [unread, setUnread] = useState(null); // { a, items }
  const load = useCallback(() => {
    apiGet("/announcements").then(r => setMine(arr(r?.items))).catch(() => setMine(null));
    if (ro) apiGet("/announcements/me").then(r => setRecv(arr(r?.items))).catch(() => setRecv(null));
    else setRecv([]);
  }, [ro]);
  useEffect(load, [load]);
  const f = (k, val) => setV(x => ({ ...x, [k]: val }));
  const n = roster?.length;
  const open = () => {
    if (!v.title.trim() || !v.body.trim()) { setErr("件名と本文を入れてください"); return; }
    if (!v.toTrainee && !v.toClient) { setErr("宛先を選んでください"); return; }
    if (v.when === "at" && !v.at) { setErr("出す日時を選んでください"); return; }
    setErr(""); setCheck(true);
  };
  const ai = async kind => {
    const re = kind.startsWith("rewrite");
    const text = re ? `${v.title}\n${v.body}` : [v.title, v.body].filter(Boolean).join("\n");
    if (!text.trim()) { setErr("件名か本文に伝えたいことを書いてください"); return; }
    setBusy(kind); setErr("");
    try {
      const r = await apiPost("/ai/staff-draft", { kind: re ? kind : "announcement", courseId, text });
      f("body", r.text);
    } catch (e) { setErr(errText(e, "下書きを作れませんでした")); } finally { setBusy(""); }
  };
  const send = async () => {
    setBusy("send"); setErr("");
    const base = { title: v.title.trim(), body: v.body.trim(), importance: v.important ? "important" : "normal", pinned: false, publishedAt: v.when === "at" ? new Date(v.at).toISOString() : "", expiresAt: "" };
    try {
      if (v.announcementId) await apiPut(`/announcements/${v.announcementId}`, { audience: v.toClient && !v.toTrainee ? "client" : "trainee", courseId: ro ? "" : courseId, ...base });
      else {
        if (v.toTrainee) await apiPost("/announcements", { audience: "trainee", courseId: ro ? "" : courseId, ...base });
        if (!ro && v.toClient) await apiPost("/announcements", { audience: "client", courseId: "", ...base });
      }
      say?.(v.when === "at" ? "予約しました" : "お知らせを出しました");
      setV(EMPTY); setCheck(false); load();
    } catch (e) { setErr(errText(e, "出せませんでした")); setCheck(false); } finally { setBusy(""); }
  };
  const remove = async a => {
    setDel(null);
    try { await apiDelete(`/announcements/${a.announcementId}`); say?.("消しました"); load(); }
    catch (e) { setErr(errText(e, "消せませんでした")); }
  };
  const showUnread = async a => {
    setUnread({ a, items: null });
    try { const r = await apiGet(`/announcements/${a.announcementId}/unread`); setUnread({ a, items: arr(r?.items) }); }
    catch { setUnread({ a, items: undefined }); }
  };
  const notifyAgain = async () => {
    setBusy("again");
    try { await apiPost("/trainees/notify", { courseId, traineeIds: unread.items.map(p => p.id), kind: "remind", message: `お知らせ「${unread.a.title}」を確認してください。` }); say?.("もう一度知らせました"); setUnread(null); }
    catch (e) { setErr(errText(e, "送れませんでした")); setUnread(null); } finally { setBusy(""); }
  };
  if (sc.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={sc.reload}>再読み込み</Btn></div></Card>;
  const mineIds = new Set(arr(mine).map(a => a.announcementId));
  const list = [...arr(mine), ...arr(recv).filter(a => !mineIds.has(a.announcementId))].filter(a => ro || !a.courseId || !courseId || a.courseId === courseId).sort((a, b) => String(b.publishedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.createdAt || "")));
  const now = Date.now();
  const to = [v.toTrainee && (ro ? `${coName || "自社"}の受講生${n != null ? ` ${n} 人` : ""}` : `受講生${n != null ? ` ${n} 人` : ""}`), !ro && v.toClient && "企業担当者"].filter(Boolean).join("・");
  return (
    <div className="st">
      <div className="head"><div>{sc.course && <div className="eyebrow">{sc.course.name}</div>}<h1 className="h1">お知らせ</h1></div></div>
      <div className="g2">
        <Card className="pad hc-c">
          <div className="head"><h2 className="h2">{v.announcementId ? "お知らせを直す" : ro ? "自社の受講生へ出す" : "お知らせを出す"}</h2>{v.announcementId && <span className="r"><Btn kind="ghost sm" onClick={() => setV(EMPTY)}>直すのをやめる</Btn><Btn kind="ghost sm" onClick={() => setDel(list.find(a => a.announcementId === v.announcementId))}>消す</Btn></span>}</div>
          {ro ? <div className="row"><Chip tone="mk">宛先：{to}</Chip></div> : (
            <div className="field">宛先<span className="row"><label className="st-ck"><input type="checkbox" checked={v.toTrainee} onChange={e => f("toTrainee", e.target.checked)} />受講生{n != null ? ` ${n}` : ""}</label><label className="st-ck"><input type="checkbox" checked={v.toClient} onChange={e => f("toClient", e.target.checked)} />企業担当者</label></span></div>
          )}
          <label className="field">件名<input type="text" value={v.title} placeholder={ro ? undefined : "例：明日の開始時間について"} onChange={e => f("title", e.target.value)} /></label>
          <div className="field"><span className="row ann-bh">本文{!ro && <span className="row">{[["draft", "AI で書く"], ["rewriteSoft", "やさしく"], ["rewriteShort", "短く"], ["rewriteEn", "英語も添える"]].map(([k, t]) => <Btn key={k} kind="ghost sm" disabled={!!busy || (k !== "draft" && !v.body.trim())} onClick={() => ai(k)}>{busy === k ? "作っています" : t}</Btn>)}</span>}</span><textarea rows={5} aria-label="本文" value={v.body} placeholder={ro ? undefined : "本文"} onChange={e => f("body", e.target.value)} /></div>
          {!ro && (
          <div className="st-fg">
            <div className="field">出す時<span className="seg"><button type="button" aria-pressed={v.when === "now"} onClick={() => f("when", "now")}>すぐ</button><button type="button" aria-pressed={v.when === "at"} onClick={() => f("when", "at")}>日時を決める</button></span></div>
            {v.when === "at" && <label className="field">日時<input type="datetime-local" value={v.at} onChange={e => f("at", e.target.value)} /></label>}
          </div>
          )}
          <span className="row">{!ro && <label className="st-ck"><input type="checkbox" checked={v.important} onChange={e => f("important", e.target.checked)} />重要</label>}<span style={{ marginLeft: "auto" }} /><Btn onClick={open}>確かめて出す</Btn></span>
          {err && <div className="lms-err" role="alert">{err}</div>}
        </Card>
        <Card className="pad hc-c">
          <div className="head"><h2 className="h2">{ro ? "お知らせ" : "送信済みのお知らせ"}</h2><span className="r"><Chip>{list.length}</Chip></span></div>
          {(mine === null || recv === null) && <div className="empty"><b>お知らせを確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div>}
          <div className="hc-al">
            {list.map(a => {
              const own = mineIds.has(a.announcementId), before = a.publishedAt && Date.parse(a.publishedAt) > now;
              return (
                <div key={a.announcementId} className="hc-an">
                  <Cal date={md(a.publishedAt || a.createdAt)} cat={own ? "cur" : "tm"} />
                  <span className="hc-ab">
                    <span className="row" style={{ gap: 6 }}>{ro ? <Chip tone={own ? "co" : "mk"}>{own ? "自社から" : "講師から"}</Chip> : <Chip>{a.audience === "client" ? "企業担当者" : "受講生"}</Chip>}{a.importance === "important" && <Chip tone="bad">重要</Chip>}{before && <Chip tone="warn">予約 {md(a.publishedAt)} {hm(a.publishedAt)}</Chip>}</span>
                    <b>{a.title}</b>
                    <small>{a.authorName || ""}</small>
                    {a.targetCount != null && <span className="row ann-rd"><span className="bar10"><i style={{ "--w": `${a.targetCount ? Math.round(a.readCount / a.targetCount * 100) : 0}%` }} /></span><small className="num">既読 {a.readCount}/{a.targetCount}</small></span>}
                  </span>
                  {own && !ro && <span className="row st-nw">{a.targetCount != null && a.readCount < a.targetCount && <Btn kind="ghost sm" onClick={() => showUnread(a)}>まだの人</Btn>}<Btn kind="ghost sm" onClick={() => setV({ ...EMPTY, announcementId: a.announcementId, title: a.title || "", body: a.body || "", important: a.importance === "important", toTrainee: a.audience !== "client", toClient: a.audience === "client" })}>直す</Btn></span>}
                </div>
              );
            })}
            {mine && recv && !list.length && <Chip>なし</Chip>}
          </div>
        </Card>
      </div>
      {check && (
        <Modal title="確かめて出す" width={500} onClose={() => setCheck(false)} footer={<><Btn kind="ghost" onClick={() => setCheck(false)}>直す</Btn><Btn disabled={!!busy} onClick={send}>{busy === "send" ? "出しています" : v.when === "at" ? "予約する" : "出す"}</Btn></>}>
          <dl className="kv"><div><dt>宛先</dt><dd>{to}</dd></div><div><dt>件名</dt><dd>{v.title}{v.important ? "（重要）" : ""}</dd></div><div><dt>本文</dt><dd className="st-pre">{v.body}</dd></div></dl>
        </Modal>
      )}
      {del && <Modal title="お知らせを消す" width={420} onClose={() => setDel(null)} footer={<><Btn kind="ghost" onClick={() => setDel(null)}>やめる</Btn><Btn onClick={() => remove(del)}>消す</Btn></>}><b>{del.title}</b></Modal>}
      {unread && (
        <Modal title={`まだの人 ・ ${unread.a.title}`} width={460} onClose={() => setUnread(null)} footer={<><Btn kind="ghost" onClick={() => setUnread(null)}>閉じる</Btn>{arr(unread.items).length > 0 && <Btn disabled={!!busy} onClick={notifyAgain}>もう一度知らせる</Btn>}</>}>
          {unread.items === null ? <div className="dv-mt">読み込み中</div> : unread.items === undefined ? <Chip>確認できません</Chip> : unread.items.length ? <div className="row">{unread.items.map(p => <Chip key={p.id}>{p.name}</Chip>)}</div> : <Chip tone="ok">全員確認済み</Chip>}
        </Modal>
      )}
    </div>
  );
}
