import * as THREE from "three";

/* 成長の街：materialと建物の形。
 *
 * **色管理は旧挙動に固定する。** three r152以降は material.color を sRGB とみなして
 * 自動でリニアへ変換する。この街の色はその変換が無い前提で詰めてあるので、
 * 有効にすると全体が沈む。ここだけ切って、見た目の決め直しを避ける。 */
THREE.ColorManagement.enabled = false;

export const SKINS = [
  { n: "レンガと銅板", sw: ["#7A4A32", "#2E6B60", "#8A6A4A"], body: 0x2A1408, roof: 0x0A2822, trim: 0x2E1C10, acc: 0x1A4A42 },
  { n: "白壁と瓦",     sw: ["#C9C4B8", "#2A2E38", "#8A8478"], body: 0x585348, roof: 0x0E1016, trim: 0x2A2A24, acc: 0x3E3C34 },
  { n: "黒と真鍮",     sw: ["#1C1E24", "#B08838", "#4A4436"], body: 0x0E1014, roof: 0x080A0E, trim: 0x4A3410, acc: 0x7A5C1C },
];

export const LOT = 13, PAD = 8.0, WALK = 9.4, ROADY = 0.30, WALKY = 0.44, PADY = 0.56;
export const COLS = 5, ROWS = 4;
export const px = g => (g - (COLS - 1) / 2) * LOT;
export const pz = g => (g - (ROWS - 1) / 2) * LOT;

export const mkBox = (w, h, d, mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x || 0, y || 0, z || 0); return m;
};
export const mkCyl = (rt, rb, h, seg, mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat);
  m.position.set(x || 0, y || 0, z || 0); return m;
};
export const shade = (g, cast, recv) => {
  g.traverse(o => { if (o.isMesh) { o.castShadow = cast !== false; o.receiveShadow = recv !== false; } });
  return g;
};

