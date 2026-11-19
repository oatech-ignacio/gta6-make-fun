// Minimap and city map rendering: a pre-drawn base map of Palmera Bay (districts, roads, beach, causeway)
// plus live blips for the player, missions, shops, police, enemies and the wanted search area.
import { game } from '../core/gameState.js';
import { GRID_X, GRID_Z, ROAD_HALF, WORLD_BOUNDS, DISTRICTS, CAUSEWAY_Z, BEACH_X, listCityBlocks, PLACES, AVENUE_NAMES, STREET_NAMES } from '../world/cityLayout.js';
import { getMarkers } from '../missions/missionMarkers.js';
import { cameraRig } from '../render/followCamera.js';

const SCALE = 2;      // base map pixels per metre
let baseMap = null;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const BLOCK_FILL = { suburbs: '#3d6b4a', downtown: '#5a3d6e', market: '#7a5a3a', beach: '#2f7f86', docks: '#4a5468' };

function wx(x) { return (x - WORLD_BOUNDS.minX) * SCALE; }
function wz(z) { return (z - WORLD_BOUNDS.minZ) * SCALE; }

/** Draws the static city map once into an offscreen canvas. */
export function buildBaseMap() {
  const c = document.createElement('canvas');
  c.width = (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) * SCALE; c.height = (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) * SCALE;
  const ctx = c.getContext('2d');
  const sea = ctx.createLinearGradient(0, 0, c.width, c.height); sea.addColorStop(0, '#12385c'); sea.addColorStop(1, '#0d2b4a');
  ctx.fillStyle = sea; ctx.fillRect(0, 0, c.width, c.height);
  const rect = (x0, z0, x1, z1, fill) => { ctx.fillStyle = fill; ctx.fillRect(wx(x0), wz(z0), (x1 - x0) * SCALE, (z1 - z0) * SCALE); };
  rect(-506, -406, 536, 406, '#1f5f7a');                                // shallows
  rect(-500, -400, BEACH_X, 400, '#2a2f3d');                            // mainland
  rect(BEACH_X, -400, 528, 400, '#d9c48a');                             // beach
  rect(-500, -400, GRID_X[0] - ROAD_HALF, 400, '#35593f'); rect(-440, -400, 452, GRID_Z[0] - ROAD_HALF, '#35593f');
  rect(-440, GRID_Z[7] + ROAD_HALF, 452, 400, '#4a5468');
  rect(700, CAUSEWAY_Z - 95, 880, CAUSEWAY_Z + 95, '#c9b97a'); rect(712, CAUSEWAY_Z - 85, 870, CAUSEWAY_Z + 85, '#3f7a4f');   // island
  rect(452, 136, 640, 152, '#8a6a48');                                   // pier
  for (const b of listCityBlocks()) rect(b.minX, b.minZ, b.maxX, b.maxZ, b.i === 4 && b.j === 2 ? '#3f8a4f' : BLOCK_FILL[b.district]);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (const b of listCityBlocks()) ctx.fillRect(wx(b.minX + 6), wz(b.minZ + 6), (b.maxX - b.minX - 12) * SCALE, (b.maxZ - b.minZ - 12) * SCALE);
  // roads
  const road = '#9aa3b5';
  for (const gx of GRID_X) rect(gx - ROAD_HALF, GRID_Z[0] - ROAD_HALF, gx + ROAD_HALF, GRID_Z[7] + ROAD_HALF, road);
  for (const gz of GRID_Z) rect(GRID_X[0] - ROAD_HALF, gz - ROAD_HALF, GRID_X[9] + ROAD_HALF, gz + ROAD_HALF, road);
  rect(GRID_X[9], CAUSEWAY_Z - ROAD_HALF, 800, CAUSEWAY_Z + ROAD_HALF, '#c9cfdb');
  rect(GRID_X[9] - ROAD_HALF, GRID_Z[0] - ROAD_HALF, GRID_X[9] + ROAD_HALF, GRID_Z[7] + ROAD_HALF, '#c9cfdb');    // boulevard highlighted
  ctx.strokeStyle = 'rgba(40,44,56,0.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([10, 10]);
  for (const gx of GRID_X) { ctx.beginPath(); ctx.moveTo(wx(gx), wz(GRID_Z[0])); ctx.lineTo(wx(gx), wz(GRID_Z[7])); ctx.stroke(); }
  for (const gz of GRID_Z) { ctx.beginPath(); ctx.moveTo(wx(GRID_X[0]), wz(gz)); ctx.lineTo(wx(gz === CAUSEWAY_Z ? 800 : GRID_X[9]), wz(gz)); ctx.stroke(); }
  ctx.setLineDash([]);
  baseMap = c;
  return c;
}

