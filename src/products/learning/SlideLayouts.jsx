import React from "react";
import { AlertCircle, HelpCircle, Lightbulb, MessageCircle } from "lucide-react";
import { T } from "../../components/common";

// 2026-08-24: 公式コース用のスライド版面。
// 承認モック: mock/slide-layouts/index.html / 仕様: docs/design/slide-layouts.md
//
// 守ること:
//   ・色を増やさない（既存トークンだけ）。区別は余白・字の重さ・囲みの役割で作る
//   ・意味のある要素には data-focus を付ける（読み上げ中に指し示せる）
//   ・refを増やしたら slideFocusTargets を Frontend/Backend の**両方**直す

const C = { ink: T.textPrimary, body: T.textSecondary, muted: T.textMuted, line: T.border, canvas: T.bgBase };

export function SlideEyebrowText({ chapter, chapterTitle }) {
  if (!chapter && !chapterTitle) return null;
  return (
    <div className="mb-2.5 text-[11px] font-bold" style={{ color: C.muted, letterSpacing: "0.1em" }}>
      {chapter && <span style={{ color: T.accent, fontWeight: 800 }}>CHAPTER {chapter}</span>}
      {chapter && chapterTitle ? " / " : ""}
      {chapterTitle}
    </div>
  );
}

function Title({ children }) {
  return (
    <h3 className="mb-4 text-[24px] font-extrabold leading-[1.4]" style={{ color: C.ink, letterSpacing: "-0.025em", textWrap: "balance" }}>
      {children}
    </h3>
  );
}

function Lead({ children }) {
  if (!children) return null;
  // 幅はスライドいっぱいに使う（2026-08-26の指摘。右側が大きく空いて見えた）。
  return <p className="mb-5 text-[14.5px] leading-[1.95]" style={{ color: C.body }}>{children}</p>;
}

