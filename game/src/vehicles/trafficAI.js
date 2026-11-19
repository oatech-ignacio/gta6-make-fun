// Ambient traffic: spawns cars on the road graph around the player, drives them lane-by-lane with
// signal stops, queueing behind other cars, braking for pedestrians, panic when shots are fired; also parked cars.
import { game } from '../core/gameState.js';
import { clamp, angleDiff, distSq2d } from '../core/mathUtils.js';
import { onEvent } from '../core/eventBus.js';
import { getLaneLine, pickNextNode, randomTrafficEdge, nearestNode } from '../world/roadNetwork.js';
import { ROAD_HALF, LANE_OFFSETS } from '../world/cityLayout.js';
import { getSignalState } from './trafficLights.js';
import { spawnVehicle, removeVehicle, isVehicleAt } from './vehiclePhysics.js';
import { pickTrafficType } from './vehicleCatalog.js';

export const trafficConfig = { targetMoving: 20, targetParked: 9, spawnMin: 95, spawnMax: 210, despawn: 270 };
let spawnCooldown = 0;

export function initTraffic() {
  onEvent('gunfire', (e) => {
    for (const v of game.vehicles) {
      if (v.ai && v.ai.mode === 'traffic' && distSq2d(v.pos.x, v.pos.z, e.x, e.z) < 45 * 45) v.ai.panic = 9;
    }
  });
}

/** Give a vehicle a traffic brain travelling from one intersection toward a neighbour. */
export function assignTrafficRoute(v, fromId, toId, options = {}) {
  v.ai = { mode: 'traffic', from: fromId, to: toId, lane: options.lane || game.rng.pick(LANE_OFFSETS), cruise: options.cruise || game.rng.range(10.5, 15.5), panic: 0, wait: 0, flee: !!options.flee, allowCauseway: !!options.allowCauseway, hasDriver: true, blocked: 0 };
  return v;
}

export function spawnTrafficVehicleOnEdge(edge, t, forward, typeKey) {
  const net = game.city.network;
  const from = forward ? edge.a : edge.b, to = forward ? edge.b : edge.a;
  const lane = game.rng.pick(LANE_OFFSETS), line = getLaneLine(net, from, to, lane);
  const along = ROAD_HALF + 4 + t * (line.len - ROAD_HALF * 2 - 8);
  const x = line.sx + line.dx * along, z = line.sz + line.dz * along;
  if (isVehicleAt(x, z, 5)) return null;
  const v = spawnVehicle(typeKey || pickTrafficType(game.rng).key, x, z, line.heading);
  assignTrafficRoute(v, from, to, { lane });
  v.vx = line.dx * 9; v.vz = line.dz * 9;
  return v;
}

function trySpawnAmbientCar() {
  const net = game.city.network, p = game.player.pos, cam = game.camera;
  for (let attempt = 0; attempt < 6; attempt++) {
    const edge = randomTrafficEdge(net, game.rng), a = net.nodes[edge.a], b = net.nodes[edge.b], t = game.rng();
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    const d2 = distSq2d(x, z, p.x, p.z);
    if (d2 < trafficConfig.spawnMin ** 2 || d2 > trafficConfig.spawnMax ** 2) continue;
    // avoid popping in right in front of the camera unless it is far away
    const d = Math.sqrt(d2), e = cam.matrixWorld.elements, dot = ((x - cam.position.x) * -e[8] + (z - cam.position.z) * -e[10]) / d;
    if (dot > 0.55 && d < 150 && game.mode !== 'shot') continue;
    if (spawnTrafficVehicleOnEdge(edge, t, game.rng.chance(0.5), game.rng.chance(0.07) ? 'police' : null)) return true;
  }
  return false;
}

function manageParkedCars() {
  const p = game.player.pos, spots = game.city.parkingSpots;
  let parked = 0;
  for (const v of game.vehicles) if (v.parkSpot) parked++;
  if (parked >= trafficConfig.targetParked) return;
  for (let k = 0; k < 8; k++) {
    const s = game.rng.pick(spots);
    if (!s || s.used) continue;
    const d2 = distSq2d(s.x, s.z, p.x, p.z);
    if (d2 > 200 * 200 || d2 < 40 * 40 || isVehicleAt(s.x, s.z, 4)) continue;
    const v = spawnVehicle(pickTrafficType(game.rng).key, s.x, s.z, s.heading, { parked: true });
    v.parkSpot = s; s.used = true;
    return;
  }
}

function obstacleAhead(v, fx, fz) {
  const look = 7 + Math.abs(v.speed) * 0.95;
  let nearest = Infinity;
  for (const o of game.vehicles) {
    if (o === v) continue;
    const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z;
    const f = dx * fx + dz * fz;
    if (f < 0.5 || f > look + o.halfLen + v.halfLen) continue;
    const l = Math.abs(dx * -fz + dz * fx);
    if (l < 1.9) nearest = Math.min(nearest, f - o.halfLen - v.halfLen);
  }
  for (const c of game.characters) {
    if (c.vehicle || c.state === 'dead') continue;
    const dx = c.pos.x - v.pos.x, dz = c.pos.z - v.pos.z;
    const f = dx * fx + dz * fz;
    if (f < 0.5 || f > 9 + v.halfLen) continue;
    if (Math.abs(dx * -fz + dz * fx) < 1.7) nearest = Math.min(nearest, f - v.halfLen - 1.5);
  }
  return nearest;
}

