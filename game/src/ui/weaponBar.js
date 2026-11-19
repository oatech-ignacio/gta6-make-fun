// Weapon bar: one slot per weapon with its number key, icon and ammo. The equipped slot is highlighted,
// weapons not yet bought are dimmed, and weapons above the player's respect rank show a lock and the rank needed.
import { game } from '../core/gameState.js';
import { WEAPONS, WEAPON_ORDER, WEAPON_ICONS } from '../combat/weaponCatalog.js';
import { getRespectRank, RESPECT_RANKS } from '../systems/economy.js';

let bar = null, lastHtml = '';

export function initWeaponBar() { bar = document.getElementById('weapon-bar'); }

/** What each slot should show, straight from the inventory and the rank table. */
export function getWeaponSlots() {
  const rank = getRespectRank().index;
  return WEAPON_ORDER.map((key, i) => {
    const w = WEAPONS[key], owned = !!game.weapons[key], ammo = game.ammo[key];
    const locked = !owned && (w.respect || 0) > rank;
    return { key, number: i + 1, name: w.name, owned, locked, selected: game.currentWeapon === key,
      unlockRank: locked ? RESPECT_RANKS[w.respect].name : '',
      ammo: w.melee ? '∞' : owned && ammo ? `${ammo.clip}<small>/${ammo.reserve}</small>` : '' };
  });
}

function slotHtml(s) {
  const cls = `ws${s.selected ? ' sel' : ''}${s.locked ? ' locked' : s.owned ? '' : ' unowned'}`;
  const foot = s.locked ? `<u>&#128274; ${s.unlockRank.toUpperCase()}</u>` : s.owned ? `<span>${s.ammo}</span>` : '<u>GUN SHOP</u>';
  return `<div class="${cls}"><kbd>${s.number}</kbd>${WEAPON_ICONS[s.key]}${s.selected ? `<b>${s.name.toUpperCase()}</b>` : ''}${foot}</div>`;
}

export function updateWeaponBar() {
  const html = getWeaponSlots().map(slotHtml).join('');
  if (html !== lastHtml) { lastHtml = html; bar.innerHTML = html; }
}
