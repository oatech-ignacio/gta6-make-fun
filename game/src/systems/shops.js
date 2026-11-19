// Interactive locations: Iron Pelican Arms (weapons), Odette's chop shop, the safehouse bed. Garages live in garage.js.
import { game } from '../core/gameState.js';
import { wasKeyPressed } from '../core/input.js';
import { PLACES } from '../world/cityLayout.js';
import { WEAPONS, giveWeapon, selectWeapon } from '../combat/weaponCatalog.js';
import { spendMoney, addMoney, addRespect, getRespectRank } from './economy.js';
import { saveGame } from './saveGame.js';
import { createMarker } from '../missions/missionMarkers.js';
import { setPrompt } from '../ui/hud.js';
import { showNotification } from '../ui/notifications.js';
import { formatMoney } from '../core/mathUtils.js';
import { playSound } from '../core/cues.js';
import { removeVehicle } from '../vehicles/vehiclePhysics.js';
import { leaveVehicle } from '../vehicles/vehicleEntry.js';
import { emitEvent } from '../core/eventBus.js';

let menuOpen = false;
const menuEl = () => document.getElementById('shop-menu');

export const GUN_SHOP_STOCK = [
  { key: '1', label: 'Coral 9 pistol', weapon: 'pistol' },
  { key: '2', label: 'Mako SMG', weapon: 'smg' },
  { key: '3', label: 'Tidebreaker 12 shotgun', weapon: 'shotgun' },
  { key: '4', label: 'Barracuda AR rifle', weapon: 'rifle' },
  { key: '5', label: 'Body armour', armor: true, price: 600, respect: 0 },
  { key: '6', label: 'First-aid kit', health: true, price: 150, respect: 0 },
];

export function initShops() {
  createMarker({ x: PLACES.gunShop.x, z: PLACES.gunShop.z, color: 0xff5d5d, icon: 'G', label: PLACES.gunShop.name, radius: 1.6, persistent: true });
  createMarker({ x: PLACES.chopShop.x, z: PLACES.chopShop.z, color: 0xff9f43, icon: 'O', label: PLACES.chopShop.name, radius: 3, persistent: true });
  createMarker({ x: PLACES.safehouse.x, z: PLACES.safehouse.z, color: 0x6dff8f, icon: 'H', label: PLACES.safehouse.name, radius: 1.5, persistent: true });
}

function near(place, r) { const p = game.player.pos; return (p.x - place.x) ** 2 + (p.z - place.z) ** 2 < r * r; }

function renderGunMenu() {
  const rank = getRespectRank().index;
  const rows = GUN_SHOP_STOCK.map((item) => {
    const w = item.weapon ? WEAPONS[item.weapon] : null;
    const owned = w && game.weapons[item.weapon];
    const price = w ? (owned ? w.ammoPrice : w.price) : item.price;
    const need = w ? w.respect : item.respect;
    const locked = rank < need;
    const label = w ? (owned ? `${w.name} ammo x${w.ammoPack}` : item.label) : item.label;
    return `<div class="shop-row ${locked ? 'locked' : ''}"><kbd>${item.key}</kbd><span>${label}</span><b>${locked ? 'NEEDS MORE RESPECT' : formatMoney(price)}</b></div>`;
  }).join('');
  menuEl().innerHTML = `<h2>IRON PELICAN ARMS</h2><p>"If it floats, flies or fires, we stock it." &middot; Cash: ${formatMoney(game.money)}</p>${rows}<div class="shop-row"><kbd>E</kbd><span>Leave</span><b></b></div>`;
}

function buyFromGunShop(item) {
  const rank = getRespectRank().index, player = game.player;
  if (item.weapon) {
    const w = WEAPONS[item.weapon], owned = game.weapons[item.weapon];
    if (rank < w.respect) return playSound('empty', player.pos);
    if (!spendMoney(owned ? w.ammoPrice : w.price, 'weapons')) return playSound('empty', player.pos);
    giveWeapon(item.weapon, owned ? w.ammoPack : w.clip * 3); selectWeapon(item.weapon);
  } else if (item.armor) { if (player.armor >= 100 || !spendMoney(item.price, 'armour')) return playSound('empty', player.pos); player.armor = 100; }
  else if (item.health) { if (player.health >= player.maxHealth || !spendMoney(item.price, 'medkit')) return playSound('empty', player.pos); player.health = player.maxHealth; }
  playSound('cash', player.pos);
  renderGunMenu();
}

export function isShopMenuOpen() { return menuOpen; }
export function closeShopMenu() { menuOpen = false; menuEl().classList.add('hidden'); game.flags.controlsLocked = false; }

export function updateShops(dt) {
  const player = game.player, v = player.vehicle;
  if (menuOpen) {
    for (const item of GUN_SHOP_STOCK) if (wasKeyPressed('Digit' + item.key)) buyFromGunShop(item);
    if (wasKeyPressed('KeyE') || wasKeyPressed('Escape') || !near(PLACES.gunShop, 4)) closeShopMenu();
    return;
  }
  let prompt = null;
  if (!v && near(PLACES.gunShop, 2.4)) {
    prompt = '<kbd>E</kbd>Browse Iron Pelican Arms';
    if (wasKeyPressed('KeyE')) { menuOpen = true; game.flags.controlsLocked = true; renderGunMenu(); menuEl().classList.remove('hidden'); }
  } else if (v && near(PLACES.chopShop, 4.5) && Math.abs(v.speed) < 6 && !v.missionTag && !game.activeMission) {
    const value = v.isPolice ? 0 : Math.round(v.spec.value * (0.35 + 0.65 * v.health / 100) / 10) * 10;
    prompt = value ? `<kbd>E</kbd>Sell this ${v.spec.name} to Odette &middot; ${formatMoney(value)}` : 'Odette does not touch police property';
    if (value && wasKeyPressed('KeyE')) {
      leaveVehicle(player); removeVehicle(v); addMoney(value, 'chop shop'); addRespect(4); playSound('cash', player.pos);
      showNotification(`<b>ODETTE'S AUTO</b>${v.spec.name} stripped for parts: ${formatMoney(value)}.`, 'money', 4);
    }
  } else if (!v && near(PLACES.safehouse, 2.2)) {
    prompt = game.wanted.stars ? 'Lose the cops before you lie low' : game.activeMission ? 'Finish the job before you rest' : '<kbd>E</kbd>Rest and save at the Sol y Sombra';
    if (!game.wanted.stars && !game.activeMission && wasKeyPressed('KeyE')) {
      player.health = player.maxHealth; emitEvent('advanceClock', 7); saveGame();
      showNotification('<b>GAME SAVED</b>Slept it off at the Sol y Sombra Motel.', 'gold', 4); playSound('pickup', player.pos);
    }
  }
  setPrompt('shop', prompt);
}
