// Static description of Palmera Bay: the street grid, districts, land outline and named places.
import { clamp } from '../core/mathUtils.js';

export const GRID_X = [-432, -336, -240, -144, -48, 48, 144, 240, 336, 432];   // north-south avenues
export const GRID_Z = [-336, -240, -144, -48, 48, 144, 240, 336];             // east-west streets
export const ROAD_HALF = 8;          // half road width (4 lanes)
export const SIDEWALK = 4;           // sidewalk depth inside each block
export const CURB_HEIGHT = 0.16;
export const LANE_OFFSETS = [2.0, 5.5];
export const CAUSEWAY_Z = GRID_Z[2];
export const WATER_LEVEL = -1.2;

export const AVENUE_NAMES = ['Heron Ave', 'Mangrove Ave', 'Hibiscus Ave', 'Tangelo Ave', 'Aurora Ave', 'Marquee Ave', 'Saffron Ave', 'Lagoon Ave', 'Flamingo Way', 'Corsair Boulevard'];
export const STREET_NAMES = ['Mirador St', 'Azucar St', 'Causeway Drive', 'Neon Row', 'Paloma St', 'Cutlass St', 'Rustwater Rd', 'Wharf Line'];

// Walkable / drivable land is the union of these rectangles (everything else is ocean).
export const LAND_RECTS = [
  { name: 'mainland', minX: -500, maxX: 528, minZ: -400, maxZ: 400 },
  { name: 'causeway', minX: 520, maxX: 708, minZ: CAUSEWAY_Z - 9.5, maxZ: CAUSEWAY_Z + 9.5 },
  { name: 'island', minX: 700, maxX: 880, minZ: CAUSEWAY_Z - 95, maxZ: CAUSEWAY_Z + 95 },
  { name: 'pier', minX: 520, maxX: 640, minZ: 136, maxZ: 152 },
];
export const BEACH_X = 452;          // sand starts east of the boulevard promenade
export const WORLD_BOUNDS = { minX: -560, maxX: 920, minZ: -460, maxZ: 460 };

export const DISTRICTS = {
  suburbs: { key: 'suburbs', name: 'Hibiscus Heights', tagline: 'Lawns, pools and nosy neighbours', color: '#7bd67b' },
  downtown: { key: 'downtown', name: 'Neon Row', tagline: 'Downtown Palmera', color: '#ff5fa2' },
  market: { key: 'market', name: 'Azucar Market', tagline: 'Old town', color: '#ffb347' },
  beach: { key: 'beach', name: 'Coral Strand', tagline: 'Hotels on the boulevard', color: '#4fe3d6' },
  docks: { key: 'docks', name: 'Rustwater Docks', tagline: 'Port of Palmera', color: '#9aa7c7' },
  island: { key: 'island', name: 'Isla Dorada', tagline: 'Old money, new fences', color: '#ffe27a' },
  causeway: { key: 'causeway', name: 'Pelican Causeway', tagline: 'Toll free since the incident', color: '#cfd8ff' },
  sea: { key: 'sea', name: 'Palmera Bay', tagline: 'Open water', color: '#2a7fbf' },
};

export function districtKeyForBlock(i, j) {
  if (j >= 5) return 'docks';
  if (i >= 7) return 'beach';
  if (i <= 2) return 'suburbs';
  if (j === 0) return 'market';
  return 'downtown';
}

export function getDistrictAt(x, z) {
  if (x > 700) return DISTRICTS.island;
  if (x > 528) return (Math.abs(z - CAUSEWAY_Z) < 12 ? DISTRICTS.causeway : DISTRICTS.sea);
  if (x < -500 || z < -400 || z > 400) return DISTRICTS.sea;
  if (x > BEACH_X - 20) return DISTRICTS.beach;
  let i = 0; while (i < 8 && x > GRID_X[i + 1]) i++;
  let j = 0; while (j < 6 && z > GRID_Z[j + 1]) j++;
  return DISTRICTS[districtKeyForBlock(i, j)];
}

export function nearestStreetName(x, z) {
  let bi = 0, bd = 1e9, bj = 0, be = 1e9;
  GRID_X.forEach((gx, i) => { const d = Math.abs(x - gx); if (d < bd) { bd = d; bi = i; } });
  GRID_Z.forEach((gz, j) => { const d = Math.abs(z - gz); if (d < be) { be = d; bj = j; } });
  return bd < be ? AVENUE_NAMES[bi] : STREET_NAMES[bj];
}

