// One-off landmark geometry: Pelican Causeway, the pier and its Ferris wheel, dock cranes, Crane Tower,
// Casa Marfil on Isla Dorada, the lighthouse, beach umbrellas, fountains, storage tanks and place totems.
import * as THREE from 'three';
import { GeometryBatch } from './geometryBatcher.js';
import { addStaticBox } from './collisionGrid.js';
import { CAUSEWAY_Z, CURB_HEIGHT, PLACES, BEACH_X } from './cityLayout.js';
import { SIGN_NAMES } from './neonSigns.js';

function addCylinder(batch, x, y, z, rTop, rBottom, h, color, segs = 10) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, segs);
  batch.addGeometry(g, new THREE.Matrix4().makeTranslation(x, y + h / 2, z), color);
}
function addBeam(batch, ax, ay, az, bx, by, bz, thickness, color) {
  const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
  const len = a.distanceTo(b), g = new THREE.CylinderGeometry(thickness, thickness, len, 5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  batch.addGeometry(g, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)), color);
}

export function buildCauseway(props, beacons) {
  const z = CAUSEWAY_Z, x0 = BEACH_X - 2, x1 = 706, deckColor = [0.7, 0.7, 0.72];
  props.addBox((x0 + x1) / 2, -1.6, z, x1 - x0, 3.0, 19.6, { color: deckColor });
  for (const side of [-1, 1]) {
    props.addBox((x0 + x1) / 2, 0.55, z + side * 9.3, x1 - x0, 1.1, 0.5, { color: [0.92, 0.92, 0.9] });
    props.addBox((x0 + x1) / 2, 1.15, z + side * 9.3, x1 - x0, 0.14, 0.7, { color: [1, 0.45, 0.3] });
    addStaticBox(540, z + side * 9.6 - 0.4, x1 - 6, z + side * 9.6 + 0.4, 1.2, 'rail');
  }
  for (let x = 540; x < 700; x += 26) for (const side of [-1, 1]) addCylinder(props, x, -9, z + side * 6.5, 1.3, 1.5, 8, [0.6, 0.6, 0.62]);
  for (const tx of [576, 652]) {      // twin cable-stay towers
    for (const side of [-1, 1]) {
      props.addBox(tx, 24, z + side * 10.6, 2.6, 52, 2.2, { color: [1, 0.48, 0.32], topScale: 0.7 });
      beacons.push({ x: tx, y: 50.6, z: z + side * 10.6 });
      for (let k = 1; k <= 5; k++) for (const dir of [-1, 1]) {
        addBeam(props, tx, 48 - k * 2.2, z + side * 10.4, tx + dir * k * 7.2, 1.1, z + side * 9.5, 0.09, [0.95, 0.95, 0.95]);
      }
    }
    props.addBox(tx, 40, z, 1.8, 1.8, 21, { color: [1, 0.48, 0.32] });
    props.addBox(tx, 14, z, 1.4, 1.4, 21, { color: [1, 0.48, 0.32] });
  }
}

export function buildPier(props) {
  props.addBox(546, -0.3, 144, 188, 0.6, 16, { color: [0.62, 0.46, 0.3] });
  for (let x = 460; x < 640; x += 12) for (const side of [-1, 1]) addCylinder(props, x, -5, 144 + side * 6.5, 0.35, 0.35, 5, [0.35, 0.26, 0.18], 6);
  for (const side of [-1, 1]) props.addBox(546, 0.9, 144 + side * 7.8, 188, 0.12, 0.12, { color: [0.95, 0.95, 0.9] });
  for (let x = 456; x < 640; x += 6) for (const side of [-1, 1]) props.addBox(x, 0.45, 144 + side * 7.8, 0.12, 0.9, 0.12, { color: [0.95, 0.95, 0.9] });
  // snack shacks
  const colors = [[1, 0.4, 0.55], [0.3, 0.85, 0.8], [1, 0.82, 0.3]];
  colors.forEach((c, i) => {
    props.addBox(560 + i * 14, 1.5, 140, 5, 3, 4, { color: c });
    props.addBox(560 + i * 14, 3.3, 140, 6.2, 0.5, 5.2, { color: [1, 1, 1], topScale: 0.5 });
  });
}

