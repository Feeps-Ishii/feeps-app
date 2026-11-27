import { AWS_ICON } from "./awsIcons.js";

/* AWS実習の構成図（2026-11-19、モック tenolab-drills.html「AWS実習」）。
   宣伝ページと同じアイコン・同じ寸法（360×272）。中身はこちらで決めた固定の図だけなので、SVG の文字列で返す。
   dr = 線を描く / fd = ふわっと出す / pp = 下から出す（.awl-arch.in のときに動く）。crop = カードの小さい図 */
const FONT = "Zen Kaku Gothic New, Arial, sans-serif";

export const AWS_DIAGRAMS = ["vpc", "vpcec2", "elb", "asg", "cw", "recover"];

export function awsDiagram(id, uid, crop = false) {
  let dd = 0;
  const nx = (s = 0.12) => (dd += s).toFixed(2);
  const src = k => `data:image/svg+xml;base64,${AWS_ICON[k]}`;
  const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 9.5}" fill="${o.fill || "#232F3E"}" ${o.anchor ? `text-anchor="${o.anchor}"` : ""} font-family="${o.mono ? "JetBrains Mono, monospace" : FONT}" ${o.weight ? `font-weight="${o.weight}"` : ""}>${s}</text>`;
  const box = (x, y, w, h, stroke, o = {}) => (o.dash
    ? `<rect class="fd" style="--dd:${nx(o.d)}s" x="${x}" y="${y}" width="${w}" height="${h}" fill="${o.fill || "none"}" stroke="${stroke}" stroke-width="1.2" stroke-dasharray="${o.dash}" ${o.rx ? `rx="${o.rx}"` : ""}/>`
    : `<rect class="dr" pathLength="1" style="--dd:${nx(o.d)}s" x="${x}" y="${y}" width="${w}" height="${h}" fill="${o.fill || "none"}" stroke="${stroke}" stroke-width="1.2"/>`);
  const glabel = (k, x, y, s, size = 18) => `<g class="fd" style="--dd:${nx()}s"><image href="${src(k)}" x="${x}" y="${y}" width="${size}" height="${size}"/>${T(x + size + 5, y + 12.5, s)}</g>`;
  const icon = (k, x, y, s, label, o = {}) => `<g class="pp" style="--dd:${nx(0.1)}s" ${o.op ? `opacity="${o.op}"` : ""}>${o.bg ? `<rect x="${x - 1}" y="${y - 1}" width="${s + 2}" height="${s + 2}" fill="#FFFFFF"/>` : ""}<image href="${src(k)}" x="${x}" y="${y}" width="${s}" height="${s}"/>${label ? T(o.lx ?? x + s / 2, o.ly ?? y + s + 12, label, { anchor: o.anchor || "middle" }) : ""}</g>`;
  const arrow = (d, o = {}) => `<path class="dr" pathLength="1" style="--dd:${nx(0.08)}s" d="${d}" stroke="${o.color || "#545B64"}" stroke-width="1.3" fill="none" ${o.end === false ? "" : `marker-end="url(#ah-${uid}${o.color ? "r" : ""})"`}/>`;
  const defs = `<defs><marker id="ah-${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#545B64"/></marker><marker id="ah-${uid}r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#D9483B"/></marker></defs>`;
  const frame = (vpcW = 292) => box(10, 10, 340, 252, "#232F3E") + glabel("cloud", 10, 10, "AWS Cloud", 20)
    + box(22, 38, 316, 216, "#00A4A6", { dash: "4 3" }) + glabel("region", 22, 38, "ap-northeast-1（東京）")
    + box(34, 76, vpcW, 170, "#8C4FFF") + glabel("vpc", 34, 76, "VPC 10.0.0.0/16");
  const subnets = () => box(46, 160, 128, 78, "#7AA116", { fill: "#F2F6E8" }) + glabel("subnet", 46, 160, "Public subnet")
    + box(186, 160, 128, 78, "#7AA116", { fill: "#F2F6E8" }) + glabel("subnet", 186, 160, "Public subnet");
  const igw = (x = 166) => icon("igw", x, 62, 28, "", { bg: true }) + `<g class="fd" style="--dd:${nx()}s">${T(x + 33, 68, "Internet Gateway", { size: 9 })}</g>`;
  const cidr = (cx, s) => `<g class="fd" style="--dd:${nx()}s">${T(cx, 204, s, { anchor: "middle", mono: true, size: 9, fill: "#5F6B3A" })}</g>`;
  const highlight = (cx, cy, r) => `<circle class="fd" style="--dd:${nx()}s" cx="${cx}" cy="${cy}" r="${r}" fill="rgba(201,238,91,.55)"/>`;

  let body = "";
  if (id === "vpc") {
    body = frame() + subnets() + igw()
      + arrow("M180 90 L180 146", { end: false }) + arrow("M180 146 L110 146 L110 158") + arrow("M180 146 L250 146 L250 158")
      + cidr(110, "10.0.1.0/24") + cidr(250, "10.0.2.0/24")
      + `<g class="fd" style="--dd:${nx()}s">${T(110, 220, "AZ-a", { anchor: "middle", size: 8.5, fill: "#6A7D71" })}${T(250, 220, "AZ-c", { anchor: "middle", size: 8.5, fill: "#6A7D71" })}</g>`;
  } else if (id === "vpcec2") {
    body = frame() + subnets() + igw()
      + arrow("M180 90 L180 140 L150 140 L150 180")
      + box(128, 182, 44, 52, "#DD344C", { dash: "3 2" })
      + icon("ec2", 136, 188, 28, "EC2", { ly: 228 })
      + `<g class="fd" style="--dd:${nx()}s">${T(122, 210, "SG :80", { mono: true, size: 8.5, fill: "#C7253E", anchor: "end" })}</g>`
      + cidr(250, "10.0.2.0/24");
  } else if (id === "elb") {
    body = frame() + `<g opacity=".55">${subnets()}</g>` + igw()
      + arrow("M180 90 L180 101") + highlight(180, 118, 19) + icon("alb", 165, 103, 30, "ALB", { lx: 201, ly: 122, anchor: "start" })
      + arrow("M180 133 L180 146", { end: false }) + arrow("M180 146 L110 146 L110 158") + arrow("M180 146 L250 146 L250 158")
      + icon("ec2", 96, 186, 28, "EC2", { op: 0.6 }) + icon("ec2", 236, 186, 28, "EC2", { op: 0.6 })
      + `<g class="fd" style="--dd:${nx()}s"><rect x="268" y="84" width="46" height="15" rx="7.5" fill="#F1FAD6" stroke="#2E9A5E"/>${T(291, 94.5, "足す", { anchor: "middle", size: 8.5, weight: 700, fill: "#3F6B12" })}</g>`;
  } else if (id === "asg") {
    body = frame() + `<g opacity=".55">${subnets()}</g>` + igw()
      + arrow("M180 90 L180 101") + icon("alb", 165, 103, 30, "ALB", { lx: 201, ly: 122, anchor: "start", op: 0.6 })
      + arrow("M180 133 L180 178")
      + `<rect class="fd" style="--dd:${nx()}s" x="52" y="180" width="256" height="56" rx="4" fill="rgba(237,113,0,.05)" stroke="#ED7100" stroke-width="1.3" stroke-dasharray="5 3"/>`
      + icon("ec2", 98, 188, 24, "") + icon("ec2", 220, 188, 24, "")
      + `<g class="fd" style="--dd:${nx()}s"><rect x="262" y="188" width="24" height="24" rx="3" fill="#FFF6EC" stroke="#ED7100" stroke-dasharray="3 2"/>${T(274, 203.5, "+1", { anchor: "middle", mono: true, size: 9, weight: 700, fill: "#B4610E" })}</g>`
      + `<g class="fd" style="--dd:${nx()}s">${T(58, 231, "Auto Scaling group", { size: 9, fill: "#B4610E", weight: 700 })}</g>`;
  } else if (id === "cw" || id === "recover") {
    const bad = id === "recover";
    body = frame(166)
      + box(46, 140, 142, 98, "#7AA116", { fill: "#F2F6E8" }) + glabel("subnet", 46, 140, "Public subnet")
      + icon("igw", 136, 62, 28, "", { bg: true }) + `<g class="fd" style="--dd:${nx()}s">${T(169, 68, "Internet Gateway", { size: 9 })}</g>`
      + (bad ? arrow("M150 90 L150 168", { color: "#D9483B" }) : arrow("M150 90 L150 168"))
      + (bad ? `<g class="fd" style="--dd:${nx()}s"><circle cx="150" cy="118" r="7" fill="#FFFFFF" stroke="#D9483B" stroke-width="1.4"/><path d="M146.5 114.5 L153.5 121.5 M153.5 114.5 L146.5 121.5" stroke="#D9483B" stroke-width="1.6"/></g>` : "")
      + box(128, 170, 44, 58, bad ? "#D9483B" : "#DD344C", { dash: "3 2" })
      + icon("ec2", 136, 178, 28, "EC2", { ly: 220 })
      + `<g class="fd" style="--dd:${nx()}s">${T(122, 202, bad ? "SG :80 ✕" : "SG :80", { mono: true, size: 8.5, fill: "#C7253E", anchor: "end" })}</g>`
      + arrow("M166 192 L180 192 L180 118 L212 118")
      + `<g class="fd" style="--dd:${nx()}s">${T(176, 152, "CPU", { mono: true, size: 8.5, fill: "#6A7D71", anchor: "end" })}</g>`
      + icon("cw", 216, 104, 28, "CloudWatch", { lx: 250, ly: 122, anchor: "start" })
      + `<g class="fd" style="--dd:${nx()}s">${bad ? `<circle class="ping" cx="230" cy="104" r="6" fill="#D9483B"/>` : ""}<rect x="250" y="128" width="${bad ? 44 : 46}" height="15" rx="7.5" fill="${bad ? "#FBE9E7" : "#F1FAD6"}" stroke="${bad ? "#F1C4BE" : "#2E9A5E"}"/>${T(bad ? 272 : 273, 138.5, bad ? "ALARM" : "アラーム", { anchor: "middle", size: 8.5, weight: 700, fill: bad ? "#A2342A" : "#3F6B12", mono: bad })}</g>`
      + arrow("M230 134 L230 166")
      + `<g class="pp" style="--dd:${nx()}s"><rect x="216" y="170" width="28" height="22" rx="3" fill="#FFFFFF" stroke="#E7157B" stroke-width="1.4"/><path d="M217 171 L230 183 L243 171" stroke="#E7157B" stroke-width="1.4" fill="none"/>${T(250, 185, bad ? "対応メモ" : "SNS → メール", { size: 9 })}</g>`;
  } else {
    // 図の無い実習（あとから足したもの）：枠だけ
    body = frame() + subnets() + igw();
  }
  return `<svg viewBox="${crop ? "28 54 304 194" : "0 0 360 272"}" role="img" aria-label="AWS の構成図" xmlns="http://www.w3.org/2000/svg">${defs}<rect width="360" height="272" rx="12" fill="#FFFFFF"/>${body}</svg>`;
}