/** True when the point is on asphalt of the street grid (not inside a city block). */
export function isOnRoad(x, z) {
  if (x > GRID_X[9] + ROAD_HALF) return Math.abs(z - CAUSEWAY_Z) < ROAD_HALF && x < 800;
  if (x < GRID_X[0] - ROAD_HALF || z < GRID_Z[0] - ROAD_HALF || z > GRID_Z[7] + ROAD_HALF) return false;
  for (const gx of GRID_X) if (Math.abs(x - gx) <= ROAD_HALF) return true;
  for (const gz of GRID_Z) if (Math.abs(z - gz) <= ROAD_HALF) return true;
  return false;
}

export function groundHeightAt(x, z) {
  if (x > BEACH_X) return 0;
  if (x < -500 || z < -400 || z > 400) return 0;
  return isOnRoad(x, z) ? 0 : CURB_HEIGHT;
}

export function isOnLand(x, z, margin = 0) {
  for (const r of LAND_RECTS) if (x >= r.minX + margin && x <= r.maxX - margin && z >= r.minZ + margin && z <= r.maxZ - margin) return true;
  return false;
}

/** Push a point back onto the land union; returns true when it had to be moved (hit the shoreline rail). */
export function constrainToLand(pos, radius = 0.5) {
  if (isOnLand(pos.x, pos.z, radius * 0.5)) return false;
  let best = null, bestD = 1e12;
  for (const r of LAND_RECTS) {
    const cx = clamp(pos.x, r.minX + radius, r.maxX - radius), cz = clamp(pos.z, r.minZ + radius, r.maxZ - radius);
    const d = (cx - pos.x) ** 2 + (cz - pos.z) ** 2;
    if (d < bestD) { bestD = d; best = { x: cx, z: cz }; }
  }
  pos.x = best.x; pos.z = best.z;
  return true;
}

// Named places used by missions, shops, respawns and the map legend.
export const PLACES = {
  safehouse: { name: 'Sol y Sombra Motel', x: 421, z: 20, icon: 'H', color: '#6dff8f', heading: Math.PI / 2 },
  hospital: { name: 'Santa Brisa Medical', x: 59, z: -290, icon: '+', color: '#ff6b6b', heading: Math.PI / 2 },
  policeStation: { name: 'Bay Patrol HQ', x: -133, z: 60, icon: 'P', color: '#5b8cff', heading: Math.PI / 2 },
  bait: { name: "Benny's Bait & Tackle", x: 421, z: 200, icon: 'B', color: '#ffd166', heading: Math.PI / 2 },
  club: { name: 'Luna Lounge', x: 200, z: -37, icon: 'L', color: '#ff5fa2', heading: 0 },
  chopShop: { name: "Odette's Auto", x: -196, z: 347, icon: 'O', color: '#ff9f43', heading: Math.PI },
  gunShop: { name: 'Iron Pelican Arms', x: 155, z: 100, icon: 'G', color: '#ff5d5d', heading: Math.PI / 2 },
  bank: { name: 'Banco Aurora', x: 37, z: -100, icon: '$', color: '#6dff8f', heading: -Math.PI / 2 },
  mansion: { name: 'Casa Marfil', x: 790, z: CAUSEWAY_Z, icon: 'M', color: '#ffe27a', heading: Math.PI / 2 },
  warehouse: { name: 'Pier 9 Warehouse', x: 100, z: 372, icon: 'W', color: '#9aa7c7', heading: 0 },
  taxiDepot: { name: 'Sunfare Cab Depot', x: -38, z: 250, icon: 'T', color: '#ffe14d', heading: 0 },
  raceStart: { name: 'Boulevard Sprint', x: 437.5, z: -290, icon: 'R', color: '#c77dff', heading: 0 },
  respray: { name: "Odette's Respray", x: -100, z: 347, icon: 'S', color: '#4fe3d6', heading: Math.PI },
  lookout: { name: 'Mirador Lookout', x: -290, z: -372, icon: 'V', color: '#ffffff', heading: 0 },
};

export function listCityBlocks() {
  const blocks = [];
  for (let j = 0; j < GRID_Z.length - 1; j++) for (let i = 0; i < GRID_X.length - 1; i++) {
    blocks.push({
      i, j, district: districtKeyForBlock(i, j),
      minX: GRID_X[i] + ROAD_HALF, maxX: GRID_X[i + 1] - ROAD_HALF,
      minZ: GRID_Z[j] + ROAD_HALF, maxZ: GRID_Z[j + 1] - ROAD_HALF,
    });
  }
  return blocks;
}
