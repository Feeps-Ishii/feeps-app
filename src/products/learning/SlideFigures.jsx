import React from "react";

// 2026-08-24: スライドの図。**画像ではなくSVGで描く。**
//
// 画像にすると、拡大で滲む・ダークモードで色が合わない・スマホで潰れる・
// そして何より**図の中を指し示せない**。PDF取り込みで実証済みの失敗なので繰り返さない。
//
// 色はすべてCSS変数(theme.cssのfeeps-fig-*)に寄せる。ここでhexを書かないこと。
// 承認モック: mock/slide-layouts/index.html ⑨⑩⑪
// 仕様: docs/design/slide-layouts.md

// 図の枠。横に長い図はスマホで潰さず、枠の中だけ横スクロールさせる。
// ページ全体が横スクロールしないよう、overflow-x-autoは必ずこの枠に付ける。
function FigSvg({ viewBox, minWidth = 620, label, children }) {
  return (
    <div className="feeps-fig-frame overflow-x-auto rounded-2xl px-3.5 py-4">
      <svg viewBox={viewBox} role="img" aria-label={label} style={{ minWidth }} className="block h-auto w-full">
        {children}
      </svg>
    </div>
  );
}

// ---- V字モデル ----
//
// 左（決める）と右（確かめる）を同じ高さに置き、点線でつなぐ。
// **対応関係が図の本体**なので、点線とその上の一言は省略しない。
//
// 座標は pairs の数から決める。3組を想定した見た目に合わせつつ、増減しても崩れないよう
// 段の高さと横位置を計算で出す。
export function VModelFigure({ pairs = [], bottom, upperLabel = "決める", lowerLabel = "確かめる", alt, caption }) {
  const n = Math.max(pairs.length, 1);
  const BOX_W = 170;
  const BOX_H = 52;
  const STEP_X = 110;          // 1段ごとに内側へ寄る量
  const STEP_Y = 90;           // 1段ごとに下がる量
  const TOP_Y = 48;
  const W = 960;
  const bottomY = TOP_Y + n * STEP_Y;
  const H = bottomY + BOX_H + 42;
  const centerX = W / 2;

  // 左はi段目が (20 + i*STEP_X)、右は左右対称。
  const leftX = i => 20 + i * STEP_X;
  const rightX = i => W - 20 - BOX_W - i * STEP_X;
  const rowY = i => TOP_Y + i * STEP_Y;
  const cy = i => rowY(i) + BOX_H / 2;

  const vPath = `M${leftX(0) + BOX_W / 2} ${cy(0)} L${centerX} ${bottomY + BOX_H / 2} L${rightX(0) + BOX_W / 2} ${cy(0)}`;

  return (
    <FigSvg viewBox={`0 0 ${W} ${H}`} minWidth={660} label={alt || caption || "V字モデルの図"}>
      <text className="feeps-fig-axis" x="20" y="26">上流工程（{upperLabel}）</text>
      <text className="feeps-fig-axis feeps-fig-end" x={W - 20} y="26">テスト工程（{lowerLabel}）</text>

      <path className="feeps-fig-v" d={vPath} />

      {pairs.map((p, i) => {
        const y = cy(i);
        const x1 = leftX(i) + BOX_W;
        const x2 = rightX(i);
        const labelW = Math.max(120, (p.link || "").length * 13 + 28);
        return (
          <g key={`link-${p.id || i}`}>
            <line className="feeps-fig-link" x1={x1} y1={y} x2={x2} y2={y} />
            {p.link && (
              <g className="feeps-fig-linklabel">
                <rect x={centerX - labelW / 2} y={y - 13} width={labelW} height="26" rx="13" />
                <text x={centerX} y={y + 5}>{p.link}</text>
              </g>
            )}
          </g>
        );
      })}

      {pairs.map((p, i) => (
        <g className="feeps-fig-node up" key={`l-${p.id || i}`} data-focus={p.id ? `${p.id}` : `v-left-${i}`}>
          <rect x={leftX(i)} y={rowY(i)} width={BOX_W} height={BOX_H} rx="11" />
          <text x={leftX(i) + BOX_W / 2} y={rowY(i) + 24}>{p.left}</text>
          {p.leftDesc && <text className="sub" x={leftX(i) + BOX_W / 2} y={rowY(i) + 42}>{p.leftDesc}</text>}
        </g>
      ))}

      {pairs.map((p, i) => (
        <g className="feeps-fig-node down" key={`r-${p.id || i}`} data-focus={p.rightId || `v-right-${i}`}>
          <rect x={rightX(i)} y={rowY(i)} width={BOX_W} height={BOX_H} rx="11" />
          <text x={rightX(i) + BOX_W / 2} y={rowY(i) + 24}>{p.right}</text>
          {p.rightDesc && <text className="sub" x={rightX(i) + BOX_W / 2} y={rowY(i) + 42}>{p.rightDesc}</text>}
        </g>
      ))}

      {bottom && (
        <g className="feeps-fig-node mid" data-focus={bottom.id || "v-bottom"}>
          <rect x={centerX - BOX_W / 2} y={bottomY} width={BOX_W} height={BOX_H} rx="11" />
          <text x={centerX} y={bottomY + 24}>{bottom.label}</text>
          {bottom.desc && <text className="sub" x={centerX} y={bottomY + 42}>{bottom.desc}</text>}
        </g>
      )}
    </FigSvg>
  );
}

