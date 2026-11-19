// Pause screen: full Palmera Bay map with districts and blips, stats, story progress, legend,
// save slot, settings sliders and the resume / save / quit buttons.
import { game } from '../core/gameState.js';
import { formatMoney, formatClock } from '../core/mathUtils.js';
import { drawCityMap } from './minimap.js';
import { getRespectRank } from '../systems/economy.js';
import { getMissionProgressList } from '../missions/missionRunner.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { saveGame, describeSave } from '../systems/saveGame.js';
import { getSettings, updateSetting } from '../systems/settings.js';
import { FLAMINGO_SPOTS } from '../systems/pickups.js';
import { setMasterVolume } from '../audio/audioEngine.js';
import { PLACES } from '../world/cityLayout.js';

let open = false, handlers = { onResume: null, onQuit: null }, mapCanvas = null;

export function initPauseMap(callbacks) { handlers = callbacks; }
export function isPauseMapOpen() { return open; }

function statsHtml() {
  const s = game.stats, rank = getRespectRank();
  const rows = [
    ['Cash', `<b class="cash">${formatMoney(game.money)}</b>`], ['Respect', `<b>${Math.round(game.respect)} &middot; ${rank.name}</b>`],
    ['Missions', `<b>${Math.min(game.missionIndex, STORY_MISSIONS.length)} / ${STORY_MISSIONS.length}</b>`], ['Wanted', `<b>${'★'.repeat(game.wanted.stars) || 'Clean'}</b>`],
    ['Cars stolen', `<b>${s.carsStolen}</b>`], ['Taxi fares', `<b>${s.taxiFares}</b>`],
    ['Races won', `<b>${s.racesWon}</b>`], ['Flamingos', `<b>${s.flamingos} / ${FLAMINGO_SPOTS.length}</b>`],
    ['Busted / Wasted', `<b>${s.bustedCount} / ${s.wastedCount}</b>`], ['Miles driven', `<b>${(s.distance / 1609).toFixed(1)}</b>`],
  ];
  return rows.map((r) => `<div><span>${r[0]}</span>${r[1]}</div>`).join('');
}

function missionsHtml() {
  return getMissionProgressList().map((m, i) => `<div class="mrow ${m.status}"><i>${m.status === 'done' ? '✓' : i + 1}</i><span>${m.status === 'locked' ? '? ? ?' : m.title} <em style="opacity:.6;font-style:normal">&middot; ${m.status === 'locked' ? 'locked' : m.giver}</em></span><small>${formatMoney(m.reward)}</small></div>`).join('');
}

function legendHtml() {
  const keys = ['safehouse', 'bait', 'club', 'chopShop', 'gunShop', 'bank', 'hospital', 'policeStation', 'taxiDepot', 'raceStart', 'respray', 'mansion'];
  return keys.map((k) => `<span><i style="background:${PLACES[k].color}">${PLACES[k].icon}</i>${PLACES[k].name}</span>`).join('');
}

function saveHtml() {
  const info = describeSave();
  return info ? `<span>SLOT 1 &middot; <b>${info.auto ? 'AUTOSAVE' : 'MANUAL SAVE'}</b> &middot; ${info.when}</span><span>${info.missions}/${STORY_MISSIONS.length} missions &middot; ${formatMoney(info.money)}</span>` : '<span>SLOT 1 &middot; <b>EMPTY</b></span><span>Autosaves after every mission</span>';
}

export function renderPauseMap() {
  const root = document.getElementById('pause-map'), st = getSettings();
  root.innerHTML = `
    <div class="pm-head"><h1>PALMERA HEAT</h1><div class="pm-tabs"><b>CITY MAP</b><span>STATS</span><span>STORY</span><span>SETTINGS</span></div><div class="pm-clock">${formatClock(game.timeOfDay)} &middot; PALMERA BAY</div></div>
    <div class="pm-mapwrap"><canvas id="pm-canvas" width="1180" height="720"></canvas></div>
    <div class="pm-side">
      <div class="panel pm-card"><h3>DEZ MARLOWE &middot; ${getRespectRank().name.toUpperCase()}</h3><div class="pm-stats">${statsHtml()}</div></div>
      <div class="panel pm-card"><h3>STORY</h3><div class="pm-mission">${missionsHtml()}</div></div>
      <div class="panel pm-card"><h3>LEGEND</h3><div class="pm-legend">${legendHtml()}</div></div>
      <div class="panel pm-card"><div class="pm-save">${saveHtml()}</div></div>
    </div>
    <div class="pm-foot">
      <button id="pm-resume">RESUME</button><button id="pm-save">SAVE GAME</button><button id="pm-quit">MAIN MENU</button>
      <label>VOLUME <input id="pm-volume" type="range" min="0" max="1" step="0.05" value="${st.masterVolume}"></label>
      <label>MOUSE <input id="pm-sens" type="range" min="0.3" max="2.5" step="0.05" value="${st.mouseSensitivity}"></label>
      <span class="keys">ESC / M RESUME &middot; WASD MOVE &middot; F ENTER CAR &middot; RMB AIM &middot; LMB FIRE</span>
    </div>`;
  mapCanvas = document.getElementById('pm-canvas');
  drawCityMap(mapCanvas);
  document.getElementById('pm-resume').onclick = () => handlers.onResume && handlers.onResume();
  document.getElementById('pm-quit').onclick = () => handlers.onQuit && handlers.onQuit();
  document.getElementById('pm-save').onclick = () => {
    const ok = !game.activeMission && game.wanted.stars === 0 && saveGame();
    document.getElementById('pm-save').textContent = ok ? 'SAVED' : 'NOT NOW';
    root.querySelector('.pm-save').innerHTML = saveHtml();
  };
  document.getElementById('pm-volume').oninput = (e) => { updateSetting('masterVolume', Number(e.target.value)); setMasterVolume(Number(e.target.value)); };
  document.getElementById('pm-sens').oninput = (e) => updateSetting('mouseSensitivity', Number(e.target.value));
}

export function openPauseMap() { open = true; renderPauseMap(); document.getElementById('pause-map').classList.remove('hidden'); }
export function closePauseMap() { open = false; document.getElementById('pause-map').classList.add('hidden'); }
export function updatePauseMap() { if (open && mapCanvas) drawCityMap(mapCanvas); }
