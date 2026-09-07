import React from "react";
import { Check, ChevronRight, Cloud, Lock, Play } from "lucide-react";
import { T, PRODUCT_ACCENT, PrismErrorRetryCard, SkeletonCards } from "../../components/common";
import { UNITS, GAINS, isPlayable, nextUnit, passedCount, gainsFor, formatDuration } from "./CloudLabCatalog.js";

// クラウド実習のハブ。承認モック: https://claude.ai/code/artifact/1bf70f70-c793-46c8-ac8e-615c3e700dc1
//
// 効かせているのは3つだけ（それ以外は足さない）。
//   1. 単元ごとに**何につまずくか**を先に見せる。AWSの学習で値打ちがあるのは通らない体験そのもの
//   2. 模型と本物を**同じ道すじの上**に並べる。Premiumが上位商品ではなく最後の一歩に見えるように
//   3. **できていないものを隠さない。** 準備中も一覧に出して「まだ開けない」と言う
//
// 数字は取れたものだけを出す。取れなければ「確認できません＋再取得」（PrismErrorRetryCard）。

const A = PRODUCT_ACCENT.cloudlab;
const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

function Pill({ kind, children }) {
  const style = {
    mock: { background: T.bgBase, color: C.muted, border: `1px solid ${C.line}` },
    real: { background: "#2C2C34", color: "#fff" },
    prem: { background: T.warningSubtle, color: T.warning },
    ok: { background: T.successSubtle, color: T.success },
    wait: { background: T.bgBase, color: C.muted, border: `1px solid ${C.line}` },
  }[kind] || {};
  return (
    <span className="rounded-full px-2 py-[2px] text-[10px] font-extrabold" style={{ letterSpacing: ".03em", ...style }}>
      {children}
    </span>
  );
}

function Unit({ unit, passed, onOpen }) {
  const playable = isPlayable(unit);
  const open = playable && !!onOpen;
  return (
    <button
      type="button" disabled={!open} onClick={open ? () => onOpen(unit.id) : undefined}
      className="flex w-full items-start gap-3 py-3 text-left transition enabled:hover:bg-black/[.02] disabled:cursor-default"
      style={{ borderTop: `1px dashed ${C.line}` }}>
      <span className="mt-[1px] grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
        style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          border: `2px solid ${passed ? T.success : playable ? A.accent : C.line}`,
          background: passed ? T.success : T.bgSurface,
          color: passed ? "#fff" : playable ? A.deep : C.muted,
        }}>
        {passed ? <Check size={12} strokeWidth={3} /> : unit.no}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold" style={{ color: playable ? C.ink : C.muted }}>
          {unit.title}
          {unit.status === "external" ? <Pill kind="real">本物</Pill> : <Pill kind="mock">模型</Pill>}
          {unit.premium && <Pill kind="prem">Premium</Pill>}
          {passed && <Pill kind="ok">通過</Pill>}
          {!playable && !passed && <Pill kind="wait">準備中</Pill>}
        </span>
        <span className="mt-1 block text-[12px] leading-[1.75]" style={{ color: C.body }}>
          {playable
            ? <>つまずき: <b style={{ color: C.ink }}>{unit.fail}</b></>
            : <>{unit.touch}。<span style={{ color: C.muted }}>いま作れません（{unit.needs}が要ります）</span></>}
        </span>
      </span>
      {open
        ? <ChevronRight size={16} className="mt-1 shrink-0" style={{ color: A.accent }} />
        : <Lock size={13} className="mt-1.5 shrink-0" style={{ color: C.line }} />}
    </button>
  );
}

