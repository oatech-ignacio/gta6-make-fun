// Progression bookkeeping: awards respect for escapes and gang kills, records districts visited, allies met
// and career stats, and works out the "% complete" figure shown on save slots and the pause menu.
import { game } from '../core/gameState.js';
import { onEvent } from '../core/eventBus.js';
import { addRespect, RESPECT_RANKS } from './economy.js';
import { getDistrictAt, DISTRICTS } from '../world/cityLayout.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { FLAMINGO_SPOTS } from './pickups.js';
import { showNotification } from '../ui/notifications.js';

const LAND_DISTRICTS = Object.keys(DISTRICTS).filter((k) => k !== 'sea');
let districtTimer = 0;

export function initProgression() {
  // losing the police on your own (not by dying or being arrested) is worth respect, more for more stars
  onEvent('wantedChanged', (e) => {
    if (e.stars !== 0 || e.reason !== 'lost' || !e.before) return;
    game.stats.copsEscaped++;
    const gain = 4 + e.before * 6;
    addRespect(gain);
    showNotification(`<b>ESCAPED ${'★'.repeat(e.before)}</b>Bay Patrol lost you. Respect +${gain}.`, 'gold', 4);
  });
  onEvent('characterKilled', (e) => {
    if (e.attacker !== game.player) return;
    const kind = e.character.kind;
    if (kind === 'gang' || kind === 'guard') { game.stats.gangKills++; addRespect(4); }
  });
  onEvent('missionFailed', () => { game.stats.missionsFailed++; });
  onEvent('castSpoke', (e) => { game.crew[e.who] = true; });
  onEvent('rankUp', (rank) => showNotification(`<b>RANK UP: ${rank.name.toUpperCase()}</b>${rank.unlock}.`, 'gold', 7));
}

export function updateProgression(dt) {
  districtTimer -= dt;
  if (districtTimer > 0 || game.mode !== 'play') return;
  districtTimer = 1;
  const key = getDistrictAt(game.player.pos.x, game.player.pos.z).key;
  if (key !== 'sea' && !game.visited[key]) game.visited[key] = true;
}

/** Completion broken into weighted parts; `percent` is the total out of 100. */
export function getCompletion() {
  const s = game.stats, part = (label, have, of, weight) => ({ label, have: Math.min(have, of), of, weight, score: Math.min(have, of) / of * weight });
  const parts = [
    part('Story missions', Math.min(game.missionIndex, STORY_MISSIONS.length), STORY_MISSIONS.length, 50),
    part('Golden flamingos', s.flamingos, FLAMINGO_SPOTS.length, 15),
    part('Districts visited', LAND_DISTRICTS.filter((k) => game.visited[k]).length, LAND_DISTRICTS.length, 10),
    part('Boulevard Sprint wins', s.racesWon, 3, 5),
    part('Taxi fares', s.taxiFares, 10, 5),
    part('Cars stolen', s.carsStolen, 25, 5),
    part('Police escapes', s.copsEscaped, 10, 5),
    part('Respect', Math.round(game.respect), RESPECT_RANKS[RESPECT_RANKS.length - 1].at, 5),
  ];
  return { percent: Math.round(parts.reduce((sum, p) => sum + p.score, 0)), parts };
}
