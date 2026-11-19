// Deterministic screenshot mode (index.html?shot=<name>&seed=1): stages real gameplay moments with the
// game's own systems (vehicles, police, pedestrians, missions, HUD), fast-forwards the simulation and renders.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { cameraRig } from '../render/followCamera.js';
import { setTimeOfDay, lighting, applyTimeOfDay } from '../world/dayNightCycle.js';
import { CAUSEWAY_Z, GRID_Z } from '../world/cityLayout.js';
import { spawnVehicle } from '../vehicles/vehiclePhysics.js';
import { populateTrafficAround, trafficConfig } from '../vehicles/trafficAI.js';
import { enterVehicle } from '../vehicles/vehicleEntry.js';
import { teleportPlayer } from '../characters/playerController.js';
import { populatePedestriansAround, pedestrianConfig } from '../characters/pedestrianAI.js';
import { createPursuitBrain, deployOfficers } from '../police/policeCruiserAI.js';
import { setWantedLevel } from '../systems/wantedLevel.js';
import { giveWeapon, selectWeapon } from '../combat/weaponCatalog.js';
import { fireWeapon } from '../combat/weaponFire.js';
import { startMission, jumpToMissionStep } from '../missions/missionRunner.js';
import { setHudVisible, setObjective, setRadioBanner, hideTitleCard, updateHud } from '../ui/hud.js';
import { showNotification } from '../ui/notifications.js';
import { stageStart, stageMap } from './menuScenes.js';
import { setProgressState, pursuitCruiser, trafficCar, fleeingPed, advanceScene } from './sceneStagers.js';
import { playDialogue } from '../ui/dialogueBox.js';
import { requestHelicopter } from '../police/policeHelicopter.js';
import { killCharacter } from '../combat/damageSystem.js';
import { spawnTyreSmoke } from '../combat/visualEffects.js';
import { createSeededRandom } from '../core/rng.js';
import { getPostProcessing } from '../render/renderer.js';

