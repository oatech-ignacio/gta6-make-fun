// Sky dome shader: vertical gradient, sun disc with a wide warm halo, drifting procedural clouds and night stars.
import * as THREE from 'three';

const vertexShader = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w * 0.9999;
}`;

const fragmentShader = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform vec3 zenithColor; uniform vec3 horizonColor; uniform vec3 sunColor; uniform vec3 sunDir;
uniform vec3 cloudColor; uniform float time; uniform float starAmount; uniform float cloudAmount;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  float t = pow(clamp(h, 0.0, 1.0), 0.42);
  vec3 col = mix(horizonColor, zenithColor, t);
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  // warm band hugging the horizon on the sun side
  col += sunColor * pow(sd, 3.0) * 0.38 * (1.0 - t);
  col += sunColor * pow(sd, 24.0) * 0.55;
  col += sunColor * pow(sd, 900.0) * 14.0;
  // clouds
  if (d.y > 0.01) {
    vec2 uv = d.xz / (d.y + 0.16) * 1.3 + vec2(time * 0.004, time * 0.002);
    float c = fbm(uv);
    float m = smoothstep(1.0 - cloudAmount, 1.0 - cloudAmount + 0.32, c) * smoothstep(0.01, 0.2, d.y);
    vec3 lit = mix(cloudColor, sunColor * 1.25 + cloudColor * 0.25, pow(sd, 2.0) * 0.8 + 0.12);
    float under = smoothstep(0.45, 0.9, fbm(uv + 0.07));
    col = mix(col, mix(lit, lit * 0.62, under * 0.6), m * 0.85);
  }
  // stars
  if (starAmount > 0.01 && d.y > 0.0) {
    vec2 sp = d.xz / (d.y + 0.4) * 140.0;
    float s = step(0.9965, hash(floor(sp))) * (0.5 + 0.5 * sin(time * 2.0 + hash(floor(sp)) * 40.0));
    col += vec3(s) * starAmount * smoothstep(0.0, 0.3, d.y);
  }
  col = mix(col, horizonColor * 0.82, smoothstep(0.0, -0.12, d.y));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSkyDome() {
  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    uniforms: {
      zenithColor: { value: new THREE.Color(0x2f7fd6) }, horizonColor: { value: new THREE.Color(0xffc48a) },
      sunColor: { value: new THREE.Color(0xffa860) }, sunDir: { value: new THREE.Vector3(-0.8, 0.3, 0.4) },
      cloudColor: { value: new THREE.Color(0xffffff) }, time: { value: 0 }, starAmount: { value: 0 }, cloudAmount: { value: 0.5 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), material);
  mesh.frustumCulled = false; mesh.renderOrder = -10; mesh.name = 'skyDome';
  return mesh;
}

export function updateSkyDome(mesh, cameraPosition, time) {
  mesh.position.copy(cameraPosition);
  mesh.material.uniforms.time.value = time;
}
