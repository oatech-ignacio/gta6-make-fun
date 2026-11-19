// Neon shop signs: one canvas atlas of original Palmera Bay business names, hung on facades as glowing quads.
import * as THREE from 'three';

export const SIGN_NAMES = [
  'LUNA LOUNGE', 'MANGO MOTEL', 'PIXEL PALACE', 'BANCO AURORA', 'CLUB CORAL', 'TIKI TACO', 'HOTEL FLAMENCO', 'NEON NOODLE',
  'SUNFARE CABS', 'PELICAN PAWN', 'AZUCAR CAFE', 'VINYL VAULT', 'EL GATO GORDO', 'SALT & LIME', 'BAY BOWL', 'STARLITE CINE',
  'IRON PELICAN', "ODETTE'S AUTO", 'CHURRO KING', 'DINER 24H', 'SOL Y SOMBRA', 'LIQUOR', 'PALMERA FM', 'HOTEL MIRAMAR',
  'TIDE BAR', 'INK & ANCHOR', 'OPEN 24H', 'CASINO REY', 'SURF SHACK', 'GELATO', 'KARAOKE', 'CRANE TOWER',
];
const NEON_COLORS = ['#ff3d8b', '#2be0d0', '#ffd166', '#ff7a3d', '#b98cff', '#6dff8f', '#5ab8ff', '#ff5d5d'];
const COLS = 4, ROWS = 8, CELL_W = 512, CELL_H = 128;

export function createNeonSignAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL_W; canvas.height = ROWS * CELL_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0812'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  SIGN_NAMES.forEach((name, i) => {
    const x = (i % COLS) * CELL_W, y = Math.floor(i / COLS) * CELL_H;
    const color = NEON_COLORS[i % NEON_COLORS.length], alt = NEON_COLORS[(i * 3 + 2) % NEON_COLORS.length];
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#120d1e'; ctx.fillRect(4, 4, CELL_W - 8, CELL_H - 8);
    ctx.strokeStyle = alt; ctx.lineWidth = 5; ctx.shadowColor = alt; ctx.shadowBlur = 16;
    ctx.strokeRect(12, 12, CELL_W - 24, CELL_H - 24);
    const italic = i % 3 === 0 ? 'italic ' : '';
    let size = 78;
    ctx.font = `${italic}900 ${size}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
    while (ctx.measureText(name).width > CELL_W - 60 && size > 20) { size -= 4; ctx.font = `${italic}900 ${size}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 22; ctx.fillStyle = color;
    ctx.fillText(name, CELL_W / 2, CELL_H / 2 + 3);
    ctx.shadowBlur = 6; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6;
    ctx.fillText(name, CELL_W / 2, CELL_H / 2 + 3);
    ctx.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

/** Builds one mesh holding every sign quad. Slots come from the building generator: {x,y,z,nx,nz,w,h,nameIndex?}. */
export function buildNeonSigns(signSlots, rng) {
  const pos = [], uv = [];
  signSlots.forEach((s, k) => {
    const index = s.nameIndex !== undefined ? s.nameIndex : rng.int(0, SIGN_NAMES.length - 1);
    const u0 = (index % COLS) / COLS, v1 = 1 - Math.floor(index / COLS) / ROWS, u1 = u0 + 1 / COLS, v0 = v1 - 1 / ROWS;
    // tangent along the wall so the text reads left-to-right when seen from the front
    const tx = s.nz, tz = -s.nx, hw = s.w / 2, hh = s.h / 2;
    const corners = [[-hw, -hh, u0, v0], [hw, -hh, u1, v0], [hw, hh, u1, v1], [-hw, hh, u0, v1]];
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      const c = corners[idx];
      pos.push(s.x + tx * c[0], s.y + c[1], s.z + tz * c[0]);
      uv.push(c[2], c[3]);
    }
    if (s.kind === 'roof' || s.doubleSided) {   // back face for rooftop billboards
      for (const idx of [0, 2, 1, 0, 3, 2]) {
        const c = corners[idx];
        pos.push(s.x + tx * c[0] - s.nx * 0.3, s.y + c[1], s.z + tz * c[0] - s.nz * 0.3);
        uv.push(u0 + u1 - c[2], c[3]);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const material = new THREE.MeshBasicMaterial({ map: createNeonSignAtlas(), toneMapped: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.matrixAutoUpdate = false;
  return mesh;
}

export function setNeonSignBrightness(mesh, nightFactor) {
  const b = 0.75 + nightFactor * 2.6;
  mesh.material.color.setRGB(b, b, b);
}
