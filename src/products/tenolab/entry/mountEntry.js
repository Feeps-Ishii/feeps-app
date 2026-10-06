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
  { id: "web", name: "Web制作", sub: "HTML / CSS", color: "#F2C200", soft: "#FFF7C2", meta: "コース 2 ・ 演習 2 ・ 案件体験 1" },
  { id: "js", name: "JavaScript", sub: "JavaScript", color: "#2457E6", soft: "#E8EEFD", meta: "コース 6 ・ 演習 6 ・ 案件体験 2" },
  { id: "java", name: "Java", sub: "Java", color: "#D9483B", soft: "#FBE9E7", meta: "コース 2 ・ 演習 2 ・ 案件体験 1" },
  { id: "db", name: "データベース", sub: "SQL", color: "#11966F", soft: "#E3F5EE", meta: "コース 1 ・ 演習 2 ・ 案件体験 1" },
  { id: "git", name: "Git・チーム開発", sub: "Git", color: "#7454C7", soft: "#F0ECFD", meta: "コース 1 ・ 演習 1 ・ 案件体験 1" },
  { id: "cloud", name: "AWS", sub: "クラウド", color: "#F29A38", soft: "#FFF1E2", meta: "コース 5 ・ 実習 6 ・ 案件体験 2", premium: true },
];
const ICON = {
  web: c => `<svg viewBox="0 0 64 64"><rect x="6" y="10" width="52" height="40" rx="5" fill="#fff" stroke="#15171C" stroke-width="3"/><path d="M6 20h52" stroke="#15171C" stroke-width="3"/><rect x="12" y="26" width="18" height="18" rx="2" fill="${c}"/><path d="M36 28h16M36 35h12M36 42h16" stroke="#15171C" stroke-width="3" stroke-linecap="round"/></svg>`,
  js: c => `<svg viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" rx="8" fill="${c}"/><path d="M27 20c-5 0-5 3-5 7s-1 5-4 5c3 0 4 1 4 5s0 7 5 7M37 20c5 0 5 3 5 7s1 5 4 5c-3 0-4 1-4 5s0 7-5 7" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  java: c => `<svg viewBox="0 0 64 64"><path d="M14 28h30v12a12 12 0 0 1-12 12h-6a12 12 0 0 1-12-12z" fill="#fff" stroke="#15171C" stroke-width="3"/><path d="M44 31h4a5 5 0 0 1 0 10h-4" fill="none" stroke="#15171C" stroke-width="3"/><path d="M22 12c-3 4 3 6 0 10M30 10c-3 4 3 6 0 12M38 12c-3 4 3 6 0 10" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/></svg>`,
  db: c => `<svg viewBox="0 0 64 64"><path d="M14 14v34c0 3.3 8 6 18 6s18-2.7 18-6V14" fill="#fff" stroke="#15171C" stroke-width="3"/><ellipse cx="32" cy="14" rx="18" ry="6" fill="${c}" stroke="#15171C" stroke-width="3"/><path d="M14 26c0 3.3 8 6 18 6s18-2.7 18-6M14 38c0 3.3 8 6 18 6s18-2.7 18-6" fill="none" stroke="#15171C" stroke-width="3"/></svg>`,
  git: c => `<svg viewBox="0 0 64 64"><path d="M20 14v36M20 26c0 8 24 4 24 14v2" fill="none" stroke="#15171C" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="14" r="6" fill="#fff" stroke="#15171C" stroke-width="3"/><circle cx="20" cy="50" r="6" fill="#fff" stroke="#15171C" stroke-width="3"/><circle cx="44" cy="46" r="6" fill="${c}" stroke="#15171C" stroke-width="3"/></svg>`,
  cloud: c => `<svg viewBox="0 0 64 64"><path d="M18 46a10 10 0 0 1-1-20 14 14 0 0 1 27-4 11 11 0 0 1 3 24z" fill="#fff" stroke="#15171C" stroke-width="3" stroke-linejoin="round"/><path d="M32 30v14M26 36l6-6 6 6" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
document.getElementById("topic-grid").innerHTML = TOPICS.map(t => `
  <div class="card tile ${t.premium ? "gold" : ""}">
    <span class="ti" style="background:${t.soft}">${ICON[t.id](t.color)}</span>
    <span style="display:grid;gap:2px;min-width:0">
      <span style="display:flex;gap:6px;align-items:center"><span class="eyebrow">${t.sub}</span>${t.premium ? '<span class="prem">PREMIUM</span>' : ""}</span>
      <h3>${t.name}</h3><span class="meta">${t.meta}</span>
    </span>
  </div>`).join("");

/* ---------- 画面の切り替え（紹介 ⇄ ログイン） ---------- */
const lp = document.getElementById("lp"), loginView = document.getElementById("login-view"), trialView = document.getElementById("trial-view"), quoteView = document.getElementById("quote-view");
function show(view) {
  lp.hidden = view !== "lp"; loginView.hidden = view !== "login"; trialView.hidden = view !== "trial"; quoteView.hidden = view !== "quote";
  document.querySelector(".bar").hidden = view === "login";   // ログインは1ページで完結（上の枠は出さない）
  document.getElementById("lp-nav").style.visibility = view === "lp" ? "visible" : "hidden";
  document.getElementById("cta-login").hidden = view === "login";
  window.scrollTo({ top: 0 });
  // 動く画面は1つだけ。ログインでは右側へ移して、紹介ページに戻ったら元の位置へ
  const stage = document.querySelector(".demo-stage"), hero = document.querySelector(".hero"), side = document.getElementById("lside");
  const want = view === "login" ? side : hero;
  if (stage.parentElement !== want) { want.appendChild(stage); if (!REDUCED) runFrom(0); }
  if (view === "login") loginGo("login");
}
const VIEW_OF = { "": "lp", login: "login", try: "trial", quote: "quote" };
const viewOfHash = () => VIEW_OF[(location.hash || "").replace(/^#\/?/, "").split("/")[0]] || "lp";
const onHash = () => show(viewOfHash());
window.addEventListener("hashchange", onHash);
CLEANUP.push(() => window.removeEventListener("hashchange", onHash));

/* ---------- 紹介ページの動き ---------- */
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// 単元の流れる帯（2周分並べて、半分ずらすと切れ目なくつながる）
const mqItems = TOPICS.map(t => `<span class="mq-item"><span class="ti" style="background:${t.soft}">${ICON[t.id](t.color)}</span>${t.name}<small>${t.sub}</small></span>`).join("");
document.getElementById("mq").innerHTML = mqItems + mqItems;
document.getElementById("mq").lastElementChild && [...document.getElementById("mq").children].slice(TOPICS.length).forEach(el => el.setAttribute("aria-hidden", "true"));

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
const revealTargets = [...document.querySelectorAll("#lp .rv, #lp .mark, #arch, #dash")].filter(el => !el.closest(".hero"));
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
/* ---------- Javaを少しだけ体験 ---------- */
const T_START = `public class Main {
  // 税込み金額を返す（税率10%）
  static int withTax(int price) {
    return price; // ← ここを直す
  }

  public static void main(String[] args) {
    System.out.println(withTax(1000) + "円");
    System.out.println(withTax(250) + "円");
  }
}`;
const $tCode = document.getElementById("t-code"), $tOut = document.getElementById("t-out");
$tCode.value = T_START;
const escT = v => String(v).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function runJava() {
  const src = $tCode.value;
  const m = src.match(/static\s+int\s+withTax\s*\(\s*int\s+price\s*\)\s*\{([\s\S]*?)\n\s{2}\}/);
  if (!m) return { error: "Main.java:3: エラー: メソッド withTax(int) が見つかりません" };
  // Javaならコンパイルで止まる書き方は、ここで止める（文末の ; と、double を int で返すこと）
  const lines = m[1].replace(/\/\/.*$/gm, "").split("\n").map(l => l.trim()).filter(Boolean);
  const noSemi = lines.findIndex(l => !/[;{}]$/.test(l));
  if (noSemi >= 0) return { error: `Main.java:${4 + noSemi}: エラー: ';' がありません` };
  if (/\d+\.\d+/.test(m[1].replace(/\/\/.*$/gm, "")) && !/\(int\)/.test(m[1])) return { error: "Main.java:4: エラー: 不適合な型: double から int への変換で精度が失われる可能性があります" };
  // 型の宣言とキャストだけをJSに読みかえる（モック用のごく小さな置き換え）
  const body = m[1].replace(/\/\/.*$/gm, "").replace(/\b(int|long|double)\s+(?=[a-zA-Z_])/g, "let ").replace(/\(int\)\s*\(/g, "Math.trunc(");
  let fn;
  try { fn = new Function("price", body); } catch (e) { return { error: "Main.java:4: エラー: 文の書き方を確かめてください" }; }
  const results = [];
  for (const v of [1000, 250]) {
    let r; try { r = fn(v); } catch (e) { return { error: "実行時エラー: " + e.message }; }
    if (typeof r !== "number") return { error: "Main.java:4: エラー: int を返してください" };
    if (!Number.isInteger(r)) return { error: "Main.java:4: エラー: 不適合な型: double から int への変換で精度が失われる可能性があります" };
    results.push(r);
  }
  return { results };
}
document.getElementById("t-run").addEventListener("click", () => {
  const r = runJava();
  const checks = [...document.querySelectorAll("#tchecks li")];
  if (r.error) {
    $tOut.innerHTML = `<span class="lbl">コンソール</span><span class="err">${escT(r.error)}</span>`;
    checks.forEach(li => { li.classList.remove("ok"); li.querySelector("i").textContent = ""; });
    document.getElementById("t-done").hidden = true; return;
  }
  const ok = [r.results[0] === 1100, r.results[1] === 275];
  checks.forEach((li, i) => { li.classList.toggle("ok", ok[i]); li.querySelector("i").textContent = ok[i] ? "✓" : ""; });
  $tOut.innerHTML = `<span class="lbl">コンソール</span>${r.results.map(v => `<span>${v}円</span>`).join("")}${ok.every(Boolean) ? '<span class="pass">✓ 2つとも合っています</span>' : '<span style="color:var(--ide-mute)">まだ税込みになっていません</span>'}`;
  document.getElementById("t-done").hidden = !ok.every(Boolean);
});
document.getElementById("t-reset").addEventListener("click", () => { $tCode.value = T_START; $tOut.innerHTML = '<span class="lbl">コンソール</span>'; document.querySelectorAll("#tchecks li").forEach(li => { li.classList.remove("ok"); li.querySelector("i").textContent = ""; }); document.getElementById("t-done").hidden = true; });
document.getElementById("t-hint").addEventListener("click", () => { document.getElementById("t-hint-box").hidden = false; });
$tCode.addEventListener("keydown", e => { if (e.key === "Tab") { e.preventDefault(); const s = $tCode.selectionStart; $tCode.setRangeText("  ", s, $tCode.selectionEnd, "end"); } });

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

if (OPTS.loginError && !loginView.hidden) fail(stepEl("login"), OPTS.loginError);

return () => { CLEANUP.forEach(f => { try { f(); } catch (e) { /* 片付けの失敗は無視 */ } }); };
}
