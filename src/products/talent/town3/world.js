import * as THREE from "three";
import { GENRES, CATALOG, itemById, genreById } from "./catalog.js";

/* 成長の街の3D。
 *
 * **画面の文字まわりはここに持たない。** 区画の見た目と当たり判定だけを受け持ち、
 * 数値と選択状態は opts のコールバックで外へ渡す。カタログや数値の表示はReact側が描く。
 * こうしておくと、街の見た目を触るときにReactを、画面を触るときに3Dを読まずに済む。
 *
 * **three は呼び出し側が動的importで読む。** 街を開いた人だけが読み込むようにして、
 * 研修画面ぜんたいのバンドルを太らせない（旧townWorldと同じ方針）。 */

export function createTown(canvasEl, host, opts) {
  opts = opts || {};


  /* ============================================================
     0. 色
     ------------------------------------------------------------
     淡い昼の色で統一する。屋根だけ彩度を上げて、街の表情を作る。
     ============================================================ */

  var C = {
    grass: 0x8CC65C, grassDark: 0x6BA548,
    soil: 0xC9A273, soilDark: 0xAD8355,
    waste: 0x9C9179, wasteDark: 0x7E7460, rock: 0x928B7D, dead: 0x82714F,
    pave: 0xDFD2B8, paveDark: 0xC0B296,
    street: 0xC4B9A2, streetEdge: 0xA99E86, line: 0xEFE9DA,
    asphalt: 0x968F86, asphaltDark: 0x6E6862, ballast: 0x736A5B,
    sand: 0xE6D2A4,
    wall: [0xF6E9D6, 0xEBD7BC, 0xE2CDAE, 0xF2E2CC],
    roof: [0xEF7F63, 0x5CBCC4, 0xF2BE4C, 0x8A7ED6, 0xE8737E, 0x6BA9E0],
    tree: 0x66B062, treeDark: 0x4A8D50, trunk: 0x8E6748,
    glass: 0xBDE0EF, metal: 0xC8D1D9, steel: 0x9AA6B2, dark: 0x53606E,
    water: 0x4FB3DA, flower: [0xF48FB1, 0xFFD54F, 0xB388FF, 0xFF8A65, 0x80DEEA],
  };

  var PLOT = 8.0, TILE = 6.4, START_EXT = 2, MAX_EXT = 5;

  /* ============================================================
     1. 形を作る道具
     ------------------------------------------------------------
     角を丸めた箱をひとつ作れば、家も塀もベンチもだいたい作れる。
     同じ寸法は使い回す（毎回作ると一気に重くなる）。
     ============================================================ */

  var geoCache = {};
  function q(v) { return Math.round(v * 10) / 10; }

  function box(w, h, d, r) {
    w = Math.max(0.1, q(w)); h = Math.max(0.1, q(h)); d = Math.max(0.1, q(d)); r = q(r === undefined ? 0.16 : r);
    var k = "b" + w + "_" + h + "_" + d + "_" + r;
    if (geoCache[k]) return geoCache[k];
    var bs = Math.max(0.02, Math.min(r, w / 2 - 0.04, d / 2 - 0.04, h / 2 * 0.85));
    var sw = w / 2, sd = d / 2;
    var cr = Math.max(0.02, Math.min(r, sw - 0.02, sd - 0.02));
    var sh = new THREE.Shape();
    sh.moveTo(-sw + cr, -sd);
    sh.lineTo(sw - cr, -sd);
    sh.quadraticCurveTo(sw, -sd, sw, -sd + cr);
    sh.lineTo(sw, sd - cr);
    sh.quadraticCurveTo(sw, sd, sw - cr, sd);
    sh.lineTo(-sw + cr, sd);
    sh.quadraticCurveTo(-sw, sd, -sw, sd - cr);
    sh.lineTo(-sw, -sd + cr);
    sh.quadraticCurveTo(-sw, -sd, -sw + cr, -sd);
    var g = new THREE.ExtrudeGeometry(sh, {
      depth: Math.max(0.02, h - bs * 2), bevelEnabled: true, bevelThickness: bs, bevelSize: bs,
      bevelOffset: 0, bevelSegments: 2, curveSegments: 2, steps: 1,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, bs, 0);
    g.computeVertexNormals();
    geoCache[k] = g;
    return g;
  }
  function cone(r, h, seg) {
    var k = "c" + q(r) + "_" + q(h) + "_" + (seg || 4);
    if (!geoCache[k]) { var g = new THREE.ConeGeometry(q(r), q(h), seg || 4); g.translate(0, q(h) / 2, 0); geoCache[k] = g; }
    return geoCache[k];
  }
  function cyl(rt, rb, h, seg, theta) {
    var k = "y" + q(rt) + "_" + q(rb) + "_" + q(h) + "_" + (seg || 10) + "_" + q(theta || 0);
    if (!geoCache[k]) {
      var g = theta ? new THREE.CylinderGeometry(q(rt), q(rb), q(h), seg || 10, 1, false, 0, theta)
                    : new THREE.CylinderGeometry(q(rt), q(rb), q(h), seg || 10);
      g.translate(0, q(h) / 2, 0); geoCache[k] = g;
    }
    return geoCache[k];
  }
  function blob(r) {
    var k = "i" + q(r);
    if (!geoCache[k]) geoCache[k] = new THREE.IcosahedronGeometry(q(r), 0);
    return geoCache[k];
  }

  var _e = new THREE.Euler(), _qt = new THREE.Quaternion(), _p = new THREE.Vector3(), _sc = new THREE.Vector3(), _mm = new THREE.Matrix4();
  function M(x, y, z, ry) {
    _e.set(0, ry || 0, 0); _qt.setFromEuler(_e); _p.set(x, y, z); _sc.set(1, 1, 1);
    return _mm.compose(_p, _qt, _sc);
  }
  function MR(x, y, z, rx, ry, rz, s) {
    _e.set(rx || 0, ry || 0, rz || 0); _qt.setFromEuler(_e); _p.set(x, y, z);
    var k = s === undefined ? 1 : s; _sc.set(k, k, k);
    return _mm.compose(_p, _qt, _sc);
  }

  var _col = new THREE.Color(), _nm = new THREE.Matrix3(), _vv = new THREE.Vector3();
  function Builder() { this.pos = []; this.nor = []; this.col = []; this.idx = []; this.cur = new THREE.Matrix4(); this.stack = []; }
  Builder.prototype.push = function (m) { this.stack.push(this.cur); this.cur = new THREE.Matrix4().multiplyMatrices(this.cur, m); };
  Builder.prototype.pop = function () { this.cur = this.stack.pop(); };
  Builder.prototype.add = function (geo, m, hex) {
    var wm = m ? new THREE.Matrix4().multiplyMatrices(this.cur, m) : this.cur;
    _nm.getNormalMatrix(wm);
    _col.setHex(hex);
    var p = geo.attributes.position, n = geo.attributes.normal, base = this.pos.length / 3, i;
    for (i = 0; i < p.count; i++) {
      _vv.fromBufferAttribute(p, i).applyMatrix4(wm);
      this.pos.push(_vv.x, _vv.y, _vv.z);
      // 低いところほど暗くする。足もとが締まって、置いてある感じが出る
      var k = 0.84 + 0.16 * Math.min(1, Math.max(0, (_vv.y + 0.4) / 2.4));
      var hn = Math.sin(Math.floor(_vv.x * 1.6) * 12.9898 + Math.floor(_vv.y * 1.6) * 4.1414 + Math.floor(_vv.z * 1.6) * 78.233) * 43758.5453;
      k *= 1 + ((hn - Math.floor(hn)) - 0.5) * 0.075;
      this.col.push(_col.r * k, _col.g * k, _col.b * k);
      _vv.fromBufferAttribute(n, i).applyMatrix3(_nm).normalize();
      this.nor.push(_vv.x, _vv.y, _vv.z);
    }
    if (geo.index) { var a = geo.index.array; for (i = 0; i < a.length; i++) this.idx.push(base + a[i]); }
    else { for (i = 0; i < p.count; i++) this.idx.push(base + i); }
  };
  Builder.prototype.mesh = function (material, shadow) {
    if (!this.pos.length) return null;
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    var m = new THREE.Mesh(g, material);
    m.castShadow = !!shadow; m.receiveShadow = !!shadow;
    return m;
  };

  // 区画ひとつぶんの下書き。窓だけは別の素材（夕方に光らせたい）
  function Ctx() { this.b = new Builder(); this.w = new Builder(); }
  Ctx.prototype.push = function (m) { this.b.push(m); this.w.push(m); };
  Ctx.prototype.pop = function () { this.b.pop(); this.w.pop(); };
  Ctx.prototype.add = function (g, m, hex) { this.b.add(g, m, hex); };
  Ctx.prototype.lit = function (g, m, hex) { this.w.add(g, m, hex); };

  function rngFrom(seed) {
    return function () {
      seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }
  function shuffle(a, rnd) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ============================================================
     2. 区画の中身
     ------------------------------------------------------------
     学んだジャンルごとに、置かれるものが変わる。
     同じジャンルでも区画ごとに種を変えるので、並びと色がずれる。
     ============================================================ */

  var HALF = TILE / 2, GAP = PLOT - TILE;

  var DIRS = [[0, -1, "n"], [1, 0, "e"], [0, 1, "s"], [-1, 0, "w"]];
  // 同じ種類どうしだけつながる。駅は線路につながる
  function connKind(item) {
    if (item === "road") return "road";
    if (item === "rail" || item === "station") return "rail";
    return null;
  }

  // 駅の線路がどちらを向いているか（0 = 東西 / 1 = 南北）
  function stationAxis(info) {
    if (info.manual) return info.rot % 2;
    if (info.cnt === 0) return info.rot % 2;
    return ((info.nb.n || info.nb.s) && !(info.nb.e || info.nb.w)) ? 1 : 0;
  }
  function stationAxisOf(q) {
    if (q.manual) return q.rot % 2;
    var ns = 0, ew = 0;
    for (var i = 0; i < DIRS.length; i++) {
      var t = plots[pkey(q.i + DIRS[i][0], q.j + DIRS[i][1])];
      if (!t || connKind(t.item) !== "rail") continue;
      if (i % 2 === 0) ns = 1; else ew = 1;
    }
    if (!ns && !ew) return q.rot % 2;
    return (ns && !ew) ? 1 : 0;
  }
  // その区画が、この向きに口を開けているか
  function opensToward(q, dirIdx) {
    if (q.item === "road") return true;
    if (q.item === "rail") return q.manual ? (dirIdx % 2) === (q.rot % 2) : true;
    if (q.item === "station") return (dirIdx % 2) === (stationAxisOf(q) === 0 ? 1 : 0);
    return true;
  }


  // 区画の高さ。土台をそのぶん下へ伸ばすので、側面がそのまま擁壁になる
  var STEP = 1.1;
  var curInfo = null;

  function tileTop(ctx, top, side) {
    var drop = Math.max(0, (curInfo && curInfo.level || 0) * STEP);
    ctx.add(box(TILE, 1.0 + drop, TILE, 0.5), M(0, -1.3 - drop, 0, 0), side);
    ctx.add(box(TILE - 0.22, 0.34, TILE - 0.22, 0.45), M(0, -0.34, 0, 0), top);
    if (drop > 0) ctx.add(box(TILE + 0.16, 0.22, TILE + 0.16, 0.5), M(0, -0.52, 0, 0), side);  // 天端の笠木
    addFill(ctx, top, side);
    addSteps(ctx);
  }

  // 同じ高さのとなりとは地面をつなげる。段差のときだけ壁が残る
  function addFill(ctx, top, side) {
    var info = curInfo;
    if (!info || !info.nlv) return;
    var lv = info.level || 0;
    if (lv === 0) return;                       // 平地のあいだは道のまま
    var drop = Math.max(0, lv * STEP), half = GAP / 2 + 0.07;
    for (var i = 0; i < 4; i++) {
      if (info.nlv[i] !== lv) continue;
      if (info.isRoad && info.nroad[i]) continue;  // 道路は路面が先につないでいる
      ctx.push(M(0, 0, 0, faceDir(i)));
      ctx.add(box(TILE, 1.0 + drop, half, 0.02), M(0, -1.3 - drop, -(HALF + half / 2 - 0.04), 0), side);
      ctx.add(box(TILE - 0.22, 0.34, half + 0.1, 0.02), M(0, -0.34, -(HALF + half / 2 - 0.04), 0), top);
      ctx.pop();
    }
    // 四つ角：まわりの三区画が同じ高さなら角も埋める
    for (var c = 0; c < 4; c++) {
      var a = c, b2 = (c + 1) % 4;
      if (info.nlv[a] !== lv || info.nlv[b2] !== lv || info.dlv[c] !== lv) continue;
      var cx = (DIRS[a][0] + DIRS[b2][0]) * (HALF + GAP / 4);
      var cz = (DIRS[a][1] + DIRS[b2][1]) * (HALF + GAP / 4);
      ctx.add(box(GAP / 2 + 0.14, 1.0 + drop, GAP / 2 + 0.14, 0.02), M(cx, -1.3 - drop, cz, 0), side);
      ctx.add(box(GAP / 2 + 0.14, 0.34, GAP / 2 + 0.14, 0.02), M(cx, -0.34, cz, 0), top);
    }
  }

  // 一段だけ下がっているとなりへ、階段（道路どうしなら坂道）を架ける
  function addSteps(ctx) {
    var info = curInfo;
    if (!info || !info.nlv) return;
    for (var i = 0; i < 4; i++) {
      var nl = info.nlv[i];
      if (nl === null || info.level - nl !== 1) continue;
      ctx.push(M(0, 0, 0, faceDir(i)));
      if (info.isRoad && info.nroad[i]) {
        var run = GAP + 1.4;
        ctx.add(box(TILE - 1.4, 0.34, run, 0.1),
          MR(0, -STEP * 0.52, -(HALF - 0.5 + run / 2), -Math.atan(STEP / run), 0, 0), C.asphalt);
        for (var m = 0; m < 2; m++) {
          ctx.add(box(0.14, 0.4, run, 0.05),
            MR(m ? 1.9 : -1.9, -STEP * 0.52, -(HALF - 0.5 + run / 2), -Math.atan(STEP / run), 0, 0), C.paveDark);
        }
      } else {
        var n = 4, span = GAP + 0.9;
        for (var k = 0; k < n; k++) {
          var t = (k + 0.5) / n;
          ctx.add(box(2.3, 0.34, span / n + 0.1, 0.05),
            M(0, -0.18 - STEP * t, -(HALF - 0.35 + span * t), 0), C.wall[2]);
        }
        for (var r2 = 0; r2 < 2; r2++) {
          ctx.add(box(0.11, 0.42, span - 0.1, 0.04),
            MR(r2 ? 1.22 : -1.22, -0.26 - STEP * 0.5, -(HALF - 0.3 + span / 2), -Math.atan(STEP / span), 0, 0), C.steel);
        }
      }
      ctx.pop();
    }
  }

  // 掘り下げた区画は水になる
  function bCanal(ctx, rnd) {
    var drop = 0;
    ctx.add(box(TILE, 1.0 + drop, TILE, 0.5), M(0, -1.3, 0, 0), C.soilDark);
    ctx.add(box(TILE - 0.22, 0.3, TILE - 0.22, 0.45), M(0, -0.3, 0, 0), 0x5FB8D8);
    addFill(ctx, 0x5FB8D8, C.soilDark);
    for (var i = 0; i < 4; i++) {
      if (curInfo && curInfo.nlv && curInfo.nlv[i] === curInfo.level) continue;  // つながっている側に岸は作らない
      ctx.push(M(0, 0, 0, faceDir(i)));
      ctx.add(box(TILE, 0.3, 0.5, 0.12), M(0, -0.28, -(HALF - 0.2), 0), C.sand);
      ctx.pop();
    }
    for (var r = 0; r < 7; r++) {
      var a = rnd() * Math.PI * 2, rr = HALF - 0.5 - rnd() * 0.6;
      ctx.add(cyl(0.05, 0.07, 0.6 + rnd() * 0.5, 4), MR(Math.cos(a) * rr, 0.02, Math.sin(a) * rr, (rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3), C.treeDark);
    }
    if (rnd() < 0.7) {
      ctx.add(cyl(0.5, 0.5, 0.12, 12), M((rnd() - 0.5) * 2, 0.02, (rnd() - 0.5) * 2, 0), C.tree);
      ctx.add(blob(0.18), M(0.2, 0.1, 0.2, 0), pick(C.flower, rnd));
    }
  }


  function fence(ctx, hex, inset) {
    var t = HALF - (inset || 0.35);
    for (var s = 0; s < 4; s++) {
      var a = s * Math.PI / 2;
      ctx.add(box(TILE - 0.9, 0.34, 0.24, 0.1), MR(Math.sin(a) * t, 0, Math.cos(a) * t, 0, a, 0), hex);
    }
  }
  function tree(ctx, rnd, x, z, s) {
    s = s || 1;
    ctx.add(cyl(0.14 * s, 0.19 * s, 0.75 * s, 6), M(x, 0, z, 0), C.trunk);
    var n = 2 + (rnd() < 0.6 ? 1 : 0);
    for (var i = 0; i < n; i++) {
      var rr = (0.66 - i * 0.14) * s;
      ctx.add(blob(rr), MR(x + (rnd() - 0.5) * 0.25 * s, (0.8 + i * 0.44) * s, z + (rnd() - 0.5) * 0.25 * s,
        rnd() * 0.7, rnd() * 3, rnd() * 0.5), i === 0 ? C.treeDark : C.tree);
    }
  }
  function flowers(ctx, rnd, x, z, w, d) {
    ctx.add(box(w, 0.26, d, 0.1), M(x, 0, z, 0), C.soilDark);
    for (var i = 0; i < 6; i++) {
      ctx.add(blob(0.13), MR(x + (rnd() - 0.5) * (w - 0.3), 0.32, z + (rnd() - 0.5) * (d - 0.25), 0, rnd() * 3, 0), pick(C.flower, rnd));
    }
  }
  function house(ctx, rnd, x, z, ry, s) {
    var w = 2.0 * s, d = 1.9 * s, h = (1.5 + rnd() * 0.9) * s;
    ctx.push(M(x, 0, z, ry));
    ctx.add(box(w, h, d, 0.2), M(0, 0, 0, 0), pick(C.wall, rnd));
    var rh = 0.85 * s;
    ctx.add(cone(Math.max(w, d) * 0.76, rh, 4), MR(0, h, 0, 0, Math.PI / 4, 0), pick(C.roof, rnd));
    ctx.add(box(0.44 * s, 0.8 * s, 0.14, 0.06), M(0, 0, d / 2 + 0.02, 0), C.trunk);
    for (var i = 0; i < 2; i++) {
      ctx.lit(box(0.42 * s, 0.42 * s, 0.12, 0.08), M((i ? 0.62 : -0.62) * s, h * 0.5, d / 2 + 0.03, 0), C.glass);
      ctx.lit(box(0.12, 0.4 * s, 0.42 * s, 0.08), M((i ? 1 : -1) * (w / 2 + 0.02), h * 0.5, 0, 0), C.glass);
    }
    ctx.pop();
  }

  function tint(hex, rnd, amt) {
    var c = new THREE.Color(hex), k = 1 + (rnd() - 0.5) * (amt || 0.14);
    return new THREE.Color(Math.min(1, c.r * k), Math.min(1, c.g * k), Math.min(1, c.b * k)).getHex();
  }
  function car(ctx, rnd, x, z, ry, s) {
    s = s || 1;
    var body = pick([0xE8705F, 0x5DA9DE, 0xF2C14E, 0xF5F0E6, 0x6FBF8E, 0x9A8BD6], rnd);
    ctx.push(M(x, 0, z, ry));
    ctx.add(box(1.0 * s, 0.42 * s, 1.9 * s, 0.16), M(0, 0.18 * s, 0, 0), body);
    ctx.add(box(0.9 * s, 0.36 * s, 0.9 * s, 0.14), M(0, 0.58 * s, -0.1 * s, 0), body);
    ctx.lit(box(0.8 * s, 0.24 * s, 0.1, 0.05), M(0, 0.62 * s, 0.36 * s, 0), C.glass);
    for (var w = 0; w < 4; w++) {
      ctx.add(cyl(0.2 * s, 0.2 * s, 0.14 * s, 8), MR((w % 2 ? 0.5 : -0.5) * s, 0.2 * s, (w < 2 ? 0.6 : -0.6) * s, 0, 0, Math.PI / 2), C.dark);
    }
    ctx.pop();
  }
  function lamp(ctx, x, z) {
    ctx.add(cyl(0.08, 0.11, 2.2, 6), M(x, 0, z, 0), C.dark);
    ctx.lit(blob(0.24), M(x, 2.35, z, 0), 0xFFE9A8);
  }
  function parasol(ctx, rnd, x, z) {
    ctx.add(cyl(0.07, 0.07, 1.5, 6), M(x, 0, z, 0), C.metal);
    ctx.add(cone(1.0, 0.5, 8), M(x, 1.5, z, 0), pick(C.roof, rnd));
    ctx.add(cyl(0.45, 0.45, 0.1, 10), M(x, 0.7, z, 0), C.wall[0]);
    for (var k = 0; k < 2; k++) ctx.add(cyl(0.18, 0.18, 0.4, 8), M(x + (k ? 0.75 : -0.75), 0, z, 0), C.trunk);
  }
  function bench(ctx, x, z, ry) {
    ctx.add(box(1.1, 0.16, 0.42, 0.06), MR(x, 0.35, z, 0, ry, 0), C.trunk);
    ctx.add(box(1.1, 0.35, 0.12, 0.05), MR(x, 0.35, z, 0, ry, 0), C.trunk);
  }
  function edgeTrees(ctx, rnd, n, s) {
    for (var t = 0; t < n; t++) {
      var a = rnd() * Math.PI * 2, rr = HALF - 0.5 - rnd() * 0.5;
      tree(ctx, rnd, Math.cos(a) * rr, Math.sin(a) * rr, (s || 0.62) + rnd() * 0.4);
    }
  }

  /* ---- 住まい ---- */

  function bHouses(ctx, rnd) {
    tileTop(ctx, tint(C.grass, rnd), C.soil);
    ctx.add(box(1.15, 0.12, TILE - 0.6, 0.28), M(0, -0.04, 0, 0), C.pave);
    ctx.add(box(TILE - 0.6, 0.12, 1.15, 0.28), M(0, -0.04, -1.2, 0), C.pave);
    var spots = shuffle([[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.7], [1.7, 1.7]], rnd);
    var n = 2 + (rnd() < 0.6 ? 1 : 0);
    for (var i = 0; i < n; i++) {
      house(ctx, rnd, spots[i][0] + (rnd() - 0.5) * 0.4, spots[i][1] + (rnd() - 0.5) * 0.4,
        Math.floor(rnd() * 4) * Math.PI / 2, 0.74 + rnd() * 0.24);
    }
    edgeTrees(ctx, rnd, 5);
    flowers(ctx, rnd, (rnd() - 0.5) * 3, HALF - 0.9, 1.6, 0.6);
    flowers(ctx, rnd, HALF - 0.9, (rnd() - 0.5) * 2.4, 0.6, 1.4);
    fence(ctx, C.grassDark, 0.28);
  }

  function bApart(ctx, rnd) {
    tileTop(ctx, tint(C.grass, rnd), C.soil);
    ctx.add(box(TILE - 1.0, 0.12, 2.0, 0.25), M(0, -0.04, HALF - 1.4, 0), C.pave);
    var fl = 4 + Math.floor(rnd() * 2), fh = 0.8, w = 4.4, d = 2.3;
    var bal = pick(C.roof, rnd);
    ctx.push(M((rnd() - 0.5) * 0.6, 0, -1.1, 0));
    ctx.add(box(w, fl * fh, d, 0.22), M(0, 0, 0, 0), pick(C.wall, rnd));
    for (var f = 0; f < fl; f++) {
      ctx.add(box(w + 0.3, 0.13, 0.46, 0.05), M(0, 0.46 + f * fh, d / 2 + 0.14, 0), bal);
      for (var k = 0; k < 3; k++) ctx.lit(box(0.78, 0.44, 0.1, 0.06), M(-1.4 + k * 1.4, 0.52 + f * fh, d / 2 + 0.03, 0), C.glass);
      ctx.lit(box(0.1, 0.44, 1.5, 0.06), M(w / 2 + 0.03, 0.52 + f * fh, 0, 0), C.glass);
    }
    ctx.add(box(w + 0.35, 0.2, d + 0.35, 0.1), M(0, fl * fh, 0, 0), bal);
    ctx.add(box(0.9, 0.95, 0.14, 0.06), M(0, 0, d / 2 + 0.02, 0), C.trunk);
    ctx.pop();
    var nc = 2 + Math.floor(rnd() * 3);
    for (var c = 0; c < nc; c++) car(ctx, rnd, -2.2 + c * 1.4, HALF - 1.4, 0, 0.85);
    edgeTrees(ctx, rnd, 3, 0.7);
    flowers(ctx, rnd, -HALF + 1.0, 0.6, 0.6, 1.8);
    fence(ctx, C.grassDark, 0.28);
  }

  function bPark(ctx, rnd) {
    tileTop(ctx, tint(C.grass, rnd, 0.1), C.soil);
    ctx.add(cyl(1.5, 1.5, 0.14, 20), M((rnd() - 0.5) * 1.4, -0.16, 0.6, 0), C.water);
    ctx.add(box(TILE - 1.0, 0.1, 0.9, 0.3), MR(0, -0.06, -1.6, 0, (rnd() - 0.5) * 0.4, 0), C.pave);
    for (var t = 0; t < 9; t++) {
      var a = rnd() * Math.PI * 2, rr = 1.6 + rnd() * (HALF - 2.0);
      tree(ctx, rnd, Math.cos(a) * rr, Math.sin(a) * rr, 0.75 + rnd() * 0.55);
    }
    bench(ctx, -1.8, -0.9, 0.4); bench(ctx, 1.9, -1.2, -0.6);
    lamp(ctx, HALF - 1.2, HALF - 1.2);
    flowers(ctx, rnd, -HALF + 1.2, HALF - 1.1, 1.6, 0.6);
    flowers(ctx, rnd, HALF - 1.2, -HALF + 1.2, 0.6, 1.6);
    ctx.push(M(-2.0, 0, 2.0, rnd() * 0.6));
    for (var l = 0; l < 4; l++) ctx.add(cyl(0.1, 0.1, 1.3, 6), M((l % 2 ? 0.6 : -0.6), 0, (l < 2 ? 0.6 : -0.6), 0), C.wall[0]);
    ctx.add(cone(1.3, 0.7, 6), M(0, 1.3, 0, 0), pick(C.roof, rnd));
    ctx.pop();
  }

  /* ---- にぎわい ---- */

  function bShops(ctx, rnd) {
    tileTop(ctx, C.pave, C.paveDark);
    ctx.add(box(TILE - 0.4, 0.12, 1.9, 0.2), M(0, -0.04, 0, 0), C.paveDark);
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 0; i < 3; i++) {
        var x = -2.0 + i * 2.0, z = side * 2.0, h = 1.5 + rnd() * 0.8;
        var aw = pick(C.roof, rnd);
        ctx.push(M(x + (rnd() - 0.5) * 0.2, 0, z, side > 0 ? Math.PI : 0));
        ctx.add(box(1.8, h, 1.5, 0.18), M(0, 0, 0, 0), pick(C.wall, rnd));
        ctx.add(box(2.0, 0.16, 1.7, 0.1), M(0, h, 0, 0), aw);
        ctx.add(box(1.7, 0.12, 0.66, 0.06), MR(0, h * 0.6, -1.05, 0.26, 0, 0), aw);
        ctx.lit(box(1.2, 0.5, 0.1, 0.06), M(0, h * 0.34, -0.78, 0), C.glass);
        ctx.add(box(0.85, 0.28, 0.1, 0.05), M(0, h * 0.84, -0.78, 0), pick(C.roof, rnd));
        ctx.pop();
      }
    }
    lamp(ctx, -2.6, 0); lamp(ctx, 2.6, 0);
  }

  function bPlaza(ctx, rnd) {
    tileTop(ctx, C.pave, C.paveDark);
    ctx.add(cyl(2.1, 2.1, 0.16, 22), M(0, -0.18, 0, 0), C.paveDark);
    ctx.add(cyl(1.15, 1.25, 0.42, 16), M(0, 0, 0, 0), C.wall[1]);
    ctx.add(cyl(1.02, 1.02, 0.12, 16), M(0, 0.36, 0, 0), C.water);
    ctx.add(cyl(0.16, 0.22, 0.85, 8), M(0, 0.4, 0, 0), C.wall[0]);
    ctx.add(blob(0.3), M(0, 1.3, 0, 0), C.water);
    for (var b = 0; b < 4; b++) {
      var a = b * 1.57 + rnd() * 0.4;
      bench(ctx, Math.cos(a) * 2.7, Math.sin(a) * 2.7, -a);
    }
    lamp(ctx, -HALF + 1.1, -HALF + 1.1); lamp(ctx, HALF - 1.1, HALF - 1.1);
    flowers(ctx, rnd, HALF - 1.1, -HALF + 1.4, 0.7, 1.8);
    flowers(ctx, rnd, -HALF + 1.1, HALF - 1.4, 0.7, 1.8);
    edgeTrees(ctx, rnd, 3, 0.8);
  }

  function bCafe(ctx, rnd) {
    tileTop(ctx, C.pave, C.paveDark);
    ctx.add(box(TILE - 0.8, 0.12, 3.4, 0.28), M(0, -0.04, 1.0, 0), C.paveDark);
    var h = 1.9 + rnd() * 0.5, aw = pick(C.roof, rnd);
    ctx.push(M(0, 0, -1.9, 0));
    ctx.add(box(5.0, h, 2.0, 0.2), M(0, 0, 0, 0), pick(C.wall, rnd));
    ctx.add(box(5.3, 0.18, 2.3, 0.1), M(0, h, 0, 0), aw);
    ctx.add(box(4.8, 0.12, 0.9, 0.06), MR(0, h * 0.62, 1.4, -0.3, 0, 0), aw);
    for (var k = 0; k < 3; k++) ctx.lit(box(1.1, 0.7, 0.1, 0.08), M(-1.6 + k * 1.6, h * 0.36, 1.03, 0), C.glass);
    ctx.add(box(1.4, 0.3, 0.1, 0.05), M(0, h * 0.86, 1.03, 0), C.wall[0]);
    ctx.pop();
    parasol(ctx, rnd, -1.9, 1.2);
    parasol(ctx, rnd, 0.6, 1.9);
    if (rnd() < 0.6) parasol(ctx, rnd, 2.6, 1.0);
    lamp(ctx, -HALF + 1.0, HALF - 1.0);
    flowers(ctx, rnd, HALF - 1.0, HALF - 1.4, 0.7, 1.6);
    edgeTrees(ctx, rnd, 2, 0.7);
  }

  /* ---- インフラ ---- */

  function bPower(ctx, rnd) {
    tileTop(ctx, C.pave, C.paveDark);
    ctx.push(M(-1.5 + rnd() * 0.4, 0, 1.5, (rnd() - 0.5) * 0.5));
    ctx.add(box(2.4, 1.3, 1.8, 0.18), M(0, 0, 0, 0), C.metal);
    ctx.add(box(2.6, 0.18, 2.0, 0.1), M(0, 1.3, 0, 0), C.steel);
    for (var v = 0; v < 3; v++) ctx.add(box(0.5, 0.7, 0.1, 0.05), M(-0.7 + v * 0.7, 0.3, 0.92, 0), C.dark);
    ctx.pop();
    for (var p = 0; p < 2; p++) {
      ctx.push(M(-2.0 + p * 4.0, 0, -1.9 + (rnd() - 0.5) * 0.6, 0));
      ctx.add(cyl(0.16, 0.3, 3.6 + rnd() * 0.8, 6), M(0, 0, 0, 0), C.steel);
      for (var arm = 0; arm < 2; arm++) {
        var ay = 2.4 + arm * 0.85;
        ctx.add(box(2.1, 0.14, 0.16, 0.06), M(0, ay, 0, 0), C.steel);
        ctx.add(blob(0.11), M(-1.0, ay + 0.1, 0, 0), C.dark);
        ctx.add(blob(0.11), M(1.0, ay + 0.1, 0, 0), C.dark);
      }
      ctx.pop();
    }
    for (var sp = 0; sp < 4; sp++) {
      ctx.add(box(1.4, 0.12, 0.85, 0.05), MR(-2.2 + sp * 1.5, 0.52, 0.1 + (rnd() - 0.5) * 0.3, -0.42, 0, 0), 0x3F5E86);
      ctx.add(box(0.1, 0.52, 0.1, 0.04), M(-2.2 + sp * 1.5, 0, 0.2, 0), C.steel);
    }
    fence(ctx, C.steel, 0.3);
  }

  function bWater(ctx, rnd) {
    tileTop(ctx, C.pave, C.paveDark);
    ctx.push(M(-1.4, 0, -1.2, 0));
    for (var l = 0; l < 4; l++) ctx.add(cyl(0.11, 0.11, 1.8, 5), M(Math.cos(l * 1.57) * 0.62, 0, Math.sin(l * 1.57) * 0.62, 0), C.steel);
    ctx.add(cyl(1.05, 1.05, 1.15, 14), M(0, 1.8, 0, 0), C.wall[0]);
    ctx.add(cyl(0.65, 1.05, 0.5, 14), M(0, 2.95, 0, 0), pick(C.roof, rnd));
    ctx.pop();
    for (var t = 0; t < 2; t++) {
      ctx.add(cyl(0.95, 0.95, 1.0, 14), M(1.4 + t * 0.2, 0, 0.6 + t * 2.0, 0), C.metal);
      ctx.add(cyl(0.98, 0.98, 0.12, 14), M(1.4 + t * 0.2, 1.0, 0.6 + t * 2.0, 0), C.steel);
    }
    ctx.add(cyl(0.26, 0.26, 4.4, 8), MR(-1.0, 0.45, 1.9, 0, 0, Math.PI / 2), C.steel);
    ctx.add(box(1.9, 1.0, 1.5, 0.16), M(-2.0, 0, 2.1, 0), C.wall[2]);
    ctx.add(box(2.1, 0.16, 1.7, 0.08), M(-2.0, 1.0, 2.1, 0), pick(C.roof, rnd));
    fence(ctx, C.steel, 0.3);
  }

  /* ---- ものづくり ---- */

  function bOffice(ctx, rnd) {
    tileTop(ctx, C.pave, C.paveDark);
    var spots = shuffle([[-1.5, -1.3], [1.6, 1.4], [1.5, -1.4], [-1.6, 1.5]], rnd);
    for (var i = 0; i < 2; i++) {
      var floors = 3 + Math.floor(rnd() * 4), w = 2.2 + rnd() * 0.6, d = 2.0 + rnd() * 0.5, fh = 0.75;
      ctx.push(M(spots[i][0], 0, spots[i][1], Math.floor(rnd() * 4) * Math.PI / 2));
      ctx.add(box(w, floors * fh, d, 0.22), M(0, 0, 0, 0), pick(C.wall, rnd));
      for (var f = 0; f < floors; f++) {
        ctx.lit(box(w - 0.5, 0.4, 0.1, 0.06), M(0, 0.35 + f * fh, d / 2 + 0.03, 0), C.glass);
        ctx.lit(box(0.1, 0.4, d - 0.5, 0.06), M(w / 2 + 0.03, 0.35 + f * fh, 0, 0), C.glass);
      }
      ctx.add(box(w + 0.25, 0.18, d + 0.25, 0.1), M(0, floors * fh, 0, 0), pick(C.roof, rnd));
      ctx.add(box(0.7, 0.45, 0.7, 0.12), M(0.3, floors * fh + 0.18, -0.2, 0), C.steel);
      ctx.pop();
    }
    ctx.push(M(spots[2][0] * 0.95, 0, spots[2][1] * 0.95, rnd() * 0.5));
    ctx.add(box(2.4, 1.1, 1.7, 0.16), M(0, 0, 0, 0), C.metal);
    ctx.lit(box(2.0, 0.12, 0.08, 0.04), M(0, 0.55, 0.87, 0), 0x6FE3C6);
    ctx.pop();
    ctx.add(box(TILE - 1.6, 0.12, 1.0, 0.24), M(0, -0.04, 0, 0), C.paveDark);
    edgeTrees(ctx, rnd, 3, 0.65);
    fence(ctx, C.steel, 0.3);
  }

  function bFactory(ctx, rnd) {
    tileTop(ctx, C.pave, C.paveDark);
    ctx.push(M(0, 0, -0.9, 0));
    ctx.add(box(5.2, 1.7, 2.6, 0.16), M(0, 0, 0, 0), C.wall[2]);
    for (var sh = 0; sh < 3; sh++) {
      ctx.add(cyl(0.9, 0.9, 5.2, 12, Math.PI), MR(0, 1.7, -0.9 + sh * 0.9, 0, 0, -Math.PI / 2), C.metal);
    }
    for (var dr = 0; dr < 3; dr++) ctx.add(box(1.1, 1.1, 0.12, 0.06), M(-1.7 + dr * 1.7, 0, 1.33, 0), C.dark);
    ctx.pop();
    for (var ch = 0; ch < 2; ch++) {
      var cx = -2.2 + ch * 1.3;
      ctx.add(cyl(0.34, 0.42, 4.2 + ch * 0.6, 10), M(cx, 0, 1.6, 0), C.wall[1]);
      ctx.add(cyl(0.44, 0.44, 0.3, 10), M(cx, 3.6 + ch * 0.6, 1.6, 0), pick(C.roof, rnd));
      for (var pf = 0; pf < 3; pf++) {
        ctx.add(blob(0.45 + pf * 0.16), MR(cx + (rnd() - 0.5) * 0.5, 4.8 + ch * 0.6 + pf * 0.7, 1.6 + (rnd() - 0.5) * 0.5, rnd(), rnd() * 3, 0), 0xEDEDE6);
      }
    }
    for (var tk = 0; tk < 2; tk++) ctx.add(cyl(0.7, 0.7, 1.2, 12), M(1.5 + tk * 1.7, 0, 1.9, 0), C.steel);
    car(ctx, rnd, -0.2, 2.4, 0, 0.9);
    fence(ctx, C.steel, 0.3);
  }

  function bData(ctx, rnd) {
    tileTop(ctx, C.pave, C.paveDark);
    for (var b = 0; b < 2; b++) {
      ctx.push(M(0, 0, -1.7 + b * 2.4, 0));
      ctx.add(box(5.0, 1.25, 1.7, 0.16), M(0, 0, 0, 0), C.wall[3]);
      for (var v2 = 0; v2 < 5; v2++) ctx.add(cyl(0.24, 0.24, 0.45, 8), M(-1.8 + v2 * 0.9, 1.25, 0, 0), C.steel);
      ctx.lit(box(4.4, 0.1, 0.08, 0.03), M(0, 0.62, 0.87, 0), 0x6FE3C6);
      ctx.pop();
    }
    ctx.add(cyl(0.16, 0.2, 1.0, 6), M(-2.5, 0, 2.5, 0), C.steel);
    ctx.add(cyl(0.8, 0.22, 0.3, 12), MR(-2.5, 1.05, 2.5, -0.7, 0.6, 0), C.wall[0]);
    ctx.add(cyl(0.16, 0.2, 0.8, 6), M(2.4, 0, 2.6, 0), C.steel);
    ctx.add(cyl(0.6, 0.18, 0.26, 12), MR(2.4, 0.85, 2.6, -0.7, -0.5, 0), C.wall[0]);
    fence(ctx, C.steel, 0.3);
  }

  /* ---- 物流 ---- */

  function bWarehouse(ctx, rnd) {
    tileTop(ctx, C.pave, C.paveDark);
    ctx.add(box(TILE - 0.7, 0.12, 2.6, 0.2), M(0, -0.04, 1.3, 0), C.paveDark);
    ctx.push(M(0, 0, -1.3, 0));
    ctx.add(box(5.4, 1.5, 2.6, 0.16), M(0, 0, 0, 0), C.wall[0]);
    ctx.add(cyl(1.35, 1.35, 5.4, 14, Math.PI), MR(0, 1.5, 0, 0, 0, -Math.PI / 2), C.metal);
    for (var d = 0; d < 3; d++) ctx.add(box(1.1, 1.0, 0.12, 0.06), M(-1.7 + d * 1.7, 0, 1.33, 0), C.dark);
    ctx.lit(box(1.6, 0.22, 0.08, 0.04), M(0, 1.15, 1.35, 0), 0xFFD27A);
    ctx.pop();
    for (var t = 0; t < 2; t++) {
      ctx.push(M(-2.0 + t * 3.6 + (rnd() - 0.5) * 0.4, 0, 1.6, rnd() < 0.5 ? 0 : Math.PI));
      ctx.add(box(1.5, 1.0, 2.4, 0.14), M(0, 0.32, -0.3, 0), C.wall[3]);
      ctx.add(box(1.4, 0.9, 1.2, 0.16), M(0, 0.32, 1.4, 0), pick(C.roof, rnd));
      ctx.lit(box(1.0, 0.3, 0.1, 0.05), M(0, 0.85, 1.98, 0), C.glass);
      for (var wl = 0; wl < 4; wl++) ctx.add(cyl(0.3, 0.3, 0.2, 10), MR((wl % 2 ? 0.72 : -0.72), 0.32, (wl < 2 ? 1.1 : -0.9), 0, 0, Math.PI / 2), C.dark);
      ctx.pop();
    }
    for (var s2 = 0; s2 < 5; s2++) {
      ctx.add(box(0.7, 0.55, 0.7, 0.08), M(-2.6 + rnd() * 5.2, 0, 0.1 + rnd() * 0.7, rnd() * 0.6), pick([C.roof[2], C.trunk, C.metal], rnd));
    }
    fence(ctx, C.steel, 0.3);
  }

  function bHub(ctx, rnd) {
    tileTop(ctx, C.pave, C.paveDark);
    ctx.add(box(TILE - 0.5, 0.12, 3.0, 0.2), M(0, -0.04, 1.5, 0), C.paveDark);
    ctx.push(M(0, 0, -1.9, 0));
    ctx.add(box(5.6, 1.9, 2.0, 0.16), M(0, 0, 0, 0), C.wall[1]);
    ctx.add(box(5.9, 0.2, 2.3, 0.1), M(0, 1.9, 0, 0), pick(C.roof, rnd));
    for (var d = 0; d < 5; d++) ctx.add(box(0.8, 1.1, 0.12, 0.05), M(-2.0 + d * 1.0, 0, 1.03, 0), C.dark);
    ctx.lit(box(2.2, 0.24, 0.08, 0.04), M(0, 1.5, 1.05, 0), 0xFFD27A);
    ctx.pop();
    ctx.add(box(1.0, 0.24, 3.0, 0.1), M(HALF - 1.4, 1.5, 0.4, 0), C.metal);
    ctx.add(cyl(0.12, 0.12, 1.5, 6), M(HALF - 1.4, 0, 1.7, 0), C.steel);
    var nv = 4 + Math.floor(rnd() * 2);
    for (var v = 0; v < nv; v++) car(ctx, rnd, -2.4 + v * 1.3, 1.7 + (v % 2) * 1.2, 0, 0.8);
    for (var s3 = 0; s3 < 4; s3++) ctx.add(box(0.6, 0.5, 0.6, 0.07), M(-2.7 + rnd() * 0.8, 0, -0.2 + rnd() * 0.5, rnd()), pick([C.roof[0], C.roof[2], C.trunk], rnd));
    fence(ctx, C.steel, 0.3);
  }

  /* ---- つながるもの ---- */

  // DIRS[i] の向きへ -Z を向けるための角度。東西は符号が逆になる
  function faceDir(i) { return -i * Math.PI / 2; }

  function sidewalks(ctx, nb) {
    for (var i = 0; i < DIRS.length; i++) {
      if (nb[DIRS[i][2]]) continue;
      ctx.push(M(0, 0, 0, faceDir(i)));
      ctx.add(box(TILE - 0.5, 0.2, 0.7, 0.12), M(0, -0.2, -(HALF - 0.35), 0), C.pave);
      ctx.pop();
    }
  }

  function bRoad(ctx, rnd, info) {
    var nb = info.nb;
    tileTop(ctx, C.asphalt, C.asphaltDark);
    if (info.cnt === 0) {
      // どこにもつながっていないときは、小さなロータリーにする
      ctx.add(cyl(1.5, 1.5, 0.22, 20), M(0, -0.2, 0, 0), C.pave);
      ctx.add(cyl(1.1, 1.1, 0.16, 18), M(0, 0.02, 0, 0), C.grass);
      tree(ctx, rnd, 0, 0, 0.9);
    }
    for (var i = 0; i < DIRS.length; i++) {
      if (!nb[DIRS[i][2]]) continue;
      ctx.push(M(0, 0, 0, faceDir(i)));
      // **区画の隙間ぶんまで路面を伸ばす**。両どなりが半分ずつ出すので、まん中で継がる
      ctx.add(box(TILE - 0.3, 0.62, GAP + 0.14, 0.14), M(0, -0.62, -(HALF + GAP / 2 - 0.05), 0), C.asphalt);
      if (info.cnt <= 2) {
        // まっすぐの道は、線を通しにして一本の通りに見せる
        for (var k = 0; k < 4; k++) ctx.add(box(0.16, 0.05, 0.8, 0.03), M(0, 0.02, -(0.5 + k * 1.1), 0), C.line);
        for (var e2 = 0; e2 < 2; e2++) ctx.add(box(0.1, 0.05, PLOT / 2 - 0.2, 0.03), M(e2 ? 2.3 : -2.3, 0.02, -(PLOT / 2 - 0.2) / 2, 0), C.line);
      } else {
        // 交差点には横断歩道
        for (var z = 0; z < 4; z++) ctx.add(box(0.28, 0.05, 1.5, 0.03), M(-1.05 + z * 0.7, 0.02, -(HALF - 0.75), 0), C.line);
      }
      ctx.pop();
    }
    sidewalks(ctx, nb);
    lamp(ctx, HALF - 0.75, HALF - 0.75);
    if (info.cnt >= 3) lamp(ctx, -(HALF - 0.75), -(HALF - 0.75));
    if (rnd() < 0.55 && info.cnt > 0) {
      var d0 = -1;
      for (var q = 0; q < DIRS.length; q++) if (nb[DIRS[q][2]] && d0 < 0) d0 = q;
      ctx.push(M(0, 0, 0, faceDir(d0)));
      car(ctx, rnd, 0.9, -1.2 + rnd() * 2.4, 0, 0.95);
      ctx.pop();
    }
  }

  function railArm(ctx, dir, reach) {
    var L = reach ? PLOT / 2 + 0.07 : HALF;
    ctx.push(M(0, 0, 0, faceDir(dir)));
    ctx.add(box(2.0, 0.62, L, 0.08), M(0, -0.6, -L / 2, 0), C.ballast);
    var n = reach ? 5 : 4;
    for (var t = 0; t < n; t++) ctx.add(box(1.7, 0.08, 0.26, 0.03), M(0, -0.02, -(0.6 + t * 0.85), 0), C.trunk);
    for (var r = 0; r < 2; r++) ctx.add(box(0.16, 0.1, L, 0.03), M(r ? 0.55 : -0.55, 0.02, -L / 2, 0), C.steel);
    ctx.pop();
  }

  function bRail(ctx, rnd, info) {
    var nb = info.nb;
    tileTop(ctx, C.grass, C.soil);
    ctx.add(box(2.0, 0.62, 2.0, 0.08), M(0, -0.6, 0, 0), C.ballast);
    if (info.manual || info.cnt === 0) {
      // 手で決めた向き（またはどこにもつながっていないとき）はまっすぐ通す
      var a = info.rot % 2;
      railArm(ctx, a, !!nb[DIRS[a][2]]);
      railArm(ctx, a + 2, !!nb[DIRS[a + 2][2]]);
    } else {
      for (var i = 0; i < DIRS.length; i++) if (nb[DIRS[i][2]]) railArm(ctx, i, true);
      if (info.cnt === 1) {
        // 片側だけだと行き止まりに見えるので、反対側にも区画の中まで引く
        for (var j = 0; j < DIRS.length; j++) if (nb[DIRS[j][2]]) { railArm(ctx, (j + 2) % 4, false); break; }
      }
    }
    // 信号と柵
    ctx.add(cyl(0.09, 0.11, 2.0, 6), M(HALF - 1.0, 0, HALF - 1.0, 0), C.dark);
    ctx.lit(blob(0.2), M(HALF - 1.0, 2.1, HALF - 1.0, 0), 0xFF8A6B);
    edgeTrees(ctx, rnd, 3, 0.6);
    fence(ctx, C.steel, 0.28);
  }

  function bStation(ctx, rnd, info) {
    // 線路は駅の中では東西に敷いてある。南北につなぐときだけ90度回す
    var axis = stationAxis(info);
    tileTop(ctx, C.pave, C.paveDark);
    ctx.push(M(0, 0, 0, axis * Math.PI / 2));

    // 線路：区画のまん中を、ふちを越えて通す
    var RL = PLOT + 0.14;
    ctx.add(box(RL, 0.62, 2.0, 0.08), M(0, -0.6, 0, 0), C.ballast);
    for (var r = 0; r < 2; r++) ctx.add(box(RL, 0.1, 0.16, 0.04), M(0, 0.02, r ? 0.55 : -0.55, 0), C.steel);
    for (var ti = 0; ti < 10; ti++) ctx.add(box(0.28, 0.08, 1.7, 0.03), M(-3.6 + ti * 0.8, -0.04, 0, 0), C.trunk);

    // ホーム（線路の片側）
    ctx.add(box(TILE - 0.4, 0.44, 1.0, 0.14), M(0, -0.06, -1.75, 0), C.wall[1]);
    for (var c2 = 0; c2 < 3; c2++) ctx.add(cyl(0.09, 0.09, 1.5, 6), M(-2.0 + c2 * 2.0, 0.38, -1.75, 0), C.steel);
    ctx.add(box(TILE - 0.6, 0.14, 1.4, 0.1), M(0, 1.88, -1.75, 0), pick(C.roof, rnd));
    ctx.add(box(1.4, 0.3, 0.1, 0.05), M(0, 1.5, -2.2, 0), C.wall[0]);

    // 駅舎（線路の反対側・線路を向いて建つ）
    var h = 2.1;
    ctx.push(M(-0.3, 0, 2.3, 0));
    ctx.add(box(3.4, h, 1.6, 0.2), M(0, 0, 0, 0), pick(C.wall, rnd));
    ctx.add(box(3.7, 0.22, 1.9, 0.12), M(0, h, 0, 0), pick(C.roof, rnd));
    ctx.lit(box(2.4, 0.7, 0.1, 0.08), M(0, 0.8, -0.83, 0), C.glass);
    ctx.add(cyl(0.32, 0.32, 0.12, 12), MR(0, 1.66, -0.85, Math.PI / 2, 0, 0), C.wall[0]);
    ctx.pop();
    ctx.add(box(1.0, 0.12, 1.3, 0.2), M(1.9, -0.04, 2.0, 0), C.paveDark);
    lamp(ctx, HALF - 1.0, 2.5);
    ctx.pop();
    edgeTrees(ctx, rnd, 2, 0.6);
  }

  /* ---- 2区画×2区画の大きな施設 ---- */

  var BIG = 2 * PLOT - (PLOT - TILE), BHALF = BIG / 2;

  function bigTile(ctx, top, side) {
    ctx.add(box(BIG, 1.0, BIG, 0.8), M(0, -1.3, 0, 0), side);
    ctx.add(box(BIG - 0.26, 0.34, BIG - 0.26, 0.7), M(0, -0.34, 0, 0), top);
  }

  function bMall(ctx, rnd) {
    bigTile(ctx, C.pave, C.paveDark);
    ctx.add(box(BIG - 1.2, 0.12, 5.4, 0.3), M(0, -0.04, 4.0, 0), C.asphalt);
    var wall = pick(C.wall, rnd), roof = pick(C.roof, rnd);
    ctx.push(M(0, 0, -2.2, 0));
    ctx.add(box(11.0, 2.9, 6.4, 0.4), M(0, 0, 0, 0), wall);
    ctx.add(box(11.4, 0.26, 6.8, 0.3), M(0, 2.9, 0, 0), roof);
    ctx.add(box(5.6, 1.5, 3.0, 0.5), M(-2.0, 2.9, -0.4, 0), wall);
    ctx.add(box(5.9, 0.2, 3.3, 0.4), M(-2.0, 4.4, -0.4, 0), roof);
    for (var g = 0; g < 2; g++) {
      ctx.lit(box(9.6, 1.0, 0.1, 0.1), M(0, 0.5 + g * 1.3, 3.23, 0), C.glass);
    }
    // 入口のひさし
    ctx.add(box(4.2, 0.2, 1.6, 0.14), M(0, 2.0, 3.9, 0), roof);
    for (var p2 = 0; p2 < 2; p2++) ctx.add(cyl(0.12, 0.12, 2.0, 8), M(p2 ? 1.8 : -1.8, 0, 4.5, 0), C.metal);
    ctx.lit(box(3.2, 0.5, 0.12, 0.08), M(0, 2.3, 3.2, 0), 0xFFE9A8);
    // 屋上の設備
    for (var u = 0; u < 3; u++) ctx.add(box(1.2, 0.5, 1.0, 0.12), M(3.2 - u * 1.6, 3.16, 1.6, 0), C.steel);
    ctx.pop();
    // 駐車場
    for (var l = 0; l < 7; l++) ctx.add(box(0.12, 0.05, 2.4, 0.03), M(-4.2 + l * 1.4, 0.02, 4.0, 0), C.line);
    var nc = 5 + Math.floor(rnd() * 4);
    for (var c = 0; c < nc; c++) car(ctx, rnd, -3.5 + c * 1.4 + (rnd() - 0.5) * 0.2, 3.4 + (rnd() < 0.5 ? 0 : 1.4), 0, 0.95);
    // 看板
    ctx.add(cyl(0.2, 0.24, 3.4, 8), M(-BHALF + 1.2, 0, BHALF - 1.4, 0), C.metal);
    ctx.lit(box(2.0, 1.0, 0.16, 0.14), M(-BHALF + 1.2, 3.0, BHALF - 1.4, 0), 0xFFD166);
    for (var t = 0; t < 5; t++) {
      var a = rnd() * Math.PI * 2, rr = BHALF - 0.9;
      tree(ctx, rnd, Math.cos(a) * rr, Math.sin(a) * rr, 0.7 + rnd() * 0.4);
    }
    lamp(ctx, BHALF - 1.0, BHALF - 1.0);
    lamp(ctx, -BHALF + 1.0, -BHALF + 1.0);
  }

  function bCampus(ctx, rnd) {
    bigTile(ctx, C.grass, C.soil);
    ctx.add(box(BIG - 2.0, 0.12, 1.4, 0.3), M(0, -0.04, 1.6, 0), C.pave);
    ctx.add(box(1.4, 0.12, BIG - 2.0, 0.3), M(0, -0.04, 0, 0), C.pave);
    var wall = pick(C.wall, rnd), roof = pick(C.roof, rnd);
    // 本館
    ctx.push(M(0, 0, -3.6, 0));
    ctx.add(box(9.0, 3.0, 3.2, 0.3), M(0, 0, 0, 0), wall);
    ctx.add(box(9.3, 0.22, 3.5, 0.24), M(0, 3.0, 0, 0), roof);
    for (var f = 0; f < 3; f++) ctx.lit(box(7.6, 0.5, 0.1, 0.08), M(0, 0.5 + f * 0.95, 1.63, 0), C.glass);
    // 時計塔
    ctx.add(box(2.0, 5.2, 2.0, 0.24), M(0, 0, 0.3, 0), wall);
    ctx.add(cone(1.7, 1.4, 4), MR(0, 5.2, 0.3, 0, Math.PI / 4, 0), roof);
    ctx.add(cyl(0.42, 0.42, 0.14, 14), MR(0, 4.4, 1.32, Math.PI / 2, 0, 0), C.wall[0]);
    ctx.pop();
    // 実習棟
    for (var w2 = 0; w2 < 2; w2++) {
      ctx.push(M(w2 ? 4.4 : -4.4, 0, 1.2, 0));
      ctx.add(box(3.0, 2.2, 6.0, 0.26), M(0, 0, 0, 0), pick(C.wall, rnd));
      ctx.add(box(3.3, 0.2, 6.3, 0.2), M(0, 2.2, 0, 0), pick(C.roof, rnd));
      for (var f2 = 0; f2 < 2; f2++) ctx.lit(box(0.1, 0.5, 5.0, 0.08), M((w2 ? -1 : 1) * 1.53, 0.5 + f2 * 0.95, 0, 0), C.glass);
      ctx.pop();
    }
    // 運動場
    ctx.add(box(6.6, 0.12, 4.0, 0.9), M(0, -0.04, 4.4, 0), 0xC98F5E);
    ctx.add(box(5.6, 0.1, 3.0, 0.8), M(0, 0.02, 4.4, 0), C.grassDark);
    bench(ctx, -2.6, 1.4, 0.2); bench(ctx, 2.6, 1.4, -0.2);
    for (var t2 = 0; t2 < 6; t2++) {
      var a2 = rnd() * Math.PI * 2, r2 = BHALF - 0.9;
      tree(ctx, rnd, Math.cos(a2) * r2, Math.sin(a2) * r2, 0.75 + rnd() * 0.4);
    }
    lamp(ctx, -BHALF + 1.1, 1.0);
    lamp(ctx, BHALF - 1.1, -1.0);
  }

  function bHall(ctx, rnd) {
    tileTop(ctx, C.pave, C.paveDark);
    ctx.add(box(TILE - 1.0, 0.16, 2.4, 0.3), M(0, -0.06, 2.0, 0), C.paveDark);
    var wall = C.wall[0], roof = pick(C.roof, rnd);
    ctx.push(M(0, 0, -0.9, 0));
    // 基壇と階段
    ctx.add(box(6.6, 0.4, 3.6, 0.18), M(0, -0.02, 0, 0), C.wall[2]);
    ctx.add(box(4.4, 0.18, 0.5, 0.06), M(0, 0.0, 2.0, 0), C.wall[2]);
    // 本体
    ctx.add(box(5.6, 2.2, 3.0, 0.2), M(0, 0.38, 0, 0), wall);
    ctx.add(box(6.0, 0.22, 3.4, 0.14), M(0, 2.58, 0, 0), roof);
    // 柱
    for (var c = 0; c < 4; c++) ctx.add(cyl(0.2, 0.22, 1.9, 10), M(-1.8 + c * 1.2, 0.38, 1.6, 0), C.wall[0]);
    ctx.add(box(4.6, 0.3, 0.7, 0.1), M(0, 2.28, 1.6, 0), C.wall[0]);
    for (var w = 0; w < 2; w++) ctx.lit(box(1.1, 0.9, 0.1, 0.08), M(w ? 2.0 : -2.0, 1.0, 1.53, 0), C.glass);
    // 時計塔
    ctx.add(box(1.8, 3.4, 1.8, 0.22), M(0, 2.58, -0.2, 0), wall);
    ctx.add(cone(1.5, 1.3, 4), MR(0, 5.98, -0.2, 0, Math.PI / 4, 0), roof);
    ctx.add(cyl(0.38, 0.38, 0.14, 14), MR(0, 5.1, 0.72, Math.PI / 2, 0, 0), C.wall[0]);
    ctx.pop();
    // 旗
    ctx.add(cyl(0.07, 0.09, 3.2, 6), M(-2.7, 0, 2.2, 0), C.metal);
    ctx.add(box(0.9, 0.55, 0.06, 0.04), M(-2.24, 2.5, 2.2, 0), C.roof[0]);
    flowers(ctx, rnd, 2.3, 2.2, 1.4, 0.6);
    edgeTrees(ctx, rnd, 2, 0.7);
    lamp(ctx, HALF - 1.0, HALF - 1.0);
  }

  function bDepot(ctx, rnd) {
    tileTop(ctx, C.pave, C.paveDark);
    ctx.add(box(TILE - 0.6, 0.12, 3.2, 0.2), M(0, -0.04, 1.4, 0), C.asphalt);
    // 事務所
    ctx.push(M(-1.9, 0, -1.9, 0));
    ctx.add(box(2.6, 1.6, 2.0, 0.18), M(0, 0.3, 0, 0), pick(C.wall, rnd));
    ctx.add(box(2.9, 0.18, 2.3, 0.1), M(0, 1.9, 0, 0), pick(C.roof, rnd));
    ctx.lit(box(1.6, 0.6, 0.1, 0.08), M(0, 0.9, 1.03, 0), C.glass);
    ctx.add(box(2.6, 0.3, 2.0, 0.1), M(0, 0, 0, 0), C.steel);
    ctx.pop();
    // サイロ
    ctx.add(cyl(0.8, 0.8, 2.6, 12), M(2.2, 0, -2.0, 0), C.metal);
    ctx.add(cone(0.9, 0.7, 10), M(2.2, 2.6, -2.0, 0), C.steel);
    for (var l = 0; l < 3; l++) ctx.add(cyl(0.09, 0.09, 1.0, 5), M(2.2 + Math.cos(l * 2.1) * 0.7, 0, -2.0 + Math.sin(l * 2.1) * 0.7, 0), C.steel);
    // 小さなクレーン
    ctx.add(cyl(0.16, 0.2, 3.6, 6), M(0.4, 0, -0.4, 0), C.roof[2]);
    ctx.add(box(3.4, 0.2, 0.2, 0.06), M(1.6, 3.5, -0.4, 0), C.roof[2]);
    ctx.add(cyl(0.05, 0.05, 1.4, 5), M(3.0, 2.1, -0.4, 0), C.dark);
    ctx.add(box(0.5, 0.35, 0.5, 0.08), M(3.0, 1.75, -0.4, 0), C.steel);
    // 資材
    for (var st = 0; st < 3; st++) {
      var sx = -2.4 + st * 1.5, sz = 1.2 + (st % 2) * 0.9;
      for (var h = 0; h < 2 + (rnd() < 0.5 ? 1 : 0); h++) {
        ctx.add(box(1.3, 0.28, 0.8, 0.05), M(sx, h * 0.3, sz, (rnd() - 0.5) * 0.2), h % 2 ? C.trunk : C.wall[2]);
      }
    }
    for (var pp = 0; pp < 4; pp++) ctx.add(cyl(0.22, 0.22, 2.2, 8), MR(2.3 + pp * 0.24, 0.25 + (pp > 2 ? 0.44 : 0), 2.0, 0, 0, Math.PI / 2), C.steel);
    car(ctx, rnd, -0.6, 2.6, 0, 0.95);
    fence(ctx, C.steel, 0.28);
  }


  function buildWaste(ctx, rnd) {
    tileTop(ctx, C.waste, C.wasteDark);
    for (var i = 0; i < 7; i++) {
      var x = (rnd() - 0.5) * (TILE - 1.4), z = (rnd() - 0.5) * (TILE - 1.4);
      var s = 0.35 + rnd() * 0.45;
      ctx.add(blob(s), MR(x, s * 0.45, z, rnd() * 3, rnd() * 3, rnd() * 3), rnd() < 0.5 ? C.rock : C.wasteDark);
    }
    for (var b = 0; b < 4; b++) {
      var bx = (rnd() - 0.5) * (TILE - 1.6), bz = (rnd() - 0.5) * (TILE - 1.6);
      ctx.add(cyl(0.05, 0.09, 0.8 + rnd() * 0.5, 5), MR(bx, 0, bz, (rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5), C.dead);
      ctx.add(blob(0.3), MR(bx, 0.95, bz, rnd() * 3, rnd() * 3, 0), 0x9A9370);
    }
    for (var p = 0; p < 3; p++) {
      ctx.add(box(0.9, 0.16, 0.5, 0.05), MR((rnd() - 0.5) * 4, 0.08, (rnd() - 0.5) * 4, 0, rnd() * 3, (rnd() - 0.5) * 0.3), C.dead);
    }
  }

  // カタログに形の作り方を差し込む（データはcatalog.js、形はここ）
  var BUILDERS = {
    houses: bHouses, apart: bApart, park: bPark,
    shops: bShops, plaza: bPlaza, cafe: bCafe, mall: bMall,
    power: bPower, water: bWater, station: bStation, road: bRoad, rail: bRail, hall: bHall,
    office: bOffice, factory: bFactory, data: bData, campus: bCampus,
    ware: bWarehouse, hub: bHub, depot: bDepot,
  };
  CATALOG.forEach(function (it) { it.build = BUILDERS[it.id]; });

  /* ============================================================
     3. 舞台
     ============================================================ */

  var stage = host;
  var canvas = canvasEl;
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xC6E6F5, 0.0022);

  var camera = new THREE.PerspectiveCamera(37, 1, 1, 1200);
  var view = { az: 0.72, pol: 0.92, dist: 88, ty: 2, tx: 0, tz: 0 };
  var viewT = { az: 0.72, pol: 0.92, dist: 88, ty: 2, tx: 0, tz: 0 };
  // 画の上下の寄せ。下にパネルがある画面ほど街を上へ逃がす
  var bias = -2;

  var sun = new THREE.DirectionalLight(0xFFEBC0, 1.45);
  sun.position.set(54, 46, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1280, 1280);
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 220;
  sun.shadow.camera.left = -84; sun.shadow.camera.right = 84;
  sun.shadow.camera.top = 84; sun.shadow.camera.bottom = -84;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);

  var hemi = new THREE.HemisphereLight(0xB9DEF7, 0x8A7A5E, 0.42);
  scene.add(hemi);
  var fill = new THREE.DirectionalLight(0xA6C6EA, 0.2);
  fill.position.set(-40, 26, -30);
  scene.add(fill);
  // うしろからの淡い光。輪郭が立って立体に見える
  var rim = new THREE.DirectionalLight(0xDCEEFF, 0.2);
  rim.position.set(-20, 14, -52);
  scene.add(rim);

  var skyU = {
    uTop: { value: new THREE.Color("#4E9BD8") }, uBottom: { value: new THREE.Color("#E2F3FC") },
    uSun: { value: new THREE.Vector3(0.55, 0.62, 0.38).normalize() },
    uSunCol: { value: new THREE.Color("#FFF0CC") },
  };
  var sky = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: "varying vec3 vW; void main(){ vW=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: [
      "uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uSun; uniform vec3 uSunCol; varying vec3 vW;",
      "void main(){",
      "  vec3 dir = normalize(vW);",
      "  float h = clamp(dir.y*1.15+0.30,0.0,1.0);",
      "  vec3 col = mix(uBottom, uTop, pow(h,0.85));",
      "  float d = max(dot(dir, normalize(uSun)), 0.0);",
      "  col += uSunCol * (pow(d, 220.0) * 1.5 + pow(d, 8.0) * 0.16);",
      "  col += uSunCol * 0.10 * pow(1.0 - abs(dir.y), 5.0);",
      "  gl_FragColor = vec4(col, 1.0); }",
    ].join("\n"),
  }));
  scene.add(sky);

  // 空だけの部屋を作って、そこから環境光（映り込み）を焼く。
  // これがあると、面の陰り方と窓の映り込みが一気に本物らしくなる。
  var skyScene = new THREE.Scene();
  skyScene.add(new THREE.Mesh(sky.geometry, sky.material));
  var envRT = null, envTried = false;
  function updateEnv() {
    if (envTried) return;
    envTried = true;
    // 焼けない端末もある。失敗したら環境光なしで続ける
    try {
      var pmrem = new THREE.PMREMGenerator(renderer);
      envRT = pmrem.fromScene(skyScene, 0.03, 1, 1100);
      scene.environment = envRT.texture;
      pmrem.dispose();
    } catch (err) {
      scene.environment = null;
    }
  }

  var water = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshPhongMaterial({ color: C.water, shininess: 150, specular: 0x9FC8DE })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -4.6;
  water.receiveShadow = false;
  scene.add(water);

  // 水面のきらめき（板を1枚ずらして重ねるだけ）
  var shineTex = (function () {
    var cv = document.createElement("canvas"); cv.width = 256; cv.height = 256;
    var g = cv.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 90; i++) {
      var x = Math.random() * 256, y = Math.random() * 256, w = 6 + Math.random() * 26;
      var grd = g.createLinearGradient(x, y, x + w, y);
      grd.addColorStop(0, "rgba(255,255,255,0)");
      grd.addColorStop(0.5, "rgba(255,255,255," + (0.25 + Math.random() * 0.4).toFixed(2) + ")");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd; g.fillRect(x, y, w, 2 + Math.random() * 2);
    }
    var t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(14, 14);
    return t;
  })();
  var shine = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshBasicMaterial({ map: shineTex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
  );
  shine.rotation.x = -Math.PI / 2;
  shine.position.y = -4.55;
  scene.add(shine);

  // 雲
  var cloudGroup = new THREE.Group(), cloudMat = null;
  scene.add(cloudGroup);
  (function () {
    cloudMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, emissive: 0xC6DCEE, transparent: true, opacity: 0.9 });
    for (var i = 0; i < 7; i++) {
      var b = new Builder();
      var n = 3 + Math.floor(Math.random() * 2);
      for (var k = 0; k < n; k++) {
        var r = 1.8 + Math.random() * 1.6;
        b.add(blob(r), MR((k - n / 2) * 2.2, Math.random() * 1.0, Math.random() * 1.4, Math.random(), Math.random() * 3, 0), 0xFFFFFF);
      }
      var m = b.mesh(cloudMat, false);
      var ca = Math.random() * Math.PI * 2, cr = 110 + Math.random() * 120;
      m.position.set(Math.cos(ca) * cr, 46 + Math.random() * 22, Math.sin(ca) * cr);
      m.userData.sp = 0.6 + Math.random() * 0.8;
      cloudGroup.add(m);
    }
  })();

  var solidMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // 窓は磨いた面。昼は空を映し、夕方は内側から光る
  var litMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.12, metalness: 0.15, envMapIntensity: 2.2,
    emissive: new THREE.Color(0x000000),
  });
  litMat.color.setHex(0xBFD2DE);

  /* ============================================================
     4. 土地
     ============================================================ */

  var land = new THREE.Group();
  scene.add(land);
  var groundGroup = new THREE.Group();
  land.add(groundGroup);
  var plotGroup = new THREE.Group();
  land.add(plotGroup);

  var plots = {};
  var pads = [];
  var padGeo = box(TILE + 0.6, 0.5, TILE + 0.6, 0.5);
  var padMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, fog: false });
  var selected = null;
  var selRing = new THREE.Mesh(box(TILE + 1.1, 0.4, TILE + 1.1, 0.8),
    new THREE.MeshBasicMaterial({ color: 0xFFD166, transparent: true, opacity: 0.95, fog: false }));
  selRing.material.color;
  selRing.visible = false;
  scene.add(selRing);
  var state = { pt: 0, ext: START_EXT, dusk: false, unlocked: { live: true }, done: 0, quest: 0, spent: 0, last: "houses" };

  function pkey(i, j) { return i + "," + j; }
  function inRing(i, j, e) { return Math.max(Math.abs(i), Math.abs(j)) <= e; }

  function buildGround() {
    for (var i = groundGroup.children.length - 1; i >= 0; i--) {
      var c = groundGroup.children[i];
      groundGroup.remove(c); c.geometry.dispose();
    }
    var S = (state.ext * 2 + 1) * PLOT;
    var b = new Builder();
    b.add(box(S + 26, 1.0, S + 26, 9), M(0, -4.3, 0, 0), 0x64C3E2);      // 浅瀬
    b.add(box(S + 11, 0.9, S + 11, 6), M(0, -3.9, 0, 0), 0x8CDCEE);      // もっと浅いところ
    b.add(box(S + 5.6, 0.7, S + 5.6, 4.6), M(0, -3.5, 0, 0), 0xE6F7FD);  // 波打ちぎわ
    b.add(box(S + 3.6, 1.6, S + 3.6, 3.0), M(0, -3.4, 0, 0), C.sand);
    b.add(box(S + 1.0, 1.6, S + 1.0, 2.0), M(0, -1.95, 0, 0), C.streetEdge);
    b.add(box(S + 0.4, 0.4, S + 0.4, 1.9), M(0, -0.75, 0, 0), C.street);
    // 道の白線
    for (var n = -state.ext; n <= state.ext + 1; n++) {
      var t = (n - 0.5) * PLOT;
      for (var s = -1; s <= 1; s += 2) {
        for (var seg = 0; seg < state.ext * 2 + 1; seg++) {
          var c0 = (seg - state.ext) * PLOT;
          if (s < 0) b.add(box(3.0, 0.06, 0.16, 0.03), M(c0, -0.34, t, 0), C.line);
          else b.add(box(0.16, 0.06, 3.0, 0.03), M(t, -0.34, c0, 0), C.line);
        }
      }
    }
    var m = b.mesh(solidMat, true);
    m.castShadow = false;
    groundGroup.add(m);
  }

  function makeGroup(item, seed, info) {
    var ctx = new Ctx();
    var rnd = rngFrom(seed);
    curInfo = info || { nb: { n: 0, e: 0, s: 0, w: 0 }, cnt: 0, rot: 0, level: 0, nlv: null };
    if (curInfo.level < 0) bCanal(ctx, rnd);
    else if (item === null) buildWaste(ctx, rnd);
    else itemById(item).build(ctx, rnd, curInfo);
    var g = new THREE.Group();
    var ms = ctx.b.mesh(solidMat, true);
    if (ms) g.add(ms);
    var mw = ctx.w.mesh(litMat, false);
    if (mw) g.add(mw);
    return g;
  }

  function disposeGroup(g) {
    if (!g) return;
    g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    if (g.parent) g.parent.remove(g);
  }

  function addPlot(i, j, item) {
    var p = { i: i, j: j, x: i * PLOT, z: j * PLOT, item: null, rot: 0, level: 0, group: null, hover: 0 };
    p.seed = (i * 73856093) ^ (j * 19349663) ^ 0x9E3779B9;
    p.item = item || null;
    p.group = makeGroup(p.item, p.seed, nbInfo(p));
    p.group.position.set(p.x, p.level * STEP, p.z);
    plotGroup.add(p.group);
    // 当たり判定は見えない板ひとつ。木や屋根を狙わなくても区画ごと選べる
    p.pad = new THREE.Mesh(padGeo, padMat);
    p.pad.position.set(p.x, -0.45, p.z);
    p.pad.userData.plot = p;
    land.add(p.pad);
    pads.push(p.pad);
    plots[pkey(i, j)] = p;
    return p;
  }

  function refreshTargets() { /* 板は区画と一緒に作るので、作り直すものは無い */ }

  // となりが同じ仲間かどうか。道路と線路はこれで形が決まる
  function nbInfo(p) {
    var kind = connKind(p.item), nb = { n: 0, e: 0, s: 0, w: 0 }, cnt = 0;
    for (var i = 0; i < DIRS.length; i++) {
      var q = plots[pkey(p.i + DIRS[i][0], p.j + DIRS[i][1])];
      var ok = kind !== null && q && connKind(q.item) === kind && opensToward(q, i);
      nb[DIRS[i][2]] = ok ? 1 : 0;
      if (ok) cnt++;
    }
    var nlv = [], nroad = [], dlv = [];
    for (var m = 0; m < DIRS.length; m++) {
      var t = plots[pkey(p.i + DIRS[m][0], p.j + DIRS[m][1])];
      nlv.push(t ? (t.level || 0) : null);
      nroad.push(!!(t && t.item === "road"));
      var n2 = DIRS[(m + 1) % 4];
      var dq = plots[pkey(p.i + DIRS[m][0] + n2[0], p.j + DIRS[m][1] + n2[1])];
      dlv.push(dq ? (dq.level || 0) : null);
    }
    return {
      nb: nb, cnt: cnt, rot: p.rot || 0, manual: !!p.manual,
      level: p.level || 0, nlv: nlv, dlv: dlv, nroad: nroad, isRoad: p.item === "road",
    };
  }

  function rebuildPlot(p) {
    if (p.master || p.span) return;
    var old = p.group;
    var g = makeGroup(p.item, p.seed, nbInfo(p));
    g.position.set(p.x, (p.level || 0) * STEP, p.z);
    // 道路と線路は中で向きを決めるので、区画ごとは回さない
    g.rotation.y = connKind(p.item) ? 0 : p.rot * Math.PI / 2;
    plotGroup.add(g);
    p.group = g;
    disposeGroup(old);
  }

  function refreshAround(p) {
    for (var i = 0; i < DIRS.length; i++) {
      var q = plots[pkey(p.i + DIRS[i][0], p.j + DIRS[i][1])];
      if (q && connKind(q.item)) rebuildPlot(q);
    }
    renderer.shadowMap.needsUpdate = true;
  }

  // 大きな施設をばらす。四つの区画が戻ってくる
  function dismantle(q) {
    var m = plots[q.master || pkey(q.i, q.j)];
    if (!m) return [q];
    disposeGroup(m.group);
    m.group = new THREE.Group();
    plotGroup.add(m.group);
    var cells = [];
    for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) {
      var c = plots[pkey(m.i + a, m.j + b)];
      if (c) { c.master = null; c.span = 0; cells.push(c); }
    }
    return cells;
  }

  function countLeft() {
    var n = 0;
    for (var k in plots) if (!plots[k].item && (plots[k].level || 0) >= 0) n++;
    return n;
  }

  function resetWorld() {
    for (var k in plots) {
      disposeGroup(plots[k].group);
      if (plots[k].pad) land.remove(plots[k].pad);
    }
    plots = {};
    pads.length = 0;
    state.ext = START_EXT; state.done = 0;
    state.unlocked = { live: true }; state.last = "houses"; state.quest = 0;
    selected = null;
    var mid = [["plaza", 0, 0], ["houses", 1, 0], ["houses", -1, 0], ["park", 0, 1], ["houses", 0, -1],
               ["houses", 1, 1], ["apart", -1, 1], ["houses", 1, -1], ["houses", -1, -1]];
    for (var i = -state.ext; i <= state.ext; i++) {
      for (var j = -state.ext; j <= state.ext; j++) {
        var found = null;
        for (var m = 0; m < mid.length; m++) if (mid[m][1] === i && mid[m][2] === j) found = mid[m][0];
        if (found) { addPlot(i, j, found); state.done++; }
        else addPlot(i, j, null);
      }
    }
    buildGround();
    refreshTargets();
    fitCamera(true);
    renderCatalog();
    renderQuest();
    renderUI();
    renderer.shadowMap.needsUpdate = true;
  }

  var hallWarn = 0;
  function expandLand() {
    if (state.ext >= MAX_EXT) return false;
    if (!hasHall()) {
      if (Date.now() - hallWarn > 9000) {
        hallWarn = Date.now();
        toast("土地を広げるには市役所が必要です", "インフラの「市役所」を建てると、外側に新しい区画が出るようになります。");
      }
      return false;
    }
    state.ext++;
    buildGround();
    var added = [];
    for (var i = -state.ext; i <= state.ext; i++) {
      for (var j = -state.ext; j <= state.ext; j++) {
        if (inRing(i, j, state.ext - 1)) continue;
        var p = addPlot(i, j, null);
        p.group.position.y = 16 + Math.random() * 8;
        p.group.scale.set(0.8, 0.8, 0.8);
        added.push(p);
      }
    }
    added.forEach(function (p, n) {
      var y0 = p.group.position.y;
      tw(0.6, n * 0.012, function (u) {
        var e = outBack(u);
        p.group.position.y = y0 * (1 - e);
        var s = 0.8 + 0.2 * e;
        p.group.scale.set(s, s, s);
      }, function () { p.group.position.y = 0; p.group.scale.set(1, 1, 1); });
    });
    refreshTargets();
    fitCamera();
    toast("土地が広がりました", "外側に新しい区画が出ました。整えるほど、街は外へ伸びていきます。");
    if (opts.onChange) opts.onChange();
    return true;
  }

  /* ============================================================
     5. 演出
     ============================================================ */

  var tweens = [];
  function tw(dur, delay, fn, end) { tweens.push({ t: -(delay || 0), d: dur, fn: fn, end: end }); }
  function outBack(u) { var c1 = 1.70158, c3 = c1 + 1; var p = u - 1; return 1 + c3 * p * p * p + c1 * p * p; }
  function inBack(u) { var c1 = 1.9, c3 = c1 + 1; return c3 * u * u * u - c1 * u * u; }
  function outCubic(u) { var p = 1 - u; return 1 - p * p * p; }

  var sparkTex = (function () {
    var cv = document.createElement("canvas"); cv.width = cv.height = 64;
    var g = cv.getContext("2d");
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.35, "rgba(255,240,200,.8)");
    gr.addColorStop(1, "rgba(255,225,160,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  var sparks = [];
  for (var si = 0; si < 90; si++) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sparkTex, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }));
    sp.visible = false;
    sp.userData = { life: 0, vx: 0, vy: 0, vz: 0 };
    scene.add(sp);
    sparks.push(sp);
  }
  function burst(x, z, n) {
    var made = 0;
    for (var i = 0; i < sparks.length && made < n; i++) {
      var s = sparks[i];
      if (s.visible) continue;
      var a = Math.random() * Math.PI * 2, r = Math.random() * 2.4;
      s.position.set(x + Math.cos(a) * r, 0.4 + Math.random() * 0.6, z + Math.sin(a) * r);
      s.userData.vx = Math.cos(a) * (1.4 + Math.random() * 2.2);
      s.userData.vz = Math.sin(a) * (1.4 + Math.random() * 2.2);
      s.userData.vy = 5.0 + Math.random() * 4.5;
      s.userData.life = 0.75 + Math.random() * 0.4;
      s.userData.max = s.userData.life;
      var k = 0.7 + Math.random() * 0.8;
      s.scale.set(k, k, 1);
      s.material.opacity = 1;
      s.visible = true;
      made++;
    }
  }

  var rings = [];
  for (var ri = 0; ri < 4; ri++) {
    var rg = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 40), new THREE.MeshBasicMaterial({
      color: 0xFFF2CE, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }));
    rg.rotation.x = -Math.PI / 2;
    rg.visible = false;
    scene.add(rg);
    rings.push(rg);
  }
  function shock(x, z) {
    for (var i = 0; i < rings.length; i++) {
      if (rings[i].visible) continue;
      var r = rings[i];
      r.position.set(x, 0.1, z);
      r.visible = true;
      tw(0.62, 0, function (rr) {
        return function (u) {
          var e = outCubic(u), s = 1.5 + e * 6.4;
          rr.scale.set(s, s, 1);
          rr.material.opacity = (1 - u) * 0.85;
        };
      }(r), function (rr) { return function () { rr.visible = false; }; }(r));
      return;
    }
  }

  function toast(t, s) { if (opts.onToast) opts.onToast(t, s || ""); }
  var _pv = new THREE.Vector3();
  function popText(x, z, text) {
    _pv.set(x, 2.2, z).project(camera);
    var el = document.createElement("div");
    el.className = "pop";
    el.textContent = text;
    el.style.left = ((_pv.x * 0.5 + 0.5) * host.clientWidth) + "px";
    el.style.top = ((-_pv.y * 0.5 + 0.5) * host.clientHeight) + "px";
    host.appendChild(el);
    setTimeout(function () { el.remove(); }, 1000);
  }

  /* ============================================================
     6. 区画をひらく
     ============================================================ */

  function countItem(id) {
    var n = 0;
    for (var k in plots) if (plots[k].item === id && !plots[k].master) n++;
    return n;
  }
  function hasHall() { return countItem("hall") > 0; }

  // 工務店があるほど、区画をひらく費用が下がる
  function costNow() {
    var dp = Math.min(3, countItem("depot"));
    return Math.max(6, Math.round((10 + state.done * 2.4) * (1 - 0.12 * dp)));
  }
  // 研修センターで全体が底上げされ、駅のとなりはにぎわう
  function incomeNow() {
    var v = 2.0, boost = 1 + 0.25 * Math.min(2, countItem("campus"));
    for (var k in plots) {
      var p = plots[k];
      if (!p.item || p.master) continue;
      var val = itemById(p.item).value;
      if (p.item !== "station") {
        for (var i = 0; i < DIRS.length; i++) {
          var q = plots[pkey(p.i + DIRS[i][0], p.j + DIRS[i][1])];
          if (q && q.item === "station") { val *= 1.3; break; }
        }
      }
      v += val * 2.0;
    }
    return v * boost;
  }
  function openItems() {
    var a = [];
    for (var i = 0; i < CATALOG.length; i++) if (state.unlocked[CATALOG[i].g]) a.push(CATALOG[i]);
    return a;
  }

  function popOut(group, delay) {
    tw(0.24, delay || 0, function (u) {
      var e = inBack(Math.min(1, u));
      var sc = Math.max(0.001, 1 - e);
      group.scale.set(sc, sc, sc);
      group.position.y = -e * 1.5;
    }, function () { disposeGroup(group); });
  }
  function popIn(group, delay) {
    group.scale.set(0.5, 0.01, 0.5);
    tw(0.6, delay === undefined ? 0.14 : delay, function (u) {
      var e = outBack(u);
      group.scale.set(0.5 + 0.5 * e, Math.max(0.01, e), 0.5 + 0.5 * e);
    }, function () { group.scale.set(1, 1, 1); renderer.shadowMap.needsUpdate = true; });
  }

  function buildOne(p, itemId, delay) {
    if (p.item === itemId) p.seed = (p.seed * 1103515245 + 12345) | 0;  // 同じものなら並びだけ変える
    if (p.item !== itemId) p.manual = false;                            // 建て替えたら向きは自動に戻す
    popOut(p.group, delay);
    p.item = itemId;
    var g = makeGroup(itemId, p.seed, nbInfo(p));
    g.position.set(p.x, (p.level || 0) * STEP, p.z);
    g.rotation.y = connKind(itemId) ? 0 : p.rot * Math.PI / 2;
    plotGroup.add(g);
    p.group = g;
    popIn(g, (delay || 0) + 0.14);
    refreshAround(p);
    shock(p.x, p.z);
    burst(p.x, p.z, 12);
  }

  // 荒れ地をひらくときだけポイントがいる。建て替えはいつでも自由
  function place(p, itemId) {
    if ((p.level || 0) < 0) {
      toast("水面には建てられません", "「盛る」で一段上げて埋め立てると建てられます。");
      return;
    }
    var item = itemById(itemId);
    if (item.size === 2) return placeBig(p, itemId);

    var targets = [p], note = null;
    if (p.master || p.span) {
      targets = dismantle(p);
      note = "四つの区画がすべて「" + item.name + "」になりました。";
    }
    var freshN = 0;
    for (var i = 0; i < targets.length; i++) if (!targets[i].item) freshN++;
    var cost = costNow() * freshN;
    if (state.pt < cost) {
      toast("ポイントが足りません", "整えた区画から自動で貯まります。あと " + Math.ceil(cost - state.pt) + " ポイントです。");
      return;
    }
    state.pt -= cost;
    state.spent = (state.spent || 0) + cost;
    state.done += freshN;
    state.last = itemId;
    targets.forEach(function (q, n) { buildOne(q, itemId, n * 0.05); });
    popText(p.x, p.z, item.name);
    if (note) toast("大きな施設をばらしました", note);
    renderCatalog();
    renderUI();
    if (opts.onChange) opts.onChange();
    if (countLeft() === 0) setTimeout(function () { expandLand(); renderUI(); }, 500);
  }

  // 2×2。選んだ区画を含む四角を探して、そこへまとめて建てる
  function placeBig(p, itemId) {
    var item = itemById(itemId), spot = null;
    var tries = [[0, 0], [-1, 0], [0, -1], [-1, -1]];
    for (var c = 0; c < tries.length && !spot; c++) {
      var i0 = p.i + tries[c][0], j0 = p.j + tries[c][1], cells = [];
      for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) {
        var q = plots[pkey(i0 + a, j0 + b)];
        if (q) cells.push(q);
      }
      if (cells.length === 4) spot = { i0: i0, j0: j0, cells: cells };
    }
    if (!spot) {
      toast("ここには置けません", item.name + "は二区画×二区画ぶんの広さがいります。もう少し内側の区画を選んでください。");
      return;
    }
    spot.cells.forEach(function (q) { if (q.master || q.span) dismantle(q); });
    var freshN = 0;
    spot.cells.forEach(function (q) { if (!q.item) freshN++; });
    var cost = costNow() * Math.max(1, freshN);
    if (state.pt < cost) {
      toast("ポイントが足りません", item.name + "には " + cost + " ポイントいります。あと " + Math.ceil(cost - state.pt) + " です。");
      return;
    }
    state.pt -= cost;
    state.spent = (state.spent || 0) + cost;
    state.done += freshN;
    state.last = itemId;

    var master = plots[pkey(spot.i0, spot.j0)];
    spot.cells.forEach(function (q) {
      popOut(q.group, 0);
      q.item = itemId;
      q.master = (q === master) ? null : pkey(spot.i0, spot.j0);
      q.span = (q === master) ? 2 : 0;
      q.rot = 0;
      if (q !== master) { q.group = new THREE.Group(); plotGroup.add(q.group); }
    });
    var g = makeGroup(itemId, master.seed, { nb: { n: 0, e: 0, s: 0, w: 0 }, cnt: 0 });
    var cx = spot.i0 * PLOT + PLOT / 2, cz = spot.j0 * PLOT + PLOT / 2;
    g.position.set(cx, 0, cz);
    plotGroup.add(g);
    master.group = g;
    popIn(g, 0.16);
    spot.cells.forEach(function (q) { refreshAround(q); });
    shock(cx, cz);
    burst(cx, cz, 26);
    popText(cx, cz, item.name);
    selectPlot(master);
    renderCatalog();
    renderUI();
    if (opts.onChange) opts.onChange();
    if (countLeft() === 0) setTimeout(function () { expandLand(); renderUI(); }, 500);
  }

  function levelPlot(p, dir) {
    if (!p) { toast("区画をタップしてください", "選んだ区画の高さを変えます。"); return; }
    if (p.master || p.span) { toast("大きな施設は高さを変えられません", "二区画ぶんの施設は平らなままです。"); return; }
    var nl = (p.level || 0) + dir;
    if (nl > 3) { toast("これ以上は盛れません", "高さは三段までです。"); return; }
    if (nl < -1) { toast("これ以上は掘れません", "掘り下げは一段までです。"); return; }
    if (nl < 0 && p.item) { toast("建っている区画は掘れません", "水にするには、まだ何も建てていない区画を選んでください。"); return; }
    p.level = nl;
    rebuildPlot(p);
    for (var i = 0; i < DIRS.length; i++) {
      for (var j2 = -1; j2 <= 1; j2++) {
        var q = plots[pkey(p.i + DIRS[i][0] + (i % 2 ? 0 : j2), p.j + DIRS[i][1] + (i % 2 ? j2 : 0))];
        if (q && q !== p) rebuildPlot(q);
      }
    }
    var g = p.group, y = p.level * STEP;
    g.position.y = y + (dir > 0 ? -0.5 : 0.5);
    tw(0.42, 0, function (u) {
      var e = outBack(u);
      g.position.y = y + (dir > 0 ? -0.5 : 0.5) * (1 - e);
    }, function () { g.position.y = y; renderer.shadowMap.needsUpdate = true; });
    if (selected === p) selectPlot(p);
    burst(p.x, p.z, 8);
    renderUI();
    if (opts.onChange) opts.onChange();
  }

  function turnPlot(p) {
    if (!p || !p.item) return;
    if (p.item === "road") {
      toast("道路の向きは自動です", "となりの道路に合わせて、路面のつながり方が決まります。");
      return;
    }
    p.rot = (p.rot + 1) % 4;
    if (connKind(p.item)) {
      // 線路と駅は、手で決めた向きが優先。向きが合ったとなりとつながる
      var first = !p.manual;
      p.manual = true;
      rebuildPlot(p);
      refreshAround(p);
      var rg = p.group;
      tw(0.32, 0, function (u) {
        var k = 1 + Math.sin(u * Math.PI) * 0.07;
        rg.scale.set(k, k, k);
      }, function () { rg.scale.set(1, 1, 1); renderer.shadowMap.needsUpdate = true; });
      if (first) toast("向きを手で決めました", "この区画は、この向きのまま固定されます。となりと向きが合うと線路がつながります。");
      if (opts.onChange) opts.onChange();
      return;
    }
    var g = p.group, from = g.rotation.y, to = p.rot * Math.PI / 2;
    tw(0.35, 0, function (u) {
      var e = outBack(u);
      g.rotation.y = from + (to - from) * e;
      var k = 1 + Math.sin(u * Math.PI) * 0.04;
      g.scale.set(k, k, k);
    }, function () { g.rotation.y = to; g.scale.set(1, 1, 1); renderer.shadowMap.needsUpdate = true; });
  }

  /* ============================================================
     6.5 注文（お題）
     ------------------------------------------------------------
     次に何をすればいいかを一つだけ出す。達成でポイントが入る。
     ============================================================ */

  function countLevelAtLeast(lv) {
    var n = 0;
    for (var k in plots) if ((plots[k].level || 0) >= lv && !plots[k].master) n++;
    return n;
  }
  function countWater() {
    var n = 0;
    for (var k in plots) if ((plots[k].level || 0) < 0) n++;
    return n;
  }
  function linkedRoads() {
    var n = 0;
    for (var k in plots) {
      var p = plots[k];
      if (p.item !== "road") continue;
      if (nbInfo(p).cnt > 0) n++;
    }
    return n;
  }
  function itemAtLevel(id, lv) {
    for (var k in plots) if (plots[k].item === id && (plots[k].level || 0) >= lv && !plots[k].master) return true;
    return false;
  }
  function nextTo(idA, idB) {
    for (var k in plots) {
      var p = plots[k];
      if (p.item !== idA) continue;
      for (var i = 0; i < DIRS.length; i++) {
        var q = plots[pkey(p.i + DIRS[i][0], p.j + DIRS[i][1])];
        if (q && q.item === idB) return true;
      }
    }
    return false;
  }

  var QUESTS = [
    { t: "荒れ地を3つ整える", d: "まわりの区画をタップして、建てるものを選びます。", r: 80,
      ok: function () { return state.done >= 12; } },
    { t: "道路を3つつなげる", d: "インフラの「道路」をとなり合わせに置くと、路面がつながります。", r: 140,
      ok: function () { return linkedRoads() >= 3; } },
    { t: "市役所を建てる", d: "これがないと土地を広げられません。インフラは2コース修了で開きます。", r: 180,
      ok: function () { return hasHall(); } },
    { t: "区画に段差をつける", d: "区画を選んで「盛る」。高低差のところに擁壁と階段ができます。", r: 150,
      ok: function () { return countLevelAtLeast(1) > 0; } },
    { t: "運河を2つ掘る", d: "何も建てていない区画を選んで「削る」と水になります。", r: 240,
      ok: function () { return countWater() >= 2; } },
    { t: "駅のとなりに商店街", d: "駅に接した区画へ、にぎわいの「商店街」を建てます。", r: 260,
      ok: function () { return nextTo("station", "shops"); } },
    { t: "高台に公園を作る", d: "二段以上に盛った区画へ、住まいの「公園」を建てます。", r: 260,
      ok: function () { return itemAtLevel("park", 2); } },
    { t: "研修センターを建てる", d: "二区画×二区画の大きな施設です。ものづくりは3コース修了で開きます。", r: 320,
      ok: function () { return countItem("campus") > 0; } },
    { t: "ショッピングモールを建てる", d: "にぎわいは1コース修了で開きます。", r: 360,
      ok: function () { return countItem("mall") > 0; } },
    { t: "土地を最大まで広げる", d: "荒れ地をすべて整えると、島がもう一回り大きくなります。", r: 600,
      ok: function () { return state.ext >= MAX_EXT; } },
  ];

  function checkQuest() {
    var q = QUESTS[state.quest];
    if (!q || !q.ok()) return;
    state.quest++;
    toast("お題を達成しました：" + q.t, QUESTS[state.quest] ? "次のお題は「" + QUESTS[state.quest].t + "」です。" : "お題はこれで最後です。");
    burst(0, 0, 24);
    renderQuest();
    renderUI();
    if (opts.onChange) opts.onChange();
  }

  /* ============================================================
     6.7 街のにぎわい
     ------------------------------------------------------------
     整えた区画が増えるほど、人と車が増える。
     ============================================================ */

  var lifeGroup = new THREE.Group();
  scene.add(lifeGroup);
  var walkers = [], drivers = [];

  function makeWalkerMesh(hex) {
    var b = new Builder();
    b.add(cyl(0.16, 0.2, 0.62, 6), M(0, 0, 0, 0), hex);
    b.add(box(0.34, 0.34, 0.26, 0.12), M(0, 0.62, 0, 0), 0xF0CBA8);
    b.add(blob(0.16), M(0, 0.78, 0, 0), 0x4A3A2E);
    return b.mesh(solidMat, false);
  }
  function makeCarMesh(hex) {
    var b = new Builder();
    b.add(box(0.95, 0.4, 1.8, 0.16), M(0, 0.16, 0, 0), hex);
    b.add(box(0.85, 0.34, 0.85, 0.14), M(0, 0.54, -0.1, 0), hex);
    for (var w = 0; w < 4; w++) {
      b.add(cyl(0.19, 0.19, 0.13, 8), MR((w % 2 ? 0.48 : -0.48), 0.19, (w < 2 ? 0.58 : -0.58), 0, 0, Math.PI / 2), C.dark);
    }
    return b.mesh(solidMat, false);
  }
  (function () {
    var cols = [0xE8705F, 0x5DA9DE, 0xF2C14E, 0xF5F0E6, 0x6FBF8E, 0x9A8BD6];
    for (var i = 0; i < 12; i++) {
      var m = makeWalkerMesh([0x5B7FB8, 0xC85F6B, 0x5E9E72, 0xC9A24E, 0x7E6FAE][i % 5]);
      m.visible = false;
      lifeGroup.add(m);
      walkers.push({ mesh: m, axis: i % 2, lane: 0, pos: 0, sp: 1.6 + Math.random() * 0.8, dir: Math.random() < 0.5 ? 1 : -1 });
    }
    for (var c = 0; c < 7; c++) {
      var cm = makeCarMesh(cols[c % cols.length]);
      cm.visible = false;
      lifeGroup.add(cm);
      drivers.push({ mesh: cm, axis: c % 2, lane: 0, pos: 0, sp: 5.0 + Math.random() * 2.4, dir: Math.random() < 0.5 ? 1 : -1 });
    }
  })();

  function laneFor(n) { return (n - 0.5) * PLOT; }
  function placeLife(e, isCar) {
    var g = state.ext;
    var n = Math.floor(Math.random() * (g * 2 + 2)) - g;
    e.lane = laneFor(n) + (isCar ? e.dir * 0.42 : (e.dir > 0 ? 0.62 : -0.62));
    e.pos = (Math.random() - 0.5) * (g * 2 + 1) * PLOT;
    e.axis = Math.random() < 0.5 ? 0 : 1;
  }
  function stepLife(dt) {
    var want = Math.min(walkers.length, Math.floor(state.done / 2));
    var wantCar = Math.min(drivers.length, Math.floor(state.done / 5));
    var lim = (state.ext + 0.5) * PLOT + 2;
    for (var i = 0; i < walkers.length; i++) {
      var e = walkers[i], on = i < want;
      e.mesh.visible = on;
      if (!on) continue;
      if (!e.ready) { placeLife(e, false); e.ready = 1; }
      e.pos += e.sp * e.dir * dt;
      if (e.pos > lim || e.pos < -lim) { e.dir *= -1; placeLife(e, false); }
      if (e.axis === 0) e.mesh.position.set(e.pos, -0.22, e.lane);
      else e.mesh.position.set(e.lane, -0.22, e.pos);
      e.mesh.rotation.y = e.axis === 0 ? (e.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (e.dir > 0 ? 0 : Math.PI);
    }
    for (var c = 0; c < drivers.length; c++) {
      var v = drivers[c], onc = c < wantCar;
      v.mesh.visible = onc;
      if (!onc) continue;
      if (!v.ready) { placeLife(v, true); v.ready = 1; }
      v.pos += v.sp * v.dir * dt;
      if (v.pos > lim || v.pos < -lim) { v.dir *= -1; placeLife(v, true); }
      if (v.axis === 0) v.mesh.position.set(v.pos, -0.22, v.lane);
      else v.mesh.position.set(v.lane, -0.22, v.pos);
      v.mesh.rotation.y = v.axis === 0 ? (v.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (v.dir > 0 ? 0 : Math.PI);
    }
  }

  /* ============================================================
     7. 操作
     ============================================================ */

  var ray = new THREE.Raycaster();
  var ndc = new THREE.Vector2();
  var dragging = null, moved = 0, hoverPlot = null;

  function toNdc(e) {
    var r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }
  function pickPlot() {
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(pads, false);
    return hits.length ? hits[0].object.userData.plot : null;
  }

  stage.addEventListener("pointerdown", function (e) {
    toNdc(e);
    stage.setPointerCapture(e.pointerId);
    dragging = { x: e.clientX, y: e.clientY };
    moved = 0;
  });
  stage.addEventListener("pointermove", function (e) {
    toNdc(e);
    if (dragging) {
      var dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      moved += Math.abs(dx) + Math.abs(dy);
      viewT.az -= dx * 0.006;
      viewT.pol = THREE.MathUtils.clamp(viewT.pol - dy * 0.005, 0.30, 1.32);
      dragging.x = e.clientX; dragging.y = e.clientY;
    } else {
      hoverPlot = pickPlot();
      canvas.style.cursor = hoverPlot ? "pointer" : "grab";
    }
  });
  stage.addEventListener("pointerup", function (e) {
    if (dragging && moved < 8) {
      toNdc(e);
      var p = pickPlot();
      if (p) selectPlot(p);
      else selectPlot(null);
    }
    dragging = null;
  });
  stage.addEventListener("pointercancel", function () { dragging = null; });
  stage.addEventListener("wheel", function (e) {
    e.preventDefault();
    viewT.dist = THREE.MathUtils.clamp(viewT.dist + e.deltaY * 0.09, 32, 230);
  }, { passive: false });

  function fitCamera(instant, whole) {
    var e = state.ext;
    if (!whole) {
      // 建っているところだけを画に入れる
      var m = 1;
      for (var k in plots) {
        var p = plots[k];
        if (!p.item) continue;
        m = Math.max(m, Math.abs(p.i), Math.abs(p.j));
      }
      e = Math.min(state.ext, m);
    }
    var S = (e * 2 + 1) * PLOT + (whole ? 0 : PLOT * 0.9);
    var fit = Math.min(2.1, Math.max(1, 1.3 / Math.max(0.3, camera.aspect)));
    viewT.dist = (S * 1.0 + 14) * fit;
    viewT.ty = (camera.aspect < 1 ? bias - 5 : bias);
    viewT.tx = 0; viewT.tz = 0;
    fitDist = viewT.dist;
    if (instant) { view.dist = viewT.dist; view.ty = viewT.ty; view.tx = 0; view.tz = 0; }
  }
  var fitDist = 88;

  // 選んだ区画をまん中に置いて、少しだけ寄る。
  // **遠くの区画を選んだときに、何を触っているのか分かるようにする。**
  function focusOn(p) {
    if (!p) { viewT.tx = 0; viewT.tz = 0; viewT.ty = (camera.aspect < 1 ? bias - 5 : bias); return; }
    var big = p.span === 2;
    viewT.tx = p.x + (big ? PLOT / 2 : 0);
    viewT.tz = p.z + (big ? PLOT / 2 : 0);
    viewT.ty = (p.level || 0) * STEP + bias * 0.4;
    // すでに寄っているときは、そのままの距離を保つ
    var want = Math.max(26, fitDist * 0.58);
    if (viewT.dist > want) viewT.dist = want;
  }

  /* ============================================================
     8. 画面の文字まわり
     ============================================================ */

  var selScale = 1;
  function selectPlot(p) {
    if (p && p.master) p = plots[p.master];
    selected = p;
    if (p) {
      var big = p.span === 2;
      selRing.position.set(p.x + (big ? PLOT / 2 : 0), (p.level || 0) * STEP - 0.52, p.z + (big ? PLOT / 2 : 0));
      selScale = big ? (BIG + 1.1) / (TILE + 1.1) : 1;
      selRing.scale.set(selScale, 1, selScale);
      selRing.visible = true;
      focusOn(p);
    } else {
      selRing.visible = false;
      focusOn(null);
    }
    renderCatalog();
  }

  // 選んでいる区画の様子を外へ知らせる（画面はReactが描く）
  function renderCatalog() {
    if (!opts.onSelect) return;
    var p = selected;
    opts.onSelect(p ? {
      i: p.i, j: p.j, item: p.item, level: p.level || 0, span: p.span === 2,
      water: (p.level || 0) < 0, rot: p.rot || 0, manual: !!p.manual, cost: p.item ? 0 : costNow(),
    } : null);
  }

  function renderUI() {
    if (!opts.onStats) return;
    var cost = costNow();
    opts.onStats({
      pt: Math.floor(state.pt), cost: cost, rate: incomeNow(),
      done: state.done, left: countLeft(), ext: state.ext, maxExt: MAX_EXT,
      hall: hasHall(), depot: Math.min(3, countItem("depot")),
      campus: Math.min(2, countItem("campus")), station: countItem("station"),
      quest: state.quest, questTotal: QUESTS.length,
      questText: QUESTS[state.quest] ? QUESTS[state.quest].t : "",
      questSub: QUESTS[state.quest] ? QUESTS[state.quest].d : "",
      dusk: state.dusk,
    });
  }
  function renderQuest() { renderUI(); }

  /* ============================================================
     9. 後処理（明るいところを拾って、にじませて、色を作る）
     ============================================================ */

  var rtOpts = {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false,
  };
  var rtScene = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false,
  });
  var rtA = new THREE.WebGLRenderTarget(2, 2, rtOpts), rtB = new THREE.WebGLRenderTarget(2, 2, rtOpts);
  var rtE = new THREE.WebGLRenderTarget(2, 2, rtOpts), rtF = new THREE.WebGLRenderTarget(2, 2, rtOpts);
  var SS = 1.0;   // 端末によっては重いので、等倍で描く

  var quadScene = new THREE.Scene();
  var quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quadScene.add(quad);
  var VQ = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

  var brightMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uThresh: { value: 0.88 } },
    vertexShader: VQ,
    fragmentShader: [
      "uniform sampler2D tDiffuse; uniform float uThresh; varying vec2 vUv;",
      "void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;",
      "  float l = dot(c, vec3(0.2126,0.7152,0.0722));",
      "  float k = max(l - uThresh, 0.0) / max(l, 0.0001);",
      "  gl_FragColor = vec4(c * k, 1.0); }",
    ].join("\n"),
  });
  var blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: { value: new THREE.Vector2(1, 1) } },
    vertexShader: VQ,
    fragmentShader: [
      "uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uTexel; varying vec2 vUv;",
      "void main(){ vec2 o = uDir * uTexel;",
      "  vec3 s = texture2D(tDiffuse, vUv).rgb * 0.2270270;",
      "  s += texture2D(tDiffuse, vUv + o * 1.3846153).rgb * 0.3162162;",
      "  s += texture2D(tDiffuse, vUv - o * 1.3846153).rgb * 0.3162162;",
      "  s += texture2D(tDiffuse, vUv + o * 3.2307692).rgb * 0.0702702;",
      "  s += texture2D(tDiffuse, vUv - o * 3.2307692).rgb * 0.0702702;",
      "  gl_FragColor = vec4(s, 1.0); }",
    ].join("\n"),
  });
  var compMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null }, tBloomA: { value: null }, tSoft: { value: null },
      uBloom: { value: 0.16 }, uExposure: { value: 0.9 }, uSat: { value: 1.08 },
      uTint: { value: new THREE.Color("#FFF6EA") }, uVig: { value: 0.3 },
      uShadow: { value: new THREE.Color("#8FA8CF") }, uHigh: { value: new THREE.Color("#FFEBC8") },
      uFocus: { value: 0.5 }, uSoft: { value: 0.72 }, uCA: { value: 0.0018 },
    },
    vertexShader: VQ,
    fragmentShader: [
      "uniform sampler2D tScene; uniform sampler2D tBloomA; uniform sampler2D tSoft;",
      "uniform float uBloom; uniform float uExposure; uniform float uSat; uniform float uVig;",
      "uniform float uFocus; uniform float uSoft; uniform float uCA;",
      "uniform vec3 uTint; uniform vec3 uShadow; uniform vec3 uHigh;",
      "varying vec2 vUv;",
      "vec3 aces(vec3 x){ float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }",
      "void main(){",
      "  vec2 dv = vUv - 0.5; float r2 = dot(dv, dv);",
      "  vec2 off = dv * uCA * (0.4 + r2 * 3.0);",
      "  vec3 sharp = vec3(texture2D(tScene, vUv + off).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - off).b);",
      "  vec3 soft = texture2D(tSoft, vUv).rgb;",
      "  float m = smoothstep(0.10, 0.40, abs(vUv.y - uFocus)) * uSoft;",
      "  vec3 col = mix(sharp, soft, m);",
      "  vec3 bl = texture2D(tBloomA, vUv).rgb * 1.5;",
      "  col += bl * uBloom;",
      "  col *= mix(vec3(1.0), uTint, 0.25);",
      "  col = aces(col * uExposure);",
      "  float l = dot(col, vec3(0.2126,0.7152,0.0722));",
      "  col = mix(col, col * uShadow, (1.0 - l) * 0.22);",
      "  col = mix(col, col * uHigh, l * 0.14);",
      "  l = dot(col, vec3(0.2126,0.7152,0.0722));",
      "  col = mix(vec3(l), col, uSat);",
      "  col = clamp((col - 0.5) * 1.04 + 0.5, 0.0, 1.0);",
      "  col *= clamp(1.0 - uVig * r2 * 2.4, 0.0, 1.0);",
      "  col = pow(max(col, vec3(0.0)), vec3(1.0/2.2));",
      "  float g = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);",
      "  col += (g - 0.5) * 0.022;",
      "  gl_FragColor = vec4(col, 1.0); }",
    ].join("\n"),
  });
  function pass(mat, target) {
    quad.material = mat;
    renderer.setRenderTarget(target || null);
    renderer.render(quadScene, quadCam);
  }

  function resize() {
    var w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    var pr = renderer.getPixelRatio();
    var fw = Math.max(2, Math.floor(w * pr * SS)), fh = Math.max(2, Math.floor(h * pr * SS));
    rtScene.setSize(fw, fh);
    rtA.setSize(Math.max(2, fw >> 2), Math.max(2, fh >> 2));
    rtB.setSize(Math.max(2, fw >> 2), Math.max(2, fh >> 2));
    rtE.setSize(Math.max(2, fw >> 1), Math.max(2, fh >> 1));
    rtF.setSize(Math.max(2, fw >> 1), Math.max(2, fh >> 1));
  }
  function onWinResize() { resize(); fitCamera(); }
  window.addEventListener("resize", onWinResize);

  /* ============================================================
     10. 動かす
     ============================================================ */

  var clock = new THREE.Clock();
  var uiTick = 0, shadowTick = 0, envDusk = false;

  function step(dt) {
    dt = Math.min(0.05, dt);

    // ポイント
    state.pt += incomeNow() * dt;
    uiTick += dt;
    if (uiTick > 0.12) { uiTick = 0; renderUI(); checkQuest(); }
    stepLife(dt);

    // 時間帯
    var d = state.dusk ? 1 : 0;
    sun.intensity = THREE.MathUtils.lerp(1.45, 0.85, d);
    sun.color.set(state.dusk ? "#FFB469" : "#FFEBC0");
    sun.position.set(state.dusk ? -54 : 54, state.dusk ? 20 : 46, state.dusk ? 28 : 30);
    hemi.intensity = THREE.MathUtils.lerp(0.42, 0.34, d);
    hemi.color.set(state.dusk ? "#7D93C8" : "#C9E4F7");
    hemi.groundColor.set(state.dusk ? "#6B5B4E" : "#8A7A5E");
    rim.intensity = state.dusk ? 0.32 : 0.2;
    litMat.envMapIntensity = state.dusk ? 0.5 : 2.2;
    water.material.specular.set(state.dusk ? "#C89A72" : "#9FC8DE");
    rim.color.set(state.dusk ? "#FFC9A0" : "#DCEEFF");
    skyU.uTop.value.set(state.dusk ? "#2F4E8C" : "#4E9BD8");
    skyU.uBottom.value.set(state.dusk ? "#FBCE92" : "#E2F3FC");
    skyU.uSunCol.value.set(state.dusk ? "#FFB26B" : "#FFF0CC");
    skyU.uSun.value.set(sun.position.x, sun.position.y, sun.position.z).normalize();
    scene.fog.color.set(state.dusk ? "#EFC79A" : "#C6E6F5");
    renderer.setClearColor(state.dusk ? 0xEFC79A : 0xC6E6F5, 1);
    water.material.color.set(state.dusk ? "#2E5D82" : "#3FA3CE");
    litMat.color.set(state.dusk ? "#FFE3A0" : "#BFD2DE");
    litMat.emissive.set(state.dusk ? "#FFB964" : "#000000");
    litMat.emissiveIntensity = state.dusk ? 1.1 : 0.0;
    shine.material.opacity = state.dusk ? 0.22 : 0.16;
    if (cloudMat) cloudMat.emissive.set(state.dusk ? "#E8B183" : "#C6DCEE");

    if (!envDusk) { envDusk = true; updateEnv(); renderer.shadowMap.needsUpdate = true; }

    // 雲と水面
    var t = clock.elapsedTime;
    cloudGroup.children.forEach(function (c) {
      c.position.x += c.userData.sp * dt;
      if (c.position.x > 240) c.position.x = -240;
    });
    shineTex.offset.x = t * 0.0045;
    shineTex.offset.y = Math.sin(t * 0.12) * 0.01;

    // ふわっと浮く演出
    var active = tweens.length > 0;
    for (var i = tweens.length - 1; i >= 0; i--) {
      var twn = tweens[i];
      twn.t += dt;
      if (twn.t < 0) continue;
      var u = Math.min(1, twn.t / twn.d);
      twn.fn(u);
      if (u >= 1) { if (twn.end) twn.end(); tweens.splice(i, 1); }
    }
    if (active) { shadowTick++; if (shadowTick % 3 === 0) renderer.shadowMap.needsUpdate = true; }

    // きらめき
    for (var s = 0; s < sparks.length; s++) {
      var sk = sparks[s];
      if (!sk.visible) continue;
      sk.userData.life -= dt;
      if (sk.userData.life <= 0) { sk.visible = false; continue; }
      sk.position.x += sk.userData.vx * dt;
      sk.position.y += sk.userData.vy * dt;
      sk.position.z += sk.userData.vz * dt;
      sk.userData.vy -= 11 * dt;
      sk.material.opacity = Math.max(0, sk.userData.life / sk.userData.max);
    }

    // 触れている区画を持ち上げる
    for (var k in plots) {
      var p = plots[k];
      var want = (p === hoverPlot && !dragging) ? 1 : 0;
      p.hover += (want - p.hover) * Math.min(1, dt * 12);
      if ((p.hover > 0.002 || want) && !p.busy) p.group.position.y = (p.level || 0) * STEP + p.hover * 0.5;
    }
    if (selRing.visible) {
      var bs = selScale * (1 + Math.sin(t * 4.2) * 0.02);
      selRing.scale.set(bs, 1, bs);
      selRing.material.opacity = 0.75 + Math.sin(t * 4.2) * 0.2;
    }

    // カメラ
    view.az += (viewT.az - view.az) * Math.min(1, dt * 6);
    view.pol += (viewT.pol - view.pol) * Math.min(1, dt * 6);
    view.dist += (viewT.dist - view.dist) * Math.min(1, dt * 4);
    view.ty += (viewT.ty - view.ty) * Math.min(1, dt * 4);
    view.tx += (viewT.tx - view.tx) * Math.min(1, dt * 4);
    view.tz += (viewT.tz - view.tz) * Math.min(1, dt * 4);
    var sp = Math.sin(view.pol), cp = Math.cos(view.pol);
    camera.position.set(
      view.tx + Math.sin(view.az) * sp * view.dist,
      cp * view.dist + view.ty,
      view.tz + Math.cos(view.az) * sp * view.dist
    );
    camera.lookAt(view.tx, view.ty, view.tz);
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();

    renderer.setRenderTarget(rtScene);
    renderer.clear();
    renderer.render(scene, camera);

    brightMat.uniforms.tDiffuse.value = rtScene.texture;
    brightMat.uniforms.uThresh.value = state.dusk ? 0.62 : 0.9;
    pass(brightMat, rtA);
    blurMat.uniforms.tDiffuse.value = rtA.texture;
    blurMat.uniforms.uDir.value.set(1, 0);
    blurMat.uniforms.uTexel.value.set(1.6 / rtA.width, 1.6 / rtA.height);
    pass(blurMat, rtB);
    blurMat.uniforms.tDiffuse.value = rtB.texture;
    blurMat.uniforms.uDir.value.set(0, 1);
    pass(blurMat, rtA);

    // ミニチュア風のぼかし（一往復だけ）
    if (soften) {
      blurMat.uniforms.tDiffuse.value = rtScene.texture;
      blurMat.uniforms.uDir.value.set(1, 0);
      blurMat.uniforms.uTexel.value.set(2.0 / rtE.width, 2.0 / rtE.height);
      pass(blurMat, rtF);
      blurMat.uniforms.tDiffuse.value = rtF.texture;
      blurMat.uniforms.uDir.value.set(0, 1);
      pass(blurMat, rtE);
    }

    compMat.uniforms.tScene.value = rtScene.texture;
    compMat.uniforms.tSoft.value = soften ? rtE.texture : rtScene.texture;
    compMat.uniforms.uSoft.value = soften ? 0.72 : 0.0;
    compMat.uniforms.tBloomA.value = rtA.texture;
    compMat.uniforms.uFocus.value = camera.aspect < 1 ? 0.56 : 0.52;
    compMat.uniforms.uBloom.value = state.dusk ? 0.34 : 0.14;
    compMat.uniforms.uExposure.value = state.dusk ? 1.1 : 0.9;
    compMat.uniforms.uTint.value.set(state.dusk ? "#FFDCA8" : "#FFF4E2");
    compMat.uniforms.uShadow.value.set(state.dusk ? "#6E7FB8" : "#8FA8CF");
    compMat.uniforms.uHigh.value.set(state.dusk ? "#FFCE96" : "#FFEBC8");
    pass(compMat, null);
  }

  // 実際のコマ落ちを見て、重ければ自分で画質を下げる
  var soften = true, quality = 2, fpsAcc = 0, fpsN = 0, slowRuns = 0, warmup = 90;
  function watchSpeed(dt) {
    if (warmup > 0) { warmup--; return; }
    fpsAcc += dt; fpsN++;
    if (fpsN < 45) return;
    var avg = fpsAcc / fpsN;
    fpsAcc = 0; fpsN = 0;
    slowRuns = avg > 0.034 ? slowRuns + 1 : 0;
    if (slowRuns >= 2 && quality > 0) {
      slowRuns = 0;
      quality--;
      if (quality === 1) { renderer.setPixelRatio(1); resize(); }
      else { soften = false; renderer.setPixelRatio(0.85); resize(); }
    }
  }


  var rafId = 0, alive = true;
  function frameLoop() {
    if (!alive) return;
    var dt = clock.getDelta();
    watchSpeed(dt);
    step(dt);
    rafId = requestAnimationFrame(frameLoop);
  }

  resetWorld();
  renderCatalog();
  renderQuest();
  resize();
  rafId = requestAnimationFrame(frameLoop);

  /* ============================================================
     外から触るところ
     ============================================================ */

  function findPlot(i, j) { return plots[pkey(i, j)] || null; }

  return {
    // 操作
    select: function (i, j) { selectPlot(findPlot(i, j)); },
    clearSelect: function () { selectPlot(null); },
    place: function (id) { if (selected) place(selected, id); },
    turn: function () { turnPlot(selected); },
    level: function (d) { levelPlot(selected, d); },
    auto: function () {
      if (!selected) { toast("区画をタップしてください", "選んだ区画に、解放ずみの施設からひとつ選んで建てます。"); return; }
      var list = openItems();
      if (list.length) place(selected, list[Math.floor(Math.random() * list.length)].id);
    },
    setDusk: function (v) { state.dusk = !!v; renderUI(); },
    // 画面の大きさが変わったとき（拡大・全画面の切り替え）
    resize: function () { resize(); fitCamera(); },
    // 下にパネルがある画面ほど街を上へ逃がす
    setBias: function (n) { bias = Number(n) || 0; fitCamera(); },
    fit: function (whole) { fitCamera(false, !!whole); },
    reset: function () { resetWorld(); },

    // 学びの反映
    setUnlocked: function (ids) {
      state.unlocked = { live: true };
      (ids || []).forEach(function (id) { state.unlocked[id] = true; });
      renderCatalog();
      renderUI();
    },
    setPoints: function (n) { state.pt = Math.max(0, Number(n) || 0); renderUI(); },
    openItems: openItems,

    // 保存と復元
    getState: function () {
      var list = [];
      for (var k in plots) {
        var p = plots[k];
        if (!p.item && !(p.level || 0) && !p.master && !p.span) continue;
        list.push({
          i: p.i, j: p.j, it: p.item || "", lv: p.level || 0, ro: p.rot || 0,
          mn: p.manual ? 1 : 0, mt: p.master || "", sp: p.span || 0, sd: p.seed | 0,
        });
      }
      return { ext: state.ext, quest: state.quest, done: state.done, spent: state.spent || 0, plots: list };
    },
    applyState: function (saved) {
      if (!saved || !Array.isArray(saved.plots)) return false;
      applySaved(saved);
      return true;
    },
    onSpend: function (fn) { opts.onSpend = fn; },

    // 後片付け
    dispose: function () {
      alive = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onWinResize);
      scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      [rtScene, rtA, rtB, rtE, rtF].forEach(function (rt) { rt.dispose(); });
      if (envRT) envRT.dispose();
      renderer.dispose();
    },
  };

  // 保存から組み直す
  function applySaved(saved) {
    for (var k in plots) {
      disposeGroup(plots[k].group);
      if (plots[k].pad) land.remove(plots[k].pad);
    }
    plots = {};
    pads.length = 0;
    selected = null;
    selRing.visible = false;
    state.ext = Math.max(START_EXT, Math.min(MAX_EXT, Number(saved.ext) || START_EXT));
    state.quest = Math.max(0, Math.min(QUESTS.length, Number(saved.quest) || 0));
    state.done = Math.max(0, Number(saved.done) || 0);
    state.spent = Math.max(0, Number(saved.spent) || 0);
    var by = {};
    (saved.plots || []).forEach(function (r) { by[r.i + "," + r.j] = r; });
    for (var i = -state.ext; i <= state.ext; i++) {
      for (var j = -state.ext; j <= state.ext; j++) {
        var r = by[i + "," + j];
        var p = addPlot(i, j, r && r.it ? r.it : null);
        if (r) {
          p.level = Math.max(-1, Math.min(3, Number(r.lv) || 0));
          p.rot = Math.max(0, Math.min(3, Number(r.ro) || 0));
          p.manual = !!r.mn;
          p.master = r.mt || null;
          p.span = Number(r.sp) || 0;
          if (r.sd) p.seed = r.sd | 0;
        }
      }
    }
    // 中身は高さと向きが揃ってから組み直す
    for (var k2 in plots) {
      var q = plots[k2];
      if (q.master) { disposeGroup(q.group); q.group = new THREE.Group(); plotGroup.add(q.group); continue; }
      rebuildPlot(q);
    }
    for (var k3 in plots) {
      var m = plots[k3];
      if (m.span === 2) {
        disposeGroup(m.group);
        var g = makeGroup(m.item, m.seed, { nb: { n: 0, e: 0, s: 0, w: 0 }, cnt: 0, rot: 0, level: 0, nlv: null });
        g.position.set(m.i * PLOT + PLOT / 2, 0, m.j * PLOT + PLOT / 2);
        plotGroup.add(g);
        m.group = g;
      }
    }
    buildGround();
    fitCamera(true);
    renderCatalog();
    renderQuest();
    renderUI();
    renderer.shadowMap.needsUpdate = true;
  }
}
