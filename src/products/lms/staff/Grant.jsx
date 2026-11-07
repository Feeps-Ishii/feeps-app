import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../api.js";
import {
  APPLICATION_TYPE_OPTIONS, EMPLOYMENT_TYPE_OPTIONS, EMPTY_GRANT_FORM, ENTERPRISE_SIZE_OPTIONS, GRADUATE_STATUS_OPTIONS,
  GRANT_STATUS_OPTIONS, GRANT_TYPE_SUGGESTIONS, IT_EXPERIENCE_OPTIONS, applicationTypeLabel, documentStatusLabel, employmentTypeLabel,
} from "../../grants/GrantsCatalog.js";
import { useCompanyCourses, useCompanyProfile, useCompanyTrainees, useGrantCalculationDraft, useGrantCompanies, useGrantCoursesMap, useGrantDocuments, useGrantExports, useGrantsList } from "../../grants/useGrants.js";
import { computeGrantStages } from "../../grants/grantStages.js";
import { normalizeCurriculumSections } from "../../training/TrainingComponents.jsx";
import { Btn, Card, Chip, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, errText, md, saveBlob, zipStore } from "./common.js";
import GrantMaster from "./GrantMaster.jsx";

/* 助成金（管理者・企業担当者。モック grantList・grantD）：管理者は一覧 → 申請ごと、企業担当者は自社の申請。
   書類・入力・受講状況・集計と出力。期限と段階は grantStages.js、計算は /grants/{id}/calculation-draft、帳票は /exports（今の決まりのまま）。
   8 割の判定は受講時間（帳票と同じ計算）。確定の項目は管理者だけ */

const yen = v => (v == null ? "—" : `¥${Number(v).toLocaleString("ja-JP")}`);
const THRESHOLD = 80;
const verdict = r => (r == null ? ["確認できません", ""] : r < THRESHOLD ? ["要件外の可能性", "bad"] : r < 88 ? ["注意", "warn"] : ["OK", "ok"]);
const docTone = s => ({ accepted: "ok", rejected: "bad", submitted: "blue" }[s] || "");

const PASSED = ["accepted", "submitted", "under_review"];
function Steps({ grant, course, stages }) {
  const plan = stages.find(s => s.key === "plan"), pay = stages.find(s => s.key === "shikyu"), today = new Date().toISOString().slice(0, 10);
  const planOk = PASSED.includes(plan?.state.value), payOk = PASSED.includes(pay?.state.value), running = course?.startDate && course.startDate <= today && (!course.endDate || course.endDate >= today), paid = grant.status === "paid" || !!grant.paidAt;
  const l = [
    ["計画届", planOk ? "done" : "on", planOk ? `${md(grant.appliedAt)} 提出` : plan?.deadline ? `〆 ${md(plan.deadline.date)}` : ""],
    ["研修中", course?.endDate && course.endDate < today ? "done" : running ? "on" : "", course?.startDate ? `${md(course.startDate)}〜${md(course.endDate)}` : ""],
    ["支給申請", payOk ? "done" : "", grant.documentsSubmittedAt ? `${md(grant.documentsSubmittedAt)} 提出` : pay?.deadline ? `〆 ${md(pay.deadline.date)}` : ""],
    ["入金", paid ? "done" : "", grant.paidAt ? md(grant.paidAt) : ""],
  ];
  return <div className="gsteps">{l.map(([t, k, sub]) => <span key={t} className={k}><b>{k === "done" ? "✓ " : ""}{t}</b><small>{sub}</small></span>)}</div>;
}

