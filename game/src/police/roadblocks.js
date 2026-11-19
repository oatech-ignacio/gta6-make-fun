// Roadblocks: at 3+ stars two cruisers park nose-to-tail across the road ahead of the fleeing player,
// with officers taking cover behind them.
import { game } from '../core/gameState.js';
import { nearestRoadPoint } from '../world/roadNetwork.js';
import { ROAD_HALF } from '../world/cityLayout.js';
import { spawnVehicle, isVehicleAt, removeVehicle } from '../vehicles/vehiclePhysics.js';
import { spawnCharacter } from '../characters/characterEntity.js';
import { showNotification } from '../ui/notifications.js';

const active = [];

/** Build a roadblock across the road at (x, z); `along` is the unit direction of the road. */
export function placeRoadblock(x, z, alongX, alongZ, withOfficers = true) {
  const perpX = -alongZ, perpZ = alongX;
  const block = { x, z, vehicles: [], officers: [], age: 0 };
  for (const side of [-1, 1]) {
    const vx = x + perpX * side * 3.6 + alongX * side * 0.8, vz = z + perpZ * side * 3.6 + alongZ * side * 0.8;
    if (isVehicleAt(vx, vz, 3)) continue;
    // parked across the lanes, slightly angled
    const v = spawnVehicle('police', vx, vz, Math.atan2(perpX, perpZ) + side * 0.22, { parked: true });
    v.ai = { mode: 'roadblock', hasDriver: false }; v.siren = true; v.controls.brake = 1;
    block.vehicles.push(v);
    if (withOfficers) {
      const cop = spawnCharacter({ x: vx + alongX * 2.6, z: vz + alongZ * 2.6, heading: Math.atan2(-alongX, -alongZ), kind: 'cop', look: 'cop', weapon: 'pistol', health: 80 });
      block.officers.push(cop);
    }
  }
  active.push(block);
  return block;
}

/** Try to set a roadblock one or two intersections ahead of the player's direction of travel. */
export function trySpawnRoadblock() {
  const pv = game.player.vehicle;
  if (!pv) return false;
  const net = game.city.network, speed = Math.hypot(pv.vx, pv.vz);
  if (speed < 8) return false;
  const dirX = pv.vx / speed, dirZ = pv.vz / speed;
  // project ahead and snap to the nearest road
  const ahead = 120 + speed * 1.6;
  const road = nearestRoadPoint(net, pv.pos.x + dirX * ahead, pv.pos.z + dirZ * ahead);
  if (road.dist > 30 || road.edge.noTraffic) return false;
  // keep it mid-block so it is not inside an intersection
  const a = net.nodes[road.edge.a], t = Math.max(ROAD_HALF + 14, Math.min(road.edge.length - ROAD_HALF - 14, road.t * road.edge.length));
  const x = a.x + road.dx * t, z = a.z + road.dz * t;
  if ((x - pv.pos.x) ** 2 + (z - pv.pos.z) ** 2 < 80 * 80) return false;
  placeRoadblock(x, z, road.dx, road.dz, true);
  showNotification('<b>POLICE SCANNER</b>Roadblock going up ahead. Find another way round.', 'warn', 4);
  return true;
}

export function updateRoadblocks(dt) {
  const p = game.player.pos;
  for (let i = active.length - 1; i >= 0; i--) {
    const b = active[i]; b.age += dt;
    const far = (b.x - p.x) ** 2 + (b.z - p.z) ** 2 > 230 * 230;
    if (far || (game.wanted.stars === 0 && b.age > 8)) {
      for (const v of b.vehicles) if (!v.removed && v.driver !== game.player && far) removeVehicle(v);
      if (far) active.splice(i, 1);
      else { for (const v of b.vehicles) v.siren = false; }
    }
  }
}

export function getActiveRoadblocks() { return active; }
