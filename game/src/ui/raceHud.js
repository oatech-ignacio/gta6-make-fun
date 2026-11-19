// Race HUD (top centre while racing): race name, position, lap, checkpoint and the running time.
import { getRaceStatus } from '../races/streetRaces.js';

let el = null, lastHtml = '';

export function initRaceHud() { el = document.getElementById('race-hud'); }

export function updateRaceHud() {
  const s = getRaceStatus();
  el.classList.toggle('hidden', !s);
  if (!s) { lastHtml = ''; return; }
  const time = `${Math.floor(s.time / 60)}:${(s.time % 60).toFixed(1).padStart(4, '0')}`;
  const sub = s.phase === 'countdown' ? `STARTS IN ${s.countdown}` : `STREET RACE &middot; PAR ${s.par}s${s.best ? ` &middot; BEST ${s.best}s` : ''}`;
  const html = `<h4>${s.name.toUpperCase()}<small>${sub}</small></h4><div class="rh">
    <div class="pos"><small>POSITION</small><b>${s.ordinal}<i>/${s.racers}</i></b></div>
    <div><small>LAP</small><b>${s.lap}<i>/${s.laps}</i></b></div>
    <div><small>CHECKPOINT</small><b>${s.checkpoint}<i>/${s.checkpoints}</i></b></div>
    <div><small>TIME</small><b>${time}</b></div></div>`;
  if (html !== lastHtml) { lastHtml = html; el.innerHTML = html; }
}
