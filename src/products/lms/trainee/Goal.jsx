import React, { useEffect, useState } from "react";
import { apiGet } from "../../../api.js";
import { getActiveCourseId } from "../../../utils/common/courseContext.js";
import { todayStr } from "../../training/useTraining.js";
import { Btn, Card, Chip, Hero, Modal } from "../parts/ui.jsx";

/* 受講生の目標（モック goalT2）：上に全体の進みと次にやること、研修の目標（コースで決めたもの）、自分の目標。
   研修の目標は変えられない（チェックと、自分で足した小目標の直し・消しだけ）。保存は今の画面と同じ /tasks/me（TrainingApp の toggle・setGoals） */

const CATS = ["cur", "att", "tst", "dev"];
const arr = v => (Array.isArray(v) ? v : []);
const isOwnTask = t => !t.fromCourse && String(t.id || "").startsWith("u");
const md = v => { const s = String(v || ""); return s ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : ""; };

function GRing({ n, of }) {
  const r = 52, w = r * 2 + 20, c = 2 * Math.PI * r;
  return (
    <span className="gl-ring" style={{ "--s": `${w}px` }}>
      <svg viewBox={`0 0 ${w} ${w}`} aria-hidden="true">
        <circle cx={w / 2} cy={w / 2} r={r} className="tr" />
        <circle cx={w / 2} cy={w / 2} r={r} className="fg" strokeDasharray={`${(c * (of ? n / of : 0)).toFixed(1)} ${c.toFixed(1)}`} transform={`rotate(-90 ${w / 2} ${w / 2})`} />
      </svg>
      <b className="num">{n}<small>/ {of}</small></b>
    </span>
  );
}

function Check({ on, onChange, disabled, children }) {
  return (
    <label className={`gl-t${on ? " on" : ""}`}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={onChange} />
      <span className="gl-b" aria-hidden="true">✓</span>
      <span>{children}</span>
    </label>
  );
}

