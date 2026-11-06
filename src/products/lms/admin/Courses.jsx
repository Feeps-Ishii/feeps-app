import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../../api.js";
import { setActiveCourseId } from "../../../utils/common/courseContext.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, ListTool, Modal, matchName } from "../parts/ui.jsx";
import { arr, errText, md } from "../staff/common.js";
import InstructorCurriculum from "../instructor/Curriculum.jsx";
import InstructorPractice from "../instructor/Practice.jsx";
import InstructorSetting from "../instructor/Setting.jsx";
import StaffTests from "../staff/Tests.jsx";
import CourseCreate from "./CourseCreate.jsx";
import { COL, dayOf, setupOf, stateOf } from "./Home.jsx";

const RosterImport = lazy(() => import("../../console/RosterImport.jsx"));

/* 管理者のコース一覧とコースの管理（モック courseA・cadmS2）：状態で絞る・探す・並べ替え。押すと準備の一覧、設定、名簿、講師に渡す。
   企業のひも付けは companyId。作るのは名前と期間だけで、中身はカリキュラムの画面から */

function Manage({ c, i, companies, go, say, onBack, reload, initialRoster, rosterOpen, warn }) {
  const today = todayStr();
  const [view, setView] = useState("top");
  const [roster, setRoster] = useState(!!initialRoster || !!rosterOpen);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [del, setDel] = useState(false);
  const su = setupOf(c), done = su.filter(x => x[1]).length, st0 = stateOf(c, today);
  const co = companies.find(x => x.companyId === c.companyId);
  const update = async patch => {
    setBusy(true); setErr("");
    try { await apiPut(`/courses/${encodeURIComponent(c.courseId)}`, { name: c.name, type: c.kind || "shinjin", memo: c.memo || "", ...patch }); await reload(); return true; }
    catch (e) { setErr(errText(e, "保存できませんでした")); return false; } finally { setBusy(false); }
  };
  const band = (
    <div className="ceb" style={{ "--cc": COL[i % COL.length] }} role="region" aria-label="編集中のコース">
      <span className="ceb-m" aria-hidden="true">{c.name.slice(0, 1)}</span>
      <span className="ceb-t"><small>編集中のコース</small><b>{c.name}</b><em>{co?.name || "企業 未定"} ・ {c.startDate ? `${md(c.startDate)}〜${md(c.endDate)}` : "期間 未定"} ・ {st0}</em></span>
      <span className="ceb-r"><Btn kind="ghost sm" onClick={onBack}>コースを出る</Btn></span>
    </div>
  );
  const backTop = <div><Btn kind="ghost sm" onClick={() => { setView("top"); reload(); }}>← コースの管理</Btn></div>;
  // コースの中のカリキュラム・テスト・練習問題（モック cadmS の「カリキュラムを細かく直す」など）。講師と同じ画面
  const inner = k => { if (k === "test" || k === "prac" || k === "cur") setView(k); else if (k === "doc") go("cdoc"); else go(k); };
  if (view === "setting") return <div className="st">{band}{backTop}<InstructorSetting key={c.courseId} role="admin" say={say} /></div>;
  if (view === "cur") return <div className="st">{band}{backTop}<InstructorCurriculum key={c.courseId} role="instructor" go={inner} say={say} /></div>;
  if (view === "test") return <div className="st">{band}{backTop}<StaffTests key={c.courseId} role="instructor" go={inner} say={say} /></div>;
  if (view === "prac") return <div className="st">{band}{backTop}<InstructorPractice key={c.courseId} say={say} /></div>;
  const act = { 講師: () => setView("setting"), 受講生: () => setRoster(true), 研修の期間: () => setView("setting"), 始まりの時間: () => setView("setting") };
  return (
    <div className="st">
      {band}
      <div className="head"><h1 className="h1">コースの管理</h1><span className="r"><Btn kind="ghost sm" onClick={() => setView("setting")}>コースの設定</Btn><Btn kind="ghost sm" onClick={() => setView("cur")}>カリキュラムを細かく直す</Btn><Btn kind="ghost sm" onClick={() => setView("test")}>テスト</Btn><Btn kind="ghost sm" onClick={() => setView("prac")}>練習問題</Btn><Btn kind="ghost sm" onClick={() => setDel(true)}>消す</Btn></span></div>
      {(warn || []).map(w => <div key={w} className="lms-err" role="alert">{w}</div>)}
      {err && <div className="lms-err" role="alert">{err}</div>}
      <Card className="pad">
        <div className="head"><h2 className="h2">準備</h2><span className="r"><span className="cs-n num">{done} / {su.length}</span>{st0 !== "研修中" && st0 !== "終わった" && (c.handedAt ? <Chip tone="ok">講師に渡しました</Chip> : <Btn kind="sm" disabled={busy || done < su.length} onClick={async () => { if (await update({ handedAt: new Date().toISOString() })) say?.("講師に渡しました"); }}>講師に渡す</Btn>)}</span></div>
        <div className="cs-l">
          <div className={`cs ${co ? "ok" : "warn"}`}><i>{co ? "✓" : "!"}</i><span>企業</span><b><select className="in st-sel" aria-label="企業" value={c.companyId} disabled={busy} onChange={e => update({ companyId: e.target.value })}><option value="">未定</option>{companies.map(x => <option key={x.companyId} value={x.companyId}>{x.name}</option>)}</select></b><span /></div>
          {su.map(([t, ok]) => {
            const v = t === "講師" ? `${arr(c.instructorIds).length} 人` : t === "受講生" ? `${c.traineeCount ?? "?"} 人` : t === "研修の期間" ? (c.startDate ? `${md(c.startDate)}〜${md(c.endDate)}` : "") : c.standardClockIn;
            return <div key={t} className={`cs ${ok ? "ok" : t === "講師" ? "bad" : "warn"}`}><i>{ok ? "✓" : "!"}</i><span>{t}</span><b>{ok ? v : "まだ"}</b><Btn kind={ok ? "ghost sm" : "sm"} onClick={act[t]}>{ok ? "変える" : t === "受講生" ? "名簿で登録" : "決める"}</Btn></div>;
          })}
        </div>
      </Card>
      {roster && <Suspense fallback={null}><div className="lms-legacy"><RosterImport course={{ ...c, id: c.courseId }} initialRows={initialRoster} onClose={() => setRoster(false)} onDone={() => { setRoster(false); reload(); }} /></div></Suspense>}
      {del && <Modal title="コースを消す" width={420} onClose={() => setDel(false)} footer={<><Btn kind="ghost" onClick={() => setDel(false)}>やめる</Btn><Btn disabled={busy} onClick={async () => { setBusy(true); try { await apiDelete(`/courses/${encodeURIComponent(c.courseId)}`); say?.("コースを消しました"); setDel(false); onBack(); reload(); } catch (e) { setErr(errText(e, "消せませんでした")); setDel(false); } finally { setBusy(false); } }}>消す</Btn></>}><b>{c.name}</b></Modal>}
    </div>
  );
}

