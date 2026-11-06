import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../api.js";
import {
  APPLICATION_TYPE_OPTIONS, DOCUMENT_TYPE_SUGGESTIONS, EMPLOYMENT_TYPE_OPTIONS, EMPTY_GRANT_FORM, ENTERPRISE_SIZE_OPTIONS, FORM_TYPE_OPTIONS, GRADUATE_STATUS_OPTIONS,
  GRANT_STATUS_OPTIONS, GRANT_TYPE_SUGGESTIONS, IT_EXPERIENCE_OPTIONS, applicationTypeLabel, documentStatusLabel, employmentTypeLabel, grantStatusLabel,
} from "../../grants/GrantsCatalog.js";
import { useCompanyCourses, useCompanyProfile, useCompanyTrainees, useGrantCalculationDraft, useGrantCompanies, useGrantCoursesMap, useGrantDocuments, useGrantExports, useGrantsList } from "../../grants/useGrants.js";
import { computeGrantStages, computeNextActions } from "../../grants/grantStages.js";
import { Btn, Card, Chip, FileIcon, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, errText, md, saveBlob, zipStore } from "./common.js";

const GrantRateMaster = lazy(() => import("../../grants/GrantsComponents.jsx").then(m => ({ default: m.GrantRateMaster })));

/* 助成金（管理者・企業担当者。モック grantList・grantD）：管理者は一覧 → 申請ごと、企業担当者は自社の申請。
   書類・入力・受講状況・集計と出力。期限と段階は grantStages.js、計算は /grants/{id}/calculation-draft、帳票は /exports（今の決まりのまま）。
   8 割の判定は勤怠の日数からの目安（正式な訓練時間は計算の下書きが見る）。確定の項目は管理者だけ */

const yen = v => (v == null ? "—" : `¥${Number(v).toLocaleString("ja-JP")}`);
const THRESHOLD = 80;
const verdict = r => (r == null ? ["確認できません", ""] : r < THRESHOLD ? ["要件外の可能性", "bad"] : r < 88 ? ["注意", "warn"] : ["OK", "ok"]);
const docTone = s => ({ accepted: "ok", rejected: "bad", submitted: "blue" }[s] || "");

function Steps({ stages }) {
  return (
    <div className="gsteps">
      {stages.map(s => {
        const done = ["accepted", "submitted", "under_review"].includes(s.state.value);
        return <span key={s.key} className={done ? "done" : s.current ? "on" : ""}><b>{done ? "✓ " : ""}{s.label}</b><small>{s.state.label}{s.deadline ? ` ・ 〆 ${md(s.deadline.date)}` : ""}{s.deadline?.overdue && !done ? " 期限超過" : ""}</small></span>;
      })}
    </div>
  );
}

// 様式の欄と LMS の項目の対応（見るだけ）
function MapModal({ onClose }) {
  const [st, setSt] = useState({ state: "loading", forms: [] }); const [key, setKey] = useState("plan");
  const load = () => { setSt({ state: "loading", forms: [] }); apiGet("/grants/form-mappings").then(r => setSt({ state: "ready", forms: arr(r?.forms) })).catch(() => setSt({ state: "error", forms: [] })); };
  useEffect(load, []);
  const form = st.forms.find(f => f.key === key);
  const K = { auto: ["LMS から", "ok"], manual: ["人が入れる", "warn"], fixed: ["固定", ""] };
  return (
    <Modal title="様式の対応表" width={780} onClose={onClose} footer={<Btn kind="ghost" onClick={onClose}>閉じる</Btn>}>
      {st.state === "loading" ? <div className="soon">読み込み中</div> : st.state === "error" ? <div className="empty"><b>対応表を確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div> : (
        <>
          <span className="seg gm-seg">{st.forms.map(f => <button key={f.key} type="button" aria-pressed={key === f.key} onClick={() => setKey(f.key)}>{{ plan: "計画", henkou: "変更", shikyu: "支給", offjt: "OFF-JT" }[f.key] || f.key}</button>)}</span>
          {form && <span className="row"><Chip tone="mk">{form.label}</Chip>{form.formVersion && <Chip>{form.formVersion} 版</Chip>}</span>}
          <div className="scroll gm-t"><table className="tbl"><thead><tr><th>様式の欄</th><th>セル</th><th>入り方</th><th>LMS の項目</th></tr></thead><tbody>
            {arr(form?.rows).map((r, i) => <tr key={`${r.cell}-${r.label}-${i}`}><td><b>{r.label}</b>{r.sheet && <small className="dv-sub">{r.sheet}</small>}</td><td className="num">{r.cell || "—"}</td><td><Chip tone={K[r.kind]?.[1]}>{K[r.kind]?.[0]}</Chip></td><td>{r.kind === "fixed" ? r.value : r.kind === "manual" ? <small>{r.reason || "—"}</small> : <span className="dv-mono">{r.source}</span>}</td></tr>)}
          </tbody></table></div>
        </>
      )}
    </Modal>
  );
}

