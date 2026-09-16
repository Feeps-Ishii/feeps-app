import React, { useRef, useState } from "react";

/* 教材への書き込み（PDF直書き）の描画面。正典: docs/specs/training-notes-spec.md 3章
 *
 * **PDFには焼かない。** 線はSVGで別に重ねる。だから消せるし、拡大しても荒れない。
 * **座標は必ず0-1の正規化。** ピクセルで持つと拡大率と端末で位置がずれる。
 * 太さ(w)もピクセルではなく段目で持ち、描くときに紙の幅に対する比に直す。
 *
 * この部品は**状態を持たない**（描きかけを除く）。線の配列は親（MaterialViewer）が持ち、
 * 元に戻す・保存もそちらの仕事。ここは「点を取ってきれいな線にする」ことだけをする。 */

export const INK_COLORS = ["#E23A2E", "#1C6FE0", "#1F9A55", "#D98A0B", "#7A45D8", "#222831"];

const MIN_STEP = 0.0015;   // これ未満しか動いていない点は捨てる（生の点を全部持つと数百KBになる）
const RDP_EPS = 0.0012;    // 間引きの許容誤差。線の形が変わらない範囲でいちばん粗くする
const MAX_POINTS = 800;    // Backendの上限と同じ
const ERASE_R = 0.012;     // 消しゴムの当たり半径（正規化）

/* ---- 幾何 ---- */
function distToSegment(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = p[0] - a[0], wy = p[1] - a[1];
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const dx = p[0] - (a[0] + t * vx), dy = p[1] - (a[1] + t * vy);
  return Math.hypot(dx, dy);
}

/* 消しゴムは**線ごと**消す。半分だけ消すより、書き直すほうが速い */
export function hitsStroke(stroke, p, r = ERASE_R) {
  const pts = stroke?.pts || [];
  if (!pts.length) return false;
  if (stroke.t === "text") return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) < r * 3;
  if (stroke.t === "rect" && pts.length >= 2) {
    const [a, b] = pts;
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
    const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    const edges = [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]];
    return edges.some(([s, e]) => distToSegment(p, s, e) < r);
  }
  if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) < r;
  for (let i = 1; i < pts.length; i++) if (distToSegment(p, pts[i - 1], pts[i]) < r) return true;
  return false;
}

export function eraseStrokesAt(strokes, p, r = ERASE_R) {
  const next = (strokes || []).filter(s => !hitsStroke(s, p, r));
  return next.length === (strokes || []).length ? null : next;
}

/* Ramer–Douglas–Peucker。**形を変えずに点を減らす**（生のままだと1ページで数百KBになる） */
export function simplifyPoints(pts, eps = RDP_EPS) {
  if (!Array.isArray(pts) || pts.length <= 2) return pts || [];
  const keep = new Uint8Array(pts.length);
  keep[0] = 1; keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let far = -1, max = eps;
    for (let i = s + 1; i < e; i++) {
      const d = distToSegment(pts[i], pts[s], pts[e]);
      if (d > max) { max = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([s, far], [far, e]); }
  }
  const out = pts.filter((_, i) => keep[i]);
  if (out.length <= MAX_POINTS) return out;
  // それでも多いときは等間隔に間引く（末尾は必ず残す）
  const step = out.length / MAX_POINTS;
  const thin = [];
  for (let i = 0; i < MAX_POINTS - 1; i++) thin.push(out[Math.floor(i * step)]);
  thin.push(out[out.length - 1]);
  return thin;
}

