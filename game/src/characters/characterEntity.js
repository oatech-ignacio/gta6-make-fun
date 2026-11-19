// Character entities shared by the player, pedestrians, police, gangsters and story NPCs:
// spawning, movement integration, building/vehicle collisions, getting run over, knock-downs.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { damp, dampAngle } from '../core/mathUtils.js';
import { createCharacterMesh, CHARACTER_LOOKS, randomCivilianLook as randomLook } from './characterMeshFactory.js';
import { animateCharacter } from './characterAnimation.js';
import { resolveCircleAgainstStatics } from '../world/collisionGrid.js';
import { constrainToLand, groundHeightAt } from '../world/cityLayout.js';
import { damageCharacter } from '../combat/damageSystem.js';
import { reportCrime } from '../systems/wantedLevel.js';
import { playSound } from '../audio/soundEffects.js';

let nextCharacterId = 1;
export const randomCivilianLook = randomLook;

export function spawnCharacter({ x, z, heading = 0, kind = 'ped', look = null, health = null, weapon = 'fists', name = null }) {
  const lookData = typeof look === 'string' ? CHARACTER_LOOKS[look] : (look || randomLook(game.rng));
  const mesh = createCharacterMesh(lookData);
  const c = {
    id: nextCharacterId++, kind, name, look: lookData, mesh,
    pos: new THREE.Vector3(x, groundHeightAt(x, z), z), heading, vel: { x: 0, z: 0 }, moveSpeed: 0,
    health: health || (kind === 'ped' ? 45 : kind === 'cop' ? 80 : 100), maxHealth: 100, armor: 0,
    state: 'idle', stateTimer: 0, weapon, fireCooldown: 0, aiming: false, aimPitch: 0,
    vehicle: null, radius: 0.38, animPhase: game.rng() * 6, panic: 0, fleeFrom: null, hostile: false, target: null,
    jumpY: 0, jumpVel: 0, punchTime: 0, fireAnim: 0, recoil: 0, fallDir: -1, ai: {}, deadTime: 0, knockVel: { x: 0, z: 0 },
  };
  mesh.position.copy(c.pos); mesh.rotation.y = heading;
  game.scene.add(mesh);
  game.characters.push(c);
  return c;
}

export function removeCharacter(c) {
  const i = game.characters.indexOf(c);
  if (i >= 0) game.characters.splice(i, 1);
  game.scene.remove(c.mesh);
  c.removed = true;
}

/** Knock a character off their feet for `duration` seconds with an optional sliding impulse. */
export function knockDownCharacter(c, duration = 2, impulse = null) {
  if (c.state === 'dead') return;
  c.state = 'down'; c.stateTimer = duration; c.aiming = false;
  c.fallDir = game.rng.chance(0.5) ? -1 : 1;
  if (impulse) { c.knockVel.x = impulse.x; c.knockVel.z = impulse.z; }
}

function collideWithVehicles(c, dt) {
  for (const v of game.vehicles) {
    const dx = c.pos.x - v.pos.x, dz = c.pos.z - v.pos.z;
    if (Math.abs(dx) > 7 || Math.abs(dz) > 7) continue;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const f = dx * fx + dz * fz, l = dx * -fz + dz * fx;
    const hw = v.spec.width * 0.5 + c.radius, hl = v.halfLen + c.radius;
    if (Math.abs(f) > hl || Math.abs(l) > hw) continue;
    const speed = Math.hypot(v.vx, v.vz);
    const approaching = (v.vx * dx + v.vz * dz) > 0;
    if (speed > 4.5 && approaching && c.state !== 'dead' && (c.jumpY || 0) < 0.9) {
      const byPlayer = v.driver === game.player;
      knockDownCharacter(c, 2.6, { x: v.vx * 0.75 + (l > 0 ? -fz : fz) * 2, z: v.vz * 0.75 + (l > 0 ? fx : -fx) * 2 });
      c.hitByVehicleTime = game.time;
      damageCharacter(c, (speed - 3) * 2.6, byPlayer ? game.player : null, 'vehicle');
      playSound('thud', c.pos);
      if (byPlayer && c !== game.player && c.health > 0) reportCrime(c.kind === 'cop' ? 'hitCop' : 'hitPed', c.pos);
      if (c.kind === 'ped') { c.panic = 12; c.fleeFrom = { x: v.pos.x, z: v.pos.z }; }
    }
    // push out through the nearest side of the car
    const penL = hw - Math.abs(l), penF = hl - Math.abs(f);
    if (penL < penF) { const s = Math.sign(l) || 1; c.pos.x += -fz * s * penL; c.pos.z += fx * s * penL; }
    else { const s = Math.sign(f) || 1; c.pos.x += fx * s * penF; c.pos.z += fz * s * penF; }
  }
}

