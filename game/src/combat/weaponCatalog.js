// Weapon definitions (original names) and inventory helpers: ammo, clips, reloading, switching.
import { game } from '../core/gameState.js';

export const WEAPONS = {
  fists: { key: 'fists', name: 'Fists', slot: 1, melee: true, damage: 15, rate: 0.42, range: 1.8 },
  pistol: { key: 'pistol', name: 'Coral 9', slot: 2, damage: 27, rate: 0.26, clip: 12, range: 75, spread: 0.012, auto: false, price: 450, ammoPrice: 60, ammoPack: 48, sound: 'pistol', respect: 0 },
  smg: { key: 'smg', name: 'Mako SMG', slot: 3, damage: 15, rate: 0.085, clip: 32, range: 60, spread: 0.034, auto: true, price: 1800, ammoPrice: 140, ammoPack: 128, sound: 'smg', respect: 1 },
  shotgun: { key: 'shotgun', name: 'Tidebreaker 12', slot: 4, damage: 12, pellets: 8, rate: 0.85, clip: 6, range: 30, spread: 0.085, auto: false, price: 2600, ammoPrice: 120, ammoPack: 24, sound: 'shotgun', respect: 2 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

export const WEAPON_ICONS = {
  fists: '<svg viewBox="0 0 84 50"><path fill="#fff" d="M24 14h30a8 8 0 0 1 8 8v10a10 10 0 0 1-10 10H30a10 10 0 0 1-10-10V18a4 4 0 0 1 4-4zm4 0v10m9-10v10m9-10v10" stroke="#111" stroke-width="2.5"/></svg>',
  pistol: '<svg viewBox="0 0 84 50"><path fill="#fff" stroke="#111" stroke-width="2" d="M10 12h58l4 3v9H46l-2 6H34l-3 14H17l5-20H10z"/><rect x="50" y="15" width="16" height="3" fill="#111"/></svg>',
  smg: '<svg viewBox="0 0 84 50"><path fill="#fff" stroke="#111" stroke-width="2" d="M4 14h62v-4h4v4h10v8H56l-2 5H44v17h-9V27h-9l-4 12H12l4-14H4z"/><rect x="48" y="16" width="20" height="3" fill="#111"/></svg>',
  shotgun: '<svg viewBox="0 0 84 50"><path fill="#fff" stroke="#111" stroke-width="2" d="M2 16h78v6H52v4H30l-6 14H12l4-14H2z"/><rect x="36" y="23" width="14" height="5" fill="#111"/></svg>',
};

export function giveWeapon(key, ammo = 0) {
  const w = WEAPONS[key];
  game.weapons[key] = true;
  if (!w.melee) {
    const a = game.ammo[key] || (game.ammo[key] = { clip: w.clip, reserve: 0 });
    a.reserve += ammo;
  }
}

export function selectWeapon(key) {
  if (!game.weapons[key]) return false;
  game.currentWeapon = key;
  if (game.player) game.player.weapon = key;
  return true;
}

export function cycleWeapon(direction) {
  const owned = WEAPON_ORDER.filter((k) => game.weapons[k]);
  const i = owned.indexOf(game.currentWeapon);
  selectWeapon(owned[(i + direction + owned.length) % owned.length]);
}

/** Starts a reload; returns the reload time or 0 when nothing to do. */
export function reloadWeapon(key) {
  const w = WEAPONS[key], a = game.ammo[key];
  if (!a || w.melee || a.clip >= w.clip || a.reserve <= 0) return 0;
  const take = Math.min(w.clip - a.clip, a.reserve);
  a.clip += take; a.reserve -= take;
  return 1.1;
}

export function getAmmoText(key) {
  const a = game.ammo[key];
  return a ? { clip: a.clip, reserve: a.reserve } : null;
}
