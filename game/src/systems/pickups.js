// World pickups: cash, health, armour, ammo, weapons and the hidden golden flamingo collectibles.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { GeometryBatch } from '../world/geometryBatcher.js';
import { getGlowTexture } from '../world/roadTextures.js';
import { groundHeightAt } from '../world/cityLayout.js';
import { addMoney } from './economy.js';
import { giveWeapon, WEAPONS } from '../combat/weaponCatalog.js';
import { showNotification } from '../ui/notifications.js';
import { playSound } from '../audio/soundEffects.js';
import { spawnCashBurst } from '../combat/visualEffects.js';
import { emitEvent } from '../core/eventBus.js';

const pickups = [];
const geometryCache = {};
const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2, emissive: 0x222222 });
const GLOW = { cash: 0x40ff80, health: 0xff5060, armor: 0x50a0ff, ammo: 0xffc040, weapon: 0xffffff, flamingo: 0xff60b0, briefcase: 0xffd040 };

export const FLAMINGO_SPOTS = [[505, -320], [628, 150], [860, -214], [-486, -386], [-486, 386], [96, 44], [390, 386], [-240, 300], [500, 330], [-384, -96], [192, -372], [300, 100]];
const WORLD_PICKUPS = [
  ['health', 64, -296], ['health', 414, 28], ['armor', -126, 68], ['health', -300, 150], ['ammo', 150, 108], ['health', 200, 250],
  ['armor', 800, -100], ['health', 560, 141], ['cash', 470, -200], ['cash', -470, 100], ['ammo', -200, 380], ['armor', 90, 390],
];

function geometryFor(type) {
  if (geometryCache[type]) return geometryCache[type];
  const b = new GeometryBatch();
  if (type === 'cash') { for (let k = 0; k < 3; k++) b.addBox(0, 0.06 + k * 0.1, 0, 0.5, 0.09, 0.26, { color: k % 2 ? [0.2, 0.7, 0.3] : [0.3, 0.85, 0.4], rotY: k * 0.3, bottom: true }); }
  else if (type === 'health') { b.addBox(0, 0.25, 0, 0.5, 0.5, 0.5, { color: [1, 1, 1], bottom: true }); b.addBox(0, 0.25, 0, 0.52, 0.14, 0.36, { color: [0.9, 0.1, 0.15] }); b.addBox(0, 0.25, 0, 0.52, 0.36, 0.14, { color: [0.9, 0.1, 0.15] }); }
  else if (type === 'armor') { b.addBox(0, 0.32, 0, 0.5, 0.56, 0.22, { color: [0.2, 0.4, 0.85], topScale: 1.15, bottom: true }); b.addBox(0, 0.3, 0.12, 0.3, 0.3, 0.04, { color: [0.75, 0.85, 1] }); }
  else if (type === 'ammo') { b.addBox(0, 0.16, 0, 0.5, 0.3, 0.3, { color: [0.25, 0.3, 0.2], bottom: true }); b.addBox(0, 0.33, 0, 0.52, 0.06, 0.32, { color: [0.9, 0.7, 0.2] }); }
  else if (type === 'briefcase') { b.addBox(0, 0.22, 0, 0.62, 0.42, 0.16, { color: [0.2, 0.14, 0.1], bottom: true }); b.addBox(0, 0.47, 0, 0.2, 0.06, 0.05, { color: [0.9, 0.75, 0.3] }); }
  else if (type === 'flamingo') {
    const pink = [1, 0.75, 0.2];
    b.addBox(0, 0.45, 0, 0.05, 0.9, 0.05, { color: pink }); b.addBox(0, 1.0, 0, 0.3, 0.3, 0.55, { color: pink, topScale: 0.7 });
    b.addBox(0, 1.35, 0.3, 0.08, 0.6, 0.08, { color: pink }); b.addBox(0, 1.66, 0.38, 0.12, 0.12, 0.26, { color: pink }); b.addBox(0, 1.62, 0.54, 0.06, 0.08, 0.12, { color: [0.15, 0.1, 0.05] });
  } else { b.addBox(0, 0.25, 0, 0.12, 0.2, 0.7, { color: [0.1, 0.1, 0.12], bottom: true }); b.addBox(0, 0.12, -0.2, 0.1, 0.26, 0.14, { color: [0.3, 0.2, 0.12] }); }
  return (geometryCache[type] = b.build());
}

