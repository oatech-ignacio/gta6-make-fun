// The save slot list shared by the start screen and the pause menu: autosave plus three manual slots, each
// showing slot number, act and mission, completion %, district, cash and the time it was saved, or EMPTY.
import { listSaves, describeSave, AUTOSAVE_SLOT } from '../systems/saveGame.js';
import { formatMoney } from '../core/mathUtils.js';

function slotHtml({ slot, data }, verb) {
  const info = describeSave(data), label = slot === AUTOSAVE_SLOT ? 'AUTO' : `SLOT ${slot}`;
  if (!info) return `<button class="slot empty" data-slot="${slot}" ${verb === 'LOAD' || slot === AUTOSAVE_SLOT ? 'disabled' : ''}><i>${label}</i><span><b>EMPTY</b><small>${slot === AUTOSAVE_SLOT ? 'Written after every mission' : 'No save in this slot'}</small></span></button>`;
  return `<button class="slot" data-slot="${slot}" ${verb === 'SAVE' && slot === AUTOSAVE_SLOT ? 'disabled' : ''}><i>${label}</i>
    <span><b>${info.act} &middot; ${info.missionNumber}/${info.missionTotal} ${info.mission}</b><small>${info.district} &middot; ${info.when}</small></span>
    <em>${info.percent}%</em><strong>${formatMoney(info.money)}</strong></button>`;
}

/** Renders the list into `host`; `onPick(slot, data)` fires when a usable slot is clicked. verb: 'LOAD' | 'SAVE'. */
export function renderSaveSlots(host, verb, onPick, includeAuto = true) {
  const saves = listSaves().filter((s) => includeAuto || s.slot !== AUTOSAVE_SLOT);
  host.innerHTML = saves.map((s) => slotHtml(s, verb)).join('');
  host.querySelectorAll('.slot').forEach((btn, i) => { btn.onclick = () => onPick(saves[i].slot, saves[i].data); });
}
