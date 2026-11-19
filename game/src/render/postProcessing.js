// Hand-written post chain: HDR scene target -> bright pass -> separable blur (bloom) -> filmic tone map,
// warm colour grade, vignette and sRGB output. No three.js addons are used.
import * as THREE from 'three';

const FULLSCREEN_VS = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT_FS = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D tScene; uniform float threshold;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(threshold, threshold + 0.9, l), 1.0);
}`;

const BLUR_FS = /* glsl */`
precision highp float; varying vec2 vUv; uniform sampler2D tInput; uniform vec2 direction;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb * 0.227027;
  c += (texture2D(tInput, vUv + direction * 1.3846) .rgb + texture2D(tInput, vUv - direction * 1.3846).rgb) * 0.316216;
  c += (texture2D(tInput, vUv + direction * 3.2308) .rgb + texture2D(tInput, vUv - direction * 3.2308).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}`;

const COMPOSITE_FS = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tScene; uniform sampler2D tBloomA; uniform sampler2D tBloomB;
uniform float exposure; uniform float bloomStrength; uniform float vignette; uniform float saturation; uniform vec3 tint;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  vec3 bloom = texture2D(tBloomA, vUv).rgb * 0.6 + texture2D(tBloomB, vUv).rgb * 0.9;
  c += bloom * bloomStrength;
  c *= exposure * tint;
  c = aces(c * 0.82);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  // split tone: teal-violet shadows, warm highlights
  c += vec3(0.012, 0.0, 0.03) * (1.0 - l) - vec3(0.0, 0.004, 0.02) * l;
  vec2 q = vUv - 0.5;
  c *= 1.0 - vignette * dot(q, q) * 1.6;
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  gl_FragColor = vec4(c, 1.0);
}`;

export class PostProcessing {
  constructor(renderer) {
    this.renderer = renderer;
    this.exposure = 1; this.bloomStrength = 0.55; this.threshold = 1.05; this.enabled = true;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene(); this.quadScene.add(this.quad);
    const mk = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
    this.brightMat = mk(BRIGHT_FS, { tScene: { value: null }, threshold: { value: 1 } });
    this.blurMat = mk(BLUR_FS, { tInput: { value: null }, direction: { value: new THREE.Vector2() } });
    this.compositeMat = mk(COMPOSITE_FS, {
      tScene: { value: null }, tBloomA: { value: null }, tBloomB: { value: null }, exposure: { value: 1 }, bloomStrength: { value: 0.5 },
      vignette: { value: 0.55 }, saturation: { value: 1.12 }, tint: { value: new THREE.Color(1.0, 1.0, 1.0) },
    });
    this.targets = null;
  }

  setSize(w, h, pixelRatio = 1) {
    const W = Math.max(2, Math.floor(w * pixelRatio)), H = Math.max(2, Math.floor(h * pixelRatio));
    if (this.targets) for (const t of Object.values(this.targets)) t.dispose();
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    const rt = (sw, sh, extra = {}) => new THREE.WebGLRenderTarget(Math.max(2, sw), Math.max(2, sh), { ...opts, ...extra });
    this.targets = {
      scene: rt(W, H, { depthBuffer: true, samples: 4 }),
      a1: rt(W >> 2, H >> 2), a2: rt(W >> 2, H >> 2),
      b1: rt(W >> 3, H >> 3), b2: rt(W >> 3, H >> 3),
    };
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.camera);
  }

  blur(src, tmp, dst, scale) {
    const u = this.blurMat.uniforms;
    u.tInput.value = src.texture; u.direction.value.set(scale / tmp.width, 0); this.pass(this.blurMat, tmp);
    u.tInput.value = tmp.texture; u.direction.value.set(0, scale / dst.height); this.pass(this.blurMat, dst);
  }

  render(scene, camera) {
    const t = this.targets, r = this.renderer;
    r.setRenderTarget(t.scene); r.render(scene, camera);
    this.brightMat.uniforms.tScene.value = t.scene.texture; this.brightMat.uniforms.threshold.value = this.threshold;
    this.pass(this.brightMat, t.a1);
    this.blur(t.a1, t.a2, t.a1, 1.0);
    this.blur(t.a1, t.b1, t.b2, 1.0);
    this.blur(t.b2, t.b1, t.b2, 1.6);
    const c = this.compositeMat.uniforms;
    c.tScene.value = t.scene.texture; c.tBloomA.value = t.a1.texture; c.tBloomB.value = t.b2.texture;
    c.exposure.value = this.exposure; c.bloomStrength.value = this.enabled ? this.bloomStrength : 0;
    this.pass(this.compositeMat, null);
  }
}
