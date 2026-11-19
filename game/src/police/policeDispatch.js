// Police response director: how many units each wanted star deserves, where they spawn,
// when roadblocks and the helicopter are called in, and standing units down when the heat is off.
import { game } from '../core/gameState.js';
import { distSq2d } from '../core/mathUtils.js';
import { onEvent } from '../core/eventBus.js';
import { findNodePath, nearestNode } from '../world/roadNetwork.js';
import { spawnVehicle, removeVehicle, isVehicleAt } from '../vehicles/vehiclePhysics.js';
import { assignTrafficRoute } from '../vehicles/trafficAI.js';
import { updatePoliceCruiser, createPursuitBrain } from './policeCruiserAI.js';
import { updatePoliceOfficer } from './policeOfficerAI.js';
import { trySpawnRoadblock, updateRoadblocks } from './roadblocks.js';
import { updatePoliceHelicopter, requestHelicopter, dismissHelicopter } from './policeHelicopter.js';
import { removeCharacter } from '../characters/characterEntity.js';
import { reportCrime } from '../systems/wantedLevel.js';
import { playSound } from '../audio/soundEffects.js';

export const UNITS_PER_STAR = [0, 1, 2, 3, 4, 6];
let dispatchCooldown = 0, roadblockCooldown = 12;

export function initPoliceDispatch() {
  onEvent('wantedChanged', (e) => {
    if (e.stars > e.before) { dispatchCooldown = Math.min(dispatchCooldown, 0.5); playSound('radio', game.player.pos); }
    if (e.stars === 0) standDownAllUnits();
  });
  onEvent('vehicleCollision', (e) => {
    const playerCar = game.player.vehicle;
    if (!playerCar || e.impact < 8) return;
    const other = e.a === playerCar ? e.b : e.b === playerCar ? e.a : null;
    if (other && other.isPolice && other.ai) reportCrime('ramPolice', other.pos);
  });
}

export function countPursuitUnits() {
  let n = 0;
  for (const v of game.vehicles) if (v.isPolice && !v.wrecked && v.ai && v.ai.mode === 'police') n++;
  return n;
}

/** Spawn one cruiser (or a Bulwark van at 4+ stars) a few blocks away, already routed toward the player. */
export function spawnPoliceUnit(typeKey = null, forcedNode = null) {
  const net = game.city.network, p = game.player.pos;
  let node = forcedNode;
  for (let attempt = 0; attempt < 14 && !node; attempt++) {
    const n = game.rng.pick(net.nodes);
    const d2 = distSq2d(n.x, n.z, p.x, p.z);
    if (d2 < 105 * 105 || d2 > 215 * 215 || n.i > 9 || isVehicleAt(n.x, n.z, 6)) continue;
    node = n;
  }
  if (!node) return null;
  const path = findNodePath(net, node.id, nearestNode(net, p.x, p.z).id);
  const next = net.nodes[path[1] !== undefined ? path[1] : path[0]];
  const heading = Math.atan2(next.x - node.x, next.z - node.z) || 0;
  const type = typeKey || (game.wanted.stars >= 4 && game.rng.chance(0.35) ? 'swat' : 'police');
  const v = spawnVehicle(type, node.x, node.z, heading);
  v.ai = createPursuitBrain(); v.siren = true;
  v.vx = Math.sin(heading) * 12; v.vz = Math.cos(heading) * 12;
  return v;
}

function standDownAllUnits() {
  const net = game.city.network;
  for (const v of game.vehicles) {
    if (!v.isPolice || !v.ai || v.driver === game.player) continue;
    v.siren = false;
    if (v.ai.mode === 'police' && !v.wrecked) {
      const a = nearestNode(net, v.pos.x, v.pos.z), link = a.links.find((l) => !l.edge.noTraffic) || a.links[0];
      assignTrafficRoute(v, a.id, link.to, { cruise: 12 });
    }
  }
  for (const c of game.characters) if (c.kind === 'cop') { c.hostile = false; c.aiming = false; c.standDown = 20; }
  dismissHelicopter();
}

function recruitPatrolCars() {
  const p = game.player.pos;
  for (const v of game.vehicles) {
    if (v.isPolice && v.ai && v.ai.mode === 'traffic' && !v.wrecked && distSq2d(v.pos.x, v.pos.z, p.x, p.z) < 150 * 150) { v.ai = createPursuitBrain(); v.siren = true; }
  }
}

export function updatePoliceDispatch(dt) {
  const stars = game.wanted.stars, p = game.player.pos;
  dispatchCooldown -= dt; roadblockCooldown -= dt;
  if (stars > 0) {
    recruitPatrolCars();
    if (countPursuitUnits() < UNITS_PER_STAR[stars] && dispatchCooldown <= 0) { spawnPoliceUnit(); dispatchCooldown = 3.2 - stars * 0.35; }
    const pv = game.player.vehicle;
    if (stars >= 3 && pv && Math.abs(pv.speed) > 14 && roadblockCooldown <= 0) { if (trySpawnRoadblock()) roadblockCooldown = 26 - stars * 2; else roadblockCooldown = 3; }
    if (stars >= 4) requestHelicopter();
  }
  // update every unit, and clean up the ones left far behind
  for (let i = game.vehicles.length - 1; i >= 0; i--) {
    const v = game.vehicles[i];
    if (!v.isPolice || v.driver === game.player) continue;
    const d2 = distSq2d(v.pos.x, v.pos.z, p.x, p.z);
    if (d2 > 300 * 300 || (v.wrecked && d2 > 140 * 140) || (stars === 0 && v.ai && v.ai.mode !== 'traffic' && d2 > 120 * 120)) { removeVehicle(v); continue; }
    if (v.ai && v.ai.mode === 'police' && !v.wrecked && v.health > 0) updatePoliceCruiser(v, dt);
    else if (v.ai && v.ai.mode !== 'traffic') { v.controls.throttle = 0; v.controls.brake = 1; }
  }
  for (let i = game.characters.length - 1; i >= 0; i--) {
    const c = game.characters[i];
    if (c.kind !== 'cop') continue;
    const d2 = distSq2d(c.pos.x, c.pos.z, p.x, p.z);
    if (c.state === 'dead') { if (c.deadTime > 30 || d2 > 130 * 130) removeCharacter(c); continue; }
    if (d2 > 170 * 170 || (c.standDown !== undefined && (c.standDown -= dt) <= 0 && d2 > 45 * 45)) { removeCharacter(c); continue; }
    updatePoliceOfficer(c, dt);
  }
  updateRoadblocks(dt);
  updatePoliceHelicopter(dt);
}
