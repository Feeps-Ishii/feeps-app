import React, { useCallback, useEffect, useRef, useState } from "react";
import { T } from "../../components/common";
import { ChevronLeft, ChevronRight } from "lucide-react";

// 横に送るカードの並び（2026-09-06）。
//
// 案件が4件あると3列グリッドで2行目に1枚だけ残り、見栄えが悪かった（ユーザー指摘）。
// 折り返さずに横一列へ置き、左右の矢印で送る。
//
// - 矢印は**端まで来たら消す**（押せないボタンを置いたままにしない）
// - 幅が足りていて全部見えているときは矢印を出さない
// - 触って横に払う操作も効く（スクロール自体を止めていない）
// - スクロールバーは出さない（矢印と指で操作する）

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

  function go(dir) {
    const el = ref.current;
    if (!el) return;
    // 見えている枚数ぶん送る（半端に切れた位置で止めない）
    const step = Math.max(1, Math.floor(el.clientWidth / (CARD + GAP))) * (CARD + GAP);
    el.scrollBy({ left: dir * step, behavior: "smooth" });
    // 滑らかに動いている途中でも矢印の要否を見直す。scrollイベントだけに任せると、
    // 動きが途中で止められた場合に矢印が実際の位置とずれる
    setTimeout(update, 350);
    setTimeout(update, 700);
  }

  const arrow = (dir, show, Icon, label) => (show ? (
    <button
      type="button" aria-label={label} onClick={() => go(dir)}
      className="absolute top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border shadow-sm transition hover:shadow"
      style={{
        [dir < 0 ? "left" : "right"]: -6,
        borderColor: T.border,
        background: T.bgSurface,
        color: T.textSecondary,
      }}
    >
      <Icon size={18} />
    </button>
  ) : null);

  return (
    <div className="relative">
      {arrow(-1, left, ChevronLeft, "前のカードへ")}
      {arrow(1, right, ChevronRight, "次のカードへ")}
      <div
        ref={ref}
        role="group"
        aria-label={ariaLabel}
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
