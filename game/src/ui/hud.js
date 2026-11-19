// Heads-up display: money, wanted stars, weapon + ammo, health/armour, clock, objective, prompts,
// vehicle speedometer, district names, mission title cards and the big WASTED / PASSED banners.
import { game } from '../core/gameState.js';
import { onEvent } from '../core/eventBus.js';
import { formatMoney, formatClock, formatTimer, clamp } from '../core/mathUtils.js';
import { getDistrictAt, nearestStreetName } from '../world/cityLayout.js';
import { WEAPONS, WEAPON_ICONS } from '../combat/weaponCatalog.js';
import { getRespectRank } from '../systems/economy.js';
import { UNITS_TO_MPH } from '../vehicles/vehicleCatalog.js';
import { drawMinimap } from './minimap.js';
import { cameraRig } from '../render/followCamera.js';

const el = {};
const prompts = {};
let shownMoney = 0, moneyFlash = 0, lastDistrict = '', districtTimer = 0, titleTimer = 0, crosshairHit = 0, lastWeapon = '', radioTimer = 0, hurtFlash = 0, lastStars = -1;
const STAR_SVG = '<svg viewBox="0 0 24 24"><path class="star" d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9 5.6 21.4 7 14.3 1.7 9.3l7.2-.9z"/></svg>';

export function initHud() {
  for (const id of ['hud', 'mission-name', 'mission-timer', 'radio-banner', 'radio-name', 'radio-track', 'weapon-icon', 'weapon-name', 'weapon-ammo', 'clock', 'money', 'wanted-stars', 'respect-rank', 'respect-bar',
    'minimap-frame', 'minimap', 'health-fill', 'armor-fill', 'district-name', 'vehicle-panel', 'vehicle-name', 'speed-value', 'vehicle-health-fill', 'objective', 'prompt', 'crosshair', 'progress-wrap', 'progress-label', 'progress-fill',
    'title-card', 'title-card-kicker', 'title-card-name', 'title-card-sub', 'big-banner', 'big-banner-text', 'big-banner-sub', 'damage-vignette', 'fade']) el[id] = document.getElementById(id);
  el['wanted-stars'].innerHTML = STAR_SVG.repeat(5);
  shownMoney = game.money;
  onEvent('moneyChanged', (e) => { moneyFlash = e.amount < 0 ? -1.2 : 1.2; });
  onEvent('playerHurt', (e) => { hurtFlash = Math.min(1, hurtFlash + 0.35 + e.amount / 60); });
  onEvent('radioChanged', (e) => setRadioBanner(e.name, e.track, 5));
}

export function setHudVisible(on) { el.hud.classList.toggle('hidden', !on); }
export function setObjective(html) { if (el.objective.innerHTML !== html) el.objective.innerHTML = html || ''; }
export function setMissionName(text) { el['mission-name'].textContent = text || ''; }
export function setMissionTimer(seconds) {
  const t = el['mission-timer'];
  if (seconds === null || seconds === undefined) { t.classList.add('hidden'); return; }
  t.classList.remove('hidden'); t.textContent = formatTimer(seconds); t.classList.toggle('low', seconds < 15);
}
export function setProgress(label, fraction) {
  if (label === null || label === undefined) { el['progress-wrap'].classList.add('hidden'); return; }
  el['progress-wrap'].classList.remove('hidden'); el['progress-label'].textContent = label;
  el['progress-fill'].style.width = (clamp(fraction, 0, 1) * 100).toFixed(1) + '%';
}
/** Prompts are keyed by channel so vehicles, shops and activities do not overwrite each other. */
export function setPrompt(channel, html) { prompts[channel] = html; }
export function showTitleCard(kicker, name, sub, seconds = 6) {
  el['title-card-kicker'].textContent = kicker; el['title-card-name'].textContent = name; el['title-card-sub'].textContent = sub || '';
  el['title-card'].classList.remove('hidden'); titleTimer = seconds;
}
export function hideTitleCard() { el['title-card'].classList.add('hidden'); titleTimer = 0; }
export function showBigBanner(text, sub = '', kind = '') {
  el['big-banner-text'].textContent = text; el['big-banner-sub'].textContent = sub;
  el['big-banner'].className = kind; el['big-banner'].classList.remove('hidden');
}
export function hideBigBanner() { el['big-banner'].classList.add('hidden'); }
export function setScreenFade(on) { el.fade.classList.toggle('on', on); }
export function flashCrosshair() { crosshairHit = 0.15; }
export function setRadioBanner(name, track, seconds = 5) {
  if (!name) { el['radio-banner'].classList.add('hidden'); radioTimer = 0; return; }
  el['radio-name'].textContent = name; el['radio-track'].textContent = track || '';
  el['radio-banner'].classList.remove('hidden'); radioTimer = seconds;
}