// ---- 工程の流れと範囲 ----
// 矢羽根を並べ、上に破線の帯で範囲（上流/下流など）を括る。
export function PhaseFlowFigure({ items = [], bands = [], footnote, alt, caption }) {
  const W = 960;
  const H = footnote ? 210 : 170;
  const n = Math.max(items.length, 1);
  const GAP = 18;
  const TIP = 20;
  const totalGap = GAP * (n - 1);
  const bw = (W - 8 - totalGap - TIP) / n;   // 矢羽根の胴の幅
  const x0 = i => 8 + i * (bw + GAP);
  const TOP = 66;
  const BOT = 146;
  const MID = (TOP + BOT) / 2;

  const chev = i => {
    const x = x0(i);
    return `M${x} ${TOP} H${x + bw} L${x + bw + TIP} ${MID} L${x + bw} ${BOT} H${x} L${x + TIP} ${MID} Z`;
  };

  return (
    <FigSvg viewBox={`0 0 ${W} ${H}`} label={alt || caption || "工程の流れの図"}>
      {bands.map(band => {
        const idx = items.map((it, i) => (it.band === band.key ? i : -1)).filter(i => i >= 0);
        if (!idx.length) return null;
        const from = x0(idx[0]);
        const to = x0(idx[idx.length - 1]) + bw + TIP;
        return (
          <g className={`feeps-fig-band ${band.key === "up" ? "up" : "down"}`} key={band.key}>
            <rect x={from} y="12" width={to - from} height="30" rx="15" />
            <text x={(from + to) / 2} y="32">{band.label}</text>
          </g>
        );
      })}

      {items.map((it, i) => (
        <g className={`feeps-fig-chev ${it.band === "up" ? "up" : "down"}`} key={it.id || i} data-focus={it.id || `p-${i}`}>
          <path d={chev(i)} />
          <text x={x0(i) + bw / 2 + TIP / 2} y={MID - 4}>{it.label}</text>
          {it.meta && <text className="sub" x={x0(i) + bw / 2 + TIP / 2} y={MID + 16}>{it.meta}</text>}
        </g>
      ))}

      {footnote && <text className="feeps-fig-axis" x="8" y="182">{footnote}</text>}
    </FigSvg>
  );
}

// ---- 一方通行 vs 繰り返し ----
// 進み方の「形」が違うものを対比する。左は階段、右は輪。
export function ContrastLoopFigure({ left, right, alt, caption }) {
  const W = 960;
  const H = 260;
  const steps = left?.steps || [];
  return (
    <FigSvg viewBox={`0 0 ${W} ${H}`} label={alt || caption || "進み方を対比した図"}>
      <text className="feeps-fig-axis" x="20" y="26">{left?.title}</text>
      {steps.map((s, i) => (
        <g className="feeps-fig-node up" key={`s-${i}`} data-focus={`wf-${i}`}>
          <rect x={20 + i * 70} y={44 + i * 54} width="128" height="42" rx="10" />
          <text x={84 + i * 70} y={70 + i * 54}>{s}</text>
        </g>
      ))}
      <path
        className="feeps-fig-fall"
        d={steps.slice(0, -1).map((_, i) => `M${84 + i * 70} ${86 + i * 54} L${84 + i * 70} ${96 + i * 54}`).join(" ")}
      />
      {(left?.notes || []).map((t, i) => (
        <text className="feeps-fig-note" x="378" y={72 + i * 24} key={`ln-${i}`}>{t}</text>
      ))}

      <line className="feeps-fig-divider" x1="560" y1="34" x2="560" y2="240" />

      <text className="feeps-fig-axis" x="600" y="26">{right?.title}</text>
      <circle className="feeps-fig-loop" cx="712" cy="146" r="76" />
      <path className="feeps-fig-arrow" d="M712 62 l-9 -9 l9 -9" />
      {(right?.steps || []).slice(0, 4).map((s, i) => {
        const pos = [
          { x: 648, y: 46, w: 128 },
          { x: 742, y: 128, w: 112 },
          { x: 648, y: 212, w: 128 },
          { x: 570, y: 128, w: 112 },
        ][i];
        return (
          <g className="feeps-fig-node down" key={`r-${i}`} data-focus={`ag-${i}`}>
            <rect x={pos.x} y={pos.y} width={pos.w} height="34" rx="17" />
            <text x={pos.x + pos.w / 2} y={pos.y + 22}>{s}</text>
          </g>
        );
      })}
      {(right?.notes || []).map((t, i) => (
        <text className="feeps-fig-note" x="862" y={196 + i * 24} key={`rn-${i}`}>{t}</text>
      ))}
    </FigSvg>
  );
}

