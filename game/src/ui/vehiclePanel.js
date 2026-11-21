// Bottom-right panel. Driving: vehicle name and class, a condition bar from the real damage state, a large
// speed readout and the radio station with its current track. On foot: the district and street you are in.
import { game } from '../core/gameState.js';
import { clamp } from '../core/mathUtils.js';
import { UNITS_TO_MPH } from '../vehicles/vehicleCatalog.js';
import { getDistrictAt, nearestStreetName } from '../world/cityLayout.js';
import { getCurrentStation, getCurrentTrackName } from '../audio/radioStations.js';

const el = {};

export function initVehiclePanel() {
  for (const id of ['vehicle-panel', 'vehicle-name', 'vehicle-class', 'speed-value', 'vehicle-health-fill', 'vehicle-health-text', 'vehicle-radio', 'foot-panel', 'district-name', 'district-street']) el[id] = document.getElementById(id);
}

function setText(node, text) { if (node.textContent !== text) node.textContent = text; }

/** Condition as the player reads it: percentage plus a word that follows the damage model's smoke and fire stages. */
export function describeCondition(v) {
  const pct = Math.round(clamp(v.health / 100, 0, 1) * 100);
  return { pct, word: v.wrecked ? 'WRECKED' : pct > 75 ? 'CLEAN' : pct > 45 ? 'DENTED' : pct > 20 ? 'SMOKING' : 'ON FIRE' };
}

export function updateVehiclePanel() {
  const player = game.player, v = player.vehicle;
  el['vehicle-panel'].classList.toggle('hidden', !v);
  // the location label above the minimap is always shown, on foot and behind the wheel
  const at = v ? v.pos : player.pos, district = getDistrictAt(at.x, at.z);
  setText(el['district-name'], district.name.toUpperCase());
  const street = nearestStreetName(at.x, at.z);
  setText(el['district-street'], street.toUpperCase() === district.name.toUpperCase() ? `${street} · ${district.tagline}` : street);
  el['foot-panel'].style.setProperty('--district', district.color);
  if (!v) return;
  const cond = describeCondition(v), station = getCurrentStation();
  setText(el['vehicle-name'], v.spec.name.toUpperCase());
  setText(el['vehicle-class'], v.isPolice ? 'POLICE' : v.spec.klass.toUpperCase());
  setText(el['speed-value'], String(Math.round(Math.abs(v.speed) * UNITS_TO_MPH)));
  el['vehicle-health-fill'].style.width = cond.pct + '%';
  el['vehicle-health-fill'].parentElement.classList.toggle('low', cond.pct <= 45);
  setText(el['vehicle-health-text'], `${cond.word} ${cond.pct}%`);
  setText(el['vehicle-radio'], station.off ? '♫ RADIO OFF · R to tune' : `♫ ${station.name} · ${getCurrentTrackName()}`);
}
