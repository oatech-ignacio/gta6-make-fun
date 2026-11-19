// Palmera Bay water: a large specular plane with a scrolling procedural normal map and a foam line on the beach.
import * as THREE from 'three';
import { WATER_LEVEL } from './cityLayout.js';
import { createSeededRandom } from '../core/rng.js';

let waterMaterial = null, foamMesh = null;

function createWaveNormalTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'), rng = createSeededRandom(77);
  const height = new Float32Array(S * S);
  const waves = [];
  for (let k = 0; k < 14; k++) waves.push({ fx: rng.int(1, 7) * rng.sign(), fy: rng.int(1, 7), ph: rng() * 6.28, a: 0.5 / (1 + k * 0.4) });
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let h = 0;
    for (const w of waves) h += w.a * Math.sin((x * w.fx + y * w.fy) / S * Math.PI * 2 + w.ph);
    height[y * S + x] = h;
  }
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hx = height[y * S + ((x + 1) % S)] - height[y * S + ((x + S - 1) % S)];
    const hy = height[((y + 1) % S) * S + x] - height[((y + S - 1) % S) * S + x];
    const i = (y * S + x) * 4;
    img.data[i] = 128 + hx * 150; img.data[i + 1] = 128 + hy * 150; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(160, 160);
  return t;
}

export function buildOcean() {
  const group = new THREE.Group(); group.name = 'ocean';
  waterMaterial = new THREE.MeshPhongMaterial({ color: 0x1b8fa8, specular: 0xffe2b8, shininess: 70, normalMap: createWaveNormalTexture(), normalScale: new THREE.Vector2(0.55, 0.55) });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), waterMaterial);
  water.rotation.x = -Math.PI / 2; water.position.y = WATER_LEVEL; water.receiveShadow = true;
  group.add(water);
  // shoreline foam along the beach (where the sloping sand meets the water)
  const fc = document.createElement('canvas'); fc.width = 64; fc.height = 256;
  const fctx = fc.getContext('2d'), rng = createSeededRandom(5);
  const grad = fctx.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.4)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  fctx.fillStyle = grad; fctx.fillRect(0, 0, 64, 256);
  fctx.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 60; k++) { fctx.beginPath(); fctx.arc(rng() * 64, rng() * 256, 2 + rng() * 6, 0, 6.3); fctx.fill(); }
  const foamTex = new THREE.CanvasTexture(fc); foamTex.wrapT = THREE.RepeatWrapping; foamTex.repeat.set(1, 30); foamTex.colorSpace = THREE.SRGBColorSpace;
  const foamGeo = new THREE.PlaneGeometry(14, 800); foamGeo.rotateX(-Math.PI / 2);
  foamMesh = new THREE.Mesh(foamGeo, new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.9 }));
  foamMesh.position.set(530, WATER_LEVEL + 0.05, 0);
  group.add(foamMesh);
  return group;
}

export function updateOcean(time, sunColor, nightFactor) {
  if (!waterMaterial) return;
  waterMaterial.normalMap.offset.set(time * 0.006, time * 0.004);
  waterMaterial.color.setRGB(0.1 - nightFactor * 0.07, 0.5 - nightFactor * 0.38, 0.6 - nightFactor * 0.4);
  if (sunColor) waterMaterial.specular.copy(sunColor).multiplyScalar(0.9);
  if (foamMesh) { foamMesh.position.x = 529 + Math.sin(time * 0.6) * 2.2; foamMesh.material.map.offset.y = time * 0.01; foamMesh.material.opacity = 0.9 - nightFactor * 0.5; }
}
