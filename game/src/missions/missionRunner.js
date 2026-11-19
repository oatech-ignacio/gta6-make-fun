// Story mission engine: start markers, step-by-step scripting (drive-to, steal, deliver, chase, shoot-out,
// getaway, heist hold-out), objectives, timers, failure and rewards.
import { game } from '../core/gameState.js';
import { onEvent, emitEvent } from '../core/eventBus.js';
import { PLACES } from '../world/cityLayout.js';
import { STORY_MISSIONS, getMissionByIndex } from './storyMissions.js';
import { STORY_CAST } from './storyCharacters.js';
import { createMarker, removeMarker, clearMissionMarkers, isPlayerInMarker } from './missionMarkers.js';
import { playDialogue, isDialogueActive, stopDialogue } from '../ui/dialogueBox.js';
import { setObjective, setMissionName, setMissionTimer, setProgress, showTitleCard, showBigBanner, hideBigBanner } from '../ui/hud.js';
import { showNotification } from '../ui/notifications.js';
import { addMoney, addRespect } from '../systems/economy.js';
import { setWantedLevel } from '../systems/wantedLevel.js';
import { giveWeapon, selectWeapon } from '../combat/weaponCatalog.js';
import { spawnVehicle, removeVehicle } from '../vehicles/vehiclePhysics.js';
import { assignTrafficRoute } from '../vehicles/trafficAI.js';
import { seatPassenger } from '../vehicles/vehicleEntry.js';
import { spawnCharacter, removeCharacter, faceToward, moveToward } from '../characters/characterEntity.js';
import { npcShootAt } from '../combat/weaponFire.js';
import { hasLineOfSight } from '../world/collisionGrid.js';
import { spawnPickup, removePickup } from '../systems/pickups.js';
import { formatMoney } from '../core/mathUtils.js';
import { playSound } from '../audio/soundEffects.js';

let startMarker = null, startMarkerIndex = -1, bannerTimer = 0, giverNpc = null;

export function initMissions() {
  onEvent('playerDown', (e) => { if (game.activeMission) failMission(e.kind === 'busted' ? 'You were busted.' : 'You were wasted.'); });
}

function resolvePoint(ref) { return typeof ref === 'string' ? PLACES[ref] : ref; }

/** Place (or move) the letter marker where the next story mission begins. */
export function refreshMissionStartMarker() {
  if (startMarker) { removeMarker(startMarker); startMarker = null; }
  startMarkerIndex = game.missionIndex;
  const def = getMissionByIndex(game.missionIndex);
  if (!def || game.activeMission) return;
  const place = PLACES[def.place], cast = STORY_CAST[def.giver];
  const offset = def.place === 'safehouse' ? 5 : 0;
  startMarker = createMarker({ x: place.x, z: place.z + offset, color: 0xffd166, icon: cast.name[0], label: `${def.title} (${cast.name})`, radius: 1.5, persistent: true, kind: 'missionStart' });
  // the contact waits beside the marker
  if (giverNpc && !giverNpc.removed) removeCharacter(giverNpc);
  giverNpc = spawnCharacter({ x: place.x + Math.sin(place.heading) * -2.2, z: place.z + offset + Math.cos(place.heading) * -2.2 - 1.2, heading: place.heading, kind: 'npc', look: cast.look, name: cast.name });
  giverNpc.invulnerable = true;
}

/** Skip ahead to the first step of a given type in the active mission (debugging and screenshot staging). */
export function jumpToMissionStep(type) {
  const m = game.activeMission;
  if (!m) return;
  stopDialogue();
  const index = m.def.steps.findIndex((s, i) => i > m.stepIndex && s.type === type);
  if (index < 0) return;
  m.stepIndex = index - 1;
  advanceStep(m);
}

export function startMission(index) {
  const def = getMissionByIndex(index);
  if (!def || game.activeMission) return null;
  if (startMarker) { removeMarker(startMarker); startMarker = null; }
  const m = { def, index, stepIndex: -1, step: null, state: {}, entities: [], vehicles: [], pickups: [], marker: null, vehicle: null, target: null, elapsed: 0 };
  game.activeMission = m;
  setMissionName(def.title);
  showTitleCard(`MISSION ${index + 1} · ${STORY_CAST[def.giver].name.toUpperCase()}`, def.title, def.blurb);
  playSound('missionStart', game.player.pos);
  emitEvent('missionStarted', m);
  advanceStep(m);
  return m;
}

