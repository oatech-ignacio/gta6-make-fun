// Canvas-drawn ground textures: asphalt with lane markings, intersections with crosswalks, pavers, sand, grass.
import * as THREE from 'three';
import { createSeededRandom } from '../core/rng.js';

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTexture(canvas, repeat = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function speckle(ctx, w, h, rng, count, light, dark) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rng() < 0.5 ? `rgba(255,255,255,${rng() * light})` : `rgba(0,0,0,${rng() * dark})`;
    ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2.5, 1 + rng() * 2.5);
  }
}
function asphaltBase(ctx, w, h, rng) {
  ctx.fillStyle = '#3b3d45'; ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, rng, 5000, 0.07, 0.16);
  for (let i = 0; i < 14; i++) {   // tar patches and cracks
    ctx.strokeStyle = `rgba(15,15,18,${0.25 + rng() * 0.3})`; ctx.lineWidth = 1 + rng() * 1.5; ctx.beginPath();
    let x = rng() * w, y = rng() * h; ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rng() - 0.5) * 60; y += (rng() - 0.5) * 60; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

/** One 16 m wide x 16 m long strip of 4-lane road; u runs across the road, v along it. */
export function createRoadSegmentTexture() {
  const S = 512, c = makeCanvas(S, S), ctx = c.getContext('2d'), rng = createSeededRandom(11);
  asphaltBase(ctx, S, S, rng);
  const px = S / 16;
  ctx.fillStyle = '#f4c430';                       // double yellow centre line
  ctx.fillRect(S / 2 - 0.32 * px, 0, 0.14 * px, S); ctx.fillRect(S / 2 + 0.18 * px, 0, 0.14 * px, S);
  ctx.fillStyle = '#e9e9e9';                       // dashed lane dividers
  for (const off of [-3.75, 3.75]) ctx.fillRect(S / 2 + off * px - 0.07 * px, S * 0.1, 0.14 * px, S * 0.45);
  ctx.fillStyle = '#d8d8d8';                       // solid edge lines
  ctx.fillRect(0.45 * px, 0, 0.12 * px, S); ctx.fillRect(S - 0.57 * px, 0, 0.12 * px, S);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';              // tyre-worn tracks
  for (const off of [-5.6, -1.9, 1.9, 5.6]) { ctx.fillRect(S / 2 + off * px - 1.0 * px, 0, 0.5 * px, S); ctx.fillRect(S / 2 + off * px + 0.5 * px, 0, 0.5 * px, S); }
  return toTexture(c);
}

/** 16 x 16 m intersection with zebra crosswalks on all four sides. */
export function createIntersectionTexture() {
  const S = 512, c = makeCanvas(S, S), ctx = c.getContext('2d'), rng = createSeededRandom(12);
  asphaltBase(ctx, S, S, rng);
  const px = S / 16;
  ctx.fillStyle = '#ececec';
  for (let k = 0; k < 11; k++) {
    const p = (1.6 + k * 1.2) * px;
    ctx.fillRect(p, 0.3 * px, 0.62 * px, 2.3 * px); ctx.fillRect(p, S - 2.6 * px, 0.62 * px, 2.3 * px);
    ctx.fillRect(0.3 * px, p, 2.3 * px, 0.62 * px); ctx.fillRect(S - 2.6 * px, p, 2.3 * px, 0.62 * px);
  }
  return toTexture(c, false);
}

export function createSidewalkTexture() {
  const S = 256, c = makeCanvas(S, S), ctx = c.getContext('2d'), rng = createSeededRandom(13);
  ctx.fillStyle = '#b9b3a8'; ctx.fillRect(0, 0, S, S);
  const n = 4, cell = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    ctx.fillStyle = `hsl(36, ${8 + rng() * 8}%, ${66 + rng() * 9}%)`;
    ctx.fillRect(x * cell + 1.5, y * cell + 1.5, cell - 3, cell - 3);
  }
  speckle(ctx, S, S, rng, 2500, 0.1, 0.12);
  return toTexture(c);
}

export function createSandTexture() {
  const S = 256, c = makeCanvas(S, S), ctx = c.getContext('2d'), rng = createSeededRandom(14);
  ctx.fillStyle = '#ecd9a6'; ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, S, rng, 6000, 0.25, 0.1);
  ctx.strokeStyle = 'rgba(170,130,70,0.14)'; ctx.lineWidth = 2;
  for (let i = 0; i < 16; i++) { const y = rng() * S; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(S * 0.3, y + 10, S * 0.6, y - 10, S, y); ctx.stroke(); }
  return toTexture(c);
}

export function createGrassTexture() {
  const S = 256, c = makeCanvas(S, S), ctx = c.getContext('2d'), rng = createSeededRandom(15);
  ctx.fillStyle = '#5f9d45'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { ctx.fillStyle = `hsla(${88 + rng() * 30}, ${45 + rng() * 25}%, ${28 + rng() * 26}%, 0.5)`; ctx.fillRect(rng() * S, rng() * S, 1.5, 2 + rng() * 4); }
  return toTexture(c);
}

export function createConcreteTexture() {
  const S = 256, c = makeCanvas(S, S), ctx = c.getContext('2d'), rng = createSeededRandom(16);
  ctx.fillStyle = '#8f9198'; ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, S, rng, 4000, 0.1, 0.14);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, S - 2, S - 2);
  return toTexture(c);
}
