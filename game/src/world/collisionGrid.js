// Uniform grid of static axis-aligned boxes (buildings, props): circle push-out, ray casts, line of sight.
const CELL = 32;
const cells = new Map();
const boxes = [];
let queryStamp = 0;

function key(cx, cz) { return cx * 4096 + cz; }

export function clearStaticColliders() { cells.clear(); boxes.length = 0; }

export function addStaticBox(minX, minZ, maxX, maxZ, height = 10, kind = 'building') {
  const box = { minX, minZ, maxX, maxZ, height, kind, stamp: 0 };
  boxes.push(box);
  for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
    for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
      const k = key(cx, cz);
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(box);
    }
  }
  return box;
}

export function getStaticBoxes() { return boxes; }

/** Push a circle out of every box it overlaps. Mutates pos {x,z}; returns the last contact normal or null. */
export function resolveCircleAgainstStatics(pos, radius) {
  let hit = null;
  const x0 = Math.floor((pos.x - radius) / CELL), x1 = Math.floor((pos.x + radius) / CELL);
  const z0 = Math.floor((pos.z - radius) / CELL), z1 = Math.floor((pos.z + radius) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
    const list = cells.get(key(cx, cz));
    if (!list) continue;
    for (const b of list) {
      const nx = Math.max(b.minX, Math.min(pos.x, b.maxX)), nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      let dx = pos.x - nx, dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2); dx /= d; dz /= d;
        pos.x = nx + dx * radius; pos.z = nz + dz * radius;
        hit = { nx: dx, nz: dz };
      } else {
        // centre is inside the box: leave through the nearest face
        const l = pos.x - b.minX, r = b.maxX - pos.x, t = pos.z - b.minZ, bt = b.maxZ - pos.z;
        const m = Math.min(l, r, t, bt);
        if (m === l) { pos.x = b.minX - radius; hit = { nx: -1, nz: 0 }; }
        else if (m === r) { pos.x = b.maxX + radius; hit = { nx: 1, nz: 0 }; }
        else if (m === t) { pos.z = b.minZ - radius; hit = { nx: 0, nz: -1 }; }
        else { pos.z = b.maxZ + radius; hit = { nx: 0, nz: 1 }; }
      }
    }
  }
  return hit;
}

export function isPointInsideStatic(x, z, margin = 0) {
  const list = cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!list) return false;
  for (const b of list) if (x > b.minX - margin && x < b.maxX + margin && z > b.minZ - margin && z < b.maxZ + margin) return true;
  return false;
}

/** 2D ray against the static boxes. Returns hit distance (<= maxDist) or Infinity. Boxes lower than minHeight are ignored. */
export function raycastStatics(ox, oz, dx, dz, maxDist, minHeight = 0) {
  queryStamp++;
  let best = Infinity;
  const steps = Math.ceil(maxDist / (CELL * 0.5));
  for (let s = 0; s <= steps; s++) {
    const t = Math.min(maxDist, s * CELL * 0.5);
    const cx = Math.floor((ox + dx * t) / CELL), cz = Math.floor((oz + dz * t) / CELL);
    for (let ax = -1; ax <= 1; ax++) for (let az = -1; az <= 1; az++) {
      const list = cells.get(key(cx + ax, cz + az));
      if (!list) continue;
      for (const b of list) {
        if (b.stamp === queryStamp) continue;
        b.stamp = queryStamp;
        if (b.height < minHeight) continue;
        const d = rayBoxDistance(ox, oz, dx, dz, b);
        if (d < best) best = d;
      }
    }
    if (best <= t) break;
  }
  return best <= maxDist ? best : Infinity;
}

function rayBoxDistance(ox, oz, dx, dz, b) {
  let tmin = 0, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) { if (ox < b.minX || ox > b.maxX) return Infinity; }
  else {
    let t1 = (b.minX - ox) / dx, t2 = (b.maxX - ox) / dx;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dz) < 1e-9) { if (oz < b.minZ || oz > b.maxZ) return Infinity; }
  else {
    let t1 = (b.minZ - oz) / dz, t2 = (b.maxZ - oz) / dz;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

export function hasLineOfSight(ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az);
  if (d < 0.5) return true;
  return raycastStatics(ax, az, (bx - ax) / d, (bz - az) / d, d, 3) === Infinity;
}
