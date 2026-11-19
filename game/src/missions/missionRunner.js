// Story mission engine: start markers, step-by-step scripting (drive-to, steal, deliver, chase, shoot-out,
// getaway, heist hold-out), objectives, timers, failure and rewards.
import { game } from '../core/gameState.js';
import { onEvent, emitEvent } from '../core/eventBus.js';
import { PLACES } from '../world/cityLayout.js';
import { STORY_MISSIONS, getMissionByIndex } from './storyMissions.js';
import { STORY_CAST } from './storyCharacters.js';
import { createMarker, removeMarker, clearMissionMarkers, isPlayerInMarker } from './missionMarkers.js';
import { playDialogue, isDialogueActive, stopDialogue } from '../ui/dialogueBox.js';
import { setMissionTimer } from '../ui/missionBanner.js';
import { setObjective, setProgress, showTitleCard, showBigBanner, hideBigBanner } from '../ui/hud.js';
import { showNotification } from '../ui/notifications.js';
import { addMoney, addRespect } from '../systems/economy.js';
import { setWantedLevel, getEscapeTime } from '../systems/wantedLevel.js';
import { WEAPONS, giveWeapon, selectWeapon } from '../combat/weaponCatalog.js';
import { spawnVehicle, removeVehicle } from '../vehicles/vehiclePhysics.js';
import { assignTrafficRoute } from '../vehicles/trafficAI.js';
import { seatPassenger } from '../vehicles/vehicleEntry.js';
import { spawnCharacter, removeCharacter, faceToward, moveToward } from '../characters/characterEntity.js';
import { npcShootAt } from '../combat/weaponFire.js';
import { hasLineOfSight } from '../world/collisionGrid.js';
import { spawnPickup, removePickup } from '../systems/pickups.js';
import { formatMoney } from '../core/mathUtils.js';
import { playSound } from '../core/cues.js';

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
  showTitleCard(`MISSION ${index + 1}/${STORY_MISSIONS.length} · ${STORY_CAST[def.giver].name.toUpperCase()}`, def.title, def.blurb);
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
  setObjective(''); setMissionTimer(null); setProgress(null);
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

/** Counts a timed stage down on the mission banner; fails the mission and returns true when it runs out. */
function stageTimeUp(m, step, dt) {
  if (!step.timeLimit) return false;
  if (m.state.time === undefined) m.state.time = step.timeLimit;
  m.state.time -= dt; setMissionTimer(m.state.time);
  if (m.state.time > 0) return false;
  failMission('You ran out of time.');
  return true;
}

function spawnMissionEnemies(m, step, list) {
  const spawned = list.map((e, i) => {
    const c = spawnCharacter({ x: e.x, z: e.z, heading: Math.PI, kind: step.kind, look: step.look, weapon: step.weapon, health: step.kind === 'guard' ? 90 : 70 });
    c.missionTag = m.def.id; c.ai = { home: { x: e.x, z: e.z }, alert: false, strafe: i };
    m.entities.push(c);
    createMarker({ target: c, color: 0xff4040, radius: 0.9, kind: 'enemy' });
    return c;
  });
  m.state.enemies = (m.state.enemies || []).concat(spawned);
  return spawned;
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
  giveWeapon: { begin(m, step) { giveWeapon(step.weapon, step.ammo); selectWeapon(step.weapon); showNotification(`<b>WEAPON</b>${WEAPONS[step.weapon].name} added. Hold right mouse to aim, left to fire.`, 'gold', 5); }, update() { return true; } },
  giveArmor: { begin() { game.player.armor = 100; }, update() { return true; } },
  wanted: { begin(m, step) { setWantedLevel(step.stars); game.flags.wantedHold = !!step.hold; }, update() { return true; } },
  goto: {
    begin(m, step) { const p = resolvePoint(step.place || step.at); setMarker(m, { x: p.x, z: p.z, color: 0xffd166, radius: step.radius ? Math.min(step.radius, 5) : 2.4, icon: '', label: step.text }); m.state.r = step.radius || 3; },
    update(m, step, dt) { if (stageTimeUp(m, step, dt)) return false; return isPlayerInMarker(m.marker, m.state.r - m.marker.radius); },
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
      const at = (step.atTarget && m.lastDrop) || step.at || { x: game.player.pos.x + 3, z: game.player.pos.z };
      const p = spawnPickup(step.item || 'briefcase', at.x, at.z, { onCollect: () => { m.state.got = true; } });
      m.pickups.push(p);
      setMarker(m, { x: at.x, z: at.z, color: 0x6dff8f, radius: 1.4, label: 'Pick up' });
    },
    update(m) { return !!m.state.got; },
  },
  eliminate: {
    // one group of enemies, or several `waves` that arrive as each is cleared; the HUD shows a kill counter
    begin(m, step) {
      const waves = step.waves || [step.enemies];
      m.state.waves = waves; m.state.wave = 0; m.state.total = waves.reduce((n, w) => n + w.length, 0) + (step.boss ? 1 : 0);
      spawnMissionEnemies(m, step, waves[0]);
    },
    update(m, step, dt) {
      let alive = 0;
      for (const c of m.state.enemies) { if (c.state !== 'dead' && !c.removed) { alive++; updateMissionEnemy(c, dt); } }
      const kills = m.state.enemies.length - alive;
      setProgress(`KILLS ${kills}/${m.state.total}`, kills / m.state.total);
      if (alive > 0) return false;
      if (m.state.wave < m.state.waves.length - 1) {
        m.state.wave++;
        for (const c of spawnMissionEnemies(m, step, m.state.waves[m.state.wave])) c.ai.alert = true;
        showNotification(`<b>REINFORCEMENTS</b>Wave ${m.state.wave + 1} of ${m.state.waves.length} is moving in.`, 'warn', 4);
        return false;
      }
      if (step.boss && !m.state.boss) {
        const cast = STORY_CAST[step.boss], at = m.state.waves[0][0];
        const [boss] = spawnMissionEnemies(m, { ...step, look: cast.look, weapon: 'smg' }, [at]);
        boss.health = 160; boss.name = cast.name; boss.ai.alert = true; m.state.boss = boss;
        showNotification(`<b>${cast.name.toUpperCase()}</b>The boss is out in the open. Finish it.`, 'warn', 5);
        return false;
      }
      return true;
    },
  },
  hold: {
    begin(m, step) { setMarker(m, { x: step.at.x, z: step.at.z, color: 0xff3d8b, radius: step.radius, label: step.label }); m.state.t = 0; game.flags.wantedHold = true; },
    update(m, step, dt) {
      if (isPlayerInMarker(m.marker)) m.state.t += dt;
      setProgress(step.label, m.state.t / step.seconds);
      if (game.wanted.stars < (step.stars || 4)) setWantedLevel(step.stars || 4);
      if (m.state.t >= step.seconds) { game.flags.wantedHold = !!step.stars; return true; }
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
    update(m, step, dt) {
      if (game.wanted.stars === 0) return true;
      if (stageTimeUp(m, step, dt)) return false;
      setProgress('HEAT', Math.max(0, 1 - game.wanted.unseen / getEscapeTime()));
      return false;
    },
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