// ---- ボックスモデル ----
//
// 入れ子そのものが意味なので、並べた図では伝わらない。**4層を実際に入れ子で描く。**
// width が届く範囲を、内側2層の下に矢印で示す。ここが図の本体。
export function BoxModelFigure({ layers = [], widthLabel, outerLabel, alt, caption }) {
  const W = 780;
  const H = 330;
  const L = [
    { key: "margin", ...(layers[0] || {}) },
    { key: "border", ...(layers[1] || {}) },
    { key: "padding", ...(layers[2] || {}) },
    { key: "content", ...(layers[3] || {}) },
  ];
  // 1層ぶんの厚み。縦は3層ぶんが上下から削られる（合計6倍）ので、横より薄くする。
  // 同じ値にすると、いちばん内側の content が高さマイナスになって消える（2026-08-27に実測）。
  const PAD_X = 38;
  const PAD_Y = 26;
  const x0 = 30;
  const y0 = 18;
  const w0 = W - x0 * 2;
  const h0 = 210;
  const box = i => ({ x: x0 + PAD_X * i, y: y0 + PAD_Y * i, w: w0 - PAD_X * 2 * i, h: h0 - PAD_Y * 2 * i });
  const content = box(3);
  const border = box(1);

  return (
    <FigSvg viewBox={`0 0 ${W} ${H}`} minWidth={560} label={alt || caption || "ボックスモデルの図"}>
      {L.map((layer, i) => {
        const b = box(i);
        return (
          <g className={`feeps-fig-box ${layer.key}`} key={layer.key} data-focus={layer.id || `bm-${layer.key}`}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={i === 3 ? 4 : 8} />
            {i < 3
              ? <text x={b.x + 10} y={b.y + 22} className="tag">{layer.label || layer.key}</text>
              : <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 6} className="mid">{layer.label || "content"}</text>}
            {layer.meta && i < 3 && <text x={b.x + 10} y={b.y + 22} className="meta" dx={(String(layer.label || layer.key).length + 1) * 8.4}>{layer.meta}</text>}
          </g>
        );
      })}

      {/* width が届く範囲。内側だけを指す矢印がこの図の言いたいこと。 */}
      <g className="feeps-fig-span in">
        <path d={`M${content.x} ${y0 + h0 + 22} H${content.x + content.w}`} />
        <path d={`M${content.x} ${y0 + h0 + 16} V${y0 + h0 + 28}`} />
        <path d={`M${content.x + content.w} ${y0 + h0 + 16} V${y0 + h0 + 28}`} />
        <text x={content.x + content.w / 2} y={y0 + h0 + 42}>{widthLabel || "width が指すのはここだけ"}</text>
      </g>
      <g className="feeps-fig-span out">
        <path d={`M${border.x} ${y0 + h0 + 62} H${border.x + border.w}`} />
        <path d={`M${border.x} ${y0 + h0 + 56} V${y0 + h0 + 68}`} />
        <path d={`M${border.x + border.w} ${y0 + h0 + 56} V${y0 + h0 + 68}`} />
        <text x={border.x + border.w / 2} y={y0 + h0 + 82}>{outerLabel || "画面上の見た目の幅"}</text>
      </g>
    </FigSvg>
  );
}

const FIGURES = {
  vmodel: VModelFigure,
  phaseflow: PhaseFlowFigure,
  contrast_loop: ContrastLoopFigure,
  boxmodel: BoxModelFigure,
};

// content.figure で種類を選ぶ。知らない種類は**何も描かない**（崩れた図を出すより無い方がよい）。
export default function SlideFigure({ content = {} }) {
  const Component = FIGURES[content.figure];
  if (!Component) return null;
  return (
    <figure className="feeps-fig m-0">
      <Component {...content} />
      {content.caption && <figcaption className="mt-2 text-[12px] leading-relaxed">{content.caption}</figcaption>}
    </figure>
  );
}
