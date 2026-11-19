// Vehicle entities and arcade physics: engine/brake/steer, lateral grip with drift, body roll,
// collisions against buildings, other vehicles and the shoreline, damage, smoke and explosions.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { clamp, damp, wrapAngle } from '../core/mathUtils.js';
import { emitEvent } from '../core/eventBus.js';
import { getVehicleSpec } from './vehicleCatalog.js';
import { createVehicleMesh, animateLightBar } from './vehicleMeshFactory.js';
import { resolveCircleAgainstStatics } from '../world/collisionGrid.js';
import { constrainToLand, groundHeightAt } from '../world/cityLayout.js';
import { lighting } from '../world/dayNightCycle.js';
import { spawnSmoke, spawnSparks, spawnExplosion, spawnTyreSmoke } from '../combat/visualEffects.js';
import { playSound } from '../audio/soundEffects.js';

let nextVehicleId = 1;
const probe = { x: 0, z: 0 };

export function spawnVehicle(typeKey, x, z, heading = 0, options = {}) {
  const spec = getVehicleSpec(typeKey);
  const rng = options.rng || game.rng;
  const color = options.color !== undefined ? options.color : rng.pick(spec.colors);
  const mesh = createVehicleMesh(spec, color);
  const v = {
    id: nextVehicleId++, type: spec.key, spec, color, mesh,
    pos: new THREE.Vector3(x, 0, z), heading, vx: 0, vz: 0, speed: 0, lateral: 0,
    controls: { throttle: 0, steer: 0, brake: 0, handbrake: false },
    steerVisual: 0, roll: 0, pitch: 0,
    health: 100, wrecked: false, burning: 0, driver: null, passengers: [],
    isPolice: spec.klass === 'Police', siren: false, sirenPhase: rng() * 10,
    ai: options.ai || null, radius: Math.max(spec.width * 0.62, 1.0), halfLen: spec.length * 0.5,
    drifting: false, lastHitTime: -10, missionTag: options.missionTag || null, lightsOn: false, parked: !!options.parked,
    stuckTime: 0, age: 0,
  };
  mesh.position.copy(v.pos); mesh.rotation.y = heading;
  game.scene.add(mesh);
  game.vehicles.push(v);
  return v;
}

export function removeVehicle(v) {
  const i = game.vehicles.indexOf(v);
  if (i >= 0) game.vehicles.splice(i, 1);
  game.scene.remove(v.mesh);
  v.removed = true;
}

/** Swap the paint job by rebuilding the model (used by Odette's respray). */
export function repaintVehicle(v, color) {
  game.scene.remove(v.mesh);
  v.color = color; v.mesh = createVehicleMesh(v.spec, color);
  v.mesh.position.copy(v.pos); v.mesh.rotation.y = v.heading;
  game.scene.add(v.mesh);
}

export function damageVehicle(v, amount, source) {
  if (v.wrecked) return;
  v.health -= amount;
  if (v.health <= 0) { v.health = 0; v.burning = v.burning || 4.5; v.lastAttacker = source; }
}

export function explodeVehicle(v) {
  if (v.wrecked) return;
  v.wrecked = true; v.health = 0; v.burning = 0; v.siren = false;
  spawnExplosion(v.pos.x, 1.2, v.pos.z);
  playSound('explosion', v.pos);
  game.cameraShake = Math.max(game.cameraShake, clamp(1.6 - v.pos.distanceTo(game.player.pos) / 40, 0, 1.4));
  v.mesh.userData.tilt.children[0].material = wreckMaterial;
  v.mesh.userData.headGlow.visible = false; v.mesh.userData.brakeGlow.visible = false;
  emitEvent('vehicleExploded', v);
}
const wreckMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.95, metalness: 0.2 });

function collideWithStatics(v, dt) {
  // two circles (front / rear axle) keep long vehicles from clipping corners
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading), off = v.halfLen * 0.55;
  for (const sgn of [1, -1]) {
    probe.x = v.pos.x + fx * off * sgn; probe.z = v.pos.z + fz * off * sgn;
    const ox = probe.x, oz = probe.z;
    let hit = resolveCircleAgainstStatics(probe, v.radius);
    if (constrainToLand(probe, v.radius)) { const dx = probe.x - ox, dz = probe.z - oz, d = Math.hypot(dx, dz) || 1; hit = { nx: dx / d, nz: dz / d }; }
    if (!hit) continue;
    v.pos.x += probe.x - ox; v.pos.z += probe.z - oz;
    const vn = v.vx * hit.nx + v.vz * hit.nz;
    if (vn < 0) {
      const impact = -vn;
      v.vx -= hit.nx * vn * 1.25; v.vz -= hit.nz * vn * 1.25;
      // glancing hits turn the car along the wall
      const side = (fx * hit.nz - fz * hit.nx) * sgn;
      v.heading = wrapAngle(v.heading + side * Math.min(impact, 20) * 0.012);
      if (impact > 6) onImpact(v, impact, probe.x, probe.z);
    }
  }
}

