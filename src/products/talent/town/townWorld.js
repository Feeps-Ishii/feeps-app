import * as THREE from "three";
import {
  SKINS, ARCH, applySkin, createMaterials, bgWinTex,
  LOT, PAD, WALK, ROADY, WALKY, PADY, COLS, ROWS, px, pz, mkBox, mkCyl, shade,
} from "./townArch.js";
import { createPost } from "./townPost.js";

/* 街そのもの。Reactからは createTown() → setState() / focus() / dispose() だけを触る。
 * 画面の状態（何を買ったか）は持たない。渡されたものを絵にするだけにしてある。 */

const SKY = {
  night: ["#04060E", "#0C1426", "#2C3760"],
  dusk: ["#1A1A30", "#4E3A56", "#D88A4A"],
  day: ["#4C7CB4", "#9CC0DC", "#E2E8DE"],
};
const FOGC = { night: 0x1D2645, dusk: 0x8C6650, day: 0xC6D6DE };
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mixHex = (a, b, t) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const nearAngle = (target, current) => {
  const d = (((target - current + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return current + d;
};

function buildPath(R, cr) {
  const pts = [], K = 7;
  const arc = (cx, cz, a0, a1) => {
    for (let i = 1; i <= K; i++) {
      const a = a0 + (a1 - a0) * (i / K);
      pts.push([cx + Math.cos(a) * cr, cz + Math.sin(a) * cr]);
    }
  };
  const e = R - cr;
  pts.push([-e, -R], [e, -R]); arc(e, -e, -Math.PI / 2, 0);
  pts.push([R, e]); arc(e, e, 0, Math.PI / 2);
  pts.push([-e, R]); arc(-e, e, Math.PI / 2, Math.PI);
  pts.push([-R, -e]); arc(-e, -e, Math.PI, Math.PI * 1.5);
  const L = [0]; let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(total);
  }
  total += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  return { pts, L, total };
}
function onPath(P, u) {
  const d = (((u % 1) + 1) % 1) * P.total; let i = 1;
  while (i < P.L.length && P.L[i] < d) i++;
  const a = P.pts[i - 1], b = P.pts[i % P.pts.length];
  const l0 = P.L[i - 1], l1 = (i < P.L.length ? P.L[i] : P.total);
  const f = l1 > l0 ? (d - l0) / (l1 - l0) : 0;
  const dx = b[0] - a[0], dz = b[1] - a[1];
  return [a[0] + dx * f, a[1] + dz * f, Math.atan2(-dz, dx)];
}

function makeLabel() {
  const cv = document.createElement("canvas"); cv.width = 384; cv.height = 104;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  sp.scale.set(15.4, 4.2, 1); sp.userData = { cv, tex: t };
  return sp;
}
function setLabel(sp, top, bottom, color) {
  const cv = sp.userData.cv, c = cv.getContext("2d");
  c.clearRect(0, 0, 384, 104);
  c.textAlign = "center";
  c.shadowColor = "rgba(0,0,0,.85)"; c.shadowBlur = 10; c.shadowOffsetY = 2;
  c.font = "700 32px 'Zen Kaku Gothic New',system-ui,sans-serif";
  c.fillStyle = color; c.fillText(top, 192, 38);
  if (bottom) {
    c.font = "700 26px ui-monospace,Menlo,Consolas,monospace";
    c.fillStyle = bottom.includes("CR") ? "rgba(245,196,81,.98)" : "rgba(232,115,95,.98)";
    c.fillText(bottom, 192, 78);
  }
  c.shadowBlur = 0; c.shadowOffsetY = 0;
  sp.userData.tex.needsUpdate = true;
}
function makeScaffold(M, w, h) {
  const g = new THREE.Group(), r = w / 2 + .5;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(v => g.add(mkBox(.2, h, .2, M.scaf, v[0] * r, h / 2, v[1] * r)));
  const gap = Math.max(2.4, h / 8);
  for (let y = gap; y < h; y += gap) {
    g.add(mkBox(r * 2 + .2, .14, .14, M.scaf, 0, y, -r));
    g.add(mkBox(r * 2 + .2, .14, .14, M.scaf, 0, y, r));
    g.add(mkBox(.14, .14, r * 2 + .2, M.scaf, -r, y, 0));
    g.add(mkBox(.14, .14, r * 2 + .2, M.scaf, r, y, 0));
  }
  return g;
}
function makeCrane(M, h) {
  const g = new THREE.Group(), sp = new THREE.Group();
  g.add(mkBox(.42, h, .42, M.crane, 0, h / 2, 0));
  for (let y = 2; y < h; y += 2) g.add(mkBox(.7, .1, .7, M.crane, 0, y, 0));
  sp.add(mkBox(13, .34, .34, M.crane, 3.6, 0, 0));
  sp.add(mkBox(.34, 1.4, .34, M.crane, -2.3, .7, 0));
  sp.add(mkBox(1.6, .7, 1.0, M.crane, -3.0, -.1, 0));
  sp.add(mkBox(.08, 3.4, .08, M.metal, 7.0, -1.7, 0));
  sp.position.y = h; g.add(sp); g.userData.spinner = sp;
  return g;
}
function sidewalkKit(M, gx, gy, trees) {
  const g = new THREE.Group(), e = WALK / 2 - .9;
  const corners = (gx + gy) % 2 ? [[-e, -e], [e, e]] : [[e, -e], [-e, e]];
  corners.forEach((v, i) => {
    const t = new THREE.Group();
    t.add(mkCyl(.6, .8, .34, 8, M.planter, 0, .17, 0));
    t.add(mkCyl(.16, .24, 1.5, 6, M.trunk, 0, .9, 0));
    t.add(mkCyl(0, 1.05, 2.3, 8, M.leaf, 0, 2.4, 0));
    t.add(mkCyl(0, .74, 1.6, 8, M.leaf, 0, 3.4, 0));
    t.position.set(v[0], WALKY, v[1]);
    t.scale.setScalar(.78 + ((gx * 3 + gy * 5 + i * 7) % 5) * .09);
    t.rotation.y = (gx + i) * 1.3;
    g.add(t); trees.push({ g: t, o: i * 2.3 + gx });
  });
  const s = (gx + gy) % 4;
  if (s === 0 || s === 2) {
    g.add(mkBox(2.2, .16, .7, M.bench, 0, WALKY + .52, e));
    g.add(mkBox(2.2, .7, .16, M.bench, 0, WALKY + .85, e + .27));
    [-.85, .85].forEach(x => g.add(mkBox(.16, .5, .6, M.metal, x, WALKY + .27, e)));
  }
  if (s === 1 || s === 3) {
    g.add(mkCyl(.45, .38, 1.0, 10, M.metal, -e + .5, WALKY + .5, e));
    g.add(mkCyl(.5, .5, .12, 10, M.dark, -e + .5, WALKY + 1.05, e));
  }
  if (s === 3) {
    g.add(mkCyl(.12, .14, 2.6, 8, M.metal, e - .6, WALKY + 1.3, -e + .6));
    g.add(mkBox(1.1, .7, .1, M.metal, e - .6, WALKY + 2.5, -e + .6));
  }
  g.add(mkBox(WALK, .1, .22, M.metal, 0, WALKY + .5, -e - .5));
  for (let q = 0; q < 5; q++) g.add(mkBox(.14, .5, .14, M.metal, -e + q * (e * 2 / 4), WALKY + .28, -e - .5));
  return shade(g, true, true);
}
function poleKit(M) {
  const g = new THREE.Group();
  g.add(mkCyl(.2, .3, 8.5, 8, M.trim, 0, 4.25, 0));
  g.add(mkBox(3.0, .18, .18, M.trim, 0, 7.6, 0));
  g.add(mkBox(2.2, .18, .18, M.trim, 0, 6.9, 0));
  for (let i = 0; i < 4; i++) g.add(mkCyl(.1, .12, .34, 6, M.insul, -1.3 + i * .87, 7.85, 0));
  g.add(mkBox(.9, 1.0, .7, M.metal, 0, 5.6, .5));
  return shade(g);
}
function signalKit(M) {
  const g = new THREE.Group();
  g.add(mkCyl(.16, .22, 5.2, 8, M.trim, 0, 2.6, 0));
  g.add(mkBox(2.4, .16, .16, M.trim, 1.1, 5.0, 0));
  g.add(mkBox(1.4, .46, .3, M.dark, 2.0, 4.8, 0));
  [[-.45, 0xFF4A3A], [0, 0xFFC94A], [.45, 0x3ADC72]].forEach((v, i) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x090909, emissive: v[1], emissiveIntensity: i === 2 ? 1.6 : .12 });
    const lamp = mkCyl(.16, .16, .1, 10, m, 2.0 + v[0], 4.8, .17);
    lamp.rotation.x = Math.PI / 2; g.add(lamp);
  });
  return shade(g);
}
function wireBetween(M, a, b, y, sag) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    pts.push(new THREE.Vector3(a.x + (b.x - a.x) * u, y - Math.sin(u * Math.PI) * sag, a.z + (b.z - a.z) * u));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), M.wire);
}

