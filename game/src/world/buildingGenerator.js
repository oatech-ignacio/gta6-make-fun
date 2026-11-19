// Fills each city block with district-specific buildings (towers, deco hotels, houses, warehouses)
// and records colliders, neon sign slots, tree/palm positions and parking spots.
import { addStaticBox } from './collisionGrid.js';
import { SIDEWALK, CURB_HEIGHT } from './cityLayout.js';

const GLASS_TINTS = [[0.72, 0.9, 1], [1, 0.82, 0.7], [0.78, 1, 0.94], [1, 0.84, 0.94], [0.88, 0.9, 1], [1, 0.94, 0.74], [0.7, 0.8, 0.95], [0.95, 0.75, 0.6]];
const OFFICE_TINTS = [[1, 0.96, 0.9], [0.95, 0.9, 0.84], [0.9, 0.93, 0.97], [1, 0.9, 0.82], [0.86, 0.82, 0.78], [0.98, 0.86, 0.8]];
const DECO_TINTS = [[1, 0.7, 0.78], [0.66, 0.95, 0.85], [1, 0.8, 0.6], [0.6, 0.9, 0.96], [1, 0.95, 0.62], [0.84, 0.76, 1], [1, 1, 1], [1, 0.62, 0.55]];
const MARKET_TINTS = [[0.95, 0.55, 0.4], [1, 0.82, 0.4], [0.4, 0.75, 0.75], [0.95, 0.6, 0.7], [0.6, 0.72, 0.95], [0.9, 0.9, 0.82], [0.75, 0.9, 0.55]];
const HOUSE_TINTS = [[1, 0.95, 0.85], [0.98, 0.85, 0.72], [0.85, 0.93, 0.98], [1, 0.9, 0.9], [0.92, 0.98, 0.88], [1, 1, 1], [0.98, 0.9, 0.65]];
const ROOF_TILES = [[0.72, 0.33, 0.22], [0.62, 0.28, 0.2], [0.42, 0.42, 0.46], [0.8, 0.45, 0.3], [0.3, 0.36, 0.42]];
const CONTAINER_COLORS = [[0.75, 0.2, 0.16], [0.16, 0.38, 0.66], [0.9, 0.55, 0.12], [0.15, 0.5, 0.36], [0.85, 0.82, 0.76], [0.45, 0.2, 0.5], [0.9, 0.78, 0.2]];
const STYLE = { glass: 0, office: 1, deco: 2, apartment: 3, warehouse: 4, house: 5, store: 6 };

function snap(v, unit) { return Math.max(unit, Math.round(v / unit) * unit); }

/** One box-shaped building volume with a textured facade, a roof slab and (optionally) a collider. */
export function addBuildingVolume(ctx, rng, cx, cz, w, d, baseY, h, styleIndex, tint, collide = true) {
  const st = ctx.styles[styleIndex];
  ctx.facades[styleIndex].addBox(cx, baseY + h / 2, cz, w, h, d, {
    color: tint, top: false, uPerMeter: 1 / (st.bay * 8), vPerMeter: 1 / (st.floor * 8),
    uOffset: rng.int(0, 7) / 8, vOffset: rng.int(0, 7) / 8,
  });
  const roofTone = 0.32 + rng() * 0.2;
  ctx.props.addBox(cx, baseY + h + 0.35, cz, w + 0.7, 0.7, d + 0.7, { color: [roofTone * tint[0], roofTone * tint[1], roofTone * tint[2]], topColor: [roofTone * 0.9, roofTone * 0.9, roofTone * 0.95] });
  if (collide) addStaticBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, baseY + h);
}

function addRoofClutter(ctx, rng, cx, cz, w, d, y, tall) {
  const n = rng.int(1, 3);
  for (let k = 0; k < n; k++) {
    const bw = rng.range(2, Math.max(2.5, w * 0.3)), bd = rng.range(2, Math.max(2.5, d * 0.3)), bh = rng.range(1.2, 3.2);
    ctx.props.addBox(cx + rng.range(-0.3, 0.3) * w, y + bh / 2, cz + rng.range(-0.3, 0.3) * d, bw, bh, bd, { color: [0.62, 0.64, 0.68] });
  }
  if (tall && rng.chance(0.55)) {
    const ah = rng.range(8, 22);
    ctx.props.addBox(cx, y + ah / 2, cz, 0.45, ah, 0.45, { color: [0.75, 0.75, 0.8] });
    ctx.beacons.push({ x: cx, y: y + ah + 0.4, z: cz });
  }
}

