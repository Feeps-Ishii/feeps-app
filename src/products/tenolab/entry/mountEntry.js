/* 入口（紹介・ログイン・Javaを少しだけ体験・お見積り）の動き。
   もとは gen_entry.py で包んだモックのスクリプト（mountEntry.base.js）。ここが正本で、次を手直ししてある：
   - 画面の切り替えはアプリの URL（#/ #/login #/try #/quote）で行い、hashchange で show() する
   - ログインは本番の認証（OPTS.auth）、お見積りは本番の API（OPTS.submitInquiry）
   - 外すときに、window のリスナー・監視・タイマー・自動再生を止める（CLEANUP）
   - ログインのあとで入れない人（研修のみの契約）には、onLoggedIn が文言を返し、ログインの画面に出す。
     はじめから出す文言は OPTS.loginError
   OPTS = { auth, onLoggedIn, submitInquiry, loginError } */
export function mountEntry(root, OPTS) {
OPTS = OPTS || {};
const CLEANUP = [];

/* ---------- 単元（紹介ページ） ---------- */
const TOPICS = [
  { id: "web", name: "Web制作", sub: "HTML / CSS", color: "#F2C200", soft: "#FFF7C2", meta: "入門は無料 ・ 続きは Pro", free: true },
  { id: "js", name: "JavaScript", sub: "JavaScript", color: "#2457E6", soft: "#E8EEFD", meta: "入門は無料 ・ 続きは Pro", free: true },
  { id: "db", name: "データベース", sub: "SQL", color: "#11966F", soft: "#E3F5EE", meta: "入門は無料 ・ 続きは Pro", free: true },
  { id: "java", name: "Java", sub: "Java", color: "#D9483B", soft: "#FBE9E7", meta: "Pro ・ その場で実行" },
  { id: "cloud", name: "AWS", sub: "クラウド", color: "#F29A38", soft: "#FFF1E2", meta: "模擬ラボは無料 ・ 本物は Pro", free: true },
];
const ICON = {
  spring: c => `<svg viewBox="0 0 64 64"><path d="M48 14c-18 0-32 10-32 26 0 6 3 10 3 10s4-14 18-20c-10 8-14 16-14 16s22 2 28-14c3-8-3-18-3-18z" fill="${c}" stroke="#15171C" stroke-width="3" stroke-linejoin="round"/></svg>`,
  linux: c => `<svg viewBox="0 0 64 64"><rect x="8" y="12" width="48" height="40" rx="6" fill="${c}" stroke="#15171C" stroke-width="3"/><path d="M18 26l8 6-8 6M30 40h14" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  web: c => `<svg viewBox="0 0 64 64"><rect x="6" y="10" width="52" height="40" rx="5" fill="#fff" stroke="#15171C" stroke-width="3"/><path d="M6 20h52" stroke="#15171C" stroke-width="3"/><rect x="12" y="26" width="18" height="18" rx="2" fill="${c}"/><path d="M36 28h16M36 35h12M36 42h16" stroke="#15171C" stroke-width="3" stroke-linecap="round"/></svg>`,
  js: c => `<svg viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" rx="8" fill="${c}"/><path d="M27 20c-5 0-5 3-5 7s-1 5-4 5c3 0 4 1 4 5s0 7 5 7M37 20c5 0 5 3 5 7s1 5 4 5c-3 0-4 1-4 5s0 7-5 7" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  java: c => `<svg viewBox="0 0 64 64"><path d="M14 28h30v12a12 12 0 0 1-12 12h-6a12 12 0 0 1-12-12z" fill="#fff" stroke="#15171C" stroke-width="3"/><path d="M44 31h4a5 5 0 0 1 0 10h-4" fill="none" stroke="#15171C" stroke-width="3"/><path d="M22 12c-3 4 3 6 0 10M30 10c-3 4 3 6 0 12M38 12c-3 4 3 6 0 10" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/></svg>`,
  db: c => `<svg viewBox="0 0 64 64"><path d="M14 14v34c0 3.3 8 6 18 6s18-2.7 18-6V14" fill="#fff" stroke="#15171C" stroke-width="3"/><ellipse cx="32" cy="14" rx="18" ry="6" fill="${c}" stroke="#15171C" stroke-width="3"/><path d="M14 26c0 3.3 8 6 18 6s18-2.7 18-6M14 38c0 3.3 8 6 18 6s18-2.7 18-6" fill="none" stroke="#15171C" stroke-width="3"/></svg>`,
  git: c => `<svg viewBox="0 0 64 64"><path d="M20 14v36M20 26c0 8 24 4 24 14v2" fill="none" stroke="#15171C" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="14" r="6" fill="#fff" stroke="#15171C" stroke-width="3"/><circle cx="20" cy="50" r="6" fill="#fff" stroke="#15171C" stroke-width="3"/><circle cx="44" cy="46" r="6" fill="${c}" stroke="#15171C" stroke-width="3"/></svg>`,
  cloud: c => `<svg viewBox="0 0 64 64"><path d="M18 46a10 10 0 0 1-1-20 14 14 0 0 1 27-4 11 11 0 0 1 3 24z" fill="#fff" stroke="#15171C" stroke-width="3" stroke-linejoin="round"/><path d="M32 30v14M26 36l6-6 6 6" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
document.getElementById("topic-grid").innerHTML = TOPICS.map(t => `
  <div class="card tile${t.soon ? " soon" : ""}">
    <span class="ti" style="background:${t.soft}">${ICON[t.id](t.color)}</span>
    <span style="display:grid;gap:2px;min-width:0">
      <span style="display:flex;gap:6px;align-items:center"><span class="eyebrow">${t.sub}</span>${t.soon ? '<span class="soonb">準備中</span>' : t.free ? '<span class="free">無料あり</span>' : '<span class="prem">PRO</span>'}</span>
      <h3>${t.name}</h3><span class="meta">${t.meta}</span>
    </span>
  </div>`).join("") + `
  <div class="card tile more"><span class="ti more-ic">＋</span><span style="display:grid;gap:2px;min-width:0"><span class="eyebrow">COMING SOON</span><h3>ほかのコースも続々追加</h3><span class="meta">新しい単元を順次公開</span></span></div>`;

/* ---------- 画面の切り替え（紹介 ⇄ ログイン） ---------- */
const signupView = document.getElementById("signup-view"), bizView = document.getElementById("biz-view"), legalView = document.getElementById("legal-view");
const lp = document.getElementById("lp"), loginView = document.getElementById("login-view"), trialView = document.getElementById("trial-view"), quoteView = document.getElementById("quote-view");
function show(view) {
  // 紹介 ⇄ 法人のページは横にすべらせる（2026-10-19）
  const prevView = lp.hidden ? (bizView.hidden ? "" : "business") : "lp";
  lp.hidden = view !== "lp"; bizView.hidden = view !== "business"; loginView.hidden = view !== "login"; signupView.hidden = view !== "signup";
  document.querySelector(".bar").classList.toggle("is-biz", view === "business");
  const slideEl = view === "business" ? bizView : view === "lp" ? lp : null;
  if (slideEl && prevView && prevView !== view && !REDUCED) { slideEl.classList.remove("slide-l", "slide-r"); void slideEl.offsetWidth; slideEl.classList.add(view === "business" ? "slide-l" : "slide-r"); } trialView.hidden = view !== "trial"; quoteView.hidden = view !== "quote";
  // 規約は1つのページで、# の名前で開く文書を切り替える
  legalView.hidden = view !== "legal";
  if (view === "legal") {
    const doc = (location.hash || "").replace(/^#\/?/, "").split("/")[0];
    legalView.querySelectorAll("[data-doc]").forEach(a => { a.hidden = a.dataset.doc !== doc; });
    legalView.querySelectorAll(".lg-tabs a").forEach(a => { if (a.getAttribute("href") === "#/" + doc) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  }
  document.querySelector(".bar").hidden = view === "login" || view === "signup";   // ログインは1ページで完結（上の枠は出さない）
  document.getElementById("lp-nav").style.visibility = view === "lp" || view === "business" ? "visible" : "hidden";
  document.getElementById("cta-login").hidden = view === "login";
  window.scrollTo({ top: 0 });
  // 動く画面は1つだけ。ログインでは右側へ移して、紹介ページに戻ったら元の位置へ
  const stage = document.querySelector(".demo-stage"), hero = document.querySelector(".hero"), side = document.getElementById("lside");
  const want = view === "login" ? side : hero;
  if (stage.parentElement !== want) { want.appendChild(stage); if (!REDUCED) runFrom(0); }
  if (view === "login") loginGo("login");
}
const VIEW_OF = { "": "lp", login: "login", signup: "signup", business: "business", try: "trial", quote: "quote", terms: "legal", privacy: "legal", tokushoho: "legal" };
const viewOfHash = () => VIEW_OF[(location.hash || "").replace(/^#\/?/, "").split("/")[0]] || "lp";
const onHash = () => show(viewOfHash());
window.addEventListener("hashchange", onHash);
CLEANUP.push(() => window.removeEventListener("hashchange", onHash));

/* ---------- 料金：月額／年額（2026-10-19。はじめは月額） ---------- */
const cycleBtns = [...document.querySelectorAll("#cycle button")];
function setCycle(c) {
  cycleBtns.forEach(x => x.setAttribute("aria-pressed", String(x.dataset.c === c)));
  document.querySelectorAll("#price [data-m]").forEach(el => { el.textContent = el.dataset[c]; });
}
cycleBtns.forEach(x => x.addEventListener("click", () => setCycle(x.dataset.c)));
setCycle("m");

/* ---------- 紹介ページの動き ---------- */
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// 単元の流れる帯（2周分並べて、半分ずらすと切れ目なくつながる）
const mqItems = TOPICS.filter(t => !t.soon).map(t => `<span class="mq-item"><span class="ti" style="background:${t.soft}">${ICON[t.id](t.color)}</span>${t.name}<small>${t.sub}</small></span>`).join("");
document.getElementById("mq").innerHTML = mqItems + mqItems;
document.getElementById("mq").lastElementChild && [...document.getElementById("mq").children].slice(TOPICS.filter(t => !t.soon).length).forEach(el => el.setAttribute("aria-hidden", "true"));

// スクロールで出てくる要素・見出しのマーカー
document.querySelectorAll("#topic-grid .tile").forEach((el, i) => { el.classList.add("rv"); el.style.setProperty("--d", (i % 3) * 0.08 + "s"); });
const onIn = {
  ticket: el => { const lis = el.querySelectorAll(".checks li"); lis.forEach((li, i) => setTimeout(() => li.classList.add("ok"), 450 + i * 380)); setTimeout(() => el.classList.add("done"), 450 + lis.length * 380 + 200); },
  dash: el => el.querySelectorAll("[data-to]").forEach((n, i) => countUp(n, +n.dataset.to, 1200, 200 + i * 120)),
};
function countUp(el, to, ms, delay) {
  setTimeout(() => { const t0 = performance.now(); const tick = now => { const k = Math.min(1, Math.max(0, (now - t0) / ms)); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }, delay);
}
function reveal(el) {
  el.classList.add("in");
  el.querySelectorAll(".mark").forEach(m => m.classList.add("on"));
  if (el.classList.contains("mark")) el.classList.add("on");
  onIn[el.id]?.(el);
}
const revealTargets = [...document.querySelectorAll("#lp .rv, #lp .mark, #biz-view .rv, #biz-view .mark, #arch, #dash")].filter(el => !el.closest(".hero"));
if (REDUCED || !("IntersectionObserver" in window)) {
  revealTargets.forEach(el => { el.classList.add("in"); el.querySelectorAll?.(".checks li").forEach(li => li.classList.add("ok")); el.classList.add("on", "done"); });
  document.querySelectorAll("[data-to]").forEach(n => n.textContent = n.dataset.to);
} else {
  root.classList.add("js");
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } }), { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
  revealTargets.forEach(el => io.observe(el));
  CLEANUP.push(() => io.disconnect());
}

// ヘッダーの影・進みの線、3つの段階をつなぐ線
const bar = document.querySelector(".bar"), prog = document.createElement("i");
prog.className = "prog"; bar.appendChild(prog);
const flow = document.getElementById("flow"), flowFill = document.getElementById("flow-fill");
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  prog.style.setProperty("--p", max > 0 ? scrollY / max : 0);
  bar.classList.toggle("scrolled", scrollY > 8);
  const r = flow.getBoundingClientRect();
  const f = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height * 0.9)));
  flowFill.style.setProperty("--f", REDUCED ? 1 : f);
}
window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
CLEANUP.push(() => window.removeEventListener("scroll", onScroll));

// ヒーロー：カーソルの周りを少し明るく・画面をほんの少し傾ける
const heroWrap = document.querySelector(".hero-wrap"), demo = document.getElementById("demo"), spot = heroWrap.querySelector(".spot");
if (!REDUCED && matchMedia("(pointer:fine)").matches) {
  heroWrap.addEventListener("pointermove", e => {
    const r = heroWrap.getBoundingClientRect();
    spot.style.setProperty("--mx", (e.clientX - r.left) + "px"); spot.style.setProperty("--my", (e.clientY - r.top) + "px");
    const d = demo.getBoundingClientRect(), x = (e.clientX - (d.left + d.width / 2)) / d.width, y = (e.clientY - (d.top + d.height / 2)) / d.height;
    demo.style.setProperty("--ry", (x * 5).toFixed(2) + "deg"); demo.style.setProperty("--rx", (-y * 4).toFixed(2) + "deg");
  });
  heroWrap.addEventListener("pointerleave", () => { demo.style.setProperty("--ry", "0deg"); demo.style.setProperty("--rx", "0deg"); });
}

/* ---------- ヒーローの画面：学ぶ → 試す → 案件体験 を自動で見せる ---------- */
const CODE = `function total(prices) {
  let sum = 0;
  for (const p of prices) sum += p;
  return sum;
}`;
const TOKENS = CODE.split(/(\b(?:function|let|for|const|of|return)\b|\b\d+\b)/).filter(Boolean)
  .map(t => ({ t, c: /^(function|let|for|const|of|return)$/.test(t) ? "k" : /^\d+$/.test(t) ? "n" : "" }));
const escH = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function codeUpTo(n, cursor) {
  let out = "", left = n;
  for (const tk of TOKENS) { if (left <= 0) break; const s = tk.t.slice(0, left); left -= s.length; out += tk.c ? `<span class="${tk.c}">${escH(s)}</span>` : escH(s); }
  return out + (cursor ? '<span class="cur"></span>' : "");
}
const $ = id => document.getElementById(id);
const scenes = [...demo.querySelectorAll(".scene")], tabs = [...demo.querySelectorAll("[data-go]")];
const URLS = ["JavaScript入門 ／ 配列の合計", "JavaScript入門 ／ 演習：total()", "案件体験 ／ 予約フォームの入力チェック"];
const DUR = [5200, 7600, 6400];
const floats = { f1: demo.parentElement.querySelector(".f1"), f2: demo.parentElement.querySelector(".f2") };
let gen = 0;
const sleep = (ms, g) => new Promise((res, rej) => setTimeout(() => g === gen ? res() : rej("stop"), ms));

function resetScene(i) {
  if (i === 0) { scenes[0].classList.remove("p1", "p2", "p3"); $("sum-box").textContent = "?"; $("sum-box").classList.remove("pop"); $("quiz-a").classList.remove("ok"); }
  if (i === 1) { $("code").innerHTML = codeUpTo(0, true); $("t1").classList.remove("ok"); $("t2").classList.remove("ok"); $("run-btn").classList.remove("press"); }
  if (i === 2) { document.querySelectorAll("#tk-checks li").forEach(li => li.classList.remove("ok")); $("tk-score").textContent = "テスト 0 / 3"; $("tk-score").classList.remove("full"); $("tk-review").classList.remove("on"); $("tk-send").classList.remove("press"); }
}
function finalScene(i) {
  if (i === 0) { scenes[0].classList.add("p1", "p2", "p3"); $("sum-box").textContent = "500"; $("quiz-a").classList.add("ok"); }
  if (i === 1) { $("code").innerHTML = codeUpTo(CODE.length, false); $("t1").classList.add("ok"); $("t2").classList.add("ok"); }
  if (i === 2) { document.querySelectorAll("#tk-checks li").forEach(li => li.classList.add("ok")); $("tk-score").textContent = "テスト 3 / 3"; $("tk-score").classList.add("full"); $("tk-review").classList.add("on"); }
}
function activate(i) {
  scenes.forEach((s, k) => s.classList.toggle("on", k === i));
  tabs.forEach((t, k) => { t.classList.remove("on", "done"); t.setAttribute("aria-selected", k === i); if (k < i) t.classList.add("done"); });
  void tabs[i].offsetWidth; tabs[i].style.setProperty("--dur", DUR[i] + "ms"); tabs[i].classList.add("on");
  $("demo-url").textContent = URLS[i];
  floats.f1.classList.remove("on"); floats.f2.classList.remove("on");
}
const PLAY = [
  async g => { await sleep(250, g); scenes[0].classList.add("p1"); await sleep(900, g); scenes[0].classList.add("p2"); await sleep(600, g);
    const b = $("sum-box"); b.textContent = "500"; b.classList.add("pop"); await sleep(700, g); scenes[0].classList.add("p3"); await sleep(1100, g); $("quiz-a").classList.add("ok"); await sleep(1500, g); },
  async g => { for (let n = 0; n <= CODE.length; n += 2) { $("code").innerHTML = codeUpTo(n, true); await sleep(CODE[n] === "\n" ? 140 : 34, g); }
    $("code").innerHTML = codeUpTo(CODE.length, false); await sleep(400, g); $("run-btn").classList.add("press"); await sleep(220, g); $("run-btn").classList.remove("press");
    await sleep(380, g); $("t1").classList.add("ok"); await sleep(320, g); $("t2").classList.add("ok"); floats.f1.classList.add("on"); await sleep(2000, g); },
  async g => { const lis = document.querySelectorAll("#tk-checks li"); await sleep(600, g);
    for (let k = 0; k < lis.length; k++) { lis[k].classList.add("ok"); $("tk-score").textContent = `テスト ${k + 1} / 3`; await sleep(450, g); }
    $("tk-score").classList.add("full"); await sleep(400, g); $("tk-send").classList.add("press"); await sleep(200, g); $("tk-send").classList.remove("press");
    await sleep(500, g); $("tk-review").classList.add("on"); floats.f2.classList.add("on"); await sleep(2600, g); },
];
let heroVisible = true;
const heroIo = new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; });
heroIo.observe(demo);
CLEANUP.push(() => { heroIo.disconnect(); gen++; });
async function runFrom(start) {
  const g = ++gen; let i = start;
  try {
    while (true) {
      if (!heroVisible || document.hidden || !demo.offsetParent) {   // 見えていない間は、出来上がった状態で止めておく
        activate(i); finalScene(i);
        while (!heroVisible || document.hidden || !demo.offsetParent) await sleep(400, g);
      }
      resetScene(i); activate(i); await PLAY[i](g); i = (i + 1) % 3;
    }
  } catch (e) { /* 別の場面が選ばれた */ }
}
tabs.forEach(t => t.addEventListener("click", () => {
  const i = +t.dataset.go;
  if (REDUCED) { activate(i); finalScene(i); return; }
  runFrom(i);
}));
if (REDUCED) { activate(0); finalScene(0); } else runFrom(0);

/* ---------- ヒーローの奥：本物の AWS の画面（3つの場面） ---------- */
const awin = document.querySelector(".aws-win");
if (awin) {
  const awScns = [...awin.querySelectorAll(".aw-scn")], awScore = document.getElementById("aw-score"), awCrumb = document.getElementById("aw-crumb"), awPg = [...document.querySelectorAll("#aw-pg i")];
  const AW = [
    { crumb: "AWS 実習 ／ ALB と EC2 2台", steps: ["採点 1 / 3", "採点 2 / 3", "採点 3 / 3"] },
    { crumb: "AWS 実習 ／ サーバーレスの API", steps: ["採点 1 / 3", "採点 2 / 3", "採点 3 / 3"] },
    { crumb: "AWS 実習 ／ 止まったサーバーを復旧", steps: ["障害を検知", "原因を調査", "復旧 ✓"], broken: true },
  ];
  let awT = 0, awI = 0;
  const show = k => {
    awScns.forEach((el, n) => { el.classList.toggle("on", n === k); if (n === k) el.classList.remove("built", "broken", "fixed"); else setTimeout(() => { if (!el.classList.contains("on")) el.classList.remove("built", "broken", "fixed"); }, 700); });
    awPg.forEach((el, n) => el.classList.toggle("on", n === k));
    awCrumb.textContent = AW[k].crumb; awScore.textContent = AW[k].broken ? "監視中" : "採点 0 / 3"; awScore.classList.remove("full", "bad");
  };
  const play = () => {
    const k = awI, el = awScns[k], sc = AW[k];
    show(k); void el.offsetWidth; el.classList.add("built");
    let n = 0;
    const step = () => {
      if (sc.broken && n === 0) { el.classList.add("broken"); awScore.classList.add("bad"); }
      awScore.textContent = sc.steps[n]; n++;
      if (n < sc.steps.length) { awT = setTimeout(step, sc.broken ? 900 : 450); return; }
      if (sc.broken) { el.classList.remove("broken"); el.classList.add("fixed"); awScore.classList.remove("bad"); }
      awScore.classList.add("full");
      awI = (awI + 1) % AW.length; awT = setTimeout(play, 4200);
    };
    awT = setTimeout(step, 1900);
  };
  if (REDUCED) { show(0); awScns[0].classList.add("built"); awScore.textContent = "採点 3 / 3"; awScore.classList.add("full"); } else play();
  CLEANUP.push(() => clearTimeout(awT));
}


/* ---------- ログイン：本番の認証（OPTS.auth = entryAuth）。流れは本番のテノラボと同じ ---------- */
const LF = document.getElementById("lform");
let resendTimer = 0, resetMail = "";
const stepEl = s => LF.querySelector(`[data-step="${s}"]`);
function loginGo(step) {
  LF.querySelectorAll("[data-step]").forEach(el => { el.hidden = el.dataset.step !== step; });
  document.getElementById("l-alt").hidden = step !== "login";
  LF.querySelectorAll(".ferr").forEach(e => { e.hidden = true; e.textContent = ""; });
  LF.querySelectorAll("[aria-invalid]").forEach(e => e.removeAttribute("aria-invalid"));
  if (step !== "login") LF.querySelectorAll(`[data-step="${step}"] input`).forEach(i => { i.value = ""; });
  LF.querySelectorAll(`[data-step="${step}"] .rules span`).forEach(r => r.classList.remove("ok"));
  const first = stepEl(step).querySelector("input, .btn");
  if (first && !loginView.hidden) first.focus({ preventScroll: true });
}
function fail(form, msg, input) {
  const e = form.querySelector(".ferr"); e.textContent = msg; e.hidden = false;
  if (input) { input.setAttribute("aria-invalid", "true"); input.focus(); }
}
// 送っている間はボタンを押せなくし、文言を変える。結果（成功・失敗）にかかわらず元に戻す
async function busy(form, label, work) {
  const b = form.querySelector('button[type="submit"]'), orig = b.innerHTML;
  b.setAttribute("aria-busy", "true"); b.textContent = label;
  try { return await work(); }
  catch (e) { fail(form, e?.message || "うまくいきませんでした。もう一度試してください。"); return null; }
  finally { b.removeAttribute("aria-busy"); b.innerHTML = orig; }
}
const RULES = { len: v => v.length >= 8, up: v => /[A-Z]/.test(v), low: v => /[a-z]/.test(v), num: v => /\d/.test(v), sym: v => /[^A-Za-z0-9]/.test(v) };
const rulesOk = v => Object.values(RULES).every(f => f(v));
LF.querySelectorAll(".npw").forEach(inp => inp.addEventListener("input", () => {
  inp.closest("form").querySelectorAll(".rules span").forEach(r => r.classList.toggle("ok", RULES[r.dataset.r](inp.value)));
}));
function checkNewPw(form) {
  const a = form.querySelector(".npw"), b = form.querySelector(".npw2");
  if (!rulesOk(a.value)) { fail(form, "パスワードが条件を満たしていません。", a); return false; }
  if (a.value !== b.value) { fail(form, "2つのパスワードが一致しません。", b); return false; }
  return true;
}
function checkCode(form, input, msg) {
  if (!/^\d{6}$/.test(input.value.trim())) { fail(form, msg, input); return false; }
  return true;
}
const mailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
// 認証の次の段階へ。done ならアプリに知らせる（ホームへ）
function afterAuth(r) {
  if (!r) return;
  if (r.next === "signupCode") { goSignupCode(); return; }
  if (r.next === "done") {
    Promise.resolve(OPTS.onLoggedIn && OPTS.onLoggedIn()).then(msg => {
      // 画面を離れていたら（ログインできてホームへ移ったなど）何もしない
      if (typeof msg === "string" && msg && LF.isConnected) { loginGo("login"); fail(stepEl("login"), msg); }
    });
    return;
  }
  loginGo(r.next);
  if (r.next === "totpSetup") {
    const box = document.getElementById("l-qr");
    const img = document.createElement("img");
    img.className = "qr"; img.alt = "認証アプリで読み取るQRコード"; img.width = 120; img.height = 120;
    if (r.setup?.qr) { img.src = r.setup.qr; box.replaceWith(img); img.id = "l-qr"; }
    stepEl("totpSetup").querySelector(".qr-key code").textContent = (r.setup?.secret || "").replace(/(.{4})/g, "$1 ").trim();
  }
}
const SUBMIT = {
  login(form) {
    const m = document.getElementById("login-email"), p = document.getElementById("login-pass");
    if (!m.value.trim()) return fail(form, "メールアドレスを入れてください。", m);
    if (!mailOk(m.value)) return fail(form, "メールアドレスの形が正しくありません。@ のあとも確かめてください。", m);
    if (!p.value) return fail(form, "パスワードを入れてください。", p);
    busy(form, "ログインしています…", () => OPTS.auth.signIn(m.value, p.value)).then(r => { p.value = ""; afterAuth(r); });
  },
  totp(form) {
    const c = document.getElementById("l-totp");
    if (checkCode(form, c, "認証アプリに出ている6桁の数字を入れてください。")) busy(form, "確かめています…", () => OPTS.auth.confirmCode(c.value.trim())).then(afterAuth);
  },
  newpw(form) {
    if (checkNewPw(form)) busy(form, "設定しています…", () => OPTS.auth.newPassword(form.querySelector(".npw").value)).then(afterAuth);
  },
  totpSetup(form) {
    const c = document.getElementById("l-totp2");
    if (checkCode(form, c, "認証アプリに出ている6桁の数字を入れてください。")) busy(form, "確かめています…", () => OPTS.auth.confirmCode(c.value.trim())).then(afterAuth);
  },
  forgot(form) {
    const m = document.getElementById("l-fmail");
    if (!mailOk(m.value)) return fail(form, "メールアドレスを入れてください。", m);
    const to = m.value.trim();
    busy(form, "送っています…", () => OPTS.auth.sendReset(to).then(() => true)).then(ok => {
      if (!ok) return;
      resetMail = to; loginGo("forgotCode"); document.getElementById("l-fto").textContent = to; startResend();
    });
  },
  forgotCode(form) {
    const c = document.getElementById("l-fcode");
    if (!checkCode(form, c, "メールに届いた6桁のコードを入れてください。")) return;
    if (!checkNewPw(form)) return;
    busy(form, "変えています…", () => OPTS.auth.confirmReset(resetMail, c.value.trim(), form.querySelector(".npw").value).then(() => true)).then(ok => { if (ok) loginGo("forgotDone"); });
  },
};
LF.addEventListener("submit", e => { e.preventDefault(); const f = e.target.closest("[data-step]"); SUBMIT[f.dataset.step]?.(f); });
LF.addEventListener("click", e => {
  const t = e.target.closest("[data-to]"); if (!t) return;
  // 途中の段階からやめるときは、Cognito の途中のセッションも捨てる
  if (t.dataset.to === "login" && stepEl("login").hidden) OPTS.auth.cancel();
  loginGo(t.dataset.to);
});
LF.querySelectorAll("input.code").forEach(i => i.addEventListener("input", () => { i.value = i.value.replace(/\D/g, "").slice(0, 6); }));
LF.querySelector(".pw-t").addEventListener("click", e => {
  const p = document.getElementById("login-pass"), on = p.type === "password";
  p.type = on ? "text" : "password"; e.currentTarget.textContent = on ? "隠す" : "表示"; e.currentTarget.setAttribute("aria-pressed", on);
});
const resend = document.getElementById("l-resend");
function startResend() {
  let left = 45; clearInterval(resendTimer); resend.disabled = true; resend.textContent = `コードを送り直す（${left}秒後）`;
  resendTimer = setInterval(() => { left--; if (left <= 0) { clearInterval(resendTimer); resend.disabled = false; resend.textContent = "コードを送り直す"; } else resend.textContent = `コードを送り直す（${left}秒後）`; }, 1000);
}
CLEANUP.push(() => clearInterval(resendTimer));
resend.addEventListener("click", () => {
  OPTS.auth.sendReset(resetMail).then(() => { stepEl("forgotCode").querySelector(".info").textContent = "確認コードを送り直しました。"; startResend(); })
    .catch(e => fail(stepEl("forgotCode"), e.message));
});

/* ---------- ログイン画面 ---------- */
function startLive() {}
function stopLive() {}
/* ---------- 模擬の AWS ラボ（登録なしの体験。ブラウザの中だけで動き、AWS には何も作らない） ---------- */
const LAB = [
  { cls: "st1", cmd: "aws ec2 create-vpc --cidr-block 10.0.0.0/16", ok: "✓ vpc-0f3a9c21（vpc-lab）を作成しました" },
  { cls: "st2", cmd: "aws ec2 create-subnet --cidr-block 10.0.1.0/24", ok: "✓ subnet-07d2b8a6（public-a）を作成しました" },
  { cls: "st3", cmd: "aws ec2 run-instances --instance-type t3.micro", ok: "✓ i-0a3f9c21（web-1）が実行中になりました" },
  { cls: "st4", cmd: "aws ec2 authorize-security-group-ingress --port 80", ok: "✓ web-sg で 80 番を許可し、インターネットゲートウェイをつなぎました" },
];
const $lab = document.getElementById("lab"), $labLog = document.getElementById("lab-log"), $lsteps = [...document.querySelectorAll("#lsteps li")];
let labAt = 0, labBusy = false, labTimers = [];
const labLine = (cls, text) => { const s = document.createElement("span"); s.className = cls; s.textContent = text; $labLog.appendChild(s); };
function labRender() {
  $lsteps.forEach((li, i) => {
    li.classList.toggle("done", i < labAt); li.classList.toggle("now", i === labAt);
    li.querySelectorAll("button").forEach(b => { b.disabled = i !== labAt || labBusy; });
  });
  document.getElementById("lab-n").textContent = labAt + " / " + LAB.length;
  document.getElementById("lab-bar").style.width = (labAt / LAB.length * 100) + "%";
  $lab.querySelectorAll(".st").forEach(g => g.classList.toggle("on", LAB.slice(0, labAt).some(s => g.classList.contains(s.cls))));
  $lab.querySelector(".st0").classList.toggle("off", labAt > 0);
  document.getElementById("t-done").hidden = labAt < LAB.length;
}
function labDo(i) {
  if (i !== labAt || labBusy) return;
  labBusy = true; labRender();
  if (labAt === 0) $labLog.querySelector(".mute")?.remove();
  labLine("cmd", "$ " + LAB[i].cmd);
  labTimers.push(setTimeout(() => {
    labLine("ok", LAB[i].ok); labAt++; labBusy = false;
    if (labAt === LAB.length) { labLine("cmd", "$ curl http://13.231.xx.xx"); labLine("pass", "200 OK ・ Hello from web-1"); }
    labRender();
  }, 520));
}
$lsteps.forEach((li, i) => li.querySelector(".mk")?.addEventListener("click", () => labDo(i)));
document.querySelectorAll("#lsteps .port").forEach(b => b.addEventListener("click", () => {
  const ok = b.dataset.p === "80";
  document.getElementById("lhint").hidden = ok;
  b.classList.toggle("ng", !ok);
  if (ok) labDo(3);
}));
document.getElementById("lab-reset").addEventListener("click", () => {
  labTimers.forEach(clearTimeout); labTimers = []; labAt = 0; labBusy = false;
  $labLog.innerHTML = '<span class="lbl">ログ</span><span class="mute">「作成」を押すと、ここに結果が出ます</span>';
  document.getElementById("lhint").hidden = true; document.querySelectorAll("#lsteps .port").forEach(b => b.classList.remove("ng"));
  labRender();
});
labRender();

show(viewOfHash());

/* ---------- お見積り依頼（モック：送信はしない。送り先のメールはあとで決める） ---------- */
document.getElementById("q-topics").innerHTML = [...TOPICS.map(t => t.name), "そのほか"].map(n => `<label><input type="checkbox" name="topics" value="${n}">${n}</label>`).join("");
const qform = document.getElementById("qform");
qform.addEventListener("submit", e => {
  e.preventDefault();
  let firstBad = null;
  qform.querySelectorAll(".qf[data-req]").forEach(f => {
    const el = f.querySelector("input,select"), v = el.value.trim();
    let msg = v ? "" : "入力してください";
    if (!msg && f.dataset.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) msg = "メールアドレスの形を確かめてください";
    f.classList.toggle("bad", !!msg); f.querySelector(".msg").textContent = msg;
    if (msg && !firstBad) firstBad = el;
  });
  const agree = document.getElementById("q-agree").checked;
  document.getElementById("q-err").textContent = firstBad ? "入力していない項目があります" : agree ? "" : "個人情報の取り扱いへの同意が必要です";
  if (firstBad) { firstBad.focus(); return; }
  if (!agree) return;
  const fd = new FormData(qform), topics = fd.getAll("topics");
  const payload = { company: fd.get("company"), name: fd.get("name"), email: fd.get("email"), dept: fd.get("dept") || "", phone: fd.get("tel") || "", people: fd.get("people"), period: fd.get("when") || "", topics, plan: fd.get("plan"), message: fd.get("note") || "" };
  const sendBtn = qform.querySelector('button[type="submit"]'), sendLabel = sendBtn.innerHTML;
  sendBtn.setAttribute("aria-busy", "true"); sendBtn.textContent = "送っています…";
  Promise.resolve(OPTS.submitInquiry ? OPTS.submitInquiry(payload) : null).then(() => {
  const rows = [["会社名", fd.get("company")], ["お名前", fd.get("name")], ["メール", fd.get("email")], ["受講予定", fd.get("people")], ["始めたい時期", fd.get("when") || "－"], ["単元", topics.length ? topics.join("、") : "－"], ["プラン", fd.get("plan")]];
  document.getElementById("qsummary").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${String(v).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</dd>`).join("");
  qform.hidden = true; document.getElementById("qdone").hidden = false; window.scrollTo({ top: 0 });
  }).catch(() => {
    document.getElementById("q-err").textContent = "送れませんでした。通信状況を確かめて、もう一度送ってください。";
  }).finally(() => { sendBtn.removeAttribute("aria-busy"); sendBtn.innerHTML = sendLabel; });
});