/** Lane following for one AI car (also used by fleeing mission targets and off-duty police). */
export function driveTrafficVehicle(v, dt) {
  const ai = v.ai, net = game.city.network, c = v.controls;
  let line = getLaneLine(net, ai.from, ai.to, ai.lane);
  let t = (v.pos.x - line.sx) * line.dx + (v.pos.z - line.sz) * line.dz;
  if (t > line.len - ROAD_HALF - 0.5) {            // entering the intersection: pick the next road
    const next = pickNextNode(net, ai.from, ai.to, game.rng, ai.allowCauseway);
    ai.from = ai.to; ai.to = next;
    line = getLaneLine(net, ai.from, ai.to, ai.lane);
    t = (v.pos.x - line.sx) * line.dx + (v.pos.z - line.sz) * line.dz;
  }
  const aheadT = Math.max(t + 7 + Math.abs(v.speed) * 0.35, ROAD_HALF + 2);
  const tx = line.sx + line.dx * aheadT, tz = line.sz + line.dz * aheadT;
  const diff = angleDiff(v.heading, Math.atan2(tx - v.pos.x, tz - v.pos.z));
  c.steer = clamp(diff * 2.4, -1, 1);
  const hurry = ai.panic > 0 || ai.flee;
  ai.panic = Math.max(0, ai.panic - dt);
  let desired = hurry ? (ai.flee ? ai.cruise : 25) : ai.cruise;
  if (Math.abs(diff) > 0.35) desired = Math.min(desired, hurry ? 13 : 7);
  const remaining = line.len - ROAD_HALF - t;
  if (!hurry && remaining > 0 && remaining < 20) {
    const state = getSignalState(net.nodes[ai.to], Math.abs(line.dx) > 0.5);
    if (state === 'red' || (state === 'yellow' && remaining > 7)) desired = remaining < 3 ? 0 : Math.min(desired, remaining * 0.9);
  }
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  const gap = obstacleAhead(v, fx, fz);
  if (gap < Infinity) {
    if (gap < 2.2) desired = 0; else desired = Math.min(desired, (gap - 2) * (hurry ? 2.2 : 1.1));
    ai.blocked += dt;
  } else ai.blocked = 0;
  if (v.speed < desired - 0.6) { c.throttle = hurry ? 1 : 0.55; c.brake = 0; }
  else if (v.speed > desired + 1.2 || desired === 0) { c.throttle = 0; c.brake = desired === 0 ? 1 : clamp((v.speed - desired) / 5, 0.15, 1); }
  else { c.throttle = 0.12; c.brake = 0; }
  c.handbrake = false;
  // gridlock breaker: after waiting too long behind something, creep around it
  if (ai.blocked > 9 && gap > 0.8) { c.throttle = 0.4; c.brake = 0; c.steer = clamp(c.steer + 0.5, -1, 1); if (ai.blocked > 13) ai.blocked = 0; }
}

export function updateTraffic(dt) {
  const p = game.player.pos;
  let moving = 0;
  for (let i = game.vehicles.length - 1; i >= 0; i--) {
    const v = game.vehicles[i];
    const d2 = distSq2d(v.pos.x, v.pos.z, p.x, p.z);
    const ambient = (v.ai && v.ai.mode === 'traffic' && !v.ai.flee) || v.parkSpot || (!v.ai && !v.driver && !v.missionTag && !v.isPolice) || (v.wrecked && !v.missionTag);
    if (ambient && v.driver !== game.player && d2 > (v.wrecked ? 150 : trafficConfig.despawn) ** 2 && v !== game.player.lastVehicle) {
      if (v.parkSpot) v.parkSpot.used = false;
      removeVehicle(v); continue;
    }
    if (v.ai && v.ai.mode === 'traffic') { if (!v.ai.flee) moving++; if (!v.wrecked && v.health > 0) driveTrafficVehicle(v, dt); else { v.controls.throttle = 0; v.controls.brake = 0.4; } }
  }
  spawnCooldown -= dt;
  if (moving < trafficConfig.targetMoving && spawnCooldown <= 0) { trySpawnAmbientCar(); spawnCooldown = 0.12; }
  manageParkedCars();
}

/** Fill the streets around a point immediately (new game, respawn, screenshots). */
export function populateTrafficAround(x, z, count, minDist = 25, maxDist = 190) {
  const net = game.city.network;
  let made = 0;
  for (let attempt = 0; attempt < count * 12 && made < count; attempt++) {
    const edge = randomTrafficEdge(net, game.rng), a = net.nodes[edge.a], b = net.nodes[edge.b], t = game.rng();
    const ex = a.x + (b.x - a.x) * t, ez = a.z + (b.z - a.z) * t, d2 = distSq2d(ex, ez, x, z);
    if (d2 < minDist * minDist || d2 > maxDist * maxDist) continue;
    if (spawnTrafficVehicleOnEdge(edge, t, game.rng.chance(0.5))) made++;
  }
  return made;
}

export function nearestRoadNodeId(x, z) { return nearestNode(game.city.network, x, z).id; }
