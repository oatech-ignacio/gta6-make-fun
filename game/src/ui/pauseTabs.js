// Job: build the content of the pause menu tabs other than the map: STORY, STATS, CREW, SETTINGS, CONTROLS
// and SAVE, plus the "% complete" ring. Each builder returns HTML; `bind` hooks up anything interactive.
import { game } from '../core/gameState.js';
import { formatMoney } from '../core/mathUtils.js';
import { getRespectRank, RESPECT_RANKS } from '../systems/economy.js';
import { getCompletion } from '../systems/progression.js';
import { saveGame } from '../systems/saveGame.js';
import { STORY_MISSIONS, STORY_ACTS } from '../missions/storyMissions.js';
import { STORY_CAST, STORY_SYNOPSIS } from '../missions/storyCharacters.js';
import { CHARACTER_LOOKS } from '../characters/characterLooks.js';
import { FLAMINGO_SPOTS } from '../systems/pickups.js';
import { drawCharacterPortrait } from './characterPortraits.js';
import { renderSaveSlots } from './saveSlotList.js';
import { settingsHtml, bindSettings } from './settingsForm.js';
import { CONTROLS } from './startScreen.js';

import { RACES } from '../races/raceCatalog.js';
import { getCrewStatus } from '../crew/crewAbilities.js';
import { GARAGES, UPGRADES, MAX_LEVEL, countUpgrades } from '../systems/garage.js';

/** Street races, crew and garage progress; shown on the STATS page and beside the city map. */
export function hustleRows() {
  const crew = getCrewStatus();
  return [
    ['Street races won', `${Object.keys(game.races.wins).length} / ${RACES.length}`], ['Crew recruited', `${crew.filter((c) => c.hired).length} / ${crew.length}`],
    ['Garage upgrades', `${countUpgrades()} / ${UPGRADES.length * MAX_LEVEL}`], ['Garages found', `${Object.keys(game.garage.visited).length} / ${GARAGES.length}`],
  ];
}

export const PAUSE_TABS =['MAP', 'STORY', 'STATS', 'CREW', 'SETTINGS', 'CONTROLS', 'SAVE'];

/** SVG ring showing overall completion, computed by the progression system. */
export function completionRingHtml(size = '15vh') {
  const pct = getCompletion().percent, c = 2 * Math.PI * 42;
  return `<div class="ring" style="width:${size};height:${size}"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" class="track"/><circle cx="50" cy="50" r="42" class="fill" stroke-dasharray="${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/></svg><b>${pct}%</b><small>COMPLETE</small></div>`;
}

function missionStatus(i) { return i < game.missionIndex ? 'done' : i === game.missionIndex ? 'next' : 'locked'; }

function storyHtml() {
  const acts = STORY_ACTS.map((act) => {
    const rows = STORY_MISSIONS.slice(act.from, act.to + 1).map((def, k) => {
      const i = act.from + k, st = missionStatus(i);
      return `<div class="mrow ${st}"><i>${st === 'done' ? '✓' : i + 1}</i><span><b>${st === 'locked' ? '? ? ?' : def.title}</b> &middot; ${STORY_CAST[def.giver].name}<br><em>${st === 'locked' ? 'Finish the jobs before this one.' : def.blurb}</em></span><small>${st === 'done' ? 'PASSED' : formatMoney(def.reward.money)}</small></div>`;
    }).join('');
    return `<div class="panel pm-card"><h3>${act.name} &middot; ${act.title.toUpperCase()}</h3><div class="pm-mission">${rows}</div></div>`;
  }).join('');
  return `<div class="pm-cols3">${acts}</div><p class="pm-note">${STORY_SYNOPSIS.join(' ')}</p>`;
}