// Google のログイン（2026-10-17、ADR 0028）。Google の画面へ移るので、戻ってきた後はアプリ（TenolabApp）が引き継ぐ
if (OPTS.auth.googleEnabled) {
  document.getElementById("l-galt").hidden = false;
  const gb = document.getElementById("l-google");
  gb.addEventListener("click", () => {
    if (gb.getAttribute("aria-busy")) return;
    gb.setAttribute("aria-busy", "true");
    OPTS.auth.google().then(r => { if (r?.next === "done") afterAuth(r); }, e => {
      gb.removeAttribute("aria-busy");
      fail(stepEl("login"), e?.message || "Google のログインを始められませんでした。");
    });
  });
}

/* ---------- 無料登録（個人、2026-10-20 ADR 0029）：メール＋パスワード → 確認コード → そのままログイン ---------- */
const SF = document.getElementById("sform");
const sStep = s => SF.querySelector(`[data-sstep="${s}"]`);
let sResendTimer = 0;
function sGo(step) {
  SF.querySelectorAll("[data-sstep]").forEach(el => { el.hidden = el.dataset.sstep !== step; });
  SF.querySelectorAll(".ferr").forEach(e => { e.hidden = true; e.textContent = ""; });
  SF.querySelectorAll("[aria-invalid]").forEach(e => e.removeAttribute("aria-invalid"));
  const first = sStep(step).querySelector("input");
  if (first && !signupView.hidden) first.focus({ preventScroll: true });
}
const sResend = document.getElementById("s-resend");
function startSignupResend() {
  let left = 45; clearInterval(sResendTimer); sResend.disabled = true; sResend.textContent = `コードを送り直す（${left}秒後）`;
  sResendTimer = setInterval(() => { left--; if (left <= 0) { clearInterval(sResendTimer); sResend.disabled = false; sResend.textContent = "コードを送り直す"; } else sResend.textContent = `コードを送り直す（${left}秒後）`; }, 1000);
}
CLEANUP.push(() => clearInterval(sResendTimer));
// ログインしようとした人の登録の確認が済んでいなかったとき（コードは送り直してある）
function goSignupCode() {
  if (location.hash !== "#/signup") location.hash = "#/signup";
  sGo("code"); startSignupResend();
  sStep("code").querySelector(".info").textContent = "登録の確認がまだです。確認コードを送りました。";
}
const sPass = document.getElementById("s-pass");
sPass.addEventListener("input", () => SF.querySelectorAll('[data-sstep="signup"] .rules span').forEach(r => r.classList.toggle("ok", RULES[r.dataset.r](sPass.value))));
sStep("signup").addEventListener("submit", e => {
  e.preventDefault();
  const form = e.currentTarget, m = document.getElementById("s-email"), agree = document.getElementById("s-agree");
  if (!m.value.trim()) return fail(form, "メールアドレスを入れてください。", m);
  if (!mailOk(m.value)) return fail(form, "メールアドレスの形が正しくありません。@ のあとも確かめてください。", m);
  if (!rulesOk(sPass.value)) return fail(form, "パスワードが条件を満たしていません。", sPass);
  if (!agree.checked) return fail(form, "利用規約とプライバシーポリシーへの同意が必要です。", agree);
  busy(form, "登録しています…", () => OPTS.auth.signUp(m.value, sPass.value)).then(r => {
    if (!r) return;
    sGo("code"); startSignupResend();
    sStep("code").querySelector(".info").textContent = `${m.value.trim()} に確認コードを送りました。`;
  });
});
sStep("code").addEventListener("submit", e => {
  e.preventDefault();
  const form = e.currentTarget, c = document.getElementById("s-code");
  if (!checkCode(form, c, "メールに届いた6桁の数字を入れてください。")) return;
  busy(form, "確かめています…", () => OPTS.auth.confirmSignUp(c.value.trim())).then(r => {
    if (!r) return;
    sPass.value = "";
    if (r.next !== "done") location.hash = "#/login";
    afterAuth(r);
  });
});
sResend.addEventListener("click", () => {
  OPTS.auth.resendSignUp().then(() => { sStep("code").querySelector(".info").textContent = "確認コードを送り直しました。"; startSignupResend(); },
    e => fail(sStep("code"), e?.message || "確認コードを送れませんでした。"));
});
// Google で始める（Google のログインが使えるときだけ出す）
const sGoogle = document.getElementById("s-google");
if (OPTS.auth.googleEnabled) {
  sGoogle.addEventListener("click", () => {
    if (sGoogle.getAttribute("aria-busy")) return;
    sGoogle.setAttribute("aria-busy", "true");
    OPTS.auth.google().then(r => { if (r?.next === "done") afterAuth(r); }, err => {
      sGoogle.removeAttribute("aria-busy");
      fail(sStep("signup"), err?.message || "Google の登録を始められませんでした。");
    });
  });
} else {
  sGoogle.hidden = true;
  sGoogle.nextElementSibling.hidden = true;
}

if (OPTS.loginError && !loginView.hidden) fail(stepEl("login"), OPTS.loginError);

return () => { CLEANUP.forEach(f => { try { f(); } catch (e) { /* 片付けの失敗は無視 */ } }); };
}
