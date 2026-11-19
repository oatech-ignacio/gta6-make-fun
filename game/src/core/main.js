// Job: PALMERA HEAT bootstrap. Builds the city, wires every system together, runs the per-frame
// update, and switches between the title screen, gameplay, the pause map and screenshot mode.
import { game, resetProgress } from './gameState.js';
import { createSeededRandom } from './rng.js';
import { initInput, wasKeyPressed, endInputFrame, setPointerLockEnabled, requestPointerLock, releasePointerLock } from './input.js';
import { startGameLoop, stepSimulation, renderOnce } from './gameLoop.js';
// wanted level and police
import { updateWantedLevel } from '../systems/wantedLevel.js';
import { initPoliceDispatch, updatePoliceDispatch } from '../police/policeDispatch.js';
// player, pedestrians, vehicles and traffic
import { createPlayer, updatePlayer, teleportPlayer } from '../characters/playerController.js';
import { initPedestrians, updatePedestrians, populatePedestriansAround } from '../characters/pedestrianAI.js';
import { updateCharacterPhysics, registerCharacterMeshFactory } from '../characters/characterEntity.js';
import { updateVehiclePhysics, resolveVehicleCollisions, registerVehicleMeshFactory } from '../vehicles/vehiclePhysics.js';
import { initTraffic, updateTraffic, populateTrafficAround } from '../vehicles/trafficAI.js';
// story, economy, saves, HUD, missions
import { STORY_CAST } from '../missions/storyCharacters.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { getRespectRank } from '../systems/economy.js';
import { initAutosave, applySave, latestSave } from '../systems/saveGame.js';
import { initProgression, updateProgression } from '../systems/progression.js';
import { initHud, updateHud, setHudVisible, setObjective } from '../ui/hud.js';
import { initMissions, updateMissions, refreshMissionStartMarker } from '../missions/missionRunner.js';
import { updateMarkers } from '../missions/missionMarkers.js';
import { initSideActivities, updateSideActivities } from '../missions/sideActivities.js';
// street races, crew allies, garages
import { initStreetRaces, updateStreetRaces } from '../races/streetRaces.js';
import { updateCrew } from '../crew/crewAbilities.js';
import { initGarage, updateGarage, isGarageOpen } from '../systems/garage.js';
import { initCrewPanel, updateCrewPanel } from '../ui/crewPanel.js';
import { initRaceHud, updateRaceHud } from '../ui/raceHud.js';
// combat, pickups, shops, respawn
import { initDamageSystem } from '../combat/damageSystem.js';
import { selectWeapon } from '../combat/weaponCatalog.js';
import { initWorldPickups, updatePickups } from '../systems/pickups.js';
import { initShops, updateShops, isShopMenuOpen } from '../systems/shops.js';
import { initPlayerRespawn, updatePlayerRespawn } from '../systems/playerRespawn.js';
import { initPoliceHelicopter, updatePoliceHelicopter } from '../police/policeHelicopter.js';
import { loadSettings, getSettings } from '../systems/settings.js';
// interface
import { buildBaseMap, drawMinimap } from '../ui/minimap.js';
import { initPauseMap, openPauseMap, closePauseMap, updatePauseMap } from '../ui/pauseMap.js';
import { showStartScreen, hideStartScreen } from '../ui/startScreen.js';
import { updateDialogue } from '../ui/dialogueBox.js';
import { showNotification } from '../ui/notifications.js';
// audio and effects
import { initAudio, resumeAudio, suspendAudio } from '../audio/audioEngine.js';
import { initSoundEffects, updateContinuousSounds } from '../audio/soundEffects.js';
import { updateRadio } from '../audio/radioStations.js';
import { initVisualEffects, updateVisualEffects } from '../combat/visualEffects.js';
// world generation, models and rendering
import { PLACES } from '../world/cityLayout.js';
import { buildCity, updateCityAnimations } from '../world/cityBuilder.js';
import { initDayNight, updateDayNight, lighting, setTimeOfDay } from '../world/dayNightCycle.js';
import { buildTrafficLights, updateTrafficLights } from '../vehicles/trafficLights.js';
import { createVehicleMesh, animateLightBar } from '../vehicles/vehicleMeshFactory.js';
import { createCharacterMesh } from '../characters/characterMeshFactory.js';
import { createRenderer, renderFrame, getPostProcessing } from '../render/renderer.js';
import { cameraRig, updateFollowCamera, snapCameraBehind } from '../render/followCamera.js';
import { runScreenshotScene } from '../shots/screenshotDirector.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
let menuAngle = 0.6, manualStepping = false, minimapCanvas = null;

