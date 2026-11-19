// Deterministic screenshot mode (index.html?shot=<name>&seed=1): stages real gameplay moments with the
// game's own systems (vehicles, police, pedestrians, missions, HUD), fast-forwards the simulation and renders.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { getMouse } from '../core/input.js';
import { cameraRig } from '../render/followCamera.js';
import { setTimeOfDay, lighting, applyTimeOfDay } from '../world/dayNightCycle.js';
import { PLACES, CAUSEWAY_Z, GRID_X, GRID_Z } from '../world/cityLayout.js';
import { spawnVehicle } from '../vehicles/vehiclePhysics.js';
import { assignTrafficRoute, populateTrafficAround, trafficConfig } from '../vehicles/trafficAI.js';
import { enterVehicle } from '../vehicles/vehicleEntry.js';
import { teleportPlayer } from '../characters/playerController.js';
import { spawnCharacter, randomCivilianLook } from '../characters/characterEntity.js';
import { populatePedestriansAround, pedestrianConfig } from '../characters/pedestrianAI.js';
import { createPursuitBrain, deployOfficers } from '../police/policeCruiserAI.js';
import { setWantedLevel } from '../systems/wantedLevel.js';
import { giveWeapon, selectWeapon } from '../combat/weaponCatalog.js';
import { fireWeapon } from '../combat/weaponFire.js';
import { startMission, jumpToMissionStep, refreshMissionStartMarker } from '../missions/missionRunner.js';
import { setMissionName } from '../ui/missionBanner.js';
import { setHudVisible, setObjective, setRadioBanner, hideTitleCard, setProgress } from '../ui/hud.js';
import { showNotification } from '../ui/notifications.js';
import { openPauseMap } from '../ui/pauseMap.js';
import { saveGame } from '../systems/saveGame.js';
import { nearestNode } from '../world/roadNetwork.js';
import { getPostProcessing } from '../render/renderer.js';

function setProgressState(money, respect, missionIndex) {
  game.money = money; game.respect = respect; game.missionIndex = missionIndex;
  Object.assign(game.stats, { carsStolen: 23, taxiFares: 7, racesWon: 2, flamingos: 4, bustedCount: 1, wastedCount: 3, distance: 61000, kills: 12 });
}

function pursuitCruiser(x, z, heading, speed, type = 'police') {
  const v = spawnVehicle(type, x, z, heading);
  v.ai = createPursuitBrain(); v.siren = true; v.sirenPhase = Math.round(x) % 2 ? 0 : 1 / 7;
  v.vx = Math.sin(heading) * speed; v.vz = Math.cos(heading) * speed;
  return v;
}

function trafficCar(type, x, z, heading, color) {
  const net = game.city.network, v = spawnVehicle(type, x, z, heading, color !== undefined ? { color } : {});
  const from = nearestNode(net, x - Math.sin(heading) * 50, z - Math.cos(heading) * 50), to = nearestNode(net, x + Math.sin(heading) * 50, z + Math.cos(heading) * 50);
  if (from !== to) assignTrafficRoute(v, from.id, to.id, { lane: Math.abs(heading) < 0.1 || Math.abs(Math.abs(heading) - Math.PI) < 0.1 ? Math.abs(x - GRID_X.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a)) : Math.abs(z - GRID_Z.reduce((a, b) => Math.abs(b - z) < Math.abs(a - z) ? b : a)) });
  v.vx = Math.sin(heading) * 10; v.vz = Math.cos(heading) * 10;
  return v;
}

function fleeingPed(x, z, fromX, fromZ) {
  const ped = spawnCharacter({ x, z, kind: 'ped', look: randomCivilianLook(game.rng), heading: Math.atan2(x - fromX, z - fromZ) });
  ped.panic = 30; ped.fleeFrom = { x: fromX, z: fromZ }; ped.state = 'flee';
  return ped;
}