export default function TraineeGoal({ go, tasks }) {
  const today = todayStr();
  const { done = {}, goals = [], toggle, setGoals, saveState, dataState, retry } = tasks || {};
  const [course, setCourse] = useState(null);
  const [nt, setNt] = useState({});
  const [ng, setNg] = useState({ title: "", sub: "" });
  const [dlg, setDlg] = useState(null);  // { kind: "goal"|"task"|"delGoal", gid, tid, title, sub }

  useEffect(() => {
    let alive = true;
    apiGet("/me/courses").then(cs => { const list = arr(cs); if (alive) setCourse(list.find(c => c.courseId === getActiveCourseId()) || list[0] || null); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (dataState === "error") return <Card><div className="empty"><b>目標を確認できません</b><Btn kind="ghost sm" onClick={retry}>再読み込み</Btn></div></Card>;
  if (dataState !== "ready") return <div className="soon card">読み込み中</div>;

  const all = arr(goals).map(g => ({ ...g, tasks: arr(g.tasks) }));
  const trainGoals = all.filter(g => !g.custom), mine = all.filter(g => g.custom);
  const flat = trainGoals.flatMap(g => g.tasks.map(t => ({ t, g })));
  const dn = flat.filter(x => done[x.t.id]).length;
  const nx = flat.filter(x => !done[x.t.id]).slice(0, 3);
  const end = String(course?.endDate || "").slice(0, 10);
  const left = end ? Math.ceil((Date.parse(end) - Date.parse(today)) / 86400000) : null;

  const addTask = gid => {
    const t = (nt[gid] || "").trim();
    if (!t) return;
    setGoals(all.map(g => (g.id === gid && g.custom ? { ...g, tasks: [...g.tasks, { id: `u${Date.now()}`, t }] } : g)));
    setNt(m => ({ ...m, [gid]: "" }));
  };
  const addGoal = () => {
    const title = ng.title.trim();
    if (!title) return;
    setGoals([...all, { id: `ug${Date.now()}`, title, sub: ng.sub.trim(), custom: true, tasks: [] }]);
    setNg({ title: "", sub: "" });
  };
  const delTask = (gid, tid) => setGoals(all.map(g => (g.id === gid ? { ...g, tasks: g.tasks.filter(t => t.id !== tid) } : g)));
  const confirm = () => {
    const { kind, gid, tid, title, sub } = dlg, v = String(title || "").trim();
    if (kind === "delGoal") setGoals(all.filter(g => g.id !== gid));
    else if (!v) return;
    else if (kind === "goal") setGoals(all.map(g => (g.id === gid ? { ...g, title: v, sub: String(sub || "").trim() } : g)));
    else setGoals(all.map(g => (g.id === gid ? { ...g, tasks: g.tasks.map(t => (t.id === tid ? { ...t, t: v } : t)) } : g)));
    setDlg(null);
  };
  const taskRow = (g, t) => (
    <div key={t.id} className="gl-tr">
      <Check on={!!done[t.id]} onChange={() => toggle(t.id)}>{t.t}</Check>
      {(g.custom || isOwnTask(t)) && <span className="gl-ed"><button type="button" onClick={() => setDlg({ kind: "task", gid: g.id, tid: t.id, title: t.t || "" })}>直す</button><button type="button" onClick={() => delTask(g.id, t.id)}>消す</button></span>}
    </div>
  );
  const head = (g, no, n) => (
    <>
      <div className="gl-ch">
        <span className="gl-no num" aria-hidden="true">{no}</span>
        <div><b>{g.title}</b>{g.sub && <small>{g.custom ? `${g.sub} まで` : g.sub}</small>}</div>
        <span className="gl-n num">{g.tasks.length && n === g.tasks.length ? "✓" : `${n} / ${g.tasks.length}`}</span>
      </div>
      <span className="tp-bar"><i style={{ "--w": `${g.tasks.length ? Math.round(n / g.tasks.length * 100) : 0}%` }} /></span>
    </>
  );

  return (
    <div className="th gl">
      <div className="th-top">
        <div><div className="eyebrow">自分用</div><h1 className="h1">目標</h1></div>
        <div className="th-att">
          {saveState === "saving" && <span className="th-pill gy">保存しています</span>}
          {saveState === "saved" && <span className="th-pill ok"><i aria-hidden="true" />保存しました</span>}
          {saveState === "error" && <span className="th-pill gl-ng" role="alert">保存できず元に戻しました</span>}
          <span className="th-pill ok"><i aria-hidden="true" />研修の目標 <b className="num">{dn} / {flat.length}</b></span>
          <span className="th-pill"><i aria-hidden="true" style={{ background: "var(--tm-d)" }} />自分の目標 <b className="num">{mine.length}</b></span>
        </div>
      </div>

      {trainGoals.length > 0 && (
        <Hero cat="rep" eyebrow="研修の目標" step={end ? `${md(end)} まで${left >= 0 ? ` ・ あと ${left} 日` : ""}` : undefined} className="gl-hero">
          <div className="gl-hm">
            <GRing n={dn} of={flat.length} />
            <div className="gl-nx">
              <span className="eyebrow">次にやること</span>
              {nx.length ? nx.map(x => <Check key={x.t.id} on={false} onChange={() => toggle(x.t.id)}>{x.t.t}<small>{x.g.title}</small></Check>) : <b className="gl-all">✓ 全部できました</b>}
            </div>
          </div>
          <div className="gl-pl">
            {trainGoals.map((g, i) => {
              const n = g.tasks.filter(t => done[t.id]).length;
              return <span key={g.id} className={`c-${CATS[i % CATS.length]}`}><b>{g.title}</b><em className="num">{n} / {g.tasks.length}</em><span className="tp-bar sm"><i style={{ "--w": `${g.tasks.length ? Math.round(n / g.tasks.length * 100) : 0}%` }} /></span></span>;
            })}
          </div>
        </Hero>
      )}

      {trainGoals.length > 0 && (
        <>
          <div className="gl-sh"><h2 className="h2">研修の目標</h2>{course && <Chip>{course.name || course.courseName}</Chip>}</div>
          <div className="gl-g gl-eq">
            {trainGoals.map((g, i) => {
              const n = g.tasks.filter(t => done[t.id]).length;
              return (
                <Card key={g.id} className={`pad gl-c c-${CATS[i % CATS.length]}`}>
                  {head(g, i + 1, n)}
                  <div className="gl-ts">{g.tasks.map(t => taskRow(g, t))}</div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <div className="gl-sh"><h2 className="h2">自分の目標</h2><Chip>講師も閲覧可</Chip></div>
      <div className="gl-g gl-eq">
        {mine.map(g => {
          const n = g.tasks.filter(t => done[t.id]).length;
          return (
            <Card key={g.id} className="pad gl-c c-tm">
              {head(g, "★", n)}
              <div className="gl-ts">{g.tasks.map(t => taskRow(g, t))}</div>
              <div className="gl-add">
                <input type="text" value={nt[g.id] || ""} placeholder="小目標を足す" aria-label={`${g.title} に小目標を足す`} onChange={e => setNt(m => ({ ...m, [g.id]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addTask(g.id); }} />
                <Btn kind="ghost sm" onClick={() => addTask(g.id)}>足す</Btn>
              </div>
              <span className="gl-ed gl-eg"><button type="button" onClick={() => setDlg({ kind: "goal", gid: g.id, title: g.title || "", sub: g.sub || "" })}>目標を直す</button><button type="button" onClick={() => setDlg({ kind: "delGoal", gid: g.id, title: g.title })}>消す</button></span>
            </Card>
          );
        })}
        <section className="card pad gl-new">
          <div className="gl-ch"><span className="gl-no" aria-hidden="true">＋</span><div><b>目標を足す</b></div></div>
          <input type="text" value={ng.title} placeholder="例：基本情報技術者を取得する" aria-label="目標" onChange={e => setNg(v => ({ ...v, title: e.target.value }))} />
          <div className="gl-add">
            <input type="text" value={ng.sub} placeholder="いつまでに（例：2027/04）" aria-label="いつまでに" onChange={e => setNg(v => ({ ...v, sub: e.target.value }))} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) addGoal(); }} />
            <Btn kind="sm" disabled={!ng.title.trim()} onClick={addGoal}>目標を足す</Btn>
          </div>
        </section>
      </div>

      {dlg && (
        <Modal title={dlg.kind === "goal" ? "目標を直す" : dlg.kind === "task" ? "小目標を直す" : "目標を消す"} width={420} onClose={() => setDlg(null)} footer={<><Btn kind="ghost" onClick={() => setDlg(null)}>やめる</Btn><Btn onClick={confirm}>{dlg.kind === "delGoal" ? "消す" : "決める"}</Btn></>}>
          {dlg.kind === "delGoal" ? <b>{dlg.title}</b> : (
            <>
              <input type="text" value={dlg.title} autoFocus aria-label="名前" onChange={e => setDlg(d => ({ ...d, title: e.target.value }))} />
              {dlg.kind === "goal" && <input type="text" value={dlg.sub} placeholder="いつまでに" aria-label="いつまでに" onChange={e => setDlg(d => ({ ...d, sub: e.target.value }))} />}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