export default function CloudLabHub({ progress, loading, error, onRetry, onOpenUnit }) {
  const passedUnits = progress?.units || {};
  const done = progress ? passedCount(progress) : null;
  const next = progress ? nextUnit(progress) : null;
  const gains = progress ? gainsFor(progress) : GAINS.map(g => ({ ...g, got: false }));
  const gotGains = gains.filter(g => g.got).length;
  const playableCount = UNITS.filter(isPlayable).length;
  const ratio = done == null ? 0 : done / UNITS.length;

  return (
    <div className="flex flex-col gap-4">
      {/* ── 看板 ── */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${A.gradFrom}, ${A.accent} 55%, ${A.gradTo})` }}>
        <div className="relative">
          <div className="flex items-center gap-2 text-[10.5px] font-extrabold" style={{ letterSpacing: ".16em", opacity: .85 }}>
            <Cloud size={13} />CLOUD LAB ／ AWS
          </div>
          <h2 className="mt-2 text-[26px] font-extrabold leading-[1.3]" style={{ letterSpacing: "-.02em" }}>
            AWSを、読むのではなく動かす
          </h2>
          <p className="mt-2 max-w-[52ch] text-[13px] leading-[1.85]" style={{ opacity: .93 }}>
            VPCを区切り、EC2を起動し、外から繋がらない理由を自分で突き止めます。
            費用も事故もない模型で因果をつかんでから、本物のAWSコンソールで同じものを作ります。
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11.5px] font-bold">
            <span className="rounded-full px-3 py-1.5"
              style={{ background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.28)" }}>
              いま遊べる単元 {playableCount}
            </span>
            <span className="rounded-full px-3 py-1.5"
              style={{ background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.28)" }}>
              費用 ¥0（模型のあいだ）
            </span>
          </div>
        </div>
      </div>

      {error && <PrismErrorRetryCard message={error} onRetry={onRetry} />}
      {loading && !progress && <SkeletonCards count={2} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_268px]">
        <div className="flex flex-col gap-4">
          {/* ── 続きから ── */}
          {next && (
            <div className="flex flex-wrap items-center gap-4 rounded-r-2xl p-4"
              style={{ background: A.subtle, borderLeft: `3px solid ${A.accent}` }}>
              <div className="text-[22px] font-bold leading-none"
                style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: A.deep }}>
                {String(next.no).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-extrabold" style={{ color: C.ink }}>{next.title}</h3>
                <p className="mb-0 mt-1 text-[12.5px] leading-[1.75]" style={{ color: C.body }}>
                  つまずくのは「{next.fail}」。ここを自分で突き止めます。
                </p>
              </div>
              <button type="button" onClick={() => onOpenUnit(next.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-white"
                style={{ background: A.accent }}>
                <Play size={13} />{done ? "続きから" : "はじめる"}
              </button>
            </div>
          )}
          {progress && !next && (
            <div className="rounded-2xl p-4 text-[13px]" style={{ background: T.successSubtle, color: T.success }}>
              <b>いま遊べる単元は全部通りました。</b>
              <span style={{ color: C.body }}> 残りは準備中です（本物のAWSの実習と、模型の追加）。</span>
            </div>
          )}

          {/* ── 単元の道すじ ── */}
          <div className="rounded-2xl" style={{ border: `1px solid ${C.line}`, background: T.bgSurface }}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              style={{ borderBottom: `1px solid ${C.line}` }}>
              <h3 className="m-0 text-[13px] font-extrabold" style={{ color: C.ink }}>単元の道すじ</h3>
              <span className="text-[11px]" style={{ color: C.muted }}>模型で掴んでから、本物で1回作る</span>
            </div>
            <div className="px-4 pb-2">
              {UNITS.map(u => (
                <Unit key={u.id} unit={u} passed={!!passedUnits[u.id]?.passedAt} onOpen={onOpenUnit} />
              ))}
            </div>
          </div>
        </div>

        {/* ── 右カラム ── */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-4" style={{ border: `1px solid ${C.line}`, background: T.bgSurface }}>
            <div className="flex items-center gap-4">
              <svg width="66" height="66" viewBox="0 0 66 66" role="img"
                aria-label={done == null ? "進捗は確認できません" : `${UNITS.length}単元中${done}単元が完了`}>
                <circle cx="33" cy="33" r="27" fill="none" stroke={C.line} strokeWidth="8" />
                {done != null && (
                  <circle cx="33" cy="33" r="27" fill="none" stroke={A.accent} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(2 * Math.PI * 27 * ratio).toFixed(1)} ${(2 * Math.PI * 27).toFixed(1)}`}
                    transform="rotate(-90 33 33)" />
                )}
              </svg>
              <div>
                <div className="text-[23px] font-bold leading-[1.1]"
                  style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: C.ink }}>
                  {done == null ? "—" : `${done} / ${UNITS.length}`}
                </div>
                <div className="text-[11.5px]" style={{ color: C.muted }}>単元を通過</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl" style={{ border: `1px solid ${C.line}`, background: T.bgSurface }}>
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
              <h3 className="m-0 text-[13px] font-extrabold" style={{ color: C.ink }}>実習の記録</h3>
            </div>
            <div className="px-4 py-2 text-[12.5px]">
              {[
                ["模型で触った時間", progress ? formatDuration(progress.totalSeconds) : "—"],
                ["本物のAWS", "未実施"],
                ["使った費用", "¥0"],
              ].map(([k, v], i) => (
                <div key={k} className="flex justify-between py-2"
                  style={{ color: C.body, borderTop: i ? `1px solid ${C.line}` : "none" }}>
                  <span>{k}</span>
                  <b style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: C.ink }}>{v}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl" style={{ border: `1px solid ${C.line}`, background: T.bgSurface }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
              <h3 className="m-0 text-[13px] font-extrabold" style={{ color: C.ink }}>身についたこと</h3>
              <span className="text-[11px]" style={{ color: C.muted }}>{gotGains} / {gains.length}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 p-4">
              {gains.map(g => (
                <span key={g.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px]"
                  style={{
                    border: `1px solid ${g.got ? A.accent : C.line}`,
                    background: g.got ? A.subtle : C.canvas,
                    color: g.got ? A.deep : C.muted,
                    fontWeight: g.got ? 700 : 400,
                  }}>
                  <i className="h-2 w-2 rounded-sm" style={{ background: g.got ? A.accent : C.line }} />
                  {g.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
