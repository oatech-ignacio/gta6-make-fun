// Side hustles: Sunfare taxi fares (press T in a cab) and the Boulevard Sprint checkpoint race.
import { game } from '../core/gameState.js';
import { wasKeyPressed } from '../core/input.js';
import { PLACES, GRID_X, GRID_Z } from '../world/cityLayout.js';
import { createMarker, removeMarker, isPlayerInMarker } from './missionMarkers.js';
import { spawnCharacter, removeCharacter, randomCivilianLook, moveToward } from '../characters/characterEntity.js';
import { addMoney, addRespect, getRespectRank, spendMoney } from '../systems/economy.js';
import { setObjective, setMissionTimer, setMissionName, setPrompt, showBigBanner } from '../ui/hud.js';
import { showNotification } from '../ui/notifications.js';
import { formatMoney } from '../core/mathUtils.js';
import { playSound } from '../core/cues.js';

const taxi = { active: false, phase: 'idle', passenger: null, marker: null, timer: 0, fareDistance: 0, streak: 0 };
const race = { active: false, index: 0, marker: null, time: 0, startMarker: null, best: null };

// A lap of the east side: up the boulevard, through Neon Row, back along the beach.
export const RACE_CHECKPOINTS = [[GRID_X[9], -144], [GRID_X[9], 48], [GRID_X[9], 240], [GRID_X[7], 240], [GRID_X[7], 48], [GRID_X[5], 48], [GRID_X[5], -144], [GRID_X[7], -144], [GRID_X[7], -336], [GRID_X[9], -336], [GRID_X[9], -290]];
export const RACE_PAR_TIME = 92;

export function initSideActivities() {
  race.startMarker = createMarker({ x: PLACES.raceStart.x, z: PLACES.raceStart.z, color: 0xc77dff, icon: 'R', label: 'Boulevard Sprint', radius: 3.4, persistent: true, kind: 'shop' });
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
    if (inCab && !game.activeMission && !race.active) {
      setPrompt('side', '<kbd>T</kbd>Start Sunfare taxi fares');
      if (wasKeyPressed('KeyT')) { taxi.active = true; setMissionName('Sunfare Cabs'); nextFare(); playSound('pickup', player.pos); }
    } else if (!race.active) setPrompt('side', null);
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

function endRace(won) {
  if (race.marker) removeMarker(race.marker);
  race.marker = null; race.active = false;
  setObjective(''); setMissionTimer(null); setMissionName('');
  if (won === undefined) return;
  if (won) {
    const prize = getRespectRank().index >= 3 ? 3000 : 1200;
    addMoney(prize, 'race'); addRespect(25); game.stats.racesWon++;
    race.best = race.best ? Math.min(race.best, race.time) : race.time;
    showBigBanner('RACE WON', `${race.time.toFixed(1)}s  ·  ${formatMoney(prize)}`, '');
  } else showBigBanner('TOO SLOW', `Par time is ${RACE_PAR_TIME}s`, 'bad');
  setTimeout(() => { if (!game.activeMission) document.getElementById('big-banner').classList.add('hidden'); }, 3500);
}

function updateRace(dt) {
  const player = game.player, v = player.vehicle;
  if (!race.active) {
    if (v && !game.activeMission && !taxi.active && isPlayerInMarker(race.startMarker, 1)) {
      setPrompt('side', '<kbd>E</kbd>Enter the Boulevard Sprint &middot; $200 buy-in');
      if (wasKeyPressed('KeyE') && spendMoney(200, 'race')) {
        Object.assign(race, { active: true, index: 0, time: 0 });
        setMissionName('Boulevard Sprint');
        race.marker = createMarker({ x: RACE_CHECKPOINTS[0][0], z: RACE_CHECKPOINTS[0][1], color: 0xc77dff, radius: 7, label: 'Checkpoint', icon: 'R' });
        playSound('missionStart', player.pos);
      }
    }
    return;
  }
  if (!v) return endRace(false);
  race.time += dt;
  setMissionTimer(RACE_PAR_TIME - race.time);
  setObjective(`Checkpoint <b>${race.index + 1}/${RACE_CHECKPOINTS.length}</b> &middot; beat the par time.`);
  if (race.time > RACE_PAR_TIME) return endRace(false);
  if (isPlayerInMarker(race.marker, 2)) {
    race.index++;
    playSound('pickup', player.pos);
    if (race.index >= RACE_CHECKPOINTS.length) return endRace(true);
    race.marker.x = RACE_CHECKPOINTS[race.index][0]; race.marker.z = RACE_CHECKPOINTS[race.index][1];
  }
}

export function updateSideActivities(dt) {
  if (game.player.health <= 0) { if (taxi.active) endTaxiMode(); if (race.active) endRace(); return; }
  updateTaxi(dt);
  updateRace(dt);
}

export function isSideActivityActive() { return taxi.active || race.active; }
