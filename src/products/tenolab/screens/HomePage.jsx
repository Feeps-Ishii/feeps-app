import React, { useEffect, useMemo, useRef, useState } from "react";
import { Jp } from "../textFlow.jsx";
import { THUMBS } from "../thumbs.js";
import { COURSES, COURSE_ID, GOALS, LV, MISSION, SKILLS, UNITS, courseProgress, isPlayable } from "../tenolabData.js";

const FEEPS_ONE = "/index.html";

function Thumb({ id, small }) {
  const html = THUMBS[id] ? THUMBS[id]() : "";
  return small
    ? <span className="mini" dangerouslySetInnerHTML={{ __html: html }} />
    : <span style={{ display: "block" }} dangerouslySetInnerHTML={{ __html: html }} />;
}

const TABS = [["home", "ホーム"], ["find", "コースをさがす"], ["devlab", "開発演習"], ["cloud", "クラウド実習"], ["made", "つくったもの"]];

// 今週（月曜はじまり）の各日に、どれだけ触ったか。記録の更新日時から数える
function weekOf(items) {
  const now = new Date();
  const monday = new Date(now); monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const it of items || []) {
    const t = it.updatedAt ? new Date(it.updatedAt) : null;
    if (!t || t < monday) continue;
    const d = Math.floor((t - monday) / 86400000);
    if (d >= 0 && d < 7) days[d] += Math.max(1, it.minutes || 0);
  }
  const today = (now.getDay() + 6) % 7;
  return { days, today };
}

export default function HomePage({ tab, onTab, onGo, name, progressState, items, onRetry, onLogout }) {
  const [filter, setFilter] = useState("all");
  const [goal, setGoal] = useState("");
  const [menu, setMenu] = useState(false);
  const pr = useMemo(() => courseProgress(items), [items]);

  const header = (
    <header className="ah">
      <div className="wrap ah-in">
        <a className="logo" href="#/home" onClick={e => { e.preventDefault(); onTab("home"); }} aria-label="ホームへ">
          <span className="w">テノ<span className="sw">ラボ</span></span>
        </a>
        <nav className="ah-tabs" role="tablist" aria-label="メニュー">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => onTab(k)}>{label}</button>
          ))}
        </nav>
        <span className="sp" />
        <div className="me">
          <button type="button" aria-expanded={menu} aria-controls="tlMe" aria-label="アカウント" onClick={() => setMenu(v => !v)}>{(name || "？").charAt(0)}</button>
          {menu && (
            <div className="me-menu" id="tlMe">
              <div className="who"><b>{name}</b><span><Jp>Feeps One と同じアカウント</Jp></span></div>
              <hr />
              <a href={FEEPS_ONE} style={{ fontWeight: 700, textDecoration: "none" }}>Feeps One を開く</a>
              <hr />
              <button type="button" onClick={onLogout}>ログアウト</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );

  let body;
  if (progressState === "loading") {
    body = <div className="hb"><p className="wk-note" role="status">記録を読み込んでいます…</p></div>;
  } else if (progressState === "error") {
    body = (
      <div className="hb">
        <div className="info" role="alert">記録を読み込めませんでした。通信状況を確かめて、もう一度読み込んでください。進み具合は消えていません。</div>
        <div><button className="btn btn-sec" type="button" onClick={onRetry}>もう一度読み込む</button></div>
      </div>
    );
  } else if (tab === "find") body = <FindPane filter={filter} setFilter={setFilter} goal={goal} setGoal={setGoal} pr={pr} onGo={onGo} />;
  else if (tab === "devlab" || tab === "cloud") body = null;
  else if (tab === "made") body = <MadePane pr={pr} onGo={onGo} />;
  else body = <HomePane name={name} pr={pr} items={items} onGo={onGo} onTab={onTab} />;

  return (
    <div className="tl-app tl-home" onClick={e => { if (menu && !e.target.closest(".me")) setMenu(false); }}>
      {header}
      {(tab === "devlab" || tab === "cloud") && progressState !== "loading" && progressState !== "error"
        ? <EmbeddedPane which={tab === "cloud" ? "cloudlab" : "devlab"} />
        : <div className="wrap">{body}</div>}
    </div>
  );
}

