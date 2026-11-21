// Job: the Arco del Sol, Palmera's signature landmark. A coral-and-gold gateway arch straddling the south end
// of Corsair Boulevard with a sunburst crown, so it sits on the vanishing point of the beachfront avenue.
import * as THREE from 'three';
import { GeometryBatch, buildBatchMesh } from './geometryBatcher.js';
import { addStaticBox } from './collisionGrid.js';
import { GRID_X } from './cityLayout.js';

export const SUN_ARCH = { name: 'Arco del Sol', x: GRID_X[9], z: 290 };
const CORAL = [1, 0.42, 0.42], GOLD = [1, 0.78, 0.25], CREAM = [1, 0.95, 0.85];

export function buildSunArch() {
  const b = new GeometryBatch(), glow = new GeometryBatch();
  const { x, z } = SUN_ARCH, span = 13.5, legH = 30;
  for (const s of [-1, 1]) {
    const px = x + s * span;
    b.addBox(px, 1, z, 3.6, 2, 3.6, { color: CREAM });
    b.addBox(px, legH / 2, z, 2.6, legH, 2.6, { color: CORAL, topScale: 0.85 });
    for (let k = 1; k <= 4; k++) b.addBox(px, k * 6.5, z, 2.9, 0.5, 2.9, { color: GOLD });
    addStaticBox(px - 1.8, z - 1.8, px + 1.8, z + 1.8, legH, 'building');
  }
  // half-ring over the road, built from short segments
  const segs = 18;
  for (let k = 0; k < segs; k++) {
    const a0 = Math.PI * k / segs, a1 = Math.PI * (k + 1) / segs, am = (a0 + a1) / 2;
    const len = span * (a1 - a0) + 0.4;
    const g = new THREE.BoxGeometry(len, 2.6, 2.6);
    const m = new THREE.Matrix4().makeRotationZ(am + Math.PI / 2).setPosition(x + Math.cos(am) * span, legH + Math.sin(am) * span, z);
    b.addGeometry(g, m, k % 3 === 1 ? GOLD : CORAL);
  }
  // sunburst crown: a gold disc with rays, plus bright rim lamps
  const top = legH + span + 7;
  const disc = new THREE.CylinderGeometry(6, 6, 1, 28); disc.rotateX(Math.PI / 2);
  b.addGeometry(disc, new THREE.Matrix4().makeTranslation(x, top, z), GOLD);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, r = new THREE.BoxGeometry(1.1, 4.5, 0.6);
    b.addGeometry(r, new THREE.Matrix4().makeRotationZ(a - Math.PI / 2).setPosition(x + Math.cos(a) * 8.6, top + Math.sin(a) * 8.6, z), k % 2 ? CORAL : GOLD);
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI;
    glow.addBox(x + Math.cos(a) * (span - 1.5), legH + Math.sin(a) * (span - 1.5), z - 1.4, 0.5, 0.5, 0.3, { color: [1, 0.93, 0.7] });
    glow.addBox(x + Math.cos(a) * (span - 1.5), legH + Math.sin(a) * (span - 1.5), z + 1.4, 0.5, 0.5, 0.3, { color: [1, 0.93, 0.7] });
  }
  const group = new THREE.Group(); group.name = 'sunArch';
  group.add(buildBatchMesh(b, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35, emissive: 0x2a1408 }), { castShadow: true }));
  group.add(buildBatchMesh(glow, new THREE.MeshBasicMaterial({ vertexColors: true })));
  return group;
}
