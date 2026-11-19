// Pedestrians: spawn around the player, stroll the sidewalks block by block, cross at corners,
// run screaming from gunfire and wrecks, get back up after knock-downs, and despawn when far away.
import { game } from '../core/gameState.js';
import { distSq2d } from '../core/mathUtils.js';
import { onEvent } from '../core/eventBus.js';
import { spawnCharacter, removeCharacter, moveToward, randomCivilianLook } from './characterEntity.js';
import { isPointInsideStatic } from '../world/collisionGrid.js';

export const pedestrianConfig = { target: 26, spawnMin: 38, spawnMax: 150, despawn: 190 };
const INSET = 1.9;
let spawnCooldown = 0;

function blockCorner(block, index) {
  const k = ((index % 4) + 4) % 4;
  return {
    x: k === 0 || k === 3 ? block.minX + INSET : block.maxX - INSET,
    z: k < 2 ? block.minZ + INSET : block.maxZ - INSET,
  };
}

function nearestBlock(x, z) {
  let best = null, bd = Infinity;
  for (const b of game.city.blocks) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function findBlock(i, j) { return game.city.blocks.find((b) => b.i === i && b.j === j); }

export function initPedestrians() {
  const scare = (x, z, radius, time) => {
    for (const c of game.characters) {
      if (c.kind !== 'ped' || c.state === 'dead' || c.vehicle) continue;
      if (distSq2d(c.pos.x, c.pos.z, x, z) < radius * radius) { c.panic = Math.max(c.panic, time + game.rng() * 4); c.fleeFrom = { x, z }; }
    }
  };
  onEvent('gunfire', (e) => scare(e.x, e.z, 42, 9));
  onEvent('vehicleExploded', (v) => scare(v.pos.x, v.pos.z, 60, 12));
  onEvent('vehicleCollision', (e) => { if (e.impact > 9) scare(e.a.pos.x, e.a.pos.z, 14, 4); });
}

/** Create one pedestrian walking the perimeter of a block, starting part-way along a side. */
export function spawnPedestrianOnBlock(block, side, t, direction = 1) {
  const a = blockCorner(block, side), b = blockCorner(block, side + 1);
  const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
  if (isPointInsideStatic(x, z, 0.5)) return null;
  const ped = spawnCharacter({ x, z, kind: 'ped', look: randomCivilianLook(game.rng), heading: Math.atan2(b.x - a.x, b.z - a.z) });
  ped.ai = { block, corner: direction > 0 ? side + 1 : side, direction, pace: game.rng.range(1.25, 1.9), pause: 0, crossing: null };
  return ped;
}

function trySpawnPedestrian(minDist, maxDist) {
  const p = game.player.pos;
  for (let attempt = 0; attempt < 8; attempt++) {
    const block = game.rng.pick(game.city.blocks);
    const cx = (block.minX + block.maxX) / 2, cz = (block.minZ + block.maxZ) / 2;
    if (distSq2d(cx, cz, p.x, p.z) > (maxDist + 60) ** 2) continue;
    const side = game.rng.int(0, 3), t = game.rng(), a = blockCorner(block, side), b = blockCorner(block, side + 1);
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, d2 = distSq2d(x, z, p.x, p.z);
    if (d2 < minDist * minDist || d2 > maxDist * maxDist) continue;
    // busier sidewalks downtown and on the beach strip
    if ((block.district === 'docks' || block.district === 'suburbs') && game.rng.chance(0.5)) continue;
    if (spawnPedestrianOnBlock(block, side, t, game.rng.sign())) return true;
  }
  return false;
}

function chooseNextCorner(ped) {
  const ai = ped.ai, block = ai.block;
  const k = ((ai.corner % 4) + 4) % 4;
  if (game.rng.chance(0.3)) {
    // cross the street to the neighbouring block that shares this corner's side
    const horizontal = game.rng.chance(0.5);
    const di = horizontal ? (k === 0 || k === 3 ? -1 : 1) : 0, dj = horizontal ? 0 : (k < 2 ? -1 : 1);
    const next = findBlock(block.i + di, block.j + dj);
    if (next) {
      // the matching corner across the road mirrors along the crossing axis
      const mirror = horizontal ? [1, 0, 3, 2][k] : [3, 2, 1, 0][k];
      ai.block = next; ai.corner = mirror; ai.crossing = true;
      return;
    }
  }
  ai.crossing = false;
  ai.corner += ai.direction;
  if (game.rng.chance(0.12)) ai.pause = game.rng.range(1.5, 5);
}

export function updatePedestrian(ped, dt) {
  const ai = ped.ai;
  if (ped.state === 'dead') {
    if (ped.deadTime > 25 || distSq2d(ped.pos.x, ped.pos.z, game.player.pos.x, game.player.pos.z) > 120 * 120) removeCharacter(ped);
    return;
  }
  if (ped.state === 'down') return;
  if (ped.panic > 0 && ped.fleeFrom) {
    ped.panic -= dt; ped.state = 'flee';
    let dx = ped.pos.x - ped.fleeFrom.x, dz = ped.pos.z - ped.fleeFrom.z;
    const d = Math.hypot(dx, dz) || 1;
    // run away with a per-person sideways bias so crowds scatter instead of forming a line
    const bias = ((ped.id % 7) - 3) * 0.22;
    const tx = ped.pos.x + (dx / d - dz / d * bias) * 10, tz = ped.pos.z + (dz / d + dx / d * bias) * 10;
    moveToward(ped, tx, tz, 5.6 + (ped.id % 3) * 0.5, dt, 10);
    if (ped.panic <= 0) { ped.state = 'walk'; ai.block = nearestBlock(ped.pos.x, ped.pos.z); ai.crossing = false; }
    return;
  }
  if (!ai.block) { ai.block = nearestBlock(ped.pos.x, ped.pos.z); ai.corner = 0; ai.direction = 1; ai.pace = 1.5; ai.pause = 0; }
  if (ai.pause > 0) { ai.pause -= dt; ped.vel.x = ped.vel.z = 0; ped.state = 'idle'; return; }
  const target = blockCorner(ai.block, ai.corner);
  ped.state = 'walk';
  const d = moveToward(ped, target.x, target.z, ai.crossing ? ai.pace * 1.5 : ai.pace, dt, 6);
  if (d < 0.7) chooseNextCorner(ped);
}

export function updatePedestrians(dt) {
  const p = game.player.pos;
  let count = 0;
  for (let i = game.characters.length - 1; i >= 0; i--) {
    const c = game.characters[i];
    if (c.kind !== 'ped') continue;
    if (!c.missionTag && distSq2d(c.pos.x, c.pos.z, p.x, p.z) > pedestrianConfig.despawn ** 2) { removeCharacter(c); continue; }
    count++;
    updatePedestrian(c, dt);
  }
  spawnCooldown -= dt;
  if (count < pedestrianConfig.target && spawnCooldown <= 0) { trySpawnPedestrian(pedestrianConfig.spawnMin, pedestrianConfig.spawnMax); spawnCooldown = 0.1; }
}

export function populatePedestriansAround(count, minDist = 8, maxDist = 120) {
  let made = 0;
  for (let k = 0; k < count * 10 && made < count; k++) if (trySpawnPedestrian(minDist, maxDist)) made++;
  return made;
}
