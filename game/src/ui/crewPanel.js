// Crew panel (right side of the HUD): one row per recruited ally with the ability hotkey, name, role and a
// READY / cooldown chip driven by the real cooldown timers.
import { getCrewStatus } from '../crew/crewAbilities.js';

let panel = null, lastHtml = '';

export function initCrewPanel() { panel = document.getElementById('crew-panel'); }

function rowHtml(c) {
  const state = c.active ? 'active' : c.ready ? 'ready' : 'cool';
  const chip = c.active ? 'ACTIVE' : c.ready ? 'READY' : `${c.remaining}s`;
  return `<div class="cw ${state}"><kbd>${c.label}</kbd><div><b>${c.ability.toUpperCase()}</b><small>${c.name} &middot; ${c.role}</small></div><em>${chip}</em></div>`;
}

export function updateCrewPanel() {
  const crew = getCrewStatus().filter((c) => c.hired);
  panel.classList.toggle('hidden', crew.length === 0);
  const html = crew.map(rowHtml).join('');
  if (html !== lastHtml) { lastHtml = html; panel.innerHTML = html; }
}
