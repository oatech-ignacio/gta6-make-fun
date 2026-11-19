// Procedural building facades drawn on canvases: a colour map plus an emissive map of lit windows per style.
import * as THREE from 'three';
import { createSeededRandom } from '../core/rng.js';

const SIZE = 512, CELLS = 8;

function makeCanvas(size = SIZE) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }

function finishTexture(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function litColor(rng) {
  const r = rng();
  if (r < 0.62) return `hsl(${38 + rng() * 12}, 95%, ${58 + rng() * 18}%)`;
  if (r < 0.82) return `hsl(${185 + rng() * 20}, 80%, ${60 + rng() * 15}%)`;
  if (r < 0.93) return `hsl(${320 + rng() * 20}, 90%, 66%)`;
  return '#ffffff';
}

/** Draws one facade style. `painter(ctx, emi, x, y, cell, lit, rng)` paints a single window cell. */
function drawFacade(seed, wallColor, painter, wallDetail) {
  const rng = createSeededRandom(seed);
  const color = makeCanvas(), emissive = makeCanvas();
  const ctx = color.getContext('2d'), emi = emissive.getContext('2d');
  ctx.fillStyle = wallColor; ctx.fillRect(0, 0, SIZE, SIZE);
  emi.fillStyle = '#000'; emi.fillRect(0, 0, SIZE, SIZE);
  const cell = SIZE / CELLS;
  if (wallDetail) wallDetail(ctx, rng);
  for (let gy = 0; gy < CELLS; gy++) for (let gx = 0; gx < CELLS; gx++) {
    painter(ctx, emi, gx * cell, gy * cell, cell, rng() < 0.42, rng);
  }
  // soft grime so large walls are not flat
  for (let i = 0; i < 500; i++) { ctx.fillStyle = `rgba(0,0,0,${rng() * 0.035})`; ctx.fillRect(rng() * SIZE, rng() * SIZE, 2 + rng() * 26, 1 + rng() * 5); }
  return { map: finishTexture(color), emissiveMap: finishTexture(emissive) };
}

function glassTowerCell(ctx, emi, x, y, s, lit, rng) {
  const g = ctx.createLinearGradient(x, y, x, y + s);
  const hue = 198 + rng() * 14, l = 26 + rng() * 14;
  g.addColorStop(0, `hsl(${hue}, 48%, ${l + 16}%)`); g.addColorStop(1, `hsl(${hue}, 55%, ${l}%)`);
  ctx.fillStyle = g; ctx.fillRect(x + 2, y + 3, s - 4, s - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x + 4, y + 5, s * 0.3, s - 12);
  ctx.fillStyle = '#d7dde6'; ctx.fillRect(x, y, s, 3); ctx.fillRect(x, y, 2, s);
  if (lit) { emi.fillStyle = litColor(rng); emi.globalAlpha = 0.55 + rng() * 0.45; emi.fillRect(x + 3, y + 5, s - 6, s - 9); emi.globalAlpha = 1; }
}
function officeCell(ctx, emi, x, y, s, lit, rng) {
  ctx.fillStyle = '#1c2836'; ctx.fillRect(x + 5, y + 14, s - 10, s - 28);
  ctx.fillStyle = `hsl(205, 35%, ${30 + rng() * 14}%)`; ctx.fillRect(x + 7, y + 16, s - 14, s - 32);
  ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(x, y + s - 6, s, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x, y, s, 3);
  if (lit) { emi.fillStyle = litColor(rng); emi.globalAlpha = 0.6 + rng() * 0.4; emi.fillRect(x + 7, y + 16, s - 14, s - 32); emi.globalAlpha = 1; }
}
function decoHotelCell(ctx, emi, x, y, s, lit, rng) {
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x, y + s - 10, s, 5);          // balcony slab stripe
  ctx.fillStyle = '#22303c'; ctx.fillRect(x + 12, y + 12, s - 24, s - 26);
  ctx.fillStyle = `hsl(190, 45%, ${34 + rng() * 14}%)`; ctx.fillRect(x + 14, y + 14, s - 28, s - 30);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(x + 8, y + s - 22, s - 16, 3);   // railing
  for (let k = 0; k < 5; k++) ctx.fillRect(x + 9 + k * (s - 18) / 4, y + s - 22, 1.5, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x + s - 3, y, 3, s);
  if (lit) { emi.fillStyle = litColor(rng); emi.globalAlpha = 0.6 + rng() * 0.4; emi.fillRect(x + 14, y + 14, s - 28, s - 36); emi.globalAlpha = 1; }
}
function apartmentCell(ctx, emi, x, y, s, lit, rng) {
  ctx.fillStyle = 'rgba(0,0,0,0.07)'; for (let k = 0; k < 4; k++) ctx.fillRect(x, y + k * s / 4, s, 1.5);
  ctx.fillStyle = '#f6efe2'; ctx.fillRect(x + 16, y + 12, s - 32, s - 24);
  ctx.fillStyle = `hsl(210, 30%, ${26 + rng() * 16}%)`; ctx.fillRect(x + 19, y + 15, s - 38, s - 30);
  ctx.fillStyle = '#f6efe2'; ctx.fillRect(x + s / 2 - 1, y + 15, 2, s - 30);
  if (rng() < 0.3) { ctx.fillStyle = '#8d99a6'; ctx.fillRect(x + 20, y + s - 20, s - 40, 9); }  // AC unit
  if (lit) { emi.fillStyle = litColor(rng); emi.globalAlpha = 0.6 + rng() * 0.4; emi.fillRect(x + 19, y + 15, s - 38, s - 30); emi.globalAlpha = 1; }
}
function warehouseCell(ctx, emi, x, y, s, lit, rng) {
  ctx.fillStyle = 'rgba(0,0,0,0.1)'; for (let k = 0; k < 8; k++) ctx.fillRect(x + k * s / 8, y, 2, s);
  ctx.fillStyle = 'rgba(120,60,20,0.12)'; ctx.fillRect(x + rng() * s, y, 3, s * rng());
  if (rng() < 0.22) {
    ctx.fillStyle = '#26313b'; ctx.fillRect(x + 10, y + 8, s - 20, 16);
    if (lit) { emi.fillStyle = '#ffd98a'; emi.globalAlpha = 0.7; emi.fillRect(x + 10, y + 8, s - 20, 16); emi.globalAlpha = 1; }
  }
}
function houseCell(ctx, emi, x, y, s, lit, rng) {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 14, y + 14, s - 28, s - 30);
  ctx.fillStyle = `hsl(205, 35%, ${30 + rng() * 12}%)`; ctx.fillRect(x + 17, y + 17, s - 34, s - 36);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + s / 2 - 1, y + 17, 2, s - 36); ctx.fillRect(x + 17, y + s / 2 - 2, s - 34, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 8, y + 14, 6, s - 30); ctx.fillRect(x + s - 14, y + 14, 6, s - 30);  // shutters
  if (lit) { emi.fillStyle = '#ffcf7a'; emi.globalAlpha = 0.8; emi.fillRect(x + 17, y + 17, s - 34, s - 36); emi.globalAlpha = 1; }
}
function storefrontCell(ctx, emi, x, y, s, lit, rng) {
  ctx.fillStyle = '#141a24'; ctx.fillRect(x + 3, y + 6, s - 6, s - 12);
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, `hsl(${rng() * 360}, 60%, 42%)`); g.addColorStop(1, '#1b2634');
  ctx.fillStyle = g; ctx.fillRect(x + 5, y + 8, s - 10, s - 16);
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + 7, y + 10, s * 0.25, s - 22);
  emi.fillStyle = litColor(rng); emi.globalAlpha = lit ? 0.9 : 0.45; emi.fillRect(x + 5, y + 8, s - 10, s - 16); emi.globalAlpha = 1;
}

