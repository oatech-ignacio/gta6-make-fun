// Roster of every police unit currently responding to the player: cruisers, vans, officers on foot,
// the helicopter and roadblocks, each with a radio callsign, a distance and a status word taken from its AI.
import { game } from '../core/gameState.js';
import { getCruiserStatus } from './policeCruiserAI.js';
import { getOfficerStatus } from './policeOfficerAI.js';
import { getHelicopterStatus } from './policeHelicopter.js';
import { getActiveRoadblocks } from './roadblocks.js';

const counters = { MARLIN: 0, BULWARK: 0, REEF: 0 };

/** Callsigns are handed out once per unit and stay with it: MARLIN-3, BULWARK-1, CORAL-85, REEF-2, KITE-1. */
function callsignFor(unit, prefix) {
  if (!unit.callsign) {
    if (prefix === 'CORAL') unit.callsign = 'CORAL-' + (11 + Math.floor(Math.random() * 88));   // badge number
    else unit.callsign = `${prefix}-${++counters[prefix]}`;
  }
  return unit.callsign;
}

/** Every active unit, nearest first. kind: 'cruiser' | 'van' | 'officer' | 'air' | 'roadblock'. */
export function getPoliceUnits() {
  const p = game.player.vehicle ? game.player.vehicle.pos : game.player.pos, units = [];
  const add = (kind, callsign, x, z, status) => units.push({ kind, callsign, status, distance: Math.hypot(x - p.x, z - p.z) });
  for (const v of game.vehicles) {
    if (!v.isPolice || v.wrecked || v.removed || v.driver === game.player) continue;
    const status = getCruiserStatus(v);
    if (status && status !== 'ON FOOT') add(v.type === 'swat' ? 'van' : 'cruiser', callsignFor(v, v.type === 'swat' ? 'BULWARK' : 'MARLIN'), v.pos.x, v.pos.z, status);
  }
  for (const c of game.characters) {
    if (c.kind !== 'cop' || c.removed) continue;
    const status = getOfficerStatus(c);
    if (status) add('officer', callsignFor(c, 'CORAL'), c.pos.x, c.pos.z, status);
  }
  for (const b of getActiveRoadblocks()) {
    if (game.wanted.stars > 0 && b.vehicles.some((v) => !v.removed && !v.wrecked)) add('roadblock', callsignFor(b, 'REEF'), b.x, b.z, 'ROADBLOCK');
  }
  const heli = getHelicopterStatus();
  if (heli) add('air', 'KITE-1', heli.x, heli.z, heli.status);
  return units.sort((a, b) => a.distance - b.distance);
}

/** The few units worth showing: the helicopter and nearest roadblock always make the list, then the closest of the rest. */
export function getHeadlineUnits(limit = 5) {
  const all = getPoliceUnits(), special = [];
  for (const kind of ['air', 'roadblock']) { const u = all.find((x) => x.kind === kind); if (u) special.push(u); }
  const rest = all.filter((u) => !special.includes(u)).slice(0, Math.max(0, limit - special.length));
  return { units: [...rest, ...special].sort((a, b) => a.distance - b.distance), total: all.length };
}
