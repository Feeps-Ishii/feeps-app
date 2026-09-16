import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPut } from "../../api.js";
import { Card, Btn, PageHeader, T } from "../../components/common";
import { AlertCircle, ChevronDown, ChevronUp, Lock, Maximize2, Moon, RotateCcw, RotateCw, Shuffle, Sun } from "lucide-react";
import { GENRES, CATALOG, nextGenre, unlockedGenres } from "./town3/catalog.js";

/* 成長の街。
 *
 * **three.js は動的importでしか読まない。** 街を開いた人だけが読み込むようにして、
 * 研修画面ぜんたいのバンドルを太らせない。
 *
 * **3Dは区画の見た目と当たり判定だけを持つ。** 数値と選択状態は world.js から
 * コールバックで受け取り、画面はここが描く。3Dを読まずに文言を直せるようにしておく。 */

const SAVE_DELAY = 1200;

/* クレジットの入り口。サーバ（town.mjs）の CR_REPORT / CR_TEST / CR_LOGIN と同じ値を、
   「どうすれば増えるか」として見せる。実際の付与はサーバの記録から数え直す（ここは案内だけ）。 */
const EARN_WAYS = [
  { key: "report", label: "日報を出す",       cr: 20, how: "その日の学びを書いて提出する。1件ごとに入ります。", to: ["training", "reports"], cta: "日報を書く" },
  { key: "test",   label: "確認テストに合格", cr: 60, how: "70点以上で合格。同じテストは初回合格ぶんが入ります。", to: ["learning", "el_courses"], cta: "コースを見る" },
  { key: "login",  label: "その日にひらく",   cr: 25, how: "学びに来た日が1日ぶんとして入ります。", to: null, cta: null },
];

function Num({ v, k, accent }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-lg font-bold leading-none" style={{ color: accent || "#F3F7FB" }}>{v}</div>
      <div className="mt-1 text-[10px] opacity-70">{k}</div>
    </div>
  );
}