function StepsBar({ steps, at }) {
  return (
    <div className="st5">
      <div className="st5-bars" aria-hidden="true">
        {steps.map((s, i) => <i key={i} className={i < at ? "on" : i === at ? "now" : ""} title={s} />)}
      </div>
      <div className="st5-l">ステップ <b>{Math.min(at + 1, steps.length)} / {steps.length}</b>「{steps[Math.min(at, steps.length - 1)]}」から</div>
    </div>
  );
}

function AppNow({ done }) {
  const lines = [["受講生の数: 5"], ["合計: 389"], ["平均: 77.8"], ["最高点: 90"]];
  return (
    <div className="brw">
      <div className="brw-bar"><i /><i /><i /><span><Jp>score-dashboard</Jp></span></div>
      <div className="ghost" aria-hidden="true">
        <div className="gh"><span>見出し</span><span>単元5</span></div>
        <div className="gh-row"><div className="gh">数字</div><div className="gh">数字</div><div className="gh">数字</div><div className="gh">単元6</div></div>
        <div className="gh tall"><span>受講生の表</span><span>単元7</span></div>
      </div>
      <div className="con">
        <div className="h">コンソール</div>
        <div><span className="g">1</span><span>点数: 72</span></div>
        {lines.map((l, i) => (
          <div key={i}><span className="g">{i + 2}</span>{done >= 2
            ? <span className={done === 2 ? "new" : ""}>{l[0]}</span>
            : <span className="todo">{l[0]}<em>単元2で出ます</em></span>}</div>
        ))}
      </div>
    </div>
  );
}