function statsHtml() {
  const s = game.stats, rank = getRespectRank(), done = getCompletion();
  const parts = done.parts.map((p) => `<div class="prow"><span>${p.label}</span><div class="bar progress"><i style="width:${(p.have / p.of * 100).toFixed(0)}%"></i></div><b>${p.have}/${p.of}</b></div>`).join('');
  const rows = [
    ['Cash', formatMoney(game.money)], ['Money earned', formatMoney(s.moneyEarned)], ['Respect', `${Math.round(game.respect)} · ${rank.name}`], ['Next rank', rank.next ? `${rank.next} at ${rank.nextAt}` : 'Top rank'],
    ['Story missions', `${Math.min(game.missionIndex, STORY_MISSIONS.length)} / ${STORY_MISSIONS.length}`], ['Missions failed', s.missionsFailed],
    ['Cars stolen', s.carsStolen], ['Distance driven', `${(s.distance / 1609).toFixed(1)} mi`], ['Cops escaped', s.copsEscaped], ['Highest wanted', s.highestWanted ? '★'.repeat(s.highestWanted) : 'Clean'],
    ['Kills', s.kills], ['Gang members', s.gangKills], ['Officers down', s.copsDown], ['Busted / Wasted', `${s.bustedCount} / ${s.wastedCount}`],
    ...hustleRows(), ['Crew abilities used', s.crewCalls], ['Resprays / plate swaps', `${game.garage.resprays} / ${game.garage.plateSwaps}`],
    ['Taxi fares', s.taxiFares], ['Race wins (all)', s.racesWon], ['Flamingos', `${s.flamingos} / ${FLAMINGO_SPOTS.length}`], ['Time played', `${Math.floor(s.playTime / 60)} min`],
  ];
  const ranks = RESPECT_RANKS.map((r, i) => `<div class="rank ${i <= rank.index ? 'have' : ''}"><b>${r.name.toUpperCase()}</b><small>${r.at} respect &middot; ${r.unlock}</small></div>`).join('');
  return `<div class="pm-cols2">
    <div class="panel pm-card"><h3>COMPLETION</h3><div class="pm-complete">${completionRingHtml('20vh')}<div class="pm-parts">${parts}</div></div><h3 style="margin-top:1.4vh">RESPECT RANKS</h3><div class="pm-ranks">${ranks}</div></div>
    <div class="panel pm-card"><h3>CAREER STATS &middot; DEZ MARLOWE</h3><div class="pm-stats">${rows.map((r) => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div></div></div>`;
}

function crewHtml() {
  const cards = Object.entries(STORY_CAST).map(([key, c]) => {
    const met = key === 'dez' || !!game.crew[key];
    return `<div class="panel crew ${met ? '' : 'unmet'}"><canvas width="112" height="112" data-cast="${key}"></canvas><div><b>${met ? c.name.toUpperCase() : '? ? ?'}</b><small>${met ? c.role : 'Not met yet'}</small><p>${met ? c.bio : 'Keep working the story to cross paths.'}</p></div></div>`;
  }).join('');
  const met = Object.keys(STORY_CAST).filter((k) => k === 'dez' || game.crew[k]).length;
  const allies = getCrewStatus().map((c) => `<div class="panel ${c.hired ? '' : 'unmet'}"><b>${c.name.toUpperCase()} &middot; ${c.role.toUpperCase()}</b>${c.ability} [${c.label}] &middot; ${c.hired ? `${c.cooldown}s cooldown` : `recruit for ${formatMoney(c.price)} at the teal C blip`}<br>${c.blurb}</div>`).join('');
  return `<h3 class="pm-title">CREW AND CONTACTS &middot; ${met}/${Object.keys(STORY_CAST).length} MET</h3><div class="pm-crew">${cards}</div><div class="pm-allies">${allies}</div>`;
}

function controlsHtml() {
  const half = Math.ceil(CONTROLS.length / 2), table = (list) => `<table>${list.map((c) => `<tr><td>${c[0]}</td><td>${c[1]}</td></tr>`).join('')}</table>`;
  return `<div class="pm-cols2"><div class="panel pm-card sheetlike"><h3>ON FOOT AND DRIVING</h3>${table(CONTROLS.slice(0, half))}</div><div class="panel pm-card sheetlike"><h3>ACTIONS</h3>${table(CONTROLS.slice(half))}</div></div>`;
}

const BUILDERS = {
  STORY: storyHtml, STATS: statsHtml, CREW: crewHtml, CONTROLS: controlsHtml,
  SETTINGS: () => `<div class="panel pm-card sheetlike narrow"><h3>SETTINGS</h3>${settingsHtml()}</div>`,
  SAVE: () => `<div class="panel pm-card narrow"><h3>SAVE GAME</h3><div class="slots"></div><p class="pm-note" id="pm-save-note">Pick a slot to save. You cannot save during a mission or while wanted.</p></div>`,
};

export function pauseTabHtml(tab) { return BUILDERS[tab](); }

/** Hooks up the interactive parts of a tab after its HTML is in the page. */
export function bindPauseTab(tab, host, handlers) {
  if (tab === 'SETTINGS') bindSettings(host, handlers.onGraphicsChanged);
  if (tab === 'CREW') host.querySelectorAll('canvas[data-cast]').forEach((cv) => { const c = STORY_CAST[cv.dataset.cast]; drawCharacterPortrait(cv, CHARACTER_LOOKS[c.look] || CHARACTER_LOOKS.gang, c.portrait); });
  if (tab === 'SAVE') {
    const draw = () => renderSaveSlots(host.querySelector('.slots'), 'SAVE', (slot) => {
      const ok = !game.activeMission && game.wanted.stars === 0 && saveGame(slot);
      host.querySelector('#pm-save-note').textContent = ok ? `Saved to slot ${slot}.` : 'Not now: finish the mission and lose the police first.';
      draw();
    });
    draw();
  }
}
