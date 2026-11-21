// Job: stage the `garage` screenshot. Mid-campaign, the player drives a Marlin RS into Coral Strand Customs and
// presses E: the real garage menu opens on the WORKSHOP tab with the car turning on the lit turntable.
import { game } from '../core/gameState.js';
import { PLACES } from '../world/cityLayout.js';
import { setTimeOfDay } from '../world/dayNightCycle.js';
import { spawnVehicle } from '../vehicles/vehiclePhysics.js';
import { enterVehicle } from '../vehicles/vehicleEntry.js';
import { teleportPlayer } from '../characters/playerController.js';
import { GARAGES, openGarage } from '../systems/garage.js';
import { setProgressState, advanceScene } from './sceneStagers.js';

export function stageGarage(api) {
  setTimeOfDay(13);
  setProgressState(18450, 310, 4);
  const at = PLACES.customs;
  teleportPlayer(at.x, at.z);
  const car = spawnVehicle('sports', at.x, at.z, at.heading, { color: 0xff3d8b });
  car.playerOwned = true; enterVehicle(game.player, car);
  car.health = 64;
  Object.assign(game.garage, { engine: 2, armor: 1, tyres: 3, resprays: 3, plateSwaps: 1 });
  for (const key of ['sports', 'taxi', 'sedan', 'muscle', 'compact', 'pickup']) game.garage.collection[key] = true;
  game.flags.controlsLocked = true;
  advanceScene(api, 1);
  openGarage(GARAGES.find((g) => g.key === 'customs'));
  advanceScene(api, 1.2);
}
