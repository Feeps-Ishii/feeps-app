import React from "react";
import { ChevronRight, Cloud, Lock, Play } from "lucide-react";
import { T, PRODUCT_ACCENT, PrismErrorRetryCard, SkeletonCards } from "../../components/common";
import {
  UNITS, GROUPS, GAINS, isPlayable, nextUnit, passedCount, gainsFor, formatDuration,
  groupStatus, groupOfUnit,
} from "./CloudLabCatalog.js";

// クラウド実習のハブ。承認モック: https://claude.ai/code/artifact/1bf70f70-c793-46c8-ac8e-615c3e700dc1
//
// 2026-09-07: 単元を平らに並べるのをやめ、**基礎／応用／運用のグループを先に見せる**
// 形へ変えた（ユーザー指示）。AWSはこの3つで求められるものが別物で、
// 11単元を1列にすると「どこまでやれば一区切りか」が分からなくなるため。
//
// 効かせているのは3つだけ（それ以外は足さない）。
//   1. グループごとに**何ができるようになるか**を1行で言う
//   2. 模型と本物を**同じ道すじの上**に並べる。Premiumが上位商品ではなく最後の一歩に見えるように
//   3. **できていないものを隠さない。** 準備中のグループも出して「まだ開けない」と言う
//
// 数字は取れたものだけを出す。取れなければ「確認できません＋再取得」（PrismErrorRetryCard）。

const A = PRODUCT_ACCENT.cloudlab;
const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };
const MONO = '"JetBrains Mono", ui-monospace, monospace';

function GroupCard({ group, progress, onOpen }) {
  const st = groupStatus(group, progress);
  const ratio = st.playable ? st.passed / st.playable : 0;
  return (
    <button type="button" onClick={() => onOpen(group.id)}
      className="flex w-full flex-col gap-3 rounded-2xl p-4 text-left transition hover:shadow-sm"
      style={{
        border: `1px solid ${st.open ? A.accent : C.line}`,
        background: st.open ? T.bgSurface : C.canvas,
      }}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-extrabold" style={{ letterSpacing: ".14em", color: st.open ? A.accent : C.muted }}>
          {group.en}
        </span>
        {st.cleared && (
          <span className="rounded-full px-2 py-[2px] text-[10px] font-extrabold"
            style={{ background: T.successSubtle, color: T.success }}>ここまで通過</span>
        )}
        {!st.open && (
          <span className="flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-extrabold"
            style={{ background: T.bgBase, color: C.muted, border: `1px solid ${C.line}` }}>
            <Lock size={9} />準備中
          </span>
        )}
        <ChevronRight size={15} className="ml-auto" style={{ color: st.open ? A.accent : C.line }} />
      </div>

      <div>
        <h3 className="m-0 text-[19px] font-extrabold" style={{ color: st.open ? C.ink : C.muted, letterSpacing: "-.01em" }}>
          {group.label}
        </h3>
        <p className="mb-0 mt-1 text-[12.5px] leading-[1.8]" style={{ color: C.body }}>{group.summary}</p>
      </div>

      <div className="mt-auto">
        <div className="flex items-center justify-between text-[11px]" style={{ color: C.muted }}>
          <span>{st.open ? <>いま開けるのは {st.playable} / {st.total} 単元</> : <>{st.total} 単元を用意中</>}</span>
          {st.open && (
            <b style={{ fontFamily: MONO, color: st.cleared ? T.success : C.ink }}>{st.passed} / {st.playable}</b>
          )}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: C.line }}>
          <i className="block h-full rounded-full"
            style={{ width: `${Math.round(ratio * 100)}%`, background: st.cleared ? T.success : A.accent }} />
        </div>
      </div>
    </button>
  );
}

export default function CloudLabHub({ progress, loading, error, onRetry, onOpenUnit, onOpenGroup }) {
  const done = progress ? passedCount(progress) : null;
  const next = progress ? nextUnit(progress) : null;
  const nextGroup = next ? groupOfUnit(next.id) : null;
  const gains = progress ? gainsFor(progress) : GAINS.map(g => ({ ...g, got: false }));
  const gotGains = gains.filter(g => g.got).length;
  const playableCount = UNITS.filter(isPlayable).length;
  const ratio = done == null ? 0 : done / UNITS.length;

  return (
    <div className="flex flex-col gap-4">
      {/* ── 看板 ── */}
      <div className="overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${A.gradFrom}, ${A.accent} 55%, ${A.gradTo})` }}>
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
            いま開ける単元 {playableCount}
          </span>
          <span className="rounded-full px-3 py-1.5"
            style={{ background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.28)" }}>
            費用 ¥0（模型のあいだ）
          </span>
        </div>
      </div>

      {error && <PrismErrorRetryCard message={error} onRetry={onRetry} />}
      {loading && !progress && <SkeletonCards count={2} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_268px]">
        <div className="flex flex-col gap-4">
          {/* ── 続きから。グループを経由せず、その単元へ直に入る ── */}
          {next && (
            <div className="flex flex-wrap items-center gap-4 rounded-r-2xl p-4"
              style={{ background: A.subtle, borderLeft: `3px solid ${A.accent}` }}>
              <div className="text-[22px] font-bold leading-none" style={{ fontFamily: MONO, color: A.deep }}>
                {String(next.no).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-extrabold" style={{ color: C.ink }}>
                  {next.title}
                  {nextGroup && <span className="ml-2 text-[11px] font-bold" style={{ color: A.deep }}>{nextGroup.label}</span>}
                </h3>
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
              <b>いま開ける単元は全部通りました。</b>
              <span style={{ color: C.body }}> 残りは準備中です（本物のAWSの実習と、応用・運用の模型）。</span>
            </div>
          )}

          {/* ── グループ ── */}
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="m-0 text-[13px] font-extrabold" style={{ color: C.ink }}>3つの段階</h3>
              <span className="text-[11px]" style={{ color: C.muted }}>基礎を通してから応用・運用へ進みます</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {GROUPS.map(g => (
                <GroupCard key={g.id} group={g} progress={progress} onOpen={onOpenGroup} />
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
                <div className="text-[23px] font-bold leading-[1.1]" style={{ fontFamily: MONO, color: C.ink }}>
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
                  <b style={{ fontFamily: MONO, color: C.ink }}>{v}</b>
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
