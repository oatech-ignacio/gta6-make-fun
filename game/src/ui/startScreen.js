// Title screen over the live city: CONTINUE / NEW GAME / LOAD GAME / SETTINGS / CONTROLS / STORY, with the
// save slot list on the right and an animated sunset skyline behind the title lockup.
import { describeSave, latestSave } from '../systems/saveGame.js';
import { renderSaveSlots } from './saveSlotList.js';
import { settingsHtml, bindSettings } from './settingsForm.js';
import { formatMoney } from '../core/mathUtils.js';
import { STORY_MISSIONS, STORY_ACTS } from '../missions/storyMissions.js';
import { STORY_SYNOPSIS } from '../missions/storyCharacters.js';

export const CONTROLS = [
  ['W A S D', 'Walk / drive'], ['MOUSE', 'Look and aim'], ['SHIFT', 'Sprint'], ['SPACE', 'Jump / handbrake drift'],
  ['F', 'Enter, exit or steal a vehicle'], ['RIGHT MOUSE', 'Aim'], ['LEFT MOUSE', 'Punch / fire (drive-by in cars)'],
  ['1 2 3 4 5 / Q', 'Fists, pistol, SMG, shotgun, rifle'], ['R', 'Reload on foot / next radio station in cars'], ['E', 'Interact: shops, garages, race starts, recruit crew, siren'], ['Z X C', 'Crew abilities: Decoy Run, Pit Stop, Blind Spot'],
  ['T', 'Start taxi fares in a Sunfare Cab'], ['H', 'Horn'], ['M / ESC', 'Pause menu: map, story, stats, crew, save'], ['ENTER', 'Skip dialogue'],
];

let callbacks = {};

function sheet(html) {
  const old = document.querySelector('#start-screen .sheet'); if (old) old.remove();
  if (!html) return null;
  const div = document.createElement('div'); div.className = 'sheet panel'; div.innerHTML = html;
  document.getElementById('start-screen').appendChild(div);
  return div;
}

function select(id) { document.querySelectorAll('#start-screen .menu button').forEach((b) => b.classList.toggle('sel', b.id === id)); }

function showSaves() {
  select('ss-load');
  const div = sheet('<h2>LOAD GAME</h2><div class="slots"></div><p class="hint">Three save slots and an autosave. Save from the pause menu or by sleeping at the motel.</p>');
  renderSaveSlots(div.querySelector('.slots'), 'LOAD', (slot, data) => { if (data) callbacks.onLoad(data); }, false);
}

function showControls() {
  select('ss-controls');
  sheet(`<h2>CONTROLS</h2><table>${CONTROLS.map((c) => `<tr><td>${c[0]}</td><td>${c[1]}</td></tr>`).join('')}</table>`);
}

function showSettings() {
  select('ss-settings');
  bindSettings(sheet(`<h2>SETTINGS</h2>${settingsHtml()}`), callbacks.onGraphicsChanged);
}

function showStory() {
  select('ss-story');
  const acts = STORY_ACTS.map((act) => `<h3>${act.name} &middot; ${act.title}</h3><table>${STORY_MISSIONS.slice(act.from, act.to + 1).map((m, i) => `<tr><td>${act.from + i + 1}. ${m.title}</td><td>${m.blurb}</td></tr>`).join('')}</table>`).join('');
  sheet(`<h2>${STORY_MISSIONS.length} STORY MISSIONS</h2><p>${STORY_SYNOPSIS.join(' ')}</p>${acts}`);
}

/** A strip of procedurally sized towers that drifts sideways behind the menu (two copies for a seamless loop). */
function skylineHtml() {
  let towers = '';
  for (let i = 0; i < 44; i++) {
    const h = 22 + ((i * 37) % 61) + (i % 7 === 0 ? 30 : 0), w = 1.6 + ((i * 13) % 5) * 0.5;
    towers += `<i style="height:${h}%;width:${w}vw"${i % 4 === 0 ? ' class="lit"' : ''}></i>`;
  }
  return `<div class="skyline"><div class="sun"></div><div class="towers">${towers}${towers}</div></div>`;
}

export function showStartScreen(handlers) {
  callbacks = handlers;
  const root = document.getElementById('start-screen'), save = describeSave(latestSave());
  root.innerHTML = `${skylineHtml()}
    <div class="logo"><span class="l1">PALMERA</span><span class="l2">HEAT</span><span class="tag">AN OPEN-WORLD CRIME STORY</span></div>
    <div class="menu">
      <button id="ss-continue" ${save ? 'class="sel"' : 'disabled'}>CONTINUE${save ? `<small>${save.act} &middot; ${save.missionNumber}/${save.missionTotal} &middot; ${save.percent}% &middot; ${formatMoney(save.money)}</small>` : '<small>no save yet</small>'}</button>
      <button id="ss-new" ${save ? '' : 'class="sel"'}>NEW GAME</button>
      <button id="ss-load">LOAD GAME</button>
      <button id="ss-settings">SETTINGS</button>
      <button id="ss-controls">CONTROLS</button>
      <button id="ss-story">STORY</button>
    </div>
    <div class="start-foot">NEON ROW &middot; CORAL STRAND &middot; RUSTWATER DOCKS &middot; HIBISCUS HEIGHTS &middot; AZUCAR MARKET &middot; ISLA DORADA</div>`;
  root.classList.remove('hidden');
  document.getElementById('ss-new').onclick = () => handlers.onNewGame();
  document.getElementById('ss-continue').onclick = () => handlers.onContinue();
  document.getElementById('ss-load').onclick = showSaves;
  document.getElementById('ss-controls').onclick = showControls;
  document.getElementById('ss-settings').onclick = showSettings;
  document.getElementById('ss-story').onclick = showStory;
  showSaves();
  select(save ? 'ss-continue' : 'ss-new');
}

export function hideStartScreen() { document.getElementById('start-screen').classList.add('hidden'); }
export function isStartScreenVisible() { return !document.getElementById('start-screen').classList.contains('hidden'); }
