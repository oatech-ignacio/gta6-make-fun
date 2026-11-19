// Menus are the same player-facing screens, populated by the normal save system.
import { game } from '../core/gameState.js';
import { setTimeOfDay } from '../world/dayNightCycle.js';
import { cameraRig } from '../render/followCamera.js';
import { teleportPlayer } from '../characters/playerController.js';
import { setHudVisible } from '../ui/hud.js';
import { openPauseMap } from '../ui/pauseMap.js';
import { showStartScreen } from '../ui/startScreen.js';
import { saveGame, deleteSave } from '../systems/saveGame.js';
import { refreshMissionStartMarker } from '../missions/missionRunner.js';
import { setWantedLevel } from '../systems/wantedLevel.js';
import { giveWeapon } from '../combat/weaponCatalog.js';
import { setProgressState, pursuitCruiser, advanceScene } from './sceneStagers.js';

function seedSaveSlots() {
  for (const slot of ['auto', 1, 2, 3]) deleteSave(slot);
  setProgressState(7320, 180, 2);
  teleportPlayer(422, 200);
  setTimeOfDay(18.1); saveGame(2);
  setProgressState(18450, 510, 5);
  Object.assign(game.stats, { copsEscaped: 7, highestWanted: 4 });
  game.visited = { downtown: true, beach: true, docks: true, suburbs: true, market: true };
  game.crew = { dez: true, luz: true, benny: true, odette: true, pike: true };
  teleportPlayer(-140, 150, 0.6);
  setTimeOfDay(18.4); saveGame(1);
}

export function stageStart(api) {
  seedSaveSlots();
  setTimeOfDay(18.2);
  cameraRig.override = { x: 530, y: 86, z: 240, tx: 160, ty: 32, tz: -90, fov: 55 };
  game.flags.controlsLocked = true;
  advanceScene(api);
  setHudVisible(false);
  showStartScreen({ onNewGame() {}, onContinue() {}, onLoad() {}, onGraphicsChanged() {} });
}

export function stageMap(api) {
  seedSaveSlots();
  giveWeapon('pistol', 60); giveWeapon('smg', 128);
  refreshMissionStartMarker();
  pursuitCruiser(-100, 240, Math.PI / 2, 10);
  pursuitCruiser(-48, 60, Math.PI, 10);
  setWantedLevel(2);
  advanceScene(api);
  setHudVisible(false);
  openPauseMap();
}
