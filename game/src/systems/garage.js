// Job: run the garages (Odette's Respray, Coral Strand Customs). Drive in and press E for the garage menu.
// Resprays and plate swaps shake an unseen wanted level; engine, armour and tyre upgrades stay with Dez and
// tune every car driven.
import { game } from '../core/gameState.js';
import { wasKeyPressed } from '../core/input.js';
import { setPrompt, playSound } from '../core/cues.js';
import { formatMoney } from '../core/mathUtils.js';
import { PLACES } from '../world/cityLayout.js';
import { repaintVehicle } from '../vehicles/vehiclePhysics.js';
import { createMarker } from '../missions/missionMarkers.js';
import { spendMoney } from './economy.js';
import { clearWantedLevel } from './wantedLevel.js';
import { showNotification } from '../ui/notifications.js';
import { showGaragePanel, hideGaragePanel } from '../ui/garagePanel.js';
import { setHudVisible } from '../ui/hud.js';
import { showGarageBay, hideGarageBay } from '../render/garageBay.js';
import { TRAFFIC_TYPES } from '../vehicles/vehicleCatalog.js';

export const GARAGES = [{ key: 'respray', place: PLACES.respray }, { key: 'customs', place: PLACES.customs }];
export const PAINTS = [
  { name: 'Flamingo Pink', color: 0xff3d8b }, { name: 'Lagoon Teal', color: 0x12d6c9 }, { name: 'Sunfare Gold', color: 0xffc21a },
  { name: 'Midnight Plum', color: 0x4a1f7a }, { name: 'Pearl White', color: 0xf5f5f5 },
];
export const UPGRADES = [
  { key: 'engine', digit: '7', name: 'Engine tune', prices: [1500, 3200, 6000] },
  { key: 'armor', digit: '8', name: 'Armour plating', prices: [1200, 2800, 5000] },
  { key: 'tyres', digit: '9', name: 'Grip tyres', prices: [900, 2000, 4200] },
];
export const MAX_LEVEL = 3, PAINT_PRICE = 250, REPAIR_PRICE = 150;

let open = null;   // the garage whose menu is showing
let tab = 'workshop';

export function initGarage() {
  for (const g of GARAGES) createMarker({ x: g.place.x, z: g.place.z, color: 0x4fe3d6, icon: 'S', label: g.place.name, radius: 3, persistent: true });
}

export function isGarageOpen() { return !!open; }
export function countUpgrades() { return UPGRADES.reduce((n, u) => n + game.garage[u.key], 0); }
export function platePrice() { return 400 + game.wanted.stars * 200; }
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const near = (place, r) => (game.player.pos.x - place.x) ** 2 + (game.player.pos.z - place.z) ** 2 < r * r;

/** Applies Dez's upgrade levels to a car's handling numbers and armour (idempotent per level set). */
export function applyTune(v) {
  const g = game.garage, sig = `${g.engine}${g.armor}${g.tyres}`;
  if (v.tuneSig === sig || (sig === '000' && !v.baseSpec)) return;
  const base = v.baseSpec || (v.baseSpec = v.spec);
  v.spec = { ...base, maxSpeed: base.maxSpeed * (1 + 0.07 * g.engine), accel: base.accel * (1 + 0.09 * g.engine), grip: base.grip * (1 + 0.08 * g.tyres), turn: base.turn * (1 + 0.04 * g.tyres) };
  v.armorFactor = 1 - 0.18 * g.armor; v.tuneSig = sig;
}

function policeWatching() {
  if (!(game.wanted.stars > 0 && game.wanted.seen)) return false;
  showNotification('<b>ODETTE</b>Not with half the precinct watching, sugar. Lose them first.', 'warn', 4);
  return true;
}

export function buyPaint(index) {
  const v = game.player.vehicle, paint = PAINTS[index];
  if (!v || !paint || v.color === paint.color || policeWatching() || !spendMoney(PAINT_PRICE, 'respray')) return false;
  repaintVehicle(v, paint.color); game.garage.resprays++;
  clearWantedLevel('respray'); playSound('spray', v.pos);
  return true;
}

export function buyRepair() {
  const v = game.player.vehicle;
  if (!v || (v.health >= 100 && !v.burning) || !spendMoney(REPAIR_PRICE, 'repair')) return false;
  v.health = 100; v.burning = 0;
  return true;
}

export function buyUpgrade(key) {
  const u = UPGRADES.find((x) => x.key === key), level = game.garage[key];
  if (!u || level >= MAX_LEVEL || !spendMoney(u.prices[level], 'tuning')) return false;
  game.garage[key]++;
  if (game.player.vehicle) applyTune(game.player.vehicle);
  return true;
}

