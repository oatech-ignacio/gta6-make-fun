// Health and armour: applying damage, deaths, witnesses and crimes, cash drops, explosion splash damage.
import { game } from '../core/gameState.js';
import { emitEvent, onEvent } from '../core/eventBus.js';
import { reportCrime } from '../systems/wantedLevel.js';
import { knockDownCharacter } from '../characters/characterEntity.js';
import { damageVehicle } from '../vehicles/vehiclePhysics.js';
import { spawnPickup } from '../systems/pickups.js';
import { playSound } from '../audio/soundEffects.js';

export function initDamageSystem() {
  onEvent('vehicleExploded', (v) => {
    if (v.driver) killCharacter(v.driver, v.lastAttacker || null, 'explosion');
    for (const c of v.passengers.slice()) if (!c.invulnerable) killCharacter(c, v.lastAttacker || null, 'explosion');
    applyExplosionDamage(v.pos.x, v.pos.z, 9, v.lastAttacker || null, v);
  });
}

export function damageCharacter(c, amount, attacker = null, type = 'bullet') {
  if (c.state === 'dead' || c.invulnerable) return;
  if (c === game.player && game.flags.cinematic) return;
  let dmg = amount;
  if (c.armor > 0 && type !== 'fall') { const absorbed = Math.min(c.armor, dmg * 0.8); c.armor -= absorbed; dmg -= absorbed; }
  c.health -= dmg;
  c.lastDamageTime = game.time; c.lastAttacker = attacker;
  if (c === game.player) emitEvent('playerHurt', { amount: dmg, type });
  else if (attacker === game.player) {
    if (c.kind === 'ped' || c.kind === 'npc') { c.panic = 12; c.fleeFrom = { x: attacker.pos.x, z: attacker.pos.z }; }
    if (c.kind === 'cop') { c.hostile = true; reportCrime('shootCop', c.pos); }
    if (c.kind === 'gang' || c.kind === 'guard') c.hostile = true;
    if (type === 'bullet' && c.health > 0 && Math.random() < 0.3) knockDownCharacter(c, 1.2);
  }
  if (c.health <= 0) killCharacter(c, attacker, type);
}

export function killCharacter(c, attacker = null, type = 'bullet') {
  if (c.state === 'dead') return;
  c.health = 0; c.state = 'dead'; c.deadTime = 0; c.aiming = false; c.panic = 0;
  c.vel.x = c.vel.z = 0;
  if (c.vehicle) { const v = c.vehicle; if (v.driver === c) v.driver = null; c.vehicle = null; c.mesh.visible = true; }
  if (c === game.player) { emitEvent('playerDied', { type }); return; }
  playSound('yell', c.pos);
  if (attacker === game.player) {
    game.stats.kills++;
    if (c.kind === 'cop') { game.stats.copsDown++; reportCrime('killCop', c.pos); }
    else if (c.kind === 'ped' || c.kind === 'npc') reportCrime('murder', c.pos);
    else reportCrime('gangKill', c.pos);
  }
  if (c.kind !== 'cop' || Math.random() < 0.5) {
    const cash = c.kind === 'gang' || c.kind === 'guard' ? 80 + Math.floor(Math.random() * 160) : 12 + Math.floor(Math.random() * 70);
    spawnPickup(c.kind === 'cop' ? 'ammo' : 'cash', c.pos.x + (Math.random() - 0.5), c.pos.z + (Math.random() - 0.5), { amount: cash, temporary: 40 });
  }
  if ((c.kind === 'gang' || c.kind === 'guard') && Math.random() < 0.5) spawnPickup('ammo', c.pos.x + 0.8, c.pos.z, { temporary: 40 });
  emitEvent('characterKilled', { character: c, attacker, type });
}

export function applyExplosionDamage(x, z, radius, attacker = null, sourceVehicle = null) {
  for (const c of game.characters.slice()) {
    if (c.vehicle) continue;
    const d = Math.hypot(c.pos.x - x, c.pos.z - z);
    if (d > radius) continue;
    const k = 1 - d / radius;
    knockDownCharacter(c, 2.5, { x: (c.pos.x - x) / (d || 1) * 9 * k, z: (c.pos.z - z) / (d || 1) * 9 * k });
    damageCharacter(c, 150 * k, attacker, 'explosion');
  }
  for (const v of game.vehicles) {
    if (v === sourceVehicle || v.wrecked) continue;
    const d = Math.hypot(v.pos.x - x, v.pos.z - z);
    if (d > radius) continue;
    const k = 1 - d / radius;
    v.vx += (v.pos.x - x) / (d || 1) * 12 * k; v.vz += (v.pos.z - z) / (d || 1) * 12 * k;
    damageVehicle(v, 90 * k, attacker);
    if (v.driver && v.driver !== game.player) damageCharacter(v.driver, 80 * k, attacker, 'explosion');
    if (v.driver === game.player && sourceVehicle !== v) damageCharacter(game.player, 40 * k, attacker, 'explosion');
  }
  emitEvent('gunfire', { x, z, shooter: attacker });
}