function getBaseMap() { return baseMap || buildBaseMap(); }

function drawBlip(ctx, x, y, color, icon, size = 7) {
  ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
  if (icon) { ctx.fillStyle = '#000'; ctx.font = `900 ${size * 1.45}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, x, y + 0.5); }
}

function drawPlayerArrow(ctx, x, y, angle, size) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.72, size * 0.8); ctx.lineTo(0, size * 0.4); ctx.lineTo(-size * 0.72, size * 0.8); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ff3d8b'; ctx.stroke();
  ctx.restore();
}

/** The round HUD minimap: rotates with the camera, zooms out with speed. */
export function drawMinimap(canvas) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
  const player = game.player, p = player.pos, yaw = cameraRig.override && cameraRig.override.yaw !== undefined ? cameraRig.override.yaw : cameraRig.yaw;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const speed = player.vehicle ? Math.abs(player.vehicle.speed) : 0;
  const zoom = 0.78 - Math.min(0.3, speed * 0.007);          // screen pixels per metre
  ctx.fillStyle = '#0d2b4a'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.transform(-fz * zoom, -fx * zoom, fx * zoom, -fz * zoom, 0, 0);
  ctx.translate(-p.x, -p.z);
  ctx.drawImage(getBaseMap(), WORLD_BOUNDS.minX, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX, WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
  ctx.restore();
  const toScreen = (x, z) => { const dx = x - p.x, dz = z - p.z; return [cx + (-fz * dx + fx * dz) * zoom, cy + (-fx * dx - fz * dz) * zoom]; };
  const edge = W / 2 - 12;
  const clampToEdge = (s) => { const dx = s[0] - cx, dy = s[1] - cy, d = Math.hypot(dx, dy); return d > edge ? [cx + dx / d * edge, cy + dy / d * edge, true] : [s[0], s[1], false]; };
  // wanted: pulsing search radius around the last known position
  const w = game.wanted;
  if (w.stars > 0 && w.evading) {
    const s = toScreen(w.lastKnown.x, w.lastKnown.z);
    ctx.beginPath(); ctx.arc(s[0], s[1], 60 * zoom, 0, 6.3); ctx.fillStyle = `rgba(255,60,60,${0.14 + Math.sin(game.time * 5) * 0.06})`; ctx.fill();
  }
  for (const v of game.vehicles) {
    if (v === player.vehicle || v.wrecked) continue;
    const s = toScreen(v.pos.x, v.pos.z);
    if (Math.hypot(s[0] - cx, s[1] - cy) > edge) { if (!(v.isPolice && v.ai && v.ai.mode !== 'traffic' && w.stars > 0)) continue; }
    if (v.isPolice && v.ai && v.ai.mode !== 'traffic' && (w.stars > 0 || v.siren)) {
      const c = clampToEdge(s), flash = Math.floor(game.time * 5 + v.id) % 2 === 0;
      drawBlip(ctx, c[0], c[1], flash ? '#ff3344' : '#4f7dff', '', 5.5);
    } else { ctx.fillStyle = 'rgba(230,236,248,0.75)'; ctx.fillRect(s[0] - 2, s[1] - 2, 4, 4); }
  }
  for (const c of game.characters) {
    if (c.state === 'dead' || c.vehicle || c === player) continue;
    if (c.kind === 'cop') { const s = toScreen(c.pos.x, c.pos.z); if (Math.hypot(s[0] - cx, s[1] - cy) < edge) drawBlip(ctx, s[0], s[1], Math.floor(game.time * 5 + c.id) % 2 ? '#ff3344' : '#4f7dff', '', 3.5); }
  }
  if (game.helicopter && game.helicopter.active) { const s = clampToEdge(toScreen(game.helicopter.pos.x, game.helicopter.pos.z)); drawBlip(ctx, s[0], s[1], '#4f7dff', 'H', 7); }
  for (const m of getMarkers()) {
    const c = clampToEdge(toScreen(m.x, m.z));
    if (m.kind === 'shop' && c[2]) continue;
    if (m.persistent && m.kind !== 'missionStart' && c[2]) continue;
    drawBlip(ctx, c[0], c[1], hex(m.color), m.icon, m.kind === 'enemy' ? 4.5 : m.persistent && m.kind !== 'missionStart' ? 6.5 : 8);
  }
  drawPlayerArrow(ctx, cx, cy, Math.atan2(Math.sin(player.heading - yaw) * -1, Math.cos(player.heading - yaw)), 9);
  // vignette ring
  const g = ctx.createRadialGradient(cx, cy, W * 0.36, cx, cy, W * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(6,4,16,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

/** Full city map for the pause screen: north-up, labelled districts and streets, legend icons, live blips. */
export function drawCityMap(canvas) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, base = getBaseMap();
  const view = { minX: -540, maxX: 905, minZ: -440, maxZ: 440 };
  const s = Math.min(W / (view.maxX - view.minX), H / (view.maxZ - view.minZ));
  const ox = (W - (view.maxX - view.minX) * s) / 2 - view.minX * s, oz = (H - (view.maxZ - view.minZ) * s) / 2 - view.minZ * s;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  ctx.fillStyle = '#0d2b4a'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(base, X(WORLD_BOUNDS.minX), Z(WORLD_BOUNDS.minZ), (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) * s, (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) * s);
  // street names
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = `600 ${Math.max(8, 9.5 * s)}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  AVENUE_NAMES.forEach((n, i) => { ctx.save(); ctx.translate(X(GRID_X[i]), Z(-372)); ctx.rotate(-Math.PI / 2); ctx.fillText(n.toUpperCase(), 0, 0); ctx.restore(); });
  ctx.textAlign = 'right';
  STREET_NAMES.forEach((n, j) => ctx.fillText(n.toUpperCase(), X(-448), Z(GRID_Z[j])));
  // district labels
  const labels = [['suburbs', -288, 0], ['downtown', 96, 60], ['market', 96, -288], ['beach', 384, -60], ['docks', -40, 300], ['island', 790, -260], ['causeway', 610, -122]];
  ctx.textAlign = 'center';
  for (const [key, x, z] of labels) {
    const d = DISTRICTS[key], big = key !== 'causeway';
    ctx.font = `italic 900 ${big ? 21 * s + 8 : 11 * s + 6}px "Arial Black", Impact, Arial, sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,6,20,0.85)'; ctx.strokeText(d.name.toUpperCase(), X(x), Z(z));
    ctx.fillStyle = d.color; ctx.fillText(d.name.toUpperCase(), X(x), Z(z));
  }
  ctx.font = `italic 700 ${13 * s + 6}px Arial, sans-serif`; ctx.fillStyle = 'rgba(160,210,255,0.7)';
  ctx.fillText('P A L M E R A   B A Y', X(700), Z(240)); ctx.fillText('ATLANTIC SHALLOWS', X(700), Z(-400));
  // places
  for (const key of Object.keys(PLACES)) { const p = PLACES[key]; drawBlip(ctx, X(p.x), Z(p.z), p.color, p.icon, 8.5); }
  for (const m of getMarkers()) {
    if (m.persistent && m.kind !== 'missionStart') continue;
    const x = X(m.x), z = Z(m.z);
    if (m.kind === 'missionStart' || m.kind === 'mission') { ctx.beginPath(); ctx.arc(x, z, 15 + Math.sin(game.time * 4) * 2, 0, 6.3); ctx.strokeStyle = hex(m.color); ctx.lineWidth = 2.5; ctx.stroke(); }
    drawBlip(ctx, x, z, hex(m.color), m.icon, m.kind === 'enemy' ? 5 : 10);
  }
  for (const v of game.vehicles) if (v.isPolice && v.ai && v.ai.mode !== 'traffic' && !v.wrecked) drawBlip(ctx, X(v.pos.x), Z(v.pos.z), Math.floor(game.time * 4 + v.id) % 2 ? '#ff3344' : '#4f7dff', '', 5);
  if (game.player) {
    const p = game.player.pos;
    ctx.beginPath(); ctx.arc(X(p.x), Z(p.z), 20, 0, 6.3); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    drawPlayerArrow(ctx, X(p.x), Z(p.z), Math.PI - game.player.heading, 12);
    ctx.font = '900 13px Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.textAlign = 'left';
    ctx.strokeText('YOU', X(p.x) + 24, Z(p.z)); ctx.fillText('YOU', X(p.x) + 24, Z(p.z));
  }
  // compass + scale
  ctx.textAlign = 'center'; ctx.font = '900 20px Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('N', W - 34, 30);
  ctx.beginPath(); ctx.moveTo(W - 34, 44); ctx.lineTo(W - 27, 62); ctx.lineTo(W - 41, 62); ctx.closePath(); ctx.fillStyle = '#ff3d8b'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(W - 150, H - 22, 200 * s, 3); ctx.font = '700 11px Arial, sans-serif'; ctx.fillText('200 m', W - 150 + 100 * s, H - 30);
}
