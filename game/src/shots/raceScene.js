// Street-race scene: the Causeway Drag at golden hour. Dez's Kestrel V8 is on Pelican Causeway with the three
// rivals around him, the next checkpoint beam ahead and the race HUD showing position, lap, checkpoint and time.
import { game } from '../core/gameState.js';
import { simulateKey } from '../core/input.js';
import { cameraRig } from '../render/followCamera.js';
import { setTimeOfDay, lighting } from '../world/dayNightCycle.js';
import { CAUSEWAY_Z } from '../world/cityLayout.js';
import { spawnVehicle } from '../vehicles/vehiclePhysics.js';
import { enterVehicle } from '../vehicles/vehicleEntry.js';
import { teleportPlayer } from '../characters/playerController.js';
import { giveWeapon } from '../combat/weaponCatalog.js';
import { RACES } from '../races/raceCatalog.js';
import { startRace, skipToCheckpoint } from '../races/streetRaces.js';
import { setRadioBanner } from '../ui/hud.js';
import { setProgressState, trafficCar, advanceScene } from './sceneStagers.js';

export function stageRace(api) {
  lighting.sunAzimuthBias = 0.3;
  setTimeOfDay(17.4);
  setProgressState(18450, 510, 5);
  giveWeapon('pistol', 60);
  const def = RACES.find((r) => r.id === 'causeway'), east = Math.PI / 2, west = -east, z = def.start.z;
  teleportPlayer(def.start.x, z, east);
  const car = spawnVehicle('muscle', def.start.x, z, east, { color: 0xe8a01a });
  car.playerOwned = true; enterVehicle(game.player, car);
  startRace('causeway', true);
  advanceScene(api, 3.2);   // the 3-2-1 countdown with the rivals held on the grid
  // jump the field to the bridge, five checkpoints in, and let everyone race on from there
  const rivals = skipToCheckpoint(5, 27.4);
  const place = (v, x, lane, speed) => { v.pos.set(x, 0, CAUSEWAY_Z + lane); v.heading = east; v.vx = speed; v.vz = 0; };
  place(car, 536, 3.75, 43);
  place(rivals[0].v, 551, 1.9, 42); place(rivals[1].v, 566, 5.4, 43); place(rivals[2].v, 512, 5.6, 40);
  teleportPlayer(536, z, east); enterVehicle(game.player, car);
  trafficCar('taxi', 588, CAUSEWAY_Z - 2, west); trafficCar('pickup', 624, CAUSEWAY_Z - 5.5, west); trafficCar('sedan', 668, CAUSEWAY_Z - 2, west, 0x1d4b7a);
  cameraRig.yaw = east; cameraRig.pitch = 0.24; cameraRig.snap = true;
  setRadioBanner(null);
  simulateKey('KeyW', true);
  advanceScene(api, 0.5);
  simulateKey('KeyW', false);
}
