import React, { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../../api.js";
import { SAMPLE_COURSE, SAMPLE_UNITS } from "../samples/dashSample.js";
import { blankUnit, errText, nextUnitId } from "./studioModel.js";
import UnitEditor from "./UnitEditor.jsx";

/* 単元づくり（講師・管理者）。ADR 0022
   #/studio              コース管理
   #/studio/{c}          コースの編集（章と単元の並び・公開）
   #/studio/{c}/{u}      単元づくり（下書き → 受講生として試す → 公開） */
export default function StudioPage({ courseId, unitId, role, onGo, setToast }) {
  let body;
  if (courseId && unitId) body = <UnitEditor courseId={courseId} unitId={unitId} setToast={setToast} onGo={onGo} />;
  else if (courseId) body = <CourseEdit courseId={courseId} setToast={setToast} />;
  else body = <CourseList role={role} setToast={setToast} />;
  return (
    <div className="tl-app" style={{ minHeight: "100vh" }}>
      <header className="ah">
        <div className="wrap ah-in">
          <a className="logo" href="#/home" aria-label="ホームへ"><span className="w">テノ<span className="sw">ラボ</span></span></a>
          <span className="rolechip">単元づくり</span>
          <span className="sp" />
          <a className="btn btn-sm btn-sec" href="#/home">受講生の画面</a>
        </div>
      </header>
      <div className="wrap ad-body">{body}</div>
    </div>
  );
}

function Loading({ what }) {
  return <p className="wk-note" role="status">{what}を読み込んでいます…</p>;
}

function LoadError({ what, onRetry }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="info" role="alert">{what}を読み込めませんでした。通信状況を確かめて、もう一度読み込んでください。</div>
      <div><button className="btn btn-sec" type="button" onClick={onRetry}>もう一度読み込む</button></div>
    </div>
  );
}

