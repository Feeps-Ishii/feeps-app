import React, { useEffect, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { Btn, Card, Chip } from "../parts/ui.jsx";
import { errText } from "./common.js";

/* コースごとの設定（モック cadmS の使う機能・settingX の notice と ai）。API は /course-config。AI の上限を変えるのは管理者だけ */

const FX = [["毎日", [["report", "日報"], ["att", "勤怠"]]], ["研修", [["cur", "カリキュラム"], ["test", "テスト"], ["prac", "練習問題"], ["dev", "個人開発"], ["doc", "フォルダ"]]], ["教室", [["team", "チーム"], ["seat", "席替え"], ["eval", "評価表"], ["done", "修了レポート"]]], ["その他", [["grant", "助成金"], ["ai", "AI の下書き"]]]];

export default function CourseConfig({ courseId, part, say }) {
  const [v, setV] = useState(null);
  const [base, setBase] = useState(null);
  const [st, setSt] = useState("loading");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    setSt("loading");
    apiGet(`/course-config?courseId=${encodeURIComponent(courseId)}`).then(d => { if (alive) { setV(d); setBase(d); setSt("ready"); } }).catch(() => { if (alive) setSt("error"); });
    return () => { alive = false; };
  }, [courseId, key]);
  if (st === "loading") return <div className="soon card">読み込み中</div>;
  if (st === "error") return <Card><div className="empty"><b>設定を確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card>;
  const dirty = JSON.stringify(v) !== JSON.stringify(base);
  const save = async () => {
    setBusy(true); setErr("");
    try { const r = await apiPut("/course-config", { courseId, features: v.features, remind: v.remind, ...(v.canEditBudget ? { aiBudgetYen: Number(v.aiBudgetYen) || 0 } : {}) }); setV(r); setBase(r); say?.("保存しました"); }
    catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(false); }
  };
  const setFx = (k, on) => setV(x => ({ ...x, features: { ...x.features, [k]: on } }));
  const setR = patch => setV(x => ({ ...x, remind: { ...x.remind, ...patch } }));
  const used = v.aiUsedYen, budget = Number(v.aiBudgetYen) || 0;
  const foot = <>{err && <div className="lms-err" role="alert">{err}</div>}<span className="row st-end">{dirty && <Chip tone="warn">保存していない変更</Chip>}<Btn kind="ghost sm" disabled={!dirty} onClick={() => setV(base)}>元に戻す</Btn><Btn kind="sm" disabled={!dirty || busy} onClick={save}>{busy ? "保存しています" : "保存"}</Btn></span></>;
  if (part === "fx") {
    const on = Object.values(v.features).filter(Boolean).length;
    return (
      <Card className="pad st-g">
        <div className="head"><h2 className="h2">使う機能</h2><span className="r"><Chip>{on} / {Object.keys(v.features).length}</Chip></span></div>
        {FX.map(([g, items]) => <div key={g} className="field">{g}<span className="row">{items.map(([k, t]) => <label key={k} className="st-ck"><input type="checkbox" checked={v.features[k] !== false} onChange={e => setFx(k, e.target.checked)} />{t}</label>)}</span></div>)}
        <div className="row"><Chip>切った機能はメニューから消える</Chip><Chip>記録は消えない</Chip></div>
        {foot}
      </Card>
    );
  }
  if (part === "notice") {
    return (
      <Card className="pad st-g">
        <h2 className="h2">リマインド</h2>
        <div className="cc-r"><span><b>日報がまだの人へ</b><small>研修日 ・ 受講生の通知に届く</small></span><input type="time" aria-label="日報のリマインドの時刻" value={v.remind.rep} onChange={e => setR({ rep: e.target.value })} /><label className="st-ck"><input type="checkbox" checked={v.remind.repOn} onChange={e => setR({ repOn: e.target.checked })} />送る</label></div>
        <div className="cc-r"><span><b>出勤の記録がない人へ</b><small>研修日 ・ 受講生の通知に届く</small></span><input type="time" aria-label="出勤のリマインドの時刻" value={v.remind.att} onChange={e => setR({ att: e.target.value })} /><label className="st-ck"><input type="checkbox" checked={v.remind.attOn} onChange={e => setR({ attOn: e.target.checked })} />送る</label></div>
        <div className="row"><Chip>15 分おきに確かめる</Chip><Chip>1 日 1 回</Chip></div>
        {foot}
      </Card>
    );
  }
  return (
    <Card className="pad st-g">
      <div className="head"><h2 className="h2">AI</h2><span className="r">{!v.canEditBudget && <Chip>上限は管理者が変更</Chip>}</span></div>
      <label className="st-ck"><input type="checkbox" checked={v.features.ai !== false} onChange={e => setFx("ai", e.target.checked)} />このコースで AI の下書きを使う</label>
      <label className="field">月の上限（円 ・ 0 は上限なし）<input type="number" min="0" step="1000" disabled={!v.canEditBudget} value={v.aiBudgetYen} onChange={e => setV(x => ({ ...x, aiBudgetYen: e.target.value }))} /></label>
      {used == null ? <Chip tone="bad">今月の費用を確認できません</Chip> : <div className="row sx-nw">{budget > 0 && <span className="tp-bar sm cc-b"><i style={{ "--w": `${Math.min(100, Math.round(used / budget * 100))}%` }} /></span>}<Chip tone={budget > 0 && used >= budget ? "bad" : "mk"}>今月 ¥{used.toLocaleString("ja-JP")}{budget > 0 ? `（${Math.round(used / budget * 100)}%）` : ""}</Chip></div>}
      <div className="row"><Chip>上限に達すると下書きが止まる</Chip><Chip>テストの採点は止まらない</Chip></div>
      {foot}
    </Card>
  );
}
