import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ExternalLink, Loader2, Lock, RotateCcw, Trash2 } from "lucide-react";
import { T, PRODUCT_ACCENT, PrismErrorRetryCard } from "../../components/common";
import { apiGet, apiPost, apiDelete } from "../../api.js";

// 単元7「本物のAWSで1回作る」。正典: docs/specs/aws-lab-spec.md §3・§6
//
// **受講生に見せるのは残り時間・延長・終了の3つだけ。** セッションIDもVPC IDも
// 出さない（受講生がやることはコンソールの中にあり、ここは出入口でしかない）。
//
// **終了を押すと得をする**書き方にしている。押さない人が増えるほど枠が埋まり、
// 他の受講生が待たされるため。罰ではなく「片付く利益」として書く。
//
// 残り時間はサーバーが出した秒数を起点に数える。**端末の時計を信じない**
// （ずれていると「まだあるのに切れる」「切れているのに残って見える」が起きる）。

const A = PRODUCT_ACCENT.cloudlab;
const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };
const MONO = '"JetBrains Mono", ui-monospace, monospace';

const STEPS = [
  ["サブネットを作る", "VPCの中を区切ります。10.0.1.0/24 のように範囲を決めます"],
  ["インターネットゲートウェイを付ける", "VPCの外との出入口です。作ってからVPCにアタッチします"],
  ["ルートテーブルを直す", "0.0.0.0/0 の行き先をIGWにして、サブネットに関連付けます"],
  ["セキュリティグループを作る", "80番（HTTP）を受け入れるようにします"],
  ["EC2を起動する", "t3.micro・パブリックIPあり。ユーザーデータでWebサーバーを動かします"],
  ["ブラウザで開く", "パブリックIPに http:// でアクセスします"],
];