/* ---------- コース管理 ---------- */
function CourseList({ role, setToast }) {
  const [st, setSt] = useState({ state: "loading", items: [] });
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null); // 新しいコース { id, title }
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setSt(s => ({ ...s, state: "loading" }));
    try {
      const res = await apiGet("/tenolab/courses?draft=1");
      setSt({ state: "ready", items: res.items || [] });
    } catch (e) {
      console.warn("tenolab courses load failed", e);
      setSt({ state: "error", items: [] });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function importSample() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setArmed(false); setBusy(true); setErr("");
    try {
      await apiPost("/tenolab/import", { course: SAMPLE_COURSE, units: Object.values(SAMPLE_UNITS.dash), publish: true });
      setToast("見本のコースを取り込みました");
      load();
    } catch (e) {
      setErr(errText(e, "取り込めませんでした。"));
    } finally { setBusy(false); }
  }

  async function createCourse(e) {
    e.preventDefault();
    const id = form.id.trim();
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) { setErr("コースの記号は、半角の英小文字・数字・ハイフンで40文字までです。"); return; }
    if (!form.title.trim()) { setErr("コースの名前を入れてください。"); return; }
    if (st.items.some(c => c.courseId === id)) { setErr("その記号のコースはもうあります。"); return; }
    setBusy(true); setErr("");
    try {
      await apiPut(`/tenolab/courses/${id}`, { title: form.title.trim(), lv: 1, lang: "Web", hours: 3, status: "draft", chapters: [{ no: 1, title: "はじめの章", sub: "", units: [] }] });
      window.location.hash = `#/studio/${id}`;
    } catch (e2) {
      setErr(errText(e2, "コースを作れませんでした。"));
    } finally { setBusy(false); }
  }

  const pub = st.items.filter(c => c.status === "published").length;
  return (
    <>
      <div className="ad-head">
        <div>
          <h1>コース管理</h1>
          {st.state === "ready" && <ul className="kw sm"><li className="m">公開中 {pub}</li><li>下書き {st.items.length - pub}</li></ul>}
        </div>
        <div className="acts">
          {role === "admin" && (
            <button className="btn btn-sec" type="button" onClick={importSample} disabled={busy}>
              {armed ? "もう一度押すと取り込みます" : "見本を取り込む"}
            </button>
          )}
          <button className="btn btn-pri" type="button" onClick={() => { setForm({ id: "", title: "" }); setErr(""); }}>新しいコース</button>
        </div>
      </div>
      {err && <div className="issues" role="alert"><b>{err}</b></div>}
      {form && (
        <form className="box" onSubmit={createCourse} style={{ maxWidth: 560 }}>
          <h3>新しいコース</h3>
          <div className="fld2"><label htmlFor="ncT">コースの名前</label><input className="in" id="ncT" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="fld2"><label htmlFor="ncId">記号（URLに使う・あとから変えられない）</label><input className="in mono" id="ncId" value={form.id} placeholder="quiz" onChange={e => setForm({ ...form, id: e.target.value })} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-sm btn-pri" type="submit" disabled={busy}>作る</button>
            <button className="btn btn-sm btn-sec" type="button" onClick={() => setForm(null)}>やめる</button>
          </div>
        </form>
      )}
      {st.state === "loading" && <Loading what="コース" />}
      {st.state === "error" && <LoadError what="コース" onRetry={load} />}
      {st.state === "ready" && (st.items.length ? (
        <div className="ad-wrap">
          <table className="ad-table wide">
            <thead><tr><th>コース</th><th>状態</th><th className="num">単元</th><th></th></tr></thead>
            <tbody>
              {st.items.map(c => (
                <tr key={c.courseId}>
                  <td><a className="ct" href={`#/studio/${c.courseId}`}>{c.title || c.courseId}</a><div className="cs">{c.lang} ・ {c.courseId}</div></td>
                  <td>{c.status === "published" ? <span className="chip pub">公開中</span> : <span className="chip draft">下書き</span>}</td>
                  <td className="num">{(c.chapters || []).reduce((n, ch) => n + ch.units.length, 0)}</td>
                  <td><a className="btn btn-sm btn-sec" href={`#/studio/${c.courseId}`}>編集</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="hold-box"><span className="chip hold">コースなし</span><ul className="kw sm" style={{ margin: 0 }}>{role === "admin" ? <><li className="m">見本を取り込む</li><li>新しいコース</li></> : <li className="m">新しいコース</li>}</ul></div>
      ))}
    </>
  );
}

/* ---------- コースの編集 ---------- */
function CourseEdit({ courseId, setToast }) {
  const [st, setSt] = useState({ state: "loading", course: null, units: [] });
  const [draft, setDraft] = useState(null); // 画面で直しているコース
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(null); // { chapter, title }

  const load = useCallback(async () => {
    setSt(s => ({ ...s, state: "loading" }));
    try {
      const res = await apiGet(`/tenolab/courses/${courseId}?draft=1`);
      setSt({ state: "ready", course: res.course, units: res.units || [] });
      setDraft(res.course);
    } catch (e) {
      console.warn("tenolab course load failed", e);
      setSt({ state: e?.status === 404 ? "missing" : "error", course: null, units: [] });
    }
  }, [courseId]);
  useEffect(() => { load(); }, [load]);

  if (st.state === "loading") return <Loading what="コース" />;
  if (st.state === "missing") return <div className="info" role="alert">このコースはありません。<a href="#/studio">コース管理へ</a></div>;
  if (st.state === "error" || !draft) return <LoadError what="コース" onRetry={load} />;

  const byId = Object.fromEntries(st.units.map(u => [u.id, u]));
  const all = draft.chapters.flatMap(c => c.units);
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  const setChapter = (i, patch) => setDraft(d => ({ ...d, chapters: d.chapters.map((c, k) => (k === i ? { ...c, ...patch } : c)) }));

  async function saveCourse(next, msg) {
    setBusy(true); setErr("");
    try {
      const res = await apiPut(`/tenolab/courses/${courseId}`, next);
      setDraft(res.course);
      setSt(s => ({ ...s, course: res.course }));
      if (msg) setToast(msg);
      return true;
    } catch (e) {
      setErr(errText(e, "保存できませんでした。"));
      return false;
    } finally { setBusy(false); }
  }

  function move(ci, ui, dir) {
    const units = [...draft.chapters[ci].units];
    const j = ui + dir;
    if (j < 0 || j >= units.length) return;
    [units[ui], units[j]] = [units[j], units[ui]];
    setChapter(ci, { units });
  }

  async function addUnit(e) {
    e.preventDefault();
    if (!adding.title.trim()) { setErr("単元の名前を入れてください。"); return; }
    const id = nextUnitId(draft.chapters);
    const chapters = draft.chapters.map((c, k) => (k === adding.chapter ? { ...c, units: [...c.units, id] } : c));
    setBusy(true); setErr("");
    try {
      await apiPut(`/tenolab/courses/${courseId}/units/${id}`, { unit: blankUnit(id, adding.title.trim()), baseUpdatedAt: "" });
      await apiPut(`/tenolab/courses/${courseId}`, { ...draft, chapters });
      window.location.hash = `#/studio/${courseId}/${id}`;
    } catch (e2) {
      setErr(errText(e2, "単元を足せませんでした。"));
      setBusy(false);
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(st.course);
  const published = st.course.status === "published";
  return (
    <>
      <div className="crumb"><a href="#/studio">コース管理</a> ／ {st.course.title || courseId}</div>
      <div className="ad-head">
        <div>
          <h1>{draft.title || courseId}</h1>
          <ul className="kw sm"><li className="m">{all.length}単元</li><li>約{draft.hours}時間</li>{draft.appName && <li>{draft.appName}</li>}</ul>
        </div>
        <div className="acts">
          <a className="btn btn-sec" href={`#/courses/${courseId}`}>受講生として見る</a>
          <button className="btn btn-sec" type="button" disabled={busy || !dirty} onClick={() => saveCourse(draft, "コースを保存しました")}>保存</button>
          {published
            ? <button className="btn btn-sec" type="button" disabled={busy} onClick={() => saveCourse({ ...draft, status: "draft" }, "コースを非公開にしました")}>非公開にする</button>
            : <button className="btn btn-pri" type="button" disabled={busy} onClick={() => saveCourse({ ...draft, status: "published" }, "コースを公開しました")}>コースを公開</button>}
        </div>
      </div>
      {err && <div className="issues" role="alert"><b>{err}</b></div>}
      <div className="ce">
        <div>
          {draft.chapters.map((c, ci) => (
            <section className="chap" key={ci}>
              <div className="chap-h"><span className="chip draft">第{c.no}章</span><b>{c.title}</b><span>{c.sub}</span></div>
              {c.units.map((id, ui) => {
                const u = byId[id];
                const n = all.indexOf(id) + 1;
                const chip = !u ? <span className="chip hold">未作成</span>
                  : !u.published ? <span className="chip draft">下書き</span>
                  : u.changed ? <span className="chip edit">変更あり</span> : <span className="chip pub">公開中</span>;
                return (
                  <div className="urow" key={id} style={{ gridTemplateColumns: "auto 34px minmax(0,1fr) auto auto" }}>
                    <span style={{ display: "grid" }}>
                      <button type="button" className="lnk" aria-label={`単元${n}を上へ`} onClick={() => move(ci, ui, -1)} disabled={ui === 0}>▲</button>
                      <button type="button" className="lnk" aria-label={`単元${n}を下へ`} onClick={() => move(ci, ui, 1)} disabled={ui === c.units.length - 1}>▼</button>
                    </span>
                    <span className="n">{n}</span>
                    <a href={`#/studio/${courseId}/${id}`} style={{ textDecoration: "none" }}>
                      <span className="t">{u ? u.title || "（名前なし）" : id}</span>
                      <span className="s">{u ? `約${u.minutes}分 ・ ${u.steps}ステップ` : "開いて作る"}</span>
                    </a>
                    <span />
                    {chip}
                  </div>
                );
              })}
              {adding?.chapter === ci ? (
                <form onSubmit={addUnit} style={{ display: "flex", gap: 8, padding: "10px 14px", flexWrap: "wrap" }}>
                  <label className="sr" htmlFor={`au${ci}`}>単元の名前</label>
                  <input className="in" id={`au${ci}`} autoFocus placeholder="単元の名前" value={adding.title} onChange={e => setAdding({ ...adding, title: e.target.value })} style={{ flex: "1 1 220px" }} />
                  <button className="btn btn-sm btn-pri" type="submit" disabled={busy}>足す</button>
                  <button className="btn btn-sm btn-sec" type="button" onClick={() => setAdding(null)}>やめる</button>
                </form>
              ) : (
                <button className="add-u" type="button" onClick={() => setAdding({ chapter: ci, title: "" })}>＋ この章に単元を足す</button>
              )}
            </section>
          ))}
          <button className="btn btn-sm btn-sec" type="button" style={{ marginTop: 14 }}
            onClick={() => set({ chapters: [...draft.chapters, { no: draft.chapters.length + 1, title: "新しい章", sub: "", units: [] }] })}>＋ 章を足す</button>
        </div>
        <div className="side">
          <div className="box">
            <h3>コースの設定</h3>
            <div className="fld2"><label htmlFor="cT">コースの名前</label><input className="in" id="cT" value={draft.title} onChange={e => set({ title: e.target.value })} /></div>
            <div className="fld2"><label htmlFor="cApp">完成するアプリ</label><input className="in" id="cApp" value={draft.appName} onChange={e => set({ appName: e.target.value })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div className="fld2"><label htmlFor="cLv">レベル</label>
                <select className="in" id="cLv" value={draft.lv} onChange={e => set({ lv: Number(e.target.value) })}><option value={1}>はじめて</option><option value={2}>基礎</option><option value={3}>実務</option></select></div>
              <div className="fld2"><label htmlFor="cLang">言語</label><input className="in" id="cLang" value={draft.lang} onChange={e => set({ lang: e.target.value })} /></div>
              <div className="fld2"><label htmlFor="cH">時間</label><input className="in" id="cH" type="number" min={1} max={200} value={draft.hours} onChange={e => set({ hours: Number(e.target.value) })} /></div>
            </div>
            <div className="fld2"><label htmlFor="cKw">キーワード（カンマ区切り）</label><input className="in" id="cKw" value={draft.keywords.join(", ")} onChange={e => set({ keywords: e.target.value.split(/[,、]/).map(x => x.trim()).filter(Boolean) })} /></div>
          </div>
          <div className="box">
            <h3>章</h3>
            {draft.chapters.map((c, ci) => (
              <div key={ci} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 8 }}>
                <input className="in" aria-label={`第${c.no}章の名前`} value={c.title} onChange={e => setChapter(ci, { title: e.target.value })} />
                <input className="in" aria-label={`第${c.no}章のサブ`} value={c.sub} placeholder="JavaScript" onChange={e => setChapter(ci, { sub: e.target.value })} />
              </div>
            ))}
            <ul className="kw sm" style={{ margin: 0 }}><li className={published ? "m" : ""}>{published ? "公開中" : "下書き"}</li><li>{dirty ? "保存していない変更あり" : "保存済み"}</li></ul>
          </div>
        </div>
      </div>
    </>
  );
}
