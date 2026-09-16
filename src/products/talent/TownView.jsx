import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPut } from "../../api.js";
import { Card, Btn, PageHeader, PrismSectionTitle, T } from "../../components/common";
import { AlertCircle, Check, Coins, Minus, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { buildPlan, landCost, hallKey, adjacentOwned, shortName } from "./town/townPlan.js";

/* 成長の街。
 *
 * **three.js は動的importでしか読まない。** 街を開いた人だけが読み込むようにして、
 * 研修画面ぜんたいのバンドルを太らせない。 */

const SKIN_NAMES = [
  { n: "レンガと銅板", sw: ["#7A4A32", "#2E6B60", "#8A6A4A"] },
  { n: "白壁と瓦", sw: ["#C9C4B8", "#2A2E38", "#8A8478"] },
  { n: "黒と真鍮", sw: ["#1C1E24", "#B08838", "#4A4436"] },
];
const RESKIN = 20;
const TODS = [["朝", 0.28], ["昼", 0.50], ["夕", 0.78], ["夜", 0.95]];

export default function TownView({ done = {}, goals = [] }) {
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const saveRef = useRef(Promise.resolve());

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [remote, setRemote] = useState(null);       // サーバから来たもの
  const [land, setLand] = useState(() => new Set());
  const [built, setBuilt] = useState(() => new Set());
  const [skin, setSkin] = useState({});
  const [spent, setSpent] = useState(0);
  const [sel, setSel] = useState(null);
  const [clock, setClock] = useState(0.5);
  const [auto, setAuto] = useState(true);
  const [ready, setReady] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const plan = useMemo(() => buildPlan(goals), [goals]);
  const planBy = useMemo(() => Object.fromEntries(plan.map(p => [p.key, p])), [plan]);

  const earned = remote?.earned ?? null;
  const credits = earned == null ? null : Math.max(0, earned - spent);
  const unknown = earned == null;

  /* ---- 読み込み ---- */
  useEffect(() => {
    let alive = true;
    setLoading(true); setErr("");
    apiGet("/town/me").then(r => {
      if (!alive) return;
      setRemote(r);
      setLand(new Set(Array.isArray(r.land) ? r.land : []));
      setBuilt(new Set(Array.isArray(r.built) ? r.built : []));
      setSkin(r.skin && typeof r.skin === "object" ? r.skin : {});
      setSpent(Number(r.spent) || 0);
    }).catch(() => {
      if (alive) setErr("街の状態を読み込めませんでした。未購入・0クレジットとは限りません。再読み込みしてください。");
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [reloadKey]);

  /* ---- 3D ---- */
  useEffect(() => {
    if (loading || err) return;
    let alive = true, world = null, ro = null;
    import("./town/townWorld.js").then(mod => {
      if (!alive || !canvasRef.current) return;
      world = mod.createTown(canvasRef.current, {
        plan,
        onPick: key => setSel(key),
        isPowered: () => true,
        onClock: t => setClock(t),
      });
      worldRef.current = world;
      world.start();
      setReady(true);
      ro = new ResizeObserver(() => world.resize());
      ro.observe(canvasRef.current.parentElement);
    }).catch(() => { if (alive) setErr("街の描画を読み込めませんでした。"); });
    return () => {
      alive = false; ro?.disconnect();
      worldRef.current = null;
      world?.dispose();
    };
  }, [loading, err, plan]);

  /* 役所の区画は最初から持っている扱いにする（買う対象にしない） */
  const ownedLand = useMemo(() => {
    const s = new Set(land); s.add(hallKey); return s;
  }, [land]);

  const canBuild = useCallback(p => p?.kind === "task" && ownedLand.has(p.key) && !!done[p.task], [ownedLand, done]);

  /* 区画の上に出す値札 */
  const labels = useMemo(() => {
    const out = {};
    plan.forEach(p => {
      if (p.kind === "hall") return;
      const has = ownedLand.has(p.key);
      if (!has) {
        if (!adjacentOwned(ownedLand, p.gx, p.gy)) return;
        const c = landCost(p.gx, p.gy);
        out[p.key] = {
          top: p.kind === "park" ? "公園にする" : shortName(p),
          bottom: `${c} CR`,
          color: !unknown && credits >= c ? "rgba(245,196,81,.96)" : "rgba(163,176,206,.85)",
        };
        return;
      }
      if (p.kind !== "task" || built.has(p.task)) return;
      const ok = !!done[p.task];
      out[p.key] = {
        top: shortName(p),
        bottom: ok ? `${p.cost} CR` : "まだ達成していません",
        bad: !ok,
        color: ok ? (!unknown && credits >= p.cost ? "rgba(245,196,81,.96)" : "rgba(163,176,206,.85)") : "rgba(232,115,95,.95)",
      };
    });
    return out;
  }, [plan, ownedLand, built, done, credits, unknown]);

  useEffect(() => {
    const w = worldRef.current; if (!w) return;
    w.setState({ land: ownedLand, built, skin, labels, running: built.size >= 3 });
  }, [ready, ownedLand, built, skin, labels]);

  /* 初回だけは建設アニメを飛ばす（開くたびに街が建ち直すとうるさい） */
  const snappedRef = useRef(false);
  useEffect(() => {
    if (!ready || snappedRef.current) return;
    snappedRef.current = true;
    worldRef.current?.snapBuilt();
  }, [ready]);

  useEffect(() => { worldRef.current?.setDay(clockTarget.current ?? 0.5, auto); }, [auto]);
  const clockTarget = useRef(null);
  const setTod = v => { clockTarget.current = v; setAuto(false); worldRef.current?.setDay(v, false); };

  /* ---- 保存 ---- */
  const persist = useCallback((next) => {
    setSaveErr("");
    saveRef.current = saveRef.current.catch(() => {}).then(() =>
      apiPut("/town/me", next).catch(() => {
        setSaveErr("保存できませんでした。通信を確認して、もう一度お試しください。");
      }));
  }, []);

  const buyLand = key => {
    const p = planBy[key]; if (!p || ownedLand.has(key)) return;
    const c = landCost(p.gx, p.gy);
    if (unknown || credits < c || !adjacentOwned(ownedLand, p.gx, p.gy)) return;
    const nextLand = new Set(land); nextLand.add(key);
    const nextSpent = spent + c;
    setLand(nextLand); setSpent(nextSpent);
    persist({ spent: nextSpent, land: [...nextLand], built: [...built], skin });
  };
  const buildOn = key => {
    const p = planBy[key]; if (!canBuild(p) || built.has(p.task)) return;
    if (unknown || credits < p.cost) return;
    const nextBuilt = new Set(built); nextBuilt.add(p.task);
    const nextSpent = spent + p.cost;
    setBuilt(nextBuilt); setSpent(nextSpent);
    persist({ spent: nextSpent, land: [...land], built: [...nextBuilt], skin });
  };
  const pickSkin = (key, i) => {
    const p = planBy[key]; if (!p?.task) return;
    const cur = skin[p.task] ?? 0;
    if (cur === i) return;
    const isBuilt = built.has(p.task);
    if (isBuilt && (unknown || credits < RESKIN)) return;
    const nextSkin = { ...skin, [p.task]: i };
    const nextSpent = spent + (isBuilt ? RESKIN : 0);
    setSkin(nextSkin); setSpent(nextSpent);
    persist({ spent: nextSpent, land: [...land], built: [...built], skin: nextSkin });
  };

  const selP = sel ? planBy[sel] : null;
  const stats = {
    land: ownedLand.size, lots: plan.length,
    built: built.size, tasks: plan.filter(p => p.kind === "task").length,
    doneCount: plan.filter(p => p.kind === "task" && done[p.task]).length,
  };
  const hh = String(Math.floor(clock * 24)).padStart(2, "0");
  const mm = String(Math.floor((clock * 24 % 1) * 60)).padStart(2, "0");

  return (
    <div>
      <PageHeader
        product="talent"
        label="スキル・成長"
        title="街"
        description="目標のひとつひとつが建物になります。土地はクレジットで買い、建てるにはそのタスクを達成していることが要ります。"
      />

      {err ? (
        <Card className="mt-6 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} style={{ color: T.danger }} />
            <div className="min-w-0">
              <div className="font-bold">街を表示できませんでした</div>
              <div className="mt-1 text-sm opacity-80">{err}</div>
              <Btn kind="ghost" size="sm" icon={RotateCcw} className="mt-3" onClick={() => setReloadKey(k => k + 1)}>再読み込み</Btn>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="relative mt-5 overflow-hidden rounded-2xl border" style={{ borderColor: T.line, background: "#05070E" }}>
            <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: "16 / 9", maxHeight: "72vh", touchAction: "pan-y" }} />
            <div className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(128% 104% at 50% 40%, transparent 46%, rgba(0,0,0,.5) 100%)" }} />

            {/* HUD */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start gap-2 p-3">
              <div className="rounded-xl border px-3 py-2 backdrop-blur"
                style={{ borderColor: "rgba(199,154,46,.85)", background: "rgba(28,22,8,.74)" }}>
                <div className="text-[9.5px] font-bold tracking-[.16em]" style={{ color: "#C79A2E" }}>CREDIT</div>
                <div className="font-mono text-xl font-bold leading-none" style={{ color: "#F5C451" }}>
                  {unknown ? "—" : credits.toLocaleString("ja-JP")}
                </div>
              </div>
              <div className="flex gap-4 rounded-xl border px-3 py-2 backdrop-blur"
                style={{ borderColor: "rgba(58,71,112,.9)", background: "rgba(8,11,21,.7)" }}>
                <Stat v={`${stats.land}/${stats.lots}`} k="土地" />
                <Stat v={`${stats.built}/${stats.tasks}`} k="建物" />
                <Stat v={`${stats.doneCount}/${stats.tasks}`} k="達成" />
              </div>
              <div className="ml-auto rounded-xl border px-3 py-2 backdrop-blur"
                style={{ borderColor: "rgba(58,71,112,.9)", background: "rgba(8,11,21,.7)" }}>
                <div className="text-[9.5px] font-bold tracking-[.14em]" style={{ color: "#6C7A9C" }}>
                  {Number(hh) < 5 ? "深夜" : Number(hh) < 9 ? "朝" : Number(hh) < 16 ? "昼" : Number(hh) < 19 ? "夕" : "夜"}
                </div>
                <div className="font-mono text-base font-bold leading-tight text-white">{hh}:{mm}</div>
              </div>
            </div>

            {/* 区画のカード */}
            {selP && (
              <div className="absolute bottom-3 left-3 w-[min(330px,calc(100%-24px))] rounded-2xl border p-4 backdrop-blur"
                style={{ borderColor: "rgba(58,71,112,.95)", background: "rgba(8,11,21,.9)" }}>
                <LotCard
                  p={selP} owned={ownedLand.has(selP.key)} built={built.has(selP.task)}
                  doneOk={!!done[selP.task]} credits={credits} unknown={unknown}
                  reachable={adjacentOwned(ownedLand, selP.gx, selP.gy)}
                  skinIndex={skin[selP.task] ?? 0}
                  onBuyLand={() => buyLand(selP.key)}
                  onBuild={() => buildOn(selP.key)}
                  onSkin={i => pickSkin(selP.key, i)}
                  onClose={() => { setSel(null); worldRef.current?.focus(null); }}
                />
              </div>
            )}

            <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
              <ZoomBtn icon={Plus} onClick={() => worldRef.current?.zoom(-14)} label="寄る" />
              <ZoomBtn icon={Minus} onClick={() => worldRef.current?.zoom(14)} label="引く" />
            </div>
            {!ready && (
              <div className="absolute inset-0 grid place-items-center font-mono text-xs tracking-[.14em]"
                style={{ background: "#05070E", color: "#6C7A9C" }}>BUILDING THE TOWN…</div>
            )}
          </div>

          {saveErr && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: T.danger, color: T.danger }}>
              <AlertCircle size={16} />{saveErr}
            </div>
          )}

          {/* 操作 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[.14em] opacity-60">時間帯</span>
            <div className="flex overflow-hidden rounded-lg" style={{ boxShadow: `inset 0 0 0 1px ${T.line}` }}>
              {TODS.map(([n, v]) => (
                <button key={n} onClick={() => setTod(v)}
                  className="px-3 py-1.5 text-xs font-bold"
                  style={{ background: !auto && clockTarget.current === v ? T.soft : "transparent" }}>{n}</button>
              ))}
              <button onClick={() => { setAuto(true); clockTarget.current = null; }}
                className="px-3 py-1.5 text-xs font-bold"
                style={{ background: auto ? T.soft : "transparent" }}>自動</button>
            </div>
            <div className="ml-auto text-xs opacity-60">区画をクリックすると買えます ／ ドラッグで見回せます</div>
          </div>

          {/* クレジットの内訳 */}
          <PrismSectionTitle className="mt-8" title="クレジットはどこから来たか" />
          <Card className="mt-3 p-5">
            {unknown ? (
              <div className="flex items-start gap-3 text-sm">
                <AlertCircle size={18} style={{ color: T.warn }} />
                <div>
                  <div className="font-bold">いまは実績を確認できませんでした</div>
                  <div className="mt-1 opacity-80">0件・0クレジットとは限りません。土地と建物の購入は、確認できるまで止めています。</div>
                  <Btn kind="ghost" size="sm" icon={RotateCcw} className="mt-3" onClick={() => setReloadKey(k => k + 1)}>再読み込み</Btn>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-4">
                <Src label="日報の提出" n={remote?.sources?.reports} rate={remote?.sources?.rates?.report} />
                <Src label="確認テスト合格" n={remote?.sources?.passedTests} rate={remote?.sources?.rates?.test} />
                <Src label="来た日" n={remote?.sources?.loginDays} rate={remote?.sources?.rates?.login} />
                <div className="rounded-xl p-3" style={{ background: T.soft }}>
                  <div className="text-[10px] font-bold tracking-[.12em] opacity-60">つかった</div>
                  <div className="font-mono text-lg font-bold">{spent.toLocaleString("ja-JP")}<span className="ml-1 text-xs">CR</span></div>
                  <div className="mt-1 text-[11px] opacity-70">稼いだ {earned?.toLocaleString("ja-JP")} CR</div>
                </div>
              </div>
            )}
            <div className="mt-4 text-[12px] leading-relaxed opacity-70">
              クレジットは<b>記録から毎回数え直しています</b>。残高そのものは保存していないので、
              日報やテストの記録と食い違うことがありません。<b>建てるにはクレジットに加えて、その目標のタスクを達成していることが必要</b>です。
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ v, k }) {
  return (
    <div>
      <div className="font-mono text-sm font-bold leading-tight text-white">{v}</div>
      <div className="text-[9.5px] font-bold tracking-[.12em]" style={{ color: "#6C7A9C" }}>{k}</div>
    </div>
  );
}
function Src({ label, n, rate }) {
  return (
    <div className="rounded-xl p-3" style={{ background: T.soft }}>
      <div className="text-[10px] font-bold tracking-[.12em] opacity-60">{label}</div>
      <div className="font-mono text-lg font-bold">{(n ?? 0).toLocaleString("ja-JP")}<span className="ml-1 text-xs opacity-70">件</span></div>
      <div className="mt-1 text-[11px] opacity-70">× {rate ?? 0} CR</div>
    </div>
  );
}
function ZoomBtn({ icon: Icon, onClick, label }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-lg border backdrop-blur"
      style={{ borderColor: "rgba(58,71,112,.9)", background: "rgba(8,11,21,.75)", color: "#A3B0CE" }}>
      <Icon size={15} />
    </button>
  );
}

function LotCard({ p, owned, built, doneOk, credits, unknown, reachable, skinIndex, onBuyLand, onBuild, onSkin, onClose }) {
  const money = v => unknown ? "—" : `${v} CR`;
  const short = (v) => unknown ? null : credits < v ? `あと ${v - credits} CR 足りません。` : null;
  return (
    <div className="text-white">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[9.5px] font-bold tracking-[.18em]" style={{ color: "#F5C451" }}>
            {p.kind === "hall" ? "はじめからある建物" : p.kind === "park" ? "緑地" : p.goalTitle}
          </div>
          <div className="mt-0.5 text-lg font-bold leading-snug">
            {p.kind === "hall" ? "役所" : p.kind === "park" ? "公園" : shortName(p)}
          </div>
        </div>
        <button onClick={onClose} aria-label="閉じる" className="opacity-60 hover:opacity-100"><X size={16} /></button>
      </div>

      {p.kind === "task" && <div className="mt-1 text-[11.5px] leading-relaxed" style={{ color: "#A3B0CE" }}>{p.title}</div>}

      {p.kind === "hall" && <div className="mt-2 text-[11.5px]" style={{ color: "#6C7A9C" }}>ここから街をひろげます。となりの土地から順に買えます。</div>}
      {p.kind === "park" && owned && <div className="mt-2 text-[11.5px]" style={{ color: "#6C7A9C" }}>建物は建ちません。街の余白です。</div>}

      {!owned && p.kind !== "hall" && (
        <>
          <button disabled={unknown || !reachable || credits < landCost(p.gx, p.gy)} onClick={onBuyLand}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold disabled:cursor-default"
            style={{
              background: !unknown && reachable && credits >= landCost(p.gx, p.gy) ? "#F5C451" : "#1C2540",
              color: !unknown && reachable && credits >= landCost(p.gx, p.gy) ? "#1A1204" : "#6C7A9C",
            }}>
            <Coins size={15} />土地を買う<span className="font-mono">{money(landCost(p.gx, p.gy))}</span>
          </button>
          {!reachable && <div className="mt-2 text-[11px]" style={{ color: "#F5C451" }}>いま持っている土地に接していません。手前から順に買ってください。</div>}
          {reachable && short(landCost(p.gx, p.gy)) && <div className="mt-2 text-[11px]" style={{ color: "#F5C451" }}>{short(landCost(p.gx, p.gy))}</div>}
        </>
      )}

      {owned && p.kind === "task" && !built && (
        <>
          <div className="mt-3 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px]"
            style={{ background: doneOk ? "rgba(79,209,139,.14)" : "rgba(232,115,95,.13)" }}>
            {doneOk ? <Check size={14} style={{ color: "#4FD18B" }} /> : <X size={14} style={{ color: "#E8735F" }} />}
            <span style={{ color: doneOk ? "#BFE9D0" : "#F0BCB2" }}>
              {doneOk ? "このタスクは達成済みです" : "このタスクを達成すると建てられます"}
            </span>
          </div>
          <SkinRow value={skinIndex} onChange={onSkin} title="外観をえらぶ" />
          <button disabled={unknown || !doneOk || credits < p.cost} onClick={onBuild}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold disabled:cursor-default"
            style={{
              background: !unknown && doneOk && credits >= p.cost ? "#F5C451" : "#1C2540",
              color: !unknown && doneOk && credits >= p.cost ? "#1A1204" : "#6C7A9C",
            }}>
            <Sparkles size={15} />{doneOk ? "建てる" : "まだ建てられません"}<span className="font-mono">{money(p.cost)}</span>
          </button>
          {doneOk && short(p.cost) && <div className="mt-2 text-[11px]" style={{ color: "#F5C451" }}>{short(p.cost)}</div>}
        </>
      )}

      {owned && p.kind === "task" && built && (
        <>
          <div className="mt-2 flex items-center gap-2 text-[11.5px]" style={{ color: "#4FD18B" }}>
            <Check size={14} />建っています
          </div>
          <SkinRow value={skinIndex} onChange={onSkin} title={`外観を変える（${RESKIN} CR）`} />
        </>
      )}
    </div>
  );
}

function SkinRow({ value, onChange, title }) {
  return (
    <>
      <div className="mt-3 text-[10.5px]" style={{ color: "#6C7A9C" }}>{title}</div>
      <div className="mt-1.5 flex gap-1.5">
        {SKIN_NAMES.map((s, i) => (
          <button key={s.n} onClick={() => onChange(i)}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2"
            style={{ boxShadow: `inset 0 0 0 ${i === value ? 2 : 1}px ${i === value ? "#F5C451" : "#28314F"}`, background: i === value ? "#1C2540" : "transparent" }}>
            <span className="flex gap-0.5">
              {s.sw.map(c => <i key={c} className="block h-3 w-3 rounded-sm" style={{ background: c }} />)}
            </span>
            <span className="text-[9.5px] font-bold leading-tight" style={{ color: "#A3B0CE" }}>{s.n}</span>
          </button>
        ))}
      </div>
    </>
  );
}