/** The Rueda del Sol: returns a group whose `wheel` child should be rotated every frame. */
export function buildFerrisWheel() {
  const group = new THREE.Group(); group.position.set(628, 0, 144); group.name = 'ferrisWheel';
  const frame = new GeometryBatch(), wheelBatch = new GeometryBatch();
  const R = 21, hubY = 25;
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) addBeam(frame, sx * 9, 0, sz * 4.5, 0, hubY, sz * 2, 0.45, [0.95, 0.95, 1]);
  frame.addBox(0, 0.4, 0, 22, 0.8, 12, { color: [0.3, 0.3, 0.36] });
  for (const sz of [-1.4, 1.4]) {
    const ring = new THREE.TorusGeometry(R, 0.28, 6, 40);
    wheelBatch.addGeometry(ring, new THREE.Matrix4().makeTranslation(0, 0, sz), [1, 0.35, 0.6]);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; addBeam(wheelBatch, 0, 0, sz, Math.cos(a) * R, Math.sin(a) * R, sz, 0.1, [0.95, 0.95, 1]); }
  }
  const cabinColors = [[1, 0.8, 0.2], [0.2, 0.85, 0.85], [1, 0.4, 0.5], [0.6, 0.5, 1]];
  const lightPos = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    wheelBatch.addBox(Math.cos(a) * R, Math.sin(a) * R - 1.2, 0, 2.4, 2.2, 2.2, { color: cabinColors[k % 4], bottom: true });
  }
  for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; lightPos.push(Math.cos(a) * R, Math.sin(a) * R, 1.8, Math.cos(a) * R, Math.sin(a) * R, -1.8); }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 });
  const frameMesh = new THREE.Mesh(frame.build(), mat); frameMesh.castShadow = true;
  const wheel = new THREE.Mesh(wheelBatch.build(), mat); wheel.position.y = hubY; wheel.castShadow = true; wheel.name = 'wheel';
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lightPos, 3));
  const lights = new THREE.Points(lg, new THREE.PointsMaterial({ color: 0xffd9a0, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  lights.name = 'wheelLights'; wheel.add(lights);
  group.add(frameMesh, wheel); group.userData.wheel = wheel;
  return group;
}

export function buildDockCranes(props, beacons) {
  for (const cx of [-330, -10, 250]) {
    const z = 386, red = [0.85, 0.25, 0.15], white = [0.92, 0.92, 0.9];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) props.addBox(cx + sx * 9, 16, z + sz * 7, 1.5, 32, 1.5, { color: red });
    props.addBox(cx, 32.5, z, 21, 2, 16.5, { color: red });
    props.addBox(cx, 36, z + 16, 3.2, 3, 62, { color: white });
    props.addBox(cx, 39.5, z - 2, 6, 5, 7, { color: white });
    addBeam(props, cx, 48, z - 2, cx, 37.5, z + 44, 0.18, red); addBeam(props, cx, 48, z - 2, cx, 34, z - 9, 0.18, red);
    props.addBox(cx, 43, z - 2, 1.2, 10, 1.2, { color: red });
    beacons.push({ x: cx, y: 48.6, z: z - 2 });
    for (const sx of [-1, 1]) addStaticBox(cx + sx * 9 - 1, z - 8, cx + sx * 9 + 1, z + 8, 30, 'prop');
  }
}

/** Crane Tower: the tallest building downtown, with a stepped crown and a lit spire. */
export function buildCraneTower(ctx, rng, addBuildingVolume) {
  const cx = 96, cz = 0, base = CURB_HEIGHT;
  ctx.facades[6].addBox(cx, base + 5, cz, 62, 10, 62, { color: [1, 1, 1], top: false, uPerMeter: 1 / 40, vPerMeter: 1 / 80 });
  ctx.props.addBox(cx, base + 10.3, cz, 64, 0.6, 64, { color: [0.18, 0.18, 0.22] });
  addStaticBox(cx - 31, cz - 31, cx + 31, cz + 31, 10);
  let y = base + 10.6, w = 41.6;
  const tint = [1, 0.86, 0.7];
  for (const h of [90, 50.4, 28.8]) { addBuildingVolume(ctx, rng, cx, cz, w, w, y, h, 0, tint, false); y += h + 0.7; w = Math.round((w * 0.74) / 3.2) * 3.2; }
  ctx.props.addBox(cx, y + 4, cz, 9, 8, 9, { color: [0.85, 0.75, 0.6], topScale: 0.5 });
  ctx.props.addBox(cx, y + 26, cz, 1.1, 36, 1.1, { color: [0.9, 0.9, 0.95], topScale: 0.3 });
  ctx.beacons.push({ x: cx, y: y + 44.5, z: cz });
  const craneIndex = SIGN_NAMES.indexOf('CRANE TOWER');
  ctx.signSlots.push({ x: cx, y: y - 6, z: cz + w / 2 + 2.2, nx: 0, nz: 1, w: 22, h: 5.5, nameIndex: craneIndex });
  ctx.signSlots.push({ x: cx - w / 2 - 2.2, y: y - 6, z: cz, nx: -1, nz: 0, w: 22, h: 5.5, nameIndex: craneIndex });
  ctx.signSlots.push({ x: cx + w / 2 + 2.2, y: y - 6, z: cz, nx: 1, nz: 0, w: 22, h: 5.5, nameIndex: craneIndex });
  ctx.skyline.push({ x: cx, z: cz, h: y + 44 });
}

export function buildIslandEstate(ctx, rng, addBuildingVolume) {
  const cx = 815, cz = CAUSEWAY_Z;
  // Casa Marfil: white mansion with a colonnade
  addBuildingVolume(ctx, rng, cx + 18, cz, 22, 54, 0.1, 10.2, 5, [1, 0.98, 0.92]);
  ctx.props.addBox(cx + 18, 12.6, cz, 24, 3.4, 56, { color: [0.75, 0.36, 0.24], topScale: 0.4 });
  addBuildingVolume(ctx, rng, cx + 14, cz, 16, 20, 10.4, 6.8, 5, [1, 0.98, 0.92], false);
  ctx.props.addBox(cx + 14, 19.4, cz, 18, 3, 22, { color: [0.75, 0.36, 0.24], topScale: 0.3 });
  for (let k = -4; k <= 4; k++) addCylinder(ctx.props, cx + 5.5, 0.1, cz + k * 5.5, 0.45, 0.5, 8.4, [1, 1, 0.97], 10);
  ctx.props.addBox(cx + 6.5, 8.9, cz, 4, 0.8, 50, { color: [1, 1, 0.97] });
  ctx.props.addBox(cx - 22, 0.12, cz, 26, 0.16, 16, { color: [0.95, 0.94, 0.9] });   // pool deck
  ctx.props.addBox(cx - 22, 0.16, cz, 20, 0.16, 10, { color: [0.15, 0.7, 0.9] });
  // perimeter wall with a gate gap on the causeway axis
  for (const side of [-1, 1]) {
    ctx.props.addBox(742, 1.4, cz + side * 50, 0.8, 2.8, 76, { color: [0.96, 0.93, 0.86] });
    addStaticBox(741.5, cz + side * 50 - 38, 742.5, cz + side * 50 + 38, 2.8, 'wall');
    ctx.props.addBox(742, 2.4, cz + side * 11.4, 1.6, 4.8, 1.6, { color: [0.96, 0.93, 0.86] });
  }
  for (let k = 0; k < 26; k++) ctx.palms.push({ x: rng.range(712, 872), z: cz + rng.sign() * rng.range(22, 88), s: rng.range(0.9, 1.3) });
  for (let x = 712; x < 790; x += 13) for (const side of [-1, 1]) ctx.palms.push({ x, z: cz + side * 11 });
  // lighthouse on the north tip
  const lx = 862, lz = cz - 82;
  addCylinder(ctx.props, lx, 0, lz, 2.2, 3.4, 26, [1, 1, 1], 12);
  addCylinder(ctx.props, lx, 8, lz, 2.95, 3.1, 4, [0.9, 0.2, 0.2], 12);
  addCylinder(ctx.props, lx, 18, lz, 2.45, 2.6, 4, [0.9, 0.2, 0.2], 12);
  addCylinder(ctx.props, lx, 26, lz, 3.2, 3.2, 0.5, [0.2, 0.2, 0.25], 12);
  addCylinder(ctx.props, lx, 26.5, lz, 1.6, 1.6, 3, [1, 0.95, 0.6], 8);
  addCylinder(ctx.props, lx, 29.5, lz, 0.2, 2.4, 2.2, [0.9, 0.2, 0.2], 12);
  addStaticBox(lx - 3, lz - 3, lx + 3, lz + 3, 26, 'prop');
  ctx.beacons.push({ x: lx, y: 28, z: lz, color: 0xfff2b0, size: 9 });
}

export function buildBeachProps(props, rng) {
  const colors = [[1, 0.35, 0.45], [0.25, 0.8, 0.85], [1, 0.85, 0.25], [1, 0.55, 0.2], [0.95, 0.95, 0.95], [0.6, 0.45, 1]];
  for (let k = 0; k < 90; k++) {
    const x = rng.range(BEACH_X + 6, 506), z = rng.range(-390, 390);
    if (Math.abs(z - CAUSEWAY_Z) < 16 || Math.abs(z - 144) < 14) continue;
    const y = x > 470 ? -(x - 470) / 90 * 2 : 0, c = rng.pick(colors);
    props.addBox(x, y + 1.1, z, 0.08, 2.2, 0.08, { color: [0.9, 0.9, 0.9] });
    const cone = new THREE.ConeGeometry(1.9, 0.75, 8);
    props.addGeometry(cone, new THREE.Matrix4().makeTranslation(x, y + 2.4, z), c);
    props.addBox(x + 1.4, y + 0.06, z + rng.range(-1, 1), 0.9, 0.05, 2, { color: rng.pick(colors), rotY: rng() * 3 });
  }
  for (const z of [-300, -60, 60, 300]) {     // lifeguard towers
    const x = 486, y = -0.36;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) props.addBox(x + sx * 1.3, y + 1.2, z + sz * 1.3, 0.2, 2.4, 0.2, { color: [0.95, 0.95, 0.95] });
    props.addBox(x, y + 2.5, z, 3.6, 0.2, 3.6, { color: [0.95, 0.95, 0.95] });
    props.addBox(x - 0.3, y + 3.6, z, 2.6, 2, 2.8, { color: [1, 0.5, 0.2] });
    props.addBox(x - 0.3, y + 4.75, z, 3.4, 0.25, 3.6, { color: [0.2, 0.75, 0.8] });
  }
}

