// Job: stage the `onfoot` screenshot. Midday shoot-out on Neon Row: Dez against the Brine Kings in the street,
// a crowd running along both sidewalks, traffic stopped behind him and Bay Patrol rolling in with officers on foot.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { cameraRig } from '../render/followCamera.js';
import { setTimeOfDay, lighting } from '../world/dayNightCycle.js';
import { GRID_Z } from '../world/cityLayout.js';
import { spawnVehicle } from '../vehicles/vehiclePhysics.js';
import { populateTrafficAround } from '../vehicles/trafficAI.js';
import { teleportPlayer } from '../characters/playerController.js';
import { populatePedestriansAround } from '../characters/pedestrianAI.js';
import { deployOfficers } from '../police/policeCruiserAI.js';
import { setWantedLevel } from '../systems/wantedLevel.js';
import { giveWeapon, selectWeapon } from '../combat/weaponCatalog.js';
import { fireWeapon } from '../combat/weaponFire.js';
import { killCharacter } from '../combat/damageSystem.js';
import { startMission, jumpToMissionStep } from '../missions/missionRunner.js';
import { setObjective, setRadioBanner, hideTitleCard, updateHud } from '../ui/hud.js';
import { playDialogue } from '../ui/dialogueBox.js';
import { setProgressState, pursuitCruiser, trafficCar, fleeingPed, advanceScene } from './sceneStagers.js';

export function stageOnfoot(api) {
  lighting.sunAzimuthBias = 0.22;
  setTimeOfDay(12.6);
  setProgressState(7320, 180, 3);
  giveWeapon('pistol', 84); selectWeapon('pistol'); game.ammo.pistol.clip = 9;
  const z = GRID_Z[3] + 4.8, west = -Math.PI / 2, east = Math.PI / 2;
  teleportPlayer(214, z, west);
  game.player.health = 64; game.player.armor = 30;
  setWantedLevel(2);
  startMission(3); jumpToMissionStep('eliminate'); hideTitleCard();
  const foes = game.activeMission.state.enemies;
  const positions = [[199, z - 3.4], [193, z + 1.6], [186, z - 6.5], [194, z - 2], [180, z + 1], [184, z - 4]];
  foes.forEach((c, i) => { c.pos.set(positions[i][0], 0, positions[i][1]); c.heading = east; c.ai.alert = true; c.invulnerable = i !== 1; });
  killCharacter(foes[1], game.player);
  const cruiser = pursuitCruiser(172, z - 9.2, east + 0.12, 9);
  pursuitCruiser(150, z - 5.5, east, 14);
  trafficCar('taxi', 226, z - 9.3, west);
  trafficCar('sedan', 163, z + 0.5, east, 0x7c1f2a);
  trafficCar('compact', 131, z - 10, west);
  trafficCar('van', 142, z + 0.6, east);
  const jacked = spawnVehicle('muscle', 207, z + 2.6, west - 0.5, { color: 0xe8a01a }); jacked.playerOwned = true;
  for (const [px, pz] of [[205, z - 15], [196, z - 16], [188, z + 6.3], [209, z + 7], [181, z - 15.5], [176, z + 6.6], [219, z - 15.6], [169, z + 7.2], [200, z + 6.8]]) fleeingPed(px, pz, 200, z - 3);
  populateTrafficAround(214, z, 10, 60, 200); populatePedestriansAround(14, 25, 110);
  cameraRig.yaw = west; cameraRig.pitch = 0.1; cameraRig.snap = true;
  game.flags.controlsLocked = true; game.player.invulnerable = true;
  advanceScene(api);
  deployOfficers(cruiser);
  const combatPositions = [[202, z - 1], [193, z + 1.6], [197, z - 4], [195, z + 4.5], [187, z + 1.5], [185, z - 6]];
  foes.forEach((c, i) => { if (c.state !== 'dead') { c.pos.set(combatPositions[i][0], 0, combatPositions[i][1]); c.state = 'idle'; c.heading = east; c.aiming = true; } });
  game.characters.filter((c) => c.kind === 'ped').slice(0, 14).forEach((ped, i) => {
    ped.pos.set(210 - Math.floor(i / 2) * 5, 0, z + (i % 2 ? 7 : -15));
    ped.panic = 20; ped.fleeFrom = { x: 200, z };
  });
  // wide over-the-shoulder framing: the whole street, both sidewalks and the cruisers at the far end
  cameraRig.override = { x: 222, y: 3.5, z: z + 1.2, tx: 194, ty: 1.3, tz: z - 3, fov: 60, yaw: west };
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
