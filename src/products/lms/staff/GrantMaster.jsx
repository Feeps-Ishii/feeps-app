import React, { useEffect, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { APPLICATION_TYPE_OPTIONS, ENTERPRISE_SIZE_OPTIONS, GRANT_TYPE_SUGGESTIONS } from "../../grants/GrantsCatalog.js";
import { Btn, Card, Chip } from "../parts/ui.jsx";
import { arr, errText } from "./common.js";

/* 助成金マスタ（管理者）：年度ごとに、制度 × 区分 × 企業規模の助成率・単価・上限。
   申請の「助成金の種類」と同じ名前の制度があればそれを使い、無ければ「標準」を使う */

const FIELDS = [["wageSubsidyHourlyRate", "賃金助成（円／時間）"], ["expenseSubsidyRateRegular", "経費助成率 ・ 正規（%）"], ["expenseSubsidyRateFixedTerm", "経費助成率 ・ 有期（%）"], ["expenseSubsidyCapPerPerson", "経費の上限（円／人）"]];
const STD = "";
const thisYear = () => { const n = new Date(); return n.getMonth() + 1 >= 4 ? n.getFullYear() : n.getFullYear() - 1; };

function Cell({ title, value, onSave }) {
  const toForm = v => ({ ...Object.fromEntries(FIELDS.map(([k]) => [k, v?.[k] ?? ""])), sourceNote: v?.sourceNote || "" });
  const [f, setF] = useState(() => toForm(value));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const key = JSON.stringify(value || {});
  useEffect(() => { setF(toForm(value)); setErr(""); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = FIELDS.some(([k]) => String(f[k]) !== String(value?.[k] ?? "")) || f.sourceNote !== (value?.sourceNote || "");
  const filled = FIELDS.every(([k]) => value?.[k] != null);
  const save = async () => {
    setBusy(true); setErr("");
    try { await onSave({ ...Object.fromEntries(FIELDS.map(([k]) => [k, f[k] === "" ? null : Number(f[k])])), sourceNote: f.sourceNote }); }
    catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(false); }
  };
  return (
    <Card className="pad st-g">
      <div className="head"><h3 className="h3">{title}</h3><span className="r">{filled ? <Chip tone="ok">入力済み</Chip> : <Chip tone="warn">未入力</Chip>}</span></div>
      <div className="st-fg">{FIELDS.map(([k, t]) => <label key={k} className="field">{t}<input type="number" min="0" value={f[k]} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))} /></label>)}</div>
      <label className="field">根拠・メモ<input type="text" maxLength={500} value={f.sourceNote} placeholder="例：令和 8 年度 パンフレット p.12" onChange={e => setF(x => ({ ...x, sourceNote: e.target.value }))} /></label>
      {err && <div className="lms-err" role="alert">{err}</div>}
      <span className="row st-end"><Btn kind="sm" disabled={busy || !dirty} onClick={save}>{busy ? "保存しています" : "保存"}</Btn></span>
    </Card>
  );
}

export default function GrantMaster({ onBack, say }) {
  const [year, setYear] = useState(thisYear());
  const [years, setYears] = useState([]);
  const [st, setSt] = useState({ state: "loading", m: null });
  const [scheme, setScheme] = useState(STD);
  const [added, setAdded] = useState([]);
  const [name, setName] = useState("");
  const [key, setKey] = useState(0);
  useEffect(() => { apiGet("/grants/rate-master").then(r => setYears(arr(r?.items).map(x => x.fiscalYear))).catch(() => {}); }, [key]);
  useEffect(() => {
    let alive = true;
    setSt({ state: "loading", m: null });
    apiGet(`/grants/rate-master/${year}`).then(m => { if (alive) setSt({ state: "ready", m }); }).catch(() => { if (alive) setSt({ state: "error", m: null }); });
    return () => { alive = false; };
  }, [year, key]);
  const list = [...new Set([year, thisYear(), thisYear() + 1, ...years])].sort((a, b) => b - a);
  const schemes = [...new Set([...Object.keys(st.m?.schemes || {}), ...added])];
  const cats = scheme === STD ? st.m?.categories : st.m?.schemes?.[scheme];
  const save = async (at, size, payload) => {
    await apiPut(`/grants/rate-master/${year}`, { applicationType: at, companySize: size, ...(scheme === STD ? {} : { scheme }), ...payload });
    say?.("保存しました");
    setKey(k => k + 1);
  };
  const add = () => { const n = name.trim(); if (!n) return; setAdded(l => [...new Set([...l, n])]); setScheme(n); setName(""); };
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">すべての企業</div><h1 className="h1">助成金マスタ</h1></div><span className="r"><label className="fsort">年度<select className="in" value={year} onChange={e => { setYear(Number(e.target.value)); setScheme(STD); setAdded([]); }}>{list.map(y => <option key={y} value={y}>{y} 年度</option>)}</select></label><Btn kind="ghost sm" onClick={onBack}>← 助成金の一覧</Btn></span></div>
      {st.state === "error" ? <Card><div className="empty"><b>助成金マスタを確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card> : st.state === "loading" ? <div className="soon card">読み込み中</div> : (
        <>
          <div className="row">
            <button type="button" className="fchip" aria-pressed={scheme === STD} onClick={() => setScheme(STD)}>標準</button>
            {schemes.map(s => <button key={s} type="button" className="fchip" aria-pressed={scheme === s} onClick={() => setScheme(s)}>{s}</button>)}
            <span className="row st-nw gm-add"><input type="text" list="lms-grant-schemes" value={name} placeholder="制度を足す" aria-label="制度を足す" onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) add(); }} /><datalist id="lms-grant-schemes">{GRANT_TYPE_SUGGESTIONS.map(t => <option key={t} value={t} />)}</datalist><Btn kind="ghost sm" disabled={!name.trim()} onClick={add}>足す</Btn></span>
          </div>
          <div className="gm-grid">
            {APPLICATION_TYPE_OPTIONS.flatMap(a => ENTERPRISE_SIZE_OPTIONS.filter(s => s.value).map(s => <Cell key={`${scheme}|${a.value}|${s.value}`} title={`${a.label} ・ ${s.label}`} value={cats?.[a.value]?.[s.value]} onSave={p => save(a.value, s.value, p)} />))}
          </div>
        </>
      )}
    </div>
  );
}
