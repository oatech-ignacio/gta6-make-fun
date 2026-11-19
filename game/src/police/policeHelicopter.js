// "Bay Patrol Air One": a helicopter that arrives at 4 stars, circles the player with a searchlight,
// keeps the wanted level alive while it has eyes on them and fires bursts at 5 stars.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { damp } from '../core/mathUtils.js';
import { onEvent } from '../core/eventBus.js';
import { GeometryBatch } from '../world/geometryBatcher.js';
import { getGlowTexture } from '../world/glowTexture.js';
import { npcShootAt } from '../combat/weaponFire.js';
import { playSound } from '../core/cues.js';

const heli = { active: false, leaving: false, seesPlayer: false, mesh: null, rotor: null, tail: null, beam: null, spot: null, angle: 0, pos: new THREE.Vector3(), gunner: null, chatter: 0 };

function buildHelicopterMesh() {
  const b = new GeometryBatch(), white = [0.93, 0.94, 0.97], navy = [0.06, 0.12, 0.32];
  b.addBox(0, 0, 0.4, 1.9, 1.7, 4.2, { color: white, topScale: 0.8, bottom: true });
  b.addBox(0, 0.15, 2.6, 1.5, 1.2, 1.4, { color: [0.06, 0.1, 0.14], topScale: 0.6, bottom: true });
  b.addBox(0, 0.3, -3.6, 0.4, 0.5, 4.4, { color: navy, bottom: true });
  b.addBox(0, 1.0, -5.5, 0.12, 1.6, 0.9, { color: navy });
  b.addBox(0, -0.25, 0.4, 1.94, 0.4, 4.24, { color: navy });
  for (const sx of [-1, 1]) { b.addBox(sx * 1.0, -1.25, 0.4, 0.12, 0.12, 3.6, { color: [0.2, 0.2, 0.22] }); b.addBox(sx * 0.9, -0.9, 1.2, 0.08, 0.7, 0.08, { color: [0.2, 0.2, 0.22] }); b.addBox(sx * 0.9, -0.9, -0.4, 0.08, 0.7, 0.08, { color: [0.2, 0.2, 0.22] }); }
  b.addBox(0, 1.05, 0.4, 0.3, 0.4, 0.3, { color: [0.2, 0.2, 0.22] });
  const group = new THREE.Group();
  const body = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 }));
  body.castShadow = true;
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.34), new THREE.MeshBasicMaterial({ color: 0x15161a, transparent: true, opacity: 0.75 }));
  rotor.position.set(0, 1.3, 0.4);
  const rotor2 = rotor.clone(); rotor2.rotation.y = Math.PI / 2; rotor.add(rotor2); rotor2.position.set(0, 0, 0);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.9, 0.2), rotor.material); tail.position.set(0.25, 1.0, -5.5);
  const beamGeo = new THREE.ConeGeometry(7, 40, 20, 1, true); beamGeo.translate(0, -20, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.set(0, -1, 1.6);
  const strobe = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xff2030, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  strobe.scale.set(5, 5, 1); strobe.position.set(0, -1.2, -1);
  const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xdde8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  lamp.scale.set(6, 6, 1); lamp.position.set(0, -1, 1.7);
  group.add(body, rotor, tail, beam, strobe, lamp);
  const spotGeo = new THREE.PlaneGeometry(1, 1); spotGeo.rotateX(-Math.PI / 2);
  const spot = new THREE.Mesh(spotGeo, new THREE.MeshBasicMaterial({ map: getGlowTexture(), color: 0xbfd6ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  spot.scale.set(22, 1, 22); spot.renderOrder = 4;
  Object.assign(heli, { mesh: group, rotor, tail, beam, spot, strobe });
}

export function requestHelicopter(instantAt = null) {
  if (heli.active && !heli.leaving) return heli;
  if (!heli.mesh) buildHelicopterMesh();
  const p = game.player.pos;
  if (!heli.active) {
    if (instantAt) heli.pos.set(instantAt.x, instantAt.y, instantAt.z); else heli.pos.set(p.x + 260, 70, p.z - 220);
    game.scene.add(heli.mesh, heli.spot);
  }
  heli.active = true; heli.leaving = false;
  heli.gunner = { pos: heli.pos, heading: 0, vehicle: null, weapon: 'smg', fireCooldown: 2, kind: 'cop' };
  game.helicopter = heli;
  return heli;
}

export function dismissHelicopter() { if (heli.active) heli.leaving = true; }

/** Dispatch calls the helicopter in at four stars and sends it home when the wanted level clears. */
export function initPoliceHelicopter() {
  onEvent('helicopterRequested', () => requestHelicopter());
  onEvent('helicopterDismissed', dismissHelicopter);
}

export function updatePoliceHelicopter(dt) {
  if (!heli.active) return;
  const player = game.player, p = player.vehicle ? player.vehicle.pos : player.pos;
  heli.angle += dt * 0.42;
  let tx, ty, tz;
  if (heli.leaving) { tx = heli.pos.x + 60; ty = 110; tz = heli.pos.z - 60; }
  else { tx = p.x + Math.cos(heli.angle) * 24; ty = 34; tz = p.z + Math.sin(heli.angle) * 24; }
  const ox = heli.pos.x, oz = heli.pos.z;
  heli.pos.x = damp(heli.pos.x, tx, heli.leaving ? 0.5 : 1.3, dt); heli.pos.y = damp(heli.pos.y, ty, 1.0, dt); heli.pos.z = damp(heli.pos.z, tz, heli.leaving ? 0.5 : 1.3, dt);
  const m = heli.mesh;
  m.position.copy(heli.pos);
  const vx = (heli.pos.x - ox) / Math.max(dt, 1e-3), vz = (heli.pos.z - oz) / Math.max(dt, 1e-3);
  if (Math.abs(vx) + Math.abs(vz) > 0.5) m.rotation.y = damp(m.rotation.y, Math.atan2(p.x - heli.pos.x, p.z - heli.pos.z), 2.5, dt);
  m.rotation.x = 0.12;
  heli.rotor.rotation.y += dt * 38; heli.tail.rotation.x += dt * 50;
  heli.strobe.visible = Math.floor(game.time * 3) % 2 === 0;
  // aim the searchlight cone at the suspect
  const dist = heli.pos.distanceTo(p);
  heli.beam.lookAt(p.x, p.y, p.z); heli.beam.rotateX(-Math.PI / 2);
  heli.beam.scale.set(1, dist / 40, 1);
  heli.spot.position.set(p.x, 0.12, p.z);
  heli.spot.visible = heli.beam.visible = !heli.leaving;
  heli.seesPlayer = !heli.leaving && dist < 75;
  heli.chatter -= dt;
  if (heli.chatter <= 0) { heli.chatter = 0.16; playSound('rotor', heli.pos, 0.5); }
  if (!heli.leaving && game.wanted.stars >= 5 && dist < 60) {
    heli.gunner.heading = Math.atan2(p.x - heli.pos.x, p.z - heli.pos.z);
    heli.gunner.fireCooldown = Math.max(0, heli.gunner.fireCooldown - dt);
    npcShootAt(heli.gunner, player, 0.18);
  }
  if (heli.leaving && (heli.pos.y > 100 || dist > 320)) { game.scene.remove(heli.mesh, heli.spot); heli.active = false; heli.leaving = false; }
}

export function getHelicopter() { return heli; }