/** One simulation step of the whole world. `dt` is scaled game time, `realDt` is wall-clock time. */
export function simulateWorld(dt, realDt = dt) {
  game.dt = dt; game.time += dt; game.stats.playTime += dt; game.frame++;
  updatePlayer(dt);
  updateTraffic(dt);
  updatePoliceDispatch(dt);
  updatePoliceHelicopter(dt);
  for (const v of game.vehicles) updateVehiclePhysics(v, dt);
  resolveVehicleCollisions();
  updatePedestrians(dt);
  for (const c of game.characters.slice()) updateCharacterPhysics(c, dt);
  updateWantedLevel(dt);
  updateMissions(dt, realDt);
  updateSideActivities(dt);
  updateStreetRaces(dt);
  updateCrew(dt);
  updateGarage();
  updateProgression(dt);
  updateShops(dt);
  updatePickups(dt);
  updateMarkers(dt);
  updateDialogue(realDt);
  updatePlayerRespawn(realDt);
  updateTrafficLights(game.time);
  updateCityAnimations(game.city, dt);
  updateVisualEffects(dt);
  updateFollowCamera(realDt);
  const focus = game.player.vehicle ? game.player.vehicle.pos : game.player.pos;
  updateDayNight(dt, cameraRig.override ? { x: cameraRig.override.tx, z: cameraRig.override.tz } : focus);
  updateRadio(dt);
  updateContinuousSounds(dt);
  updateHud(realDt);
  updateCrewPanel(); updateRaceHud();
  drawMinimap(minimapCanvas);
}

function setPaused(paused) {
  game.paused = paused;
  if (paused) { openPauseMap(); releasePointerLock(); } else { closePauseMap(); requestPointerLock(); }
  suspendAudio(paused);
}

function updateMenuBackdrop(dt) {
  // slow helicopter-style orbit over Coral Strand while the city lives underneath
  menuAngle += dt * 0.035;
  const cx = 330, cz = 30, r = 250;
  cameraRig.override = { x: cx + Math.cos(menuAngle) * r, y: 58, z: cz + Math.sin(menuAngle) * r, tx: cx - 60, ty: 26, tz: cz - 20, fov: 50 };
  game.flags.controlsLocked = true;
  simulateWorld(dt, dt);
}

function frameUpdate(realDt) {
  if (game.mode === 'menu') updateMenuBackdrop(realDt);
  else if (game.mode === 'play') {
    const toggle = wasKeyPressed('KeyM') || wasKeyPressed('KeyP') || (wasKeyPressed('Escape') && !isShopMenuOpen() && !isGarageOpen());
    if (toggle) setPaused(!game.paused);
    if (game.paused) updatePauseMap();
    else if (!manualStepping) simulateWorld(realDt * game.timeScale, realDt);
  }
  if (!manualStepping || game.paused) endInputFrame();
}

function frameRender() { renderFrame(lighting.exposure); }

function applyGraphicsSettings() {
  const st = getSettings();
  getPostProcessing().enabled = st.bloom;
  game.renderer.shadowMap.enabled = st.shadows;
}

function populateWorldAroundPlayer() {
  const p = game.player.pos;
  populateTrafficAround(p.x, p.z, 16, 30, 200);
  populatePedestriansAround(18, 10, 130);
}