function onImpact(v, impact, x, z) {
  if (game.time - v.lastHitTime < 0.25) return;
  v.lastHitTime = game.time;
  damageVehicle(v, (impact - 5) * 0.9);
  spawnSparks(x, 0.7, z, 6);
  playSound('crash', v.pos, clamp(impact / 30, 0.2, 1));
  if (v.driver === game.player) game.cameraShake = Math.max(game.cameraShake, clamp(impact / 60, 0.1, 0.6));
}

function collideVehiclePair(a, b) {
  const reach = a.halfLen + b.halfLen + 1.5;
  const ddx = b.pos.x - a.pos.x, ddz = b.pos.z - a.pos.z;
  if (ddx * ddx + ddz * ddz > reach * reach) return;
  const afx = Math.sin(a.heading), afz = Math.cos(a.heading), bfx = Math.sin(b.heading), bfz = Math.cos(b.heading);
  for (const sa of [1, -1]) for (const sb of [1, -1]) {
    const ax = a.pos.x + afx * a.halfLen * 0.55 * sa, az = a.pos.z + afz * a.halfLen * 0.55 * sa;
    const bx = b.pos.x + bfx * b.halfLen * 0.55 * sb, bz = b.pos.z + bfz * b.halfLen * 0.55 * sb;
    let dx = bx - ax, dz = bz - az;
    const d = Math.hypot(dx, dz), min = a.radius + b.radius;
    if (d >= min || d < 1e-4) continue;
    dx /= d; dz /= d;
    const pen = min - d, ma = a.parked ? a.spec.mass * 3 : a.spec.mass, mb = b.parked ? b.spec.mass * 3 : b.spec.mass, total = ma + mb;
    a.pos.x -= dx * pen * (mb / total); a.pos.z -= dz * pen * (mb / total);
    b.pos.x += dx * pen * (ma / total); b.pos.z += dz * pen * (ma / total);
    const rel = (b.vx - a.vx) * dx + (b.vz - a.vz) * dz;
    if (rel < 0) {
      const j = -(1.35) * rel / (1 / ma + 1 / mb);
      a.vx -= (j / ma) * dx; a.vz -= (j / ma) * dz; b.vx += (j / mb) * dx; b.vz += (j / mb) * dz;
      // spin both cars a little depending on where they were hit
      a.heading = wrapAngle(a.heading + (afx * dz - afz * dx) * sa * Math.min(-rel, 25) * 0.008 * (mb / total));
      b.heading = wrapAngle(b.heading - (bfx * dz - bfz * dx) * sb * Math.min(-rel, 25) * 0.008 * (ma / total));
      const impact = -rel;
      if (impact > 5 && game.time - a.lastHitTime > 0.25) {
        a.lastHitTime = b.lastHitTime = game.time;
        damageVehicle(a, (impact - 4) * 0.8 * (mb / total) * 2, b.driver); damageVehicle(b, (impact - 4) * 0.8 * (ma / total) * 2, a.driver);
        spawnSparks((ax + bx) / 2, 0.8, (az + bz) / 2, 8);
        playSound('crash', a.pos, clamp(impact / 30, 0.2, 1));
        if (a.driver === game.player || b.driver === game.player) game.cameraShake = Math.max(game.cameraShake, clamp(impact / 50, 0.1, 0.7));
        emitEvent('vehicleCollision', { a, b, impact });
      }
      a.parked = b.parked = false;
    }
  }
}