export function buildFountainsAndTanks(ctx) {
  for (const f of ctx.fountains) {
    addCylinder(ctx.props, f.x, CURB_HEIGHT, f.z, 4.2, 4.4, 0.8, [0.86, 0.84, 0.8], 16);
    addCylinder(ctx.props, f.x, CURB_HEIGHT + 0.7, f.z, 3.8, 3.8, 0.15, [0.25, 0.7, 0.88], 16);
    addCylinder(ctx.props, f.x, CURB_HEIGHT, f.z, 0.5, 0.8, 3.2, [0.86, 0.84, 0.8], 8);
    addCylinder(ctx.props, f.x, CURB_HEIGHT + 3.2, f.z, 1.6, 0.4, 0.4, [0.86, 0.84, 0.8], 10);
  }
  for (const t of ctx.tanks) {
    addCylinder(ctx.props, t.x, CURB_HEIGHT, t.z, t.r, t.r, t.h, [0.88, 0.88, 0.85], 14);
    addStaticBox(t.x - t.r, t.z - t.r, t.x + t.r, t.z + t.r, t.h, 'prop');
  }
}

/** A lit totem with the venue name beside each mission/shop location. */
export function buildPlaceTotems(ctx) {
  const map = { safehouse: 'SOL Y SOMBRA', bait: 'SURF SHACK', club: 'LUNA LOUNGE', chopShop: "ODETTE'S AUTO", gunShop: 'IRON PELICAN', bank: 'BANCO AURORA', taxiDepot: 'SUNFARE CABS', respray: "ODETTE'S AUTO" };
  for (const [key, signName] of Object.entries(map)) {
    const p = PLACES[key];
    // offset the totem away from the kerb so the marker itself stays clear
    const ox = p.x + Math.cos(p.heading) * 0 + (key === 'club' || key === 'taxiDepot' ? 7 : 0), oz = p.z + (key === 'club' || key === 'taxiDepot' ? 0 : 7);
    ctx.props.addBox(ox, CURB_HEIGHT + 2.6, oz, 0.5, 5.2, 0.5, { color: [0.15, 0.15, 0.2] });
    const horizontalRoad = key === 'club' || key === 'taxiDepot' || key === 'chopShop' || key === 'respray';
    const idx = SIGN_NAMES.indexOf(signName);
    const n = horizontalRoad ? { nx: 0, nz: 1 } : { nx: 1, nz: 0 };
    ctx.signSlots.push({ x: ox + n.nx * 0.2, y: CURB_HEIGHT + 6.2, z: oz + n.nz * 0.2, nx: n.nx, nz: n.nz, w: 8, h: 2, nameIndex: idx, doubleSided: true });
  }
}
