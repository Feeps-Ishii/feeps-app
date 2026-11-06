import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPut } from "../../../api.js";
import { normalizeCurriculumSections } from "../../training/TrainingComponents.jsx";
import { Sheet, Style } from "../../training/PracticeView.jsx";
import { PRACTICE_FOCUS_KEY } from "../../training/practiceLinks.js";
import { todayStr } from "../../training/useTraining.js";
import { getActiveCourseId, setActiveCourseId } from "../../../utils/common/courseContext.js";
import { Btn, Card, Chip, Ring } from "../parts/ui.jsx";
import { Icon } from "../parts/icons.jsx";

/* 受講生の練習問題（モック pracList2）：上に今の単元、下に単元ごとの問題と「できた」、右に全体の進み。
   単元を押しても順番は入れ替えない。解く画面は今の Sheet（ヒント・解答・図）をそのまま使う */

const arr = v => (Array.isArray(v) ? v : []);
const isD = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
const dk = v => String(v || "").slice(0, 10);
const rangeOf = s => {
  const own = isD(dk(s.startDate));
  const ds = (own ? [s] : arr(s.chapters).flatMap(c => arr(c.lessons))).flatMap(x => [dk(x.startDate), dk(x.endDate || x.startDate)]).filter(isD).sort();
  return ds.length ? { start: ds[0], end: ds[ds.length - 1] } : null;
};
const takeFocus = () => { try { const v = JSON.parse(sessionStorage.getItem(PRACTICE_FOCUS_KEY) || "null"); sessionStorage.removeItem(PRACTICE_FOCUS_KEY); return v; } catch { return null; } };
const daysLeft = (iso, today) => Math.ceil((Date.parse(dk(iso)) - Date.parse(today)) / 86400000);

function Sum({ n, of }) {
  return <><span className="tp-bar"><i style={{ "--w": `${of ? Math.round(n / of * 100) : 0}%` }} /></span><span className="tp-n num">{n} / {of} できた</span></>;
}

