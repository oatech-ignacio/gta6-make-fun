// Shooting and punching: player aim from the camera, hitscan against people, vehicles and buildings,
// tracers, muzzle flashes, drive-by fire, and the shared fire routine used by police and gangsters.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { wasKeyPressed, getMouse } from '../core/input.js';
import { emitEvent } from '../core/eventBus.js';
import { WEAPONS, selectWeapon, cycleWeapon, reloadWeapon } from './weaponCatalog.js';
import { damageCharacter } from './damageSystem.js';
import { damageVehicle } from '../vehicles/vehiclePhysics.js';
import { raycastStatics } from '../world/collisionGrid.js';
import { spawnMuzzleFlash, spawnTracer, spawnSparks, spawnBlood } from './visualEffects.js';
import { knockDownCharacter } from '../characters/characterEntity.js';
import { playSound } from '../audio/soundEffects.js';
import { reportCrime } from '../systems/wantedLevel.js';
import { flashCrosshair } from '../ui/hud.js';

const camDir = new THREE.Vector3();
let reloadTimer = 0;

/** Cast one bullet. Returns { distance, character?, vehicle?, x, y, z }. */
export function castBullet(shooter, ox, oy, oz, dx, dy, dz, range) {
  const h = Math.hypot(dx, dz) || 1e-6, ux = dx / h, uz = dz / h;   // unit direction on the ground plane
  let bestT = Math.min(range * h, raycastStatics(ox, oz, ux, uz, range * h, 1.3)), hitChar = null, hitVeh = null;
  for (const c of game.characters) {
    if (c === shooter || c.state === 'dead' || c.vehicle) continue;
    const rx = c.pos.x - ox, rz = c.pos.z - oz, t = rx * ux + rz * uz;
    if (t < 0.2 || t > bestT) continue;
    const perp = Math.abs(rx * -uz + rz * ux);
    if (perp > (c.state === 'down' ? 0.8 : 0.42)) continue;
    const y = oy + (dy / h) * t - c.pos.y;
    if (y < -0.1 || y > (c.state === 'down' ? 0.7 : 1.95)) continue;
    bestT = t; hitChar = c; hitVeh = null;
  }
  for (const v of game.vehicles) {
    if (shooter && shooter.vehicle === v) continue;
    const rx = v.pos.x - ox, rz = v.pos.z - oz, t = rx * ux + rz * uz;
    if (t < 0.5 || t - v.halfLen > bestT) continue;
    const perp = Math.abs(rx * -uz + rz * ux);
    if (perp > v.halfLen * 0.75) continue;
    const tHit = Math.max(0.5, t - v.radius);
    const y = oy + (dy / h) * tHit;
    if (y < 0 || y > v.spec.height + 0.3 || tHit > bestT) continue;
    bestT = tHit; hitVeh = v; hitChar = null;
  }
  return { distance: bestT / h, character: hitChar, vehicle: hitVeh, x: ox + ux * bestT, y: oy + (dy / h) * bestT, z: oz + uz * bestT };
}

/** Fire `weaponKey` from a character along a 3D direction (already normalised). Handles spread, pellets, damage, FX. */
export function fireWeapon(shooter, weaponKey, dir, accuracy = 1) {
  const w = WEAPONS[weaponKey];
  const from = shooter.vehicle ? shooter.vehicle.pos : shooter.pos;
  const hx = Math.sin(shooter.heading), hz = Math.cos(shooter.heading);
  const ox = from.x + hx * 0.55 + -hz * 0.18, oy = from.y + (shooter.vehicle ? 1.25 : 1.42), oz = from.z + hz * 0.55 + hx * 0.18;
  const pellets = w.pellets || 1, spread = w.spread / Math.max(0.2, accuracy);
  let anyHit = false;
  for (let p = 0; p < pellets; p++) {
    const dx = dir.x + (Math.random() - 0.5) * 2 * spread, dy = dir.y + (Math.random() - 0.5) * 2 * spread, dz = dir.z + (Math.random() - 0.5) * 2 * spread;
    const hit = castBullet(shooter, ox, oy, oz, dx, dy, dz, w.range);
    spawnTracer(ox, oy, oz, hit.x, hit.y, hit.z);
    if (hit.character) {
      anyHit = true;
      spawnBlood(hit.x, hit.y, hit.z);
      damageCharacter(hit.character, w.damage * (shooter === game.player ? 1 : 0.5), shooter, 'bullet');
    } else if (hit.vehicle) {
      anyHit = true;
      spawnSparks(hit.x, Math.max(0.5, hit.y), hit.z, 4);
      damageVehicle(hit.vehicle, w.damage * 0.3, shooter);
      if (shooter === game.player && hit.vehicle.isPolice) reportCrime('shootCop', hit.vehicle.pos);
      if (hit.vehicle.driver && hit.vehicle.driver !== shooter && Math.random() < 0.25) damageCharacter(hit.vehicle.driver, w.damage * 0.5, shooter, 'bullet');
    } else if (hit.distance < w.range - 0.5) spawnSparks(hit.x, hit.y, hit.z, 3);
  }
  spawnMuzzleFlash(ox + dir.x * 0.35, oy, oz + dir.z * 0.35, weaponKey === 'shotgun' ? 1.5 : 1);
  shooter.fireAnim = 0.45; shooter.recoil = 1;
  playSound(w.sound, from);
  emitEvent('gunfire', { x: from.x, z: from.z, shooter });
  return anyHit;
}