export default function TownView({ goProduct }) {
  const canvasRef = useRef(null);
  const hostRef = useRef(null);
  const worldRef = useRef(null);
  const saveTimer = useRef(0);
  const saveChain = useRef(Promise.resolve());
  const noteTimer = useRef(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [remote, setRemote] = useState(null);
  const [stats, setStats] = useState(null);
  const [sel, setSel] = useState(null);
  const [note, setNote] = useState(null);
  const [saveErr, setSaveErr] = useState("");
  const [dusk, setDusk] = useState(false);

  const credits = remote?.credits;
  const unknown = credits == null;
  const completed = remote?.completedCourses;
  const open = useMemo(() => unlockedGenres(completed ?? 0), [completed]);
  const openSet = useMemo(() => new Set(open), [open]);
  const next = useMemo(() => nextGenre(completed ?? 0), [completed]);

  /* ---- 読み込み ---- */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    apiGet("/town/me")
      .then(r => { if (alive) { setRemote(r); setLoading(false); } })
      .catch(e => { if (alive) { setErr(e?.message || "通信に失敗しました。"); setLoading(false); } });
    return () => { alive = false; };
  }, [reloadKey]);

  /* ---- 保存。まとめて送り、順番に流す ---- */
  const save = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    const st = world.getState();
    saveChain.current = saveChain.current
      .then(() => apiPut("/town/me", { spent: st.spent, town: st }))
      .then(r => {
        setSaveErr("");
        setRemote(prev => (prev ? { ...prev, credits: r?.credits ?? prev.credits, spent: r?.spent ?? prev.spent } : prev));
        if (r && typeof r.credits === "number") world.setPoints(r.credits);
      })
      .catch(e => setSaveErr(e?.message || "街を保存できませんでした。"));
  }, []);

  const queueSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, SAVE_DELAY);
  }, [save]);

  /* ---- 3Dの立ち上げ ---- */
  useEffect(() => {
    if (!remote || !canvasRef.current || !hostRef.current) return;
    let alive = true;
    let world = null;

    import("./town3/world.js").then(mod => {
      if (!alive || !canvasRef.current) return;
      world = mod.createTown(canvasRef.current, hostRef.current, {
        onStats: s => setStats(s),
        onSelect: s => setSel(s),
        onToast: (t, s) => {
          setNote({ t, s });
          clearTimeout(noteTimer.current);
          noteTimer.current = setTimeout(() => setNote(null), 4200);
        },
        onChange: queueSave,
      });
      worldRef.current = world;
      world.setUnlocked(unlockedGenres(remote.completedCourses ?? 0));
      world.setPoints(remote.credits ?? 0);
      if (remote.town && Array.isArray(remote.town.plots) && remote.town.plots.length) {
        world.applyState(remote.town);
      }
    }).catch(e => setErr(e?.message || "3Dの読み込みに失敗しました。"));

    return () => {
      alive = false;
      clearTimeout(saveTimer.current);
      clearTimeout(noteTimer.current);
      if (world) world.dispose();
      worldRef.current = null;
    };
    // remote は最初の1回だけで作る。以後の残高は setPoints で渡す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote ? "ready" : "wait", reloadKey]);

  /* ---- 残高と解放を3Dへ渡し直す ---- */
  useEffect(() => {
    const world = worldRef.current;
    if (!world || !remote) return;
    world.setPoints(remote.credits ?? 0);
    world.setUnlocked(unlockedGenres(remote.completedCourses ?? 0));
  }, [remote]);

  const act = useCallback((fn) => () => { const w = worldRef.current; if (w) fn(w); }, []);

  const selLabel = !sel ? "区画をタップして選ぶ"
    : sel.water ? "ここは水面です"
    : sel.span ? "この大きな施設を建て替える"
    : !sel.item ? "この荒れ地に建てる"
    : "この区画を建て替える";
  const selSub = !sel ? "整えた区画も選べます。建て替えは何度でもできます。"
    : sel.water ? "「盛る」で一段上げると建てられます。"
    : !sel.item ? `${sel.cost} クレジット${sel.level ? ` ・高さ ${sel.level}段` : ""}`
    : `建て替えは無料${sel.level ? ` ・高さ ${sel.level}段` : ""}`;

  if (err) {
    return (
      <div>
        <PageHeader product="talent" label="スキル・成長" title="成長の街"
          description="学びの記録がクレジットになり、区画をひらいて街をつくります。" />
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
      </div>
    );
  }

  return (
    <div>
      <PageHeader product="talent" label="スキル・成長" title="成長の街"
        description="学びの記録がクレジットになります。区画をひらいて何を建てるか選び、盛って段差をつけ、道路と線路をつなげて街をつくります。" />

      {remote?.rebuilt ? (
        <Card className="mt-5 p-4">
          <div className="text-sm font-bold">街を作り直しました</div>
          <div className="mt-1 text-xs opacity-75">
            区画ごとに建てるものを選べる街になりました。前の街で使ったクレジットはお返ししてあります。
          </div>
        </Card>
      ) : null}

      <div ref={hostRef} className="relative mt-5 overflow-hidden rounded-2xl border"
        style={{ borderColor: T.line, background: "#BDE3F2" }}>
        <canvas ref={canvasRef} className="block h-full w-full"
          style={{ aspectRatio: "16 / 10", maxHeight: "70vh", touchAction: "none" }} />

        {/* 数値 */}
        <div className="pointer-events-none absolute right-3 top-3 rounded-xl border px-3 py-2 backdrop-blur"
          style={{ borderColor: "rgba(255,255,255,.7)", background: "rgba(255,255,255,.82)" }}>
          <div className="text-[9.5px] font-bold tracking-[.16em]" style={{ color: "#C7891F" }}>CREDIT</div>
          <div className="font-mono text-xl font-bold leading-none" style={{ color: "#1F2A36" }}>
            {unknown ? "—" : Math.floor(credits).toLocaleString("ja-JP")}
          </div>
          {stats ? (
            <div className="mt-2 flex gap-4 border-t pt-2 text-[#1F2A36]" style={{ borderColor: "rgba(31,42,54,.12)" }}>
              <Num v={`${stats.done}`} k="ひらいた区画" accent="#1F2A36" />
              <Num v={`${stats.left}`} k="残り" accent="#1F2A36" />
              <Num v={`${stats.cost}`} k="次の区画" accent="#C7891F" />
            </div>
          ) : null}
        </div>

        {/* お題 */}
        {stats ? (
          <div className="pointer-events-none absolute left-3 top-3 max-w-[min(320px,calc(100%-120px))] rounded-xl border px-3 py-2 backdrop-blur"
            style={{ borderColor: "rgba(255,255,255,.7)", background: "rgba(255,255,255,.82)", color: "#1F2A36" }}>
            <div className="text-[9.5px] font-bold tracking-[.16em]" style={{ color: "#2F9E92" }}>いまのお題</div>
            <div className="mt-0.5 text-[13px] font-bold">{stats.questText || "お題はぜんぶ達成"}</div>
            <div className="mt-0.5 text-[10.5px] leading-relaxed opacity-70">
              {stats.questSub || "あとは好きなだけ街を作り込めます。"}
            </div>
          </div>
        ) : null}

        {/* お知らせ */}
        {note ? (
          <div className="pointer-events-none absolute left-1/2 top-3 w-[min(360px,calc(100%-24px))] -translate-x-1/2 rounded-xl border px-4 py-2 text-center backdrop-blur"
            style={{ borderColor: "rgba(255,255,255,.7)", background: "rgba(255,255,255,.9)", color: "#1F2A36" }}>
            <div className="text-[13px] font-bold">{note.t}</div>
            {note.s ? <div className="mt-0.5 text-[11px] leading-relaxed opacity-75">{note.s}</div> : null}
          </div>
        ) : null}

        {loading ? (
          <div className="absolute inset-0 grid place-items-center text-sm" style={{ background: "#BDE3F2", color: "#3A5568" }}>
            街を読み込んでいます…
          </div>
        ) : null}
      </div>

      {unknown ? (
        <Card className="mt-4 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} style={{ color: T.warn }} />
            <div className="min-w-0 text-sm">
              <div className="font-bold">いまはクレジットを確認できません</div>
              <div className="mt-1 text-xs opacity-75">記録の読み取りに失敗しているため、残高を出していません。時間をおいて開き直してください。区画をひらく操作は保存されません。</div>
            </div>
          </div>
        </Card>
      ) : null}
      {saveErr ? (
        <Card className="mt-4 p-4">
          <div className="text-sm font-bold">街を保存できませんでした</div>
          <div className="mt-1 text-xs opacity-75">{saveErr}</div>
        </Card>
      ) : null}

      {/* 選んだ区画に建てるもの */}
      <Card className="mt-5 p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <div className="font-bold">{selLabel}</div>
          <div className="text-xs opacity-70">{selSub}</div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {GENRES.map(g => {
            const isOpen = openSet.has(g.id);
            const items = CATALOG.filter(it => it.g === g.id);
            return (
              <div key={g.id} className="min-w-0">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[.12em] opacity-60">
                  {isOpen ? null : <Lock size={11} />}{g.name}
                </div>
                {isOpen ? (
                  <div className="grid gap-1.5">
                    {items.map(it => {
                      const here = sel && sel.item === it.id;
                      return (
                        <button key={it.id} type="button"
                          onClick={act(w => w.place(it.id))}
                          disabled={!sel || sel.water || unknown}
                          className="rounded-xl border px-2.5 py-2 text-left transition disabled:opacity-45"
                          style={{
                            borderColor: here ? T.brand : "transparent",
                            background: here ? "rgba(63,184,175,.12)" : "rgba(34,48,61,.05)",
                          }}>
                          <div className="text-[12px] font-bold">{it.name}{here ? " ・いま" : ""}</div>
                          <div className="text-[9.5px] opacity-60">{it.d}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed px-2.5 py-3 text-[10.5px] leading-relaxed"
                    style={{ borderColor: "rgba(63,184,175,.45)", background: "rgba(63,184,175,.06)" }}>
                    <b className="block text-[11.5px]">あと {g.needCourses - (completed ?? 0)} コース修了</b>
                    で置けるようになります
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: T.line }}>
          <Btn kind="ghost" size="sm" icon={ChevronUp} onClick={act(w => w.level(1))}>盛る</Btn>
          <Btn kind="ghost" size="sm" icon={ChevronDown} onClick={act(w => w.level(-1))}>削る</Btn>
          <Btn kind="ghost" size="sm" icon={RotateCw} onClick={act(w => w.turn())}>向きを変える</Btn>
          <Btn kind="ghost" size="sm" icon={Shuffle} onClick={act(w => w.auto())}>おまかせ</Btn>
          <Btn kind="ghost" size="sm" icon={dusk ? Sun : Moon}
            onClick={act(w => { const v = !dusk; setDusk(v); w.setDusk(v); })}>{dusk ? "昼" : "夕方"}</Btn>
          <Btn kind="ghost" size="sm" icon={Maximize2} onClick={act(w => w.fit(true))}>全体を見る</Btn>
        </div>
        <div className="mt-2 text-[11px] opacity-60">
          区画をタップ → 建てるものを選ぶ ／ ドラッグで見回す ／ ホイールで寄る ／ 同じ高さに盛ったとなりとは土地がつながり、段差には階段ができます
        </div>
      </Card>

      {/* 街の効果と、クレジットの増やし方 */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="font-bold">街の効果</div>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li className={stats?.hall ? "" : "opacity-60"}>
              <b>市役所</b> … {stats?.hall ? "あり。土地を広げられます" : "なし。これがないと土地が広がりません"}
            </li>
            <li className={stats?.depot ? "" : "opacity-60"}>
              <b>工務店</b> … {stats?.depot ? `×${stats.depot}　区画の費用が −${stats.depot * 12}%` : "1軒ごとに区画の費用が下がります"}
            </li>
            <li className={stats?.campus ? "" : "opacity-60"}>
              <b>研修センター</b> … {stats?.campus ? `×${stats.campus}　収入が ＋${stats.campus * 25}%` : "建てると街の収入が上がります"}
            </li>
            <li className={stats?.station ? "" : "opacity-60"}>
              <b>駅</b> … {stats?.station ? `×${stats.station}　となりの区画が 1.3倍` : "となり合う区画の収入が上がります"}
            </li>
          </ul>
          <div className="mt-3 border-t pt-3 text-xs opacity-75" style={{ borderColor: T.line }}>
            修了したコース {completed == null ? "—" : completed} 件。
            {next ? `あと ${next.remain} コースで「${next.genre.name}」が開きます。` : "すべてのジャンルが開いています。"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="font-bold">クレジットの増やし方</div>
          <div className="mt-2 space-y-2">
            {EARN_WAYS.map(w => (
              <div key={w.key} className="flex items-start justify-between gap-3 rounded-xl px-3 py-2"
                style={{ background: "rgba(34,48,61,.04)" }}>
                <div className="min-w-0">
                  <div className="text-sm font-bold">{w.label}<span className="ml-2 font-mono text-xs opacity-70">+{w.cr}</span></div>
                  <div className="mt-0.5 text-[11px] leading-relaxed opacity-70">{w.how}</div>
                </div>
                {w.to && goProduct ? (
                  <Btn kind="ghost" size="sm" onClick={() => goProduct(w.to[0], { subView: w.to[1] })}>{w.cta}</Btn>
                ) : null}
              </div>
            ))}
          </div>
          {remote?.sources ? (
            <div className="mt-3 border-t pt-3 text-xs opacity-75" style={{ borderColor: T.line }}>
              日報 {remote.sources.reports ?? "—"} 件 ／ テスト合格 {remote.sources.passedTests ?? "—"} 件 ／ 来た日 {remote.sources.loginDays ?? "—"} 日
              ｜ 使った {Math.floor(remote.spent || 0).toLocaleString("ja-JP")}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
