// Cover scene: morning golden hour on Corsair Boulevard. A stolen Marlin RS runs north along the beach with
// four stars, Bay Patrol cruisers, a Bulwark van and Air One behind it, through rush-hour traffic.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { cameraRig } from '../render/followCamera.js';
import { setTimeOfDay, lighting } from '../world/dayNightCycle.js';
import { GRID_X } from '../world/cityLayout.js';
import { spawnVehicle, removeVehicle } from '../vehicles/vehiclePhysics.js';
import { populateTrafficAround } from '../vehicles/trafficAI.js';
import { enterVehicle } from '../vehicles/vehicleEntry.js';
import { teleportPlayer } from '../characters/playerController.js';
import { populatePedestriansAround } from '../characters/pedestrianAI.js';
import { requestHelicopter } from '../police/policeHelicopter.js';
import { setWantedLevel } from '../systems/wantedLevel.js';
import { giveWeapon, selectWeapon } from '../combat/weaponCatalog.js';
import { fireWeapon } from '../combat/weaponFire.js';
import { startMission, jumpToMissionStep } from '../missions/missionRunner.js';
import { setObjective, setRadioBanner, hideTitleCard } from '../ui/hud.js';
import { showNotification } from '../ui/notifications.js';
import { playDialogue } from '../ui/dialogueBox.js';
import { spawnTyreSmoke } from '../combat/visualEffects.js';
import { setProgressState, pursuitCruiser, trafficCar, fleeingPed, advanceScene } from './sceneStagers.js';

const SOUTH = 0, NORTH = Math.PI, X = GRID_X[9], Z0 = 100;
// [metres east of the centre line, metres behind the player, type]
const PURSUIT = [[2.4, 7, 'police'], [0.9, 13, 'police'], [5.6, 20, 'police'], [1.0, 27, 'police'], [3.8, 35, 'swat'], [1.6, 45, 'police']];
// [type, east of centre, behind the player, heading, colour]: southbound lanes are west of the centre line
const CIVILIANS = [['taxi', -2, -17, SOUTH], ['compact', -5.5, -9, SOUTH, 0x3fc1ff], ['sedan', -2, 0, SOUTH, 0x1d4b7a], ['pickup', -5.5, 8, SOUTH], ['compact', -2, 16, SOUTH, 0xffd23f], ['taxi', -5.5, 25, SOUTH],
  ['van', -2, 34, SOUTH], ['sedan', -5.5, 44, SOUTH, 0xe6e1d3], ['pickup', -2, 54, SOUTH], ['muscle', -5.5, 66, SOUTH, 0xb5121b], ['compact', -2, 76, SOUTH, 0xff8a3d], ['taxi', -5.5, 88, SOUTH],
  ['sedan', 5.5, 52, NORTH, 0xc9ced6], ['taxi', 2, 60, NORTH], ['compact', 5.5, 72, NORTH, 0xff7fb0], ['van', 2, 84, NORTH]];

export function stageChase(api) {
  lighting.sunAzimuthBias = -0.45;
  setTimeOfDay(7.9);
  setProgressState(18450, 310, 4);
  giveWeapon('pistol', 60); giveWeapon('smg', 128); selectWeapon('smg');
  teleportPlayer(X + 2, Z0);
  const car = spawnVehicle('sports', X + 2, Z0, NORTH, { color: 0xff2d55 });
  car.playerOwned = true; enterVehicle(game.player, car);
  game.player.armor = 55; game.player.health = 82;
  startMission(4); jumpToMissionStep('loseWanted'); hideTitleCard();
  requestHelicopter({ x: X, y: 20, z: Z0 + 40 });
  setWantedLevel(4); game.flags.wantedHold = true; game.flags.controlsLocked = true;
  populateTrafficAround(X, Z0, 12, 60, 230);
  populatePedestriansAround(18, 15, 110);
  advanceScene(api);   // three seconds for traffic, pedestrians, dispatch and Air One to settle
  // clear the lanes the chase is about to use, then send the convoy and the rush-hour traffic through them
  for (const v of game.vehicles.slice()) if (v !== car && Math.abs(v.pos.x - X) < 10 && v.pos.z > Z0 - 30 && v.pos.z < Z0 + 120) removeVehicle(v);
  car.pos.set(X + 2, 0, Z0); car.heading = NORTH; car.vx = 0; car.vz = -38; car.health = 68;
  const convoy = PURSUIT.map(([dx, dz, type]) => pursuitCruiser(X + dx, Z0 + dz, NORTH, 38, type));
  for (const [type, dx, dz, heading, color] of CIVILIANS) trafficCar(type, X + dx, Z0 + dz, heading, color);
  for (let i = 0; i < 12; i++) fleeingPed(X + (i % 2 ? -10.4 : 10.2 + (i % 3)), Z0 - 12 + i * 3.6, X + 2, Z0 + 30);
  game.characters.filter((c) => c.kind === 'ped' && !c.panic).slice(0, 12).forEach((ped, i) => {
    ped.pos.set(X + (i % 3 ? 9.6 + (i % 4) : -11.2), 0, Z0 + 1 + i * 3.4); ped.heading = i % 2 ? NORTH : SOUTH;
  });
  advanceScene(api, 0.4);
  const p = car.pos;
  for (let i = 0; i < 5; i++) spawnTyreSmoke(p.x - 0.6, 0.25, p.z + 2.4 + i * 0.8);
  setObjective('Four stars. <b>Lose Bay Patrol</b> and get Luz to the motel.');
  setRadioBanner('NEON DRIVE 98.5', 'Midnight on Corsair', 99);
  showNotification('<b>POLICE SCANNER</b>All units: red Marlin RS northbound on Corsair Boulevard.', 'warn', 0);
  playDialogue([{ who: 'luz', text: 'Air One has us! Cut through Neon Row. I know a way out.' }]);
  // Air One low over the convoy, nose toward the suspect
  game.helicopter.pos.set(p.x - 3, 12, p.z + 24);
  game.helicopter.mesh.rotation.y = NORTH + 0.5;
  // look-back chase camera from the beach side of the road: promenade on the left, the boulevard and hotels ahead
  cameraRig.yaw = SOUTH;
  cameraRig.override = { x: p.x + 5.5, y: 3.6, z: p.z - 9, tx: p.x - 6, ty: 1.6, tz: p.z + 14, fov: 60, yaw: SOUTH };
  api.simulateWorld(1 / 60, 1 / 60);
  const gunner = convoy[0].ai.gunner;
  if (gunner) fireWeapon(gunner, 'pistol', new THREE.Vector3(0, 0.01, -1), 0.02);
  api.simulateWorld(1 / 60, 1 / 60);   // refresh the unit roster and crew chips after the final formation
}