/** Remember a place where a neon sign can hang: centre, facing normal (nx,nz), width and height. */
function addSignSlot(ctx, x, y, z, nx, nz, w, h, kind = 'shop') { ctx.signSlots.push({ x, y, z, nx, nz, w, h, kind }); }

function signsAroundPodium(ctx, rng, block, cx, cz, w, d, y) {
  const faces = [
    { nx: 0, nz: -1, edge: Math.abs((cz - d / 2) - (block.minZ + SIDEWALK)) < 3, x: cx, z: cz - d / 2, span: w },
    { nx: 0, nz: 1, edge: Math.abs((cz + d / 2) - (block.maxZ - SIDEWALK)) < 3, x: cx, z: cz + d / 2, span: w },
    { nx: -1, nz: 0, edge: Math.abs((cx - w / 2) - (block.minX + SIDEWALK)) < 3, x: cx - w / 2, z: cz, span: d },
    { nx: 1, nz: 0, edge: Math.abs((cx + w / 2) - (block.maxX - SIDEWALK)) < 3, x: cx + w / 2, z: cz, span: d },
  ];
  for (const f of faces) {
    if (!f.edge || !rng.chance(0.85)) continue;
    const sw = Math.min(f.span * 0.7, rng.range(9, 16));
    addSignSlot(ctx, f.x + f.nx * 0.25, y, f.z + f.nz * 0.25, f.nx, f.nz, sw, sw / 4);
  }
}

function buildDowntownParcel(ctx, rng, block, cx, cz, w, d, heightScale) {
  const podiumH = rng.pick([5.5, 7, 9]);
  ctx.facades[STYLE.store].addBox(cx, CURB_HEIGHT + podiumH / 2, cz, w, podiumH, d, { color: [1, 1, 1], top: false, uPerMeter: 1 / 40, vPerMeter: 1 / (podiumH * 8), uOffset: rng.int(0, 7) / 8, vOffset: rng.int(0, 7) / 8 });
  ctx.props.addBox(cx, CURB_HEIGHT + podiumH + 0.3, cz, w + 1.2, 0.6, d + 1.2, { color: [0.2, 0.2, 0.24] });
  addStaticBox(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, podiumH);
  signsAroundPodium(ctx, rng, block, cx, cz, w, d, CURB_HEIGHT + podiumH - 1.7);
  const glass = rng.chance(0.62);
  const style = glass ? STYLE.glass : STYLE.office, st = ctx.styles[style];
  const tint = rng.pick(glass ? GLASS_TINTS : OFFICE_TINTS);
  const inset = rng.range(1.5, 4);
  let tw = snap(w - inset * 2, st.bay), td = snap(d - inset * 2, st.bay);
  const totalH = snap(rng.range(38, 120) * heightScale, st.floor);
  const tiers = totalH > 70 && rng.chance(0.7) ? rng.int(2, 3) : 1;
  let y = CURB_HEIGHT + podiumH + 0.6, remaining = totalH;
  for (let t = 0; t < tiers; t++) {
    const th = t === tiers - 1 ? remaining : snap(remaining * rng.range(0.5, 0.68), st.floor);
    addBuildingVolume(ctx, rng, cx, cz, tw, td, y, th, style, tint, false);
    y += th + 0.7; remaining -= th;
    if (t < tiers - 1) { tw = snap(tw * rng.range(0.66, 0.82), st.bay); td = snap(td * rng.range(0.66, 0.82), st.bay); }
  }
  addRoofClutter(ctx, rng, cx, cz, tw, td, y, true);
  if (rng.chance(0.3)) addSignSlot(ctx, cx, y + 3.2, cz + td / 2 - 0.5, 0, 1, Math.min(tw, 18), Math.min(tw, 18) / 4, 'roof');
  if (rng.chance(0.3)) addSignSlot(ctx, cx - tw / 2 + 0.5, y + 3.2, cz, -1, 0, Math.min(td, 18), Math.min(td, 18) / 4, 'roof');
  ctx.skyline.push({ x: cx, z: cz, h: y });
}

