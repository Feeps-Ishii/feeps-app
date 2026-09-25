import React, { useEffect, useRef } from "react";

// モックから持ち込んだ画面（入口・コースマップ・体験ラボ）を載せる台。
// 中身は固定の HTML 文字列（利用者の入力は入らない）と、その動きを付ける mount 関数。
// 画面の中の data-go="…" はここで拾って、テノラボの画面遷移（onGo）に渡す。
// "#how" のようなページ内リンクは、ハッシュで画面を切り替えているので、スクロールに置き換える。
export default function MountedHtml({ html, mount, opts, onGo, className, mountKey }) {
  const ref = useRef(null);
  const onGoRef = useRef(onGo);
  const optsRef = useRef(opts);
  onGoRef.current = onGo;
  optsRef.current = opts;

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    root.innerHTML = html;
    const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const onClick = (e) => {
      const g = e.target.closest && e.target.closest("[data-go]");
      if (g && root.contains(g)) {
        e.preventDefault();
        e.stopPropagation();
        onGoRef.current && onGoRef.current(g.getAttribute("data-go"));
        return;
      }
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a && root.contains(a)) {
        const href = a.getAttribute("href");
        if (href.startsWith("#/")) return;
        e.preventDefault();
        const id = href.slice(1);
        const el = id && id !== "top" ? document.getElementById(id) : null;
        if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        else window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }
    };
    root.addEventListener("click", onClick, true);
    let destroy = null;
    try {
      destroy = mount(root, optsRef.current || {});
    } catch (e) {
      console.error("tenolab mount failed", e);
    }
    return () => {
      root.removeEventListener("click", onClick, true);
      if (typeof destroy === "function") destroy();
      root.innerHTML = "";
    };
  }, [html, mount, mountKey]);

  return <div ref={ref} className={className} />;
}
