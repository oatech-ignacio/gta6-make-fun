// Job: run a street race from start to finish. Purple R markers start one (E, in a vehicle); this module owns
// the 3-2-1 countdown, checkpoints, laps, three rival drivers, live position, prize money for 1st and 2nd,
// and the wins / best times kept in the save.
import { game } from '../core/gameState.js';
import { wasKeyPressed } from '../core/input.js';
import { setPrompt, playSound } from '../core/cues.js';
import { formatMoney, angleDiff } from '../core/mathUtils.js';
import { RACES } from './raceCatalog.js';
import { spawnRivals, removeRivals, holdRival, driveRival } from './raceRivals.js';
import { createMarker, removeMarker, isPlayerInMarker } from '../missions/missionMarkers.js';
import { addMoney, addRespect, spendMoney, getRespectRank } from '../systems/economy.js';
import { setObjective, showBigBanner, hideBigBanner } from '../ui/hud.js';
import { setMissionName } from '../ui/missionBanner.js';

const ORDINALS = ['', '1ST', '2ND', '3RD', '4TH'];
const race = { def: null, phase: 'idle', countdown: 0, time: 0, done: 0, total: 0, rivals: [], marker: null, cleanup: 0, result: null };
const checkpoint = (n) => race.def.checkpoints[n % race.def.checkpoints.length];

export function initStreetRaces() {
  for (const def of RACES) def.marker = createMarker({ x: def.start.x, z: def.start.z, color: 0xc77dff, icon: 'R', label: def.name, radius: 3.4, persistent: true, kind: 'shop', onMap: true });
}

export function isRaceActive() { return race.phase === 'countdown' || race.phase === 'run'; }
export function getRaceResult() { return race.result; }

/** True when the route bends at checkpoint n, so rivals brake for it. */
function bendsAt(n) {
  if (n + 1 >= race.total) return false;
  const s = race.def.start, a = n === 0 ? [s.x, s.z] : checkpoint(n - 1), b = checkpoint(n), c = checkpoint(n + 1);
  return Math.abs(angleDiff(Math.atan2(b[0] - a[0], b[1] - a[1]), Math.atan2(c[0] - b[0], c[1] - b[1]))) > 0.3;
}

function progressOf(done, pos) {
  const t = checkpoint(Math.min(done, race.total - 1));
  return done - Math.hypot(t[0] - pos.x, t[1] - pos.z) / 2000;
}

function placeCheckpointMarker() {
  if (race.marker) removeMarker(race.marker);
  const t = checkpoint(race.done), last = race.done === race.total - 1;
  race.marker = createMarker({ x: t[0], z: t[1], color: last ? 0xffe14d : 0xc77dff, radius: 8, label: last ? 'Finish' : 'Checkpoint', icon: 'R' });
}

export function startRace(id, free = false) {
  const def = RACES.find((r) => r.id === id), v = game.player.vehicle;
  if (!def || !v || isRaceActive() || (!free && !spendMoney(def.buyIn, 'race'))) return false;
  removeRivals(race.rivals);
  Object.assign(race, { def, phase: 'countdown', countdown: 3, time: 0, done: 0, total: def.checkpoints.length * def.laps, result: null });
  v.pos.set(def.start.x, v.pos.y, def.start.z); v.heading = def.start.heading; v.vx = v.vz = 0;
  race.rivals = spawnRivals(def);
  game.flags.controlsLocked = true;
  placeCheckpointMarker(); setMissionName(def.name); playSound('missionStart', v.pos);
  return true;
}

function endRace(text, sub, kind) {
  if (race.marker) removeMarker(race.marker);
  if (race.phase === 'countdown') game.flags.controlsLocked = false;
  Object.assign(race, { marker: null, phase: 'done', cleanup: 8 });
  setObjective(''); setMissionName('');
  if (!text) return;
  showBigBanner(text, sub, kind);
  setTimeout(() => { if (!game.activeMission) hideBigBanner(); }, 3500);
}