/** Cover: golden-hour chase down palm-lined Causeway Drive in a stolen Marlin RS, four stars, cruisers on the bumper. */
function stageChase(api) {
  lighting.sunAzimuthBias = 0.02;
  setTimeOfDay(17.65);
  setProgressState(18450, 310, 4);
  giveWeapon('pistol', 60); giveWeapon('smg', 128); selectWeapon('smg');
  const z = CAUSEWAY_Z, west = -Math.PI / 2;
  teleportPlayer(318, z - 2);
  const car = spawnVehicle('sports', 318, z - 2.2, west, { color: 0xff2d55 });
  car.playerOwned = true; enterVehicle(game.player, car);
  car.vx = -40; car.health = 65;
  game.player.armor = 55; game.player.health = 82;
  startMission(4); jumpToMissionStep('loseWanted'); hideTitleCard();
  requestHelicopter({ x: 370, y: 20, z: z - 10 });
  setWantedLevel(4); game.flags.wantedHold = true;
  const convoy = [pursuitCruiser(328, z - 5.6, west + 0.05, 41),
  pursuitCruiser(333, z + 1.2, west - 0.07, 42),
  pursuitCruiser(342, z - 2.6, west, 43),
  pursuitCruiser(353, z + 4.8, west + 0.03, 44),
  pursuitCruiser(366, z - 5.5, west, 44, 'swat'),
  pursuitCruiser(380, z - 0.5, west, 44)];
  // oncoming and same-way traffic, plus cars further down the street
  const traffic = [trafficCar('taxi', 300, z + 5.5, Math.PI / 2),
  trafficCar('sedan', 262, z + 2.0, Math.PI / 2, 0x1d4b7a),
  trafficCar('pickup', 352, z + 5.6, Math.PI / 2),
  trafficCar('compact', 282, z - 5.5, west, 0xffd23f),
  trafficCar('van', 236, z - 2, west),
  trafficCar('muscle', 214, z + 5.5, Math.PI / 2)];
  for (const [px, pz] of [[306, z - 11.5], [322, z - 12.5], [296, z + 11], [333, z + 12], [345, z - 11], [312, z + 12.5], [280, z - 12], [356, z + 11.5], [268, z + 11.5]]) fleeingPed(px, pz, 325, z);
  populateTrafficAround(318, z, 10, 70, 220);
  populatePedestriansAround(10, 30, 120);
  // Let traffic, pursuit and pedestrian brains settle for three seconds.
  car.controls.throttle = 1;
  game.flags.controlsLocked = true;
  advanceScene(api);
  setObjective("Four stars. <b>Lose Bay Patrol</b> and get Luz to the motel.");
  setRadioBanner('NEON DRIVE 98.5', 'Midnight on Corsair', 99);
  showNotification('<b>POLICE SCANNER</b>All units: red Marlin RS westbound on Causeway Drive.', 'warn', 0);
  // look-back chase camera: low, ahead of the car, catching the cruisers and the bridge behind
  const p = car.pos;
  // After the warm-up, compose the moving convoy on separate lanes and let its brains advance again.
  car.health = 68; car.heading = west; car.vx = -38; car.vz = 0;
  car.pos.z = z - 2.2;
  const formation = [[11, -5.5], [18, 1.8], [29, -3.8], [40, 1.4], [52, -4.8], [65, 1.5]];
  convoy.forEach((v, i) => { v.pos.set(p.x + formation[i][0], 0, z + formation[i][1]); v.heading = west; v.vx = -38; v.vz = 0; v.health = 100; v.wrecked = false; v.ai = createPursuitBrain(); });
  traffic.forEach((v, i) => { v.pos.set(p.x + 29 + i * 17, 0, z + 5.5); v.heading = Math.PI / 2; v.vx = 9; v.vz = 0; });
  game.characters.filter((c) => c.kind === 'ped').slice(0, 12).forEach((ped, i) => {
    ped.pos.set(p.x + 6 + Math.floor(i / 2) * 9, 0, z + (i % 2 ? 11 : -11));
    ped.panic = 20; ped.fleeFrom = { x: p.x, z };
  });
  advanceScene(api, 0.2);
  for (let i = 0; i < 5; i++) spawnTyreSmoke(p.x + 2 + i * 0.8, 0.25, p.z - 1);
  // Put Air One in the same composition as the pursuing ground units.
  game.helicopter.pos.set(p.x + 46, 17, p.z - 7);
  cameraRig.override = { x: p.x - 9.5, y: 3.1, z: p.z + 4.8, tx: p.x + 12, ty: 3.3, tz: p.z - 0.5, fov: 64, yaw: west };
  playDialogue([{ who: 'luz', text: 'Air One has us! Cut through Neon Row. I know a way out.' }]);
  api.simulateWorld(1 / 60, 1 / 60);
  const gunner = convoy[0].ai.gunner;
  if (gunner) fireWeapon(gunner, 'pistol', new THREE.Vector3(-1, 0.01, 0.1), 0.02);
  updateHud(0.3); // Refresh the throttled unit roster after the final formation step.
}

