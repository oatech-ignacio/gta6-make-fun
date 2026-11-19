// Save / load to localStorage: progress, money, respect, weapons, stats, position and time of day.
import { game } from '../core/gameState.js';
import { onEvent } from '../core/eventBus.js';

const KEY = 'palmeraHeat.save.v1';

export function initAutosave() {
  onEvent('missionCompleted', () => { saveGame(true); });
}

export function buildSaveData() {
  const p = game.player;
  return {
    version: 1, savedAt: Date.now(),
    money: game.money, respect: game.respect, missionIndex: game.missionIndex,
    weapons: game.weapons, ammo: game.ammo, currentWeapon: game.currentWeapon,
    stats: game.stats, timeOfDay: game.timeOfDay,
    player: p ? { x: p.pos.x, z: p.pos.z, heading: p.heading, health: p.health, armor: p.armor } : null,
  };
}

export function saveGame(auto = false) {
  try {
    const data = buildSaveData(); data.auto = auto;
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) { return false; }
}

export function readSave() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (err) { return null; }
}

export function hasSave() { return !!readSave(); }

export function deleteSave() { try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ } }

/** Copies a save into the live game state; the caller repositions the player from the returned data. */
export function applySave(data) {
  game.money = data.money; game.respect = data.respect; game.missionIndex = data.missionIndex;
  game.weapons = data.weapons || { fists: true }; game.ammo = data.ammo || {}; game.currentWeapon = data.currentWeapon || 'fists';
  Object.assign(game.stats, data.stats || {});
  game.timeOfDay = data.timeOfDay || 12;
  return data.player;
}

export function describeSave(data = readSave()) {
  if (!data) return null;
  const d = new Date(data.savedAt);
  return {
    when: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    missions: data.missionIndex, money: data.money, respect: data.respect, auto: !!data.auto,
  };
}
