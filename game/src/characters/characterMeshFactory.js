// Low-poly humanoids built from tapered boxes: a merged torso/head mesh plus pivoted arms and legs
// so they can be animated. Looks (skin, clothes, hair, hats, uniforms) are data, geometry is cached per look.
import * as THREE from 'three';
import { GeometryBatch } from '../world/geometryBatcher.js';

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.4, metalness: 0.6 });
const cache = new Map();
function rgb(hex, m = 1) { const c = new THREE.Color(hex); return [c.r * m, c.g * m, c.b * m]; }

function buildGeometries(look) {
  const key = JSON.stringify(look);
  if (cache.has(key)) return cache.get(key);
  const skin = rgb(look.skin), shirt = rgb(look.shirt), pants = rgb(look.pants), hair = rgb(look.hair), shoes = rgb(look.shoes || 0x222222);
  const torso = new GeometryBatch();
  const tw = look.belly ? 0.56 : 0.48;
  torso.addBox(0, 1.2, 0, tw, 0.64, look.belly ? 0.36 : 0.27, { color: look.vest ? rgb(look.vest) : shirt, topScale: 0.92, bottom: true });
  torso.addBox(0, 0.92, 0, tw * 0.94, 0.14, 0.26, { color: look.skirt ? shirt : pants });                    // hips
  if (look.skirt) torso.addBox(0, 0.72, 0, 0.5, 0.36, 0.34, { color: shirt, topScale: 0.8 });
  if (look.openShirt) torso.addBox(0, 1.22, 0.14, 0.18, 0.56, 0.02, { color: rgb(look.undershirt) });
  if (look.floral) for (let k = 0; k < 7; k++) torso.addBox(((k * 37) % 9 - 4) * 0.05, 1.0 + ((k * 53) % 10) * 0.045, 0.142, 0.06, 0.06, 0.01, { color: rgb(look.floral) });
  if (look.tie) torso.addBox(0, 1.26, 0.14, 0.06, 0.42, 0.02, { color: rgb(look.tie) });
  if (look.badge) torso.addBox(0.13, 1.36, 0.14, 0.07, 0.08, 0.02, { color: [0.95, 0.8, 0.25] });
  torso.addBox(0, 1.56, 0, 0.14, 0.1, 0.14, { color: skin });                                                   // neck
  torso.addBox(0, 1.74, 0.005, 0.25, 0.28, 0.26, { color: skin, topScale: 0.92, bottom: true });                // head
  torso.addBox(0, 1.72, 0.14, 0.2, 0.05, 0.02, { color: [0.08, 0.08, 0.1] });                                   // sunglasses / eyes
  if (look.helmet) torso.addBox(0, 1.82, 0, 0.3, 0.22, 0.31, { color: rgb(look.helmet), topScale: 0.85 });
  else {
    torso.addBox(0, 1.86, -0.02, 0.27, 0.11, 0.27, { color: hair, topScale: 0.85 });
    torso.addBox(0, 1.76, -0.125, 0.27, 0.22, 0.05, { color: hair });
    if (look.longHair) torso.addBox(0, 1.6, -0.13, 0.3, 0.42, 0.09, { color: hair });
  }
  if (look.hat) { torso.addBox(0, 1.93, 0, 0.62, 0.03, 0.62, { color: rgb(look.hat) }); torso.addBox(0, 1.98, 0, 0.28, 0.1, 0.28, { color: rgb(look.hat) }); }
  if (look.cap) { torso.addBox(0, 1.93, 0, 0.28, 0.09, 0.28, { color: rgb(look.cap) }); torso.addBox(0, 1.9, 0.19, 0.24, 0.03, 0.14, { color: rgb(look.cap, 0.8) }); }
  if (look.bandana) torso.addBox(0, 1.84, 0, 0.275, 0.07, 0.275, { color: rgb(look.bandana) });
  // limbs are modelled hanging from their pivot at y = 0
  const arm = (sleeve) => { const b = new GeometryBatch(); b.addBox(0, -0.15, 0, 0.14, 0.32, 0.16, { color: sleeve, bottom: true }); b.addBox(0, -0.45, 0, 0.115, 0.3, 0.13, { color: skin, bottom: true }); b.addBox(0, -0.64, 0.01, 0.12, 0.1, 0.14, { color: skin, bottom: true }); return b.build(); };
  const leg = () => { const b = new GeometryBatch(); const upper = look.skirt ? skin : pants, lower = look.shorts || look.skirt ? skin : pants; b.addBox(0, -0.22, 0, 0.2, 0.44, 0.22, { color: upper }); b.addBox(0, -0.62, 0, 0.17, 0.38, 0.19, { color: lower }); b.addBox(0, -0.85, 0.045, 0.19, 0.1, 0.3, { color: shoes, bottom: true }); return b.build(); };
  const set = { torso: torso.build(), arm: arm(look.vest ? rgb(look.shirt) : shirt), leg: leg() };
  cache.set(key, set);
  return set;
}

/** Returns a Group; userData.parts = { body, armL, armR, legL, legR, gun } for the animator. */
export function createCharacterMesh(look) {
  const geo = buildGeometries(look);
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const torso = new THREE.Mesh(geo.torso, material); torso.castShadow = true;
  const mk = (g, x, y) => { const m = new THREE.Mesh(g, material); m.position.set(x, y, 0); m.castShadow = true; body.add(m); return m; };
  body.add(torso);
  const armL = mk(geo.arm, 0.31, 1.47), armR = mk(geo.arm, -0.31, 1.47);
  const legL = mk(geo.leg, 0.12, 0.9), legR = mk(geo.leg, -0.12, 0.9);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.3), gunMaterial);
  gun.position.set(0, -0.72, 0.1); gun.visible = false; armR.add(gun);
  root.userData.parts = { body, torso, armL, armR, legL, legR, gun };
  return root;
}