export function createTown(canvas, opts = {}) {
  const plan = opts.plan || [];
  const T = { lots: {}, cars: [], peds: [], lamps: [], poles: [], trees: [] };
  let state = { land: new Set(), built: new Set(), skin: {}, labels: {} };
  let dayT = 0.52, auto = true, raf = 0, disposed = false, booted = false;
  let selected = null, spin = 0.035;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduce) spin = 0;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(1.7, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const post = createPost(renderer);

  const M = createMaterials();
  const scene = new THREE.Scene();
  const skyCv = document.createElement("canvas"); skyCv.width = 4; skyCv.height = 256;
  const skyCtx = skyCv.getContext("2d");
  const paintSky = (a, b, c3) => {
    const g = skyCtx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, a); g.addColorStop(.12, b); g.addColorStop(.22, c3); g.addColorStop(1, c3);
    skyCtx.fillStyle = g; skyCtx.fillRect(0, 0, 4, 256);
  };
  paintSky(...SKY.day);
  const skyTex = new THREE.CanvasTexture(skyCv);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  scene.fog = new THREE.Fog(FOGC.day, 125, 420);
  scene.environment = (() => {
    const faces = [["#1D2434", "#3C3129"], ["#1D2434", "#3C3129"], ["#2E3849", "#2E3849"],
      ["#0B0E16", "#0B0E16"], ["#1D2434", "#3C3129"], ["#1D2434", "#3C3129"]].map(c => {
      const cv = document.createElement("canvas"); cv.width = cv.height = 32;
      const x = cv.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 32);
      g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
      x.fillStyle = g; x.fillRect(0, 0, 32, 32); return cv;
    });
    const t = new THREE.CubeTexture(faces);
    t.needsUpdate = true; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  const cameraObj = new THREE.PerspectiveCamera(36, 16 / 9, .5, 900);
  const hemi = new THREE.HemisphereLight(0xC6DAF2, 0x1A1208, .3); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xFFEBC4, 1.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 20, far: 260 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = .022; sun.shadow.radius = 2.4;
  scene.add(sun); scene.add(sun.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x12160E, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  function roadTex() {
    const SZ = 1024, SPANX = LOT * COLS + 10, k = SZ / SPANX;
    const cv = document.createElement("canvas"); cv.width = cv.height = SZ;
    const c = cv.getContext("2d");
    c.fillStyle = "#14170F"; c.fillRect(0, 0, SZ, SZ);
    const RW = 4.6 * k, midX = SZ / 2, midY = SZ / 2;
    const lx = i => midX + (i - COLS / 2) * LOT * k;
    const ly = i => midY + (i - ROWS / 2) * LOT * k;
    c.fillStyle = "#2E3650";
    state.land.forEach(kk => {
      const [gx, gy] = kk.split(",").map(Number);
      const x0 = lx(gx), x1 = lx(gx + 1), y0 = ly(gy), y1 = ly(gy + 1);
      c.fillRect(x0 - RW / 2 - 1, y0 - RW / 2, (x1 - x0) + RW + 2, RW);
      c.fillRect(x0 - RW / 2 - 1, y1 - RW / 2, (x1 - x0) + RW + 2, RW);
      c.fillRect(x0 - RW / 2, y0 - RW / 2 - 1, RW, (y1 - y0) + RW + 2);
      c.fillRect(x1 - RW / 2, y0 - RW / 2 - 1, RW, (y1 - y0) + RW + 2);
    });
    c.fillStyle = "#8E98B4";
    state.land.forEach(kk => {
      const [gx, gy] = kk.split(",").map(Number);
      [ly(gy), ly(gy + 1)].forEach(yy => {
        for (let q = lx(gx) + 14; q < lx(gx + 1) - 10; q += 30) c.fillRect(q, yy - 1.6, 15, 3.2);
      });
      [lx(gx), lx(gx + 1)].forEach(xx => {
        for (let q = ly(gy) + 14; q < ly(gy + 1) - 10; q += 30) c.fillRect(xx - 1.6, q, 3.2, 15);
      });
    });
    c.fillStyle = "#C3CBDE";
    state.land.forEach(kk => {
      const [gx, gy] = kk.split(",").map(Number);
      [[lx(gx), ly(gy)], [lx(gx + 1), ly(gy)], [lx(gx), ly(gy + 1)], [lx(gx + 1), ly(gy + 1)]].forEach(pt => {
        for (let b = 0; b < 5; b++) {
          const d = -RW * .38 + b * RW * .19;
          c.fillRect(pt[0] + RW * .62, pt[1] + d, RW * .46, RW * .1);
          c.fillRect(pt[0] + d, pt[1] + RW * .62, RW * .1, RW * .46);
        }
      });
    });
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const plate = mkBox(LOT * COLS + 10, ROADY, LOT * ROWS + 10, M.asphalt, 0, ROADY / 2, 0);
  plate.receiveShadow = true; scene.add(plate);

  /* 区画 */
  plan.forEach(p => {
    const root = new THREE.Group();
    root.position.set(px(p.gx), 0, pz(p.gy));
    root.userData.lot = p.key;
    const walk = mkBox(WALK, WALKY - ROADY, WALK, M.walk, 0, (WALKY + ROADY) / 2, 0);
    walk.receiveShadow = true; root.add(walk);
    const pad = mkBox(PAD, PADY - WALKY, PAD, M.padGrass, 0, (PADY + WALKY) / 2, 0);
    pad.receiveShadow = true; root.add(pad);
    const rise = new THREE.Group(); rise.position.y = PADY; root.add(rise);

    const def = p.kind === "park" ? null : { ...p };
    if (def) rise.add(ARCH[def.arch](def, M, T.trees));
    else {
      const pk = new THREE.Group();
      pk.add(mkBox(PAD, .14, PAD, M.leaf, 0, .07, 0));
      for (let i = 0; i < 5; i++) {
        const t = new THREE.Group();
        t.add(mkCyl(.18, .26, 1.3, 6, M.trunk, 0, .65, 0));
        t.add(mkCyl(0, 1.3, 2.7, 9, M.leaf, 0, 2.3, 0));
        t.add(mkCyl(0, .9, 1.8, 9, M.leaf, 0, 3.5, 0));
        t.position.set(-2.6 + (i % 3) * 2.6, .1, -2.4 + Math.floor(i / 3) * 4.4);
        t.scale.setScalar(.8 + (i % 4) * .1);
        pk.add(t); T.trees.push({ g: t, o: i * 2.1 });
      }
      pk.add(mkBox(PAD, .05, 1.4, M.stone, 0, .16, 0));
      pk.add(mkBox(1.9, .16, .6, M.bench, -1.6, .6, 2.2));
      pk.add(mkBox(1.9, .7, .16, M.bench, -1.6, .92, 2.45));
      rise.add(shade(pk));
    }
    const kit = sidewalkKit(M, p.gx, p.gy, T.trees); kit.visible = false; root.add(kit);
    const maxH = def ? def.h : 4;
    const scaf = makeScaffold(M, 8.2, maxH + 1.5); scaf.position.y = PADY; scaf.visible = false; root.add(scaf);
    const crane = makeCrane(M, maxH + 6); crane.position.set(5.2, PADY, -5.2); crane.visible = false; root.add(crane);
    const dust = new THREE.Mesh(new THREE.RingGeometry(1, 1.35, 40), M.glow.clone());
    dust.rotation.x = -Math.PI / 2; dust.position.y = PADY + .1; dust.visible = false; root.add(dust);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 70, 18, 1, true), M.beam.clone());
    beam.position.y = PADY + 35; beam.visible = false; root.add(beam);
    const frame = new THREE.Group();
    [-PAD / 2, PAD / 2].forEach(v => {
      frame.add(mkBox(PAD, .07, .2, M.plan.clone(), 0, 0, v));
      frame.add(mkBox(.2, .07, PAD, M.plan.clone(), v, 0, 0));
    });
    frame.position.y = PADY + .04; frame.visible = false; root.add(frame);
    const label = makeLabel(); label.position.set(0, PADY + 3.6, 0); label.visible = false; root.add(label);

    scene.add(root);
    T.lots[p.key] = { p, def, root, rise, walk, pad, kit, scaf, crane, dust, beam, frame, label, t: 0, target: 0 };
    if (def) { def._lit = Math.random() * .5; applySkin(def, 0); }
  });

  /* 街灯・信号・電柱 */
  for (let gx = 0; gx <= COLS; gx++) for (let gy = 0; gy <= ROWS; gy++) {
    const ix = px(gx) - LOT / 2, iz = pz(gy) - LOT / 2;
    const near = `${Math.min(COLS - 1, gx)},${Math.min(ROWS - 1, gy)}`;
    if ((gx + gy) % 2 === 0) {
      const lg = new THREE.Group(); lg.position.set(ix + 5.3, ROADY, iz + 5.3);
      lg.add(mkCyl(.1, .16, 4.4, 8, M.trim, 0, 2.2, 0));
      lg.add(mkBox(1.3, .14, .14, M.trim, .55, 4.4, 0));
      const bm = new THREE.MeshStandardMaterial({ color: 0x0C0C10, emissive: 0xFFD79A, emissiveIntensity: 0 });
      lg.add(mkBox(.7, .2, .4, bm, 1.1, 4.3, 0));
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4),
        new THREE.MeshBasicMaterial({ color: 0xFFD79A, map: M.glowT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(1.1, .04, 0); lg.add(pool);
      lg.visible = false; scene.add(lg);
      T.lamps.push({ g: lg, m: bm, pool, near });
    } else {
      const sg = signalKit(M); sg.position.set(ix + 2.6, ROADY, iz + 2.6);
      sg.rotation.y = (gx + gy) * .9; sg.visible = false; scene.add(sg);
      T.lamps.push({ g: sg, m: null, pool: null, near, sig: true });
    }
    const pk2 = poleKit(M); pk2.position.set(ix - 5.4, ROADY, iz - 5.4);
    pk2.visible = false; scene.add(pk2);
    T.poles.push({ g: pk2, x: ix - 5.4, z: iz - 5.4, near, col: gx, row: gy });
  }
  const wireGroup = new THREE.Group(); scene.add(wireGroup);

  /* 車と人 */
  const ringR = [LOT * 0.9, LOT * 1.8];
  for (let ci = 0; ci < 10; ci++) {
    const g3 = new THREE.Group();
    const col = [0x8C93AA, 0x3E4A6B, 0x6E5A7C, 0x486A5E][ci % 4];
    g3.add(mkBox(2.0, .5, .95, new THREE.MeshStandardMaterial({ color: col, roughness: .4, metalness: .5 }), 0, .32, 0));
    g3.add(mkBox(1.1, .42, .86, new THREE.MeshStandardMaterial({ color: 0x121826, roughness: .2, metalness: .7 }), -.1, .72, 0));
    const hm = new THREE.MeshStandardMaterial({ color: 0x090909, emissive: 0xFFF0C8, emissiveIntensity: 0 });
    const tm = new THREE.MeshStandardMaterial({ color: 0x090909, emissive: 0xFF4A3A, emissiveIntensity: 0 });
    g3.add(mkBox(.1, .16, .7, hm, 1.02, .38, 0));
    g3.add(mkBox(.1, .14, .74, tm, -1.02, .40, 0));
    const bp = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 3.0),
      new THREE.MeshBasicMaterial({ color: 0xFFEFC8, map: M.glowT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    bp.rotation.x = -Math.PI / 2; bp.position.set(3.0, -.26, 0); g3.add(bp);
    shade(g3, true, false);
    g3.visible = false; scene.add(g3);
    const dir = ci % 2 ? 1 : -1, R = ringR[ci % 4 < 2 ? 0 : 1];
    T.cars.push({ g: g3, t: Math.random(), sp: (.05 + Math.random() * .04) * dir, dir, P: buildPath(R + dir * 1.15, 3.6), hm, tm, pool: bp });
  }
  for (let pi = 0; pi < 12; pi++) {
    const pg = new THREE.Group();
    pg.add(mkCyl(.17, .2, .9, 7, new THREE.MeshStandardMaterial({ color: [0x6E7A9A, 0x8A7E92, 0x5F7E86, 0x9A8A76][pi % 4], roughness: .9 }), 0, .45, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 8), new THREE.MeshStandardMaterial({ color: 0xB9A992, roughness: 1 }));
    head.position.y = 1.08; pg.add(head);
    shade(pg, true, false);
    pg.visible = false; scene.add(pg);
    const pd = pi % 2 ? 1 : -1;
    T.peds.push({ g: pg, t: Math.random(), sp: (.014 + Math.random() * .01) * pd, P: buildPath(ringR[pi % 4 < 2 ? 0 : 1] + pd * 2.6, 2.4), o: Math.random() * 6 });
  }

  /* 周囲の街 */
  const bgMat = new THREE.MeshStandardMaterial({
    color: 0x232A3E, roughness: .88, emissive: 0xffffff, emissiveMap: bgWinTex(), emissiveIntensity: 0,
  });
  const N = 170, inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bgMat, N);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  for (let n = 0; n < N; n++) {
    const ang = Math.random() * Math.PI * 2, rad = 78 + Math.pow(Math.random(), .8) * 150;
    const far = (rad - 78) / 150;
    const w2 = 6 + Math.random() * 9, h2 = 7 + Math.pow(Math.random(), 1.9) * (16 + far * 40);
    pv.set(Math.cos(ang) * rad, h2 / 2, Math.sin(ang) * rad);
    sv.set(w2, h2, w2 * (.7 + Math.random() * .6));
    qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * .5);
    m4.compose(pv, qq, sv); inst.setMatrixAt(n, m4);
  }
  inst.instanceMatrix.needsUpdate = true; scene.add(inst);
  const outer = new THREE.Mesh(new THREE.RingGeometry(34, 230, 56),
    new THREE.MeshStandardMaterial({ color: 0x101525, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = .02; outer.receiveShadow = true; scene.add(outer);

  /* 雲の影 */
  const cCv = document.createElement("canvas"); cCv.width = cCv.height = 256;
  const cc = cCv.getContext("2d");
  cc.fillStyle = "#000"; cc.fillRect(0, 0, 256, 256);
  for (let b = 0; b < 26; b++) {
    const bx = Math.random() * 256, bz = Math.random() * 256, br = 14 + Math.random() * 34;
    const rg = cc.createRadialGradient(bx, bz, 0, bx, bz, br);
    rg.addColorStop(0, "rgba(255,255,255,.9)"); rg.addColorStop(1, "rgba(255,255,255,0)");
    cc.fillStyle = rg; cc.beginPath(); cc.arc(bx, bz, br, 0, 7); cc.fill();
  }
  const cTex = new THREE.CanvasTexture(cCv);
  cTex.wrapS = cTex.wrapT = THREE.RepeatWrapping; cTex.repeat.set(2.2, 2.2);
  const clouds = new THREE.Mesh(new THREE.RingGeometry(35, 175, 40),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, alphaMap: cTex, depthWrite: false }));
  clouds.rotation.x = -Math.PI / 2; clouds.position.y = .05; scene.add(clouds);

  /* カメラ */
  const cam = { th: -0.72, ph: 0.40, rad: 240, f: 0.55, look: new THREE.Vector3(0, 6, 0) };
  const camT = { th: -0.72, ph: 1.00, rad: 96, f: 0.55, look: new THREE.Vector3(0, 6, 0) };
  const HOMECAM = { ph: 1.00, rad: 96, look: new THREE.Vector3(0, 6, 0) };
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();

  let drag = null;
  const onDown = e => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture?.(e.pointerId); };
  const onMove = e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    camT.th -= dx * 0.006; cam.th -= dx * 0.006;
    camT.ph = Math.max(0.30, Math.min(1.34, camT.ph - dy * 0.004)); cam.ph = camT.ph;
    drag.x = e.clientX; drag.y = e.clientY;
  };
  const onUp = e => {
    if (drag && drag.moved < 6 && e.type === "pointerup") pick(e);
    drag = null;
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => canvas.addEventListener(ev, onUp));

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, cameraObj);
    const targets = [];
    Object.values(T.lots).forEach(L => targets.push(L.rise, L.pad, L.walk));
    const hit = raycaster.intersectObjects(targets, true)[0];
    if (!hit) { api.focus(null); opts.onPick?.(null); return; }
    let o = hit.object;
    while (o && !o.userData.lot) o = o.parent;
    if (o) { api.focus(o.userData.lot); opts.onPick?.(o.userData.lot); }
  }

  function applyDay() {
    const ang = (dayT - 0.25) * Math.PI * 2, ex = Math.cos(ang), ey = Math.sin(ang), up = Math.max(0, ey);
    if (ey > -0.12) sun.position.set(ex * 110, Math.max(8, ey * 100), 40);
    else sun.position.set(-50, 74, -40);
    sun.target.position.set(0, 0, 0);
    const dayW = sstep(0.10, 0.40, ey), duskW = sstep(-0.22, 0.10, ey) * (1 - dayW);
    let a, b, c3;
    if (dayW > 0) {
      a = mixHex(SKY.dusk[0], SKY.day[0], dayW); b = mixHex(SKY.dusk[1], SKY.day[1], dayW); c3 = mixHex(SKY.dusk[2], SKY.day[2], dayW);
    } else {
      a = mixHex(SKY.night[0], SKY.dusk[0], duskW); b = mixHex(SKY.night[1], SKY.dusk[1], duskW); c3 = mixHex(SKY.night[2], SKY.dusk[2], duskW);
    }
    paintSky(a, b, c3); skyTex.needsUpdate = true;
    scene.fog.color.copy(new THREE.Color(FOGC.night).lerp(new THREE.Color(FOGC.dusk), duskW).lerp(new THREE.Color(FOGC.day), dayW));
    sun.intensity = 0.14 + up * 1.9;
    sun.color.set(ey < 0.30 ? mixHex("#FF8A3C", "#FFEBC4", sstep(-0.05, 0.36, ey)) : "#FFEBC4");
    if (ey <= -0.12) sun.color.set("#7E93D8");
    hemi.intensity = 0.15 + up * 0.20;
    const dark = 1 - sstep(-0.04, 0.16, ey);
    post.grade(dark, duskW, opts.effects === false ? 0 : 1);
    return dark;
  }

  const bumpF = (t, a, b) => {
    if (t < a) return 0;
    if (t < a + .16) return (t - a) / .16;
    if (t < b - .14) return 1;
    if (t < b) return (b - t) / .14;
    return 0;
  };
  const DUR = reduce ? 0.001 : 2.9;
  function paintLot(L, t) {
    const done = t >= 1;
    L.rise.visible = t > .02;
    const bt = Math.max(0, Math.min(1, (t - .12) / .62));
    L.rise.scale.y = Math.max(.001, 1 - Math.pow(1 - bt, 3));
    const sc = bumpF(t, .05, .84), cr = bumpF(t, .10, .90);
    L.scaf.visible = sc > .01 && !done; L.scaf.scale.y = Math.max(.001, sc);
    L.crane.visible = cr > .01 && !done; L.crane.scale.setScalar(Math.max(.001, cr));
    const d = t > .78 ? (t - .78) / .22 : 0;
    L.dust.visible = d > 0 && d < 1;
    if (L.dust.visible) { L.dust.scale.setScalar(1 + d * 6.5); L.dust.material.opacity = (1 - d) * .5; }
    L.beam.visible = d > 0 && d < 1;
    if (L.beam.visible) { L.beam.material.opacity = Math.sin(d * Math.PI) * .3; L.beam.scale.set(1 - d * .5, 1, 1 - d * .5); }
  }

  const clock = new THREE.Clock();
  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, clock.getDelta()), now = performance.now() / 1000;
    if (auto && !reduce) dayT = (dayT + dt / 150) % 1;
    const dark = applyDay();

    if (!selected && !reduce) camT.th += spin * dt;
    const k = Math.min(1, dt * 2.6);
    cam.th += (camT.th - cam.th) * k; cam.ph += (camT.ph - cam.ph) * k;
    cam.rad += (camT.rad - cam.rad) * k; cam.look.lerp(camT.look, k); cam.f += (camT.f - cam.f) * k;
    cameraObj.position.set(Math.sin(cam.th) * Math.sin(cam.ph) * cam.rad,
      Math.cos(cam.ph) * cam.rad + cam.look.y * .4, Math.cos(cam.th) * Math.sin(cam.ph) * cam.rad);
    cameraObj.position.x += cam.look.x * cam.f; cameraObj.position.z += cam.look.z * cam.f;
    cameraObj.lookAt(cam.look);

    Object.values(T.lots).forEach(L => {
      if (L.t !== L.target) { if (L.target === 0) L.t = 0; else L.t = Math.min(1, L.t + dt / DUR); }
      paintLot(L, L.t);
      if (L.crane.visible) L.crane.userData.spinner.rotation.y += dt * .55;
      if (L.frame.visible) {
        const o = .45 + Math.sin(now * 2.4) * .3;
        L.frame.children.forEach(m => { m.material.opacity = o; });
        L.label.position.y = PADY + 3.6 + Math.sin(now * 1.6) * .18;
      }
    });

    const pw = !!opts.isPowered?.(state);
    Object.values(T.lots).forEach(({ def: s }) => {
      if (!s) return;
      if (s._beacon) s._beacon.material.emissiveIntensity = 1.4 + Math.sin(now * 3.4) * 1.1;
      if (s._fans) s._fans.forEach((f, i) => { f.rotation.y += dt * (2.4 + i * .4); });
      if (s._water) s._water.material.emissiveIntensity = .3 + Math.sin(now * 1.6) * .08;
      if (s._jet) s._jet.scale.y = 1 + Math.sin(now * 2.2) * .12;
      if (s._flag) s._flag.rotation.y = Math.sin(now * 1.8) * .18;
      const local = Math.max(0, Math.min(1, (dark - (s._lit || 0) * .55) / .45));
      if (s._win) s._win.forEach(m => { m.emissiveIntensity = pw ? local * 2.0 : local * .12; });
      if (s._sign) s._sign.forEach(m => { m.emissiveIntensity = pw ? local * 2.6 : 0; });
      if (s._edge) s._edge.forEach(m => { m.emissiveIntensity = pw ? local * 3.2 : 0; });
      if (s._lamp) s._lamp.forEach(m => { m.emissiveIntensity = pw ? local * 2.8 : local * .3; });
      if (s._neon) s._neon.forEach(m => { m.emissiveIntensity = pw ? local * 3.4 + Math.sin(now * 7) * .2 : 0; });
    });
    bgMat.emissiveIntensity = dark * 1.3;
    M.clock.emissiveIntensity = dark * 1.6;
    T.lamps.forEach(l => { if (l.m) { l.m.emissiveIntensity = dark * 3.2; l.pool.material.opacity = dark * .3; } });
    cTex.offset.x += dt * .004; cTex.offset.y += dt * .0022;
    clouds.material.opacity = .10 + (1 - dark) * .3;

    if (state.running) {
      T.cars.forEach(c => {
        c.t += c.sp * dt;
        const p = onPath(c.P, c.t);
        c.g.position.set(p[0], ROADY, p[1]);
        c.g.rotation.y = p[2] + (c.dir < 0 ? Math.PI : 0);
        c.hm.emissiveIntensity = dark * 3.4; c.tm.emissiveIntensity = dark * 2.2;
        c.pool.material.opacity = dark * .26;
      });
      T.peds.forEach(p2 => {
        p2.t += p2.sp * dt;
        const q = onPath(p2.P, p2.t);
        p2.g.position.set(q[0], WALKY, q[1]); p2.g.rotation.y = q[2];
        p2.g.children[0].position.y = .45 + Math.abs(Math.sin(now * 5 + p2.o)) * .05;
      });
    }
    T.trees.forEach(t => { t.g.rotation.z = Math.sin(now * .9 + t.o) * .026; });

    if (booted) opts.onClock?.(dayT);
    post.render(scene, cameraObj);
  }

  const api = {
    /* 状態を絵にする。どの区画が買えるか・値段はReact側の判断を受け取るだけ */
    setState(next) {
      state = { ...state, ...next };
      Object.values(T.lots).forEach(L => {
        const has = state.land.has(L.p.key);
        const isBuilt = L.p.kind === "hall" || (L.p.kind === "park" && has) || (L.p.task && state.built.has(L.p.task));
        L.target = isBuilt ? 1 : 0;
        L.pad.material = has ? M.padPave : M.padGrass;
        L.pad.position.y = has ? (PADY + WALKY) / 2 : ROADY + (PADY - WALKY) / 2 + .02;
        L.walk.visible = has; L.kit.visible = has;
        const tag = state.labels?.[L.p.key];
        L.frame.visible = !!tag;
        L.label.visible = !!tag;
        if (tag) {
          L.frame.children.forEach(m => m.material.color.setHex(tag.bad ? 0xE8735F : 0xF5C451));
          setLabel(L.label, tag.top, tag.bottom, tag.color || "rgba(245,196,81,.96)");
        }
        if (L.def && state.skin) applySkin(L.def, state.skin[L.p.task] ?? 0);
      });
      if (M.asphalt.map) M.asphalt.map.dispose();
      M.asphalt.map = roadTex(); M.asphalt.needsUpdate = true;

      const pw = !!opts.isPowered?.(state);
      T.lamps.forEach(l => { l.g.visible = state.land.has(l.near) && (l.sig ? true : pw); });
      T.poles.forEach(p => { p.g.visible = pw && state.land.has(p.near); });
      while (wireGroup.children.length) { const w = wireGroup.children.pop(); w.geometry.dispose(); }
      if (pw) {
        const on = T.poles.filter(p => p.g.visible);
        on.forEach(p => on.forEach(q => {
          if (q === p) return;
          const d = Math.hypot(p.x - q.x, p.z - q.z);
          if (d > LOT * 1.05 || (p.col > q.col || (p.col === q.col && p.row >= q.row))) return;
          wireGroup.add(wireBetween(M, p, q, ROADY + 7.6, 1.0));
          wireGroup.add(wireBetween(M, p, q, ROADY + 6.9, 1.2));
        }));
      }
      T.cars.forEach(c => { c.g.visible = !!state.running; });
      T.peds.forEach(p => { p.g.visible = !!state.running; });
      HOMECAM.rad = Math.min(132, 66 + state.land.size * 4.0);
      if (!selected) camT.rad = HOMECAM.rad;
    },
    snapBuilt() { Object.values(T.lots).forEach(L => { L.t = L.target; }); },
    focus(key) {
      if (!key || !T.lots[key]) {
        selected = null;
        camT.look.copy(HOMECAM.look); camT.rad = HOMECAM.rad; camT.ph = HOMECAM.ph; camT.th = cam.th;
        return;
      }
      const L = T.lots[key];
      selected = key;
      camT.look.set(px(L.p.gx), 5, pz(L.p.gy));
      camT.rad = 48; camT.ph = 1.00;
      camT.th = nearAngle(Math.atan2(px(L.p.gx), pz(L.p.gy)) + 0.55, cam.th);
    },
    zoom(d) { camT.rad = Math.max(30, Math.min(190, camT.rad + d)); },
    setDay(t, isAuto) { dayT = t; auto = !!isAuto; },
    resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      const dpr = renderer.getPixelRatio();
      post.setSize(Math.floor(w * dpr), Math.floor(h * dpr));
      cameraObj.aspect = w / h; cameraObj.updateProjectionMatrix();
    },
    start() {
      // 生成時はまだcanvasに大きさが無いことがある。描き始める前にもう一度合わせる
      api.resize();
      if (!raf) { clock.getDelta(); raf = requestAnimationFrame(loop); booted = true; }
    },
    stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    dispose() {
      disposed = true; api.stop();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => canvas.removeEventListener(ev, onUp));
      post.dispose();
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach(m => { Object.values(m).forEach(v => v?.isTexture && v.dispose()); m.dispose(); });
      });
      renderer.dispose();
    },
  };
  api.resize();
  return api;
}

export { SKINS };
