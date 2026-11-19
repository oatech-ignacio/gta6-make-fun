// Pause menu shell: header with tabs (MAP, STORY, STATS, CREW, SETTINGS, CONTROLS, SAVE), the full Palmera Bay
// map tab with a completion ring, summary and legend, and the resume / main menu buttons.
import { game } from '../core/gameState.js';
import { formatMoney, formatClock } from '../core/mathUtils.js';
import { drawCityMap } from './minimap.js';
import { getRespectRank } from '../systems/economy.js';
import { getNextMissionInfo } from '../missions/missionProgress.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { PLACES, getDistrictAt } from '../world/cityLayout.js';
import { PAUSE_TABS, completionRingHtml, pauseTabHtml, bindPauseTab } from './pauseTabs.js';

let open = false, handlers = { onResume: null, onQuit: null }, mapCanvas = null, activeTab = 'MAP';

export function initPauseMap(callbacks) { handlers = callbacks; }
export function isPauseMapOpen() { return open; }

function summaryHtml() {
  const s = game.stats, rank = getRespectRank();
  const rows = [
    ['Cash', `<b class="cash">${formatMoney(game.money)}</b>`], ['Respect', `<b>${rank.respect} &middot; ${rank.name}</b>`],
    ['Missions', `<b>${Math.min(game.missionIndex, STORY_MISSIONS.length)} / ${STORY_MISSIONS.length}</b>`], ['Wanted', `<b>${'★'.repeat(game.wanted.stars) || 'Clean'}</b>`],
    ['Cars stolen', `<b>${s.carsStolen}</b>`], ['Cops escaped', `<b>${s.copsEscaped}</b>`],
  ];
  return rows.map((r) => `<div><span>${r[0]}</span>${r[1]}</div>`).join('');
}

function nextJobHtml() {
  const next = getNextMissionInfo();
  if (!next) return '<div class="mrow done"><i>✓</i><span><b>Story complete</b><br><em>Palmera Bay is yours.</em></span></div>';
  return `<div class="mrow next"><i>${next.number}</i><span><b>${next.title}</b> &middot; ${next.giver}<br><em>${next.blurb}</em></span></div>`;
}

function legendHtml() {
  const keys = ['safehouse', 'bait', 'club', 'chopShop', 'gunShop', 'bank', 'hospital', 'policeStation', 'taxiDepot', 'raceStart', 'respray', 'mansion'];
  return keys.map((k) => `<span><i style="background:${PLACES[k].color}">${PLACES[k].icon}</i>${PLACES[k].name}</span>`).join('');
}

function mapTabHtml() {
  const next = getNextMissionInfo();
  return `<div class="pm-mapwrap"><canvas id="pm-canvas" width="1140" height="820"></canvas></div>
    <div class="pm-side">
      <div class="panel pm-card pm-hero">${completionRingHtml('15vh')}<div><h3>DEZ MARLOWE &middot; ${getRespectRank().name.toUpperCase()}</h3><div class="pm-stats">${summaryHtml()}</div></div></div>
      <div class="panel pm-card"><h3>${next ? `NEXT JOB &middot; ${next.act} &middot; MISSION ${next.number}/${next.total}` : 'STORY'}</h3><div class="pm-mission">${nextJobHtml()}</div></div>
      <div class="panel pm-card"><h3>LEGEND</h3><div class="pm-legend">${legendHtml()}</div></div>
    </div>`;
}

export function renderPauseMap() {
  const root = document.getElementById('pause-map'), p = game.player.pos;
  root.innerHTML = `
    <div class="pm-head"><h1>PALMERA HEAT</h1><div class="pm-tabs">${PAUSE_TABS.map((t) => `<button data-tab="${t}" class="${t === activeTab ? 'on' : ''}">${t}</button>`).join('')}</div><div class="pm-clock">${formatClock(game.timeOfDay)} &middot; ${getDistrictAt(p.x, p.z).name.toUpperCase()}</div></div>
    ${activeTab === 'MAP' ? mapTabHtml() : `<div class="pm-page">${pauseTabHtml(activeTab)}</div>`}
    <div class="pm-foot"><button id="pm-resume">RESUME</button><button id="pm-quit">MAIN MENU</button><span class="keys">M / ESC resume &middot; click a tab &middot; autosaves after every mission</span></div>`;
  mapCanvas = document.getElementById('pm-canvas');
  if (mapCanvas) drawCityMap(mapCanvas); else bindPauseTab(activeTab, root.querySelector('.pm-page'), handlers);
  root.querySelectorAll('.pm-tabs button').forEach((b) => { b.onclick = () => showPauseTab(b.dataset.tab); });
  document.getElementById('pm-resume').onclick = () => handlers.onResume && handlers.onResume();
  document.getElementById('pm-quit').onclick = () => handlers.onQuit && handlers.onQuit();
}

export function showPauseTab(tab) { if (PAUSE_TABS.includes(tab)) { activeTab = tab; if (open) renderPauseMap(); } }
export function openPauseMap(tab = 'MAP') { open = true; activeTab = tab; renderPauseMap(); document.getElementById('pause-map').classList.remove('hidden'); }
export function closePauseMap() { open = false; document.getElementById('pause-map').classList.add('hidden'); }
export function updatePauseMap() { if (open && mapCanvas && activeTab === 'MAP') drawCityMap(mapCanvas); }
