// Builds vehicle models from code: extruded side profiles for the body and glasshouse, wheels, lights,
// police light bars, taxi signs. Models face +z; one merged body mesh per car keeps draw calls low.
import * as THREE from 'three';
import { GeometryBatch } from '../world/geometryBatcher.js';
import { getGlowTexture } from '../world/roadTextures.js';

const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.45 });
const lampMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
const wheelGeometry = (() => {
  const b = new GeometryBatch();
  const tyre = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14); tyre.rotateZ(Math.PI / 2);
  b.addGeometry(tyre, null, [0.06, 0.06, 0.07]);
  const hub = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 8); hub.rotateZ(Math.PI / 2);
  b.addGeometry(hub, null, [0.7, 0.72, 0.76]);
  return b.build();
})();
const wheelMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 });
const glowMaterialCache = new Map();
function glowMaterial(color) {
  if (!glowMaterialCache.has(color)) glowMaterialCache.set(color, new THREE.SpriteMaterial({ map: getGlowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  return glowMaterialCache.get(color);
}

// Side profiles as [z, y] points, front (+z) to rear, scaled by length/height. Body then glasshouse.
const PROFILES = {
  sports: { body: [[0.5, 0.2], [0.5, 0.42], [0.42, 0.52], [0.12, 0.62], [-0.3, 0.66], [-0.47, 0.7], [-0.5, 0.6], [-0.5, 0.2]], cabin: [[0.14, 0.6], [-0.04, 0.98], [-0.24, 1.0], [-0.4, 0.66]], cabinWidth: 0.78, spoiler: true },
  muscle: { body: [[0.5, 0.22], [0.5, 0.56], [0.2, 0.62], [-0.28, 0.62], [-0.5, 0.6], [-0.5, 0.22]], cabin: [[0.12, 0.6], [0.0, 0.98], [-0.26, 1.0], [-0.42, 0.62]], cabinWidth: 0.8, scoop: true },
  sedan: { body: [[0.5, 0.2], [0.5, 0.5], [0.44, 0.56], [0.2, 0.6], [-0.36, 0.6], [-0.5, 0.56], [-0.5, 0.2]], cabin: [[0.2, 0.58], [0.06, 0.98], [-0.24, 1.0], [-0.38, 0.6]], cabinWidth: 0.84 },
  compact: { body: [[0.5, 0.2], [0.5, 0.5], [0.4, 0.58], [0.24, 0.6], [-0.48, 0.62], [-0.5, 0.56], [-0.5, 0.2]], cabin: [[0.26, 0.58], [0.12, 0.98], [-0.42, 1.0], [-0.48, 0.6]], cabinWidth: 0.86 },
  pickup: { body: [[0.5, 0.22], [0.5, 0.56], [0.44, 0.6], [0.2, 0.62], [-0.5, 0.62], [-0.5, 0.22]], cabin: [[0.2, 0.6], [0.1, 0.98], [-0.1, 1.0], [-0.12, 0.6]], cabinWidth: 0.88, bed: true },
  van: { body: [[0.5, 0.16], [0.5, 0.46], [0.44, 0.6], [0.36, 0.98], [-0.5, 1.0], [-0.5, 0.16]], cabin: [[0.455, 0.6], [0.375, 0.93], [0.14, 0.93], [0.14, 0.6]], cabinWidth: 1.01, flatGlass: true },
  swat: { body: [[0.5, 0.2], [0.5, 0.52], [0.42, 0.6], [0.3, 0.98], [-0.5, 1.0], [-0.5, 0.2]], cabin: [[0.435, 0.62], [0.33, 0.92], [0.12, 0.92], [0.12, 0.62]], cabinWidth: 1.01, flatGlass: true },
};
PROFILES.taxi = PROFILES.sedan; PROFILES.police = PROFILES.sedan;

function extrudeProfile(points, length, height, width, bevel) {
  const shape = new THREE.Shape();
  points.forEach((p, i) => { const x = p[0] * length, y = p[1] * height; if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 1 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);     // shape x (car length) -> +z, extrusion depth -> x (car width)
  return g;
}

function rgb(hex, mul = 1) { const c = new THREE.Color(hex); return [c.r * mul, c.g * mul, c.b * mul]; }

function buildCarBody(spec, paintHex) {
  const prof = PROFILES[spec.key] || PROFILES.sedan, L = spec.length, H = spec.height, W = spec.width;
  const batch = new GeometryBatch(), lamps = new GeometryBatch();
  const paint = rgb(paintHex), dark = [0.05, 0.05, 0.06], glass = [0.05, 0.09, 0.13];
  batch.addGeometry(extrudeProfile(prof.body, L, H, W, 0.07), null, paint);
  const cabinGeo = extrudeProfile(prof.cabin, L, H, W * prof.cabinWidth, prof.flatGlass ? 0 : 0.05);
  batch.addGeometry(cabinGeo, null, glass);
  if (!prof.flatGlass) {       // painted roof panel + pillars over the glass
    const top = prof.cabin[1], back = prof.cabin[2];
    const roofLen = (top[0] - back[0]) * L;
    batch.addBox(0, H * 1.0, (top[0] + back[0]) / 2 * L, W * prof.cabinWidth * 0.98, 0.07, roofLen + 0.1, { color: paint });
    for (const sx of [-1, 1]) batch.addBox(sx * W * prof.cabinWidth * 0.49, H * 0.8, (top[0] + back[0]) / 2 * L, 0.07, H * 0.42, 0.12, { color: paint });
  }
  // bumpers, sills, grille
  batch.addBox(0, H * 0.24, L * 0.5 - 0.02, W * 0.98, 0.22, 0.16, { color: dark });
  batch.addBox(0, H * 0.24, -L * 0.5 + 0.02, W * 0.98, 0.22, 0.16, { color: dark });
  batch.addBox(0, 0.3, 0, W * 0.9, 0.2, L * 0.86, { color: dark });
  for (const sz of [0.31, -0.3]) for (const sx of [-1, 1]) batch.addBox(sx * (W * 0.5 - 0.02), 0.42, sz * L, 0.1, 0.5, 0.95, { color: [0.03, 0.03, 0.04] });   // wheel arches
  if (prof.spoiler) { batch.addBox(0, H * 0.82, -L * 0.46, W * 0.9, 0.05, 0.36, { color: dark }); for (const sx of [-1, 1]) batch.addBox(sx * W * 0.34, H * 0.74, -L * 0.45, 0.06, 0.16, 0.2, { color: dark }); }
  if (prof.scoop) batch.addBox(0, H * 0.66, L * 0.26, 0.6, 0.1, 0.9, { color: dark });
  if (prof.bed) {
    batch.addBox(0, H * 0.52, -L * 0.3, W * 0.84, 0.3, L * 0.34, { color: [0.08, 0.08, 0.09] });
    batch.addBox(0, H * 0.78, -L * 0.12, W * 0.8, 0.5, 0.08, { color: paint });
  }
  if (spec.key === 'sports') { batch.addBox(0, H * 0.5, 0, 0.36, 0.02, L * 0.98, { color: [1, 1, 1] }); }       // racing stripe
  if (spec.key === 'taxi') {
    batch.addBox(0, H * 1.08, L * -0.06, 0.7, 0.2, 0.3, { color: [0.1, 0.1, 0.1] });
    for (const sx of [-1, 1]) for (let k = -3; k <= 3; k++) batch.addBox(sx * (W * 0.5 + 0.005), H * 0.5, k * 0.36, 0.02, 0.14, 0.18, { color: k % 2 ? [0.05, 0.05, 0.05] : [1, 1, 1] });
    lamps.addBox(0, H * 1.08, L * -0.06, 0.62, 0.14, 0.32, { color: [1.2, 1.0, 0.3] });
  }
  if (spec.key === 'police' || spec.key === 'swat') {
    const navy = [0.05, 0.1, 0.28];
    for (const sx of [-1, 1]) {
      batch.addBox(sx * (W * 0.5 + 0.005), H * (spec.key === 'swat' ? 0.4 : 0.48), 0, 0.03, 0.26, L * 0.5, { color: navy });
      batch.addBox(sx * (W * 0.5 + 0.008), H * (spec.key === 'swat' ? 0.52 : 0.58), 0, 0.03, 0.06, L * 0.5, { color: [0.1, 0.75, 0.8] });
    }
    batch.addBox(0, H * 0.63, L * 0.3, W * 0.9, 0.03, L * 0.3, { color: navy });
    batch.addBox(0, H * 0.3, L * 0.5 + 0.08, W * 0.8, 0.34, 0.12, { color: dark });      // push bar
    batch.addBox(0, H * 1.05, -0.2, W * 0.62, 0.08, 0.34, { color: [0.12, 0.12, 0.14] });   // light bar base
  }
  // head and tail lamps (unlit basic material so they read at dusk)
  const hy = spec.key === 'van' || spec.key === 'swat' ? H * 0.38 : H * 0.5;
  for (const sx of [-1, 1]) {
    lamps.addBox(sx * W * 0.34, hy, L * 0.5 + 0.045, 0.36, 0.13, 0.06, { color: [1.9, 1.8, 1.4] });
    lamps.addBox(sx * W * 0.35, hy + 0.04, -L * 0.5 - 0.045, 0.42, 0.12, 0.06, { color: [1.5, 0.08, 0.06] });
  }
  return { body: batch.build(), lamps: lamps.build() };
}

function buildBike(spec, paintHex) {
  const batch = new GeometryBatch(), lamps = new GeometryBatch(), paint = rgb(paintHex), dark = [0.07, 0.07, 0.08];
  batch.addBox(0, 0.62, 0.1, 0.34, 0.3, 1.0, { color: paint });
  batch.addBox(0, 0.84, 0.3, 0.3, 0.2, 0.5, { color: paint, topScale: 0.7 });
  batch.addBox(0, 0.8, -0.35, 0.3, 0.1, 0.62, { color: dark });
  batch.addBox(0, 0.45, 0.0, 0.3, 0.3, 0.6, { color: [0.3, 0.3, 0.33] });
  batch.addBox(0, 0.7, 0.86, 0.08, 0.7, 0.08, { color: [0.6, 0.6, 0.65], rotY: 0 });
  batch.addBox(0, 1.06, 0.72, 0.68, 0.05, 0.05, { color: dark });
  lamps.addBox(0, 0.92, 0.98, 0.2, 0.14, 0.05, { color: [1.9, 1.8, 1.4] });
  lamps.addBox(0, 0.8, -0.68, 0.16, 0.08, 0.05, { color: [1.5, 0.08, 0.06] });
  return { body: batch.build(), lamps: lamps.build() };
}

/**
 * Create the scene graph for one vehicle. Returns a Group with userData:
 * { tilt (inner group for body roll), wheels[], lightBar {red, blue, glowRed, glowBlue}, headGlow, brakeGlow }.
 */
export function createVehicleMesh(spec, paintHex) {
  const root = new THREE.Group(), tilt = new THREE.Group();
  root.add(tilt);
  const isBike = spec.key === 'bike';
  const geo = isBike ? buildBike(spec, paintHex) : buildCarBody(spec, paintHex);
  const body = new THREE.Mesh(geo.body, bodyMaterial); body.castShadow = true; body.receiveShadow = true;
  const lamps = new THREE.Mesh(geo.lamps, lampMaterial);
  tilt.add(body, lamps);
  const wheels = [];
  const wheelPos = isBike ? [[0, 0.85], [0, -0.75]] : [[-1, 0.31], [1, 0.31], [-1, -0.3], [1, -0.3]];
  for (const wp of wheelPos) {
    const w = new THREE.Mesh(wheelGeometry, wheelMaterial);
    const big = spec.key === 'pickup' || spec.key === 'swat' || spec.key === 'van' ? 1.18 : 1;
    w.scale.set(isBike ? 0.6 : 1, big, big);
    w.position.set(isBike ? 0 : wp[0] * (spec.width * 0.5 - 0.14), 0.36 * big, isBike ? wp[1] : wp[1] * spec.length);
    w.castShadow = true; root.add(w); wheels.push(w);
  }
  const headGlow = new THREE.Sprite(glowMaterial(0xfff0c0)); headGlow.scale.set(2.6, 1.3, 1); headGlow.position.set(0, spec.height * 0.48, spec.length * 0.5 + 0.2);
  const brakeGlow = new THREE.Sprite(glowMaterial(0xff2010)); brakeGlow.scale.set(2.4, 0.9, 1); brakeGlow.position.set(0, spec.height * 0.52, -spec.length * 0.5 - 0.15);
  tilt.add(headGlow, brakeGlow);
  root.userData = { tilt, wheels, headGlow, brakeGlow, lightBar: null };
  if (spec.key === 'police' || spec.key === 'swat') {
    const y = spec.height * 1.05 + 0.12, half = spec.width * 0.17;
    const red = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.3, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0xff1522 }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.3, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0x1a44ff }));
    red.position.set(-half, y, -0.2); blue.position.set(half, y, -0.2);
    const glowRed = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xff2030, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    const glowBlue = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0x3060ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glowRed.position.set(-half, y + 0.1, -0.2); glowBlue.position.set(half, y + 0.1, -0.2);
    tilt.add(red, blue, glowRed, glowBlue);
    root.userData.lightBar = { red, blue, glowRed, glowBlue };
  }
  return root;
}

/** Flash the red/blue bar; `on` false leaves it dark. */
export function animateLightBar(mesh, time, on) {
  const bar = mesh.userData.lightBar;
  if (!bar) return;
  const phase = Math.floor(time * 7) % 2 === 0, strobe = Math.floor(time * 28) % 2 === 0;
  const r = on && phase ? (strobe ? 1 : 0.55) : 0, b = on && !phase ? (strobe ? 1 : 0.55) : 0;
  bar.red.material.color.setRGB(0.25 + r * 5, 0.02 + r * 0.3, 0.03 + r * 0.3);
  bar.blue.material.color.setRGB(0.03 + b * 0.5, 0.06 + b * 0.9, 0.3 + b * 6);
  bar.glowRed.visible = r > 0; bar.glowBlue.visible = b > 0;
  const s = 5.5; bar.glowRed.scale.set(s * (0.7 + r * 0.5), s * (0.7 + r * 0.5), 1); bar.glowBlue.scale.set(s * (0.7 + b * 0.5), s * (0.7 + b * 0.5), 1);
}
