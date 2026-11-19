// Pursuit driving for police vehicles: route through the road graph when far, chase and ram on sight,
// reverse out when stuck, fire from the window at higher stars, and deploy officers on foot.
import { game } from '../core/gameState.js';
import { clamp, angleDiff } from '../core/mathUtils.js';
import { findNodePath, nearestNode } from '../world/roadNetwork.js';
import { hasLineOfSight } from '../world/collisionGrid.js';
import { spawnCharacter } from '../characters/characterEntity.js';
import { npcShootAt } from '../combat/weaponFire.js';

export function createPursuitBrain() {
  return { mode: 'police', state: 'pursue', occupants: 2, path: [], repath: 0, losTimer: 0, los: false, stuck: 0, reverse: 0, reverseSteer: 0, officers: [], gunner: null, hasDriver: true };
}

/** Put the unit's officers on the street beside their car. */
export function deployOfficers(v) {
  const ai = v.ai, swat = v.type === 'swat';
  for (let k = 0; k < ai.occupants; k++) {
    const side = k === 0 ? 1 : -1;
    const x = v.pos.x + Math.cos(v.heading) * side * (v.spec.width * 0.5 + 0.9), z = v.pos.z - Math.sin(v.heading) * side * (v.spec.width * 0.5 + 0.9);
    const cop = spawnCharacter({ x, z, heading: v.heading, kind: 'cop', look: swat ? 'swat' : 'cop', weapon: swat ? 'smg' : 'pistol', health: swat ? 130 : 80 });
    cop.homeVehicle = v; ai.officers.push(cop);
  }
  ai.occupants = 0; ai.state = 'parked';
}

function aimPoint(v, ai, target, dist) {
  const net = game.city.network;
  ai.losTimer -= game.dt;
  if (ai.losTimer <= 0) { ai.losTimer = 0.3; ai.los = hasLineOfSight(v.pos.x, v.pos.z, target.x, target.z); }
  if (dist < 70 && ai.los) {
    const lead = Math.min(1.1, dist / 38), tv = game.player.vehicle;
    return { x: target.x + (tv ? tv.vx : 0) * lead, z: target.z + (tv ? tv.vz : 0) * lead, direct: true };
  }
  ai.repath -= game.dt;
  if (ai.repath <= 0 || !ai.path.length) {
    ai.repath = 1.1;
    ai.path = findNodePath(net, nearestNode(net, v.pos.x, v.pos.z).id, nearestNode(net, target.x, target.z).id);
  }
  let node = net.nodes[ai.path[0]];
  // skip the first node once we are basically on it
  if (ai.path.length > 1 && (node.x - v.pos.x) ** 2 + (node.z - v.pos.z) ** 2 < 15 * 15) node = net.nodes[ai.path[1]];
  else if (ai.path.length === 1 && (node.x - v.pos.x) ** 2 + (node.z - v.pos.z) ** 2 < 15 * 15) return { x: target.x, z: target.z, direct: true };
  return { x: node.x, z: node.z, direct: false };
}

export function updatePoliceCruiser(v, dt) {
  const ai = v.ai, c = v.controls, player = game.player, stars = game.wanted.stars;
  const target = player.vehicle ? player.vehicle.pos : player.pos;
  const dx = target.x - v.pos.x, dz = target.z - v.pos.z, dist = Math.hypot(dx, dz);
  const playerSpeed = player.vehicle ? Math.abs(player.vehicle.speed) : 0;
  if (ai.state === 'parked') {
    c.throttle = 0; c.brake = 1; c.steer = 0;
    if (dist > 55) {            // suspect is getting away: officers pile back in and the chase resumes
      ai.occupants = 0;
      for (const cop of ai.officers) if (!cop.removed && cop.state !== 'dead' && cop.pos.distanceTo(v.pos) < 30) { cop.recall = true; ai.occupants++; }
      ai.officers = [];
      if (ai.occupants > 0) ai.state = 'pursue';
    }
    return;
  }
  if (ai.reverse > 0) {         // back out of a wall or pile-up
    ai.reverse -= dt; c.throttle = -1; c.steer = ai.reverseSteer; c.brake = 0; c.handbrake = false;
    return;
  }
  const aim = aimPoint(v, ai, target, dist);
  const diff = angleDiff(v.heading, Math.atan2(aim.x - v.pos.x, aim.z - v.pos.z));
  c.steer = clamp(diff * 2.3, -1, 1);
  c.boost = 1 + stars * 0.025;
  let throttle = 1, brake = 0; c.handbrake = false;
  const speed = v.speed;
  if (Math.abs(diff) > 0.85 && speed > 13) { throttle = 0; brake = 0.7; c.handbrake = Math.abs(diff) > 1.3; }
  else if (!aim.direct) {
    const nd = Math.hypot(aim.x - v.pos.x, aim.z - v.pos.z);
    if (nd < 34 && speed > 21 && Math.abs(diff) < 0.3) { throttle = 0.2; brake = 0.25; }     // ease off for the corner ahead
  }
  // suspect on foot or stopped: pull up and get out
  if (playerSpeed < 3.5 && dist < 26 && ai.los) {
    if (dist < 15 || speed < 3) { throttle = 0; brake = 1; if (Math.abs(speed) < 2.5 && ai.occupants > 0) { deployOfficers(v); return; } }
    else throttle = 0.35;
  }
  c.throttle = throttle; c.brake = brake;
  if (throttle > 0.3 && Math.abs(speed) < 1.3 && v.age > 2) ai.stuck += dt; else ai.stuck = Math.max(0, ai.stuck - dt * 2);
  if (ai.stuck > 1.2) { ai.stuck = 0; ai.reverse = 1.1 + Math.random() * 0.5; ai.reverseSteer = -Math.sign(c.steer || 1) * 0.9; }
  // officers shoot from the window at 3+ stars
  if (stars >= 3 && dist < 32 && ai.los && ai.occupants > 0) {
    if (!ai.gunner) ai.gunner = { pos: v.pos, heading: v.heading, vehicle: v, weapon: v.type === 'swat' ? 'smg' : 'pistol', fireCooldown: 1 + Math.random(), kind: 'cop' };
    ai.gunner.heading = Math.atan2(dx, dz);
    ai.gunner.fireCooldown = Math.max(0, ai.gunner.fireCooldown - dt);
    npcShootAt(ai.gunner, player, 0.22 + stars * 0.05);
  }
}
