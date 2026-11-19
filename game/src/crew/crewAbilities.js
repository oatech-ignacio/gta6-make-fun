// Crew system: recruiting the three allies at their street corners (E), their ability hotkeys (Z / X / C),
// cooldowns and what each ability does to the wanted level, the car or the police scanner.
import { game } from '../core/gameState.js';
import { wasKeyPressed } from '../core/input.js';
import { setPrompt, playSound } from '../core/cues.js';
import { formatMoney } from '../core/mathUtils.js';
import { CREW } from './crewRoster.js';
import { createMarker, removeMarker } from '../missions/missionMarkers.js';
import { spawnCharacter, removeCharacter, randomCivilianLook } from '../characters/characterEntity.js';
import { spendMoney } from '../systems/economy.js';
import { setWantedLevel } from '../systems/wantedLevel.js';
import { showNotification } from '../ui/notifications.js';

export const JAM_SECONDS = 12;
const cooldowns = {};   // crew key -> seconds until the ability is ready again
const spots = {};       // crew key -> { marker, npc } while they are still waiting to be recruited

// Each effect returns the line the ally says, or null when there is nothing for them to do.
const EFFECTS = {
  sable() {
    if (game.wanted.stars === 0) return null;
    setWantedLevel(game.wanted.stars - 1);
    return 'Decoy is rolling the other way. One star off your back.';
  },
  gus() {
    const p = game.player, v = p.vehicle;
    if (v) {
      if (v.wrecked || (v.health >= 100 && !v.burning)) return null;
      v.health = 100; v.burning = 0;
      return `${v.spec.name} patched up on the move.`;
    }
    if (p.armor >= 100) return null;
    p.armor = Math.min(100, p.armor + 50);
    return 'Vest at your feet. Armour +50.';
  },
  wren() {
    if (game.wanted.stars === 0) return null;
    game.flags.jamUntil = game.time + JAM_SECONDS; game.wanted.seen = false;
    return `Scanner jammed for ${JAM_SECONDS} seconds. Break away now.`;
  },
};

export function countHired() { return CREW.filter((m) => game.allies[m.key]).length; }

export function hireCrew(key, free = false) {
  const m = CREW.find((c) => c.key === key);
  if (!m || game.allies[key] || (!free && !spendMoney(m.price, 'crew'))) return false;
  game.allies[key] = true; cooldowns[key] = 0;
  return true;
}

export function useCrewAbility(key) {
  const m = CREW.find((c) => c.key === key);
  if (!m || !game.allies[key] || cooldowns[key] > 0) return false;
  const line = EFFECTS[key]();
  if (!line) { playSound('empty', game.player.pos); return false; }
  cooldowns[key] = m.cooldown; game.stats.crewCalls++;
  showNotification(`<b>${m.name.toUpperCase()} &middot; ${m.ability.toUpperCase()}</b>${line}`, 'gold', 4);
  playSound('pickup', game.player.pos);
  return true;
}

/** Roster with live state for the HUD panel and the pause menu. */
export function getCrewStatus() {
  return CREW.map((m) => ({ ...m, hired: !!game.allies[m.key], ready: !(cooldowns[m.key] > 0), remaining: Math.ceil(cooldowns[m.key] || 0),
    active: m.key === 'wren' && game.flags.jamUntil > game.time }));
}

/** Unrecruited allies wait at their corner under a teal beam; hired ones leave the street. */
function syncSpot(m) {
  const s = spots[m.key] || (spots[m.key] = { marker: null, npc: null }), waiting = !game.allies[m.key];
  if (waiting && !s.marker) {
    s.marker = createMarker({ x: m.spot.x, z: m.spot.z, color: 0x2be0d0, icon: 'C', label: m.name, radius: 1.6, persistent: true, kind: 'shop', onMap: true });
    s.npc = spawnCharacter({ x: m.spot.x, z: m.spot.z, kind: 'npc', look: randomCivilianLook(game.rng), name: m.name });
    s.npc.invulnerable = true; s.npc.missionTag = 'crew';
  } else if (!waiting && s.marker) {
    removeMarker(s.marker);
    if (!s.npc.removed) removeCharacter(s.npc);
    s.marker = s.npc = null;
  }
}

export function updateCrew(dt) {
  const p = game.player;
  let prompt = null;
  for (const m of CREW) {
    syncSpot(m);
    if (cooldowns[m.key] > 0) cooldowns[m.key] = Math.max(0, cooldowns[m.key] - dt);
    if (game.allies[m.key]) {
      if (game.mode === 'play' && !game.flags.controlsLocked && p.health > 0 && wasKeyPressed(m.code)) useCrewAbility(m.key);
    } else if (!p.vehicle && (p.pos.x - m.spot.x) ** 2 + (p.pos.z - m.spot.z) ** 2 < 9) {
      prompt = `<kbd>E</kbd>Recruit ${m.name} &middot; ${m.role} &middot; ${formatMoney(m.price)}`;
      if (wasKeyPressed('KeyE')) {
        if (hireCrew(m.key)) { showNotification(`<b>${m.name.toUpperCase()} JOINED THE CREW</b>${m.ability} on <b style="display:inline">${m.label}</b>. ${m.blurb}`, 'gold', 7); playSound('cash', p.pos); }
        else playSound('empty', p.pos);
      }
    }
  }
  setPrompt('crew', prompt);
}