/** options: amount (cash), weapon (key), respawn (seconds), temporary (seconds before vanishing), onCollect. */
export function spawnPickup(type, x, z, options = {}) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometryFor(type), material); mesh.castShadow = true;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: GLOW[type] || 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
  glow.scale.set(2.4, 2.4, 1); glow.position.y = 0.4;
  group.add(mesh, glow);
  group.position.set(x, groundHeightAt(x, z) + 0.45, z);
  game.scene.add(group);
  const pickup = { type, x, z, group, mesh, options, active: true, timer: 0, age: 0 };
  pickups.push(pickup);
  return pickup;
}

export function removePickup(p) {
  const i = pickups.indexOf(p);
  if (i >= 0) pickups.splice(i, 1);
  game.scene.remove(p.group); p.active = false; p.removed = true;
}

function collect(p) {
  const player = game.player, o = p.options;
  if (p.type === 'cash') { addMoney(o.amount || 50, 'pickup'); spawnCashBurst(p.x, 0.6, p.z); playSound('cash', player.pos); }
  else if (p.type === 'health') { if (player.health >= player.maxHealth) return false; player.health = player.maxHealth; playSound('pickup', player.pos); showNotification('Patched up.', '', 2); }
  else if (p.type === 'armor') { if (player.armor >= 100) return false; player.armor = 100; playSound('pickup', player.pos); showNotification('Body armour on.', '', 2); }
  else if (p.type === 'ammo') {
    const key = game.currentWeapon !== 'fists' ? game.currentWeapon : game.weapons.pistol ? 'pistol' : null;
    if (!key) { giveWeapon('pistol', 24); showNotification('<b>CORAL 9</b>Picked up a pistol. Press 2 to draw it.', 'gold', 4); }
    else giveWeapon(key, WEAPONS[key].ammoPack / 2);
    playSound('reload', player.pos);
  } else if (p.type === 'weapon') { giveWeapon(o.weapon, WEAPONS[o.weapon].clip * 2); showNotification(`<b>${WEAPONS[o.weapon].name.toUpperCase()}</b>Weapon acquired.`, 'gold', 3); playSound('reload', player.pos); }
  else if (p.type === 'flamingo') { game.stats.flamingos++; addMoney(250, 'flamingo'); showNotification(`<b>GOLDEN FLAMINGO ${game.stats.flamingos}/${FLAMINGO_SPOTS.length}</b>A collector will pay $250 for that.`, 'gold', 4); playSound('cash', player.pos); }
  else playSound('pickup', player.pos);
  if (o.onCollect) o.onCollect(p);
  emitEvent('pickupCollected', p);
  return true;
}

export function initWorldPickups(collectedFlamingos = 0) {
  for (const p of pickups.slice()) removePickup(p);
  for (const [type, x, z] of WORLD_PICKUPS) spawnPickup(type, x, z, { respawn: 150, amount: 120 });
  FLAMINGO_SPOTS.forEach(([x, z], i) => { if (i >= collectedFlamingos) spawnPickup('flamingo', x, z, {}); });
}

export function updatePickups(dt) {
  const player = game.player;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.age += dt;
    if (!p.active) { p.timer -= dt; if (p.timer <= 0) { p.active = true; p.group.visible = true; } continue; }
    p.mesh.rotation.y += dt * 2.2; p.mesh.position.y = Math.sin(p.age * 3) * 0.08;
    if (p.options.temporary && p.age > p.options.temporary) { removePickup(p); continue; }
    const reach = player.vehicle ? 2.6 : 1.3;
    if (player.health > 0 && (p.x - player.pos.x) ** 2 + (p.z - player.pos.z) ** 2 < reach * reach && (!player.vehicle || p.type === 'cash' || p.type === 'briefcase')) {
      if (!collect(p)) continue;
      if (p.options.respawn) { p.active = false; p.timer = p.options.respawn; p.group.visible = false; } else removePickup(p);
    }
  }
}

export function getPickups() { return pickups; }