function setMarker(m, options) {
  if (m.marker) removeMarker(m.marker);
  m.marker = options ? createMarker(options) : null;
  return m.marker;
}

function advanceStep(m) {
  m.stepIndex++;
  m.state = {};
  setMarker(m, null); setMissionTimer(null); setProgress(null);
  const step = m.def.steps[m.stepIndex];
  m.step = step || null;
  if (!step) return completeMission(m);
  setObjective(step.text || '');
  const begin = STEP_HANDLERS[step.type].begin;
  if (begin) begin(m, step);
}

function cleanupMission(m, keepPlayerVehicle = true) {
  clearMissionMarkers(); stopDialogue();
  for (const c of m.entities) if (!c.removed) { if (c.state === 'dead' || c.kind === 'npc') removeCharacter(c); else { c.missionTag = null; c.kind = c.kind === 'npc' ? 'ped' : c.kind; if (c.vehicle) { c.vehicle = null; removeCharacter(c); } } }
  for (const v of m.vehicles) if (!v.removed) { v.missionTag = null; if (v.driver !== game.player && !keepPlayerVehicle) removeVehicle(v); }
  for (const p of m.pickups) if (!p.removed) removePickup(p);
  setObjective(''); setMissionName(''); setMissionTimer(null); setProgress(null);
  game.flags.wantedHold = false;
  game.activeMission = null;
}

export function completeMission(m) {
  const reward = m.def.reward;
  cleanupMission(m);
  addMoney(reward.money, 'mission'); addRespect(reward.respect);
  game.missionIndex = Math.max(game.missionIndex, m.index + 1);
  showBigBanner('MISSION PASSED', `${m.def.title.toUpperCase()}\n${formatMoney(reward.money)}  ·  RESPECT +${reward.respect}`, '');
  bannerTimer = 5;
  playSound('missionPassed', game.player.pos);
  emitEvent('missionCompleted', m);
  if (game.missionIndex >= STORY_MISSIONS.length) showNotification('<b>STORY COMPLETE</b>Palmera Bay is yours. Taxi fares, races, flamingos and Bay Patrol are still out there.', 'gold', 10);
  refreshMissionStartMarker();
}

export function failMission(reason) {
  const m = game.activeMission;
  if (!m) return;
  cleanupMission(m, false);
  showBigBanner('MISSION FAILED', reason, 'bad');
  bannerTimer = 4;
  playSound('missionFailed', game.player.pos);
  emitEvent('missionFailed', m);
  refreshMissionStartMarker();
}

function spawnMissionEnemies(m, step) {
  m.state.enemies = step.enemies.map((e, i) => {
    const c = spawnCharacter({ x: e.x, z: e.z, heading: Math.PI, kind: step.kind, look: step.look, weapon: step.weapon, health: step.kind === 'guard' ? 90 : 70 });
    c.missionTag = m.def.id; c.ai = { home: { x: e.x, z: e.z }, alert: false, strafe: i };
    m.entities.push(c);
    createMarker({ target: c, color: 0xff4040, radius: 0.9, kind: 'enemy' });
    return c;
  });
}

/** Gangsters / guards: stand guard until the player is seen or shots are fired, then advance and shoot. */
function updateMissionEnemy(c, dt) {
  if (c.state === 'dead' || c.state === 'down') { c.aiming = false; return; }
  const p = game.player, target = p.vehicle ? p.vehicle.pos : p.pos;
  const dx = target.x - c.pos.x, dz = target.z - c.pos.z, dist = Math.hypot(dx, dz);
  c.ai.losTimer = (c.ai.losTimer || 0) - dt;
  if (c.ai.losTimer <= 0) { c.ai.losTimer = 0.4; c.ai.los = hasLineOfSight(c.pos.x, c.pos.z, target.x, target.z); }
  if (!c.ai.alert && ((dist < 30 && c.ai.los) || c.hostile || c.lastDamageTime)) c.ai.alert = true;
  if (!c.ai.alert || p.health <= 0) { c.vel.x = c.vel.z = 0; c.aiming = false; return; }
  if (dist > 26 || !c.ai.los) { moveToward(c, target.x, target.z, 4.4, dt); c.aiming = false; }
  else {
    faceToward(c, target.x, target.z, 12, dt);
    const s = Math.sin(game.time * 0.9 + c.ai.strafe * 2.1) > 0 ? 1 : -1;
    c.vel.x = -dz / (dist || 1) * s * 1.4; c.vel.z = dx / (dist || 1) * s * 1.4;
    c.aiming = true;
    npcShootAt(c, p, 0.34);
  }
}

