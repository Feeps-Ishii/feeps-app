import React, { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { Btn, Cal, Card, Chip, Modal } from "../parts/ui.jsx";
import { arr, errText, hm, md } from "../staff/common.js";

/* 企業担当者のお知らせ（モック annC）：左で自社の受講生へ出す（確かめて出す・日時を決めて予約も）、右に一覧。
   自分が出したものは直せる・消せる。既読数は API が返すときだけ出す */

const EMPTY = { announcementId: "", title: "", body: "", important: false, when: "now", at: "" };

export default function ClientAnn({ say }) {
  const [mine, setMine] = useState(undefined);
  const [recv, setRecv] = useState(undefined);
  const [count, setCount] = useState(null);
  const [v, setV] = useState(EMPTY);
  const [check, setCheck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [del, setDel] = useState(null);
  const load = useCallback(() => {
    apiGet("/announcements").then(r => setMine(arr(r?.items))).catch(() => setMine(null));
    apiGet("/announcements/me").then(r => setRecv(arr(r?.items))).catch(() => setRecv(null));
  }, []);
  useEffect(() => {
    load();
    apiGet(`/dashboard/client?date=${new Date().toISOString().slice(0, 10)}`).then(d => setCount(arr(d?.trainees).length)).catch(() => {});
  }, [load]);
  const f = (k, val) => setV(x => ({ ...x, [k]: val }));
  const open = () => {
    if (!v.title.trim() || !v.body.trim()) { setErr("件名と本文を入れてください"); return; }
    if (v.when === "at" && !v.at) { setErr("出す日時を選んでください"); return; }
    setErr(""); setCheck(true);
  };
  const send = async () => {
    setBusy(true); setErr("");
    const payload = { audience: "trainee", courseId: "", title: v.title.trim(), body: v.body.trim(), importance: v.important ? "important" : "normal", pinned: false, publishedAt: v.when === "at" ? new Date(v.at).toISOString() : "", expiresAt: "" };
    try {
      if (v.announcementId) await apiPut(`/announcements/${v.announcementId}`, payload);
      else await apiPost("/announcements", payload);
      say?.(v.when === "at" ? "予約しました" : "お知らせを出しました");
      setV(EMPTY); setCheck(false); load();
    } catch (e) { setErr(errText(e, "出せませんでした")); setCheck(false); } finally { setBusy(false); }
  };
  const remove = async a => {
    setDel(null);
    try { await apiDelete(`/announcements/${a.announcementId}`); say?.("消しました"); load(); }
    catch (e) { setErr(errText(e, "消せませんでした")); }
  };
  const mineIds = new Set(arr(mine).map(a => a.announcementId));
  const list = [...arr(mine), ...arr(recv).filter(a => !mineIds.has(a.announcementId))].sort((a, b) => String(b.publishedAt || b.createdAt || "").localeCompare(String(a.publishedAt || a.createdAt || "")));
  const now = Date.now();
  return (
    <div className="st">
      <div className="head"><h1 className="h1">お知らせ</h1></div>
      <div className="g2">
        <Card className="pad hc-c">
          <div className="head"><h2 className="h2">{v.announcementId ? "お知らせを直す" : "自社の受講生へ出す"}</h2>{v.announcementId && <span className="r"><Btn kind="ghost sm" onClick={() => setV(EMPTY)}>やめる</Btn></span>}</div>
          <div className="field">宛先<span className="row"><span className="th-pill ok"><i aria-hidden="true" />自社の受講生 {count != null && <><b className="num">{count}</b> 人</>}</span></span></div>
          <label className="field">件名<input type="text" value={v.title} onChange={e => f("title", e.target.value)} /></label>
          <label className="field">本文<textarea rows={5} value={v.body} onChange={e => f("body", e.target.value)} /></label>
          <div className="st-fg">
            <label className="field">いつ<select className="in" value={v.when} onChange={e => f("when", e.target.value)}><option value="now">すぐに出す</option><option value="at">日時を決める</option></select></label>
            {v.when === "at" && <label className="field">日時<input type="datetime-local" value={v.at} onChange={e => f("at", e.target.value)} /></label>}
          </div>
          <span className="row"><label className="st-ck"><input type="checkbox" checked={v.important} onChange={e => f("important", e.target.checked)} />重要</label><span style={{ marginLeft: "auto" }} /><Btn onClick={open}>確かめて出す</Btn></span>
          {err && <div className="lms-err" role="alert">{err}</div>}
        </Card>
        <Card className="pad hc-c">
          <div className="head"><h2 className="h2">お知らせ</h2><span className="r"><Chip>{list.length}</Chip></span></div>
          {(mine === null || recv === null) && <div className="empty"><b>お知らせを確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div>}
          <div className="hc-al">
            {list.map(a => {
              const own = mineIds.has(a.announcementId), before = a.publishedAt && Date.parse(a.publishedAt) > now;
              return (
                <div key={a.announcementId} className="hc-an">
                  <Cal date={md(a.publishedAt || a.createdAt)} cat={own ? "cur" : "tm"} />
                  <span className="hc-ab">
                    <span className="row" style={{ gap: 6 }}><Chip tone={own ? "co" : "mk"}>{own ? "自社から" : "講師から"}</Chip>{a.importance === "important" && <Chip tone="bad">重要</Chip>}{before && <Chip tone="warn">予約 {md(a.publishedAt)} {hm(a.publishedAt)}</Chip>}</span>
                    <b>{a.title}</b>
                    <small>{a.authorName || ""}</small>
                    {own && <span className="gl-ed"><button type="button" onClick={() => setV({ announcementId: a.announcementId, title: a.title || "", body: a.body || "", important: a.importance === "important", when: before ? "at" : "now", at: "" })}>直す</button><button type="button" onClick={() => setDel(a)}>消す</button></span>}
                  </span>
                  {a.readCount != null && <span className="hc-rd num">既読 {a.readCount}{a.targetCount ? ` / ${a.targetCount}` : ""}</span>}
                </div>
              );
            })}
            {mine && recv && !list.length && <Chip>なし</Chip>}
          </div>
        </Card>
      </div>
      {check && (
        <Modal title="確かめて出す" width={500} onClose={() => setCheck(false)} footer={<><Btn kind="ghost" onClick={() => setCheck(false)}>直す</Btn><Btn disabled={busy} onClick={send}>{busy ? "出しています" : v.when === "at" ? "予約する" : "出す"}</Btn></>}>
          <dl className="kv"><div><dt>宛先</dt><dd>自社の受講生{count != null ? ` ${count} 人` : ""}</dd></div><div><dt>件名</dt><dd>{v.title}{v.important ? "（重要）" : ""}</dd></div><div><dt>本文</dt><dd className="st-pre">{v.body}</dd></div></dl>
        </Modal>
      )}
      {del && <Modal title="お知らせを消す" width={420} onClose={() => setDel(null)} footer={<><Btn kind="ghost" onClick={() => setDel(null)}>やめる</Btn><Btn onClick={() => remove(del)}>消す</Btn></>}><b>{del.title}</b></Modal>}
    </div>
  );
}