// そろえる書類（モック GD）。状態は申請・書類・企業の情報・受講者・勤怠から出す
const GD = [
  { t: "訓練計画の元データ（計画届に写す）", who: "Feeps", kind: "out", form: "plan", due: "plan" },
  { t: "計画届の提出", who: "お客様", kind: "sub", stage: "plan", due: "plan" },
  { t: "企業の情報", who: "お客様", kind: "co", due: "研修の終わりまで" },
  { t: "受講者の情報（被保険者番号・雇用形態）", who: "お客様", kind: "pp", due: "研修の終わりまで" },
  { t: "雇用契約書の写し", who: "お客様", kind: "up", type: "雇用契約書", re: /雇用契約/, due: "支給申請まで" },
  { t: "出勤簿・タイムカード", who: "お客様", kind: "up", type: "出勤簿", re: /出勤簿|タイムカード/, due: "支給申請まで" },
  { t: "賃金台帳", who: "お客様", kind: "up", type: "賃金台帳", re: /賃金台帳/, due: "支給申請まで" },
  { t: "実施状況の集計（Off-JT 実施状況報告書の元）", who: "Feeps", kind: "out", form: "offjt", due: "研修の終わり" },
  { t: "請求書・領収書（経費助成）", who: "Feeps", kind: "upf", type: "請求書・領収書", re: /請求書|領収書/, due: "研修の終わり" },
  { t: "支給申請", who: "お客様", kind: "sub", stage: "shikyu", due: "shikyu" },
];
const gTone = { ok: "ok", warn: "warn", bad: "bad", no: "", auto: "mk", off: "", unk: "" };
const NEEDED = ["name", "capitalAmount", "employeeCount", "enterpriseSize"];
const upState = d => (d.status === "rejected" ? ["bad", "差し戻し"] : d.status === "accepted" ? ["ok", "受理"] : ["ok", "アップロード済み"]);
// 受講率は受講時間から（時刻が未設定のコースは出せない）
const rateOf = (t, p) => (p?.scheduledMinutes > 0 ? Math.round((Number(t.trainedMinutes) || 0) / p.scheduledMinutes * 100) : null);
// facts: { docs, profile, trainees, stats }。undefined は読み込み中、null は読めなかった
function grantRows(grant, stages, facts) {
  const { docs, profile, trainees, stats } = facts;
  const dl = k => stages.find(s => s.key === k)?.deadline;
  const targets = arr(grant.targetTraineeIds);
  const ppl = arr(trainees).filter(t => !targets.length || targets.includes(t.userId));
  return GD.map(d => {
    const doc = d.form ? arr(docs).find(x => x.source === "generated" && x.formType === d.form) : d.re ? arr(docs).find(x => x.source !== "generated" && d.re.test(x.documentType || "")) : null;
    const due = d.due === "plan" || d.due === "shikyu" ? (dl(d.due === "plan" ? "plan" : "shikyu")?.date ? md(dl(d.due === "plan" ? "plan" : "shikyu").date) : "未定") : d.due;
    const wait = docs === undefined ? ["unk", "読み込み中"] : docs === null ? ["unk", "確認できません"] : null;
    let st;
    if (d.kind === "sub") {
      const s = stages.find(x => x.key === d.stage), left = s?.deadline;
      st = PASSED.includes(s?.state.value) ? ["ok", d.stage === "plan" && grant.appliedAt ? `${md(grant.appliedAt)} 提出` : grant.documentsSubmittedAt ? `${md(grant.documentsSubmittedAt)} 提出` : "提出済み"]
        : left?.overdue ? ["bad", "期限を過ぎました"] : left ? [left.daysRemaining <= 30 ? "bad" : d.stage === "plan" ? "warn" : "off", `まだ ・ あと ${left.daysRemaining} 日`] : ["off", "これから"];
    } else if (d.kind === "co") {
      st = profile === undefined ? ["unk", "読み込み中"] : profile === null ? ["unk", "確認できません"] : NEEDED.every(k => profile[k] !== undefined && profile[k] !== null && profile[k] !== "") ? ["ok", "入力済み"] : ["warn", "まだ"];
    } else if (d.kind === "pp") {
      const n = ppl.filter(t => t.employmentInsuranceNumber && t.employmentType).length;
      st = trainees === undefined ? ["unk", "読み込み中"] : trainees === null ? ["unk", "確認できません"] : ppl.length && n === ppl.length ? ["ok", "全員分"] : ["warn", `${n} / ${ppl.length} 人`];
    } else if (d.kind === "out") {
      const p = stats?.period, on = (p?.trainingDays || 0) > 0;
      st = wait || (doc ? ["ok", `${md(doc.uploadedAt)} に作りました`] : d.form === "offjt" && on ? ["auto", `自動で集計中（${p.trainingDays}${p.totalDays ? ` / ${p.totalDays}` : ""} 日）`] : d.form === "offjt" ? ["off", "これから"] : ["no", "まだ作っていません"]);
    } else if (d.type === "雇用契約書") {
      const n = ppl.filter(t => arr(docs).some(x => x.source !== "generated" && (x.documentType === `雇用契約書（${t.name}）`))).length;
      st = wait || (trainees === undefined ? ["unk", "読み込み中"] : trainees === null ? ["unk", "確認できません"] : ppl.length && n === ppl.length ? ["ok", "全員分"] : n ? ["warn", `${n} / ${ppl.length} 人`] : doc ? ["ok", "アップロード済み"] : ["no", "まだ"]);
    } else if (d.kind === "upf") {
      st = wait || (doc ? upState(doc) : ["off", "研修後に発行"]);
    } else {
      st = wait || (doc ? upState(doc) : ["no", "まだ"]);
    }
    return { ...d, doc, due, tone: st[0], text: st[1] };
  });
}
const contractType = name => `雇用契約書（${name}）`;
const matchedDoc = d => (d.source === "generated" ? ["plan", "offjt"].includes(d.formType) : GD.some(x => x.re && x.re.test(d.documentType || "")));

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

