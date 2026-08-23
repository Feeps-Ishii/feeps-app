import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { T } from "../../components/common";
import { subscribeSpeech } from "./lectureAudio.js";
import { focusForSentence, normalizeSlideFocus } from "./slideFocusTargets.js";

// 2026-08-24: 講義中にスライドの上を指す層。
//
// 講師がスライドを指しながら話すのと同じことをする。読み上げが進むと、その文に
// 対応する場所へ枠が移る。承認モック: mock/lecture-pointer（3案から選べる形で実装）。
//
// 指す場所の決め方は2通り。どちらも**AIの目測は使わない**。
//   ref  … 自前のスライド。data-focus="<ref>" の要素を探して、表示時に位置を測る。
//           画面幅が変わっても、スマホでもずれない。
//   rect … PDFページ画像。PDFの文字位置から作った0-1000グリッドの矩形をそのまま使う。
//
// 対応する場所が見つからないときは**何も出さない**。違う場所を光らせるより出さない方がよい。

const FOCUS_COLOR = "#E8542F";

// previewCue: 音声を鳴らさずに指し示しを確かめるための差し込み口（管理画面のプレビュー用）。
// 受講画面では渡さないので、実際の読み上げ位置がそのまま使われる。
export default function SlideFocusLayer({ focus, stageRef, slideId, previewCue }) {
  const [liveCue, setLiveCue] = useState(null);
  const [rect, setRect] = useState(null);
  const measureRef = useRef(null);
  const cue = previewCue || liveCue;

  useEffect(() => subscribeSpeech(setLiveCue), []);

  // 位置を測る基準(stageRef)は**親**のdivに付いている。子のuseLayoutEffectは親のrefが
  // 付くより先に走ることがあるので、マウント後に一度だけ測り直させる。
  // （これが無いと初回だけ何も出ない。2026-08-24に実機で踏んだ）
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  const list = useMemo(() => normalizeSlideFocus(focus), [focus]);
  const active = list.length ? focusForSentence(list, cue) : null;
  // 依存に使う鍵。activeは毎レンダー別のオブジェクトになるので、
  // オブジェクトのままuseEffectの依存に入れると測り直し→再描画→測り直しで無限ループになる。
  const activeKey = active
    ? [active.ref || "", active.x, active.y, active.w, active.h].join("|")
    : "";

  // ページを移ったときの測り直しは下のuseLayoutEffect（依存にslideIdを入れてある）が行う。
  // ここで別途 setRect(null) すると、レイアウト効果の後に走って測ったばかりの位置を
  // 消してしまう（2026-08-24、切り替え直後だけ枠が出ない不具合の原因）。
  //
  // 位置を測る。DOMを読むだけなので useLayoutEffect（描画前に確定させてチラつきを防ぐ）。
  useLayoutEffect(() => {
    if (!activeKey) { setRect(null); return undefined; }
    const stage = stageRef?.current;
    if (!stage) { setRect(null); return undefined; }
    const [ref, x, y, w, h] = activeKey.split("|");

    const measure = () => {
      let next = null;
      if (ref) {
        const el = stage.querySelector(`[data-focus="${CSS.escape(ref)}"]`);
        const b = stage.getBoundingClientRect();
        // 該当要素が無ければ指さない（違う場所を光らせるより出さない方がよい）
        if (el && b.width && b.height) {
          const a = el.getBoundingClientRect();
          next = {
            left: ((a.left - b.left) / b.width) * 100,
            top: ((a.top - b.top) / b.height) * 100,
            width: (a.width / b.width) * 100,
            height: (a.height / b.height) * 100,
          };
        }
      } else {
        next = { left: Number(x) / 10, top: Number(y) / 10, width: Number(w) / 10, height: Number(h) / 10 };
      }
      // 値が変わらないときはsetしない（ResizeObserverからの呼び出しでループしないように）
      setRect(prev => {
        if (prev === next) return prev;
        if (prev && next && ["left", "top", "width", "height"].every(k => Math.abs(prev[k] - next[k]) < 0.01)) return prev;
        return next;
      });
    };

    measure();
    measureRef.current = measure;
    // 画像の読み込みや折り返しで位置が動くので、大きさが変わったら測り直す。
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer) observer.observe(stage);
    return () => {
      window.removeEventListener("resize", measure);
      if (observer) observer.disconnect();
      if (measureRef.current === measure) measureRef.current = null;
    };
  }, [activeKey, stageRef, ready, slideId]);

  // 折り返しやフォント読み込みで要素の位置は後から動く。ResizeObserverが効かない場面でも
  // 追随できるよう、描画のたびに測り直す。値が変わらなければsetしないので無限ループにならない。
  useLayoutEffect(() => { if (measureRef.current) measureRef.current(); });

  if (!active || !rect) return null;

  const shape = active.shape || "spot";
  const style = {
    left: `${rect.left}%`,
    top: `${rect.top}%`,
    width: `${rect.width}%`,
    height: `${rect.height}%`,
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]">
      <div
        className="absolute rounded-[6px] transition-all duration-500 ease-out"
        style={{
          ...style,
          ...(shape === "spot"
            // 周りを暗くして1か所だけ見せる。box-shadowを極端に広げて「穴」を作る。
            ? { boxShadow: "0 0 0 9999px rgba(16, 22, 34, .55)", border: `2px solid ${FOCUS_COLOR}` }
            : shape === "box"
              ? { border: `2.5px solid ${FOCUS_COLOR}`, background: `${FOCUS_COLOR}17` }
              : { borderBottom: `4px solid rgba(255, 206, 61, .85)` }),
        }}
      >
        {active.label && shape !== "point" && (
          <span
            className="absolute -top-[26px] left-0 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-bold text-white"
            style={{ background: FOCUS_COLOR }}
          >
            {active.label}
          </span>
        )}
      </div>

      {shape === "point" && (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="absolute h-[28px] w-[28px] transition-all duration-500 ease-out"
          style={{ left: `${rect.left}%`, top: `${rect.top + rect.height}%`, marginLeft: "-6px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.35))" }}
        >
          <path d="M4 2 L4 20 L9 15.5 L12 22 L15 20.5 L12 14.5 L19 14 Z" fill="#fff" stroke={T.textPrimary} strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