function DocsTab({ grant, isAdmin, docs, nextActions, say }) {
  const [mapOpen, setMapOpen] = useState(false);
  const { generate, generating, error: genErr, clearError, lastResult } = useGrantExports(grant.grantId);
  const [formType, setFormType] = useState(FORM_TYPE_OPTIONS[0].value);
  const [up, setUp] = useState({ type: DOCUMENT_TYPE_SUGGESTIONS[0], custom: "", due: "", note: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [review, setReview] = useState(null); const [note, setNote] = useState(""); const [del, setDel] = useState(null);
  const fileRef = useRef(null);
  const onFile = async e => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true); setErr("");
    try { await docs.uploadDocument({ file, documentType: up.type === "その他" ? up.custom.trim() || "その他" : up.type, dueDate: up.due, note: up.note }); say?.("書類を置きました"); }
    catch (x) { setErr(errText(x, "置けませんでした")); } finally { setBusy(false); }
  };
  const view = async d => { try { const url = await docs.viewDocument(d.documentId); if (url) window.open(url, "_blank", "noopener,noreferrer"); } catch { setErr("書類を開けませんでした"); } };
  const make = async () => { clearError(); try { await generate(formType); await docs.reload(); } catch { /* genErr に出る */ } };
  const zipAll = async () => {
    setBusy(true); setErr("");
    try {
      const used = {}, files = [];
      for (const d of docs.items) {
        // eslint-disable-next-line no-await-in-loop
        const url = await docs.viewDocument(d.documentId);
        // eslint-disable-next-line no-await-in-loop
        const r = await fetch(url);
        if (!r.ok) throw new Error(`「${d.fileName}」を読めませんでした`);
        const base = d.fileName || d.documentId, k = used[base] = (used[base] || 0) + 1;
        // eslint-disable-next-line no-await-in-loop
        files.push({ name: k > 1 ? `${k}_${base}` : base, data: new Uint8Array(await r.arrayBuffer()) });
      }
      saveBlob(zipStore(files), `助成金の書類_${grant.grantType || "申請"}.zip`);
    } catch (e) { setErr(errText(e, "まとめられませんでした")); } finally { setBusy(false); }
  };
  const decide = async s => { setBusy(true); try { await docs.reviewDocument(review.documentId, s, note); setReview(null); setNote(""); say?.(s === "accepted" ? "受理しました" : "差し戻しました"); } catch (x) { setErr(errText(x, "保存できませんでした")); } finally { setBusy(false); } };
  const remove = async () => { setBusy(true); try { await docs.removeDocument(del.documentId); setDel(null); say?.("消しました"); } catch (x) { setErr(errText(x, "消せませんでした")); setDel(null); } finally { setBusy(false); } };
  return (
    <>
      {nextActions.length > 0 && <Card className="pad st-g"><span className="eyebrow">次にやること</span>{nextActions.map(a => <span key={a} className="dr-block"><b>{a}</b></span>)}</Card>}
      <Card className="pad st-g">
        {mapOpen && <MapModal onClose={() => setMapOpen(false)} />}
        <div className="head"><h2 className="h3">書類</h2><span className="r"><Chip>{docs.items.length} 件</Chip>{isAdmin && <Btn kind="ghost sm" onClick={() => setMapOpen(true)}>様式の対応表</Btn>}{docs.items.length > 0 && <Btn kind="ghost sm" disabled={busy} onClick={zipAll}>まとめて受け取る（zip）</Btn>}</span></div>
        {docs.error ? <div className="empty"><b>書類を確認できません</b><Btn kind="ghost sm" onClick={docs.reload}>再読み込み</Btn></div> : docs.loading ? <div className="dv-mt">読み込み中</div> : (
          <div className="fd-l">
            {docs.items.map(d => (
              <div key={d.documentId} className="fd-f">
                <FileIcon name={d.fileName || ""} />
                <span className="fd-fb"><b>{d.documentType || "種別未設定"}</b><small className="num">{d.fileName}{d.dueDate ? ` ・ 期限 ${md(d.dueDate)}` : ""}{d.uploadedAt ? ` ・ 提出 ${md(d.uploadedAt)}` : ""}{d.note ? ` ・ ${d.note}` : ""}</small></span>
                <span className="row">{d.source === "generated" && <Chip tone="mk">自動生成</Chip>}<Chip tone={docTone(d.status)}>{documentStatusLabel(d.status)}</Chip></span>
                <span className="fd-ac"><Btn kind="ghost sm" onClick={() => view(d)}>開く</Btn>{isAdmin && d.status === "submitted" && d.source !== "generated" && <Btn kind="sm" onClick={() => { setReview(d); setNote(""); }}>審査</Btn>}{isAdmin && <Btn kind="ghost sm" onClick={() => setDel(d)}>消す</Btn>}</span>
              </div>
            ))}
            {!docs.items.length && <div><Chip>なし</Chip></div>}
          </div>
        )}
        {err && <div className="lms-err" role="alert">{err}</div>}
      </Card>
      <div className="g2e">
        <Card className="pad st-g">
          <h2 className="h3">書類を置く</h2>
          <div className="st-fg"><label className="field">種別<select className="in" value={up.type} onChange={e => setUp(u => ({ ...u, type: e.target.value }))}>{DOCUMENT_TYPE_SUGGESTIONS.map(t => <option key={t}>{t}</option>)}</select></label>{up.type === "その他" ? <label className="field">種別の名前<input type="text" value={up.custom} onChange={e => setUp(u => ({ ...u, custom: e.target.value }))} /></label> : <label className="field">期限<input type="date" value={up.due} onChange={e => setUp(u => ({ ...u, due: e.target.value }))} /></label>}</div>
          <label className="field">メモ<input type="text" value={up.note} onChange={e => setUp(u => ({ ...u, note: e.target.value }))} /></label>
          <input ref={fileRef} type="file" className="lms-sr" aria-label="置くファイル" onChange={onFile} />
          <span className="row st-end"><Btn kind="sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "置いています" : "ファイルを選ぶ"}</Btn></span>
        </Card>
        <Card className="pad st-g">
          <h2 className="h3">Excel の帳票を作る</h2>
          <label className="field">帳票<select className="in" value={formType} disabled={generating} onChange={e => setFormType(e.target.value)}>{FORM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <span className="row st-end"><Btn kind="sm" disabled={generating} onClick={make}>{generating ? "作っています" : "作る"}</Btn></span>
          {genErr && <div className="lms-err" role="alert">{genErr}</div>}
          {lastResult && <div className="row"><Chip tone={lastResult.files.length ? "ok" : "warn"}>{lastResult.files.length ? `${lastResult.files.length} 件作成` : lastResult.missingFields?.[0]?.label || "作れませんでした"}</Chip>{lastResult.missingFields?.length > 0 && <Chip tone="warn">未入力 {lastResult.missingFields.length} 項目</Chip>}</div>}
          {lastResult?.missingFields?.length > 0 && <small className="dv-mt">{lastResult.missingFields.slice(0, 8).map(f => f.label).join("、")}{lastResult.missingFields.length > 8 ? " ほか" : ""}</small>}
        </Card>
      </div>
      {review && <Modal title={`書類の審査 ・ ${review.documentType}`} width={480} onClose={() => setReview(null)} footer={<><Btn kind="ghost" disabled={busy} onClick={() => setReview(null)}>やめる</Btn><Btn kind="ghost" disabled={busy} onClick={() => decide("rejected")}>差し戻す</Btn><Btn disabled={busy} onClick={() => decide("accepted")}>受理する</Btn></>}><label className="field">コメント<textarea rows={3} value={note} onChange={e => setNote(e.target.value)} /></label></Modal>}
      {del && <Modal title="書類を消す" width={420} onClose={() => setDel(null)} footer={<><Btn kind="ghost" onClick={() => setDel(null)}>やめる</Btn><Btn disabled={busy} onClick={remove}>完全に消す</Btn></>}><b>{del.fileName || del.documentType}</b></Modal>}
    </>
  );
}

function TraineeModal({ t, isAdmin, onClose, onSave }) {
  const [f, setF] = useState({ employmentType: t.employmentType || "", graduateStatus: t.graduateStatus || "", itExperienceLevel: t.itExperienceLevel || "", gender: t.gender || "", hireDate: t.hireDate || "", employmentInsuranceNumber: t.employmentInsuranceNumber || "", grantEligible: !!t.grantEligible, grantEligibilityNote: t.grantEligibilityNote || "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const s = (k, v) => setF(x => ({ ...x, [k]: v }));
  const sel = (k, label, opts) => <label className="field">{label}<select className="in" value={f[k]} onChange={e => s(k, e.target.value)}><option value="">未設定</option>{opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  const save = async () => { setBusy(true); setErr(""); try { const { grantEligible, grantEligibilityNote, ...rest } = f; await onSave(t.userId, isAdmin ? f : rest); onClose(); } catch (e) { setErr(errText(e, "保存できませんでした")); setBusy(false); } };
  return (
    <Modal title={`${t.name} の情報`} width={520} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy} onClick={save}>保存</Btn></>}>
      <label className="field">雇用保険の被保険者番号<input type="text" value={f.employmentInsuranceNumber} placeholder="1234-567890-1" onChange={e => s("employmentInsuranceNumber", e.target.value)} /></label>
      <div className="st-fg">{sel("employmentType", "雇用形態", EMPLOYMENT_TYPE_OPTIONS)}{sel("graduateStatus", "新卒／既卒", GRADUATE_STATUS_OPTIONS)}{sel("itExperienceLevel", "IT 経験", IT_EXPERIENCE_OPTIONS)}<label className="field">入社日<input type="date" value={f.hireDate} onChange={e => s("hireDate", e.target.value)} /></label></div>
      {isAdmin ? <><label className="st-ck"><input type="checkbox" checked={f.grantEligible} onChange={e => s("grantEligible", e.target.checked)} />助成金の対象として確定</label><label className="field">対象外の理由<input type="text" value={f.grantEligibilityNote} onChange={e => s("grantEligibilityNote", e.target.value)} /></label></> : <div className="row"><Chip tone={f.grantEligible ? "ok" : ""}>{f.grantEligible ? "対象" : "対象外／未確定"}</Chip></div>}
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

const excelDate = v => { if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10); const m = String(v || "").match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : ""; };
const squeeze = t => String(t || "").replace(/[\s　]/g, "");
// 助成金ひな形（public/templates/grant-template.xlsx）を読む
async function readGrantExcel(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const rows = name => (wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true }) : null);
  const info = rows("企業情報"), people = rows("受講者");
  if (!info && !people) throw new Error("「企業情報」「受講者」のシートがありません。ひな形から作ってください");
  const get = label => arr(info).find(r => squeeze(r[0]) === squeeze(label))?.[1];
  const capital = Number(get("資本金（万円）")), workers = Number(get("常時雇用する労働者数"));
  const profile = { ...(String(get("企業名") || "").trim() ? { name: String(get("企業名")).trim() } : {}), ...(capital > 0 ? { capitalAmount: capital * 10000 } : {}), ...(workers > 0 ? { employeeCount: workers } : {}), ...(get("担当者の名前") ? { grantContactName: String(get("担当者の名前")).trim() } : {}), ...(get("担当者のメール") ? { grantContactEmail: String(get("担当者のメール")).trim() } : {}) };
  const list = arr(people).filter(r => squeeze(r[0]) !== "例" && squeeze(r[1]) && squeeze(r[1]) !== "氏名").map(r => ({ name: String(r[1]).trim(), no: String(r[2] || "").trim(), type: EMPLOYMENT_TYPE_OPTIONS.find(o => squeeze(o.label) === squeeze(r[3]))?.value || "", hire: excelDate(r[4]) }));
  return { profile, list };
}

function InputTab({ grant, isAdmin, say }) {
  const companyId = isAdmin ? grant.companyId : "";
  const pf = useCompanyProfile(companyId, true);
  const tr = useCompanyTrainees(companyId, true);
  const [form, setForm] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [edit, setEdit] = useState(null);
  const [imp, setImp] = useState(null); const xlRef = useRef(null);
  useEffect(() => { setForm(pf.profile ? { ...pf.profile } : null); }, [pf.profile]);
  if (pf.error) return <Card><div className="empty"><b>企業の情報を確認できません</b><Btn kind="ghost sm" onClick={pf.reload}>再読み込み</Btn></div></Card>;
  if (!form) return <div className="soon card">読み込み中</div>;
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const field = (k, label, type = "text") => <label className="field">{label}<input type={type} value={form[k] ?? ""} onChange={e => s(k, e.target.value)} /></label>;
  const save = async () => {
    setBusy(true); setErr("");
    const payload = { ...form };
    ["companyId", "updatedAt", "updatedByRole"].forEach(k => delete payload[k]);
    ["capitalAmount", "employeeCount"].forEach(k => { if (payload[k] === "" || payload[k] == null) delete payload[k]; else payload[k] = Number(payload[k]); });
    try { await pf.save(payload); say?.("保存しました"); } catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(false); }
  };
  const onXl = async e => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setErr("");
    try { setImp(await readGrantExcel(file)); } catch (x) { setErr(errText(x, "Excel を読めませんでした")); }
  };
  const applyImp = async () => {
    setBusy(true); setErr("");
    const miss = [];
    try {
      setForm(f => ({ ...f, ...imp.profile }));
      for (const r of imp.list) {
        const t = tr.trainees.find(x => squeeze(x.name) === squeeze(r.name));
        if (!t) { miss.push(r.name); continue; }
        // eslint-disable-next-line no-await-in-loop
        await tr.updateTrainee(t.userId, { employmentInsuranceNumber: r.no || t.employmentInsuranceNumber || "", employmentType: r.type || t.employmentType || "", hireDate: r.hire || t.hireDate || "", graduateStatus: t.graduateStatus || "", itExperienceLevel: t.itExperienceLevel || "", gender: t.gender || "" });
      }
      setImp(null);
      say?.("読み込みました ・ 企業の情報は保存を押してください");
      if (miss.length) setErr(`見つからない受講者：${miss.join("、")}`);
    } catch (x) { setErr(errText(x, "保存できませんでした")); } finally { setBusy(false); }
  };
  const targets = arr(grant.targetTraineeIds);
  const people = tr.trainees.filter(t => !targets.length || targets.includes(t.userId));
  const missNo = people.filter(t => !t.employmentInsuranceNumber).length;
  const check = t => (!t.employmentInsuranceNumber ? <Chip tone="bad">被保険者番号がありません</Chip> : !t.employmentType ? <Chip tone="warn">雇用形態がまだ</Chip> : <span className="xlok">✓</span>);
  return (
    <>
      <Card className="pad st-g">
        <div className="head"><h2 className="h2">企業の情報</h2><span className="r">{form.enterpriseSize ? <Chip tone="ok">{ENTERPRISE_SIZE_OPTIONS.find(o => o.value === form.enterpriseSize)?.label}</Chip> : <Chip tone="warn">企業規模が未設定</Chip>}</span></div>
        <div className="g3">
          {field("name", "会社名")}{field("address", "住所")}{field("tel", "TEL")}
          {field("representativeTitle", "代表者役職")}{field("representativeName", "代表者氏名")}{field("corporateNumber", "法人番号（13 桁）")}
          {field("capitalAmount", "資本金（円）", "number")}{field("employeeCount", "従業員数", "number")}
          <label className="field">企業規模<select className="in" value={form.enterpriseSize || ""} onChange={e => s("enterpriseSize", e.target.value)}><option value="">未設定</option>{ENTERPRISE_SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          {field("standardWorkingHours", "通常の就業時間")}{field("trainingWorkingHours", "研修中の就業時間")}{field("grantContactName", "助成金の担当者")}
          {field("grantContactEmail", "担当者メール")}{field("grantContactPhone", "担当者電話")}{field("grantContactTitle", "担当者の役職")}
          {field("contactPersonName", "連絡先の氏名")}{field("contactPersonEmail", "連絡先のメール")}{field("contactPersonPhone", "連絡先の電話")}
        </div>
        {err && <div className="lms-err" role="alert">{err}</div>}
        <span className="row st-end"><Btn kind="sm" disabled={busy} onClick={save}>{busy ? "保存しています" : "保存"}</Btn></span>
      </Card>
      <Card className="pad st-g">
        <div className="head"><h2 className="h2">受講者 ・ {people.length} 人</h2><span className="r">{missNo ? <Chip tone="bad">被保険者番号がない {missNo} 人</Chip> : <Chip tone="ok">全員分</Chip>}<a className="btn ghost sm cw-a" href="/templates/grant-template.xlsx" download="助成金ひな形.xlsx">助成金ひな形</a><Btn kind="ghost sm" onClick={() => xlRef.current?.click()}>Excel で入れる</Btn></span></div>
        <input ref={xlRef} type="file" accept=".xlsx,.xls" className="lms-sr" aria-label="助成金ひな形を選ぶ" onChange={onXl} />
        {tr.error ? <div className="empty"><b>受講者を確認できません</b><Btn kind="ghost sm" onClick={tr.reload}>再読み込み</Btn></div> : (
          <div className="scroll"><table className="tbl"><thead><tr><th>受講者</th><th>被保険者番号</th><th>雇用形態</th><th>対象</th><th>チェック</th><th /></tr></thead><tbody>
            {people.map(t => <tr key={t.userId} className={!t.employmentInsuranceNumber ? "xlw" : ""}><td><b>{t.name}</b></td><td className="num">{t.employmentInsuranceNumber || "—"}</td><td>{employmentTypeLabel(t.employmentType) || "—"}</td><td>{t.grantEligible ? <Chip tone="ok">対象</Chip> : <Chip>未確定</Chip>}</td><td>{check(t)}</td><td><Btn kind="ghost sm" onClick={() => setEdit(t)}>直す</Btn></td></tr>)}
            {!people.length && <tr><td colSpan={6}><Chip>なし</Chip></td></tr>}
          </tbody></table></div>
        )}
      </Card>
      {imp && (() => { const hit = imp.list.filter(r => tr.trainees.some(x => squeeze(x.name) === squeeze(r.name))), none = imp.list.filter(r => !hit.includes(r)); return <Modal title="Excel の確認" width={480} onClose={() => setImp(null)} footer={<><Btn kind="ghost" onClick={() => setImp(null)}>やめる</Btn><Btn disabled={busy} onClick={applyImp}>{busy ? "入れています" : "入れる"}</Btn></>}><div className="row"><Chip tone="ok">受講者 {hit.length} 人</Chip>{none.length > 0 && <Chip tone="warn">見つからない {none.length} 人</Chip>}{Object.keys(imp.profile).length > 0 && <Chip>企業の情報 {Object.keys(imp.profile).length} 項目</Chip>}</div>{none.length > 0 && <div className="row">{none.slice(0, 12).map(r => <Chip key={r.name}>{r.name}</Chip>)}</div>}</Modal>; })()}
      {edit && <TraineeModal t={edit} isAdmin={isAdmin} onClose={() => setEdit(null)} onSave={async (id, p) => { await tr.updateTrainee(id, p); say?.("保存しました"); }} />}
    </>
  );
}

