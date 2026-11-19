// The single shared game state object: every system reads and writes this instead of globals.
export const game = {
  mode: 'boot',            // 'menu' | 'play' | 'shot'
  paused: false,
  time: 0, dt: 0, frame: 0,
  timeOfDay: 17.4,         // hours, 0..24
  nightFactor: 0,          // 0 = day, 1 = night (set by the day/night cycle)
  timeScale: 1,
  seed: 1,
  rng: null,
  scene: null, camera: null, renderer: null,
  city: null,              // { network, blocks, places, ... } from cityBuilder
  player: null,            // character entity
  characters: [],          // every pedestrian, cop, gangster, ally and the player
  vehicles: [],
  money: 0, respect: 0,
  missionIndex: 0,         // next story mission to play
  activeMission: null,
  weapons: { fists: true }, ammo: {}, currentWeapon: 'fists',
  wanted: { stars: 0, heat: 0, unseen: 0, evading: false, lastKnown: { x: 0, z: 0 }, flash: 0 },
  stats: { kills: 0, carsStolen: 0, distance: 0, bustedCount: 0, wastedCount: 0, taxiFares: 0, racesWon: 0, playTime: 0, flamingos: 0, moneyEarned: 0, copsDown: 0 },
  flags: { cinematic: false, controlsLocked: false, hudHidden: false },
  cameraShake: 0,
};

export function resetProgress() {
  game.money = 350; game.respect = 0; game.missionIndex = 0; game.activeMission = null;
  game.weapons = { fists: true }; game.ammo = {}; game.currentWeapon = 'fists';
  game.timeOfDay = 16.6;
  for (const k of Object.keys(game.stats)) game.stats[k] = 0;
  resetWantedState();
}
export function resetWantedState() {
  Object.assign(game.wanted, { stars: 0, heat: 0, unseen: 0, evading: false, flash: 0 });
}