// Style table: world size of one window cell (bay width x floor height) and surface response.
export const FACADE_STYLES = [
  { key: 'glassTower', bay: 3.2, floor: 3.6, roughness: 0.22, metalness: 0.35 },
  { key: 'office', bay: 3.6, floor: 3.6, roughness: 0.7, metalness: 0.05 },
  { key: 'decoHotel', bay: 4.0, floor: 3.4, roughness: 0.8, metalness: 0 },
  { key: 'apartment', bay: 4.2, floor: 3.3, roughness: 0.85, metalness: 0 },
  { key: 'warehouse', bay: 5.0, floor: 5.0, roughness: 0.6, metalness: 0.3 },
  { key: 'house', bay: 4.5, floor: 3.4, roughness: 0.9, metalness: 0 },
  { key: 'storefront', bay: 5.0, floor: 4.5, roughness: 0.35, metalness: 0.1 },
];

export function createFacadeTextureSet(seed = 7) {
  const painters = [
    ['#c9d3de', glassTowerCell], ['#e9e6df', officeCell], ['#fbf6ee', decoHotelCell], ['#f1ebe0', apartmentCell],
    ['#dfe3e6', warehouseCell], ['#fbf7ef', houseCell], ['#3a3f4a', storefrontCell],
  ];
  return FACADE_STYLES.map((style, i) => ({ ...style, index: i, ...drawFacade(seed + i * 31, painters[i][0], painters[i][1]) }));
}

export function createFacadeMaterial(style) {
  return new THREE.MeshStandardMaterial({
    map: style.map, emissiveMap: style.emissiveMap, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.2,
    roughness: style.roughness, metalness: style.metalness, vertexColors: true,
  });
}
