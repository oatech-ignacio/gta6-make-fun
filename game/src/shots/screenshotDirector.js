// Deterministic screenshot mode (index.html?shot=<name>&seed=1): stages real gameplay moments with the
// game's own systems (vehicles, police, pedestrians, missions, races, HUD), fast-forwards the simulation and renders.
import { game } from '../core/gameState.js';
import { applyTimeOfDay } from '../world/dayNightCycle.js';
import { trafficConfig } from '../vehicles/trafficAI.js';
import { pedestrianConfig } from '../characters/pedestrianAI.js';
import { setHudVisible } from '../ui/hud.js';
import { createSeededRandom } from '../core/rng.js';
import { getPostProcessing } from '../render/renderer.js';
import { stageChase } from './chaseScene.js';
import { stageOnfoot } from './onfootScene.js';
import { stageRace } from './raceScene.js';
import { stageStart, stageMap } from './menuScenes.js';

export const SCREENSHOT_SCENES = { chase: stageChase, onfoot: stageOnfoot, race: stageRace, start: stageStart, map: stageMap };

export async function runScreenshotScene(name, api) {
  Math.random = createSeededRandom(game.seed + 971);
  const stage = SCREENSHOT_SCENES[name] || stageChase;
  trafficConfig.targetMoving = 22; pedestrianConfig.target = 30;
  setHudVisible(true);
  const post = getPostProcessing(); post.bloomStrength = 0.6;
  stage(api);
  applyTimeOfDay(game.timeOfDay);
  api.render(); api.render();
  await new Promise((resolve) => requestAnimationFrame(() => { api.render(); resolve(); }));
}