function DocsTab({ grant, stages, facts, isAdmin, docs, setTab, onNotify, say }) {
  const { generate, generating, error: genErr, clearError, lastResult } = useGrantExports(grant.grantId);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [del, setDel] = useState(null); const [upType, setUpType] = useState("");
  const [rev, setRev] = useState(null); const [revNote, setRevNote] = useState("");
  const fileRef = useRef(null);
  const rows = grantRows(grant, stages, facts);
  const onFile = async e => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true); setErr("");
    try { await docs.uploadDocument({ file, documentType: upType, dueDate: "", note: "" }); say?.(`${upType} をアップロードしました`); }
    catch (x) { setErr(errText(x, "アップロードできませんでした")); } finally { setBusy(false); }
  };
  const view = async d => { try { const url = await docs.viewDocument(d.documentId); if (url) window.open(url, "_blank", "noopener,noreferrer"); } catch { setErr("書類を開けませんでした"); } };
  const make = async form => { clearError(); try { await generate(form); await docs.reload(); say?.("作りました"); } catch { /* genErr に出る */ } };
  const remove = async () => { setBusy(true); try { await docs.removeDocument(del.documentId); setDel(null); say?.("削除しました"); } catch (x) { setErr(errText(x, "削除できませんでした")); setDel(null); } finally { setBusy(false); } };
  const pick = t => { setUpType(t); fileRef.current?.click(); };
  const review = async status => { setBusy(true); try { await docs.reviewDocument(rev.documentId, status, revNote); say?.(status === "accepted" ? "受理しました" : "差し戻しました"); setRev(null); setRevNote(""); } catch (x) { setErr(errText(x, "保存できませんでした")); setRev(null); } finally { setBusy(false); } };
  const reviewBtn = d => isAdmin && d?.source !== "generated" && d?.status === "submitted" && <Btn kind="sm" onClick={() => { setRevNote(""); setRev(d); }}>確かめる</Btn>;
  const act = r => {
    const open = r.doc && <Btn kind="ghost sm" onClick={() => view(r.doc)}>{r.kind === "up" ? "見る" : "受け取る"}</Btn>;
    if (!isAdmin) {
      if (r.who === "Feeps") return open || null;
      if (r.tone === "ok") return r.kind === "up" ? open : null;
      if (r.tone === "off" || r.tone === "unk") return null;
      if (r.kind === "co" || r.kind === "pp" || r.type === "雇用契約書") return <Btn kind="sm" onClick={() => setTab("in")}>入れる</Btn>;
      if (r.kind === "up") return <Btn kind="sm" disabled={busy} onClick={() => pick(r.type)}>アップロード</Btn>;
      return null;
    }
    if (r.kind === "out") return r.doc ? open : <Btn kind={r.tone === "no" ? "sm" : "ghost sm"} disabled={generating || r.tone === "off" || r.tone === "unk"} onClick={() => make(r.form)}>{generating ? "作っています" : r.tone === "auto" ? "受け取る" : "作る"}</Btn>;
    if (r.kind === "upf") return r.doc ? <span className="row st-nw">{open}<Btn kind="ghost sm" onClick={() => setDel(r.doc)}>削除</Btn></span> : <Btn kind="ghost sm" disabled={busy} onClick={() => pick(r.type)}>アップロード</Btn>;
    if (r.tone === "ok") return r.kind === "up" ? <span className="row st-nw">{open}{reviewBtn(r.doc)}<Btn kind="ghost sm" onClick={() => setDel(r.doc)}>削除</Btn></span> : null;
    if (r.doc && r.doc.status === "rejected") return <span className="row st-nw">{open}<Btn kind="ghost sm" onClick={() => onNotify(`${r.t} を出し直してください`)}>お客様に知らせる</Btn></span>;
    if (["warn", "no", "bad"].includes(r.tone)) return <Btn kind="ghost sm" onClick={() => onNotify(`${r.t} をお願いします`)}>お客様に知らせる</Btn>;
    return null;
  };
  const others = arr(docs.items).filter(d => !matchedDoc(d));
  return (
    <>
      {docs.error && <Card><div className="empty"><b>書類を確認できません</b><Btn kind="ghost sm" onClick={docs.reload}>再読み込み</Btn></div></Card>}
      {err && <div className="lms-err" role="alert">{err}</div>}
      {genErr && <div className="lms-err" role="alert">{genErr}</div>}
      {lastResult && !lastResult.files?.length && <div className="row"><Chip tone="warn">未入力 {arr(lastResult.missingFields).length} 項目</Chip>{arr(lastResult.missingFields).slice(0, 8).map(f => <Chip key={f.label}>{f.label}</Chip>)}</div>}
      <input ref={fileRef} type="file" className="lms-sr" aria-label="アップロードするファイル" onChange={onFile} />
      <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>書類</th><th>担当</th><th>期限</th><th>状態</th><th /></tr></thead><tbody>
        {rows.map(r => {
          const mine = isAdmin ? r.who === "Feeps" : r.who === "お客様";
          return <tr key={r.t} className={mine && !["ok", "off", "unk"].includes(r.tone) ? "gmine" : ""}><td><b>{r.t}</b>{r.doc?.status === "rejected" && (r.doc.reviewNote || r.doc.note) && <small className="adsm">{r.doc.reviewNote || r.doc.note}</small>}</td><td><Chip tone={r.who === "Feeps" ? "mk" : "co"}>{r.who}</Chip></td><td className="num">{r.due}</td><td><Chip tone={gTone[r.tone]}>{r.text}</Chip></td><td>{act(r)}</td></tr>;
        })}
        {others.map(d => <tr key={d.documentId}><td><b>{d.documentType || "種別未設定"}</b><small className="adsm">{d.fileName}</small></td><td><Chip tone={d.source === "generated" ? "mk" : "co"}>{d.source === "generated" ? "Feeps" : "お客様"}</Chip></td><td className="num">{d.dueDate ? md(d.dueDate) : "—"}</td><td><Chip>{documentStatusLabel(d.status)}</Chip></td><td><span className="row st-nw"><Btn kind="ghost sm" onClick={() => view(d)}>見る</Btn>{reviewBtn(d)}{isAdmin && <Btn kind="ghost sm" onClick={() => setDel(d)}>削除</Btn>}</span></td></tr>)}
      </tbody></table></div></Card>
      {rev && <Modal title={`書類を確かめる ・ ${rev.documentType || rev.fileName}`} width={480} onClose={() => setRev(null)} footer={<><Btn kind="ghost" onClick={() => setRev(null)}>やめる</Btn><Btn kind="danger" disabled={busy} onClick={() => review("rejected")}>差し戻す</Btn><Btn disabled={busy} onClick={() => review("accepted")}>受理する</Btn></>}><div className="row"><Btn kind="ghost sm" onClick={() => view(rev)}>書類を開く ↗</Btn></div><label className="field">差し戻しの理由（お客様に見える）<textarea rows={3} maxLength={500} value={revNote} onChange={e => setRevNote(e.target.value)} /></label></Modal>}
      {del && <Modal title="書類を削除" width={420} onClose={() => setDel(null)} footer={<><Btn kind="ghost" onClick={() => setDel(null)}>やめる</Btn><Btn disabled={busy} onClick={remove}>削除</Btn></>}><b>{del.fileName || del.documentType}</b></Modal>}
    </>
  );
}