function buildDowntownBlock(ctx, rng, block, lot) {
  const cx = (lot.minX + lot.maxX) / 2, cz = (lot.minZ + lot.maxZ) / 2, W = lot.maxX - lot.minX, D = lot.maxZ - lot.minZ;
  const centerBoost = 1.25 - Math.min(0.6, (Math.abs(cx - 48) + Math.abs(cz - 0)) / 420);
  const layout = rng();
  if (layout < 0.45) {
    const gap = 5, pw = (W - gap) / 2, pd = (D - gap) / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) buildDowntownParcel(ctx, rng, block, cx + sx * (pw + gap) / 2, cz + sz * (pd + gap) / 2, pw, pd, centerBoost);
  } else if (layout < 0.75) {
    const gap = 6, pd = (D - gap) / 2;
    for (const sz of [-1, 1]) buildDowntownParcel(ctx, rng, block, cx, cz + sz * (pd + gap) / 2, W, pd, centerBoost * 1.1);
  } else {
    buildDowntownParcel(ctx, rng, block, cx, cz, W - 10, D - 10, centerBoost * 1.5);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) ctx.palms.push({ x: cx + sx * (W / 2 - 2.5), z: cz + sz * (D / 2 - 2.5) });
  }
}

function buildMarketBlock(ctx, rng, block, lot) {
  const cx = (lot.minX + lot.maxX) / 2, cz = (lot.minZ + lot.maxZ) / 2, W = lot.maxX - lot.minX, D = lot.maxZ - lot.minZ;
  const gap = 4, cols = 3, pw = (W - gap * (cols - 1)) / cols, pd = (D - gap) / 2;
  for (let c = 0; c < cols; c++) for (const sz of [-1, 1]) {
    const x = lot.minX + pw / 2 + c * (pw + gap), z = cz + sz * (pd + gap) / 2;
    const st = ctx.styles[STYLE.apartment], h = snap(rng.range(11, 30), st.floor);
    const w = snap(pw, 1), d = snap(pd, 1);
    ctx.facades[STYLE.store].addBox(x, CURB_HEIGHT + 2.2, z, w + 0.2, 4.4, d + 0.2, { color: [1, 1, 1], top: false, uPerMeter: 1 / 40, vPerMeter: 1 / (4.4 * 8), uOffset: rng.int(0, 7) / 8, vOffset: rng.int(0, 7) / 8 });
    addBuildingVolume(ctx, rng, x, z, w, d, CURB_HEIGHT + 4.4, h, STYLE.apartment, rng.pick(MARKET_TINTS));
    addRoofClutter(ctx, rng, x, z, w, d, CURB_HEIGHT + 4.4 + h + 0.7, false);
    // awning strip over the shop front
    const awn = rng.pick(MARKET_TINTS);
    ctx.props.addBox(x, CURB_HEIGHT + 4.2, z + sz * (d / 2 + 0.9), w * 0.9, 0.25, 1.8, { color: awn });
    if (rng.chance(0.7)) addSignSlot(ctx, x, CURB_HEIGHT + 5.6, z + sz * (d / 2 + 0.25), 0, sz, Math.min(w * 0.8, 12), 3);
  }
}