export default function AdminCourses({ go, say }) {
  const today = todayStr();
  const [st, setSt] = useState({ state: "loading", courses: [] });
  const [companies, setCompanies] = useState([]);
  const [open, setOpen] = useState(() => { try { const v = sessionStorage.getItem("lms.courseOpen"); sessionStorage.removeItem("lms.courseOpen"); return v || ""; } catch { return ""; } });
  const [creating, setCreating] = useState(false);
  const [made, setMade] = useState(null);
  const [sel, setSel] = useState(""); const [copyFrom, setCopyFrom] = useState(""); const [rosterOpen, setRosterOpen] = useState(false); const [users, setUsers] = useState([]);
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [sort, setSort] = useState("issue");
  const load = useCallback(() => apiGet("/admin/course-overview").then(r => setSt({ state: "ready", courses: arr(r?.courses) })).catch(() => setSt({ state: "error", courses: [] })), []);
  useEffect(() => { load(); apiGet("/companies").then(l => setCompanies(arr(l))).catch(() => setCompanies([])); apiGet("/admin/users").then(l => setUsers(arr(l))).catch(() => setUsers([])); }, [load]);
  if (st.state === "loading") return <div className="soon card">読み込み中</div>;
  if (st.state === "error") return <Card><div className="empty"><b>コースを確認できません</b><Btn kind="ghost sm" onClick={load}>再読み込み</Btn></div></Card>;
  const cur = st.courses.find(c => c.courseId === open);
  if (cur) return <Manage key={cur.courseId} initialRoster={made?.roster} rosterOpen={rosterOpen} warn={made?.warn} c={cur} i={st.courses.indexOf(cur)} companies={companies} go={go} say={say} onBack={() => { setOpen(""); setRosterOpen(false); }} reload={load} />;
  const coName = id => companies.find(x => x.companyId === id)?.name || "";
  const kinds = ["研修中", "これから", "下書き", "終わった"];
  const issues = c => setupOf(c).filter(x => !x[1]).length;
  const rows = st.courses.map((c, i) => ({ c, i, s: stateOf(c, today) }));
  const by = { issue: (a, b) => issues(b.c) - issues(a.c), start: (a, b) => String(a.c.startDate || "9").localeCompare(String(b.c.startDate || "9")), ppl: (a, b) => (b.c.traineeCount || 0) - (a.c.traineeCount || 0), name: (a, b) => a.c.name.localeCompare(b.c.name, "ja") }[sort];
  const list = rows.filter(r => (tab === "all" ? r.s !== "終わった" : r.s === tab) && (matchName(r.c.name, "", q) || coName(r.c.companyId).includes(q.trim()))).sort(by);
  const pick = (c, withRoster) => { setActiveCourseId(c.courseId); setRosterOpen(!!withRoster); setOpen(c.courseId); };
  const nameOf = id => users.find(u => u.userId === id)?.name || "";
  const names = ids => arr(ids).map(nameOf).filter(Boolean).join("・");
  const sc = st.courses.find(c => c.courseId === sel);
  return (
    <div className="st">
      <div className="head"><div><div className="eyebrow">{st.courses.length} コース</div><h1 className="h1">コース一覧</h1></div><span className="r"><Btn kind="ghost sm" disabled={!sc} onClick={() => { setCopyFrom(sc.courseId); setCreating(true); setSel(""); }}>{sc ? `「${sc.name}」を写して作る` : "写して作る"}</Btn><Btn kind="sm" onClick={() => { setCopyFrom(""); setCreating(true); }}>コースを作る</Btn></span></div>
      <ListTool tabs={[["all", "今のコース", rows.filter(r => r.s !== "終わった").length], ...kinds.map(k => [k, k, rows.filter(r => r.s === k).length])]} tab={tab} onTab={setTab} q={q} onQ={setQ} placeholder="コース・企業で探す" sorts={[["issue", "気になるところの多い順"], ["start", "始まりの早い順"], ["ppl", "受講生の多い順"], ["name", "名前順"]]} sort={sort} onSort={setSort} />
      <Card className=""><div className="scroll"><table className="tbl"><thead><tr><th><span className="lms-sr">写すコースを選ぶ</span></th><th>コース</th><th>期間</th><th>受講生</th><th>講師</th><th>コース担当者</th><th>状態</th></tr></thead><tbody>
        {list.map(({ c, i, s }) => {
          const dd = s === "研修中" ? dayOf(c, today) : null, n = issues(c), on = sel === c.courseId, over = s === "終わった";
          return (
            <tr key={c.courseId} className={`crow${over ? " stopped" : ""}${on ? " pinr" : ""}`} onClick={e => { if (!e.target.closest("button, a, input, select, label")) pick(c); }}>
              <td><button type="button" className={`pinc${on ? " on" : ""}`} aria-pressed={on} aria-label={`${c.name} を写すコースに選ぶ`} onClick={() => setSel(on ? "" : c.courseId)}>{on ? "✓" : ""}</button></td>
              <td><span className="ua-n"><span className="co-av cc-av" style={{ "--cc": COL[i % COL.length] }}>{c.name.slice(0, 1)}</span><span><b className="adcn">{c.name}</b>{n > 0 && !over && <span className={`act-al${arr(c.instructorIds).length ? " warn" : ""} sm`}> !<b>{n}</b></span>}<small className="adsm">{coName(c.companyId)}</small></span></span></td>
              <td><span className="num">{c.startDate ? `${md(c.startDate)}〜${md(c.endDate)}` : "未定"}</span>{dd && <span className="adpg"><span className="bar10"><i style={{ "--w": `${Math.round(dd[0] / dd[1] * 100)}%` }} /></span><small className="num">{dd[0]} / {dd[1]} 日</small></span>}</td>
              <td>{c.traineeCount ? <span className="num">{c.traineeCount} 人</span> : over ? "—" : c.traineeCount == null ? <Chip tone="bad">確認できません</Chip> : <Btn kind="ghost sm" onClick={() => pick(c, true)}>名簿で登録</Btn>}</td>
              <td>{arr(c.instructorIds).length ? (names(c.instructorIds) || `${c.instructorIds.length} 人`) : <button type="button" className="chip bad" onClick={() => pick(c)}>未設定</button>}</td>
              <td>{arr(c.managerIds).length ? (names(c.managerIds) || `${c.managerIds.length} 人`) : over ? "—" : <button type="button" className="chip warn" onClick={() => pick(c)}>未設定</button>}</td>
              <td><Chip tone={s === "研修中" ? "ok" : s === "下書き" ? "warn" : s === "これから" ? "blue" : ""}>{s}</Chip></td>
            </tr>
          );
        })}
        {!list.length && <tr><td colSpan={7}><Chip>なし</Chip></td></tr>}
      </tbody></table></div></Card>
      {creating && <CourseCreate companies={companies} courses={st.courses} copyFrom={copyFrom} onClose={() => setCreating(false)} onDone={(id, r) => { setCreating(false); setMade(r); load().then(() => { if (id) { setActiveCourseId(id); setOpen(id); } }); say?.("コースを下書きで作りました"); }} />}
    </div>
  );
}
