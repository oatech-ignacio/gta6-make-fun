// Job: the big stats header row and the icon legend on the pause MAP tab. Every number is read from live game
// data: story missions, side activities (races, garages, taxi fares, chop shop, flamingo collectibles), the
// showroom car collection, weapons owned, districts visited and radio stations.
import { game } from '../core/gameState.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { RACES } from '../races/raceCatalog.js';
import { GARAGES, getCollection } from '../systems/garage.js';
import { FLAMINGO_SPOTS } from '../systems/pickups.js';
import { WEAPON_ORDER } from '../combat/weaponCatalog.js';
import { DISTRICTS } from '../world/cityLayout.js';
import { RADIO_STATIONS } from '../audio/radioStations.js';

const LEGEND = [
  ['H', '#6dff8f', 'Safehouse'], ['S', '#4fe3d6', 'Garage'], ['R', '#c77dff', 'Street race'], ['!', '#ffd166', 'Mission'],
  ['P', '#5b8cff', 'Police'], ['G', '#ff5d5d', 'Shop'], ['A', '#ff8f5a', 'Arco del Sol'], ['▲', '#ff3d8b', 'You'],
];

export function mapStatsHeaderHtml() {
  const districts = Object.keys(DISTRICTS).filter((k) => k !== 'sea');
  const cars = getCollection();
  const activities = RACES.length + GARAGES.length + FLAMINGO_SPOTS.length + 2;
  const done = Object.keys(game.races.wins).length + Object.keys(game.garage.visited).length + (game.stats.flamingos || 0);
  const cells = [
    [game.missionIndex, STORY_MISSIONS.length, 'MISSIONS'], [done, activities, 'ACTIVITIES'],
    [cars.filter((c) => c.owned).length, cars.length, 'VEHICLES'], [WEAPON_ORDER.filter((k) => game.weapons[k]).length, WEAPON_ORDER.length, 'WEAPONS'],
    [districts.filter((k) => game.visited[k]).length, districts.length, 'DISTRICTS'], [RADIO_STATIONS.length, RADIO_STATIONS.length, 'RADIO'],
  ];
  return `<div class="pm-bigstats">${cells.map(([have, of, label]) => `<div><b>${have}<small>/${of}</small></b><span>${label}</span></div>`).join('')}</div>`;
}

export function mapLegendHtml() {
  return `<div class="pm-maplegend">${LEGEND.map(([icon, color, label]) => `<span><i style="background:${color}">${icon}</i>${label}</span>`).join('')}</div>`;
}