function AttendTab({ grant }) {
  const [st, setSt] = useState({ state: "loading", data: null });
  const [q, setQ] = useState(""); const [tab, setTab] = useState("all"); const [sort, setSort] = useState("low");
  useEffect(() => {
    if (!grant.courseId) { setSt({ state: "none", data: null }); return undefined; }
    let alive = true;
    apiGet(`/completion-report/stats?courseId=${encodeURIComponent(grant.courseId)}`).then(data => { if (alive) setSt({ state: "ready", data }); }).catch(() => { if (alive) setSt({ state: "error", data: null }); });
    return () => { alive = false; };
  }, [grant.courseId]);
  if (st.state === "loading") return <div className="soon card">読み込み中</div>;
  if (st.state !== "ready") return <Card><div className="empty"><b>受講状況を確認できません</b></div></Card>;
  const p = st.data.period || {}, targets = arr(grant.targetTraineeIds);
  const rows = arr(st.data.trainees).filter(t => !targets.length || targets.includes(t.id)).map(t => {
    const missed = t.absent + t.missing, total = p.totalDays || p.trainingDays || 0;
    return { ...t, rate: t.attendanceRate, left: total ? Math.floor(total * (1 - THRESHOLD / 100)) - missed : null };
  });
  const kind = r => verdict(r.rate)[1] || "x";
  const list = rows.filter(r => matchName(r.name, "", q) && (tab === "all" || kind(r) === tab)).sort(sort === "low" ? (a, b) => (a.rate ?? 101) - (b.rate ?? 101) : (a, b) => a.name.localeCompare(b.name, "ja"));
  return (
    <>
      <div className="row"><Chip>研修 {p.trainingDays ?? 0}{p.totalDays ? ` / ${p.totalDays}` : ""} 日</Chip><Chip tone="mk">勤怠から自動で集計</Chip><Chip>日数の目安</Chip></div>
      <ListTool tabs={[["all", "すべて", rows.length], ["bad", "要件外の可能性", rows.filter(r => kind(r) === "bad").length, "bad"], ["warn", "注意", rows.filter(r => kind(r) === "warn").length, "warn"], ["ok", "OK", rows.filter(r => kind(r) === "ok").length, "ok"]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["low", "受講率の低い順"], ["name", "名前順"]]} sort={sort} onSort={setSort} />
      <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>受講者</th><th>出席</th><th>受講率（いま）</th><th>8 割まで休める日数</th><th>見通し</th></tr></thead><tbody>
        {list.map(r => { const [t, c] = verdict(r.rate); return <tr key={r.id}><td><b>{r.name}</b></td><td className="num">{r.attended} / {p.trainingDays ?? 0} 日</td><td className="num">{r.rate == null ? "—" : `${r.rate}%`}</td><td className="num">{r.left == null ? "—" : r.left < 0 ? "超過" : `${r.left} 日`}</td><td><Chip tone={c}>{t}</Chip></td></tr>; })}
        {!list.length && <tr><td colSpan={5}><Chip>該当なし</Chip></td></tr>}
      </tbody></table></div></Card>
    </>
  );
}