function updateWeaponPanel() {
  const key = game.currentWeapon, w = WEAPONS[key];
  if (key !== lastWeapon) { lastWeapon = key; el['weapon-icon'].innerHTML = WEAPON_ICONS[key]; el['weapon-name'].textContent = w.name.toUpperCase(); }
  const a = game.ammo[key];
  el['weapon-ammo'].innerHTML = a ? `${a.clip}<small>/ ${a.reserve}</small>` : '';
}

export function updateHud(dt) {
  const player = game.player;
  if (!player) return;
  // money counts up / down toward the real value
  const diff = game.money - shownMoney;
  shownMoney = Math.abs(diff) < 1 ? game.money : shownMoney + diff * Math.min(1, dt * 6);
  el.money.textContent = formatMoney(shownMoney);
  moneyFlash -= Math.sign(moneyFlash) * Math.min(Math.abs(moneyFlash), dt);
  el.money.classList.toggle('loss', moneyFlash < 0);
  el.clock.textContent = formatClock(game.timeOfDay);
  // wanted stars
  const w = game.wanted;
  if (w.stars !== lastStars) {
    lastStars = w.stars;
    el['wanted-stars'].querySelectorAll('.star').forEach((s, i) => s.classList.toggle('on', i < w.stars));
  }
  el['wanted-stars'].classList.toggle('evading', w.evading && w.stars > 0);
  const frame = el['minimap-frame'];
  frame.classList.toggle('flash-police', w.stars > 0 && !w.evading);
  frame.classList.toggle('alt', Math.floor(game.time * 3) % 2 === 0);
  const rank = getRespectRank();
  el['respect-rank'].textContent = rank.name.toUpperCase();
  el['respect-bar'].firstElementChild.style.width = (rank.progress * 100).toFixed(0) + '%';
  updateWeaponPanel();
  // vitals
  el['health-fill'].style.width = clamp(player.health / player.maxHealth, 0, 1) * 100 + '%';
  el['health-fill'].parentElement.classList.toggle('low', player.health < 30);
  el['armor-fill'].style.width = clamp(player.armor / 100, 0, 1) * 100 + '%';
  hurtFlash = Math.max(0, hurtFlash - dt * 1.4);
  el['damage-vignette'].style.opacity = Math.max(hurtFlash, player.health < 25 && player.health > 0 ? 0.35 + Math.sin(game.time * 6) * 0.15 : 0).toFixed(2);
  // vehicle panel
  const v = player.vehicle;
  el['vehicle-panel'].classList.toggle('hidden', !v);
  if (v) {
    el['vehicle-name'].textContent = v.spec.name;
    el['speed-value'].textContent = Math.round(Math.abs(v.speed) * UNITS_TO_MPH);
    el['vehicle-health-fill'].style.width = clamp(v.health / 100, 0, 1) * 100 + '%';
  }
  // district name
  const district = getDistrictAt(player.pos.x, player.pos.z);
  if (district.name !== lastDistrict) { lastDistrict = district.name; districtTimer = 6; }
  districtTimer -= dt;
  el['district-name'].innerHTML = `${district.name.toUpperCase()}<small>${nearestStreetName(player.pos.x, player.pos.z)}</small>`;
  el['district-name'].style.opacity = game.mode === 'shot' ? 1 : clamp(districtTimer, 0, 1) * 0.6 + 0.4;
  // prompt (first non-empty channel wins)
  let prompt = null;
  for (const k of ['mission', 'shop', 'side', 'vehicle']) if (prompts[k]) { prompt = prompts[k]; break; }
  el.prompt.classList.toggle('hidden', !prompt);
  if (prompt && el.prompt.innerHTML !== prompt) el.prompt.innerHTML = prompt;
  // crosshair
  const armed = game.currentWeapon !== 'fists';
  el.crosshair.classList.toggle('hidden', !(armed && (cameraRig.aiming || player.fireAnim > 0 || player.vehicle)) || player.health <= 0);
  crosshairHit = Math.max(0, crosshairHit - dt);
  el.crosshair.classList.toggle('hit', crosshairHit > 0);
  if (titleTimer > 0) { titleTimer -= dt; if (titleTimer <= 0) el['title-card'].classList.add('hidden'); }
  if (radioTimer > 0 && game.mode !== 'shot') { radioTimer -= dt; if (radioTimer <= 0) el['radio-banner'].classList.add('hidden'); }
  drawMinimap(el.minimap);
}
