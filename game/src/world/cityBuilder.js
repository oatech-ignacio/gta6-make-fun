// Assembles Palmera Bay: ground, roads, sidewalks, every block's buildings, props, landmarks, ocean and sky.
import * as THREE from 'three';
import { GeometryBatch, buildBatchMesh } from './geometryBatcher.js';
import { GRID_X, GRID_Z, ROAD_HALF, CURB_HEIGHT, CAUSEWAY_Z, BEACH_X, listCityBlocks, PLACES } from './cityLayout.js';
import { buildRoadNetwork } from './roadNetwork.js';
import { clearStaticColliders, addStaticBox, isPointInsideStatic } from './collisionGrid.js';
import { createFacadeTextureSet, createFacadeMaterial } from './facadeTextures.js';
import { createRoadSegmentTexture, createIntersectionTexture, createSidewalkTexture, createSandTexture, createGrassTexture, createConcreteTexture, getGlowTexture } from './roadTextures.js';
import { generateBlockBuildings, generateFringeBuildings, addBuildingVolume } from './buildingGenerator.js';
import { buildNeonSigns } from './neonSigns.js';
import { buildPalmTrees, buildBroadleafTrees } from './palmTrees.js';
import { layoutStreetLights, buildStreetLights } from './streetLights.js';
import { buildCauseway, buildPier, buildFerrisWheel, buildDockCranes, buildCraneTower, buildIslandEstate, buildBeachProps, buildFountainsAndTanks, buildPlaceTotems } from './landmarks.js';
import { buildOcean } from './ocean.js';
import { createSkyDome } from './skyDome.js';