function OutTab({ grant, isAdmin, onSave, say }) {
  const { calculate, calculating, error, result } = useGrantCalculationDraft(grant.grantId);
  const [cost, setCost] = useState({ perPersonEnrollmentFee: grant.expenseActualCosts?.perPersonEnrollmentFee ?? "", perPersonCertificationFee: grant.expenseActualCosts?.perPersonCertificationFee ?? "", inCompanyCostTotal: grant.expenseActualCosts?.inCompanyCostTotal ?? "", previousReceivedDeduction: grant.expenseActualCosts?.previousReceivedDeduction ?? "", note: grant.expenseActualCosts?.note || "" });
  const [adm, setAdm] = useState({ status: grant.status, appliedAt: grant.appliedAt || "", changeDate: grant.changeDate || "", documentsSubmittedAt: grant.documentsSubmittedAt || "", paidAt: grant.paidAt || "", amount: grant.amount ?? "", remarks: grant.remarks || "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const c = (k, v) => setCost(x => ({ ...x, [k]: v })); const a = (k, v) => setAdm(x => ({ ...x, [k]: v }));
  const num = k => (cost[k] === "" || cost[k] == null ? null : Number(cost[k]));
  const save = async () => {
    setBusy(true); setErr("");
    const payload = { remarks: adm.remarks, expenseActualCosts: { perPersonEnrollmentFee: num("perPersonEnrollmentFee"), perPersonCertificationFee: num("perPersonCertificationFee"), inCompanyCostTotal: num("inCompanyCostTotal"), previousReceivedDeduction: num("previousReceivedDeduction"), note: cost.note } };
    if (isAdmin) Object.assign(payload, { status: adm.status, appliedAt: adm.appliedAt || null, changeDate: adm.changeDate || null, documentsSubmittedAt: adm.documentsSubmittedAt || null, paidAt: adm.paidAt || null, amount: adm.amount === "" ? null : Number(adm.amount) });
    try { await onSave(payload); say?.("保存しました"); } catch (e) { setErr(errText(e, "保存できませんでした")); } finally { setBusy(false); }
  };
  const w = result?.wageSubsidy, x = result?.expenseSubsidy;
  return (
    <div className="g2e">
      <Card className="pad st-g">
        <div className="head"><h2 className="h3">見込み（目安）</h2><span className="r"><Btn kind="sm" disabled={calculating} onClick={() => calculate().catch(() => {})}>{calculating ? "計算しています" : "計算する"}</Btn></span></div>
        {!result && grant.calculatedAmountDraft != null && <div className="row"><Chip>前回 {yen(grant.calculatedAmountDraft)}{grant.calculatedAmountDraftAt ? ` ・ ${md(grant.calculatedAmountDraftAt)}` : ""}</Chip></div>}
        {error && <div className="lms-err" role="alert">{error}</div>}
        {result && (
          <div className="gest">
            {result.canCalculateExpense && x ? <div><span>経費助成</span><b className="num">{yen(x.amount)}</b><small>正規等 {x.regularCount} 人 {x.rateRegular}% ・ 有期等 {x.fixedTermCount} 人 {x.rateFixedTerm}%</small></div> : <div><span>経費助成</span><b className="num">—</b><small>実費の入力が足りません</small></div>}
            {result.canCalculateWage && w ? <div><span>賃金助成</span><b className="num">{yen(w.amount)}</b><small>約 {w.totalActualTrainingHoursDecimal} 時間 × {Number(w.hourlyRate).toLocaleString("ja-JP")} 円（{result.fiscalYear} 年度）</small></div> : <div><span>賃金助成</span><b className="num">—</b></div>}
            {result.totalDraftAmount != null && <div className="t"><span>合計</span><b className="num">{yen(result.totalDraftAmount)}</b>{isAdmin && <Btn kind="ghost sm" onClick={() => a("amount", String(result.totalDraftAmount))}>金額へ反映</Btn>}</div>}
          </div>
        )}
        {arr(result?.missingItems).length > 0 && <div className="st-g"><span className="eyebrow">足りないもの</span><div className="row">{result.missingItems.map(i => <Chip key={i.code} tone="warn">{i.label}</Chip>)}</div></div>}
      </Card>
      <Card className="pad st-g">
        <h2 className="h3">経費の実費</h2>
        <div className="st-fg"><label className="field">1 人あたり入学料等（円）<input type="number" min="0" value={cost.perPersonEnrollmentFee} onChange={e => c("perPersonEnrollmentFee", e.target.value)} /></label><label className="field">1 人あたり検定費用（円）<input type="number" min="0" value={cost.perPersonCertificationFee} onChange={e => c("perPersonCertificationFee", e.target.value)} /></label><label className="field">事業内訓練の経費（円）<input type="number" min="0" value={cost.inCompanyCostTotal} onChange={e => c("inCompanyCostTotal", e.target.value)} /></label><label className="field">既受給の控除（円）<input type="number" min="0" value={cost.previousReceivedDeduction} onChange={e => c("previousReceivedDeduction", e.target.value)} /></label></div>
        <label className="field">根拠のメモ<input type="text" value={cost.note} onChange={e => c("note", e.target.value)} /></label>
        <label className="field">備考<textarea rows={2} value={adm.remarks} onChange={e => a("remarks", e.target.value)} /></label>
        {isAdmin && <>
          <span className="eyebrow">申請の状態（管理者）</span>
          <div className="st-fg"><label className="field">状態<select className="in" value={adm.status} onChange={e => a("status", e.target.value)}>{GRANT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label><label className="field">確定の金額（円）<input type="number" min="0" value={adm.amount} onChange={e => a("amount", e.target.value)} /></label><label className="field">計画申請の日<input type="date" value={adm.appliedAt} onChange={e => a("appliedAt", e.target.value)} /></label><label className="field">変更予定日<input type="date" value={adm.changeDate} onChange={e => a("changeDate", e.target.value)} /></label><label className="field">支給申請の提出日<input type="date" value={adm.documentsSubmittedAt} onChange={e => a("documentsSubmittedAt", e.target.value)} /></label><label className="field">支給日<input type="date" value={adm.paidAt} onChange={e => a("paidAt", e.target.value)} /></label></div>
        </>}
        {err && <div className="lms-err" role="alert">{err}</div>}
        <span className="row st-end"><Btn kind="sm" disabled={busy} onClick={save}>{busy ? "保存しています" : "保存"}</Btn></span>
      </Card>
    </div>
  );
}

function Detail({ grant, course, companyName, role, onBack, onSave, onDelete, say }) {
  const isAdmin = role === "admin";
  const docs = useGrantDocuments(grant.grantId, true);
  const pf = useCompanyProfile(isAdmin ? grant.companyId : "", true);
  const [tab, setTab] = useState("doc");
  const [del, setDel] = useState(false);
  const [note, setNote] = useState(null); const [noteErr, setNoteErr] = useState(""); const [noteBusy, setNoteBusy] = useState(false);
  const sendNote = async () => {
    setNoteBusy(true); setNoteErr("");
    try { const r = await apiPost(`/grants/${encodeURIComponent(grant.grantId)}/notify`, { message: note }); setNote(null); say?.(`企業担当者 ${r.count} 人に知らせました`); }
    catch (e) { setNoteErr(errText(e, "送れませんでした")); } finally { setNoteBusy(false); }
  };
  const stages = useMemo(() => computeGrantStages(grant, course), [grant, course]);
  const nextActions = useMemo(() => computeNextActions({ grant, stages, course, company: pf.profile, documents: docs.loading ? undefined : docs.items }), [grant, stages, course, pf.profile, docs.items, docs.loading]);
  const tabs = isAdmin ? [["doc", "書類"], ["in", "お客様の入力"], ["att", "受講状況"], ["out", "集計と出力"]] : [["doc", "やること"], ["in", "入力"], ["att", "受講状況"], ["out", "受け取る"]];
  const plan = stages.find(s => s.key === "plan"), pay = stages.find(s => s.key === "shikyu");
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{[companyName, course?.name || grant.courseId].filter(Boolean).join(" ・ ")}</div><h1 className="h1">助成金</h1></div><span className="r">{onBack && <Btn kind="ghost sm" onClick={onBack}>← 助成金の一覧</Btn>}{isAdmin && <Btn kind="ghost sm" onClick={() => setNote(nextActions[0] || "")}>お客様に知らせる</Btn>}{isAdmin && <Btn kind="ghost sm" onClick={() => setDel(true)}>消す</Btn>}</span></div>
      <Card className="pad st-g">
        <div className="head"><h2 className="h2">{grant.grantType || "助成金"} ・ {applicationTypeLabel(grant.applicationType)}</h2><span className="r"><Chip>{grantStatusLabel(grant.status)}</Chip>{plan?.deadline && !["accepted", "submitted", "under_review"].includes(plan.state.value) && <Chip tone={plan.deadline.overdue ? "bad" : plan.deadline.daysRemaining <= 30 ? "warn" : ""}>{plan.deadline.overdue ? "計画届の期限を過ぎました" : `計画届の期限まで あと ${plan.deadline.daysRemaining} 日`}</Chip>}{pay?.deadline && <Chip>支給申請の期限 {md(pay.deadline.date)}</Chip>}</span></div>
        <Steps stages={stages} />
      </Card>
      <span className="seg">{tabs.map(([k, t]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>{t}</button>)}</span>
      {tab === "doc" && <DocsTab grant={grant} isAdmin={isAdmin} docs={docs} nextActions={nextActions} say={say} />}
      {tab === "in" && <InputTab grant={grant} isAdmin={isAdmin} say={say} />}
      {tab === "att" && <AttendTab grant={grant} />}
      {tab === "out" && <OutTab grant={grant} isAdmin={isAdmin} onSave={onSave} say={say} />}
      {note !== null && <Modal title={`お客様に知らせる ・ ${companyName}`} width={480} onClose={() => setNote(null)} footer={<><Btn kind="ghost" onClick={() => setNote(null)}>やめる</Btn><Btn disabled={noteBusy || !note.trim()} onClick={sendNote}>確かめて送る</Btn></>}><label className="field">本文<textarea rows={4} maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label><Chip>企業担当者の通知に出る</Chip>{noteErr && <div className="lms-err" role="alert">{noteErr}</div>}</Modal>}
      {del && <Modal title="申請を消す" width={420} onClose={() => setDel(false)} footer={<><Btn kind="ghost" onClick={() => setDel(false)}>やめる</Btn><Btn onClick={() => { setDel(false); onDelete(); }}>消す</Btn></>}><b>{grant.grantType} ・ {companyName}</b></Modal>}
    </div>
  );
}

function CreateModal({ companies, onClose, onCreate }) {
  const [f, setF] = useState({ ...EMPTY_GRANT_FORM });
  const { courses } = useCompanyCourses(f.companyId, !!f.companyId);
  const { trainees } = useCompanyTrainees(f.companyId, !!f.companyId);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const s = (k, v) => setF(x => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.companyId || !f.courseId || !f.grantType.trim()) { setErr("企業・コース・助成金の種類を入れてください"); return; }
    setBusy(true); setErr("");
    try { await onCreate(f); onClose(); } catch (e) { setErr(errText(e, "作れませんでした")); setBusy(false); }
  };
  const ids = arr(f.targetTraineeIds);
  return (
    <Modal title="申請を作る" width={540} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy} onClick={save}>作る</Btn></>}>
      <label className="field">企業<select className="in" value={f.companyId} onChange={e => setF(x => ({ ...x, companyId: e.target.value, courseId: "", targetTraineeIds: [] }))}><option value="">選ぶ</option>{companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}</select></label>
      <label className="field">コース<select className="in" value={f.courseId} onChange={e => s("courseId", e.target.value)}><option value="">選ぶ</option>{courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}</select></label>
      <div className="st-fg"><label className="field">助成金の種類<input type="text" list="lms-grant-types" value={f.grantType} onChange={e => s("grantType", e.target.value)} /><datalist id="lms-grant-types">{GRANT_TYPE_SUGGESTIONS.map(t => <option key={t} value={t} />)}</datalist></label><label className="field">区分<select className="in" value={f.applicationType} onChange={e => s("applicationType", e.target.value)}>{APPLICATION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label></div>
      <div className="field">対象の受講者<span className="row">{trainees.map(t => <label key={t.userId} className="st-ck"><input type="checkbox" checked={ids.includes(t.userId)} onChange={e => s("targetTraineeIds", e.target.checked ? [...ids, t.userId] : ids.filter(x => x !== t.userId))} />{t.name}</label>)}{!trainees.length && <Chip>なし</Chip>}</span></div>
      <label className="field">備考<textarea rows={2} value={f.remarks || ""} onChange={e => s("remarks", e.target.value)} /></label>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

export default function StaffGrant({ role, say }) {
  const isAdmin = role === "admin";
  const { companies } = useGrantCompanies(isAdmin);
  const list = useGrantsList({}, true);
  const { coursesById } = useGrantCoursesMap(list.items, isAdmin, true);
  const [open, setOpen] = useState("");
  const [creating, setCreating] = useState(false);
  const [master, setMaster] = useState(false);
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("deadline");
  const coName = id => companies.find(c => c.companyId === id)?.name || "";
  const rows = useMemo(() => list.items.map(g => { const c = coursesById[g.courseId] || null; return { g, c, stages: computeGrantStages(g, c) }; }), [list.items, coursesById]);
  if (list.loading && !list.items.length) return <div className="soon card">読み込み中</div>;
  if (list.error) return <Card><div className="empty"><b>助成金を確認できません</b><Btn kind="ghost sm" onClick={list.reload}>再読み込み</Btn></div></Card>;
  const cur = rows.find(r => r.g.grantId === open) || (!isAdmin && rows.length === 1 ? rows[0] : null);
  if (cur) {
    return <Detail key={cur.g.grantId} grant={cur.g} course={cur.c} companyName={isAdmin ? coName(cur.g.companyId) : ""} role={role} say={say} onBack={isAdmin || rows.length > 1 ? () => setOpen("") : null} onSave={p => list.updateGrant(cur.g.grantId, p)} onDelete={async () => { try { await list.deleteGrant(cur.g.grantId); setOpen(""); say?.("消しました"); } catch { say?.("消せませんでした"); } }} />;
  }
  if (master) return <div className="st"><div><Btn kind="ghost sm" onClick={() => setMaster(false)}>← 助成金の一覧</Btn></div><div className="lms-legacy"><Suspense fallback={<div className="soon card">読み込み中</div>}><GrantRateMaster role={role} /></Suspense></div></div>;
  const dl = r => r.stages.find(s => s.current)?.deadline;
  const over = r => r.stages.some(s => s.deadline?.overdue && !["accepted", "submitted", "under_review", "not_applicable"].includes(s.state.value));
  const hit = r => !q.trim() || [coName(r.g.companyId), r.c?.name, r.g.grantType].some(v => String(v || "").includes(q.trim()));
  const shown = rows.filter(r => hit(r) && (tab === "all" || (tab === "over" ? over(r) : tab === "open" ? !["paid", "rejected", "cancelled"].includes(r.g.status) : r.g.status === tab)))
    .sort({ deadline: (a, b) => String(dl(a)?.date || "9").localeCompare(String(dl(b)?.date || "9")), amount: (a, b) => (b.g.calculatedAmountDraft || 0) - (a.g.calculatedAmountDraft || 0), name: (a, b) => coName(a.g.companyId).localeCompare(coName(b.g.companyId), "ja") }[sort]);
  const total = rows.reduce((a, r) => a + (Number(r.g.calculatedAmountDraft) || 0), 0);
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{isAdmin ? "すべての企業" : ""}</div><h1 className="h1">助成金</h1></div><span className="r">{total > 0 && <Chip tone="mk">見込み合計 {yen(total)}</Chip>}{isAdmin && <Btn kind="ghost sm" onClick={() => setMaster(true)}>助成金マスタ</Btn>}{isAdmin && <Btn kind="sm" onClick={() => setCreating(true)}>申請を作る</Btn>}</span></div>
      {list.actionError && <div className="lms-err" role="alert">{list.actionError}</div>}
      <ListTool tabs={[["all", "すべて", rows.length], ["open", "進行中", rows.filter(r => !["paid", "rejected", "cancelled"].includes(r.g.status)).length], ["over", "期限超過", rows.filter(over).length, "bad"], ["paid", "支給済み", rows.filter(r => r.g.status === "paid").length, "ok"]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="企業・コースで探す" sorts={[["deadline", "期限の近い順"], ["amount", "見込みの多い順"], ["name", "企業の名前順"]]} sort={sort} onSort={setSort} />
      <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>コース</th>{isAdmin && <th>企業</th>}<th>制度</th><th>今の段階</th><th>期限</th><th>状態</th><th>見込み（目安）</th><th /></tr></thead><tbody>
        {shown.map(r => { const s = r.stages.find(x => x.current), d = s?.deadline; return (
          <tr key={r.g.grantId} className={over(r) ? "on" : ""}>
            <td><b>{r.c?.name || r.g.courseId}</b></td>{isAdmin && <td>{coName(r.g.companyId)}</td>}
            <td>{r.g.grantType || "—"}<small className="adsm">{applicationTypeLabel(r.g.applicationType)}</small></td>
            <td><Chip>{s?.label} ・ {s?.state.label}</Chip></td>
            <td>{d ? <Chip tone={d.overdue ? "bad" : d.daysRemaining <= 30 ? "warn" : ""}>{md(d.date)}{d.overdue ? " 超過" : ` あと ${d.daysRemaining} 日`}</Chip> : <Chip>日程未設定</Chip>}</td>
            <td>{grantStatusLabel(r.g.status)}</td>
            <td className="num">{yen(r.g.calculatedAmountDraft)}</td>
            <td><Btn kind="ghost sm" onClick={() => setOpen(r.g.grantId)}>開く</Btn></td>
          </tr>
        ); })}
        {!shown.length && <tr><td colSpan={isAdmin ? 8 : 7}><Chip>なし</Chip></td></tr>}
      </tbody></table></div></Card>
      {creating && <CreateModal companies={companies} onClose={() => setCreating(false)} onCreate={p => list.createGrant(p).then(() => say?.("申請を作りました"))} />}
    </div>
  );
}
