// Job: track the 5-star wanted level. Crimes add heat, witnesses matter, stars rise with heat and
// decay once no officer has had eyes on the player for long enough.
import { game } from '../core/gameState.js';
import { emitEvent } from '../core/eventBus.js';
import { hasLineOfSight } from '../world/collisionGrid.js';

export const STAR_HEAT = [0, 20, 60, 130, 240, 400];
const CRIMES = {
  speeding: { heat: 10, needsCop: true, cooldown: 8 },
  carTheft: { heat: 10, needsCop: true, cooldown: 2 },
  carjack: { heat: 22, witnessChance: 0.6, cooldown: 2 },
  assault: { heat: 14, witnessChance: 0.5, cooldown: 1.5 },
  hitPed: { heat: 16, witnessChance: 0.5, cooldown: 1 },
  murder: { heat: 42, witnessChance: 0.85, cooldown: 0.5 },
  gangKill: { heat: 14, witnessChance: 0.4, cooldown: 0.5 },
  gunfire: { heat: 12, witnessChance: 0.7, cooldown: 2.5 },
  hitCop: { heat: 55, cooldown: 1 },
  shootCop: { heat: 45, cooldown: 1.5 },
  killCop: { heat: 110, cooldown: 0.2 },
  stealPolice: { heat: 70, cooldown: 1 },
  ramPolice: { heat: 18, cooldown: 2 },
};
const lastCrimeTime = {};
let searchTimer = 0;

export function starsForHeat(heat) { let s = 0; while (s < 5 && heat >= STAR_HEAT[s + 1]) s++; return s; }

export function isCopNear(x, z, radius) {
  const r2 = radius * radius;
  for (const c of game.characters) if (c.kind === 'cop' && c.state !== 'dead' && (c.pos.x - x) ** 2 + (c.pos.z - z) ** 2 < r2) return true;
  for (const v of game.vehicles) if (v.isPolice && !v.wrecked && v.ai && (v.pos.x - x) ** 2 + (v.pos.z - z) ** 2 < r2) return true;
  return false;
}

/** Report a crime at a position. Depending on the crime it needs a nearby cop or a lucky witness. */
export function reportCrime(type, pos) {
  const crime = CRIMES[type];
  if (!crime || game.flags.wantedLocked || game.mode === 'shot') return;
  if (game.time - (lastCrimeTime[type] || -99) < crime.cooldown) return;
  lastCrimeTime[type] = game.time;
  const w = game.wanted, copNear = isCopNear(pos.x, pos.z, 70);
  if (crime.needsCop && !copNear && w.stars === 0) return;
  if (!copNear && w.stars === 0 && crime.witnessChance !== undefined && Math.random() > crime.witnessChance) return;
  addWantedHeat(crime.heat);
  w.unseen = 0;
  emitEvent('crimeReported', { type, pos });
}

export function addWantedHeat(amount) {
  const w = game.wanted, before = w.stars;
  w.heat = Math.min(STAR_HEAT[5] + 60, w.heat + amount);
  w.stars = Math.max(w.stars, starsForHeat(w.heat));
  if (w.stars > before) { w.flash = 1.2; w.unseen = 0; if (before === 0) w.seen = true; game.stats.highestWanted = Math.max(game.stats.highestWanted || 0, w.stars); emitEvent('wantedChanged', { stars: w.stars, before }); }
}

export function setWantedLevel(stars) {
  const w = game.wanted, before = w.stars;
  w.stars = Math.max(0, Math.min(5, stars)); w.heat = STAR_HEAT[w.stars] + (stars > 0 ? 5 : 0); w.unseen = 0; w.evading = false; w.seen = stars > 0;
  game.stats.highestWanted = Math.max(game.stats.highestWanted || 0, w.stars);
  if (before !== w.stars) emitEvent('wantedChanged', { stars: w.stars, before });
}

export function clearWantedLevel(reason = 'lost') {
  const w = game.wanted;
  if (w.stars === 0 && w.heat === 0) return;
  const before = w.stars;
  w.stars = 0; w.heat = 0; w.unseen = 0; w.evading = false; w.seen = false;
  emitEvent('wantedChanged', { stars: 0, before, reason });
}

function policeCanSeePlayer() {
  const p = game.player.pos;
  if (game.flags.jamUntil > game.time) return false;   // the lookout's Blind Spot ability
  for (const c of game.characters) {
    if (c.kind !== 'cop' || c.state === 'dead' || c.state === 'down') continue;
    const d2 = (c.pos.x - p.x) ** 2 + (c.pos.z - p.z) ** 2;
    if (d2 < 70 * 70 && hasLineOfSight(c.pos.x, c.pos.z, p.x, p.z)) return true;
  }
  for (const v of game.vehicles) {
    if (!v.isPolice || v.wrecked || !v.ai || v.driver === game.player) continue;
    const d2 = (v.pos.x - p.x) ** 2 + (v.pos.z - p.z) ** 2;
    if (d2 < 85 * 85 && hasLineOfSight(v.pos.x, v.pos.z, p.x, p.z)) return true;
  }
  return !!(game.helicopter && game.helicopter.active && game.helicopter.seesPlayer);
}

export function getEscapeTime() { return 9 + game.wanted.stars * 5; }

/** For the HUD chip: are the police looking at the player, and if not, how long until the search is called off. */
export function getSightStatus() {
  const w = game.wanted;
  if (w.stars === 0) return null;
  const total = getEscapeTime();
  return { inSight: !!w.seen || w.unseen < 0.3, held: !!game.flags.wantedHold, searchRemaining: Math.max(0, total - w.unseen), searchTotal: total };
}

export function updateWantedLevel(dt) {
  const w = game.wanted;
  w.flash = Math.max(0, w.flash - dt);
  if (w.stars === 0) { w.heat = Math.max(0, w.heat - dt * 1.5); w.evading = false; return; }
  searchTimer -= dt;
  if (searchTimer <= 0) { searchTimer = 0.25; w.seen = policeCanSeePlayer(); }
  if (w.seen) { w.unseen = 0; w.evading = false; w.lastKnown.x = game.player.pos.x; w.lastKnown.z = game.player.pos.z; }
  else {
    w.unseen += dt; w.evading = w.unseen > 2.5;
    if (w.unseen > getEscapeTime() && !game.flags.wantedHold) clearWantedLevel('lost');
  }
}