function playerAimDirection(player) {
  // aim at whatever the crosshair covers: follow the camera ray, then shoot from the muzzle to that point
  game.camera.getWorldDirection(camDir);
  const cam = game.camera.position;
  const probe = castBullet(player, cam.x + camDir.x * 3, cam.y + camDir.y * 3, cam.z + camDir.z * 3, camDir.x, camDir.y, camDir.z, 90);
  const from = player.vehicle ? player.vehicle.pos : player.pos;
  const d = new THREE.Vector3(probe.x - from.x, probe.y - (from.y + 1.42), probe.z - from.z);
  if (d.lengthSq() < 4) d.copy(camDir);
  return d.normalize();
}

function punch(player) {
  player.punchTime = 0.32;
  playSound('swing', player.pos);
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  for (const c of game.characters) {
    if (c === player || c.state === 'dead' || c.vehicle) continue;
    const dx = c.pos.x - player.pos.x, dz = c.pos.z - player.pos.z, f = dx * fx + dz * fz;
    if (f < 0 || f > WEAPONS.fists.range || Math.abs(dx * -fz + dz * fx) > 0.9) continue;
    damageCharacter(c, WEAPONS.fists.damage, player, 'melee');
    playSound('punch', c.pos);
    if (c.health > 0 && Math.random() < 0.45) knockDownCharacter(c, 1.8, { x: fx * 3, z: fz * 3 });
    if (c.kind === 'ped') { c.panic = 10; c.fleeFrom = { x: player.pos.x, z: player.pos.z }; }
    reportCrime(c.kind === 'cop' ? 'hitCop' : 'assault', c.pos);
    flashCrosshair();
    break;
  }
  for (const v of game.vehicles) {
    const dx = v.pos.x - player.pos.x, dz = v.pos.z - player.pos.z;
    if (dx * dx + dz * dz < (v.halfLen + 1.2) ** 2 && dx * fx + dz * fz > 0) { damageVehicle(v, 2, player); break; }
  }
}

/** Player weapon input: 1-4 / wheel to switch, R to reload, left mouse to punch or shoot (also from vehicles). */
export function updatePlayerCombat(dt) {
  const player = game.player, mouse = getMouse();
  if (player.health <= 0 || player.state === 'down' || game.flags.controlsLocked) return;
  ['Digit1', 'Digit2', 'Digit3', 'Digit4'].forEach((code, i) => { if (wasKeyPressed(code)) selectWeapon(['fists', 'pistol', 'smg', 'shotgun'][i]); });
  if (mouse.wheel) cycleWeapon(mouse.wheel > 0 ? 1 : -1);
  if (wasKeyPressed('KeyQ')) cycleWeapon(1);
  const key = game.currentWeapon, w = WEAPONS[key];
  player.weapon = key;
  reloadTimer = Math.max(0, reloadTimer - dt);
  const ammo = game.ammo[key];
  if (!w.melee && !player.vehicle && wasKeyPressed('KeyR') && reloadTimer === 0) { reloadTimer = reloadWeapon(key); if (reloadTimer) playSound('reload', player.pos); }
  const trigger = w.auto ? mouse.left : mouse.leftPressed;
  if (!trigger || player.fireCooldown > 0 || reloadTimer > 0) return;
  if (w.melee) { if (!player.vehicle) { punch(player); player.fireCooldown = w.rate; } return; }
  if (player.vehicle && key === 'shotgun') return;
  if (ammo.clip <= 0) {
    reloadTimer = reloadWeapon(key);
    playSound(reloadTimer ? 'reload' : 'empty', player.pos); player.fireCooldown = 0.3;
    return;
  }
  ammo.clip--;
  player.fireCooldown = w.rate;
  if (fireWeapon(player, key, playerAimDirection(player), 1)) flashCrosshair();
  game.cameraShake = Math.max(game.cameraShake, key === 'shotgun' ? 0.2 : 0.06);
  reportCrime('gunfire', player.pos);
}

/** NPC helper: shoot at a target character with aim error; returns true if a shot was fired. */
export function npcShootAt(npc, target, accuracy) {
  if (npc.fireCooldown > 0) return false;
  const w = WEAPONS[npc.weapon] || WEAPONS.pistol;
  const tp = target.vehicle ? target.vehicle.pos : target.pos;
  const d = new THREE.Vector3(tp.x - npc.pos.x, (tp.y + 1.1) - (npc.pos.y + 1.42), tp.z - npc.pos.z).normalize();
  npc.fireCooldown = w.rate * (w.auto ? 2.2 : 3.2) + Math.random() * 0.5;
  fireWeapon(npc, w.key, d, accuracy);
  return true;
}

export function isReloading() { return reloadTimer > 0; }
