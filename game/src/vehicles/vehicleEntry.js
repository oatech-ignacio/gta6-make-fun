// Getting in and out of vehicles with F: stealing parked cars, pulling drivers out of traffic (carjacking),
// bailing out at speed, and seating passengers for missions.
import { game } from '../core/gameState.js';
import { findNearestVehicle } from './vehiclePhysics.js';
import { stopVehicle } from './playerDriving.js';
import { isPointInsideStatic } from '../world/collisionGrid.js';
import { isOnLand } from '../world/cityLayout.js';
import { spawnCharacter, knockDownCharacter, randomCivilianLook } from '../characters/characterEntity.js';
import { reportCrime } from '../systems/wantedLevel.js';
import { emitEvent } from '../core/eventBus.js';
import { playSound } from '../core/cues.js';
import { snapCameraBehind, cameraRig } from '../render/followCamera.js';
import { showNotification } from '../ui/notifications.js';
import { damageCharacter } from '../combat/damageSystem.js';

export function findEnterableVehicle(character, range = 4.6) {
  return findNearestVehicle(character.pos.x, character.pos.z, range, (v) => !v.wrecked && !v.locked && v.driver !== character);
}

function doorPosition(v, side) {
  // side +1 = driver's side (left of the car), -1 = passenger side
  const lx = Math.cos(v.heading) * side, lz = -Math.sin(v.heading) * side, off = v.spec.width * 0.5 + 0.75;
  return { x: v.pos.x + lx * off, z: v.pos.z + lz * off };
}

/** Throw the AI driver onto the street; they stumble, then run for it. */
export function ejectDriver(v, byPlayer = true) {
  if (v.ai && v.ai.hasDriver) {
    const door = doorPosition(v, 1.4);
    const cop = v.isPolice;
    const ped = spawnCharacter({ x: door.x, z: door.z, heading: v.heading + Math.PI / 2, kind: cop ? 'cop' : 'ped', look: cop ? 'cop' : randomCivilianLook(game.rng) });
    knockDownCharacter(ped, 1.6, { x: Math.cos(v.heading) * 3, z: -Math.sin(v.heading) * 3 });
    ped.fleeFrom = { x: v.pos.x, z: v.pos.z }; ped.panic = 14;
    if (cop) { ped.weapon = 'pistol'; ped.hostile = true; }
    v.ai = null;
    if (byPlayer) { playSound('yell', v.pos); reportCrime(cop ? 'stealPolice' : 'carjack', v.pos); }
    return ped;
  }
  if (v.driver && v.driver !== game.player) { const d = v.driver; leaveVehicle(d); knockDownCharacter(d, 1.5); return d; }
  return null;
}

export function enterVehicle(character, v) {
  if (character === game.player) {
    const hadDriver = !!(v.ai && v.ai.hasDriver) || (v.driver && v.driver !== character);
    if (hadDriver) ejectDriver(v, true);
    else if (!v.playerOwned && !v.missionTag) reportCrime('carTheft', v.pos);
    if (!v.playerOwned) { v.playerOwned = true; game.stats.carsStolen++; }
    if (v.parkSpot) { v.parkSpot.used = false; v.parkSpot = null; }
    v.parked = false; v.ai = null;
    game.player.lastVehicle = v;
    cameraRig.idleLook = 5;
    showNotification(`<b>${v.spec.name}</b>${v.spec.klass} &middot; ${v.isPolice ? 'E toggles the siren' : 'R changes radio station'}`, 'gold', 3);
  }
  v.driver = character;
  character.vehicle = v; character.state = 'driving';
  character.mesh.visible = v.type === 'bike';
  character.vel.x = character.vel.z = 0;
  playSound('door', v.pos);
  emitEvent('enteredVehicle', { character, vehicle: v });
}

export function leaveVehicle(character, forcedSide) {
  const v = character.vehicle;
  if (!v) return;
  let spot = null;
  for (const side of forcedSide ? [forcedSide] : [1, -1, 1.8, -1.8]) {
    const p = doorPosition(v, side);
    if (!isPointInsideStatic(p.x, p.z, 0.4) && isOnLand(p.x, p.z, 0.3)) { spot = p; break; }
  }
  if (!spot) spot = doorPosition(v, 1);
  if (v.driver === character) { v.driver = null; stopVehicle(v); }
  const pi = v.passengers.indexOf(character); if (pi >= 0) v.passengers.splice(pi, 1);
  character.vehicle = null; character.state = 'idle';
  character.pos.set(spot.x, 0, spot.z); character.heading = v.heading;
  character.mesh.visible = true;
  const speed = Math.abs(v.speed);
  if (speed > 11) {            // bailing out of a moving car hurts
    knockDownCharacter(character, 1.4, { x: v.vx * 0.5, z: v.vz * 0.5 });
    damageCharacter(character, (speed - 8) * 1.4, null, 'fall');
  }
  playSound('door', v.pos);
  if (character === game.player) snapCameraBehind(v.heading);
  emitEvent('leftVehicle', { character, vehicle: v });
}

/** Seat an ally/mission character as a passenger (they ride invisibly inside the car). */
export function seatPassenger(character, v) {
  character.vehicle = v; character.state = 'driving'; character.mesh.visible = false;
  if (!v.passengers.includes(character)) v.passengers.push(character);
}

/** F key handler for the player. Returns true when something happened. */
export function handleEnterExitKey() {
  const player = game.player;
  if (player.health <= 0 || player.state === 'down') return false;
  if (player.vehicle) { leaveVehicle(player); return true; }
  const v = findEnterableVehicle(player);
  if (!v) return false;
  enterVehicle(player, v);
  return true;
}