function TraineeModal({ t, isAdmin, onClose, onSave }) {
  const [f, setF] = useState({ employmentType: t.employmentType || "", graduateStatus: t.graduateStatus || "", itExperienceLevel: t.itExperienceLevel || "", gender: t.gender || "", hireDate: t.hireDate || "", employmentInsuranceNumber: t.employmentInsuranceNumber || "", trainingWagePaid: t.trainingWagePaid !== false, grantEligible: !!t.grantEligible, grantEligibilityNote: t.grantEligibilityNote || "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const s = (k, v) => setF(x => ({ ...x, [k]: v }));
  const sel = (k, label, opts) => <label className="field">{label}<select className="in" value={f[k]} onChange={e => s(k, e.target.value)}><option value="">未設定</option>{opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  const save = async () => { setBusy(true); setErr(""); try { const { grantEligible, grantEligibilityNote, ...rest } = f; await onSave(t.userId, isAdmin ? f : rest); onClose(); } catch (e) { setErr(errText(e, "保存できませんでした")); setBusy(false); } };
  return (
    <Modal title={`${t.name} の情報`} width={520} onClose={onClose} footer={<><Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy} onClick={save}>保存</Btn></>}>
      <label className="field">雇用保険の被保険者番号<input type="text" value={f.employmentInsuranceNumber} placeholder="1234-567890-1" onChange={e => s("employmentInsuranceNumber", e.target.value)} /></label>
      <label className="field">研修中の賃金<select className="in" value={f.trainingWagePaid ? "yes" : "no"} onChange={e => s("trainingWagePaid", e.target.value === "yes")}><option value="yes">払う</option><option value="no">払わない</option></select></label>
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

function InputTab({ grant, isAdmin, onNotify, say }) {
  const companyId = isAdmin ? grant.companyId : "";
  const pf = useCompanyProfile(companyId, true);
  const tr = useCompanyTrainees(companyId, true);
  const docs = useGrantDocuments(grant.grantId, true);
  const ctRef = useRef(null); const [ctFor, setCtFor] = useState(null); const [ctBusy, setCtBusy] = useState(false);
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
  const contractOf = t => docs.items.find(d => d.source !== "generated" && d.documentType === contractType(t.name));
  const check = t => (!t.employmentInsuranceNumber ? <Chip tone="bad">被保険者番号がありません</Chip> : t.trainingWagePaid === false ? <Chip tone="bad">賃金を払わないと対象外</Chip> : !t.employmentType ? <Chip tone="warn">雇用形態がまだ</Chip> : !contractOf(t) ? <Chip tone="warn">雇用契約書がまだ</Chip> : <span className="xlok">✓</span>);
  const onContract = async e => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !ctFor) return;
    setCtBusy(true); setErr("");
    try { await docs.uploadDocument({ file, documentType: contractType(ctFor.name), dueDate: "", note: "" }); say?.(`${ctFor.name} の雇用契約書をアップロードしました`); }
    catch (x) { setErr(errText(x, "アップロードできませんでした")); } finally { setCtBusy(false); setCtFor(null); }
  };
  return (
    <>
      <Card className="pad st-g">
        <div className="head"><h2 className="h2">企業の情報</h2><span className="r">{form.enterpriseSize ? <Chip tone="ok">{ENTERPRISE_SIZE_OPTIONS.find(o => o.value === form.enterpriseSize)?.label}</Chip> : <Chip tone="warn">企業規模が未設定</Chip>}</span></div>
        <div className="g3">
          {field("name", "会社名")}{field("address", "住所")}{field("tel", "TEL")}
          {field("industry", "業種")}{field("insuranceOfficeNumber", "雇用保険の事業所番号")}{field("applicantBy", "申請するのは")}{field("laborConsultantOffice", "社労士の事務所名")}
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
        <div className="head"><h2 className="h2">受講者 ・ {people.length} 人</h2><span className="r">{missNo ? <Chip tone="bad">被保険者番号がない {missNo} 人</Chip> : <Chip tone="ok">全員分</Chip>}{isAdmin ? <Btn kind="ghost sm" onClick={() => onNotify("受講者の情報を入れてください")}>お客様に知らせる</Btn> : <><a className="btn ghost sm cw-a" href="/templates/grant-template.xlsx" download="助成金ひな形.xlsx">助成金ひな形</a><Btn kind="sm" onClick={() => xlRef.current?.click()}>Excel で入れる</Btn></>}</span></div>
        <input ref={xlRef} type="file" accept=".xlsx,.xls" className="lms-sr" aria-label="助成金ひな形を選ぶ" onChange={onXl} />
        <input ref={ctRef} type="file" className="lms-sr" aria-label="雇用契約書を選ぶ" onChange={onContract} />
        {tr.error ? <div className="empty"><b>受講者を確認できません</b><Btn kind="ghost sm" onClick={tr.reload}>再読み込み</Btn></div> : (
          <div className="scroll"><table className="tbl"><thead><tr><th>受講者</th><th>雇用保険の被保険者番号</th><th>雇用形態</th><th>研修中の賃金</th><th>雇用契約書</th><th>対象</th><th>チェック</th><th /></tr></thead><tbody>
            {people.map(t => <tr key={t.userId} className={!t.employmentInsuranceNumber ? "xlw" : ""}><td><b>{t.name}</b></td><td className="num">{t.employmentInsuranceNumber || "—"}</td><td>{employmentTypeLabel(t.employmentType) || "—"}</td><td>{t.trainingWagePaid === false ? "払わない" : "払う"}</td><td>{contractOf(t) ? <Chip tone="ok">あり</Chip> : isAdmin ? <Chip tone="warn">まだ</Chip> : <Btn kind="ghost sm" disabled={ctBusy} onClick={() => { setCtFor(t); ctRef.current?.click(); }}>アップロード</Btn>}</td><td>{t.grantEligible ? <Chip tone="ok">対象</Chip> : <Chip>未確定</Chip>}</td><td>{check(t)}</td><td><Btn kind="ghost sm" onClick={() => setEdit(t)}>直す</Btn></td></tr>)}
            {!people.length && <tr><td colSpan={8}><Chip>なし</Chip></td></tr>}
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
  const H = p.scheduledMinutes > 0 ? p.scheduledMinutes / 60 : null, T = p.totalMinutes > 0 ? p.totalMinutes / 60 : null, dayH = T && p.totalDays ? T / p.totalDays : 8;
  const hr = v => Math.round(v * 10) / 10;
  const rows = arr(st.data.trainees).filter(t => !targets.length || targets.includes(t.id)).map(t => {
    const got = (Number(t.trainedMinutes) || 0) / 60;
    return { ...t, got, rate: H ? Math.round(got / H * 100) : null, left: H && T ? T * (1 - THRESHOLD / 100) - (H - got) : null };
  });
  const kind = r => verdict(r.rate)[1] || "x";
  const list = rows.filter(r => matchName(r.name, "", q) && (tab === "all" || kind(r) === tab)).sort(sort === "low" ? (a, b) => (a.rate ?? 101) - (b.rate ?? 101) : (a, b) => a.name.localeCompare(b.name, "ja"));
  return (
    <>
      <div className="row"><Chip>研修 {p.trainingDays ?? 0}{p.totalDays ? ` / ${p.totalDays}` : ""} 日{H != null ? ` ・ ${hr(H)}${T ? ` / ${hr(T)}` : ""} 時間` : ""}</Chip><Chip tone="mk">勤怠から自動で集計</Chip>{H == null && <Chip tone="warn">研修の時刻が未設定</Chip>}</div>
      <ListTool tabs={[["all", "すべて", rows.length], ["bad", "要件外の可能性", rows.filter(r => kind(r) === "bad").length, "bad"], ["warn", "注意", rows.filter(r => kind(r) === "warn").length, "warn"], ["ok", "OK", rows.filter(r => kind(r) === "ok").length, "ok"]]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="名前で探す" sorts={[["low", "受講率の低い順"], ["name", "名前順"]]} sort={sort} onSort={setSort} />
      <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>受講者</th><th>受講時間</th><th>受講率（いま）</th><th>8 割まで休める時間</th><th>見通し</th></tr></thead><tbody>
        {list.map(r => { const [t, c] = verdict(r.rate); return <tr key={r.id}><td><b>{r.name}</b></td><td className="num">{H == null ? "—" : `${hr(r.got)} / ${hr(H)} 時間`}</td><td className="num">{r.rate == null ? "—" : `${r.rate}%`}</td><td className="num">{r.left == null ? "—" : r.left < 0 ? "超過" : `${hr(r.left)} 時間（${Math.floor(r.left / dayH)} 日）`}</td><td><Chip tone={c}>{t}</Chip></td></tr>; })}
        {!list.length && <tr><td colSpan={5}><Chip>該当なし</Chip></td></tr>}
      </tbody></table></div></Card>
    </>
  );
}

// 経費の実費と申請の記録（見込みの計算と段階の表示に要る。管理者だけ）
function RecordModal({ grant, onSave, onDelete, onClose, say }) {
  const [cost, setCost] = useState({ perPersonEnrollmentFee: grant.expenseActualCosts?.perPersonEnrollmentFee ?? "", perPersonCertificationFee: grant.expenseActualCosts?.perPersonCertificationFee ?? "", inCompanyCostTotal: grant.expenseActualCosts?.inCompanyCostTotal ?? "", previousReceivedDeduction: grant.expenseActualCosts?.previousReceivedDeduction ?? "", note: grant.expenseActualCosts?.note || "" });
  const [adm, setAdm] = useState({ status: grant.status, appliedAt: grant.appliedAt || "", changeDate: grant.changeDate || "", documentsSubmittedAt: grant.documentsSubmittedAt || "", paidAt: grant.paidAt || "", amount: grant.amount ?? "", remarks: grant.remarks || "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [del, setDel] = useState(false);
  const c = (k, v) => setCost(x => ({ ...x, [k]: v })); const a = (k, v) => setAdm(x => ({ ...x, [k]: v }));
  const num = k => (cost[k] === "" || cost[k] == null ? null : Number(cost[k]));
  const save = async () => {
    setBusy(true); setErr("");
    try {
      await onSave({ remarks: adm.remarks, expenseActualCosts: { perPersonEnrollmentFee: num("perPersonEnrollmentFee"), perPersonCertificationFee: num("perPersonCertificationFee"), inCompanyCostTotal: num("inCompanyCostTotal"), previousReceivedDeduction: num("previousReceivedDeduction"), note: cost.note }, status: adm.status, appliedAt: adm.appliedAt || null, changeDate: adm.changeDate || null, documentsSubmittedAt: adm.documentsSubmittedAt || null, paidAt: adm.paidAt || null, amount: adm.amount === "" ? null : Number(adm.amount) });
      say?.("保存しました"); onClose();
    } catch (e) { setErr(errText(e, "保存できませんでした")); setBusy(false); }
  };
  return (
    <Modal title="申請の記録" width={620} onClose={onClose} footer={<>{!del ? <Btn kind="ghost" onClick={() => setDel(true)}>申請を消す</Btn> : <Btn onClick={onDelete}>本当に消す</Btn>}<Btn kind="ghost" onClick={onClose}>やめる</Btn><Btn disabled={busy} onClick={save}>{busy ? "保存しています" : "保存"}</Btn></>}>
      <div className="st-fg"><label className="field">状態<select className="in" value={adm.status} onChange={e => a("status", e.target.value)}>{GRANT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label><label className="field">確定の金額（円）<input type="number" min="0" value={adm.amount} onChange={e => a("amount", e.target.value)} /></label><label className="field">計画届の提出日<input type="date" value={adm.appliedAt} onChange={e => a("appliedAt", e.target.value)} /></label><label className="field">変更予定日<input type="date" value={adm.changeDate} onChange={e => a("changeDate", e.target.value)} /></label><label className="field">支給申請の提出日<input type="date" value={adm.documentsSubmittedAt} onChange={e => a("documentsSubmittedAt", e.target.value)} /></label><label className="field">入金日<input type="date" value={adm.paidAt} onChange={e => a("paidAt", e.target.value)} /></label></div>
      <div className="st-fg"><label className="field">1 人あたり入学料等（円）<input type="number" min="0" value={cost.perPersonEnrollmentFee} onChange={e => c("perPersonEnrollmentFee", e.target.value)} /></label><label className="field">1 人あたり検定費用（円）<input type="number" min="0" value={cost.perPersonCertificationFee} onChange={e => c("perPersonCertificationFee", e.target.value)} /></label><label className="field">事業内訓練の経費（円）<input type="number" min="0" value={cost.inCompanyCostTotal} onChange={e => c("inCompanyCostTotal", e.target.value)} /></label><label className="field">既受給の控除（円）<input type="number" min="0" value={cost.previousReceivedDeduction} onChange={e => c("previousReceivedDeduction", e.target.value)} /></label></div>
      <label className="field">根拠のメモ<input type="text" value={cost.note} onChange={e => c("note", e.target.value)} /></label>
      <label className="field">備考<textarea rows={2} value={adm.remarks} onChange={e => a("remarks", e.target.value)} /></label>
      {err && <div className="lms-err" role="alert">{err}</div>}
    </Modal>
  );
}

function OutTab({ grant, course, facts, isAdmin, docs, onSave, onDelete, say }) {
  const { calculate, calculating, error, result } = useGrantCalculationDraft(grant.grantId);
  const exp = useGrantExports(grant.grantId);
  const [mapOpen, setMapOpen] = useState(false); const [rec, setRec] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [lessons, setLessons] = useState({});
  useEffect(() => { calculate().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!grant.courseId) return undefined;
    let alive = true;
    apiGet(`/courses/${encodeURIComponent(grant.courseId)}/curriculum`).then(d => {
      if (!alive) return;
      const m = {};
      normalizeCurriculumSections(d).forEach(s => arr(s.chapters).forEach(c => arr(c.lessons).forEach(l => { const k = String(l.startDate || "").slice(0, 10); if (k && !m[k]) m[k] = l.title; })));
      setLessons(m);
    }).catch(() => {});
    return () => { alive = false; };
  }, [grant.courseId]);
  const getForm = async form => {
    setErr("");
    const have = arr(docs.items).find(x => x.source === "generated" && x.formType === form);
    try {
      if (have) { const url = await docs.viewDocument(have.documentId); if (url) window.open(url, "_blank", "noopener,noreferrer"); return; }
      const r = await exp.generate(form);
      await docs.reload();
      if (r?.files?.length) say?.("作りました ・ 書類から受け取れます");
    } catch { /* exp.error に出る */ }
  };
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
  const w = result?.wageSubsidy, x = result?.expenseSubsidy, p = facts.stats?.period;
  const hours = course?.standardClockIn && course?.standardClockOut ? `${course.standardClockIn}〜${course.standardClockOut}` : "—";
  const daily = arr(facts.stats?.daily).slice(-5);
  return (
    <>
      {err && <div className="lms-err" role="alert">{err}</div>}
      {exp.error && <div className="lms-err" role="alert">{exp.error}</div>}
      {exp.lastResult && !exp.lastResult.files?.length && <div className="row"><Chip tone="warn">未入力 {arr(exp.lastResult.missingFields).length} 項目</Chip>{arr(exp.lastResult.missingFields).slice(0, 8).map(f => <Chip key={f.label}>{f.label}</Chip>)}</div>}
      <div className="g2e">
        <Card className="pad st-g">
          <div className="head"><h2 className="h3">訓練計画の元データ</h2><span className="r"><Btn kind="ghost sm" disabled={exp.generating} onClick={() => getForm("plan")}>Excel で受け取る</Btn></span></div>
          <div className="rowsx"><div><span>期間</span><b>{course?.startDate ? `${md(course.startDate)}〜${md(course.endDate)}` : "未定"}</b></div><div><span>訓練時間</span><b>{p?.totalDays ? `${p.totalDays} 日` : "—"}</b></div><div><span>コース</span><b>{course?.name || grant.courseId || "—"}</b></div></div>
        </Card>
        <Card className="pad st-g">
          <div className="head"><h2 className="h3">見込み（目安）</h2>{isAdmin && <span className="r"><Btn kind="ghost sm" onClick={() => setRec(true)}>申請の記録</Btn></span>}</div>
          {error && <div className="lms-err" role="alert">{error}</div>}
          {calculating && !result && <div className="dv-mt">読み込み中</div>}
          {result && (
            <div className="gest">
              {result.canCalculateExpense && x ? <div><span>経費助成</span><b className="num">{yen(x.amount)}</b><small>正規等 {x.regularCount} 人 {x.rateRegular}% ・ 有期等 {x.fixedTermCount} 人 {x.rateFixedTerm}%</small></div> : <div><span>経費助成</span><b className="num">—</b></div>}
              {result.canCalculateWage && w ? <div><span>賃金助成</span><b className="num">{yen(w.amount)}</b><small>約 {w.totalActualTrainingHoursDecimal} 時間 × {Number(w.hourlyRate).toLocaleString("ja-JP")} 円</small></div> : <div><span>賃金助成</span><b className="num">—</b></div>}
              {result.totalDraftAmount != null && <div className="t"><span>合計</span><b className="num">{yen(result.totalDraftAmount)}</b></div>}
            </div>
          )}
          {arr(result?.missingItems).length > 0 && <div className="row">{result.missingItems.map(i => <Chip key={i.code} tone="warn">{i.label}</Chip>)}</div>}
        </Card>
      </div>
      <Card className="pad st-g">
        <div className="head"><h2 className="h3">実施状況の集計（日ごと・人ごと）</h2><span className="r">{p?.trainingDays > 0 && <Chip tone="mk">{p.trainingDays}{p.totalDays ? ` / ${p.totalDays}` : ""} 日</Chip>}<Btn kind="ghost sm" disabled={exp.generating} onClick={() => getForm("offjt")}>Excel で受け取る</Btn></span></div>
        {facts.stats === null ? <Chip>確認できません</Chip> : daily.length ? <div className="scroll"><table className="tbl"><thead><tr><th>日付</th><th>訓練の内容</th><th>時間</th><th>出席</th></tr></thead><tbody>{daily.map(d => <tr key={d.date}><td className="num">{md(d.date)}</td><td>{lessons[d.date] || "—"}</td><td className="num">{hours}</td><td className="num">{d.present} / {d.total}</td></tr>)}</tbody></table></div> : <Chip>これから</Chip>}
      </Card>
      {isAdmin && (
        <Card className="pad st-g">
          <div className="head"><h2 className="h3">申請の様式</h2></div>
          <div className="list">{[["henkou", "変更申請（様式第 2-1 号）"], ["shikyu", "支給申請書類一式（様式 4-1 号・6-1 号・12 号・13 号）"]].map(([k, t]) => { const has = arr(docs.items).some(x => x.source === "generated" && x.formType === k); return <div key={k} className="li"><span>{t}</span><span className="row st-nw">{has && <Chip tone="ok">作りました</Chip>}<Btn kind="ghost sm" disabled={exp.generating} onClick={() => getForm(k)}>Excel で受け取る</Btn></span></div>; })}</div>
        </Card>
      )}
      <Card className="pad st-g">
        <div className="head"><h2 className="h3">書類をまとめて受け取る</h2><span className="r"><Btn kind="sm" disabled={busy || !arr(docs.items).length} onClick={zipAll}>まとめて受け取る（zip）</Btn></span></div>
        {isAdmin && <div className="row"><Chip tone="mk">様式の対応表</Chip><Btn kind="ghost sm" onClick={() => setMapOpen(true)}>対応表を見る</Btn></div>}
      </Card>
      {mapOpen && <MapModal onClose={() => setMapOpen(false)} />}
      {rec && <RecordModal grant={grant} onSave={onSave} onDelete={onDelete} onClose={() => setRec(false)} say={say} />}
    </>
  );
}

// 書類の状態の元（一覧でも使う）
function loadFacts(grant, isAdmin) {
  const cq = isAdmin && grant.companyId ? `?companyId=${encodeURIComponent(grant.companyId)}` : "";
  return Promise.all([
    apiGet(`/grants/${encodeURIComponent(grant.grantId)}/documents`).then(r => arr(r?.items || r)).catch(() => null),
    apiGet(`/grants/company-profile${cq}`).catch(() => null),
    apiGet(`/grants/company-trainees${cq}`).then(r => arr(r?.items || r?.trainees || r)).catch(() => null),
    grant.courseId ? apiGet(`/completion-report/stats?courseId=${encodeURIComponent(grant.courseId)}`).catch(() => null) : Promise.resolve(null),
  ]).then(([docs, profile, trainees, stats]) => ({ docs, profile, trainees, stats }));
}

function Detail({ grant, course, companyName, role, onBack, onSave, onDelete, say }) {
  const isAdmin = role === "admin";
  const docs = useGrantDocuments(grant.grantId, true);
  const [tab, setTab] = useState("doc");
  const [facts0, setFacts0] = useState({ profile: undefined, trainees: undefined, stats: undefined });
  useEffect(() => { let alive = true; loadFacts(grant, isAdmin).then(f => { if (alive) setFacts0(f); }); return () => { alive = false; }; }, [grant, isAdmin, tab]);
  const facts = { ...facts0, docs: docs.error ? null : docs.loading ? undefined : docs.items };
  const [note, setNote] = useState(null); const [noteErr, setNoteErr] = useState(""); const [noteBusy, setNoteBusy] = useState(false);
  const sendNote = async () => {
    setNoteBusy(true); setNoteErr("");
    try { const r = await apiPost(`/grants/${encodeURIComponent(grant.grantId)}/notify`, { message: note }); setNote(null); say?.(`企業担当者 ${r.count} 人に知らせました`); }
    catch (e) { setNoteErr(errText(e, "送れませんでした")); } finally { setNoteBusy(false); }
  };
  const stages = useMemo(() => computeGrantStages(grant, course), [grant, course]);
  const tabs = isAdmin ? [["doc", "書類"], ["in", "お客様の入力"], ["att", "受講状況"], ["out", "集計と出力"]] : [["doc", "やること"], ["in", "入力"], ["att", "受講状況"], ["out", "受け取る"]];
  const plan = stages.find(s => s.key === "plan"), pay = stages.find(s => s.key === "shikyu");
  const planOk = PASSED.includes(plan?.state.value);
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{[companyName, course?.name || grant.courseId].filter(Boolean).join(" ・ ")}</div><h1 className="h1">助成金</h1></div><span className="r">{onBack && <Btn kind="ghost sm" onClick={onBack}>← 助成金の一覧</Btn>}</span></div>
      <Card className="pad st-g">
        <div className="head"><h2 className="h2">{grant.grantType || "助成金"}{grant.applicationType ? ` ・ ${applicationTypeLabel(grant.applicationType)}` : ""}</h2><span className="r">{planOk ? <Chip tone="ok">計画届 提出済み</Chip> : plan?.deadline && <Chip tone={plan.deadline.overdue || plan.deadline.daysRemaining <= 30 ? "bad" : "warn"}>{plan.deadline.overdue ? "計画届の期限を過ぎました" : `計画届の期限まで あと ${plan.deadline.daysRemaining} 日`}</Chip>}{pay?.deadline && <Chip>支給申請の期限 {md(pay.deadline.date)}</Chip>}</span></div>
        <Steps grant={grant} course={course} stages={stages} />
      </Card>
      <span className="seg">{tabs.map(([k, t]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>{t}</button>)}</span>
      {tab === "doc" && <DocsTab grant={grant} stages={stages} facts={facts} isAdmin={isAdmin} docs={docs} setTab={setTab} onNotify={setNote} say={say} />}
      {tab === "in" && <InputTab grant={grant} isAdmin={isAdmin} onNotify={setNote} say={say} />}
      {tab === "att" && <AttendTab grant={grant} />}
      {tab === "out" && <OutTab grant={grant} course={course} facts={facts} isAdmin={isAdmin} docs={docs} onSave={onSave} onDelete={onDelete} say={say} />}
      {note !== null && <Modal title={`お客様に知らせる ・ ${companyName}`} width={480} onClose={() => setNote(null)} footer={<><Btn kind="ghost" onClick={() => setNote(null)}>やめる</Btn><Btn disabled={noteBusy || !note.trim()} onClick={sendNote}>確かめて送る</Btn></>}><label className="field">本文<textarea rows={4} maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label><Chip>企業担当者の通知に出る</Chip>{noteErr && <div className="lms-err" role="alert">{noteErr}</div>}</Modal>}
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
  const [facts, setFacts] = useState({});
  const ids = list.items.map(g => g.grantId).join(",");
  useEffect(() => {
    if (!isAdmin) return undefined;
    let alive = true;
    list.items.forEach(g => loadFacts(g, true).then(f => { if (alive) setFacts(m => ({ ...m, [g.grantId]: f })); }));
    return () => { alive = false; };
  }, [ids, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
  const coName = id => companies.find(c => c.companyId === id)?.name || "";
  const rows = useMemo(() => list.items.map(g => { const c = coursesById[g.courseId] || null; return { g, c, stages: computeGrantStages(g, c) }; }), [list.items, coursesById]);
  if (master && isAdmin) return <GrantMaster say={say} onBack={() => setMaster(false)} />;
  if (list.loading && !list.items.length) return <div className="soon card">読み込み中</div>;
  if (list.error) return <Card><div className="empty"><b>助成金を確認できません</b><Btn kind="ghost sm" onClick={list.reload}>再読み込み</Btn></div></Card>;
  const cur = rows.find(r => r.g.grantId === open) || (!isAdmin && rows.length === 1 ? rows[0] : null);
  if (cur) {
    return <Detail key={cur.g.grantId} grant={cur.g} course={cur.c} companyName={isAdmin ? coName(cur.g.companyId) : ""} role={role} say={say} onBack={isAdmin || rows.length > 1 ? () => setOpen("") : null} onSave={p => list.updateGrant(cur.g.grantId, p)} onDelete={async () => { try { await list.deleteGrant(cur.g.grantId); setOpen(""); say?.("消しました"); } catch { say?.("消せませんでした"); } }} />;
  }
  const sight = f => {
    if (!f) return <Chip>読み込み中</Chip>;
    if (!f.stats) return <Chip>確認できません</Chip>;
    if (!f.stats.period?.trainingDays) return <Chip>これから</Chip>;
    if (!(f.stats.period.scheduledMinutes > 0)) return <Chip>確認できません</Chip>;
    const t = arr(f.stats.trainees).map(x => rateOf(x, f.stats.period)), bad = t.filter(r => r < THRESHOLD).length, warn = t.filter(r => r >= THRESHOLD && r < 88).length;
    return bad || warn ? <span className="row">{bad > 0 && <Chip tone="bad">要件外の可能性 {bad}</Chip>}{warn > 0 && <Chip tone="warn">注意 {warn}</Chip>}</span> : <Chip tone="ok">全員 OK</Chip>;
  };
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{isAdmin ? "すべての企業" : ""}</div><h1 className="h1">助成金</h1></div>{isAdmin && <span className="r"><Btn kind="ghost sm" onClick={() => setMaster(true)}>助成金マスタ</Btn><Btn kind="sm" onClick={() => setCreating(true)}>申請を作る</Btn></span>}</div>
      {list.actionError && <div className="lms-err" role="alert">{list.actionError}</div>}
      <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th>コース</th>{isAdmin && <th>企業</th>}<th>制度</th><th>計画届</th><th>支給申請</th><th>書類</th><th>受講率 8 割</th><th>見込み（目安）</th><th /></tr></thead><tbody>
        {rows.map(r => {
          const plan = r.stages.find(s => s.key === "plan"), pay = r.stages.find(s => s.key === "shikyu"), f = facts[r.g.grantId];
          const ok = f ? grantRows(r.g, r.stages, f).filter(x => x.tone === "ok").length : null;
          return (
            <tr key={r.g.grantId}>
              <td><button type="button" className="lnk adcn" onClick={() => setOpen(r.g.grantId)}>{r.c?.name || r.g.courseId}</button></td>{isAdmin && <td>{coName(r.g.companyId)}</td>}
              <td>{r.g.grantType || "—"}</td>
              <td>{PASSED.includes(plan?.state.value) ? <Chip tone="ok">{r.g.appliedAt ? `${md(r.g.appliedAt)} 提出` : "提出済み"}</Chip> : plan?.deadline ? <Chip tone={plan.deadline.overdue || plan.deadline.daysRemaining <= 30 ? "bad" : "warn"}>{plan.deadline.overdue ? "超過" : `あと ${plan.deadline.daysRemaining} 日`}</Chip> : <Chip>未定</Chip>}</td>
              <td className="num">{pay?.deadline ? md(pay.deadline.date) : "—"}</td>
              <td>{ok === null ? <Chip>読み込み中</Chip> : <span className="gr-dc"><span className="bar10"><i style={{ "--w": `${Math.round(ok / GD.length * 100)}%` }} /></span><span className="num">{ok} / {GD.length}</span></span>}</td>
              <td>{sight(f)}</td>
              <td className="num gr-y">{yen(r.g.calculatedAmountDraft)}</td>
              <td><Btn kind="ghost sm" onClick={() => setOpen(r.g.grantId)}>開く</Btn></td>
            </tr>
          );
        })}
        {!rows.length && <tr><td colSpan={isAdmin ? 9 : 8}><Chip>なし</Chip></td></tr>}
      </tbody></table></div></Card>
      {creating && <CreateModal companies={companies} onClose={() => setCreating(false)} onCreate={p => list.createGrant(p).then(() => say?.("申請を作りました"))} />}
    </div>
  );
}