/** Dusk shoot-out on Neon Row: pistol muzzle flash, gangsters, fleeing pedestrians, a cruiser arriving. */
function stageOnfoot(api) {
  lighting.sunAzimuthBias = 0.3;
  setTimeOfDay(18.85);
  setProgressState(7320, 180, 3);
  giveWeapon('pistol', 84); selectWeapon('pistol'); game.ammo.pistol.clip = 9;
  const z = GRID_Z[3] + 4.8, west = -Math.PI / 2;
  teleportPlayer(214, z, west);
  game.player.health = 64; game.player.armor = 30;
  setWantedLevel(2);
  startMission(3); jumpToMissionStep('eliminate'); hideTitleCard();
  const foes = game.activeMission.state.enemies;
  const positions = [[199, z - 3.4], [193, z + 1.6], [186, z - 6.5], [194, z - 2], [180, z + 1], [184, z - 4]];
  foes.forEach((c, i) => { c.pos.set(positions[i][0], 0, positions[i][1]); c.heading = Math.PI / 2; c.ai.alert = true; c.invulnerable = i !== 1; });
  killCharacter(foes[1], game.player);
  const cruiser = pursuitCruiser(172, z - 9.2, Math.PI / 2 + 0.12, 9);
  const cruiser2 = pursuitCruiser(150, z - 5.5, Math.PI / 2, 14);
  trafficCar('taxi', 226, z - 9.3, west);
  trafficCar('sedan', 163, z + 0.5, Math.PI / 2, 0x7c1f2a);
  trafficCar('compact', 131, z - 10, west);
  const jacked = spawnVehicle('muscle', 207, z + 2.6, west - 0.5, { color: 0xe8a01a }); jacked.playerOwned = true;
  for (const [px, pz] of [[205, z - 15], [196, z - 16], [188, z + 6.3], [209, z + 7], [181, z - 15.5], [176, z + 6.6], [219, z - 15.6], [169, z + 7.2], [200, z + 6.8]]) fleeingPed(px, pz, 200, z - 3);
  populateTrafficAround(214, z, 8, 60, 200); populatePedestriansAround(10, 25, 110);
  cameraRig.yaw = west + 0.16; cameraRig.pitch = 0.1; cameraRig.snap = true;
  game.flags.controlsLocked = true; game.player.invulnerable = true;
  advanceScene(api);
  deployOfficers(cruiser); void cruiser2;
  const combatPositions = [[202, z - 1], [193, z + 1.6], [197, z - 4], [195, z + 4.5], [187, z + 1.5], [185, z - 6]];
  foes.forEach((c, i) => { if (c.state !== 'dead') { c.pos.set(combatPositions[i][0], 0, combatPositions[i][1]); c.state = 'idle'; c.heading = Math.PI / 2; c.aiming = true; } });
  game.characters.filter((c) => c.kind === 'ped').slice(0, 10).forEach((ped, i) => {
    ped.pos.set(205 - Math.floor(i / 2) * 6, 0, z + (i % 2 ? 7 : -15));
    ped.panic = 20; ped.fleeFrom = { x: 200, z };
  });
  for (let i = 0; i < 5; i++) { game.player.fireAnim = 5; api.simulateWorld(1 / 30, 1 / 30); }
  setObjective('Take out the <b>Brine Kings</b>. Bay Patrol is closing in.');
  setRadioBanner(null);
  playDialogue([{ who: 'benny', text: 'The Kings moved my shipment downtown. Clear the street, Dez!' }]);
  // squeeze the trigger on the final frame so the flash, tracer and light are in the picture
  const target = foes[0], d = new THREE.Vector3(target.pos.x - game.player.pos.x, -0.02, target.pos.z - game.player.pos.z).normalize();
  game.player.heading = Math.atan2(d.x, d.z);
  api.simulateWorld(1 / 60, 1 / 60);
  fireWeapon(game.player, 'pistol', d, 4);
  fireWeapon(foes[2], 'pistol', new THREE.Vector3(game.player.pos.x - foes[2].pos.x + 1.4, 0.05, game.player.pos.z - foes[2].pos.z).normalize(), 4);
  game.ammo.pistol.clip = 8;
  game.player.mesh.rotation.y = game.player.heading;
  updateHud(1 / 60);
}

export const SCREENSHOT_SCENES = { chase: stageChase, onfoot: stageOnfoot, start: stageStart, map: stageMap };

export async function runScreenshotScene(name, api) {
  Math.random = createSeededRandom(game.seed + 971);
  const stage = SCREENSHOT_SCENES[name] || stageChase;
  trafficConfig.targetMoving = 14; pedestrianConfig.target = 22;
  setHudVisible(true);
  const post = getPostProcessing(); post.bloomStrength = 0.6;
  stage(api);
  applyTimeOfDay(game.timeOfDay);
  api.render(); api.render();
  await new Promise((resolve) => requestAnimationFrame(() => { api.render(); resolve(); }));
}