/* 中点を通る二次ベジエでつなぐ。折れ線のままだと手書きがカクつく */
export function penPath(pts, w, h) {
  if (!pts?.length) return "";
  const P = pts.map(p => [p[0] * w, p[1] * h]);
  if (P.length === 1) return `M ${P[0][0]} ${P[0][1]} l 0.01 0`;
  if (P.length === 2) return `M ${P[0][0]} ${P[0][1]} L ${P[1][0]} ${P[1][1]}`;
  let d = `M ${P[0][0]} ${P[0][1]}`;
  for (let i = 1; i < P.length - 1; i++) {
    const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
    d += ` Q ${P[i][0]} ${P[i][1]} ${mx} ${my}`;
  }
  const last = P[P.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

/* 太さは紙の幅に対する比。拡大しても同じ太さに見える */
export const strokePx = (w, pageW) => Math.max(0.6, (Number(w) || 2) * pageW / 1000);
export const textPx = (w, pageW) => Math.max(9, (Number(w) || 4) * pageW / 200);

function Stroke({ s, w, h }) {
  const color = INK_COLORS[s.color] || INK_COLORS[5];
  const sw = strokePx(s.w, w);
  if (s.t === "text") {
    return (
      <text x={s.pts[0][0] * w} y={s.pts[0][1] * h} fill={color}
        fontSize={textPx(s.w, w)} fontWeight="700"
        style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,.85)", strokeWidth: 3 }}>
        {s.text}
      </text>
    );
  }
  if (s.t === "rect" && s.pts.length >= 2) {
    const [a, b] = s.pts;
    return (
      <rect x={Math.min(a[0], b[0]) * w} y={Math.min(a[1], b[1]) * h}
        width={Math.abs(b[0] - a[0]) * w} height={Math.abs(b[1] - a[1]) * h}
        fill="none" stroke={color} strokeWidth={sw} />
    );
  }
  const common = {
    fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round",
  };
  if (s.t === "marker") {
    return <path d={penPath(s.pts, w, h)} {...common} strokeWidth={sw} strokeOpacity={0.35} strokeLinecap="butt" style={{ mixBlendMode: "multiply" }} />;
  }
  if (s.t === "line" && s.pts.length >= 2) {
    return <line x1={s.pts[0][0] * w} y1={s.pts[0][1] * h} x2={s.pts[1][0] * w} y2={s.pts[1][1] * h} stroke={color} strokeWidth={sw} strokeLinecap="round" />;
  }
  return <path d={penPath(s.pts, w, h)} {...common} strokeWidth={sw} />;
}

export default function InkLayer({ width, height, strokes = [], tool, disabled = false, onCommit }) {
  const svgRef = useRef(null);
  const penSeenRef = useRef(false);   // ペンを使った人は、以後タッチ（手のひら）で描かない
  const drawingRef = useRef(false);
  const [draft, setDraft] = useState(null);
  const [typing, setTyping] = useState(null);   // { x, y, value }

  const active = !disabled && tool?.kind && tool.kind !== "hand";
  const norm = e => {
    const r = svgRef.current.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1))),
      Math.max(0, Math.min(1, (e.clientY - r.top) / (r.height || 1))),
    ];
  };

  const down = e => {
    if (!active || typing) return;
    if (e.pointerType === "pen") penSeenRef.current = true;
    // タブレットで手をついても線が出ないように、ペンを使ったあとの指は無視する
    if (e.pointerType === "touch" && penSeenRef.current) return;
    if (!e.isPrimary) return;
    const p = norm(e);
    e.preventDefault();
    svgRef.current.setPointerCapture?.(e.pointerId);
    if (tool.kind === "eraser") {
      drawingRef.current = true;
      const next = eraseStrokesAt(strokes, p);
      if (next) onCommit?.(next);
      return;
    }
    if (tool.kind === "text") {
      setTyping({ p, value: "" });
      return;
    }
    drawingRef.current = true;
    setDraft({ t: tool.kind, color: tool.color, w: tool.w, pts: [p] });
  };

  const move = e => {
    if (!drawingRef.current) return;
    if (tool.kind === "eraser") {
      const next = eraseStrokesAt(strokes, norm(e));
      if (next) onCommit?.(next);
      return;
    }
    setDraft(cur => {
      if (!cur) return cur;
      if (cur.t === "line" || cur.t === "rect") return { ...cur, pts: [cur.pts[0], norm(e)] };
      // 途中の点も拾う（動きが速いと角張るため）。動いていない点はここで捨てる
      const raw = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      const pts = cur.pts.slice();
      for (const ev of raw.length ? raw : [e]) {
        const p = norm(ev);
        const last = pts[pts.length - 1];
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= MIN_STEP) pts.push(p);
      }
      return pts.length === cur.pts.length ? cur : { ...cur, pts };
    });
  };

  const up = e => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    setDraft(cur => {
      if (!cur) return null;
      const pts = (cur.t === "line" || cur.t === "rect") ? cur.pts : simplifyPoints(cur.pts);
      if (pts.length >= 2) onCommit?.([...strokes, { ...cur, pts }]);
      return null;
    });
  };

  const commitText = () => {
    const t = typing;
    setTyping(null);
    const text = String(t?.value || "").trim();
    if (text) onCommit?.([...strokes, { t: "text", color: tool.color, w: tool.w, pts: [t.p], text: text.slice(0, 300) }]);
  };

  return (
    <div className="pointer-events-none absolute inset-0" style={{ width, height }}>
      <svg
        ref={svgRef} width={width} height={height}
        className={active ? "pointer-events-auto" : ""}
        style={{
          // 描く道具を持っているときだけスクロールを止める（手のひらのときは普通に動かせる）
          touchAction: active && !penSeenRef.current ? "none" : "pan-x pan-y",
          cursor: !active ? "default" : tool.kind === "eraser" ? "cell" : tool.kind === "text" ? "text" : "crosshair",
        }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      >
        {strokes.map((s, i) => <Stroke key={i} s={s} w={width} h={height} />)}
        {draft && <Stroke s={draft} w={width} h={height} />}
        {typing && (
          <circle cx={typing.p[0] * width} cy={typing.p[1] * height} r={3} fill={INK_COLORS[tool.color]} />
        )}
      </svg>

      {typing && (
        <div className="pointer-events-auto absolute" style={{ left: typing.p[0] * width, top: typing.p[1] * height + 6, maxWidth: Math.max(160, width - typing.p[0] * width - 8) }}>
          <input
            autoFocus value={typing.value} maxLength={300}
            onChange={e => setTyping(t => ({ ...t, value: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTyping(null); }}
            onBlur={commitText}
            placeholder="ここに書く文字（Enterで確定）"
            className="w-full rounded-lg px-2 py-1 text-sm shadow"
            style={{ border: `1px solid ${INK_COLORS[tool.color]}`, background: "#fff", color: "#0F172A" }}
          />
        </div>
      )}
    </div>
  );
}
