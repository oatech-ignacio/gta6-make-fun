// Weapon definitions (original names) and inventory helpers: ammo, clips, reloading, switching.
import { game } from '../core/gameState.js';

// Field guide: damage is per hit (per pellet for the shotgun), rate is seconds between shots,
// range is in metres, spread is the cone half-angle in radians, respect is the shop unlock tier.
export const WEAPONS = {
  /** Bare hands: always owned, short reach, a touch quicker than before to make brawls less sluggish. */
  fists: { key: 'fists', name: 'Fists', slot: 1, melee: true, damage: 16, rate: 0.4, range: 1.9 },
  /** Coral 9: the starter sidearm. Accurate and cheap to feed; three or four hits drop a street thug. */
  pistol: { key: 'pistol', name: 'Coral 9', slot: 2, damage: 28, rate: 0.25, clip: 12, range: 78, spread: 0.011, auto: false, price: 450, ammoPrice: 60, ammoPack: 48, sound: 'pistol', respect: 0 },
  /** Mako SMG: full-auto spray for car chases. High rate of fire, loose spread, burns through ammo. */
  smg: { key: 'smg', name: 'Mako SMG', slot: 3, damage: 14, rate: 0.08, clip: 34, range: 58, spread: 0.036, auto: true, price: 1800, ammoPrice: 140, ammoPack: 136, sound: 'smg', respect: 1 },
  /** Tidebreaker 12: eight-pellet pump shotgun. Brutal up close, falls off fast, slow to cycle. */
  shotgun: { key: 'shotgun', name: 'Tidebreaker 12', slot: 4, damage: 13, pellets: 8, rate: 0.9, clip: 6, range: 28, spread: 0.09, auto: false, price: 2500, ammoPrice: 120, ammoPack: 24, sound: 'shotgun', respect: 2 },
};
/** Cycle order for the mouse wheel and number keys; matches each weapon's slot. */
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

export const WEAPON_ICONS = {
  fists: '<svg viewBox="0 0 84 50"><path fill="#fff" d="M24 14h30a8 8 0 0 1 8 8v10a10 10 0 0 1-10 10H30a10 10 0 0 1-10-10V18a4 4 0 0 1 4-4zm4 0v10m9-10v10m9-10v10" stroke="#111" stroke-width="2.5"/></svg>',
  pistol: '<svg viewBox="0 0 84 50"><path fill="#fff" stroke="#111" stroke-width="2" d="M10 12h58l4 3v9H46l-2 6H34l-3 14H17l5-20H10z"/><rect x="50" y="15" width="16" height="3" fill="#111"/></svg>',
  smg: '<svg viewBox="0 0 84 50"><path fill="#fff" stroke="#111" stroke-width="2" d="M4 14h62v-4h4v4h10v8H56l-2 5H44v17h-9V27h-9l-4 12H12l4-14H4z"/><rect x="48" y="16" width="20" height="3" fill="#111"/></svg>',
  shotgun: '<svg viewBox="0 0 84 50"><path fill="#fff" stroke="#111" stroke-width="2" d="M2 16h78v6H52v4H30l-6 14H12l4-14H2z"/><rect x="36" y="23" width="14" height="5" fill="#111"/></svg>',
};

/** Seconds a reload takes, shared by every firearm. */
const RELOAD_SECONDS = 1.05;

/** Adds a weapon to the inventory (with a full first clip) and tops up its reserve ammo. */
export function giveWeapon(key, ammo = 0) {
  const w = WEAPONS[key];
  game.weapons[key] = true;
  if (!w.melee) {
    const a = game.ammo[key] || (game.ammo[key] = { clip: w.clip, reserve: 0 });
    a.reserve += ammo;
  }
}

/** Equips an owned weapon; returns false if the player does not have it. */
export function selectWeapon(key) {
  if (!game.weapons[key]) return false;
  game.currentWeapon = key;
  if (game.player) game.player.weapon = key;
  return true;
}

/** Steps to the next (+1) or previous (-1) owned weapon, wrapping around. */
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
  return RELOAD_SECONDS;
}

/** Clip and reserve counts for the HUD, or null for melee and unowned weapons. */
export function getAmmoText(key) {
  const a = game.ammo[key];
  return a ? { clip: a.clip, reserve: a.reserve } : null;
}
