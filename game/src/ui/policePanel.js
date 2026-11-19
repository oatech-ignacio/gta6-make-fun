// Police response panel: while wanted, lists the nearest responding units (callsign, distance, status chip)
// and drives the IN SIGHT / SEARCHING chip beside the wanted stars from the real search timer.
import { game } from '../core/gameState.js';
import { getHeadlineUnits } from '../police/policeUnits.js';
import { getSightStatus } from '../systems/wantedLevel.js';
import { formatTimer } from '../core/mathUtils.js';

const GLYPH = { cruiser: '▰', van: '▮', officer: '●', air: '✚', roadblock: '▬' };
let panel = null, chip = null, refresh = 0, lastHtml = '';

export function initPolicePanel() {
  panel = document.getElementById('police-panel');
  chip = document.getElementById('sight-chip');
}

function unitRow(u) {
  return `<div class="pu"><i class="k-${u.kind}">${GLYPH[u.kind]}</i><b>${u.callsign}</b><span>${Math.round(u.distance)} m</span><em class="st-${u.status.replace(/ /g, '')}">${u.status}</em></div>`;
}

export function updatePolicePanel(dt) {
  const sight = getSightStatus();
  chip.classList.toggle('hidden', !sight);
  panel.classList.toggle('hidden', !sight);
  if (!sight) { lastHtml = ''; return; }
  const text = sight.inSight ? 'IN SIGHT' : `SEARCHING ${formatTimer(sight.searchRemaining)}`;
  if (chip.textContent !== text) chip.textContent = text;
  chip.classList.toggle('searching', !sight.inSight);
  refresh -= dt;
  if (refresh > 0 && lastHtml) return;
  refresh = 0.25;
  const { units, total } = getHeadlineUnits(4);
  const html = `<h4>POLICE RESPONSE<small>${total} UNIT${total === 1 ? '' : 'S'} &middot; ${game.wanted.stars}★</small></h4>`
    + (units.length ? units.map(unitRow).join('') : '<div class="pu none">Units dispatched&hellip;</div>');
  if (html !== lastHtml) { lastHtml = html; panel.innerHTML = html; }
}
