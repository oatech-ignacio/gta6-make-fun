// Pooled particle effects: muzzle flashes with a light, bullet tracers, sparks, blood, exhaust/tyre smoke,
// engine fire and explosions. Everything is sprites or thin boxes, generated in code.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { getGlowTexture } from '../world/roadTextures.js';

const POOL = 240, TRACERS = 28;
const particles = [], tracers = [];
let smokeTexture = null, flashLight = null, blastLight = null, cursor = 0, tracerCursor = 0;
const tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);

function createSmokeTexture() {
  const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  for (let k = 0; k < 26; k++) {
    const x = S / 2 + (Math.sin(k * 12.9898) * 0.5) * S * 0.45, y = S / 2 + (Math.cos(k * 78.233) * 0.5) * S * 0.45, r = S * (0.14 + ((k * 7) % 10) / 60);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function initVisualEffects(scene) {
  particles.length = 0; tracers.length = 0;
  smokeTexture = createSmokeTexture();
  for (let i = 0; i < POOL; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture, transparent: true, depthWrite: false }));
    sprite.visible = false; scene.add(sprite);
    particles.push({ sprite, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, size: 1, grow: 0, gravity: 0, alpha: 1 });
  }
  const tracerGeo = new THREE.BoxGeometry(0.035, 0.035, 1);
  for (let i = 0; i < TRACERS; i++) {
    const mesh = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.2, 1.6), transparent: true, opacity: 0.9 }));
    mesh.visible = false; scene.add(mesh); tracers.push({ mesh, life: 0 });
  }
  flashLight = new THREE.PointLight(0xffc070, 0, 22, 1.6); blastLight = new THREE.PointLight(0xff8030, 0, 70, 1.4);
  scene.add(flashLight, blastLight);
}

function emit(x, y, z, o) {
  const p = particles[cursor]; cursor = (cursor + 1) % POOL;
  const m = p.sprite.material;
  m.map = o.glow ? getGlowTexture() : smokeTexture;
  m.blending = o.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  m.color.setRGB(o.r, o.g, o.b); m.opacity = o.alpha === undefined ? 1 : o.alpha; m.needsUpdate = true;
  p.sprite.position.set(x, y, z); p.sprite.scale.setScalar(o.size); p.sprite.visible = true;
  p.sprite.material.rotation = Math.random() * 6.28;
  p.life = p.maxLife = o.life; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
  p.size = o.size; p.grow = o.grow || 0; p.gravity = o.gravity || 0; p.alpha = m.opacity;
  return p;
}
const rnd = (a) => (Math.random() - 0.5) * 2 * a;

export function spawnMuzzleFlash(x, y, z, scale = 1) {
  emit(x, y, z, { glow: true, additive: true, r: 6, g: 4.2, b: 1.6, size: 0.55 * scale, life: 0.07, grow: 4 });
  emit(x, y, z, { glow: true, additive: true, r: 3, g: 1.6, b: 0.5, size: 1.3 * scale, life: 0.06, alpha: 0.6 });
  emit(x, y + 0.1, z, { r: 0.8, g: 0.8, b: 0.8, size: 0.4, life: 0.5, vy: 0.8, grow: 1.2, alpha: 0.3 });
  flashLight.position.set(x, y + 0.2, z); flashLight.intensity = 16 * scale;
}

export function spawnTracer(ax, ay, az, bx, by, bz) {
  const t = tracers[tracerCursor]; tracerCursor = (tracerCursor + 1) % TRACERS;
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  t.mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  t.mesh.scale.set(1, 1, Math.max(0.1, len));
  t.mesh.quaternion.setFromUnitVectors(up, tmp.set(bx - ax, by - ay, bz - az).normalize());
  t.mesh.visible = true; t.mesh.material.opacity = 0.9; t.life = 0.075;
}