export function buyPlates() {
  if (policeWatching() || !spendMoney(platePrice(), 'plates')) return false;
  game.garage.plateSwaps++; clearWantedLevel('respray');
  return true;
}

/** Every car model the player has driven goes into the showroom collection. */
export function getCollection() { return TRAFFIC_TYPES.map((t) => ({ ...t, owned: !!game.garage.collection[t.key] })); }

/** Everything the garage panel draws: tabs, the car's stat bars, paint swatches, priced workshop rows with
 *  OWNED states, and the showroom collection. */
export function getGarageMenu() {
  const v = game.player.vehicle, g = game.garage, base = v.baseSpec || v.spec;
  const bar = (label, value, gain) => ({ label, value, gain });
  const swatches = PAINTS.map((p, i) => ({ key: String(i + 1), label: p.name, swatch: hex(p.color), on: v.color === p.color }));
  const rows = [{ key: '6', label: 'Full repair', note: `${Math.round(v.health)}% body`, price: formatMoney(REPAIR_PRICE), state: v.health >= 100 ? 'owned' : 'buy', stateText: 'NO DAMAGE' }];
  for (const u of UPGRADES) {
    const lvl = g[u.key], maxed = lvl >= MAX_LEVEL;
    rows.push({ key: u.digit, label: `${u.name} &middot; stage ${Math.min(lvl + 1, MAX_LEVEL)}`, level: lvl, max: MAX_LEVEL, price: maxed ? '' : formatMoney(u.prices[lvl]), state: maxed ? 'owned' : 'buy', stateText: 'OWNED' });
  }
  rows.push({ key: '0', label: 'Plate swap', note: game.wanted.stars ? 'shakes the cops' : `${g.plateSwaps} swapped`, price: formatMoney(platePrice()), state: 'buy' });
  const collection = getCollection();
  return {
    tab, title: open.place.name, car: `${v.spec.name} &middot; ${v.spec.klass}`, cash: formatMoney(game.money), paintPrice: formatMoney(PAINT_PRICE),
    stats: [bar('Top speed', base.maxSpeed / 75, base.maxSpeed * 0.07 * g.engine / 75), bar('Acceleration', base.accel / 42, base.accel * 0.09 * g.engine / 42),
      bar('Armour', 0.4, 0.18 * g.armor), bar('Grip', base.grip / 10, base.grip * 0.08 * g.tyres / 10)],
    swatches, rows, collection, owned: collection.filter((c) => c.owned).length,
  };
}

function refreshGarage() { showGarageBay(game.player.vehicle); showGaragePanel(getGarageMenu()); }

export function openGarage(garage) {
  open = garage; tab = 'workshop'; game.garage.visited[garage.key] = true; game.flags.controlsLocked = true;
  const v = game.player.vehicle; v.vx = v.vz = 0;
  setHudVisible(false); refreshGarage();
}

export function closeGarage() { open = null; game.flags.controlsLocked = false; hideGaragePanel(); hideGarageBay(); setHudVisible(true); }

/** WORKSHOP (paint, repair, upgrades) or SHOWROOM (collected car models); Q flips between them. */
export function setGarageTab(name) { tab = name; if (open) refreshGarage(); }

export function updateGarage() {
  const player = game.player, v = player.vehicle;
  if (v) { applyTune(v); if (!v.isPolice) game.garage.collection[v.type] = true; }
  if (open) {
    if (!v || !near(open.place, 8) || wasKeyPressed('KeyE') || wasKeyPressed('Escape')) return closeGarage();
    if (wasKeyPressed('KeyQ')) setGarageTab(tab === 'workshop' ? 'showroom' : 'workshop');
    let bought = null;
    PAINTS.forEach((p, i) => { if (wasKeyPressed('Digit' + (i + 1))) bought = buyPaint(i); });
    if (wasKeyPressed('Digit6')) bought = buyRepair();
    for (const u of UPGRADES) if (wasKeyPressed('Digit' + u.digit)) bought = buyUpgrade(u.key);
    if (wasKeyPressed('Digit0')) bought = buyPlates();
    if (bought !== null) { playSound(bought ? 'cash' : 'empty', player.pos); refreshGarage(); }
    return;
  }
  let prompt = null;
  if (v && Math.abs(v.speed) < 6) {
    for (const g of GARAGES) {
      if (!near(g.place, 4.5)) continue;
      prompt = `<kbd>E</kbd>${g.place.name} &middot; respray, tune-up, plate swap`;
      if (wasKeyPressed('KeyE')) openGarage(g);
    }
  }
  setPrompt('garage', prompt);
}
