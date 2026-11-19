// WASTED and BUSTED: death and arrest sequences, hospital / police station respawns and their penalties.
import { game } from '../core/gameState.js';
import { onEvent, emitEvent } from '../core/eventBus.js';
import { PLACES } from '../world/cityLayout.js';
import { teleportPlayer } from '../characters/playerController.js';
import { clearWantedLevel } from './wantedLevel.js';
import { showBigBanner, hideBigBanner, setScreenFade } from '../ui/hud.js';
import { showNotification } from '../ui/notifications.js';
import { formatMoney } from '../core/mathUtils.js';
import { playSound } from '../audio/soundEffects.js';
import { setTimeOfDay } from '../world/dayNightCycle.js';
import { populateTrafficAround } from '../vehicles/trafficAI.js';
import { WEAPON_ORDER } from '../combat/weaponCatalog.js';

const sequence = { active: false, kind: null, timer: 0, faded: false };

export function initPlayerRespawn() {
  onEvent('playerDied', () => beginSequence('wasted'));
  onEvent('playerBusted', () => beginSequence('busted'));
}

function beginSequence(kind) {
  if (sequence.active) return;
  Object.assign(sequence, { active: true, kind, timer: 0, faded: false });
  game.flags.controlsLocked = true;
  game.timeScale = 0.35;
  if (kind === 'wasted') { showBigBanner('WASTED', 'Santa Brisa Medical is on the way', 'bad'); game.stats.wastedCount++; }
  else { showBigBanner('BUSTED', 'Bay Patrol has some questions', 'cop'); game.stats.bustedCount++; game.player.handsUp = true; }
  playSound(kind === 'wasted' ? 'wasted' : 'busted', game.player.pos);
  emitEvent('playerDown', { kind });
}

function respawn() {
  const player = game.player, kind = sequence.kind;
  const place = kind === 'wasted' ? PLACES.hospital : PLACES.policeStation;
  teleportPlayer(place.x, place.z, place.heading);
  player.health = player.maxHealth; player.armor = 0; player.state = 'idle'; player.handsUp = false; player.panic = 0;
  player.mesh.visible = true;
  clearWantedLevel('respawn');
  const fee = Math.min(kind === 'wasted' ? 600 : 900, Math.floor(game.money * (kind === 'wasted' ? 0.1 : 0.15)));
  game.money -= fee;
  if (kind === 'busted') { for (const k of WEAPON_ORDER) if (k !== 'fists') { delete game.weapons[k]; delete game.ammo[k]; } game.currentWeapon = 'fists'; }
  setTimeOfDay((game.timeOfDay + 4) % 24);
  populateTrafficAround(place.x, place.z, 8, 30, 160);
  showNotification(kind === 'wasted'
    ? `<b>SANTA BRISA MEDICAL</b>Stitched up and billed ${formatMoney(fee)}.`
    : `<b>BAY PATROL HQ</b>Released on bail: ${formatMoney(fee)}. Weapons confiscated.`, 'warn', 6);
}

export function updatePlayerRespawn(realDt) {
  if (!sequence.active) return;
  sequence.timer += realDt;
  if (sequence.timer > 2.6 && !sequence.faded) { sequence.faded = true; setScreenFade(true); }
  if (sequence.timer > 3.5 && sequence.faded && sequence.kind) {
    respawn(); sequence.kind = null;
    hideBigBanner(); game.timeScale = 1;
  }
  if (sequence.timer > 4.2) { setScreenFade(false); sequence.active = false; game.flags.controlsLocked = false; }
}

export function isRespawning() { return sequence.active; }
