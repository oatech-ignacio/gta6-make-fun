// Save / load to localStorage: three manual slots plus an autosave slot. Each save holds progress, money,
// respect, weapons, stats, districts visited, crew met, position and time of day, with a summary for menus.
import { game, newGarage } from '../core/gameState.js';
import { onEvent } from '../core/eventBus.js';
import { getDistrictAt } from '../world/cityLayout.js';
import { getCompletion } from './progression.js';
import { describeStoryPosition } from '../missions/missionProgress.js';

const KEY = 'palmeraHeat.save.v2.';
export const SAVE_SLOTS = [1, 2, 3];
export const AUTOSAVE_SLOT = 'auto';

export function initAutosave() {
  onEvent('missionCompleted', () => { saveGame(AUTOSAVE_SLOT); });
}

export function buildSaveData() {
  const p = game.player;
  return {
    version: 2, savedAt: Date.now(),
    money: game.money, respect: game.respect, missionIndex: game.missionIndex,
    weapons: game.weapons, ammo: game.ammo, currentWeapon: game.currentWeapon,
    stats: game.stats, visited: game.visited, crew: game.crew, timeOfDay: game.timeOfDay,
    allies: game.allies, races: game.races, garage: game.garage,
    completion: getCompletion().percent,
    district: p ? getDistrictAt(p.pos.x, p.pos.z).name : '',
    player: p ? { x: p.pos.x, z: p.pos.z, heading: p.heading, health: p.health, armor: p.armor } : null,
  };
}

/** Writes the current game to a slot (1-3, or the autosave slot). `true` is accepted as "autosave". */
export function saveGame(slot = game.saveSlot) {
  if (slot === true) slot = AUTOSAVE_SLOT;
  try {
    const data = buildSaveData(); data.slot = slot; data.auto = slot === AUTOSAVE_SLOT;
    localStorage.setItem(KEY + slot, JSON.stringify(data));
    if (slot !== AUTOSAVE_SLOT) game.saveSlot = slot;
    return true;
  } catch (err) { return false; }
}

export function readSave(slot) {
  try { const raw = localStorage.getItem(KEY + slot); return raw ? JSON.parse(raw) : null; } catch (err) { return null; }
}

/** The autosave and the three manual slots, in menu order; `data` is null for an empty slot. */
export function listSaves() {
  return [AUTOSAVE_SLOT, ...SAVE_SLOTS].map((slot) => ({ slot, data: readSave(slot) }));
}

/** The most recently written save across every slot (what CONTINUE loads), or null. */
export function latestSave() {
  let best = null;
  for (const s of listSaves()) if (s.data && (!best || s.data.savedAt > best.savedAt)) best = s.data;
  return best;
}

export function hasSave() { return !!latestSave(); }

export function deleteSave(slot) { try { localStorage.removeItem(KEY + slot); } catch (err) { /* ignore */ } }

/** Copies a save into the live game state; the caller repositions the player from the returned data. */
export function applySave(data) {
  game.money = data.money; game.respect = data.respect; game.missionIndex = data.missionIndex;
  game.weapons = data.weapons || { fists: true }; game.ammo = data.ammo || {}; game.currentWeapon = data.currentWeapon || 'fists';
  Object.assign(game.stats, data.stats || {});
  game.visited = data.visited || {}; game.crew = data.crew || {};
  game.allies = data.allies || {}; game.races = data.races || { wins: {}, best: {} }; game.garage = Object.assign(newGarage(), data.garage);
  game.timeOfDay = data.timeOfDay || 12;
  if (typeof data.slot === 'number') game.saveSlot = data.slot;
  return data.player;
}

/** Menu summary of a save: act and mission, completion, district, cash and when it was written. */
export function describeSave(data) {
  if (!data) return null;
  const d = new Date(data.savedAt), story = describeStoryPosition(data.missionIndex);
  return {
    when: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    act: story.act, mission: story.label, missionNumber: story.number, missionTotal: story.total,
    percent: data.completion || 0, district: data.district || 'Palmera Bay', money: data.money, respect: data.respect, auto: !!data.auto,
  };
}
