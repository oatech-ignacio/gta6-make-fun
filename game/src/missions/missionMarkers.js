// 3D objective markers (glowing ring + light beam) that double as minimap / pause-map blips.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { groundHeightAt } from '../world/cityLayout.js';

const markers = [];
let beamAlpha = null;

function getBeamAlphaTexture() {
  if (beamAlpha) return beamAlpha;
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const ctx = c.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#000'); g.addColorStop(1, '#fff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 64);
  beamAlpha = new THREE.CanvasTexture(c);
  return beamAlpha;
}

/**
 * options: x, z, color (hex), icon (one letter for the map), label, radius, persistent (survives mission cleanup),
 * target (entity with .pos to follow), beam (false for map-only blips), kind ('mission' | 'shop' | 'target' | 'enemy').
 */
export function createMarker(options) {
  const m = { x: options.x || 0, z: options.z || 0, color: options.color || 0xffd166, icon: options.icon || '', label: options.label || '', radius: options.radius || 2.2,
    persistent: !!options.persistent, target: options.target || null, kind: options.kind || 'mission', group: null, age: 0 };
  if (options.beam !== false) {
    const group = new THREE.Group(), r = m.radius;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 6, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(m.color).multiplyScalar(2.2) }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.12;
    const beamGeo = new THREE.CylinderGeometry(r, r, 9, 28, 1, true); beamGeo.translate(0, 4.5, 0);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.4, alphaMap: getBeamAlphaTexture(), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.08;
    group.add(ring, beam, disc);
    group.userData = { ring, beam };
    game.scene.add(group);
    m.group = group;
  }
  markers.push(m);
  syncMarker(m, 0);
  return m;
}

function syncMarker(m, dt) {
  m.age += dt;
  if (m.target && m.target.pos) { m.x = m.target.pos.x; m.z = m.target.pos.z; }
  if (!m.group) return;
  const lift = m.target ? (m.target.spec ? m.target.spec.height + 1.2 : 2.3) : 0;
  m.group.position.set(m.x, groundHeightAt(m.x, m.z) + lift, m.z);
  const pulse = 1 + Math.sin(m.age * 4) * 0.06;
  m.group.userData.ring.scale.set(pulse, pulse, 1);
  m.group.userData.beam.visible = !m.target;
  if (m.target) m.group.userData.ring.scale.multiplyScalar(0.45);
}

export function removeMarker(m) {
  if (!m) return;
  const i = markers.indexOf(m);
  if (i >= 0) markers.splice(i, 1);
  if (m.group) game.scene.remove(m.group);
}

export function clearMissionMarkers() { for (const m of markers.slice()) if (!m.persistent) removeMarker(m); }
export function updateMarkers(dt) {
  for (const m of markers.slice()) {
    // blips that follow something disappear with it
    if (m.target && (m.target.removed || m.target.state === 'dead' || m.target.wrecked) && m.kind === 'enemy') { removeMarker(m); continue; }
    syncMarker(m, dt);
  }
}
export function getMarkers() { return markers; }
export function isPlayerInMarker(m, extra = 0) {
  const p = game.player.pos; return (p.x - m.x) ** 2 + (p.z - m.z) ** 2 < (m.radius + extra) ** 2;
}