function buildBeachBlock(ctx, rng, block, lot) {
  const cx = (lot.minX + lot.maxX) / 2, W = lot.maxX - lot.minX, D = lot.maxZ - lot.minZ;
  const rows = rng.chance(0.5) ? 2 : 3, gap = 7, pd = (D - gap * (rows - 1)) / rows;
  for (let r = 0; r < rows; r++) {
    const z = lot.minZ + pd / 2 + r * (pd + gap);
    const st = ctx.styles[STYLE.deco];
    const split = rng.chance(0.45);
    const parcels = split ? [{ x: cx - W / 4 - 1.5, w: W / 2 - 3 }, { x: cx + W / 4 + 1.5, w: W / 2 - 3 }] : [{ x: cx, w: W - rng.range(0, 14) }];
    for (const p of parcels) {
      const tint = rng.pick(DECO_TINTS), accent = rng.pick(DECO_TINTS);
      const w = snap(p.w, st.bay), d = snap(pd - rng.range(0, 6), st.bay), h = snap(rng.range(15, 46), st.floor);
      addBuildingVolume(ctx, rng, p.x, z, w, d, CURB_HEIGHT, h, STYLE.deco, tint);
      // stepped deco crown + coloured fin
      const cw = snap(w * 0.6, st.bay), cd = snap(d * 0.6, st.bay), ch = snap(rng.range(4, 9), st.floor);
      addBuildingVolume(ctx, rng, p.x, z, cw, cd, CURB_HEIGHT + h + 0.7, ch, STYLE.deco, tint, false);
      const finSide = p.x >= cx ? 1 : -1;
      ctx.props.addBox(p.x + finSide * (w / 2 + 0.4), CURB_HEIGHT + (h + ch + 5) / 2, z, 0.8, h + ch + 5, 3.2, { color: accent });
      ctx.props.addBox(p.x, CURB_HEIGHT + 4.3, z, w + 2.4, 0.4, d + 2.4, { color: [1, 1, 1] });   // wraparound canopy
      addSignSlot(ctx, p.x + finSide * (w / 2 + 0.3), CURB_HEIGHT + 6.6, z, finSide, 0, Math.min(d * 0.8, 14), 3.4);
      if (rng.chance(0.6)) addSignSlot(ctx, p.x, CURB_HEIGHT + h + ch + 3.4, z, finSide, 0, Math.min(d * 0.7, 16), 4, 'roof');
      ctx.skyline.push({ x: p.x, z, h: h + ch });
    }
    if (r < rows - 1) {
      const gz = z + pd / 2 + gap / 2;
      for (let x = lot.minX + 4; x < lot.maxX - 2; x += 11) ctx.palms.push({ x: x + rng.range(-1, 1), z: gz + rng.range(-1, 1) });
      ctx.parkingSpots.push({ x: cx + rng.range(-20, 20), z: gz, heading: Math.PI / 2 });
    }
  }
}

function buildSuburbBlock(ctx, rng, block, lot) {
  const W = lot.maxX - lot.minX, D = lot.maxZ - lot.minZ;
  ctx.grass.addGroundQuad((lot.minX + lot.maxX) / 2, CURB_HEIGHT + 0.03, (lot.minZ + lot.maxZ) / 2, W - 1, D - 1, { uRepeat: W / 8, vRepeat: D / 8 });
  const cols = 3, cw = W / cols;
  for (let c = 0; c < cols; c++) for (const side of [-1, 1]) {
    const x = lot.minX + cw / 2 + c * cw, z = side < 0 ? lot.minZ + 13 : lot.maxZ - 13;
    const w = rng.range(12, 16), d = rng.range(9, 12), floors = rng.chance(0.35) ? 2 : 1, h = floors * 3.4;
    const tint = rng.pick(HOUSE_TINTS), roof = rng.pick(ROOF_TILES);
    addBuildingVolume(ctx, rng, x, z, snap(w, 1), snap(d, 1), CURB_HEIGHT, h, STYLE.house, tint);
    ctx.props.addBox(x, CURB_HEIGHT + h + 0.7 + 1.4, z, w + 1.6, 2.8, d + 1.6, { color: roof, topScale: 0.25 });
    // garage + driveway toward the street
    const gx = x + (w / 2 + 2.4) * (rng.chance(0.5) ? 1 : -1);
    if (Math.abs(gx - x) < cw / 2 - 1) {
      ctx.props.addBox(gx, CURB_HEIGHT + 1.5, z, 4.6, 3, 6, { color: [tint[0] * 0.9, tint[1] * 0.9, tint[2] * 0.9] });
      addStaticBox(gx - 2.3, z - 3, gx + 2.3, z + 3, 3);
      const dz = z + side * 8.5;
      ctx.props.addBox(gx, CURB_HEIGHT + 0.04, dz, 4.2, 0.06, 10, { color: [0.62, 0.62, 0.64] });
      if (rng.chance(0.55)) ctx.parkingSpots.push({ x: gx, z: dz - side * 1.5, heading: side < 0 ? Math.PI : 0 });
    }
    if (rng.chance(0.75)) ctx.trees.push({ x: x + rng.range(-5, 5), z: z - side * rng.range(9, 14), s: rng.range(0.8, 1.3) });
    if (rng.chance(0.4)) ctx.palms.push({ x: x + rng.range(-6, 6), z: z + side * rng.range(8, 10) });
    if (rng.chance(0.3)) {   // back-yard pool
      const pz = z - side * 12;
      ctx.props.addBox(x, CURB_HEIGHT + 0.08, pz, 7.5, 0.14, 4.5, { color: [0.92, 0.92, 0.9] });
      ctx.props.addBox(x, CURB_HEIGHT + 0.12, pz, 6.5, 0.14, 3.5, { color: [0.2, 0.72, 0.9] });
    }
  }
}

