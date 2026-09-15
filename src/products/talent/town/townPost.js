import * as THREE from "three";

/* 後処理：光のにじみ・トーン・色味。
 *
 * three の core だけで組む（EffectComposer は examples 側で、CSP・依存の両方で重い）。
 * 描画先を自前で持ち、明るいところだけ抜き出してぼかし、最後にまとめて合成する。 */

const VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT = `
uniform sampler2D tSrc; uniform float thresh; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = max(0.0, l - thresh) / max(l, 0.0001);
  gl_FragColor = vec4(c * k, 1.0);
}`;

const BLUR = `
uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec4 s = texture2D(tSrc, vUv) * 0.2270270270;
  s += texture2D(tSrc, vUv + dir * 1.3846153846) * 0.3162162162;
  s += texture2D(tSrc, vUv - dir * 1.3846153846) * 0.3162162162;
  s += texture2D(tSrc, vUv + dir * 3.2307692308) * 0.0702702703;
  s += texture2D(tSrc, vUv - dir * 3.2307692308) * 0.0702702703;
  gl_FragColor = s;
}`;

const COMP = `
uniform sampler2D tSrc; uniform sampler2D tBloomA; uniform sampler2D tBloomB;
uniform float exposure; uniform float bloom; uniform vec3 warm; uniform float vig;
uniform float sat; uniform float lift;
varying vec2 vUv;
vec3 aces(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
void main(){
  vec3 col = texture2D(tSrc, vUv).rgb;
  vec3 bl = texture2D(tBloomA, vUv).rgb * 0.62 + texture2D(tBloomB, vUv).rgb * 0.38;
  col += bl * bloom;
  col *= exposure;
  col *= warm;
  col = aces(col);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, sat);
  col += lift * vec3(0.06, 0.05, 0.08) * (1.0 - l);
  vec2 q = vUv - 0.5;
  float v = 1.0 - dot(q, q) * vig;
  col *= clamp(v, 0.0, 1.0);
  col = pow(max(col, 0.0), vec3(0.4545454545));
  gl_FragColor = vec4(col, 1.0);
}`;

function fsQuad(mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(m);
  return { scene: sc, mesh: m };
}

export function createPost(renderer) {
  const P = { ok: false };
  try {
    const opt = {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: THREE.HalfFloatType,
      depthBuffer: true, stencilBuffer: false,
    };
    P.main = new THREE.WebGLRenderTarget(2, 2, opt);
    const bopt = { ...opt, depthBuffer: false };
    P.b1 = new THREE.WebGLRenderTarget(2, 2, bopt);
    P.b2 = new THREE.WebGLRenderTarget(2, 2, bopt);
    P.b3 = new THREE.WebGLRenderTarget(2, 2, bopt);
    P.b4 = new THREE.WebGLRenderTarget(2, 2, bopt);

    P.mBright = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, thresh: { value: 0.9 } },
      vertexShader: VERT, fragmentShader: BRIGHT, depthTest: false, depthWrite: false,
    });
    P.mBlur = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: VERT, fragmentShader: BLUR, depthTest: false, depthWrite: false,
    });
    P.mComp = new THREE.ShaderMaterial({
      uniforms: {
        tSrc: { value: null }, tBloomA: { value: null }, tBloomB: { value: null },
        exposure: { value: 1.0 }, bloom: { value: 0.4 },
        warm: { value: new THREE.Vector3(1.035, 1.0, 0.965) },
        vig: { value: 0.74 }, sat: { value: 1.12 }, lift: { value: 0.2 },
      },
      vertexShader: VERT, fragmentShader: COMP, depthTest: false, depthWrite: false,
    });
    P.qBright = fsQuad(P.mBright);
    P.qBlur = fsQuad(P.mBlur);
    P.qComp = fsQuad(P.mComp);
    P.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    P.ok = true;
  } catch { P.ok = false; }

  P.setSize = (w, h) => {
    if (!P.ok) return;
    P.main.setSize(w, h);
    const a = Math.max(2, Math.floor(w / 4)), b = Math.max(2, Math.floor(h / 4));
    P.b1.setSize(a, b); P.b2.setSize(a, b);
    const c = Math.max(2, Math.floor(w / 9)), d = Math.max(2, Math.floor(h / 9));
    P.b3.setSize(c, d); P.b4.setSize(c, d);
  };

  /* 時間帯で色味を動かす。強すぎると画面全体が霞んで、かえって安っぽくなる */
  P.grade = (dark, dusk, strength) => {
    if (!P.ok) return;
    const k = strength == null ? 1 : strength;
    const u = P.mComp.uniforms;
    u.bloom.value = (0.22 + dark * 0.30 + dusk * 0.14) * k;
    u.exposure.value = 1.0 + dark * 0.06;
    u.sat.value = 1.10 + dusk * 0.14 - dark * 0.04;
    u.lift.value = 0.08 + dark * 0.16;
    u.vig.value = 0.74 * k;
    u.warm.value.set(
      1.035 + dusk * 0.075 - dark * 0.05,
      1.0,
      0.965 - dusk * 0.055 + dark * 0.075,
    );
    P.mBright.uniforms.thresh.value = 1.05 - dark * 0.25;
  };

  P.render = (scene, camera) => {
    if (!P.ok) { renderer.render(scene, camera); return; }
    const oldTone = renderer.toneMapping, oldCS = renderer.outputColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setRenderTarget(P.main);
    renderer.clear();
    renderer.render(scene, camera);

    P.mBright.uniforms.tSrc.value = P.main.texture;
    renderer.setRenderTarget(P.b1);
    renderer.render(P.qBright.scene, P.cam);

    const px = 1 / P.b1.width, py = 1 / P.b1.height;
    P.mBlur.uniforms.tSrc.value = P.b1.texture;
    P.mBlur.uniforms.dir.value.set(px, 0);
    renderer.setRenderTarget(P.b2); renderer.render(P.qBlur.scene, P.cam);
    P.mBlur.uniforms.tSrc.value = P.b2.texture;
    P.mBlur.uniforms.dir.value.set(0, py);
    renderer.setRenderTarget(P.b1); renderer.render(P.qBlur.scene, P.cam);

    P.mBright.uniforms.tSrc.value = P.b1.texture;
    renderer.setRenderTarget(P.b3); renderer.render(P.qBright.scene, P.cam);
    const qx = 1 / P.b3.width, qy = 1 / P.b3.height;
    P.mBlur.uniforms.tSrc.value = P.b3.texture;
    P.mBlur.uniforms.dir.value.set(qx * 2, 0);
    renderer.setRenderTarget(P.b4); renderer.render(P.qBlur.scene, P.cam);
    P.mBlur.uniforms.tSrc.value = P.b4.texture;
    P.mBlur.uniforms.dir.value.set(0, qy * 2);
    renderer.setRenderTarget(P.b3); renderer.render(P.qBlur.scene, P.cam);

    P.mComp.uniforms.tSrc.value = P.main.texture;
    P.mComp.uniforms.tBloomA.value = P.b1.texture;
    P.mComp.uniforms.tBloomB.value = P.b3.texture;
    renderer.setRenderTarget(null);
    renderer.render(P.qComp.scene, P.cam);

    renderer.toneMapping = oldTone;
    renderer.outputColorSpace = oldCS;
  };

  P.dispose = () => {
    if (!P.ok) return;
    [P.main, P.b1, P.b2, P.b3, P.b4].forEach(t => t.dispose());
    [P.mBright, P.mBlur, P.mComp].forEach(m => m.dispose());
  };
  return P;
}
