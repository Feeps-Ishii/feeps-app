import React, { useCallback, useEffect, useRef, useState } from "react";
import { T } from "../../components/common";
import { ChevronLeft, ChevronRight } from "lucide-react";

// 横に送るカードの並び（2026-09-06）。
//
// 案件が4件あると3列グリッドの2行目に1枚だけ残り、見栄えが悪かったので横一列にした。
// 最初の矢印は小さく縁も薄くて**見づらい**というご指摘を受けて作り直したのがこの形。
//
// - 矢印は44pxで、製品色の縁と濃い影を付ける。**背景に溶けないこと**を優先した
// - 端に**ぼかし**を出して「まだ先がある」ことを矢印以外でも伝える
// - **左右キーでも動く**。カードにフォーカスがあるときも効く
// - 端まで来たら矢印もぼかしも消す（押せないボタンを残さない）
// - 触って横に払う操作はそのまま効く

const CARD = 330;   // カード1枚の幅。DevLabCatalogView のカードと合わせる
const GAP = 14;

export default function CardRail({ children, ariaLabel = "カードの一覧" }) {
  const ref = useRef(null);
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setLeft(el.scrollLeft > 4);
    setRight(el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    update();
    el.addEventListener("scroll", update, { passive: true });
    // カードの件数や画面幅が変わったら矢印の要否も変わる
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [update, children]);

  const go = useCallback((dir) => {
    const el = ref.current;
    if (!el) return;
    // 見えている枚数ぶん送る（半端に切れた位置で止めない）
    const step = Math.max(1, Math.floor(el.clientWidth / (CARD + GAP))) * (CARD + GAP);
    el.scrollBy({ left: dir * step, behavior: "smooth" });
    // 滑らかに動いている途中でも矢印の要否を見直す。scrollイベントだけに任せると、
    // 動きが途中で止められた場合に矢印が実際の位置とずれる
    setTimeout(update, 350);
    setTimeout(update, 700);
  }, [update]);

  // 左右キーで動かす。カードにフォーカスがあるときも効くよう、入れ物側で受ける
  function onKeyDown(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    go(e.key === "ArrowLeft" ? -1 : 1);
  }

  const Arrow = ({ dir, show, Icon, label }) => (show ? (
    <button
      type="button" aria-label={label} onClick={() => go(dir)}
      className="absolute top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full transition hover:scale-105"
      style={{
        [dir < 0 ? "left" : "right"]: -12,
        border: `1.5px solid ${T.accent}55`,
        background: T.bgSurface,
        color: T.accentHover,
        boxShadow: "0 6px 18px -6px rgba(20,30,50,.38), 0 2px 6px rgba(20,30,50,.14)",
      }}
    >
      <Icon size={22} strokeWidth={2.4} />
    </button>
  ) : null);

  // 端のぼかし。矢印の下に敷いて「まだ先がある」ことを伝える
  const Fade = ({ dir, show }) => (show ? (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-10 w-14"
      style={{
        [dir < 0 ? "left" : "right"]: 0,
        background: `linear-gradient(to ${dir < 0 ? "right" : "left"}, ${T.bgBase}, transparent)`,
      }}
    />
  ) : null);

  return (
    <div className="relative">
      <Fade dir={-1} show={left} />
      <Fade dir={1} show={right} />
      <Arrow dir={-1} show={left} Icon={ChevronLeft} label="前のカードへ" />
      <Arrow dir={1} show={right} Icon={ChevronRight} label="次のカードへ" />
      <div
        ref={ref}
        role="group"
        tabIndex={0}
        aria-label={`${ariaLabel}（左右キーで移動できます）`}
        onKeyDown={onKeyDown}
        className="feeps-rail flex gap-3.5 overflow-x-auto overscroll-x-contain pb-1"
        style={{ scrollSnapType: "x proximity" }}
      >
        {React.Children.map(children, child => (
          <div className="shrink-0" style={{ width: CARD, maxWidth: "86%", scrollSnapAlign: "start" }}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
