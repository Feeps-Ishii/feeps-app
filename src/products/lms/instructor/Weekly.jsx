import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip } from "../parts/ui.jsx";
import { arr, errText, md, ymd } from "../staff/common.js";

/* 週のまとめ（講師のホーム）：AI の下書きを講師が直して企業担当者へ送る。送ったものが企業担当者の「研修の様子」の上に出る */

// 今日を含む週の月曜〜金曜
function thisWeek(today) {
  const d = new Date(`${today}T00:00:00`), mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  return { from: ymd(mon), to: ymd(fri) };
}

export default function WeeklyCard({ courseId, say }) {
  const today = todayStr();
  const week = thisWeek(today);
  const [st, setSt] = useState("loading");
  const [v, setV] = useState({ title: "", text: "", from: week.from, to: week.to, sentAt: "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!courseId) return undefined;
    let alive = true;
    apiGet(`/completion-report/weekly?courseId=${encodeURIComponent(courseId)}`).then(r => {
      if (!alive) return;
      const it = r?.item;
      // 同じ週のものだけ続きから。前の週を送っていれば新しく書く
      if (it && it.from === week.from) setV({ title: it.title || "", text: arr(it.points).join("\n"), from: it.from, to: it.to, sentAt: it.sentAt || "" });
      setSt("ready");
    }).catch(() => { if (alive) setSt("error"); });
    return () => { alive = false; };
  }, [courseId, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = (k, x) => setV(s => ({ ...s, [k]: x }));
  const draft = async () => {
    setBusy("ai"); setErr("");
    try {
      const stats = await apiGet(`/completion-report/stats?courseId=${encodeURIComponent(courseId)}`);
      const o = stats?.overall || {};
      const r = await apiPost("/ai/staff-draft", { kind: "weekly", courseId, text: v.text, context: { from: v.from, to: v.to, attendanceRate: o.attendanceRate, reportRate: o.reportRate, testAverage: o.testAverage, late: o.late, absent: o.absent, tests: arr(stats?.tests).slice(-5) } });
      f("text", r.text);
    } catch (e) { setErr(errText(e, "下書きを作れませんでした")); } finally { setBusy(""); }
  };
  const save = async send => {
    if (send && !v.text.trim()) { setErr("まとめを書いてください"); return; }
    setBusy(send ? "send" : "save"); setErr("");
    try {
      const r = await apiPut(`/completion-report/weekly?courseId=${encodeURIComponent(courseId)}`, { courseId, title: v.title, points: v.text.split(/\r?\n/).map(x => x.replace(/^[・\-\s]+/, "").trim()).filter(Boolean), from: v.from, to: v.to, send });
      f("sentAt", r?.item?.sentAt || "");
      say?.(send ? "企業担当者に送りました" : "保存しました");
    } catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(""); }
  };
  return (
    <Card className="pad st-g">
      <div className="head"><div><h2 className="h2">週のまとめ</h2><small className="dv-mt num">{md(v.from)}〜{md(v.to)}</small></div><span className="r">{v.sentAt ? <Chip tone="ok">送信済み {md(v.sentAt)}</Chip> : <Chip>未送信</Chip>}</span></div>
      {st === "error" ? <div className="empty"><b>週のまとめを確認できません</b><Btn kind="ghost sm" onClick={() => { setSt("loading"); setKey(k => k + 1); }}>再読み込み</Btn></div> : (
        <>
          <input type="text" value={v.title} maxLength={80} placeholder="題（例：Spring の DI・Bean）" aria-label="題" onChange={e => f("title", e.target.value)} />
          <textarea rows={4} value={v.text} placeholder="1 行に 1 つ" aria-label="まとめ" onChange={e => f("text", e.target.value)} />
          {err && <div className="lms-err" role="alert">{err}</div>}
          <span className="row st-end"><Btn kind="ghost sm" disabled={!!busy || st !== "ready"} onClick={draft}>{busy === "ai" ? "書いています" : "AI で下書き"}</Btn><Btn kind="ghost sm" disabled={!!busy || st !== "ready"} onClick={() => save(false)}>保存</Btn><Btn kind="sm" disabled={!!busy || st !== "ready"} onClick={() => save(true)}>{busy === "send" ? "送っています" : v.sentAt ? "送り直す" : "企業担当者に送る"}</Btn></span>
        </>
      )}
    </Card>
  );
}