export function spawnSparks(x, y, z, count = 5) {
  for (let i = 0; i < count; i++) emit(x, y, z, { glow: true, additive: true, r: 5, g: 3.4, b: 1.2, size: 0.22, life: 0.25 + Math.random() * 0.25, vx: rnd(5), vy: 1 + Math.random() * 4, vz: rnd(5), gravity: 14 });
  emit(x, y, z, { r: 0.75, g: 0.72, b: 0.68, size: 0.5, life: 0.6, vy: 0.6, grow: 1.6, alpha: 0.35 });
}

export function spawnBlood(x, y, z) {
  for (let i = 0; i < 5; i++) emit(x, y, z, { r: 0.5, g: 0.02, b: 0.03, size: 0.28, life: 0.4 + Math.random() * 0.2, vx: rnd(2.2), vy: Math.random() * 2.4, vz: rnd(2.2), gravity: 9, alpha: 0.9 });
}

export function spawnSmoke(x, y, z, fire = false, dark = false) {
  const s = dark ? 0.12 : 0.55;
  emit(x + rnd(0.3), y, z + rnd(0.3), { r: s, g: s, b: s, size: 0.9, life: 1.6 + Math.random(), vx: rnd(0.4), vy: 1.6 + Math.random(), vz: rnd(0.4), grow: 1.5, alpha: dark ? 0.6 : 0.4 });
  if (fire) emit(x + rnd(0.4), y - 0.1, z + rnd(0.4), { glow: true, additive: true, r: 4.5, g: 1.8, b: 0.3, size: 1.5, life: 0.35 + Math.random() * 0.2, vy: 2.2, grow: -1.5 });
}

export function spawnTyreSmoke(x, y, z) {
  emit(x + rnd(0.7), y, z + rnd(0.7), { r: 0.86, g: 0.86, b: 0.9, size: 0.9, life: 0.9 + Math.random() * 0.5, vx: rnd(0.6), vy: 0.7, vz: rnd(0.6), grow: 2.6, alpha: 0.32 });
}

export function spawnExplosion(x, y, z) {
  for (let i = 0; i < 12; i++) emit(x + rnd(1.5), y + Math.random() * 1.5, z + rnd(1.5), { glow: true, additive: true, r: 5, g: 2.2 + Math.random(), b: 0.4, size: 3 + Math.random() * 3, life: 0.45 + Math.random() * 0.35, vx: rnd(5), vy: 2 + Math.random() * 5, vz: rnd(5), grow: 4 });
  for (let i = 0; i < 14; i++) emit(x + rnd(2), y + Math.random() * 2, z + rnd(2), { r: 0.1, g: 0.1, b: 0.1, size: 2.5, life: 2 + Math.random() * 1.5, vx: rnd(2.5), vy: 2.5 + Math.random() * 3, vz: rnd(2.5), grow: 2.5, alpha: 0.7 });
  spawnSparks(x, y, z, 16);
  blastLight.position.set(x, y + 2, z); blastLight.intensity = 900;
}

export function spawnCashBurst(x, y, z) {
  for (let i = 0; i < 6; i++) emit(x, y, z, { glow: true, additive: true, r: 0.6, g: 3, b: 0.9, size: 0.3, life: 0.5, vx: rnd(1.5), vy: 2 + Math.random() * 2, vz: rnd(1.5), gravity: 6 });
}

export function updateVisualEffects(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.sprite.visible = false; continue; }
    p.vy -= p.gravity * dt;
    const s = p.sprite;
    s.position.x += p.vx * dt; s.position.y = Math.max(0.05, s.position.y + p.vy * dt); s.position.z += p.vz * dt;
    p.size = Math.max(0.05, p.size + p.grow * dt); s.scale.setScalar(p.size);
    s.material.opacity = p.alpha * Math.min(1, (p.life / p.maxLife) * 1.6);
  }
  for (const t of tracers) {
    if (t.life <= 0) continue;
    t.life -= dt; t.mesh.material.opacity = Math.max(0, t.life / 0.075) * 0.9;
    if (t.life <= 0) t.mesh.visible = false;
  }
  if (flashLight) { flashLight.intensity = Math.max(0, flashLight.intensity - dt * 900); blastLight.intensity = Math.max(0, blastLight.intensity - dt * 1800); }
  void game;
}
