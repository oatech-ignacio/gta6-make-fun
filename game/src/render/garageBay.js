// Job: the garage interior seen while a garage menu is open. A lit workshop bay (built once, far below the
// city) with the player's car, in its current paint, slowly turning on a turntable under the showroom lights.
// systems/garage.js calls showGarageBay / hideGarageBay; the main loop calls updateGarageBay.
import * as THREE from 'three';
import { game } from '../core/gameState.js';
import { cameraRig } from './followCamera.js';
import { GeometryBatch, buildBatchMesh } from '../world/geometryBatcher.js';
import { createVehicleMesh } from '../vehicles/vehicleMeshFactory.js';

const BAY = new THREE.Vector3(0, -120, 0);
let bay = null, table = null, car = null, savedOverride = null, shown = false;

function signTexture(text) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#12081f'; g.fillRect(0, 0, 1024, 160);
  g.font = 'italic 700 92px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#ff3d8b'; g.shadowBlur = 28; g.fillStyle = '#ffd7ea'; g.fillText(text, 512, 84, 960);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function buildBay() {
  const b = new GeometryBatch(), glow = new GeometryBatch();
  const wall = [0.2, 0.13, 0.3], trim = [0.95, 0.75, 0.2];
  b.addBox(0, -0.1, 0, 34, 0.2, 30, { color: [0.2, 0.21, 0.25] });                  // polished floor
  for (let x = -15; x <= 15; x += 5) b.addBox(x, 0.005, 0, 0.08, 0.02, 30, { color: [0.3, 0.31, 0.36] });
  b.addBox(0, 4.5, -11, 34, 9, 0.4, { color: wall });                                // back wall
  b.addBox(-13, 4.5, 0, 0.4, 9, 30, { color: wall });                                // side walls
  b.addBox(15, 4.5, 0, 0.4, 9, 30, { color: wall });
  b.addBox(0, 9, 0, 34, 0.3, 30, { color: [0.1, 0.08, 0.14] });                      // ceiling
  b.addBox(0, 1.1, -10.7, 34, 0.2, 0.2, { color: trim });
  // tool chests along the back wall, tyre stacks and a two-post lift on the right
  for (let k = 0; k < 4; k++) b.addBox(-10 + k * 2.2, 0.6, -10, 2, 1.2, 1, { color: k % 2 ? [0.85, 0.15, 0.2] : [0.95, 0.3, 0.25] });
  for (let k = 0; k < 4; k++) b.addBox(-10 + k * 2.2, 1.6, -10.2, 2, 0.8, 0.6, { color: [0.3, 0.3, 0.34] });
  for (let s = 0; s < 3; s++) for (let k = 0; k < 4; k++) {
    const g = new THREE.CylinderGeometry(0.55, 0.55, 0.38, 14);
    b.addGeometry(g, new THREE.Matrix4().makeTranslation(-11.4 + s * 1.3, 0.2 + k * 0.4, 4 + s * 0.4), [0.07, 0.07, 0.08]);
  }
  for (const z of [-4.5, 2.5]) { b.addBox(11.2, 2.2, z, 0.5, 4.4, 0.5, { color: [1, 0.82, 0.2] }); }
  b.addBox(11.2, 1.1, -1, 0.3, 0.3, 7, { color: [0.3, 0.3, 0.34] });
  // turntable: dark disc with a glowing rim
  const disc = new THREE.CylinderGeometry(4.3, 4.5, 0.28, 48);
  const tableMesh = new THREE.Mesh(disc, new THREE.MeshStandardMaterial({ color: 0x2b2d35, roughness: 0.3, metalness: 0.6 }));
  tableMesh.position.y = 0.14; tableMesh.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.45, 0.07, 6, 64), new THREE.MeshBasicMaterial({ color: 0x4fe3d6 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.3;
  // ceiling light strips and a neon band on the back wall
  for (const x of [-6, 0, 6]) glow.addBox(x, 8.8, 0, 0.5, 0.1, 18, { color: [1, 0.97, 0.9] });
  glow.addBox(0, 6.6, -10.75, 30, 0.18, 0.1, { color: [1, 0.24, 0.55] });
  glow.addBox(-12.75, 6.6, 0, 0.1, 0.18, 26, { color: [0.3, 0.9, 0.85] });
  const group = new THREE.Group(); group.name = 'garageBay'; group.position.copy(BAY); group.visible = false;
  group.add(buildBatchMesh(b, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 }), { castShadow: false }));
  group.add(buildBatchMesh(glow, new THREE.MeshBasicMaterial({ vertexColors: true })));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), new THREE.MeshBasicMaterial({ map: signTexture('CORAL STRAND CUSTOMS') }));
  sign.position.set(-1.5, 5, -10.75); group.add(sign);
  table = new THREE.Group(); table.add(tableMesh, rim); group.add(table);
  const key = new THREE.PointLight(0xfff1dc, 2.4, 0, 0); key.position.set(3, 7, 5);
  const fill = new THREE.PointLight(0xff5fa2, 0.9, 0, 0); fill.position.set(-8, 5, -6);
  group.add(key, fill);
  game.scene.add(group);
  return group;
}

/** Puts a copy of the vehicle on the turntable and points the camera at it. Call again after a respray. */
export function showGarageBay(v) {
  if (!bay) bay = buildBay();
  if (car) table.remove(car);
  car = createVehicleMesh(v.spec, v.color); car.position.set(0, 0.28, 0); car.rotation.y = 0.6; table.add(car);
  bay.visible = true;
  if (!shown) savedOverride = cameraRig.override;
  shown = true;
  const p = BAY;
  cameraRig.override = { x: p.x + 3.6, y: p.y + 2.3, z: p.z + 6.6, tx: p.x + 2.6, ty: p.y + 1.3, tz: p.z - 0.6, fov: 54 };
}

export function hideGarageBay() {
  if (!shown) return;
  shown = false; bay.visible = false; cameraRig.override = savedOverride; savedOverride = null;
}

export function isGarageBayShown() { return shown; }

export function updateGarageBay(dt) { if (shown && table) table.rotation.y += dt * 0.35; }