function clock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function CloudLabConsoleUnit({ unit, onBack }) {
  const [state, setState] = useState(null);      // null = まだ分からない
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [left, setLeft] = useState(null);

  const load = useCallback(() => {
    setError("");
    return apiGet("/cloudlab/session")
      .then(res => {
        setState(res);
        setLeft(res?.session ? res.session.remainingSeconds : null);
      })
      .catch(e => setError(e?.errorMessage || e?.message || "実習の状態を確認できません。"));
  }, []);

  useEffect(() => { load(); }, [load]);

  // 残り時間の数え下げ。1秒ごとに1つ減らすだけで、端末の時計は見ない
  useEffect(() => {
    if (left == null) return undefined;
    const id = setInterval(() => setLeft(v => (v == null ? v : Math.max(0, v - 1))), 1000);
    return () => clearInterval(id);
  }, [left == null]);

  // 期限が来たら実際に消えているので、状態を取り直す
  useEffect(() => {
    if (left === 0) { const id = setTimeout(load, 3000); return () => clearTimeout(id); }
    return undefined;
  }, [left, load]);

  const openConsole = useCallback((url) => {
    // 認証情報を含むURLなので**残さない**。新しいタブへ渡してそれきりにする
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) setError("ブラウザが新しいタブを開けませんでした。ポップアップの許可をご確認ください。");
  }, []);

  async function start() {
    setBusy("start"); setError("");
    try {
      const res = await apiPost("/cloudlab/session", {});
      setState(s => ({ ...(s || {}), session: res.session }));
      setLeft(res.session?.remainingSeconds ?? null);
      openConsole(res.consoleUrl);
      load();
    } catch (e) {
      setError(e?.status === 409
        ? "いま満席です。空くまで少しお待ちください。"
        : (e?.errorMessage || e?.message || "実習を始められませんでした。"));
      load();
    } finally { setBusy(""); }
  }

  async function reopen() {
    setBusy("reopen"); setError("");
    try {
      const res = await apiPost("/cloudlab/session/console", {});
      openConsole(res.consoleUrl);
    } catch (e) {
      setError(e?.errorMessage || e?.message || "コンソールを開き直せませんでした。");
    } finally { setBusy(""); }
  }

  async function extend() {
    setBusy("extend"); setError("");
    try {
      const res = await apiPost("/cloudlab/session/extend", {});
      setLeft(res.session?.remainingSeconds ?? null);
      setState(s => ({ ...(s || {}), session: res.session }));
    } catch (e) {
      setError(e?.errorMessage || e?.message || "延長できませんでした。");
    } finally { setBusy(""); }
  }

  async function finish() {
    if (!window.confirm("実習を終了します。作ったものはすべて消えます。よろしいですか？")) return;
    setBusy("finish"); setError("");
    try {
      await apiDelete("/cloudlab/session");
      setLeft(null);
      await load();
    } catch (e) {
      setError(e?.errorMessage || e?.message || "終了できませんでした。");
    } finally { setBusy(""); }
  }

  const session = state?.session || null;
  const cap = state?.capacity || null;
  const free = cap?.free;
  const minutes = state?.sessionMinutes ?? 90;

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack}
        className="flex w-fit items-center gap-1.5 text-[12.5px] font-bold" style={{ color: A.deep }}>
        <ArrowLeft size={14} />基礎の単元へ戻る
      </button>

      <div>
        <div className="text-[10.5px] font-extrabold" style={{ letterSpacing: ".14em", color: A.accent }}>
          基礎 単元 {unit.no} ／ クラウド実習
        </div>
        <h2 className="mt-1.5 text-[24px] font-extrabold leading-[1.35]" style={{ color: C.ink, letterSpacing: "-.02em" }}>
          {unit.title}
        </h2>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.95]" style={{ color: C.body }}>
          ここまで模型で組んだものを、<b style={{ color: C.ink }}>本物のAWSコンソール</b>で同じように作ります。
          模型と違って、通らないときのメッセージは本物のものです。それを読めるようになるのがこの単元です。
        </p>
      </div>

      {error && <PrismErrorRetryCard message={error} onRetry={load} />}

      {/* ── セッション中 ── */}
      {session ? (
        <div className="rounded-2xl p-4" style={{ border: `1px solid ${T.warning}`, background: T.warningSubtle }}>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="m-0 text-[13.5px] font-extrabold" style={{ color: C.ink }}>
              本物のAWSコンソールを開いています
            </h3>
            <span className="ml-auto text-[22px] font-bold"
              style={{ fontFamily: MONO, color: T.warning, fontVariantNumeric: "tabular-nums" }}>
              残り {clock(left ?? session.remainingSeconds)}
            </span>
          </div>
          <p className="mb-0 mt-2 text-[12.5px] leading-[1.85]" style={{ color: C.body }}>
            この時間が過ぎると、あなたが作ったものは<b style={{ color: C.ink }}>まとめて自動で消えます</b>。
            消し忘れも費用も残りません。
            <b style={{ color: C.ink }}>作業が終わったら「終了する」を押してください</b>——待たずにその場で片付き、
            次の人がすぐ使えるようになります。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={finish} disabled={!!busy}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-white disabled:opacity-50"
              style={{ background: T.warning }}>
              {busy === "finish" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              終了する（すぐ片付ける）
            </button>
            <button type="button" onClick={extend} disabled={!!busy}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12.5px] font-bold disabled:opacity-50"
              style={{ border: `1px solid ${C.line}`, background: T.bgSurface, color: C.body }}>
              {busy === "extend" ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              {state?.extendMinutes ?? 30}分 延長する
            </button>
            <button type="button" onClick={reopen} disabled={!!busy}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12.5px] font-bold disabled:opacity-50"
              style={{ border: `1px solid ${A.accent}`, background: A.subtle, color: A.deep }}>
              {busy === "reopen" ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
              AWSコンソールを開く
            </button>
          </div>
        </div>
      ) : (
        /* ── まだ始めていない ── */
        <div className="rounded-2xl p-5" style={{ border: `1px solid ${C.line}`, background: T.bgSurface }}>
          {state && !state.premium ? (
            <div className="flex items-start gap-3">
              <Lock size={16} className="mt-0.5 shrink-0" style={{ color: C.muted }} />
              <div>
                <h3 className="m-0 text-[14px] font-extrabold" style={{ color: C.ink }}>Premiumプランでご利用いただけます</h3>
                <p className="mb-0 mt-1.5 text-[12.5px] leading-[1.85]" style={{ color: C.body }}>
                  本物のAWSを使う実習はPremiumプランの機能です。模型の単元（1〜6）は今のプランのままお使いいただけます。
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="m-0 text-[14px] font-extrabold" style={{ color: C.ink }}>本物のAWSを開く</h3>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: free === 0 ? T.dangerSubtle : A.subtle, color: free === 0 ? T.danger : A.deep }}>
                  {free == null ? "空き枠を確認できません" : free === 0 ? "いま満席です" : `空き ${free} / ${cap.total}`}
                </span>
              </div>
              <p className="mt-2 text-[12.5px] leading-[1.85]" style={{ color: C.body }}>
                ログイン操作はありません。押すと新しいタブでAWSコンソールが開き、
                <b style={{ color: C.ink }}>あなた専用のVPCが1つ用意された状態</b>から始まります。
                使えるのは<b style={{ color: C.ink }}>{minutes}分</b>。延長もできます。
                アカウントの作成もクレジットカードの登録も要りません。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={start} disabled={!!busy || !state || free === 0}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-3 text-[13px] font-bold text-white disabled:opacity-50"
                  style={{ background: A.accent }}>
                  {busy === "start" ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                  本物のAWSコンソールを開く
                </button>
                {!state && !error && <span className="text-[12px]" style={{ color: C.muted }}>確認しています…</span>}
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl p-3 text-[12px] leading-[1.8]"
                style={{ background: C.canvas, color: C.body }}>
                <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: T.warning }} />
                <span>
                  触れるのは<b style={{ color: C.ink }}>あなたのVPCの中だけ</b>で、起動できるのは t3.micro が1種類だけです。
                  高い資源は権限で止めてあるので、操作を間違えても費用は発生しません。
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── やること ── */}
      <div className="rounded-2xl" style={{ border: `1px solid ${C.line}`, background: T.bgSurface }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <h3 className="m-0 text-[13px] font-extrabold" style={{ color: C.ink }}>コンソールでやること</h3>
          <span className="text-[11px]" style={{ color: C.muted }}>模型の単元2〜4と同じ順番です</span>
        </div>
        <ol className="m-0 list-none p-0">
          {STEPS.map(([title, desc], i) => (
            <li key={title} className="flex items-start gap-3 px-4 py-3"
              style={{ borderTop: i ? `1px dashed ${C.line}` : "none" }}>
              <span className="mt-[1px] grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                style={{ fontFamily: MONO, border: `2px solid ${C.line}`, color: C.muted }}>{i + 1}</span>
              <span>
                <span className="block text-[13.5px] font-bold" style={{ color: C.ink }}>{title}</span>
                <span className="mt-0.5 block text-[12px] leading-[1.75]" style={{ color: C.body }}>{desc}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