function finishRace(position) {
  const def = race.def, won = position === 1;
  const prize = won ? def.prize * (getRespectRank().index >= 3 ? 2 : 1) : position === 2 ? Math.round(def.prize * 0.3) : 0;
  if (prize) addMoney(prize, 'race');
  if (won) {
    addRespect(25); game.stats.racesWon++;
    game.races.wins[def.id] = true;
    game.races.best[def.id] = Math.min(game.races.best[def.id] || Infinity, Number(race.time.toFixed(1)));
  }
  race.result = { id: def.id, position, time: race.time, prize };
  endRace(won ? 'RACE WON' : `FINISHED ${ORDINALS[position]}`, `${race.time.toFixed(1)}s  ·  ${formatMoney(prize)}`, won ? '' : 'bad');
}

/** Tooling (tests, screenshot scenes): move the whole field to checkpoint n. */
export function skipToCheckpoint(n, time = race.time) {
  race.done = n; race.time = time;
  for (const r of race.rivals) r.done = n;
  placeCheckpointMarker();
  return race.rivals;
}

/** What the race HUD shows, or null when no race is running. */
export function getRaceStatus() {
  if (!isRaceActive()) return null;
  const def = race.def, n = def.checkpoints.length, mine = progressOf(race.done, game.player.pos), t = checkpoint(race.done);
  const position = 1 + race.rivals.filter((r) => r.done >= race.total || progressOf(r.done, r.v.pos) > mine).length;
  return { id: def.id, name: def.name, phase: race.phase, countdown: Math.ceil(race.countdown), position, ordinal: ORDINALS[position], racers: race.rivals.length + 1,
    lap: Math.min(def.laps, Math.floor(race.done / n) + 1), laps: def.laps, checkpoint: race.done % n + 1, checkpoints: n,
    time: race.time, par: def.par, best: game.races.best[def.id] || null, target: { x: t[0], z: t[1] } };
}

function offerRaces(player, v) {
  let prompt = null;
  if (v && !game.activeMission && game.wanted.stars === 0) {
    for (const def of RACES) {
      if (!isPlayerInMarker(def.marker, 1.5)) continue;
      prompt = `<kbd>E</kbd>Enter the ${def.name} &middot; ${def.laps > 1 ? def.laps + ' laps' : 'sprint'} &middot; ${formatMoney(def.buyIn)} buy-in`;
      if (wasKeyPressed('KeyE') && !startRace(def.id)) playSound('empty', player.pos);
    }
  }
  setPrompt('race', prompt);
}

export function updateStreetRaces(dt) {
  const player = game.player, v = player.vehicle;
  if (race.phase === 'done') { race.cleanup -= dt; if (race.cleanup <= 0) { removeRivals(race.rivals); Object.assign(race, { rivals: [], phase: 'idle' }); } }
  if (!isRaceActive()) return offerRaces(player, v);
  setPrompt('race', null);
  if (player.health <= 0) return endRace();
  if (!v || game.activeMission) return endRace('RACE OVER', 'You left the race', 'bad');
  const def = race.def;
  if (race.phase === 'countdown') {
    race.countdown -= dt;
    for (const r of race.rivals) holdRival(r);
    setObjective(`<b>${def.name}</b> &middot; engines running`);
    if (race.countdown <= 0) { race.phase = 'run'; game.flags.controlsLocked = false; playSound('pickup', player.pos); }
    return;
  }
  race.time += dt;
  for (const r of race.rivals) {
    if (r.done >= race.total) { holdRival(r); continue; }
    const t = checkpoint(r.done);
    if (driveRival(r, t[0] + r.offset, t[1] + r.offset, bendsAt(r.done), dt) < 11) r.done++;
  }
  if (isPlayerInMarker(race.marker, 2)) {
    race.done++; playSound('pickup', player.pos);
    if (race.done >= race.total) return finishRace(1 + race.rivals.filter((r) => r.done >= race.total).length);
    placeCheckpointMarker();
  }
  if (race.time > def.par * 2) return endRace('TOO SLOW', `Par time is ${def.par}s`, 'bad');
  setObjective(`Hit the <b>${race.done === race.total - 1 ? 'finish' : 'checkpoint'}</b> &middot; finish first for ${formatMoney(def.prize)}.`);
}
