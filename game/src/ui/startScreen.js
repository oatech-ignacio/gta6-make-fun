// Title screen over the live city: New Game, Continue, Controls and Settings.
import { describeSave } from '../systems/saveGame.js';
import { getSettings, updateSetting } from '../systems/settings.js';
import { formatMoney } from '../core/mathUtils.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { STORY_SYNOPSIS } from '../missions/storyCharacters.js';
import { setMasterVolume } from '../audio/audioEngine.js';

export const CONTROLS = [
  ['W A S D', 'Walk / drive'], ['MOUSE', 'Look and aim'], ['SHIFT', 'Sprint'], ['SPACE', 'Jump / handbrake drift'],
  ['F', 'Enter, exit or steal a vehicle'], ['RIGHT MOUSE', 'Aim'], ['LEFT MOUSE', 'Punch / fire (drive-by in cars)'],
  ['1 2 3 4 / Q', 'Fists, pistol, SMG, shotgun'], ['R', 'Reload on foot / next radio station in cars'], ['E', 'Interact, shops, siren in police cars'],
  ['T', 'Start taxi fares in a Sunfare Cab'], ['H', 'Horn'], ['M / ESC', 'City map and pause'], ['ENTER', 'Skip dialogue'],
];

let callbacks = {};

function sheet(html) {
  const old = document.querySelector('#start-screen .sheet'); if (old) old.remove();
  if (!html) return;
  const div = document.createElement('div'); div.className = 'sheet panel'; div.innerHTML = html;
  document.getElementById('start-screen').appendChild(div);
}

function showControls() {
  sheet(`<h2>CONTROLS</h2><table>${CONTROLS.map((c) => `<tr><td>${c[0]}</td><td>${c[1]}</td></tr>`).join('')}</table>`);
}

function showSettings() {
  const st = getSettings();
  sheet(`<h2>SETTINGS</h2>
    <label>Master volume <input id="ss-volume" type="range" min="0" max="1" step="0.05" value="${st.masterVolume}"></label>
    <label>Radio volume <input id="ss-music" type="range" min="0" max="1" step="0.05" value="${st.musicVolume}"></label>
    <label>Mouse sensitivity <input id="ss-sens" type="range" min="0.3" max="2.5" step="0.05" value="${st.mouseSensitivity}"></label>
    <label>Bloom and glow <input id="ss-bloom" type="checkbox" ${st.bloom ? 'checked' : ''}></label>
    <label>Sun shadows <input id="ss-shadows" type="checkbox" ${st.shadows ? 'checked' : ''}></label>`);
  document.getElementById('ss-volume').oninput = (e) => { updateSetting('masterVolume', Number(e.target.value)); setMasterVolume(Number(e.target.value)); };
  document.getElementById('ss-music').oninput = (e) => updateSetting('musicVolume', Number(e.target.value));
  document.getElementById('ss-sens').oninput = (e) => updateSetting('mouseSensitivity', Number(e.target.value));
  document.getElementById('ss-bloom').onchange = (e) => { updateSetting('bloom', e.target.checked); if (callbacks.onGraphicsChanged) callbacks.onGraphicsChanged(); };
  document.getElementById('ss-shadows').onchange = (e) => { updateSetting('shadows', e.target.checked); if (callbacks.onGraphicsChanged) callbacks.onGraphicsChanged(); };
}

function showStory() {
  sheet(`<h2>THE STORY SO FAR</h2>${STORY_SYNOPSIS.map((p) => `<p>${p}</p>`).join('')}<h2 style="margin-top:2vh">${STORY_MISSIONS.length} STORY MISSIONS</h2><table>${STORY_MISSIONS.map((m, i) => `<tr><td>${i + 1}. ${m.title}</td><td>${m.blurb}</td></tr>`).join('')}</table>`);
}

export function showStartScreen(handlers) {
  callbacks = handlers;
  const root = document.getElementById('start-screen'), save = describeSave();
  root.innerHTML = `
    <div class="logo"><span class="l1">PALMERA</span><span class="l2">HEAT</span><span class="tag">AN OPEN-WORLD CRIME STORY</span></div>
    <div class="menu">
      <button id="ss-new" class="sel">NEW GAME</button>
      <button id="ss-continue" ${save ? '' : 'disabled'}>CONTINUE${save ? `<small>${save.missions}/${STORY_MISSIONS.length} missions &middot; ${formatMoney(save.money)} &middot; ${save.when}</small>` : '<small>no save yet</small>'}</button>
      <button id="ss-story">STORY</button>
      <button id="ss-controls">CONTROLS</button>
      <button id="ss-settings">SETTINGS</button>
    </div>
    <div class="start-foot">PALMERA BAY &middot; NEON ROW &middot; CORAL STRAND &middot; RUSTWATER DOCKS &middot; HIBISCUS HEIGHTS &middot; ISLA DORADA</div>`;
  root.classList.remove('hidden');
  document.getElementById('ss-new').onclick = () => handlers.onNewGame();
  document.getElementById('ss-continue').onclick = () => handlers.onContinue();
  document.getElementById('ss-controls').onclick = showControls;
  document.getElementById('ss-settings').onclick = showSettings;
  document.getElementById('ss-story').onclick = showStory;
}

export function hideStartScreen() { document.getElementById('start-screen').classList.add('hidden'); }
export function isStartScreenVisible() { return !document.getElementById('start-screen').classList.contains('hidden'); }