function beginPlay(saved) {
  hideStartScreen();
  cameraRig.override = null;
  game.flags.controlsLocked = false;
  if (saved) {
    const pos = applySave(saved) || PLACES.safehouse;
    teleportPlayer(pos.x, pos.z, pos.heading || 0);
    game.player.health = pos.health || 100; game.player.armor = pos.armor || 0;
    game.missionIndex = Math.min(game.missionIndex, STORY_MISSIONS.length);
    selectWeapon(game.currentWeapon);
    showNotification(`<b>WELCOME BACK, ${getRespectRank().name.toUpperCase()}</b>Game loaded. Follow the letter blip to your next job.`, 'gold', 6);
  } else {
    resetProgress();
    teleportPlayer(PLACES.safehouse.x + 4, PLACES.safehouse.z + 12, 0);
    showNotification("<b>PALMERA BAY</b>Dez and Luz just hit town with $350. Tio Benny has work: follow the gold <b style='display:inline'>T</b> blip down Corsair Boulevard.", 'gold', 12);
    showNotification('<b>BASICS</b>WASD move &middot; F steals cars &middot; M opens the city map &middot; right mouse aims.', '', 12);
  }
  setTimeOfDay(game.timeOfDay);
  initWorldPickups(game.stats.flamingos);
  refreshMissionStartMarker();
  populateWorldAroundPlayer();
  setHudVisible(true);
  setObjective('');
  game.mode = 'play'; game.paused = false;
  setPointerLockEnabled(true); requestPointerLock(); resumeAudio();
}

function enterMenu() {
  game.mode = 'menu';
  setHudVisible(false);
  setPointerLockEnabled(false);
  showStartScreen({
    onNewGame: () => beginPlay(null),
    onContinue: () => { const s = latestSave(); if (s) beginPlay(s); },
    onLoad: (data) => beginPlay(data),
    onGraphicsChanged: applyGraphicsSettings,
  });
}

function boot() {
  loadSettings();
  registerVehicleMeshFactory(createVehicleMesh, animateLightBar);
  registerCharacterMeshFactory(createCharacterMesh);
  game.seed = Number(params.get('seed') || 1);
  game.rng = createSeededRandom(game.seed);
  const canvas = document.getElementById('view');
  createRenderer(canvas, { preserveDrawingBuffer: !!shotName, pixelRatio: shotName ? 1 : undefined });
  game.city = buildCity(game.scene, game.rng);
  game.scene.add(buildTrafficLights(game.city.network));
  if (params.get('hour')) game.timeOfDay = Number(params.get('hour'));
  initDayNight(game.scene, { sky: game.city.sky, facadeMaterials: game.city.facadeMaterials, signs: game.city.signs, beacons: game.city.beacons });
  initVisualEffects(game.scene);
  initInput(canvas); initAudio(); initSoundEffects(); initHud(); buildBaseMap();
  minimapCanvas = document.getElementById('minimap');
  document.title = `PALMERA HEAT - ${STORY_CAST.dez.name} & ${STORY_CAST.luz.name}`;
  initTraffic(); initPedestrians(); initDamageSystem(); initPoliceDispatch(); initPoliceHelicopter(); initPlayerRespawn(); initMissions(); initAutosave(); initProgression();
  initPauseMap({ onResume: () => setPaused(false), onQuit: () => location.reload(), onGraphicsChanged: applyGraphicsSettings });
  resetProgress();
  createPlayer(PLACES.safehouse.x + 4, PLACES.safehouse.z + 12, 0);
  initShops(); initGarage(); initSideActivities(); initStreetRaces(); initCrewPanel(); initRaceHud(); initWorldPickups(0);
  applyGraphicsSettings();
  // handles for tests and tooling (fast-forwarding the simulation from page.evaluate)
  window.__game = game;
  window.__debug = {
    simulateWorld, stepSimulation, renderOnce, beginPlay, setPaused, setTimeOfDay,
    /** Tests drive the clock themselves: fastForward() steps the world and consumes input edges per step. */
    setManualStepping: (on) => { manualStepping = on; },
    fastForward: (seconds, step = 1 / 30) => { for (let i = 0; i < Math.round(seconds / step); i++) { if (!game.paused) simulateWorld(step * game.timeScale, step); endInputFrame(); } },
  };
  if (shotName) {
    game.mode = 'shot';
    runScreenshotScene(shotName, { simulateWorld, render: frameRender, params }).then(() => { window.__shotReady = true; });
    return;
  }
  populateWorldAroundPlayer();
  enterMenu();
  startGameLoop(frameUpdate, frameRender);
  snapCameraBehind(0);
}

boot();