function addContainerStack(ctx, rng, x, z, along) {
  const levels = rng.int(1, 3), len = 12.2, wid = 2.5;
  for (let l = 0; l < levels; l++) {
    const c = rng.pick(CONTAINER_COLORS);
    ctx.props.addBox(x, CURB_HEIGHT + 1.3 + l * 2.62, z, along ? len : wid, 2.6, along ? wid : len, { color: [c[0] * rng.range(0.8, 1), c[1] * rng.range(0.8, 1), c[2] * rng.range(0.8, 1)] });
  }
  addStaticBox(x - (along ? len : wid) / 2, z - (along ? wid : len) / 2, x + (along ? len : wid) / 2, z + (along ? wid : len) / 2, levels * 2.6);
}

function buildDocksBlock(ctx, rng, block, lot) {
  const cx = (lot.minX + lot.maxX) / 2, W = lot.maxX - lot.minX, D = lot.maxZ - lot.minZ;
  const whD = snap(D * 0.42, 5), whW = snap(W - rng.range(4, 16), 5), h = rng.pick([10, 10, 15]);
  const wz = lot.minZ + whD / 2 + 1;
  const tint = rng.pick([[0.75, 0.8, 0.85], [0.85, 0.7, 0.55], [0.6, 0.72, 0.78], [0.8, 0.8, 0.7], [0.72, 0.5, 0.42]]);
  addBuildingVolume(ctx, rng, cx, wz, whW, whD, CURB_HEIGHT, h, STYLE.warehouse, tint);
  ctx.props.addBox(cx, CURB_HEIGHT + h + 0.7 + 1.2, wz, whW, 2.4, whD, { color: [tint[0] * 0.6, tint[1] * 0.6, tint[2] * 0.6], topScale: 0.55 });
  addSignSlot(ctx, cx, CURB_HEIGHT + h - 2.6, wz - whD / 2 - 0.25, 0, -1, 14, 3.5);
  // container yard on the other half
  const yardZ0 = lot.minZ + whD + 8;
  for (let z = yardZ0; z < lot.maxZ - 5; z += 5.2) for (let x = lot.minX + 8; x < lot.maxX - 7; x += 14.5) {
    if (rng.chance(0.62)) addContainerStack(ctx, rng, x, z, true);
    else if (rng.chance(0.2)) ctx.parkingSpots.push({ x, z, heading: Math.PI / 2 });
  }
  if (rng.chance(0.5)) {    // storage tanks
    const tx = lot.maxX - 8, tz = lot.minZ + whD + 3;
    ctx.tanks.push({ x: tx, z: tz, r: 3, h: 9 });
  }
}

