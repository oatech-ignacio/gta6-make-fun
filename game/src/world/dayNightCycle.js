// Day/night cycle: keyframed sun, sky, fog and exposure; drives window lights, lamps, neon and the ocean.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { lerp, clamp } from '../core/mathUtils.js';
import { setStreetLightLevel } from './streetLights.js';
import { setNeonSignBrightness } from './neonSigns.js';
import { updateOcean } from './ocean.js';
import { updateSkyDome } from './skyDome.js';
import { setVehicleGlowLevel } from '../vehicles/vehicleMeshFactory.js';

// hour, zenith, horizon, sun colour, sun intensity, hemisphere sky, hemisphere ground, hemi intensity, fog, night factor, exposure, cloud tint
const KEYS = [
  [0.0, 0x050718, 0x161a3c, 0x7f96d8, 0.55, 0x4a5aa0, 0x2a2238, 1.25, 0x10132c, 1.0, 1.25, 0x1a1f3d],
  [5.2, 0x0a1030, 0x35305e, 0x7f96d8, 0.5, 0x4a5aa0, 0x2a2238, 1.25, 0x1c1e3e, 1.0, 1.25, 0x2a2c50],
  [6.4, 0x2d4f96, 0xff9d6c, 0xffa56a, 1.6, 0x7f9fd8, 0x4a3a34, 0.8, 0xd9a48c, 0.35, 1.1, 0xffc0a0],
  [8.0, 0x2f78cf, 0xbfe0f5, 0xffe6c4, 2.9, 0xa8cdf5, 0x6b6052, 0.95, 0xbcd9ee, 0.0, 1.0, 0xffffff],
  [12.5, 0x1f6fd0, 0xa8d8f8, 0xfff6e6, 3.4, 0xb4d6fa, 0x74695a, 1.05, 0xb5d8f2, 0.0, 0.96, 0xffffff],
  [16.5, 0x2a6cc4, 0xffe2b0, 0xffdcae, 3.2, 0xa9c6f0, 0x77624e, 1.0, 0xe8d2b4, 0.0, 1.0, 0xfff2e0],
  [18.3, 0x3a5aa8, 0xffa860, 0xffa25a, 3.4, 0x9fafee, 0x8a6450, 1.15, 0xf0a878, 0.14, 1.06, 0xffc79a],
  [19.3, 0x2b2f78, 0xff6a5c, 0xff6a4a, 2.1, 0x8f8fe0, 0x6a4560, 1.2, 0xc46a78, 0.55, 1.14, 0xff9a8a],
  [20.2, 0x12164a, 0x8a3f7a, 0x8c7ad0, 0.8, 0x5a60b0, 0x35284a, 1.2, 0x4a2c5c, 0.92, 1.22, 0x6a4a7a],
  [21.2, 0x070a22, 0x1e1f4a, 0x7f96d8, 0.55, 0x4a5aa0, 0x2a2238, 1.25, 0x14163a, 1.0, 1.25, 0x22264a],
  [24.0, 0x050718, 0x161a3c, 0x7f96d8, 0.55, 0x4a5aa0, 0x2a2238, 1.25, 0x10132c, 1.0, 1.25, 0x1a1f3d],
];

const env = { sun: null, hemi: null, sky: null, fog: null, facadeMaterials: [], signs: null, beacons: null };
const cA = new THREE.Color(), cB = new THREE.Color();
export const lighting = { nightFactor: 0, sunDir: new THREE.Vector3(0, 1, 0), sunColor: new THREE.Color(), exposure: 1, sunAzimuthBias: 0.62 };