function HomePane({ name, pr, items, onGo, onTab }) {
  const next = pr.next;
  const ms = next ? MISSION[next.id] : null;
  const playable = next && isPlayable(COURSE_ID, next.id);
  const saved = next ? pr.byUnit[next.id] : null;
  const at = saved && ms ? Math.min(saved.step || 0, ms.steps.length - 1) : 0;
  let left = 0;
  for (let i = pr.done; i < UNITS.length; i++) left += UNITS[i].min;
  const wk = weekOf(items);
  const wkMin = wk.days.reduce((s, x) => s + x, 0);
  const wkDays = wk.days.filter(x => x > 0).length;
  const names = ["月", "火", "水", "木", "金", "土", "日"];

  return (
    <div className="hb">
      <HomeCarousel pr={pr} next={next} playable={playable} saved={saved} onGo={onGo} onTab={onTab} />

      {next && (
        <section className="cont" aria-labelledby="tlCont">
          <div className="cont-l">
            <div className="cont-k"><span className="tag lv1">つづきから</span><span>点数ダッシュボードを作ろう ・ 単元 {pr.done + 1} / {pr.total}{ms ? " ・ " + ms.chap : ""}</span></div>
            <h2 id="tlCont">{next.t}</h2>
            {ms && (
              <div className="ms">
                <div className="ms-row"><span className="ms-k">やること</span><span>{ms.todo}</span></div>
                <div className="ms-row"><span className="ms-k">合格の条件</span><span>出力に {ms.pass.map((p, i) => <React.Fragment key={i}>{i > 0 && " と "}<code>{p}</code></React.Fragment>)} が出れば合格</span></div>
              </div>
            )}
            {ms && <StepsBar steps={ms.steps} at={at} />}
            <div className="row">
              {playable
                ? <a className="btn btn-pri" href={`#/units/${COURSE_ID}/${next.id}`} onClick={e => { e.preventDefault(); onGo(`unit:${COURSE_ID}:${next.id}`); }}>
                    <svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0l10 6-10 6z" fill="currentColor" /></svg>{saved ? "続きをはじめる" : "はじめる"}</a>
                : <span className="btn btn-sec" aria-disabled="true" style={{ opacity: .6, cursor: "not-allowed" }}>単元{pr.done + 1}は準備中</span>}
              <a className="btn btn-sec" href={`#/courses/${COURSE_ID}`} onClick={e => { e.preventDefault(); onGo(`course:${COURSE_ID}`); }}>コースマップ</a>
              <span className="min">約{next.min}分 ・ 完成まで残り約{Math.floor(left / 60)}時間{left % 60 ? `${left % 60}分` : ""}</span>
            </div>
          </div>
          <div className="cont-r">
            <div className="cr-h">あなたのアプリ<span>いまの姿</span></div>
            <AppNow done={pr.done} />
            <p className="cr-note">{pr.done >= 2 ? <>単元2で<b>4行</b>が加わりました。次の単元で、計算を何度でも使い回せるようになります。</> : <>単元2を終えると、コンソールに<b>4行</b>が加わります。点線の部品は第2章から形になります。</>}</p>
          </div>
        </section>
      )}

      <div className="row2">
        <section className="panel" aria-labelledby="tlWk">
          <h3 id="tlWk">今週の記録</h3>
          <div className="week" role="img" aria-label="今週、学んだ分数">
            {wk.days.map((m, i) => {
              const later = i > wk.today;
              const cls = later ? "later" : m === 0 ? "none" : m >= 25 ? "l2" : "l1";
              return <div key={i} className={"day" + (i === wk.today ? " today" : "")}><span className={"cell " + cls}>{m > 0 ? m : ""}</span>{names[i]}</div>;
            })}
          </div>
          <div className="wk-sum"><span><b className="num">{wkMin}</b>分</span><span><b className="num">{wkDays}</b>日</span></div>
          <p className="wk-note">{wk.days[wk.today] > 0 ? "今日も手を動かしました。" : "今日はまだ学んでいません。20分で1単元終わります。"}</p>
        </section>
        <section className="panel" aria-labelledby="tlMine">
          <h3 id="tlMine">学習中のコース</h3>
          <div className="clist">
            <a className="ci" href={`#/courses/${COURSE_ID}`} onClick={e => { e.preventDefault(); onGo(`course:${COURSE_ID}`); }}>
              <Thumb id="dash" small />
              <span className="ci-b"><span className="ci-t">点数ダッシュボードを作ろう</span>
                <span className="ci-s num">{pr.done} / {pr.total} 単元</span>
                <span className="pbar"><i style={{ width: (pr.done / pr.total * 100).toFixed(1) + "%" }} /></span></span>
              <span className="ci-go">開く →</span>
            </a>
          </div>
        </section>
      </div>

      <section>
        <div className="sh"><h2>ほかのコース</h2><button className="lnk" type="button" onClick={() => onTab("find")}>コースをぜんぶ見る</button>
          <p><Jp>いま中身まで触れるのは「点数ダッシュボードを作ろう」です。ほかのコースは順に開きます。</Jp></p></div>
        <div className="courses">{["quiz", "todo", "nippo"].map(id => <CourseCard key={id} id={id} pr={pr} onGo={onGo} />)}</div>
      </section>
    </div>
  );
}

function CourseCard({ id, pr, onGo }) {
  const c = COURSES.find(x => x.id === id);
  const lv = LV[c.lv];
  const doing = c.open && pr.done > 0;
  return (
    <a className="course" href={c.open ? `#/courses/${c.id}` : "#/find"} aria-disabled={!c.open || undefined}
      onClick={e => { e.preventDefault(); if (c.open) onGo(`course:${c.id}`); }}
      style={c.open ? undefined : { cursor: "default" }}>
      <Thumb id={c.id} />
      <span className="c-body">
        <span className="c-tags"><span className={"tag " + lv[0]}>{lv[1]}</span><span className="tag">{c.lang}</span>
          {doing ? <span className="tag doing num">学習中 {pr.done}/{pr.total}</span> : !c.open ? <span className="tag">準備中</span> : null}</span>
        <h3>{c.t}</h3><p><Jp>{c.d}</Jp></p>
        {doing && <span className="c-prog" aria-hidden="true"><i style={{ width: (pr.done / pr.total * 100).toFixed(1) + "%" }} /></span>}
        <span className="c-meta"><span><b>{c.units}</b> 単元</span><span>約 <b>{c.h}</b> 時間</span><span className="c-open">{c.open ? (doing ? "続きから →" : "単元を見る →") : "準備中"}</span></span>
      </span>
    </a>
  );
}

