import React from "react";
import { CheckCircle2, Circle, RefreshCw } from "lucide-react";
import Card from "./Card.jsx";
import Btn from "./Btn.jsx";
import { PRISM } from "./theme.js";

const TONE = {
  accent: { fg: PRISM.accent, bg: PRISM.accentSubtle },
  ai: { fg: PRISM.aiDeep, bg: PRISM.aiSubtle },
  teal: { fg: PRISM.tealDeep, bg: PRISM.tealSubtle },
  ok: { fg: PRISM.ok, bg: PRISM.okSubtle },
  warn: { fg: PRISM.warn, bg: PRISM.warnSubtle },
  bad: { fg: PRISM.bad, bg: PRISM.badSubtle },
  neutral: { fg: PRISM.sub, bg: PRISM.neutralSubtle },
};

export function PrismPage({ children, className = "" }) {
  return <div className={`flex min-w-0 flex-col gap-5 ${className}`} style={{ background: PRISM.auroraBg }}>{children}</div>;
}

export function PrismCard({ children, className = "", style = {}, hover, onClick }) {
  return (
    <Card hover={hover} onClick={onClick} className={className} style={{ border: `1px solid ${PRISM.line}`, borderRadius: 20, boxShadow: PRISM.cardShadow, ...style }}>
      {children}
    </Card>
  );
}

export function PrismSectionTitle({ title, desc, action }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-bold sm:text-lg" style={{ color: PRISM.ink, letterSpacing: "-0.015em" }}>{title}</h2>
        {desc && <p className="mt-1 text-sm" style={{ color: PRISM.mut }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function PrismCapLabel({ children }) {
  return <p className="mb-2.5 text-[11px] font-bold uppercase" style={{ color: PRISM.mut, letterSpacing: "0.06em" }}>{children}</p>;
}

export function PrismHomeHeading({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-[13px] font-semibold" style={{ color: PRISM.sub }}>{eyebrow}</p>}
        <h1 className="mt-1 text-[26px] font-medium sm:text-[30px]" style={{ color: PRISM.ink, letterSpacing: "-0.025em" }}>{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: PRISM.sub }}>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PrismHero({ eyebrow, title, description, icon: Icon, actions, children, className = "" }) {
  return (
    <section className={`feeps-hero-in relative overflow-hidden rounded-[24px] p-5 text-white sm:p-7 ${className}`} style={{ background: PRISM.gradTraining, boxShadow: PRISM.heroShadow }}>
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full" style={{ background: PRISM.heroGlass }} />
      <div className="relative z-[1] flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl min-w-0">
          <div className="flex items-center gap-2">
            {Icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: PRISM.heroGlassStrong, border: `1px solid ${PRISM.heroLine}` }}><Icon size={19} /></span>}
            {eyebrow && <p className="text-xs font-bold tracking-[0.08em]" style={{ color: PRISM.heroTextSoft }}>{eyebrow}</p>}
          </div>
          <h1 className="mt-4 text-[26px] font-medium leading-tight sm:text-[30px]" style={{ letterSpacing: "-0.025em" }}>{title}</h1>
          {description && <p className="mt-2 max-w-xl text-sm leading-6" style={{ color: PRISM.heroTextSoft }}>{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children && <div className="relative z-[1] mt-6">{children}</div>}
    </section>
  );
}

export function PrismKpiCard({ icon: Icon, label, value, unit, detail, tone = "accent", onClick }) {
  const c = TONE[tone] || TONE.accent;
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold" style={{ color: PRISM.sub }}>{label}</p>
        {Icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: c.bg, color: c.fg }}><Icon size={18} /></span>}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold" style={{ color: PRISM.ink, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums" }}>{value ?? "—"}</span>
        {unit && <span className="text-xs font-semibold" style={{ color: PRISM.mut }}>{unit}</span>}
      </div>
      {detail && <p className="mt-1.5 truncate text-xs" style={{ color: PRISM.mut }}>{detail}</p>}
    </>
  );
  if (onClick) {
    return <button type="button" onClick={onClick} className="w-full rounded-[20px] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md" style={{ border: `1px solid ${PRISM.line}`, boxShadow: PRISM.cardShadow }}>{content}</button>;
  }
  return <PrismCard className="p-4">{content}</PrismCard>;
}

export function PrismErrorRetryCard({ message, onRetry }) {
  return (
    <PrismCard className="p-4" style={{ background: PRISM.badSubtle, borderColor: PRISM.badLine }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold" style={{ color: PRISM.bad }}>データを取得できませんでした</div>
          <div className="mt-1 text-xs" style={{ color: PRISM.sub }}>{message}</div>
        </div>
        {onRetry && <Btn size="sm" kind="ghost" icon={RefreshCw} onClick={onRetry}>再取得</Btn>}
      </div>
    </PrismCard>
  );
}

export function PrismSeverityChip({ severity, children }) {
  const c = severity === "critical" ? TONE.bad : severity === "warning" ? TONE.warn : TONE.neutral;
  return <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: c.bg, color: c.fg }}>{children}</span>;
}

export function PrismStatusDot({ status }) {
  if (status === "done") return <CheckCircle2 size={19} className="shrink-0" style={{ color: PRISM.ok }} />;
  if (status === "needs_action") return <Circle size={19} className="shrink-0" style={{ color: PRISM.warn }} />;
  if (status === "unavailable") return <Circle size={19} className="shrink-0" style={{ color: PRISM.mut }} />;
  return <Circle size={19} className="shrink-0" style={{ color: PRISM.accent }} />;
}

export function PrismProgressRing({ percent, size = 112, stroke = 11, from = PRISM.accent, to = PRISM.ai, gradId, sub }) {
  const has = percent != null && Number.isFinite(percent);
  const clamped = has ? Math.max(0, Math.min(100, percent)) : 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={PRISM.ringTrack} strokeWidth={stroke} />
        {has && <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`url(#${gradId})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1s ease" }} />}
        <defs><linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient></defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span className="text-2xl font-bold" style={{ color: PRISM.ink, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{has ? `${Math.round(clamped)}%` : "—"}</span>
        {sub && <span className="mt-0.5 truncate text-[10.5px] font-semibold leading-tight" style={{ color: PRISM.mut, maxWidth: size - 20 }}>{sub}</span>}
      </div>
    </div>
  );
}

export function PrismEmptyBlock({ children, className = "" }) {
  return <div className={`rounded-2xl px-4 py-7 text-center text-sm ${className}`} style={{ background: PRISM.base, color: PRISM.mut, border: `1px dashed ${PRISM.line2}` }}>{children}</div>;
}