export function updateVehiclePhysics(v, dt) {
  const s = v.spec, c = v.controls;
  v.age += dt;
  const alive = !v.wrecked && v.health > 0;
  const throttle = alive ? clamp(c.throttle, -1, 1) : 0;
  // 1. steering rotates the body; velocity keeps its world direction, which creates slip
  let fwd = v.vx * Math.sin(v.heading) + v.vz * Math.cos(v.heading);
  const absF = Math.abs(fwd);
  const steerAuthority = Math.min(1, absF / 5) * (1 / (1 + absF / 55));
  v.steerVisual = damp(v.steerVisual, clamp(c.steer, -1, 1), c.handbrake ? 9 : 6, dt);
  v.heading = wrapAngle(v.heading + v.steerVisual * s.turn * steerAuthority * (c.handbrake ? 1.45 : 1) * Math.sign(fwd || 1) * dt);
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  fwd = v.vx * fx + v.vz * fz;
  let lat = v.vx * -fz + v.vz * fx;
  // 2. longitudinal forces
  const damageFactor = 0.55 + 0.45 * clamp(v.health / 60, 0, 1);
  if (throttle > 0) {
    if (fwd < -0.5) fwd += s.brake * dt;
    else fwd += s.accel * throttle * damageFactor * Math.max(0, 1 - fwd / (s.maxSpeed * (c.boost || 1))) * dt;
  } else if (throttle < 0) {
    if (fwd > 0.5) fwd -= s.brake * -throttle * dt;
    else fwd += s.accel * 0.7 * throttle * Math.max(0, 1 + fwd / (s.maxSpeed * 0.32)) * dt;
  }
  if (c.brake > 0) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), s.brake * c.brake * dt);
  fwd -= fwd * (0.08 + (throttle === 0 ? 0.55 : 0)) * dt;
  if (c.handbrake) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 9 * dt);
  // 3. lateral grip: breaks away past the slip limit or under handbrake (drift)
  const slipLimit = 4.2 + s.grip * 0.45;
  let grip = s.grip;
  if (c.handbrake) grip *= 0.16; else if (Math.abs(lat) > slipLimit) grip *= 0.42;
  lat *= Math.exp(-grip * dt);
  v.drifting = Math.abs(lat) > 3.2 && absF > 6;
  v.vx = fx * fwd - fz * lat; v.vz = fz * fwd + fx * lat;
  v.speed = fwd; v.lateral = lat;
  v.pos.x += v.vx * dt; v.pos.z += v.vz * dt;
  if (!Number.isFinite(v.pos.x + v.pos.z + v.heading)) { console.error('NaN vehicle', v.type, v.ai && v.ai.mode, JSON.stringify(v.controls), v.vx, v.vz, v.heading); }
  collideWithStatics(v, dt);
  v.pos.y = damp(v.pos.y, groundHeightAt(v.pos.x, v.pos.z), 14, dt);
  // 4. damage states
  if (v.burning > 0 && !v.wrecked) {
    v.burning -= dt;
    if (Math.random() < dt * 14) spawnSmoke(v.pos.x + fx * v.halfLen * 0.6, 1.2, v.pos.z + fz * v.halfLen * 0.6, true);
    if (v.burning <= 0) explodeVehicle(v);
  } else if (v.health < 45 && !v.wrecked && Math.random() < dt * (v.health < 22 ? 9 : 4)) {
    spawnSmoke(v.pos.x + fx * v.halfLen * 0.7, 1.0, v.pos.z + fz * v.halfLen * 0.7, false, v.health < 22);
  }
  if (v.drifting && Math.random() < dt * 30) {
    spawnTyreSmoke(v.pos.x - fx * v.halfLen * 0.6, 0.25, v.pos.z - fz * v.halfLen * 0.6);
  }
  // 5. visuals
  const m = v.mesh, ud = m.userData;
  m.position.copy(v.pos); m.rotation.y = v.heading;
  v.roll = damp(v.roll, clamp(-lat * 0.022 - v.steerVisual * absF * 0.0022, -0.16, 0.16), 6, dt);
  v.pitch = damp(v.pitch, clamp(-throttle * 0.02 + (c.brake || c.handbrake ? 0.03 : 0), -0.05, 0.05), 5, dt);
  if (v.type === 'bike') ud.tilt.rotation.z = clamp(-v.steerVisual * absF * 0.02, -0.6, 0.6);
  else { ud.tilt.rotation.z = v.roll; ud.tilt.rotation.x = v.pitch; }
  const spin = fwd * dt / 0.36;
  for (let i = 0; i < ud.wheels.length; i++) { const w = ud.wheels[i]; w.rotation.x += spin; if (i < 2 && ud.wheels.length === 4) w.rotation.y = v.steerVisual * 0.45; }
  const lightsWanted = !v.wrecked && (v.driver || v.ai) && (lighting.nightFactor > 0.1 || v.isPolice);
  ud.headGlow.visible = !!lightsWanted && lighting.nightFactor > 0.08;
  ud.brakeGlow.visible = !v.wrecked && !!(v.driver || v.ai) && (c.brake > 0.2 || (throttle < 0 && fwd > 1) || c.handbrake || lighting.nightFactor > 0.3);
  if (ud.lightBar) animateLightBar(m, game.time + v.sirenPhase, v.siren && !v.wrecked);
}

/** Pairwise vehicle collisions; called once per frame after every vehicle has moved. */
export function resolveVehicleCollisions() {
  const list = game.vehicles;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) collideVehiclePair(list[i], list[j]);
}

/** Nearest vehicle to a point within maxDist (optionally filtered). */
export function findNearestVehicle(x, z, maxDist, filter) {
  let best = null, bd = maxDist * maxDist;
  for (const v of game.vehicles) {
    if (filter && !filter(v)) continue;
    const d = (v.pos.x - x) ** 2 + (v.pos.z - z) ** 2;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

export function isVehicleAt(x, z, radius) {
  for (const v of game.vehicles) if ((v.pos.x - x) ** 2 + (v.pos.z - z) ** 2 < (radius + v.halfLen) ** 2) return true;
  return false;
}