export function initDayNight(scene, refs) {
  env.sun = new THREE.DirectionalLight(0xffffff, 3);
  env.sun.castShadow = true;
  env.sun.shadow.mapSize.set(2048, 2048);
  const cam = env.sun.shadow.camera; cam.left = -95; cam.right = 95; cam.top = 95; cam.bottom = -95; cam.near = 10; cam.far = 700;
  env.sun.shadow.bias = -0.0006; env.sun.shadow.normalBias = 0.5;
  env.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(env.sun, env.sun.target, env.hemi);
  scene.fog = new THREE.FogExp2(0xffffff, 0.0011);
  env.fog = scene.fog;
  Object.assign(env, refs);
  applyTimeOfDay(game.timeOfDay);
}

function mixHex(a, b, t, out) { cA.setHex(a); cB.setHex(b); return out.copy(cA).lerp(cB, t); }

export function applyTimeOfDay(hour) {
  hour = ((hour % 24) + 24) % 24;
  let k = 0; while (k < KEYS.length - 2 && hour >= KEYS[k + 1][0]) k++;
  const a = KEYS[k], b = KEYS[k + 1], t = clamp((hour - a[0]) / (b[0] - a[0]), 0, 1);
  const u = env.sky.material.uniforms;
  mixHex(a[1], b[1], t, u.zenithColor.value); mixHex(a[2], b[2], t, u.horizonColor.value);
  mixHex(a[3], b[3], t, lighting.sunColor); u.sunColor.value.copy(lighting.sunColor);
  mixHex(a[11], b[11], t, u.cloudColor.value);
  const night = lerp(a[9], b[9], t);
  lighting.nightFactor = night; lighting.exposure = lerp(a[10], b[10], t);
  u.starAmount.value = Math.max(0, night - 0.5) * 2;
  // sun path: rises over the ocean (east, +x), sets behind the suburbs, tilted toward the south
  const dayT = (hour - 6) / 14.2, ang = dayT * Math.PI;
  const isDay = hour > 6 && hour < 20.2;
  if (isDay) lighting.sunDir.set(Math.cos(ang) * 0.9, Math.max(0.045, Math.sin(ang)), lighting.sunAzimuthBias).normalize();
  else lighting.sunDir.set(0.35, 0.8, -0.45).normalize();   // moon
  u.sunDir.value.copy(isDay ? lighting.sunDir : new THREE.Vector3(0.35, 0.8, -0.45).normalize());
  env.sun.color.copy(lighting.sunColor); env.sun.intensity = lerp(a[4], b[4], t);
  mixHex(a[5], b[5], t, env.hemi.color); mixHex(a[6], b[6], t, env.hemi.groundColor); env.hemi.intensity = lerp(a[7], b[7], t);
  mixHex(a[8], b[8], t, env.fog.color);
  env.fog.density = 0.00105 + night * 0.0003;
  for (const m of env.facadeMaterials) m.emissiveIntensity = 0.06 + night * 1.5;
  if (env.signs) setNeonSignBrightness(env.signs, night);
  if (env.beacons) env.beacons.material.opacity = 0.25 + night * 0.75;
  setStreetLightLevel(night);
  setVehicleGlowLevel(night);
}

export function setTimeOfDay(hour) { game.timeOfDay = hour; applyTimeOfDay(hour); }

/** One in-game day lasts 24 real minutes; called every frame. */
export function updateDayNight(dt, focus) {
  game.timeOfDay = (game.timeOfDay + dt * game.timeScale / 60) % 24;
  applyTimeOfDay(game.timeOfDay);
  // keep the shadow frustum centred on the action
  const sx = Math.round(focus.x / 4) * 4, sz = Math.round(focus.z / 4) * 4;
  env.sun.target.position.set(sx, 0, sz);
  env.sun.position.set(sx + lighting.sunDir.x * 300, lighting.sunDir.y * 300, sz + lighting.sunDir.z * 300);
  env.sun.target.updateMatrixWorld();
  updateSkyDome(env.sky, game.camera.position, game.time);
  updateOcean(game.time, lighting.sunColor, lighting.nightFactor);
  if (env.beacons) env.beacons.material.size = 5 + Math.sin(game.time * 3) * 1.5;
}

export function isNight() { return lighting.nightFactor > 0.5; }
