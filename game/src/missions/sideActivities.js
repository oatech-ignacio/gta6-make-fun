// Side hustle: Sunfare taxi fares (press T in a cab). Street races live in races/streetRaces.js.
import { game } from '../core/gameState.js';
import { isRaceActive } from '../races/streetRaces.js';
import { wasKeyPressed } from '../core/input.js';
import { PLACES, GRID_X, GRID_Z } from '../world/cityLayout.js';
import { createMarker, removeMarker, isPlayerInMarker } from './missionMarkers.js';
import { spawnCharacter, removeCharacter, randomCivilianLook, moveToward } from '../characters/characterEntity.js';
import { addMoney, addRespect, getRespectRank } from '../systems/economy.js';
import { setObjective, setPrompt } from '../ui/hud.js';
import { setMissionTimer, setMissionName } from '../ui/missionBanner.js';
import { showNotification } from '../ui/notifications.js';
import { formatMoney } from '../core/mathUtils.js';
import { playSound } from '../core/cues.js';

const taxi = { active: false, phase: 'idle', passenger: null, marker: null, timer: 0, fareDistance: 0, streak: 0 };

export function initSideActivities() {
  createMarker({ x: PLACES.taxiDepot.x, z: PLACES.taxiDepot.z, color: 0xffe14d, icon: 'T', label: PLACES.taxiDepot.name, radius: 1.5, persistent: true, kind: 'shop', beam: false });
}

function sidewalkPointNear(x, z, minD, maxD) {
  for (let k = 0; k < 30; k++) {
    const gx = game.rng.pick(GRID_X), gz = game.rng.pick(GRID_Z), vertical = game.rng.chance(0.5);
    const px = vertical ? gx + game.rng.sign() * 10 : gx + game.rng.range(20, 76), pz = vertical ? gz + game.rng.range(20, 76) : gz + game.rng.sign() * 10;
    const d = Math.hypot(px - x, pz - z);
    if (d >= minD && d <= maxD && px < 440 && pz < 340 && px > -440 && pz > -340) return { x: px, z: pz };
  }
  return { x: x + minD, z };
}

function endTaxiMode(message) {
  if (taxi.marker) removeMarker(taxi.marker);
  if (taxi.passenger && !taxi.passenger.removed) { if (taxi.phase === 'dropoff') removeCharacter(taxi.passenger); else taxi.passenger.kind = 'ped'; }
  Object.assign(taxi, { active: false, phase: 'idle', passenger: null, marker: null, streak: 0 });
  setObjective(''); setMissionTimer(null); setMissionName('');
  if (message) showNotification(message, '', 4);
}

function nextFare() {
  const v = game.player.vehicle, spot = sidewalkPointNear(v.pos.x, v.pos.z, 60, 190);
  const ped = spawnCharacter({ x: spot.x, z: spot.z, kind: 'npc', look: randomCivilianLook(game.rng) });
  ped.handsUp = true; ped.missionTag = 'taxi';
  taxi.passenger = ped; taxi.phase = 'pickup';
  if (taxi.marker) removeMarker(taxi.marker);
  taxi.marker = createMarker({ x: spot.x, z: spot.z, color: 0xffe14d, radius: 4, label: 'Fare', icon: 'T' });
  setObjective('Pick up the <b>fare</b> waving on the sidewalk.');
}

function updateTaxi(dt) {
  const player = game.player, v = player.vehicle, inCab = v && v.type === 'taxi';
  if (!taxi.active) {
    if (inCab && !game.activeMission && !isRaceActive()) {
      setPrompt('side', '<kbd>T</kbd>Start Sunfare taxi fares');
      if (wasKeyPressed('KeyT')) { taxi.active = true; setMissionName('Sunfare Cabs'); nextFare(); playSound('pickup', player.pos); }
    } else setPrompt('side', null);
    return;
  }
  setPrompt('side', null);
  if (!inCab || game.activeMission) return endTaxiMode('<b>SUNFARE CABS</b>Shift over.');
  if (wasKeyPressed('KeyT')) return endTaxiMode('<b>SUNFARE CABS</b>Off the clock.');
  const ped = taxi.passenger;
  if (taxi.phase === 'pickup') {
    if (ped.state === 'dead' || ped.removed) { showNotification('Your fare is... no longer travelling.', 'warn', 3); return nextFare(); }
    const d = Math.hypot(v.pos.x - ped.pos.x, v.pos.z - ped.pos.z);
    if (d < 9 && Math.abs(v.speed) < 3) {
      ped.handsUp = false;
      if (moveToward(ped, v.pos.x, v.pos.z, 4.5, dt) < 2.6) {
        ped.vehicle = v; ped.mesh.visible = false; ped.state = 'driving';
        const dest = sidewalkPointNear(v.pos.x, v.pos.z, 220, 520);
        taxi.fareDistance = Math.hypot(dest.x - v.pos.x, dest.z - v.pos.z);
        taxi.timer = 18 + taxi.fareDistance / 9; taxi.phase = 'dropoff';
        removeMarker(taxi.marker);
        taxi.marker = createMarker({ x: dest.x, z: dest.z, color: 0xffe14d, radius: 5, label: 'Drop-off', icon: 'T' });
        setObjective('Drive the fare to the <b>drop-off</b> before the meter runs out.');
        playSound('door', v.pos);
      }
    } else ped.vel.x = ped.vel.z = 0;
  } else if (taxi.phase === 'dropoff') {
    taxi.timer -= dt; setMissionTimer(taxi.timer);
    if (taxi.timer <= 0) { ped.vehicle = null; removeCharacter(ped); taxi.passenger = null; showNotification('<b>FARE LOST</b>Too slow. They walked.', 'warn', 3); taxi.streak = 0; return nextFare(); }
    if (isPlayerInMarker(taxi.marker, 2) && Math.abs(v.speed) < 3) {
      taxi.streak++;
      const pay = Math.round((40 + taxi.fareDistance * 0.5 + taxi.timer * 4) * (getRespectRank().index >= 1 ? 2 : 1) * (1 + taxi.streak * 0.1));
      addMoney(pay, 'taxi'); addRespect(3); game.stats.taxiFares++;
      showNotification(`<b>FARE COMPLETE</b>${formatMoney(pay)} with tip. Streak x${taxi.streak}.`, 'money', 4);
      playSound('cash', player.pos);
      ped.vehicle = null; removeCharacter(ped); taxi.passenger = null; setMissionTimer(null);
      nextFare();
    }
  }
}

export function updateSideActivities(dt) {
  if (game.player.health <= 0) { if (taxi.active) endTaxiMode(); return; }
  updateTaxi(dt);
}

export function isSideActivityActive() { return taxi.active || isRaceActive(); }