function FindPane({ filter, setFilter, goal, setGoal, pr, onGo }) {
  const list = COURSES.filter(c => {
    if (goal && c.goal !== goal) return false;
    if (filter === "all") return true;
    if (filter === "doing") return c.open && pr.done > 0;
    if (filter === "lv1") return c.lv === 1;
    return c.lang === filter;
  });
  const chips = [["all", "すべて"], ["doing", "学習中"], ["lv1", "はじめて"], ["Web", "Web"], ["Java", "Java"], ["AWS", "AWS"]];
  return (
    <div className="hb">
      <div className="greet"><div><h1>コースをさがす</h1><p><Jp>どのコースも、単元を進めるたびに1本のアプリが育っていきます。</Jp></p></div></div>
      <section>
        <div className="sh"><h2>目標から選ぶ</h2><p><Jp>なりたい姿を選ぶと、そこまでのコースだけに絞ります。もう一度押すと外れます。</Jp></p></div>
        <div className="goals">
          {GOALS.map(g => (
            <button key={g.id} className="goal-c" type="button" aria-pressed={goal === g.id} onClick={() => setGoal(goal === g.id ? "" : g.id)}>
              <b>{g.t}</b><span>{g.s}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <div className="sh"><h2>{goal ? "目標までのコース" : "すべてのコース"}</h2></div>
        <div className="filters" role="group" aria-label="絞り込み">
          {chips.map(([k, l]) => <button key={k} className="fchip" type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        {list.length
          ? <div className="courses">{list.map(c => <CourseCard key={c.id} id={c.id} pr={pr} onGo={onGo} />)}</div>
          : <p className="wk-note"><Jp>この組み合わせに合うコースはありません。絞り込みを「すべて」に戻してください。</Jp></p>}
      </section>
    </div>
  );
}

function MadePane({ pr, onGo }) {
  const done = pr.done;
  return (
    <div className="hb">
      <div className="greet"><div><h1>つくったもの</h1><p><Jp>いま作っているアプリと、身についたことです。コースを修了すると、ここに作品と修了証が並びます。</Jp></p></div></div>
      <section>
        <div className="sh"><h2>身についたこと</h2><p><Jp>単元をクリアすると増えます。</Jp></p></div>
        <div className="skills" style={{ marginTop: 14 }}>
          {SKILLS.map(s => {
            const got = pr.cleared.has(s.unit);
            const unit = UNITS.find(u => u.id === s.unit);
            return (
              <div key={s.name} className="sk">
                <b>{s.name}</b>
                <div className="lv" role="img" aria-label={got ? "身についた" : "まだ"}><i className={got ? "on" : ""} /><i /><i /><i /></div>
                <span>{got ? "身についた場所：" : "まだ。"}単元{unit.id.slice(1)}「{unit.t}」{got ? "" : "で身につきます"}</span>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <div className="sh"><h2>アプリ</h2></div>
        <div className="shelf">
          <article className="made">
            <div className="prog-ov" data-left={`あと${pr.total - done}単元`}><Thumb id="dash" /></div>
            <div className="made-b">
              <span className="tag doing num" style={{ justifySelf: "start" }}>制作中 ・ {done} / {pr.total}</span>
              <span className="t">点数ダッシュボード</span>
              <span className="s">完成するとこうなります。いまはコンソールに{done >= 2 ? "5" : "1"}行出ています。</span>
              <div className="made-a"><a className="btn btn-sm btn-sec" href={`#/courses/${COURSE_ID}`} onClick={e => { e.preventDefault(); onGo(`course:${COURSE_ID}`); }}>コースマップで見る</a></div>
            </div>
          </article>
          <div className="made empty"><div><b>修了したアプリはまだありません</b>コースを最後まで終えると、ここに並び、修了証も出ます。</div></div>
        </div>
      </section>
    </div>
  );
}

/* 開発演習・クラウド実習。見た目をテノラボに置き換えるまでは、今の画面を別の入口（lab-embed.html）で
   はめ込む。Tailwind の見た目がテノラボ側に混ざらないよう、iframe で分けている（ADR 0022） */
function EmbeddedPane({ which }) {
  const label = which === "cloudlab" ? "クラウド実習" : "開発演習";
  return (
    <div className="embed-wrap">
      <div className="wrap embed-note"><b>{label}</b><span>中身はいまの{label}です。見た目は順にテノラボに置き換えます。</span></div>
      {/* key を変えて枠ごと作り直す（# の後ろだけ変えても、枠の中は読み込み直されない） */}
      <iframe key={which} className="embed-frame" title={label} src={`/lab-embed.html#${which}`} />
    </div>
  );
}

/* ホームの上の、自動で切り替わる画面。続きの単元・アプリの今・ほかの場所を順に見せる。
   触れている間と、動きを減らす設定のときは止める */
function HomeCarousel({ pr, next, playable, saved, onGo, onTab }) {
  const slides = [];
  if (next && playable) {
    const ms = MISSION[next.id];
    slides.push({
      key: "next", k: saved ? "つづきから" : "次の単元", title: next.t,
      text: (ms ? ms.todo + "。" : "") + "約" + next.min + "分。",
      cta: saved ? "続きをはじめる" : "はじめる", on: () => onGo(`unit:${COURSE_ID}:${next.id}`), thumb: "dash", tone: "y",
    });
  }
  slides.push({
    key: "app", k: "あなたのアプリ", title: pr.done >= 2 ? "コンソールに4行が加わりました" : "単元2で、4つの数字が出るようになります",
    text: "点数ダッシュボードは、単元を終えるたびに部品が増えていきます。いまの姿をコースマップで見られます。",
    cta: "コースマップを見る", on: () => onGo(`course:${COURSE_ID}`), thumb: "dash", tone: "w",
  });
  slides.push({
    key: "devlab", k: "開発演習", title: "コースで覚えたことを、案件で使う",
    text: "現場に近い案件を、ひとりで、またはチームで最後まで作ります。",
    cta: "開発演習を開く", on: () => onTab("devlab"), thumb: "attend", tone: "b",
  });
  slides.push({
    key: "cloud", k: "クラウド実習", title: "本物のAWSの前に、模型でつかむ",
    text: "わざと「通らない」を体験してから直すので、理由まで分かります。",
    cta: "クラウド実習を開く", on: () => onTab("cloud"), thumb: "aws", tone: "m",
  });

  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const reduced = useRef(!!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches));
  const n = slides.length;
  useEffect(() => {
    if (hold || reduced.current || n < 2) return undefined;
    const t = setTimeout(() => setI(v => (v + 1) % n), 6000);
    return () => clearTimeout(t);
  }, [i, hold, n]);
  const idx = Math.min(i, n - 1);
  const cur = slides[idx];

  return (
    <section className="car" aria-roledescription="カルーセル" aria-label="おすすめ"
      onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)} onBlur={() => setHold(false)}>
      <div className={"car-slide tone-" + cur.tone} key={cur.key} aria-live="polite">
        <div className="car-l">
          <span className="car-k">{cur.k}</span>
          <h2>{cur.title}</h2>
          <p><Jp>{cur.text}</Jp></p>
          <div><button className="btn btn-pri" type="button" onClick={cur.on}>{cur.cta}</button></div>
        </div>
        <div className="car-r" aria-hidden="true"><Thumb id={cur.thumb} /></div>
      </div>
      <div className="car-nav">
        <button type="button" className="car-arrow" aria-label="前へ" onClick={() => setI((idx - 1 + n) % n)}>‹</button>
        {slides.map((sl, k) => (
          <button key={sl.key} type="button" className="car-dot" aria-label={`${k + 1}枚目：${sl.k}`} aria-current={k === idx || undefined} onClick={() => setI(k)} />
        ))}
        <button type="button" className="car-arrow" aria-label="次へ" onClick={() => setI((idx + 1) % n)}>›</button>
      </div>
    </section>
  );
}
