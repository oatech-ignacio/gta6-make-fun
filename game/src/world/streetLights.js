// Street lamps along every road: instanced poles, lamp heads, additive glow sprites and light pools on the asphalt.
import * as THREE from 'three';
import { GeometryBatch } from './geometryBatcher.js';
import { getGlowTexture } from './glowTexture.js';
import { ROAD_HALF } from './cityLayout.js';

const POLE_HEIGHT = 8.2, ARM = 2.8;
let lampHeads = null, glowPoints = null, lightPools = null;

/** Lamp positions for an edge: alternating sides, the arm reaching over the road. */
export function layoutStreetLights(network) {
  const lamps = [];
  for (const e of network.edges) {
    const a = network.nodes[e.a], b = network.nodes[e.b];
    const dx = (b.x - a.x) / e.length, dz = (b.z - a.z) / e.length;
    const count = Math.max(2, Math.round((e.length - 32) / 30));
    for (let k = 0; k < count; k++) {
      const t = 22 + k * ((e.length - 44) / Math.max(1, count - 1));
      const side = k % 2 ? 1 : -1;
      const px = a.x + dx * t + (-dz) * side * (ROAD_HALF + 1.1), pz = a.z + dz * t + dx * side * (ROAD_HALF + 1.1);
      // heading that points the arm back toward the road centre
      lamps.push({ x: px, z: pz, heading: Math.atan2(dz * side, -dx * side) });
    }
  }
  return lamps;
}

export function buildStreetLights(lamps) {
  const batch = new GeometryBatch();
  batch.addBox(0, POLE_HEIGHT / 2, 0, 0.22, POLE_HEIGHT, 0.22, { color: [0.24, 0.26, 0.3] });
  batch.addBox(0, 0.5, 0, 0.5, 1, 0.5, { color: [0.2, 0.22, 0.25] });
  batch.addBox(0, POLE_HEIGHT, ARM / 2, 0.16, 0.16, ARM, { color: [0.24, 0.26, 0.3] });
  batch.addBox(0, POLE_HEIGHT - 0.05, ARM, 0.5, 0.22, 1.1, { color: [0.3, 0.32, 0.36] });
  const poles = new THREE.InstancedMesh(batch.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }), lamps.length);
  lampHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.08, 0.9), new THREE.MeshBasicMaterial({ color: 0xfff0c8 }), lamps.length);
  const poolGeo = new THREE.PlaneGeometry(1, 1); poolGeo.rotateX(-Math.PI / 2);
  lightPools = new THREE.InstancedMesh(poolGeo, new THREE.MeshBasicMaterial({ map: getGlowTexture(), color: 0xffb060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), lamps.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const glowPositions = [];
  lamps.forEach((l, i) => {
    q.setFromAxisAngle(up, l.heading);
    m.compose(new THREE.Vector3(l.x, 0, l.z), q, one); poles.setMatrixAt(i, m);
    const hx = l.x + Math.sin(l.heading) * ARM, hz = l.z + Math.cos(l.heading) * ARM;
    m.compose(new THREE.Vector3(hx, POLE_HEIGHT - 0.2, hz), q, one); lampHeads.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(hx, 0.07, hz), q, new THREE.Vector3(22, 1, 22)); lightPools.setMatrixAt(i, m);
    glowPositions.push(hx, POLE_HEIGHT - 0.3, hz);
    l.headX = hx; l.headZ = hz;
  });
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
  glowPoints = new THREE.Points(glowGeo, new THREE.PointsMaterial({ map: getGlowTexture(), color: 0xffc070, size: 7, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  poles.castShadow = false;
  lightPools.renderOrder = 2; glowPoints.renderOrder = 3;
  const group = new THREE.Group(); group.name = 'streetLights';
  group.add(poles, lampHeads, lightPools, glowPoints);
  return group;
}

/** Fade lamps in at dusk: 0 = day, 1 = night. */
export function setStreetLightLevel(nightFactor) {
  if (!lampHeads) return;
  const on = Math.min(1, nightFactor * 1.6);
  lampHeads.material.color.setRGB(0.25 + on * 3.2, 0.24 + on * 2.6, 0.2 + on * 1.6);
  lightPools.material.opacity = on * 0.42; lightPools.visible = on > 0.02;
  glowPoints.material.opacity = on * 0.95; glowPoints.visible = on > 0.02;
}
