// Instanced palm trees and broadleaf trees built from code (bent trunks, drooping frond strips, leaf blobs).
import * as THREE from 'three';
import { GeometryBatch } from './geometryBatcher.js';

function createPalmTrunkGeometry(height) {
  const g = new THREE.CylinderGeometry(0.2, 0.36, height, 7, 6);
  g.translate(0, height / 2, 0);
  const p = g.attributes.position, colors = [];
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / height;
    p.setX(i, p.getX(i) + 1.1 * t * t);            // gentle lean
    const ring = (Math.floor(t * 18) % 2) ? 0.82 : 1;
    colors.push(0.4 * ring, 0.35 * ring, 0.3 * ring);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function createPalmFrondGeometry(height) {
  const pos = [], col = [], nor = [];
  const leaves = 14, segs = 6;
  for (let l = 0; l < leaves; l++) {
    const yaw = (l / leaves) * Math.PI * 2 + (l % 2) * 0.2, len = 4.0 + (l % 3) * 0.5, lift = 0.7 + (l % 4) * 0.34;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const point = (t, side) => {
      const r = len * t, y = lift * 1.9 * t - 3.4 * t * t + (side === 0 ? 0.16 : 0);
      const wdt = side * 0.4 * Math.sin(Math.PI * (0.12 + 0.88 * t)) ;
      return [1.1 + cs * r - sn * wdt, height + y, sn * r + cs * wdt];
    };
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      for (const side of [-1, 1]) {
        const a = point(t0, 0), b = point(t1, 0), c = point(t1, side), d = point(t0, side);
        const quad = side > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
        for (const v of quad) {
          pos.push(v[0], v[1], v[2]); nor.push(0, 1, 0);
          const shade = 0.75 + 0.25 * (v === a || v === b ? 1 : 0.55) - t0 * 0.15;
          col.push(0.2 * shade, 0.52 * shade, 0.16 * shade);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

function fillInstances(meshes, items, rng, scaleMin, scaleMax) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  items.forEach((it, i) => {
    const scale = (it.s || 1) * rng.range(scaleMin, scaleMax);
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    p.set(it.x, it.y || 0.1, it.z); s.set(scale, scale * rng.range(0.9, 1.15), scale);
    m.compose(p, q, s);
    for (const mesh of meshes) mesh.setMatrixAt(i, m);
  });
  for (const mesh of meshes) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
}

export function buildPalmTrees(positions, rng) {
  const height = 9.5;
  const trunkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const frondMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
  const trunks = new THREE.InstancedMesh(createPalmTrunkGeometry(height), trunkMat, positions.length);
  const fronds = new THREE.InstancedMesh(createPalmFrondGeometry(height), frondMat, positions.length);
  trunks.castShadow = fronds.castShadow = true;
  fillInstances([trunks, fronds], positions, rng, 0.85, 1.3);
  const group = new THREE.Group(); group.add(trunks, fronds); group.name = 'palmTrees';
  return group;
}

export function buildBroadleafTrees(positions, rng) {
  const batch = new GeometryBatch();
  const trunk = new THREE.CylinderGeometry(0.25, 0.4, 3.2, 6); trunk.translate(0, 1.6, 0);
  batch.addGeometry(trunk, null, [0.36, 0.26, 0.18]);
  const blobs = [[0, 4.6, 0, 2.6], [1.5, 4.0, 0.6, 1.9], [-1.3, 4.2, -0.8, 2.0], [0.3, 5.9, -0.4, 1.8]];
  blobs.forEach((b, i) => {
    const ico = new THREE.IcosahedronGeometry(b[3], 1);
    batch.addGeometry(ico, new THREE.Matrix4().makeTranslation(b[0], b[1], b[2]), [0.22 + i * 0.03, 0.5 + i * 0.04, 0.2]);
  });
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const mesh = new THREE.InstancedMesh(batch.build(), mat, positions.length);
  mesh.castShadow = true;
  fillInstances([mesh], positions, rng, 0.9, 1.35);
  mesh.name = 'broadleafTrees';
  return mesh;
}