function winTex(w, h) {
  const floors = Math.max(2, Math.round(h / 3.1)), cols = Math.max(2, Math.round(w / 2.3)), C = 22;
  const cv = document.createElement("canvas");
  cv.width = cols * C; cv.height = floors * C;
  const c = cv.getContext("2d");
  c.fillStyle = "#000"; c.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < floors; y++) for (let x = 0; x < cols; x++) {
    if (Math.random() < .3) continue;
    c.globalAlpha = .45 + Math.random() * .55;
    c.fillStyle = Math.random() < .78 ? "#FFD9A0" : "#CADEFF";
    c.fillRect(x * C + 4, y * C + 5, C - 8, C - 11);
  }
  c.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function bgWinTex() {
  const cols = 10, rows = 34, CC = 12;
  const cv = document.createElement("canvas");
  cv.width = cols * CC; cv.height = rows * CC;
  const c = cv.getContext("2d");
  c.fillStyle = "#000"; c.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (Math.random() < .42) continue;
    c.globalAlpha = .35 + Math.random() * .6;
    c.fillStyle = Math.random() < .8 ? "#FFD9A0" : "#CADEFF";
    c.fillRect(x * CC + 3, y * CC + 3, CC - 6, CC - 6);
  }
  c.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function glowTex() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const c = cv.getContext("2d");
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(.42, "rgba(255,255,255,.42)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

export function createMaterials() {
  const M = {};
  M.asphalt = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: .95 });
  M.walk = new THREE.MeshStandardMaterial({ color: 0x2B3346, roughness: .9 });
  M.padPave = new THREE.MeshStandardMaterial({ color: 0x262E44, roughness: .88 });
  M.padGrass = new THREE.MeshStandardMaterial({ color: 0x15120A, roughness: 1 });
  M.stone = new THREE.MeshStandardMaterial({ color: 0x2C3349, roughness: .9 });
  M.dome = new THREE.MeshStandardMaterial({ color: 0x143830, roughness: .42, metalness: .6 });
  M.flag = new THREE.MeshStandardMaterial({ color: 0x5A1810, roughness: .85, side: THREE.DoubleSide });
  M.roof = new THREE.MeshStandardMaterial({ color: 0x0A2822, roughness: .92 });
  M.trim = new THREE.MeshStandardMaterial({ color: 0x2E1C10, roughness: .75, metalness: .15 });
  M.acc = new THREE.MeshStandardMaterial({ color: 0x1A4A42, roughness: .5, metalness: .5 });
  M.metal = new THREE.MeshStandardMaterial({ color: 0x6F7893, roughness: .38, metalness: .84 });
  M.dark = new THREE.MeshStandardMaterial({ color: 0x161B2A, roughness: .8 });
  M.door = new THREE.MeshStandardMaterial({ color: 0x1A1008, roughness: .7 });
  M.shutter = new THREE.MeshStandardMaterial({ color: 0x545E7C, roughness: .55, metalness: .4 });
  M.insul = new THREE.MeshStandardMaterial({ color: 0x9FA7B8, roughness: .5 });
  M.tank = new THREE.MeshStandardMaterial({ color: 0x35566A, roughness: .5, metalness: .45 });
  M.trunk = new THREE.MeshStandardMaterial({ color: 0x241A0C, roughness: 1 });
  M.leaf = new THREE.MeshStandardMaterial({ color: 0x0A2412, roughness: 1 });
  M.bench = new THREE.MeshStandardMaterial({ color: 0x2A1A0C, roughness: .9 });
  M.fence = new THREE.MeshStandardMaterial({ color: 0x261608, roughness: .92 });
  M.planter = new THREE.MeshStandardMaterial({ color: 0x2A2620, roughness: .95 });
  M.awn = new THREE.MeshStandardMaterial({ color: 0x4A1810, roughness: .9 });
  M.scaf = new THREE.MeshStandardMaterial({ color: 0xD08A34, roughness: .62, metalness: .25 });
  M.crane = new THREE.MeshStandardMaterial({ color: 0xE0A23C, roughness: .6, metalness: .3 });
  M.sign = new THREE.MeshStandardMaterial({ color: 0x1A1008, roughness: .7, emissive: 0xFFC978, emissiveIntensity: 0 });
  M.neon = new THREE.MeshStandardMaterial({ color: 0x120A12, roughness: .5, emissive: 0xFF5C8A, emissiveIntensity: 0 });
  M.lantern = new THREE.MeshStandardMaterial({ color: 0x18120A, roughness: .7, emissive: 0xFFB25C, emissiveIntensity: 0 });
  M.edge = new THREE.MeshStandardMaterial({ color: 0x10182A, roughness: .6, emissive: 0x2FC4DF, emissiveIntensity: 0 });
  M.beacon = new THREE.MeshStandardMaterial({ color: 0x140404, emissive: 0xFF5B5B, emissiveIntensity: 1.6 });
  M.water = new THREE.MeshStandardMaterial({ color: 0x2A6C8C, roughness: .1, metalness: .5, emissive: 0x1E6A86, emissiveIntensity: .2 });
  M.clock = new THREE.MeshStandardMaterial({ color: 0xE8E2D0, roughness: .6, emissive: 0xFFE6B0, emissiveIntensity: 0 });
  M.wire = new THREE.MeshBasicMaterial({ color: 0x0A0D14 });
  M.louver = (() => {
    const cv = document.createElement("canvas"); cv.width = 16; cv.height = 64;
    const c = cv.getContext("2d");
    c.fillStyle = "#8C94AC"; c.fillRect(0, 0, 16, 64);
    c.fillStyle = "#3A4058";
    for (let y = 0; y < 64; y += 6) c.fillRect(0, y, 16, 3);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
    t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  M.glowT = glowTex();
  M.plan = new THREE.MeshBasicMaterial({ color: 0xF5C451, transparent: true, opacity: .8 });
  M.glow = new THREE.MeshBasicMaterial({ color: 0xFFE0A0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  M.beam = new THREE.MeshBasicMaterial({ color: 0xFFD9A0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  return M;
}

/* 建物ごとに材質を複製しておき、あとから外観（SKIN）を差し替えられるようにする */
function skinOf(s, M) {
  if (!s._sk) s._sk = { body: [], roof: M.roof.clone(), trim: M.trim.clone(), acc: M.acc.clone() };
  return s._sk;
}
function facade(s, M, w, h) {
  const K = skinOf(s, M);
  const m = new THREE.MeshStandardMaterial({
    color: 0x2A1408, roughness: .74, metalness: .08,
    emissive: 0xffffff, emissiveMap: winTex(w, h), emissiveIntensity: 0,
  });
  K.body.push(m); (s._win ||= []).push(m);
  return m;
}
function plainM(s, M) {
  const K = skinOf(s, M);
  const m = new THREE.MeshStandardMaterial({ color: 0x221006, roughness: .9 });
  K.body.push(m); return m;
}
const six = (f, p) => [f, f, f, f, p, p];

function rooftop(s, M, g, w, h) {
  const K = skinOf(s, M);
  g.add(mkBox(w + .4, .5, w + .4, K.trim, 0, h + .25, 0));
  for (let i = 0; i < 3; i++) {
    const x = -w * .26 + (i % 2) * w * .5, z = -w * .24 + Math.floor(i / 2) * w * .48;
    g.add(mkBox(1.3, .8, 1.1, M.metal, x, h + .9, z));
    const fan = mkCyl(.46, .46, .1, 12, M.dark, x, h + 1.35, z);
    g.add(fan); (s._fans ||= []).push(fan);
  }
  g.add(mkCyl(.9, .9, 1.6, 12, M.metal, w * .28, h + 1.8, -w * .28));
  g.add(mkCyl(.16, .2, 2.6, 6, M.metal, -w * .3, h + 1.8, w * .28));
  const dish = mkCyl(.1, .1, .16, 12, M.metal, -w * .3, h + 3.0, w * .28);
  dish.scale.set(5, 1, 5); dish.rotation.z = .6; g.add(dish);
}

/* 外観ごとの装飾。建物の種類によらず使えるものを足す */
function extras(s, M, g, w) {
  const E = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  const z = w / 2 + .9;
  E[0].add(mkBox(w * .9, .3, 1.7, M.awn, 0, 3.1, z - .3));
  for (let i = 0; i < 4; i++) E[0].add(mkBox(.14, .9, .14, M.metal, -w * .4 + i * w * .27, 2.6, z + .3));
  [-w * .38, w * .38].forEach(x => {
    E[0].add(mkBox(1.5, .8, 1.0, M.planter, x, .4, z));
    E[0].add(mkCyl(0, .7, 1.5, 8, M.leaf, x, 1.4, z));
    E[0].add(mkCyl(0, .5, 1.1, 8, M.leaf, x + .35, 1.1, z - .2));
  });
  for (let k = 0; k < 6; k++) E[1].add(mkBox(.16, 1.3, .16, M.fence, -w * .45 + k * (w * .9 / 5), .65, z + .5));
  E[1].add(mkBox(w * .95, .14, .14, M.fence, 0, 1.2, z + .5));
  E[1].add(mkBox(w * .95, .14, .14, M.fence, 0, .7, z + .5));
  [-w * .34, w * .34].forEach(x => {
    E[1].add(mkBox(.16, 2.8, .16, M.fence, x, 1.4, z - .1));
    const ln = mkCyl(.34, .34, .7, 10, M.lantern.clone(), x, 2.7, z - .1);
    E[1].add(ln); (s._lamp ||= []).push(ln.material);
  });
  E[1].add(mkBox(w * .8, .18, 1.3, M.fence, 0, 2.9, z - .5));
  const neon = mkBox(.3, 3.4, 1.1, M.neon.clone(), w / 2 + .2, 4.4, w * .28);
  E[2].add(neon); (s._neon ||= []).push(neon.material);
  E[2].add(mkBox(.5, .3, 1.3, M.metal, w / 2 + .2, 6.2, w * .28));
  const bar = mkBox(w * .86, .5, .3, M.neon.clone(), 0, 2.9, z - .2);
  E[2].add(bar); s._neon.push(bar.material);
  for (let q = 0; q < 3; q++) E[2].add(mkBox(.3, .3, .5, M.metal, -w * .3 + q * w * .3, 3.4, z - .1));
  E[2].add(mkBox(w * .95, .18, .18, M.metal, 0, 3.6, z - .1));
  E.forEach(x => { x.visible = false; g.add(x); });
  s._extras = E;
}

function archHall(s, M) {
  const g = new THREE.Group(), h = s.h;
  for (let i = 0; i < 3; i++) g.add(mkBox(8.6 - i * .7, .3, 8.6 - i * .7, M.stone, 0, .15 + i * .3, 0));
  g.add(mkBox(6.8, h - 2, 6.0, six(facade(s, M, 6.8, h - 2), M.stone), 0, (h - 2) / 2 + .9, -.4));
  for (let c = 0; c < 5; c++) {
    g.add(mkCyl(.34, .38, h - 3.4, 12, M.stone, -2.6 + c * 1.3, (h - 3.4) / 2 + .9, 2.9));
    g.add(mkBox(.9, .22, .9, M.stone, -2.6 + c * 1.3, h - 2.5, 2.9));
  }
  const sh = new THREE.Shape();
  sh.moveTo(-3.9, 0); sh.lineTo(3.9, 0); sh.lineTo(0, 1.9); sh.closePath();
  const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .7, bevelEnabled: false }), M.stone);
  ped.position.set(0, h - 2.3, 2.6); g.add(ped);
  g.add(mkBox(7.4, .45, 6.6, M.stone, 0, h - 1.9, -.4));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.0, 20, 14, 0, 6.29, 0, Math.PI / 2), M.dome);
  dome.position.set(0, h - 1.6, -.4); g.add(dome);
  g.add(mkCyl(.12, .16, 2.6, 8, M.metal, 0, h + 1.6, -.4));
  g.add(mkCyl(.1, .12, 7.0, 8, M.metal, -4.2, 3.5, 3.4));
  const fl = mkBox(2.2, 1.3, .06, M.flag, -3.05, 6.4, 3.4); g.add(fl); s._flag = fl;
  [-3.2, 3.2].forEach(x => {
    const lp = mkBox(.5, .8, .5, M.lantern.clone(), x, 2.0, 3.6);
    g.add(lp); (s._lamp ||= []).push(lp.material);
  });
  g.add(mkBox(2.0, 2.6, .2, M.dark, 0, 2.2, 2.55));
  return shade(g);
}
function archShop(s, M) {
  const g = new THREE.Group(), h = s.h, w = 7.4, K = skinOf(s, M);
  g.add(mkBox(w, h, w, six(facade(s, M, w, h), plainM(s, M)), 0, h / 2, 0));
  for (let i = 1; i * 3.1 < h; i++) g.add(mkBox(w + .3, .22, w + .3, K.trim, 0, i * 3.1, 0));
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2 - .4, 0); sh.lineTo(w / 2 + .4, 0); sh.lineTo(0, 2.3); sh.closePath();
  const rg = new THREE.ExtrudeGeometry(sh, { depth: w + .8, bevelEnabled: false });
  rg.translate(0, 0, -(w + .8) / 2);
  const roof = new THREE.Mesh(rg, K.roof); roof.position.y = h; g.add(roof);
  const sg = mkBox(3.6, 1.15, .28, M.sign.clone(), 0, 4.15, w / 2 + .2);
  g.add(sg); (s._sign ||= []).push(sg.material);
  g.add(mkBox(1.7, 2.4, .2, M.door, 0, 1.2, w / 2 + .1));
  extras(s, M, g, w);
  return shade(g);
}
function archTank(s, M) {
  const g = new THREE.Group(), h = s.h, K = skinOf(s, M);
  [[-2.0, -1.2, 1.9], [2.0, 1.3, 1.6]].forEach((v, i) => {
    const hh = h * (i ? .78 : 1);
    g.add(mkCyl(v[2], v[2], hh, 18, M.tank, v[0], hh / 2, v[1]));
    g.add(mkCyl(0, v[2] + .18, 1.1, 18, K.roof, v[0], hh + .55, v[1]));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(v[2] + .1, .08, 6, 22), M.metal);
    ring.rotation.x = Math.PI / 2; ring.position.set(v[0], hh - .5, v[1]); g.add(ring);
  });
  const p1 = mkCyl(.32, .32, 4.4, 10, M.metal, 0, 2.2, .1); p1.rotation.z = Math.PI / 2; g.add(p1);
  const p2 = mkCyl(.26, .26, 3.0, 10, M.metal, -2.0, 1.1, 1.4); p2.rotation.x = Math.PI / 2; g.add(p2);
  g.add(mkBox(3.3, 2.5, 2.6, six(facade(s, M, 3.3, 2.5), plainM(s, M)), .3, 1.25, -2.9));
  g.add(mkBox(3.6, .3, 2.9, K.roof, .3, 2.6, -2.9));
  for (let i = 0; i < 4; i++) g.add(mkBox(.16, 1.3, .16, M.metal, -3.6 + i * 2.4, .65, 3.5));
  g.add(mkBox(7.6, .14, .14, M.metal, 0, 1.3, 3.5));
  extras(s, M, g, 7.4);
  return shade(g);
}
function archMast(s, M) {
  const g = new THREE.Group(), h = s.h, K = skinOf(s, M);
  g.add(mkBox(5.0, 1.3, 5.0, K.trim, 0, .65, 0));
  for (let i = 0; i < 4; i++) {
    const y0 = 1.3 + (h - 1.3) * (i / 4), y1 = 1.3 + (h - 1.3) * ((i + 1) / 4);
    const r0 = 1.5 - 1.15 * (i / 4), r1 = 1.5 - 1.15 * ((i + 1) / 4);
    g.add(mkCyl(r1, r0, y1 - y0, 4, M.metal, 0, (y0 + y1) / 2, 0));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r1 * 1.1, .07, 5, 4), M.metal);
    ring.rotation.x = Math.PI / 2; ring.position.y = y1; g.add(ring);
  }
  [[.42, 2.0], [.68, 1.5]].forEach(v => {
    g.add(mkBox(v[1] * 2, .22, v[1] * 2, M.metal, 0, 1.3 + (h - 1.3) * v[0], 0));
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1;
      const dish = mkCyl(.1, .1, .22, 14, M.metal, Math.cos(a) * v[1], 1.3 + (h - 1.3) * v[0] + .8, Math.sin(a) * v[1]);
      dish.scale.set(5.2, 1, 5.2); dish.rotation.z = .5; g.add(dish);
    }
  });
  g.add(mkCyl(.07, .12, 5.2, 6, M.metal, 0, h + 2.4, 0));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.34, 10, 10), M.beacon.clone());
  tip.position.y = h + 5.1; g.add(tip); s._beacon = tip;
  return shade(g);
}
function archSub(s, M) {
  const g = new THREE.Group(), h = s.h, K = skinOf(s, M);
  g.add(mkBox(6.0, h, 4.6, six(facade(s, M, 6, h), plainM(s, M)), -.8, h / 2, -1.6));
  g.add(mkBox(6.4, .35, 5.0, K.roof, -.8, h + .15, -1.6));
  for (let i = 0; i < 3; i++) {
    g.add(mkCyl(1.0, 1.0, 2.3, 14, M.metal, -2.4 + i * 2.4, 1.15, 2.4));
    for (let k = 0; k < 3; k++) g.add(mkCyl(.17, .2, .66, 8, M.insul, -2.9 + i * 2.4 + k * .5, 2.7, 2.4));
  }
  [-3.4, 3.4].forEach(x => g.add(mkBox(.3, 6.2, .3, M.metal, x, 3.1, .3)));
  g.add(mkBox(7.4, .26, .26, M.metal, 0, 6.1, .3));
  g.add(mkBox(7.4, .26, .26, M.metal, 0, 5.1, .3));
  for (let f = 0; f < 9; f++) g.add(mkBox(.1, 1.5, .1, M.metal, -3.8 + f * .95, .75, 3.8));
  return shade(g);
}
function archDC(s, M) {
  const g = new THREE.Group(), h = s.h, w = 8.2, K = skinOf(s, M);
  const wall = new THREE.MeshStandardMaterial({ color: 0x2A1408, roughness: .8, map: M.louver });
  K.body.push(wall);
  g.add(mkBox(w, h, w, wall, 0, h / 2, 0));
  rooftop(s, M, g, w, h);
  [-w / 2 - .1, w / 2 + .1].forEach(xx => {
    g.add(mkBox(.3, h * .9, .3, M.metal, xx, h * .45, -2.6));
    g.add(mkBox(.3, h * .9, .3, M.metal, xx, h * .45, 2.6));
  });
  g.add(mkBox(3.6, .3, 2.4, K.trim, 0, 3.2, w / 2 + 1.0));
  const led = mkBox(w * .8, .18, .14, M.edge.clone(), 0, h - .6, w / 2 + .05);
  g.add(led); (s._edge ||= []).push(led.material);
  extras(s, M, g, w);
  return shade(g);
}
function archTower(s, M) {
  const g = new THREE.Group(), h = s.h, K = skinOf(s, M);
  g.add(mkBox(8.0, 4.0, 8.0, K.trim, 0, 2.0, 0));
  g.add(mkBox(8.6, .4, 8.6, K.roof, 0, 4.2, 0));
  const glass = new THREE.MeshStandardMaterial({
    color: 0x1B2C46, roughness: .14, metalness: .92,
    emissive: 0xffffff, emissiveMap: winTex(5.2, h), emissiveIntensity: 0,
  });
  (s._win ||= []).push(glass);
  let y = 4.4;
  [[5.4, .46], [4.4, .31], [3.2, .23]].forEach(t => {
    const hh = (h - 4.4) * t[1];
    g.add(mkBox(t[0], hh, t[0], glass, 0, y + hh / 2, 0));
    g.add(mkBox(t[0] + .5, .34, t[0] + .5, K.roof, 0, y + hh, 0));
    y += hh;
  });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(v => {
    g.add(mkBox(.34, h - 5.0, .34, K.acc, v[0] * 2.75, (h + 4.4) / 2 - .3, v[1] * 2.75));
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.5, .62, 10, 28), K.acc);
  ring.rotation.x = Math.PI / 2; ring.position.y = h * .74; g.add(ring);
  const ringG = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 1.1, 28, 1, true), glass);
  ringG.position.y = h * .74; g.add(ringG);
  g.add(mkCyl(2.0, 2.0, .3, 22, K.trim, 0, y + .2, 0));
  g.add(mkCyl(.08, .16, 6.0, 6, M.metal, 0, y + 3.2, 0));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.36, 10, 10), M.beacon.clone());
  tip.position.y = y + 6.3; g.add(tip); s._beacon = tip;
  return shade(g);
}
function archHangar(s, M) {
  const g = new THREE.Group(), h = s.h, w = 8.0, d = 7.6, bh = h * .52, r = w / 2, K = skinOf(s, M);
  g.add(mkBox(w, bh, d, six(facade(s, M, w, bh), plainM(s, M)), 0, bh / 2, 0));
  const barrel = mkCyl(r, r, d, 24, K.roof, 0, bh, 0); barrel.rotation.x = Math.PI / 2; g.add(barrel);
  for (let i = 0; i < 3; i++) g.add(mkBox(2.0, bh * .8, .18, M.shutter, -2.6 + i * 2.6, bh * .4, d / 2 + .06));
  g.add(mkBox(w + .4, .3, .5, K.trim, 0, bh * .84, d / 2 + .2));
  g.add(mkBox(.3, h * 1.5, .3, M.metal, -3.2, h * .75, -3.0));
  g.add(mkBox(6.4, .24, .24, M.metal, -0.6, h * 1.5, -3.0));
  g.add(mkBox(.14, 2.2, .14, M.metal, 1.4, h * 1.5 - 1.1, -3.0));
  g.add(mkBox(.6, .4, .6, M.metal, 1.4, h * 1.5 - 2.3, -3.0));
  extras(s, M, g, w);
  return shade(g);
}
function archPlaza(s, M, trees) {
  const g = new THREE.Group(), K = skinOf(s, M);
  g.add(mkBox(PAD, .16, PAD, K.trim, 0, .08, 0));
  g.add(mkCyl(2.5, 2.7, .7, 24, M.stone, 0, .35, 0));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.55, .16, 8, 26), K.acc);
  rim.rotation.x = Math.PI / 2; rim.position.y = .7; g.add(rim);
  const water = mkCyl(2.35, 2.35, .06, 24, M.water, 0, .72, 0); g.add(water); s._water = water;
  g.add(mkCyl(.22, .3, 1.8, 10, K.acc, 0, 1.6, 0));
  const jet = mkCyl(.16, .05, 2.4, 8, M.water, 0, 3.2, 0); g.add(jet); s._jet = jet;
  g.add(mkBox(1.1, s.h, 1.1, M.stone, -2.9, s.h / 2, -2.9));
  const face = mkCyl(.62, .62, .18, 18, M.clock, -2.9, s.h - .5, -2.3);
  face.rotation.x = Math.PI / 2; g.add(face);
  g.add(mkBox(1.5, .5, 1.5, K.roof, -2.9, s.h + .25, -2.9));
  [[2.9, -2.6], [3.0, 2.4], [-2.6, 2.9], [-3.1, .2]].forEach((v, i) => {
    const t = new THREE.Group();
    t.add(mkCyl(.17, .24, 1.2, 6, M.trunk, 0, .6, 0));
    t.add(mkCyl(0, 1.15, 2.4, 9, M.leaf, 0, 2.1, 0));
    t.add(mkCyl(0, .82, 1.7, 9, M.leaf, 0, 3.2, 0));
    t.position.set(v[0], 0, v[1]); t.scale.setScalar(.85 + (i % 3) * .12);
    g.add(t); trees.push({ g: t, o: i * 1.7 });
  });
  [[-1.2, 3.2], [1.2, 3.2]].forEach(v => {
    g.add(mkBox(1.6, .16, .5, M.bench, v[0], .5, v[1]));
    g.add(mkBox(.16, .4, .4, M.metal, v[0] - .6, .28, v[1]));
    g.add(mkBox(.16, .4, .4, M.metal, v[0] + .6, .28, v[1]));
  });
  return shade(g);
}

export const ARCH = {
  hall: archHall, shop: archShop, tank: archTank, mast: archMast,
  sub: archSub, dc: archDC, tower: archTower, hangar: archHangar, plaza: archPlaza,
};

export function applySkin(s, i) {
  const K = s._sk; if (!K) return;
  const v = SKINS[i] || SKINS[0];
  K.body.forEach(m => m.color.setHex(v.body));
  K.roof.color.setHex(v.roof);
  K.trim.color.setHex(v.trim);
  K.acc.color.setHex(v.acc);
  if (s._extras) s._extras.forEach((g, k) => { g.visible = (k === i); });
}
