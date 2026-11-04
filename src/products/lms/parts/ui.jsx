import React, { useEffect } from "react";
import { Icon } from "./icons.jsx";

/* セージの共通部品（モックの th-hero・th-kpi・th-cal・ih-ring・xtool と同じ形）。
   色は cat（rep・att・cur・tst・dev・tm・gy）で選ぶ */

const WD = "日月火水木金土";
export const weekday = (m, d, y = new Date().getFullYear()) => WD[new Date(y, m - 1, d).getDay()];

export function Head({ eyebrow, title, right }) {
  return (
    <div className="head">
      <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1 className="h1">{title}</h1></div>
      {right && <span className="r">{right}</span>}
    </div>
  );
}

export function Chip({ tone = "", children }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

export function Btn({ kind = "", children, ...rest }) {
  return <button type="button" className={`btn ${kind}`} {...rest}>{children}</button>;
}

export function Card({ className = "pad", children, ...rest }) {
  return <section className={`card ${className}`} {...rest}>{children}</section>;
}

// 色の面：上の小さな見出し・右の札・大きな見出し・中身
// 色の面の絵（モック heroArt）
const ART = {
  rep: <><rect x="34" y="16" width="62" height="70" rx="8" fill="var(--cd)" opacity=".45" /><g className="hero-al"><rect x="24" y="8" width="62" height="70" rx="8" fill="#fff" /><path d="M36 26h38M36 38h38M36 50h24" /><path d="M78 56l14-14 6 6-14 14h-6z" /></g></>,
  att: <><circle cx="64" cy="50" r="32" fill="var(--cd)" opacity=".45" /><g className="hero-al"><circle cx="56" cy="44" r="32" fill="#fff" /><path d="M56 26v18l12 8" /><path d="M28 14l-8 8M84 14l8 8" /></g></>,
  cur: <><rect x="30" y="20" width="74" height="52" rx="8" fill="var(--cd)" opacity=".45" /><g className="hero-al"><rect x="20" y="12" width="74" height="52" rx="8" fill="#fff" /><path d="M49 28l16 10-16 10z" /><path d="M57 64v14M41 80h32" /></g></>,
  tst: <><rect x="32" y="18" width="66" height="66" rx="10" fill="var(--cd)" opacity=".45" /><g className="hero-al"><rect x="22" y="10" width="66" height="66" rx="10" fill="#fff" /><path d="M34 28l5 5 9-9M34 48l5 5 9-9" /><path d="M56 30h20M56 50h20" /></g></>,
  dev: <><rect x="30" y="18" width="76" height="60" rx="9" fill="var(--cd)" opacity=".45" /><g className="hero-al"><rect x="20" y="10" width="76" height="60" rx="9" fill="#fff" /><path d="M20 24h76" /><path d="M46 38l-9 8 9 8M70 38l9 8-9 8M62 34l-8 24" /></g></>,
  gy: <><circle cx="64" cy="50" r="30" fill="var(--cd)" opacity=".45" /><g className="hero-al"><path d="M30 60c6-22 20-34 44-36-2 24-16 38-44 36z" fill="#fff" /><path d="M30 60c10-12 22-20 34-26" /></g></>,
};
export function Hero({ cat = "tm", eyebrow, step, title, sub, art, children, className = "" }) {
  return (
    <section className={`hero c-${cat}${art ? " has-art" : ""} ${className}`}>
      {(eyebrow || step) && <div className="hero-h">{eyebrow ? <span className="eyebrow">{eyebrow}</span> : <span />}{step && <span className="hero-step">{step}</span>}</div>}
      {art && <svg className="hero-art" viewBox="0 0 120 92" aria-hidden="true">{ART[art] || ART.cur}</svg>}
      {title && <h2 className="hero-t">{title}</h2>}
      {sub && <p className="hero-s">{sub}</p>}
      {children}
    </section>
  );
}

// 色の面の中の数字：items = [{ label, value, unit, pct, note }]
export function Kpi({ items }) {
  return (
    <div className={`kpi${items.length === 4 ? " n4" : ""}`} style={{ "--n": items.length }}>
      {items.map(it => (
        <div key={it.label}>
          <span>{it.label}</span>
          <b className="num">{it.value ?? "—"}{it.unit && <small>{it.unit}</small>}</b>
          {it.pct != null && <span className="bar10"><i style={{ "--w": `${Math.max(0, Math.min(100, it.pct))}%` }} /></span>}
          {it.note && <em>{it.note}</em>}
        </div>
      ))}
    </div>
  );
}

// 日付の札："10/20" または Date
export function Cal({ date, cat = "gy", year }) {
  const d = date instanceof Date ? date : null;
  const [m, dd] = d ? [d.getMonth() + 1, d.getDate()] : String(date).split("/").map(Number);
  const y = d ? d.getFullYear() : year;
  return (
    <span className={`cal c-${cat}`}>
      <small>{m}月</small><b>{dd}</b><small>{weekday(m, dd, y)}</small>
    </span>
  );
}

// 輪：n / of を % で
export function Ring({ n, of, cat = "tm" }) {
  const r = 44, c = 2 * Math.PI * r, pct = of ? Math.round(n / of * 100) : 0;
  return (
    <span className={`ring c-${cat}`}>
      <svg viewBox="0 0 108 108" aria-hidden="true">
        <circle cx="54" cy="54" r={r} className="tr" />
        <circle cx="54" cy="54" r={r} className="fg" strokeDasharray={`${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 54 54)" />
      </svg>
      <b>{pct}<small>%</small></b>
    </span>
  );
}

export function Face({ name, cat }) {
  return <span className={`face${cat ? ` c-${cat}` : ""}`} style={cat ? { background: "var(--c)", color: "var(--ci)" } : undefined}>{String(name || "?").replace(/\s/g, "").slice(0, 1)}</span>;
}

// 絞り込み・探す・並べ替え（受講生が並ぶ一覧には必ず付ける）
// tabs = [[key, label, count, tone]] ・ sorts = [[key, label]]
export function ListTool({ tabs, tab, onTab, q, onQ, placeholder = "名前で探す", sorts, sort, onSort }) {
  return (
    <div className="ftool">
      {tabs && (
        <div className="ftabs">
          {tabs.map(([k, t, n, tone]) => (
            <button key={k} type="button" className={tone || ""} aria-pressed={tab === k} onClick={() => onTab(k)}>{t}{n != null && <em>{n}</em>}</button>
          ))}
        </div>
      )}
      {onQ && <span className="fsearch"><input type="search" value={q} onChange={e => onQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} /></span>}
      {sorts && (
        <label className="fsort">並べ替え
          <select value={sort} onChange={e => onSort(e.target.value)}>{sorts.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        </label>
      )}
    </div>
  );
}

// 名前とかなのどちらかに含まれるか
export const matchName = (name, kana, q) => !q || String(name || "").includes(q) || String(kana || "").includes(q);

// まだ作っていない画面
export function Soon({ k, label }) {
  return (
    <div className="soon card">
      <span className="ic"><Icon k={k} size={22} /></span>
      <b>{label}</b>
      <Chip>準備中</Chip>
    </div>
  );
}

// 窓：Esc と外側で閉じる
export function Modal({ title, width, onClose, footer, children }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="lms-shade" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="lms-modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { "--mw": `${width}px` } : undefined}>
        <header><b>{title}</b><button type="button" aria-label="閉じる" onClick={onClose}>×</button></header>
        <div className="in">{children}</div>
        {footer && <footer>{footer}</footer>}
      </section>
    </div>
  );
}