/** Cover: golden-hour chase down palm-lined Causeway Drive in a stolen Marlin RS, three stars, cruisers on the bumper. */
function stageChase(api) {
  lighting.sunAzimuthBias = 0.02;
  setTimeOfDay(18.45);
  setProgressState(18450, 310, 4);
  giveWeapon('pistol', 60); giveWeapon('smg', 128); selectWeapon('smg');
  const z = CAUSEWAY_Z, west = -Math.PI / 2;
  teleportPlayer(318, z - 2);
  const car = spawnVehicle('sports', 318, z - 2.2, west, { color: 0xff2d55 });
  car.playerOwned = true; enterVehicle(game.player, car);
  car.vx = -40; car.health = 78;
  game.player.armor = 55; game.player.health = 82;
  startMission(4); jumpToMissionStep('loseWanted'); hideTitleCard();
  setWantedLevel(3);
  pursuitCruiser(328, z - 5.6, west + 0.05, 41);
  pursuitCruiser(333, z + 1.2, west - 0.07, 42);
  pursuitCruiser(342, z - 2.6, west, 43);
  pursuitCruiser(353, z + 4.8, west + 0.03, 44);
  pursuitCruiser(366, z - 5.5, west, 44, 'swat');
  pursuitCruiser(380, z - 0.5, west, 44);
  // oncoming and same-way traffic, plus cars further down the street
  trafficCar('taxi', 300, z + 5.5, Math.PI / 2);
  trafficCar('sedan', 262, z + 2.0, Math.PI / 2, 0x1d4b7a);
  trafficCar('pickup', 352, z + 5.6, Math.PI / 2);
  trafficCar('compact', 282, z - 5.5, west, 0xffd23f);
  trafficCar('van', 236, z - 2, west);
  trafficCar('muscle', 214, z + 5.5, Math.PI / 2);
  for (const [px, pz] of [[306, z - 11.5], [322, z - 12.5], [296, z + 11], [333, z + 12], [345, z - 11], [312, z + 12.5], [280, z - 12], [356, z + 11.5], [268, z + 11.5]]) fleeingPed(px, pz, 325, z);
  populateTrafficAround(318, z, 10, 70, 220);
  populatePedestriansAround(10, 30, 120);
  // drive: full throttle with a touch of steering so the car leans and the tyres smoke
  car.controls.throttle = 1;
  game.flags.controlsLocked = true;
  for (let i = 0; i < 16; i++) { car.controls.throttle = 1; car.controls.steer = i > 9 ? 0.22 : 0; api.simulateWorld(1 / 30, 1 / 30); }
  setObjective("Three stars. <b>Lose the cops</b>: break line of sight, or respray at Odette's.");
  setRadioBanner('NEON DRIVE 98.5', 'Midnight on Corsair', 99);
  showNotification('<b>POLICE SCANNER</b>All units: red Marlin RS westbound on Causeway Drive.', 'warn', 0);
  // look-back chase camera: low, ahead of the car, catching the cruisers and the bridge behind
  const p = car.pos;
  cameraRig.override = { x: p.x - 8.6, y: 1.95, z: p.z + 4.6, tx: p.x + 4.5, ty: 1.2, tz: p.z - 0.6, fov: 54, yaw: west };
  api.simulateWorld(1 / 60, 1 / 60);
}

/** Dusk shoot-out on Neon Row: pistol muzzle flash, gangsters, fleeing pedestrians, a cruiser arriving. */
function stageStreet(api) {
  lighting.sunAzimuthBias = 0.3;
  setTimeOfDay(19.45);
  setProgressState(7320, 180, 3);
  giveWeapon('pistol', 84); selectWeapon('pistol'); game.ammo.pistol.clip = 9;
  const z = GRID_Z[3] + 4.8, west = -Math.PI / 2;
  teleportPlayer(214, z, west);
  game.player.health = 64; game.player.armor = 30;
  setWantedLevel(2);
  const foes = [[199, z - 3.4], [193, z + 1.6], [186, z - 6.5]].map(([x, fz], i) => {
    const c = spawnCharacter({ x, z: fz, heading: Math.PI / 2, kind: 'gang', look: 'gang', weapon: 'pistol', health: 70 });
    c.aiming = i !== 1; c.hostile = true; return c;
  });
  foes[1].health = 0; foes[1].state = 'dead'; foes[1].fallDir = 1;
  const cruiser = pursuitCruiser(172, z - 9.2, Math.PI / 2 + 0.12, 9);
  const cruiser2 = pursuitCruiser(150, z - 5.5, Math.PI / 2, 14);
  trafficCar('taxi', 226, z - 9.3, west);
  trafficCar('sedan', 163, z + 0.5, Math.PI / 2, 0x7c1f2a);
  trafficCar('compact', 131, z - 10, west);
  const jacked = spawnVehicle('muscle', 207, z + 2.6, west - 0.5, { color: 0xe8a01a }); jacked.playerOwned = true;
  for (const [px, pz] of [[205, z - 15], [196, z - 16], [188, z + 6.3], [209, z + 7], [181, z - 15.5], [176, z + 6.6], [219, z - 15.6], [169, z + 7.2], [200, z + 6.8]]) fleeingPed(px, pz, 200, z - 3);
  populateTrafficAround(214, z, 8, 60, 200); populatePedestriansAround(10, 25, 110);
  cameraRig.yaw = west + 0.16; cameraRig.pitch = 0.1; cameraRig.snap = true;
  game.flags.controlsLocked = false; void getMouse;
  for (let i = 0; i < 12; i++) { game.player.fireAnim = 5; api.simulateWorld(1 / 30, 1 / 30); cruiser.controls.throttle = 0.4; }
  deployOfficers(cruiser); void cruiser2;
  for (let i = 0; i < 5; i++) { game.player.fireAnim = 5; api.simulateWorld(1 / 30, 1 / 30); }
  setMissionName('Free Roam'); setObjective('Brine Kings on Neon Row. <b>Take them out</b> before <em>Bay Patrol</em> boxes you in.');
  // squeeze the trigger on the final frame so the flash, tracer and light are in the picture
  const target = foes[0], d = new THREE.Vector3(target.pos.x - game.player.pos.x, -0.02, target.pos.z - game.player.pos.z).normalize();
  game.player.heading = Math.atan2(d.x, d.z);
  api.simulateWorld(1 / 60, 1 / 60);
  fireWeapon(game.player, 'pistol', d, 4);
  fireWeapon(foes[2], 'pistol', new THREE.Vector3(game.player.pos.x - foes[2].pos.x + 1.4, 0.05, game.player.pos.z - foes[2].pos.z).normalize(), 4);
  game.ammo.pistol.clip = 8;
  game.player.mesh.rotation.y = game.player.heading;
}