export default function TraineePractice() {
  const today = todayStr();
  const [focus] = useState(takeFocus);
  const [state, setState] = useState("loading");
  const [courseId, setCourseId] = useState("");
  const [courseName, setCourseName] = useState("");
  const [sections, setSections] = useState([]);
  const [sets, setSets] = useState([]); // { item, set, done }
  const [open, setOpen] = useState(null); // { setId, qid }
  const [opened, setOpened] = useState({});
  const [key, setKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setState("loading");
    apiGet("/me/courses").then(async cs => {
      const list = arr(cs), c = list.find(x => x.courseId === (focus?.courseId || getActiveCourseId())) || list[0];
      if (!c) { if (alive) { setSets([]); setState("ready"); } return; }
      setActiveCourseId(c.courseId);
      const [r, cur] = await Promise.all([apiGet(`/practice?courseId=${encodeURIComponent(c.courseId)}`), apiGet(`/courses/${c.courseId}/curriculum`).catch(() => null)]);
      const metas = arr(r?.items).filter(s => s.status === "published");
      // できたの印は問題集ごとの中身にあるので、まとめて読む
      const full = await Promise.all(metas.map(m => apiGet(`/practice/${encodeURIComponent(m.id)}?courseId=${encodeURIComponent(c.courseId)}`).then(x => ({ item: x.item || m, set: x.set, done: x.done || {} }))));
      if (!alive) return;
      setCourseId(c.courseId); setCourseName(c.name || c.courseName || "");
      setSections(cur ? normalizeCurriculumSections(cur) : []);
      setSets(full.filter(x => x.set));
      if (focus?.setId) setOpen({ setId: focus.setId, qid: focus.qid });
      setState("ready");
    }).catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // 単元ごとに問題を集める（単元と結んでいない Lesson は問題集の名前でまとめる）
  const units = useMemo(() => {
    const map = new Map();
    const add = (k, title, ui, range, e) => { if (!map.has(k)) map.set(k, { k, title, ui, range, qs: [] }); map.get(k).qs.push(...e); };
    sets.forEach(({ item, set, done }) => set.lessons.forEach(l => {
      const ui = sections.findIndex(s => s.id === l.sectionId);
      const qs = l.questions.map(q => ({ q, setId: item.id, done: !!done[q.id] }));
      if (ui >= 0) add(sections[ui].id, sections[ui].title, ui, rangeOf(sections[ui]), qs);
      else add(`set:${item.id}`, item.title || "練習問題", -1, null, qs);
    }));
    return [...map.values()].sort((a, b) => (a.ui < 0 ? 1 : b.ui < 0 ? -1 : a.ui - b.ui));
  }, [sets, sections]);
  const cur = units.find(u => u.range && u.range.start <= today && today <= u.range.end) || units.filter(u => u.ui >= 0 && u.range && u.range.start <= today).pop() || units[0];
  const tot = units.reduce((a, u) => a + u.qs.length, 0), dn = units.reduce((a, u) => a + u.qs.filter(x => x.done).length, 0);

  const mark = useCallback((setId, qid, v) => {
    const put = val => setSets(list => list.map(s => (s.item.id === setId ? { ...s, done: { ...s.done, [qid]: val } } : s)));
    put(v);
    apiPut(`/practice/${encodeURIComponent(setId)}/done?courseId=${encodeURIComponent(courseId)}`, { qid, done: v }).catch(() => put(!v));
  }, [courseId]);

  if (open) {
    const s = sets.find(x => x.item.id === open.setId);
    if (s) {
      return (
        <div className="tl-take tp-sheet">
          <Style />
          <div><Btn kind="ghost sm" onClick={() => setOpen(null)}>練習問題の一覧</Btn></div>
          <Sheet meta={s.item} set={s.set} done={s.done} onDone={(qid, v) => mark(s.item.id, qid, v)} focusQ={open.qid} showAnswers={s.item.showAnswers !== false} />
        </div>
      );
    }
  }
  if (state === "loading") return <div className="soon card">読み込み中</div>;
  if (state === "error") return <Card><div className="empty"><b>練習問題を確認できません</b><Btn kind="ghost sm" onClick={() => setKey(k => k + 1)}>再読み込み</Btn></div></Card>;
  if (!units.length) return <Card><div className="empty"><b>練習問題</b><Chip>なし</Chip></div></Card>;

  const nextOf = u => u.qs.find(x => !x.done);
  const startLabel = u => (u.qs.some(x => x.done) ? "続きから" : `問題 ${u.qs[0].q.n} から`);
  const go = x => setOpen({ setId: x.setId, qid: x.q.id });
  const dues = sets.filter(s => s.item.dueDate && Object.values(s.done).filter(Boolean).length < (s.item.counts?.questions || 0)).sort((a, b) => dk(a.item.dueDate).localeCompare(dk(b.item.dueDate)));

  return (
    <div className="th tl tp">
      <div className="th-top">
        <div><div className="eyebrow">{courseName}</div><h1 className="h1">練習問題</h1></div>
        <div className="th-att"><span className="th-pill ok"><i aria-hidden="true" />できた <b>{dn} / {tot}</b></span></div>
      </div>
      {cur && (() => {
        const n = cur.qs.filter(x => x.done).length, nx = nextOf(cur);
        return (
          <div className="tp-now c-tst">
            <span className="tp-nl"><span className="eyebrow">今の単元</span><b>{cur.ui >= 0 ? `単元 ${cur.ui + 1} ・ ` : ""}{cur.title}</b><small className="num">{n} / {cur.qs.length} できた</small></span>
            <span className="tp-bar"><i style={{ "--w": `${Math.round(n / cur.qs.length * 100)}%` }} /></span>
            {nx ? <Btn kind="sm" onClick={() => go(nx)}>{startLabel(cur)}</Btn> : <Chip tone="ok">✓ 全問できた</Chip>}
            <Btn kind="ghost sm" onClick={() => { setOpened(m => ({ ...m, [cur.k]: true })); document.getElementById(`tpu-${cur.k}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>一覧で見る</Btn>
          </div>
        );
      })()}
      {dues.map(s => { const d = daysLeft(s.item.dueDate, today); return <div key={s.item.id} className="dr-block"><b>{s.item.title}</b><Chip tone={d <= 3 ? "warn" : ""}>{d < 0 ? "期限切れ" : `あと ${d} 日`}</Chip></div>; })}

      <div className="tc-grid">
        <div className="tc-l">
          <Card className="pad tl-res">
            <div className="head"><h2 className="h2">単元ごとの練習問題</h2><span className="r"><Chip>{units.length} 単元</Chip></span></div>
            {units.map(u => {
              const isCur = u === cur, op = opened[u.k] ?? isCur, n = u.qs.filter(x => x.done).length, nx = nextOf(u);
              return (
                <div key={u.k} id={`tpu-${u.k}`} className={`tl-u tp-u${op ? " op" : ""}${isCur ? " cur" : ""}`}>
                  <button type="button" className="tl-uh" aria-expanded={op} onClick={() => setOpened(m => ({ ...m, [u.k]: !op }))}>
                    <span className="eyebrow">{u.ui >= 0 ? `単元 ${u.ui + 1}` : "問題集"}</span><b>{u.title}</b>{isCur && <Chip tone="co">今の単元</Chip>}
                    <span className="tl-us"><span>{u.qs.length} 問</span><span className={n < u.qs.length ? "ng" : ""}>できた <b className="num">{n} / {u.qs.length}</b></span><i aria-hidden="true" className={op ? "up" : ""}><Icon k="down" size={14} /></i></span>
                  </button>
                  {op && (
                    <div className="tp-uo">
                      <div className="tp-row"><Sum n={n} of={u.qs.length} />{nx ? <Btn kind={isCur ? "sm" : "ghost sm"} onClick={() => go(nx)}>{startLabel(u)}</Btn> : <Chip tone="ok">✓ 全問できた</Chip>}<Btn kind="ghost sm" onClick={() => go(u.qs[0])}>まとめて開く</Btn></div>
                      <div className="tp-qs">
                        {u.qs.map(x => (
                          <button key={`${x.setId}:${x.q.id}`} type="button" className={`tp-q${x.done ? " dn" : ""}`} onClick={() => go(x)}>
                            <span className="tp-ck" aria-hidden="true">{x.done ? "✓" : x.q.n}</span>
                            <span><b>問題 {x.q.n}</b><small>{x.q.title}</small></span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </div>
        <Card className="pad tl-side">
          <div className="head"><h2 className="h2">全体の進み</h2></div>
          <div className="tp-sum">
            <Ring n={dn} of={tot} cat="tst" />
            <div className="tp-ub">{units.map(u => { const n = u.qs.filter(x => x.done).length; return <div key={u.k}><span>{u.title}</span><span className="tp-bar sm"><i style={{ "--w": `${Math.round(n / u.qs.length * 100)}%` }} /></span><b className="num">{n} / {u.qs.length}</b></div>; })}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