const STEP_HANDLERS = {
  dialogue: {
    begin(m, step) { setObjective(''); m.state.done = false; playDialogue(step.lines, () => { m.state.done = true; }); },
    update(m) { return m.state.done && !isDialogueActive(); },
  },
  giveWeapon: { begin(m, step) { giveWeapon(step.weapon, step.ammo); selectWeapon(step.weapon); showNotification(`<b>WEAPON</b>${step.weapon === 'smg' ? 'Mako SMG' : 'Coral 9 pistol'} added. Hold right mouse to aim, left to fire.`, 'gold', 5); }, update() { return true; } },
  giveArmor: { begin() { game.player.armor = 100; }, update() { return true; } },
  wanted: { begin(m, step) { setWantedLevel(step.stars); game.flags.wantedHold = !!step.hold; }, update() { return true; } },
  goto: {
    begin(m, step) { const p = resolvePoint(step.place || step.at); setMarker(m, { x: p.x, z: p.z, color: 0xffd166, radius: step.radius ? Math.min(step.radius, 5) : 2.4, icon: '', label: step.text }); m.state.r = step.radius || 3; },
    update(m) { return isPlayerInMarker(m.marker, m.state.r - m.marker.radius); },
  },
  needVehicle: {
    begin(m, step) { if (game.player.vehicle) m.state.skip = true; },
    update() { return !!game.player.vehicle; },
  },
  stealVehicle: {
    begin(m, step) {
      const v = spawnVehicle(step.vehicle, step.at.x, step.at.z, step.at.heading, { color: step.color, missionTag: m.def.id, parked: true });
      if (step.owned) v.playerOwned = true;
      m.vehicles.push(v); m.vehicle = v;
      setMarker(m, { target: v, color: 0x58b8ff, radius: 2.4, label: v.spec.name, kind: 'target' });
    },
    update(m) { if (m.vehicle.wrecked) { failMission('The vehicle was destroyed.'); return false; } return game.player.vehicle === m.vehicle; },
  },
  deliverVehicle: {
    begin(m, step) {
      const p = resolvePoint(step.to);
      setMarker(m, { x: p.x, z: p.z, color: 0xffd166, radius: step.radius || 3.2, label: step.text });
      m.state.time = step.timeLimit || 0;
    },
    update(m, step, dt) {
      const v = m.vehicle;
      if (!v || v.wrecked || v.removed) { failMission('The vehicle was destroyed.'); return false; }
      if (step.minHealth && v.health < step.minHealth) { failMission('The vehicle is too wrecked to deliver.'); return false; }
      if (step.timeLimit) { m.state.time -= dt; setMissionTimer(m.state.time); if (m.state.time <= 0) { failMission('You ran out of time.'); return false; } }
      setProgress('VEHICLE CONDITION', v.health / 100);
      if (game.player.vehicle !== v) { setObjective(`Get back in the <em>${v.spec.name}</em>.`); return false; }
      setObjective(step.text);
      return isPlayerInMarker(m.marker, 1) && Math.abs(v.speed) < 4;
    },
  },
  chase: {
    begin(m, step) {
      const net = game.city.network, from = net.nodes[step.from.j * net.cols + step.from.i], to = net.nodes[from.links[0].to];
      const v = spawnVehicle(step.vehicle, from.x, from.z, Math.atan2(to.x - from.x, to.z - from.z), { color: step.color, missionTag: m.def.id });
      assignTrafficRoute(v, from.id, to.id, { cruise: step.cruise, flee: true });
      m.vehicles.push(v); m.target = v;
      setMarker(m, { target: v, color: 0xff4040, radius: 2.6, label: 'Target', kind: 'enemy' });
    },
    update(m, step) {
      const v = m.target;
      setProgress("RUDY'S KESTREL", Math.max(0, (v.health - step.damageTo) / (100 - step.damageTo)));
      if (v.health <= step.damageTo || v.wrecked) {
        v.ai = null; v.controls.throttle = 0; v.controls.brake = 1;
        if (!v.wrecked) { const d = spawnCharacter({ x: v.pos.x + 2.2, z: v.pos.z, kind: 'ped', look: 'gang' }); d.panic = 30; d.fleeFrom = { x: game.player.pos.x, z: game.player.pos.z }; m.entities.push(d); }
        m.state.dropAt = { x: v.pos.x - 2.4, z: v.pos.z + 1 };
        m.lastDrop = m.state.dropAt;
        return true;
      }
      return false;
    },
  },
  collect: {
    begin(m, step) {
      const at = step.atTarget && m.lastDrop ? m.lastDrop : step.at;
      const p = spawnPickup(step.item || 'briefcase', at.x, at.z, { onCollect: () => { m.state.got = true; } });
      m.pickups.push(p);
      setMarker(m, { x: at.x, z: at.z, color: 0x6dff8f, radius: 1.4, label: 'Pick up' });
    },
    update(m) { return !!m.state.got; },
  },
  eliminate: {
    begin(m, step) { spawnMissionEnemies(m, step); },
    update(m, step, dt) {
      let alive = 0;
      for (const c of m.state.enemies) { if (c.state !== 'dead' && !c.removed) { alive++; updateMissionEnemy(c, dt); } }
      setProgress(`${alive} REMAINING`, alive / m.state.enemies.length);
      return alive === 0;
    },
  },
  hold: {
    begin(m, step) { setMarker(m, { x: step.at.x, z: step.at.z, color: 0xff3d8b, radius: step.radius, label: step.label }); m.state.t = 0; game.flags.wantedHold = true; },
    update(m, step, dt) {
      if (isPlayerInMarker(m.marker)) m.state.t += dt;
      setProgress(step.label, m.state.t / step.seconds);
      if (game.wanted.stars < 4) setWantedLevel(4);
      if (m.state.t >= step.seconds) { game.flags.wantedHold = false; return true; }
      return false;
    },
  },
  pickupPassenger: {
    begin(m, step) {
      const c = spawnCharacter({ x: step.at.x, z: step.at.z, kind: 'npc', look: STORY_CAST[step.who].look, name: STORY_CAST[step.who].name });
      c.invulnerable = true; c.missionTag = m.def.id; m.entities.push(c); m.state.npc = c;
      setMarker(m, { x: step.at.x, z: step.at.z, color: 0xff5fa2, radius: 3.5, label: STORY_CAST[step.who].name, icon: STORY_CAST[step.who].name[0] });
    },
    update(m, step, dt) {
      const v = game.player.vehicle, c = m.state.npc;
      if (!v) { setObjective('You need a <b>vehicle</b> for the getaway.'); return false; }
      setObjective(step.text);
      const d = Math.hypot(v.pos.x - c.pos.x, v.pos.z - c.pos.z);
      if (d < 9 && Math.abs(v.speed) < 3) {
        if (moveToward(c, v.pos.x, v.pos.z, 5, dt) < 2.6) { seatPassenger(c, v); playSound('door', v.pos); m.passenger = c; return true; }
      } else c.vel.x = c.vel.z = 0;
      return false;
    },
  },
  loseWanted: {
    begin(m) { game.flags.wantedHold = false; },
    update(m) { setProgress('HEAT', Math.max(0, 1 - game.wanted.unseen / (9 + game.wanted.stars * 5))); return game.wanted.stars === 0; },
  },
};

export function updateMissions(dt, realDt) {
  if (bannerTimer > 0) { bannerTimer -= realDt; if (bannerTimer <= 0) hideBigBanner(); }
  const m = game.activeMission;
  if (!m) {
    if (startMarkerIndex !== game.missionIndex) refreshMissionStartMarker();
    if (startMarker && !game.player.vehicle && game.player.health > 0 && isPlayerInMarker(startMarker)) {
      if (game.wanted.stars > 0) setObjective('Lose your wanted level before starting a job.');
      else { setObjective(''); startMission(game.missionIndex); }
    }
    return;
  }
  m.elapsed += dt;
  const step = m.step;
  if (!step) return;
  if (STEP_HANDLERS[step.type].update(m, step, dt) && game.activeMission === m) advanceStep(m);
}

export function getMissionProgressList() {
  return STORY_MISSIONS.map((def, i) => ({ title: def.title, giver: STORY_CAST[def.giver].name, reward: def.reward.money, status: i < game.missionIndex ? 'done' : i === game.missionIndex ? 'next' : 'locked' }));
}