/** Story moment: Tio Benny hands out the first job on Corsair Boulevard, with the bay and the pier behind. */
function stageMission(api) {
  lighting.sunAzimuthBias = 0.5;
  setTimeOfDay(18.05);
  setProgressState(350, 0, 0);
  const b = PLACES.bait;
  refreshMissionStartMarker();
  teleportPlayer(b.x + 0.4, b.z - 0.3, Math.PI * 0.8);
  const luz = spawnCharacter({ x: b.x - 0.6, z: b.z - 1.8, heading: Math.PI * 0.62, kind: 'npc', look: 'luz', name: 'Luz Quintero' });
  luz.invulnerable = true;
  trafficCar('sports', 437.5, b.z - 16, 0, 0x12d6c9);
  trafficCar('taxi', 426.5, b.z - 34, Math.PI);
  trafficCar('pickup', 434, b.z + 26, 0);
  trafficCar('police', 430, b.z - 62, Math.PI);
  spawnVehicle('sports', 446, 150, Math.PI, { color: 0xff2d55, parked: true });
  populateTrafficAround(b.x, b.z, 8, 50, 200); populatePedestriansAround(16, 6, 90);
  for (let i = 0; i < 20; i++) api.simulateWorld(1 / 30, 1 / 30);
  // stage the conversation in profile: Benny on the left, Dez and Luz on the right, the bay behind them
  const benny = game.characters.find((c) => c.name === 'Tio Benny Salazar');
  if (benny) { benny.pos.set(b.x + 0.7, 0, b.z - 2.1); benny.heading = -0.5; }
  luz.pos.set(b.x + 1.7, 0, b.z + 1.7); luz.heading = Math.PI + 0.35;
  teleportPlayer(b.x + 0.5, b.z + 0.7, Math.PI + 0.55);
  for (let i = 0; i < 5; i++) api.simulateWorld(1 / 60, 1 / 60);      // standing in the marker starts "Fresh Off the Bus"
  setObjective('Talk to <b>Tio Benny</b> outside the bait shop.');
  setRadioBanner(null);
  cameraRig.override = { x: b.x - 4.9, y: 1.7, z: b.z - 0.5, tx: b.x + 1.2, ty: 0.95, tz: b.z - 0.1, fov: 44, yaw: Math.PI / 2 };
  api.simulateWorld(1 / 60, 1 / 60);
}

/** Pause screen: the whole Palmera Bay map with districts, blips, story progress, stats and the save slot. */
function stageMap(api) {
  setTimeOfDay(21.5);
  setProgressState(18450, 310, 4);
  giveWeapon('pistol', 60); giveWeapon('smg', 128);
  teleportPlayer(-140, 150, 0.6);
  refreshMissionStartMarker();
  pursuitCruiser(-100, 240, Math.PI / 2, 10); pursuitCruiser(-48, 60, Math.PI, 10);
  setWantedLevel(2);
  for (let i = 0; i < 6; i++) api.simulateWorld(1 / 30, 1 / 30);
  try { localStorage.clear(); } catch (err) { /* ignore */ }
  saveGame(true);
  setHudVisible(false);
  openPauseMap();
}

export const SCREENSHOT_SCENES = { chase: stageChase, street: stageStreet, mission: stageMission, map: stageMap };

export async function runScreenshotScene(name, api) {
  const stage = SCREENSHOT_SCENES[name] || stageChase;
  trafficConfig.targetMoving = 14; pedestrianConfig.target = 22;
  setHudVisible(true);
  const post = getPostProcessing(); post.bloomStrength = 0.6;
  stage(api);
  applyTimeOfDay(game.timeOfDay);
  api.render(); api.render();
  await new Promise((resolve) => requestAnimationFrame(() => { api.render(); resolve(); }));
}
