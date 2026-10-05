import React, { useEffect, useRef, useState } from "react";

/* テノラボ（コース型）の共通の部品。見た目はモック tenolab-course.html（app/course.css）のとおり。 */

// コースの学習時間：数だけなら「約N時間」、それ以外（「8単元」など）はそのまま
export const durationLabel = d => (/^\d+(\.\d+)?$/.test(String(d || "").trim()) ? `約${String(d).trim()}時間` : String(d || ""));
export const durationHours = d => (/^\d+(\.\d+)?$/.test(String(d || "").trim()) ? Number(d) : 0);

export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// アイコン（スプライトは Shell が1回だけ出す）
export function Ic({ id, className = "ico", style }) {
  return <svg className={className} style={style} aria-hidden="true"><use href={`#i-${id}`} /></svg>;
}
export const ICON_SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-slide" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 17v3M8 20h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="i-code" viewBox="0 0 24 24"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-quiz" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/></symbol>
  <symbol id="i-case" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 7V5h6v2" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z" fill="currentColor"/></symbol>
</svg>`;

/* ---------- 単元のアイコン ---------- */
const TOPIC_ICON = {
  web: c => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="10" width="52" height="40" rx="5" fill="#fff" stroke="#15171C" stroke-width="3"/><path d="M6 20h52" stroke="#15171C" stroke-width="3"/><circle cx="12" cy="15" r="1.8" fill="${c}"/><circle cx="18" cy="15" r="1.8" fill="#15171C"/><rect x="12" y="26" width="18" height="18" rx="2" fill="${c}"/><path d="M36 28h16M36 35h12M36 42h16" stroke="#15171C" stroke-width="3" stroke-linecap="round"/></svg>`,
  js: c => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="8" width="48" height="48" rx="8" fill="${c}"/><path d="M27 20c-5 0-5 3-5 7s-1 5-4 5c3 0 4 1 4 5s0 7 5 7M37 20c5 0 5 3 5 7s1 5 4 5c-3 0-4 1-4 5s0 7-5 7" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  java: c => `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 28h30v12a12 12 0 0 1-12 12h-6a12 12 0 0 1-12-12z" fill="#fff" stroke="#15171C" stroke-width="3"/><path d="M44 31h4a5 5 0 0 1 0 10h-4" fill="none" stroke="#15171C" stroke-width="3"/><path d="M22 12c-3 4 3 6 0 10M30 10c-3 4 3 6 0 12M38 12c-3 4 3 6 0 10" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/><path d="M10 56h40" stroke="#15171C" stroke-width="3" stroke-linecap="round"/></svg>`,
  db: c => `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 14v34c0 3.3 8 6 18 6s18-2.7 18-6V14" fill="#fff" stroke="#15171C" stroke-width="3"/><ellipse cx="32" cy="14" rx="18" ry="6" fill="${c}" stroke="#15171C" stroke-width="3"/><path d="M14 26c0 3.3 8 6 18 6s18-2.7 18-6M14 38c0 3.3 8 6 18 6s18-2.7 18-6" fill="none" stroke="#15171C" stroke-width="3"/></svg>`,
  git: c => `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 14v36M20 26c0 8 24 4 24 14v2" fill="none" stroke="#15171C" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="14" r="6" fill="#fff" stroke="#15171C" stroke-width="3"/><circle cx="20" cy="50" r="6" fill="#fff" stroke="#15171C" stroke-width="3"/><circle cx="44" cy="46" r="6" fill="${c}" stroke="#15171C" stroke-width="3"/></svg>`,
  cloud: c => `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 46a10 10 0 0 1-1-20 14 14 0 0 1 27-4 11 11 0 0 1 3 24z" fill="#fff" stroke="#15171C" stroke-width="3" stroke-linejoin="round"/><path d="M32 30v14M26 36l6-6 6 6" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  code: c => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="12" width="48" height="40" rx="6" fill="#fff" stroke="#15171C" stroke-width="3"/><path d="M26 26l-7 6 7 6M38 26l7 6-7 6" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
export const TOPIC_ICONS = Object.keys(TOPIC_ICON);
const safeColor = c => (/^#[0-9a-fA-F]{3,8}$/.test(c || "") ? c : "#767D8C");
export function TopicIcon({ topic, size = 72 }) {
  const f = TOPIC_ICON[topic?.icon] || TOPIC_ICON[topic?.id] || TOPIC_ICON.code;
  return <span className="ti" style={{ background: safeColor(topic?.soft || "#F2F3EE"), width: size, height: size }} dangerouslySetInnerHTML={{ __html: f(safeColor(topic?.color)) }} />;
}
// 単元が見つからないコース（未設定）
export const OTHER_TOPIC = { id: "_other", name: "その他", sub: "", desc: "", color: "#767D8C", soft: "#F2F3EE", icon: "code" };

/* ---------- 完成イメージ（サムネイル） ---------- */
const MONO = 'font-family="JetBrains Mono, monospace"';
export const THUMB_KINDS = ["out", "web-center", "web-2col", "table", "git", "aws", "chart", "form", "filter", "mobile", "bars"];
export function thumbSvg(x) {
  const th = x?.thumb?.kind || x?.th || "";
  const out = (x?.thumb?.out || x?.out || []).slice(0, 4);
  const a = x?.thumb?.aws || x?.aws || {};
  const box = inner => `<svg class="thumb" viewBox="0 0 320 150" role="img" aria-label="完成イメージ">${inner}</svg>`;
  const browser = inner => box(`<rect width="320" height="150" fill="#F2F3EE"/><rect x="16" y="12" width="288" height="128" rx="8" fill="#fff" stroke="#E2E5DD"/><path d="M16 32h288" stroke="#E2E5DD"/><circle cx="28" cy="22" r="3" fill="#E2E5DD"/><circle cx="38" cy="22" r="3" fill="#E2E5DD"/>${inner}`);
  switch (th) {
    case "out": return box(`<rect width="320" height="150" fill="#151923"/><rect width="320" height="24" fill="#0E1118"/><circle cx="14" cy="12" r="4" fill="#FFE14D"/><text x="26" y="16" font-size="10" fill="#808AA1" ${MONO}>output</text>${out.map((l, i) => `<text x="16" y="${50 + i * 22}" font-size="${i === out.length - 1 ? 15 : 12}" fill="${i === out.length - 1 ? "#7DDBB3" : "#B9C1D6"}" ${MONO}>${esc(l)}</text>`).join("")}`);
    case "web-center": return browser(`<rect x="40" y="44" width="240" height="10" rx="5" fill="#F2F3EE"/><rect x="118" y="78" width="84" height="28" rx="8" fill="#FFE14D" stroke="#15171C"/><rect x="136" y="90" width="48" height="4" rx="2" fill="#15171C"/><path d="M160 66v6M160 112v6" stroke="#2457E6" stroke-dasharray="2 2"/>`);
    case "web-2col": return browser(`<rect x="28" y="42" width="264" height="14" rx="4" fill="#15171C"/><rect x="28" y="64" width="126" height="66" rx="6" fill="#E8EEFD"/><rect x="166" y="64" width="126" height="66" rx="6" fill="#FFF7C2"/><rect x="38" y="76" width="70" height="6" rx="3" fill="#2457E6"/><rect x="176" y="76" width="70" height="6" rx="3" fill="#B07C00"/>`);
    case "table": return box(`<rect width="320" height="150" fill="#fff"/>${[0, 1, 2, 3, 4].map(i => `<rect x="20" y="${18 + i * 24}" width="280" height="24" fill="${i === 0 ? "#E3F5EE" : i === 2 ? "#FFF7C2" : "#fff"}" stroke="#E2E5DD"/>`).join("")}${[0, 1, 2, 3, 4].map(i => `<rect x="30" y="${27 + i * 24}" width="${i ? 70 : 50}" height="6" rx="3" fill="${i ? "#767D8C" : "#11966F"}"/><rect x="130" y="${27 + i * 24}" width="${i ? 50 : 40}" height="6" rx="3" fill="${i ? "#767D8C" : "#11966F"}"/><rect x="220" y="${27 + i * 24}" width="${i ? 40 : 46}" height="6" rx="3" fill="${i ? "#15171C" : "#11966F"}"/>`).join("")}`);
    case "git": return box(`<rect width="320" height="150" fill="#fff"/><path d="M40 50h240M80 50c20 0 20 50 40 50h80c20 0 20-50 40-50" fill="none" stroke="#C7B8F5" stroke-width="4"/>${[40, 80, 240, 280].map(cx => `<circle cx="${cx}" cy="50" r="8" fill="#fff" stroke="#7454C7" stroke-width="3"/>`).join("")}${[130, 170].map(cx => `<circle cx="${cx}" cy="100" r="8" fill="#7454C7"/>`).join("")}<rect x="184" y="112" width="112" height="24" rx="12" fill="#E3F5EE" stroke="#11966F"/><text x="196" y="128" font-size="11" fill="#0B6B50" ${MONO}>PR #12 merged</text>`);
    case "aws": {
      const n = Math.min(3, Number(a.ec2) || 0);
      const ec2 = Array.from({ length: n }, (_, i) => { const sx = n === 1 ? 140 : n === 2 ? (i ? 206 : 74) : 50 + i * 82; return `<rect x="${sx}" y="88" width="40" height="34" rx="5" fill="#F29A38"/><text x="${sx + 8}" y="109" font-size="10" fill="#fff" ${MONO}>EC2</text>`; }).join("");
      return box(`<rect width="320" height="150" fill="#FFF8F0"/><rect x="14" y="10" width="292" height="130" rx="10" fill="none" stroke="#2457E6" stroke-dasharray="5 4"/><text x="24" y="26" font-size="10" fill="#2457E6" ${MONO}>VPC 10.0.0.0/16</text><rect x="26" y="62" width="128" height="70" rx="8" fill="#E3F5EE" stroke="#11966F"/><rect x="166" y="62" width="128" height="70" rx="8" fill="#E3F5EE" stroke="#11966F"/><text x="34" y="76" font-size="9" fill="#0B6B50" ${MONO}>public-a</text><text x="174" y="76" font-size="9" fill="#0B6B50" ${MONO}>public-c</text>${ec2}${a.elb ? `<rect x="120" y="32" width="80" height="22" rx="11" fill="#7454C7"/><text x="146" y="47" font-size="10" fill="#fff" ${MONO}>ALB</text>` : `<rect x="250" y="20" width="44" height="20" rx="4" fill="#15171C"/><text x="258" y="34" font-size="9" fill="#fff" ${MONO}>IGW</text>`}${a.asg ? `<rect x="40" y="82" width="244" height="46" rx="8" fill="none" stroke="#D9483B" stroke-dasharray="3 3"/>` : ""}${a.fixed ? `<circle cx="260" cy="40" r="14" fill="#11966F"/><path d="M253 40l5 5 9-10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>` : ""}${a.web ? `<rect x="226" y="20" width="70" height="20" rx="4" fill="#fff" stroke="#15171C"/><text x="232" y="34" font-size="9" fill="#15171C" ${MONO}>tool.app</text>` : ""}`);
    }
    case "chart": return box(`<rect width="320" height="150" fill="#fff"/><path d="M24 20v110h276" stroke="#E2E5DD" fill="none"/><path d="M24 56h276" stroke="#D9483B" stroke-dasharray="5 4"/><text x="250" y="50" font-size="10" fill="#D9483B" ${MONO}>80%</text><path d="M24 112l30-8 30 4 30-14 30 6 30-30 30-28 30 10 30-6 26 8" fill="none" stroke="#2457E6" stroke-width="3" stroke-linejoin="round"/><circle cx="204" cy="52" r="9" fill="#FFE14D" stroke="#15171C"/><path d="M200 52h8M204 48v6" stroke="#15171C" stroke-width="2"/>`);
    case "form": return box(`<rect width="320" height="150" fill="#F2F3EE"/><rect x="60" y="10" width="200" height="130" rx="10" fill="#fff" stroke="#E2E5DD"/>${[["お名前", 0], ["人数", 1], ["日付", 1]].map(([l, bad], i) => `<text x="76" y="${34 + i * 36}" font-size="9" fill="#767D8C">${l}</text><rect x="76" y="${38 + i * 36}" width="168" height="16" rx="4" fill="#fff" stroke="${bad ? "#D9483B" : "#E2E5DD"}"/>${bad ? `<text x="78" y="${66 + i * 36}" font-size="8" fill="#D9483B">${i === 1 ? "人数は1〜8人で入力してください" : "今日以降の日付を選んでください"}</text>` : ""}`).join("")}`);
    case "filter": return browser(`${["すべて", "食品", "日用品"].map((l, i) => `<rect x="${28 + i * 56}" y="42" width="50" height="16" rx="8" fill="${i === 1 ? "#15171C" : "#F2F3EE"}"/><text x="${36 + i * 56}" y="54" font-size="9" fill="${i === 1 ? "#fff" : "#454B57"}">${l}</text>`).join("")}${[0, 1, 2].map(i => `<rect x="28" y="${68 + i * 22}" width="264" height="18" rx="4" fill="${i === 0 ? "#E8EEFD" : "#fff"}" stroke="#E2E5DD"/><rect x="36" y="${74 + i * 22}" width="90" height="6" rx="3" fill="#767D8C"/><rect x="250" y="${74 + i * 22}" width="30" height="6" rx="3" fill="#2457E6"/>`).join("")}`);
    case "mobile": return box(`<rect width="320" height="150" fill="#F2F3EE"/><rect x="122" y="8" width="76" height="140" rx="12" fill="#15171C"/><rect x="127" y="16" width="66" height="126" rx="6" fill="#fff"/>${[0, 1, 2, 3].map(i => `<rect x="132" y="${24 + i * 29}" width="56" height="24" rx="4" fill="${i === 0 ? "#FFF7C2" : "#F2F3EE"}"/><rect x="136" y="${29 + i * 29}" width="30" height="4" rx="2" fill="#767D8C"/><rect x="136" y="${37 + i * 29}" width="44" height="4" rx="2" fill="#15171C"/>`).join("")}`);
    case "bars": return box(`<rect width="320" height="150" fill="#fff"/><path d="M30 128h264" stroke="#E2E5DD"/>${[50, 74, 62, 96, 84, 110].map((h, i) => `<rect x="${44 + i * 42}" y="${128 - h}" width="26" height="${h}" rx="3" fill="${i === 5 ? "#11966F" : "#A8E3CC"}"/>`).join("")}`);
    default: return box(`<rect width="320" height="150" fill="#F2F3EE"/><path d="M140 62l-12 13 12 13M180 62l12 13-12 13" fill="none" stroke="#B9BEB2" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
}
export function Thumb({ item }) {
  return <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: thumbSvg(item) }} />;
}

/* ---------- 小さな部品 ---------- */
export function PremTag({ item, premium }) {
  if (!item?.premium) return null;
  return <><span className="prem">PREMIUM</span>{premium && <span className="avail">✓ 利用可能</span>}</>;
}
export const START = { blank: ["まっさらな環境から", "blank"], ready: ["用意済みの環境から", "ready"], trouble: ["障害が起きた環境から", "trouble"] };
export function StartTag({ start }) {
  if (!START[start]) return null;
  return <span className={`start ${START[start][1]}`}>{START[start][0]}</span>;
}
export function Back({ onClick, children = "← 戻る" }) {
  return <button type="button" className="back" onClick={onClick}>{children}</button>;
}

// 読み込み中・失敗（0件として出さない）
export function Loading({ what = "読み込んでいます…" }) {
  return <p className="muted" role="status" style={{ padding: "40px 0" }}>{what}</p>;
}
export function LoadError({ onRetry, what = "読み込めませんでした" }) {
  return (
    <div className="card flat" role="alert" style={{ padding: "18px 20px", display: "grid", gap: 10, justifyItems: "start", marginTop: 16 }}>
      <b>{what}</b>
      <span className="muted" style={{ fontSize: 13.5 }}>通信状況を確かめて、もう一度読み込んでください。記録は消えていません。</span>
      {onRetry && <button type="button" className="btn ghost" onClick={onRetry}>もう一度読み込む</button>}
    </div>
  );
}

/* ---------- 横送り（端では矢印を隠す） ---------- */
export function Carousel({ children }) {
  const track = useRef(null);
  const [ends, setEnds] = useState({ prev: true, next: false });
  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    const sync = () => setEnds({ prev: el.scrollLeft < 4, next: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => { el.removeEventListener("scroll", sync); window.removeEventListener("resize", sync); };
  }, [children]);
  const move = dir => {
    const el = track.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduced ? "auto" : "smooth" });
  };
  return (
    <div className="car">
      <button type="button" className="car-btn prev" aria-label="前へ" hidden={ends.prev} onClick={() => move(-1)}>‹</button>
      <div className="car-track" ref={track}>{children}</div>
      <button type="button" className="car-btn next" aria-label="次へ" hidden={ends.next} onClick={() => move(1)}>›</button>
    </div>
  );
}