/** Integrates velocity, gravity for jumps, knock-down timers, collisions; then animates and syncs the mesh. */
export function updateCharacterPhysics(c, dt) {
  if (c.vehicle) {
    c.pos.copy(c.vehicle.pos); c.heading = c.vehicle.heading; c.moveSpeed = 0;
    if (c.mesh.visible) { c.mesh.position.set(c.pos.x, c.pos.y + 0.55, c.pos.z); c.mesh.rotation.y = c.heading; c.mesh.rotation.z = c.vehicle.mesh.userData.tilt.rotation.z; animateCharacter(c, dt); }
    return;
  }
  c.mesh.rotation.z = 0;
  if (c.state === 'down') {
    c.stateTimer -= dt;
    c.vel.x = c.knockVel.x; c.vel.z = c.knockVel.z;
    c.knockVel.x *= Math.exp(-3.5 * dt); c.knockVel.z *= Math.exp(-3.5 * dt);
    if (c.stateTimer <= 0 && c.health > 0) { c.state = 'idle'; c.vel.x = c.vel.z = 0; }
  } else if (c.state === 'dead') {
    c.deadTime += dt;
    c.vel.x = c.knockVel.x; c.vel.z = c.knockVel.z;
    c.knockVel.x *= Math.exp(-4 * dt); c.knockVel.z *= Math.exp(-4 * dt);
  }
  c.pos.x += c.vel.x * dt; c.pos.z += c.vel.z * dt;
  if (!Number.isFinite(c.pos.x + c.pos.z)) { console.error('NaN character', c.kind, c.state, JSON.stringify(c.vel), JSON.stringify(c.knockVel), c.panic, JSON.stringify(c.fleeFrom), c.vehicle && c.vehicle.type); c.pos.set(0, 0, 0); }
  c.moveSpeed = damp(c.moveSpeed, c.state === 'down' || c.state === 'dead' ? 0 : Math.hypot(c.vel.x, c.vel.z), 12, dt);
  if (c.jumpVel !== 0 || c.jumpY > 0) {
    c.jumpVel -= 16 * dt; c.jumpY += c.jumpVel * dt;
    if (c.jumpY <= 0) { c.jumpY = 0; c.jumpVel = 0; }
  }
  resolveCircleAgainstStatics(c.pos, c.radius);
  constrainToLand(c.pos, c.radius);
  if (c.state !== 'dead' || c.deadTime < 1.5) collideWithVehicles(c, dt);
  c.pos.y = damp(c.pos.y, groundHeightAt(c.pos.x, c.pos.z), 16, dt);
  c.fireCooldown = Math.max(0, c.fireCooldown - dt);
  c.mesh.position.copy(c.pos); c.mesh.rotation.y = c.heading;
  animateCharacter(c, dt);
}

export function faceToward(c, x, z, rate, dt) {
  c.heading = dampAngle(c.heading, Math.atan2(x - c.pos.x, z - c.pos.z), rate, dt);
}

export function moveToward(c, x, z, speed, dt, turnRate = 8) {
  const dx = x - c.pos.x, dz = z - c.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.05) { c.vel.x = c.vel.z = 0; return d; }
  c.vel.x = dx / d * speed; c.vel.z = dz / d * speed;
  c.heading = dampAngle(c.heading, Math.atan2(dx, dz), turnRate, dt);
  return d;
}

export function findCharactersNear(x, z, radius, filter) {
  const out = [], r2 = radius * radius;
  for (const c of game.characters) {
    if (filter && !filter(c)) continue;
    if ((c.pos.x - x) ** 2 + (c.pos.z - z) ** 2 < r2) out.push(c);
  }
  return out;
}