// ---- 章中扉 ----
// 番号を大きく出す。いま何章のどこかが分かることが目的。
export function ChapterSlide({ content = {} }) {
  return (
    <div
      className="relative -m-5 overflow-hidden px-8 py-11 text-white sm:-m-8 lg:-m-10 sm:px-9 sm:py-12"
      style={{ background: "linear-gradient(122deg, #1267B5 0%, #3A57BE 52%, #6843B7 100%)" }}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full" style={{ background: "rgba(255,255,255,.09)" }} />
      <div className="relative">
        <div className="text-[12px] font-extrabold" style={{ letterSpacing: "0.22em", opacity: 0.82 }}>CHAPTER</div>
        <div className="my-1.5 text-[56px] font-extrabold leading-none sm:text-[62px]" style={{ letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
          {content.number || "01"}
        </div>
        <h3 className="mb-2.5 text-[23px] font-extrabold sm:text-[27px]" style={{ letterSpacing: "-0.02em" }}>{content.title}</h3>
        {content.lead && <p className="m-0 text-[14px] leading-[1.8]" style={{ opacity: 0.9, maxWidth: "54ch" }}>{content.lead}</p>}
      </div>
    </div>
  );
}

// ---- 目次 ----
export function AgendaSlide({ slide, content = {} }) {
  const items = content.items || [];
  return (
    <div>
      <div className="mb-2.5 text-[11px] font-bold" style={{ color: C.muted, letterSpacing: "0.1em" }}>AGENDA</div>
      <Title>{slide.title}</Title>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl sm:grid-cols-2" style={{ background: "rgba(26,28,31,.09)", border: `1px solid ${C.line}` }}>
        {items.map((item, i) => (
          <div key={i} data-focus={`ag-${i}`} className="flex items-start gap-3 p-4" style={{ background: "#fff" }}>
            <span className="pt-0.5 text-[12px] font-extrabold" style={{ color: T.accent, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="mb-0.5 text-[13.5px] font-bold" style={{ color: C.ink }}>{item.title}</div>
              {item.desc && <div className="text-[11.5px] leading-[1.6]" style={{ color: C.muted }}>{item.desc}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- 問いから入る ----
// 用語の前に体験へつなぐ。新しい概念を出す章の最初に使う。
export function HookSlide({ slide, content = {} }) {
  return (
    <div>
      <SlideEyebrowText chapter={content.chapter} chapterTitle={content.chapterTitle} />
      <Title>{slide.title}</Title>
      <div
        data-focus="hook-q"
        className="mb-5 rounded-xl p-5"
        style={{ background: C.canvas, border: `1px solid ${C.line}`, borderLeft: `3px solid ${T.accent}` }}
      >
        <span
          className="mb-2 inline-block rounded-full px-2.5 py-[3px] text-[10.5px] font-extrabold"
          style={{ background: T.accentSubtle, color: T.accent, letterSpacing: "0.1em" }}
        >質問</span>
        <p className="m-0 text-[17px] font-bold leading-[1.7]" style={{ color: C.ink, letterSpacing: "-0.01em" }}>{content.question}</p>
      </div>
      <Lead>{content.body}</Lead>
      {content.turn && (
        <div data-focus="hook-turn" className="flex items-start gap-3 rounded-xl p-5" style={{ background: T.accentSubtle }}>
          <span className="whitespace-nowrap pt-0.5 text-[12px] font-extrabold" style={{ color: T.accentHover }}>
            {content.turnLabel || "実は…"}
          </span>
          <p className="m-0 text-[15px] font-bold leading-[1.8]" style={{ color: C.ink }}>{content.turn}</p>
        </div>
      )}
    </div>
  );
}

// ---- 囲み（役割で分ける）----
// point: ここがポイント / miss: 新人が誤解しやすい / field: 覚えておきたい現場感覚
const CALLOUT_ROLE = {
  point: { label: "ここがポイント", fg: T.accent, bg: T.accentSubtle, Icon: Lightbulb },
  miss: { label: "新人が誤解しやすいポイント", fg: T.warning, bg: T.warningSubtle, Icon: HelpCircle },
  field: { label: "覚えておきたい現場感覚", fg: T.success, bg: T.successSubtle, Icon: MessageCircle },
  warning: { label: "注意", fg: T.warning, bg: T.warningSubtle, Icon: AlertCircle },
};

export function RoleCallouts({ items }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {items.map((c, i) => {
        // 旧データは type: "warning" を持つ。role が無ければそちらを見る。
        const role = CALLOUT_ROLE[c.role] || CALLOUT_ROLE[c.type] || CALLOUT_ROLE.point;
        const { Icon } = role;
        return (
          <div key={i} data-focus={`callout-${i}`} className="flex items-start gap-3 rounded-2xl p-[15px]" style={{ background: role.bg }}>
            <span className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px]" style={{ background: role.fg }}>
              <Icon size={13} color="#fff" />
            </span>
            <div className="min-w-0">
              <div className="mb-1 text-[12px] font-extrabold" style={{ color: role.fg, letterSpacing: "0.03em" }}>{c.label || role.label}</div>
              <div className="text-[13.5px] leading-[1.8]" style={{ color: C.ink }}>{c.text}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- 番号付きカード ----
// 最後の行に1枚だけ残さない列数を選ぶ。
export function stepColumns(n) {
  if (n <= 2) return n || 1;
  if (n === 4) return 2;      // 3+1 を避けて 2+2
  if (n === 5) return 3;      // 3+2
  if (n === 7) return 4;      // 4+3（3列だと 3+3+1 になる）
  if (n === 8) return 4;      // 4+4
  return 3;                   // 3/6/9 はそのまま3列で割り切れる
}

export function StepsSlide({ slide, content = {} }) {
  const items = content.items || [];
  return (
    <div>
      <SlideEyebrowText chapter={content.chapter} chapterTitle={content.chapterTitle} />
      <Title>{slide.title}</Title>
      <Lead>{content.intro}</Lead>
      {/* 列数は枚数から決める。auto-fillに任せると4枚のとき3+1になり、
          最後の1枚だけが下に取り残されて落ち着かない（2026-08-25の指摘）。 */}
      <div className="feeps-steps" style={{ "--cols": stepColumns(items.length) }}>
        {items.map((item, i) => (
          <div key={i} data-focus={`step-${i}`} className="rounded-2xl p-4" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
            <div className="text-[11px] font-extrabold" style={{ color: T.accent, fontVariantNumeric: "tabular-nums", letterSpacing: "0.06em" }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="my-1.5 text-[15px] font-extrabold" style={{ color: C.ink, letterSpacing: "-0.01em" }}>{item.name}</div>
            {item.meta && (
              <span className="mb-2 inline-block rounded-md px-[7px] py-[2px] text-[11px] font-bold" style={{ background: "#E7F7F5", color: "#176B67" }}>
                {item.meta}
              </span>
            )}
            {item.desc && <div className="text-[12.5px] leading-[1.7]" style={{ color: C.muted }}>{item.desc}</div>}
          </div>
        ))}
      </div>
      <RoleCallouts items={content.callouts} />
    </div>
  );
}

// ---- 2〜3列（項目に説明が付く）----
const COLUMN_TONE = {
  a: { bg: T.accentSubtle, fg: T.accentHover },
  b: { bg: "#E7F7F5", fg: "#176B67" },
  plain: { bg: T.bgBase, fg: T.textSecondary },
};

export function ColumnsSlide({ slide, content = {} }) {
  const columns = content.columns || [];
  return (
    <div>
      <SlideEyebrowText chapter={content.chapter} chapterTitle={content.chapterTitle} />
      <Title>{slide.title}</Title>
      <Lead>{content.intro}</Lead>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {columns.map((col, ci) => {
          const tone = COLUMN_TONE[col.tone] || (ci === 0 ? COLUMN_TONE.a : COLUMN_TONE.b);
          return (
            <div key={ci} data-focus={`col-${ci}`} className="min-w-0 overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.line}` }}>
              <div className="px-4 py-3" style={{ background: tone.bg, color: tone.fg }}>
                <div className="text-[13.5px] font-extrabold" style={{ letterSpacing: "-0.01em" }}>{col.label}</div>
                {col.sub && <div className="mt-0.5 text-[11.5px] font-semibold" style={{ opacity: 0.85 }}>{col.sub}</div>}
              </div>
              <ul className="m-0 flex list-none flex-col gap-3.5 px-4 py-3.5">
                {(col.items || []).map((item, i) => (
                  <li key={i} data-focus={`col-${ci}-${i}`}>
                    <div className="text-[13.5px] font-bold" style={{ color: C.ink }}>{item.k}</div>
                    {item.v && <div className="mt-0.5 text-[12px] leading-[1.65]" style={{ color: C.muted }}>{item.v}</div>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <RoleCallouts items={content.callouts} />
    </div>
  );
}

// ---- ワーク ----
// 集合研修ではグループワーク。ひとりで受けるときは回答欄＋AI講評へ切り替える（別途）。
export function WorkSlide({ slide, content = {} }) {
  const meta = [
    ["所要時間", content.time],
    ["進め方", content.how],
    ["発表", content.present],
    ["狙い", content.aim],
  ].filter(([, v]) => v);
  return (
    <div className="-m-5 sm:-m-8 lg:-m-10">
      <div className="px-6 py-4 text-white" style={{ background: `linear-gradient(100deg, ${T.aiAccentDeep}, ${T.accent})` }}>
        <div className="text-[10.5px] font-extrabold" style={{ letterSpacing: "0.18em", opacity: 0.88 }}>
          {content.no ? `WORK ${content.no}` : "WORK"}
        </div>
        <h3 className="mt-1 text-[18px] font-extrabold sm:text-[20px]" style={{ letterSpacing: "-0.02em" }}>{slide.title}</h3>
      </div>
      <div className="p-5 sm:p-8 lg:p-10">
        <div data-focus="work-task" className="rounded-2xl p-[17px]" style={{ background: C.canvas, border: `1px solid ${C.line}` }}>
          <div className="mb-2 text-[11px] font-extrabold" style={{ color: C.muted, letterSpacing: "0.08em" }}>お題</div>
          <p className="m-0 text-[14.5px] leading-[1.9]" style={{ color: C.ink }}>{content.task}</p>
        </div>
        {meta.length > 0 && (
          <div className="mt-3 grid gap-px overflow-hidden rounded-2xl" style={{ background: "rgba(26,28,31,.09)", border: `1px solid ${C.line}`, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {meta.map(([k, v]) => (
              <div key={k} className="px-4 py-3" style={{ background: "#fff" }}>
                <div className="mb-1 text-[10.5px] font-extrabold" style={{ color: C.muted, letterSpacing: "0.08em" }}>{k}</div>
                <div className="text-[13px] font-bold" style={{ color: C.ink }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {content.hints?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {content.hints.map((h, i) => (
              <span key={i} className="rounded-full px-[11px] py-[5px] text-[11.5px] font-semibold" style={{ background: C.canvas, border: `1px solid ${C.line}`, color: C.body }}>{h}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