function buildParkBlock(ctx, rng, block, lot) {
  const cx = (lot.minX + lot.maxX) / 2, cz = (lot.minZ + lot.maxZ) / 2, W = lot.maxX - lot.minX, D = lot.maxZ - lot.minZ;
  ctx.grass.addGroundQuad(cx, CURB_HEIGHT + 0.03, cz, W - 1, D - 1, { uRepeat: W / 8, vRepeat: D / 8 });
  ctx.props.addBox(cx, CURB_HEIGHT + 0.05, cz, W, 0.08, 5, { color: [0.86, 0.8, 0.7] });
  ctx.props.addBox(cx, CURB_HEIGHT + 0.05, cz, 5, 0.08, D, { color: [0.86, 0.8, 0.7] });
  ctx.fountains.push({ x: cx, z: cz });
  addStaticBox(cx - 4, cz - 4, cx + 4, cz + 4, 2, 'prop');
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, r = rng.range(16, 32);
    (k % 2 ? ctx.palms : ctx.trees).push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, s: rng.range(0.9, 1.4) });
  }
}

export function generateBlockBuildings(block, rng, ctx) {
  const lot = { minX: block.minX + SIDEWALK, maxX: block.maxX - SIDEWALK, minZ: block.minZ + SIDEWALK, maxZ: block.maxZ - SIDEWALK };
  if (block.i === 4 && block.j === 2) { block.district = 'downtown'; block.park = true; return buildParkBlock(ctx, rng, block, lot); }
  switch (block.district) {
    case 'downtown': return buildDowntownBlock(ctx, rng, block, lot);
    case 'market': return buildMarketBlock(ctx, rng, block, lot);
    case 'beach': return buildBeachBlock(ctx, rng, block, lot);
    case 'suburbs': return buildSuburbBlock(ctx, rng, block, lot);
    default: return buildDocksBlock(ctx, rng, block, lot);
  }
}

/** Buildings on the land outside the street grid: west-side houses, north ridge mid-rises, south wharf sheds. */
export function generateFringeBuildings(rng, ctx) {
  for (let z = -380; z < 330; z += 26) {
    const x = -470, w = rng.range(12, 16), d = rng.range(10, 14), h = rng.chance(0.3) ? 6.8 : 3.4, tint = rng.pick(HOUSE_TINTS);
    addBuildingVolume(ctx, rng, x, z, snap(w, 1), snap(d, 1), CURB_HEIGHT, h, STYLE.house, tint);
    ctx.props.addBox(x, CURB_HEIGHT + h + 2.1, z, w + 1.6, 2.8, d + 1.6, { color: rng.pick(ROOF_TILES), topScale: 0.25 });
    if (rng.chance(0.7)) ctx.trees.push({ x: x + rng.range(-16, -22), z: z + rng.range(-6, 6), s: rng.range(0.9, 1.5) });
    if (rng.chance(0.5)) ctx.palms.push({ x: x + 14, z: z + rng.range(-8, 8) });
  }
  for (let x = -400; x < 420; x += 34) {
    const z = -374, st = ctx.styles[STYLE.apartment];
    if (Math.abs(x + 290) < 40) { ctx.trees.push({ x, z, s: 1.4 }); continue; }   // lookout clearing
    const w = snap(rng.range(18, 26), st.bay), h = snap(rng.range(12, 40), st.floor);
    addBuildingVolume(ctx, rng, x, z, w, 20, CURB_HEIGHT, h, rng.chance(0.5) ? STYLE.apartment : STYLE.office, rng.pick(x > 240 ? DECO_TINTS : MARKET_TINTS));
    ctx.trees.push({ x: x + 17, z: z + rng.range(-6, 6), s: rng.range(1, 1.5) });
  }
  for (let x = -420; x < 400; x += 15) {
    if (Math.abs(x - 100) < 22 || Math.abs(x + 196) < 14 || Math.abs(x + 100) < 14) continue;   // keep mission spots clear
    if (rng.chance(0.55)) addContainerStack(ctx, rng, x, 384 + rng.range(-3, 3), true);
    else if (rng.chance(0.3)) addContainerStack(ctx, rng, x, 372, false);
  }
}