function buildGround(scene, network) {
  const roads = new GeometryBatch(), crossings = new GeometryBatch(), walks = new GeometryBatch(), sand = new GeometryBatch(), concrete = new GeometryBatch(), grass = new GeometryBatch();
  // asphalt base under the whole mainland so no gaps show between quads
  concrete.addGroundQuad(-24, -0.06, 0, 960, 804, { color: [0.36, 0.37, 0.4], uRepeat: 60, vRepeat: 50 });
  for (const e of network.edges) {
    const a = network.nodes[e.a], b = network.nodes[e.b];
    const len = e.length - ROAD_HALF * 2, cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
    if (e.horizontal) roads.addGroundQuad(cx, 0, cz, 16, len, { rotY: Math.PI / 2, uRepeat: 1, vRepeat: len / 16 });
    else roads.addGroundQuad(cx, 0, cz, 16, len, { uRepeat: 1, vRepeat: len / 16 });
  }
  for (const n of network.nodes) {
    if (n.signal) crossings.addGroundQuad(n.x, 0.005, n.z, 16, 16);
    else roads.addGroundQuad(n.x, 0, n.z, 16, 16, { rotY: Math.PI / 2, uRepeat: 1, vRepeat: 1 });
  }
  roads.addGroundQuad(848, 0.0, CAUSEWAY_Z, 16, 100, { rotY: Math.PI / 2, uRepeat: 1, vRepeat: 100 / 16 });   // island drive
  // sidewalk slabs: one per block plus the fringes around the grid
  for (const b of listCityBlocks()) {
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    walks.addBox((b.minX + b.maxX) / 2, CURB_HEIGHT / 2 - 0.2, (b.minZ + b.maxZ) / 2, w, CURB_HEIGHT + 0.4, d, { topU: w / 4, topV: d / 4, uPerMeter: 0.25, vPerMeter: 0.25 });
  }
  const gx0 = GRID_X[0] - ROAD_HALF, gx1 = GRID_X[9] + ROAD_HALF, gz0 = GRID_Z[0] - ROAD_HALF, gz1 = GRID_Z[7] + ROAD_HALF;
  const slab = (batch, minX, maxX, minZ, maxZ, rep) => batch.addBox((minX + maxX) / 2, CURB_HEIGHT / 2 - 0.2, (minZ + maxZ) / 2, maxX - minX, CURB_HEIGHT + 0.4, maxZ - minZ, { topU: (maxX - minX) / rep, topV: (maxZ - minZ) / rep, uPerMeter: 1 / rep, vPerMeter: 1 / rep });
  slab(grass, -504, gx0, -404, 404, 8);                       // west lawns
  slab(grass, gx0, gx1 + 12, -404, gz0, 8);                   // north ridge
  slab(walks, gx0, gx1 + 12, gz1, 404, 4);                    // south wharf
  // boulevard promenade, split around the causeway approach
  slab(walks, gx1, gx1 + 12, gz0, CAUSEWAY_Z - ROAD_HALF, 4);
  slab(walks, gx1, gx1 + 12, CAUSEWAY_Z + ROAD_HALF, gz1, 4);
  // beach: flat strip then a slope into the water
  sand.addGroundQuad(BEACH_X + 9, 0.02, 0, 18.5, 808, { uRepeat: 3, vRepeat: 120 });
  const slopePos = [[470, 0.02, 404], [575, -2.31, 404], [575, -2.31, -404], [470, 0.02, -404]];
  for (const idx of [0, 1, 2, 0, 2, 3]) { const p = slopePos[idx]; sand.pos.push(p[0], p[1], p[2]); sand.nor.push(0.02, 1, 0); sand.uv.push((p[0] - 470) / 6, p[2] / 6.5); sand.col.push(1, 1, 1); }
  // island ground
  sand.addBox(790, -1.58, CAUSEWAY_Z, 184, 3.1, 194, { topU: 30, topV: 30, color: [0.95, 0.95, 0.9] });
  grass.addGroundQuad(800, 0.08, CAUSEWAY_Z - 52, 150, 80, { uRepeat: 18, vRepeat: 10 });
  grass.addGroundQuad(800, 0.08, CAUSEWAY_Z + 52, 150, 80, { uRepeat: 18, vRepeat: 10 });
  // sea wall skirt around the mainland
  concrete.addBox(-24, -1.6, 0, 964, 3.0, 812, { color: [0.6, 0.6, 0.62], top: false, uPerMeter: 0.1, vPerMeter: 0.3 });

  const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0, vertexColors: true, ...extra });
  const roadTex = createRoadSegmentTexture();
  const meshes = [
    buildBatchMesh(concrete, std(createConcreteTexture())),
    buildBatchMesh(roads, std(roadTex, { roughness: 0.78, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
    buildBatchMesh(crossings, std(createIntersectionTexture(), { roughness: 0.78, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    buildBatchMesh(walks, std(createSidewalkTexture())),
    buildBatchMesh(sand, std(createSandTexture(), { roughness: 1 })),
  ];
  for (const m of meshes) scene.add(m);
  return { grass };
}

function layoutRoadsidePalms(ctx, rng) {
  const off = ROAD_HALF + 2.2;
  const along = (fixed, from, to, vertical, step, sides) => {
    for (let t = from; t <= to; t += step) {
      const grid = vertical ? GRID_Z : GRID_X;
      if (grid.some((g) => Math.abs(t - g) < ROAD_HALF + 4)) continue;
      for (const s of sides) ctx.palms.push(vertical ? { x: fixed + s * off, z: t + rng.range(-0.6, 0.6) } : { x: t + rng.range(-0.6, 0.6), z: fixed + s * off });
    }
  };
  along(GRID_X[9], -330, 330, true, 11, [-1, 1]);          // Corsair Boulevard, both kerbs
  along(GRID_X[9], -330, 330, true, 22, [2.2]);            // second row on the promenade
  along(GRID_X[8], -330, 330, true, 16, [-1, 1]);
  along(GRID_Z[3], -230, 420, false, 16, [-1, 1]);         // Neon Row
  along(GRID_Z[2], 150, 420, false, 16, [-1, 1]);          // Causeway Drive
  along(GRID_X[5], -230, 230, true, 24, [-1, 1]);
  along(GRID_X[2], -330, 330, true, 32, [1]);
  along(GRID_Z[5], -420, 420, false, 32, [-1]);
  for (let k = 0; k < 70; k++) ctx.palms.push({ x: rng.range(BEACH_X + 3, 468), z: rng.range(-395, 395), s: rng.range(0.9, 1.4) });
}

function buildBeacons(beacons) {
  const pos = []; for (const b of beacons) pos.push(b.x, b.y, b.z);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const points = new THREE.Points(g, new THREE.PointsMaterial({ map: getGlowTexture(), color: 0xff3040, size: 6, sizeAttenuation: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  points.name = 'roofBeacons';
  return points;
}

/** Builds the whole city into the scene and returns handles other systems need. */
export function buildCity(scene, rng) {
  clearStaticColliders();
  const network = buildRoadNetwork();
  const styles = createFacadeTextureSet(7);
  const ground = buildGround(scene, network);
  const ctx = {
    styles, facades: styles.map(() => new GeometryBatch()), props: new GeometryBatch(), grass: ground.grass,
    signSlots: [], palms: [], trees: [], parkingSpots: [], beacons: [], skyline: [], fountains: [], tanks: [],
  };
  const blocks = listCityBlocks();
  for (const block of blocks) {
    if (block.i === 5 && block.j === 3) { block.landmark = 'Crane Tower'; buildCraneTower(ctx, rng, addBuildingVolume); continue; }
    generateBlockBuildings(block, rng, ctx);
  }
  generateFringeBuildings(rng, ctx);
  buildCauseway(ctx.props, ctx.beacons);
  buildPier(ctx.props);
  buildDockCranes(ctx.props, ctx.beacons);
  buildIslandEstate(ctx, rng, addBuildingVolume);
  buildBeachProps(ctx.props, rng);
  buildFountainsAndTanks(ctx);
  buildPlaceTotems(ctx);
  layoutRoadsidePalms(ctx, rng);

  const facadeMaterials = styles.map((s) => createFacadeMaterial(s));
  ctx.facades.forEach((batch, i) => { if (batch.vertexCount) scene.add(buildBatchMesh(batch, facadeMaterials[i], { castShadow: true })); });
  scene.add(buildBatchMesh(ctx.props, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.05 }), { castShadow: true }));
  scene.add(buildBatchMesh(ctx.grass, new THREE.MeshStandardMaterial({ map: createGrassTexture(), vertexColors: true, roughness: 1 })));

  const signs = buildNeonSigns(ctx.signSlots, rng); scene.add(signs);
  const nearPlace = (p) => Object.values(PLACES).some((pl) => (pl.x - p.x) ** 2 + (pl.z - p.z) ** 2 < 36);
  const palmList = ctx.palms.filter((p) => !isPointInsideStatic(p.x, p.z, 0.6) && !nearPlace(p));
  scene.add(buildPalmTrees(palmList, rng));
  scene.add(buildBroadleafTrees(ctx.trees.filter((p) => !isPointInsideStatic(p.x, p.z, 1)), rng));
  for (const p of palmList) addStaticBox(p.x - 0.3, p.z - 0.3, p.x + 0.3, p.z + 0.3, 2.5, 'trunk');
  const lamps = layoutStreetLights(network);
  scene.add(buildStreetLights(lamps));
  const beacons = buildBeacons(ctx.beacons); scene.add(beacons);
  const ferris = buildFerrisWheel(); scene.add(ferris);
  scene.add(buildOcean());
  const sky = createSkyDome(); scene.add(sky);

  const parkingSpots = ctx.parkingSpots.filter((p) => !isPointInsideStatic(p.x, p.z, 2.5));
  return { network, blocks, places: PLACES, parkingSpots, lamps, signs, sky, beacons, ferris, facadeMaterials, skyline: ctx.skyline };
}

export function updateCityAnimations(city, dt) {
  if (city.ferris) city.ferris.userData.wheel.rotation.z += dt * 0.08;
}
